// Re-adds the police thread's hooks to game.js and world.js (idempotent). Usage: node tools/police-hooks.mjs src/js
// Police code lives in src/js/police.js + src/js/officer.js; this only wires it in.
import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || 'src/js';
let fail = 0;
function patch(file, edits) {
  const p = path.join(dir, file);
  let s = fs.readFileSync(p, 'utf8');
  for (const [name, mark, find, repl] of edits) {
    if (s.includes(mark)) continue;
    if (!s.includes(find)) { console.error(`police-hooks: anchor for "${name}" not found in ${file}`); fail++; continue; }
    s = s.replace(find, repl);
  }
  fs.writeFileSync(p, s);
}

const STATION = `// ---------- Maple Grove PD station (police thread, re-added by tools/police-hooks.mjs) ----------
function buildPoliceStation() {
  // south side of Main St between Old Mill Rd and Nana's; front door faces north onto Main St
  const cx = -68, cz = 24, F = frame(cx, cz, Math.PI);
  F.flat(0, 2, 26, 26, 'asphalt', 0xd8d8d8, 0.04, '#6a6a70');
  F.geo(plane(1.8, 6, 1, 1, 0.4, 1.2), 'sidewalk', 0xd8d4cc, 0, 0.06, 4.6);
  for (const x of [-10.5, -7.5, -4.5, 4.5, 7.5, 10.5]) F.box(x, 0.06, 9.5, 0.12, 0.02, 4.2, 'plain', 0xf0f0f0);
  // main block: two storeys of tan brick, navy cornice, wings
  F.box(0, 3, -4, 16, 6, 9, 'brick', 0xe8dcc8); F.bld(0, -4, 16, 9, 6.5);
  F.box(0, 6.2, -4, 16.6, 0.4, 9.6, 'plain', 0x1e2a44);
  F.box(0, 0.4, -4, 16.3, 0.8, 9.3, 'plain', 0x8a8478);
  for (const s of [-1, 1]) { F.box(s * 10.5, 2, -5, 5, 4, 7, 'brick', 0xd8ccb8); F.bld(s * 10.5, -5, 5, 7, 4.4); F.box(s * 10.5, 4.15, -5, 5.4, 0.3, 7.4, 'plain', 0x1e2a44); }
  // portico: steps, columns, canopy
  F.box(0, 0.12, 1.6, 6.4, 0.24, 2.8, 'plain', 0xc8c4bc); F.box(0, 0.3, 1.2, 5.6, 0.2, 2, 'plain', 0xd0ccc4); F.floor(0, 1.6, 6.4, 2.8, 0.24); F.floor(0, 1.2, 5.6, 2, 0.4); // engine: walk up the steps
  for (const x of [-2.6, 2.6]) { F.box(x, 2.1, 2.6, 0.4, 3.8, 0.4, 'plain', 0xf4f2ec); F.post(x, 2.6, 0.25, 4); }
  F.box(0, 4.1, 1.7, 6.6, 0.35, 3.2, 'plain', 0xf0ece4);
  F.face(0, 1.35, 0.53, 2.2, 2.5, 'door', 0x3a5a8a);
  for (const x of [-6, -3.8, 3.8, 6]) F.face(x, 1.9, 0.53, 1.5, 1.4, 'window', 0xffffff);
  for (const x of [-6, -3.8, 0, 3.8, 6]) F.face(x, 4.5, 0.53, 1.5, 1.3, 'window', 0xffffff);
  for (const s of [-1, 1]) for (const x of [-1.2, 1.2]) F.face(s * 10.5 + x, 1.9, -1.47, 1.2, 1.2, 'window', 0xffffff);
  F.sign('MAPLE GROVE POLICE', '#1e2a44', '#f4f0d8', 9, 0.9, 5.45, 0.56, { tw: 512, th: 52 });
  F.sign('PD', '#1e2a44', '#e0b440', 1.4, 0.7, 3.65, 3.33, { tw: 64, th: 32 });
  for (const x of [-1.6, 1.6]) { F.box(x, 2.9, 0.75, 0.3, 0.42, 0.3, 'lamp', 0x5070ff); F.halo(x, 2.9, 0.9, 1.6, 0x4060ff); }
  F.light(0, 3.2, 3, 0x7090ff, 1.1, { always: true });
  // flagpole, the reserved space, a donut-shaped bench joke and a holding-yard fence out back
  F.box(9, 4, 4, 0.1, 8, 0.1, 'plain', 0xdddddd); F.box(9.8, 7.4, 4, 1.6, 1, 0.04, 'plain', 0x2f5d2f); F.post(9, 4, 0.12, 8);
  F.box(-12, 0.6, 7.5, 0.08, 1.2, 0.08, 'metal', 0x888888); F.sign('RESERVED: SGT. DONUTS', '#ffffff', '#1e2a44', 1.4, 0.35, 1.3, 7.55, { tw: 256, th: 40, lx: -12 });
  for (const s of [-1, 1]) { F.box(s * 12.8, 1, -11, 0.08, 2, 6, 'fence', 0xbfc4c8); F.col(s * 12.8, -11, 0.2, 6, 2); }
  F.box(0, 1, -13.9, 25.6, 2, 0.08, 'fence', 0xbfc4c8); F.col(0, -13.9, 25.6, 0.2, 2);
  F.box(7, 0.7, -11, 2, 1.4, 1.2, 'plain', 0x2d6a3a); F.col(7, -11, 2, 1.2, 1.4);
  F.light(-6, 4.5, 8, 0xfff0d0, 0.8); F.box(-6, 2.3, 9.5, 0.12, 4.6, 0.12, 'metal', 0x777777); F.post(-6, 9.5, 0.12, 4.6); F.box(-6, 4.6, 9, 0.3, 0.12, 1, 'lamp', 0xffffff); F.halo(-6, 4.5, 8.6, 2.4, 0xfff0c8);
  const [dx, dz] = F.at(0, 3.4), [cx2, cz2] = F.at(-10.5, -5);
  const yaw = Math.PI; // facing north (-z)
  places.station = {
    x: cx, z: cz, yaw, name: 'Maple Grove PD',
    door: { x: dx, z: dz, yaw },
    cell: { x: cx2, z: cz2 },
    parking: [[-9, 9.5], [9, 9.5]].map(([lx, lz]) => { const [x, z] = F.at(lx, lz); return { x, z, yaw: 0 }; }),
  };
}

`;

