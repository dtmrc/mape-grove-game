// Idempotently wires src/js/fishing.js (fishing survival loop: Earl's Bait & Tackle shop, dock fishing, shore firepit
// cooking, belly meter, raccoon skinning + coonskin cap) into src/js/game.js, which the gameplay thread owns.
// Run it on a fresh copy before each build:   node tools/fishing-hooks.mjs src/js/game.js
import fs from 'fs';
const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8'); const before = s;
const ins = (anchor, add, where = 'after', marker = add.trim()) => {
  if (s.includes(marker)) return;
  if (!s.includes(anchor)) { console.error('anchor missing:', anchor); process.exit(1); }
  s = s.replace(anchor, where === 'after' ? anchor + add : where === 'before' ? add + anchor : add);
};
ins("import { Sfx } from './sfx.js';", "\nimport { makeFishing } from './fishing.js';");
ins('// ---------------- minimap ----------------', "const fishing = makeFishing({ scene, G, P, cat, places, peds, spawnPed, say, toast, banner, objective, addCash, setCheck, clearCheck: () => { checkMark.visible = false; G.check = null; }, hit, down, isTouch, puff, Sfx, T, mission: () => mission, knockedOut, $ });\n\n", 'before', 'const fishing = makeFishing(');
ins('    events.update(dt);', '\n    fishing.update(dt);');
ins('  const len = Math.hypot(mx, mz);', '  if (fishing.hold(dt)) return; // fishing: planted while casting, reeling, skinning, eating or in a menu\n', 'before', 'if (fishing.hold(dt)) return;');
ins('    if (npc && !mission) talkTo(npc);', '    if (fishing.interact()) { /* shop, cast, cook, skin */ } else if (npc && !mission) talkTo(npc);', 'replace', 'if (fishing.interact())');
ins('  if (G.dialog) {\n    if (hit(', "  if (!G.dialog && fishing.menuOpen()) { fishing.menuInput(); dt = 0; }\n", 'before', 'fishing.menuOpen()');
ins("const prompt = !P.car && !G.dialog && !G.paused ? (nearNpc() && !mission ? 'E: Talk' : nearestCar() ? 'E: Get in' : '') : '';", "const prompt = !P.car && !G.dialog && !G.paused ? (fishing.prompt() || (nearNpc() && !mission ? 'E: Talk' : nearestCar() ? 'E: Get in' : '')) : '';", 'replace', 'fishing.prompt() ||');
ins("setText(hud.usebtn, P.car ? 'EXIT' : prompt ? (prompt.includes('Talk') ? 'TALK' : 'GET IN') : 'USE');", "setText(hud.usebtn, P.car ? 'EXIT' : prompt ? (prompt.includes('Talk') ? 'TALK' : prompt.includes('Get in') ? 'GET IN' : prompt.replace(/^E[:!]? ?/, '').split(' ')[0].toUpperCase().slice(0, 6)) : 'USE');", 'replace', "prompt.includes('Get in') ? 'GET IN'");
ins("toast('Tuna can! +35 health'); }", "toast('Tuna can! +35 health'); fishing.feed(20); }", 'replace', 'fishing.feed(20)');
if (!/window\.__G = \{[^}]*\bfishing,/.test(s)) ins('window.__G = { G, P,', ' fishing,');
if (s !== before) fs.writeFileSync(f, s);
console.log(s !== before ? 'hooked' : 'already hooked');
