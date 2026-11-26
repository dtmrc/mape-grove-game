// 2004 Ironside F-15 Prairie SuperCrew (full-size pickup; counterpart: 2004 Ford F-150, 11th gen). Old era.
// v4 from reference photos (refs/cars/f15_04): tall blunt nose, big rounded honeycomb grille with the oval, large lamps, stepped
// hood, chrome bumper under a body-colour fascia, four-door cab, grey lower two-tone with flares, tall tail lamps.
// 5.68 x 2.0 x 1.92 m, wheelbase 3.55 m, 255/65R17.
// eslint-disable-next-line no-unused-vars
function build_f15_04(K, P) {
  const r = 0.39, zf = 1.89, zr = -1.66, cab = -1.05;
  const Bd = K.body({
    top: [[cab, 1.31], [1.15, 1.31], [1.9, 1.29], [2.6, 1.265], [2.72, 1.235], [2.755, 1.05], [2.765, 0.78], [2.83, 0.76], [2.84, 0.62]],
    half: [[cab, 0.995], [2.4, 0.995], [2.7, 0.965], [2.84, 0.88]],
    bottom: [[cab, 0.5], [2.6, 0.5], [2.84, 0.54]],
    sill: 0.5, floor: 0.42, tumble: 0.035, crown: 0.03, shoulder: 0.9,
    arches: [{ z: zf, r: r + 0.08, cy: r }], inset: 0.32,
  });
  const gh = K.greenhouse(Bd, { st: [[1.15, null, 0.86], [0.5, 1.9, 0.78], [-0.9, 1.91, 0.78], [-1.02, null, 0.86]], roof: [1, 2], inset: 0.03, crown: 0.03 });
  K.ghSide(gh, 'Paint', 0.5, 1.15, 0.84, 1.0);
  K.ghSide(gh, 'Trim', -0.22, -0.1, 0, 1.0);
  K.ghSide(gh, 'Paint', -1.02, -0.86, 0, 1.0);
  K.ghSide(gh, 'Trim', -0.86, 1.1, 0, 0.035, 0.018);
  K.ghSide(gh, 'Paint', -0.86, 0.55, 0.94, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.5, 1.15, 0.9, 1.0);
  K.box('Paint', 0, Bd.yt(1.9) + 0.045, 1.95, 1.0, 0.04, 1.5);                                  // raised hood centre
  K.bed({ z0: -2.84, z1: cab - 0.04, sill: 0.5, floor: 0.98, top: 1.34, w: 0.995, arch: { z: zr, r: r + 0.08, cy: r } });
  // nose: big rounded honeycomb grille with the oval, large lamps with amber inboard, body-colour upper bumper over chrome
  const F = Bd.z1, wz = (z, y) => (z < cab ? 0.995 : Bd.wAt(z, y)), gy = 1.04, gz = K.faceAt(Bd, gy) + 0.012;
  K.softGrille({ pts: [[0.5, 0.17], [0.47, -0.16]], y: gy, z: gz, tilt: K.faceTilt(Bd, 0.9, 1.2), sw: 0.035, depth: 0.05, frame: 'Clad', fill: 'Honeycomb', round: 3, rad: 0.07, badge: { w: 0.2, h: 0.085, key: 'Badge', ringKey: 'Chrome' } });
  K.wrap(Bd, 'Head', { x0: 0.56, zb: 2.6, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 1.2 - (u > 1 ? (u - 1) * 0.06 : 0), off: 0.014, n1: 3, n2: 2, rows: 3 });
  K.wrap(Bd, 'Amber', { x0: 0.56, x1: 0.7, y0: 0.9, y1: 0.97, off: 0.017, n1: 1, rows: 1 });
  K.wrap(Bd, 'Chrome', { x0: 0, zb: 2.5, y0: 0.54, y1: 0.755, off: 0.01, n1: 5, n2: 2 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.56, y1: 0.61, off: 0.016, n1: 2, rows: 1 });
  K.plate(0, 0.68, K.faceAt(Bd, 0.68) + 0.022, true);
  // grey lower two-tone with flares
  K.skin(Bd, 'Clad', { z0: -F + 0.02, z1: 2.7, y0: 0.49, y1: 0.7, w: wz, off: 0.008, arches: [{ z: zf, R: r + 0.1, cy: r }, { z: zr, R: r + 0.1, cy: r }] });
  K.archLips(Bd, 'Clad', { t: 0.045, y0: 0.7, arches: [{ z: zf, r: r + 0.08, cy: r }, { z: zr, r: r + 0.08, cy: r }], x: 0.995 });
  for (const s of [-1, 1]) { K.box('Tail', s * 0.92, 1.12, -F - 0.02, 0.14, 0.4, 0.03); K.box('Clear', s * 0.92, 1.1, -F - 0.026, 0.1, 0.07, 0.03); }
  K.box('Badge', 0, 1.14, -F - 0.012, 0.2, 0.085, 0.015); K.box('Trim', 0, 1.3, -F - 0.012, 0.2, 0.05, 0.02);
  K.barX('Chrome', 2.04, 0.64, -F - 0.06, 0.22, 0.14, 0.3);
  K.plate(0, 0.66, -F - 0.14, false);
  K.handles(Bd, [0.42, -0.5], 1.18, { key: 'Trim' });
  K.mirrors(1.0, 1.4, 1.05, { w: 0.26, h: 0.24, key: 'Trim' });
  K.wheels([zf, zr], { x: 0.85, r, w: 0.285, rim: 0.58, style: 'spoke', spokes: 7, spokeW: 0.2 });
  return vMats(P, { body: '#2b3a55', clad: '#6a7078', paint: { seams: [1.12, -0.16, -0.95], hood: 1.2, belt: 1.28, sill: 0.55 } });
}
