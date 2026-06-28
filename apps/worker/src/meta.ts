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
- Terms and attribution: ${siteUrl}/terms

## What a conditions response carries
The JSON is a versioned, self-describing contract: a "schema" and "version", and a
"units" map (notably CO is mg/m3 while other pollutants are ug/m3). Layers: air
(AQI + band + pollutants + AQLI years-of-life-lost), heat (temperature, humidity,
feels-like, wet-bulb, WBGT), rain, uv, dust, wind, visibility, fire/crop-burn smoke
(NASA FIRMS), and any official NDMA/SACHET warnings at the point. Each layer carries
its "source", a "kind" (measured / modelled / observed) and its own "as_of". An
"ambient" object names the single worst hazard weighted by persona, with a plain
"summary". Attribution and a disclaimer travel inside every response.

## Sources
Air: CPCB, Airnet (CSTEP), Aurassure via the OAQ broker, plus OpenAQ.
Weather / heat / UV / dust: Open-Meteo (CC-BY 4.0).
Official warnings: NDMA / IMD (SACHET). Geography: bharatlas.
Health impact: AQLI methodology (U Chicago EPIC). Code: MIT.
`;
}

/** sitemap.xml: the stable, canonical pages (per-coordinate pages are infinite). */
export function sitemapXml(siteUrl: string): string {
  // Static pages + a named /c/{slug} page per district (keyword URLs that index).
  const paths = ["/", "/about", "/terms", "/warnings", ...allSlugPlaces().map((p) => `/c/${p.slug}`)];
  const urls = paths.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
