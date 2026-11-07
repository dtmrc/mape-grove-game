// Engine: road network geometry, rebuilt from the road graph (world.js NODES / ADJ / EDGES) whenever it changes.
// Roads are draped on the terrain. Edge types: paved (town / county roads), dirt (tracks), hwy (Highway 9).
import * as THREE from 'three';
import { patchMaterial } from './terrain.js';

let NODES = null, ADJ = null, EDGES = null, M = null, SCENE = null;
const group = new THREE.Group(); group.userData.noLift = true;
export const onRoads = [];        // callbacks after the graph changes (minimap, traffic)
export const roadInfo = { meshes: 0, tris: 0 };

export const etype = (e) => e.t || (e.dirt ? 'dirt' : 'paved');
export const setType = (e, t) => { e.t = t; e.dirt = t === 'dirt'; };
export const DEFAULT_W = { paved: 10, dirt: 7, hwy: 12, path: 2.2, walk: 2 };
export const isPath = (t) => t === 'path' || t === 'walk';   // footpaths: no cars

export function initRoads(scene, mats, nodes, adj, edges) {
  SCENE = scene; M = mats; NODES = nodes; ADJ = adj; EDGES = edges;
  for (const k of ['asphalt', 'dirt', 'grass', 'plain', 'puddle', 'crosswalk', 'sidewalk']) patchMaterial(M[k]);
  scene.add(group);
  rebuildRoads();
}

/** Rebuild ADJ from EDGES (in place, so game.js keeps its reference). */
export function relink() {
  for (let i = 0; i < ADJ.length; i++) ADJ[i].length = 0;
  while (ADJ.length < NODES.length) ADJ.push([]);
  for (const e of EDGES) {
    const o = { w: e.w, dirt: etype(e) === 'dirt', nt: !!e.nt, t: etype(e) };
    ADJ[e.a].push({ n: e.b, ...o }); ADJ[e.b].push({ n: e.a, ...o });
  }
}
/** Something stuck on a node with no roads left: send it to the nearest node that still has roads. */
export function roadRescue(i) {
  let b = -1, bd = 1e9; const p = NODES[i] || { x: 0, z: 0 };
  for (let k = 0; k < NODES.length; k++) { if (k === i || !ADJ[k] || !ADJ[k].some((e) => !e.nt)) continue; const d = Math.hypot(NODES[k].x - p.x, NODES[k].z - p.z); if (d < bd) { bd = d; b = k; } }
  return b < 0 ? [] : [{ n: b, w: 8 }];
}
export function changed() { relink(); rebuildRoads(); for (const f of onRoads) f(); }

// ---------------- geometry ----------------
class Buf {
  constructor() { this.p = []; this.c = []; this.u = []; }
  tri(a, b, c, col, uvS) {
    for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.c.push(col.r, col.g, col.b); this.u.push(v[0] / uvS, -v[2] / uvS); }
  }
  mesh(mat) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(this.p.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    const a = new Float32Array(this.p.length);
    for (let i = 0; i < this.p.length; i += 3) { a[i] = this.p[i]; a[i + 1] = this.p[i + 2]; a[i + 2] = -1; }
    g.setAttribute('tanc', new THREE.BufferAttribute(a, 3));
    const m = new THREE.Mesh(g, mat); m.userData.noLift = true; m.frustumCulled = false; m.matrixAutoUpdate = false;
    roadInfo.tris += this.p.length / 9;
    return m;
  }
}
const col = (hex) => new THREE.Color(hex);

