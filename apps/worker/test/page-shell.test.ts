import { test } from "node:test";
import assert from "node:assert/strict";
import { pageShell } from "../src/ui/page-shell";
import { SITE_CSS_LINK } from "../src/ui/assets";
import { withCss } from "./helpers/css";
import { DISCLAIMER_FULL } from "../src/ui/components";

// The signage page shell: the one site stylesheet, the standard's landmarks, the theme.

const page = pageShell("Warnings", "<p>body</p>", {
  path: "/warnings",
  canonical: "https://mugilu.live/warnings",
  tint: { hue: "Warning", level: "high" },
});

test("pageShell: the one cached site stylesheet, nothing page-specific", () => {
  assert.equal(page.split(SITE_CSS_LINK).length - 1, 1);
  assert.doesNotMatch(page, /<style>/);
});

test("pageShell: the embed card inlines only the rules its markup uses, with no web font", () => {
  const card = pageShell("c", '<a class="ecard"><p class="t-kicker">x</p></a>', { path: "/embed", variant: "embed" });
  assert.doesNotMatch(card, /assets\/site-|rel="preload"|@font-face/);
  assert.match(card, /<style>[^<]*\.mg[^<]*<\/style>/);
  assert.doesNotMatch(card, /\.kio\b/, "no screen-display rules in a card");
});

test("pageShell: skip link, header, one main with id, footer with the disclaimer", () => {
  assert.match(page, /<body class="mg" data-tint="Warning" data-level="high">/);
  assert.ok(page.indexOf('class="skip" href="#main"') < page.indexOf('<main id="main"'));
  assert.equal((page.match(/<main\b/g) ?? []).length, 1);
  assert.match(page, /<main id="main" tabindex="-1"><p>body<\/p><\/main>/);
  assert.ok(page.includes(DISCLAIMER_FULL));
  assert.match(page, /<link rel="canonical" href="https:\/\/mugilu\.live\/warnings">/);
});

test("pageShell: the stored theme applies before paint; scripts for theme, install, offline, time", () => {
  const head = page.slice(0, page.indexOf("</head>"));
  assert.match(head, /localStorage\.getItem\('mugilu-theme'\)/);
  assert.match(page, /input\[name=theme\]/);
  assert.match(page, /install-app/);
  assert.match(page, /time\[data-rel\]/);
});

test("pageShell: no tint means no wash; a kiosk is always dark, chromeless, with data-kiosk", () => {
  assert.match(pageShell("x", "", { path: "/" }), /<body class="mg">/);
  const k = pageShell("Delhi", '<div class="kio"></div>', { path: "/c/delhi", variant: "kiosk" });
  assert.match(k, /<html lang="en" data-theme="dark">/);
  assert.match(k, /<body class="mg" data-kiosk>/);
  assert.ok(!/class="sh"/.test(k) && !/class="sf"/.test(k));
  assert.match(k, /<main id="main" tabindex="-1"><div class="kio">/);
});

test("fonts: self-hosted (no third-party requests), the Latin face preloaded, Indic faces optional", () => {
  const h = withCss(pageShell("t", "<p>x</p>", { path: "/warnings", lang: "hi" }));
  assert.doesNotMatch(h, /fonts\.googleapis|fonts\.gstatic/);
  assert.match(h, /<link rel="preload" href="\/fonts\/anek-latin-2\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.match(
    h,
    /@font-face\{font-family:'Anek Latin';src:url\(\/fonts\/anek-latin-2\.woff2\) format\('woff2'\);font-weight:400 800;font-stretch:75% 100%;font-display:swap;unicode-range:/,
  );
  assert.match(
    h,
    /@font-face\{font-family:'Anek Devanagari';src:url\(\/fonts\/anek-devanagari-2\.woff2\)[^}]*font-display:optional/,
  );
});
