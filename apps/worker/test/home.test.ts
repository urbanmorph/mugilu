import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHome } from "../src/page";

test("renderHome: a valid HTML doc with the brand and a search form to /go", () => {
  const html = renderHome();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /mugilu/);
  assert.match(html, /action="\/go"/);
  assert.match(html, /method="get"/i);
  assert.match(html, /name="q"/);
});

test("renderHome: includes city quick-links to /c", () => {
  const html = renderHome();
  assert.match(html, /\/c\/12\.97,77\.59/); // Bengaluru
  assert.match(html, /Delhi/);
});

test("renderHome: near-me is progressive enhancement (geolocation)", () => {
  assert.match(renderHome(), /geolocation/);
});

test("renderHome: near-me resets on bfcache restore (pageshow), not stuck on 'Locating…'", () => {
  assert.match(renderHome(), /pageshow/);
});

test("renderHome: shows a not-found notice for a failed search", () => {
  assert.match(renderHome("zzzxx"), /zzzxx/);
  assert.doesNotMatch(renderHome(), /zzzxx/);
});

test("renderHome: search box wired to the /suggest typeahead", () => {
  const html = renderHome();
  assert.match(html, /\/suggest/);
  assert.match(html, /id="ac"/);
  assert.match(html, /id="q"/);
});

test("renderHome: family footer present", () => {
  const html = renderHome();
  assert.match(html, /pdgi\.org/);
  assert.match(html, /urbanmorph/);
});
