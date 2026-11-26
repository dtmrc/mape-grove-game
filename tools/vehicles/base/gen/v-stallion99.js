// 1999 Ironside Stallion GT (pony car; counterpart: 1999-2004 Ford Mustang GT "New Edge"). Old era.
// v4 from reference photos (refs/cars/stallion99): long hood with a scoop, short deck with a pedestal spoiler, angular wrap lamps
// either side of a honeycomb grille opening, round fog lamps in the lower bumper, side scoop behind the door, small quarter
// window, three-bar vertical tail lamps, 5-spoke wheels.
// 4.65 x 1.86 x 1.35 m, wheelbase 2.57 m, 245/45R17.
// eslint-disable-next-line no-unused-vars
function build_stallion99(K, P) {
  const r = 0.325, zf = 1.355, zr = -1.215;
  const Bd = K.body({
    top: [[-2.325, 0.5], [-2.32, 0.6], [-2.3, 0.86], [-2.26, 0.95], [-2.1, 0.975], [-1.65, 0.985], [-1.0, 0.975], [0.1, 0.94], [0.62, 0.93], [1.4, 0.86], [1.95, 0.76], [2.16, 0.7], [2.25, 0.63], [2.29, 0.56], [2.32, 0.5], [2.325, 0.44]],
    half: [[-2.325, 0.76], [-2.22, 0.87], [-1.8, 0.925], [-1.0, 0.93], [1.3, 0.93], [1.9, 0.9], [2.2, 0.8], [2.325, 0.62]],
    bottom: [[-2.325, 0.44], [-2.205, 0.41], [-1.875, 0.33], [-1.575, 0.28], [2.05, 0.24], [2.325, 0.26]],
    sill: 0.26, floor: 0.17, tumble: 0.1, crown: 0.045, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.055, cy: r }, { z: zr, r: r + 0.055, cy: r }], inset: 0.29,
  });
  const gh = K.greenhouse(Bd, { st: [[0.62, null, 0.7], [-0.12, 1.3, 0.58], [-0.5, 1.31, 0.58], [-0.98, 1.27, 0.56], [-1.68, null, 0.64]], roof: [1, 3], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', -0.12, 0.62, 0.84, 1.0);
  K.ghSide(gh, 'Trim', -0.62, -0.52, 0, 1.0);               // B pillar
  K.ghSide(gh, 'Paint', -1.68, -1.12, 0, 1.0);              // C pillar behind the quarter window
  K.ghSide(gh, 'Trim', -1.12, 0.58, 0, 0.035, 0.018);
  K.ghTop(gh, 'Paint', -0.12, 0.62, 0.9, 1.0); K.ghTop(gh, 'Paint', -1.68, -0.98, 0.88, 1.0);
  // hood scoop
  K.box('Paint', 0, Bd.yt(1.1) + 0.06, 1.1, 0.42, 0.06, 0.5, [0.06, 0, 0]); K.box('Grille', 0, Bd.yt(1.1) + 0.06, 1.36, 0.36, 0.035, 0.02);
  // nose
  const gy = 0.6, gz = K.faceAt(Bd, gy) + 0.004;
  K.softGrille({ pts: [[0.3, 0.05], [0.24, -0.05]], y: gy, z: gz, tilt: K.faceTilt(Bd, 0.54, 0.66), sw: 0.012, depth: 0.03, frame: 'Trim', fill: 'Honeycomb', round: 2, rad: 0.03, badge: { w: 0.13, h: 0.05, key: 'Chrome', ring: false } });
  K.wrap(Bd, 'Head', { x0: 0.38, zb: 1.98, y0: (u) => 0.58 + Math.min(u, 1) * 0.02 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.655 + Math.min(u, 1) * 0.035, off: 0.014, n1: 5, n2: 3 });
  K.wrap(Bd, 'Amber', { x0: 0.72, zb: 2.02, y0: (u) => 0.6 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.635, off: 0.017, n1: 2, n2: 2, rows: 1 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.42, y0: 0.3, y1: 0.38, off: 0.012, n1: 3, rows: 1 });
  for (const s of [-1, 1]) { const g = new K.T.CylinderGeometry(0.05, 0.05, 0.02, 12); g.rotateX(Math.PI / 2); K.put('Clear', g, [s * 0.58, 0.36, K.faceAtX(Bd, 0.58, 0.36) + 0.014]); }
  K.plate(0, 0.46, K.faceAt(Bd, 0.46) + 0.014, true);
  // tail: three vertical bars per side
  for (const [a, b] of [[0.46, 0.55], [0.57, 0.66], [0.68, 0.77]]) K.wrap(Bd, 'Tail', { end: -1, x0: a, x1: b, y0: 0.76, y1: 0.92, off: 0.016, n1: 1, rows: 1 });
  K.wrap(Bd, 'Trim', { end: -1, x0: 0.44, x1: 0.79, y0: 0.745, y1: 0.935, off: 0.008, n1: 2, rows: 1 });
  K.plate(0, 0.82, K.faceAt(Bd, 0.82, -1) - 0.016, false);
  K.wrap(Bd, 'Grille', { end: -1, x0: 0, x1: 0.45, y0: 0.36, y1: 0.42, off: 0.012, n1: 3, rows: 1 });
  K.sbox('Chrome', 0.6, 0.3, K.faceAt(Bd, 0.34, -1) + 0.02, 0.08, 0.08, 0.12);
  K.box('Paint', 0, 1.08, -2.2, 1.56, 0.03, 0.16); for (const s of [-1, 1]) K.box('Paint', s * 0.62, 1.03, -2.2, 0.05, 0.1, 0.1);   // pedestal spoiler
  // side scoop, rocker
  for (const s of [-1, 1]) K.box('Trim', s * (Bd.half(-0.78) + 0.002), 0.72, -0.78, 0.02, 0.28, 0.06);
  K.skin(Bd, 'Paint', { z0: -0.85, z1: 1.0, y0: 0.24, y1: 0.33, off: 0.02, rows: 1 });
  K.handles(Bd, [-0.3], 0.86, { key: 'Paint', l: 0.14, h: 0.05 });
  K.mirrors(0.87, 0.98, 0.45, { w: 0.17, h: 0.1, key: 'Trim' });
  K.wheels([zf, zr], { x: 0.795, r, w: 0.245, rim: 0.7, style: 'spoke', spokes: 5, spokeW: 0.3 });
  return vMats(P, { body: '#8a8073', paint: { seams: [0.66, -0.6], hood: 0.64, trunk: -1.7, belt: 0.9 } });
}
