// Security headers on every response the worker sends (the static files in public/ take theirs
// from public/_headers). Framing: the embed (/embed/...) is made for other sites and the kiosk
// (?kiosk) for signage players and /display, so anyone may frame those two; any other page only
// mugilu itself. Scripts and styles are not restricted here: pages still carry inline scripts
// and style attributes (W20 in supporting-docs/platform-audit-tracker-2026-11-24.md).

const BASE_CSP = "base-uri 'self'; object-src 'none'; form-action 'self'";

const FIXED: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  // "Use my location" on mugilu's own pages; never inside someone else's frame.
  "permissions-policy": "geolocation=(self), camera=(), microphone=()",
};

/** Whether other sites may frame this request's page: the embed and the kiosk, in any language. */
function framable(url: URL): boolean {
  const path = url.pathname.replace(/^\/(hi|kn)(?=\/|$)/, "");
  return path.startsWith("/embed/") || url.searchParams.has("kiosk");
}

/** The response with the security headers added (a copy: cached and redirect headers are immutable). */
export function securityHeaders(req: Request, res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(FIXED)) out.headers.set(k, v);
  out.headers.set(
    "content-security-policy",
    `frame-ancestors ${framable(new URL(req.url)) ? "*" : "'self'"}; ${BASE_CSP}`,
  );
  return out;
}
