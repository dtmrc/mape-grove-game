// 2008 Ironside Crown Marquis Police Interceptor (counterpart: Ford Crown Victoria Police Interceptor P71). Old era.
// Classic black-and-white: black car, white doors, steel wheels, push bar, spotlight, light bar.
// eslint-disable-next-line no-unused-vars
function build_crownpi08(K, P) {
  build_crown03(K, P, { police: true });
  K.lightbar(1.48, -0.45, 1.25, { segs: 6 });
  K.pushbar(2.88, 0.38, 0.96, 0.46);
  K.spotlight(-0.88, 1.12, 0.92);
  K.rod('Trim', [0.3, 1.47, -1.0], [0.3, 1.72, -1.05], 0.008, 4);   // antenna
  const Bd = K.last();
  K.skin(Bd, 'Skin', { z0: -1.28, z1: 1.12, y0: 0.3, y1: 0.92, rows: 5 });
  const txt = P.textDecal({ text: 'POLICE', z0: 0.0, z1: 1.0, y0: 0.62, y1: 0.8, ink: '#111317' });
  const town = P.textDecal({ text: 'MAPLE GROVE', z0: -1.1, z1: -0.45, y0: 0.66, y1: 0.76, ink: '#111317' });
  return vMats(P, { body: '#121316', skin: '#f2f2f2', skinDecal: P.decals(txt, town), paint: { seams: [1.12, -0.36, -1.28], hood: 1.08, trunk: -1.85, belt: 0.92 }, steel: '#2b2c2f' });
}
