import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SqlTag } from "../api/_lib/db.js";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "db");

/** An embedded Postgres with db/*.sql applied in order, plus a neon-shaped sql tag for it. */
export async function createPgliteSql(dataDir?: string): Promise<{ db: PGlite; sql: SqlTag }> {
  const db = new PGlite(dataDir);
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(join(MIGRATIONS_DIR, file), "utf8"));
  }
  const sql: SqlTag = (strings, ...values) =>
    db.sql<Record<string, unknown>>(strings, ...values).then((r) => r.rows);
  return { db, sql };
}
