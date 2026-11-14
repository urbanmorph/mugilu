import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INDEXNOW_KEY,
  indexNowUrls,
  submitIndexNow,
  planIndexNow,
  PAUSED_UNTIL,
  runIndexNow,
  INDEXNOW_STATE_KEY,
} from "../src/indexnow";

const SITE = "https://mugilu.live";

test("indexNowUrls: every page in the sitemap, in all three languages", () => {
  const urls = indexNowUrls(SITE);
  assert.ok(
    urls.includes(`${SITE}/c/delhi`) && urls.includes(`${SITE}/hi/c/delhi`) && urls.includes(`${SITE}/kn/c/delhi`),
  );
  assert.ok(urls.includes(SITE) && urls.includes(`${SITE}/hi`));
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.length > 2000 && urls.length <= 10_000); // IndexNow takes up to 10,000 a request
});

test("submitIndexNow: one POST to the shared IndexNow endpoint, with the key file's location", async () => {
  let sent: { url: string; body: Record<string, unknown> } | undefined;
  const fetcher = (async (url: string, init: RequestInit) => {
    sent = { url, body: JSON.parse(String(init.body)) };
    return new Response(null, { status: 202 });
  }) as unknown as typeof fetch;
  const r = await submitIndexNow(SITE, [`${SITE}/c/delhi`], fetcher);
  assert.deepEqual(r, { status: 202, count: 1 });
  assert.equal(sent!.url, "https://api.indexnow.org/indexnow");
  assert.deepEqual(sent!.body, {
    host: "mugilu.live",
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: [`${SITE}/c/delhi`],
  });
  assert.match(INDEXNOW_KEY, /^[0-9a-f]{32}$/);
});

test("submitIndexNow: a refusal is an error, so the daily job logs it as failed", async () => {
  const fetcher = (async () => new Response("Forbidden", { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(submitIndexNow(SITE, [SITE], fetcher), /indexnow 403/);
});

// IndexNow answered 429 every night from 11 to 13 Nov 2026, first to all ~2,400 pages, then to a
// seventh of them: it had marked the site for resubmitting pages that hadn't changed. So it pauses
// for a week, then announces only pages that are new, at most once a week. The sitemap still lists
// every page for Bing and Google.

const DAY = 86_400_000;
const at = (d: number) => Date.UTC(2026, 10, d, 20, 30);
const A = [`${SITE}/c/a`, `${SITE}/c/b`];

test("planIndexNow: paused until 21 Nov, whatever is stored", () => {
  assert.equal(PAUSED_UNTIL, Date.UTC(2026, 10, 21));
  assert.deepEqual(planIndexNow(A, null, at(14)), { kind: "paused", until: "2026-11-21" });
  assert.deepEqual(planIndexNow(A, { known: [], sentAt: 0 }, at(20)), { kind: "paused", until: "2026-11-21" });
});

test("planIndexNow: the first run after the pause records the pages and sends nothing", () => {
  assert.deepEqual(planIndexNow(A, null, at(21)), { kind: "record", state: { known: A, sentAt: at(21) } });
});

test("planIndexNow: within a week of the last send, it waits", () => {
  const state = { known: A, sentAt: at(21) };
  assert.deepEqual(planIndexNow([...A, `${SITE}/c/new`], state, at(27)), { kind: "wait", next: "2026-11-28" });
});

test("planIndexNow: after a week, only pages it hasn't announced", () => {
  const state = { known: A, sentAt: at(21) };
  const now = at(21) + 7 * DAY;
  assert.deepEqual(planIndexNow([...A, `${SITE}/c/new`], state, now), {
    kind: "send",
    urls: [`${SITE}/c/new`],
    state: { known: [...A, `${SITE}/c/new`], sentAt: now },
  });
  assert.deepEqual(planIndexNow(A, state, now), { kind: "none" });
});

test("planIndexNow: never more than IndexNow's 10,000 a request", () => {
  const many = Array.from({ length: 12_000 }, (_, i) => `${SITE}/c/p${i}`);
  const plan = planIndexNow(many, { known: [], sentAt: 0 }, at(30));
  assert.equal(plan.kind, "send");
  if (plan.kind === "send") {
    assert.equal(plan.urls.length, 10_000);
    assert.equal(plan.state.known.length, 10_000); // the rest go next week
  }
});

// ----- the nightly step: state in KV, one log line ops reads (worker/src/collect/jobs.js) -----

function fakeKv(init?: unknown) {
  const store = new Map<string, string>(init ? [[INDEXNOW_STATE_KEY, JSON.stringify(init)]] : []);
  return {
    store,
    kv: { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => void store.set(k, v) },
  };
}
const accept = (async () => new Response(null, { status: 202 })) as unknown as typeof fetch;
const throttle = (async () => new Response(null, { status: 429 })) as unknown as typeof fetch;
const never = (async () => {
  throw new Error("must not send");
}) as unknown as typeof fetch;

test("runIndexNow: paused, it sends nothing and says until when", async () => {
  const { kv, store } = fakeKv();
  assert.equal(
    await runIndexNow(kv, SITE, at(14), never),
    "[indexnow] paused until 2026-11-21 (429 on 11–13 Nov); the sitemap lists every page",
  );
  assert.equal(store.size, 0);
});

test("runIndexNow: the first run after the pause records every page, sends nothing", async () => {
  const { kv, store } = fakeKv();
  const line = await runIndexNow(kv, SITE, at(21), never);
  assert.match(line, /^\[indexnow\] recorded \d+ pages; from now on only new ones are announced$/);
  assert.equal(JSON.parse(store.get(INDEXNOW_STATE_KEY)!).known.length, indexNowUrls(SITE).length);
});

test("runIndexNow: sends the new pages and saves them only once IndexNow accepts", async () => {
  const known = indexNowUrls(SITE).slice(1);
  const { kv, store } = fakeKv({ known, sentAt: at(1) });
  assert.equal(await runIndexNow(kv, SITE, at(22), accept), "[indexnow] 1 new page (HTTP 202)");
  assert.equal(JSON.parse(store.get(INDEXNOW_STATE_KEY)!).known.length, known.length + 1);
  const again = fakeKv({ known, sentAt: at(1) });
  await assert.rejects(runIndexNow(again.kv, SITE, at(22), throttle), /indexnow 429/);
  assert.equal(
    JSON.parse(again.store.get(INDEXNOW_STATE_KEY)!).known.length,
    known.length,
    "unchanged after a refusal",
  );
});

test("runIndexNow: nothing new, or sent within the week: a quiet line, no request", async () => {
  const all = indexNowUrls(SITE);
  assert.equal(
    await runIndexNow(fakeKv({ known: all, sentAt: at(1) }).kv, SITE, at(22), never),
    "[indexnow] no new pages",
  );
  assert.equal(
    await runIndexNow(fakeKv({ known: all, sentAt: at(21) }).kv, SITE, at(24), never),
    "[indexnow] next send on 2026-11-28 at the earliest",
  );
});
