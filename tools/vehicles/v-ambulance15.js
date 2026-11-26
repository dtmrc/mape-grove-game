// 2015 Ironside E-45 Type III ambulance, Maple Grove EMS (counterpart: Ford E-450 cutaway with a box module). Middle era.
// 7.0 x 2.4 m, height 2.95 m, wheelbase 4.0 m.
// eslint-disable-next-line no-unused-vars
function build_ambulance15(K, P) {
  const H = heavyKit(K), r = 0.4, zf = 2.25, zr = -1.75;
  // van cab: short hood, tall windshield, the cab's own roof meets the module
  const Bd = K.body({
    top: [[0.95, 1.4], [1.9, 1.36], [2.75, 1.22], [3.22, 1.12], [3.3, 1.0], [3.32, 0.62]],
    half: [[0.95, 1.0], [2.9, 1.0], [3.32, 0.92]],
    bottom: [[0.95, 0.52], [3.32, 0.5]], sill: 0.52, floor: 0.44, tumble: 0.06, crown: 0.03, shoulder: 0.6,
    arches: [{ z: zf, r: r + 0.08, cy: r }], inset: 0.32,
  });
  const gh = K.greenhouse(Bd, { st: [[2.6, null, 0.84], [1.75, 2.25, 0.86], [1.0, 2.25, 0.86], [0.96, null, 0.86]], roof: [1, 2], inset: 0.06, crown: 0.02 });
  K.ghSide(gh, 'Paint', 1.72, 2.6, 0.86, 1.0); K.ghTop(gh, 'Paint', 1.75, 2.6, 0.9, 1.0);
  K.ghSide(gh, 'Paint', 0.96, 1.15, 0, 1.0);
  // v4 nose from photos (refs/cars/ambulance15): tall chrome grille with three bars and the oval, tall rectangular lamps with amber corners
  K.wrap(Bd, 'Chrome', { x0: 0, x1: 0.5, y0: 0.72, y1: 1.08, off: 0.012, n1: 3, rows: 2 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.45, y0: 0.76, y1: 1.04, off: 0.018, n1: 3, rows: 1 });
  for (const y of [0.81, 0.89, 0.97]) K.wrap(Bd, 'Chrome', { x0: 0, x1: 0.45, y0: y, y1: y + 0.03, off: 0.026, n1: 3, rows: 1 });
  K.box('Badge', 0, 0.9, K.faceAt(Bd, 0.9) + 0.034, 0.2, 0.09, 0.012);
  K.wrap(Bd, 'Head', { x0: 0.54, x1: 0.8, y0: 0.76, y1: 1.06, off: 0.014, n1: 2, rows: 2 });
  K.wrap(Bd, 'Amber', { x0: 0.8, zb: 3.1, y0: 0.76, y1: 1.06, off: 0.014, n1: 1, n2: 1, rows: 2 });
  // red band along cab and module, blue pinstripe up top (geometry, not painted texels)
  K.skin(Bd, 'Skin2', { z0: 0.96, z1: 3.2, y0: 1.14, y1: 1.3, arches: [] });
  for (const s of [-1, 1]) { K.box('Skin2', s * 1.217, 1.41, -1.28, 0.01, 0.18, 4.46); K.box('Stripe', s * 1.217, 2.63, -1.28, 0.01, 0.06, 4.46); }
  K.wrap(Bd, 'Chrome', { x0: 0, zb: 3.0, y0: 0.5, y1: 0.68, off: 0.03, n1: 5, n2: 2 });
  K.plate(0, 0.59, K.faceAt(Bd, 0.59) + 0.045, true);
  K.mirrors(1.0, 1.55, 2.4, { w: 0.24, h: 0.42, key: 'Trim' });
  for (const s of [-1, 1]) { K.box('LightRed', s * 0.55, 1.15, 3.26, 0.14, 0.08, 0.03); K.box('LightRed', s * 1.05, 1.25, 2.9, 0.03, 0.1, 0.18); }
  // patient module
  K.sideExtrude('Paint', K.archPoly(-3.5, 0.95, 0.65, 2.92, [{ z: zr, r: 0.55, cy: r }]), 1.2, -1.2);
  K.liner({ z: zr, r: 0.55, cy: r }, 0.8, 1.2); K.liner({ z: zr, r: 0.55, cy: r }, -1.2, -0.8);
  K.rbx('Paint', -1.22, 2.92, -3.52, 1.22, 2.98, 0.97);
  for (const s of [-1, 1]) {
    K.bx('Glass', s * 1.205, 1.85, 0.25, s * 1.21, 2.45, 0.75);
    for (const [z0, z1] of [[-3.3, -2.5], [-1.05, -0.3]]) { K.rbx('Paint', s * 1.203, 0.8, z0, s * 1.21, 2.6, z1); K.box('Chrome', s * 1.215, 1.6, z0 + 0.1, 0.02, 0.18, 0.04); }
    K.box('LightRed', s * 1.15, 2.88, 0.85, 0.12, 0.14, 0.2); K.box('LightRed', s * 1.15, 2.88, -3.42, 0.12, 0.14, 0.2);
    K.box('LightRed', s * 1.205, 2.7, -1.6, 0.03, 0.16, 0.26); K.box('LightWhite', s * 1.205, 2.7, -2.0, 0.03, 0.16, 0.26);
    K.box('Tail', s * 1.0, 1.0, -3.51, 0.2, 0.4, 0.04);
  }
  K.box('LightRed', 0, 2.88, 0.9, 0.5, 0.12, 0.12);
  K.rbx('Paint', -0.85, 0.9, -3.52, -0.02, 2.55, -3.5); K.rbx('Paint', 0.02, 0.9, -3.52, 0.85, 2.55, -3.5);
  for (const s of [-1, 1]) K.bx('Glass', s * 0.2, 1.85, -3.53, s * 0.7, 2.35, -3.52);
  K.bx('Steel', -1.0, 0.6, -3.75, 1.0, 0.68, -3.5);
  K.wheels([zf], { x: 0.88, r, w: 0.225, rim: 0.56, style: 'steel', holes: 8 });
  H.duals(zr, 0.98, r, 0.215);
  const txt = P.textDecal({ text: 'AMBULANCE', z0: -3.2, z1: -1.15, y0: 1.65, y1: 1.95, ink: '#c4161c' });
  const ems = P.textDecal({ text: 'MAPLE GROVE EMS', z0: -2.8, z1: -1.4, y0: 2.1, y1: 2.3, ink: '#1c3f8f' });
  const star = P.textDecal({ text: '✚', z0: -0.25, z1: 0.2, y0: 2.0, y1: 2.45, ink: '#1c3f8f' });
  return vMats(P, { body: '#f4f4f0', steel: '#c7ccd1', paint: { seams: [2.6, 1.0], hood: 2.7, belt: 1.4, sill: 0.55, decal: P.decals(txt, ems, star) }, skin2: '#c4161c', stripe: '#1c3f8f' });
}
