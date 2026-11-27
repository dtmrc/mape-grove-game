// Ambient river otters for Maple Grove: Off Leash. They live on every water body (Lake Juniper, plus any water the
// world editor draws): swim with a vertical body wave, dive and resurface, float on their backs grooming their paws,
// haul out onto the bank to sit up, look around and scurry, and react to Goobles (look, stand up alert, chirp, bolt
// for the water and dive). A car is scarier than a cat.
//
// Performance: the whole population is ONE InstancedMesh (one draw call, ~370 tris each). All animation (swim wave,
// paddling, bounding gait, sitting up, head look, paw grooming) is done in the vertex shader from two per-instance
// vec4s, so the CPU side is a tiny state machine plus a matrix per otter. Blob shadows and water rings are two more
// instanced meshes. Nothing is allocated per frame.
//
// Wired into game.js by tools/otters-hooks.mjs. Debug: window.__OTTERS (.list, .near(x,z), .scare(), .count)
import * as THREE from 'three';
import * as TER from './terrain.js';
import { waterPolys } from './ground.js';

const MAX = 14;           // instance capacity (all water bodies together)
const RINGS = 32;         // water ring pool
const CY = 0.15;          // body centre height above the feet (roll/pitch pivot)

// ---------------- geometry: one low-poly otter, built from octagon lofts and boxes ----------------
// Local frame: +z = nose, +y = up, origin on the ground under the body. Every vertex carries aSeg (rest z, for the
// body wave) and aPart (0 body+tail, 1 head, 2/3 front legs L/R, 4/5 hind legs L/R) for the shader.
const COL = {
  back: new THREE.Color(0x4a3220), side: new THREE.Color(0x5e4029), low: new THREE.Color(0x6e4e33),
  cream: new THREE.Color(0xc8b08a), nose: new THREE.Color(0x1c1410), eye: new THREE.Color(0x0c0a0a),
  paw: new THREE.Color(0x3a2818), ear: new THREE.Color(0x3c2a1a),
};
function buildOtterGeo() {
  const pos = [], col = [], seg = [], part = [];
  const tri = (a, b, c, color, p) => {
    for (const v of [a, b, c]) { pos.push(v[0], v[1], v[2]); col.push(color.r, color.g, color.b); seg.push(v[2]); part.push(p); }
  };
  // octagon section, corners at (+-0.42, +-1) and (+-1, +-0.42) of the half sizes (npc-design-principles.md)
  const OCT = [[0.42, 1], [1, 0.42], [1, -0.42], [0.42, -1], [-0.42, -1], [-1, -0.42], [-1, 0.42], [-0.42, 1]];
  const BOX = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  // paint a face by where it points and where it sits: dark back, brown sides, pale throat/chin/chest
  const paint = (ny, z, y, o) => {
    if (o.solid) return o.solid;
    if (ny > 0.55) return COL.back;
    if (ny < -0.35) return (z > (o.creamZ ?? 0.02)) ? COL.cream : COL.low;
    if (o.cheek && y < o.cheek) return COL.cream;
    return COL.side;
  };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Vector3();
  // emit a triangle wound so its face points away from `inside` (a point inside the part); returns the outward normal y
  const outTri = (a, b, c, inside, color, p) => {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _n.crossVectors(_a, _b).normalize();
    _m.set((a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]);
    if (_n.dot(_m) < 0) { tri(a, c, b, color, p); return -_n.y; }
    tri(a, b, c, color, p); return _n.y;
  };
  const normalOutY = (a, b, c, inside) => {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _n.crossVectors(_a, _b).normalize();
    _m.set((a[0] + c[0]) / 2 - inside[0], (a[1] + c[1]) / 2 - inside[1], (a[2] + c[2]) / 2 - inside[2]);
    return _n.dot(_m) < 0 ? -_n.y : _n.y;
  };
  // rings: [{ z, y, w, h, x? }] along +z; sec: OCT or BOX; caps at both ends
  function loft(rings, sec, p, o = {}) {
    const R = rings.map((r) => sec.map(([sx, sy]) => [(r.x || 0) + sx * r.w, r.y + sy * r.h, r.z]));
    const n = sec.length;
    for (let i = 0; i < R.length - 1; i++) {
      const inside = [((rings[i].x || 0) + (rings[i + 1].x || 0)) / 2, (rings[i].y + rings[i + 1].y) / 2, (rings[i].z + rings[i + 1].z) / 2];
      for (let k = 0; k < n; k++) {
        const a = R[i][k], b = R[i][(k + 1) % n], c = R[i + 1][(k + 1) % n], d = R[i + 1][k];
        const ny = normalOutY(a, b, c, inside), color = paint(ny, (a[2] + c[2]) / 2, (a[1] + c[1]) / 2 - inside[1], o);
        outTri(a, b, c, inside, color, p); outTri(a, c, d, inside, color, p);
      }
    }
    // caps (fans)
    const mid = [0, 0, 0]; for (const r of rings) { mid[0] += (r.x || 0) / rings.length; mid[1] += r.y / rings.length; mid[2] += r.z / rings.length; }
    for (const ri of [0, R.length - 1]) {
      const ring = R[ri], c = ring.reduce((s, v) => [s[0] + v[0] / n, s[1] + v[1] / n, s[2] + v[2] / n], [0, 0, 0]);
      const color = o.capColor ? o.capColor(ri) : o.solid || COL.side;
      for (let k = 0; k < n; k++) outTri(c, ring[k], ring[(k + 1) % n], mid, color, p);
    }
  }
  // body + tail: one tapering loft from tail tip to neck
  loft([
    { z: -0.66, y: 0.10, w: 0.012, h: 0.010 },
    { z: -0.50, y: 0.11, w: 0.032, h: 0.022 },
    { z: -0.32, y: 0.13, w: 0.065, h: 0.050 },
    { z: -0.18, y: 0.15, w: 0.105, h: 0.090 },
    { z: 0.02, y: 0.16, w: 0.115, h: 0.102 },
    { z: 0.18, y: 0.165, w: 0.100, h: 0.094 },
    { z: 0.29, y: 0.185, w: 0.072, h: 0.070 },
  ], OCT, 0, { creamZ: 0.08 });
  // head: flat-topped octagon with a short blunt muzzle; pale chin and cheeks
  loft([
    { z: 0.25, y: 0.195, w: 0.068, h: 0.062 },
    { z: 0.33, y: 0.205, w: 0.085, h: 0.072 },
    { z: 0.42, y: 0.200, w: 0.074, h: 0.058 },
    { z: 0.47, y: 0.186, w: 0.052, h: 0.040 },
    { z: 0.50, y: 0.182, w: 0.040, h: 0.030 },
  ], OCT, 1, { creamZ: 0.25, cheek: -0.035, capColor: (ri) => (ri ? COL.cream : COL.side) });
  // nose, eyes, ears (small boxes on the head)
  const box = (x, y, z, w, h, d, color, p) => loft([{ x, z: z - d, y, w, h }, { x, z: z + d, y, w, h }], BOX, p, { solid: color });
  box(0, 0.198, 0.505, 0.022, 0.014, 0.008, COL.nose, 1);
  for (const s of [-1, 1]) {
    box(s * 0.058, 0.228, 0.405, 0.016, 0.013, 0.014, COL.eye, 1);
    box(s * 0.062, 0.268, 0.30, 0.022, 0.016, 0.012, COL.ear, 1);
  }
  // legs: short stubs with flat webbed paws (hind paws bigger)
  for (const [s, pf, ph] of [[-1, 2, 4], [1, 3, 5]]) {
    box(s * 0.072, 0.07, 0.17, 0.022, 0.06, 0.024, COL.paw, pf);
    box(s * 0.072, 0.012, 0.19, 0.026, 0.012, 0.04, COL.paw, pf);
    box(s * 0.088, 0.075, -0.12, 0.026, 0.065, 0.03, COL.paw, ph);
    box(s * 0.090, 0.012, -0.095, 0.036, 0.012, 0.058, COL.paw, ph);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSeg', new THREE.Float32BufferAttribute(seg, 1));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  return g;
}

// vertex shader: all the motion. iA = (phase, swim, stand, run), iB = (groom, headYaw, headRaise, idle)
const VERT_HEAD = /* glsl */`
attribute float aSeg; attribute float aPart; attribute vec4 iA; attribute vec4 iB;
uniform float uT;
vec3 rotX(vec3 p, vec2 pv, float a) { float c = cos(a), s = sin(a), y = p.y - pv.x, z = p.z - pv.y; return vec3(p.x, pv.x + y * c - z * s, pv.y + y * s + z * c); }
vec3 rotY(vec3 p, float pz, float a) { float c = cos(a), s = sin(a), z = p.z - pz; return vec3(p.x * c + z * s, p.y, pz - p.x * s + z * c); }
`;
const VERT_BODY = /* glsl */`
vec3 p = position;
float t = uT + iA.x, swim = iA.y, stand = iA.z, run = iA.w, groom = iB.x, idle = iB.w;
float s = aSeg;
if (aPart > 0.5 && aPart < 1.5) {                          // head: look around, raise / tuck
  p = rotY(p, 0.27, iB.y);
  p = rotX(p, vec2(0.19, 0.27), -iB.z);
} else if (aPart > 1.5) {                                  // legs swing about the hip / shoulder
  float front = aPart < 3.5 ? 1.0 : 0.0, side = mod(aPart, 2.0) < 0.5 ? 1.0 : -1.0;
  vec2 hip = front > 0.5 ? vec2(0.13, 0.17) : vec2(0.14, -0.12);
  float a = run * 0.85 * sin(t * 12.0 + (1.0 - front) * 2.6 + side * 0.4);           // bounding gait
  a += swim * (front > 0.5 ? 1.3 : 1.05 + 0.55 * sin(t * 7.0 + side * 1.6));          // fronts tucked, hinds kick
  a -= groom * front * (1.25 + 0.35 * sin(t * 9.0 + side * 1.7));                     // paws up to the chin
  p = rotX(p, hip, a);
}
if (aPart < 3.5) {                                          // sit / stand up: bend at the hips
  float w = smoothstep(-0.24, -0.04, position.z);
  p = rotX(p, vec2(0.14, -0.12), -stand * 1.15 * w);
}
// swimming: a vertical wave runs down the spine, strongest in the tail
p.y += swim * 0.032 * sin(t * 6.5 - s * 7.0) * (0.35 + smoothstep(0.2, -0.6, s));
// bounding: the back humps up and down
p.y += run * 0.05 * (0.5 + 0.5 * sin(t * 12.0 + 1.2)) * (1.0 - min(1.0, abs(s - 0.0) * 1.6));
// idle: a lazy tail sway and breathing
p.x += idle * 0.035 * sin(t * 1.7) * smoothstep(-0.28, -0.62, s);
p.y += idle * 0.004 * sin(t * 2.3) * step(-0.2, s) * step(s, 0.3);
vec3 transformed = p;
`;

function makeMaterial(uT) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x120c08 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', VERT_BODY);
  };
  m.customProgramCacheKey = () => 'otter-v1';
  return m;
}

