// 2012 Pierson Sentinel pumper, Maple Grove VFD Engine 1 (fire engine; counterpart: Pierce Enforcer custom-cab pumper). Middle era.
// 9.6 x 2.5 m, height 3.05 m, wheelbase 5.0 m.
// eslint-disable-next-line no-unused-vars
function build_pumper12(K, P) {
  const H = heavyKit(K), r = 0.53, zf = 3.05, zr = -1.95;
  const F = 4.8;   // front face z
  // custom tilt cab: flat front, big windshield, raised-roof crew cab
  K.sideExtrude('Paint', K.archPoly(1.1, F, 0.6, 2.0, [{ z: zf, r: r + 0.12, cy: r }]), 1.25, -1.25);
  K.liner({ z: zf, r: r + 0.12, cy: r }, 0.9, 1.25); K.liner({ z: zf, r: r + 0.12, cy: r }, -1.25, -0.9);
  K.rbx('Paint', -1.25, 2.0, 1.1, 1.25, 2.95, F - 0.25);
  K.rbx('Paint2', -1.25, 2.95, 1.1, 1.25, 3.08, F - 0.35);                 // white roof
  K.sideExtrude('Glass', [[F - 0.25, 2.0], [F, 2.0], [F - 0.15, 2.85], [F - 0.25, 2.85]], 1.15, -1.15);   // windshield
  K.rbx('Paint', -1.25, 2.85, F - 0.3, 1.25, 2.95, F - 0.12);
  for (const s of [-1, 1]) {
    K.bx('Glass', s * 1.255, 2.05, F - 1.2, s * 1.26, 2.8, F - 0.35);       // front door glass
    K.bx('Glass', s * 1.255, 2.05, 1.3, s * 1.26, 2.8, 2.7);                // crew door glass
    K.box('Trim', s * 1.262, 2.42, 2.95, 0.02, 0.8, 0.06);
    K.box('Chrome', s * 1.27, 1.55, F - 1.0, 0.02, 0.05, 0.2); K.box('Chrome', s * 1.27, 1.55, 1.6, 0.02, 0.05, 0.2);
    for (const y of [0.85, 1.25]) K.box('Steel', s * 1.15, y, F - 0.55, 0.3, 0.04, 0.3);   // cab steps
  }
  K.softGrille({ pts: [[0.7, 0.3], [0.7, -0.3]], y: 1.35, z: F + 0.05, sw: 0.05, frame: 'Chrome', fill: 'Grille', round: 1, rad: 0.05, bars: [-0.2, -0.1, 0, 0.1, 0.2].map((y) => [y, 0.035, 'Chrome']), badge: { w: 0.22, h: 0.12, key: 'Gold', ring: true, y: 0.0 } });
  // gold reflective stripe all the way round the cab and body (geometry, so it stays crisp)
  for (const s of [-1, 1]) { K.box('Stripe', s * 1.268, 1.88, (F - 0.25 - 4.8) / 2, 0.01, 0.12, F - 0.25 + 4.8); }
  K.box('Stripe', 0, 1.88, F - 0.245, 2.5, 0.12, 0.01);
  for (const s of [-1, 1]) { K.box('Head', s * 0.95, 1.4, F + 0.01, 0.3, 0.2, 0.04); K.box('Head', s * 0.95, 1.15, F + 0.01, 0.3, 0.14, 0.04); K.box('LightRed', s * 1.05, 1.75, F + 0.01, 0.2, 0.16, 0.04); }
  K.barX('Chrome', 2.6, 0.72, F + 0.15, 0.36, 0.3, 0.2);
  K.box('Chrome', 0, 0.78, F + 0.32, 0.5, 0.2, 0.2);                     // bumper hose tray
  K.lightbar(3.1, F - 0.7, 2.2, { segs: 8, keys: ['LightRed', 'LightWhite', 'LightRed', 'LightRed', 'LightWhite', 'LightRed', 'LightRed', 'LightWhite'] });
  K.mirrors(1.25, 2.4, F - 0.4, { w: 0.24, h: 0.5, key: 'Chrome' });
  // pump panel, body with roll-up compartment doors, hose bed, ladder rack
  K.bx('Steel', -1.25, 0.6, 0.6, 1.25, 2.4, 1.1);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) K.box('Chrome', s * 1.27, 1.0 + k * 0.35, 0.85, 0.03, 0.1, 0.1);
  K.sideExtrude('Paint', K.archPoly(-4.8, 0.6, 0.6, 2.4, [{ z: zr, r: r + 0.12, cy: r }]), 1.25, -1.25);
  K.liner({ z: zr, r: r + 0.12, cy: r }, 0.8, 1.25); K.liner({ z: zr, r: r + 0.12, cy: r }, -1.25, -0.8);
  for (const s of [-1, 1]) for (const [z0, z1] of [[-0.9, 0.5], [-4.7, -2.9]]) {
    K.bx('Chrome', s * 1.252, 0.75, z0, s * 1.26, 2.3, z1);
    for (let y = 0.8; y < 2.3; y += 0.09) K.box('Steel', s * 1.262, y, (z0 + z1) / 2, 0.01, 0.012, z1 - z0 - 0.04);
  }
  K.rbx('Paint', -1.2, 2.4, -4.8, 1.2, 2.6, 0.6);
  for (let k = 0; k < 5; k++) K.bx(k % 2 ? 'Hose' : 'Hose2', -1.1 + k * 0.44, 2.6, -4.6, -0.7 + k * 0.44, 2.72, -0.2);
  K.bx('Steel', 0.95, 2.62, -4.7, 1.22, 2.66, 0.4);
  for (let k = 0; k < 12; k++) K.box('Steel', 1.08, 2.66, -4.5 + k * 0.4, 0.27, 0.03, 0.03);   // ladder rungs
  K.rod('Chrome', [0, 2.7, -0.2], [0, 3.05, 0.3], 0.06, 6);   // deck gun
  K.bx('Steel', -1.25, 0.55, -4.95, 1.25, 0.7, -4.8);         // tailboard
  for (const s of [-1, 1]) { K.box('LightRed', s * 1.1, 2.3, -4.82, 0.18, 0.16, 0.04); K.box('Tail', s * 1.0, 1.05, -4.82, 0.2, 0.2, 0.04); K.box('Amber', s * 1.0, 0.85, -4.82, 0.2, 0.14, 0.04); }
  K.box('Chevron', 0, 1.7, -4.81, 1.4, 0.9, 0.02);
  K.wheels([zf], { x: 1.0, r, w: 0.31, rim: 0.58, style: 'steel', holes: 10, steel: '#e6e8ea' });
  H.duals(zr, 1.03, r, 0.28, { steel: '#e6e8ea' });
    const txt = P.textDecal({ text: 'MAPLE GROVE VFD', z0: 1.2, z1: 2.95, y0: 1.5, y1: 1.75, ink: '#f2c61c' });
  const num = P.textDecal({ text: 'ENGINE 1', z0: F - 1.15, z1: F - 0.4, y0: 1.5, y1: 1.72, ink: '#f2f2f2' });
  return vMats(P, { body: '#b5121b', body2: '#f2f2f0', steel: '#c7ccd1', paint: { seams: [], belt: 3, sill: 0.6, decal: P.decals(txt, num) }, stripe: '#f2c61c', extra: {
    Hose: { paint: P.plain('#e8d9a0', 0.1), size: 64, color: '#e8d9a0' }, Hose2: { paint: P.plain('#2b4fa8', 0.1), size: 64, color: '#2b4fa8' },
    Chevron: { paint: (p) => ((Math.floor((p.x + Math.abs(p.y - 1.7) * 0 + p.y) * 3.5) & 1) ? [242, 198, 28] : [181, 18, 27]), size: 128, color: '#f2c61c' } } });
}
