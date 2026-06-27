import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAbout } from "../src/page";

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
