// Engine core: heightfield terrain, movable world groups, editable colliders.
//
// How it works
// - The world is still built flat by world.js. Before its geometry is merged, prepareWorld() tags every vertex with
//   an anchor (vec3 attribute `tanc` = anchor x, anchor z, group):
//     group -1: flat ground pieces (roads, lots, decals). They drape: each vertex rides the terrain at its own x,z.
//     group  0: rigid static props. The whole piece rises by the terrain height at its anchor (no bending).
//     group >0: a movable group (a building, tree, lamp...) keyed by its main collider. Rigid, plus the group's
//               move / rotate / hide from the editor.
//   A patched vertex shader reads two data textures (heights + group transforms), so terrain sculpting and moving
//   buildings are live with no rebuild.
// - Gameplay stays in ground-relative space (P.y, car y, ped y are heights above the ground). beforeRender() lifts
//   every dynamic scene object onto the terrain for the frame (and tilts cars), afterRender() puts them back.
// - Final height = base (procedural rolling hills, flattened under roads/buildings/lots/the lake) + delta (sculpted
//   by hand in the editor and saved to the artifact database).
import * as THREE from 'three';

// ---------- heightfield ----------
export const TN = 201, TCELL = 2, TX0 = -200, TZ0 = -200;          // 201x201 samples, 2 m apart, covering ±200 m
export const base = new Float32Array(TN * TN);                       // procedural hills (masked)
export const delta = new Float32Array(TN * TN);                      // hand-sculpted offsets
export const H = new Float32Array(TN * TN);                          // base + delta (what everything uses)
export const flatMask = new Float32Array(TN * TN);                   // 0 = must stay flat .. 1 = full hills
export const settings = { amp: 1 };

