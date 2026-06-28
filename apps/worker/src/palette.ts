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
