import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheKey, edgeServe, type CacheLike } from "../src/edge";

// caches.default stand-in: keyed by URL, keeps what was put (and its headers).
function fakeCache() {
  const store = new Map<string, Response>();
  const cache: CacheLike = {
    match: async (req) => store.get(req.url)?.clone(),
    put: async (req, res) => void store.set(req.url, res),
  };
  return { cache, store };
}

function ctx() {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext,
    settle: () => Promise.all(pending),
  };
}

const page = (body = "hi") =>
  new Response(body, { headers: { "content-type": "text/html", "cache-control": "public, s-maxage=900" } });

test("cacheKey: keeps the path (language prefix included) and only the params that change the output", () => {
  const req = new Request("https://mugilu.live/kn/c/12.97,77.59?ref=x&utm_source=y&as=asthma&kiosk&v=123");
  assert.equal(cacheKey(req, { kiosk: "", as: "asthma" }).url, "https://mugilu.live/kn/c/12.97,77.59?as=asthma&kiosk");
  assert.equal(cacheKey(req).url, "https://mugilu.live/kn/c/12.97,77.59");
  // the installed-app launch marker never splits the cache
  assert.equal(cacheKey(new Request("https://mugilu.live/hi?src=pwa")).url, "https://mugilu.live/hi");
  // the same output from differently ordered or decorated URLs shares one entry
  const a = cacheKey(new Request("https://mugilu.live/c/x.png?b=1&as=child"), { as: "child" });
  const b = cacheKey(new Request("https://mugilu.live/c/x.png?as=child&cachebust=9"), { as: "child" });
  assert.equal(a.url, b.url);
});

test("edgeServe: a miss builds and stores; a hit skips the build and still records usage", async () => {
  const { cache } = fakeCache();
  const req = new Request("https://mugilu.live/c/1,2");
  const key = cacheKey(req);
  let builds = 0;
  const hits: unknown[] = [];
  const served: { ms?: number; status: number }[] = [];
  const build = async () => (builds++, { res: page(), usage: { place: "X" } });
  const c1 = ctx();
  const first = await edgeServe(req, c1.ctx, key, 300, build, (u, how) => (hits.push(u), served.push(how)), cache);
  await c1.settle();
  const c2 = ctx();
  const second = await edgeServe(req, c2.ctx, key, 300, build, (u, how) => (hits.push(u), served.push(how)), cache);
  assert.equal(builds, 1);
  assert.equal(typeof served[0].ms, "number", "a miss reports how long the build took");
  assert.equal(served[0].status, 200);
  assert.deepEqual(served[1], { status: 200 }, "a hit has no build time");
  assert.equal(await first.text(), "hi");
  assert.equal(await second.text(), "hi");
  assert.equal(hits.length, 2, "usage recorded on the miss and on the hit");
  assert.deepEqual(hits[1], { place: "X" });
  // the client sees the route's own headers, never the internal ones
  assert.equal(second.headers.get("cache-control"), "public, s-maxage=900");
  assert.equal(second.headers.get("x-mugilu-usage"), null);
  assert.equal(second.headers.get("x-mugilu-cc"), null);
});

test("edgeServe: usage facts with any Unicode (a place like Kāmrūp) survive the round trip", async () => {
  const { cache } = fakeCache();
  const req = new Request("https://mugilu.live/c/26.2,91.7");
  const usage = { place: "Kāmrūp, অসম" };
  const hits: unknown[] = [];
  const c = ctx();
  const miss = await edgeServe(req, c.ctx, cacheKey(req), 300, async () => ({ res: page(), usage }), undefined, cache);
  assert.equal(miss.status, 200);
  await c.settle();
  await edgeServe(
    req,
    ctx().ctx,
    cacheKey(req),
    300,
    async () => ({ res: page() }),
    (u) => hits.push(u),
    cache,
  );
  assert.deepEqual(hits, [usage]);
});

test("edgeServe: a build that says not to store (a degraded reading) is served but never cached", async () => {
  const { cache, store } = fakeCache();
  const req = new Request("https://mugilu.live/c/1,2");
  const c = ctx();
  const res = await edgeServe(
    req,
    c.ctx,
    cacheKey(req),
    300,
    async () => ({ res: page(), store: false }),
    undefined,
    cache,
  );
  await c.settle();
  assert.equal(await res.text(), "hi");
  assert.equal(store.size, 0);
});

test("edgeServe: the stored copy carries the edge TTL", async () => {
  const { cache, store } = fakeCache();
  const req = new Request("https://mugilu.live/c/1,2.json");
  const c = ctx();
  await edgeServe(req, c.ctx, cacheKey(req), 120, async () => ({ res: page() }), undefined, cache);
  await c.settle();
  assert.equal(store.get("https://mugilu.live/c/1,2.json")!.headers.get("cache-control"), "public, max-age=120");
});

test("edgeServe: errors, non-GET requests and responses that set cookies are never stored", async () => {
  const { cache, store } = fakeCache();
  const c = ctx();
  const get = new Request("https://mugilu.live/c/1,2");
  await edgeServe(
    get,
    c.ctx,
    cacheKey(get),
    300,
    async () => ({ res: new Response("x", { status: 503 }) }),
    undefined,
    cache,
  );
  const post = new Request("https://mugilu.live/c/1,2", { method: "POST", body: "x" });
  await edgeServe(post, c.ctx, cacheKey(post), 300, async () => ({ res: page() }), undefined, cache);
  const cookie = new Request("https://mugilu.live/c/3,4");
  const withCookie = page();
  withCookie.headers.set("set-cookie", "a=b");
  await edgeServe(cookie, c.ctx, cacheKey(cookie), 300, async () => ({ res: withCookie }), undefined, cache);
  await c.settle();
  assert.equal(store.size, 0);
});

test("edgeServe: a streamed body (an image render) is served and stored intact", async () => {
  const { cache, store } = fakeCache();
  const req = new Request("https://mugilu.live/c/1,2.png");
  const stream = new ReadableStream({
    start(ctl) {
      ctl.enqueue(new Uint8Array([137, 80, 78, 71]));
      ctl.close();
    },
  });
  const c = ctx();
  const res = await edgeServe(
    req,
    c.ctx,
    cacheKey(req),
    300,
    async () => ({ res: new Response(stream, { headers: { "content-type": "image/png" } }) }),
    undefined,
    cache,
  );
  await c.settle();
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [137, 80, 78, 71]);
  assert.equal((await store.get(req.url)!.arrayBuffer()).byteLength, 4);
});

test("edgeServe: a request that is never cached (HEAD) still records its usage", async () => {
  const { cache } = fakeCache();
  const head = new Request("https://mugilu.live/c/1,2", { method: "HEAD" });
  const seen: unknown[] = [];
  const build = async () => ({ res: page(), usage: { place: "Y" } });
  await edgeServe(head, ctx().ctx, cacheKey(head), 300, build, (u) => seen.push(u), cache);
  assert.deepEqual(seen, [{ place: "Y" }]);
});
