import { test } from "node:test";
import assert from "node:assert/strict";
import { renderConditionsPage } from "../src/page";
import type { Conditions } from "../src/types";

function conditions(overrides: Partial<Conditions> = {}): Conditions {
  return {
    location: { lat: 12.97, lon: 77.59 },
    as_of: "2026-06-26T14:05:00.000Z",
    air: {
      aqi: 57,
      band: "satisfactory",
      pollutants: { pm25: 25 },
      yll: 1.96,
      station: { id: "airnet-x", name: "Kumarapark", city: "Bengaluru", distance_km: 2.29 },
      source: "airnet",
    },
    heat: { temp_c: 22, humidity_pct: 80, apparent_c: 24, wet_bulb_c: 20, source: "open-meteo" },
    rain: { precipitation_mm: 0, source: "open-meteo" },
    uv: { index: 0, source: "open-meteo" },
    dust: { dust_ug_m3: 3, aod: 0.16, source: "open-meteo" },
    attribution: "Sources: Airnet / CSTEP via OAQ · Open-Meteo (CC-BY 4.0) — via mugilu",
    disclaimer: "Informational only — not for medical, emergency, or safety-critical decisions.",
    ...overrides,
  };
}

test("renderConditionsPage: a valid HTML document with the brand and place", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /mugilu/);
  assert.match(html, /Bengaluru/);
});

test("renderConditionsPage: stamps freshness as a relative <time> (absolute fallback + upgrade script)", () => {
  const html = renderConditionsPage(conditions());
  // server renders the absolute IST time inside a data-rel <time> (the no-JS fallback)
  assert.match(html, /<time[^>]*data-rel[^>]*datetime="[^"]+"[^>]*>[^<]*IST/);
  // and the shell ships the tiny upgrade script that rewrites it to "X ago" at view-time
  assert.match(html, /time\[data-rel\]\[datetime\]/);
  assert.doesNotMatch(html, /this spot, right now/); // the bare "right now" is gone
});

test("renderConditionsPage: shows the air, heat and disclaimer", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /57/); // AQI value
  assert.match(html, /AQI/);
  assert.match(html, /24°/); // feels-like
  assert.match(html, /not for medical/);
});

test("renderConditionsPage: surfaces wet-bulb and the pollutant breakdown", () => {
  const html = renderConditionsPage(conditions());
  // wet-bulb is surfaced with a plain survivability tag
  assert.match(html, /wet.?bulb/i);
  assert.match(html, /safe|caution|severe|dangerous/i);
  // the pollutant breakdown is now shown on the air row (gases surfaced)
  assert.match(html, /PM2\.5/);
  // ...but the dust internals stay in the .json/.md siblings only
  assert.doesNotMatch(html, /aerosol|\baod\b/i);
});

test("renderConditionsPage: verdict escalates for severe air", () => {
  const c = conditions();
  const html = renderConditionsPage({ ...c, air: { ...c.air!, band: "severe", aqi: 420 } });
  assert.match(html, /care|avoid|dangerous/i);
});

test("renderConditionsPage: falls back to coords when no station/air", () => {
  const html = renderConditionsPage(conditions({ air: null }));
  assert.match(html, /12\.97/);
});
