import { t, type Lang } from "../i18n";
import { cardBody, cards, pairs, pull, warnBox } from "../ui/components";
import { P, plain, splitInto, textPage } from "./text";
import { contactLink } from "../contact";

// The live paragraphs, as keys (pages/text.ts splits them at sentence ends to fill the boxes).
const WARRANTY =
  "Informational and educational only, not for medical, emergency, or safety-critical decisions. Readings are a mix of measured and modelled values and may be wrong, stale, or missing. There is no accuracy or availability guarantee. For official hazard warnings, consult NDMA and IMD directly.";
const LICENCE =
  "The mugilu code is MIT (see the {repo}). The data is not relicensed: each upstream source keeps its own licence and attribution. mugilu is non-commercial, for individuals, and is not affiliated with any data provider.";
const PRIVACY =
  "No accounts, no sign-up, no ad networks. Usage counts are first-party and aggregate (rounded coordinates, no IP, no per-person data). For visitor numbers and page performance, mugilu uses Cloudflare Web Analytics, which is cookieless, collects no personal data, and does no cross-site tracking or fingerprinting. Your saved places live only in your own browser.";
const RETENTION = "Usage counts are kept as totals. The detailed events are deleted after 3 months.";
const ANY_AGE = "mugilu has no accounts and asks for no personal data, so people of any age can use it safely.";
const DELETE =
  "To delete your alert data, turn the alert off. To delete your saved places, clear them in your browser. For any other privacy question, contact us: {contact}.";
const OWNER = "mugilu is co-owned by Sathya Sankaran and Urban Morph.";
const LAWS =
  "mugilu is built to follow India's Information Technology Act, 2000 and Digital Personal Data Protection Act, 2023: it keeps no personal data except the opt-in alert address above. For the Rights of Persons with Disabilities Act, 2016, the pages aim for WCAG 2.1 AA.";
const CONTENT =
  "mugilu has no user posts, comments or uploads. It shows official warnings as their issuers wrote them, and readings from the sources above.";
const REPORT =
  "To report wrong, harmful or illegal content, contact us: {contact}. We answer within 7 days, and we remove at once anything that breaks the law.";
const ALERTS =
  "If you turn on alerts for a place, mugilu keeps that place (to about 1 km) and your browser's push address, only to send you official warnings for it, and deletes them when you turn alerts off.";

const a = (href: string, text: string) => `<a href="${href}">${text}</a>`;

/** Terms & attribution: the disclaimer in full, plus per-source credit and licence.
 *  The disclaimer that ships in every API response points here. */
export function renderTerms(lang: Lang = "en"): string {
  const en = lang === "en";

  // Split before marking up: the bold first sentence would hide its full stop.
  const warranty = splitInto(
    WARRANTY.replace("NDMA", "<b>NDMA</b>").replace("IMD", "<b>IMD</b>"),
    WARRANTY,
    lang,
    4,
    (w) => warnBox(en ? `<b>${w[0]}</b>` : w[0], [`${w[1]} ${w[2]}`, w[3]]),
    (whole) => warnBox(whole, []),
  );

  const repo = a("https://github.com/urbanmorph/mugilu", t("repository", lang));
  const licenceEn = LICENCE.replace("code is MIT", "<b>code is MIT</b>")
    .replace("data is not relicensed", "<b>data is not relicensed</b>")
    .replace("non-commercial, for individuals", "<b>non-commercial, for individuals</b>");
  const licence = splitInto(
    licenceEn,
    LICENCE,
    lang,
    3,
    (l) => cards([P(l[0]), P(l[1])], { cols: 2 }) + P(l[2]),
  ).replace("{repo}", repo);

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
    [
      "Cyclone tracks",
      t("{jtwc} (US Navy and Air Force).", lang).replace(
        "{jtwc}",
        a("https://www.metoc.navy.mil/jtwc/jtwc.html", "JTWC"),
      ),
    ],
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
  const alerts = t(ALERTS, lang);
  const privacy = splitInto(
    privacyEn,
    PRIVACY,
    lang,
    4,
    (p) =>
      pairs([
        [t("Accounts", lang), p[0]],
        [t("Usage counts", lang), p[1]],
        [t("Analytics", lang), p[2]],
        [t("Saved places", lang), p[3]],
        [t("Alerts", lang), alerts],
      ]),
    (whole) => P(`${whole} ${alerts}`),
  );
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
          cards(
            sources.map(([k, v]) => cardBody(plain(t(k, lang)), P(v))),
            { cols: 2 },
          ) +
          pull(
            t(
              "Each reading carries its own attribution line inline, so credit travels with the data wherever it goes.",
              lang,
            ),
          ),
      },
      {
        id: "privacy",
        title: t("Privacy", lang),
        icon: "lock",
        body:
          privacy +
          pairs([
            [t("Retention", lang), t(RETENTION, lang)],
            [t("Any age", lang), t(ANY_AGE, lang)],
            [t("Your choices", lang), t(DELETE, lang).replace("{contact}", contactLink())],
          ]) +
          P(t(LAWS, lang)) +
          P(commons),
      },
      { id: "owner", title: t("Owner", lang), icon: "doc", body: P(t(OWNER, lang)) },
      {
        id: "content",
        title: t("Content and reports", lang),
        icon: "warn",
        body: P(t(CONTENT, lang)) + P(t(REPORT, lang).replace("{contact}", contactLink())),
      },
    ],
  });
}
