import { TR, lp, t, type Lang } from "../i18n";
import { esc, trusted, type Html } from "../html";
import { sheet, type SheetSection } from "../ui/components";
import { pageShell, type Script } from "../ui/page-shell";
import { HOME_OG, SITE } from "../ui/shell";

// The text pages (about, how it works, terms, MCP) share one frame: the Sheet component,
// numbered sections in boxes. Their prose is the live text, whole sentences only. Where a
// live paragraph is laid out over several boxes it is split at sentence ends at render time,
// the translation alike, so each language keeps the one reviewed paragraph (no new keys).

/** A paragraph's sentences. A full stop inside brackets (a quoted example) does not end one. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && ".?!।".includes(c) && /\s/.test(text[i + 1] ?? "") && text[i + 2] !== undefined) {
      out.push(text.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** The sentences of a live paragraph in the page's language: English from its markup
 *  version, others from the translation of `key`. Null when they do not split into `n`
 *  (the caller then shows the paragraph whole). */
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

/** A paragraph. */
export const P = (html: string) => `<p>${html}</p>`;

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
  scripts?: Script[];
  /** The canonical URL when it is not SITE + path (the MCP page is the endpoint). */
  canonical?: string;
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
  return pageShell(o.title, body, {
    path: o.path,
    lang: o.lang,
    desc: o.desc,
    canonical: o.canonical ?? `${SITE}${o.path}`,
    jsonLd: o.jsonLd,
    ogImage: HOME_OG,
    scripts: o.scripts,
  });
}

/** A title set on two lines after its first comma (the About title), in any language whose
 *  translation keeps the comma; otherwise the plain title. */
export function lineBreakAfterComma(title: string): string | Html {
  const i = title.indexOf(",");
  return i < 0 ? title : trusted(`${esc(title.slice(0, i + 1))}<br>${esc(title.slice(i + 1).trim())}`);
}
