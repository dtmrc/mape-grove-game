// 2018 Rampart Bolter (full-size sedan; counterpart: 2018 Dodge Charger). Middle era. o.police -> Bolter Pursuit.
// v4 from reference photos (refs/cars/chaser18): blunt tall nose with one black grille-and-lamp band, big lower mouth, high belt with
// short glass, thick C pillar, fast rear glass, full-width racetrack tail lamp, lip spoiler.
// 5.04 x 1.905 x 1.48 m, wheelbase 3.05 m, 235/55R19.
// eslint-disable-next-line no-unused-vars
function build_chaser18(K, P, o = {}) {
  const r = 0.365, zf = 1.59, zr = -1.46;
  const Bd = K.body({
    top: [[-2.52, 0.5], [-2.515, 0.7], [-2.5, 1.0], [-2.46, 1.095], [-2.3, 1.105], [-1.95, 1.1], [-1.3, 1.07], [0.3, 1.02], [1.0, 1.01], [1.8, 0.94], [2.3, 0.86], [2.42, 0.825], [2.46, 0.76], [2.475, 0.58], [2.51, 0.56], [2.52, 0.48]],
    half: [[-2.52, 0.62], [-2.46, 0.8], [-2.3, 0.9], [-1.95, 0.945], [-1.4, 0.952], [1.5, 0.952], [2.1, 0.93], [2.35, 0.87], [2.46, 0.77], [2.52, 0.58]],
    bottom: [[-2.52, 0.46], [-2.4, 0.43], [-2.07, 0.35], [-1.77, 0.3], [2.3, 0.27], [2.52, 0.29]],
    sill: 0.29, floor: 0.2, tumble: 0.1, crown: 0.045, shoulder: 0.62,
    arches: [{ z: zf, r: r + 0.055, cy: r }, { z: zr, r: r + 0.055, cy: r }], inset: 0.3,
  });
  // low, short side glass under a long roof; thick C pillar, fast rear glass
  const gh = K.greenhouse(Bd, { st: [[1.0, null, 0.74], [0.15, 1.44, 0.62], [-0.45, 1.45, 0.62], [-1.2, 1.41, 0.6], [-2.0, null, 0.7]], roof: [1, 3], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', 0.15, 1.0, 0.82, 1.0);
  K.ghSide(gh, 'Paint', -2.0, -1.5, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.5, -1.3, 0, 0.6);                 // black rear quarter
  K.ghSide(gh, 'Trim', -0.38, -0.26, 0, 1.0);
  K.ghSide(gh, 'Trim', -1.5, 0.95, 0, 0.03, 0.018);
  K.ghSide(gh, 'Trim', -1.4, 0.2, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.15, 1.0, 0.9, 1.0); K.ghTop(gh, 'Paint', -2.0, -1.2, 0.88, 1.0);
  K.box('Paint', 0, Bd.yt(1.6) + 0.035, 1.6, 0.7, 0.03, 1.1);                                   // hood bulge
  // nose: one black mouth down the centre (slim barred grille, plate bar, lower mesh) between smoked lamps, fog slots in the corners
  const mk = o.police ? 'Trim' : 'Gloss';
  K.wrap(Bd, 'Clad', { x0: 0, x1: 0.56, y0: 0.66, y1: 0.795, off: 0.008, n1: 3, rows: 1 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.53, y0: 0.675, y1: 0.78, off: 0.012, n1: 3, rows: 1 });
  for (const y of [0.705, 0.745]) K.wrap(Bd, 'Clad', { x0: 0, x1: 0.53, y0: y, y1: y + 0.018, off: 0.02, n1: 3, rows: 1 });
  K.wrap(Bd, 'Clad', { x0: 0, x1: (0.46), y0: 0.53, y1: 0.66, off: 0.008, n1: 3, rows: 1 });         // plate bar
  K.wrap(Bd, 'Clad', { x0: 0, x1: 0.56, y0: 0.34, y1: 0.53, off: 0.008, n1: 3, rows: 1 });
  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.52, y0: 0.36, y1: 0.51, off: 0.012, n1: 3, rows: 1 });
  K.wrap(Bd, mk, { x0: 0.56, zb: 2.28, y0: (u) => 0.675 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.795 - (u > 1 ? (u - 1) * 0.03 : 0), off: 0.01, n1: 3, n2: 3 });   // smoked lamp housings
  K.wrap(Bd, 'Head', { x0: 0.6, x1: 0.74, y0: 0.705, y1: 0.765, off: 0.015, n1: 2, rows: 1 });
  K.wrap(Bd, 'LightWhite', { x0: 0.6, zb: 2.34, y0: 0.775, y1: 0.787, off: 0.016, n1: 3, n2: 2, rows: 1 });
  K.box(o.police ? 'Trim' : 'Chrome', 0.3, 0.69, K.faceAt(Bd, 0.69) + 0.025, 0.16, 0.018, 0.01);
  K.wrap(Bd, mk, { x0: 0.62, x1: 0.82, y0: 0.4, y1: 0.46, off: 0.01, n1: 2, rows: 1 });
  K.wrap(Bd, 'Clear', { x0: 0.64, x1: 0.8, y0: 0.42, y1: 0.445, off: 0.014, n1: 2, rows: 1 });
  K.plate(0, 0.595, K.faceAt(Bd, 0.595) + 0.018, true);
  // racetrack tail: one red loop across the back, deeper at the corners than across the lid, black inside
  const rt0 = (u) => (u < 0.5 ? 0.845 : u < 0.66 ? 0.845 - ((u - 0.5) / 0.16) * 0.07 : 0.775) + (u > 1 ? (u - 1) * 0.09 : 0);
  const rt1 = (u) => 1.005 - (u > 1 ? (u - 1) * 0.04 : 0);
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, zb: -2.3, y0: (u) => rt0(u) - 0.014, y1: (u) => rt1(u) + 0.012, off: 0.008, n1: 18, n2: 3 });
  K.wrap(Bd, 'LightRed', { end: -1, x0: 0, zb: -2.32, y0: rt0, y1: rt1, off: 0.013, n1: 18, n2: 3 });
  K.wrap(Bd, 'Gloss', { end: -1, x0: 0, x1: 0.84, y0: (u) => rt0(u * 0.95) + 0.036, y1: 0.968, off: 0.018, n1: 18, rows: 1 });
  K.wrap(Bd, 'Clear', { end: -1, x0: 0.6, x1: 0.76, y0: 0.86, y1: 0.9, off: 0.022, n1: 2, rows: 1 });
  K.box('Chrome', 0, 0.925, K.faceAt(Bd, 0.925, -1) - 0.024, 0.34, 0.025, 0.008);
  K.box('Paint', 0, 1.115, -2.46, 1.62, 0.025, 0.1);
  K.wrap(Bd, 'Trim', { end: -1, x0: 0, zb: -2.3, y0: 0.3, y1: 0.43, off: 0.008, n1: 5, n2: 2, rows: 1 });
  for (const s2 of [1]) K.sbox('Chrome', 0.62, 0.36, K.faceAt(Bd, 0.36, -1) - 0.012, 0.16, 0.07, 0.05);
  K.plate(0, 0.62, K.faceAt(Bd, 0.62, -1) - 0.015, false);
  K.handles(Bd, [0.36, -0.75], 0.96, { key: 'Plastic' });
  K.mirrors(0.9, 1.07, 0.85, { w: 0.19, h: 0.12, key: o.police ? 'Trim' : 'Paint' });
  if (o.police) {
    K.wheels([zf, zr], { x: 0.81, r, w: 0.245, rim: 0.62, style: 'steel', holes: 5, steel: '#2a2b2e' });
    K.lightbar(1.49, -0.45, 1.2, { segs: 8, keys: ['LightRed', 'LightRed', 'LightWhite', 'LightRed', 'LightBlue', 'LightWhite', 'LightBlue', 'LightBlue'] });
    K.pushbar(2.7, 0.4, 0.95, 0.48);
    K.spotlight(-0.9, 1.16, 1.0);
    for (const s of [-1, 1]) K.box(s < 0 ? 'LightRed' : 'LightBlue', s * 0.25, 1.36, 0.8, 0.3, 0.04, 0.04);   // dash lights behind the glass
    K.skin(Bd, 'Skin2', { z0: -2.45, z1: 2.45, y0: 0.56, y1: 0.66 });
    K.skin(Bd, 'Gold', { z0: -2.45, z1: 2.45, y0: 0.53, y1: 0.555 });
    const txt = P.textDecal({ text: 'POLICE', z0: -0.3, z1: 0.95, y0: 0.68, y1: 0.86, ink: '#1c3f8f' });
    const t2 = P.textDecal({ text: 'MAPLE GROVE PD', z0: -1.25, z1: -0.4, y0: 0.7, y1: 0.8, ink: '#16181c' });
    return vMats(P, { clad: '#4b4e53', body: '#f2f3f4', steel: '#2a2b2e', skin2: '#1c3f8f', paint: { seams: [1.02, -0.32, -1.46], hood: 1.0, trunk: -2.03, belt: 0.98, decal: P.decals(txt, t2) } });
  }
  K.wheels([zf, zr], { x: 0.81, r, w: 0.245, rim: 0.68, style: 'spoke', spokes: 5, split: true, rimKey: 'Steel' });
  return vMats(P, { clad: '#4b4e53', body: '#c4201c', paint: { seams: [1.02, -0.32, -1.46], hood: 1.0, trunk: -2.03, belt: 0.98 } });
}
// eslint-disable-next-line no-unused-vars
function build_chaserpd18(K, P) { return build_chaser18(K, P, { police: true }); }
