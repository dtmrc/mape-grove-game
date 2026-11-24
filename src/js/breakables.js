// Engine: props a car can knock over. Street lamps snap at the base and topple (their light goes out); fire hydrants
// pop off and a water geyser sprays for a while. The standing prop is a movable world group (terrain.js); breaking
// it sets group.broken, which hides its static geometry, collider, light and halo without touching saved edits.
// A loose copy then does the falling. Everything is restored after a while, once the camera is far enough away.
import * as THREE from 'three';
import * as TER from './terrain.js';
import { breakablesNear } from './world.js';

let ctx = null;
const live = [];                 // { G, kind, mesh, t, ... }
const RESTORE_AFTER = 120, RESTORE_DIST = 70;
const matPole = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 });
const matBase = new THREE.MeshLambertMaterial({ color: 0x8a8a86 });
const matRed = new THREE.MeshLambertMaterial({ color: 0xd8302a });
const matWater = new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false });
// P18: shared geometries (one set for every lamp / hydrant that ever breaks)
const gPole = new THREE.CylinderGeometry(0.07, 0.11, 6, 8), gArm = new THREE.BoxGeometry(0.09, 0.09, 2), gHead = new THREE.BoxGeometry(0.42, 0.14, 0.7), gStump = new THREE.CylinderGeometry(0.32, 0.38, 0.5, 8);
const gHyd = new THREE.CylinderGeometry(0.16, 0.2, 0.65, 8), gCap = new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), gStub = new THREE.CylinderGeometry(0.12, 0.14, 0.15, 8);

/** Call once after the scene exists. o = { scene, Sfx, toast, camera } */
export function init(o) { ctx = o; window.__BRK = { live, carHit, near: breakablesNear }; }

function lampMesh() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(gPole, matPole); pole.position.y = 3; g.add(pole);
  const arm = new THREE.Mesh(gArm, matPole); arm.position.set(0, 6, 0.5); g.add(arm);
  const head = new THREE.Mesh(gHead, matPole); head.position.set(0, 5.95, 1); g.add(head);
  return g;
}
function hydrantMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(gHyd, matRed); g.add(body);
  const cap = new THREE.Mesh(gCap, matRed); cap.position.y = 0.32; g.add(cap);
  return g;
}
function geyser() {
  const N = 90, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), age = new Float32Array(N);
  for (let i = 0; i < N; i++) age[i] = Math.random() * 1.4;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, matWater); pts.frustumCulled = false;
  return { pts, pos, vel, age, N };
}

/** Called for each car body circle before it collides with the world. */
export function carHit(car, cx, cz, r) {
  if (!ctx) return;
  const sp = Math.hypot(car.vx, car.vz); if (sp < 3.5) return;
  for (const c of breakablesNear(cx, cz, r)) {
    const m = c._m, gi = m ? m.grp : TER.groupAt(c.cx, c.cz, false), G = gi && TER.groups[gi]; if (!G || G.broken || G.hide) continue;
    smash(G, gi, m ? m.orig : c, c, car.vx / sp, car.vz / sp, sp);
    car.vx *= 0.82; car.vz *= 0.82;
  }
}

function smash(G, gi, orig, c, dx, dz, sp) {
  TER.setBroken(gi, true); // P18: only this group's texture entry, light and collider change
  const e = { G, gi, kind: orig.brk, t: 0, x: c.cx, z: c.cz };
  if (orig.brk === 'lamp') {
    // pivot at the base, tip over away from the car, the arm keeps its original heading
    const pivot = new THREE.Group(); pivot.position.set(c.cx, 0, c.cz);
    const tilt = new THREE.Group(); tilt.rotation.order = 'YXZ'; pivot.add(tilt);
    const body = lampMesh(); body.rotation.y = orig.ry || 0; tilt.add(body);
    tilt.rotation.y = Math.atan2(dx, dz);            // tilt axis faces the travel direction
    body.rotation.y -= tilt.rotation.y;
    e.mesh = pivot; e.tilt = tilt; e.ang = 0; e.av = 0.4 + sp * 0.05;
    const stump = new THREE.Mesh(gStump, matBase); stump.position.set(c.cx, 0.25, c.cz);
    e.stump = stump; ctx.scene.add(stump);
    ctx.Sfx && ctx.Sfx.crash && ctx.Sfx.crash(Math.min(14, sp));
  } else {
    const h = hydrantMesh(); h.position.set(c.cx, 0.33, c.cz);
    e.mesh = h; e.vx = dx * sp * 0.6; e.vz = dz * sp * 0.6; e.vy = 4 + sp * 0.25; e.spin = 8 + sp;
    const stub = new THREE.Mesh(gStub, matRed); stub.position.set(c.cx, 0.08, c.cz);
    e.stump = stub; ctx.scene.add(stub);
    e.water = geyser(); e.water.pts.position.set(c.cx, 0, c.cz); ctx.scene.add(e.water.pts);
    ctx.Sfx && ctx.Sfx.punch && ctx.Sfx.punch();
    if (!ctx.saidWash && ctx.toast) { ctx.saidWash = true; ctx.toast('Free car wash. The water bill goes to the HOA.'); }
  }
  ctx.scene.add(e.mesh); live.push(e);
}

