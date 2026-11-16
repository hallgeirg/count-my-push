import { neon } from "@neondatabase/serverless";

export type SqlRow = Record<string, unknown>;
/** A tagged template returning plain row arrays: neon() in production, PGlite in tests and dev. */
export type SqlTag = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<SqlRow[]>;

let sql: SqlTag | null = null;
let override: SqlTag | null = null;

/** Tests and the local dev server swap in another database (PGlite); pass null to reset. */
export function setSqlOverride(tag: SqlTag | null) {
  override = tag;
}

/** Neon/Vercel strings may include channel_binding; the serverless driver is happier without it. */
function normalizeConnectionString(connectionString: string): string {
  let s = connectionString.trim();
  s = s.replace(/([?&])channel_binding=[^&]*/g, "$1").replace(/\?&/, "?");
  if (s.endsWith("?")) s = s.slice(0, -1);
  return s;
}

export function getSql(): SqlTag {
  if (override) return override;
  if (sql) return sql;
  const raw =
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL or POSTGRES_URL must be set");
  }
  sql = neon(normalizeConnectionString(raw));
  return sql;
}
