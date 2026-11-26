// 2021 Ironside F-55 county crew truck with an arrow board and a crash attenuator (road maintenance; counterpart: 2021 Ford F-550 utility body). Newest era.
// eslint-disable-next-line no-unused-vars
function build_arrowboard21(K, P) {
  const H = heavyKit(K), r = 0.42, zf = 2.25, zr = -1.95;
  const C = H.cab({ front: 3.25, back: -0.2, hood: 1.42, belt: 1.45, roof: 2.12, w: 1.02, r, zf, yb: 0.6, crew: true, hoodLen: 1.6, grilleFrame: 'Trim' });
  H.rails(-3.8, -0.2, 0.62);
  // utility body with compartment doors
  for (const s of [-1, 1]) {
    K.sideExtrude('Paint', K.archPoly(-3.7, -0.3, 0.68, 1.55, [{ z: zr, r: 0.55, cy: r }]), s > 0 ? 1.15 : -0.7, s > 0 ? 0.7 : -1.15);
    K.liner({ z: zr, r: 0.55, cy: r }, s * 0.7, s * 1.15);
    for (const [z0, z1] of [[-3.65, -2.6], [-1.35, -0.35]]) { K.rbx('Paint', s * 1.155, 0.75, z0, s * 1.16, 1.5, z1); K.box('Chrome', s * 1.165, 1.3, (z0 + z1) / 2, 0.02, 0.04, 0.16); }
  }
  K.bx('Bedliner', -0.7, 1.0, -3.7, 0.7, 1.05, -0.3);
  // amber reflective stripe along cab and body
  K.skin(C.Bd, 'Stripe', { z0: -0.18, z1: 3.2, y0: 0.7, y1: 0.78 });
  for (const s of [-1, 1]) K.box('Stripe', s * 1.165, 0.74, -2.0, 0.01, 0.08, 3.4);
  // fold-up arrow board on a mast, attenuator on the back
  K.bx('Steel', -0.08, 1.05, -0.8, 0.08, 2.3, -0.65);
  K.bx('Trim', -1.0, 2.3, -0.78, 1.0, 3.3, -0.68);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) K.box('LightAmber', -0.7 + i * 0.35, 2.55 + j * 0.25, -0.79, 0.12, 0.12, 0.02);
  K.box('LightAmber', 0.95, 2.8, -0.79, 0.12, 0.6, 0.02);
  K.bx('Plastic', -0.12, 0.7, -4.1, 0.12, 0.85, -3.7);
  K.rbx('Paint2', -1.05, 0.45, -5.0, 1.05, 1.25, -4.1);
  for (let k = 0; k < 6; k++) K.bx(k % 2 ? 'Trim' : 'Paint2', -1.06 + k * 0.353, 0.45, -5.01, -1.06 + (k + 1) * 0.353, 1.25, -5.0);
  K.lightbar(2.2, -0.15, 1.6, { segs: 8, keys: ['LightAmber', 'LightAmber', 'LightWhite', 'LightAmber'] });
  for (const s of [-1, 1]) K.box('Tail', s * 0.95, 1.4, -3.72, 0.14, 0.14, 0.03);
  H.duals(zr, 0.98, r, 0.225);
  K.wheels([zf], { x: 0.9, r, w: 0.245, rim: 0.6, style: 'steel', holes: 10 });
  const txt = P.textDecal({ text: 'MAPLE GROVE PUBLIC WORKS', z0: -3.5, z1: -1.5, y0: 1.22, y1: 1.38, ink: '#14381f' });
  return vMats(P, { body: '#eeeeea', body2: '#e2761b', paint: { seams: [1.65, 0.4, -0.15], hood: 1.65, belt: 1.45, sill: 0.6, decal: P.decals(txt) }, stripe: '#d8a512', extra: { Paint2: { paint: P.paint({ base: '#e2761b' }), size: 256, color: '#e2761b' } } });
}
