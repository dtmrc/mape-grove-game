// 2012 Hikari Crest (compact crossover; counterpart: 2012 Honda CR-V, 4th gen). Middle era.
// Run 2 (2026-11-25): outline, glass, arches and lamps measured off the side blueprint (refs/cars/crest12/side-bp-b.jpg) in model
// metres (fit.py / gen.py / crop.py), front and rear details from the photos. Black B and C pillars, chrome-ringed pointed quarter
// glass, tall tail lamps climbing the D pillars, three bright bars into swept lamps, black cladding and wide arch lips.
// eslint-disable-next-line no-unused-vars
function build_crest12(K, P) {
  const r = 0.35, zf = 1.335, zr = -1.285;
  const Bd = K.body({
    top: [[-2.219, 0.47], [-2.215, 0.567], [-2.15, 0.837], [-2.1, 1.266], [-2.05, 1.3], [-1.8, 1.331], [-1.55, 1.296], [-1.3, 1.208], [-1.05, 1.176], [-0.8, 1.168], [-0.55, 1.16], [-0.3, 1.152], [-0.05, 1.143], [0.2, 1.135], [0.45, 1.127], [0.7, 1.118], [0.95, 1.12], [1.15, 1.119], [1.2, 1.105], [1.25, 1.08], [1.3, 1.091], [1.5, 1.064], [1.7, 1.031], [1.85, 0.998], [1.9, 0.979], [1.95, 0.952], [2.0, 0.906], [2.05, 0.829], [2.1, 0.692], [2.15, 0.619], [2.172, 0.619], [2.176, 0.42]],
    half: [[-2.219, 0.455], [-2.161, 0.628], [-2.021, 0.728], [-1.846, 0.801], [-1.626, 0.869], [-1.274, 0.91], [-0.79, 0.905], [-0.177, 0.887], [0.523, 0.892], [1.12, 0.91], [1.421, 0.91], [1.68, 0.894], [1.852, 0.878], [1.982, 0.837], [2.076, 0.755], [2.137, 0.61], [2.176, 0.423]],
    bottom: [[-2.219, 0.473], [-2.1, 0.325], [-2.0, 0.304], [-1.9, 0.274], [-1.8, 0.274], [-1.7, 0.271], [-1.6, 0.264], [-1.5, 0.257], [-1.4, 0.25], [-1.3, 0.243], [-1.2, 0.236], [-1.1, 0.229], [-1.0, 0.222], [-0.9, 0.215], [-0.8, 0.219], [-0.7, 0.219], [-0.6, 0.219], [-0.5, 0.219], [-0.4, 0.219], [-0.3, 0.211], [-0.2, 0.211], [-0.1, 0.211], [0.0, 0.211], [0.1, 0.208], [0.2, 0.211], [0.3, 0.222], [0.4, 0.252], [0.5, 0.238], [0.6, 0.238], [0.7, 0.238], [0.8, 0.238], [0.9, 0.224], [1.0, 0.221], [1.1, 0.218], [1.2, 0.216], [1.3, 0.213], [1.4, 0.21], [1.5, 0.207], [1.6, 0.204], [1.7, 0.201], [1.8, 0.249], [1.9, 0.271], [2.0, 0.304], [2.1, 0.304], [2.176, 0.331]],
    sill: 0.24, floor: 0.25, tumble: 0.09, crown: 0.04, shoulder: 0.85,
    arches: [{ z: zf, r: 0.45, cy: r }, { z: zr, r: 0.45, cy: r }], inset: 0.3,
  });
  const gh = K.greenhouse(Bd, { st: [[1.12, null, 0.74], [0.97, 1.206, 0.732], [0.82, 1.29, 0.692], [0.67, 1.372, 0.652], [0.52, 1.449, 0.612], [0.37, 1.513, 0.58], [0.22, 1.554, 0.58], [0.15, 1.569, 0.58], [0.07, 1.581, 0.58], [-0.08, 1.597, 0.58], [-0.23, 1.605, 0.58], [-0.38, 1.607, 0.58], [-0.53, 1.61, 0.58], [-0.68, 1.61, 0.576], [-0.83, 1.607, 0.568], [-0.98, 1.603, 0.56], [-1.13, 1.597, 0.553], [-1.28, 1.591, 0.545], [-1.43, 1.58, 0.537], [-1.58, 1.566, 0.53], [-1.73, 1.548, 0.522], [-1.8, 1.531, 0.524], [-1.88, 1.429, 0.534], [-2.05, null, 0.554]], roof: [7, 21], inset: 0.03, crown: 0.035, sideKey: 'Paint' });
  // side glass traced off the blueprint (z, y): black frames, black B and C pillars, chrome belt and quarter-glass ring
  const fd = [[0.93, 1.125], [0.8, 1.215], [0.6, 1.33], [0.4, 1.44], [0.2, 1.515], [0.0, 1.553], [-0.165, 1.555], [-0.175, 1.147], [0.2, 1.135], [0.7, 1.12]];
  const rd = [[-0.356, 1.548], [-1.0, 1.515], [-1.06, 1.18], [-0.345, 1.152]];
  const qg = [[-1.14, 1.5], [-1.67, 1.343], [-1.25, 1.195], [-1.225, 1.19]];
  K.ghPolyY(gh, 'Trim', K.grow(fd, 0.014), 0.012); K.ghPolyY(gh, 'Glass', fd, 0.016);
  K.ghPolyY(gh, 'Trim', K.grow(rd, 0.014), 0.012); K.ghPolyY(gh, 'Glass', rd, 0.016);
  K.ghPolyY(gh, 'Trim', [[0.985, 1.19], [0.93, 1.118], [0.87, 1.122], [0.88, 1.16]], 0.014);                      // mirror sail
  K.ghPolyY(gh, 'Gloss', [[-0.165, 1.562], [-0.36, 1.556], [-0.345, 1.148], [-0.175, 1.145]], 0.014);          // B pillar
  K.ghPolyY(gh, 'Gloss', [[-1.0, 1.522], [-1.13, 1.516], [-1.215, 1.182], [-1.06, 1.178]], 0.014);             // C pillar
  K.ghPolyY(gh, 'Chrome', K.grow(qg, 0.016), 0.012); K.ghPolyY(gh, 'Glass', qg, 0.016);
  K.ghPolyY(gh, 'Chrome', [[0.93, 1.112], [-1.22, 1.172], [-1.22, 1.186], [0.93, 1.126]], 0.018);              // belt moulding
  K.ghTop(gh, 'Paint', 0.2, 1.12, 0.92, 1.0);
  K.roofLip(gh, { z: -1.68, len: 0.14, key: 'Paint' });
  K.sideExtrude('Paint', [[-1.38, 1.62], [-1.47, 1.655], [-1.52, 1.66], [-1.535, 1.62]], 0.03, -0.03, 0.01);     // shark-fin antenna
  // nose: three bright bars between the lamps, black lower bumper with fog pockets
  const gy = 0.835, gz = K.faceAt(Bd, gy) + 0.008, gt = K.faceTilt(Bd, 0.74, 0.93);
  K.softGrille({ pts: [[0.47, 0.095], [0.44, 0.01], [0.36, -0.06], [0.0, -0.1]], y: gy, z: gz, tilt: gt, sw: 0.012, depth: 0.03, frame: 'Trim', fill: 'Grille', round: 2, rad: 0.03,
    bars: [[0.07, 0.022, 'Chrome', 0.9], [0.02, 0.022, 'Chrome', 0.84], [-0.03, 0.02, 'Chrome', 0.7]], badge: { w: 0.1, h: 0.085, key: 'Chrome', ring: false, y: 0.02 } });
  // lamps: one dark housing from the grille ends round the corner and up the fender (side outline traced off the blueprint)
  const up0 = (u) => (u <= 1 ? 0.84 - (1 - u) * 0.03 : 0.84 + (u - 1) * 0.17), up1 = (u) => (u <= 1 ? 0.935 : 0.935 + (u - 1) * 0.075);
  K.wrap(Bd, 'Gloss', { x0: 0.45, zb: 1.565, y0: up0, y1: up1, off: 0.01, n1: 4, n2: 5 });
  K.wrap(Bd, 'Chrome', { x0: 0.5, zb: 1.85, y0: (u) => up0(u) + 0.025, y1: (u) => up1(u) - 0.02, off: 0.013, n1: 3, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.52, x1: 0.8, y0: (u) => 0.85 + u * 0.01, y1: (u) => 0.915 + u * 0.01, off: 0.016, n1: 3, rows: 1 });
  for (const sd of [-1, 1]) { const c = new K.T.TorusGeometry(0.034, 0.008, 4, 16), y = 0.885, x = 0.7; K.put('Chrome', c, [sd * x, y, K.faceAtX(Bd, x, y) + 0.02]); }
  K.bodyPolyY(Bd, 'Amber', [[1.7, 0.935], [1.6, 0.975], [1.6, 0.955], [1.7, 0.915]], 0.016);
  K.wrap(Bd, 'Clad', { x0: 0, zb: 1.79, y0: 0.29, y1: (u) => 0.43 + (u > 1 ? (u - 1) * 0.04 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.4, y0: 0.33, y1: 0.42, off: 0.014, n1: 3, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0.48, x1: 0.84, y0: (u) => 0.475 - u * 0.04, y1: (u) => 0.545 + u * 0.05, off: 0.012, n1: 5, rows: 1 });   // fog pockets (blueprint: y 0.43-0.60)
  for (const sd of [-1, 1]) { const c = new K.T.CylinderGeometry(0.032, 0.032, 0.02, 14); c.rotateX(Math.PI / 2); K.put('Clear', c, [sd * 0.68, 0.51, K.faceAtX(Bd, 0.68, 0.51) + 0.012]); }
  // tail: lamps climb the pillars from the bumper line almost to the spoiler
  const tl = [[-1.76, 1.07], [-1.80, 1.03], [-2.09, 1.03], [-2.09, 1.25], [-2.03, 1.36], [-1.97, 1.36], [-1.93, 1.32]];
  K.bodyPolyY(Bd, 'Tail', tl, 0.014); K.ghPolyY(gh, 'Tail', tl, 0.02);
  K.ghEdge(gh, 'Tail', -2.05, -1.87, 0.84, 1.0, { off: 0.01 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.64, zb: -2.06, y0: 1.0, y1: 1.3, n1: 3, n2: 2 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.68, x1: 0.86, y0: 1.01, y1: 1.06, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, x1: 0.62, y0: 1.04, y1: 1.3, off: 0.012, n1: 4, rows: 2 });    // black panel under the hatch glass
  K.wrap(Bd, 'Chrome', { end: -1, x0: 0, x1: 0.5, y0: 1.005, y1: 1.035, off: 0.014, n1: 3, rows: 1 });
  K.box('Chrome', 0, 1.15, K.faceAt(Bd, 1.15, -1) - 0.02, 0.1, 0.08, 0.012);
  K.plate(0, 0.86, K.faceAt(Bd, 0.86, -1) - 0.016, false);
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -1.85, y0: 0.38, y1: 0.6, off: 0.008, n1: 5, n2: 3 });
  K.skin(Bd, 'Clad', { z0: -2.1, z1: 2.0, y0: 0.22, y1: 0.34, off: 0.008, rows: 1 });
  K.archLips(Bd, 'Clad', { gap: 0, t: 0.03, y0: 0.3, flat: 0.7 });
  K.handles(Bd, [-0.12, -1.02], 1.05, { key: 'Chrome', l: 0.16 });
  K.mirrors(0.87, 1.17, 0.66, { w: 0.2, h: 0.14 });
  K.wheels([zf, zr], { x: 0.78, r, w: 0.225, rim: 0.66, style: 'spoke', spokes: 5, spokeW: 0.26, twist: 0.2 });
  return vMats(P, { body: '#e9ebee', clad: '#1c1d1f', paint: { seams: [0.95, -0.25, -1.25, -2.05], hood: 1.12, belt: 1.11, sill: 0.34 } });
}
