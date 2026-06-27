import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAbout } from "../src/page";

test("renderAbout: person/health-led positioning, differentiation made plain", () => {
  const html = renderAbout();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /open sky of India/i); // tagline C
  // leads with the human/whole-sky framing, not infra
  assert.match(html, /official warning/i);
  assert.match(html, /for <b>you<\/b>/i);
  // the differentiation (A & B substance)
  assert.match(html, /Neither shows both/i);
  assert.match(html, /stitches it back together/i);
  // open + honest + credited
  assert.match(html, /MIT/);
  assert.match(html, /non-commercial/i);
  assert.match(html, /CPCB|OpenAQ|IMD|NDMA/);
  // disclaimer always present
  assert.match(html, /not for medical/i);
});
