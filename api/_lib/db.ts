import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | null = null;

/** Neon/Vercel strings may include channel_binding; the serverless driver is happier without it. */
function normalizeConnectionString(connectionString: string): string {
  let s = connectionString.trim();
  s = s.replace(/([?&])channel_binding=[^&]*/g, "$1").replace(/\?&/, "?");
  if (s.endsWith("?")) s = s.slice(0, -1);
  return s;
}

export function getSql() {
  if (sql) return sql;
  const raw =
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL or POSTGRES_URL must be set");
  }
  sql = neon(normalizeConnectionString(raw));
  return sql;
}