export function update(dt) {
  if (!ctx || !live.length) return;
  dt = Math.min(dt, 0.05);
  const cam = ctx.camera && ctx.camera.position;
  for (let i = live.length - 1; i >= 0; i--) {
    const e = live[i]; e.t += dt;
    if (e.kind === 'lamp') {
      if (e.ang < Math.PI / 2 - 0.02) { e.av += 3.2 * Math.sin(e.ang + 0.05) * dt; e.ang = Math.min(Math.PI / 2 - 0.02, e.ang + e.av * dt); if (e.ang >= Math.PI / 2 - 0.02 && !e.landed) { e.landed = true; ctx.Sfx && ctx.Sfx.crash && ctx.Sfx.crash(6); } }
      e.tilt.rotation.x = e.ang;
    } else {
      const m = e.mesh;
      if (m.position.y > 0.2 || e.vy > 0) {
        e.vy -= 14 * dt; m.position.x += e.vx * dt; m.position.z += e.vz * dt; m.position.y += e.vy * dt;
        m.rotation.x += e.spin * dt; m.rotation.z += e.spin * 0.6 * dt;
        if (m.position.y < 0.2) { m.position.y = 0.2; e.vy = e.vy < -2 ? -e.vy * 0.35 : 0; e.vx *= 0.6; e.vz *= 0.6; e.spin *= 0.5; }
      }
      const W = e.water;
      if (W) {
        const strength = Math.max(0, 1 - e.t / 40);           // the geyser runs ~40 s, then trickles out
        for (let k = 0; k < W.N; k++) {
          W.age[k] += dt;
          if (W.age[k] > 1.4) { W.age[k] = 0; W.pos[k * 3] = (Math.random() - 0.5) * 0.15; W.pos[k * 3 + 1] = 0.15; W.pos[k * 3 + 2] = (Math.random() - 0.5) * 0.15; W.vel[k * 3] = (Math.random() - 0.5) * 1.6; W.vel[k * 3 + 1] = (5 + Math.random() * 3) * strength; W.vel[k * 3 + 2] = (Math.random() - 0.5) * 1.6; }
          W.vel[k * 3 + 1] -= 9.8 * dt;
          W.pos[k * 3] += W.vel[k * 3] * dt; W.pos[k * 3 + 1] = Math.max(0.02, W.pos[k * 3 + 1] + W.vel[k * 3 + 1] * dt); W.pos[k * 3 + 2] += W.vel[k * 3 + 2] * dt;
        }
        W.pts.geometry.attributes.position.needsUpdate = true;
        if (strength <= 0) { ctx.scene.remove(W.pts); W.pts.geometry.dispose(); e.water = null; }
      }
    }
    // put it back once nobody is looking
    if (e.t > RESTORE_AFTER && (!cam || Math.hypot(cam.x - e.x, cam.z - e.z) > RESTORE_DIST)) {
      ctx.scene.remove(e.mesh); if (e.stump) ctx.scene.remove(e.stump); if (e.water) ctx.scene.remove(e.water.pts);
      TER.setBroken(e.gi, false);
      live.splice(i, 1);
    }
  }
}
/** Put everything back now (new game / load). */
export function resetAll() { for (const e of live) e.t = 1e9; const c = ctx && ctx.camera; if (c) { const p = c.position.clone(); c.position.set(1e6, 0, 1e6); update(0); c.position.copy(p); } }
