import { addDays, dayKey } from "../program/dates";
import { PUSHUP_GOAL_ID, type AppData, type DayKey } from "../program/types";
import type { SyncPayload } from "./types";

/** The app uploads this many days (today included); the server replaces its copy of that window. */
export const SYNC_WINDOW_DAYS = 120;

/**
 * Local log → `POST /api/health/sync` body.
 *
 * The server replaces its copy from `since`, so the window never starts before this phone began
 * tracking (`trackedSince`) or its oldest local record. A new phone with an empty log therefore
 * can't wipe history uploaded from another phone. Only the pushup goal is shared for now.
 */
export function buildSyncPayload(
  data: Pick<AppData, "entries" | "sessions">,
  now: Date = new Date(),
  trackedSince?: DayKey,
): SyncPayload {
  const today = dayKey(now);
  const windowStart = addDays(today, -(SYNC_WINDOW_DAYS - 1));
  const pushEntries = data.entries.filter((e) => e.goalId === PUSHUP_GOAL_ID);
  const oldestLocal = [...pushEntries.map((e) => dayKey(new Date(e.at))), ...data.sessions.map((x) => x.day)]
    .reduce<DayKey | undefined>((min, d) => (min === undefined || d < min ? d : min), undefined);
  const firstTracked = [trackedSince, oldestLocal].filter((d): d is DayKey => !!d).sort()[0] ?? windowStart;
  const since = firstTracked > windowStart ? (firstTracked > today ? today : firstTracked) : windowStart;
  const entries = pushEntries
    .map((e) => ({ id: e.id, count: e.count, at: e.at, day: dayKey(new Date(e.at)) }))
    .filter((e) => e.day >= since && Number.isInteger(e.count) && e.count >= 1 && e.count <= 500);
  const sessions = data.sessions
    .filter((s) => s.day >= since)
    .map((s) => ({
      id: s.id,
      day: s.day,
      at: s.at,
      kind: s.prescription.kind,
      levelIndex: s.prescription.levelIndex,
      sets: s.sets,
      effort: s.effort,
    }));
  return { today, since, entries, sessions };
}
