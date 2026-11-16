/** Local calendar day, formatted `YYYY-MM-DD`. */
export type DayKey = string;

/** The three structured workouts in the programme. Daily pushups are logged separately. */
export type WorkoutKind = "push" | "squat" | "core";

/**
 * How a set or a day felt, measured as reps left "in the tank".
 * - easy: 4 or more reps left
 * - good: 1–3 reps left (the target: "litt igjen i magasinet")
 * - empty: nothing left
 */
export type Effort = "easy" | "good" | "empty";

export type PushEntry = {
  id: string;
  count: number;
  /** ISO timestamp. */
  at: string;
};

/** What the app asked for in one workout. */
export type Prescription = {
  kind: WorkoutKind;
  levelIndex: number;
  sets: number;
  reps: number;
};

export type SessionLog = {
  id: string;
  day: DayKey;
  /** ISO timestamp of completion. */
  at: string;
  prescription: Prescription;
  /** Reps actually done in each set. */
  sets: number[];
  effort: Effort;
};

/** A manual choice of level that replaces the computed progression from `at` onwards. */
export type LevelOverride = {
  levelIndex: number;
  reps: number;
  at: string;
};

export type AppData = {
  version: 1;
  /** First day of the programme. Weeks are counted from the Monday of this day's week. */
  startDay: DayKey;
  quickAdd: number[];
  pushEntries: PushEntry[];
  /** Optional "how did today's pushups feel" rating per day. */
  dailyEffort: Record<DayKey, Effort>;
  sessions: SessionLog[];
  levelOverrides: Partial<Record<WorkoutKind, LevelOverride>>;
  /** Manual daily pushup target that applies from `week` onwards, before later automatic adjustments. */
  dailyTargetOverride: { week: number; target: number } | null;
};
