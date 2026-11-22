import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARCHIVE_PREFIX,
  AREAS_PREFIX,
  collectWarnAreas,
  loadWarnAreas,
  parseCap,
  parsePolygons,
  severityBand,
  simplifyArea,
  type WarnArea,
} from "../src/warnareas";
import { WARNINGS_KEY, putJson } from "../src/snapshot";
import type { FeedAlert, WarningsSnapshot } from "../src/sachet";
import { testWorker } from "./helpers/worker";
import type { Env } from "../src/index";

const fx = (f: string) => readFileSync(new URL(`fixtures/sachet/${f}`, import.meta.url), "utf8");
const CAP_TWO = fx("cap-sdma-two-languages.xml");
const CAP_IMD = fx("cap-imd-district.xml");
const POLYGON = fx("polygon.xml");
const SACHET = "https://sachet.ndma.gov.in/cap_public_website/";

test("parseCap: the English info of a two-language alert, and its full polygon address", () => {
  const c = parseCap(CAP_TWO)!;
  assert.equal(c.event, "SDMA Alert");
  assert.equal(c.severity, "Severe");
  assert.equal(c.expires, "2026-11-20T06:45:00+05:30");
  assert.match(c.headline, /^SDMA Alert is Likely to occur over Ramachandrapuram to Kaviti/);
  assert.equal(c.areaDesc, "Ramachandrapuram to Kaviti");
  assert.equal(c.polygonUrl, `${SACHET}FetchPolygonXMLFile?identifier=1795051101919008`);
});

test("parseCap: an IMD district alert", () => {
  const c = parseCap(CAP_IMD)!;
  assert.equal(c.event, "Light Rain");
  assert.equal(c.severity, "Moderate");
  assert.equal(c.expires, "2026-11-19T12:14:00+05:30");
  assert.equal(c.polygonUrl, `${SACHET}FetchPolygonXMLFile?identifier=1795060199066015`);
});

test("parseCap: &amp; is unescaped, and a polygon address off SACHET or missing is none", () => {
  const withAmp = CAP_IMD.replace("identifier=1795060199066015", "identifier=1795060199066015&amp;v=2");
  assert.equal(parseCap(withAmp)!.polygonUrl, `${SACHET}FetchPolygonXMLFile?identifier=1795060199066015&v=2`);
  const elsewhere = CAP_IMD.replace("https://sachet.ndma.gov.in/", "https://example.com/");
  assert.equal(parseCap(elsewhere)!.polygonUrl, undefined);
  const none = CAP_IMD.replace(/<cap:parameter>[\s\S]*?<\/cap:parameter>/, "");
  assert.equal(parseCap(none)!.polygonUrl, undefined);
  assert.equal(parseCap("<html>Service unavailable</html>"), null);
});

test("parsePolygons: each <polygon> a ring, CAP's lat,lon read as [lon, lat]", () => {
  const rings = parsePolygons(POLYGON);
  assert.equal(rings.length, 2);
  assert.deepEqual(rings[0][0], [91.9, 23.9]);
  assert.deepEqual(rings[1][1], [91.7, 23.5]);
  assert.deepEqual(parsePolygons("<alert><polygon>bad data</polygon></alert>"), []);
});

test("simplifyArea: drops points the map cannot show, rounds, keeps every ring", () => {
  const rings = simplifyArea(parsePolygons(POLYGON));
  assert.equal(rings.length, 2);
  // The point on the straight top edge (23.9, 91.95) and the closing repeat go.
  assert.deepEqual(rings[0], [
    [91.9, 23.9],
    [92.1, 23.9],
    [92.1, 23.7],
    [91.9, 23.7],
  ]);
  const fine = simplifyArea([
    [
      [77.123456, 12.987654],
      [77.5, 12.98],
      [77.5, 13.4],
    ],
  ]);
  assert.deepEqual(fine[0][0], [77.12, 12.99]);
});

