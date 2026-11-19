import { test } from "node:test";
import assert from "node:assert/strict";
import { simplifyPath, parseRings, ringsOf } from "../src/simplify-path.ts";

test("drops points closer than the tolerance and keeps the corners", () => {
  const d = "M0 0L5 0.1L10 0L10 10L0 10Z";
  const out = simplifyPath(d, 0.4);
  assert.deepEqual(ringsOf(out), [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
  ]);
});

test("keeps every ring, even a tiny island, and writes relative commands", () => {
  const d = "M0 0L10 0L10 10L0 10ZM50 50L50.3 50L50.3 50.2Z";
  const out = simplifyPath(d, 0.4);
  assert.equal(parseRings(d).length, 2);
  assert.equal(ringsOf(out).length, 2);
  assert.match(out, /^M0 0l/);
  assert.ok(!/L/.test(out), "no absolute line commands");
});

test("round trips coordinates to one decimal without drift", () => {
  const pts = Array.from({ length: 200 }, (_, i) => [i * 0.37, Math.sin(i / 7) * 20]);
  const d = "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L") + "Z";
  const back = ringsOf(simplifyPath(d, 0))[0];
  const last = back[back.length - 1];
  const want = pts[pts.length - 1].map((v) => +v.toFixed(1));
  assert.ok(Math.abs(last[0] - want[0]) < 0.06 && Math.abs(last[1] - want[1]) < 0.06);
});
