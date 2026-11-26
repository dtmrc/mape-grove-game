# detail pass (2026-11-25) traced against the front 3/4 photo through the solved camera: no front plate, gold bar across the grille,
# bumper stands proud of the body with a silver band and a dark slot, as in the photo
s=open('v-pathway97.js').read()
R=[("  K.plate(0, 0.62, K.faceAt(Bd, 0.62) + 0.022, true);\n",""),
("K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.42, y1: 0.71, off: 0.01, n1: 6, n2: 3 });","K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.42, y1: 0.71, off: 0.03, n1: 6, n2: 3 });\n  K.wrap(Bd, 'Stripe', { x0: 0, zb: 2.08, y0: 0.5, y1: 0.585, off: 0.034, n1: 6, n2: 3, rows: 1 });"),
("K.wrap(Bd, 'Grille', { x0: 0, x1: 0.42, y0: 0.5, y1: 0.55, off: 0.016, n1: 3, rows: 1 });","K.wrap(Bd, 'Grille', { x0: 0, x1: 0.3, y0: 0.525, y1: 0.565, off: 0.037, n1: 3, rows: 1 });"),
("bars: [[0.0, 0.014, 'Steel']]","bars: [[0.0, 0.024, 'Gold']]"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-pathway97.js','w').write(s)
