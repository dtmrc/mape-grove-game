// Idempotently wires src/js/firestarter.js (house fires: gather a fire kit, burn a building, VFD truck) into
// src/js/game.js. Indoor E / prompt / light hooks go through interiors.js extension points (addUse, addPrompt, 'env').
// Run it with the other hooks before each build:   node tools/firestarter-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
const arg = process.argv[2] || 'src/js';
const f = arg.endsWith('.js') ? arg : path.join(arg, 'game.js');
let s = fs.readFileSync(f, 'utf8'); const before = s;
// [anchors (first found wins), text, where, marker]
const HOOKS = [
  [["import { Sfx } from './sfx.js';"], "\nimport { makeFirestarter } from './firestarter.js';", 'after', "import { makeFirestarter } from './firestarter.js';"],
  [['window.__G = {'], "// firestarter: house fires (src/js/firestarter.js)\nconst fires = makeFirestarter({ scene, G, P, cat, toast, banner, say, Sfx, puff, hurt, addCash, peds, places, isTouch, pool, lights, hemi, $, fishing: () => fishing });\n", 'before', 'const fires = makeFirestarter('],
  [['    events.update(dt);'], '\n    fires.update(dt);', 'after', 'fires.update(dt);'],
  [['if (fishing.interact())', 'if (npc && !mission) talkTo(npc);'], 'if (fires.interact()) { /* firestarter: pick up kit, condemned door */ } else ', 'before', 'if (fires.interact())'],
  [['const prompt = !P.car && !G.dialog && !G.paused ? ('], 'fires.prompt() || ', 'after', 'fires.prompt() ||'],
];
let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : where === 'before' ? add + a : add);
}
if (missing) { console.error(`firestarter-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (!/window\.__G = \{[^}]*\bfires,/.test(s)) s = s.replace('window.__G = { G, P,', 'window.__G = { G, P, fires,');
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (firestarter)'); } else console.log('already hooked');
