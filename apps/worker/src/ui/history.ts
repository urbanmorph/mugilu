import { aqiBand, AQI_BAND_LABEL } from "../aqi";
import { esc } from "../html";
import { andList, LOCALE, lp, t, type Lang } from "../i18n";
import type { SlugPlace } from "../slugs";
import type { IndiaTrend, PlaceTrend, Series } from "../placedaily";
import {
  airLevelOf,
  coldLevelOf,
  fogLevelOf,
  heatLevelOf,
  rainLevelOf,
  RISK_BANDS,
  smokeCountLevelOf,
  THRESHOLDS,
  uvLevelOf,
  windLevelOf,
} from "../score";
import { LEVEL_SHAPE, LEVEL_WORD, linkButton, panel, shape, type IconName } from "./components";
import { AIR_KM, TREND_DAYS } from "../placedaily";

// The place page's "Last 30 days" (placedaily.ts keeps the record): the air a day at a time, a
// bar a day filled by its level with the level edges drawn, so the level reads from position as
// well as colour; then each other hazard in one line, how often it was raised and how far.

/** A hazard as the trend shows it: the series that measures it, its level, what a bar is, where
 *  it comes from, the level edges to draw and how to say a value. Air first; the rest in the
 *  order of the place page's readings. Modelled dust is left out: over the plains it runs far
 *  above what the stations show and would lead a record built on measured air. */
export interface HazardDef {
  key: string;
  name: string;
  icon: IconName;
  series: Series;
  level: (v: number) => number;
  /** Lower is worse (cold, fog): the chart grows its bars as the value falls below this. */
  falling?: number;
  /** What a bar's height means, when it is not the value itself. */
  note?: string;
  what: string;
  kind: "Measured" | "Modelled" | "Seen by satellite";
  source: string;
  lines: (lang: Lang) => ChartLine[];
  say: (v: number, lang: Lang) => string;
}
const T = THRESHOLDS;
/** Level edges with the level words (moderate, high, severe), each value said by `num`. */
const edges =
  (vals: readonly number[], num: (v: number) => string, words = ["Moderate", "High", "Severe"]) =>
  (lang: Lang): ChartLine[] =>
    vals.map((v, i) => ({ v, num: num(v), word: t(words[i], lang) }));
const deg = (v: number) => `${Math.round(v)}°C`;
export const HAZARD_DEFS: HazardDef[] = [
  {
    key: "air",
    name: "Air",
    icon: "air",
    series: "air",
    level: (v) => airLevel(v),
    what: "The day's worst AQI: the middle of the stations within 25 km, each by its worst reading",
    kind: "Measured",
    source: "CPCB and partner networks",
    lines: (lang) => AIR_EDGES.map((e) => ({ v: e.v, num: String(e.v), word: t(AQI_BAND_LABEL[e.band], lang) })),
    say: (v, lang) => `AQI ${v} ${t(AQI_BAND_LABEL[aqiBand(v)], lang)}`,
  },
  {
    key: "heat",
    name: "Heat",
    icon: "heat",
    series: "feels_max",
    level: (v) => heatLevelOf({ apparent_c: v }),
    what: "The day's highest feels-like temperature",
    kind: "Modelled",
    source: "Open-Meteo",
    lines: edges(T.apparent, (v) => `${v}°`),
    say: deg,
  },
  {
    key: "cold",
    name: "Cold",
    icon: "cold",
    series: "feels_min",
    level: coldLevelOf,
    falling: 20,
    note: "A taller bar is a colder day: it grows as the feels-like low falls below 20°C.",
    what: "The day's lowest feels-like temperature",
    kind: "Modelled",
    source: "Open-Meteo",
    lines: edges(T.cold, (v) => `${v}°`),
    say: deg,
  },
  {
    key: "rain",
    name: "Rain",
    icon: "rain",
    series: "rain_mm",
    level: rainLevelOf,
    what: "Rain over the day",
    kind: "Modelled",
    source: "Open-Meteo",
    lines: edges(T.rain24, (v) => String(v), ["Heavy", "Very heavy", "Extremely heavy"]),
    say: (v) => `${+v.toFixed(1)} mm`,
  },
  {
    key: "wind",
    name: "Wind",
    icon: "wind",
    series: "gust_kmh",
    level: windLevelOf,
    what: "The day's strongest gust",
    kind: "Modelled",
    source: "Open-Meteo",
    lines: edges(T.wind, (v) => String(v)),
    say: (v) => `${Math.round(v)} km/h`,
  },
  {
    key: "fog",
    name: "Fog",
    icon: "fog",
    series: "vis_min_m",
    level: fogLevelOf,
    falling: 2000,
    note: "A taller bar is a thicker fog: it grows as the lowest visibility falls below 2,000 m.",
    what: "The day's lowest visibility",
    kind: "Modelled",
    source: "Open-Meteo",
    lines: edges(T.fog, (v) => `${v} m`),
    say: (v) => `${Math.round(v).toLocaleString("en-IN")} m`,
  },
  {
    key: "smoke",
    name: "Smoke",
    icon: "smoke",
    series: "fires",
    level: smokeCountLevelOf,
    what: "Fires seen by satellite within 100 km",
    kind: "Seen by satellite",
    source: "NASA FIRMS (VIIRS)",
    lines: edges(T.smokeCount, (v) => String(v)),
    say: (v, lang) => fill("{n} fires", lang, { n: v }),
  },
  {
    key: "uv",
    name: "UV",
    icon: "sun",
    series: "uv_max",
    level: uvLevelOf,
    what: "The day's highest UV index",
    kind: "Modelled",
    source: "Open-Meteo",
    lines: edges(T.uv, (v) => String(v), ["Moderate", "High"]),
    say: (v) => `UV ${+v.toFixed(1)}`,
  },
];
const OTHERS = HAZARD_DEFS.slice(1);

