import { test } from "node:test";
import assert from "node:assert/strict";
import { hasCoverage } from "../src/collect";
import type { ConditionsPoint } from "../src/types";

const pt = (wx: ConditionsPoint["wx"]) => ({ wx }) as ConditionsPoint;
const full = pt({ temp_c: 30, uv: 5 });
const blank = pt({ temp_c: null, apparent_c: null, uv: null } as unknown as ConditionsPoint["wx"]);

test("hasCoverage: a grid where Open-Meteo answered is written", () => {
  assert.equal(hasCoverage([...Array(95).fill(full), ...Array(5).fill(blank)]), true);
});

test("hasCoverage: a failed or rate-limited run (mostly blank points) keeps the previous grid", () => {
  assert.equal(hasCoverage(Array(100).fill(blank)), false);
  assert.equal(hasCoverage([...Array(50).fill(full), ...Array(50).fill(blank)]), false);
  assert.equal(hasCoverage([]), false);
});
