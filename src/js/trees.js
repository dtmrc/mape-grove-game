// Tree crowns (render pass 2026-11-27): faceted low-poly canopies with baked vertex shading, built once per tree and
// merged into world.js's 'leaves' bucket (no extra draw calls). Same or fewer triangles than the old crowns.
//  - round: a clustered crown of 4-5 jittered lumps (irregular silhouette instead of two smooth balls)
//  - pine: 3-4 stacked star-rimmed tiers that droop at the tips, with a closed underside on the lowest tier
// Shading lives in a 'color' attribute (world.js addS multiplies it by the tree's tint): darker underneath and in the
// notches, lighter at the top, so crowns read as volumes even in flat light. Variation comes from a hash of the tree's
// position, never from the town's seeded random sequence (that would move every prop placed after it).
import * as THREE from 'three';

export const hash = (x, z, k = 0) => { const h = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return h - Math.floor(h); };
const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/** Bake top-lit / inner-dark vertex colours onto a crown piece. y0..y1 = crown bottom..top (local), rad = crown radius. */
function shade(g, y0, y1, rad, k = 1, lo = 0.62, hi = 1.14) {
  const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = sm((p.getY(i) - y0) / (y1 - y0)), out = Math.min(1, Math.hypot(p.getX(i), p.getZ(i)) / rad);
    const f = (lo + (hi - lo) * t) * (0.8 + 0.2 * out) * k;
    c[i * 3] = f; c[i * 3 + 1] = f; c[i * 3 + 2] = f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** A lumpy, flat-shaded ball: an icosahedron whose corners are pushed in and out (consistently, so it stays closed). */
function lump(r, detail, seed, sy = 0.88) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.9 + 0.17 * hash(Math.round(x * 40), Math.round(z * 40) + Math.round(y * 40) * 7, seed);
    p.setXYZ(i, x * k, y * k * sy, z * k);
  }
  // soft (spherical) normals: an irregular silhouette, shaded like a leafy mass rather than a rock
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) / sy, z = p.getZ(i), l = Math.hypot(x, y, z) || 1; nr.setXYZ(i, x / l, y / l, z / l); }
  return g;
}

/** Round (deciduous) crown, local to the tree base, for a tree at world x,z with scale s. ry0/ry1 = the two random turns
 *  world.js already rolls for a round tree (kept so the seeded sequence doesn't shift). Returns [{ g, tint }]. */
export function roundCrown(x, z, s, lite, ry0, ry1) {
  const out = [], d = lite ? 0 : 1, h = (k) => hash(x, z, k);
  const main = lump(1.65 * s, d, 1 + ((h(1) * 9) | 0)); main.rotateY(ry0); main.translate(0, 3.2 * s, 0);
  out.push({ g: shade(main, 1.7 * s, 4.9 * s, 1.6 * s), tint: 0xffffff });
  const n = lite ? 2 : 3, a0 = ry1;
  for (let k = 0; k < n; k++) {
    const a = a0 + k * (Math.PI * 2 / n) + (h(10 + k) - 0.5) * 0.8, r = (0.85 + h(20 + k) * 0.35) * s, off = (0.85 + h(30 + k) * 0.25) * s;
    const g = lump(r, 0, 5 + k); g.translate(Math.cos(a) * off, (2.85 + h(40 + k) * 0.55) * s, Math.sin(a) * off);
    out.push({ g: shade(g, 1.7 * s, 4.9 * s, 2.2 * s, 0.96 + h(50 + k) * 0.1), tint: k === 1 ? 0xeaffdc : 0xffffff });
  }
  const top = lump(1.1 * s, 0, 9); top.translate(0.2 * s, 4.2 * s, -0.12 * s);
  out.push({ g: shade(top, 1.7 * s, 4.9 * s, 1.6 * s, 1.02), tint: 0xdfffd0 });
  return out;
}

/** Pine crown: stacked star-rimmed tiers. Returns one geometry (local to the tree base) with baked shading. */
export function pineCrown(x, z, s, lite) {
  const tiers = lite ? 3 : s > 1.2 ? 4 : 3, segs = lite ? 6 : 10, a0 = hash(x, z, 3) * 6.28;
  const P = [], U = [], C = [];
  const yTop = (1.5 + tiers * 1.0 + 1.2) * s;
  const tri = (a, b, c, ca, cb, cc, out) => {
    // wind so the face points away from the trunk axis (or down, for the underside)
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
    const dot = out === 'down' ? -ny : nx * mx + nz * mz + ny * 0.2;
    const L = dot < 0 ? [a, c, b] : [a, b, c], K = dot < 0 ? [ca, cc, cb] : [ca, cb, cc];
    for (let i = 0; i < 3; i++) { P.push(...L[i]); U.push(L[i][0] * 0.24 + L[i][2] * 0.14, L[i][1] * 0.22 + L[i][2] * 0.1); C.push(K[i], K[i], K[i]); }
  };
  for (let t = 0; t < tiers; t++) {
    const f = t / Math.max(1, tiers - 1);
    const r = (1.95 - 1.05 * f) * s * (0.92 + hash(x, z, 60 + t) * 0.16);
    const y0 = (1.5 + t * 1.0) * s, y1 = y0 + (2.5 - 0.4 * f) * s;
    const apex = [0, y1, 0], spin = a0 + t * 0.7;
    const rim = [];
    for (let j = 0; j < segs; j++) {
      const a = spin + (j / segs) * Math.PI * 2, notch = j % 2 === 1;
      const rr = r * (notch ? 0.84 : 1), yy = y0 + (notch ? 0.16 * s : -0.14 * s);
      rim.push([Math.cos(a) * rr, yy, Math.sin(a) * rr, notch]);
    }
    const lit = 0.86 + 0.3 * (y1 / yTop);   // higher tiers catch more light
    for (let j = 0; j < segs; j++) {
      const A = rim[j], B = rim[(j + 1) % segs];
      tri(apex, A.slice(0, 3), B.slice(0, 3), lit * 1.1, A[3] ? lit * 0.7 : lit * 0.84, B[3] ? lit * 0.7 : lit * 0.84, 'out');
    }
    if (t === 0 && !lite) {   // underside of the lowest tier, so the tree isn't hollow from below
      const c = [0, y0 + 0.5 * s, 0];
      for (let j = 0; j < segs; j++) { const A = rim[j], B = rim[(j + 1) % segs]; tri(c, A.slice(0, 3), B.slice(0, 3), 0.42, 0.5, 0.5, 'down'); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  return g;
}

/** A bush: one jittered, soft-shaded lump with a darker base. ry = the turn world.js already rolls for it. */
export function bushCrown(x, z, s, ry) {
  const g = lump(0.72 * s, 1, 3 + ((hash(x, z, 7) * 9) | 0), 0.8); g.rotateY(ry); g.translate(0, 0.45 * s, 0);
  return shade(g, 0, 1.05 * s, 0.75 * s, 1, 0.55, 1.12);
}
