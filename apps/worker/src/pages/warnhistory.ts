import { esc } from "../html";
import { langAttr, lp, t, type Lang } from "../i18n";
import { istDay, istTime } from "../ist";
import { colourWord, pastWarningsText, say } from "../phrases";
import { localName, titleName, type SlugPlace } from "../slugs";
import { band, linkRow, pageHead, panel, wrap } from "../ui/components";
import { pageShell } from "../ui/page-shell";
import { breadcrumb, ld, SITE } from "../ui/shell";
import { HISTORY_FROM, type PastAlert } from "../warnhistory";

// A place's full list of past warnings (/c/{slug}/warnings). The place page shows the last few;
// the whole list is long (hundreds of IMD nowcasts, worded alike for every district near by), so
// it has a page of its own, kept out of search.

/** How many past warnings the place page itself lists. */
export const RECENT_WARNINGS = 5;

/** One past warning: when, until when, its colour and office, then its words as issued. */
export const pastAlertItem = (a: PastAlert, lang: Lang): string =>
  `<li><p class="t-meta">${[
    istTime(a.from),
    a.until && t("until X", lang).replace("X", istTime(a.until)),
    colourWord(a.colour, lang),
    a.office,
  ]
    .filter(Boolean)
    .map(esc)
    .join(" · ")}</p><p${langAttr(a.headline, lang)}>${esc(a.headline)}</p></li>`;

/** The list of past warnings, newest first. */
export const pastAlertList = (list: PastAlert[], lang: Lang): string =>
  `<ul class="wlist">${list.map((a) => pastAlertItem(a, lang)).join("")}</ul>`;

/** The page: the days sentence, then every alert. */
export function renderWarningHistoryPage(place: SlugPlace, past: PastAlert[], lang: Lang): string {
  const name = localName(place, lang);
  const since = istDay(HISTORY_FROM);
  const title = say("warn.page.title", lang, { place: name, since });
  const path = `/c/${place.slug}/warnings`;
  const back = linkRow([[lp(`/c/${place.slug}`, lang), `← ${name}`]], "t-meta back");
  const body =
    band(pageHead(title, { extra: `<p class="t-lead">${esc(pastWarningsText(past, name, lang))}</p>` })) +
    (past.length
      ? band(
          panel(pastAlertList(past, lang), {
            title: say("warn.past.each", lang, { since }),
            icon: "warn",
            tag: "section",
            count: past.length,
          }),
        )
      : "") +
    band(back);
  return pageShell(`${title}${name !== place.name ? ` | ${titleName(place)}` : ""} | mugilu`, wrap(body), {
    path,
    lang,
    desc: pastWarningsText(past, titleName(place), lang),
    noindex: true,
    canonical: `${SITE}${path}`,
    jsonLd: ld({
      "@context": "https://schema.org",
      "@graph": [breadcrumb([place.name, `${SITE}/c/${place.slug}`], [title, `${SITE}${path}`])],
    }),
  });
}
