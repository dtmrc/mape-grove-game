// 2024 Delmont Mako (mid-engine sports car; counterpart: 2024 Chevrolet Corvette C8). Newest era.
// v4 from reference photos (refs/cars/corsair24): mid-engine wedge, cabin pushed forward, pointed nose with slanted lamps and black
// corner intakes, black boomerang side intake, glass engine cover, angular twin tail lamps, corner pipes, wing.
// 4.63 x 1.93 x 1.235 m, wheelbase 2.72 m, 245/35R19 front, 305/30R20 rear.
// eslint-disable-next-line no-unused-vars
function build_corsair24(K, P) {
  const r = 0.345, zf = 1.385, zr = -1.335;
  const Bd = K.body({
    top: [[-2.315, 0.44], [-2.31, 0.6], [-2.3, 0.86], [-2.27, 0.955], [-2.15, 0.985], [-1.6, 1.0], [-0.9, 0.96], [0.3, 0.87], [0.95, 0.85], [1.5, 0.76], [1.95, 0.64], [2.15, 0.57], [2.25, 0.51], [2.3, 0.44], [2.315, 0.36]],
    half: [[-2.315, 0.82], [-2.2, 0.93], [-1.6, 0.965], [-0.6, 0.955], [1.2, 0.945], [1.8, 0.93], [2.15, 0.82], [2.315, 0.5]],
    bottom: [[-2.315, 0.4], [-2.195, 0.37], [-1.865, 0.29], [-1.565, 0.24], [2.05, 0.18], [2.315, 0.2]],
    sill: 0.2, floor: 0.13, tumble: 0.13, crown: 0.045, shoulder: 0.64,
    arches: [{ z: zf, r: r + 0.045, cy: r }, { z: zr, r: r + 0.06, cy: r + 0.01 }], inset: 0.3,
  });
  // mid-engine: cabin pushed forward, long glass engine cover falling to the deck
  const gh = K.greenhouse(Bd, { st: [[0.95, null, 0.68], [0.12, 1.19, 0.56], [-0.3, 1.2, 0.56], [-0.75, 1.14, 0.54], [-1.62, null, 0.56]], roof: [1, 3], inset: 0.03, crown: 0.035 });
  K.ghSide(gh, 'Trim', 0.12, 0.95, 0.84, 1.0);              // black A pillar and roof rail
  K.ghSide(gh, 'Trim', -0.6, 0.2, 0.9, 1.0, 0.018);
  K.ghSide(gh, 'Paint', -1.62, -0.55, 0, 1.0);              // buttress
  K.ghSide(gh, 'Trim', -0.55, 0.9, 0, 0.04, 0.018);
  K.ghTop(gh, 'Trim', 0.12, 0.95, 0.92, 1.0); K.ghTop(gh, 'Paint', -1.62, -0.75, 0.78, 1.0);
  // nose: pointed, slanted lamps, black corner intakes, splitter
  K.wrap(Bd, 'Gloss', { x0: 0.38, zb: 1.72, y0: (u) => 0.49 + Math.min(u, 1) * 0.06 + (u > 1 ? (u - 1) * 0.1 : 0), y1: (u) => 0.53 + Math.min(u, 1) * 0.09 + (u > 1 ? (u - 1) * 0.07 : 0), off: 0.012, n1: 4, n2: 4 });
  K.wrap(Bd, 'Head', { x0: 0.46, zb: 1.85, y0: (u) => 0.535 + Math.min(u, 1) * 0.07 + (u > 1 ? (u - 1) * 0.08 : 0), y1: (u) => 0.555 + Math.min(u, 1) * 0.07 + (u > 1 ? (u - 1) * 0.08 : 0), off: 0.016, n1: 4, n2: 3, rows: 1 });
  K.wrap(Bd, 'Honeycomb', { x0: 0.36, x1: 0.82, y0: 0.24, y1: (u) => 0.42 + u * 0.03, off: 0.01, n1: 3, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.3, y0: 0.24, y1: 0.31, off: 0.01, n1: 2, rows: 1 });
  K.plate(0, 0.38, K.faceAt(Bd, 0.38) + 0.014, true);
  K.box('Trim', 0, 0.185, 2.24, 1.6, 0.025, 0.18);
  // side: black boomerang intake behind the door
  for (const s of [-1, 1]) { K.box('Gloss', s * (Bd.half(-0.62) + 0.004), 0.66, -0.62, 0.03, 0.36, 0.1, [0.5, 0, 0]); K.box('Gloss', s * (Bd.half(-0.4) + 0.004), 0.8, -0.38, 0.03, 0.06, 0.5, [0.12, 0, 0]); }
  K.skin(Bd, 'Gloss', { z0: -0.9, z1: 1.0, y0: 0.18, y1: 0.25, off: 0.01, rows: 1 });
  // tail: two angular lamps per side over black vents, plate between, corner exhausts, wing
  for (const [a, b] of [[0.42, 0.62], [0.65, 0.88]]) K.wrap(Bd, 'Tail', { end: -1, x0: a, x1: b, y0: (u) => 0.8 + u * 0.01, y1: (u) => 0.88 + u * 0.02, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0.3, zb: -2.12, y0: 0.6, y1: (u) => 0.92 - (u > 1 ? (u - 1) * 0.1 : 0), off: 0.008, n1: 4, n2: 2 });
  K.wrap(Bd, 'Honeycomb', { end: -1, x0: 0.55, x1: 0.86, y0: 0.62, y1: 0.76, off: 0.014, n1: 2, rows: 1 });
  K.plate(0, 0.74, K.faceAt(Bd, 0.74, -1) - 0.016, false);
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, zb: -2.1, y0: 0.24, y1: 0.5, off: 0.008, n1: 5, n2: 2, rows: 1 });
  for (const x of [0.6, 0.74]) K.sbox('Chrome', x, 0.36, K.faceAt(Bd, 0.36, -1) - 0.02, 0.1, 0.09, 0.06);
  K.box('Gloss', 0, 1.06, -2.24, 1.66, 0.025, 0.14); for (const s of [-1, 1]) K.box('Gloss', s * 0.6, 1.02, -2.2, 0.04, 0.07, 0.1);
  K.handles(Bd, [0.05], 0.82, { key: 'Paint', l: 0.12, h: 0.03 });
  K.mirrors(0.9, 0.93, 0.72, { w: 0.18, h: 0.1, key: 'Gloss' });
  // staggered wheels: 19 in front, 20 in rear
  if (!K.mode) { for (const s of [-1, 1]) { K.wheel(s * 0.82, r, zf, { r, w: 0.245, rim: 0.74, style: 'spoke', spokes: 5, split: true, rimKey: 'Gloss' }); K.wheel(s * 0.81, r + 0.012, zr, { r: r + 0.012, w: 0.305, rim: 0.76, style: 'spoke', spokes: 5, split: true, rimKey: 'Gloss' }); } }
  K.wheelOpt = { r, w: 0.275, rim: 0.75, style: 'spoke', spokes: 5, split: true, rimKey: 'Gloss', x: 0.815, axles: [zf, zr] };
  return vMats(P, { body: '#9c1622', paint: { seams: [0.98, 0.0], hood: 0.95, trunk: -1.66, belt: 0.84 } });
}
