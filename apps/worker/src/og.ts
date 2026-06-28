import { ImageResponse } from "workers-og";
import type { NormalizedStation, Conditions } from "./types";
import { ambientRisk, ambientMeaning, smokeLevel } from "./score";
import type { Persona, RiskBand } from "./score";
import { RISK_COLOR, BAND_COLOR } from "./palette";

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
  const band = BAND_COLOR[s.band];
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
    `<div style="height:100%;width:100%;display:flex;flex-direction:column;background:#0b1220;color:#e2e8f0;padding:60px 72px;font-family:sans-serif;">` +
    `<div style="display:flex;justify-content:space-between;font-size:26px;color:#94a3b8;">` +
    `<div style="display:flex;">mugilu · India air quality</div>` +
    `<div style="display:flex;">${esc(updated)}</div>` +
    `</div>` +
    `<div style="display:flex;flex:1;align-items:center;margin-top:32px;">` +
    `<div style="display:flex;flex-direction:column;margin-right:64px;">` +
    `<div style="display:flex;font-size:220px;font-weight:800;line-height:0.9;color:#e2e8f0;font-family:monospace;">${esc(aqi)}</div>` +
    `<div style="display:flex;font-size:32px;color:#94a3b8;margin-top:12px;">AQI (${esc(bandLabel)})</div>` +
    `</div>` +
    `<div style="display:flex;flex-direction:column;flex:1;">` +
    `<div style="display:flex;font-size:56px;font-weight:700;line-height:1.1;color:#e2e8f0;">${esc(name)}</div>` +
    `<div style="display:flex;font-size:36px;color:#94a3b8;margin-top:8px;">${esc(city)}</div>` +
    `<div style="display:flex;width:120px;height:18px;background:${band};border-radius:4px;margin-top:32px;"></div>` +
    `</div>` +
    `</div>` +
    `<div style="display:flex;justify-content:space-between;font-size:22px;color:#64748b;margin-top:32px;">` +
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

// ── Conditions snapshot image (the timestamped PNG for /c/{lat},{lon}.png) ──
const RISK_LABEL: Record<RiskBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};
const COND_NOUN: Record<string, string> = {
  Air: "air",
  Heat: "heat",
  Cold: "cold",
  UV: "sun",
  Dust: "dust",
  Wind: "wind",
  Fog: "fog",
  Smoke: "smoke",
  Warning: "alert",
  none: "sky",
};

/** A shareable, timestamped snapshot image of the conditions at a point. The
 *  time is rendered prominently because the values change; cache is short. */
export function renderConditionsOg(c: Conditions, persona: Persona): Response {
  const risk = ambientRisk(c, persona);
  const cond = RISK_COLOR[risk.band];
  const placeRaw = c.place || c.air?.station?.city || `${c.location.lat}, ${c.location.lon}`;
  const place = placeRaw.length > 30 ? placeRaw.slice(0, 29) + "…" : placeRaw;
  const head = risk.band === "low" ? "All clear" : `${RISK_LABEL[risk.band]} ${COND_NOUN[risk.driver] ?? "sky"}`;
  const updated =
    new Date(c.as_of).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " IST";

  const stats: Array<[string, string]> = [];
  if (c.air?.aqi != null) stats.push(["AIR", `AQI ${c.air.aqi}`]);
  if (c.heat?.apparent_c != null) stats.push(["HEAT", `feels ${Math.round(c.heat.apparent_c)}°`]);
  if (c.heat?.wet_bulb_c != null) stats.push(["WET-BULB", `${Math.round(c.heat.wet_bulb_c)}°`]);
  if (c.uv?.index != null) stats.push(["SUN", `UV ${Math.round(c.uv.index)}`]);
  if (c.dust?.dust_ug_m3 != null) stats.push(["DUST", `${Math.round(c.dust.dust_ug_m3)}`]);
  if (c.smoke && smokeLevel(c.smoke) != null) stats.push(["SMOKE", `${c.smoke.count} fires`]);

  const stat = (label: string, val: string) =>
    `<div style="display:flex;flex-direction:column;margin-right:56px;">` +
    `<div style="display:flex;font-size:26px;color:#64748b;letter-spacing:2px;">${esc(label)}</div>` +
    `<div style="display:flex;font-size:40px;font-weight:700;color:#e2e8f0;margin-top:6px;">${esc(val)}</div>` +
    `</div>`;

  const html =
    `<div style="height:100%;width:100%;display:flex;flex-direction:column;background:#0b1220;color:#e2e8f0;padding:64px 72px;font-family:sans-serif;">` +
    `<div style="display:flex;justify-content:space-between;align-items:center;font-size:30px;color:#94a3b8;">` +
    `<div style="display:flex;">mugilu · the sky over ${esc(place)}</div>` +
    `<div style="display:flex;color:#cbd5e1;">${esc(updated)}</div>` +
    `</div>` +
    `<div style="display:flex;flex-direction:column;flex:1;justify-content:center;">` +
    `<div style="display:flex;font-size:120px;font-weight:800;line-height:1;color:${cond};">${esc(head)}</div>` +
    `<div style="display:flex;font-size:38px;color:#cbd5e1;margin-top:22px;">${esc(ambientMeaning(risk))}</div>` +
    `</div>` +
    `<div style="display:flex;align-items:flex-end;border-top:1px solid #1f2937;padding-top:30px;">` +
    stats.map(([l, v]) => stat(l, v)).join("") +
    `<div style="display:flex;margin-left:auto;font-size:28px;color:#64748b;">mugilu.live</div>` +
    `</div>` +
    `</div>`;

  const img = new ImageResponse(html, { width: 1200, height: 630, format: "png" });
  const headers = new Headers(img.headers);
  headers.set("cache-control", "public, max-age=900, s-maxage=900, stale-while-revalidate=86400");
  return new Response(img.body, { status: img.status, headers });
}

// ── Branded card for the home + content pages (the social-share image) ──
export function renderHomeOg(): Response {
  const html =
    `<div style="height:100%;width:100%;display:flex;flex-direction:column;background:#0b1220;color:#e2e8f0;padding:72px 80px;font-family:sans-serif;">` +
    `<div style="display:flex;flex:1;flex-direction:column;justify-content:center;">` +
    `<div style="display:flex;font-size:128px;font-weight:800;line-height:1;color:#e2e8f0;">mugilu</div>` +
    `<div style="display:flex;font-size:46px;color:#cbd5e1;margin-top:26px;">The open sky of India, one coordinate at a time.</div>` +
    `<div style="display:flex;font-size:30px;color:#94a3b8;margin-top:40px;">air · heat · rain · dust · UV · official warnings — for any point, right now</div>` +
    `</div>` +
    `<div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #1f2937;padding-top:28px;">` +
    `<div style="display:flex;font-size:28px;color:#94a3b8;">open · free · built to be built on</div>` +
    `<div style="display:flex;font-size:28px;color:#38bdf8;">mugilu.live</div>` +
    `</div>` +
    `</div>`;
  const img = new ImageResponse(html, { width: 1200, height: 630, format: "png" });
  const headers = new Headers(img.headers);
  headers.set("cache-control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800");
  return new Response(img.body, { status: img.status, headers });
}
