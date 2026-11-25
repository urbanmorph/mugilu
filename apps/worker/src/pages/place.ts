import { withPersona } from "../links";
import { type Conditions } from "../types";
import { placeLabel } from "../readings";
import { esc } from "../html";
import { AQI_BAND_LABEL } from "../aqi";
import { PERSONAS, PERSONA_LABEL, ambientRisk, type Persona } from "../score";
import { localName, nativeNames, placeBySlug, siblingPlaces, slugFromPath, titleName } from "../slugs";
import { hubOf, stateName } from "../states";
import { aroundLinks } from "../sister";
import { lp, t, type Lang } from "../i18n";
import { OFFLINE_NOTE_ID } from "../sw";
import { HAZARDS } from "../hazards";
import { ALERTS_JS } from "../alerts-ui";
import { breadcrumb, SITE, ld, relTime } from "../ui/shell";
import { HOME_OG } from "../og-html";
import { istDay, istTime } from "../ist";
import { pageShell } from "../ui/page-shell";
import { historyPanel, nearestRecordLine, type Borrow } from "../ui/history";
import type { PlaceTrend } from "../placedaily";
import { facts, type Fact } from "../facts";
import {
  answerLine,
  factText,
  placeDescription,
  placeTitle,
  questions,
  readingHeading,
  ROW_FACT,
  pastWarningsText,
  say,
  warningsText,
} from "../phrases";
import { HISTORY_FROM, type PastAlert } from "../warnhistory";
import { RECENT_WARNINGS, pastAlertList } from "./warnhistory";
import {
  alertsBox,
  autoLane,
  band,
  bandChip,
  linkButton,
  linkRow,
  notice,
  panel,
  placeTile,
  placeTiles,
  fold,
  OPEN_WIDE_JS,
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
  stationPath,
  warningBand,
} from "./read";

/** The place page's own script: it records the visit, opens the folds on a wide screen, and
 *  runs the alerts box when alerts are set up. */
export const placeJs = (alerts: boolean) => PLACE_RECORDER + OPEN_WIDE_JS + (alerts ? ALERTS_JS : "");

/** The persona switch: one choice of six, each a link to the read for that group. On a phone
 *  it is one line, "Who is this for · Everyone · Change", that opens the six (W8); on a wide
 *  screen it is open. The choices stay plain links: crawlable, no script needed. */
function whoSwitch(base: string, current: Persona, lang: Lang): string {
  const links = PERSONAS.map(
    (p) =>
      `<a href="${esc(withPersona(base, p))}"${p === current ? ' aria-current="page"' : ""}>${esc(t(PERSONA_LABEL[p], lang))}</a>`,
  ).join("");
  return (
    `<nav class="segf" aria-labelledby="who"><details class="whod" data-wide><summary>` +
    `<span class="t-kicker" id="who">${esc(t("Who is this for", lang))}</span>` +
    `<span class="cur">${esc(t(PERSONA_LABEL[current], lang))}</span><span class="chg">${esc(t("Change", lang))}</span>` +
    `</summary><div class="seg grid2 d3">${links}</div></details></nav>`
  );
}

/** The hero band: the place and when its readings are from, the Ambient plate, the persona
 *  switch. On wide screens the plate stands beside the title and the switch. */
