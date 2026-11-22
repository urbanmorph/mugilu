import { DESKTOP } from "../ui/standard";
import { cycloneIn, cycloneTitle, type WarningsSnapshot } from "../sachet";
import { esc } from "../html";
import { langAttr, lp, t, type Lang } from "../i18n";
import { isHttpUrl } from "./read";
import { breadcrumb, ld, SITE } from "../ui/shell";
import { SOURCE_CREDIT } from "../sources";
import { HOME_OG } from "../og-html";
import { istTime } from "../ist";
import { pageShell } from "../ui/page-shell";
import type { IndiaMap } from "../indiamap";
import { allSlugPlaces, type SlugPlace } from "../slugs";
import { fill } from "../ui/history";
import { DESCRIPTION_MAX } from "../phrases";
import { warnedSlugs } from "./places";
import {
  backLink,
  band,
  checkGroup,
  filterBar,
  filterInput,
  fold,
  ico,
  LIST_FILTER_JS,
  notice,
  pageHead,
  panel,
  placeTile,
  placeTiles,
  stamp,
  stamps,
  type IconName,
  warningPlate,
  warningRow,
  wrap,
} from "../ui/components";

type Alert = WarningsSnapshot["alerts"][number];

/** The issuing office from a SACHET issuer field: "controlroom@ndma.gov.in (IMD
 *  Chennai)" -> "IMD Chennai"; the control-room address is the same on every alert. */
export function issuerName(issuer: string): string {
  const named = issuer.match(/\(([^)]+)\)\s*$/)?.[1];
  return (named ?? issuer.replace(/\S+@\S+/g, "")).trim() || "NDMA";
}

// What a warning is about, read from its headline (every SACHET alert carries the same
// category, "Met"). The first that matches wins: "thunderstorm and rain" is a storm, and an
// avalanche comes first because DGRE writes "danger level", which is also a river's. Words in
// English, Hindi, Kannada, Bengali, Telugu and Odia: the offices write in all of them. A sea-wave
// alert with no hazard word stays under Other, as its English equivalent does.
const WARNING_TYPES: [key: string, label: string, re: RegExp, icon: IconName][] = [
  ["avalanche", "Avalanche", /avalanche|हिमस्खलन|ಹಿಮಕುಸಿತ|তুষারধস|హిమపాతం/i, "snow"],
  [
    "storm",
    "Thunderstorm, lightning",
    /thunder|lightning|squall|hail|गरज|बिजली|वज्रपात|आंधी|ಗುಡುಗು|ಸಿಡಿಲು|ಮಿಂಚು|বজ্র|বিদ্যুৎ চমকা|ঝড়|ఉరుము|పిడుగు|మెరుపు|ବଜ୍ରପାତ|ଘଡ଼ଘଡ଼ି/i,
    "storm",
  ],
  ["flood", "Flood, river level", /flood|river|danger level|water level|बाढ़|नदी|ಪ್ರವಾಹ|বন্যা|నదీ|వరద|ବନ୍ୟା/i, "flood"],
  ["rain", "Rain, snow", /rain|snow|वर्षा|बारिश|ಮಳೆ|বৃষ্টি|వర్ష|ବର୍ଷା/i, "rain"],
  [
    "wind",
    "Wind, cyclone",
    /wind|gale|cyclone|dust storm|हवा|चक्रवात|ಗಾಳಿ|ಚಂಡಮಾರುತ|ঘূর্ণিঝড়|తుపాను|తుఫాను|గాలి|ବାତ୍ୟା|ପବନ/i,
    "wind",
  ],
  ["heat", "Heat", /heat|hot|लू|गर्मी|ಬಿಸಿ|তাপপ্রবাহ|వడగాల్పు|ତାପପ୍ରବାହ/i, "heat"],
  ["cold", "Cold, frost", /cold|frost|शीत|ठंड|ಚಳಿ|শৈত্যপ্রবাহ|చలి|ଶୀତ/i, "cold"],
  ["fog", "Fog", /fog|कोहरा|ಮಂಜು|কুয়াশা|పొగమంచు|କୁହୁଡ଼ି/i, "fog"],
];
const OTHER: [string, string, RegExp, IconName] = ["other", "Other", /$^/, "warn"];
const typeOf = (headline: string) => WARNING_TYPES.find(([, , re]) => re.test(headline)) ?? OTHER;

