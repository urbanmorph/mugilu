import { ImageResponse } from "workers-og";

// The mugilu cloud mark, shared by the header logo, the SVG favicon, and the
// rasterised apple-touch icon. White cloud on the sky-blue brand colour.
const CLOUD_PATHS =
  '<rect x="13" y="34" width="38" height="14" rx="7"/>' +
  '<circle cx="24" cy="32" r="10"/><circle cx="38" cy="29" r="12"/><circle cx="47" cy="37" r="7"/>';

const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="14" fill="#0284c7"/>' +
  `<g fill="#fff">${CLOUD_PATHS}</g></svg>`;

/** Crisp scalable favicon: the cloud on a rounded sky tile. */
export function faviconSvg(): Response {
  return new Response(FAVICON_SVG, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=604800" },
  });
}

/** 180x180 PNG apple-touch icon (Apple ignores SVG here), rendered via workers-og. */
export function appleIconPng(): Response {
  // Satori is flex-only (no absolute positioning, no SVG backgrounds), so the
  // cloud is three overlapping circles, bottoms aligned, via negative margins.
  const circle = (d: number, mr = 0) =>
    `<div style="display:flex;width:${d}px;height:${d}px;border-radius:50%;background:#fff;margin-right:${mr}px;"></div>`;
  const html =
    `<div style="display:flex;width:180px;height:180px;background:#0284c7;align-items:flex-end;justify-content:center;padding-bottom:50px;">` +
    `<div style="display:flex;align-items:flex-end;">${circle(52, -20)}${circle(72, -20)}${circle(44)}</div>` +
    `</div>`;
  return new ImageResponse(html, { width: 180, height: 180, format: "png" });
}
