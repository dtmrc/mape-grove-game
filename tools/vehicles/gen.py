# python3 gen.py id  -> rewrites top / bottom / greenhouse st / roof of v-<id>.js from the measured blueprint outline (fit-<bp>.json)
# spec (specs.json[id]): bp (fit key), zws (windshield base), zrf (roof front corner), zrr (roof rear corner), zrg (greenhouse end at
# the tail), belt [[z,y]] (bottom edge of the side glass), ytip / ytail (lowest point of the vertical nose / tail face),
# crown/ghcr (must match the file), w [[z,half]] roof half width (taken from the old st on first run), dz station spacing.
import sys, json, re, os, numpy as np
id = sys.argv[1]; D = os.path.dirname(os.path.abspath(__file__)); S = os.environ['S']
SP = json.load(open(os.path.join(D, 'specs.json'))); sp = SP[id]
_fp = os.path.join(D, 'fits', 'fit-%s.json' % sp['bp']); F = json.load(open(_fp if os.path.exists(_fp) else os.path.join(S, 'fit-%s.json' % sp['bp'])))   # measured outlines are kept in fits/
fn = os.path.join(D, 'v-%s.js' % id); js = open(fn).read()
def tab(t):
    t = sorted(t); a = np.array(t)
    return lambda z: float(np.interp(z, a[:, 0], a[:, 1]))
T = F['top']
for a, b in sp.get('mask', []): T = [p for p in T if not (a <= p[0] <= b)]
for p in sp.get('override', []): pass
if sp.get('override'):
    o = sp['override']; lo, hi = min(p[0] for p in o), max(p[0] for p in o)
    T = [p for p in T if not (lo <= p[0] <= hi)] + o
for o in sp.get('overrides', []):
    lo, hi = min(p[0] for p in o), max(p[0] for p in o); T = [p for p in T if not (lo <= p[0] <= hi)] + o
env = tab(T); bot = tab(F['bot']) if F['bot'] else None
zmin, zmax = F['zmin'], F['zmax']
cr = float(re.search(r'crown: ([\d.]+), shoulder', js).group(1)) if 'crown' not in sp else sp['crown']
ghcr = float(re.search(r'greenhouse\(Bd, \{.*crown: ([\d.]+)', js).group(1)) if 'ghcr' not in sp else sp['ghcr']
if 'w' not in sp:
    st = json.loads(re.search(r'st: (\[\[.*?\]\]), roof', js).group(1).replace('null', 'null'))
    sp['w'] = [[s[0], s[2]] for s in st]; json.dump(SP, open(os.path.join(D, 'specs.json'), 'w'), indent=1)
wt = tab(sp['w']); belt = tab(sp['belt'])
zws, zrf, zrr, zrg = sp['zws'], sp['zrf'], sp['zrr'], sp['zrg']
R = lambda v: round(v, 3)
# body top: tail face, tail deck, belt, hood, nose face
top = []
ztl = zmin; top.append([R(ztl), R(sp['ytail'])])
zs = [zmin + 0.004] + list(np.arange(np.ceil((zmin + 0.02) * 20) / 20, zrg - 0.01, 0.05))
for z in zs: top.append([R(z), R(env(z) - cr)])
for z in np.arange(zrg, zws + 1e-6, 0.25): top.append([R(z), R(belt(z))])
top.append([R(zws), R(belt(zws))])
for z in np.arange(np.ceil((zws + 0.02) * 20) / 20, zmax - 0.01, 0.05): top.append([R(z), R(env(z) - cr)])
top.append([R(zmax - 0.004), R(env(zmax - 0.004) - cr)]); top.append([R(zmax), R(sp['ytip'])])
# thin the long smooth runs to 0.1 m where the curve is straight
def thin(t):
    out = [t[0]]
    for i in range(1, len(t) - 1):
        a, b, c = out[-1], t[i], t[i + 1]
        if c[0] - a[0] < 0.21 and abs(b[1] - (a[1] + (c[1] - a[1]) * (b[0] - a[0]) / (c[0] - a[0] or 1))) < 0.004: continue
        out.append(b)
    out.append(t[-1]); return out
top = thin(sorted(top))
# bottom: measured lower edge at the ends, sill between
bt = sp.get('bottom')
if not bt and bot:
    bt = [[R(zmin), R(max(bot(zmin + 0.01), sp.get('sill', 0.3)))]]
    for z in np.arange(np.ceil(zmin * 10) / 10 + 0.1, zmax - 0.05, 0.1):
        y = bot(z); bt.append([R(z), R(y)])
    bt.append([R(zmax), R(bot(zmax - 0.01))])
# greenhouse stations
st = [[R(zws), None, R(wt(zws))]]
zz = sorted(set([R(z) for z in np.arange(zws - sp.get('dz', 0.1), zrg + 0.02, -sp.get('dz', 0.1))] + [zrf, zrr]), reverse=True)
for z in zz:
    if z >= zws - 0.02 or z <= zrg + 0.02: continue
    st.append([R(z), R(env(z) - ghcr), R(wt(z))])
st.append([R(zrg), None, R(wt(zrg))])
zst = sorted([s[0] for s in st]); n = len(zst)
# roof painted segments, counted from the front: fidx = n-2-seg(z)
seg = lambda z: next(i for i in range(n - 1) if z < zst[i + 1] - 1e-6) if z < zst[-1] else n - 2
f0 = n - 2 - seg(zrf - 0.001); f1 = n - 2 - seg(zrr + 0.001) + 1
J = lambda a: json.dumps(a).replace(' ', '').replace(',', ', ').replace('], [', '], [').replace('null', 'null')
js = re.sub(r'top: \[\[.*?\]\],', 'top: ' + J(top) + ',', js, 1)
if bt: js = re.sub(r'bottom: \[\[.*?\]\],', 'bottom: ' + J(bt) + ',', js, 1)
js = re.sub(r'st: \[\[.*?\]\], roof: \[\d+, \d+\]', 'st: ' + J(st) + ', roof: [%d, %d]' % (f0, f1), js, 1)
open(fn, 'w').write(js)
print(id, 'top', len(top), 'st', len(st), 'roof', f0, f1, 'len %.3f' % (zmax - zmin))
