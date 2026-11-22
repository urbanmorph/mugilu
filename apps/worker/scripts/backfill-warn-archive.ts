// Backfill archive/warn-areas/<id>.json.gz for every alert in archive/sachet/ (since 27 Jun
// 2026), newest first, so the history read knows when and where each warning applied.
//
//   CLOUDFLARE_API_TOKEN=... npx tsx scripts/backfill-warn-archive.ts [--state DIR] [--limit N] [--times-only] [--rate R]
//
// --times-only archives each alert from its CAP record alone (its times, level, issuer, headline
// and district names) with `rings_pending: true`, for when SACHET's polygon files are out of
// reach; those ids go to DIR/times.txt. A later run without the flag fills in their outlines.
// Each alert: its feed record (issuer, headline) from R2, its CAP and polygon from SACHET, then
// the archive record, built exactly as the hourly job builds it (warnareas.ts), gzipped to R2.
// - Restart: every finished id is appended to DIR/done.txt at once; a rerun skips those and
//   any id already in archive/warn-areas/ (so the hourly job's own archives are never redone).
// - Idempotent: a second run with nothing new does no fetches and no writes.
// - Failures go to DIR/failed.txt with the reason; a rerun retries them.
// - Cloudflare's API allows about 4 requests a second per token: R2 calls are paced at 3.5/s.
// - SACHET blocks a client that asks too fast (HTTP 403 after about 2,600 requests at 3.4/s on
//   19 Nov). Its calls are paced (1.2/s to start); a 403 or 429 pauses every worker for 15
//   minutes, slows the pace by 30% and retries the same alert. Six blocks in a row stop the run.
// - Twenty network errors in a row (no answer at all) stop the run with exit code 3, so a loop
//   can start a fresh process: `until npx tsx ...; do sleep 60; done` (any failed exit restarts).
// - --rate R starts SACHET's pace at R requests a second (a restart otherwise resets it).
// - Logs: one line per 50 alerts with the rate and time left, unbuffered.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { ARCHIVE_DETAIL, ARCHIVE_PREFIX, parseCap, parsePolygons, simplifyArea, type WarnArea } from "../src/warnareas";

const ACCOUNT = "6ba72cdd965276a57d19bf0aadc4d551";
const BUCKET = "oaq-data";
const SACHET = "https://sachet.ndma.gov.in/cap_public_website/";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
if (!TOKEN) throw new Error("set CLOUDFLARE_API_TOKEN");
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const STATE = arg("--state") ?? "backfill-state";
const LIMIT = Number(arg("--limit") ?? Infinity);
const CONCURRENCY = 4;
mkdirSync(STATE, { recursive: true });
const TIMES_ONLY = process.argv.includes("--times-only");
const DONE = `${STATE}/done.txt`;
/** Archived with times only: a run without --times-only still owes them their outline. */
const TIMES = `${STATE}/times.txt`;
const FAILED = `${STATE}/failed.txt`;
const log = (s: string) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);

