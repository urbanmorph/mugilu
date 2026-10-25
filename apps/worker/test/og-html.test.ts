import { test } from "node:test";
import assert from "node:assert/strict";
import { conditionsOgHtml } from "../src/og-html";
import { HAZARD_TINT } from "../src/palette";
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

test("conditionsOgHtml: the headline, the hazard's tint, and the four riskiest readings with their bars", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-05-24T09:00:00Z") });
  const html = conditionsOgHtml(c, "everyone");
  assert.match(html, />Severe heat</);
  assert.match(
    html,
    /radial-gradient\(circle at 100% 0%, rgba\(249,115,22,0\.37\)/,
    `the heat hue ${HAZARD_TINT.Heat}`,
  );
  const labels = [...html.matchAll(/data-k="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["heat", "air", "sun", "wind"]);
  assert.match(html, /The high today is 45°C\. That is 5°C above normal for late May\./);
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

test("conditionsOgHtml: the headline reading's label takes the read's severity colour, not always red", () => {
  const moderate = {
    ...c,
    heat: { ...c.heat!, apparent_c: 30, wet_bulb_c: 20 },
    uv: { index: 2, source: "om" },
  } as Conditions;
  const html = conditionsOgHtml(moderate, "everyone");
  assert.match(html, /data-k="air"[^>]*><div style="[^"]*color:#ca8a04;">AIR</);
  assert.doesNotMatch(html, /#f87171/);
});
