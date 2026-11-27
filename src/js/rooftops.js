// Walkable roofs (2026-11-26, diet: "as a cat i should be able to climb trees and jump onto roofs of houses").
// Every building collider (c.bld) gets a small height grid of the real roof surface under it, rasterised once at load
// from the merged static geometry (Tracebench houses, gabled town houses, flat shop roofs alike). colTop/collide in
// world.js read it through roofTop(), so the cat walks up a gable instead of floating at the collider's box top.
// Load cost: one pass over the static triangles that sit over a building. Runtime: one bilinear lookup per collider hit.

const CELL = 0.25;          // grid spacing (m)
const K = 8, key = (i, j) => (i + 1024) * 4096 + j + 1024;   // coarse 8 m spatial index
const SCELL = 0.25, SLABS = [], SIX = new Map();          // overhang slabs: Int16 cm heights, -1 = nothing to stand on
const SKIP = new Set(['leaves', 'shadow', 'shadowR', 'grass', 'road', 'asphalt', 'crosswalk', 'sidewalk', 'dirt', 'puddle', 'creek', 'lamp']);

/** c.rg = { x0, z0, nx, nz, H } (ground-relative heights, world-axis grid over the collider's bounds). */
export function buildRoofs(colliders, buckets, bounds) {
  const T = colliders.filter((c) => c.bld && !c.poly && !c.water);
  if (!T.length) return 0;
  // overhangs (2026-11-27, diet: "on houses where there is a porch overhang, i should be able to climb onto that roof
  // overhang"): one slab grid per cluster of building colliders, 3.5 m past the walls, holding every roof surface 2 m+ up
  // that has no wall under it (porch roofs, eaves, awnings). Standable only (slabTop), never a wall.
  SLABS.length = 0; SIX.clear();
  const PAD = 3.5, boxes = T.map((c) => { const [a, b, d, e] = bounds(c); return { a: a - PAD, b: b + PAD, d: d - PAD, e: e + PAD }; });
  const par = boxes.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (A.a < B.b && B.a < A.b && A.d < B.e && B.d < A.e) par[find(i)] = find(j);
  }
  const groups = new Map();
  boxes.forEach((B, i) => { const r = find(i), g = groups.get(r); if (!g) groups.set(r, { ...B }); else { g.a = Math.min(g.a, B.a); g.b = Math.max(g.b, B.b); g.d = Math.min(g.d, B.d); g.e = Math.max(g.e, B.e); } });
  for (const g of groups.values()) {
    if ((g.b - g.a) * (g.e - g.d) > 120 * 120) continue;   // a whole block merged together: skip rather than allocate a huge grid
    const nx = Math.ceil((g.b - g.a) / SCELL) + 1, nz = Math.ceil((g.e - g.d) / SCELL) + 1;
    const S = { slab: true, x0: g.a, z0: g.d, x1: g.b, z1: g.e, nx, nz, H: new Int16Array(nx * nz).fill(-1), L: new Int16Array(nx * nz).fill(32767) };   // highest + lowest surface per cell (a porch roof under the eave)
    SLABS.push(S);
  }
  for (const S of SLABS) for (let i = Math.floor(S.x0 / K); i <= Math.floor(S.x1 / K); i++) for (let j = Math.floor(S.z0 / K); j <= Math.floor(S.z1 / K); j++) {
    const k = key(i, j); (SIX.get(k) || SIX.set(k, []).get(k)).push(S);
  }
  // coarse 8 m index of the targets
  const IX = new Map();
  for (const S of SLABS) {
    for (let i = Math.floor(S.x0 / K); i <= Math.floor(S.x1 / K); i++) for (let j = Math.floor(S.z0 / K); j <= Math.floor(S.z1 / K); j++) {
      const k = key(i, j); (IX.get(k) || IX.set(k, []).get(k)).push(S);
    }
  }
  for (const c of T) {
    const [a, b, d, e] = bounds(c);
    const nx = Math.max(1, Math.ceil((b - a) / CELL) + 1), nz = Math.max(1, Math.ceil((e - d) / CELL) + 1);
    c.rg = { x0: a, z0: d, nx, nz, H: new Float32Array(nx * nz).fill(-1), hmax: c.top ?? c.h ?? 5 };
    for (let i = Math.floor(a / K); i <= Math.floor(b / K); i++) for (let j = Math.floor(d / K); j <= Math.floor(e / K); j++) {
      const k = key(i, j); (IX.get(k) || IX.set(k, []).get(k)).push(c);
    }
  }
  const hits = [];
  const near = (a, b, d, e) => {
    hits.length = 0;
    for (let i = Math.floor(a / K); i <= Math.floor(b / K); i++) for (let j = Math.floor(d / K); j <= Math.floor(e / K); j++) {
      const l = IX.get(key(i, j)); if (l) for (const c of l) if (!hits.includes(c)) hits.push(c);
    }
    return hits;
  };
  for (const [k, list] of Object.entries(buckets)) {
    if (SKIP.has(k)) continue;
    for (const g of list) {
      const P = g.attributes.position.array, n = P.length;
      let a = 1e9, b = -1e9, d = 1e9, e = -1e9, top = -1e9;
      for (let i = 0; i < n; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; if (x < a) a = x; if (x > b) b = x; if (z < d) d = z; if (z > e) e = z; if (y > top) top = y; }
      if (top < 0.9 || !near(a, b, d, e).length) continue;
      const cs = hits.slice();
      for (let t = 0; t < n; t += 9) {
        const ax = P[t], ay = P[t + 1], az = P[t + 2], bx = P[t + 3], by = P[t + 4], bz = P[t + 5], cx = P[t + 6], cy = P[t + 7], cz = P[t + 8];
        if (ay < 0.9 && by < 0.9 && cy < 0.9) continue;
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz); if (L < 1e-9 || Math.abs(ny) < 0.5 * L) continue;   // walls and steep faces
        const det = ux * vz - uz * vx; if (Math.abs(det) < 1e-9) continue;
        const tx0 = Math.min(ax, bx, cx), tx1 = Math.max(ax, bx, cx), tz0 = Math.min(az, bz, cz), tz1 = Math.max(az, bz, cz);
        const hi = Math.max(ay, by, cy) >= 2.0;
        for (const c of cs) {
          if (c.slab) {   // overhang slab: surfaces 2 m+ up, nearest cell, cm
            if (!hi) continue;
            const S = c;
            if (tx1 < S.x0 || tz1 < S.z0 || tx0 > S.x1 || tz0 > S.z1) continue;
            const i0 = Math.max(0, Math.ceil((tx0 - S.x0) / SCELL)), i1 = Math.min(S.nx - 1, Math.floor((tx1 - S.x0) / SCELL));
            const j0 = Math.max(0, Math.ceil((tz0 - S.z0) / SCELL)), j1 = Math.min(S.nz - 1, Math.floor((tz1 - S.z0) / SCELL));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
              const px = S.x0 + i * SCELL - ax, pz = S.z0 + j * SCELL - az;
              const s2 = (px * vz - pz * vx) / det, q2 = (ux * pz - uz * px) / det;
              if (s2 < -1e-4 || q2 < -1e-4 || s2 + q2 > 1.0001) continue;
              const y = ay + s2 * uy + q2 * vy, o = j * S.nx + i;
              if (y < 2.0) continue;
              const cm = Math.min(32000, Math.round(y * 100));
              if (cm > S.H[o]) S.H[o] = cm;
              if (cm < S.L[o]) S.L[o] = cm;
            }
            continue;
          }
          const R = c.rg;
          if (tx1 < R.x0 || tz1 < R.z0 || tx0 > R.x0 + (R.nx - 1) * CELL || tz0 > R.z0 + (R.nz - 1) * CELL) continue;
          const i0 = Math.max(0, Math.ceil((tx0 - R.x0) / CELL)), i1 = Math.min(R.nx - 1, Math.floor((tx1 - R.x0) / CELL));
          const j0 = Math.max(0, Math.ceil((tz0 - R.z0) / CELL)), j1 = Math.min(R.nz - 1, Math.floor((tz1 - R.z0) / CELL));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const px = R.x0 + i * CELL - ax, pz = R.z0 + j * CELL - az;
            const s = (px * vz - pz * vx) / det, q = (ux * pz - uz * px) / det;
            if (s < -1e-4 || q < -1e-4 || s + q > 1.0001) continue;
            const y = ay + s * uy + q * vy, o = j * R.nx + i;
            if (y > R.H[o] && y <= R.hmax + 0.6) R.H[o] = y;
          }
        }
      }
    }
  }
  // fill gaps (cells no up-facing face covered) from their neighbours; what is still empty keeps the box top
  for (const c of T) {
    const R = c.rg, H = R.H;
    let empty = 0; for (let o = 0; o < H.length; o++) if (H[o] < 0) empty++;
    if (empty === H.length) { delete c.rg; continue; }
    for (let pass = 0; pass < 6 && empty; pass++) {
      const S = H.slice();
      for (let j = 0; j < R.nz; j++) for (let i = 0; i < R.nx; i++) {
        const o = j * R.nx + i; if (S[o] >= 0) continue;
        let m = -1;
        if (i > 0) m = Math.max(m, S[o - 1]); if (i < R.nx - 1) m = Math.max(m, S[o + 1]);
        if (j > 0) m = Math.max(m, S[o - R.nx]); if (j < R.nz - 1) m = Math.max(m, S[o + R.nx]);
        if (m >= 0) { H[o] = m; empty--; }
      }
    }
    for (let o = 0; o < H.length; o++) if (H[o] < 0) H[o] = R.hmax;
    R.cx = c.cx; R.cz = c.cz; R.ax0 = c.x0;   // where the collider was: an editor move drops the grid
  }
  return T.length;
}

