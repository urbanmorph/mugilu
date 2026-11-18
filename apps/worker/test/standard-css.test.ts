import { test } from "node:test";
import assert from "node:assert/strict";
import { STANDARD_CSS } from "../src/ui/standard";

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
