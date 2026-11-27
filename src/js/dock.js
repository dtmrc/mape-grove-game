// Lake Juniper dock + rowboat (2026-11-27 remodel). Same footprint, floor and colliders as before (fishing, otters and
// the walk-on floor depend on them): x = dx +-1.2, z = dz0..dz1, deck top 0.35.
// Static parts go through world.js addS (merged into the per-chunk wood/metal/plain meshes, so no new draw calls);
// the rowboat is one vertex-coloured mesh that bobs (it replaced the old half-cylinder, same single draw call).
import * as THREE from 'three';

export function buildDock(K, dx, dz0, dz1) {
  const { addS, boxUV, lights, halos, scene, animated } = K;
  let sd = 977; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); // own sequence: the town's shared rnd() must not shift
  const L = dz1 - dz0, W = 2.4, TOP = 0.35, zEnd = dz0 + 2 + Math.floor((dz1 - dz0 - 2) / 3) * 3;   // last piling row
  const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
  // ---- deck: separate weathered planks with gaps, laid across the dock ----
  const PL = 0.3, GAP = 0.035;
  for (let z = dz0 + 0.02; z < dz1 - 0.05; z += PL) {
    const d = Math.min(PL - GAP, dz1 - z - 0.02), k = 0.78 + rnd() * 0.3, w = W - rnd() * 0.08;
    addS(boxUV(w, 0.06, d, 0.5), 'wood', shade(0xcbb08c, k), dx + (rnd() - 0.5) * 0.05, TOP - 0.03 - rnd() * 0.012, z + d / 2);
  }
  // fascia boards along both edges hide the plank ends
  for (const s of [-1, 1]) addS(boxUV(0.05, 0.16, L, 0.5), 'wood', 0x8a6e52, dx + s * (W / 2 + 0.02), TOP - 0.08, (dz0 + dz1) / 2);
  // ---- frame: two stringers + cross headers under the deck ----
  for (const s of [-1, 1]) addS(boxUV(0.12, 0.2, L, 0.5), 'wood', 0x5e4836, dx + s * 0.85, TOP - 0.16, (dz0 + dz1) / 2);
  // ---- pilings every 3 m (with a dark wet band at the waterline), taller at the far end as mooring posts ----
  for (let z = dz0 + 2; z <= dz1 + 0.01; z += 3) for (const s of [-1, 1]) {
    const end = z > dz1 - 1.5, h = end ? 1.45 : 0.62, x = dx + s * 1.28;
    addS(new THREE.CylinderGeometry(0.13, 0.15, 1.3, 7), 'wood', 0x3e3226, x, -0.55, z);                // under water / wet
    addS(new THREE.CylinderGeometry(0.13, 0.13, h, 7), 'wood', shade(0x8a7060, 0.9 + rnd() * 0.2), x, 0.1 + h / 2, z);
    addS(new THREE.CylinderGeometry(0.15, 0.13, 0.05, 7), 'wood', 0x6a5444, x, 0.1 + h, z);           // cap
    addS(boxUV(0.3, 0.14, 0.26, 0.5), 'wood', 0x5e4836, dx + s * 1.1, TOP - 0.16, z);                 // header end
  }
  for (let z = dz0 + 2; z <= dz1 + 0.01; z += 3) addS(boxUV(W, 0.14, 0.16, 0.5), 'wood', 0x5e4836, dx, TOP - 0.19, z);
  // ---- shore abutment: a low concrete footing where the dock meets the sand ----
  addS(boxUV(W + 0.3, 0.36, 0.5, 0.5), 'plain', 0x8a877e, dx, -0.06, dz0 + 0.1);
  // ---- low rail on both sides (matches the rail colliders), open at the shore end ----
  for (const s of [-1, 1]) {
    const x = dx + s * 1.3;
    for (let z = dz0 + 4; z <= dz1 - 0.1; z += 2.4) addS(boxUV(0.09, 0.62, 0.09, 0.5), 'wood', 0xa08668, x, TOP + 0.31, z);
    addS(boxUV(0.1, 0.06, dz1 - dz0 - 4, 0.5), 'wood', 0xb89a78, x, TOP + 0.64, (dz0 + 4 + dz1) / 2);
    addS(boxUV(0.05, 0.05, dz1 - dz0 - 4, 0.5), 'wood', 0x8a7058, x, TOP + 0.34, (dz0 + 4 + dz1) / 2);
  }
  addS(boxUV(W + 0.2, 0.06, 0.1, 0.5), 'wood', 0xb89a78, dx, TOP + 0.64, dz1 - 0.05);
  // ---- ladder down into the water at the end, west side ----
  {
    const x = dx - 1.42, z = dz1 - 1.3;
    for (const o of [-0.22, 0.22]) {
      addS(new THREE.CylinderGeometry(0.03, 0.03, 1.75, 6), 'metal', 0xc8ccd0, x, -0.12, z + o);
    }
    for (let y = -0.6; y <= 0.2; y += 0.28) addS(new THREE.CylinderGeometry(0.025, 0.025, 0.44, 5).rotateX(Math.PI / 2), 'metal', 0xa8acb0, x, y, z);
  }
  // ---- cleats where the boat ties up, east side ----
  for (const z of [dz1 - 8.5, dz1 - 4.5]) {
    addS(boxUV(0.1, 0.06, 0.34, 0.5), 'metal', 0x50545a, dx + 1.0, TOP + 0.05, z);
    addS(boxUV(0.08, 0.08, 0.08, 0.5), 'metal', 0x50545a, dx + 1.0, TOP + 0.02, z);
  }
  // ---- life ring on the end post (east), red and white quarters ----
  {
    const x = dx + 1.28 + 0.2, z = zEnd;
    for (let q = 0; q < 4; q++) {
      const t = new THREE.TorusGeometry(0.28, 0.07, 6, 6, Math.PI / 2); t.rotateZ(q * Math.PI / 2); t.rotateY(Math.PI / 2);
      addS(t, 'plain', q % 2 ? 0xf2efe6 : 0xd8322a, x, 0.95, z);
    }
  }
  // ---- end lantern: a short post with a lamp that lights the end of the dock (and reflects in the lake) ----
  {
    const x = dx - 1.28, z = zEnd;
    addS(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), 'metal', 0x2a2c30, x, 2.05, z);
    addS(boxUV(0.26, 0.06, 0.26, 0.5), 'metal', 0x2a2c30, x, 2.58, z);
    addS(boxUV(0.18, 0.26, 0.18, 0.5), 'lamp', 0xffffff, x, 2.42, z);
    addS(new THREE.ConeGeometry(0.2, 0.16, 4).rotateY(Math.PI / 4), 'metal', 0x2a2c30, x, 2.68, z);
    lights.push({ x, y: 2.3, z, c: 0xffc27a, i: 0.8 });
    halos.push({ x, y: 2.42, z, s: 1.6, c: 0xffb060 });
  }
  // ---- props: a bait bucket, a tackle box and a folding stool at the fishing spot ----
  addS(new THREE.CylinderGeometry(0.17, 0.14, 0.34, 8), 'plain', 0xe8e0c8, dx + 0.55, TOP + 0.17, dz1 - 2.2);
  addS(new THREE.TorusGeometry(0.15, 0.012, 3, 8, Math.PI).rotateY(0.6), 'metal', 0x9a9ea4, dx + 0.55, TOP + 0.34, dz1 - 2.2);
  addS(boxUV(0.42, 0.2, 0.24, 0.5), 'plain', 0x2a6a3a, dx + 0.6, TOP + 0.1, dz1 - 2.75, 0.3);
  addS(boxUV(0.12, 0.04, 0.08, 0.5), 'metal', 0x303030, dx + 0.6, TOP + 0.22, dz1 - 2.75, 0.3);
  addS(boxUV(0.34, 0.04, 0.3, 0.5), 'plain', 0x2a4a7a, dx - 0.6, TOP + 0.4, dz1 - 1.9);
  for (const s of [-1, 1]) addS(boxUV(0.03, 0.42, 0.03, 0.5).rotateX(s * 0.35), 'metal', 0x808488, dx - 0.6, TOP + 0.2, dz1 - 1.9);
  // ---- rowboat ----
  const boat = makeRowboat();
  boat.position.set(dx + 2.5, 0.3, dz1 - 6.5); boat.rotation.y = 0.06; scene.add(boat);
  // mooring line from the cleat to the bow
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 4), new THREE.MeshLambertMaterial({ color: 0xc8b88a }));
  scene.add(rope);
  const _a = new THREE.Vector3(dx + 1.0, TOP + 0.08, dz1 - 4.5), _b = new THREE.Vector3(), _m = new THREE.Vector3();
  animated.push({ obj: boat, fn: (t) => {
    boat.position.y = 0.22 + Math.sin(t * 1.3) * 0.045; boat.rotation.z = Math.sin(t * 0.9) * 0.045; boat.rotation.x = Math.sin(t * 0.7 + 1) * 0.02;
    _b.set(0, 0.42, 1.55).applyEuler(boat.rotation).add(boat.position);
    _m.addVectors(_a, _b).multiplyScalar(0.5); _m.y -= 0.06; rope.position.copy(_m);
    rope.scale.set(1, _a.distanceTo(_b), 1); rope.lookAt(_b); rope.rotateX(Math.PI / 2);
  } });
  return boat;
}

