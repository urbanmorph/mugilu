import { PLACES_STORE_JS } from "../ui/places-store";
import { indiaPanel } from "../ui/history";
import type { IndiaTrend } from "../placedaily";
import { type NationalHighlights } from "../highlights";
import { esc } from "../html";
import { coordKey, langPrefixJs, placeHref } from "../links";
import { START_CITIES } from "../slugs";
import { langAttr, lp, t, type Lang } from "../i18n";
import { HAZARDS_SHORT, SITE_DESC } from "../hazards";
import { AQI_BAND_LABEL } from "../aqi";
import type { RiskBand } from "../score";
import { type IndiaMap } from "../indiamap";
import { cycloneTitle, officialCyclone, type WarningsSnapshot } from "../sachet";
import { DUST_PHRASE, airBand, dustBand, heatBand, heatPhrase } from "./read";
import { alertParts } from "./warnings";
import { CLIENT_ESC, SITE, ld, relTime } from "../ui/shell";
import { HOME_OG } from "../og-html";
import { pageShell } from "../ui/page-shell";
import {
  band,
  button,
  comboboxJs,
  locateJs,
  ico,
  lane,
  levelChip,
  linkButton,
  notice,
  placeTile,
  placeTiles,
  searchBox,
  stack,
  warningPlate,
  wrap,
  yourPlacesSlot,
  type IconName,
} from "../ui/components";
import { indiaMap, MAP_JS } from "../ui/map";

/** "Popular": real top lookups (D1) first, then the seed cities, eight at most, each linked to
 *  its canonical /c/{slug} when it has one. A long ward name gives way to its city. */
function popularTiles(popular: { label: string; lat: number; lon: number }[], lang: Lang): string {
  const shortPlace = (label: string) => {
    const seg = label.split(",").map((s) => s.trim());
    return seg[0].length > 14 && seg.length > 1 ? seg[seg.length - 1] : seg[0];
  };
  const seen = new Set<string>();
  const tiles: string[] = [];
  for (const p of [...popular.map((x) => ({ ...x, name: shortPlace(x.label) })), ...START_CITIES.slice(0, 6)]) {
    const k = p.name.toLowerCase();
    if (seen.has(k) || tiles.length >= 8) continue;
    seen.add(k);
    tiles.push(placeTile(placeHref(p.name, p, lang), p.name));
  }
  return placeTiles(tiles);
}

/** The national highlights: hottest, dustiest, worst air, each a link with its level and time. */
function highlightRows(
  h: NationalHighlights | undefined,
  meta: { gridAsOf?: string; airAsOf?: string },
  lang: Lang,
): string {
  // Place and state names are proper nouns from the gazetteer, kept as they are in every language.
  const place = (name: string, state?: string) => esc(state ? `${name}, ${state}` : name);
  // "feels 41°": in Kannada and Hindi the verb follows the number.
  const feels = (c: number) =>
    lang === "en" ? `feels like ${Math.round(c)}°` : `${Math.round(c)}° ${t("feels", lang)}`;
  /** One highlight: `name` and `say` are markup; `at` is the place's coordinate. */
  const row = (r: {
    icon: IconName;
    label: string;
    name: string;
    say: string;
    level: RiskBand;
    at: { lat: number; lon: number };
    iso?: string;
  }) =>
    `<a class="hl" href="${lp(`/c/${coordKey(r.at)}`, lang)}">${ico(r.icon)}<span class="stack">` +
    `<span><span class="t-meta">${esc(t(r.label, lang))}:</span> <b class="t-value">${r.name}</b></span>` +
    `<span class="row-c"><span>${r.say}</span>${levelChip(r.level, lang)}</span>` +
    (r.iso ? `<span class="t-meta">${relTime(r.iso)}</span>` : "") +
    `</span></a>`;
  const rows: string[] = [];
  if (h?.hottest) {
    const { name, state, lat, lon, apparent_c, wet_bulb_c } = h.hottest;
    const say = `${feels(apparent_c)}, ${esc(t(heatPhrase(apparent_c, wet_bulb_c), lang))}`;
    rows.push(
      row({
        icon: "heat",
        label: "Hottest",
        name: place(name, state),
        say,
        level: heatBand(apparent_c, wet_bulb_c),
        at: { lat, lon },
        iso: meta.gridAsOf,
      }),
    );
  }
  if (h?.dustiest) {
    const { name, state, lat, lon, dust_ug_m3 } = h.dustiest;
    const b = dustBand(dust_ug_m3);
    rows.push(
      row({
        icon: "dust",
        label: "Dustiest",
        name: place(name, state),
        say: esc(t(DUST_PHRASE[b], lang)),
        level: b,
        at: { lat, lon },
        iso: meta.gridAsOf,
      }),
    );
  }
  if (h?.worstAir) {
    const w = h.worstAir;
    const name = place([w.station, w.name].filter(Boolean).join(", "), w.state);
    const say = `AQI ${w.aqi} ${esc(t(AQI_BAND_LABEL[w.band] ?? "", lang))}`;
    rows.push(row({ icon: "air", label: "Worst air", name, say, level: airBand(w.band), at: w, iso: meta.airAsOf }));
  }
  return rows.length ? `<div>${rows.join("")}</div>` : "";
}

