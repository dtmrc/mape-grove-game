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
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  // 1. the pieces: every plain Mesh whose material(s) can be batched
  const pieces = [], bones = [], boneIx = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o === root || !o.parent || o.children.length || !o.visible) return;
    const g = o.geometry; if (!g || !g.attributes.position || !g.attributes.normal || g.morphAttributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const keys = mats.map(classKey); if (keys.some((k) => k === null)) return;
    if (Array.isArray(o.material) && !g.groups.length) return;
    if (o.renderOrder || o.userData.keep || Object.keys(o.userData).length || o.name) return;   // something refers to it: leave it
    let b = boneIx.get(o.parent); if (b === undefined) { b = bones.length; bones.push(o.parent); boneIx.set(o.parent, b); }
    pieces.push({ o, g, mats, keys, b });
  });
  if (pieces.length < 2) return 0;
  // 2. per material class: the shape (shared between every figure built the same way) + this figure's colours
  const byClass = new Map();
  let sig = '';
  for (const b of bones) sig += f4(_m.multiplyMatrices(_inv, b.matrixWorld).elements) + ';';
  for (const p of pieces) {
    p.o.updateMatrix();
    const groups = p.g.groups.length ? p.g.groups : [{ start: 0, count: p.g.index ? p.g.index.count : p.g.attributes.position.count, materialIndex: 0 }];
    sig += p.g.uuid + '@' + p.b + ':' + f4(p.o.matrix.elements) + '[' + groups.map((gr) => p.keys[Array.isArray(p.o.material) ? gr.materialIndex : 0]).join('/') + ']';
    for (const gr of groups) {
      const mi = Array.isArray(p.o.material) ? gr.materialIndex : 0, key = p.keys[mi];
      let C = byClass.get(key); if (!C) byClass.set(key, C = { key, mat: p.mats[mi], parts: [] });
      C.parts.push({ p, gr, mat: p.mats[mi] });
    }
  }
  const made = [];
  for (const C of byClass.values()) {
    const shapeKey = C.key + '#' + sig;
    let S = shapes.get(shapeKey);
    if (!S) {
      let n = 0; for (const q of C.parts) n += q.gr.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), base = new Float32Array(n * 3);
      const ranges = []; let d = 0, r2 = 0;
      for (const q of C.parts) {
        const g = q.p.g, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, K = g.attributes.color, ix = g.index;
        _m.multiplyMatrices(_inv, q.p.o.matrixWorld); _n.getNormalMatrix(_m);
        ranges.push(d, q.gr.count);
        for (let i = 0; i < q.gr.count; i++, d++) {
          const s = ix ? ix.getX(q.gr.start + i) : q.gr.start + i;
          _v.fromBufferAttribute(P, s).applyMatrix4(_m); pos[d * 3] = _v.x; pos[d * 3 + 1] = _v.y; pos[d * 3 + 2] = _v.z; r2 = Math.max(r2, _v.lengthSq());
          _v.fromBufferAttribute(N, s).applyMatrix3(_n).normalize(); nor[d * 3] = _v.x; nor[d * 3 + 1] = _v.y; nor[d * 3 + 2] = _v.z;
          if (U) { uv[d * 2] = U.getX(s); uv[d * 2 + 1] = U.getY(s); }
          if (K && q.mat.vertexColors) { base[d * 3] = K.getX(s); base[d * 3 + 1] = K.getY(s); base[d * 3 + 2] = K.getZ(s); } else { base[d * 3] = base[d * 3 + 1] = base[d * 3 + 2] = 1; }
          si[d * 4] = q.p.b; sw[d * 4] = 1;
        }
      }
      S = { n, ranges, base, radius: Math.sqrt(r2), attrs: { position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3), uv: new THREE.BufferAttribute(uv, 2),
        skinIndex: new THREE.BufferAttribute(si, 4), skinWeight: new THREE.BufferAttribute(sw, 4) } };
      shapes.set(shapeKey, S);
    }
    // the colours of this figure's surfaces, in the shape's order
    let colKey = shapeKey + '~'; for (const q of C.parts) colKey += q.mat.color.getHex() + ',';
    let geo = geos.get(colKey);
    if (!geo) {
      const col = new Float32Array(S.n * 3);
      C.parts.forEach((q, k) => {
        _c.copy(q.mat.color); const a = S.ranges[k * 2], cnt = S.ranges[k * 2 + 1];
        for (let i = a; i < a + cnt; i++) { col[i * 3] = S.base[i * 3] * _c.r; col[i * 3 + 1] = S.base[i * 3 + 1] * _c.g; col[i * 3 + 2] = S.base[i * 3 + 2] * _c.b; }
      });
      geo = new THREE.BufferGeometry();
      for (const k in S.attrs) geo.setAttribute(k, S.attrs[k]);   // shared buffers: one copy on the GPU for every figure of this build
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), S.radius * 1.6);   // room for swinging limbs
      geos.set(colKey, geo);
    }
    const mesh = new THREE.SkinnedMesh(geo, batchMat(C.key, C.mat));
    mesh.boundingSphere = geo.boundingSphere.clone();
    mesh.userData.rig = true;
    made.push(mesh);
  }
  // 3. swap: the pieces leave their pivots, the merged meshes hang off the root and follow the pivots as bones
  const layers = pieces[0].o.layers.mask, receive = pieces[0].o.receiveShadow;
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
  for (const mesh of made) { mesh.layers.mask = layers; mesh.receiveShadow = receive; root.add(mesh); }
  root.updateMatrixWorld(true);
  for (const mesh of made) mesh.bind(skel, mesh.matrixWorld);
  root.userData.rigMeshes = made;
  return pieces.length;
}
