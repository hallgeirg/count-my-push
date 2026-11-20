import { addDays, diffDays } from "./days.js";
import type { Exercise } from "./exercises.js";

export type ChallengeType = "most_in_period" | "first_to_target";
/** What is stored; `active`/`completed` are derived from it on read. */
export type StoredState = "pending" | "declined" | "accepted";
export type ChallengeStatus = "pending" | "declined" | "active" | "completed";

export type ChallengeRecord = {
  id: string;
  type: ChallengeType;
  exercise: Exercise;
  state: StoredState;
  creatorId: string;
  opponentId: string;
  days: number;
  target: number | null;
  startsOn: string | null;
  endsOn: string | null;
};

/** One logged entry or session in the challenge's exercise; `amount` is its reps or seconds. */
export type ChallengeEvent = { userId: string; day: string; atMs: number; amount: number };

export type ChallengeOutcome = {
  status: ChallengeStatus;
  totals: Record<string, number>;
  winnerUserId: string | null;
  daysLeft: number | null;
};

export function acceptedDates(today: string, days: number): { startsOn: string; endsOn: string } {
  return { startsOn: today, endsOn: addDays(today, days - 1) };
}

export type RespondCheck = "ok" | "not_found" | "forbidden" | "not_pending";

/** Only the invited user may respond, and only while the challenge is pending. */
export function checkRespond(c: ChallengeRecord, userId: string): RespondCheck {
  if (userId !== c.creatorId && userId !== c.opponentId) return "not_found";
  if (userId !== c.opponentId) return "forbidden";
  if (c.state !== "pending") return "not_pending";
  return "ok";
}

/**
 * Who reached `target` first, ordered by event time. `reached` is false while nobody has;
 * both reaching it at the same instant is a finish without a winner.
 */
export function firstToTarget(
  events: ChallengeEvent[],
  sides: [string, string],
  target: number,
): { reached: boolean; winnerUserId: string | null } {
  const sorted = events
    .filter((e) => sides.includes(e.userId))
    .sort((a, b) => a.atMs - b.atMs);
  const sums: Record<string, number> = { [sides[0]]: 0, [sides[1]]: 0 };
  for (let i = 0; i < sorted.length; ) {
    // Process all events sharing a timestamp together so simultaneous finishes tie.
    const at = sorted[i].atMs;
    const reached: string[] = [];
    for (; i < sorted.length && sorted[i].atMs === at; i++) {
      const e = sorted[i];
      sums[e.userId] += e.amount;
    }
    for (const s of sides) if (sums[s] >= target) reached.push(s);
    if (reached.length > 0) return { reached: true, winnerUserId: reached.length === 1 ? reached[0] : null };
  }
  return { reached: false, winnerUserId: null };
}

export function evaluateChallenge(
  c: ChallengeRecord,
  events: ChallengeEvent[],
  today: string,
): ChallengeOutcome {
  const sides: [string, string] = [c.creatorId, c.opponentId];
  const totals: Record<string, number> = { [c.creatorId]: 0, [c.opponentId]: 0 };
  if (c.state !== "accepted" || !c.startsOn || !c.endsOn) {
    return { status: c.state === "declined" ? "declined" : "pending", totals, winnerUserId: null, daysLeft: null };
  }
  const { startsOn, endsOn } = c;
  const inWindow = events.filter(
    (e) => sides.includes(e.userId) && e.day >= startsOn && e.day <= endsOn,
  );
  for (const e of inWindow) totals[e.userId] += e.amount;

  let winnerUserId: string | null = null;
  let completed: boolean;
  if (c.type === "most_in_period") {
    completed = today > endsOn;
    if (completed) {
      const [a, b] = sides;
      winnerUserId = totals[a] > totals[b] ? a : totals[b] > totals[a] ? b : null;
    }
  } else {
    const race = firstToTarget(inWindow, sides, c.target ?? Number.POSITIVE_INFINITY);
    winnerUserId = race.winnerUserId;
    completed = race.reached || today > endsOn;
  }
  return {
    status: completed ? "completed" : "active",
    totals,
    winnerUserId,
    daysLeft: completed ? null : Math.max(0, diffDays(today, endsOn) + 1),
  };
}

const STATUS_ORDER: Record<ChallengeStatus, number> = { pending: 0, active: 1, declined: 2, completed: 2 };

/** Pending first, then active, then at most `finishedLimit` finished ones. Input order is kept within groups. */
export function orderChallenges<T extends { status: ChallengeStatus }>(list: T[], finishedLimit = 20): T[] {
  const sorted = list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => STATUS_ORDER[a.c.status] - STATUS_ORDER[b.c.status] || a.i - b.i)
    .map((x) => x.c);
  let finished = 0;
  return sorted.filter((c) => STATUS_ORDER[c.status] < 2 || ++finished <= finishedLimit);
}
