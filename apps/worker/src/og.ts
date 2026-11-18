import type { NormalizedStation, Conditions } from "./types";
import type { Persona } from "./score";
import { conditionsOgHtml, homeOgHtml, stationOgHtml } from "./og-html";

/** A PNG of `html` (default 1200x630, the share-image size), with our own cache lifetime:
 *  workers-og marks every image immutable for a year, but these URLs are not versioned and
 *  the images change. workers-og (and its WebAssembly) loads on the first image, not with
 *  every isolate: most requests never draw one. */
export async function png(html: string, cacheControl: string, width = 1200, height = 630): Promise<Response> {
  const { ImageResponse } = await import("workers-og");
  const img = new ImageResponse(html, { width, height, format: "png" });
  const headers = new Headers(img.headers);
  headers.set("cache-control", cacheControl);
  return new Response(img.body, { status: img.status, headers });
}

/** Image cache lifetime: a few minutes in browsers, an hour at the edge. */
const LIVE_IMAGE = "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400";

/** /og/s/{provider}/{id}.png: one station's share image. */
export function renderStationOg(s: NormalizedStation, generatedAt: string): Promise<Response> {
  return png(stationOgHtml(s, generatedAt), LIVE_IMAGE);
}

/** /c/{place}.png: the timestamped snapshot of a place's read (the time is prominent because
 *  the values change; the cache is short). */
export function renderConditionsOg(c: Conditions, persona: Persona): Promise<Response> {
  return png(conditionsOgHtml(c, persona), LIVE_IMAGE);
}

/** /og.png: the brand card for the home page and the content pages. */
export function renderHomeOg(): Promise<Response> {
  return png(homeOgHtml(), "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800");
}
