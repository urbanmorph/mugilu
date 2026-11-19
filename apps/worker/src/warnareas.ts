import type { Env } from "./index";
import type { RiskBand } from "./score";
import type { Ring } from "./india";
import type { FeedAlert } from "./sachet";
import { loadWarningsSnapshot } from "./snapshot";
import { simplifyRing } from "./simplify-path";
import { reason } from "./logs";
import { gzip } from "./gzip";

// The official warnings' areas, for the home map's Warnings layer and the /places marks. The
// national feed (sachet.ts) names each alert but not where it is; its CAP file (~3 KB) holds the
// level and the expiry, and a "Polygon URL" to the area itself (6 KB to 750 KB, mandal detail).
// Each alert is fetched once and kept in R2 at data/warn-areas/<id>.json, simplified to what the
// map can show, as soon as it arrives: a run that is stopped keeps what it fetched and the next
// one continues; a second run with the same feed fetches nothing. SACHET is a slow .gov.in host,
// so every call is time-boxed, the run has its own time budget, and nothing here ever throws.
// Each alert is also archived (archive/warn-areas/<id>.json.gz) with its times and a finer area,
// so "was this place under a warning at that hour" can be answered after the map has moved on.

export const AREAS_PREFIX = "data/warn-areas/";
/** Every alert's area and times, kept for good (the history read), as <id>.json.gz: the map's
 *  copy above is pruned once the alert is over, this one never is. */
export const ARCHIVE_PREFIX = "archive/warn-areas/";
const SACHET = "https://sachet.ndma.gov.in/cap_public_website/";

/** One CAP file, read for the map: the English info when the alert has several languages. */
export interface CapInfo {
  event: string;
  severity: string;
  /** ISO times with offset, as issued (+05:30): when it was sent, takes effect, the hazard is
   *  expected to begin, and when it expires. Any may be empty when the alert leaves it out. */
  sent: string;
  effective: string;
  onset: string;
  expires: string;
  headline: string;
  areaDesc: string;
  /** The polygon file, only on SACHET's own host. */
  polygonUrl?: string;
}

/** A stored area: the alert as the map reads it. `rings` is empty when the alert has no polygon,
 *  or had expired when first seen (no polygon fetched), or expired over a day ago (dropped). */
export interface WarnArea {
  identifier: string;
  event: string;
  severity: string;
  expires: string;
  issuer: string;
  headline: string;
  areaDesc: string;
  rings: Ring[];
  /** The other CAP times (archived records; older map records lack them). */
  sent?: string;
  effective?: string;
  onset?: string;
}
/** A failed fetch, kept so a bad id is retried later (backing off), not every hour. */
interface Failed {
  identifier: string;
  failed: true;
  tries: number;
  error: string;
}

const unescape = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
const tag = (xml: string, name: string) =>
  unescape(xml.match(new RegExp(`<cap:${name}>([\\s\\S]*?)</cap:${name}>`))?.[1] ?? "");

/** The CAP fields the map needs, or null when the text is not a CAP alert. */
export function parseCap(xml: string): CapInfo | null {
  const infos = xml.match(/<cap:info>[\s\S]*?<\/cap:info>/g);
  if (!infos) return null;
  const info = infos.find((i) => /^en/i.test(tag(i, "language"))) ?? infos[0];
  const params = info.match(/<cap:parameter>[\s\S]*?<\/cap:parameter>/g) ?? [];
  const polygon = params.find((p) => /polygon url/i.test(tag(p, "valueName")));
  const url = polygon ? tag(polygon, "value") : "";
  return {
    event: tag(info, "event"),
    severity: tag(info, "severity"),
    sent: tag(xml, "sent"),
    effective: tag(info, "effective"),
    onset: tag(info, "onset"),
    expires: tag(info, "expires"),
    headline: tag(info, "headline"),
    areaDesc: tag(info, "areaDesc"),
    polygonUrl: url.startsWith(SACHET) ? url : undefined,
  };
}

/** The polygon file's rings, as [lon, lat] (CAP writes "lat,lon lat,lon ..."). */
export function parsePolygons(xml: string): Ring[] {
  return (xml.match(/<polygon>[\s\S]*?<\/polygon>/g) ?? [])
    .map((p) =>
      p
        .replace(/<\/?polygon>/g, "")
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map(Number))
        .filter((ll) => ll.length === 2 && ll.every(Number.isFinite))
        .map(([lat, lon]) => [lon, lat] as [number, number]),
    )
    .filter((r) => r.length >= 3);
}

/** Degrees: about 0.35 px on the home map (12 px a degree), the detail it can show. */
const TOLERANCE = 0.03;
/** The archive's detail: about 200 m, rounded to 0.001° (about 100 m), enough to say whether a
 *  street was inside, at a fraction of the source's mandal-level size. */
