import re
s=open('v-blazonppv23.js').read()
s=re.sub(r', ywarp: \{.*?\} \}','',s)
s=s.replace("crown: 0.03, key: 'Gloss' });","crown: 0.03, key: 'Gloss', sideKey: 'Paint' });",1)
a=s.index("  K.ghSide(gh, 'Gloss', 0.3, 0.9"); b=s.index("  // nose")
s=s[:a]+'''  // side glass traced off the blueprint (z, y): black frames and pillars, small quarter glass, black upper rear pillar (floating roof)
  const fd = [[1.12, 1.06], [0.69, 1.29], [0.3, 1.465], [0.0, 1.48], [-0.11, 1.475], [-0.11, 1.1], [0.6, 1.1]];
  const rd = [[-0.25, 1.468], [-0.77, 1.44], [-0.875, 1.34], [-0.89, 1.2], [-0.84, 1.12], [-0.25, 1.1]];
  const qg = [[-0.98, 1.415], [-1.42, 1.3], [-1.14, 1.25]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Gloss', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[-0.11, 1.48], [-0.25, 1.475], [-0.25, 1.098], [-0.11, 1.098]], 0.014);                   // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.8, 1.47], [-1.82, 1.53], [-2.25, 1.1], [-1.94, 1.18], [-1.61, 1.34], [-1.42, 1.3], [-0.9, 1.12]], 0.013);    // black C/D pillars
  K.ghTop(gh, 'Gloss', 0.15, 1.27, 0.92, 1.0);
  { // spoiler lip past the top of the rear glass, brake light
    const g1 = gh(-1.72), yR = g1.yr + gh.cr, lip = [[-1.66, yR - 0.004], [-1.86, yR - 0.035], [-1.88, yR - 0.075], [-1.76, yR - 0.09], [-1.66, yR - 0.06]];
    K.sideExtrude('Gloss', lip, 0.4, -0.4, 0.02);
    K.box('LightRed', 0, yR - 0.05, -1.878, 0.46, 0.02, 0.012);
  }
'''+s[b:]
# slim upper lamp at the hood edge, main lamps low in the bumper
s=s.replace("y0: (u) => 0.855 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.925 + (u > 1 ? (u - 1) * 0.03 : 0), off: 0.011, n1: 6, n2: 2, rows: 1 });",
            "y0: (u) => 0.83 + (u > 1 ? (u - 1) * 0.06 : 0), y1: (u) => 0.885 + (u > 1 ? (u - 1) * 0.03 : 0), off: 0.011, n1: 6, n2: 2, rows: 1 });")
s=s.replace("y0: (u) => 0.885 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.91 + (u > 1 ? (u - 1) * 0.04 : 0), off: 0.016,",
            "y0: (u) => 0.845 + (u > 1 ? (u - 1) * 0.05 : 0), y1: (u) => 0.87 + (u > 1 ? (u - 1) * 0.04 : 0), off: 0.016,")
s=s.replace("K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.42, y1: 0.86,","K.wrap(Bd, 'Gloss', { x0: 0, x1: 0.6, y0: 0.42, y1: 0.82,")
s=s.replace("y0: (u) => 1.02 + Math.min(u, 1) * 0.03 + (u > 1 ? (u - 1) * 0.03 : 0), y1: (u) => 1.1 + Math.min(u, 1) * 0.03 - (u > 1 ? (u - 1) * 0.01 : 0), n1: 5, n2: 3 });",
            "y0: (u) => 0.98 + Math.min(u, 1) * 0.0 + (u > 1 ? (u - 1) * 0.08 : 0), y1: (u) => 1.07 + (u > 1 ? (u - 1) * 0.01 : 0), n1: 5, n2: 3 });")
s=s.replace("K.wrap(Bd, 'Tail', { end: -1, x0: 0.34, zb: -2.16,","K.wrap(Bd, 'Tail', { end: -1, x0: 0.34, zb: -1.75,")
open('v-blazonppv23.js','w').write(s)
