// Maple Grove PD officer, built the Legends way (see docs/legends-style-rules.md): one skinned loft mesh for the body+head,
// one loft per arm and per leg, painted 64x256 / 32x64 atlases with stepped facet shading, a flat face plane with a
// 2x2 expression grid, angular cap. Rig matches makeHuman/animBiped ({body, torso, legs, arms, head}).
// Owned by the police thread (police.js uses it). Helpers are local copies of models.js loftGeo/facetBands so the
// art thread's file stays untouched.
import * as THREE from 'three';
import { lambert } from './gfx.js';
import { addShadow } from './models.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function loftGeo(rings, n, vOf) {
  const pos = [], uv = [], si = [], sw = [], idx = [];
  rings.forEach((r) => {
    for (let i = 0; i <= n; i++) {
      const a = (((i % n) + 0.5) / n - 0.5) * Math.PI * 2, Q = r.pts ? r.pts[i % n] : [Math.sin(a), Math.cos(a)];
      pos.push(Q[0] * r.rx + (r.dx || 0), r.y, Q[1] * r.rz + (r.dz || 0)); uv.push(i / n, vOf(r));
      si.push(r.b0, r.b1 ?? r.b0, 0, 0); sw.push(r.w ?? 1, 1 - (r.w ?? 1), 0, 0);
    }
  });
  const S = n + 1;
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) { const a = k * S + i, b = a + 1, c = a + S, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function facetBands(g, W, H, n) {
  for (let j = 0; j < n; j++) {
    const c = Math.cos(((j + 1) / n - 0.5) * Math.PI * 2), a = c > 0.7 ? 'rgba(255,255,255,0.1)' : c > 0.2 ? null : c > -0.4 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.28)';
    if (!a) continue; g.fillStyle = a; const x0 = Math.round(W * j / n), x1 = Math.round(W * (j + 1) / n); g.fillRect(x0, 0, x1 - x0, H);
  }
}
function block(w, h, d, tx = 1, tz = 1, off = 0) {
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * tx); p.setZ(i, p.getZ(i) * tz + off); }
  g.computeVertexNormals(); return g;
}
const HEAD_PTS = [[-0.4, -0.95], [-0.95, -0.35], [-1, 0.3], [-0.55, 0.75], [0.55, 0.75], [1, 0.3], [0.95, -0.35], [0.4, -0.95]];
const flatM = new Map(), texCache = new Map(); // painted atlases are shared by every officer of the same variant / skin / hair
const cachedTex = (k, w, h, draw) => { if (!texCache.has(k)) texCache.set(k, canvasTex(w, h, draw)); return texCache.get(k); };
const fm = (c) => { if (!flatM.has(c)) flatM.set(c, lambert({ color: c, flatShading: true })); return flatM.get(c); };
function mesh(geo, material, x, y, z, parent) { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); parent.add(o); return o; }

const SKINS = [['#f0c8a0', '#d8a87c'], ['#c88c60', '#a8703e'], ['#8a5a3a', '#6a4028'], ['#e8b890', '#c89470']];
const HAIRS = ['#2a1c12', '#5a3a1e', '#141414', '#8a6a3a'];

