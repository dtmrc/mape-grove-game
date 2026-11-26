// 2024 Ironside F-15 Summit SuperCrew (full-size pickup; counterpart: 2024 Ford F-150, 14th gen). Newest era.
// v4 from reference photos (refs/cars/f15_24): flat-faced nose with one black panel, bright bar through the oval into tall lamps
// framed by amber C-shaped light bars, chrome bumpers, crew cab with running boards, tall tail lamps with dark centres.
// 5.89 x 2.03 x 1.96 m, wheelbase 3.68 m, 275/60R20.
// eslint-disable-next-line no-unused-vars
function build_f15_24(K, P) {
  const r = 0.42, zf = 1.99, zr = -1.84, cab = -1.1;
  const Bd = K.body({
    top: [[cab, 1.38], [1.25, 1.38], [2.1, 1.355], [2.45, 1.335], [2.62, 1.295], [2.72, 1.23], [2.77, 1.1], [2.78, 0.84], [2.81, 0.82], [2.82, 0.66]],
    half: [[cab, 1.015], [2.2, 1.015], [2.4, 0.985], [2.55, 0.925], [2.66, 0.84], [2.74, 0.735], [2.795, 0.62], [2.82, 0.52]],   // fender fronts round inward toward the bumper and grille
    bottom: [[cab, 0.54], [2.6, 0.54], [2.82, 0.56]],
    sill: 0.54, floor: 0.44, tumble: 0.05, crown: 0.075, shoulder: 0.86,
    arches: [{ z: zf, r: r + 0.14, cy: r, sq: 0.98 }], inset: 0.32,
  });
  const gh = K.greenhouse(Bd, { st: [[1.25, null, 0.88], [0.56, 1.96, 0.8], [-0.99, 1.97, 0.8], [-1.04, 1.95, 0.8], [-1.065, 1.88, 0.81], [-1.07, null, 0.88]], roof: [1, 3], inset: 0.004, crown: 0.03 });
  // side glass from diet's photo (refs/cars/f15_24/windows-diet.png): wide gloss-black centre pillar, thin black surround, rear window with a cut top-rear corner,
  // and the front door glass dropping below the belt line toward the mirror
  const qb = (p0, p1, p2, n) => { const o = []; for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return o; };
  K.ghPoly(gh, 'Trim', [[0.5, 1], ...qb([0.5, 0.85], [0.9, 0.85], [1.04, 0], 16), [1.25, 0], [1.25, 1]], 0.008, 48);
  K.ghPoly(gh, 'Paint', [[0.5, 1], ...qb([0.5, 0.93], [0.945, 0.93], [1.085, 0], 16), [1.25, 0], [1.25, 1]], 0.012, 48);
  K.ghPoly(gh, 'Plastic', [[0.9, 0], [0.9, 0.5], [0.94, 0.6], [1.1, 0.6], [1.1, 0]], 0.01, 24);
  K.ghSide(gh, 'Gloss', -0.31, -0.1, 0, 1.0);
  K.ghSide(gh, 'Paint', -1.07, -0.9, 0, 1.0);
  K.ghSide(gh, 'Paint', -1.0699, -1.03, 0, 1.0, 0.016, 28);
  K.ghSide(gh, 'Trim', -0.9, 0.2, 0, 0.075, 0.018);
  K.ghSide(gh, 'Trim', -0.9, -0.84, 0, 0.9, 0.018);
  K.ghSide(gh, 'Trim', -0.9, 0.66, 0.85, 0.93, 0.018);
  K.ghSide(gh, 'Paint', -0.92, 0.6, 0.93, 1.0, 0.019);
  const arc = (rz, rf, n) => { const o = []; for (let k = 0; k <= n; k++) { const t = (k / n) * Math.PI / 2; o.push([-0.68 - rz * Math.cos(t), 0.55 + rf * Math.sin(t)]); } return o; };
  K.ghPoly(gh, 'Trim', [[-0.86, 0.9], ...arc(0.16, 0.3, 12), [-0.68, 0.9]], 0.019, 28);
  K.ghPoly(gh, 'Paint', [[-0.91, 0.95], ...arc(0.22, 0.38, 12), [-0.68, 0.95]], 0.021, 28);
  K.ghTop(gh, 'Paint', 0.56, 1.25, 0.92, 1.0);
  { // cab rear from diet's photo (refs/cars/f15_24/cab-rear-diet.png), keeping the cab's own shape: thin body-colour surround laid on the rear glass
    // (header, pillars, sill), brake light centred in the header, two small roof markers
    const zAt = (y) => { let lo = -1.0699, hi = -1.04; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (gh(m).yr < y) lo = m; else hi = m; } return (lo + hi) / 2; };
    const g0 = gh(-1.04), zH = zAt(g0.yr - 0.062), zL = zAt(g0.yr - 0.04);
    const T = K.T, pos = [], S = (z, f) => { const g = gh(z); return [g.wr * f, gh.roofAt(g, Math.abs(f)) + 0.006, z - 0.012]; };
    const strip = (z0, z1, f0, f1, nz, nf) => { for (let k = 0; k < nz; k++) for (let j = 0; j < nf; j++) {
      const za = z0 + ((z1 - z0) * k) / nz, zb = z0 + ((z1 - z0) * (k + 1)) / nz, fa = f0 + ((f1 - f0) * j) / nf, fb = f0 + ((f1 - f0) * (j + 1)) / nf;
      const A = S(za, fa), B = S(za, fb), C = S(zb, fb), D = S(zb, fa); pos.push(...A, ...D, ...C, ...A, ...C, ...B); } };
    strip(zH, -1.03, -1, 1, 16, 12);
    for (const sd of [-1, 1]) { const gq = gh(-1.064), gE = gh(-1.0699), dx = gq.wb - gq.wr, dy = gq.yr - gq.yb, L = Math.hypot(dx, dy), nx = dy / L, ny = dx / L, zs = -1.06, zk = -1.084, N = 12;
      // one clean piece per rear corner: the cab side panel carries back past the corner, then a single flat panel closes it inward to the edge of the rear glass
      const yy = (f) => gq.yb - 0.012 + (g0.yr - 0.03 - gq.yb + 0.012) * f, xo = (f) => gq.wb + (gq.wr - gq.wb) * f + nx * 0.016, xi = (f) => gE.wr + (gq.wr * 0.985 - gE.wr) * f - 0.04;
      for (let k = 0; k < N; k++) { const f0 = k / N, f1 = (k + 1) / N, A = [sd * xo(f0), yy(f0), zs], B = [sd * xo(f1), yy(f1), zs], C = [sd * xo(f1), yy(f1), zk], D = [sd * xo(f0), yy(f0), zk], E = [sd * xi(f1), yy(f1), zk], F = [sd * xi(f0), yy(f0), zk];
        if (sd > 0) pos.push(...A, ...C, ...B, ...A, ...D, ...C, ...D, ...E, ...C, ...D, ...F, ...E); else pos.push(...A, ...B, ...C, ...A, ...C, ...D, ...D, ...C, ...E, ...D, ...E, ...F); } }
    K.bx('GlassFlat', -0.9, 1.37, cab - 0.004, 0.9, 1.462, -1.068);
    { // black framed sliding port in the middle of the rear window (diet's close-up, refs/cars/f15_24/cab-rear-port-diet.png)
      const rr = (hw, y0, y1, r) => { const q = new T.Shape(); q.moveTo(-hw + r, y0); q.lineTo(hw - r, y0); q.quadraticCurveTo(hw, y0, hw, y0 + r); q.lineTo(hw, y1 - r); q.quadraticCurveTo(hw, y1, hw - r, y1); q.lineTo(-hw + r, y1); q.quadraticCurveTo(-hw, y1, -hw, y1 - r); q.lineTo(-hw, y0 + r); q.quadraticCurveTo(-hw, y0, -hw + r, y0); return q; };
      const ya = g0.yb + 0.1, yc = g0.yr - 0.058, fr = rr(0.23, ya, yc, 0.045); fr.holes.push(rr(0.195, ya + 0.035, yc - 0.035, 0.025));
      K.put('Gloss', new T.ExtrudeGeometry(fr, { depth: 0.012, bevelEnabled: false, curveSegments: 5 }), [0, 0, -1.082]);
      K.bx('Trim', -0.23, yc - 0.03, zAt(g0.yr - 0.05) - 0.022, 0.23, g0.yr - 0.034, zAt(g0.yr - 0.05) + 0.01);   // black rectangle joining the port's top to the light assembly (diet's circle)
    }   // hides the body's crowned top edge that showed as a light line under the rear glass
    { const gq = new T.BufferGeometry(); gq.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); K.put('Paint', gq); }
    { // 8 mm black line round the inside of the body-colour surround (diet's sketch), kicking out from each top corner of the glass to the cab's top corner
      const gq = gh(-1.064), gE = gh(-1.0699), w = 0.016, zq = -1.0885, q = [], yT = g0.yr - 0.062, yBm = 1.462;
      const fAt = (y) => (y - gq.yb + 0.012) / (g0.yr - 0.03 - gq.yb + 0.012), xi = (y) => gE.wr + (gq.wr * 0.985 - gE.wr) * fAt(y) - 0.04;
      const seg = (x0, y0, x1, y1) => { const l = Math.hypot(x1 - x0, y1 - y0), nx = (-(y1 - y0) / l) * w / 2, ny = ((x1 - x0) / l) * w / 2, A = [x0 + nx, y0 + ny, zq], B = [x1 + nx, y1 + ny, zq], C = [x1 - nx, y1 - ny, zq], D = [x0 - nx, y0 - ny, zq];
        q.push(...A, ...B, ...C, ...A, ...C, ...D, ...A, ...C, ...B, ...A, ...D, ...C); };
      const xT = xi(yT) + w / 2, xB = xi(yBm) + w / 2;
      seg(-xT - w / 2, yT + w / 2, xT + w / 2, yT + w / 2); seg(-xB - w / 2, yBm + w / 2, xB + w / 2, yBm + w / 2);
      for (const sd of [-1, 1]) { seg(sd * xB, yBm, sd * xT, yT); seg(sd * xT, yT + w / 2, sd * (gq.wr + 0.006), g0.yr - 0.004); }
      const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(q, 3)); K.put('Trim', gg);
    }
    { // high brake light assembly from diet's photo: grey housing at the top of the header, red centre lamp, clear cargo lamp each side
      const zl = zAt(g0.yr - 0.012) - 0.012, y0 = g0.yr - 0.03, y1 = g0.yr + 0.012;
      K.bx('Steel', -0.24, y0 - 0.006, zl - 0.014, 0.24, y1 + 0.008, zl + 0.03);
      K.bx('Tail', -0.1, y0, zl - 0.02, 0.1, y1, zl + 0.01);
      for (const sd of [-1, 1]) K.bx('Clear', sd * 0.115, y0, zl - 0.019, sd * 0.225, y1, zl + 0.01);
    }
    for (const sd of [-1, 1]) K.bx('Trim', sd * 0.42, gh.roofAt(gh(-0.97), 0.6) - 0.004, -1.0, sd * 0.49, gh.roofAt(gh(-0.97), 0.6) + 0.022, -0.94);
  }
  { // one smooth swept bar along each windshield edge so the pillar reads as a single clean body-colour piece, plus a filler where its base meets the door
    const T = K.T, N = 22, M = 10, pos = [], sm = (q) => { q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); };
    const e = (z) => { const g = gh(z); return new T.Vector3(g.wr - 0.014, g.yr - 0.008 - 0.04 * (1 - sm((z - 0.42) / 0.34)), z); };   // sinks into the roof toward its top end so the roofline stays smooth
    for (const sd of [-1, 1]) {
      const rings = [];
      for (let k = 0; k <= N; k++) {
        const z = 0.26 + (0.975 * k) / N, c = e(z), t = e(z + 0.01).sub(e(z - 0.01)).normalize(), u = new T.Vector3(1, 0, 0), v = new T.Vector3().crossVectors(t, u).normalize();
        const r = 0.02 + 0.022 * sm((z - 0.26) / 0.2), ring = [];
        for (let m = 0; m < M; m++) { const a = (m / M) * Math.PI * 2, q = c.clone().addScaledVector(u, Math.cos(a) * r * 0.85).addScaledVector(v, Math.sin(a) * r * 1.15); ring.push([sd * q.x, q.y, q.z]); }
        rings.push(ring);
      }
      for (let k = 0; k < N; k++) for (let m = 0; m < M; m++) {
        const a = rings[k][m], b = rings[k][(m + 1) % M], c = rings[k + 1][(m + 1) % M], d = rings[k + 1][m];
        if (sd > 0) pos.push(...a, ...b, ...c, ...a, ...c, ...d); else pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); K.put('Paint', g);
  }
  { // dropped belt line: the front door glass carries on down the door side as one smooth outline, continuing the pillar's slope at the front and sweeping gently back up to the belt
    const T = K.T, pos = { GlassFlat: [], Trim: [] }, yB = 1.384;
    let o = [[1.04, 0], [1.062, -0.05], [1.058, -0.092], [1.0, -0.1], [0.56, -0.1], [0.4, -0.088], [0.25, -0.03], [0.14, 0]];
    for (let it = 0; it < 4; it++) { const q = [o[0]]; for (let i = 0; i < o.length - 1; i++) { const a = o[i], b = o[i + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(o[o.length - 1]); o = q; }
    const N = o.length - 1, out = o.map((q, i) => { const a = o[Math.max(0, i - 1)], b = o[Math.min(N, i + 1)], dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy) || 1; return [q[0] + (dy / L) * 0.016, q[1] - (dz / L) * 0.016]; });
    const P = (z, dy, off, sd) => [sd * (Bd.wAt(z, yB + dy) + off), yB + dy, z];
    for (const sd of [-1, 1]) for (let k = 0; k < N; k++) {
      const quad = (key, A0, A1, B0, B1, off) => { const a = P(A0[0], A0[1], off, sd), b = P(B0[0], B0[1], off, sd), c = P(B1[0], B1[1], off, sd), d = P(A1[0], A1[1], off, sd);
        if (sd > 0) pos[key].push(...a, ...c, ...b, ...a, ...d, ...c); else pos[key].push(...a, ...b, ...c, ...a, ...c, ...d); };
      const top = (i) => [1.04 - (0.9 * i) / N, 0.004], mid = (i) => [(top(i)[0] + o[i][0]) / 2, o[i][1] / 2];
      quad('GlassFlat', o[k], mid(k), o[k + 1], mid(k + 1), 0.007); quad('GlassFlat', mid(k), top(k), mid(k + 1), top(k + 1), 0.007);
      quad('Trim', out[k], o[k], out[k + 1], o[k + 1], 0.009);
    }
    pos.Plastic = [];
    for (const sd of [-1, 1]) { const f = o.filter((q) => q[0] >= 0.9), c = [0.985, -0.04], ring = [[1.04, 0.004], ...f, [0.9, f[f.length - 1][1]], [0.9, 0.004]];
      for (let k = 0; k < ring.length; k++) { const A = P(c[0], c[1], 0.0082, sd), B = P(ring[k][0], ring[k][1], 0.0082, sd), C = P(ring[(k + 1) % ring.length][0], ring[(k + 1) % ring.length][1], 0.0082, sd);
        if (sd > 0) pos.Plastic.push(...A, ...C, ...B); else pos.Plastic.push(...A, ...B, ...C); } }
    for (const k in pos) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos[k], 3)); K.put(k, g); }
    for (const sd of [-1, 1]) K.bx('GlassFlat', sd * 0.86, 1.376, 0.16, sd * (Bd.half(0.8) - Bd.tm + 0.004), 1.39, 1.04);
  }
  { // bed: sides share the cab's cross-section (flush, same rolled-in top edge), rounded front corners, inset rail cap
    const T = K.T, R = 0.09, zb = cab - 0.025 - R, z0 = -2.945, wi = 0.965, yT = 1.38, A = { z: zr, r: r + 0.14, cy: r };
    K.bed({ z0, z1: zb, sill: 0.54, floor: 1.04, top: yT, w: wi, arch: A });
    const prof = (y) => Bd.wAt(cab + 0.02, y), ys = [1.262, 1.321, yT];
    const yLo = 0.62, yb = (z) => { const d = z - A.z; return Math.abs(d) < A.r ? Math.max(yLo, A.cy + Math.sqrt(A.r * A.r - d * d)) : yLo; };
    const cols = []; for (let k = 0; k <= 90; k++) cols.push([z0 + ((zb - z0) * k) / 90, 0]);
    for (let k = 1; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; cols.push([zb + R * Math.sin(a), R * (1 - Math.cos(a))]); }
    const pt = (c, m, sd) => { const y = m === 0 ? yb(c[0]) : ys[m - 1]; return [sd * (prof(y) - c[1]), y, c[0]]; }, pos = [];
    for (const sd of [-1, 1]) {
      for (let k = 0; k < cols.length - 1; k++) for (let m = 0; m < 3; m++) {
        const a = pt(cols[k], m, sd), b = pt(cols[k + 1], m, sd), c = pt(cols[k + 1], m + 1, sd), d = pt(cols[k], m + 1, sd);
        if (sd > 0) pos.push(...a, ...c, ...b, ...a, ...d, ...c); else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
      for (let m = 0; m < 3; m++) {   // close the tail end between the skin and the inner wall
        const a = pt(cols[0], m, sd), d = pt(cols[0], m + 1, sd), b = [sd * (wi - 0.03), a[1], z0], c = [sd * (wi - 0.03), d[1], z0];
        pos.push(...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c);
      }
      const roll = [[0, yLo], [0.006, 0.585], [0.024, 0.555], [0.05, 0.538], [0.1, 0.532]];   // the bed side's bottom edge rolls under instead of ending in a sharp corner
      for (let k = 0; k < cols.length - 1; k++) { if (yb(cols[k][0]) > yLo + 1e-6 || yb(cols[k + 1][0]) > yLo + 1e-6) continue;
        for (let m = 0; m < roll.length - 1; m++) { const q = (c, i) => [sd * (prof(yLo) - c[1] - roll[i][0]), roll[i][1], c[0]], a = q(cols[k], m + 1), b = q(cols[k + 1], m + 1), c = q(cols[k + 1], m), d = q(cols[k], m);
          if (sd > 0) pos.push(...a, ...c, ...b, ...a, ...d, ...c); else pos.push(...a, ...b, ...c, ...a, ...c, ...d); } }
      const th = sd > 0 ? 0 : Math.PI * 1.5;
      K.put('Trim', new T.CylinderGeometry(R, R, 0.035, 8, 1, false, th, Math.PI / 2), [sd * (wi - R), yT + 0.0175, zb]);
      K.bx('Trim', sd * wi, yT, z0 - 0.01, sd * (wi - 0.1), yT + 0.035, zb);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); K.put('Paint', g);
    K.bx('Paint', -(wi - R), 0.54, zb - 0.02, wi - R, yT, zb + R);
    K.bx('Trim', -(wi - R), yT, zb - 0.02, wi - R, yT + 0.035, zb + R);
    K.bx('Under', -0.9, 0.5, cab - 0.06, 0.9, 1.375, cab + 0.04);   // dark filler so the cab/bed gap reads as one thin clean line
  }
  K.hoodDome(Bd, { z0: 1.3, z1: 2.74, w: 0.645, h: 0.04, round: 0.12, corner: 0.1, fade: 0.42, kick: [0.29, 0.5], bevel: 0.07, n: 44 });   // raised hood centre with a visible edge, rounded at the front
  { // hood shut line (diet's photo, refs/cars/f15_24/hood-diet.png): hood/fender seam along each shoulder from the windshield corner to the lamp top, then the hood's front edge sitting on the lamps and grille
    const T = K.T, wd = 0.004, pos = [], yF = 1.2275, path = [];
    const xs = (z) => Bd.half(z) - Bd.tm - 0.03;
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c);
    const zR = 1.325, rc = 0.22, dome = (x, z) => { const kq = Math.max(0, 1 - (z - 1.3) / 0.5); return z < 1.3 ? 0 : 0.043 * Math.max(0, Math.min(1, (0.715 + 0.29 * kq * kq - x) / 0.07)); };   // rear: the seam curves inward round the windshield corner and runs along the cowl
    for (let z = zR + rc; z <= 2.8; z += 0.03) { path.push([xs(z), z]); if (K.topAt(Bd, z, xs(z)) < yF + 0.03) break; }
    const xe = path[path.length - 1][0];
    for (const sd of [-1, 1]) {
      for (let k = 0; k < path.length - 1; k++) {
        const [x0, z0] = path[k], [x1, z1] = path[k + 1], P = (x, z) => [sd * x, K.topAt(Bd, z, x) + 0.008 + dome(x, z), z];
        quad(P(x0 - wd / 2, z0), P(x0 + wd / 2, z0), P(x1 + wd / 2, z1), P(x1 - wd / 2, z1));
      }
      const rear = [[0, zR]]; for (let k = 0; k <= 8; k++) { const t = (k / 8) * Math.PI / 2; rear.push([xs(zR + rc) - rc * (1 - Math.sin(t)), zR + rc * (1 - Math.cos(t))]); }
      for (let k = 0; k < rear.length - 1; k++) {
        const [x0, z0] = rear[k], [x1, z1] = rear[k + 1], l = Math.hypot(x1 - x0, z1 - z0), nx = ((z1 - z0) / l) * wd / 2, nz = (-(x1 - x0) / l) * wd / 2, P = (x, z) => [sd * x, K.topAt(Bd, z, x) + 0.008 + dome(x, z), z];
        quad(P(x0 - nx, z0 - nz), P(x0 + nx, z0 + nz), P(x1 + nx, z1 + nz), P(x1 - nx, z1 - nz));
      }
      const N = 44, F = (x, y) => [sd * x, y, K.faceAtX(Bd, x, y) + 0.012], yL = (x) => Math.max(1.2145, yF - Math.max(0, x - 0.535));   // follows the grille's bevelled top corner, then the lamp top
      for (let k = 0; k < N; k++) { const xa = (xe + 0.01) * (k / N), xb = (xe + 0.01) * ((k + 1) / N); quad(F(xa, yL(xa) - wd / 2), F(xa, yL(xa) + wd / 2), F(xb, yL(xb) + wd / 2), F(xb, yL(xb) - wd / 2)); }
      const [xl, zl] = path[path.length - 1], A = [sd * xl, K.topAt(Bd, zl, xl) + 0.007, zl], B = F(xe + 0.01, yL(xe + 0.01));   // join the seam to the front edge
      quad([A[0] - sd * wd / 2, A[1], A[2]], [A[0] + sd * wd / 2, A[1], A[2]], [B[0] + sd * wd / 2, B[1], B[2]], [B[0] - sd * wd / 2, B[1], B[2]]);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); K.put('Trim', g);
  }
  // nose: one black panel across the flat face; a bright bar runs through the oval into tall lamps framed by amber C-shaped light bars
  const F = Bd.z1;
  const gC = (x) => Math.max(0, x - 0.535);   // 45 degree bevel on the grille's four outer corners
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.625, y0: (u) => 0.86 + gC(u * 0.625), y1: (u) => 1.225 - gC(u * 0.625), off: 0.008, n1: 25, rows: 3 });
  const gR = (u) => { const q = Math.max(0, (u - 0.72) / 0.28); return 0.15 * (1 - Math.sqrt(Math.max(0, 1 - q * q))); };   // rounded grille ends beside the lamps
  K.wrap(Bd, 'Mesh', { x0: 0, x1: 0.61, y0: (u) => 0.88 + gC(u * 0.61 + 0.012), y1: (u) => 1.205 - gC(u * 0.61 + 0.012), off: 0.012, n1: 61, rows: 2 });
  // grille traced from diet's photo (refs/cars/f15_24/grille-diet.png): black mesh, a wide grey centre band that carries the oval and runs out into the lamp squares,
  // a black slot through the band, and a thinner grey bar above and below
  K.wrap(Bd, 'Steel', { x0: 0, x1: 0.63, y0: 0.985, y1: 1.125, off: 0.024, n1: 16, rows: 2 });
  K.wrap(Bd, 'Gloss', { x0: 0.19, x1: 0.55, y0: 1.04, y1: 1.07, off: 0.029, n1: 10, rows: 1 });
  K.wrap(Bd, 'Steel', { x0: 0, x1: 0.525, y0: 1.158, y1: 1.198, off: 0.026, n1: 14, rows: 1 });
  K.wrap(Bd, 'Steel', { x0: 0, x1: 0.525, y0: 0.905, y1: 0.945, off: 0.026, n1: 14, rows: 1 });
  { // blue oval badge with a chrome ring, centred on the grille bar
    const T = K.T, bz = K.faceAt(Bd, 1.05) + 0.03, ov = (w, h, d) => { const g = new T.CylinderGeometry(1, 1, d, 24); g.rotateX(Math.PI / 2); g.scale(w / 2, h / 2, 1); return g; };
    K.put('Chrome', ov(0.3, 0.125, 0.02), [0, 1.05, bz - 0.004]); K.put('Badge', ov(0.265, 0.095, 0.024), [0, 1.05, bz]);
  }
  { // headlights traced from diet's photo (refs/cars/f15_24/headlight-diet.png). f = fraction along the lamp from its grille edge round the corner, t = fraction down from its top.
    // dark frame whose outer end is shorter at the bottom; a body-colour ring with a mesh window pushes in from the grille; then an upright amber strip and three bright lenses
    const T = K.T, yT = 1.21, H = 0.285, xA = 0.6, xB = 0.965, pos = {}, N = 48, ym = 1.06;
    const xs = [], ls = [0]; for (let k = 0; k <= N; k++) xs.push(xA + ((xB - xA) * k) / N);
    const zm = xs.map((x) => K.faceAtX(Bd, x, ym)); for (let k = 1; k <= N; k++) ls.push(ls[k - 1] + Math.hypot(xs[k] - xs[k - 1], zm[k] - zm[k - 1]));
    const at = (f) => { const L = Math.max(0, Math.min(1, f)) * ls[N]; let k = 1; while (k < N && ls[k] < L) k++; const u = (L - ls[k - 1]) / Math.max(1e-6, ls[k] - ls[k - 1]); const x = xs[k - 1] + (xs[k] - xs[k - 1]) * u + (f < 0 ? f * ls[N] : 0);
      const tx = xs[k] - xs[k - 1], tz = zm[k] - zm[k - 1], l = Math.hypot(tx, tz) || 1; return { x, nx: -tz / l, nz: tx / l }; };
    const P = (f, t, off, sd) => { const a = at(f), y = yT - H * t; return [sd * (a.x + a.nx * off), y, K.faceAtX(Bd, a.x, y) + a.nz * off]; };
    const piece = (key, f0, f1, t0, t1, off, n = 6) => {
      const A = (pos[key] = pos[key] || []), tf0 = typeof t0 === 'function' ? t0 : () => t0, tf1 = typeof t1 === 'function' ? t1 : () => t1;
      for (const sd of [-1, 1]) for (let k = 0; k < n; k++) for (let m = 0; m < 3; m++) {
        const fa = f0 + ((f1 - f0) * k) / n, fb = f0 + ((f1 - f0) * (k + 1)) / n, ta = (f, q) => tf0(f) + (tf1(f) - tf0(f)) * q;
        const a = P(fa, ta(fa, m / 3), off, sd), b = P(fb, ta(fb, m / 3), off, sd), c = P(fb, ta(fb, (m + 1) / 3), off, sd), d = P(fa, ta(fa, (m + 1) / 3), off, sd);
        if (sd < 0) A.push(...a, ...b, ...c, ...a, ...c, ...d); else A.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    };
    const bot = (f) => (f < 0.8 ? 1 : f < 0.85 ? 1 - ((f - 0.8) / 0.05) * 0.48 : 0.52 - ((f - 0.85) / 0.15) * 0.3);   // frame bottom: full height, then steps up toward the outer end
    piece('Gloss', 0, 1, 0, bot, 0.012, 20);
    piece('Gloss', -0.14, 0, 0, (f) => 0.17 * (f + 0.14) / 0.14, 0.012, 4);   // top inner corner leans in over the grille's bevel
    piece('Clear', -0.09, 0, 0.05, (f) => 0.05 + 0.12 * (f + 0.09) / 0.09, 0.02, 3);
    piece('Steel', -0.07, 0.41, 0.3, 0.79, 0.03, 8);           // grey square: the end of the grille's centre band
    piece('Mesh', 0.045, 0.28, 0.4, 0.69, 0.034, 5);          // its mesh window
    piece('Amber', 0.435, 0.53, 0.3, 0.79, 0.02, 2);
    piece('Clear', 0.56, 0.97, 0.06, (f) => Math.min(0.33, bot(f) - 0.05), 0.02, 10);   // upper lens, runs out to the corner
    piece('Head', 0.57, 0.79, 0.4, 0.64, 0.02, 4);             // main lens
    piece('Clear', 0.57, 0.79, 0.7, 0.94, 0.02, 4);            // lower reflector
    piece('Clear', 0.0, 0.56, 0.05, 0.26, 0.02, 8);           // top light carries on above the ring to its inner edge
    piece('Clear', 0.0, 0.57, 0.83, 0.94, 0.02, 8);           // bottom light carries on under the ring to its inner edge
    for (const k in pos) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos[k], 3)); K.put(k, g); }
  }
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.44, y0: 0.36, y1: (u) => 0.6 - (u > 1 ? (u - 1) * 0.04 : 0), off: -0.012, n1: 8, n2: 6, rows: 3 });   // black front valance under the bumper
  K.wrap(Bd, 'Grille', { x0: 0.12, x1: 0.46, y0: 0.42, y1: 0.5, off: -0.004, n1: 3, rows: 1 });
  { // front bumper from diet's photo (refs/cars/f15_24/bumper-diet.png): body colour, a black line along its top that sits under the grille
    // and steps up under the headlights, a dark fog lamp pocket each side, and a wide dark centre opening with grey inserts round the plate
    const T = K.T, pos = {}, yLn = (x) => 0.845 + 0.06 * Math.max(0, Math.min(1, (x - 0.5) / 0.09));
    const Pt = (x, y, off) => { const e = 0.03, z = K.faceAtX(Bd, x, y), dz = K.faceAtX(Bd, x + e, y) - K.faceAtX(Bd, Math.max(0, x - e), y), dx = x < e ? e : 2 * e, l = Math.hypot(dx, dz) || 1; return [x + (-dz / l) * off, y, z + (dx / l) * off]; };
    const strip = (key, xa, xb, y0, y1, off, n) => {
      const A = (pos[key] = pos[key] || []), f0 = typeof y0 === 'function' ? y0 : () => y0, f1 = typeof y1 === 'function' ? y1 : () => y1;
      for (const sd of [-1, 1]) for (let k = 0; k < n; k++) for (let m = 0; m < 2; m++) {
        const x0 = xa + ((xb - xa) * k) / n, x1 = xa + ((xb - xa) * (k + 1)) / n, yy = (x, q) => f0(x) + (f1(x) - f0(x)) * q, M = (v) => [sd * v[0], v[1], v[2]];
        const a = M(Pt(x0, yy(x0, m / 2), off)), b = M(Pt(x1, yy(x1, m / 2), off)), c = M(Pt(x1, yy(x1, (m + 1) / 2), off)), d = M(Pt(x0, yy(x0, (m + 1) / 2), off));
        if (sd > 0) A.push(...a, ...b, ...c, ...a, ...c, ...d); else A.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    };
    strip('Paint', 0, 0.93, 0.58, (x) => yLn(x) - 0.007, 0.014, 40);
    strip('Trim', 0, 0.93, (x) => yLn(x) - 0.007, (x) => yLn(x) + 0.007, 0.018, 60);
    strip('Trim', 0.62, 0.84, 0.66, 0.78, 0.019, 8); strip('Clear', 0.7, 0.79, 0.69, 0.75, 0.024, 3);   // fog lamp pocket
    strip('Trim', 0, 0.53, 0.6, 0.715, 0.019, 16); strip('Plastic', 0.3, 0.5, 0.615, 0.7, 0.024, 6);     // centre opening + grey inserts
    for (const k in pos) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos[k], 3)); K.put(k, g); }
  }
  K.plate(0, 0.66, K.faceAt(Bd, 0.66) + 0.034, true);
  { // rear end from diet's photo (refs/cars/f15_24/tail-diet.png): black top cap with a trapezoid handle bezel, stamped upper band and F-150 lettering, black oval,
    // tall red lamps wrapping the corners, and a rounded bumper: body-colour outer sections, black step pad on top, black centre with the plate
    const T = K.T, zt = -2.945, xo = Bd.wAt(cab + 0.02, 1.0), pos = { Paint: [], Plastic: [] };
    K.bx('Trim', -0.965, 1.36, zt - 0.01, 0.965, 1.415, zt + 0.07);   // top cap level with the bed rails, same height, width and rear face
    { const sh = new T.Shape([[-0.26, 1.375], [0.26, 1.375], [0.2, 1.245], [-0.2, 1.245]].map((q) => new T.Vector2(q[0], q[1]))); K.put('Trim', new T.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), [0, 0, zt - 0.024]); }
    K.bx('Plastic', -0.13, 1.275, zt - 0.03, 0.13, 1.33, zt - 0.02);
    for (const sd of [-1, 1]) { const sh = new T.Shape([[0.28, 1.335], [0.87, 1.335], [0.87, 1.235], [0.34, 1.235], [0.3, 1.2], [0.22, 1.2], [0.22, 1.215]].map((q) => new T.Vector2(sd * q[0], q[1]))); K.put('Paint', new T.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }), [0, 0, zt - 0.01]); }
    K.bx('Paint', -0.87, 0.76, zt - 0.01, 0.87, 0.81, zt + 0.01);
    { const ov = (w, h, d) => { const g = new T.CylinderGeometry(1, 1, d, 24); g.rotateX(Math.PI / 2); g.scale(w / 2, h / 2, 1); return g; };
      K.put('Chrome', ov(0.3, 0.125, 0.02), [0, 1.1, zt - 0.006]); K.put('Gloss', ov(0.262, 0.095, 0.024), [0, 1.1, zt - 0.008]); }
    { const seg = { a: [0, 1, 1, 1], b: [1, 0.5, 1, 1], c: [1, 0, 1, 0.5], d: [0, 0, 1, 0], e: [0, 0, 0, 0.5], f: [0, 0.5, 0, 1], g: [0, 0.5, 1, 0.5] };
      const gl = [['F', 'aefg'], ['-', 'g'], ['1', 'bc'], ['5', 'afgcd'], ['0', 'abcdef']], gw = 0.15, gh2 = 0.11, st = 0.024, gap = 0.05, x0 = -(gl.length * gw + (gl.length - 1) * gap) / 2;
      gl.forEach(([ch, on], i) => { const gx = x0 + i * (gw + gap); for (const c of on) { const q = seg[c], xa = gx + q[0] * gw, xb = gx + q[2] * gw, ya = 0.86 + q[1] * gh2, yb2 = 0.86 + q[3] * gh2;
        K.bx('Paint', -(Math.min(xa, xb) - (ch === '-' ? -0.03 : st / 2)), Math.min(ya, yb2) - st / 2, zt - 0.009, -(Math.max(xa, xb) + (ch === '-' ? -0.03 : st / 2)), Math.max(ya, yb2) + st / 2, zt + 0.01); } }); }
    for (const sd of [-1, 1]) {
      K.bx('Tail', sd * 0.895, 0.82, zt - 0.014, sd * (xo + 0.007), 1.2, zt + 0.1);
      K.bx('Gloss', sd * 0.925, 0.9, zt - 0.02, sd * 0.96, 1.15, zt + 0.01);
      K.bx('Tail', sd * 0.9, 1.2, zt - 0.014, sd * (xo + 0.007), 1.24, zt + 0.06);
      K.bx('Trim', sd * 0.884, 0.72, zt - 0.006, sd * 0.892, 1.355, zt + 0.01);
    }
    K.bx('Steel', -0.89, 0.72, zt - 0.004, 0.89, 0.74, zt + 0.02);
    // bumper: one profile swept along the tail and round each corner
    const zc0 = zt - 0.005, xs = 0.86, R0 = 0.05, prf = [[0, 0.72], [0.085, 0.72], [0.112, 0.703], [0.12, 0.66], [0.12, 0.54], [0.108, 0.49], [0.075, 0.465], [0, 0.46]], wC = [0.34, 0.34, 0.345, 0.36, 0.42, 0.45, 0.47, 0.47];
    const outer = (m) => { const o = [[wC[m], zc0, 0, -1], [xs, zc0, 0, -1]]; for (let k = 1; k <= 8; k++) { const t = (k / 8) * Math.PI / 2; o.push([xs + R0 * Math.sin(t), zc0 + R0 - R0 * Math.cos(t), Math.sin(t), -Math.cos(t)]); } o.push([xs + R0, zc0 + R0 + 0.2, 1, 0]); return o; };
    const V = (c, m, sd) => [sd * (c[0] + c[2] * prf[m][0]), prf[m][1], c[1] + c[3] * prf[m][0]];
    for (const sd of [-1, 1]) {
      for (let m = 0; m < prf.length - 1; m++) {
        const A = outer(m), B = outer(m + 1), key = m < 2 ? 'Plastic' : 'Paint';
        for (let k = 0; k < A.length - 1; k++) { const a = V(A[k], m, sd), b = V(A[k + 1], m, sd), c = V(B[k + 1], m + 1, sd), d = V(B[k], m + 1, sd);
          if (sd > 0) pos[key].push(...a, ...b, ...c, ...a, ...c, ...d); else pos[key].push(...a, ...c, ...b, ...a, ...d, ...c); }
        const a = V([0, zc0, 0, -1], m, sd), b = V(A[0], m, sd), c = V(B[0], m + 1, sd), d = V([0, zc0, 0, -1], m + 1, sd);
        if (sd > 0) pos.Plastic.push(...a, ...b, ...c, ...a, ...c, ...d); else pos.Plastic.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
      const e = outer(0)[10], cap = prf.map((q, m) => V(e, m, sd));
      for (let m = 1; m < cap.length - 1; m++) pos.Paint.push(...cap[0], ...cap[m], ...cap[m + 1], ...cap[0], ...cap[m + 1], ...cap[m]);
    }
    for (const k in pos) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos[k], 3)); K.put(k, g); }
    K.bx('Under', -0.9, 0.46, zt - 0.005, 0.9, 0.72, zt + 0.1);
    K.bx('Trim', -0.29, 0.515, zt - 0.13, 0.29, 0.675, zt - 0.1);
    K.plate(0, 0.595, zt - 0.134, false);
    K.bx('Under', -0.05, 0.38, zt - 0.1, 0.05, 0.45, zt + 0.1);
  }
  K.archLips(Bd, 'Paint', { arches: [{ z: zr, r: r + 0.14, cy: r }], t: 0.085, gap: -0.02, y0: 0.61, flat: 0.5, x: 1.015, off: -0.004 });
  { // front flares: same lip, but each vertex follows the fender as it rounds inward at the front
    const T = K.T, R = r + 0.14 - 0.02 + 0.085, a0 = Math.asin((0.56 - r) / R);
    for (const sd of [-1, 1]) {
      const lip = new T.TorusGeometry(R, 0.085, 4, 20, Math.PI - 2 * a0); lip.rotateZ(a0); lip.scale(1, 1, 0.5); lip.rotateY(Math.PI / 2);
      const p = lip.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + sd * (Bd.half(Math.min(2.8, zf + p.getZ(i))) - 1.015));
      K.put('Paint', lip, [sd * 1.011, r, zf]);
    }
  }   // slight body-colour bulge round each wheel well
  K.handles(Bd, [0.46, -0.54], 1.25, { key: 'Paint', l: 0.18, h: 0.045 });
  { // door mirrors from diet's photos (refs/cars/f15_24/mirror-diet.png): black arm from the D panel, bevelled rectangular body-colour housing
    // with a black C band, a white C loop round the arm end, a clear signal on the outer edge and the mirror glass in a black surround on the back
    const T = K.T, zc = 0.985, y0 = 1.3, x0 = Bd.wAt(zc, 1.38), xh = x0 + 0.09, zF = zc + 0.05, zB = zc - 0.05, W = 0.25, H = 0.2;
    for (const sd of [-1, 1]) {
      const X = (u) => sd * (xh + u), rect = (m) => new T.Shape([[m, m], [W - m, m], [W - m, H - m], [m, H - m]].map((q) => new T.Vector2(X(q[0]), y0 + q[1])));
      let g = [[0.36, 0], [1, 0], [1, 0.96], [0, 1], [0, 0.5]];
      for (let it = 0; it < 2; it++) { const q = []; for (let k = 0; k < g.length; k++) { const A = g[k], B = g[(k + 1) % g.length]; q.push([A[0] * 0.9 + B[0] * 0.1, A[1] * 0.9 + B[1] * 0.1], [A[0] * 0.1 + B[0] * 0.9, A[1] * 0.1 + B[1] * 0.9]); } g = q; }
      const glass = (m) => new T.Shape(g.map((q) => new T.Vector2(X(m + q[0] * (W - 2 * m)), y0 + m + q[1] * (H - 2 * m))));
      K.put('Paint', new T.ExtrudeGeometry(glass(0.02), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }), [0, 0, zc - 0.03]);
      K.bx('Plastic', sd * (x0 - 0.01), y0 + 0.08, zc - 0.02, X(0.12), y0 + 0.135, zF - 0.004);
      const uShape = (u0, u1, v0, v1, r, ul, vl) => { const q = [[ul, v0]]; for (let k = 0; k <= 8; k++) { const t = (k / 8) * Math.PI / 2; q.push([u1 - r + r * Math.sin(t), v0 + r - r * Math.cos(t)]); }
        for (let k = 0; k <= 8; k++) { const t = (k / 8) * Math.PI / 2; q.push([u1 - r + r * Math.cos(t), v1 - r + r * Math.sin(t)]); } q.push([u0, v1], [u0, vl]);
        return new T.Shape(q.map((c) => new T.Vector2(X(c[0]), y0 + c[1]))); };
      K.put('Gloss', new T.ExtrudeGeometry(uShape(0.024, 0.214, 0.034, 0.168, 0.04, 0.085, 0.105), { depth: 0.013, bevelEnabled: false }), [0, 0, zF - 0.01]);
      K.put('Paint', new T.ExtrudeGeometry(uShape(0.024, 0.178, 0.06, 0.142, 0.024, 0.062, 0.118), { depth: 0.019, bevelEnabled: false }), [0, 0, zF - 0.01]);
      K.bx('Plastic', X(-0.03), y0 + 0.08, zF - 0.012, X(0.156), y0 + 0.125, zF + 0.013);
      K.bx('Clear', X(W - 0.02), y0 + 0.03, zc + 0.005, X(W + 0.003), y0 + 0.1, zF - 0.012);
      K.put('Trim', new T.ExtrudeGeometry(glass(0.014), { depth: 0.012, bevelEnabled: false }), [0, 0, zB - 0.006]);
      K.put('Mirror', new T.ExtrudeGeometry(glass(0.028), { depth: 0.012, bevelEnabled: false }), [0, 0, zB - 0.01]);
    }
  }
  for (const s of [-1, 1]) K.box('Trim', s * 1.05, 0.52, -0.1, 0.14, 0.05, 1.7);
  K.wheels([zf, zr], { x: 0.865, r, w: 0.3, rim: 0.64, style: 'spoke', spokes: 6, split: true, rimKey: 'Chrome' });
  return vMats(P, { body: '#c9ced3', clad: '#1a1b1d', steel: '#74777c', paint: { seams: [1.22, -0.16, -1.0], hood: 1.25, belt: 1.35, sill: 0.6 } });
}
