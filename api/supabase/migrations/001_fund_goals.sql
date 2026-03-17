-- Fund goals: single-row config for fundraising visibility and raised amount.
-- Run this in Supabase SQL editor if the table doesn't exist.

CREATE TABLE IF NOT EXISTS fund_goals (
  id TEXT PRIMARY KEY DEFAULT 'default',
  raised INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO fund_goals (id, raised, visible)
VALUES ('default', 0, true)
ON CONFLICT (id) DO NOTHING;
