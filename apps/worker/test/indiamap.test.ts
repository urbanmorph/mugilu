import { test } from "node:test";
import assert from "node:assert/strict";
import { airDots, LAND_PATH, mapCells, renderIndiaMap, STATE_PATH } from "../src/indiamap";
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
  pt("Churu", 28.3, 74.95, { apparent_c: 46, wet_bulb_c: 24, uv: 8, dust_ug_m3: 40, rain_24h_mm: 0 }), // severe heat
  pt("New Delhi", 28.61, 77.21, { apparent_c: 30, uv: 4, dust_ug_m3: 20, rain_24h_mm: 0 }),
  pt("Bengaluru Urban", 12.97, 77.59, { apparent_c: 26, uv: 3, dust_ug_m3: 5, rain_24h_mm: 12 }),
  pt("Leh", 34.15, 77.58, { apparent_c: -6, uv: 2, rain_24h_mm: 0 }), // cold
];
const STATIONS = [st("anand-vihar", 28.65, 77.31, "vpoor", 350), st("hebbal", 13.03, 77.59, "good", 40)];

const cellAt = (cells: ReturnType<typeof mapCells>, lat: number, lon: number) =>
  cells.find((c) => c.lat === Math.floor(lat) && c.lon === Math.floor(lon))!;

test("mapCells: each square takes the worst read in it and names what it is", () => {
  const cells = mapCells(GRID, STATIONS, []);
  const at = (lat: number, lon: number) => cellAt(cells, lat, lon);
  assert.deepEqual([at(28.3, 74.95).worst, at(28.3, 74.95).what], [3, "heat"]); // feels-like 46
  assert.equal(at(28.3, 74.95).heat, 3);
  assert.deepEqual([at(28.61, 77.21).worst, at(28.61, 77.21).what], [3, "air"]); // a very poor station
  assert.equal(at(28.61, 77.21).heat, 0);
  assert.equal(at(12.97, 77.59).worst, 0);
  assert.deepEqual([at(34.15, 77.58).worst, at(34.15, 77.58).what], [3, "cold"]); // -6 feels-like
  assert.equal(at(34.15, 77.58).heat, 0); // but not on the Heat layer
});

test("mapCells: UV is left out (it follows the time of day everywhere)", () => {
  const cells = mapCells([pt("Noon", 20.5, 78.5, { apparent_c: 30, uv: 11 })], [], []);
  assert.equal(cellAt(cells, 20.5, 78.5).worst, 0);
});

test("mapCells: equal levels name air, then heat, then cold", () => {
  const hot = pt("Hot", 28.4, 77.05, { apparent_c: 46 });
  const cells = mapCells([hot], [st("smog", 28.5, 77.1, "vpoor", 350)], []);
  assert.deepEqual([cellAt(cells, 28.4, 77.05).worst, cellAt(cells, 28.4, 77.05).what], [3, "air"]);
});

test("mapCells: rain in the next 24 hours, in IMD's classes", () => {
  const mm = [20, 70, 130, 210];
  const cells = mapCells(
    mm.map((r, i) => pt(`R${i}`, 16.5, 78.5 + i, { apparent_c: 28, rain_24h_mm: r })),
    [],
    [],
  );
  assert.deepEqual(
    mm.map((_, i) => cellAt(cells, 16.5, 78.5 + i).rain),
    [0, 1, 2, 3], // below heavy, heavy, very heavy, extremely heavy
  );
});

