import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGazIndex, matchGazetteer, gazNorm, type GazRow } from "../src/gazetteer";

const ROWS: GazRow[] = [
  ["Paradip", 20.3164, 86.6085, "t", "Odisha", ["Paradeep", "Paradwip"]],
  ["Bengaluru", 12.9716, 77.5946, "c", "Karnataka", ["Bangalore", "ಬೆಂಗಳೂರು"]],
  ["Indiranagar", 12.9784, 77.6408, "n", "Karnataka", undefined],
  ["Indiranagar", 21.123, 79.0874, "n", "Maharashtra", undefined],
  ["Thiruvananthapuram", 8.4882, 76.9476, "c", "Kerala", ["Trivandrum"]],
];
const IDX = buildGazIndex(ROWS);

test("gazNorm: lowercases and strips Latin diacritics", () => {
  assert.equal(gazNorm("Parādīp"), "paradip");
  assert.equal(gazNorm("  Bengalūru  "), "bengaluru");
});

test("matchGazetteer: an alternate spelling resolves to the indexed place", () => {
  const hits = matchGazetteer(IDX, "Paradeep");
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].name, "Paradip");
  assert.equal(hits[0].state, "Odisha");
  assert.equal(hits[0].lat, 20.3164);
});

test("matchGazetteer: old/colloquial names resolve (subsumes the alias map)", () => {
  assert.equal(matchGazetteer(IDX, "Bangalore")[0].name, "Bengaluru");
  assert.equal(matchGazetteer(IDX, "Trivandrum")[0].name, "Thiruvananthapuram");
});

test("matchGazetteer: native-script query matches the native-script alternate", () => {
  const hits = matchGazetteer(IDX, "ಬೆಂಗಳೂರು");
  assert.equal(hits[0].name, "Bengaluru");
});

test("matchGazetteer: prefix match works and ranks by type", () => {
  const hits = matchGazetteer(IDX, "bengal");
  assert.equal(hits[0].name, "Bengaluru"); // prefix
});

test("matchGazetteer: ambiguous name returns multiple, distinguishable by state", () => {
  const hits = matchGazetteer(IDX, "Indiranagar");
  assert.equal(hits.length, 2);
  const states = hits.map((h) => h.state).sort();
  assert.deepEqual(states, ["Karnataka", "Maharashtra"]);
});

test("matchGazetteer: a too-short query returns nothing", () => {
  assert.deepEqual(matchGazetteer(IDX, "p"), []);
});

test("matchGazetteer: fuzzy skeleton fallback resolves an untagged transliteration", () => {
  // OSM tags the town as 'Paradip' with no 'Paradeep' alternate, so exact matching
  // misses it; the consonant skeleton (prdp) still resolves it.
  const onlyParadip: GazRow[] = [["Paradip", 20.2674, 86.6597, "t", "Odisha", undefined]];
  const idx = buildGazIndex(onlyParadip);
  assert.equal(matchGazetteer(idx, "Paradip").length, 1); // exact still works
  const fuzzy = matchGazetteer(idx, "Paradeep");
  assert.equal(fuzzy.length, 1);
  assert.equal(fuzzy[0].name, "Paradip");
});

test("matchGazetteer: exact match is preferred over fuzzy (no false override)", () => {
  // "Bengaluru" exact must not be displaced by skeleton noise.
  assert.equal(matchGazetteer(IDX, "Bengaluru")[0].name, "Bengaluru");
});
