import { FONT_FACES } from "./fonts";
import { TOKENS_CSS } from "./tokens";
import { STANDARD_CSS } from "./standard";

// The site stylesheet as one cached file: the fonts, the tokens and the standard's
// components. Its path carries a hash of its content, so it is cached for a year and a
// new deploy gets a new path. Every page links it (the browser keeps it across pages and
// visits), instead of carrying ~46 KB of CSS in each response.

export const SITE_CSS = FONT_FACES + TOKENS_CSS + STANDARD_CSS;

/** FNV-1a, 32-bit: a stable, synchronous content hash for the file name (not for security). */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const SITE_CSS_PATH = `/assets/site-${fnv1a(SITE_CSS)}.css`;
export const SITE_CSS_LINK = `<link rel="stylesheet" href="${SITE_CSS_PATH}">`;

const OLD_SITE_CSS = /^\/assets\/site-[0-9a-z]+\.css$/;
const css = (cacheControl: string) =>
  new Response(SITE_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": cacheControl } });

/** /assets/site-<hash>.css. The current hash is immutable; an older one (a page cached before
 *  a deploy) gets the current file for five minutes rather than a page with no styles. */
export function assetResponse(path: string): Response | undefined {
  if (path === SITE_CSS_PATH) return css("public, max-age=31536000, immutable");
  if (OLD_SITE_CSS.test(path)) return css("public, max-age=300");
  return undefined;
}

/** The top-level blocks of a stylesheet: a rule, or an at-rule with its own blocks inside. */
function blocks(src: string): { head: string; body: string }[] {
  const out: { head: string; body: string }[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    let depth = 1;
    let j = open + 1;
    for (; j < src.length && depth; j++) depth += src[j] === "{" ? 1 : src[j] === "}" ? -1 : 0;
    out.push({ head: src.slice(i, open).trim(), body: src.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

/** Whether a selector list can match `html`: some selector whose every class, attribute
 *  ([data-x] or [data-x="v"]) and :lang() appears in it. Parts inside :not() and the theme
 *  attribute (set on <html> by the host's system or the switch) are not required. */
function used(selectors: string, classes: Set<string>, html: string): boolean {
  return selectors.split(",").some((sel) => {
    const need = sel.replace(/:not\([^)]*\)/g, "");
    if (!(need.match(/\.[\w-]+/g) ?? []).every((c) => classes.has(c.slice(1)))) return false;
    for (const [, attr, val] of need.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (attr === "data-theme") continue;
      if (!html.includes(val === undefined ? ` ${attr}` : `${attr}="${val}"`)) return false;
    }
    return [...need.matchAll(/:lang\(([\w-]+)\)/g)].every(([, l]) => html.includes(`lang="${l}"`));
  });
}

/** `css` cut down to the rules `html` can use, without @font-face (the system face stands in).
 *  `scripted`: classes the page's own script adds, kept as if the markup carried them.
 *  For the embed card, which goes into other sites' pages and should stay small. */
export function purgeCss(css: string, html: string, scripted: string[] = []): string {
  const classes = new Set([
    ...scripted,
    ...(html.match(/class="([^"]*)"/g) ?? []).flatMap((m) => m.slice(7, -1).split(/\s+/)),
  ]);
  const walk = (src: string): string =>
    blocks(src)
      .map(({ head, body }) => {
        if (head.startsWith("@font-face")) return "";
        if (head.startsWith("@media") || head.startsWith("@supports")) {
          const inner = walk(body);
          return inner ? `${head}{${inner}}` : "";
        }
        if (head.startsWith("@")) return `${head}{${body}}`;
        return used(head, classes, html) ? `${head}{${body}}` : "";
      })
      .join("");
  return walk(css);
}
