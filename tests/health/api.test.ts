import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import leaderboard from "../../api/health/leaderboard.js";
import me from "../../api/health/me.js";
import sync from "../../api/health/sync.js";
import challenges from "../../api/health/challenges/index.js";
import { call, useTestDb } from "./harness.js";

let testDb: Awaited<ReturnType<typeof useTestDb>>;
beforeAll(async () => {
  testDb = await useTestDb();
});
afterAll(() => testDb.close());
beforeEach(() => {
  vi.stubEnv("HEALTH_DEV_AUTH", "1");
  vi.stubEnv("VERCEL", "");
});
afterEach(() => vi.unstubAllEnvs());

const today = "2026-11-18"; // Wednesday
const entry = (id: string, day: string, count: number, time = "12:00:00") => ({
  id,
  day,
  count,
  at: `${day}T${time}Z`,
});

describe("migrations", () => {
  it("can be re-run without errors or data loss", async () => {
    await call(me, { token: "dev:migrator", query: { today } });
    const { readFile } = await import("node:fs/promises");
    for (const file of ["001_init.sql", "002_health.sql", "003_health_exercises.sql"]) {
      await testDb.db.exec(await readFile(new URL(`../../db/${file}`, import.meta.url), "utf8"));
    }
    const users = await testDb.db.query("SELECT 1 FROM health_users WHERE workos_user_id = 'dev:migrator'");
    expect(users.rows).toHaveLength(1);
  });
});

describe("auth gate", () => {
  it("returns 401 without a token", async () => {
    for (const [handler, method] of [
      [me, "GET"],
      [sync, "POST"],
      [leaderboard, "GET"],
      [challenges, "GET"],
    ] as const) {
      const res = await call(handler, { method, query: { today } });
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual(expect.any(String));
    }
  });

  it("rejects dev tokens unless HEALTH_DEV_AUTH=1", async () => {
    vi.stubEnv("HEALTH_DEV_AUTH", "");
    expect((await call(me, { token: "dev:alice", query: { today } })).status).toBe(401);
  });

  it("never accepts dev tokens on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    expect((await call(me, { token: "dev:alice", query: { today } })).status).toBe(401);
  });

  it("returns 405 for unsupported methods and 400 without today", async () => {
    expect((await call(me, { method: "DELETE", token: "dev:alice" })).status).toBe(405);
    expect((await call(me, { token: "dev:alice" })).status).toBe(400);
  });
});

describe("me", () => {
  it("creates the dev user on first use and returns empty stats", async () => {
    const res = await call(me, { token: "dev:meuser", query: { today } });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: expect.any(String), displayName: "meuser", friendCode: expect.stringMatching(/^[A-Z2-9]{6}$/) });
    expect(res.body.stats).toEqual({ currentStreak: 0, longestStreak: 0, weekTotal: 0, allTimeTotal: 0, activeToday: false });
    const again = await call(me, { token: "dev:meuser", query: { today } });
    expect(again.body.user).toEqual(res.body.user);
  });

  it("updates the display name, trimmed, 1–40 chars", async () => {
    const res = await call(me, { method: "PATCH", token: "dev:meuser", body: { displayName: "  Kari  " } });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("Kari");
    expect((await call(me, { method: "PATCH", token: "dev:meuser", body: { displayName: "   " } })).status).toBe(400);
    expect((await call(me, { method: "PATCH", token: "dev:meuser", body: { displayName: "x".repeat(41) } })).status).toBe(400);
    // JSON string bodies work too
    const str = await call(me, { method: "PATCH", token: "dev:meuser", body: JSON.stringify({ displayName: "Kari N" }) });
    expect(str.body.user.displayName).toBe("Kari N");
  });
});

