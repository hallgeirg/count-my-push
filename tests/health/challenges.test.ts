import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import challenges from "../../api/health/challenges/index.js";
import respond from "../../api/health/challenges/respond.js";
import me from "../../api/health/me.js";
import sync from "../../api/health/sync.js";
import type { ChallengeView } from "../../api/_lib/health/challenge-views.js";
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

const ALICE = "dev:alice";
const BOB = "dev:bob";
const day0 = "2026-11-16";

async function profile(token: string) {
  return (await call(me, { token, query: { today: day0 } })).body.user as { id: string; friendCode: string };
}

function logSets(token: string, entries: { id: string; day: string; count: number; at: string; exercise?: string }[]) {
  return call(sync, { method: "POST", token, body: { today: day0, since: "2026-11-01", entries, sessions: [] } });
}

async function list(token: string, today: string) {
  const res = await call(challenges, { token, query: { today } });
  expect(res.status).toBe(200);
  return res.body.challenges as ChallengeView[];
}

describe("challenge flow between two dev users", () => {
  let alice: { id: string; friendCode: string };
  let bob: { id: string; friendCode: string };

  beforeAll(async () => {
    vi.stubEnv("HEALTH_DEV_AUTH", "1");
    alice = await profile(ALICE);
    bob = await profile(BOB);
    vi.unstubAllEnvs();
  });

  it("validates creation: unknown code 404, self 400, bad body 400", async () => {
    expect((await call(challenges, { method: "POST", token: ALICE, body: { friendCode: "ZZZZZZ", type: "most_in_period", days: 7 } })).status).toBe(404);
    expect((await call(challenges, { method: "POST", token: ALICE, body: { friendCode: alice.friendCode, type: "most_in_period", days: 7 } })).status).toBe(400);
    expect((await call(challenges, { method: "POST", token: ALICE, body: { friendCode: bob.friendCode, type: "most_in_period", days: 32 } })).status).toBe(400);
    expect((await call(challenges, { method: "POST", token: ALICE, body: { friendCode: bob.friendCode, type: "first_to_target", target: 5 } })).status).toBe(400);
  });

  it("runs a most-in-period challenge from invite to winner", async () => {
    const created = await call(challenges, {
      method: "POST",
      token: ALICE,
      body: { friendCode: bob.friendCode.toLowerCase(), type: "most_in_period", days: 3 },
    });
    expect(created.status).toBe(201);
    const c = created.body.challenge;
    expect(c).toMatchObject({
      type: "most_in_period",
      status: "pending",
      startsOn: null,
      endsOn: null,
      target: null,
      days: 3,
      iAmCreator: true,
      me: { userId: alice.id, displayName: "alice", total: 0 },
      opponent: { userId: bob.id, displayName: "bob", total: 0 },
      winnerUserId: null,
      daysLeft: null,
    });

    const bobView = (await list(BOB, day0)).find((x) => x.id === c.id);
    expect(bobView).toMatchObject({ status: "pending", iAmCreator: false, me: { userId: bob.id }, opponent: { userId: alice.id } });

    // Only the invited user can respond.
    expect((await call(respond, { method: "POST", token: ALICE, body: { id: c.id, accept: true, today: day0 } })).status).toBe(403);
    expect((await call(respond, { method: "POST", token: "dev:eve", body: { id: c.id, accept: true, today: day0 } })).status).toBe(404);

    const accepted = await call(respond, { method: "POST", token: BOB, body: { id: c.id, accept: true, today: day0 } });
    expect(accepted.status).toBe(200);
    expect(accepted.body.challenge).toMatchObject({ status: "active", startsOn: day0, endsOn: "2026-11-18", daysLeft: 3 });
    expect((await call(respond, { method: "POST", token: BOB, body: { id: c.id, accept: false, today: day0 } })).status).toBe(409);

    await logSets(ALICE, [
      { id: "a0", day: "2026-11-15", count: 500, at: "2026-11-15T10:00:00Z" }, // before start
      { id: "a1", day: "2026-11-16", count: 40, at: "2026-11-16T10:00:00Z" },
    ]);
    await logSets(BOB, [
      { id: "b1", day: "2026-11-17", count: 30, at: "2026-11-17T10:00:00Z" },
      { id: "b2", day: "2026-11-18", count: 30, at: "2026-11-18T10:00:00Z" },
    ]);

    const mid = (await list(ALICE, "2026-11-17")).find((x) => x.id === c.id);
    expect(mid).toMatchObject({ status: "active", daysLeft: 2, me: { total: 40 }, opponent: { total: 60 }, winnerUserId: null });

    const done = (await list(ALICE, "2026-11-19")).find((x) => x.id === c.id);
    expect(done).toMatchObject({ status: "completed", daysLeft: null, winnerUserId: bob.id });
  });

  it("runs a first-to-target challenge won by time order", async () => {
    const created = await call(challenges, {
      method: "POST",
      token: BOB,
      body: { friendCode: alice.friendCode, type: "first_to_target", target: 100 },
    });
    expect(created.body.challenge).toMatchObject({ type: "first_to_target", target: 100, days: 30, status: "pending" });
    const id = created.body.challenge.id;

    const accepted = await call(respond, { method: "POST", token: ALICE, body: { id, accept: true, today: "2026-11-17" } });
    expect(accepted.body.challenge).toMatchObject({ status: "active", startsOn: "2026-11-17", endsOn: "2026-12-16", daysLeft: 30 });

    // In the window (from 11-17): bob 30+30 = 60; alice nothing yet.
    let view = (await list(BOB, "2026-11-18")).find((x) => x.id === id);
    expect(view).toMatchObject({ status: "active", me: { total: 60 }, opponent: { total: 0 } });

    // Alice reaches 100 at 09:00 on 11-19; Bob reaches 100 later that day.
    await logSets(ALICE, [
      { id: "a1", day: "2026-11-16", count: 40, at: "2026-11-16T10:00:00Z" },
      { id: "a2", day: "2026-11-19", count: 100, at: "2026-11-19T09:00:00Z" },
    ]);
    await logSets(BOB, [
      { id: "b1", day: "2026-11-17", count: 30, at: "2026-11-17T10:00:00Z" },
      { id: "b2", day: "2026-11-18", count: 30, at: "2026-11-18T10:00:00Z" },
      { id: "b3", day: "2026-11-19", count: 50, at: "2026-11-19T20:00:00Z" },
    ]);
    view = (await list(BOB, "2026-11-19")).find((x) => x.id === id);
    expect(view).toMatchObject({ status: "completed", winnerUserId: alice.id, daysLeft: null, me: { total: 110 }, opponent: { total: 100 } });
  });

  it("handles a decline and lists pending, then active, then finished", async () => {
    const decline = await call(challenges, { method: "POST", token: ALICE, body: { friendCode: bob.friendCode, type: "most_in_period", days: 7 } });
    const declined = await call(respond, { method: "POST", token: BOB, body: { id: decline.body.challenge.id, accept: false, today: day0 } });
    expect(declined.body.challenge).toMatchObject({ status: "declined", startsOn: null, daysLeft: null });

    const active = await call(challenges, { method: "POST", token: ALICE, body: { friendCode: bob.friendCode, type: "most_in_period", days: 7 } });
    await call(respond, { method: "POST", token: BOB, body: { id: active.body.challenge.id, accept: true, today: "2026-11-19" } });
    await call(challenges, { method: "POST", token: BOB, body: { friendCode: alice.friendCode, type: "most_in_period", days: 1 } });

    const statuses = (await list(ALICE, "2026-11-19")).map((x) => x.status);
    expect(statuses).toEqual(["pending", "active", "declined", "completed", "completed"]);
  });

  it("rejects respond with an invalid id", async () => {
    expect((await call(respond, { method: "POST", token: BOB, body: { id: "nope", accept: true, today: day0 } })).status).toBe(400);
    expect(
      (await call(respond, { method: "POST", token: BOB, body: { id: "00000000-0000-4000-8000-000000000000", accept: true, today: day0 } })).status,
    ).toBe(404);
  });
});

