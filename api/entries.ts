import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSql } from "./_lib/db";
import { sendJson } from "./_lib/json";

const postSchema = z.object({
  count: z.number().int().min(1).max(500),
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
  if (req.method === "POST") {
    const parsed = postSchema.safeParse(readBody(req));
    if (!parsed.success) {
      sendJson(res, 400, { error: "Invalid body", details: parsed.error.flatten() });
      return;
    }
    const { count } = parsed.data;
    const at = new Date();

    try {
      const sql = getSql();
      const rows = await sql`
        INSERT INTO entries (count, performed_at)
        VALUES (${count}, ${at})
        RETURNING id, count, performed_at AS "performedAt"
      `;
      const row = rows[0] as {
        id: bigint | number;
        count: number;
        performedAt: Date | string;
      };
      sendJson(res, 201, {
        entry: {
          id: Number(row.id),
          count: row.count,
          performedAt:
            row.performedAt instanceof Date
              ? row.performedAt.toISOString()
              : new Date(row.performedAt).toISOString(),
        },
      });
    } catch (e) {
      console.error(e);
      sendJson(res, 500, { error: "Server error" });
    }
    return;
  }

  if (req.method === "DELETE") {
    const rawId = req.query.id;
    const idStr = Array.isArray(rawId) ? rawId[0] : rawId;
    const idParsed = z.coerce.number().int().positive().safeParse(idStr);
    if (!idParsed.success) {
      sendJson(res, 400, { error: "Missing or invalid id" });
      return;
    }
    const id = idParsed.data;
    try {
      const sql = getSql();
      const rows = await sql`
        DELETE FROM entries WHERE id = ${id} RETURNING id
      `;
      if (rows.length === 0) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      sendJson(res, 200, { ok: true });
    } catch (e) {
      console.error(e);
      sendJson(res, 500, { error: "Server error" });
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
