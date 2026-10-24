import type {
  AirConditions,
  AirPollutants,
  Conditions,
  NearStation,
  NormalizedStation,
  Snapshot,
  Warning,
} from "./types";
import { findNearest } from "./near";
import { isPlausible } from "./plausible";
import { getOpenMeteo } from "./openmeteo";
import { computeAqi, aqiBand, lifeYearsLost } from "./aqi";
import { pollutantParts } from "./formats";
import { nearestPlace } from "./place";
import { getLocationAlerts, splitWarnings } from "./sachet";
import { fireRiskAt } from "./firms";
import type { FiresSnapshot } from "./firms";
import { ambientRisk, ambientSummary, smokeLevel, PERSONA_LABEL } from "./score";
import type { Persona } from "./score";
import { buildAttribution } from "./sources";

// Stations within this many km of the nearest one count as equally near; among
// them a CPCB reference monitor (full pollutant set) beats a low-cost sensor.
const NEAR_TIE_KM = 2;

/**
 * Nearby first, then CPCB: take the nearest station with a plausible reading,
 * but if a CPCB station is also within NEAR_TIE_KM of it, use that CPCB station.
 */
export function pickStation(stations: NormalizedStation[], lat: number, lon: number): NearStation | undefined {
  const withReading = stations.filter((s) => s.aqi != null);
  const pool = withReading.length ? withReading : stations;
  const ranked = findNearest(pool, lat, lon, pool.length);
  // Skip stuck or spiking sensors (plausible.ts); with no reading at all there
  // is nothing to judge, so the plain nearest stands.
  const nearest = withReading.length ? ranked.find((s) => isPlausible(s, stations)) : ranked[0];
  if (!nearest || nearest.provider === "cpcb") return nearest;
  const cpcb = ranked.find((s) => s.provider === "cpcb" && s.distance_km - nearest.distance_km <= NEAR_TIE_KM);
  return cpcb ?? nearest;
}

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

