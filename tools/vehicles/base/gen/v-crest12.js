// 2012 Hikari Crest (compact crossover; counterpart: 2012 Honda CR-V, 4th gen). Middle era.
// v4 from reference photos (refs/cars/crest12): short sloping hood, three bright bars sweeping into big upswept lamps, black lower
// cladding and arch lips all round, rising belt with an upswept rear quarter window, tall tail lamps climbing the rear
// pillars, bright garnish over the plate. 4.53 x 1.82 x 1.655 m, wheelbase 2.62 m, 225/65R17.
// eslint-disable-next-line no-unused-vars
function build_crest12(K, P) {
  const r = 0.35, zf = 1.335, zr = -1.285;
  const Bd = K.body({
    top: [[-2.265, 0.5], [-2.26, 0.7], [-2.24, 1.098], [-2.18, 1.198], [-1.9, 1.209], [-0.6, 1.117], [1.1, 1.09], [1.6, 0.99], [2.0, 0.9], [2.14, 0.85], [2.2, 0.76], [2.235, 0.6], [2.26, 0.54], [2.265, 0.44]],
    half: [[-2.265, 0.455], [-2.206, 0.628], [-2.063, 0.728], [-1.884, 0.801], [-1.660, 0.869], [-1.300, 0.910], [-0.806, 0.905], [-0.181, 0.887], [0.544, 0.892], [1.166, 0.910], [1.479, 0.910], [1.749, 0.894], [1.928, 0.878], [2.063, 0.837], [2.161, 0.755], [2.224, 0.610], [2.265, 0.423]],
    bottom: [[-2.265, 0.46], [-2.05, 0.38], [2.0, 0.34], [2.265, 0.36]],
    sill: 0.37, floor: 0.28, tumble: 0.09, crown: 0.04, shoulder: 0.85,
    arches: [{ z: zf, r: r + 0.065, cy: r }, { z: zr, r: r + 0.065, cy: r }], inset: 0.3, ywarp: { nose: {"a": 0.681, "b": 0.964, "d": -0.157}, tail: {"a": 0.719, "b": 1.019, "d": -0.102} },
  });
  const gh = K.greenhouse(Bd, { st: [[1.0, null, 0.74], [0.4, 1.595, 0.58], [-0.6, 1.605, 0.58], [-1.765, 1.555, 0.52], [-2.18, null, 0.57]], roof: [1, 3], inset: 0.03, crown: 0.035 });
  K.ghSide(gh, 'Trim', 0.4, 1.0, 0.86, 1.0);
  K.ghSide(gh, 'Trim', -0.3, -0.18, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.2, -1.1, 0, 1.0);
  // side glass tapers to a point at the back: the roof rail curves down while the belt kicks up behind the rear door
  K.ghPoly(gh, 'Paint', [[-0.85, 0.9], [-0.85, 1.0], [-2.18, 1.0], [-2.18, 0.52], [-1.82, 0.56]]);
  K.ghPoly(gh, 'Paint', [[-1.18, 0.0], [-1.82, 0.56], [-2.18, 0.56], [-2.18, 0.0]]);
  K.ghSide(gh, 'Chrome', -1.4, 1.05, 0, 0.03, 0.018);
  K.ghTop(gh, 'Paint', 0.4, 1.0, 0.92, 1.0); K.ghTop(gh, 'Paint', -2.18, -1.85, 0.9, 1.0);
  K.roofLip(gh, { z: -1.74, key: 'Paint' });
  // nose
  const gy = 0.707, gz = K.faceAt(Bd, gy) + 0.008, gt = K.faceTilt(Bd, 0.66, 0.743);
  K.softGrille({ pts: [[0.46, 0.08], [0.36, -0.075]], y: gy, z: gz, tilt: gt, sw: 0.012, depth: 0.03, frame: 'Trim', fill: 'Grille', round: 2, rad: 0.03,
    bars: [[0.045, 0.022, 'Chrome'], [0.0, 0.022, 'Chrome'], [-0.045, 0.022, 'Chrome']], badge: { w: 0.11, h: 0.09, key: 'Chrome', ring: false } });
  K.wrap(Bd, 'Gloss', { x0: 0.46, zb: 1.72, y0: (u) => 0.7 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.1 : 0), y1: (u) => 0.83 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.02 : 0), off: 0.01, n1: 4, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.5, zb: 1.9, y0: (u) => 0.73 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.08 : 0), y1: (u) => 0.81 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.02 : 0), off: 0.015, n1: 4, n2: 2 });
  K.wrap(Bd, 'Amber', { x0: 0.76, zb: 1.8, y0: (u) => 0.75 + (u > 1 ? (u - 1) * 0.09 : 0), y1: (u) => 0.79 + (u > 1 ? (u - 1) * 0.06 : 0), off: 0.017, n1: 1, n2: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 1.85, y0: 0.35, y1: (u) => 0.56 - (u > 1 ? (u - 1) * 0.1 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.4, y0: 0.4, y1: 0.5, off: 0.014, n1: 3, rows: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.56, x1: 0.68, y0: 0.42, y1: 0.48, off: 0.016, n1: 2, rows: 1 });
  K.plate(0, 0.61, K.faceAt(Bd, 0.61) + 0.014, true);
  // tail: lamps climb the pillars from the belt almost to the roof
  K.ghSide(gh, 'Tail', -2.17, -2.04, 0, 0.9, 0.02);
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, zb: -2.05, y0: 0.98, y1: 1.19, n1: 3, n2: 2 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.62, x1: 0.84, y0: 0.99, y1: 1.03, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Chrome', { end: -1, x0: 0, x1: 0.42, y0: 1.03, y1: 1.07, off: 0.014, n1: 3, rows: 1 });
  K.plate(0, 0.858, K.faceAt(Bd, 0.858, -1) - 0.016, false);
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -1.9, y0: 0.38, y1: 0.62, off: 0.008, n1: 5, n2: 3 });
  K.skin(Bd, 'Clad', { z0: -2.15, z1: 2.05, y0: 0.35, y1: 0.48, off: 0.008, rows: 1 });
  K.archLips(Bd, 'Clad', { t: 0.035, y0: 0.48 });
  K.handles(Bd, [0.36, -0.6], 1.00, { key: 'Chrome', l: 0.16 });
  K.mirrors(0.87, 1.11, 0.80, { w: 0.2, h: 0.14 });
  K.wheels([zf, zr], { x: 0.78, r, w: 0.225, rim: 0.66, style: 'spoke', spokes: 5, spokeW: 0.26, twist: 0.2 });
  return vMats(P, { body: '#e9ebee', clad: '#1c1d1f', paint: { seams: [1.14, -0.24, -1.15, -2.14], hood: 1.1, belt: 1.05, sill: 0.48 } });
}
