// Wearable clothes (diet 2026-11-27: "if i buy items from the thread shop, they should be wearable garments for the character").
//
// Everything Bev's Threads sells is a garment Goobles actually wears. Bought garments are owned for good; wear or take
// them off from the BAG, the RV bedroom wardrobe, or by picking an owned item at Bev's till again. Saved in localStorage.
//
// How the clothes are made (phone performance): every worn garment is baked into ONE SkinnedMesh with vertex colours
// and one unlit material, bound to Goobles' own skeleton. That is one extra draw call however much he wears, and
// nothing at all when he wears nothing. The skeleton is shared, so the clothes follow every clip, the punch / gun /
// cuff overrides and the four-legged climbing pose for free.
//   - Fitted pieces (sweater, vest, socks) are shrink-wrapped copies of the body's own skinned triangles, pushed out
//     along a smoothed normal, so they keep the body's skin weights and bend exactly with him.
//   - Rigid pieces (cap, scarf, the sweater's bell) are small low-poly shapes weighted 100% to one bone.
//   - Faces are flat colours with a little light baked in per face, like the painted-in lighting on his textures,
//     and are tinted for night with the same colour goobles.js gives his own materials.
// Old procedural Goobles (?goobles=old) has no rig to wear things on; the wardrobe still saves, it just draws nothing.
import * as THREE from 'three';
import * as INTR from './interiors.js';

const KEY = 'mg.wardrobe';
export const GARMENTS = {
  socks: { name: 'Fish-print socks', shop: 'bev' },
  scarf: { name: 'Hand-knit scarf', shop: 'bev' },
  cap: { name: 'Maple Grove ball cap', shop: 'bev', head: true },
  vest: { name: 'Hi-vis work vest', shop: 'bev' },
  sweater: { name: 'Ugly holiday sweater', shop: 'bev' },
  gloves: { name: 'Leather work gloves', shop: 'hank' },
  // crafted from raccoon pelts (skin a knocked-out raccoon, fishing.js), stitched in the BAG or at the RV wardrobe
  coongloves: { name: 'Raccoon-skin mittens', pelts: 2 },
  coonjacket: { name: 'Raccoon-skin jacket', pelts: 3 },
};
const ORDER = ['cap', 'scarf', 'sweater', 'coonjacket', 'vest', 'gloves', 'coongloves', 'socks'];
const HANDS = ['gloves', 'coongloves'];   // one pair at a time

const S = { owned: {}, worn: {} };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { Object.assign(S.owned, s.owned || {}); Object.assign(S.worn, s.worn || {}); } } catch (e) { /* storage blocked */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ owned: S.owned, worn: S.worn })); } catch (e) { /* ignore */ } };

let A = null, mesh = null, built = '', mat = null, coonWas = false;

export const isGarment = (id) => !!GARMENTS[id];
export const owns = (id) => !!S.owned[id];
export const wearing = (id) => !!(S.owned[id] && S.worn[id]);
export function give(id, wear = true) { if (!GARMENTS[id]) return false; S.owned[id] = true; if (wear) setWorn(id, true); save(); return true; }
export function setWorn(id, on) {
  if (!S.owned[id]) return false;
  S.worn[id] = !!on;
  // one hat at a time: the cap and the coonskin cap swap
  if (on && HANDS.includes(id)) for (const h of HANDS) if (h !== id) S.worn[h] = false;
  if (on && GARMENTS[id].head && A && A.fishing && A.fishing.S && A.fishing.S.wearHat) { A.fishing.S.wearHat = false; coonWas = false; }
  save(); return true;
}
export const toggle = (id) => setWorn(id, !wearing(id));