export const ARCHIVE_DETAIL = { tolerance: 0.002, places: 3 };

/** Rings simplified to the map's detail (or the archive's), rounded, every ring kept. */
export function simplifyArea(rings: Ring[], { tolerance = TOLERANCE, places = 2 } = {}): Ring[] {
  const k = 10 ** places;
  const round = (n: number) => Math.round(n * k) / k;
  return rings
    .map((ring) =>
      simplifyRing(ring, tolerance)
        .map(([lon, lat]) => [round(lon), round(lat)] as [number, number])
        .filter(([x, y], i, a) => i === 0 || x !== a[i - 1][0] || y !== a[i - 1][1]),
    )
    .filter((r) => r.length >= 3);
}

/** CAP severity onto the risk bands. An unknown level still shows, at moderate. */
export const SEVERITY_BAND: Record<string, RiskBand> = {
  extreme: "severe",
  severe: "high",
  moderate: "moderate",
  minor: "low",
};
export const severityBand = (severity: string): RiskBand => SEVERITY_BAND[severity.toLowerCase()] ?? "moderate";

// ── The run ─────────────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const MAX_TRIES = 5;
/** What R2 keeps beside each record, so a run decides from one listing without reading them. */
interface Meta {
  /** Done: the expiry (ms, as text) and the ring count. */
  expires?: string;
  rings?: string;
  /** Failed: the tries so far and when to try again (ms). */
  tries?: string;
  retry?: string;
  /** "1" once the alert is in the archive. A record without it predates the archive. */
  archived?: string;
}

export interface CollectOpts {
  now?: number;
  /** The run's own time limit: no new fetch starts after it (well inside the cron's). */
  budgetMs?: number;
  /** Per request. A polygon file can be 750 KB from a slow host. */
  timeoutMs?: number;
  concurrency?: number;
  /** At most this many alerts fetched per run (two requests each). */
  maxNew?: number;
}
export interface AreaRun {
  feed: number;
  fetched: number;
  failed: number;
  /** Left for the next run (out of time or over maxNew). */
  pending: number;
  pruned: number;
  /** Alerts in force with an area, after the run. */
  active: number;
  ms: number;
}

const keyOf = (id: string) => `${AREAS_PREFIX}${id}.json`;

