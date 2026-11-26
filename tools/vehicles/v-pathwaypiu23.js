// 2023 Ironside Pathway Interceptor Utility (police SUV; counterpart: 2023 Ford Explorer Police Interceptor Utility). Newest era.
// v4 from reference photos (refs/cars/pathwaypiu23): long hood, black hexagon grille level with slim swept lamps, black lower
// intake with corner pockets, black sill and arch lips, roof that tapers down to a raked liftgate with a black rear pillar and
// spoiler, tall L-shaped tail lamps on the corners, black lower bumper, black steel wheels, push bar.
// 5.05 x 2.0 x 1.78 m, wheelbase 3.03 m, 255/60R18.
// eslint-disable-next-line no-unused-vars
function build_pathwaypiu23(K, P) {
  const r = 0.385, zf = 1.6, zr = -1.43;
  const Bd = K.body({
    top: [[-2.592, 0.42], [-2.588, 0.693], [-2.55, 0.693], [-2.5, 1.175], [-2.45, 1.257], [-2.4, 1.257], [-2.35, 1.29], [-2.1, 1.29], [-1.85, 1.287], [-1.6, 1.284], [-1.35, 1.265], [-1.1, 1.247], [-0.85, 1.235], [-0.6, 1.224], [-0.35, 1.212], [-0.1, 1.207], [0.15, 1.198], [0.4, 1.186], [0.65, 1.173], [0.9, 1.163], [1.02, 1.17], [1.05, 1.213], [1.25, 1.186], [1.45, 1.171], [1.55, 1.167], [1.75, 1.144], [1.95, 1.118], [2.05, 1.099], [2.1, 1.069], [2.25, 1.058], [2.3, 1.035], [2.35, 0.945], [2.4, 0.911], [2.446, 0.911], [2.45, 0.38]],
    half: [[-2.525, 0.5], [-2.46, 0.68], [-2.3, 0.79], [-2.1, 0.87], [-1.85, 0.945], [-1.45, 0.99], [-0.9, 0.985], [-0.2, 0.965], [0.6, 0.97], [1.3, 0.99], [1.65, 0.99], [1.95, 0.972], [2.15, 0.955], [2.3, 0.91], [2.41, 0.82], [2.48, 0.66], [2.525, 0.46]],
    bottom: [[-2.592, 0.456], [-2.4, 0.389], [-2.3, 0.404], [-2.2, 0.381], [-2.1, 0.362], [-2.0, 0.347], [-1.9, 0.475], [-1.8, 0.46], [-1.7, 0.445], [-1.6, 0.43], [-1.5, 0.415], [-1.4, 0.4], [-1.3, 0.385], [-1.2, 0.37], [-1.1, 0.355], [-1.0, 0.34], [-0.9, 0.494], [-0.8, 0.494], [-0.7, 0.513], [-0.6, 0.434], [-0.5, 0.43], [-0.4, 0.43], [-0.3, 0.426], [-0.2, 0.426], [-0.1, 0.423], [0.0, 0.419], [0.1, 0.415], [0.2, 0.415], [0.3, 0.411], [0.4, 0.385], [0.5, 0.389], [0.6, 0.381], [0.7, 0.385], [0.8, 0.302], [0.9, 0.302], [1.0, 0.441], [1.1, 0.295], [1.2, 0.322], [1.3, 0.345], [1.4, 0.368], [1.5, 0.392], [1.6, 0.415], [1.7, 0.438], [1.8, 0.462], [1.9, 0.485], [2.0, 0.508], [2.1, 0.235], [2.2, 0.235], [2.3, 0.283], [2.45, 0.287]],
    sill: 0.42, floor: 0.33, tumble: 0.07, crown: 0.03, shoulder: 0.9,
    arches: [{ z: zf, r: r + 0.07, cy: r, sq: 0.6 }, { z: zr, r: r + 0.07, cy: r, sq: 0.6 }], inset: 0.31,
  });
  const gh = K.greenhouse(Bd, { st: [[1.02, null, 0.792], [0.87, 1.284, 0.749], [0.72, 1.382, 0.707], [0.57, 1.478, 0.664], [0.42, 1.569, 0.63], [0.27, 1.644, 0.63], [0.2, 1.663, 0.63], [0.12, 1.693, 0.63], [-0.03, 1.709, 0.63], [-0.18, 1.708, 0.63], [-0.33, 1.71, 0.63], [-0.48, 1.709, 0.63], [-0.63, 1.708, 0.63], [-0.78, 1.707, 0.63], [-0.93, 1.706, 0.624], [-1.08, 1.703, 0.616], [-1.23, 1.699, 0.609], [-1.38, 1.696, 0.602], [-1.53, 1.692, 0.594], [-1.68, 1.685, 0.587], [-1.83, 1.702, 0.58], [-1.98, 1.643, 0.572], [-2.13, 1.617, 0.583], [-2.25, 1.611, 0.598], [-2.28, 1.41, 0.602], [-2.35, null, 0.611]], roof: [6, 23], inset: 0.03, crown: 0.03, sideKey: 'Paint' });
  // side glass traced off the blueprint (z, y): black frames, black B and C pillars, quarter glass, black D pillar under the spoiler
  const fd = [[0.885, 1.165], [0.6, 1.37], [0.32, 1.53], [0.05, 1.62], [-0.12, 1.628], [-0.08, 1.212]];
  const rd = [[-0.3, 1.625], [-0.89, 1.613], [-1.16, 1.32], [-1.1, 1.248], [-0.3, 1.212]];
  const qg = [[-1.0, 1.622], [-1.89, 1.612], [-2.13, 1.292], [-1.62, 1.286], [-1.25, 1.4]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Trim', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[-0.12, 1.632], [-0.3, 1.63], [-0.3, 1.208], [-0.08, 1.208]], 0.014);                  // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.89, 1.62], [-1.0, 1.626], [-1.25, 1.4], [-1.32, 1.26], [-1.1, 1.246], [-1.16, 1.32]], 0.014);   // C pillar
  K.ghPolyY(gh, 'Gloss', [[-1.75, 1.64], [-2.3, 1.64], [-2.35, 1.29], [-2.13, 1.288], [-1.75, 1.29]], 0.018);     // black D pillar
  K.ghTop(gh, 'Paint', 0.2, 1.02, 0.92, 1.0);
  K.roofLip(gh, { z: -2.12, len: 0.14, key: 'Paint', light: false });
  // nose
  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.58, y0: (u) => 0.66 + 0.33 * (1 - Math.sqrt(Math.max(0, 1 - u * u * u * u))), y1: 1.0, off: 0.012, n1: 12, rows: 2 });   // upside-down D grille, flat top from lamp to lamp
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.55, y0: (u) => 0.68 + 0.29 * (1 - Math.sqrt(Math.max(0, 1 - u * u * u * u))), y1: 0.985, off: 0.016, n1: 12, rows: 1 });
  K.box('Badge', 0, 0.87, K.faceAt(Bd, 0.87) + 0.024, 0.16, 0.06, 0.01);
  K.wrap(Bd, 'Gloss', { x0: 0.5, zb: 2.16, y0: (u) => 0.885 + (u > 1 ? (u - 1) * 0.07 : 0), y1: (u) => 1.012 - (u > 1 ? (u - 1) * 0.01 : 0), off: 0.012, n1: 4, n2: 3 });
  K.wrap(Bd, 'Head', { x0: 0.54, zb: 2.2, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.07 : 0), y1: (u) => 1.0 - (u > 1 ? (u - 1) * 0.01 : 0), off: 0.016, n1: 4, n2: 2, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.09, y0: 0.28, y1: (u) => 0.52 - (u > 1 ? (u - 1) * 0.04 : 0), off: 0.008, n1: 6, n2: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.56, y1: 0.72, off: 0.012, n1: 3, rows: 1 });
  K.wrap(Bd, 'Gloss', { x0: 0.6, x1: 0.86, y0: 0.6, y1: (u) => 0.7 + u * 0.02, off: 0.012, n1: 2, rows: 1 });
  for (const y of [0.625, 0.66]) K.wrap(Bd, 'Clad', { x0: 0.62, x1: 0.84, y0: y, y1: y + 0.014, off: 0.02, n1: 2, rows: 1 });   // pocket fins
  K.pushbar(2.7, 0.42, 1.05, 0.5);
  // tail: tall L lamps on the corners, black glass band, black lower bumper
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, zb: -2.2, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.12 : 0), y1: (u) => 1.13 - (u > 1 ? (u - 1) * 0.03 : 0), n1: 3, n2: 3 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.72, x1: 0.86, y0: 0.92, y1: 0.98, off: 0.016, n1: 2, rows: 1 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, x1: 0.68, y0: 1.04, y1: 1.12, off: 0.012, n1: 3, rows: 1 });
  K.plate(0, 0.898, K.faceAt(Bd, 0.898, -1) - 0.016, false);
  K.wrap(Bd, 'Clad', { end: -1, x0: 0, zb: -1.93, y0: 0.42, y1: 0.66, off: 0.008, n1: 5, n2: 3 });
  K.wrap(Bd, 'Tail', { end: -1, x0: 0.6, x1: 0.8, y0: 0.6, y1: 0.63, off: 0.014, n1: 2, rows: 1 });
  K.box('LightRed', 0, gh(-2.1).yr + gh.cr - 0.04, -2.27, 0.46, 0.02, 0.012);
  // side: black sill and arch lips
  K.skin(Bd, 'Clad', { z0: -2.4, z1: 2.35, y0: 0.4, y1: 0.5, off: 0.008, rows: 1 });
  K.archLips(Bd, 'Clad', { t: 0.045, y0: 0.5 });
  // low roof bar, spotlight, antennas
  K.lightbar(1.755, -0.10, 1.2, { segs: 8, keys: ['LightRed', 'LightRed', 'LightWhite', 'LightRed', 'LightBlue', 'LightWhite', 'LightBlue', 'LightBlue'] });
  K.spotlight(-0.93, 1.37, 0.97);
  for (const z of [-0.9, -1.3]) K.rod('Trim', [0.2, 1.72, z], [0.2, 1.92, z - 0.02], 0.008, 4);
  K.handles(Bd, [0.06, -1.05], 1.15, { key: 'Trim' });
  K.mirrors(1.0, 1.30, 0.85, { w: 0.22, h: 0.16, key: 'Trim' });
  K.wheels([zf, zr], { x: 0.84, r, w: 0.255, rim: 0.6, style: 'steel', holes: 6 });
  K.skin(Bd, 'Skin2', { z0: -2.3, z1: 2.2, y0: 0.62, y1: 0.72, gap: 0.03 });
  K.skin(Bd, 'Gold', { z0: -2.3, z1: 2.2, y0: 0.59, y1: 0.615, gap: 0.03 });
  const txt = P.textDecal({ text: 'POLICE', z0: -0.3, z1: 1.05, y0: 0.76, y1: 0.98, ink: '#1c3f8f' });
  const t2 = P.textDecal({ text: 'MAPLE GROVE PD', z0: -1.25, z1: -0.45, y0: 0.8, y1: 0.9, ink: '#16181c' });
  return vMats(P, { body: '#f2f3f4', clad: '#1a1b1d', steel: '#1c1d1f', skin2: '#1c3f8f', paint: { seams: [1.15, -0.36, -1.37, -2.38], hood: 1.1, belt: 1.13, sill: 0.52, decal: P.decals(txt, t2) } });
}
