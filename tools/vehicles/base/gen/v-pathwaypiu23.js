// 2023 Ironside Pathway Interceptor Utility (police SUV; counterpart: 2023 Ford Explorer Police Interceptor Utility). Newest era.
// v4 from reference photos (refs/cars/pathwaypiu23): long hood, black hexagon grille level with slim swept lamps, black lower
// intake with corner pockets, black sill and arch lips, roof that tapers down to a raked liftgate with a black rear pillar and
// spoiler, tall L-shaped tail lamps on the corners, black lower bumper, black steel wheels, push bar.
// 5.05 x 2.0 x 1.78 m, wheelbase 3.03 m, 255/60R18.
// eslint-disable-next-line no-unused-vars
function build_pathwaypiu23(K, P) {
  const r = 0.385, zf = 1.6, zr = -1.43;
  const Bd = K.body({
    top: [[-2.525, 0.52], [-2.52, 0.72], [-2.5, 1.189], [-2.44, 1.278], [-2.1, 1.297], [-0.5, 1.272], [1.15, 1.237], [1.9, 1.125], [2.3, 1.075], [2.44, 1.04], [2.49, 0.93], [2.505, 0.7], [2.52, 0.6], [2.525, 0.5]],
    half: [[-2.525, 0.5], [-2.46, 0.68], [-2.3, 0.79], [-2.1, 0.87], [-1.85, 0.945], [-1.45, 0.99], [-0.9, 0.985], [-0.2, 0.965], [0.6, 0.97], [1.3, 0.99], [1.65, 0.99], [1.95, 0.972], [2.15, 0.955], [2.3, 0.91], [2.41, 0.82], [2.48, 0.66], [2.525, 0.46]],
    bottom: [[-2.525, 0.52], [-2.3, 0.42], [2.25, 0.38], [2.525, 0.42]],
    sill: 0.42, floor: 0.33, tumble: 0.07, crown: 0.03, shoulder: 0.9,
    arches: [{ z: zf, r: r + 0.07, cy: r, sq: 0.6 }, { z: zr, r: r + 0.07, cy: r, sq: 0.6 }], inset: 0.31, ywarp: { nose: {"a": 0.63, "b": 0.891, "d": 0.008}, tail: {"a": 0.696, "b": 0.986, "d": 0.028} },
  });
  const gh = K.greenhouse(Bd, { st: [[1.05, null, 0.8], [0.45, 1.72, 0.63], [-0.8, 1.73, 0.63], [-2.025, 1.68, 0.57], [-2.42, null, 0.62]], roof: [1, 3], inset: 0.03, crown: 0.03 });
  K.ghSide(gh, 'Trim', 0.45, 1.05, 0.86, 1.0);
  K.ghSide(gh, 'Trim', -0.42, -0.3, 0, 1.0);
  K.ghPoly(gh, 'Paint', [[-1.3, 0.0], [-1.56, 0.0], [-1.2, 1.0], [-0.94, 1.0]]);                   // signature body-colour rear pillar leaning forward
  K.ghPoly(gh, 'Gloss', [[-1.6, 0.9], [-1.6, 1.0], [-2.42, 1.0], [-2.42, 0.0], [-2.2, 0.0]]);                                                  // black rear pillar
  K.ghTop(gh, 'Paint', 0.45, 1.05, 0.92, 1.0);
  K.roofLip(gh, { z: -2.0, key: 'Paint', light: false });
  // nose
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.56, y0: 0.8, y1: 1.0, off: 0.012, n1: 5, rows: 2 });
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.52, y0: 0.82, y1: 0.98, off: 0.016, n1: 5, rows: 1 });
  K.box('Badge', 0, 0.908, K.faceAt(Bd, 0.908) + 0.024, 0.16, 0.06, 0.01);
  K.wrap(Bd, 'Gloss', { x0: 0.56, zb: 2.16, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 1.0 - (u > 1 ? (u - 1) * 0.01 : 0), off: 0.012, n1: 4, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.6, zb: 2.22, y0: (u) => 0.925 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.975 - (u > 1 ? (u - 1) * 0.01 : 0), off: 0.016, n1: 4, n2: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.09, y0: 0.4, y1: (u) => 0.52 - (u > 1 ? (u - 1) * 0.04 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.56, y1: 0.72, off: 0.012, n1: 3, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0.6, x1: 0.86, y0: 0.58, y1: 0.72, off: 0.012, n1: 2, rows: 1 });
  K.pushbar(2.7, 0.42, 1.05, 0.5);
  // tail: tall L lamps on the corners, black glass band, black lower bumper
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, zb: -2.2, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.12 : 0), y1: (u) => 1.13 - (u > 1 ? (u - 1) * 0.03 : 0), n1: 3, n2: 3 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.72, x1: 0.86, y0: 0.92, y1: 0.98, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, x1: 0.68, y0: 1.04, y1: 1.12, off: 0.012, n1: 3, rows: 1 });
  K.plate(0, 0.898, K.faceAt(Bd, 0.898, -1) - 0.016, false);
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -1.93, y0: 0.42, y1: 0.66, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, x1: 0.8, y0: 0.6, y1: 0.63, off: 0.014, n1: 2, rows: 1 });
  K.box('LightRed', 0, gh(-1.94).yr + gh.cr - 0.052, -2.282, 0.46, 0.02, 0.012);
  // side: black sill and arch lips
  K.skin(Bd, 'Clad', { z0: -2.4, z1: 2.35, y0: 0.4, y1: 0.5, off: 0.008, rows: 1 });
  K.archLips(Bd, 'Clad', { t: 0.045, y0: 0.5 });
  // low roof bar, spotlight, antennas
  K.lightbar(1.755, -0.10, 1.2, { segs: 8, keys: ['LightRed', 'LightRed', 'LightWhite', 'LightRed', 'LightBlue', 'LightWhite', 'LightBlue', 'LightBlue'] });
  K.spotlight(-0.93, 1.37, 0.97);
  for (const z of [-0.9, -1.3]) K.rod('Trim', [0.2, 1.72, z], [0.2, 1.92, z - 0.02], 0.008, 4);
  K.handles(Bd, [0.58, -0.62], 1.16, { key: 'Trim' });
  K.mirrors(1.0, 1.30, 0.85, { w: 0.22, h: 0.16, key: 'Trim' });
  K.wheels([zf, zr], { x: 0.84, r, w: 0.255, rim: 0.6, style: 'steel', holes: 6 });
  K.skin(Bd, 'Skin2', { z0: -2.3, z1: 2.2, y0: 0.62, y1: 0.72, gap: 0.03 });
  K.skin(Bd, 'Gold', { z0: -2.3, z1: 2.2, y0: 0.59, y1: 0.615, gap: 0.03 });
  const txt = P.textDecal({ text: 'POLICE', z0: -0.3, z1: 1.05, y0: 0.76, y1: 0.98, ink: '#1c3f8f' });
  const t2 = P.textDecal({ text: 'MAPLE GROVE PD', z0: -1.25, z1: -0.45, y0: 0.8, y1: 0.9, ink: '#16181c' });
  return vMats(P, { body: '#f2f3f4', clad: '#1a1b1d', steel: '#1c1d1f', skin2: '#1c3f8f', paint: { seams: [1.15, -0.36, -1.37, -2.38], hood: 1.1, belt: 1.13, sill: 0.52, decal: P.decals(txt, t2) } });
}
