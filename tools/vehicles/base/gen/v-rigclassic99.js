// 1999 Pemberton 389 long-nose flat-top sleeper (classic big rig tractor; counterpart: Peterbilt 379). Old era.
// v4 from reference photos (refs/cars/rigclassic99): long narrow square hood with a tall flat chrome grille shell of fine vertical
// bars, separate round-topped fenders with twin rectangular lamp pods, big chrome air cleaners beside the cowl, narrow upright cab
// with a split flat windshield and chrome visor, twin stacks behind the cab, round polished fuel tanks with steps, slab chrome bumper.
// eslint-disable-next-line no-unused-vars
function build_rigclassic99(K, P, o = {}) {
  const H = heavyKit(K), r = 0.52, zf = 2.05, zr = -2.05, zr2 = -3.4, F = 3.1;
  // hood: narrow loft with a crowned top and a flat upright face
  const Hd = K.body({
    top: [[0.85, 2.12], [1.6, 2.1], [2.6, 2.07], [F - 0.06, 2.06], [F - 0.03, 1.9], [F - 0.02, 1.2], [F, 1.02]],
    half: [[0.85, 0.66], [F - 0.1, 0.6], [F, 0.57]],
    bottom: [[0.85, 1.0], [F, 1.0]], sill: 1.0, floor: 0.98, tumble: 0.02, crown: 0.05, shoulder: 0.8, arches: [], inset: 0.1,
  });
  K.wrap(Hd, 'Chrome', { x0: 0, zb: F - 0.16, y0: 1.02, y1: 2.05, off: 0.012, n1: 3, n2: 1, rows: 3 });
  K.wrap(Hd, 'Grille', { x0: 0, x1: 0.47, y0: 1.1, y1: 1.93, off: 0.018, n1: 2, rows: 1 });
  for (let k = -5; k <= 5; k++) K.box('Chrome', k * 0.085, 1.515, K.faceAt(Hd, 1.5) + 0.024, 0.02, 0.83, 0.012);
  K.box('Chrome', 0, 1.515, K.faceAt(Hd, 1.5) + 0.03, 0.05, 0.86, 0.016);
  K.box('Badge', 0, 2.0, K.faceAt(Hd, 2.0) + 0.02, 0.2, 0.06, 0.012);
  K.box('Chrome', 0, 2.14, F - 0.12, 0.05, 0.1, 0.16);                                          // hood ornament
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) K.box('Grille', s * (Hd.wAt(1.45 + k * 0.2, 1.7) + 0.004), 1.75, 1.45 + k * 0.2, 0.012, 0.3, 0.05);   // louvres
    K.box('Chrome', s * 0.66, 1.45, 1.95, 0.012, 0.03, 2.15);                                     // hood side strip
    // fender: round-topped arc over the wheel, tapering to the running board
    const fp = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * (k / 10); fp.push([zf + Math.cos(a) * 0.82, 1.0 + Math.sin(a) * 0.38]); }
    const fi = []; for (let k = 10; k >= 0; k--) { const a = Math.PI * (k / 10); fi.push([zf + Math.cos(a) * 0.7, 0.96 + Math.sin(a) * 0.32]); }
    K.sideExtrude('Paint', [...fp, [zf - 0.82, 0.92], ...fi, [zf + 0.82, 0.92]], s > 0 ? 1.25 : -0.58, s > 0 ? 0.58 : -1.25, 0.05);
    K.box('Chrome', s * 0.95, 1.27, zf + 0.6, 0.12, 0.1, 0.1);                                  // pod foot on the fender
    K.rbx('Chrome', s * 0.7, 1.3, zf + 0.5, s * 1.2, 1.53, zf + 0.72, 0.04);                    // lamp pod sitting on the fender
    for (const x of [0.83, 1.07]) K.box('Head', s * x, 1.415, zf + 0.725, 0.2, 0.16, 0.02);
    K.box('Amber', s * 0.95, 1.56, zf + 0.6, 0.12, 0.05, 0.12);
    K.rod('Chrome', [s * 0.98, 1.5, 0.98], [s * 0.98, 2.2, 0.98], 0.2, 12);                     // air cleaner
    K.rod('Chrome', [s * 0.98, 2.2, 0.98], [s * 0.98, 2.3, 0.98], 0.12, 10);
    K.rod('Chrome', [s * 1.12, 1.3, -0.72], [s * 1.12, 2.6, -0.72], 0.11, 10);                  // stack heat shield
    K.rod('Chrome', [s * 1.12, 2.6, -0.72], [s * 1.12, 4.0, -0.72], 0.065, 10);                 // stack
    K.rod('Chrome', [s * 1.0, 0.82, -0.5], [s * 1.0, 0.82, 0.75], 0.3, 14);                     // round fuel tank
    for (const z of [-0.2, 0.45]) K.rod('Steel', [s * 1.0, 0.82, z], [s * 1.0, 0.82, z + 0.05], 0.31, 14);
    K.box('Chrome', s * 1.22, 0.62, 0.3, 0.2, 0.04, 0.7); K.box('Chrome', s * 1.22, 0.95, 0.75, 0.2, 0.04, 0.5);   // steps
  }
  K.rbx('Chrome', -1.25, 0.56, F + 0.02, 1.25, 0.96, F + 0.22, 0.04);                           // slab bumper
  K.plate(0, 0.76, F + 0.225, true);
  for (const s of [-1, 1]) K.box('Clear', s * 0.8, 0.76, F + 0.225, 0.16, 0.08, 0.01);
  // cab: narrow, upright, split flat windshield, chrome visor, five roof lights, horns
  const Cb = K.body({
    top: [[-0.6, 2.02], [0.6, 2.02], [0.88, 2.0], [0.9, 1.2]],
    half: [[-0.6, 0.98], [0.9, 0.98]],
    bottom: [[-0.6, 0.95], [0.9, 0.95]], sill: 0.95, floor: 0.93, tumble: 0.02, crown: 0.01, shoulder: 0.8, arches: [], inset: 0.1,
  });
  const gh = K.greenhouse(Cb, { st: [[0.84, null, 0.92], [0.62, 2.84, 0.9], [-0.5, 2.86, 0.9], [-0.58, null, 0.94]], roof: [1, 2], inset: 0.03, crown: 0.04 });
  K.ghSide(gh, 'Paint', -0.58, -0.22, 0, 1.0);
  K.ghSide(gh, 'Paint', 0.5, 0.84, 0.9, 1.0);
  K.ghSide(gh, 'Trim', 0.2, 0.26, 0, 1.0);
  K.ghTop(gh, 'Paint', 0.6, 0.84, 0.88, 1.0);
  K.box('Paint', 0, 2.42, 0.75, 0.06, 0.8, 0.05, [0.26, 0, 0]);                                 // windshield divider
  K.box('Chrome', 0, 2.82, 0.78, 1.9, 0.05, 0.3, [0.35, 0, 0]);                                 // visor
  for (let k = -2; k <= 2; k++) K.box('Amber', k * 0.36, 2.93, 0.5, 0.1, 0.06, 0.08);
  for (const s of [-1, 1]) { K.rod('Chrome', [s * 0.35, 2.96, 0.0], [s * 0.35, 2.96, 0.5], 0.04, 6, 0.07); K.box('Chrome', s * 0.99, 1.75, 0.3, 0.02, 0.05, 0.16); }
  K.mirrors(0.98, 2.35, 0.7, { w: 0.2, h: 0.5, key: 'Chrome' });
  // flat-top sleeper behind the cab
  K.rbx('Paint', -1.0, 0.95, -1.8, 1.0, 2.96, -0.58, 0.08);
  for (const s of [-1, 1]) { K.bx('Glass', s * 1.002, 2.2, -1.35, s * 1.008, 2.5, -1.0); K.box('Chrome', s * 1.004, 1.55, -1.2, 0.012, 0.7, 0.5); K.box('Paint', s * 1.01, 1.55, -1.2, 0.012, 0.6, 0.4); }
  for (let k = -2; k <= 2; k++) K.box('Amber', k * 0.36, 2.985, -1.74, 0.1, 0.05, 0.06);
  H.rails(-4.1, F - 0.2, 0.75, 0.48);
  K.bx('Steel', -0.6, 1.0, -3.4, 0.6, 1.06, -1.8);
  K.box('Steel', 0, 1.14, -2.7, 0.95, 0.1, 0.95); K.box('Under', 0, 1.2, -2.7, 0.5, 0.03, 0.5);  // fifth wheel
  for (const s of [-1, 1]) { K.box('Plastic', s * 1.05, 0.68, -4.05, 0.56, 0.62, 0.02); K.box('Tail', s * 0.75, 0.9, -4.1, 0.2, 0.1, 0.03); }
  K.wheels([zf], { x: 1.0, r, w: 0.29, rim: 0.58, style: 'steel', holes: 10, steel: '#d8dce0' });
  H.duals(zr, 1.03, r, 0.28, { steel: '#d8dce0' }); H.duals(zr2, 1.03, r, 0.28, { steel: '#d8dce0' });
  return vMats(P, { body: o.color ?? '#2c62b8', steel: '#d8dce0', paint: { seams: [], belt: 3, sill: 1 } });
}
