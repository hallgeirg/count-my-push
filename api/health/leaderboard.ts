import { sendJson } from "../_lib/json.js";
import { requireUser } from "../_lib/health/auth.js";
import { weekStart } from "../_lib/health/days.js";
import { route, todayQuery } from "../_lib/health/http.js";
import { rankLeaderboard } from "../_lib/health/leaderboard.js";
import { currentStreak } from "../_lib/health/stats.js";
import { activeDaysByUser, weeklyTotals } from "../_lib/health/store.js";

export default route({
  GET: async (req, res) => {
    const today = todayQuery(req);
    const user = await requireUser(req);
    const from = weekStart(today);
    const [totals, activeDays] = await Promise.all([weeklyTotals(from, today), activeDaysByUser(today)]);
    const rows = rankLeaderboard(
      totals.map((t) => ({ ...t, currentStreak: currentStreak(activeDays.get(t.userId) ?? [], today) })),
      user.id,
    );
    sendJson(res, 200, {
      from,
      to: today,
      rows: rows.map((r) => ({
        rank: r.rank,
        userId: r.userId,
        displayName: r.displayName,
        total: r.total,
        currentStreak: r.currentStreak,
        isMe: r.isMe,
      })),
    });
  },
});
