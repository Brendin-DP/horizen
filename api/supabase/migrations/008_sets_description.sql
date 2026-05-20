-- Optional per-set notes (e.g. tempo, RPE, form cues)
ALTER TABLE sets ADD COLUMN IF NOT EXISTS description TEXT;
