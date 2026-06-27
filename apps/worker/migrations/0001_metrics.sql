-- mugilu usage metrics — first-party, aggregate, privacy-preserving.
-- No IP, no per-user data, no cookies. Coordinates are rounded to a ~11km grid,
-- so this is a demand heatmap, never a trail.

CREATE TABLE IF NOT EXISTS lookups (
  key   TEXT PRIMARY KEY,        -- rounded "lat,lon" (1 decimal, ~11km)
  label TEXT,                    -- representative place name (reverse-geocoded)
  lat   REAL NOT NULL,
  lon   REAL NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  last  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_lookups_n ON lookups (n DESC);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,         -- "fmt:html|json|md|png", "embed", "api:counts"
  n    INTEGER NOT NULL DEFAULT 0
);
