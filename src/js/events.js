// World events for Maple Grove: Off Leash. Owned by the events thread.
// Event 1, "The Watcher": a man in a trench coat and hat, black head to toe like a shadow, stands in the green
// clearing in Hollow Woods by the ruined cabin, facing the RV. As soon as Goobles approaches, he turns, walks around the
// ruined cabin to its back wall, and is gone.
//
// Wired into game.js by tools/events-hooks.mjs. Debug: window.__G.events.watcher.spawn() / .reset().
import * as THREE from 'three';
import * as Models from './models.js';
import { mat } from './gfx.js';

// Placeholder until the art thread's makeShadowMan() lands in models.js.
function placeholderShadowMan() {
  const ink = 0x050505;
  const o = Models.makeHuman({ skin: ink, shirt: ink, pants: ink, hair: ink, shoe: ink, longSleeve: true, bald: true, smile: false });
  const u = o.userData, black = mat(ink);
  // trench coat skirt hanging from the waist, and a wide-brim hat
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.7, 12, 1, true), black);
  coat.position.y = 0.62; coat.scale.z = 0.7; coat.material.side = THREE.DoubleSide; u.torso.add(coat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16), black); brim.position.y = 0.24; u.head.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.16, 14), black); crown.position.y = 0.32; u.head.add(crown);
  o.scale.setScalar(1.08);
  return o;
}

export function makeEvents({ scene, camera, G, pos, onFoot }) {
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), v3 = new THREE.Vector3();
  const inView = (x, y, z) => {
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    return frustum.containsPoint(v3.set(x, y, z));
  };

  // ---------- The Watcher ----------
  const W = {
    spot: { x: -134.3, z: 86.4 },    // just off the cabin's north-east corner (cabin spans x -140.5..-135.5, z 79..85)
    face: { x: -104, z: 40 },        // stares toward the RV
    // one straight walk west along the north wall, behind the cabin as seen from the RV (no corner to turn)
    path: [{ x: -142, z: 86.4 }],
    triggerR: 45,                    // he leaves once Goobles is this close (the RV is ~48 m away)
    speed: 1.7,
    cooldown: 24 * 60,               // once per in-game day (1 game hour = 1 real minute)
    state: 'armed', t: 0, next: 0, mesh: null, ph: 0, leg: 0,
  };
  const yawTo = (m, x, z) => Math.atan2(x - m.position.x, z - m.position.z);
  const turn = (m, want, k) => { m.rotation.y += Math.atan2(Math.sin(want - m.rotation.y), Math.cos(want - m.rotation.y)) * Math.min(1, k); };
  const build = () => {
    const mesh = typeof Models.makeShadowMan === 'function' ? Models.makeShadowMan() : placeholderShadowMan();
    mesh.visible = false; scene.add(mesh); return mesh;
  };
  W.spawn = () => {
    if (!W.mesh) W.mesh = build();
    W.mesh.position.set(W.spot.x, 0, W.spot.z);
    W.mesh.rotation.y = yawTo(W.mesh, W.face.x, W.face.z);
    W.mesh.visible = true; W.state = 'watching'; W.t = 0;
  };
  W.reset = () => { if (W.mesh) W.mesh.visible = false; W.state = 'armed'; W.next = 0; };
  W.update = (dt) => {
    const p = pos();
    const dHim = Math.hypot(p.x - W.spot.x, p.z - W.spot.z);
    if (W.state === 'armed') {
      // appear only while off-screen (no pop-in) and Goobles is still outside the woods
      if (G.time >= W.next && dHim > W.triggerR + 2 && !inView(W.spot.x, 1, W.spot.z)) W.spawn();
      return;
    }
    const m = W.mesh; W.t += dt;
    if (W.state === 'watching') {
      Models.animBiped(m, 0, 0, G.time);
      if (dHim < W.triggerR) { W.state = 'turning'; W.t = 0; W.leg = 0; }
    } else if (W.state === 'turning') {
      turn(m, yawTo(m, W.path[0].x, W.path[0].z), dt * 4);
      Models.animBiped(m, 0, 0, G.time);
      if (W.t > 0.7) { W.state = 'leaving'; W.t = 0; W.ph = 0; }
    } else if (W.state === 'leaving') {
      const tgt = W.path[W.leg], dx = tgt.x - m.position.x, dz = tgt.z - m.position.z, L = Math.hypot(dx, dz), step = W.speed * dt;
      turn(m, Math.atan2(dx, dz), dt * 6);
      if (L <= step) { m.position.x = tgt.x; m.position.z = tgt.z; W.leg++; }
      else { m.position.x += dx / L * step; m.position.z += dz / L * step; }
      W.ph += dt * W.speed * 3.4;
      Models.animBiped(m, W.ph, 0.75, G.time);
      // gone once he reaches the back of the cabin, out of sight
      if (W.leg >= W.path.length || W.t > 20) {
        m.visible = false; W.state = 'armed'; W.next = G.time + W.cooldown; G.sawWatcher = (G.sawWatcher || 0) + 1;
      }
    }
  };

  const list = [W];
  return {
    watcher: W,
    update(dt) { if (onFoot && !onFoot() && W.state === 'armed') return; for (const e of list) e.update(dt); },
  };
}
