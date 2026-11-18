import { esc, trusted } from "../html";
import { RISK_BANDS, THRESHOLD_ROWS } from "../score";
import { lp, t, type Lang } from "../i18n";
import { cardGrid, cardStack, dataTable, LEVEL_SHAPE, LEVEL_WORD, pull, shape } from "../ui/components";
import { marked, P, splitAs, splitInto, textPage } from "./text";

// The live paragraphs, as keys. English renders its markup version; hi/kn their reviewed
// translation, split at sentence ends to fill the boxes (pages/text.ts).
const LEAD =
  "mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. It's a glass box: the thresholds below are public and come from CPCB, IMD, WHO, NASA, the Australian BoM and the AQLI. Informational only, never medical or safety advice.";
const ONE_KEY = `Each hazard is scored 0 to 3 (low, moderate, high, severe). We surface the worst one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`;
const ONE_EN = `Each hazard is scored 0–3 (low · moderate · high · severe). We surface the <b>worst</b> one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`;
const WHO_KEY = `Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). The read then says how that group should take it ("The air is moderate. For asthma & lungs, treat it as high."), and the readings that matter to that group are tagged "for you". When your trigger isn't the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle you choose: never inferred, never stored.`;
const WHO_EN = esc(WHO_KEY).replace("toggle you choose", "toggle <b>you</b> choose");
const NOTE_KEY =
  "Heat takes the worst of feels-like, wet-bulb and WBGT. The persona toggle then bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind), WHO (UV) and NASA FIRMS (smoke); the full logic is the open {score}, and every layer's source and licence is on {terms}.";
const NORMAL_KEY =
  "On days when it stands out, the heat layer compares today's modelled high with the normal high for that place and time of year, from 1991-2020 ERA5 reanalysis (Copernicus) via Open-Meteo. It shows only when the two are 3 °C or more apart. It is not a heatwave declaration, which only IMD makes.";

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
    (s) => P(s[0]) + levelStrip(lang) + cardGrid([P(s[1]), P(s[2])]) + pull(s[3]),
    (whole) => P(whole) + levelStrip(lang),
  );

  const whoBody = splitInto(WHO_EN, WHO_KEY, lang, 4, (s) => cardGrid([P(s[0]), P(s[1]), P(s[2])], 3) + pull(s[3]));

  // The note carries two links; word order differs across languages, so the slots are filled
  // after lookup.
  const scoreLink = `<a href="https://github.com/urbanmorph/mugilu/blob/main/apps/worker/src/score.ts">score.ts</a>`;
  const termsLink = `<a href="${lp("/terms", lang)}">${marked("terms & attribution", lang, "terms &amp; attribution")}</a>`;
  const fill = (s: string) => s.replace("{score}", scoreLink).replace("{terms}", termsLink);
  const noteBody = splitInto(
    NOTE_KEY,
    NOTE_KEY,
    lang,
    3,
    (s) => cardGrid([P(s[0]), P(s[1])], 2, true) + cardStack([P(fill(s[2]))], { quiet: true }),
    (whole) => P(fill(whole)),
  );

  const normalBody = splitInto(NORMAL_KEY, NORMAL_KEY, lang, 3, (s) => P(s[0]) + cardGrid([P(s[1]), P(s[2])]));

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
      "How mugilu's Ambient read is computed: the public, auditable thresholds for air, heat, cold, wind, fog, smoke, UV and dust, and how the persona weighting works.",
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
    ],
  });
}
