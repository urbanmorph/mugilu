// Opt-in alerts for official warnings. A browser turns alerts on for a place
// (POST /push/subscribe); the hourly check asks SACHET which warnings cover each
// chosen place and sends each new one once, as a push notification. Official
// NDMA/IMD warnings only, never mugilu's own readings.
//
// Precision: SACHET's location-wise lookup matches a point against each alert's
// own area (mandal-level polygons), so a 2 km radius around the place rounded to
// ~1 km finds the warnings over it, not the neighbouring mandals' (checked
// 23 Oct 2026: Kavali 1 alert at 2 km, 2 at 5 km, 4 at the pages' 40 km).
//
// What is kept, per browser that opts in: its push address and keys, and the
// places it chose (see migrations/0003_push_alerts.sql). Nothing else.

import type { Env } from "./index";
import type { Warning } from "./types";
import { indianPoint } from "./india";
import { LANGS, lp, t, type Lang } from "./i18n";
import { getLocationAlerts } from "./sachet";
import { sendPush, type PushTarget } from "./webpush";
import { bumpStmt, bumpStmts } from "./metrics";

/** Places one browser can have alerts for (the saved-places list holds 12). */
export const MAX_PLACES = 12;
/** Places checked per hourly run (each is one SACHET lookup, one after another); the
 *  longest-unchecked go first, so with more places each is checked every few hours.
 *  60 × the lookup timeout stays within 10 minutes, under a cron run's 15-minute limit. */
export const POINTS_PER_RUN = 60;
/** Outbound requests (lookups + pushes) per hourly run: well within Workers Paid's 10,000
 *  per invocation, and gentle on SACHET, a government API. */
export const REQUESTS_PER_RUN = 1_000;
/** A SACHET lookup's time limit in the hourly run: it waits for a free connection behind the other cron jobs. */
export const LOOKUP_TIMEOUT_MS = 10_000;
/** How close a warning's area must be to the place, in km. */
const RADIUS_KM = 2;
/** How long a push service may hold an alert for a phone that is off: warnings here are mostly hours long. */
const TTL_SECONDS = 3 * 3600;
const SENT_KEPT_SECONDS = 7 * 86_400;

/** Push services of the browsers that can subscribe; the worker POSTs only to these. */
const PUSH_HOSTS = ["fcm.googleapis.com", ".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];
const allowedEndpoint = (endpoint: unknown): endpoint is string => {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === "https:" && PUSH_HOSTS.some((h) => (h.startsWith(".") ? u.hostname.endsWith(h) : u.hostname === h))
    );
  } catch {
    return false;
  }
};
// An uncompressed P-256 point (65 bytes) and a 16-byte secret, base64url.
const P256DH = /^[A-Za-z0-9_-]{87}$/;
const AUTH = /^[A-Za-z0-9_-]{22}$/;

/** SACHET lookups and push sends, swappable in tests. */
export interface AlertDeps {
  alertsAt(lat: number, lon: number): Promise<Warning[]>;
  send(target: PushTarget, message: object): Promise<number>;
}

export function liveDeps(env: Env): AlertDeps {
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY ?? "", privateJwk: env.VAPID_PRIVATE_KEY ?? "" };
  return {
    alertsAt: (lat, lon) => getLocationAlerts(lat, lon, RADIUS_KM, LOOKUP_TIMEOUT_MS),
    send: (target, message) => sendPush(target, message, vapid, TTL_SECONDS),
  };
}

const round = (x: number) => Math.round(x * 100) / 100;

async function hashOf(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (body: object, status = 200) => Response.json(body, { status });

/** The JSON body of a same-site POST, or the response refusing it. */
async function readPost(req: Request): Promise<Record<string, unknown> | Response> {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (req.headers.get("origin") !== new URL(req.url).origin) return json({ error: "not from mugilu" }, 403);
  const text = await req.text();
  if (text.length > 4096) return json({ error: "too large" }, 413);
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body : json({ error: "bad request" }, 400);
  } catch {
    return json({ error: "bad request" }, 400);
  }
}

