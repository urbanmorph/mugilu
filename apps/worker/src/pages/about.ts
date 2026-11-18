import { SOURCES } from "../sources";
import { esc } from "../html";
import { t, type Lang } from "../i18n";
import { HAZARDS } from "../hazards";
import { ld, UM_ICON } from "../ui/shell";
import { cardBody, cards, faq, pull } from "../ui/components";
import { P, lineBreakAfterComma, marked, splitInto, textPage } from "./text";

// The hand-written source credits on /about (its FAQ and "where it comes from"): translated
// prose, so not built from sources.ts SOURCES, but a test fails if either leaves one out.
export const SOURCES_FAQ =
  "Air from CPCB, Airnet (CSTEP), Aurassure and Google AirView+ via the Open Air Quality (OAQ) broker; weather, heat, UV and dust from Open-Meteo, and the 1991-2020 heat normals from ERA5 reanalysis (Copernicus) via Open-Meteo; official warnings from NDMA and IMD via SACHET; fire smoke from NASA FIRMS; cyclone tracks from JTWC; place search from OpenStreetMap and GeoNames, and boundaries from bharatlas; years of life lost from the AQLI method. Each source keeps its own licence, and mugilu credits all of them.";
export const SOURCES_ABOUT =
  "mugilu owns no sensors and runs no forecasts. It stands on others' work and credits them: CPCB, Airnet, Aurassure and Google AirView+ (via the OAQ broker) for air, Open-Meteo for weather, ERA5 reanalysis (Copernicus) for the heat normals, NDMA and IMD (via SACHET) for warnings, NASA FIRMS for fire smoke, JTWC for cyclone tracks, OpenStreetMap, GeoNames and bharatlas for places and the map of India, and the AQLI method for years of life lost. The code is open under the MIT licence; the data keeps each source's own terms.";

/** English prose with each source name from SOURCES in bold. */
export const boldSourceNames = (text: string) =>
  SOURCES.flatMap((s) => s.names).reduce((out, n) => out.split(n).join(`<b>${n}</b>`), esc(text));

// Q&A that ALSO ships as FAQPage structured data: the visible list and the schema are one list.
const FAQS = [
  {
    q: "Is it safe to go outside right now?",
    a: "mugilu names the single worst hazard over your exact location and says plainly what to do, weighted for who you are: asthma, older adults, children, outdoor workers, or a heart condition. It is informational, not medical or safety advice; for official warnings, consult NDMA and IMD.",
  },
  {
    q: "What is wet-bulb temperature, and why does mugilu show it?",
    a: "Wet-bulb is the temperature a wet thermometer settles at: it folds heat and humidity into the one number that decides whether your body can still cool itself. Above about 32°C wet-bulb, even resting in shade turns dangerous. Ordinary feels-like numbers hide this, so mugilu surfaces it.",
  },
  { q: "Where does mugilu's data come from?", a: SOURCES_FAQ },
  {
    q: "Is mugilu free?",
    a: "Yes. It is free, open source (MIT) and non-commercial, with no sign-up. Every reading is also available as JSON, Markdown, an embeddable card, an OpenAPI spec, and an MCP server for AI agents.",
  },
  {
    q: "How current are the readings?",
    a: "Air refreshes hourly, the national heat, rain, UV and dust grid every few hours, and official warnings hourly. Every reading is timestamped with how long ago it was measured.",
  },
];

const FOR_PEOPLE =
  "Type a place. See what the sky is doing to you right now: air, heat (and how survivable it really is), rain, sun and dust, alongside any official warning over that spot. Then one plain line, the single worst thing for you, whether you have asthma, work outdoors, or are minding a child or an older parent. No sign-up, no jargon.";
const FREE =
  "The sky over you is a commons. Knowing it shouldn't cost money or sit locked inside someone's app. mugilu is non-commercial, for good, the third in a small set of public tools alongside bharatlas and mdshare.";
const SATHYA =
  "Sathya Sankaran wanted to stop starting from scratch each time: to pull the whole sky together into one view, every hazard over any point in India, and then hand that out as infrastructure, so the next map, story or alert doesn't have to begin from nothing.";
const REF =
  "Add ?ref=your-app to any API or embed URL to identify your app (aggregate, domain-level). It's all free and keyless.";