const airLevel = (aqi: number) => airLevelOf(aqiBand(aqi)) ?? 0;
/** The CPCB band edges drawn on the air chart. */
const AIR_EDGES = [
  { v: 101, band: "moderate" },
  { v: 201, band: "poor" },
  { v: 301, band: "vpoor" },
  { v: 401, band: "severe" },
] as const;

export const fill = (en: string, lang: Lang, slots: Record<string, string | number>) =>
  Object.entries(slots).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t(en, lang));

/** "21 Oct" in the page's language, for a YYYY-MM-DD day. */
export function dayLabel(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", timeZone: "UTC" }).format(
    Date.parse(`${day}T00:00:00Z`),
  );
}

/** A day's bar: its segments bottom up, each to its own (cumulative) value; null is no data. */
export type DayBar = { segs: { v: number; cls: string }[]; title: string } | null;
/** A labelled dashed line across the chart: `word` shows beside `num` on wide screens only. */
export interface ChartLine {
  v: number;
  num: string;
  word?: string;
}

/** A bar a day (its fill the level, or the part it stands for), labelled dashed lines (the level
 *  edges, or a scale), the dates under it. A day with no data is an empty outline. The top is
 *  `max`, else the highest bar with any line up to 1.6 times it. */
export function dayChart(o: {
  days: string[];
  bars: DayBar[];
  lines: ChartLine[];
  label: string;
  lang: Lang;
  max?: number;
  /** Lower is worse: bars grow as the value falls below this (each bar is `invert - value`). */
  invert?: number;
}): string {
  const W = 600;
  const PLOT = 476; // the line labels sit in the margin to the right
  const H = 150;
  const top = 8;
  const bottom = 18;
  // Lower is worse: chart how far each value is below `invert`, so a taller bar is always worse.
  const cap = o.invert;
  const flip = (v: number) => (cap == null ? v : Math.max(0, cap - v));
  const bars0 =
    cap == null ? o.bars : o.bars.map((b) => b && { ...b, segs: b.segs.map((x) => ({ ...x, v: flip(x.v) })) });
  const lines0 = cap == null ? o.lines : o.lines.map((e) => ({ ...e, v: flip(e.v) }));
  const peak = Math.max(0, ...bars0.flatMap((b) => b?.segs.map((s) => s.v) ?? []));
  const max = o.max ?? (Math.max(peak, ...o.lines.filter((e) => e.v <= peak * 1.6).map((e) => e.v)) || 1) * 1.08;
  const y = (v: number) => top + (H - top - bottom) * (1 - Math.max(0, Math.min(v, max)) / max);
  const n = o.days.length;
  const bw = PLOT / n;
  const gap = n > 45 ? 0.5 : 1;
  const bars = bars0
    .map((b, i) => {
      const x = (i * bw + gap).toFixed(1);
      const w = (bw - 2 * gap).toFixed(1);
      if (!b) return `<rect class="tnone" x="${x}" y="${top}" width="${w}" height="${H - top - bottom}"/>`;
      let base = 0;
      const segs = b.segs
        .map((s) => {
          // A day with data is never invisible: at least a sliver at the base.
          const [y0, y1] = [y(base), Math.min(y(s.v), y(base) - (b.segs.length === 1 ? 1.5 : 0))];
          base = s.v;
          return y0 - y1 > 0
            ? `<rect class="tbar ${s.cls}" x="${x}" y="${y1.toFixed(1)}" width="${w}" height="${(y0 - y1).toFixed(1)}" rx="${n > 45 ? 1 : 2}"/>`
            : "";
        })
        .join("");
      return `<g><title>${esc(b.title)}</title>${segs}</g>`;
    })
    .join("");
  let lastY = Infinity;
  const lines = lines0
    .filter((e) => e.v <= max)
    .sort((a, b) => a.v - b.v)
    .map((e) => {
      const yy = y(e.v);
      const ly = Math.min(yy + 4, lastY - 20); // labels apart even at the phone size, going up
      lastY = ly;
      return (
        `<line class="tedge" x1="0" x2="${PLOT + 4}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>` +
        `<text class="tlab" x="${PLOT + 6}" y="${ly.toFixed(1)}">${e.word ? `<tspan class="w">${esc(e.word)}\u00a0</tspan>` : ""}${esc(e.num)}</text>`
      );
    })
    .join("");
  const at = [...new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n - 1])];
  const ticks = at
    .map(
      (i) =>
        `<text class="ttick${i === 0 || i === n - 1 ? "" : " mid"}" x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(dayLabel(o.days[i], o.lang))}</text>`,
    )
    .join("");
  return `<svg class="tchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">${lines}${bars}${ticks}</svg>`;
}

