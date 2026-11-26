// 1997 Ironside Pathway (mid-size SUV; counterpart: 1995-97 Ford Explorer, 2nd gen four-door). Old era.
// Run 2 (2026-11-25): outline, glass, pillars, arches and lamps measured off the side blueprint in model metres.
// v4 from reference photos (refs/cars/pathway97): rounded nose with one bright band holding the egg-crate grille and big rounded
// lamps with amber corners, grey bumpers, upright glassy wagon body with roof rails, silver lower moulding, tall three-colour
// tail lamps on the corners, near-vertical liftgate, black step bumper, 5-spoke alloys.
// 4.79 x 1.78 x 1.72 m, wheelbase 2.83 m, 235/75R15.
// eslint-disable-next-line no-unused-vars
function build_pathway97(K, P) {
  const r = 0.36, zf = 1.565, zr = -1.265;
  const Bd = K.body({
    top: [[-2.36, 0.5], [-2.356, 0.654], [-2.3, 0.654], [-2.24, 1.13], [-1.99, 1.14], [-1.74, 1.14], [-1.49, 1.14], [-1.24, 1.14], [-0.99, 1.134], [-0.74, 1.127], [-0.49, 1.123], [-0.24, 1.119], [0.01, 1.115], [0.26, 1.113], [0.51, 1.112], [0.76, 1.111], [1.0, 1.18], [1.05, 1.188], [1.15, 1.19], [1.35, 1.165], [1.55, 1.141], [1.75, 1.117], [1.95, 1.084], [2.15, 1.027], [2.2, 0.995], [2.25, 0.922], [2.3, 0.662], [2.339, 0.662], [2.343, 0.45]],
    half: [[-2.36, 0.8], [-2.296, 0.87], [-1.97, 0.888], [1.87, 0.888], [2.165, 0.86], [2.343, 0.74]],
    bottom: [[-2.36, 0.62], [-2.3, 0.56], [-2.2, 0.5], [-2.05, 0.46], [-1.8, 0.41], [-1.7, 0.38], [-0.8, 0.33], [0.5, 0.37], [0.6, 0.29], [1.15, 0.295], [1.95, 0.38], [2.15, 0.43], [2.25, 0.47], [2.343, 0.52]],
    sill: 0.42, floor: 0.33, tumble: 0.05, crown: 0.03, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.11, cy: r }, { z: zr, r: r + 0.11, cy: r }], inset: 0.3,
  });
  const gh = K.greenhouse(Bd, { st: [[1.0, null, 0.74], [0.85, 1.368, 0.722], [0.7, 1.49, 0.694], [0.55, 1.595, 0.67], [0.4, 1.652, 0.671], [0.25, 1.667, 0.672], [0.1, 1.673, 0.673], [-0.05, 1.675, 0.674], [-0.2, 1.676, 0.675], [-0.35, 1.676, 0.676], [-0.5, 1.677, 0.677], [-0.65, 1.677, 0.678], [-0.8, 1.678, 0.679], [-0.95, 1.678, 0.68], [-1.1, 1.678, 0.679], [-1.25, 1.678, 0.678], [-1.4, 1.678, 0.677], [-1.55, 1.678, 0.675], [-1.7, 1.676, 0.674], [-1.85, 1.668, 0.673], [-2.0, 1.579, 0.672], [-2.15, 1.344, 0.671], [-2.24, null, 0.69]], roof: [4, 19], inset: 0.03, crown: 0.03, sideKey: 'Paint' });
  // side glass traced off the blueprint (z, y): black frames, black sail at the mirror, black B and C pillars, body-colour D pillar
  const fd = [[0.76, 1.125], [0.76, 1.31], [0.47, 1.61], [0.4, 1.64], [-0.06, 1.645], [-0.08, 1.125]];
  const rd = [[-0.19, 1.65], [-0.86, 1.65], [-0.91, 1.6], [-0.92, 1.19], [-0.88, 1.145], [-0.19, 1.145]];
  const qg = [[-1.04, 1.64], [-1.8, 1.64], [-2.08, 1.17], [-2.05, 1.145], [-1.12, 1.145], [-1.09, 1.19]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Trim', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Trim', [[0.93, 1.12], [0.9, 1.2], [0.76, 1.33], [0.74, 1.12]], 0.014);                       // mirror sail
  K.ghPolyY(gh, 'Trim', [[-0.06, 1.665], [-0.2, 1.665], [-0.19, 1.12], [-0.08, 1.12]], 0.014);                 // B pillar
  K.ghPolyY(gh, 'Trim', [[-0.9, 1.665], [-1.05, 1.665], [-1.11, 1.135], [-0.92, 1.13]], 0.014);                // C pillar
  K.ghTop(gh, 'Paint', 0.4, 1.0, 0.92, 1.0); K.ghTop(gh, 'Paint', -2.24, -2.16, 0.9, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.56, 1.725, 0.0], [s * 0.56, 1.725, -1.75], 0.02, 5); for (const z of [-0.4, -1.63]) K.box('Trim', s * 0.56, 1.745, z, 0.05, 0.07, 0.14); }
  // nose
  K.wrap(Bd, 'Chrome', { x0: 0, zb: 2.2, y0: (u) => 0.75 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.975 - (u > 1 ? (u - 1) * 0.03 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.37, x1: 0.72, y0: 0.775, y1: 0.95, off: 0.014, n1: 3 });
  K.wrap(Bd, 'Amber', { x0: 0.72, zb: 2.22, y0: (u) => 0.775 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.95 - (u > 1 ? (u - 1) * 0.03 : 0), off: 0.014, n1: 2, n2: 2 });
  const gy = 0.86, gz = K.faceAt(Bd, gy) + 0.014;
  K.softGrille({ pts: [[0.33, 0.07], [0.31, -0.07]], y: gy, z: gz, tilt: K.faceTilt(Bd, 0.8, 0.94), sw: 0.012, depth: 0.03, frame: 'Steel', fill: 'Grille', round: 2, rad: 0.03,
    bars: [[0.0, 0.024, 'Gold']], vbars: [-0.2, -0.1, 0.1, 0.2].map((x) => [x, 0.014, 'Steel']), badge: { w: 0.12, h: 0.055, key: 'Badge', ringKey: 'Chrome' } });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.42, y1: 0.71, off: 0.03, n1: 6, n2: 3 });
  K.wrap(Bd, 'Stripe', { x0: 0, zb: 2.08, y0: 0.5, y1: 0.585, off: 0.034, n1: 6, n2: 3, rows: 1 });         // grey bumper
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.3, y0: 0.525, y1: 0.565, off: 0.037, n1: 3, rows: 1 });
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.7, zb: -2.2, y0: 0.79, y1: 1.08, n1: 2, n2: 2 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.7, zb: -2.2, y0: 0.86, y1: 0.9, off: 0.016, n1: 2, n2: 2, rows: 1 });
  K.plate(0, 0.9, K.faceAt(Bd, 0.9, -1) - 0.016, false);
  K.box('Badge', 0, 1.03, K.faceAt(Bd, 1.03, -1) - 0.01, 0.1, 0.045, 0.015);
  K.wrap(Bd, 'Trim', { end: -1, x0: 0, zb: -2.05, y0: 0.52, y1: 0.68, off: 0.01, n1: 5, n2: 3 });   // step bumper
  K.rod('Trim', [0.25, 1.2, K.faceAt(Bd, 1.2, -1) - 0.04], [0, 1.3, K.faceAt(Bd, 1.3, -1) - 0.03], 0.012, 4);   // rear wiper
  // side: silver moulding, running boards, flares
  K.skin(Bd, 'Stripe', { z0: -2.2, z1: 2.05, y0: 0.67, y1: 0.71, off: 0.012, rows: 1 });
  K.skin(Bd, 'Clad', { z0: -0.95, z1: 1.15, y0: 0.4, y1: 0.46, off: 0.05, rows: 1 });
  K.handles(Bd, [0.13, -0.85], 1.02, { key: 'Trim' });
  K.mirrors(0.74, 1.25, 0.75, { w: 0.2, h: 0.17, key: 'Trim' });
  K.rod('Trim', [0.8, 1.22, 1.1], [0.8, 1.93, 0.9], 0.006, 4);
  K.wheels([zf, zr], { x: 0.75, r, w: 0.235, rim: 0.55, style: 'spoke', spokes: 5, spokeW: 0.3 });
  return vMats(P, { body: '#17574f', stripe: '#aeb4b8', clad: '#55595d', paint: { seams: [0.98, -0.07, -1.0, -2.24], hood: 1.0, belt: 1.11, sill: 0.62 } });
}
