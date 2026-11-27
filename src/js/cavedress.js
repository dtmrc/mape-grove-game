// Dressing for the two hand-built ends of the Hollow Deep (2026-11-27): the ghost's dwelling (mist, pools under a
// moonlit shaft, candle shrines, cobwebs, embers, smoke, eyes in the corners) and the cave mouth outdoors (ferns, moss,
// mushrooms, roots over the opening, a puddle, ground mist, and ground cover along the approach from the trail).
// The branching cave between them dresses itself (cavegen.js). Shaders and batching live in cavefx.js.
import * as THREE from 'three';
import { lambert, basic } from './gfx.js';
import { makeFx, makeBatch, makePools, makeMist } from './cavefx.js';
import { soupKit, soupGeo } from './cavegen.js';

const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

function webTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(225,230,240,0.3)'; g.lineWidth = 1;
  const N = 7; for (let k = 0; k <= N; k++) { const a = k / N * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 64, Math.sin(a) * 64); g.stroke(); }
  for (let r = 10; r < 64; r += 9) { g.beginPath(); for (let k = 0; k <= N; k++) { const a = k / N * Math.PI / 2, rr = r * (k % 2 ? 0.93 : 1); if (k) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * The dwelling. o: { W, D, HT, FX, FZ, lights (the room's light list; shrine lights are appended, baked only), rockN }.
 * Returns { update(t, torch, torchCol, cat) }.
 */
export function dressLair(root, o) {
  const { W, D, HT, FX, FZ, lights, rockN } = o;
  const rr = seeded(1940), rnd = (a, b) => a + rr() * (b - a), K = soupKit(rr);
  const fx = makeFx({ amb: [0.05, 0.055, 0.075], far: 30, mist: 0.62 });
  // warm candle light at the shrines: baked into the walls and floor, no live cost
  const SHRINE = [[-3.2, 3.5, 5, 0.4], [4.6, -7.2, 5, 0.32], [-9.6, -10.6, 4, 0.3], [12.6, 6.6, 3, 0.25]];
  for (const [x, z, , i] of SHRINE) lights.push({ x, y: 0.5, z, c: 0xffb060, i, r: 0.1, halo: false });
  const POOLS = [[2.6, 6.6, 2.1], [-10.2, -6.6, 1.0], [-12.4, 1.2, 0.9], [11.2, -2.6, 0.8]];
  // ---- pools + drips + the moonlit shaft over the big one ----
  const pools = makePools(), batch = makeBatch(), smoke = makeBatch();
  for (const [x, z, r] of POOLS) { const p = pools.add(x, z, r, lights, 0.02); batch.add(6, x, HT - 0.6, z, 0.04, 0.2, 0xa8c8e8, { ph: p.ph, sp: 0.31, dir: [0, -(HT - 0.65), 0] }); }
  batch.add(3, POOLS[0][0], HT * 0.5, POOLS[0][1], 2.6, HT + 0.6, 0x26324e, { sp: 0.25 });
  batch.add(3, POOLS[0][0], 0.25, POOLS[0][1], 4.6, 1.2, 0x2a3a5c, { sp: 0.4 });
  // ---- mist: thick along the walls and round the water, thin by the fire ----
  const mist = makeMist(), pts = new Map();
  const mp = (i, j) => {
    const k = i * 64 + j; let p = pts.get(k);
    if (!p) {
      const x = -W / 2 + i, z = -D / 2 + j, edge = Math.min(W / 2 - Math.abs(x), D / 2 - Math.abs(z)), fire = sm((Math.hypot(x - FX, z - FZ) - 1.6) / 3.5);
      const pool = Math.max(0, 1 - Math.hypot(x - POOLS[0][0], z - POOLS[0][1]) / 5);
      const a = sm(edge / 1.2) * fire * Math.min(1, 0.3 + 0.6 * sm(1 - edge / 6) + 0.6 * pool + 0.35 * sm(rockN(x * 0.2, 70, z * 0.2) + 0.5));
      pts.set(k, p = [x, 0.3, z, a]);
    }
    return p;
  };
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) mist.quad(mp(i, j), mp(i + 1, j), mp(i + 1, j + 1), mp(i, j + 1), lights);
  // ---- candles: melted stubs in clusters, one flame billboard each ----
  const S = { p: [], c: [] }, wax = [0.93, 0.89, 0.78];
  const stub = (x, y, z, r, h) => {
    const n = 5, c2 = K.mul(wax, 0.8), ctr = [x, y + h / 2, z];
    for (let k = 0; k < n; k++) { const a = k / n * 6.283, b = (k + 1) / n * 6.283, A = [x + Math.cos(a) * r, y, z + Math.sin(a) * r], B = [x + Math.cos(b) * r, y, z + Math.sin(b) * r], A2 = [x + Math.cos(a) * r * 0.8, y + h, z + Math.sin(a) * r * 0.8], B2 = [x + Math.cos(b) * r * 0.8, y + h, z + Math.sin(b) * r * 0.8];
      K.put(S, A, B, A2, ctr, c2, c2, wax); K.put(S, B, B2, A2, ctr, c2, wax, wax); K.put(S, A2, B2, [x, y + h, z], [x, y, z], wax, wax, wax); }
    K.fan(S, x, y + 0.012, z, r * 2.2, 6, K.mul(wax, 0.75));                       // the puddle of wax
    batch.add(1, x, y + h + 0.07, z, 0.06, 0.15, 0xffb040);
  };
  for (const [x, z, n] of SHRINE) for (let k = 0; k < n; k++) { const a = k / n * 6.283 + rnd(0, 0.8), r = rnd(0.25, 0.7); stub(x + Math.cos(a) * r, 0, z + Math.sin(a) * r, rnd(0.03, 0.05), rnd(0.07, 0.26)); }
  // ---- moss and pale ferns in the damp corners, glowing mushrooms by the water ----
  const Gs = { p: [], c: [] };
  const MOSS = K.hex(0x1c4218), PALE = K.hex(0x2c6a50);
  for (let k = 0; k < 70; k++) {
    const side = (rr() * 4) | 0, t = rnd(-1, 1), x = side < 2 ? (side ? 1 : -1) * (W / 2 - rnd(0.9, 2.2)) : t * (W / 2 - 1), z = side < 2 ? t * (D / 2 - 1) : (side === 2 ? 1 : -1) * (D / 2 - rnd(0.9, 2.2));
    if (Math.hypot(x + 11, z - 11) < 2.2) continue;                                    // keep the rope landing clear
    if (rr() < 0.6) K.fan(S, x, 0.02, z, rnd(0.3, 0.8), 7, K.mul(MOSS, rnd(0.7, 1.2))); else K.fern(S, x, 0, z, rnd(0.3, 0.6), K.mul(PALE, rnd(0.7, 1.1)));
  }
  for (const [px, pz, pr] of POOLS) for (let k = 0; k < 7; k++) { const a = rnd(0, 6.283), r = pr * rnd(1.25, 1.7), x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r; K.shroom(S, Gs, x, 0, z, rnd(0.07, 0.22), rnd(0.04, 0.1), K.hex(0xbfe8e0), K.hex(k % 3 ? 0x6fe8d0 : 0x9a8aff), true); K.fan(S, x, 0.02, z, rnd(0.2, 0.45), 6, K.mul(MOSS, rnd(0.8, 1.2))); }
  // ---- cobwebs in the roof corners and across a few stalactites ----
  const webs = { p: [], u: [] };
  const web = (x, y, z, ax, ay, az, bx, by, bz) => { webs.p.push(x, y, z, x + ax, y + ay, z + az, x + ax + bx, y + ay + by, z + az + bz, x, y, z, x + ax + bx, y + ay + by, z + az + bz, x + bx, y + by, z + bz); webs.u.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = sx * (W / 2 - 1.1), z = sz * (D / 2 - 1.1); web(x, 4.3, z, -sx * 2.6, 0.2, 0, 0, -0.3, -sz * 2.6); if (sx * sz > 0) web(x, 4.2, z, -sx * 2.2, -0.2, 0, 0, -2.0, 0); else web(x, 4.2, z, 0, -0.2, -sz * 2.2, 0, -2.0, 0); }
  web(-13.4, 2.1, -4.4, 0, 0, 2.4, 0, -1.3, 0); web(-1.2, 4.9, 2.5, 1.8, 0.2, 0.4, 0.1, -1.6, 0.2); web(7.2, 4.8, -4, 1.5, 0, 1.2, 0, -1.5, 0.1); web(-7.5, 4.7, -3, -1.3, 0.1, 1.3, 0, -1.4, 0);
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(webs.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(webs.u, 2));
    const m = new THREE.Mesh(g, basic({ map: webTex(), transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })); m.renderOrder = 4; root.add(m); }
  // ---- eyes in the dark corners (they shut when the cat comes close), wisps, embers and smoke off the fire ----
  for (const [x, y, z, kind] of [[-13.6, 1.9, -11.2, 2], [13.4, 2.3, -11.4, 2], [-13.8, 1.3, 11.3, 2], [13.6, 1.6, 11.2, 2], [-14.2, 3.4, 4.5, 2], [14.2, 3.1, 0.5, 2], [5.5, 3.9, -12.4, 2], [-6.5, 3.6, 12.4, 2], [14.1, 0.5, -6.6, 2], [-2.6, 4.3, -12.5, 5]])
    batch.add(kind, x, y, z, kind === 5 ? 0.32 : 0.28, kind === 5 ? 0.16 : 0.14, kind === 5 ? 0xbcd0ff : rr() < 0.75 ? 0xe8f08a : 0xff6a4a, { ex: 5.5 });
  for (let k = 0; k < 12; k++) batch.add(0, rnd(-W / 2 + 2, W / 2 - 2), rnd(0.4, 1.6), rnd(-D / 2 + 2, D / 2 - 2), 0.15, 0.15, 0x7fa8ff, { sp: rnd(0.03, 0.06), dir: [rnd(-1.5, 1.5), rnd(1.2, 2.6), rnd(-1.5, 1.5)] });
  for (let k = 0; k < 9; k++) batch.add(0, FX + rnd(-0.3, 0.3), 0.7, FZ + rnd(-0.3, 0.3), 0.05, 0.05, 0xff9a30, { sp: rnd(0.18, 0.32), dir: [rnd(-0.7, 0.7), rnd(2.2, 3.6), rnd(-0.7, 0.7)] });
  for (let k = 0; k < 5; k++) smoke.add(4, FX + rnd(-0.15, 0.15), 1.3, FZ + rnd(-0.15, 0.15), 1.3, 1.3, 0x8a8480, { sp: rnd(0.07, 0.11), ex: 0.22, dir: [rnd(-0.5, 0.5), 3.6, rnd(-0.5, 0.5)] });
  for (const [px, pz] of POOLS.slice(0, 2)) for (let k = 0; k < 2; k++) smoke.add(4, px + rnd(-0.8, 0.8), 0.25, pz + rnd(-0.8, 0.8), 1.6, 0.9, 0xb8c8e0, { sp: rnd(0.04, 0.07), ex: 0.14, dir: [rnd(-0.6, 0.6), 0.9, rnd(-0.6, 0.6)] });
  // ---- meshes ----
  root.add(new THREE.Mesh(soupGeo(S), lambert({ vertexColors: true, side: THREE.DoubleSide })));
  { const m = new THREE.Mesh(soupGeo(Gs), basic({ vertexColors: true, side: THREE.DoubleSide })); m.userData.noBake = true; root.add(m); }
  for (const m of [pools.mesh(fx.poolMat), mist.mesh(fx.mistMat), smoke.mesh(fx.wispMat), batch.mesh(fx.glowMat)]) if (m) { m.frustumCulled = false; root.add(m); }
  return { fx, pools: pools.list, update: (t, torch, col, cat) => fx.update(t, torch, col, cat) };
}

/**
 * The cave mouth outdoors. Everything is mouth-local (x right, z out of the cave, y above the mouth's own ground).
 * o: { hAt(lx, lz), rocks: [[lx, lz, s, sx, sy, sz, yo]], clear(lx, lz) -> false where nothing may grow (posts, path) }.
 * Returns { fx, update(t, hour, torch, torchCol, cat) }.
 */
export function dressMouth(mouth, o) {
  const { hAt, rocks } = o;
  const rr = seeded(4243), rnd = (a, b) => a + rr() * (b - a), K = soupKit(rr);
  const fx = makeFx({ amb: [0.06, 0.07, 0.1], far: 46 });
  const S = { p: [], c: [] }, Gs = { p: [], c: [] };
  const MOSS = K.hex(0x35602a), FERN = K.hex(0x2f6a2a), ROOT = K.hex(0x4a3524), ROCK = K.hex(0x7c766a);
  const free = (lx, lz) => !(Math.abs(lx) < 1.5 && lz > -1.5) && !(Math.hypot(lx - 1.9, lz - 0.7) < 0.9) && !(Math.hypot(lx + 2.3, lz - 1.6) < 1.0);
  // moss caps on the rock face, roots and vines hanging over the opening
  for (const [lx, lz, s, sx, sy, sz, yo] of rocks) {
    const top = hAt(lx, lz) + (yo ?? s * sy * 0.55) + s * sy * 0.62;
    for (let k = 0, n = 2 + (s * 2 | 0); k < n; k++) { const a = rnd(0, 6.283), r = s * rnd(0, 0.55); K.rock(S, lx + Math.cos(a) * r * sx, top - r * 0.5 - 0.05, lz + Math.sin(a) * r * sz, s * rnd(0.25, 0.45), s * 0.12, s * rnd(0.25, 0.45), K.mul(MOSS, rnd(0.75, 1.2))); }
  }
  { const y0 = hAt(0, -1.0) + 2.5; for (let k = 0; k < 11; k++) { const lx = rnd(-1.5, 1.5); K.root(S, lx, y0 + rnd(-0.1, 0.25), -0.95 + rnd(-0.1, 0.15), rnd(0.5, 1.5) * (1 - Math.abs(lx) * 0.25), K.mul(k % 3 ? ROOT : MOSS, rnd(0.8, 1.2))); } }
  // ground cover round the mouth: ferns, moss, mushrooms, scree
  for (let k = 0; k < 150; k++) {
    const a = rnd(0, 6.283), r = rnd(1.6, 12), lx = Math.cos(a) * r, lz = Math.sin(a) * r * 0.8 + 1; if (!free(lx, lz) || lz < -3.2) continue;
    const y = hAt(lx, lz), u = rr();
    if (u < 0.42) K.fern(S, lx, y, lz, rnd(0.4, 0.95), K.mul(FERN, rnd(0.7, 1.2)));
    else if (u < 0.62) K.fan(S, lx, y + 0.03, lz, rnd(0.3, 0.9), 7, K.mul(MOSS, rnd(0.7, 1.2)));
    else if (u < 0.8) { const glow = r < 5 && rr() < 0.5; for (let q = 0, n = 3 + (rr() * 4 | 0); q < n; q++) K.shroom(S, Gs, lx + rnd(-0.3, 0.3), y - 0.01, lz + rnd(-0.3, 0.3), rnd(0.07, 0.24), rnd(0.05, 0.12), glow ? K.hex(0xbfe8e0) : K.hex(0xd8d0bc), glow ? K.hex(0x6fe8d0) : K.hex(rr() < 0.5 ? 0xa8402a : 0x8a5a3a), glow); }
    else { const s = rnd(0.08, 0.3); K.rock(S, lx, y + s * 0.25, lz, s * 1.2, s * 0.7, s, K.mul(ROCK, rnd(0.8, 1.15))); if (rr() < 0.5) K.fan(S, lx, y + s * 0.6, lz, s * 0.6, 5, K.mul(MOSS, 1)); }
  }
  // the approach from the trail (about 55 m east, straight out of the mouth): thicker undergrowth and a feather now and then
  for (let k = 0; k < 170; k++) {
    const lz = rnd(11, 56), lx = rnd(-9, 9) * (0.5 + lz / 110); if (Math.abs(lx) < 1.1) continue;
    const y = hAt(lx, lz), u = rr();
    if (u < 0.5) K.fern(S, lx, y, lz, rnd(0.45, 1.0), K.mul(FERN, rnd(0.7, 1.2)));
    else if (u < 0.68) K.fan(S, lx, y + 0.03, lz, rnd(0.4, 1.0), 7, K.mul(MOSS, rnd(0.7, 1.2)));
    else if (u < 0.86) { for (let q = 0, n = 3 + (rr() * 4 | 0); q < n; q++) K.shroom(S, Gs, lx + rnd(-0.3, 0.3), y - 0.01, lz + rnd(-0.3, 0.3), rnd(0.07, 0.26), rnd(0.05, 0.13), K.hex(0xd8d0bc), K.hex(rr() < 0.5 ? 0xa8402a : 0x8a5a3a), false); }
    else { const s = rnd(0.12, 0.4); K.rock(S, lx, y + s * 0.25, lz, s * 1.3, s * 0.7, s, K.mul(ROCK, rnd(0.8, 1.15))); K.fan(S, lx, y + s * 0.62, lz, s * 0.7, 5, K.mul(MOSS, 1)); }
  }
  for (let lz = 6; lz < 56; lz += rnd(3, 5.5)) { const lx = rnd(-0.9, 0.9), y = hAt(lx, lz) + 0.035, a = rnd(0, 6.283), dx = Math.cos(a) * 0.09, dz = Math.sin(a) * 0.09, px = -dz * 0.38, pz = dx * 0.38, c = K.hex(rr() < 0.5 ? 0xf4f0e8 : 0xa0683a), up = [lx, y - 1, lz];
    K.put(S, [lx - dx - px, y, lz - dz - pz], [lx + dx - px, y, lz + dz - pz], [lx + dx + px, y, lz + dz + pz], up, c, c, c); K.put(S, [lx - dx - px, y, lz - dz - pz], [lx + dx + px, y, lz + dz + pz], [lx - dx + px, y, lz - dz + pz], up, c, c, c); }
  const m1 = new THREE.Mesh(soupGeo(S), lambert({ vertexColors: true, side: THREE.DoubleSide })); mouth.add(m1);
  const m2 = new THREE.Mesh(soupGeo(Gs), basic({ vertexColors: true, side: THREE.DoubleSide })); mouth.add(m2);
  // a puddle by the opening, ground mist that pours out of the cave, something watching from inside
  const pools = makePools(), batch = makeBatch(), mist = makeMist();
  const PX = -1.0, PZ = 3.6; pools.add(PX, PZ, 1.15, [], hAt(PX, PZ) + 0.035);
  const pts = new Map(), GS = 1.5, NXm = 16, NZm = 22;
  const mp = (i, j) => { const k = i * 64 + j; let p = pts.get(k); if (!p) { const lx = (i - NXm / 2) * GS, lz = -2 + j * GS, d = Math.hypot(lx * 1.25, lz - 1) / 16; pts.set(k, p = [lx, hAt(lx, lz) + 0.32, lz, sm(1.15 - d) * (lz < -1.2 ? 0 : 1) * (0.55 + 0.45 * sm(1 - Math.hypot(lx, lz) / 7))]); } return p; };
  for (let i = 0; i < NXm; i++) for (let j = 0; j < NZm; j++) mist.quad(mp(i, j), mp(i + 1, j), mp(i + 1, j + 1), mp(i, j + 1));
  const hy = hAt(0, -1.2);
  batch.add(5, 0.25, hy + 1.05, -1.12, 0.3, 0.15, 0xbcd0ff, { ex: 7 });
  batch.add(2, -0.7, hy + 0.45, -1.14, 0.24, 0.12, 0xe8f08a, { ex: 5 });
  for (let k = 0; k < 5; k++) batch.add(0, rnd(-0.8, 0.8), hy + rnd(0.5, 1.6), -1.0, 0.15, 0.15, 0x7fa8ff, { sp: rnd(0.035, 0.06), dir: [rnd(-1.5, 1.5), rnd(0.3, 1.2), rnd(4, 7)] });
  const fxm = [pools.mesh(fx.poolMat), mist.mesh(fx.mistMat), batch.mesh(fx.glowMat)];
  for (const m of fxm) if (m) { m.frustumCulled = false; mouth.add(m); }
  const _amb = new THREE.Color();
  return {
    fx,
    /** hour 0..24; torch/cat in mouth-local coordinates. */
    update(t, hour, torch, col, cat) {
      const day = sm((hour - 5.5) / 2) * (1 - sm((hour - 18.3) / 2));
      fx.U.uAmb.value.copy(_amb.setRGB(0.05 + 0.4 * day, 0.06 + 0.42 * day, 0.1 + 0.42 * day));
      fx.U.uMist.value = 1.0 - 0.5 * day;
      if (fxm[2]) fxm[2].visible = day < 0.85;       // nothing glows at noon
      fx.update(t, torch, col, cat);
    },
  };
}
