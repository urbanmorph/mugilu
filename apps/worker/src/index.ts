import { refreshLatest } from "./refresh";
import { refreshHierarchy } from "./hierarchy";
import { getSignature } from "./handshake";
import { renderSnapshotMarkdown, renderStationMarkdown } from "./formats";
import { renderStationOg, renderConditionsOg, renderHomeOg } from "./og";
import { faviconSvg, appleIconPng } from "./icon";
import { findNearest, parseLatLon } from "./near";
import { buildConditions, renderConditionsMarkdown, serializeConditionsV1, REFRESH_AFTER_SECONDS } from "./conditions";
import {
  renderConditionsPage,
  renderKioskPage,
  renderDisplayBuilder,
  renderHome,
  renderAbout,
  renderTerms,
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
import type { WarningsSnapshot } from "./sachet";
import { collectFires, loadFires } from "./firms";
import { composeHighlights } from "./highlights";
import { recordLookup, recordReferrer, recordEvent, topPlaces, topReferrers, counters, POPULAR_MIN } from "./metrics";
import { parsePersona } from "./score";
import type { Persona } from "./score";
import { placeBySlug, slugForName } from "./slugs";
import { resolveQuery } from "./resolve";
import { loadGazetteer } from "./gazetteer";
import { loadSnapshot } from "./snapshot";
import { handleMcp } from "./mcp";
import type { NormalizedStation } from "./types";

export interface Env {
  OAQ_KV: KVNamespace;
  OAQ_R2: R2Bucket;
  OAQ_API_KEY: string;
  OAQ_BROKER_URL: string;
  OAQ_BASE_URL: string;
  /** NASA FIRMS map key for the fire/crop-burn smoke layer (optional). */
  FIRMS_MAP_KEY?: string;
  /** First-party, aggregate usage counters (D1). No IP, no per-user data. */
  METRICS: D1Database;
  /** Anonymous behaviour event stream (Analytics Engine). No IP, no user id. */
  EVENTS?: AnalyticsEngineDataset;
}

/** Standard cached, CORS-open API response for a given body + content-type.
 *  Pass `clientMaxAge` (seconds) on the "build-on" data surfaces (JSON, Markdown,
 *  /embed) so a browser, iframe or plain HTTP client also caches for that long, not
 *  just shared/CDN caches. Without it we only send `s-maxage`, which a browser
 *  ignores, so an embed or poller had no directive telling it "this only changes
 *  every 15 min" and could re-fetch every second for identical bytes. The human
 *  HTML pages deliberately omit it, so a manual reload always revalidates. */
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

/** Serve a deterministic, render-heavy response from the Cloudflare edge cache:
 *  return the cached copy on a hit (skipping the work), else build it and store it.
 *  Used for the static front-door files and the OG image renders (workers-og is
 *  CPU-heavy and these get hammered by social crawlers on launch). NOT used for the
 *  conditions HTML/JSON/MD, which run per request so the demand, behaviour and
 *  crawler analytics stay intact (a cache hit would record nothing). */
async function edgeCache(
  req: Request,
  ctx: ExecutionContext,
  build: () => Response | Promise<Response>,
): Promise<Response> {
  const cache = caches.default;
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await build();
  if (res.status !== 200) return res;
  // Buffer the body so the served and cached copies are independent. A streaming
  // response (the workers-og image renders) cannot be cloned into the cache safely;
  // tee-ing it deadlocks. arrayBuffer() drains the render once, then both copies are
  // plain bytes.
  const body = await res.arrayBuffer();
  const out = new Response(body, { status: res.status, headers: res.headers });
  ctx.waitUntil(cache.put(req, out.clone()));
  return out;
}

/** 400 with a JSON `{ error }` body (CORS-open), matching the API error shape. */
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

    if (url.pathname === "/health") {
      return Response.json({ ok: true, ts: new Date().toISOString() });
    }

    // MCP server (the agent front-door): JSON-RPC 2.0 over Streamable HTTP.
    if (url.pathname === "/mcp") {
      return handleMcp(req, env, ctx);
    }

    if (url.pathname === "/about") {
      return cachedResponse(renderAbout(lang), "text/html; charset=utf-8");
    }

    // Glass-box methodology: how the Ambient read + thresholds work.
    if (url.pathname === "/methodology") {
      return cachedResponse(renderMethodology(lang), "text/html; charset=utf-8");
    }

    // "Put it on a screen" builder: pick a place, open the self-refreshing kiosk view.
    if (url.pathname === "/display") {
      return cachedResponse(
        renderDisplayBuilder(parsePersona(url.searchParams.get("as")), lang),
        "text/html; charset=utf-8",
      );
    }

    // Terms & attribution (the disclaimer in every API response points here).
    if (url.pathname === "/terms") {
      return cachedResponse(renderTerms(lang), "text/html; charset=utf-8");
    }

    // Crawler + agent front-door files, built from the live route set. Edge-cached:
    // deterministic, and the sitemap (rebuilt each call) gets walked by crawlers.
    if (url.pathname === "/robots.txt") {
      return edgeCache(req, ctx, () => cachedResponse(robotsTxt(SITE_URL), "text/plain; charset=utf-8"));
    }
    if (url.pathname === "/llms.txt") {
      return edgeCache(req, ctx, () => cachedResponse(llmsTxt(SITE_URL), "text/plain; charset=utf-8"));
    }
    if (url.pathname === "/sitemap.xml") {
      return edgeCache(req, ctx, () => cachedResponse(sitemapXml(SITE_URL), "application/xml; charset=utf-8"));
    }
    // OpenAPI spec for the REST API (also serves as ChatGPT Custom-GPT Actions).
    if (url.pathname === "/openapi.json") {
      return edgeCache(req, ctx, () =>
        cachedResponse(JSON.stringify(openApiSpec(SITE_URL), null, 2), "application/json; charset=utf-8"),
      );
    }

    if (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico") return faviconSvg();
    if (url.pathname === "/apple-touch-icon.png") return appleIconPng();
    // Branded social-share card for the home + content pages (workers-og render).
    if (url.pathname === "/og.png") return edgeCache(req, ctx, () => renderHomeOg());

    // Lookup-first home page. Heat/dust highlights come from the 4-hourly grid;
    // the worst-air row from the hourly snapshot (fresher), each stamped with
    // its own age, and the air point's state resolved from the grid.
    if (url.pathname === "/") {
      const [hl, popular] = await Promise.all([
        composeHighlights(env),
        topPlaces(env, 8, POPULAR_MIN), // public: only places past a decent threshold
      ]);
      // Only show the "Right now in India" hero when there's something in it.
      const highlights =
        hl.highlights.hottest || hl.highlights.dustiest || hl.highlights.worstAir ? hl.highlights : undefined;
      return cachedResponse(
        renderHome(
          url.searchParams.get("notfound") ?? undefined,
          highlights,
          {
            gridAsOf: hl.gridAsOf,
            airAsOf: hl.airAsOf,
            popular,
          },
          lang,
        ),
        "text/html; charset=utf-8",
      );
    }

    // Internal usage metrics for our own improvement, NOT public. Key-gated and
    // never cached. Aggregate, privacy-preserving (rounded coords, no IP). The
    // public only ever sees these via the server-rendered home "Popular".
    if (url.pathname === "/api/counts") {
      if (url.searchParams.get("key") !== env.OAQ_API_KEY) return new Response("unauthorized", { status: 401 });
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
      const [snap, gaz] = await Promise.all([loadSnapshot(env), loadGazetteer(env)]);
      const suggestions = await buildSuggestions(snap?.stations ?? [], q, geocodeList, 6, gaz);
      return cachedResponse(JSON.stringify({ q, suggestions }), "application/json; charset=utf-8");
    }

    // Cached snapshot loader, used by /index.{json,md} and /s/*.json|.md.

    // Leaderboard JSON.
    if (url.pathname === "/index.json") {
      const snap = await loadSnapshot(env);
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      return cachedResponse(JSON.stringify(snap), "application/json; charset=utf-8", REFRESH_AFTER_SECONDS);
    }

    // Leaderboard Markdown.
    if (url.pathname === "/index.md") {
      const snap = await loadSnapshot(env);
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      return cachedResponse(
        renderSnapshotMarkdown(snap, SITE_URL),
        "text/markdown; charset=utf-8",
        REFRESH_AFTER_SECONDS,
      );
    }

    // National active warnings: the SACHET archive made readable, not just
    // point-queried on /c. /warnings (HTML) · /warnings.json · /warnings.md
    if (url.pathname === "/warnings" || url.pathname === "/warnings.json" || url.pathname === "/warnings.md") {
      const obj = await env.OAQ_R2.get("data/warnings.json");
      // .json returns the stored payload verbatim (no parse + re-serialize).
      if (url.pathname === "/warnings.json") {
        if (!obj) return new Response("no warnings snapshot yet", { status: 503 });
        return cachedResponse(await obj.text(), "application/json; charset=utf-8", REFRESH_AFTER_SECONDS);
      }
      const snap = obj ? ((await obj.json()) as WarningsSnapshot) : null;
      if (url.pathname === "/warnings.md") {
        return cachedResponse(renderWarningsMarkdown(snap), "text/markdown; charset=utf-8", REFRESH_AFTER_SECONDS);
      }
      return cachedResponse(renderWarningsPage(snap, lang), "text/html; charset=utf-8");
    }

    // Nearest air-quality stations to a point, haversine over the snapshot
    // already in memory. The lat/lng entry point for the air layer (A2).
    if (url.pathname === "/near") {
      const coords = parseLatLon(url.searchParams.get("lat"), url.searchParams.get("lon"));
      if (!coords) return badRequest("valid `lat` and `lon` query params are required");
      const { lat, lon } = coords;
      const nRaw = Number(url.searchParams.get("n") ?? "5");
      const n = Number.isFinite(nRaw) ? Math.min(Math.max(1, Math.trunc(nRaw)), 50) : 5;
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
      // The share-image render is deterministic and CPU-heavy (workers-og): serve it
      // from the edge when warm, so social-crawler bursts on launch do not re-render.
      if (ext === "png") {
        const hit = await caches.default.match(req);
        if (hit) return hit;
      }
      const [snap, fires] = await Promise.all([loadSnapshot(env), loadFires(env)]);
      const conditions = await buildConditions(snap, lat, lon, fires);
      // A named slug owns its label (so /c/bengaluru reads "Bengaluru", not the
      // ward the seed coordinate happens to fall in), drives title/h1/meta/SEO.
      if (placeName) conditions.place = placeName;
      // Canonical: the slug for a named page; for a coordinate page that lands on a
      // named district, canonicalise to that slug so /c/26.84,80.90 doesn't compete
      // with /c/lucknow for the same place. Arbitrary points stay self-canonical.
      let canonical = `${SITE_URL}${canonicalPath}`;
      if (!placeName && conditions.place) {
        const s = slugForName(conditions.place.split(",")[0]);
        if (s) canonical = `${SITE_URL}/c/${s}`;
      }
      const ua = req.headers.get("user-agent");
      const kiosk = !ext && url.searchParams.has("kiosk");
      const fmt = kiosk ? "kiosk" : (ext ?? "html");
      // A kiosk is one persistent display refreshing itself, not demand: keep it out
      // of the D1 place heatmap (and its write budget). Analytics Engine still counts
      // it via fmt, so display adoption stays visible.
      if (!kiosk) ctx.waitUntil(recordLookup(env, lat, lon, conditions.place, ext ?? "html", ua));
      // API formats (.json/.md/.png) are a "build on it" surface. Capture who.
      if (ext) ctx.waitUntil(recordReferrer(env, "api", req, url));
      recordEvent(env, conditions, persona, fmt, ua); // anonymous behaviour event
      if (ext === "png") {
        const og = renderConditionsOg(conditions, persona);
        // Buffer the image bytes before caching: the streaming render cannot be
        // safely cloned into the cache (tee-ing it deadlocks).
        const body = await og.arrayBuffer();
        const out = new Response(body, { status: og.status, headers: og.headers });
        ctx.waitUntil(caches.default.put(req, out.clone()));
        return out;
      }
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
      return cachedResponse(renderConditionsPage(conditions, persona, canonical, lang), "text/html; charset=utf-8");
    }

    // Conditions at a coordinate: /c/{lat},{lon}.{json,md,png}
    const condMatch = url.pathname.match(/^\/c\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\.(json|md|png))?$/);
    if (condMatch) {
      const [, latStr, lonStr, ext] = condMatch;
      const coords = parseLatLon(latStr, lonStr);
      if (!coords) return badRequest("coordinates out of range");
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
      if (!coords) return badRequest("coordinates out of range");
      const persona = parsePersona(url.searchParams.get("as"));
      const [snap, fires] = await Promise.all([loadSnapshot(env), loadFires(env)]);
      const conditions = await buildConditions(snap, coords.lat, coords.lon, fires);
      ctx.waitUntil(
        recordLookup(env, coords.lat, coords.lon, conditions.place, "embed", req.headers.get("user-agent")),
      );
      ctx.waitUntil(recordReferrer(env, "embed", req, url));
      return cachedResponse(
        renderEmbed(conditions, persona, SITE_URL, lang),
        "text/html; charset=utf-8",
        REFRESH_AFTER_SECONDS,
      );
    }

    // Per-station OG image: /og/s/{provider}/{raw_id}.png (rendered via workers-og).
    const ogMatch = url.pathname.match(/^\/og\/s\/([^/]+)\/([^/.]+)\.png$/);
    if (ogMatch) {
      const [, provider, rawId] = ogMatch;
      const snap = await loadSnapshot(env);
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      const station = snap.stations.find((s: NormalizedStation) => s.provider === provider && s.raw_id === rawId);
      if (!station) return new Response("station not found", { status: 404 });
      return renderStationOg(station, snap.generated_at);
    }

    // Per-station JSON / Markdown: /s/{provider}/{raw_id}.{json,md}
    const stationMatch = url.pathname.match(/^\/s\/([^/]+)\/([^/.]+)\.(json|md)$/);
    if (stationMatch) {
      const [, provider, rawId, ext] = stationMatch;
      const snap = await loadSnapshot(env);
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      const station = snap.stations.find((s: NormalizedStation) => s.provider === provider && s.raw_id === rawId);
      if (!station) return new Response("station not found", { status: 404 });
      if (ext === "json") {
        return cachedResponse(
          JSON.stringify({ generated_at: snap.generated_at, station }),
          "application/json; charset=utf-8",
          REFRESH_AFTER_SECONDS,
        );
      }
      return cachedResponse(
        renderStationMarkdown(station, snap.generated_at, SITE_URL),
        "text/markdown; charset=utf-8",
        REFRESH_AFTER_SECONDS,
      );
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

    // Manual trigger for local dev & smoke tests: /refresh?key=OAQ_API_KEY.
    if (url.pathname === "/refresh") {
      const key = url.searchParams.get("key");
      if (key !== env.OAQ_API_KEY) return new Response("unauthorized", { status: 401 });
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

    // Manual trigger: collect the national conditions grid. /collect?key=OAQ_API_KEY
    if (url.pathname === "/collect") {
      const key = url.searchParams.get("key");
      if (key !== env.OAQ_API_KEY) return new Response("unauthorized", { status: 401 });
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

    // Manual trigger: poll + archive SACHET warnings. /warnings/collect?key=OAQ_API_KEY
    if (url.pathname === "/warnings/collect") {
      const key = url.searchParams.get("key");
      if (key !== env.OAQ_API_KEY) return new Response("unauthorized", { status: 401 });
      try {
        return Response.json({ ok: true, ...(await collectWarnings(env)) });
      } catch (e) {
        return Response.json({ ok: false, error: String(e) }, { status: 500 });
      }
    }

    // Manual trigger: poll + archive FIRMS fire detections. /fires/collect?key=OAQ_API_KEY
    if (url.pathname === "/fires/collect") {
      const key = url.searchParams.get("key");
      if (key !== env.OAQ_API_KEY) return new Response("unauthorized", { status: 401 });
      try {
        return Response.json({ ok: true, ...(await collectFires(env)) });
      } catch (e) {
        return Response.json({ ok: false, error: String(e) }, { status: 500 });
      }
    }

    // Debug: peek at the current signature without exposing it.
    if (url.pathname === "/sig") {
      const key = url.searchParams.get("key");
      if (key !== env.OAQ_API_KEY) return new Response("unauthorized", { status: 401 });
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
    }
  },
};
