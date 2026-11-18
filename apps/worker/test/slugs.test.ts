import { test } from "node:test";
import assert from "node:assert/strict";
import {
  placeBySlug,
  slugForName,
  allSlugPlaces,
  slugPlacesByState,
  siblingPlaces,
  slugLabel,
  slugFromPath,
} from "../src/slugs";
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

test("slugLabel: a place whose state has the same name is said once (Delhi, not Delhi, Delhi)", () => {
  assert.equal(slugLabel({ name: "Delhi", state: "Delhi" } as never), "Delhi");
  assert.equal(slugLabel({ name: "Chandigarh", state: "Chandigarh" } as never), "Chandigarh");
  assert.equal(slugLabel({ name: "New Delhi", state: "Delhi" } as never), "New Delhi, Delhi");
  assert.equal(slugLabel({ name: "Leh" } as never), "Leh");
});

test("slugs: every slug in the sitemap is one the /c/ route accepts (24 Parganas starts with a digit)", () => {
  // the route took only letter-first slugs, so /c/24-paraganas-north was listed in the sitemap but answered 404
  for (const p of allSlugPlaces()) assert.equal(slugFromPath(`/c/${p.slug}`)?.slug, p.slug, p.slug);
  assert.deepEqual(slugFromPath("/c/24-paraganas-north.json"), { slug: "24-paraganas-north", ext: "json" });
  // coordinates and anything else stay out
  assert.equal(slugFromPath("/c/12.97,77.59"), null);
  assert.equal(slugFromPath("/c/-bad"), null);
  assert.equal(slugFromPath("/c/Delhi"), null);
});

test("slugs: the 24 Parganas districts answer to the names people search, on the LGD slugs", () => {
  for (const q of [
    "North 24 Parganas",
    "north 24 parganas",
    "North 24-Parganas",
    "24 Parganas North",
    "24 Paraganas North",
  ])
    assert.equal(slugForName(q), "24-paraganas-north", q);
  for (const q of [
    "South 24 Parganas",
    "south 24 parganas",
    "South 24-Parganas",
    "24 Parganas South",
    "24 Paraganas South",
  ])
    assert.equal(slugForName(q), "24-paraganas-south", q);
  // the slugs themselves (in the sitemap and Search Console) stay as they are
  assert.equal(placeBySlug("24-paraganas-north")!.name, "24 Paraganas North");
  assert.equal(placeBySlug("north-24-parganas"), undefined);
  assert.ok(!allSlugPlaces().some((p) => p.slug.includes("parganas")));
});
