export type LeaderboardInput = {
  userId: string;
  displayName: string;
  total: number;
  currentStreak: number;
};

export type LeaderboardRow = LeaderboardInput & { rank: number; isMe: boolean };

const byName = new Intl.Collator("en", { sensitivity: "base" });

/**
 * Highest total first. Equal totals share a rank (1, 1, 3) and are ordered by
 * streak, then name. Returns the top `limit` rows plus the caller's row if it falls outside.
 */
export function rankLeaderboard(
  users: LeaderboardInput[],
  meId: string,
  limit = 50,
): LeaderboardRow[] {
  const sorted = [...users].sort(
    (a, b) =>
      b.total - a.total ||
      b.currentStreak - a.currentStreak ||
      byName.compare(a.displayName, b.displayName) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
  const ranked: LeaderboardRow[] = [];
  sorted.forEach((u, i) => {
    const prev = ranked[i - 1];
    const rank = prev && prev.total === u.total ? prev.rank : i + 1;
    ranked.push({ ...u, rank, isMe: u.userId === meId });
  });
  const top = ranked.slice(0, limit);
  if (!top.some((r) => r.isMe)) {
    const me = ranked.find((r) => r.isMe);
    if (me) top.push(me);
  }
  return top;
}
