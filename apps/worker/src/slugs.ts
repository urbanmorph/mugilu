import centroids from "../data/centroids.json";
import placeNames from "../data/place-names.json";
import { haversineKm } from "./near";
import type { Centroid } from "./types";
import type { Lang } from "./i18n";

// Named place URLs for SEO + humans: /c/lucknow resolves to a district's centroid
// and serves the same conditions as /c/{lat},{lon}, but with a keyword URL that
// search engines (and people) can actually read. Built once from the district
// grid; ward-level points stay coordinate-only (intra-city, low search value).

const DISTRICTS = (centroids as Centroid[]).filter((c) => c.level === "district");

export interface SlugPlace {
  slug: string;
  name: string;
  state?: string;
  lat: number;
  lon: number;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Major cities get a clean, high-search-value slug at the city centre, because
// LGD district names don't match how people search ("Bengaluru Urban" → bengaluru,
// "Mumbai Suburban" → mumbai). These are seeded first and win over district slugs.
const CITY_SEEDS: SlugPlace[] = [
  { slug: "delhi", name: "Delhi", state: "Delhi", lat: 28.61, lon: 77.21 },
  { slug: "mumbai", name: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.877 },
  { slug: "bengaluru", name: "Bengaluru", state: "Karnataka", lat: 12.972, lon: 77.595 },
  { slug: "kolkata", name: "Kolkata", state: "West Bengal", lat: 22.572, lon: 88.363 },
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu", lat: 13.083, lon: 80.27 },
  { slug: "hyderabad", name: "Hyderabad", state: "Telangana", lat: 17.385, lon: 78.486 },
  { slug: "pune", name: "Pune", state: "Maharashtra", lat: 18.52, lon: 73.856 },
  { slug: "ahmedabad", name: "Ahmedabad", state: "Gujarat", lat: 23.022, lon: 72.571 },
  { slug: "jaipur", name: "Jaipur", state: "Rajasthan", lat: 26.912, lon: 75.787 },
  { slug: "lucknow", name: "Lucknow", state: "Uttar Pradesh", lat: 26.847, lon: 80.946 },
  { slug: "surat", name: "Surat", state: "Gujarat", lat: 21.17, lon: 72.831 },
  { slug: "kanpur", name: "Kanpur", state: "Uttar Pradesh", lat: 26.449, lon: 80.332 },
  { slug: "nagpur", name: "Nagpur", state: "Maharashtra", lat: 21.146, lon: 79.088 },
  { slug: "indore", name: "Indore", state: "Madhya Pradesh", lat: 22.72, lon: 75.858 },
  { slug: "bhopal", name: "Bhopal", state: "Madhya Pradesh", lat: 23.26, lon: 77.413 },
  { slug: "patna", name: "Patna", state: "Bihar", lat: 25.594, lon: 85.138 },
  { slug: "visakhapatnam", name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.687, lon: 83.219 },
  { slug: "vadodara", name: "Vadodara", state: "Gujarat", lat: 22.307, lon: 73.181 },
  { slug: "coimbatore", name: "Coimbatore", state: "Tamil Nadu", lat: 11.017, lon: 76.956 },
  { slug: "kochi", name: "Kochi", state: "Kerala", lat: 9.932, lon: 76.267 },
  { slug: "chandigarh", name: "Chandigarh", state: "Chandigarh", lat: 30.733, lon: 76.779 },
  { slug: "guwahati", name: "Guwahati", state: "Assam", lat: 26.144, lon: 91.736 },
  { slug: "bhubaneswar", name: "Bhubaneswar", state: "Odisha", lat: 20.296, lon: 85.825 },
  { slug: "thiruvananthapuram", name: "Thiruvananthapuram", state: "Kerala", lat: 8.524, lon: 76.936 },
  { slug: "ludhiana", name: "Ludhiana", state: "Punjab", lat: 30.901, lon: 75.857 },
];

// Build the slug -> place map: city seeds first (they win), then districts fill
// the long tail. A name shared by several districts (e.g. "Aurangabad" in both
// Maharashtra and Bihar) is disambiguated by appending the state.
const SLUGS = new Map<string, SlugPlace>();
{
  for (const c of CITY_SEEDS) SLUGS.set(c.slug, c);

  const byBare = new Map<string, Centroid[]>();
  for (const d of DISTRICTS) {
    const bare = slugify(d.name);
    if (!bare) continue;
    const list = byBare.get(bare);
    if (list) list.push(d);
    else byBare.set(bare, [d]);
  }
  const place = (slug: string, d: Centroid): SlugPlace => ({
    slug,
    name: d.name,
    state: d.state,
    lat: d.lat,
    lon: d.lon,
  });
  for (const [bare, list] of byBare) {
    if (list.length === 1) {
      if (!SLUGS.has(bare)) SLUGS.set(bare, place(bare, list[0]));
    } else {
      for (const d of list) {
        const slug = d.state ? `${bare}-${slugify(d.state)}` : bare;
        if (!SLUGS.has(slug)) SLUGS.set(slug, place(slug, d));
      }
    }
  }
}

/** Resolve a slug ("lucknow") to its place, or undefined. */
/** The slug (and optional .json/.md/.png) in a /c/{slug} path, or null. A slug may start with a digit
 *  ("24 Paraganas North" → 24-paraganas-north); a coordinate never matches, since it has a comma or a dot. */
export function slugFromPath(path: string): { slug: string; ext?: "json" | "md" | "png" } | null {
  const m = path.match(/^\/c\/([a-z0-9][a-z0-9-]*)(?:\.(json|md|png))?$/);
  return m ? { slug: m[1], ...(m[2] ? { ext: m[2] as "json" | "md" | "png" } : {}) } : null;
}

export function placeBySlug(slug: string): SlugPlace | undefined {
  return SLUGS.get(slug.toLowerCase());
}

// Each place's name in Hindi and Kannada, where it is the state's own language (and the major
// cities in both): scripts/build-place-names.ts, from Wikidata by LGD code. Elsewhere, Latin.
const NAMES = placeNames as Record<string, { hi?: string; kn?: string }>;

/** A place's name in the page's language: its native-script name when there is one, else Latin. */
export const localName = (p: Pick<SlugPlace, "slug" | "name">, lang: Lang): string =>
  (lang === "en" ? undefined : NAMES[p.slug]?.[lang]) ?? p.name;

/** A place's native-script names (for schema.org alternateName). */
export const nativeNames = (slug: string): string[] => Object.values(NAMES[slug] ?? {});

/** How a named place reads: "New Delhi, Delhi", but "Delhi" once when the state has its name. */
export function slugLabel(p: Pick<SlugPlace, "name" | "state">): string {
  return p.state && p.state !== p.name ? `${p.name}, ${p.state}` : p.name;
}

/** The name a page title uses: the short name, as people search it ("almora aqi"), with the
 *  state only where two districts share the name (their slug carries it). */
export const titleName = (p: SlugPlace): string => (p.slug === slugify(p.name) ? p.name : slugLabel(p));

// Districts whose LGD name (and so its slug, already in the sitemap and Search Console)
// differs from how people write it. Keyed by the slugified query, so case, spaces
// and hyphens ("North 24-Parganas") all match; the slugs themselves never change.
const SLUG_ALIASES: Record<string, string> = {
  "north-24-parganas": "24-paraganas-north",
  "north-24-paraganas": "24-paraganas-north",
  "24-parganas-north": "24-paraganas-north",
  "south-24-parganas": "24-paraganas-south",
  "south-24-paraganas": "24-paraganas-south",
  "24-parganas-south": "24-paraganas-south",
};

/** The slug for a place name, if it maps to exactly one known district. */
export function slugForName(name: string): string | undefined {
  const s = slugify(name);
  return SLUGS.has(s) ? s : SLUG_ALIASES[s];
}

/** The named place a query reaches only through an alias ("North 24 Parganas"), else
 *  undefined. Search offers it first, since the gazetteer knows no such spelling. */
export function placeByAlias(name: string): SlugPlace | undefined {
  const slug = SLUG_ALIASES[slugify(name)];
  return slug ? SLUGS.get(slug) : undefined;
}

/** Every named place (for the sitemap). */
export function allSlugPlaces(): SlugPlace[] {
  return [...SLUGS.values()];
}

/** Named places grouped by state (for the /places directory), states A→Z and
 *  places A→Z within each. The directory is the crawlable index that links every
 *  /c/{slug} page, so search engines have a path to them (not sitemap-only). */
let byStateMemo: { state: string; places: SlugPlace[] }[] | undefined;
export function slugPlacesByState(): { state: string; places: SlugPlace[] }[] {
  return (byStateMemo ??= groupByState());
}
function groupByState(): { state: string; places: SlugPlace[] }[] {
  const byState = new Map<string, SlugPlace[]>();
  for (const p of SLUGS.values()) {
    const st = p.state ?? "Other";
    const list = byState.get(st);
    if (list) list.push(p);
    else byState.set(st, [p]);
  }
  return [...byState.entries()]
    .map(([state, places]) => ({
      state,
      places: places.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.state.localeCompare(b.state));
}

/** A handful of other named places nearest to `slug`, in the same state. Rendered
 *  as cross-links on each conditions page so the named-place pages form a connected
 *  graph a crawler can walk, instead of ~800 orphans reachable only via the sitemap. */
export function siblingPlaces(slug: string, limit = 6): SlugPlace[] {
  const here = SLUGS.get(slug.toLowerCase());
  if (!here || !here.state) return [];
  return [...SLUGS.values()]
    .filter((p) => p.state === here.state && p.slug !== here.slug)
    .sort((a, b) => haversineKm(here.lat, here.lon, a.lat, a.lon) - haversineKm(here.lat, here.lon, b.lat, b.lon))
    .slice(0, limit);
}

/** The cities offered as a start (the display builder's tiles, home's seed for Popular), in order. */
export const START_CITIES: SlugPlace[] = [
  "bengaluru",
  "delhi",
  "mumbai",
  "chennai",
  "kolkata",
  "hyderabad",
  "pune",
  "ahmedabad",
  "lucknow",
  "jaipur",
  "patna",
  "guwahati",
].map((slug) => placeBySlug(slug)!);
