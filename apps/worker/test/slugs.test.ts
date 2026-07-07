import { test } from "node:test";
import assert from "node:assert/strict";
import { placeBySlug, slugForName, allSlugPlaces, slugPlacesByState, siblingPlaces } from "../src/slugs";
import { sitemapXml } from "../src/meta";

test("slugs: major cities get clean keyword slugs, not LGD district names", () => {
  const b = placeBySlug("bengaluru");
  assert.ok(b, "bengaluru resolves");
  assert.equal(b!.name, "Bengaluru"); // not "Bengaluru Urban"
  for (const s of ["mumbai", "delhi", "lucknow", "chennai", "hyderabad"]) {
    assert.ok(placeBySlug(s), `${s} resolves`);
  }
});

test("slugs: collisions are disambiguated by state, never silently wrong", () => {
  // "Aurangabad" exists in Maharashtra and Bihar — both reachable, neither guessed.
  assert.ok(placeBySlug("aurangabad-maharashtra"));
  assert.ok(placeBySlug("aurangabad-bihar"));
});

test("slugs: unknown slug resolves to nothing (route should 404)", () => {
  assert.equal(placeBySlug("nowhere-zzz"), undefined);
});

test("slugForName: resolves a place name to its slug (for the /go redirect)", () => {
  assert.equal(slugForName("Ludhiana"), "ludhiana");
  assert.equal(slugForName("Bengaluru"), "bengaluru");
  assert.equal(slugForName("Zzz Not A Place"), undefined);
});

test("allSlugPlaces: a substantial set (districts + seeded cities)", () => {
  assert.ok(allSlugPlaces().length > 700);
});

test("slugPlacesByState: every place grouped under its state, states + places A→Z", () => {
  const groups = slugPlacesByState();
  const total = groups.reduce((n, g) => n + g.places.length, 0);
  assert.equal(total, allSlugPlaces().length); // every place lands in exactly one group
  const states = groups.map((g) => g.state);
  assert.deepEqual(
    states,
    [...states].sort((a, b) => a.localeCompare(b)),
  ); // states A→Z
  const ka = groups.find((g) => g.state === "Karnataka");
  assert.ok(ka && ka.places.some((p) => p.slug === "bengaluru"));
  const names = ka!.places.map((p) => p.name);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b)),
  ); // places A→Z
});

test("siblingPlaces: nearby named pages in the same state, never the place itself", () => {
  const sibs = siblingPlaces("bengaluru", 6);
  assert.ok(sibs.length > 0 && sibs.length <= 6);
  assert.ok(sibs.every((p) => p.state === "Karnataka"));
  assert.ok(sibs.every((p) => p.slug !== "bengaluru"));
  assert.equal(siblingPlaces("nowhere-zzz").length, 0); // unknown slug → none
});

test("sitemap: lists the named /c/{slug} place pages (keyword URLs)", () => {
  const xml = sitemapXml("https://mugilu.live");
  assert.match(xml, /<loc>https:\/\/mugilu\.live\/c\/lucknow<\/loc>/);
  assert.match(xml, /<loc>https:\/\/mugilu\.live\/c\/bengaluru<\/loc>/);
  assert.doesNotMatch(xml, /c\/12\.97,77\.59/); // coordinate URLs are no longer the sitemap surface
});
