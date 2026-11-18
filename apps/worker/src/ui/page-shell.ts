import { INSTALL_JS } from "../install";
import { SW_REGISTER } from "../sw";
import { esc } from "../html";
import type { Lang } from "../i18n";
import type { RiskBand } from "../score";
import { VIEWPORT, headTags, relTimeJs, type ShellOpts } from "./shell";
import { tokensCss } from "./tokens";
import { STANDARD_CSS } from "./standard";
import { SEGMENTED_JS, siteFooter, siteHeader, THEME_HEAD_JS, THEME_JS } from "./components";

// The signage page shell (design standard). Every page loads exactly two stylesheets,
// tokens then components, and composes components; no page carries CSS of its own.
// Landmarks: skip link, header, one <main id="main">, footer. The body is the token root:
// <body class="mg" data-tint data-level> (the wash from palette.ts tintOf).

/** A non-Latin script a page shows besides its UI language (warnings carry Telugu, Bengali). */
export type Script = "hi" | "kn" | "te" | "bn";
// Non-Latin text is never condensed (tokens: font-stretch 100% under :lang), so its fonts load the
// weight axis alone: about a third of the bytes (Devanagari 298 KB against 826 KB with width).
const FONT: Record<Script, string> = {
  hi: "Anek+Devanagari:wght@400..800",
  kn: "Anek+Kannada:wght@400..800",
  te: "Anek+Telugu:wght@400..800",
  bn: "Anek+Bangla:wght@400..800",
};

export interface PageOpts extends Omit<ShellOpts, "bare" | "wide"> {
  /** The page's language-agnostic path: the current nav item and the language links. */
  path: string;
  /** The page wash: the hazard's hue and the read's level. None: no wash. */
  tint?: { hue: string; level: RiskBand };
  /** Scripts the page shows besides its UI language (fonts are loaded for those only). */
  scripts?: Script[];
  /** The screen display: always dark, no header or footer (its own footer carries the disclaimer). */
  kiosk?: boolean;
  /** Page behaviour (never styles), appended after the shared scripts. */
  js?: string;
}

function fontsLink(lang: Lang, scripts: Script[] = []): string {
  const want = new Set<Script>(scripts);
  if (lang !== "en") want.add(lang);
  const css = (fams: string[], display: string) =>
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&amp;")}&amp;display=${display}">`;
  // Latin swaps in (small, and the condensed headings need it). The Indic families are larger
  // and their headline is the page's largest paint, so a first view keeps the system face
  // rather than repainting late (optional); the next view has Anek from the cache.
  return (
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    css(["Anek+Latin:wdth,wght@75..100,400..800"], "swap") +
    (want.size
      ? css(
          [...want].map((s) => FONT[s]),
          "optional",
        )
      : "")
  );
}

export function pageShell(title: string, body: string, opts: PageOpts): string {
  const { path, lang = "en", tint, scripts, kiosk, js = "" } = opts;
  const bodyAttrs = kiosk ? " data-kiosk" : tint ? ` data-tint="${esc(tint.hue)}" data-level="${tint.level}"` : "";
  return `<!doctype html>
<html lang="${lang}"${kiosk ? ' data-theme="dark"' : ""}>
<head>
${headTags(title, opts)}
${fontsLink(lang, scripts)}
${kiosk ? "" : `<script>${THEME_HEAD_JS}</script>`}
<style>${tokensCss()}${STANDARD_CSS}</style>
</head>
<body class="mg"${bodyAttrs}>
${kiosk ? "" : siteHeader(path, lang)}<main id="main" tabindex="-1">${body}</main>${kiosk ? "" : siteFooter(path, lang)}
<script>${kiosk ? "" : INSTALL_JS + THEME_JS + SEGMENTED_JS + SW_REGISTER}${relTimeJs(lang)}${js}</script>
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
${fontsLink(o.lang)}
<style>${tokensCss()}${STANDARD_CSS}</style>
</head>
<body class="mg" data-embed data-tint="${esc(o.tint.hue)}" data-level="${o.tint.level}"><main id="main">${body}</main>${o.js ? `<script>${o.js}</script>` : ""}</body>
</html>`;
}
