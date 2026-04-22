-- Votes for feature roadmap + RPCs to keep upvotes in sync with junction table.
-- Run after feature_requests exists.

ALTER TYPE feature_request_status ADD VALUE IF NOT EXISTS 'Archived';

CREATE TABLE IF NOT EXISTS feature_request_votes (
  feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (feature_request_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_request_votes_member ON feature_request_votes(member_id);

CREATE OR REPLACE FUNCTION increment_upvotes(request_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE feature_requests
  SET upvotes = upvotes + 1, updated_at = NOW()
  WHERE id = request_id
  RETURNING upvotes INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION decrement_upvotes(request_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE feature_requests
  SET upvotes = GREATEST(0, upvotes - 1), updated_at = NOW()
  WHERE id = request_id
  RETURNING upvotes INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_upvotes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_upvotes(uuid) TO service_role;
