// 2004 Delmont Tahoma (full-size SUV; counterpart: 2000-06 Chevrolet Tahoe, GMT800). Old era. o.police -> PPV.
// Run 2 (2026-11-25): outline, glass, pillars, arches and lamps measured off a 2006 Tahoe side blueprint (refs side-bp-b.jpg).
// v4 from reference photos (refs/cars/tahoma04): blunt tall nose with two stacked lamp rows split by a bright bar that carries the
// gold emblem across the grille, chrome bumper over a grey valance, boxy glassy body with roof rails and running boards, body
// moulding, tall slim tail lamps beside the liftgate, chrome step bumper, polished 5-spoke alloys.
// 5.05 x 2.0 x 1.9 m, wheelbase 2.946 m, 265/70R16.
// eslint-disable-next-line no-unused-vars
function build_tahoma04(K, P, o = {}) {
  const r = 0.385, zf = 1.595, zr = -1.35, br = o.police ? 'Trim' : 'Chrome';
  const Bd = K.body({
    top: [[-2.446, 0.52], [-2.442, 0.685], [-2.35, 0.685], [-2.31, 0.7], [-2.3, 1.196], [-2.28, 1.28], [-2.03, 1.3], [-1.78, 1.3], [-1.53, 1.3], [-1.28, 1.298], [-1.03, 1.277], [-0.78, 1.272], [-0.53, 1.269], [-0.28, 1.265], [-0.03, 1.252], [0.22, 1.246], [0.47, 1.241], [0.72, 1.243], [0.97, 1.245], [1.17, 1.255], [1.2, 1.244], [1.35, 1.252], [1.55, 1.233], [1.75, 1.22], [1.95, 1.196], [2.15, 1.158], [2.25, 1.13], [2.3, 1.105], [2.345, 1.078], [2.365, 0.9], [2.37, 0.76], [2.44, 0.74], [2.448, 0.5]],
    half: [[-2.446, 0.9], [-2.373, 0.975], [-2.034, 1.0], [2.1, 1.0], [2.22, 0.98], [2.36, 0.86], [2.448, 0.8]],
    bottom: [[-2.446, 0.52], [-2.3, 0.48], [-2.2, 0.45], [-1.8, 0.44], [1.1, 0.44], [2.1, 0.38], [2.3, 0.37], [2.4, 0.43], [2.448, 0.5]],
    sill: 0.46, floor: 0.36, tumble: 0.06, crown: 0.03, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.14, cy: r }, { z: zr, r: r + 0.14, cy: r }], inset: 0.32,
  });
  const gh = K.greenhouse(Bd, { st: [[1.17, null, 0.84], [1.02, 1.398, 0.84], [0.87, 1.523, 0.821], [0.72, 1.635, 0.798], [0.57, 1.736, 0.78], [0.45, 1.768, 0.781], [0.42, 1.776, 0.781], [0.27, 1.791, 0.782], [0.12, 1.797, 0.783], [-0.03, 1.806, 0.784], [-0.18, 1.8, 0.785], [-0.33, 1.8, 0.786], [-0.48, 1.8, 0.787], [-0.63, 1.8, 0.788], [-0.78, 1.8, 0.789], [-0.93, 1.8, 0.79], [-1.08, 1.799, 0.789], [-1.23, 1.798, 0.788], [-1.38, 1.796, 0.787], [-1.53, 1.794, 0.786], [-1.68, 1.789, 0.784], [-1.83, 1.782, 0.783], [-1.87, 1.778, 0.783], [-1.98, 1.74, 0.782], [-2.13, 1.568, 0.781], [-2.28, null, 0.828]], roof: [5, 22], inset: 0.03, crown: 0.03 });
  // side glass traced off the blueprint (z, y): black frames, black sail at the mirror, black B and C pillars, slatted black D pillar trim
  const fd = [[0.73, 1.245], [0.73, 1.43], [0.52, 1.66], [0.4, 1.72], [-0.03, 1.74], [-0.07, 1.71], [-0.07, 1.27], [-0.04, 1.245]];
  const rd = [[-0.23, 1.735], [-0.7, 1.74], [-0.84, 1.71], [-0.89, 1.65], [-1.0, 1.3], [-0.98, 1.275], [-0.25, 1.265]];
  const qg = [[-1.04, 1.76], [-1.84, 1.765], [-1.88, 1.74], [-2.11, 1.315], [-2.08, 1.3], [-1.3, 1.3], [-1.24, 1.33]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Trim', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Trim', [[0.95, 1.24], [0.92, 1.29], [0.73, 1.45], [0.71, 1.24]], 0.014);                                   // mirror sail
  K.ghPolyY(gh, 'Trim', [[-0.06, 1.765], [-0.22, 1.765], [-0.24, 1.25], [-0.06, 1.25]], 0.014);                             // B pillar
  K.ghPolyY(gh, 'Trim', [[-0.86, 1.775], [-1.05, 1.775], [-1.26, 1.33], [-1.31, 1.28], [-0.98, 1.27], [-1.01, 1.3]], 0.014);   // C pillar
  K.ghPolyY(gh, 'Trim', [[-1.92, 1.73], [-2.02, 1.73], [-2.2, 1.36], [-2.12, 1.36]], 0.014);                               // D pillar slats
  K.ghTop(gh, 'Paint', 0.45, 1.17, 0.9, 1.0); K.ghTop(gh, 'Paint', -2.28, -2.2, 0.9, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.66, 1.865, -0.18], [s * 0.66, 1.865, -1.82], 0.022, 5); for (const z of [-0.2, -1.0, -1.8]) K.box('Trim', s * 0.66, 1.845, z, 0.04, 0.05, 0.1); }
  // nose
  {   // nose block: plan corners (x, z) right side, mirrored; faces = grille (C), lamp face (L), corner bevel (B)
    const yb = 0.755, yt = 1.068, C = [[0, 2.4], [0.6, 2.4]], L = [[0.6, 2.4], [0.88, 2.36]], B = [[0.88, 2.36], [0.99, 2.22]];
    const plan = [[-0.975, 2.15], [-0.99, 2.22], [-0.88, 2.36], [-0.6, 2.4], [0.6, 2.4], [0.88, 2.36], [0.99, 2.22], [0.975, 2.15]];
    const sh = new K.T.Shape(); plan.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); sh.closePath();
    const g = new K.T.ExtrudeGeometry(sh, { depth: yt - yb, bevelEnabled: false }); g.rotateX(-Math.PI / 2); K.put('Paint', g, [0, yb, 0]);
    // a panel on a plan segment [A, B] (right side, mirrored), from fraction f0..f1 along it, y0..y1, standing `off` proud of the face
    const pan = (key, seg, f0, f1, y0, y1, off, t = 0.008) => {
      const [[xa, za], [xb, zb]] = seg, dx = xb - xa, dz = zb - za, L0 = Math.hypot(dx, dz), th = Math.atan2(-dz, dx), nx = Math.sin(th), nz = Math.cos(th);
      const fm = (f0 + f1) / 2, cx = xa + dx * fm + nx * (off - t / 2), cz = za + dz * fm + nz * (off - t / 2), w = L0 * (f1 - f0);
      for (const s of cx < 1e-6 && xa === 0 && f0 === 0 ? [1] : [-1, 1]) K.box(key, s * cx, (y0 + y1) / 2, cz, w, y1 - y0, t, [0, s * th, 0]);
    };
    const cen = (key, x1, y0, y1, off, t = 0.008) => K.box(key, 0, (y0 + y1) / 2, 2.4 + off - t / 2, 2 * x1, y1 - y0, t);
    // grille: bright surround, two black mesh openings, the bar through grille and lamps
    cen(br, 0.6, 0.758, 1.045, 0.006); cen('Grille', 0.565, 0.772, 1.03, 0.01); cen('Mesh', 0.55, 0.912, 1.018, 0.013); cen('Mesh', 0.55, 0.776, 0.852, 0.013);
    cen(br, 0.6, 0.862, 0.903, 0.018);
    pan(br, L, 0, 1, 0.862, 0.903, 0.018); pan(br, B, 0, 0.55, 0.862, 0.903, 0.018);
    // headlamps: chrome bezel, upper clear lamp, lower clear lamp with amber on the outer third and round the corner
    for (const [seg, f1] of [[L, 1], [B, 0.75]]) { pan('Chrome', seg, 0, f1, 0.905, 1.042, 0.008); pan('Chrome', seg, 0, f1, 0.762, 0.86, 0.008); }
    pan('Chrome', L, 0.03, 0.985, 0.912, 1.034, 0.012); pan('Head', B, 0.02, 0.72, 0.912, 1.034, 0.014);
    {   // twin round reflectors in the upper lamp, a clear parking lamp inside the lower one
      const [[xa, za], [xb, zb]] = L, th = Math.atan2(-(zb - za), xb - xa);
      for (const f of [0.3, 0.72]) for (const sd of [-1, 1]) { const x = xa + (xb - xa) * f, z = za + (zb - za) * f + 0.012;
        const d = new K.T.CylinderGeometry(0.046, 0.05, 0.012, 16); d.rotateX(Math.PI / 2); K.put('Head', d, [sd * (x + Math.sin(th) * 0.008), 0.973, z + Math.cos(th) * 0.008 - 0.012 + 0.012], [0, sd * th, 0]);
        const r = new K.T.TorusGeometry(0.05, 0.006, 4, 16); K.put('Chrome', r, [sd * (x + Math.sin(th) * 0.014), 0.973, z + Math.cos(th) * 0.014], [0, sd * th, 0]); }
    }
    pan('Clear', L, 0.03, 0.6, 0.768, 0.856, 0.014); pan('Amber', L, 0.6, 0.985, 0.768, 0.856, 0.014); pan('Amber', B, 0.02, 0.72, 0.768, 0.856, 0.014);
    // bowtie on the bar
    const bt = new K.T.Shape(), P = [[-0.1, 0.018], [-0.032, 0.018], [-0.032, 0.032], [0.032, 0.032], [0.032, 0.018], [0.1, 0.018], [0.086, -0.018], [0.032, -0.018], [0.032, -0.032], [-0.032, -0.032], [-0.032, -0.018], [-0.086, -0.018]];
    P.forEach(([x, y], i) => (i ? bt.lineTo(x, y) : bt.moveTo(x, y))); bt.closePath();
    K.put(o.police ? 'Trim' : 'Chrome', new K.T.ExtrudeGeometry(bt, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), [0, 0.883, 2.42]);
    if (!o.police) { const gi = new K.T.ShapeGeometry(bt); gi.scale(0.8, 0.62, 1); K.put('Gold', gi, [0, 0.883, 2.4362]); }
  }
  K.wrap(Bd, 'Paint', { x0: 0, zb: 2.1, y0: 0.64, y1: 0.75, off: 0.03, n1: 6, n2: 3, rows: 2 });             // bumper cap, body colour
  K.wrap(Bd, 'Trim', { x0: 0, x1: 0.3, y0: 0.635, y1: 0.652, off: 0.038, n1: 3, rows: 1 });               // slot in the cap
  K.wrap(Bd, br, { x0: 0, zb: 2.1, y0: 0.47, y1: 0.64, off: 0.036, n1: 6, n2: 3 });                        // chrome face
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.1, y0: 0.34, y1: 0.47, off: 0.018, n1: 6, n2: 3, rows: 1 });            // grey valance
  K.wrap(Bd, 'Trim', { x0: 0.46, x1: 0.72, y0: 0.395, y1: 0.455, off: 0.022, n1: 2, rows: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.49, x1: 0.69, y0: 0.405, y1: 0.445, off: 0.026, n1: 2, rows: 1 });              // fog lamps
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.72, zb: -2.17, y0: 0.81, y1: 1.15, n1: 2, n2: 1, rows: 3 });
  K.wrap(Bd, 'Amber', { end: -1, x0: 0.72, zb: -2.17, y0: 1.08, y1: 1.15, off: 0.016, n1: 2, n2: 1, rows: 1 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.72, zb: -2.17, y0: 0.81, y1: 0.87, off: 0.016, n1: 2, n2: 1, rows: 1 });
  K.plate(0, 0.62, K.faceAt(Bd, 0.62, -1) - 0.02, false);
  K.box('Trim', 0, 1.02, K.faceAt(Bd, 1.02, -1) - 0.012, 0.22, 0.06, 0.02);                    // gate handle
  K.wrap(Bd, br, { end: -1, x0: 0, zb: -2.15, y0: 0.55, y1: 0.73, off: 0.01, n1: 6, n2: 3 });
  K.box('Trim', 0, 0.73, -2.405, 1.3, 0.02, 0.07);                                             // step pad
  K.rod('Trim', [0.3, 1.36, K.faceAt(Bd, 1.3, -1) - 0.1], [-0.05, 1.42, K.faceAt(Bd, 1.3, -1) - 0.085], 0.012, 4);
  // side
  if (!o.police) { K.skin(Bd, 'Paint', { z0: -2.3, z1: 2.2, y0: 0.68, y1: 0.77, off: 0.016, rows: 1 }); K.skin(Bd, 'Trim', { z0: -0.9, z1: 1.15, y0: 0.42, y1: 0.47, off: 0.07, rows: 1 }); }
  K.handles(Bd, [0.04, -0.9], 1.085, { key: o.police ? 'Trim' : 'Paint', l: 0.17, h: 0.045 });
  K.mirrors(0.81, 1.31, 0.80, { w: 0.24, h: 0.2, key: o.police ? 'Trim' : 'Paint' });
  K.wheels([zf, zr], { x: 0.84, r, w: 0.265, rim: 0.56, style: o.police ? 'steel' : 'spoke', spokes: 5, spokeW: 0.34, holes: 6, rimKey: o.police ? undefined : 'Chrome' });
  if (o.police) return;
  return vMats(P, { body: '#a39a8b', clad: '#55585c', paint: { seams: [1.04, -0.14, -1.0, -2.28], hood: 1.03, belt: 1.24, sill: 0.62 } });
}
