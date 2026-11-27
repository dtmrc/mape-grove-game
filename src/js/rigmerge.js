// rigmerge.js: one draw call per kind of surface for a jointed figure (2026-11-27).
// People and raccoons are built from rigid pieces hanging off pivots (hips, shoulders, head...). Drawn as built, a
// walker cost 15 to 18 draw calls: six part meshes, each split again per material (skin, shirt, pants, hair, shoe...).
// rigMerge() rebuilds the same triangles into a few rigidly-skinned meshes, where every vertex follows exactly one
// pivot (weight 1), so the animation code keeps turning the same pivots and the pose is identical. Surfaces that only
// differ by colour share one material: the colour moves into a vertex attribute (material colour x vertex colour is
// the same product the shader computed before). Different textures, shininess or blending stay separate draws.
//   walker: plain colours (1) + cloth texture (1) + shoes (1) + face (1) + blob shadow (1) = 5 draws
// Things added to a pivot afterwards (props, bent legs) are ordinary meshes and still work. Hiding a pivot hides its
// part of the merged mesh (townsfolk swap straight legs for bent ones that way).
import * as THREE from 'three';

const PROPS = ['type', 'side', 'transparent', 'opacity', 'alphaTest', 'flatShading', 'shininess', 'depthWrite', 'depthTest', 'blending', 'fog', 'wireframe',
  'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'toneMapped', 'reflectivity', 'combine', 'emissiveIntensity', 'colorWrite', 'dithering', 'alphaHash', 'vertexColors'];
const TEXS = ['map', 'alphaMap', 'aoMap', 'lightMap', 'emissiveMap', 'specularMap', 'envMap', 'bumpMap', 'normalMap', 'displacementMap'];
const DEFAULT_OBC = THREE.Material.prototype.onBeforeCompile;
const classKeys = new WeakMap();
/** Materials with the same key draw identically apart from their colour. null = leave this mesh alone. */
function classKey(m) {
  if (classKeys.has(m)) return classKeys.get(m);
  let k = null;
  if ((m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial) && !m.transparent && m.opacity === 1 && m.visible
    && m.onBeforeCompile === DEFAULT_OBC && !Object.keys(m.userData).length && !m.clippingPlanes) {
    k = PROPS.map((p) => m[p]).join(',') + '|' + TEXS.map((t) => (m[t] ? m[t].uuid : '')).join(',')
      + '|' + (m.emissive ? m.emissive.getHex() : '') + '|' + (m.specular ? m.specular.getHex() : '');
  }
  classKeys.set(m, k); return k;
}
const batchMats = new Map();
function batchMat(key, m) {
  let b = batchMats.get(key);
  if (!b) { b = m.clone(); b.color.setRGB(1, 1, 1); b.vertexColors = true; b.name = 'rig:' + (m.name || m.type); batchMats.set(key, b); }
  return b;
}
const shapes = new Map(), geos = new Map();
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();
const f4 = (e) => { let s = ''; for (let i = 0; i < 16; i++) s += Math.round(e[i] * 1e4) + ','; return s; };

/** Test switch: `window.__RIG.on = false` builds figures the old way (tools/qa suite rigmerge compares the two pixel for pixel). */
export const RIG = { on: true };
if (typeof window !== 'undefined') window.__RIG = RIG;
/** Rebuild the static meshes under `root` into rigid-skinned meshes, one per material class. Returns the number of meshes replaced. */
export function rigMerge(root) {
  if (!RIG.on) return 0;
  const list = [];
  root.traverse((o) => { if (o !== root) list.push(o); });
  const made = rigMergeList(root, list);
  if (!made.length) return 0;
  const first = made.first;
  for (const mesh of made) { mesh.layers.mask = first.layers; mesh.receiveShadow = first.receive; root.add(mesh); }
  root.userData.rigMeshes = made;
  return made.length;
}

/** The core: merge the batchable meshes in `list` (descendants of `frame`) into skinned meshes that are to be parented
 *  under `frame` with no transform of their own (directly, or through identity nodes like a LOD). The caller attaches
 *  the returned meshes. Pieces that can't be batched (transparent, named, with userData...) are left where they are. */
export function rigMergeList(frame, list, min = 2) {
  if (!RIG.on) return [];
  frame.updateWorldMatrix(true, false); frame.updateMatrixWorld(true);
  const root = frame;
  _inv.copy(frame.matrixWorld).invert();
  // 1. the pieces: every plain Mesh whose material(s) can be batched
  const pieces = [], bones = [], boneIx = new Map();
  for (const o of list) {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.parent || o.children.length || !o.visible) continue;
    const g = o.geometry; if (!g || !g.attributes.position || !g.attributes.normal || g.morphAttributes.position) continue;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const keys = mats.map(classKey); if (keys.some((k) => k === null)) continue;
    if (Array.isArray(o.material) && !g.groups.length) continue;
    if (o.renderOrder || o.userData.keep || Object.keys(o.userData).length || o.name) continue;   // something refers to it: leave it
    let b = boneIx.get(o.parent); if (b === undefined) { b = bones.length; bones.push(o.parent); boneIx.set(o.parent, b); }
    pieces.push({ o, g, mats, keys, b });
  }
  if (pieces.length < min) return [];
  // 2. per material class: the shape (shared between every figure built the same way) + this figure's colours
  // The shape of a class depends only on its own pieces (which geometry, on which pivot, where), not on the rest of the
  // figure or on which texture it wears: every walker shares one copy of the legs, shoes and head however it is dressed.
  const byClass = new Map(), boneSig = bones.map((b) => f4(_m.multiplyMatrices(_inv, b.matrixWorld).elements));
  for (const p of pieces) {
    const groups = p.g.groups.length ? p.g.groups : [{ start: 0, count: p.g.index ? p.g.index.count : p.g.attributes.position.count, materialIndex: 0 }];
    const at = p.g.uuid + '@' + p.b + ':' + boneSig[p.b] + ':' + f4(p.o.matrix.elements);
    for (const gr of groups) {
      const mi = Array.isArray(p.o.material) ? gr.materialIndex : 0, key = p.keys[mi];
      let C = byClass.get(key); if (!C) byClass.set(key, C = { key, mat: p.mats[mi], parts: [], sig: '' });
      C.parts.push({ p, gr, mat: p.mats[mi] });
      C.sig += at + '/' + gr.start + '+' + gr.count + (p.mats[mi].vertexColors ? 'v' : '') + ';';
    }
  }
  const made = [];
  for (const C of byClass.values()) {
    const shapeKey = C.sig;
    let S = shapes.get(shapeKey);
    if (!S) {
      let n = 0; for (const q of C.parts) n += q.gr.count;
      const pos = new Float32Array(n * 3), nor = new Int16Array(n * 3), uv = new Float32Array(n * 2), si = new Uint8Array(n * 4), sw = new Uint8Array(n * 4), base = new Float32Array(n * 3);
      const ranges = []; let d = 0, r2 = 0;
      for (const q of C.parts) {
        const g = q.p.g, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, K = g.attributes.color, ix = g.index;
        _m.multiplyMatrices(_inv, q.p.o.matrixWorld); _n.getNormalMatrix(_m);
        const flip = _m.determinant() < 0;   // a mirrored piece (the wheels on one side of a car): reverse the winding so it still faces out
        ranges.push(d, q.gr.count);
        for (let i = 0; i < q.gr.count; i++, d++) {
          const j = flip && i % 3 ? (i % 3 === 1 ? i + 1 : i - 1) : i;
          const s = ix ? ix.getX(q.gr.start + j) : q.gr.start + j;
          _v.fromBufferAttribute(P, s).applyMatrix4(_m); pos[d * 3] = _v.x; pos[d * 3 + 1] = _v.y; pos[d * 3 + 2] = _v.z; r2 = Math.max(r2, _v.lengthSq());
          _v.fromBufferAttribute(N, s).applyMatrix3(_n).normalize(); nor[d * 3] = Math.round(_v.x * 32767); nor[d * 3 + 1] = Math.round(_v.y * 32767); nor[d * 3 + 2] = Math.round(_v.z * 32767);
          if (U) { uv[d * 2] = U.getX(s); uv[d * 2 + 1] = U.getY(s); }
          if (K && q.mat.vertexColors) { base[d * 3] = K.getX(s); base[d * 3 + 1] = K.getY(s); base[d * 3 + 2] = K.getZ(s); } else { base[d * 3] = base[d * 3 + 1] = base[d * 3 + 2] = 1; }
          si[d * 4] = q.p.b; sw[d * 4] = 255;
        }
      }
      // compact formats (every figure of this build shares these buffers): normals 16-bit, pivot index and weight bytes.
      // Positions stay floats: 16-bit positions moved a few edge pixels in the comparison test.
      let allOne = true; for (let i = 0; i < base.length && allOne; i++) if (base[i] !== 1) allOne = false;
      let maxBase = 0; for (let i = 0; i < base.length; i++) if (base[i] > maxBase) maxBase = base[i];
      S = { n, ranges, base: allOne ? null : base, maxBase, radius: Math.sqrt(r2), attrs: { position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3, true), uv: new THREE.BufferAttribute(uv, 2),
        skinIndex: new THREE.BufferAttribute(si, 4), skinWeight: new THREE.BufferAttribute(sw, 4, true) } };   // bytes: one pivot per vertex, weight 255/255
      shapes.set(shapeKey, S);
    }
    // the colours of this figure's surfaces, in the shape's order
    let colKey = shapeKey + '~'; for (const q of C.parts) colKey += q.mat.color.getHex() + ',';
    let geo = geos.get(colKey);
    if (!geo) {
      // 16-bit colours (1/65535 steps, far below what the screen can show), floats only if something is brighter than 1
      let hi = S.maxBase; { let m = 0; for (const q of C.parts) m = Math.max(m, q.mat.color.r, q.mat.color.g, q.mat.color.b); hi *= m; }
      const k16 = hi <= 1 ? 65535 : 0, col = k16 ? new Uint16Array(S.n * 3) : new Float32Array(S.n * 3);
      C.parts.forEach((q, k) => {
        _c.copy(q.mat.color); const a = S.ranges[k * 2], cnt = S.ranges[k * 2 + 1];
        const B = S.base, m = k16 || 1;
        for (let i = a; i < a + cnt; i++) { const r = (B ? B[i * 3] : 1) * _c.r * m, g = (B ? B[i * 3 + 1] : 1) * _c.g * m, b = (B ? B[i * 3 + 2] : 1) * _c.b * m; col[i * 3] = k16 ? Math.round(r) : r; col[i * 3 + 1] = k16 ? Math.round(g) : g; col[i * 3 + 2] = k16 ? Math.round(b) : b; }
      });
      geo = new THREE.BufferGeometry();
      for (const k in S.attrs) geo.setAttribute(k, S.attrs[k]);   // shared buffers: one copy on the GPU for every figure of this build
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3, !!k16));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), S.radius * 1.6);   // room for swinging limbs
      geos.set(colKey, geo);
    }
    const mesh = new THREE.SkinnedMesh(geo, batchMat(C.key, C.mat));
    mesh.boundingSphere = geo.boundingSphere.clone();
    mesh.userData.rig = true;
    made.push(mesh);
  }
  // 3. swap: the pieces leave their pivots, the merged meshes hang off the frame and follow the pivots as bones
  made.first = { layers: pieces[0].o.layers.mask, receive: pieces[0].o.receiveShadow };
  for (const p of pieces) p.o.parent.remove(p.o);
  const skel = new THREE.Skeleton(bones, bones.map((b) => new THREE.Matrix4().copy(b.matrixWorld).invert()));
  const update = skel.update;
  skel.update = function () {
    update.call(this);
    const bm = this.boneMatrices;
    for (let i = 0; i < bones.length; i++) {
      let o = bones[i], hidden = false;
      while (o && o !== root) { if (!o.visible) { hidden = true; break; } o = o.parent; }
      if (hidden) bm.fill(0, i * 16, i * 16 + 16);   // a hidden pivot hides its part of the merged mesh
    }
  };
  for (const mesh of made) { mesh.layers.mask = made.first.layers; mesh.receiveShadow = made.first.receive; mesh.bind(skel, frame.matrixWorld); }
  return made;
}

