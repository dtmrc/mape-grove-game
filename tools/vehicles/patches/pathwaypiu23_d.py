# detail pass (2026-11-25) traced against the PIU front 3/4 photo through the solved camera: taller swept headlamp blade,
# black lower valance down to the ground line, fins in the corner pockets (push bar is now the open tube frame in vkit)
s=open('v-pathwaypiu23.js').read()
R=[("K.wrap(Bd, 'Gloss', { x0: 0.56, zb: 2.16, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 1.0 - (u > 1 ? (u - 1) * 0.01 : 0)",
    "K.wrap(Bd, 'Gloss', { x0: 0.5, zb: 2.16, y0: (u) => 0.885 + (u > 1 ? (u - 1) * 0.07 : 0), y1: (u) => 1.012 - (u > 1 ? (u - 1) * 0.01 : 0)"),
("K.wrap(Bd, 'Head', { x0: 0.6, zb: 2.22, y0: (u) => 0.925 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.975 - (u > 1 ? (u - 1) * 0.01 : 0)",
 "K.wrap(Bd, 'Head', { x0: 0.54, zb: 2.2, y0: (u) => 0.9 + (u > 1 ? (u - 1) * 0.07 : 0), y1: (u) => 1.0 - (u > 1 ? (u - 1) * 0.01 : 0)"),
("K.wrap(Bd, 'Clad', { x0: 0, zb: 2.09, y0: 0.4,","K.wrap(Bd, 'Clad', { x0: 0, zb: 2.09, y0: 0.28,"),
("K.wrap(Bd, 'Gloss', { x0: 0.6, x1: 0.86, y0: 0.58, y1: 0.72, off: 0.012, n1: 2, rows: 1 });",
 "K.wrap(Bd, 'Gloss', { x0: 0.6, x1: 0.86, y0: 0.6, y1: (u) => 0.7 + u * 0.02, off: 0.012, n1: 2, rows: 1 });\n"
 "  for (const y of [0.625, 0.66]) K.wrap(Bd, 'Clad', { x0: 0.62, x1: 0.84, y0: y, y1: y + 0.014, off: 0.02, n1: 2, rows: 1 });   // pocket fins"),
("K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.56, y0: 0.8, y1: 1.0, off: 0.012, n1: 5, rows: 2 });","K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.58, y0: (u) => 0.66 + 0.33 * (1 - Math.sqrt(Math.max(0, 1 - u * u * u * u))), y1: 1.0, off: 0.012, n1: 12, rows: 2 });   // upside-down D grille, flat top from lamp to lamp"),
("K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.52, y0: 0.82, y1: 0.98, off: 0.016, n1: 5, rows: 1 });","K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.55, y0: (u) => 0.68 + 0.29 * (1 - Math.sqrt(Math.max(0, 1 - u * u * u * u))), y1: 0.985, off: 0.016, n1: 12, rows: 1 });"),
("K.box('Badge', 0, 0.908, K.faceAt(Bd, 0.908) + 0.024","K.box('Badge', 0, 0.87, K.faceAt(Bd, 0.87) + 0.024"),
("K.handles(Bd, [0.58, -0.62], 1.16,","K.handles(Bd, [0.06, -1.05], 1.15,"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-pathwaypiu23.js','w').write(s)
