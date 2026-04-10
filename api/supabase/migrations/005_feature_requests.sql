-- Feature requests from mobile (audit + roadmap). Run after core members table exists.

DO $$ BEGIN
  CREATE TYPE feature_request_tag AS ENUM ('Bug', 'Feature Request', 'Improvement');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE feature_request_status AS ENUM (
    'Requested',
    'Under Consideration',
    'In Progress',
    'Done'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tag feature_request_tag NOT NULL DEFAULT 'Feature Request',
  status feature_request_status NOT NULL DEFAULT 'Requested',
  requested_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_requested_by ON feature_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON feature_requests(created_at);
