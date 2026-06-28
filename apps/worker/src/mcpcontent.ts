// MCP resources (readable context the agent can ground + cite from) and prompts
// (user-initiated templated workflows). Static content — no per-request work.

export const RESOURCES = [
  {
    uri: "mugilu://methodology",
    name: "methodology",
    title: "How the Ambient read works",
    description: "The public thresholds for every hazard and how the persona-weighted Ambient read is computed.",
    mimeType: "text/markdown",
  },
  {
    uri: "mugilu://license",
    name: "license",
    title: "Licence & attribution",
    description: "How to credit mugilu and each upstream source; the informational-only disclaimer.",
    mimeType: "text/markdown",
  },
  {
    uri: "mugilu://schema",
    name: "schema",
    title: "The v1 conditions contract",
    description: "The shape of a conditions response: layers, units, kinds, and the ambient object.",
    mimeType: "text/markdown",
  },
  {
    uri: "mugilu://compose",
    name: "compose",
    title: "Composing with geography (bharatlas)",
    description: "How to answer questions that need a place/feature AND its sky — pair mugilu with the bharatlas MCP.",
    mimeType: "text/markdown",
  },
];

const CONTENT: Record<string, string> = {
  "mugilu://methodology": `# How mugilu's Ambient read works

mugilu names the single worst thing the sky is doing to you right now, weighted for who you are. Every threshold below is public.

## One read, never an average
Each hazard is scored 0-3 (none / caution / high / severe). The worst one becomes the Ambient, named in plain words ("Severe smoke", "High heat"). We never average — averaging hides the thing that matters.

## For who you are (persona)
Pick a vulnerability — asthma, elderly, child, outdoor, heart — and the hazards that group feels more keenly are bumped up one level (an asthmatic sees moderate air as "high"). A second "also watch" line surfaces a secondary trigger.

## The thresholds (caution / high / severe)
- Air (CPCB AQI): 101-200 / 201-300 / 301+
- Heat (feels-like C): 35 / 40 / 45
- Heat (wet-bulb C): 26 / 28 / 31
- Heat (WBGT C): 30 / 32 / 35
- Cold (feels-like C): <=10 / <=5 / <=0
- Wind (gusts km/h): 40 / 62 / 88
- Fog (visibility m): <1000 / <500 / <200
- Smoke (fires within 100 km, 24h): 3+ / 25+ / 60+
- UV (index): 6-10 / - / 11+
- Dust (ug/m3): 80 / 150 / 500

Heat takes the worst of feels-like, wet-bulb and WBGT.

## Sources
Air: CPCB / Airnet (CSTEP) / Aurassure via the OAQ broker, plus OpenAQ. Weather, heat, UV, dust and wind: Open-Meteo (CC-BY 4.0). Official warnings: NDMA / IMD (SACHET). Fire-smoke: NASA FIRMS. Life-expectancy impact: the AQLI methodology (U Chicago EPIC).

Informational only — not for medical, emergency, or safety-critical decisions. Full page: https://mugilu.live/methodology`,

  "mugilu://license": `# mugilu — licence & attribution

Code is MIT (https://github.com/urbanmorph/mugilu). The data is not relicensed: each upstream source keeps its own licence and attribution. mugilu is non-commercial, for individuals, and is not affiliated with any data provider.

## Please credit
Every conditions response carries an "attribution" and a "disclaimer" field — surface them. Suggested: "Sky data via mugilu (mugilu.live)", and name the upstream layer's source.

## Sources & licences
- Air: CPCB (Govt. of India), Airnet (CSTEP), Aurassure via the OAQ broker; plus OpenAQ.
- Heat, rain, UV, dust, wind: Open-Meteo, CC-BY 4.0.
- Official warnings: NDMA / IMD (SACHET).
- Fire / crop-burn smoke: NASA FIRMS (VIIRS).
- Geography & place names: bharatlas.
- Health impact (years of life lost): AQLI methodology (U Chicago EPIC).

## Disclaimer
Informational and educational only — not for medical, emergency, or safety-critical decisions. For official hazard warnings, consult NDMA and IMD. Terms: https://mugilu.live/terms`,

  "mugilu://schema": `# The v1 conditions contract

A conditions response (the conditions_at structuredContent, or /c/{lat},{lon}.json) is a versioned, self-describing object.

- schema: "mugilu/conditions", version: 1
- location: { lat, lon }; place: the resolved name (or null); as_of: ISO timestamp
- units: a map (note: CO is mg/m3, other pollutants ug/m3)

## Layers (each carries its own source, kind and as_of)
- air: { kind: measured|modelled, aqi, aqi_scale: "cpcb", band, pollutants, yll_years (AQLI years of life lost), station }
- heat: { temp_c, humidity_pct, apparent_c (feels-like), wet_bulb_c, wbgt_c }
- rain, uv, dust, wind, visibility: modelled layers
- smoke: { kind: observed, count (fires), window_h: 24 } (NASA FIRMS)
- warnings: official NDMA/IMD alerts at the point

## ambient (the interpreted read)
{ risk_band: low|moderate|high|severe, level (0-3), driver (the worst hazard), persona, summary (plain words), persona_also, hazards[] }

Plus "attribution" and "disclaimer" strings — always surface them. Live example: https://mugilu.live/c/12.97,77.59.json`,

  "mugilu://compose": `# Composing mugilu with bharatlas

mugilu tells you what the sky is doing over a coordinate. It does NOT resolve sub-city wards, hospitals, forests, rivers, highways, or administrative/zone boundaries. The bharatlas MCP (India's open geo data) does exactly that. Pair them: bharatlas finds the place or feature and its coordinate, mugilu gives the sky over it.

## Examples
- "Air in Indiranagar ward, Bengaluru" -> bharatlas: the ward centroid -> mugilu conditions_at.
- "Heat over Bandipur sanctuary now" -> bharatlas: the forest polygon -> mugilu.
- "Conditions across every district of Punjab" -> bharatlas: enumerate districts -> mugilu per district.
- "Fog / visibility over NH-44 tonight" -> bharatlas: the highway -> mugilu.
- "Air near hospitals in Delhi" -> bharatlas: hospital points -> mugilu per point.

mugilu resolves cities, districts and air-monitoring stations itself (search_place); reach for bharatlas for finer or other geography. bharatlas: https://bharatlas.com`,
};

