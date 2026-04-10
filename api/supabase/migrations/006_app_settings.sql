-- Key/value settings for app-wide toggles (e.g. public roadmap).

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES ('roadmap_public', 'false')
ON CONFLICT (key) DO NOTHING;
