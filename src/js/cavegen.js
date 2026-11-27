// The Hollow Deep as an organic, branching cave (2026-11-27, diet: "more of a mining tunnel rather than an organic cave
// with multiple forks and other ways to get lost"). cave.js calls buildCave() from the room builder.
//
// How it is made: every passage is a spline, every chamber a blob; together they define a 2D distance field (negative =
// open cave) with rock noise on top and columns cut out of it. A 0.7 m grid over that field gives the floor, and a
// ceiling that arches up from the field's edge (so walls, roof and pillars are one continuous rock skin). The same field
// is the collision (out.collide / out.solid hooks in interiors.js), so there are no wall boxes to keep in sync.
// The mesh is cut into 14 m tiles; only tiles near the cat are drawn (the fog ends at 20 m anyway).
//
// Layout (room-local metres, entrance at the top, z = +59): one main route down to the rope pit, two loops that leave
// it and come back, five dead ends. Cues for the way down: John's ghost-blue wisps drift along the main route, the
// feather trail follows it, and the signs lie in a readable way.
import * as THREE from 'three';
import { lambert, basic } from './gfx.js';
import { makeFx, makeBatch, makePools, makeMist } from './cavefx.js';

const MAIN = [[0, 59], [0, 46], [-12, 35], [-28, 27], [-31, 10], [-15, 0], [7, 6], [26, 1], [34, -13], [25, -27], [7, -28], [-11, -34], [-27, -41], [-24, -52]];
const BRANCH = [
  { id: 'loopN', r: 1.55, ctrl: [[0, 46], [11, 42], [25, 37], [31, 28], [25, 16], [14, 9], [7, 6]] },      // leaves at the first fork, rejoins past the pillar hall
  { id: 'loopS', r: 1.45, ctrl: [[-15, 0], [-17, -11], [-8, -18], [2, -19], [7, -28]] },                     // pillar hall -> the long gallery
  { id: 'deadW', r: 1.45, ctrl: [[-28, 27], [-37, 31], [-41, 39]] },
  { id: 'deadLong', r: 1.4, ctrl: [[-31, 10], [-41, 5], [-43, -7], [-37, -19], [-39, -30]] },
  { id: 'deadE', r: 1.45, ctrl: [[26, 1], [36, 6], [41, 14]] },
  { id: 'deadSE', r: 1.5, ctrl: [[25, -27], [32, -37], [38, -46]] },
  { id: 'deadS', r: 1.4, ctrl: [[-11, -34], [-6, -45], [3, -50]] },
];
// chambers: [x, z, radius, roof height]
const CHAMBER = [[-28, 27, 6, 5.4], [-15, 0, 7.5, 5.8], [26, 1, 5.8, 5.2], [-11, -34, 6.2, 5.2], [-24.5, -49.6, 4.6, 4.6],
  [31, 28, 4.6, 4.6], [-41, 39, 3.8, 4.2], [-39, -30, 3.6, 4.0], [41, 14, 3.4, 3.9], [38, -46, 4.2, 4.4], [3, -50, 3.4, 3.9]];
const PILLAR = [[-18, 5.5, 1.35], [-12.5, -4.5, 1.2], [-20.5, -4, 1.1], [-9, 5, 1.0], [-25, 31.5, 1.1], [28.5, 5, 1.0], [-14.5, -37.5, 1.1], [-7.5, -30.5, 0.95], [33, 30.5, 0.95]];
const POOL = [[-30.5, 24.5, 1.8], [-13, 3.6, 1.5], [24, -1.6, 1.3], [-11, -36, 2.3], [-8.6, -32.4, 1.0], [-41, 39.6, 1.6], [38, -46, 2.0], [-43, -7, 0.9], [32, 28.6, 1.4], [0.6, 50, 0.8], [-21.6, -50.6, 0.9], [3.2, -50.2, 1.2], [41, 14.4, 1.1]];
// glowing crystal + mushroom gardens: [x, z, colour, light]
const TEAL = 0x58f0d8, VIOLET = 0x8a7aff;
const GLOW = [[-32, 29.5, TEAL, 0.5], [-24.5, 23, TEAL, 0.35], [-20.5, 3, VIOLET, 0.45], [-10, -3.5, VIOLET, 0.4], [22.5, 3.5, TEAL, 0.45], [29.5, -2, VIOLET, 0.45], [26, 5, TEAL, 0.3],
  [-14.5, -31, TEAL, 0.45], [-7, -37, TEAL, 0.35], [33.5, 25.5, VIOLET, 0.4], [-43, 41, TEAL, 0.4], [-40.5, -32, VIOLET, 0.4], [43, 15.5, TEAL, 0.4], [40, -48, TEAL, 0.4], [36, -44, VIOLET, 0.3], [5, -51.5, VIOLET, 0.4],
  [-2.2, 39, TEAL, 0.28], [16, 3.2, TEAL, 0.25], [33, -20, VIOLET, 0.25], [-18, -39.5, TEAL, 0.25], [17, 40.5, VIOLET, 0.22], [-9, -18.5, VIOLET, 0.22]];
