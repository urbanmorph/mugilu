import { test } from "node:test";
import assert from "node:assert/strict";
import { headOf, nextHeads, placeLastmods } from "../src/lastmod";
import { sitemapXml } from "../src/meta";
import { placeBySlug } from "../src/slugs";
import type { NormalizedStation } from "../src/types";

// Honest sitemap lastmod (supporting-docs/reports/mugilu search discovery plan.md): a place page's
// date is the day its headline last changed (its air band, or an official warning over it came or
// went); a trend page's is the day its state's trend file was last rebuilt (a new day was added).

const station = (lat: number, lon: number, band: NormalizedStation["band"]) =>
  ({ id: "s", provider: "cpcb", lat, lon, aqi: 120, band, pollutants: {}, ts: "" }) as unknown as NormalizedStation;
const BLR = placeBySlug("bengaluru")!;

test("headOf: the air band of the place's station within reach, and whether a warning covers it", () => {
  assert.equal(headOf(BLR, [station(BLR.lat, BLR.lon, "moderate")], new Set()), "moderate");
  assert.equal(headOf(BLR, [station(BLR.lat, BLR.lon, "poor")], new Set(["bengaluru"])), "poor|warned");
  assert.equal(headOf(BLR, [station(BLR.lat + 3, BLR.lon, "poor")], new Set()), "-", "no station within 50 km");
});

test("nextHeads: the date moves only when the headline changes; a place seen first has no date yet", () => {
  const first = nextHeads(null, { a: "moderate", b: "poor" }, "2026-11-22");
  assert.deepEqual(first.heads, { a: { s: "moderate", d: "" }, b: { s: "poor", d: "" } });
  assert.equal(first.changed, true);
  const same = nextHeads(first.heads, { a: "moderate", b: "poor" }, "2026-11-23");
  assert.equal(same.changed, false);
  const moved = nextHeads(first.heads, { a: "moderate", b: "poor|warned" }, "2026-11-24");
  assert.deepEqual(moved.heads.b, { s: "poor|warned", d: "2026-11-24" });
  assert.deepEqual(moved.heads.a, { s: "moderate", d: "" });
});

test("placeLastmods: places from the heads, trend pages from their state's trend file", () => {
  const dates = placeLastmods(
    { bengaluru: { s: "poor", d: "2026-11-30" }, udupi: { s: "good", d: "" } },
    { karnataka: "2026-12-01" },
  );
  assert.equal(dates["/c/bengaluru"], "2026-11-30");
  assert.equal(dates["/c/udupi"], undefined, "no change seen yet: the fixed date stands");
  assert.equal(dates["/c/udupi/trends"], "2026-12-01");
  assert.equal(dates["/c/bengaluru/trends"], "2026-12-01");
});

test("sitemap: a place's own date when later than the fixed date, never earlier", () => {
  const xml = sitemapXml("https://mugilu.live", { "/c/bengaluru": "2027-01-05", "/c/udupi": "2020-01-01" });
  const mod = (p: string) => xml.match(new RegExp(`<loc>https://mugilu\\.live${p}</loc><lastmod>([^<]+)<`))![1];
  assert.equal(mod("/c/bengaluru"), "2027-01-05");
  assert.equal(mod("/c/udupi"), mod("/about"));
});
