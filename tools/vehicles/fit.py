# python3 fit.py id [reg.png] -> blueprint side outline measured in MODEL metres (z forward, y up), aligned on the wheel centres.
# Prints the top envelope (first ink from above) every 5 cm and the nose/tail profile (furthest ink) every 5 cm of height,
# and writes fit-<id>.png: the blueprint with a 10 cm model grid (labels every 50 cm) and, if given, the model outline in magenta.
import sys, json, re, os, numpy as np
from PIL import Image, ImageDraw
id = sys.argv[1]; reg = sys.argv[2] if len(sys.argv) > 2 else None
S = os.environ.get('S', '.'); R = '/mnt/project-files/cat-3d/refs/cars'
f, fx, fy, rx, ry, face = json.load(open(os.path.join(os.path.dirname(__file__), 'wc.json')))[id]; id0 = id; id = re.sub(r'b$', '', id)
src = open(os.path.join(os.path.dirname(__file__), 'v-%s.js' % (id if id != 'tahomappv04' else 'tahoma04'))).read()
num = lambda k: float(re.search(r'\b%s = (-?[\d.]+)' % k, src).group(1))
r, zf, zr = num('r'), num('zf'), num('zr'); rt = 1 if face == 'R' else -1
s = np.hypot(fx - rx, fy - ry) / (zf - zr); oy = (fy + ry) / 2
Z = lambda px: zr + rt * (px - rx) / s; Y = lambda py: r + (oy - py) / s
PX = lambda z: rx + rt * (z - zr) * s; PY = lambda y: oy - (y - r) * s
im = Image.open(os.path.join(R, id, f)).convert('L'); B = np.asarray(im).astype(int); H, W = B.shape
ink = B < int(os.environ.get('INK', 150))
import cv2
import os as _o, json as _j
_fe = _j.load(open(_o.path.join(_o.path.dirname(_o.path.abspath(__file__)), 'fitenv.json'))).get(sys.argv[1], {})
for _k, _v in _fe.items(): _o.environ.setdefault(_k, _v)
n_, lab, st_, _ = cv2.connectedComponentsWithStats(ink.astype('uint8'), 8)
keep = st_[:, cv2.CC_STAT_AREA] >= int(os.environ.get('MINCC', 0)); keep[0] = False; ink = keep[lab]
# drop long straight rules (ground line, dimension lines) and everything below the ground
for y in range(H):
    if ink[y].mean() > 0.45: ink[max(0, y - 1):y + 2] = False
ink[int(PY(-0.01)):] = False
if os.environ.get('ZCLIP'):
    za_, zb_ = map(float, os.environ['ZCLIP'].split(','))
    for x in range(W):
        if not (za_ <= Z(x) <= zb_): ink[:, x] = False
cols = np.where(ink.any(0))[0]
env = {}
for x in range(W):
    c = np.where(ink[:, x])[0]
    if len(c): env[x] = c[0]
zs = sorted(Z(x) for x in env); zmin, zmax = min(zs), max(zs)
print('%s  px/m %.1f  outline z %.3f .. %.3f (length %.3f m), wheelbase %.3f, top y %.3f' % (id, s, zmin, zmax, zmax - zmin, zf - zr, Y(min(env.values()))))
out = {'s': s, 'top': [], 'nose': [], 'tail': []}
z = np.ceil(zmin * 20) / 20
while z <= zmax:
    x = int(round(PX(z)))
    if x in env: out['top'].append([round(z, 3), round(Y(env[x]), 3)])
    z += 0.05
for y in np.arange(0.1, 2.3, 0.05):
    py = int(round(PY(y)))
    if 0 <= py < H:
        c = np.where(ink[py])[0]
        if len(c):
            a, b = Z(c[0]), Z(c[-1]); out['nose'].append([round(y, 2), round(max(a, b), 3)]); out['tail'].append([round(y, 2), round(min(a, b), 3)])
bot = {}
for x in range(W):
    z = Z(x)
    if min(abs(z - zf), abs(z - zr)) < r * 1.12: continue
    c = np.where(ink[:int(PY(0.06)), x])[0]
    if len(c): bot[x] = c[-1]
out['bot'] = []
z = np.ceil(zmin * 20) / 20
while z <= zmax:
    x = int(round(PX(z)))
    if x in bot: out['bot'].append([round(z, 3), round(Y(bot[x]), 3)])
    z += 0.05
out['zmin'], out['zmax'] = zmin, zmax
print('bot  ' + ' '.join('%.2f:%.3f' % (a, b) for a, b in out['bot']))
print('top  ' + ' '.join('%.2f:%.3f' % (a, b) for a, b in out['top']))
print('nose ' + ' '.join('%.2f:%.3f' % (a, b) for a, b in out['nose']))
print('tail ' + ' '.join('%.2f:%.3f' % (a, b) for a, b in out['tail']))
json.dump(out, open(os.path.join(S, 'fit-%s.json' % id0), 'w'))
# gridded image, 2x up-scaled for reading
k = 2; g = Image.open(os.path.join(R, id, f)).convert('RGB').resize((W * k, H * k), Image.LANCZOS)
if reg:
    A = np.asarray(Image.open(reg).convert('RGBA').resize((W * k, H * k), Image.NEAREST)).astype(int)
    M = A[..., 3] > 60; C = A[..., 0] * 65536 + A[..., 1] * 256 + A[..., 2]; C[~M] = -1
    e = (C != np.roll(C, 1, 0)) | (C != np.roll(C, 1, 1)); a = np.asarray(g).copy(); a[e] = [255, 0, 220]; g = Image.fromarray(a)
d = ImageDraw.Draw(g)
for i in range(int(zmin * 10) - 2, int(zmax * 10) + 3):
    x = PX(i / 10) * k; c = (0, 150, 0) if i % 5 == 0 else (150, 220, 150)
    d.line([(x, 0), (x, H * k)], fill=c, width=1)
    if i % 5 == 0: d.text((x + 2, 2), '%.1f' % (i / 10), fill=(0, 110, 0))
for i in range(0, 23):
    y = PY(i / 10) * k; c = (0, 0, 200) if i % 5 == 0 else (170, 170, 240)
    d.line([(0, y), (W * k, y)], fill=c, width=1)
    if i % 5 == 0: d.text((2, y - 11), '%.1f' % (i / 10), fill=(0, 0, 160))
g.save(os.path.join(S, 'fit-%s.png' % id0))
