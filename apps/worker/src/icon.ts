import { png } from "./og";
import { BRAND } from "./palette";
import { CLOUD_PATHS } from "./ui/components";

// The favicon and the rasterised apple-touch icon: the cloud mark (CLOUD_PATHS, shared
// with the header wordmark) in white on the brand blue.

const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  `<rect width="64" height="64" rx="14" fill="${BRAND}"/>` +
  `<g fill="#fff">${CLOUD_PATHS}</g></svg>`;

/** Crisp scalable favicon: the cloud on a rounded sky tile. */
export function faviconSvg(): Response {
  return new Response(FAVICON_SVG, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=604800" },
  });
}

/** Square PNG app icon: the cloud on a full-bleed sky tile, rendered via workers-og.
 *  180 = apple-touch-icon (Apple ignores SVG); 192/512 = manifest icons. `maskable`
 *  shrinks the cloud into the central 80% safe zone so launcher masks (circle,
 *  squircle) never crop it. */
export function iconPng(size = 180, maskable = false): Promise<Response> {
  // Satori is flex-only (no absolute positioning, no SVG backgrounds), so the
  // cloud is three overlapping circles, bottoms aligned, via negative margins.
  // Geometry is designed at 180px (the original apple-touch-icon) and scaled.
  const k = (size / 180) * (maskable ? 0.8 : 1);
  const px = (n: number) => Math.round(n * k);
  const circle = (d: number, mr = 0) =>
    `<div style="display:flex;width:${px(d)}px;height:${px(d)}px;border-radius:50%;background:#fff;margin-right:${px(mr)}px;"></div>`;
  const html =
    `<div style="display:flex;width:${size}px;height:${size}px;background:${BRAND};align-items:flex-end;justify-content:center;padding-bottom:${Math.round((size - px(72)) / 2 - px(4))}px;">` +
    `<div style="display:flex;align-items:flex-end;">${circle(52, -20)}${circle(72, -20)}${circle(44)}</div>` +
    `</div>`;
  return png(html, "public, max-age=86400, s-maxage=604800", size, size);
}
