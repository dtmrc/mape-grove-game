# apply to: git checkout bb4ac65 -- v-crest12.js
# detail pass 2 (2026-11-25): grille, lamps, bumper, flares traced against the front 3/4 photo through the solved camera (pmatch.py)
s=open('v-crest12.js').read()
R=[("const gy = 0.845, gz = K.faceAt(Bd, gy) + 0.008, gt = K.faceTilt(Bd, 0.8, 0.89);","const gy = 0.835, gz = K.faceAt(Bd, gy) + 0.008, gt = K.faceTilt(Bd, 0.74, 0.93);"),
("K.softGrille({ pts: [[0.46, 0.055], [0.38, -0.06]],","K.softGrille({ pts: [[0.47, 0.095], [0.44, 0.01], [0.36, -0.06], [0.0, -0.1]],"),
("bars: [[0.032, 0.02, 'Chrome'], [-0.005, 0.02, 'Chrome'], [-0.04, 0.018, 'Chrome']], badge: { w: 0.1, h: 0.085, key: 'Chrome', ring: false } });",
 "bars: [[0.07, 0.022, 'Chrome', 0.9], [0.02, 0.022, 'Chrome', 0.84], [-0.03, 0.02, 'Chrome', 0.7]], badge: { w: 0.1, h: 0.085, key: 'Chrome', ring: false, y: 0.02 } });"),
("const up0 = (u) => (u <= 1 ? 0.80 : 0.80 + (u - 1) * 0.19), up1 = (u) => (u <= 1 ? 0.905 : 0.905 + (u - 1) * 0.09);",
 "const up0 = (u) => (u <= 1 ? 0.84 - (1 - u) * 0.03 : 0.84 + (u - 1) * 0.17), up1 = (u) => (u <= 1 ? 0.935 : 0.935 + (u - 1) * 0.075);"),
("K.wrap(Bd, 'Head', { x0: 0.62, x1: 0.76, y0: 0.825, y1: 0.88, off: 0.016, n1: 2, rows: 1 });","K.wrap(Bd, 'Head', { x0: 0.6, x1: 0.78, y0: 0.86, y1: 0.92, off: 0.016, n1: 2, rows: 1 });"),
("K.wrap(Bd, 'Clad', { x0: 0, zb: 1.95, y0: 0.29, y1: (u) => 0.5 - (u > 1 ? (u - 1) * 0.08 : 0), off: 0.008, n1: 6, n2: 3 });",
 "K.wrap(Bd, 'Clad', { x0: 0, zb: 1.99, y0: 0.29, y1: (u) => 0.43 + (u > 1 ? (u - 1) * 0.04 : 0), off: 0.008, n1: 6, n2: 3 });"),
("K.wrap(Bd, 'Grille', { x0: 0, x1: 0.42, y0: 0.34, y1: 0.44, off: 0.014, n1: 3, rows: 1 });","K.wrap(Bd, 'Grille', { x0: 0, x1: 0.4, y0: 0.33, y1: 0.42, off: 0.014, n1: 3, rows: 1 });\n  K.wrap(Bd, 'Gloss', { x0: 0.5, x1: 0.82, y0: (u) => 0.43 + u * 0.02, y1: (u) => 0.6 - u * 0.04, off: 0.012, n1: 3, rows: 1 });   // fog pockets (blueprint: y 0.43-0.60)"),
("K.wrap(Bd, 'Clear', { x0: 0.6, x1: 0.72, y0: 0.44, y1: 0.5, off: 0.016, n1: 2, rows: 1 });","K.wrap(Bd, 'Clear', { x0: 0.6, x1: 0.68, y0: 0.48, y1: 0.535, off: 0.017, n1: 2, rows: 1 });"),
("K.archLips(Bd, 'Clad', { gap: -0.005, t: 0.04, y0: 0.3 });","K.archLips(Bd, 'Clad', { gap: 0, t: 0.03, y0: 0.3, flat: 0.7 });"),
("arches: [{ z: zf, r: 0.38, cy: r }, { z: zr, r: 0.38, cy: r }]","arches: [{ z: zf, r: 0.45, cy: r }, { z: zr, r: 0.45, cy: r }]"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-crest12.js','w').write(s)
# rear: lamps climb the hatch edge up to the spoiler (rear photo); the side view part stays as traced off the blueprint
s=open('v-crest12.js').read()
a="  K.bodyPolyY(Bd, 'Tail', tl, 0.014); K.ghPolyY(gh, 'Tail', tl, 0.02);"
assert a in s
s=s.replace(a, a+"\n  K.ghEdge(gh, 'Tail', -2.05, -1.87, 0.84, 1.0, { off: 0.01 });")
open('v-crest12.js','w').write(s)
# bumper corners clad right round to the arch, shaped fog pockets with round lamps, projector headlamps
s=open('v-crest12.js').read()
R=[("K.wrap(Bd, 'Clad', { x0: 0, zb: 1.99, y0: 0.29,","K.wrap(Bd, 'Clad', { x0: 0, zb: 1.79, y0: 0.29,"),
("K.wrap(Bd, 'Gloss', { x0: 0.5, x1: 0.82, y0: (u) => 0.43 + u * 0.02, y1: (u) => 0.6 - u * 0.04, off: 0.012, n1: 3, rows: 1 });",
 "K.wrap(Bd, 'Gloss', { x0: 0.48, x1: 0.84, y0: (u) => 0.475 - u * 0.04, y1: (u) => 0.545 + u * 0.05, off: 0.012, n1: 5, rows: 1 });"),
("  K.wrap(Bd, 'Clear', { x0: 0.6, x1: 0.68, y0: 0.48, y1: 0.535, off: 0.017, n1: 2, rows: 1 });\n",
 "  for (const sd of [-1, 1]) { const c = new K.T.CylinderGeometry(0.032, 0.032, 0.02, 14); c.rotateX(Math.PI / 2); K.put('Clear', c, [sd * 0.68, 0.51, K.faceAtX(Bd, 0.68, 0.51) + 0.012]); }\n"),
("K.wrap(Bd, 'Head', { x0: 0.6, x1: 0.78, y0: 0.86, y1: 0.92, off: 0.016, n1: 2, rows: 1 });",
 "K.wrap(Bd, 'Head', { x0: 0.52, x1: 0.8, y0: (u) => 0.85 + u * 0.01, y1: (u) => 0.915 + u * 0.01, off: 0.016, n1: 3, rows: 1 });\n  for (const sd of [-1, 1]) { const c = new K.T.TorusGeometry(0.034, 0.008, 4, 16), y = 0.885, x = 0.7; K.put('Chrome', c, [sd * x, y, K.faceAtX(Bd, x, y) + 0.02]); }"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-crest12.js','w').write(s)
