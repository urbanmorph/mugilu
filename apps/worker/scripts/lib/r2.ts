// Cloudflare's R2 REST API for the local scripts, paced under its rate limit (1,200 requests
// in 5 minutes, so 3.5 a second) and retried on 429 and 5xx. Needs CLOUDFLARE_API_TOKEN.

const ACCOUNT = "6ba72cdd965276a57d19bf0aadc4d551";
const BUCKET = "oaq-data";
const R2 = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
if (!TOKEN) throw new Error("set CLOUDFLARE_API_TOKEN");

let nextSlot = 0;
async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / 3.5;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

/** One request to the bucket (`path` is "/key" or "?query"); a network error answers 599. */
export async function r2(path: string, init: RequestInit = {}, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    await paced();
    const res = await fetch(`${R2}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(60_000),
    }).catch((e) => new Response(String(e), { status: 599 }));
    if (res.ok || res.status === 404 || i >= tries || (res.status < 500 && res.status !== 429)) return res;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
}

/** Every key under a prefix. */
export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "";
  do {
    const res = await r2(`?prefix=${encodeURIComponent(prefix)}&per_page=1000${cursor ? `&cursor=${cursor}` : ""}`);
    const d = (await res.json()) as {
      result: { key: string }[];
      result_info?: { cursor?: string; is_truncated?: boolean };
    };
    keys.push(...d.result.map((o) => o.key));
    cursor = d.result_info?.is_truncated ? (d.result_info.cursor ?? "") : "";
  } while (cursor);
  return keys;
}
