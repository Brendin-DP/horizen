-- Logging type for exercise_library (weighted / bodyweight / weighted_or_bodyweight)
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS logging_type TEXT DEFAULT 'weighted';
