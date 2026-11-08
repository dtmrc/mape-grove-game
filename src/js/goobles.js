// Goobles, the playable cat, from Tracebench (tools/tracebench/models/goobles/Goobles.glb, embedded at build time).
//
// The rest of the game drives the player through the old procedural rig: cat.userData.{body, torso, head, arms[2], legs[2]}
// gets rotations written to it (punch, cuffs, fishing, gun aim, knocked down, flips) and props get .add()-ed to arms[1],
// head and torso. This adapter keeps that contract on top of the skinned GLB:
//   - body is a real group around the model (flips and knock-downs rotate it as before);
//   - head / arms / legs / torso are proxies. animBiped() (models.js) calls u.onBiped(), which records the move and
//     resets every proxy to its neutral pose; anything a system writes after that is an override, applied to the matching
//     bone after the AnimationMixer has played the clip (Idle / Walk / Run / Jump / Wave);
//   - .add()/.remove() on a proxy go to a socket on the right bone, laid out like the old pivot, so props line up.
// Old procedural Goobles stays available: add ?goobles=old to the URL, or localStorage 'mg.goobles' = 'old'.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GLB from '../models/goobles.glb';

const S = 0.88;                      // Tracebench Goobles is 1.11 m; the game's cat (cars, doors, props) is sized for ~1 m
const OLD_ARM_Z = [-0.42, 0.42];      // old pivots' resting spread, so a written rotation.z maps to a change from rest
const RUN_FROM = 1.2;                 // m/s: walk clip below, run clip above

export function useLegacyGoobles() {
  try { if (/[?&]goobles=old\b/.test(location.search)) return true; } catch (e) { /* no location */ }
  try { return localStorage.getItem('mg.goobles') === 'old'; } catch (e) { return false; }
}

