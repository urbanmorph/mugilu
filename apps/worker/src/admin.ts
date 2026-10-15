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
