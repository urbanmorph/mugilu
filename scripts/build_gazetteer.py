#!/usr/bin/env python3
"""Build mugilu's place gazetteer from OpenStreetMap.

Fetches India's place=city|town|suburb|neighbourhood nodes (with names, alternate
and native-script names) from the Overpass API, assigns each a state by point-in-
polygon against the bharatlas LGD state boundaries, and writes a compact gazetteer
JSON the worker loads from R2.

Stdlib only (no shapely): a bbox-prefiltered ray-casting PIP keeps it dependency-free
so it runs anywhere (the scheduled GitHub Action, or by hand). Output: gazetteer.json
in the current directory (an array of [name, lat, lon, type, state?, alts?]).

Data: (c) OpenStreetMap contributors (ODbL); state boundaries from bharatlas / LGD.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# The public Overpass API 504s/429s frequently under load; try several mirrors,
# each with retry + backoff, so a transient outage doesn't kill the monthly build.
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
STATES_GEOJSON = "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/states/LGD_States.geojson"
UA = "mugilu-gazetteer-build/1.0 (https://mugilu.live)"

OVERPASS_Q = """[out:json][timeout:600];
area["ISO3166-1"="IN"]["admin_level"="2"]->.in;
(
  node["place"~"^(city|town|suburb|neighbourhood)$"]["name"](area.in);
);
out tags center qt;"""

TYPE_CODE = {"city": "c", "town": "t", "suburb": "s", "neighbourhood": "n"}
ALT_TAGS = [
    "alt_name", "old_name", "int_name", "name:en",
    "name:hi", "name:bn", "name:ta", "name:te", "name:kn",
    "name:ml", "name:mr", "name:gu", "name:pa", "name:or",
]


def fetch(url, data=None, timeout=620, attempts=4):
    """GET/POST with retry + backoff on transient errors (429/5xx, timeouts)."""
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code not in (429, 500, 502, 503, 504):
                raise  # a real client/permanent error, not worth retrying
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
        if i < attempts - 1:
            wait = min(60, 5 * 2**i)
            print(f"  fetch {url} failed ({last}); retry {i + 1}/{attempts} in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise last


def overpass(query):
    """Run an Overpass query, falling back across mirrors if one is unavailable."""
    body = b"data=" + urllib.parse.quote(query).encode()
    last = None
    for url in OVERPASS_MIRRORS:
        try:
            return json.loads(fetch(url, data=body))["elements"]
        except Exception as e:  # noqa: BLE001 - try the next mirror on any failure
            last = e
            print(f"  Overpass mirror unavailable ({url}): {e}", file=sys.stderr)
    raise last


def load_states():
    raw = fetch(STATES_GEOJSON, timeout=180)
    feats = json.loads(raw)["features"]
    states = []
    for f in feats:
        p = f["properties"]
        name = p.get("Remarks") or " ".join(w.capitalize() for w in p["STNAME"].split())
        geom = f["geometry"]
        rings = []
        if geom["type"] == "Polygon":
            rings.append(geom["coordinates"][0])
        else:  # MultiPolygon
            for poly in geom["coordinates"]:
                rings.append(poly[0])
        xs = [c[0] for r in rings for c in r]
        ys = [c[1] for r in rings for c in r]
        states.append((name, (min(xs), min(ys), max(xs), max(ys)), rings))
    return states


def in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def state_of(states, lon, lat):
    for name, (mnx, mny, mxx, mxy), rings in states:
        if lon < mnx or lon > mxx or lat < mny or lat > mxy:
            continue
        for ring in rings:
            if in_ring(lon, lat, ring):
                return name
    return None


def main():
    print("Fetching OSM places via Overpass...", file=sys.stderr)
    osm = overpass(OVERPASS_Q)
    print(f"  {len(osm)} place nodes", file=sys.stderr)

    print("Loading state boundaries (bharatlas LGD)...", file=sys.stderr)
    states = load_states()
    print(f"  {len(states)} states", file=sys.stderr)

    rows = []
    matched = 0
    for e in osm:
        t = e["tags"]
        name = t.get("name")
        lat = e.get("lat")
        lon = e.get("lon")
        if not name or lat is None or lon is None:
            continue
        typ = TYPE_CODE.get(t.get("place"), "n")
        st = state_of(states, lon, lat)
        if st:
            matched += 1
        alts = []
        for k in ALT_TAGS:
            v = t.get(k)
            if not v:
                continue
            for part in v.split(";"):
                part = part.strip()
                if part and part != name and part not in alts:
                    alts.append(part)
        row = [name, round(lat, 4), round(lon, 4), typ]
        if st or alts:
            row.append(st)
        if alts:
            row.append(alts[:6])
        rows.append(row)

    order = {"c": 0, "t": 1, "s": 2, "n": 3}
    rows.sort(key=lambda r: (order.get(r[3], 9), r[0]))

    out = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    with open("gazetteer.json", "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Wrote gazetteer.json: {len(rows)} places, "
          f"{100 * matched // max(len(rows), 1)}% with state, {len(out) // 1024} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
