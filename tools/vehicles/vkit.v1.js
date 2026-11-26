// Vehicle kit for Tracebench scripted builds (Maple Grove Off Leash).
// A car = a lofted lower body (with real wheel-arch cut-outs) + a lofted greenhouse (glass and roof) + overlays
// (pillars, trim, lights, grille, bumpers, mirrors) + lathed tyres with spoked rims. Parts are bucketed by material key.
// Units: metres, Y up, ground at y = 0, the car's nose faces +Z, centred on the origin.
// eslint-disable-next-line no-unused-vars
function makeVKit(T) {
  const parts = {};
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
  function sideExtrude(key, pts, x0, x1) {
    const s = new T.Shape(pts.map(([z, y]) => new T.Vector2(z, y)));
    const g = new T.ExtrudeGeometry(s, { depth: Math.abs(x1 - x0), bevelEnabled: false, curveSegments: 6 });
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
    const top = tab(B.top), half = tab(B.half), sillT = B.bottom ? tab(B.bottom) : () => B.sill;
    const z0 = B.top[0][0], z1 = B.top[B.top.length - 1][0];
    const zs = new Set();
    for (let z = z0; z <= z1 + 1e-6; z += B.step ?? 0.12) zs.add(+z.toFixed(4));
    for (const [z] of B.top) zs.add(z); for (const [z] of B.half) if (z > z0 && z < z1) zs.add(z);
    if (B.bottom) for (const [z] of B.bottom) if (z > z0 && z < z1) zs.add(z);
    for (const a of B.arches) { for (let k = 0; k <= 12; k++) zs.add(+(a.z - a.r + (2 * a.r * k) / 12).toFixed(4)); zs.add(+(a.z - a.r - 0.004).toFixed(4)); zs.add(+(a.z + a.r + 0.004).toFixed(4)); }
    const Z = [...zs].filter((z) => z >= z0 && z <= z1).sort((a, b) => a - b);
    const archY = (z) => { let y = sillT(z), inset = B.tuck ?? 0.05; for (const a of B.arches) { const d = Math.abs(z - a.z); if (d <= a.r) { y = Math.max(y, a.cy + Math.sqrt(a.r * a.r - d * d) * (a.sq ?? 1)); inset = B.inset ?? 0.3; } } return [y, inset]; };
    const tm = B.tumble ?? 0.08, cr = B.crown ?? 0.03, sh = B.shoulder ?? 0.55, fl = B.floor ?? 0.2;
    const rings = Z.map((z) => {
      const w = half(z), yt = top(z), [ys, ins] = archY(z);
      const ysh = Math.min(yt - 0.04, ys + (yt - ys) * sh), y4 = yt - Math.min(0.06, (yt - ysh) * 0.5);
      const R = [[w - ins, Math.min(fl, ys - 0.02)], [w - ins, ys], [w - (B.tuck ?? 0.05) * 0.4, ys], [w, ysh], [w - tm * 0.35, y4], [w - tm, yt], [(w - tm) * 0.5, yt + cr * 0.75], [0, yt + cr]];
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
    return { top, half, z0, z1, sill: sillT, tm, w: (z) => half(z), yt: top };
  }

  /**
   * Greenhouse. G = { st: [[z, yRoof|null, halfRoof]] from front (windshield base) to rear; null = sits on the belt,
   *   inset: base pulled in from the body shoulder, crown, roof: [i0, i1] segments painted (others glass), key / glass keys }
   * Returns a sampler gh(z) -> {yb, yr, wb, wr} for pillars and trims.
   */
  function greenhouse(Bd, G) {
    const st = G.st.slice().sort((a, b) => a[0] - b[0]), ins = G.inset ?? 0.04, cr = G.crown ?? 0.04;
    const base = (z) => [Bd.top(z) + (G.lift ?? 0), Bd.half(z) - Bd.tm - ins];
    const zs = new Set(st.map((s) => s[0]));
    for (let i = 0; i < st.length - 1; i++) { const a = st[i][0], b = st[i + 1][0], n = Math.max(1, Math.round((b - a) / 0.25)); for (let k = 1; k < n; k++) zs.add(a + ((b - a) * k) / n); }
    const Z = [...zs].sort((a, b) => a - b);
    const yr = tab(st.map(([z, y]) => [z, y ?? base(z)[0]])), wr = tab(st.map(([z, , w]) => [z, w]));
    const gh = (z) => { const [yb, wb] = base(z); const yy = Math.max(yb, yr(z)); return { yb, yr: yy, wb, wr: Math.min(wb, wr(z)) }; };
    const seg = (z) => { for (let i = 0; i < st.length - 1; i++) if (z < st[i + 1][0] - 1e-6) return i; return st.length - 2; };
    // the original segment index is counted from the front: st sorted rear->front, so front index = (len-2) - seg
    const fidx = (z) => st.length - 2 - seg(z);
    const rings = Z.map((z) => { const g = gh(z); return { z, pts: [[g.wb, g.yb], [g.wr, g.yr], [0, g.yr + (g.yr > g.yb + 0.05 ? cr : 0)], [-g.wr, g.yr], [-g.wb, g.yb]], c: [0, g.yb] }; });
    const [r0, r1] = G.roof;
    loft(rings, (i, j) => {
      const zm = (Z[i] + Z[i + 1]) / 2, f = fidx(zm);
      if (j === 0 || j === 3) return G.sideKey ?? 'Glass';
      return f >= r0 && f < r1 ? G.key ?? 'Paint' : G.glass ?? 'Glass';
    }, false);
    gh.z0 = Z[0]; gh.z1 = Z[Z.length - 1]; gh.cr = cr;
    return gh;
  }
  /** overlay strip on the greenhouse side between z0..z1, f0..f1 = fraction from the belt (0) to the roof edge (1) */
  function ghSide(gh, key, z0, z1, f0 = 0, f1 = 1, off = 0.012, n = 6) {
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const z = z0 + ((z1 - z0) * k) / n, g = gh(z), dx = g.wb - g.wr, dy = g.yr - g.yb, L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = dx / L;
      const p = (f) => [g.wb + (g.wr - g.wb) * f + nx * off, g.yb + dy * f + ny * off];
      const a = p(f0), b = p(f1);
      rings.push({ z, pts: [a, b, [-b[0], b[1]], [-a[0], a[1]]], c: [0, g.yb - 0.5] });
    }
    loft(rings, (i, j) => (j === 1 ? null : key), true);
  }
  /** overlay strip on the greenhouse top (roof/glass) between z0..z1, lateral fraction a..b of the half roof width (0 centre, 1 edge) */
  function ghTop(gh, key, z0, z1, a = 0.85, b = 1.0, off = 0.01, n = 6) {
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const z = z0 + ((z1 - z0) * k) / n, g = gh(z), y = (f) => g.yr + (g.yr > g.yb + 0.05 ? gh.cr * (1 - f) : 0) + off;
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
  function wheels(axles, o) { for (const az of axles) for (const s of [-1, 1]) wheel(s * o.x, o.r, az, o); }

  // ---------- small parts ----------
  /** door mirror on both sides: stalk + housing (+ glass facing back) */
  function mirrors(x, y, z, o = {}) {
    const k = o.key ?? 'Paint', w = o.w ?? 0.2, h = o.h ?? 0.12;
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

  /** police push bar in front of the nose: two uprights + cross bars */
  function pushbar(z, y0, y1, w = 0.42) {
    for (const s of [-1, 1]) { box('Plastic', s * w, (y0 + y1) / 2, z, 0.08, y1 - y0, 0.08); box('Plastic', s * w, y0 + 0.12, z - 0.18, 0.06, 0.06, 0.36); }
    box('Plastic', 0, y1 - 0.04, z, 2 * w + 0.08, 0.07, 0.07); box('Plastic', 0, y0 + 0.18, z, 2 * w + 0.08, 0.07, 0.07);
    box('Trim', 0, (y0 + y1) / 2, z + 0.02, 2 * w - 0.2, (y1 - y0) * 0.55, 0.04);
    for (const s of [-1, 1]) box('LightRed', s * (w - 0.18), (y0 + y1) / 2, z + 0.045, 0.1, 0.05, 0.02);
  }
  /** pillar-mounted spotlight (driver side) */
  function spotlight(x, y, z) { rod('Chrome', [x, y - 0.12, z], [x, y, z], 0.015, 5); box('Chrome', x + 0.03, y + 0.03, z + 0.04, 0.1, 0.1, 0.14); box('Clear', x + 0.03, y + 0.03, z + 0.115, 0.08, 0.08, 0.01); }
  return { pushbar, spotlight, archPoly, liner, bed, parts, push, pop, put, box, bx, sbox, rod, srod, sideExtrude, frontExtrude, tab, loft, body, greenhouse, ghSide, ghTop, bodySide, wheel, wheels, mirrors, handles, plate, grille, barX, lightbar, T };
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
      if (o.lines) for (const L of o.lines) if (Math.abs(n.x) > 0.3 && p.y > L.y0 && p.y < L.y1 && p.z > (L.z0 ?? -99) && p.z < (L.z1 ?? 99)) c = hex(L.c);
      const side = Math.abs(n.x) > 0.45, up = n.y > 0.45;
      if (side && p.y > sill && p.y < belt) for (const z of o.seams ?? []) if (Math.abs(p.z - z) < g) return gap;
      if (up && o.hood !== undefined && Math.abs(p.z - o.hood) < g) return gap;
      if (up && o.trunk !== undefined && Math.abs(p.z - o.trunk) < g) return gap;
      if (up && o.hoodSide && Math.abs(Math.abs(p.x) - o.hoodSide) < g && p.z > o.hood) return gap;
      // a soft highlight band along the shoulder, darker toward the rocker
      if (side) c = mul(c, 0.86 + 0.2 * Math.min(1, Math.max(0, (p.y - sill) / Math.max(0.1, belt - sill))));
      if (n.y < -0.3) c = mul(c, 0.55);
      return c;
    };
  }
  function plain(base, k = 0.04) { const b = hex(base); return (p) => mul(b, 1 - k / 2 + k * hash(Math.floor(p.x * 53 + p.z * 31), Math.floor(p.y * 47 + p.z * 11))); }
  function glass(o = {}) {
    const dark = hex(o.dark ?? '#0f141b'), sky = hex(o.sky ?? '#7f95ab'), mid = hex(o.mid ?? '#2a3645');
    return (p, n) => {
      const t = Math.max(0, Math.min(1, n.y * 0.8 + 0.25));
      let c = mix(dark, mid, t);
      const d = fr((p.z * 0.9 + p.y * 1.3 + p.x * 0.3) * 0.8);
      if (d > 0.1 && d < 0.17) c = mix(c, sky, 0.5);
      if (d > 0.22 && d < 0.24) c = mix(c, sky, 0.35);
      return c;
    };
  }
  /** headlight: chrome reflector bowls in a clear lens */
  function headlight(o = {}) { const a = hex(o.a ?? '#f4f6f8'), b = hex(o.b ?? '#aeb8c2'); return (p) => { const k = Math.abs(Math.sin(p.x * 26)) * Math.abs(Math.sin(p.y * 30)); return mix(b, a, Math.min(1, k * 1.4)); }; }
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
