// Build each place's warning history (src/warnhistory.ts) from the archive of every alert since
// 27 Jun 2026 (archive/warn-areas/), once: the hourly job adds each new alert after that.
//
//   CLOUDFLARE_API_TOKEN=... npx tsx scripts/build-warn-history.ts [--state DIR] [--max-minutes N] [--limit N]
//
// - Cache: DIR/placed.jsonl, one line per archived alert read (its id, the places it covered,
//   the alert as the history keeps it), appended as each is read; copied to R2 at
//   history/build/placed.jsonl every 10 minutes and on exit, failure included.
// - Restart: ids already in placed.jsonl are skipped; with no local file, the R2 copy is fetched
//   first. --max-minutes stops cleanly (default 300), keeping what was read.
// - Idempotent: the last step merges each place's alerts into its file in R2 (so alerts the
//   hourly job added meanwhile stay) and writes only the files that change.
// - Logs: unbuffered, one line per 200 alerts with the rate and time left.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { ARCHIVE_PREFIX, type WarnArea } from "../src/warnareas";
import { HISTORY_PREFIX, mergeHistory, pastAlert, placesInArea, type PastAlert } from "../src/warnhistory";
import { listKeys, r2 } from "./lib/r2";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const STATE = arg("--state") ?? "warn-history-state";
const LIMIT = Number(arg("--limit") ?? Infinity);
const STOP_AT = Date.now() + Number(arg("--max-minutes") ?? 300) * 60_000;
const CONCURRENCY = 4;
const PLACED = `${STATE}/placed.jsonl`;
const CHECKPOINT = "history/build/placed.jsonl";
const CHECKPOINT_EVERY = 10 * 60_000;
mkdirSync(STATE, { recursive: true });
const log = (s: string) => process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);

type Line = { id: string; places: string[]; alert: PastAlert };
const readPlaced = (): Line[] =>
  existsSync(PLACED)
    ? readFileSync(PLACED, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Line)
    : [];

/** The local cache, copied to R2 (durable if this machine loses it). */
async function checkpoint(): Promise<void> {
  if (!existsSync(PLACED)) return;
  const res = await r2(`/${CHECKPOINT}`, {
    method: "PUT",
    body: readFileSync(PLACED),
    headers: { "content-type": "application/x-ndjson" },
  });
  log(`checkpoint: ${readPlaced().length} alerts to R2 (HTTP ${res.status})`);
}

/** One archived alert: gzipped as stored, or already unzipped by the API. */
async function readArea(id: string): Promise<WarnArea> {
  const res = await r2(`/${ARCHIVE_PREFIX}${id}.json.gz`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const text =
    bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString("utf8") : Buffer.from(bytes).toString("utf8");
  return JSON.parse(text) as WarnArea;
}

/** Merge each place's alerts into its file in R2; write only the files that change. */
async function writePlaces(lines: Line[]): Promise<void> {
  const by = new Map<string, PastAlert[]>();
  for (const l of lines) for (const slug of l.places) by.set(slug, [...(by.get(slug) ?? []), l.alert]);
  log(`writing ${by.size} places ...`);
  let wrote = 0;
  for (const [slug, add] of by) {
    const key = `/${HISTORY_PREFIX}${slug}.json`;
    const cur = await r2(key);
    const prev = cur.ok ? ((await cur.json()) as PastAlert[]) : [];
    if (!cur.ok && cur.status !== 404) throw new Error(`${slug}: HTTP ${cur.status}`);
    const next = mergeHistory(prev, add);
    if (!next) continue;
    const put = await r2(key, {
      method: "PUT",
      body: JSON.stringify(next),
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
    if (!put.ok) throw new Error(`${slug}: PUT HTTP ${put.status}`);
    wrote++;
  }
  log(`places: ${wrote} written, ${by.size - wrote} unchanged`);
}

async function main(): Promise<void> {
  if (!existsSync(PLACED)) {
    const res = await r2(`/${CHECKPOINT}`);
    if (res.ok) {
      writeFileSync(PLACED, Buffer.from(await res.arrayBuffer()));
      log(`restored the cache from R2`);
    }
  }
  const done = new Set(readPlaced().map((l) => l.id));
  log(`listing ${ARCHIVE_PREFIX} ...`);
  const ids = (await listKeys(ARCHIVE_PREFIX)).map((k) => k.slice(ARCHIVE_PREFIX.length).replace(/\.json\.gz$/, ""));
  const todo = ids.filter((id) => !done.has(id)).slice(0, LIMIT);
  log(`${ids.length} archived, ${done.size} read before; ${todo.length} to read`);

  const start = Date.now();
  let next = 0;
  let ok = 0;
  let bad = 0;
  let lastCheckpoint = Date.now();
  const worker = async () => {
    while (next < todo.length && Date.now() < STOP_AT) {
      const id = todo[next++];
      try {
        const a = await readArea(id);
        appendFileSync(PLACED, JSON.stringify({ id, places: placesInArea(a.rings), alert: pastAlert(a) }) + "\n");
        ok++;
      } catch (e) {
        bad++;
        log(`${id} failed: ${e instanceof Error ? e.message : String(e)} (a rerun retries it)`);
      }
      const n = ok + bad;
      if (n % 200 === 0) {
        const rate = n / ((Date.now() - start) / 1000);
        log(
          `${n}/${todo.length} (${ok} ok, ${bad} failed), ${rate.toFixed(1)}/s, about ${Math.round((todo.length - n) / rate / 60)} min left`,
        );
      }
      if (Date.now() - lastCheckpoint > CHECKPOINT_EVERY) {
        lastCheckpoint = Date.now();
        await checkpoint();
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await checkpoint();
  // Places are written only once every archived alert has been read (a --limit run never
  // writes): a place's file is its whole history, never a part of it.
  const lines = readPlaced();
  const read = new Set(lines.map((l) => l.id));
  const left = ids.filter((id) => !read.has(id)).length;
  if (left) {
    log(`stopped with ${left} still to read; rerun to continue (places are written once all are read)`);
    process.exitCode = 2;
    return;
  }
  await writePlaces(lines);
  log("finished");
}

main().catch(async (e) => {
  log(`failed: ${e instanceof Error ? e.message : String(e)}`);
  await checkpoint().catch(() => {});
  process.exitCode = 1;
});
