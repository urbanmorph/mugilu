import type { Env } from "./index";
import type { Snapshot, NormalizedStation, ConditionsSnapshot } from "./types";
import type { WarningsSnapshot } from "./sachet";
import type { NationalHighlights } from "./highlights";
import { buildConditions, renderConditionsMarkdown, serializeConditionsV1 } from "./conditions";
import { loadFires } from "./firms";
import { parsePersona } from "./score";
import { parseCoordQuery, applyAlias, buildSuggestions } from "./suggest";
import { geocode, geocodeList } from "./geocode";
import { slugForName, placeBySlug } from "./slugs";
import { findNearest } from "./near";
import { nationalHighlights, worstAirStation } from "./highlights";
import { recordLookup, recordEvent } from "./metrics";

// The MCP tool surface (Phase 2). Each tool is a thin adapter over an existing
// internal function — no new data logic. Read-only; all live/India-only.

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

const PERSONA_ENUM = ["everyone", "asthma", "elderly", "child", "outdoor", "heart"];

export const TOOLS = [
  {
    name: "conditions_at",
    description:
      "What the sky is doing at a place in India RIGHT NOW (not a forecast): air quality (CPCB AQI + pollutants + AQLI years-of-life-lost), heat (feels-like, wet-bulb, WBGT), cold, wind, fog/visibility, dust, fire-smoke, UV, and any official NDMA warning over that spot — plus an Ambient read naming the single worst hazard. Pass `persona` to weight it for a vulnerable person. Surface the returned `attribution` and `disclaimer`.",
    inputSchema: {
      type: "object",
      properties: {
        place: {
          type: "string",
          description: 'A place in India: a name ("Bengaluru", "Indiranagar") or a coordinate "lat,lon".',
        },
        persona: {
          type: "string",
          enum: PERSONA_ENUM,
          description: "Weight the read for who is affected (default everyone).",
        },
      },
      required: ["place"],
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  {
    name: "search_place",
    description:
      "Resolve an Indian place name to candidates (name, detail, coordinate) — use to disambiguate before conditions_at. Covers cities, districts and air-monitoring stations. For sub-city wards, hospitals, forests, rivers or boundaries, use a geo source like the bharatlas MCP instead.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "A place name or partial name in India." } },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  {
    name: "nearest_stations",
    description:
      "The nearest real (measured) air-quality monitoring stations to a place, with distance and current AQI. Use to judge how close hard measurement is — conditions can be modelled when no station is near.",
    inputSchema: {
      type: "object",
      properties: {
        place: { type: "string", description: 'A place name or "lat,lon" in India.' },
        n: { type: "integer", minimum: 1, maximum: 20, description: "How many stations (default 5)." },
      },
      required: ["place"],
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  {
    name: "active_warnings",
    description:
      "Official NDMA/IMD hazard warnings currently active across India (the authoritative channel). Optionally filter by a region/state name (matched against the headline).",
    inputSchema: {
      type: "object",
      properties: { region: { type: "string", description: "Optional state/region name to filter by." } },
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  {
    name: "national_now",
    description:
      "The national picture right now: the worst-air, hottest, and dustiest spots in India. Filter with `kind` (air | heat | dust).",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["all", "air", "heat", "dust"], description: "Which leaderboard (default all)." },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
];

function err(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function loadSnapshot(env: Env): Promise<Snapshot | null> {
  const obj = await env.OAQ_R2.get("data/latest.json");
  return obj ? ((await obj.json()) as Snapshot) : null;
}

/** Resolve a place string (coordinate, known slug, or geocoded name) → lat/lon. */
async function resolvePlace(place: string): Promise<{ lat: number; lon: number } | null> {
  const coord = parseCoordQuery(place);
  if (coord) return coord;
  const aliased = applyAlias(place);
  const slug = slugForName(aliased) ?? slugForName(place);
  if (slug) {
    const p = placeBySlug(slug);
    if (p) return { lat: p.lat, lon: p.lon };
  }
  const hit = await geocode(aliased);
  return hit ? { lat: hit.lat, lon: hit.lon } : null;
}

async function conditionsAt(
  args: Record<string, unknown>,
  env: Env,
  ctx: ExecutionContext,
  ua: string | null,
): Promise<ToolResult> {
  const place = str(args.place);
  if (!place) return err('`place` is required (a name or "lat,lon").');
  const persona = parsePersona(typeof args.persona === "string" ? args.persona : null);
  const loc = await resolvePlace(place);
  if (!loc) return err(`Could not find a place in India matching "${place}". Try search_place first.`);
  const [snap, fires] = await Promise.all([loadSnapshot(env), loadFires(env)]);
  const conditions = await buildConditions(snap, loc.lat, loc.lon, fires);
  ctx.waitUntil(recordLookup(env, loc.lat, loc.lon, conditions.place, "mcp", ua));
  recordEvent(env, conditions, persona, "mcp", ua);
  return {
    content: [{ type: "text", text: renderConditionsMarkdown(conditions, persona) }],
    structuredContent: serializeConditionsV1(conditions, persona),
  };
}

async function searchPlace(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const q = str(args.query);
  if (!q) return err("`query` is required.");
  const snap = await loadSnapshot(env);
  const hits = await buildSuggestions(snap?.stations ?? [], q, geocodeList, 8);
  const places = hits.map((s) => ({ name: s.label, detail: s.sublabel ?? null, lat: s.lat, lon: s.lon, kind: s.kind }));
  const text = places.length
    ? places.map((p) => `- ${p.name}${p.detail ? ` (${p.detail})` : ""} — ${p.lat},${p.lon}`).join("\n")
    : `No places found for "${q}".`;
  return { content: [{ type: "text", text }], structuredContent: { places } };
}

async function nearestStations(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const place = str(args.place);
  if (!place) return err('`place` is required (a name or "lat,lon").');
  const loc = await resolvePlace(place);
  if (!loc) return err(`Could not resolve "${place}".`);
  const nRaw = Number(args.n ?? 5);
  const n = Number.isFinite(nRaw) ? Math.min(Math.max(1, Math.trunc(nRaw)), 20) : 5;
  const snap = await loadSnapshot(env);
  if (!snap) return err("No air snapshot available yet.");
  const stations = findNearest(snap.stations, loc.lat, loc.lon, n);
  const text =
    stations
      .map((s: NormalizedStation & { distance_km?: number }) => {
        const d = typeof s.distance_km === "number" ? `${s.distance_km.toFixed(1)} km` : "";
        return `- ${s.name}${s.city ? `, ${s.city}` : ""}${d ? ` — ${d}` : ""}, AQI ${s.aqi ?? "n/a"}`;
      })
      .join("\n") || "No stations found nearby.";
  return { content: [{ type: "text", text }], structuredContent: { query: loc, count: stations.length, stations } };
}

async function activeWarnings(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const region = str(args.region).toLowerCase();
  const obj = await env.OAQ_R2.get("data/warnings.json");
  const snap = obj ? ((await obj.json()) as WarningsSnapshot) : null;
  let alerts = snap?.alerts ?? [];
  if (region) alerts = alerts.filter((a) => `${a.headline} ${a.category} ${a.issuer}`.toLowerCase().includes(region));
  const text = alerts.length
    ? alerts.map((a) => `- [${a.category}] ${a.headline} — ${a.issuer}`).join("\n")
    : region
      ? `No active warnings matching "${region}".`
      : "No active warnings nationally.";
  return {
    content: [{ type: "text", text }],
    structuredContent: { generated_at: snap?.generated_at ?? null, count: alerts.length, alerts },
  };
}

async function nationalNow(args: Record<string, unknown>, env: Env): Promise<ToolResult> {
  const kind = str(args.kind) || "all";
  const [gridObj, snap] = await Promise.all([env.OAQ_R2.get("data/conditions.json"), loadSnapshot(env)]);
  const h: NationalHighlights = gridObj
    ? nationalHighlights(((await gridObj.json()) as ConditionsSnapshot).points)
    : {};
  if (snap) {
    const w = worstAirStation(snap.stations);
    if (w) h.worstAir = w;
  }
  const out: Record<string, unknown> = {};
  const lines: string[] = [];
  if ((kind === "all" || kind === "air") && h.worstAir) {
    out.worstAir = h.worstAir;
    lines.push(
      `Worst air: ${h.worstAir.name}${h.worstAir.state ? `, ${h.worstAir.state}` : ""} — AQI ${h.worstAir.aqi} (${h.worstAir.band})`,
    );
  }
  if ((kind === "all" || kind === "heat") && h.hottest) {
    out.hottest = h.hottest;
    lines.push(
      `Hottest: ${h.hottest.name}${h.hottest.state ? `, ${h.hottest.state}` : ""} — feels ${Math.round(h.hottest.apparent_c)}°`,
    );
  }
  if ((kind === "all" || kind === "dust") && h.dustiest) {
    out.dustiest = h.dustiest;
    lines.push(
      `Dustiest: ${h.dustiest.name}${h.dustiest.state ? `, ${h.dustiest.state}` : ""} — ${Math.round(h.dustiest.dust_ug_m3)} µg/m³`,
    );
  }
  return { content: [{ type: "text", text: lines.join("\n") || "No national snapshot yet." }], structuredContent: out };
}

/** Dispatch a tools/call. Returns undefined for an unknown tool name. */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  env: Env,
  ctx: ExecutionContext,
  ua: string | null,
): Promise<ToolResult | undefined> {
  switch (name) {
    case "conditions_at":
      return conditionsAt(args, env, ctx, ua);
    case "search_place":
      return searchPlace(args, env);
    case "nearest_stations":
      return nearestStations(args, env);
    case "active_warnings":
      return activeWarnings(args, env);
    case "national_now":
      return nationalNow(args, env);
    default:
      return undefined;
  }
}
