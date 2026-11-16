import { describe, expect, it } from "vitest";
import type { SessionLog } from "../program/types";
import { buildSyncPayload } from "./syncPayload";

// Local noon on Monday 2026-11-16.
const NOW = new Date(2026, 10, 16, 12);

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

function session(partial: Partial<SessionLog> = {}): SessionLog {
  return {
    id: "s1",
    day: "2026-11-16",
    at: at(2026, 11, 16, 8),
    prescription: { kind: "push", levelIndex: 2, sets: 3, reps: 5 },
    sets: [5, 5, 4],
    effort: "good",
    ...partial,
  };
}

describe("buildSyncPayload", () => {
  it("sends a 120-day window ending today", () => {
    const p = buildSyncPayload({ pushEntries: [], sessions: [] }, NOW);
    expect(p.today).toBe("2026-11-16");
    expect(p.since).toBe("2026-07-20");
  });

  it("adds the local day to entries and drops those before the window", () => {
    const p = buildSyncPayload(
      {
        pushEntries: [
          { id: "old", count: 10, at: at(2026, 7, 19) },
          { id: "first", count: 10, at: at(2026, 7, 20, 0) },
          { id: "late", count: 20, at: at(2026, 11, 15, 23) },
        ],
        sessions: [],
      },
      NOW,
    );
    expect(p.entries).toEqual([
      { id: "first", count: 10, at: at(2026, 7, 20, 0), day: "2026-07-20" },
      { id: "late", count: 20, at: at(2026, 11, 15, 23), day: "2026-11-15" },
    ]);
  });

  it("leaves out entries the API would reject", () => {
    const p = buildSyncPayload(
      {
        pushEntries: [
          { id: "zero", count: 0, at: at(2026, 11, 16) },
          { id: "huge", count: 501, at: at(2026, 11, 16) },
          { id: "ok", count: 500, at: at(2026, 11, 16) },
        ],
        sessions: [],
      },
      NOW,
    );
    expect(p.entries.map((e) => e.id)).toEqual(["ok"]);
  });

  it("flattens sessions to the API shape", () => {
    const p = buildSyncPayload(
      { pushEntries: [], sessions: [session(), session({ id: "old", day: "2026-07-01" })] },
      NOW,
    );
    expect(p.sessions).toEqual([
      {
        id: "s1",
        day: "2026-11-16",
        at: at(2026, 11, 16, 8),
        kind: "push",
        levelIndex: 2,
        sets: [5, 5, 4],
        effort: "good",
      },
    ]);
  });

  it("never replaces server history from before this phone started tracking", () => {
    const empty = buildSyncPayload({ pushEntries: [], sessions: [] }, NOW, "2026-11-10");
    expect(empty.since).toBe("2026-11-10");
    expect(empty.entries).toEqual([]);
  });

  it("still includes older local records when the install marker is newer", () => {
    const p = buildSyncPayload(
      { pushEntries: [{ id: "a", count: 5, at: new Date(2026, 10, 1, 9).toISOString() }], sessions: [] },
      NOW,
      "2026-11-10",
    );
    expect(p.since).toBe("2026-11-01");
    expect(p.entries).toHaveLength(1);
  });
});
