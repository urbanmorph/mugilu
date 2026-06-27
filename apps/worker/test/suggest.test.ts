import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAlias, parseCoordQuery, matchStations, buildSuggestions } from "../src/suggest";
import type { NormalizedStation } from "../src/types";
import type { GeoResult } from "../src/geocode";

function station(name: string, city: string, lat: number, lon: number): NormalizedStation {
  return {
    id: name, raw_id: name, provider: "cpcb", name, city, state: "",
    lat, lon, pollutants: {}, aqi: null, band: "unknown", ts: null,
  };
}

const STATIONS = [
  station("Anand Vihar", "Delhi", 28.65, 77.31),
  station("BTM Layout", "Bengaluru", 12.91, 77.61),
  station("Silk Board", "Bengaluru", 12.92, 77.62),
];

test("applyAlias: rewrites known old/colloquial city names", () => {
  assert.equal(applyAlias("Bangalore"), "Bengaluru");
  assert.equal(applyAlias("bombay"), "Mumbai");
  assert.equal(applyAlias("Indiranagar"), "Indiranagar"); // unknown → unchanged
});

test("parseCoordQuery: detects a lat,lon pair", () => {
  assert.deepEqual(parseCoordQuery("12.97,77.59"), { lat: 12.97, lon: 77.59 });
  assert.deepEqual(parseCoordQuery("12.97, 77.59"), { lat: 12.97, lon: 77.59 });
  assert.equal(parseCoordQuery("Bengaluru"), null);
  assert.equal(parseCoordQuery("999,0"), null);
});

test("matchStations: gazetteer prefix + substring, capped, ignores <2 chars", () => {
  assert.equal(matchStations(STATIONS, "anand", 5)[0].label, "Anand Vihar");
  assert.ok(matchStations(STATIONS, "bengaluru", 5).length >= 2); // city match
  assert.equal(matchStations(STATIONS, "layout", 5)[0].label, "BTM Layout"); // substring
  assert.equal(matchStations(STATIONS, "a", 5).length, 0); // <2 chars
  assert.ok(matchStations(STATIONS, "board", 1).length <= 1); // cap
});

test("buildSuggestions: a coord query short-circuits (no geocoding)", async () => {
  const geo = async (): Promise<GeoResult[]> => {
    throw new Error("should not geocode a coordinate query");
  };
  const out = await buildSuggestions(STATIONS, "12.97,77.59", geo);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "coord");
  assert.deepEqual([out[0].lat, out[0].lon], [12.97, 77.59]);
});

test("buildSuggestions: a gazetteer hit short-circuits without geocoding (perf)", async () => {
  let geocoded = false;
  const geo = async (): Promise<GeoResult[]> => {
    geocoded = true;
    return [];
  };
  const out = await buildSuggestions(STATIONS, "bengaluru", geo);
  assert.equal(geocoded, false, "no network call when the gazetteer matches");
  assert.ok(out.length >= 1 && out.every((s) => s.kind === "station"));
});

test("buildSuggestions: geocodes India-ranked places only when the gazetteer is empty", async () => {
  let geocoded = false;
  const geo = async (): Promise<GeoResult[]> => {
    geocoded = true;
    return [
      { name: "Springfield", country_code: "US", lat: 1, lon: 1 },
      { name: "Erode", admin1: "Tamil Nadu", country_code: "IN", lat: 11.34, lon: 77.72 },
    ];
  };
  const out = await buildSuggestions(STATIONS, "Erode", geo, 6);
  assert.ok(geocoded, "geocoded because no station matched");
  assert.ok(out.every((s) => s.kind === "place"));
  assert.equal(out[0].label, "Erode", "IN place ranked first");
});

test("buildSuggestions: applies the alias to the gazetteer search", async () => {
  const geo = async (): Promise<GeoResult[]> => {
    throw new Error("should not geocode — alias resolves to stations");
  };
  const out = await buildSuggestions(STATIONS, "Bangalore", geo);
  assert.ok(out.length >= 1 && out.every((s) => s.kind === "station"));
  assert.ok(out.some((s) => s.sublabel === "Bengaluru"));
});
