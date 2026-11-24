// Headless check of carphys.js handling: node tools/sim/carsim.mjs
import { makeCarPhys } from '../../src/js/carphys.js';
import fs from 'fs';
const src = fs.readFileSync(new URL('../../src/js/models.js', import.meta.url), 'utf8');
const CAR_TYPES = eval('(' + src.match(/export const CAR_TYPES = (\{[\s\S]*?\n\});/)[1] + ')');
const scene = { add() {} };
const CP = makeCarPhys({ scene, puff: null, heightAt: () => 0, nearestRoad: () => ({ k: 0, d: 0 }), edges: () => [{ w: 10, t: 'paved' }], Sfx: {} });
const car = (type) => ({ type, spec: CAR_TYPES[type], x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, fuel: 100 });
const dt = 1 / 60, f1 = (x) => x.toFixed(1);
function run(c, secs, inp) { for (let t = 0; t < secs; t += dt) { const [th, st, hb] = inp(t, c); CP.drive(c, th, st, hb, dt); c.x += c.vx * dt; c.z += c.vz * dt; if (!isFinite(c.x)) throw new Error('NaN'); } }
for (const type of Object.keys(CAR_TYPES)) {
  const c = car(type); let t60 = null, tt = 0;
  run(c, 30, (t, c) => { if (t60 === null && c.speed >= 26.8 * Math.min(1, c.spec.top / 30)) t60 = t; return [1, 0, false]; });
  const top = c.speed;
  let bd = 0; const z0 = c.z; const v0 = c.speed; let tb = 0; run(c, 10, (t, c) => [c.speed > 0.3 ? -1 : 0, 0, false]); bd = c.z - z0;
  // steady circle at 15 m/s
  const d = car(type); d.vz = 15; d.speed = 15; let lat = 0;
  run(d, 6, (t, c) => [c.speed < 15 ? 0.6 : 0, 1, false]); const r = d.yr; lat = Math.abs(r * d.speed) / 9.81;
  // handbrake turn from 20 m/s
  const e = car(type); e.vz = 20; let spin = 0;
  run(e, 3, (t, c) => [0, t < 0.5 ? 0.6 : 0.6, t > 0.3]); spin = e.yaw;
  console.log(`${type.padEnd(9)} top ${f1(top)} m/s  0-60mph ${t60 ? f1(t60) + 's' : 'n/a'}  brake ${f1(v0)}->0 in ${f1(bd)} m  full-lock 15m/s ${lat.toFixed(2)} g  handbrake yaw ${f1(spin * 57.3)} deg, gear ${c.ph.gear}`);
}
// slalom stability: high speed lane change
const s = car('sedan'); s.vz = 28; let maxB = 0;
run(s, 4, (t, c) => { const st = t < 0.5 ? 1 : t < 1.0 ? -1 : 0; const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); maxB = Math.max(maxB, Math.abs(Math.atan2(c.vx * fz - c.vz * fx, c.vx * fx + c.vz * fz))); return [0.5, st, false]; });
console.log('lane change 28 m/s: max slip', f1(maxB * 57.3), 'deg, final yaw rate', s.yr.toFixed(3));
// power oversteer in RWD at 8 m/s full throttle + full lock
const p = car('pickup'); p.vz = 8; let mb = 0; run(p, 3, (t, c) => { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); mb = Math.max(mb, Math.abs(Math.atan2(c.vx * fz - c.vz * fx, c.vx * fx + c.vz * fz))); return [1, 1, false]; });
console.log('pickup power-on full lock from 8 m/s: max slip', f1(mb * 57.3), 'deg');
// parking: low speed full lock
const q = car('sedan'); run(q, 6, () => [0.25, 1, false]); console.log('parking full lock: speed', f1(q.speed), 'yaw', f1(q.yaw * 57.3));
// full lock at highway speed, throttle held: should push wide (understeer), not spin
for (const sp of [20, 27]) { const h = car('sedan'); h.vz = sp; let mx = 0; run(h, 3, (t, c) => { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); mx = Math.max(mx, Math.abs(Math.atan2(c.vx * fz - c.vz * fx, c.vx * fx + c.vz * fz))); return [1, 1, false]; }); console.log(`full lock + throttle at ${sp} m/s: max slip ${f1(mx * 57.3)} deg, speed after 3 s ${f1(h.speed)}`); }
// turning circle (radius) at full lock, holding speed
for (const sp of [6, 12, 20]) { const h = car('sedan'); h.vz = sp; run(h, 4, (t, c) => [c.speed < sp ? 0.7 : 0, 1, false]); console.log(`turn radius at ${sp} m/s: ${f1(Math.abs(h.speed / (h.yr || 1e-6)))} m`); }