/** A small wooden rowboat: painted outside with a white gunwale stripe, bare wood inside, two thwarts and a pair of oars. */
function makeRowboat() {
  const LEN = 3.6, SEG = 12, pos = [], col = [];
  const paint = new THREE.Color(0x2f6a8a), stripe = new THREE.Color(0xf0ece0), inside = new THREE.Color(0xb08a60), keel = new THREE.Color(0x6a3020);
  // cross-section at t (0 = stern, 1 = bow): half-width, depth
  const sec = (t) => {
    const bow = Math.max(0, (t - 0.55) / 0.45), stern = Math.max(0, (0.12 - t) / 0.12);
    const w = 0.72 * (1 - bow * bow * 0.96) * (1 - stern * 0.25), d = 0.46 * (1 - bow * 0.35);
    return { w, d, y: bow * bow * 0.22 };   // sheer rises at the bow
  };
  const ring = (t) => {
    const { w, d, y } = sec(t), z = (t - 0.5) * LEN;
    return [[-w, 0.5 + y, z], [-w * 0.985, 0.42 + y * 0.9, z], [-w * 0.92, 0.18 + y * 0.5, z], [-w * 0.55, -d + 0.42, z], [0, -d + 0.38, z], [w * 0.55, -d + 0.42, z], [w * 0.92, 0.18 + y * 0.5, z], [w * 0.985, 0.42 + y * 0.9, z], [w, 0.5 + y, z]];
  };
  const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(k.r, k.g, k.b); };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  const lift = (p, dy, s = 1) => [p[0] * s, p[1] + dy, p[2]];
  for (let i = 0; i < SEG; i++) {
    const A = ring(i / SEG), B = ring((i + 1) / SEG);
    for (let j = 0; j < 8; j++) {
      const k = j === 0 || j === 7 ? stripe : j === 3 || j === 4 ? keel : paint;
      quad(A[j], B[j], B[j + 1], A[j + 1], k);                                                     // outside
      quad(lift(A[j + 1], 0.04, 0.9), lift(B[j + 1], 0.04, 0.9), lift(B[j], 0.04, 0.9), lift(A[j], 0.04, 0.9), inside); // inside skin
    }
  }
  // transom (flat stern)
  const S = ring(0); for (let j = 1; j < 8; j++) tri(S[0], S[j], S[j + 1], paint);
  // thwarts (seats) and oars
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const parts = [g];
  const box = (w, h, d, x, y, z, c, ry = 0, rz = 0) => {
    const b = new THREE.BoxGeometry(w, h, d).toNonIndexed(); b.rotateZ(rz); b.rotateY(ry); b.translate(x, y, z);
    const k = new THREE.Color(c), n = b.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([k.r, k.g, k.b], i * 3);
    b.setAttribute('color', new THREE.BufferAttribute(a, 3)); b.deleteAttribute('uv'); parts.push(b);
  };
  box(1.3, 0.05, 0.28, 0, 0.36, -0.3, 0xc09a6a); box(1.05, 0.05, 0.26, 0, 0.38, 0.75, 0xc09a6a); box(0.9, 0.05, 0.3, 0, 0.4, -1.45, 0xc09a6a);
  for (const s of [-1, 1]) { box(0.06, 0.06, 2.4, s * 0.32, 0.46, 0.1, 0xd2b48a, s * 0.08); box(0.16, 0.02, 0.5, s * 0.36, 0.47, -0.95, 0xd2b48a, s * 0.08); }
  const geo = mergeAll(parts);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  return m;
}
function mergeAll(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(P, 3)); G.setAttribute('normal', new THREE.BufferAttribute(N, 3)); G.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return G;
}
