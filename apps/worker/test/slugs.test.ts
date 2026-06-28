import { test } from "node:test";
import assert from "node:assert/strict";
import { placeBySlug, slugForName, allSlugPlaces } from "../src/slugs";
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

test("sitemap: lists the named /c/{slug} place pages (keyword URLs)", () => {
  const xml = sitemapXml("https://mugilu.live");
  assert.match(xml, /<loc>https:\/\/mugilu\.live\/c\/lucknow<\/loc>/);
  assert.match(xml, /<loc>https:\/\/mugilu\.live\/c\/bengaluru<\/loc>/);
  assert.doesNotMatch(xml, /c\/12\.97,77\.59/); // coordinate URLs are no longer the sitemap surface
});
