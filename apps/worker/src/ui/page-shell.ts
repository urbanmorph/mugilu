import { INSTALL_JS } from "../install";
import { SW_REGISTER } from "../sw";
import { esc } from "../html";
import type { Lang } from "../i18n";
import type { RiskBand } from "../score";
import { VIEWPORT, headTags, relTimeJs, type ShellOpts } from "./shell";
import { FONT_FACES, LATIN_FONT } from "./fonts";
import { tokensCss } from "./tokens";
import { STANDARD_CSS } from "./standard";
import { siteFooter, siteHeader, THEME_HEAD_JS, THEME_JS } from "./components";

// The signage page shell (design standard). Every page loads exactly two stylesheets,
// tokens then components, and composes components; no page carries CSS of its own.
// Landmarks: skip link, header, one <main id="main">, footer. The body is the token root:
// <body class="mg" data-tint data-level> (the wash from palette.ts tintOf).

const FONT_PRELOAD = `<link rel="preload" href="${LATIN_FONT}" as="font" type="font/woff2" crossorigin>`;

export interface PageOpts extends Omit<ShellOpts, "bare" | "wide"> {
  /** The page's language-agnostic path: the current nav item and the language links. */
  path: string;
  /** A query the language links keep (the persona, ?as=asthma). */
  query?: string;
  /** The page wash: the hazard's hue and the read's level. None: no wash. */
  tint?: { hue: string; level: RiskBand };
  /** The screen display: always dark, no header or footer (its own footer carries the disclaimer). */
  kiosk?: boolean;
  /** Page behaviour (never styles), appended after the shared scripts. */
  js?: string;
}

export function pageShell(title: string, body: string, opts: PageOpts): string {
  const { path, query = "", lang = "en", tint, kiosk, js = "" } = opts;
  const bodyAttrs = kiosk ? " data-kiosk" : tint ? ` data-tint="${esc(tint.hue)}" data-level="${tint.level}"` : "";
  return `<!doctype html>
<html lang="${lang}"${kiosk ? ' data-theme="dark"' : ""}>
<head>
${headTags(title, opts)}
${FONT_PRELOAD}
${kiosk ? "" : `<script>${THEME_HEAD_JS}</script>`}
<style>${FONT_FACES}${tokensCss()}${STANDARD_CSS}</style>
</head>
<body class="mg"${bodyAttrs}>
${kiosk ? "" : siteHeader(path, lang, query)}<main id="main" tabindex="-1">${body}</main>${kiosk ? "" : siteFooter(path, lang, "", query)}
<script>${kiosk ? "" : INSTALL_JS + THEME_JS + SW_REGISTER}${relTimeJs(lang)}${js}</script>
</body>
</html>`;
}

// ── phase2b: the embed card's document ───────────────────────────────────────────────
/** The embed card's own document (it lives in other sites' iframes): the same two stylesheets
 *  and fonts, no header, footer, analytics beacon or service worker. Light or dark follows the
 *  host's system; the wash is the read's. */
export function embedShell(
  title: string,
  body: string,
  o: { lang: Lang; tint: { hue: string; level: RiskBand }; js?: string },
): string {
  return `<!doctype html>
<html lang="${o.lang}">
<head><meta charset="utf-8">${VIEWPORT}<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
${FONT_PRELOAD}
<style>${FONT_FACES}${tokensCss()}${STANDARD_CSS}</style>
</head>
<body class="mg" data-embed data-tint="${esc(o.tint.hue)}" data-level="${o.tint.level}"><main id="main">${body}</main>${o.js ? `<script>${o.js}</script>` : ""}</body>
</html>`;
}
