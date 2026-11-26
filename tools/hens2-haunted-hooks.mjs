// Idempotently wires src/js/haunted.js (Ghost of John parts B and C: Unfinished Business, Ghost vs. the HOA) into src/js/game.js.
// Runs after hens-hooks.mjs (file name order): it anchors on the hens lines and takes the hens + cave apis.
//   node tools/hens2-haunted-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
const arg = process.argv[2] || 'src/js';
const f = arg.endsWith('.js') ? arg : path.join(arg, 'game.js');
let s = fs.readFileSync(f, 'utf8'); const before = s;
const HOOKS = [
  [["import { makeHens } from './hens.js';"], "\nimport { makeHaunted } from './haunted.js';", 'after', "import { makeHaunted } from './haunted.js';"],
  [['window.__G = {'], "// haunted: Ghost of John parts B and C (src/js/haunted.js)\nconst haunted = makeHaunted({ scene, G, P, cat, places, NPC, fishing, quests, cave, hens, say, toast, Sfx, addCash, addHeat, hit, isTouch });\n", 'before', 'const haunted = makeHaunted('],
  [['    hens.update(dt);'], '\n    haunted.update(dt);', 'after', 'haunted.update(dt);'],
  [['if (hens.interact())'], 'if (haunted.interact()) { /* haunted: note, fetch items, site, bulldozer */ } else ', 'before', 'if (haunted.interact())'],
  [['const prompt = !P.car && !G.dialog && !G.paused ? ('], 'haunted.prompt() || ', 'after', 'haunted.prompt() ||'],
];
let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : where === 'before' ? add + a : add);
}
if (missing) { console.error(`haunted-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (!/window\.__G = \{[^}]*\bhaunted,/.test(s)) s = s.replace('window.__G = { G, P,', 'window.__G = { G, P, haunted,');
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (haunted)'); } else console.log('already hooked');
