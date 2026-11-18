import { type NearStation, type NormalizedStation } from "../types";
import { AQI_BAND_LABEL, aqiBand, subIndex } from "../aqi";
import { providerName } from "../sources";
import { pollutantParts } from "../formats";
import { esc } from "../html";
import { RISK_BANDS, airLevelOf } from "../score";
import { lp, t, type Lang } from "../i18n";
import { HOME_OG, SITE, ld, relTime } from "../ui/shell";
import { pageShell } from "../ui/page-shell";
import {
  BAND_SHAPE,
  band,
  bandChip,
  barRows,
  dataTable,
  ico,
  lane,
  linkButton,
  linkRow,
  notice,
  panel,
  plate,
  stack,
  wrap,
} from "../ui/components";
import { readTint, stationPath } from "./read";

/** The CPCB sub-index of each pollutant (its place on the 0-500 AQI scale), where it has one. */
function subIndices(s: NormalizedStation) {
  return pollutantParts(s.pollutants).flatMap((p) => {
    const si = subIndex(p.key as Parameters<typeof subIndex>[0], p.value);
    return si == null ? [] : [{ ...p, si }];
  });
}

/** The pollutants as BarRows on one 0-500 scale, each in its band; the CPCB limit (100) dashed. */
function pollutantPanel(s: NormalizedStation, lang: Lang): string {
  const items = subIndices(s).map((p) => ({
    label: p.label,
    // Whole µg/m³ (CO keeps its decimals, as on the place page).
    value: `${p.key === "co" ? p.value : Math.round(p.value)} ${esc(p.unit)}`,
    pct: (p.si / 500) * 100,
    band: aqiBand(p.si),
  }));
  if (!items.length) return "";
  return panel(
    barRows(items, 20) +
      `<p class="t-meta">${esc(t("Each bar is the pollutant on CPCB's 0-500 AQI scale, in its band's colour.", lang))} ${esc(t("The dashed line is the CPCB limit.", lang))}</p>`,
  );
}

/** The stations around this one, each to its own page, with its reading and distance. */
function nearbyPanel(nearby: NearStation[], lang: Lang): string {
  if (!nearby.length) return "";
  const rows = nearby.map((n) => [
    `<a href="${esc(lp(stationPath(n.provider, n.raw_id), lang))}">${esc(n.name)}</a>`,
    n.aqi != null ? bandChip(n.band, `${n.aqi} ${t(AQI_BAND_LABEL[n.band] ?? "", lang)}`) : "",
    n.distance_km != null ? `${n.distance_km.toFixed(1)} km` : "",
  ]);
  return panel(
    dataTable(
      [{ label: t("Station", lang) }, { label: "AQI" }, { label: t("Distance", lang), num: true }],
      rows,
      t("Air stations near here", lang),
    ),
    { title: t("Air stations near here", lang), icon: "station", flush: true },
  );
}

/** /s/{provider}/{id}: one air station, titled the way people search ("Anand Vihar AQI
 *  today: 412 Severe"). `fresh` false: the station has not reported within the snapshot's
 *  window, so its last reading is shown as that, greyed, with no number in the title. */
export function renderStationPage(
  s: NormalizedStation,
  nearby: NearStation[],
  fresh: boolean,
  lang: Lang = "en",
): string {
  const bandWord = t(AQI_BAND_LABEL[s.band] ?? "", lang);
  const live = fresh && s.aqi != null;
  const path = stationPath(s.provider, s.raw_id);
  const canonical = `${SITE}${path}`;
  const provider = providerName(s.provider);
  const where = [s.city, s.state].filter(Boolean).join(", ");
  const tail = `${where ? `${where} · ` : ""}${t("air quality station", lang)} · mugilu`;
  const fill = (x: string) =>
    x
      .replace("{place}", s.name)
      .replace("{station}", s.name)
      .replace("{city}", s.city || s.name)
      .replace("{aqi}", String(s.aqi))
      .replace("{band}", bandWord)
      .replace("{provider}", provider);
  const title = live ? `${fill(t("{place} AQI today: {aqi} {band}", lang))} · ${tail}` : `${s.name} · ${tail}`;
  const desc = live
    ? fill(t("{station} ({city}) AQI {aqi} ({band}) right now, measured by {provider}.", lang))
    : `${s.name}${where ? ` (${where})` : ""}: ${t("air quality station", lang)}, ${provider}.`;
  const when = s.ts ? relTime(new Date(s.ts).toISOString()) : "n/a";

  // The plate: the AQI on its band's fill; stale, greyed with no level shape.
  const lead = subIndices(s).sort((a, b) => b.si - a.si)[0];
  const aqiText = `${s.aqi ?? "n/a"} AQI · ${bandWord}`;
  const reading =
    s.aqi != null
      ? plate({
          fill: live ? `b-${s.band}` : "nolevel",
          shape: live ? BAND_SHAPE[s.band] : undefined,
          word: `<p class="big"><span class="t-plate">${s.aqi}</span><span class="t-value">AQI · ${esc(bandWord)}</span></p>`,
          say:
            live && lead
              ? esc(t("Prominent pollutant: {pollutant}", lang).replace("{pollutant}", lead.label))
              : undefined,
          label: aqiText,
          inline: true,
        })
      : "";
  const head = stack(
    `<div class="ph"><p class="t-kicker row-c">${ico("station")}<span>${esc(t("Station", lang))}</span></p>` +
      `<h1 class="t-title">${esc(s.name)}</h1><p class="t-meta">${esc(where || "India")} · ${esc(provider)}</p></div>` +
      (live
        ? `<p class="stamp plain"><span class="k">${esc(fill(t("Measured by {provider}.", lang)))}</span><span class="v">${when}</span></p>`
        : notice(
            "stale",
            esc(t("No recent reading from this station. Last reading: X", lang)).replace("X", when),
            "clock",
          )),
  );
  const full =
    s.lat != null && s.lon != null
      ? linkButton(
          lp(`/c/${s.lat},${s.lon}`, lang),
          `${t("The full sky here: heat, rain, warnings and what to do", lang)} →`,
          true,
        )
      : "";
  const refs = stack(
    `<p class="t-meta">${esc(t("Sources", lang))}: ${esc(provider)} via OAQ, via mugilu.</p>` +
      linkRow([
        [`${path}.json`, t("JSON", lang)],
        [`${path}.md`, t("Markdown", lang)],
      ]) +
      `<p class="back"><a href="${lp("/", lang)}">← ${esc(t("Look up another place", lang))}</a></p>`,
  );
  const pair = (a: string, b: string, kind: "l2" | "l57" = "l2") => (a && b ? lane(kind, [a, b]) : a || b);
  const body = wrap(
    band(pair(head, reading, "l57")) +
      band(pair(live ? pollutantPanel(s, lang) : "", nearbyPanel(nearby, lang))) +
      // One column: a button beside a block of notes would leave a hole (balance rule).
      band(stack(full + refs)),
  );
  const jsonLd = ld({
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${s.name} air quality station`,
    url: canonical,
    geo: { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lon },
    address: { "@type": "PostalAddress", addressLocality: s.city || undefined, addressCountry: "IN" },
  });
  // Station pages are thin and Google never crawled them: they stay for people, out of the index.
  // The air hue at the station's band level; calm sky when it has no recent reading.
  return pageShell(title, body, {
    live: true,
    path,
    desc,
    canonical,
    jsonLd,
    ogImage: HOME_OG,
    lang,
    noindex: true,
    tint: readTint({ band: RISK_BANDS[live ? (airLevelOf(s.band) ?? 0) : 0], driver: "Air" }),
  });
}