/** Menu rows: stitch what the pelts allow, then wear / take off every owned garment (BAG and wardrobe). */
export function rows() {
  const fs = A && A.fishing && A.fishing.S, pelts = (fs && fs.pelts) | 0;
  const craft = ORDER.filter((id) => GARMENTS[id].pelts && !S.owned[id] && pelts > 0).map((id) => {
    const need = GARMENTS[id].pelts;
    return { id: 'craft:' + id, label: `Stitch ${GARMENTS[id].name.toLowerCase()}`, price: `${need} pelts`, blurb: (pelts < need ? `You have ${pelts} pelt${pelts > 1 ? 's' : ''}. ` : '') + BLURB[id], dim: pelts < need, ext: () => craftIt(id) };
  });
  return craft.concat(ORDER.filter((id) => S.owned[id]).map((id) => ({ id: 'wear:' + id, label: (wearing(id) ? 'Take off ' : 'Wear ') + GARMENTS[id].name.replace(/^./, (c) => c.toLowerCase()), price: wearing(id) ? 'on' : '', blurb: BLURB[id], ext: () => { toggle(id); A && A.Sfx && A.Sfx.blip && A.Sfx.blip(wearing(id) ? 620 : 380); } })));
}
function craftIt(id) {
  const fs = A.fishing.S, need = GARMENTS[id].pelts;
  if ((fs.pelts | 0) < need) { A.Sfx && A.Sfx.blip && A.Sfx.blip(180); A.toast && A.toast(`Takes ${need} pelts. Raccoons are in the park. You know what to do.`, 3.5); return; }
  fs.pelts -= need; A.fishing.save && A.fishing.save();
  give(id, true); A.Sfx && A.Sfx.jingle && A.Sfx.jingle();
  A.toast && A.toast(CRAFTED[id], 4);
}
const CRAFTED = {
  coongloves: 'Stitched raccoon-skin mittens. The little hands are now inside bigger little hands.',
  coonjacket: 'Stitched a raccoon-skin jacket, ringed tail and all. The park crew will be furious.',
};
const BLURB = {
  gloves: 'Cat sized, somehow. Hank does not ask questions.',
  coongloves: 'Two pelts of mittens, ringed cuffs. Very frontier, very warm.',
  coonjacket: 'Three pelts. Grey fur, a dark mask collar and the striped tail hanging down the back.',
  socks: 'Teal with little orange fish. Two pair, because you have four feet.',
  scarf: 'Red and cream, wrapped round twice. Cozy burrito mode.',
  cap: 'Navy, maple leaf on the front, ear holes cut with pinking shears.',
  vest: 'Blaze orange with reflective bands. Visible from space.',
  sweater: 'Red, a snowflake band, a little bell. Here since 1991.',
};

function openWardrobe() {
  const f = A.fishing; if (!f || !f.menu) return false;
  return f.menu({
    title: 'Wardrobe',
    items: () => { const r = rows(); return r.length ? r : [{ id: 'none', label: '(nothing to wear yet)', price: '', blurb: "Bev's Threads on Main Street sells clothes that fit a cat.", dim: true }]; },
    pick: (it) => { if (it.ext) it.ext(); },
  });
}

/** a = { cat, fishing, Sfx, toast } */
export function init(a) {
  A = a;
  if (a.fishing && a.fishing.bagExtras) a.fishing.bagExtras.push({ rows, has: () => Object.keys(S.owned).length > 0 });
  INTR.on('interact', (room, spot) => (room === 'rv' && spot === 'wardrobe' ? (openWardrobe(), true) : false));
  window.__G && (window.__G.wardrobe = api);
  return api;
}

/** Every frame, after cat.userData.sync. Rebuilds the clothes mesh only when what he wears changes. */
export function update() {
  if (!A) return;
  const u = A.cat.userData, fs = A.fishing && A.fishing.S;
  // the coonskin cap was just put on from the BAG: the ball cap comes off
  const coon = !!(fs && fs.hat && fs.wearHat);
  if (coon && !coonWas && S.worn.cap) { S.worn.cap = false; save(); }
  coonWas = coon;
  if (!u.model || !u.bones) return;
  const key = ORDER.filter(wearing).join(',');
  if (key !== built) build(u, key);
  if (mesh && mat && u.mats && u.mats[0]) mat.color.copy(u.mats[0].color);   // night dimming, same as his fur
}

// ------------------------------------------------------------------------------------------------ geometry
const LIGHT = new THREE.Vector3(0.35, 1, 0.55).normalize();
const shade = (n) => 0.74 + 0.3 * Math.max(0, n.dot(LIGHT)) - 0.1 * Math.max(0, -n.y);
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

function srcMeshes(u) { const m = {}; u.model.traverse((n) => { if (n.isSkinnedMesh) m[n.name] = n; }); return m; }

