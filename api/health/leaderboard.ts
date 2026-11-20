import { sendJson } from "../_lib/json.js";
import { requireUser } from "../_lib/health/auth.js";
import { weekStart } from "../_lib/health/days.js";
import { EXERCISES, type Exercise } from "../_lib/health/exercises.js";
import { HttpError, route, todayQuery } from "../_lib/health/http.js";
import { rankLeaderboard } from "../_lib/health/leaderboard.js";
import { currentStreak } from "../_lib/health/stats.js";
import { activeDaysByUser, weeklyTotals } from "../_lib/health/store.js";

export default route({
  GET: async (req, res) => {
    const today = todayQuery(req);
    const user = await requireUser(req);
    const from = weekStart(today);
    const raw = req.query?.exercise;
    const exercise = (typeof raw === "string" && raw ? raw : "pushups") as Exercise;
    if (!EXERCISES.includes(exercise)) throw new HttpError(400, "Unknown exercise");
    const [totals, activeDays] = await Promise.all([
      weeklyTotals(from, today, exercise),
      activeDaysByUser(today),
    ]);
    const rows = rankLeaderboard(
      totals.map((t) => ({ ...t, currentStreak: currentStreak(activeDays.get(t.userId) ?? [], today) })),
      user.id,
    );
    sendJson(res, 200, {
      from,
      to: today,
      exercise,
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
