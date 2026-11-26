// 2014 Hikari Accolade (mid-size sedan; counterpart: 2013-15 Honda Accord, 9th gen). Middle era.
// v4 from reference photos (refs/cars/accolade14): cab-forward six-window cabin with a fast rear glass and short high deck, chrome
// trapezoid grille with two bright bars that runs into slim swept lamps, trapezoid lower intake with fog pockets, big tail lamps
// that wrap the corner and point onto the lid, chrome bar over the plate, 5 split-spoke alloys.
// 4.86 x 1.85 x 1.465 m, wheelbase 2.775 m, 215/55R17.
// eslint-disable-next-line no-unused-vars
function build_accolade14(K, P) {
  const r = 0.335, zf = 1.47, zr = -1.305;
  const Bd = K.body({
    top: [[-2.43, 0.5], [-2.425, 0.64], [-2.4, 0.9], [-2.36, 1.03], [-2.25, 1.07], [-1.85, 1.075], [-1.2, 1.04], [0.3, 0.99], [1.05, 0.985], [1.7, 0.9], [2.15, 0.8], [2.28, 0.755], [2.34, 0.68], [2.37, 0.56], [2.42, 0.54], [2.43, 0.46]],
    half: [[-2.430, 0.463], [-2.367, 0.638], [-2.214, 0.740], [-2.022, 0.814], [-1.781, 0.883], [-1.395, 0.925], [-0.865, 0.920], [-0.194, 0.902], [0.583, 0.906], [1.251, 0.925], [1.587, 0.925], [1.876, 0.908], [2.068, 0.893], [2.214, 0.851], [2.318, 0.768], [2.386, 0.620], [2.430, 0.430]],
    bottom: [[-2.43, 0.45], [-2.31, 0.42], [-1.98, 0.35], [-1.68, 0.3], [2.2, 0.26], [2.43, 0.28]],
    sill: 0.28, floor: 0.19, tumble: 0.085, crown: 0.04, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.055, cy: r }, { z: zr, r: r + 0.055, cy: r }], inset: 0.28,
  });
  const gh = K.greenhouse(Bd, { st: [[1.05, null, 0.74], [0.18, 1.42, 0.61], [-0.4, 1.43, 0.61], [-1.1, 1.4, 0.59], [-1.88, null, 0.7]], roof: [1, 3], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', 0.18, 1.05, 0.82, 1.0);
  K.ghSide(gh, 'Paint', -1.88, -1.5, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.2, -1.14, 0, 1.0);                // rear quarter glass divider
  K.ghSide(gh, 'Trim', -0.3, -0.18, 0, 1.0);
  K.ghSide(gh, 'Chrome', -1.5, 1.0, 0, 0.035, 0.018);
  K.ghSide(gh, 'Chrome', -1.45, 0.22, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.18, 1.05, 0.9, 1.0); K.ghTop(gh, 'Paint', -1.88, -1.1, 0.88, 1.0);
  // nose
  const gy = 0.66, gz = K.faceAt(Bd, gy) + 0.008, gt = K.faceTilt(Bd, 0.6, 0.74);
  K.softGrille({ pts: [[0.42, 0.075], [0.3, -0.07]], y: gy, z: gz, tilt: gt, sw: 0.022, depth: 0.045, frame: 'Chrome', fill: 'Grille', round: 2, rad: 0.03,
    bars: [[0.03, 0.022, 'Chrome'], [-0.02, 0.018, 'Chrome']], badge: { w: 0.1, h: 0.08, key: 'Chrome', ring: false, y: 0.01 } });
  K.wrap(Bd, 'Head', { x0: 0.43, zb: 2.02, y0: (u) => 0.665 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.74 + Math.min(u, 1) * 0.015, n1: 5, n2: 3 });
  K.plate(0, 0.5, K.faceAt(Bd, 0.5) + 0.014, true);
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.42, y0: 0.33, y1: 0.42, n1: 3, rows: 1 });
  K.wrap(Bd, 'Grille', { x0: 0.52, x1: 0.8, y0: 0.4, y1: 0.48, n1: 3, rows: 1 });                 // fog pockets
  K.wrap(Bd, 'Clear', { x0: 0.56, x1: 0.72, y0: 0.425, y1: 0.455, off: 0.016, n1: 2, rows: 1 });
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.4, zb: -2.12, y0: (u) => 0.83 + (u < 1 ? (1 - u) * 0.03 : (u - 1) * 0.04), y1: (u) => 0.96 - (u < 1 ? (1 - u) * 0.02 : (u - 1) * 0.03), n1: 6, n2: 3 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.42, x1: 0.62, y0: 0.925, y1: 0.95, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Chrome', { end: -1, x0: 0, x1: 0.4, y0: 0.9, y1: 0.935, off: 0.016, n1: 3, rows: 1 });
  K.plate(0, 0.8, K.faceAt(Bd, 0.8, -1) - 0.016, false);
  K.box('Chrome', 0, 1.0, K.faceAt(Bd, 1.0, -1) - 0.008, 0.08, 0.06, 0.015);
  K.wrap(Bd, 'Plastic', { end: -1, x0: 0, zb: -2.25, y0: 0.4, y1: 0.47, off: 0.008, n1: 5, n2: 2, rows: 1 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, x1: 0.8, y0: 0.42, y1: 0.45, off: 0.014, n1: 2, rows: 1 });
  K.handles(Bd, [0.32, -0.72], 0.93, { key: 'Chrome', l: 0.16 });
  K.mirrors(0.87, 1.04, 0.85, { w: 0.19, h: 0.12 });
  K.wheels([zf, zr], { x: 0.8, r, w: 0.215, rim: 0.66, style: 'spoke', spokes: 5, split: true });
  return vMats(P, { body: '#4b5057', paint: { seams: [1.04, -0.24, -1.4], hood: 1.02, trunk: -1.9, belt: 0.94 } });
}
