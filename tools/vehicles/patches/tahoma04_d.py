# detail pass (2026-11-25) traced against the 2000-06 Tahoe front 3/4 photo through the solved camera + blueprint side crop:
# body-colour bumper cap with a dark slot, chrome face 0.43-0.64 standing proud, dark grey valance with fog lamps, amber outer lower lamp, chrome bowtie, no front plate
s=open('v-tahoma04.js').read()
R=[("  K.plate(0, 0.665, K.faceAt(Bd, 0.665) + 0.022, true);\n",""),
("K.box(o.police ? 'Trim' : 'Gold', 0, 0.883","K.box(o.police ? 'Trim' : 'Chrome', 0, 0.883"),
("  K.wrap(Bd, 'Amber', { x0: 0.58, zb: 2.3, y0: 0.825, y1: 0.857, off: 0.017, n1: 3, n2: 2, rows: 1 });",
 "  K.wrap(Bd, 'Amber', { x0: 0.73, zb: 2.3, y0: (u) => 0.768 + (u > 1 ? (u - 1) * 0.03 : 0), y1: 0.855, off: 0.017, n1: 2, n2: 2, rows: 1 });"),
("  K.wrap(Bd, br, { x0: 0, zb: 2.1, y0: 0.58, y1: 0.75, off: 0.01, n1: 6, n2: 3 });               // bumper\n  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.1, y0: 0.39, y1: 0.58, off: 0.01, n1: 6, n2: 3, rows: 1 });\n  K.wrap(Bd, 'Clear', { x0: 0.55, x1: 0.7, y0: 0.5, y1: 0.55, off: 0.016, n1: 2, rows: 1 });",
 "  K.wrap(Bd, 'Paint', { x0: 0, zb: 2.1, y0: 0.64, y1: 0.75, off: 0.03, n1: 6, n2: 3, rows: 2 });             // bumper cap, body colour\n"
 "  K.wrap(Bd, 'Trim', { x0: 0, x1: 0.3, y0: 0.635, y1: 0.652, off: 0.038, n1: 3, rows: 1 });               // slot in the cap\n"
 "  K.wrap(Bd, br, { x0: 0, zb: 2.1, y0: 0.47, y1: 0.64, off: 0.036, n1: 6, n2: 3 });                        // chrome face\n"
 "  K.wrap(Bd, 'Clad', { x0: 0, zb: 2.1, y0: 0.34, y1: 0.47, off: 0.018, n1: 6, n2: 3, rows: 1 });            // grey valance\n"
 "  K.wrap(Bd, 'Trim', { x0: 0.46, x1: 0.72, y0: 0.395, y1: 0.455, off: 0.022, n1: 2, rows: 1 });\n"
 "  K.wrap(Bd, 'Clear', { x0: 0.49, x1: 0.69, y0: 0.405, y1: 0.445, off: 0.026, n1: 2, rows: 1 });              // fog lamps"),
]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
open('v-tahoma04.js','w').write(s)

# 2026-11-26 diet: "the front nose shouldn't go inward, it's supposed to jut outward and be bevelled on either side. clean up those headlights"
# -> one nose block (plan: flat grille face, lamp faces angled back, 50 deg corner bevel) standing ahead of the old face; the hood comes forward
#    to its top edge; grille, bowtie and lamps built as clean panels on the block's faces (one piece each, no wraps)
s=open('v-tahoma04.js').read()
R=[("[2.25, 1.121], [2.3, 1.09], [2.345, 1.03]","[2.25, 1.13], [2.3, 1.105], [2.345, 1.078]"),
("[1.937, 1.0], [2.276, 0.975], [2.448, 0.88]","[2.1, 1.0], [2.22, 0.98], [2.36, 0.86], [2.448, 0.8]")]
for a,b in R:
    assert a in s, a; s=s.replace(a,b)
