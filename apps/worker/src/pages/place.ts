import { type Conditions } from "../types";
import { GLYPH_CSS } from "../glyphs";
import { orderByRisk, placeLabel } from "../readings";
import { esc } from "../html";
import { PERSONA_LABEL, ambientRisk, ambientSummary, type Persona } from "../score";
import { siblingPlaces, slugFromPath } from "../slugs";
import { aroundLinks } from "../sister";
import { lp, t, type Lang } from "../i18n";
import { OFFLINE_NOTE_ID } from "../sw";
import { FRESHEN } from "../freshen";
import { HAZARDS } from "../hazards";
import { ALERTS_CSS, ALERTS_JS, renderAlertsBox } from "../alerts-ui";
import { HOME_OG, SITE, TINT_BODY_CSS, istTime, ld, relTime, shell } from "../ui/shell";
import {
  DRIVER_KEY,
  LayerCtx,
  PLACE_RECORDER,
  airLag,
  grapLine,
  headHtml,
  icon,
  layerData,
  lyr,
  personaLinks,
  readVars,
  renderNearbyWarnings,
  renderWarning,
  searchTitle,
} from "./read";

export const CONDITIONS_CSS = `
${TINT_BODY_CSS}
.coord{font:500 .78rem/1.4 var(--mono);letter-spacing:.04em;color:var(--muted);margin:.4rem 0 0}
.loc{font-family:var(--serif);font-weight:600;font-size:clamp(1.7rem,6.5vw,2.15rem);line-height:1.05;letter-spacing:-.01em;margin:.35rem 0 0}
.when{color:var(--muted);font-size:.9rem;margin:.3rem 0 0}
.near-warn{color:var(--muted);font-size:.85rem;margin:.6rem 0 0}
.stale{margin:.8rem 0 0;padding:.6rem .8rem;border-radius:10px;background:color-mix(in srgb,var(--muted) 14%,transparent);font-size:.9rem}
.warn{display:flex;gap:.65rem;align-items:flex-start;margin:1.3rem 0 0;padding:.8rem .95rem;background:color-mix(in srgb,var(--wc) 14%,var(--bg));border-left:3px solid var(--wc);border-radius:0 7px 7px 0}
.warn .ic{color:var(--wc);flex:none;margin-top:1px}
.warn b{font-weight:700;font-size:.95rem;line-height:1.35}
.warn .wsrc{display:block;margin-top:2px;color:var(--muted);font-size:.76rem;font-weight:500}
.amb{margin:1.7rem 0 .2rem}
.amb-eye{display:flex;align-items:center;gap:.45rem;font:600 .76rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 .55rem}
.amb-eye .ic{width:15px;height:15px;color:var(--cond-text)}
.amb-head{font-family:var(--serif);font-weight:600;font-size:clamp(2.6rem,12vw,3.7rem);line-height:.95;letter-spacing:-.025em;margin:0;color:var(--ink)}
.amb-head .b{color:var(--cond-text)}
.amb-say{font-family:var(--serif);font-size:1.18rem;line-height:1.42;margin:.65rem 0 0;color:var(--ink);max-width:32ch}
.amb-act{font:600 1rem/1.4 var(--sans);margin:.5rem 0 0;max-width:34ch}
.amb-also{display:flex;align-items:flex-start;gap:.4rem;font:500 .92rem/1.4 var(--sans);color:var(--cond-text);margin:.7rem 0 0;max-width:34ch}
.amb-also .ic{width:16px;height:16px;flex:none;margin-top:.1rem}
.who{display:flex;flex-wrap:wrap;gap:.35rem 1rem;margin:1.2rem 0 0;padding:0}
.who a{font:500 .9rem var(--sans);color:var(--muted);text-decoration:none;padding-bottom:2px;border-bottom:2px solid transparent}
.who a.on{color:var(--ink);border-color:var(--cond)}
.strata{margin:1.8rem 0 0;border-top:1px solid var(--hair)}
.lyr{display:grid;grid-template-columns:5.4rem 1fr;gap:0 1rem;padding:1.05rem .1rem;border-bottom:1px solid var(--hair)}
.lyr dt{display:flex;flex-wrap:wrap;align-items:center;align-self:start;gap:.3rem .5rem;font:600 .8rem/1.2 var(--sans);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding-top:.6rem}
.lyr dt .ic{flex:none}
.lyr.on dt{color:var(--cond-text)}
.lyr .fy{white-space:nowrap;margin-left:.1rem;padding:.1rem .4rem;border-radius:999px;font:600 .66rem/1.3 var(--sans);letter-spacing:.03em;text-transform:none;color:var(--ink);background:color-mix(in srgb,var(--cond) 18%,transparent)}
.lyr.quiet .num,.lyr.quiet .q{color:var(--muted)}
.lyr dd{margin:0;display:flex;flex-direction:column;gap:.16rem;min-width:0}
.lyr .num{font:700 2.2rem/1 var(--sans);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.lyr .q{font-size:.95rem;color:var(--ink)}
.lyr .q b{font-weight:700}
.lyr .q .qa{color:var(--muted);text-transform:uppercase;font-size:.72rem;letter-spacing:.05em}
.lyr .q .qa.nu{text-transform:none;letter-spacing:.01em}
.lyr .sub{color:var(--muted);font-size:.82rem;line-height:1.5}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:.35rem;vertical-align:.06em}
.dot.meas{background:var(--ink)}
.dot.mod{background:transparent;border:1.5px solid var(--muted)}
.cx footer{margin:2.1rem 0 0;border-top:1px solid var(--hair);padding-top:1.1rem}
.attr{color:var(--muted);font-size:.8rem;margin:0 0 .3rem}
.disc{color:var(--muted);font-size:.76rem;line-height:1.5;margin:0}
.raw{margin:.95rem 0 0;font:500 .82rem var(--mono);letter-spacing:.02em}
.raw a{color:var(--cond-text);text-decoration:none}
.raw a:hover{text-decoration:underline}
.grap{margin:.9rem 0 0;font-size:.92rem;line-height:1.5;color:var(--muted)}.grap a{color:var(--sky)}
.toscreen{display:inline-flex;align-items:center;gap:.4rem;margin:1rem 0 0;font-size:.92rem;color:var(--sky);text-decoration:none}.toscreen:hover{text-decoration:underline}.toscreen .ic{width:16px;height:16px}
.nearby{margin:1.1rem 0 0;font-size:.9rem;line-height:1.9;color:var(--muted)}.nearby a{color:var(--cond-text);text-decoration:none}.nearby a:hover{text-decoration:underline}
.cxback{margin:1.1rem 0 0;font-size:.9rem}.cxback a{color:var(--muted);text-decoration:none}.cxback a:hover{color:var(--ink)}
@media(min-width:960px){
main:has(>.cx){max-width:1120px;padding-top:28px}
.cx-cols{display:grid;grid-template-columns:minmax(0,23rem) minmax(0,1fr);column-gap:3.5rem;align-items:start}

.cx-r .strata{margin-top:.5rem;display:block;column-count:2;column-gap:2.2rem;border-top:0}
.cx-r .lyr{break-inside:avoid}
.cx-r .lyr{grid-template-columns:1fr;align-content:start;border-top:1px solid var(--hair);border-bottom:0;padding:1rem .1rem 1.15rem}
.cx-r .lyr dt{padding-top:0;margin-bottom:.5rem}
}
/* The left rail (place, read, alerts) stays in view while the layers scroll, when it fits.
   It is pinned within .cx-cols, so it stops where the columns end, above the footer. */
@media(min-width:960px) and (min-height:820px){.cx-l{position:sticky;top:1.5rem}}
@media(prefers-reduced-motion:no-preference){
.coord,.loc,.when,.warn,.amb,.lyr{animation:rise .55s both cubic-bezier(.2,.7,.2,1)}
.loc{animation-delay:.03s}.when{animation-delay:.06s}.warn{animation-delay:.09s}.amb{animation-delay:.12s}
.strata .lyr:nth-child(1){animation-delay:.2s}.strata .lyr:nth-child(2){animation-delay:.26s}.strata .lyr:nth-child(3){animation-delay:.32s}.strata .lyr:nth-child(4){animation-delay:.38s}.strata .lyr:nth-child(5){animation-delay:.44s}
}
/* Phones: one column, the alerts box after the layers (it sits in the left rail on laptops). */
@media(max-width:959px){.cx{display:flex;flex-direction:column}.cx-cols,.cx-l{display:contents}.cx-r{order:1}.cx .alerts{order:2}.cx footer{order:3}}
@keyframes rise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
`;

