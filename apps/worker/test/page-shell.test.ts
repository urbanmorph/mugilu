import { test } from "node:test";
import assert from "node:assert/strict";
import { pageShell } from "../src/ui/page-shell";
import { STANDARD_CSS } from "../src/ui/standard";
import { tokensCss } from "../src/ui/tokens";
import { DISCLAIMER_FULL } from "../src/ui/components";

// The signage page shell: exactly two stylesheets, the standard's landmarks, the theme.

const page = pageShell("Warnings", "<p>body</p>", {
  path: "/warnings",
  canonical: "https://mugilu.live/warnings",
  tint: { hue: "Warning", level: "high" },
});

test("pageShell: exactly the two stylesheets, nothing page-specific", () => {
  const styles = page.match(/<style>([\s\S]*?)<\/style>/g) ?? [];
  assert.equal(styles.length, 1);
  assert.equal(styles[0], `<style>${tokensCss()}${STANDARD_CSS}</style>`);
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

test("pageShell: fonts for the page's scripts only, with swap", () => {
  assert.match(page, /family=Anek\+Latin:wdth,wght@75\.\.100,400\.\.800&amp;display=swap/);
  assert.ok(!/Anek\+Kannada/.test(page));
  const kn = pageShell("x", "", { path: "/", lang: "kn" });
  assert.match(kn, /Anek\+Kannada/);
  assert.match(kn, /<html lang="kn">/);
  const te = pageShell("x", "", { path: "/warnings", scripts: ["te", "bn"] });
  assert.match(te, /Anek\+Telugu/);
  assert.match(te, /Anek\+Bangla/);
});

test("pageShell: no tint means no wash; a kiosk is always dark, chromeless, with data-kiosk", () => {
  assert.match(pageShell("x", "", { path: "/" }), /<body class="mg">/);
  const k = pageShell("Delhi", '<div class="kio"></div>', { path: "/c/delhi", kiosk: true });
  assert.match(k, /<html lang="en" data-theme="dark">/);
  assert.match(k, /<body class="mg" data-kiosk>/);
  assert.ok(!/class="sh"/.test(k) && !/class="sf"/.test(k));
  assert.match(k, /<main id="main" tabindex="-1"><div class="kio">/);
});

test("fonts: non-Latin scripts load the weight axis only (they are never condensed), Latin keeps its width", () => {
  const h = pageShell("t", "<p>x</p>", { path: "/warnings", lang: "hi", scripts: ["te", "bn"] });
  for (const fam of ["Anek+Devanagari", "Anek+Telugu", "Anek+Bangla"])
    assert.match(h, new RegExp(`family=${fam.replace("+", "\\+")}:wght@400\\.\\.800&`));
  assert.match(h, /family=Anek\+Latin:wdth,wght@75\.\.100,400\.\.800/);
});
