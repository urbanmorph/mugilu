# mugilu observability plan — storage, usage, perf, behaviour, adoption

*How mugilu measures itself, inside the PDGI privacy commitment. Draft 2026-06-27.*

mugilu has no observability layer yet. This plans it deliberately, because the PDGI scorecard ("no third-party analytics, no tracking, no PII") makes privacy a hard **constraint and a feature**: everything here is first-party, aggregate, Cloudflare-native, cookieless, and free of individual profiles.

## The privacy bar (what we never do)
- No third-party analytics, tags, or ad tech. First-party only.
- No cookies, no fingerprinting, no cross-site identifiers.
- No per-user profiles or sessions; no PII.
- Never store a full client IP tied to behaviour.
- Coordinates aggregated to a grid (a demand heatmap, never a trail).
- A published "what we don't collect" line (extends the /terms + PDGI privacy row).

## 1. Storage (what lives where)
| Store | Today | Add |
|---|---|---|
| **R2** | snapshots + FIRMS/SACHET archives (the moats) | — |
| **KV** | hot state (signatures, etags, seen-sets) | — |
| **D1** | — | durable aggregate **counters** (lookups by city/format, embed loads, adoption by referrer host) |
| **Analytics Engine** | — | high-volume **event** stream (one write/request, sampled), SQL-queried; you choose the columns, so no PII lands |

D1 for things you increment and read back as badges (bharatlas's download-count pattern). Analytics Engine for per-request events (format, rounded geo, referrer host) without a row-per-event blowing up storage.

## 2. Usage (first-party, aggregate)
Count, never track:
- Lookups by **format** — html · json · md · png · embed · (mcp).
- **Popular places** — coordinate rounded to a grid → a national heatmap of demand. The home page's "popular places" then reads off this **D1 store** (real top-lookups), replacing today's hardcoded city list — usage feeds back into the UI.
- Endpoint hits, **persona** mix, search terms (aggregate).
- **Embed loads** — the bharatlas counter applied to `/embed` (how widely the widget is used).

## 3. Adoption / referrers (who builds on us)
The "build on it" story needs to know *who* builds on it — site-level, not user-level:
- **`/embed`** — read the `Referer`/`Origin` header → the host embedding the widget; aggregate by domain.
- **API (`.json`/`.md`/`.png`)** — read `Referer`, and offer a `?ref=` attribution param consumers can set; aggregate by host/app.
- **MCP** (when built) — capture the client name/version from the MCP `initialize` handshake; aggregate by client.

Built **into** the API and MCP from the start (per the ask). This is domain/app-level, not individual end-users → privacy-fine, and it directly measures infrastructure adoption.

## 4. Perf
- **Cloudflare Web Analytics** — free, cookieless, no fingerprinting; real-user Core Web Vitals (LCP/CLS/INP). PDGI-clean drop-in.
- **Workers GraphQL Analytics API** — request counts, status codes, CPU/wall time by route; zero code.
- **Lighthouse** kept as the change-time audit (already in our loop).

## 5. Behaviour
Aggregate patterns only — popular places/formats/times, persona mix, embed adoption, hottest-lookup hours. No individual paths, no sessions. The aggregates answer *"what does India look up, and who builds on us,"* never *"what did this person do."*

## Build sequence (bricks)
1. **Freshness** *(building now)* — inline relative-time on the prebaked/edge-cached pages: the worker renders the absolute `<time datetime>`, a tiny shared script upgrades it to "X ago" at view-time, with the absolute as the no-JS fallback. The lightest version of bharatlas's inline-JS-on-a-cached-page pattern (no fetch needed — the timestamp is already in the HTML).
2. **Usage counters** — D1 + `GET /api/counts` + inline fetch-and-patch (bharatlas pattern), for format + embed + place counts. The home "popular places" switches from its hardcoded city list to the D1 top-lookups.
3. **Adoption / referrers** — capture `Referer`/`Origin` on `/embed` + the API; the `?ref=` param; MCP client info.
4. **Perf** — enable Web Analytics; wire the GraphQL queries.
5. **Behaviour aggregates** — Analytics Engine event stream + a small private dashboard.

Each brick is first-party, aggregate, and reversible. Related: [[license-passthrough-mcp]] (the same "credit/terms travel with the data" ethos applies to who-uses-it).
