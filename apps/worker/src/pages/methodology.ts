import { esc } from "../html";
import { THRESHOLD_ROWS } from "../score";
import { lp, t, type Lang } from "../i18n";
import { HOME_OG, SITE, shell, withToc } from "../ui/shell";
import { ABOUT_CSS } from "./about";

export const METHOD_CSS = `
.mtab-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:.6rem 0 1.2rem;border:1px solid var(--hair);border-radius:8px}
.mtab{width:100%;border-collapse:collapse;font-size:.9rem}
.mtab th,.mtab td{text-align:left;padding:.5rem .65rem;border-bottom:1px solid var(--hair);vertical-align:top}
.mtab tr:last-child td{border-bottom:0}
.mtab th{font:600 .74rem var(--sans);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.mtab td:first-child{font-weight:600}
`;

export function renderMethodology(lang: Lang = "en"): string {
  const row = (...cells: string[]) => `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
  // Prose: English keeps its inline markup; hi/kn render the reviewed translated text
  // (proper nouns + acronyms Latin). Precomputed to avoid nested template literals.
  const onePara =
    lang === "en"
      ? `Each hazard is scored 0–3 (low · moderate · high · severe). We surface the <b>worst</b> one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`
      : t(
          `Each hazard is scored 0 to 3 (low, moderate, high, severe). We surface the worst one, named in plain words ("Severe smoke", "High heat"), with one sentence on what to do. The other readings follow in order of risk. Averaging would hide the thing that matters, so we never average.`,
          lang,
        );
  const whoPara =
    lang === "en"
      ? `Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). The read then says how that group should take it ("The air is moderate. For asthma &amp; lungs, treat it as high."), and the readings that matter to that group are tagged "for you". When your trigger isn't the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle <b>you</b> choose: never inferred, never stored.`
      : t(
          `Pick a vulnerability (asthma, older adults, children, outdoor workers, heart) and the hazards that group feels more keenly are bumped up one level (so an asthmatic sees moderate air as "high"). The read then says how that group should take it ("The air is moderate. For asthma & lungs, treat it as high."), and the readings that matter to that group are tagged "for you". When your trigger isn't the headline but is still elevated, a second line surfaces it ("also watch: air is high"). The persona is a toggle you choose: never inferred, never stored.`,
          lang,
        );
  // The thresholds note carries two inline links; word order differs across languages,
  // so the translated string keeps {score}/{terms} slots we fill after lookup.
  const scoreLink = `<a href="https://github.com/urbanmorph/mugilu/blob/main/apps/worker/src/score.ts">score.ts</a>`;
  const termsText = lang === "en" ? "terms &amp; attribution" : t("terms & attribution", lang);
  const termsLink = `<a href="${lp("/terms", lang)}">${termsText}</a>`;
  const threshNote = t(
    "Heat takes the worst of feels-like, wet-bulb and WBGT. The persona toggle then bumps a sensitive hazard up one level. Bands come from CPCB (air), IMD and the Australian BoM (heat / cold / wind), WHO (UV) and NASA FIRMS (smoke); the full logic is the open {score}, and every layer's source and licence is on {terms}.",
    lang,
  )
    .replace("{score}", scoreLink)
    .replace("{terms}", termsLink);
  const body = `
  <article class="ax">
  <h1 class="ahero">${t("How the Ambient read works", lang)}</h1>
  <p class="alead">${t("mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. It's a glass box: the thresholds below are public and come from CPCB, IMD, WHO, NASA, the Australian BoM and the AQLI. Informational only, never medical or safety advice.", lang)}</p>

  <h2 class="ah">${t("One read, never an average", lang)}</h2>
  <p class="atext">${onePara}</p>

  <h2 class="ah">${t("For who you are", lang)}</h2>
  <p class="atext">${whoPara}</p>

  <h2 class="ah">${t("The thresholds", lang)}</h2>
  <div class="mtab-wrap">
  <table class="mtab">
  <thead><tr><th>${t("Hazard", lang)}</th><th>${t("Moderate", lang)}</th><th>${t("High", lang)}</th><th>${t("Severe", lang)}</th></tr></thead>
  <tbody>
  ${THRESHOLD_ROWS.map((r) => row(t(r.hazard, lang), ...r.cells)).join("\n  ")}
  </tbody>
  </table>
  </div>
  <p class="atext">${threshNote}</p>

  <h2 class="ah">${t("Today against normal", lang)}</h2>
  <p class="atext">${t("On days when it stands out, the heat layer compares today's modelled high with the normal high for that place and time of year, from 1991-2020 ERA5 reanalysis (Copernicus) via Open-Meteo. It shows only when the two are 3 °C or more apart. It is not a heatwave declaration, which only IMD makes.", lang)}</p>

  <p class="adisc">${t("Informational only, not for medical, emergency, or safety-critical decisions. For official warnings, consult NDMA and IMD.", lang)}</p>
  <p class="aback"><a href="${lp("/", lang)}">← ${t("back to mugilu", lang)}</a></p>
  </article>`;
  return shell(t("How mugilu works: the Ambient read explained", lang), withToc(body, lang), ABOUT_CSS + METHOD_CSS, {
    desc: t(
      "How mugilu's Ambient read is computed: the public, auditable thresholds for air, heat, cold, wind, fog, smoke, UV and dust, and how the persona weighting works.",
      lang,
    ),
    canonical: `${SITE}/methodology`,
    ogImage: HOME_OG,
    lang,
    wide: true,
  });
}
