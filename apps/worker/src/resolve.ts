import { parseCoordQuery, applyAlias } from "./suggest";
import { slugForName, placeBySlug } from "./slugs";
import { geocode } from "./geocode";

// Canonical "what place does this query mean?", used by /go, the MCP tools, and
// anywhere a name/coordinate must become a point. One resolver so the web and the
// agent front doors never disagree on the alias rules, the coordinate, or the label.

export interface ResolvedPlace {
  lat: number;
  lon: number;
  /** Set when the query named a known district/city: its canonical /c/{slug}. */
  slug?: string;
  /** The canonical place label for a named place (so MCP reads "Bengaluru", not a ward). */
  label?: string;
}

export async function resolveQuery(query: string): Promise<ResolvedPlace | null> {
  const coord = parseCoordQuery(query);
  if (coord) return coord;
  const aliased = applyAlias(query);
  const slug = slugForName(aliased) ?? slugForName(query);
  if (slug) {
    const p = placeBySlug(slug);
    if (p) return { lat: p.lat, lon: p.lon, slug, label: p.state ? `${p.name}, ${p.state}` : p.name };
  }
  const hit = await geocode(aliased);
  // Round to ~11 m so the web (/go) and the MCP path query the identical point.
  return hit ? { lat: +hit.lat.toFixed(4), lon: +hit.lon.toFixed(4) } : null;
}
