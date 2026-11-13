import { test } from "node:test";
import assert from "node:assert/strict";
import { INDEXNOW_KEY, indexNowUrls, todaysIndexNowUrls, submitIndexNow } from "../src/indexnow";

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

test("todaysIndexNowUrls: a seventh of the pages a day, so each is announced once a week", () => {
  // Sending every page (~2,400) every day drew HTTP 429 from IndexNow on 11 and 12 Nov: it throttles
  // resubmitting unchanged URLs. A rotating slice keeps each page announced weekly.
  const all = indexNowUrls(SITE);
  const week = Array.from({ length: 7 }, (_, d) => todaysIndexNowUrls(SITE, new Date(Date.UTC(2026, 10, 16 + d))));
  for (const day of week) assert.ok(day.length > 0 && day.length <= Math.ceil(all.length / 7));
  assert.deepEqual(week.flat().sort(), [...all].sort()); // the week covers every page exactly once
  // the same day gives the same slice (a rerun sends nothing new), the next week repeats it
  const mon = new Date(Date.UTC(2026, 10, 16, 20, 30));
  assert.deepEqual(todaysIndexNowUrls(SITE, mon), todaysIndexNowUrls(SITE, new Date(Date.UTC(2026, 10, 16, 3))));
  assert.deepEqual(todaysIndexNowUrls(SITE, mon), todaysIndexNowUrls(SITE, new Date(Date.UTC(2026, 10, 23, 20, 30))));
});
