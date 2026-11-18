import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bandChip,
  DISCLAIMER_FULL,
  langSwitch,
  levelChip,
  searchBox,
  segmented,
  shape,
  SHAPE,
  siteFooter,
  siteHeader,
  THEME_HEAD_JS,
  THEME_JS,
} from "../src/ui/components";

// The design standard's components: markup, accessibility attributes, escaping, i18n.

test("shape: an aria-hidden svg with the shape's path; severe's octagon has the knocked-out bar", () => {
  assert.match(shape("circle"), /^<svg class="shape" aria-hidden="true"[^>]*><path d="M12 2a10/);
  assert.match(SHAPE.octagon, /M5\.5 10\.25v3\.5h13v-3\.5z$/);
});

test("levelChip: shape + word + level class; the word is translated", () => {
  const c = levelChip("high", "en");
  assert.match(c, /^<span class="chip high"><svg[^>]*><path d="M12 2 23 21H1z"\/><\/svg>High<\/span>$/);
  assert.match(levelChip("severe", "hi"), /class="chip severe"/);
  assert.ok(levelChip("low", "en").includes(SHAPE.circle), "a no-hazard reading is Low, a circle");
});

test("bandChip: the band's shape and an escaped word; an unknown band is a dash", () => {
  assert.match(bandChip("vpoor", "Very Poor"), /class="chip b-vpoor"/);
  assert.ok(bandChip("vpoor", "x").includes(SHAPE.octagon));
  assert.ok(bandChip("nonsense", "<b>").includes(SHAPE.dash));
  assert.ok(bandChip("good", "<b>").includes("&lt;b&gt;"));
});

test("siteHeader: skip link first, brand, install, nav with the current page, the language landmark", () => {
  const h = siteHeader("/warnings", "en");
  assert.match(h, /^<header class="sh"><a class="skip" href="#main">Skip to content<\/a>/);
  assert.ok(h.indexOf("brand") < h.indexOf("install-app") && h.indexOf("install-app") < h.indexOf('class="nav"'));
  assert.match(h, /<a href="\/warnings" aria-current="page">Warnings<\/a>/);
  assert.match(h, /<a href="\/display">Put this on a screen<\/a>/);
  assert.match(h, /<nav class="langs" aria-label="Language">/);
  assert.match(h, /class="btn" id="install-app" hidden/);
  assert.match(siteHeader("/warnings", "hi"), /href="\/hi\/warnings" aria-current="page"/);
});

test("langSwitch: the current language bold, the others path-only links in their own script", () => {
  const s = langSwitch("/c/delhi", "en", "footer");
  assert.match(s, /^<div class="flangs" role="group" aria-label="Language"><b>English<\/b>/);
  assert.match(s, /<a href="\/hi\/c\/delhi" lang="hi" hreflang="hi">/);
  assert.match(s, /<a href="\/kn\/c\/delhi" lang="kn" hreflang="kn">/);
});

test("siteFooter: links, language group, theme switch (System by default) and the full disclaimer", () => {
  const f = siteFooter("/terms", "en");
  assert.match(f, /<a href="\/terms" aria-current="page">terms<\/a>/);
  assert.match(f, /href="https:\/\/github\.com\/urbanmorph\/mugilu">code<\/a>/);
  assert.match(f, /<legend class="flabel">Theme<\/legend>/);
  assert.match(f, /<input type="radio" name="theme" value="system" checked>System/);
  assert.ok(f.includes(`<p class="disc">${DISCLAIMER_FULL}</p>`));
  assert.ok(!/—/.test(f));
});

test("segmented: native radios in a fieldset with a legend; href options carry data-href; values escaped", () => {
  const s = segmented("as", "Who is this for", [
    { value: "everyone", label: "Everyone", checked: true, href: "/c/delhi" },
    { value: "asthma", label: "Asthma & lungs", href: "/c/delhi?as=asthma" },
  ]);
  assert.match(s, /^<fieldset class="segf"><legend class="t-kicker">Who is this for<\/legend><div class="seg">/);
  assert.match(s, /value="everyone" checked data-href="\/c\/delhi">Everyone/);
  assert.match(s, /Asthma &amp; lungs/);
});

test("searchBox: the ARIA combobox pattern, a polite status line, and the place lookup", () => {
  const s = searchBox({
    id: "q",
    label: "Look up a place in India",
    placeholder: "A place in India, or lat,lon",
    action: "/go",
  });
  assert.match(
    s,
    /<form class="search" role="search" aria-label="Look up a place in India" action="\/go" method="get">/,
  );
  assert.match(s, /role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="q-list"/);
  assert.match(s, /<ul class="ac" role="listbox" id="q-list"[^>]*hidden>/);
  assert.match(s, /aria-live="polite" id="q-status"/);
  assert.match(s, /name="q"/);
});

test("theme scripts: stored choice applied before paint; storage guarded", () => {
  assert.match(THEME_HEAD_JS, /try\{[^}]*localStorage\.getItem\('mugilu-theme'\)/);
  assert.match(THEME_JS, /removeAttribute\('data-theme'\)/);
  assert.match(THEME_JS, /try\{i\.value==='system'\?localStorage\.removeItem/);
});