export interface ResourceRead {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}

/** Read a resource by URI, or undefined if unknown. */
export function readResource(uri: string): ResourceRead | undefined {
  const text = CONTENT[uri];
  return text ? { contents: [{ uri, mimeType: "text/markdown", text }] } : undefined;
}

export const PROMPTS = [
  {
    name: "sky-check",
    title: "Sky check",
    description: "What the sky is doing at a place in India right now, in plain words.",
    arguments: [{ name: "place", description: "A place in India (a name or a coordinate).", required: true }],
  },
  {
    name: "safe-to-go-out",
    title: "Safe to go out?",
    description: "Whether it is safe for a particular person to be outside at a place right now.",
    arguments: [
      { name: "place", description: "A place in India.", required: true },
      {
        name: "who",
        description: "Who's going out: asthma, elderly, child, outdoor, heart, or everyone.",
        required: false,
      },
    ],
  },
  {
    name: "worst-air-now",
    title: "Worst air now",
    description: "Where the air is worst across India right now.",
    arguments: [],
  },
  {
    name: "warnings-digest",
    title: "Warnings digest",
    description: "Official warnings currently active in India, optionally for a region.",
    arguments: [{ name: "region", description: "Optional state/region name.", required: false }],
  },
];

export interface PromptGet {
  description: string;
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
}

const userMsg = (text: string): PromptGet["messages"] => [{ role: "user", content: { type: "text", text } }];

/** Build a prompt's messages from its arguments, or undefined if unknown. */
export function getPrompt(name: string, args: Record<string, unknown>): PromptGet | undefined {
  const place = typeof args.place === "string" ? args.place : "";
  const who = typeof args.who === "string" && args.who ? args.who : "everyone";
  const region = typeof args.region === "string" ? args.region : "";
  switch (name) {
    case "sky-check":
      return {
        description: `Sky check for ${place || "a place"}`,
        messages: userMsg(
          `What is the sky doing at ${place} in India right now? Call the conditions_at tool for "${place}", then give a plain-language summary — the Ambient read (the single worst hazard) first, then air, heat and anything notable — and include the attribution and the "informational only" note.`,
        ),
      };
    case "safe-to-go-out":
      return {
        description: `Is it safe for ${who} to be outside at ${place || "a place"}?`,
        messages: userMsg(
          `Is it safe for ${who} to be outside at ${place} in India right now? Call conditions_at for "${place}" with persona "${who}", then answer go / caution / avoid in one line with the reason (the Ambient read). Add the attribution and note this is informational, not safety advice.`,
        ),
      };
    case "worst-air-now":
      return {
        description: "Where the air is worst in India right now",
        messages: userMsg(
          `Where is the air worst in India right now? Call national_now with kind "air", then report the worst-air place, its state and AQI in plain words, with the attribution.`,
        ),
      };
    case "warnings-digest":
      return {
        description: region ? `Active warnings for ${region}` : "Active warnings across India",
        messages: userMsg(
          `What official NDMA/IMD warnings are active in India right now${region ? ` for ${region}` : ""}? Call active_warnings${region ? ` with region "${region}"` : ""} and summarise them plainly; note NDMA/IMD are the authoritative source.`,
        ),
      };
    default:
      return undefined;
  }
}
