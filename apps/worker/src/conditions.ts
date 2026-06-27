import type { AirConditions, Conditions, NearStation, Snapshot } from "./types";
import { findNearest } from "./near";
import { getOpenMeteo } from "./openmeteo";
import { computeAqi, aqiBand } from "./aqi";
import { nearestPlace } from "./place";
import { getLocationAlerts } from "./sachet";
import { fireRiskAt } from "./firms";
import type { FiresSnapshot } from "./firms";
import { ambientRisk, ambientMeaning, PERSONA_LABEL } from "./score";
import type { Persona } from "./score";

// Beyond this, a ground station is too far to represent the query point, so we
// prefer Open-Meteo's modelled PM (gap-fill) over a distant monitor.
const STATION_MAX_KM = 50;

/** Air from a ground station (measured), with its provider as the source. */
function measuredAir(s: NearStation): AirConditions {
  return {
    aqi: s.aqi,
    band: s.band,
    pollutants: s.pollutants,
    yll: s.yll ?? null,
    station: { id: s.id, name: s.name, city: s.city, distance_km: s.distance_km },
    source: s.provider,
  };
}

// AQLI: years of life lost if this PM2.5 persisted as the annual average.
// Same coefficient (0.098 yr per µg/m³, Ebenstein et al. 2017) the stations use.
function lifeYearsLost(pm25: number | undefined): number | null {
  return pm25 == null ? null : +(Math.max(0, pm25 - 5) * 0.098).toFixed(2);
}

/** Air modelled by Open-Meteo when no station is near; CPCB AQI computed in-app. */
function modelledAir(m: { pm25?: number; pm10?: number; o3?: number }): AirConditions {
  const pollutants = { pm25: m.pm25, pm10: m.pm10, o3: m.o3 };
  const aqi = computeAqi(pollutants);
  return {
    aqi,
    band: aqiBand(aqi),
    pollutants,
    yll: lifeYearsLost(m.pm25),
    station: null,
    source: "open-meteo",
    modelled: true,
  };
}

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
  firms: "NASA FIRMS",
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
  fires: FiresSnapshot | null = null,
): Promise<Conditions> {
  // Nearest station that actually has a reading, from ANY provider (CPCB,
  // Airnet, Aurassure via OAQ). The very closest is often null, so don't stop
  // there; fall back to overall nearest only if nothing has a reading.
  let nearest: NearStation | undefined;
  if (snapshot) {
    const withReading = snapshot.stations.filter((s) => s.aqi != null);
    const pool = withReading.length ? withReading : snapshot.stations;
    [nearest] = findNearest(pool, lat, lon, 1);
  }

  const [om, warnings] = await Promise.all([getOpenMeteo(lat, lon), getLocationAlerts(lat, lon)]);

  // Prefer a nearby measured station; beyond STATION_MAX_KM fall back to the
  // Open-Meteo model so air is filled for any coordinate, not just monitored
  // cities. A far station still beats nothing if the model is unavailable.
  let air: Conditions["air"] = null;
  if (nearest && nearest.aqi != null && nearest.distance_km <= STATION_MAX_KM) {
    air = measuredAir(nearest);
  } else if (om.airModel) {
    air = modelledAir(om.airModel);
  } else if (nearest && nearest.aqi != null) {
    air = measuredAir(nearest);
  }

  // Fire / crop-burn smoke pressure from the FIRMS snapshot (active detections
  // within 100 km). Null when we haven't collected fires yet; count 0 means we
  // checked and found none nearby.
  let smoke: Conditions["smoke"] = null;
  if (fires) {
    const r = fireRiskAt(fires.fires, lat, lon, 100);
    smoke = { count: r.count, frp_sum: r.frp_sum, nearest_km: r.nearest_km, radius_km: 100, source: "firms" };
  }

  return {
    location: { lat, lon },
    place: nearestPlace(lat, lon) ?? undefined,
    as_of: new Date().toISOString(),
    air,
    heat: om.heat,
    rain: om.rain,
    uv: om.uv,
    dust: om.dust,
    smoke,
    warnings: warnings.length ? warnings : undefined,
    attribution: buildAttribution([
      air?.source,
      om.heat?.source,
      om.rain?.source,
      om.uv?.source,
      om.dust?.source,
      smoke && smoke.count > 0 ? "firms" : undefined,
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
    if (c.air.station) {
      out.push(
        `- Nearest station: ${c.air.station.name}, ${c.air.station.city} (${c.air.station.distance_km} km) · via ${c.air.source.toUpperCase()}`,
      );
    } else {
      out.push("- Modelled (no station nearby) · via Open-Meteo");
    }
    out.push("");
  }
  if (c.heat) {
    out.push("## Heat");
    if (c.heat.temp_c != null) out.push(`- Temperature: ${c.heat.temp_c} °C`);
    if (c.heat.apparent_c != null) out.push(`- Feels like: ${c.heat.apparent_c} °C`);
    if (c.heat.humidity_pct != null) out.push(`- Humidity: ${c.heat.humidity_pct}%`);
    if (c.heat.wet_bulb_c != null) out.push(`- Wet-bulb: ${c.heat.wet_bulb_c} °C`);
    out.push("");
  }
  if (c.rain && (c.rain.precipitation_mm != null || c.rain.probability_pct != null)) {
    out.push("## Rain");
    if (c.rain.precipitation_mm != null) out.push(`- Precipitation: ${c.rain.precipitation_mm} mm`);
    if (c.rain.probability_pct != null) out.push(`- Chance of rain: ${c.rain.probability_pct}%`);
    out.push("");
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
  if (c.smoke && (c.smoke.count >= 3 || c.smoke.frp_sum >= 20)) {
    out.push("## Smoke", `- Active fires within ${c.smoke.radius_km} km: **${c.smoke.count}** (last 24h)`);
    if (c.smoke.frp_sum) out.push(`- Total fire power nearby: ${c.smoke.frp_sum} MW`);
    if (c.smoke.nearest_km != null) out.push(`- Nearest fire: ${c.smoke.nearest_km} km`);
    out.push("");
  }

  out.push("---", c.attribution, "", `> ${c.disclaimer}`);
  return out.join("\n");
}
