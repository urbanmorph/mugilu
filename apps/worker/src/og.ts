import { ImageResponse } from "workers-og";
import type { NormalizedStation } from "./types";

const BAND_COLORS: Record<NormalizedStation["band"], string> = {
  good: "#00b050",
  satisfactory: "#8bc34a",
  moderate: "#ffd633",
  poor: "#ff8c00",
  vpoor: "#d62828",
  severe: "#7a0010",
  unknown: "#666666",
};

const BAND_LABELS: Record<NormalizedStation["band"], string> = {
  good: "Good",
  satisfactory: "Satisfactory",
  moderate: "Moderate",
  poor: "Poor",
  vpoor: "Very Poor",
  severe: "Severe",
  unknown: "n/a",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderStationOg(s: NormalizedStation, generatedAt: string): Response {
  const band = BAND_COLORS[s.band];
  const bandLabel = BAND_LABELS[s.band];
  const aqi = s.aqi !== null ? String(s.aqi) : "n/a";
  const name = s.name.length > 34 ? s.name.slice(0, 32) + "…" : s.name;
  const city = s.city || "India";
  const updated =
    new Date(generatedAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " IST";

  // Layout rules (Satori is strict):
  //   - every div with >1 child (including implicit whitespace text nodes) must set display:flex
  //   - text nodes count as children, so we keep multi-child divs compact with flex
  const html =
    `<div style="height:100%;width:100%;display:flex;flex-direction:column;background:#0b0b0c;color:#ededed;padding:60px 72px;font-family:sans-serif;">` +
      `<div style="display:flex;justify-content:space-between;font-size:26px;color:#a1a1aa;">` +
        `<div style="display:flex;">mugilu · India air quality</div>` +
        `<div style="display:flex;">${esc(updated)}</div>` +
      `</div>` +
      `<div style="display:flex;flex:1;align-items:center;margin-top:32px;">` +
        `<div style="display:flex;flex-direction:column;margin-right:64px;">` +
          `<div style="display:flex;font-size:220px;font-weight:800;line-height:0.9;color:#fafafa;font-family:monospace;">${esc(aqi)}</div>` +
          `<div style="display:flex;font-size:32px;color:#a1a1aa;margin-top:12px;">AQI (${esc(bandLabel)})</div>` +
        `</div>` +
        `<div style="display:flex;flex-direction:column;flex:1;">` +
          `<div style="display:flex;font-size:56px;font-weight:700;line-height:1.1;color:#fafafa;">${esc(name)}</div>` +
          `<div style="display:flex;font-size:36px;color:#a1a1aa;margin-top:8px;">${esc(city)}</div>` +
          `<div style="display:flex;width:120px;height:18px;background:${band};border-radius:4px;margin-top:32px;"></div>` +
        `</div>` +
      `</div>` +
      `<div style="display:flex;justify-content:space-between;font-size:22px;color:#71717a;margin-top:32px;">` +
        `<div style="display:flex;">${esc(s.provider.toUpperCase())} via oaq.notf.in</div>` +
        `<div style="display:flex;">urbanmorph/mugilu</div>` +
      `</div>` +
    `</div>`;

  // workers-og adds its own immutable cache-control. We wrap the response to
  // replace it with our shorter TTL (OG images depend on live AQI values).
  const img = new ImageResponse(html, { width: 1200, height: 630, format: "png" });
  const headers = new Headers(img.headers);
  headers.set("cache-control", "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400");
  return new Response(img.body, { status: img.status, headers });
}
