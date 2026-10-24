import { refreshLatest } from "./refresh";
import { refreshHierarchy } from "./hierarchy";
import { getSignature } from "./handshake";
import { renderSnapshotMarkdown, renderStationMarkdown } from "./formats";
import { renderStationOg, renderConditionsOg, renderHomeOg } from "./og";
import { faviconSvg, iconPng } from "./icon";
import { ICONS, MANIFEST_PATH, webManifest } from "./install";
import { SW_PATH, serviceWorker } from "./sw";
import { handleSubscribe, handleUnsubscribe, runAlerts } from "./alerts";
import { findNearest, parseLatLon } from "./near";
import { renderConditionsMarkdown, serializeConditionsV1, REFRESH_AFTER_SECONDS } from "./conditions";
import { lookupConditions, recordUsage, type LookupFormat } from "./lookup";
import { cacheKey, edgeServe } from "./edge";
import {
  renderConditionsPage,
  renderKioskPage,
  renderDisplayBuilder,
  renderHome,
  renderAbout,
  renderTerms,
  renderPlaces,
  renderNotFound,
  renderEmbed,
  renderWarningsPage,
  renderMethodology,
} from "./page";
import { qrSvg } from "./qr";
import { lp, type Lang } from "./i18n";
import { robotsTxt, llmsTxt, sitemapXml, openApiSpec } from "./meta";
import { geocodeList } from "./geocode";
import { buildSuggestions } from "./suggest";
import { collectConditions } from "./collect";
import { collectWarnings, renderWarningsMarkdown } from "./sachet";
import { collectFires } from "./firms";
import { composeHighlights } from "./highlights";
import { topPlaces, topReferrers, counters, pruneReferrers, requestCaller, POPULAR_MIN } from "./metrics";
import { parsePersona } from "./score";
import type { Persona } from "./score";
import { placeBySlug, slugForName } from "./slugs";
import { resolveQuery } from "./resolve";
import { loadGazetteer } from "./gazetteer";
import { loadSnapshot, loadWarningsSnapshot } from "./snapshot";
import { adminGate } from "./admin";
import { handleMcp } from "./mcp";
import type { Conditions, NormalizedStation } from "./types";

export interface Env {
  OAQ_KV: KVNamespace;
  OAQ_R2: R2Bucket;
  OAQ_API_KEY: string;
  /** Gates the admin routes (manual triggers, usage counts); see admin.ts. */
  ADMIN_KEY?: string;
  OAQ_BROKER_URL: string;
  OAQ_BASE_URL: string;
  /** NASA FIRMS map key for the fire/crop-burn smoke layer (optional). */
  FIRMS_MAP_KEY?: string;
  /** First-party, aggregate usage counters (D1). No IP, no per-user data. */
  METRICS: D1Database;
  /** Anonymous behaviour event stream (Analytics Engine). No IP, no user id. */
  EVENTS?: AnalyticsEngineDataset;
  /** Opt-in alerts (alerts.ts): mugilu's VAPID key pair. Both set turns alerts on; the private key is a secret (JWK). */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

/** Standard cached, CORS-open API response for a given body + content-type.
 *  Pass `clientMaxAge` (seconds) on the "build-on" data surfaces (JSON, Markdown,
 *  /embed) so a browser, iframe or plain HTTP client also caches for that long, not
 *  shared caches. Without it a browser gets no max-age, so an embed or poller had no
 *  directive telling it "this only changes every 15 min" and could re-fetch every
 *  second for identical bytes. The human HTML pages deliberately omit it, so a manual
 *  reload always revalidates (with the Worker, which may answer from its own edge
 *  cache, edge.ts; `s-maxage` here is for any cache in front of that). */
function cachedResponse(body: string, contentType: string, clientMaxAge?: number): Response {
  const cc = clientMaxAge
    ? `public, max-age=${clientMaxAge}, s-maxage=900, stale-while-revalidate=3600`
    : "public, s-maxage=900, stale-while-revalidate=3600";
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": cc,
      "access-control-allow-origin": "*",
    },
  });
}

// Edge-cache lifetimes (edge.ts), separate from the Cache-Control a client sees
// (cachedResponse), which a hit restores. A hit on a conditions surface still records
// its usage, so the demand, behaviour and adopter metrics count every request.
/** Live data (conditions, embed, home, warnings, leaderboard, stations): the
 *  weather upstream is itself cached 15 min and air/warnings move hourly. */
