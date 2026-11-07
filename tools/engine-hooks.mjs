// Idempotently wires the engine core (src/js/terrain.js: terrain, movable groups, editable colliders) and the dev tools
// (src/js/devtools.js: overlays + world editor) into world.js (map thread) and game.js (gameplay thread).
// Run it on a fresh copy before each build:  node tools/engine-hooks.mjs src/js
// world.js also carries engine code written in place (not re-added here): initRoads() in buildWorld, polygon colliders,
// the lake's WATER_MAT and water polygon. roads.js / ground.js own road meshes, ground paint and water surfaces.
import fs from 'fs';
import path from 'path';
const dir = process.argv[2] || 'src/js';
let changed = false;
function hook(file, steps) {
  const f = path.join(dir, file); let s = fs.readFileSync(f, 'utf8'); const before = s;
  for (const [anchor, add, where = 'after', marker = add.trim()] of steps) {
    if (s.includes(marker)) continue;
    if (!s.includes(anchor)) { console.error(`${file}: anchor missing: ${anchor}`); process.exit(1); }
    s = s.replace(anchor, where === 'after' ? anchor + add : where === 'before' ? add + anchor : add);
  }
  if (s !== before) { fs.writeFileSync(f, s); changed = true; console.log(`${file}: hooked`); }
}

hook('world.js', [
  ["import { makeRV, makeCar } from './models.js';", "\nimport { prepareWorld, makeGroundMesh, patchMaterial, floors, setFloorProvider } from './terrain.js';"],
  ["import { makeRV, makeCar } from './models.js';", "\nimport { initRoads } from './roads.js';"],
  ["import { makeRV, makeCar } from './models.js';", "\nimport { initGround } from './ground.js';"],
  ['  (buckets[key] ||= []).push(g);', '  g.userData.o = [x, z]; // engine: geometry origin (terrain anchor)\n', 'before'],
  ['  // merge buckets\n', "  // engine: terrain anchors + movable groups, then the terrain ground mesh\n  const tctx = { colliders, EDGES, NODES, inLake, waterMat: WATER_MAT, rebuildGrid: () => { GRID = null; } };\n  prepareWorld(buckets, tctx);\n  if (tctx.ground) scene.add(makeGroundMesh(initGround(scene, M[tctx.ground.key], T, tctx)));\n", 'after', 'prepareWorld(buckets, tctx);'],
  ['    const mesh = new THREE.Mesh(g, M[k]);\n', '    patchMaterial(M[k]); mesh.userData.noLift = true; mesh.frustumCulled = false; // engine\n', 'after', 'patchMaterial(M[k]); mesh.userData.noLift'],
]);

