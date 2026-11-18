import type { NormalizedStation, Conditions } from "./types";
import type { Persona } from "./score";
import { conditionsOgHtml, homeOgHtml, stationOgHtml } from "./og-html";

/** A PNG of `html` (default 1200x630, the share-image size), with our own cache lifetime:
 *  workers-og marks every image immutable for a year, but these URLs are not versioned and
 *  the images change. workers-og's JavaScript loads on the first image, but the bundler still
 *  imports its WebAssembly (yoga, resvg: about 1.5 MB) statically, so every isolate compiles
 *  it at start. Keeping that out of the page isolates would take a separate image Worker
 *  behind a service binding. */
export async function png(
  html: string,
  cacheControl: string,
  width = 1200,
  height = 630,
  fonts?: ImageFont[],
): Promise<Response> {
  const { ImageResponse } = await import("workers-og");
  const img = new ImageResponse(html, { width, height, format: "png", fonts });
  const headers = new Headers(img.headers);
  headers.set("cache-control", cacheControl);
  return new Response(img.body, { status: img.status, headers });
}

interface ImageFont {
  name: string;
  data: ArrayBuffer;
  weight: 600 | 800;
  style: "normal";
}
let anek: Promise<ImageFont[]> | undefined;
/** Anek Latin at the two weights the share images use, bundled with the worker (src/fonts,
 *  SIL OFL 1.1, Fontsource 5.3.0 static instances: Satori takes neither WOFF2 nor variable
 *  axes), loaded once per isolate on the first share image. */
function anekLatin(): Promise<ImageFont[]> {
  anek ??= Promise.all([import("./fonts/anek-latin-600.ttf"), import("./fonts/anek-latin-800.ttf")]).then(
    ([semi, bold]) => [
      { name: "Anek Latin", data: semi.default, weight: 600, style: "normal" },
      { name: "Anek Latin", data: bold.default, weight: 800, style: "normal" },
    ],
  );
  return anek;
}

/** Image cache lifetime: a few minutes in browsers, an hour at the edge. */
const LIVE_IMAGE = "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400";

/** /og/s/{provider}/{id}.png: one station's share image. */
export async function renderStationOg(s: NormalizedStation, generatedAt: string): Promise<Response> {
  return png(stationOgHtml(s, generatedAt), LIVE_IMAGE, 1200, 630, await anekLatin());
}

/** /c/{place}.png: the timestamped snapshot of a place's read (the time is prominent because
 *  the values change; the cache is short). */
export async function renderConditionsOg(c: Conditions, persona: Persona): Promise<Response> {
  return png(conditionsOgHtml(c, persona), LIVE_IMAGE, 1200, 630, await anekLatin());
}

/** /og.png: the brand card for the home page and the content pages. */
export async function renderHomeOg(): Promise<Response> {
  return png(
    homeOgHtml(),
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    1200,
    630,
    await anekLatin(),
  );
}
