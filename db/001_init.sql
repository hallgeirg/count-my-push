-- Minimal pushup tracker schema (single-user, one row profiles)
-- Run against your Neon database once (Neon SQL editor or psql).

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY DEFAULT 1,
  CONSTRAINT goals_single_row CHECK (id = 1),
  daily_goal INTEGER NOT NULL DEFAULT 100,
  weekly_goal INTEGER NOT NULL DEFAULT 500,
  monthly_goal INTEGER NOT NULL DEFAULT 2000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO goals (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  CONSTRAINT settings_single_row CHECK (id = 1),
  quick_add JSONB NOT NULL DEFAULT '[10, 20, 30]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS entries (
  id BIGSERIAL PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count > 0),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entries_performed_at_desc_idx
  ON entries (performed_at DESC);