const clampi = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Terrain height at world x,z (bilinear; matches the GPU exactly). */
export function heightAt(x, z) {
  let gx = (x - TX0) / TCELL, gz = (z - TZ0) / TCELL;
  gx = gx < 0 ? 0 : gx > TN - 1.001 ? TN - 1.001 : gx;
  gz = gz < 0 ? 0 : gz > TN - 1.001 ? TN - 1.001 : gz;
  const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j, k = j * TN + i;
  const a = H[k], b = H[k + 1], c = H[k + TN], d = H[k + TN + 1];
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
/** Walkable decks above the ground (dock, gazebo, porches): { top, x0..z1 } boxes, { top, cx, cz, hw, hd, c, s } turned
 *  boxes, { t0, t1, cx, cz, hw, hd, c, s } ramps or { top, cx, cz, r } discs, all ground-relative. floorAt gives the deck height under x,z that the player can
 *  stand on from height y (steps up to 0.5 m), else 0. */
export const floors = [];
/** The deck floorAt last picked (null = ground or a collider top). A deck with `bounce` is a trampoline. */
export let floorHit = null;
let floorProvider = null;
/** world.js registers a function giving the highest standable collider top at x,z reachable from y. */
export function setFloorProvider(fn) { floorProvider = fn; }
export function floorAt(x, z, y = 0) {
  let best = floorProvider ? floorProvider(x, z, y) : 0; floorHit = null;
  for (const f of floors) {
    if (f.t0 === undefined && (f.top <= best || f.top > y + 0.5)) continue;
    let inside;
    if (f.r !== undefined) inside = Math.hypot(x - f.cx, z - f.cz) < f.r;
    else if (f.hw !== undefined) {
      const dx = x - f.cx, dz = z - f.cz, lz = dx * f.s + dz * f.c;
      inside = Math.abs(dx * f.c - dz * f.s) < f.hw && Math.abs(lz) < f.hd;
      if (inside && f.t0 !== undefined) { // ramp (slides): height runs from t0 at local -z to t1 at local +z
        const t = f.t0 + (lz / f.hd + 1) / 2 * (f.t1 - f.t0);
        if (t > best && t <= y + 0.5) { best = t; floorHit = f; }
        continue;
      }
    } else inside = x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1;
    if (inside) { best = f.top; floorHit = f; }
  }
  return best;
}
/** Ground normal-ish slope at x,z: returns [dh/dx, dh/dz]. */
export function slopeAt(x, z, e = 0.8) {
  return [(heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e)];
}

// value noise for the base hills (seeded, not tileable)
function hash(i, j) { let h = (i * 374761393 + j * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vn(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fb(x, z, o = 3) { let s = 0, a = 1, n = 0; for (let k = 0; k < o; k++) { s += (vn(x, z) * 2 - 1) * a; n += a; a *= 0.5; x *= 2.03; z *= 2.03; } return s / n; }
const smooth = (a, b, x) => { const t = clampi((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function computeBase() {
  const amp = settings.amp;
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const x = TX0 + i * TCELL, z = TZ0 + j * TCELL, k = j * TN + i;
    let h = 4.6 * fb(x / 95 + 3.1, z / 95 - 7.7, 3) + 0.9 * fb(x / 30 - 11.3, z / 30 + 5.9, 2);
    if (h < 0) h *= 0.45;                                   // shallow dips, rounder rises
    const e = Math.max(Math.abs(x), Math.abs(z));
    h += smooth(146, 196, e) * 7;                           // the land rolls up toward the map edge
    base[k] = h * amp * flatMask[k];
  }
}
export function recompute() { for (let k = 0; k < H.length; k++) H[k] = base[k] + delta[k]; heightTex.needsUpdate = true; for (const f of onChange) f(); }
export const onChange = [];

// ---------- GPU side ----------
export const heightTex = new THREE.DataTexture(H, TN, TN, THREE.RedFormat, THREE.FloatType);
heightTex.minFilter = heightTex.magFilter = THREE.NearestFilter; heightTex.needsUpdate = true;
const GW = 256, GH = 16;                                     // up to 4096 groups
const grpData = new Float32Array(GW * GH * 4);
export const groupTex = new THREE.DataTexture(grpData, GW, GH, THREE.RGBAFormat, THREE.FloatType);
groupTex.minFilter = groupTex.magFilter = THREE.NearestFilter; groupTex.needsUpdate = true;
const U = { uTerH: { value: heightTex }, uTerG: { value: groupTex }, uTerP: { value: new THREE.Vector4(TX0, TZ0, 1 / TCELL, TN) } };

const GLSL_HEAD = /* glsl */`
attribute vec3 tanc;
uniform sampler2D uTerH; uniform sampler2D uTerG; uniform vec4 uTerP;
float terH(vec2 p) {
  vec2 g = clamp((p - uTerP.xy) * uTerP.z, vec2(0.0), vec2(uTerP.w - 1.001));
  ivec2 i = ivec2(floor(g)); vec2 f = g - vec2(i);
  float a = texelFetch(uTerH, i, 0).r, b = texelFetch(uTerH, i + ivec2(1, 0), 0).r;
  float c = texelFetch(uTerH, i + ivec2(0, 1), 0).r, d = texelFetch(uTerH, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec4 terG() { int gi = tanc.z < -1.5 ? int(-tanc.z - 0.5) : int(tanc.z + 0.5); return gi > 0 ? texelFetch(uTerG, ivec2(gi % ${GW}, gi / ${GW}), 0) : vec4(0.0); }
`;
const GLSL_NORMAL = /* glsl */`
#include <beginnormal_vertex>
if (tanc.z > 0.5) { vec4 tg = terG(); float tc = cos(tg.z), ts = sin(tg.z); objectNormal.xz = vec2(objectNormal.x * tc + objectNormal.z * ts, -objectNormal.x * ts + objectNormal.z * tc); }
else if (tanc.z < -0.5 && tanc.z > -1.5 && objectNormal.y > 0.9) {
  float hx = terH(position.xz + vec2(1.0, 0.0)) - terH(position.xz - vec2(1.0, 0.0));
  float hz = terH(position.xz + vec2(0.0, 1.0)) - terH(position.xz - vec2(0.0, 1.0));
  objectNormal = normalize(vec3(-hx * 0.5, 1.0, -hz * 0.5));
}
`;
const GLSL_POS = /* glsl */`
#include <begin_vertex>
if (tanc.z < -1.5) {   // flat piece of a movable group: move with it, drape on the ground
  vec4 tg = terG(); float tc = cos(tg.z), ts = sin(tg.z);
  float tsc = tg.w > 0.0 ? tg.w : 1.0;
  vec2 rel = (transformed.xz - tanc.xy) * tsc;
  transformed.xz = tanc.xy + vec2(rel.x * tc + rel.y * ts, -rel.x * ts + rel.y * tc) + tg.xy;
  transformed.y = transformed.y * tsc + terH(transformed.xz);
  if (tg.w < 0.0) transformed = vec3(tanc.x, -500.0, tanc.y);
} else if (tanc.z < -0.5) transformed.y += terH(transformed.xz);
else if (tanc.z > 0.5) {
  vec4 tg = terG(); float tc = cos(tg.z), ts = sin(tg.z);
  float tsc = tg.w > 0.0 ? tg.w : 1.0;
  vec2 rel = (transformed.xz - tanc.xy) * tsc;
  transformed.xz = tanc.xy + vec2(rel.x * tc + rel.y * ts, -rel.x * ts + rel.y * tc) + tg.xy;
  transformed.y = transformed.y * tsc + terH(tanc.xy + tg.xy);
  if (tg.w < 0.0) transformed = vec3(tanc.x, -500.0, tanc.y);
} else transformed.y += terH(tanc.xy);
`;
/** Make a material terrain-aware (its geometry must carry the `tanc` attribute). Keeps an unpatched clone. */
export function patchMaterial(m) {
  if (!m || m.userData.terrain) return m;
  m.userData.clean = m.clone();
  m.userData.terrain = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = GLSL_HEAD + sh.vertexShader.replace('#include <begin_vertex>', GLSL_POS);
    if (sh.vertexShader.includes('#include <beginnormal_vertex>')) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', GLSL_NORMAL);
  };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.customProgramCacheKey = () => key() + '|terrain1';
  m.needsUpdate = true;
  return m;
}
/** Give a world-space mesh (at the origin) per-vertex draping and patch its material. */
export function drapeMesh(mesh) {
  const g = mesh.geometry, p = g.attributes.position, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { a[i * 3] = p.getX(i); a[i * 3 + 1] = p.getZ(i); a[i * 3 + 2] = -1; }
  g.setAttribute('tanc', new THREE.BufferAttribute(a, 3));
  patchMaterial(mesh.material);
  mesh.userData.noLift = true; mesh.frustumCulled = false;
  return mesh;
}

// ---------- groups + colliders ----------
// groups[g] = { id, anchor:{x,z}, cols:[collider model indexes], dx, dz, r, hide, label }
export const groups = [null];
export const colModel = [];   // { id, orig (engine collider copy), grp, del, ov (canonical override, pre-group), added, prop }
let COLS = null;              // the live colliders array from world.js
let rebuildGrid = () => {};
let gridPatch = null;        // world.js: add / drop one collider in its grid (P18 cheap breakable toggle)
let colsLive = false;        // true once applyColliders has rebuilt COLS from colModel (entries carry _m)

/** Polygon collider (engine form) from a canonical poly {cx, cz, rot, pts: local [[x,z]], h}: world points + bounds. */
export function polyEngine(q) {
  const c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0);
  const poly = q.pts.map(([lx, lz]) => [q.cx + lx * c + lz * s, q.cz - lx * s + lz * c]);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return { poly, cx: q.cx, cz: q.cz, rot: q.rot || 0, lp: q.pts.map((p) => [p[0], p[1]]), x0, x1, z0, z1, h: q.h };
}
/** Canonical poly from world points (centred on their bounding box). */
export function polyFromWorld(pts, h = 3) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  return { kind: 'poly', cx, cz, rot: 0, pts: pts.map(([x, z]) => [x - cx, z - cz]), h };
}
/** Distance from (x,z) to a world polygon (0 inside). */
export function polyDist(P, x, z) {
  let inside = false, best = 1e9;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, az] = P[j], [bx, bz] = P[i];
    if ((bz > z) !== (az > z) && x < ((ax - bx) * (z - bz)) / (az - bz) + bx) inside = !inside;
    const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L));
    best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return inside ? 0 : best;
}
export const canon = (c) => c.poly ? { kind: 'poly', cx: c.cx, cz: c.cz, rot: c.rot || 0, pts: c.lp.map((p) => [p[0], p[1]]), h: c.h ?? 5 }
  : c.r !== undefined ? { kind: 'circle', cx: c.cx, cz: c.cz, r: c.r, h: c.h ?? 5 }
  : c.ob ? { kind: 'box', cx: c.cx, cz: c.cz, w: c.hw * 2, d: c.hd * 2, rot: Math.atan2(c.s, c.c), h: c.h ?? 5 }
    : { kind: 'box', cx: (c.x0 + c.x1) / 2, cz: (c.z0 + c.z1) / 2, w: c.x1 - c.x0, d: c.z1 - c.z0, rot: 0, h: c.h ?? 5 };
