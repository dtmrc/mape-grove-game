// Idempotently wires src/js/cave.js (the Hollow Deep easter egg: torch, tunnel, the ghost's dwelling) into src/js/game.js.
// Indoor prompt / E / light hooks go through interiors.js extension points. Run with the other hooks before each build:
//   node tools/cave-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
const arg = process.argv[2] || 'src/js';
const f = arg.endsWith('.js') ? arg : path.join(arg, 'game.js');
let s = fs.readFileSync(f, 'utf8'); const before = s;
const HOOKS = [
  [["import { Sfx } from './sfx.js';"], "\nimport { makeCave } from './cave.js';", 'after', "import { makeCave } from './cave.js';"],
  [['window.__G = {'], "// cave: the Hollow Deep easter egg (src/js/cave.js)\nconst cave = makeCave({ scene, G, P, cat, T, toast, say, Sfx, isTouch, pool, hemi, post, addCash, camera, down });\n", 'before', 'const cave = makeCave('],
  [['    fires.update(dt);', '    events.update(dt);'], '\n    cave.update(dt);', 'after', 'cave.update(dt);'],
  [['if (fires.interact())'], 'if (cave.interact()) { /* cave: torch, sign */ } else ', 'before', 'if (cave.interact())'],
  [['const prompt = !P.car && !G.dialog && !G.paused ? ('], 'cave.prompt() || ', 'after', 'cave.prompt() ||'],
];
let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : where === 'before' ? add + a : add);
}
if (missing) { console.error(`cave-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (!/window\.__G = \{[^}]*\bcave,/.test(s)) s = s.replace('window.__G = { G, P,', 'window.__G = { G, P, cave,');
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (cave)'); } else console.log('already hooked');
