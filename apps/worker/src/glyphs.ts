// The small graphics on the /c layers: each reading drawn against the limits
// mugilu already judges it by (score.ts THRESHOLDS, CPCB's standards), so the
// picture and the words can never disagree. Plain HTML + CSS (styled by GLYPH_CSS),
// except the compass and the rain drops (inline SVG). All are aria-hidden: the
// layer's text carries every number they show.

import { aqiBand, cpcbLimit, subIndex } from "./aqi";
import { pollutantParts } from "./formats";
import { BAND_COLOR, RISK_COLOR } from "./palette";
import type { AirPollutants } from "./types";

/** Hazard level (0-3) -> colour; level 0 is the quiet muted tone. */
const LEVEL_COLOR = ["var(--muted)", RISK_COLOR.moderate, RISK_COLOR.high, RISK_COLOR.severe];

const fix = (n: number) => +n.toFixed(1);

/** Where v sits on lo..hi, as a percentage pinned to 0-100 (log for spans like 100 m-10 km). */
function at(v: number, lo: number, hi: number, log = false): number {
  const p = log ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo);
  return fix(Math.max(0, Math.min(1, p)) * 100);
}

export interface GaugeOpts {
  /** Thresholds to mark on the track. */
  ticks?: readonly number[];
  /** Hazard level (0-3), the fill colour. */
  level?: number;
  log?: boolean;
  /** Fill only between this and the value (today against the normal), not from the start. */
  from?: number;
  /** A second, inner fill from the start (steady wind under the gusts). */
  under?: number;
  /** A dot at the value. */
  marker?: boolean;
  /** A colour other than the level's (above or below normal). */
  colour?: string;
}

/** A thin track filled to the reading, with a tick at each threshold. */
export function gauge(v: number, lo: number, hi: number, o: GaugeOpts = {}): string {
  const p = (x: number) => at(x, lo, hi, o.log);
  const a = o.from == null ? 0 : Math.min(p(o.from), p(v));
  const b = o.from == null ? p(v) : Math.max(p(o.from), p(v));
  const ticks = (o.ticks ?? []).map((x) => `<i class="gt" style="left:${p(x)}%"></i>`).join("");
  return (
    `<div class="g" style="--gc:${o.colour ?? LEVEL_COLOR[o.level ?? 0]}" aria-hidden="true">` +
    `<i class="gf" style="left:${a}%;width:${fix(b - a)}%"></i>` +
    (o.under != null ? `<i class="gu" style="width:${p(o.under)}%"></i>` : "") +
    ticks +
    (o.marker ? `<i class="gm" style="left:${p(v)}%"></i>` : "") +
    `</div>`
  );
}

/** The limit line sits at 40% of each pollutant's track (the track runs to 2.5x its limit). */
const LIMIT_SPAN = 2.5;

/** One bar per pollutant against its CPCB standard; over-limit bars take the CPCB
 *  band colour of their own sub-index, so the one driving the AQI stands out.
 *  `key` pollutants (the ones a persona should watch) are picked out. */
export function pollutantBars(p: AirPollutants, key: readonly string[] = []): string {
  return pollutantParts(p)
    .map((x) => {
      const limit = cpcbLimit(x.key);
      if (limit == null) return "";
      const over = x.value > limit;
      const colour = over ? BAND_COLOR[aqiBand(subIndex(x.key, x.value))] : "var(--muted)";
      const shown = x.key === "co" ? x.value : Math.round(x.value);
      return (
        `<div class="pr${over ? " over" : ""}${key.includes(x.key) ? " key" : ""}"><span>${x.label}</span>` +
        `<span class="pt" style="--gc:${colour}"><i class="pf" style="width:${at(x.value, 0, limit * LIMIT_SPAN)}%"></i><i class="pl"></i></span>` +
        `<b>${shown}</b></div>`
      );
    })
    .join("");
}

/** Years of life lost as blocks, one per year (the last partly filled), at most ten. */
export function lifeBlocks(years: number): string {
  const n = Math.min(10, Math.ceil(years));
  if (n <= 0) return "";
  const blocks = Array.from({ length: n }, (_, i) => {
    const w = years >= i + 1 ? 100 : Math.round((years - i) * 100);
    return `<s><i style="width:${w}%"></i></s>`;
  });
  return `<span class="lb" aria-hidden="true">${blocks.join("")}</span>`;
}

/** A compass with an arrow pointing where the wind blows TO (`from` is the
 *  meteorological direction it blows from), coloured by the wind level. */