/** A strip along a->b (x,z), from lateral offset l0 to l1, subdivided every ~2.5 m along and `across` times across. */
function strip(B, ax, az, bx, bz, l0, l1, y, color, uvS = 5, across = 1, opt = {}) {
  const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) return;
  const dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
  const n = Math.max(1, Math.ceil(L / 2.5));
  const C = col(color);
  const P = (t, l) => [ax + dx * t + nx * l, y, az + dz * t + nz * l];
  const dash = opt.dash;   // [on, off]
  for (let i = 0; i < n; i++) {
    let t0 = (i / n) * L, t1 = ((i + 1) / n) * L;
    if (dash) { const per = dash[0] + dash[1], ph = ((t0 + (opt.ph || 0)) % per + per) % per; if (ph >= dash[0]) continue; t1 = Math.min(t1, t0 + dash[0] - ph); }
    for (let j = 0; j < across; j++) {
      const a0 = l0 + (l1 - l0) * (j / across), a1 = l0 + (l1 - l0) * ((j + 1) / across);
      const p00 = P(t0, a0), p10 = P(t1, a0), p01 = P(t0, a1), p11 = P(t1, a1);
      B.tri(p00, p01, p10, C, uvS); B.tri(p10, p01, p11, C, uvS);
    }
  }
}
/** Filled convex polygon (x,z points in order), fan-triangulated with rings so it drapes. */
function fan(B, cx, cz, pts, y, color, uvS = 5, rings = 3) {
  const C = col(color);
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    for (let r = 0; r < rings; r++) {
      const k0 = r / rings, k1 = (r + 1) / rings;
      const p = (k, x, z) => [cx + (x - cx) * k, y, cz + (z - cz) * k];
      if (r === 0) B.tri([cx, y, cz], p(k1, bx, bz), p(k1, ax, az), C, uvS);
      else { B.tri(p(k0, ax, az), p(k1, bx, bz), p(k1, ax, az), C, uvS); B.tri(p(k0, ax, az), p(k0, bx, bz), p(k1, bx, bz), C, uvS); }
    }
  }
}
function hull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function srand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const Y = { shoulder: 0.018, base: 0.03, pad: 0.034, crown: 0.036, line: 0.046, cross: 0.05, puddle: 0.052 };
const SHOULDER = { paved: 0.7, hwy: 1.6, dirt: 0.9, path: 0.45, walk: 0.25 };

