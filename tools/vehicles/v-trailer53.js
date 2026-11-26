// 53 ft dry van trailer for the big rigs (counterpart: Great Dane / Wabash 53' van). Hitch (king pin) at the origin; trailer runs along -z.
// eslint-disable-next-line no-unused-vars
function build_trailer53(K, P) {
  const L = 16.15, z0 = 0.9, z1 = z0 - L, r = 0.52, ax = [z1 + 1.6, z1 + 2.9];
  K.rbx('Paint', -1.3, 1.3, z1, 1.3, 4.1, z0);
  for (const s of [-1, 1]) for (let z = z1 + 0.6; z < z0; z += 0.6) K.box('Steel', s * 1.305, 2.7, z, 0.02, 2.75, 0.04);
  K.bx('Steel', -1.32, 1.22, z1, 1.32, 1.32, z0); K.bx('Steel', -1.32, 4.08, z1, 1.32, 4.16, z0);
  for (const s of [-1, 1]) { K.bx('Steel', s * 1.32, 1.3, z1 - 0.02, s * 0.0, 4.1, z1 - 0.06); K.box('Chrome', s * 0.3, 2.6, z1 - 0.08, 0.04, 2.6, 0.04); K.box('Tail', s * 1.15, 1.4, z1 - 0.07, 0.14, 0.1, 0.03); }
  K.bx('Under', -0.5, 0.75, z1 + 0.9, 0.5, 1.22, z1 + 3.6);          // slider
  for (const s of [-1, 1]) K.rbx('Paint2', s * 1.28, 0.6, z1 + 4.2, s * 1.3, 1.22, z0 - 6.0);   // side skirts
  for (const s of [-1, 1]) K.box('Steel', s * 0.8, 0.9, z0 - 2.8, 0.08, 0.7, 0.08);           // landing gear
  K.bx('Steel', -1.2, 1.0, z1 - 0.05, 1.2, 1.15, z1 + 0.05);                                    // ICC bar
  const H = heavyKit(K); for (const z of ax) H.duals(z, 1.03, r, 0.28, { steel: '#c4c8cc' });
  const brand = P.textDecal({ text: 'HOLLOW CREEK FREIGHT', z0: -11, z1: -3, y0: 2.3, y1: 3.3, ink: '#1f4a2a', minNx: 0.5 });
  for (const s of [-1, 1]) K.box('Stripe', s * 1.318, 1.5, (z0 + z1) / 2, 0.01, 0.1, L);
  return vMats(P, { body: '#f0f0ec', body2: '#cfd3d6', steel: '#c4c8cc', paint: { seams: [], belt: 5, sill: 1, decal: P.decals(brand) }, stripe: '#c4161c' });
}
