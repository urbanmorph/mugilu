"""Build apps/worker/data/state-lines.json: the borders between India's states and
Union Territories, for the home page map (indiamap.ts).

Source: LGD state boundaries via bharatlas (CC0-1.0 / CC-BY-4.0), the same source as
data/india.json. Only the borders SHARED by two states are kept: the coast and the
national border are already drawn by the India outline. Lines are simplified for a
map about 440 px wide and written as [lon, lat] lists to 2 decimals.

Run from the repo root:  python3 scripts/build_state_lines.py
The download is cached in ~/.cache/mugilu/ (checked by size), so a rerun does no
network work, and the output is rewritten only when it changes.
"""

import hashlib
import json
import os
import sys
import urllib.request

from shapely.geometry import LineString, MultiLineString, shape
from shapely.ops import linemerge, unary_union

URL = "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/states/LGD_States.geojson"
SIZE = 27090105  # bytes, as bharatlas lists it
CACHE = os.path.expanduser("~/.cache/mugilu/LGD_States.geojson")
OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "worker", "data", "state-lines.json")
TOLERANCE = 0.04  # degrees, about 1/3 px on the map
MIN_LENGTH = 0.15  # degrees; shorter fragments are slivers between rings


def fetch() -> str:
    if os.path.exists(CACHE) and os.path.getsize(CACHE) == SIZE:
        print(f"cached {CACHE}", flush=True)
        return CACHE
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    print(f"downloading {URL}", flush=True)
    tmp = CACHE + ".part"
    req = urllib.request.Request(URL, headers={"User-Agent": "mugilu build (+https://mugilu.live)"})
    with urllib.request.urlopen(req, timeout=300) as res, open(tmp, "wb") as f:
        while chunk := res.read(1 << 20):
            f.write(chunk)
    os.replace(tmp, CACHE)
    return CACHE


def main() -> None:
    with open(fetch()) as f:
        states = [shape(ft["geometry"]).buffer(0) for ft in json.load(f)["features"]]
    print(f"{len(states)} states and UTs", flush=True)
    every = unary_union([s.boundary for s in states])
    coast = unary_union(states).boundary.buffer(0.02)
    shared = linemerge(every.difference(coast))
    lines = shared.geoms if isinstance(shared, MultiLineString) else [shared]
    out = []
    for line in lines:
        if not isinstance(line, LineString) or line.length < MIN_LENGTH:
            continue
        pts = [[round(x, 2), round(y, 2)] for x, y in line.simplify(TOLERANCE).coords]
        dedup = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
        if len(dedup) > 1:
            out.append(dedup)
    body = json.dumps(
        {
            "source": "LGD states via bharatlas (CC0/CC-BY-4.0): borders shared by two states, simplified",
            "lines": out,
        },
        separators=(",", ":"),
    )
    old = open(OUT).read() if os.path.exists(OUT) else ""
    if hashlib.sha256(old.encode()).digest() == hashlib.sha256(body.encode()).digest():
        print("unchanged", flush=True)
        return
    with open(OUT, "w") as f:
        f.write(body)
    print(f"wrote {OUT}: {len(out)} lines, {sum(len(l) for l in out)} points, {len(body)} bytes", flush=True)


if __name__ == "__main__":
    sys.exit(main())
