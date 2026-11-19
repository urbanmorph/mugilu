import { withPersona } from "../links";
import { type Conditions } from "../types";
import { placeLabel } from "../readings";
import { esc } from "../html";
import { AQI_BAND_LABEL } from "../aqi";
import { PERSONAS, PERSONA_LABEL, ambientRisk, ambientSummary, type Persona } from "../score";
import { siblingPlaces, slugFromPath } from "../slugs";
import { aroundLinks } from "../sister";
import { lp, t, type Lang } from "../i18n";
import { OFFLINE_NOTE_ID } from "../sw";
import { HAZARDS } from "../hazards";
import { ALERTS_JS } from "../alerts-ui";
import { breadcrumb, SITE, ld, relTime } from "../ui/shell";
import { HOME_OG } from "../og-html";
import { istTime } from "../ist";
import { pageShell } from "../ui/page-shell";
import {
  alertsBox,
  autoLane,
  band,
  bandChip,
  lane,
  linkButton,
  linkRow,
  notice,
  panel,
  placeTile,
  placeTiles,
  segLinks,
  stack,
  stamp,
  stamps,
  wrap,
} from "../ui/components";
import {
  PLACE_RECORDER,
  airLag,
  ambientPlate,
  grapLine,
  readRowHtml,
  readRows,
  readTint,
  searchTitle,
  stationPath,
  warningBand,
} from "./read";

/** The persona switch: one choice of six, each a link to the read for that group. */
function whoSwitch(base: string, current: Persona, lang: Lang): string {
  return segLinks(
    "who",
    t("Who is this for", lang),
    PERSONAS.map((p) => ({
      label: t(PERSONA_LABEL[p], lang),
      href: withPersona(base, p),
      current: p === current,
    })),
    { segClass: "grid2 d3" },
  );
}

/** The hero band: the place and when its readings are from, the Ambient plate, the persona
 *  switch. On wide screens the plate stands beside the title and the switch. */
function hero(c: Conditions, plate: string, who: string, lang: Lang): string {
  const times = [stamp(t("updated", lang), relTime(c.as_of))];
  if (airLag(c)) times.push(stamp(t("air reading", lang), relTime(c.air_as_of!)));
  if (c.weather_as_of) times.push(stamp(t("weather reading", lang), relTime(c.weather_as_of)));
  // Hidden until the offline worker shows a saved copy (sw.ts matches `id=".." hidden`).
  const offline = notice(
    "quiet",
    esc(
      t(
        "No connection. This is the last reading on this device, from X. The conditions and warnings can be different now.",
        lang,
      ).replace("X", istTime(c.air_as_of ?? c.as_of)),
    ),
    undefined,
    OFFLINE_NOTE_ID,
    true,
  );
  return (
    `<section class="band phero"><div class="ptitle stack">` +
    `<p class="t-meta">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</p>` +
    `<h1 class="t-title loc" data-ll="${c.location.lat},${c.location.lon}">${esc(placeLabel(c))}</h1>` +
    `<p class="t-meta">${esc(t("the sky at this point", lang))}</p>${stamps(times)}${offline}</div>` +
    `${plate}<div class="pwho">${who}</div></section>`
  );
}

/** The air stations around the place, each to its own page, with its reading. */
function stationsPanel(c: Conditions, lang: Lang): string {
  if (!c.nearby_stations?.length) return "";
  const rows = c.nearby_stations
    .map(
      (s) =>
        `<a class="srow" href="${esc(lp(stationPath(s.provider, s.raw_id), lang))}"><span class="n">${esc(s.name)}</span>` +
        `<span class="a">${s.aqi ?? ""}</span>${bandChip(s.band, t(AQI_BAND_LABEL[s.band] ?? "n/a", lang))}</a>`,
    )
    .join("");
  return panel(rows, { title: t("Air stations near here", lang), icon: "station", tag: "nav" });
}

/** Nearby named places in the same state, and the same place on the sister sites. Only on a
 *  named page (/c/{slug}): a crawler can walk the ~800 place pages, a person can step over. */
