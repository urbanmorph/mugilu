import { type Conditions } from "../types";
import { AQI_BAND_LABEL } from "../aqi";
import { briefs, placeLabel } from "../readings";
import { esc } from "../html";
import { ambientRisk, ambientSummary, smokeLevel, type AmbientRisk, type Persona } from "../score";
import { t, type Lang } from "../i18n";
import { istTime } from "../ui/shell";
import { embedShell } from "../ui/page-shell";
import { embedCard, panel } from "../ui/components";
import { dustBand, headText, readTint, round, uvWord } from "./read";

// The embeddable card (a "build on it" surface): the place's read in other sites' iframes
// (the published snippet is 480x240). The whole card links back to the place. The full
// disclaimer shows at 400px wide and up, the short live line below (rule 6). Opened on its
// own, the page also carries the snippet; framed, only the card.

/** The card's figures, each in its own words, in the order every surface uses. */
function cardReads(c: Conditions, risk: AmbientRisk, lang: Lang): [string, string][] {
  const read: Record<string, [string, string]> = {};
  if (c.air?.aqi != null) read.air = [String(c.air.aqi), `AQI ${t(AQI_BAND_LABEL[c.air.band] ?? "", lang)}`];
  if (c.heat?.apparent_c != null) read.heat = [`${round(c.heat.apparent_c)}°`, t("feels like", lang)];
  if (c.uv?.index != null) read.sun = [String(Math.round(c.uv.index)), `UV ${t(uvWord(c.uv.index), lang)}`];
  if (c.dust?.dust_ug_m3 != null)
    read.dust = [String(Math.round(c.dust.dust_ug_m3)), `${t("dust", lang)} ${t(dustBand(c.dust.dust_ug_m3), lang)}`];
  if (c.smoke && smokeLevel(c.smoke) != null) read.smoke = [String(c.smoke.count), t("fires within 100 km", lang)];
  return briefs(c, risk)
    .map((b) => read[b.key])
    .filter(Boolean);
}

export function renderEmbed(c: Conditions, persona: Persona, siteUrl: string, lang: Lang = "en"): string {
  const risk = ambientRisk(c, persona);
  const say = ambientSummary(risk, (en) => t(en, lang));
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c);

  const iframe = `<iframe src="${siteUrl}/embed/${slug}" width="480" height="240" style="border:0;border-radius:16px" title="mugilu: conditions at ${placeName}" loading="lazy"></iframe>`;
  const imgtag = `<img src="${siteUrl}/c/${slug}.png" alt="mugilu: conditions at ${placeName}" width="600">`;
  const card = embedCard(
    {
      href: `${siteUrl}/c/${slug}`,
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
  return embedShell(`${placeName}: mugilu`, `<h1 class="vh">${esc(placeName)}</h1>${card}${code}`, {
    lang,
    tint: readTint(risk),
    js: "if(window.self!==window.top)document.documentElement.classList.add('framed')",
  });
}
