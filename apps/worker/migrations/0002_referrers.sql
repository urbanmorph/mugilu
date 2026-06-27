-- Adoption: which sites/apps build on mugilu — the /embed widget and the data
-- API. Host/domain-level only: no individuals, no full URLs, no IP. Our own
-- pages are excluded; a ?ref= value lets server-to-server callers self-identify.

CREATE TABLE IF NOT EXISTS referrers (
  key     TEXT PRIMARY KEY,    -- "surface|host"
  host    TEXT NOT NULL,       -- referring host (no www), or the ?ref= value
  surface TEXT NOT NULL,       -- "embed" | "api"
  n       INTEGER NOT NULL DEFAULT 0,
  last    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_referrers_n ON referrers (n DESC);
