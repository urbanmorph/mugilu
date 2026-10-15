// Admin routes (manual refresh/collect triggers, usage counts) are gated by
// ADMIN_KEY, a secret of their own, sent as "Authorization: Bearer <key>".
// Never the upstream OAQ token and never a ?key= param: URLs end up in logs and
// browser history. Unset ADMIN_KEY fails closed.

/** Length-independent, constant-time string equality (no early exit on a mismatch). */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function isAdmin(req: Request, env: { ADMIN_KEY?: string }): boolean {
  const key = env.ADMIN_KEY;
  if (!key) return false;
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/);
  return !!m && safeEqual(m[1], key);
}

const ADMIN_PATHS = new Set(["/api/counts", "/refresh", "/collect", "/warnings/collect", "/fires/collect", "/sig"]);

/** The one gate for every admin route: a 401 for an admin path without the key,
 *  else null (carry on). Call it on the language-stripped path. */
export function adminGate(pathname: string, req: Request, env: { ADMIN_KEY?: string }): Response | null {
  return ADMIN_PATHS.has(pathname) && !isAdmin(req, env) ? new Response("unauthorized", { status: 401 }) : null;
}