test("mapCells: smoke from the fires inside a square counts", () => {
  const fires = Array.from({ length: 30 }, (_, i) => ({ lat: 30.1 + i * 0.01, lon: 74.5, frp: 5 }));
  const cells = mapCells([pt("Bathinda", 30.2, 74.95, { apparent_c: 28 })], [], fires as never);
  const c = cells.find((c) => c.lat === 30 && c.lon === 74)!;
  assert.deepEqual([c.worst, c.what], [2, "air"]); // 30 fires: high smoke, which is air
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

test("STATE_PATH: the borders between states, open lines, light enough for the home page", () => {
  assert.match(STATE_PATH, /^M[\d.]+ [\d.]+L/);
  assert.ok(!STATE_PATH.includes("Z"), "borders are lines, not closed rings");
  assert.ok(STATE_PATH.split("M").length > 60, "every border between two states");
  assert.ok(STATE_PATH.length < 16_000, `${STATE_PATH.length} chars`);
  const html = renderIndiaMap({ cells: [], dots: [], cyclones: [] });
  assert.match(html, /<path class="mstates" d="M/); // drawn on every layer
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

test("renderIndiaMap: four layers, a legend for each, warnings named as off the map", () => {
  const html = renderIndiaMap({ cells: mapCells(GRID, STATIONS, []), dots: airDots(STATIONS), cyclones: [] });
  for (const id of ["ml-w", "ml-a", "ml-h", "ml-r"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /<label for="ml-w">What&#39;s worst<\/label>/);
  assert.match(html, /<label for="ml-a">Air<\/label>/);
  assert.match(html, /<label for="ml-h">Heat<\/label>/);
  assert.match(html, /<label for="ml-r">Rain<\/label>/);
  assert.match(html, /role="img" aria-label="[^"]+"/);
  assert.match(html, /clipPath/);
  assert.match(html, /Very Poor<\/span><span><i style="background:#7f1d1d"><\/i>Severe/); // every band a dot can take
  assert.match(html, /Official warnings are not on this map/);
  assert.doesNotMatch(html, /—/);
  assert.doesNotMatch(html, /class="mcy"|class="mcard"/); // no cyclone, no glyph or card
});

test("renderIndiaMap: What's worst colours a square by its hazard, only where high or severe", () => {
  const html = renderIndiaMap({ cells: mapCells(GRID, STATIONS, []), dots: [], cyclones: [] });
  const worst = html.match(/<g class="L Lw">(.*?)<\/g>/)![1];
  assert.match(worst, /fill="var\(--mheat\)"/); // Churu
  assert.match(worst, /fill="var\(--mair\)"/); // Delhi
  assert.match(worst, /fill="var\(--mcold\)"/); // Leh
  assert.equal(worst.match(/<path/g)!.length, 3); // calm squares are left as land
  assert.doesNotMatch(worst, /fill-opacity/); // all three severe: full strength
  // The legend names hazards only; each chip shows its two strengths, and one line says which is which.
  const lg = html.match(/<p class="mlg Lw">(.*?)<\/p>/)![1];
  assert.match(lg, /Air.*Heat.*Cold/);
  assert.equal(lg.match(/class="pair"/g)!.length, 3);
  assert.doesNotMatch(lg, />High<|>Severe</); // levels are not chips: no grey or white square to look for
  assert.match(html, /Pale: high\. Solid: severe\./);
  assert.match(html, /Air includes smoke and dust/);
});

test("renderIndiaMap: Rain says when no heavy rain is forecast, and colours it when it is", () => {
  const dry = renderIndiaMap({ cells: mapCells(GRID, [], []), dots: [], cyclones: [] });
  assert.match(dry, /No heavy rain is forecast in the next 24 hours/);
  const wet = renderIndiaMap({
    cells: mapCells([pt("Kakinada", 16.9, 82.2, { apparent_c: 28, rain_24h_mm: 150 })], [], []),
    dots: [],
    cyclones: [],
  });
  assert.doesNotMatch(wet, /No heavy rain/);
  assert.match(wet, /<g class="L Lr"><path fill="var\(--mrain2\)"/);
  assert.match(wet, /Very heavy/);
  assert.match(wet, /often underestimate/);
});

test("renderIndiaMap: no Rain layer until the grid carries a forecast", () => {
  const old = GRID.map((p) => ({ ...p, wx: { ...p.wx, rain_24h_mm: undefined } }));
  const html = renderIndiaMap({ cells: mapCells(old, [], []), dots: [], cyclones: [CYCLONE] });
  assert.doesNotMatch(html, /ml-r|No heavy rain|See the rain/);
});

test("renderIndiaMap: a cyclone is drawn on the map and told in words, with IMD named", () => {
  const html = renderIndiaMap({ cells: mapCells(GRID, [], []), dots: [], cyclones: [CYCLONE] });
  assert.match(html, /class="mcy"/);
  assert.match(html, /A cyclone can form in the Bay of Bengal\. It moves west\./);
  assert.match(html, /JTWC/);
  assert.match(html, /IMD/);
  assert.match(html, /<label for="ml-r" class="mto">See the rain<\/label>/); // the card opens the Rain layer
  const named = renderIndiaMap({
    cells: [],
    dots: [],
    cyclones: [{ ...CYCLONE, kind: "warning", id: "03B", name: "Montha", moving: "NW", track: [{ lat: 17, lon: 87 }] }],
  });
  assert.match(named, /Cyclone Montha is in the Bay of Bengal\. It moves north-west\./);
});

test("renderIndiaMap: in Hindi the words are Hindi, the names stay", () => {
  const html = renderIndiaMap(
    { cells: mapCells(GRID, [], []), dots: [], cyclones: [{ ...CYCLONE, name: "Montha", kind: "warning" }] },
    "hi",
  );
  assert.doesNotMatch(html, /Official warnings are not on this map/);
  assert.doesNotMatch(
    html,
    /What&#39;s worst|>Cold<|No heavy rain|See the rain|Extremely heavy|weather model|smoke and dust/,
  );
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
