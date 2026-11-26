// Vehicle kit for Tracebench scripted builds (Maple Grove Off Leash).
// A car = a lofted lower body (with real wheel-arch cut-outs) + a lofted greenhouse (glass and roof) + overlays
// (pillars, trim, lights, grille, bumpers, mirrors) + lathed tyres with spoked rims. Parts are bucketed by material key.
// Units: metres, Y up, ground at y = 0, the car's nose faces +Z, centred on the origin.
// eslint-disable-next-line no-unused-vars
function makeVKit(T) {
  const parts = {};
  let lastBody = null;
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3();
  let XF = new T.Matrix4(); const stack = [];
  function push(x = 0, y = 0, z = 0, ry = 0, rx = 0) { stack.push(XF.clone()); XF = XF.clone().multiply(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, 0)), new T.Vector3(1, 1, 1))); }
  function pop() { XF = stack.pop(); }
  function put(key, g, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    g = g.index ? g.toNonIndexed() : g;
    g.applyMatrix4(_m.compose(_v.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl)));
    g.applyMatrix4(XF);
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    (parts[key] ||= []).push(g);
    return g;
  }
  const box = (key, cx, cy, cz, w, h, d, rot) => put(key, new T.BoxGeometry(w, h, d), [cx, cy, cz], rot || [0, 0, 0]);
  const bx = (key, x0, y0, z0, x1, y1, z1) => box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  /** the same box on both sides (x and -x) */
  const sbox = (key, x, y, z, w, h, d, rot) => { box(key, x, y, z, w, h, d, rot); box(key, -x, y, z, w, h, d, rot && [rot[0], -rot[1], -rot[2]]); };
  function rod(key, a, b, r, seg = 6, r2) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), L = A.distanceTo(B);
    const g = new T.CylinderGeometry(r2 ?? r, r, L, seg, 1);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    return put(key, g);
  }
  const srod = (key, a, b, r, seg, r2) => { rod(key, a, b, r, seg, r2); rod(key, [-a[0], a[1], a[2]], [-b[0], b[1], b[2]], r, seg, r2); };
  /** polygon in the (z, y) side plane extruded across x from x0 to x1 */
  function sideExtrude(key, pts, x0, x1, bev = 0.035) {
    const s = new T.Shape(pts.map(([z, y]) => new T.Vector2(z, y)));
    const b = Math.min(bev, Math.abs(x1 - x0) / 3);
    const g = new T.ExtrudeGeometry(s, { depth: Math.abs(x1 - x0) - 2 * b, bevelEnabled: b > 0.002, bevelThickness: b, bevelSize: b * 0.8, bevelOffset: -b * 0.8, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, b);
    g.rotateY(-Math.PI / 2); g.translate(Math.max(x0, x1), 0, 0);   // shape x -> world z, depth -> world -x
    return put(key, g);
  }
  /** polygon in the (x, y) front plane extruded along z from z0 to z1 */
  function frontExtrude(key, pts, z0, z1) {
    const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
    const g = new T.ExtrudeGeometry(s, { depth: Math.abs(z1 - z0), bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, Math.min(z0, z1));
    return put(key, g);
  }

  /** Chaikin corner cutting on a [[z, v...]] polyline (endpoints kept): rounds every crease in a profile */
  function chaikin(pts, it = 2, k = 0.25) {
    let P = pts.map((p) => p.slice());
    for (let n = 0; n < it; n++) {
      const Q = [P[0]];
      for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push(a.map((v, j) => v + (b[j] - v) * k), a.map((v, j) => v + (b[j] - v) * (1 - k))); }
      Q.push(P[P.length - 1]); P = Q;
    }
    return P;
  }
  /** rounded box from corner to corner (edges rounded by r): cabs, bodies, bumpers */
  function rbx(key, x0, y0, z0, x1, y1, z1, r = 0.06) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0), rr = Math.min(r, w / 3, h / 3, d / 3);
    const sh = new T.Shape(), hw = d / 2 - rr, hh = h / 2 - rr;   // profile in (z, y), extruded across x
    sh.moveTo(-hw, -h / 2); sh.lineTo(hw, -h / 2); sh.quadraticCurveTo(d / 2, -h / 2, d / 2, -hh); sh.lineTo(d / 2, hh); sh.quadraticCurveTo(d / 2, h / 2, hw, h / 2);
    sh.lineTo(-hw, h / 2); sh.quadraticCurveTo(-d / 2, h / 2, -d / 2, hh); sh.lineTo(-d / 2, -hh); sh.quadraticCurveTo(-d / 2, -h / 2, -hw, -h / 2);
    const g = new T.ExtrudeGeometry(sh, { depth: w - 2 * rr, bevelEnabled: true, bevelThickness: rr, bevelSize: rr * 0.9, bevelOffset: -rr * 0.9, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(w - 2 * rr) / 2); g.rotateY(-Math.PI / 2);
    return put(key, g, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
  }
  // ---------- tables ----------
  const tab = (t) => (z) => {
    if (z <= t[0][0]) return t[0][1];
    for (let i = 1; i < t.length; i++) if (z <= t[i][0]) { const [z0, a] = t[i - 1], [z1, b] = t[i], k = (z - z0) / (z1 - z0 || 1); return a + (b - a) * k; }
    return t[t.length - 1][1];
  };

  // ---------- generic loft: rings of [x,y,z] points, quads between neighbours, keyed per quad ----------
  const tri = (out, a, b, c, ctr) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-12) return;
    if (ctr) {
      const fx = (a[0] + b[0] + c[0]) / 3 - ctr[0], fy = (a[1] + b[1] + c[1]) / 3 - ctr[1], fz = (a[2] + b[2] + c[2]) / 3 - ctr[2];
      if (nx * fx + ny * fy + nz * fz < 0) { out.push(...a, ...c, ...b); return; }
    }
    out.push(...a, ...b, ...c);
  };
  function emit(byKey) {
    for (const [k, arr] of Object.entries(byKey)) if (arr.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); put(k, g); }
  }
  /** rings: [{z, pts:[[x,y]...], c:[cx,cy]}] ; keyOf(i, j) -> material key for the quad between ring i/i+1 and point j/j+1 */
  function loft(rings, keyOf, closed = true, caps = null) {
    const by = {};
    const n = rings[0].pts.length;
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1];
      for (let j = 0; j < (closed ? n : n - 1); j++) {
        const j2 = (j + 1) % n, k = keyOf(i, j); if (!k) continue;
        const a = [A.pts[j][0], A.pts[j][1], A.z], b = [A.pts[j2][0], A.pts[j2][1], A.z], c = [B.pts[j2][0], B.pts[j2][1], B.z], d = [B.pts[j][0], B.pts[j][1], B.z];
        const ctr = [0, (A.c[1] + B.c[1]) / 2, (A.z + B.z) / 2];
        tri(by[k] ||= [], a, b, c, ctr); tri(by[k], a, c, d, ctr);
      }
    }
    if (caps) for (const [ri, key, dir] of caps) {   // fan caps, dir = -1 rear / +1 front
      const R = rings[ri], cx = R.c[0], cy = R.c[1];
      for (let j = 0; j < n; j++) { const j2 = (j + 1) % n; tri(by[key] ||= [], [cx, cy, R.z], [R.pts[j][0], R.pts[j][1], R.z], [R.pts[j2][0], R.pts[j2][1], R.z], [cx, cy, R.z - dir]); }
    }
    emit(by);
  }

  /**
   * Lower body. B = {
   *   top: [[z,y]] top of the body (bumper, hood, beltline, trunk), half: [[z,w]] half width at the shoulder,
   *   sill: rocker bottom y, floor: underbody y, tumble: how far the top edge pulls in, crown: hood/trunk crown,
   *   tuck: how far the rocker tucks under, shoulder: 0..1 height of the widest line between sill and top,
   *   arches: [{z, r, cy}] wheel cut-outs (cy = axle height), inset: wheel-well depth,
   *   bottom: [[z,y]] optional per-z sill height (bumper lips), key: paint key, under: underbody key }
   * Returns samplers so details can sit on the surface.
   */
  function body(B) {
    if (B.smooth !== false) { B = { ...B, top: chaikin(B.top, 2, 0.2), half: chaikin(B.half, 2, 0.25) }; }
    const top = tab(B.top), half = tab(B.half), sillT = B.bottom ? tab(B.bottom) : () => B.sill;
    const z0 = B.top[0][0], z1 = B.top[B.top.length - 1][0];
    const zs = new Set();
    for (let z = z0; z <= z1 + 1e-6; z += B.step ?? 0.1) zs.add(+z.toFixed(4));
    for (const [z] of B.top) zs.add(+z.toFixed(4)); for (const [z] of B.half) if (z > z0 && z < z1) zs.add(z);
    if (B.bottom) for (const [z] of B.bottom) if (z > z0 && z < z1) zs.add(z);
    for (const a of B.arches) { for (let k = 0; k <= 12; k++) zs.add(+(a.z - a.r + (2 * a.r * k) / 12).toFixed(4)); zs.add(+(a.z - a.r - 0.004).toFixed(4)); zs.add(+(a.z + a.r + 0.004).toFixed(4)); }
    const Z = [...zs].filter((z) => z >= z0 && z <= z1).sort((a, b) => a - b);
    const archY = (z) => { let y = sillT(z), inset = B.tuck ?? 0.05; for (const a of B.arches) { const d = Math.abs(z - a.z); if (d <= a.r) { y = Math.max(y, a.cy + Math.sqrt(a.r * a.r - d * d) * (a.sq ?? 1)); inset = B.inset ?? 0.3; } } return [y, inset]; };
    const tm = B.tumble ?? 0.08, cr = B.crown ?? 0.03, sh = B.shoulder ?? 0.55, fl = B.floor ?? 0.2;
    const rings = Z.map((z) => {
      const w = half(z), yt = top(z), [ys, ins] = archY(z);
      const ysh = Math.min(yt - 0.04, ys + (yt - ys) * sh), y4 = yt - Math.min(0.06, (yt - ysh) * 0.5);
      const e = Math.min(z - z0, z1 - z), ft = Math.min(1, e / (B.floorRamp ?? 0.7)), fy = Math.min(fl + (ys - 0.01 - fl) * (1 - ft) * (1 - ft), ys - 0.01);
      const R = [[w - ins, fy], [w - ins, ys], [w - (B.tuck ?? 0.05) * 0.4, ys], [w, ysh], [w - tm * 0.35, y4], [w - tm, yt], [(w - tm) * 0.5, yt + cr * 0.75], [0, yt + cr]];
      const L = R.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
      return { z, pts: [...R, ...L], c: [0, (fl + yt) / 2] };
    });
    const n = rings[0].pts.length;
    loft(rings, (i, j) => (j === n - 1 ? B.under ?? 'Under' : B.key ?? 'Paint'), true, [[0, B.key ?? 'Paint', -1], [rings.length - 1, B.key ?? 'Paint', 1]]);
    // dark wheel-well liners
    for (const a of B.arches) {
      const g = new T.CylinderGeometry(a.r - 0.01, a.r - 0.01, 1, 14, 1, true, 0, Math.PI);   // half tube, open at the bottom
      g.rotateZ(Math.PI / 2);
      for (const s of [-1, 1]) { const w = half(a.z), ins = B.inset ?? 0.3; const c = g.clone(); c.scale(ins, 1, 1); c.translate(s * (w - ins / 2 - 0.005), a.cy, a.z); put(B.wellKey ?? 'Well', c); }
    }
    // half width of the body surface at height y (same cross-section as the rings), for skins that follow the tumblehome
    const wAt = (z, y) => {
      const w = half(z), yt = top(z), [ys] = archY(z), ysh = Math.min(yt - 0.04, ys + (yt - ys) * sh), y4 = yt - Math.min(0.06, (yt - ysh) * 0.5), tu = (B.tuck ?? 0.05) * 0.4;
      if (y <= ys) return w - tu; if (y <= ysh) return w - tu * (1 - (y - ys) / Math.max(1e-4, ysh - ys));
      if (y <= y4) return w - tm * 0.35 * (y - ysh) / Math.max(1e-4, y4 - ysh); return w - tm * (0.35 + 0.65 * Math.min(1, (y - y4) / Math.max(1e-4, yt - y4)));
    };
    return (lastBody = { top, half, z0, z1, sill: sillT, tm, cr, w: (z) => half(z), yt: top, wAt, arches: B.arches, ywarp: B.ywarp });
  }

  /**
   * Greenhouse. G = { st: [[z, yRoof|null, halfRoof]] from front (windshield base) to rear; null = sits on the belt,
   *   inset: base pulled in from the body shoulder, crown, roof: [i0, i1] segments painted (others glass), key / glass keys }
   * Returns a sampler gh(z) -> {yb, yr, wb, wr} for pillars and trims.
   */
  function greenhouse(Bd, G) {
    const st = G.st.slice().sort((a, b) => a[0] - b[0]), ins = G.inset ?? 0.04, cr = G.crown ?? 0.04;
    const base = (z) => [Bd.top(z) + (G.lift ?? 0), Bd.half(z) - Bd.tm - ins];
    // resolve belt stations, then round the header / rear-glass creases in side and plan view
    const prof = st.map(([z, y, w]) => [z, y ?? base(z)[0], w]);
    const sm = G.smooth === false ? prof : chaikin(prof, 3, 0.18);
    const yr = tab(sm.map(([z, y]) => [z, y])), wr = tab(sm.map(([z, , w]) => [z, w]));
    const zs = new Set(sm.map((s) => +s[0].toFixed(4)));
    for (let z = st[0][0]; z < st[st.length - 1][0]; z += 0.1) zs.add(+z.toFixed(4));
    const Z = [...zs].sort((a, b) => a - b);
    const gh = (z) => { const [yb, wb] = base(z); const yy = Math.max(yb, yr(z)); return { yb, yr: yy, wb, wr: Math.min(wb, wr(z)) }; };
    const seg = (z) => { for (let i = 0; i < st.length - 1; i++) if (z < st[i + 1][0] - 1e-6) return i; return st.length - 2; };
    const fidx = (z) => st.length - 2 - seg(z);
    // roof cross-section: a rounded crown instead of a peak; f = lateral fraction (0 centre .. 1 edge)
    const RF = [[1, 0.12], [0.86, 0.45], [0.6, 0.78], [0.3, 0.95], [0, 1]];
    const roofAt = (g, f) => { const h = g.yr > g.yb + 0.05 ? cr : 0; for (let i = 0; i < RF.length - 1; i++) { const [f0, a] = RF[i], [f1, b] = RF[i + 1]; if (f <= f0 && f >= f1) return g.yr + h * (a + (b - a) * (f0 - f) / (f0 - f1)); } return g.yr + h; };
    gh.roofAt = roofAt;
    const ring = (g) => {
      const dx = g.wr - g.wb, dy = g.yr - g.yb, L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L, bow = Math.min(0.012, L * 0.03);
      const sp = (f, b = 0) => [g.wb + dx * f + nx * b, g.yb + dy * f + ny * b];
      const R = [sp(0), sp(0.45, bow), sp(0.84, bow * 0.6), [g.wr * 0.985, roofAt(g, 1) - (g.yr > g.yb + 0.05 ? 0.012 : 0)], ...RF.slice(1).map(([f]) => [g.wr * f, roofAt(g, f)])];
      return [...R, ...R.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
    };
    const rings = Z.map((z) => ({ z, pts: ring(gh(z)), c: [0, gh(z).yb] }));
    const n = rings[0].pts.length, half = (n - 1) / 2;   // quads 0..half-1 right, half..n-2 left
    const [r0, r1] = G.roof;
    loft(rings, (i, j) => {
      const side = j < 3 || j >= n - 4;
      if (side) return G.sideKey ?? 'Glass';
      const zm = (Z[i] + Z[i + 1]) / 2, f = fidx(zm);
      return f >= r0 && f < r1 ? G.key ?? 'Paint' : G.glass ?? 'Glass';
    }, false);
    gh.z0 = Z[0]; gh.z1 = Z[Z.length - 1]; gh.cr = cr;
    return gh;
  }
  /** roof spoiler lip: the roof carries on past the top of the rear glass, with drooped ends. o = {z (roof end), len, half, key, light} */
  function roofLip(gh, o = {}) {
    const z = o.z, n = o.len ?? 0.28, yR = gh(z + 0.06).yr + gh.cr, hw = o.half ?? gh(z + 0.06).wr, k = o.key ?? 'Paint';
    const lip = [[z + 0.1, yR - 0.004], [z - n + 0.02, yR - 0.03], [z - n, yR - 0.075], [z - n + 0.12, yR - 0.095], [z + 0.1, yR - 0.06]];
    sideExtrude(k, lip, hw * 0.72, -hw * 0.72, 0.02);
    for (const sd of [-1, 1]) sideExtrude(k, lip.map(([a, b]) => [a + 0.02, b - 0.028]), sd * hw, sd * hw * 0.68, 0.035);
    if (o.light !== false) box('LightRed', 0, yR - 0.052, z - n - 0.002, hw * 0.8, 0.02, 0.012);
  }
  /** overlay strip on the greenhouse side between z0..z1, f0..f1 = fraction from the belt (0) to the roof edge (1) */
  function ghSide(gh, key, z0, z1, f0 = 0, f1 = 1, off = 0.016, n = 8) {
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const z = z0 + ((z1 - z0) * k) / n, g = gh(z), dx = g.wb - g.wr, dy = g.yr - g.yb, L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = dx / L;
      const p = (f) => [g.wb + (g.wr - g.wb) * f + nx * off, g.yb + dy * f + ny * off];
      const a = p(f0), b = p(f1);
      rings.push({ z, pts: [a, b, [-b[0], b[1]], [-a[0], a[1]]], c: [0, g.yb - 0.5] });
    }
    loft(rings, (i, j) => (j === 1 ? null : key), true);
  }
  /**
   * ghPoly: overlay panel on the greenhouse sides shaped by a convex polygon in (z, f) space (f = 0 belt, 1 roof edge). Lets the
   * side glass take its real outline (upswept quarter windows, thick raked pillars) instead of full-height rectangles.
   */
  function ghPoly(gh, key, pts, off = 0.016, n = 12) {
    const zs = pts.map((q) => q[0]), za = Math.min(...zs), zb = Math.max(...zs), rings = [];
    for (let k = 0; k <= n; k++) {
      const z = za + (zb - za) * Math.min(0.999, Math.max(0.001, k / n)); let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) { const [z0, f0] = pts[i], [z1, f1] = pts[(i + 1) % pts.length]; if ((z0 - z) * (z1 - z) <= 0 && z0 !== z1) { const f = f0 + ((f1 - f0) * (z - z0)) / (z1 - z0); lo = Math.min(lo, f); hi = Math.max(hi, f); } }
      if (!isFinite(lo)) continue;
      const g = gh(z), dx = g.wb - g.wr, dy = g.yr - g.yb, L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = dx / L;
      const P = (f) => [g.wb + (g.wr - g.wb) * f + nx * off, g.yb + dy * f + ny * off], A = P(lo), B = P(Math.max(hi, lo + 0.002));
      rings.push({ z, pts: [A, B, [-B[0], B[1]], [-A[0], A[1]]], c: [0, g.yb - 0.5] });
    }
    loft(rings, (i, j) => (j === 1 ? null : key), true);
  }
  /** ghPolyY: like ghPoly but the outline is traced straight off the blueprint in model (z, y) metres; each slice is converted to the
   *  belt..roof fraction at its own z, so window and pillar lines land exactly on the drawing's lines. pts must be convex per z. */
  function ghPolyY(gh, key, pts, off = 0.016, n = 16) {
    const zs = pts.map((q) => q[0]), za = Math.min(...zs), zb = Math.max(...zs), rings = [];
    const zk = new Set(); for (let k = 0; k <= n; k++) zk.add(za + (zb - za) * k / n); for (const z of zs) zk.add(z);
    for (const zz of [...zk].sort((a, b) => a - b)) {
      const z = Math.min(zb - 1e-4, Math.max(za + 1e-4, zz)); let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) { const [z0, y0] = pts[i], [z1, y1] = pts[(i + 1) % pts.length]; if ((z0 - z) * (z1 - z) <= 0 && z0 !== z1) { const y = y0 + ((y1 - y0) * (z - z0)) / (z1 - z0); lo = Math.min(lo, y); hi = Math.max(hi, y); } }
      if (!isFinite(lo)) continue;
      const g = gh(z), dx = g.wb - g.wr, dy = g.yr - g.yb, L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = dx / L, F = (y) => Math.min(1, Math.max(0, (y - g.yb) / (dy || 1)));
      const P = (f) => [g.wb + (g.wr - g.wb) * f + nx * off, g.yb + dy * f + ny * off], A = P(F(lo)), B = P(Math.max(F(hi), F(lo) + 0.002));
      rings.push({ z, pts: [A, B, [-B[0], B[1]], [-A[0], A[1]]], c: [0, g.yb - 0.5] });
    }
    loft(rings, (i, j) => (j === 1 ? null : key), true);
  }
  /** bodyPolyY: overlay on the lower body's side surface shaped by a polygon traced off the blueprint in (z, y) metres
   *  (lamps, cladding, trim seen side-on). Follows the tumblehome (Bd.wAt). pts convex per z. */
  function bodyPolyY(Bd, key, pts, off = 0.012, n = 16, m = 4) {
    const zs = pts.map((q) => q[0]), za = Math.min(...zs), zb = Math.max(...zs), rings = [];
    const zk = new Set(); for (let k = 0; k <= n; k++) zk.add(za + (zb - za) * k / n); for (const z of zs) zk.add(z);
    for (const zz of [...zk].sort((a, b) => a - b)) {
      const z = Math.min(zb - 1e-4, Math.max(za + 1e-4, zz), Bd.z1 - 1e-3); let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) { const [z0, y0] = pts[i], [z1, y1] = pts[(i + 1) % pts.length]; if ((z0 - z) * (z1 - z) <= 0 && z0 !== z1) { const y = y0 + ((y1 - y0) * (z - z0)) / (z1 - z0); lo = Math.min(lo, y); hi = Math.max(hi, y); } }
      if (!isFinite(lo)) continue;
      hi = Math.min(hi, Bd.yt(z) - 0.004); if (hi <= lo) hi = lo + 0.001;
      const R = []; for (let i = 0; i <= m; i++) { const y = lo + (hi - lo) * i / m; R.push([Bd.wAt(z, y) + off, y]); }
      rings.push({ z, pts: [...R, ...R.slice().reverse().map(([x, y]) => [-x, y])], c: [0, lo - 0.5] });
    }
    loft(rings, (i, j) => (j === m || j === 2 * m + 1 ? null : key), true);
  }
  /** push a traced outline out by d (frames, surrounds) */
  const grow = (pts, d) => { const cz = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return pts.map(([z, y]) => { const L = Math.hypot(z - cz, (y - cy) * 2) || 1; return [z + d * (z - cz) / L, y + d * (y - cy) * 2 / L]; }); };
  /** overlay strip on the greenhouse top (roof/glass) between z0..z1, lateral fraction a..b of the half roof width (0 centre, 1 edge) */
  function ghTop(gh, key, z0, z1, a = 0.85, b = 1.0, off = 0.012, n = 8) {
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const z = z0 + ((z1 - z0) * k) / n, g = gh(z), y = (f) => gh.roofAt(g, f) + off;
      rings.push({ z, pts: [[g.wr * a, y(a)], [g.wr * b, y(b)], [-g.wr * b, y(b)], [-g.wr * a, y(a)]], c: [0, g.yb] });
    }
    loft(rings, (i, j) => (j === 0 || j === 2 ? key : null), true);
  }
  /** side strip on the lower body at height y0..y1 between z0..z1 (body moulding, cladding, stripes) */
  function bodySide(Bd, key, z0, z1, y0, y1, off = 0.012, n = 8) {
    const rings = [];
    for (let k = 0; k <= n; k++) { const z = z0 + ((z1 - z0) * k) / n, w = Bd.half(z) + off; rings.push({ z, pts: [[w, y0], [w, y1], [-w, y1], [-w, y0]], c: [0, (y0 + y1) / 2] }); }
    loft(rings, (i, j) => (j === 1 || j === 3 ? null : key), true);
  }


  // ---------- v3 helpers (2026-11-24 "Goob's truck principles": signature grille shapes proud of the nose,
  // colour blocks / two-tone / cladding as geometry skins instead of painted texels) ----------
  /** closed polygon [[x,y]] rounded by Chaikin corner cutting (it passes) -> T.Shape; sx/sy scale about the origin */
  // rad: corner radius cap (m): each pass cuts at most `rad` from an edge end, so long edges stay straight and corners stay soft
  function softShape(pts, it = 3, sx = 1, sy = 1, rad = 0.05) {
    let P2 = pts.map(([x, y]) => [x * sx, y * sy]);
    for (let n = 0; n < it; n++) {
      const Q = [];
      for (let i = 0; i < P2.length; i++) {
        const a = P2[i], b = P2[(i + 1) % P2.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.min(0.25, rad / L);
        Q.push([a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k], [a[0] * k + b[0] * (1 - k), a[1] * k + b[1] * (1 - k)]);
      }
      P2 = Q;
    }
    const sh = new T.Shape(); P2.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); return sh;
  }
  /** symmetric outline from its right half [[x,y]] (x >= 0, listed top -> bottom) */
  const mirrorPts = (R) => [...R, ...R.slice().reverse().map(([x, y]) => [-x, y])];
  /**
   * grille as a shaped insert: o = { pts: right-half outline (top -> bottom, x >= 0) or full: [[x,y]], y, z (front face), tilt (rad, + = top leans back),
   *   frame: key of the surround ring (null = none), sw: surround width, depth, fill: insert key, back: backing key,
   *   bars: [[y, h, key, w?]] horizontal bars across the opening, vbars: [[x, w, key]], badge: {w, h, key, ring} , round: chaikin passes, x }
   */
  function softGrille(o) {
    const full = o.full ? o.pts : mirrorPts(o.pts), it = o.round ?? 3, x0 = o.x ?? 0;
    let W = 0, H0 = 1e9, H1 = -1e9; for (const [x, y] of full) { W = Math.max(W, Math.abs(x)); H0 = Math.min(H0, y); H1 = Math.max(H1, y); }
    const sw = o.sw ?? 0.04, sx = 1 - sw / W, sy = 1 - (2 * sw) / (H1 - H0), rot = [-(o.tilt ?? 0), 0, 0], d = o.depth ?? 0.05;
    if (o.frame !== null) {
      const rd = o.rad ?? 0.05, outer = softShape(full, it, 1, 1, rd), inner = softShape(full, it, sx, sy, rd); outer.holes.push(inner);
      put(o.frame ?? 'Chrome', new T.ExtrudeGeometry(outer, { depth: d, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 2 }), [x0, o.y, o.z - d], rot);
    }
    put(o.fill ?? 'Honeycomb', new T.ExtrudeGeometry(softShape(full, it, sx + 0.01, sy + 0.01, o.rad ?? 0.05), { depth: 0.02, bevelEnabled: false }), [x0, o.y, o.z - 0.026], rot);
    put(o.back ?? 'Grille', new T.ExtrudeGeometry(softShape(full, it, 1, 1, o.rad ?? 0.05), { depth: 0.03, bevelEnabled: false }), [x0, o.y, o.z - d - 0.06], rot);
    const at = (dx, dy, dz) => { const c = Math.cos(o.tilt ?? 0), s = Math.sin(o.tilt ?? 0); return [x0 + dx, o.y + dy * c - dz * s, o.z + dy * s + dz * c]; };   // tilt about x (top back)
    for (const [y, h, key, w] of o.bars ?? []) box(key ?? o.frame ?? 'Chrome', ...at(0, y, -0.012), w ?? 2 * W * 0.96, h, 0.02, rot);
    for (const [x, w, key] of o.vbars ?? []) box(key ?? o.frame ?? 'Chrome', ...at(x, (H0 + H1) / 2, -0.012), w, (H1 - H0) * 0.94, 0.02, rot);
    if (o.badge) {
      const b = o.badge, g = new T.CylinderGeometry(1, 1, 0.025, 20); g.rotateX(Math.PI / 2); g.scale(b.w / 2, b.h / 2, 1);
      put(b.key ?? 'Badge', g, at(b.x ?? 0, b.y ?? 0, 0.012), rot);
      if (b.ring !== false) { const r = new T.TorusGeometry(1, 0.1, 4, 20); r.scale(b.w / 2 + 0.004, b.h / 2 + 0.004, 0.08); put(b.ringKey ?? 'Chrome', r, at(b.x ?? 0, b.y ?? 0, 0.024), rot); }
    }
  }
  /** a pair of lamps: right-side outline [[x,y]] (x > 0, absolute), extruded `depth` back from z, tilted like the nose; mirrored to the left */
  function lampPair(key, pts, y, z, o = {}) {
    // o.rear: the lamp faces -Z (z = the tail surface), tilt + = top leans toward the cabin
    const d = o.depth ?? 0.08, rot = (s) => (o.rear ? [o.tilt ?? 0, Math.PI - s * (o.yaw ?? 0), 0] : [-(o.tilt ?? 0), s * (o.yaw ?? 0), 0]);
    for (const s of [-1, 1]) {
      const g = new T.ExtrudeGeometry(softShape(pts.map(([x, yy]) => [s * x, yy]), o.round ?? 2, 1, 1, o.rad ?? 0.03), { depth: d, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: 2 });
      put(key, g, [0, y, o.rear ? z + d : z - d], rot(s));
      if (o.wrap) box(key, s * o.wrap.x, y + (o.wrap.y ?? 0), o.rear ? z + (o.wrap.dz ?? 0.15) : z - (o.wrap.dz ?? 0.15), 0.03, o.wrap.h, o.wrap.l ?? 0.2, [0, s * (o.wrap.yaw ?? 0.15), 0]);
    }
  }
  /**
   * skin: a thin colour band on both body sides between y0 and y1 for z0..z1 that steps up around wheel arches.
   * o = { z0, z1, y0, y1, arches: [{z, R, cy}] (defaults to the body's arches + gap), w: (z, y) -> half width (default Bd.wAt), off, n, sides }
   * Use for two-tone lower bands, plastic cladding, police door blocks and livery stripes.
   */
  function skin(Bd, key, o) {
    const N = o.n ?? Math.max(24, Math.round((o.z1 - o.z0) * 22)), off = o.off ?? 0.006, pos = [];
    const arches = o.arches ?? (Bd.arches || []).map((a) => ({ z: a.z, R: a.r + (o.gap ?? 0.02), cy: a.cy }));
    const W = o.w ?? ((z, y) => Bd.wAt(z, y));
    const yb = (z) => { let y = o.y0; for (const a of arches) { const d = z - a.z; if (Math.abs(d) < a.R) y = Math.max(y, a.cy + Math.sqrt(a.R * a.R - d * d)); } return Math.min(y, o.y1); };
    const sides = o.sides ?? [-1, 1];
    for (let k = 0; k < N; k++) {
      const za = o.z0 + ((o.z1 - o.z0) * k) / N, zb = o.z0 + ((o.z1 - o.z0) * (k + 1)) / N, ya = yb(za), yc = yb(zb);
      if (ya >= o.y1 - 1e-4 && yc >= o.y1 - 1e-4) continue;
      const M = o.rows ?? 3;   // a few rows so the skin follows the body's tumblehome
      for (let m = 0; m < M; m++) {
        const fa = m / M, fb = (m + 1) / M;
        const pa0 = ya + (o.y1 - ya) * fa, pa1 = ya + (o.y1 - ya) * fb, pb0 = yc + (o.y1 - yc) * fa, pb1 = yc + (o.y1 - yc) * fb;
        for (const sd of sides) {
          const A = [sd * (W(za, pa0) + off), pa0, za], B = [sd * (W(zb, pb0) + off), pb0, zb], C = [sd * (W(zb, pb1) + off), pb1, zb], D = [sd * (W(za, pa1) + off), pa1, za];
          if (sd > 0) pos.push(...A, ...C, ...B, ...A, ...D, ...C); else pos.push(...A, ...B, ...C, ...A, ...C, ...D);
        }
      }
    }
    if (!pos.length) return;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); put(key, g);
  }
  /** z of the body's nose (end=+1) or tail (end=-1) surface at height y: details placed at faceAt()+e sit proud instead of buried */
  function faceAt(Bd, y, end = 1) {
    const N = Math.ceil((Bd.z1 - Bd.z0) / 0.002), a = end > 0 ? Bd.z1 : Bd.z0, b = end > 0 ? Bd.z0 : Bd.z1;
    for (let k = 0; k <= N; k++) { const z = a + ((b - a) * k) / N; if (Bd.yt(z) + (Bd.cr ?? 0) >= y) return z; }
    return a;
  }
  /** lean of the nose/tail face between heights y0 < y1 (rad, + = top leans toward the cabin) */
  function faceTilt(Bd, y0, y1, end = 1) { return Math.atan2(end * (faceAt(Bd, y0, end) - faceAt(Bd, y1, end)), y1 - y0); }

  // ---------- v4 helpers (2026-11-24, reference-photo pass): parts that hug the real body surface ----------
  /** height of the body's top surface at (z, x) including the crown */
  function topAt(Bd, z, x) {
    const w = Math.max(0.01, Bd.half(z) - Bd.tm), yt = Bd.yt(z), ax = Math.abs(x), cr = Bd.cr ?? 0;
    if (ax >= w) return yt; return yt + (ax < w * 0.5 ? cr * (1 - 0.25 * ax / (w * 0.5)) : cr * 0.75 * (1 - (ax - w * 0.5) / (w * 0.5)));
  }
  /** z of the nose/tail surface at lateral x and height y, pulled back until the body is wide enough to carry x (follows rounded plan corners) */
  function faceAtX(Bd, x, y, end = 1) {
    const a = end > 0 ? Bd.z1 : Bd.z0, b = end > 0 ? Bd.z0 : Bd.z1, N = Math.ceil(Math.abs(a - b) / 0.004);
    for (let k = 0; k <= N; k++) { const z = a + ((b - a) * k) / N; if (topAt(Bd, z, x) >= y && Bd.wAt(z, y) >= Math.abs(x)) return z; }
    return a;
  }
  /**
   * wrap: a skin that starts on the nose (end=1) or tail (end=-1) face at lateral x0, runs out to the corner and, when zb is given,
   * carries on along the body side to z = zb. y0 / y1 are numbers or functions of u (0..1 across the face, 1..2 along the side),
   * so lamps can taper. o = { end, x0, x1 (stop on the face before the corner), zb, y0, y1, off, n1, n2, rows, sides }
   */
  /** ywarp: lifts nose/tail details with a raised hood/belt line. Bd.ywarp = {nose: {a, b, d}, tail: {a, b, d}}: y below a stays, above b moves by d. */
  function ywarp(Bd, y, end = 1) { const W = Bd.ywarp && Bd.ywarp[end > 0 ? 'nose' : 'tail']; return W ? y + W.d * Math.min(1, Math.max(0, (y - W.a) / (W.b - W.a))) : y; }
  function wrap(Bd, key, o) {
    const end = o.end ?? 1, off = o.off ?? 0.012, fn = (v) => (typeof v === 'function' ? v : () => v), wy = (y) => ywarp(Bd, y, end), y0f = fn(o.y0), y1f = fn(o.y1), Y0 = (u) => wy(y0f(u)), Y1 = (u) => wy(y1f(u));
    const n1 = Math.max(o.n1 ?? 8, o.x1 != null && o.x1 - o.x0 < 0.3 ? 4 : 12), n2 = o.zb != null ? Math.max(o.n2 ?? 6, 10) : 0, rows = Math.max(o.rows ?? 2, 3), pos = [];
    const us = []; for (let i = 0; i <= n1; i++) us.push(i / n1); for (let i = 1; i <= n2; i++) us.push(1 + i / n2);
    // plan contour of the body at height y, from the centre of the face round the corner and along the side to zb (rays from a
    // pivot inside the end, then the side by z), so wraps hug rounded and tapered ends instead of cutting across them
    const tip = end > 0 ? Bd.z1 : Bd.z0, PR = o.pivot ?? 0.6, zP = tip - end * PR, cache = new Map();
    const inside = (x, z, y) => (end > 0 ? z <= Bd.z1 : z >= Bd.z0) && topAt(Bd, z, x) >= y && Bd.wAt(z, y) >= Math.abs(x);
    const contour = (y) => {
      const k = Math.round(y * 500); if (cache.has(k)) return cache.get(k);
      const C = [];
      for (let d = 0; d <= 90; d += 5) { const t = (d * Math.PI) / 180, sx = Math.sin(t), cz = Math.cos(t); let sF = 0; for (let q = 1.7; q > 0; q -= 0.004) if (inside(q * sx, zP + end * q * cz, y)) { sF = q; break; } C.push([sF * sx, zP + end * sF * cz, d]); }
      const zEnd = o.zb ?? zP; for (let z = zP - end * 0.06; end * (z - zEnd) > -1e-6; z -= end * 0.06) C.push([Bd.wAt(z, y), z, 91]);
      if (o.zb != null && Math.abs(C[C.length - 1][1] - o.zb) > 1e-3 && end * (zP - o.zb) > 0) C.push([Bd.wAt(o.zb, y), o.zb, 91]);
      if (o.zb != null) { const j = C.findIndex((c, i) => i > 0 && end * (c[1] - o.zb) < 0); if (j > 0) { const A = C[j - 1], B = C[j], t = (o.zb - A[1]) / (B[1] - A[1] || 1); C.length = j; C.push([A[0] + (B[0] - A[0]) * t, o.zb, A[2] + (B[2] - A[2]) * t]); } }
      let L = 0; C[0][3] = 0; for (let i = 1; i < C.length; i++) { L += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]); C[i][3] = L; }
      cache.set(k, C); return C;
    };
    const at = (C, sl) => { sl = Math.max(0, Math.min(C[C.length - 1][3], sl)); let i = 1; while (i < C.length - 1 && C[i][3] < sl) i++; const A = C[i - 1], B = C[i], t = (sl - A[3]) / Math.max(1e-6, B[3] - A[3]), tx = B[0] - A[0], tz = B[1] - A[1], tl = Math.hypot(tx, tz) || 1;
      return [A[0] + tx * t + (-end * tz / tl) * off, A[1] + tz * t + (end * tx / tl) * off]; };   // pushed out along the plan normal
    const sAtX = (C, x) => { for (let i = 1; i < C.length; i++) if (C[i][2] <= 90 && C[i][0] >= x) { const A = C[i - 1], B = C[i]; return A[3] + (B[3] - A[3]) * (x - A[0]) / Math.max(1e-6, B[0] - A[0]); } const m = C.filter((c) => c[2] <= 90); return m[m.length - 1][3]; };
    const P = (u, f) => {
      const y = Y0(u) + (Y1(u) - Y0(u)) * f, C = contour(y), s0 = sAtX(C, o.x0);
      const sC = o.x1 != null ? sAtX(C, o.x1) : Math.max(s0, (C.find((c) => c[2] >= (o.corner ?? 55)) || C[C.length - 1])[3]), sE = C[C.length - 1][3];
      const sl = u <= 1 ? s0 + (sC - s0) * u : sC + Math.max(0, sE - sC) * (u - 1), [x, z] = at(C, sl);
      return [x, y, z];
    };
    for (let i = 0; i < us.length - 1; i++) for (let m = 0; m < rows; m++) {
      const A = P(us[i], m / rows), B = P(us[i + 1], m / rows), C = P(us[i + 1], (m + 1) / rows), D = P(us[i], (m + 1) / rows);
      for (const sd of o.sides ?? [-1, 1]) {
        const f = ([x, y, z]) => [sd * x, y, z], ctr = [0, A[1], A[2] - end * 0.6];
        tri(pos, f(A), f(B), f(C), ctr); tri(pos, f(A), f(C), f(D), ctr);
      }
    }
    if (pos.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); put(key, g); }
  }
  /** raised hood dome with a visible stepped edge: follows the hood surface, lifted by h, rounded at the front. o = {z0, z1, w (half width), h, key, round (length of the rounded front)} */
  function hoodDome(Bd, o) {
    const n = o.n ?? 18, m = 8, h = o.h ?? 0.035, rd = o.round ?? 0.4, pos = [], ctr = [0, Bd.yt((o.z0 + o.z1) / 2) - 1, (o.z0 + o.z1) / 2];
    const hw = (z) => { const q = Math.max(0, (z - (o.z1 - rd)) / rd), c = Math.sqrt(Math.max(0, 1 - q * q));
    const kq = o.kick ? Math.max(0, 1 - (z - o.z0) / o.kick[1]) : 0, bw = (o.kick ? o.kick[0] * kq * kq : 0) + (o.bow ? o.bow * Math.sin((Math.PI / 2) * Math.max(0, Math.min(1, (o.z1 - rd - z) / (o.z1 - rd - o.z0)))) : 0);   // kick [by, over]: edges stay straight then sweep out to the hood's rear corners over the last `over` metres
    return bw + (o.corner != null ? o.w - o.corner * (1 - c) : o.w * Math.sqrt(Math.max(0.0, 1 - q * q * 0.94))); };   // bow: side edges curve outward toward the rear by this much   // corner: rounded-rectangle front (radius) instead of a full arc
    const fd = (z) => { if (!o.fade) return 1; const q = Math.max(0, Math.min(1, (o.z1 - z) / o.fade)); return q * q * (3 - 2 * q); };   // fade: the lift melts into the hood over this length at the front
    const P = (i, j, lift, ex = 0) => { const z = o.z0 + ((o.z1 - o.z0) * i) / n, x = (hw(z) + ex) * (-1 + (2 * j) / m); return [x, topAt(Bd, z, x) + (lift > 0 ? lift * fd(z) + 0.002 : lift), z]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { tri(pos, P(i, j, h), P(i + 1, j, h), P(i + 1, j + 1, h), ctr); tri(pos, P(i, j, h), P(i + 1, j + 1, h), P(i, j + 1, h), ctr); }
    const wall = (A, B, A0, B0) => { tri(pos, A, B, B0, ctr); tri(pos, A, B0, A0, ctr); };
    for (let i = 0; i < n; i++) for (const j of [0, m]) wall(P(i, j, h), P(i + 1, j, h), P(i, j, -0.01, o.bevel ?? 0), P(i + 1, j, -0.01, o.bevel ?? 0));   // bevel: side walls slope outward by this much instead of dropping straight down
    for (let j = 0; j < m; j++) for (const i of [0, n]) wall(P(i, j, h), P(i, j + 1, h), P(i, j, -0.01), P(i, j + 1, -0.01));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); put(o.key ?? 'Paint', g);
  }
  /** white/black arch lips (or flares): half-torus bands round each arch above y0 */
  function archLips(Bd, key, o = {}) {
    for (const a of o.arches ?? Bd.arches) for (const s of [-1, 1]) {
      const R = a.r + (o.gap ?? 0.02) + (o.t ?? 0.035), y0 = o.y0 ?? Bd.sill(a.z), a0 = Math.asin(Math.max(-1, Math.min(1, (y0 - a.cy) / R)));
      const lip = new T.TorusGeometry(R, o.t ?? 0.035, 4, 20, Math.PI - 2 * a0); lip.rotateZ(a0); lip.scale(1, 1, o.flat ?? 0.5); lip.rotateY(Math.PI / 2);
      put(key, lip, [s * ((o.x ?? Bd.half(a.z)) + (o.off ?? 0.01)), a.cy, a.z]);
    }
  }

  // ---------- wheels ----------
  /** tyre (lathed, rounded shoulders) + rim. o: {r, w, rim: fraction of r, spokes, style:'spoke'|'steel'|'disc'|'mag', dish} */
  function wheel(x, y, z, o) {
    const r = o.r, w = o.w, rr = r * (o.rim ?? 0.62), s = Math.sign(x) || 1, sg = o.seg ?? 18;
    const prof = [[rr * 0.98, -w / 2 + 0.02], [r - 0.035, -w / 2], [r - 0.005, -w / 2 + 0.035], [r, 0], [r - 0.005, w / 2 - 0.035], [r - 0.035, w / 2], [rr * 0.98, w / 2 - 0.02]].map(([a, b]) => new T.Vector2(a, b));
    const tg = new T.LatheGeometry(prof, sg); tg.rotateZ(Math.PI / 2);   // axis along x
    put(o.tyre ?? 'Tyre', tg, [x, y, z]);
    const face = x + s * (w / 2 - (o.dish ?? 0.05));
    // rim barrel + face
    const barrel = new T.CylinderGeometry(rr, rr, w * 0.8, sg, 1, true); barrel.rotateZ(Math.PI / 2); put('RimIn', barrel, [x, y, z]);
    const lip = new T.TorusGeometry(rr, 0.018, 4, sg); lip.rotateY(Math.PI / 2); put(o.rimKey ?? 'Rim', lip, [x + s * (w / 2 - 0.015), y, z]);
    const disc = new T.CylinderGeometry(rr * 0.97, rr * 0.97, 0.02, sg); disc.rotateZ(Math.PI / 2);
    const style = o.style ?? 'spoke', rk = o.rimKey ?? 'Rim';
    if (style === 'steel' || style === 'disc') {
      put(style === 'steel' ? 'Steel' : rk, disc, [face - s * 0.01, y, z]);
      if (style === 'steel') for (let k = 0; k < (o.holes ?? 6); k++) { const a = (k / (o.holes ?? 6)) * Math.PI * 2; box('RimIn', face + s * 0.002, y + Math.cos(a) * rr * 0.62, z + Math.sin(a) * rr * 0.62, 0.012, rr * 0.22, rr * 0.16, [a, 0, 0]); }
      const hub = new T.CylinderGeometry(rr * 0.32, rr * 0.38, 0.05, 10); hub.rotateZ(Math.PI / 2); put(o.hubKey ?? 'Chrome', hub, [face + s * 0.02, y, z]);
    } else {
      put('RimIn', disc, [face - s * 0.06, y, z]);   // dark back plate so the spokes read
      const n = o.spokes ?? 5;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (o.twist ?? 0);
        const sp = o.split ? [-0.11, 0.11] : [0];
        for (const d of sp) { const aa = a + d; box(rk, face, y + Math.cos(aa) * rr * 0.55, z + Math.sin(aa) * rr * 0.55, 0.03, rr * 0.92, rr * (o.spokeW ?? (o.split ? 0.1 : 0.2)), [aa, 0, 0]); }
      }
      const hub = new T.CylinderGeometry(rr * 0.24, rr * 0.3, 0.06, 10); hub.rotateZ(Math.PI / 2); put(rk, hub, [face + s * 0.012, y, z]);
      const cap = new T.CylinderGeometry(rr * 0.1, rr * 0.12, 0.08, 8); cap.rotateZ(Math.PI / 2); put(o.capKey ?? 'Chrome', cap, [face + s * 0.02, y, z]);
    }
  }
  // game export: mode 'body' leaves the wheels out (K.wheelOpt keeps their spec), 'wheel' builds one wheel at the origin (outer face +X)
  function wheels(axles, o) { K.wheelOpt = { ...o, axles }; if (K.mode) return; for (const az of axles) for (const s of [-1, 1]) wheel(s * o.x, o.r, az, o); }

  // ---------- small parts ----------
  /** door mirror on both sides: stalk + housing (+ glass facing back) */
  function mirrors(x, y, z, o = {}) {
    const k = o.key ?? 'Paint', w = o.w ?? 0.2, h = o.h ?? 0.12;
    if (lastBody && o.free !== true) x = Math.min(x, lastBody.half(z) - lastBody.tm - 0.005);   // sit on the belt edge, never float off a tapered body
    for (const s of [-1, 1]) {
      box(o.stalk ?? 'Trim', s * (x - 0.03), y - 0.02, z, 0.08, 0.04, 0.08);
      box(k, s * (x + w / 2 - 0.02), y + 0.03, z, w, h, o.d ?? 0.1, [0, s * 0.12, 0]);
      box('Mirror', s * (x + w / 2 - 0.02), y + 0.03, z - (o.d ?? 0.1) / 2 - 0.003, w - 0.03, h - 0.03, 0.006, [0, s * 0.12, 0]);
    }
  }
  /** door handles (both sides) at the given z list */
  function handles(Bd, zs, y, o = {}) { for (const z of zs) sbox(o.key ?? 'Trim', Bd.half(z) - 0.005, y, z, 0.03, o.h ?? 0.035, o.l ?? 0.17); }
  /** license plate */
  function plate(x, y, z, front = true, tilt = 0) { box('Plate', x, y, z, 0.52, 0.13, 0.015, [tilt, 0, 0]); box('Trim', x, y, z + (front ? -0.01 : 0.01), 0.55, 0.15, 0.012, [tilt, 0, 0]); }
  /** grille: frame + horizontal slats (or a mesh plate) */
  function grille(x, y, z, w, h, o = {}) {
    box(o.back ?? 'Grille', x, y, z - 0.02, w, h, 0.04, o.rot);
    if (o.frame) { const f = o.frame, t = o.t ?? 0.035; box(f, x, y + h / 2, z, w + t, t, 0.05, o.rot); box(f, x, y - h / 2, z, w + t, t, 0.05, o.rot); box(f, x - w / 2, y, z, t, h, 0.05, o.rot); box(f, x + w / 2, y, z, t, h, 0.05, o.rot); }
    const n = o.slats ?? 0;
    for (let k = 1; k <= n; k++) box(o.slatKey ?? o.frame ?? 'Chrome', x, y - h / 2 + (h * k) / (n + 1), z + 0.005, w - 0.02, o.st ?? 0.018, 0.03, o.rot);
    const v = o.bars ?? 0;
    for (let k = 1; k <= v; k++) box(o.slatKey ?? o.frame ?? 'Chrome', x - w / 2 + (w * k) / (v + 1), y, z + 0.005, o.st ?? 0.018, h - 0.02, 0.03, o.rot);
  }
  /** rounded-ish bar along x at (y, z): a short loft (bumpers, light bars, push bars) */
  function barX(key, w, y, z, h, d, rnd = 0.3) {
    const s = new T.Shape(), hw = d / 2, hh = h / 2, r = Math.min(hw, hh) * rnd;
    s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r); s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh);
    s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r); s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    const g = new T.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 3 });
    g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2);
    return put(key, g, [0, y, z]);
  }
  /** emergency light bar on the roof: base, red/blue domes, chrome feet */
  function lightbar(y, z, w = 1.2, o = {}) {
    barX(o.base ?? 'Trim', w, y + 0.04, z, 0.06, 0.28, 0.5);
    const segs = o.segs ?? 6;
    for (let k = 0; k < segs; k++) {
      const x = -w / 2 + 0.06 + ((w - 0.12) * (k + 0.5)) / segs, key = o.keys ? o.keys[k % o.keys.length] : (x < 0 ? 'LightRed' : 'LightBlue');
      box(key, x, y + 0.11, z, (w - 0.14) / segs - 0.012, 0.09, 0.24);
    }
    for (const s of [-1, 1]) box('Trim', s * (w / 2 - 0.08), y + 0.0, z, 0.06, 0.06, 0.18);
  }

  /** side-profile polygon (z,y) of a panel from z0..z1 between yb..yt with wheel-arch cut-outs [{z, r, cy}] along the bottom */
  function archPoly(z0, z1, yb, yt, arches = [], n = 10) {
    const pts = [[z0, yt], [z0, yb]];
    for (const a of arches.slice().sort((p, q) => p.z - q.z)) {
      const h = Math.max(0, yb - a.cy), ang = h < a.r ? Math.asin(h / a.r) : Math.PI / 2;
      for (let k = 0; k <= n; k++) { const t = Math.PI - ang - ((Math.PI - 2 * ang) * k) / n; pts.push([a.z + Math.cos(t) * a.r, a.cy + Math.sin(t) * a.r]); }
    }
    pts.push([z1, yb], [z1, yt]);
    return pts;
  }
  /** wheel-well liner (dark half tube) at an arch, across x from x0..x1 */
  function liner(a, x0, x1, key = 'Well') {
    const g = new T.CylinderGeometry(a.r - 0.01, a.r - 0.01, Math.abs(x1 - x0), 14, 1, true, 0, Math.PI);
    g.rotateZ(Math.PI / 2); put(key, g, [(x0 + x1) / 2, a.cy, a.z]);
  }
  /**
   * Pickup bed. o = {z0 rear, z1 front (cab back), sill, floor, top, w half width, arch {z,r,cy}, key, liner key, tailgate}
   */
  function bed(o) {
    const k = o.key ?? 'Paint', t = 0.07, w = o.w;
    for (const s of [-1, 1]) {
      const lo = archPoly(o.z0, o.z1, o.sill, o.floor + 0.02, [o.arch]);
      const g = new T.Shape(lo.map(([z, y]) => new T.Vector2(z, y)));
      const geo = new T.ExtrudeGeometry(g, { depth: 0.3, bevelEnabled: false, curveSegments: 4 }); geo.rotateY(-Math.PI / 2); geo.translate(s > 0 ? w : -w + 0.3, 0, 0); put(k, geo);
      bx(k, s * w, o.floor, o.z0, s * (w - t), o.top, o.z1);                       // bed side wall
      bx(o.rail ?? 'Trim', s * (w + 0.005), o.top, o.z0 - 0.01, s * (w - t - 0.03), o.top + 0.035, o.z1);   // rail cap
      bx(o.liner ?? 'Bedliner', s * (w - t), o.floor, o.arch.z - o.arch.r * 0.8, s * (w - t - 0.22), o.arch.cy + o.arch.r + 0.03, o.arch.z + o.arch.r * 0.8); // wheel house
      liner(o.arch, s * (w - 0.3), s * w);
    }
    bx(o.liner ?? 'Bedliner', -w + t, o.floor - 0.03, o.z0 + 0.02, w - t, o.floor + 0.02, o.z1);   // floor
    bx(k, -w, o.floor - 0.02, o.z1 - t, w, o.top, o.z1);                                 // front wall
    bx(k, -w + 0.01, o.sill + 0.12, o.z0, w - 0.01, o.top - 0.01, o.z0 + 0.06);          // tailgate
    box(o.rail ?? 'Trim', 0, o.top - 0.12, o.z0 - 0.005, 0.24, 0.06, 0.02);             // tailgate handle
    bx(o.under ?? 'Under', -w + 0.3, o.sill, o.z0 + 0.06, w - 0.3, o.floor - 0.03, o.z1);
  }

  /** strip laid on the greenhouse roof/hatch surface between z0..z1 and across-width fractions f0..f1 (1 = the edge), both sides; y0/y1 optional height clamp */
  function ghEdge(gh, key, z0, z1, f0, f1, o = {}) {
    const nz = o.nz ?? 12, nf = o.nf ?? 3, off = o.off ?? 0.008, pos = [];
    const S = (z, f, sd) => { const g = gh(z); return [sd * g.wr * f, gh.roofAt(g, f) + off, z]; };
    for (const sd of [-1, 1]) for (let k = 0; k < nz; k++) for (let j = 0; j < nf; j++) {
      const za = z0 + ((z1 - z0) * k) / nz, zb = z0 + ((z1 - z0) * (k + 1)) / nz, fa = f0 + ((f1 - f0) * j) / nf, fb = f0 + ((f1 - f0) * (j + 1)) / nf;
      const A = S(za, fa, sd), B = S(za, fb, sd), C = S(zb, fb, sd), D = S(zb, fa, sd), ctr = [0, A[1] - 0.6, A[2] + (o.end ?? -1) * -0.6];
      tri(pos, A, B, C, ctr); tri(pos, A, C, D, ctr);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); put(key, g);
  }
  /** police push bar in front of the nose: two uprights + cross bars */
  // open tube push bumper traced from the police photos: two bowed uprights, top tube with wings back to the lamps,
  // light-bar crossbar, low crossbar, mounting arms back to the frame; the grille shows through (no plate)
  function pushbar(z, y0, y1, w = 0.42) {
    const h = y1 - y0, P = (s, f, dz) => [s * w, y0 + h * f, z + dz];
    for (const s of [-1, 1]) {
      const up = [P(s, 0, -0.1), P(s, 0.2, -0.01), P(s, 0.5, 0), P(s, 0.82, -0.01), P(s, 1, -0.07)];
      for (let i = 0; i < up.length - 1; i++) rod('Plastic', up[i], up[i + 1], 0.046, 8);
      rod('Plastic', P(s, 0.93, -0.03), [s * (w + 0.17), y0 + h * 0.9, z - 0.16], 0.032, 8);             // wing back toward the lamp
      rod('Plastic', P(s, 0.08, -0.06), [s * w, y0 + 0.05, z - 0.34], 0.04, 6);                          // mounting arm
      box('LightRed', s * (w - 0.12), y0 + h * 0.5, z + 0.035, 0.09, 0.035, 0.02);                       // lamps on the crossbar
    }
    rod('Plastic', P(-1, 0.93, -0.03), P(1, 0.93, -0.03), 0.036, 8);
    box('Plastic', 0, y0 + h * 0.5, z, 2 * w, 0.07, 0.06);
    rod('Plastic', P(-1, 0.12, -0.03), P(1, 0.12, -0.03), 0.034, 8);
  }
  /** pillar-mounted spotlight (driver side) */
  function spotlight(x, y, z) { rod('Chrome', [x, y - 0.12, z], [x, y, z], 0.015, 5); box('Chrome', x + 0.03, y + 0.03, z + 0.04, 0.1, 0.1, 0.14); box('Clear', x + 0.03, y + 0.03, z + 0.115, 0.08, 0.08, 0.01); }
  const K = { ghEdge, ghPoly, ghPolyY, bodyPolyY, grow, roofLip, hoodDome, ywarp, topAt, faceAtX, wrap, last: () => lastBody, mode: null, wheelOpt: null, faceAt, faceTilt, softShape, mirrorPts, softGrille, lampPair, skin, archLips, chaikin, rbx, pushbar, spotlight, archPoly, liner, bed, parts, push, pop, put, box, bx, sbox, rod, srod, sideExtrude, frontExtrude, tab, loft, body, greenhouse, ghSide, ghTop, bodySide, wheel, wheels, mirrors, handles, plate, grille, barX, lightbar, T };
  return K;
}