/** The air chart: a bar a day (its height the AQI, its fill the level), the CPCB edges. */
function airChart(tr: PlaceTrend, lang: Lang): string {
  return dayChart({
    days: tr.days,
    lang,
    label: fill("Air, the worst AQI of each day, for {n} days", lang, { n: tr.days.length }),
    lines: AIR_EDGES.map((e) => ({ v: e.v, num: String(e.v), word: t(AQI_BAND_LABEL[e.band], lang) })),
    bars: tr.air.map((v, i) =>
      v == null
        ? null
        : {
            segs: [{ v, cls: RISK_BANDS[airLevel(v)] }],
            title: `${dayLabel(tr.days[i], lang)}: AQI ${v}, ${t(AQI_BAND_LABEL[aqiBand(v)], lang)}`,
          },
    ),
  });
}

/** The lead line: how often the air was at its worst level that month, over the days with a reading. */
export function airLead(levels: number[], lang: Lang): string {
  const d = levels.length;
  const at = (l: number) => levels.filter((x) => x === l).length;
  if (at(3)) return fill("Air was very poor or severe on {n} of {d} days.", lang, { n: at(3), d });
  if (at(2)) return fill("Air was poor on {n} of {d} days, never worse.", lang, { n: at(2), d });
  if (at(1)) return fill("Air was moderate on {n} of {d} days, never worse.", lang, { n: at(1), d });
  return fill("Air was good or satisfactory on every one of {d} days.", lang, { d });
}

/** The "Last 30 days" panel, or "" when there is nothing to show. */
/** The named place whose record a point borrows (or the nearest one, too far to borrow), by
 *  the name the page gives it, and its distance from the point. */
export interface Borrow {
  place: SlugPlace;
  name: string;
  km: number;
}
const kmText = (x: number) => (x < 10 ? x.toFixed(1) : String(Math.round(x)));

/** Too far to borrow: one line to the nearest place with a daily record. */
export function nearestRecordLine(b: Borrow, lang: Lang): string {
  const line = fill("The nearest place with a daily record is {place}, {km} km away.", lang, {
    place: b.name,
    km: kmText(b.km),
  });
  return `<p class="t-meta"><a href="${lp(`/c/${b.place.slug}`, lang)}">${esc(line)}</a></p>`;
}

