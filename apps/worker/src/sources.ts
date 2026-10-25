import type { ProviderId } from "./types";

// The one source of truth for who mugilu's data comes from. MIT covers our code;
// the DATA keeps each upstream's terms, so the credit rides with every response and
// every surface that describes mugilu (MCP instructions and resources, llms.txt, the
// leaderboard and station Markdown). The translated HTML pages (/about, its FAQ,
// /terms) carry the same credits as reviewed i18n prose; a test fails if one of
// them leaves out a source named here.

/** The air providers OAQ relays: full name (station files) and short credit. */
export const AIR_PROVIDERS: Record<ProviderId, { name: string; short: string }> = {
  cpcb: { name: "Central Pollution Control Board, Government of India", short: "CPCB (Govt. of India)" },
  airnet: { name: "Center for Study of Science, Technology and Policy (CSTEP)", short: "Airnet (CSTEP)" },
  aurassure: { name: "Aurassure University Clean Air Network", short: "Aurassure" },
  airview: { name: "Google AirView+", short: "Google AirView+" },
};

const shorts = Object.values(AIR_PROVIDERS).map((p) => p.short);

/** Every measured air provider reaches us through the OAQ broker. Where no station is
 *  within 50 km, air is modelled by Open-Meteo instead (credited in its row below). */
export const AIR_SOURCE = `${shorts.slice(0, -1).join(", ")} and ${shorts.at(-1)} via the OAQ broker (oaq.notf.in)`;

/** Each layer, where it comes from (with the licence where it asks for credit), and
 *  the names any hand-written credit for that layer must mention. */
export const SOURCES: { layer: string; text: string; names: string[] }[] = [
  { layer: "Air", text: AIR_SOURCE, names: ["CPCB", "Airnet", "Aurassure", "AirView+", "OAQ"] },
  { layer: "Modelled air, heat, rain, UV, dust, wind", text: "Open-Meteo (CC-BY 4.0)", names: ["Open-Meteo"] },
  {
    layer: "Heat compared with normal",
    text: "1991-2020 normals of ERA5 reanalysis (Copernicus Climate Change Service) via Open-Meteo",
    names: ["ERA5", "Copernicus"],
  },
  { layer: "Official warnings", text: "NDMA / IMD (SACHET)", names: ["NDMA", "IMD", "SACHET"] },
  { layer: "Fire / crop-burn smoke", text: "NASA FIRMS (VIIRS)", names: ["NASA FIRMS"] },
  {
    layer: "Geography & place names",
    text: "place search from OpenStreetMap contributors (ODbL) and GeoNames (CC-BY 4.0, via the Open-Meteo geocoder); admin boundaries from bharatlas",
    names: ["OpenStreetMap", "GeoNames", "bharatlas"],
  },
  { layer: "Health impact (years of life lost)", text: "the AQLI methodology (U Chicago EPIC)", names: ["AQLI"] },
];

/** The source list as Markdown bullets, one per layer. */
export function sourcesMarkdown(): string {
  return SOURCES.map((s) => `- ${s.layer}: ${s.text}.`).join("\n");
}

/** A provider OAQ adds before we name it here is shown by its id. */
export const providerName = (p: ProviderId): string => AIR_PROVIDERS[p]?.name ?? p;

// Per-source credit for the one-line attribution inside each conditions response.
const SOURCE_CREDIT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(AIR_PROVIDERS).map(([id, p]) => [id, `${p.short} via OAQ`])),
  "open-meteo": "Open-Meteo (CC-BY 4.0)",
  // The heat normals (heatnormals.ts): the Copernicus licence asks for this credit.
  era5: "ERA5 (Copernicus C3S) normals",
  sachet: "NDMA / IMD (SACHET)",
  firms: "NASA FIRMS",
};

/** Build a deduped, ready-to-paste attribution line from contributing sources. */
export function buildAttribution(sources: Array<string | undefined | null>): string {
  const credits = new Set<string>();
  for (const s of sources) {
    if (s) credits.add(SOURCE_CREDIT[s] ?? s);
  }
  if (credits.size === 0) return "via mugilu";
  return `Sources: ${[...credits].join(" · ")}, via mugilu`;
}
