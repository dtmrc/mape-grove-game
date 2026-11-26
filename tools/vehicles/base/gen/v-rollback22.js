// 2022 Ironside F-55 rollback (new tow truck; counterpart: 2022 Ford F-550 Super Duty with a car-carrier deck). Newest era.
// eslint-disable-next-line no-unused-vars
function build_rollback22(K, P) {
  const H = heavyKit(K), r = 0.42, zf = 2.25, zr = -1.95;
  H.cab({ front: 3.25, back: -0.2, hood: 1.42, belt: 1.45, roof: 2.12, w: 1.02, r, zf, yb: 0.6, crew: true, hoodLen: 1.6, grilleFrame: 'Trim' });
  H.rails(-4.6, -0.2, 0.62);
  // tilting deck (flat), headboard with a light bar, winch, side rails and stake pockets
  K.bx('Steel', -1.2, 1.02, -5.4, 1.2, 1.14, -0.35);
  for (const s of [-1, 1]) { K.rbx('Paint', s * 1.2, 0.92, -5.4, s * 1.16, 1.18, -0.35); for (let z = -5.0; z < -0.5; z += 0.6) K.box('Trim', s * 1.215, 1.05, z, 0.02, 0.1, 0.06); }
  K.bx('Steel', -1.15, 1.14, -0.4, 1.15, 2.2, -0.3);
  for (let k = 0; k < 6; k++) K.box('RimIn', -0.9 + k * 0.36, 1.7, -0.29, 0.08, 0.9, 0.02);
  K.lightbar(2.2, -0.35, 1.6, { segs: 8, keys: ['LightAmber', 'LightAmber', 'LightWhite', 'LightAmber'] });
  K.box('Plastic', 0, 1.3, -0.6, 0.5, 0.25, 0.4);
  K.rbx('Paint2', -1.1, 0.7, -5.4, 1.1, 1.0, -5.3);
  for (const s of [-1, 1]) { K.box('Tail', s * 0.95, 0.85, -5.42, 0.16, 0.1, 0.03); K.box('Steel', s * 0.35, 0.65, -5.5, 0.1, 0.1, 0.4); }
  for (const s of [-1, 1]) K.bx('Plastic', s * 1.2, 0.65, -0.4, s * 0.75, 1.0, 0.0);   // under-deck toolboxes
  H.duals(zr, 0.98, r, 0.225);
  K.wheels([zf], { x: 0.9, r, w: 0.245, rim: 0.6, style: 'steel', holes: 10 });
  const txt = P.textDecal({ text: 'GROVE RECOVERY', z0: 0.7, z1: 2.05, y0: 0.9, y1: 1.05, ink: '#ffffff' });
  return vMats(P, { body: '#c2161c', body2: '#f2c61c', steel: '#a8adb2', paint: { seams: [1.65, 0.4, -0.15], hood: 1.65, belt: 1.45, sill: 0.6, decal: txt } });
}
