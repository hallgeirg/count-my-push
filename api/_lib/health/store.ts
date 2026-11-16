import { getSql, type SqlRow } from "../db.js";
import type { ChallengeEvent, ChallengeRecord, ChallengeType } from "./challenges.js";
import type { DayTotal } from "./stats.js";
import { generateFriendCode } from "./users.js";

// --- Row normalisation: neon and PGlite differ (bigint as string/BigInt, dates as Date/string).
// Queries cast to ::text / ::int / ::float8 where they can; these helpers are the safety net.

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return Number(v);
  return 0;
}

function str(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function day(v: unknown): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

function dayOrNull(v: unknown): string | null {
  return v == null ? null : day(v);
}

// --- Users

export type HealthUser = { id: string; displayName: string; friendCode: string };

function toUser(r: SqlRow): HealthUser {
  return { id: str(r.id), displayName: str(r.displayName), friendCode: str(r.friendCode) };
}

export async function findUserByWorkosId(workosUserId: string): Promise<HealthUser | null> {
  const rows = await getSql()`
    SELECT id::text AS id, display_name AS "displayName", friend_code AS "friendCode"
    FROM health_users WHERE workos_user_id = ${workosUserId}
  `;
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserByFriendCode(code: string): Promise<HealthUser | null> {
  const rows = await getSql()`
    SELECT id::text AS id, display_name AS "displayName", friend_code AS "friendCode"
    FROM health_users WHERE friend_code = ${code}
  `;
  return rows[0] ? toUser(rows[0]) : null;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

/** Creates the user on first sight (with a fresh friend code); keeps an existing display name. */
export async function upsertUser(
  workosUserId: string,
  profile: { email: string | null; displayName: string },
): Promise<HealthUser> {
  for (let attempt = 0; ; attempt++) {
    try {
      const rows = await getSql()`
        INSERT INTO health_users (workos_user_id, email, display_name, friend_code)
        VALUES (${workosUserId}, ${profile.email}, ${profile.displayName}, ${generateFriendCode()})
        ON CONFLICT (workos_user_id) DO UPDATE
          SET email = COALESCE(EXCLUDED.email, health_users.email)
        RETURNING id::text AS id, display_name AS "displayName", friend_code AS "friendCode"
      `;
      return toUser(rows[0]);
    } catch (e) {
      // A friend-code collision; try another code.
      if (!isUniqueViolation(e) || attempt >= 5) throw e;
    }
  }
}

export async function updateDisplayName(userId: string, displayName: string): Promise<HealthUser> {
  const rows = await getSql()`
    UPDATE health_users SET display_name = ${displayName} WHERE id = ${userId}::uuid
    RETURNING id::text AS id, display_name AS "displayName", friend_code AS "friendCode"
  `;
  return toUser(rows[0]);
}

// --- Activity

/** One row per active day with that day's pushups (0 for squat/core-only days). */
export async function dayTotals(userId: string): Promise<DayTotal[]> {
  const rows = await getSql()`
    SELECT day::text AS day, SUM(pushups)::int AS pushups
    FROM health_activity WHERE user_id = ${userId}::uuid
    GROUP BY day ORDER BY day
  `;
  return rows.map((r) => ({ day: day(r.day), pushups: num(r.pushups) }));
}

export type SyncEntry = { id: string; count: number; at: string; day: string };
export type SyncSession = {
  id: string;
  day: string;
  at: string;
  kind: "push" | "squat" | "core";
  levelIndex: number;
  sets: number[];
  effort: "easy" | "good" | "empty";
};

/** Last occurrence wins, so one statement never touches the same row twice. */
function dedupe<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((i) => [i.id, i])).values()];
}

/**
 * Snapshot replace in one statement (atomic): upsert everything sent, then delete the user's
 * rows with `day >= since` that were not sent. Rows before `since` are left alone.
 */
