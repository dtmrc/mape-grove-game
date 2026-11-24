// Idempotently wires src/js/jailbreak.js (the jail cell / frog breakout quest, owned by the jailbreak thread) into
// src/js/game.js. Run it on a fresh copy before each build:   node tools/jailbreak-hooks.mjs src/js/game.js
import fs from 'fs';
const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8'); const before = s;
const ins = (anchor, add, after = true, marker = add.trim()) => {
  if (s.includes(marker)) return; // already present (order may differ after other hooks)
  if (!s.includes(anchor)) { console.error('jailbreak-hooks: anchor missing:', anchor); process.exit(1); }
  s = s.replace(anchor, after ? anchor + add : add + anchor);
};
const rep = (anchor, add, marker) => { if (s.includes(marker)) return; if (!s.includes(anchor)) { console.error('jailbreak-hooks: anchor missing:', anchor); process.exit(1); } s = s.replace(anchor, add); };

ins("import { Sfx } from './sfx.js';", "\nimport { makeJail } from './jailbreak.js';");
// construct after the player, HUD and dialog exist (before the minimap section, like fx/events)
ins('// ---------------- minimap ----------------', "const jail = makeJail({ scene, camera, G, P, cat, T, say, toast, banner, objective, addCash, respawn, keys, touch, pressed, cam: () => [camYaw, camPitch], save }); // jailbreak quest\n\n", false, 'const jail = makeJail(');
// per frame, right after the player moved (we re-clamp the player against the cell block)
ins('    updatePlayer(dt);', '\n    jail.update(dt);');
// HUD prompt / touch USE label while in the cell block (appended after the game's own prompt line, which other hooks anchor on)
ins("  setText(hud.prompt, prompt); setStyle(hud.prompt, 'display', prompt ? 'block' : 'none');",
  "\n  if (jail.active() && !G.dialog && !G.paused) { const jp = jail.prompt(); setText(hud.prompt, jp); setStyle(hud.prompt, 'display', jp ? 'block' : 'none'); } // jailbreak", true, 'const jp = jail.prompt()');
ins("  setText(hud.actbtn, P.car ? 'BRAKE' : 'PAW');", "\n  if (jail.active() && jail.prompt()) setText(hud.usebtn, jail.btn()); // jailbreak", true, 'jail.btn()');
// a serious HOA citation (3+ stars) means a trip to the station until the police thread's own arrest flow calls __JAIL.start
ins('function busted() {\n  const fine = Math.min(G.cash, 100);', "\n  if (G.heat >= 3 && window.__JAIL && !window.__JAIL.active()) return window.__JAIL.start({ from: 'hoa', fine }); // jailbreak", true, 'window.__JAIL.start({ from: \'hoa\'');
// debug handle
if (!/window\.__G = \{[^}]*\bjail,/.test(s)) ins('window.__G = { G, P,', ' jail,');
if (s !== before) fs.writeFileSync(f, s);
console.log(s !== before ? 'hooked' : 'already hooked');
