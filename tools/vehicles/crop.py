# python3 crop.py key z0 z1 y0 y1 [reg.png] [out] -> zoomed blueprint crop in model metres with a 5 cm grid (labels every 10 cm)
import sys, json, re, os, numpy as np
from PIL import Image, ImageDraw
k0, z0, z1, y0, y1 = sys.argv[1], *map(float, sys.argv[2:6]); reg = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] != '-' else None
S = os.environ.get('S', '.'); D = os.path.dirname(os.path.abspath(__file__)); R = '/mnt/project-files/cat-3d/refs/cars'
f, fx, fy, rx, ry, face = json.load(open(os.path.join(D, 'wc.json')))[k0]; id = re.sub(r'b$', '', k0)
src = open(os.path.join(D, 'v-%s.js' % (id if id != 'tahomappv04' else 'tahoma04'))).read()
num = lambda k: float(re.search(r'\b%s = (-?[\d.]+)' % k, src).group(1)); r, zf, zr = num('r'), num('zf'), num('zr'); rt = 1 if face == 'R' else -1
s = np.hypot(fx - rx, fy - ry) / (zf - zr); oy = (fy + ry) / 2
PX = lambda z: rx + rt * (z - zr) * s; PY = lambda y: oy - (y - r) * s
im = Image.open(os.path.join(R, id, f)).convert('RGB')
if reg:
    A = np.asarray(Image.open(reg).convert('RGBA').resize(im.size, Image.NEAREST)).astype(int); M = A[..., 3] > 60
    C = A[..., 0] * 65536 + A[..., 1] * 256 + A[..., 2]; C[~M] = -1
    e = (C != np.roll(C, 1, 0)) | (C != np.roll(C, 1, 1)); a = np.asarray(im).copy(); a[e] = [255, 0, 220]; im = Image.fromarray(a)
xa, xb = sorted([PX(z0), PX(z1)]); ya, yb = PY(y1), PY(y0)
k = min(8.0, 1600 / max(1, xb - xa))
c = im.crop((int(xa), int(ya), int(xb) + 1, int(yb) + 1)).resize((int((int(xb) - int(xa) + 1) * k), int((int(yb) - int(ya) + 1) * k)), Image.LANCZOS)
d = ImageDraw.Draw(c); ox, oy2 = int(xa), int(ya)
for i in range(int(np.floor(min(z0, z1) * 20)), int(np.ceil(max(z0, z1) * 20)) + 1):
    x = (PX(i / 20) - ox) * k; d.line([(x, 0), (x, c.size[1])], fill=(0, 160, 0) if i % 2 == 0 else (170, 230, 170))
    if i % 2 == 0: d.text((x + 2, 2), '%.2f' % (i / 20), fill=(0, 110, 0))
for i in range(int(np.floor(y0 * 20)), int(np.ceil(y1 * 20)) + 1):
    y = (PY(i / 20) - oy2) * k; d.line([(0, y), (c.size[0], y)], fill=(60, 60, 220) if i % 2 == 0 else (180, 180, 240))
    if i % 2 == 0: d.text((2, y - 11), '%.2f' % (i / 20), fill=(0, 0, 160))
c.save(sys.argv[7] if len(sys.argv) > 7 else os.path.join(S, 'crop.png')); print(c.size, 'x%.1f' % k)
