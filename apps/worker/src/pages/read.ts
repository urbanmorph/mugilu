import { type Conditions, type NormalizedStation, type Warning } from "../types";
import { AQI_BAND_LABEL } from "../aqi";
import { compass, drops, gauge, lifeBlocks, pollutantBars, uvSteps, worstPollutant } from "../glyphs";
import { forPersona, isDriver, km } from "../readings";
import { esc } from "../html";
import {
  PERSONAS,
  PERSONA_LABEL,
  RISK_BANDS,
  THRESHOLDS,
  airLevelOf,
  coldLevelOf,
  dustLevelOf,
  fogLevelOf,
  headline,
  heatLevelOf,
  smokeLevel,
  type AmbientRisk,
  type Persona,
  type RiskBand,
  windLevelOf,
} from "../score";
import { RISK_COLOR, levelColor, tintOf } from "../palette";
import { t, type Lang } from "../i18n";
import { HAZARDS_SHORT } from "../hazards";
import { NORMALS_LABEL, heatVsNormalLine, heatVsNormalShown } from "../heatnormals";

// The worker-rendered HTML pages. Layperson-first, mobile-first, self-contained
// (inline CSS, no framework). All pages share chrome via shell().
//
// ── Design language (one set, applied to EVERY page) ────────────────────────
// Editorial serif display (--serif) for headlines/leads; system sans (--sans)
// for data and labels; mono (--mono) for coordinate/format stamps; hairline
// rules (--hair); a condition- or sky-tinted atmospheric backdrop; and the
// inline Lucide-style line icons in ICON/icon(), never emoji. Tokens live in
// BASE_CSS :root and reach home, /c, about, terms and 404 alike.

export /** Whether an upstream URL is fit for an href: http(s) only (no javascript: etc.). */
function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

export function round(n: number | undefined): string {
  return n == null ? "n/a" : String(Math.round(n));
}

export function uvWord(index: number | undefined): string {
  if (index == null) return "n/a";
  if (index < 1) return "none";
  if (index < 3) return "low";
  if (index < 6) return "moderate";
  if (index < 8) return "high";
  if (index < 11) return "very high";
  return "extreme";
}

// The words below name the same levels the Ambient read uses (score.ts THRESHOLDS),
// so a tile can never call dust "high" while the read says it is fine.

export /** Dust's risk band (low / moderate / high / severe), the word on its tile and hero. */
const dustBand = (ug: number): RiskBand => RISK_BANDS[dustLevelOf(ug)];

/** Wind word: the hazard levels, plus "breezy" for a sub-hazard 20+ km/h. */
export function windWord(gust: number): string {
  const level = windLevelOf(gust);
  if (level) return ["strong", "gale", "storm-force"][level - 1];
  return gust >= 20 ? "breezy" : "calm";
}

