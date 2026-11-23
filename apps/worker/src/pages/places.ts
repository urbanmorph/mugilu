import { MOBILE } from "../ui/standard";
import { esc } from "../html";
import { allSlugPlaces, localName, slugPlacesByState } from "../slugs";
import { hubOf, stateName } from "../states";
import { fill } from "../ui/history";
import { lp, quoted, t, type Lang } from "../i18n";
import { HAZARDS, HAZARDS_SHORT } from "../hazards";
import { activeWarnings, px, py, type IndiaMap, type MapWarning } from "../indiamap";
import { inAnyRing } from "../india";
import { ringsOf } from "../simplify-path";
import { cycloneTitle, officialCyclone, type WarningsSnapshot } from "../sachet";
import { alertParts } from "./warnings";
import { breadcrumb, SITE, ld } from "../ui/shell";
import { HOME_OG } from "../og-html";
import { istTime } from "../ist";
import { pageShell } from "../ui/page-shell";
import {
  band,
  filterInput,
  fold,
  ico,
  lane,
  LIST_FILTER_JS,
  pageHead,
  panel,
  placeTile,
  placeTiles,
  stack,
  wrap,
} from "../ui/components";
import { allWarningsLink, inForce, MAP_JS, placesKey, placesMap, placesMapNote, stateAnchor } from "../ui/map";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const initials = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toLowerCase();

/** The places a warning names ("Cyclone Warning for ASR, Anakapalli, …"), as slugs: each area
 *  by its name, or by its initials (IMD writes Alluri Sitharama Raju as "ASR") within the
 *  states of the places named in full, so an abbreviation never lands across the country. */
export function warnedPlaces(areas: string[]): string[] {
  const all = allSlugPlaces();
  const named = areas.flatMap((a) => all.filter((p) => norm(p.name) === norm(a)));
  const states = new Set(named.map((p) => p.state));
  const short = areas
    .filter((a) => /^[A-Z]{2,5}$/.test(a))
    .flatMap((a) => all.filter((p) => states.has(p.state) && initials(p.name) === a.toLowerCase()));
  return [...new Set([...named, ...short].map((p) => p.slug))];
}

/** The places whose point is inside any of the warning areas (their rings in map pixels). */
export function placesUnder(ws: MapWarning[]): string[] {
  const rings = ws.flatMap((w) => ringsOf(w.d));
  if (!rings.length) return [];
  const inside = inAnyRing(rings);
  return allSlugPlaces()
    .filter((p) => inside(px(p.lon), py(p.lat)))
    .map((p) => p.slug);
}

/** The places under an official warning now: each place whose point is inside the area of a
 *  warning in force, and, for a named cyclone whose alert has no area, the places it names. */
export function warnedSlugs(map: IndiaMap | undefined, warnings: WarningsSnapshot | null | undefined, now?: number) {
  return [...new Set([...alertPlaces(map, warnings, now).values()].flat())];
}

/** The places under each official warning in force, by alert id: the places inside its area,
 *  and, for a named cyclone whose alert has no area, the places it names. */
export function alertPlaces(
  map: IndiaMap | undefined,
  warnings: WarningsSnapshot | null | undefined,
  now?: number,
): Map<string, string[]> {
  const by = new Map<string, MapWarning[]>();
  for (const w of activeWarnings(map, now)) by.set(w.id, [...(by.get(w.id) ?? []), w]);
  const out = new Map([...by].map(([id, ws]) => [id, placesUnder(ws)]));
  const official = officialCyclone(warnings);
  if (official && !out.has(official.alert.identifier)) out.set(official.alert.identifier, warnedPlaces(official.areas));
  return out;
}

// The page's behaviour: find a place (filters the lists), the state picker and the map's state
// click (open that state's list and go to it), and on phones the lists start folded except a
// state with a warned place.
const PLACES_JS = `(function(){var q=document.getElementById('pq'),sel=document.getElementById('ps'),F=document.querySelectorAll('.flow details.fold');
window.openState=function(id){var d=document.getElementById(id);if(!d)return;d.hidden=false;d.open=true;d.scrollIntoView({block:'start'});var s=d.querySelector('summary');if(s)s.focus({preventScroll:true});};
if(sel)sel.addEventListener('change',function(){if(sel.value)openState(sel.value);});
if(window.matchMedia&&matchMedia(${JSON.stringify(MOBILE)}).matches)F.forEach(function(d){if(!d.querySelector('b')&&('#'+d.id)!==location.hash)d.open=false;});
${LIST_FILTER_JS}
if(q)q.addEventListener('input',mgDebounce(function(){var s=q.value.trim().toLowerCase();mgFilter(document.querySelectorAll('.flow details.fold li'),function(li){return mgMatch(li,s)});mgEmpty(F,'li');if(s)F.forEach(function(d){if(!d.hidden)d.open=true;});},100));})();`;

