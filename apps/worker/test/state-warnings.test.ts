import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWarningsPage } from "../src/pages/warnings";
import { alertPlaces } from "../src/pages/places";
import { mapWarnings, type IndiaMap } from "../src/indiamap";
import { stateBySlug } from "../src/states";
import { placeLastmods } from "../src/lastmod";
import { sitemapPaths } from "../src/meta";
import type { WarningsSnapshot } from "../src/sachet";
import type { WarnArea } from "../src/warnareas";

// /state/{slug}/warnings: a state's official warnings now, for "[state] red alert" and
// "orange alert [district] today" (supporting-docs/reports/mugilu search discovery plan.md).
// The /warnings page, scoped: the alerts whose area covers a place in the state, or that the
// state's own office issued.

const alert = (id: string, headline: string, office: string) => ({
  identifier: id,
  headline,
  category: "Met",
  issuer: `controlroom@ndma.gov.in (${office})`,
  link: "",
  sent: "2026-11-22T06:38:12+05:30",
});
const SNAP = {
  generated_at: "2026-11-22T03:15:00.000Z",
  count: 3,
  alerts: [
    alert("1", "Thunderstorm with lightning likely over Almora.", "IMD Dehradun"),
    alert("2", "Light to moderate thunderstorm and lightning over Bengaluru.", "IMD Bengaluru"),
    alert("3", "Heavy rain likely over Udupi.", "Karnataka SDMA"),
  ],
} as unknown as WarningsSnapshot;
const square = (id: string, lon: number, lat: number, d: number): WarnArea => ({
  identifier: id,
  event: "Thunderstorm",
  severity: "Moderate",
  expires: "2026-11-22T12:00:00+05:30",
  issuer: "IMD",
  headline: "",
  areaDesc: "",
  rings: [
    [
      [lon - d, lat - d],
      [lon + d, lat - d],
      [lon + d, lat + d],
      [lon - d, lat + d],
      [lon - d, lat - d],
    ],
  ],
});
const MAP = {
  warnings: mapWarnings([square("1", 79.504, 29.6908, 0.08), square("2", 77.59, 12.97, 0.15)]),
} as IndiaMap;
const NOW = Date.parse("2026-11-22T09:00:00+05:30");
const KA = stateBySlug("karnataka")!;
const UK = stateBySlug("uttarakhand")!;
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");

test("alertPlaces: each alert with an area names the places inside it", () => {
  const by = alertPlaces(MAP, SNAP, NOW);
  assert.ok(by.get("2")?.includes("bengaluru"));
  assert.ok(by.get("1")?.includes("almora"));
  assert.equal(by.get("3"), undefined, "no area");
});

test("state warnings: only the state's alerts, by area or by its own office; searched title and heading", () => {
  const html = renderWarningsPage(SNAP, "en", MAP, NOW, KA);
  const s = text(html);
  assert.equal(
    html.match(/<title>([^<]*)<\/title>/)![1],
    "Karnataka weather warnings today: IMD and state alerts | mugilu",
  );
  assert.match(html, /<h1 class="t-title">Official weather warnings in Karnataka now<\/h1>/);
  assert.match(s, /over Bengaluru/);
  assert.match(s, /over Udupi/, "issued by the state's own office");
  assert.doesNotMatch(s, /Almora/);
  assert.match(s, /2 official NDMA \/ IMD alerts for Karnataka now\./);
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/state\/karnataka\/warnings">/);
  assert.match(html, /href="\/state\/karnataka"/, "links back to the state's hub");
});

test("state warnings: none now still says so, with the colours and a link to all of India", () => {
  const s = text(renderWarningsPage({ ...SNAP, alerts: [SNAP.alerts[0]] }, "en", MAP, NOW, KA));
  assert.match(s, /No official warning covers a place in Karnataka now\./);
  assert.match(s, /what they mean/);
  const kn = text(renderWarningsPage(SNAP, "kn", MAP, NOW, KA));
  assert.doesNotMatch(kn, /Official weather warnings in|alerts for Karnataka/);
  assert.match(renderWarningsPage(SNAP, "hi", MAP, NOW, UK), /<h1 class="t-title">[^<]*उत्तराखंड/);
});

test("/warnings links each state to its warnings page; the sitemap lists them, dated by their places", () => {
  assert.match(renderWarningsPage(SNAP, "en", MAP, NOW), /href="\/state\/karnataka\/warnings"/);
  assert.ok(sitemapPaths().includes("/state/karnataka/warnings"));
  const dates = placeLastmods(
    {
      udupi: { s: "good|warned", d: "2026-12-02", w: "2026-12-02" },
      bengaluru: { s: "poor", d: "2026-11-30", w: "2026-11-20" },
    },
    {},
  );
  assert.equal(dates["/state/karnataka/warnings"], "2026-12-02");
});
