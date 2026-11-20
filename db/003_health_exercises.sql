-- Make More Health: exercises other than pushups in sync, the leaderboard and challenges.
-- Additive and idempotent: safe to run again. Existing rows become pushups, which is what they are.
-- Run before deploying the API that reads `exercise`.

ALTER TABLE health_entries ADD COLUMN IF NOT EXISTS exercise TEXT NOT NULL DEFAULT 'pushups';
ALTER TABLE health_challenges ADD COLUMN IF NOT EXISTS exercise TEXT NOT NULL DEFAULT 'pushups';

ALTER TABLE health_entries DROP CONSTRAINT IF EXISTS health_entries_exercise_check;
ALTER TABLE health_entries ADD CONSTRAINT health_entries_exercise_check
  CHECK (exercise IN ('pushups', 'situps', 'squats', 'plank', 'pullups'));
ALTER TABLE health_challenges DROP CONSTRAINT IF EXISTS health_challenges_exercise_check;
ALTER TABLE health_challenges ADD CONSTRAINT health_challenges_exercise_check
  CHECK (exercise IN ('pushups', 'situps', 'squats', 'plank', 'pullups'));

-- Plank is logged in seconds, so one entry may be up to an hour.
ALTER TABLE health_entries DROP CONSTRAINT IF EXISTS health_entries_count_check;
ALTER TABLE health_entries ADD CONSTRAINT health_entries_count_check CHECK (count BETWEEN 1 AND 3600);

-- Amounts per exercise. A separate view, so re-running 002 (which replaces health_activity)
-- keeps working. Sessions count towards their exercise: push → pushups, squat → squats,
-- core → situps.
CREATE OR REPLACE VIEW health_amounts AS
  SELECT user_id, day, at, exercise, count AS amount FROM health_entries
  UNION ALL
  SELECT user_id, day, at,
    CASE kind WHEN 'push' THEN 'pushups' WHEN 'squat' THEN 'squats' ELSE 'situps' END AS exercise,
    reps AS amount
  FROM health_sessions;
