import { esc } from "../html";
import { allSlugPlaces, slugPlacesByState } from "../slugs";
import { lp, t, type Lang } from "../i18n";
import { HAZARDS, HAZARDS_SHORT } from "../hazards";
import { type IndiaMap } from "../indiamap";
import { officialCyclone, type WarningsSnapshot } from "../sachet";
import { issuerName } from "./warnings";
import { HOME_OG, SITE, istTime, ld } from "../ui/shell";
import { pageShell } from "../ui/page-shell";
import { band, ico, lane, panel, placeTile, placeTiles, stack, wrap } from "../ui/components";
import { MAP_JS, placesKey, placesMap, placesMapNote, stateAnchor } from "../ui/map";

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

// The page's behaviour: find a place (filters the lists), the state picker and the map's state
// click (open that state's list and go to it), and on phones the lists start folded except a
// state with a warned place.
const PLACES_JS = `(function(){var q=document.getElementById('pq'),sel=document.getElementById('ps'),F=document.querySelectorAll('.states details.fold');
window.openState=function(id){var d=document.getElementById(id);if(!d)return;d.hidden=false;d.open=true;d.scrollIntoView({block:'start'});var s=d.querySelector('summary');if(s)s.focus({preventScroll:true});};
if(sel)sel.addEventListener('change',function(){if(sel.value)openState(sel.value);});
if(window.matchMedia&&matchMedia('(max-width: 999px)').matches)F.forEach(function(d){if(!d.querySelector('b')&&('#'+d.id)!==location.hash)d.open=false;});
if(q)q.addEventListener('input',function(){var s=q.value.trim().toLowerCase();F.forEach(function(d){var any=false;d.querySelectorAll('li').forEach(function(li){var ok=!s||li.textContent.toLowerCase().indexOf(s)>-1;li.hidden=!ok;if(ok)any=true;});d.hidden=!any;if(s&&any)d.open=true;});});})();`;

/** The place directory: every named /c/{slug} page, by state, with the map of India beside it
 *  (a state opens its list, a dot its place). The crawlable index of all ~800 place pages. */
export function renderPlaces(
  lang: Lang = "en",
  data: { map?: IndiaMap; warnings?: WarningsSnapshot | null } = {},
): string {
  const T = (s: string) => esc(t(s, lang));
  const groups = slugPlacesByState();
  const total = groups.reduce((n, g) => n + g.places.length, 0);
  const official = officialCyclone(data.warnings);
  const warned = official ? warnedPlaces(official.areas) : [];
  const isWarned = new Set(warned);

  const head = band(
    `<div class="ph"><h1 class="t-title">${T("Every place, by state")}</h1>` +
      `<p class="t-lead">${T(`The sky over every district and major city in India, one page each. Pick a place to see its ${HAZARDS} right now.`)}</p>` +
      `<p class="stamp">${total} ${T("places across India")}</p></div>` +
      lane("l2", [
        `<div class="search"><label for="pq">${T("Find a place")}</label><div class="sbox">${ico("search")}<input type="search" id="pq" autocomplete="off"></div></div>`,
        `<div class="search"><label for="ps">${T("States")}</label><select id="ps" class="sel"><option value="">${T("States")}</option>${groups
          .map((g) => `<option value="${stateAnchor(g.state)}">${esc(g.state)}</option>`)
          .join("")}</select></div>`,
      ]),
  );

  const warnBox = official
    ? band(
        `<section class="panel strong" aria-labelledby="uw"><div class="bar">${ico("warn")}<span id="uw">${T("Under an official warning now")}</span></div><div class="in grid">` +
          `<p><b>${esc(official.title)}</b> · ${esc(issuerName(official.alert.issuer))} · <span class="t-meta">${esc(istTime(new Date(official.alert.sent).toISOString()))}</span></p>` +
          placeTiles(
            allSlugPlaces()
              .filter((p) => isWarned.has(p.slug))
              .map((p) => placeTile(lp(`/c/${p.slug}`, lang), p.name, true, lang)),
          ) +
          `<p><a href="${lp("/warnings", lang)}" class="back">${T("Active warnings")} →</a></p></div></section>`,
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
    .map(
      (g) =>
        `<details class="fold" open id="${stateAnchor(g.state)}"><summary>${esc(g.state)}<span class="n">${g.places.length}</span></summary><div class="in"><ul class="plist">` +
        g.places
          .map((p) => {
            const w = isWarned.has(p.slug);
            return `<li><a href="${lp(`/c/${p.slug}`, lang)}">${w ? `${ico("warn")}<b>${esc(p.name)}</b>` : esc(p.name)}</a></li>`;
          })
          .join("") +
        `</ul></div></details>`,
    )
    .join("");
  const directory = band(
    lane("la", [`<div class="aside">${mapPanel}</div>`, `<div class="states flow">${lists}</div>`]),
  );
  const credit = band(
    `<p class="t-meta">${T("Place names: OpenStreetMap contributors (ODbL), GeoNames (CC-BY 4.0).")} ${T("Admin boundaries: LGD, via bharatlas.")}</p>`,
  );

  const canonical = "https://mugilu.live/places";
  const crumb = ld({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "mugilu", item: SITE },
      { "@type": "ListItem", position: 2, name: "Places", item: canonical },
    ],
  });
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
