import type { AmbientRisk, RiskBand } from "./score";

// Single source of truth for the hazard palettes, shared by the HTML pages
// (page.ts) and the share images (og.ts) so they can never drift apart.

// The four-step Ambient risk ramp (the colour of the named hazard).
export const RISK_COLOR: Record<RiskBand, string> = {
  low: "#16a34a",
  moderate: "#ca8a04",
  high: "#f97316",
  severe: "#dc2626",
};

/** A hazard level (0-3) as a colour: the risk ramp for 1-3, and `quiet` for 0 (a
 *  muted token on the pages, a slate on the dark image). */
export function levelColor(level: number, quiet = "var(--muted)"): string {
  return [quiet, RISK_COLOR.moderate, RISK_COLOR.high, RISK_COLOR.severe][level] ?? quiet;
}

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
/** How much of the hue goes into the backdrop, per band (percent). */
export const TINT_STRENGTH: Record<RiskBand, number> = { low: 16, moderate: 20, high: 26, severe: 34 };

/** The backdrop tint for a read: its hazard's hue (clear sky when calm) at its band's strength. */
export function tintOf(risk: Pick<AmbientRisk, "band" | "driver">): { hue: string; strength: number } {
  return {
    hue: HAZARD_TINT[risk.band === "low" ? "none" : risk.driver] ?? HAZARD_TINT.none,
    strength: TINT_STRENGTH[risk.band],
  };
}
