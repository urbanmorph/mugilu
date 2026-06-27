# mugilu

**The open sky of India, one coordinate at a time.** Give a point anywhere in India and get what the sky is doing to you right now: air, heat (with wet-bulb), rain, UV, dust, and the official government warning over that spot. Open, free, and built to be read by people, apps, and AI agents alike.

> ಮುಗಿಲು is Kannada for *cloud / sky*. The third tool in a small commons, alongside **[bharatlas](https://bharatlas.com)** (open geo) and **[mdshare](https://mdshare.live)**. Live at **[mugilu.live](https://mugilu.live)**.

## What it is
Everywhere else the sky is split up and locked away: air apps show air, weather apps show weather, the government's own data sits in separate apps that do not talk to each other, and the tools that do combine anything are paywalled and modelled. mugilu stitches it back into one location-addressable layer for India.

- **`coordinate → conditions`** for any point: air quality from real ground stations, heat and wet-bulb, rain, UV, dust, and active **NDMA / SACHET** warnings.
- An **Ambient** read that names the single worst hazard for you and what to do about it, weighted by who is asking: asthma, older adults, children, outdoor workers.
- Every reading as **HTML** for people, **JSON** for apps, **Markdown** for LLMs, and **MCP** for agents.

## Principles
- **Free, open, MIT.** For individuals. **Non-commercial**, always.
- **Whole-sky, never air alone.** Heat, rain, UV, dust, and official warnings are first-class.
- **No warranty, no accuracy guarantee.** Informational and educational only, **not for medical, emergency, or safety-critical decisions.** For official hazard warnings, consult NDMA and IMD directly.
- **Honest about the moat.** It is the stitch, the openness, and the interface, not the data. The data belongs to others and is credited. Measured and modelled are labelled; thin-coverage layers are marked or left out.
- **Minimal and fast.** Cloudflare free tier, near-zero JS, no database.

## Architecture
A single Cloudflare Worker. Crons refresh the air snapshot hourly, poll and archive NDMA/SACHET warnings hourly, and sample a national heat/rain/UV/dust grid every four hours, all to R2. A request to `/c/{lat},{lon}` assembles the nearest-station air, live Open-Meteo weather, and point warnings into one normalized schema, so each source is a swappable adapter.

## Data and attribution
Air is mirrored from **[oaq.notf.in](https://oaq.notf.in)** (the Open Air Quality broker: **CPCB**, **Airnet** by [CSTEP](https://cstep.in), and **Aurassure**) and OpenAQ. Weather, heat, UV, and dust come from **[Open-Meteo](https://open-meteo.com)** (CC-BY 4.0). Warnings come from **NDMA / SACHET** and **IMD**. Geography comes from **[bharatlas](https://bharatlas.com)**. Health-impact figures use the **[AQLI](https://aqli.epic.uchicago.edu/)** methodology (U Chicago EPIC). **Each source keeps its own licence**, see the per-page attribution and `/terms`.

## License
Code: **MIT** (see [LICENSE](./LICENSE)). Data is **not** relicensed: each upstream source's licence and attribution apply.

---
made by [urbanmorph](https://urbanmorph.com) · a digital commons · [pdgi.org](https://pdgi.org)
