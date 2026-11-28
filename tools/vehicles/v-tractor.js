// 2009 Greenacre 5045 utility tractor, open station with a roll bar and sun canopy (counterpart: a 45-75 hp utility tractor of the
// late 2000s, e.g. John Deere 5045D / Kubota M-series). Old era. Sawyer Fields' tractor.
// 4.1 x 2.0 m, height 2.65 m (canopy), wheelbase 2.15 m. Small ribbed-lug front tyres, tall lugged rears.
// Game export: the front wheel is the baked Wheel mesh; the rears are the same mesh scaled up (wheel.json rear = {r, w, x}).
// eslint-disable-next-line no-unused-vars
function build_tractor(K, P) {
  const T = K.T, zf = 1.3, zr = -0.85;
  const fo = { x: 0.7, r: 0.44, w: 0.24, rim: 0.58, style: 'steel', holes: 6, lugs: 14, seg: 20 };
  const ro = { x: 0.8, r: 0.8, w: 0.42, rim: 0.56, style: 'steel', holes: 8, lugs: 14, seg: 22 };
  // ---- drivetrain: engine block, transmission housing, front axle beam ----
  K.bx('Under', -0.3, 0.42, -1.25, 0.3, 0.95, 2.0);
  K.bx('Under', -0.34, 0.62, -1.25, 0.34, 1.0, -0.35);                   // rear axle housing / diff
  K.rod('Under', [-ro.x + 0.18, ro.r, zr], [ro.x - 0.18, ro.r, zr], 0.13, 10);
  K.rod('Under', [-fo.x + 0.1, fo.r, zf], [fo.x - 0.1, fo.r, zf], 0.07, 8);
  K.bx('Under', -0.2, 0.34, zf - 0.12, 0.2, 0.5, zf + 0.12);              // front axle pivot
  // ---- hood: long, flat-topped, rounded shoulders, slight nose drop; side panels with louvres ----
  K.sideExtrude('Paint', K.chaikin([[0.05, 0.92], [2.08, 0.92], [2.2, 1.0], [2.2, 1.38], [2.1, 1.52], [1.2, 1.57], [0.05, 1.62]], 2), 0.4, -0.4, 0.06);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) K.box('Grille', s * 0.402, 1.08 + k * 0.055, 1.75, 0.01, 0.025, 0.42);   // side louvres
    K.box('Stripe', s * 0.403, 1.45, 1.12, 0.008, 0.045, 1.95);
  }
  // nose: grille in a frame, headlights high in the grille shell, brand badge
  K.box('Paint', 0, 1.18, 2.205, 0.78, 0.5, 0.03);
  K.box('Mesh', 0, 1.17, 2.225, 0.6, 0.36, 0.02);
  for (const y of [1.05, 1.17, 1.29]) K.box('Paint', 0, y, 2.235, 0.62, 0.025, 0.012);
  K.box('Paint', 0, 1.17, 2.235, 0.03, 0.38, 0.012);
  for (const s of [-1, 1]) { K.box('Head', s * 0.27, 1.43, 2.17, 0.16, 0.08, 0.04); K.box('Trim', s * 0.27, 1.43, 2.15, 0.19, 0.11, 0.03); }
  K.box('Gold', 0, 1.47, 2.19, 0.2, 0.06, 0.012);
  // front suitcase weights on a bracket
  K.bx('Under', -0.46, 0.55, 2.08, 0.46, 0.68, 2.32);
  for (let k = 0; k < 7; k++) { const x = -0.42 + k * 0.14; K.rbx('Plastic', x - 0.06, 0.68, 2.2, x + 0.06, 0.98, 2.5, 0.02); K.box('Under', x, 0.96, 2.46, 0.04, 0.05, 0.06); }
  // exhaust stack (right of the hood, ahead of the cowl) and air intake (left)
  K.rod('Trim', [0.3, 1.4, 1.55], [0.3, 2.35, 1.55], 0.045, 8);
  K.rod('Trim', [0.3, 2.35, 1.55], [0.3, 2.42, 1.62], 0.045, 8);
  K.rod('Under', [0.3, 1.45, 1.55], [0.3, 1.9, 1.55], 0.07, 8);           // heat shield
  K.rod('Paint', [-0.28, 1.45, 1.45], [-0.28, 1.95, 1.45], 0.06, 8);
  K.put('Plastic', new T.CylinderGeometry(0.075, 0.075, 0.08, 8), [-0.28, 1.99, 1.45]);
  // ---- operator station: cowl / dash, platform, steering, seat ----
  K.rbx('Paint', -0.42, 0.95, -0.02, 0.42, 1.72, 0.22, 0.06);            // cowl
  K.box('Trim', 0, 1.62, -0.03, 0.5, 0.12, 0.02);                         // gauge panel
  for (const s of [-1, 1]) K.put('Clear', new T.CylinderGeometry(0.04, 0.04, 0.01, 10).rotateX(Math.PI / 2), [s * 0.12, 1.62, -0.045]);
  K.rod('Trim', [0, 1.6, 0.0], [0, 1.83, -0.18], 0.025, 6);
  K.put('Trim', new T.TorusGeometry(0.19, 0.022, 4, 16), [0, 1.84, -0.2], [-0.9, 0, 0]);
  K.bx('Under', -0.62, 0.74, -0.75, 0.62, 0.8, 0.18);                    // platform
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) K.box('Steel', s * 0.4, 0.805, -0.6 + k * 0.25, 0.3, 0.012, 0.03);   // tread strips
  for (const s of [-1, 1]) { K.bx('Under', s * 0.62, 0.45, -0.1, s * 0.66, 0.8, 0.05); K.bx('Steel', s * 0.5, 0.48, -0.12, s * 0.66, 0.51, 0.07); }   // step
  K.rbx('Interior', -0.27, 1.12, -0.95, 0.27, 1.24, -0.48, 0.05);       // seat cushion
  K.put('Interior', new T.BoxGeometry(0.5, 0.45, 0.1), [0, 1.48, -0.97], [-0.18, 0, 0]);
  K.rod('Under', [0, 0.98, -0.72], [0, 1.12, -0.72], 0.07, 6);
  for (const s of [-1, 1]) { K.box('Trim', s * 0.3, 1.32, -0.7, 0.05, 0.05, 0.34); K.rod('Trim', [s * 0.36, 1.05, -0.35], [s * 0.4, 1.4, -0.4], 0.018, 5); K.put('Amber', new T.SphereGeometry(0.035, 6, 4), [s * 0.4, 1.42, -0.4]); }   // armrests, levers
  // ---- rear fenders: curved shells over the big wheels with a flat deck, lamps on the back ----
  for (const s of [-1, 1]) {
    const R = ro.r + 0.1, x = s * ro.x;
    const sh = new T.CylinderGeometry(R, R, ro.w + 0.16, 18, 1, true, -0.25 * Math.PI, 1.25 * Math.PI); sh.rotateZ(Math.PI / 2);
    K.put('Paint', sh, [x, ro.r, zr]);
    const cap = new T.CylinderGeometry(R, R, 0.02, 18, 1, false, -0.25 * Math.PI, 1.25 * Math.PI); cap.rotateZ(Math.PI / 2);
    K.put('Paint', cap, [x - s * (ro.w / 2 + 0.08), ro.r, zr]);                       // inner fender wall
    K.bx('Paint', s * 0.55, 1.58, zr - 0.6, s * 1.08, 1.64, zr + 0.45);               // fender deck
    K.box('Tail', s * 0.95, 1.5, zr - 0.62, 0.1, 0.12, 0.03); K.box('Amber', s * 0.95, 1.67, zr - 0.5, 0.12, 0.06, 0.12);
    K.box('Head', s * 0.75, 1.68, zr + 0.42, 0.12, 0.08, 0.04);                      // fender work lights, facing forward
  }
  // ---- roll bar (two posts behind the seat) and the sun canopy ----
  for (const s of [-1, 1]) {
    K.bx('Trim', s * 0.62, 1.55, -1.12, s * 0.7, 2.5, -1.04);
    K.bx('Trim', s * 0.62, 1.55, -1.16, s * 0.72, 1.62, -0.98);                      // foot plate on the fender
    K.box('Amber', s * 0.68, 2.25, -1.02, 0.08, 0.1, 0.06);                          // hazard flashers
  }
  K.bx('Trim', -0.7, 2.45, -1.12, 0.7, 2.53, -1.04);
  K.rbx('Paint2', -0.82, 2.53, -1.75, 0.82, 2.62, 0.45, 0.04);                       // canopy
  K.bx('Paint2', -0.85, 2.48, -1.78, 0.85, 2.53, 0.48);
  for (const s of [-1, 1]) K.rod('Trim', [s * 0.66, 2.5, -1.05], [s * 0.66, 2.53, -0.2], 0.02, 4);
  K.box('LightAmber', 0, 2.68, -0.65, 0.14, 0.1, 0.14);                              // beacon
  // ---- three-point hitch, PTO, drawbar ----
  for (const s of [-1, 1]) { K.rod('Under', [s * 0.25, 0.55, -1.15], [s * 0.4, 0.42, -1.85], 0.04, 6); K.rod('Steel', [s * 0.32, 1.0, -1.2], [s * 0.4, 0.5, -1.8], 0.025, 5); }
  K.rod('Under', [0, 0.95, -1.2], [0, 0.85, -1.75], 0.035, 5);                        // top link
  K.rod('Steel', [0, 0.6, -1.25], [0, 0.6, -1.45], 0.05, 8);                          // PTO stub
  K.bx('Under', -0.08, 0.38, -1.95, 0.08, 0.45, -1.15);                               // drawbar
  K.box('Plate', 0, 1.25, -1.27, 0.3, 0.2, 0.02);                                     // SMV-style plate stand-in
  K.box('LightAmber', 0, 1.25, -1.285, 0.22, 0.16, 0.01, [0, 0, Math.PI / 4]);         // slow-moving-vehicle sign
  // ---- wheels: small fronts, tall rears ----
  K.wheels([zf], fo);
  K.wheelOpt.axles = [zf, zr]; K.wheelOpt.rear = { r: ro.r, w: ro.w, x: ro.x };
  if (!K.mode) for (const s of [-1, 1]) K.wheel(s * ro.x, ro.r, zr, ro);
  const brand = P.textDecal({ text: 'GREENACRE', z0: 0.75, z1: 1.7, y0: 1.24, y1: 1.4, ink: '#e8c21c' });
  const num = P.textDecal({ text: '5045', z0: 0.2, z1: 0.6, y0: 1.24, y1: 1.4, ink: '#f2f2f0' });
  return vMats(P, { body: '#2f7d32', body2: '#e8c21c', steel: '#e8c21c', stripe: '#e8c21c', interior: '#1c1c1e', paintSize: 512,
    paint: { seams: [], belt: 1.6, sill: 0.9, decal: P.decals(brand, num) } });
}
