// Goobles' truck: 1999 Ironside F-15 Prairie half-cab (counterpart: 1997-2003 Ford F-150 SuperCab, 10th gen), gloss black.
// v2 (diet's photos, 2026-11-24): tall boxy 10th-gen stance, high flat hood and blunt nose, upside-down soft trapezoid
// grille with a BLACK surround and honeycomb, big swept headlamps, chrome bumper over a black valance, white lower
// two-tone stripe (with white arch lips) along the whole side, double pinstripe molding, rear half doors, Styleside bed.
// 5.61 x 1.99 m, height ~1.9 m, wheelbase 3.6 m, 255/70R16.
// eslint-disable-next-line no-unused-vars
function build_goobtruck(K, P) {
  const T = K.T, r = 0.39, zf = 1.99, zr = -1.62, cab = -0.62, F = 2.805, sill = 0.5;
  const Bd = K.body({
    top: [[cab, 1.36], [0.4, 1.365], [1.28, 1.37], [1.9, 1.335], [2.4, 1.29], [2.64, 1.25], [2.75, 1.2], [2.79, 1.08], [F, 0.86]],
    half: [[cab, 0.995], [2.2, 0.995], [2.55, 0.975], [2.75, 0.94], [F, 0.9]],
    bottom: [[cab, sill], [2.5, sill], [F, 0.56]],
    sill, floor: 0.42, tumble: 0.06, crown: 0.05, shoulder: 0.5,
    arches: [{ z: zf, r: r + 0.09, cy: r }], inset: 0.33,
  });
  // cab: flat-ish roof, body-colour A pillars, black B pillar, small rear half-door glass
  const gh = K.greenhouse(Bd, { st: [[1.28, null, 0.84], [0.76, 1.885, 0.8], [-0.46, 1.88, 0.8], [-0.56, null, 0.85]], roof: [1, 2], inset: 0.04, crown: 0.05 });
  K.ghSide(gh, 'Paint', 0.74, 1.28, 0.84, 1.0);
  K.ghSide(gh, 'Trim', 0.08, 0.17, 0, 1.0);
  K.ghSide(gh, 'Paint', -0.56, -0.34, 0, 1.0);
  K.ghSide(gh, 'Trim', -0.34, 1.26, 0, 0.035);
  K.ghSide(gh, 'Trim', -0.34, 0.76, 0.95, 1.0, 0.018);
  K.ghTop(gh, 'Paint', 0.76, 1.28, 0.9, 1.0);
  K.rod('Trim', [0.94, 1.32, 1.85], [0.97, 2.08, 1.75], 0.005, 4);            // fender antenna
  // ---- nose ----
  // grille: an upside-down trapezoid with soft corners, wide at the top, black surround + honeycomb + oval badge
  const tilt = -0.12, gy = 1.02, gz = 2.82;
  // chaikin keeps the end points, so round the closed loop by starting mid-edge
  const ring = (tw, bw, ht, hb) => {
    const c = [[0, ht], [tw, ht], [bw, -hb], [-bw, -hb], [-tw, ht], [0, ht]];
    let P2 = c; for (let n = 0; n < 3; n++) { const Q = [P2[0]]; for (let i = 0; i < P2.length - 1; i++) { const a = P2[i], b = P2[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } Q.push(P2[P2.length - 1]); P2 = Q; }
    const sh = new T.Shape(); P2.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); return sh;
  };
  const outer = ring(0.47, 0.31, 0.15, 0.14), inner = ring(0.41, 0.265, 0.105, 0.1);
  outer.holes.push(inner);
  const sg = new T.ExtrudeGeometry(outer, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 2 });
  K.put('Trim', sg, [0, gy, gz - 0.02], [tilt, 0, 0]);
  const fillShape = ring(0.42, 0.27, 0.11, 0.105);
  K.put('Honeycomb', new T.ExtrudeGeometry(fillShape, { depth: 0.02, bevelEnabled: false }), [0, gy, gz - 0.01], [tilt, 0, 0]);
  K.box('Grille', 0, gy, gz - 0.09, 0.95, 0.3, 0.06, [tilt, 0, 0]);                          // backing so nothing shows through
  const ov = new T.CylinderGeometry(1, 1, 0.025, 20); ov.rotateX(Math.PI / 2); ov.scale(0.095, 0.045, 1);
  K.put('Badge', ov, [0, gy + 0.005, gz + 0.01], [tilt, 0, 0]);
  const ovr = new T.TorusGeometry(1, 0.12, 4, 20); ovr.scale(0.1, 0.05, 0.1);
  K.put('Chrome', ovr, [0, gy + 0.005, gz + 0.022], [tilt, 0, 0]);
  // headlamps: big swept units from the grille to the fender corner, amber corner lamps wrapping round the side
  for (const s of [-1, 1]) {
    const hs = new T.Shape(); // in (x, y), outer edge rounded, inner edge following the grille slant
    const pts = [[0.48, 0.15], [0.86, 0.14], [0.9, 0.1], [0.9, -0.06], [0.87, -0.1], [0.4, -0.1]];
    pts.forEach(([x, y], i) => (i ? hs.lineTo(s * x, y) : hs.moveTo(s * x, y)));
    const hg = new T.ExtrudeGeometry(hs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.01, bevelSegments: 1 });
    K.put('Head', hg, [0, gy, gz - 0.13], [tilt, 0, 0]);
    K.put('Head', new T.BoxGeometry(0.03, 0.2, 0.2), [s * 0.925, gy + 0.03, gz - 0.12], [0, 0, 0]);
    K.box('Amber', s * 0.89, gy - 0.135, gz - 0.06, 0.1, 0.06, 0.1, [tilt, 0, 0]);
    K.box('Amber', s * 0.935, gy - 0.135, gz - 0.16, 0.03, 0.06, 0.16);
  }
  // chrome bumper over a black valance with fog lamps
  K.barX('Chrome', 1.96, 0.72, F + 0.06, 0.22, 0.22, 0.6);
  for (const s of [-1, 1]) K.box('Chrome', s * 0.97, 0.72, F - 0.12, 0.1, 0.22, 0.3, [0, s * 0.5, 0]);   // bumper wrap
  K.box('Plastic', 0, 0.55, F + 0.02, 1.78, 0.13, 0.16);
  for (const s of [-1, 1]) K.sbox('Clear', 0.62, 0.55, F + 0.1, 0.18, 0.07, 0.02);
  K.box('Grille', 0, 0.55, F + 0.1, 0.5, 0.05, 0.02);
  K.plate(0, 0.72, F + 0.175, true);
  // ---- Styleside bed with tall lamps, chrome step bumper ----
  K.bed({ z0: -F, z1: cab - 0.03, sill, floor: 0.95, top: 1.36, w: 0.995, arch: { z: zr, r: r + 0.09, cy: r } });
  for (const s of [-1, 1]) {
    K.box('Tail', s * 0.95, 1.16, -F - 0.012, 0.13, 0.3, 0.03);
    K.box('Clear', s * 0.95, 0.96, -F - 0.012, 0.13, 0.08, 0.03);
    K.box('Amber', s * 0.95, 0.89, -F - 0.012, 0.13, 0.05, 0.03);
  }
  K.box('Chrome', 0, 1.2, -F - 0.01, 0.12, 0.07, 0.02);
  K.barX('Chrome', 2.0, 0.62, -F - 0.08, 0.22, 0.18, 0.4);
  K.box('Steel', 0, 0.735, -F - 0.08, 0.5, 0.02, 0.12);                       // step pad
  K.plate(0, 0.62, -F - 0.18, false);
  K.box('Steel', 0, 0.5, -F - 0.05, 0.08, 0.08, 0.2);                         // hitch
  // ---- side: white arch lips, double pinstripe molding, mirrors, handles, mud flaps, gas door ----
  for (const az of [zf, zr]) for (const s of [-1, 1]) {
    const R = r + 0.11, a0 = Math.asin((sill - r) / R);
    const lip = new T.TorusGeometry(R, 0.035, 4, 20, Math.PI - 2 * a0); lip.rotateZ(a0); lip.scale(1, 1, 0.5); lip.rotateY(Math.PI / 2);
    K.put('Stripe', lip, [s * (Bd.half(az) + 0.01), r, az]);
  }
  // white lower two-tone stripe: a thin skin from the rocker to y 0.78 that steps around both wheel arches
  {
    const y1 = 0.78, R = r + 0.11, N = 120, z0 = -F + 0.01, z1 = 2.72, pos = [];
    const yb = (z) => { let y = sill - 0.02; for (const az of [zf, zr]) { const d = z - az; if (Math.abs(d) < R) y = Math.max(y, r + Math.sqrt(R * R - d * d)); } return Math.min(y, y1); };
    const wz = (z) => (z < cab ? 0.995 : Bd.half(z)) + 0.006;
    for (let k = 0; k < N; k++) {
      const za = z0 + ((z1 - z0) * k) / N, zb = z0 + ((z1 - z0) * (k + 1)) / N, ya = yb(za), yb2 = yb(zb);
      if (ya >= y1 - 1e-4 && yb2 >= y1 - 1e-4) continue;
      for (const sd of [-1, 1]) {
        const A = [sd * wz(za), ya, za], B = [sd * wz(zb), yb2, zb], C = [sd * wz(zb), y1, zb], D = [sd * wz(za), y1, za];
        if (sd > 0) pos.push(...A, ...C, ...B, ...A, ...D, ...C); else pos.push(...A, ...B, ...C, ...A, ...C, ...D);
      }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); K.put('Stripe', g);
  }
  for (const y of [0.85, 0.885]) for (const [z0, z1] of [[zr + 0.55, zf - 0.56]]) K.bodySide(Bd, 'Pin', z0, z1, y, y + 0.012, 0.008, 12);
  K.mirrors(0.95, 1.5, 1.12, { w: 0.22, h: 0.26, d: 0.08, key: 'Trim' });
  K.handles(Bd, [0.3], 1.27, { key: 'Trim' });
  for (const s of [-1, 1]) { K.box('Plastic', s * 0.86, 0.38, zf - 0.52, 0.24, 0.24, 0.02); K.box('Plastic', s * 0.86, 0.38, zr - 0.52, 0.24, 0.24, 0.02); }
  K.box('Paint', -1.0, 1.2, -0.95, 0.01, 0.16, 0.16);
  K.wheels([zf, zr], { x: 0.85, r, w: 0.255, rim: 0.56, style: 'spoke', spokes: 7, spokeW: 0.16, rimKey: 'Chrome', capKey: 'Chrome' });
  return vMats(P, { body: '#16181b', head: { a: '#dde3e8', b: '#a2acb6' }, paint: { gloss: 1, seams: [1.27, 0.14, -0.5], hood: 1.32, belt: 1.36, sill: 0.62 }, extra: {
    Honeycomb: { paint: (p) => ((Math.floor(p.x * 30 + (Math.floor(p.y * 26) & 1) * 0.5) + Math.floor(p.y * 26)) % 2 ? [16, 17, 19] : [74, 77, 82]), size: 128, color: '#1a1b1d' },
    Badge: { paint: P.plain('#1f3f8a', 0.05), size: 16, color: '#1f3f8a' },
    Stripe: { paint: P.plain('#e8e6de', 0.04), size: 32, color: '#e8e6de' },
    Pin: { paint: P.plain('#9aa0a8', 0.04), size: 16, color: '#9aa0a8' } } });
}
