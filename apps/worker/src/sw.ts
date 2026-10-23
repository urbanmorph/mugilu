// The offline worker: mugilu shows the sky *now*, so it never answers from a
// cache while the network works (every page is fetched, so readings are current
// and visits still count). What it adds:
//   - each place's page (/c/...) is saved on the device when it loads, the 20
//     most recently opened, plus the home page (saved at install, so the
//     installed app opens offline and lists "Your places");
//   - with no connection, or a server error, a saved place shows its last
//     reading, and the page's hidden "last reading" note (OFFLINE_NOTE_ID,
//     rendered with the reading's time) is shown;
//   - any other page with no connection gets a small offline page, as a 503.
// Data (.json/.md/.png), the API, POSTs and other sites go straight to the network.

import { LANGS, t, type Lang } from "./i18n";

export const SW_PATH = "/sw.js";
/** The id of the conditions page's hidden note that the worker shows on a saved copy. */
export const OFFLINE_NOTE_ID = "offline-reading";
/** How many places keep their last reading. */
const KEEP = 20;

/** Registers the worker on ordinary pages (not the kiosk display or the embed card). */
export const SW_REGISTER = `if('serviceWorker'in navigator)navigator.serviceWorker.register('${SW_PATH}',{updateViaCache:'none'}).catch(function(){});`;

function offlinePage(lang: Lang): string {
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${t("You are offline", lang)} · mugilu</title><body style="font:17px/1.5 system-ui,sans-serif;max-width:36em;margin:0 auto;padding:24px"><h1>${t("You are offline", lang)}</h1><p>${t("mugilu shows the sky right now, so it needs a connection. Places you have opened on this device keep their last reading.", lang)}</p><p><a href="/">${t("See your places", lang)}</a></p>`;
}
const OFFLINE_PAGES = Object.fromEntries(LANGS.map((L) => [L, offlinePage(L)]));

export const SW_JS = String.raw`const CACHE = 'mugilu-readings';
const KEEP = ${KEEP};
const HIDDEN = 'id="${OFFLINE_NOTE_ID}" hidden';
const OFFLINE = ${JSON.stringify(OFFLINE_PAGES)};
// A place's page, by name or coordinate (/c/lucknow, /hi/c/26.85,80.95), not its data files.
const isPlace = (path) => /^(\/(hi|kn))?\/c\/[^/]+$/.test(path) && !/\.(json|md|png)$/.test(path);
const isHome = (path) => /^(\/(hi|kn))?\/?$/.test(path);
const langOf = (path) => (path.match(/^\/(hi|kn)(\/|$)/) || [])[1] || 'en';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // The home page, so the installed app opens offline; a failure here never stops the install.
  event.waitUntil(caches.open(CACHE).then((c) => c.add(new Request('/', { cache: 'reload' }))).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.registration.navigationPreload?.enable();
    await self.clients.claim();
  })());
});

/** Saves a page, then keeps only the KEEP most recently opened places (a put moves an entry to the end). */
async function keep(key, response) {
  const cache = await caches.open(CACHE);
  await cache.put(key, response);
  const places = (await cache.keys()).filter((r) => isPlace(new URL(r.url).pathname));
  for (const old of places.slice(0, -KEEP)) await cache.delete(old);
}

/** The saved copy of a page, with its last-reading note shown. */
async function saved(key) {
  const copy = await caches.match(key, { cacheName: CACHE });
  if (!copy) return undefined;
  const html = (await copy.text()).replace(HIDDEN, 'id="${OFFLINE_NOTE_ID}"');
  return new Response(html, { status: 200, headers: copy.headers });
}

const offline = (path) =>
  new Response(OFFLINE[langOf(path)], { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });

async function page(event, url) {
  const key = url.pathname + url.search;
  const save = isPlace(url.pathname) || isHome(url.pathname);
  try {
    const response = (await event.preloadResponse) || (await fetch(event.request));
    if (response.status >= 500 && save) return (await saved(key)) || response;
    if (save && response.ok && (response.headers.get('content-type') || '').startsWith('text/html')) {
      // A full disk only means this copy is not saved.
      event.waitUntil(keep(key, response.clone()).catch(() => {}));
    }
    return response;
  } catch {
    return (save && (await saved(key))) || offline(url.pathname);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin) return;
  event.respondWith(page(event, url));
});
`;

/** /sw.js: no-cache, so browsers always see a new version. */
export function serviceWorker(): Response {
  return new Response(SW_JS, {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
  });
}
