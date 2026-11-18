import { lp, type Lang } from "./i18n";
import type { Persona } from "./score";
import { slugForName } from "./slugs";

// The site's URL rules, one copy each: a place's page, a persona's view, a coordinate.

/** A coordinate as the site writes it in paths and keys: "28.61,77.21". */
export const coordKey = (loc: { lat: number; lon: number }): string => `${loc.lat},${loc.lon}`;

/** A place's page: its named /c/{slug} when it has one, else its coordinate, in the language. */
export function placeHref(name: string, loc: { lat: number; lon: number }, lang: Lang): string {
  const slug = slugForName(name);
  return lp(`/c/${slug ?? coordKey(loc)}`, lang);
}

/** A URL with the persona's view added (?as= or &as=); everyone needs nothing. */
export function withPersona(url: string, persona: Persona): string {
  return persona === "everyone" ? url : `${url}${url.includes("?") ? "&" : "?"}as=${persona}`;
}

/** The language's path prefix as a JS string literal, for page scripts ("" or "/hi"). */
export const langPrefixJs = (lang: Lang): string => JSON.stringify(lp("", lang).replace(/\/$/, ""));
