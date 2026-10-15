import type { Env } from "./index";
import type { Signature } from "./types";

const KV_KEY = "oaq:signature";
const SAFETY_WINDOW_SEC = 60 * 60; // refresh if <1h remaining

/**
 * Returns a valid signature, refreshing via the broker handshake if needed.
 * Caches in KV until ~1h before Expires.
 */
export async function getSignature(env: Env): Promise<Signature> {
  const cached = await env.OAQ_KV.get<Signature>(KV_KEY, "json");
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expires - now > SAFETY_WINDOW_SEC) {
    return cached;
  }
  return refreshSignature(env);
}

async function refreshSignature(env: Env): Promise<Signature> {
  const url = `${env.OAQ_BROKER_URL}?action=api_session&token=${encodeURIComponent(env.OAQ_API_KEY)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`handshake failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { baseUrl: string; signature: string };
  // Expires is embedded in the signature query string, e.g. "…&Expires=1775670642&…"
  const m = body.signature.match(/Expires=(\d+)/);
  if (!m) throw new Error(`handshake response missing Expires: ${body.signature}`);
  const expires = Number(m[1]);

  const sig: Signature = {
    baseUrl: body.baseUrl,
    signature: body.signature,
    expires,
  };
  // TTL slightly less than Expires so KV evicts around the same time.
  const ttl = Math.max(60, expires - Math.floor(Date.now() / 1000) - 30);
  await env.OAQ_KV.put(KV_KEY, JSON.stringify(sig), { expirationTtl: ttl });
  return sig;
}

/**
 * Builds a signed URL for a path under /v1/, e.g. "provider=cpcb/live/global/all_stations_latest.json".
 */
export function signUrl(sig: Signature, path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  return `${sig.baseUrl}${cleanPath}?${sig.signature}`;
}