// walkable decks (dock, gazebo, porches): the player stands on TER.floorAt instead of y = 0. Soft hooks: game.js changes
// often, so a missing anchor only warns.
function softHook(file, steps) {
  const f = path.join(dir, file); let s = fs.readFileSync(f, 'utf8'); const before = s;
  for (const [anchor, add, marker] of steps) {
    if (s.includes(marker)) continue;
    if (!s.includes(anchor)) { console.warn(`${file}: (soft) anchor missing, skipped: ${anchor}`); continue; }
    s = s.replace(anchor, add);
  }
  if (s !== before) { fs.writeFileSync(f, s); changed = true; console.log(`${file}: floors hooked`); }
}
softHook('game.js', [
  ['  P.x += P.vx * dt; P.z += P.vz * dt;\n', '  P.x += P.vx * dt; P.z += P.vz * dt;\n  P.fl = TER.floorAt(P.x, P.z, P.y); // engine: walkable decks\n', 'P.fl = TER.floorAt('],
  ['if (P.y <= 0.001) { P.vy = 4.6;', 'if (P.y <= (P.fl || 0) + 0.001) { P.vy = 4.6;', 'P.y <= (P.fl || 0) + 0.001'],
  ['P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0) {', 'P.y = Math.max(P.fl || 0, P.y + P.vy * dt); if (P.y === (P.fl || 0) && TER.floorHit && TER.floorHit.bounce) { P.vy = Math.min(16, Math.max(4.5, -P.vy * 0.92 + (down(\' \') ? 2.6 : 0))); P.jumps = 1; Sfx.blip(180 + P.vy * 20); } else if (P.y === (P.fl || 0)) { /* engine: decks + trampolines (hold Space to bounce higher) */', 'Math.max(P.fl || 0, P.y'],
  ['  if (P.y > 0) { cat.userData.legs[0]', '  if (P.y > (P.fl || 0) + 0.01) { cat.userData.legs[0]', 'P.y > (P.fl || 0) + 0.01'],
  // breakable lamp posts + hydrants (src/js/breakables.js)
  ["import { Sfx } from './sfx.js';", "import { Sfx } from './sfx.js';\nimport * as BRK from './breakables.js';", "from './breakables.js'"],
  ['    const q = collide(cx, cz, r, 0.5);', '    BRK.carHit(c, cx, cz, r); // engine: knock over lamps + hydrants\n    const q = collide(cx, cz, r, 0.5);', 'BRK.carHit('],
  ['window.__G = {', 'BRK.init({ scene, Sfx, toast, camera }); // engine: breakables\nwindow.__G = {', 'BRK.init('],
  ['  post.render(scene, camera, G.time);', '  BRK.update(dt);\n  post.render(scene, camera, G.time);', 'BRK.update('],
]);

hook('game.js', [
  ["import { Sfx } from './sfx.js';", "\nimport * as TER from './terrain.js';\nimport { makeDev } from './devtools.js';"],
  ["import { Sfx } from './sfx.js';", "\nimport * as RD from './roads.js';"],
  ['const NN = NODES.length;', 'let NN = NODES.length; RD.onRoads.push(() => { NN = NODES.length; }); // engine: roads are editable', 'replace', 'RD.onRoads.push(() => { NN = NODES.length; })'],
  ['  return fwd.length ? fwd : all;', '  return fwd.length ? fwd : all.length ? all : RD.roadRescue(i); // engine: roads can be deleted', 'replace', 'RD.roadRescue(i)'],
  ['drawMap(mapImg.getContext(\'2d\'), (v) => (v + MAP_HALF) * MK, MK);', '\nRD.onRoads.push(() => drawMap(mapImg.getContext(\'2d\'), (v) => (v + MAP_HALF) * MK, MK)); // engine: redraw after road edits', 'after', 'RD.onRoads.push(() => drawMap('],
  ['const WM = buildWorld(scene, T);', '\nTER.initWorld(scene, { lights, halos, flames }); // engine: link loose world objects to movable groups'],
  ['  updateCamera(Math.max(dt, 0.001));', '  if (!dev.camera(Math.max(dt, 0.001))) ', 'before', 'if (!dev.camera('],
  ['  post.render(scene, camera, G.time);', '  dev.frame(dt); TER.beforeRender(scene, camera, P.car ? P.car.x : P.x, P.car ? P.car.z : P.z); // engine: lift onto terrain\n', 'before', 'TER.beforeRender('],
  ['  post.render(scene, camera, G.time);', '\n  TER.afterRender(); dev.after();', 'after', 'TER.afterRender();'],
  ['window.__G = {', "// engine: terrain-aware sprites + dev tools / world editor\nsky.mesh.userData.noLift = true; TER.track(haloGroup.children); TER.link(flameSprites); TER.drapeMesh(pools);\nconst dev = makeDev({ scene, camera, canvas, renderer, G, P, cars, peds, pickups, WM, lights, haloSprites: haloGroup.children, pools, toast, marks: () => [...Object.values(giverMarks), saveMark, checkMark], setClock: (h) => { G.clock = h; updateSky(0); fx.update(0, nightK, G.time); } });\n", 'before', 'const dev = makeDev('],
]);
if (!changed) console.log('already hooked');