/** The kind of hazard a warning is about, from its headline ("other" when none matches). */
/** The kind of hazard a warning is about, as its plain label ("Rain, snow"; "Other" when none matches). */
export function warningLabel(headline: string): string {
  return typeOf(headline)[1];
}

export function warningType(headline: string): string {
  return typeOf(headline)[0];
}

// Applies the filters: a warning stays when its kind and office are ticked and it holds the
// search text; an office's list hides when none of its warnings show. On wide screens the
// filters start open.
const WARNINGS_JS = `(function(){var f=document.getElementById('wfilter');if(!f)return;if(matchMedia(${JSON.stringify(DESKTOP)}).matches)f.open=true;
${LIST_FILTER_JS}
var q=document.getElementById('wq');function on(n){return [].slice.call(f.querySelectorAll('input[name='+n+']:checked')).map(function(i){return i.value})}
function go(){var ty=on('type'),of=on('issuer'),s=(q.value||'').trim().toLowerCase();
f.querySelectorAll('.check').forEach(function(l){l.classList.toggle('off',!l.querySelector('input').checked)});
mgFilter(document.querySelectorAll('main [data-type]'),function(el){return ty.indexOf(el.getAttribute('data-type'))>-1&&of.indexOf(el.getAttribute('data-issuer'))>-1&&mgMatch(el,s)});
mgEmpty(document.querySelectorAll('.wsec'),'[data-type]')}
f.addEventListener('change',go);q.addEventListener('input',go)})();`;

const when = (a: Alert) => Date.parse(a.sent) || 0;

/** An official alert's issuing office, its IST time and a link to the original (CAP), read one
 *  way for home, /warnings and /places. The link only when the feed's link is a web address. */
export function alertParts(a: Alert, lang: Lang): { office: string; time: string; cap: string } {
  const office = issuerName(a.issuer || "");
  const time = istTime(a.sent);
  const label = t("Original alert (CAP): {issuer}, {time}", lang).replace("{issuer}", office).replace("{time}", time);
  const cap = isHttpUrl(a.link) ? `<a href="${esc(a.link)}" rel="noopener" aria-label="${esc(label)}">CAP</a>` : "";
  return { office, time, cap };
}

/** The places under an official warning now (as /places marks them), by state: the state with
 *  the most places first. */
