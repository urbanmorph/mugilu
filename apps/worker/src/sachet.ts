import type { Warning } from "./types";
import type { Env } from "./index";

// NDMA SACHET: official disaster warnings (the IMD-replacement layer). The
// location-wise endpoint does the point→alert spatial match for us, so /c
// warnings need no feed parsing or point-in-polygon. SACHET is .gov.in (edge
// geo-firewall risk), so this is time-boxed and failure-tolerant: a slow or
// blocked response just yields no warnings and /c still renders.

const LOCATION_ALERTS_URL = "https://sachet.ndma.gov.in/cap_public_website/FetchLocationWiseAlerts";

interface RawAlert {
  severity?: string;
  identifier?: number | string;
  effective_end_time?: string;
  disaster_type?: string;
  area_description?: string;
  severity_level?: string;
  severity_color?: string;
  warning_message?: string;
  alert_source?: string;
}

/** "Sat Jun 27 14:00:00 IST 2026" → "Sat Jun 27, 14:00". */
function shortTime(t: string): string {
  const m = t.match(/^(\w+ \w+ \d+)\s+(\d{1,2}:\d{2})/);
  return m ? `${m[1]}, ${m[2]}` : t;
}

/** Official warnings active at a point, via SACHET's location-wise endpoint. */
export async function getLocationAlerts(lat: number, lon: number, radiusKm = 40): Promise<Warning[]> {
  const url = `${LOCATION_ALERTS_URL}?lat=${lat}&long=${lon}&radius=${radiusKm}`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 300, cacheEverything: true },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { alerts?: RawAlert[] };
    return (body.alerts ?? []).map((a) => ({
      event: a.disaster_type ?? "Alert",
      severity: a.severity ?? "",
      color: a.severity_color ?? "",
      certainty: a.severity_level ?? "",
      area: a.area_description ?? "",
      issuer: a.alert_source ?? "",
      until: a.effective_end_time ? shortTime(a.effective_end_time) : "",
      identifier: String(a.identifier ?? ""),
      headline: a.warning_message ?? "",
    }));
  } catch {
    return [];
  }
}

// ── National warning feed: poll → serve current → archive history (the moat) ──
// SACHET only ever exposes *currently active* alerts; once one expires it's gone.
// So we capture every alert as we see it and keep it forever, building a warning
// history nobody else holds. Polling is ETag-cheap (304 when nothing changed).

const FEED_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml";

export interface FeedAlert {
  identifier: string;
  headline: string;
  category: string;
  issuer: string;
  link: string; // → FetchXMLFile for the full CAP
  sent: string; // pubDate
}

export interface WarningsSnapshot {
  generated_at: string;
  count: number;
  alerts: FeedAlert[];
}

/** Inner text of the first <name>…</name> in an item, CDATA-stripped. */
function rssTag(item: string, name: string): string {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/** Parse the SACHET national RSS feed into a list of active alerts. */
export function parseSachetRss(xml: string): FeedAlert[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((it) => ({
      identifier: rssTag(it, "guid"),
      headline: rssTag(it, "title"),
      category: rssTag(it, "category"),
      issuer: rssTag(it, "author"),
      link: rssTag(it, "link"),
      sent: rssTag(it, "pubDate"),
    }))
    .filter((a) => a.identifier);
}

/**
 * Poll the national feed (ETag-cached), write the current active list, and
 * archive any alert we haven't seen before. Dedup is tracked in KV so an
 * unchanged feed costs one 304 and steady state costs near-zero writes.
 */
export async function collectWarnings(
  env: Env,
): Promise<{ changed: boolean; count: number; archived: number }> {
  const etag = await env.OAQ_KV.get("sachet:etag");
  const res = await fetch(FEED_URL, {
    headers: etag ? { "If-None-Match": etag } : {},
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 304) return { changed: false, count: 0, archived: 0 };
  if (!res.ok) throw new Error(`sachet feed ${res.status}`);

  const alerts = parseSachetRss(await res.text());
  const newEtag = res.headers.get("etag");
  if (newEtag) await env.OAQ_KV.put("sachet:etag", newEtag);

  const snapshot: WarningsSnapshot = {
    generated_at: new Date().toISOString(),
    count: alerts.length,
    alerts,
  };
  await env.OAQ_R2.put("data/warnings.json", JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=300" },
  });

  const seenRaw = await env.OAQ_KV.get("sachet:seen");
  const seen = new Set<string>(seenRaw ? (JSON.parse(seenRaw) as string[]) : []);
  let archived = 0;
  for (const a of alerts) {
    if (seen.has(a.identifier)) continue;
    await env.OAQ_R2.put(
      `archive/sachet/${a.identifier}.json`,
      JSON.stringify({ ...a, first_seen: snapshot.generated_at }),
      { httpMetadata: { contentType: "application/json" } },
    );
    seen.add(a.identifier);
    archived++;
  }
  if (archived) await env.OAQ_KV.put("sachet:seen", JSON.stringify([...seen]));

  return { changed: true, count: alerts.length, archived };
}
