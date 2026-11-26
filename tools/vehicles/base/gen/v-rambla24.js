// 2024 Kaito Rambla (compact crossover; counterpart: 2024 Toyota RAV4, 5th gen). Newest era.
// v4 from reference photos (refs/cars/rambla24): bluff angular nose with a black trapezoid grille and sharp slim lamps, squared black
// arch cladding and sills, rising belt with a kink at the rear door, horizontal tail lamps joined by a black garnish, grey
// lower bumpers, roof rails and spoiler. 4.6 x 1.855 x 1.7 m, wheelbase 2.69 m, 225/65R17.
// eslint-disable-next-line no-unused-vars
function build_rambla24(K, P) {
  const r = 0.36, zf = 1.375, zr = -1.315;
  const Bd = K.body({
    top: [[-2.3, 0.5], [-2.295, 0.74], [-2.28, 1.141], [-2.22, 1.232], [-1.9, 1.25], [-0.7, 1.186], [1.05, 1.045], [1.6, 1.044], [2.02, 0.97], [2.14, 0.93], [2.2, 0.82], [2.24, 0.64], [2.29, 0.58], [2.3, 0.46]],
    half: [[-2.300, 0.464], [-2.240, 0.640], [-2.095, 0.742], [-1.914, 0.816], [-1.686, 0.885], [-1.320, 0.927], [-0.819, 0.922], [-0.184, 0.904], [0.552, 0.908], [1.184, 0.927], [1.502, 0.927], [1.776, 0.910], [1.957, 0.895], [2.095, 0.853], [2.194, 0.769], [2.259, 0.621], [2.300, 0.431]],
    bottom: [[-2.3, 0.48], [-2.08, 0.4], [2.0, 0.36], [2.3, 0.38]],
    sill: 0.39, floor: 0.3, tumble: 0.08, crown: 0.04, shoulder: 0.85,
    arches: [{ z: zf, r: r + 0.07, cy: r, sq: 0.88 }, { z: zr, r: r + 0.07, cy: r, sq: 0.88 }], inset: 0.3, ywarp: { nose: {"a": 0.655, "b": 0.927, "d": -0.085}, tail: {"a": 0.732, "b": 1.037, "d": -0.08} },
  });
  const gh = K.greenhouse(Bd, { st: [[0.95, null, 0.76], [0.35, 1.64, 0.59], [-0.6, 1.65, 0.60], [-1.8, 1.6, 0.54], [-2.22, null, 0.59]], roof: [1, 3], inset: 0.03, crown: 0.035 });
  K.ghSide(gh, 'Trim', 0.35, 0.95, 0.86, 1.0);
  K.ghSide(gh, 'Trim', -0.3, -0.18, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.22, -1.12, 0, 1.0);
  // angular glass: belt kicks up hard at the rear pillar, small quarter window, black upper pillar (floating roof)
  K.ghPoly(gh, 'Paint', [[-1.5, 0.0], [-1.82, 0.45], [-2.22, 0.45], [-2.22, 0.0]]);
  K.ghPoly(gh, 'Gloss', [[-1.3, 0.9], [-1.3, 1.0], [-2.22, 1.0], [-2.22, 0.45], [-1.9, 0.45]]);
  K.ghSide(gh, 'Trim', -1.45, 1.0, 0, 0.03, 0.018);
  K.ghTop(gh, 'Paint', 0.35, 0.95, 0.92, 1.0); K.ghTop(gh, 'Paint', -2.22, -1.8, 0.9, 1.0);
  for (const s of [-1, 1]) K.rod('Trim', [s * 0.52, 1.695, 0.20], [s * 0.5, 1.670, -1.60], 0.018, 5);
  K.roofLip(gh, { z: -1.78, key: 'Trim' });
  K.box('Trim', 0, 1.67, -1.2, 0.06, 0.05, 0.16);
  // nose
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.48, y0: 0.62, y1: (u) => 0.84 - u * 0.03, off: 0.01, n1: 3, rows: 2 });
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.44, y0: 0.64, y1: (u) => 0.82 - u * 0.03, off: 0.014, n1: 3, rows: 1 });
  K.box('Chrome', 0, 0.796, K.faceAt(Bd, 0.796) + 0.014, 0.1, 0.07, 0.012);
  K.wrap(Bd, 'Gloss', { x0: 0.46, zb: 1.85, y0: (u) => 0.79 + Math.min(u, 1) * 0.02 + (u > 1 ? (u - 1) * 0.07 : 0), y1: (u) => 0.87 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.02 : 0), off: 0.011, n1: 4, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.5, zb: 1.98, y0: (u) => 0.81 + Math.min(u, 1) * 0.02 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.855 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.02 : 0), off: 0.015, n1: 4, n2: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 1.95, y0: 0.37, y1: (u) => 0.58 - (u > 1 ? (u - 1) * 0.08 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.42, y1: 0.52, off: 0.014, n1: 3, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0.62, x1: 0.74, y0: 0.5, y1: 0.74, off: 0.012, n1: 1, rows: 1 });   // corner vents
  K.plate(0, 0.56, K.faceAt(Bd, 0.56) + 0.018, true);
  // tail
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.38, zb: -2.08, y0: (u) => 1.06 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 1.15 - (u > 1 ? (u - 1) * 0.02 : 0), n1: 5, n2: 2 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.4, x1: 0.8, y0: 1.065, y1: 1.085, off: 0.016, n1: 3, rows: 1 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, x1: 0.38, y0: 1.07, y1: 1.14, off: 0.012, n1: 2, rows: 1 });
  K.box('Chrome', 0, 1.025, K.faceAt(Bd, 1.025, -1) - 0.018, 0.09, 0.06, 0.012);
  K.plate(0, 0.885, K.faceAt(Bd, 0.885, -1) - 0.016, false);
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -1.95, y0: 0.4, y1: 0.72, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, x1: 0.8, y0: 0.6, y1: 0.63, off: 0.014, n1: 2, rows: 1 });
  // side: black sills and squared arch cladding
  K.skin(Bd, 'Clad', { z0: -2.2, z1: 2.1, y0: 0.37, y1: 0.52, off: 0.01, rows: 1, gap: 0.07 });
  K.archLips(Bd, 'Clad', { t: 0.05, y0: 0.5, flat: 0.6 });
  K.handles(Bd, [0.34, -0.6], 1.12, { key: 'Paint', l: 0.16, h: 0.04 });
  K.mirrors(0.89, 1.22, 0.75, { w: 0.2, h: 0.14 });
  K.wheels([zf, zr], { x: 0.795, r, w: 0.225, rim: 0.64, style: 'spoke', spokes: 5, split: true });
  return vMats(P, { body: '#6e8791', clad: '#2e3033', paint: { seams: [1.12, -0.24, -1.17, -2.18], hood: 1.08, belt: 1.08, sill: 0.52 } });
}