const SHAPE_KEYS = ['poly', 'lp', 'rot', 'cx', 'cz', 'r', 'x0', 'x1', 'z0', 'z1', 'hw', 'hd', 'c', 's', 'ob', 'h'];
export function toEngine(q, flags = {}) {
  const f = {}; for (const k in flags) if (!SHAPE_KEYS.includes(k) && k[0] !== '_') f[k] = flags[k];
  if (q.kind === 'circle') return { cx: q.cx, cz: q.cz, r: q.r, h: q.h, ...f };
  if (q.kind === 'poly') return { ...polyEngine(q), ...f };
  const s = Math.sin(q.rot || 0), c = Math.cos(q.rot || 0);
  if (Math.abs(s) < 0.01 || Math.abs(c) < 0.01) {
    const sw = Math.abs(s) > 0.5 ? q.d : q.w, sd = Math.abs(s) > 0.5 ? q.w : q.d;
    return { x0: q.cx - sw / 2, x1: q.cx + sw / 2, z0: q.cz - sd / 2, z1: q.cz + sd / 2, h: q.h, ...f };
  }
  return { ob: true, cx: q.cx, cz: q.cz, hw: q.w / 2, hd: q.d / 2, c, s, h: q.h, ...f };
}
/** Apply a group transform to a canonical shape (rotate about the anchor, then move). */
const sc = (G) => (G && G.s ? G.s : 1);
const scaleQ = (q, k) => { const o = { ...q }; for (const f of ['w', 'd', 'r', 'h']) if (o[f] !== undefined) o[f] *= k; if (o.pts) o.pts = o.pts.map(([x, z]) => [x * k, z * k]); return o; };
export function xformCanon(q, G) {
  if (!G || (!G.dx && !G.dz && !G.r && sc(G) === 1)) return { ...q };
  const k = sc(G), c = Math.cos(G.r), s = Math.sin(G.r), rx = (q.cx - G.anchor.x) * k, rz = (q.cz - G.anchor.z) * k;
  return { ...scaleQ(q, k), cx: G.anchor.x + rx * c + rz * s + G.dx, cz: G.anchor.z - rx * s + rz * c + G.dz, rot: (q.rot || 0) + (q.kind !== 'circle' ? G.r : 0) };
}
export function unxformCanon(q, G) {
  if (!G || (!G.dx && !G.dz && !G.r && sc(G) === 1)) return { ...q };
  const k = sc(G), c = Math.cos(-G.r), s = Math.sin(-G.r), rx = q.cx - G.dx - G.anchor.x, rz = q.cz - G.dz - G.anchor.z;
  return { ...scaleQ(q, 1 / k), cx: G.anchor.x + (rx * c + rz * s) / k, cz: G.anchor.z + (-rx * s + rz * c) / k, rot: (q.rot || 0) - (q.kind !== 'circle' ? G.r : 0) };
}
/** World-space canonical shape of a collider model entry as it is now. */
export function liveCanon(m) { return xformCanon(m.ov || canon(m.orig), groups[m.grp]); }

