import { describe, expect, it } from "vitest";
import {
  acceptedDates,
  checkRespond,
  evaluateChallenge,
  firstToTarget,
  orderChallenges,
  type ChallengeEvent,
  type ChallengeRecord,
} from "../../api/_lib/health/challenges.js";
import { addDays, diffDays, isDayKey, weekStart } from "../../api/_lib/health/days.js";
import { rankLeaderboard } from "../../api/_lib/health/leaderboard.js";
import { computeStats, currentStreak, longestStreak } from "../../api/_lib/health/stats.js";
import {
  deriveDisplayName,
  FRIEND_CODE_ALPHABET,
  generateFriendCode,
  normalizeFriendCode,
} from "../../api/_lib/health/users.js";

describe("day math", () => {
  it("validates real calendar days only", () => {
    expect(isDayKey("2026-11-16")).toBe(true);
    expect(isDayKey("2024-02-29")).toBe(true);
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("2026-1-01")).toBe(false);
    expect(isDayKey(20261116)).toBe(false);
  });

  it("adds and diffs across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("finds the Monday of the week", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(weekStart("2026-11-19")).toBe("2026-11-16");
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // across a year
  });
});

describe("streaks", () => {
  it("counts back from today when today is active", () => {
    expect(currentStreak(["2026-11-14", "2026-11-15", "2026-11-16"], "2026-11-16")).toBe(3);
  });

  it("counts back from yesterday when today has no activity yet", () => {
    expect(currentStreak(["2026-11-14", "2026-11-15"], "2026-11-16")).toBe(2);
  });

  it("is zero after a missed day", () => {
    expect(currentStreak(["2026-11-13", "2026-11-14"], "2026-11-16")).toBe(0);
    expect(currentStreak([], "2026-11-16")).toBe(0);
  });

  it("stops at gaps and handles duplicates and unsorted input", () => {
    expect(currentStreak(["2026-11-16", "2026-11-12", "2026-11-15", "2026-11-15", "2026-11-14"], "2026-11-16")).toBe(3);
  });

  it("runs across month boundaries", () => {
    const days = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"];
    expect(currentStreak(days, "2026-11-02")).toBe(4);
    expect(longestStreak(["2026-02-27", "2026-02-28", "2026-03-01"], "2026-03-05")).toBe(3);
  });

  it("finds the longest run ever and ignores days after today", () => {
    const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-10", "2026-11-15", "2026-11-16", "2026-11-17"];
    expect(longestStreak(days, "2026-11-16")).toBe(3);
    expect(currentStreak(days, "2026-11-16")).toBe(2);
    expect(longestStreak([], "2026-11-16")).toBe(0);
  });

  it("computes stats with Monday-based week totals", () => {
    const stats = computeStats(
      [
        { day: "2026-11-15", pushups: 50 }, // Sunday, previous week
        { day: "2026-11-16", pushups: 20 },
        { day: "2026-11-17", pushups: 0 }, // squat-only day: active, no pushups
        { day: "2026-11-18", pushups: 30 },
      ],
      "2026-11-18",
    );
    expect(stats).toEqual({
      currentStreak: 4,
      longestStreak: 4,
      weekTotal: 50,
      allTimeTotal: 100,
      activeToday: true,
    });
  });
});

describe("leaderboard ranking", () => {
  const u = (userId: string, total: number, currentStreak = 0, displayName = userId) => ({
    userId,
    displayName,
    total,
    currentStreak,
  });

  it("shares ranks for ties, ordered by streak then name", () => {
    const rows = rankLeaderboard([u("d", 10), u("b", 50, 1), u("c", 50, 3), u("a", 50, 1), u("e", 5)], "e");
    expect(rows.map((r) => [r.userId, r.rank])).toEqual([
      ["c", 1],
      ["a", 1],
      ["b", 1],
      ["d", 4],
      ["e", 5],
    ]);
    expect(rows.find((r) => r.isMe)?.userId).toBe("e");
  });

  it("returns the top 50 plus the caller when outside", () => {
    const users = Array.from({ length: 60 }, (_, i) => u(`u${String(i).padStart(2, "0")}`, 100 - i));
    const rows = rankLeaderboard(users, "u55");
    expect(rows).toHaveLength(51);
    expect(rows[50]).toMatchObject({ userId: "u55", rank: 56, isMe: true });
    expect(rankLeaderboard(users, "u03")).toHaveLength(50);
  });
});

