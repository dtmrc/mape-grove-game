// geopack.js: smaller vertex formats for big static meshes (2026-11-27).
// The world is 1.3 million vertices of merged geometry. Normals and vertex colours were 32-bit floats (12 bytes each per
// vertex); here they become 16-bit normalised integers (6 bytes each), in memory and on the GPU. A 16-bit step is
// 1/32767 for a normal and 1/65535 for a colour, hundreds of times finer than one 8-bit step on screen, so the picture
// is the same. Positions, texture coordinates and the terrain anchor stay floats (they need the range).
import * as THREE from 'three';

export const PACK = { on: true, saved: 0 };
if (typeof window !== 'undefined') window.__PACK = PACK;

/** Pack `normal` and `color` of a geometry in place. Colours brighter than 1 (or negative) stay floats. */
export function packGeo(g) {
  if (!PACK.on || !g || !g.attributes) return g;
  const N = g.attributes.normal, C = g.attributes.color;
  if (N && N.array instanceof Float32Array && N.itemSize === 3 && !N.isInterleavedBufferAttribute) {
    const a = N.array, o = new Int16Array(a.length);
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2], k = 32767 / (Math.hypot(x, y, z) || 1);
      o[i] = Math.round(x * k); o[i + 1] = Math.round(y * k); o[i + 2] = Math.round(z * k);
    }
    g.setAttribute('normal', new THREE.BufferAttribute(o, 3, true)); PACK.saved += a.byteLength - o.byteLength;
  }
  if (C && C.array instanceof Float32Array && !C.isInterleavedBufferAttribute) {
    const a = C.array; let ok = true;
    for (let i = 0; i < a.length; i++) if (!(a[i] >= 0 && a[i] <= 1)) { ok = false; break; }
    if (ok) {
      const o = new Uint16Array(a.length);
      for (let i = 0; i < a.length; i++) o[i] = Math.round(a[i] * 65535);
      g.setAttribute('color', new THREE.BufferAttribute(o, C.itemSize, true)); PACK.saved += a.byteLength - o.byteLength;
    }
  }
  return g;
}
