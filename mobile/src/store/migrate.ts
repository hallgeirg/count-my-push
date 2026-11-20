import { DEFAULT_SCHEDULE, GOAL_PRESETS, INITIAL_DAILY_TARGET, type GoalPreset } from "../program/catalog";
import { dayKey } from "../program/dates";
import { PUSHUP_GOAL_ID, type AppData, type DayKey, type Effort, type Goal } from "../program/types";

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function goalFromPreset(preset: GoalPreset, week = 0, days: number[] = [0, 1, 2, 3, 4, 5, 6]): Goal {
  return {
    id: preset.id,
    name: preset.name,
    unit: preset.unit,
    target: preset.target,
    targetWeek: week,
    days,
    quickAdd: [...preset.quickAdd],
    adaptive: preset.unit === "reps",
  };
}

/** A fresh install: the pushup goal and the default plan, waiting for first-run setup. */
export function emptyData(today: DayKey = dayKey(new Date())): AppData {
  return {
    version: 2,
    onboarded: false,
    startDay: today,
    goals: [goalFromPreset(GOAL_PRESETS[0]!, 0, [1, 2, 3, 4, 5, 6])],
    entries: [],
    dailyEffort: {},
    schedule: [...DEFAULT_SCHEDULE],
    sessions: [],
    levelOverrides: {},
  };
}

/** The pushup-only format the first release stored. */
type V1 = {
  version?: 1;
  startDay?: DayKey;
  quickAdd?: number[];
  pushEntries?: { id: string; count: number; at: string }[];
  dailyEffort?: Record<DayKey, Effort>;
  sessions?: AppData["sessions"];
  levelOverrides?: AppData["levelOverrides"];
  dailyTargetOverride?: { week: number; target: number } | null;
};

/** Reads whatever was stored, upgrading the pushup-only format without losing anything. */
export function migrate(raw: unknown, today: DayKey = dayKey(new Date())): AppData {
  const base = emptyData(today);
  if (!raw || typeof raw !== "object") return base;
  if ((raw as { version?: number }).version === 2) return { ...base, ...(raw as Partial<AppData>) };

  const v1 = raw as V1;
  const override = v1.dailyTargetOverride;
  const pushups: Goal = {
    ...base.goals[0]!,
    target: override?.target ?? INITIAL_DAILY_TARGET,
    targetWeek: override?.week ?? 0,
    quickAdd: v1.quickAdd?.length ? v1.quickAdd : base.goals[0]!.quickAdd,
  };
  return {
    ...base,
    onboarded: true,
    startDay: v1.startDay ?? today,
    goals: [pushups],
    entries: (v1.pushEntries ?? []).map((e) => ({ ...e, goalId: PUSHUP_GOAL_ID })),
    dailyEffort: v1.dailyEffort && Object.keys(v1.dailyEffort).length ? { [PUSHUP_GOAL_ID]: v1.dailyEffort } : {},
    sessions: v1.sessions ?? [],
    levelOverrides: v1.levelOverrides ?? {},
  };
}
