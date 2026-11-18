import { lp, t, type Lang } from "../i18n";
import { HOME_OG, SITE, shell, withToc } from "../ui/shell";
import { icon } from "./read";
import { ABOUT_CSS } from "./about";

/** Terms & attribution: the disclaimer in full, plus per-source credit/licence.
 *  The disclaimer that ships in every API response points here. */
export function renderTerms(lang: Lang = "en"): string {
  // Prose: English keeps its inline markup; hi/kn render the translated text (proper
  // nouns/acronyms + source names Latin, source-detail lines kept English like /about's
  // list). Paragraphs with inline links keep {slot}s filled after lookup, word-order-safe.
  const warranty =
    lang === "en"
      ? `<b>Informational and educational only, not for medical, emergency, or safety-critical decisions.</b> Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult <b>NDMA</b> and <b>IMD</b> directly.`
      : t(
          "Informational and educational only, not for medical, emergency, or safety-critical decisions. Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult NDMA and IMD directly.",
          lang,
        );
  const repoText = lang === "en" ? "repository" : t("repository", lang);
  const repoLink = `<a href="https://github.com/urbanmorph/mugilu">${repoText}</a>`;
  const licence =
    lang === "en"
      ? `The mugilu <b>code is MIT</b> (see the ${repoLink}). The <b>data is not relicensed</b>: each upstream source keeps its own licence and attribution. mugilu is <b>non-commercial, for individuals</b>, and is not affiliated with any data provider.`
      : t(
          "The mugilu code is MIT (see the {repo}). The data is not relicensed: each upstream source keeps its own licence and attribution. mugilu is non-commercial, for individuals, and is not affiliated with any data provider.",
          lang,
        ).replace("{repo}", repoLink);
  const privacy =
    lang === "en"
      ? `No accounts, no sign-up, no ad networks. Usage counts are first-party and aggregate (rounded coordinates, no IP, no per-person data). For visitor numbers and page performance, mugilu uses <b>Cloudflare Web Analytics</b>, which is cookieless, collects no personal data, and does no cross-site tracking or fingerprinting. Your saved places live only in your own browser.`
      : t(
          "No accounts, no sign-up, no ad networks. Usage counts are first-party and aggregate (rounded coordinates, no IP, no per-person data). For visitor numbers and page performance, mugilu uses Cloudflare Web Analytics, which is cookieless, collects no personal data, and does no cross-site tracking or fingerprinting. Your saved places live only in your own browser.",
          lang,
        );
  const commonsDisc = t("A digital commons by {um}, alongside {bl} and {md}.", lang)
    .replace("{um}", `<a href="https://urbanmorph.com">urbanmorph</a>`)
    .replace("{bl}", `<a href="https://bharatlas.com">bharatlas</a>`)
    .replace("{md}", `<a href="https://mdshare.live">mdshare</a>`);
  const body = `
  <h1 class="ahero">${t("Terms &amp; attribution", lang)}</h1>
  <p class="alead">${t("mugilu stitches together others' open data for any point in India. The stitch and the code are ours; the data is theirs, and stays under their terms.", lang)}</p>

  <h2 class="ah">${t("No warranty", lang)}</h2>
  <p class="amuted">${warranty}</p>

  <h2 class="ah">${t("Licence", lang)}</h2>
  <p class="alead2">${licence}</p>

  <h2 class="ah">${t("Sources &amp; credit", lang)}</h2>
  <ul class="alist on">
    <li>${icon("air")}<span class="t"><b>${t("Air", lang)}</b>: ${t("CPCB (Govt. of India), Airnet (CSTEP), Aurassure, and Google AirView+, via the {oaq} broker.", lang).replace("{oaq}", `<a href="https://oaq.notf.in">OAQ</a>`)}</span></li>
    <li>${icon("heat")}<span class="t"><b>${t("Modelled air, heat, rain, UV, dust, wind", lang)}</b>: ${t("{ometeo}, licensed CC-BY 4.0.", lang).replace("{ometeo}", `<a href="https://open-meteo.com">Open-Meteo</a>`)}</span></li>
    <li>${icon("heat")}<span class="t"><b>${t("Heat compared with normal", lang)}</b>: ${t("1991-2020 normals from {era5} reanalysis (Copernicus Climate Change Service), via Open-Meteo.", lang).replace("{era5}", `<a href="https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels">ERA5</a>`)}</span></li>
    <li>${icon("warn")}<span class="t"><b>${t("Official warnings", lang)}</b>: ${t("NDMA / IMD via SACHET.", lang)}</span></li>
    <li>${icon("smoke")}<span class="t"><b>${t("Fire / crop-burn smoke", lang)}</b>: NASA FIRMS (VIIRS).</span></li>
    <li>${icon("wind")}<span class="t"><b>${t("Cyclone tracks", lang)}</b>: <a href="https://www.metoc.navy.mil/jtwc/jtwc.html">JTWC</a> (US Navy and Air Force).</span></li>
    <li>${icon("pin")}<span class="t"><b>${t("Geography &amp; place names", lang)}</b>: ${t("place search from {osm} contributors (ODbL) and {geonames} (CC-BY 4.0); admin boundaries from {bharatlas}.", lang).replace("{osm}", `<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`).replace("{geonames}", `<a href="https://www.geonames.org">GeoNames</a>`).replace("{bharatlas}", `<a href="https://bharatlas.com">bharatlas</a>`)}</span></li>
    <li>${icon("heart")}<span class="t"><b>${t("Health impact", lang)}</b>: ${t("years of life lost uses the {aqli} methodology (U Chicago EPIC).", lang).replace("{aqli}", `<a href="https://aqli.epic.uchicago.edu">AQLI</a>`)}</span></li>
  </ul>
  <p class="alead2">${t("Each reading carries its own attribution line inline, so credit travels with the data wherever it goes.", lang)}</p>

  <h2 class="ah">${t("Privacy", lang)}</h2>
  <p class="amuted">${privacy} ${t("If you turn on alerts for a place, mugilu keeps that place (to about 1 km) and your browser's push address, only to send you official warnings for it, and deletes them when you turn alerts off.", lang)}</p>

  <p class="adisc">${commonsDisc}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>`;
  return shell(t("mugilu: terms, sources and attribution", lang), withToc(body, lang), ABOUT_CSS, {
    desc: t(
      "mugilu's sources, licences and attribution: open data from CPCB, Open-Meteo, NDMA/IMD and NASA FIRMS, each keeping its own terms. Informational only, not for safety-critical use.",
      lang,
    ),
    canonical: `${SITE}/terms`,
    ogImage: HOME_OG,
    lang,
    wide: true,
  });
}