function cid(c, used) {
  const k = (c.poly ? 'p' : c.r !== undefined ? 'c' : 'b') + Math.round((c.r !== undefined || c.ob || c.poly ? c.cx : (c.x0 + c.x1) / 2) * 10) + '_' + Math.round((c.r !== undefined || c.ob || c.poly ? c.cz : (c.z0 + c.z1) / 2) * 10);
  let id = k, n = 1; while (used.has(id)) id = k + '~' + (++n); used.add(id); return id;
}
function footprintDist(c, x, z) {
  // distance from (x,z) to collider footprint (0 inside)
  if (c.r !== undefined) return Math.max(0, Math.hypot(x - c.cx, z - c.cz) - c.r);
  if (c.poly) return polyDist(c.poly, x, z);
  if (c.ob) { const dx = x - c.cx, dz = z - c.cz, lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c; return Math.hypot(Math.max(0, Math.abs(lx) - c.hw), Math.max(0, Math.abs(lz) - c.hd)); }
  return Math.hypot(Math.max(0, c.x0 - x, x - c.x1), Math.max(0, c.z0 - z, z - c.z1));
}
const area = (c) => (c.r !== undefined ? Math.PI * c.r * c.r : c.ob ? 4 * c.hw * c.hd : (c.x1 - c.x0) * (c.z1 - c.z0));
const thin = (c) => c.r === undefined && Math.min(c.ob ? c.hw * 2 : c.x1 - c.x0, c.ob ? c.hd * 2 : c.z1 - c.z0) < 0.7;

// spatial hash over group-defining colliders (a group's first collider, plus every building part) for fast lookups
const GCELL = 10; let gHash = new Map();
const gk = (i, j) => i * 100003 + j;
function hashGroups() {
  gHash = new Map();
  for (let g = 1; g < groups.length; g++) for (const ci of groups[g].cols) {
    const c = colModel[ci].orig; if (ci !== groups[g].cols[0] && !c.bld) continue;
    const [a, b, d, e] = bounds(c, 3.5);
    for (let i = Math.floor(a / GCELL); i <= Math.floor(b / GCELL); i++) for (let j = Math.floor(d / GCELL); j <= Math.floor(e / GCELL); j++) {
      const k = gk(i, j); (gHash.get(k) || gHash.set(k, []).get(k)).push(ci);
    }
  }
}
function bounds(c, m = 0) {
  if (c.r !== undefined) return [c.cx - c.r - m, c.cx + c.r + m, c.cz - c.r - m, c.cz + c.r + m];
  if (c.ob) { const ex = c.hw * Math.abs(c.c) + c.hd * Math.abs(c.s), ez = c.hw * Math.abs(c.s) + c.hd * Math.abs(c.c); return [c.cx - ex - m, c.cx + ex + m, c.cz - ez - m, c.cz + ez + m]; }
  return [c.x0 - m, c.x1 + m, c.z0 - m, c.z1 + m];
}
/** Which movable group owns something at x,z (original placement), or 0. */
export function groupAt(x, z, margins = true) {
  const l = gHash.get(gk(Math.floor(x / GCELL), Math.floor(z / GCELL))); if (!l) return 0;
  let best = 0, bd = 1e9, ba = 1e9;
  for (const ci of l) {
    const c = colModel[ci].orig, bld = !!c.bld;
    const margin = !margins ? 0.3 : bld ? 3 : c.r !== undefined ? Math.max(c.r * 0.6, 1.2) : 0.7;
    const d = footprintDist(c, x, z); if (d > margin) continue;
    const pri = d - (bld ? 0.5 : 0), a = area(c);
    if (pri < bd - 1e-6 || (Math.abs(pri - bd) < 1e-6 && a < ba)) { best = colModel[ci].grp; bd = pri; ba = a; }
  }
  return best;
}
/** Is (x,z) on a building's footprint (for flat pieces like floors and lots that should move with it)? */
function bldAt(x, z) {
  const l = gHash.get(gk(Math.floor(x / GCELL), Math.floor(z / GCELL))); if (!l) return 0;
  for (const ci of l) { const c = colModel[ci].orig; if (c.bld && footprintDist(c, x, z) <= 0.3) return colModel[ci].grp; }
  return 0;
}

// ---------- world preparation (called by world.js before merging) ----------
const DECALS = new Set(['shadow', 'shadowR', 'puddle', 'graffiti', 'posterCat', 'posterHoa']);
export const worldInfo = { flatRects: 0, groups: 0, flatGeos: 0, hilly: 0, maxH: 0 };

