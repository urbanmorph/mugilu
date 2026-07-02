import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAbout, renderMethodology } from "../src/page";

test("renderMethodology: glass-box thresholds page with named sources", () => {
  const html = renderMethodology();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /Ambient/);
  assert.match(html, /CPCB/); // a source is named
  assert.match(html, /WBGT/);
  assert.match(html, /301\+/); // the air severe threshold is public
  assert.match(html, /not for medical/); // the disclaimer rides along
  assert.match(html, /How mugilu works: the Ambient read explained/); // page title (SEO)
});

test("renderAbout: origin story + dual nature (people + infrastructure), credited", () => {
  const html = renderAbout();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /open sky of India/i);
  // the origin story: Sathya consolidating scattered work into infrastructure
  assert.match(html, /Sathya Sankaran/);
  assert.match(html, /infrastructure/i);
  assert.match(html, /Build on it/i);
  // for people: official warnings + the worst thing for you
  assert.match(html, /official warning/i);
  assert.match(html, /asthma/i);
  // open + honest + credited
  assert.match(html, /MIT/);
  assert.match(html, /non-commercial/i);
  assert.match(html, /CPCB|OpenAQ|IMD|NDMA/);
  // built-by block: urbanmorph + the GitHub star prompt
  assert.match(html, /urbanmorph/i);
  assert.match(html, /GitHub/);
  // disclaimer always present
  assert.match(html, /not for medical/i);
});

test("renderAbout: FAQPage structured data, mirrored by visible Q&A (AEO)", () => {
  const html = renderAbout();
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"Question"/);
  assert.match(html, /"acceptedAnswer"/);
  assert.match(html, /Common questions/); // the visible section so schema matches content
  assert.match(html, /wet-bulb/i); // a real answer renders (visible + in schema)
  assert.match(html, /Is mugilu free/);
});
