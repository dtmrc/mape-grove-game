import re
s=open('v-escalon24.js').read()
s=re.sub(r', ywarp: \{.*?\} \}','',s)
s=s.replace("half: [[-2.69, 0.74], [-2.63, 0.9], [-2.48, 0.99], [-2.1, 1.03], [2.1, 1.03], [2.45, 0.995], [2.62, 0.91], [2.69, 0.74]]",
 "half: [[-2.727, 0.74], [-2.667, 0.9], [-2.517, 0.99], [-2.137, 1.03], [2.013, 1.03], [2.363, 0.995], [2.533, 0.91], [2.603, 0.74]]")
s=s.replace("r: r + 0.07, cy: r, sq: 0.92 }, { z: zr, r: r + 0.07,","r: r + 0.12, cy: r, sq: 0.92 }, { z: zr, r: r + 0.12,")
s=re.sub(r"(roof: \[\d+, \d+\], inset: 0.03, crown: 0.03) \}\);", r"\1, sideKey: 'Paint' });", s, 1)
a=s.index("  K.ghSide(gh, 'Trim', 0.6, 1.1"); b=s.index("  for (const s of [-1, 1]) K.rod(")
s=s[:a]+'''  // side glass traced off diet's 2021 side photo (z, y): bright chrome surround, black B/C/D pillars (floating roof), black sail at the mirror
  const fd = [[0.87, 1.36], [0.87, 1.58], [0.5, 1.81], [0.42, 1.845], [0.06, 1.85], [0.06, 1.37]];
  const rd = [[-0.04, 1.85], [-0.92, 1.85], [-1.05, 1.41], [-0.04, 1.385]];
  const qg = [[-1.17, 1.85], [-2.15, 1.85], [-2.39, 1.44], [-1.2, 1.43]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Chrome', K.grow(w, 0.018), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[1.17, 1.43], [1.1, 1.5], [0.87, 1.6], [0.87, 1.35]], 0.014);                          // mirror sail
  K.ghPolyY(gh, 'Gloss', [[0.06, 1.87], [-0.04, 1.87], [-0.04, 1.38], [0.06, 1.37]], 0.014);                     // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.76, 1.85], [-0.785, 1.85], [-0.785, 1.4], [-0.76, 1.4]], 0.02);                     // rear door glass divider
  K.ghPolyY(gh, 'Gloss', [[-0.92, 1.87], [-1.17, 1.87], [-1.2, 1.43], [-1.05, 1.41]], 0.014);                    // C pillar
  K.ghPolyY(gh, 'Gloss', [[-2.15, 1.87], [-2.37, 1.87], [-2.58, 1.43], [-2.39, 1.43]], 0.014);                   // D pillar
  K.ghTop(gh, 'Paint', 0.3, 1.22, 0.92, 1.0);
'''+s[b:]
for a_,b_ in [("K.roofLip(gh, { z: -2.37, len: 0.24, key: 'Paint' });","K.roofLip(gh, { z: -2.25, len: 0.12, key: 'Paint' });"),
 ("const gy = 1.025,","const gy = 0.86,"),
 ("K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.45, y0: 1.1, y1: 1.2,","K.wrap(Bd, 'Gloss', { x0: 0.64, zb: 2.25, y0: 1.03, y1: 1.16,"),
 ("K.wrap(Bd, 'Head', { x0: 0.67, zb: 2.5, y0: 1.13, y1: 1.18,","K.wrap(Bd, 'Head', { x0: 0.67, zb: 2.3, y0: 1.06, y1: 1.13,"),
 ("x1: 0.9, y0: 0.5, y1: 0.98,","x1: 0.9, y0: 0.45, y1: 0.93,"),("x1: 0.86, y0: 0.54, y1: 0.94,","x1: 0.86, y0: 0.49, y1: 0.89,"),
 ("K.plate(0, 0.6, K.faceAt(Bd, 0.6) + 0.016, true);","K.plate(0, 0.52, K.faceAt(Bd, 0.52) + 0.016, true);\n  K.bodyPolyY(Bd, 'Amber', [[2.23, 0.82], [2.17, 0.82], [2.17, 0.75], [2.23, 0.75]], 0.012);"),
 ("  K.ghSide(gh, 'Tail', -2.63, -2.56, 0, 0.92, 0.022);\n","  K.bodyPolyY(Bd, 'Tail', [[-2.5, 1.42], [-2.575, 1.42], [-2.6, 0.95], [-2.53, 0.95]], 0.014);\n"),
 ("K.wrap(Bd, 'Tail', { end: -1, x0: 0.86, zb: -2.6, y0: 0.8, y1: 1.3,","K.wrap(Bd, 'Tail', { end: -1, x0: 0.86, zb: -2.5, y0: 0.95, y1: 1.4,"),
 ("K.skin(Bd, 'Chrome', { z0: -1.0, z1: 1.3, y0: 0.6, y1: 0.63,","K.skin(Bd, 'Chrome', { z0: -1.0, z1: 1.3, y0: 0.5, y1: 0.52,"),
 ("K.handles(Bd, [0.62, -0.6], 1.22,","K.handles(Bd, [0.2, -0.9], 1.21,"),("K.mirrors(1.0, 1.39, 0.90,","K.mirrors(0.98, 1.42, 0.90,"),
 ("seams: [1.26, -0.36, -1.45, -2.6], hood: 1.22, belt: 1.26, sill: 0.5","seams: [1.21, 0.02, -1.18, -2.6], hood: 1.22, belt: 1.4, sill: 0.5"),
 ("// v4 from reference photos","// Run 2 (2026-11-25): outline, glass, pillars, arches and lamps measured off diet's 2021 side photo (refs side-photo.png),\n// scaled by true height and length (the photo puts the wheels 8 cm further apart than the real 3.07 m).\n// v4 from reference photos")]:
    assert a_ in s, a_; s=s.replace(a_,b_)
open('v-escalon24.js','w').write(s)
s=open('v-escalon24.js').read(); s=s.replace("body: '#15161a'","body: '#3a3b40'"); open('v-escalon24.js','w').write(s)