function warnedByState(under: Set<string>): [state: string, places: SlugPlace[]][] {
  const by = new Map<string, SlugPlace[]>();
  for (const p of allSlugPlaces().filter((p) => under.has(p.slug))) {
    const st = p.state ?? p.name;
    by.set(st, [...(by.get(st) ?? []), p]);
  }
  return [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

/** "The warnings in force now cover 12 places in 3 states." */
function coverLine(places: number, states: number, lang: Lang): string {
  if (places === 1) return t("The warnings in force now cover 1 place in 1 state.", lang);
  if (states === 1) return fill("The warnings in force now cover {p} places in 1 state.", lang, { p: places });
  return fill("The warnings in force now cover {p} places in {s} states.", lang, { p: places, s: states });
}

// IMD's colour code, as IMD words it. Text of the page's own that stays true between events.
const COLOURS: [colour: string, meaning: string][] = [
  ["Green", "No warning. No action is needed."],
  ["Yellow", "Be updated. The weather can turn bad. Watch for updates."],
  ["Orange", "Be prepared. Bad weather is expected. Be ready to act."],
  ["Red", "Take action. Dangerous weather is expected. Follow official advice."],
];

function coloursPanel(lang: Lang): string {
  const T = (s: string) => esc(t(s, lang));
  return panel(
    `<dl class="qa-list">${COLOURS.map(([c, m]) => `<dt>${T(c)}</dt><dd>${T(m)}</dd>`).join("")}</dl>` +
      `<p>${T('IMD says a red warning does not mean a "red alert". It means "take action".')}</p>` +
      `<p>${T("A colour is for one area and one time. Open a place to see the warnings over it and their colour.")} <a href="${lp("/places", lang)}">${T("Every place, by state")}</a></p>`,
    { title: t("Yellow, orange and red: what they mean", lang), icon: "warn", id: "colours" },
  );
}

function sourcesPanel(lang: Lang): string {
  const T = (s: string) => esc(t(s, lang));
  return panel(
    `<p>${T("IMD, other national agencies and the state disaster management authorities issue these warnings.")} ` +
      `${T("NDMA publishes them on SACHET, in the Common Alerting Protocol (CAP).")} ` +
      `${T("mugilu mirrors the SACHET feed and keeps an archive of every alert.")}</p>`,
    { title: t("Where the warnings come from", lang), icon: "list", id: "source" },
  );
}

export function renderWarningsPage(
  snap: WarningsSnapshot | null,
  lang: Lang = "en",
  /** The home map, whose warning areas say which places are under a warning now. */
  map?: IndiaMap,
  now?: number,
): string {
  const T = (s: string) => esc(t(s, lang));
  // Newest first; a storm IMD names is pinned once (its newest warning), above the lists.
  // Each alert read once: its office, its kind, and the line under it (time, CAP link).
  const alerts = [...(snap?.alerts ?? [])]
    .sort((x, y) => when(y) - when(x))
    .map((a) => {
      const { office, time, cap } = alertParts(a, lang);
      const [type, label, , icon] = typeOf(a.headline || "");
      return { a, office, type, label, icon, meta: [time && esc(time), cap].filter(Boolean).join(" · ") };
    });
  type Read = (typeof alerts)[number];
  const pinned = new Map<string, Read>();
  for (const r of alerts) {
    // Pinned: a named storm only (IMD names every cyclonic storm), as on home.
    const c = cycloneIn(r.a.headline);
    if (c?.name && !pinned.has(c.title)) pinned.set(c.title, r);
  }
  const isPinned = new Set(pinned.values());

  const row = (r: Read) =>
    warningRow({
      icon: r.icon,
      kind: t(r.label, lang),
      head: r.a.headline || "Warning",
      lang,
      meta: r.meta,
      type: r.type,
      issuer: r.office,
    });

  // Grouped by issuing office (a state SDMA or an IMD centre), the office with the newest
  // alert first; times in IST like every page.
  const groups = new Map<string, Read[]>();
  for (const r of alerts.filter((r) => !isPinned.has(r))) groups.set(r.office, [...(groups.get(r.office) ?? []), r]);
  const lists = [...groups]
    .map(
      ([name, list]) =>
        `<section class="wsec"><h2 class="wgrp">${esc(name)}<span class="n">${list.length}</span></h2><ul>${list.map(row).join("")}</ul></section>`,
    )
    .join("");

  const plates = [...pinned]
    .map(
      ([name, r]) =>
        `<div data-type="${r.type}" data-issuer="${esc(r.office)}">${warningPlate({
          bar: [`<span>${esc(t(r.label, lang))} · ${esc(r.office)}</span>`, `<span>${r.meta}</span>`],
          title: cycloneTitle(name, lang),
          icon: "cyclone",
          body: `<p${langAttr(r.a.headline, lang)}>${esc(r.a.headline)}</p>`,
          label: cycloneTitle(name, lang),
          lang,
        })}</div>`,
    )
    .join("");

  const count = (key: (r: Read) => string) => {
    const m = new Map<string, number>();
    for (const r of alerts) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return m;
  };
  const types = count((r) => r.type);
  const offices = [...count((r) => r.office)].sort((x, y) => y[1] - x[1]);
  const filters = fold(
    t("Filter warnings", lang),
    filterBar(
      [
        filterInput("wq", t("Find a place or district", lang)),
        checkGroup(
          "type",
          t("Type", lang),
          [...WARNING_TYPES, OTHER]
            .filter(([k]) => types.has(k))
            .map(([k, en]) => ({ value: k, label: t(en, lang), count: types.get(k)! })),
        ),
        checkGroup(
          "issuer",
          t("Issued by", lang),
          offices.map(([o, n]) => ({ value: o, label: o, count: n })),
        ),
      ],
      t("Filter warnings", lang),
    ),
    { count: alerts.length, id: "wfilter" },
  );

  // The warnings in one line: how many, where (from their areas), and the most common type.
  const byState = alerts.length && map ? warnedByState(new Set(warnedSlugs(map, snap, now))) : [];
  const nPlaces = byState.reduce((n, [, ps]) => n + ps.length, 0);
  const top = [...types].sort((a, b) => b[1] - a[1])[0];
  const summary = alerts.length
    ? [
        t("The latest {n} official NDMA / IMD alerts across India.", lang).replace("{n}", String(alerts.length)),
        byState.length ? coverLine(nPlaces, byState.length, lang) : "",
        fill("Most common type: {kind}.", lang, {
          kind: t([...WARNING_TYPES, OTHER].find(([k]) => k === top[0])![1], lang),
        }),
      ].filter(Boolean)
    : [];
  const heading = t("Official weather warnings across India now", lang);
  const head = pageHead(heading, {
    extra:
      (summary.length ? `<p class="t-lead">${esc(summary.join(" "))}</p>` : "") +
      (snap ? stamps([stamp(t("As of", lang), `${esc(istTime(snap.generated_at))} · via SACHET`)]) : ""),
  });
  const statesPanel = byState.length
    ? band(
        panel(
          byState
            .map(
              ([st, ps]) =>
                `<section><h3 class="wgrp">${esc(st)}<span class="n">${ps.length}</span></h3>${placeTiles(
                  ps.map((p) => placeTile(lp(`/c/${p.slug}`, lang), p.name, true, lang)),
                )}</section>`,
            )
            .join(""),
          { title: t("Places under a warning now, by state", lang), icon: "pin", id: "states" },
        ),
      )
    : "";
  const body = wrap(
    band(head) +
      (alerts.length
        ? (plates ? band(plates) : "") + statesPanel + band(filters) + band(lists)
        : band(notice("empty", T("No active national alerts right now."), "list"))) +
      band(coloursPanel(lang)) +
      band(sourcesPanel(lang)) +
      band(backLink(lp("/", lang), `← ${t("back to mugilu", lang)}`)),
  );
  // The snippet is the warnings in one line, as long as it fits; else what the page holds.
  const desc =
    [summary.join(" "), summary.slice(0, 2).join(" ")].find((d) => d && d.length <= DESCRIPTION_MAX) ??
    t(
      "Active NDMA / IMD warnings across India right now, mirrored from the SACHET feed. Available as HTML, JSON and Markdown.",
      lang,
    );
  // schema.org Dataset: the official feed as mugilu mirrors it, credited to NDMA/IMD.
  const url = `${SITE}${lp("/warnings", lang)}`;
  const dataset = ld({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        name: t("Active official warnings in India", lang),
        description: desc,
        url,
        inLanguage: lang,
        isAccessibleForFree: true,
        creator: { "@type": "Organization", name: "mugilu", url: SITE },
        creditText: SOURCE_CREDIT.sachet,
        isBasedOn: "https://sachet.ndma.gov.in",
        license: `${SITE}/terms`,
        temporalCoverage: snap?.generated_at,
        spatialCoverage: { "@type": "Place", name: "India" },
        distribution: [
          { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/warnings.json` },
          { "@type": "DataDownload", encodingFormat: "text/markdown", contentUrl: `${SITE}/warnings.md` },
        ],
      },
      breadcrumb([heading, url]),
    ],
  });
  return pageShell(`${t("Weather warnings in India today: IMD and NDMA alerts by state", lang)} | mugilu`, body, {
    path: "/warnings",
    desc,
    jsonLd: dataset,
    canonical: `${SITE}/warnings`,
    ogImage: HOME_OG,
    lang,
    // Any official warning active washes the page in the warning hue at high; none, no wash.
    tint: alerts.length ? { hue: "Warning", level: "high" } : undefined,
    js: alerts.length ? WARNINGS_JS : "",
  });
}
