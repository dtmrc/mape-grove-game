// Idempotently wires src/js/carphys.js (GTA IV style driving: tyre model, weight transfer, gearbox, suspension,
// skid marks, tyre screech) into src/js/game.js and adds Sfx.skid to src/js/sfx.js. Driving thread owns carphys.js.
//   node tools/carphys-hooks.mjs src/js
import fs from 'fs';
import path from 'path';
const dir = process.argv[2] || 'src/js';
function patch(file, fn) {
  const f = path.join(dir, file); let s = fs.readFileSync(f, 'utf8'); const before = s;
  const ins = (anchor, add, after = true) => {
    if (s.includes(add.trim())) return;
    if (!s.includes(anchor)) { console.error(file + ': anchor missing:', anchor); process.exitCode = 1; return; }
    s = s.replace(anchor, after ? anchor + add : add + anchor);
  };
  const rep = (from, to) => {
    if (s.includes(to)) return;
    if (!s.includes(from)) { console.error(file + ': anchor missing:', from); process.exitCode = 1; return; }
    s = s.replace(from, to);
  };
  fn(ins, rep);
  if (s !== before) fs.writeFileSync(f, s);
  console.log(file + ': ' + (s !== before ? 'hooked' : 'already hooked'));
}
patch('game.js', (ins, rep) => {
  ins("import { makePolice } from './police.js'; // police", "\nimport { makeCarPhys } from './carphys.js'; // driving");
  ins("import { makeCarPhys } from './carphys.js'; // driving", "\nimport { EDGES as CP_EDGES } from './world.js'; // driving");
  ins('const cars = [];', '\nconst CP = makeCarPhys({ scene, puff, heightAt: TER.heightAt, nearestRoad: RD.nearestRoad, edges: () => CP_EDGES, nodes: NODES, Sfx }); // driving: GTA IV style handling (carphys.js)');
  rep("    drive(c, thr, st, down(' ', 'b'), dt);", "    CP.drive(c, thr, st, down(' ', 'b'), dt); // driving");
  ins('P.car = c; cat.visible = false;', ' CP.enter(c);');
  ins('c.driver = null; P.car = null; cat.visible = true;', ' CP.exit(c);');
  rep('    u.body.rotation.z = -c.steer * Math.min(1, Math.abs(c.speed) / 20) * 0.06;', '    CP.body(c, u, dt); // driving: suspension pitch / roll / heave + spin-outs');
  rep('      const want = c.yaw + (c.speed < -2 ? 0 : Math.PI);', '      const want = CP.camHeading(c) + (c.speed < -2 ? 0 : Math.PI); // driving: camera swings with the slide');
  rep('Sfx.engine(P.car && !P.car.dead ? Math.abs(P.car.speed) / P.car.spec.top : -1,', 'Sfx.engine(P.car && !P.car.dead ? CP.rev(P.car) : -1,');
  ins('A.vx -= j / ma * nx; A.vz -= j / ma * nz; B.vx += j / mb * nx; B.vz += j / mb * nz;', ' CP.spin(A, ax + nx * ra, az + nz * ra, -j / ma * nx, -j / ma * nz); CP.spin(B, bx - nx * rb, bz - nz * rb, j / mb * nx, j / mb * nz); // driving: off-centre hits spin cars');
  ins("import { makeCarPhys } from './carphys.js'; // driving", "\nimport { makeTraffic } from './traffic.js'; // driving: stop signs + traffic lights");
  ins('const cars = [];', '\nconst TC = makeTraffic({ scene, NODES, ADJ, cars, heightAt: TER.heightAt, G, isPath: RD.isPath, onRoads: RD.onRoads }); // driving: traffic control (traffic.js)');
  ins("  else if (blk) { want = 0; if (blk === 'player') { c.honk += dt; if (c.honk > 1.5) { c.honk = -3; Sfx.horn(c.x, c.z); } } }", "\n  want = TC.limit(c, a, want, dt); // driving: stop signs + red lights");
  rep("  if (blk === 'car' && c.wait > 3 + (c.x * 7 + c.z * 13) % 2) want = 3;", "  if (blk === 'car' && c.wait > 3 + (c.x * 7 + c.z * 13) % 2 && !TC.queued(c, a)) want = 3; // driving: no creeping into a red-light queue");
  ins('    updateCars(dt);', '\n    TC.update(dt); // driving: signal lamps');
  ins('      c.vx *= 0.85; c.vz *= 0.85;', ' if (c.yr) c.yr *= 0.6; // driving');
});
patch('sfx.js', (ins) => {
  ins('  isOn() { return on; },', `
  // driving: looping tyre screech, level 0..1 (carphys.js)
  skid(level) {
    if (!ctx) return;
    if (!sk) {
      if (level < 0.05) return;
      const n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      sk = { s: ctx.createBufferSource(), f: ctx.createBiquadFilter(), g: ctx.createGain() };
      sk.s.buffer = b; sk.s.loop = true; sk.f.type = 'bandpass'; sk.f.frequency.value = 1700; sk.f.Q.value = 4; sk.g.gain.value = 0;
      sk.s.connect(sk.f); sk.f.connect(sk.g); sk.g.connect(master); sk.s.start();
    }
    const t = ctx.currentTime;
    sk.g.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.11, t, 0.05);
    sk.f.frequency.setTargetAtTime(1400 + level * 700 + Math.sin(t * 23) * 120, t, 0.05);
  },`);
  ins('let eng = null, sir = null;', ' let sk = null; // driving');
});
