import { SOURCES } from "../sources";
import { esc } from "../html";
import { lp, t, type Lang } from "../i18n";
import { HAZARDS } from "../hazards";
import { GH_MARK, HOME_OG, SITE, UM_ICON, ld, shell, withToc } from "../ui/shell";
import { icon } from "./read";

// Shared chrome for the long-form pages (about, terms, 404): editorial serif
// headlines + a calm sky-tinted backdrop, matching the /c language. Keeps the
// .alead2/.amuted/.alist classes /terms still uses.
export const ABOUT_CSS = `
body{background:linear-gradient(180deg,color-mix(in srgb,var(--sky) 13%,var(--bg)),var(--bg) 42%) var(--bg) no-repeat}
.ahero{font-family:var(--serif);font-weight:600;font-size:clamp(2.1rem,8.5vw,3rem);line-height:1.05;letter-spacing:-.02em;margin:1.3rem 0 .6rem}
.alead{font-family:var(--serif);font-size:1.22rem;line-height:1.42;margin:0 0 .4rem;max-width:34ch}
.alead2{line-height:1.55;margin:0 0 1rem}.alead2 a{color:var(--sky)}
.ah{display:flex;align-items:center;gap:.45rem;font:600 .76rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:2.1rem 0 .7rem}
.ah .ic{width:15px;height:15px;color:var(--sky);flex:none}
.atext{font-size:1.04rem;line-height:1.62;margin:0 0 .9rem}.atext a{color:var(--sky)}.atext b{font-weight:700}
.abuild{font-size:.96rem;line-height:1.55;color:var(--muted);border-left:3px solid color-mix(in srgb,var(--sky) 45%,var(--line));padding:.15rem 0 .15rem 1rem;margin:.2rem 0 .9rem}
.amuted{color:var(--muted);margin:0 0 .6rem}
.alist{list-style:none;margin:0 0 1rem;padding:0}
.alist li{display:flex;gap:11px;align-items:flex-start;padding:7px 0;line-height:1.45}
.alist li .ic{margin-top:2px;color:var(--sky);flex:none}
.alist li .t{flex:1;min-width:0}
.alist.on{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 14px}
.builtby{display:flex;gap:15px;align-items:center;margin:2.3rem 0 0}
.builtby>a{flex:none}.builtby img{border-radius:10px;display:block}
.bb-by{margin:0 0 .6rem;font-size:1rem}.bb-by a{color:var(--sky)}
.builtby .star{display:inline-flex;align-items:center;gap:.45rem;border:1px solid var(--line);border-radius:999px;padding:6px 13px;color:var(--ink);font-weight:600;text-decoration:none;font-size:.84rem}
.builtby .star:hover{border-color:var(--muted);background:color-mix(in srgb,var(--ink) 5%,transparent)}
.builtby .star svg{width:15px;height:15px}
.adisc{color:var(--muted);font-size:.82rem;line-height:1.5;border-top:1px solid var(--hair);padding-top:1.1rem;margin-top:2.3rem}
.aback{margin:1.3rem 0 0}.aback a{color:var(--sky);text-decoration:none;font-weight:600;font-family:var(--mono);font-size:.85rem;letter-spacing:.02em}
.ax code{overflow-wrap:anywhere}
.axw{max-width:42rem;margin:0 auto}.toc{display:none}
@media(min-width:1100px){.axw{max-width:none;display:grid;grid-template-columns:minmax(0,13rem) minmax(0,42rem);gap:3.5rem;justify-content:center;align-items:start}
.toc{display:flex;flex-direction:column;gap:.55rem;position:sticky;top:1.6rem;margin-top:5.2rem;padding-left:.9rem;border-left:2px solid var(--line);font-size:.9rem;line-height:1.35}
.toc b{font:600 .72rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem}
.toc a{color:var(--muted);text-decoration:none}.toc a:hover{color:var(--ink)}}
`;

/** The About page: the origin story + the dual nature (for people, and as
 *  infrastructure). Person-first, jargon-free. The "Build on it" section is a
 *  stub that grows as the API / MCP land. */
// The hand-written source credits on /about (its FAQ and "where it comes from"): translated
// prose, so not built from sources.ts SOURCES, but a test fails if either leaves one out.
export const SOURCES_FAQ =
  "Air from CPCB, Airnet (CSTEP), Aurassure and Google AirView+ via the Open Air Quality (OAQ) broker; weather, heat, UV and dust from Open-Meteo, and the 1991-2020 heat normals from ERA5 reanalysis (Copernicus) via Open-Meteo; official warnings from NDMA and IMD via SACHET; fire smoke from NASA FIRMS; cyclone tracks from JTWC; place search from OpenStreetMap and GeoNames, and boundaries from bharatlas; years of life lost from the AQLI method. Each source keeps its own licence, and mugilu credits all of them.";
