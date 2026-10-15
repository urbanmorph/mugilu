import { test } from "node:test";
import assert from "node:assert/strict";
import { freshStations, STALE_AFTER_MS } from "../src/snapshot";
import type { NormalizedStation } from "../src/types";

const st = (id: string, ts: string | null): NormalizedStation => ({
  id,
  raw_id: id,
  provider: "cpcb",
  name: id,
  city: "",
  state: "",
  lat: 12.9,
  lon: 77.6,
  pollutants: { pm25: 40 },
  aqi: 67,
  band: "satisfactory",
  ts,
  yll: null,
});

test("freshStations: drops readings older than the cutoff, or with no time, from answering for now", () => {
  const now = Date.parse("2026-10-15T05:00:00Z");
  const kept = freshStations(
    [
      st("fresh", "2026-10-15T09:45:00+05:30"), // 45 min old, IST offset
      st("edge", new Date(now - STALE_AFTER_MS + 60_000).toISOString()),
      st("old", "2026-10-15T06:00:00+05:30"), // 5h old
      st("jan", "2026-01-13T10:00:00+05:30"),
      st("none", null),
      st("garbage", "not a date"),
    ],
    now,
  ).map((s) => s.id);
  assert.deepEqual(kept, ["fresh", "edge"]);
});

test("freshStations: a reading stamped slightly in the future (clock skew) still counts", () => {
  const now = Date.parse("2026-10-15T05:00:00Z");
  assert.equal(freshStations([st("skew", "2026-10-15T05:05:00Z")], now).length, 1);
});
