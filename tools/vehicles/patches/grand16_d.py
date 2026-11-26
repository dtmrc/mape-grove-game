# apply to: git checkout bb4ac65 -- v-grand16.js ; detail pass (2026-11-25) traced against the front 3/4 photo through the solved camera
s=open('v-grand16.js').read()
R=[("const gy = 0.92, gz = K.faceAt(Bd, gy) + 0.012, gt = K.faceTilt(Bd, 0.84, 1.0);","const gy = 0.93, gz = K.faceAt(Bd, gy) + 0.012, gt = K.faceTilt(Bd, 0.83, 1.03);"),
("for (let k = 0; k < 7; k++) { const x = -0.39 + k * 0.13;","for (let k = 0; k < 7; k++) { const x = -0.405 + k * 0.135;"),
("pts: [[-0.045, 0.08], [0.045, 0.08], [0.045, -0.075], [-0.045, -0.075]]","pts: [[-0.05, 0.1], [0.05, 0.1], [0.05, -0.095], [-0.05, -0.095]]"),
("K.wrap(Bd, 'Clad', { x0: 0, zb: 2.1, y0: 0.36, y1: (u) => 0.7 - (u > 1 ? (u - 1) * 0.12 : 0),","K.wrap(Bd, 'Clad', { x0: 0, zb: 2.1, y0: 0.36, y1: (u) => 0.6 - (u > 1 ? (u - 1) * 0.06 : 0),"),
("K.wrap(Bd, 'Grille', { x0: 0, x1: 0.5, y0: 0.44, y1: 0.58,","K.wrap(Bd, 'Grille', { x0: 0, x1: 0.55, y0: 0.42, y1: (u) => 0.57 - u * 0.03,"),
("sw: 0.014, depth: 0.03, frame: 'Chrome'","sw: 0.02, depth: 0.04, frame: 'Chrome'"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-grand16.js','w').write(s)
