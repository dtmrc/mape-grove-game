// 2010 Transnational 7400 county dump truck with a snow plow (road maintenance; counterpart: International WorkStar 7400). Middle era.
// eslint-disable-next-line no-unused-vars
function build_dump10(K, P) {
  const H = heavyKit(K), r = 0.53, zf = 2.25, zr = -2.0, zr2 = -3.35;
  // v4 from reference photos (refs/cars/dump10): sloped hood narrowing to a tall chrome grille of vertical bars, round lamp pods
  // low in the fender corners, tall upright cab with a big windshield, steel dump body with a cab shield, plow frame.
  const Bd = K.body({
    top: [[-0.4, 1.95], [1.0, 1.95], [1.3, 1.93], [2.4, 1.85], [3.2, 1.72], [3.5, 1.62], [3.58, 1.5], [3.6, 1.1], [3.62, 0.9]],
    half: [[-0.4, 1.2], [1.2, 1.2], [2.6, 1.18], [3.3, 1.08], [3.62, 0.96]],
    bottom: [[-0.4, 0.92], [3.62, 0.92]], sill: 0.92, floor: 0.86, tumble: 0.02, crown: 0.07, shoulder: 0.75,
    arches: [{ z: zf, r: r + 0.12, cy: r, sq: 0.85 }], inset: 0.34,
  });
  const gh = K.greenhouse(Bd, { st: [[1.1, null, 1.12], [0.72, 2.84, 1.06], [-0.3, 2.86, 1.06], [-0.38, null, 1.14]], roof: [1, 2], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', -0.38, -0.05, 0, 1.0);
  K.ghSide(gh, 'Paint', 0.62, 1.1, 0.88, 1.0);
  K.ghSide(gh, 'Trim', 0.3, 0.36, 0, 1.0);
  K.ghTop(gh, 'Paint', 0.7, 1.1, 0.9, 1.0);
  K.box('Paint', 0, 2.84, 0.86, 2.1, 0.05, 0.3, [0.3, 0, 0]);                                   // visor
  for (let k = -2; k <= 2; k++) K.box('Amber', k * 0.34, 2.93, 0.55, 0.1, 0.05, 0.07);
  K.wrap(Bd, 'Chrome', { x0: 0, x1: 0.6, y0: 1.0, y1: (u) => 1.6 - u * 0.04, off: 0.012, n1: 4, rows: 3 });
  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.53, y0: 1.06, y1: (u) => 1.53 - u * 0.04, off: 0.02, n1: 4, rows: 3 });
  for (let k = -5; k <= 5; k++) { const x = k * 0.095; K.box('Chrome', x, 1.29, K.faceAtX(Bd, Math.abs(x), 1.29) + 0.03, 0.03, 0.45, 0.012, [K.faceTilt(Bd, 1.1, 1.5), 0, 0]); }
  K.box('Badge', 0, 1.6, K.faceAt(Bd, 1.6) + 0.02, 0.2, 0.06, 0.012, [-0.5, 0, 0]);
  K.wrap(Bd, 'Chrome', { x0: 0.66, zb: 3.3, y0: 1.02, y1: 1.26, off: 0.012, n1: 2, n2: 2 });
  K.wrap(Bd, 'Head', { x0: 0.7, x1: 0.9, y0: 1.06, y1: 1.22, off: 0.018, n1: 2, rows: 1 });
  K.wrap(Bd, 'Amber', { x0: 0.92, zb: 3.36, y0: 1.06, y1: 1.22, off: 0.018, n1: 1, n2: 1, rows: 1 });
  K.archLips(Bd, 'Clad', { t: 0.04, y0: 0.92 });
  K.rbx('Steel', -1.2, 0.6, 3.62, 1.2, 0.9, 3.78, 0.03);                                         // bumper
  for (const s of [-1, 1]) { K.box('Steel', s * 1.22, 1.0, 0.5, 0.14, 0.04, 0.7); K.box('Steel', s * 1.22, 0.7, 0.5, 0.14, 0.04, 0.7); K.rod('Chrome', [s * 1.0, 0.85, -0.3], [s * 1.0, 0.85, 0.2], 0.28, 12); K.box('Chrome', s * 1.21, 1.75, 0.5, 0.02, 0.05, 0.18); }
  K.mirrors(1.2, 2.3, 0.95, { w: 0.3, h: 0.5, key: 'Chrome' });
  K.lightbar(2.92, 0.1, 1.4, { segs: 6, keys: ['LightAmber', 'LightAmber', 'LightWhite'] });
  H.rails(-4.3, 3.5, 0.82, 0.5);
  // dump body with a cab shield and a salt spreader
  K.rbx('Paint2', -1.25, 1.2, -4.25, 1.25, 2.4, -0.6);
  K.rbx('Paint2', -1.1, 2.4, -0.7, 1.1, 2.5, -0.55); K.box('Paint2', 0, 2.98, 0.0, 2.2, 0.06, 1.3, [-0.06, 0, 0]); for (const s2 of [-1, 1]) K.box('Paint2', s2 * 1.05, 2.72, -0.6, 0.08, 0.5, 0.08);
  for (const s of [-1, 1]) for (let z = -3.9; z < -0.8; z += 0.6) K.box('Paint2', s * 1.27, 1.8, z, 0.04, 1.2, 0.08);
  K.bx('Under', -1.25, 1.12, -4.25, 1.25, 1.2, -0.6);
  K.box('Steel', 0, 0.95, -4.55, 0.9, 0.5, 0.5); K.box('Plastic', 0, 0.66, -4.65, 0.6, 0.06, 0.6);
  for (const s of [-1, 1]) K.box('Tail', s * 1.0, 1.05, -4.3, 0.16, 0.16, 0.04);
  // plow: curved moldboard on a hitch
  const blade = []; for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 0.6; blade.push([4.25 - Math.sin(a) * 0.35, 0.25 + (1 - Math.cos(a)) * 0.9]); }
  const sh = [...blade, ...blade.slice().reverse().map(([z, y]) => [z + 0.05, y])];
  K.sideExtrude('Paint', sh, 1.5, -1.5);
  K.box('Under', 0, 0.62, 3.95, 0.9, 0.2, 0.5); K.box('Under', 0, 1.2, 3.86, 1.4, 0.08, 0.1); for (const s2 of [-1, 1]) K.box('Under', s2 * 0.6, 0.95, 3.86, 0.08, 0.6, 0.1);
  for (const s of [-1, 1]) K.rod('LightAmber', [s * 1.45, 1.3, 4.0], [s * 1.45, 1.8, 4.0], 0.025, 4);
  K.wheels([zf], { x: 0.95, r, w: 0.31, rim: 0.56, style: 'steel', holes: 10 });
  H.duals(zr, 1.0, r, 0.28); H.duals(zr2, 1.0, r, 0.28);
  const txt = P.textDecal({ text: 'MAPLE GROVE ROADS', z0: -0.3, z1: 1.0, y0: 1.45, y1: 1.65, ink: '#111111' });
  return vMats(P, { body: '#e2761b', body2: '#aeb3b8', clad: '#1a1b1d', paint: { seams: [], belt: 2, sill: 1, decal: txt } });
}