describe("sync", () => {
  const token = "dev:syncer";

  it("stores a snapshot and returns stats", async () => {
    const res = await call(sync, {
      method: "POST",
      token,
      body: {
        today,
        since: "2026-11-01",
        entries: [entry("e1", "2026-11-10", 10), entry("e2", "2026-11-16", 20), entry("e3", "2026-11-17", 30)],
        sessions: [
          { id: "s1", day: "2026-11-18", at: "2026-11-18T07:00:00Z", kind: "push", levelIndex: 2, sets: [5, 6, 7], effort: "good" },
          { id: "s2", day: "2026-11-15", at: "2026-11-15T07:00:00Z", kind: "squat", levelIndex: 0, sets: [20], effort: "easy" },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      currentStreak: 4, // 15 (squat) .. 18
      longestStreak: 4,
      weekTotal: 20 + 30 + 18,
      allTimeTotal: 10 + 20 + 30 + 18,
      activeToday: true,
    });
  });

  it("replaces the window from since: updates, deletes missing, leaves older rows alone", async () => {
    const res = await call(sync, {
      method: "POST",
      token,
      body: {
        today,
        since: "2026-11-15",
        // e1 (11-10) is before since and not sent: kept. e2 is not sent: deleted. e3 changed.
        entries: [entry("e3", "2026-11-17", 35), entry("e3", "2026-11-17", 40), entry("e4", "2026-11-18", 5)],
        sessions: [],
      },
    });
    expect(res.status).toBe(200);
    const totals = await testDb.db.query<{ client_id: string; count: number }>(
      "SELECT client_id, count FROM health_entries ORDER BY client_id",
    );
    expect(totals.rows).toEqual([
      { client_id: "e1", count: 10 },
      { client_id: "e3", count: 40 },
      { client_id: "e4", count: 5 },
    ]);
    const sessions = await testDb.db.query("SELECT client_id FROM health_sessions");
    expect(sessions.rows).toEqual([]);
    expect(res.body.stats).toMatchObject({ weekTotal: 45, allTimeTotal: 55, currentStreak: 2, activeToday: true });
  });

  it("rejects invalid bodies with 400", async () => {
    const bad = [
      { today, since: "2026-11-01", entries: [entry("x", "2026-11-01", 0)], sessions: [] },
      { today, since: "2026-11-01", entries: [entry("x", "2026-11-31", 1)], sessions: [] },
      { today: "yesterday", since: "2026-11-01", entries: [], sessions: [] },
      { today, since: "2026-11-01", entries: [], sessions: [{ id: "s", day: today, at: "2026-11-18T07:00:00Z", kind: "run", levelIndex: 0, sets: [], effort: "good" }] },
      null,
    ];
    for (const body of bad) {
      const res = await call(sync, { method: "POST", token, body });
      expect(res.status).toBe(400);
    }
  });
});

describe("exercises", () => {
  const token = "dev:exerciser";
  const post = (entries: object[], sessions: object[] = []) =>
    call(sync, { method: "POST", token, body: { today, since: "2026-11-01", entries, sessions } });

  it("stores the exercise, defaults old apps to pushups and allows long planks", async () => {
    const res = await post([
      entry("old", today, 10),
      { ...entry("plank", today, 900), exercise: "plank" },
      { ...entry("sit", today, 20), exercise: "situps" },
    ]);
    expect(res.status).toBe(200);
    const rows = await testDb.db.query(
      "SELECT client_id, exercise, count FROM health_entries e JOIN health_users u ON u.id = e.user_id WHERE u.workos_user_id = $1 ORDER BY client_id",
      [token],
    );
    expect(rows.rows).toEqual([
      { client_id: "old", exercise: "pushups", count: 10 },
      { client_id: "plank", exercise: "plank", count: 900 },
      { client_id: "sit", exercise: "situps", count: 20 },
    ]);
    // Stats stay pushups only.
    expect(res.body.stats).toMatchObject({ weekTotal: 10 });
  });

  it("rejects unknown exercises and entries over an hour", async () => {
    expect((await post([{ ...entry("x", today, 10), exercise: "burpees" }])).status).toBe(400);
    expect((await post([{ ...entry("x", today, 3601), exercise: "plank" }])).status).toBe(400);
  });

  it("ranks one exercise at a time, with squat sessions counted as squats", async () => {
    await post(
      [{ ...entry("sq", today, 15), exercise: "squats" }],
      [{ id: "s1", day: today, at: `${today}T07:00:00Z`, kind: "squat", levelIndex: 0, sets: [10, 10, 10], effort: "good" }],
    );
    const res = await call(leaderboard, { token, query: { today, exercise: "squats" } });
    expect(res.status).toBe(200);
    expect(res.body.exercise).toBe("squats");
    expect(res.body.rows.find((r: { isMe: boolean }) => r.isMe).total).toBe(45);
    expect((await call(leaderboard, { token, query: { today, exercise: "burpees" } })).status).toBe(400);
  });
});

describe("leaderboard", () => {
  it("ranks this week's pushups with shared ranks and marks the caller", async () => {
    const post = (token: string, entries: ReturnType<typeof entry>[]) =>
      call(sync, { method: "POST", token, body: { today, since: "2026-11-01", entries, sessions: [] } });
    await post("dev:lb_a", [entry("a1", "2026-11-16", 50), entry("a2", "2026-11-13", 500)]); // last week ignored
    await post("dev:lb_b", [entry("b1", "2026-11-17", 25), entry("b2", "2026-11-18", 25)]);
    await post("dev:lb_c", [entry("c1", "2026-11-18", 10)]);

    const res = await call(leaderboard, { token: "dev:lb_c", query: { today } });
    expect(res.status).toBe(200);
    expect(res.body.from).toBe("2026-11-16");
    expect(res.body.to).toBe(today);
    const rows = res.body.rows as { rank: number; displayName: string; total: number; currentStreak: number; isMe: boolean }[];
    const lb = rows.filter((r) => r.displayName.startsWith("lb_"));
    // lb_b has the longer streak, so it comes first within the tie.
    expect(lb.map((r) => [r.displayName, r.total, r.currentStreak, r.isMe])).toEqual([
      ["lb_b", 50, 2, false],
      ["lb_a", 50, 0, false],
      ["lb_c", 10, 1, true],
    ]);
    expect(lb[0].rank).toBe(lb[1].rank);
    expect(rows.every((r) => !("email" in r))).toBe(true);
  });
});
