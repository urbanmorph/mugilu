# How mugilu follows PDGI

[mugilu](https://mugilu.live) is built on the principles of [People's Digital Goods and Infrastructure (PDGI)](https://pdgi.org/blog/peoples-digital-goods-and-infrastructure/): people before digital, rights-centric, commons-oriented, transparent.

This is a public scorecard of how those principles are actually implemented, with links to the evidence and honest notes on where we fall short.

Status key: ✅ implemented · 🟡 partial · ⛳ gap, with intended direction.

## Scorecard

### People before digital (rights and collective identity) — ✅
mugilu owns no sensors and runs no forecasts; it stitches others' open data into one whole-sky view for a point. Every reading carries the source it came from and is labelled "measured" or "modelled", so nothing is passed off as ours. Attribution and a plain disclaimer travel *inside* every response, and for any official or safety-critical decision we send people to NDMA and IMD, not to us. No accounts, no profiles, no personal data.
Evidence: per-reading `source`/`station` and the `attribution` + `disclaimer` on every `/c` response (HTML, JSON and Markdown), [/terms](https://mugilu.live/terms), [/about](https://mugilu.live/about).

### Transparency and accountability — ✅
Open source (MIT), open repository, and every reading available as JSON and Markdown beside the page. Sources and their licences are named; measured ground-station values and modelled fill are labelled differently and never blended silently. This scorecard and its git history are the public record.
Evidence: this repository, the `.json`/`.md` twin of every reading, [/terms](https://mugilu.live/terms), the measured-vs-modelled marker on `/c`.

### Decentralisation and no lock-in — ✅
No account, no signup, no key. Every reading is open data in plain formats (JSON, Markdown), and `/c/{lat},{lon}` is a permanent, shareable address for any point in India. The whole thing is one stateless Cloudflare Worker — forkable and self-hostable from the MIT repository.
Evidence: keyless `/c/{lat},{lon}.{json,md}` and `/near`, the [MIT licence](./LICENSE), the single-worker architecture.

### Free software and the digital commons — ✅
MIT code, and open data only: mugilu draws solely on free/open upstreams — CPCB and OpenAQ for air, Open-Meteo (CC-BY) for weather, NDMA/IMD via SACHET for warnings, bharatlas for geography. The data is never relicensed; each source keeps its own terms. Non-commercial, for good.
Evidence: [LICENSE](./LICENSE), [/terms](https://mugilu.live/terms), the source list in [/about](https://mugilu.live/about).

### Privacy — ✅
No third-party analytics, no tracking scripts, no ad tech, no accounts, no email, no personal data. The first-party usage metrics we keep — to improve the service, not to sell — are aggregate and privacy-preserving: coordinates rounded to a ~11 km grid (a demand heatmap, never a trail), no IP, no cookies, no per-user records, and no client-side beacon (everything is server-side). "Use my location" runs entirely in your browser (W3C Geolocation) and is never stored or tied to a person; a lookup is just a coordinate in a URL you chose to open.
Evidence: the pages ship no analytics or third-party scripts; first-party metrics are server-side and rounded (`apps/worker/src/metrics.ts`); client-side-only geolocation in the home page source.

### Built to be built on (cooperativism for infrastructure) — ✅
mugilu's reason to exist is to be infrastructure others build on, and the surface is now complete for all three audiences: **people/developers** get the same readings as open machine-readable data (a versioned, self-describing JSON contract — `schema`/`version`, a `units` map, per-layer provenance), an embeddable widget (`/embed/{lat},{lon}`), a timestamped snapshot image (`/c/{lat},{lon}.png`), and a documented [OpenAPI 3.1 spec](https://mugilu.live/openapi.json); **AI agents** get a full MCP server at [`/mcp`](https://mugilu.live/mcp) (JSON-RPC over Streamable HTTP — five tools, resources, and prompts); and a `?ref=` hook lets any caller self-identify. It is not a contribution platform in the bharatlas sense (you don't publish your own data here); the cooperativism is in lowering the floor for everyone else's tools.
Evidence: [`/mcp`](https://mugilu.live/mcp), [`/openapi.json`](https://mugilu.live/openapi.json), `/embed`, the `.json`/`.md`/`.png` siblings, and [/about](https://mugilu.live/about) ("Build on it").

### Humans in the loop (AI does not cut people out) — ✅
The rights signals travel at every layer, so an agent cannot use mugilu without receiving the scope, the limits, and the credit. The source, attribution and disclaimer ride inside every JSON and Markdown response by design; the MCP server carries them in its server instructions and in every tool description (so the model sees them before any call); and schema.org JSON-LD on the pages (a `Dataset` on each `/c` page crediting mugilu + the licence and linking the machine-readable distributions, a `WebSite` on the home) gives answer engines a structured credit + provenance trail.
Evidence: the `attribution`/`disclaimer` fields in every response; the MCP `instructions` + tool descriptions; the `Dataset` JSON-LD on [/c](https://mugilu.live/c/lucknow); `robots.txt`/`llms.txt`.

### A non-digital alternative must exist — 🟡
mugilu is informational, not a service that replaces anything: for official warnings and any safety-critical decision it points to NDMA and IMD — the authoritative channels — in every single response. The pages are plain HTML, readable without JavaScript and printable.
Direction: keep the disclaimer and the official-source signpost on every reading; never make a health-relevant answer digital-only.

### Grassroots and reaching the divide-affected — 🟡
The multilingual front door is now explicit and language-preserving: the search invites native-script input with worked examples (ಬೆಂಗಳೂರು / दिल्ली / சென்னை, all of which resolve), and a place searched in a vernacular script is remembered in *that* script in your saved places. Conversational access in any Indian language is now live, not planned: the [MCP server](https://mugilu.live/mcp) lets an AI assistant take a question in Kannada, Hindi or Tamil, call mugilu, and answer from the canonical data in the language asked. The pages themselves stay plain, low-bandwidth HTML, readable without JavaScript.
What's still missing: the *rendered* interface — the Ambient read, the labels, the advice — is English, so a reader who doesn't read English lands on an English page unless they arrive through an AI assistant.
Direction: localise the UI itself (path-prefixed `/hi`, `/kn`… with a shared string table and `hreflang`), so the direct experience — not just the search box and the agent path — speaks the reader's language.

### Algorithmic transparency — ✅
Unlike a pure catalog, mugilu runs one algorithm that interprets *for* a person: the Ambient read, which names the single worst hazard and weights it by a chosen vulnerability (asthma, older adults, children, outdoor workers, heart condition). It is deliberately glass-box — every threshold is public, comes from CPCB, IMD/NDMA, WHO, the Australian BoM, NASA and AQLI, and is now published in plain language at [/methodology](https://mugilu.live/methodology); the persona is a toggle the user picks (never inferred or tracked); and the output is labelled informational, not advice. No profiling, no ranking of people.
Evidence: [/methodology](https://mugilu.live/methodology), the open `score.ts` it links to, the user-selected persona toggle on every `/c` page.

## Fork this

Want to show your project follows PDGI? Map each principle to the concrete thing you do, link the evidence, and mark the gaps honestly. Copy this file as a template and keep it in your repo, where its git history becomes the record of your work. (We forked it from [bharatlas](https://github.com/urbanmorph/geodata/blob/main/PDGI.md).)

Built by [Urban Morph](https://urbanmorph.com). PDGI framework: [pdgi.org](https://pdgi.org/).
