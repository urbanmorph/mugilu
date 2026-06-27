import { refreshLatest } from "./refresh";
import { refreshHierarchy } from "./hierarchy";
import { getSignature } from "./handshake";
import { renderSnapshotMarkdown, renderStationMarkdown } from "./formats";
import { renderStationOg, renderConditionsOg } from "./og";
import { faviconSvg, appleIconPng } from "./icon";
import { findNearest, parseLatLon } from "./near";
import { buildConditions, renderConditionsMarkdown } from "./conditions";
import { renderConditionsPage, renderHome, renderAbout, renderTerms, renderNotFound, renderEmbed } from "./page";
import { robotsTxt, llmsTxt, sitemapXml } from "./meta";
import { geocode, geocodeList } from "./geocode";
import { buildSuggestions } from "./suggest";
import { collectConditions } from "./collect";
import { collectWarnings } from "./sachet";
import { nationalHighlights } from "./highlights";
import { ambientRisk, parsePersona } from "./score";
import type { Snapshot, NormalizedStation, ConditionsSnapshot } from "./types";

export interface Env {
  OAQ_KV: KVNamespace;
  OAQ_R2: R2Bucket;
  OAQ_API_KEY: string;
  OAQ_BROKER_URL: string;
  OAQ_BASE_URL: string;
}

/** Standard cached, CORS-open API response for a given body + content-type. */
function cachedResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
      "access-control-allow-origin": "*",
    },
  });
}

