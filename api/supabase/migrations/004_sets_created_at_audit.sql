-- Sets: audit timestamp (when the row was inserted). Not the exercise session date — that is sessions.logged_at.
-- Safe to run on DBs that already have created_at (IF NOT EXISTS / no-op updates).

ALTER TABLE sets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill only if legacy rows ended up NULL
UPDATE sets SET created_at = NOW() WHERE created_at IS NULL;

COMMENT ON COLUMN sets.created_at IS 'Audit: insert time for this set row. Session calendar date is sessions.logged_at.';

CREATE INDEX IF NOT EXISTS idx_sets_created_at ON sets(created_at);
