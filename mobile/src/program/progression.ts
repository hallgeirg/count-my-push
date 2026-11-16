import {
  INITIAL_DAILY_TARGET,
  LADDERS,
  MAX_DAILY_TARGET,
  MIN_DAILY_TARGET,
  STARTING_LEVEL,
  WEEK_PLAN,
  type DayPlan,
} from "./catalog";
import { dayKey, daysOfProgramWeek, programWeek, weekdayIndex } from "./dates";
import type { AppData, DayKey, Effort, Prescription, SessionLog, WorkoutKind } from "./types";

/**
 * Double progression: add reps while every set is completed with something left,
 * and move to the next variant once the top of the rep range is passed.
 * "Helt tomt" holds the prescription; a clearly missed session steps back.
 */
export function nextPrescription(prev: Prescription, done: number[], effort: Effort): Prescription {
  const ladder = LADDERS[prev.kind];
  const level = ladder.levels[prev.levelIndex] ?? ladder.levels[0]!;
  const target = prev.sets * prev.reps;
  const total = done.reduce((a, b) => a + b, 0);
  const allHit = done.length >= prev.sets && done.every((r) => r >= prev.reps);

  if (allHit && effort !== "empty") {
    const reps = prev.reps + (effort === "easy" ? 2 : 1);
    if (reps <= level.maxReps) return { ...prev, reps };
    const next = ladder.levels[prev.levelIndex + 1];
    if (next) return { ...prev, levelIndex: prev.levelIndex + 1, reps: next.minReps };
    // Last step of the ladder: keep adding reps.
    return { ...prev, reps };
  }

  if (allHit) return prev;

  if (total < target * 0.5 && prev.levelIndex > 0) {
    const easier = ladder.levels[prev.levelIndex - 1]!;
    return { ...prev, levelIndex: prev.levelIndex - 1, reps: easier.maxReps };
  }
  if (total < target * 0.8) {
    return { ...prev, reps: Math.max(level.minReps, prev.reps - 1) };
  }
  return prev;
}

export function startingPrescription(kind: WorkoutKind): Prescription {
  const ladder = LADDERS[kind];
  const levelIndex = STARTING_LEVEL[kind];
  return { kind, levelIndex, sets: ladder.sets, reps: ladder.levels[levelIndex]!.minReps };
}

export function lastSession(data: AppData, kind: WorkoutKind): SessionLog | undefined {
  let latest: SessionLog | undefined;
  for (const s of data.sessions) {
    if (s.prescription.kind !== kind) continue;
    if (!latest || s.at > latest.at) latest = s;
  }
  return latest;
}

/** What the next workout of this kind should be. */
export function currentPrescription(data: AppData, kind: WorkoutKind): Prescription {
  const override = data.levelOverrides[kind];
  const last = lastSession(data, kind);
  if (override && (!last || override.at > last.at)) {
    return { kind, levelIndex: override.levelIndex, sets: LADDERS[kind].sets, reps: override.reps };
  }
  if (last) return nextPrescription(last.prescription, last.sets, last.effort);
  return startingPrescription(kind);
}

export function dailyTotals(data: AppData): Map<DayKey, number> {
  const totals = new Map<DayKey, number>();
  for (const e of data.pushEntries) {
    const key = dayKey(new Date(e.at));
    totals.set(key, (totals.get(key) ?? 0) + e.count);
  }
  return totals;
}

export type WeekReview = {
  /** Days in the week where daily pushups were scheduled (and the programme had started). */
  scheduled: number;
  /** Of those, days where the target was reached. */
  hit: number;
  efforts: Effort[];
};

export function adjustDailyTarget(target: number, review: WeekReview): number {
  if (review.scheduled === 0) return target;
  const rate = review.hit / review.scheduled;
  if (rate < 0.5) return Math.max(MIN_DAILY_TARGET, target - 2);
  if (rate < 0.8) return target;
  if (review.efforts.includes("empty")) return target;
  const easy = review.efforts.filter((e) => e === "easy").length;
  const step = easy >= Math.ceil(review.scheduled / 2) ? 4 : 2;
  return Math.min(MAX_DAILY_TARGET, target + step);
}

function reviewWeek(
  data: AppData,
  week: number,
  target: number,
  totals: Map<DayKey, number>,
): WeekReview {
  const days = daysOfProgramWeek(data.startDay, week).filter(
    (d) => d >= data.startDay && WEEK_PLAN[weekdayIndex(d)]!.dailyPushups,
  );
  const efforts: Effort[] = [];
  let hit = 0;
  for (const d of days) {
    if ((totals.get(d) ?? 0) >= target) hit++;
    const effort = data.dailyEffort[d];
    if (effort) efforts.push(effort);
  }
  return { scheduled: days.length, hit, efforts };
}

/**
 * Daily pushup target for a programme week: starts at ten and is re-evaluated
 * after every finished week from how often the target was hit and how it felt.
 */
export function dailyTargetForWeek(data: AppData, week: number): number {
  let target = INITIAL_DAILY_TARGET;
  let from = 0;
  const override = data.dailyTargetOverride;
  if (override && override.week <= week) {
    target = override.target;
    from = override.week;
  }
  const totals = dailyTotals(data);
  for (let w = from; w < week; w++) {
    target = adjustDailyTarget(target, reviewWeek(data, w, target, totals));
  }
  return target;
}

export type TodayPlan = {
  day: DayKey;
  weekday: number;
  week: number;
  plan: DayPlan;
  dailyTarget: number;
  dailyDone: number;
  /** Today's scheduled workout has already been logged. */
  workoutDone: boolean;
  /** The weekly push session has not been done yet this week (and today is past push day). */
  pushPending: boolean;
};

export function sessionsOnDay(data: AppData, day: DayKey): SessionLog[] {
  return data.sessions.filter((s) => s.day === day);
}

export function todayPlan(data: AppData, now: Date = new Date()): TodayPlan {
  const day = dayKey(now);
  const weekday = weekdayIndex(day);
  const week = Math.max(0, programWeek(data.startDay, day));
  const plan = WEEK_PLAN[weekday]!;
  const todays = sessionsOnDay(data, day);
  const workoutDone = plan.workout != null && todays.some((s) => s.prescription.kind === plan.workout);
  const weekDays = new Set(daysOfProgramWeek(data.startDay, week));
  const pushThisWeek = data.sessions.some(
    (s) => s.prescription.kind === "push" && weekDays.has(s.day),
  );
  return {
    day,
    weekday,
    week,
    plan,
    dailyTarget: dailyTargetForWeek(data, week),
    dailyDone: dailyTotals(data).get(day) ?? 0,
    workoutDone,
    pushPending: plan.workout !== "push" && !pushThisWeek,
  };
}

export function describePrescription(p: Prescription): string {
  const level = LADDERS[p.kind].levels[p.levelIndex]!;
  return `${p.sets} × ${p.reps}${level.perSide ? " per side" : ""}`;
}
