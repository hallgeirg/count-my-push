import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPeriodBounds, resolveTimeZone } from "./_lib/buckets";
import { getSql } from "./_lib/db";
import { sendJson } from "./_lib/json";

function normalizeQuickAdd(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [10, 20, 30];
  const nums = raw
    .map((n) => (typeof n === "number" ? Math.floor(n) : Number.NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return [10, 20, 30];
  return nums.slice(0, 4);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const tz = resolveTimeZone(
      typeof req.query.tz === "string" ? req.query.tz : undefined,
    );
    const b = getPeriodBounds(tz);
    const sql = getSql();

    const goalsRows = await sql`
      SELECT daily_goal AS "dailyGoal", weekly_goal AS "weeklyGoal", monthly_goal AS "monthlyGoal"
      FROM goals WHERE id = 1
    `;
    const goalsRow = goalsRows[0] as
      | { dailyGoal: number; weeklyGoal: number; monthlyGoal: number }
      | undefined;
    if (!goalsRow) {
      sendJson(res, 500, { error: "Goals not initialized. Run db/001_init.sql." });
      return;
    }

    const settingsRows = await sql`
      SELECT quick_add AS "quickAdd" FROM settings WHERE id = 1
    `;
    const settingsRow = settingsRows[0] as { quickAdd: unknown } | undefined;
    if (!settingsRow) {
      sendJson(res, 500, {
        error: "Settings not initialized. Run db/001_init.sql.",
      });
      return;
    }

    const [dayRows, weekRows, monthRows] = await Promise.all([
      sql`
        SELECT COALESCE(SUM(count), 0)::int AS total FROM entries
        WHERE performed_at >= ${b.dayStart} AND performed_at < ${b.dayEndExclusive}
      `,
      sql`
        SELECT COALESCE(SUM(count), 0)::int AS total FROM entries
        WHERE performed_at >= ${b.weekStart} AND performed_at < ${b.weekEndExclusive}
      `,
      sql`
        SELECT COALESCE(SUM(count), 0)::int AS total FROM entries
        WHERE performed_at >= ${b.monthStart} AND performed_at < ${b.monthEndExclusive}
      `,
    ]);

    const recent = await sql`
      SELECT id, count, performed_at AS "performedAt"
      FROM entries
      ORDER BY performed_at DESC, id DESC
      LIMIT 25
    `;

    const d = dayRows[0] as { total: number } | undefined;
    const w = weekRows[0] as { total: number } | undefined;
    const m = monthRows[0] as { total: number } | undefined;

    sendJson(res, 200, {
      timeZone: tz,
      goals: {
        dailyGoal: goalsRow.dailyGoal,
        weeklyGoal: goalsRow.weeklyGoal,
        monthlyGoal: goalsRow.monthlyGoal,
      },
      quickAdd: normalizeQuickAdd(settingsRow.quickAdd),
      totals: {
        daily: d?.total ?? 0,
        weekly: w?.total ?? 0,
        monthly: m?.total ?? 0,
      },
      recentEntries: (
        recent as {
          id: bigint | number;
          count: number;
          performedAt: Date | string;
        }[]
      ).map((r) => ({
        id: Number(r.id),
        count: r.count,
        performedAt:
          r.performedAt instanceof Date
            ? r.performedAt.toISOString()
            : new Date(r.performedAt).toISOString(),
      })),
    });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: "Server error" });
  }
}