export function renderConditionsPage(
  c: Conditions,
  persona: Persona = "everyone",
  canonical?: string,
  lang: Lang = "en",
  /** mugilu's VAPID public key, when alerts are set up: shows the "alert me" box. */
  alertsKey?: string,
  /** An arbitrary point (not a named place): endless and thin, so kept out of search indexes. */
  noindex = false,
): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const { meaning } = say;
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c); // raw: shell() escapes the title
  const place = esc(placeName);

  // Persona toggles (understated text, not chips).
  const base = lp(`/c/${slug}`, lang);
  const pills = personaLinks((p) => (p === "everyone" ? base : `${base}?as=${p}`), risk.persona, lang);

  const head = headHtml(risk, lang);

  // The readings, as strata, in the order they matter now; the Ambient driver's
  // stratum is highlighted (icon + label in the condition colour).
  const ctx: LayerCtx = { risk, forYou: t("for you", lang) };
  const strata = layerData(c, risk, lang).map((d) =>
    lyr(d.key, d.label, ctx, d.num, d.q, d.sub, d.bar + (d.normal ?? "")),
  );

  // Cross-links to nearby named places in the same state. Turns the ~800 /c/{slug}
  // pages from sitemap-only orphans into a connected graph a crawler can walk, the
  // fix for their sitting in "Discovered - currently not indexed". Only on a named
  // page (canonical is /c/{slug}); arbitrary-coordinate pages have no state anchor.
  let nearby = "";
  if (canonical) {
    const slug = slugFromPath(new URL(canonical).pathname)?.slug;
    const sibs = slug ? siblingPlaces(slug) : [];
    if (sibs.length) {
      const near = sibs.map((s) => `<a href="${lp(`/c/${s.slug}`, lang)}">${esc(s.name)}</a>`).join(" · ");
      nearby = `<nav class="nearby" aria-label="${esc(t("Nearby places", lang))}">${t("Nearby:", lang)} ${near}</nav>`;
    }
    // The same place on the sister sites: its ward map (bharatlas) and its state's species (yellide).
    const around = slug ? aroundLinks(slug) : null;
    if (around && (around.wards || around.species)) {
      const label = t("Around {place}:", lang).replace("{place}", around.city);
      const links = [
        around.wards
          ? `<a href="${around.wards}">${esc(t("Find your ward: {place} ward map", lang).replace("{place}", around.city))} (bharatlas)</a>`
          : "",
        around.species
          ? `<a href="${around.species}">${esc(t("Species of {state}", lang).replace("{state}", around.state))} (yellide)</a>`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");
      nearby += `<nav class="nearby around" aria-label="${esc(label.replace(/:$/, ""))}">${esc(label)} ${links}</nav>`;
    }
  }
  // The air stations around the place, each to its own page ("Anand Vihar AQI").
  if (c.nearby_stations?.length) {
    const list = c.nearby_stations
      .map((s) => `<a href="${lp(`/s/${s.provider}/${s.raw_id}`, lang)}">${esc(s.name)}</a> ${s.aqi}`)
      .join(" · ");
    nearby += `<nav class="nearby" aria-label="${esc(t("Air stations near here", lang))}">${t("Air stations near here", lang)}: ${list}</nav>`;
  }

  const body = `
  <article class="cx">
    <div class="cx-cols">
    <div class="cx-l">
    <p class="coord">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</p>
    <h1 class="loc" data-ll="${c.location.lat},${c.location.lon}">${place}</h1>
    <p class="when">${t("the sky at this point", lang)} · ${t("updated", lang)} ${relTime(c.as_of)}${airLag(c) ? ` · ${t("air reading", lang)} ${relTime(c.air_as_of!)}` : ""}${c.weather_as_of ? ` · ${t("weather reading", lang)} ${relTime(c.weather_as_of)}` : ""}</p>
    <p class="stale" id="${OFFLINE_NOTE_ID}" hidden>${t("No connection. This is the last reading on this device, from X. The conditions and warnings can be different now.", lang).replace("X", esc(istTime(c.air_as_of ?? c.as_of)))}</p>
    ${c.warnings?.length ? c.warnings.map((w) => renderWarning(w, lang)).join("") : ""}
    ${c.nearby_warnings?.length ? renderNearbyWarnings(c.nearby_warnings, lang) : ""}
    ${c.grap ? grapLine(c.grap, lang) : ""}
    <section class="amb">
      <p class="amb-eye">${icon(DRIVER_KEY[risk.driver] ?? "clear")}<span>Ambient · ${esc(t(PERSONA_LABEL[risk.persona], lang))}</span></p>
      <p class="amb-head">${head}</p>
      <p class="amb-say">${esc(meaning)}</p>
      ${say.action ? `<p class="amb-act">${esc(say.action)}</p>` : ""}
      ${say.also ? `<p class="amb-also">${icon("users")}${esc(say.also)}</p>` : ""}
      <nav class="who" aria-label="${esc(t("Who is this for", lang))}">${pills}</nav>
      <a class="toscreen" href="${lp(`/c/${slug}?kiosk${risk.persona !== "everyone" ? `&amp;as=${risk.persona}` : ""}`, lang)}">${icon("screen")}${t("Put this on a screen", lang)}</a>
    </section>
    ${alertsKey ? renderAlertsBox(alertsKey, lang) : ""}
    </div>
    <div class="cx-r">
    <dl class="strata">${orderByRisk(strata, risk, c)
      .map((l) => l.html)
      .join("")}</dl>
    </div>
    </div>
    <footer>
      <p class="attr">${esc(lang === "en" ? c.attribution : c.attribution.replace(/^Sources:/, `${t("Sources", lang)}:`))}</p>
      <p class="disc">${esc(t(c.disclaimer, lang))}</p>
      <p class="raw"><a href="/c/${slug}.json">${t("JSON", lang)}</a> · <a href="/c/${slug}.md">${t("Markdown", lang)}</a> · <a href="/c/${slug}.png">${t("PNG", lang)}</a> · <a href="/embed/${slug}">${t("Embed", lang)}</a> · <a href="${lp(`/c/${slug}?kiosk`, lang)}">${t("Display", lang)}</a></p>
      ${nearby}
      <p class="cxback"><a href="${lp("/", lang)}">← ${t("Look up another place", lang)}</a> · <a href="${lp("/places", lang)}">${t("all places", lang)}</a></p>
    </footer>
  </article>`;

  const css = CONDITIONS_CSS + GLYPH_CSS + (alertsKey ? ALERTS_CSS : "") + `\n:root{${readVars(risk)}}`;
  // Title and description in the words people search ("Delhi AQI today"), with the number.
  const { title, lead } = searchTitle(c, placeName, lang);
  const desc = `${lead ?? `${placeName}:`} ${meaning} ${t(`The ${HAZARDS} over this spot, with the single worst hazard named for you.`, lang)}`;
  // schema.org Dataset: credits mugilu + the licence, points at the machine-readable
  // siblings (the "built on it" signal in structured data; aids answer-engine pickup).
  const dataset = canonical
    ? ld({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Dataset",
            name: `Sky conditions at ${placeName}`,
            description: `The ${HAZARDS} at ${placeName}, India - right now.`,
            url: canonical,
            isAccessibleForFree: true,
            creator: { "@type": "Organization", name: "mugilu", url: SITE },
            license: "https://mugilu.live/terms",
            temporalCoverage: c.as_of,
            spatialCoverage: {
              "@type": "Place",
              name: c.place ?? undefined,
              geo: { "@type": "GeoCoordinates", latitude: c.location.lat, longitude: c.location.lon },
            },
            distribution: [
              { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${canonical}.json` },
              { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: `${canonical}.md` },
            ],
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "mugilu", item: SITE },
              { "@type": "ListItem", position: 2, name: placeName, item: canonical },
            ],
          },
        ],
      })
    : undefined;
  return shell(title, body + PLACE_RECORDER + FRESHEN + (alertsKey ? `<script>${ALERTS_JS}</script>` : ""), css, {
    desc,
    canonical,
    jsonLd: dataset,
    ogImage: canonical ? `${canonical}.png` : HOME_OG,
    lang,
    noindex,
  });
}