export async function replaceSnapshot(
  userId: string,
  since: string,
  entries: SyncEntry[],
  sessions: SyncSession[],
): Promise<void> {
  const entriesJson = JSON.stringify(dedupe(entries));
  const sessionsJson = JSON.stringify(
    dedupe(sessions).map((s) => ({
      id: s.id,
      day: s.day,
      at: s.at,
      kind: s.kind,
      level_index: s.levelIndex,
      sets: s.sets,
      reps: s.sets.reduce((a, b) => a + b, 0),
      effort: s.effort,
    })),
  );
  await getSql()`
    WITH in_entries AS (
      SELECT * FROM jsonb_to_recordset(${entriesJson}::jsonb)
        AS x(id text, count int, at timestamptz, day date)
    ), in_sessions AS (
      SELECT * FROM jsonb_to_recordset(${sessionsJson}::jsonb)
        AS x(id text, day date, at timestamptz, kind text, level_index int, sets jsonb, reps int, effort text)
    ), up_entries AS (
      INSERT INTO health_entries (user_id, client_id, count, at, day)
      SELECT ${userId}::uuid, id, count, at, day FROM in_entries
      ON CONFLICT (user_id, client_id) DO UPDATE
        SET count = EXCLUDED.count, at = EXCLUDED.at, day = EXCLUDED.day, updated_at = NOW()
      RETURNING 1
    ), up_sessions AS (
      INSERT INTO health_sessions (user_id, client_id, day, at, kind, level_index, sets, reps, effort)
      SELECT ${userId}::uuid, id, day, at, kind, level_index, sets, reps, effort FROM in_sessions
      ON CONFLICT (user_id, client_id) DO UPDATE
        SET day = EXCLUDED.day, at = EXCLUDED.at, kind = EXCLUDED.kind,
            level_index = EXCLUDED.level_index, sets = EXCLUDED.sets, reps = EXCLUDED.reps,
            effort = EXCLUDED.effort, updated_at = NOW()
      RETURNING 1
    ), del_sessions AS (
      DELETE FROM health_sessions
      WHERE user_id = ${userId}::uuid AND day >= ${since}::date
        AND client_id NOT IN (SELECT id FROM in_sessions)
      RETURNING 1
    )
    DELETE FROM health_entries
    WHERE user_id = ${userId}::uuid AND day >= ${since}::date
      AND client_id NOT IN (SELECT id FROM in_entries)
  `;
}

// --- Leaderboard

export async function weeklyTotals(
  from: string,
  to: string,
): Promise<{ userId: string; displayName: string; total: number }[]> {
  const rows = await getSql()`
    SELECT u.id::text AS "userId", u.display_name AS "displayName", COALESCE(t.total, 0)::int AS total
    FROM health_users u
    LEFT JOIN (
      SELECT user_id, SUM(pushups) AS total FROM health_activity
      WHERE day BETWEEN ${from}::date AND ${to}::date
      GROUP BY user_id
    ) t ON t.user_id = u.id
  `;
  return rows.map((r) => ({ userId: str(r.userId), displayName: str(r.displayName), total: num(r.total) }));
}

/** Every user's distinct active days up to `today`, for streaks. */
export async function activeDaysByUser(today: string): Promise<Map<string, string[]>> {
  const rows = await getSql()`
    SELECT user_id::text AS "userId", day::text AS day FROM health_activity
    WHERE day <= ${today}::date
    GROUP BY user_id, day
  `;
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const id = str(r.userId);
    const list = map.get(id) ?? [];
    list.push(day(r.day));
    map.set(id, list);
  }
  return map;
}

// --- Challenges

export type ChallengeRow = ChallengeRecord & {
  creatorName: string;
  opponentName: string;
};

