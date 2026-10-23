-- Opt-in alerts for official warnings (alerts.ts). Unlike the aggregate tables,
-- this is per person, and only for people who turn alerts on for a place: their
-- browser's push address and keys, and the places they chose, rounded to about
-- 1 km. Nothing else (no IP, no account). Rows go when alerts are turned off,
-- or when the push service says the address no longer exists.

CREATE TABLE IF NOT EXISTS push_places (
  endpoint_hash TEXT NOT NULL,        -- SHA-256 of the endpoint, to look it up
  endpoint      TEXT NOT NULL,        -- the browser's push address
  p256dh        TEXT NOT NULL,        -- its encryption key
  auth          TEXT NOT NULL,        -- its authentication secret
  lat           REAL NOT NULL,        -- the place, 2 decimals (~1 km)
  lon           REAL NOT NULL,
  label         TEXT NOT NULL,        -- the place's name, as shown in the alert
  lang          TEXT NOT NULL DEFAULT 'en',
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  checked_at    INTEGER NOT NULL DEFAULT 0, -- last warnings check for this place
  PRIMARY KEY (endpoint_hash, lat, lon)
);
CREATE INDEX IF NOT EXISTS idx_push_point ON push_places (lat, lon);

-- Which warning each browser has been sent, so it is sent once. Kept 7 days.
CREATE TABLE IF NOT EXISTS push_sent (
  endpoint_hash TEXT NOT NULL,
  alert_id      TEXT NOT NULL,
  sent_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (endpoint_hash, alert_id)
);