describe("challenges in other exercises", () => {
  const CAROL = "dev:carol";
  const DAVE = "dev:dave";
  let dave: { id: string; friendCode: string };

  beforeAll(async () => {
    vi.stubEnv("HEALTH_DEV_AUTH", "1");
    await profile(CAROL);
    dave = await profile(DAVE);
    vi.unstubAllEnvs();
  });

  it("counts only the challenge's exercise", async () => {
    const created = await call(challenges, {
      method: "POST",
      token: CAROL,
      body: { friendCode: dave.friendCode, type: "most_in_period", days: 3, exercise: "plank" },
    });
    expect(created.body.challenge).toMatchObject({ exercise: "plank", status: "pending" });
    const id = created.body.challenge.id;
    await call(respond, { method: "POST", token: DAVE, body: { id, accept: true, today: "2026-12-01" } });
    await logSets(CAROL, [
      { id: "pl1", day: "2026-12-01", count: 120, at: "2026-12-01T08:00:00Z", exercise: "plank" },
      { id: "pu1", day: "2026-12-01", count: 50, at: "2026-12-01T09:00:00Z" },
    ]);
    const view = (await list(CAROL, "2026-12-02")).find((x) => x.id === id);
    expect(view).toMatchObject({ exercise: "plank", me: { total: 120 }, opponent: { total: 0 } });
  });

  it("defaults new challenges to pushups", async () => {
    const created = await call(challenges, {
      method: "POST",
      token: CAROL,
      body: { friendCode: dave.friendCode, type: "most_in_period", days: 1 },
    });
    expect(created.body.challenge.exercise).toBe("pushups");
    expect(
      (await call(challenges, { method: "POST", token: CAROL, body: { friendCode: dave.friendCode, type: "most_in_period", days: 1, exercise: "burpees" } })).status,
    ).toBe(400);
  });
});
