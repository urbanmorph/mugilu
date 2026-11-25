// Security headers on every response the worker sends (the static files in public/ take theirs
// from public/_headers). Framing: the embed (/embed/...) is made for other sites and the kiosk
// (?kiosk) for signage players and /display, so anyone may frame those two; any other page only
// mugilu itself.
// Scripts (W20): every page's script is a file under /assets/ (scripts.ts); the one inline script
// left, the theme's (it must run before the first paint), is allowed by its hash. Report-only for
// now: browsers report what would be blocked to /csp-report, logged, and nothing is blocked.
// Styles are not restricted (pages carry style attributes, the embed an inline <style>).

const BASE_CSP = "base-uri 'self'; object-src 'none'; form-action 'self'";

/** The hash of THEME_HEAD_JS (ui/components.ts); test/scripts.test.ts fails if they part. */
export const THEME_HEAD_SHA = "'sha256-e8/v7VpLQdgl0ohpSdOSio+EzyxfRmLGOlHGadYrAJ8='";
const SCRIPT_CSP = `script-src 'self' ${THEME_HEAD_SHA} https://static.cloudflareinsights.com; report-uri /csp-report`;

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
  out.headers.set("content-security-policy-report-only", SCRIPT_CSP);
  return out;
}

/** POST /csp-report: one log line per report (what was blocked, where), for the week of
 *  report-only before scripts are enforced. Nothing is stored. */
export async function cspReport(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const text = (await req.text()).slice(0, 8192);
  let r: Record<string, unknown> = {};
  try {
    const body = JSON.parse(text) as { "csp-report"?: Record<string, unknown> };
    r = body["csp-report"] ?? {};
  } catch {
    // not JSON: logged as unreadable below
  }
  const field = (k: string) => String(r[k] ?? "").slice(0, 200);
  console.log(
    `[csp] ${field("violated-directive") || "unreadable"} blocked=${field("blocked-uri")} page=${field("document-uri")} at=${field("source-file")}:${field("line-number")}`,
  );
  return new Response(null, { status: 204 });
}
