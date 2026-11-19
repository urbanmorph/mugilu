"""Limit the self-hosted Anek faces to the axis ranges the site uses, so they download less.

The pages use weight 400-800 everywhere, and width 75-100% for Latin only (non-Latin text is
never condensed: tokens). Google's subsets carry weight 100-800 and width 75-125%.
Glyph coverage is unchanged. Idempotent: a face whose output exists is skipped.

Usage: python3 scripts/limit_font_axes.py   (reads public/fonts/*-1.woff2, writes *-2.woff2)
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

DIR = os.path.join(os.path.dirname(__file__), "..", "public", "fonts")
for name in ["latin", "latin-ext", "devanagari", "kannada", "telugu", "bangla"]:
    src = os.path.join(DIR, f"anek-{name}-1.woff2")
    out = os.path.join(DIR, f"anek-{name}-2.woff2")
    if os.path.exists(out):
        print(f"{name}: exists, skipped", flush=True)
        continue
    font = TTFont(src)
    axes = {a.axisTag for a in font["fvar"].axes}
    limits = {"wght": (400, 800)}
    if "wdth" in axes:
        limits["wdth"] = (75, 100) if name.startswith("latin") else 100
    limited = instancer.instantiateVariableFont(font, limits)
    limited.flavor = "woff2"
    limited.save(out)
    print(f"{name}: {os.path.getsize(src)} -> {os.path.getsize(out)} bytes", flush=True)
