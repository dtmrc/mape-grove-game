// Idempotently wires src/js/interiors.js (enterable buildings, owned by the interiors thread) into src/js/game.js.
// Run it after the fx / events / engine hooks, before each build:   node tools/interiors-hooks.mjs src/js
// Every hook is a small string insertion next to a stable anchor; a hook whose marker is already present is skipped.
import fs from 'fs';
import path from 'path';
const dir = process.argv[2] || 'src/js';
const f = path.join(dir, 'game.js');
// interiors.js loads rooms.js (rooms thread); hooking before both exist would break the build, so wait for them
for (const need of ['interiors.js', 'rooms.js']) {
  if (!fs.existsSync(path.join(dir, need))) { console.log(`interiors-hooks: ${need} not in ${dir} yet; game.js left unhooked`); process.exit(0); }
}
let s = fs.readFileSync(f, 'utf8'); const before = s;

// [anchors (first one found wins), text, where: after|before|replace, marker]
const HOOKS = [
  [["import { Sfx } from './sfx.js';"], "\nimport { makeInteriors } from './interiors.js';", 'after', "import { makeInteriors } from './interiors.js';"],
  // create the system once everything it needs exists (end of module; frame() only runs after module evaluation)
  [['window.__G = {'],
    "// interiors: enterable buildings (src/js/interiors.js)\nconst INT = makeInteriors({ scene, camera, camPos, G, P, cat, pool, hemi, sun, moon, post, WM, T, places, NPC, giverMarks, nearNpc, mission: () => mission, collide, exitCar, toast, save, Sfx, isTouch, mm, mg, getDev: () => dev, setCam: (y, p) => { camYaw = y; if (p !== undefined) camPitch = p; camIdle = 0; } });\n",
    'before', 'const INT = makeInteriors('],
  // E / USE on foot: doors, hotspots and the exit come before NPC talk and car entry (inside: always consumed)
  [['  // interact\n'],
    "  if (hit('e', 'f', 'enter') && !(P.lock > 0) && INT.use()) { pressed.delete('e'); pressed.delete('f'); pressed.delete('enter'); } // interiors\n",
    'before', 'INT.use()'],
  // indoor collisions replace the world's
  [['const q = collide(P.x, P.z, 0.22, P.y'], 'const q = (INT.inside ? INT.collide : collide)(P.x, P.z, 0.22, P.y', 'replace', '(INT.inside ? INT.collide : collide)(P.x, P.z'],
  [['    updatePlayer(dt);'], '\n    INT.update(dt);', 'after', 'INT.update(dt);'],
  // indoor lights + environment override (after the day/night + weather have set theirs)
  [['    fx.update(dt, nightK, G.time);', '    updateLights(dt);'], '\n    INT.env(dt);', 'after', 'INT.env(dt);'],
  // camera: room distance, wall pull-in against the room, clamp inside the room
  [['  if (window.__camDist) dist = window.__camDist;'], '  if (INT.inside) dist = INT.camDist(dist); // interiors\n', 'before', 'INT.camDist(dist)'],
  [['if (blocked(tx + _d.x * f, ty + _d.y * f, tz + _d.z * f))'], 'if ((INT.inside ? INT.blocked : blocked)(tx + _d.x * f, ty + _d.y * f, tz + _d.z * f))', 'replace', 'INT.inside ? INT.blocked : blocked'],
  [['  want.y = Math.max(0.3, want.y);'], '\n  if (INT.inside) INT.clampCam(want);', 'after', 'INT.clampCam(want)'],
  // no waypoint arrow indoors; the "district" is the room
  // waypoints (mission + your own map marker) hide indoors; updateWaypoint builds this flag itself since 2026-11-08
  [['function updateWaypoint() {'], "\n  const hide = INT.inside || G.paused || G.dialog || dev.editing; // interiors", 'after', "INT.inside || G.paused"],
  [['const d = districtAt(px(), pz());'], 'const d = INT.inside ? INT.name : districtAt(px(), pz());', 'replace', 'INT.inside ? INT.name : districtAt('],
  // fade / door markers / prompt; the minimap shows the room plan instead
  [['  drawMinimap();\n  pressed.clear();'], '  INT.hud(dt);\n  if (!INT.inside) ', 'before', 'INT.hud(dt);'],
];

let missing = 0;
for (const [anchors, add, where, marker] of HOOKS) {
  if (s.includes(marker)) continue;
  const a = anchors.find((x) => s.includes(x));
  if (!a) { console.error(`game.js: anchor missing: ${JSON.stringify(anchors[0])}`); missing++; continue; }
  s = s.replace(a, where === 'after' ? a + add : where === 'before' ? add + a : add);
}
if (missing) { console.error(`interiors-hooks: ${missing} anchor(s) missing; game.js left unchanged`); process.exit(1); }
if (s !== before) { fs.writeFileSync(f, s); console.log('game.js: hooked (interiors)'); }
else console.log('already hooked');
