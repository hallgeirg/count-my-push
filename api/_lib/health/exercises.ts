/**
 * Exercises that can be shared and compared between users. The app's own custom goals stay
 * on the phone. Keep in sync with `GOAL_PRESETS` in mobile/src/program/catalog.ts and the
 * CHECK constraints in db/003_health_exercises.sql.
 */
export const EXERCISES = ["pushups", "situps", "squats", "plank", "pullups"] as const;
export type Exercise = (typeof EXERCISES)[number];

/** Programme sessions count towards the matching daily exercise. */
export const SESSION_EXERCISE = { push: "pushups", squat: "squats", core: "situps" } as const;

/** Largest single entry: 500 reps, or an hour of plank. */
export const MAX_ENTRY = 3600;
