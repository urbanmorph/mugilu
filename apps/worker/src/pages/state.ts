import { esc } from "../html";
import { lp, t, type Lang } from "../i18n";
import { istTime } from "../ist";
import { AQI_BAND_LABEL } from "../aqi";
import { pickStation, STATION_MAX_KM } from "../conditions";
import { DESCRIPTION_MAX } from "../phrases";
import { localName, type SlugPlace } from "../slugs";
import { stateName, type State } from "../states";
import type { IndiaMap } from "../indiamap";
import type { WarningsSnapshot } from "../sachet";
import type { ConditionsSnapshot, NormalizedStation } from "../types";
import { breadcrumb, ld, SITE } from "../ui/shell";
import { pageShell } from "../ui/page-shell";
import { fill } from "../ui/history";
import {
  band,
  dataTable,
  linkRow,
  pageHead,
  panel,
  placeTile,
  placeTiles,
  stack,
  stamp,
  stamps,
  wrap,
} from "../ui/components";
import { HOME_OG } from "../og-html";
import { warnedSlugs } from "./places";

// A state's hub, /state/{slug}: its places now, the worst first, from the data every place
// page reads (the air station each place page picks, the district weather grid, the official
// warnings), so a number here is the number on that place's page. A topical parent between
// /places and the place pages (supporting-docs/reports/mugilu search discovery plan.md).

