import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPlaces } from "../src/page";
import type { WarningsSnapshot } from "../src/sachet";

test("renderPlaces: a directory that links every named place, a fold per state", () => {
  const html = renderPlaces();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<body class="mg">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/mugilu\.live\/places">/);
  assert.match(
    html,
    /<details class="fold" open id="st-karnataka"><summary>Karnataka<span class="n">\d+<\/span><\/summary>/,
  );
  assert.match(html, /<a href="\/c\/bengaluru">Bengaluru<\/a>/);
  const links = (html.match(/href="\/c\/[a-z]/g) || []).length;
  assert.ok(links > 700, `expected 700+ place links, got ${links}`);
});

test("renderPlaces: the live title, intro and count", () => {
  const html = renderPlaces();
  assert.match(html, /<h1 class="t-title">Every place, by state<\/h1>/);
  assert.match(html, /<p class="t-lead">The sky over every district and major city in India, one page each\./);
  assert.match(html, /<p class="stamp">\d{3} places across India<\/p>/);
});

test("renderPlaces: describes itself for search (title + meta description)", () => {
  const html = renderPlaces();
  assert.match(html, /<title>[^<]*India[^<]*<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*India/);
});

test("renderPlaces: find a place, and a state picker that is the keyboard path to the map", () => {
  const html = renderPlaces();
  assert.match(html, /<label for="pq">Find a place<\/label>/);
  assert.match(html, /<select id="ps" class="sel">/);
  assert.match(html, /<option value="st-karnataka">Karnataka<\/option>/);
});

test("renderPlaces: the map of India, states to click and a dot per place, as a sticky aside", () => {
  const html = renderPlaces();
  assert.match(html, /<div class="lane la"><div class="aside">/);
  assert.match(html, /<div class="imap places" data-layer="w">/);
  assert.match(html, /class="mstate" data-st="st-karnataka"/);
  assert.match(html, /Each dot is a place on mugilu\. Select a state to see its places\./);
  assert.match(html, /Admin boundaries: LGD, via bharatlas\./);
});

test("renderPlaces: places under an official cyclone warning are marked, never with a level colour", () => {
  const warnings: WarningsSnapshot = {
    generated_at: "2026-11-18T12:05:00Z",
    count: 1,
    alerts: [
      {
        identifier: "1",
        headline: "SEVERE CYCLONIC STORM AKVAN lays centred, Cyclone Warning for ASR, Anakapalli, Visakhapatnam.",
        category: "Met",
        issuer: "controlroom@ndma.gov.in (IMD Visakhapatnam)",
        link: "https://sachet.ndma.gov.in/x?identifier=1",
        sent: "Wed, 18 Nov 2026 11:17:00 GMT",
      },
    ],
  };
  const html = renderPlaces("en", { warnings });
  assert.match(html, /<section class="panel strong" aria-labelledby="uw"><h2 class="bar" id="uw">/);
  assert.match(html, /<span>Under an official warning now<\/span><\/h2>/);
  assert.match(html, /<b>Severe Cyclonic Storm Akvan<\/b> · IMD Visakhapatnam/);
  assert.match(html, /<a class="ptile warn" href="\/c\/anakapalli">/);
  assert.match(html, /<li><a href="\/c\/visakhapatnam">[^]*?<b>Visakhapatnam<\/b><\/a><\/li>/);
  assert.match(html, /<use href="#wmark"/);
  assert.doesNotMatch(renderPlaces(), /Under an official warning now<\/span><\/h2>/);
});
