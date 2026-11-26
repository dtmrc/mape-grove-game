// Idempotently wires src/js/hens.js (The Missing Hens: the RV coop, clues, the battle with the Ghost of John) into src/js/game.js.
// Needs cave.js hooked first (it hands the cave api over); files run in name order, cave before hens.
//   node tools/hens-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
const arg = process.argv[2] || 'src/js';
const f = arg.endsWith('.js') ? arg : path.join(arg, 'game.js');
let s = fs.readFileSync(f, 'utf8'); const before = s;
const HOOKS = [
  [["import { makeCave } from './cave.js';"], "\nimport { makeHens } from './hens.js';", 'after', "import { makeHens } from './hens.js';"],
  [['window.__G = {'], "// hens: The Missing Hens, part A of the Ghost of John quest (src/js/hens.js)\nconst hens = makeHens({ scene, G, P, cat, places, NPC, fishing, quests, cave, say, toast, Sfx, addCash, isTouch });\n", 'before', 'const hens = makeHens('],
  [['    cave.update(dt);'], '\n    hens.update(dt);', 'after', 'hens.update(dt);'],
  [['if (cave.interact())'], 'if (hens.interact()) { /* hens: clues, coop, bucket */ } else ', 'before', 'if (hens.interact())'],
  [['const prompt = !P.car && !G.dialog && !G.paused ? ('], 'hens.prompt() || ', 'after', 'hens.prompt() ||'],
];
let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : where === 'before' ? add + a : add);
}
if (missing) { console.error(`hens-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (!/window\.__G = \{[^}]*\bhens,/.test(s)) s = s.replace('window.__G = { G, P,', 'window.__G = { G, P, hens,');
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (hens)'); } else console.log('already hooked');
