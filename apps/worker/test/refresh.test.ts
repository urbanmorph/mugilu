import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanStationName } from "../src/refresh";

test("cleanStationName with known city strips ', {city} …'", () => {
  assert.equal(cleanStationName("Ashok Vihar, Delhi - DPCC", "Delhi"), "Ashok Vihar");
  assert.equal(cleanStationName("FTI Kidwai Nagar, Kanpur - UPPCB", "Kanpur"), "FTI Kidwai Nagar");
  assert.equal(cleanStationName("Sadanand Nagar, Mehsana - Nexteng Enviro", "Mehsana"), "Sadanand Nagar");
  assert.equal(cleanStationName("Worli, Mumbai -MPCB", "Mumbai"), "Worli");
  assert.equal(cleanStationName("Polayathode, Kollam - Kerala PCB", "Kollam"), "Polayathode");
  assert.equal(cleanStationName("Bandhavgar Colony, Satna - Birla Cement", "Satna"), "Bandhavgar Colony");
});

test("cleanStationName is case-insensitive on city match", () => {
  assert.equal(cleanStationName("Place, delhi - something", "Delhi"), "Place");
});

test("cleanStationName preserves names without the pattern", () => {
  assert.equal(cleanStationName("Anand Vihar", "Delhi"), "Anand Vihar");
  assert.equal(cleanStationName("Silk Board", "Bengaluru"), "Silk Board");
  assert.equal(cleanStationName("Bandra Kurla Complex", "Mumbai"), "Bandra Kurla Complex");
});

test("cleanStationName preserves roman-numeral tails when city doesn't match", () => {
  assert.equal(cleanStationName("Knowledge Park - V", "Greater Noida"), "Knowledge Park - V");
  assert.equal(cleanStationName("Knowledge Park - III", "Greater Noida"), "Knowledge Park - III");
});

test("cleanStationName handles name-city mismatch via generic step", () => {
  // s.city = "New Delhi" but name embeds "Delhi" — city step can't match.
  assert.equal(cleanStationName("Mundka, Delhi - DPCC", "New Delhi"), "Mundka");
  assert.equal(cleanStationName("NSIT Dwarka, Delhi - CPCB", "New Delhi"), "NSIT Dwarka");
});

test("cleanStationName handles no-space dash (' -MPCB')", () => {
  assert.equal(cleanStationName("Worli, Mumbai -MPCB", "Mumbai"), "Worli");
});

test("cleanStationName handles multi-word agency tails", () => {
  assert.equal(cleanStationName("GIDC, Nandesari - Nandesari Ind. Association"), "GIDC");
  assert.equal(cleanStationName("Bandhavgar Colony, Satna - Birla Cement"), "Bandhavgar Colony");
  assert.equal(cleanStationName("Shasthri Nagar, Ratlam - IPCA Lab"), "Shasthri Nagar");
});

test("cleanStationName never returns empty", () => {
  // Pathological input that might strip everything.
  assert.equal(cleanStationName(", Delhi - DPCC", "Delhi"), ", Delhi - DPCC");
});

test("cleanStationName falls back to regex when city is missing", () => {
  assert.equal(cleanStationName("Ratandeep Housing Society, Solapur - MPCB"), "Ratandeep Housing Society");
  assert.equal(cleanStationName("Anand Vihar"), "Anand Vihar");
});
