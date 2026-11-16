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
export const MIN_DAILY_TARGET = 5;
export const MAX_DAILY_TARGET = 150;

export type DayPlan = {
  workout: WorkoutKind | null;
  /** Whether the easy daily pushups apply. Skipped on the heavy push day. */
  dailyPushups: boolean;
};

/** Monday-first weekly schedule. */
export const WEEK_PLAN: readonly DayPlan[] = [
  { workout: "push", dailyPushups: false },
  { workout: "core", dailyPushups: true },
  { workout: "squat", dailyPushups: true },
  { workout: "core", dailyPushups: true },
  { workout: "squat", dailyPushups: true },
  { workout: "core", dailyPushups: true },
  { workout: null, dailyPushups: true },
];

export const EFFORT_LABEL = {
  easy: { title: "Lett", detail: "4+ reps igjen" },
  good: { title: "Litt igjen", detail: "1–3 reps igjen" },
  empty: { title: "Helt tomt", detail: "Ingenting igjen" },
} as const;