describe("challenges", () => {
  const base: ChallengeRecord = {
    id: "c1",
    type: "most_in_period",
    state: "accepted",
    creatorId: "alice",
    opponentId: "bob",
    days: 3,
    target: null,
    startsOn: "2026-11-16",
    endsOn: "2026-11-18",
  };
  const ev = (userId: string, day: string, amount: number, atMs = Date.parse(`${day}T12:00:00Z`)): ChallengeEvent => ({
    userId,
    day,
    amount,
    atMs,
  });

  it("sets accepted dates inclusive of today", () => {
    expect(acceptedDates("2026-11-30", 3)).toEqual({ startsOn: "2026-11-30", endsOn: "2026-12-02" });
    expect(acceptedDates("2026-11-30", 1)).toEqual({ startsOn: "2026-11-30", endsOn: "2026-11-30" });
  });

  it("lets only the invited user respond while pending", () => {
    const pending = { ...base, state: "pending" as const };
    expect(checkRespond(pending, "bob")).toBe("ok");
    expect(checkRespond(pending, "alice")).toBe("forbidden");
    expect(checkRespond(pending, "eve")).toBe("not_found");
    expect(checkRespond({ ...pending, state: "declined" }, "bob")).toBe("not_pending");
    expect(checkRespond(base, "bob")).toBe("not_pending");
  });

  it("reports pending and declined without totals or daysLeft", () => {
    const pending = { ...base, state: "pending" as const, startsOn: null, endsOn: null };
    expect(evaluateChallenge(pending, [], "2026-11-16")).toMatchObject({ status: "pending", daysLeft: null });
    expect(evaluateChallenge({ ...pending, state: "declined" }, [], "2026-11-16").status).toBe("declined");
  });

  describe("most in period", () => {
    const events = [
      ev("alice", "2026-11-15", 999), // before start
      ev("alice", "2026-11-16", 30),
      ev("bob", "2026-11-17", 20),
      ev("bob", "2026-11-18", 20),
      ev("bob", "2026-11-19", 999), // after end
    ];

    it("is active until endsOn with inclusive daysLeft", () => {
      expect(evaluateChallenge(base, events, "2026-11-16")).toEqual({
        status: "active",
        totals: { alice: 30, bob: 40 },
        winnerUserId: null,
        daysLeft: 3,
      });
      expect(evaluateChallenge(base, events, "2026-11-18").daysLeft).toBe(1);
    });

    it("completes after endsOn with the higher total winning", () => {
      expect(evaluateChallenge(base, events, "2026-11-19")).toMatchObject({
        status: "completed",
        winnerUserId: "bob",
        daysLeft: null,
      });
    });

    it("has no winner on a tie", () => {
      const tie = [ev("alice", "2026-11-16", 40), ev("bob", "2026-11-17", 40)];
      expect(evaluateChallenge(base, tie, "2026-11-20")).toMatchObject({ status: "completed", winnerUserId: null });
    });
  });

  describe("first to target", () => {
    const race: ChallengeRecord = { ...base, type: "first_to_target", target: 50, days: 30, endsOn: "2026-12-15" };

    it("is won by whoever reaches the target first by time, completing at once", () => {
      const events = [
        ev("bob", "2026-11-16", 60, Date.parse("2026-11-16T18:00:00Z")),
        ev("alice", "2026-11-16", 30, Date.parse("2026-11-16T08:00:00Z")),
        ev("alice", "2026-11-16", 25, Date.parse("2026-11-16T09:00:00Z")),
      ];
      expect(evaluateChallenge(race, events, "2026-11-16")).toMatchObject({
        status: "completed",
        winnerUserId: "alice",
        totals: { alice: 55, bob: 60 },
        daysLeft: null,
      });
    });

    it("stays active below target and reports daysLeft", () => {
      expect(evaluateChallenge(race, [ev("alice", "2026-11-16", 49)], "2026-11-20")).toMatchObject({
        status: "active",
        winnerUserId: null,
        daysLeft: 26,
      });
    });

    it("completes without a winner when nobody reached it by endsOn", () => {
      expect(evaluateChallenge(race, [ev("alice", "2026-11-16", 49)], "2026-12-16")).toMatchObject({
        status: "completed",
        winnerUserId: null,
      });
    });

    it("ignores events outside the window and ties on the same instant", () => {
      const tie = [ev("alice", "2026-11-16", 50, 1), ev("bob", "2026-11-16", 50, 1)];
      expect(firstToTarget(tie, ["alice", "bob"], 50)).toEqual({ reached: true, winnerUserId: null });
      expect(evaluateChallenge(race, tie, "2026-11-16")).toMatchObject({ status: "completed", winnerUserId: null });
      const outside = [ev("alice", "2026-11-15", 100), ev("bob", "2026-11-16", 10)];
      expect(evaluateChallenge(race, outside, "2026-11-16")).toMatchObject({ status: "active", totals: { alice: 0, bob: 10 } });
    });
  });

  it("orders pending, then active, then at most 20 finished", () => {
    const list = [
      ...Array.from({ length: 25 }, (_, i) => ({ id: `done${i}`, status: i % 2 ? ("completed" as const) : ("declined" as const) })),
      { id: "act", status: "active" as const },
      { id: "pend", status: "pending" as const },
    ];
    const ordered = orderChallenges(list);
    expect(ordered.slice(0, 3).map((c) => c.id)).toEqual(["pend", "act", "done0"]);
    expect(ordered).toHaveLength(22);
  });
});

describe("users", () => {
  it("generates 6-character codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateFriendCode();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      for (const ch of code) expect(FRIEND_CODE_ALPHABET).toContain(ch);
    }
    expect(FRIEND_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(generateFriendCode(() => 0)).toBe("AAAAAA");
  });

  it("normalises typed friend codes", () => {
    expect(normalizeFriendCode(" abc-def ")).toBe("ABCDEF");
    expect(normalizeFriendCode("ABCDE0")).toBeNull();
    expect(normalizeFriendCode("ABC")).toBeNull();
  });

  it("derives display names from first name, else e-mail, else a fallback", () => {
    expect(deriveDisplayName({ firstName: "  Kari ", email: "k@x.no" })).toBe("Kari");
    expect(deriveDisplayName({ firstName: " ", email: "ola.nordmann@x.no" })).toBe("ola.nordmann");
    expect(deriveDisplayName({ firstName: null, email: null })).toBe("Athlete");
    expect(deriveDisplayName({ firstName: "x".repeat(60) })).toHaveLength(40);
  });
});
