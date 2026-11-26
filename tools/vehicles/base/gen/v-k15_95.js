// 1995 Delmont K15 Homesteader (full-size pickup, regular cab, short bed; counterpart: 1995 Chevrolet C/K 1500 "OBS"). Old era.
// v4 from reference photos (refs/cars/k15_95): square-shouldered work truck, flat upright face with a dark grey grille panel split
// by a bar, stacked lamps, chrome front bumper, black rub strip, slim vertical tail lamps, black step bumper, black steel wheels.
// 4.95 x 1.95 x 1.78 m, wheelbase 2.98 m, 235/75R15.
// eslint-disable-next-line no-unused-vars
function build_k15_95(K, P) {
  const r = 0.37, zf = 1.615, zr = -1.365, cab = -0.32;
  const Bd = K.body({
    top: [[cab, 1.17], [0.6, 1.17], [1.0, 1.165], [1.8, 1.14], [2.3, 1.115], [2.39, 1.09], [2.405, 0.9], [2.41, 0.74], [2.465, 0.72], [2.475, 0.6]],
    half: [[cab, 0.975], [2.2, 0.975], [2.4, 0.96], [2.475, 0.9]],
    bottom: [[cab, 0.46], [2.3, 0.46], [2.475, 0.5]],
    sill: 0.46, floor: 0.4, tumble: 0.035, crown: 0.02, shoulder: 0.7,
    arches: [{ z: zf, r: r + 0.07, cy: r, sq: 0.92 }], inset: 0.3,
  });
  const gh = K.greenhouse(Bd, { st: [[1.0, null, 0.86], [0.48, 1.76, 0.79], [-0.2, 1.77, 0.79], [-0.3, null, 0.86]], roof: [1, 2], inset: 0.03, crown: 0.025 });
  K.ghSide(gh, 'Paint', 0.48, 1.0, 0.84, 1.0);
  K.ghSide(gh, 'Paint', -0.3, -0.14, 0, 1.0);
  K.ghSide(gh, 'Trim', -0.14, 0.98, 0, 0.04, 0.018);
  K.ghSide(gh, 'Paint', -0.14, 0.5, 0.93, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.48, 1.0, 0.9, 1.0);
  K.bed({ z0: -2.475, z1: cab - 0.04, sill: 0.46, floor: 0.92, top: 1.2, w: 0.975, arch: { z: zr, r: r + 0.07, cy: r } });
  // nose: one dark grey panel across the flat face, grille split by a bar with the gold emblem, stacked lamps, chrome bumper
  const F = Bd.z1, wz = (z, y) => (z < cab ? 0.975 : Bd.wAt(z, y));
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.34, y0: 0.775, y1: 1.07, off: 0.008, n1: 5, n2: 1, rows: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.56, y0: 0.8, y1: 0.9, off: 0.014, n1: 2, rows: 1 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.56, y0: 0.95, y1: 1.045, off: 0.014, n1: 2, rows: 1 });
  K.wrap(Bd, 'Head', { x0: 0.6, zb: 2.36, y0: 0.935, y1: 1.045, off: 0.016, n1: 2, n2: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.6, x1: 0.86, y0: 0.8, y1: 0.915, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Amber', { x0: 0.86, zb: 2.36, y0: 0.8, y1: 0.915, off: 0.016, n1: 1, n2: 1, rows: 1 });
  K.box('Gold', 0, 0.925, K.faceAt(Bd, 0.925) + 0.02, 0.2, 0.06, 0.012);
  K.wrap(Bd, 'Chrome', { x0: 0, zb: 2.2, y0: 0.52, y1: 0.725, off: 0.01, n1: 5, n2: 2 });
  K.plate(0, 0.62, K.faceAt(Bd, 0.62) + 0.022, true);
  // side: black rub strip along cab and bed
  K.skin(Bd, 'Trim', { z0: -F + 0.02, z1: 2.3, y0: 0.78, y1: 0.82, w: wz, off: 0.012, rows: 1, arches: [{ z: zf, R: r + 0.08, cy: r }, { z: zr, R: r + 0.08, cy: r }] });
  for (const s of [-1, 1]) { K.box('Tail', s * 0.93, 1.0, -F - 0.02, 0.09, 0.36, 0.03); K.box('Clear', s * 0.93, 0.86, -F - 0.024, 0.07, 0.06, 0.03); }
  K.barX('Trim', 2.0, 0.6, -F - 0.08, 0.2, 0.14, 0.2); K.box('Trim', 0, 1.08, -F - 0.01, 0.16, 0.06, 0.02);
  K.plate(0, 0.6, -F - 0.145, false);
  K.handles(Bd, [-0.1], 1.06, { key: 'Trim' });
  K.mirrors(0.97, 1.24, 0.85, { w: 0.24, h: 0.2, key: 'Trim' });
  K.wheels([zf, zr], { x: 0.81, r, w: 0.245, rim: 0.54, style: 'steel', holes: 8 });
  return vMats(P, { body: '#5f93cc', clad: '#4a4d52', steel: '#1c1d1f', paint: { seams: [0.86, -0.26], hood: 1.02, belt: 1.15, sill: 0.7 } });
}
