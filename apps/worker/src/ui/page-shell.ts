import { INSTALL_JS } from "../install";
import { SW_REGISTER } from "../sw";
import { esc } from "../html";
import { FRESHEN_JS, PULL_MARKER } from "../freshen";
import type { Lang } from "../i18n";
import type { RiskBand } from "../score";
import { VIEWPORT, headTags, relTimeJs, type ShellOpts } from "./shell";
import { FONT_FACES, LATIN_FONT } from "./fonts";
import { TOKENS_CSS } from "./tokens";
import { STANDARD_CSS } from "./standard";
import { siteFooter, siteHeader, THEME_HEAD_JS, THEME_JS } from "./components";

// The signage page shell (design standard). Every page loads exactly two stylesheets,
// tokens then components, and composes components; no page carries CSS of its own.
// Landmarks: skip link, header, one <main id="main">, footer. The body is the token root:
// <body class="mg" data-tint data-level> (the wash from read.ts readTint).

const FONT_PRELOAD = `<link rel="preload" href="${LATIN_FONT}" as="font" type="font/woff2" crossorigin>`;
const STYLES = `<style>${FONT_FACES}${TOKENS_CSS}${STANDARD_CSS}</style>`;

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
  variant?: "page" | "kiosk" | "embed";
  /** A page that shows the sky now: it refreshes itself, and the installed app pulls to refresh. */
  live?: boolean;
  /** Page behaviour (never styles), appended after the shared scripts. */
  js?: string;
}

export function pageShell(title: string, body: string, opts: PageOpts): string {
  const { path, query = "", lang = "en", tint, variant = "page", live, js = "" } = opts;
  const page = variant === "page";
  const wash = tint ? ` data-tint="${esc(tint.hue)}" data-level="${tint.level}"` : "";
  const bodyAttrs = variant === "kiosk" ? " data-kiosk" : variant === "embed" ? ` data-embed${wash}` : wash;
  const head =
    variant === "embed"
      ? `<meta charset="utf-8">${VIEWPORT}<meta name="color-scheme" content="light dark">\n<title>${esc(title)}</title>`
      : headTags(title, opts);
  const scripts =
    (page ? INSTALL_JS + THEME_JS + SW_REGISTER : "") +
    (variant === "embed" ? "" : relTimeJs(lang)) +
    (live ? FRESHEN_JS : "") +
    js;
  return `<!doctype html>
<html lang="${lang}"${variant === "kiosk" ? ' data-theme="dark"' : ""}>
<head>
${head}
${FONT_PRELOAD}
${page ? `<script>${THEME_HEAD_JS}</script>` : ""}
${STYLES}
</head>
<body class="mg"${bodyAttrs}>
${page ? siteHeader(path, lang, query) : ""}<main id="main"${variant === "embed" ? "" : ' tabindex="-1"'}>${body}</main>${page ? siteFooter(path, lang, "", query) : ""}${live ? PULL_MARKER : ""}
${scripts ? `<script>${scripts}</script>` : ""}
</body>
</html>`;
}
