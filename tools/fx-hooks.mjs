// Idempotently wires src/js/fx.js (environment: day/night sky, moon phases, HUD clock, time debug menu,
// weather) into src/js/game.js, which the gameplay thread owns. Run it on a fresh copy before each build:
//   node tools/fx-hooks.mjs src/js/game.js
import fs from 'fs';
const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8'); const before = s;
const ins = (anchor, add, after = true) => {
  const want = after ? anchor + add : add + anchor;
  if (s.includes(want) || (add.trim().length > 8 && s.includes(add.trim()))) return; // already present (order may differ after other hooks)
  if (!s.includes(anchor)) { console.error('anchor missing:', anchor); process.exit(1); }
  s = s.replace(anchor, want);
};
ins("import { Sfx } from './sfx.js';", "\nimport { makeFX } from './fx.js';");
ins('// ---------------- minimap ----------------', "const fx = makeFX({ scene, camera, sky, hemi, sun, moon, M: WM, lights, T, G, renderHeight: () => RES[resIdx] });\n\n", false);
ins('    updateLights(dt);', '\n    fx.update(dt, nightK, G.time);');
ins('\nupdateSky(0);', '\nfx.update(0, nightK, 0);');
if (!/window\.__G = \{[^}]*\bfx,/.test(s)) ins('window.__G = { G, P,', ' fx,');
if (s !== before) fs.writeFileSync(f, s);
console.log(s !== before ? 'hooked' : 'already hooked');
