// 2016 Rampart 1500 Ridgeback Crew Cab (full-size pickup; counterpart: 2016 Ram 1500, 4th gen). Middle era.
// v4 from reference photos (refs/cars/rampart16): tall domed hood, big chrome crosshair grille standing proud of lamps that sweep
// back, chrome bumpers, crew cab, tall tail lamps, bright 5-spoke wheels. 5.82 x 2.02 x 1.97 m, wheelbase 3.57 m, 275/60R20.
// eslint-disable-next-line no-unused-vars
function build_rampart16(K, P) {
  const r = 0.415, zf = 1.91, zr = -1.66, cab = -1.0;
  const Bd = K.body({
    top: [[cab, 1.35], [1.2, 1.35], [2.0, 1.32], [2.65, 1.29], [2.78, 1.25], [2.82, 1.05], [2.835, 0.82], [2.9, 0.8], [2.91, 0.64]],
    half: [[cab, 1.005], [2.4, 1.005], [2.75, 0.975], [2.91, 0.88]],
    bottom: [[cab, 0.52], [2.6, 0.52], [2.91, 0.54]],
    sill: 0.52, floor: 0.42, tumble: 0.035, crown: 0.025, shoulder: 0.92,
    arches: [{ z: zf, r: r + 0.08, cy: r }], inset: 0.32,
  });
  const gh = K.greenhouse(Bd, { st: [[1.2, null, 0.87], [0.52, 1.94, 0.79], [-0.86, 1.95, 0.79], [-0.97, null, 0.87]], roof: [1, 2], inset: 0.03, crown: 0.03 });
  K.ghSide(gh, 'Paint', 0.52, 1.2, 0.84, 1.0);
  K.ghSide(gh, 'Trim', -0.2, -0.08, 0, 1.0);
  K.ghSide(gh, 'Paint', -0.97, -0.82, 0, 1.0);
  K.ghSide(gh, 'Trim', -0.82, 1.15, 0, 0.035, 0.018);
  K.ghSide(gh, 'Paint', -0.82, 0.57, 0.94, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.52, 1.2, 0.9, 1.0);
  K.bed({ z0: -2.91, z1: cab - 0.04, sill: 0.52, floor: 1.02, top: 1.39, w: 1.005, arch: { z: zr, r: r + 0.08, cy: r } });
  K.box('Paint', 0, Bd.yt(2.0) + 0.05, 2.0, 0.8, 0.05, 1.5);                                  // power dome
  // nose: big chrome crosshair grille standing proud, lamps sweeping back beside it, chrome bumper with fog lamps
  const F = Bd.z1, gy = 1.02, gz = K.faceAt(Bd, gy) + 0.03;
  K.softGrille({ pts: [[0.5, 0.21], [0.46, -0.2]], y: gy, z: gz, tilt: K.faceTilt(Bd, 0.9, 1.2), sw: 0.045, depth: 0.07, frame: 'Chrome', fill: 'Grille', round: 3, rad: 0.07,
    bars: [[0.0, 0.05, 'Chrome'], [0.09, 0.016, 'Chrome'], [0.14, 0.016, 'Chrome'], [-0.09, 0.016, 'Chrome'], [-0.14, 0.016, 'Chrome']], vbars: [[0.0, 0.05, 'Chrome']], badge: { w: 0.13, h: 0.12, key: 'Chrome', ring: false } });
  K.wrap(Bd, 'Head', { x0: 0.54, zb: 2.62, y0: (u) => 0.98 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 1.2 - (u > 1 ? (u - 1) * 0.05 : 0), off: 0.014, n1: 3, n2: 2, rows: 3 });
  K.wrap(Bd, 'Amber', { x0: 0.54, zb: 2.62, y0: (u) => 0.98 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 1.03 + (u > 1 ? (u - 1) * 0.04 : 0), off: 0.017, n1: 3, n2: 2, rows: 1 });
  K.wrap(Bd, 'Chrome', { x0: 0, zb: 2.55, y0: 0.54, y1: 0.8, off: 0.01, n1: 5, n2: 2 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.42, y0: 0.56, y1: 0.62, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.62, x1: 0.78, y0: 0.6, y1: 0.67, off: 0.016, n1: 2, rows: 1 });
  K.plate(0, 0.71, K.faceAt(Bd, 0.71) + 0.022, true);
  for (const s of [-1, 1]) { K.box('Tail', s * 0.93, 1.15, -F - 0.02, 0.14, 0.44, 0.03); K.box('Clear', s * 0.93, 1.02, -F - 0.026, 0.09, 0.07, 0.03); }
  K.box('Chrome', 0, 1.2, -F - 0.012, 0.12, 0.13, 0.015); K.box('Trim', 0, 1.34, -F - 0.012, 0.2, 0.05, 0.02);
  K.barX('Chrome', 2.06, 0.64, -F - 0.06, 0.24, 0.14, 0.3);
  K.plate(0, 0.68, -F - 0.14, false);
  K.handles(Bd, [0.42, -0.5], 1.22, { key: 'Chrome' });
  K.mirrors(1.01, 1.44, 1.1, { w: 0.26, h: 0.24, key: 'Trim' });
  for (const s of [-1, 1]) K.box('Trim', s * 1.04, 0.5, -0.1, 0.14, 0.05, 1.6);
  K.wheels([zf, zr], { x: 0.855, r, w: 0.3, rim: 0.66, style: 'spoke', spokes: 5, spokeW: 0.34, rimKey: 'Chrome' });
  return vMats(P, { body: '#eceef0', paint: { seams: [1.16, -0.14, -0.9], hood: 1.2, belt: 1.32, sill: 0.56 } });
}
