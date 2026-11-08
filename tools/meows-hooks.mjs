// Idempotently wires src/js/meows.js (Goobles meows on jumps, step-ups and swimming) into src/js/game.js.
// Run it with the other hooks before each build:   node tools/meows-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
const arg = process.argv[2] || 'src/js';
const f = arg.endsWith('.js') ? arg : path.join(arg, 'game.js');
let s = fs.readFileSync(f, 'utf8'); const before = s;
const HOOKS = [
  [["import { Sfx } from './sfx.js';"], "\nimport { makeMeows } from './meows.js';", 'after', "import { makeMeows } from './meows.js';"],
  [['window.__G = {'], '// meows: Goobles voice (src/js/meows.js)\nconst meows = makeMeows({ P, G });\n', 'before', 'const meows = makeMeows('],
  [['    events.update(dt);'], '\n    meows.update(dt);', 'after', 'meows.update(dt);'],
];
let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : add + a);
}
if (missing) { console.error(`meows-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (meows)'); } else console.log('already hooked');
