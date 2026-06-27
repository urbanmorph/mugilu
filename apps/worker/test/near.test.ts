import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, findNearest, parseLatLon } from "../src/near";
import type { NormalizedStation } from "../src/types";

function station(id: string, lat: number | null, lon: number | null): NormalizedStation {
  return {
    id,
    raw_id: id,
    provider: "cpcb",
    name: id,
    city: "",
    state: "",
    lat,
    lon,
    pollutants: {},
    aqi: null,
    band: "unknown",
    ts: null,
  };
}

test("haversineKm: Bengaluru → Delhi is ~1740 km", () => {
  const d = haversineKm(12.9716, 77.5946, 28.6139, 77.209);
  assert.ok(Math.abs(d - 1740) < 30, `expected ~1740 km, got ${d}`);
});

test("haversineKm: identical points are 0", () => {
  assert.equal(haversineKm(12.97, 77.59, 12.97, 77.59), 0);
});

test("findNearest: returns n nearest, sorted, skipping coordless stations", () => {
  const stations = [
    station("delhi", 28.61, 77.21), // ~1740 km
    station("near", 12.98, 77.6), // ~1 km from query
    station("mid", 13.2, 77.7), // ~30 km
    station("nocoord", null, null), // skipped — no coords
  ];
  const got = findNearest(stations, 12.9716, 77.5946, 2);
  assert.equal(got.length, 2);
  assert.equal(got[0].id, "near");
  assert.equal(got[1].id, "mid");
  assert.ok(got[0].distance_km < got[1].distance_km);
  assert.ok(got[0].distance_km < 5, `nearest should be <5km, got ${got[0].distance_km}`);
});

test("findNearest: never returns more than the requested n", () => {
  const stations = Array.from({ length: 10 }, (_, i) => station(`s${i}`, 12 + i * 0.1, 77));
  assert.equal(findNearest(stations, 12.5, 77, 3).length, 3);
});

test("parseLatLon: rejects missing or empty params (no silent 0,0)", () => {
  assert.equal(parseLatLon(null, "77"), null);
  assert.equal(parseLatLon("12", null), null);
  assert.equal(parseLatLon("", ""), null);
});

test("parseLatLon: rejects non-numeric and out-of-range", () => {
  assert.equal(parseLatLon("12", "abc"), null);
  assert.equal(parseLatLon("999", "77"), null);
  assert.equal(parseLatLon("12", "200"), null);
});

test("parseLatLon: accepts valid coords including 0,0", () => {
  assert.deepEqual(parseLatLon("12.97", "77.59"), { lat: 12.97, lon: 77.59 });
  assert.deepEqual(parseLatLon("0", "0"), { lat: 0, lon: 0 });
});