// a garment is accumulated as flat triangle soup: position, skinIndex, skinWeight, colour (3 verts per face)
function makeSoup() { return { p: [], j: [], w: [], c: [] }; }
const _t = { ax: 0, ix: 0, y: 0 };   // the face's max |x|, min |x| and max y, for keep()
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Vector3(), _col = new THREE.Color();

/** Shrink-wrap: copy triangles of a skinned body part, pushed out by d along smoothed normals. keep(centroid, bones) picks faces, color(centroid, normal) paints them. */
function wrap(soup, src, d, keep, color) {
  const g = src.geometry, P = g.attributes.position, J = g.attributes.skinIndex, Wt = g.attributes.skinWeight, idx = g.index;
  const n = idx ? idx.count : P.count, vi = (k) => (idx ? idx.getX(k) : k);
  // smoothed normals: average face normals over vertices that share a position (the mesh is flat-shaded, so split)
  const keyOf = (i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`;
  const acc = new Map();
  for (let k = 0; k < n; k += 3) {
    _a.fromBufferAttribute(P, vi(k)); _b.fromBufferAttribute(P, vi(k + 1)); _c.fromBufferAttribute(P, vi(k + 2));
    _n.subVectors(_c, _b).cross(_m.subVectors(_a, _b));
    for (let t = 0; t < 3; t++) { const key = keyOf(vi(k + t)); const v = acc.get(key) || new THREE.Vector3(); v.add(_n); acc.set(key, v); }
  }
  for (const v of acc.values()) v.normalize();
  const bone = (i) => { let b = 0; for (let c = 1; c < 4; c++) if (Wt.getComponent(i, c) > Wt.getComponent(i, b)) b = c; return J.getComponent(i, b); };
  for (let k = 0; k < n; k += 3) {
    const ids = [vi(k), vi(k + 1), vi(k + 2)];
    _a.fromBufferAttribute(P, ids[0]); _b.fromBufferAttribute(P, ids[1]); _c.fromBufferAttribute(P, ids[2]);
    _m.copy(_a).add(_b).add(_c).divideScalar(3);
    _t.ax = Math.max(Math.abs(_a.x), Math.abs(_b.x), Math.abs(_c.x)); _t.y = Math.max(_a.y, _b.y, _c.y); _t.ix = Math.min(Math.abs(_a.x), Math.abs(_b.x), Math.abs(_c.x));
    if (!keep(_m, ids.map(bone), _t)) continue;
    _n.subVectors(_c, _b).cross(_b.clone().sub(_a).negate()).normalize();
    color(_col, _m, _n, k / 3);
    const s = shade(_n);
    for (const i of ids) {
      const o = acc.get(keyOf(i));
      soup.p.push(P.getX(i) + o.x * d, P.getY(i) + o.y * d, P.getZ(i) + o.z * d);
      for (let c = 0; c < 4; c++) { soup.j.push(J.getComponent(i, c)); soup.w.push(Wt.getComponent(i, c)); }
      soup.c.push(_col.r * s, _col.g * s, _col.b * s);
    }
  }
}

/** Rigid piece: a three.js geometry already placed in bind (model) space, weighted 100% to one bone. */
function rigid(soup, geo, boneIdx, color) {
  const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position;
  for (let k = 0; k < P.count; k += 3) {
    _a.fromBufferAttribute(P, k); _b.fromBufferAttribute(P, k + 1); _c.fromBufferAttribute(P, k + 2);
    _n.subVectors(_c, _b).cross(_m.subVectors(_a, _b)).normalize();
    _m.copy(_a).add(_b).add(_c).divideScalar(3);
    color(_col, _m, _n, k / 3);
    const s = shade(_n);
    for (const v of [_a, _b, _c]) { soup.p.push(v.x, v.y, v.z); soup.j.push(boneIdx, 0, 0, 0); soup.w.push(1, 0, 0, 0); soup.c.push(_col.r * s, _col.g * s, _col.b * s); }
  }
}

const C = (hex) => new THREE.Color(hex);
const PAL = {
  sweater: C(0xb8262e), sweaterDark: C(0x7e1820), cream: C(0xf2ead6), green: C(0x2f7a3c), gold: C(0xe8c040),
  vest: C(0xff6a14), silver: C(0xd8dde4),
  sock: C(0x2a8f96), sockFish: C(0xf28a2a),
  scarf: C(0xc2303a), scarf2: C(0xf0e4c8),
  leather: C(0x8a5a2e), leatherDark: C(0x5e3c1e),
  coon: C(0x7d7468), coonDark: C(0x3a3632), coonLight: C(0xc8c2b6),
  cap: C(0x22345a), capBrim: C(0x1a2846), leaf: C(0xd23a2a),
};

const GARMENT_BUILD = {
  sweater(soup, src, B) {
    // body + short sleeves + the fur of the forearms = long sleeves to the wrist. Snowflake band across the chest.
    const color = (o, m, n, f) => {
      const y = m.y;
      if (y > 0.6 && y < 0.67) return o.copy(f & 1 ? PAL.cream : PAL.green);   // zigzag: the loft's triangles alternate
      if (y < 0.445) return o.copy(PAL.sweaterDark);                                 // ribbed hem
      return o.copy(PAL.sweater);
    };
    wrap(soup, src.Body, 0.011, () => true, color);
    wrap(soup, src.Arms, 0.012, () => true, (o) => o.copy(PAL.sweater));
    sleeves(soup, src, B, 0.012, (o, m) => o.copy(Math.abs(m.x) > 0.345 ? PAL.sweaterDark : PAL.sweater));
    // the little bell, on the chest under the band
    const bell = new THREE.OctahedronGeometry(0.022, 0); bell.translate(0, 0.585, 0.1);
    rigid(soup, bell, B.chest, (o) => o.copy(PAL.gold));
  },
  vest(soup, src) {
    // over the sweater if he wears both. Two reflective bands; the front is open down the middle.
    wrap(soup, src.Body, 0.022, (m) => m.y > 0.432 && !(m.z > 0.03 && Math.abs(m.x) < 0.018), (o, m) => o.copy((m.y > 0.5 && m.y < 0.535) || (m.y > 0.64 && m.y < 0.69) ? PAL.silver : PAL.vest));
  },
  socks(soup, src) {
    const color = (o, m) => o.copy(hash(m.x, m.y, m.z) < 0.22 ? PAL.sockFish : PAL.sock);
    wrap(soup, src.Feet, 0.007, () => true, color);
    wrap(soup, src.Legs, 0.008, (m, b, t) => t.y < 0.3, color);   // knee socks: the whole shin
  },
  scarf(soup, src, B) {
    // two chunky wraps round the neck (it is a short neck), and one end hanging down the front
    for (const [y, r, s] of [[0.712, 0.112, 1], [0.752, 0.104, 0]]) {
      const t = new THREE.TorusGeometry(r, 0.03, 4, 10); t.rotateX(Math.PI / 2); t.scale(1.12, 1, 1.02); t.rotateY(s * 0.3); t.translate(0, y, 0.022);
      rigid(soup, t, B.chest, (o) => o.copy(s ? PAL.scarf : PAL.scarf2));   // red wrap under a cream one; the end is striped
    }
    const end = new THREE.BoxGeometry(0.06, 0.17, 0.022, 1, 3, 1); end.rotateZ(0.12); end.rotateX(-0.12); end.translate(0.045, 0.635, 0.112);
    rigid(soup, end, B.chest, (o, m) => o.copy(Math.floor(m.y * 34) & 1 ? PAL.scarf2 : PAL.scarf));
  },
  gloves(soup, src, B) { paws(soup, src, B, (o, m) => o.copy(Math.abs(m.x) < 0.395 ? PAL.leatherDark : PAL.leather)); },
  coongloves(soup, src, B) { paws(soup, src, B, (o, m) => (Math.abs(m.x) < 0.395 ? o.copy(Math.floor(Math.abs(m.x) * 90) & 1 ? PAL.coonDark : PAL.coonLight) : o.copy(PAL.coon).multiplyScalar(0.9 + 0.2 * hash(m.x, m.y, m.z)))); },
  coonjacket(soup, src, B) {
    // between the sweater and the vest. Mottled grey fur, dark mask-stripe collar, ringed cuffs, tail down the back.
    const fur = (o, m) => o.copy(PAL.coon).multiplyScalar(0.86 + 0.26 * hash(m.x, m.y, m.z));
    wrap(soup, src.Body, 0.016, (m) => !(m.z > 0.04 && Math.abs(m.x) < 0.012), (o, m) => (m.y > 0.705 ? o.copy(PAL.coonDark) : fur(o, m)));
    wrap(soup, src.Arms, 0.017, () => true, fur);
    sleeves(soup, src, B, 0.017, (o, m) => (Math.abs(m.x) > 0.31 ? o.copy(Math.floor(Math.abs(m.x) * 60) & 1 ? PAL.coonDark : PAL.coonLight) : fur(o, m)));
    // the tail: six ringed segments hanging off the back of the collar, on the chest bone
    for (let i = 0; i < 6; i++) {
      const r = 0.032 - i * 0.002, seg = new THREE.CylinderGeometry(r, r, 0.05, 6); seg.translate(0, 0.66 - i * 0.048, -0.098 - i * 0.004);
      rigid(soup, seg, i < 3 ? B.chest : B.spine, (o) => o.copy(i % 2 ? PAL.coonDark : PAL.coonLight));
    }
  },
  cap(soup, src, B) {
    // seats on the flat crown between the ears (they poke out of the cut holes), brim forward
    const crown = new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2); crown.scale(0.19, 0.085, 0.15); crown.translate(0, 1.04, 0.004);
    rigid(soup, crown, B.head, (o) => o.copy(PAL.cap));
    const band = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); band.scale(0.192, 0.05, 0.152); band.translate(0, 1.016, 0.004);
    rigid(soup, band, B.head, (o, m, n) => o.copy(m.z > 0.12 && Math.abs(m.x) < 0.05 ? PAL.leaf : PAL.cap));
    const brim = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false, -Math.PI / 2, Math.PI); brim.scale(0.15, 0.014, 0.13); brim.rotateX(0.1); brim.translate(0, 0.996, 0.14);
    rigid(soup, brim, B.head, (o) => o.copy(PAL.capBrim));
    const btn = new THREE.OctahedronGeometry(0.016, 0); btn.translate(0, 1.125, 0.004);
    rigid(soup, btn, B.head, (o) => o.copy(PAL.cap));
  },
};

// long sleeves: the fur of the upper arm, forearm and wrist (his arms are bare fur past the body's short sleeves)
function sleeves(soup, src, B, d, color) {
  const arm = new Set([B.arm_L, B.arm_R, B.forearm_L, B.forearm_R, B.hand_L, B.hand_R]);
  if (src.Fur) wrap(soup, src.Fur, d, (m, b, t) => b.every((x) => arm.has(x)) && t.ix > 0.17 && t.ax < 0.385, color);
}
// paws: the hand-bone fur (thin four-finger paws) plus the wrists, wrapped close so the fingers stay readable
function paws(soup, src, B, color) {
  const h = new Set([B.hand_L, B.hand_R, B.hand_end_L, B.hand_end_R]);
  if (src.Fur) wrap(soup, src.Fur, 0.006, (m, b) => b.every((x) => h.has(x)) || (Math.abs(m.x) > 0.355 && b.some((x) => h.has(x))), color);
}

function build(u, key) {
  built = key;
  if (mesh) { mesh.parent && mesh.parent.remove(mesh); mesh.geometry.dispose(); mesh = null; }
  if (!key) return;
  const src = srcMeshes(u), ref = src.Fur || Object.values(src)[0]; if (!ref) return;
  const sk = ref.skeleton, B = {}; sk.bones.forEach((b, i) => { B[b.name] = i; });
  const soup = makeSoup();
  for (const id of key.split(',')) { try { GARMENT_BUILD[id](soup, src, B); } catch (e) { console.error('[wardrobe] ' + id, e); } }
  if (!soup.p.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(soup.p, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(soup.j, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(soup.w, 4));
  g.setAttribute('color', new THREE.Float32BufferAttribute(soup.c, 3));
  g.computeBoundingSphere();
  mat = mat || new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  mesh = new THREE.SkinnedMesh(g, mat); mesh.name = 'Clothes';
  mesh.frustumCulled = false; mesh.layers.mask = ref.layers.mask; mesh.renderOrder = ref.renderOrder;
  ref.parent.add(mesh);
  mesh.bind(sk, ref.bindMatrix);
}

export const api = { S, GARMENTS, give, owns, wearing, setWorn, toggle, rows, open: () => openWardrobe(), tris: () => (mesh ? mesh.geometry.attributes.position.count / 3 : 0), mesh: () => mesh };
