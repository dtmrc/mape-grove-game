// 2023 Delmont Blazon Police Pursuit Vehicle (police crossover; counterpart: 2023 Chevrolet Blazer PPV). Newest era.
// v4 from reference photos (refs/cars/blazonppv23): thin light strips high on the hood edge, a big black mouth with a body-colour
// bar through it, lamp pods low in black corner pockets, rising beltline, black roof and pillars, roof tapering to a raked gate
// with spoiler, slim wide tail lamps, black lower cladding. 4.86 x 1.95 x 1.70 m, wheelbase 2.86 m, 235/65R18.
// eslint-disable-next-line no-unused-vars
function build_blazonppv23(K, P) {
  const r = 0.375, zf = 1.5, zr = -1.36;
  const Bd = K.body({
    top: [[-2.43, 0.62], [-2.425, 0.78], [-2.39, 1.11], [-2.31, 1.225], [-1.9, 1.255], [-0.5, 1.222], [1.0, 1.045], [1.8, 1.026], [2.2, 0.97], [2.33, 0.92], [2.375, 0.82], [2.4, 0.66], [2.42, 0.58], [2.43, 0.5]],
    half: [[-2.430, 0.486], [-2.367, 0.671], [-2.214, 0.778], [-2.022, 0.855], [-1.781, 0.928], [-1.395, 0.972], [-0.865, 0.967], [-0.194, 0.948], [0.583, 0.953], [1.251, 0.972], [1.587, 0.972], [1.876, 0.955], [2.068, 0.938], [2.214, 0.894], [2.318, 0.807], [2.386, 0.651], [2.430, 0.452]],
    bottom: [[-2.43, 0.62], [-2.22, 0.43], [2.15, 0.36], [2.43, 0.4]],
    sill: 0.4, floor: 0.31, tumble: 0.1, crown: 0.04, shoulder: 0.85,
    arches: [{ z: zf, r: r + 0.065, cy: r, sq: 0.5 }, { z: zr, r: r + 0.065, cy: r, sq: 0.5 }], inset: 0.3, ywarp: { nose: {"a": 0.65, "b": 0.918, "d": -0.075}, tail: {"a": 0.719, "b": 1.019, "d": -0.072} },
  });
  const gh = K.greenhouse(Bd, { st: [[0.9, null, 0.80], [0.3, 1.615, 0.61], [-0.9, 1.6, 0.61], [-1.93, 1.5, 0.55], [-2.3, null, 0.61]], roof: [1, 3], inset: 0.03, crown: 0.03, key: 'Gloss' });
  K.ghSide(gh, 'Gloss', 0.3, 0.9, 0.84, 1.0);
  K.ghSide(gh, 'Gloss', -0.5, -0.38, 0, 1.0);
  // rising belt with a hard kick at the rear pillar, small quarter window under a black roof
  K.ghPoly(gh, 'Paint', [[-1.05, 0.0], [-1.7, 0.52], [-2.3, 0.52], [-2.3, 0.0]]);
  K.ghPoly(gh, 'Gloss', [[-1.15, 0.9], [-1.15, 1.0], [-2.3, 1.0], [-2.3, 0.52], [-1.9, 0.52]]);
  { // spoiler: the black roof carries on past the top of the rear glass as a lip with drooped ends (like the real one)
    const g1 = gh(-1.86), yR = g1.yr + gh.cr, lip = [[-1.76, yR - 0.004], [-2.05, yR - 0.03], [-2.07, yR - 0.075], [-1.95, yR - 0.095], [-1.76, yR - 0.06]];
    K.sideExtrude('Gloss', lip, 0.4, -0.4, 0.02);
    for (const sd of [-1, 1]) K.sideExtrude('Gloss', lip.map(([z, y]) => [z + 0.02, y - 0.028]), sd * 0.55, sd * 0.38, 0.035);
    K.box('LightRed', 0, yR - 0.052, -2.068, 0.46, 0.02, 0.012);
  }
  // nose
  K.wrap(Bd, 'Gloss', { x0: 0, zb: 2.2, y0: (u) => 0.855 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.925 + (u > 1 ? (u - 1) * 0.03 : 0), off: 0.011, n1: 6, n2: 2, rows: 1 });
  K.wrap(Bd, 'Head', { x0: 0.42, zb: 2.25, y0: (u) => 0.885 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.91 + (u > 1 ? (u - 1) * 0.04 : 0), off: 0.016, n1: 4, n2: 2, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.42, y1: 0.86, off: 0.011, n1: 5, rows: 3 });
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.56, y0: 0.44, y1: 0.74, off: 0.015, n1: 5, rows: 1 });
  K.wrap(Bd, 'Skin', { x0: 0, x1: 0.6, y0: 0.76, y1: 0.8, off: 0.02, n1: 5, rows: 1 });         // body-colour bar
  K.box('Gold', 0, 0.744, K.faceAt(Bd, 0.744) + 0.03, 0.2, 0.05, 0.01);
  K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.26, y0: 0.56, y1: (u) => 0.72 - (u > 1 ? (u - 1) * 0.06 : 0), off: 0.011, n1: 3, n2: 1 });
  K.wrap(Bd, 'Head', { x0: 0.68, x1: 0.84, y0: 0.6, y1: 0.68, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.38, y1: 0.44, off: 0.008, n1: 6, n2: 2, rows: 1 });
  K.pushbar(2.6, 0.4, 1.0, 0.48);
  // tail: slim wide lamps, black lower bumper
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.34, zb: -2.16, y0: (u) => 1.02 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 1.1 + Math.min(u, 1) * 0.03 - (u > 1 ? (u - 1) * 0.01 : 0), n1: 5, n2: 3 });
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
