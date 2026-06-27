import type { Conditions, Snapshot } from "./types";
import { findNearest } from "./near";
import { getOpenMeteo } from "./openmeteo";
import { nearestPlace } from "./place";
import { getLocationAlerts } from "./sachet";
import { ambientRisk, ambientMeaning, PERSONA_LABEL } from "./score";
import type { Persona } from "./score";

// Shared license-passthrough fields for the conditions contract.
//
// MIT covers our code; the DATA keeps each upstream's terms. So attribution and
// the disclaimer ride WITH every response (not just the MCP init instructions,
// which consumers routinely drop). Keep these one line each, the full terms
// live at /terms.

// Relayed in EVERY response (decided), the one liability worth repeating for a
// health-relevant tool.
export const DISCLAIMER =
  "Informational only, not for medical, emergency, or safety-critical decisions. " +
  "For official hazard warnings consult NDMA / IMD.";

// Per-source credit lines. CPCB/Airnet/Aurassure reach us via the OAQ broker;
// Open-Meteo is CC-BY 4.0 (attribution mandatory).
const SOURCE_CREDIT: Record<string, string> = {
  cpcb: "CPCB (Govt. of India) via OAQ",
  airnet: "Airnet / CSTEP via OAQ",
  aurassure: "Aurassure via OAQ",
  "open-meteo": "Open-Meteo (CC-BY 4.0)",
  sachet: "NDMA / IMD (SACHET)",
};

/** Build a deduped, ready-to-paste attribution line from contributing sources. */
export function buildAttribution(sources: Array<string | undefined | null>): string {
  const credits = new Set<string>();
  for (const s of sources) {
    if (s) credits.add(SOURCE_CREDIT[s] ?? s);
  }
  if (credits.size === 0) return "via mugilu";
  return `Sources: ${[...credits].join(" · ")}, via mugilu`;
}

/**
 * Assemble the full conditions for a coordinate (A4): nearest-station air +
 * Open-Meteo heat/rain/uv/dust, with attribution and the disclaimer attached.
 * Resilient by design: a missing snapshot only nulls `air`, and Open-Meteo's
 * adapter already nulls any layer whose upstream fails.
 */
export async function buildConditions(
  snapshot: Snapshot | null,
  lat: number,
  lon: number,
): Promise<Conditions> {
  let air: Conditions["air"] = null;
  if (snapshot) {
    const [nearest] = findNearest(snapshot.stations, lat, lon, 1);
    if (nearest) {
      air = {
        aqi: nearest.aqi,
        band: nearest.band,
        pollutants: nearest.pollutants,
        yll: nearest.yll ?? null,
        station: {
          id: nearest.id,
          name: nearest.name,
          city: nearest.city,
          distance_km: nearest.distance_km,
        },
        source: nearest.provider,
      };
    }
  }

  const [om, warnings] = await Promise.all([getOpenMeteo(lat, lon), getLocationAlerts(lat, lon)]);

  return {
    location: { lat, lon },
    place: nearestPlace(lat, lon) ?? undefined,
    as_of: new Date().toISOString(),
    air,
    heat: om.heat,
    rain: om.rain,
    uv: om.uv,
    dust: om.dust,
    warnings: warnings.length ? warnings : undefined,
    attribution: buildAttribution([
      air?.source,
      om.heat?.source,
      om.rain?.source,
      om.uv?.source,
      om.dust?.source,
      warnings.length ? "sachet" : undefined,
    ]),
    disclaimer: DISCLAIMER,
  };
}

/** LLM-friendly Markdown rendering of a conditions response. */
export function renderConditionsMarkdown(c: Conditions, persona: Persona = "everyone"): string {
  const risk = ambientRisk(c, persona);
  const out: string[] = [
    `# Conditions at ${c.location.lat}, ${c.location.lon}`,
    "",
    `**Ambient for ${PERSONA_LABEL[persona]}: ${risk.band}.** ${ambientMeaning(risk)}`,
    "",
    `*As of ${c.as_of}.*`,
    "",
  ];

  if (c.warnings?.length) {
    out.push("## ⚠ Official warnings");
    for (const w of c.warnings) {
      out.push(
        `- **${w.event}** (${w.severity}${w.until ? `, until ${w.until}` : ""}): ${w.area} · ${w.issuer}`,
      );
    }
    out.push("");
  }

  if (c.air) {
    out.push("## Air", `- AQI **${c.air.aqi ?? "n/a"}** (${c.air.band})`);
    const p = c.air.pollutants;
    const parts: string[] = [];
    if (p.pm25 != null) parts.push(`PM2.5 ${p.pm25}`);
    if (p.pm10 != null) parts.push(`PM10 ${p.pm10}`);
    if (p.o3 != null) parts.push(`O₃ ${p.o3}`);
    if (parts.length) out.push(`- ${parts.join(" · ")} µg/m³`);
    if (c.air.yll != null) out.push(`- Est. life-expectancy impact: ${c.air.yll} yrs (AQLI)`);
    out.push(
      `- Nearest station: ${c.air.station.name}, ${c.air.station.city} (${c.air.station.distance_km} km) · via ${c.air.source.toUpperCase()}`,
      "",
    );
  }
  if (c.heat) {
    out.push("## Heat");
    if (c.heat.temp_c != null) out.push(`- Temperature: ${c.heat.temp_c} °C`);
    if (c.heat.apparent_c != null) out.push(`- Feels like: ${c.heat.apparent_c} °C`);
    if (c.heat.humidity_pct != null) out.push(`- Humidity: ${c.heat.humidity_pct}%`);
    if (c.heat.wet_bulb_c != null) out.push(`- Wet-bulb: ${c.heat.wet_bulb_c} °C`);
    out.push("");
  }
  if (c.rain && c.rain.precipitation_mm != null) {
    out.push("## Rain", `- Precipitation: ${c.rain.precipitation_mm} mm`, "");
  }
  if (c.uv && c.uv.index != null) {
    out.push("## UV", `- UV index: ${c.uv.index}`, "");
  }
  if (c.dust) {
    out.push("## Dust");
    if (c.dust.dust_ug_m3 != null) out.push(`- Dust: ${c.dust.dust_ug_m3} µg/m³`);
    if (c.dust.aod != null) out.push(`- Aerosol optical depth: ${c.dust.aod}`);
    out.push("");
  }

  out.push("---", c.attribution, "", `> ${c.disclaimer}`);
  return out.join("\n");
}
