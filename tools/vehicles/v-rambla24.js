// 2024 Kaito Rambla (compact crossover; counterpart: 2024 Toyota RAV4, 5th gen). Newest era.
// Run 2 (2026-11-25): outline, glass, arches and lamps measured off the side blueprint (refs/cars/rambla24/side.jpg, a 2026 RAV4 on the
// same body and dimensions) in model metres; nose and tail details from the 2022 photos: big black trapezoid grille under slim lamps,
// squared black arch cladding, kicked-up quarter glass, black upper rear pillar under the roof spoiler, horizontal tail lamps.
// eslint-disable-next-line no-unused-vars
function build_rambla24(K, P) {
  const r = 0.36, zf = 1.375, zr = -1.315;
  const Bd = K.body({
    top: [[-2.309, 0.4], [-2.305, 0.607], [-2.25, 0.607], [-2.2, 1.094], [-2.17, 1.2], [-1.92, 1.26], [-1.67, 1.271], [-1.42, 1.198], [-1.17, 1.153], [-0.92, 1.136], [-0.67, 1.131], [-0.42, 1.127], [-0.17, 1.123], [0.08, 1.12], [0.33, 1.118], [0.58, 1.117], [0.83, 1.115], [1.02, 1.12], [1.05, 1.089], [1.25, 1.073], [1.45, 1.058], [1.65, 1.037], [1.85, 1.012], [1.95, 0.986], [2.05, 0.94], [2.2, 0.904], [2.247, 0.353], [2.251, 0.33]],
    half: [[-2.309, 0.464], [-2.249, 0.64], [-2.103, 0.742], [-1.921, 0.816], [-1.693, 0.885], [-1.325, 0.927], [-0.822, 0.922], [-0.185, 0.904], [0.54, 0.908], [1.159, 0.927], [1.47, 0.927], [1.738, 0.91], [1.915, 0.895], [2.05, 0.853], [2.147, 0.769], [2.211, 0.621], [2.251, 0.431]],
    bottom: [[-2.309, 0.386], [-2.2, 0.355], [-2.1, 0.329], [-2.0, 0.334], [-1.9, 0.288], [-1.8, 0.278], [-1.7, 0.269], [-1.6, 0.27], [-1.5, 0.271], [-1.4, 0.272], [-1.3, 0.273], [-1.2, 0.274], [-1.1, 0.276], [-1.0, 0.277], [-0.9, 0.278], [-0.8, 0.278], [-0.7, 0.293], [-0.6, 0.288], [-0.5, 0.258], [-0.4, 0.252], [-0.3, 0.258], [-0.2, 0.258], [-0.1, 0.258], [0.0, 0.258], [0.1, 0.258], [0.2, 0.258], [0.3, 0.258], [0.4, 0.258], [0.5, 0.258], [0.6, 0.258], [0.7, 0.273], [0.8, 0.273], [0.9, 0.273], [1.0, 0.278], [1.1, 0.277], [1.2, 0.277], [1.3, 0.276], [1.4, 0.275], [1.5, 0.275], [1.6, 0.274], [1.7, 0.274], [1.8, 0.273], [1.9, 0.273], [2.0, 0.268], [2.1, 0.268], [2.2, 0.268], [2.251, 0.302]],
    sill: 0.27, floor: 0.27, tumble: 0.08, crown: 0.04, shoulder: 0.85,
    arches: [{ z: zf, r: 0.43, cy: r, sq: 0.88 }, { z: zr, r: 0.43, cy: r, sq: 0.88 }], inset: 0.3,
  });
  const gh = K.greenhouse(Bd, { st: [[1.02, null, 0.76], [0.87, 1.194, 0.737], [0.72, 1.283, 0.695], [0.57, 1.36, 0.652], [0.42, 1.429, 0.61], [0.27, 1.487, 0.591], [0.12, 1.517, 0.592], [0.1, 1.519, 0.593], [-0.03, 1.532, 0.594], [-0.18, 1.539, 0.596], [-0.33, 1.54, 0.597], [-0.48, 1.541, 0.599], [-0.63, 1.542, 0.598], [-0.78, 1.542, 0.591], [-0.93, 1.543, 0.584], [-1.08, 1.541, 0.576], [-1.23, 1.537, 0.569], [-1.38, 1.534, 0.561], [-1.53, 1.526, 0.553], [-1.68, 1.519, 0.546], [-1.83, 1.499, 0.544], [-1.98, 1.464, 0.561], [-2.05, 1.445, 0.57], [-2.13, 1.197, 0.579], [-2.17, null, 0.584]], roof: [7, 22], inset: 0.03, crown: 0.035, sideKey: 'Paint' });
  // side glass traced off the blueprint (z, y): chrome surround, black B and C pillars, quarter glass kicked up at the back
  const fd = [[0.88, 1.12], [0.68, 1.234], [0.4, 1.33], [0.06, 1.417], [-0.17, 1.465], [-0.1, 1.12]];
  const rd = [[-0.33, 1.472], [-0.96, 1.47], [-0.925, 1.13], [-0.29, 1.122]];
  const qg = [[-1.1, 1.468], [-1.36, 1.465], [-1.53, 1.235], [-1.5, 1.205], [-1.21, 1.16]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Chrome', K.grow(w, 0.016), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[-0.175, 1.472], [-0.33, 1.475], [-0.29, 1.118], [-0.095, 1.118]], 0.014);           // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.965, 1.474], [-1.08, 1.474], [-1.2, 1.155], [-0.925, 1.128]], 0.014);           // C pillar
  K.ghPolyY(gh, 'Gloss', [[-1.36, 1.5], [-2.06, 1.5], [-2.17, 1.2], [-1.75, 1.3], [-1.53, 1.235]], 0.013);      // black upper D pillar
  K.ghTop(gh, 'Paint', 0.1, 1.02, 0.92, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.52, 1.615, -0.02], [s * 0.5, 1.61, -1.33], 0.02, 5); for (const z of [-0.02, -1.33]) K.box('Trim', s * 0.51, 1.59, z, 0.04, 0.05, 0.08); }
  K.roofLip(gh, { z: -1.9, len: 0.13, key: 'Trim' });
  K.sideExtrude('Trim', [[-1.62, 1.565], [-1.69, 1.6], [-1.74, 1.6], [-1.75, 1.565]], 0.03, -0.03, 0.01);
  // nose: big black trapezoid grille under the slim lamps, badge at its top, black lower bumper and corner vents
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.6, y1: (u) => 0.85 - Math.max(0, u - 0.55) * 0.5, off: 0.01, n1: 8, rows: 2 });            // upper grille: trapezoid, wide at the bottom, top corners cut under the lamps
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.55, y0: 0.625, y1: (u) => 0.825 - Math.max(0, u - 0.5) * 0.48, off: 0.014, n1: 8, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.52, y0: 0.33, y1: (u) => 0.5 - u * 0.04, off: 0.012, n1: 4, rows: 1 });                          // lower intake behind the plate
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.48, y0: 0.35, y1: (u) => 0.48 - u * 0.04, off: 0.015, n1: 4, rows: 1 });
  K.box('Chrome', 0, 0.835, K.faceAt(Bd, 0.835) + 0.016, 0.1, 0.07, 0.012);
  const u0 = (u) => (u <= 1 ? 0.8 + u * 0.03 : 0.83 + (u - 1) * 0.085), u1 = (u) => (u <= 1 ? 0.872 + u * 0.022 : 0.894 + (u - 1) * 0.07);   // lamps stay under the hood edge
  K.wrap(Bd, 'Gloss', { x0: 0.36, zb: 1.88, y0: (u) => u0(u) - 0.01, y1: (u) => u1(u) + 0.006, off: 0.011, n1: 4, n2: 4 });
  K.wrap(Bd, 'Head', { x0: 0.4, zb: 1.9, y0: (u) => u0(u) + 0.006, y1: (u) => u1(u) - 0.006, off: 0.015, n1: 3, n2: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 1.95, y0: 0.3, y1: (u) => 0.47 - (u > 1 ? (u - 1) * 0.06 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Gloss', { x0: 0.68, zb: 2.12, y0: (u) => 0.5 + u * 0.04, y1: (u) => 0.74 - u * 0.05, off: 0.012, n1: 2, n2: 2, rows: 1 });   // corner vents
  for (const yy of [0.56, 0.61, 0.66]) K.wrap(Bd, 'Clad', { x0: 0.69, zb: 2.13, y0: yy, y1: yy + 0.015, off: 0.016, n1: 2, n2: 2, rows: 1 });
  K.plate(0, 0.53, K.faceAt(Bd, 0.53) + 0.02, true);
  // tail: horizontal lamps joined by a black garnish, plate below
  const tl = [[-1.72, 1.03], [-1.88, 1.09], [-2.0, 1.115], [-2.205, 1.11], [-2.21, 1.05], [-2.0, 1.0], [-1.8, 0.998]];
  K.bodyPolyY(Bd, 'Tail', tl, 0.014);
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.36, zb: -2.15, y0: 1.0, y1: 1.11, n1: 5, n2: 2 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.4, x1: 0.8, y0: 1.005, y1: 1.025, off: 0.016, n1: 3, rows: 1 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, x1: 0.36, y0: 1.02, y1: 1.1, off: 0.012, n1: 2, rows: 1 });
  K.box('Chrome', 0, 1.06, K.faceAt(Bd, 1.06, -1) - 0.018, 0.09, 0.06, 0.012);
  K.plate(0, 0.88, K.faceAt(Bd, 0.88, -1) - 0.016, false);
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -1.95, y0: 0.38, y1: 0.66, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, x1: 0.8, y0: 0.56, y1: 0.59, off: 0.014, n1: 2, rows: 1 });
  // side: black sills and squared arch cladding
  K.skin(Bd, 'Clad', { z0: -2.2, z1: 2.1, y0: 0.27, y1: 0.45, off: 0.01, rows: 1, gap: 0.07 });
  K.archLips(Bd, 'Clad', { gap: -0.005, t: 0.045, y0: 0.42, flat: 0.6 });
  K.handles(Bd, [0.12, -0.75], 1.03, { key: 'Paint', l: 0.16, h: 0.04 });
  K.mirrors(0.89, 1.16, 0.7, { w: 0.2, h: 0.14 });
  K.wheels([zf, zr], { x: 0.795, r, w: 0.225, rim: 0.64, style: 'spoke', spokes: 5, split: true });
  return vMats(P, { body: '#6e8791', clad: '#2e3033', paint: { seams: [0.9, -0.2, -0.95, -2.18], hood: 1.02, belt: 1.11, sill: 0.45 } });
}
