import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeWarnings,
  airCounts,
  airDots,
  MAP_KEY,
  mapCells,
  mapWarnings,
  writeMap,
  type IndiaMap,
} from "../src/indiamap";
import { indiaMap } from "../src/ui/map";
import { renderPlaces } from "../src/pages/places";
import { renderHome } from "../src/pages/home";
import { storeWarnArea, type WarnArea } from "../src/warnareas";
import type { WarningsSnapshot } from "../src/sachet";
import { pt, st } from "./helpers/map-fixtures";
import { FIXTURE_NOW, testWorker } from "./helpers/worker";
import worker from "../src/index";

const NOW = Date.parse("2026-11-19T06:00:00Z");
const area = (identifier: string, severity: string, rings: WarnArea["rings"], expires = "2026-11-19T18:00:00+05:30") =>
  ({
    identifier,
    event: "Heavy Rain",
    severity,
    expires,
    issuer: "controlroom@ndma.gov.in (IMD Amaravati)",
    headline: "Heavy rain",
    areaDesc: "x",
    rings,
  }) as WarnArea;
const box = (lon: number, lat: number, d = 0.4): WarnArea["rings"][number] => [
  [lon - d, lat - d],
  [lon + d, lat - d],
  [lon + d, lat + d],
  [lon - d, lat + d],
];
// Around Visakhapatnam (17.69, 83.22) and Churu (28.3, 74.95).
const VIZAG = area("11", "Extreme", [box(83.22, 17.69)]);
const CHURU = area("12", "Minor", [box(74.95, 28.3)]);
const EXPIRED = area("13", "Severe", [box(77.2, 28.6)], "2026-11-19T09:00:00+05:30");

const GRID = [
  pt("Churu", 28.3, 74.95, { apparent_c: 46, wet_bulb_c: 24, rain_24h_mm: 0 }, "Rajasthan"),
  pt("Visakhapatnam", 17.69, 83.22, { apparent_c: 28, rain_24h_mm: 90 }, "Andhra Pradesh"),
];
const STATIONS = [st("anand-vihar", 28.65, 77.31, "vpoor", 350)];
const base: IndiaMap = {
  cells: mapCells(GRID, STATIONS, []),
  dots: airDots(STATIONS),
  cyclones: [],
  gridAsOf: "2026-11-19T04:07:00Z",
  airAsOf: "2026-11-19T05:05:00Z",
  airCounts: airCounts(STATIONS),
};
const withWarnings = (areas: WarnArea[]): IndiaMap => ({
  ...base,
  warnings: mapWarnings(areas),
  warningsAsOf: "2026-11-19T05:55:00Z",
});

test("mapWarnings: compact, projected paths, the higher level drawn last", () => {
  const ws = mapWarnings([VIZAG, CHURU]);
  assert.deepEqual(
    ws.map((w) => [w.id, w.level]),
    [
      ["12", 0],
      ["11", 3],
    ],
  );
  assert.match(ws[0].d, /^M[\d.]+ [\d.]+l[-\d. ]+z$/, "a relative SVG path in the map's pixels");
  assert.deepEqual(Object.keys(ws[0]).sort(), ["d", "expires", "id", "level"]);
});

test("activeWarnings: only those still in force at render time", () => {
  const m = withWarnings([VIZAG, EXPIRED]);
  assert.deepEqual(
    activeWarnings(m, NOW).map((w) => w.id),
    ["11"],
  );
  assert.deepEqual(activeWarnings(base, NOW), []);
});

test("writeMap: the composed map carries the areas in force, and stays small", async () => {
  const { env } = testWorker();
  await storeWarnArea(env, VIZAG);
  await storeWarnArea(env, { ...EXPIRED, expires: new Date(FIXTURE_NOW - 3_600_000).toISOString() });
  await writeMap(env, FIXTURE_NOW);
  const stored = JSON.parse(await (await env.OAQ_R2.get(MAP_KEY))!.text()) as IndiaMap;
  assert.deepEqual(
    stored.warnings!.map((w) => w.id),
    ["11"],
  );
  assert.ok(stored.warningsAsOf, "the warnings snapshot's time");
  assert.ok(JSON.stringify(stored.warnings).length < 200);
});

