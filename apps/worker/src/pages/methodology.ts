import { esc, trusted } from "../html";
import { RISK_BANDS, THRESHOLD_ROWS } from "../score";
import { lp, put, t, type Lang } from "../i18n";
import { cards, dataTable, LEVEL_SHAPE, LEVEL_WORD, levelChip, pull, shape } from "../ui/components";
import { SQUARES_NOTE } from "../ui/map";
import { SEVERITY_BAND } from "../warnareas";
import { marked, P, splitAs, splitInto, textPage } from "./text";

// The live paragraphs, as keys. English renders its markup version; hi/kn their reviewed
// translation, split at sentence ends to fill the boxes (pages/text.ts).
const LEAD =
  "mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. It's a glass box: the thresholds below are public and come from CPCB, IMD, WHO and the Australian BoM. Informational only, never medical or safety advice.";
const ONE_KEY = `Each hazard is scored 0 to 3 (low, moderate, high, severe). We surface the worst one, named in plain words ("Severe air", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`;
const ONE_EN = `Each hazard is scored 0–3 (low · moderate · high · severe). We surface the <b>worst</b> one, named in plain words ("Severe air", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`;
const WHO_KEY = `Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). The read then says how that group should take it ("The air is moderate. For asthma & lungs, treat it as high."), and the readings that matter to that group are tagged "for you". When your trigger isn't the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle you choose: never inferred, never stored.`;
const WHO_EN = esc(WHO_KEY).replace("toggle you choose", "toggle <b>you</b> choose");
const NOTE_KEY =
  "Heat takes the worst of feels-like, wet-bulb and WBGT, and the persona toggle bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind) and WHO (UV); fires seen by satellite are shown for context and never scored, because the air reading carries any smoke that reaches you. The full logic is the open {score}, and every layer's source and licence is on {terms}.";
const NORMAL_KEY =
  "On days when it stands out, the heat layer compares today's modelled high with the normal high for that place and time of year, from 1991-2020 ERA5 reanalysis (Copernicus) via Open-Meteo. It shows only when the two are 3 °C or more apart. It is not a heatwave declaration, which only IMD makes.";

const MAP_KEY =
  "The map of India on the home page uses the same four levels. When official warnings are in force, it opens on them: each warned area takes its level from the severity IMD or NDMA gives in the alert. Where warnings overlap, the higher level is on top. Otherwise it opens on what is worst.";

/** The map's rules: the warning levels as a table built from the mapping the map itself uses. */
function mapBody(lang: Lang): string {
  // The alert's own word (CAP's English code), after its meaning on the hi and kn pages.
  const word = (sev: string) => {
    const code = sev[0].toUpperCase() + sev.slice(1);
    return lang === "en" ? code : `${t(code, lang)} (${code})`;
  };
  const rows = [
    ...Object.entries(SEVERITY_BAND).map(([sev, band]) => [esc(word(sev)), levelChip(band, lang)]),
    [esc(t("Any other", lang)), levelChip("moderate", lang)],
  ];
  const cols = [{ label: t("Severity in the alert", lang) }, { label: t("Level on the map", lang) }];
  return (
    P(esc(t(MAP_KEY, lang))) +
    dataTable(cols, rows, cols.map((c) => c.label).join(", ")) +
    P(esc(t(SQUARES_NOTE, lang)))
  );
}

/** The level strip: 0-3 as their fills, shapes and words (the sentence above names them). */
const levelStrip = (lang: Lang) =>
  `<div class="levels" aria-hidden="true">${RISK_BANDS.map(
    (k, i) =>
      `<div class="fill ${k}"><span class="n">${i}</span>${shape(LEVEL_SHAPE[k])}${esc(t(LEVEL_WORD[k], lang))}</div>`,
  ).join("")}</div>`;

/** Glass-box methodology: how the Ambient read is computed, with the public thresholds. */
export function renderMethodology(lang: Lang = "en"): string {
  const lead = splitAs(LEAD, LEAD, lang, 3);

  const oneBody = splitInto(
    ONE_EN,
    ONE_KEY,
    lang,
    4,
    (s) => P(s[0]) + levelStrip(lang) + cards([P(s[1]), P(s[2])], { cols: 2 }) + pull(s[3]),
    (whole) => P(whole) + levelStrip(lang),
  );

  const whoBody = splitInto(
    WHO_EN,
    WHO_KEY,
    lang,
    4,
    (s) => cards([P(s[0]), P(s[1]), P(s[2])], { cols: 3 }) + pull(s[3]),
  );

  // The note carries two links; word order differs across languages, so the slots are filled
  // after lookup.
  const scoreLink = `<a href="https://github.com/urbanmorph/mugilu/blob/main/apps/worker/src/score.ts">score.ts</a>`;
  const termsLink = `<a href="${lp("/terms", lang)}">${marked("terms & attribution", lang, "terms &amp; attribution")}</a>`;
  const withLinks = (s: string) => put(s, { score: scoreLink, terms: termsLink });
  const noteBody = splitInto(
    NOTE_KEY,
    NOTE_KEY,
    lang,
    3,
    (s) => cards([P(s[0]), P(s[1])], { cols: 2, quiet: true }) + cards([P(withLinks(s[2]))], { quiet: true }),
    (whole) => P(withLinks(whole)),
  );

  const normalBody = splitInto(
    NORMAL_KEY,
    NORMAL_KEY,
    lang,
    3,
    (s) => P(s[0]) + cards([P(s[1]), P(s[2])], { cols: 2 }),
  );

  // The table's name differs from its section's ("The thresholds"): two landmarks never share one.
  const hazard = t("Hazard", lang);
  // Each level column is headed by its shape and word on its level's fill, as on every chip.
  const levels = RISK_BANDS.slice(1);
  const words = levels.map((k) => t(LEVEL_WORD[k], lang));
  const heads = levels.map((k, i) => ({ label: trusted(shape(LEVEL_SHAPE[k]) + esc(words[i])), cls: `fill ${k}` }));
  const table = dataTable(
    [{ label: hazard }, ...heads],
    THRESHOLD_ROWS.map((r) => [esc(t(r.hazard, lang)), ...r.cells.map(esc)]),
    `${hazard}: ${words.join(", ")}`,
  );

  return textPage({
    path: "/methodology",
    lang,
    title: t("How mugilu works: the Ambient read explained", lang),
    desc: t(
      "How mugilu's Ambient read is computed: the public, auditable thresholds for air, heat, cold, wind, fog, UV and dust, and how the persona weighting works.",
      lang,
    ),
    kicker: t("How it works", lang),
    h1: t("How the Ambient read works", lang),
    lead: lead ? lead[0] : t(LEAD, lang),
    lead2: lead ? `${lead[1]} ${lead[2]}` : undefined,
    sections: [
      { id: "one", title: t("One read, never an average", lang), icon: "target", body: oneBody },
      { id: "who", title: t("For who you are", lang), icon: "person", body: whoBody },
      { id: "thresholds", title: t("The thresholds", lang), icon: "ruler", body: table + noteBody },
      { id: "normal", title: t("Today against normal", lang), icon: "heat", body: normalBody },
      { id: "map", title: t("The map", lang), icon: "warn", body: mapBody(lang) },
    ],
  });
}
