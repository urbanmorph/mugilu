import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEUTRAL,
  ON_FILL,
  BAND_ON_FILL,
  RISK_COLOR,
  BAND_COLOR,
  RISK_TEXT,
  BAND_TEXT,
  HAZARD_TINT,
  WASH_STRENGTH,
  MAP_HUE,
} from "../src/palette";
import { TOKENS_CSS } from "../src/ui/tokens";
import { contrast, mix } from "./helpers/contrast";

// The signage design standard's tokens (supporting-docs/redesign/design-standard.md),
// generated from palette.ts so every colour has one home.

const MODES = ["light", "dark"] as const;

test("the standard's neutral values", () => {
  assert.deepEqual(
    { bg: NEUTRAL.light.bg, ink: NEUTRAL.light.ink, muted: NEUTRAL.light.muted, focus: NEUTRAL.light.focus },
    { bg: "#ffffff", ink: "#111111", muted: "#55554f", focus: "#0284c7" },
  );
  assert.deepEqual(
    { bg: NEUTRAL.dark.bg, ink: NEUTRAL.dark.ink, muted: NEUTRAL.dark.muted, bar: NEUTRAL.dark.bar },
    { bg: "#0d0d0c", ink: "#f5f5f4", muted: "#bdbdb7", bar: "#1c1c1a" },
  );
  assert.deepEqual(WASH_STRENGTH, {
    light: { low: 6, moderate: 8, high: 10, severe: 14 },
    dark: { low: 10, moderate: 12, high: 14, severe: 18 },
  });
});

test("body text, muted text and coloured text hold 4.5:1 on the page, the soft fill and every wash", () => {
  for (const [i, m] of MODES.entries()) {
    const n = NEUTRAL[m];
    for (const lv of Object.keys(WASH_STRENGTH[m]) as (keyof (typeof WASH_STRENGTH)["light"])[]) {
      const grounds = [
        n.bg,
        n.soft,
        ...Object.values(HAZARD_TINT).map((h) => mix(h, n.bg, WASH_STRENGTH[m][lv] / 100)),
      ];
      const texts: [string, string][] = [
        ["ink", n.ink],
        ["muted", n.muted],
        ["placeholder", n.placeholder],
        ...Object.entries(RISK_TEXT).map(([k, v]) => [`rt-${k}`, v[i]] as [string, string]),
        ...Object.entries(BAND_TEXT).map(([k, v]) => [`bt-${k}`, v[i]] as [string, string]),
      ];
      for (const [name, t] of texts)
        for (const g of grounds) {
          const r = contrast(t, g);
          assert.ok(r >= 4.5, `${m} ${name} ${t} on ${lv} wash: ${r.toFixed(2)}`);
        }
    }
    assert.ok(contrast(n.onBar, n.bar) >= 4.5, `${m} header text`);
    assert.ok(contrast(n.focus, n.bg) >= 3, `${m} focus ring`);
  }
});

test("text on a level or band fill holds 4.5:1 (white on green is not allowed)", () => {
  for (const [k, fill] of Object.entries(RISK_COLOR))
    assert.ok(contrast(ON_FILL[k as keyof typeof ON_FILL], fill) >= 4.5, `risk ${k}`);
  for (const [k, fill] of Object.entries(BAND_COLOR)) assert.ok(contrast(BAND_ON_FILL[k], fill) >= 4.5, `band ${k}`);
  assert.equal(ON_FILL.low, "#111111");
  assert.equal(ON_FILL.severe, "#ffffff");
});

test("TOKENS_CSS: light on .mg, dark by the system setting unless the page says light, and by data-theme", () => {
  const css = TOKENS_CSS;
  assert.match(css, /\.mg\{[^}]*--bg:#ffffff;[^}]*--muted:#55554f;/);
  assert.match(css, /--low:#16a34a;[^}]*--on-severe:#ffffff;/);
  assert.match(css, /--b-vpoor:#dc2626;/);
  assert.match(
    css,
    /@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\) \.mg\{[^}]*--bg:#0d0d0c;/,
  );
  assert.match(css, /:root\[data-theme="dark"\] \.mg\{[^}]*--bg:#0d0d0c;/);
  assert.match(css, new RegExp(`--mrain1:${MAP_HUE.light.rain1};`));
  for (const [k, h] of Object.entries(HAZARD_TINT)) assert.ok(css.includes(`.mg[data-tint="${k}"]{--hue:${h}}`), k);
  assert.match(css, /\.mg\[data-tint\]:not\(\[data-tint="off"\]\)\[data-level="severe"\]\{--s:14%\}/);
  assert.match(
    css,
    /:root\[data-theme="dark"\] \.mg\[data-tint\]:not\(\[data-tint="off"\]\)\[data-level="severe"\]\{--s:18%\}/,
  );
  assert.ok(!/data-size="[mdk]p?"/.test(css), "board preview pins stay out of the build");
  assert.ok(!/—/.test(css));
});