// ---------- painters for vehicles ----------
// eslint-disable-next-line no-unused-vars
function makeVPaint() {
  const fr = (x) => x - Math.floor(x);
  const hash = (a, b) => fr(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mul = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /**
   * Car paint with panel gaps: o = {base, seams: [z...] door cuts (side), hood: z of the hood cut (top), trunk: z,
   *   sill, belt: panel gaps only between these heights, lines: [{y, z0, z1, c}] painted stripes, decals: fn(p,n)->color|null}
   */
  function paint(o) {
    const base = hex(o.base), gap = mul(base, 0.35), sill = o.sill ?? 0.3, belt = o.belt ?? 1.0, g = o.gap ?? 0.006;
    return (p, n) => {
      if (o.decal) { const d = o.decal(p, n); if (d) return d; }
      let c = mul(base, 0.97 + 0.04 * noise(p.x * 3 + p.z * 2, p.y * 3));
      if (o.lines) for (const L of o.lines) if (Math.abs(n.x) > 0.3 && p.y > L.y0 && p.y < L.y1 && p.z > (L.z0 ?? -99) && p.z < (L.z1 ?? 99)) { c = hex(L.c); if (L.solid) return mul(c, n.y < -0.3 ? 0.6 : 0.97); }
      const side = Math.abs(n.x) > 0.45, up = n.y > 0.45;
      if (side && p.y > sill && p.y < belt) for (const z of o.seams ?? []) if (Math.abs(p.z - z) < g) return gap;
      if (up && o.hood !== undefined && Math.abs(p.z - o.hood) < g) return gap;
      if (up && o.trunk !== undefined && Math.abs(p.z - o.trunk) < g) return gap;
      if (up && o.hoodSide && Math.abs(Math.abs(p.x) - o.hoodSide) < g && p.z > o.hood) return gap;
      // a soft highlight band along the shoulder, darker toward the rocker
      if (side) c = mul(c, 0.86 + 0.2 * Math.min(1, Math.max(0, (p.y - sill) / Math.max(0.1, belt - sill))));
      if (n.y < -0.3) c = mul(c, 0.55);
      if (o.gloss) {   // dark paints: a sky sheen on up-facing panels and a soft horizon reflection along the sides
        const sky = [150, 162, 178], up = Math.max(0, n.y);
        c = mix(c, sky, o.gloss * up * up * 0.45);
        if (side) { const t = (p.y - belt * 0.9) / 0.12; if (Math.abs(t) < 1) c = mix(c, sky, o.gloss * 0.35 * (1 - t * t)); c = mix(c, [70, 74, 80], o.gloss * 0.15); }
      }
      return c;
    };
  }
  function plain(base, k = 0.04) { const b = hex(base); return (p) => mul(b, 1 - k / 2 + k * hash(Math.floor(p.x * 53 + p.z * 31), Math.floor(p.y * 47 + p.z * 11))); }
  function glass(o = {}) {
    const dark = hex(o.dark ?? '#0f141b'), sky = hex(o.sky ?? '#7f95ab'), mid = hex(o.mid ?? '#2a3645');
    return (p, n) => {
      const t = o.t ?? Math.max(0, Math.min(1, n.y * 0.8 + 0.25));
      let c = mix(dark, mid, t);
      const d = fr((p.z * 0.9 + p.y * 1.3 + p.x * 0.3) * 0.8);
      if (d > 0.1 && d < 0.17) c = mix(c, sky, 0.5);
      if (d > 0.22 && d < 0.24) c = mix(c, sky, 0.35);
      return c;
    };
  }
  /** headlight: chrome reflector bowls in a clear lens */
  function headlight(o = {}) { const a = hex(o.a ?? '#eef1f4'), b = hex(o.b ?? '#bcc5ce'); return (p) => { const k = Math.abs(Math.sin(p.x * 26)) * Math.abs(Math.sin(p.y * 30)); return mix(b, a, Math.min(1, k * 1.4)); }; }
  function taillight(o = {}) { const a = hex(o.a ?? '#c4161c'), b = hex(o.b ?? '#7a0a0e'); return (p) => mix(b, a, 0.55 + 0.45 * Math.abs(Math.sin(p.x * 22 + p.y * 9))); }
  /** tyre: rubber with a darker tread band */
  function tyre() { const a = hex('#1d1d1f'), b = hex('#2b2b2e'); return (p, n) => (Math.abs(n.x) > 0.6 ? mul(b, 0.95 + 0.1 * hash(Math.floor(p.y * 90), Math.floor(p.z * 90))) : mul(a, 0.9 + 0.2 * (fr(Math.atan2(p.y, p.z) * 12) > 0.5 ? 1 : 0))); }
  function plateTex(o = {}) { const bg = hex(o.bg ?? '#f2f0e6'), ink = hex(o.ink ?? '#1e3a7a'); return (p, n) => { const u = fr(p.x * 9), v = fr(p.y * 14); return (u > 0.15 && u < 0.85 && v > 0.3 && v < 0.7 && hash(Math.floor(p.x * 18), 1) > 0.25) ? ink : bg; }; }
  function chrome() { const a = hex('#f0f2f4'), b = hex('#6c7278'); return (p, n) => mix(b, a, Math.min(1, Math.max(0, 0.5 + n.y * 0.6 + 0.2 * Math.sin(p.y * 40)))); }
  /** text decal on both sides of the body: o = {text, z0, z1, y0, y1, ink, font, minNx} -> fn(p, n) -> colour | null */
  function textDecal(o) {
    const W = 512, H = Math.round(512 * (o.y1 - o.y0) / (o.z1 - o.z0)) || 64;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = H * 0.9; g.font = `${o.weight ?? 'bold'} ${fs}px ${o.font ?? 'Arial, sans-serif'}`;
    while (g.measureText(o.text).width > W * 0.96 && fs > 6) { fs -= 2; g.font = `${o.weight ?? 'bold'} ${fs}px ${o.font ?? 'Arial, sans-serif'}`; }
    g.fillText(o.text, W / 2, H / 2 + fs * 0.04);
    const px = g.getImageData(0, 0, W, H).data, ink = hex(o.ink ?? '#101010');
    return (p, n) => {
      if (Math.abs(n.x) < (o.minNx ?? 0.35) || p.z < o.z0 || p.z > o.z1 || p.y < o.y0 || p.y > o.y1) return null;
      let u = (p.z - o.z0) / (o.z1 - o.z0); if (n.x > 0) u = 1 - u;
      const x = Math.min(W - 1, Math.floor(u * W)), y = Math.min(H - 1, Math.floor((o.y1 - p.y) / (o.y1 - o.y0) * H));
      return px[(y * W + x) * 4 + 3] > 110 ? ink : null;
    };
  }
  /** combine decal fns: first non-null wins */
  const decals = (...fs) => (p, n) => { for (const f of fs) { const c = f && f(p, n); if (c) return c; } return null; };
  /** a coloured region on the sides: {z0, z1, y0, y1, c} */
  const zone = (o) => { const c = hex(o.c); return (p, n) => (Math.abs(n.x) > (o.minNx ?? 0.3) && p.z > o.z0 && p.z < o.z1 && p.y > o.y0 && p.y < o.y1 ? c : null); };
  return { textDecal, decals, zone, paint, plain, glass, headlight, taillight, tyre, plateTex, chrome, hex, mix, mul, noise, hash };
}
