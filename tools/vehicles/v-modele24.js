// 2024 Voltaic Arc (electric sedan; counterpart: 2024 Tesla Model 3 "Highland"). New era.
// v4 from reference photos (refs/cars/modele24): grille-less smooth nose that drops low, slim blade lamps, very cab-forward cabin
// under one black glass roof arc that runs into a short high deck, flush handles, C-shaped tail lamps, black diffuser, aero wheels.
// 4.72 x 1.85 x 1.44 m, wheelbase 2.875 m, 235/45R18.
// eslint-disable-next-line no-unused-vars
function build_modele24(K, P) {
  const r = 0.34, zf = 1.52, zr = -1.355;
  const Bd = K.body({
    top: [[-2.36, 0.46], [-2.355, 0.66], [-2.34, 0.96], [-2.3, 1.085], [-2.2, 1.105], [-2.05, 1.1], [-1.3, 1.05], [0.3, 0.97], [1.25, 0.935], [1.7, 0.83], [2.05, 0.71], [2.22, 0.63], [2.3, 0.56], [2.345, 0.47], [2.36, 0.38]],
    half: [[-2.360, 0.463], [-2.299, 0.638], [-2.150, 0.740], [-1.964, 0.814], [-1.730, 0.883], [-1.355, 0.925], [-0.840, 0.920], [-0.189, 0.902], [0.566, 0.906], [1.215, 0.925], [1.541, 0.925], [1.822, 0.908], [2.008, 0.893], [2.150, 0.851], [2.251, 0.768], [2.318, 0.620], [2.360, 0.430]],
    bottom: [[-2.36, 0.46], [-2.24, 0.43], [-1.91, 0.35], [-1.61, 0.3], [2.15, 0.25], [2.36, 0.27]],
    sill: 0.26, floor: 0.17, tumble: 0.1, crown: 0.05, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.05, cy: r }, { z: zr, r: r + 0.05, cy: r }], inset: 0.28,
  });
  const gh = K.greenhouse(Bd, { st: [[1.25, null, 0.72], [0.5, 1.365, 0.58], [-0.05, 1.405, 0.58], [-1.0, 1.325, 0.56], [-2.06, null, 0.64]], roof: [1, 3], key: 'Glass', inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', 0.5, 1.25, 0.86, 1.0);
  K.ghSide(gh, 'Paint', -2.06, -1.5, 0, 1.0);               // black rear quarter
  K.ghSide(gh, 'Trim', -0.32, -0.2, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.5, 1.2, 0, 0.03, 0.018);
  K.ghSide(gh, 'Trim', -1.45, 0.55, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', -2.06, 1.25, 0.9, 1.0);                                                  // body-colour roof rails round the glass
  // nose: no grille, slim blade lamps, one low intake slot
  const hy0 = (u) => 0.615 + Math.min(u, 1) * 0.035 + (u > 1 ? (u - 1) * 0.03 : 0), hy1 = (u) => 0.655 + Math.min(u, 1) * 0.04 + (u > 1 ? (u - 1) * 0.01 : 0);
  K.wrap(Bd, 'Gloss', { x0: 0.4, zb: 1.98, y0: hy0, y1: hy1, off: 0.012, n1: 5, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.44, zb: 2.1, y0: (u) => hy1(u) - 0.024, y1: (u) => hy1(u) - 0.006, off: 0.016, n1: 5, n2: 2, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.28, y1: 0.34, off: 0.01, n1: 4, rows: 1 });
  K.box('Chrome', 0, 0.64, K.faceAt(Bd, 0.64) + 0.01, 0.06, 0.05, 0.01, [-0.6, 0, 0]);
  K.plate(0, 0.45, K.faceAt(Bd, 0.45) + 0.014, true);
  // tail: C-shaped lamps on the corners, black diffuser
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.42, zb: -2.14, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.02 : 0), y1: (u) => 0.94 + (u > 1 ? -(u - 1) * 0.01 : 0), n1: 5, n2: 3, rows: 1 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.42, zb: -2.2, y0: 0.99, y1: 1.02, n1: 5, n2: 2, rows: 1 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.42, x1: 0.47, y0: 0.9, y1: 1.02, n1: 1, rows: 1 });
  K.wrap(Bd, 'Trim', { end: -1, x0: 0.47, zb: -2.2, y0: 0.94, y1: 0.99, off: 0.01, n1: 4, n2: 2, rows: 1 });
  K.plate(0, 0.8, K.faceAt(Bd, 0.8, -1) - 0.016, false);
  K.wrap(Bd, 'Plastic', { end: -1, x0: 0, zb: -2.1, y0: 0.3, y1: 0.46, off: 0.008, n1: 5, n2: 3, rows: 1 });
  K.box('Paint', 0, 1.1, -2.3, 1.45, 0.02, 0.1);
  K.skin(Bd, 'Plastic', { z0: -1.0, z1: 1.15, y0: 0.24, y1: 0.3, off: 0.004, rows: 1 });
  K.handles(Bd, [0.36, -0.66], 0.9, { key: 'Paint', l: 0.18, h: 0.03 });
  K.mirrors(0.87, 0.99, 1.02, { w: 0.18, h: 0.1 });
  K.wheels([zf, zr], { x: 0.8, r, w: 0.235, rim: 0.72, style: 'spoke', spokes: 9, spokeW: 0.13, twist: 0.2, rimKey: 'Steel' });
  return vMats(P, { body: '#eef0f2', paint: { seams: [1.2, -0.2, -1.4], hood: 1.2, trunk: -2.02, belt: 0.93 } });
}
