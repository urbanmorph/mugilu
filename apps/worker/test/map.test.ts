import { test } from "node:test";
import assert from "node:assert/strict";
import { airCounts, airDots, mapCells, type IndiaMap } from "../src/indiamap";
import { indiaMap, placesMap } from "../src/ui/map";
import { officialCyclone, type WarningsSnapshot } from "../src/sachet";
import { warnedPlaces } from "../src/pages/places";
import { pt, st } from "./helpers/map-fixtures";
import type { Cyclone } from "../src/cyclones";

const GRID = [
  pt("Churu", 28.3, 74.95, { apparent_c: 46, wet_bulb_c: 24, uv: 8, dust_ug_m3: 40, rain_24h_mm: 0 }, "Rajasthan"),
  pt("Thrissur", 10.52, 76.21, { apparent_c: 36, rain_24h_mm: 0 }, "Kerala"),
  pt("New Delhi", 28.61, 77.21, { apparent_c: 20, rain_24h_mm: 0 }, "Delhi"),
  pt("Visakhapatnam", 17.69, 83.22, { apparent_c: 28, rain_24h_mm: 90 }, "Andhra Pradesh"),
  pt("Leh", 34.15, 77.58, { apparent_c: -6, rain_24h_mm: 0 }, "Ladakh"),
];
const STATIONS = [st("anand-vihar", 28.65, 77.31, "vpoor", 350), st("hebbal", 13.03, 77.59, "good", 40)];
const MAP: IndiaMap = {
  cells: mapCells(GRID, STATIONS, []),
  dots: airDots(STATIONS),
  cyclones: [],
  gridAsOf: "2026-11-18T12:07:14Z",
  airAsOf: "2026-11-18T15:05:10Z",
  airCounts: airCounts(STATIONS),
};
const AKVAN: Cyclone = {
  basin: "bay",
  kind: "warning",
  id: "03B",
  issued: "181500Z",
  name: "Akvan",
  lat: 13.6,
  lon: 85.3,
  moving: "NW",
  track: [],
  at: "2026-11-18T15:00:00Z",
} as unknown as Cyclone;

test("mapCells: a square remembers the district behind its heat and its rain, for the summary links", () => {
  const cells = mapCells(GRID, [], []);
  const at = (lat: number, lon: number) => cells.find((c) => c.lat === Math.floor(lat) && c.lon === Math.floor(lon))!;
  assert.deepEqual(at(10.52, 76.21).heatAt, { name: "Thrissur", state: "Kerala", lat: 10.52, lon: 76.21 });
  assert.equal(at(17.69, 83.22).rainAt?.name, "Visakhapatnam");
});

test("airCounts: measured stations by AQI band", () => {
  assert.deepEqual(airCounts([...STATIONS, st("x", 20, 80, "vpoor", 330), st("y", 20, 81, "good", null as never)]), {
    vpoor: 2,
    good: 1,
  });
});

test("indiaMap: one switch of four layers (native radios), the map named for the layer shown", () => {
  const html = indiaMap(MAP, "en");
  assert.match(html, /<div class="imap" data-layer="w">/);
  for (const v of ["w", "a", "h", "r"]) assert.match(html, new RegExp(`name="layer" value="${v}"`));
  assert.match(html, /role="img" aria-label="Map of India\. Each square is coloured by what is worst in it now\."/);
  assert.match(
    html,
    /data-label-r="Map of India\. Each square is coloured by the rain forecast for the next 24 hours\."/,
  );
  assert.match(html, /<legend class="vh">Map layer<\/legend>/);
});