/** Air modelled by Open-Meteo when no station is near; CPCB AQI computed in-app. */
function modelledAir(m: AirPollutants): AirConditions {
  const aqi = computeAqi(m);
  return {
    aqi,
    band: aqiBand(aqi),
    pollutants: m,
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

/**
 * Assemble the full conditions for a coordinate (A4): nearest-station air +
 * Open-Meteo heat/rain/uv/dust, with attribution and the disclaimer attached.
 * Resilient by design: a missing snapshot only nulls `air`, and Open-Meteo's
 * adapter already nulls any layer whose upstream fails.
 */
export async function buildConditions(
  snapshotIn: Snapshot | null | Promise<Snapshot | null>,
  lat: number,
  lon: number,
  firesIn: FiresSnapshot | null | Promise<FiresSnapshot | null> = null,
): Promise<Conditions> {
  // The snapshots (R2) and the upstreams (Open-Meteo, SACHET) are independent: all
  // four are in flight together, so a cold R2 read never delays the weather call.
  const [snapshot, fires, om, found] = await Promise.all([
    snapshotIn,
    firesIn,
    getOpenMeteo(lat, lon),
    getLocationAlerts(lat, lon),
  ]);
  // Nearest station that actually has a reading, from ANY provider via OAQ,
  // preferring CPCB when one is about as near (pickStation). The very closest
  // is often null, so don't stop there; fall back to overall nearest only if
  // nothing has a reading.
  const nearest = snapshot ? pickStation(snapshot.stations, lat, lon) : undefined;
  // Only warnings whose own area covers this spot are its warnings; the rest are nearby.
  const { here: warnings, nearby } = splitWarnings(found);

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

  const as_of = new Date().toISOString();
  return {
    location: { lat, lon },
    place: nearestPlace(lat, lon) ?? undefined,
    as_of,
    // Measured air is as old as the station's own reading; modelled air is live (~now).
    air_as_of: air?.station && nearest?.ts ? new Date(nearest.ts).toISOString() : as_of,
    air,
    heat: om.heat,
    rain: om.rain,
    uv: om.uv,
    dust: om.dust,
    wind: om.wind,
    visibility: om.visibility,
    smoke,
    warnings: warnings.length ? warnings : undefined,
    nearby_warnings: nearby.length ? nearby : undefined,
    attribution: buildAttribution([
      air?.source,
      om.heat?.source,
      om.rain?.source,
      om.uv?.source,
      om.dust?.source,
      smoke && smoke.count > 0 ? "firms" : undefined,
      found.length ? "sachet" : undefined,
    ]),
    disclaimer: DISCLAIMER,
  };
}

/** LLM-friendly Markdown rendering of a conditions response. */
export function renderConditionsMarkdown(c: Conditions, persona: Persona = "everyone"): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk);
  const out: string[] = [
    `# Conditions at ${c.location.lat}, ${c.location.lon}`,
    "",
    `**Ambient for ${PERSONA_LABEL[persona]}: ${risk.band}.** ${[say.meaning, say.action].filter(Boolean).join(" ")}`,
    "",
    `*As of ${c.as_of}.*`,
    "",
  ];

  if (c.warnings?.length) {
    out.push("## ⚠ Official warnings");
    for (const w of c.warnings) {
      out.push(`- **${w.event}** (${w.severity}${w.until ? `, until ${w.until}` : ""}): ${w.area} · ${w.issuer}`);
    }
    out.push("");
  }
  if (c.nearby_warnings?.length) {
    out.push("## Nearby official warnings", "*Active within 40 km; their areas do not cover this spot.*");
    for (const w of c.nearby_warnings) {
      out.push(`- ${w.event} (${w.severity}${w.until ? `, until ${w.until}` : ""}): ${w.area} · ${w.issuer}`);
    }
    out.push("");
  }

  if (c.air) {
    out.push("## Air", `- AQI **${c.air.aqi ?? "n/a"}** (${c.air.band})`);
    const p = c.air.pollutants;
    const pp = pollutantParts(p);
    const ug = pp.filter((x) => x.unit === "µg/m³").map((x) => `${x.label} ${x.value}`);
    if (ug.length) out.push(`- ${ug.join(" · ")} µg/m³`);
    const coPart = pp.find((x) => x.key === "co");
    if (coPart) out.push(`- CO ${coPart.value} mg/m³`);
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
    if (c.heat.wbgt_c != null) out.push(`- Heat stress (WBGT): ${c.heat.wbgt_c} °C`);
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
  if (c.wind && (c.wind.speed_kmh != null || c.wind.gust_kmh != null)) {
    out.push("## Wind");
    if (c.wind.speed_kmh != null) out.push(`- Speed: ${c.wind.speed_kmh} km/h`);
    if (c.wind.gust_kmh != null) out.push(`- Gusts: ${c.wind.gust_kmh} km/h`);
    if (c.wind.direction_deg != null) out.push(`- Direction: ${c.wind.direction_deg}° (from)`);
    out.push("");
  }
  if (c.visibility?.meters != null) {
    out.push("## Visibility", `- Visibility: ${c.visibility.meters} m`, "");
  }
  if (c.smoke && smokeLevel(c.smoke) != null) {
    out.push("## Smoke", `- Active fires within ${c.smoke.radius_km} km: **${c.smoke.count}** (last 24h)`);
    if (c.smoke.frp_sum) out.push(`- Total fire power nearby: ${c.smoke.frp_sum} MW`);
    if (c.smoke.nearest_km != null) out.push(`- Nearest fire: ${c.smoke.nearest_km} km`);
    out.push("");
  }

  out.push("---", c.attribution, "", `> ${c.disclaimer}`);
  return out.join("\n");
}

// Units are not otherwise discoverable from the bare numbers: notably CO is
// mg/m³ while the other pollutants are µg/m³. This map ships in every response.
const UNITS = {
  pollutants: { co: "mg/m3", default: "ug/m3" },
  aqi: "cpcb_0_500",
  yll_years: "years",
  temp_c: "C",
  apparent_c: "C",
  wet_bulb_c: "C",
  wbgt_c: "C",
  wind: "km/h",
  visibility: "m",
  distance_km: "km",
  frp_sum: "MW",
  score: "0-100",
  level: "0-3",
};

/** Seconds a conditions response stays fresh: mugilu recomputes on a ~15-min cycle
 *  (air and warnings only move hourly; weather at most every 15 min), so a faster
 *  poll returns identical data. Surfaced in JSON and as the `max-age` on the build-on
 *  responses so a client or embed can self-throttle instead of guessing per-metric. */
export const REFRESH_AFTER_SECONDS = 900;

/** A warning as the API shows it: the internal area flag dropped, its source named. */
const apiWarning = ({ covers: _covers, ...w }: Warning) => ({ ...w, source: "sachet" as const });

/** Serialize the internal model into the stable, self-describing /c `.json` v1
 *  contract: a `schema` + `version` handle, a `units` map, machine-readable
 *  provenance (`kind`) and freshness (`as_of`) on every layer, consistent
 *  naming (`yll_years`, ambient `risk_band`, lowercase driver ids) and one null
 *  convention (`place: null`, `warnings: []`), so a stranger can build on it
 *  without reading source. The HTML/MD/PNG renderers keep the internal model. */
export function serializeConditionsV1(c: Conditions, persona: Persona) {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk);
  const modelled = <T extends object>(o: T | null) => (o ? { kind: "modelled" as const, ...o, as_of: c.as_of } : null);
  return {
    schema: "mugilu/conditions",
    version: 1,
    location: c.location,
    place: c.place ?? null,
    as_of: c.as_of,
    // How long this reading stays current; polling faster returns identical data.
    refresh_after_seconds: REFRESH_AFTER_SECONDS,
    units: UNITS,
    air: c.air
      ? {
          kind: c.air.station ? ("measured" as const) : ("modelled" as const),
          aqi: c.air.aqi,
          aqi_scale: "cpcb",
          band: c.air.band,
          pollutants: c.air.pollutants,
          yll_years: c.air.yll ?? null,
          station: c.air.station,
          source: c.air.source,
          as_of: c.air_as_of ?? c.as_of,
        }
      : null,
    heat: modelled(c.heat),
    rain: modelled(c.rain),
    uv: modelled(c.uv),
    dust: modelled(c.dust),
    wind: modelled(c.wind),
    visibility: modelled(c.visibility),
    smoke: c.smoke ? { kind: "observed" as const, ...c.smoke, window_h: 24, as_of: c.as_of } : null,
    warnings: (c.warnings ?? []).map(apiWarning),
    nearby_warnings: (c.nearby_warnings ?? []).map(apiWarning),
    ambient: {
      risk_band: risk.band,
      level: risk.level,
      score: risk.score,
      driver: risk.driver.toLowerCase(),
      persona: risk.persona,
      summary: say.meaning,
      persona_action: say.action,
      persona_also: say.also,
      hazards: risk.hazards.map((h) => ({ hazard: h.hazard.toLowerCase(), level: h.level, risk_band: h.band })),
    },
    attribution: c.attribution,
    disclaimer: c.disclaimer,
  };
}