/** POST /push/subscribe {subscription, lat, lon, label, lang}: alerts on for one place. */
export async function handleSubscribe(req: Request, env: Env, deps: AlertDeps = liveDeps(env)): Promise<Response> {
  const body = await readPost(req);
  if (body instanceof Response) return body;
  const sub = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  const point = indianPoint(Number(body.lat), Number(body.lon));
  const lang = body.lang as Lang;
  if (
    !allowedEndpoint(sub?.endpoint) ||
    typeof sub.keys?.p256dh !== "string" ||
    !P256DH.test(sub.keys.p256dh) ||
    typeof sub.keys.auth !== "string" ||
    !AUTH.test(sub.keys.auth) ||
    !point ||
    !LANGS.includes(lang)
  )
    return json({ error: "bad request" }, 400);

  const db = env.METRICS;
  const hash = await hashOf(sub.endpoint);
  const lat = round(point.lat);
  const lon = round(point.lon);
  const label =
    String(body.label ?? "")
      .trim()
      .slice(0, 80) || `${lat}, ${lon}`;
  const known = await db
    .prepare("SELECT COUNT(*) AS n, SUM(lat = ? AND lon = ?) AS here FROM push_places WHERE endpoint_hash = ?")
    .bind(lat, lon, hash)
    .first<{ n: number; here: number | null }>();
  if (!known?.here && (known?.n ?? 0) >= MAX_PLACES) return json({ error: "too many places" }, 409);

  // Warnings already over the place were on the page the person was reading: not sent again.
  const current = await deps.alertsAt(lat, lon);
  await db.batch([
    // A place newly turned on (not the same one again), for the push:* totals.
    ...(known?.here ? [] : [bumpStmt(db, "push:sub")]),
    db
      .prepare(
        `INSERT INTO push_places (endpoint_hash, endpoint, p256dh, auth, lat, lon, label, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint_hash, lat, lon) DO UPDATE SET label = excluded.label, lang = excluded.lang`,
      )
      .bind(hash, sub.endpoint, sub.keys.p256dh, sub.keys.auth, lat, lon, label, lang),
    // A browser's keys can change: keep every place's copy current.
    db
      .prepare("UPDATE push_places SET p256dh = ?, auth = ? WHERE endpoint_hash = ?")
      .bind(sub.keys.p256dh, sub.keys.auth, hash),
    ...current
      .filter((w) => w.identifier)
      .map((w) =>
        db.prepare("INSERT OR IGNORE INTO push_sent (endpoint_hash, alert_id) VALUES (?, ?)").bind(hash, w.identifier),
      ),
  ]);
  return json({ ok: true });
}

/** POST /push/unsubscribe {endpoint, lat?, lon?}: alerts off for one place, or (no place) for all. */
export async function handleUnsubscribe(req: Request, env: Env): Promise<Response> {
  const body = await readPost(req);
  if (body instanceof Response) return body;
  if (typeof body.endpoint !== "string") return json({ error: "bad request" }, 400);
  const hash = await hashOf(body.endpoint);
  const db = env.METRICS;
  const one = body.lat !== undefined && body.lon !== undefined;
  const [where, args] = one
    ? ["endpoint_hash = ? AND lat = ? AND lon = ?", [hash, round(Number(body.lat)), round(Number(body.lon))]]
    : ["endpoint_hash = ?", [hash]];
  await db.batch([
    // push:unsub only when there was something to turn off (checked before the delete).
    db
      .prepare(
        `INSERT INTO counters (name, n) SELECT 'push:unsub', 1 WHERE EXISTS (SELECT 1 FROM push_places WHERE ${where})
         ON CONFLICT (name) DO UPDATE SET n = n + 1`,
      )
      .bind(...args),
    ...(one ? [db.prepare(`DELETE FROM push_places WHERE ${where}`).bind(...args)] : forget(db, hash)),
  ]);
  return json({ ok: true });
}

/** The statements that forget a browser: its places and what it was sent. */
const forget = (db: D1Database, hash: string) => [
  db.prepare("DELETE FROM push_places WHERE endpoint_hash = ?").bind(hash),
  db.prepare("DELETE FROM push_sent WHERE endpoint_hash = ?").bind(hash),
];

