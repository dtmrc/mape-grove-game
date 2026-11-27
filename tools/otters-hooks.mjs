// Idempotently wires src/js/otters.js (ambient river otters on every water body) into src/js/game.js.
// Run it with the other hooks before each build:   node tools/otters-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
const arg = process.argv[2] || 'src/js';
const f = arg.endsWith('.js') ? arg : path.join(arg, 'game.js');
let s = fs.readFileSync(f, 'utf8'); const before = s;
const HOOKS = [
  [["import { Sfx } from './sfx.js';"], "\nimport { makeOtters } from './otters.js';", 'after', "import { makeOtters } from './otters.js';"],
  [['window.__G = {'], '// otters: ambient wildlife on the water (src/js/otters.js)\nconst otters = makeOtters({ scene, G, P, T, Sfx, blocked, places, camera, px: () => px(), pz: () => pz(), inside: () => INT.inside || jail.active() });\n', 'before', 'const otters = makeOtters('],
  [['    events.update(dt);'], '\n    otters.update(dt);', 'after', 'otters.update(dt);'],
];
let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : add + a);
}
if (missing) { console.error(`otters-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (!/window\.__G = \{[^}]*\botters,/.test(s)) s = s.replace('window.__G = { G, P,', 'window.__G = { G, P, otters,');
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (otters)'); } else console.log('already hooked');
