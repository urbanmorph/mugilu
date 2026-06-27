import type { Env } from "./index";
import { getSignature, signUrl } from "./handshake";
import { PROVIDERS } from "./types";

/**
 * Daily job: fetch meta/providers.json and per-provider meta/hierarchy.json,
 * merge, and write to R2 as data/stations.json (stable metadata reference).
 * The hourly bulk already carries coordinates, so this file is a nice-to-have
 * for consumers that want just the station directory without live readings.
 */
export async function refreshHierarchy(env: Env): Promise<{ providers: number; hierarchies: number }> {
  const sig = await getSignature(env);
  const providersUrl = signUrl(sig, "meta/providers.json");
  const pRes = await fetch(providersUrl);
  if (!pRes.ok) throw new Error(`providers.json fetch failed: ${pRes.status}`);
  const providersJson = (await pRes.json()) as unknown;

  const hierarchies: Record<string, unknown> = {};
  for (const p of PROVIDERS) {
    try {
      const hUrl = signUrl(sig, `provider=${p}/meta/hierarchy.json`);
      const hRes = await fetch(hUrl);
      if (!hRes.ok) {
        console.warn(`[hierarchy] ${p}: HTTP ${hRes.status}`);
        continue;
      }
      hierarchies[p] = await hRes.json();
    } catch (e) {
      console.error(`[hierarchy] ${p}:`, e);
    }
  }

  const stations = {
    generated_at: new Date().toISOString(),
    providers: providersJson,
    hierarchies,
  };

  await env.OAQ_R2.put("data/stations.json", JSON.stringify(stations, null, 2), {
    httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=3600" },
  });
  await env.OAQ_R2.put("data/providers.json", JSON.stringify(providersJson, null, 2), {
    httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=86400" },
  });

  return {
    providers: Array.isArray((providersJson as { providers?: unknown[] }).providers)
      ? (providersJson as { providers: unknown[] }).providers.length
      : 0,
    hierarchies: Object.keys(hierarchies).length,
  };
}