// John's signs: [x, z, march dx, dz, text]. A sign is planted at the wall found by walking from (x, z) along (dx, dz).
const SIGNS = [
  [0, 50, 1, 0, 'DEPTH: SOME'], [3.5, 45, 0.4, 1, 'SHORTCUT (IT ISN\'T)'], [-30, 29, -0.3, 1, 'NOTHING DOWN THERE'], [-41, 39, -0.6, 1, 'TOLD YOU'],
  [-33, 9, 0, 1, 'DEFINITELY THE WAY'], [-39, -30, -0.3, -1, 'I LIED. SORRY.  - J'], [-13, 2, 0.2, 1, 'TURN BACK, CAT. (DON\'T.)'], [41, 14, 1, 0.6, 'DEAD END. LIKE ME.'],
  [27, -29, 0.5, 1, 'NOT A CAT DOOR'], [38, -46, 1, -0.5, 'WHY ARE YOU LIKE THIS'], [3, -50, 0.6, -1, 'YOU ARE LOST. SO WAS I.'], [31, 28, 1, 0.3, 'SPARE ROOM (HAUNTED)'],
  [-3, -31.5, 0, 1, 'ALMOST THERE (LIE)'], [-25.5, -46, 1, 0.2, 'MIND THE ROPE'],
];
// pairs of eyes in the dark: [x, z, march dx, dz, kind]  (2 = something small and yellow-eyed, 5 = round spectacles)
const EYES = [[-37, 31, 0, 1, 2], [-42, -1, -1, 0, 2], [-38, -24, 1, 0.3, 2], [36, 6, 0.3, -1, 2], [32, -37, 1, 0.2, 2], [-6, -45, -1, -0.2, 2], [25, 37, 0, 1, 2], [-17, -11, -1, 0, 2], [2, -19, 0, 1, 2],
  [-28, 27, 1, 0.9, 5], [26, 1, 0.2, -1, 5], [-11, -34, -1, 0.5, 5], [-15, 0, -0.2, -1, 2], [34, -13, 1, 0, 2], [-27, -41, -1, 0.4, 2]];

const G = 0.7, X0 = -48.3, Z0 = -58.8, NX = 139, NZ = 174, TILE = 14;
const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// unit icosahedron for boulders
const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((c) => c / l); });
  return { v, f: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]] }; })();

/**
 * Low-poly dressing written straight into triangle soups S = { p: [], c: [], u?: [] } (positions, vertex colours, optional
 * uvs), so a whole tile of rocks, ferns, moss, mushrooms and roots is one mesh. rr = a seeded random 0..1.
 */
export function soupKit(rr) {
  const rnd = (a, b) => a + rr() * (b - a);
  const put = (S, a, b, c, o, ca, cb, cc) => {   // triangle wound to face away from o
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * (a[0] - o[0]) + ny * (a[1] - o[1]) + nz * (a[2] - o[2]) < 0) { const q = b; b = c; c = q; const qc = cb; cb = cc; cc = qc; }
    S.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); S.c.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2], cc[0], cc[1], cc[2]);
    if (S.u) S.u.push(a[0] * 0.4 + a[1] * 0.3, a[2] * 0.4 + a[1] * 0.3, b[0] * 0.4 + b[1] * 0.3, b[2] * 0.4 + b[1] * 0.3, c[0] * 0.4 + c[1] * 0.3, c[2] * 0.4 + c[1] * 0.3);
  };
  const hex = (c, k = 1) => [((c >> 16) & 255) / 255 * k, ((c >> 8) & 255) / 255 * k, (c & 255) / 255 * k];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const cone = (S, x, y, z, r, h, n, col, tip = col, lx = 0, lz = 0, a0 = 0) => {   // h < 0 hangs down
    const ap = [x + lx, y + h, z + lz], o = [x + lx * 0.5, y + h * 0.4, z + lz * 0.5];
    for (let k = 0; k < n; k++) { const a = a0 + k / n * 6.283, b = a0 + (k + 1) / n * 6.283; put(S, [x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(b) * r, y, z + Math.sin(b) * r], ap, o, col, col, tip); }
  };
  const rock = (S, x, y, z, sx, sy, sz, col) => {
    const ry = rnd(0, 6.283), cs = Math.cos(ry), sn = Math.sin(ry), V = ICO.v.map((p) => { const k = rnd(0.74, 1.18), px = p[0] * sx * k, pz = p[2] * sz * k; return [x + px * cs + pz * sn, y + Math.max(-0.25, p[1]) * sy * k, z - px * sn + pz * cs]; });
    const o = [x, y, z];
    for (const [a, b, c] of ICO.f) { const k = rnd(0.86, 1.1); put(S, V[a], V[b], V[c], o, mul(col, k), mul(col, k), mul(col, k)); }
  };
  const fan = (S, x, y, z, R, n, col) => {
    const o = [x, y - 1, z], a0 = rnd(0, 6.283), ring = [];
    for (let k = 0; k < n; k++) { const a = a0 + k / n * 6.283, r = R * rnd(0.6, 1.15); ring.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); }
    for (let k = 0; k < n; k++) { const e = mul(col, rnd(0.6, 0.85)); put(S, [x, y + 0.015, z], ring[k], ring[(k + 1) % n], o, col, e, e); }
  };
  const fern = (S, x, y, z, s, col) => {
    const nf = 5 + (rr() * 3 | 0), a0 = rnd(0, 6.283), o = [x, y - 2, z], dark = mul(col, 0.45);
    for (let f = 0; f < nf; f++) {
      const a = a0 + f / nf * 6.283 + rnd(-0.3, 0.3), L = s * rnd(0.55, 1), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, arch = rnd(0.45, 0.75);
      const sec = (t, w) => { const hd = L * t, hy = y + L * arch * Math.sin(t * 2.6), ww = L * 0.2 * w; return [[x + dx * hd - px * ww, hy - ww * 0.3, z + dz * hd - pz * ww], [x + dx * hd + px * ww, hy - ww * 0.3, z + dz * hd + pz * ww], [x + dx * hd, hy + 0.02, z + dz * hd]]; };
      const A = sec(0.08, 0.35), B = sec(0.38, 1), C = sec(0.72, 0.6), T = sec(1, 0)[2], c1 = mul(col, rnd(0.8, 1.1)), c2 = mul(col, 1.2);
      put(S, A[0], B[0], A[2], o, dark, c1, dark); put(S, A[2], B[0], B[2], o, dark, c1, c1); put(S, A[1], A[2], B[1], o, dark, dark, c1); put(S, A[2], B[2], B[1], o, dark, c1, c1);
      put(S, B[0], C[0], B[2], o, c1, c2, c1); put(S, B[2], C[0], C[2], o, c1, c2, c2); put(S, B[1], B[2], C[1], o, c1, c1, c2); put(S, B[2], C[2], C[1], o, c1, c2, c2);
      put(S, C[0], T, C[2], o, c2, c2, c2); put(S, C[2], T, C[1], o, c2, c2, c2);
    }
  };
  const shroom = (Sd, Sg, x, y, z, h, r, stem, cap, glow) => {
    const o = [x, y + h * 0.5, z];
    for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283, b = (k + 1) / 3 * 6.283, w = Math.max(0.012, r * 0.16); put(glow ? Sg : Sd, [x + Math.cos(a) * w, y, z + Math.sin(a) * w], [x + Math.cos(b) * w, y, z + Math.sin(b) * w], [x, y + h, z], o, stem, stem, stem); }
    cone(glow ? Sg : Sd, x, y + h - r * 0.25, z, r, r * 0.75, 6, mul(cap, 0.7), cap, 0, 0, rr() * 6);
  };
  const root = (S, x, yTop, z, len, col) => {
    let px = x, py = yTop, pz = z, w = rnd(0.035, 0.07), dx = rnd(-0.25, 0.25), dz = rnd(-0.25, 0.25);
    const ring = (cx, cy, cz, r) => [0, 1, 2].map((k) => [cx + Math.cos(k * 2.094) * r, cy, cz + Math.sin(k * 2.094) * r]);
    let A = ring(px, py, pz, w);
    for (let s = 0; s < 3; s++) {
      const l = len / 3, nx = px + dx * l + rnd(-0.1, 0.1), ny = py - l, nz = pz + dz * l + rnd(-0.1, 0.1), B = ring(nx, ny, nz, w * (s === 2 ? 0.15 : 0.62)), o = [(px + nx) / 2, (py + ny) / 2, (pz + nz) / 2], c = mul(col, 1 - s * 0.15);
      for (let k = 0; k < 3; k++) { const k2 = (k + 1) % 3; put(S, A[k], A[k2], B[k], o, c, c, c); put(S, A[k2], B[k2], B[k], o, c, c, c); }
      A = B; px = nx; py = ny; pz = nz; w *= 0.62;
    }
  };
  return { put, hex, mul, cone, rock, fan, fern, shroom, root };
}
/** A mesh geometry from a soup (flat shaded). */
export function soupGeo(S) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(S.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(S.c, 3));
  if (S.u) g.setAttribute('uv', new THREE.Float32BufferAttribute(S.u, 2)); g.computeVertexNormals(); return g;
}

