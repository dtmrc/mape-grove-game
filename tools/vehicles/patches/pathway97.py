s=open('v-pathway97.js').read()
s=s.replace("roof: [4, 19], inset: 0.03, crown: 0.03 });","roof: [4, 19], inset: 0.03, crown: 0.03, sideKey: 'Paint' });",1)
a=s.index("  K.ghSide(gh, 'Paint', 0.57"); b=s.index("  // nose")
s=s[:a]+'''  // side glass traced off the blueprint (z, y): black frames, black sail at the mirror, black B and C pillars, body-colour D pillar
  const fd = [[0.76, 1.125], [0.76, 1.31], [0.47, 1.61], [0.4, 1.64], [-0.06, 1.645], [-0.08, 1.125]];
  const rd = [[-0.19, 1.65], [-0.86, 1.65], [-0.91, 1.6], [-0.92, 1.19], [-0.88, 1.145], [-0.19, 1.145]];
  const qg = [[-1.04, 1.64], [-1.8, 1.64], [-2.08, 1.17], [-2.05, 1.145], [-1.12, 1.145], [-1.09, 1.19]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Trim', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Trim', [[0.93, 1.12], [0.9, 1.2], [0.76, 1.33], [0.74, 1.12]], 0.014);                       // mirror sail
  K.ghPolyY(gh, 'Trim', [[-0.06, 1.665], [-0.2, 1.665], [-0.19, 1.12], [-0.08, 1.12]], 0.014);                 // B pillar
  K.ghPolyY(gh, 'Trim', [[-0.9, 1.665], [-1.05, 1.665], [-1.11, 1.135], [-0.92, 1.13]], 0.014);                // C pillar
  K.ghTop(gh, 'Paint', 0.4, 1.0, 0.92, 1.0); K.ghTop(gh, 'Paint', -2.24, -2.16, 0.9, 1.0);
  for (const s of [-1, 1]) { K.rod('Trim', [s * 0.56, 1.725, 0.0], [s * 0.56, 1.725, -1.75], 0.02, 5); for (const z of [-0.4, -1.63]) K.box('Trim', s * 0.56, 1.745, z, 0.05, 0.07, 0.14); }
'''+s[b:]
s=s.replace("arches: [{ z: zf, r: r + 0.07, cy: r }, { z: zr, r: r + 0.07, cy: r }]","arches: [{ z: zf, r: r + 0.11, cy: r }, { z: zr, r: r + 0.11, cy: r }]")
s=s.replace("y0: (u) => 0.765 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.955","y0: (u) => 0.75 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.975")
s=s.replace("K.wrap(Bd, 'Head', { x0: 0.37, x1: 0.66, y0: 0.79, y1: 0.935","K.wrap(Bd, 'Head', { x0: 0.37, x1: 0.66, y0: 0.775, y1: 0.95")
s=s.replace("y0: (u) => 0.79 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.935","y0: (u) => 0.775 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 0.95")
s=s.replace("K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.44, y1: 0.71","K.wrap(Bd, 'Clad', { x0: 0, zb: 2.05, y0: 0.42, y1: 0.71")
s=s.replace("K.wrap(Bd, 'Tail', { end: -1, x0: 0.7, zb: -2.25, y0: 0.86, y1: 1.06, n1: 2, n2: 2 });","K.wrap(Bd, 'Tail', { end: -1, x0: 0.7, zb: -2.2, y0: 0.79, y1: 1.08, n1: 2, n2: 2 });")
s=s.replace("  K.wrap(Bd, 'Amber', { end: -1, x0: 0.7, zb: -2.25, y0: 1.0, y1: 1.06, off: 0.016, n1: 2, n2: 2, rows: 1 });\n","")
s=s.replace("K.wrap(Bd, 'Clear', { end: -1, x0: 0.7, zb: -2.25, y0: 0.86, y1: 0.9","K.wrap(Bd, 'Clear', { end: -1, x0: 0.7, zb: -2.2, y0: 0.86, y1: 0.9")
s=s.replace("K.skin(Bd, 'Stripe', { z0: -2.25, z1: 2.1, y0: 0.52, y1: 0.6","K.skin(Bd, 'Stripe', { z0: -2.2, z1: 2.05, y0: 0.67, y1: 0.71")
s=s.replace("K.handles(Bd, [0.6, -0.5], 1.02","K.handles(Bd, [0.13, -0.85], 1.02")
s=s.replace("K.mirrors(0.86, 1.2, 0.75","K.mirrors(0.74, 1.25, 0.75")
s=s.replace("seams: [1.14, -0.37, -1.32, -2.3], hood: 1.12, belt: 1.08","seams: [0.98, -0.07, -1.0, -2.24], hood: 1.0, belt: 1.11")
s=s.replace("// v4 from reference photos","// Run 2 (2026-11-25): outline, glass, pillars, arches and lamps measured off the side blueprint in model metres.\n// v4 from reference photos")
open('v-pathway97.js','w').write(s)
s=open('v-pathway97.js').read()
s=s.replace("K.wrap(Bd, 'Head', { x0: 0.37, x1: 0.66,","K.wrap(Bd, 'Head', { x0: 0.37, x1: 0.72,").replace("K.wrap(Bd, 'Amber', { x0: 0.66, zb: 2.24,","K.wrap(Bd, 'Amber', { x0: 0.72, zb: 2.22,")
s=s.replace("clad: '#70757a'","clad: '#55595d'")
open('v-pathway97.js','w').write(s)
s=open('v-pathway97.js').read()
s=s.replace("[1.0, 1.2], [1.05, 1.249]","[1.0, 1.18], [1.05, 1.188]")
s=s.replace("K.rod('Trim', [0.8, 1.08, 1.5], [0.8, 1.85, 1.42], 0.006, 4);","K.rod('Trim', [0.8, 1.22, 1.1], [0.8, 1.93, 0.9], 0.006, 4);")
s=s.replace("zb: -2.05, y0: 0.46, y1: 0.66","zb: -2.05, y0: 0.52, y1: 0.68")
open('v-pathway97.js','w').write(s)
s=open('v-pathway97.js').read()
s=s.replace("half: [[-2.395, 0.8], [-2.33, 0.87], [-2.0, 0.888], [1.9, 0.888], [2.2, 0.86], [2.395, 0.74]]","half: [[-2.36, 0.8], [-2.296, 0.87], [-1.97, 0.888], [1.87, 0.888], [2.165, 0.86], [2.343, 0.74]]")
open('v-pathway97.js','w').write(s)
