import { type Conditions, type NormalizedStation, type Warning } from "../types";
import { type NationalHighlights } from "../highlights";
import { AQI_BAND_LABEL } from "../aqi";
import { gauge, pollutantBars, uvSteps, worstPollutant } from "../glyphs";
import { forPersona, isDriver, km, layerBase, orderByRisk } from "../readings";
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
  ambientSummary,
  headline,
  heatLevelOf,
  smokeLevel,
  type AmbientRisk,
  type Persona,
  type RiskBand,
  windLevelOf,
} from "../score";
import { HAZARD_TINT, RISK_COLOR } from "../palette";
import {
  LEVEL_SHAPE,
  band,
  bandChip,
  ico,
  levelChip,
  notice,
  plate,
  stack,
  warningPlate,
  type IconName,
} from "../ui/components";
import { lp, t, type Lang } from "../i18n";
import { HAZARDS_SHORT } from "../hazards";
import { renderIndiaMap, type IndiaMap } from "../indiamap";
import { NORMALS_LABEL, heatVsNormalLine, heatVsNormalShown } from "../heatnormals";
import { relTime } from "../ui/shell";

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
export function renderHero(
  h: NationalHighlights | undefined,
  meta?: { gridAsOf?: string; airAsOf?: string; map?: IndiaMap },
  lang: Lang = "en",
): string {
  const rows: string[] = [];
  let worst: RiskBand = "low";
  // Place + state names are proper nouns from the gazetteer: kept as-is (English)
  // in every language; transliterating them would be unreliable.
  const place = (name: string, state?: string) => esc(state ? `${name}, ${state}` : name);
  const age = (iso?: string) => (iso ? ` <span class="age">· ${relTime(iso)}</span>` : "");
  // "feels 41°": in Kannada/Hindi the verb follows the number ("41° ಅನಿಸುತ್ತದೆ").
  const feels = (c: number) =>
    lang === "en" ? `feels like ${Math.round(c)}°` : `${Math.round(c)}° ${t("feels", lang)}`;
  const row = (band: RiskBand, lat: number, lon: number, body: string, iso?: string) => {
    if (RISK_BANDS.indexOf(band) > RISK_BANDS.indexOf(worst)) worst = band;
    return `<a class="hl" style="--hue:var(--rt-${band})" href="${lp(`/c/${lat},${lon}`, lang)}">${body}${age(iso)}</a>`;
  };
  if (h?.hottest) {
    rows.push(
      row(
        heatBand(h.hottest.apparent_c, h.hottest.wet_bulb_c),
        h.hottest.lat,
        h.hottest.lon,
        `${icon("heat")}${t("Hottest", lang)}: <b>${place(h.hottest.name, h.hottest.state)}</b>, ${feels(h.hottest.apparent_c)}, ${t(heatPhrase(h.hottest.apparent_c, h.hottest.wet_bulb_c), lang)}`,
        meta?.gridAsOf,
      ),
    );
  }
  if (h?.dustiest) {
    rows.push(
      row(
        dustBand(h.dustiest.dust_ug_m3),
        h.dustiest.lat,
        h.dustiest.lon,
        `${icon("dust")}${t("Dustiest", lang)}: <b>${place(h.dustiest.name, h.dustiest.state)}</b>, ${t(DUST_PHRASE[dustBand(h.dustiest.dust_ug_m3)], lang)}`,
        meta?.gridAsOf,
      ),
    );
  }
  if (h?.worstAir) {
    rows.push(
      row(
        airBand(h.worstAir.band),
        h.worstAir.lat,
        h.worstAir.lon,
        `${icon("air")}${t("Worst air", lang)}: <b>${place([h.worstAir.station, h.worstAir.name].filter(Boolean).join(", "), h.worstAir.state)}</b>, AQI ${h.worstAir.aqi} ${t(AQI_BAND_LABEL[h.worstAir.band] ?? "", lang)}`,
        meta?.airAsOf,
      ),
    );
  }
  const map = meta?.map ? renderIndiaMap(meta.map, lang, relTime) : "";
  return rows.length || map
    ? `<section class="hero-now" style="--cond:${RISK_COLOR[worst]}"><h2>${t("India now", lang)}</h2>${map}${rows.join("")}</section>`
    : "";
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

/** Wet-bulb survivability read (~31 is the theoretical limit): the word per level. */
export const WET_BULB = ["safe", "caution", "severe", "dangerous"];

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

/** Whether the air reading is older than the page by half an hour or more (stations
 *  report on their own clock, often an hour or two behind), so it is named apart. */
export function airLag(c: Conditions): boolean {
  return !!c.air_as_of && Date.parse(c.as_of) - Date.parse(c.air_as_of) >= 30 * 60_000;
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

// ── The readings ─────────────────────────────────────────────────────────────────
// One model of a place's readings, drawn as the place page's rows (the standard's .rrow),
// the screen display's tiles and the embed card's figures, so they never disagree.

/** The pictogram for each reading, and for the Ambient read's driver. */
export const READ_ICON: Record<string, IconName> = {
  air: "air",
  heat: "heat",
  cold: "cold",
  sun: "sun",
  dust: "dust",
  wind: "wind",
  fog: "fog",
  smoke: "smoke",
  rain: "drop",
  Air: "air",
  Heat: "heat",
  Cold: "cold",
  UV: "sun",
  Dust: "dust",
  Wind: "wind",
  Fog: "fog",
  Smoke: "smoke",
  Warning: "warn",
  none: "sun",
};

/** One reading. Text fields are plain (escaped when drawn); `chip` and `more` are markup. */
export interface ReadRow {
  key: string;
  label: string;
  icon: IconName;
  /** The figure, e.g. "246", "18°". */
  num: string;
  /** What the figure is, e.g. "AQI", "feels like", "km/h gusts". */
  unit: string;
  /** The live word for it, e.g. "warm", "calm", "notable burning". */
  qual?: string;
  /** Its level: a band chip for air, a level chip for a scored hazard, none for rain. */
  chip: string;
  /** The detail under the figure (graphics and notes), markup. */
  more: string[];
  /** The screen display's one graphic: the worst pollutant, the heat gauges. */
  mini: string;
  /** The short value for the display's quiet line, e.g. "12 km/h". */
  brief: string;
  /** Today's high against the normal, when it stands out (heat only), markup. */
  normal?: string;
  /** The Ambient read's headline hazard. */
  driver: boolean;
  /** One of the persona's own hazards. */
  mine: boolean;
}

/** A scored hazard's own level for a reading (before the persona's bump), as a chip. */
function hazardChip(key: string, risk: AmbientRisk, lang: Lang): string {
  const level = layerBase(key, risk);
  return level == null ? "" : levelChip(RISK_BANDS[level], lang);
}

/** Every reading present, in the order they matter now. */
export function readRows(c: Conditions, risk: AmbientRisk, lang: Lang): ReadRow[] {
  const out: ReadRow[] = [];
  const keyReading = KEY_READING[risk.persona];
  const row = (key: string, r: Omit<ReadRow, "key" | "driver" | "mine" | "chip" | "mini"> & Partial<ReadRow>) =>
    out.push({
      key,
      chip: hazardChip(key, risk, lang),
      mini: "",
      driver: isDriver(key, risk),
      mine: risk.persona !== "everyone" && forPersona(key, risk),
      ...r,
    });

  if (c.air) {
    const band = c.air.band ?? "unknown";
    const bandWord = t(AQI_BAND_LABEL[band] ?? "n/a", lang);
    const bars = pollutantBars(c.air.pollutants);
    const worst = worstPollutant(c.air.pollutants, keyReading.pollutants);
    const more = bars ? [bars, `<p class="t-legal">${esc(t("The dashed line is the CPCB limit.", lang))}</p>`] : [];
    more.push(
      `<p class="t-meta">${
        c.air.station
          ? `${esc(t("measured", lang))} · ${c.air.station.distance_km} km`
          : esc(t("modelled", lang))
      }</p>`,
    );
    if (c.air.yll != null) more.push(`<p class="t-meta">~${c.air.yll.toFixed(1)} ${esc(t("years of life lost", lang))}</p>`);
    if (c.grap) more.push(grapLine(c.grap, lang));
    row("air", {
      label: t("Air", lang),
      icon: "air",
      num: c.air.aqi != null ? String(c.air.aqi) : "n/a",
      unit: "AQI",
      chip: bandChip(band, bandWord),
      more,
      mini: worst ? pollutantBars(worst) : "",
      brief: c.air.aqi != null ? `AQI ${c.air.aqi}` : "n/a",
    });
  }
  if (c.heat) {
    const h = c.heat;
    const cold = h.apparent_c != null && coldLevelOf(h.apparent_c) > 0;
    const gauges: string[] = [];
    if (cold) {
      const a = h.apparent_c!;
      gauges.push(gauge(a, -10, 30, { from: a, ticks: THRESHOLDS.cold, level: coldLevelOf(a), marker: true }));
    } else {
      if (h.wet_bulb_c != null) {
        const level = heatLevelOf({ wet_bulb_c: h.wet_bulb_c });
        gauges.push(
          `<p${keyReading.heat === "wetbulb" ? ' class="key"' : ""}>${esc(t("wet-bulb", lang))} ${round(h.wet_bulb_c)}° <b class="ql">${esc(t(WET_BULB[level], lang))}</b></p>`,
          gauge(h.wet_bulb_c, 10, 35, { ticks: THRESHOLDS.wetBulb, level }),
        );
      }
      if (h.wbgt_c != null)
        gauges.push(
          `<p${keyReading.heat === "wbgt" ? ' class="key"' : ""}>WBGT ${round(h.wbgt_c)}°</p>`,
          gauge(h.wbgt_c, 15, 40, { ticks: THRESHOLDS.wbgt, level: heatLevelOf({ wbgt_c: h.wbgt_c }) }),
        );
    }
    // Today's high against the normal here: drawn only when it stands out, always labelled.
    const n = c.heat_vs_normal;
    const normal = heatVsNormalShown(n)
      ? [
          `<p>${esc(heatVsNormalLine(n, lang))}</p>`,
          gauge(n.today_max_c, n.normal_max_c - 10, n.normal_max_c + 10, {
            from: n.normal_max_c,
            ticks: [n.normal_max_c],
            marker: true,
            cls: n.anomaly_c >= 0 ? "high" : "",
          }),
          `<p class="t-legal">${esc(t(NORMALS_LABEL, lang))}</p>`,
        ]
      : [];
    row("heat", {
      label: t("Heat", lang),
      icon: cold ? "cold" : "heat",
      num: `${round(h.apparent_c)}°`,
      // No feels-like, no word (never read a missing value as 0°, "dangerous cold").
      unit: h.apparent_c != null ? t("feels like", lang) : "",
      qual: h.apparent_c != null ? t(heatPhrase(h.apparent_c, h.wet_bulb_c), lang) : undefined,
      more: [
        `<p class="t-meta">${round(h.temp_c)}° ${esc(t("actual", lang))} · ${round(h.humidity_pct)}% ${esc(t("humidity", lang))}</p>`,
        ...gauges,
        ...normal,
      ],
      mini: gauges.join(""),
      normal: normal.join(""),
      brief: `${round(h.apparent_c)}°`,
    });
  }
  if (c.uv?.index != null) {
    row("sun", {
      label: t("Sun", lang),
      icon: "sun",
      num: String(Math.round(c.uv.index)),
      unit: t("UV index", lang),
      qual: t(uvWord(c.uv.index), lang),
      more: [uvSteps(c.uv.index)],
      brief: `UV ${Math.round(c.uv.index)}`,
    });
  }
  if (c.dust?.dust_ug_m3 != null) {
    const ug = c.dust.dust_ug_m3;
    row("dust", {
      label: t("Dust", lang),
      icon: "dust",
      num: String(Math.round(ug)),
      unit: "µg/m³",
      qual: t(dustBand(ug), lang),
      more: [gauge(ug, 0, 600, { ticks: THRESHOLDS.dust, level: dustLevelOf(ug) })],
      brief: `${Math.round(ug)} µg/m³`,
    });
  }
  if (c.wind && (c.wind.gust_kmh != null || c.wind.speed_kmh != null)) {
    const gust = c.wind.gust_kmh ?? c.wind.speed_kmh!;
    const dir: string[] = [];
    if (c.wind.direction_deg != null) dir.push(t("from X", lang).replace("X", compassDir(c.wind.direction_deg)));
    if (c.wind.speed_kmh != null) dir.push(t("X km/h steady", lang).replace("X", String(Math.round(c.wind.speed_kmh))));
    row("wind", {
      label: t("Wind", lang),
      icon: "wind",
      num: String(Math.round(gust)),
      unit: `km/h ${t("gusts", lang)}`,
      qual: t(windWord(gust), lang),
      more: [
        gauge(gust, 0, 100, { ticks: THRESHOLDS.wind, level: windLevelOf(gust) }),
        ...(dir.length ? [`<p class="t-meta">${esc(dir.join(" · "))}</p>`] : []),
      ],
      brief: `${Math.round(gust)} km/h`,
    });
  }
  // Visibility only surfaces when reduced (hazy, fog); clear skies are not news.
  if (c.visibility?.meters != null && c.visibility.meters < 5000) {
    const m = c.visibility.meters;
    row("fog", {
      label: t("Visibility", lang),
      icon: "fog",
      num: km(m),
      unit: "",
      qual: t(visWord(m), lang),
      more: [gauge(m, 100, 10000, { log: true, ticks: [...THRESHOLDS.fog, 5000], level: fogLevelOf(m) })],
      brief: km(m),
    });
  }
  const smokeLvl = smokeLevel(c.smoke);
  if (c.smoke && smokeLvl != null) {
    const sub =
      c.smoke.nearest_km != null
        ? `${t("nearest X km", lang).replace("X", String(c.smoke.nearest_km))} · ${t("X MW of fire power", lang).replace("X", String(c.smoke.frp_sum))}`
        : `${c.smoke.frp_sum} MW`;
    row("smoke", {
      label: t("Smoke", lang),
      icon: "smoke",
      num: String(c.smoke.count),
      unit: t("fires within 100 km", lang),
      qual: t(SMOKE_PHRASE[smokeLvl], lang),
      more: [
        ...(c.smoke.nearest_km != null
          ? [
              gauge(c.smoke.nearest_km, 0, c.smoke.radius_km ?? 100, {
                from: c.smoke.nearest_km,
                marker: true,
                level: smokeLvl,
              }),
            ]
          : []),
        `<p class="t-meta">${esc(sub)}</p>`,
      ],
      brief: String(c.smoke.count),
    });
  }
  if (c.rain && (c.rain.probability_pct != null || c.rain.precipitation_mm != null)) {
    const mm = c.rain.precipitation_mm;
    const pct = c.rain.probability_pct;
    row("rain", {
      label: t("Rain", lang),
      icon: "drop",
      num: pct != null ? `${pct}%` : String(mm),
      unit: pct != null ? t("chance of rain", lang) : "mm",
      qual: pct != null ? undefined : t("now", lang),
      more: pct != null && mm ? [`<p class="t-meta">${esc(t("X mm of rain now", lang).replace("X", String(mm)))}</p>`] : [],
      brief: pct != null ? `${pct}%` : `${mm} mm`,
    });
  }
  return orderByRisk(out, risk, c);
}

/** A reading as the place page's row: pictogram, label, figure and word, its level, detail. */
export function readRowHtml(r: ReadRow, lang: Lang): string {
  const tag = r.mine ? ` <span class="fy">${esc(t("for you", lang))}</span>` : "";
  return (
    `<div class="rrow${r.driver ? " on" : ""}" data-k="${r.key}">${ico(r.icon)}` +
    `<div><p class="lab">${esc(r.label)}${tag}</p><p class="val"><span class="num">${esc(r.num)}</span>` +
    `${r.unit ? `<span class="qa">${esc(r.unit)}</span>` : ""}${r.qual ? ` <b class="ql">${esc(r.qual)}</b>` : ""}</p></div>` +
    `${r.chip}${r.more.length ? `<div class="more stack">${r.more.join("")}</div>` : ""}</div>`
  );
}

/** The Ambient read's headline as plain text: "High air." or "All clear." */
export function headText(risk: AmbientRisk, lang: Lang): string {
  const h = headline(risk, (en) => t(en, lang));
  return h.noun ? `${h.word} ${h.noun}.` : `${h.word}.`;
}

/** "Ambient · Everyone": the read and whose it is. */
export const ambientKicker = (risk: AmbientRisk, lang: Lang) =>
  `Ambient · ${t(PERSONA_LABEL[risk.persona], lang)}`;

/** The level hero: the Ambient read on its level's fill, shape and word, the advice under it.
 *  `more` (markup) follows the advice: the screen display's official warning. */
export function ambientPlate(risk: AmbientRisk, lang: Lang, more = ""): string {
  const say = ambientSummary(risk, (en) => t(en, lang));
  const head = headText(risk, lang);
  const extra =
    (say.action ? `<p class="t-lead act">${esc(say.action)}</p>` : "") +
    (say.also ? `<p class="row-c also">${ico("people")}<span>${esc(say.also)}</span></p>` : "") +
    more;
  return plate({
    fill: risk.band,
    shape: LEVEL_SHAPE[risk.band],
    kicker: ambientKicker(risk, lang),
    word: esc(head),
    say: esc(say.meaning),
    extra,
    label: head,
  });
}

/** An official warning's title in IMD's own words: the category and the storm's name
 *  ("Severe Cyclonic Storm Akvan") when the message names one, else its type. */
export function warningTitle(w: Warning): string {
  const m = (w.headline ?? "").match(
    /\b(super cyclonic storm|extremely severe cyclonic storm|very severe cyclonic storm|severe cyclonic storm|cyclonic storm|deep depression)\s+(?:\(\s*)?([A-Z][A-Za-z]+)\b/i,
  );
  if (m && !/^(with|over|near|lay|lays|moved|has|is|of|at|in)$/i.test(m[2])) {
    const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
    return `${title(m[1])} ${title(m[2])}`;
  }
  return w.event;
}

/** The official warnings over this point: a WarningPlate each (IMD's category and name, the
 *  SACHET colour code, the end time), then one quiet line for those near but not at it. */
export function warningBand(c: Conditions, lang: Lang): string {
  const plates = (c.warnings ?? []).map((w) => {
    const meta = [w.severity, w.until ? t("until X", lang).replace("X", w.until) : ""].filter(Boolean).join(" · ");
    const title = warningTitle(w);
    return warningPlate({
      bar: [`<span>${esc(t("Official warning", lang))} · ${esc(w.issuer)}</span>`],
      title,
      icon: /cyclon/i.test(`${title} ${w.event}`) ? "cyclone" : "warn",
      body: meta ? `<p class="t-value">${esc(meta)}</p>` : "",
      label: t("Official warning", lang),
    });
  });
  const near = c.nearby_warnings?.length ? notice("quiet", nearbyWarnings(c.nearby_warnings, lang), "warn") : "";
  return plates.length || near ? band(stack(plates.join("") + near)) : "";
}

/** Warnings active nearby whose areas do not cover this spot: one line, never a plate. */
function nearbyWarnings(ws: Warning[], lang: Lang): string {
  // One entry per kind: a count when several areas nearby have it, else its end time.
  const byEvent = new Map<string, Warning[]>();
  for (const w of ws) byEvent.set(w.event, [...(byEvent.get(w.event) ?? []), w]);
  const items = [...byEvent]
    .map(([event, list]) => {
      const one = list.length === 1 ? list[0] : undefined;
      const detail = one ? (one.until ? t("until X", lang).replace("X", one.until) : "") : String(list.length);
      return `${event}${detail ? ` (${detail})` : ""}`;
    })
    .join(" · ");
  return `${esc(t("Near this point, but not at it:", lang))} ${esc(items)}`;
}

/** The page wash for a read: its hazard's hue (calm sky when low) at its level. */
export function readTint(risk: Pick<AmbientRisk, "band" | "driver">): { hue: string; level: RiskBand } {
  return { hue: risk.band !== "low" && risk.driver in HAZARD_TINT ? risk.driver : "none", level: risk.band };
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
  return notice("info", `<b>GRAP</b>: ${esc(text).replace("CAQM", '<a href="https://caqm.nic.in/" rel="noopener">CAQM</a>')}`);
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
