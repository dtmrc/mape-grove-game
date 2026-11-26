# python3 score.py out.png blueprint reg.png px_per_m [label]
# Measures the built model's side silhouette against the blueprint's line work (both already aligned on the wheel centres by overlay.cjs):
# top envelope gap at stations along the body, nose and tail gap at several heights, all in cm (+ = model sticks out / sits higher).
# Writes a difference map: red = model outside the blueprint, blue = model short of it. Prints one summary line + the table.
import sys, numpy as np
from PIL import Image
out, bp, reg, s = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]); label = sys.argv[5] if len(sys.argv) > 5 else ''
B = np.asarray(Image.open(bp).convert('L')).astype(int); R = np.asarray(Image.open(reg).convert('RGBA').resize((B.shape[1], B.shape[0])))
import os, cv2
import os as _o, json as _j
_fe = _j.load(open(_o.path.join(_o.path.dirname(_o.path.abspath(__file__)), 'fitenv.json'))).get((sys.argv[5] if len(sys.argv) > 5 else ''), {})
for _k, _v in _fe.items(): _o.environ.setdefault(_k, _v)
M = R[..., 3] > 60; ink = B < int(os.environ.get('INK', 150)); H, W = B.shape
n_, lab, st_, _ = cv2.connectedComponentsWithStats(ink.astype('uint8'), 8); keep = st_[:, cv2.CC_STAT_AREA] >= int(os.environ.get('MINCC', 0)); keep[0] = False; ink = keep[lab]
cols = np.where(M.any(0))[0]; rows = np.where(M.any(1))[0]; x0, x1, y0, y1 = cols[0], cols[-1], rows[0], rows[-1]
pad = int(0.25 * s)
# ignore ink far from the car (dimension lines, captions): keep a window round the model's box
win = np.zeros_like(ink); win[max(0, y0 - pad):min(H, y1 + 2), max(0, x0 - pad):min(W, x1 + pad)] = True; ink &= win
def top(a, x): c = np.where(a[:, x])[0]; return c[0] if len(c) else None
def ext(a, y, right): c = np.where(a[y])[0]; return (c[-1] if right else c[0]) if len(c) else None
res = []; L = x1 - x0
for k in range(1, 20):
    x = int(x0 + L * k / 20); tm, tb = top(M, x), top(ink, x)
    if tm is not None and tb is not None: res.append(('top %2d%%' % (k * 5), (tb - tm) / s * 100))
hgt = y1 - y0
for f in (0.25, 0.4, 0.55):
    y = int(y1 - hgt * f)
    for right, nm in ((False, 'left'), (True, 'right')):
        em, eb = ext(M, y, right), ext(ink, y, right)
        if em is not None and eb is not None: res.append(('%s @%2d%%h' % (nm, f * 100), ((em - eb) if right else (eb - em)) / s * 100))
v = np.array([r[1] for r in res]); tops = np.array([r[1] for r in res if r[0].startswith('top')])
print('%s  top: mean|gap| %.1f cm, max %.1f cm   ends: max %.1f cm   (px/m %.0f)' % (label, np.abs(tops).mean(), np.abs(tops).max(), np.abs(v[len(tops):]).max() if len(v) > len(tops) else 0, s))
print('  ' + '  '.join('%s %+.0f' % (n.replace('top ', ''), g) for n, g in res))
# difference map
img = np.stack([B, B, B], -1).astype(float)
# blueprint filled silhouette = between top envelope and model bottom, per column, within the ink's horizontal extent
F = np.zeros_like(M)
for x in range(max(0, x0 - pad), min(W, x1 + pad)):
    t = top(ink, x)
    if t is not None: F[t:y1, x] = True
over = M & ~F; under = F & ~M; under[int(y1 - hgt * 0.18):] = False; over[int(y1 - hgt * 0.18):] = False
img[over] = img[over] * 0.35 + np.array([255, 40, 40]) * 0.65; img[under] = img[under] * 0.35 + np.array([40, 90, 255]) * 0.65
e = M ^ np.roll(M, 1, 0) | M ^ np.roll(M, 1, 1); img[e] = [255, 0, 220]
Image.fromarray(img.clip(0, 255).astype('uint8')).save(out)
