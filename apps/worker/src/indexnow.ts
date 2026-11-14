import { localizedUrl, sitemapPaths } from "./meta";

// IndexNow: tells Bing (which ChatGPT search and others draw on), Yandex, Seznam and Naver
// that pages changed, instead of waiting for a crawl. The key is public by design: it is
// served at /{key}.txt so the engines can check the site owns it. Google does not take
// IndexNow; it reads the sitemap.

export const INDEXNOW_KEY = "fd3a420af76af8f986c5648a2995ee0e";
export const INDEXNOW_PATH = `/${INDEXNOW_KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** Every sitemap page in English, Hindi and Kannada (place pages' readings change hourly). */
export function indexNowUrls(siteUrl: string): string[] {
  return sitemapPaths().flatMap((p) => ["en", "hi", "kn"].map((l) => localizedUrl(siteUrl, p, l)));
}

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MAX = 10_000; // IndexNow's limit for one request
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** IndexNow answered 429 every night from 11 to 13 Nov 2026, to all ~2,400 pages and then to a
 *  seventh of them a day: it had marked the site for resubmitting unchanged pages. Nothing is sent
 *  before this date; the sitemap still lists every page. */
export const PAUSED_UNTIL = Date.UTC(2026, 10, 21);

/** What has been announced: every page IndexNow has been told about, and when it was last told. */
export type IndexNowState = { known: string[]; sentAt: number };
export type IndexNowPlan =
  | { kind: "paused"; until: string }
  | { kind: "record"; state: IndexNowState }
  | { kind: "wait"; next: string }
  | { kind: "none" }
  | { kind: "send"; urls: string[]; state: IndexNowState };

/** Tonight's IndexNow step. After the pause: the first run records the pages (all were sent before)
 *  and sends nothing; after that, only pages not yet announced, at most once a week. The new state
 *  is saved only after IndexNow accepts the send. */
export function planIndexNow(urls: string[], state: IndexNowState | null, now: number): IndexNowPlan {
  if (now < PAUSED_UNTIL) return { kind: "paused", until: ymd(PAUSED_UNTIL) };
  if (!state) return { kind: "record", state: { known: urls, sentAt: now } };
  if (now - state.sentAt < WEEK) return { kind: "wait", next: ymd(state.sentAt + WEEK) };
  const known = new Set(state.known);
  const fresh = urls.filter((u) => !known.has(u)).slice(0, MAX);
  if (!fresh.length) return { kind: "none" };
  return { kind: "send", urls: fresh, state: { known: [...state.known, ...fresh], sentAt: now } };
}

/** Announce `urls` (up to 10,000) in one request. A refusal throws, so the job logs it. */
export async function submitIndexNow(
  siteUrl: string,
  urls: string[],
  fetcher: typeof fetch = fetch,
): Promise<{ status: number; count: number }> {
  const res = await fetcher(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(siteUrl).host,
      key: INDEXNOW_KEY,
      keyLocation: `${siteUrl}${INDEXNOW_PATH}`,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`indexnow ${res.status}`);
  return { status: res.status, count: urls.length };
}

/** Where the announced pages are kept, in mugilu's KV. */
export const INDEXNOW_STATE_KEY = "indexnow:state";
type Kv = { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> };

/** The nightly IndexNow step: plan, send if there is anything new, save. Returns the one log line;
 *  a refused send throws, so the job logs "[indexnow] failed: …" and the state is left as it was. */
export async function runIndexNow(
  kv: Kv,
  siteUrl: string,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const saved = await kv.get(INDEXNOW_STATE_KEY);
  const plan = planIndexNow(indexNowUrls(siteUrl), saved ? (JSON.parse(saved) as IndexNowState) : null, now);
  switch (plan.kind) {
    case "paused":
      return `[indexnow] paused until ${plan.until} (429 on 11–13 Nov); the sitemap lists every page`;
    case "record":
      await kv.put(INDEXNOW_STATE_KEY, JSON.stringify(plan.state));
      return `[indexnow] recorded ${plan.state.known.length} pages; from now on only new ones are announced`;
    case "wait":
      return `[indexnow] next send on ${plan.next} at the earliest`;
    case "none":
      return "[indexnow] no new pages";
    case "send": {
      const r = await submitIndexNow(siteUrl, plan.urls, fetcher);
      await kv.put(INDEXNOW_STATE_KEY, JSON.stringify(plan.state));
      return `[indexnow] ${r.count} new page${r.count === 1 ? "" : "s"} (HTTP ${r.status})`;
    }
  }
}