export function compass(from: number, level: number): string {
  const to = (from + 180) % 360;
  const c = LEVEL_COLOR[level];
  return (
    `<svg class="cmp" viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">` +
    `<circle cx="24" cy="24" r="21" fill="none" stroke="var(--hair)" stroke-width="1.5"/>` +
    `<text x="24" y="8.5" text-anchor="middle">N</text>` +
    `<g transform="rotate(${to} 24 24)" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
    `<path d="M24 38V11M17 18l7-7 7 7"/></g></svg>`
  );
}

const DROP = (x: number) =>
  `M${x + 7} 1C${x + 7} 1 ${x + 1} 8 ${x + 1} 12a6 6 0 0 0 12 0C${x + 13} 8 ${x + 7} 1 ${x + 7} 1Z`;

/** Ten drops, one filled for every full 10% chance of rain. */
export function drops(pct: number): string {
  const on = Math.min(10, Math.floor(pct / 10));
  const d = Array.from({ length: 10 }, (_, i) => `<path${i < on ? ' class="on"' : ""} d="${DROP(i * 17)}"/>`);
  return `<svg class="drops" viewBox="0 0 170 19" width="170" height="19" aria-hidden="true">${d.join("")}</svg>`;
}

/** The WHO UV colours for each step of the index (1-11+). */
function uvColour(step: number): string {
  if (step <= 2) return "#16a34a";
  if (step <= 5) return "#eab308";
  if (step <= 7) return "#f97316";
  if (step <= 10) return "#dc2626";
  return "#7e22ce";
}

/** Eleven steps of the UV index, lit up to today's, the current one outlined. */
export function uvSteps(index: number): string {
  const now = Math.min(11, Math.round(index));
  const steps = Array.from({ length: 11 }, (_, i) => {
    const s = i + 1;
    const cls = s < now ? ' class="on"' : s === now ? ' class="on now"' : "";
    return `<i${cls} style="--uc:${uvColour(s)}"></i>`;
  });
  return `<span class="uv" aria-hidden="true">${steps.join("")}</span>`;
}

/** Styles for the graphics above (appended to the /c page's CSS). */
export const GLYPH_CSS = `
.g{position:relative;height:6px;border-radius:3px;margin:.6rem 0 .25rem;max-width:15rem;background:var(--line)}
.g i{position:absolute;display:block}
.g .gf{top:0;bottom:0;border-radius:3px;background:var(--gc)}
.g .gu{top:0;bottom:0;left:0;border-radius:3px;background:var(--ink);opacity:.55}
.g .gt{top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:var(--ink);opacity:.55}
.g .gm{top:50%;width:11px;height:11px;border-radius:50%;background:var(--gc);box-shadow:0 0 0 2.5px var(--bg);transform:translate(-50%,-50%)}
.gl{display:block;margin-top:.45rem;font-size:.8rem;color:var(--muted)}
.gl b{color:var(--ink)}
.gl.key{color:var(--ink);font-weight:600}
.gl+.g{margin-top:.3rem}
.prs{display:grid;gap:.3rem;margin:.6rem 0 .2rem;max-width:17rem}
.pr{display:grid;grid-template-columns:3.9rem 1fr 2.6rem;align-items:center;gap:.5rem;font-size:.78rem;color:var(--muted);font-variant-numeric:tabular-nums}
.pr b{font-weight:500;text-align:right}
.pr.over{color:var(--ink)}
.pr.over b{font-weight:700}
.pr.key>span:first-child{color:var(--ink);font-weight:700}
.pr.key>span:first-child::after{content:"";display:inline-block;width:5px;height:5px;margin-left:.3rem;border-radius:50%;background:var(--cond);vertical-align:.15em}
.pt{position:relative;height:8px;border-radius:2px;background:var(--line)}
.pt .pf{position:absolute;top:0;bottom:0;left:0;border-radius:2px;background:var(--gc)}
.pt .pl{position:absolute;top:-3px;bottom:-3px;left:40%;width:0;border-left:1.5px dashed var(--ink)}
.prk{font-size:.72rem;color:var(--muted)}
.lb{display:inline-flex;gap:2px;vertical-align:-1px;margin-right:.4rem}
.lb s{position:relative;width:12px;height:9px;border-radius:2px;background:var(--line);overflow:hidden}
.lb i{position:absolute;top:0;bottom:0;left:0;background:var(--muted)}
.wrow{display:flex;align-items:center;gap:.8rem;max-width:17rem}
.wrow .g{flex:1}
.cmp{flex:none;color:var(--muted)}
.cmp text{font:600 7px var(--sans);fill:currentColor}
.drops{display:block;margin:.6rem 0 .2rem;max-width:100%}
.drops path{fill:var(--line)}
.drops path.on{fill:var(--sky)}
.uv{display:flex;gap:2px;margin:.6rem 0 .25rem;max-width:15rem}
.uv i{flex:1;height:10px;border-radius:2px;background:var(--uc);opacity:.18}
.uv i.on{opacity:.9}
.uv i.now{opacity:1;box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--ink)}
`;
