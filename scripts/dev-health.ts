/**
 * Local API server for the iPhone app: routes /api/** to the Vercel handler files,
 * backed by an embedded PGlite database in var/pglite (migrations from db/ applied on start).
 *
 *   HEALTH_DEV_AUTH=1 pnpm dev:health   # also accept `Bearer dev:<name>`
 */
import { existsSync, mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setSqlOverride } from "../api/_lib/db.js";
import { createPgliteSql } from "./pglite.js";

const ROOT = join(import.meta.dirname, "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3100);

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

/** /api/health/me → api/health/me.ts or api/health/me/index.ts; `_lib` is never routable. */
function resolveHandler(pathname: string): string | null {
  const rel = pathname.replace(/^\/+|\/+$/g, "");
  if (!/^api(\/[A-Za-z0-9-]+)+$/.test(rel) || rel.includes("/_")) return null;
  for (const candidate of [`${rel}.ts`, `${rel}/index.ts`]) {
    const file = join(ROOT, candidate);
    if (existsSync(file)) return file;
  }
  return null;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const file = resolveHandler(url.pathname);
  if (!file) {
    res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    query[key] = all.length > 1 ? all : all[0];
  }
  const vreq = Object.assign(req, { query, cookies: {}, body: await readBody(req) }) as unknown as VercelRequest;
  const mod = (await import(pathToFileURL(file).href)) as { default: Handler };
  await mod.default(vreq, res as unknown as VercelResponse);
  console.log(`${req.method} ${url.pathname} ${res.statusCode}`);
}

const dataDir = join(ROOT, "var", "pglite");
mkdirSync(dataDir, { recursive: true });
const { sql } = await createPgliteSql(dataDir);
setSqlOverride(sql);

createServer((req, res) => {
  handle(req, res).catch((e: unknown) => {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Server error" }));
  });
}).listen(PORT, HOST, () => {
  const devAuth = process.env.HEALTH_DEV_AUTH === "1" && !process.env.VERCEL;
  console.log(`Health API on http://${HOST}:${PORT} (PGlite: var/pglite, dev auth: ${devAuth ? "on" : "off"})`);
});
