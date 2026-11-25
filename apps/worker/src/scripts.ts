// Every page's script as a file (W20). A page links /assets/js/<lang>/<variant>/<live>/<key>-<hash>.js;
// this rebuilds that file from the path alone, so any isolate can serve any page's script. The
// pages build their scripts from the same functions (test/scripts.test.ts fetches every page's
// file and checks it comes back immutable, i.e. rebuilt to the same content).
import { LANGS, type Lang } from "./i18n";
import { PERSONAS, type Persona } from "./score";
import { scriptPath, shellScript, type Variant } from "./ui/page-shell";
import { fnv1a } from "./ui/assets";
import { comboboxJs } from "./ui/components";
import { ALERTS_JS } from "./alerts-ui";
import { PLACE_RECORDER } from "./pages/read";
import { homeJs } from "./pages/home";
import { placesJs } from "./pages/places";
import { WARNINGS_JS } from "./pages/warnings";
import { kioskJs } from "./pages/kiosk";
import { displayPageJs } from "./pages/display";

const PAGE: Record<string, (lang: Lang, arg?: string) => string | undefined> = {
  base: () => "",
  home: homeJs,
  places: placesJs,
  warnings: () => WARNINGS_JS,
  place: () => PLACE_RECORDER,
  "place.alerts": () => PLACE_RECORDER + ALERTS_JS,
  notfound: (lang) => comboboxJs("nq", lang),
  kiosk: kioskJs,
  display: (lang, persona) =>
    PERSONAS.includes(persona as Persona) ? displayPageJs(persona as Persona, lang) : undefined,
};

// The home page prerenders the first of "Your places" (the place opened most recently), so it
// opens at once. A document rule in a file, linked by the Speculation-Rules header: an inline
// <script type="speculationrules"> added by script is reported by the CSP even with
// 'inline-speculation-rules' (Chrome 158). The browser re-reads the rule as the list changes.
const SPECULATION = JSON.stringify({
  prerender: [{ source: "document", where: { selector_matches: "#yp ul.yp li:first-child a" }, eagerness: "eager" }],
});
export const SPECULATION_PATH = `/assets/speculation-${fnv1a(SPECULATION)}.json`;

const PATH = /^\/assets\/js\/([a-z]+)\/(page|kiosk|embed)\/([01])\/([a-z.]+)-([0-9a-z]+)\.js$/;

const js = (body: string, cacheControl: string) =>
  new Response(body, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": cacheControl } });

/** A page's script file, rebuilt from its path. The current hash is immutable; an older one (a
 *  page cached before a deploy) gets the current file for five minutes rather than no script. */
export function scriptResponse(path: string): Response | undefined {
  if (path === SPECULATION_PATH)
    return new Response(SPECULATION, {
      headers: {
        "content-type": "application/speculationrules+json",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  const s = build(path);
  if (!s) return undefined;
  return js(s.full, s.current ? "public, max-age=31536000, immutable" : "public, max-age=300");
}

/** The current content of a page's script file (tests read a page's behaviour through it). */
export const scriptText = (path: string): string | undefined => build(path)?.full;

function build(path: string): { full: string; current: boolean } | undefined {
  const m = PATH.exec(path);
  if (!m || !(LANGS as readonly string[]).includes(m[1])) return undefined;
  const [, lang, variant, live, key] = m as unknown as [string, Lang, Variant, string, string];
  const [name, arg] = key in PAGE ? [key, undefined] : key.split(/\.(.*)/s);
  const own = PAGE[name]?.(lang, arg);
  if (own === undefined) return undefined;
  const full = shellScript(variant, lang, live === "1", own);
  return { full, current: scriptPath(lang, variant, live === "1", key, full) === path };
}
