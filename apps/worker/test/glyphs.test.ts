import { test } from "node:test";
import assert from "node:assert/strict";
import { gauge, pollutantBars, uvSteps, worstPollutant } from "../src/glyphs";

const lefts = (html: string, cls: string) =>
  [...html.matchAll(new RegExp(`<i class="${cls}" style="left:([\\d.]+)%`, "g"))].map((m) => +m[1]);

test("gauge: fill to the value, a tick at each threshold, the level as a class (never a colour)", () => {
  const g = gauge(33, 15, 40, { ticks: [30, 32, 35], level: 2 });
  assert.match(g, /^<div class="gauge high" aria-hidden="true">/);
  assert.match(g, /<i class="f" style="left:0%;width:72%"><\/i>/);
  assert.deepEqual(lefts(g, "tk"), [60, 68, 80]);
  assert.doesNotMatch(g, /#[0-9a-f]{6}|--gc/i, "no literal colour: the level class carries it");
});

test("gauge: a calm level is the quiet fill, and values outside the range are pinned to its ends", () => {
  assert.match(gauge(5, 10, 35, {}), /^<div class="gauge" aria-hidden/);
  assert.match(gauge(5, 10, 35, {}), /width:0%/);
  assert.match(gauge(99, 10, 35, {}), /width:100%/);
});

test("gauge: a class can stand in for the level's (today above normal)", () => {
  assert.match(gauge(1, 0, 2, { level: 2, cls: "moderate" }), /class="gauge moderate"/);
});

test("gauge: a log scale places 1 km halfway between 100 m and 10 km", () => {
  assert.match(gauge(1000, 100, 10000, { log: true }), /width:50%/);
});

test("gauge: `from` fills only between two values (today against the normal), with a marker", () => {
  const g = gauge(45, 30, 50, { from: 40, ticks: [40], marker: true, level: 1 });
  assert.match(g, /<i class="f" style="left:50%;width:25%"><\/i>/);
  assert.deepEqual(lefts(g, "mk"), [75]);
  assert.match(gauge(36, 30, 50, { from: 40 }), /left:30%;width:20%/);
});

test("pollutantBars: the BarRow component, each pollutant against its CPCB limit (the line at 40%)", () => {
  const html = pollutantBars({ pm10: 218, pm25: 64, no2: 41, co: 1.2 });
  assert.match(html, /^<div class="bars" style="--lim:40\.0%">/);
  const rows = [...html.matchAll(/<div class="brow( b-\w+)?"><span>([^<]+)<\/span>/g)].map((m) => [m[2], m[1] ?? ""]);
  assert.deepEqual(rows, [
    ["PM2.5", " b-moderate"],
    ["PM10", " b-moderate"],
    ["NO₂", ""],
    ["CO", ""],
  ]);
  // PM10 218 against a 100 limit, on a 0-250 track.
  assert.match(html, /<span>PM10<\/span><span class="track" aria-hidden="true"><i class="f" style="width:87\.2%/);
  assert.match(html, /<b>218<\/b>/);
  assert.match(html, /<b>1.2<\/b>/, "CO keeps its decimal");
});

test("pollutantBars: an over-limit bar takes the CPCB band of its own sub-index; under the limit, quiet", () => {
  assert.match(pollutantBars({ pm10: 300 }), /class="brow b-poor"/); // 201-300
  assert.match(pollutantBars({ pm25: 20 }), /class="brow"/);
});

test("worstPollutant: the persona's own, else the one furthest over its limit", () => {
  assert.deepEqual(worstPollutant({ pm10: 218, pm25: 64 }), { pm10: 218 });
  assert.deepEqual(worstPollutant({ pm10: 218, pm25: 64 }, ["pm25"]), { pm25: 64 });
});

test("uvSteps: eleven steps by level, lit up to the index, the current one marked", () => {
  const u = uvSteps(7.4);
  assert.match(u, /^<span class="uvs" aria-hidden="true">/);
  assert.equal([...u.matchAll(/<i /g)].length, 11);
  assert.equal([...u.matchAll(/<i class="[\w-]+( now)?">/g)].length, 7, "seven lit, the rest off");
  assert.match(u, /<i class="high now">/, "UV 7 is high");
  assert.equal([...u.matchAll(/ off"/g)].length, 4);
  assert.equal([...uvSteps(13).matchAll(/ off"/g)].length, 0);
  assert.match(uvSteps(11), /<i class="b-severe now">/, "11+ is the extreme step");
});