function nearbyPanel(canonical: string | undefined, lang: Lang): string {
  const slug = canonical ? slugFromPath(new URL(canonical).pathname)?.slug : undefined;
  if (!slug) return "";
  const parts: string[] = [];
  const sibs = siblingPlaces(slug);
  if (sibs.length)
    parts.push(
      `<p><b>${esc(t("Nearby:", lang))}</b></p>` +
        placeTiles(sibs.map((s) => placeTile(lp(`/c/${s.slug}`, lang), s.name))),
    );
  const around = aroundLinks(slug);
  if (around && (around.wards || around.species)) {
    const links = [
      around.wards
        ? `<a href="${esc(around.wards)}">${esc(t("Find your ward: {place} ward map", lang).replace("{place}", around.city))} (bharatlas)</a>`
        : "",
      around.species
        ? `<a href="${esc(around.species)}">${esc(t("Species of {state}", lang).replace("{state}", around.state))} (yellide)</a>`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    parts.push(`<p><b>${esc(t("Around {place}:", lang).replace("{place}", around.city))}</b> ${links}</p>`);
  }
  return parts.length ? panel(stack(parts.join("")), { tag: "nav", label: t("Nearby places", lang) }) : "";
}

/** The lane of equal columns for the secondary band (one, two or three of them). */
function secondary(cols: string[]): string {
  const items = cols.filter(Boolean);
  return items.length ? band(autoLane(items.length > 1 ? items.map((x) => `<div>${x}</div>`) : items)) : "";
}

export function renderConditionsPage(
  c: Conditions,
  persona: Persona = "everyone",
  canonical?: string,
  lang: Lang = "en",
  /** mugilu's VAPID public key, when alerts are set up: shows the "alert me" box. */
  alertsKey?: string,
  /** An arbitrary point (not a named place): endless and thin, so kept out of search indexes. */
  noindex = false,
): string {
  const risk = ambientRisk(c, persona);
  const { meaning } = ambientSummary(risk, (en) => t(en, lang));
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c);
  const path = canonical ? new URL(canonical).pathname : `/c/${slug}`;
  const base = lp(path, lang);
  const screen = lp(withPersona(`/c/${slug}?kiosk`, risk.persona), lang);

  // GRAP sits in the Air reading; with no air reading here it still shows, on its own.
  const readings =
    band(
      `<div class="flow">${readRows(c, risk, lang)
        .map((r) => readRowHtml(r, lang))
        .join("")}</div>`,
    ) + (c.grap && !c.air ? band(grapLine(c.grap, lang)) : "");
  const alertsCol = stack(
    (alertsKey ? alertsBox(alertsKey, lang) : "") +
      linkButton(screen, t("Put this on a screen", lang), false, "screen"),
  );
  const reference = band(
    stack(
      `<p class="t-legal">${esc(lang === "en" ? c.attribution : c.attribution.replace(/^Sources:/, `${t("Sources", lang)}:`))}</p>` +
        linkRow([
          [`/c/${slug}.json`, t("JSON", lang)],
          [`/c/${slug}.md`, t("Markdown", lang)],
          [`/c/${slug}.png`, t("PNG", lang)],
          [lp(`/embed/${slug}`, lang), t("Embed", lang)],
          [lp(`/c/${slug}?kiosk`, lang), t("Display", lang)],
        ]) +
        linkRow(
          [
            [lp("/", lang), `← ${t("Look up another place", lang)}`],
            [lp("/places", lang), t("all places", lang)],
          ],
          "t-meta back",
        ),
    ),
  );
  const body = wrap(
    hero(c, ambientPlate(risk, lang), whoSwitch(base, risk.persona, lang), lang) +
      warningBand(c, lang) +
      readings +
      secondary([stationsPanel(c, lang), alertsCol, nearbyPanel(canonical, lang)]) +
      reference,
  );

  // Title and description in the words people search ("Delhi AQI today"), with the number.
  const { title, lead } = searchTitle(c, placeName, lang);
  const desc = `${lead ?? `${placeName}:`} ${meaning} ${t(`The ${HAZARDS} over this spot, with the single worst hazard named for you.`, lang)}`;
  // schema.org Dataset: credits mugilu and the licence, points at the machine-readable siblings.
  const dataset = canonical
    ? ld({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Dataset",
            name: `Sky conditions at ${placeName}`,
            description: `The ${HAZARDS} at ${placeName}, India - right now.`,
            url: canonical,
            isAccessibleForFree: true,
            creator: { "@type": "Organization", name: "mugilu", url: SITE },
            license: `${SITE}/terms`,
            temporalCoverage: c.as_of,
            spatialCoverage: {
              "@type": "Place",
              name: c.place ?? undefined,
              geo: { "@type": "GeoCoordinates", latitude: c.location.lat, longitude: c.location.lon },
            },
            distribution: [
              { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${canonical}.json` },
              { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: `${canonical}.md` },
            ],
          },
          breadcrumb([placeName, canonical]),
        ],
      })
    : undefined;
  return pageShell(title, body, {
    live: true,
    path,
    query: withPersona("", risk.persona),
    desc,
    canonical,
    jsonLd: dataset,
    ogImage: canonical ? `${canonical}.png` : HOME_OG,
    lang,
    noindex,
    tint: readTint(risk),
    js: PLACE_RECORDER + (alertsKey ? ALERTS_JS : ""),
  });
}