test("severityBand: CAP severity onto the risk bands", () => {
  assert.equal(severityBand("Extreme"), "severe");
  assert.equal(severityBand("Severe"), "high");
  assert.equal(severityBand("Moderate"), "moderate");
  assert.equal(severityBand("Minor"), "low");
  // Unknown or missing: an official warning still shows, at moderate.
  assert.equal(severityBand("Unknown"), "moderate");
  assert.equal(severityBand(""), "moderate");
});

// ── The fetcher, over the in-memory R2 with SACHET stubbed ──────────────────────────
const NOW = Date.parse("2026-11-19T06:00:00Z"); // 11:30 IST: the IMD alert (until 12:14 IST) is in force
const alert = (identifier: string): FeedAlert => ({
  identifier,
  headline: `Alert ${identifier}`,
  category: "Met",
  issuer: "controlroom@ndma.gov.in (IMD Agartala)",
  link: `${SACHET}FetchXMLFile?identifier=${identifier}`,
  sent: "Thu, 19 Nov 2026 03:51:12 GMT",
});
const capWith = (expires: string) => CAP_IMD.replace("2026-11-19T12:14:00+05:30", expires);

async function seedFeed(env: Env, ids: string[]): Promise<void> {
  const snap: WarningsSnapshot = { generated_at: "2026-11-19T05:55:00Z", count: ids.length, alerts: ids.map(alert) };
  await putJson(env, WARNINGS_KEY, JSON.stringify(snap), "public, max-age=300");
}

/** SACHET stubbed: CAP files by id (a missing id answers 500), the polygon file for any. */
function stubSachet(caps: Record<string, string>, polygon = POLYGON): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    if (url.includes("FetchPolygonXMLFile")) return new Response(polygon);
    const id = new URL(url).searchParams.get("identifier")!;
    return caps[id] ? new Response(caps[id]) : new Response("down", { status: 500 });
  }) as typeof fetch;
  return calls;
}

const stored = async (env: Env, id: string) =>
  JSON.parse((await (await env.OAQ_R2.get(`${AREAS_PREFIX}${id}.json`))?.text()) ?? "null");

test("collectWarnAreas: each alert stored as it arrives; an expired one keeps no rings for the map; a failure is recorded", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "2", "3"]);
  const calls = stubSachet({ "1": CAP_IMD, "2": capWith("2026-11-16T10:00:00+05:30") });
  const r = await collectWarnAreas(env, { now: NOW });
  assert.equal(r.fetched, 2);
  assert.equal(r.failed, 1);
  const a = (await stored(env, "1")) as WarnArea;
  assert.equal(a.event, "Light Rain");
  assert.equal(a.severity, "Moderate");
  assert.equal(a.issuer, "controlroom@ndma.gov.in (IMD Agartala)");
  assert.equal(a.rings.length, 2);
  assert.deepEqual((await stored(env, "2")).rings, []);
  assert.equal((await stored(env, "3")).failed, true);
  // Both polygons are fetched: the map has no use for an expired area, but the archive does.
  assert.equal(calls.filter((u) => u.includes("FetchPolygonXMLFile")).length, 2);
});

test("collectWarnAreas: a second run with the same feed fetches nothing and writes nothing", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "2", "3"]);
  stubSachet({ "1": CAP_IMD, "2": capWith("2026-11-16T10:00:00+05:30") });
  await collectWarnAreas(env, { now: NOW });
  const calls = stubSachet({ "1": CAP_IMD });
  const puts: string[] = [];
  const put = env.OAQ_R2.put.bind(env.OAQ_R2);
  env.OAQ_R2.put = (async (k: string, ...rest: unknown[]) => {
    puts.push(k);
    return (put as (...a: unknown[]) => unknown)(k, ...rest);
  }) as typeof env.OAQ_R2.put;
  const r = await collectWarnAreas(env, { now: NOW + 60_000 });
  assert.deepEqual(calls, []);
  assert.deepEqual(puts, []);
  assert.equal(r.fetched, 0);
});

