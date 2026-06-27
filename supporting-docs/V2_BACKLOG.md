# mugilu v2 backlog — metric directions

*Captured 2026-06-27, from the v1 completeness pass. This is a directions list, not a spec — it exists to keep the v1 contract extensible and to bank ideas. Real prioritisation comes from v1 adoption + the [[observability]] usage/referrer signal, not from guessing now.*

v1 is locked: air (AQI + 7 pollutants + AQLI), heat (feels-like, wet-bulb, WBGT), **cold/wind-chill**, rain, uv, dust, **wind**, **visibility/fog**, fire-smoke (FIRMS), official warnings — each measured/modelled/observed, with a versioned, units-bearing JSON. The list below is what's *next*, ranked, each tagged with its data source or its blocker.

## Ranked candidates

| # | Candidate | Class | Source / blocker | Notes |
|---|---|---|---|---|
| 1 | **Trend / history surface** | available | The moat already accumulates: FIRMS daily + SACHET alert archives in R2; Open-Meteo has an archive API | **Strongest + most on-brand** — past = factual, not prediction. We collect it and never read it back. "How bad was the air this week." |
| 2 | **Flood (real-time)** | available | Copernicus **GLOFAS** (CEMS, global incl. India) and **Google Flood Hub** API (explicit India coverage); bharatlas `floods` layer for static zones | Today only via SACHET warnings + raw rain. |
| 3 | **Lightning / thunderstorm** | proxy avail. / strikes blocked | Open-Meteo `cape` / `convective_inhibition` as a storm-risk **proxy** (zero-key, India). Real strike density BLOCKED: Blitzortung ToS, WWLLN paid, no open ISRO/IMD API | Proxy is cheap; real strikes need a paid/licensed feed. |
| 4 | **Coastal / ocean state** | available | **INCOIS** high-wave / swell-surge / storm-surge bulletins (India-specific) | Niche (coastal users); cyclone/surge partly covered by SACHET. |
| 5 | **AQI forecast (6–24h)** | available, **positioning call** | Open-Meteo air-quality `hourly` (CAMS, India) | Most actionable, but **breaks the "mugilu runs no forecasts" line**. Held by default; revisit only as a clearly-labelled, separate surface. |
| 6 | **Pollen / aeroallergens** | **BLOCKED** | Open-Meteo pollen is Europe-only; no India real-time open pollen network (CSIR/AICPAHH is research, not an API) | Real asthma trigger; nothing to wire to. Revisit if an India source appears. |
| 7 | Dew point / explicit comfort | available, redundant | Open-Meteo `dew_point_2m` | Largely subsumed by WBGT + apparent temp. |
| 8 | Golden-hour / daylight | available, low value | Open-Meteo daily `sunrise`/`sunset`/`is_day` | Lifestyle, not exposure — low priority for a hazard service. |

## How v1 stays ready for these
The locked contract is additive-friendly: independent per-layer objects, `schema` + `version`, a `units` map, and `kind`/`as_of` on every layer. New layers (a `flood`, a `lightning`, a `history` endpoint) slot in **without** a breaking change. Only a structural rethink would bump `version` to 2 — and nothing here requires that.

## Positioning guardrail
mugilu reports **what the sky is doing right now** (measured / observed / modelled-current). Trend/history (the past, factual) fits cleanly. A *forecast* (the future, predicted) is a deliberate line we hold — if ever pursued, it must be a separate, clearly-labelled surface, never folded into the "right now" read.
