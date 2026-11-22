import { test } from "node:test";
import assert from "node:assert/strict";
import { historyPanel, nearestRecordLine } from "../src/ui/history";
import { METRO_KM, recordNear, placeBySlug, slugForName, titleName } from "../src/slugs";
import { BORROW_MAX_KM } from "../src/placedaily";
import type { PlaceTrend } from "../src/placedaily";

// History for a point with no record of its own (supporting-docs/READING_SENTENCES_SPEC.md,
// section 9): the nearest named place's record within BORROW_MAX_KM of its centre, the panel
// naming that place in every sentence; beyond, one line to the nearest place with a record.

const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 21 + i)).toISOString().slice(0, 10));
const flat = (v: number | null) => Array<number | null>(30).fill(v);
const TR: PlaceTrend = {
  days,
  stations: 2,
  air: flat(150),
  fires: flat(0),
  feels_max: flat(30),
  feels_min: flat(15),
  rain_mm: flat(0),
  gust_kmh: flat(20),
  uv_max: flat(5),
  vis_min_m: flat(5000),
  dust_max: flat(40),
};
const ALMORA = placeBySlug("almora")!;
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");

test("recordNear: the named place whose centre is closest, and how far", () => {
  const n = recordNear(ALMORA.lat + 0.1, ALMORA.lon)!;
  assert.equal(n.place.slug, "almora");
  assert.ok(n.km > 10 && n.km < 12, String(n.km));
  assert.equal(BORROW_MAX_KM, 25, "the record's own air radius");
});

test("borrowed panel: headed and told by the place it belongs to, never 'here'", () => {
  const html = historyPanel(TR, "en", "/c/almora/trends", { place: ALMORA, name: "Almora", km: 11.1 });
  const s = text(html);
  assert.match(s, /Last 30 days in Almora/);
  assert.match(s, /This is the record for Almora, 11 km from this point\./);
  assert.match(s, /Air uses the stations within 25 km of the centre of Almora\./);
  assert.match(html, /href="\/c\/almora"/);
  assert.match(html, /href="\/c\/almora\/trends"/);
  assert.doesNotMatch(s, /\bhere\b|this place/i);
  for (const lang of ["hi", "kn"] as const) {
    const t = text(historyPanel(TR, lang, "/c/almora/trends", { place: ALMORA, name: "अल्मोड़ा", km: 11.1 }));
    assert.doesNotMatch(t, /record for|Air uses|Last 30 days in/);
    assert.match(t, /अल्मोड़ा/);
  }
});

test("too far to borrow: one line to the nearest place with a record", () => {
  const html = nearestRecordLine({ place: ALMORA, name: "Almora", km: 38 }, "en");
  assert.match(text(html), /The nearest place with a daily record is Almora, 38 km away\./);
  assert.match(html, /href="\/c\/almora"/);
  assert.match(nearestRecordLine({ place: ALMORA, name: "Almora", km: 38 }, "kn"), /href="\/kn\/c\/almora"/);
});

test("recordNear: a point inside a big city borrows the city's record, not a nearer district's", () => {
  const at = (slug: string) => recordNear(placeBySlug(slug)!.lat, placeBySlug(slug)!.lon)!;
  // Each district centre below is nearer itself than the city, but sits inside the city.
  assert.equal(at("bengaluru-urban").place.slug, "bengaluru");
  assert.equal(at("mumbai-suburban").place.slug, "mumbai");
  assert.equal(at("east").place.slug, "delhi");
  assert.ok(at("east").km > 8 && at("east").km < 10, "the distance is to the city's centre");
  // Beyond METRO_KM of a city's centre, the nearest place's own record, as before.
  assert.equal(METRO_KM, 15);
  assert.equal(at("south-west").place.slug, "south-west", "Delhi's centre is 24 km away");
  assert.equal(at("cuttack").place.slug, "cuttack", "Bhubaneswar is 22 km away");
});

test("Delhi's districts are named as Delhi writes them, under their old slugs", () => {
  assert.equal(placeBySlug("east")!.name, "East Delhi");
  assert.equal(placeBySlug("south-west")!.name, "South West Delhi");
  assert.equal(placeBySlug("new-delhi")!.name, "New Delhi");
  assert.equal(titleName(placeBySlug("east")!), "East Delhi", "the state is in the name already");
  assert.equal(slugForName("East Delhi"), "east");
  assert.equal(slugForName("north-east delhi"), "north-east");
});
