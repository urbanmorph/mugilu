import { type NationalHighlights } from "../highlights";
import { esc } from "../html";
import { slugForName } from "../slugs";
import { lp, t, type Lang } from "../i18n";
import { FRESHEN } from "../freshen";
import { HAZARDS_SHORT, SITE_DESC } from "../hazards";
import { AQI_BAND_LABEL } from "../aqi";
import { RISK_BANDS, type RiskBand } from "../score";
import { type IndiaMap } from "../indiamap";
import { officialCyclone, type WarningsSnapshot } from "../sachet";
import { DUST_PHRASE, airBand, dustBand, heatBand, heatPhrase } from "./read";
import { issuerName } from "./warnings";
import { CLIENT_ESC, HOME_OG, SITE, istTime, ld, relTime } from "../ui/shell";
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

export const CITIES = [
  { name: "Delhi", lat: 28.61, lon: 77.21 },
  { name: "Mumbai", lat: 19.07, lon: 72.88 },
  { name: "Bengaluru", lat: 12.97, lon: 77.59 },
  { name: "Kolkata", lat: 22.57, lon: 88.36 },
  { name: "Chennai", lat: 13.08, lon: 80.27 },
  { name: "Hyderabad", lat: 17.39, lon: 78.49 },
];

/** "Popular": real top lookups (D1) first, then the seed cities, eight at most, each linked to
 *  its canonical /c/{slug} when it has one. A long ward name gives way to its city. */
