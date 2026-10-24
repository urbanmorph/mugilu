// The offline worker (src/sw.ts), run for real in a sandbox: an in-memory Cache
// Storage and a network the test switches on, off, or into an outage.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { SW_JS, SW_PATH, SW_REGISTER, serviceWorker, OFFLINE_NOTE_ID } from "../src/sw";
import { renderConditionsPage, renderEmbed, renderHome, renderKioskPage } from "../src/page";
import type { Conditions } from "../src/types";

const ORIGIN = "https://mugilu.live";
const NOTE = `<p id="${OFFLINE_NOTE_ID}" hidden>last reading</p>`;

class WorkerRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === "string" ? new URL(input, ORIGIN) : input, init);
  }
}
type Handler = (event: Record<string, unknown>) => void;

function makeWorker() {
  // `page` stands in for the server's HTML for a place, when set.
  const state = { online: true, down: false, fetched: [] as string[], reading: 1, page: "" };
  async function net(input: Request | string): Promise<Response> {
    const req = typeof input === "string" ? new WorkerRequest(input) : input;
    const u = new URL(req.url);
    state.fetched.push(u.pathname + u.search);
    if (!state.online) throw new TypeError("Failed to fetch");
    if (state.down) return new Response("<h1>502</h1>", { status: 502, headers: { "content-type": "text/html" } });
    const body =
      state.page ||
      (u.pathname.includes("/c/") ? `${u.pathname} reading ${state.reading}${NOTE}` : `home ${u.pathname}`);
    return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, ORIGIN).href;
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (r: Request | string) => store.get(keyOf(r))?.clone(),
      // Like the real Cache: a put replaces the entry and moves it to the end.
      put: async (r: Request | string, res: Response) => {
        store.delete(keyOf(r));
        store.set(keyOf(r), res.clone());
      },
      add: async (r: Request | string) => {
        const res = await net(typeof r === "string" ? new WorkerRequest(r) : r);
        if (!res.ok) throw new TypeError("add failed");
        store.set(keyOf(r), res);
      },
      delete: async (r: Request | string) => store.delete(keyOf(r)),
      keys: async () => [...store.keys()].map((u) => new Request(u)),
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: Request | string, opts?: { cacheName?: string }) => {
      for (const n of opts?.cacheName ? [opts.cacheName] : [...stores.keys()]) {
        const hit = stores.get(n)?.get(keyOf(r));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  const handlers: Record<string, Handler> = {};
  // Notifications shown, windows open (url + whether focused) and windows opened.
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const windows: { url: string; focused: boolean; focus: () => Promise<void> }[] = [];
  const opened: string[] = [];
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url: string) => void opened.push(url),
    },
    registration: {
      navigationPreload: { enable: async () => {} },
      showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }),
    },
  };
  runInNewContext(SW_JS, { self, caches, fetch: net, Request: WorkerRequest, Response, URL, Promise });

  async function lifecycle(type: "install" | "activate") {
    let done: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  /** A request the worker sees; the response, or null if it let the request through. */
  async function request(url: string, init: RequestInit & { mode?: string } = {}): Promise<Response | null> {
    const { mode, ...rest } = init;
    const req = new Request(new URL(url, ORIGIN), rest);
    if (mode) Object.defineProperty(req, "mode", { value: mode });
    const event = { responded: null as Promise<Response> | null };
    const waits: Promise<unknown>[] = [];
    handlers.fetch({
      request: req,
      preloadResponse: Promise.resolve(undefined),
      respondWith: (p: Promise<Response>) => (event.responded = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const res = event.responded ? await event.responded : null;
    await Promise.all(waits);
    return res;
  }
  const page = (path: string) => request(path, { mode: "navigate" });
  /** Dispatches an event that the worker keeps alive with waitUntil. */
  async function dispatch(type: string, event: Record<string, unknown>) {
    let done: Promise<unknown> = Promise.resolve();
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  const saved = () =>
    [...(stores.get("mugilu-readings")?.keys() ?? [])].map((u) => new URL(u).pathname + new URL(u).search);
  return { state, stores, saved, lifecycle, request, page, dispatch, shown, windows, opened };
}

let w: ReturnType<typeof makeWorker>;
beforeEach(async () => {
  w = makeWorker();
  await w.lifecycle("install");
  await w.lifecycle("activate");
  w.state.fetched = [];
});

const text = async (r: Promise<Response | null>) => (await r)!.text();

test("online, a place's page always comes from the network: the reading is current and the visit counts", async () => {
  await w.page("/c/lucknow");
  w.state.reading = 2;
  assert.equal(await text(w.page("/c/lucknow")), `/c/lucknow reading 2${NOTE}`);
  assert.deepEqual(w.state.fetched, ["/c/lucknow", "/c/lucknow"]);
});

test("offline, a place opened before shows its last reading, with the note saying so shown", async () => {
  await w.page("/c/26.85,80.95");
  w.state.online = false;
  const res = (await w.page("/c/26.85,80.95"))!;
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /reading 1/);
  assert.ok(body.includes(`<p id="${OFFLINE_NOTE_ID}">`), "the note is no longer hidden");
});

test("a server outage shows the last reading too, rather than the error", async () => {
  await w.page("/hi/c/lucknow?as=asthma");
  w.state.down = true;
  const body = await text(w.page("/hi/c/lucknow?as=asthma"));
  assert.match(body, /reading 1/);
  assert.ok(body.includes(`<p id="${OFFLINE_NOTE_ID}">`));
});

test("offline, a place never opened here gets a plain offline page, as a 503, in the page's language", async () => {
  w.state.online = false;
  const res = (await w.page("/kn/c/mysuru"))!;
  assert.equal(res.status, 503);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
  const body = await res.text();
  assert.match(body, /lang="kn"/);
  assert.match(body, /href="\/"/);
});

test("the home page is saved when the worker installs, so the installed app opens offline", async () => {
  const fresh = makeWorker();
  await fresh.lifecycle("install");
  fresh.state.online = false;
  assert.equal(await text(fresh.page("/")), "home /");
});

test("the installed app's start URL (?src=pwa) opens the saved home offline, and saves no second copy", async () => {
  const fresh = makeWorker();
  await fresh.lifecycle("install");
  await fresh.page("/hi?src=pwa"); // online: the launch is fetched as is, so it is counted
  assert.ok(fresh.state.fetched.includes("/hi?src=pwa"));
  assert.deepEqual(fresh.saved().sort(), ["/", "/hi"]);
  fresh.state.online = false;
  assert.equal(await text(fresh.page("/?src=pwa")), "home /");
  assert.equal(await text(fresh.page("/hi?src=pwa")), "home /hi");
});

test("keeps the last reading of the 20 most recently opened places, and no more", async () => {
  for (let i = 0; i < 22; i++) await w.page(`/c/place-${i}`);
  await w.page("/c/place-0"); // opened again: now the most recent
  const places = w.saved().filter((p) => p.includes("/c/"));
  assert.equal(places.length, 20);
  assert.ok(places.includes("/c/place-0"));
  assert.ok(!places.includes("/c/place-1") && !places.includes("/c/place-2"));
  assert.ok(w.saved().includes("/"), "the home page is not pushed out by places");
});

test("never touches data, images, the API, POSTs, other pages' copies or other sites", async () => {
  assert.equal(await w.request("/c/lucknow.json"), null);
  assert.equal(await w.request("/og.png"), null);
  assert.equal(await w.request("/api/counts"), null);
  assert.equal(await w.request("https://static.cloudflareinsights.com/beacon.min.js"), null);
  assert.equal(await w.request("/c/lucknow", { method: "POST", body: "x", mode: "navigate" }), null);
  // Other pages are fetched as normal and never saved.
  await w.page("/about");
  assert.ok(!w.saved().includes("/about"));
});

test("/sw.js is served as a script the browser always re-checks", async () => {
  const res = serviceWorker();
  assert.equal(SW_PATH, "/sw.js");
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
  assert.equal(res.headers.get("cache-control"), "no-cache");
  assert.equal(await res.text(), SW_JS);
});

// --- the pages ---------------------------------------------------------------------

// The full reading the page tests use (test/page.test.ts); its air reading is from 13:35 IST.
const C: Conditions = {
  location: { lat: 12.97, lon: 77.59 },
  as_of: "2026-10-23T08:35:00.000Z",
  air_as_of: "2026-10-23T08:05:00.000Z",
  air: {
    aqi: 57,
    band: "satisfactory",
    pollutants: { pm25: 25 },
    yll: 1.96,
    station: { id: "airnet-x", name: "Kumarapark", city: "Bengaluru", distance_km: 2.29 },
    source: "airnet",
  },
  heat: { temp_c: 22, humidity_pct: 80, apparent_c: 24, wet_bulb_c: 20, source: "open-meteo" },
  rain: { precipitation_mm: 0, source: "open-meteo" },
  uv: { index: 0, source: "open-meteo" },
  dust: { dust_ug_m3: 3, aod: 0.16, source: "open-meteo" },
  attribution: "Sources: Airnet / CSTEP via OAQ · Open-Meteo (CC-BY 4.0) — via mugilu",
  disclaimer: "Informational only — not for medical, emergency, or safety-critical decisions.",
};

test("a place's page carries the hidden last-reading note, with the reading's time and a warning that things may have changed", () => {
  const html = renderConditionsPage(C, "everyone", "https://mugilu.live/c/bengaluru");
  const note = html.match(new RegExp(`<p [^>]*id="${OFFLINE_NOTE_ID}" hidden>([\\s\\S]*?)</p>`));
  assert.ok(note, "the note is on the page, hidden");
  assert.match(note[1], /13:35 IST · 23 Oct/);
  assert.match(note[1], /warnings may have changed/i);
});

test("ordinary pages register the worker; the kiosk display and the embed card do not", () => {
  assert.ok(renderHome().includes(SW_REGISTER));
  const kiosk = renderKioskPage(C, "everyone", "https://mugilu.live/c/bengaluru", "<svg></svg>");
  const embed = renderEmbed(C, "everyone", "https://mugilu.live");
  assert.ok(!kiosk.includes(SW_REGISTER));
  assert.ok(!embed.includes(SW_REGISTER));
});

test("offline, the real page's note is the one the worker shows, with the reading's time", async () => {
  w.state.page = renderConditionsPage(C, "everyone", "https://mugilu.live/c/bengaluru", "hi");
  await w.page("/hi/c/bengaluru");
  w.state.online = false;
  const html = await text(w.page("/hi/c/bengaluru"));
  const shown = html.match(new RegExp(`<p [^>]*id="${OFFLINE_NOTE_ID}">([\\s\\S]*?)</p>`));
  assert.ok(shown, "the note is shown");
  assert.match(shown[1], /13:35 IST · 23 Oct/);
  assert.match(shown[1], /कनेक्शन नहीं है/);
});

// --- alerts ------------------------------------------------------------------------

const pushOf = (message: unknown) => ({ data: { json: () => message } });

test("an alert arriving shows as a notification, one per warning, that opens the place", async () => {
  const message = {
    title: "Lightning · Severe",
    body: "Official warning for Kavali",
    url: "/c/14.91,79.99",
    tag: "warning-1",
  };
  await w.dispatch("push", pushOf(message));
  assert.equal(w.shown.length, 1);
  const { title, options } = w.shown[0];
  assert.equal(title, "Lightning · Severe");
  assert.equal(options.body, "Official warning for Kavali");
  assert.equal(options.tag, "warning-1");
  // Made inside the sandbox, so compared by value.
  assert.equal(JSON.stringify(options.data), JSON.stringify({ url: "/c/14.91,79.99" }));

  const notification = { data: options.data, close: () => {} };
  await w.dispatch("notificationclick", { notification });
  assert.deepEqual(w.opened, [`${ORIGIN}/c/14.91,79.99`]);
});

test("tapping an alert focuses the place's page when it is already open", async () => {
  let focused = false;
  w.windows.push({ url: `${ORIGIN}/c/14.91,79.99`, focused: false, focus: async () => void (focused = true) });
  await w.dispatch("notificationclick", { notification: { data: { url: "/c/14.91,79.99" }, close: () => {} } });
  assert.ok(focused);
  assert.deepEqual(w.opened, []);
});

test("an alert that cannot be read still shows, and a link to another site opens mugilu instead", async () => {
  await w.dispatch("push", {
    data: {
      json: () => {
        throw new SyntaxError("bad");
      },
    },
  });
  assert.equal(w.shown[0].title, "mugilu");
  await w.dispatch("notificationclick", { notification: { data: { url: "https://evil.example/" }, close: () => {} } });
  assert.deepEqual(w.opened, [`${ORIGIN}/`]);
});