a=s.index("  K.wrap(Bd, 'Grille', { x0: 0, x1: 0.56, y0: 0.75, y1: 1.03"); b=s.index("\n", s.index("0.2, 0.06, 0.012);", a))+1
s=s[:a]+'''  {   // nose block: plan corners (x, z) right side, mirrored; faces = grille (C), lamp face (L), corner bevel (B)
    const yb = 0.755, yt = 1.068, C = [[0, 2.4], [0.6, 2.4]], L = [[0.6, 2.4], [0.88, 2.36]], B = [[0.88, 2.36], [0.99, 2.22]];
    const plan = [[-0.975, 2.15], [-0.99, 2.22], [-0.88, 2.36], [-0.6, 2.4], [0.6, 2.4], [0.88, 2.36], [0.99, 2.22], [0.975, 2.15]];
    const sh = new K.T.Shape(); plan.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); sh.closePath();
    const g = new K.T.ExtrudeGeometry(sh, { depth: yt - yb, bevelEnabled: false }); g.rotateX(-Math.PI / 2); K.put('Paint', g, [0, yb, 0]);
    // a panel on a plan segment [A, B] (right side, mirrored), from fraction f0..f1 along it, y0..y1, standing `off` proud of the face
    const pan = (key, seg, f0, f1, y0, y1, off, t = 0.008) => {
      const [[xa, za], [xb, zb]] = seg, dx = xb - xa, dz = zb - za, L0 = Math.hypot(dx, dz), th = Math.atan2(-dz, dx), nx = Math.sin(th), nz = Math.cos(th);
      const fm = (f0 + f1) / 2, cx = xa + dx * fm + nx * (off - t / 2), cz = za + dz * fm + nz * (off - t / 2), w = L0 * (f1 - f0);
      for (const s of cx < 1e-6 && xa === 0 && f0 === 0 ? [1] : [-1, 1]) K.box(key, s * cx, (y0 + y1) / 2, cz, w, y1 - y0, t, [0, s * th, 0]);
    };
    const cen = (key, x1, y0, y1, off, t = 0.008) => K.box(key, 0, (y0 + y1) / 2, 2.4 + off - t / 2, 2 * x1, y1 - y0, t);
    // grille: bright surround, two black mesh openings, the bar through grille and lamps
    cen(br, 0.6, 0.758, 1.045, 0.006); cen('Grille', 0.565, 0.772, 1.03, 0.01); cen('Mesh', 0.55, 0.912, 1.018, 0.013); cen('Mesh', 0.55, 0.776, 0.852, 0.013);
    cen(br, 0.6, 0.862, 0.903, 0.018);
    pan(br, L, 0, 1, 0.862, 0.903, 0.018); pan(br, B, 0, 0.55, 0.862, 0.903, 0.018);
    // headlamps: chrome bezel, upper clear lamp, lower clear lamp with amber on the outer third and round the corner
    for (const [seg, f1] of [[L, 1], [B, 0.75]]) { pan('Chrome', seg, 0, f1, 0.905, 1.042, 0.008); pan('Chrome', seg, 0, f1, 0.762, 0.86, 0.008); }
    pan('Chrome', L, 0.03, 0.985, 0.912, 1.034, 0.012); pan('Head', B, 0.02, 0.72, 0.912, 1.034, 0.014);\n    {   // twin round reflectors in the upper lamp, a clear parking lamp inside the lower one\n      const [[xa, za], [xb, zb]] = L, th = Math.atan2(-(zb - za), xb - xa);\n      for (const f of [0.3, 0.72]) for (const sd of [-1, 1]) { const x = xa + (xb - xa) * f, z = za + (zb - za) * f + 0.012;\n        const d = new K.T.CylinderGeometry(0.046, 0.05, 0.012, 16); d.rotateX(Math.PI / 2); K.put('Head', d, [sd * (x + Math.sin(th) * 0.008), 0.973, z + Math.cos(th) * 0.008 - 0.012 + 0.012], [0, sd * th, 0]);\n        const r = new K.T.TorusGeometry(0.05, 0.006, 4, 16); K.put('Chrome', r, [sd * (x + Math.sin(th) * 0.014), 0.973, z + Math.cos(th) * 0.014], [0, sd * th, 0]); }\n    }
    pan('Clear', L, 0.03, 0.6, 0.768, 0.856, 0.014); pan('Amber', L, 0.6, 0.985, 0.768, 0.856, 0.014); pan('Amber', B, 0.02, 0.72, 0.768, 0.856, 0.014);
    // bowtie on the bar
    const bt = new K.T.Shape(), P = [[-0.1, 0.018], [-0.032, 0.018], [-0.032, 0.032], [0.032, 0.032], [0.032, 0.018], [0.1, 0.018], [0.086, -0.018], [0.032, -0.018], [0.032, -0.032], [-0.032, -0.032], [-0.032, -0.018], [-0.086, -0.018]];
    P.forEach(([x, y], i) => (i ? bt.lineTo(x, y) : bt.moveTo(x, y))); bt.closePath();
    K.put(o.police ? 'Trim' : 'Chrome', new K.T.ExtrudeGeometry(bt, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), [0, 0.883, 2.42]);
    if (!o.police) { const gi = new K.T.ShapeGeometry(bt); gi.scale(0.8, 0.62, 1); K.put('Gold', gi, [0, 0.883, 2.4362]); }
  }
'''+s[b:]
open('v-tahoma04.js','w').write(s)