/** The About page: the origin story and the two sides (for people, and as infrastructure). */
export function renderAbout(lang: Lang = "en"): string {
  const sathya = marked(
    SATHYA,
    lang,
    SATHYA.replace("Sathya Sankaran", `<a href="https://www.sathyasankaran.com">Sathya Sankaran</a>`),
  );

  // For people: one paragraph over three boxes (two sentences, the line in a pull quote, the close).
  const peopleBody = splitInto(FOR_PEOPLE, FOR_PEOPLE, lang, 4, (s) => P(`${s[0]} ${s[1]}`) + pull(s[2]) + P(s[3]));

  // Where it comes from: the first sentence as a pull quote, the credits in a box, the licence.
  const whereBody = splitInto(
    boldSourceNames(SOURCES_ABOUT),
    SOURCES_ABOUT,
    lang,
    3,
    (s) => pull(s[0]) + cards([P(s[1])]) + P(s[2]),
  );

  const freeEn = FREE.replace("non-commercial, for good", "<b>non-commercial, for good</b>")
    .replace("bharatlas", `<a href="https://bharatlas.com">bharatlas</a>`)
    .replace("mdshare", `<a href="https://mdshare.live">mdshare</a>`);
  const freeBody = splitInto(freeEn, FREE, lang, 3, (s) => pull(s[0]) + P(`${s[1]} ${s[2]}`));

  const ref = marked(REF, lang, REF.replace("?ref=your-app", "<b>?ref=your-app</b>"));
  const openapi = t("OpenAPI spec", lang);
  const snapshot = t("snapshot image", lang);
  const build = cards(
    [
      cardBody(
        t("For AI agents", lang),
        P(
          t(
            "connect Claude, Cursor or any MCP client to {mcp}; setup and the tools are on that page. Listed in {llms}.",
            lang,
          )
            .replace("{mcp}", `<a href="/mcp">/mcp</a>`)
            .replace("{llms}", `<a href="/llms.txt">llms.txt</a>`),
        ),
        "ai",
      ),
      cardBody(
        t("For developers", lang),
        P(
          t("a documented {openapi}, and every reading as {json} or {md}.", lang)
            .replace("{openapi}", `<a href="/openapi.json">${openapi}</a>`)
            .replace("{json}", `<a href="/c/12.97,77.59.json">JSON</a>`)
            .replace("{md}", `<a href="/c/12.97,77.59.md">Markdown</a>`),
        ),
        "code",
      ),
      cardBody(
        t("Embed it", lang),
        P(
          t("a live card in one line of HTML ({embed}), or a {png}.", lang)
            .replace("{embed}", `<a href="/embed/12.97,77.59"><code>/embed/{lat},{lon}</code></a>`)
            .replace("{png}", `<a href="/c/12.97,77.59.png">${snapshot}</a>`),
        ),
        "embed",
      ),
      cardBody(
        t("Put it on a screen", lang),
        P(
          t(
            "a self-refreshing wall display or kiosk for a clinic, school or lobby, set up at {display}.",
            lang,
          ).replace("{display}", `<a href="/display">/display</a>`),
        ),
        "screen",
      ),
    ],
    { cols: 2 },
  );

  const builtBy = marked(
    "Built by urbanmorph, led by Sathya Sankaran.",
    lang,
    `Built by <a href="https://urbanmorph.com">urbanmorph</a>, led by <a href="https://www.sathyasankaran.com">Sathya Sankaran</a>.`,
  );
  const credit =
    `<div class="credit"><img src="${UM_ICON}" alt="Urban Morph" width="54" height="60"><div>${P(builtBy)}` +
    `<p class="links"><a href="https://github.com/urbanmorph/mugilu">${t("Source on GitHub, drop a star if it's useful", lang)}</a></p></div></div>`;

  return textPage({
    path: "/about",
    lang,
    title: t("About mugilu: the open sky of India", lang),
    desc: t(
      `mugilu shows the ${HAZARDS} over any point in India right now, and names the single worst hazard for you. About the project, its open data sources, and how to build on it.`,
      lang,
    ),
    jsonLd: ld({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: t(f.q, lang),
        acceptedAnswer: { "@type": "Answer", text: t(f.a, lang) },
      })),
    }),
    kicker: t("About", lang),
    h1: lineBreakAfterComma(t("The open sky of India, one coordinate at a time.", lang)),
    lead: t("A whole-sky view for people, and shared infrastructure for anyone building on top of it.", lang),
    sections: [
      {
        id: "why",
        title: t("Why mugilu", lang),
        icon: "cloud",
        body:
          P(
            t(
              "For years, people across India have made the sky legible one piece at a time: a map of one city's air, a thread about a heatwave, a chart of last year's monsoon. Brilliant work, but scattered, and easy to lose by the next season.",
              lang,
            ),
          ) +
          P(sathya) +
          pull(t("That is mugilu.", lang)) +
          cards(
            [
              `<p class="t-lead"><span lang="kn">ಮುಗಿಲು</span></p>${P(t("mugilu is the Kannada word for the open sky.", lang))}`,
            ],
            { cols: 2, quiet: true },
          ),
      },
      { id: "people", title: t("For people", lang), icon: "people", body: peopleBody },
      {
        id: "build",
        title: t("Build on it", lang),
        icon: "code",
        body:
          P(
            t(
              "mugilu is meant to be built on, not just looked at. Every reading is also open, machine-readable data, so you can put the whole sky behind your own map, story, dashboard or alert, and spend your time on the part that matters: the telling, and the action.",
              lang,
            ),
          ) +
          build +
          P(ref),
      },
      { id: "sources", title: t("Where it comes from", lang), icon: "stack", body: whereBody },
      { id: "free", title: t("Why it's free", lang), icon: "commons", body: freeBody },
      {
        id: "faq",
        title: t("Common questions", lang),
        icon: "question",
        body: faq(FAQS.map((f) => [t(f.q, lang), t(f.a, lang)])) + credit,
      },
    ],
  });
}
