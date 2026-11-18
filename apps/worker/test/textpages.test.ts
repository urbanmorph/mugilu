import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderAbout } from "../src/pages/about";
import { renderMcpPage } from "../src/pages/mcp";
import { renderMethodology } from "../src/pages/methodology";
import { renderTerms } from "../src/pages/terms";

// The text pages on the signage design (supporting-docs/redesign): Sheet sections in boxes,
// every sentence the live text, whole. test/fixtures/live-text.json holds the live English
// pages as sentences (scripts/live-text.ts, from mugilu.live before the redesign).
const LIVE: Record<string, string[]> = JSON.parse(readFileSync("test/fixtures/live-text.json", "utf8"));
const PAGES = { about: renderAbout, methodology: renderMethodology, terms: renderTerms, mcp: renderMcpPage };

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
/** The visible text with every non-letter/digit removed: a live "Label: body" line still
 *  matches when the label becomes a card title above its body. */
const compact = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "");
const visible = (html: string) =>
  compact(decode(html.replace(/<(script|style|svg|head)\b[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ")));

for (const [page, render] of Object.entries(PAGES)) {
  test(`${page}: every live sentence is on the redesigned page, whole`, () => {
    const text = visible(render("en"));
    const missing = LIVE[page].filter((s) => !text.includes(compact(s)));
    assert.deepEqual(missing, []);
  });

  test(`${page}: the signage shell, a Sheet with numbered sections, no page CSS of its own`, () => {
    const html = render("en");
    assert.match(html, /<body class="mg"/);
    assert.match(html, /<main id="main"/);
    assert.match(html, /<article class="sheet">/);
    assert.match(html, /<section class="tsec" id="[a-z]+" aria-labelledby="[a-z]+-h">/);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.equal((html.match(/<style>/g) ?? []).length, 1); // tokens + standard only
    assert.doesNotMatch(html, /class="(ahero|atext|alist|adisc|aback)"/); // the old layout is gone
    assert.match(html, /Informational only, not for medical, emergency, or safety-critical decisions\./);
    assert.match(html, /<p class="back"><a href="\/">← back to mugilu<\/a><\/p>/);
    const nav = html.match(/<nav class="nav" aria-label="Main">([\s\S]*?)<\/nav>/)?.[1] ?? "";
    for (const p of ["/places", "/warnings", "/display", "/methodology", "/about"])
      assert.match(nav, new RegExp(`href="${p}"`), `${page} nav ${p}`);
  });
}

test("signage shell: the iOS install sheet stays closed until Install app opens it (a modal)", () => {
  const html = renderAbout("en");
  assert.match(html, /<dialog class="isheet" id="install-guide"/);
  assert.match(html, /\.mg dialog\.isheet:not\(\[open\]\)\{display:none\}/);
  assert.match(html, /\.mg dialog\.isheet\[open\]\{position:fixed/);
  // the hidden attribute wins over a component's display (Install app, the alert states)
  assert.match(html, /<button type="button" class="btn" id="install-app" hidden>/);
  assert.match(html, /\.mg \[hidden\]\{display:none!important\}/);
});

test("text pages: no slot leaks and no English fallback for the reviewed paragraphs in hi and kn", () => {
  for (const lang of ["hi", "kn"] as const) {
    const pages = [renderAbout(lang), renderMethodology(lang), renderTerms(lang)];
    for (const html of pages) assert.doesNotMatch(html, /\{(score|terms|repo|um|bl|md|mcp|llms|oaq|era5)\}/, lang);
    const all = pages.join("");
    // sentences of split paragraphs, each only in English if the split fell back
    for (const en of [
      "Type a place.",
      "mugilu owns no sensors and runs no forecasts.",
      "The sky over you is a commons.",
      "Averaging would hide the thing that matters",
      "The persona is a toggle",
      "It shows only when the two are 3 °C or more apart.",
      "There is no accuracy or availability guarantee.",
      "The data is not relicensed",
      "Your saved places live only in your own browser.",
    ])
      assert.ok(!all.includes(en), `${lang}: "${en}" fell back to English`);
  }
});

test("text pages: every split paragraph fills its boxes in every language (no fallback to one block)", () => {
  const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
  for (const lang of ["en", "hi", "kn"] as const) {
    // About: "That is mugilu.", the people line, the sources opener, the commons line.
    assert.equal(count(renderAbout(lang), /<p class="pull">/g), 4, `about ${lang}`);
    // How it works: the never-average line and the persona line; the note and normal in cards.
    const m = renderMethodology(lang);
    assert.equal(count(m, /<p class="pull">/g), 2, `methodology ${lang}`);
    assert.equal(count(m, /<div class="card( quiet)?">/g), 2 + 3 + 3 + 2, `methodology cards ${lang}`);
    assert.match(m, /<p class="t-meta lead2">/, `methodology lead2 ${lang}`);
    // Terms: the warranty in three parts, privacy in five labelled rows.
    const tm = renderTerms(lang);
    assert.match(tm, /<div class="warnbox"><p class="head">.*?<\/p><p>.*?<\/p><p>.*?<\/p><\/div>/, `terms ${lang}`);
    assert.equal(count(tm, /<dt>/g), 5, `terms privacy ${lang}`);
  }
});

test("methodology: the thresholds as a table with level-filled headers, the 0-3 strip, links kept", () => {
  const html = renderMethodology("en");
  assert.match(
    html,
    /<th scope="col" class="fill moderate"><svg class="shape"[^>]*><path d="[^"]*"\/><\/svg>Moderate<\/th>/,
  );
  assert.match(html, /<th scope="row">Fog \(visibility, m\)<\/th><td>&lt;1000<\/td>/);
  assert.match(html, /<th scope="row">Smoke \(fires &lt;100 km\)<\/th>/);
  assert.match(
    html,
    /<div class="levels" aria-hidden="true">(<div class="fill (low|moderate|high|severe)">.*?<\/div>){4}<\/div>/,
  );
  assert.match(
    html,
    /href="https:\/\/github\.com\/urbanmorph\/mugilu\/blob\/main\/apps\/worker\/src\/score\.ts">score\.ts<\/a>/,
  );
  assert.match(html, /<a href="\/terms">terms &amp; attribution<\/a>/);
  assert.match(html, /class="tscroll" role="region" tabindex="0"/); // scrolls in its own region at 320
});

test("terms: the warranty box, the licence boxes, a box per source, privacy as labelled rows", () => {
  const html = renderTerms("en");
  assert.match(html, /<div class="warnbox"><p class="head">.*<b>Informational and educational only/);
  assert.match(
    html,
    /<b>code is MIT<\/b> \(see the <a href="https:\/\/github\.com\/urbanmorph\/mugilu">repository<\/a>\)\./,
  );
  assert.equal((html.match(/<div class="card">/g) ?? []).length, 2 + 8); // licence pair + 8 sources
  for (const k of ["Accounts", "Usage counts", "Analytics", "Saved places", "Alerts"])
    assert.match(html, new RegExp(`<dt>${k}</dt>`));
});

test("about: Build on it as four cards with their links, the FAQ grid, the credit", () => {
  const html = renderAbout("en");
  for (const href of ["/mcp", "/llms.txt", "/openapi.json", "/embed/12.97,77.59", "/display"])
    assert.ok(html.includes(`href="${href}"`), href);
  assert.match(html, /<dl class="faq">/);
  assert.match(html, /<div class="credit"><img /);
  assert.match(html, /<span lang="kn">ಮುಗಿಲು<\/span>/);
  assert.match(html, /font-family:'Anek Kannada'/); // the font for the Kannada word
});

test("mcp: the address, a card per client, a card per tool from the server's own list", () => {
  const html = renderMcpPage("en");
  assert.match(html, /<div class="addr"><code>https:\/\/mugilu\.live\/mcp<\/code><\/div>/);
  assert.match(html, /<div class="cards c1">/);
  assert.match(
    html,
    /<code>nearest_stations<\/code><\/p><p>The nearest real \(measured\) air-quality monitoring stations to a place/,
  );
});
