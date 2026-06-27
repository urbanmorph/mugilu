import { test } from "node:test";
import assert from "node:assert/strict";
import { nationalHighlights } from "../src/highlights";
import type { ConditionsPoint } from "../src/types";

function pt(name: string, lat: number, lon: number, wx: ConditionsPoint["wx"]): ConditionsPoint {
  return { id: name, name, level: "district", source_layer: "lgd_districts", lat, lon, wx };
}

test("nationalHighlights: picks the single hottest and dustiest points", () => {
  const points = [
    pt("Lucknow", 26.8, 80.9, { apparent_c: 44, wet_bulb_c: 27.5, dust_ug_m3: 50 }),
    pt("Jaisalmer", 26.9, 70.9, { apparent_c: 41, dust_ug_m3: 1458 }),
    pt("Shimla", 31.1, 77.2, { apparent_c: 22, dust_ug_m3: 5 }),
  ];
  const h = nationalHighlights(points);
  assert.equal(h.hottest?.name, "Lucknow");
  assert.equal(h.hottest?.apparent_c, 44);
  assert.equal(h.hottest?.wet_bulb_c, 27.5);
  assert.equal(h.dustiest?.name, "Jaisalmer");
  assert.equal(h.dustiest?.dust_ug_m3, 1458);
});

test("nationalHighlights: tolerant of missing fields and an empty grid", () => {
  assert.deepEqual(nationalHighlights([]), {});
  const h = nationalHighlights([pt("X", 1, 1, {})]);
  assert.equal(h.hottest, undefined);
  assert.equal(h.dustiest, undefined);
});
