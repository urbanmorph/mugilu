import normals from "../data/heat-normals.json";
import { t } from "./i18n";
import type { Lang } from "./i18n";
import type { TodayMax } from "./openmeteo";

// "Heat compared with normal": today's modelled high against the long-term
// normal daily maximum for this time of year at this place. The normals are a
// modelled climatology (1991-2020, the current WMO normal period) of ERA5
// reanalysis via Open-Meteo, built offline by scripts/build-heat-normals.ts on a
// regular grid. This is context from past data: never a forecast, and never a
// heatwave call (IMD declares those; they reach mugilu as SACHET warnings).

/** The bundled normals: grid step in degrees (nodes on half steps), and per node
 *  [elevation_m, ...52 weekly normal daily maxima in tenths of °C]. */
export interface NormalsFile {
  step: number;
  nodes: Record<string, number[]>;
}

export const WEEKS = 52;
// A bundled JSON module: parsed once per isolate, never per request.
const BUNDLED = normals as unknown as NormalsFile;

// At or past this |today - normal| (whole °C) the comparison is said on the page,
// in Markdown and in MCP text; below it, it stays quiet (the JSON still carries it).
// Measured on the first 111 ERA5 cells (1991-2020): the daily maximum's spread around
// its normal is 2.2 °C (1.6 in Bengaluru, 2.6-2.7 in Delhi and Jaisalmer). At ±2 °C the
// line would show on 44% of days; at ±3 °C on 22% (10% Bengaluru, 17-18% Hyderabad and
// Kolkata, 31-33% Delhi and Jaisalmer); at ±4 °C on 11%. 3 °C keeps it to days that
// stand out, with headroom for the ~1-2 °C forecast-vs-ERA5 bias seen at coasts.
export const ANOMALY_NOTABLE_C = 3;

// Standard-atmosphere lapse rate: shifts a node's normal to the place's height,
// so a hill town is not compared with the plain below it.
const LAPSE_C_PER_M = 0.0065;

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** 0-based day of a 365-day year for a local "YYYY-MM-DD" date; Feb 29 folds onto Feb 28. */
export function noleapDay(date: string): number {
  const m = +date.slice(5, 7) - 1;
  return MONTH_START[m] + Math.min(+date.slice(8, 10), m === 1 ? 28 : 31) - 1;
}

/** Day of year (0-364, fractional) at the centre of week k: 52 weeks evenly span 365 days. */
export function weekCentre(k: number): number {
  return ((k + 0.5) * 365) / WEEKS - 0.5;
}

/** A 52-sample seasonal curve (starting at `values[start]`) read at a day of year,
 *  linear between week centres and wrapping across the year end. Null where the
 *  curve has a gap, never a gap read as 0. */
export function seasonalValue(values: number[], day: number, start = 0): number | null {
  const p = (((((day + 0.5) * WEEKS) / 365 - 0.5) % WEEKS) + WEEKS) % WEEKS;
  const k = Math.floor(p);
  const f = p - k;
  const a = values[start + k];
  const b = values[start + ((k + 1) % WEEKS)];
  return Number.isFinite(a) && Number.isFinite(b) ? a * (1 - f) + b * f : null;
}

/** A grid node's key in the normals file ("28.5,77.5"). */
export const nodeKey = (lat: number, lon: number) => `${+lat.toFixed(3)},${+lon.toFixed(3)}`;

/**
 * Normal daily maximum (°C, one decimal) at a point for a local date: bilinear
 * over the four surrounding grid nodes, each first shifted to the place's
 * elevation when given. Nodes not built yet drop out and the rest are
 * reweighted, but a point leaning on less than a quarter of its weight (only a
 * far corner built) has no normal: null, as does any point off the grid.
 */
