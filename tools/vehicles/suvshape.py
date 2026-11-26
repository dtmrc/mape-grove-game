# One-off reshape of the newer SUVs to real side proportions: high hood and belt (tall slab body), short glass, roof carried to the back.
import re, json
H = {'grand16': 1.76, 'crest12': 1.655, 'escalon24': 1.95, 'rambla24': 1.70, 'pathwaypiu23': 1.78, 'blazonppv23': 1.70}
def lerp(a, b, t): return a + (b - a) * max(0, min(1, t))
for f, h in H.items():
    p = f'v-{f}.js'; s = open(p).read()
    m = re.search(r"top: (\[\[.*?\]\]),\n", s); top = json.loads(m.group(1))
    g = re.search(r"st: (\[\[.*?\]\]), roof", s); st = json.loads(g.group(1))
    box = f == 'escalon24'
    my = max(y for z, y in top); z0, z1 = top[0][0], top[-1][0]
    up = [(z, y) for z, y in top if y >= my - 0.2]
    oc = st[0][0]; cow = round(oc - 0.1, 3)                       # cowl moves back: longer hood
    y_rear = max(y for z, y in up if z < -1.0); y_cowl = min(up, key=lambda q: abs(q[0] - oc))[1]; y_nose = up[-1][1]; y_tail = up[0][1]
    Tr, Tc, Tn = (0.70 if box else 0.725) * h, 0.70 * h, (0.66 if box else 0.615) * h
    dr, dc, dn = Tr - y_rear, Tc - y_cowl, Tn - y_nose
    nt = []
    for z, y in top:
        if y >= my - 0.2: y = round(y + (lerp(dr, dc, (z - z0) / (cow - z0)) if z <= cow else lerp(dc, dn, (z - cow) / (up[-1][0] - cow))), 3)
        nt.append([z, y])
    rf = h - 0.06
    st[0][0] = cow; st[1][0] = round(cow - (0.5 if box else 0.6), 3); st[1][1] = round(rf, 3)
    for k in range(2, len(st) - 2): st[k][1] = round(rf + 0.01, 3)
    st[-2][0] = round(z0 + (0.3 if box else 0.5), 3); st[-2][1] = round(rf - (0.01 if box else 0.04), 3)
    s = s.replace(m.group(1), json.dumps(nt)).replace(g.group(1), json.dumps(st))
    # detail warp
    wn = dict(a=round(0.58 * y_nose, 3), b=round(0.82 * y_nose, 3), d=round(dn, 3)); wt = dict(a=round(0.6 * y_tail, 3), b=round(0.85 * y_tail, 3), d=round(dr, 3))
    wy = lambda y, W: round(y + W['d'] * max(0, min(1, (y - W['a']) / (W['b'] - W['a']))), 3)
    s = re.sub(r"(arches: \[\{[^\n]*?inset: [\d.]+,)", lambda mm: mm.group(1) + f" ywarp: {{ nose: {json.dumps(wn)}, tail: {json.dumps(wt)} }},", s, count=1) if 'ywarp' not in s else s
    out = []
    for ln in s.split('\n'):
        mm = re.search(r"const gy = ([\d.]+)", ln)
        if mm: ln = ln.replace(f"gy = {mm.group(1)}", f"gy = {wy(float(mm.group(1)), wn)}"); ln = re.sub(r"faceTilt\(Bd, ([\d.]+), ([\d.]+)\)", lambda q: f"faceTilt(Bd, {wy(float(q.group(1)), wn)}, {wy(float(q.group(2)), wn)})", ln)
        for q in list(re.finditer(r"K\.faceAt\(Bd, ([\d.]+)(, -1)?\)", ln)):
            if re.match(r"\s*K\.(box|sbox|plate)\(", ln):
                y = q.group(1); ny = wy(float(y), wt if q.group(2) else wn); ln = ln.replace(y, str(ny))
        mm = re.match(r"(\s*K\.mirrors\([\d.]+, )([\d.]+)(, )([\d.]+)", ln)
        if mm: ln = ln.replace(mm.group(0), f"{mm.group(1)}{float(mm.group(2)) + dc:.2f}{mm.group(3)}{cow - 0.2:.2f}")
        mm = re.match(r"(\s*K\.handles\(Bd, \[[^\]]*\], )([\d.]+)", ln)
        if mm: ln = ln.replace(mm.group(0), f"{mm.group(1)}{float(mm.group(2)) + dc:.2f}")
        out.append(ln)
    s = '\n'.join(out)
    # pillar overlays + roof furniture follow the new stations
    zf_, yf, zr_, yr = st[1][0], st[1][1], st[-2][0], st[-2][1]
    s = re.sub(r"(K\.ghSide\(gh, '\w+', )[\d.-]+, [\d.-]+(, 0\.8\d, 1\.0\))", lambda q: f"{q.group(1)}{zf_}, {cow}{q.group(2)}", s, count=1)
    s = re.sub(r"(K\.ghTop\(gh, '\w+', )[\d.-]+, [\d.-]+(, 0\.9\d?, 1\.0\))", lambda q: f"{q.group(1)}{zf_}, {cow}{q.group(2)}", s, count=1)
    s = re.sub(r"(K\.rod\('\w+', \[s \* ([\d.]+), )[\d.]+, [\d.-]+\], \[s \* [\d.]+, [\d.]+, [\d.-]+\]", lambda q: f"{q.group(1)}{yf + 0.055:.3f}, {zf_ - 0.15:.2f}], [s * {q.group(2)}, {yr + 0.07:.3f}, {zr_ + 0.2:.2f}]", s, count=1)
    s = re.sub(r"(K\.box\('\w+', 0, )1\.\d+, -[\d.]+, ([\d.]+), 0\.03, 0\.24, \[-0\.12, 0, 0\]\);", lambda q: f"{q.group(1)}{yr + 0.02:.3f}, {zr_ - 0.09:.2f}, {q.group(2)}, 0.03, 0.22, [-0.08, 0, 0]);", s, count=1)
    s = re.sub(r"K\.box\('LightRed', 0, [\d.]+, -[\d.]+,", f"K.box('LightRed', 0, {yr + 0.005:.3f}, {zr_ - 0.205:.3f},", s)
    s = re.sub(r"K\.lightbar\([\d.]+, [\d.-]+,", f"K.lightbar({yf + 0.035:.3f}, {zf_ - 0.55:.2f},", s)
    s = re.sub(r"K\.spotlight\(([\d.-]+), [\d.]+, [\d.]+\)", lambda q: f"K.spotlight({q.group(1)}, {Tc + 0.12:.2f}, {cow - 0.08:.2f})", s)
    open(p, 'w').write(s); print(f, 'dn', round(dn, 3), 'dc', round(dc, 3), 'dr', round(dr, 3), st)
