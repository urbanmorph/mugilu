import { TR, lp, t, type Lang } from "../i18n";
import { esc, trusted, type Html } from "../html";
import { sheet, type SheetSection } from "../ui/components";
import { pageShell } from "../ui/page-shell";
import { SITE } from "../ui/shell";
import { HOME_OG } from "../og-html";

// The text pages (about, how it works, terms, MCP) share one frame: the Sheet component,
// numbered sections in boxes. Their prose is the live text, whole sentences only. Where a
// live paragraph is laid out over several boxes it is split at sentence ends at render time,
// the translation alike, so each language keeps the one reviewed paragraph (no new keys).

/** Words whose full stop does not end a sentence. */
const ABBREVIATIONS = /(?:^|[\s(])(?:e\.g|i\.e|vs|Govt|Dept|Dr|Mr|Mrs|Ms)$/i;

/** A paragraph's sentences. A full stop inside brackets (a quoted example), after an
 *  abbreviation ("e.g.", "Govt.") or at the very end does not split it. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  const s = text.trim();
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && ".?!।".includes(c) && /\s/.test(s[i + 1] ?? "")) {
      if (c === "." && ABBREVIATIONS.test(s.slice(start, i))) continue;
      out.push(s.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = s.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** The live string in the page's language: in English with its markup (`en`), else the
 *  translation of `key` (translations carry no markup). */
export const marked = (key: string, lang: Lang, en: string = key): string => (lang === "en" ? en : t(key, lang));

/** Who makes mugilu, said one way on /about and /terms (the owner section). */
export const builtBy = (lang: Lang): string =>
  marked(
    "Built by urbanmorph, led by Sathya Sankaran.",
    lang,
    `Built by <a href="https://urbanmorph.com">urbanmorph</a>, led by <a href="https://www.sathyasankaran.com">Sathya Sankaran</a>.`,
  );

/** The sentences of a live paragraph in the page's language: English from its markup
 *  version, others from the translation of `key`. Null when they do not split into `n`. */
export function splitAs(
  enMarkup: string,
  key: string,
  lang: Lang,
  n: number,
  table: Record<string, Partial<Record<Lang, string>>> = TR,
): string[] | null {
  const text = lang === "en" ? enMarkup : (table[key]?.[lang] ?? enMarkup);
  const parts = sentences(text);
  return parts.length === n ? parts : null;
}

/** A live paragraph laid out over boxes: `layout` gets its `n` sentences; when the language's
 *  text does not split into `n`, the paragraph shows whole (`whole`, a paragraph by default). */
export function splitInto(
  enMarkup: string,
  key: string,
  lang: Lang,
  n: number,
  layout: (parts: string[]) => string,
  whole: (text: string) => string = P,
): string {
  const parts = splitAs(enMarkup, key, lang, n);
  return parts ? layout(parts) : whole(marked(key, lang, enMarkup));
}

/** urbanmorph's list of its free, open tools, mugilu among them (it keeps the list current). */
export const TOOLS_URL = "https://urbanmorph.com/synthesys/#tools";

/** A paragraph. */
export function P(html: string): string {
  return `<p>${html}</p>`;
}

/** A translated heading that the live key writes with an entity (e.g. "Terms &amp; attribution"),
 *  as plain text for the Sheet, which escapes it. */
export const plain = (s: string) => s.replace(/&amp;/g, "&");

export interface TextPageOpts {
  path: string;
  lang: Lang;
  /** The <title>. */
  title: string;
  desc: string;
  jsonLd?: string;
  kicker: string;
  h1: string | Html;
  lead: string;
  lead2?: string;
  sections: SheetSection[];
  /** The canonical URL when it is not SITE + path (the MCP page is the endpoint). */
  canonical?: string;
  /** The language the page's content is written in, when it is not the page's (the MCP page
   *  is English in every language): the sheet is marked with it for screen readers. */
  contentLang?: Lang;
}

/** A text page: the Sheet in the signage shell, with the back link home. */
export function textPage(o: TextPageOpts): string {
  const body = sheet(
    {
      kicker: o.kicker,
      title: o.h1,
      lead: o.lead,
      lead2: o.lead2,
      sections: o.sections,
      back: { href: lp("/", o.lang), label: `← ${t("back to mugilu", o.lang)}` },
    },
    o.lang,
  );
  const marked = o.contentLang && o.contentLang !== o.lang ? `<div lang="${o.contentLang}">${body}</div>` : body;
  return pageShell(o.title, marked, {
    path: o.path,
    lang: o.lang,
    desc: o.desc,
    canonical: o.canonical ?? `${SITE}${o.path}`,
    jsonLd: o.jsonLd,
    ogImage: HOME_OG,
  });
}

/** A title set on two lines after its first comma (the About title), in any language whose
 *  translation keeps the comma; otherwise the plain title. */
export function lineBreakAfterComma(title: string): string | Html {
  const i = title.indexOf(",");
  return i < 0 ? title : trusted(`${esc(title.slice(0, i + 1))}<br>${esc(title.slice(i + 1).trim())}`);
}
