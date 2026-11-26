# apply to: git checkout bb4ac65 -- v-rambla24.js ; detail pass (2026-11-25) traced against the 2022 front 3/4 photo through the solved camera
s=open('v-rambla24.js').read()
R=[("K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.56, y0: 0.45, y1: (u) => 0.865 - u * 0.02, off: 0.01, n1: 3, rows: 2 });\n  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.5, y0: 0.48, y1: (u) => 0.83 - u * 0.02, off: 0.014, n1: 3, rows: 1 });",
 "K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.6, y1: (u) => 0.85 - Math.max(0, u - 0.55) * 0.5, off: 0.01, n1: 8, rows: 2 });            // upper grille: trapezoid, wide at the bottom, top corners cut under the lamps\n"
 "  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.55, y0: 0.625, y1: (u) => 0.825 - Math.max(0, u - 0.5) * 0.48, off: 0.014, n1: 8, rows: 1 });\n"
 "  K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.52, y0: 0.33, y1: (u) => 0.5 - u * 0.04, off: 0.012, n1: 4, rows: 1 });                          // lower intake behind the plate\n"
 "  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.48, y0: 0.35, y1: (u) => 0.48 - u * 0.04, off: 0.015, n1: 4, rows: 1 });"),
("const u0 = (u) => (u <= 1 ? 0.87 : 0.87 + (u - 1) * 0.125), u1 = (u) => (u <= 1 ? 0.95 : 0.95 + (u - 1) * 0.05);",
 "const u0 = (u) => (u <= 1 ? 0.8 + u * 0.03 : 0.83 + (u - 1) * 0.085), u1 = (u) => (u <= 1 ? 0.872 + u * 0.022 : 0.894 + (u - 1) * 0.07);   // lamps stay under the hood edge"),
("K.wrap(Bd, 'Gloss', { x0: 0.56, zb: 1.7, y0: u0, y1: u1,","K.wrap(Bd, 'Gloss', { x0: 0.36, zb: 1.88, y0: (u) => u0(u) - 0.01, y1: (u) => u1(u) + 0.006,"),
("K.wrap(Bd, 'Head', { x0: 0.6, zb: 1.95,","K.wrap(Bd, 'Head', { x0: 0.4, zb: 1.9,"),
("K.wrap(Bd, 'Gloss', { x0: 0.64, x1: 0.78, y0: 0.5, y1: 0.76, off: 0.012, n1: 1, rows: 1 });   // corner vents",
 "K.wrap(Bd, 'Gloss', { x0: 0.68, zb: 2.12, y0: (u) => 0.5 + u * 0.04, y1: (u) => 0.74 - u * 0.05, off: 0.012, n1: 2, n2: 2, rows: 1 });   // corner vents\n"
 "  for (const yy of [0.56, 0.61, 0.66]) K.wrap(Bd, 'Clad', { x0: 0.69, zb: 2.13, y0: yy, y1: yy + 0.015, off: 0.016, n1: 2, n2: 2, rows: 1 });"),
("y0: (u) => u0(u) + 0.02, y1: (u) => u1(u) - 0.02","y0: (u) => u0(u) + 0.006, y1: (u) => u1(u) - 0.006"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-rambla24.js','w').write(s)
