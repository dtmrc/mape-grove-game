// Idempotently wires src/js/pdstation.js (police station interior: lobby/offices/bullpen + upstairs holding) into
// src/js/game.js. Run with the other hooks before each build:   node tools/pdstation-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
let dir = process.argv[2] || 'src/js';
if (dir.endsWith('.js')) dir = path.dirname(dir);
const f = path.join(dir, 'game.js');
if (!fs.existsSync(path.join(dir, 'pdstation.js'))) { console.log('pdstation-hooks: pdstation.js missing; skipped'); process.exit(0); }
let s = fs.readFileSync(f, 'utf8'); const before = s;
const HOOKS = [
  [['window.__G.shops = shops;'], "PDST.init({ G, P, places, toast, Sfx, scene, save }); // police station interior\n", 'before', 'PDST.init('],
];
// the import goes after the LAST import line, so every other module keeps its evaluation order
if (!s.includes("from './pdstation.js'")) {
  const ls = s.split('\n'); let last = -1;
  for (let i = 0; i < ls.length && i < 200; i++) if (/^import /.test(ls[i])) last = i;
  if (last < 0) { console.error('pdstation-hooks: no import lines in game.js'); process.exit(1); }
  ls.splice(last + 1, 0, "import * as PDST from './pdstation.js'; // police station interior"); s = ls.join('\n');
}
let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : add + a);
}
if (missing) { console.error(`pdstation-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (pdstation)'); } else console.log('pdstation: already hooked');
