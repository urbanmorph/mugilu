import { INSTALL_JS } from "../install";
import { SW_REGISTER } from "../sw";
import { esc } from "../html";
import type { Lang } from "../i18n";
import { FRESHEN_JS, PULL_MARKER } from "../freshen";
import type { RiskBand } from "../score";
import { VIEWPORT, headTags, relTimeJs, type ShellOpts } from "./shell";
import { LATIN_FONT } from "./fonts";
import { TOKENS_CSS } from "./tokens";
import { STANDARD_CSS } from "./standard";
import { SITE_CSS_LINK, fnv1a, purgeCss } from "./assets";
import { MENU_JS, siteFooter, siteHeader, THEME_HEAD_JS, THEME_JS } from "./components";

// The signage page shell (design standard). Every page links the one site stylesheet
// (fonts, tokens, components: ui/assets.ts) and composes components; no page carries CSS
// of its own. The embed card is the exception: it inlines only the rules its markup uses.
// Landmarks: skip link, header, one <main id="main">, footer. The body is the token root:
// <body class="mg" data-tint data-level> (the wash from read.ts readTint).

const FONT_PRELOAD = `<link rel="preload" href="${LATIN_FONT}" as="font" type="font/woff2" crossorigin>`;

/** In another site's iframe the card marks <html class="framed"> and fills the frame. */
const FRAMED_JS = "if(window.self!==window.top)document.documentElement.classList.add('framed');";

/** The embed card's CSS, cut to its markup's classes (and the class FRAMED_JS sets);
 *  memoised by that class list. */
const embedCss = new Map<string, string>();
function embedStyle(html: string): string {
  const key = [...new Set(html.match(/class="[^"]*"/g) ?? [])].sort().join("|");
  let css = embedCss.get(key);
  if (css === undefined) embedCss.set(key, (css = purgeCss(TOKENS_CSS + STANDARD_CSS, html, ["framed"])));
  return `<style>${css}</style>`;
}

export interface PageOpts extends ShellOpts {
  /** The page's language-agnostic path: the current nav item and the language links. */
  path: string;
  /** A query the language links keep (the persona, ?as=asthma). */
  query?: string;
  /** The page wash: the hazard's hue and the read's level. None: no wash. */
  tint?: { hue: string; level: RiskBand };
  /** "page" (default): the site's chrome. "kiosk": the screen display, always dark, no header or
   *  footer (its own footer carries the disclaimer). "embed": the card in other sites' iframes,
   *  no chrome, analytics beacon or service worker; light or dark follows the host's system. */
  variant?: Variant;
  /** A page that shows the sky now: it refreshes itself, and the installed app pulls to refresh. */
  live?: boolean;
  /** Page behaviour (never styles), appended after the shared scripts, and its name in the
   *  script registry (scripts.ts), which rebuilds the same file from the URL. */
  script?: PageScript;
}

/** A page's own script and its registry key (a name, or name.arg such as display.asthma). */
export interface PageScript {
  key: string;
  js: string;
}

export type Variant = "page" | "kiosk" | "embed";

/** All of a page's scripts in one: the shared ones for its variant and language, then its own. */
export function shellScript(variant: Variant, lang: Lang, live: boolean, js: string): string {
  return (
    (variant === "page" ? MENU_JS + INSTALL_JS + THEME_JS + SW_REGISTER : "") +
    (variant === "embed" ? FRAMED_JS : relTimeJs(lang)) +
    (live ? FRESHEN_JS : "") +
    js
  );
}

/** Where a page's script is served: everything the registry needs to rebuild it, then a hash
 *  of its content, so the file is cached for a year and a deploy that changes it gets a new path. */
export const scriptPath = (lang: Lang, variant: Variant, live: boolean, key: string, full: string) =>
  `/assets/js/${lang}/${variant}/${live ? 1 : 0}/${key}-${fnv1a(full)}.js`;

export function pageShell(title: string, body: string, opts: PageOpts): string {
  const { path, query = "", lang = "en", tint, variant = "page", live = false, script } = opts;
  const page = variant === "page";
  const wash = tint ? ` data-tint="${esc(tint.hue)}" data-level="${tint.level}"` : "";
  const bodyAttrs = variant === "kiosk" ? " data-kiosk" : variant === "embed" ? ` data-embed${wash}` : wash;
  const head =
    variant === "embed"
      ? `<meta charset="utf-8">${VIEWPORT}<meta name="color-scheme" content="light dark">\n<title>${esc(title)}</title>`
      : headTags(title, opts);
  // One script file per page kind and language (W20: no inline script but the theme's, so the
  // CSP can restrict scripts); at the end of the body, where the inline one ran.
  const scripts = shellScript(variant, lang, live, script?.js ?? "");
  const src = scripts ? scriptPath(lang, variant, live, script?.key ?? "base", scripts) : "";
  const embed = variant === "embed";
  const content = `<body class="mg"${bodyAttrs}>
${page ? siteHeader(path, lang, query) : ""}<main id="main"${embed ? "" : ' tabindex="-1"'}>${body}</main>${page ? siteFooter(path, lang, "", query) : ""}${live ? PULL_MARKER : ""}`;
  return `<!doctype html>
<html lang="${lang}"${variant === "kiosk" ? ' data-theme="dark"' : ""}>
<head>
${head}
${embed ? "" : FONT_PRELOAD}
${page ? `<script>${THEME_HEAD_JS}</script>` : ""}
${embed ? embedStyle(content) : SITE_CSS_LINK}
</head>
${content}
${src ? `<script src="${src}"></script>` : ""}
</body>
</html>`;
}
