// 2017 Delmont Camber SS (muscle coupe; counterpart: 2017 Chevrolet Camaro SS, 6th gen). Middle era.
// v4 from reference photos (refs/cars/comet17): low and wide with a chopped cabin and high belt, thin black nose band holding slim
// lamps and the gold emblem over a huge black lower intake, vented hood, thick C pillar, two slim tail lamps per side, lip
// spoiler, quad pipes. 4.78 x 1.90 x 1.35 m, wheelbase 2.81 m, 245/40R20.
// eslint-disable-next-line no-unused-vars
function build_comet17(K, P) {
  const r = 0.35, zf = 1.46, zr = -1.35;
  const Bd = K.body({
    top: [[-2.39, 0.48], [-2.385, 0.62], [-2.37, 0.92], [-2.33, 1.02], [-2.2, 1.045], [-1.7, 1.06], [-1.0, 1.04], [0.2, 0.99], [0.75, 0.98], [1.5, 0.9], [2.0, 0.8], [2.22, 0.74], [2.31, 0.68], [2.35, 0.56], [2.38, 0.5], [2.39, 0.42]],
    half: [[-2.39, 0.78], [-2.28, 0.9], [-1.8, 0.95], [-1.0, 0.95], [1.3, 0.95], [1.9, 0.92], [2.22, 0.83], [2.39, 0.66]],
    bottom: [[-2.39, 0.44], [-2.27, 0.41], [-1.94, 0.33], [-1.64, 0.28], [2.1, 0.22], [2.39, 0.24]],
    sill: 0.25, floor: 0.16, tumble: 0.12, crown: 0.045, shoulder: 0.64,
    arches: [{ z: zf, r: r + 0.05, cy: r }, { z: zr, r: r + 0.05, cy: r }], inset: 0.3,
  });
  // chopped cabin: short glass under a low roof
  const gh = K.greenhouse(Bd, { st: [[0.75, null, 0.7], [0.0, 1.295, 0.57], [-0.4, 1.3, 0.57], [-0.88, 1.26, 0.55], [-1.72, null, 0.62]], roof: [1, 3], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', 0.0, 0.75, 0.82, 1.0);
  K.ghSide(gh, 'Paint', -1.72, -1.0, 0, 1.0);               // thick C pillar
  K.ghSide(gh, 'Trim', -1.0, 0.7, 0, 0.04, 0.018);
  K.ghTop(gh, 'Paint', 0.0, 0.75, 0.9, 1.0); K.ghTop(gh, 'Paint', -1.72, -0.88, 0.86, 1.0);
  for (const s of [-1, 1]) K.box('Grille', s * 0.3, Bd.yt(1.3) + 0.05, 1.3, 0.18, 0.012, 0.3, [0.05, s * 0.25, 0]);   // hood vents
  K.box('Paint', 0, Bd.yt(1.5) + 0.04, 1.4, 0.5, 0.04, 1.1);
  // nose: thin black band with the slim lamps and the gold emblem, big black lower intake, corner vents
  K.wrap(Bd, 'Gloss', { x0: 0, zb: 2.1, y0: (u) => 0.62 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.7 - (u > 1 ? (u - 1) * 0.01 : 0), off: 0.008, n1: 6, n2: 3, rows: 1 });
  K.wrap(Bd, 'Head', { x0: 0.5, zb: 2.2, y0: (u) => 0.635 + (u > 1 ? (u - 1) * 0.04 : 0), y1: 0.69, off: 0.014, n1: 4, n2: 2, rows: 1 });
  K.wrap(Bd, 'LightWhite', { x0: 0.5, zb: 2.25, y0: 0.625, y1: 0.638, off: 0.016, n1: 4, n2: 2, rows: 1 });
  K.box('Gold', 0, 0.66, K.faceAt(Bd, 0.66) + 0.02, 0.16, 0.05, 0.012);
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.56, y0: 0.27, y1: (u) => 0.54 - u * 0.06, off: 0.01, n1: 4, rows: 2 });
  K.wrap(Bd, 'Gloss', { x0: 0.64, x1: 0.8, y0: 0.34, y1: (u) => 0.5 - u * 0.04, off: 0.012, n1: 2, rows: 1 });
  K.box('Trim', 0, 0.22, 2.32, 1.5, 0.03, 0.16);                                                // splitter
  // tail: two slim lamps per side, lip spoiler, black diffuser with quad tips
  for (const [a, b] of [[0.38, 0.6], [0.63, 0.86]]) K.wrap(Bd, 'Tail', { end: -1, x0: a, x1: b, y0: 0.88, y1: 0.96, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Trim', { end: -1, x0: 0.34, x1: 0.88, y0: 0.865, y1: 0.975, off: 0.008, n1: 3, rows: 1 });
  K.box('Gold', 0, 0.93, K.faceAt(Bd, 0.93, -1) - 0.012, 0.12, 0.04, 0.012);
  K.plate(0, 0.66, K.faceAt(Bd, 0.66, -1) - 0.016, false);
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, zb: -2.2, y0: 0.28, y1: 0.46, off: 0.008, n1: 5, n2: 2, rows: 1 });
  for (const x of [0.36, 0.5]) K.sbox('Chrome', x, 0.34, K.faceAt(Bd, 0.36, -1) - 0.02, 0.1, 0.1, 0.06);
  K.box('Paint', 0, 1.085, -2.32, 1.6, 0.025, 0.12); for (const s of [-1, 1]) K.box('Paint', s * 0.7, 1.06, -2.32, 0.04, 0.05, 0.08);
  K.skin(Bd, 'Gloss', { z0: -1.0, z1: 1.1, y0: 0.23, y1: 0.29, off: 0.01, rows: 1 });
  K.handles(Bd, [-0.32], 0.93, { key: 'Paint', l: 0.15, h: 0.04 });
  K.mirrors(0.9, 1.05, 0.6, { w: 0.19, h: 0.11 });
  K.wheels([zf, zr], { x: 0.81, r, w: 0.265, rim: 0.74, style: 'spoke', spokes: 5, spokeW: 0.3, rimKey: 'Steel' });
  return vMats(P, { body: '#1f4fb4', steel: '#b9bec4', paint: { seams: [0.8, -0.62], hood: 0.78, trunk: -1.75, belt: 0.96 } });
}
