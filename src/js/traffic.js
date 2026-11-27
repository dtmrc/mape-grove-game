// traffic.js - stop signs + traffic lights that AI traffic obeys (driving thread, 2026-11-11, diet's ask).
//
// Junctions come from the road graph (world.js NODES / ADJ, editable in the world editor, rebuilt on RD.onRoads):
//   - 4+ way junctions, and 3-way junctions on the highway, get traffic lights (two phases by road axis)
//   - every other 3-way junction is an all-way stop
// Everything is instanced (poles, sign faces, light heads, lamps): 5 draw calls for the whole town.
// AI traffic (game.js trafficAI) asks limit() for a speed cap: it eases to a stop at the line on red / at stop signs,
// waits its turn at all-way stops (one car released at a time), and runs a yellow only when it can't stop in time.
// The player, police, HOA patrols and racers ignore them (running a red is your business).
import * as THREE from 'three';
import { junctionControl } from './roadflow.js';

const GREEN = 10, YELLOW = 2.6, ALLRED = 1.2, CYCLE = 2 * (GREEN + YELLOW + ALLRED);
const DECEL = 3.2;   // comfortable stopping decel (m/s^2) for the speed profile

export function makeTraffic(api) {
  const { scene, NODES, ADJ, heightAt, G, isPath } = api;
  let J = new Map(); // node index -> junction {n, x, z, kind: 'light'|'stop', ap: Map(fromNode -> approach), off, busy}

  // ---------------- shared meshes ----------------
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 1, 6); poleGeo.translate(0, 0.5, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a8d90 });
  const signTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const oct = (r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); };
    oct(62); g.fillStyle = '#f2f2f2'; g.fill(); oct(55); g.fillStyle = '#c4161c'; g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 38px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STOP', 64, 66);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const signGeo = new THREE.PlaneGeometry(0.75, 0.75);
  const signMat = new THREE.MeshLambertMaterial({ map: signTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const headGeo = new THREE.BoxGeometry(0.34, 0.95, 0.26); headGeo.translate(0, 0, -0.06);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x2a2b22 });
  const lampGeo = new THREE.CircleGeometry(0.11, 10);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true, toneMapped: false });
  let meshes = [];
  let stopList = [], stopP = null, stopS = null, gen = 0, footPoles = [];   // footPoles: signal + stop sign poles the cat can't walk through   // breakables: every stop sign (pole + face instance) a car can knock down
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.userData.noLift = true; m.frustumCulled = false; scene.add(m); meshes.push(m); return m; };

  const LAMP_ON = [new THREE.Color(0xff2a1a), new THREE.Color(0xffb21a), new THREE.Color(0x2aff6a)];
  const LAMP_OFF = [new THREE.Color(0x3a0c08), new THREE.Color(0x3a2a08), new THREE.Color(0x08301a)];
  let lamps = null, lampList = []; // lampList[i] = {j, ap, k (0 red,1 yellow,2 green)}

  // roads.js trim: how far the junction pad reaches along edge e at node n
  function trimAt(n, e, L) {
    const N = NODES[n], all = ADJ[n];
    if (all.length < 2) return 0;
    const ang = (q) => { const B = NODES[q.n]; return Math.atan2(B.z - N.z, B.x - N.x); };
    const aa = ang(e); let t = e.w * 0.3;
    for (const b of all) {
      if (b === e) continue;
      let phi = Math.abs(aa - ang(b)); if (phi > Math.PI) phi = 2 * Math.PI - phi;
      if (phi > 2.6) continue;
      t = Math.max(t, (b.w / 2 + e.w / 2 * Math.abs(Math.cos(phi))) / Math.max(Math.sin(phi), 0.45));
    }
    return Math.min(t, e.w * 1.6, L * 0.45);
  }
  const roadsAt = (n) => ADJ[n].filter((e) => !e.nt && !(isPath && isPath(e.t)));

  // ---------------- build from the road graph ----------------
  function build() {
    for (const m of meshes) { scene.remove(m); m.dispose(); }
    meshes = []; J = new Map(); lampList = []; stopList = []; footPoles = []; gen++;
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
    const poles = [], signs = [], heads = [], lampsM = [];
    for (let n = 0; n < NODES.length; n++) {
      const es = roadsAt(n); if (es.length < 3) continue;
      const N = NODES[n];
      // roads 2026-11-24: main roads run free, side roads stop (roadflow.js junctionControl); lights only at busy crossings
      const ctl = junctionControl(N, es.map((e) => ({ o: e.n, e })), NODES);
      if (!ctl) continue;
      const kind = ctl.kind;
      const wMax = Math.max(...es.map((e) => e.w));
      const j = { n, x: N.x, z: N.z, kind, ap: new Map(), busy: 0, r: wMax / 2 + 3, off: (n * 7.3) % CYCLE };
      // axis of the first approach defines phase 0
      let ax0 = null;
      for (const e of es) {
        const B = NODES[e.n], L = Math.hypot(B.x - N.x, B.z - N.z) || 1, dx = (B.x - N.x) / L, dz = (B.z - N.z) / L;
        const ang = Math.atan2(dx, dz);
        if (ax0 === null) ax0 = ang;
        let da = Math.abs(((ang - ax0) % Math.PI + Math.PI) % Math.PI); da = Math.min(da, Math.PI - da);
        const others = es.filter((o) => o !== e), wo = others.length ? Math.max(...others.map((o) => o.w)) : 8;
        // painted marks (roads.js): stop line centred at trim + 0.7 (0.5 m wide), crosswalk band out to trim + 3.0
        const line = Math.min(L * 0.45, trimAt(n, e, L)) + (N.cw ? 3.0 : 0.95); // far edge of the paint from the centre
        const ap = { from: e.n, phase: da < Math.PI / 4 ? 0 : 1, line, dx, dz, w: e.w, free: ctl.free.has(e.n) };
        j.ap.set(e.n, ap);
        if (ap.free) continue;   // through road: no sign, no line
        // incoming traffic travels -d; its right-hand side is (dz, -dx)
        const side = e.w / 2 + 0.9;
        const px = N.x + dx * (line + 0.3) + dz * side, pz = N.z + dz * (line + 0.3) - dx * side, h = heightAt(px, pz);
        const face = Math.atan2(dx, dz); // the sign / signal faces oncoming (incoming) traffic
        if (kind !== 'light') {
          stopList.push({ x: px, z: pz, h, face, pi: poles.length, si: signs.length, gen: gen + 0 });
          poles.push([px, h, pz, 2.1]); footPoles.push({ x: px, z: pz, st: stopList[stopList.length - 1] });
          signs.push([px, h + 2.05, pz, face]);
        } else {
          poles.push([px, h, pz, 3.2]); footPoles.push({ x: px, z: pz, st: null });
          heads.push([px, h + 2.95, pz, face]);
          for (let k = 0; k < 3; k++) { lampsM.push([px + Math.sin(face) * 0.08, h + 3.25 - k * 0.3, pz + Math.cos(face) * 0.08, face]); lampList.push({ j, ap, k }); }
        }
      }
      J.set(n, j);
    }
    const put = (mesh, list, fn) => list.forEach((r, i) => { fn(r); mesh.setMatrixAt(i, _m.compose(_p, _q, _s)); });
    const P = inst(poleGeo, poleMat, poles.length);
    put(P, poles, (r) => { _p.set(r[0], r[1], r[2]); _q.identity(); _s.set(1, r[3], 1); });
    _s.set(1, 1, 1);
    const S = inst(signGeo, signMat, signs.length);
    put(S, signs, (r) => { _p.set(r[0], r[1], r[2]); _q.setFromEuler(_e.set(0, r[3], 0)); });
    stopP = P; stopS = S;
    for (const st of stopList) { st.mp = new THREE.Matrix4(); P.getMatrixAt(st.pi, st.mp); st.ms = new THREE.Matrix4(); S.getMatrixAt(st.si, st.ms); }
    const H = inst(headGeo, headMat, heads.length);
    put(H, heads, (r) => { _p.set(r[0], r[1], r[2]); _q.setFromEuler(_e.set(0, r[3], 0)); });
    lamps = inst(lampGeo, lampMat, lampsM.length);
    put(lamps, lampsM, (r) => { _p.set(r[0], r[1], r[2]); _q.setFromEuler(_e.set(0, r[3], 0)); });
    for (let i = 0; i < lampList.length; i++) lamps.setColorAt(i, LAMP_OFF[lampList[i].k]);
    lastShown = null;
  }

  // ---------------- signal state ----------------
  // returns 0 red, 1 yellow, 2 green for an approach
  function signal(j, ap) {
    const t = ((G.time + j.off) % CYCLE + CYCLE) % CYCLE, half = GREEN + YELLOW + ALLRED;
    const mine = ap.phase === 0 ? t < half : t >= half, tt = mine ? t % half : -1;
    if (tt < 0 || tt >= GREEN + YELLOW) return 0;
    return tt < GREEN ? 2 : 1;
  }
  let lastShown = null;
  function update() {
    if (!lamps || !lampList.length) return;
    let key = '';
    for (const j of J.values()) if (j.kind === 'light') { const a = j.ap.values().next().value; key += signal(j, a) + (a.phase ? 'b' : 'a') + ','; }
    if (key === lastShown) return; // recolour only when some junction changed state
    lastShown = key;
    for (let i = 0; i < lampList.length; i++) { const L = lampList[i], s = signal(L.j, L.ap); lamps.setColorAt(i, s === L.k ? LAMP_ON[L.k] : LAMP_OFF[L.k]); }
    lamps.instanceColor.needsUpdate = true;
  }

  // ---------------- AI rule: speed cap for a traffic car on lane a = {from, to} ----------------
  function limit(c, a, want, dt) {
    if (a.sn !== a.to) { a.sn = a.to; a.go = false; a.held = 0; } // new lane: forget the last junction
    const j = J.get(a.to);
    if (!j) return want;
    const ap = j.ap.get(a.from);
    if (!ap || ap.free) return want;
    // distance to the stop line along the approach
    const along = (c.x - j.x) * ap.dx + (c.z - j.z) * ap.dz; // metres from the centre, out along the approach
    const dl = along - ap.line - c.spec.len / 2 - 0.5; // front bumper to just behind the white line
    if (a.go || dl < -0.8) { a.go = a.go || true; return want; } // already committed / past the line
    const v = Math.abs(c.speed), stopV = Math.sqrt(2 * DECEL * Math.max(0, dl - 0.15));
    if (j.kind === 'light') {
      const s = signal(j, ap);
      if (s === 2) return want;
      if (s === 1 && v * v / (2 * DECEL * 1.6) > dl) { a.go = 'yellow'; return want; } // too close to stop for the yellow: commit
      return Math.min(want, stopV);
    }
    // all-way stop: come to a full stop, wait a beat, then take your turn
    if (dl > 2.6 || v > 0.6) return Math.min(want, Math.max(stopV, dl > 2.6 ? 1.2 : 0));
    a.held += dt;
    // side road onto a main road: also wait for a gap in the through traffic
    if (j.kind === 'yield' && a.held > 0.6 && mainBusy(j, c)) return 0;
    if (a.held > 1.1 && G.time >= j.busy) { j.busy = G.time + 1.6; a.go = true; return want; }
    return 0;
  }

  function mainBusy(j, me) {
    const cars = api.carsNear ? api.carsNear(j.x, j.z, 36) : api.cars; if (!cars) return false;   // dyngrid: only the cars around the junction
    for (const o of cars) {
      if (o === me || o.dead) continue;
      const dx = j.x - o.x, dz = j.z - o.z, d = Math.hypot(dx, dz);
      if (d > 34 || d < 0.5) continue;
      const v = Math.hypot(o.vx || 0, o.vz || 0);
      if (d < j.r + 2.5 && v > 0.5) return true;                       // something is crossing right now
      if (v > 1.5 && (o.vx * dx + o.vz * dz) / (v * d) > 0.6 && d / v < 3.2) return true;   // arriving within ~3 s
    }
    return false;
  }

  /** True while the car sits in the queue for a controlled junction (so game.js doesn't creep it into the car ahead). */
  function queued(c, a) {
    const j = J.get(a.to); if (!j || a.go) return false;
    const ap = j.ap.get(a.from); if (!ap || ap.free) return false;
    const dl = (c.x - j.x) * ap.dx + (c.z - j.z) * ap.dz - ap.line - c.spec.len / 2 - 0.5;
    return dl > -0.8 && dl < 45;
  }

  build();
  if (api.onRoads) api.onRoads.push(build);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  /** breakables: knock a stop sign out (on) or stand it back up. A record from before a rebuild is ignored. */
  function hideStop(st, on) {
    if (!st || st.gen !== gen || !stopP) return false;
    st.down = !!on;
    stopP.setMatrixAt(st.pi, on ? ZERO : st.mp); stopS.setMatrixAt(st.si, on ? ZERO : st.ms);
    stopP.instanceMatrix.needsUpdate = stopS.instanceMatrix.needsUpdate = true;
    return true;
  }
  /** Keep the cat (P, radius r) out of standing signal and stop sign poles (they have no world colliders: cars hit stops via breakables). */
  function footBlock(P, r) {
    const m = 0.1 + r;
    for (const p of footPoles) {
      const dx = P.x - p.x, dz = P.z - p.z;
      if (dx > m || dx < -m || dz > m || dz < -m || (p.st && p.st.down) || P.y > 3.3) continue;
      const d = Math.hypot(dx, dz); if (d < m && d > 1e-4) { P.x = p.x + dx / d * m; P.z = p.z + dz / d * m; }
    }
  }
  const T = { footBlock, build, update, limit, queued, signal, junctions: () => J, stops: () => stopList, hideStop, stopParts: { poleGeo, poleMat, signGeo, signMat } };
  if (typeof window !== 'undefined') window.__TC = T;
  T.api = api;
  return T;
}
