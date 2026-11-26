// 2024 Regent Escalon (full-size luxury SUV; counterpart: 2024 Cadillac Escalade). Newest era.
// v4 from reference photos (refs/cars/escalon24): huge upright shield grille with a bright frame and the crest, slim lamps high on
// the corners, tall light blades in the bumper corners, slab sides with bright window and sill trim, full-height slim tail
// lamps, 22-inch bright wheels. 5.38 x 2.06 x 1.95 m, wheelbase 3.07 m, 275/50R22.
// eslint-disable-next-line no-unused-vars
function build_escalon24(K, P) {
  const r = 0.42, zf = 1.69, zr = -1.38;
  const Bd = K.body({
    top: [[-2.69, 0.56], [-2.685, 0.8], [-2.67, 1.306], [-2.62, 1.366], [-2.0, 1.375], [1.2, 1.368], [2.0, 1.342], [2.5, 1.318], [2.61, 1.287], [2.645, 1.1], [2.655, 0.8], [2.685, 0.64], [2.69, 0.52]],
    half: [[-2.69, 0.74], [-2.63, 0.9], [-2.48, 0.99], [-2.1, 1.03], [2.1, 1.03], [2.45, 0.995], [2.62, 0.91], [2.69, 0.74]],
    bottom: [[-2.69, 0.52], [-2.45, 0.44], [2.45, 0.4], [2.69, 0.44]],
    sill: 0.44, floor: 0.36, tumble: 0.06, crown: 0.035, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.07, cy: r, sq: 0.92 }, { z: zr, r: r + 0.07, cy: r, sq: 0.92 }], inset: 0.33, ywarp: { nose: {"a": 0.704, "b": 0.995, "d": 0.074}, tail: {"a": 0.804, "b": 1.139, "d": -0.034} },
  });
  const gh = K.greenhouse(Bd, { st: [[1.1, null, 0.86], [0.6, 1.89, 0.8], [-1.0, 1.9, 0.81], [-2.39, 1.88, 0.8], [-2.64, null, 0.88]], roof: [1, 3], inset: 0.03, crown: 0.03 });
  K.ghSide(gh, 'Trim', 0.6, 1.1, 0.86, 1.0);
  K.ghSide(gh, 'Chrome', -0.42, -0.3, 0, 1.0);              // bright B pillar
  K.ghSide(gh, 'Trim', -1.5, -1.4, 0, 1.0);
  K.ghSide(gh, 'Trim', -2.64, -2.35, 0, 1.0);               // black D pillar, floating roof
  K.ghSide(gh, 'Chrome', -2.35, 1.15, 0, 0.03, 0.018);
  K.ghSide(gh, 'Chrome', -2.35, 0.55, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.6, 1.1, 0.92, 1.0);
  for (const s of [-1, 1]) K.rod('Gloss', [s * 0.7, 1.945, 0.45], [s * 0.7, 1.950, -2.19], 0.02, 5);
  K.roofLip(gh, { z: -2.37, len: 0.24, key: 'Paint' });
  // nose
  const gy = 1.025, gz = K.faceAt(Bd, gy) + 0.012;
  K.softGrille({ pts: [[0.62, 0.25], [0.52, -0.26]], y: gy, z: gz, sw: 0.03, depth: 0.05, frame: 'Chrome', fill: 'Mesh', round: 2, rad: 0.05, badge: { w: 0.2, h: 0.14, key: 'Chrome', ring: false, y: 0.12 } });
  K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.45, y0: 1.1, y1: 1.2, off: 0.01, n1: 2, n2: 2, rows: 1 });
  K.wrap(Bd, 'Head', { x0: 0.67, zb: 2.5, y0: 1.13, y1: 1.18, off: 0.015, n1: 2, n2: 2, rows: 1 });
  K.wrap(Bd, 'Chrome', { x0: 0.78, x1: 0.9, y0: 0.5, y1: 0.98, off: 0.012, n1: 1, rows: 2 });    // corner light blades
  K.wrap(Bd, 'LightWhite', { x0: 0.82, x1: 0.86, y0: 0.54, y1: 0.94, off: 0.016, n1: 1, rows: 2 });
  K.wrap(Bd, 'Gloss', { x0: 0, zb: 2.4, y0: 0.42, y1: (u) => 0.62 - (u > 1 ? (u - 1) * 0.1 : 0), off: 0.008, n1: 6, n2: 3 });
  K.plate(0, 0.6, K.faceAt(Bd, 0.6) + 0.016, true);
  // tail: slim lamps the full height of the pillars
  K.ghSide(gh, 'Tail', -2.63, -2.56, 0, 0.92, 0.022);
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.86, zb: -2.6, y0: 0.8, y1: 1.3, n1: 1, n2: 1, rows: 3 });
  K.wrap(Bd, 'Chrome', { end: -1, x0: 0, x1: 0.84, y0: 1.2, y1: 1.24, off: 0.014, n1: 3, rows: 1 });
  K.box('Chrome', 0, 1.106, K.faceAt(Bd, 1.106, -1) - 0.012, 0.14, 0.09, 0.015);
  K.plate(0, 0.962, K.faceAt(Bd, 0.962, -1) - 0.016, false);
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, zb: -2.35, y0: 0.44, y1: 0.66, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, x1: 0.84, y0: 0.6, y1: 0.64, off: 0.014, n1: 2, rows: 1 });
  K.sbox('Chrome', 0.7, 0.5, K.faceAt(Bd, 0.5, -1) - 0.016, 0.26, 0.07, 0.03);
  // side: bright sill strip, black step
  K.skin(Bd, 'Chrome', { z0: -1.0, z1: 1.3, y0: 0.6, y1: 0.63, off: 0.012, rows: 1 });
  K.skin(Bd, 'Gloss', { z0: -0.95, z1: 1.25, y0: 0.42, y1: 0.47, off: 0.06, rows: 1 });
  K.handles(Bd, [0.62, -0.6], 1.22, { key: 'Paint', l: 0.18, h: 0.04 });
  K.mirrors(1.0, 1.39, 0.90, { w: 0.24, h: 0.18 });
  K.wheels([zf, zr], { x: 0.865, r, w: 0.275, rim: 0.72, style: 'spoke', spokes: 12, spokeW: 0.12, rimKey: 'Chrome' });
  return vMats(P, { body: '#15161a', paint: { seams: [1.26, -0.36, -1.45, -2.6], hood: 1.22, belt: 1.26, sill: 0.5 } });
}
