import type { RiskBand } from "./score";

// Single source of truth for the hazard palettes, shared by the HTML pages
// (page.ts) and the share images (og.ts) so they can never drift apart.

// The four-step Ambient risk ramp (the colour of the named hazard).
export const RISK_COLOR: Record<RiskBand, string> = {
  low: "#16a34a",
  moderate: "#ca8a04",
  high: "#f97316",
  severe: "#dc2626",
};

// The same severities and bands as TEXT, [light theme, dark theme]. The colours above
// fill shapes (map squares, bars, dots); as text on a light page they are too pale
// (moderate's yellow is 2:1). Each pair holds 4.5:1 on its theme's page and card, under
// any hazard's tint at its level (test/palette-text.test.ts). Pages read these only
// through paletteCss()'s variables, --rt-<risk> and --bt-<band>: change them here.
export const RISK_TEXT: Record<RiskBand, [string, string]> = {
  low: ["#137136", "#4ade80"],
  moderate: ["#895306", "#facc15"],
  high: ["#a5370a", "#fb9644"],
  severe: ["#a41919", "#fbafaf"],
};
export const BAND_TEXT: Record<string, [string, string]> = {
  good: ["#137136", "#4ade80"],
  satisfactory: ["#446e0d", "#a3e635"],
  moderate: ["#895306", "#facc15"],
  poor: ["#a5370a", "#fb9644"],
  vpoor: ["#a41919", "#fbafaf"],
  severe: ["#7f1d1d", "#fdabb5"],
  unknown: ["#475569", "#94a3b8"],
};

// CPCB AQI band colours (good -> severe), plus a neutral "unknown".
export const BAND_COLOR: Record<string, string> = {
  good: "#16a34a",
  satisfactory: "#84cc16",
  moderate: "#eab308",
  poor: "#f97316",
  vpoor: "#dc2626",
  severe: "#7f1d1d",
  unknown: "#9ca3af",
};

// The backdrop's hue says WHAT the sky is doing (one per hazard); its strength says
// how bad, and the headline word keeps the severity colour above. A calm read is a
// clear-sky blue. Shared by the /c page, the display, the embed and the image.
export const HAZARD_TINT: Record<string, string> = {
  none: "#38bdf8",
  Heat: "#f97316",
  Cold: "#60a5fa",
  Air: "#a0785a", // smoggy brown (darker and redder than dust's sand)
  UV: "#a855f7",
  Dust: "#d6a35c",
  Wind: "#2dd4bf",
  Fog: "#94a3b8",
  Smoke: "#78716c",
  Warning: "#ef4444",
};
// ── Signage design standard (supporting-docs/redesign/design-standard.md) ───────────
// Every colour the new pages use lives here; src/ui/tokens.ts turns them into CSS.

/** The neutrals, per theme. The header bar stays near-black in both themes. */
export const NEUTRAL = {
  light: {
    bg: "#ffffff",
    ink: "#111111",
    muted: "#55554f",
    placeholder: "#55554f",
    line: "#d8d6d0",
    soft: "#f3f2ee",
    track: "#e7e5df",
    focus: "#0284c7",
    bar: "#111111",
    onBar: "#ffffff",
    barRule: "#111111",
  },
  dark: {
    bg: "#0d0d0c",
    ink: "#f5f5f4",
    muted: "#bdbdb7",
    placeholder: "#bdbdb7",
    line: "#3a3a36",
    soft: "#1c1c1a",
    track: "#2e2e2a",
    focus: "#38bdf8",
    bar: "#1c1c1a",
    onBar: "#f5f5f4",
    barRule: "#3a3a36",
  },
} as const;

/** Text on a level fill: near-black on every fill except red, which takes white. */
export const ON_FILL: Record<RiskBand, string> = {
  low: "#111111",
  moderate: "#111111",
  high: "#111111",
  severe: "#ffffff",
};
/** Text on an AQI band fill. */
export const BAND_ON_FILL: Record<string, string> = {
  good: "#111111",
  satisfactory: "#111111",
  moderate: "#111111",
  poor: "#111111",
  vpoor: "#ffffff",
  severe: "#ffffff",
  unknown: "#111111",
};

/** The India map's hues, per theme. Rain is stepped for 3:1 against the land. */
export const MAP_HUE = {
  light: {
    air: "#7b2872",
    heat: "#e75c2e",
    cold: "#238ce4",
    rain1: "#3b82f6",
    rain2: "#1d4ed8",
    rain3: "#1e3a8a",
    land: "#eef2f6",
    calm: "#e0f2fe",
  },
  dark: {
    air: "#b778be",
    heat: "#d02026",
    cold: "#256de7",
    rain1: "#3b82f6",
    rain2: "#93c5fd",
    rain3: "#dbeafe",
    land: "#172033",
    calm: "#16324a",
  },
} as const;

/** The page wash: how much of the hazard's hue goes into the page, per level (percent). */
export const WASH_STRENGTH: Record<"light" | "dark", Record<RiskBand, number>> = {
  light: { low: 6, moderate: 8, high: 10, severe: 14 },
  dark: { low: 10, moderate: 12, high: 14, severe: 18 },
};

/** A QR code is black on white in both themes, so phones can read it. */
export const QR_INK = "#000000";
export const QR_PAPER = "#ffffff";
