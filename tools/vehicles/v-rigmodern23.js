// 2023 Pemberton 579 aero sleeper (modern big rig tractor; counterpart: Peterbilt 579). Newest era.
// v4 from reference photos (refs/cars/rigmodern23): sloped rounded hood that narrows to a tall chrome grille of vertical bars with
// a crown, swept lamps set into the fender corners, body-colour bumper with fog lamps, raked one-piece windshield, high-roof
// sleeper with a rounded roof cap and marker lights, side fairings and cab extenders, chrome mirrors on the doors.
// eslint-disable-next-line no-unused-vars
function build_rigmodern23(K, P) {
  const H = heavyKit(K), r = 0.52, zf = 2.3, zr = -2.4, zr2 = -3.75, F = 3.4;
  // cab lower, then a tall narrow centre hood, then separate fenders that stand proud over the wheels
  const Bd = K.body({
    top: [[-1.4, 2.2], [1.3, 2.2], [1.42, 2.17], [1.45, 1.2]],
    half: [[-1.4, 1.22], [1.45, 1.22]],
    bottom: [[-1.4, 0.58], [1.45, 0.58]], sill: 0.58, floor: 0.5, tumble: 0.03, crown: 0.05, shoulder: 0.7, arches: [], inset: 0.1,
  });
  const Hd = K.body({
    top: [[1.35, 2.2], [1.7, 2.16], [2.4, 2.09], [3.0, 2.02], [3.26, 1.96], [3.35, 1.84], [3.38, 1.3], [3.39, 1.02], [F, 0.98]],
    half: [[1.35, 1.06], [1.9, 0.9], [2.8, 0.78], [3.3, 0.73], [F, 0.68]],
    bottom: [[1.35, 0.96], [F, 0.96]], sill: 0.96, floor: 0.94, tumble: 0.03, crown: 0.1, shoulder: 0.75, arches: [], inset: 0.1,
  });
  const fz = F + 0.06, ar = r + 0.1, fp = [[1.38, 0.6], [1.38, 1.12], [1.7, 1.36], [2.1, 1.5], [2.6, 1.5], [3.05, 1.42], [3.35, 1.26], [fz, 1.05], [fz, 0.62], [zf + ar, 0.62]];
  for (let k = 1; k < 12; k++) { const t = Math.PI * (k / 12); fp.push([zf + Math.cos(t) * ar, 0.62 + Math.sin(t) * (r + ar * 0.85 - 0.62)]); }
  fp.push([zf - ar, 0.62]);
  for (const s of [-1, 1]) {
    K.sideExtrude('Paint', fp, s > 0 ? 1.27 : -0.6, s > 0 ? 0.6 : -1.27, 0.09);
    K.liner({ z: zf, r: ar, cy: r }, s * 0.62, s * 1.26);
    K.box('Gloss', s * 0.94, 1.19, fz - 0.035, 0.5, 0.2, 0.06, [-0.35, s * 0.12, 0]);            // lamp housing on the fender face
    K.box('Head', s * 0.98, 1.19, fz - 0.012, 0.36, 0.13, 0.05, [-0.35, s * 0.12, 0]);
    K.box('Amber', s * 1.275, 1.2, 3.2, 0.02, 0.07, 0.18);
  }
  K.rbx('Paint', -1.27, 0.5, F - 0.02, 1.27, 0.94, F + 0.2, 0.06);                                // bumper
  K.box('Gloss', 0, 0.72, F + 0.2, 1.3, 0.2, 0.02);
  for (const s of [-1, 1]) K.box('Clear', s * 0.95, 0.72, F + 0.2, 0.22, 0.1, 0.02);
  K.plate(0, 0.72, F + 0.215, true);
  // cab glass and the sleeper above the belt
  const gh = K.greenhouse(Bd, { st: [[1.42, null, 1.12], [0.72, 3.05, 1.0], [0.3, 3.1, 1.0], [0.26, null, 1.14]], roof: [1, 2], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', 0.26, 0.42, 0, 1.0);
  K.ghSide(gh, 'Paint', 0.7, 1.42, 0.86, 1.0);
  K.ghTop(gh, 'Paint', 0.7, 1.42, 0.9, 1.0);
  K.sideExtrude('Paint', [[-1.4, 2.18], [0.3, 2.18], [0.3, 3.1], [0.62, 3.1], [0.3, 3.82], [-0.3, 4.0], [-1.4, 4.02]], 1.2, -1.2, 0.1);   // sleeper + roof cap
  for (const s of [-1, 1]) {
    K.bx('Glass', s * 1.205, 2.45, -0.95, s * 1.21, 2.75, -0.45);                                // bunk window
    K.rbx('Paint', s * 1.26, 0.9, -1.95, s * 1.1, 3.95, -1.4, 0.05);                             // cab extender
    K.box('Chrome', s * 1.225, 1.95, 0.95, 0.02, 0.05, 0.18);
    K.rod('Chrome', [s * 1.14, 1.2, -1.62], [s * 1.14, 4.1, -1.62], 0.065, 8);
    K.box('Steel', s * 1.2, 0.72, 0.6, 0.12, 0.04, 0.9); K.box('Steel', s * 1.2, 1.05, 0.6, 0.12, 0.04, 0.7);   // steps
  }
  for (let k = -2; k <= 2; k++) K.box('Amber', k * 0.34, 3.86, 0.26, 0.1, 0.05, 0.06);
  // nose: tall chrome grille with vertical bars and a crown on the centre hood
  K.wrap(Hd, 'Chrome', { x0: 0, x1: 0.52, y0: 1.02, y1: (u) => 1.86 - u * 0.06, off: 0.012, n1: 4, rows: 4 });
  K.wrap(Hd, 'Grille', { x0: 0, x1: 0.46, y0: 1.08, y1: (u) => 1.79 - u * 0.06, off: 0.02, n1: 4, rows: 4 });
  for (let k = -4; k <= 4; k++) { const x = k * 0.1; K.box('Chrome', x, 1.42, K.faceAtX(Hd, Math.abs(x), 1.42) + 0.03, 0.03, 0.68, 0.012, [K.faceTilt(Hd, 1.1, 1.75), 0, 0]); }
  K.box('Badge', 0, 1.9, K.faceAt(Hd, 1.9) + 0.02, 0.22, 0.06, 0.012, [-0.7, 0, 0]);
  K.skin(Bd, 'Stripe', { z0: -1.35, z1: 1.4, y0: 1.2, y1: 1.3, off: 0.012, rows: 1, gap: 0.04 });
  K.mirrors(1.2, 2.5, 1.2, { w: 0.24, h: 0.5, key: 'Chrome' });
  H.rails(-4.4, 2.7, 0.75, 0.48);
  K.bx('Steel', -0.6, 1.0, -3.75, 0.6, 1.06, -1.4); K.box('Steel', 0, 1.14, -3.1, 0.95, 0.1, 0.95); K.box('Under', 0, 1.2, -3.1, 0.5, 0.03, 0.5);
  for (const s of [-1, 1]) { K.box('Plastic', s * 1.05, 0.68, -4.38, 0.56, 0.62, 0.02); K.box('Tail', s * 0.75, 0.9, -4.42, 0.2, 0.1, 0.03); }
  K.wheels([zf], { x: 1.0, r, w: 0.29, rim: 0.58, style: 'steel', holes: 10, steel: '#c4c8cc' });
  H.duals(zr, 1.03, r, 0.28, { steel: '#c4c8cc' }); H.duals(zr2, 1.03, r, 0.28, { steel: '#c4c8cc' });
  return vMats(P, { body: '#8f1722', clad: '#1a1b1d', steel: '#c4c8cc', paint: { seams: [1.42, 0.3], belt: 2.2, sill: 0.9 }, stripe: '#c9ccd0' });
}