test("collectWarnAreas: a run out of time stops cleanly, and the next run continues where it stopped", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "2", "3"]);
  stubSachet({ "1": CAP_IMD, "2": CAP_IMD, "3": CAP_IMD });
  const first = await collectWarnAreas(env, { now: NOW, maxNew: 1, concurrency: 1 });
  assert.equal(first.fetched, 1);
  assert.equal(first.pending, 2);
  const none = await collectWarnAreas(env, { now: NOW, budgetMs: 0 });
  assert.equal(none.fetched, 0);
  assert.equal(none.pending, 2);
  const calls = stubSachet({ "1": CAP_IMD, "2": CAP_IMD, "3": CAP_IMD });
  const rest = await collectWarnAreas(env, { now: NOW });
  assert.equal(rest.fetched, 2);
  assert.equal(rest.pending, 0);
  assert.ok(!calls.some((u) => u.endsWith("identifier=1")), "the stored one is not fetched again");
});

test("collectWarnAreas: a failed id is retried later, with a cap, never every hour", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["9"]);
  let calls = stubSachet({});
  await collectWarnAreas(env, { now: NOW });
  assert.equal(calls.length, 1);
  calls = stubSachet({});
  await collectWarnAreas(env, { now: NOW + 30 * 60_000 });
  assert.equal(calls.length, 0, "not again within the hour");
  let t = NOW;
  for (let i = 0; i < 10; i++) {
    t += 2 * 86_400_000;
    await collectWarnAreas(env, { now: t });
  }
  assert.equal((await stored(env, "9")).tries, 5, "gives up after five tries");
  calls = stubSachet({ "9": CAP_IMD });
  await collectWarnAreas(env, { now: t + 86_400_000 });
  assert.equal(calls.length, 0);
});

test("collectWarnAreas: SACHET down or throwing never throws", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "2"]);
  globalThis.fetch = (async () => {
    throw new Error("connect timeout");
  }) as typeof fetch;
  const r = await collectWarnAreas(env, { now: NOW });
  assert.equal(r.failed, 2);
});

test("collectWarnAreas: an area expired over a day ago loses its polygon; once out of the feed it is deleted", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "4"]);
  stubSachet({ "1": CAP_IMD, "4": CAP_IMD });
  await collectWarnAreas(env, { now: NOW });
  assert.equal((await stored(env, "1")).rings.length, 2);
  // Two days on: both expired over a day ago; "1" is still in the feed, "4" has left it.
  await seedFeed(env, ["1"]);
  stubSachet({});
  const r = await collectWarnAreas(env, { now: NOW + 2 * 86_400_000 });
  assert.equal(r.pruned, 2);
  assert.deepEqual((await stored(env, "1")).rings, []);
  assert.equal(await stored(env, "4"), null);
});

test("loadWarnAreas: only the alerts in force, with their areas", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "2", "5"]);
  const noPolygon = CAP_IMD.replace(/<cap:parameter>[\s\S]*?<\/cap:parameter>/, "");
  stubSachet({ "1": CAP_IMD, "2": capWith("2026-11-19T10:00:00+05:30"), "5": noPolygon });
  await collectWarnAreas(env, { now: NOW });
  const { areas, ends } = await loadWarnAreas(env, NOW);
  assert.deepEqual(
    areas.map((a) => a.identifier),
    ["1"],
  );
  assert.deepEqual((await loadWarnAreas(env, Date.parse("2026-11-19T07:00:00Z"))).areas, []);
  // Every alert's end, with an area or not, in force or not: the feed's list reads it.
  assert.deepEqual(ends, {
    "1": "2026-11-19T06:44:00.000Z",
    "2": "2026-11-19T04:30:00.000Z",
    "5": "2026-11-19T06:44:00.000Z",
  });
});

// ── The archive: where and when every alert applied, kept for good ──────────────────
const archived = async (env: Env, id: string) => {
  const o = await env.OAQ_R2.get(`${ARCHIVE_PREFIX}${id}.json.gz`);
  if (!o) return null;
  return new Response(o.body.pipeThrough(new DecompressionStream("gzip"))).json();
};

