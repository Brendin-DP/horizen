-- Exercise request workflow: status enum, requester, notes, rejection reason

DO $$
BEGIN
  CREATE TYPE exercise_status AS ENUM ('active', 'requested', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS status exercise_status NOT NULL DEFAULT 'active';

ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS request_notes TEXT;

ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_exercise_library_status ON exercise_library(status);

-- Movement pattern (optional on requests / approvals)
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS type TEXT;
