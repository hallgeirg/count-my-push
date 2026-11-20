/** Local calendar day, formatted `YYYY-MM-DD`. */
export type DayKey = string;

/** The three structured workouts in the programme. Daily goals are logged separately. */
export type WorkoutKind = "push" | "squat" | "core";

/**
 * How a set or a day felt, measured as reps left "in the tank".
 * - easy: 4 or more reps left
 * - good: 1–3 reps left (the target: "litt igjen i magasinet")
 * - empty: nothing left
 */
export type Effort = "easy" | "good" | "empty";

export type GoalUnit = "reps" | "seconds";

/** A daily goal the user sets up: "50 pushups every weekday", "60 s plank on Saturdays". */
export type Goal = {
  id: string;
  name: string;
  unit: GoalUnit;
  /** Target per scheduled day, from programme week `targetWeek` onwards. */
  target: number;
  targetWeek: number;
  /** Weekdays the goal applies, Monday = 0 … Sunday = 6. */
  days: number[];
  quickAdd: number[];
  /** Let the app adjust the target every week from hit rate and how it felt. */
  adaptive: boolean;
};

/** The built-in pushup goal; its log is what «Sammen» syncs. */
export const PUSHUP_GOAL_ID = "pushups";

export type LogEntry = {
  id: string;
  goalId: string;
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
  version: 2;
  /** The first-run setup has been completed (or skipped). */
  onboarded: boolean;
  /** First day of the programme. Weeks are counted from the Monday of this day's week. */
  startDay: DayKey;
  goals: Goal[];
  entries: LogEntry[];
  /** Optional "how did it feel" rating per goal and day. */
  dailyEffort: Record<string, Record<DayKey, Effort>>;
  /** Monday-first weekly workout plan; `null` is a day without a workout. */
  schedule: (WorkoutKind | null)[];
  sessions: SessionLog[];
  levelOverrides: Partial<Record<WorkoutKind, LevelOverride>>;
};
