import { allSlugPlaces } from "./slugs";

// Discoverability + agent front-door files: plain-text/XML siblings to the HTML
// pages, so people, search engines, and LLM crawlers all find the same surface.
// All built from the live route set, no stale OAQ leftovers.

/** robots.txt: allow everyone (AI crawlers included) and point at the sitemap. */
export function robotsTxt(siteUrl: string): string {
  return [
    "# mugilu is for people, apps, and AI agents alike. Crawl freely.",
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");
}

/** llms.txt: the LLM-friendly manifest of what mugilu is and how to read it. */
export function llmsTxt(siteUrl: string): string {
  return `# mugilu - India's open sky

> Give a coordinate anywhere in India and get what the sky is doing to you right
> now: air, heat (with wet-bulb), rain, UV, dust, and the official government
> warning over that spot, plus an Ambient read naming the single worst hazard for
> you. Open and free; code is MIT, each data source keeps its own licence.
> Informational only, not for medical, emergency, or safety-critical decisions.

## Entry points
- MCP server (for AI agents): ${siteUrl}/mcp  (JSON-RPC 2.0 over Streamable HTTP, MCP 2025-06-18; tools: conditions_at, search_place, nearest_stations, active_warnings, national_now; plus resources and prompts)
- OpenAPI spec (REST): ${siteUrl}/openapi.json
- Conditions (HTML): ${siteUrl}/c/{lat},{lon}  e.g. ${siteUrl}/c/12.97,77.59
- Conditions (JSON): ${siteUrl}/c/{lat},{lon}.json
- Conditions (Markdown): ${siteUrl}/c/{lat},{lon}.md
- Persona weighting: add ?as=asthma|elderly|child|outdoor|heart to any /c URL
- Nearest air stations: ${siteUrl}/near?lat={lat}&lon={lon}
- Place search / typeahead: ${siteUrl}/suggest?q={name}
- Air leaderboard: ${siteUrl}/index.json  and  ${siteUrl}/index.md
- Active warnings (national): ${siteUrl}/warnings  (also .json and .md)
- Per-station: ${siteUrl}/s/{provider}/{id}.json  and  .md
- Attribution: add ?ref=your-app to any API or /embed URL to identify your app or site (aggregate, domain-level; helps us see who builds on mugilu)
- About: ${siteUrl}/about
- Methodology (the Ambient thresholds, glass-box): ${siteUrl}/methodology
- Terms and attribution: ${siteUrl}/terms

## What a conditions response carries
The JSON is a versioned, self-describing contract: a "schema" and "version", and a
"units" map (notably CO is mg/m3 while other pollutants are ug/m3). Layers: air
(AQI + band + pollutants + AQLI years-of-life-lost), heat (temperature, humidity,
feels-like, wet-bulb, WBGT), rain, uv, dust, wind, visibility, fire/crop-burn smoke
(NASA FIRMS), and any official NDMA/SACHET warnings at the point. Each layer carries
its "source", a "kind" (measured / modelled / observed) and its own "as_of". An
"ambient" object names the single worst hazard weighted by persona, with a plain
"summary". Every response also carries "refresh_after_seconds" (how long the reading
stays current). Attribution and a disclaimer travel inside every response.

## Freshness and polling
mugilu recomputes on a ~15-minute cycle. Air quality and official warnings only
change hourly; weather (heat, wet-bulb, wind, UV, dust) moves at most every 15
minutes. A single conditions response already carries every layer, each with its own
"as_of", so you never need to poll per-metric. Refresh at most once every 15 minutes
(the "refresh_after_seconds" value, also sent as the Cache-Control max-age on JSON,
Markdown and /embed): polling faster returns identical data. If you display many
places, that rate is per place. Readings are current, never a forecast.

## Sources
Air: CPCB, Airnet (CSTEP), Aurassure via the OAQ broker, plus OpenAQ.
Weather / heat / UV / dust: Open-Meteo (CC-BY 4.0).
Official warnings: NDMA / IMD (SACHET). Geography: bharatlas.
Health impact: AQLI methodology (U Chicago EPIC). Code: MIT.
`;
}

/** OpenAPI 3.1 spec for the read API. Doubles as ChatGPT Custom-GPT Actions and
 *  developer docs. Covers the conditions + search + nearest + leaderboard + warnings
 *  endpoints; the conditions body is the self-describing mugilu/conditions v1. */
export function openApiSpec(siteUrl: string): object {
  const persona = {
    name: "as",
    in: "query",
    required: false,
    description: "Weight the Ambient read for a vulnerability.",
    schema: { type: "string", enum: ["asthma", "elderly", "child", "outdoor", "heart"] },
  };
  const ref = {
    name: "ref",
    in: "query",
    required: false,
    description: "Identify your app/site (aggregate attribution).",
    schema: { type: "string" },
  };
  const ok = (description: string) => ({
    "200": { description, content: { "application/json": { schema: { type: "object" } } } },
  });
  return {
    openapi: "3.1.0",
    info: {
      title: "mugilu: India's open sky",
      version: "1.0.0",
      description:
        "Give any point in India and get what the sky is doing right now: air, heat (with wet-bulb), rain, UV, dust, fire-smoke, and official NDMA warnings, plus a persona-weighted Ambient read. Informational only, not for medical, emergency, or safety-critical use. Freshness: readings recompute on a ~15-minute cycle (air and warnings change hourly, weather at most every 15 min). Each response carries refresh_after_seconds and a matching Cache-Control max-age; poll at most once every 15 minutes per place, faster returns identical data.",
      license: { name: "Sources keep their own licence; see /terms", url: `${siteUrl}/terms` },
      contact: { url: siteUrl },
    },
    servers: [{ url: siteUrl }],
    paths: {
      "/c/{coord}.json": {
        get: {
          operationId: "conditionsAt",
          summary: "Sky conditions at a coordinate, right now (mugilu/conditions v1).",
          parameters: [
            {
              name: "coord",
              in: "path",
              required: true,
              description: 'lat,lon (e.g. "12.97,77.59").',
              schema: { type: "string" },
              example: "12.97,77.59",
            },
            persona,
            ref,
          ],
          responses: ok(
            "A versioned conditions object: air, heat, rain, uv, dust, wind, visibility, smoke, warnings, and an ambient read.",
          ),
        },
      },
      "/near": {
        get: {
          operationId: "nearestStations",
          summary: "Nearest measured air-quality stations to a point.",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number" } },
            { name: "lon", in: "query", required: true, schema: { type: "number" } },
            {
              name: "n",
              in: "query",
              required: false,
              description: "How many (1-50, default 5).",
              schema: { type: "integer" },
            },
          ],
          responses: ok("The nearest stations with distance and current AQI."),
        },
      },
      "/suggest": {
        get: {
          operationId: "searchPlace",
          summary: "Resolve an Indian place name to candidates (name, coordinate).",
          parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
          responses: ok("Candidate places."),
        },
      },
      "/index.json": {
        get: {
          operationId: "airLeaderboard",
          summary: "National air leaderboard (all reporting stations).",
          responses: ok("The current air snapshot."),
        },
      },
      "/warnings.json": {
        get: {
          operationId: "activeWarnings",
          summary: "Active official NDMA/IMD warnings across India.",
          responses: ok("The current warnings snapshot."),
        },
      },
    },
  };
}

