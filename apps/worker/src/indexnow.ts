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