/** A small-town police officer. o = { variant: 0 deputy (slim, shades) | 1 sergeant (stout, moustache), skin, hair } */
export function makeOfficer(o = {}) {
  const v = o.variant ?? ((Math.random() * 2) | 0), stout = v === 1;
  const si = o.skin ?? ((Math.random() * SKINS.length) | 0), hi = o.hair ?? ((Math.random() * HAIRS.length) | 0), [SKIN, SKIND] = SKINS[si], HAIR = HAIRS[hi];
  const NAVY = '#24325a', NAVYD = '#18213e', NAVYL = '#34467a', PANTS = '#1c2440', GOLD = '#e0b440', BELT = '#141414';
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // ---- bones ----
  const B = []; const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); if (parent) parent.add(b); B.push(b); return b; };
  const W0 = stout ? 1.12 : 1;                                                       // stout = wider torso tube
  const torsoB = bone(null, 0, 0, 0), headB = bone(torsoB, 0, 1.72, 0);
  const armU = [], armL = [], legU = [], legL = [];
  for (const s of [-1, 1]) { const u = bone(torsoB, s * 0.37 * W0, 1.56, 0), l = bone(u, 0, -0.3, 0); armU.push(u); armL.push(l); }
  for (const s of [-1, 1]) { const u = bone(torsoB, s * 0.15, 0.86, 0), l = bone(u, 0, -0.42, 0); legU.push(u); legL.push(l); }
  const bi = (b) => B.indexOf(b), skel = new THREE.Skeleton(B);
  // ---- body atlas 64 x 256, y 0.8 .. 2.2: navy uniform shirt, badge, pocket flaps, duty belt, head ----
  const Y0 = 0.8, Y1 = 2.2, H = 256, W = 64, Y = (y) => H * (1 - (y - Y0) / (Y1 - Y0)), vOf = (r) => (r.y - Y0) / (Y1 - Y0);
  const bodyT = cachedTex('body' + v + si + hi, W, H, (g) => {
    g.translate(-W / 16, 0);
    g.fillStyle = NAVY; g.fillRect(-8, 0, W + 16, H);
    g.fillStyle = PANTS; g.fillRect(-8, Y(1.0), W + 16, H);                                                 // pants top under the belt
    g.fillStyle = SKIN; g.fillRect(-8, 0, W + 16, Y(1.67));                                                 // neck + head
    g.save(); g.resetTransform(); facetBands(g, W, H, 8); g.restore();
    const c = 32;
    g.fillStyle = BELT; g.fillRect(-8, Y(1.08), W + 16, Y(0.98) - Y(1.08));                                 // duty belt
    g.fillStyle = '#b8b8c0'; g.fillRect(c - 3, Y(1.07), 6, Y(0.99) - Y(1.07)); g.fillStyle = '#6a6a72'; g.fillRect(c - 1, Y(1.06), 2, 3);  // buckle
    g.fillStyle = '#2a2a2a'; for (const x of [c - 13, c + 9, c - 30, c + 26]) g.fillRect(x, Y(1.09), 5, Y(0.96) - Y(1.09));      // pouches, cuff case, radio
    g.fillStyle = NAVYD; g.fillRect(c - 1, Y(1.66), 2, Y(1.08) - Y(1.66));                                  // placket
    g.fillStyle = '#c8c8d0'; for (const y of [1.56, 1.42, 1.28, 1.16]) g.fillRect(c - 1, Y(y), 2, 2);      // buttons
    g.fillStyle = '#10141e'; g.beginPath(); g.moveTo(c - 6, Y(1.67)); g.lineTo(c + 6, Y(1.67)); g.lineTo(c + 1, Y(1.52)); g.lineTo(c - 1, Y(1.52)); g.fill();  // dark tie in the open collar
    g.fillStyle = NAVYL; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(c + s * 2, Y(1.68)); g.lineTo(c + s * 9, Y(1.67)); g.lineTo(c + s * 6, Y(1.58)); g.fill(); }  // collar points
    for (const s of [-1, 1]) {                                                                              // chest pockets with flaps
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(c + s * 7 - (s < 0 ? 7 : 0), Y(1.5), 7, Y(1.32) - Y(1.5));
      g.fillStyle = NAVYL; g.fillRect(c + s * 7 - (s < 0 ? 7 : 0), Y(1.5), 7, 4);
    }
    g.fillStyle = GOLD; g.beginPath();                                                                      // star badge, left chest
    const bx = c - 10, by = Y(1.56);
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 1.8 : 4; g.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r); }
    g.fill(); g.fillStyle = '#fff6c0'; g.fillRect(bx - 1, by - 2, 1, 1);
    g.fillStyle = '#e8e8e8'; g.fillRect(c + 8, Y(1.56), 6, 2);                                             // name tag
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-8, Y(1.6), W + 16, 1);                                    // yoke seam
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-8, Y(2.2), W + 16, Y(2.1) - Y(2.2));                       // crown under the cap
    g.fillStyle = HAIR; g.fillRect(-8, Y(2.1), W + 16, Y(1.98) - Y(2.1)); g.fillStyle = SKIN; g.fillRect(c - 12, Y(2.1), 24, Y(1.98) - Y(2.1)); // short back and sides, face clear
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(-8, Y(1.73), W + 16, Y(1.67) - Y(1.73));                   // shadow under the jaw
  });
  const T = bi(torsoB), HD = bi(headB), HP = HEAD_PTS, w = W0;
  const rings = [
    { y: 0.8, rx: 0.2 * w, rz: 0.16, b0: T }, { y: 0.98, rx: 0.3 * w, rz: 0.21 * w, b0: T }, { y: 1.1, rx: 0.31 * w, rz: 0.22 * w, b0: T },     // hips, belt
    { y: 1.3, rx: 0.33 * w, rz: 0.24 * w, dz: 0.01, b0: T }, { y: 1.5, rx: 0.37 * w, rz: 0.24, b0: T }, { y: 1.6, rx: 0.39 * w, rz: 0.24, b0: T }, { y: 1.67, rx: 0.27, rz: 0.19, b0: T },
    { y: 1.71, rx: 0.13, rz: 0.115, b0: T, b1: HD, w: 0.7 }, { y: 1.77, rx: 0.125, rz: 0.11, b0: HD },
    { y: 1.83, rx: 0.19, rz: 0.17, b0: HD, pts: HP }, { y: 1.91, rx: 0.235, rz: 0.21, b0: HD, pts: HP }, { y: 2.1, rx: 0.235, rz: 0.21, b0: HD, pts: HP },
    { y: 2.17, rx: 0.19, rz: 0.17, b0: HD, pts: HP }, { y: 2.2, rx: 0, rz: 0, b0: HD },
  ];
  const bodyMesh = new THREE.SkinnedMesh(loftGeo(rings, 8, vOf), lambert({ map: bodyT }));
  bodyMesh.add(torsoB); torsoB.updateMatrixWorld(true); bodyMesh.bind(skel); bodyMesh.frustumCulled = false; body.add(bodyMesh);
  // ---- arms: long navy sleeve, gold shoulder patch, fist ----
  const armT = cachedTex('arm' + si, 32, 64, (g) => {
    g.fillStyle = NAVY; g.fillRect(0, 0, 32, 64); g.fillStyle = SKIN; g.fillRect(0, 0, 32, 17);
    facetBands(g, 32, 64, 6);
    g.fillStyle = NAVYD; g.fillRect(0, 17, 32, 3);                                                          // cuff
    g.fillStyle = GOLD; g.fillRect(10, 50, 12, 9); g.fillStyle = NAVYD; g.fillRect(12, 52, 8, 5); g.fillStyle = GOLD; g.fillRect(15, 53, 2, 3); // shoulder patch
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(8, 26, 1, 20); g.fillRect(22, 30, 1, 16);
    g.fillStyle = SKIND; for (const x of [11, 15, 19, 23]) g.fillRect(x, 1, 1, 8); g.fillRect(9, 9, 16, 1); g.fillRect(6, 6, 3, 6);
  });
  const legT = cachedTex('leg', 32, 64, (g) => {
    g.fillStyle = PANTS; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#121212'; g.fillRect(0, 0, 32, 14); g.fillStyle = '#050505'; g.fillRect(0, 0, 32, 4);
    facetBands(g, 32, 64, 6);
    g.fillStyle = GOLD; g.fillRect(4, 16, 2, 48); g.fillRect(26, 16, 2, 48);                               // gold side stripes
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(12, 9, 8, 1);                                       // shoe shine
  });
  for (const [k, s] of [[0, -1], [1, 1]]) {
    const U = bi(armU[k]), L = bi(armL[k]), sx = s * 0.37 * W0, sy = 1.56;
    const r = (t, rx, rz, b0, b1, ww) => ({ y: sy - t, rx, rz, dx: sx, b0, b1, w: ww });
    const ar = [r(-0.03, 0, 0, U), r(-0.01, 0.11, 0.11, U), r(0.06, 0.13, 0.125, U), r(0.24, 0.11, 0.105, U), r(0.28, 0.105, 0.1, U, L, 0.6), r(0.32, 0.1, 0.1, L, U, 0.6),
      r(0.52, 0.09, 0.085, L), r(0.56, 0.095, 0.09, L), r(0.57, 0.08, 0.06, L), r(0.6, 0.125, 0.075, L), r(0.72, 0.13, 0.08, L), r(0.82, 0.11, 0.06, L), r(0.84, 0, 0, L)];
    const vA = (rg) => 1 - (sy - rg.y + 0.03) / 0.87;
    const am = new THREE.SkinnedMesh(loftGeo(ar, 6, vA), lambert({ map: armT })); am.bind(skel); am.frustumCulled = false; body.add(am);
  }
  const legLen = stout ? 0.84 : 0.88;
  for (const [k, s] of [[0, -1], [1, 1]]) {
    const U = bi(legU[k]), L = bi(legL[k]), sx = s * 0.15, sy = 0.86, q = legLen / 0.82;
    const r = (t, rx, rz, b0, b1, ww, dz = 0) => ({ y: sy - t * q, rx, rz, dx: sx, dz, b0, b1, w: ww });
    const lr = [r(-0.06, 0.12, 0.12, U), r(0.1, 0.115, 0.11, U), r(0.36, 0.1, 0.1, U, L, 0.6), r(0.44, 0.095, 0.095, L, U, 0.6), r(0.66, 0.09, 0.09, L), r(0.72, 0.085, 0.085, L),
      r(0.72, 0.12, 0.18, L, L, 1, 0.07), r(0.78, 0.125, 0.22, L, L, 1, 0.1), r(0.82, 0.12, 0.21, L, L, 1, 0.1), r(0.82, 0, 0, L, L, 1, 0.1)];
    const vL = (rg) => 1 - (sy - rg.y + 0.06 * q) / (0.9 * q);
    const lm = new THREE.SkinnedMesh(loftGeo(lr, 6, vL), lambert({ map: legT })); lm.bind(skel); lm.frustumCulled = false; body.add(lm);
  }
  // ---- peaked police cap: angular crown, gold band, black visor, badge ----
  const cap = new THREE.Group(); cap.position.set(0, 0.45, 0.0); cap.rotation.x = 0.06; headB.add(cap);
  mesh(new THREE.CylinderGeometry(0.25, 0.235, 0.12, 8), fm(0x1e2846), 0, 0.06, 0, cap);
  mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.08, 8), fm(0x24325a), 0, 0.16, -0.02, cap).scale.z = 1.08;
  mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.035, 8), fm(0xe0b440), 0, 0.03, 0, cap);
  const visor = mesh(block(0.34, 0.025, 0.16, 0.9, 0.7), fm(0x0c0c10), 0, 0.0, 0.24, cap); visor.rotation.x = 0.25;
  mesh(block(0.06, 0.07, 0.02, 0.6, 1), fm(0xe0b440), 0, 0.12, 0.27, cap);
  // ears
  const skinM = lambert({ color: SKIN });
  for (const s of [-1, 1]) mesh(block(0.035, 0.08, 0.06), skinM, s * 0.245, 0.25, 0, headB);
  // ---- face plane: 2x2 expression grid. 0 calm (shades), 1 shouting (shades), 2 dazed (no shades), 3 surprised (shades slipped) ----
  const faceT = cachedTex('face' + v + si + hi, 64, 64, (g) => {
    const cell = (cx, cy, kind) => {
      g.save(); g.translate(cx * 32, cy * 32); g.fillStyle = SKIN; g.fillRect(0, 0, 32, 32);
      const shades = kind !== 'dazed';
      g.fillStyle = HAIR; g.fillRect(3, kind === 'surprised' ? 6 : 10, 10, 2); g.fillRect(19, kind === 'surprised' ? 6 : 10, 10, 2);   // brows
      if (kind === 'shout') { g.fillRect(4, 11, 9, 1); g.fillRect(19, 11, 9, 1); }
      if (kind === 'dazed') { g.fillStyle = '#2a1a10'; for (const ex of [8, 24]) { g.fillRect(ex - 3, 13, 1, 1); g.fillRect(ex + 2, 13, 1, 1); g.fillRect(ex - 2, 14, 1, 1); g.fillRect(ex + 1, 14, 1, 1); g.fillRect(ex - 1, 15, 2, 1); g.fillRect(ex - 2, 16, 1, 1); g.fillRect(ex + 1, 16, 1, 1); g.fillRect(ex - 3, 17, 1, 1); g.fillRect(ex + 2, 17, 1, 1); } }
      else if (kind === 'surprised') {
        g.fillStyle = '#f8f4ee'; for (const ex of [8, 24]) g.fillRect(ex - 3, 10, 6, 5); g.fillStyle = '#2a1a10'; for (const ex of [8, 24]) g.fillRect(ex - 1, 11, 2, 3);
        g.fillStyle = '#111'; g.fillRect(2, 16, 12, 4); g.fillRect(18, 16, 12, 4); g.fillRect(14, 16, 4, 1);   // shades slid down the nose
      }
      if (shades && kind !== 'surprised') {
        g.fillStyle = '#0e0e12'; g.fillRect(2, 12, 12, 6); g.fillRect(18, 12, 12, 6); g.fillRect(14, 13, 4, 1);
        g.fillStyle = 'rgba(160,200,255,0.55)'; g.fillRect(4, 13, 4, 1); g.fillRect(20, 13, 4, 1);           // lens glint
      }
      g.fillStyle = SKIND; g.fillRect(15, 18, 2, 4); g.fillRect(14, 22, 4, 1);                                // nose
      if (stout) { g.fillStyle = HAIR; g.beginPath(); g.moveTo(16, 23); g.lineTo(6, 25); g.lineTo(7, 28); g.lineTo(16, 26); g.lineTo(25, 28); g.lineTo(26, 25); g.fill(); }
      g.fillStyle = '#5a2a20';
      if (kind === 'shout' || kind === 'surprised') { g.fillRect(12, 26, 8, 4); g.fillStyle = '#f0e8e0'; g.fillRect(13, 26, 6, 1); }
      else if (kind === 'dazed') { g.fillRect(12, 27, 8, 1); g.fillRect(19, 26, 2, 1); }
      else g.fillRect(12, 27, 8, 1);
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 30, 32, 2);
      g.restore();
    };
    cell(0, 0, 'calm'); cell(1, 0, 'shout'); cell(0, 1, 'dazed'); cell(1, 1, 'surprised');
  }).clone(); // own offset per officer (setFace), shared canvas
  faceT.repeat.set(0.5, 0.5);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.255, 0.23), lambert({ map: faceT })); face.position.set(0, 1.99 - 1.72, 0.21 * 0.75 + 0.003); headB.add(face);
  const setFace = (i) => { faceT.offset.set((i % 2) * 0.5, i < 2 ? 0.5 : 0); }; setFace(0);
  // ---- thumbs ----
  for (const [k, s] of [[0, -1], [1, 1]]) mesh(block(0.045, 0.1, 0.055, 0.6, 0.6), skinM, -s * 0.115, -0.34, 0.01, armL[k]).rotation.z = s * 0.35;
  // ---- service pistol in the right fist (hidden until drawn); barrel along the forearm (-y), grip hangs toward -z ----
  const gun = new THREE.Group(); gun.position.set(0, -0.46, 0.0); armL[1].add(gun);
  mesh(new THREE.BoxGeometry(0.06, 0.26, 0.09), fm(0x1a1a1e), 0, -0.1, 0.02, gun);
  mesh(new THREE.BoxGeometry(0.055, 0.07, 0.15), fm(0x2a2a2e), 0, 0.02, -0.08, gun).rotation.x = 0.2;
  gun.visible = false;
  // holster on the right hip
  mesh(block(0.09, 0.2, 0.12, 0.9, 0.9), fm(0x101010), 0.34 * W0, 1.0, 0.02, torsoB);
  addShadow(root, 1, 1);
  for (const sh of armU) sh.rotation.z = (armU.indexOf(sh) ? 1 : -1) * 0.2;
  const sc = stout ? 0.84 : 0.86;
  root.scale.setScalar(sc);
  root.userData = { body, torso: torsoB, legs: legU, legsL: legL, arms: armU, armsL: armL, head: headB, scale: sc, seed: Math.random() * 10, lookFwd: true, setFace, gun, stout };
  return root;
}

/** Small pistol for the cat's paw (cat scale). Barrel along -y so it points forward when the arm is raised. */
export function makePawGun() {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.022, 0.1, 0.034), fm(0x1a1a1e), 0, -0.04, 0.0, g);
  mesh(new THREE.BoxGeometry(0.02, 0.03, 0.055), fm(0x2a2a2e), 0, 0.01, -0.03, g);
  return g;
}

/** Handcuffs: two small rings joined by a chain, sized for the cat's wrists. */
export function makeCuffs(r = 0.028) {
  const g = new THREE.Group(), m = fm(0xc8ccd4);
  for (const s of [-1, 1]) { const t = mesh(new THREE.TorusGeometry(r, r * 0.28, 4, 8), m, s * r * 1.6, 0, 0, g); t.rotation.y = Math.PI / 2; }
  mesh(new THREE.BoxGeometry(r * 1.4, r * 0.25, r * 0.25), m, 0, 0, 0, g);
  return g;
}
