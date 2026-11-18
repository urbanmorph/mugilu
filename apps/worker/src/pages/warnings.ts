import { DESKTOP } from "../ui/standard";
import { cycloneIn, type WarningsSnapshot } from "../sachet";
import { esc } from "../html";
import { langAttr, lp, t, type Lang } from "../i18n";
import { isHttpUrl } from "./read";
import { HOME_OG, SITE } from "../ui/shell";
import { istTime } from "../ist";
import { pageShell } from "../ui/page-shell";
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

export function renderWarningsPage(snap: WarningsSnapshot | null, lang: Lang = "en"): string {
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
          title: name,
          icon: "cyclone",
          body: `<p${langAttr(r.a.headline, lang)}>${esc(r.a.headline)}</p>`,
          label: name,
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

  const head = pageHead(t("Active warnings", lang), {
    extra:
      `<p class="t-lead">${T("The latest {n} official NDMA / IMD alerts across India.").replace("{n}", String(alerts.length))}</p>` +
      (snap ? stamps([stamp(t("As of", lang), `${esc(istTime(snap.generated_at))} · via SACHET`)]) : ""),
  });
  const body = wrap(
    band(head) +
      (alerts.length
        ? (plates ? band(plates) : "") + band(filters) + band(lists)
        : band(notice("empty", T("No active national alerts right now."), "list"))) +
      band(
        `<p class="t-meta">${T("mugilu mirrors the SACHET feed and keeps an archive of every alert.")}</p>` +
          backLink(lp("/", lang), `← ${t("back to mugilu", lang)}`),
      ),
  );
  return pageShell(`${t("Active warnings", lang)}: mugilu`, body, {
    path: "/warnings",
    desc: t(
      "Active NDMA / IMD warnings across India right now, mirrored from the SACHET feed. Available as HTML, JSON and Markdown.",
      lang,
    ),
    canonical: `${SITE}/warnings`,
    ogImage: HOME_OG,
    lang,
    // Any official warning active washes the page in the warning hue at high; none, no wash.
    tint: alerts.length ? { hue: "Warning", level: "high" } : undefined,
    js: alerts.length ? WARNINGS_JS : "",
  });
}