/** The newest official cyclone warning, as a plate: IMD's category and the storm's name. */
function cyclonePlate(c: ReturnType<typeof officialCyclone>, lang: Lang): string {
  if (!c) return "";
  const { office, time, cap } = alertParts(c.alert, lang);
  return band(
    warningPlate({
      bar: [
        `<a href="${lp("/warnings", lang)}">${esc(t("Active warnings", lang))}</a>`,
        `<span>${esc(office)}</span>`,
        `<span>${esc(time)}</span>`,
        cap,
      ].filter(Boolean),
      title: cycloneTitle(c.title, lang),
      icon: "cyclone",
      body: `<p${langAttr(c.alert.headline, lang)}>${esc(c.alert.headline)}</p>`,
      label: t("Active warnings", lang),
      lang,
    }),
  );
}

/** Your places: recents and favourites from this browser (first-party, no login), as .yp rows. */
const yourPlacesJs = (lang: Lang) => {
  const S = (s: string) => JSON.stringify(t(s, lang));
  return `(function(){${PLACES_STORE_JS}var yp=document.getElementById('yp');if(!yp)return;var ul=yp.querySelector('ul.yp'),LP=${langPrefixJs(lang)},FAV=${S("Favourite X")},REN=${S("Rename X")},DEL=${S("Remove X")},NAME=${S("Type a name for this place (for example, Home or Office)")};
${CLIENT_ESC}
function pf(u){pf.s=pf.s||{};if(pf.s[u])return;pf.s[u]=1;var l=document.createElement('link');l.rel='prefetch';l.href=u;document.head.appendChild(l);}
function nm(p){return p.name||p.label||(p.lat+', '+p.lon);}
function lab(s,p){return esc(s.replace('X',nm(p)));}
function render(){var L=PS.ord(PS.load());if(!L.length){yp.hidden=true;return;}yp.hidden=false;
ul.innerHTML=L.map(function(p){return '<li data-id="'+esc(p.id)+'"><button type="button" data-a="fav" aria-pressed="'+(p.fav?'true':'false')+'" title="Favourite" aria-label="'+lab(FAV,p)+'">'+(p.fav?'\\u2605':'\\u2606')+'</button><a href="'+LP+'/c/'+esc(p.lat)+','+esc(p.lon)+'">'+esc(nm(p))+'</a><button type="button" data-a="ren" title="Rename" aria-label="'+lab(REN,p)+'">\\u270e</button><button type="button" data-a="del" title="Remove" aria-label="'+lab(DEL,p)+'">\\u00d7</button></li>';}).join('');
L.slice(0,4).forEach(function(p){pf(LP+'/c/'+p.lat+','+p.lon);});
if(L[0]&&!render.sr){render.sr=1;try{var sr=document.createElement('script');sr.type='speculationrules';sr.textContent=JSON.stringify({prerender:[{source:'list',urls:[LP+'/c/'+L[0].lat+','+L[0].lon]}]});document.head.appendChild(sr);}catch(e){}}}
ul.addEventListener('click',function(e){var b=e.target.closest('button[data-a]');if(!b)return;var id=b.closest('li').getAttribute('data-id'),a=b.getAttribute('data-a');var L=PS.load(),p=L.filter(function(x){return x.id===id})[0];if(!p)return;
if(a==='fav')p.fav=!p.fav;else if(a==='ren'){var n=prompt(NAME,p.name||p.label||'');if(n===null)return;p.name=(n.trim()||undefined);}else if(a==='del')L=L.filter(function(x){return x.id!==id;});PS.save(L);render();});
render();})();`;
};

