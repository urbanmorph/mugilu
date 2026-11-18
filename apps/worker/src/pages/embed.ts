import { coordKey } from "../links";
import { type Conditions } from "../types";
import { AQI_BAND_LABEL } from "../aqi";
import { placeLabel } from "../readings";
import { esc } from "../html";
import { ambientRisk, ambientSummary, type AmbientRisk, type Persona } from "../score";
import { lp, t, type Lang } from "../i18n";
import { istTime } from "../ist";
import { pageShell } from "../ui/page-shell";
import { embedCard, panel } from "../ui/components";
import { headText, readRows, readTint } from "./read";

// The embeddable card (a "build on it" surface): the place's read in other sites' iframes
// (the published snippet is 480x240). The whole card links back to the place. The full
// disclaimer shows at 400px wide and up, the short live line below (rule 6). Opened on its
// own, the page also carries the snippet; framed, only the card.

/** The readings the card has room for, in the order they matter now. */
const CARD_KEYS = new Set(["air", "heat", "sun", "dust", "smoke"]);

/** The card's figures, from the one readings model (read.ts readRows), so the card never
 *  disagrees with the place page: the figure, then what it is and its word. */
function cardReads(c: Conditions, risk: AmbientRisk, lang: Lang): [string, string][] {
  return readRows(c, risk, lang)
    .filter((r) => CARD_KEYS.has(r.key))
    .map((r) => {
      const word = r.key === "air" ? t(AQI_BAND_LABEL[c.air?.band ?? "unknown"], lang) : r.qual;
      return [r.num, [r.unit, word].filter(Boolean).join(" ")];
    });
}

export function renderEmbed(c: Conditions, persona: Persona, siteUrl: string, lang: Lang = "en"): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const slug = coordKey(c.location);
  const placeName = placeLabel(c);

  // The snippets are pasted into other sites: every attribute escaped.
  const iframe = `<iframe src="${siteUrl}${lp(`/embed/${slug}`, lang)}" width="480" height="240" style="border:0;border-radius:16px" title="mugilu: conditions at ${esc(placeName)}" loading="lazy"></iframe>`;
  const imgtag = `<img src="${siteUrl}/c/${slug}.png" alt="mugilu: conditions at ${esc(placeName)}" width="600">`;
  const card = embedCard(
    {
      href: `${siteUrl}${lp(`/c/${slug}`, lang)}`,
      place: placeName,
      level: risk.band,
      headline: headText(risk, lang).replace(/\.$/, ""),
      // A persona's own step follows the meaning ("Asthma: do not exercise hard outdoors.").
      say: say.action ? `${say.meaning} ${say.action}` : say.meaning,
      reads: cardReads(c, risk, lang),
      asOf: esc(t("as of X", lang).replace("X", istTime(c.as_of))),
    },
    lang,
  );
  // The snippet, for someone who opened the card on its own (hidden when framed).
  const code = `<div class="ecode">${panel(
    `<p>${esc(t("Live widget (iframe):", lang))}</p><pre class="code">${esc(iframe)}</pre>` +
      `<p>${esc(t("Or an image with the time on it:", lang))}</p><pre class="code">${esc(imgtag)}</pre>`,
    { title: t("Embed this", lang) },
  )}</div>`;
  return pageShell(`${placeName}: mugilu`, `<h1 class="vh">${esc(placeName)}</h1>${card}${code}`, {
    path: "/embed",
    variant: "embed",
    lang,
    tint: readTint(risk),
    js: "if(window.self!==window.top)document.documentElement.classList.add('framed')",
  });
}
