import { test } from "node:test";
import assert from "node:assert/strict";
import { briefs } from "../src/readings";
import { ambientRisk } from "../src/score";
import { HAZARD_TINT, TINT_STRENGTH, tintOf } from "../src/palette";
import type { Conditions } from "../src/types";

const base = {
  location: { lat: 28.61, lon: 77.21 },
  as_of: "2026-05-24T08:45:00.000Z",
  attribution: "",
  disclaimer: "",
} as const;
const hot = {
  ...base,
  air: { aqi: 140, band: "moderate", pollutants: { pm25: 50 }, station: null, source: "cpcb" },
  heat: { temp_c: 45, humidity_pct: 20, apparent_c: 48, wet_bulb_c: 26, wbgt_c: 34, source: "om" },
  uv: { index: 9, source: "om" },
  dust: { dust_ug_m3: 60, source: "om" },
  rain: { probability_pct: 0, precipitation_mm: 0, source: "om" },
  wind: { speed_kmh: 14, gust_kmh: 30, direction_deg: 290, source: "om" },
} as unknown as Conditions;
const calm = {
  ...base,
  air: { aqi: 30, band: "good", pollutants: { pm25: 12 }, station: null, source: "cpcb" },
  heat: { temp_c: 24, humidity_pct: 60, apparent_c: 24, wet_bulb_c: 19, source: "om" },
  uv: { index: 4, source: "om" },
  rain: { probability_pct: 20, precipitation_mm: 0, source: "om" },
} as unknown as Conditions;

test("briefs: every reading in the page's order (the headline first, then by risk), with a short value", () => {
  const b = briefs(hot, ambientRisk(hot));
  assert.deepEqual(
    b.map((x) => x.key),
    ["heat", "air", "sun", "rain", "wind", "dust"],
  );
  assert.deepEqual(
    b.map((x) => x.value),
    ["48°", "AQI 140", "UV 9", "0%", "30 km/h", "60 µg/m³"],
  );
  assert.equal(b[0].level, 3);
});

test("briefs: each carries a gauge against the thresholds the read uses", () => {
  const heat = briefs(hot, ambientRisk(hot))[0];
  assert.deepEqual(heat.gauge, { v: 48, lo: 20, hi: 50, ticks: [35, 40, 45] });
  const air = briefs(hot, ambientRisk(hot)).find((x) => x.key === "air")!;
  assert.deepEqual(air.gauge.ticks, [100, 200, 300]);
});

test("tintOf: the hue names the hazard, the strength its band; a calm read is clear-sky blue", () => {
  assert.deepEqual(tintOf(ambientRisk(hot)), { hue: HAZARD_TINT.Heat, strength: TINT_STRENGTH.severe });
  assert.deepEqual(tintOf(ambientRisk(calm)), { hue: HAZARD_TINT.none, strength: TINT_STRENGTH.low });
  for (const h of ["Air", "Heat", "Cold", "UV", "Dust", "Wind", "Fog", "Smoke", "Warning"])
    assert.ok(HAZARD_TINT[h], h);
});

test("headline: band word and hazard noun, or All clear; translated piece by piece", async () => {
  const { headline } = await import("../src/score");
  assert.deepEqual(headline({ band: "severe", driver: "Heat" }), { word: "Severe", noun: "heat" });
  assert.deepEqual(headline({ band: "low", driver: "Air" }), { word: "All clear", noun: null });
  assert.deepEqual(
    headline({ band: "high", driver: "UV" }, (s) => s.toUpperCase()),
    { word: "HIGH", noun: "SUN" },
  );
});

test("placeLabel: the place, else the station's city, else the coordinate (an empty name falls through)", async () => {
  const { placeLabel } = await import("../src/readings");
  const at = { location: { lat: 12.97, lon: 77.59 } };
  assert.equal(placeLabel({ ...at, place: "Bengaluru" } as Conditions), "Bengaluru");
  assert.equal(
    placeLabel({ ...at, place: "", air: { station: { city: "Mysuru" } } } as unknown as Conditions),
    "Mysuru",
  );
  assert.equal(placeLabel(at as Conditions), "12.97,77.59");
});

test("istStamp: one IST format for images and Markdown; a missing time is empty, not an error", async () => {
  const { istStamp } = await import("../src/html");
  assert.equal(istStamp("2026-10-25T07:00:00Z"), "25 Oct, 12:30 IST");
  assert.equal(istStamp("2026-10-25T07:00:00Z", true), "25 Oct 2026, 12:30 IST");
  assert.equal(istStamp(""), "");
});
