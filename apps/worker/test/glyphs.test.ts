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

test("gauge: zones draw the scale, each band in its level's token, a dot at the reading", () => {
  const g = gauge(33, 15, 40, { zones: [30, 32, 35], level: 2 });
  assert.match(
    g,
    /^<div class="gauge zoned high" style="--grad:linear-gradient\(90deg,var\(--low\) 0%,var\(--low\) 57%,var\(--moderate\) 63%,/,
  );
  assert.match(g, /var\(--high\) 77%,var\(--severe\) 83%,var\(--severe\) 100%\)" aria-hidden="true">/);
  assert.match(
    g,
    /<i class="f" style="clip-path:inset\(0 28% 0 0%\)"><\/i>/,
    "the scale shown in full up to the reading",
  );
  assert.deepEqual(lefts(g, "tk"), [60, 68, 80], "the zone edges are the ticks");
  assert.match(g, /<i class="dot" style="--at:72%"><\/i>/);
  assert.doesNotMatch(g, /#[0-9a-f]{6}/i, "no literal colour: tokens only");
});

test("gauge: thresholds that fall (cold, visibility) run the scale the other way, the worst on the left", () => {
  const cold = gauge(-1, -10, 30, { from: -1, zones: [10, 5, 0], level: 3 });
  assert.match(cold, /--grad:linear-gradient\(90deg,var\(--severe\) 0%,var\(--severe\) 22%,var\(--high\) 28%,/);
  assert.match(cold, /var\(--moderate\) 47%,var\(--low\) 53%,var\(--low\) 100%\)/);
  assert.match(cold, /clip-path:inset\(0 77.5% 0 22.5%\)/, "a mark, not a bar that reads as heat");
  assert.match(cold, /class="dot" style="--at:22.5%"/);
});

test("gauge: ticks can add a mark the zones do not have (hazy at 5 km)", () => {
  const fog = gauge(1000, 100, 10000, { log: true, zones: [1000, 500, 200], ticks: [1000, 500, 200, 5000], level: 1 });
  assert.equal(lefts(fog, "tk").length, 4);
  assert.match(fog, /var\(--severe\) 0%/);
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
  assert.match(u, /<i class="moderate now">/, "UV 7 is moderate, as the chip says (score.ts THRESHOLDS.uv)");
  assert.match(
    u,
    /^<span class="uvs" aria-hidden="true">(<i class="low"><\/i>){5}<i class="moderate"><\/i>/,
    "1-5 low",
  );
  assert.equal([...u.matchAll(/ off"/g)].length, 4);
  assert.equal([...uvSteps(13).matchAll(/ off"/g)].length, 0);
  assert.match(uvSteps(11), /<i class="high now">/, "11+ is high");
});
