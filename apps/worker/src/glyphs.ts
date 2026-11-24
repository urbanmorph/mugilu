// The small graphics on a place's readings: each reading drawn against the limits
// mugilu already judges it by (score.ts THRESHOLDS, CPCB's standards), so the picture
// and the words can never disagree. Markup for the standard's .gauge, .bars (BarRow)
// and .uvs; a level is a class (--lv), never a colour. All are aria-hidden: the
// reading's text carries every number they show.

import type { Lang } from "./i18n";
import { aqiBand, cpcbLimit, subIndex } from "./aqi";
import { pollutantParts } from "./formats";
import { gaugePos } from "./readings";
import { RISK_BANDS, uvLevelOf } from "./score";
import { barRows } from "./ui/components";
import type { AirPollutants } from "./types";

const fix = (n: number) => +n.toFixed(1);
const at = gaugePos;

export interface GaugeOpts {
  /** Thresholds to mark on the track. */
  ticks?: readonly number[];
  /** Hazard level (0-3): the fill's level class (0: quiet). */
  level?: number;
  log?: boolean;
  /** Fill only between this and the value (today against the normal), not from the start. */
  from?: number;
  /** A mark at the value. */
  marker?: boolean;
  /** A level class other than the level's (today above the normal). */
  cls?: string;
  /** The thresholds in order of severity (moderate, high, severe): the track becomes the scale,
   *  each zone in its level's colour, shown in full up to the reading, with a dot at it. The
   *  ticks default to these. Falling thresholds (cold, visibility) put the worst on the left. */
  zones?: readonly number[];
}

/** How far each zone's colour blends into the next, in points of the track. */
const BLEND = 3;

/** The scale as a gradient of the level tokens, zone edges at the thresholds' places. */
function zoneScale(edges: number[]): string {
  const up = edges[0] <= edges[edges.length - 1];
  const at = up ? edges : [...edges].reverse();
  const names = up ? RISK_BANDS : [...RISK_BANDS].reverse();
  const stops = [`var(--${names[0]}) 0%`];
  at.forEach((e, i) =>
    stops.push(`var(--${names[i]}) ${fix(e - BLEND)}%`, `var(--${names[i + 1]}) ${fix(e + BLEND)}%`),
  );
  stops.push(`var(--${names[at.length]}) 100%`);
  return `linear-gradient(90deg,${stops.join(",")})`;
}

/** A track filled to the reading, with a tick at each threshold. */
export function gauge(v: number, lo: number, hi: number, o: GaugeOpts = {}): string {
  const p = (x: number) => at(x, lo, hi, o.log);
  const a = o.from == null ? 0 : Math.min(p(o.from), p(v));
  const b = o.from == null ? p(v) : Math.max(p(o.from), p(v));
  const ticks = (o.ticks ?? o.zones ?? []).map((x) => `<i class="tk" style="left:${p(x)}%"></i>`).join("");
  if (o.zones?.length) {
    const cls = o.cls ?? RISK_BANDS[o.level ?? 0];
    return (
      `<div class="gauge zoned ${cls}" style="--grad:${zoneScale(o.zones.map(p))}" aria-hidden="true">` +
      `<i class="f" style="clip-path:inset(0 ${fix(100 - b)}% 0 ${a}%)"></i>` +
      ticks +
      `<i class="dot" style="--at:${p(v)}%"></i></div>`
    );
  }
  const cls = o.cls ?? (o.level ? RISK_BANDS[o.level] : "");
  return (
    `<div class="gauge${cls ? ` ${cls}` : ""}" aria-hidden="true">` +
    `<i class="f" style="left:${a}%;width:${fix(b - a)}%"></i>` +
    ticks +
    (o.marker ? `<i class="mk" style="left:${p(v)}%"></i>` : "") +
    `</div>`
  );
}

/** The limit line sits at 40% of each pollutant's track (the track runs to 2.5x its limit). */
const LIMIT_SPAN = 2.5;

/** One BarRow per pollutant against its CPCB standard; an over-limit bar takes the CPCB band
 *  of its own sub-index, so the one driving the AQI stands out. */
/** Each pollutant against its CPCB limit; with `lang`, the key line under the bars. */
export function pollutantBars(p: AirPollutants, lang?: Lang): string {
  const items = pollutantParts(p).flatMap((x) => {
    const limit = cpcbLimit(x.key);
    if (limit == null) return [];
    return [
      {
        label: x.label,
        value: String(x.key === "co" ? x.value : Math.round(x.value)),
        pct: at(x.value, 0, limit * LIMIT_SPAN),
        band: x.value > limit ? aqiBand(subIndex(x.key, x.value)) : undefined,
      },
    ];
  });
  return items.length ? barRows(items, 100 / LIMIT_SPAN, lang) : "";
}

/** The one pollutant a small tile shows: the persona's own (first present), else
 *  the one furthest over its CPCB limit. Null when none has a limit. */
export function worstPollutant(p: AirPollutants, key: readonly string[] = []): AirPollutants | null {
  const parts = pollutantParts(p).filter((x) => cpcbLimit(x.key) != null);
  const pick =
    parts.find((x) => key.includes(x.key)) ??
    parts.sort((a, b) => b.value / cpcbLimit(b.key)! - a.value / cpcbLimit(a.key)!)[0];
  return pick ? ({ [pick.key]: pick.value } as AirPollutants) : null;
}

/** The WHO UV steps as levels: 1-2 low, 3-5 moderate, 6-7 high, 8-10 severe, 11+ extreme. */
/** Eleven steps of the UV index, lit up to today's, the current one marked; each step in
 *  the level the read gives it (score.ts THRESHOLDS.uv), so the steps and the chip agree. */
export function uvSteps(index: number): string {
  const now = Math.min(11, Math.round(index));
  const steps = Array.from({ length: 11 }, (_, i) => {
    const s = i + 1;
    return `<i class="${RISK_BANDS[uvLevelOf(s)]}${s === now ? " now" : s > now ? " off" : ""}"></i>`;
  });
  return `<span class="uvs" aria-hidden="true">${steps.join("")}</span>`;
}
