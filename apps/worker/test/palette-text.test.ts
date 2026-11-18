import { test } from "node:test";
import assert from "node:assert/strict";
import { BAND_TEXT, HAZARD_TINT, NEUTRAL, RISK_TEXT, WASH_STRENGTH } from "../src/palette";
import type { RiskBand } from "../src/score";
import { contrast, mix } from "./helpers/contrast";
import { renderConditionsPage, renderEmbed, renderKioskPage, renderStationPage } from "../src/page";
import type { Conditions, NormalizedStation } from "../src/types";

// One canonical set of text colours for severity and AQI bands, light and dark, every
// page reading it through CSS variables (--rt-<risk>, --bt-<band>). The band and risk
// colours themselves (fills, bars, dots) are too pale for text on a light page.

const LEVEL: Record<string, RiskBand> = {
  good: "low",
  satisfactory: "low",
  moderate: "moderate",
  poor: "high",
  vpoor: "severe",
  severe: "severe",
  unknown: "low",
};

test("every text colour holds 4.5:1 on its theme's page and panel, under any hazard's wash at its level", () => {
  const check = (name: string, pair: [string, string], level: RiskBand) => {
    (["light", "dark"] as const).forEach((m, i) => {
      for (const g of [NEUTRAL[m].bg, NEUTRAL[m].soft]) {
        const grounds = [g, ...Object.values(HAZARD_TINT).map((h) => mix(h, g, WASH_STRENGTH[m][level] / 100))];
        const worst = Math.min(...grounds.map((b) => contrast(pair[i], b)));
        assert.ok(worst >= 4.5, `${name} ${m} ${pair[i]}: ${worst.toFixed(2)}:1`);
      }
    });
  };
  for (const [k, pair] of Object.entries(RISK_TEXT)) check(`risk ${k}`, pair, k as RiskBand);
  for (const [k, pair] of Object.entries(BAND_TEXT)) check(`band ${k}`, pair, LEVEL[k]);
});

const C = {
  location: { lat: 28.61, lon: 77.21 },
  place: "Delhi",
  as_of: "2026-11-18T11:05:00.000Z",
  air: {
    aqi: 344,
    band: "vpoor",
    pollutants: { pm25: 172 },
    station: { id: "cpcb-1", name: "ITO", city: "Delhi", distance_km: 2 },
    source: "cpcb",
  },
  heat: null,
  rain: null,
  uv: null,
  dust: null,
  wind: null,
  visibility: null,
  smoke: null,
  attribution: "Sources: CPCB via OAQ",
  disclaimer: "Informational only.",
} as unknown as Conditions;

test("every page colours severity and band TEXT from the canonical variables, never a raw band colour", () => {
  const pages = {
    place: renderConditionsPage(C),
    embed: renderEmbed(C, "everyone", "https://mugilu.live"),
    kiosk: renderKioskPage(C, "everyone", "https://mugilu.live/c/delhi"),
    station: renderStationPage(
      {
        id: "cpcb-1",
        raw_id: "1",
        provider: "cpcb",
        name: "ITO",
        city: "Delhi",
        state: "",
        lat: 28.63,
        lon: 77.24,
        pollutants: { pm25: 172 },
        aqi: 344,
        band: "vpoor",
        ts: "2026-11-18T13:45:00+05:30",
      } as NormalizedStation,
      [],
      true,
    ),
  };
  // Severity and band are classes on components (the tokens' --lv/--on), never a colour in the markup.
  assert.match(pages.place, /<section class="plate severe stack"/);
  assert.match(pages.place, /<span class="chip b-vpoor">[\s\S]*?Very Poor<\/span>/);
  assert.match(pages.embed, /<a class="ecard severe"/);
  assert.match(pages.station, /<section class="plate inline b-vpoor"/);
  assert.match(pages.kiosk, /<html lang="en" data-theme="dark">/); // the kiosk is always dark
  for (const [name, html] of Object.entries(pages)) {
    assert.doesNotMatch(html, /style="[^"]*color:/i, `${name}: a colour in the markup`);
    assert.match(html, /\.mg \.b-vpoor\{--lv:var\(--b-vpoor\);--on:var\(--on-b-vpoor\)\}/, `${name}: the tokens`);
  }
});