/** A place's last 30 days. `from`: a point's page showing the nearest place's record, which
 *  every sentence names (never "here"), with links to that place's page. */
export function historyPanel(tr: PlaceTrend | null, lang: Lang, trendsHref?: string, from?: Borrow): string {
  if (!tr) return "";
  const n = tr.days.length;
  const others = OTHERS.map((h) => {
    const vals = tr[h.series].filter((v): v is number => v != null);
    const levels = vals.map(h.level);
    return { h, d: vals.length, raised: levels.filter((l) => l > 0).length, worst: Math.max(-1, ...levels) };
  }).filter((o) => o.d > 0);
  const airVals = tr.air.filter((v): v is number => v != null);
  if (!airVals.length && !others.length) return "";

  const parts: string[] = [];
  if (from)
    parts.push(
      `<p class="t-lead">${esc(
        fill("This is the record for {place}, {km} km from this point.", lang, {
          place: from.name,
          km: kmText(from.km),
        }),
      )} ${esc(fill("Air uses the stations within {r} km of the centre of {place}.", lang, { r: AIR_KM, place: from.name }))} ` +
        `<a href="${lp(`/c/${from.place.slug}`, lang)}">${esc(from.name)} →</a></p>`,
    );
  if (airVals.length) {
    const missing = n - airVals.length;
    const source =
      tr.stations === 1
        ? t("Each bar is a day: the worst AQI of the one station within 25 km.", lang)
        : fill("Each bar is a day: the worst AQI of the middle station of {s} within 25 km.", lang, { s: tr.stations });
    parts.push(
      `<p class="t-lead">${esc(airLead(airVals.map(airLevel), lang))}</p>` +
        `<p class="t-meta">${esc(source)} ${esc(t("Measured.", lang))}` +
        (missing
          ? ` ${esc(missing === 1 ? t("No reading on 1 day.", lang) : fill("No reading on {m} days.", lang, { m: missing }))}`
          : "") +
        `</p>` +
        airChart(tr, lang),
    );
  } else {
    // The live reading may still be measured (up to 50 km) or modelled: say why this record has none.
    parts.push(
      `<p class="t-lead">${esc(fill("This record has no air quality. It uses only the stations within {km} km, and none is that close.", lang, { km: AIR_KM }))}</p>`,
    );
  }

  // The raised hazards by their worst level, then how often; the calm ones share a line.
  const raised = others.filter((o) => o.worst > 0).sort((a, b) => b.worst - a.worst || b.raised - a.raised);
  const calm = others.filter((o) => o.worst <= 0);
  const lines = raised.map((o) => {
    const band = RISK_BANDS[o.worst];
    const word = t(LEVEL_WORD[band], lang);
    const say = fill("raised on {n} of {d} days, up to {level}.", lang, {
      n: o.raised,
      d: o.d,
      level: lang === "en" ? word.toLowerCase() : word,
    });
    return `<li>${shape(LEVEL_SHAPE[band])}<span><b>${esc(t(o.h.name, lang))}:</b> ${esc(say)}</span></li>`;
  });
  if (calm.length)
    lines.push(
      `<li>${shape(LEVEL_SHAPE.low)}<span><b>${esc(
        andList(
          calm.map((o) => t(o.h.name, lang)),
          lang,
        ),
      )}:</b> ${esc(t("low on every day.", lang))}</span></li>`,
    );
  const otherCol =
    `<p class="t-kicker">${esc(t("The other hazards", lang))}</p><ul class="tlist">${lines.join("")}</ul>` +
    `<p class="t-meta">${esc(t("Weather modelled by Open-Meteo; fires seen by satellite (NASA FIRMS), within 100 km.", lang))}</p>` +
    (trendsHref ? `<p>${linkButton(trendsHref, t("Every hazard, day by day", lang), false, "clock")}</p>` : "");

  return panel(`<div class="tsplit"><div>${parts.join("")}</div><div>${otherCol}</div></div>`, {
    title: from ? fill("Last 30 days in {place}", lang, { place: from.name }) : t("Last 30 days", lang),
    icon: "clock",
    tag: "section",
    id: "last30",
  });
}

