// The ghost's periscope (2026-11-28, diet: "implement the periscope view as an actual view and not a dialogue").
// In the dwelling 1,940 m down, E on the brass periscope looks out of its top end: a little brass head poking out of the
// grass north of the RV lot. The view is the real game world, live (time of day, traffic, whoever walks by), seen through
// a round eyepiece. Look around with the move keys / a drag, zoom with the wheel or + and -, E or BACK to stop.
//
// How: the cat really leaves the room for the duration (interiors.js swaps the outdoor render, culling and lights back
// in), stands hidden at the periscope head, and the camera is pinned to the lens through the window.__camO override that
// jailbreak.js already uses. Closing puts him back where he stood. Nothing is rendered twice, so it costs what standing
// at the RV costs. cave.js owns the room hand-off (ctx.leave / ctx.back); this file owns the view.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { phong } from './gfx.js';
import { places } from './world.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const FOV0 = 40, FOV_MIN = 11, FOV_MAX = 55, YAW_MAX = 0.75, PITCH_MAX = 0.2, EYE = 1.02;

export function makePeriscope(ctx) {
  const { scene, G, P, cat, Sfx, isTouch } = ctx;
  const S = { phase: 'off', t: 0, yaw: 0, pitch: 0, fov: FOV0, fov0: 50, cap: 0, capT: 0, lines: [], keys: new Set(), drag: null, zoomBtn: 0 };
  let spot = null, head = null;

  // where the top end comes up: in the grass on the door side of the RV, aimed at the bedroom end
  function place() {
    if (spot || !places.rv) return spot;
    const sx = places.rv.x - 8.3, sz = places.rv.z - 12.2, tx = places.rv.x - 3.3, tz = places.rv.z - 1.9;
    spot = { x: sx, z: sz, yaw: Math.atan2(tx - sx, tz - sz), pitch: Math.atan2(2.0 - EYE, Math.hypot(tx - sx, tz - sz)) };
    // the brass head: a pipe, an elbow box and a dark lens, one draw call (and only near the lot)
    const parts = [new THREE.CylinderGeometry(0.045, 0.05, 0.95, 6).translate(0, 0.475, 0), new THREE.BoxGeometry(0.14, 0.15, 0.2).translate(0, EYE, 0.03), new THREE.CylinderGeometry(0.06, 0.06, 0.03, 6).translate(0, 0.94, 0)];
    const lens = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8).rotateX(Math.PI / 2).translate(0, EYE, 0.135);
    const col = (g, c) => { const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) k.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; };
    head = new THREE.Mesh(mergeGeometries([...parts.map((g) => col(g, 0xb08a3a)), col(lens, 0x10141c)], false), phong({ vertexColors: true, specular: 0xffe0a0, shininess: 70 }));
    head.position.set(sx, 0, sz); head.rotation.y = spot.yaw; head.name = 'periscope-head'; scene.add(head);
    return spot;
  }

  // ---------- the eyepiece overlay ----------
  const css = document.createElement('style');
  css.textContent = `body.scoping #hud > *, body.scoping #touchui { visibility: hidden !important; }
#scope { position: fixed; inset: 0; z-index: 46; display: none; touch-action: none; user-select: none; -webkit-user-select: none; font: bold 13px monospace; color: #e8d8a8; }
#scope .hole { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0, rgba(0,0,0,0) 30vmin, rgba(8,14,10,0.28) 37vmin, rgba(0,0,0,0.9) 39.4vmin, #000 40vmin, #000 40.6vmin, #6a5220 40.8vmin, #d8b860 41.6vmin, #8a6a2a 42.6vmin, #2a2010 43.4vmin, #000 44vmin); }
#scope .x { position: absolute; left: 50%; top: 50%; background: rgba(10,14,10,0.55); }
#scope .x.h { width: 60vmin; height: 1px; margin-left: -30vmin; } #scope .x.v { height: 60vmin; width: 1px; margin-top: -30vmin; }
#scope .ticks { position: absolute; left: 50%; top: 50%; width: 36vmin; height: 9px; margin: -4px 0 0 -18vmin; background: repeating-linear-gradient(90deg, rgba(10,14,10,0.6) 0 1px, transparent 1px 3vmin); }
#scope .shut { position: absolute; inset: 0; background: #000; opacity: 1; }
#scope .cap { position: absolute; left: 50%; bottom: max(3vmin, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(92vw, 640px); text-align: center; text-shadow: 0 2px 0 #000; letter-spacing: 0.5px; line-height: 1.4; }
#scope .tag { position: absolute; left: 50%; top: max(2.2vmin, env(safe-area-inset-top)); transform: translateX(-50%); text-align: center; letter-spacing: 3px; color: #d8b860; white-space: nowrap; }
#scope .tag small { display: block; letter-spacing: 1px; color: #9a8a60; font-size: 12px; margin-top: 4px; color: #c8b888; }
#scope .note { position: absolute; left: calc(50% + 24vmin); top: calc(50% - 41vmin); transform: rotate(7deg); background: #f2e27a; color: #3a3210; padding: 5px 8px; font-size: 11px; box-shadow: 0 3px 0 rgba(0,0,0,0.5); max-width: 110px; text-align: center; }
#scope .btns { position: absolute; right: max(14px, env(safe-area-inset-right)); top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 10px; }
#scope button { font: bold 16px monospace; color: #2a2010; background: #d8b860; border: 2px solid #2a2010; border-radius: 8px; min-width: 56px; min-height: 48px; padding: 0 10px; }`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.id = 'scope';
  el.innerHTML = '<div class="hole"></div><div class="x h"></div><div class="x v"></div><div class="ticks"></div><div class="tag">CAT WATCH<small></small></div><div class="note">BEST VIEW IN THE COUNTY</div><div class="cap"></div><div class="btns"><button data-s="in">+</button><button data-s="out">&minus;</button><button data-s="back">BACK</button></div><div class="shut"></div>';
  document.body.appendChild(el);
  const shut = el.querySelector('.shut'), capEl = el.querySelector('.cap'), hintEl = el.querySelector('.tag small');
  hintEl.textContent = isTouch ? 'drag to look' : 'move keys or mouse: look   wheel: zoom   E: back';

  // ---------- input (only while looking; keyboard is kept from the game so E does not also use something up top) ----------
  const viewing = () => S.phase === 'view';
  addEventListener('keydown', (e) => {
    if (S.phase === 'off') return;
    const k = e.key.toLowerCase();
    if (k === 'f5' || k === 'f12' || e.ctrlKey || e.metaKey) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (!viewing() || e.repeat) return;
    if (['e', 'f', 'enter', ' ', 'escape', 'backspace'].includes(k)) close(); else S.keys.add(k);
  }, true);
  addEventListener('keyup', (e) => { S.keys.delete(e.key.toLowerCase()); });
  addEventListener('blur', () => S.keys.clear());
  addEventListener('wheel', (e) => { if (viewing()) S.fov = clamp(S.fov * (e.deltaY > 0 ? 1.12 : 0.89), FOV_MIN, FOV_MAX); }, { passive: true });
  const look = (dx, dy) => { const k = (S.fov / FOV0) * 0.0022; S.yaw = clamp(S.yaw - dx * k, -YAW_MAX, YAW_MAX); S.pitch = clamp(S.pitch - dy * k, -PITCH_MAX, PITCH_MAX); };
  addEventListener('pointerdown', (e) => { if (S.phase !== 'off' && e.target && e.target.tagName === 'CANVAS') e.stopImmediatePropagation(); }, true);   // pointer-locked clicks: no punching up there
  addEventListener('pointermove', (e) => {
    if (!viewing()) return;
    if (document.pointerLockElement) look(e.movementX, e.movementY);
    else if (S.drag && S.drag.id === e.pointerId) { look(-(e.clientX - S.drag.x) * 1.6, -(e.clientY - S.drag.y) * 1.6); S.drag.x = e.clientX; S.drag.y = e.clientY; }
  });
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault(); if (!viewing()) return;
    const b = e.target.closest('button');
    if (b) { if (b.dataset.s === 'back') close(); else S.zoomBtn = b.dataset.s === 'in' ? -1 : 1; return; }
    S.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  const up = (e) => { S.zoomBtn = 0; if (S.drag && S.drag.id === e.pointerId) S.drag = null; };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);

  // ---------- open / close ----------
  function open() {
    if (S.phase !== 'off' || !place()) return false;
    S.phase = 'in'; S.t = 0; S.yaw = 0; S.pitch = 0; S.fov = FOV0; S.keys.clear(); S.drag = null; S.zoomBtn = 0;
    S.lines = (ctx.captions && ctx.captions()) || []; S.cap = 0; S.capT = 0; capEl.textContent = S.lines[0] || '';
    el.style.display = 'block'; shut.style.opacity = '0'; Sfx.door && Sfx.door();
    return true;
  }
  function close() { if (S.phase === 'view') { S.phase = 'out'; S.t = 0; Sfx.blip && Sfx.blip(300); } }
  function cleanup() {
    window.__camO = null; cat.visible = true; if (head) head.visible = true;
    if (ctx.camera) { ctx.camera.fov = S.fov0; ctx.camera.updateProjectionMatrix(); }
    document.body.classList.remove('scoping');
  }
  function aim() {
    const yaw = spot.yaw + S.yaw + Math.sin((G.time || 0) * 0.7) * 0.0015, pitch = spot.pitch + S.pitch, c = Math.cos(pitch);
    const dx = Math.sin(yaw) * c, dy = Math.sin(pitch), dz = Math.cos(yaw) * c;
    window.__camO = [[spot.x + dx * 0.2, EYE, spot.z + dz * 0.2], [spot.x + dx * 20, EYE + dy * 20, spot.z + dz * 20]];
    if (ctx.camera && Math.abs(ctx.camera.fov - S.fov) > 0.01) { ctx.camera.fov = S.fov; ctx.camera.updateProjectionMatrix(); }
  }
  const hold = () => { P.x = spot.x; P.z = spot.z; P.vx = P.vz = 0; P.y = 0; P.vy = 0; P.lock = Math.max(P.lock || 0, 0.3); };

  // per frame (cave.js update; not while paused or in a dialog)
  function update(dt) {
    if (S.phase === 'off') { if (head) head.visible = Math.abs(P.x - spot.x) < 70 && Math.abs(P.z - spot.z) < 70; else if ((G.time || 0) > 0.2) place(); return; }
    S.t += dt;
    if (S.phase === 'in') {              // eye to the eyepiece: black, then swap to the surface
      shut.style.opacity = String(clamp(S.t / 0.25, 0, 1));
      P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.3);
      if (S.t >= 0.25) {
        if (!ctx.leave(spot)) { S.phase = 'off'; el.style.display = 'none'; return; }
        S.fov0 = ctx.camera ? ctx.camera.fov : 50;
        cat.visible = false; head.visible = false; document.body.classList.add('scoping');
        S.phase = 'view'; S.t = 0; hold(); aim();
      }
      return;
    }
    if (S.phase === 'wake') {            // back in the dwelling
      shut.style.opacity = String(clamp(1 - S.t / 0.3, 0, 1));
      if (S.t >= 0.3) { S.phase = 'off'; el.style.display = 'none'; }
      return;
    }
    // something else moved the cat (busted, respawn, the editor): drop the view where he is now
    if (Math.hypot(P.x - spot.x, P.z - spot.z) > 2.5 || P.car) { cleanup(); S.phase = 'off'; el.style.display = 'none'; return; }
    hold();
    if (S.phase === 'view') {
      shut.style.opacity = String(clamp(1 - S.t / 0.35, 0, 1));
      const K = S.keys, D = ctx.down || (() => false), sp = dt * 0.6 * (S.fov / FOV0);
      const lr = (K.has('d') || K.has('arrowright') || D('d', 'arrowright') ? 1 : 0) - (K.has('a') || K.has('arrowleft') || D('a', 'arrowleft') ? 1 : 0);
      const ud = (K.has('w') || K.has('arrowup') || D('w', 'arrowup') ? 1 : 0) - (K.has('s') || K.has('arrowdown') || D('s', 'arrowdown') ? 1 : 0);
      S.yaw = clamp(S.yaw - lr * sp, -YAW_MAX, YAW_MAX); S.pitch = clamp(S.pitch + ud * sp, -PITCH_MAX, PITCH_MAX);
      const z = S.zoomBtn + (K.has('-') || K.has('_') || K.has('z') ? 1 : 0) - (K.has('+') || K.has('=') || K.has('q') ? 1 : 0);
      if (z) S.fov = clamp(S.fov * (1 + z * dt * 1.2), FOV_MIN, FOV_MAX);
      if (S.lines.length > 1 && (S.capT += dt) > 5) { S.capT = 0; S.cap = (S.cap + 1) % S.lines.length; capEl.textContent = S.lines[S.cap]; }
      aim();
    } else if (S.phase === 'out') {      // black, back down the pipe
      shut.style.opacity = String(clamp(S.t / 0.2, 0, 1)); aim();
      if (S.t >= 0.2) { cleanup(); ctx.back(); S.phase = 'wake'; S.t = 0; }
    }
  }
  return { open, close, update, active: () => S.phase !== 'off' && S.phase !== 'wake' && S.phase !== 'in', S, spot: () => place() };
}
