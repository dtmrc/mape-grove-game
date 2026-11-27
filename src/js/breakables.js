// Engine: props a car can knock over. Street lamps snap at the base and topple (their light goes out); fire hydrants
// pop off and a water geyser sprays for a while. The standing prop is a movable world group (terrain.js); breaking
// it sets group.broken, which hides its static geometry, collider, light and halo without touching saved edits.
// A loose copy then does the falling. Everything is restored after a while, once the camera is far enough away.
// 2026-11-27: fence sections and gates break too (their panels, rails and posts fly as instanced debris: at most 6 draw
// calls however much fence is down); a lamp's light, cone, halo and ground glow go out the moment it is hit; a hydrant
// gushes for a minute, then the water is shut off.
import * as THREE from 'three';
import * as TER from './terrain.js';
import { breakablesNear, colliders as WCOLS } from './world.js';

let ctx = null;
const live = [];                 // { G, kind, mesh, t, ... }
const RESTORE_AFTER = 120, RESTORE_DIST = 70;
const GUSH = 60, GUSH_FADE = 6;   // a broken hydrant runs full for ~54 s, sputters, and is shut off at 60 s
const matPole = new THREE.MeshLambertMaterial({ color: 0xb8bcc4 });
const matBase = new THREE.MeshLambertMaterial({ color: 0x8a8a86 });
const matRed = new THREE.MeshLambertMaterial({ color: 0xd8302a });
const matWater = new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.2, transparent: true, opacity: 0.8, depthWrite: false });
// P18: shared geometries (one set for every lamp / hydrant that ever breaks)
const gPole = new THREE.CylinderGeometry(0.07, 0.11, 6, 8), gArm = new THREE.BoxGeometry(0.09, 0.09, 2), gHead = new THREE.BoxGeometry(0.42, 0.14, 0.7), gStump = new THREE.CylinderGeometry(0.32, 0.38, 0.5, 8);
const gHyd = new THREE.CylinderGeometry(0.16, 0.2, 0.65, 8), gCap = new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), gStub = new THREE.CylinderGeometry(0.12, 0.14, 0.15, 8);

/** Call once after the scene exists. o = { scene, Sfx, toast, camera, T (textures), lights, pools (lamp glow mesh), lightfx } */
export function init(o) { ctx = o; window.__BRK = { live, carHit, near: breakablesNear, debris: () => DEB && Object.fromEntries(Object.entries(DEB).map(([k, d]) => [k, d.items.length])) }; }