function popularTiles(popular: { label: string; lat: number; lon: number }[], lang: Lang): string {
  const shortPlace = (label: string) => {
    const seg = label.split(",").map((s) => s.trim());
    return seg[0].length > 14 && seg.length > 1 ? seg[seg.length - 1] : seg[0];
  };
  const seen = new Set<string>();
  const tiles: string[] = [];
  for (const p of [...popular.map((x) => ({ ...x, name: shortPlace(x.label) })), ...CITIES]) {
    const k = p.name.toLowerCase();
    if (seen.has(k) || tiles.length >= 8) continue;
    seen.add(k);
    const s = slugForName(p.name);
    tiles.push(placeTile(lp(s ? `/c/${s}` : `/c/${p.lat},${p.lon}`, lang), p.name));
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
  const row = (
    icon: IconName,
    label: string,
    name: string,
    say: string,
    level: RiskBand,
    lat: number,
    lon: number,
    iso?: string,
  ) =>
    `<a class="hl" href="${lp(`/c/${lat},${lon}`, lang)}">${ico(icon)}<span class="stack">` +
    `<span><span class="t-meta">${esc(t(label, lang))}:</span> <b class="t-value">${name}</b></span>` +
    `<span class="row-c"><span>${say}</span>${levelChip(level, lang)}</span>` +
    (iso ? `<span class="t-meta">${relTime(iso)}</span>` : "") +
    `</span></a>`;
  const rows: string[] = [];
  if (h?.hottest) {
    const { name, state, lat, lon, apparent_c, wet_bulb_c } = h.hottest;
    const say = `${feels(apparent_c)}, ${esc(t(heatPhrase(apparent_c, wet_bulb_c), lang))}`;
    rows.push(
      row("heat", "Hottest", place(name, state), say, heatBand(apparent_c, wet_bulb_c), lat, lon, meta.gridAsOf),
    );
  }
  if (h?.dustiest) {
    const { name, state, lat, lon, dust_ug_m3 } = h.dustiest;
    const b = dustBand(dust_ug_m3);
    rows.push(row("dust", "Dustiest", place(name, state), esc(t(DUST_PHRASE[b], lang)), b, lat, lon, meta.gridAsOf));
  }
  if (h?.worstAir) {
    const w = h.worstAir;
    const name = place([w.station, w.name].filter(Boolean).join(", "), w.state);
    const say = `AQI ${w.aqi} ${esc(t(AQI_BAND_LABEL[w.band] ?? "", lang))}`;
    rows.push(row("air", "Worst air", name, say, airBand(w.band), w.lat, w.lon, meta.airAsOf));
  }
  return rows.length ? `<div>${rows.join("")}</div>` : "";
}

/** The newest official cyclone warning, as a plate: IMD's category and the storm's name. */
function cyclonePlate(c: ReturnType<typeof officialCyclone>, lang: Lang): string {
  if (!c) return "";
  const issuer = issuerName(c.alert.issuer);
  const time = istTime(new Date(c.alert.sent).toISOString());
  const [who, when] = [esc(issuer), esc(time)];
  const cap = esc(
    t("Original alert (CAP): {issuer}, {time}", lang).replace("{issuer}", issuer).replace("{time}", time),
  );
  return band(
    warningPlate({
      bar: [
        `<a href="${lp("/warnings", lang)}">${esc(t("Active warnings", lang))}</a>`,
        `<span>${who}</span>`,
        `<span>${when}</span>`,
        `<a href="${esc(c.alert.link)}" rel="noopener" aria-label="${cap}">CAP</a>`,
      ],
      title: c.title,
      icon: "cyclone",
      body: `<p>${esc(c.alert.headline)}</p>`,
      label: t("Active warnings", lang),
    }),
  );
}

/** Your places: recents and favourites from this browser (first-party, no login), as .yp rows. */
const yourPlacesJs = (lang: Lang) => {
  const S = (s: string) => JSON.stringify(t(s, lang));
  return `(function(){var K='mugilu:places',yp=document.getElementById('yp');if(!yp)return;var ul=yp.querySelector('ul.yp'),LP=${JSON.stringify(lang === "en" ? "" : "/" + lang)},FAV=${S("Favourite X")},REN=${S("Rename X")},DEL=${S("Remove X")},NAME=${S("Type a name for this place (for example, Home or Office)")};
${CLIENT_ESC}
function pf(u){pf.s=pf.s||{};if(pf.s[u])return;pf.s[u]=1;var l=document.createElement('link');l.rel='prefetch';l.href=u;document.head.appendChild(l);}
function load(){try{return JSON.parse(localStorage.getItem(K))||[]}catch(e){return[]}}
function save(L){try{localStorage.setItem(K,JSON.stringify(L))}catch(e){}}
function nm(p){return p.name||p.label||(p.lat+', '+p.lon);}
function ord(L){return L.slice().sort(function(a,b){return (b.fav?1:0)-(a.fav?1:0)||b.n-a.n||b.t-a.t});}
function lab(s,p){return esc(s.replace('X',nm(p)));}
function render(){var L=ord(load());if(!L.length){yp.hidden=true;return;}yp.hidden=false;
ul.innerHTML=L.map(function(p){return '<li data-id="'+esc(p.id)+'"><button type="button" data-a="fav" aria-pressed="'+(p.fav?'true':'false')+'" title="Favourite" aria-label="'+lab(FAV,p)+'">'+(p.fav?'\\u2605':'\\u2606')+'</button><a href="'+LP+'/c/'+esc(p.lat)+','+esc(p.lon)+'">'+esc(nm(p))+'</a><button type="button" data-a="ren" title="Rename" aria-label="'+lab(REN,p)+'">\\u270e</button><button type="button" data-a="del" title="Remove" aria-label="'+lab(DEL,p)+'">\\u00d7</button></li>';}).join('');
L.slice(0,4).forEach(function(p){pf(LP+'/c/'+p.lat+','+p.lon);});
if(L[0]&&!render.sr){render.sr=1;try{var sr=document.createElement('script');sr.type='speculationrules';sr.textContent=JSON.stringify({prerender:[{source:'list',urls:[LP+'/c/'+L[0].lat+','+L[0].lon]}]});document.head.appendChild(sr);}catch(e){}}}
ul.addEventListener('click',function(e){var b=e.target.closest('button[data-a]');if(!b)return;var id=b.closest('li').getAttribute('data-id'),a=b.getAttribute('data-a');var L=load(),p=L.filter(function(x){return x.id===id})[0];if(!p)return;
if(a==='fav')p.fav=!p.fav;else if(a==='ren'){var n=prompt(NAME,p.name||p.label||'');if(n===null)return;p.name=(n.trim()||undefined);}else if(a==='del')L=L.filter(function(x){return x.id!==id;});save(L);render();});
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
  const levels = band(`<div class="lkey">${RISK_BANDS.map((b) => levelChip(b, lang)).join("")}</div>`);
  const body =
    wrap(
      hero +
        cyclonePlate(official, lang) +
        band(indiaMap(meta?.map, lang, { cyclone: official?.title, aside })) +
        places +
        levels,
    ) + FRESHEN;

  // schema.org WebSite + SearchAction (a search box in results; credits the publisher).
  const site = ld({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "mugilu",
    alternateName: "mugilu: the open sky of India",
    url: SITE,
    description: t(SITE_DESC, lang),
    publisher: {
      "@type": "Organization",
      name: "urbanmorph",
      url: "https://urbanmorph.com",
      logo: "https://mugilu.live/apple-touch-icon.png",
      sameAs: ["https://github.com/urbanmorph"],
    },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://mugilu.live/go?q={search_term_string}" },
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
    js:
      comboboxJs("q", lang) +
      MAP_JS(lang) +
      `function goHere(a,o){location.href=${JSON.stringify(lp("/c/", lang))}+a+","+o;}` +
      locateJs("nearme", lang, "goHere") +
      yourPlacesJs(lang),
  });
}
