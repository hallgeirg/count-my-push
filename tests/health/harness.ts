import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setSqlOverride } from "../../api/_lib/db.js";
import { createPgliteSql } from "../../scripts/pglite.js";

// Response bodies are asserted field by field in tests, so keep them loosely typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonBody = any;

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

/** Fresh in-memory database with all migrations; returns a cleanup function. */
export async function useTestDb() {
  const { db, sql } = await createPgliteSql();
  setSqlOverride(sql);
  return {
    db,
    async close() {
      setSqlOverride(null);
      await db.close();
    },
  };
}

export async function call(
  handler: Handler,
  opts: { method?: string; token?: string; query?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; body: JsonBody; headers: Record<string, string> }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const req = { method: opts.method ?? "GET", headers, query: opts.query ?? {}, body: opts.body } as unknown as VercelRequest;
  const out = { status: 0, text: "", headers: {} as Record<string, string> };
  const fake = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      out.headers[name.toLowerCase()] = value;
      return fake;
    },
    end(data?: string) {
      out.status = fake.statusCode;
      out.text = data ?? "";
      return fake;
    },
  };
  const res = fake as unknown as VercelResponse;
  await handler(req, res);
  return { status: out.status, body: out.text ? JSON.parse(out.text) : null, headers: out.headers };
}
