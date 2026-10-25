# mugilu

[![CI](https://github.com/urbanmorph/mugilu/actions/workflows/ci.yml/badge.svg)](https://github.com/urbanmorph/mugilu/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-0284c7.svg)](./LICENSE) [![Live](https://img.shields.io/badge/live-mugilu.live-0284c7)](https://mugilu.live) [![MCP](https://img.shields.io/badge/MCP-2025--06--18-7c3aed)](https://mugilu.live/mcp) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)

**The open sky of India, one coordinate at a time.** Give a point anywhere in India and get what the sky is doing to you right now: air, heat (with wet-bulb), rain, UV, dust, wind, fog, fire smoke, and the official government warning over that spot. Open, free, and built to be read by people, apps, and AI agents alike, in English, Hindi and Kannada.

> ಮುಗಿಲು is Kannada for *cloud / sky*. The third tool in a small commons, alongside **[bharatlas](https://bharatlas.com)** (open geo) and **[mdshare](https://mdshare.live)**. Live at **[mugilu.live](https://mugilu.live)**.

![mugilu: the sky over Delhi, weighted for asthma](docs/hero.png)

## Try it

- **[mugilu.live](https://mugilu.live)**: type any place, in any language (ಬೆಂಗಳೂರು · दिल्ली · சென்னை)
- a point: **[/c/12.97,77.59](https://mugilu.live/c/12.97,77.59)** · a place: **[/c/bengaluru](https://mugilu.live/c/bengaluru)** · for someone: **[/c/delhi?as=asthma](https://mugilu.live/c/delhi?as=asthma)**

## What it is

Everywhere else the sky is split up and locked away: air apps show air, weather apps show weather, the government's own data sits in separate apps that do not talk to each other, and the tools that do combine anything are paywalled and modelled. mugilu stitches it back into one location-addressable layer for India.

- **`coordinate → conditions`** for any point: air quality from real ground stations (modelled where none is within 50 km), heat and wet-bulb, today's high against the 1991-2020 normal, rain, UV, dust, wind, fog, fire smoke, and active **NDMA / SACHET** warnings. Each reading is drawn against the limits it is judged by, in the order it matters to you now.
- An **Ambient** read that names the single worst hazard for you and what to do about it, weighted by who is asking: asthma, older adults, children, outdoor workers, heart condition. A persona view tags that group's own readings and says how to take the read.
- Every reading as **HTML** for people, **JSON** for apps, **Markdown** for LLMs, a timestamped **PNG**, an embeddable card, a self-refreshing **display** for a wall screen, and an **MCP** server for agents.
- An installable web app: it keeps the last reading of places you opened for when you are offline, refreshes itself when it comes back on screen, and can send opt-in alerts for official warnings at a place.

## Use it

Open and keyless. The same reading, four ways:

```bash
# JSON: by coordinate or by name, optionally weighted for a vulnerability
curl https://mugilu.live/c/12.97,77.59.json
curl "https://mugilu.live/c/delhi.json?as=asthma"
```

A trimmed response (full layers: `air`, `heat`, `heat_vs_normal`, `rain`, `uv`, `dust`, `wind`, `visibility`, `smoke`, `warnings`, `nearby_warnings`; `ambient.order` lists the readings in the order every surface shows them):

```json
{
  "schema": "mugilu/conditions",
  "version": 1,
  "place": "Delhi, Delhi",
  "ambient": {
    "risk_band": "severe",
    "driver": "heat",
    "persona": "asthma",
    "summary": "The heat is dangerous. Go to a cool place out of the sun. Drink water.",
    "order": ["heat", "air", "sun", "rain", "dust"]
  },
  "air":  { "kind": "measured", "aqi": 140, "band": "moderate", "yll_years": 0.83 },
  "heat": { "apparent_c": 46, "wet_bulb_c": 27 },
  "attribution": "… via mugilu",
  "disclaimer": "Informational only, not for medical, emergency, or safety-critical decisions. For official hazard warnings consult NDMA / IMD."
}
```

**For AI agents**: an MCP server (JSON-RPC 2.0 over Streamable HTTP):

```bash
npx @modelcontextprotocol/inspector --cli https://mugilu.live/mcp --transport http --method tools/list
```

Or add `https://mugilu.live/mcp` as a custom connector in Claude or Cursor and ask *"is it safe for my asthmatic kid to play outside in Indiranagar right now?"*

| Route | Returns |
|---|---|
| `/c/{lat},{lon}` (+ `.json` `.md` `.png`) | conditions at a point: HTML, JSON, Markdown, or a timestamped image |
| `/c/{slug}` | a named place, e.g. `/c/bengaluru` |
| `?as=` (asthma · elderly · child · outdoor · heart) | weight the Ambient read for a vulnerability |
| `/hi/…` · `/kn/…` | the same pages in Hindi or Kannada |
| `/display` · `/c/{place}?kiosk` | set up a wall screen · the self-refreshing display |
| `/warnings` · `/places` | active warnings across India · every district and city |
| `/near` · `/suggest` | nearest air stations · place search (native scripts work) |
| `/index.json` · `/warnings.json` | national air leaderboard · active NDMA/IMD warnings |
| `/embed/{lat},{lon}` | embeddable card, one line of HTML |
| `/mcp` · `/openapi.json` · `/llms.txt` | MCP server · OpenAPI 3.1 spec · LLM manifest |
| `?ref=your-app` | self-identify on any API/embed call (aggregate attribution) |

**Refreshing:** readings recompute on a ~15-minute cycle (air and official warnings change hourly, weather at most every 15 minutes). A single conditions response carries every metric, each with its own `as_of`, and a `refresh_after_seconds` field mirrored by the `Cache-Control` max-age on the JSON, Markdown and `/embed` surfaces. Poll or reload at most once every 15 minutes per place: faster returns identical data. If you embed the card, that means refreshing the iframe every 15 minutes or so, or use `/c/{place}?kiosk` (the Display view), which self-refreshes.

## Run it locally

One Cloudflare Worker, forkable and self-hostable. Needs **Node 22+**, **[pnpm](https://pnpm.io)**, and, to deploy, a Cloudflare account.

```bash
git clone https://github.com/urbanmorph/mugilu.git
cd mugilu && pnpm install
cd apps/worker

pnpm dev        # local dev → http://localhost:8787
pnpm test       # the test suite (node --test via tsx)
pnpm typecheck  # tsc --noEmit
pnpm deploy     # wrangler deploy for your own fork (your CF account + the KV/R2/D1 bindings in wrangler.toml)
```

The air snapshot, national grid, fires, and warnings are refreshed by crons into R2, so a fresh fork is empty until the first cron runs (or you hit the `/collect` routes). The heat normals are built offline by `scripts/build-heat-normals.ts` (resumable, rate-limited) and shipped in `data/heat-normals.json`; coverage is still being completed.

## Architecture

A single Cloudflare Worker. Hourly crons refresh the air snapshot, NASA FIRMS fires and NDMA/SACHET warnings (to R2) and send opt-in warning alerts; every four hours a national heat/rain/UV/dust grid is sampled; a daily job refreshes the place hierarchy and prunes old referrer rows. A request to `/c/{lat},{lon}` assembles the nearest-station air, live Open-Meteo weather, fires and point warnings into one normalized schema, so each source is a swappable adapter. Pages that are the same for everyone are cached at the edge for a few minutes (degraded builds are never stored). Little client JS (the offline worker, install, auto-refresh and alerts); D1 holds only aggregate usage metrics and opt-in alert subscriptions, never on the read path.

## Principles

- **Free, open, MIT.** For individuals. **Non-commercial**, always.
- **Whole-sky, never air alone.** Heat, rain, UV, dust, and official warnings are first-class.
- **No warranty, no accuracy guarantee.** Informational and educational only, **not for medical, emergency, or safety-critical decisions.** For official hazard warnings, consult NDMA and IMD directly.
- **Honest about the moat.** It is the stitch, the openness, and the interface, not the data. The data belongs to others and is credited. Measured and modelled are labelled; thin-coverage layers are marked or left out.
- **Minimal and fast.** One Worker, plain HTML readable without JavaScript, nothing heavy on the read path.

How mugilu follows the People's Digital Goods & Infrastructure principles is tracked in **[PDGI.md](./PDGI.md)**; the glass-box methodology (every threshold) is at **[/methodology](https://mugilu.live/methodology)**.

## Data and attribution

Measured air is mirrored from **[oaq.notf.in](https://oaq.notf.in)** (the Open Air Quality broker: **CPCB**, **Airnet** by [CSTEP](https://cstep.in), **Aurassure**, and **Google AirView+**); where no station is within 50 km, air is modelled by **[Open-Meteo](https://open-meteo.com)** and labelled so. Weather, heat, UV, dust and wind come from Open-Meteo (CC-BY 4.0). "Today's high compared with normal" uses 1991-2020 normals of **ERA5** reanalysis (**Copernicus** Climate Change Service) via Open-Meteo's historical archive, built offline on a 1° grid by `apps/worker/scripts/build-heat-normals.ts`. Warnings come from **NDMA / SACHET** and **IMD**. Geography comes from **[bharatlas](https://bharatlas.com)**; place search from **OpenStreetMap** (ODbL) and **GeoNames** (CC-BY 4.0, via the Open-Meteo geocoder). Fire smoke comes from **NASA FIRMS**. Health-impact figures use the **[AQLI](https://aqli.epic.uchicago.edu/)** methodology (U Chicago EPIC). **Each source keeps its own licence**: see the per-page attribution and `/terms`.

## Contributing

Issues and PRs welcome. A new data source is a new adapter into the normalized schema; tests are required (`pnpm test`) and changes go through a pull request: CI runs the typecheck, tests and a Prettier check, and merging to `main` deploys automatically once they pass. The repo is small on purpose: read [`apps/worker/src/index.ts`](./apps/worker/src/index.ts) to see the whole route surface in one place.

## License

Code: **MIT** (see [LICENSE](./LICENSE)). Data is **not** relicensed: each upstream source's licence and attribution apply.

---

made by [urbanmorph](https://urbanmorph.com) · a digital commons · [pdgi.org](https://pdgi.org)