/** A round scale for counts: the top and its half, labelled. */
function scale(peak: number): { max: number; lines: ChartLine[] } {
  const step = peak > 2000 ? 1000 : peak > 200 ? 100 : peak > 20 ? 10 : 1;
  const max = Math.max(step, Math.ceil(peak / step) * step);
  return { max, lines: [max / 2, max].map((v) => ({ v, num: v.toLocaleString("en-IN") })) };
}

/** The home page's "India, the last 30 days": the cities with poor or worse air each day (by
 *  their worst hour, very poor or severe below, poor above) and the fires across India. */
export function indiaPanel(tr: IndiaTrend | null, lang: Lang): string {
  if (!tr) return "";
  const from = Math.max(0, tr.days.length - TREND_DAYS);
  const days = tr.days.slice(from);
  const [cities, poor, very, fires] = [tr.cities, tr.poor, tr.very, tr.fires].map((a) => a.slice(from));
  const bad = days.map((_, i) => (cities[i] == null ? null : (poor[i] ?? 0) + (very[i] ?? 0)));
  let last = bad.length - 1;
  while (last >= 0 && bad[last] == null) last--;
  if (last < 0) return "";
  const peak = Math.max(...bad.map((v) => v ?? -1));
  const peakAt = bad.indexOf(peak);
  const lead =
    fill("Poor or worse air in {n} of {c} cities on {day}.", lang, {
      n: bad[last]!,
      c: cities[last]!,
      day: dayLabel(days[last], lang),
    }) +
    (peakAt !== last && peak > bad[last]!
      ? ` ${fill("At the peak, {day}, it was {n}.", lang, { day: dayLabel(days[peakAt], lang), n: peak })}`
      : "");

  const cs = scale(peak);
  const citiesChart = dayChart({
    days,
    lang,
    label: fill("Cities with poor or worse air, each day for {n} days", lang, { n: days.length }),
    max: cs.max,
    lines: cs.lines,
    bars: days.map((d, i) =>
      bad[i] == null
        ? null
        : {
            segs: [
              { v: very[i] ?? 0, cls: "severe" },
              { v: bad[i]!, cls: "high" },
            ],
            title: fill("{day}: {n} cities poor or worse, {v} very poor or severe", lang, {
              day: dayLabel(d, lang),
              n: bad[i]!,
              v: very[i] ?? 0,
            }),
          },
    ),
  });
  const fs = scale(Math.max(0, ...fires.map((v) => v ?? 0)));
  const firesChart = dayChart({
    days,
    lang,
    label: fill("Fires seen by satellite across India, each day for {n} days", lang, { n: days.length }),
    max: fs.max,
    lines: fs.lines,
    bars: fires.map((v, i) =>
      v == null
        ? null
        : { segs: [{ v, cls: "ink" }], title: fill("{day}: {n} fires", lang, { day: dayLabel(days[i], lang), n: v }) },
    ),
  });
  const noFire = fires.filter((v) => v == null).length;
  const key = (cls: string, level: "severe" | "high", en: string) =>
    `<span class="${cls}"><i></i>${shape(LEVEL_SHAPE[level])}${esc(t(en, lang))}</span>`;
  return panel(
    `<p class="t-lead">${esc(lead)}</p>` +
      `<div class="tsplit even"><div>` +
      `<p class="t-kicker">${esc(t("Cities with poor or worse air", lang))}</p>` +
      `<p class="t-meta">${esc(t("Cities with an air station, each by its worst hour of the day.", lang))} ${esc(t("Measured.", lang))}</p>` +
      `<p class="tkey">${key("severe", "severe", "Very poor or severe")}${key("high", "high", "Poor")}</p>` +
      citiesChart +
      `</div><div>` +
      `<p class="t-kicker">${esc(t("Fires seen by satellite", lang))}</p>` +
      `<p class="t-meta">${esc(t("Crop and forest burning across India, from NASA FIRMS.", lang))}` +
      (noFire
        ? ` ${esc(noFire === 1 ? t("No fire record on 1 day.", lang) : fill("No fire record on {m} days.", lang, { m: noFire }))}`
        : "") +
      `</p>` +
      firesChart +
      `</div></div>` +
      `<p class="t-meta">${esc(t("Pick a place on the map or in the list to see its own 30 days.", lang))}</p>`,
    { title: t("India, the last 30 days", lang), icon: "clock", tag: "section", id: "india30" },
  );
}
