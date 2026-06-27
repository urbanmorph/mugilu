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
No third-party analytics, no tracking, no ad tech, no accounts, no email, no personal data collected. "Use my location" runs entirely in your browser (the W3C Geolocation API) and is never stored or tied to a person; a lookup is just a coordinate in a URL you chose to open.
Evidence: the pages ship no analytics or third-party scripts; the client-side-only geolocation in the home page source.

### Built to be built on (cooperativism for infrastructure) — 🟡
mugilu's reason to exist is to be infrastructure others build on: the same readings come as open, machine-readable data, an embeddable widget (`/embed/{lat},{lon}`), and a timestamped snapshot image (`/c/{lat},{lon}.png`) — so anyone can put the whole sky behind their own map, story, dashboard or alert, credited, with one line of HTML. It is not a contribution platform in the bharatlas sense (you don't publish your own data here); the cooperativism is in lowering the floor for everyone else's tools.
Direction: the embed widget and snapshot image ship today; still to come are a documented API and an MCP server so apps and AI agents can query the sky directly. Tracked in [/about](https://mugilu.live/about) ("Build on it").

### Humans in the loop (AI does not cut people out) — 🟡
The machine-readable rights signals are already here: the source, attribution and disclaimer travel inside every JSON and Markdown response by design, so an agent that drops the wrapper still receives the credit and the limits. What's missing is the formal layer: an MCP server, schema.org `creditText`/`usageInfo` on the pages, and a usage stanza in `robots.txt`.
Direction: ship the MCP server with the licence terms in its instructions, and add the structured-data and robots signals.

### A non-digital alternative must exist — 🟡
mugilu is informational, not a service that replaces anything: for official warnings and any safety-critical decision it points to NDMA and IMD — the authoritative channels — in every single response. The pages are plain HTML, readable without JavaScript and printable.
Direction: keep the disclaimer and the official-source signpost on every reading; never make a health-relevant answer digital-only.

### Grassroots and reaching the divide-affected — 🟡
Place search now works in Indian scripts — typing बेंगलुरु / ಬೆಂಗಳೂರು / சென்னை finds your spot — so the front door is no longer English-only. But the interface itself (labels, the Ambient read) is still English; full vernacular access is not built.
Direction: localise the UI (path-prefixed /hi, /kn… with a shared string table and hreflang), and conversational access in any Indian language through the planned AI/MCP layer (ask in any language, answer from the canonical data).

### Algorithmic transparency — 🟡
Unlike a pure catalog, mugilu runs one algorithm that interprets *for* a person: the Ambient read, which names the single worst hazard and weights it by a chosen vulnerability (asthma, older adults, children, outdoor workers, heart condition). It is deliberately glass-box — the thresholds are public and come from CPCB, NDMA, WHO and AQLI; the persona is a toggle the user picks (never inferred or tracked); and the output is labelled informational, not advice. No profiling, no ranking of people.
Direction: publish a plain-language methodology page for the Ambient thresholds so the judgement is fully auditable, and keep the persona user-selected.

## Fork this

Want to show your project follows PDGI? Map each principle to the concrete thing you do, link the evidence, and mark the gaps honestly. Copy this file as a template and keep it in your repo, where its git history becomes the record of your work. (We forked it from [bharatlas](https://github.com/urbanmorph/geodata/blob/main/PDGI.md).)

Built by [Urban Morph](https://urbanmorph.com). PDGI framework: [pdgi.org](https://pdgi.org/).
