import { test } from "node:test";
import assert from "node:assert/strict";
import { airDots, LAND_PATH, mapCells, renderIndiaMap } from "../src/indiamap";
import { renderHome } from "../src/page";
import type { ConditionsPoint, NormalizedStation } from "../src/types";
import type { Cyclone } from "../src/cyclones";

const pt = (name: string, lat: number, lon: number, wx: ConditionsPoint["wx"]): ConditionsPoint => ({
  id: name,
  name,
  level: "district",
  source_layer: "x",
  lat,
  lon,
  wx,
});
const st = (id: string, lat: number, lon: number, band: NormalizedStation["band"], aqi: number) =>
  ({ id, name: id, city: id, lat, lon, band, aqi, pollutants: {}, provider: "cpcb" }) as unknown as NormalizedStation;

const GRID = [
  pt("Churu", 28.3, 74.95, { apparent_c: 46, wet_bulb_c: 24, uv: 8, dust_ug_m3: 40 }), // severe heat
  pt("New Delhi", 28.61, 77.21, { apparent_c: 30, uv: 4, dust_ug_m3: 20 }),
  pt("Bengaluru Urban", 12.97, 77.59, { apparent_c: 26, uv: 3, dust_ug_m3: 5 }),
  pt("Leh", 34.15, 77.58, { apparent_c: -6, uv: 2 }), // cold
];
const STATIONS = [st("anand-vihar", 28.65, 77.31, "vpoor", 350), st("hebbal", 13.03, 77.59, "good", 40)];

test("mapCells: each square takes the worst read in it, scored as on /c", () => {
  const cells = mapCells(GRID, STATIONS, []);
  const at = (lat: number, lon: number) => cells.find((c) => c.lat === Math.floor(lat) && c.lon === Math.floor(lon))!;
  assert.equal(at(28.3, 74.95).worst, 3); // feels-like 46: severe heat
  assert.equal(at(28.3, 74.95).heat, 3);
  assert.equal(at(28.61, 77.21).worst, 3); // very poor air at a station in the square
  assert.equal(at(28.61, 77.21).heat, 0);
  assert.equal(at(12.97, 77.59).worst, 0);
  assert.equal(at(34.15, 77.58).worst, 3); // -6 feels-like: severe cold counts in Worst
  assert.equal(at(34.15, 77.58).heat, 0); // but not on the Heat layer
});

test("mapCells: smoke from the fires inside a square counts", () => {
  const fires = Array.from({ length: 30 }, (_, i) => ({ lat: 30.1 + i * 0.01, lon: 74.5, frp: 5 }));
  const cells = mapCells([pt("Bathinda", 30.2, 74.95, { apparent_c: 28 })], [], fires as never);
  assert.equal(cells.find((c) => c.lat === 30 && c.lon === 74)!.worst, 2); // 30 fires: high smoke
});

test("mapCells: a square of India with no district point borrows its nearest one", () => {
  const cells = mapCells(GRID, [], []);
  // Squares across the land, not just the four with points.
  assert.ok(cells.length > 250, `${cells.length} squares`);
  assert.ok(cells.every((c) => c.worst >= 0 && c.worst <= 3));
});

test("airDots: the worst plausible station per half degree, as measured", () => {
  const dots = airDots([...STATIONS, st("near", 28.66, 77.3, "poor", 250)]);
  assert.equal(dots.length, 2); // the two Delhi stations share a bin
  assert.equal(dots.find((d) => d.lat > 20)!.band, "vpoor");
});

test("LAND_PATH: India's outline as one closed path", () => {
  assert.match(LAND_PATH, /^M[\d.]+ [\d.]+L/);
  assert.ok(LAND_PATH.split("Z").length > 5, "mainland and islands");
  assert.ok(LAND_PATH.length < 30_000, `${LAND_PATH.length} chars`);
});

const CYCLONE: Cyclone = {
  kind: "alert",
  id: "98B",
  lat: 15.8,
  lon: 90.9,
  moving: "W",
  track: [],
  issued: "251100Z",
  basin: "bay",
};

test("renderIndiaMap: three layers, a legend for each, warnings named as off the map", () => {
  const html = renderIndiaMap({ cells: mapCells(GRID, STATIONS, []), dots: airDots(STATIONS), cyclones: [] });
  for (const id of ["ml-w", "ml-a", "ml-h"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /<label for="ml-w">Worst<\/label>/);
  assert.match(html, /<label for="ml-a">Air<\/label>/);
  assert.match(html, /<label for="ml-h">Heat<\/label>/);
  assert.match(html, /role="img" aria-label="[^"]+"/);
  assert.match(html, /clipPath/);
  assert.match(html, /Very Poor<\/span><span><i style="background:#7f1d1d"><\/i>Severe/); // every band a dot can take
  assert.match(html, /Official warnings are not on this map/);
  assert.doesNotMatch(html, /—/);
  assert.doesNotMatch(html, /cyclone/i);
});

test("renderIndiaMap: a cyclone is drawn on the map and told in words, with IMD named", () => {
  const html = renderIndiaMap({ cells: [], dots: [], cyclones: [CYCLONE] });
  assert.match(html, /class="mcy"/);
  assert.match(html, /A cyclone can form in the Bay of Bengal\. It moves west\./);
  assert.match(html, /JTWC/);
  assert.match(html, /IMD/);
  const named = renderIndiaMap({
    cells: [],
    dots: [],
    cyclones: [{ ...CYCLONE, kind: "warning", id: "03B", name: "Montha", moving: "NW", track: [{ lat: 17, lon: 87 }] }],
  });
  assert.match(named, /Cyclone Montha is in the Bay of Bengal\. It moves north-west\./);
});

test("renderIndiaMap: in Hindi the words are Hindi, the names stay", () => {
  const html = renderIndiaMap(
    { cells: [], dots: [], cyclones: [{ ...CYCLONE, name: "Montha", kind: "warning" }] },
    "hi",
  );
  assert.doesNotMatch(html, /Official warnings are not on this map/);
  assert.doesNotMatch(html, /is in the Bay of Bengal/);
  assert.match(html, /Montha/);
});

test("renderHome: the India now section carries the map when there is one", () => {
  const map = { cells: mapCells(GRID, STATIONS, []), dots: airDots(STATIONS), cyclones: [CYCLONE] };
  const html = renderHome(undefined, undefined, { map });
  assert.match(html, /<section class="hero-now"/);
  assert.match(html, /class="imap"/);
  assert.match(html, /A cyclone can form/);
  assert.doesNotMatch(html, /This is not a map/);
  assert.doesNotMatch(renderHome(), /class="imap"/); // no data, no map
});