function toChallenge(r: SqlRow): ChallengeRow {
  return {
    id: str(r.id),
    type: str(r.type) as ChallengeType,
    state: str(r.state) as ChallengeRecord["state"],
    creatorId: str(r.creatorId),
    opponentId: str(r.opponentId),
    days: num(r.days),
    target: r.target == null ? null : num(r.target),
    startsOn: dayOrNull(r.startsOn),
    endsOn: dayOrNull(r.endsOn),
    creatorName: str(r.creatorName),
    opponentName: str(r.opponentName),
  };
}

export async function createChallenge(input: {
  type: ChallengeType;
  creatorId: string;
  opponentId: string;
  days: number;
  target: number | null;
}): Promise<string> {
  const rows = await getSql()`
    INSERT INTO health_challenges (type, creator_id, opponent_id, days, target)
    VALUES (${input.type}, ${input.creatorId}::uuid, ${input.opponentId}::uuid, ${input.days}, ${input.target})
    RETURNING id::text AS id
  `;
  return str(rows[0].id);
}

/** The caller's challenges, newest first; or one challenge by id when `onlyId` is given. */
export async function listChallenges(userId: string, onlyId: string | null = null): Promise<ChallengeRow[]> {
  const rows = await getSql()`
    SELECT c.id::text AS id, c.type, c.state, c.creator_id::text AS "creatorId",
      c.opponent_id::text AS "opponentId", c.days, c.target,
      c.starts_on::text AS "startsOn", c.ends_on::text AS "endsOn",
      cu.display_name AS "creatorName", ou.display_name AS "opponentName"
    FROM health_challenges c
    JOIN health_users cu ON cu.id = c.creator_id
    JOIN health_users ou ON ou.id = c.opponent_id
    WHERE (c.creator_id = ${userId}::uuid OR c.opponent_id = ${userId}::uuid)
      AND (${onlyId}::uuid IS NULL OR c.id = ${onlyId}::uuid)
    ORDER BY c.created_at DESC, c.id
    LIMIT 200
  `;
  return rows.map(toChallenge);
}

/** Pushup events of both sides inside each accepted challenge's window, keyed by challenge id. */
export async function challengeEvents(
  userId: string,
  onlyId: string | null = null,
): Promise<Map<string, ChallengeEvent[]>> {
  const rows = await getSql()`
    SELECT c.id::text AS "challengeId", a.user_id::text AS "userId", a.day::text AS day,
      (EXTRACT(EPOCH FROM a.at) * 1000)::float8 AS "atMs", a.pushups
    FROM (
      SELECT * FROM health_challenges
      WHERE (creator_id = ${userId}::uuid OR opponent_id = ${userId}::uuid)
        AND state = 'accepted'
        AND (${onlyId}::uuid IS NULL OR id = ${onlyId}::uuid)
      ORDER BY created_at DESC
      LIMIT 200
    ) c
    JOIN health_activity a
      ON a.user_id IN (c.creator_id, c.opponent_id)
      AND a.day BETWEEN c.starts_on AND c.ends_on
      AND a.pushups > 0
  `;
  const map = new Map<string, ChallengeEvent[]>();
  for (const r of rows) {
    const id = str(r.challengeId);
    const list = map.get(id) ?? [];
    list.push({ userId: str(r.userId), day: day(r.day), atMs: num(r.atMs), amount: num(r.pushups) });
    map.set(id, list);
  }
  return map;
}

/** Applies a response if the challenge is still pending for this opponent; false otherwise. */
export async function respondToChallenge(
  id: string,
  opponentId: string,
  accept: boolean,
  dates: { startsOn: string; endsOn: string } | null,
): Promise<boolean> {
  const rows = await getSql()`
    UPDATE health_challenges
    SET state = ${accept ? "accepted" : "declined"},
        starts_on = ${dates?.startsOn ?? null}::date,
        ends_on = ${dates?.endsOn ?? null}::date,
        responded_at = NOW()
    WHERE id = ${id}::uuid AND opponent_id = ${opponentId}::uuid AND state = 'pending'
    RETURNING id
  `;
  return rows.length > 0;
}
