// Engine: painted ground surfaces (a splat map over the terrain) and water bodies.
// - The ground mesh blends 8 painted layers over grass: dirt, sand, gravel, mud, asphalt, concrete, forest floor, dry grass.
//   Weights live in two RGBA textures, 1 m per texel over ±200 m. The editor paints them; they save to world/ground.
// - Water bodies are polygon colliders flagged `water` (the lake, plus any the editor draws). Each one gets a flat
//   water surface at the height of its lowest shore point, rebuilt when the shape or the terrain changes.
import * as THREE from 'three';
import * as TER from './terrain.js';

export const SPN = 400, SX0 = -200, SCELL = 1;
export const splA = new Uint8Array(SPN * SPN * 4), splB = new Uint8Array(SPN * SPN * 4);
let defA = null, defB = null;
const mkTex = (d) => { const t = new THREE.DataTexture(d, SPN, SPN, THREE.RGBAFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
export const texA = mkTex(splA), texB = mkTex(splB);
export const LAYERS = [
  { id: 'grass', label: 'Grass', ch: -1, sw: '#5f8a3c' },
  { id: 'dirt', label: 'Dirt', ch: 0, sw: '#8a6a44' },
  { id: 'sand', label: 'Sand', ch: 1, sw: '#e2cc8e' },
  { id: 'gravel', label: 'Gravel', ch: 2, sw: '#a8a296' },
  { id: 'mud', label: 'Mud', ch: 3, sw: '#4a3a2a' },
  { id: 'asphalt', label: 'Asphalt', ch: 4, sw: '#3e3e44' },
  { id: 'concrete', label: 'Concrete', ch: 5, sw: '#b8b4aa' },
  { id: 'forest', label: 'Forest floor', ch: 6, sw: '#4a3c26' },
  { id: 'dry', label: 'Dry grass', ch: 7, sw: '#b0a050' },
];

const FRAG_HEAD = /* glsl */`
uniform sampler2D splA; uniform sampler2D splB; uniform sampler2D tDirt; uniform sampler2D tAsph; uniform sampler2D tSide; uniform sampler2D tLeaf;
varying vec2 vSpl;
`;
const FRAG_MIX = /* glsl */`
#include <color_fragment>
{
  vec2 sp = (vSpl - vec2(${SX0.toFixed(1)})) / ${(SPN * SCELL).toFixed(1)};
  vec4 wa = texture2D(splA, sp), wb = texture2D(splB, sp);
  if (wa.r + wa.g + wa.b + wa.a + wb.r + wb.g + wb.b + wb.a > 0.004) {
    wa = smoothstep(0.0, 0.7, wa); wb = smoothstep(0.0, 0.7, wb);  // half-painted reads as mostly painted
    vec2 tu = vSpl / 6.0;
    vec3 cd = texture2D(tDirt, tu).rgb, ca = texture2D(tAsph, tu * 0.8).rgb, cs = texture2D(tSide, tu * 0.5).rgb, cl = texture2D(tLeaf, tu).rgb;
    vec3 gr = diffuseColor.rgb, c = gr;
    c = mix(c, cd, wa.r);
    c = mix(c, mix(cd, vec3(0.74, 0.58, 0.3), 0.7), wa.g);
    c = mix(c, ca * vec3(3.1, 2.95, 2.7), wa.b);
    c = mix(c, cd * vec3(0.42, 0.35, 0.28), wa.a);
    c = mix(c, ca, wb.r);
    c = mix(c, cs, wb.g);
    c = mix(c, cl * vec3(0.55, 0.42, 0.26), wb.b);
    c = mix(c, gr * vec3(1.4, 1.12, 0.48), wb.a);
    diffuseColor.rgb = c;
  }
}
`;

let SCENE = null, WMAT = null, ctxRef = null;
const waterGroup = new THREE.Group(); waterGroup.userData.noLift = true;

/** The grass material (ground, lawns, parks: every grass surface) gets the splat blend. Also sets up water. */
export function initGround(scene, m, T, ctx) {
  SCENE = scene; ctxRef = ctx; WMAT = ctx.waterMat || null;
  const uni = { splA: { value: texA }, splB: { value: texB }, tDirt: { value: T.dirt }, tAsph: { value: T.asphalt }, tSide: { value: T.sidewalk }, tLeaf: { value: T.leaves } };
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = 'varying vec2 vSpl;\n' + sh.vertexShader.replace('#include <project_vertex>', 'vSpl = (modelMatrix * vec4(transformed, 1.0)).xz;\n#include <project_vertex>');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <color_fragment>', FRAG_MIX);
  };
  m.customProgramCacheKey = () => key() + '|splat2';
  m.needsUpdate = true;
  TER.patchMaterial(m);
  makeDefault(ctx.inLake);
  scene.add(waterGroup);
  TER.onColliders.push(() => rebuildWater());
  let wt = 0; TER.onChange.push(() => { clearTimeout(wt); wt = setTimeout(() => rebuildWater(true), 150); });
  rebuildWater(true);
  return m;
}

// ---------------- painting ----------------
function makeDefault(inLake) {
  if (inLake) {
    const S = [0.9, 0.94, 0.98, 1.02, 1.06, 1.1, 1.14, 1.18];
    for (let j = 0; j < SPN; j++) for (let i = 0; i < SPN; i++) {
      const x = SX0 + (i + 0.5) * SCELL, z = SX0 + (j + 0.5) * SCELL;
      if (!inLake(x, z, 1.2)) continue;
      let rho = 1.2; for (const s of S) if (inLake(x, z, s)) { rho = s; break; }
      const w = rho <= 1.08 ? 1 : Math.max(0, 1 - (rho - 1.08) / 0.1);
      splA[(j * SPN + i) * 4 + 1] = Math.round(w * 235);
    }
  }
  defA = splA.slice(); defB = splB.slice();
  texA.needsUpdate = texB.needsUpdate = true;
}
export function resetPaint() { splA.set(defA); splB.set(defB); texA.needsUpdate = texB.needsUpdate = true; }
export function clearPaint() { splA.fill(0); splB.fill(0); texA.needsUpdate = texB.needsUpdate = true; }
/** Paint layer `id` (or 'grass' to clear back to grass) in a soft circle. amt is 0..1 per call at the centre. */
export function paint(id, x, z, r, amt) {
  const L = LAYERS.find((l) => l.id === id); if (!L) return;
  const i0 = Math.max(0, Math.floor((x - r - SX0) / SCELL)), i1 = Math.min(SPN - 1, Math.ceil((x + r - SX0) / SCELL));
  const j0 = Math.max(0, Math.floor((z - r - SX0) / SCELL)), j1 = Math.min(SPN - 1, Math.ceil((z + r - SX0) / SCELL));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(SX0 + (i + 0.5) * SCELL - x, SX0 + (j + 0.5) * SCELL - z); if (d > r) continue;
    const w0 = 1 - d / r, a = Math.min(1, amt * w0 * w0 * (3 - 2 * w0)), k = (j * SPN + i) * 4;
    for (let c = 0; c < 8; c++) {
      const arr = c < 4 ? splA : splB, o = k + (c & 3);
      arr[o] = c === L.ch ? Math.round(arr[o] + (255 - arr[o]) * a) : Math.floor(arr[o] * (1 - a));
    }
  }
  texA.needsUpdate = texB.needsUpdate = true;
}
/** Which layer dominates at x,z (for the status line). */
export function layerAt(x, z) {
  const i = Math.floor((x - SX0) / SCELL), j = Math.floor((z - SX0) / SCELL); if (i < 0 || j < 0 || i >= SPN || j >= SPN) return 'grass';
  const k = (j * SPN + i) * 4; let best = 'grass', bw = 60;
  for (let c = 0; c < 8; c++) { const w = (c < 4 ? splA : splB)[k + (c & 3)]; if (w > bw) { bw = w; best = LAYERS[c + 1].id; } }
  return best;
}
// run-length encoding: zero runs as [0, n]; everything else literal. Then base64.
export function encodePaint() {
  const out = [];
  for (const arr of [splA, splB]) {
    for (let i = 0; i < arr.length;) {
      if (arr[i] === 0) { let n = 1; while (n < 255 && i + n < arr.length && arr[i + n] === 0) n++; out.push(0, n); i += n; }
      else out.push(arr[i++]);
    }
  }
  const b = Uint8Array.from(out); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function decodePaint(str) {
  if (!str) { resetPaint(); return; }
  const s = atob(str); let p = 0;
  const all = new Uint8Array(splA.length * 2);
  for (let i = 0; i < s.length && p < all.length; i++) {
    const v = s.charCodeAt(i);
    if (v === 0) { const n = s.charCodeAt(++i); p += n; } else all[p++] = v;
  }
  splA.set(all.subarray(0, splA.length)); splB.set(all.subarray(splA.length));
  texA.needsUpdate = texB.needsUpdate = true;
}
export const isDefaultPaint = () => { for (let i = 0; i < splA.length; i++) if (splA[i] !== defA[i] || splB[i] !== defB[i]) return false; return true; };

// ---------------- water ----------------
let lastSig = '';
/** All water polygons as they are now, in world space. */
export function waterPolys() {
  const out = [];
  for (const m of TER.colModel) {
    if (m.del || !m.orig.water) continue;
    const G = TER.groups[m.grp]; if (G && G.hide) continue;
    const q = TER.liveCanon(m); if (q.kind === 'poly') out.push({ q, src: m });
  }
  for (const a of TER.extraCols) if (a.q.water && a.q.kind === 'poly') out.push({ q: a.q, src: a });
  return out;
}
export function rebuildWater(force = false) {
  if (!SCENE || !WMAT) return;
  const polys = waterPolys();
  const sig = polys.map(({ q }) => [q.cx, q.cz, q.rot, q.pts.map((p) => p.join(',')).join(';')].join('|')).join('#');
  if (!force && sig === lastSig) return;
  lastSig = sig;
  for (const c of waterGroup.children.slice()) { waterGroup.remove(c); c.geometry.dispose(); }
  for (const { q } of polys) {
    const P = TER.polyEngine(q).poly; if (P.length < 3) continue;
    let y = 1e9;
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length];
      for (let t = 0; t < 1; t += 0.25) y = Math.min(y, TER.heightAt(ax + (bx - ax) * t, az + (bz - az) * t));
    }
    let v2 = P.map(([x, z]) => new THREE.Vector2(x, -z)); if (THREE.ShapeUtils.isClockWise(v2)) v2 = v2.reverse();
    const sh = new THREE.Shape(v2);
    const g = new THREE.ShapeGeometry(sh, 2); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
    const mesh = new THREE.Mesh(g, WMAT); mesh.position.y = y + 0.06;
    mesh.userData.noLift = true; mesh.frustumCulled = false; mesh.renderOrder = 1;
    waterGroup.add(mesh);
  }
}
