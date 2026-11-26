// 2004 Delmont Tahoma (full-size SUV; counterpart: 2000-06 Chevrolet Tahoe, GMT800). Old era. o.police -> PPV.
// v4 from reference photos (refs/cars/tahoma04): blunt tall nose with two stacked lamp rows split by a bright bar that carries the
// gold emblem across the grille, chrome bumper over a grey valance, boxy glassy body with roof rails and running boards, body
// moulding, tall slim tail lamps beside the liftgate, chrome step bumper, polished 5-spoke alloys.
// 5.05 x 2.0 x 1.9 m, wheelbase 2.946 m, 265/70R16.
// eslint-disable-next-line no-unused-vars
function build_tahoma04(K, P, o = {}) {
  const r = 0.385, zf = 1.595, zr = -1.35, br = o.police ? 'Trim' : 'Chrome';
  const Bd = K.body({
    top: [[-2.525, 0.62], [-2.52, 0.72], [-2.455, 0.74], [-2.445, 1.22], [-2.4, 1.265], [-1.9, 1.27], [1.15, 1.27], [1.9, 1.235], [2.3, 1.205], [2.4, 1.17], [2.43, 1.0], [2.44, 0.84], [2.515, 0.82], [2.525, 0.7]],
    half: [[-2.525, 0.9], [-2.45, 0.975], [-2.1, 1.0], [2.0, 1.0], [2.35, 0.975], [2.525, 0.88]],
    bottom: [[-2.525, 0.5], [-2.35, 0.46], [2.3, 0.46], [2.525, 0.48]],
    sill: 0.46, floor: 0.36, tumble: 0.06, crown: 0.03, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.075, cy: r }, { z: zr, r: r + 0.075, cy: r }], inset: 0.32,
  });
  const gh = K.greenhouse(Bd, { st: [[1.0, null, 0.84], [0.6, 1.89, 0.78], [-1.0, 1.91, 0.79], [-2.34, 1.9, 0.78], [-2.44, null, 0.86]], roof: [1, 3], inset: 0.03, crown: 0.03 });
  K.ghSide(gh, 'Paint', 0.6, 1.0, 0.84, 1.0);
  K.ghSide(gh, 'Trim', -0.42, -0.3, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.42, -1.32, 0, 1.0);
  K.ghSide(gh, 'Paint', -2.44, -2.24, 0, 1.0);
  K.ghSide(gh, 'Trim', -2.24, 0.95, 0, 0.03, 0.018);
  K.ghSide(gh, 'Paint', -2.24, 0.62, 0.94, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.6, 1.0, 0.9, 1.0); K.ghTop(gh, 'Paint', -2.44, -2.3, 0.9, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.66, 1.95, 0.1], [s * 0.66, 1.95, -2.15], 0.02, 5); for (const z of [0.1, -1.0, -2.15]) K.box('Trim', s * 0.66, 1.925, z, 0.04, 0.06, 0.1); }
  // nose
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.56, y0: 0.86, y1: 1.13, off: 0.008, n1: 3, rows: 1 });
  K.wrap(Bd, 'Mesh', { x0: 0, x1: 0.54, y0: 1.01, y1: 1.115, off: 0.012, n1: 3, rows: 1 });
  K.wrap(Bd, 'Mesh', { x0: 0, x1: 0.54, y0: 0.875, y1: 0.955, off: 0.012, n1: 3, rows: 1 });
  K.wrap(Bd, br, { x0: 0, zb: 2.3, y0: 0.962, y1: 1.003, off: 0.02, n1: 6, n2: 2, rows: 1 });   // the bright bar through grille and lamps
  K.wrap(Bd, 'Head', { x0: 0.58, zb: 2.3, y0: 1.008, y1: (u) => 1.13 - (u > 1 ? (u - 1) * 0.03 : 0), off: 0.014, n1: 3, n2: 2 });
  K.wrap(Bd, 'Clear', { x0: 0.58, zb: 2.3, y0: (u) => 0.865 + (u > 1 ? (u - 1) * 0.03 : 0), y1: 0.957, off: 0.014, n1: 3, n2: 2 });
  K.wrap(Bd, 'Amber', { x0: 0.58, zb: 2.3, y0: 0.925, y1: 0.957, off: 0.017, n1: 3, n2: 2, rows: 1 });
  K.box(o.police ? 'Trim' : 'Gold', 0, 0.983, K.faceAt(Bd, 0.983) + 0.03, 0.2, 0.06, 0.012);
  K.wrap(Bd, br, { x0: 0, zb: 2.1, y0: 0.6, y1: 0.83, off: 0.01, n1: 6, n2: 3 });               // bumper
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.1, y0: 0.47, y1: 0.6, off: 0.01, n1: 6, n2: 3, rows: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.55, x1: 0.7, y0: 0.5, y1: 0.55, off: 0.016, n1: 2, rows: 1 });
  K.plate(0, 0.72, K.faceAt(Bd, 0.72) + 0.022, true);
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.83, zb: -2.42, y0: 0.9, y1: 1.26, n1: 2, n2: 1, rows: 3 });
  K.wrap(Bd, 'Amber', { end: -1, x0: 0.83, zb: -2.42, y0: 1.17, y1: 1.26, off: 0.016, n1: 2, n2: 1, rows: 1 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.83, zb: -2.42, y0: 0.9, y1: 0.96, off: 0.016, n1: 2, n2: 1, rows: 1 });
  K.plate(0, 0.62, K.faceAt(Bd, 0.62, -1) - 0.02, false);
  K.box('Trim', 0, 1.02, K.faceAt(Bd, 1.02, -1) - 0.012, 0.22, 0.06, 0.02);                    // gate handle
  K.wrap(Bd, br, { end: -1, x0: 0, zb: -2.15, y0: 0.5, y1: 0.73, off: 0.01, n1: 6, n2: 3 });
  K.box('Trim', 0, 0.735, -2.49, 1.3, 0.02, 0.07);                                             // step pad
  K.rod('Trim', [0.3, 1.36, K.faceAt(Bd, 1.3, -1) - 0.1], [-0.05, 1.42, K.faceAt(Bd, 1.3, -1) - 0.085], 0.012, 4);
  // side
  if (!o.police) { K.skin(Bd, 'Paint', { z0: -2.3, z1: 2.2, y0: 0.66, y1: 0.76, off: 0.016, rows: 1 }); K.skin(Bd, 'Trim', { z0: -0.9, z1: 1.15, y0: 0.42, y1: 0.47, off: 0.07, rows: 1 }); }
  K.handles(Bd, [0.62, -0.55], 1.16, { key: o.police ? 'Trim' : 'Paint', l: 0.17, h: 0.045 });
  K.mirrors(0.97, 1.36, 0.80, { w: 0.24, h: 0.2, key: o.police ? 'Trim' : 'Paint' });
  K.wheels([zf, zr], { x: 0.84, r, w: 0.265, rim: 0.56, style: o.police ? 'steel' : 'spoke', spokes: 5, spokeW: 0.34, holes: 6, rimKey: o.police ? undefined : 'Chrome' });
  if (o.police) return;
  return vMats(P, { body: '#a39a8b', clad: '#55585c', paint: { seams: [1.2, -0.36, -1.37, -2.4], hood: 1.2, belt: 1.24, sill: 0.62 } });
}