export function prepareWorld(buckets, ctx) {
  COLS = ctx.colliders; rebuildGrid = ctx.rebuildGrid || rebuildGrid; gridPatch = ctx.gridPatch || null;
  // 1. collider models + groups
  const used = new Set();
  COLS.forEach((c) => colModel.push({ id: cid(c, used), orig: { ...c }, grp: 0 }));
  const bldIdx = [];
  colModel.forEach((m, i) => { if (m.orig.bld) bldIdx.push(i); });
  const parent = (m) => {   // small colliders hugging a building join it
    if (m.orig.bld || m.orig.water) return -1;
    let best = -1, bd = 1.01;
    for (const i of bldIdx) {
      const b = colModel[i].orig, [cx, cz] = m.orig.r !== undefined || m.orig.ob ? [m.orig.cx, m.orig.cz] : [(m.orig.x0 + m.orig.x1) / 2, (m.orig.z0 + m.orig.z1) / 2];
      const d = footprintDist(b, cx, cz); if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const late = [];
  // building parts that touch (a church and its steeple, a store and its wing) form one group
  const root = colModel.map((_, i) => i), find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let a = 0; a < bldIdx.length; a++) for (let b = a + 1; b < bldIdx.length; b++) {
    const A = colModel[bldIdx[a]].orig, B = colModel[bldIdx[b]].orig, ca = canon(A), cb = canon(B);
    if (Math.hypot(ca.cx - cb.cx, ca.cz - cb.cz) > 40) continue;
    const [bx0, bx1, bz0, bz1] = bounds(B);
    const pts = [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1], [cb.cx, cb.cz], [(bx0 + bx1) / 2, bz0], [(bx0 + bx1) / 2, bz1], [bx0, (bz0 + bz1) / 2], [bx1, (bz0 + bz1) / 2]];
    if (pts.some(([x, z]) => footprintDist(A, x, z) < 0.6) || footprintDist(B, ca.cx, ca.cz) < 0.6) root[find(bldIdx[b])] = find(bldIdx[a]);
  }
  colModel.forEach((m, i) => {
    if (m.orig.water) return;
    if (m.orig.bld && find(i) !== i) { late.push([i, find(i)]); return; }
    const p = parent(m);
    if (p >= 0) { late.push([i, find(p)]); return; }
    const c = canon(m.orig);
    groups.push({ id: m.id, anchor: { x: c.cx, z: c.cz }, cols: [i], dx: 0, dz: 0, r: 0, s: 1, hide: false, label: m.orig.bld ? 'building' : m.orig.tree ? 'tree' : c.kind === 'circle' ? 'post / round prop' : 'prop' });
    m.grp = groups.length - 1;
  });
  for (const [i, p] of late) { const g = colModel[p].grp; if (!g) continue; colModel[i].grp = g; groups[g].cols.push(i); }
  hashGroups();
  worldInfo.groups = groups.length - 1;

  // 2. tag geometry, find flat features
  const rects = [];
  for (const [key, list] of Object.entries(buckets)) {
    for (let li = 0; li < list.length; li++) {
      let g = list[li];
      const p = g.attributes.position, n = p.count;
      let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let i = 0; i < n; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const flat = y1 - y0 < 0.05 && y1 < 0.3;
      if (flat && x1 - x0 > 300 && z1 - z0 > 300 && !ctx.ground) { list.splice(li--, 1); ctx.ground = { key, g }; continue; }   // the base ground plane: replaced by the terrain mesh
      if (flat) {
        g = subdivide(g, 2.9); list[li] = g;
        const [ox, oz] = g.userData.o || [(x0 + x1) / 2, (z0 + z1) / 2];
        const fg = DECALS.has(key) && key !== 'shadow' && key !== 'shadowR' ? 0 : bldAt(ox, oz);
        const q = g.attributes.position, a = new Float32Array(q.count * 3);
        for (let i = 0; i < q.count; i++) { a[i * 3] = fg ? groups[fg].anchor.x : q.getX(i); a[i * 3 + 1] = fg ? groups[fg].anchor.z : q.getZ(i); a[i * 3 + 2] = fg ? -(fg + 1) : -1; }
        g.setAttribute('tanc', new THREE.BufferAttribute(a, 3));
        if (!DECALS.has(key) && (x1 - x0) * (z1 - z0) < 1500) rects.push(g);   // big ground covers (forest floor, park lawn) may roll
        worldInfo.flatGeos++;
      } else {
        const [ox, oz] = g.userData.o || [(x0 + x1) / 2, (z0 + z1) / 2];
        const gi = groupAt(ox, oz);
        const ax = gi ? groups[gi].anchor.x : ox, az = gi ? groups[gi].anchor.z : oz;
        const a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { a[i * 3] = ax; a[i * 3 + 1] = az; a[i * 3 + 2] = gi; }
        g.setAttribute('tanc', new THREE.BufferAttribute(a, 3));
      }
    }
  }
  // 3. flat mask -> base hills
  const flat = new Uint8Array(TN * TN);
  const mark = (x, z) => { const i = Math.round((x - TX0) / TCELL), j = Math.round((z - TZ0) / TCELL); if (i >= 0 && j >= 0 && i < TN && j < TN) flat[j * TN + i] = 1; };
  const fillTri = (ax, az, bx, bz, cx, cz) => {
    const i0 = Math.floor((Math.min(ax, bx, cx) - TX0) / TCELL), i1 = Math.ceil((Math.max(ax, bx, cx) - TX0) / TCELL);
    const j0 = Math.floor((Math.min(az, bz, cz) - TZ0) / TCELL), j1 = Math.ceil((Math.max(az, bz, cz) - TZ0) / TCELL);
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) return;
    for (let j = Math.max(0, j0); j <= Math.min(TN - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(TN - 1, i1); i++) {
      const x = TX0 + i * TCELL, z = TZ0 + j * TCELL;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      if (l1 >= -0.15 && l2 >= -0.15 && 1 - l1 - l2 >= -0.15) flat[j * TN + i] = 1;
    }
    mark(ax, az); mark(bx, bz); mark(cx, cz);
  };
  for (const g of rects) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) fillTri(p.getX(i), p.getZ(i), p.getX(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getZ(i + 2)); }
  worldInfo.flatRects = rects.length;
  for (const m of colModel) {
    const c = m.orig; if (thin(c) || (c.r !== undefined && c.r < 1.2 && !c.water)) continue;
    const [a, b, d, e] = bounds(c, 0.8);
    for (let j = Math.max(0, Math.floor((d - TZ0) / TCELL)); j <= Math.min(TN - 1, Math.ceil((e - TZ0) / TCELL)); j++) for (let i = Math.max(0, Math.floor((a - TX0) / TCELL)); i <= Math.min(TN - 1, Math.ceil((b - TX0) / TCELL)); i++) {
      if (footprintDist(c, TX0 + i * TCELL, TZ0 + j * TCELL) <= 0.8) flat[j * TN + i] = 1;
    }
  }
  if (ctx.EDGES) for (const e of ctx.EDGES) {
    const A = ctx.NODES[e.a], B = ctx.NODES[e.b], hw = e.w / 2 + 1.5;
    const i0 = Math.floor((Math.min(A.x, B.x) - hw - TX0) / TCELL), i1 = Math.ceil((Math.max(A.x, B.x) + hw - TX0) / TCELL);
    const j0 = Math.floor((Math.min(A.z, B.z) - hw - TZ0) / TCELL), j1 = Math.ceil((Math.max(A.z, B.z) + hw - TZ0) / TCELL);
    const L2 = (B.x - A.x) ** 2 + (B.z - A.z) ** 2 || 1;
    for (let j = Math.max(0, j0); j <= Math.min(TN - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(TN - 1, i1); i++) {
      const x = TX0 + i * TCELL, z = TZ0 + j * TCELL, t = clampi(((x - A.x) * (B.x - A.x) + (z - A.z) * (B.z - A.z)) / L2, 0, 1);
      if (Math.hypot(x - A.x - t * (B.x - A.x), z - A.z - t * (B.z - A.z)) <= hw) flat[j * TN + i] = 1;
    }
  }
  if (ctx.inLake) for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) if (ctx.inLake(TX0 + i * TCELL, TZ0 + j * TCELL, 1.15)) flat[j * TN + i] = 1;
  // chamfer distance transform (cells) from flat features
  const D = new Float32Array(TN * TN);
  for (let k = 0; k < D.length; k++) D[k] = flat[k] ? 0 : 1e6;
  const R2 = Math.SQRT2;
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const k = j * TN + i; let v = D[k];
    if (i > 0) v = Math.min(v, D[k - 1] + 1);
    if (j > 0) { v = Math.min(v, D[k - TN] + 1); if (i > 0) v = Math.min(v, D[k - TN - 1] + R2); if (i < TN - 1) v = Math.min(v, D[k - TN + 1] + R2); }
    D[k] = v;
  }
  for (let j = TN - 1; j >= 0; j--) for (let i = TN - 1; i >= 0; i--) {
    const k = j * TN + i; let v = D[k];
    if (i < TN - 1) v = Math.min(v, D[k + 1] + 1);
    if (j < TN - 1) { v = Math.min(v, D[k + TN] + 1); if (i < TN - 1) v = Math.min(v, D[k + TN + 1] + R2); if (i > 0) v = Math.min(v, D[k + TN - 1] + R2); }
    D[k] = v;
  }
  for (let k = 0; k < D.length; k++) flatMask[k] = smooth(1.5, 20, D[k] * TCELL);
  computeBase(); recompute();
  let hilly = 0, mx = 0; for (let k = 0; k < H.length; k++) { if (flatMask[k] > 0.5) hilly++; mx = Math.max(mx, Math.abs(H[k])); }
  worldInfo.hilly = hilly / H.length; worldInfo.maxH = mx;
}

