# mugilu

**India's open sky** — give a location, get the conditions in the air that affect your health there. Open, free, and made to be read by people, apps, and AI agents alike.

> ಮುಗಿಲು — Kannada for *cloud / sky*. The third tool in a small commons, alongside **[bharatlas](https://bharatlas.com)** (open geo) and **[mdshare](https://mdshare.live)**. Live at **[mugilu.live](https://mugilu.live)**.

## What this is
mugilu turns scattered, hard-to-reach environmental data into one normalized, location-addressable layer for India. Every reading is available as **HTML** (for people), **JSON** (for apps), **Markdown** (for LLMs), and **MCP** (for agents).

- **Today:** live air quality across ~650 stations — a worst-to-best leaderboard, per-station pages, CPCB AQI, and an estimated life-expectancy impact via the [Air Quality Life Index](https://aqli.epic.uchicago.edu/).
- **Where it's going:** `coordinate → conditions` — one call returning air + heat (incl. wet-bulb) + rain + UV + ozone + dust + official NDMA/IMD warnings for any point in India. See [`supporting-docs/`](supporting-docs/) for the data sources, metric→source matrix, and build plan.

## Principles
- **Free, open, MIT.** For individuals. **Non-commercial**, always.
- **No warranty, no accuracy guarantee.** Informational and educational only — **not for medical, emergency, or safety-critical decisions.** For official hazard warnings, consult NDMA / IMD directly.
- **Honest about data.** Measured vs modelled is labelled; thin-coverage layers are marked or left out.
- **Minimal & fast.** Cloudflare free tier, near-zero JS, no database.

## Architecture
A Cloudflare Worker (hourly cron) handshakes the OAQ broker, fetches the provider feeds, normalizes them, computes AQI, and writes a snapshot to R2. A build step renders static HTML/JSON/MD to Cloudflare Pages. Everything sits behind one normalized schema, so each data source is a swappable adapter.

## Data & attribution
Air quality is mirrored from **[oaq.notf.in](https://oaq.notf.in)** (the Open Air Quality broker), which aggregates **CPCB** (Govt. of India), **Airnet** ([CSTEP](https://cstep.in)), and **Aurassure**. As mugilu expands it adds Open-Meteo (CC-BY 4.0), NASA POWER / FIRMS, and NDMA SACHET. **Each source keeps its own licence** — see the per-page attribution and `/terms`.

Health-impact figures use the [AQLI](https://aqli.epic.uchicago.edu/) methodology (U Chicago EPIC; Ebenstein et al. 2017 *PNAS*; WHO 2021 PM2.5 guideline).

## License
Code: **MIT** (see [LICENSE](./LICENSE)). Data is **not** relicensed — each upstream source's licence and attribution apply.

---
made by [urbanmorph](https://urbanmorph.com) · a digital commons · [pdgi.org](https://pdgi.org)
