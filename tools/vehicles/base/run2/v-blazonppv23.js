// 2023 Delmont Blazon Police Pursuit Vehicle (police crossover; counterpart: 2023 Chevrolet Blazer PPV). Newest era.
// v4 from reference photos (refs/cars/blazonppv23): thin light strips high on the hood edge, a big black mouth with a body-colour
// bar through it, lamp pods low in black corner pockets, rising beltline, black roof and pillars, roof tapering to a raked gate
// with spoiler, slim wide tail lamps, black lower cladding. 4.86 x 1.95 x 1.70 m, wheelbase 2.86 m, 235/65R18.
// eslint-disable-next-line no-unused-vars
function build_blazonppv23(K, P) {
  const r = 0.375, zf = 1.5, zr = -1.36;
  const Bd = K.body({
    top: [[-2.374, 0.45], [-2.37, 0.592], [-2.35, 0.592], [-2.3, 1.039], [-2.25, 1.1], [-2.0, 1.165], [-1.75, 1.272], [-1.5, 1.317], [-1.25, 1.27], [-1.0, 1.171], [-0.75, 1.113], [-0.5, 1.108], [-0.25, 1.104], [0.0, 1.1], [0.25, 1.097], [0.5, 1.094], [0.75, 1.091], [1.0, 1.079], [1.25, 1.061], [1.27, 1.06], [1.3, 1.039], [1.35, 1.024], [1.4, 1.061], [1.55, 1.054], [1.65, 1.039], [1.7, 1.039], [1.9, 1.008], [2.0, 0.993], [2.05, 0.978], [2.15, 0.963], [2.35, 0.902], [2.5, 0.842], [2.55, 0.759], [2.578, 0.759], [2.582, 0.34]],
    half: [[-2.430, 0.486], [-2.367, 0.671], [-2.214, 0.778], [-2.022, 0.855], [-1.781, 0.928], [-1.395, 0.972], [-0.865, 0.967], [-0.194, 0.948], [0.583, 0.953], [1.251, 0.972], [1.587, 0.972], [1.876, 0.955], [2.068, 0.938], [2.214, 0.894], [2.318, 0.807], [2.386, 0.651], [2.430, 0.452]],
    bottom: [[-2.374, 0.322], [-2.2, 0.231], [-2.1, 0.224], [-2.0, 0.216], [-1.9, 0.209], [-1.8, 0.209], [-1.7, 0.216], [-1.6, 0.222], [-1.5, 0.229], [-1.4, 0.236], [-1.3, 0.242], [-1.2, 0.249], [-1.1, 0.256], [-1.0, 0.262], [-0.9, 0.269], [-0.8, 0.262], [-0.7, 0.262], [-0.6, 0.262], [-0.5, 0.262], [-0.4, 0.262], [-0.3, 0.367], [-0.2, 0.375], [-0.1, 0.367], [0.0, 0.367], [0.1, 0.367], [0.2, 0.367], [0.3, 0.36], [0.4, 0.36], [0.5, 0.36], [0.6, 0.262], [0.7, 0.254], [0.8, 0.254], [0.9, 0.254], [1.0, 0.254], [1.1, 0.206], [1.2, 0.201], [1.3, 0.196], [1.4, 0.191], [1.5, 0.186], [1.6, 0.181], [1.7, 0.176], [1.8, 0.171], [1.9, 0.166], [2.0, 0.163], [2.1, 0.163], [2.2, 0.163], [2.3, 0.163], [2.4, 0.163], [2.5, 0.178], [2.582, 0.314]],
    sill: 0.4, floor: 0.31, tumble: 0.1, crown: 0.04, shoulder: 0.85,
    arches: [{ z: zf, r: r + 0.065, cy: r, sq: 0.5 }, { z: zr, r: r + 0.065, cy: r, sq: 0.5 }], inset: 0.3,
  });
  const gh = K.greenhouse(Bd, { st: [[1.27, null, 0.8], [1.12, 1.15, 0.8], [0.97, 1.229, 0.8], [0.82, 1.301, 0.775], [0.67, 1.368, 0.727], [0.52, 1.433, 0.68], [0.37, 1.481, 0.632], [0.22, 1.515, 0.61], [0.15, 1.54, 0.61], [0.07, 1.56, 0.61], [-0.08, 1.578, 0.61], [-0.23, 1.578, 0.61], [-0.38, 1.586, 0.61], [-0.53, 1.586, 0.61], [-0.68, 1.578, 0.61], [-0.83, 1.574, 0.61], [-0.98, 1.571, 0.605], [-1.13, 1.559, 0.597], [-1.28, 1.569, 0.588], [-1.43, 1.537, 0.579], [-1.58, 1.49, 0.57], [-1.73, 1.475, 0.562], [-1.82, 1.421, 0.556], [-1.88, 1.325, 0.553], [-2.03, 1.22, 0.566], [-2.18, 1.114, 0.591], [-2.25, null, 0.602]], roof: [8, 22], inset: 0.03, crown: 0.03, key: 'Gloss', sideKey: 'Paint' });
  // side glass traced off the blueprint (z, y): black frames and pillars, small quarter glass, black upper rear pillar (floating roof)
  const fd = [[1.12, 1.06], [0.69, 1.29], [0.3, 1.465], [0.0, 1.48], [-0.11, 1.475], [-0.11, 1.1], [0.6, 1.1]];
  const rd = [[-0.25, 1.468], [-0.77, 1.44], [-0.875, 1.34], [-0.89, 1.2], [-0.84, 1.12], [-0.25, 1.1]];
  const qg = [[-0.98, 1.415], [-1.42, 1.3], [-1.14, 1.25]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Gloss', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[-0.11, 1.48], [-0.25, 1.475], [-0.25, 1.098], [-0.11, 1.098]], 0.014);                   // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.8, 1.47], [-1.82, 1.53], [-2.25, 1.1], [-1.94, 1.18], [-1.61, 1.34], [-1.42, 1.3], [-0.9, 1.12]], 0.013);    // black C/D pillars
  K.ghTop(gh, 'Gloss', 0.15, 1.27, 0.92, 1.0);
  { // spoiler lip past the top of the rear glass, brake light
    const g1 = gh(-1.72), yR = g1.yr + gh.cr, lip = [[-1.66, yR - 0.004], [-1.86, yR - 0.035], [-1.88, yR - 0.075], [-1.76, yR - 0.09], [-1.66, yR - 0.06]];
    K.sideExtrude('Gloss', lip, 0.4, -0.4, 0.02);
    K.box('LightRed', 0, yR - 0.05, -1.878, 0.46, 0.02, 0.012);
  }
  // nose
  K.wrap(Bd, 'Gloss', { x0: 0, zb: 2.2, y0: (u) => 0.83 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.885 + (u > 1 ? (u - 1) * 0.03 : 0), off: 0.011, n1: 6, n2: 2, rows: 1 });
  K.wrap(Bd, 'Head', { x0: 0.42, zb: 2.25, y0: (u) => 0.845 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.87 + (u > 1 ? (u - 1) * 0.04 : 0), off: 0.016, n1: 4, n2: 2, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.42, y1: 0.82, off: 0.011, n1: 5, rows: 3 });
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.56, y0: 0.44, y1: 0.74, off: 0.015, n1: 5, rows: 1 });
  K.wrap(Bd, 'Skin', { x0: 0, x1: 0.6, y0: 0.76, y1: 0.8, off: 0.02, n1: 5, rows: 1 });         // body-colour bar
  K.box('Gold', 0, 0.744, K.faceAt(Bd, 0.744) + 0.03, 0.2, 0.05, 0.01);
  K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.26, y0: 0.56, y1: (u) => 0.72 - (u > 1 ? (u - 1) * 0.06 : 0), off: 0.011, n1: 3, n2: 1 });
  K.wrap(Bd, 'Head', { x0: 0.68, x1: 0.84, y0: 0.6, y1: 0.68, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.38, y1: 0.44, off: 0.008, n1: 6, n2: 2, rows: 1 });
  K.pushbar(2.6, 0.4, 1.0, 0.48);
  // tail: slim wide lamps, black lower bumper
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.34, zb: -1.75, y0: (u) => 0.98 + Math.min(u, 1) * 0.0 + (u > 1 ? (u - 1) * 0.08 : 0), y1: (u) => 1.07 + (u > 1 ? (u - 1) * 0.01 : 0), n1: 5, n2: 3 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0.36, x1: 0.84, y0: (u) => 1.035 + u * 0.03, y1: (u) => 1.055 + u * 0.03, off: 0.016, n1: 4, rows: 1 });
  K.box('Gold', 0, 1.008, K.faceAt(Bd, 1.008, -1) - 0.016, 0.16, 0.045, 0.01);
  K.plate(0, 0.841, K.faceAt(Bd, 0.841, -1) - 0.016, false);
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -2.08, y0: 0.4, y1: 0.68, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.62, x1: 0.8, y0: 0.6, y1: 0.63, off: 0.014, n1: 2, rows: 1 });
  // side: black sill and arch lips
  K.skin(Bd, 'Clad', { z0: -2.3, z1: 2.25, y0: 0.38, y1: 0.5, off: 0.008, rows: 1 });
  K.archLips(Bd, 'Clad', { t: 0.04, y0: 0.5 });
  K.lightbar(1.645, -0.25, 1.14, { segs: 8, keys: ['LightRed', 'LightRed', 'LightWhite', 'LightRed', 'LightBlue', 'LightWhite', 'LightBlue', 'LightBlue'] });
  K.spotlight(-0.92, 1.31, 0.82);
  K.handles(Bd, [0.4, -0.65], 1.13, { key: 'Trim' });
  K.mirrors(0.86, 1.25, 0.70, { w: 0.21, h: 0.15, key: 'Trim' });
  K.wheels([zf, zr], { x: 0.83, r, w: 0.245, rim: 0.6, style: 'steel', holes: 6 });
  // two-tone: black body, white doors (a geometry skin, so the edges stay crisp)
  K.skin(Bd, 'Skin', { z0: -1.4, z1: 0.98, y0: 0.5, y1: 1.07, rows: 5, gap: 0.03 });
  const txt = P.textDecal({ text: 'POLICE', z0: -0.25, z1: 0.95, y0: 0.74, y1: 0.92, ink: '#121316' });
  const t2 = P.textDecal({ text: 'MAPLE GROVE', z0: -1.3, z1: -0.6, y0: 0.78, y1: 0.88, ink: '#121316' });
  return vMats(P, { body: '#121316', clad: '#1a1b1d', steel: '#1c1d1f', skin: '#f2f3f4', skinDecal: P.decals(txt, t2), paint: { seams: [1.0, -0.44, -1.5], hood: 1.05, belt: 1.08, sill: 0.5 } });
}
