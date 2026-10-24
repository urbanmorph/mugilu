import type { Warning } from "./types";
import type { Env } from "./index";
import { WARNINGS_KEY, putJson } from "./snapshot";
import { inRing, type Ring } from "./india";
import { counted } from "./metrics";

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
  area_json?: string; // the alert's area: GeoJSON (Multi)Polygon, mandal-level
}

/** Whether an alert's area (GeoJSON Polygon or MultiPolygon, holes respected)
 *  covers the point; undefined when the area is missing or unreadable. */
export function areaCovers(areaJson: unknown, lat: number, lon: number): boolean | undefined {
  try {
    const g = (typeof areaJson === "string" ? JSON.parse(areaJson) : areaJson) as {
      type?: string;
      coordinates?: unknown;
    };
    const polygons = (
      g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : []
    ) as Ring[][];
    if (!Array.isArray(polygons) || !polygons.length) return undefined;
    return polygons.some(
      ([outer, ...holes]) => !!outer && inRing(outer, lon, lat) && !holes.some((h) => inRing(h, lon, lat)),
    );
  } catch {
    return undefined;
  }
}

/** Warnings over the spot, and those only nearby. An alert whose area is unknown
 *  counts as over the spot: a warning is never hidden for lack of a polygon. */
export function splitWarnings<W extends Pick<Warning, "covers">>(ws: W[]): { here: W[]; nearby: W[] } {
  return { here: ws.filter((w) => w.covers !== false), nearby: ws.filter((w) => w.covers === false) };
}

/** "Sat Jun 27 14:00:00 IST 2026" → "Sat Jun 27, 14:00". */
function shortTime(t: string): string {
  const m = t.match(/^(\w+ \w+ \d+)\s+(\d{1,2}:\d{2})/);
  return m ? `${m[1]}, ${m[2]}` : t;
}

/** Official warnings active at a point, via SACHET's location-wise endpoint, or null
 *  when SACHET failed or timed out (so a caller can tell "none" from "unknown"). The
 *  2.5 s default suits a page render; the hourly alerts check allows longer,
 *  since it shares the cron's few open connections with the other jobs. */
export async function fetchLocationAlerts(
  lat: number,
  lon: number,
  radiusKm = 40,
  timeoutMs = 2500,
): Promise<Warning[] | null> {
  const url = `${LOCATION_ALERTS_URL}?lat=${lat}&long=${lon}&radius=${radiusKm}`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 300, cacheEverything: true },
      // Tight bound on the /c cold path: SACHET is a slow gov API, and warnings
      // are an enrichment, don't let it hold up the whole page.
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
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
      covers: areaCovers(a.area_json, lat, lon),
    }));
  } catch {
    return null;
  }
}

/** fetchLocationAlerts, with a failure read as no warnings. */
export const getLocationAlerts = async (...args: Parameters<typeof fetchLocationAlerts>): Promise<Warning[]> =>
  (await fetchLocationAlerts(...args)) ?? [];

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

/** An alert id is forgotten once it has been out of the feed this long. Alerts run
 *  for hours to days, so one that has been gone a month will not come back; the
 *  archive copy stays. Without this the record grew by every alert ever issued. */
const SEEN_DAYS = 30;

/** The seen-ids record: id -> when it was last in the feed (ms). The old format was a
 *  bare id list; its ids count as seen now, so none is archived again. */
function readSeen(raw: string | null, now: number): Record<string, number> {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as string[] | Record<string, number>;
  return Array.isArray(parsed) ? Object.fromEntries(parsed.map((id) => [id, now])) : parsed;
}

function pruneSeen(seen: Record<string, number>, now: number): Record<string, number> {
  const cutoff = now - SEEN_DAYS * 86_400_000;
  return Object.fromEntries(Object.entries(seen).filter(([, last]) => last >= cutoff));
}

/**
 * Poll the national feed (ETag-cached), write the current active list, and
 * archive any alert we haven't seen before. Dedup is tracked in KV so an
 * unchanged feed costs one 304 and steady state costs near-zero writes.
 */
export async function collectWarnings(env: Env): Promise<{ changed: boolean; count: number; archived: number }> {
  const etag = await env.OAQ_KV.get("sachet:etag");
  // The feed call and its body are the upstream step (counted as err:upstream:sachet).
  const body = await counted(env, "sachet", async () => {
    const res = await fetch(FEED_URL, {
      headers: etag ? { "If-None-Match": etag } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 304) return null;
    if (!res.ok) throw new Error(`sachet feed ${res.status}`);
    return { text: await res.text(), etag: res.headers.get("etag") };
  });
  if (!body) return { changed: false, count: 0, archived: 0 };

  const alerts = parseSachetRss(body.text);

  const snapshot: WarningsSnapshot = {
    generated_at: new Date().toISOString(),
    count: alerts.length,
    alerts,
  };
  await putJson(env, WARNINGS_KEY, JSON.stringify(snapshot), "public, max-age=300");

  const now = Date.now();
  const seen = readSeen(await env.OAQ_KV.get("sachet:seen"), now);
  let archived = 0;
  for (const a of alerts) {
    if (!(a.identifier in seen)) {
      await env.OAQ_R2.put(
        `archive/sachet/${a.identifier}.json`,
        JSON.stringify({ ...a, first_seen: snapshot.generated_at }),
        { httpMetadata: { contentType: "application/json" } },
      );
      archived++;
    }
    seen[a.identifier] = now;
  }
  // Only a changed feed gets here (an unchanged one is a 304), so this is at most
  // one KV write per feed change.
  await env.OAQ_KV.put("sachet:seen", JSON.stringify(pruneSeen(seen, now)));
  // Remember the ETag only now that the snapshot and archive are written: saved
  // earlier, a failed write would turn every later poll into a 304 on stale data.
  if (body.etag) await env.OAQ_KV.put("sachet:etag", body.etag);

  return { changed: true, count: alerts.length, archived };
}

/** Markdown of the national active-warnings list (the /warnings.md sibling). */
export function renderWarningsMarkdown(snap: WarningsSnapshot | null): string {
  const out: string[] = ["# Active warnings across India", ""];
  if (!snap || !snap.alerts.length) {
    out.push("No active national alerts right now.");
    return out.join("\n");
  }
  out.push(`*${snap.count} official NDMA / IMD alerts, as of ${snap.generated_at}.*`, "");
  for (const a of snap.alerts) {
    out.push(`## ${a.headline || "Warning"}`);
    out.push(`- Category: ${a.category || "Alert"}`);
    if (a.issuer) out.push(`- Issuer: ${a.issuer}`);
    if (a.sent) out.push(`- Sent: ${a.sent}`);
    if (a.link) out.push(`- CAP: ${a.link}`);
    out.push("");
  }
  out.push("---", "Source: NDMA / IMD via SACHET, mirrored by mugilu.");
  return out.join("\n");
}
