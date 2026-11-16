-- Make More Health: multi-user sync, leaderboard and challenges (see docs/health-api.md).
-- Additive and idempotent: safe to run again. Does not touch the tables from 001_init.sql.

CREATE TABLE IF NOT EXISTS health_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workos_user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  friend_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Logged sets, keyed by the app's own id.
CREATE TABLE IF NOT EXISTS health_entries (
  user_id UUID NOT NULL REFERENCES health_users (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count BETWEEN 1 AND 500),
  at TIMESTAMPTZ NOT NULL,
  day DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id)
);

-- Programme sessions; `reps` is the sum of `sets`, kept for fast totals.
CREATE TABLE IF NOT EXISTS health_sessions (
  user_id UUID NOT NULL REFERENCES health_users (id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  day DATE NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('push', 'squat', 'core')),
  level_index INTEGER NOT NULL,
  sets JSONB NOT NULL,
  reps INTEGER NOT NULL,
  effort TEXT NOT NULL CHECK (effort IN ('easy', 'good', 'empty')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS health_entries_user_day_idx ON health_entries (user_id, day);
CREATE INDEX IF NOT EXISTS health_entries_day_idx ON health_entries (day);
CREATE INDEX IF NOT EXISTS health_sessions_user_day_idx ON health_sessions (user_id, day);
CREATE INDEX IF NOT EXISTS health_sessions_day_idx ON health_sessions (day);

-- Every entry and session is activity; `pushups` counts only entries and push sessions.
CREATE OR REPLACE VIEW health_activity AS
  SELECT user_id, day, at, count AS pushups FROM health_entries
  UNION ALL
  SELECT user_id, day, at, CASE WHEN kind = 'push' THEN reps ELSE 0 END AS pushups
  FROM health_sessions;

-- `state` is stored; `active`/`completed` are derived on read from the dates and totals.
CREATE TABLE IF NOT EXISTS health_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('most_in_period', 'first_to_target')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'declined', 'accepted')),
  creator_id UUID NOT NULL REFERENCES health_users (id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES health_users (id) ON DELETE CASCADE,
  days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 60),
  target INTEGER CHECK (target BETWEEN 10 AND 10000),
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (creator_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS health_challenges_creator_idx ON health_challenges (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS health_challenges_opponent_idx ON health_challenges (opponent_id, created_at DESC);
