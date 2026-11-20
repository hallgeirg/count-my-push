import { LADDERS, SESSION_GOAL, STARTING_LEVEL, UNIT_RULES } from "./catalog";
import { dayKey, daysOfProgramWeek, programWeek, weekdayIndex } from "./dates";
import {
  type AppData,
  type DayKey,
  type Effort,
  type Goal,
  type GoalUnit,
  type Prescription,
  type SessionLog,
  type WorkoutKind,
} from "./types";

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

/** Reps a session counts as: the sum of its sets (per-side sets once), as on the server. */
export function sessionReps(s: SessionLog): number {
  return s.sets.reduce((a, b) => a + b, 0);
}

/**
 * A goal's total per day. Session reps count towards the matching goal:
 * push → pushups, squat → squats, core → situps.
 */
export function goalTotals(data: Pick<AppData, "entries" | "sessions">, goalId: string): Map<DayKey, number> {
  const totals = new Map<DayKey, number>();
  const add = (day: DayKey, n: number) => totals.set(day, (totals.get(day) ?? 0) + n);
  for (const e of data.entries) if (e.goalId === goalId) add(dayKey(new Date(e.at)), e.count);
  for (const s of data.sessions) if (SESSION_GOAL[s.prescription.kind] === goalId) add(s.day, sessionReps(s));
  return totals;
}

export type WeekReview = {
  /** Days in the week where the goal was scheduled (and the programme had started). */
  scheduled: number;
  /** Of those, days where the target was reached. */
  hit: number;
  efforts: Effort[];
};

export function adjustDailyTarget(target: number, review: WeekReview, unit: GoalUnit = "reps"): number {
  const rules = UNIT_RULES[unit];
  if (review.scheduled === 0) return target;
  const rate = review.hit / review.scheduled;
  if (rate < 0.5) return Math.max(Math.min(rules.adaptiveMin, target), target - rules.step);
  if (rate < 0.8) return target;
  if (review.efforts.includes("empty")) return target;
  const easy = review.efforts.filter((e) => e === "easy").length;
  const step = easy >= Math.ceil(review.scheduled / 2) ? rules.step * 2 : rules.step;
  return Math.min(rules.max, target + step);
}

function reviewWeek(
  data: AppData,
  goal: Goal,
  week: number,
  target: number,
  totals: Map<DayKey, number>,
): WeekReview {
  const days = daysOfProgramWeek(data.startDay, week).filter(
    (d) => d >= data.startDay && goal.days.includes(weekdayIndex(d)),
  );
  const efforts: Effort[] = [];
  let hit = 0;
  for (const d of days) {
    if ((totals.get(d) ?? 0) >= target) hit++;
    const effort = data.dailyEffort[goal.id]?.[d];
    if (effort) efforts.push(effort);
  }
  return { scheduled: days.length, hit, efforts };
}

/**
 * A goal's target in a programme week. Fixed goals keep their target; adaptive goals are
 * re-evaluated after every finished week since the target was set, from how often it was
 * reached and how it felt.
 */
export function goalTargetForWeek(data: AppData, goal: Goal, week: number): number {
  if (!goal.adaptive) return goal.target;
  const totals = goalTotals(data, goal.id);
  let target = goal.target;
  for (let w = goal.targetWeek; w < week; w++) {
    target = adjustDailyTarget(target, reviewWeek(data, goal, w, target, totals), goal.unit);
  }
  return target;
}

export type GoalProgress = {
  goal: Goal;
  target: number;
  done: number;
  /** The goal applies on this weekday. */
  scheduled: boolean;
};

/** Every goal's target and total on a day, scheduled goals first. */
export function goalsOnDay(data: AppData, day: DayKey): GoalProgress[] {
  const week = Math.max(0, programWeek(data.startDay, day));
  const weekday = weekdayIndex(day);
  const list = data.goals.map((goal) => ({
    goal,
    target: goalTargetForWeek(data, goal, week),
    done: goalTotals(data, goal.id).get(day) ?? 0,
    scheduled: goal.days.includes(weekday),
  }));
  return [...list.filter((g) => g.scheduled), ...list.filter((g) => !g.scheduled)];
}

export type TodayPlan = {
  day: DayKey;
  weekday: number;
  week: number;
  workout: WorkoutKind | null;
  goals: GoalProgress[];
  /** Today's scheduled workout has already been logged. */
  workoutDone: boolean;
  /** Workouts scheduled earlier this week that have not been made up for yet. */
  catchUp: WorkoutKind[];
};

export function sessionsOnDay(data: AppData, day: DayKey): SessionLog[] {
  return data.sessions.filter((s) => s.day === day);
}

export function todayPlan(data: AppData, now: Date = new Date()): TodayPlan {
  const day = dayKey(now);
  const weekday = weekdayIndex(day);
  const week = Math.max(0, programWeek(data.startDay, day));
  const workout = data.schedule[weekday] ?? null;
  const workoutDone = workout != null && sessionsOnDay(data, day).some((s) => s.prescription.kind === workout);
  const weekDays = daysOfProgramWeek(data.startDay, week);
  const catchUp = (Object.keys(LADDERS) as WorkoutKind[]).filter((kind) => {
    const planned = weekDays.filter(
      (d) => d >= data.startDay && d <= day && data.schedule[weekdayIndex(d)] === kind,
    ).length;
    const done = data.sessions.filter((s) => s.prescription.kind === kind && weekDays.includes(s.day)).length;
    const todaysCard = workout === kind && !workoutDone ? 1 : 0;
    return planned - done - todaysCard > 0;
  });
  return { day, weekday, week, workout, goals: goalsOnDay(data, day), workoutDone, catchUp };
}

export function describePrescription(p: Prescription): string {
  const level = LADDERS[p.kind].levels[p.levelIndex]!;
  return `${p.sets} × ${p.reps}${level.perSide ? " per side" : ""}`;
}

/** "60 s" or "20" – a goal amount with its unit where it matters. */
export function formatAmount(n: number, unit: GoalUnit): string {
  return `${n}${UNIT_RULES[unit].short}`;
}