/** The place directory: every named /c/{slug} page, by state, with the map of India beside it
 *  (a state opens its list, a dot its place). The crawlable index of all ~800 place pages.
 *  A place is marked when its point is inside an official warning's area in force; a named
 *  cyclone whose alert has no area falls back to the places its warning names. */
export function renderPlaces(
  lang: Lang = "en",
  data: { map?: IndiaMap; warnings?: WarningsSnapshot | null; now?: number } = {},
): string {
  const T = (s: string) => esc(t(s, lang));
  const groups = slugPlacesByState();
  const total = groups.reduce((n, g) => n + g.places.length, 0);
  const official = officialCyclone(data.warnings);
  const areas = activeWarnings(data.map, data.now);
  const isWarned = new Set(warnedSlugs(data.map, data.warnings, data.now));
  const warned = [...isWarned];

  const head = band(
    pageHead(t("Every place, by state", lang), {
      extra:
        `<p class="t-lead">${T(`The sky over every district and major city in India, one page each. Pick a place to see its ${HAZARDS} right now.`)}</p>` +
        `<p class="stamp">${total} ${T("places across India")}</p>`,
    }) +
      lane("l2", [
        filterInput("pq", t("Find a place", lang)),
        `<div class="search"><label for="ps">${T("States")}</label><select id="ps" class="sel"><option value="">${T("States")}</option>${groups
          .map((g) => `<option value="${stateAnchor(g.state)}">${esc(g.state)}</option>`)
          .join("")}</select></div>`,
      ]),
  );

  const issued = official && alertParts(official.alert, lang);
  const warnBox = warned.length
    ? band(
        panel(
          stack(
            (official
              ? `<p><b>${quoted(cycloneTitle(official.title, lang), lang)}</b> · ${esc(issued!.office)} · <span class="t-meta">${esc(issued!.time)}</span></p>`
              : "") +
              (areas.length ? `<p><b>${inForce(areas.length, lang)}</b></p>` : "") +
              placeTiles(
                allSlugPlaces()
                  .filter((p) => isWarned.has(p.slug))
                  .map((p) => placeTile(lp(`/c/${p.slug}`, lang), localName(p, lang), true, lang)),
              ) +
              allWarningsLink(lang),
          ),
          { title: t("Under an official warning now", lang), icon: "warn", id: "uw", strong: true },
        ),
      )
    : "";

  const { svg, dots } = placesMap(data.map, warned, lang);
  const mapPanel = panel(
    stack(
      `<div class="imap places" data-layer="w">${svg}<script type="application/json">${JSON.stringify(dots)}</script></div>` +
        placesKey(lang, warned.length > 0) +
        placesMapNote(data.map, lang),
    ),
    { title: t("States", lang), icon: "pin", id: "pm" },
  );
  const lists = groups
    .map((g) =>
      fold(
        g.state,
        (hubOf(g.state)
          ? `<p class="t-meta"><a href="${lp(`/state/${hubOf(g.state)!.slug}`, lang)}">${esc(fill("{state} now", lang, { state: stateName(g.state, lang) }))} →</a></p>`
          : "") +
          `<ul class="plist">${g.places
            .map((p) => {
              const w = isWarned.has(p.slug);
              const name = localName(p, lang);
              // A native name keeps its Latin one for the find box (mgMatch reads data-k).
              const k = name !== p.name ? ` data-k="${esc(p.name)}"` : "";
              return `<li${k}><a href="${lp(`/c/${p.slug}`, lang)}">${w ? `${ico("warn")}<b>${esc(name)}</b>` : esc(name)}</a></li>`;
            })
            .join("")}</ul>`,
        { open: true, id: stateAnchor(g.state), count: g.places.length },
      ),
    )
    .join("");
  const directory = band(
    lane("la", [`<div class="aside">${mapPanel}</div>`, `<div class="col"><div class="flow">${lists}</div></div>`]),
  );
  const credit = band(
    `<p class="t-meta">${T("Place names: OpenStreetMap contributors (ODbL), GeoNames (CC-BY 4.0).")} ${T("Admin boundaries: LGD, via bharatlas.")}</p>`,
  );

  const canonical = `${SITE}/places`;
  const crumb = ld({ "@context": "https://schema.org", ...breadcrumb(["Places", canonical]) });
  return pageShell(
    t(`Every place in India: ${HAZARDS_SHORT} by district · mugilu`, lang),
    wrap(head + warnBox + directory + credit),
    {
      path: "/places",
      desc: t(`Browse the sky over every district and major city in India: the ${HAZARDS}, one page each.`, lang),
      canonical,
      jsonLd: crumb,
      ogImage: HOME_OG,
      lang,
      js: PLACES_JS + MAP_JS(lang),
    },
  );
}
