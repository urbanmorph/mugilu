import { PLACES_STORE_JS } from "../ui/places-store";
import { type Conditions, type NormalizedStation, type Warning } from "../types";
import { AQI_BAND_LABEL } from "../aqi";
import { gauge, pollutantBars, uvSteps, worstPollutant } from "../glyphs";
import { forPersona, isDriver, km, layerBase, orderByRisk } from "../readings";
import { esc } from "../html";
import {
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
import { HAZARD_TINT } from "../palette";
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
import { langAttr, t, type Lang } from "../i18n";
import { HAZARDS_SHORT } from "../hazards";
import { cycloneIn } from "../sachet";
import { NORMALS_LABEL, heatVsNormalLine, heatVsNormalShown } from "../heatnormals";

// What a read is made of, shared by the place page, the kiosk, the embed and the share
// images: the rows in order of risk, the plate, the warning band, the tint. Pages compose
// these with the signage components (ui/components.ts); the look is the standard's
// (ui/tokens.ts + ui/standard.ts), never set here.

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

/** The air reading is called out separately when it is this much older than the page. */
const AIR_LAG_MS = 30 * 60_000;

/** Whether the air reading is older than the page by half an hour or more (stations
 *  report on their own clock, often an hour or two behind), so it is named apart. */
export function airLag(c: Conditions): boolean {
  return !!c.air_as_of && Date.parse(c.as_of) - Date.parse(c.air_as_of) >= AIR_LAG_MS;
}

// Records this /c visit into the browser's "Your places" list (first-party,
// localStorage; no login, no server). The reverse-geocoded label is read from
// the page so "use my location" shows a name, not raw coordinates.
export const PLACE_RECORDER = `${PLACES_STORE_JS}
(function(){try{
var pp=location.pathname.split('/');
if(pp[1]!=='c'||!pp[2])return;
var id=decodeURIComponent(pp[2]),el=document.querySelector('h1.loc');
// Coordinate comes from the URL (/c/lat,lon) or the page (named /c/slug pages).
var ll=(el&&el.getAttribute('data-ll'))||id,c=ll.split(',');
var la=+c[0],lo=+c[1];if(c.length!==2||!isFinite(la)||!isFinite(lo))return;
function clean(s){return String(s).replace(/[\\u0000-\\u001f\\u007f]/g,'').trim().slice(0,80);}
var label=clean(el?el.textContent:id);
// If they searched in a native script, remember it in that script (passed via #q=).
var h=location.hash.match(/[#&]q=([^&]+)/);
if(h){var q=decodeURIComponent(h[1]);if(/[^\\x00-\\x7F]/.test(q))label=clean(q)||label;}
var L=PS.load();
var p=L.filter(function(x){return x.id===id})[0];
if(p){p.n=(p.n||0)+1;p.t=Date.now();if(!p.name)p.label=label}
else{L.push({id:id,lat:la,lon:lo,label:label,n:1,t:Date.now(),fav:false})}
L=PS.ord(L);
var f=L.filter(function(x){return x.fav}),r=L.filter(function(x){return !x.fav}).slice(0,Math.max(0,12-f.length));
PS.save(f.concat(r));
if(location.hash)try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
}catch(e){}})();`;

/** A station's page path. The provider and id come from upstream data, so each is encoded. */
export const stationPath = (provider: string, id: string) =>
  `/s/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`;

// ── The readings ─────────────────────────────────────────────────────────────────
// One model of a place's readings, drawn as the place page's rows (the standard's .rrow),
// the screen display's tiles and the embed card's figures, so they never disagree.

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
    const bars = pollutantBars(c.air.pollutants, lang);
    const worst = worstPollutant(c.air.pollutants, keyReading.pollutants);
    const more = bars ? [bars] : [];
    more.push(
      `<p class="t-meta">${
        c.air.station ? `${esc(t("measured", lang))} · ${c.air.station.distance_km} km` : esc(t("modelled", lang))
      }</p>`,
    );
    if (c.air.yll != null)
      more.push(`<p class="t-meta">~${c.air.yll.toFixed(1)} ${esc(t("years of life lost", lang))}</p>`);
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
    // The heat-stress reads, each a line and a gauge on the page; the display shows the lines.
    const gauges: string[] = [];
    const lines: string[] = [];
    const read = (key: "wetbulb" | "wbgt", text: string, g: string) => {
      gauges.push(`<p${keyReading.heat === key ? ' class="key"' : ""}>${text}</p>`, g);
      lines.push(`<p class="qa">${text}</p>`);
    };
    if (cold) {
      const a = h.apparent_c!;
      gauges.push(gauge(a, -10, 30, { from: a, ticks: THRESHOLDS.cold, level: coldLevelOf(a), marker: true }));
    } else {
      if (h.wet_bulb_c != null) {
        const level = heatLevelOf({ wet_bulb_c: h.wet_bulb_c });
        read(
          "wetbulb",
          `${esc(t("wet-bulb", lang))} ${round(h.wet_bulb_c)}° <b class="ql">${esc(t(WET_BULB[level], lang))}</b>`,
          gauge(h.wet_bulb_c, 10, 35, { ticks: THRESHOLDS.wetBulb, level }),
        );
      }
      if (h.wbgt_c != null)
        read(
          "wbgt",
          `WBGT ${round(h.wbgt_c)}°`,
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
      mini: lines.join(""),
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
      more:
        pct != null && mm ? [`<p class="t-meta">${esc(t("X mm of rain now", lang).replace("X", String(mm)))}</p>`] : [],
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
const ambientKicker = (risk: AmbientRisk, lang: Lang) =>
  t("Ambient · {persona}", lang).replace("{persona}", t(PERSONA_LABEL[risk.persona], lang));

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
  return cycloneIn(w.headline)?.title ?? w.event;
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
      body: meta ? `<p class="t-value"${langAttr(meta, lang)}>${esc(meta)}</p>` : "",
      label: t("Official warning", lang),
      lang,
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
  return notice(
    "info",
    `<b>GRAP</b>: ${esc(text).replace("CAQM", '<a href="https://caqm.nic.in/" rel="noopener">CAQM</a>')}`,
  );
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
