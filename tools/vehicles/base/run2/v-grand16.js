// 2016 Trailmark Grand Outrider (mid-size SUV; counterpart: 2016 Jeep Grand Cherokee WK2). Middle era.
// Run 2 (2026-11-25): outline, glass, arches and lamps measured off the side blueprint (refs/cars/grand16/side-bp.jpg) in model metres;
// nose and tail from the photos: seven bright-ringed slots level with slim lamps, black lower bumper with C-shaped fog bezels, chrome
// window surround and belt, roof rails and spoiler, horizontal tail lamps running onto the liftgate, chrome strip over a black valance.
// eslint-disable-next-line no-unused-vars
function build_grand16(K, P) {
  const r = 0.385, zf = 1.51, zr = -1.405;
  const Bd = K.body({
    top: [[-2.338, 0.42], [-2.334, 0.832], [-2.3, 0.832], [-2.25, 1.19], [-2.2, 1.3], [-1.95, 1.306], [-1.7, 1.298], [-1.45, 1.286], [-1.2, 1.274], [-0.95, 1.263], [-0.7, 1.254], [-0.45, 1.245], [-0.2, 1.23], [0.05, 1.208], [0.3, 1.196], [0.55, 1.185], [0.8, 1.177], [1.035, 1.2], [1.1, 1.235], [1.15, 1.228], [1.3, 1.225], [1.5, 1.2], [1.7, 1.169], [1.9, 1.127], [2.1, 1.075], [2.15, 1.051], [2.2, 0.95], [2.25, 0.777], [2.304, 0.704], [2.308, 0.42]],
    half: [[-2.338, 0.484], [-2.277, 0.668], [-2.13, 0.774], [-1.945, 0.852], [-1.714, 0.924], [-1.342, 0.968], [-0.832, 0.963], [-0.187, 0.944], [0.554, 0.949], [1.188, 0.968], [1.507, 0.968], [1.782, 0.951], [1.964, 0.934], [2.103, 0.891], [2.202, 0.803], [2.267, 0.649], [2.308, 0.45]],
    bottom: [[-2.338, 0.493], [-2.2, 0.402], [-2.1, 0.388], [-2.0, 0.361], [-1.9, 0.357], [-1.8, 0.384], [-1.7, 0.382], [-1.6, 0.379], [-1.5, 0.377], [-1.4, 0.374], [-1.3, 0.372], [-1.2, 0.37], [-1.1, 0.367], [-1.0, 0.365], [-0.9, 0.284], [-0.8, 0.284], [-0.7, 0.312], [-0.6, 0.312], [-0.5, 0.309], [-0.4, 0.309], [-0.3, 0.309], [-0.2, 0.305], [-0.1, 0.305], [0.0, 0.305], [0.1, 0.305], [0.2, 0.302], [0.3, 0.302], [0.4, 0.302], [0.5, 0.298], [0.6, 0.298], [0.7, 0.298], [0.8, 0.291], [0.9, 0.257], [1.0, 0.319], [1.1, 0.318], [1.2, 0.315], [1.3, 0.313], [1.4, 0.311], [1.5, 0.308], [1.6, 0.306], [1.7, 0.304], [1.8, 0.301], [1.9, 0.299], [2.0, 0.222], [2.1, 0.316], [2.2, 0.357], [2.308, 0.593]],
    sill: 0.36, floor: 0.32, tumble: 0.08, crown: 0.035, shoulder: 0.85,
    arches: [{ z: zf, r: 0.455, cy: r, sq: 0.9 }, { z: zr, r: 0.455, cy: r, sq: 0.9 }], inset: 0.31,
  });
  const gh = K.greenhouse(Bd, { st: [[1.035, null, 0.8], [0.885, 1.339, 0.782], [0.735, 1.43, 0.739], [0.585, 1.515, 0.697], [0.435, 1.595, 0.654], [0.285, 1.656, 0.63], [0.15, 1.684, 0.63], [0.135, 1.686, 0.63], [-0.015, 1.699, 0.63], [-0.165, 1.714, 0.63], [-0.315, 1.712, 0.63], [-0.465, 1.711, 0.63], [-0.615, 1.711, 0.63], [-0.765, 1.711, 0.63], [-0.915, 1.71, 0.629], [-1.065, 1.707, 0.622], [-1.215, 1.701, 0.614], [-1.365, 1.695, 0.607], [-1.515, 1.689, 0.6], [-1.665, 1.683, 0.592], [-1.815, 1.676, 0.585], [-1.965, 1.598, 0.588], [-1.97, 1.576, 0.589], [-2.115, 1.346, 0.609], [-2.2, null, 0.621]], roof: [6, 22], inset: 0.03, crown: 0.03, sideKey: 'Paint' });
  // side glass traced off the blueprint (z, y): chrome surround, black B pillar, slim C pillar, long upswept quarter glass
  const fd = [[0.775, 1.18], [0.505, 1.41], [0.286, 1.563], [0.05, 1.645], [-0.252, 1.64], [-0.19, 1.244], [0.4, 1.198]];
  const rd = [[-0.393, 1.633], [-0.977, 1.627], [-1.094, 1.282], [-0.393, 1.248]];
  const qg = [[-1.035, 1.64], [-1.584, 1.61], [-1.75, 1.5], [-1.896, 1.31], [-1.2, 1.275]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Chrome', K.grow(w, 0.016), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[-0.252, 1.645], [-0.393, 1.64], [-0.393, 1.245], [-0.19, 1.24]], 0.014);           // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.977, 1.632], [-1.035, 1.645], [-1.2, 1.272], [-1.094, 1.278]], 0.014);          // C pillar
  K.ghTop(gh, 'Paint', 0.15, 1.035, 0.92, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.56, 1.765, -0.2], [s * 0.53, 1.745, -1.62], 0.018, 5); for (const z of [-0.2, -1.62]) K.box('Trim', s * 0.55, 1.745, z, 0.04, 0.04, 0.08); }
  K.roofLip(gh, { z: -1.86, len: 0.12, key: 'Paint' });
  // nose: seven bright-ringed slots between slim lamps, black lower bumper, C-shaped fog bezels
  const gy = 0.92, gz = K.faceAt(Bd, gy) + 0.012, gt = K.faceTilt(Bd, 0.84, 1.0);
  for (let k = 0; k < 7; k++) { const x = -0.39 + k * 0.13;
    K.softGrille({ full: true, pts: [[-0.045, 0.08], [0.045, 0.08], [0.045, -0.075], [-0.045, -0.075]], x, y: gy, z: gz, tilt: gt, sw: 0.014, depth: 0.03, frame: 'Chrome', fill: 'Grille', round: 2, rad: 0.02 }); }
  const u0 = (u) => (u <= 1 ? 0.87 : 0.87 + (u - 1) * 0.0), u1 = (u) => (u <= 1 ? 0.995 : 0.995 + (u - 1) * 0.01);
  K.wrap(Bd, 'Gloss', { x0: 0.5, zb: 1.9, y0: u0, y1: u1, off: 0.011, n1: 4, n2: 4 });
  K.wrap(Bd, 'Head', { x0: 0.53, zb: 2.05, y0: (u) => u0(u) + 0.02, y1: (u) => u1(u) - 0.02, off: 0.015, n1: 4, n2: 2 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.1, y0: 0.36, y1: (u) => 0.7 - (u > 1 ? (u - 1) * 0.12 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.44, y1: 0.58, off: 0.014, n1: 3, rows: 1 });
  K.wrap(Bd, 'Chrome', { x0: 0.6, x1: 0.8, y0: 0.6, y1: 0.68, off: 0.012, n1: 2, rows: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.64, x1: 0.78, y0: 0.615, y1: 0.665, off: 0.016, n1: 2, rows: 1 });
  K.plate(0, 0.66, K.faceAt(Bd, 0.66) + 0.016, true);
  // tail: horizontal lamps from the corners onto the liftgate, chrome strip over a black valance
  const tl = [[-2.27, 1.2], [-2.03, 1.2], [-1.995, 1.17], [-2.10, 1.025], [-2.27, 1.03]];
  K.bodyPolyY(Bd, 'Tail', tl, 0.014);
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.34, zb: -2.2, y0: 1.04, y1: 1.18, n1: 5, n2: 2 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.38, x1: 0.84, y0: 1.045, y1: 1.07, off: 0.016, n1: 3, rows: 1 });
  K.plate(0, 0.98, K.faceAt(Bd, 0.98, -1) - 0.016, false);
  K.wrap(Bd, 'Chrome', { end: -1, x0: 0, x1: 0.72, y0: 0.74, y1: 0.77, off: 0.014, n1: 3, rows: 1 });
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -2.1, y0: 0.38, y1: 0.66, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.64, x1: 0.82, y0: 0.56, y1: 0.6, off: 0.014, n1: 2, rows: 1 });
  // side: black sill and arch lips
  K.skin(Bd, 'Clad', { z0: -2.25, z1: 2.2, y0: 0.36, y1: 0.45, off: 0.008, rows: 1 });
  K.archLips(Bd, 'Clad', { gap: -0.005, t: 0.03, y0: 0.45 });
  K.handles(Bd, [0.5, -0.55], 1.12, { key: 'Paint', l: 0.17, h: 0.04 });
  K.mirrors(0.93, 1.25, 0.68, { w: 0.21, h: 0.15 });
  K.wheels([zf, zr], { x: 0.82, r, w: 0.265, rim: 0.64, style: 'spoke', spokes: 5, split: true });
  return vMats(P, { body: '#eceef0', clad: '#1a1b1d', paint: { seams: [0.78, -0.3, -1.12, -2.25], hood: 1.035, belt: 1.2, sill: 0.45 } });
}
