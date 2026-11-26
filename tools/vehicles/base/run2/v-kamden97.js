// 1997 Kaito Kamden (mid-size family sedan; real-life counterpart: 1997-99 Toyota Camry XV20). Old era.
// v4 from reference photos (refs/cars/kamden97): tall glassy cabin with a long roof, short high trunk, body-colour bumpers,
// one long lamp unit per side with the amber signal wrapping the corner, small chrome grille between them, wraparound tail
// lamps that carry onto the trunk lid, body-colour side moulding, 7-slot hubcaps, mud flaps.
// 4.77 x 1.78 x 1.415 m, wheelbase 2.67 m, 205/65R15.
// eslint-disable-next-line no-unused-vars
function build_kamden97(K, P) {
  const r = 0.325, zf = 1.435, zr = -1.235;
  const Bd = K.body({
    top: [[-2.385, 0.52], [-2.38, 0.6], [-2.3, 0.63], [-2.285, 0.9], [-2.2, 0.965], [-1.7, 0.985], [-1.2, 0.975], [0.3, 0.945], [0.98, 0.94], [1.7, 0.84], [2.1, 0.755], [2.22, 0.715], [2.275, 0.6], [2.29, 0.565], [2.375, 0.55], [2.385, 0.47]],
    half: [[-2.385, 0.7], [-2.3, 0.82], [-2.0, 0.875], [-1.4, 0.89], [1.5, 0.89], [2.0, 0.87], [2.25, 0.8], [2.385, 0.66]],
    bottom: [[-2.385, 0.44], [-2.265, 0.41], [-1.935, 0.35], [-1.635, 0.3], [2.15, 0.28], [2.385, 0.3]],
    sill: 0.29, floor: 0.2, tumble: 0.07, crown: 0.035, shoulder: 0.6,
    arches: [{ z: zf, r: r + 0.055, cy: r }, { z: zr, r: r + 0.055, cy: r }], inset: 0.28,
  });
  const gh = K.greenhouse(Bd, { st: [[0.98, null, 0.72], [0.2, 1.37, 0.6], [-0.35, 1.38, 0.6], [-1.02, 1.36, 0.585], [-1.7, null, 0.68]], roof: [1, 3], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', 0.2, 0.98, 0.8, 1.0);               // A pillar
  K.ghSide(gh, 'Paint', -1.7, -1.2, 0, 1.0);                // C pillar
  K.ghSide(gh, 'Trim', -1.2, -1.05, 0, 0.75);               // fixed black quarter in the rear door
  K.ghSide(gh, 'Trim', -0.2, -0.09, 0, 1.0);                // B pillar
  K.ghSide(gh, 'Chrome', -1.2, 0.95, 0, 0.035, 0.018);      // bright belt moulding
  K.ghSide(gh, 'Chrome', -1.1, 0.25, 0.95, 1.0, 0.018);     // bright roof-edge moulding
  K.ghTop(gh, 'Paint', 0.2, 0.98, 0.9, 1.0); K.ghTop(gh, 'Paint', -1.7, -1.02, 0.88, 1.0);
  // nose
  const ly0 = 0.615, ly1 = 0.715;
  K.wrap(Bd, 'Head', { x0: 0.3, x1: 0.6, y0: ly0 + 0.01, y1: ly1 - 0.005, n1: 4 });
  K.wrap(Bd, 'Amber', { x0: 0.6, zb: 2.05, y0: (u) => ly0 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => ly1 - (u > 1 ? (u - 1) * 0.02 : 0), n1: 4, n2: 3 });
  const gy = 0.665, gz = K.faceAt(Bd, gy) + 0.006, gt = K.faceTilt(Bd, 0.62, 0.71);
  K.softGrille({ pts: [[0.28, 0.045], [0.23, -0.045]], y: gy, z: gz, tilt: gt, sw: 0.018, depth: 0.04, frame: 'Chrome', fill: 'Grille', bars: [[0.02, 0.008, 'Plastic'], [-0.02, 0.008, 'Plastic']], badge: { w: 0.09, h: 0.06, key: 'Chrome', ring: false }, round: 1 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.37, y1: 0.43, n1: 3, rows: 1 });                 // lower intake slot
  K.plate(0, 0.49, K.faceAt(Bd, 0.49) + 0.012, true);
  // tail: lamps wrap the corner and run onto the trunk lid, plate recess between them
  const ty0 = 0.775, ty1 = 0.885;
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.33, zb: -2.12, y0: (u) => ty0 + (u > 1 ? (u - 1) * 0.02 : 0), y1: (u) => ty1 - (u > 1 ? (u - 1) * 0.03 : 0), n1: 6, n2: 3 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.34, x1: 0.5, y0: ty0 + 0.005, y1: ty0 + 0.04, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Trim', { end: -1, x0: 0, x1: 0.31, y0: 0.76, y1: 0.89, off: 0.008, n1: 2, rows: 1 });   // plate recess
  K.plate(0, 0.825, K.faceAt(Bd, 0.825, -1) - 0.016, false);
  K.box('Chrome', 0, 0.93, K.faceAt(Bd, 0.93, -1) - 0.008, 0.07, 0.045, 0.015);
  // side: body-colour moulding, dark rocker, flap handles, mirrors, mud flaps
  K.skin(Bd, 'Paint', { z0: -2.2, z1: 2.15, y0: 0.5, y1: 0.555, off: 0.014, rows: 1, gap: 0.03 });
  K.skin(Bd, 'Trim', { z0: -2.0, z1: 2.0, y0: 0.27, y1: 0.33, off: 0.004, rows: 1 });
  K.handles(Bd, [0.4, -0.6], 0.84, { key: 'Plastic', l: 0.15, h: 0.04 });
  K.mirrors(0.84, 0.99, 0.82, { w: 0.18, h: 0.11 });
  for (const s of [-1, 1]) for (const az of [zf, zr]) K.box('Plastic', s * 0.8, 0.27, az - r - 0.07, 0.2, 0.2, 0.02);
  K.box('Paint', -0.893, 0.78, -1.5, 0.008, 0.13, 0.14);                                       // fuel door
  K.wheels([zf, zr], { x: 0.78, r, w: 0.205, rim: 0.62, style: 'disc', rimKey: 'Rim', hubKey: 'Rim' });
  for (const az of [zf, zr]) for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; K.box('RimIn', s * 0.835, r + Math.cos(a) * 0.135, az + Math.sin(a) * 0.135, 0.012, 0.03, 0.07, [a, 0, 0]); }
  return vMats(P, { body: '#1f4747', paint: { seams: [1.02, -0.14, -1.2], hood: 0.98, trunk: -1.72, belt: 0.9 } });
}
