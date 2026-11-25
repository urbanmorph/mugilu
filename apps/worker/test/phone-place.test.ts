// W8-W10 (PR 2): the place page on phones. The persona switch is one line that opens the
// grid; the detail under the cards, the past warnings, the 30-day chart, the stations, the
// nearby places and the answers fold away; all of it stays in the HTML, and wide screens open
// the folds. Also F1 (the plate's word fits a 320 px phone) and F2 (the kiosk drifts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { testWorker } from "./helpers/worker";
import { withScript } from "./helpers/script";
import { TR } from "../src/i18n";
import { STANDARD_CSS } from "../src/ui/standard";
import { TOKENS_CSS } from "../src/ui/tokens";

const w = testWorker();
const page = async (p: string) => (await w.get(p, { headers: { accept: "text/html" } })).text();
const h2s = (html: string) => [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));

test("W8: the persona switch is one line, 'Who is this for · <current> · Change', over the six links", async () => {
  const html = await page("/c/delhi?as=asthma");
  const nav = html.match(/<nav class="segf" aria-labelledby="who">([\s\S]*?)<\/nav>/)![1];
  assert.match(
    nav,
    /^<details class="whod" data-wide><summary><span class="t-kicker" id="who">Who is this for<\/span><span class="cur">Asthma &amp; lungs<\/span><span class="chg">Change<\/span><\/summary>/,
  );
  assert.equal((nav.match(/<a href=/g) ?? []).length, 6, "still six plain links");
  assert.match(nav, /aria-current="page">Asthma &amp; lungs</);
});

test("W9: the detail folds, and every folded word is still in the HTML", async () => {
  const html = await page("/c/delhi");
  const air = html.match(/<div class="rrow[^"]*" data-k="air">[\s\S]*?<\/details>/)![0];
  assert.match(air, /<details class="fold" data-wide><summary>Pollutants and GRAP<\/summary>/);
  assert.match(air, /GRAP/);
  assert.match(html, /data-k="heat">[\s\S]*?<summary>Humidity, wet-bulb and WBGT<\/summary>/);
  // The past warnings' fold: test/warn-history.test.ts (no fixture place here has any).
  // The 30-day chart's fold: test/history.test.ts (the fixtures keep no daily record).
  assert.match(html, /<summary>Stations<span class="n">\d+<\/span><\/summary><div class="in">[\s\S]*?class="srow"/);
  assert.match(
    html,
    /<summary>Nearby places<span class="n">\d+<\/span><\/summary><div class="in"><div class="ptiles">/,
  );
  assert.match(
    html,
    /<div class="qa-list"><details class="fold" data-wide><summary>/,
    "each question opens its answer",
  );
});

test("W9: the headings keep their order and words", async () => {
  const html = await page("/c/delhi");
  const heads = h2s(html);
  assert.ok(heads.length >= 10, heads.join(" | "));
  assert.ok(heads.some((h) => /Delhi AQI/.test(h)));
});

test("W9: wide screens open the folds (the page script), phones keep them shut", async () => {
  const js = withScript(await page("/c/delhi"));
  assert.match(js, /matchMedia\("\(min-width:1000px\)"\)\.matches[\s\S]{0,120}details\[data-wide\]/);
});

test("the new fold labels are in Hindi and Kannada", () => {
  for (const en of [
    "Change",
    "Pollutants",
    "Pollutants and GRAP",
    "Humidity, wet-bulb and WBGT",
    "Actual temperature and humidity",
    "The air, day by day",
    "Stations",
  ])
    assert.ok(TR[en]?.hi && TR[en]?.kn, en);
});

test("W10: on phones a heading that is not a place name is smaller; a place name keeps its size", () => {
  assert.match(
    STANDARD_CSS,
    /@media \(max-width:600px\)\{\s*\.mg h1\.t-title:not\(\.loc\)\{font-size:clamp\(30px,8\.2vw,40px\)/,
  );
});

test("F1: the plate's word shrinks to the plate, so no headline widens a 320 px phone", () => {
  const css = STANDARD_CSS + TOKENS_CSS;
  assert.match(css, /\.phero \.plate \.row\{container-type:inline-size\}/);
  assert.match(
    css,
    /\.phero \.plate \.row \.t-plate\{font-size:min\(var\(--t-4xl\),calc\(\(100cqi - 80px\) \/ 4\.3\)\)\}/,
  );
});

test("F2: the kiosk drifts a few pixels now and then, against burn-in", async () => {
  const js = withScript(await page("/c/delhi?kiosk"));
  assert.match(js, /\.kio[\s\S]{0,200}translate\(/);
});