/** sitemap.xml: the stable, canonical pages (per-coordinate pages are infinite).
 *  lastmod tells crawlers when to recrawl. Only the home and warnings pages change
 *  their indexable TEXT daily, so they carry today's date; every other page (the
 *  explainers, the /places directory, and each /c/{slug}) carries a fixed date. A
 *  place page's live readings move constantly, but its indexable text does not, and
 *  stamping all ~800 with today's date every day just teaches crawlers to distrust
 *  our lastmod. Bump STATIC when a page's text (not its live numbers) changes. */
export function sitemapXml(siteUrl: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const STATIC = "2026-07-07";
  const live = new Set(["/", "/warnings"]);
  // Static pages + the /places directory + a named /c/{slug} page per district.
  const paths = [
    "/",
    "/about",
    "/methodology",
    "/terms",
    "/places",
    "/warnings",
    ...allSlugPlaces().map((p) => `/c/${p.slug}`),
  ];
  // Localized URL for a path: English is unprefixed (canonical); hi/kn get a /prefix.
  const loc = (p: string, l: string) => `${siteUrl}${l === "en" ? "" : "/" + l}${p === "/" ? "" : p}`;
  // hreflang alternates so search engines pair the three language versions (+ x-default).
  const alts = (p: string) =>
    ["en", "hi", "kn"].map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${loc(p, l)}"/>`).join("") +
    `<xhtml:link rel="alternate" hreflang="x-default" href="${loc(p, "en")}"/>`;
  const urls = paths
    .map((p) => `  <url><loc>${loc(p, "en")}</loc><lastmod>${live.has(p) ? today : STATIC}</lastmod>${alts(p)}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}