/** 400 with a JSON `{ error }` body (CORS-open), matching the API error shape. */
function badRequest(message: string): Response {
  return Response.json(
    { error: message },
    { status: 400, headers: { "access-control-allow-origin": "*" } },
  );
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    const SITE_URL = "https://mugilu.live"; // TODO: wire via env

    // Canonical host: send www → apex (301), preserving path + query.
    if (url.hostname === "www.mugilu.live") {
      return Response.redirect(`${SITE_URL}${url.pathname}${url.search}`, 301);
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, ts: new Date().toISOString() });
    }

    if (url.pathname === "/about") {
      return cachedResponse(renderAbout(), "text/html; charset=utf-8");
    }

    // Terms & attribution (the disclaimer in every API response points here).
    if (url.pathname === "/terms") {
      return cachedResponse(renderTerms(), "text/html; charset=utf-8");
    }

    // Crawler + agent front-door files, built from the live route set.
    if (url.pathname === "/robots.txt") {
      return cachedResponse(robotsTxt(SITE_URL), "text/plain; charset=utf-8");
    }
    if (url.pathname === "/llms.txt") {
      return cachedResponse(llmsTxt(SITE_URL), "text/plain; charset=utf-8");
    }
    if (url.pathname === "/sitemap.xml") {
      return cachedResponse(sitemapXml(SITE_URL), "application/xml; charset=utf-8");
    }

    if (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico") return faviconSvg();
    if (url.pathname === "/apple-touch-icon.png") return appleIconPng();

    // Lookup-first home page.
    if (url.pathname === "/") {
      const obj = await env.OAQ_R2.get("data/conditions.json");
      const highlights = obj
        ? nationalHighlights(((await obj.json()) as ConditionsSnapshot).points)
        : undefined;
      return cachedResponse(
        renderHome(url.searchParams.get("notfound") ?? undefined, highlights),
        "text/html; charset=utf-8",
      );
    }

    // Resolve a place name to coordinates and redirect to its conditions page.
    // Keeps search zero-JS. A plain form GET. /go?q=Bengaluru → 302 /c/{lat},{lon}
    if (url.pathname === "/go") {
      const q = (url.searchParams.get("q") ?? "").trim();
      const hit = await geocode(q);
      if (!hit) {
        return Response.redirect(`${url.origin}/?notfound=${encodeURIComponent(q)}`, 302);
      }
      const lat = +hit.lat.toFixed(4);
      const lon = +hit.lon.toFixed(4);
      return Response.redirect(`${url.origin}/c/${lat},${lon}`, 302);
    }

    // Typeahead suggestions: gazetteer (our stations) + alias + coord-parse +
    // India-ranked geocoding. Powers the intelligent search box. /suggest?q=…
    if (url.pathname === "/suggest") {
      const q = url.searchParams.get("q") ?? "";
      const snap = await loadSnapshot();
      const suggestions = await buildSuggestions(snap?.stations ?? [], q, geocodeList);
      return cachedResponse(JSON.stringify({ q, suggestions }), "application/json; charset=utf-8");
    }

    // Cached snapshot loader, used by /index.{json,md} and /s/*.json|.md.
    async function loadSnapshot(): Promise<Snapshot | null> {
      const obj = await env.OAQ_R2.get("data/latest.json");
      if (!obj) return null;
      return (await obj.json()) as Snapshot;
    }

    // Leaderboard JSON.
    if (url.pathname === "/index.json") {
      const snap = await loadSnapshot();
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      return new Response(JSON.stringify(snap), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
          "access-control-allow-origin": "*",
        },
      });
    }

    // Leaderboard Markdown.
    if (url.pathname === "/index.md") {
      const snap = await loadSnapshot();
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      return new Response(renderSnapshotMarkdown(snap, SITE_URL), {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
          "access-control-allow-origin": "*",
        },
      });
    }

    // Nearest air-quality stations to a point, haversine over the snapshot
    // already in memory. The lat/lng entry point for the air layer (A2).
    if (url.pathname === "/near") {
      const coords = parseLatLon(url.searchParams.get("lat"), url.searchParams.get("lon"));
      if (!coords) return badRequest("valid `lat` and `lon` query params are required");
      const { lat, lon } = coords;
      const nRaw = Number(url.searchParams.get("n") ?? "5");
      const n = Number.isFinite(nRaw) ? Math.min(Math.max(1, Math.trunc(nRaw)), 50) : 5;
      const snap = await loadSnapshot();
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

    // Conditions at a coordinate (A4): nearest-station air + Open-Meteo
    // heat/rain/uv/dust, assembled into the normalized schema.
    // /c/{lat},{lon}.{json,md}
    const condMatch = url.pathname.match(/^\/c\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:\.(json|md|png))?$/);
    if (condMatch) {
      const [, latStr, lonStr, ext] = condMatch;
      const coords = parseLatLon(latStr, lonStr);
      if (!coords) return badRequest("coordinates out of range");
      const { lat, lon } = coords;
      const persona = parsePersona(url.searchParams.get("as"));
      const snap = await loadSnapshot();
      const conditions = await buildConditions(snap, lat, lon);
      if (ext === "png") {
        return renderConditionsOg(conditions, persona);
      }
      if (ext === "json") {
        const body = { ...conditions, ambient: ambientRisk(conditions, persona) };
        return cachedResponse(JSON.stringify(body, null, 2), "application/json; charset=utf-8");
      }
      if (ext === "md") {
        return cachedResponse(renderConditionsMarkdown(conditions, persona), "text/markdown; charset=utf-8");
      }
      return cachedResponse(renderConditionsPage(conditions, persona), "text/html; charset=utf-8");
    }

    // Embeddable conditions widget (the "build on it" surface): a compact card
    // others drop into an <iframe>. /embed/{lat},{lon} — framable (no X-Frame
    // restriction is set), carries a copy-paste snippet and links back.
    const embedMatch = url.pathname.match(/^\/embed\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (embedMatch) {
      const [, latStr, lonStr] = embedMatch;
      const coords = parseLatLon(latStr, lonStr);
      if (!coords) return badRequest("coordinates out of range");
      const persona = parsePersona(url.searchParams.get("as"));
      const snap = await loadSnapshot();
      const conditions = await buildConditions(snap, coords.lat, coords.lon);
      return cachedResponse(renderEmbed(conditions, persona, SITE_URL), "text/html; charset=utf-8");
    }

    // Per-station OG image: /og/s/{provider}/{raw_id}.png (rendered via workers-og).
    const ogMatch = url.pathname.match(/^\/og\/s\/([^/]+)\/([^/.]+)\.png$/);
    if (ogMatch) {
      const [, provider, rawId] = ogMatch;
      const snap = await loadSnapshot();
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      const station = snap.stations.find(
        (s: NormalizedStation) => s.provider === provider && s.raw_id === rawId,
      );
      if (!station) return new Response("station not found", { status: 404 });
      return renderStationOg(station, snap.generated_at);
    }

    // Per-station JSON / Markdown: /s/{provider}/{raw_id}.{json,md}
    const stationMatch = url.pathname.match(/^\/s\/([^/]+)\/([^/.]+)\.(json|md)$/);
    if (stationMatch) {
      const [, provider, rawId, ext] = stationMatch;
      const snap = await loadSnapshot();
      if (!snap) return new Response("no snapshot yet", { status: 503 });
      const station = snap.stations.find(
        (s: NormalizedStation) => s.provider === provider && s.raw_id === rawId,
      );
      if (!station) return new Response("station not found", { status: 404 });
      if (ext === "json") {
        return new Response(
          JSON.stringify({ generated_at: snap.generated_at, station }),
          {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
              "access-control-allow-origin": "*",
            },
          },
        );
      }
      return new Response(renderStationMarkdown(station, snap.generated_at, SITE_URL), {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
          "access-control-allow-origin": "*",
        },
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
    return new Response(renderNotFound(), {
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
          (r) =>
            console.log(`[warnings] ${r.changed ? `${r.count} active, ${r.archived} new` : "no change"}`),
          (e) => console.error("[warnings] failed:", e),
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