export function normalMaxAt(
  lat: number,
  lon: number,
  date: string,
  elevationM?: number,
  file: NormalsFile = BUNDLED,
): number | null {
  const s = file.step;
  const lat0 = Math.floor((lat - s / 2) / s) * s + s / 2;
  const lon0 = Math.floor((lon - s / 2) / s) * s + s / 2;
  const fy = (lat - lat0) / s;
  const fx = (lon - lon0) / s;
  const day = noleapDay(date);
  let sum = 0;
  let wsum = 0;
  for (const [dy, dx, w] of [
    [0, 0, (1 - fy) * (1 - fx)],
    [0, 1, (1 - fy) * fx],
    [1, 0, fy * (1 - fx)],
    [1, 1, fy * fx],
  ]) {
    const node = file.nodes[nodeKey(lat0 + dy * s, lon0 + dx * s)];
    const v = node && w > 0 ? seasonalValue(node, day, 1) : null;
    if (v == null) continue; // not built yet, or a gap: drops out like a missing node
    const lapse = elevationM != null ? LAPSE_C_PER_M * (elevationM - node[0]) : 0;
    sum += w * (v / 10 - lapse);
    wsum += w;
  }
  return wsum >= 0.25 ? +(sum / wsum).toFixed(1) : null;
}

export interface HeatVsNormal {
  /** Today's modelled daily maximum (the model's estimate for the whole local day,
   *  so partly forecast early in the day), whole °C. */
  today_max_c: number;
  /** The normal daily maximum for this time of year here, whole °C. */
  normal_max_c: number;
  /** today_max_c - normal_max_c. */
  anomaly_c: number;
  /** Whether the unrounded difference reaches ANOMALY_NOTABLE_C; below it the human
   *  renderings stay quiet. */
  notable: boolean;
  /** The local date compared ("2026-05-25"). */
  date: string;
  /** The time of year compared, in English ("late May"). */
  period: string;
  baseline: string;
  /** The attribution key (sources.ts SOURCE_CREDIT): ERA5 via Open-Meteo. */
  source: "era5";
}

/** Today's high at a point (local date and elevation from the forecast call)
 *  against its normal; null when either is missing. Both are rounded first so the
 *  shown numbers always subtract to the shown difference; whether it is notable is
 *  decided on the unrounded difference (41.3 vs 38.4 shows "3" but is not notable). */
export function compareWithNormal(
  lat: number,
  lon: number,
  today: TodayMax | null,
  file: NormalsFile = BUNDLED,
): HeatVsNormal | null {
  if (!today) return null;
  const normalMax = normalMaxAt(lat, lon, today.date, today.elevation_m, file);
  if (normalMax == null) return null;
  const todayC = Math.round(today.max_c);
  const normalC = Math.round(normalMax);
  const anomaly = todayC - normalC;
  return {
    today_max_c: todayC,
    normal_max_c: normalC,
    anomaly_c: anomaly,
    notable: Math.abs(today.max_c - normalMax) >= ANOMALY_NOTABLE_C,
    date: today.date,
    period: periodText(today.date, "en"),
    baseline: "1991-2020 normals",
    source: "era5",
  };
}

const LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

/** "early May" / "mid May" / "late May" (1-10, 11-20, 21+), in the page's language. */
export function periodText(date: string, lang: Lang): string {
  const day = +date.slice(8, 10);
  const part = day <= 10 ? "early {month}" : day <= 20 ? "mid {month}" : "late {month}";
  const month = new Intl.DateTimeFormat(LOCALE[lang], { month: "long", timeZone: "UTC" }).format(
    Date.UTC(2001, +date.slice(5, 7) - 1, 15),
  );
  return t(part, lang).replace("{month}", month);
}

const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** Whether to say the line: notable, and still the local day the high is for. An
 *  edge- or upstream-cached reading can outlive IST midnight, and yesterday's high
 *  must not be shown as today's. */
export function heatVsNormalShown(h: HeatVsNormal | null | undefined, now = new Date()): h is HeatVsNormal {
  return !!h?.notable && h.date === IST_DATE.format(now);
}

/** "Today's modelled high of 41°C is 5°C above normal for late May here." */
export function heatVsNormalLine(h: HeatVsNormal, lang: Lang): string {
  const above = h.anomaly_c >= 0;
  return t(
    above
      ? "Today's modelled high of {t}°C is {d}°C above normal for {period} here."
      : "Today's modelled high of {t}°C is {d}°C below normal for {period} here.",
    lang,
  )
    .replace("{t}", String(h.today_max_c))
    .replace("{d}", String(Math.abs(h.anomaly_c)))
    .replace("{period}", periodText(h.date, lang));
}

/** The label that rides with the line wherever it is shown: what both halves are. */
export const NORMALS_LABEL = "Today's high is modelled (Open-Meteo); the normal is 1991-2020 ERA5 reanalysis.";
