// Idempotently wires src/js/events.js (world events, owned by the events thread) into src/js/game.js.
// Run it on a fresh copy before each build:   node tools/events-hooks.mjs src/js/game.js
import fs from 'fs';
const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8'); const before = s;
const ins = (anchor, add, after = true) => {
  const want = after ? anchor + add : add + anchor;
  if (s.includes(want) || s.includes(add.trim())) return; // already present (order may differ after other hooks)
  if (!s.includes(anchor)) { console.error('anchor missing:', anchor); process.exit(1); }
  s = s.replace(anchor, want);
};
ins("import { Sfx } from './sfx.js';", "\nimport { makeEvents } from './events.js';");
ins('// ---------------- minimap ----------------', 'const events = makeEvents({ scene, camera, G, pos: () => ({ x: px(), z: pz() }), onFoot: () => !P.car });\n\n', false);
ins('    updateParts(dt);', '\n    events.update(dt);');
ins('window.__G = { G, P,', ' events,');
if (s !== before) fs.writeFileSync(f, s);
console.log(s !== before ? 'hooked' : 'already hooked');
