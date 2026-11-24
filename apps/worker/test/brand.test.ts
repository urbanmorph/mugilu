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

test("the brand card's URL carries a hash of its content, so a changed card is a new URL", async () => {
  const { homeOgHtml, HOME_OG, HOME_OG_VERSION } = await import("../src/og-html");
  const { fnv1a } = await import("../src/ui/assets");
  assert.equal(HOME_OG_VERSION, fnv1a(homeOgHtml()));
  assert.equal(HOME_OG, `https://mugilu.live/og.png?v=${HOME_OG_VERSION}`);
  const { testWorker } = await import("./helpers/worker");
  const html = await (await testWorker().get("/about", { headers: { accept: "text/html" } })).text();
  assert.ok(html.includes(`<meta property="og:image" content="${HOME_OG}">`));
});

test("the light theme's focus ring is the brand blue itself, not a copy of its value", async () => {
  const { NEUTRAL } = await import("../src/palette");
  assert.equal(NEUTRAL.light.focus, BRAND);
  const src = (await import("node:fs")).readFileSync(new URL("../src/palette.ts", import.meta.url), "utf8");
  assert.equal(src.match(/#0284c7/g)?.length, 1, "the brand hex is written once");
});

/** The stylesheets with every reduced-motion-gated block cut out. */
function ungated(css: string): string {
  const open = "@media (prefers-reduced-motion:no-preference){";
  let out = css.replace(/@media \(prefers-reduced-motion: no-preference\)\{/g, open);
  for (let i = out.indexOf(open); i >= 0; i = out.indexOf(open)) {
    let depth = 0;
    let j = i + open.length - 1;
    for (; j < out.length; j++) {
      if (out[j] === "{") depth++;
      else if (out[j] === "}" && --depth === 0) break;
    }
    out = out.slice(0, i) + out.slice(j + 1);
  }
  return out;
}

test("motion: every animation and keyframe-driven change runs only when the reader allows motion", () => {
  const rest = ungated(TOKENS_CSS + STANDARD_CSS);
  assert.doesNotMatch(rest, /animation:/, "an animation outside the reduced-motion gate");
});

test("reading cards: the icon takes its hazard's hue, a raised card its level, all from tokens", () => {
  assert.match(TOKENS_CSS, /--hz-heat:#f97316/);
  assert.match(TOKENS_CSS, /\.mg \.hz-heat\{--hz:var\(--hz-heat\)\}/);
  assert.match(TOKENS_CSS, /\.mg \.lv-moderate\{--rl:var\(--moderate\);--rt:var\(--rt-moderate\)\}/);
  assert.match(TOKENS_CSS, /\.mg \.lv-b-poor\{--rl:var\(--b-poor\);--rt:var\(--bt-poor\)\}/);
  assert.doesNotMatch(TOKENS_CSS, /\.lv-low\{|\.lv-b-good\{|\.lv-b-satisfactory\{/, "low stays neutral");
});
