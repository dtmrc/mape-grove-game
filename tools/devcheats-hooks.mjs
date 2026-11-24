// Exposes a few game.js internals on window.__G for the dev build's cheats panel (src/js/devcheats.js).
// Idempotent: run on a fresh src copy before building. Usage: node tools/devcheats-hooks.mjs src/js/game.js
import fs from 'fs';
const f = process.argv[2] || 'src/js/game.js';
let s = fs.readFileSync(f, 'utf8');
const MARK = '// devcheats: dev-build handles';
if (s.includes(MARK)) { console.log('devcheats hook already present'); process.exit(0); }
const anchor = 'window.__G.ui = ui; window.__G.gamepad = gamepad;';
if (!s.includes(anchor)) { console.warn('devcheats: anchor missing, hook skipped'); process.exit(0); }
s = s.replace(anchor, `${anchor}\nObject.assign(window.__G, { spawnCar, removeCar, districtAt, hurt, addCash, px, pz }); ${MARK}`);
fs.writeFileSync(f, s);
console.log('devcheats hook added');