/** The terrain ground mesh (indexed grid on the height samples). */
export function makeGroundMesh(material, uvTile = 6) {
  const g = new THREE.PlaneGeometry(TCELL * (TN - 1), TCELL * (TN - 1), TN - 1, TN - 1);
  g.rotateX(-Math.PI / 2); g.translate(TX0 + TCELL * (TN - 1) / 2, 0, TZ0 + TCELL * (TN - 1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv, n = p.count;
  const col = new Float32Array(n * 3).fill(1), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { uv.setXY(i, p.getX(i) / uvTile, -p.getZ(i) / uvTile); a[i * 3] = p.getX(i); a[i * 3 + 1] = p.getZ(i); a[i * 3 + 2] = -1; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tanc', new THREE.BufferAttribute(a, 3));
  const m = new THREE.Mesh(g, material);
  m.userData.noLift = true; m.userData.ground = true; m.frustumCulled = false; m.matrixAutoUpdate = false;
  return m;
}

/** Split triangles until no edge (in x,z) is longer than maxE. Works on non-indexed geometry. */
export function subdivide(g, maxE) {
  const names = Object.keys(g.attributes), A = names.map((k) => g.attributes[k]), sizes = A.map((a) => a.itemSize);
  const stride = sizes.reduce((s, v) => s + v, 0), pOff = names.indexOf('position') === 0 ? 0 : sizes.slice(0, names.indexOf('position')).reduce((s, v) => s + v, 0);
  const n = g.attributes.position.count; const out = [];
  const vert = (i) => { const v = new Float32Array(stride); let o = 0; A.forEach((a, k) => { for (let c = 0; c < sizes[k]; c++) v[o++] = a.array[i * sizes[k] + c]; }); return v; };
  const mid = (a, b) => { const v = new Float32Array(stride); for (let c = 0; c < stride; c++) v[c] = (a[c] + b[c]) / 2; return v; };
  const e2 = (a, b) => (a[pOff] - b[pOff]) ** 2 + (a[pOff + 2] - b[pOff + 2]) ** 2;
  const m2 = maxE * maxE; let any = false;
  const stack = [];
  for (let i = 0; i < n; i += 3) stack.push([vert(i), vert(i + 1), vert(i + 2)]);
  let guard = 0;
  while (stack.length) {
    const [a, b, c] = stack.pop();
    const ab = e2(a, b), bc = e2(b, c), ca = e2(c, a), mx = Math.max(ab, bc, ca);
    if (mx <= m2 || ++guard > 400000) { out.push(a, b, c); continue; }
    any = true;
    if (mx === ab) { const m = mid(a, b); stack.push([a, m, c], [m, b, c]); }
    else if (mx === bc) { const m = mid(b, c); stack.push([a, b, m], [a, m, c]); }
    else { const m = mid(c, a); stack.push([a, b, m], [m, b, c]); }
  }
  if (!any) return g;
  const ng = new THREE.BufferGeometry();
  let o = 0;
  names.forEach((k, ai) => {
    const sz = sizes[ai], arr = new Float32Array(out.length * sz);
    for (let v = 0; v < out.length; v++) for (let c = 0; c < sz; c++) arr[v * sz + c] = out[v][o + c];
    ng.setAttribute(k, new THREE.BufferAttribute(arr, sz)); o += sz;
  });
  ng.userData = g.userData;
  return ng;
}

// ---------- after the world is built ----------
const loose = [];       // world objects that are not merged geometry: { o, x, z, ry, g }
const looseLights = []; // light / halo / flame entries: { L, x, z, g }
/** Called by game.js once the world and its sprites exist. */
export function initWorld(scene, o = {}) {
  for (const c of scene.children) {
    if (c.userData.noLift || c.isLight || c.isCamera) continue;
    const p = c.position; if (p.x === 0 && p.z === 0 && p.y === 0) continue;
    const g = groupAt(p.x, p.z);
    if (g) c.userData.tg = { g, x: p.x, z: p.z, ry: c.rotation.y };
  }
  for (const list of [o.lights || [], o.halos || [], o.flames || []]) for (const L of list) { const g = groupAt(L.x, L.z); if (g) looseLights.push({ L, x: L.x, z: L.z, g }); }
}
const extra = [];
/** Objects that are not direct scene children but sit in world space (e.g. halo sprites in a group at the origin): lift them too. */
export function track(...objs) { for (const o of objs.flat()) extra.push(o); link(...objs); }
/** Static world objects that should follow the movable group they stand in. */
export function link(...objs) { for (const o of objs.flat()) { const g = groupAt(o.position.x, o.position.z); if (g) o.userData.tg = { g, x: o.position.x, z: o.position.z, ry: o.rotation.y }; } }

// group transforms -> texture, colliders, lights
export function applyGroups() {
  for (let g = 1; g < groups.length && g < GW * GH; g++) {
    const G = groups[g];
    grpData[g * 4] = G.dx; grpData[g * 4 + 1] = G.dz; grpData[g * 4 + 2] = G.r; grpData[g * 4 + 3] = G.hide || G.broken ? -1 : sc(G);
  }
  groupTex.needsUpdate = true;
  for (const e of looseLights) {
    if (e.off) continue;   // detached by the editor (moved by hand)
    const G = groups[e.g], k = sc(G), c = Math.cos(G.r), s = Math.sin(G.r), rx = (e.x - G.anchor.x) * k, rz = (e.z - G.anchor.z) * k;
    e.L.x = G.anchor.x + rx * c + rz * s + G.dx; e.L.z = G.anchor.z - rx * s + rz * c + G.dz;
    if (e.y === undefined) e.y = e.L.y; e.L.y = e.y * k;
    if (e.L.i !== undefined) { if (G.hide || G.broken) { e.L._i ??= e.L.i; e.L.i = 0; } else if (e.L._i !== undefined) e.L.i = e.L._i; }
  }
  applyColliders();
}
/** The movable-group link of a light / halo / flame entry (null if it is not in a group). */
export function lightLink(L) { return looseLights.find((e) => e.L === L) || null; }
export const extraCols = [];   // added colliders: { id, q (canonical), prop }
export function applyColliders() {
  if (!COLS) return;
  COLS.length = 0;
  for (const m of colModel) {
    if (m.del) continue;
    const G = groups[m.grp];
    if (G && (G.hide || G.broken)) continue;
    const q = liveCanon(m), e = toEngine(q, m.orig); e._m = m; COLS.push(e);
  }
  for (const a of extraCols) { const e = toEngine(a.q, { ...(a.flags || {}), ...(a.q.water ? { water: true } : {}) }); e._x = a; COLS.push(e); }
  rebuildGrid(); colsLive = true;
  for (const f of onColliders) f();
}
export const onColliders = [];   // called after every collider change (water surfaces follow)
/** P18: break or restore one movable group (breakables) without rebuilding everything: its group-texture entry, its lights and
 *  only its own colliders change (one grid patch per collider instead of a full applyGroups + applyColliders). */
export function setBroken(g, on) {
  const G = groups[g]; on = !!on; if (!G || !!G.broken === on) return; G.broken = on;
  if (g < GW * GH) { grpData[g * 4 + 3] = G.hide || G.broken ? -1 : sc(G); groupTex.needsUpdate = true; }
  for (const e of looseLights) { if (e.off || e.g !== g || e.L.i === undefined) continue; if (G.hide || G.broken) { e.L._i ??= e.L.i; e.L.i = 0; } else if (e.L._i !== undefined) e.L.i = e.L._i; }
  if (!COLS) return;
  if (!colsLive) return applyColliders(); // first toggle: COLS still holds world.js's raw colliders (no _m links), one full pass normalises them
  if (on) { for (let i = COLS.length - 1; i >= 0; i--) { const e = COLS[i]; if (e._m && e._m.grp === g) { COLS.splice(i, 1); if (gridPatch) gridPatch(e, false); else rebuildGrid(); } } }
  else if (!G.hide) for (const m of colModel) { if (m.del || m.grp !== g) continue; const q = liveCanon(m), e = toEngine(q, m.orig); e._m = m; COLS.push(e); if (gridPatch) gridPatch(e, true); else rebuildGrid(); }
  for (const f of onColliders) f();
}

// ---------- per-frame lift ----------
const saved = [];
const _tmp = [];
function liftObj(o) {
  const u = o.userData;
  if (u.noLift || !o.visible || (o.parent && !o.parent.visible) || o.isDirectionalLight || o.isHemisphereLight || o.isAmbientLight) return; // P14: hidden things are not lifted
  const p = o.position;
  if (!u.lift && p.x === 0 && p.y === 0 && p.z === 0) return;
  saved.push(o, p.x, p.y, p.z, o.rotation.x, o.rotation.y, o.rotation.z, o.visible, o.rotation.order, o.scale.x, o.scale.y, o.scale.z);
  let x = p.x, z = p.z;
  if (u.tg) {
    const G = groups[u.tg.g];
    if (G && (G.dx || G.dz || G.r || G.hide || G.broken || sc(G) !== 1)) {
      const k = sc(G), c = Math.cos(G.r), s = Math.sin(G.r), rx = (u.tg.x - G.anchor.x) * k, rz = (u.tg.z - G.anchor.z) * k;
      x = G.anchor.x + rx * c + rz * s + G.dx; z = G.anchor.z - rx * s + rz * c + G.dz;
      o.rotation.y = u.tg.ry + G.r; if (G.hide || G.broken) o.visible = false;
      if (k !== 1) { o.scale.multiplyScalar(k); p.y *= k; }
    }
  }
  const h = heightAt(x, z);
  p.set(x, p.y + h, z);
  if (u.wheels && o.visible) {   // cars: pitch + roll with the ground
    const yaw = o.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const L = 1.4, W = 0.8;
    const pitch = Math.atan2(heightAt(x + fx * L, z + fz * L) - heightAt(x - fx * L, z - fz * L), 2 * L);
    const roll = Math.atan2(heightAt(x + rx * W, z + rz * W) - heightAt(x - rx * W, z - rz * W), 2 * W);
    o.rotation.order = 'YXZ'; o.rotation.x = -pitch; o.rotation.z = roll + o.rotation.z;
  }
}
export function beforeRender(scene, camera, tx, tz) {
  saved.length = 0;
  _tmp.length = 0; for (const c of scene.children) _tmp.push(c);
  for (const c of _tmp) liftObj(c);
  for (const c of extra) liftObj(c);
  if (!camera.userData.noLift) {
    const h = tx !== undefined ? heightAt(tx, tz) : heightAt(camera.position.x, camera.position.z);
    camera.position.y += h;
    camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 0.35);
  }
}
export function afterRender() {
  for (let i = 0; i < saved.length; i += 12) {
    const o = saved[i]; o.position.set(saved[i + 1], saved[i + 2], saved[i + 3]); o.scale.set(saved[i + 9], saved[i + 10], saved[i + 11]);
    o.rotation.order = saved[i + 8]; o.rotation.set(saved[i + 4], saved[i + 5], saved[i + 6]); o.visible = saved[i + 7];
  }
  saved.length = 0;
}

// ---------- persistence encoding ----------
export function encodeDelta() {
  const q = new Int16Array(TN * TN);
  let any = false;
  for (let k = 0; k < q.length; k++) { q[k] = clampi(Math.round(delta[k] * 100), -32000, 32000); if (q[k]) any = true; }
  if (!any) return '';
  const b = new Uint8Array(q.buffer); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function decodeDelta(str) {
  delta.fill(0);
  if (!str) return;
  const s = atob(str), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  const q = new Int16Array(b.buffer, 0, Math.min(TN * TN, b.length >> 1));
  for (let k = 0; k < q.length; k++) delta[k] = q[k] / 100;
}

export const TERRAIN = { heightAt, slopeAt, TN, TCELL, TX0, TZ0 };
