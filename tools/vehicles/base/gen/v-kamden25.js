// 2025 Kaito Kamden Sport (mid-size sedan; counterpart: 2025 Toyota Camry XV80). New era.
// v4 from reference photos (refs/cars/kamden25): low pointed nose with slim C-shaped lamps joined by a thin black strip, a huge
// black trapezoid lower grille that widens toward the road, vertical air slits at the corners, fastback roofline, slim
// C-shaped tail lamps, black rear valance.
// 4.92 x 1.84 x 1.445 m, wheelbase 2.825 m, 215/55R17.
// eslint-disable-next-line no-unused-vars
function build_kamden25(K, P) {
  const r = 0.335, zf = 1.48, zr = -1.345;
  const Bd = K.body({
    top: [[-2.46, 0.5], [-2.455, 0.66], [-2.44, 0.93], [-2.4, 1.03], [-2.28, 1.055], [-1.86, 1.06], [-1.3, 1.04], [0.3, 0.985], [0.98, 0.975], [1.7, 0.9], [2.2, 0.81], [2.34, 0.77], [2.4, 0.72], [2.43, 0.62], [2.455, 0.5], [2.46, 0.42]],
    half: [[-2.460, 0.460], [-2.396, 0.635], [-2.241, 0.736], [-2.047, 0.810], [-1.803, 0.879], [-1.412, 0.920], [-0.876, 0.915], [-0.197, 0.897], [0.590, 0.902], [1.267, 0.920], [1.606, 0.920], [1.899, 0.903], [2.093, 0.888], [2.241, 0.846], [2.347, 0.764], [2.416, 0.616], [2.460, 0.428]],
    bottom: [[-2.46, 0.46], [-2.34, 0.43], [-2.01, 0.35], [-1.71, 0.3], [2.2, 0.24], [2.46, 0.26]],
    sill: 0.27, floor: 0.18, tumble: 0.09, crown: 0.04, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.055, cy: r }, { z: zr, r: r + 0.055, cy: r }], inset: 0.28,
  });
  const gh = K.greenhouse(Bd, { st: [[0.98, null, 0.73], [0.12, 1.4, 0.6], [-0.45, 1.41, 0.6], [-1.12, 1.38, 0.585], [-1.86, null, 0.68]], roof: [1, 3], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Trim', 0.12, 0.98, 0.84, 1.0);               // black A pillar
  K.ghSide(gh, 'Paint', -1.86, -1.5, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.25, -1.19, 0, 1.0);
  K.ghSide(gh, 'Trim', -0.3, -0.18, 0, 1.0);
  K.ghSide(gh, 'Chrome', -1.5, 0.92, 0, 0.03, 0.018);
  K.ghSide(gh, 'Chrome', -1.45, 0.18, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.12, 0.98, 0.92, 1.0); K.ghTop(gh, 'Paint', -1.86, -1.12, 0.88, 1.0);
  K.box('Trim', 0, 1.47, -0.95, 0.06, 0.05, 0.16);                                              // shark fin
  // nose
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.5, y0: 0.655, y1: 0.68, off: 0.01, n1: 3, rows: 1 });
  const hy0 = (u) => 0.65 + Math.min(u, 1) * 0.02 + (u > 1 ? (u - 1) * 0.04 : 0), hy1 = (u) => 0.7 + Math.min(u, 1) * 0.04;
  K.wrap(Bd, 'Gloss', { x0: 0.46, zb: 2.08, y0: hy0, y1: hy1, off: 0.012, n1: 5, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.5, zb: 2.2, y0: (u) => hy1(u) - 0.028, y1: (u) => hy1(u) - 0.008, off: 0.016, n1: 5, n2: 2, rows: 1 });
  K.box('Chrome', 0, 0.72, K.faceAt(Bd, 0.72) + 0.012, 0.09, 0.055, 0.012, [-0.5, 0, 0]);
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.68, y0: 0.3, y1: 0.555, off: 0.01, n1: 5, rows: 2 });
  K.wrap(Bd, 'Gloss', { x0: 0.68, x1: 0.74, y0: (u) => 0.3 + u * 0.05, y1: (u) => 0.5 - u * 0.04, off: 0.012, n1: 1, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0.79, x1: 0.83, y0: 0.4, y1: 0.6, off: 0.012, n1: 1, rows: 1 });  // air slit
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.36, zb: -2.2, y0: (u) => 0.9 + (u < 1 ? 0 : (u - 1) * 0.03), y1: (u) => 0.94 + (u < 1 ? u * 0.03 : 0.03 - (u - 1) * 0.02), n1: 6, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.7, x1: 0.84, y0: 0.84, y1: 0.9, n1: 2, rows: 1 });         // the C's lower leg
  K.box('Chrome', 0, 0.97, K.faceAt(Bd, 0.97, -1) - 0.008, 0.09, 0.06, 0.015);
  K.plate(0, 0.78, K.faceAt(Bd, 0.78, -1) - 0.016, false);
  K.wrap(Bd, 'Plastic', { end: -1, x0: 0, zb: -2.15, y0: 0.3, y1: 0.5, off: 0.008, n1: 5, n2: 3, rows: 1 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.62, x1: 0.8, y0: 0.45, y1: 0.475, off: 0.014, n1: 2, rows: 1 });
  K.box('Paint', 0, 1.075, -2.41, 1.5, 0.025, 0.08);                                              // deck lip
  K.skin(Bd, 'Plastic', { z0: -1.0, z1: 1.1, y0: 0.25, y1: 0.31, off: 0.004, rows: 1 });
  K.handles(Bd, [0.34, -0.72], 0.92, { key: 'Plastic', l: 0.17 });
  K.mirrors(0.86, 1.02, 0.8, { w: 0.19, h: 0.11 });
  K.wheels([zf, zr], { x: 0.795, r, w: 0.215, rim: 0.66, style: 'spoke', spokes: 5, split: true });
  return vMats(P, { body: '#3f6079', paint: { seams: [0.98, -0.24, -1.42], hood: 0.95, trunk: -1.9, belt: 0.93 } });
}