const LIVE_EDGE_TTL = 300;
/** Output fixed by the deployed code (front-door files, static pages, manifest):
 *  short enough that a deploy shows within 15 minutes. */
const STATIC_EDGE_TTL = 900;
/** Rendered images that never change between deploys (icons, the share card). */
const IMAGE_EDGE_TTL = 86_400;

/** Whether opt-in alerts are set up (both VAPID keys present). */
const alertsOn = (env: Env) => !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

/** 400 with a JSON `{ error }` body (CORS-open), matching the API error shape. */
/** The one message for a coordinate that fails parseLatLon (bad, or outside India). */
const BAD_COORDS = "valid coordinates in India are required (mugilu covers India only)";

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { "access-control-allow-origin": "*" } });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    const SITE_URL = "https://mugilu.live"; // TODO: wire via env

    // Canonical host: send www → apex (301), preserving path + query.
    if (url.hostname === "www.mugilu.live") {
      return Response.redirect(`${SITE_URL}${url.pathname}${url.search}`, 301);
    }

    // Language prefix (/hi, /kn): detect, strip to the language-agnostic path so
    // every downstream route matches unchanged, and thread `lang` into the
    // user-facing renderers. English stays unprefixed (its URLs are canonical).
    let lang: Lang = "en";
    const langMatch = url.pathname.match(/^\/(hi|kn)(?=\/|$)/);
    if (langMatch) {
      lang = langMatch[1] as Lang;
      url.pathname = url.pathname.slice(3) || "/";
    }

    // Admin routes, gated in one place (admin.ts) so a new one can't skip it.
    // After the language strip, so /hi/refresh is gated like /refresh.
    const denied = adminGate(url.pathname, req, env);
    if (denied) return denied;

    // Who the request is from, by kind only (metrics.ts): read from this request's
    // own headers, so an edge-cache hit is classified like a fresh render.
    const caller = requestCaller(req, lang);

    // Serve a response that is the same for every viewer from the edge cache, keyed on
    // the path as received (language prefix included) plus only `params`. A build
    // that returns { store: false } (data missing for a passing reason) is served
    // but not stored.
    type Built = Response | { res: Response; store: boolean };
    const cached = (ttl: number, build: () => Built | Promise<Built>, params?: Record<string, string | undefined>) =>
      edgeServe(req, ctx, cacheKey(req, params), ttl, async () => {
        const b = await build();
        return b instanceof Response ? { res: b } : b;
      });

    if (url.pathname === "/health") {
      return Response.json({ ok: true, ts: new Date().toISOString() });
    }

    // MCP server (the agent front-door): JSON-RPC 2.0 over Streamable HTTP.
    if (url.pathname === "/mcp") {
      return handleMcp(req, env, ctx);
    }

    if (url.pathname === "/about") {
      return cached(STATIC_EDGE_TTL, () => cachedResponse(renderAbout(lang), "text/html; charset=utf-8"));
    }

    // Glass-box methodology: how the Ambient read + thresholds work.
    if (url.pathname === "/methodology") {
      return cached(STATIC_EDGE_TTL, () => cachedResponse(renderMethodology(lang), "text/html; charset=utf-8"));
    }

    // "Put it on a screen" builder: pick a place, open the self-refreshing kiosk view.
    if (url.pathname === "/display") {
      const as = parsePersona(url.searchParams.get("as"));
      return cached(STATIC_EDGE_TTL, () => cachedResponse(renderDisplayBuilder(as, lang), "text/html; charset=utf-8"), {
        as: as === "everyone" ? undefined : as,
      });
    }

    // Terms & attribution (the disclaimer in every API response points here).
    if (url.pathname === "/terms") {
      return cached(STATIC_EDGE_TTL, () => cachedResponse(renderTerms(lang), "text/html; charset=utf-8"));
    }

    // The place directory: every named /c/{slug} page, grouped by state. A crawlable
    // index that gives search engines a path to all ~800 place pages (and readers a
    // way to browse), so they aren't discoverable only through the sitemap.
    if (url.pathname === "/places") {
      return cached(STATIC_EDGE_TTL, () => cachedResponse(renderPlaces(lang), "text/html; charset=utf-8"));
    }

    // Crawler + agent front-door files, built from the live route set. Edge-cached:
    // deterministic, and the sitemap (rebuilt each call) gets walked by crawlers.
    if (url.pathname === "/robots.txt") {
      return cached(STATIC_EDGE_TTL, () => cachedResponse(robotsTxt(SITE_URL), "text/plain; charset=utf-8"));
    }
    if (url.pathname === "/llms.txt") {
      return cached(STATIC_EDGE_TTL, () => cachedResponse(llmsTxt(SITE_URL), "text/plain; charset=utf-8"));
    }
    if (url.pathname === "/sitemap.xml") {
      return cached(STATIC_EDGE_TTL, () => cachedResponse(sitemapXml(SITE_URL), "application/xml; charset=utf-8"));
    }
    // OpenAPI spec for the REST API (also serves as ChatGPT Custom-GPT Actions).
    if (url.pathname === "/openapi.json") {
      return cached(STATIC_EDGE_TTL, () =>
        cachedResponse(JSON.stringify(openApiSpec(SITE_URL), null, 2), "application/json; charset=utf-8"),
      );
    }

    if (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico") return faviconSvg();
    if (url.pathname === "/apple-touch-icon.png") return cached(IMAGE_EDGE_TTL, () => iconPng());
    // The PWA service worker (sw.ts): no-cache, so an update reaches browsers at once.
    if (url.pathname === SW_PATH) return serviceWorker();
    // Opt-in alerts for official warnings (alerts.ts).
    if (url.pathname === "/push/subscribe" && alertsOn(env)) return handleSubscribe(req, env);
    if (url.pathname === "/push/unsubscribe" && alertsOn(env)) return handleUnsubscribe(req, env);
    // PWA: web app manifest + its PNG icons (install.ts). Deterministic, so edge-cached.
    if (url.pathname === MANIFEST_PATH) {
      return cached(STATIC_EDGE_TTL, () =>
        cachedResponse(JSON.stringify(webManifest(lang)), "application/manifest+json"),
      );
    }
    const icon = ICONS[url.pathname as keyof typeof ICONS];
    if (icon) return cached(IMAGE_EDGE_TTL, () => iconPng(icon.size, icon.maskable));
    // Branded social-share card for the home + content pages (workers-og render).
    if (url.pathname === "/og.png") return cached(IMAGE_EDGE_TTL, () => renderHomeOg());

    // Lookup-first home page. Heat/dust highlights come from the 4-hourly grid;
    // the worst-air row from the hourly snapshot (fresher), each stamped with
    // its own age, and the air point's state resolved from the grid.
    if (url.pathname === "/") {
      const notfound = url.searchParams.get("notfound") ?? undefined;
      const home = async () => {
        const [hl, popular] = await Promise.all([
          composeHighlights(env),
          topPlaces(env, 8, POPULAR_MIN), // public: only places past a decent threshold
        ]);
        // Only show the "Right now in India" hero when there's something in it.
        const highlights =
          hl.highlights.hottest || hl.highlights.dustiest || hl.highlights.worstAir ? hl.highlights : undefined;
        const res = cachedResponse(
          renderHome(notfound, highlights, { gridAsOf: hl.gridAsOf, airAsOf: hl.airAsOf, popular }, lang),
          "text/html; charset=utf-8",
        );
        // A missing grid or air snapshot leaves the hero partial: served, not stored.
        return { res, store: hl.complete };
      };
      // A "not found" echo carries the visitor's own search: built fresh, never stored.
      return notfound === undefined ? cached(LIVE_EDGE_TTL, home) : (await home()).res;
    }

    // Internal usage metrics for our own improvement, NOT public. Key-gated and
    // never cached. Aggregate, privacy-preserving (rounded coords, no IP). The
    // public only ever sees these via the server-rendered home "Popular".
    if (url.pathname === "/api/counts") {
      const [places, formats, referrers] = await Promise.all([
        topPlaces(env, 50),
        counters(env),
        topReferrers(env, 50),
      ]);
      return new Response(JSON.stringify({ places, formats, referrers }, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    // Resolve a place name to coordinates and redirect to its conditions page.
    // Keeps search zero-JS. A plain form GET. /go?q=Bengaluru → 302 /c/{lat},{lon}
    if (url.pathname === "/go") {
      const q = (url.searchParams.get("q") ?? "").trim();
      // Carry the typed term in the fragment (client-only, no cache impact) so a
      // native-script search ("ಬೆಂಗಳೂರು") is remembered in its own script in recents.
      const frag = q ? `#q=${encodeURIComponent(q)}` : "";
      const r = await resolveQuery(q, await loadGazetteer(env));
      if (!r) return Response.redirect(`${url.origin}${lp("/", lang)}?notfound=${encodeURIComponent(q)}`, 302);
      // A known place keeps its canonical /c/{slug} keyword URL; else the coordinate.
      const dest = r.slug ? `/c/${r.slug}` : `/c/${r.lat},${r.lon}`;
      // The display builder routes its search through here: carry ?kiosk (+ persona).
      const asP = parsePersona(url.searchParams.get("as"));
      const qs = url.searchParams.has("kiosk") ? `?kiosk${asP !== "everyone" ? `&as=${asP}` : ""}` : "";
      return Response.redirect(`${url.origin}${lp(dest, lang)}${qs}${frag}`, 302);
    }

    // Typeahead suggestions: gazetteer (our stations) + alias + coord-parse +
    // India-ranked geocoding. Powers the intelligent search box. /suggest?q=…
    if (url.pathname === "/suggest") {
      const q = url.searchParams.get("q") ?? "";
      return cached(
        LIVE_EDGE_TTL,
        async () => {
          const [snap, gaz] = await Promise.all([loadSnapshot(env), loadGazetteer(env)]);
          const suggestions = await buildSuggestions(snap?.stations ?? [], q, geocodeList, 6, gaz);
          return cachedResponse(JSON.stringify({ q, suggestions }), "application/json; charset=utf-8");
        },
        { q },
      );
    }

    // Leaderboard JSON and Markdown.
    if (url.pathname === "/index.json" || url.pathname === "/index.md") {
      return cached(LIVE_EDGE_TTL, async () => {
        const snap = await loadSnapshot(env);
        if (!snap) return new Response("no snapshot yet", { status: 503 });
        return url.pathname === "/index.json"
          ? cachedResponse(JSON.stringify(snap), "application/json; charset=utf-8", REFRESH_AFTER_SECONDS)
          : cachedResponse(
              renderSnapshotMarkdown(snap, SITE_URL),
              "text/markdown; charset=utf-8",
              REFRESH_AFTER_SECONDS,
            );
      });
    }

    // National active warnings: the SACHET archive made readable, not just
    // point-queried on /c. /warnings (HTML) · /warnings.json · /warnings.md
    if (url.pathname === "/warnings" || url.pathname === "/warnings.json" || url.pathname === "/warnings.md") {
      return cached(LIVE_EDGE_TTL, async () => {
        // A failed read is shown like a missing snapshot, and neither is stored: a
        // cached "no alerts" page could hide a live warning from everyone.
        const snap = await loadWarningsSnapshot(env).catch(() => null);
        if (url.pathname === "/warnings.json") {
          if (!snap) return new Response("no warnings snapshot yet", { status: 503 });
          return cachedResponse(JSON.stringify(snap), "application/json; charset=utf-8", REFRESH_AFTER_SECONDS);
        }
        const res =
          url.pathname === "/warnings.md"
            ? cachedResponse(renderWarningsMarkdown(snap), "text/markdown; charset=utf-8", REFRESH_AFTER_SECONDS)
            : cachedResponse(renderWarningsPage(snap, lang), "text/html; charset=utf-8");
        return { res, store: snap !== null };
      });
    }

    // Nearest air-quality stations to a point, haversine over the snapshot
    // already in memory. The lat/lng entry point for the air layer (A2).
    if (url.pathname === "/near") {
      const coords = parseLatLon(url.searchParams.get("lat"), url.searchParams.get("lon"));
      if (!coords) return badRequest(BAD_COORDS);
      const { lat, lon } = coords;
      const nRaw = Number(url.searchParams.get("n") ?? "5");
      const n = Number.isFinite(nRaw) ? Math.min(Math.max(1, Math.trunc(nRaw)), 50) : 5;
      return cached(
        LIVE_EDGE_TTL,
        async () => {
          const snap = await loadSnapshot(env);
          if (!snap) return new Response("no snapshot yet", { status: 503 });
          const stations = findNearest(snap.stations, lat, lon, n);
          return cachedResponse(
            JSON.stringify(
              { query: { lat, lon, n }, generated_at: snap.generated_at, count: stations.length, stations },
              null,
              2,
            ),
            "application/json; charset=utf-8",
          );
        },
        { lat: String(lat), lon: String(lon), n: String(n) },
      );
    }

    // Shared renderer for both /c/{lat},{lon} and the named /c/{slug}. Builds the
    // conditions, records metrics, and serves the requested format. `canonicalPath`
    // is the URL this page should be indexed as (the named slug, or the coordinate).
    async function serveConditions(
      lat: number,
      lon: number,
      ext: string | undefined,
      persona: Persona,
      canonicalPath: string,
      placeName?: string,
    ): Promise<Response> {
      const kiosk = !ext && url.searchParams.has("kiosk");
      const fmt: LookupFormat = kiosk ? "kiosk" : ((ext ?? "html") as LookupFormat);
      // Same output for every viewer of this path + persona + kiosk flag: served from
      // the edge when warm (the CPU-heavy PNG render included), usage still recorded.
      const key = cacheKey(req, { as: persona === "everyone" ? undefined : persona, kiosk: kiosk ? "" : undefined });
      return edgeServe(
        req,
        ctx,
        key,
        LIVE_EDGE_TTL,
        async () => {
          // A named slug owns its label (so /c/bengaluru reads "Bengaluru", not the
          // ward the seed coordinate happens to fall in), drives title/h1/meta/SEO.
          const { conditions, usage } = await lookupConditions(env, ctx, { lat, lon, persona, fmt, label: placeName });
          // A reading built while an upstream was down is served, never cached.
          const res = renderConditions(conditions, ext, kiosk, persona, canonicalPath, placeName);
          return { res, usage, store: !conditions.degraded };
        },
        (usage, served) => recordUsage(env, ctx, usage, { fmt, caller, req, url, served }),
      );
    }

    function renderConditions(
      conditions: Conditions,
      ext: string | undefined,
      kiosk: boolean,
      persona: Persona,
      canonicalPath: string,
      placeName?: string,
    ): Response {
      // Canonical: the slug for a named page; for a coordinate page that lands on a
      // named district, canonicalise to that slug so /c/26.84,80.90 doesn't compete
      // with /c/lucknow for the same place. Arbitrary points stay self-canonical.
      let canonical = `${SITE_URL}${canonicalPath}`;
      if (!placeName && conditions.place) {
        const s = slugForName(conditions.place.split(",")[0]);
        if (s) canonical = `${SITE_URL}/c/${s}`;
      }
      if (ext === "png") return renderConditionsOg(conditions, persona);
      if (ext === "json")
        return cachedResponse(
          JSON.stringify(serializeConditionsV1(conditions, persona), null, 2),
          "application/json; charset=utf-8",
          REFRESH_AFTER_SECONDS,
        );
      if (ext === "md")
        return cachedResponse(
          renderConditionsMarkdown(conditions, persona),
          "text/markdown; charset=utf-8",
          REFRESH_AFTER_SECONDS,
        );
      if (kiosk) {
        const qrTarget = persona === "everyone" ? canonical : `${canonical}?as=${persona}`;
        return cachedResponse(
          renderKioskPage(conditions, persona, canonical, qrSvg(qrTarget), lang),
          "text/html; charset=utf-8",
        );
      }
      return cachedResponse(
        renderConditionsPage(conditions, persona, canonical, lang, alertsOn(env) ? env.VAPID_PUBLIC_KEY : undefined),
        "text/html; charset=utf-8",
      );
    }

    // Conditions at a coordinate: /c/{lat},{lon}.{json,md,png}
    const condMatch = url.pathname.match(/^\/c\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\.(json|md|png))?$/);
    if (condMatch) {
      const [, latStr, lonStr, ext] = condMatch;
      const coords = parseLatLon(latStr, lonStr);
      if (!coords) return badRequest(BAD_COORDS);
      return serveConditions(
        coords.lat,
        coords.lon,
        ext,
        parsePersona(url.searchParams.get("as")),
        `/c/${latStr},${lonStr}`,
      );
    }

    // Named place: /c/{slug}.{json,md,png} (e.g. /c/lucknow), keyword URLs for
    // search. Resolve the slug to its centroid and serve the same conditions.
    const slugMatch = url.pathname.match(/^\/c\/([a-z][a-z0-9-]*)(?:\.(json|md|png))?$/);
    if (slugMatch) {
      const [, slug, ext] = slugMatch;
      const place = placeBySlug(slug);
      if (!place)
        return new Response(renderNotFound(lang), {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      const label = place.state ? `${place.name}, ${place.state}` : place.name;
      return serveConditions(place.lat, place.lon, ext, parsePersona(url.searchParams.get("as")), `/c/${slug}`, label);
    }

    // Embeddable conditions widget (the "build on it" surface): a compact card
    // others drop into an <iframe>. /embed/{lat},{lon}: framable (no X-Frame
    // restriction is set), carries a copy-paste snippet and links back.
    const embedMatch = url.pathname.match(/^\/embed\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (embedMatch) {
      const [, latStr, lonStr] = embedMatch;
      const coords = parseLatLon(latStr, lonStr);
      if (!coords) return badRequest(BAD_COORDS);
      const persona = parsePersona(url.searchParams.get("as"));
      return edgeServe(
        req,
        ctx,
        cacheKey(req, { as: persona === "everyone" ? undefined : persona }),
        LIVE_EDGE_TTL,
        async () => {
          const { conditions, usage } = await lookupConditions(env, ctx, { ...coords, persona, fmt: "embed" });
          const res = cachedResponse(
            renderEmbed(conditions, persona, SITE_URL, lang),
            "text/html; charset=utf-8",
            REFRESH_AFTER_SECONDS,
          );
          return { res, usage, store: !conditions.degraded };
        },
        (usage, served) => recordUsage(env, ctx, usage, { fmt: "embed", caller, req, url, served }),
      );
    }

    // Per-station OG image: /og/s/{provider}/{raw_id}.png (rendered via workers-og).
    const ogMatch = url.pathname.match(/^\/og\/s\/([^/]+)\/([^/.]+)\.png$/);
    if (ogMatch) {
      const [, provider, rawId] = ogMatch;
      // A CPU-heavy render: edge-cached, and query params cannot force a re-render.
      return cached(LIVE_EDGE_TTL, async () => {
        const snap = await loadSnapshot(env);
        if (!snap) return new Response("no snapshot yet", { status: 503 });
        const station = snap.stations.find((s: NormalizedStation) => s.provider === provider && s.raw_id === rawId);
        if (!station) return new Response("station not found", { status: 404 });
        return renderStationOg(station, snap.generated_at);
      });
    }

    // Per-station JSON / Markdown: /s/{provider}/{raw_id}.{json,md}
    const stationMatch = url.pathname.match(/^\/s\/([^/]+)\/([^/.]+)\.(json|md)$/);
    if (stationMatch) {
      const [, provider, rawId, ext] = stationMatch;
      return cached(LIVE_EDGE_TTL, async () => {
        const snap = await loadSnapshot(env);
        if (!snap) return new Response("no snapshot yet", { status: 503 });
        const station = snap.stations.find((s: NormalizedStation) => s.provider === provider && s.raw_id === rawId);
        if (!station) return new Response("station not found", { status: 404 });
        return ext === "json"
          ? cachedResponse(
              JSON.stringify({ generated_at: snap.generated_at, station }),
              "application/json; charset=utf-8",
              REFRESH_AFTER_SECONDS,
            )
          : cachedResponse(
              renderStationMarkdown(station, snap.generated_at, SITE_URL),
              "text/markdown; charset=utf-8",
              REFRESH_AFTER_SECONDS,
            );
      });
    }

    // Public R2 proxy for dev and for the build script. In production we'll
    // front R2 with a custom domain and skip this hop, but during local dev
    // the build script fetches http://127.0.0.1:8787/data/latest.json.
    if (url.pathname.startsWith("/data/")) {
      const key = url.pathname.slice(1); // "data/latest.json"
      const obj = await env.OAQ_R2.get(key);
      if (!obj) return new Response("not found", { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("cache-control", "public, max-age=60");
      return new Response(obj.body, { headers });
    }

    // Manual trigger for local dev & smoke tests: /refresh (Authorization: Bearer ADMIN_KEY).
    if (url.pathname === "/refresh") {
      try {
        const snap = await refreshLatest(env);
        return Response.json({
          ok: true,
          generated_at: snap.generated_at,
          station_count: snap.station_count,
          providers: snap.providers,
          sample: snap.stations.slice(0, 3),
        });
      } catch (e) {
        return Response.json({ ok: false, error: String(e) }, { status: 500 });
      }
    }

    // Manual trigger: collect the national conditions grid. /collect (Authorization: Bearer ADMIN_KEY)
    if (url.pathname === "/collect") {
      try {
        const snap = await collectConditions(env);
        return Response.json({
          ok: true,
          generated_at: snap.generated_at,
          point_count: snap.point_count,
          sample: snap.points.slice(0, 3),
        });
      } catch (e) {
        return Response.json({ ok: false, error: String(e) }, { status: 500 });
      }
    }

    // Manual trigger: poll + archive SACHET warnings. /warnings/collect (Authorization: Bearer ADMIN_KEY)
    if (url.pathname === "/warnings/collect") {
      try {
        return Response.json({ ok: true, ...(await collectWarnings(env)) });
      } catch (e) {
        return Response.json({ ok: false, error: String(e) }, { status: 500 });
      }
    }

    // Manual trigger: poll + archive FIRMS fire detections. /fires/collect (Authorization: Bearer ADMIN_KEY)
    if (url.pathname === "/fires/collect") {
      try {
        return Response.json({ ok: true, ...(await collectFires(env)) });
      } catch (e) {
        return Response.json({ ok: false, error: String(e) }, { status: 500 });
      }
    }

    // Debug: peek at the current signature without exposing it.
    if (url.pathname === "/sig") {
      const sig = await getSignature(env);
      return Response.json({
        baseUrl: sig.baseUrl,
        expires: sig.expires,
        expires_iso: new Date(sig.expires * 1000).toISOString(),
        signature_prefix: sig.signature.slice(0, 24) + "…",
      });
    }

    // Unknown path: a real 404 (this used to return 200 with a debug string).
    return new Response(renderNotFound(lang), {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("[scheduled]", event.cron, new Date(event.scheduledTime).toISOString());
    // Hourly refresh.
    if (event.cron === "5 * * * *") {
      ctx.waitUntil(
        refreshLatest(env).then(
          (snap) => console.log(`[refresh] ${snap.station_count} stations`),
          (e) => console.error("[refresh] failed:", e),
        ),
      );
      ctx.waitUntil(
        collectWarnings(env).then(
          (r) => console.log(`[warnings] ${r.changed ? `${r.count} active, ${r.archived} new` : "no change"}`),
          (e) => console.error("[warnings] failed:", e),
        ),
      );
      if (alertsOn(env))
        ctx.waitUntil(
          runAlerts(env).then(
            (r) =>
              console.log(
                `[alerts] ${r.points} places checked, ${r.found} warnings over them, ${r.sent} sent, ${r.failed} to retry, ${r.gone} gone`,
              ),
            (e) => console.error("[alerts] failed:", e),
          ),
        );
      ctx.waitUntil(
        collectFires(env).then(
          (r) => console.log(`[firms] ${r.count} detections`),
          (e) => console.error("[firms] failed:", e),
        ),
      );
    }
    // National conditions grid every 4h, ~6 collects/day fits Open-Meteo's free quota.
    if (event.cron === "5 */4 * * *") {
      ctx.waitUntil(
        collectConditions(env).then(
          (s) => console.log(`[collect] ${s.point_count} points`),
          (e) => console.error("[collect] failed:", e),
        ),
      );
    }
    // Daily hierarchy refresh.
    if (event.cron === "30 20 * * *") {
      ctx.waitUntil(
        refreshHierarchy(env).then(
          (r) => console.log(`[hierarchy] providers=${r.providers} hierarchies=${r.hierarchies}`),
          (e) => console.error("[hierarchy] failed:", e),
        ),
      );
      ctx.waitUntil(pruneReferrers(env).catch((e) => console.error("[referrers] prune failed:", e)));
    }
  },
};
