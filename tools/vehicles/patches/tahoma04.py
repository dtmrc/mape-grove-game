s=open('v-tahoma04.js').read()
s=s.replace("[-2.35, 0.685], [-2.3, 1.196]","[-2.35, 0.685], [-2.31, 0.7], [-2.3, 1.196]")
import re
s=re.sub(r"\[2\.3, 1\.09\][^a-z]*?\]\],", "[2.3, 1.09], [2.345, 1.03], [2.365, 0.9], [2.37, 0.76], [2.44, 0.74], [2.448, 0.5]],", s, 1)
s=s.replace("roof: [4, 21], inset: 0.03, crown: 0.03 });","roof: [4, 21], inset: 0.03, crown: 0.03, sideKey: 'Paint' });",1)
a=s.index("  K.ghSide(gh, 'Paint', 0.6, 1.0"); b=s.index("  // nose")
s=s[:a]+'''  // side glass traced off the blueprint (z, y): black frames, black sail at the mirror, black B and C pillars, slatted black D pillar trim
  const fd = [[0.73, 1.245], [0.73, 1.43], [0.52, 1.66], [0.4, 1.72], [-0.03, 1.74], [-0.07, 1.71], [-0.07, 1.27], [-0.04, 1.245]];
  const rd = [[-0.23, 1.735], [-0.7, 1.74], [-0.84, 1.71], [-0.89, 1.65], [-1.0, 1.3], [-0.98, 1.275], [-0.25, 1.265]];
  const qg = [[-1.04, 1.76], [-1.84, 1.765], [-1.88, 1.74], [-2.11, 1.315], [-2.08, 1.3], [-1.3, 1.3], [-1.24, 1.33]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Trim', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Trim', [[0.95, 1.24], [0.92, 1.29], [0.73, 1.45], [0.71, 1.24]], 0.014);                                   // mirror sail
  K.ghPolyY(gh, 'Trim', [[-0.06, 1.765], [-0.22, 1.765], [-0.24, 1.25], [-0.06, 1.25]], 0.014);                             // B pillar
  K.ghPolyY(gh, 'Trim', [[-0.86, 1.775], [-1.05, 1.775], [-1.26, 1.33], [-1.31, 1.28], [-0.98, 1.27], [-1.01, 1.3]], 0.014);   // C pillar
  K.ghPolyY(gh, 'Trim', [[-1.92, 1.73], [-2.02, 1.73], [-2.2, 1.36], [-2.12, 1.36]], 0.014);                               // D pillar slats
  K.ghTop(gh, 'Paint', 0.45, 1.17, 0.9, 1.0); K.ghTop(gh, 'Paint', -2.28, -2.2, 0.9, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.66, 1.865, -0.18], [s * 0.66, 1.865, -1.82], 0.022, 5); for (const z of [-0.2, -1.0, -1.8]) K.box('Trim', s * 0.66, 1.845, z, 0.04, 0.05, 0.1); }
'''+s[b:]
s=s.replace("arches: [{ z: zf, r: r + 0.075, cy: r }, { z: zr, r: r + 0.075, cy: r }]","arches: [{ z: zf, r: r + 0.14, cy: r }, { z: zr, r: r + 0.14, cy: r }]")
s=s.replace("K.wrap(Bd, 'Tail', { end: -1, x0: 0.83, zb: -2.42, y0: 0.9, y1: 1.26,","K.wrap(Bd, 'Tail', { end: -1, x0: 0.83, zb: -2.3, y0: 0.81, y1: 1.15,")
s=s.replace("K.wrap(Bd, 'Amber', { end: -1, x0: 0.83, zb: -2.42, y0: 1.17, y1: 1.26,","K.wrap(Bd, 'Amber', { end: -1, x0: 0.83, zb: -2.3, y0: 1.08, y1: 1.15,")
s=s.replace("K.wrap(Bd, 'Clear', { end: -1, x0: 0.83, zb: -2.42, y0: 0.9, y1: 0.96,","K.wrap(Bd, 'Clear', { end: -1, x0: 0.83, zb: -2.3, y0: 0.81, y1: 0.87,")
s=s.replace("K.box('Trim', 0, 0.735, -2.49, 1.3, 0.02, 0.07);","K.box('Trim', 0, 0.73, -2.405, 1.3, 0.02, 0.07);")
s=s.replace("y0: 0.66, y1: 0.76, off: 0.016","y0: 0.68, y1: 0.77, off: 0.016")
s=s.replace("K.handles(Bd, [0.62, -0.55], 1.16,","K.handles(Bd, [0.04, -0.9], 1.085,")
s=s.replace("K.mirrors(0.97, 1.36, 0.80,","K.mirrors(0.81, 1.31, 0.80,")
s=s.replace("seams: [1.2, -0.36, -1.37, -2.4], hood: 1.2, belt: 1.24","seams: [1.04, -0.14, -1.0, -2.28], hood: 1.03, belt: 1.24")
s=s.replace("// v4 from reference photos","// Run 2 (2026-11-25): outline, glass, pillars, arches and lamps measured off a 2006 Tahoe side blueprint (refs side-bp-b.jpg).\n// v4 from reference photos")
open('v-tahoma04.js','w').write(s)
p=open('v-tahomappv04.js').read()
p=p.replace("K.spotlight(-0.99, 1.38, 1.12);","K.spotlight(-0.99, 1.38, 0.95);")
p=p.replace("seams: [1.2, -0.45, -1.43, -2.45], hood: 1.25","seams: [1.04, -0.14, -1.0, -2.28], hood: 1.03")
open('v-tahomappv04.js','w').write(p)
s=open('v-tahoma04.js').read()
for a,b in [("y0: 0.86, y1: 1.13, off: 0.008","y0: 0.75, y1: 1.03, off: 0.008"),("y0: 1.01, y1: 1.115","y0: 0.91, y1: 1.015"),("y0: 0.875, y1: 0.955","y0: 0.765, y1: 0.855"),
 ("y0: 0.962, y1: 1.003","y0: 0.862, y1: 0.903"),("y0: 1.008, y1: (u) => 1.13 -","y0: 0.908, y1: (u) => 1.03 -"),("y0: (u) => 0.865 + (u > 1 ? (u - 1) * 0.03 : 0), y1: 0.957","y0: (u) => 0.765 + (u > 1 ? (u - 1) * 0.03 : 0), y1: 0.857"),
 ("y0: 0.925, y1: 0.957","y0: 0.825, y1: 0.857"),("0, 0.983, K.faceAt(Bd, 0.983)","0, 0.883, K.faceAt(Bd, 0.883)"),("zb: 2.1, y0: 0.6, y1: 0.83","zb: 2.1, y0: 0.58, y1: 0.75"),
 ("zb: 2.1, y0: 0.47, y1: 0.6,","zb: 2.1, y0: 0.39, y1: 0.58,"),("K.plate(0, 0.72, K.faceAt(Bd, 0.72)","K.plate(0, 0.665, K.faceAt(Bd, 0.665)"),("zb: -2.15, y0: 0.5, y1: 0.73","zb: -2.15, y0: 0.55, y1: 0.73")]:
    assert a in s, a; s=s.replace(a,b)
open('v-tahoma04.js','w').write(s)
s=open('v-tahoma04.js').read()
s=s.replace("end: -1, x0: 0.83, zb: -2.3,","end: -1, x0: 0.72, zb: -2.17,")
open('v-tahoma04.js','w').write(s)
s=open('v-tahoma04.js').read()
s=s.replace("half: [[-2.525, 0.9], [-2.45, 0.975], [-2.1, 1.0], [2.0, 1.0], [2.35, 0.975], [2.525, 0.88]]","half: [[-2.446, 0.9], [-2.373, 0.975], [-2.034, 1.0], [1.937, 1.0], [2.276, 0.975], [2.448, 0.88]]")
open('v-tahoma04.js','w').write(s)
