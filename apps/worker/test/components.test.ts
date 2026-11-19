import { test } from "node:test";
import assert from "node:assert/strict";
import { trusted } from "../src/html";
import {
  locateJs,
  alertsBox,
  band,
  bandChip,
  barRows,
  cards,
  checkGroup,
  dataTable,
  DISCLAIMER_FULL,
  DISCLAIMER_SHORT,
  embedCard,
  faq,
  fold,
  ico,
  lane,
  langSwitch,
  levelChip,
  linkRow,
  notice,
  pairs,
  panel,
  placeTile,
  plate,
  qrBlock,
  searchBox,
  segmented,
  segLinks,
  shape,
  SHAPE,
  sheet,
  siteFooter,
  siteHeader,
  stamp,
  THEME_HEAD_JS,
  THEME_JS,
  warningPlate,
  warningRow,
  yourPlacesSlot,
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

test("segmented: native radios in a fieldset with a legend; values escaped", () => {
  const s = segmented("layer", "Map layer", [
    { value: "w", label: "What's worst", checked: true },
    { value: "a", label: "Air & smoke" },
  ]);
  assert.match(s, /^<fieldset class="segf"><legend class="t-kicker">Map layer<\/legend><div class="seg">/);
  assert.match(s, /value="w" checked>What&#39;s worst|value="w" checked>What's worst/);
  assert.match(s, /Air &amp; smoke/);
  assert.doesNotMatch(s, /data-href/);
});

test("segLinks: a choice that opens a page is a set of links, the current one aria-current", () => {
  const s = segLinks("who", "Who is this for", [
    { label: "Everyone", href: "/c/delhi", current: true },
    { label: "Asthma & lungs", href: "/c/delhi?as=asthma" },
  ]);
  assert.match(s, /^<nav class="segf" aria-labelledby="who"><p class="t-kicker" id="who">Who is this for<\/p>/);
  assert.match(s, /<a href="\/c\/delhi" aria-current="page">Everyone<\/a>/);
  assert.match(s, /<a href="\/c\/delhi\?as=asthma">Asthma &amp; lungs<\/a>/);
  assert.doesNotMatch(s, /type="radio"/);
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

test("ico: decorative, stroked by default, filled for the filled set", () => {
  assert.match(ico("air"), /^<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 8c3/);
  assert.match(ico("pin"), /^<svg class="ico f"/);
});

test("band and lane: bands are full-width sections, lanes put items side by side", () => {
  assert.equal(
    band(lane("l2", ["<a>", "<b>"]), "Readings"),
    `<section class="band" aria-label="Readings"><div class="lane l2"><a><b></div></section>`,
  );
});

test("panel: a heading bar (named region) with an optional count; body padded unless flush", () => {
  const p = panel("<p>x</p>", { title: "Air stations near here", icon: "station", id: "st", count: 8 });
  assert.match(
    p,
    /^<section class="panel" aria-labelledby="st"><h2 class="bar" id="st"><svg[^>]*>.*<\/svg><span>Air stations near here<\/span><span class="n">8<\/span><\/h2><div class="in"><p>x<\/p><\/div><\/section>$/,
  );
  assert.equal(panel("<table>", { flush: true }), `<section class="panel"><table></section>`);
});

test("notice: kinds, icon, errors announced as alerts", () => {
  assert.equal(notice("info", "Hi"), `<p class="notice">Hi</p>`);
  assert.match(notice("stale", "Old", "clock"), /^<p class="notice stale"><svg[^>]*>.*<\/svg><span>Old<\/span><\/p>$/);
  assert.match(notice("err", "No"), /role="alert"/);
});

test("stamp: label and value, with modifiers", () => {
  assert.equal(
    stamp("updated", "<time>21:14</time>", { stale: true }),
    `<span class="stamp stale"><span class="k">updated</span><span class="v"><time>21:14</time></span></span>`,
  );
});

test("plate: level fill, shape, word and advice; the inline form for a station", () => {
  const p = plate({
    fill: "high",
    shape: "triangle",
    kicker: "Ambient · Everyone",
    word: "High air.",
    say: "The air is poor.",
    label: "High air",
  });
  assert.match(p, /^<section class="plate high stack" aria-label="High air">/);
  assert.match(p, /<p class="t-plate">High air\.<\/p>/);
  assert.match(p, /<p class="t-lead say">The air is poor\.<\/p>/);
  assert.match(
    plate({ fill: "b-poor", shape: "triangle", word: "246", label: "246 AQI", inline: true }),
    /class="plate inline b-poor"/,
  );
  assert.ok(!/class="shape"/.test(plate({ fill: "nolevel", word: "–", label: "No reading" })));
});

test("barRows: widths clamped to the scale, the CPCB limit as a custom property, band fill class", () => {
  const b = barRows(
    [
      { label: "PM2.5", value: "104", pct: 120, band: "poor" },
      { label: "CO", value: "0.81", pct: 16.24 },
    ],
    20,
  );
  assert.match(b, /^<div class="bars" style="--lim:20\.0%">/);
  assert.match(b, /class="brow b-poor"><span>PM2\.5<\/span>.*width:100\.0%/);
  assert.match(b, /class="brow"><span>CO<\/span>.*width:16\.2%/);
});

test("dataTable: scoped headers, row headers, numeric columns right-aligned, own scroll region", () => {
  const t = dataTable([{ label: "Station" }, { label: "AQI", num: true }], [["ITO", "336"]], "Air stations near here");
  assert.match(
    t,
    /^<div class="tscroll" role="region" tabindex="0" aria-label="Air stations near here"><table class="tbl"><caption class="vh">/,
  );
  assert.match(t, /<th scope="col" class="r">AQI<\/th>/);
  assert.match(t, /<tr><th scope="row">ITO<\/th><td class="r">336<\/td><\/tr>/);
});

test("cards, pairs, faq: boxes that hold whole sentences", () => {
  assert.equal(
    cards(["a", "b"], { cols: 2 }),
    `<div class="cards c2"><div class="card">a</div><div class="card">b</div></div>`,
  );
  assert.equal(pairs([["Accounts", "None."]]), `<dl class="pairs"><div><dt>Accounts</dt><dd>None.</dd></div></dl>`);
  assert.equal(faq([["Q & A?", "Yes."]]), `<dl class="faq"><div><dt>Q &amp; A?</dt><dd>Yes.</dd></div></dl>`);
});

test("sheet: numbered sections with ids; contents box from three sections", () => {
  const secs = ["One", "Two", "Three"].map((title, i) => ({
    id: `s${i}`,
    title,
    icon: "doc" as const,
    body: "<p>x</p>",
  }));
  const s = sheet(
    {
      kicker: "About",
      title: "The open sky",
      lead: "Lead",
      sections: secs,
      back: { href: "/", label: "← back to mugilu" },
    },
    "en",
  );
  assert.match(
    s,
    /<nav class="panel toc" aria-label="On this page"><p class="bar">On this page<\/p><a href="#s0"><span class="cnum">1<\/span>One<\/a>/,
  );
  assert.match(s, /<section class="tsec" id="s2" aria-labelledby="s2-h"><div class="rail"><span class="sn">§3<\/span>/);
  assert.match(s, /<h1 class="t-title">The open sky<\/h1>/);
  assert.ok(!/class="panel toc"/.test(sheet({ kicker: "k", title: "t", lead: "l", sections: secs.slice(0, 2) }, "en")));
});

test("warningPlate and warningRow: no level colour; the headline escaped, its script marked", () => {
  const p = warningPlate({
    bar: ["<span>IMD Visakhapatnam</span>"],
    title: "Severe Cyclonic Storm Akvan",
    icon: "cyclone",
    body: "<p>x</p>",
    label: "Official warning",
    lang: "en",
  });
  assert.match(p, /^<section class="wplate" aria-label="Official warning"><div class="bar"><svg/);
  assert.match(p, /Severe Cyclonic Storm Akvan<\/h2>/);
  // On a Hindi page the English title is marked, so it is read in the right voice.
  assert.match(
    warningPlate({ bar: [], title: "Severe Cyclonic Storm Akvan", body: "", label: "x", lang: "hi" }),
    /<span lang="en">Severe Cyclonic Storm Akvan<\/span><\/h2>/,
  );
  const r = warningRow({
    icon: "cyclone",
    kind: "Wind, cyclone",
    head: "తుఫాను <b>",
    lang: "hi",
    meta: "AP SDMA",
    type: "wind",
    issuer: "AP SDMA",
  });
  assert.match(r, /^<li class="wrow" data-type="wind" data-issuer="AP SDMA">/);
  assert.match(r, /<p class="head" lang="te">తుఫాను &lt;b&gt;<\/p>/);
  assert.match(
    warningRow({ icon: "rain", kind: "Rain", head: "Heavy rain", lang: "kn", meta: "", type: "rain", issuer: "x" }),
    /<p class="head" lang="en">Heavy rain<\/p>/,
  );
  assert.match(
    warningRow({ icon: "rain", kind: "Rain", head: "Heavy rain", lang: "en", meta: "", type: "rain", issuer: "x" }),
    /<p class="head">Heavy rain<\/p>/,
  );
});

test("checkGroup and fold: native checkboxes with counts; a disclosure with a count", () => {
  const g = checkGroup("type", "Type", [{ value: "storm", label: "Thunderstorm, lightning", count: 64 }]);
  assert.match(
    g,
    /<fieldset class="checks"><legend>Type<\/legend><label class="check"><input type="checkbox" name="type" value="storm" checked><span>Thunderstorm, lightning<\/span><span class="c">64<\/span><\/label>/,
  );
  assert.match(
    fold("Filter warnings", "<p>x</p>", { count: 100 }),
    /^<details class="fold"><summary>Filter warnings<span class="n">100<\/span><\/summary>/,
  );
});

test("placeTile: a warned place has the warning symbol and a spoken label, never a level colour", () => {
  assert.equal(placeTile("/c/delhi", "Delhi"), `<a class="ptile" href="/c/delhi">Delhi</a>`);
  const w = placeTile("/c/anakapalli", "Anakapalli", true);
  assert.match(
    w,
    /^<a class="ptile warn" href="\/c\/anakapalli"><svg[^>]*>.*<\/svg><span class="vh">Under an official warning now: <\/span>Anakapalli<\/a>$/,
  );
});

test("linkRow and qrBlock", () => {
  assert.equal(
    linkRow([
      ["/c/delhi.json", "JSON"],
      ["/c/delhi.md", "Markdown"],
    ]),
    `<p class="links t-meta"><a href="/c/delhi.json">JSON</a> · <a href="/c/delhi.md">Markdown</a></p>`,
  );
  const q = qrBlock("https://mugilu.live/c/delhi", "scan to see this on your phone");
  assert.match(q, /^<div class="qr"><svg class="qrimg" aria-hidden="true"/);
  assert.ok(!/#0b1220/.test(q), "QR colours come from the tokens");
});

test("alertsBox: every state present and hidden, with the ids ALERTS_JS drives", () => {
  const a = alertsBox("KEY<", "en");
  for (const id of [
    "alerts",
    "alerts-on",
    "alerts-off",
    "alerts-state",
    "alerts-denied",
    "alerts-full",
    "alerts-failed",
    "alerts-ios",
    "alerts-note-off",
    "alerts-note-on",
  ])
    assert.ok(a.includes(`id="${id}"`), id);
  assert.match(a, /data-key="KEY&lt;"/);
  assert.match(a, /<p class="notice err" id="alerts-denied" hidden>/);
});

test("yourPlacesSlot: a hidden named panel with the list the script fills", () => {
  assert.match(
    yourPlacesSlot("en"),
    /^<section class="panel" id="yp" hidden aria-labelledby="yp-h">.*Your places.*<ul class="yp in"><\/ul><\/section>$/,
  );
});

test("embedCard: links to the place; both disclaimers in the markup (the width picks one)", () => {
  const e = embedCard(
    {
      href: "https://mugilu.live/c/delhi",
      place: "Delhi",
      level: "high",
      headline: "High air",
      say: "The air is poor.",
      reads: [["246", "AQI Poor"]],
      asOf: "as of 21:14",
    },
    "en",
  );
  assert.match(e, /^<a class="ecard high" href="https:\/\/mugilu\.live\/c\/delhi" target="_blank" rel="noopener">/);
  assert.ok(e.includes(`<div class="t-legal disc-long">${DISCLAIMER_FULL}</div>`));
  assert.ok(e.includes(`<div class="t-legal disc-short">${DISCLAIMER_SHORT}</div>`));
});

test("locateJs: one location button for every page: shown only where the browser can locate, hands the fix over, restores its label (icon included)", async () => {
  const { runInNewContext } = await import("node:vm");
  const btn = {
    hidden: true,
    innerHTML: "<svg></svg>Use my location",
    textContent: "",
    onclick: null as null | (() => void),
  };
  let fixed = "";
  const ctx = {
    document: { getElementById: (id: string) => (id === "here" ? btn : null) },
    navigator: {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 28.61234, longitude: 77.20911 } }),
      },
    },
    addEventListener() {},
    onFix: (lat: string, lon: string) => (fixed = lat + "," + lon),
  };
  runInNewContext(locateJs("here", "en", "onFix"), ctx);
  assert.equal(btn.hidden, false);
  btn.onclick!();
  assert.equal(fixed, "28.6123,77.2091");
  assert.equal(btn.innerHTML, "<svg></svg>Use my location");
  // no geolocation: the button stays hidden
  const quiet = { ...btn, hidden: true };
  runInNewContext(locateJs("here", "en", "onFix"), {
    ...ctx,
    document: { getElementById: () => quiet },
    navigator: {},
  });
  assert.equal(quiet.hidden, true);
});

test("dataTable and sheet: plain strings are escaped, trusted markup (the Html brand) is kept", () => {
  const t1 = dataTable([{ label: "<b>x</b>" }, { label: trusted('<svg class="shp"></svg>High') }], [["a", "1"]]);
  assert.match(t1, /<th scope="col">&lt;b&gt;x&lt;\/b&gt;<\/th>/);
  assert.match(t1, /<th scope="col"><svg class="shp"><\/svg>High<\/th>/);
  const s1 = sheet({ kicker: "k", title: trusted("One,<br>two"), lead: "l", sections: [] }, "en");
  assert.match(s1, /One,<br>two/);
  assert.match(sheet({ kicker: "k", title: "A <i>", lead: "l", sections: [] }, "en"), /A &lt;i&gt;/);
});

test("siteHeader on phones: a Menu button (script-shown) opens the nav and the languages; without script the nav row stays", async () => {
  const { MENU_JS } = await import("../src/ui/components");
  const { STANDARD_CSS } = await import("../src/ui/standard");
  const h = siteHeader("/warnings", "en");
  assert.match(
    h,
    /<button type="button" class="btn mtog" aria-expanded="false" aria-controls="mnav" hidden><svg class="ico"[^>]*>[\s\S]*?<\/svg>Menu<\/button>/,
  );
  assert.match(h, /<nav class="nav" id="mnav" aria-label="Main">/);
  assert.match(siteHeader("/", "hi"), />मेनू<\/button>/);
  assert.match(siteHeader("/", "kn"), />ಮೆನು<\/button>/);
  // The script marks the header, shows the button, toggles aria-expanded, closes on Escape.
  for (const s of ["classList.add('mjs')", "aria-expanded", "Escape", ".focus()"]) assert.ok(MENU_JS.includes(s), s);
  const mobile = STANDARD_CSS.slice(STANDARD_CSS.indexOf("@media (max-width:999.98px){"));
  assert.match(mobile, /\.mg \.sh\.mjs \.nav\{display:none\}/);
  assert.match(mobile, /\.mg \.sh\.mjs\.open :is\(\.nav,\.langs\)\{display:flex/);
  assert.match(STANDARD_CSS, /\.mg \.sh \.mtog\{/);
});

test("siteFooter: every header page is reachable from the footer too", () => {
  const f = siteFooter("/", "en");
  for (const p of ["/places", "/warnings", "/display", "/methodology", "/about"])
    assert.ok(f.includes(`href="${p}"`), p);
});
