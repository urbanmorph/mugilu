// The Cloudflare edge cache (caches.default) for responses that are the same for
// every viewer. A Worker's own Cache-Control does not make Cloudflare cache it; the
// Cache API does. Only GETs are stored, only 200s, never anything that sets a cookie,
// and nothing here reads cookies or per-viewer headers, so a hit can never serve one
// viewer's response to another.
//
// Usage metrics still count a hit: the miss stores the lookup's usage facts on the
// cached copy (an internal header, stripped before any response leaves), and a hit
// hands them to `onHit` to record against the current request.

export interface CacheLike {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}

const USAGE = "x-mugilu-usage"; // the lookup's usage facts, on the stored copy only
const CC = "x-mugilu-cc"; // the route's own Cache-Control, restored on a hit

/** The cache key: the request's origin and path as received (so /hi and /kn are their
 *  own entries) plus only the given params, in a fixed order. Every other query
 *  param (?ref=, ?utm_*, cache-busters) shares the one entry, so a decorated or
 *  random URL cannot force a fresh render. An empty value is a bare flag (?kiosk). */
export function cacheKey(req: Request, params: Record<string, string | undefined> = {}): Request {
  const u = new URL(req.url);
  const qs = Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
    .map((k) => (params[k] ? `${k}=${encodeURIComponent(params[k]!)}` : k))
    .join("&");
  return new Request(`${u.origin}${u.pathname}${qs ? `?${qs}` : ""}`);
}

/** Serve from the edge when warm, else build, serve and store for `ttlSeconds`. */
export async function edgeServe<U>(
  req: Request,
  ctx: ExecutionContext,
  key: Request,
  ttlSeconds: number,
  // `store: false` serves the response but keeps it out of the cache (e.g. a reading
  // built while an upstream was down, which must not be shown to everyone for minutes).
  build: () => Promise<{ res: Response; usage?: U; store?: boolean }>,
  onHit?: (usage: U) => void,
  cache: CacheLike = caches.default,
): Promise<Response> {
  if (req.method !== "GET") return (await build()).res;

  const hit = await cache.match(key);
  if (hit) {
    const facts = hit.headers.get(USAGE);
    if (facts && onHit) {
      try {
        onHit(JSON.parse(decodeURIComponent(facts)) as U);
      } catch {
        // best-effort: a bad entry never breaks the response
      }
    }
    const headers = new Headers(hit.headers);
    const own = headers.get(CC);
    if (own) headers.set("cache-control", own);
    else headers.delete("cache-control");
    headers.delete(CC);
    headers.delete(USAGE);
    return new Response(hit.body, { status: hit.status, headers });
  }

  const { res, usage, store = true } = await build();
  if (!store || res.status !== 200 || res.headers.has("set-cookie")) return res;
  // Buffer once so the served and stored copies are independent: a streamed image
  // render cannot be tee'd into the cache safely (it deadlocks).
  const body = await res.arrayBuffer();
  const stored = new Headers(res.headers);
  stored.set(CC, res.headers.get("cache-control") ?? "");
  stored.set("cache-control", `public, max-age=${ttlSeconds}`);
  // Header values are bytes: percent-encode so any place name (Kāmrūp) fits.
  if (usage !== undefined) stored.set(USAGE, encodeURIComponent(JSON.stringify(usage)));
  ctx.waitUntil(cache.put(key, new Response(body, { status: 200, headers: stored })));
  return new Response(body, { status: 200, headers: res.headers });
}
