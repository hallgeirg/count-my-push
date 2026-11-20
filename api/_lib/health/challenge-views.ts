import { evaluateChallenge, orderChallenges, type ChallengeStatus } from "./challenges.js";
import { challengeEvents, listChallenges, type ChallengeRow } from "./store.js";

type Side = { userId: string; displayName: string; total: number };

export type ChallengeView = {
  id: string;
  type: ChallengeRow["type"];
  exercise: ChallengeRow["exercise"];
  status: ChallengeStatus;
  startsOn: string | null;
  endsOn: string | null;
  days: number;
  target: number | null;
  iAmCreator: boolean;
  me: Side;
  opponent: Side;
  winnerUserId: string | null;
  daysLeft: number | null;
};

/** The caller's challenges as API objects (one, when `onlyId` is given), unordered. */
export async function loadChallengeViews(
  viewerId: string,
  today: string,
  onlyId: string | null = null,
): Promise<ChallengeView[]> {
  const [rows, events] = await Promise.all([
    listChallenges(viewerId, onlyId),
    challengeEvents(viewerId, onlyId),
  ]);
  return rows.map((c) => {
    const outcome = evaluateChallenge(c, events.get(c.id) ?? [], today);
    const creator: Side = { userId: c.creatorId, displayName: c.creatorName, total: outcome.totals[c.creatorId] };
    const opponent: Side = { userId: c.opponentId, displayName: c.opponentName, total: outcome.totals[c.opponentId] };
    const iAmCreator = c.creatorId === viewerId;
    return {
      id: c.id,
      type: c.type,
      exercise: c.exercise,
      status: outcome.status,
      startsOn: c.startsOn,
      endsOn: c.endsOn,
      days: c.days,
      target: c.target,
      iAmCreator,
      me: iAmCreator ? creator : opponent,
      opponent: iAmCreator ? opponent : creator,
      winnerUserId: outcome.winnerUserId,
      daysLeft: outcome.daysLeft,
    };
  });
}

export async function listChallengeViews(viewerId: string, today: string): Promise<ChallengeView[]> {
  return orderChallenges(await loadChallengeViews(viewerId, today));
}