export function rebuildRoads() {
  if (!NODES) return;
  for (const c of group.children.slice()) { group.remove(c); c.geometry.dispose(); }
  roadInfo.tris = 0;
  const asph = new Buf(), walk = new Buf(), dirt = new Buf(), grass = new Buf(), paint = new Buf(), shoulder = new Buf(), gravel = new Buf(), puddle = new Buf(), cross = new Buf();
  // incident edges per node, sorted by angle
  const inc = NODES.map(() => []);
  EDGES.forEach((e, k) => {
    const A = NODES[e.a], B = NODES[e.b];
    inc[e.a].push({ k, e, o: e.b, ang: Math.atan2(B.z - A.z, B.x - A.x) });
    inc[e.b].push({ k, e, o: e.a, ang: Math.atan2(A.z - B.z, A.x - B.x) });
  });
  // trim distance at each end of each edge (where the junction pad takes over)
  const trim = new Map();   // key `${k}:${node}`
  NODES.forEach((n, i) => {
    const L = inc[i];
    for (const a of L) {
      let t = 0;
      if (L.length >= 2) {
        t = a.e.w * 0.3;
        for (const b of L) {
          if (b === a) continue;
          let phi = Math.abs(a.ang - b.ang); if (phi > Math.PI) phi = 2 * Math.PI - phi;
          if (phi > 2.6) continue;   // nearly straight through: no pad needed beyond the overlap
          const ha = a.e.w / 2, hb = b.e.w / 2;
          t = Math.max(t, (hb + ha * Math.abs(Math.cos(phi))) / Math.max(Math.sin(phi), 0.45));
        }
        t = Math.min(t, a.e.w * 1.6);
      }
      trim.set(`${a.k}:${i}`, t);
    }
  });
  // edges
  EDGES.forEach((e, k) => {
    const A = NODES[e.a], B = NODES[e.b], T = etype(e), L = Math.hypot(B.x - A.x, B.z - A.z);
    if (L < 0.1) return;
    const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L, h = e.w / 2;
    const ta = Math.min(trim.get(`${k}:${e.a}`) || 0, L * 0.45), tb = Math.min(trim.get(`${k}:${e.b}`) || 0, L * 0.45);
    // ends extend a little into the pad so there are no gaps
    const ax = A.x + dx * Math.max(0, ta - 0.4), az = A.z + dz * Math.max(0, ta - 0.4), bx = B.x - dx * Math.max(0, tb - 0.4), bz = B.z - dz * Math.max(0, tb - 0.4);
    const sh = SHOULDER[T];
    // shoulder (runs the full length, under the pads too, so corners stay soft)
    const soft = T === 'dirt' || T === 'path';
    strip(soft ? shoulder : gravel, A.x, A.z, B.x, B.z, -h - sh, h + sh, Y.shoulder, soft ? 0xe0d8a0 : T === 'hwy' ? 0xd6d0c0 : T === 'walk' ? 0xb0aca0 : 0xcac2ae, 3, 2);
    if (T === 'dirt') strip(dirt, ax, az, bx, bz, -h, h, Y.base, 0xd8ccb4, 5, 3);   // one wide lane, no centre strip
    else if (T === 'path') strip(dirt, ax, az, bx, bz, -h, h, Y.base, 0xf0e4c8, 4, 1);
    else if (T === 'walk') strip(walk, ax, az, bx, bz, -h, h, Y.base, 0xe8e4dc, 3, 1);
    else {
      strip(asph, ax, az, bx, bz, -h, h, Y.base, T === 'hwy' ? 0xe4e4ea : 0xffffff, 5, 4);
      // markings stop at the junction pads
      const mx0 = A.x + dx * ta, mz0 = A.z + dz * ta, mx1 = B.x - dx * tb, mz1 = B.z - dz * tb;
      const yel = 0xe0c040, wht = 0xe8e8e0;
      if (T === 'hwy') { strip(paint, mx0, mz0, mx1, mz1, -0.28, -0.13, Y.line, yel, 5); strip(paint, mx0, mz0, mx1, mz1, 0.13, 0.28, Y.line, yel, 5); }
      else if (!e.nt) strip(paint, mx0, mz0, mx1, mz1, -0.08, 0.08, Y.line, yel, 5, 1, { dash: [3, 6] });
      if (e.w >= 8) { strip(paint, mx0, mz0, mx1, mz1, h - 0.55, h - 0.38, Y.line, wht, 5); strip(paint, mx0, mz0, mx1, mz1, -h + 0.38, -h + 0.55, Y.line, wht, 5); }
      // stop lines where a town road meets a junction of 3+
      for (const [ni, sgn, t] of [[e.b, 1, tb], [e.a, -1, ta]]) {
        if (inc[ni].length < 3 || T === 'hwy' || NODES[ni].cw) continue;
        const N0 = NODES[ni], ux = dx * sgn, uz = dz * sgn, ex = N0.x - ux * (t + 0.7), ez = N0.z - uz * (t + 0.7);
        strip(paint, ex - ux * 0.25, ez - uz * 0.25, ex + ux * 0.25, ez + uz * 0.25, 0.2, h - 0.6, Y.line, wht, 5);
      }
      // crosswalks on flagged junctions
      for (const [ni, sgn, t] of [[e.b, 1, tb], [e.a, -1, ta]]) {
        if (!NODES[ni].cw) continue;
        const N0 = NODES[ni], cx = N0.x - dx * sgn * (t + 1.6), cz = N0.z - dz * sgn * (t + 1.6);
        for (let l = -h + 0.6; l < h - 0.6; l += 1.2) strip(cross, cx - dx * 1.4 - dz * l, cz - dz * 1.4 + dx * l, cx + dx * 1.4 - dz * l, cz + dz * 1.4 + dx * l, -0.3, 0.3, Y.cross, 0xe8e8e0, 5);
      }
    }
    // a puddle or two
    const R = srand(Math.round(A.x * 7 + A.z * 13 + B.x * 17 + B.z * 19));
    const np = isPath(T) ? 0 : Math.floor(R() * (T === 'dirt' ? 2.6 : 1.6));
    for (let q = 0; q < np; q++) {
      const t = ta + 2 + R() * Math.max(0, L - ta - tb - 4), l = (R() - 0.5) * e.w * 0.6, r = 0.5 + R() * (T === 'dirt' ? 1.6 : 1.1);
      const px = A.x + dx * t - dz * l, pz = A.z + dz * t + dx * l, pts = [];
      for (let s = 0; s < 9; s++) { const a = (s / 9) * Math.PI * 2, rr = r * (0.75 + 0.35 * Math.sin(s * 2.3 + t)); pts.push([px + Math.cos(a) * rr * 1.4, pz + Math.sin(a) * rr]); }
      fan(puddle, px, pz, pts, Y.puddle, 0xffffff, 5, 1);
    }
  });
  // junction pads and dead-end bulbs
  NODES.forEach((n, i) => {
    const L = inc[i]; if (!L.length) return;
    // the pad takes the surface of the biggest road meeting here
    const ts = L.map((a) => etype(a.e)), top = ['hwy', 'paved', 'dirt', 'walk', 'path'].find((t) => ts.includes(t));
    const buf = top === 'hwy' || top === 'paved' ? asph : top === 'walk' ? walk : dirt;
    const color = top === 'dirt' ? 0xd8ccb4 : top === 'path' ? 0xf0e4c8 : top === 'walk' ? 0xe8e4dc : 0xffffff;
    const big = L.filter((a) => etype(a.e) === top);
    if (n.bulb) {
      const pts = []; for (let s = 0; s < 20; s++) { const a = (s / 20) * Math.PI * 2; pts.push([n.x + Math.cos(a) * n.bulb, n.z + Math.sin(a) * n.bulb]); }
      fan(buf, n.x, n.z, pts, Y.pad, color, 5, 3);
      const sp = []; for (let s = 0; s < 20; s++) { const a = (s / 20) * Math.PI * 2; sp.push([n.x + Math.cos(a) * (n.bulb + 0.8), n.z + Math.sin(a) * (n.bulb + 0.8)]); }
      fan(gravel, n.x, n.z, sp, Y.shoulder, 0xcac2ae, 3, 2);
      return;
    }
    if (L.length < 2) return;
    const pts = [];
    for (const a of (big.length >= 2 ? big : L)) {
      const t = trim.get(`${a.k}:${i}`) || 0, h = a.e.w / 2, c = Math.cos(a.ang), s = Math.sin(a.ang);
      const ex = n.x + c * t, ez = n.z + s * t;
      pts.push([ex - s * h, ez + c * h], [ex + s * h, ez - c * h]);
      pts.push([n.x - s * h, n.z + c * h], [n.x + s * h, n.z - c * h]);
    }
    const H = hull(pts);
    fan(buf, n.x, n.z, H, Y.pad, color, 5, 3);
  });
  const add = (b, k) => { const m = b.mesh(M[k]); if (m) group.add(m); };
  add(shoulder, 'grass'); add(gravel, 'asphalt'); add(asph, 'asphalt'); add(walk, 'sidewalk'); add(dirt, 'dirt'); add(grass, 'grass'); add(paint, 'plain'); add(cross, 'plain'); add(puddle, 'puddle');
  roadInfo.meshes = group.children.length;
}

/** Nearest point on any road to (x,z): { k (edge index), t (0..1), d (distance), x, z } */
export function nearestRoad(x, z) {
  let best = null;
  EDGES.forEach((e, k) => {
    const A = NODES[e.a], B = NODES[e.b], ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / L2)), px = A.x + ex * t, pz = A.z + ez * t, d = Math.hypot(x - px, z - pz);
    if (!best || d < best.d) best = { k, t, d, x: px, z: pz };
  });
  return best;
}
