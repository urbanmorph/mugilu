import { test } from "node:test";
import assert from "node:assert/strict";
import { gauge, pollutantBars, lifeBlocks, compass, drops, uvSteps } from "../src/glyphs";
import { BAND_COLOR, RISK_COLOR } from "../src/palette";

const lefts = (html: string, cls: string) =>
  [...html.matchAll(new RegExp(`<i class="${cls}" style="left:([\\d.]+)%`, "g"))].map((m) => +m[1]);

test("gauge: fill to the value, a tick at each threshold, in the level's colour", () => {
  const g = gauge(33, 15, 40, { ticks: [30, 32, 35], level: 2 });
  assert.match(g, /<i class="gf" style="left:0%;width:72%"><\/i>/);
  assert.deepEqual(lefts(g, "gt"), [60, 68, 80]);
  assert.match(g, new RegExp(`--gc:${RISK_COLOR.high}`));
  assert.match(g, /aria-hidden="true"/);
});

test("gauge: a calm level is muted, and values outside the range are pinned to its ends", () => {
  assert.match(gauge(5, 10, 35, {}), /--gc:var\(--muted\)/);
  assert.match(gauge(5, 10, 35, {}), /width:0%/);
  assert.match(gauge(99, 10, 35, {}), /width:100%/);
});

test("gauge: a colour can stand in for the level's", () => {
  assert.match(gauge(1, 0, 2, { level: 2, colour: "var(--sky)" }), /--gc:var\(--sky\)/);
});

test("gauge: a log scale places 1 km halfway between 100 m and 10 km", () => {
  assert.match(gauge(1000, 100, 10000, { log: true }), /width:50%/);
});

test("gauge: `from` fills only between two values (today against the normal), with a marker", () => {
  const g = gauge(45, 30, 50, { from: 40, ticks: [40], marker: true, level: 1 });
  assert.match(g, /<i class="gf" style="left:50%;width:25%"><\/i>/);
  assert.deepEqual(lefts(g, "gm"), [75]);
  // Below normal fills from the value up to the normal.
  assert.match(gauge(36, 30, 50, { from: 40 }), /left:30%;width:20%/);
});

test("gauge: `under` draws a second, inner fill (steady wind under the gusts)", () => {
  assert.match(gauge(46, 0, 100, { under: 18 }), /<i class="gu" style="width:18%"><\/i>/);
});

test("pollutantBars: one row per pollutant, each against its CPCB limit (the line at 40%)", () => {
  const html = pollutantBars({ pm10: 218, pm25: 64, no2: 41, co: 1.2 });
  const rows = [...html.matchAll(/<div class="pr( over)?"><span>([^<]+)<\/span>/g)].map((m) => [m[2], !!m[1]]);
  assert.deepEqual(rows, [
    ["PM2.5", true],
    ["PM10", true],
    ["NO₂", false],
    ["CO", false],
  ]);
  // PM10 218 against a 100 limit, on a 0-250 track.
  assert.match(html, /<span>PM10<\/span><span class="pt"[^>]*><i class="pf" style="width:87.2%/);
  assert.match(html, /<b>218<\/b>/);
  assert.match(html, /<b>1.2<\/b>/, "CO keeps its decimal, as the text line did");
  assert.equal([...html.matchAll(/class="pl"/g)].length, 4, "each track carries the limit line");
});

test("pollutantBars: an over-limit bar takes the CPCB band colour of its own sub-index", () => {
  assert.match(pollutantBars({ pm10: 218 }), new RegExp(`--gc:${BAND_COLOR.moderate}`)); // sub-index 101-200
  assert.match(pollutantBars({ pm10: 300 }), new RegExp(`--gc:${BAND_COLOR.poor}`)); // 201-300
  assert.match(pollutantBars({ pm25: 20 }), /--gc:var\(--muted\)/);
});

test("lifeBlocks: a block per year, the last one partly filled, at most ten", () => {
  const b = lifeBlocks(4.3);
  assert.equal([...b.matchAll(/<i style="width:100%"><\/i>/g)].length, 4);
  assert.match(b, /<i style="width:30%"><\/i>/);
  assert.equal([...lifeBlocks(14).matchAll(/<i /g)].length, 10);
  assert.equal(lifeBlocks(0), "");
});

test("compass: the arrow points where the wind blows TO (from the west, it points east)", () => {
  assert.match(compass(270, 1), /rotate\(90 /);
  assert.match(compass(0, 0), /rotate\(180 /);
  assert.match(compass(270, 1), new RegExp(`stroke="${RISK_COLOR.moderate}"`));
});

test("drops: ten drops, one filled for every 10% chance", () => {
  const d = drops(40);
  assert.equal([...d.matchAll(/<path /g)].length, 10);
  assert.equal([...d.matchAll(/class="on"/g)].length, 4);
  assert.equal([...drops(4).matchAll(/class="on"/g)].length, 0);
  assert.equal([...drops(100).matchAll(/class="on"/g)].length, 10);
});

test("uvSteps: eleven steps in the WHO colours, lit up to the index, the current one outlined", () => {
  const u = uvSteps(7.4);
  assert.equal([...u.matchAll(/<i /g)].length, 11);
  assert.equal([...u.matchAll(/<i class="on/g)].length, 7);
  assert.match(u, /<i class="on now" style="--uc:#f97316">/, "UV 7 is orange (high)");
  assert.equal([...uvSteps(0.4).matchAll(/<i class="on/g)].length, 0);
  assert.equal([...uvSteps(13).matchAll(/<i class="on/g)].length, 11);
});
