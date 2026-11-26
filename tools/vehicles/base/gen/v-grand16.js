// 2016 Trailmark Grand Outrider (mid-size SUV; counterpart: 2016 Jeep Grand Cherokee WK2). Middle era.
// v4 from reference photos (refs/cars/grand16): tall blunt nose with a short slotted grille level with slim lamps, dark lower bumper
// with a wide intake and fog lamps, squared arches with black lips, bright window surround, roof rails and spoiler, horizontal
// tail lamps that run onto the liftgate, bright strip over a black rear valance. 4.82 x 1.94 x 1.76 m, wheelbase 2.915 m, 265/60R18.
// eslint-disable-next-line no-unused-vars
function build_grand16(K, P) {
  const r = 0.385, zf = 1.51, zr = -1.405;
  const Bd = K.body({
    top: [[-2.41, 0.5], [-2.405, 0.7], [-2.39, 1.179], [-2.34, 1.27], [-2.0, 1.286], [-0.5, 1.254], [1.05, 1.224], [1.8, 1.082], [2.2, 1.019], [2.32, 0.974], [2.365, 0.86], [2.38, 0.7], [2.405, 0.6], [2.41, 0.5]],
    half: [[-2.410, 0.484], [-2.347, 0.668], [-2.196, 0.774], [-2.005, 0.852], [-1.767, 0.924], [-1.383, 0.968], [-0.858, 0.963], [-0.193, 0.944], [0.578, 0.949], [1.241, 0.968], [1.574, 0.968], [1.861, 0.951], [2.051, 0.934], [2.196, 0.891], [2.299, 0.803], [2.367, 0.649], [2.410, 0.450]],
    bottom: [[-2.41, 0.5], [-2.2, 0.4], [2.15, 0.36], [2.41, 0.4]],
    sill: 0.4, floor: 0.32, tumble: 0.08, crown: 0.035, shoulder: 0.85,
    arches: [{ z: zf, r: r + 0.07, cy: r, sq: 0.9 }, { z: zr, r: r + 0.07, cy: r, sq: 0.9 }], inset: 0.31, ywarp: { nose: {"a": 0.625, "b": 0.883, "d": 0.005}, tail: {"a": 0.708, "b": 1.003, "d": -0.001} },
  });
  const gh = K.greenhouse(Bd, { st: [[0.95, null, 0.80], [0.35, 1.7, 0.63], [-0.9, 1.71, 0.63], [-1.91, 1.66, 0.58], [-2.33, null, 0.64]], roof: [1, 3], inset: 0.03, crown: 0.03 });
  K.ghSide(gh, 'Trim', 0.35, 0.95, 0.86, 1.0);
  K.ghSide(gh, 'Trim', -0.38, -0.26, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.3, -1.2, 0, 1.0);
  K.ghPoly(gh, 'Paint', [[-1.2, 0.92], [-1.2, 1.0], [-2.33, 1.0], [-2.33, 0.92]]); K.ghPoly(gh, 'Paint', [[-1.86, 1.0], [-2.33, 1.0], [-2.33, 0.0], [-2.04, 0.0]]);   // thick raked rear pillar, upswept quarter window
  K.ghSide(gh, 'Chrome', -2.0, 0.9, 0, 0.03, 0.018);
  K.ghSide(gh, 'Chrome', -1.07, 0.35, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.35, 0.95, 0.92, 1.0); K.ghTop(gh, 'Paint', -2.33, -1.92, 0.9, 1.0);
  for (const s of [-1, 1]) K.rod('Chrome', [s * 0.56, 1.755, 0.20], [s * 0.53, 1.730, -1.71], 0.018, 5);
  K.roofLip(gh, { z: -1.89, key: 'Paint' });
  // nose: six bright-ringed slots in a body-colour panel, slim lamps
  const gy = 0.935, gz = K.faceAt(Bd, gy) + 0.012, gt = K.faceTilt(Bd, 0.865, 1.005);
  for (let k = 0; k < 6; k++) { const x = -0.375 + k * 0.15;
    K.softGrille({ full: true, pts: [[-0.055, 0.075], [0.055, 0.075], [0.055, -0.075], [-0.055, -0.075]], x, y: gy, z: gz, tilt: gt, sw: 0.014, depth: 0.03, frame: 'Chrome', fill: 'Grille', round: 2, rad: 0.02 }); }
  K.wrap(Bd, 'Head', { x0: 0.5, zb: 2.12, y0: (u) => 0.87 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.985 - (u > 1 ? (u - 1) * 0.02 : 0), off: 0.014, n1: 4, n2: 2 });
  K.wrap(Bd, 'Amber', { x0: 0.86, zb: 2.16, y0: (u) => 0.875 + (u > 1 ? (u - 1) * 0.05 : 0), y1: 0.92, off: 0.017, n1: 1, n2: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.38, y1: (u) => 0.66 - (u > 1 ? (u - 1) * 0.12 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.44, y1: 0.58, off: 0.014, n1: 3, rows: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.6, x1: 0.76, y0: 0.52, y1: 0.58, off: 0.016, n1: 2, rows: 1 });
  K.plate(0, 0.763, K.faceAt(Bd, 0.763) + 0.014, true);
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.36, zb: -2.2, y0: (u) => 1.0 + (u > 1 ? (u - 1) * 0.02 : 0), y1: (u) => 1.1 - (u > 1 ? (u - 1) * 0.02 : 0), n1: 5, n2: 2 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.38, x1: 0.84, y0: 1.005, y1: 1.03, off: 0.016, n1: 3, rows: 1 });
  K.plate(0, 0.999, K.faceAt(Bd, 0.999, -1) - 0.016, false);
  K.wrap(Bd, 'Chrome', { end: -1, x0: 0, x1: 0.7, y0: 0.7, y1: 0.735, off: 0.014, n1: 3, rows: 1 });
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -2.1, y0: 0.4, y1: 0.62, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.64, x1: 0.82, y0: 0.56, y1: 0.6, off: 0.014, n1: 2, rows: 1 });
  // side: black sill and arch lips
  K.skin(Bd, 'Clad', { z0: -2.3, z1: 2.25, y0: 0.38, y1: 0.47, off: 0.008, rows: 1 });
  K.archLips(Bd, 'Clad', { t: 0.035, y0: 0.47 });
  K.handles(Bd, [0.52, -0.5], 1.14, { key: 'Paint', l: 0.17, h: 0.04 });
  K.mirrors(0.93, 1.28, 0.75, { w: 0.21, h: 0.15 });
  K.wheels([zf, zr], { x: 0.82, r, w: 0.265, rim: 0.64, style: 'spoke', spokes: 5, split: true });
  return vMats(P, { body: '#eceef0', clad: '#1a1b1d', paint: { seams: [1.12, -0.32, -1.25, -2.28], hood: 1.08, belt: 1.12, sill: 0.5 } });
}