/** For props that never move against each other: the meshes under `group` that share a material become one mesh
 *  (one draw call per material instead of one per piece). Transparent, hidden, skinned and `keep` meshes are left alone,
 *  so anything the game animates or toggles has to be passed in `keep`. Returns how many pieces were merged away. */
export function staticMerge(group, keep = []) {
  if (!RIG.on) return 0;
  group.updateWorldMatrix(true, false); group.updateMatrixWorld(true);
  _inv.copy(group.matrixWorld).invert();
  const skip = new Set(keep), by = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o === group || o.children.length || !o.visible || skip.has(o) || Array.isArray(o.material)) return;
    for (let p = o.parent; p && p !== group; p = p.parent) if (!p.visible || skip.has(p)) return;
    const m = o.material, g = o.geometry;
    if (m.transparent || m.opacity < 1 || !g.attributes.position || !g.attributes.normal || g.morphAttributes.position || o.renderOrder) return;
    (by.get(m) || by.set(m, []).get(m)).push(o);
  });
  let gone = 0;
  for (const [mat, list] of by) {
    if (list.length < 2) continue;
    let n = 0; for (const o of list) n += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = mat.vertexColors ? new Float32Array(n * 3).fill(1) : null;
    let d = 0;
    for (const o of list) {
      const g = o.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, K = g.attributes.color, ix = g.index, cnt = ix ? ix.count : P.count;
      _m.multiplyMatrices(_inv, o.matrixWorld); _n.getNormalMatrix(_m); const flip = _m.determinant() < 0;
      for (let i = 0; i < cnt; i++, d++) {
        const j = flip && i % 3 ? (i % 3 === 1 ? i + 1 : i - 1) : i, s = ix ? ix.getX(j) : j;
        _v.fromBufferAttribute(P, s).applyMatrix4(_m); pos[d * 3] = _v.x; pos[d * 3 + 1] = _v.y; pos[d * 3 + 2] = _v.z;
        _v.fromBufferAttribute(N, s).applyMatrix3(_n).normalize(); nor[d * 3] = _v.x; nor[d * 3 + 1] = _v.y; nor[d * 3 + 2] = _v.z;
        if (U) { uv[d * 2] = U.getX(s); uv[d * 2 + 1] = U.getY(s); }
        if (col && K) { col[d * 3] = K.getX(s); col[d * 3 + 1] = K.getY(s); col[d * 3 + 2] = K.getZ(s); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, mat), f = list[0];
    mesh.layers.mask = f.layers.mask; mesh.receiveShadow = f.receiveShadow; mesh.castShadow = f.castShadow; mesh.userData.merged = list.length;
    for (const o of list) o.parent.remove(o);
    group.add(mesh); gone += list.length - 1;
  }
  return gone;
}
