// 2004 Delmont Tahoma Police Pursuit Vehicle (police SUV; counterpart: 2004 Chevrolet Tahoe PPV). Old era. County-sheriff style livery.
// eslint-disable-next-line no-unused-vars
function build_tahomappv04(K, P) {
  build_tahoma04(K, P, { police: true });
  K.lightbar(1.98, -0.5, 1.35, { segs: 6 });
  K.pushbar(2.75, 0.45, 1.12, 0.52);
  K.spotlight(-0.99, 1.38, 0.95);
  const Bd = K.last();
  K.skin(Bd, 'Skin2', { z0: -Bd.z1 + 0.02, z1: Bd.z1 - 0.02, y0: 0.47, y1: 0.78 });
  K.skin(Bd, 'Gold', { z0: -Bd.z1 + 0.02, z1: Bd.z1 - 0.02, y0: 0.78, y1: 0.8, arches: [], off: 0.008 });
  const txt = P.textDecal({ text: 'SHERIFF', z0: -0.4, z1: 1.1, y0: 0.88, y1: 1.12, ink: '#2e3a2c' });
  const star = P.textDecal({ text: '★', z0: 1.2, z1: 1.45, y0: 0.88, y1: 1.12, ink: '#c9a227' });
  return vMats(P, { body: '#ecebe4', steel: '#2a2b2e', skin2: '#2e3a2c', paint: { seams: [1.04, -0.14, -1.0, -2.28], hood: 1.03, belt: 1.2, sill: 0.66, decal: P.decals(txt, star) } });
}
