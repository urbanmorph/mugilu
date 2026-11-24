import { test } from "node:test";
import assert from "node:assert/strict";
import { fireRiskAt, type FireDetection } from "../src/firms";
import { ambientRisk, firesInCleanAir, PERSONAS } from "../src/score";
import { renderConditionsMarkdown, serializeConditionsV1 } from "../src/conditions";
import { renderConditionsPage } from "../src/pages/place";
import type { Conditions } from "../src/types";

// W21 (supporting-docs/reports/Fire smoke and life years.md; supporting-docs/analysis/smoke_backtest):
// no health agency rates smoke from fire counts in a radius, and in mugilu's own archive fire counts
// and fire power near a place do not track ground PM2.5. Fires are context everywhere, never a level;
// the air reading carries any smoke that arrives. Low-confidence and sub-1 MW detections are not counted.

const fire = (km: number, frp: number, confidence = "n"): FireDetection =>
  ({
    lat: 12.97 + km / 111,
    lon: 77.59,
    frp,
    confidence,
    acq_date: "2026-11-24",
    acq_time: "0830",
    daynight: "D",
  }) as FireDetection;

function place(band: string | null, smoke: Conditions["smoke"]): Conditions {
  return {
    location: { lat: 12.97, lon: 77.59 },
    as_of: "2026-11-24T14:05:00.000Z",
    air: band
      ? ({
          aqi: 40,
          band,
          pollutants: { pm25: 9 },
          station: { id: "cpcb-1", name: "S", city: "Bengaluru", distance_km: 3 },
          source: "cpcb",
        } as unknown as Conditions["air"])
      : null,
    heat: { temp_c: 22, humidity_pct: 80, apparent_c: 24, wet_bulb_c: 20, source: "open-meteo" },
    rain: { precipitation_mm: 0, source: "open-meteo" },
    uv: { index: 0, source: "open-meteo" },
    smoke,
    attribution: "x",
    disclaimer: "Informational only.",
  } as unknown as Conditions;
}
// Bengaluru, 24 Nov: 3 small fires, 2 MW in all, the nearest 28.5 km away.
const SMALL = { count: 3, frp_sum: 2, nearest_km: 28.5, radius_km: 100, source: "firms" } as Conditions["smoke"];
// Delhi, 24 Nov: 35 fires, 131 MW, the nearest 14 km away.
const BIG = { count: 35, frp_sum: 130.7, nearest_km: 14.2, radius_km: 100, source: "firms" } as Conditions["smoke"];

test("fireRiskAt: low-confidence and sub-1 MW detections are not counted", () => {
  const r = fireRiskAt([fire(30, 0.7), fire(40, 5, "l"), fire(50, 3, "h"), fire(60, 1, "n")], 12.97, 77.59);
  assert.equal(r.count, 2, "the 0.7 MW and the low-confidence detections are dropped");
  assert.equal(r.frp_sum, 4);
  assert.ok(Math.abs(r.nearest_km! - 50) < 0.5, "the nearest counted is the 3 MW fire at 50 km");
});

test("firesInCleanAir: fires seen while the air here is good or satisfactory", () => {
  for (const band of ["good", "satisfactory"]) assert.equal(firesInCleanAir(place(band, SMALL)), true, band);
  assert.equal(firesInCleanAir(place("moderate", BIG)), false);
  assert.equal(firesInCleanAir(place("good", { ...SMALL!, count: 0 })), false, "no fires, nothing to say");
});

test("ambient: fires never lead or score, in clean or polluted air, for any persona", () => {
  for (const p of ["everyone", ...PERSONAS] as const)
    for (const [band, smoke] of [
      ["good", SMALL],
      ["moderate", BIG],
      ["poor", BIG],
    ] as const) {
      const r = ambientRisk(place(band, smoke), p);
      assert.notEqual(r.driver, "Smoke", `${p} ${band}`);
      assert.ok(!r.hazards.some((h) => h.hazard === "Smoke"), `${p} ${band}`);
    }
  assert.equal(ambientRisk(place("moderate", BIG)).driver, "Air", "Delhi's raised air leads, as air");
});

test("place page: with clean air the smoke card keeps the facts, with no level, and says the air is clean", () => {
  const html = renderConditionsPage(place("good", SMALL));
  const card =
    html.match(/<div class="rrow[^"]*" data-k="smoke">[\s\S]*?(?=<div class="rrow|<\/div><\/section>)/)?.[0] ?? "";
  assert.ok(card, "the card stays");
  assert.doesNotMatch(card, /class="chip/, "no level");
  assert.doesNotMatch(card, / lv-/, "not a raised card");
  assert.match(
    card,
    /A satellite saw 3 fires within 100 km in the last 24 hours\. The nearest is 29 km away\. The air here is good, so their smoke is not showing in it now\./,
  );
  for (const lang of ["hi", "kn"] as const) {
    const t = renderConditionsPage(place("good", SMALL), "everyone", undefined, lang);
    assert.doesNotMatch(t, /their smoke is not showing/, `${lang}: no English`);
  }
});

test("place page: in polluted air the smoke card keeps the facts, with no level and no clean-air line", () => {
  const html = renderConditionsPage(place("moderate", BIG));
  const card =
    html.match(/<div class="rrow[^"]*" data-k="smoke">[\s\S]*?(?=<div class="rrow|<\/div><\/section>)/)?.[0] ?? "";
  assert.match(card, /A satellite saw 35 fires within 100 km/);
  assert.doesNotMatch(card, /class="chip| lv-|not showing/);
});

test("API and MCP: smoke is always context; markdown keeps the fires", () => {
  assert.equal(serializeConditionsV1(place("good", SMALL), "everyone").smoke?.role, "context");
  assert.equal(serializeConditionsV1(place("moderate", BIG), "everyone").smoke?.role, "context");
  const md = renderConditionsMarkdown(place("good", SMALL));
  assert.match(md, /## Smoke[\s\S]*Active fires within 100 km: \*\*3\*\*/);
  assert.match(md, /- Not scored as a hazard: the air here is good, so the smoke is not in it now/);
});
