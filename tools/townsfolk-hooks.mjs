// Idempotently wires src/js/townsfolk.js (church parishioners + diner staff/patrons) into src/js/game.js.
// The module wraps ROOMS.church / ROOMS.diner build() on its own, so the import is the only hook.
// Run it on a fresh copy before each build:   node tools/townsfolk-hooks.mjs src/js/game.js
import fs from 'fs';
const f = process.argv[2] || 'src/js/game.js'; let s = fs.readFileSync(f, 'utf8');
const add = "import './townsfolk.js'; // townsfolk: church parishioners, diner staff + patrons";
if (s.includes("import './townsfolk.js'")) { console.log('already hooked'); process.exit(0); }
const anchor = "import { makeInteriors } from './interiors.js';";
if (!s.includes(anchor)) { console.error('anchor missing:', anchor); process.exit(1); }
s = s.replace(anchor, anchor + '\n' + add);
fs.writeFileSync(f, s); console.log('hooked');
