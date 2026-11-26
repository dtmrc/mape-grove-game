// 1997 Ironside Pathway (mid-size SUV; counterpart: 1995-97 Ford Explorer, 2nd gen four-door). Old era.
// v4 from reference photos (refs/cars/pathway97): rounded nose with one bright band holding the egg-crate grille and big rounded
// lamps with amber corners, grey bumpers, upright glassy wagon body with roof rails, silver lower moulding, tall three-colour
// tail lamps on the corners, near-vertical liftgate, black step bumper, 5-spoke alloys.
// 4.79 x 1.78 x 1.72 m, wheelbase 2.83 m, 235/75R15.
// eslint-disable-next-line no-unused-vars
function build_pathway97(K, P) {
  const r = 0.36, zf = 1.565, zr = -1.265;
  const Bd = K.body({
    top: [[-2.395, 0.56], [-2.39, 0.63], [-2.33, 0.65], [-2.32, 1.08], [-2.28, 1.11], [-1.9, 1.115], [1.1, 1.1], [1.8, 1.06], [2.15, 1.02], [2.27, 0.97], [2.31, 0.8], [2.32, 0.72], [2.385, 0.7], [2.395, 0.6]],
    half: [[-2.395, 0.8], [-2.33, 0.87], [-2.0, 0.888], [1.9, 0.888], [2.2, 0.86], [2.395, 0.74]],
    bottom: [[-2.395, 0.46], [-2.25, 0.42], [2.2, 0.42], [2.395, 0.44]],
    sill: 0.42, floor: 0.33, tumble: 0.05, crown: 0.03, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.07, cy: r }, { z: zr, r: r + 0.07, cy: r }], inset: 0.3,
  });
  const gh = K.greenhouse(Bd, { st: [[0.95, null, 0.74], [0.57, 1.69, 0.67], [-1.0, 1.71, 0.68], [-2.22, 1.7, 0.67], [-2.31, null, 0.76]], roof: [1, 3], inset: 0.03, crown: 0.03 });
  K.ghSide(gh, 'Paint', 0.57, 0.95, 0.84, 1.0);
  K.ghSide(gh, 'Trim', -0.42, -0.32, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.36, -1.28, 0, 1.0);
  K.ghSide(gh, 'Paint', -2.31, -2.13, 0, 1.0);              // D pillar
  K.ghSide(gh, 'Trim', -2.13, 0.9, 0, 0.035, 0.018);
  K.ghSide(gh, 'Paint', -2.13, 0.58, 0.93, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.57, 0.95, 0.9, 1.0); K.ghTop(gh, 'Paint', -2.31, -2.18, 0.9, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.56, 1.75, 0.1], [s * 0.56, 1.75, -2.0], 0.02, 5); for (const z of [0.1, -0.95, -2.0]) K.box('Trim', s * 0.56, 1.72, z, 0.04, 0.06, 0.1); }
  // nose
  K.wrap(Bd, 'Chrome', { x0: 0, zb: 2.2, y0: (u) => 0.765 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.955 - (u > 1 ? (u - 1) * 0.03 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.37, x1: 0.66, y0: 0.79, y1: 0.935, off: 0.014, n1: 3 });
  K.wrap(Bd, 'Amber', { x0: 0.66, zb: 2.24, y0: (u) => 0.79 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.935 - (u > 1 ? (u - 1) * 0.03 : 0), off: 0.014, n1: 2, n2: 2 });
  const gy = 0.86, gz = K.faceAt(Bd, gy) + 0.014;
  K.softGrille({ pts: [[0.33, 0.07], [0.31, -0.07]], y: gy, z: gz, tilt: K.faceTilt(Bd, 0.8, 0.94), sw: 0.012, depth: 0.03, frame: 'Steel', fill: 'Grille', round: 2, rad: 0.03,
    bars: [[0.0, 0.014, 'Steel']], vbars: [-0.2, -0.1, 0.1, 0.2].map((x) => [x, 0.014, 'Steel']), badge: { w: 0.12, h: 0.055, key: 'Badge', ringKey: 'Chrome' } });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.44, y1: 0.71, off: 0.01, n1: 6, n2: 3 });         // grey bumper
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.42, y0: 0.5, y1: 0.55, off: 0.016, n1: 3, rows: 1 });
  K.plate(0, 0.62, K.faceAt(Bd, 0.62) + 0.022, true);
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.7, zb: -2.25, y0: 0.86, y1: 1.06, n1: 2, n2: 2 });
  K.wrap(Bd, 'Amber', { end: -1, x0: 0.7, zb: -2.25, y0: 1.0, y1: 1.06, off: 0.016, n1: 2, n2: 2, rows: 1 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.7, zb: -2.25, y0: 0.86, y1: 0.9, off: 0.016, n1: 2, n2: 2, rows: 1 });
  K.plate(0, 0.9, K.faceAt(Bd, 0.9, -1) - 0.016, false);
  K.box('Badge', 0, 1.03, K.faceAt(Bd, 1.03, -1) - 0.01, 0.1, 0.045, 0.015);
  K.wrap(Bd, 'Trim', { end: -1, x0: 0, zb: -2.05, y0: 0.46, y1: 0.66, off: 0.01, n1: 5, n2: 3 });   // step bumper
  K.rod('Trim', [0.25, 1.2, K.faceAt(Bd, 1.2, -1) - 0.04], [0, 1.3, K.faceAt(Bd, 1.3, -1) - 0.03], 0.012, 4);   // rear wiper
  // side: silver moulding, running boards, flares
  K.skin(Bd, 'Stripe', { z0: -2.25, z1: 2.1, y0: 0.52, y1: 0.6, off: 0.012, rows: 1 });
  K.skin(Bd, 'Clad', { z0: -0.95, z1: 1.15, y0: 0.4, y1: 0.46, off: 0.05, rows: 1 });
  K.handles(Bd, [0.6, -0.5], 1.02, { key: 'Trim' });
  K.mirrors(0.86, 1.2, 0.75, { w: 0.2, h: 0.17, key: 'Trim' });
  K.rod('Trim', [0.8, 1.08, 1.5], [0.8, 1.85, 1.42], 0.006, 4);
  K.wheels([zf, zr], { x: 0.75, r, w: 0.235, rim: 0.55, style: 'spoke', spokes: 5, spokeW: 0.3 });
  return vMats(P, { body: '#17574f', stripe: '#aeb4b8', clad: '#70757a', paint: { seams: [1.14, -0.37, -1.32, -2.3], hood: 1.12, belt: 1.08, sill: 0.62 } });
}
