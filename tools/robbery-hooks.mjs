// Idempotently wires src/js/robbery.js (Donut Hole + Rosie's Diner hold-ups) into the game.
//   game.js:   import './robbery.js' (after the townsfolk import), and banner/toast on window.__G
//   police.js: police.arrest(officer, line) (BUSTED from a room, used when the PD storms a robbed store), and no
//              "LOST THEM" while the cat hides inside the store it just robbed (window.__ROB.hot)
// Run on a fresh copy before each build:   node tools/robbery-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
let dir = process.argv[2] || 'src/js'; if (dir.endsWith('.js')) dir = path.dirname(dir);
const edit = (file, fn) => { const f = path.join(dir, file); const s = fs.readFileSync(f, 'utf8'); const t = fn(s); if (t !== s) { fs.writeFileSync(f, t); console.log('hooked', file); } else console.log('already hooked', file); };
const need = (s, a, file) => { if (!s.includes(a)) { console.error(`anchor missing in ${file}:`, a); process.exit(1); } };

edit('game.js', (s) => {
  if (!s.includes("import './robbery.js'")) {
    const a = s.includes("import './townsfolk.js';") ? s.slice(s.indexOf("import './townsfolk.js';"), s.indexOf('\n', s.indexOf("import './townsfolk.js';"))) : "import { makeInteriors } from './interiors.js';";
    need(s, a, 'game.js');
    s = s.replace(a, a + "\nimport './robbery.js'; // robbery: hold up the Donut Hole + Rosie's Diner");
  }
  if (!s.includes('// robbery: banner')) {
    const a = 'window.__G.police = police; window.__G.cat = cat;';
    need(s, a, 'game.js');
    s = s.replace(a, a + '\nObject.assign(window.__G, { banner, toast, addCash }); // robbery: banner/toast/addCash for robbery.js');
  }
  return s;
});

edit('police.js', (s) => {
  if (!s.includes('arrest(o, line) {')) {
    const a = '    giveGun(ammo = 12) {';
    need(s, a, 'police.js');
    s = s.replace(a, "    arrest(o, line) { // robbery: BUSTED by an officer that robbery.js brought into a room\n"
      + "      if (bust || cuff || !o || !o.mesh) return false;\n"
      + "      catCuffs.visible = true; SND.tick(2000, 6, 0.05, 0.1);\n"
      + "      bust = { t: 3.2, o, fine: Math.min(G.cash, 40 + 30 * G.heat), hadGun: gun.has };\n"
      + "      gun.has = false; gun.ammo = 0; gun.equipped = false;\n"
      + "      A.banner('BUSTED!', `Officer ${o.name}: \"${line || 'You have the right to remain fluffy.'}\"`, 3.4, 'fail');\n"
      + "      return true;\n"
      + "    },\n" + a);
  }
  if (!s.includes('robbery: no hiding')) {
    const a = 'if (contact && hideT > (sawIn ? 9 : 4)) giveUp(';
    need(s, a, 'police.js');
    s = s.replace(a, "if (contact && hideT > (sawIn ? 9 : 4) && !(window.__ROB && window.__ROB.hot && I && window.__ROB.hot === I.current())) giveUp( /* robbery: no hiding in the store you robbed */ ");
  }
  return s;
});