export function renderHome(
  notFound?: string,
  highlights?: NationalHighlights,
  meta?: {
    gridAsOf?: string;
    airAsOf?: string;
    popular?: { label: string; lat: number; lon: number }[];
    map?: IndiaMap;
    warnings?: WarningsSnapshot | null;
    /** India's last days (placedaily.ts), when kept. */
    india?: IndiaTrend | null;
  },
  lang: Lang = "en",
): string {
  const T = (s: string) => esc(t(s, lang));
  const covers = (
    [
      ["air", "air"],
      ["heat", "heat"],
      ["rain", "rain"],
      ["sun", "UV"],
      ["dust", "dust"],
      ["warn", "warnings"],
    ] as [IconName, string][]
  )
    .map(([i, l]) => `<span>${ico(i)}${T(l)}</span>`)
    .join("");
  const examples = `(<span lang="kn">ಬೆಂಗಳೂರು</span> · <span lang="hi">दिल्ली</span> · <span lang="ta">சென்னை</span>)`;
  const hint =
    lang === "en"
      ? `Type the name of a place in India, in any language ${examples}. You then see <b>its sky</b>: air, heat, rain and dust.`
      : `${T("Type the name of a place in India, in any language")} ${examples}. ${T("You then see its sky: air, heat, rain and dust.")}`;
  const missing = notFound
    ? notice("err", T('No place found for "X". Type the name of a city or a place.').replace("X", esc(notFound)))
    : "";
  const official = officialCyclone(meta?.warnings);

  const hero = band(
    lane("l2", [
      stack(
        `<h1 class="t-title">${T("What is it like outside now?")}</h1><p class="t-lead">${T("The open sky of India, one coordinate at a time.")}</p><p class="covers">${covers}</p>`,
      ),
      stack(
        missing +
          searchBox({
            id: "q",
            label: t("Look up a place in India", lang),
            placeholder: t("A place in India, or lat,lon", lang),
            button: t("Go", lang),
            action: lp("/go", lang),
          }) +
          `<p class="t-meta">${hint}</p>` +
          button(t("Use my location", lang), { icon: "pin", id: "nearme", hidden: true }),
      ),
    ]),
  );
  const aside = highlightRows(highlights, meta ?? {}, lang);
  const places = band(
    lane("l2", [
      yourPlacesSlot(lang),
      `<div class="col"><div class="stack"><p class="t-kicker">${T("Popular:")}</p>${popularTiles(meta?.popular ?? [], lang)}</div><div class="grow"></div>${linkButton(lp("/display", lang), t("Put this on a screen", lang), false, "screen")}</div>`,
    ]),
  );
  const body = wrap(
    hero +
      cyclonePlate(official, lang) +
      band(indiaMap(meta?.map, lang, { cyclone: official && cycloneTitle(official.title, lang), aside })) +
      (meta?.india ? band(indiaPanel(meta.india, lang)) : "") +
      places,
  );

  // schema.org WebSite + SearchAction (a search box in results; credits the publisher).
  const site = ld({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "mugilu",
    alternateName: "mugilu: the open sky of India",
    url: SITE,
    description: t(SITE_DESC, lang),
    inLanguage: ["en", "hi", "kn"],
    // Where else mugilu lives, so search engines join it into one entity (the DPG Registry
    // listing joins this once approved).
    sameAs: ["https://github.com/urbanmorph/mugilu"],
    publisher: {
      "@type": "Organization",
      name: "Urban Morph",
      url: "https://urbanmorph.com",
      logo: `${SITE}/apple-touch-icon.png`,
      sameAs: ["https://github.com/urbanmorph"],
    },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE}/go?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  });
  return pageShell(t(`mugilu: ${HAZARDS_SHORT} anywhere in India`, lang), body, {
    path: "/",
    desc: t(SITE_DESC, lang),
    canonical: SITE,
    jsonLd: site,
    ogImage: HOME_OG,
    lang,
    live: true,
    js:
      comboboxJs("q", lang) +
      MAP_JS(lang) +
      `function goHere(a,o){location.href=${JSON.stringify(lp("/c/", lang))}+a+","+o;}` +
      locateJs("nearme", lang, "goHere") +
      yourPlacesJs(lang),
  });
}
