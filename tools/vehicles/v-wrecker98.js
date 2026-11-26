// 1998 Delmont 3500HD wrecker (old tow truck; counterpart: 1998 Chevrolet C3500HD with a wheel-lift wrecker body). Old era.
// eslint-disable-next-line no-unused-vars
function build_wrecker98(K, P) {
  const H = heavyKit(K), r = 0.4, zf = 2.0, zr = -1.7;
  H.cab({ front: 2.95, back: 0.2, hood: 1.28, belt: 1.32, roof: 1.98, w: 1.0, r, zf, yb: 0.55, hoodLen: 1.55, style: 'gmt400' });
  H.rails(-3.6, 0.2, 0.6);
  // wrecker body: tool boxes either side, deck, A-frame boom, wheel lift
  for (const s of [-1, 1]) {
    K.sideExtrude('Paint', K.archPoly(-3.05, 0.05, 0.62, 1.3, [{ z: zr, r: 0.52, cy: r }]), s > 0 ? 1.1 : -0.75, s > 0 ? 0.75 : -1.1);
    K.liner({ z: zr, r: 0.52, cy: r }, s * 0.72, s * 1.1);
    K.bx('Chrome', s * 1.1, 1.3, -3.05, s * 0.75, 1.34, 0.05);
    for (const z of [-0.5, -2.6]) K.box('Chrome', s * 1.105, 1.0, z, 0.02, 0.05, 0.2);
  }
  K.bx('Steel', -0.75, 0.82, -3.3, 0.75, 0.9, 0.0);
  K.srod('Steel', [0.35, 0.9, -1.0], [0.18, 2.4, -1.4], 0.06, 6); K.srod('Steel', [0.35, 0.9, -1.9], [0.18, 2.4, -1.4], 0.06, 6);
  K.box('Steel', 0, 2.4, -1.4, 0.5, 0.14, 0.18);
  K.rod('Paint2', [0, 1.1, -0.6], [0, 1.95, -3.3], 0.11, 6);          // boom
  K.rod('Steel', [0, 1.9, -3.25], [0, 0.9, -3.45], 0.015, 4);         // cable
  K.box('Steel', 0, 0.88, -3.45, 0.18, 0.14, 0.1);                    // hook
  K.box('Steel', 0, 0.5, -3.4, 0.2, 0.12, 0.8); K.box('Steel', 0, 0.5, -3.8, 1.6, 0.1, 0.12);   // wheel-lift
  for (const s of [-1, 1]) K.box('Steel', s * 0.7, 0.55, -3.8, 0.08, 0.12, 0.3);
  K.lightbar(2.02, 0.6, 1.4, { segs: 6, keys: ['LightAmber', 'LightWhite', 'LightAmber'] });
  for (const s of [-1, 1]) K.box('Tail', s * 0.9, 0.9, -3.06, 0.14, 0.16, 0.03);
  H.duals(zr, 0.95, r, 0.215);
  K.wheels([zf], { x: 0.88, r, w: 0.235, rim: 0.56, style: 'steel', holes: 8 });
  const txt = P.textDecal({ text: "EARL'S TOWING", z0: 0.4, z1: 1.5, y0: 0.82, y1: 1.0, ink: '#f2c61c' });
  const ph = P.textDecal({ text: '24 HR  555-0199', z0: -2.9, z1: -0.1, y0: 0.9, y1: 1.08, ink: '#f2f2f2' });
  return vMats(P, { body: '#1f3f78', body2: '#e8b81a', paint: { seams: [1.4, 0.25], hood: 1.4, belt: 1.32, sill: 0.55, decal: P.decals(txt, ph) } });
}
