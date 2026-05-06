import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSql } from "./_lib/db";
import { sendJson } from "./_lib/json";

const patchSchema = z.object({
  quickAdd: z
    .array(z.number().int().min(1).max(500))
    .min(2)
    .max(4),
});

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

  const quickAdd = parsed.data.quickAdd;
  const json = JSON.stringify(quickAdd);

  try {
    const sql = getSql();
    const rows = await sql`
      UPDATE settings SET
        quick_add = ${json}::jsonb,
        updated_at = NOW()
      WHERE id = 1
      RETURNING quick_add AS "quickAdd"
    `;
    const row = rows[0] as { quickAdd: unknown } | undefined;
    if (!row) {
      sendJson(res, 500, { error: "Settings row missing" });
      return;
    }
    const arr = Array.isArray(row.quickAdd)
      ? (row.quickAdd as number[])
      : quickAdd;
    sendJson(res, 200, { quickAdd: arr });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: "Server error" });
  }
}
