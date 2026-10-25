import { test } from "node:test";
import assert from "node:assert/strict";
import { ambientRisk, dustLevelOf, heatLevelOf, THRESHOLD_ROWS } from "../src/score";
import { renderConditionsPage, renderMethodology } from "../src/page";
import { readResource } from "../src/mcpcontent";
import { esc } from "../src/html";
import type { Conditions } from "../src/types";

function cond(dust: number): Conditions {
  return {
    location: { lat: 26.9, lon: 70.9 },
    as_of: "2026-06-26T14:05:00.000Z",
    air: null,
    heat: null,
    rain: null,
    uv: null,
    dust: { dust_ug_m3: dust, source: "open-meteo" },
    wind: null,
    visibility: null,
    smoke: null,
    attribution: "",
    disclaimer: "",
  } as unknown as Conditions;
}

test("dustLevelOf: 80 / 150 / 500 µg/m³ are the caution / high / severe edges", () => {
  const at = [0, 79, 80, 149, 150, 499, 500, 900].map(dustLevelOf);
  assert.deepEqual(at, [0, 0, 1, 1, 2, 2, 3, 3]);
});

test("heatLevelOf: the worst of feels-like, wet-bulb and WBGT", () => {
  assert.equal(heatLevelOf({ apparent_c: 34.9 }), 0);
  assert.equal(heatLevelOf({ apparent_c: 35 }), 1);
  assert.equal(heatLevelOf({ apparent_c: 36, wet_bulb_c: 28 }), 2);
  assert.equal(heatLevelOf({ wbgt_c: 35 }), 3);
  assert.equal(heatLevelOf({}), 0);
});

test("the dust word on the page agrees with the Ambient read", () => {
  const word = (d: number) => renderConditionsPage(cond(d)).match(/µg\/m³<\/span> <b>([^<]+)<\/b>/)![1];
  for (const [d, w] of [
    [60, "low"],
    [100, "moderate"],
    [200, "high"],
    [600, "severe"],
  ] as const) {
    assert.equal(word(d), w, `${d} µg/m³`);
    assert.equal(ambientRisk(cond(d)).hazards.find((h) => h.hazard === "Dust")!.band, w);
  }
});

test("both methodology tables are generated from the thresholds the code uses", () => {
  const html = renderMethodology("en");
  const md = readResource("mugilu://methodology")!.contents[0].text as string;
  for (const r of THRESHOLD_ROWS) {
    const tr = `<tr>${[r.hazard, ...r.cells].map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
    assert.ok(html.includes(tr), r.hazard);
    assert.ok(md.includes(`- ${r.hazard}: ${r.cells.join(" / ")}`), r.hazard);
  }
  // UV caps at high: 11+ is the high column, nothing is severe.
  const uv = THRESHOLD_ROWS.find((r) => r.hazard.startsWith("UV"))!;
  assert.deepEqual(uv.cells, ["6–10", "11+", "-"]);
  const dust = THRESHOLD_ROWS.find((r) => r.hazard.startsWith("Dust"))!;
  assert.deepEqual(dust.cells, ["80", "150", "500"]);
});

test("methodology: the bands as the data names them, the persona sentence, the order of risk, and today against normal", () => {
  const en = renderMethodology("en");
  assert.match(en, /low · moderate · high · severe/);
  assert.match(en, /For asthma &amp; lungs, treat it as high\./);
  assert.match(en, /in order of risk/);
  assert.match(en, /Today against normal/);
  assert.match(en, /3 °C or more apart/);
  assert.match(en, /<th>Moderate<\/th>/);
  assert.doesNotMatch(en, /none · caution/);
  for (const lang of ["hi", "kn"] as const) {
    const page = renderMethodology(lang);
    assert.doesNotMatch(page, /Today against normal|treat it as|in order of risk|3 °C or more apart/, lang);
  }
});

test("methodology resource (MCP) says the same", () => {
  const md = readResource("mugilu://methodology")!.contents[0].text as string;
  assert.match(md, /low \/ moderate \/ high \/ severe/);
  assert.match(md, /treat it as high/);
  assert.match(md, /in order of risk/);
  assert.match(md, /1991-2020/);
});