function hero(c: Conditions, plate: string, who: string, answer: string, lang: Lang, native?: string): string {
  const times = [stamp(t("updated", lang), relTime(c.as_of))];
  if (airLag(c)) times.push(stamp(t("air reading", lang), relTime(c.air_as_of!)));
  if (c.weather_as_of) times.push(stamp(t("weather reading", lang), relTime(c.weather_as_of)));
  // Hidden until the offline worker shows a saved copy (sw.ts matches `id=".." hidden`).
  const offline = notice(
    "quiet",
    esc(
      t(
        "No connection. This is the last reading on this device, from {time}. The conditions and warnings can be different now.",
        lang,
        { time: istTime(c.air_as_of ?? c.as_of) },
      ),
    ),
    undefined,
    OFFLINE_NOTE_ID,
    true,
  );
  return (
    `<section class="band phero"><div class="ptitle stack">` +
    `<p class="t-meta">${c.location.lat}°N&nbsp;&nbsp;${c.location.lon}°E</p>` +
    `<h1 class="t-title loc" data-ll="${c.location.lat},${c.location.lon}">${esc(native ?? placeLabel(c))}` +
    // With a native name, the Latin name and state sit under it.
    `<span class="h1sub">${native ? `<span lang="en">${esc(placeLabel(c))}</span> · ` : ""}${esc(say("h.sub", lang))}</span></h1>` +
    `${stamps(times)}${answer ? `<p class="t-lead answer">${esc(answer)}</p>` : ""}${offline}</div>` +
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
  return panel(fold(t("Stations", lang), rows, { count: c.nearby_stations.length, wide: true }), {
    title: t("Air stations near here", lang),
    icon: "station",
    tag: "nav",
  });
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
      fold(
        t("Nearby places", lang),
        placeTiles(sibs.map((s) => placeTile(lp(`/c/${s.slug}`, lang), localName(s, lang)))),
        {
          count: sibs.length,
          wide: true,
        },
      ),
    );
  const hub = hubOf(placeBySlug(slug)?.state);
  if (hub)
    parts.push(
      `<p><a href="${lp(`/state/${hub.slug}`, lang)}">${esc(t("{state} now", lang, { state: stateName(hub.name, lang) }))} →</a></p>`,
    );
  const around = aroundLinks(slug);
  if (around && (around.wards || around.species)) {
    const links = [
      around.wards
        ? `<a href="${esc(around.wards)}">${esc(t("Find your ward: {place} ward map", lang, { place: around.city }))} (bharatlas)</a>`
        : "",
      around.species
        ? `<a href="${esc(around.species)}">${esc(t("Species of {state}", lang, { state: around.state }))} (yellide)</a>`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    parts.push(`<p><b>${esc(t("Around {place}:", lang, { place: around.city }))}</b> ${links}</p>`);
  }
  return parts.length ? panel(stack(parts.join("")), { tag: "nav", label: t("Nearby places", lang) }) : "";
}

/** The official warnings over the place, always shown: "none now" is worth saying. Under them,
 *  the place's past warnings since the archive began, when its history is kept. */
function warningsPanel(fs: Fact[], place: string, lang: Lang, past: PastAlert[] | null, allHref?: string): string {
  const w = fs.find((f): f is Extract<Fact, { key: "warnings" }> => f.key === "warnings");
  if (!w) return "";
  // The last few alerts here; the whole list (hundreds of nowcasts, worded alike for every
  // district near by) on its own page, kept out of search.
  const recent = past?.slice(0, RECENT_WARNINGS) ?? [];
  const history = past
    ? `<div class="stack"><p>${esc(pastWarningsText(past, place, lang))}</p>` +
      (recent.length
        ? fold(say("warn.past.recent", lang, { n: recent.length }), pastAlertList(recent, lang), {
            count: recent.length,
            wide: true,
          }) +
          (past.length > recent.length && allHref
            ? `<p>${linkButton(allHref, say("warn.past.all", lang, { n: past.length, since: istDay(HISTORY_FROM) }), false, "list")}</p>`
            : "")
        : "") +
      `</div>`
    : "";
  return panel(
    `<p>${esc(warningsText(w, place, lang))} ${esc(say("warn.source", lang))}</p>` +
      history +
      `<p><a href="${esc(lp("/warnings", lang))}">${esc(say("warn.all", lang))}</a></p>`,
    { title: say("h.warn", lang, { place }), icon: "warn", tag: "section", id: "warn" },
  );
}

/** The questions people ask about the place, answered from the same facts. */
function questionsPanel(fs: Fact[], place: string, lang: Lang): string {
  const qa = questions(fs, place, lang);
  if (!qa.length) return "";
  return panel(
    `<div class="qa-list">${qa.map(([q, a]) => fold(q, `<p>${esc(a)}</p>`, { wide: true })).join("")}</div>`,
    { title: say("h.qa", lang, { place }), icon: "list", tag: "section", id: "qa" },
  );
}

/** A reading row's heading and sentence: the fact behind it, said in this language. The heat
 *  row leaves out today's high against normal when the row already draws it. */
function rowWords(key: string, normalDrawn: boolean, fs: Fact[], place: string, lang: Lang) {
  const heading = readingHeading(key, place, lang);
  let fact = fs.find((f) => f.key === ROW_FACT[key]);
  if (!heading || !fact) return undefined;
  if (fact.key === "temp" && normalDrawn) fact = { ...fact, normal: undefined };
  return { heading, text: factText(fact, lang) };
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
  /** A named place's last 30 days (placedaily.ts), when kept. */
  trend: PlaceTrend | null = null,
  /** A point's page: the nearest named place, whose record `trend` is (within BORROW_MAX_KM);
   *  farther, only a line to it. */
  from?: Omit<Borrow, "name">,
  /** A named place's past warnings (warnhistory.ts); null when none is kept for it. */
  past: PastAlert[] | null = null,
): string {
  const risk = ambientRisk(c, persona);
  const slug = `${c.location.lat},${c.location.lon}`;
  const placeName = placeLabel(c);
  const path = canonical ? new URL(canonical).pathname : `/c/${slug}`;
  const base = lp(path, lang);
  const screen = lp(withPersona(`/c/${slug}?kiosk`, risk.persona), lang);
  // The facts behind every sentence on the page; the place as a sentence names it.
  const fs = facts(c);
  const latin = placeName.split(", ")[0];
  // A named place on a Hindi or Kannada page goes by its native-script name, where it has one.
  const named = canonical ? slugFromPath(new URL(canonical).pathname)?.slug : undefined;
  const sp = named ? placeBySlug(named) : undefined;
  const native = sp && localName(sp, lang) !== sp.name ? localName(sp, lang) : undefined;
  const short = native ?? latin;

  // The last 30 days: the place's own, or the nearest named place's, named in every sentence.
  const borrow = from && { ...from, name: localName(from.place, lang) };
  const history = trend
    ? band(historyPanel(trend, lang, lp(`${borrow ? `/c/${borrow.place.slug}` : path}/trends`, lang), borrow, short))
    : borrow
      ? band(nearestRecordLine(borrow, lang))
      : "";
  // GRAP sits in the Air reading; with no air reading here it still shows, on its own.
  const readings =
    band(
      `<div class="flow">${readRows(c, risk, lang)
        .map((r) => readRowHtml(r, lang, rowWords(r.key, !!r.normal, fs, short, lang)))
        .join("")}</div>`,
    ) + (c.grap && !c.air ? band(grapLine(c.grap, lang)) : "");
  // Phones read the button, then alerts, then the stations (the board); desktop moves the
  // stations first and the button under the alerts (standard.ts), so the source keeps phone order.
  const alertsCol =
    `<div class="stack act">${linkButton(screen, t("Put this on a screen", lang), false, "screen")}` +
    `${alertsKey ? alertsBox(alertsKey, lang) : ""}</div>`;
  const reference = band(
    stack(
      `<p class="t-legal">${esc(lang === "en" ? c.attribution : c.attribution.replace(/^Sources:/, `${t("Sources", lang)}:`))}</p>` +
        linkRow([
          [`/c/${slug}.json`, t("JSON", lang)],
          [`/c/${slug}.md`, t("Markdown", lang)],
          [`/c/${slug}.png`, t("PNG", lang)],
          [lp(`/embed/${slug}`, lang), t("Embed", lang)],
          [screen, t("Display", lang)],
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
    hero(c, ambientPlate(risk, lang), whoSwitch(base, risk.persona, lang), answerLine(fs, short, lang), lang, native) +
      warningBand(c, lang) +
      readings +
      band(warningsPanel(fs, short, lang, past, named && lp(`/c/${named}/warnings`, lang))) +
      history +
      secondary([alertsCol, stationsPanel(c, lang), nearbyPanel(canonical, lang)]) +
      band(questionsPanel(fs, short, lang)) +
      reference,
  );

  // Title and description in the words people search ("Delhi AQI today"), from the facts.
  // The short name, as people search it ("almora aqi"); the state stays where two districts
  // share the name (their slug carries it).
  const namedPlace = named ? placeBySlug(named) : undefined;
  const titlePlace = namedPlace ? titleName(namedPlace) : placeName;
  // The native name leads; the Latin one follows it, so both searches match.
  const title = placeTitle(fs, native ?? titlePlace, titlePlace, lang);
  // With no air reading the facts say little, so the description names what the page covers.
  const desc = fs.some((f) => f.key === "air")
    ? placeDescription(fs, short, c.as_of, lang)
    : `${placeName}: ${t(`The ${HAZARDS} over this spot, with the single worst hazard named for you.`, lang)}`;
  // schema.org Dataset: credits mugilu and the licence, points at the machine-readable siblings.
  const dataset = canonical
    ? ld({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Dataset",
            name: t("Sky conditions at {place}", lang, { place: placeName }),
            description: t(`The ${HAZARDS} at {place}, India, right now.`, lang, { place: placeName }),
            inLanguage: lang,
            url: canonical,
            isAccessibleForFree: true,
            creator: { "@type": "Organization", name: "mugilu", url: SITE },
            license: `${SITE}/terms`,
            temporalCoverage: c.as_of,
            spatialCoverage: {
              "@type": "Place",
              name: c.place ?? undefined,
              ...(named && nativeNames(named).length ? { alternateName: nativeNames(named) } : {}),
              geo: { "@type": "GeoCoordinates", latitude: c.location.lat, longitude: c.location.lon },
            },
            distribution: [
              { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${canonical}.json` },
              { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: `${canonical}.md` },
            ],
          },
          breadcrumb(
            ...(hubOf(sp?.state)
              ? [
                  [stateName(sp!.state!, lang), `${SITE}${lp(`/state/${hubOf(sp?.state)!.slug}`, lang)}`] as [
                    string,
                    string,
                  ],
                ]
              : []),
            [native ?? placeName, canonical],
          ),
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
    script: alertsKey ? { key: "place.alerts", js: placeJs(true) } : { key: "place", js: placeJs(false) },
  });
}
