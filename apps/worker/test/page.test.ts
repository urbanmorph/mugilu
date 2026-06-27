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

test("renderConditionsPage: shows the air, heat and disclaimer", () => {
  const html = renderConditionsPage(conditions());
  assert.match(html, /AQI 57/);
  assert.match(html, /Feels 24/);
  assert.match(html, /not for medical/);
});

test("renderConditionsPage: NO jargon on the visible page", () => {
  const html = renderConditionsPage(conditions());
  assert.doesNotMatch(html, /wet.?bulb/i);
  assert.doesNotMatch(html, /µg\/m³|PM2\.5|aerosol|aod/i);
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
