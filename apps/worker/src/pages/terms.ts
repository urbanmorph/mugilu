import { t, type Lang } from "../i18n";
import { cardBody, cardGrid, pairs, pull, warnBox } from "../ui/components";
import { P, plain, splitAs, textPage } from "./text";

// The live paragraphs, as keys (pages/text.ts splits them at sentence ends to fill the boxes).
const WARRANTY =
  "Informational and educational only, not for medical, emergency, or safety-critical decisions. Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult NDMA and IMD directly.";
const LICENCE =
  "The mugilu code is MIT (see the {repo}). The data is not relicensed: each upstream source keeps its own licence and attribution. mugilu is non-commercial, for individuals, and is not affiliated with any data provider.";
const PRIVACY =
  "No accounts, no sign-up, no ad networks. Usage counts are first-party and aggregate (rounded coordinates, no IP, no per-person data). For visitor numbers and page performance, mugilu uses Cloudflare Web Analytics, which is cookieless, collects no personal data, and does no cross-site tracking or fingerprinting. Your saved places live only in your own browser.";
const ALERTS =
  "If you turn on alerts for a place, mugilu keeps that place (to about 1 km) and your browser's push address, only to send you official warnings for it, and deletes them when you turn alerts off.";

const a = (href: string, text: string) => `<a href="${href}">${text}</a>`;

/** Terms & attribution: the disclaimer in full, plus per-source credit and licence.
 *  The disclaimer that ships in every API response points here. */
export function renderTerms(lang: Lang = "en"): string {
  const en = lang === "en";

  // Split before marking up: the bold first sentence would hide its full stop.
  const w = splitAs(WARRANTY.replace("NDMA", "<b>NDMA</b>").replace("IMD", "<b>IMD</b>"), WARRANTY, lang, 4);
  const warranty = w
    ? warnBox(en ? `<b>${w[0]}</b>` : w[0], [`${w[1]} ${w[2]}`, w[3]])
    : warnBox(t(WARRANTY, lang), []);

  const repo = a("https://github.com/urbanmorph/mugilu", en ? "repository" : t("repository", lang));
  const licenceEn = LICENCE.replace("code is MIT", "<b>code is MIT</b>")
    .replace("data is not relicensed", "<b>data is not relicensed</b>")
    .replace("non-commercial, for individuals", "<b>non-commercial, for individuals</b>");
  const l = splitAs(licenceEn, LICENCE, lang, 3)?.map((s) => s.replace("{repo}", repo));
  const licence = l ? cardGrid([P(l[0]), P(l[1])]) + P(l[2]) : P(t(LICENCE, lang).replace("{repo}", repo));

  const sources: [string, string][] = [
    [
      "Air",
      t("CPCB (Govt. of India), Airnet (CSTEP), Aurassure, and Google AirView+, via the {oaq} broker.", lang).replace(
        "{oaq}",
        a("https://oaq.notf.in", "OAQ"),
      ),
    ],
    [
      "Modelled air, heat, rain, UV, dust, wind",
      t("{ometeo}, licensed CC-BY 4.0.", lang).replace("{ometeo}", a("https://open-meteo.com", "Open-Meteo")),
    ],
    [
      "Heat compared with normal",
      t("1991-2020 normals from {era5} reanalysis (Copernicus Climate Change Service), via Open-Meteo.", lang).replace(
        "{era5}",
        a("https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels", "ERA5"),
      ),
    ],
    ["Official warnings", t("NDMA / IMD via SACHET.", lang)],
    ["Fire / crop-burn smoke", "NASA FIRMS (VIIRS)."],
    ["Cyclone tracks", `${a("https://www.metoc.navy.mil/jtwc/jtwc.html", "JTWC")} (US Navy and Air Force).`],
    [
      "Geography &amp; place names",
      t(
        "place search from {osm} contributors (ODbL) and {geonames} (CC-BY 4.0); admin boundaries from {bharatlas}.",
        lang,
      )
        .replace("{osm}", a("https://www.openstreetmap.org/copyright", "OpenStreetMap"))
        .replace("{geonames}", a("https://www.geonames.org", "GeoNames"))
        .replace("{bharatlas}", a("https://bharatlas.com", "bharatlas")),
    ],
    [
      "Health impact",
      t("years of life lost uses the {aqli} methodology (U Chicago EPIC).", lang).replace(
        "{aqli}",
        a("https://aqli.epic.uchicago.edu", "AQLI"),
      ),
    ],
  ];

  const privacyEn = PRIVACY.replace("Cloudflare Web Analytics", "<b>Cloudflare Web Analytics</b>");
  const p = splitAs(privacyEn, PRIVACY, lang, 4);
  const alerts = t(ALERTS, lang);
  const privacy = p
    ? pairs([
        [t("Accounts", lang), p[0]],
        [t("Usage counts", lang), p[1]],
        [t("Analytics", lang), p[2]],
        [t("Saved places", lang), p[3]],
        [t("Alerts", lang), alerts],
      ])
    : P(`${t(PRIVACY, lang)} ${alerts}`);
  const commons = t("A digital commons by {um}, alongside {bl} and {md}.", lang)
    .replace("{um}", a("https://urbanmorph.com", "urbanmorph"))
    .replace("{bl}", a("https://bharatlas.com", "bharatlas"))
    .replace("{md}", a("https://mdshare.live", "mdshare"));

  return textPage({
    path: "/terms",
    lang,
    title: t("mugilu: terms, sources and attribution", lang),
    desc: t(
      "mugilu's sources, licences and attribution: open data from CPCB, Open-Meteo, NDMA/IMD and NASA FIRMS, each keeping its own terms. Informational only, not for safety-critical use.",
      lang,
    ),
    kicker: t("terms", lang),
    h1: plain(t("Terms &amp; attribution", lang)),
    lead: t(
      "mugilu stitches together others' open data for any point in India. The stitch and the code are ours; the data is theirs, and stays under their terms.",
      lang,
    ),
    sections: [
      { id: "warranty", title: t("No warranty", lang), icon: "warn", body: warranty },
      { id: "licence", title: t("Licence", lang), icon: "doc", body: licence },
      {
        id: "sources",
        title: plain(t("Sources &amp; credit", lang)),
        icon: "stack",
        body:
          cardGrid(sources.map(([k, v]) => cardBody(plain(t(k, lang)), P(v)))) +
          pull(
            t(
              "Each reading carries its own attribution line inline, so credit travels with the data wherever it goes.",
              lang,
            ),
          ),
      },
      { id: "privacy", title: t("Privacy", lang), icon: "lock", body: privacy + P(commons) },
    ],
  });
}