/** Returns a root Group with the same userData contract as models.js makeCat(). light() -> {k, color} tints the unlit textures for night. */
export function makeGoobles(o = {}) {
  if (useLegacyGoobles() && o.legacy) return o.legacy();
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const holder = new THREE.Group(); holder.scale.setScalar(S); body.add(holder);
  if (o.shadow) o.shadow(root);

  // sockets: final parents for props, re-parented onto bones when the model arrives
  const sock = { arm0: new THREE.Group(), arm1: new THREE.Group(), head: new THREE.Group(), torso: new THREE.Group() };
  for (const k in sock) { sock[k].scale.setScalar(1 / S); holder.add(sock[k]); }
  const proxy = (s, rz = 0) => {
    const p = new THREE.Object3D(); p.rotation.z = rz; p.userData.neutral = new THREE.Euler(0, 0, rz);
    p.add = (...a) => { s.add(...a); return p; };
    p.remove = (...a) => { s.remove(...a); return p; };
    p.socket = s;
    return p;
  };
  const arms = [proxy(sock.arm0, OLD_ARM_Z[0]), proxy(sock.arm1, OLD_ARM_Z[1])];
  const legs = [proxy(sock.torso), proxy(sock.torso)];
  const head = proxy(sock.head), torso = proxy(sock.torso);
  const u = root.userData = { body, torso, legs, arms, head, lookFwd: true, glb: true, crown: 0.3, air: false, swim: false };

  let mixer = null, clips = {}, cur = null, bones = {}, rest = {}, last = null, speed = 0, emote = null, ready = false;
  const mats = [];
  u.onBiped = (ph, amt, t, punch = 0) => {
    for (const p of [...arms, ...legs, head, torso]) p.rotation.copy(p.userData.neutral);
    body.position.y = 0;
    if (punch > 0) arms[1].rotation.x = -1.6 * punch;
  };
  u.emote = (name) => { if (clips[name]) { emote = name; play(name, 0.15, true); } };

  function play(name, fade = 0.18, once = false) {
    const a = clips[name]; if (!a || cur === a) return a;
    a.reset(); a.enabled = true; a.setEffectiveWeight(1);
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    if (cur) cur.crossFadeTo(a, fade, false);
    a.play(); cur = a; return a;
  }
  const differs = (e, n) => Math.abs(e.x - n.x) > 1e-4 || Math.abs(e.y - n.y) > 1e-4 || Math.abs(e.z - n.z) > 1e-4;
  const _c = new THREE.Color();

  /** Call once per frame after the player's position is set. */
  u.sync = (dt, light) => {
    if (!ready || !root.visible) { last = null; return; }
    const p = root.position;
    if (last && dt > 0) { const v = Math.hypot(p.x - last.x, p.z - last.z) / dt; speed += (Math.min(v, 12) - speed) * Math.min(1, dt * 10); }
    last = (last || new THREE.Vector3()).copy(p);
    // pick the clip
    if (emote && (speed > 0.6 || u.air || !cur || (cur === clips[emote] && cur.time >= cur.getClip().duration - 0.01))) emote = null;
    if (!emote) {
      if (u.air) { const a = play('Jump', 0.12, true); if (a) { a.timeScale = 0; a.time = 0.62; } }
      else if (u.swim) { const a = play('Walk'); if (a) a.timeScale = 1.6; }
      else if (speed > RUN_FROM) { const a = play('Run'); if (a) a.timeScale = Math.max(1, speed / 1.9); }
      else if (speed > 0.15) { const a = play('Walk'); if (a) a.timeScale = Math.max(0.6, speed / 0.5); }
      else { const a = play('Idle', 0.25); if (a) a.timeScale = 1; }
    }
    mixer.update(dt);
    // overrides written by other systems this frame
    for (let i = 0; i < 2; i++) {
      const a = arms[i], b = bones[i ? 'arm_L' : 'arm_R'];
      if (differs(a.rotation, a.userData.neutral)) { const r = rest[b.name]; b.rotation.set(a.rotation.x, 0, r.z + (a.rotation.z - OLD_ARM_Z[i])); }
      const l = legs[i], t = bones[i ? 'thigh_L' : 'thigh_R'];
      if (differs(l.rotation, l.userData.neutral)) t.rotation.set(l.rotation.x, 0, l.rotation.z);
    }
    if (differs(head.rotation, head.userData.neutral)) bones.head.rotation.copy(head.rotation);
    // the textures are unlit (lighting painted in), so dim them with the sky light at night
    if (light) {
      const L = light();
      _c.setRGB(1, 1, 1).lerp(L.color, 0.25 * (1 - L.k)).multiplyScalar(L.k);
      for (const m of mats) m.color.copy(_c);
    }
  };

  const buf = GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength);
  new GLTFLoader().parse(buf, '', (gltf) => {
    const model = gltf.scene;
    model.traverse((n) => {
      if (n.isBone) { bones[n.name] = n; rest[n.name] = n.rotation.clone(); }
      if (n.isMesh) {
        n.frustumCulled = false; n.layers.mask = root.layers.mask;
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          if (m.map) { m.map.magFilter = m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; m.map.needsUpdate = true; }
          m.fog = true; mats.push(m);
        }
      }
    });
    holder.add(model);
    // sockets laid out like the old pivots: arms' local -Y runs down the arm to the paw (old paw centre 0.17 m from the shoulder)
    const hand = (sk, bn, s) => { bones[bn].add(sk); sk.position.set(s * (0.06 - 0.17 / S), 0, 0); sk.rotation.set(0, 0, s * Math.PI / 2); };
    hand(sock.arm0, 'hand_R', -1); hand(sock.arm1, 'hand_L', 1);
    bones.head.add(sock.head); sock.head.position.set(0, -0.04, 0);           // old head pivot sat lower on the skull; this seats hats and riders on the flat crown
    bones.hips.add(sock.torso); sock.torso.position.set(0, (0.13 - 0.46 * S) / S, -0.06 / S); // old torso pivot = ground; cuffs at the new wrists
    mixer = new THREE.AnimationMixer(model);
    for (const c of gltf.animations) clips[c.name] = mixer.clipAction(c);
    model.traverse((n) => { n.layers.mask = root.layers.mask; });
    ready = true;
    play('Idle', 0);
    u.model = model; u.bones = bones; u.clips = clips;
  }, (e) => { console.error('Goobles GLB failed to load', e); if (o.legacy) { const old = o.legacy(); swapIn(root, old); } });
  return root;
}

// load failure: graft the old procedural cat into the same root, so references other systems already hold keep working
function swapIn(root, old) {
  const u = root.userData, ou = old.userData;
  for (const c of [...root.children]) root.remove(c);
  for (const c of [...old.children]) root.add(c);
  const move = (p, q) => { for (const c of [...p.socket.children]) q.add(c); };
  move(u.arms[0], ou.arms[0]); move(u.arms[1], ou.arms[1]); move(u.head, ou.head); move(u.torso, ou.torso);
  root.userData = ou;
}