test("parseCap: the alert's times: sent, effective, onset and expires", () => {
  const c = parseCap(CAP_IMD)!;
  assert.equal(c.sent, "2026-11-19T09:21:10+05:30");
  assert.equal(c.effective, "2026-11-19T09:14:00+05:30");
  assert.equal(c.onset, "2026-11-19T09:21:10+05:30");
  assert.equal(c.expires, "2026-11-19T12:14:00+05:30");
});

// A mandal-like outline: a 200-point ring about 10 km across (CAP writes lat,lon).
const DETAILED = `<polygons><polygon>${Array.from({ length: 200 }, (_, i) => {
  const t = (i / 200) * 2 * Math.PI;
  return `${(23.8 + 0.05 * Math.sin(t)).toFixed(5)},${(91.8 + 0.05 * Math.cos(t)).toFixed(5)}`;
}).join(" ")}</polygon></polygons>`;

test("collectWarnAreas: every alert is archived as it arrives, with its times and a finer area than the map's", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "2"]);
  stubSachet({ "1": CAP_IMD, "2": capWith("2026-11-16T10:00:00+05:30") }, DETAILED);
  await collectWarnAreas(env, { now: NOW });
  const a = await archived(env, "1");
  assert.equal(a.effective, "2026-11-19T09:14:00+05:30");
  assert.equal(a.onset, "2026-11-19T09:21:10+05:30");
  assert.equal(a.expires, "2026-11-19T12:14:00+05:30");
  assert.equal(a.sent, "2026-11-19T09:21:10+05:30");
  assert.equal(a.severity, "Moderate");
  const points = (rings: [number, number][][]) => rings.reduce((n, r) => n + r.length, 0);
  assert.ok(points(a.rings) > points((await stored(env, "1")).rings), "finer than the map's copy");
  // expired when first seen: no rings for the map, but the archive knows where it was
  assert.deepEqual((await stored(env, "2")).rings, []);
  assert.ok((await archived(env, "2")).rings.length > 0);
});

test("collectWarnAreas: pruning the map's copy never touches the archive", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1", "4"]);
  stubSachet({ "1": CAP_IMD, "4": CAP_IMD });
  await collectWarnAreas(env, { now: NOW });
  await seedFeed(env, ["1"]);
  stubSachet({});
  await collectWarnAreas(env, { now: NOW + 2 * 86_400_000 });
  assert.deepEqual((await stored(env, "1")).rings, []);
  assert.equal(await stored(env, "4"), null);
  assert.equal((await archived(env, "1")).rings.length, 2);
  assert.equal((await archived(env, "4")).rings.length, 2);
  // and a later run, with the map copy's rings gone, does not refetch to archive it again
  const calls = stubSachet({ "1": CAP_IMD });
  await collectWarnAreas(env, { now: NOW + 3 * 86_400_000 });
  assert.deepEqual(calls, []);
});

test("collectWarnAreas: an alert stored before the archive existed is fetched once more to archive it", async () => {
  const { env } = testWorker();
  await seedFeed(env, ["1"]);
  // the record as the previous version wrote it: no archive, no `archived` mark
  await env.OAQ_R2.put(
    `${AREAS_PREFIX}1.json`,
    JSON.stringify({
      identifier: "1",
      event: "Light Rain",
      severity: "Moderate",
      expires: "2026-11-19T12:14:00+05:30",
      issuer: "x",
      headline: "h",
      areaDesc: "a",
      rings: [],
    }),
    { customMetadata: { expires: String(Date.parse("2026-11-19T12:14:00+05:30")), rings: "0" } },
  );
  let calls = stubSachet({ "1": CAP_IMD });
  const r = await collectWarnAreas(env, { now: NOW });
  assert.equal(r.fetched, 1);
  assert.ok(calls.some((u) => u.endsWith("identifier=1")));
  assert.equal((await archived(env, "1")).rings.length, 2);
  calls = stubSachet({ "1": CAP_IMD });
  assert.equal((await collectWarnAreas(env, { now: NOW + 60_000 })).fetched, 0);
  assert.deepEqual(calls, []);
});
