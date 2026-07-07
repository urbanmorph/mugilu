import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPlaces } from "../src/page";

test("renderPlaces: a directory that links every named place, grouped by state", () => {
  const html = renderPlaces();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/places">/);
  assert.match(html, /<h2>Karnataka<\/h2>/); // a state heading
  assert.match(html, /<a href="\/c\/bengaluru">Bengaluru<\/a>/); // canonical slug links
  assert.match(html, /<a href="\/c\/lucknow">Lucknow<\/a>/);
  // it's the crawl surface: hundreds of internal links to the place pages
  const links = (html.match(/href="\/c\/[a-z]/g) || []).length;
  assert.ok(links > 700, `expected 700+ place links, got ${links}`);
});

test("renderPlaces: describes itself for search (title + meta description)", () => {
  const html = renderPlaces();
  assert.match(html, /<title>[^<]*India[^<]*<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*India/);
});
