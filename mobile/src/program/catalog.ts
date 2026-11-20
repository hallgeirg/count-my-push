import type { WorkoutKind } from "./types";

export type Level = {
  name: string;
  /** Short coaching cue shown during the workout. */
  cue: string;
  minReps: number;
  maxReps: number;
  /** Reps are counted per leg/side. */
  perSide?: boolean;
};

export type Ladder = {
  kind: WorkoutKind;
  title: string;
  goal: string;
  sets: number;
  restSeconds: number;
  levels: Level[];
};

/**
 * Weekly heavy push session: always 3 × 5, close to failure.
 * The rep count stays at five; progress comes from moving to a harder variant.
 */
export const PUSH_LADDER: Ladder = {
  kind: "push",
  title: "Push-økt",
  goal: "3 runder à 5 – nesten tomt (1 rep igjen)",
  sets: 3,
  restSeconds: 150,
  levels: [
    { name: "Pushups med hender på benk", cue: "Kropp som en planke, bryst ned mot kanten.", minReps: 5, maxReps: 5 },
    { name: "Vanlige pushups", cue: "Albuer ca. 45° ut fra kroppen, full bevegelse.", minReps: 5, maxReps: 5 },
    { name: "Diamant-pushups", cue: "Tomler og pekefingre danner en diamant under brystet.", minReps: 5, maxReps: 5 },
    { name: "Decline-pushups", cue: "Føttene på en stol, hold hoftene oppe.", minReps: 5, maxReps: 5 },
    { name: "Pseudo-planche-pushups", cue: "Hendene ved hofta, len skuldrene fram over hendene.", minReps: 5, maxReps: 5 },
    { name: "Archer-pushups", cue: "Én arm jobber, den andre er strak ut til siden.", minReps: 5, maxReps: 5, perSide: true },
    { name: "Decline diamant-pushups", cue: "Føttene høyt, hendene samlet.", minReps: 5, maxReps: 5 },
    { name: "Ettarms-pushups på benk", cue: "Bred fotstilling, stram mage, én hånd på benken.", minReps: 5, maxReps: 5, perSide: true },
    { name: "Ettarms-pushups", cue: "Bred fotstilling, ikke vri hofta.", minReps: 5, maxReps: 5, perSide: true },
  ],
};

/** Squat progression whose last step is the dragon squat. */
export const SQUAT_LADDER: Ladder = {
  kind: "squat",
  title: "Knebøy-økt",
  goal: "Bygg mot dragon squat",
  sets: 3,
  restSeconds: 120,
  levels: [
    { name: "Knebøy", cue: "Hælene i bakken, knærne følger tærne, rolig ned.", minReps: 10, maxReps: 20 },
    { name: "Splittknebøy", cue: "Bakre kne nesten ned i gulvet, overkropp rett.", minReps: 8, maxReps: 15, perSide: true },
    { name: "Bulgarsk splittknebøy", cue: "Bakre fot på stol, tre sekunder ned.", minReps: 6, maxReps: 12, perSide: true },
    { name: "Pistol squat med støtte", cue: "Hold i dørkarm eller stolpe, trekk så lite som mulig.", minReps: 5, maxReps: 10, perSide: true },
    { name: "Pistol squat til benk", cue: "Sett deg kontrollert ned på en lav benk og reis deg på ett bein.", minReps: 5, maxReps: 10, perSide: true },
    { name: "Pistol squat", cue: "Fritt bein strakt fram, armene fram som motvekt.", minReps: 3, maxReps: 8, perSide: true },
    { name: "Dragon squat med støtte", cue: "Det frie beinet føres bak og på skrå forbi standbeinet. Hold i noe.", minReps: 3, maxReps: 8, perSide: true },
    { name: "Dragon squat", cue: "Frie bein bak standbeinet, kneet nesten i gulvet, opp uten støtte.", minReps: 3, maxReps: 10, perSide: true },
  ],
};

/** Core work on the days without push or squat sessions. */
export const CORE_LADDER: Ladder = {
  kind: "core",
  title: "Situps",
  goal: "Kjernen på dagene uten annen økt",
  sets: 3,
  restSeconds: 60,
  levels: [
    { name: "Situps", cue: "Rolig opp, rolig ned – ikke dra i nakken.", minReps: 10, maxReps: 25 },
    { name: "Situps med sakte nedfiring", cue: "Opp normalt, tre sekunder ned.", minReps: 10, maxReps: 20 },
    { name: "V-ups", cue: "Armer og bein møtes over hofta.", minReps: 8, maxReps: 20 },
  ],
};

export const LADDERS: Record<WorkoutKind, Ladder> = {
  push: PUSH_LADDER,
  squat: SQUAT_LADDER,
  core: CORE_LADDER,
};

/** Where a brand-new programme starts – deliberately gentle. */
export const STARTING_LEVEL: Record<WorkoutKind, number> = {
  push: 1,
  squat: 0,
  core: 0,
};

export const INITIAL_DAILY_TARGET = 10;

/** Bounds and weekly step for a goal's target, by unit. */
export const UNIT_RULES = {
  reps: { min: 1, max: 500, adaptiveMin: 5, step: 2, label: "reps", short: "" },
  seconds: { min: 5, max: 1800, adaptiveMin: 10, step: 5, label: "sekunder", short: " s" },
} as const;

/** Monday-first default plan: heavy push Monday, squats Wednesday and Friday, situps in between. */
export const DEFAULT_SCHEDULE: readonly (WorkoutKind | null)[] = ["push", "core", "squat", "core", "squat", "core", null];

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export type GoalPreset = { id: string; name: string; unit: "reps" | "seconds"; target: number; quickAdd: number[] };

/** Ready-made daily goals offered in setup and when adding a goal. */
export const GOAL_PRESETS: readonly GoalPreset[] = [
  { id: "pushups", name: "Pushups", unit: "reps", target: INITIAL_DAILY_TARGET, quickAdd: [5, 10, 20] },
  { id: "situps", name: "Situps", unit: "reps", target: 20, quickAdd: [10, 20, 30] },
  { id: "squats", name: "Knebøy", unit: "reps", target: 20, quickAdd: [10, 15, 25] },
  { id: "plank", name: "Planke", unit: "seconds", target: 60, quickAdd: [30, 45, 60] },
  { id: "pullups", name: "Pullups", unit: "reps", target: 5, quickAdd: [1, 3, 5] },
];

/** Exercises «Sammen» can compare between users: the presets. Custom goals stay on the phone. */
export const SHARED_EXERCISES: readonly string[] = GOAL_PRESETS.map((p) => p.id);

/** What a challenge or leaderboard counts, as a noun: "pushups", "sekunder planke". */
export function exerciseNoun(id: string): string {
  const preset = GOAL_PRESETS.find((p) => p.id === id);
  if (!preset) return id;
  return preset.unit === "seconds" ? `sekunder ${preset.name.toLowerCase()}` : preset.name.toLowerCase();
}

/** Programme sessions count towards the matching daily goal, as on the server. */
export const SESSION_GOAL: Record<WorkoutKind, string> = { push: "pushups", squat: "squats", core: "situps" };

export const SHORT_NAME: Record<WorkoutKind, string> = { push: "Push", squat: "Knebøy", core: "Situps" };

export const EFFORT_LABEL = {
  easy: { title: "Lett", detail: "4+ reps igjen" },
  good: { title: "Litt igjen", detail: "1–3 reps igjen" },
  empty: { title: "Helt tomt", detail: "Ingenting igjen" },
} as const;
