# detail pass (2026-11-25) traced against the 2021+ Escalade front 3/4 photo through the solved camera:
# wider grille reaching the lamps, slim lamps lowered under the hood line, vertical light blades out on the corners with a chrome hook along the bumper
s=open('v-escalon24.js').read()
R=[("pts: [[0.62, 0.25], [0.52, -0.26]]","pts: [[0.7, 0.25], [0.68, 0.0], [0.6, -0.26]]"),
("K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.25, y0: 1.03, y1: 1.16,","K.wrap(Bd, 'Gloss', { x0: 0.66, zb: 2.25, y0: 0.965, y1: 1.07,"),
("K.wrap(Bd, 'Head', { x0: 0.67, zb: 2.3, y0: 1.06, y1: 1.13,","K.wrap(Bd, 'Head', { x0: 0.7, zb: 2.3, y0: 0.985, y1: 1.05,"),
("K.wrap(Bd, 'Chrome', { x0: 0.78, x1: 0.9, y0: 0.45, y1: 0.93, off: 0.012, n1: 1, rows: 2 });",
 "K.bodyPolyY(Bd, 'Chrome', [[2.32, 0.95], [2.27, 0.95], [2.25, 0.5], [2.32, 0.47]], 0.012);\n"
 "  K.wrap(Bd, 'Chrome', { x0: 0.62, x1: 0.98, y0: 0.45, y1: 0.48, off: 0.012, n1: 2, rows: 1 });                 // chrome hook along the bumper"),
("K.wrap(Bd, 'LightWhite', { x0: 0.82, x1: 0.86, y0: 0.49, y1: 0.89, off: 0.016, n1: 1, rows: 2 });","K.bodyPolyY(Bd, 'LightWhite', [[2.305, 0.92], [2.285, 0.92], [2.27, 0.52], [2.305, 0.5]], 0.016);"),
("[[2.23, 0.82], [2.17, 0.82], [2.17, 0.75], [2.23, 0.75]]","[[2.06, 0.82], [2.0, 0.82], [2.0, 0.75], [2.06, 0.75]]"),
("K.softGrille({ pts: [[0.7, 0.25], [0.68, 0.0], [0.6, -0.26]], y: gy, z: gz, sw: 0.03, depth: 0.05, frame: 'Chrome', fill: 'Mesh', round: 2, rad: 0.05, badge: { w: 0.2, h: 0.14, key: 'Chrome', ring: false, y: 0.12 } });",
 """K.softGrille({ pts: [[0.7, 0.25], [0.68, 0.0], [0.6, -0.26]], y: gy, z: gz + 0.012, tilt: 0.17, sw: 0.03, depth: 0.05, frame: 'Chrome', fill: 'Gloss', round: 2, rad: 0.05 });
  {   // grille finish from the photo: chrome diamond studs on black, the Cadillac crest
    const tl = 0.17, c = Math.cos(tl), sn = Math.sin(tl), at = (x, dy, dz) => [x, gy + dy * c + dz * sn, gz + 0.012 - dy * sn + dz * c];
    const hw = (dy) => (dy > 0 ? 0.68 + (0.7 - 0.68) * dy / 0.25 : 0.68 + (0.6 - 0.68) * -dy / 0.26) - 0.06;
    for (let r = 0, dy = -0.225; dy < 0.225; r++, dy += 0.034) for (let x = (r % 2) * 0.024; x < hw(dy); x += 0.048) for (const sx of x ? [-1, 1] : [1]) {
      if (Math.abs(sx * x) < 0.14 && Math.abs(dy - 0.11) < 0.08) continue;                 // keep the crest clear
      K.box('Chrome', ...at(sx * x, dy, -0.004), 0.02, 0.02, 0.012, [-tl, 0, Math.PI / 4]);
    }
    const sh = new K.T.Shape(); sh.moveTo(-0.11, 0.05); sh.lineTo(0.11, 0.05); sh.lineTo(0.095, -0.02); sh.lineTo(0, -0.06); sh.lineTo(-0.095, -0.02); sh.closePath();
    K.put('Chrome', new K.T.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 1 }), at(0, 0.11, -0.01), [-tl, 0, 0]);
    for (const [qx, qy, key] of [[-0.048, 0.02, 'Gold'], [0.048, 0.02, 'Gloss'], [-0.04, -0.016, 'LightRed'], [0.04, -0.016, 'LightBlue']]) K.box(key, ...at(qx, 0.11 + qy, 0.016), 0.085, 0.032, 0.006, [-tl, 0, 0]);
    K.box('Chrome', ...at(0, 0.11, 0.02), 0.01, 0.09, 0.006, [-tl, 0, 0]); K.box('Chrome', ...at(0, 0.11, 0.02), 0.19, 0.008, 0.006, [-tl, 0, 0]);
  }"""),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-escalon24.js','w').write(s)
