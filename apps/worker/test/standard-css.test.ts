import { test } from "node:test";
import assert from "node:assert/strict";
import { STANDARD_CSS } from "../src/ui/standard";
import { PULL_MARKER } from "../src/freshen";

// The second stylesheet: one definition per component, tokens only, no board scaffolding.

test("standard.css: tokens only (no literal colours), no board pins or canvas annotations", () => {
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(STANDARD_CSS), "a literal colour");
  assert.ok(!/data-size=/.test(STANDARD_CSS), "a board preview pin");
  assert.ok(!/\.std\b|\.annot\b|\.bnotes\b/.test(STANDARD_CSS), "board-only rules");
  assert.ok(!/\/\*/.test(STANDARD_CSS), "comments are stripped");
  assert.ok(!/\.kio\.portrait/.test(STANDARD_CSS), "portrait is a media query in the build");
});

test("standard.css: desktop rules under min-width 1000, portrait kiosk under orientation", () => {
  assert.match(
    STANDARD_CSS,
    /@media \(min-width:1000px\)\{[^@]*\.mg \.lane\.l3\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/,
  );
  assert.match(STANDARD_CSS, /@media \(max-width:999\.98px\)\{[^@]*\.mg \.tbl\{font-size:var\(--t-sm\)\}/);
  assert.match(STANDARD_CSS, /@media \(orientation:portrait\)\{[^@]*\.mg \.kio \.kb\{grid-template-columns:1fr;/);
  assert.match(STANDARD_CSS, /@media \(forced-colors:active\)\{/);
  for (const c of [
    "sh",
    "sf",
    "chip",
    "plate",
    "stamp",
    "panel",
    "notice",
    "search",
    "seg",
    "bars",
    "tbl",
    "kio",
    "ecard",
    "qr",
  ])
    assert.ok(new RegExp(`\\.${c}\\b`).test(STANDARD_CSS), `component .${c}`);
});

test("pull-to-refresh is styled by the standard, from tokens, and moves only without reduced motion", () => {
  assert.match(STANDARD_CSS, /#ptr\{[^}]*background:var\(--bg\)[^}]*color:var\(--muted\)/);
  assert.match(STANDARD_CSS, /@media \(prefers-reduced-motion: no-preference\)\{#ptr\.spin svg\{animation/);
  assert.doesNotMatch(PULL_MARKER, /<style>/);
});

test("every interactive element inside the page gets the 3px focus ring, every field the placeholder colour", () => {
  // `.mg:focus-visible` would match only <body class="mg">: the descendant combinator is required.
  assert.match(STANDARD_CSS, /\.mg :focus-visible\{outline:3px solid var\(--focus\);outline-offset:2px\}/);
  assert.match(STANDARD_CSS, /\.mg ::placeholder\{color:var\(--muted\);opacity:1\}/);
  assert.doesNotMatch(STANDARD_CSS, /\.mg:focus-visible|\.mg::placeholder/);
});

test("a table's cell link is a full-height target, in a row header (the station's neighbours) too", () => {
  assert.match(
    STANDARD_CSS,
    /\.mg \.tbl :is\(td,th\)>a:first-child\{display:flex;align-items:center;min-height:var\(--hit\)\}/,
  );
});

test("the portrait display scales with the screen: its spacing and QR in kiosk units, not pixels", () => {
  // Kiosk type is in vh; pixel paddings and a 220px QR made a 720x1280 screen overflow while
  // 1080x1920 (the same shape) fit. In k units the layout is the same at every portrait size.
  const portrait = STANDARD_CSS.match(/@media \(orientation:portrait\)\{([^@]*)\}/)![1];
  for (const rule of portrait.match(/\.mg[^{]*\.(?:ktile|plate|ktiles|qrimg)\{[^}]*\}/g)!)
    assert.doesNotMatch(rule, /padding:[^;}]*var\(--sp|\d+px/, rule);
  assert.match(
    portrait,
    /\.mg\[data-kiosk\] \.qr \.qrimg\{width:calc\(var\(--k4\) \* 1\.31\);height:calc\(var\(--k4\) \* 1\.31\)\}/,
  );
});

test("the QR's caption wraps (a long translation must not squeeze the disclaimer beside it)", () => {
  assert.match(STANDARD_CSS, /\.mg \.qr>span\{flex:0 1 auto;min-width:8em;max-width:16em\}/);
  assert.doesNotMatch(STANDARD_CSS, /\.mg \.qr>span\{[^}]*nowrap/);
});

test("text marked in another language than the page's uses the system face, after the per-script faces", async () => {
  // An English page never downloads an Indic font for a quoted headline or a sample word:
  // only text in the page's own language (no lang attribute of its own) takes Anek.
  const rule = '.mg [lang]:not([lang="en"]){font-family:system-ui,sans-serif}';
  const at = STANDARD_CSS.indexOf(rule);
  assert.ok(at > 0, "the rule");
  const { TOKENS_CSS } = await import("../src/ui/tokens");
  assert.ok(TOKENS_CSS.includes(".mg :lang(kn){font-family"), "the per-script faces load first, in the tokens");
  assert.doesNotMatch(STANDARD_CSS, /\.mg \.sys\{/, "no per-element class");
});

test("an English /warnings page marks Indic headlines with their language, so they take the system face", async () => {
  const { renderWarningsPage } = await import("../src/pages/warnings");
  const html = renderWarningsPage(
    {
      generated_at: "2026-11-19T00:00:00Z",
      count: 1,
      alerts: [
        {
          identifier: "1",
          headline: "दिल्ली में शीत लहर की चेतावनी",
          category: "Met",
          issuer: "IMD",
          link: "",
          sent: "2026-11-19T00:00:00Z",
        },
      ],
    } as never,
    "en",
  );
  assert.match(html, /<p class="head" lang="hi">दिल्ली में शीत लहर की चेतावनी<\/p>/);
});

test("the embed card fits its 240px frame: one row of readings, the full disclaimer from a 400px frame", () => {
  // The card has no web font; in the system face five readings wrap to a second row, which
  // pushed the full disclaimer out of the published 480x240 frame. Readings that do not fit
  // the first row are cut whole (they come in the order they matter).
  assert.match(
    STANDARD_CSS,
    /\.mg \.ecard \.ereads\{[^}]*max-height:calc\(var\(--t-lg\) \+ var\(--t-xs\) \* 1\.3\);overflow:hidden/,
  );
  assert.match(STANDARD_CSS, /\.mg \.ecard \.eread span\{display:block;[^}]*white-space:nowrap;line-height:1\.3/);
  // The query measures the card's content box: a 400px frame less 2x2px border and 2x12px padding.
  assert.match(STANDARD_CSS, /@container \(min-width:372px\)\{\.mg \.ecard \.disc-long\{display:block\}/);
});

test("the language names use the system face: two words must not fetch a whole Indic font on every page", () => {
  // Each name carries its own lang (hi, kn), which the one rule for marked text covers.
  assert.ok(STANDARD_CSS.includes('.mg [lang]:not([lang="en"]){font-family:system-ui,sans-serif}'));
});

test("a fitted switch fills its row: options grow, wrap into whole rows, ruled by ink gaps not borders", () => {
  assert.match(STANDARD_CSS, /\.mg \.seg\.fit\{display:flex;flex-wrap:wrap;gap:2px;background:var\(--ink\)\}/);
  assert.match(STANDARD_CSS, /\.mg \.seg\.fit>label\{flex:1 1 auto;border:0;padding:0 var\(--sp1\)\}/);
  assert.match(STANDARD_CSS, /\.mg \.segf>\.seg:not\(\.grid2,\.fit\)\{justify-self:start\}/);
});

test("the language names sit evenly: the current one is padded like the links, and no link is stretched to 44px", () => {
  // A 44px minimum width centred the short हिंदी in extra space while English (the current
  // page, plain bold) had none, so the gaps around the dots differed. Height stays the target.
  assert.match(
    STANDARD_CSS,
    /,\.mg \.langs>b,\.mg \.flangs>b\{display:inline-flex;[^}]*min-height:var\(--hit\);padding-inline:var\(--sp1\)\}/,
  );
  assert.doesNotMatch(STANDARD_CSS, /\.mg \.(f?langs) a[^{]*\{min-width/);
});

test("stamps in a bar: the selected layer's alone, on one line in the bar's colours, under the title when tight", () => {
  assert.match(STANDARD_CSS, /\.mg \.panel>div\.bar\{flex-wrap:wrap\}/);
  assert.match(STANDARD_CSS, /\.mg \.panel>\.bar>h2\{margin:0;font:inherit;flex:none;white-space:nowrap\}/);
  assert.match(STANDARD_CSS, /\.mg \.bar \.stamps\{margin-left:auto;/);
  assert.match(STANDARD_CSS, /\.mg \.bar \.stamp\{flex-direction:row;[^}]*background:none;[^}]*color:var\(--on-bar\)/);
  assert.match(STANDARD_CSS, /\.mg \.bar \.stamp\.off\{display:none\}/);
  assert.doesNotMatch(STANDARD_CSS, /#[0-9a-fA-F]{3,8}\b/);
});

test("the kiosk's Updated stamp is one line beside the clock: label then age", () => {
  assert.match(STANDARD_CSS, /\.mg \.kio \.stamp\{flex-direction:row;align-items:baseline;gap:\.5em\}/);
});

test("the footer: link groups in columns (two on a phone, Build on it across), labels capitalised in CSS", () => {
  assert.match(STANDARD_CSS, /\.mg \.fgrid\{display:grid;[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(
    STANDARD_CSS,
    /@media \(min-width:1000px\)\{[^@]*\.mg \.fgrid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\) minmax\(0,1\.3fr\)\}/,
  );
  assert.match(STANDARD_CSS, /\.mg \.fgroup a::first-letter\{text-transform:uppercase\}/);
  // ::first-letter applies only to a block-level box: a flex link stayed lowercase.
  assert.match(STANDARD_CSS, /\.mg \.fgroup a\{display:inline-block;line-height:var\(--hit\);/);
  assert.match(
    STANDARD_CSS,
    /@media \(max-width:999\.98px\)\{[^@]*\.mg \.fgrid>\.fgroup:nth-child\(3\)\{grid-column:1\/-1;/,
  );
});

test("the place page's last row on desktop: Stations down the left, Nearby then the screen button on the right", () => {
  // Three columns left the screen button alone in the middle, over blank space; phones keep the board's order.
  const desk = STANDARD_CSS.match(/@media \(min-width:1000px\)\{([^@]*)\}/)![1];
  assert.match(desk, /\.mg \.lane\.l3:has\(>div>\.act\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(desk, /\.mg \.lane\.l3>div:has\(>\.act\)\+div\{grid-column:1;grid-row:1 \/ span 2;align-self:start\}/);
  assert.match(desk, /\.mg \.lane\.l3:has\(>div>\.act\)>div:last-child\{grid-column:2;grid-row:1\}/);
  assert.match(desk, /\.mg \.lane\.l3>div:has\(>\.act\)\{grid-column:2;grid-row:2\}/);
});

test("home: with no saved places, Popular takes the whole row, the tiles left and the screen button right", () => {
  assert.match(STANDARD_CSS, /\.mg #yp\{align-self:start\}/, "a short list is not stretched to Popular's height");
  assert.match(STANDARD_CSS, /\.mg \.lane\.l2:has\(>#yp\[hidden\]\)\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(
    STANDARD_CSS,
    /\.mg \.lane\.l2:has\(>#yp\[hidden\]\)>\.col\{flex-direction:row;flex-wrap:wrap;align-items:flex-end;justify-content:space-between\}/,
  );
});

test("desktop header: Install app appears in the free space before the languages, so the nav never moves", () => {
  // Between the logo and the nav it pushed every nav link 120px right when the browser offered the install.
  const desk = STANDARD_CSS.match(/@media \(min-width:1000px\)\{([^@]*)\}/)![1];
  assert.match(desk, /\.mg \.sh #install-app\{order:1;margin-left:auto\}/);
  assert.match(desk, /\.mg \.sh \.langs\{order:2\}/);
  assert.match(desk, /\.mg \.sh #install-app:not\(\[hidden\]\)~\.langs\{margin-left:var\(--sp4\)\}/);
});
