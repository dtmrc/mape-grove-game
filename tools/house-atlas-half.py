#!/usr/bin/env python3
"""Half-size copies of the Estates house atlases (src/models/houses/<id>.webp -> <id>.half.webp).
The game keeps the half-size atlas in memory for every house model and swaps the full one in only for the
models near the player (src/js/houses.js updateHouseTex). A 2x2 box average is what the GPU's own mip chain
does, so a house seen from a distance looks the same with either. Re-run after gamepack.cjs writes new atlases.
Usage: python3 tools/house-atlas-half.py"""
import glob, os
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'models', 'houses')
for f in sorted(glob.glob(os.path.join(root, '*.webp'))):
    if f.endswith('.half.webp'): continue
    im = Image.open(f)
    if im.mode == 'RGBA' and im.getextrema()[3][0] == 255: im = im.convert('RGB')
    half = im.reduce(2)
    out = f[:-5] + '.half.webp'
    half.save(out, 'WEBP', quality=92, method=6)
    print(os.path.basename(out), half.size, os.path.getsize(out) // 1024, 'KB')