test("indiaMap: hazards are textures and outlines, never colour alone, and no literal colours", () => {
  const html = indiaMap(MAP, "en");
  assert.match(html, /<pattern id="m-heat"/);
  assert.match(html, /<pattern id="m-cold"/);
  assert.match(html, /fill="url\(#m-cold\)"/); // Leh, cold
  assert.match(html, /class="f-air"/); // the very poor station's square
  assert.match(html, /class="lvs b-vpoor"/); // an air dot by band class
  assert.doesNotMatch(html, /(fill|stroke)="#/);
  assert.match(html, /<p class="mlg L Lw">/); // a legend per layer
  assert.match(html, /Small: high\. Full: severe\./);
});

test("indiaMap: a stamp per layer says how old it is, and the gap between them is said aloud", () => {
  const html = indiaMap(MAP, "en");
  assert.match(
    html,
    /<span class="k">Squares, heat and rain<\/span><span class="v">as of <time[^>]*datetime="2026-11-18T12:07:14Z"/,
  );
  assert.match(html, /<span class="k">Air station dots<\/span>/);
  assert.match(html, /The air dots are about 3 hours newer than the squares\./);
  const close = indiaMap({ ...MAP, airAsOf: "2026-11-18T12:30:00Z" }, "en");
  assert.doesNotMatch(close, /newer than/);
});

test("indiaMap: each layer has a summary in words, with the worst places as links", () => {
  const html = indiaMap(MAP, "en");
  assert.match(html, /Air is high or severe in \d+ squares?\./);
  assert.match(html, /2 air stations: 1 very poor and 1 good\./);
  assert.match(html, /<a href="\/c\/[^"]+">Churu, Rajasthan<span>Severe<\/span><\/a>/);
  // Squares with no district point borrow the nearest one's read, so counts are of drawn squares.
  assert.match(html, /Heavy rain is forecast in \d+ squares? in the next 24 hours\./);
  assert.match(html, /Visakhapatnam, Andhra Pradesh<span>Heavy<\/span>/);
});

test("indiaMap: before the first readings, a notice says so instead of an empty map", () => {
  const html = indiaMap(undefined, "en");
  assert.match(html, /class="mempty"/);
  assert.match(html, /The map is not ready yet\./);
  assert.doesNotMatch(html, /<svg class="msvg"/);
});

test("indiaMap: the cyclone carries IMD's category when IMD has named it, and a way to the rain", () => {
  const rainy = indiaMap({ ...MAP, cyclones: [AKVAN] }, "en", { cyclone: "Severe Cyclonic Storm Akvan" });
  assert.match(rainy, /Severe Cyclonic Storm Akvan is in the Bay of Bengal\. It moves north-west\./);
  assert.match(rainy, /<span class="k">JTWC<\/span>/);
  assert.match(rainy, /data-layer-to="r"/);
  const plain = indiaMap({ ...MAP, cyclones: [AKVAN] }, "en");
  assert.match(plain, /Cyclone Akvan is in the Bay of Bengal\./);
});

test("placesMap: states are click targets keyed to the lists, places are neutral dots, warned ones marked", () => {
  const { svg, dots } = placesMap(MAP, ["anakapalli"], "en");
  assert.match(svg, /aria-label="Map of India with every place on mugilu\. Select a state to see its places\."/);
  assert.match(svg, /<path class="mstate" data-st="st-karnataka" d="M/);
  assert.equal((svg.match(/class="mstate"/g) ?? []).length, 36);
  assert.match(svg, /<use href="#wmark"/);
  assert.match(svg, /class="pdot"/);
  assert.ok(dots.length > 700);
  assert.ok(dots.every(([x, y, slug]) => x > 0 && y > 0 && /^[a-z0-9-]+$/.test(slug)));
});

const snap = (alerts: { headline: string; sent: string; issuer?: string }[]): WarningsSnapshot => ({
  generated_at: "2026-11-18T12:05:00Z",
  count: alerts.length,
  alerts: alerts.map((a, i) => ({
    identifier: String(i),
    category: "Met",
    issuer: a.issuer ?? "controlroom@ndma.gov.in (IMD Visakhapatnam)",
    link: `https://sachet.ndma.gov.in/x?identifier=${i}`,
    ...a,
  })),
});

test("officialCyclone: IMD's category and the storm's name, from the newest cyclone warning", () => {
  const s = snap([
    { headline: "Thunderstorm with lightning is very likely", sent: "Wed, 18 Nov 2026 17:00:00 GMT" },
    {
      headline:
        "SEVERE CYCLONIC STORM AKVAN with maximum wind speed of 90-100 gusting to 110 Kmph lays centred at 1730 IST, Cyclone Warning for ASR, Anakapalli, Parvathipuram Manyam, Srikakulam, Visakhapatnam, Vizianagaram.",
      sent: "Wed, 18 Nov 2026 16:21:58 GMT",
    },
    { headline: "The CYCLONIC STORM AKVAN lays centred", sent: "Wed, 18 Nov 2026 06:00:00 GMT" },
  ]);
  const c = officialCyclone(s)!;
  assert.equal(c.title, "Severe Cyclonic Storm Akvan");
  assert.equal(c.name, "Akvan");
  assert.equal(c.alert.sent, "Wed, 18 Nov 2026 16:21:58 GMT");
  assert.deepEqual(c.areas, [
    "ASR",
    "Anakapalli",
    "Parvathipuram Manyam",
    "Srikakulam",
    "Visakhapatnam",
    "Vizianagaram",
  ]);
  assert.equal(officialCyclone(snap([{ headline: "CYCLONIC STORM OVER the sea", sent: "x" }])), undefined);
  assert.equal(officialCyclone(null), undefined);
});

test("warnedPlaces: the areas a warning names, as place slugs (initials like ASR resolved in its state)", () => {
  const slugs = warnedPlaces(["ASR", "Anakapalli", "Srikakulam", "Visakhapatnam", "Nowhere"]);
  assert.ok(slugs.includes("alluri-sitharama-raju"), slugs.join());
  assert.ok(slugs.includes("anakapalli"));
  assert.ok(slugs.includes("visakhapatnam"));
  assert.equal(slugs.length, 4);
});

import { DOT_HIT, nearestDot, MAP_JS } from "../src/ui/map";

test("a /places click hits a dot only within its drawn radius plus 1; further out it is the state's", () => {
  const dots: [number, number, string][] = [
    [10, 10, "a"],
    [20, 10, "b"],
  ];
  assert.equal(nearestDot(dots, 10.5, 10.5, DOT_HIT), "a");
  assert.equal(nearestDot(dots, 19, 10, DOT_HIT), "b");
  // 3 units away: inside the old 6-unit radius, now a state click.
  assert.equal(nearestDot(dots, 13, 10, DOT_HIT), null);
  assert.ok(DOT_HIT <= 2.5);
});

test("the map script ships the same hit function", () => {
  const js = MAP_JS("en");
  assert.ok(js.includes("var nearestDot=") && js.includes(`,${DOT_HIT});`));
  assert.ok(!js.includes("bd=36"));
});