test("indiaMap: with a warning in force the map opens on Warnings, first in the switch", () => {
  const html = indiaMap(withWarnings([CHURU, VIZAG]), "en", { now: NOW });
  assert.match(html, /<div class="imap" data-layer="o">/, "the layer shown without script");
  assert.match(html, /<label><input type="radio" name="layer" value="o" checked>Warnings<\/label>/);
  assert.doesNotMatch(html, /value="w" checked/);
  assert.ok(html.indexOf('value="o"') < html.indexOf('value="w"'));
  // Filled by level: Minor is Low, Extreme is Severe; the severe area drawn last (on top).
  const layer = html.match(/<g class="L Lo mwarn">(.*?)<\/g>/)![1];
  assert.match(layer, /^<path class="f-low" d="M[^"]+"\/><path class="f-severe" d="M[^"]+"\/>$/);
  // The legend: level words and shapes, never colour alone.
  const legend = html.match(/<p class="mlg L Lo">(.*?)<\/p>/)![1];
  for (const w of ["Low", "Moderate", "High", "Severe"]) assert.match(legend, new RegExp(`</svg>${w}</span>`));
  assert.match(legend, /<path d="M8 1h8l7 7v8l-7 7H8l-7-7V8z/, "Severe's octagon");
  // Its stamp, summary and the way to all warnings.
  assert.match(html, /<span class="stamp" data-layers="o"><span class="k">Official warnings<\/span>/);
  assert.match(html, /<span class="stamp off" data-layers="whr"><span class="k">Squares, heat and rain/);
  assert.match(html, /<b>2 official warnings are in force\.<\/b>/);
  assert.match(html, /<p class="back"><a href="\/warnings">Active warnings →<\/a><\/p>/);
  assert.doesNotMatch(html, /Official warnings are not on this map/);
  assert.match(html, /data-label-o="Map of India\. Each coloured area is under an official warning now\."/);
});

test("indiaMap: one warning reads in the singular", () => {
  assert.match(indiaMap(withWarnings([VIZAG]), "en", { now: NOW }), /<b>1 official warning is in force\.<\/b>/);
});

test("indiaMap: with none in force the map opens on What's worst, as before, with no Warnings layer", () => {
  const html = indiaMap(withWarnings([EXPIRED]), "en", { now: NOW });
  assert.match(html, /<div class="imap" data-layer="w">/);
  assert.match(html, /value="w" checked/);
  assert.doesNotMatch(html, /value="o"|class="L Lo/);
  assert.match(html, /No official warnings are on the map now\./);
  assert.match(html, /<p class="back"><a href="\/warnings">Active warnings →<\/a><\/p>/);
});

test("indiaMap: in Hindi and Kannada the Warnings layer has no English", () => {
  for (const lang of ["hi", "kn"] as const) {
    const html = indiaMap(withWarnings([VIZAG, CHURU]), lang, { now: NOW });
    assert.doesNotMatch(html, /official warning|in force|Warnings<|coloured area/i, lang);
  }
});

test("MAP_JS: a click on a warned area opens the warnings", () => {
  const html = renderHome(undefined, undefined, { map: withWarnings([VIZAG]) });
  assert.match(html, /closest\('\.mwarn'\)\)\{location\.href=LP\+'\/warnings'/);
  assert.match(html, /data-layers/);
});

// ── /places: every place inside an area in force is marked ──────────────────────────
test("renderPlaces: places inside any warning area in force are marked, not only a cyclone's", () => {
  const html = renderPlaces("en", { map: withWarnings([VIZAG, CHURU, EXPIRED]), now: NOW });
  assert.match(html, /<span>Under an official warning now<\/span><\/h2>/);
  assert.match(html, /<b>2 official warnings are in force\.<\/b>/);
  assert.match(html, /<a class="ptile warn" href="\/c\/visakhapatnam">/);
  assert.match(html, /<a class="ptile warn" href="\/c\/churu">/);
  assert.doesNotMatch(html, /<a class="ptile warn" href="\/c\/new-delhi">/, "an expired area marks nothing");
  assert.match(html, /<li><a href="\/c\/churu">[^]*?<b>Churu<\/b><\/a><\/li>/);
});

test("renderPlaces: the cyclone's name-match stays only for an alert with no area", () => {
  const cyclone: WarningsSnapshot = {
    generated_at: "2026-11-18T12:05:00Z",
    count: 1,
    alerts: [
      {
        identifier: "11",
        headline: "SEVERE CYCLONIC STORM AKVAN lays centred, Cyclone Warning for Anakapalli.",
        category: "Met",
        issuer: "controlroom@ndma.gov.in (IMD Visakhapatnam)",
        link: "https://sachet.ndma.gov.in/x?identifier=11",
        sent: "Wed, 18 Nov 2026 11:17:00 GMT",
      },
    ],
  };
  // The cyclone's alert has an area (id 11, around Visakhapatnam): its headline's names are not used.
  const mapped = renderPlaces("en", { map: withWarnings([VIZAG]), warnings: cyclone, now: NOW });
  assert.match(mapped, /<a class="ptile warn" href="\/c\/visakhapatnam">/);
  assert.doesNotMatch(mapped, /<a class="ptile warn" href="\/c\/anakapalli">/);
  // Without an area for it, the names are the fallback.
  const named = renderPlaces("en", { map: base, warnings: cyclone, now: NOW });
  assert.match(named, /<a class="ptile warn" href="\/c\/anakapalli">/);
  assert.match(named, /<b>Severe Cyclonic Storm Akvan<\/b>/);
});

test("the hourly cron: SACHET failing never stops the map, which carries the areas already stored", async () => {
  const { env } = testWorker(); // upstream unrecorded: SACHET, the broker and the rest answer 503
  await storeWarnArea(env, VIZAG);
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException() {} };
  const event = { cron: "5 * * * *", scheduledTime: FIXTURE_NOW } as ScheduledEvent;
  await worker.scheduled(event, env, ctx as unknown as ExecutionContext);
  await Promise.all(waits);
  const stored = JSON.parse(await (await env.OAQ_R2.get(MAP_KEY))!.text()) as IndiaMap;
  assert.deepEqual(
    stored.warnings!.map((w) => w.id),
    ["11"],
  );
});

test("indiaMap: the layer switch fits a phone, one row where it can and even rows where it cannot", () => {
  // Five layers did not fit 322px at 390 wide and left "Rain" alone on a ragged second row.
  assert.match(
    indiaMap(withWarnings([CHURU]), "en", { now: NOW }),
    /<div class="seg fit"><label><input type="radio" name="layer"/,
  );
});
