import { test } from "node:test";
import assert from "node:assert/strict";
import { FONT_FACES, FALLBACK_STACK } from "../src/ui/fonts";
import { TOKENS_CSS } from "../src/ui/tokens";

// While Anek Latin downloads, text shows in a system face scaled to Anek's size, so the swap
// does not reflow the page (CLS). Measured against Anek on the place page's own text
// (supporting-docs/platform-audit-tracker-2026-11-24.md, W2): Arial on desktops and iOS,
// Roboto on Android. Condensed roles get narrower fallbacks; Indic text keeps its own faces.

const face = (family: string) =>
  [...FONT_FACES.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]).filter((f) => f.includes(`'${family}'`));

test("fallback faces: Arial and Roboto, each scaled to Anek, for normal, semi and condensed text", () => {
  for (const [tier, arial, roboto] of [
    ["N", "91%", "93%"],
    ["S", "73%", "78%"],
    ["C", "62%", "67%"],
  ]) {
    const a = face(`Anek ${tier} Arial`);
    assert.equal(a.length, 2, `${tier}: regular and bold Arial`);
    for (const f of a) assert.match(f, new RegExp(`size-adjust:${arial}`));
    assert.match(a[0], /src:local\('Arial'\),local\('ArialMT'\);font-weight:400 500/);
    assert.match(a[1], /src:local\('Arial Bold'\),local\('Arial-BoldMT'\);font-weight:600 800/);
    const r = face(`Anek ${tier} Roboto`);
    assert.equal(r.length, 1, `${tier}: Roboto`);
    assert.match(r[0], new RegExp(`size-adjust:${roboto}`));
  }
});

test("fallback faces: Anek's line metrics (ascent 90%, descent 20%, no gap), corrected for the scale", () => {
  const [n] = face("Anek N Arial");
  assert.match(n, /ascent-override:98\.9%;descent-override:22%;line-gap-override:0%/);
});

test("stacks: Anek first, then the scaled fallbacks, then the system face", () => {
  assert.equal(FALLBACK_STACK.N, "'Anek Latin','Anek N Arial','Anek N Roboto',system-ui,sans-serif");
  assert.match(TOKENS_CSS, /^\.mg\{[^}]*font-family:'Anek Latin','Anek N Arial','Anek N Roboto',system-ui,sans-serif;/);
  assert.match(
    TOKENS_CSS,
    /\.mg \.t-title\{font-family:'Anek Latin','Anek C Arial','Anek C Roboto',system-ui,sans-serif;/,
  );
  assert.match(TOKENS_CSS, /\.mg \.t-plate\{font-family:'Anek Latin','Anek C Arial'/);
  assert.match(TOKENS_CSS, /\.mg \.t-h2\{font-family:'Anek Latin','Anek C Arial'/);
  assert.match(TOKENS_CSS, /\.mg \.t-value\{font-family:'Anek Latin','Anek S Arial'/);
});

test("stacks: Hindi and Kannada text still takes its own Anek face, after the condensed roles", () => {
  const roles = TOKENS_CSS.indexOf(".mg .t-plate{");
  const hi = TOKENS_CSS.indexOf(".mg :lang(hi){font-family:'Anek Devanagari'");
  assert.ok(roles > 0 && hi > roles, "same specificity, so the later :lang rule wins");
});