function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 18, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------- helpers ----------------
function inPoly(P, x, z) { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }
/** distance to the nearest polygon edge, plus that nearest point (into out) */
function edgeDist(P, x, z, out) {
  let best = 1e9;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, az] = P[j], [bx, bz] = P[i], ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L)), qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(x - qx, z - qz);
    if (d < best) { best = d; if (out) { out[0] = qx; out[1] = qz; } }
  }
  return best;
}
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
let seed = 7331;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function makeOtters({ scene, G, P, T, Sfx, blocked, places = {}, px, pz, inside = () => false, camera }) {
  const uT = { value: 0 };
  const geo = buildOtterGeo();
  const iA = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4), iB = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  iA.setUsage(THREE.DynamicDrawUsage); iB.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iA', iA); geo.setAttribute('iB', iB);
  const mesh = new THREE.InstancedMesh(geo, makeMaterial(uT), MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.noLift = true; mesh.count = 0; mesh.name = 'otters';
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.8);
  scene.add(mesh);
  // blob shadows on land
  const shG = new THREE.PlaneGeometry(0.5, 1.05).rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(shG, new THREE.MeshBasicMaterial({ map: T && T.shadow, transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -4 }), MAX);
  shadows.userData.noLift = true; shadows.count = 0; shadows.renderOrder = 1; shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(shadows);
  // water rings (additive: fading = scaling the instance colour to black)
  const rgG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(rgG, new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }), RINGS);
  rings.userData.noLift = true; rings.count = RINGS; rings.renderOrder = 2; rings.frustumCulled = false;
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const ringS = [];   // { x, y, z, t, life, r0, r1, a }
  const _m = new THREE.Matrix4(), _c = new THREE.Color(0, 0, 0);
  for (let i = 0; i < RINGS; i++) { ringS.push({ t: 9, life: 1 }); _m.makeScale(0, 0, 0); rings.setMatrixAt(i, _m); rings.setColorAt(i, _c); }
  scene.add(rings);
  let ringNext = 0;
  function ring(x, y, z, r0 = 0.25, r1 = 1.1, life = 1.4, a = 0.32) {
    const R = ringS[ringNext]; ringNext = (ringNext + 1) % RINGS;
    Object.assign(R, { x, y: y + 0.07, z, t: 0, life, r0, r1, a });
  }

  // ---------------- water bodies: polygon, surface height, swim spots, dens on the bank ----------------
  let bodies = [], sig = '', checkT = 0;
  const near = [0, 0];
  function waterLevel(poly) {   // same rule as ground.js: the lowest shore point, + its surface offset
    let y = 1e9;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      for (let t = 0; t < 1; t += 0.25) y = Math.min(y, TER.heightAt(ax + (bx - ax) * t, az + (bz - az) * t));
    }
    return y + 0.06;
  }
  // wet = inside the water polygon AND the ground there is below the surface (shallow sand can poke through)
  const wet = (b, x, z, depth = 0) => inPoly(b.poly, x, z) && TER.heightAt(x, z) < b.y - depth;
  function anyWater(x, z) { for (const b of bodies) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && inPoly(b.poly, x, z)) return b; return null; }
  function avoid(x, z) {   // places otters should not haul out: the dock, the firepit, the bait shack
    for (const q of [places.dock, { x: -20, z: 70 }, { x: -28, z: 60.5 }, { x: -72, z: 60 }]) if (q && Math.hypot(x - q.x, z - q.z) < 7) return true;
    return false;
  }
  function rebuild() {
    const polys = waterPolys();
    const s = polys.map(({ q }) => [q.cx, q.cz, q.rot, q.pts.length, q.pts[0]].join(',')).join('#');
    if (s === sig) return false;
    sig = s; bodies = [];
    for (const { q } of polys) {
      const E = TER.polyEngine(q), poly = E.poly; if (poly.length < 3) continue;
      let area = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]);
      area = Math.abs(area) / 2;
      if (area < 40) continue;   // a puddle is no home
      bodies.push({ poly, x0: E.x0, x1: E.x1, z0: E.z0, z1: E.z1, area, y: waterLevel(poly), dens: [] });
    }
    // dens: bank spots 1.4 m outside the shore, flat, dry, unblocked; then the most spread-out few
    for (const b of bodies) {
      const cand = [], P = b.poly;
      let cx = 0, cz = 0; for (const [x, z] of P) { cx += x / P.length; cz += z / P.length; }
      for (let i = 0; i < P.length; i++) {
        const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az);
        for (let d = 1; d < L; d += 3) {
          const x = ax + (bx - ax) * d / L, z = az + (bz - az) * d / L;
          let nx = (bz - az) / L, nz = -(bx - ax) / L;   // outward normal: whichever side is not water
          if (inPoly(P, x + nx * 0.8, z + nz * 0.8)) { nx = -nx; nz = -nz; }
          const ex = x + nx * 1.6, ez = z + nz * 1.6;
          if (anyWater(ex, ez) || avoid(ex, ez)) continue;
          let wx = 0, wz = 0, ok = false;   // swim-in point: walk inward until the water is deep enough
          for (let s = 1.4; s < 9 && !ok; s += 0.6) { wx = x - nx * s; wz = z - nz * s; ok = wet(b, wx, wz, 0.02) && wet(b, wx - nx, wz - nz, 0.02); }
          if (!ok) continue;
          const h = TER.heightAt(ex, ez), [sx, sz] = TER.slopeAt(ex, ez);
          if (Math.hypot(sx, sz) > 0.35 || h > b.y + 0.9) continue;
          if (blocked && (blocked(ex, 0.3, ez) || blocked(ex + nx * 0.8, 0.3, ez + nz * 0.8))) continue;
          cand.push({ x: ex, z: ez, wx, wz, yaw: Math.atan2(-nx, -nz) });
        }
      }
      const nDen = Math.max(1, Math.min(3, Math.round(b.area / 450)));
      if (cand.length) {
        b.dens.push(cand[Math.floor(cand.length * 0.37)]);
        while (b.dens.length < nDen && b.dens.length < cand.length) {
          let best = null, bd = -1;
          for (const c of cand) { let d = 1e9; for (const e of b.dens) d = Math.min(d, Math.hypot(c.x - e.x, c.z - e.z)); if (d > bd) { bd = d; best = c; } }
          b.dens.push(best);
        }
      }
    }
    return true;
  }
  function swimSpot(b, nearX, nearZ, r = 12) {
    for (let k = 0; k < 24; k++) {
      const x = nearX !== undefined ? nearX + (rnd() - 0.5) * 2 * r : b.x0 + rnd() * (b.x1 - b.x0);
      const z = nearZ !== undefined ? nearZ + (rnd() - 0.5) * 2 * r : b.z0 + rnd() * (b.z1 - b.z0);
      if (wet(b, x, z, 0.02) && edgeDist(b.poly, x, z) > 1.6) return [x, z];
    }
    return [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
  }

  // ---------------- the otters ----------------
  const list = [];
  function populate() {
    list.length = 0;
    for (const b of bodies) {
      const per = b.dens.length ? Math.max(1, Math.min(3, Math.round(b.area / 260 / b.dens.length) + 1)) : 1;
      for (let d = 0; d < Math.max(1, b.dens.length); d++) {
        const den = b.dens[d] || null;
        for (let k = 0; k < per && list.length < MAX; k++) {
          const [x, z] = den && k === 0 ? [den.x + (rnd() - 0.5), den.z + (rnd() - 0.5)] : swimSpot(b, den?.wx, den?.wz, 8);
          const o = {
            b, den, x, z, y: den && k === 0 ? TER.heightAt(x, z) : b.y - CY, yaw: rnd() * 6.28, vy: 0,
            state: den && k === 0 ? 'bank' : 'swim', t: 2 + rnd() * 6, tx: x, tz: z, spd: 0,
            phase: rnd() * 50, swim: 0, stand: 0, run: 0, groom: 0, roll: 0, pitch: 0, hy: 0, hr: 0, depth: 0,
            alert: 0, scared: 0, look: 0, chirpT: 0, ringT: rnd(), size: 0.9 + rnd() * 0.22, land: !!(den && k === 0), bankPose: 'sit',
          };
          if (o.state === 'swim') [o.tx, o.tz] = swimSpot(b, x, z, 10);
          list.push(o);
        }
      }
    }
    mesh.count = shadows.count = list.length;
  }

  function setState(o, s, t) { o.state = s; o.t = t; }
  function pickNext(o) {
    const r = rnd(), b = o.b;
    if (o.den && r < 0.22) { setState(o, 'toBank', 30); o.tx = o.den.wx; o.tz = o.den.wz; return; }
    if (r < 0.45) { setState(o, 'float', 6 + rnd() * 10); return; }
    if (r < 0.6) { setState(o, 'dive', 2.5 + rnd() * 3); [o.tx, o.tz] = swimSpot(b, o.x, o.z, 9); ring(o.x, b.y, o.z, 0.3, 1.4, 1.2, 0.45); return; }
    setState(o, 'swim', 25); [o.tx, o.tz] = swimSpot(b, o.den ? o.den.wx : o.x, o.den ? o.den.wz : o.z, 14);
  }

  let lastChirp = -9, scareAll = 0;
  function chirp(o, d) {
    const t = G.time || 0;
    if (d > 14 || t - lastChirp < 0.7 || !Sfx || !Sfx.meow) return;
    lastChirp = t;
    try { Sfx.meow('hup', 2.3 + rnd() * 0.3); Sfx.meow('hup', 2.6 + rnd() * 0.3, 0.11); } catch (e) { /* audio off */ }
  }

  function stepOtter(o, dt, pX, pZ, threat, alertR, pSpd) {
    const b = o.b, dx = pX - o.x, dz = pZ - o.z, d = Math.hypot(dx, dz);
    o.land = !wet(b, o.x, o.z, 0);
    // ---- reactions to Goobles ----
    const scary = d < threat || scareAll > 0;
    if (scary && o.state !== 'flee' && o.state !== 'dive' && o.state !== 'fleeDive') {
      if (o.land) { setState(o, 'flee', 6); o.tx = o.den ? o.den.wx : o.x - dx / d * 3; o.tz = o.den ? o.den.wz : o.z - dz / d * 3; edgeFix(o); }
      else { setState(o, 'fleeDive', 3 + rnd() * 2); const k = 10 / Math.max(d, 0.1); [o.tx, o.tz] = swimSpot(b, o.x - dx * k, o.z - dz * k, 5); ring(o.x, b.y, o.z, 0.35, 1.6, 1.3, 0.55); }
      chirp(o, d); o.scared = 4;
      if (d < 12 && Sfx && Sfx.splash && !o.land) try { Sfx.splash(); } catch (e) { /* */ }
    }
    o.scared = Math.max(0, o.scared - dt);
    const curious = d < alertR && !scary && o.scared <= 0;
    o.alert = damp(o.alert, curious ? 1 : 0, 3, dt);
    if (curious && (o.chirpT -= dt) <= 0) { o.chirpT = 5 + rnd() * 8; if (rnd() < 0.5) chirp(o, d); }
    // ---- states ----
    let spd = 0, swim = 0, stand = 0, run = 0, groom = 0, roll = 0, depth = 0, pitch = 0, idle = 0;
    o.t -= dt;
    switch (o.state) {
      case 'swim': {
        spd = 1.25; swim = 1;
        if (curious && pSpd < 0.5) { spd = 0.2; stand = 0.75; }                 // periscope: head up out of the water, watching
        if (Math.hypot(o.tx - o.x, o.tz - o.z) < 0.8 || o.t <= 0) pickNext(o);
        break;
      }
      case 'dive': case 'fleeDive': {
        spd = o.state === 'fleeDive' ? 2.6 : 1.7; swim = 1; depth = 0.75; pitch = 0.1;
        if (o.t <= 0) { ring(o.x, b.y, o.z, 0.25, 1.2, 1.3, 0.45); setState(o, 'swim', 20); [o.tx, o.tz] = swimSpot(b, o.x, o.z, 12); }
        break;
      }
      case 'float': {
        spd = 0.12; roll = Math.PI; groom = 1; swim = 0.15; idle = 1;
        if (curious) { groom = 0.3; }
        if (o.t <= 0) { setState(o, 'swim', 20); [o.tx, o.tz] = swimSpot(b, o.x, o.z, 12); }
        break;
      }
      case 'toBank': {
        spd = 1.3; swim = 1;
        if (Math.hypot(o.tx - o.x, o.tz - o.z) < 0.7) { setState(o, 'climb', 6); o.tx = o.den.x + (rnd() - 0.5) * 1.6; o.tz = o.den.z + (rnd() - 0.5) * 1.6; ring(o.x, b.y, o.z, 0.3, 1.3, 1.2, 0.4); }
        if (o.t <= 0) pickNext(o);
        break;
      }
      case 'climb': {
        spd = 1.2; run = o.land ? 0.8 : 0; swim = o.land ? 0 : 1;
        if (Math.hypot(o.tx - o.x, o.tz - o.z) < 0.4 || o.t <= 0) { setState(o, 'bank', 8 + rnd() * 12); o.bankPose = rnd() < 0.5 ? 'sit' : 'lie'; }
        break;
      }
      case 'bank': {
        idle = 1;
        stand = o.bankPose === 'sit' ? 0.45 : 0;
        groom = o.bankPose === 'sit' && !curious ? 0.5 + 0.5 * Math.sin(G.time * 0.7 + o.phase) : 0;
        if (curious) { stand = 1; groom = 0; }
        if (o.t <= 0) {
          const r = rnd();
          if (r < 0.3) { o.bankPose = o.bankPose === 'sit' ? 'lie' : 'sit'; o.t = 5 + rnd() * 8; }
          else if (r < 0.55) { setState(o, 'scurry', 4); const a = rnd() * 6.28; o.tx = o.den.x + Math.cos(a) * 1.5; o.tz = o.den.z + Math.sin(a) * 1.5; }
          else { setState(o, 'slide', 8); o.tx = o.den.wx; o.tz = o.den.wz; }
        }
        break;
      }
      case 'scurry': {
        spd = 1.6; run = 1;
        if (Math.hypot(o.tx - o.x, o.tz - o.z) < 0.35 || o.t <= 0) { setState(o, 'bank', 4 + rnd() * 6); o.bankPose = 'sit'; }
        break;
      }
      case 'slide': case 'flee': {
        spd = o.state === 'flee' ? 3.6 : 1.8; run = o.land ? 1 : 0; swim = o.land ? 0 : 1;
        if (!o.land) {   // hit the water: dive under and swim off
          ring(o.x, b.y, o.z, 0.35, 1.7, 1.4, 0.6);
          if (o.state === 'flee') { setState(o, 'fleeDive', 3 + rnd() * 2); const k = 10 / Math.max(d, 0.1); [o.tx, o.tz] = swimSpot(b, o.x - dx * k, o.z - dz * k, 5); }
          else { setState(o, 'swim', 20); [o.tx, o.tz] = swimSpot(b, o.x, o.z, 12); }
        } else if (o.t <= 0 || Math.hypot(o.tx - o.x, o.tz - o.z) < 0.3) { o.tx = o.den ? o.den.wx - (o.den.x - o.den.wx) * 0.5 : o.tx; o.tz = o.den ? o.den.wz - (o.den.z - o.den.wz) * 0.5 : o.tz; o.t = 4; }
        break;
      }
    }
    // ---- move ----
    if (spd > 0) {
      const tx = o.tx - o.x, tz = o.tz - o.z, L = Math.hypot(tx, tz);
      if (L > 0.05) {
        const want = Math.atan2(tx, tz), turn = (o.land ? 5 : 2.6) * dt;
        const dy = wrap(want - o.yaw); o.yaw += Math.max(-turn, Math.min(turn, dy));
        const go = spd * Math.max(0, Math.cos(dy)) * dt * (o.state === 'float' ? 1 : 1);
        const nx = o.x + Math.sin(o.yaw) * go, nz = o.z + Math.cos(o.yaw) * go;
        const waterState = o.state === 'swim' || o.state === 'dive' || o.state === 'fleeDive' || o.state === 'float' || o.state === 'toBank';
        if (waterState && !wet(b, nx, nz, 0.01)) {   // ran into the shore, a sandbar or the dock notch: pick another way
          [o.tx, o.tz] = swimSpot(b, o.x, o.z, 8); o.yaw += Math.PI * 0.5;
        } else if (!waterState && o.land && blocked && blocked(nx, 0.3, nz)) {
          o.tx = o.x - (o.tx - o.x); o.tz = o.z - (o.tz - o.z);
        } else { o.x = nx; o.z = nz; }
      }
    }
    if (o.state === 'float') o.yaw += Math.sin(G.time * 0.21 + o.phase) * 0.12 * dt;   // slow spin while drifting
    // ---- blend the pose ----
    const k = 6;
    o.swim = damp(o.swim, swim, k, dt); o.stand = damp(o.stand, stand, 4, dt); o.run = damp(o.run, run, 8, dt);
    o.groom = damp(o.groom, groom, 3, dt); o.roll = damp(o.roll, roll, 2.2, dt); o.depth = damp(o.depth, depth, 2.5, dt);
    o.pitch = damp(o.pitch, pitch, 3, dt); o.idle = damp(o.idle || 0, idle, 2, dt);
    // head: look at Goobles when curious (not on its back)
    const rel = wrap(Math.atan2(dx, dz) - o.yaw);
    o.hy = damp(o.hy, o.alert > 0.3 && o.roll < 1 ? Math.max(-1.1, Math.min(1.1, rel)) : Math.sin(G.time * 0.4 + o.phase) * 0.35 * o.idle, 5, dt);
    o.hr = damp(o.hr, -o.stand * 0.85 - (o.roll / Math.PI) * 0.7, 4, dt);
    // height: on land follow the ground; in water hold at the surface (floaters ride higher, divers go under)
    const ground = TER.heightAt(o.x, o.z);
    const floatK = o.roll / Math.PI;
    const wy = b.y - CY - 0.02 + floatK * 0.05 - o.depth + Math.sin(G.time * 1.6 + o.phase) * 0.015 * (1 - o.depth);
    const ty = o.land ? ground : wy;   // the lake bed is hidden under the opaque surface, so ignore it
    o.y = damp(o.y, ty, o.land ? 14 : 5, dt);
    // rings: a V-wake while swimming at the surface, a lazy ring while floating
    if (!o.land && o.depth < 0.3 && (o.ringT -= dt) <= 0) {
      if (o.state === 'float') { o.ringT = 2.2 + rnd(); ring(o.x, b.y, o.z, 0.3, 0.9, 2, 0.18); }
      else if (spd > 0.5) { o.ringT = 0.45; ring(o.x - Math.sin(o.yaw) * 0.25, b.y, o.z - Math.cos(o.yaw) * 0.25, 0.2, 0.8, 1.1, 0.22); }
      else o.ringT = 0.5;
    }
  }
  function edgeFix(o) { if (!inPoly(o.b.poly, o.tx, o.tz)) { edgeDist(o.b.poly, o.tx, o.tz, near); const ax = near[0] - o.x, az = near[1] - o.z, L = Math.hypot(ax, az) || 1; o.tx = near[0] + ax / L * 1.4; o.tz = near[1] + az / L * 1.4; } }

  // ---------------- per frame ----------------
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m2 = new THREE.Matrix4(), _o = new THREE.Matrix4();
  const off = new THREE.Matrix4().makeTranslation(0, CY, 0), offInv = new THREE.Matrix4().makeTranslation(0, -CY, 0);
  let built = false, lastPX = 0, lastPZ = 0;
  function update(dt) {
    if (!dt || G.paused) return;
    if (!built || (checkT -= dt) <= 0) {   // editor water changes: re-scan every 2 s (cheap signature check)
      checkT = 2;
      if (rebuild() || !built) { populate(); built = true; }
    }
    const hide = inside();
    mesh.visible = shadows.visible = rings.visible = !hide && list.length > 0;
    if (!mesh.visible) return;
    uT.value += dt;
    const pX = px ? px() : P.x, pZ = pz ? pz() : P.z;
    const pSpd = Math.hypot(pX - lastPX, pZ - lastPZ) / dt; lastPX = pX; lastPZ = pZ;
    const threat = api.calm ? -1 : P.car ? 11 : pSpd > 4.5 ? 6.5 : 4.2, alertR = api.calm ? -1 : P.car ? 18 : 10.5;
    scareAll = Math.max(0, scareAll - dt);
    const cx = camera ? camera.position.x : pX, cz = camera ? camera.position.z : pZ;
    let anyNear = false;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      stepOtter(o, Math.min(dt, 0.1), pX, pZ, threat, alertR, pSpd);
      const far = Math.hypot(o.x - cx, o.z - cz) > 175; if (!far) anyNear = true;
      // instance matrix: T(pos) R_y(yaw) [about the body centre: R_x(pitch) R_z(roll)] scale
      _e.set(o.pitch, o.yaw, 0); _q.setFromEuler(_e);
      _m2.compose(_p.set(o.x, o.y, o.z), _q, _s.set(o.size, o.size, o.size));
      _o.makeRotationZ(o.roll); _m2.multiply(off).multiply(_o).multiply(offInv);
      if (far) _m2.makeScale(0, 0, 0);
      mesh.setMatrixAt(i, _m2);
      iA.setXYZW(i, o.phase, o.swim, o.stand, o.run); iB.setXYZW(i, o.groom, o.hy, o.hr, o.idle);
      // shadow only when standing on dry ground
      const sh = o.land && !far ? o.size : 0;
      _e.set(0, o.yaw, 0); _q.setFromEuler(_e); _m2.compose(_p.set(o.x, TER.heightAt(o.x, o.z) + 0.03, o.z), _q, _s.set(sh, 1, sh * (1 - o.stand * 0.4)));
      shadows.setMatrixAt(i, _m2);
    }
    mesh.instanceMatrix.needsUpdate = shadows.instanceMatrix.needsUpdate = true; iA.needsUpdate = iB.needsUpdate = true;
    mesh.visible = shadows.visible = anyNear;
    mesh.computeBoundingSphere(); shadows.computeBoundingSphere();   // 14 instances: cheaper than a stale cull
    // rings
    for (let i = 0; i < RINGS; i++) {
      const R = ringS[i];
      if (R.t >= R.life) { if (R.t < 99) { R.t = 99; _m2.makeScale(0, 0, 0); rings.setMatrixAt(i, _m2); } continue; }
      R.t += dt; const k = Math.min(1, R.t / R.life), r = R.r0 + (R.r1 - R.r0) * Math.sqrt(k);
      _m2.makeScale(r * 2, 1, r * 2).setPosition(R.x, R.y, R.z); rings.setMatrixAt(i, _m2);
      const a = R.a * (1 - k) * (1 - k); _c.setRGB(a * 0.75, a * 0.85, a); rings.setColorAt(i, _c);
    }
    rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
  }

  const api = {
    update, list, mesh, calm: false,   // calm: ignore Goobles (photo mode / tests)
    get count() { return list.length; },
    get bodies() { return bodies; },
    near(x, z) { let best = null, bd = 1e9; for (const o of list) { const d = Math.hypot(o.x - x, o.z - z); if (d < bd) { bd = d; best = o; } } return best; },
    scare(t = 3) { scareAll = t; },
    rebuild() { sig = ''; built = false; },
    heightAt: TER.heightAt,
  };
  window.__OTTERS = api;
  return api;
}
