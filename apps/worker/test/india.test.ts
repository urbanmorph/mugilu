import { test } from "node:test";
import assert from "node:assert/strict";
import { inIndia } from "../src/india";
import { parseLatLon } from "../src/near";
import { buildSuggestions, parseCoordQuery } from "../src/suggest";
import { resolveQuery } from "../src/resolve";

// India's edges (islands, high Himalaya, the Rann) and its neighbours' cities.
const INDIA: [string, number, number][] = [
  ["Indira Point", 6.75, 93.84],
  ["Minicoy", 8.28, 73.05],
  ["Car Nicobar", 9.17, 92.82],
  ["Siachen", 35.4, 77.1],
  ["Demchok", 32.7, 79.45],
  ["Kibithu", 28.28, 97.02],
  ["Kutch, Guhar Moti", 23.7, 68.2],
  ["Kanyakumari", 8.08, 77.55],
  ["Bengaluru", 12.97, 77.59],
];
const ABROAD: [string, number, number][] = [
  ["Paris", 48.85, 2.35],
  ["Colombo", 6.93, 79.86],
  ["Jaffna", 9.66, 80.01],
  ["Lahore", 31.52, 74.36],
  ["Karachi", 24.86, 67.0],
  ["Kathmandu", 27.7, 85.32],
  ["Thimphu", 27.47, 89.64],
  ["Dhaka", 23.81, 90.41],
  ["Male", 4.17, 73.51],
  ["Arabian Sea", 15.0, 70.0],
];

test("inIndia: India's edges are in, its neighbours and the open sea are out", () => {
  for (const [n, lat, lon] of INDIA) assert.equal(inIndia(lat, lon), true, n);
  for (const [n, lat, lon] of ABROAD) assert.equal(inIndia(lat, lon), false, n);
});

test("every coordinate input is India only: a foreign point is refused, never given an Indian name", async () => {
  // Paris was "Muzaffarabad, Jammu & Kashmir": no input may carry it that far.
  assert.equal(parseLatLon("48.85", "2.35"), null);
  assert.deepEqual(parseLatLon("12.97", "77.59"), { lat: 12.97, lon: 77.59 });
  assert.equal(parseCoordQuery("48.85,2.35"), null); // a coordinate, but refused
  assert.equal(parseCoordQuery("Paris"), undefined); // not a coordinate: search it
  assert.equal(await resolveQuery("48.85,2.35"), null);
  const none = async () => [];
  assert.deepEqual(await buildSuggestions([], "51.5,-0.12", none), []);
});