// ---------- lamp glow: everything a street lamp lights goes out with it, now ----------
function lampLightsChanged() {
  if (ctx.lightfx && ctx.lightfx.refresh) ctx.lightfx.refresh();   // the cone (otherwise checked every 0.5 s)
  const pools = ctx.pools, lights = ctx.lights; if (!pools || !lights) return;   // the glow pool on the ground
  const pos = [], uv = [];
  for (const L of lights) if (L.y > 4.5 && L.i > 0 && !L.del) { const q = new THREE.PlaneGeometry(11, 11); q.rotateX(-Math.PI / 2); q.translate(L.x, 0.1, L.z); const nq = q.toNonIndexed(); pos.push(...nq.attributes.position.array); uv.push(...nq.attributes.uv.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  pools.geometry.dispose(); pools.geometry = g; TER.drapeMesh(pools);
}

// ---------- fence debris: one InstancedMesh per look, pieces are simple tumbling boxes / cards ----------
const CAP = 320, PL = 1.2;
let DEB = null;
const _o = new THREE.Object3D(), _c = new THREE.Color();
function gateTex() {   // five-bar farm gate, drawn once
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32; const g = cv.getContext('2d');
  g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  for (let k = 0; k < 5; k++) { const y = 29 - k * 6.2; g.beginPath(); g.moveTo(2, y); g.lineTo(126, y); g.stroke(); }
  g.beginPath(); g.moveTo(3, 2); g.lineTo(3, 30); g.moveTo(125, 2); g.lineTo(125, 30); g.moveTo(4, 29); g.lineTo(124, 4); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function debris() {
  if (DEB) return DEB;
  const T = ctx.T || {};
  const card = (u) => { const g = new THREE.PlaneGeometry(PL, 1), a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setX(i, a.getX(i) * u); return g; };
  const box = (u) => { const g = new THREE.BoxGeometry(1, 1, 1); if (u) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setX(i, a.getX(i) * u); } return g; };
  const cut = (map) => new THREE.MeshLambertMaterial({ map: map || null, alphaTest: 0.5, side: THREE.DoubleSide });
  const def = {
    picket: [card(PL), cut(T.picket)], chain: [card(PL * 1.5), cut(T.chain)], iron: [card(PL), cut(T.iron)],
    board: [box(PL / 3), new THREE.MeshLambertMaterial({ map: T.fence || null })],
    gate: [new THREE.PlaneGeometry(1, 1), cut(gateTex())],
    solid: [box(0), new THREE.MeshLambertMaterial()],
  };
  DEB = {};
  for (const [k, [geo, mat]] of Object.entries(def)) {
    const m = new THREE.InstancedMesh(geo, mat, CAP); m.count = 0; m.visible = false; m.frustumCulled = false; m.userData.noLift = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _c.set(0xffffff));
    ctx.scene.add(m); DEB[k] = { m, items: [] };
  }
  return DEB;
}
function writePiece(p) {
  _o.position.set(p.x, p.y, p.z); _o.rotation.set(p.tilt, p.yaw, p.roll, 'YXZ'); _o.scale.set(p.sx, p.sy, p.sz); _o.updateMatrix();
  p.D.m.setMatrixAt(p.idx, _o.matrix);
}
function addPiece(kind, x, z, y, yaw, sx, sy, sz, col, hh, ht) {
  const D = debris()[kind]; if (D.items.length >= CAP) return null;
  const p = { D, idx: D.items.length, x, y, z, yaw, tilt: 0, roll: 0, sx, sy, sz, hh, ht, vx: 0, vy: 0, vz: 0, w: 0, wy: 0, sleep: false };
  D.items.push(p); D.m.count = D.items.length; D.m.visible = true;
  D.m.setColorAt(p.idx, _c.set(col)); D.m.instanceColor.needsUpdate = true;
  writePiece(p); D.m.instanceMatrix.needsUpdate = true;
  return p;
}
function freePiece(p) {
  const D = p.D, last = D.items.pop();
  if (last !== p) { D.items[p.idx] = last; last.idx = p.idx; writePiece(last); D.m.getColorAt(D.items.length, _c); D.m.setColorAt(last.idx, _c); D.m.instanceColor.needsUpdate = true; }
  D.m.count = D.items.length; D.m.visible = D.items.length > 0; D.m.instanceMatrix.needsUpdate = true;
}
// what each fence kind leaves behind: card / board panels, rails and posts (sizes match world.js FENCE + fence() + field rails)
const POSTS = { picket: [0.11, 0xf2f0ea, 2.4], chain: [0.07, 0xa8acb2, 2.4], iron: [0.5, 0x9a5a48, 5], privacy: [0.11, null, 2.4], rail: [0.15, null, 2.4], board: [0, 0, 0], farmrail: [0.16, 0xc8b49a, 3.2], farmgate: [0.2, 0xb8a488, 1e9] };
function fencePieces(orig, G, dx, dz, sp, hx, hz) {
  let [x0, z0, x1, z1] = orig.seg;
  if (G && (G.dx || G.dz)) { x0 += G.dx; x1 += G.dx; z0 += G.dz; z1 += G.dz; }   // moved in the editor (rotation is rare: ignored)
  const len = Math.hypot(x1 - x0, z1 - z0) || 1, ux = (x1 - x0) / len, uz = (z1 - z0) / len, yaw = Math.atan2(-uz, ux);
  const side = Math.sign(dx * Math.sin(yaw) + dz * Math.cos(yaw)) || 1, h = orig.h || 1.2, fk = orig.fk, col = orig.fc ?? 0xffffff;
  const out = [];
  const put = (kind, t, y, sx, sy, sz, c, hh, ht) => { const p = addPiece(kind, x0 + ux * t, z0 + uz * t, TER.heightAt(x0 + ux * t, z0 + uz * t) + y, yaw, sx, sy, sz, c, hh, ht); if (p) out.push(p); };
  if (fk === 'farmgate') put('gate', len / 2, 0.66, len - 0.3, 0.95, 1, col, 0.48, 0.03);
  else if (fk === 'rail' || fk === 'farmrail') {
    const n = Math.max(1, Math.round(len / (fk === 'farmrail' ? 3.2 : 2.4))), l = len / n;
    for (let k = 0; k < n; k++) for (const y of fk === 'rail' ? [0.45, 0.88] : [0.55, 1.05]) put('solid', (k + 0.5) * l, y, l, 0.11, 0.08, col, 0.055, 0.04);
  } else {
    const kind = fk === 'privacy' || fk === 'board' ? 'board' : fk === 'chain' || fk === 'iron' ? fk : 'picket';
    const n = Math.max(1, Math.round(len / PL)), l = len / n, th = kind === 'board' ? (fk === 'board' ? 0.1 : 0.08) : 1;
    for (let k = 0; k < n; k++) put(kind, (k + 0.5) * l, h / 2, kind === 'board' ? l : l / PL, h, th, col, h / 2, kind === 'board' ? th / 2 : 0.02);
  }
  const P = POSTS[fk];
  if (P && P[0]) {
    const n = Math.max(1, Math.round(len / P[2])), ph = fk === 'farmgate' ? 1.4 : fk === 'farmrail' ? 1.25 : h + (fk === 'iron' ? 0.3 : 0.05);
    for (let k = 0; k <= n; k++) put('solid', len * k / n, ph / 2, P[0], ph, P[0], P[1] ?? col, ph / 2, P[0] / 2);
  }
  // kick: what the car hit flies, the rest of the section is dragged down with it
  for (const p of out) {
    const d = Math.hypot(p.x - hx, p.z - hz), k = Math.max(0, 1 - d / 3), r = 0.8 + Math.random() * 0.4;
    p.vx = dx * sp * (0.12 + 0.55 * k) * r; p.vz = dz * sp * (0.12 + 0.55 * k) * r; p.vy = (0.6 + 3.2 * k) * r * Math.min(1, sp / 10);
    p.w = side * (1.2 + 6 * k) * r; p.wy = (Math.random() - 0.5) * 5 * k; p.side = side;
  }
  return out;
}
function stepPiece(p, dt) {
  if (p.sleep) return false;
  p.vy -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.tilt += p.w * dt; p.yaw += p.wy * dt;
  const g = TER.heightAt(p.x, p.z), low = p.hh * Math.abs(Math.cos(p.tilt)) + p.ht * Math.abs(Math.sin(p.tilt));
  if (p.y - low <= g) {
    p.y = g + low; p.vy = p.vy < -2 ? -p.vy * 0.25 : 0;
    const f = Math.max(0, 1 - 5 * dt); p.vx *= f; p.vz *= f; p.wy *= f;
    // lie down flat on whichever face is nearer
    const flat = Math.round((p.tilt - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2, e = flat - p.tilt;
    p.w += e * 40 * dt; p.w *= Math.max(0, 1 - 7 * dt);
    if (Math.abs(e) < 0.03 && Math.abs(p.w) < 0.3 && p.vy === 0 && Math.hypot(p.vx, p.vz) < 0.15) { p.tilt = flat; p.y = g + p.ht; p.sleep = true; }
  }
  writePiece(p); return true;
}

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
const matPuddle = new THREE.MeshBasicMaterial({ color: 0x3a4a58, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const gPuddle = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
function geyser() {
  const N = 140, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), age = new Float32Array(N);
  for (let i = 0; i < N; i++) age[i] = Math.random() * 1.4;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, matWater); pts.frustumCulled = false;
  return { pts, pos, vel, age, N };
}

/** Called for each car body circle before it collides with the world. */
export function carHit(car, cx, cz, r) {
  if (!ctx) return;
  const sp = Math.hypot(car.vx, car.vz); if (sp < 3) return;
  for (const c of breakablesNear(cx, cz, r)) {
    let m = c._m; if (!m) { const i = WCOLS.indexOf(c); m = i >= 0 ? TER.colModel[i] : null; }   // before the first toggle the engine list is world.js's raw one
    const orig = m ? m.orig : c, gi = m ? m.grp : TER.groupAt(c.cx, c.cz, false), G = gi && TER.groups[gi];
    if (!G || G.broken || G.hide || (orig.brk === 'lamp' || orig.brk === 'hydrant') && sp < 3.5) continue;
    if (G.cols.some((ci) => TER.colModel[ci].orig.bld)) continue;   // never knock a building over with its fence
    smash(G, gi, orig, c, car.vx / sp, car.vz / sp, sp, cx, cz);
    const k = orig.brk === 'fence' ? 0.93 : orig.brk === 'gate' ? 0.88 : 0.82; car.vx *= k; car.vz *= k;
  }
}

function smash(G, gi, orig, c, dx, dz, sp, hx, hz) {
  TER.setBroken(gi, true); // P18: only this group's texture entry, light and collider change
  if (orig.brk === 'fence' || orig.brk === 'gate') {
    const [x0, z0, x1, z1] = orig.seg || [hx, hz, hx, hz];
    const e = { G, gi, kind: 'fence', t: 0, x: (x0 + x1) / 2 + (G.dx || 0), z: (z0 + z1) / 2 + (G.dz || 0), pieces: orig.seg ? fencePieces(orig, G, dx, dz, sp, hx, hz) : [] };
    ctx.Sfx && ctx.Sfx.crash && ctx.Sfx.crash(Math.min(9, sp * 0.6));
    live.push(e); return;
  }
  const e = { G, gi, kind: orig.brk, t: 0, x: c.cx, z: c.cz };
  if (orig.brk === 'lamp') {
    lampLightsChanged();   // light, cone and glow pool out this frame (setBroken already zeroed the light)
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
    e.puddle = new THREE.Mesh(gPuddle, matPuddle.clone()); e.puddle.position.set(c.cx, 0.03, c.cz); e.puddle.scale.setScalar(0.5); ctx.scene.add(e.puddle);
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
    if (e.kind === 'fence') {
      let moved = false;
      for (const p of e.pieces) if (stepPiece(p, dt)) moved = true;
      if (moved) { const seen = new Set(); for (const p of e.pieces) if (!seen.has(p.D)) { seen.add(p.D); p.D.m.instanceMatrix.needsUpdate = true; } }
    } else if (e.kind === 'lamp') {
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
        const strength = e.t < GUSH - GUSH_FADE ? 1 : Math.max(0, (GUSH - e.t) / GUSH_FADE) * (0.6 + 0.4 * Math.random());   // full for ~54 s, sputters, off at 60 s
        for (let k = 0; k < W.N; k++) {
          W.age[k] += dt;
          if (W.age[k] > 1.4 && e.t < GUSH) { W.age[k] = 0; W.pos[k * 3] = (Math.random() - 0.5) * 0.15; W.pos[k * 3 + 1] = 0.15; W.pos[k * 3 + 2] = (Math.random() - 0.5) * 0.15; W.vel[k * 3] = (Math.random() - 0.5) * 1.6; W.vel[k * 3 + 1] = (5 + Math.random() * 3) * strength; W.vel[k * 3 + 2] = (Math.random() - 0.5) * 1.6; }
          W.vel[k * 3 + 1] -= 9.8 * dt;
          W.pos[k * 3] += W.vel[k * 3] * dt; W.pos[k * 3 + 1] = Math.max(0.02, W.pos[k * 3 + 1] + W.vel[k * 3 + 1] * dt); W.pos[k * 3 + 2] += W.vel[k * 3 + 2] * dt;
        }
        W.pts.geometry.attributes.position.needsUpdate = true;
        if (e.t >= GUSH && !e.shut) {   // the water is shut off
          e.shut = true;
          const pp = ctx.camera && ctx.camera.position;
          if (ctx.toast && pp && Math.hypot(pp.x - e.x, pp.z - e.z) < 45) ctx.toast('Public Works shut the hydrant off.');
        }
        if (e.t >= GUSH + 1.5) { ctx.scene.remove(W.pts); W.pts.geometry.dispose(); e.water = null; }   // the last drops have landed
      }
      if (e.puddle) {   // the wet patch spreads while it runs, then dries up
        e.puddle.scale.setScalar(Math.min(3.4, 0.5 + e.t * 0.09));
        e.puddle.material.opacity = e.t < GUSH ? 0.4 : Math.max(0, 0.4 * (1 - (e.t - GUSH) / 30));
      }
    }
    // put it back once nobody is looking
    if (e.t > RESTORE_AFTER && (!cam || Math.hypot(cam.x - e.x, cam.z - e.z) > RESTORE_DIST)) {
      if (e.mesh) ctx.scene.remove(e.mesh); if (e.stump) ctx.scene.remove(e.stump); if (e.water) ctx.scene.remove(e.water.pts);
      if (e.puddle) { ctx.scene.remove(e.puddle); e.puddle.material.dispose(); }
      if (e.pieces) for (const p of e.pieces) freePiece(p);
      TER.setBroken(e.gi, false);
      if (e.kind === 'lamp') lampLightsChanged();
      live.splice(i, 1);
    }
  }
}
/** Put everything back now (new game / load). */
export function resetAll() { for (const e of live) e.t = 1e9; const c = ctx && ctx.camera; if (c) { const p = c.position.clone(); c.position.set(1e6, 0, 1e6); update(0); c.position.copy(p); } }