type Band = NormalizedStation["band"];
export interface StateNow {
  air: { p: SlugPlace; aqi: number; band: Band }[];
  hot: { p: SlugPlace; feels: number }[];
  cold: { p: SlugPlace; feels: number }[];
  rain: { p: SlugPlace; mm: number }[];
  warned: SlugPlace[];
  airAt?: string;
  wxAt?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const TOP = 5;

/** A state's places now. Air: each place's own station (pickStation, within STATION_MAX_KM),
 *  one row per station (a city and its district share one). Weather: each district's grid point. */
export function stateNow(
  st: State,
  d: {
    grid?: ConditionsSnapshot | null;
    stations?: NormalizedStation[];
    airAt?: string;
    map?: IndiaMap;
    warnings?: WarningsSnapshot | null;
    now?: number;
  },
): StateNow {
  const stations = d.stations ?? [];
  const seen = new Set<string>();
  const air: StateNow["air"] = [];
  for (const p of st.places) {
    const s = stations.length ? pickStation(stations, p.lat, p.lon) : undefined;
    if (!s || s.aqi == null || s.distance_km > STATION_MAX_KM || seen.has(s.id)) continue;
    seen.add(s.id);
    air.push({ p, aqi: s.aqi, band: s.band });
  }
  air.sort((a, b) => b.aqi - a.aqi);

  const points = (d.grid?.points ?? []).filter((g) => g.level === "district" && g.state === st.name);
  // Each district's own grid point. A city has none: its district carries its weather.
  const wx = st.places.map((p) => ({ p, w: points.find((g) => norm(g.name) === norm(p.name))?.wx }));
  const feels = wx.filter((x) => x.w?.apparent_c != null).map((x) => ({ p: x.p, feels: Math.round(x.w!.apparent_c!) }));
  const warnedSet = new Set(warnedSlugs(d.map, d.warnings, d.now));
  return {
    air: air.slice(0, TOP),
    hot: [...feels].sort((a, b) => b.feels - a.feels).slice(0, 3),
    cold: [...feels].sort((a, b) => a.feels - b.feels).slice(0, 3),
    rain: wx
      .filter((x) => (x.w?.rain_mm ?? 0) > 0)
      .map((x) => ({ p: x.p, mm: x.w!.rain_mm! }))
      .sort((a, b) => b.mm - a.mm),
    warned: st.places.filter((p) => warnedSet.has(p.slug)),
    airAt: d.airAt,
    wxAt: d.grid?.generated_at,
  };
}

const plural = (n: number, one: string, many: string, lang: Lang) => (n === 1 ? t(one, lang) : fill(many, lang, { n }));

/** The state in a few lines: worst air, hottest, coldest, rain, warnings. */
function summary(s: StateNow, lang: Lang): string[] {
  const name = (p: SlugPlace) => localName(p, lang);
  const lines: string[] = [];
  const a = s.air[0];
  if (a)
    lines.push(
      fill("Worst air now: {place}, AQI {aqi} ({band}).", lang, {
        place: name(a.p),
        aqi: a.aqi,
        band: t(AQI_BAND_LABEL[a.band], lang),
      }),
    );
  if (s.hot[0])
    lines.push(fill("Feels hottest: {place}, {c}°C.", lang, { place: name(s.hot[0].p), c: s.hot[0].feels }));
  if (s.cold[0] && s.cold[0].p !== s.hot[0]?.p)
    lines.push(fill("Feels coldest: {place}, {c}°C.", lang, { place: name(s.cold[0].p), c: s.cold[0].feels }));
  lines.push(
    s.rain.length
      ? plural(s.rain.length, "Rain now in 1 place.", "Rain now in {n} places.", lang)
      : t("No rain now.", lang),
  );
  lines.push(
    s.warned.length
      ? plural(s.warned.length, "1 place under an official warning.", "{n} places under an official warning.", lang)
      : t("No official warning covers a place here now.", lang),
  );
  return lines;
}

export function renderStatePage(st: State, s: StateNow, lang: Lang = "en"): string {
  const sn = stateName(st.name, lang);
  const path = `/state/${st.slug}`;
  const url = `${SITE}${lp(path, lang)}`;
  const link = (p: SlugPlace) => `<a href="${lp(`/c/${p.slug}`, lang)}">${esc(localName(p, lang))}</a>`;
  const tiles = (ps: SlugPlace[], warned = false) =>
    placeTiles(ps.map((p) => placeTile(lp(`/c/${p.slug}`, lang), localName(p, lang), warned, lang)));
  const cols = [{ label: t("Place", lang) }, { label: t("Now", lang), num: true }];
  const lines = summary(s, lang);

  const head = pageHead(fill("{state} now: air, heat, rain and official warnings", lang, { state: sn }), {
    extra:
      `<p class="t-lead">${esc(lines.join(" "))}</p>` +
      stamps(
        [
          s.airAt && stamp(t("air reading", lang), esc(istTime(s.airAt))),
          s.wxAt && stamp(t("weather reading", lang), esc(istTime(s.wxAt))),
        ].filter((x): x is string => !!x),
      ),
  });
  const airPanel = panel(
    s.air.length
      ? dataTable(
          cols,
          s.air.map((r) => [link(r.p), esc(`AQI ${r.aqi} ${t(AQI_BAND_LABEL[r.band], lang)}`)]),
          t("Worst air now", lang),
        )
      : `<p>${esc(fill("No air station is within {km} km of a place here.", lang, { km: STATION_MAX_KM }))}</p>`,
    { title: t("Worst air now", lang), icon: "air", id: "air" },
  );
  const tempPanel = (key: "hot" | "cold", title: string) =>
    s[key].length
      ? panel(
          dataTable(
            cols,
            s[key].map((r) => [link(r.p), esc(`${r.feels}°C`)]),
            t(title, lang),
          ),
          { title: t(title, lang), icon: key === "hot" ? "heat" : "cold", id: key },
        )
      : "";
  const rainPanel = panel(s.rain.length ? tiles(s.rain.map((r) => r.p)) : `<p>${esc(t("No rain now.", lang))}</p>`, {
    title: t("Raining now", lang),
    icon: "rain",
    id: "rain",
  });
  const warnPanel = panel(
    stack(
      (s.warned.length
        ? tiles(s.warned, true)
        : `<p>${esc(t("No official warning covers a place here now.", lang))}</p>`) +
        `<p><a href="${lp(`/state/${st.slug}/warnings`, lang)}">${esc(fill("Official weather warnings in {state} now", lang, { state: sn }))} →</a></p>`,
    ),
    { title: t("Under an official warning now", lang), icon: "warn", id: "warn", strong: s.warned.length > 0 },
  );
  const allPanel = panel(tiles(st.places), {
    title: fill("Every place in {state}", lang, { state: sn }),
    icon: "pin",
    id: "all",
    count: st.places.length,
  });
  const method = `<p class="t-meta">${esc(
    fill(
      "Air: each place's nearest air station within {km} km, as on its own page. Weather: the model at each district's centre.",
      lang,
      { km: STATION_MAX_KM },
    ),
  )}</p>`;

  const body = wrap(
    band(head) +
      band(airPanel) +
      band(tempPanel("hot", "Feels hottest now") + tempPanel("cold", "Feels coldest now")) +
      band(rainPanel) +
      band(warnPanel) +
      band(allPanel) +
      band(
        stack(
          method +
            linkRow(
              [
                [lp("/places", lang), `← ${t("Every place, by state", lang)}`],
                [lp("/warnings", lang), t("Warnings", lang)],
              ],
              "t-meta back",
            ),
        ),
      ),
  );
  const desc = [lines.join(" "), lines.slice(0, 3).join(" "), lines.slice(0, 2).join(" ")].find(
    (x) => x.length <= DESCRIPTION_MAX,
  );
  return pageShell(`${fill("{state} air quality, weather and warnings now", lang, { state: sn })} | mugilu`, body, {
    path,
    lang,
    desc: desc ?? lines[0],
    canonical: `${SITE}${path}`,
    ogImage: HOME_OG,
    jsonLd: ld({
      "@context": "https://schema.org",
      "@graph": [breadcrumb([t("Every place, by state", lang), `${SITE}${lp("/places", lang)}`], [sn, url])],
    }),
  });
}
