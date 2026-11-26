# detail pass (2026-11-25) traced against the Blazer front 3/4 photo (front34b) through the solved camera + blueprint crop:
# main grille raised to sit right under the bowtie bar, separate lower intake, corner lamp pockets lowered, door handles where the blueprint has them
s=open('v-blazonppv23.js').read()
R=[("K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.42, y1: 0.82, off: 0.011, n1: 5, rows: 3 });",
    "K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.42, y1: 0.82, off: 0.011, n1: 5, rows: 3 });\n"
    "  K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.5, y0: 0.44, y1: 0.51, off: 0.015, n1: 5, rows: 1 });             // lower intake"),
("K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.56, y0: 0.44, y1: 0.74,","K.wrap(Bd, 'Honeycomb', { x0: 0, x1: 0.56, y0: 0.565, y1: 0.75,"),
("K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.26, y0: 0.56,","K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.26, y0: 0.52,"),
("K.wrap(Bd, 'Head', { x0: 0.68, x1: 0.84, y0: 0.6, y1: 0.68,","K.wrap(Bd, 'Head', { x0: 0.7, x1: 0.85, y0: 0.58, y1: 0.66,"),
("K.handles(Bd, [0.4, -0.65], 1.13,","K.handles(Bd, [0.0, -1.05], 0.99,"),
("K.wrap(Bd, 'Skin', { x0: 0, x1: 0.6, y0: 0.76, y1: 0.8, off: 0.02, n1: 5, rows: 1 });","K.wrap(Bd, 'Paint', { x0: 0, x1: 0.6, y0: 0.76, y1: 0.8, off: 0.02, n1: 5, rows: 1 });"),
("K.box('Gold', 0, 0.744, K.faceAt(Bd, 0.744) + 0.03","K.box('Gold', 0, 0.78, K.faceAt(Bd, 0.78) + 0.034"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-blazonppv23.js','w').write(s)