export const SOURCES_ABOUT =
  "mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: CPCB, Airnet, Aurassure and Google AirView+ (via the OAQ broker) for air, Open-Meteo for weather, ERA5 reanalysis (Copernicus) for the heat normals, NDMA and IMD (via SACHET) for warnings, NASA FIRMS for fire smoke, JTWC for cyclone tracks, OpenStreetMap, GeoNames and bharatlas for places and the map of India, and the AQLI method for years of life lost. The code is open under the MIT licence; the data keeps each source's own terms.";

/** English prose with each source name from SOURCES in bold. */
export const boldSourceNames = (text: string) =>
  SOURCES.flatMap((s) => s.names).reduce((out, n) => out.split(n).join(`<b>${n}</b>`), esc(text));

export function renderAbout(lang: Lang = "en"): string {
  // Q&A that ALSO ships as FAQPage structured data (answer-engine + SERP pickup);
  // the visible copy below and the schema are generated from this one list.
  const faqs = [
    {
      q: "Is it safe to go outside right now?",
      a: "mugilu names the single worst hazard over your exact location and says plainly what to do, weighted for who you are: asthma, older adults, children, outdoor workers, or a heart condition. It is informational, not medical or safety advice; for official warnings, consult NDMA and IMD.",
    },
    {
      q: "What is wet-bulb temperature, and why does mugilu show it?",
      a: "Wet-bulb is the temperature a wet thermometer settles at: it folds heat and humidity into the one number that decides whether your body can still cool itself. Above about 32°C wet-bulb, even resting in shade turns dangerous. Ordinary feels-like numbers hide this, so mugilu surfaces it.",
    },
    {
      q: "Where does mugilu's data come from?",
      a: SOURCES_FAQ,
    },
    {
      q: "Is mugilu free?",
      a: "Yes. It is free, open source (MIT) and non-commercial, with no sign-up. Every reading is also available as JSON, Markdown, an embeddable card, an OpenAPI spec, and an MCP server for AI agents.",
    },
    {
      q: "How current are the readings?",
      a: "Air refreshes hourly, the national heat, rain, UV and dust grid every few hours, and official warnings hourly. Every reading is timestamped with how long ago it was measured.",
    },
  ];
  // Prose: English keeps its inline markup; hi/kn render the reviewed translated text
  // (proper nouns already Latin). Precomputed to avoid nested template literals.
  const heroH1 =
    lang === "en"
      ? "The open sky of India,<br>one coordinate at a time."
      : t("The open sky of India, one coordinate at a time.", lang);
  const sathya =
    lang === "en"
      ? `<a href="https://www.sathyasankaran.com">Sathya Sankaran</a> wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.`
      : t(
          "Sathya Sankaran wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.",
          lang,
        );
  const refPara =
    lang === "en"
      ? `Add <b>?ref=your-app</b> to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.`
      : t(
          "Add ?ref=your-app to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.",
          lang,
        );
  const wherePara = lang === "en" ? boldSourceNames(SOURCES_ABOUT) : t(SOURCES_ABOUT, lang);
  const freePara =
    lang === "en"
      ? `The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is <b>non-commercial, for good</b>, the third in a small set of public tools alongside <a href="https://bharatlas.com">bharatlas</a> and <a href="https://mdshare.live">mdshare</a>.`
      : t(
          "The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is non-commercial, for good, the third in a small set of public tools alongside bharatlas and mdshare.",
          lang,
        );
  const builtBy =
    lang === "en"
      ? `Built by <a href="https://urbanmorph.com">urbanmorph</a>, led by <a href="https://www.sathyasankaran.com">Sathya Sankaran</a>.`
      : t("Built by urbanmorph, led by Sathya Sankaran.", lang);
  // Descriptive link texts in the "Build on it" list (format tokens like JSON/Markdown
  // stay Latin; these two are prose, so they localise).
  const aboutOpenapi = lang === "en" ? "OpenAPI spec" : t("OpenAPI spec", lang);
  const aboutSnapshot = lang === "en" ? "snapshot image" : t("snapshot image", lang);
  const body = `
  <article class="ax">
  <h1 class="ahero">${heroH1}</h1>
  <p class="alead">${t("A whole-sky view for people, and shared infrastructure for anyone building on top of it.", lang)}</p>

  <p class="ah">${icon("compass")}<span>${t("Why mugilu", lang)}</span></p>
  <p class="atext">${t("For years, people across India have made the sky legible one piece at a time: a map of one city's air, a thread about a heatwave, a chart of last year's monsoon. Brilliant work, but scattered, and easy to lose by the next season.", lang)}</p>
  <p class="atext">${sathya}</p>
  <p class="atext">${t("That is mugilu.", lang)}</p>
  <p class="atext amuted">${t("mugilu is the Kannada word for the open sky.", lang)}</p>

  <p class="ah">${icon("users")}<span>${t("For people", lang)}</span></p>
  <p class="atext">${t("Type a place. See what the sky is doing to you right now: air, heat (and how survivable it really is), rain, sun and dust, alongside any official warning over that spot. Then one plain line, the single worst thing for you, whether you have asthma, work outdoors, or are minding a child or an older parent. No sign-up, no jargon.", lang)}</p>

  <p class="ah" id="build">${icon("code")}<span>${t("Build on it", lang)}</span></p>
  <p class="atext">${t("mugilu is meant to be built on, not just looked at. Every reading is also open, machine-readable data, so you can put the whole sky behind your own map, story, dashboard or alert, and spend your time on the part that matters: the telling, and the action.", lang)}</p>
  <ul class="alist">
    <li>${icon("code")}<span class="t"><b>${t("For AI agents", lang)}</b>: ${t("connect Claude, Cursor or any MCP client to {mcp}; setup and the tools are on that page. Listed in {llms}.", lang).replace("{mcp}", `<a href="/mcp">/mcp</a>`).replace("{llms}", `<a href="/llms.txt">llms.txt</a>`)}</span></li>
    <li>${icon("layers")}<span class="t"><b>${t("For developers", lang)}</b>: ${t("a documented {openapi}, and every reading as {json} or {md}.", lang).replace("{openapi}", `<a href="/openapi.json">${aboutOpenapi}</a>`).replace("{json}", `<a href="/c/12.97,77.59.json">JSON</a>`).replace("{md}", `<a href="/c/12.97,77.59.md">Markdown</a>`)}</span></li>
    <li>${icon("pin")}<span class="t"><b>${t("Embed it", lang)}</b>: ${t("a live card in one line of HTML ({embed}), or a {png}.", lang).replace("{embed}", `<a href="/embed/12.97,77.59">/embed/{lat},{lon}</a>`).replace("{png}", `<a href="/c/12.97,77.59.png">${aboutSnapshot}</a>`)}</span></li>
    <li>${icon("sun")}<span class="t"><b>${t("Put it on a screen", lang)}</b>: ${t("a self-refreshing wall display or kiosk for a clinic, school or lobby, set up at {display}.", lang).replace("{display}", `<a href="/display">/display</a>`)}</span></li>
  </ul>
  <p class="abuild">${refPara}</p>

  <p class="ah">${icon("layers")}<span>${t("Where it comes from", lang)}</span></p>
  <p class="atext">${wherePara}</p>

  <p class="ah">${icon("heart")}<span>${t("Why it's free", lang)}</span></p>
  <p class="atext">${freePara}</p>

  <p class="ah">${icon("compass")}<span>${t("Common questions", lang)}</span></p>
  ${faqs.map((f) => `<p class="atext"><b>${t(f.q, lang)}</b><br>${t(f.a, lang)}</p>`).join("\n  ")}

  <div class="builtby">
    <a href="https://urbanmorph.com" aria-label="Urban Morph"><img src="${UM_ICON}" alt="Urban Morph" width="54" height="60"></a>
    <div>
      <p class="bb-by">${builtBy}</p>
      <a class="star" href="https://github.com/urbanmorph/mugilu">${GH_MARK} ${t("Source on GitHub, drop a star if it's useful", lang)}</a>
    </div>
  </div>

  <p class="adisc">${t("Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.", lang)}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>`;
  return shell(t("About mugilu: the open sky of India", lang), withToc(body, lang), ABOUT_CSS, {
    desc: t(
      `mugilu shows the ${HAZARDS} over any point in India right now, and names the single worst hazard for you. About the project, its open data sources, and how to build on it.`,
      lang,
    ),
    canonical: `${SITE}/about`,
    jsonLd: ld({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: t(f.q, lang),
        acceptedAnswer: { "@type": "Answer", text: t(f.a, lang) },
      })),
    }),
    ogImage: HOME_OG,
    lang,
    wide: true,
  });
}
