import { describe, expect, it } from "vitest";
import {
  challengeOutcome,
  challengeProgress,
  challengeTitle,
  daysLeftLabel,
  groupChallenges,
  standing,
} from "./challenges";
import type { Challenge } from "./types";

function challenge(partial: Partial<Challenge> = {}): Challenge {
  return {
    id: "c1",
    type: "most_in_period",
    status: "active",
    startsOn: "2026-11-16",
    endsOn: "2026-11-22",
    target: null,
    iAmCreator: true,
    me: { userId: "me", displayName: "Hallgeir", total: 40 },
    opponent: { userId: "op", displayName: "Kari", total: 25 },
    winnerUserId: null,
    daysLeft: 7,
    ...partial,
  };
}

describe("groupChallenges", () => {
  it("splits pending by who sent it and puts declined with finished", () => {
    const g = groupChallenges([
      challenge({ id: "in", status: "pending", iAmCreator: false }),
      challenge({ id: "out", status: "pending", iAmCreator: true }),
      challenge({ id: "act" }),
      challenge({ id: "done", status: "completed" }),
      challenge({ id: "no", status: "declined" }),
    ]);
    expect(g.incoming.map((c) => c.id)).toEqual(["in"]);
    expect(g.sent.map((c) => c.id)).toEqual(["out"]);
    expect(g.active.map((c) => c.id)).toEqual(["act"]);
    expect(g.finished.map((c) => c.id)).toEqual(["done", "no"]);
  });
});

describe("challengeTitle", () => {
  it("shows the period length once dates are known", () => {
    expect(challengeTitle(challenge())).toBe("Flest pushups på 7 dager");
    expect(challengeTitle(challenge({ endsOn: "2026-11-16" }))).toBe("Flest pushups på 1 dag");
    expect(challengeTitle(challenge({ status: "pending", startsOn: null, endsOn: null }))).toBe("Flest pushups");
    expect(challengeTitle(challenge({ status: "pending", startsOn: null, endsOn: null, days: 3 }))).toBe(
      "Flest pushups på 3 dager",
    );
  });

  it("shows the target for first-to challenges", () => {
    expect(challengeTitle(challenge({ type: "first_to_target", target: 500 }))).toBe("Først til 500 pushups");
  });
});

describe("challengeOutcome", () => {
  it("names the result from my point of view", () => {
    expect(challengeOutcome(challenge({ status: "completed", winnerUserId: "me" }))).toBe("Vunnet");
    expect(challengeOutcome(challenge({ status: "completed", winnerUserId: "op" }))).toBe("Tapt");
    expect(challengeOutcome(challenge({ status: "completed", winnerUserId: null }))).toBe("Uavgjort");
    expect(challengeOutcome(challenge({ status: "declined" }))).toBe("Avslått");
    expect(challengeOutcome(challenge())).toBeNull();
  });
});

describe("standing and days left", () => {
  it("describes the gap in words", () => {
    expect(standing(challenge())).toBe("Du leder med 15");
    expect(standing(challenge({ me: { userId: "me", displayName: "H", total: 20 } }))).toBe("Du ligger 5 bak");
    expect(standing(challenge({ me: { userId: "me", displayName: "H", total: 25 } }))).toBe("Likt så langt");
  });

  it("counts days left including today", () => {
    expect(daysLeftLabel(5)).toBe("5 dager igjen");
    expect(daysLeftLabel(1)).toBe("Siste dag");
    expect(daysLeftLabel(null)).toBeNull();
  });
});

describe("challengeProgress", () => {
  it("measures against the target", () => {
    expect(challengeProgress(challenge({ type: "first_to_target", target: 100 }))).toEqual({ me: 0.4, opponent: 0.25 });
  });

  it("measures against the leader without a target and handles zero", () => {
    expect(challengeProgress(challenge())).toEqual({ me: 1, opponent: 25 / 40 });
    const zero = { userId: "x", displayName: "x", total: 0 };
    expect(challengeProgress(challenge({ me: zero, opponent: zero }))).toEqual({ me: 0, opponent: 0 });
  });
});
