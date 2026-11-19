import { test } from "node:test";
import assert from "node:assert/strict";
import { siteHeader, embedCard, wordmark } from "../src/ui/components";
import { STANDARD_CSS } from "../src/ui/standard";
import { TOKENS_CSS } from "../src/ui/tokens";
import { BRAND } from "../src/palette";
import { faviconSvg } from "../src/icon";

// The brand is fixed: the live cloud mark in sky blue, and the wordmark "mugilu" in one
// font, lowercase, in every theme and language. UI type rules (caps, condensed) never touch it.

test("brand blue is the live sky blue, one value in both themes", () => {
  assert.equal(BRAND, "#0284c7");
  assert.match(TOKENS_CSS, /--brand:#0284c7/);
  assert.doesNotMatch(TOKENS_CSS, /\[data-theme="dark"\][^}]*--brand:/);
});

test("the wordmark: blue cloud mark plus a fixed-font lowercase name, kept out of translation", () => {
  const w = wordmark();
  assert.match(w, /<svg class="bm" aria-hidden="true" viewBox="0 0 64 64"><g fill="var\(--brand\)">/);
  assert.match(w, /<span class="wm" lang="en" translate="no">mugilu<\/span>$/);
});

test("header and embed use the wordmark, in every language", () => {
  for (const lang of ["en", "hi", "kn"] as const) {
    assert.ok(siteHeader("/", lang).includes(wordmark()), lang);
    const e = embedCard(
      { href: "https://mugilu.live/c/delhi", place: "Delhi", level: "low", headline: "", say: "", reads: [], asOf: "" },
      lang,
    );
    assert.ok(e.includes(wordmark()), lang);
  }
});

test("the wordmark's font is fixed and no brand rule uppercases or condenses it", () => {
  const wm = STANDARD_CSS.match(/\.mg \.wm\{[^}]*\}/)?.[0] ?? "";
  assert.match(wm, /font-family:'Anek Latin'/);
  assert.match(wm, /font-weight:700/);
  assert.match(wm, /font-stretch:100%/);
  assert.match(wm, /text-transform:none/);
  for (const sel of ["\\.brand", "\\.ebrand", "\\.kbrand"]) {
    const rule = STANDARD_CSS.match(new RegExp(`${sel}\\{[^}]*\\}`))?.[0] ?? "";
    assert.doesNotMatch(rule, /uppercase|font-stretch/, sel);
  }
});

test("the favicon uses the same blue and the same cloud", async () => {
  const svg = await faviconSvg().text();
  assert.match(svg, new RegExp(`fill="${BRAND}"`));
  assert.ok(svg.includes(wordmark().match(/<g fill="var\(--brand\)">(.*?)<\/g>/)![1]));
});

// Three weights: 800 for display (titles, section heads, the level plate, the big numbers),
// 600 for controls and labels, 400 for anything read. 700 is the wordmark's alone.
const DISPLAY_800 =
  /^(\.t-title|\.t-h2|\.t-plate|\.rrow \.num|\.kio \.ktile \.num|\.kio \.kname|\.kio \.kclock|\.cnum|\.ecard \.eamb)$/;
test("the stylesheet uses three weights, with 800 only on display and 700 only on the wordmark", () => {
  const rules = [...(TOKENS_CSS + STANDARD_CSS).matchAll(/([^{}]+)\{[^{}]*font-weight:(\d+)/g)];
  assert.ok(rules.length > 40);
  for (const [, sel, w] of rules) {
    const sels = sel.split(",").map((s) => s.replace(/\.mg /g, "").trim());
    if (w === "700") assert.deepEqual(sels, [".wm"], sel);
    else if (w === "800")
      assert.ok(
        sels.every((s) => DISPLAY_800.test(s)),
        `800 on ${sel}`,
      );
    else assert.ok(w === "400" || w === "600", `${w} on ${sel}`);
  }
});

test("the brand card: the wordmark is the one bold line, lowercase with the blue cloud", async () => {
  const { homeOgHtml } = await import("../src/og-html");
  const html = homeOgHtml();
  assert.doesNotMatch(html, /MUGILU/);
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.ok(atob(html.match(/base64,([^"]+)"/)![1]).includes(`fill="${BRAND}"`));
  assert.match(html, /font-weight:700;[^"]*">mugilu</);
  const heavy = [...html.matchAll(/font-weight:(\d+)/g)].map((m) => +m[1]).filter((w) => w > 400);
  assert.deepEqual(heavy, [700]);
});

test("share images: the bar and the foot are regular weight", async () => {
  const { homeOgHtml } = await import("../src/og-html");
  const html = homeOgHtml();
  assert.doesNotMatch(html, /font-size:26px;font-weight:800/);
  assert.doesNotMatch(html, /font-weight:800;color:#111111/);
});
