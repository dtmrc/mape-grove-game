s=open('v-pathwaypiu23.js').read()
import re
s=re.sub(r', ywarp: \{.*?\} \}','',s)
s=s.replace("crown: 0.03 });","crown: 0.03, sideKey: 'Paint' });",1)
a=s.index("  K.ghSide(gh, 'Trim', 0.45, 1.05"); b=s.index("  K.roofLip(")
s=s[:a]+'''  // side glass traced off the blueprint (z, y): black frames, black B and C pillars, quarter glass, black D pillar under the spoiler
  const fd = [[0.885, 1.165], [0.6, 1.37], [0.32, 1.53], [0.05, 1.62], [-0.12, 1.628], [-0.08, 1.212]];
  const rd = [[-0.3, 1.625], [-0.89, 1.613], [-1.16, 1.32], [-1.1, 1.248], [-0.3, 1.212]];
  const qg = [[-1.0, 1.622], [-1.89, 1.612], [-2.13, 1.292], [-1.62, 1.286], [-1.25, 1.4]];
  for (const w of [fd, rd, qg]) { K.ghPolyY(gh, 'Trim', K.grow(w, 0.014), 0.012); K.ghPolyY(gh, 'Glass', w, 0.016); }
  K.ghPolyY(gh, 'Gloss', [[-0.12, 1.632], [-0.3, 1.63], [-0.3, 1.208], [-0.08, 1.208]], 0.014);                  // B pillar
  K.ghPolyY(gh, 'Gloss', [[-0.89, 1.62], [-1.0, 1.626], [-1.25, 1.4], [-1.32, 1.26], [-1.1, 1.246], [-1.16, 1.32]], 0.014);   // C pillar
  K.ghPolyY(gh, 'Gloss', [[-1.75, 1.64], [-2.3, 1.64], [-2.35, 1.29], [-2.13, 1.288], [-1.75, 1.29]], 0.018);     // black D pillar
  K.ghTop(gh, 'Paint', 0.2, 1.02, 0.92, 1.0);
'''+s[b:]
s=s.replace("K.roofLip(gh, { z: -2.0, key: 'Paint', light: false });","K.roofLip(gh, { z: -2.12, len: 0.14, key: 'Paint', light: false });")
s=s.replace("K.box('LightRed', 0, gh(-1.94).yr + gh.cr - 0.052, -2.282, 0.46, 0.02, 0.012);","K.box('LightRed', 0, gh(-2.1).yr + gh.cr - 0.04, -2.27, 0.46, 0.02, 0.012);")
open('v-pathwaypiu23.js','w').write(s)
