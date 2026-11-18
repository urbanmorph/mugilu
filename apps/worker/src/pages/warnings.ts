import { type WarningsSnapshot } from "../sachet";
import { esc } from "../html";
import { lp, t, type Lang } from "../i18n";
import { isHttpUrl } from "./read";
import { HOME_OG, SITE, istTime } from "../ui/shell";
import { pageShell, type Script } from "../ui/page-shell";
import {
  backLink,
  checkGroup,
  filterBar,
  fold,
  ico,
  notice,
  stamp,
  stamps,
  warningPlate,
  warningRow,
  wrap,
  band,
  type IconName,
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
// English, Hindi, Kannada, Bengali and Telugu: the offices write in all of them. A sea-wave
// alert with no hazard word stays under Other, as its English equivalent does.
export const WARNING_TYPES: [key: string, label: string, re: RegExp, icon: IconName][] = [
  ["avalanche", "Avalanche", /avalanche|हिमस्खलन|ಹಿಮಕುಸಿತ|তুষারধস|హిమపాతం/i, "snow"],
  [
    "storm",
    "Thunderstorm, lightning",
    /thunder|lightning|squall|hail|गरज|बिजली|वज्रपात|आंधी|ಗುಡುಗು|ಸಿಡಿಲು|ಮಿಂಚು|বজ্র|বিদ্যুৎ চমকা|ঝড়|ఉరుము|పిడుగు|మెరుపు/i,
    "storm",
  ],
  ["flood", "Flood, river level", /flood|river|danger level|water level|बाढ़|नदी|ಪ್ರವಾಹ|বন্যা|నదీ|వరద/i, "flood"],
  ["rain", "Rain, snow", /rain|snow|वर्षा|बारिश|ಮಳೆ|বৃষ্টি|వర్ష/i, "rain"],
  ["wind", "Wind, cyclone", /wind|gale|cyclone|dust storm|हवा|चक्रवात|ಗಾಳಿ|ಚಂಡಮಾರುತ|ঘূর্ণিঝড়|తుపాను|తుఫాను|గాలి/i, "wind"],
  ["heat", "Heat", /heat|hot|लू|गर्मी|ಬಿಸಿ|তাপপ্রবাহ|వడగాల్పు/i, "heat"],
  ["cold", "Cold, frost", /cold|frost|शीत|ठंड|ಚಳಿ|শৈত্যপ্রবাহ|చలి/i, "cold"],
  ["fog", "Fog", /fog|कोहरा|ಮಂಜು|কুয়াশা|పొగమంచు/i, "fog"],
];
const OTHER: [string, string, RegExp, IconName] = ["other", "Other", /$^/, "warn"];
const typeOf = (headline: string) => WARNING_TYPES.find(([, , re]) => re.test(headline)) ?? OTHER;

/** The kind of hazard a warning is about, from its headline ("other" when none matches). */
export function warningType(headline: string): string {
  return typeOf(headline)[0];
}

/** IMD's name for a storm, category and name together ("Severe Cyclonic Storm Akvan"), read
 *  from a warning's headline; undefined when it names no cyclonic storm. */
export function stormTitle(headline: string): string | undefined {
  const m = headline.match(
    /\b((?:super |extremely severe |very severe |severe )?cyclonic storm)\s+["'‘“]?([A-Za-z]{3,})["'’”]?/i,
  );
  if (!m || /^(with|over|near|is|lay|lays|has|in|of|and|centred)$/i.test(m[2])) return undefined;
  const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `${title(m[1])} ${title(m[2])}`;
}

/** The script a headline is written in, when it is not Latin (its lang and its font). */
function scriptOf(s: string): Script | undefined {
  if (/[ఀ-౿]/.test(s)) return "te";
  if (/[ঀ-৿]/.test(s)) return "bn";
  if (/[ಀ-೿]/.test(s)) return "kn";
  if (/[ऀ-ॿ]/.test(s)) return "hi";
  return undefined;
}

// Applies the filters: a warning stays when its kind and office are ticked and it holds the
// search text; an office's list hides when none of its warnings show. On wide screens the
// filters start open.
const WARNINGS_JS = `(function(){var f=document.getElementById('wfilter');if(!f)return;if(matchMedia('(min-width:1000px)').matches)f.open=true;
var q=document.getElementById('wq');function on(n){return [].slice.call(f.querySelectorAll('input[name='+n+']:checked')).map(function(i){return i.value})}
function go(){var ty=on('type'),of=on('issuer'),s=(q.value||'').trim().toLowerCase();
f.querySelectorAll('.check').forEach(function(l){l.classList.toggle('off',!l.querySelector('input').checked)});
document.querySelectorAll('main [data-type]').forEach(function(el){el.hidden=!(ty.indexOf(el.getAttribute('data-type'))>-1&&of.indexOf(el.getAttribute('data-issuer'))>-1&&(!s||el.textContent.toLowerCase().indexOf(s)>-1))});
document.querySelectorAll('.wsec').forEach(function(sec){sec.hidden=!sec.querySelector('[data-type]:not([hidden])')})}
f.addEventListener('change',go);q.addEventListener('input',go)})();`;

const when = (a: Alert) => Date.parse(a.sent) || 0;

export function renderWarningsPage(snap: WarningsSnapshot | null, lang: Lang = "en"): string {
  const T = (s: string) => esc(t(s, lang));
  // Newest first; a storm IMD names is pinned once (its newest warning), above the lists.
  const alerts = [...(snap?.alerts ?? [])].sort((x, y) => when(y) - when(x));
  const pinned = new Map<string, Alert>();
  for (const a of alerts) {
    const name = stormTitle(a.headline || "");
    if (name && !pinned.has(name)) pinned.set(name, a);
  }
  const isPinned = new Set(pinned.values());

  const meta = (a: Alert, office: string) => {
    const at = when(a) ? istTime(new Date(when(a)).toISOString()) : "";
    const cap = isHttpUrl(a.link)
      ? `<a href="${esc(a.link)}" rel="noopener" aria-label="${esc(t("Original alert (CAP): {issuer}, {time}", lang).replace("{issuer}", office).replace("{time}", at))}">CAP</a>`
      : "";
    return [at && esc(at), cap].filter(Boolean).join(" · ");
  };
  const scripts = new Set<Script>();
  const row = (a: Alert) => {
    const office = issuerName(a.issuer || "");
    const [type, label, , icon] = typeOf(a.headline || "");
    const script = scriptOf(a.headline || "");
    if (script) scripts.add(script);
    return warningRow({
      icon,
      kind: t(label, lang),
      head: a.headline || "Warning",
      headLang: script !== lang ? script : undefined,
      meta: meta(a, office),
      type,
      issuer: office,
    });
  };

  // Grouped by issuing office (a state SDMA or an IMD centre), the office with the newest
  // alert first; times in IST like every page.
  const groups = new Map<string, Alert[]>();
  for (const a of alerts.filter((a) => !isPinned.has(a))) {
    const k = issuerName(a.issuer || "");
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const lists = [...groups]
    .map(
      ([name, list]) =>
        `<section class="wsec"><h2 class="wgrp">${esc(name)}<span class="n">${list.length}</span></h2><ul>${list.map(row).join("")}</ul></section>`,
    )
    .join("");

  const plates = [...pinned]
    .map(([name, a]) => {
      const office = issuerName(a.issuer || "");
      const [type, label] = typeOf(a.headline || "");
      return `<div data-type="${type}" data-issuer="${esc(office)}">${warningPlate({
        bar: [`<span>${esc(t(label, lang))} · ${esc(office)}</span>`, `<span>${meta(a, office)}</span>`],
        title: name,
        icon: "cyclone",
        body: `<p>${esc(a.headline)}</p>`,
        label: name,
      })}</div>`;
    })
    .join("");

  const count = (key: (a: Alert) => string) => {
    const m = new Map<string, number>();
    for (const a of alerts) m.set(key(a), (m.get(key(a)) ?? 0) + 1);
    return m;
  };
  const types = count((a) => warningType(a.headline || ""));
  const offices = [...count((a) => issuerName(a.issuer || ""))].sort((x, y) => y[1] - x[1]);
  const filters = fold(
    t("Filter warnings", lang),
    filterBar(
      [
        `<div class="search"><label for="wq">${T("Find a place or district")}</label><div class="sbox">${ico("search")}<input type="search" id="wq" autocomplete="off"></div></div>`,
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

  const head =
    `<div class="ph"><h1 class="t-title">${T("Active warnings")}</h1>` +
    `<p class="t-lead">${T("The latest {n} official NDMA / IMD alerts across India.").replace("{n}", String(alerts.length))}</p>` +
    (snap ? stamps([stamp(t("As of", lang), `${esc(istTime(snap.generated_at))} · via SACHET`)]) : "") +
    `</div>`;
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
  return pageShell("Active warnings: mugilu", body, {
    path: "/warnings",
    desc: "Active NDMA / IMD warnings across India right now, mirrored from the SACHET feed. Available as HTML, JSON and Markdown.",
    canonical: `${SITE}/warnings`,
    ogImage: HOME_OG,
    lang,
    // Any official warning active washes the page in the warning hue at high; none, no wash.
    tint: alerts.length ? { hue: "Warning", level: "high" } : undefined,
    scripts: [...scripts],
    js: alerts.length ? WARNINGS_JS : "",
  });
}
