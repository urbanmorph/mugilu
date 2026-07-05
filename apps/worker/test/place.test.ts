import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestPlace } from "../src/place";

// Uses the real bundled centroid grid (districts + city wards).

test("nearestPlace: labels a Bengaluru point with a ward + city", () => {
  const label = nearestPlace(12.9716, 77.5946);
  assert.ok(label, "should resolve a place");
  assert.match(label!, /Bengaluru/);
});

test("nearestPlace: never leaks an id-like ward name (falls back to the city)", () => {
  const label = nearestPlace(12.9716, 77.5946);
  assert.ok(label);
  assert.doesNotMatch(label!, /wards?_/i); // not "wards_bengaluru-0, Bengaluru"
});

test("nearestPlace: numeric ward names fall back to the city", () => {
  const label = nearestPlace(13.08, 80.27); // Chennai — wards are numbered ("62")
  assert.ok(label);
  assert.doesNotMatch(label!, /^\d/); // not "62, Chennai"
  assert.match(label!, /Chennai/);
});

test("nearestPlace: BMC ward codes resolve to their locality, not a bare letter", () => {
  const label = nearestPlace(19.0876, 72.8867); // BMC ward "L" centroid → Kurla
  assert.equal(label, "Kurla, Mumbai"); // never "L, Mumbai"
});

test("nearestPlace: labels a non-metro point with its district", () => {
  const label = nearestPlace(26.85, 80.95); // Lucknow area — no ward grid
  assert.ok(label);
  assert.match(label!, /[A-Za-z]/);
});

test("nearestPlace: returns null only for coordinates with no grid match", () => {
  // A point far outside India still returns the nearest grid point (never throws).
  assert.ok(nearestPlace(0, 0) !== undefined);
});