/**
 * H: helpers from cave.js { rockN, catmull, resample, textures(), fitSign, wood (texture), glowSprite(colour, opacity) }.
 * Returns { root, main: {pts, len}, cols, lights, torch, collide, solid, update(t, cat), pit, field, ceilAt, stats }.
 */
export function buildCave(H) {
  const { rockN } = H;
  const GLOWS = GLOW.map((g) => g.slice()), POOLS = POOL.map((p) => p.slice());
  let sd = 20261127; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), rnd = (a, b) => a + rr() * (b - a);
  const t0 = Date.now();
  // ---------------------------------------------------------------- the field ----------------------------------------------------------------
  const main = H.resample(H.catmull(MAIN, 8), 2.5);             // { pts: [{x, z, s, tx, tz}], len }
  const SX = [], SZ = [], SR = [], SH = [];
  const addPath = (ctrl, base, ph, isMain) => {
    const { pts, len } = H.resample(H.catmull(ctrl, 8), 1.0);
    for (const p of pts) {
      let r = base * (1 + 0.2 * Math.sin(p.s * 0.21 + ph) + 0.11 * Math.sin(p.s * 0.57 + ph * 2.3));
      if (isMain) r -= 0.35 * Math.max(0, 1 - p.s / 6);
      SX.push(p.x); SZ.push(p.z); SR.push(r); SH.push(2.45 + r * 0.42);
    }
    return { pts, len };
  };
  addPath(MAIN, 2.1, 0.4, true);
  const branches = BRANCH.map((b, i) => ({ id: b.id, ...addPath(b.ctrl, b.r, 1.7 + i * 2.1, false) }));
  for (const [x, z, r, h] of CHAMBER) {
    SX.push(x); SZ.push(z); SR.push(r * 0.86); SH.push(h);
    for (let k = 0; k < 3; k++) { const a = rnd(0, 6.283), d = r * rnd(0.35, 0.55); SX.push(x + Math.cos(a) * d); SZ.push(z + Math.sin(a) * d); SR.push(r * rnd(0.55, 0.72)); SH.push(h * rnd(0.8, 1)); }
  }
  // buckets (9 m) so each node only looks at nearby samples
  const BK = 9, bkey = (x, z) => (Math.floor((x + 90) / BK) << 8) | Math.floor((z + 90) / BK), buckets = new Map();
  for (let i = 0; i < SX.length; i++) { const k = bkey(SX[i], SZ[i]); let a = buckets.get(k); if (!a) buckets.set(k, a = []); a.push(i); }
  const N = NX * NZ, D = new Float32Array(N).fill(9), HC = new Float32Array(N).fill(3), FY = new Float32Array(N), CY = new Float32Array(N), JX = new Float32Array(N), JZ = new Float32Array(N);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + i * G, z = Z0 + j * G, bx = Math.floor((x + 90) / BK), bz = Math.floor((z + 90) / BK);
    let d = 9, core = 9, hw = 0, hs = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const arr = buckets.get(((bx + a) << 8) | (bz + b)); if (!arr) continue;
      for (const q of arr) {
        const dist = Math.hypot(x - SX[q], z - SZ[q]), r = SR[q];
        if (dist - r < d) d = dist - r;
        if (dist - r * 0.62 < core) core = dist - r * 0.62;
        const w = r + 1.2 - dist; if (w > 0) { hw += w * w; hs += w * w * SH[q]; }
      }
    }
    const n = j * NX + i;
    if (d < 3) {
      d += rockN(x * 0.28, 0, z * 0.28) * 0.5 + rockN(x * 0.8, 5, z * 0.8) * 0.2;
      if (core < d) d = core;                                    // noise never pinches a passage shut
      for (const [px, pz, pr] of PILLAR) { const pd = pr - Math.hypot(x - px, z - pz) + rockN(x * 1.1, 8, z * 1.1) * 0.15; if (pd > d) d = pd; }
    }
    D[n] = d; if (hw > 0) HC[n] = hs / hw;
  }
  const bil = (A, x, z) => {
    const fx = clamp((x - X0) / G, 0, NX - 1.001), fz = clamp((z - Z0) / G, 0, NZ - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, n = j * NX + i;
    return (A[n] * (1 - u) + A[n + 1] * u) * (1 - v) + (A[n + NX] * (1 - u) + A[n + NX + 1] * u) * v;
  };
  const field = (x, z) => bil(D, x, z);
  // heights
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const n = j * NX + i, d = D[n]; if (d > 1.6) { FY[n] = 0.45; CY[n] = 0; continue; }
    const x = X0 + i * G, z = Z0 + j * G;
    FY[n] = 0.45 * sm((d + 0.45) / 0.9) + (d > -0.6 ? Math.max(0, rockN(x * 2, 1, z * 2)) * 0.06 : 0);
    if (d >= 0) { CY[n] = FY[n] - 0.5; JX[n] = x; JZ[n] = z; continue; }
    const t = Math.pow(1 - Math.exp(d / 0.78), 0.8);
    const roof = HC[n] + rockN(x * 0.45, 3, z * 0.45) * 0.5 - Math.max(0, rockN(x * 1.3, 9, z * 1.3) - 0.42) * 1.5;
    CY[n] = FY[n] + Math.max(0.2, roof) * t;
    const k = clamp(CY[n] / 1.5, 0, 1) * 0.42;
    JX[n] = x + rockN(x * 0.9 + 11, CY[n] * 0.8, z * 0.9) * k; JZ[n] = z + rockN(x * 0.9, CY[n] * 0.8, z * 0.9 + 17) * k;
  }
  const ceilAt = (x, z) => bil(CY, x, z);
  /** Walk from (x, z) along (dx, dz) until the wall is `stop` m away; returns [x, z, dirx, dirz]. */
  const march = (x, z, dx, dz, stop = 0.7) => { const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; for (let k = 0; k < 60 && field(x, z) < -stop; k++) { x += dx * 0.2; z += dz * 0.2; } return [x - dx * 0.15, z - dz * 0.15, dx, dz]; };

  /** Nudge a point towards the nearest passage centre until it is `m` metres clear of the rock. */
  const inside = (x, z, m = 0.6) => {
    for (let k = 0; k < 40 && field(x, z) > -m; k++) {
      let b = 0, bd = 1e9; for (let q = 0; q < SX.length; q++) { const dq = (x - SX[q]) ** 2 + (z - SZ[q]) ** 2; if (dq < bd) { bd = dq; b = q; } }
      const l = Math.sqrt(bd) || 1; if (l < 0.05) break; x += (SX[b] - x) / l * 0.25; z += (SZ[b] - z) / l * 0.25;
    }
    return [x, z];
  };
  for (const g of GLOWS) { const [x, z] = inside(g[0], g[1], 0.6); g[0] = x; g[1] = z; }
  for (const p of POOLS) { const [x, z] = inside(p[0], p[1], p[2] + 0.25); p[0] = x; p[1] = z; }

  // ---------------------------------------------------------------- lights ----------------------------------------------------------------
  const pitS = main.len - 2.4, at = (s) => main.pts[clamp(Math.round(s / 2.5), 0, main.pts.length - 1)];
  const pitP = at(pitS), pit = [pitP.x, 0, pitP.z, pitP];
  const torch = { x: 0, y: 1.0, z: 50, c: 0xffa050, i: 1.5, flicker: true, dyn: true };   // carried: a live light, not baked
  // the pool gets the torch, the pit and the big gardens; everything after the tenth is baked into the rock only
  const lights = [torch, { x: pit[0], y: 0.4, z: pit[2], c: 0x6a8aff, i: 0.6 }, ...GLOWS.map(([x, z, c, i]) => ({ x, y: 0.45, z, c, i }))];

  // ---------------------------------------------------------------- tiles ----------------------------------------------------------------
  const tiles = new Map();
  const tileOf = (x, z) => {
    const tx = Math.floor((x - X0) / TILE), tz = Math.floor((z - Z0) / TILE), k = tx * 64 + tz;
    let T = tiles.get(k);
    if (!T) { tiles.set(k, T = { wp: [], wu: [], wc: [], fp: [], fu: [], fc: [], dec: null, glow: { p: [], c: [] }, mist: makeMist(), extra: [], cx: X0 + (tx + 0.5) * TILE, cz: Z0 + (tz + 0.5) * TILE }); T.dec = { p: T.wp, c: T.wc, u: T.wu }; }
    return T;
  };
  // node colours
  const CC = new Float32Array(N * 3), FC = new Float32Array(N * 3), MA = new Float32Array(N);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const n = j * NX + i, d = D[n]; if (d > 1.6) continue;
    const x = X0 + i * G, z = Z0 + j * G, y = CY[n], c = HC[n];
    const nA = rockN(x * 0.35 + 7, y * 0.5, z * 0.35), m = rockN(x * 2.3, y * 0.4 + 3, z * 2.3), damp = rockN(x * 0.2, 40, z * 0.2), near = Math.hypot(x, z - 59);
    let v = 0.66 + nA * 0.22 + m * 0.07;
    v *= 0.6 + 0.4 * Math.min(1, Math.max(0, y) / 0.9);                    // dark where the wall meets the floor
    v *= 1 - 0.2 * Math.max(0, (y - c * 0.8) / (c * 0.2 + 1e-3));          // sooty crown
    const wet = Math.max(0, rockN(x * 0.9, 0, z * 0.9) - 0.25) * 1.6;
    let r = v * (1.04 - wet * 0.1 + Math.max(0, m) * 0.12), g = v * (0.95 - wet * 0.04), b = v * (0.86 + wet * 0.1);
    // moss creeps up the damp walls (and everywhere near the daylight at the mouth)
    const moss = clamp((sm(damp * 1.4 + 0.25) * 0.75 + Math.max(0, 1 - near / 26) * 0.7) * (1 - sm((y - 0.2) / 1.9)) * (0.6 + 0.4 * m), 0, 0.85);
    r += (v * 0.50 - r) * moss; g += (v * 0.80 - g) * moss; b += (v * 0.36 - b) * moss;
    CC[n * 3] = r; CC[n * 3 + 1] = g; CC[n * 3 + 2] = b;
    const nF = rockN(x * 0.7, 2, z * 0.7), wetF = Math.max(0, rockN(x * 0.4, 5, z * 0.4) - 0.3), edge = sm((d + 1.3) / 1.2);
    let vf = (0.86 + nF * 0.18) * (1 - 0.32 * edge), fr = vf * (1 - wetF * 0.5), fg = vf * (0.97 - wetF * 0.45), fb = vf * (0.92 - wetF * 0.3);
    for (const [px, pz, pr] of POOLS) { const pd = Math.hypot(x - px, z - pz) / pr; if (pd < 2.2) { const k = 0.55 + 0.45 * sm((pd - 1) / 1.2); fr *= k; fg *= k; fb *= k * 1.04; } }
    const mossF = clamp((sm(damp * 1.4 + 0.2) * 0.8 + Math.max(0, 1 - near / 26) * 0.6) * edge * (0.5 + 0.5 * nF + 0.4), 0, 0.8);
    fr += (vf * 0.46 - fr) * mossF; fg += (vf * 0.74 - fg) * mossF; fb += (vf * 0.34 - fb) * mossF;
    FC[n * 3] = fr; FC[n * 3 + 1] = fg; FC[n * 3 + 2] = fb;
    // mist gathers in the low open places, thicker in the damp ones
    MA[n] = clamp((-d - 0.3) / 0.9, 0, 1) * (0.12 + 0.88 * sm(rockN(x * 0.13, 60, z * 0.13) * 1.8 + 0.4)) * (0.75 + 0.25 * sm((HC[n] - 3.4) / 1.2));
  }
  const tri = (P, U, C, a, b, c, up) => {   // a/b/c: [x, y, z, r, g, b]; wound so the normal faces into the cave
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    if (up ? ny < 0 : ny > 0) { const q = b; b = c; c = q; }
    const flat = Math.abs(ny) / l > 0.55, xs = Math.abs(nx) > Math.abs(nz);
    for (const p of [a, b, c]) {
      P.push(p[0], p[1], p[2]); C.push(p[3], p[4], p[5]);
      if (flat) U.push(p[0] / 3, p[2] / 3); else U.push((xs ? p[2] : p[0]) / 3, p[1] / 2.2);
    }
  };
  const mistPt = new Map();
  const mp = (n, x, z) => { let p = mistPt.get(n); if (!p) mistPt.set(n, p = [x, 0.27, z, MA[n]]); return p; };
  let cells = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const n0 = j * NX + i, n1 = n0 + 1, n2 = n0 + NX, n3 = n2 + 1, dm = Math.min(D[n0], D[n1], D[n2], D[n3]);
    if (dm > 0.05) continue;
    cells++;
    const x = X0 + i * G, z = Z0 + j * G, T = tileOf(x + G / 2, z + G / 2);
    const cv = (n) => [JX[n], CY[n], JZ[n], CC[n * 3], CC[n * 3 + 1], CC[n * 3 + 2]];
    const fv = (n, px, pz) => [px, FY[n], pz, FC[n * 3], FC[n * 3 + 1], FC[n * 3 + 2]];
    const c0 = cv(n0), c1 = cv(n1), c2 = cv(n2), c3 = cv(n3), f0 = fv(n0, x, z), f1 = fv(n1, x + G, z), f2 = fv(n2, x, z + G), f3 = fv(n3, x + G, z + G);
    if ((i + j) & 1) { tri(T.wp, T.wu, T.wc, c0, c1, c2, false); tri(T.wp, T.wu, T.wc, c1, c3, c2, false); tri(T.fp, T.fu, T.fc, f0, f1, f2, true); tri(T.fp, T.fu, T.fc, f1, f3, f2, true); }
    else { tri(T.wp, T.wu, T.wc, c0, c1, c3, false); tri(T.wp, T.wu, T.wc, c0, c3, c2, false); tri(T.fp, T.fu, T.fc, f0, f1, f3, true); tri(T.fp, T.fu, T.fc, f0, f3, f2, true); }
    if (Math.max(MA[n0], MA[n1], MA[n2], MA[n3]) > 0.02) T.mist.quad(mp(n0, x, z), mp(n1, x + G, z), mp(n3, x + G, z + G), mp(n2, x, z + G), lights);
  }

  // ---------------------------------------------------------------- dressing (triangle soups per tile) ----------------------------------------------------------------
  const { put, hex, mul, cone, rock, fan, fern, shroom, root } = soupKit(rr);
  const ROCKC = [hex(0xb0a898), hex(0x9a9488), hex(0xbcb2a2), hex(0x8e877d)], MOSS = hex(0x3f8a2c), FERN = hex(0x4fae3a), PALE = hex(0x6fc0a0), ROOT = hex(0x6a4a30);
  let nDecor = 0;
  for (let j = 2; j < NZ - 2; j++) for (let i = 2; i < NX - 2; i++) {
    const n = j * NX + i, d = D[n]; if (d > -0.4) continue;
    const x = X0 + i * G + rnd(-0.3, 0.3), z = Z0 + j * G + rnd(-0.3, 0.3), dd = field(x, z); if (dd > -0.35) continue;
    const T = tileOf(x, z), S = T.dec, wall = dd > -1.25, y = bil(FY, x, z), cy = ceilAt(x, z);
    const lush = rockN(x * 0.12, 20, z * 0.12), damp = rockN(x * 0.2, 40, z * 0.2), near = Math.max(0, 1 - Math.hypot(x, z - 59) / 30), u = rr();
    if (wall) {
      if (u < 0.11) { const s = rnd(0.12, 0.45); rock(S, x, y + s * 0.3, z, s * rnd(0.8, 1.4), s * rnd(0.5, 0.9), s * rnd(0.8, 1.3), ROCKC[(rr() * 4) | 0]); if (damp > 0 && rr() < 0.5) fan(S, x + rnd(-0.1, 0.1), y + s * 0.62, z + rnd(-0.1, 0.1), s * 0.7, 6, mul(MOSS, rnd(0.8, 1.2))); nDecor++; }
      else if (u < 0.15 && cy > 1.2) { const h = rnd(0.3, 1.0); cone(S, x, y - 0.03, z, rnd(0.1, 0.22), h, 5, hex(0xa0978a), hex(0xc4baaa), rnd(-0.06, 0.06), rnd(-0.06, 0.06), rr() * 6); nDecor++; }
      else if (u < 0.15 + 0.06 + damp * 0.07 + near * 0.12) { fan(S, x, y + 0.025, z, rnd(0.25, 0.7), 7, mul(MOSS, rnd(0.75, 1.25))); nDecor++; }
      else if (u < 0.30 + lush * 0.08 + near * 0.06 && u > 0.26) {   // a clump of mushrooms: glowing ones in the lush places, brown ones elsewhere
        const glow = lush > 0.05 || rr() < 0.25, cap = glow ? hex(rr() < 0.7 ? 0x6fe8d0 : 0x9a8aff) : hex(rr() < 0.5 ? 0x8a5a3a : 0xb09070), stem = glow ? hex(0xbfe8e0) : hex(0xc8c0a8);
        for (let k = 0, m = 3 + (rr() * 5 | 0); k < m; k++) { const h = rnd(0.06, 0.24), r = rnd(0.04, 0.12); shroom(S, T.glow, x + rnd(-0.3, 0.3), y - 0.01, z + rnd(-0.3, 0.3), h, r, stem, cap, glow); }
        nDecor++;
      } else if (u > 0.5 && u < 0.5 + near * 0.3 + Math.max(0, lush) * 0.07) { fern(S, x, y, z, rnd(0.35, 0.75), near > 0.15 ? mul(FERN, rnd(0.8, 1.15)) : mul(PALE, rnd(0.7, 1))); nDecor++; }
    } else if (u < 0.03) { const s = rnd(0.05, 0.13); rock(S, x, y + s * 0.3, z, s * 1.2, s * 0.7, s, ROCKC[(rr() * 4) | 0]); nDecor++; }
    const v = rr();
    if (cy > 2.3 && v < 0.075) { const h = rnd(0.25, 1.1) * Math.min(1, (cy - 1.6) / 1.5); cone(S, x, cy + 0.12, z, rnd(0.07, 0.2), -h - 0.12, 5, hex(0xa69c8e), hex(0xcabfae), 0, 0, rr() * 6); nDecor++; }
    else if (near > 0.05 && v < 0.075 + near * 0.16 && cy > 1.7) { root(S, x, cy + 0.15, z, rnd(0.5, 1.5) * Math.min(1, cy / 3) + 0.15, mul(ROOT, rnd(0.8, 1.3))); nDecor++; }
  }
  // crystal gardens round every glow light
  const batch = makeBatch();
  for (const [cx, cz, hue, li] of GLOWS) {
    const T = tileOf(cx, cz), c = hex(hue), n = Math.round(5 + li * 14);
    for (let q = 0; q < n; q++) {
      const a = rnd(0, 6.283), r = rnd(0.05, 0.75), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (field(x, z) > -0.25) continue;
      const h = rnd(0.2, 0.7) * (1 - r * 0.5); cone(T.glow, x, bil(FY, x, z) - 0.03, z, rnd(0.04, 0.1), h, 4, mul(c, 0.55), mul(c, 1.15), rnd(-0.18, 0.18), rnd(-0.18, 0.18), rr() * 6);
    }
    for (let q = 0; q < 6; q++) { const a = rnd(0, 6.283), r = rnd(0.5, 1.5), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (field(x, z) > -0.3) continue; shroom(T.dec, T.glow, x, bil(FY, x, z) - 0.01, z, rnd(0.08, 0.26), rnd(0.05, 0.13), hex(0xbfe8e0), hex(hue === TEAL ? 0x6fe8d0 : 0x9a8aff), true); }
    batch.add(3, cx, 0.5, cz, 2.4, 1.7, hue, { sp: 0.6, ex: 1 });   // one soft halo over the garden
  }
  // feathers along the main route: sparse at first, a proper trail from halfway (basic, unlit: they catch the eye)
  for (let s = main.len * 0.1; s < main.len - 3; s += (s < main.len * 0.45 ? 2.6 : 1.3)) {
    const p = at(s), lat = rnd(-1.0, 1.0), x = p.x - p.tz * lat + rnd(-0.5, 0.5), z = p.z + p.tx * lat + rnd(-0.5, 0.5); if (field(x, z) > -0.4) continue;
    const a = rnd(0, 6.283), dx = Math.cos(a) * 0.08, dz = Math.sin(a) * 0.08, px = -dz * 0.38, pz = dx * 0.38, c = hex([0xf4f0e8, 0xa0683a, 0xe8e0d0][(rr() * 3) | 0], 0.8), S = tileOf(x, z).glow, o = [x, -1, z];
    put(S, [x - dx - px, 0.02, z - dz - pz], [x + dx - px, 0.02, z + dz - pz], [x + dx + px, 0.02, z + dz + pz], o, c, c, c); put(S, [x - dx - px, 0.02, z - dz - pz], [x + dx + px, 0.02, z + dz + pz], [x - dx + px, 0.02, z - dz + pz], o, c, c, c);
  }
  // John's wisps: ghost-blue motes that drift down the main route (the honest cue)
  for (let s = 8; s < main.len - 6; s += 6.5) { const p = at(s), lat = rnd(-0.7, 0.7); batch.add(0, p.x - p.tz * lat, rnd(0.7, 1.5), p.z + p.tx * lat, 0.16, 0.16, 0x7fa8ff, { sp: 0.045, dir: [p.tx * 6.5, rnd(-0.2, 0.2), p.tz * 6.5] }); }
  // eyes in the dark that shut when the torch comes close
  for (const [ex, ez, dx, dz, kind] of EYES) {
    const [x, z] = march(ex, ez, dx, dz, 0.45), y = Math.min(rnd(0.35, 1.1), ceilAt(x, z) - 0.25); if (y < 0.2) continue;
    batch.add(kind, x, y, z, kind === 5 ? 0.3 : 0.26, kind === 5 ? 0.15 : 0.13, kind === 5 ? 0xbcd0ff : rr() < 0.8 ? 0xe8f08a : 0xff6a4a, { ex: kind === 5 ? 6 : 4.5 });
  }
  // pools, with a drip into each from the roof
  const pools = makePools();
  for (const [px, pz, pr] of POOLS) { pools.add(px, pz, pr, lights, 0.022); const top = ceilAt(px, pz); batch.add(6, px, top, pz, 0.035, 0.16, 0x9fc0e0, { ph: pools.list[pools.list.length - 1].ph, sp: 0.31, dir: [0, -(top - 0.05), 0] }); }

  // ---------------------------------------------------------------- meshes ----------------------------------------------------------------
  const rootG = new THREE.Group(), TX = H.textures();
  const fx = makeFx({ amb: [0.035, 0.045, 0.06], far: 21 });
  const wallM = lambert({ map: TX.rock, vertexColors: true, side: THREE.DoubleSide }), floorM = lambert({ map: TX.dirt, color: 0xb0a090, vertexColors: true, side: THREE.DoubleSide });
  const glowM = basic({ vertexColors: true, side: THREE.DoubleSide });
  const geo = (p, c, u) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); if (u) g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.computeVertexNormals(); return g; };
  let tris = 0;
  // signs first (they add meshes to tiles)
  const woodM = lambert({ map: H.wood, color: 0x7a5a38 });
  for (const [sx, sz, dx, dz, text] of SIGNS) {
    const [x, z, ux, uz] = march(sx, sz, dx, dz, 0.75), T = tileOf(x, z), g = new THREE.Group(); g.position.set(x, bil(FY, x, z), z); g.rotation.y = Math.atan2(-ux, -uz) + rnd(-0.25, 0.25);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.25, 0.07), woodM); post.position.y = 0.62; g.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.36, 0.04), woodM); board.position.set(0, 1.12, 0.05); board.rotation.z = rnd(-0.08, 0.08); g.add(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.3), basic({ map: H.fitSign(text, null, '#e8d8b0', 256, 56), transparent: true, opacity: 0.9 })); face.position.set(0, 1.12, 0.075); face.rotation.z = board.rotation.z; g.add(face);
    T.extra.push(g);
  }
  for (const T of tiles.values()) {
    const g = new THREE.Group(); T.group = g; rootG.add(g);
    if (T.wp.length) { g.add(new THREE.Mesh(geo(T.wp, T.wc, T.wu), wallM)); g.add(new THREE.Mesh(geo(T.fp, T.fc, T.fu), floorM)); tris += (T.wp.length + T.fp.length) / 9; }
    if (T.glow.p.length) { const m = new THREE.Mesh(geo(T.glow.p, T.glow.c), glowM); m.userData.noBake = true; g.add(m); tris += T.glow.p.length / 9; }
    const mm = T.mist.mesh(fx.mistMat); if (mm) g.add(mm);
    for (const e of T.extra) g.add(e);
    T.wp = T.wu = T.wc = T.fp = T.fu = T.fc = T.dec = T.glow = T.mist = T.extra = null;
  }
  const poolMesh = pools.mesh(fx.poolMat); if (poolMesh) { poolMesh.frustumCulled = false; rootG.add(poolMesh); }
  const glows = batch.mesh(fx.glowMat); if (glows) { glows.frustumCulled = false; rootG.add(glows); }
  // daylight at the mouth, the rope pit at the far end
  { const d = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), basic({ color: 0xc8d8e8, transparent: true, opacity: 0.85, fog: false })); d.position.set(0, 2, 60.1); d.rotation.y = Math.PI; rootG.add(d); }
  const pitG = new THREE.Group(); pitG.position.set(pit[0], 0, pit[2]); rootG.add(pitG);
  { const hole = new THREE.Mesh(new THREE.CircleGeometry(1.25, 11).rotateX(-Math.PI / 2), basic({ color: 0x000000 })); hole.position.y = 0.015; pitG.add(hole);
    const rim = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.55, 11).rotateX(-Math.PI / 2), lambert({ color: 0x3a342e })); rim.position.y = 0.02; pitG.add(rim);
    const top = ceilAt(pit[0] + 0.5, pit[2]) + 0.3, rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, top, 5), lambert({ color: 0xb8a070 })); rope.position.set(0.5, top / 2 - 0.2, 0); pitG.add(rope);
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), woodM); stake.position.set(0.5 - pitP.tz * 1.9, 0.35, pitP.tx * 1.9); pitG.add(stake); }
  const pitGlow = H.glowSprite(0x88aaff, 0.35); pitGlow.position.set(pit[0], 0.3, pit[2]); pitGlow.scale.set(2.6, 1.0, 1); rootG.add(pitGlow);
  const cols = [{ kind: 'box', cx: pit[0], cz: pit[2], w: 1.9, d: 1.9, rot: 0, h: 0.2 }];   // walk round the pit, not into it

  // ---------------------------------------------------------------- collision + per-frame ----------------------------------------------------------------
  /** Keep a circle of radius r inside the cave. Returns null, or {x, z, nx, nz} moved out of the rock. */
  const collide = (x, z, r) => {
    const lim = -(r + 0.14); let hit = false, nx = 0, nz = 0;
    for (let it = 0; it < 4; it++) {
      const d = field(x, z); if (d <= lim) break;
      let gx = field(x + 0.3, z) - field(x - 0.3, z), gz = field(x, z + 0.3) - field(x, z - 0.3); const l = Math.hypot(gx, gz);
      if (l < 1e-5) break;
      gx /= l; gz /= l; const push = Math.min(0.5, (d - lim) * 1.05 + 0.002);
      x -= gx * push; z -= gz * push; nx = -gx; nz = -gz; hit = true;
    }
    return hit ? { x, z, nx, nz } : null;
  };
  /** Rock at this point? (camera probe) */
  const solid = (x, y, z) => field(x, z) > -0.42 || y > ceilAt(x, z) - 0.38;
  const tlist = [...tiles.values()], _c = new THREE.Color(), cat = { x: 0, z: 50, moving: 0, y: 0.6 };
  let lastX = 0, lastZ = 50, vis = -1;
  const update = (t, cx, cz, torchOn = 1) => {
    const sp = Math.hypot(cx - lastX, cz - lastZ); lastX = cx; lastZ = cz;
    cat.x = cx; cat.z = cz; cat.moving += ((sp > 0.004 ? 1 : 0) - cat.moving) * 0.2;
    let n = 0;
    for (const T of tlist) { const v = Math.abs(T.cx - cx) < TILE / 2 + 24 && Math.abs(T.cz - cz) < TILE / 2 + 24; T.group.visible = v; if (v) n++; }
    vis = n;
    _c.set(torch.c).multiplyScalar(torchOn * (0.9 + 0.2 * Math.random()));
    fx.update(t, torch, _c, cat);
    pitGlow.material.opacity = 0.28 + Math.sin(t * 1.3) * 0.08;
  };
  const stats = { ms: Date.now() - t0, cells, tris: Math.round(tris), tiles: tiles.size, decor: nDecor, glows: batch.count, pools: pools.list.length, get visibleTiles() { return vis; } };
  return { root: rootG, main, branches, cols, lights, torch, collide, solid, update, pit, field, ceilAt, stats, pools: pools.list, fx };
}