// ── Cloudflare's R2 API, paced ──────────────────────────────────────────────────────
const R2 = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;
let nextSlot = 0;
async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / 3.5;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}
async function r2(path: string, init: RequestInit = {}, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    await paced();
    const res = await fetch(`${R2}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(60_000),
    }).catch((e) => new Response(String(e), { status: 599 }));
    if (res.ok || res.status === 404 || i >= tries || (res.status < 500 && res.status !== 429)) return res;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
}
async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "";
  do {
    const res = await r2(`?prefix=${encodeURIComponent(prefix)}&per_page=1000${cursor ? `&cursor=${cursor}` : ""}`);
    const d = (await res.json()) as {
      result: { key: string }[];
      result_info?: { cursor?: string; is_truncated?: boolean };
    };
    keys.push(...d.result.map((o) => o.key));
    cursor = d.result_info?.is_truncated ? (d.result_info.cursor ?? "") : "";
  } while (cursor);
  return keys;
}

// ── SACHET, paced, backing off when it refuses ─────────────────────────────────────────
class Blocked extends Error {}
let sachetRate = Number(arg("--rate") ?? (TIMES_ONLY ? 1.0 : 1.2));
let sachetNext = 0;
let pauseUntil = 0;
let blocksInARow = 0;
/** Network errors in a row (no answer at all): the process's connections can go bad after the
 * Mac's network drops, and every later request then fails. It stops with NET_EXIT so a wrapper
 * loop starts a fresh process; the failed alerts are retried by that next run. */
let netInARow = 0;
const NET_STOP = 20;
const NET_EXIT = 3;
const UA = "mugilu-archive/1.0 (+https://mugilu.live)";
async function sachetPaced(): Promise<void> {
  for (;;) {
    const now = Date.now();
    const at = Math.max(now, sachetNext, pauseUntil);
    if (at <= now) break;
    await new Promise((r) => setTimeout(r, at - now));
  }
  sachetNext = Date.now() + 1000 / sachetRate;
}
async function getText(url: string): Promise<string> {
  for (let i = 1; ; i++) {
    try {
      await sachetPaced();
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 403 || res.status === 429) throw new Blocked(`HTTP ${res.status}`);
      if (res.ok) {
        blocksInARow = 0;
        return await res.text();
      }
      if (res.status < 500 || i >= 3) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (e instanceof Blocked || i >= 3) throw e;
    }
    await new Promise((r) => setTimeout(r, 3000 * i));
  }
}

/** One alert, as the hourly job archives it (warnareas.ts fetchArea's archive record). */
async function build(id: string): Promise<WarnArea & { rings_pending?: true }> {
  const feed = await r2(`/archive/sachet/${id}.json`);
  if (!feed.ok) throw new Error(`feed record: HTTP ${feed.status}`);
  const f = (await feed.json()) as { issuer?: string };
  const cap = parseCap(await getText(`${SACHET}FetchXMLFile?identifier=${encodeURIComponent(id)}`));
  if (!cap) throw new Error("not a CAP alert");
  const raw = !TIMES_ONLY && cap.polygonUrl ? parsePolygons(await getText(cap.polygonUrl)) : [];
  const { event, severity, sent, effective, onset, expires, headline, areaDesc } = cap;
  const base = {
    identifier: id,
    event,
    severity,
    sent,
    effective,
    onset,
    expires,
    issuer: f.issuer ?? "",
    headline,
    areaDesc,
  };
  // Times only: the outline is owed, not absent (an alert with no polygon has no rings_pending).
  if (TIMES_ONLY && cap.polygonUrl) return { ...base, rings: [], rings_pending: true };
  return { ...base, rings: simplifyArea(raw, ARCHIVE_DETAIL) };
}

async function main(): Promise<void> {
  // Last run's failures are retried (they are not in done.txt); keep their list aside.
  if (existsSync(FAILED)) renameSync(FAILED, `${STATE}/failed-${Date.now()}.txt`);
  const read = (f: string) => new Set(existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
  const done = read(DONE);
  const times = read(TIMES);
  log(`listing archive/sachet and ${ARCHIVE_PREFIX} ...`);
  const [feedKeys, have] = await Promise.all([listKeys("archive/sachet/"), listKeys(ARCHIVE_PREFIX)]);
  const archived = new Set(have.map((k) => k.slice(ARCHIVE_PREFIX.length).replace(/\.json\.gz$/, "")));
  // Ids lead with the issue time in ms, so a numeric sort is newest first.
  const ids = feedKeys
    .map((k) => k.slice("archive/sachet/".length).replace(/\.json$/, ""))
    // Times-only: everything not yet archived at all. Full: everything not archived in full
    // (an id archived with times only is still owed its outline).
    .filter(
      (id) =>
        /^\d+$/.test(id) &&
        !done.has(id) &&
        (TIMES_ONLY ? !archived.has(id) && !times.has(id) : !archived.has(id) || times.has(id)),
    )
    .sort((a, b) => (BigInt(b) > BigInt(a) ? 1 : -1))
    .slice(0, LIMIT);
  log(
    `${feedKeys.length} alerts, ${archived.size} archived, ${done.size} done before; ${ids.length} to do, newest first`,
  );
  if (!ids.length) return;
  writeFileSync(`${STATE}/started.txt`, new Date().toISOString());

  const start = Date.now();
  let next = 0;
  let ok = 0;
  let bad = 0;
  const worker = async () => {
    while (next < ids.length && blocksInARow < 6 && netInARow < NET_STOP) {
      const id = ids[next++];
      try {
        const a = await build(id);
        const put = await r2(`/${ARCHIVE_PREFIX}${id}.json.gz`, {
          method: "PUT",
          headers: { "content-type": "application/json", "content-encoding": "gzip" },
          body: gzipSync(JSON.stringify(a)),
        });
        if (!put.ok) throw new Error(`put: HTTP ${put.status}`);
        appendFileSync(a.rings_pending ? TIMES : DONE, `${id}\n`);
        ok++;
        netInARow = 0;
      } catch (e) {
        if (e instanceof Blocked) {
          // Refused: wait, slow down, and try this alert again (it is not a failure).
          if (Date.now() >= pauseUntil) {
            blocksInARow++;
            pauseUntil = Date.now() + 15 * 60_000;
            sachetRate = Math.max(0.2, sachetRate * 0.7);
            log(
              `SACHET refused (${e.message}); pausing 15 min, then ${sachetRate.toFixed(2)} requests/s (block ${blocksInARow} of 6)`,
            );
          }
          ids.push(id);
          continue;
        }
        const why = e instanceof Error ? e.message : String(e);
        appendFileSync(FAILED, `${id}\t${new Date().toISOString()}\t${why}\n`);
        bad++;
        // A network error (no answer at all) counts toward the stop; any other answer resets it.
        netInARow = /HTTP 599|fetch failed/.test(why) ? netInARow + 1 : 0;
      }
      const n = ok + bad;
      if (n % 50 === 0 || n === ids.length) {
        const rate = n / ((Date.now() - start) / 1000);
        const left = Math.round((ids.length - n) / rate / 60);
        log(`${n}/${ids.length} (${ok} ok, ${bad} failed) at ${id}, ${rate.toFixed(2)}/s, about ${left} min left`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (netInARow >= NET_STOP) {
    log(`stopped: ${NET_STOP} network errors in a row; ${ok} archived, ${bad} failed. Rerun to continue.`);
    process.exitCode = NET_EXIT;
    return;
  }
  log(
    blocksInARow >= 6
      ? `stopped: SACHET refused six times in a row; ${ok} archived, ${bad} failed. Rerun later to continue.`
      : `finished: ${ok} archived, ${bad} failed (see ${FAILED})`,
  );
}

main().catch((e) => {
  log(`stopped: ${e instanceof Error ? e.stack : String(e)}`);
  process.exit(1);
});
