import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSql } from "./_lib/db.js";
import { sendJson } from "./_lib/json.js";

const patchSchema = z
  .object({
    dailyGoal: z.number().int().min(1).max(10_000).optional(),
    weeklyGoal: z.number().int().min(1).max(100_000).optional(),
    monthlyGoal: z.number().int().min(1).max(500_000).optional(),
  })
  .refine(
    (d) =>
      d.dailyGoal !== undefined ||
      d.weeklyGoal !== undefined ||
      d.monthlyGoal !== undefined,
    { message: "At least one goal field is required" },
  );

function readBody(req: VercelRequest): unknown {
  if (req.body == null) return null;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as unknown;
    } catch {
      return null;
    }
  }
  return req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const parsed = patchSchema.safeParse(readBody(req));
  if (!parsed.success) {
    sendJson(res, 400, { error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { dailyGoal, weeklyGoal, monthlyGoal } = parsed.data;

  try {
    const sql = getSql();
    const rows = await sql`
      UPDATE goals SET
        daily_goal = COALESCE(${dailyGoal ?? null}, daily_goal),
        weekly_goal = COALESCE(${weeklyGoal ?? null}, weekly_goal),
        monthly_goal = COALESCE(${monthlyGoal ?? null}, monthly_goal),
        updated_at = NOW()
      WHERE id = 1
      RETURNING daily_goal AS "dailyGoal", weekly_goal AS "weeklyGoal", monthly_goal AS "monthlyGoal"
    `;
    const row = rows[0] as
      | { dailyGoal: number; weeklyGoal: number; monthlyGoal: number }
      | undefined;
    if (!row) {
      sendJson(res, 500, { error: "Goals row missing" });
      return;
    }
    sendJson(res, 200, { goals: row });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: "Server error" });
  }
}