/** The highest overhang surface (porch roof, eave, awning) at x,z that the cat can stand on from height y (steps up
 *  0.5 m), else 0. Slabs never block: colliders still do the walls. */
export function slabTop(x, z, y) {
  const l = SIX.get(key(Math.floor(x / K), Math.floor(z / K)));
  let best = 0;
  if (l) for (const S of l) {
    if (x < S.x0 || x > S.x1 || z < S.z0 || z > S.z1) continue;
    const o = Math.round((z - S.z0) / SCELL) * S.nx + Math.round((x - S.x0) / SCELL);
    let h = S.H[o] / 100; if (h > y + 0.5) h = S.L[o] / 100;
    if (h > best && h <= y + 0.5) best = h;
  }
  return best;
}
export const slabStats = () => ({ n: SLABS.length, cells: SLABS.reduce((s, S) => s + S.H.length, 0) });

/** The roof height of collider c at x,z (clamped to its grid); the box top if it has no grid or was moved in the editor. */
export function roofTop(c, x, z) {
  const R = c.rg;
  if (!R || R.cx !== c.cx || R.cz !== c.cz || R.ax0 !== c.x0) return c.top ?? c.h ?? 5;
  let gx = (x - R.x0) / CELL, gz = (z - R.z0) / CELL;
  gx = gx < 0 ? 0 : gx > R.nx - 1.001 ? R.nx - 1.001 : gx;
  gz = gz < 0 ? 0 : gz > R.nz - 1.001 ? R.nz - 1.001 : gz;
  if (R.nx < 2 || R.nz < 2) return R.H[0];
  const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j, k = j * R.nx + i, H = R.H;
  return (H[k] + (H[k + 1] - H[k]) * fx) * (1 - fz) + (H[k + R.nx] + (H[k + R.nx + 1] - H[k + R.nx]) * fx) * fz;
}