async function listStored(env: Env): Promise<Map<string, Meta>> {
  const out = new Map<string, Meta>();
  let cursor: string | undefined;
  do {
    // `include` is honoured at this compatibility date; the default types predate it.
    const opts = { prefix: AREAS_PREFIX, cursor, include: ["customMetadata"] } as R2ListOptions;
    const page = await env.OAQ_R2.list(opts);
    for (const o of page.objects) out.set(o.key.slice(AREAS_PREFIX.length, -".json".length), o.customMetadata ?? {});
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

const put = (env: Env, id: string, body: WarnArea | Failed, meta: Meta) =>
  env.OAQ_R2.put(keyOf(id), JSON.stringify(body), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: meta as Record<string, string>,
  });
const doneMeta = (a: WarnArea, archived: boolean): Meta => ({
  expires: String(Date.parse(a.expires) || 0),
  rings: String(a.rings.length),
  ...(archived ? { archived: "1" } : {}),
});
/** Store one alert's area for the map (the run's cache, one object per alert). */
export const storeWarnArea = (env: Env, a: WarnArea, archived = false) =>
  put(env, a.identifier, a, doneMeta(a, archived));
/** Keep one alert for good, gzipped as the other archives are (12 to 124 KB of area before). */
const archiveWarnArea = async (env: Env, a: WarnArea) =>
  env.OAQ_R2.put(`${ARCHIVE_PREFIX}${a.identifier}.json.gz`, await gzip(JSON.stringify(a)), {
    httpMetadata: { contentType: "application/json", contentEncoding: "gzip" },
  });

async function getText(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** One alert: its CAP, then its polygon file. The archive gets the finer area; the map's copy
 *  gets the map's detail, and none once the alert is over. */
async function fetchArea(a: FeedAlert, now: number, timeoutMs: number): Promise<{ map: WarnArea; archive: WarnArea }> {
  const cap = parseCap(
    await getText(`${SACHET}FetchXMLFile?identifier=${encodeURIComponent(a.identifier)}`, timeoutMs),
  );
  if (!cap) throw new Error("not a CAP alert");
  const raw = cap.polygonUrl ? parsePolygons(await getText(cap.polygonUrl, timeoutMs)) : [];
  const live = (Date.parse(cap.expires) || 0) > now;
  const { event, severity, sent, effective, onset, expires, headline, areaDesc } = cap;
  const base = {
    identifier: a.identifier,
    event,
    severity,
    sent,
    effective,
    onset,
    expires,
    issuer: a.issuer,
    headline,
    areaDesc,
  };
  return {
    map: { ...base, rings: live ? simplifyArea(raw) : [] },
    archive: { ...base, rings: simplifyArea(raw, ARCHIVE_DETAIL) },
  };
}

/**
 * Fetch the area of every feed alert not yet stored (newest first), store each as it arrives,
 * and prune: an area expired over a day ago loses its rings, and a record whose alert has left
 * the feed is deleted. Never throws; a failure is logged and recorded for a later retry.
 */
export async function collectWarnAreas(env: Env, o: CollectOpts = {}): Promise<AreaRun> {
  const { now = Date.now(), budgetMs = 60_000, timeoutMs = 20_000, concurrency = 4, maxNew = 60 } = o;
  const start = Date.now();
  const run: AreaRun = { feed: 0, fetched: 0, failed: 0, pending: 0, pruned: 0, active: 0, ms: 0 };
  try {
    const feed = (await loadWarningsSnapshot(env))?.alerts ?? [];
    run.feed = feed.length;
    const stored = await listStored(env);
    // Never fetched; failed and due a retry; or stored before the archive existed.
    const due = (m: Meta | undefined) =>
      !m || (m.tries != null ? +m.tries < MAX_TRIES && +(m.retry ?? 0) <= now : m.archived !== "1");
    const todo = feed
      .filter((a) => due(stored.get(a.identifier)))
      .sort((x, y) => (Date.parse(y.sent) || 0) - (Date.parse(x.sent) || 0));
    console.log(`[warn-areas] ${feed.length} in the feed, ${stored.size} stored, ${todo.length} to fetch`);

    let next = 0;
    const worker = async () => {
      while (next < todo.length && next < maxNew && Date.now() - start < budgetMs) {
        const a = todo[next++];
        try {
          const { map: area, archive } = await fetchArea(a, now, timeoutMs);
          // The archive first: a run stopped between the two refetches it, never loses it.
          await archiveWarnArea(env, archive);
          await storeWarnArea(env, area, true);
          run.fetched++;
          console.log(
            `[warn-areas] ${run.fetched + run.failed}/${todo.length} ${a.identifier} ${area.severity || "?"} ${area.event}: ${area.rings.length} rings`,
          );
        } catch (e) {
          const tries = +(stored.get(a.identifier)?.tries ?? 0) + 1;
          const retry = String(now + 3_600_000 * 2 ** (tries - 1));
          run.failed++;
          console.error(`[warn-areas] ${a.identifier} failed (try ${tries}): ${reason(e)}`);
          await put(
            env,
            a.identifier,
            { identifier: a.identifier, failed: true, tries, error: reason(e) },
            { tries: String(tries), retry },
          ).catch(() => {});
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    run.pending = todo.length - next;

    // Prune what is no longer needed. A record still in the feed is kept (as a stub) so it is
    // never fetched again; once its alert has left the feed (about a week) it goes.
    const inFeed = new Set(feed.map((a) => a.identifier));
    for (const [id, m] of stored) {
      const old = m.expires != null && +m.expires < now - DAY;
      if (!inFeed.has(id) && (old || m.tries != null)) {
        await env.OAQ_R2.delete(keyOf(id));
        run.pruned++;
      } else if (inFeed.has(id) && old && m.rings !== "0") {
        const a = await env.OAQ_R2.get(keyOf(id)).then((r) => r?.json<WarnArea>());
        if (a) await storeWarnArea(env, { ...a, rings: [] }, m.archived === "1");
        run.pruned++;
      }
    }
    run.active = (await listStored(env).then((s) => [...s.values()].filter((m) => isActive(m, now)))).length;
  } catch (e) {
    console.error(`[warn-areas] failed: ${reason(e)}`);
  }
  run.ms = Date.now() - start;
  console.log(
    `[warn-areas] done in ${run.ms} ms: ${run.fetched} fetched, ${run.failed} failed, ${run.pending} left, ${run.pruned} pruned, ${run.active} in force`,
  );
  return run;
}

const isActive = (m: Meta, now: number) => m.expires != null && +m.expires > now && +(m.rings ?? 0) > 0;

/** The stored areas of the alerts in force at `now`. */
export async function loadWarnAreas(env: Env, now = Date.now()): Promise<WarnArea[]> {
  const stored = await listStored(env);
  const ids = [...stored].filter(([, m]) => isActive(m, now)).map(([id]) => id);
  const areas = await Promise.all(ids.map((id) => env.OAQ_R2.get(keyOf(id)).then((r) => r?.json<WarnArea>())));
  return areas.filter((a): a is WarnArea => !!a?.rings?.length);
}