patch('world.js', [
  ['station fn', 'function buildPoliceStation()', '// ---------- church + cemetery ----------', STATION + '// ---------- church + cemetery ----------'],
  ['station call', 'buildPoliceStation(); // police', '  buildDowntown(scene, T);', '  buildDowntown(scene, T);\n  buildPoliceStation(); // police'],
]);

patch('game.js', [
  ['import', "from './police.js'", "import { makeFX } from './fx.js';", "import { makeFX } from './fx.js';\nimport { makePolice } from './police.js'; // police"],
  ['car AI', 'police.carAI(c, dt)', "    else if (c.driver === 'flee') fleeAI(c, dt);", "    else if (c.driver === 'flee') fleeAI(c, dt);\n    else if (c.driver === 'police') police.carAI(c, dt); // police"],
  ['hold player', 'police.holdPlayer(dt)', '  P.invuln -= dt; P.lock -= dt;', '  P.invuln -= dt; P.lock -= dt;\n  if (police.holdPlayer(dt)) return; // police'],
  ['gun fire', 'police.gunInput(', "  if (hit('punch', 'j', 'k') && P.punch <= 0) {", "  if (police.armed()) police.gunInput(hit('punch', 'j', 'k')); else if (hit('punch', 'j', 'k') && P.punch <= 0) {"],
  ['paw cops', 'police.paw(fx, fz)', '      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);\n      for (const p of peds) {', '      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);\n      police.paw(fx, fz); // police\n      for (const p of peds) {'],
  ['paw peds', 'police.pawPed(p, fx, fz)', "if (knock(p, fx, fz, 4)) { Sfx.punch(); if (p.kind === 'human') addHeat(1, 'assault with a paw'); }", 'police.pawPed(p, fx, fz); // police: HP + fight back'],
  ['run over', 'police.runOver(', 'if (knock(p, c.vx + (p.x - cx), c.vz + (p.z - cz), sp * 0.6)) {', 'if (police.runOver(p, c, cx, cz, sp)) { // police: tumble'],
  ['ped hook', 'police.pedHook(p, dt)', '  const u = p.mesh.userData;\n', '  const u = p.mesh.userData;\n  if (police.pedHook(p, dt)) return; // police\n'],
  ['respawn clear', 'police.clear()', '  for (const c of patrols()) removeCar(c);\n', '  for (const c of patrols()) removeCar(c);\n  police.clear(); // police\n'],
  ['minimap', 'police.blips()', "  for (const c of patrols()) blip(c.x, c.z, Math.floor(G.time * 4) % 2 ? '#ff8a00' : '#3060ff', 3.5);", "  for (const c of patrols()) blip(c.x, c.z, Math.floor(G.time * 4) % 2 ? '#ff8a00' : '#3060ff', 3.5);\n  for (const b of police.blips()) blip(b.x, b.z, b.c, b.r); // police"],
  ['siren', 'sirenNear(cru)', 'Math.min(...patrols().map((c) =>', 'Math.min(...[...patrols(), ...police.cruisers()].map((c) =>'],
  ['siren on', '(G.heat > 0 || cru.length) ?', 'Sfx.engine(P.car && !P.car.dead ? Math.abs(P.car.speed) / P.car.spec.top : -1, G.heat > 0 ?', 'Sfx.engine(P.car && !P.car.dead ? Math.abs(P.car.speed) / P.car.spec.top : -1, (G.heat > 0 || police.cruisers().length) ?'],
  ['hoa sight', 'if (d < 25) G.seenT = 0; // police: easier to slip away', '  if (d < 40) G.seenT = 0;\n}', '  if (d < 25) G.seenT = 0; // police: easier to slip away\n}'],
  ['update', 'police.update(dt)', '    events.update(dt);', '    events.update(dt);\n    police.update(dt); // police'],
]);

// construct last, after every function and const it closes over exists
{
  const p = path.join(dir, 'game.js');
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('const police = makePolice(')) {
    s = s.replace(/\s*$/, '\n') + `// police: Maple Grove PD, officers on foot, civilians who fight back (src/js/police.js, tools/police-hooks.mjs)
const police = makePolice({ scene, G, P, cat, cars, peds, places, T, spawnCar, removeCar, damageCar, hurt, addHeat, addCash, toast, banner, respawn, puff, shake, Sfx, collide, blocked, roadOpts, navTarget, chaseAI, drive, exitCar, knock, attachPed, carCircles, hit, down, isTouch, camYaw: () => camYaw, px, pz, time: () => G.time });
window.__G.police = police;
`;
    fs.writeFileSync(p, s);
  }
}
if (fail) { console.error(`police-hooks: ${fail} hook(s) failed`); process.exit(1); }
console.log('police-hooks: ok');