interface Row extends PushTarget {
  endpoint_hash: string;
  label: string;
  lang: Lang;
  lat: number;
  lon: number;
}

/** The notification for one warning over one person's place. */
export function alertMessage(w: Warning, row: Pick<Row, "label" | "lang" | "lat" | "lon">) {
  const lang = row.lang;
  const main = w.until
    ? t("Official warning for X, until Y.", lang).replace("X", row.label).replace("Y", w.until)
    : t("Official warning for X.", lang).replace("X", row.label);
  return {
    title: [w.event, w.severity].filter(Boolean).join(" · "),
    body: w.issuer ? `${main} ${w.issuer}` : main,
    url: lp(`/c/${row.lat},${row.lon}`, lang),
    tag: `warning-${w.identifier}`,
  };
}

/** The hourly check: new warnings over chosen places, each sent once to each browser. */
export async function runAlerts(env: Env, deps: AlertDeps = liveDeps(env), now = Date.now()) {
  const db = env.METRICS;
  const nowS = Math.floor(now / 1000);
  const { results: points } = await db
    .prepare("SELECT lat, lon FROM push_places GROUP BY lat, lon ORDER BY MIN(checked_at), lat, lon LIMIT ?")
    .bind(POINTS_PER_RUN)
    .all<{ lat: number; lon: number }>();
  let sent = 0;
  let found = 0;
  let failed = 0;
  const gone = new Set<string>();
  let budget = REQUESTS_PER_RUN;
  // Out of budget: stop; unsent alerts and this place (left unchecked, so first next run) wait an hour.
  let spent = false;
  for (const { lat, lon } of points) {
    if (budget-- <= 0) break;
    // Over the place itself: the 2 km lookup can catch an area's edge; its polygon decides.
    const warnings = (await deps.alertsAt(lat, lon)).filter((w) => w.identifier && w.covers !== false);
    found += warnings.length;
    if (warnings.length) {
      const { results: rows } = await db
        .prepare("SELECT * FROM push_places WHERE lat = ? AND lon = ?")
        .bind(lat, lon)
        .all<Row>();
      for (const row of rows) {
        if (gone.has(row.endpoint_hash)) continue;
        for (const w of warnings) {
          const had = await db
            .prepare("SELECT 1 FROM push_sent WHERE endpoint_hash = ? AND alert_id = ?")
            .bind(row.endpoint_hash, w.identifier)
            .first();
          if (had) continue;
          if (budget-- <= 0) {
            spent = true;
            break;
          }
          const status = await deps.send(row, alertMessage(w, row)).catch((e: Error) => {
            console.warn(`[alerts] send failed: ${e.message}`);
            return 0;
          });
          if (status === 404 || status === 410) {
            gone.add(row.endpoint_hash);
            await db.batch(forget(db, row.endpoint_hash));
            break;
          }
          // Anything else that is not a success (busy, down, no answer) is tried again next run.
          if (status >= 200 && status < 300) {
            await db
              .prepare("INSERT OR IGNORE INTO push_sent (endpoint_hash, alert_id, sent_at) VALUES (?, ?, ?)")
              .bind(row.endpoint_hash, w.identifier, nowS)
              .run();
            sent++;
          } else {
            failed++;
            if (status) console.warn(`[alerts] push service ${new URL(row.endpoint).host} answered ${status}`);
          }
        }
        if (spent) break;
      }
    }
    if (spent) break;
    await db.prepare("UPDATE push_places SET checked_at = ? WHERE lat = ? AND lon = ?").bind(nowS, lat, lon).run();
  }
  // The run's totals ride the same write as the cleanup: alerts delivered, and browsers
  // whose push address no longer exists (gone, unlike push:unsub, is not a choice).
  await db.batch([
    db.prepare("DELETE FROM push_sent WHERE sent_at < ?").bind(nowS - SENT_KEPT_SECONDS),
    ...bumpStmts(db, { "push:sent": sent, "push:gone": gone.size }),
  ]);
  return { points: points.length, found, sent, failed, gone: gone.size };
}
