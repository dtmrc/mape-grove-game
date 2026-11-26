// 2003 Ironside Crown Marquis (full-size body-on-frame sedan; counterpart: 1998-2011 Ford Crown Victoria). Old era.
// v4 from reference photos (refs/cars/crown03): long flat hood and deck, rounded six-window cabin, chrome egg-crate grille with soft
// corners between big wraparound lamps with amber corners, body-colour bumpers with a bright strip, tall rounded tail lamps on
// the corners, plate panel flanked by clear reverse lamps, lace wheel covers.
// 5.39 x 1.99 x 1.44 m, wheelbase 2.91 m, 225/60R16.
// eslint-disable-next-line no-unused-vars
function build_crown03(K, P, o = {}) {
  const r = 0.345, zf = 1.625, zr = -1.285, br = o.police ? 'Trim' : 'Chrome';
  const Bd = K.body({
    top: [[-2.695, 0.56], [-2.69, 0.64], [-2.6, 0.67], [-2.585, 0.93], [-2.5, 0.985], [-1.9, 1.005], [-1.55, 1.0], [0.3, 0.995], [1.02, 0.985], [1.9, 0.93], [2.4, 0.875], [2.52, 0.845], [2.575, 0.7], [2.59, 0.64], [2.685, 0.625], [2.695, 0.55]],
    half: [[-2.695, 0.8], [-2.6, 0.93], [-2.3, 0.975], [-1.6, 0.995], [1.6, 0.995], [2.3, 0.97], [2.55, 0.92], [2.695, 0.78]],
    bottom: [[-2.695, 0.47], [-2.575, 0.44], [-2.245, 0.38], [-1.945, 0.33], [2.45, 0.33], [2.695, 0.38]],
    sill: 0.33, floor: 0.22, tumble: 0.08, crown: 0.035, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.065, cy: r }, { z: zr, r: r + 0.06, cy: r, sq: 0.9 }], inset: 0.3,
  });
  const gh = K.greenhouse(Bd, { st: [[1.02, null, 0.8], [0.22, 1.4, 0.66], [-0.4, 1.41, 0.665], [-1.05, 1.39, 0.65], [-1.62, null, 0.76]], roof: [1, 3], inset: 0.03, crown: 0.035 });
  K.ghSide(gh, 'Paint', 0.22, 1.02, 0.8, 1.0);
  K.ghSide(gh, 'Paint', -1.62, -1.33, 0, 1.0);              // C pillar behind the rear quarter glass
  K.ghSide(gh, 'Trim', -1.0, -0.94, 0, 1.0);                // rear door frame / quarter glass divider
  K.ghSide(gh, 'Trim', -0.28, -0.17, 0, 1.0);               // B pillar
  K.ghSide(gh, br, -1.33, 1.0, 0, 0.035, 0.018);
  K.ghSide(gh, br, -1.25, 0.27, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.22, 1.02, 0.9, 1.0); K.ghTop(gh, 'Paint', -1.62, -1.05, 0.88, 1.0);
  // nose
  K.wrap(Bd, 'Head', { x0: 0.5, x1: 0.76, y0: 0.675, y1: 0.8, n1: 4 });
  K.wrap(Bd, 'Amber', { x0: 0.76, zb: 2.36, y0: (u) => 0.675 + (u > 1 ? (u - 1) * 0.03 : 0), y1: 0.8, n1: 3, n2: 3 });
  const gy = 0.745, gz = K.faceAt(Bd, gy) + 0.01, gt = K.faceTilt(Bd, 0.68, 0.82);
  K.softGrille({ pts: [[0.46, 0.1], [0.43, -0.085]], y: gy, z: gz, tilt: gt, sw: 0.022, depth: 0.05, frame: 'Chrome', fill: 'Grille', round: 3, rad: 0.05,
    bars: [-0.055, -0.02, 0.02, 0.055].map((y) => [y, 0.012, 'Chrome']), vbars: Array.from({ length: 11 }, (_, k) => [-0.35 + k * 0.07, 0.01, 'Chrome']),
    badge: { w: 0.11, h: 0.05, key: 'Badge', ringKey: 'Chrome' } });
  K.wrap(Bd, br, { x0: 0, zb: 2.15, y0: 0.535, y1: 0.56, off: 0.014, n1: 6, n2: 3, rows: 1 });      // bright bumper strip
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.62, y0: 0.4, y1: 0.45, n1: 3, rows: 1 });
  K.plate(0, 0.5, K.faceAt(Bd, 0.5) + 0.014, true);
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, zb: -2.5, y0: 0.73, y1: (u) => 0.95 - (u < 0.35 ? (0.35 - u) * 0.12 : 0) - (u > 1 ? (u - 1) * 0.05 : 0), n1: 6, n2: 3 });
  K.wrap(Bd, 'Amber', { end: -1, x0: 0.63, x1: 0.9, y0: 0.74, y1: 0.775, off: 0.017, n1: 3, rows: 1 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.29, x1: 0.42, y0: 0.74, y1: (u) => 0.86 - u * 0.04, off: 0.014, n1: 2, rows: 1 });
  K.wrap(Bd, br, { end: -1, x0: 0, zb: -2.5, y0: 0.695, y1: 0.725, off: 0.016, n1: 6, n2: 2, rows: 1 });
  K.wrap(Bd, br, { end: -1, x0: 0, zb: -2.2, y0: 0.555, y1: 0.575, off: 0.014, n1: 6, n2: 3, rows: 1 });
  K.plate(0, 0.8, K.faceAt(Bd, 0.8, -1) - 0.016, false);
  K.box('Badge', 0, 0.93, K.faceAt(Bd, 0.93, -1) - 0.01, 0.09, 0.04, 0.015);
  // side
  K.skin(Bd, 'Paint', { z0: -2.5, z1: 2.45, y0: 0.56, y1: 0.64, off: 0.014, rows: 1, gap: 0.03 });
  K.skin(Bd, br, { z0: -2.5, z1: 2.45, y0: 0.6, y1: 0.615, off: 0.018, rows: 1, gap: 0.03 });
  K.handles(Bd, [0.5, -0.66], 0.9, { key: br, l: 0.16, h: 0.04 });
  K.mirrors(0.93, 1.02, 0.9, { w: 0.19, h: 0.13, key: o.police ? 'Trim' : 'Paint' });
  K.box('Paint', -0.997, 0.84, -1.75, 0.008, 0.14, 0.14);
  if (o.police) K.wheels([zf, zr], { x: 0.84, r, w: 0.225, rim: 0.62, style: 'steel', holes: 5 });
  else K.wheels([zf, zr], { x: 0.84, r, w: 0.225, rim: 0.64, style: 'spoke', spokes: 18, spokeW: 0.07, capKey: 'Chrome' });
  if (o.police) return;
  return vMats(P, { body: '#a39078', paint: { seams: [1.1, -0.22, -1.3], hood: 1.05, trunk: -1.66, belt: 0.93 } });
}
