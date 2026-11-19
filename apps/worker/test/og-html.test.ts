import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionsOgHtml, homeOgHtml, stationOgHtml } from "../src/og-html";
import { RISK_COLOR, BAND_COLOR } from "../src/palette";
import type { NormalizedStation } from "../src/types";
import type { Conditions } from "../src/types";

const c = {
  location: { lat: 28.61, lon: 77.21 },
  place: "New Delhi",
  as_of: "2026-05-24T08:45:00.000Z",
  air: { aqi: 140, band: "moderate", pollutants: { pm25: 50 }, station: null, source: "cpcb" },
  heat: { temp_c: 45, humidity_pct: 20, apparent_c: 48, wet_bulb_c: 26, source: "om" },
  uv: { index: 9, source: "om" },
  dust: { dust_ug_m3: 60, source: "om" },
  wind: { speed_kmh: 14, gust_kmh: 30, direction_deg: 290, source: "om" },
  heat_vs_normal: {
    today_max_c: 45,
    normal_max_c: 40,
    anomaly_c: 5,
    notable: true,
    date: "2026-05-24",
    period: "late May",
    baseline: "1991-2020 normals",
    source: "era5",
  },
  attribution: "",
  disclaimer: "",
} as unknown as Conditions;

test("conditionsOgHtml: the headline on its level's plate, and the four riskiest readings with their bars", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-24T09:00:00Z") });
  const html = conditionsOgHtml(c, "everyone");
  assert.match(html, />SEVERE HEAT\.</);
  assert.match(html, new RegExp(`background:${RISK_COLOR.severe};color:#ffffff;`), "the severe fill, white text on it");
  const labels = [...html.matchAll(/data-k="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["heat", "air", "sun", "wind"]);
  assert.match(html, /The high today is 45°C\. That is 5°C above normal for late May\./);
  assert.match(html, /Informational only, not for medical, emergency, or safety-critical decisions\./);
});

test("conditionsOgHtml: every div with more than one child is a flex box (the image renderer requires it)", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-24T09:00:00Z") });
  for (const m of conditionsOgHtml(c, "asthma").matchAll(/<div style="([^"]*)">/g)) {
    assert.match(m[1], /display:flex/, m[1]);
  }
});

test("conditionsOgHtml: the card is sized in pixels (the renderer resolves a % width against nothing, and the card shrinks)", () => {
  const html = conditionsOgHtml(c, "everyone");
  assert.match(html, /^<div style="display:flex;flex-direction:column;width:1200px;height:630px;/);
});

test("conditionsOgHtml: each reading's bar is in its own level (air in its CPCB band)", () => {
  const moderate = {
    ...c,
    heat: { ...c.heat!, apparent_c: 30, wet_bulb_c: 20 },
    uv: { index: 2, source: "om" },
  } as Conditions;
  const html = conditionsOgHtml(moderate, "everyone");
  assert.match(html, new RegExp(`data-k="air"[\\s\\S]*?background:${BAND_COLOR.moderate};`));
});

test("stationOgHtml and homeOgHtml: the same frame, the station on its band's plate", () => {
  const s = { name: "ITO", city: "Delhi", provider: "cpcb", aqi: 344, band: "vpoor" } as unknown as NormalizedStation;
  const st = stationOgHtml(s, "2026-11-18T14:15:00.000Z");
  assert.match(st, new RegExp(`background:${BAND_COLOR.vpoor};color:#ffffff;`));
  assert.match(st, />AQI \(Very Poor\)</);
  assert.match(st, /Informational only, not for medical/);
  for (const html of [st, homeOgHtml()])
    for (const m of html.matchAll(/<div style="([^"]*)">/g)) assert.match(m[1], /display:flex/, m[1]);
});

test("conditionsOgHtml: text is written as is, never as HTML entities (the renderer would show '&amp;')", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-24T09:00:00Z") });
  const air = {
    ...c,
    heat: { ...c.heat!, apparent_c: 30, wet_bulb_c: 20 },
    uv: { index: 2, source: "om" },
  } as Conditions;
  const html = conditionsOgHtml(air, "asthma");
  assert.match(html, /For asthma & lungs, treat it as high\./);
  assert.doesNotMatch(html, /&amp;|&lt;|&gt;/);
});

test("share images: the level shape as an image (Satori draws no inline <svg> from HTML), set in Anek Latin", () => {
  for (const html of [conditionsOgHtml(c, "everyone"), homeOgHtml()]) {
    assert.doesNotMatch(html, /<svg/);
    assert.match(html, /font-family:'Anek Latin'/);
  }
  assert.match(conditionsOgHtml(c, "everyone"), /<img width="96" height="96" src="data:image\/svg\+xml;base64,/);
});