/** 8-point compass label for the direction wind blows FROM. */
export function compassDir(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

/** Visibility word: the fog levels, then the sub-hazard haze below 5 km. */
export function visWord(meters: number): string {
  const level = fogLevelOf(meters);
  if (level) return ["fog", "thick fog", "dense fog"][level - 1];
  if (meters < 2000) return "misty";
  if (meters < 5000) return "hazy";
  return "clear";
}

export function heatPhrase(apparent: number, wetBulb?: number): string {
  if (wetBulb != null && heatLevelOf({ wet_bulb_c: wetBulb }) >= 2) return "dangerous humid heat";
  const hot = heatLevelOf({ apparent_c: apparent });
  if (hot) return ["very hot", "severe heat", "extreme heat"][hot - 1];
  const cold = coldLevelOf(apparent);
  if (cold) return ["cold", "very cold", "dangerous cold"][cold - 1];
  return "warm";
}

/** Fire activity nearby per smoke level (1-3); index 0 is unused. */
export const SMOKE_PHRASE = ["", "some burning", "notable burning", "heavy burning"];

export const DUST_PHRASE: Record<RiskBand, string> = {
  low: "light dust",
  moderate: "moderate dust",
  high: "high dust",
  severe: "severe dust",
};

// Risk band of each highlight, so the hero can wear the severity of what it
// shows, mapped to the four-step risk palette the /c page uses.
export const heatBand = (apparent?: number, wb?: number): RiskBand =>
  RISK_BANDS[heatLevelOf({ apparent_c: apparent, wet_bulb_c: wb })];
export const airBand = (b: NormalizedStation["band"]): RiskBand => RISK_BANDS[airLevelOf(b) ?? 0];

/** The "right now in India" hero. Heat- and dust-led from the 4-hourly grid,
 *  plus a worst-air row from the hourly snapshot, each row state-qualified (so
 *  the place is recognisable), stamped with its own freshness, and coloured by
 *  its severity; the whole card takes the tint of the worst extreme, like /c. */
export function warnColor(color: string): string {
  switch (color.toLowerCase()) {
    case "red":
      return RISK_COLOR.severe;
    case "orange":
      return RISK_COLOR.high;
    case "yellow":
      return RISK_COLOR.moderate;
    default:
      return "#64748b";
  }
}

// Inline Lucide-style line icons (MIT). currentColor + one stroke weight, so each
// inherits its context colour (muted by default, the condition hue on the driver).
export const ICON: Record<string, string> = {
  screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  air: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  heat: '<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  cold: '<path d="M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  dust: '<path d="M5.2 6.2 6.6 7.6M2 13h2M20 13h2M17.4 7.6l1.4-1.4M22 17H2M22 21H2"/><path d="M16 13a4 4 0 0 0-8 0"/>',
  smoke:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  rain: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  wind: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/>',
  fog: '<path d="M4 8h16M6 12h14M4 16h12M8 20h10"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  layers:
    '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};
ICON.clear = ICON.sun;

export function icon(name: string): string {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ""}</svg>`;
}

// Ambient driver -> icon key, and the noun for the headline ("High heat.").
export const DRIVER_KEY: Record<string, string> = {
  Air: "air",
  Heat: "heat",
  Cold: "cold",
  UV: "sun",
  Dust: "dust",
  Wind: "wind",
  Fog: "fog",
  Smoke: "smoke",
  Warning: "warn",
  none: "clear",
};

/** Wet-bulb survivability read (~31 is the theoretical limit): word + colour per level. */
export const WET_BULB = ["safe", "caution", "severe", "dangerous"];
export const wetBulb = (wb: number): [string, string] => {
  const level = heatLevelOf({ wet_bulb_c: wb });
  return [WET_BULB[level], levelColor(level)];
};

/** One reading as a hairline-ruled stratum: icon + label, a big figure, a tail,
 *  and an optional inline scale showing where it sits on the good->severe range. */
export interface Layer {
  key: string;
  html: string;
}

/** What every layer needs to know about the read: whose it is, and the words for
 *  the persona's tag in the page's language. */
export interface LayerCtx {
  risk: AmbientRisk;
  forYou: string;
}

export function lyr(key: string, label: string, ctx: LayerCtx, num: string, q: string, sub: string, bar = ""): Layer {
  const { risk } = ctx;
  // For a persona: their own layers tagged, the rest quieter, except the headline
  // hazard, which stays at full strength (everyone: neither).
  const own = risk.persona === "everyone" ? "" : forPersona(key, risk) ? " mine" : isDriver(key, risk) ? "" : " quiet";
  const tag = own === " mine" ? `<span class="fy">${ctx.forYou}</span>` : "";
  const html = `<div class="lyr${isDriver(key, risk) ? " on" : ""}${own}" data-k="${key}"><dt>${icon(key)}<span>${label}</span>${tag}</dt><dd><span class="num">${num}</span><span class="q">${q}</span>${bar}${sub ? `<span class="sub">${sub}</span>` : ""}</dd></div>`;
  return { key, html };
}

/** The reading inside a layer each persona should look at first: the fine
 *  particles that reach the lungs and heart (PM2.5; PM10 too for the airways),
 *  wet-bulb for bodies that cool less well, and WBGT, the measure made for work
 *  in the heat. */
export const KEY_READING: Record<Persona, { pollutants: string[]; heat?: "wbgt" | "wetbulb" }> = {
  everyone: { pollutants: [] },
  asthma: { pollutants: ["pm25", "pm10"] },
  elderly: { pollutants: ["pm25"], heat: "wetbulb" },
  child: { pollutants: ["pm25"] },
  outdoor: { pollutants: ["pm25"], heat: "wbgt" },
  heart: { pollutants: ["pm25"], heat: "wetbulb" },
};

/** The persona toggles (understated text links), the current one marked. */
export function personaLinks(href: (p: Persona) => string, current: Persona, lang: Lang): string {
  return PERSONAS.map(
    (p) => `<a${p === current ? ' class="on"' : ""} href="${href(p)}">${esc(t(PERSONA_LABEL[p], lang))}</a>`,
  ).join("");
}

/** The editorial headline, "High heat." with the band word coloured, or "All clear." */
export function headHtml(risk: AmbientRisk, lang: Lang): string {
  const h = headline(risk, (en) => t(en, lang));
  return h.noun ? `<span class="b">${h.word}</span> ${h.noun}.` : `<span class="b">${h.word}.</span>`;
}

/** Whether the air reading is older than the page by half an hour or more (stations
 *  report on their own clock, often an hour or two behind), so it is named apart. */
export function airLag(c: Conditions): boolean {
  return !!c.air_as_of && Date.parse(c.as_of) - Date.parse(c.air_as_of) >= 30 * 60_000;
}

/** CSS custom properties for a read's colours: --cond (severity, the headline word)
 *  and --tint/--tk (the backdrop: the hazard's hue at the band's strength). */
export function readVars(risk: AmbientRisk): string {
  const { hue, strength } = tintOf(risk);
  return `--cond:${RISK_COLOR[risk.band]};--cond-text:var(--rt-${risk.band});--tint:${hue};--tk:${strength}%`;
}

/** A pinned official warning, the most urgent thing on the page. */
export function renderWarning(w: Warning, lang: Lang): string {
  const meta = [w.severity, w.until ? t("until X", lang).replace("X", w.until) : ""].filter(Boolean).join(" · ");
  return `<div class="warn" style="--wc:${warnColor(w.color)}">${icon("warn")}<div><b>${esc(w.event)}</b>${meta ? ` · ${esc(meta)}` : ""}<span class="wsrc">${t("Official warning", lang)} · ${esc(w.issuer)}</span></div></div>`;
}

/** Warnings active nearby whose areas do not cover this spot: one quiet line, never the red box. */
export function renderNearbyWarnings(ws: Warning[], lang: Lang): string {
  // One entry per kind: a count when several areas nearby have it, else its end time.
  const byEvent = new Map<string, Warning[]>();
  for (const w of ws) byEvent.set(w.event, [...(byEvent.get(w.event) ?? []), w]);
  const items = [...byEvent]
    .map(([event, list]) => {
      const one = list.length === 1 ? list[0] : undefined;
      const detail = one ? (one.until ? t("until X", lang).replace("X", one.until) : "") : String(list.length);
      return `${esc(event)}${detail ? ` (${esc(detail)})` : ""}`;
    })
    .join(" · ");
  return `<p class="near-warn">${t("Near this point, but not at it:", lang)} ${items}</p>`;
}

// Records this /c visit into the browser's "Your places" list (first-party,
// localStorage; no login, no server). The reverse-geocoded label is read from
// the page so "use my location" shows a name, not raw coordinates.
export const PLACE_RECORDER = `<script>
(function(){try{
var pp=location.pathname.split('/');
if(pp[1]!=='c'||!pp[2])return;
var id=decodeURIComponent(pp[2]),el=document.querySelector('h1.loc');
// Coordinate comes from the URL (/c/lat,lon) or the page (named /c/slug pages).
var ll=(el&&el.getAttribute('data-ll'))||id,c=ll.split(',');
if(c.length<2||isNaN(+c[0]))return;
var label=el?el.textContent.trim():id;
// If they searched in a native script, remember it in that script (passed via #q=).
var h=location.hash.match(/[#&]q=([^&]+)/);
if(h){var q=decodeURIComponent(h[1]);if(/[^\\x00-\\x7F]/.test(q))label=q;}
var K='mugilu:places',L;try{L=JSON.parse(localStorage.getItem(K))||[]}catch(e){L=[]}
var p=L.filter(function(x){return x.id===id})[0];
if(p){p.n=(p.n||0)+1;p.t=Date.now();if(!p.name)p.label=label}
else{L.push({id:id,lat:c[0],lon:c[1],label:label,n:1,t:Date.now(),fav:false})}
L.sort(function(a,b){return (b.fav?1:0)-(a.fav?1:0)||b.n-a.n||b.t-a.t});
var f=L.filter(function(x){return x.fav}),r=L.filter(function(x){return !x.fav}).slice(0,Math.max(0,12-f.length));
localStorage.setItem(K,JSON.stringify(f.concat(r)));
if(location.hash)try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
}catch(e){}})();
</script>`;

/** One layer's content, rendered as a /c stratum or a display tile. `mini` is the
 *  tile's compact graphic (default: `bar`); `normal` is the heat-vs-normal ruler,
 *  which the /c page puts in the heat layer and the display beside the read. */
export interface LayerData {
  key: string;
  label: string;
  num: string;
  q: string;
  sub: string;
  bar: string;
  mini?: string;
  normal?: string;
}

/** Every reading present, as layers (unordered: see orderByRisk). */
export function layerData(c: Conditions, risk: AmbientRisk, lang: Lang): LayerData[] {
  const out: LayerData[] = [];
  const keyReading = KEY_READING[risk.persona];
  const L = (key: string, label: string, num: string, q: string, sub: string, bar = ""): LayerData => ({
    key,
    label,
    num,
    q,
    sub,
    bar,
  });
  const band = c.air?.band ?? "unknown";
  const bandLabel = AQI_BAND_LABEL[band] ?? "n/a";
  // The readings, as strata. Each renders only when it has a value; the Ambient
  // driver's stratum is highlighted (icon + label in the condition colour).
  if (c.air) {
    const marker = c.air.station
      ? `<i class="dot meas"></i>${t("measured", lang)} · ${c.air.station.distance_km} km`
      : `<i class="dot mod"></i>${t("modelled", lang)}`;
    const aqli = c.air.yll != null ? `<br>${lifeBlocks(c.air.yll)}~${c.air.yll} ${t("years of life lost", lang)}` : "";
    const bars = pollutantBars(c.air.pollutants, keyReading.pollutants);
    const worst = worstPollutant(c.air.pollutants, keyReading.pollutants);
    out.push({
      ...L(
        "air",
        t("Air", lang),
        c.air.aqi != null ? String(c.air.aqi) : "n/a",
        `<span class="qa">AQI</span> <b style="color:var(--bt-${band})">${t(bandLabel, lang)}</b>`,
        `${marker}${aqli}`,
        bars
          ? `<div class="prs">${bars}<span class="prk">${t("The dashed line is the CPCB limit.", lang)}</span></div>`
          : "",
      ),
      mini: worst ? `<div class="prs">${pollutantBars(worst, keyReading.pollutants)}</div>` : "",
    });
  }
  if (c.heat) {
    const h = c.heat;
    const cold = h.apparent_c != null && coldLevelOf(h.apparent_c) > 0;
    let bar = "";
    // Cold: a dot for how cold it feels among the cold thresholds. Hot or mild:
    // the two heat-stress reads against theirs.
    if (cold) {
      const a = h.apparent_c!;
      bar += gauge(a, -10, 30, { from: a, ticks: THRESHOLDS.cold, level: coldLevelOf(a), marker: true });
    } else {
      if (h.wet_bulb_c != null) {
        const [wn, wc] = wetBulb(h.wet_bulb_c);
        bar += `<span class="gl${keyReading.heat === "wetbulb" ? " key" : ""}">${t("wet-bulb", lang)} ${round(h.wet_bulb_c)}° <b style="color:${wc}">${t(wn, lang)}</b></span>`;
        bar += gauge(h.wet_bulb_c, 10, 35, {
          ticks: THRESHOLDS.wetBulb,
          level: heatLevelOf({ wet_bulb_c: h.wet_bulb_c }),
        });
      }
      if (h.wbgt_c != null) {
        bar += `<span class="gl${keyReading.heat === "wbgt" ? " key" : ""}">WBGT ${round(h.wbgt_c)}°</span>`;
        bar += gauge(h.wbgt_c, 15, 40, { ticks: THRESHOLDS.wbgt, level: heatLevelOf({ wbgt_c: h.wbgt_c }) });
      }
    }
    // Today's high against the normal here: drawn only when it stands out (and is
    // still today's, in IST), always labelled.
    const n = c.heat_vs_normal;
    let normal = "";
    if (heatVsNormalShown(n)) {
      normal += `<span class="gl">${heatVsNormalLine(n, lang)}</span>`;
      normal += gauge(n.today_max_c, n.normal_max_c - 10, n.normal_max_c + 10, {
        from: n.normal_max_c,
        ticks: [n.normal_max_c],
        marker: true,
        colour: n.anomaly_c >= 0 ? RISK_COLOR.high : "var(--sky)",
      });
      normal += `<small class="prk">${t(NORMALS_LABEL, lang)}</small>`;
    }
    out.push({
      ...L(
        "heat",
        t("Heat", lang),
        `${round(h.apparent_c)}°`,
        // No feels-like, no phrase (never read a missing value as 0°, "dangerous cold").
        h.apparent_c != null
          ? `<span class="qa">${t("feels like", lang)}</span> <b>${t(heatPhrase(h.apparent_c, h.wet_bulb_c), lang)}</b>`
          : "",
        "",
        `<span class="sub">${round(h.temp_c)}° ${t("actual", lang)} · ${round(h.humidity_pct)}% ${t("humidity", lang)}</span>${bar}`,
      ),
      mini: bar,
      normal,
    });
  }
  if (c.uv?.index != null) {
    out.push(
      L(
        "sun",
        t("Sun", lang),
        String(Math.round(c.uv.index)),
        `<span class="qa">${t("UV index", lang)}</span> <b>${t(uvWord(c.uv.index), lang)}</b>`,
        "",
        uvSteps(c.uv.index),
      ),
    );
  }
  if (c.dust?.dust_ug_m3 != null) {
    out.push(
      L(
        "dust",
        t("Dust", lang),
        String(Math.round(c.dust.dust_ug_m3)),
        `<span class="qa nu">µg/m³</span> <b>${t(dustBand(c.dust.dust_ug_m3), lang)}</b>`,
        "",
        gauge(c.dust.dust_ug_m3, 0, 600, { ticks: THRESHOLDS.dust, level: dustLevelOf(c.dust.dust_ug_m3) }),
      ),
    );
  }
  if (c.wind && (c.wind.gust_kmh != null || c.wind.speed_kmh != null)) {
    const gust = c.wind.gust_kmh ?? c.wind.speed_kmh!;
    const dirParts: string[] = [];
    if (c.wind.direction_deg != null) dirParts.push(t("from X", lang).replace("X", compassDir(c.wind.direction_deg)));
    if (c.wind.speed_kmh != null)
      dirParts.push(t("X km/h steady", lang).replace("X", String(Math.round(c.wind.speed_kmh))));
    out.push(
      L(
        "wind",
        t("Wind", lang),
        String(Math.round(gust)),
        `<span class="qa nu">km/h ${t("gusts", lang)}</span> <b>${t(windWord(gust), lang)}</b>`,
        dirParts.join(" · "),
        `<div class="wrow">${c.wind.direction_deg != null ? compass(c.wind.direction_deg, windLevelOf(gust)) : ""}${gauge(gust, 0, 100, { under: c.wind.speed_kmh, ticks: THRESHOLDS.wind, level: windLevelOf(gust) })}</div>`,
      ),
    );
  }
  // Visibility only surfaces when reduced (hazy/fog); clear skies aren't news.
  if (c.visibility?.meters != null && c.visibility.meters < 5000) {
    const m = c.visibility.meters;
    const val = km(m);
    out.push(
      L(
        "fog",
        t("Visibility", lang),
        val,
        `<b>${t(visWord(m), lang)}</b>`,
        "",
        gauge(m, 100, 10000, { log: true, ticks: [...THRESHOLDS.fog, 5000], level: fogLevelOf(m) }),
      ),
    );
  }
  const smokeLvl = smokeLevel(c.smoke);
  if (c.smoke && smokeLvl != null) {
    const sub =
      c.smoke.nearest_km != null
        ? `${t("nearest X km", lang).replace("X", String(c.smoke.nearest_km))} · ${t("X MW of fire power", lang).replace("X", String(c.smoke.frp_sum))}`
        : `${c.smoke.frp_sum} MW`;
    out.push(
      L(
        "smoke",
        t("Smoke", lang),
        String(c.smoke.count),
        `<span class="qa nu">${t("fires within 100 km", lang)}</span> <b>${t(SMOKE_PHRASE[smokeLvl], lang)}</b>`,
        sub,
        c.smoke.nearest_km != null
          ? gauge(c.smoke.nearest_km, 0, c.smoke.radius_km ?? 100, {
              from: c.smoke.nearest_km,
              marker: true,
              level: smokeLvl,
            })
          : "",
      ),
    );
  }
  if (c.rain && (c.rain.probability_pct != null || c.rain.precipitation_mm != null)) {
    const mm = c.rain.precipitation_mm;
    if (c.rain.probability_pct != null) {
      out.push(
        L(
          "rain",
          t("Rain", lang),
          `${c.rain.probability_pct}%`,
          `<span class="qa">${t("chance of rain", lang)}</span>`,
          mm ? t("X mm of rain now", lang).replace("X", String(mm)) : "",
          drops(c.rain.probability_pct),
        ),
      );
    } else {
      out.push(L("rain", t("Rain", lang), String(mm), `<span class="qa nu">mm</span> <b>${t("now", lang)}</b>`, ""));
    }
  }

  return out;
}

export const GRAP_RANGE = ["201-300", "201-300", "301-400", "401-450", "above 450"];
export const ROMAN = ["I", "I", "II", "III", "IV"];

/** Delhi-NCR: the GRAP stage range Delhi's AQI is in now, and that CAQM sets the stage (grap.ts). */
export function grapLine(g: NonNullable<Conditions["grap"]>, lang: Lang): string {
  const text = t(
    g.stage
      ? "Delhi's AQI averages {aqi} across {n} CPCB stations now, in the Stage {stage} range ({range}). The stage in force is set by CAQM."
      : "Delhi's AQI averages {aqi} across {n} CPCB stations now, below the Stage I range (201-300). The stage in force is set by CAQM.",
    lang,
  )
    .replace("{aqi}", String(g.aqi))
    .replace("{n}", String(g.stations))
    .replace("{stage}", ROMAN[g.stage])
    .replace("{range}", g.stage === 4 ? t("above 450", lang) : GRAP_RANGE[g.stage]);
  return `<p class="grap"><b>GRAP</b>: ${esc(text).replace("CAQM", '<a href="https://caqm.nic.in/" rel="noopener">CAQM</a>')}</p>`;
}

/** A place page's title and the description's first sentence, in the words people search:
 *  "Delhi AQI today: 344 Very Poor". With no air reading, the title names what there is. */
export function searchTitle(c: Conditions, placeName: string, lang: Lang): { title: string; lead?: string } {
  const air = c.air;
  if (!air || air.aqi == null) return { title: `${placeName}: ${t(`${HAZARDS_SHORT} now`, lang)} · mugilu` };
  const fill = (s: string) =>
    s
      .replace("{place}", placeName)
      .replace("{aqi}", String(air.aqi))
      .replace("{band}", t(AQI_BAND_LABEL[air.band] ?? "", lang));
  const title = `${fill(t("{place} AQI today: {aqi} {band}", lang))} · ${t(`${HAZARDS_SHORT} now`, lang)} · mugilu`;
  const lead = air.station
    ? fill(t("{place} AQI {aqi} ({band}) right now, from the {station} station {km} km away.", lang))
        .replace("{station}", air.station.name)
        .replace("{km}", air.station.distance_km.toFixed(1))
    : fill(t("{place} AQI {aqi} ({band}) right now, modelled.", lang));
  return { title, lead };
}
