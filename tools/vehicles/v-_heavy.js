// Shared builders for work trucks (cab-chassis pickups, big rigs, fire apparatus).
// eslint-disable-next-line no-unused-vars
function heavyKit(K) {
  const H = {};
  /** dual rear wheels (inner + outer per side) */
  // game export (MODE body / wheel): the duals stay out of the body and become the rear axle; the game hangs two wheel meshes on
  // each rear pivot (wheel.json duals = {x: outer wheel centre, w: wheel width + gap})
  H.duals = (z, x, r, w, o = {}) => { if (K.mode) { if (K.wheelOpt) { K.wheelOpt.axles = [...K.wheelOpt.axles, z]; K.wheelOpt.duals = { x, w: w + 0.02 }; } return; } for (const s of [-1, 1]) { K.wheel(s * x, r, z, { r, w, rim: 0.56, style: 'steel', holes: 10, ...o }); K.wheel(s * (x - w - 0.02), r, z, { r, w, rim: 0.56, style: 'steel', holes: 10, ...o }); } };
  /** frame rails and a fuel tank */
  H.rails = (z0, z1, y, hw = 0.45) => { for (const s of [-1, 1]) K.bx('Under', s * hw, y, z0, s * (hw - 0.1), y + 0.22, z1); };
  /** mud flaps behind a wheel */
  H.flaps = (z, x, y0, y1) => { for (const s of [-1, 1]) K.box('Plastic', s * x, (y0 + y1) / 2, z, 0.5, y1 - y0, 0.02); };
  /**
   * Heavy-duty cab-chassis front end (Super Duty / medium duty style): body loft for the hood + cab, greenhouse, big grille.
   * o = {front, back (cab back z), hood (hood height), belt, roof, w (half width), r, zf, crew (bool), key}
   */
  H.cab = (o) => {
    const key = o.key ?? 'Paint', W = o.w, F = o.front, h = o.hood, yb = o.yb, ws = F - (o.hoodLen ?? 1.6), gm = o.style === 'gmt400';
    // square-shouldered hood and cab: flat belt to the cowl, near-flat hood, upright face, bumper shelf
    const Bd = K.body({
      top: [[o.back, o.belt], [ws - 0.3, o.belt], [ws + 0.1, h + 0.03], [F - 0.7, h + 0.01], [F - 0.2, h - 0.02], [F - 0.09, h - 0.05], [F - 0.07, h - 0.3], [F - 0.065, yb + 0.3], [F - 0.01, yb + 0.28], [F, yb + 0.14]],
      half: [[o.back, W], [F - 0.3, W], [F - 0.08, W - 0.02], [F, W - 0.08]],
      bottom: [[o.back, yb], [F - 0.2, yb], [F, yb + 0.04]], sill: yb, floor: yb - 0.07, tumble: 0.04, crown: 0.025, shoulder: 0.7,
      arches: [{ z: o.zf, r: o.r + 0.08, cy: o.r, sq: gm ? 0.92 : 0.6 }], inset: 0.34, key,
    });
    const gh = K.greenhouse(Bd, { st: [[ws, null, W - 0.12], [ws - 0.55, o.roof, W - 0.19], [o.back + 0.1, o.roof + 0.01, W - 0.19], [o.back + 0.01, null, W - 0.12]], roof: [1, 2], inset: 0.03, crown: 0.03, key });
    K.ghSide(gh, key, ws - 0.56, ws, 0.84, 1.0);
    K.ghSide(gh, 'Trim', o.crew ? ws - 1.25 : o.back + 0.15, o.crew ? ws - 1.15 : o.back + 0.25, 0, 1.0);
    K.ghSide(gh, key, o.back + 0.01, o.back + 0.16, 0, 1.0);
    K.ghTop(gh, key, ws - 0.55, ws, 0.9, 1.0);
    const fr = o.grilleFrame ?? 'Chrome', zb = F - 0.14;
    if (gm) {   // GMT400 HD: dark grey panel across the face, grille split by a bar with the gold emblem, stacked lamps
      K.wrap(Bd, 'Clad', { x0: 0, zb, y0: h - 0.36, y1: h - 0.07, off: 0.008, n1: 5, n2: 1, rows: 3 });
      K.wrap(Bd, 'Grille', { x0: 0, x1: W * 0.57, y0: h - 0.34, y1: h - 0.24, off: 0.014, n1: 2, rows: 1 });
      K.wrap(Bd, 'Grille', { x0: 0, x1: W * 0.57, y0: h - 0.19, y1: h - 0.095, off: 0.014, n1: 2, rows: 1 });
      K.wrap(Bd, 'Head', { x0: W * 0.61, zb: zb + 0.02, y0: h - 0.205, y1: h - 0.095, off: 0.016, n1: 2, n2: 1 });
      K.wrap(Bd, 'Clear', { x0: W * 0.61, x1: W * 0.88, y0: h - 0.34, y1: h - 0.225, off: 0.016, n1: 2, rows: 1 });
      K.wrap(Bd, 'Amber', { x0: W * 0.88, zb: zb + 0.02, y0: h - 0.34, y1: h - 0.225, off: 0.016, n1: 1, n2: 1, rows: 1 });
      K.box('Gold', 0, h - 0.215, K.faceAt(Bd, h - 0.215) + 0.02, 0.2, 0.06, 0.012);
    } else {    // Super Duty: tall frame with two thick bars and the oval, nostril slots over it, tall stacked lamps wrapping the corners
      const g0 = h - 0.5, g1 = h - 0.1;
      K.wrap(Bd, fr, { x0: 0, x1: W * 0.6, y0: g0, y1: g1, off: 0.01, n1: 4, rows: 2 });
      K.wrap(Bd, 'Honeycomb', { x0: 0, x1: W * 0.54, y0: g0 + 0.04, y1: g1 - 0.04, off: 0.016, n1: 4, rows: 1 });
      for (const y of [g0 + 0.115, g0 + 0.235]) K.wrap(Bd, fr, { x0: 0, x1: W * 0.56, y0: y, y1: y + 0.07, off: 0.03, n1: 4, rows: 1 });
      K.box('Badge', 0, g0 + 0.21, K.faceAt(Bd, g0 + 0.21) + 0.045, 0.24, 0.1, 0.012);
      K.wrap(Bd, 'Gloss', { x0: W * 0.6, zb, y0: g0 + 0.02, y1: g1, off: 0.01, n1: 3, n2: 2 });
      K.wrap(Bd, 'Head', { x0: W * 0.64, zb: zb + 0.04, y0: g0 + 0.2, y1: g1 - 0.03, off: 0.015, n1: 3, n2: 2, rows: 1 });
      K.wrap(Bd, 'Amber', { x0: W * 0.64, zb: zb + 0.04, y0: g0 + 0.11, y1: g0 + 0.18, off: 0.015, n1: 3, n2: 2, rows: 1 });
      K.wrap(Bd, 'Clear', { x0: W * 0.64, x1: W * 0.9, y0: g0 + 0.04, y1: g0 + 0.09, off: 0.015, n1: 2, rows: 1 });
    }
    K.wrap(Bd, o.bumper ?? 'Chrome', { x0: 0, zb: F - 0.3, y0: yb + 0.02, y1: yb + 0.27, off: 0.012, n1: 5, n2: 2 });
    if (!gm) { K.wrap(Bd, 'Grille', { x0: 0.1, x1: W * 0.5, y0: yb + 0.08, y1: yb + 0.2, off: 0.018, n1: 2, rows: 1 }); K.wrap(Bd, 'Clear', { x0: W * 0.66, x1: W * 0.84, y0: yb + 0.1, y1: yb + 0.18, off: 0.018, n1: 1, rows: 1 }); }
    K.plate(0, yb + 0.15, K.faceAt(Bd, yb + 0.15) + 0.026, true);
    K.archLips(Bd, gm ? key : 'Clad', { t: 0.04, y0: yb });
    K.mirrors(W, o.belt + 0.25, ws - 0.2, { w: 0.3, h: 0.36, key: gm ? 'Trim' : 'Chrome' });
    K.handles(Bd, o.crew ? [ws - 0.55, ws - 1.6] : [o.back + 0.45], o.belt - 0.09, { key: gm ? 'Trim' : 'Chrome' });
    for (const k of [-2, -1, 0, 1, 2]) K.box('Amber', k * 0.2, o.roof + 0.045, ws - 0.62, 0.07, 0.035, 0.05);
    return { Bd, gh, ws };
  };
  return H;
}
