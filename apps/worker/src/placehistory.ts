import { DISCLAIMER } from "./conditions";
import type { Env } from "./index";
import { loadPlaceTrend, PLACE_DAILY_START, SERIES, type PlaceTrend } from "./placedaily";
import { hazardReads, sliceTrend } from "./pages/trends";
import { RISK_BANDS } from "./score";
import type { SlugPlace } from "./slugs";
import { AIR_PROVIDERS, buildAttribution } from "./sources";

// A named place's daily record (placedaily.ts, the trends page's data) as data for agents: the
// MCP place_history tool and /c/<slug>/trends.json. The same figures and the same counting as
// the page (trends.ts hazardReads), so an agent quoting it quotes the page.

/** The days a record can be asked for, as on the page. */
export const HISTORY_SPANS = [7, 30, 90] as const;
export type HistorySpan = (typeof HISTORY_SPANS)[number];

/** Units of each day's figures. */
const UNITS = {
  air: "CPCB AQI",
  fires: "count within 100 km",
  feels_max: "°C",
  feels_min: "°C",
  rain_mm: "mm",
  gust_kmh: "km/h",
  uv_max: "UV index",
  vis_min_m: "m",
  dust_max: "µg/m³",
};

export function placeHistory(place: SlugPlace, tr: PlaceTrend, span: HistorySpan) {
  const days = tr.days.map((date, i) => ({
    date,
    ...Object.fromEntries(SERIES.map((k) => [k, tr[k][i] ?? null])),
  })) as ({ date: string } & Record<(typeof SERIES)[number], number | null>)[];
  return {
    schema: "mugilu.place_history",
    version: 1,
    place: { slug: place.slug, name: place.name, state: place.state ?? null },
    span_days: span,
    from: tr.days[0] ?? null,
    to: tr.days.at(-1) ?? null,
    /** The first day of the record for any place: there is nothing before it. */
    record_starts: PLACE_DAILY_START,
    /** The most air stations within 25 km on any day. */
    max_stations: tr.stations,
    units: UNITS,
    hazards: hazardReads(tr).map((r) => ({
      hazard: r.h.key,
      name: r.h.name,
      /** The day's figure it is read from (a key of each day and of units). */
      series: r.h.series,
      what: r.h.what,
      kind: r.h.kind.toLowerCase(),
      source: r.h.source,
      days_with_data: r.d,
      days_at_level: Object.fromEntries(RISK_BANDS.map((b, l) => [b, r.counts[l]])) as Record<
        (typeof RISK_BANDS)[number],
        number
      >,
      worst_level: RISK_BANDS[r.worst] ?? null,
      peak: r.peak ? { value: r.peak.v, date: r.peak.day } : null,
    })),
    days,
    attribution: buildAttribution([...Object.keys(AIR_PROVIDERS), "open-meteo", "firms"]),
    disclaimer: DISCLAIMER,
  };
}
export type PlaceHistory = ReturnType<typeof placeHistory>;

const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
/** The record's first day in words ("22 Aug 2026"), for the MCP's descriptions. */
export const RECORD_STARTS = day(PLACE_DAILY_START);

/** The record in a few lines: the period, each hazard's raised days and peak, the limits. */
export function placeHistoryText(h: PlaceHistory): string {
  const lines = [`${h.place.name}, last ${h.span_days} days (${h.from} to ${h.to}).`];
  for (const z of h.hazards) {
    const raised = (["severe", "high", "moderate"] as const)
      .filter((b) => z.days_at_level[b])
      .map((b, i) => `${z.days_at_level[b]}${i ? "" : z.days_at_level[b] === 1 ? " day" : " days"} ${b}`);
    const unit = UNITS[z.series as keyof typeof UNITS];
    const value = z.series === "air" ? `AQI ${z.peak?.value}` : `${z.peak?.value} ${unit}`;
    const peak = z.peak ? `; peak ${value} on ${z.peak.date}` : "";
    lines.push(`- ${z.name}: ${raised.length ? raised.join(", ") : "low every day"} (of ${z.days_with_data})${peak}.`);
  }
  lines.push(
    "",
    `Daily figures in structuredContent.days. The record starts ${day(h.record_starts)}: there is nothing before it.`,
  );
  return lines.join("\n");
}

/** A named place's record over the span, or null before the first night's file. */
export async function loadPlaceHistory(env: Env, place: SlugPlace, span: HistorySpan): Promise<PlaceHistory | null> {
  const tr = await loadPlaceTrend(env, place, span === 90 ? 90 : 30);
  return tr && placeHistory(place, sliceTrend(tr, span), span);
}
