// 2024 Regent Escalon (full-size luxury SUV; counterpart: 2024 Cadillac Escalade). Newest era.
// Run 2 (2026-11-25): outline, glass, pillars, arches and lamps measured off diet's 2021 side photo (refs side-photo.png),
// scaled by true height and length (the photo puts the wheels 8 cm further apart than the real 3.07 m).
// v4 from reference photos (refs/cars/escalon24): huge upright shield grille with a bright frame and the crest, slim lamps high on
// the corners, tall light blades in the bumper corners, slab sides with bright window and sill trim, full-height slim tail
// lamps, 22-inch bright wheels. 5.38 x 2.06 x 1.95 m, wheelbase 3.07 m, 275/50R22.
// eslint-disable-next-line no-unused-vars
function build_escalon24(K, P) {
  const r = 0.42, zf = 1.69, zr = -1.38;
  const Bd = K.body({
    top: [[-2.727, 0.45], [-2.723, 0.741], [-2.7, 0.741], [-2.65, 0.801], [-2.6, 1.093], [-2.57, 1.43], [-2.32, 1.43], [-2.07, 1.43], [-1.82, 1.43], [-1.57, 1.43], [-1.32, 1.43], [-1.07, 1.417], [-0.82, 1.405], [-0.57, 1.397], [-0.32, 1.39], [-0.07, 1.382], [0.18, 1.374], [0.43, 1.365], [0.68, 1.356], [0.93, 1.354], [1.18, 1.406], [1.22, 1.42], [1.25, 1.393], [1.3, 1.376], [1.4, 1.359], [1.45, 1.359], [1.5, 1.351], [1.55, 1.351], [1.6, 1.342], [1.65, 1.342], [1.8, 1.316], [1.85, 1.316], [1.95, 1.299], [2.0, 1.299], [2.2, 1.265], [2.3, 1.248], [2.35, 1.23], [2.4, 1.222], [2.45, 1.205], [2.5, 1.162], [2.55, 0.981], [2.599, 0.679], [2.603, 0.47]],
    half: [[-2.727, 0.74], [-2.667, 0.9], [-2.517, 0.99], [-2.137, 1.03], [2.013, 1.03], [2.363, 0.995], [2.533, 0.91], [2.603, 0.74]],
    bottom: [[-2.727, 0.45], [-2.6, 0.42], [-2.3, 0.42], [-1.9, 0.44], [1.15, 0.44], [2.2, 0.42], [2.5, 0.42], [2.603, 0.47]],
    sill: 0.44, floor: 0.36, tumble: 0.06, crown: 0.035, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.12, cy: r, sq: 0.92 }, { z: zr, r: r + 0.12, cy: r, sq: 0.92 }], inset: 0.33,
  });
  const gh = K.greenhouse(Bd, { st: [[1.22, null, 0.86], [1.07, 1.505, 0.847], [0.92, 1.599, 0.832], [0.77, 1.706, 0.817], [0.62, 1.783, 0.802], [0.47, 1.872, 0.801], [0.32, 1.865, 0.802], [0.3, 1.862, 0.802], [0.17, 1.881, 0.803], [0.02, 1.913, 0.804], [-0.13, 1.922, 0.805], [-0.28, 1.931, 0.806], [-0.43, 1.931, 0.806], [-0.58, 1.936, 0.807], [-0.73, 1.939, 0.808], [-0.88, 1.939, 0.809], [-1.03, 1.939, 0.81], [-1.18, 1.939, 0.809], [-1.33, 1.939, 0.808], [-1.48, 1.939, 0.807], [-1.63, 1.931, 0.805], [-1.78, 1.931, 0.804], [-1.93, 1.912, 0.803], [-2.08, 1.883, 0.802], [-2.23, 1.87, 0.801], [-2.33, 1.857, 0.8], [-2.38, 1.74, 0.8], [-2.53, 1.482, 0.847], [-2.57, null, 0.86]], roof: [7, 25], inset: 0.03, crown: 0.03, sideKey: 'Paint' });
  // side glass traced off diet's 2021 side photo (z, y): bright chrome surround, black B/C/D pillars (floating roof), black sail at the mirror
  const fd = [[0.87, 1.36], [0.87, 1.58], [0.5, 1.81], [0.42, 1.845], [0.06, 1.85], [0.06, 1.37]];
  const rd = [[-0.04, 1.85], [-0.92, 1.85], [-1.05, 1.41], [-0.04, 1.385]];
  const qg = [[-1.17, 1.85], [-2.15, 1.85], [-2.39, 1.44], [-1.2, 1.43]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Chrome', K.grow(w, 0.018), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[1.17, 1.43], [1.1, 1.5], [0.87, 1.6], [0.87, 1.35]], 0.014);                          // mirror sail
  K.ghPolyY(gh, 'Gloss', [[0.06, 1.87], [-0.04, 1.87], [-0.04, 1.38], [0.06, 1.37]], 0.014);                     // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.76, 1.85], [-0.785, 1.85], [-0.785, 1.4], [-0.76, 1.4]], 0.02);                     // rear door glass divider
  K.ghPolyY(gh, 'Gloss', [[-0.92, 1.87], [-1.17, 1.87], [-1.2, 1.43], [-1.05, 1.41]], 0.014);                    // C pillar
  K.ghPolyY(gh, 'Gloss', [[-2.15, 1.87], [-2.37, 1.87], [-2.58, 1.43], [-2.39, 1.43]], 0.014);                   // D pillar
  K.ghTop(gh, 'Paint', 0.3, 1.22, 0.92, 1.0);
  for (const s of [-1, 1]) K.rod('Gloss', [s * 0.7, 1.945, 0.45], [s * 0.7, 1.950, -2.19], 0.02, 5);
  K.roofLip(gh, { z: -2.25, len: 0.12, key: 'Paint' });
  // nose
  const gy = 0.86, gz = K.faceAt(Bd, gy) + 0.012;
  K.softGrille({ pts: [[0.7, 0.25], [0.68, 0.0], [0.6, -0.26]], y: gy, z: gz + 0.012, tilt: 0.17, sw: 0.03, depth: 0.05, frame: 'Chrome', fill: 'Gloss', round: 2, rad: 0.05 });
  {   // grille finish from the photo: chrome diamond studs on black, the Cadillac crest
    const tl = 0.17, c = Math.cos(tl), sn = Math.sin(tl), at = (x, dy, dz) => [x, gy + dy * c + dz * sn, gz + 0.012 - dy * sn + dz * c];
    const hw = (dy) => (dy > 0 ? 0.68 + (0.7 - 0.68) * dy / 0.25 : 0.68 + (0.6 - 0.68) * -dy / 0.26) - 0.06;
    for (let r = 0, dy = -0.225; dy < 0.225; r++, dy += 0.034) for (let x = (r % 2) * 0.024; x < hw(dy); x += 0.048) for (const sx of x ? [-1, 1] : [1]) {
      if (Math.abs(sx * x) < 0.14 && Math.abs(dy - 0.11) < 0.08) continue;                 // keep the crest clear
      K.box('Chrome', ...at(sx * x, dy, -0.004), 0.02, 0.02, 0.012, [-tl, 0, Math.PI / 4]);
    }
    const sh = new K.T.Shape(); sh.moveTo(-0.11, 0.05); sh.lineTo(0.11, 0.05); sh.lineTo(0.095, -0.02); sh.lineTo(0, -0.06); sh.lineTo(-0.095, -0.02); sh.closePath();
    K.put('Chrome', new K.T.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 }), at(0, 0.11, -0.01), [-tl, 0, 0]);
    for (const [qx, qy, key] of [[-0.048, 0.02, 'Gold'], [0.048, 0.02, 'Gloss'], [-0.04, -0.016, 'LightRed'], [0.04, -0.016, 'LightBlue']]) K.box(key, ...at(qx, 0.11 + qy, 0.016), 0.085, 0.032, 0.006, [-tl, 0, 0]);
    K.box('Chrome', ...at(0, 0.11, 0.02), 0.01, 0.09, 0.006, [-tl, 0, 0]); K.box('Chrome', ...at(0, 0.11, 0.02), 0.19, 0.008, 0.006, [-tl, 0, 0]);
  }
  K.wrap(Bd, 'Gloss', { x0: 0.66, zb: 2.25, y0: 0.965, y1: 1.07, off: 0.01, n1: 2, n2: 2, rows: 1 });
  K.wrap(Bd, 'Head', { x0: 0.7, zb: 2.3, y0: 0.985, y1: 1.05, off: 0.015, n1: 2, n2: 2, rows: 1 });
  K.bodyPolyY(Bd, 'Chrome', [[2.32, 0.95], [2.27, 0.95], [2.25, 0.5], [2.32, 0.47]], 0.012);
  K.wrap(Bd, 'Chrome', { x0: 0.62, x1: 0.98, y0: 0.45, y1: 0.48, off: 0.012, n1: 2, rows: 1 });                 // chrome hook along the bumper    // corner light blades
  K.bodyPolyY(Bd, 'LightWhite', [[2.305, 0.92], [2.285, 0.92], [2.27, 0.52], [2.305, 0.5]], 0.016);
  K.wrap(Bd, 'Gloss', { x0: 0, zb: 2.4, y0: 0.42, y1: (u) => 0.62 - (u > 1 ? (u - 1) * 0.1 : 0), off: 0.008, n1: 6, n2: 3 });
  K.plate(0, 0.52, K.faceAt(Bd, 0.52) + 0.016, true);
  K.bodyPolyY(Bd, 'Amber', [[2.06, 0.82], [2.0, 0.82], [2.0, 0.75], [2.06, 0.75]], 0.012);
  // tail: slim lamps the full height of the pillars
  K.bodyPolyY(Bd, 'Tail', [[-2.5, 1.42], [-2.575, 1.42], [-2.6, 0.95], [-2.53, 0.95]], 0.014);
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.86, zb: -2.5, y0: 0.95, y1: 1.4, n1: 1, n2: 1, rows: 3 });
  K.wrap(Bd, 'Chrome', { end: -1, x0: 0, x1: 0.84, y0: 1.2, y1: 1.24, off: 0.014, n1: 3, rows: 1 });
  K.box('Chrome', 0, 1.106, K.faceAt(Bd, 1.106, -1) - 0.012, 0.14, 0.09, 0.015);
  K.plate(0, 0.962, K.faceAt(Bd, 0.962, -1) - 0.016, false);
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, zb: -2.35, y0: 0.44, y1: 0.66, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, x1: 0.84, y0: 0.6, y1: 0.64, off: 0.014, n1: 2, rows: 1 });
  K.sbox('Chrome', 0.7, 0.5, K.faceAt(Bd, 0.5, -1) - 0.016, 0.26, 0.07, 0.03);
  // side: bright sill strip, black step
  K.skin(Bd, 'Chrome', { z0: -1.0, z1: 1.3, y0: 0.5, y1: 0.52, off: 0.012, rows: 1 });
  K.skin(Bd, 'Gloss', { z0: -0.95, z1: 1.25, y0: 0.42, y1: 0.47, off: 0.06, rows: 1 });
  K.handles(Bd, [0.2, -0.9], 1.21, { key: 'Paint', l: 0.18, h: 0.04 });
  K.mirrors(0.98, 1.42, 0.90, { w: 0.24, h: 0.18 });
  K.wheels([zf, zr], { x: 0.865, r, w: 0.275, rim: 0.72, style: 'spoke', spokes: 12, spokeW: 0.12, rimKey: 'Chrome' });
  return vMats(P, { body: '#3a3b40', paint: { seams: [1.21, 0.02, -1.18, -2.6], hood: 1.22, belt: 1.4, sill: 0.5 } });
}
