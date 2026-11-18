import { esc } from "../html";
import { slugPlacesByState } from "../slugs";
import { lp, t, type Lang } from "../i18n";
import { HAZARDS, HAZARDS_SHORT } from "../hazards";
import { HOME_OG, SITE, ld, shell } from "../ui/shell";

export const PLACES_CSS = `
.places h1{font-family:var(--serif);font-weight:600;font-size:clamp(1.7rem,6vw,2.2rem);line-height:1.1;margin:.2rem 0 .35rem}
.places .lede{color:var(--muted);font-size:.98rem;line-height:1.5;margin:0 0 .3rem;max-width:54ch}
.places .count{color:var(--muted);font-size:.86rem;margin:0 0 1.7rem}
.places .st{margin:0 0 1.6rem;break-inside:avoid}
.places .st h2{font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 .55rem;padding-bottom:.3rem;border-bottom:1px solid var(--hair)}
.places .st ul{list-style:none;margin:0;padding:0;columns:2;column-gap:1.5rem}
@media(min-width:620px){.places .st ul{columns:3}}
@media(min-width:900px){.places .st ul{columns:4}}
.places .st li{padding:2px 0;break-inside:avoid}
.places .st a{color:var(--sky);text-decoration:none;font-size:.93rem}
.places .st a:hover{text-decoration:underline}
.pindex,.pfind{display:none}
@media(min-width:960px){
.pwrap{display:grid;grid-template-columns:minmax(0,12rem) minmax(0,1fr);gap:2.6rem;align-items:start}
.pindex{display:flex;flex-direction:column;gap:.15rem;position:sticky;top:1.2rem;max-height:calc(100vh - 2.4rem);overflow:auto;font-size:.88rem;line-height:1.55}
.pindex a{color:var(--muted);text-decoration:none}.pindex a:hover{color:var(--ink)}
.pfind{display:flex;flex-direction:column;gap:.35rem;margin:0 0 1.4rem;max-width:22rem;font-size:.88rem;color:var(--muted)}
.pfind[hidden]{display:none}
.pfind input{padding:.6rem .8rem;border:1px solid var(--line);border-radius:.6rem;background:var(--card);color:var(--ink);font:inherit;font-size:1rem}
.pcards{columns:3;column-gap:1rem}
.places .pcards .st{break-inside:avoid;border:1px solid var(--line);border-radius:14px;background:var(--card);padding:.8rem 1rem;margin:0 0 1rem}
.places .pcards .st ul{columns:2;column-gap:1rem}
.places .pcards .st h2{border:0;padding:0;margin:0 0 .5rem}
}
`;

// The /places search (wide screens): shows only the places whose name holds the text,
// and only the states that still have one. Hidden without the script.
export const PLACES_FIND_JS = `(function(){var p=document.querySelector('.pfind');if(!p)return;p.hidden=false;var q=document.getElementById('pq');
q.addEventListener('input',function(){var s=q.value.trim().toLowerCase();document.querySelectorAll('.pcards .st').forEach(function(st){var any=false;
st.querySelectorAll('li').forEach(function(li){var ok=!s||li.textContent.toLowerCase().indexOf(s)>-1;li.hidden=!ok;if(ok)any=true});st.hidden=!any})})})();`;

/** The place directory: every named /c/{slug} page, grouped by state. This is the
 *  crawlable index that links all ~800 place pages, so search engines have a path
 *  to them (and readers can browse) instead of the pages being sitemap-only. */
export function renderPlaces(lang: Lang = "en"): string {
  const groups = slugPlacesByState();
  const total = groups.reduce((n, g) => n + g.places.length, 0);
  const anchor = (state: string) =>
    `st-${state
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;
  const index = groups.map((g) => `<a href="#${anchor(g.state)}">${esc(g.state)}</a>`).join("");
  const sections = groups
    .map(
      (g) =>
        `<section class="st" id="${anchor(g.state)}"><h2>${esc(g.state)}</h2><ul>${g.places
          .map((p) => `<li><a href="${lp(`/c/${p.slug}`, lang)}">${esc(p.name)}</a></li>`)
          .join("")}</ul></section>`,
    )
    .join("");
  const canonical = "https://mugilu.live/places";
  const title = t(`Every place in India: ${HAZARDS_SHORT} by district · mugilu`, lang);
  const desc = t(`Browse the sky over every district and major city in India: the ${HAZARDS}, one page each.`, lang);
  const crumb = ld({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "mugilu", item: SITE },
      { "@type": "ListItem", position: 2, name: "Places", item: canonical },
    ],
  });
  const body = `
  <div class="places">
    <h1>${t("Every place, by state", lang)}</h1>
    <p class="lede">${t(`The sky over every district and major city in India, one page each. Pick a place to see its ${HAZARDS} right now.`, lang)}</p>
    <p class="count">${total} ${t("places across India", lang)}</p>
    <div class="pwrap">
      <nav class="pindex" aria-label="States">${index}</nav>
      <div>
        <p class="pfind" hidden><label for="pq">${t("Find a place", lang)}</label><input type="search" id="pq" autocomplete="off"></p>
        <div class="pcards">${sections}</div>
      </div>
    </div>
  </div>
  <script>${PLACES_FIND_JS}</script>`;
  return shell(title, body, PLACES_CSS, { desc, canonical, jsonLd: crumb, ogImage: HOME_OG, lang, wide: true });
}
