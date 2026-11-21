import { aqiBand, AQI_BAND_LABEL } from "../aqi";
import { esc } from "../html";
import { andList, LOCALE, t, type Lang } from "../i18n";
import type { PlaceTrend, Series } from "../placedaily";
import {
  airLevelOf,
  coldLevelOf,
  dustLevelOf,
  fogLevelOf,
  heatLevelOf,
  rainLevelOf,
  RISK_BANDS,
  smokeCountLevelOf,
  uvLevelOf,
  windLevelOf,
} from "../score";
import { LEVEL_SHAPE, LEVEL_WORD, panel, shape } from "./components";

// The place page's "Last 30 days" (placedaily.ts keeps the record): the air a day at a time, a
// bar a day filled by its level with the level edges drawn, so the level reads from position as
// well as colour; then each other hazard in one line, how often it was raised and how far.

/** The other hazards, each by the series that measures it. */
const OTHERS: { name: string; series: Series; level: (v: number) => number }[] = [
  { name: "Heat", series: "feels_max", level: (v) => heatLevelOf({ apparent_c: v }) },
  { name: "Cold", series: "feels_min", level: coldLevelOf },
  { name: "Rain", series: "rain_mm", level: rainLevelOf },
  { name: "Wind", series: "gust_kmh", level: windLevelOf },
  { name: "Fog", series: "vis_min_m", level: fogLevelOf },
  { name: "Dust", series: "dust_max", level: dustLevelOf },
  { name: "Smoke", series: "fires", level: smokeCountLevelOf },
  { name: "UV", series: "uv_max", level: uvLevelOf },
];

const airLevel = (aqi: number) => airLevelOf(aqiBand(aqi)) ?? 0;
/** The CPCB band edges drawn on the air chart. */
const AIR_EDGES = [
  { v: 101, band: "moderate" },
  { v: 201, band: "poor" },
  { v: 301, band: "vpoor" },
  { v: 401, band: "severe" },
] as const;

const fill = (en: string, lang: Lang, slots: Record<string, string | number>) =>
  Object.entries(slots).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), t(en, lang));

/** "21 Oct" in the page's language, for a YYYY-MM-DD day. */
function dayLabel(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", timeZone: "UTC" }).format(
    Date.parse(`${day}T00:00:00Z`),
  );
}

/** The air chart: a bar a day (its height the AQI, its fill the level), the band edges as
 *  labelled dashed lines, the dates under it. */
function airChart(tr: PlaceTrend, lang: Lang): string {
  const W = 600;
  const PLOT = 476; // the edge labels sit in the margin to the right
  const H = 150;
  const top = 8;
  const bottom = 18;
  const vals = tr.air.filter((v): v is number => v != null);
  const peak = Math.max(...vals);
  const max = Math.max(peak, ...AIR_EDGES.filter((e) => e.v <= peak * 1.6).map((e) => e.v)) * 1.08;
  const y = (v: number) => top + (H - top - bottom) * (1 - Math.max(0, v) / max);
  const n = tr.days.length;
  const bw = PLOT / n;
  const bars = tr.air
    .map((v, i) => {
      const x = (i * bw + 1).toFixed(1);
      const w = (bw - 2).toFixed(1);
      if (v == null) return `<rect class="tnone" x="${x}" y="${top}" width="${w}" height="${H - top - bottom}"/>`;
      const band = RISK_BANDS[airLevel(v)];
      const yy = y(v);
      const say = `${dayLabel(tr.days[i], lang)}: AQI ${v}, ${t(AQI_BAND_LABEL[aqiBand(v)], lang)}`;
      return `<rect class="tbar ${band}" x="${x}" y="${yy.toFixed(1)}" width="${w}" height="${(H - bottom - yy).toFixed(1)}" rx="2"><title>${esc(say)}</title></rect>`;
    })
    .join("");
  let lastY = Infinity;
  const lines = AIR_EDGES.filter((e) => e.v < max)
    .map((e) => {
      const yy = y(e.v);
      const ly = Math.min(yy + 4, lastY - 20); // labels apart even at the phone size, going up
      lastY = ly;
      return (
        `<line class="tedge" x1="0" x2="${PLOT + 4}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>` +
        `<text class="tlab" x="${PLOT + 6}" y="${ly.toFixed(1)}"><tspan class="w">${esc(t(AQI_BAND_LABEL[e.band], lang))}\u00a0</tspan>${e.v}</text>`
      );
    })
    .join("");
  const ticks = [0, 7, 14, 21, n - 1]
    .map(
      (i) =>
        `<text class="ttick${i === 0 || i === n - 1 ? "" : " mid"}" x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(dayLabel(tr.days[i], lang))}</text>`,
    )
    .join("");
  const label = fill("Air, the worst AQI of each day, for {n} days", lang, { n });
  return `<svg class="tchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${lines}${bars}${ticks}</svg>`;
}

/** The lead line: how often the air was at its worst level that month, over the days with a reading. */
function airLead(levels: number[], lang: Lang): string {
  const d = levels.length;
  const at = (l: number) => levels.filter((x) => x === l).length;
  if (at(3)) return fill("Air was very poor or severe on {n} of {d} days.", lang, { n: at(3), d });
  if (at(2)) return fill("Air was poor on {n} of {d} days, never worse.", lang, { n: at(2), d });
  if (at(1)) return fill("Air was moderate on {n} of {d} days, never worse.", lang, { n: at(1), d });
  return fill("Air was good or satisfactory on every one of {d} days.", lang, { d });
}

/** The "Last 30 days" panel, or "" when there is nothing to show. */
export function historyPanel(tr: PlaceTrend | null, lang: Lang): string {
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
    parts.push(`<p class="t-lead">${esc(t("No air station within 25 km.", lang))}</p>`);
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
    `<p class="t-meta">${esc(t("Weather and dust modelled by Open-Meteo; fires seen by satellite (NASA FIRMS), within 100 km.", lang))}</p>`;

  return panel(`<div class="tsplit"><div>${parts.join("")}</div><div>${otherCol}</div></div>`, {
    title: t("Last 30 days", lang),
    icon: "clock",
    tag: "section",
    id: "last30",
  });
}
