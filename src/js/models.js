// Models built from primitives at PS2-era density: the tactical cat, painted-face people, raccoons, vehicles.
import * as THREE from 'three';
import { mat, lambert, phong, basic, faceTex } from './gfx.js';
import { TUBE_FACE_PNG } from './tubeface.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let T = null;
export function setTextures(t) { T = t; }

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const cap = (r, l, s = 10) => new THREE.CapsuleGeometry(r, l, 4, s);

// shared geometry cache: people, raccoons and shadows are built from the same few primitives, so key them by their dimensions
const geoCache = new Map();
const cg = (k, make) => { if (!geoCache.has(k)) geoCache.set(k, make()); return geoCache.get(k); };
const cbox = (...a) => cg('b' + a, () => box(...a)), csph = (...a) => cg('s' + a, () => sph(...a)), ccyl = (...a) => cg('c' + a, () => cyl(...a)), ccap = (...a) => cg('p' + a, () => cap(...a));

function m(geo, material, x = 0, y = 0, z = 0, parent = null) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}
function pivot(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}
let shadowMat = null;
export function addShadow(root, w, d) {
  shadowMat ||= basic({ map: T.shadow, transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -4 });
  const g = cg('shadow' + w + ',' + d, () => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2));
  const s = new THREE.Mesh(g, shadowMat); s.position.y = 0.03; s.renderOrder = 1;
  root.add(s);
  return s;
}

// ---------------- the cat (late-90s PS1 action-adventure look) ----------------
// Chunky low-poly shapes, Gouraud-lit flat colours, oversized head and paws, and a hand-painted
// face texture (big glossy anime eyes) instead of modelled features. Small, point-filtered textures.
const toonCache = new Map();
function pmat(color, o = {}) {
  const k = color + '|' + JSON.stringify(o) + (o.map ? o.map.uuid : '');
  if (!toonCache.has(k)) {
    const { flat, glow, ...rest } = o;
    toonCache.set(k, glow
      ? basic({ color, ...rest })
      : lambert({ color, flatShading: !!flat, emissive: new THREE.Color(color).multiplyScalar(0.16), ...rest }));
  }
  return toonCache.get(k);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}
// box whose top face is scaled (tx, tz) and shifted forward by off: cheap tapered "PS1 block"
function block(w, h, d, tx = 1, tz = 1, off = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * tx); p.setZ(i, p.getZ(i) * tz + off); }
  g.computeVertexNormals();
  return g;
}
let catFaceT = null, catCamoT = null;
function catFace() {
  // Goobles: tired, gruff, overworked. Half-lidded indifferent eyes with bags, level brows, frown, stubble.
  return catFaceT ||= canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128); g.scale(2, 2);
    const INK = '#231c1c';
    // under-eye bags
    g.strokeStyle = 'rgba(110,96,110,0.3)'; g.lineWidth = 1;
    for (const s of [-1, 1]) for (const k of [0]) { g.beginPath(); g.ellipse(32 + s * 12, 33 + k, 6.5 - k, 2.2, 0, 0.15, Math.PI - 0.15); g.stroke(); }
    for (const s of [-1, 1]) {
      const x = 32 + s * 12, y = 29;
      g.fillStyle = INK; g.beginPath(); g.ellipse(x, y, 7.6, 6.4, 0, 0, 7); g.fill();                     // outline
      g.fillStyle = '#efe9c8'; g.beginPath(); g.ellipse(x, y, 6.4, 5.2, 0, 0, 7); g.fill();               // yellowed sclera
      g.fillStyle = '#b9c43a'; g.beginPath(); g.arc(x, y + 1, 4.2, 0, 7); g.fill();              // iris
      g.fillStyle = '#7f8a1e'; g.beginPath(); g.arc(x, y + 2, 4.2, 0.2, Math.PI - 0.2); g.fill();
      g.fillStyle = '#100c0c'; g.beginPath(); g.ellipse(x, y + 1, 1.2, 3.6, 0, 0, 7); g.fill();  // slit pupil
      g.fillStyle = '#ffffff'; g.fillRect(x + 1, y + 1.5, 1.5, 1.5);                            // small dull shine
      // heavy upper lid: fur-coloured band covering the top half, dead level for a bored, indifferent stare
      g.save(); g.beginPath(); g.ellipse(x, y, 7.6, 6.4, 0, 0, 7); g.clip();       // lid stays inside the eye outline
      g.fillStyle = '#dcd4cc'; g.fillRect(x - 9, y - 10, 18, 7.2);
      g.restore();
      g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath();
      g.moveTo(x - 6.6, y - 2.6); g.lineTo(x + 6.6, y - 2.6); g.stroke();              // lid line
      // thin level brow
      g.fillStyle = '#4a3f3f'; g.beginPath();
      g.moveTo(x - 6.5, y - 9.5); g.lineTo(x + 6.5, y - 9.5); g.lineTo(x + 6.5, y - 8.2); g.lineTo(x - 6.5, y - 8.2); g.fill();
      // whiskers, one side bent
      g.strokeStyle = '#4a4048'; g.lineWidth = 0.9;
      for (let k = 0; k < 3; k++) {
        g.beginPath(); g.moveTo(32 + s * 9, 44 + k * 2);
        if (s > 0 && k === 0) { g.lineTo(32 + 20, 42); g.lineTo(32 + 27, 46); } else g.lineTo(32 + s * 30, 42 + k * 4);
        g.stroke();
      }
    }
    // muzzle stubble
    g.fillStyle = 'rgba(90,80,80,0.55)';
    for (let i = 0; i < 26; i++) { const a = i * 2.39996, r = 3 + (i % 5) * 1.6; g.fillRect(32 + Math.cos(a) * r * 1.4 - 0.4, 47 + Math.sin(a) * r * 0.55, 0.8, 0.8); }
    // nose and frown
    g.fillStyle = '#c96a7c'; g.beginPath(); g.moveTo(28.5, 39.5); g.lineTo(35.5, 39.5); g.lineTo(32, 44); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(30, 40, 2, 1);
    g.strokeStyle = INK; g.lineWidth = 1.3; g.beginPath();
    g.moveTo(32, 44); g.lineTo(32, 46.5);
    g.moveTo(27.5, 48.5); g.quadraticCurveTo(32, 47.2, 36.5, 48.5); g.stroke();                          // flat, unbothered mouth
  });
}
function catCamo() {
  return catCamoT ||= canvasTex(32, 32, (g) => {
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#c9b07a'; g.fillRect(0, 0, 32, 32);
    for (const [c, n, sz] of [['#8f9a52', 9, 6], ['#9b7448', 7, 5], ['#5f6b34', 6, 4], ['#efe0b0', 5, 2.5], ['#4a3a26', 5, 2]]) {
      g.fillStyle = c;
      for (let i = 0; i < n; i++) {
        const x = r() * 32, y = r() * 32, a = sz * (0.6 + r()), b = sz * (0.4 + r() * 0.6);
        for (const dx of [-32, 0, 32]) for (const dy of [-32, 0, 32]) { g.beginPath(); g.ellipse(x + dx, y + dy, a, b, r() * 3, 0, 7); g.fill(); }
      }
    }
  });
}

// sphere with soft tufted silhouette: radial jitter hashed by vertex position, so seams stay closed
function fluffGeo(r, amp = 0.12, ws = 18, hs = 14, seed = 1) {
  const g = new THREE.SphereGeometry(r, ws, hs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(Math.round(x * 997) * 12.9898 + Math.round(y * 997) * 78.233 + Math.round(z * 997) * 37.719 + seed) * 43758.5453;
    const k = 1 + amp * ((h - Math.floor(h)) - 0.35);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}
// cat skull: wider than tall, flat crown, full cheeks, small muzzle bump. Applied to the skull and the face decal alike.
function catHeadGeo(g) {
  const p = g.attributes.position, v = new THREE.Vector3();
  const r0 = Math.hypot(p.getX(0), p.getY(0), p.getZ(0)) || 1;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = v.length(); const nx = v.x / r, ny = v.y / r, nz = v.z / r;
    let x = nx, y = ny * 0.86, z = nz;
    if (y > 0.45) y = 0.45 + (y - 0.45) * 0.55;                                   // flat crown
    x *= 1.12 + 0.2 * sm(0.35, -0.35, ny) - 0.22 * sm(-0.55, -0.95, ny);           // full cheeks, narrower chin
    if (z > 0) z *= 0.9;                                                            // flatter face
    const dx = nx, dy = ny + 0.38, dz = nz - 0.92;                                  // muzzle bump, front and low
    const bump = 0.13 * Math.exp(-(dx * dx * 2.2 + dy * dy * 3 + dz * dz) / 0.09);
    p.setXYZ(i, (x + nx * bump) * r, (y + ny * bump) * r, (z + nz * bump + bump * 0.4) * r);
  }
  g.computeVertexNormals();
  void r0;
  return g;
}
// Goobles' eyes: glowing yellow almonds with a crescent pupil, top lid flat for a bored, indifferent stare.
let gooblesEyesT = null;
function gooblesEyes() {
  return gooblesEyesT ||= (() => {
    const t = canvasTex(128, 128, (g) => {
      g.clearRect(0, 0, 128, 128); g.scale(2, 2);
      for (const s of [-1, 1]) {
        const x = 32 + s * 13, y = 32, lid = y - 3.8;                              // everything above the lid stays transparent (fur shows)
        const almond = () => { g.beginPath(); g.moveTo(x - 9, y); g.quadraticCurveTo(x, y - 10, x + 9, y); g.quadraticCurveTo(x, y + 9, x - 9, y); g.closePath(); };
        g.save(); g.beginPath(); g.rect(x - 11, lid, 22, 20); g.clip();
        almond(); g.fillStyle = '#18161c'; g.fill();                                   // dark rim
        g.save(); g.translate(x, y); g.scale(0.84, 0.8); g.translate(-x, -y); almond(); g.clip();
        const gr = g.createLinearGradient(0, y - 8, 0, y + 8); gr.addColorStop(0, '#fff27a'); gr.addColorStop(1, '#e0b818');
        g.fillStyle = gr; g.fillRect(x - 10, y - 10, 20, 20);
        g.fillStyle = '#0a0a0c'; g.beginPath(); g.ellipse(x, y + 0.5, 2.4, 6.5, 0, 0, 7); g.fill();     // centred slit pupil
        g.restore();
        g.restore();
        g.fillStyle = '#18161c'; g.fillRect(x - 8.2, lid - 0.6, 16.4, 1.6);           // flat heavy lid line
      }
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  })();
}

export function makeCat() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const fur = pmat(0xf4f4f6, { flat: true }), shirt = pmat(0xf4f4f6, { flat: true }); // all white

  // long legs, small blocky feet
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.042, 0.27, 0);
    m(cyl(0.032, 0.036, 0.25, 6), fur, 0, -0.125, 0, hip);
    m(block(0.07, 0.04, 0.09, 0.85, 0.8), fur, 0, -0.25, 0.015, hip);
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0, 0);
  m(cyl(0.062, 0.08, 0.22, 6), fur, 0, 0.36, 0, torso);                              // short, slightly flared body
  m(cyl(0.064, 0.064, 0.05, 6), shirt, 0, 0.455, 0, torso);                          // shirt under the dark front
  m(block(0.09, 0.15, 0.03, 0.75, 1), fur, 0, 0.38, 0.055, torso);                    // dark vest front
  for (const s of [-1, 1]) {                                                          // white collar points
    const c = m(new THREE.ConeGeometry(0.018, 0.07, 3), shirt, s * 0.022, 0.44, 0.072, torso);
    c.rotation.set(0.15, 0, Math.PI + s * 0.15);
  }
  // white shirt sleeves, black mitten paws, held a little out from the body
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.07, 0.45, 0);
    m(cyl(0.03, 0.036, 0.15, 6), shirt, 0, -0.075, 0, sh);
    m(block(0.055, 0.05, 0.065, 0.9, 0.9), fur, 0, -0.17, 0.008, sh);
    sh.rotation.z = s * 0.42;
    arms.push(sh);
  }
  // thin tail
  const tail = pivot(torso, 0, 0.27, -0.07);
  let seg = tail; const tailSegs = [];
  for (let i = 0; i < 5; i++) {
    const p = pivot(seg, 0, 0, i ? 0.075 : 0);
    m(cyl(0.013 - i * 0.0015, 0.016 - i * 0.0015, 0.08, 5), fur, 0, 0, 0.04, p).rotation.x = Math.PI / 2;
    p.rotation.x = i === 0 ? 0.9 : -0.25;
    seg = p; tailSegs.push(p);
  }
  tail.rotation.y = Math.PI;

  // head: low-poly faceted cat skull, tall sharp ears, glowing eyes projected flat onto the front
  const head = pivot(torso, 0, 0.455, 0.01);
  const R = 0.175, hy = 0.15;
  const skullG = catHeadGeo(new THREE.SphereGeometry(R, 9, 7));
  const HS = [0.9, 1.22, 0.95];                                                       // taller, shield-shaped head
  m(skullG, fur, 0, hy, 0, head).scale.set(...HS);
  const eyeG = skullG.clone(); eyeG.scale(1.012, 1.012, 1.012);
  { // planar front projection for the eye decal, keeping only front-facing triangles so nothing smears round the sides
    const p = eyeG.attributes.position, uv = eyeG.attributes.uv, idx = eyeG.index.array, keep = [];
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (R * 2.3), 0.5 + p.getY(i) / (R * 2.3));
    for (let i = 0; i < idx.length; i += 3) if ([0, 1, 2].every((k) => p.getZ(idx[i + k]) > R * 0.2)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    eyeG.setIndex(keep);
  }
  const eyes = m(eyeG, lambert({ map: gooblesEyes(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, emissive: 0xffffff, emissiveMap: gooblesEyes(), emissiveIntensity: 0.9, flatShading: true }), 0, hy, 0, head);
  eyes.renderOrder = 2; eyes.scale.set(...HS);
  for (const s of [-1, 1]) {                                                         // tall pointed ears; his right one is chewed short
    const torn = s < 0;
    const e = m(new THREE.ConeGeometry(0.075, torn ? 0.15 : 0.21, 4), fur, s * 0.11, hy + (torn ? 0.17 : 0.2), -0.01, head);
    e.rotation.set(-0.05, Math.PI / 4, -s * (torn ? 0.5 : 0.32)); e.scale.z = 0.55;
  }
  addShadow(root, 0.5, 0.5);
  root.userData = { body, torso, legs, arms, head, tail, tailSegs, lookFwd: true };
  return root;
}

/** Shared walk / idle animation for bipeds. ph = phase (rad), amt = 0..1 stride. */
export function animBiped(o, ph, amt, t, punch = 0) {
  const u = o.userData;
  const sw = Math.sin(ph) * 0.8 * amt;
  u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
  u.arms[0].rotation.x = -sw * 0.8; u.arms[1].rotation.x = sw * 0.8;
  if (punch > 0) { u.arms[1].rotation.x = -1.6 * punch; }
  u.body.position.y = Math.abs(Math.cos(ph)) * 0.03 * amt * (u.scale || 1);
  if (u.torso && u.torso !== u.body) u.torso.rotation.y = Math.sin(ph) * 0.06 * amt;
  if (u.head && !amt && !u.lookFwd) u.head.rotation.y = Math.sin(t * 0.7 + (u.seed || 0)) * 0.25;
  if (u.tailSegs) {
    u.tailSegs[1].rotation.y = Math.sin(t * 2.2) * 0.25 + sw * 0.2;
    u.tailSegs[2].rotation.y = Math.sin(t * 2.2 - 0.8) * 0.3;
    u.tailSegs[3].rotation.y = Math.sin(t * 2.2 - 1.6) * 0.3;
  }
}

// ---------------- people ----------------
const SKIN = [0xf1c9a5, 0xd9a47a, 0xa86f48, 0x7a4b2e, 0xe8b894, 0xc68e64];
const SHIRT = [0xa8332b, 0x2e6fa1, 0x2f8a52, 0xd8b030, 0x6e3c8d, 0xd06e22, 0xe4e6e8, 0x34495e, 0xe87aa6, 0x4a4a4a];
const PANTS = [0x2c3e50, 0x34495e, 0x7f6a4f, 0x1c2833, 0x566573, 0x3a5a8a];
const HAIR = [0x2b1d0e, 0x5a3a1a, 0xc9a25a, 0x111111, 0x7a3b13, 0xaaaaaa];
const pick = (a) => a[(Math.random() * a.length) | 0];
const faceCache = new Map();

// Rig parts are merged: every piece under one pivot goes into a single mesh with geometry groups (one per material),
// and the merged geometry is cached by the pieces' dimensions and transforms, so all peds share buffers and a
// human is 7 draws (2 legs, torso, 2 arms, head, shadow) instead of ~25. A piece is [geoKey, make, material, x, y, z, rot, scale].
const partCache = new Map();
const PB = (...a) => ['b' + a, () => box(...a)], PS = (...a) => ['s' + a, () => sph(...a)], PC = (...a) => ['c' + a, () => cyl(...a)], PK = (...a) => ['p' + a, () => cap(...a)];
function mergedPart(parent, pieces) {
  const mats = [];
  const key = pieces.map(([k, , mt, x = 0, y = 0, z = 0, r, s]) => { let i = mats.indexOf(mt); if (i < 0) { i = mats.length; mats.push(mt); } return k + ',' + x + ',' + y + ',' + z + ',' + (r || '') + ',' + (s || '') + ':' + i; }).join('|');
  if (!partCache.has(key)) {
    const bySlot = mats.map(() => []);
    for (const [, mk, mt, x = 0, y = 0, z = 0, r, s] of pieces) {
      const g = mk(); if (s) g.scale(s[0], s[1], s[2]); if (r) { g.rotateX(r[0]); g.rotateY(r[1]); g.rotateZ(r[2]); } g.translate(x, y, z);
      bySlot[mats.indexOf(mt)].push(g.index ? g.toNonIndexed() : g);
    }
    partCache.set(key, mergeGeometries(bySlot.map((l) => mergeGeometries(l, false)), true));
  }
  return m(partCache.get(key), mats.length > 1 ? mats : mats[0], 0, 0, 0, parent);
}

export function makeHuman(o = {}) {
  const sc = o.scale || 1;
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const skinC = o.skin ?? pick(SKIN), hairC = o.hair ?? pick(HAIR);
  const skin = mat(skinC), shirt = mat(o.shirt ?? pick(SHIRT), T.cloth), pants = mat(o.pants ?? pick(PANTS), T.cloth);
  const hair = mat(hairC), shoe = mat(o.shoe ?? pick([0x222222, 0x5a3a22, 0xe8e8e8]), null, 0, 40);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.1, 0.9, 0);
    mergedPart(hip, [[...PK(0.085, 0.38), pants, 0, -0.24, 0], [...PK(0.07, 0.36), pants, 0, -0.62, 0], [...PK(0.06, 0.14, 8), shoe, 0, -0.86, 0.05, [Math.PI / 2, 0, 0], [1.15, 1, 0.8]]]);
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0, 0);
  const tp = [[...PC(0.21, 0.17, 0.62, 14), shirt, 0, 1.2, 0, null, [1, 1, 0.62]], [...PS(0.21, 14, 8), shirt, 0, 1.44, 0, null, [1.05, 0.38, 0.62]],
    [...PC(0.175, 0.17, 0.12, 14), pants, 0, 0.93, 0, null, [1, 1, 0.66]], [...PC(0.18, 0.18, 0.04, 14), mat(0x2a2018), 0, 0.97, 0, null, [1, 1, 0.66]]];
  if (o.cardigan) tp.push([...PC(0.225, 0.2, 0.56, 14), mat(o.cardigan, T.cloth), 0, 1.22, -0.005, null, [1, 1, 0.64]]);
  tp.push([...PC(0.06, 0.07, 0.1, 10), skin, 0, 1.53, 0]);
  mergedPart(torso, tp);
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.25, 1.43, 0);
    const ap = [[...PK(0.065, 0.2), o.cardigan ? mat(o.cardigan, T.cloth) : shirt, 0, -0.14, 0], [...PK(0.05, 0.2), o.longSleeve || o.cardigan ? mat(o.cardigan || o.shirt, T.cloth) : skin, 0, -0.42, 0],
      [...PS(0.055, 8, 6), skin, 0, -0.6, 0.01, null, [0.8, 1.1, 0.9]]];
    if (o.clipboard && s < 0) ap.push([...PB(0.2, 0.27, 0.015), mat(0x9a7b4f), 0, -0.5, 0.12, [-0.4, 0, 0]], [...PB(0.17, 0.22, 0.004), mat(0xf4f4f4), 0, -0.49, 0.13, [-0.4, 0, 0]]);
    if (o.watergun && s > 0) ap.push([...PB(0.06, 0.11, 0.3), mat(0x22c3ff, null, 0, 60), 0, -0.62, 0.12], [...PC(0.05, 0.05, 0.1, 10), mat(0xff9a20, null, 0, 60), 0, -0.53, 0.06]);
    mergedPart(sh, ap);
    sh.rotation.z = s * 0.08;
    arms.push(sh);
  }
  const head = pivot(torso, 0, 1.58, 0);
  const fk = [skinC, hairC, o.glasses, o.wrinkles, o.angry, o.smile, o.bald].join();
  if (!faceCache.has(fk)) faceCache.set(fk, mat(0xffffff, faceTex(skinC, hairC, { glasses: o.glasses, wrinkles: o.wrinkles, angry: o.angry, smile: o.smile ?? Math.random() < 0.4, bald: o.bald })));
  const hp = [[...PS(0.13, 16, 12), faceCache.get(fk), 0, 0.13, 0, null, [0.92, 1.12, 1.0]], [...PS(0.024, 6, 4), skin, 0, 0.12, 0.13, null, [0.8, 1.2, 1]]]; // face, nose
  for (const s of [-1, 1]) hp.push([...PS(0.03, 6, 4), skin, s * 0.12, 0.12, 0, null, [0.5, 1, 0.7]]);
  if (!o.bald) hp.push(['hair', () => new THREE.SphereGeometry(0.138, 16, 6, 0, Math.PI * 2, 0, 1.05), hair, 0, 0.14, -0.01, null, [0.95, 1.12, 1.03]]);
  if (o.bun) hp.push([...PS(0.07), hair, 0, 0.3, -0.08]);
  if (o.visor) hp.push([...PC(0.135, 0.135, 0.05, 16), mat(o.visor), 0, 0.24, 0], [...PC(0.12, 0.12, 0.015, 16), mat(o.visor), 0, 0.22, 0.07, [0, -Math.PI / 2, 0]]);
  if (o.cap) hp.push(['cap', () => new THREE.SphereGeometry(0.142, 16, 6, 0, Math.PI * 2, 0, 1.2), mat(o.cap), 0, 0.16, -0.01], [...PB(0.2, 0.015, 0.13), mat(o.cap), 0, 0.2, -0.17]);
  mergedPart(head, hp);
  addShadow(root, 0.9, 0.9);
  root.scale.setScalar(sc);
  root.userData = { body, torso, legs, arms, head, scale: sc, seed: Math.random() * 10 };
  return root;
}

export function makeRaccoon() {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const grey = mat(0x9a9aa0, T.fur), dark = mat(0x2d2d32), light = mat(0xd8d8dc, T.fur);
  mergedPart(body, [[...PS(0.2), grey, 0, 0.3, 0, null, [0.9, 0.8, 1.4]]]);
  const head = pivot(body, 0, 0.38, 0.3);
  const hp = [[...PS(0.13), grey, 0, 0, 0, null, [1.1, 0.9, 1]], [...PS(0.1, 12, 6), dark, 0, 0.02, 0.06, null, [1.35, 0.42, 0.9]]];
  for (const s of [-1, 1]) hp.push([...PS(0.018, 6, 4), mat(0x111111, null, 0, 120), s * 0.05, 0.025, 0.145]);
  hp.push([...PS(0.06), light, 0, -0.03, 0.13, null, [1, 0.8, 1.2]], [...PS(0.02, 6, 4), mat(0x111111, null, 0, 80), 0, -0.01, 0.2]);
  for (const s of [-1, 1]) hp.push(['ear', () => new THREE.ConeGeometry(0.05, 0.08, 6), grey, s * 0.08, 0.12, 0]);
  mergedPart(head, hp);
  const legs = [], arms = [];
  for (const [x, z, arr] of [[-0.1, 0.18, arms], [0.1, 0.18, arms], [-0.1, -0.18, legs], [0.1, -0.18, legs]]) {
    const p = pivot(body, x, 0.22, z); m(ccap(0.04, 0.14, 6), dark, 0, -0.11, 0, p); arr.push(p);
  }
  const tail = pivot(body, 0, 0.35, -0.25); tail.rotation.x = -0.6;
  const tp = [];
  for (let i = 0; i < 6; i++) tp.push([...PC(0.065 - i * 0.004, 0.065 - i * 0.004, 0.075, 10), i % 2 ? dark : light, 0, 0, -0.04 - i * 0.07, [Math.PI / 2, 0, 0]]);
  mergedPart(tail, tp);
  addShadow(root, 0.7, 0.9);
  root.userData = { body, torso: body, legs, arms, head, scale: 0.5 };
  return root;
}

// ---------------- vehicles ----------------
export const CAR_TYPES = {
  sedan: { len: 4.4, wid: 1.85, h: 0.62, hood: 1.25, trunk: 0.95, ch: 0.58, rake: 0.6, rrake: 0.5, top: 30, acc: 11, grip: 6, mass: 1 },
  hatch: { len: 3.8, wid: 1.75, h: 0.64, hood: 0.95, trunk: 0.2, ch: 0.62, rake: 0.6, rrake: 0.25, top: 33, acc: 13, grip: 7, mass: 0.9 },
  wagon: { len: 4.8, wid: 1.9, h: 0.64, hood: 1.15, trunk: 0.15, ch: 0.62, rake: 0.55, rrake: 0.12, top: 27, acc: 9, grip: 6, mass: 1.1 },
  pickup: { len: 5.0, wid: 2.0, h: 0.82, hood: 1.35, trunk: 2.1, ch: 0.7, rake: 0.45, rrake: 0.06, top: 29, acc: 10, grip: 5.5, mass: 1.3, bed: true },
  suv: { len: 4.7, wid: 2.0, h: 0.86, hood: 1.0, trunk: 0.15, ch: 0.72, rake: 0.5, rrake: 0.1, top: 35, acc: 13, grip: 6.5, mass: 1.4 },
  golfcart: { len: 2.6, wid: 1.3, h: 0.5, top: 17, acc: 8, grip: 8, mass: 0.6, cart: true },
};

function extrudeProfile(pts, width, bevel = 0.05) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 - bevel, 0, 0);
  return g;
}

// One merged body geometry per CAR_TYPES entry (built once, shared by every car of that type): pieces are bucketed by
// material slot and merged with geometry groups, so a per-car material array [paint clone, shared dark, chrome, glass, ...]
// draws the whole body. Wheels share one geometry per radius with a single tyre-textured material.
const CAR_SLOTS = ['paint', 'dark', 'chrome', 'glass', 'hl', 'tl', 'grille', 'plate', 'seat', 'canopy'];
const bodyCache = new Map(), wheelCache = new Map(), labelGeoCache = new Map(), labelMatCache = new Map();
let carShared = null, barGeo = null;
function carMats() {
  return carShared ||= { dark: mat(0x1c1c20), chrome: mat(0xd0d0d4, null, 0, 120), glass: phong({ map: T.carWin, shininess: 140, specular: 0xffffff, color: 0xffffff }),
    hl: basic({ color: new THREE.Color(0xfff6d8).multiplyScalar(1.6) }), tl: basic({ color: new THREE.Color(0xd01818).multiplyScalar(1.3) }),
    grille: mat(0x121214, T.metal), plate: mat(0xf0f0e0), seat: mat(0x2a2a30, T.cloth), wheel: mat(0xffffff, T.tire) };
}
function carBody(type) {
  if (bodyCache.has(type)) return bodyCache.get(type);
  const S = CAR_TYPES[type], parts = CAR_SLOTS.map(() => []);
  const add = (slot, g, x = 0, y = 0, z = 0, rx = 0) => { if (rx) g.rotateX(rx); g.translate(x, y, z); parts[CAR_SLOTS.indexOf(slot)].push(g.index ? g.toNonIndexed() : g); };
  const base = 0.32;
  const L = S.len, hl = L / 2;
  let roofY = base + S.h, roofZ = 0;
  if (!S.cart) {
    const b = base, h = S.h;
    const lower = [[-hl, b + 0.12], [-hl + 0.02, b + h * 0.9], [-hl + 0.25, b + h], [hl - 0.4, b + h * 0.94], [hl - 0.05, b + h * 0.7], [hl, b + 0.14], [hl - 0.12, b], [-hl + 0.12, b]];
    add('paint', extrudeProfile(lower, S.wid, 0.07));
    const zr = -hl + S.trunk, zf = hl - S.hood, yb = b + h - 0.02, yt = b + h + S.ch;
    const gh = [[zr, yb], [zf, yb], [zf - S.rake, yt], [zr + S.rrake, yt]];
    add('glass', extrudeProfile(gh, S.wid - 0.14, 0.04));
    // roof and pillars
    const roof = [[zr + S.rrake - 0.02, yt - 0.03], [zf - S.rake + 0.02, yt - 0.03], [zf - S.rake - 0.02, yt + 0.04], [zr + S.rrake + 0.02, yt + 0.04]];
    add('paint', extrudeProfile(roof, S.wid - 0.1, 0.03));
    for (const s of [-1, 1]) add('paint', box(0.03, S.ch, 0.08), s * (S.wid / 2 - 0.06), yb + S.ch / 2, (zr + zf) / 2 + 0.1); // B pillar
    roofY = yt; roofZ = (zr + S.rrake + zf - S.rake) / 2;
    if (S.bed) {
      add('dark', box(S.wid - 0.24, 0.06, S.trunk - 0.25), 0, b + h + 0.0, -hl + S.trunk / 2 + 0.05);
      add('paint', box(S.wid - 0.1, 0.25, 0.08), 0, b + h + 0.12, -hl + 0.06);
      for (const s of [-1, 1]) add('paint', box(0.08, 0.25, S.trunk - 0.1), s * (S.wid / 2 - 0.07), b + h + 0.12, -hl + S.trunk / 2);
    }
    // mirrors, grille, plates
    for (const s of [-1, 1]) add('paint', box(0.14, 0.1, 0.06), s * (S.wid / 2 + 0.04), yb + 0.08, zf - 0.1);
    add('grille', box(S.wid * 0.5, 0.16, 0.03), 0, b + h * 0.55, hl + 0.005);
    add('plate', box(0.42, 0.11, 0.02), 0, b + 0.28, -hl - 0.01);
  } else {
    add('paint', box(S.wid, S.h, S.len), 0, base + S.h / 2, 0);
    for (const [x, z] of [[-0.55, 0.3], [0.55, 0.3], [-0.55, -0.9], [0.55, -0.9]]) add('chrome', cyl(0.025, 0.025, 1.1, 6), x, base + S.h + 0.55, z);
    add('canopy', box(1.3, 0.06, 1.5), 0, base + S.h + 1.12, -0.3);
    add('seat', box(1.1, 0.35, 0.4), 0, base + S.h + 0.17, -0.5);
    add('glass', box(1.0, 0.5, 0.02), 0, base + S.h + 0.6, 0.32, -0.15);
    roofY = base + S.h + 1.15; roofZ = -0.3;
  }
  // lights + bumpers
  const ly = base + S.h * 0.66;
  const glows = [];
  for (const s of [-1, 1]) {
    add('hl', box(0.34, 0.13, 0.04), s * (S.wid / 2 - 0.3), ly, hl + 0.01);
    add('tl', box(0.3, 0.12, 0.04), s * (S.wid / 2 - 0.28), ly, -hl - 0.01);
    glows.push({ x: s * (S.wid / 2 - 0.3), y: ly, z: hl + 0.15, c: 0xfff0c8, s: 1.6 });
    glows.push({ x: s * (S.wid / 2 - 0.28), y: ly, z: -hl - 0.12, c: 0xff2020, s: 0.9 });
  }
  add('chrome', box(S.wid + 0.06, 0.14, 0.16), 0, base + 0.1, hl);
  add('chrome', box(S.wid + 0.06, 0.14, 0.16), 0, base + 0.1, -hl);
  add('dark', box(S.wid - 0.1, 0.08, L - 0.5), 0, base + 0.02, 0);
  const slots = [], geos = [];
  parts.forEach((list, i) => { if (list.length) { slots.push(CAR_SLOTS[i]); geos.push(mergeGeometries(list, false)); } });
  const r = { geo: mergeGeometries(geos, true), slots, roofY, roofZ, glows };
  bodyCache.set(type, r);
  return r;
}
function wheelGeo(wr) {
  if (!wheelCache.has(wr)) {
    const g = new THREE.CylinderGeometry(wr, wr, 0.26, 16), uv = g.attributes.uv, idx = g.index.array, t = g.groups[0];
    for (let i = t.start; i < t.start + t.count; i++) uv.setXY(idx[i], 0, 0); // tread samples the tyre texture's rubber corner
    g.clearGroups(); g.rotateZ(Math.PI / 2);
    wheelCache.set(wr, g);
  }
  return wheelCache.get(wr);
}
function labelGeo(S) {
  if (!labelGeoCache.has(S)) {
    const list = [];
    for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(1.4, 0.35); g.rotateY(s * Math.PI / 2); g.translate(s * (S.wid / 2 + 0.015), 0.32 + S.h * 0.55, 0); list.push(g.toNonIndexed()); }
    labelGeoCache.set(S, mergeGeometries(list, false));
  }
  return labelGeoCache.get(S);
}

export function makeCar(type, color, o = {}) {
  const S = CAR_TYPES[type], M = carMats(), B = carBody(type);
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const paint = phong({ color, shininess: 90, specular: 0x9a9aa0 });
  m(B.geo, B.slots.map((s) => s === 'paint' ? paint : s === 'canopy' ? mat(o.canopy ?? 0xffffff, null, 0, 40) : M[s]), 0, 0, 0, body);
  let bar = null;
  if (o.lightbar) {
    if (!barGeo) { const a = box(0.45, 0.12, 0.25).toNonIndexed(), b = box(0.45, 0.12, 0.25).toNonIndexed(); a.translate(-0.25, 0, 0); b.translate(0.25, 0, 0); barGeo = mergeGeometries([a, b], true); }
    bar = [basic({ color: 0xff8a00 }), basic({ color: 0x3070ff })];
    m(barGeo, bar, 0, B.roofY + 0.08, B.roofZ, body);
  }
  if (o.label) {
    if (!labelMatCache.has(o.label)) labelMatCache.set(o.label, basic({ map: o.label }));
    m(labelGeo(S), labelMatCache.get(o.label), 0, 0, 0, body);
  }
  const wheels = [];
  const wr = type === 'golfcart' ? 0.25 : 0.36;
  const wg = wheelGeo(wr);
  const wz = S.len / 2 - (type === 'golfcart' ? 0.45 : 0.85);
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pv = pivot(root, x * (S.wid / 2 - 0.1), wr, z * wz);
    m(wg, M.wheel, 0, 0, 0, pv);
    wheels.push(pv);
  }
  addShadow(root, S.wid + 1.0, S.len + 1.0);
  // P14: the merged body, light bar, label and shadow never move relative to their pivot: freeze their local matrices
  // (the body pivot itself leans and the wheel pivots steer / spin, so those keep matrixAutoUpdate)
  for (const ch of body.children) { ch.updateMatrix(); ch.matrixAutoUpdate = false; }
  { const sh = root.children[root.children.length - 1]; sh.updateMatrix(); sh.matrixAutoUpdate = false; }
  root.userData = { body, wheels, bar, wr, spec: S, paint, glows: B.glows };
  return root;
}
export function makeRV() {
  const g = new THREE.Group();
  const white = mat(0xf1ede2, null, 0, 30), stripe = mat(0x9a5b2b), stripe2 = mat(0xd08a3a), dark = mat(0x222222);
  const win = phong({ map: T.carWin, shininess: 120, specular: 0xffffff });
  const bodyG = new THREE.BoxGeometry(2.5, 2.6, 8.5, 1, 1, 1);
  m(bodyG, white, 0, 1.75, 0, g);
  m(box(2.52, 0.25, 8.52), stripe, 0, 1.5, 0, g);
  m(box(2.52, 0.12, 8.52), stripe2, 0, 1.25, 0, g);
  m(box(2.4, 0.9, 1.4), white, 0, 3.0, 3.4, g);
  m(box(2.3, 0.7, 0.05), win, 0, 2.2, 4.26, g);
  for (const z of [-2.5, -0.5, 1.5]) m(box(0.05, 0.6, 1.0), win, 1.26, 2.3, z, g);
  for (const z of [-2.5, 1.5]) m(box(0.05, 0.56, 0.96), basic({ map: T.windowLit }), -1.26, 2.3, z, g);
  m(box(0.06, 1.9, 0.8), mat(0xcfc8b6), 1.27, 1.4, -1.8, g);
  m(box(1.2, 0.3, 0.8), mat(0x8a8a8a, T.metal), 0, 3.2, -1, g); // AC unit
  const wg = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16); wg.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1.15, 2.8], [1.15, 2.8], [-1.15, -2.6], [1.15, -2.6]]) m(wg, [dark, mat(0xffffff, T.tire), mat(0xffffff, T.tire)], x, 0.45, z, g);
  m(box(1.6, 0.06, 3.0), mat(0x2f8f6f, T.cloth), 2.05, 2.7, -0.5, g).rotation.z = -0.15;
  const chair = mat(0x3b7bd6, T.cloth);
  m(box(0.5, 0.05, 0.5), chair, 2.6, 0.45, 0.4, g);
  m(box(0.5, 0.55, 0.05), chair, 2.6, 0.7, 0.15, g);
  return g;
}

export function makeTrashBag() {
  const g = new THREE.Group();
  const bm = mat(0x23262b, null, 0, 90);
  const b = m(sph(0.3, 10, 8), bm, 0, 0.28, 0, g); b.scale.set(1, 0.9, 1);
  m(cyl(0.02, 0.1, 0.14, 8), bm, 0, 0.58, 0, g);
  m(box(0.12, 0.03, 0.03), mat(0xe8c040), 0, 0.64, 0, g);
  addShadow(g, 0.9, 0.9);
  return g;
}

// ---------------- the shadow man (haunted forest event) ----------------
// A tall figure that is pure black head to toe: long trench coat with popped collar and belt, fedora, no face.
// Same rig as makeHuman, so animBiped walks him. o.flat = true for a fully unlit silhouette.
export function makeShadowMan(o = {}) {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  const ink = o.flat ? basic({ color: 0x000000 }) : lambert({ color: 0x0a0a0d });
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.1, 0.92, 0);
    m(cap(0.08, 0.4), ink, 0, -0.26, 0, hip);
    m(cap(0.065, 0.36), ink, 0, -0.64, 0, hip);
    const sh = m(cap(0.06, 0.16, 8), ink, 0, -0.88, 0.06, hip); sh.rotation.x = Math.PI / 2; sh.scale.set(1.1, 1, 0.75);
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0, 0);
  m(cyl(0.23, 0.2, 0.6, 12), ink, 0, 1.22, 0, torso).scale.z = 0.66;                // coat body
  m(sph(0.24, 12, 8), ink, 0, 1.47, 0, torso).scale.set(1.1, 0.36, 0.66);          // squared shoulders
  m(cyl(0.215, 0.215, 0.05, 12), ink, 0, 0.98, 0, torso).scale.z = 0.7;             // belt
  m(cyl(0.21, 0.32, 0.62, 12, 1, true), ink, 0, 0.66, 0, torso).scale.z = 0.72;    // long flared coat skirt to mid-shin
  ink.side = THREE.DoubleSide;
  for (const s of [-1, 1]) {                                                         // popped collar
    const c = m(box(0.13, 0.17, 0.03), ink, s * 0.085, 1.6, 0.03, torso);
    c.rotation.set(-0.15, s * 0.5, s * 0.12);
  }
  m(cyl(0.065, 0.075, 0.12, 8), ink, 0, 1.56, 0, torso);                            // neck
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.27, 1.45, 0);
    m(cap(0.075, 0.22), ink, 0, -0.15, 0, sh);
    m(cap(0.068, 0.22), ink, 0, -0.43, 0, sh);
    m(cyl(0.08, 0.085, 0.07, 8), ink, 0, -0.56, 0, sh);                              // cuff
    m(sph(0.055, 8, 6), ink, 0, -0.64, 0.01, sh).scale.set(0.8, 1.15, 0.9);          // gloved hand
    sh.rotation.z = s * 0.06;
    arms.push(sh);
  }
  const head = pivot(torso, 0, 1.6, 0);
  m(sph(0.125, 14, 10), ink, 0, 0.13, 0, head).scale.set(0.92, 1.12, 1.0);
  const hat = pivot(head, 0, 0.225, 0.005); hat.rotation.x = 0.14;                        // fedora, brim tipped down over the face
  m(cyl(0.29, 0.29, 0.02, 16), ink, 0, 0, 0, hat).scale.z = 0.92;                   // wide brim
  const crown = m(cyl(0.12, 0.14, 0.15, 12), ink, 0, 0.08, 0, hat); crown.scale.z = 0.9;
  m(box(0.03, 0.03, 0.2), ink, 0, 0.155, 0, hat);                                   // crown pinch
  m(cyl(0.143, 0.143, 0.035, 12), ink, 0, 0.025, 0, hat).scale.z = 0.9;              // hat band
  addShadow(root, 0.9, 0.9);
  root.userData = { body, torso, legs, arms, head, scale: 1, seed: 0, lookFwd: true, shadowMan: true };
  return root;
}

// ---------------- Tube Dude ("Tube"), Goobles' friend: a wacky waving inflatable tube man ----------------
// Body is a chain of bendable segments so animTube() can make him flail. Feet = fan box at y=0, faces +z.
let tubeFaceT = null;
function tubeFace() {
  if (!tubeFaceT) {
    tubeFaceT = new THREE.TextureLoader().load(TUBE_FACE_PNG);
    tubeFaceT.colorSpace = THREE.SRGBColorSpace;
  }
  return tubeFaceT;
}
export function makeTubeDude(o = {}) {
  const root = new THREE.Group();
  const red = pmat(o.color ?? 0xe8202a), yel = pmat(0xffd21f), black = pmat(0x1a1a1c, { flat: true }), grey = pmat(0x3a3a3e, { flat: true });
  const fringeM = lambert({ color: 0xffd21f, side: THREE.DoubleSide, emissive: 0x332a00 });
  const H = o.height ?? 3.4, N = 7, segH = (H - 0.5) / N, r = 0.2;
  // fan base
  m(block(0.62, 0.36, 0.62, 0.92, 0.92), black, 0, 0.2, 0, root);
  for (const s of [-1, 1]) for (const t of [-1, 1]) m(cyl(0.05, 0.05, 0.05, 8), grey, s * 0.25, 0.03, t * 0.25, root).rotation.z = Math.PI / 2;
  m(box(0.4, 0.2, 0.02), grey, 0, 0.2, 0.312, root);                                        // fan grille
  m(cyl(r * 1.05, r * 1.1, 0.25, 12), black, 0, 0.5, 0, root);                              // black collar
  const fringe = (parent, y, n, len, spread, up = 1) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const f = m(new THREE.PlaneGeometry(0.075, len), fringeM, Math.sin(a) * spread, y + up * len * 0.4, Math.cos(a) * spread, parent);
      f.rotation.set(Math.cos(a) * 0.5 * up, a, -Math.sin(a) * 0.5 * up);
    }
  };
  // body chain
  const segs = [];
  let parent = pivot(root, 0, 0.6, 0);
  for (let i = 0; i < N; i++) {
    const p = i ? pivot(parent, 0, segH, 0) : parent;
    const rr = r * (1 - i * 0.012);
    m(cyl(rr, rr * 1.01, segH * 1.06, 12), red, 0, segH / 2, 0, p);
    if (i) m(sph(rr * 1.005, 12, 8), red, 0, 0, 0, p);                                    // joint filler so bends stay smooth
    segs.push(p); parent = p;
  }
  const top = segs[N - 1];
  m(sph(r * 0.93, 12, 8), red, 0, segH, 0, top).scale.y = 0.7;                               // rounded head top
  fringe(top, segH + 0.08, 11, 0.4, 0.07);                                                  // yellow hair tuft
  const face = m(new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.4, 16, 1, true, -1.15, 2.3),
    lambert({ map: tubeFace(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, emissive: 0x222222, emissiveMap: tubeFace() }),
    0, segH * 0.35, 0, top);
  face.renderOrder = 2;
  // arms: 3 bendy segments each, sprouting from the 5th body segment
  const arms = [];
  for (const s of [-1, 1]) {
    let ap = pivot(segs[N - 3], s * r * 0.9, segH * 0.7, 0); ap.rotation.z = -s * 1.05;
    const chain = [];
    for (let k = 0; k < 3; k++) {
      const p = k ? pivot(ap, 0, 0.28, 0) : ap;
      m(cyl(0.075, 0.08, 0.3, 10), red, 0, 0.14, 0, p);
      m(sph(0.08, 10, 6), red, 0, 0, 0, p);
      chain.push(p); ap = p;
    }
    fringe(ap, 0.3, 8, 0.3, 0.05);                                                         // fringed "hands"
    arms.push(chain);
  }
  addShadow(root, 0.9, 0.9);
  root.userData = { segs, arms, seed: o.seed ?? Math.random() * 10, tubeDude: true };
  return root;
}
/** Wacky flailing. t = seconds, power 0..1 (fan strength). Occasionally folds over and springs back. */
export function animTube(o, t, power = 1) {
  const u = o.userData, k = t * 3.2 + u.seed;
  const flop = Math.max(0, Math.sin(t * 0.55 + u.seed) - 0.8) * 5 * power;                // periodic fold-over
  u.segs.forEach((p, i) => {
    const w = (i + 1) / u.segs.length;
    p.rotation.z = (Math.sin(k - i * 0.7) * 0.16 + Math.sin(k * 1.7 - i) * 0.06) * power * w + (i >= 3 ? flop * 0.35 * Math.sin(u.seed + 1) : 0);
    p.rotation.x = (Math.sin(k * 0.8 - i * 0.6 + 1) * 0.1) * power * w + (i >= 3 ? flop * 0.28 : 0);
  });
  u.arms.forEach((chain, s) => chain.forEach((p, j) => {
    const sg = s ? 1 : -1;
    const base = j === 0 ? -sg * 1.05 : 0;
    p.rotation.z = base + Math.sin(k * 1.9 + s * 2 + j * 0.9) * (0.55 + j * 0.25) * power;
    p.rotation.x = Math.sin(k * 1.3 + s + j) * 0.35 * power;
  }));
}

// ---------------- cast kit: townsfolk, late-90s PS1 action-RPG look ----------------
// Smooth-shaded low-poly bodies; the detail lives in hand-painted textures (baked side shading, cloth folds, trim,
// buttons, seams). Chunky angular hair pieces, big hands and shoes, painted face on a faceted head. Rig matches
// makeHuman so animBiped / spawnPed work unchanged.
function frontDecal(geo, tex, R, scale = 2.3, minZ = 0.2) {
  const g = geo.clone(); g.scale(1.012, 1.012, 1.012);
  const p = g.attributes.position, uv = g.attributes.uv, idx = g.index.array, keep = [];
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (R * scale), 0.5 + p.getY(i) / (R * scale));
  for (let i = 0; i < idx.length; i += 3) if ([0, 1, 2].every((k) => p.getZ(idx[i + k]) > R * minZ)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  g.setIndex(keep);
  const mt = lambert({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(g, mt); mesh.renderOrder = 2;
  return mesh;
}
const castFaceCache = new Map();
/** Painted face: f = { eye, brow, browTilt, lids (0..1), glasses, smile (-1 frown .. 1 grin), blush, wrinkles, lashes, stubble, lip } */
function castFace(f = {}) {
  const k = JSON.stringify(f);
  if (castFaceCache.has(k)) return castFaceCache.get(k);
  const t = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128); g.scale(2, 2);
    const INK = '#2a1e1c';
    if (f.blush) { g.fillStyle = 'rgba(235,110,120,0.35)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(32 + s * 13, 40, 5, 3, 0, 0, 7); g.fill(); } }
    if (f.stubble) { g.fillStyle = 'rgba(40,30,30,0.28)'; g.beginPath(); g.ellipse(32, 47, 13, 9, 0, 0, Math.PI); g.fill(); }
    for (const s of [-1, 1]) {
      const x = 32 + s * 9.5, y = 31;
      g.fillStyle = '#f6f2ea'; g.beginPath(); g.ellipse(x, y, 4.8, 4, 0, 0, 7); g.fill();
      const ir = g.createLinearGradient(0, y - 3, 0, y + 3); ir.addColorStop(0, f.eye || '#4a3424'); ir.addColorStop(1, f.eye2 || '#9a7a5a');
      g.fillStyle = ir; g.beginPath(); g.arc(x, y + 0.4, 2.8, 0, 7); g.fill();
      g.fillStyle = '#0c0a0a'; g.beginPath(); g.arc(x, y + 0.5, 1.3, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.fillRect(x + 0.6, y - 1.4, 1.4, 1.4);
      if (f.lids) { g.fillStyle = f.skinHex || '#e8c4a4'; g.fillRect(x - 5.2, y - 4.6, 10.4, 0.6 + 7 * f.lids * 0.55); }
      g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, 4.8, 4, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      if (f.lashes) for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x + s * (3.9 + a), y - 2.8 + Math.abs(a)); g.lineTo(x + s * (5.6 + a), y - 4.4 + Math.abs(a)); g.stroke(); }
      g.fillStyle = f.brow || '#3a2a1e'; const bt = f.browTilt || 0;
      g.beginPath(); g.moveTo(x - 5, y - 7 + s * bt); g.lineTo(x + 5, y - 7 - s * bt); g.lineTo(x + 5, y - 5.6 - s * bt); g.lineTo(x - 5, y - 5.6 + s * bt); g.fill();
      if (f.wrinkles) { g.strokeStyle = 'rgba(80,50,40,0.45)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + s * 5.4, y - 1); g.lineTo(x + s * 7.2, y - 2); g.moveTo(x + s * 5.4, y + 1); g.lineTo(x + s * 7.2, y + 2); g.stroke(); }
      if (f.glasses) { g.strokeStyle = f.glasses; g.lineWidth = 1.1; g.beginPath(); g.ellipse(x, y, 6.4, 5.4, 0, 0, 7); g.stroke(); }
    }
    if (f.glasses) { g.strokeStyle = f.glasses; g.lineWidth = 1.1; g.beginPath(); g.moveTo(29, 30); g.quadraticCurveTo(32, 28.5, 35, 30); g.stroke(); }
    g.strokeStyle = 'rgba(120,70,60,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(32, 35); g.lineTo(31, 40.5); g.lineTo(33.2, 41); g.stroke(); // nose
    const sm = f.smile ?? 0.4;
    g.strokeStyle = f.lip || '#7a3a34'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(27, 45.5 - sm); g.quadraticCurveTo(32, 45.5 + sm * 4, 37, 45.5 - sm); g.stroke();
    if (sm > 0.7) { g.fillStyle = '#f8f4ee'; g.beginPath(); g.moveTo(28.5, 45.6); g.quadraticCurveTo(32, 45.6 + sm * 2.4, 35.5, 45.6); g.quadraticCurveTo(32, 45.2, 28.5, 45.6); g.fill(); }
    if (f.wrinkles) { g.strokeStyle = 'rgba(80,50,40,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(25, 41); g.quadraticCurveTo(24, 45, 26, 48); g.moveTo(39, 41); g.quadraticCurveTo(40, 45, 38, 48); g.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  castFaceCache.set(k, t);
  return t;
}
const hex = (c) => '#' + new THREE.Color(c).getHexString();
const shade = (c, k) => { const col = new THREE.Color(c); col.r = Math.min(1, col.r * k); col.g = Math.min(1, col.g * k); col.b = Math.min(1, col.b * k); return '#' + col.getHexString(); };
const clothCache = new Map();
/**
 * Hand-painted cloth strip that wraps a cylinder (u around, front at the middle). Baked side shading, soft folds,
 * optional hem/collar band, buttons, centre placket, pocket, belt. Point-filtered 64px for that era's texel size.
 */
function clothTex(base, o = {}) {
  const k = base + JSON.stringify(o);
  if (clothCache.has(k)) return clothCache.get(k);
  o = { light: new THREE.Color(base).getHSL({}).l > 0.6, ...o };
  const W = 64, H = 64;
  const t = canvasTex(W, H, (g) => {
    const lt = shade(base, 1.18), dk = shade(base, 0.72), md = hex(base);
    const sg = g.createLinearGradient(0, 0, W, 0);
    sg.addColorStop(0, dk); sg.addColorStop(0.3, md); sg.addColorStop(0.5, lt); sg.addColorStop(0.7, md); sg.addColorStop(1, dk);
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(255,255,255,0.08)'); vg.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    let sd = (o.seed ?? 3) * 7919; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (o.folds ?? 7); i++) {                                       // folds: soft dark streak with a light edge
      const x = rnd() * W, y0 = H * (0.15 + rnd() * 0.4), len = H * (0.25 + rnd() * 0.5), lean = (rnd() - 0.5) * 8;
      g.strokeStyle = `rgba(0,0,0,${o.light ? 0.07 : 0.13})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + lean, y0 + len); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${o.light ? 0.2 : 0.14})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1.6, y0); g.lineTo(x + lean + 1.6, y0 + len); g.stroke();
    }
    if (o.hem) { g.fillStyle = o.hem; g.fillRect(0, H - 6, W, 6); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, H - 7, W, 1.5); }
    if (o.collar) { g.fillStyle = o.collar; g.fillRect(0, 0, W, 3); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 3, W, 1.2); }
    if (o.belt) { g.fillStyle = o.belt; g.fillRect(0, H * 0.78, W, 5); g.fillStyle = '#c8b050'; g.fillRect(W / 2 - 3, H * 0.78 - 0.5, 6, 6); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(W / 2 - 1.2, H * 0.78 + 1, 2.4, 3); }
    if (o.placket) {                                                                 // open-front cardigan / jacket showing the shirt
      g.fillStyle = o.placket; g.fillRect(W / 2 - 4, 0, 8, H);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(W / 2 - 5, 0, 1.5, H); g.fillRect(W / 2 + 3.5, 0, 1.5, H);
    }
    if (o.buttons) for (let i = 0; i < o.buttons; i++) {
      const y = H * (0.22 + i * 0.2);
      g.fillStyle = o.buttonColor || '#f2e8c8'; g.beginPath(); g.arc(W / 2 + (o.placket ? 5.5 : 0), y, 2, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W / 2 + (o.placket ? 5.5 : 0) - 0.8, y - 0.8, 1.6, 1.6);
    }
    if (o.pocket) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(W / 2 + 7, H * 0.3, 9, 9); }
    if (o.stripe) { g.fillStyle = o.stripe; for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 3, H); }
    if (o.logo) { g.fillStyle = o.logo; g.beginPath(); g.arc(W / 2 + 9, H * 0.3, 2.5, 0, 7); g.fill(); }
    g.fillStyle = `rgba(0,0,0,${o.light ? 0.06 : 0.14})`; for (let i = 0; i < 120; i++) g.fillRect(rnd() * W, rnd() * H, 1, 1);   // weave grain
  });
  t.offset.x = 0.5;                                                                   // cylinder seam goes to the back
  clothCache.set(k, t);
  return t;
}
const cloth = (base, o) => lambert({ color: 0xffffff, map: clothTex(base, o) });
let shoeTexT = null, skinTexCache = new Map();
function skinMat(c) {
  if (!skinTexCache.has(c)) skinTexCache.set(c, lambert({ color: 0xffffff, map: clothTex(c, { folds: 0, seed: 1 }) }));   // gouraud like the references, facets show in the silhouette
  return skinTexCache.get(c);
}
/** Hair as a few big angular slabs, painted with strand streaks. */
const hairCache = new Map();
function hairMat(c) {
  if (!hairCache.has(c)) {
    const t = canvasTex(64, 64, (g) => {
      g.fillStyle = hex(c); g.fillRect(0, 0, 64, 64);
      let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 30; i++) { g.strokeStyle = i % 3 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.2)'; g.lineWidth = 1 + rnd(); const x = rnd() * 64; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 10, 64); g.stroke(); }
      const sh = g.createLinearGradient(0, 0, 0, 64); sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = sh; g.fillRect(0, 0, 64, 64);
    });
    hairCache.set(c, lambert({ color: 0xffffff, map: t, flatShading: true }));
  }
  return hairCache.get(c);
}
function shoeMat(c) {
  const t = canvasTex(64, 64, (g) => {
    g.fillStyle = hex(c); g.fillRect(0, 0, 64, 64);
    const sh = g.createLinearGradient(0, 0, 0, 64); sh.addColorStop(0, 'rgba(255,255,255,0.15)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = sh; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e8e4dc'; g.fillRect(0, 50, 64, 14); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 49, 64, 2);   // sole
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(8, 30); g.lineTo(56, 30); g.stroke();  // seam
  });
  return lambert({ color: 0xffffff, map: t, flatShading: true });
}
/**
 * spec: { h, build (0.8..1.3), skin, hair, hairStyle ('bun'|'short'|'bald'|'cap'|'long'|'combover'|'buzz'|'bob'|'spiky'),
 *  top, topStyle ('tee'|'polo'|'cardigan'|'hoodie'|'vest'|'blouse'|'jacket'), top2 (shirt under open top),
 *  bottom, bottomStyle ('pants'|'shorts'|'skirt'|'dress'), shoes, face {...castFace}, hunch, trim (hem/collar colour), extras(parts) }
 */
export function makeCastHuman(spec = {}) {
  const S = { h: 1.75, build: 1, skin: 0xe8c4a4, hair: 0x4a3020, hairStyle: 'short', top: 0x3a6ea8, topStyle: 'tee', bottom: 0x2c3a52, bottomStyle: 'pants', shoes: 0x2a2a2a, hunch: 0, ...spec };
  const sc = S.h / 1.75, B = S.build, open = S.topStyle === 'cardigan' || S.topStyle === 'vest' || S.topStyle === 'jacket';
  const longSl = S.topStyle === 'cardigan' || S.topStyle === 'hoodie' || S.topStyle === 'blouse' || S.topStyle === 'jacket';
  const longSkirt = S.bottomStyle === 'dress' || S.bottomStyle === 'skirt';
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0);
  const skin = skinMat(S.skin), shoe = shoeMat(S.shoes), hair = hairMat(S.hair);
  const trim = S.trim ?? shade(S.top, 1.5);
  const topM = cloth(S.top, { seed: 2, folds: 6, collar: S.topStyle === 'blouse' ? trim : null, hem: S.topStyle === 'hoodie' || S.topStyle === 'tee' ? shade(S.top, 0.85) : null,
    placket: open ? hex(S.top2 ?? 0xf2efe6) : null, buttons: open ? 3 : (S.topStyle === 'polo' ? 2 : 0), pocket: S.topStyle === 'hoodie', logo: S.logo || null });
  const sleeveM = cloth(S.top, { seed: 5, folds: 4, hem: longSl ? trim : null });
  const plainM = cloth(S.top, { seed: 6, folds: 3 });
  const botM = cloth(S.bottom, { seed: 7, folds: 5, belt: S.bottomStyle === 'pants' ? (S.belt || '#3a2a1e') : null, hem: longSkirt ? (S.hem || shade(S.bottom, 1.3)) : null });
  const legM = cloth(S.bottom, { seed: 9, folds: 4, hem: S.bottomStyle === 'pants' ? shade(S.bottom, 0.8) : null });
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.095 * B, 0.86, 0);
    m(cyl(0.08 * B, 0.07 * B, 0.42, 6), S.bottomStyle === 'shorts' || longSkirt ? skin : legM, 0, -0.22, 0, hip);
    m(cyl(0.064 * B, 0.06, 0.38, 6), S.bottomStyle === 'pants' ? legM : skin, 0, -0.6, 0, hip);
    if (S.bottomStyle === 'shorts') m(cyl(0.092 * B, 0.088 * B, 0.22, 6), botM, 0, -0.1, 0, hip);
    m(block(0.14, 0.1, 0.28, 0.75, 0.65, 0.03), shoe, 0, -0.81, 0.05, hip);                    // big angular shoe
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0, 0);
  const chest = m(cyl(0.2 * B, 0.165 * B, 0.52, 8), topM, 0, 1.17, 0, torso); chest.scale.z = 0.7;
  m(block(0.44 * B, 0.1, 0.28 * B, 0.8, 0.8), plainM, 0, 1.4, 0, torso);                     // squared shoulders
  if (B > 1.1) m(block(0.4 * B, 0.3, 0.3 * B, 0.95, 0.75, 0.02), plainM, 0, 1.0, 0.03, torso); // belly wedge
  m(cyl(0.18 * B, 0.185 * B, 0.13, 8), botM, 0, 0.9, 0, torso).scale.z = 0.72;               // hips / waistband
  if (longSkirt) m(cyl(0.19 * B, S.bottomStyle === 'dress' ? 0.3 * B : 0.26 * B, S.bottomStyle === 'dress' ? 0.62 : 0.42, 8, 1, true), botM, 0, S.bottomStyle === 'dress' ? 0.56 : 0.66, 0, torso).scale.z = 0.82;
  if (S.topStyle === 'hoodie') m(block(0.3, 0.1, 0.22, 0.8, 0.8), plainM, 0, 1.5, -0.1, torso);
  if (open) for (const s of [-1, 1]) m(box(0.025, 0.46, 0.012), topM, s * 0.045 * B, 1.19, 0.141 * B, torso);                         // placket edges
  m(cyl(0.055, 0.065, 0.1, 6), skin, 0, 1.5, 0, torso);                                     // neck
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.245 * B, 1.42, 0);
    m(cyl(0.07 * B, 0.06 * B, 0.3, 6), sleeveM, 0, -0.15, 0, sh);
    m(cyl(0.054 * B, 0.05, 0.28, 6), longSl ? sleeveM : skin, 0, -0.43, 0, sh);
    const hand = m(block(0.1, 0.12, 0.085, 0.85, 0.85), skin, 0, -0.64, 0.01, sh);          // big hand
    m(block(0.035, 0.07, 0.05, 0.8, 0.8), skin, -s * 0.06, -0.6, 0.02, sh).rotation.z = -s * 0.5; // thumb
    void hand; sh.rotation.z = s * 0.07;
    arms.push(sh);
  }
  const head = pivot(torso, 0, 1.55, 0.01);
  const R = 0.15, hy = 0.12;
  const hg = new THREE.SphereGeometry(R, 8, 5);                                               // 8x5 polyhedron head
  { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > R * 0.5) { p.setY(i, R * 0.5 + (y - R * 0.5) * 0.6); } if (y < -R * 0.3) { const k = 1 - (-y / R - 0.3) * 0.4; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * (0.8 + k * 0.2)); } } hg.computeVertexNormals(); } // flat crown, tapered jaw
  const HS = [0.95, 1.1, 1];
  m(hg, skin, 0, hy, 0, head).scale.set(...HS);
  const fd = frontDecal(hg, castFace({ skinHex: hex(S.skin), ...(S.face || {}) }), R); fd.position.y = hy; fd.scale.set(...HS); head.add(fd);
  for (const s of [-1, 1]) m(block(0.03, 0.06, 0.045, 0.8, 0.8), skin, s * 0.145, hy, 0, head);          // ears
  // hair: angular slabs
  const hs = S.hairStyle, slab = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, tx = 1) => { const o = m(block(w, h, d, tx, 1), hair, x, y, z, head); o.rotation.set(rx, ry, rz); return o; };
  if (hs !== 'bald') {
    if (hs === 'buzz') m(new THREE.SphereGeometry(R * 1.02, 8, 3, 0, Math.PI * 2, 0, 1.25), hair, 0, hy, 0, head).scale.set(...HS);
    else {
      if (hs !== 'combover') m(new THREE.SphereGeometry(R * 1.06, 8, 3, 0, Math.PI * 2, 0, 1.2), hair, 0, hy + 0.01, -0.005, head).scale.set(HS[0], HS[1] * 0.95, 1.05); // 8x3 faceted cap
      else for (let i = 0; i < 3; i++) slab(0.26, 0.012, 0.03, 0, hy + 0.122 - i * 0.006, -0.04 + i * 0.045, 0, 0, 0.06, 1);          // comb-over strands
      slab(0.3, hs === 'combover' ? 0.1 : 0.14, 0.1, 0, hy + (hs === 'combover' ? -0.01 : 0.02), -0.1, 0.1, 0, 0, 1.05);           // back mass
      for (const s of [-1, 1]) slab(0.07, 0.11, 0.16, s * 0.13, hy + 0.05, -0.03, 0, 0, -s * 0.1, 0.8);                           // side wedges hugging the temples
      if (hs === 'short' || hs === 'spiky') slab(0.22, 0.04, 0.1, 0, hy + 0.12, 0.09, -0.8, 0, 0, 0.8);                           // front fringe hugging the brow
      if (hs === 'spiky') for (const s of [-1, 0, 1]) { const sp = m(new THREE.ConeGeometry(0.045, 0.12, 4), hair, s * 0.08, hy + 0.21, -0.02 + Math.abs(s) * 0.02, head); sp.rotation.set(-0.3, 0, -s * 0.5); }
      if (hs === 'bob' || hs === 'long') { for (const s of [-1, 1]) slab(0.09, hs === 'long' ? 0.36 : 0.24, 0.17, s * 0.15, hy - (hs === 'long' ? 0.12 : 0.06), -0.03, 0, 0, 0, 0.9); slab(0.32, hs === 'long' ? 0.34 : 0.22, 0.08, 0, hy - (hs === 'long' ? 0.1 : 0.04), -0.13, 0, 0, 0, 1.1); slab(0.26, 0.06, 0.12, 0, hy + 0.15, 0.06, -0.5, 0, 0, 0.85); }
      if (hs === 'bun') { m(block(0.12, 0.1, 0.11, 0.7, 0.7), hair, 0, hy + 0.14, -0.1, head).rotation.x = 0.4; slab(0.22, 0.035, 0.08, 0, hy + 0.105, 0.1, -0.95, 0, 0, 0.9); } // boxy bun + swept hairline
    }
  }
  if (hs === 'cap') {
    const c = cloth(S.capColor ?? 0xb02a2a, { folds: 2, seed: 4 });
    m(new THREE.SphereGeometry(R * 1.1, 8, 3, 0, Math.PI * 2, 0, 1.3), c, 0, hy + 0.02, 0, head).scale.set(HS[0], HS[1], 1.04);
    m(block(0.2, 0.02, 0.15, 0.9, 1), c, 0, hy + 0.08, 0.17, head).rotation.x = 0.12;
  }
  if (S.hunch) { torso.rotation.x = S.hunch; head.rotation.x = -S.hunch * 0.6; }
  addShadow(root, 0.8, 0.8);
  root.scale.setScalar(sc);
  root.userData = { body, torso, legs, arms, head, scale: sc, seed: Math.random() * 10 };
  if (S.extras) S.extras({ root, body, torso, head, arms, legs, pmat, m, box, cyl, sph, block, hy, cloth });
  return root;
}

// ---- the cast ----
export function makeNana() {
  return makeCastHuman({
    h: 1.55, build: 0.95, skin: 0xf0cdb4, hair: 0xf4f4f6, hairStyle: 'bun',
    top: 0x8a5ab0, topStyle: 'cardigan', top2: 0xf4eef8, trim: '#d9c6ea', bottom: 0xb9a5d2, bottomStyle: 'dress', hem: '#ede6f4', shoes: 0x6a4a3a, hunch: 0.12,
    face: { eye: '#3d6a96', eye2: '#8ab0d0', glasses: '#8a6a3a', smile: 1, blush: true, wrinkles: true, brow: '#c8c8cc', lip: '#a04a5a' },
    extras: ({ torso, pmat, m, sph }) => {                                                      // pearl necklace
      const pearl = pmat(0xf8f4ea);
      for (let i = 0; i < 9; i++) { const a = -1 + (i / 8) * 2; m(sph(0.015, 4, 2), pearl, Math.sin(a) * 0.1, 1.44 - Math.cos(a) * 0.05 + 0.05, 0.1 + Math.cos(a) * 0.035, torso); }
    },
  });
}
export function makeGary() {
  return makeCastHuman({
    h: 1.78, build: 1.15, skin: 0xe9bfa0, hair: 0x6a4a2a, hairStyle: 'combover',
    top: 0xf2f0ea, topStyle: 'polo', trim: '#2a4a7a', logo: '#2a4a7a', bottom: 0xb8a070, bottomStyle: 'pants', belt: '#4a2e18', shoes: 0x5a3a22,
    face: { eye: '#5a4a30', eye2: '#8a7a50', smile: -0.6, browTilt: 1.6, lids: 0.25, brow: '#5a3a20' },
    extras: ({ arms, m, box, pmat }) => {                                                       // clipboard and lanyard badge
      const c = m(box(0.2, 0.27, 0.015), pmat(0x9a7b4f), 0, -0.5, 0.12, arms[0]); c.rotation.x = -0.4;
      m(box(0.17, 0.22, 0.004), pmat(0xf4f4f4), 0, -0.49, 0.13, arms[0]).rotation.x = -0.4;
    },
  });
}

// ---------------- STUDY: late-90s PS1 character technique, built from scratch ----------------
// What the references do: (1) every part is a tapered box or 6-sided prism, nothing is round; (2) the texture does
// the work: lapels, shirt, tie, buttons, cuffs, knuckles, hair highlights are PAINTED on flat faces at chunky texel
// size; (3) one big front-facing head with a painted face (brows, closed eyes, nose, moustache) and a single-mass
// hair/hat shape; (4) gouraud shading, nearest-filtered textures. This is an original character using that method.
function px(w, h, draw) { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
const boxMats = (front, side, top = side, back = side, bottom = side) => [side, side, top, bottom, front, back];
const tx = (t) => lambert({ map: t });
export function makeStudyForeman() {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0);
  const COAT = '#c9a46a', COATD = '#a8864f', COATL = '#dcbb82', SKIN = '#f0c8a0', SKIND = '#d8a87c', PANTS = '#3b3a44', SHIRT = '#f2eee4', TIE = '#b8302a', HAT = '#b89660';
  const grain = (g, w, h, a = 0.04) => { let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); g.fillStyle = `rgba(0,0,0,${a})`; for (let i = 0; i < w * h / 10; i++) g.fillRect(r() * w | 0, r() * h | 0, 1, 1); };
  const vshade = (g, w, h, k = 0.3) => { const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.1)'); v.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = v; g.fillRect(0, 0, w, h); };
  // coat front: lapels folded back over a shirt and tie, vest, belt, pockets. Edges get a light + dark line so parts read as separate pieces.
  const coatFront = px(32, 64, (g) => {
    g.fillStyle = COAT; g.fillRect(0, 0, 32, 64);
    g.fillStyle = SHIRT; g.beginPath(); g.moveTo(10, 0); g.lineTo(22, 0); g.lineTo(18, 20); g.lineTo(14, 20); g.fill();
    g.fillStyle = '#2a2026'; g.beginPath(); g.moveTo(8, 8); g.lineTo(14, 20); g.lineTo(16, 44); g.lineTo(8, 44); g.fill();
    g.beginPath(); g.moveTo(24, 8); g.lineTo(18, 20); g.lineTo(16, 44); g.lineTo(24, 44); g.fill();
    g.fillStyle = TIE; g.beginPath(); g.moveTo(14.5, 3); g.lineTo(17.5, 3); g.lineTo(19, 20); g.lineTo(16, 24); g.lineTo(13, 20); g.fill();
    g.fillStyle = '#8a2420'; g.fillRect(14, 3, 1, 18);
    g.fillStyle = '#4a3a24'; g.fillRect(12, 30, 2, 2); g.fillRect(12, 38, 2, 2);
    g.fillStyle = COATL; g.beginPath(); g.moveTo(0, 0); g.lineTo(10, 0); g.lineTo(8, 12); g.lineTo(5, 18); g.lineTo(7, 44); g.lineTo(0, 44); g.fill();   // lapels (lighter, folded back)
    g.beginPath(); g.moveTo(32, 0); g.lineTo(22, 0); g.lineTo(24, 12); g.lineTo(27, 18); g.lineTo(25, 44); g.lineTo(32, 44); g.fill();
    g.fillStyle = COAT; g.fillRect(0, 0, 5, 64); g.fillRect(27, 0, 5, 64);
    g.fillStyle = COAT; g.fillRect(0, 44, 32, 20);                                                                                        // coat skirt below belt
    g.fillStyle = '#4a3220'; g.fillRect(0, 43, 32, 4); g.fillStyle = '#d8c070'; g.fillRect(14, 42, 4, 6); g.fillStyle = '#4a3220'; g.fillRect(15, 43, 2, 4); // belt + buckle
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(5, 0, 1, 64); g.fillRect(26, 0, 1, 64); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(4, 0, 1, 64); g.fillRect(27, 0, 1, 64); // coat edges
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(1, 50, 6, 1); g.fillRect(25, 50, 6, 1);                                                   // pocket flaps
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(15, 47, 2, 17);                                                                           // skirt opening
    vshade(g, 32, 64, 0.22); grain(g, 32, 64);
  });
  const coatSide = px(16, 64, (g) => { g.fillStyle = COAT; g.fillRect(0, 0, 16, 64); g.fillStyle = '#4a3220'; g.fillRect(0, 43, 16, 4); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(3, 18, 2, 24); g.fillRect(10, 24, 2, 18); g.fillRect(6, 50, 2, 14); vshade(g, 16, 64, 0.35); grain(g, 16, 64); });
  const coatBack = px(32, 64, (g) => { g.fillStyle = COAT; g.fillRect(0, 0, 32, 64); g.fillStyle = '#4a3220'; g.fillRect(0, 43, 32, 4); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(15, 48, 2, 16); g.fillRect(6, 1, 20, 1); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(6, 2, 20, 1); vshade(g, 32, 64, 0.3); grain(g, 32, 64); });
  const upperSleeve = px(16, 32, (g) => { g.fillStyle = COAT; g.fillRect(0, 0, 16, 32); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 2, 16, 1); g.fillRect(4, 10, 1, 20); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 3, 16, 1); vshade(g, 16, 32, 0.3); grain(g, 16, 32); }); // shoulder seam
  const lowerSleeve = px(16, 32, (g) => { g.fillStyle = COAT; g.fillRect(0, 0, 16, 32); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(10, 2, 1, 20); g.fillStyle = COATD; g.fillRect(0, 24, 16, 3); g.fillStyle = SHIRT; g.fillRect(0, 27, 16, 5); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 26, 16, 1); vshade(g, 16, 32, 0.3); grain(g, 16, 32); }); // cuff strap + shirt cuff
  const hand = px(16, 16, (g) => { g.fillStyle = SKIN; g.fillRect(0, 0, 16, 16); g.fillStyle = SKIND; for (const x of [3, 6, 9, 12]) g.fillRect(x, 7, 1, 8); g.fillRect(2, 6, 12, 1); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 12, 16, 4); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(2, 1, 12, 2); });
  const upperPants = px(16, 32, (g) => { g.fillStyle = PANTS; g.fillRect(0, 0, 16, 32); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(7, 0, 2, 32); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(1, 2, 6, 1); vshade(g, 16, 32, 0.3); });   // crease + pocket line
  const lowerPants = px(16, 32, (g) => { g.fillStyle = PANTS; g.fillRect(0, 0, 16, 32); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(7, 0, 2, 32); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 29, 16, 3); vshade(g, 16, 32, 0.3); });  // hem
  const shoeT = px(16, 16, (g) => { g.fillStyle = '#3a2418'; g.fillRect(0, 0, 16, 16); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(3, 3, 10, 1); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(3, 7, 10, 1); g.fillStyle = '#1a1210'; g.fillRect(0, 12, 16, 4); });
  const hatT = px(32, 16, (g) => { g.fillStyle = HAT; g.fillRect(0, 0, 32, 16); g.fillStyle = '#3a2a1a'; g.fillRect(0, 10, 32, 4); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 9, 32, 1); vshade(g, 32, 16, 0.25); grain(g, 32, 16); });
  const brimT = px(16, 16, (g) => { g.fillStyle = HAT; g.fillRect(0, 0, 16, 16); vshade(g, 16, 16, 0.4); grain(g, 16, 16); });
  const skinT = px(8, 8, (g) => { g.fillStyle = SKIN; g.fillRect(0, 0, 8, 8); });
  const collarT = px(16, 8, (g) => { g.fillStyle = COATL; g.fillRect(0, 0, 16, 8); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 6, 16, 2); });
  const faceT = px(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.translate(0, -7);
    g.fillStyle = SKIND; g.fillRect(14, 36, 36, 6);
    g.fillStyle = '#3a2416';
    g.beginPath(); g.moveTo(10, 24); g.lineTo(28, 27); g.lineTo(28, 31); g.lineTo(10, 29); g.fill();
    g.beginPath(); g.moveTo(54, 24); g.lineTo(36, 27); g.lineTo(36, 31); g.lineTo(54, 29); g.fill();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(13, 36); g.quadraticCurveTo(20, 31, 27, 36); g.stroke();
    g.beginPath(); g.moveTo(37, 36); g.quadraticCurveTo(44, 31, 51, 36); g.stroke();
    g.fillStyle = SKIND; g.beginPath(); g.moveTo(32, 32); g.lineTo(27, 44); g.lineTo(37, 44); g.fill();
    g.fillStyle = '#4a2a18'; g.beginPath(); g.moveTo(32, 43); g.lineTo(14, 48); g.lineTo(16, 55); g.lineTo(32, 50); g.lineTo(48, 55); g.lineTo(50, 48); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(20, 47, 8, 2); g.fillRect(36, 47, 8, 2);
  });
  const Fm = tx(coatFront), Sm = tx(coatSide), Bm = tx(coatBack), USm = tx(upperSleeve), LSm = tx(lowerSleeve), Hm = tx(hand), UPm = tx(upperPants), LPm = tx(lowerPants), SHm = tx(shoeT), HTm = tx(hatT), BRm = tx(brimT), SKm = tx(skinT), CLm = tx(collarT);
  const legs = [], arms = [];
  // legs: knee block sits inside both segments so the bend never opens a gap; the shoe swallows the trouser hem
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.13, 0.8, 0);
    m(block(0.21, 0.4, 0.21, 0.92, 0.92), UPm, 0, -0.18, 0, hip);
    const knee = pivot(hip, 0, -0.38, 0);
    m(block(0.17, 0.12, 0.17), UPm, 0, 0, 0, knee);
    m(block(0.185, 0.36, 0.185, 0.96, 0.96), LPm, 0, -0.2, 0, knee);
    m(block(0.21, 0.13, 0.33, 0.78, 0.68, 0.03), SHm, 0, -0.39, 0.06, knee);
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0, 0);
  m(block(0.62, 0.9, 0.4, 1.15, 1.05, -0.01), boxMats(Fm, Sm, Sm, Bm), 0, 1.15, 0, torso);                       // coat block, skirt reaches the thighs
  m(block(0.72, 0.12, 0.44, 0.88, 0.88), boxMats(Sm, Sm, USm), 0, 1.62, 0, torso);                                  // shoulder slab
  m(block(0.3, 0.1, 0.2, 0.9, 0.9), SKm, 0, 1.7, 0.02, torso);                                                     // thick neck
  m(block(0.36, 0.09, 0.1, 0.85, 1), boxMats(CLm, CLm), 0, 1.72, -0.12, torso).rotation.x = -0.25;                  // stand-up coat collar behind the neck
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.41, 1.6, 0);
    m(block(0.25, 0.38, 0.25, 0.86, 0.86), boxMats(USm, USm), 0, -0.17, 0, sh);
    const el = pivot(sh, 0, -0.34, 0);
    m(block(0.2, 0.12, 0.2), USm, 0, 0, 0, el);                                                                     // elbow filler
    m(block(0.215, 0.36, 0.215, 0.94, 0.94), boxMats(LSm, LSm), 0, -0.18, 0, el);
    m(block(0.2, 0.22, 0.14, 0.8, 0.8), boxMats(Hm, SKm, SKm, Hm), 0, -0.42, 0.01, el);                             // fist tucked up into the cuff
    sh.rotation.z = s * 0.2;
    arms.push(sh);
  }
  const head = pivot(torso, 0, 1.74, 0.02);
  const R = 0.21, hy = 0.19;
  const hg = new THREE.SphereGeometry(R, 6, 4);
  { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0) { p.setX(i, p.getX(i) * 0.85); p.setZ(i, p.getZ(i) * 0.9); } if (y > R * 0.4) p.setY(i, R * 0.4 + (y - R * 0.4) * 0.5); } hg.computeVertexNormals(); }
  m(hg, SKm, 0, hy, 0, head).scale.set(1.1, 0.92, 1);
  const fd = frontDecal(hg, faceT, R, 2.2, 0.15); fd.position.y = hy; fd.scale.set(1.1, 0.92, 1); head.add(fd);
  for (const s of [-1, 1]) m(block(0.04, 0.08, 0.06), SKm, s * 0.225, hy - 0.02, 0, head);
  const hat = pivot(head, 0, hy + 0.09, 0); hat.rotation.x = 0.08;
  m(cyl(0.2, 0.25, 0.17, 8), HTm, 0, 0.085, 0, hat);
  m(block(0.3, 0.05, 0.26, 0.6, 0.6), HTm, 0, 0.19, 0, hat);
  m(block(0.64, 0.03, 0.62, 1.05, 1.05), boxMats(BRm, BRm), 0, 0, 0.02, hat);
  addShadow(root, 1, 1);
  root.userData = { body, torso, legs, arms, head, scale: 1, seed: 0, lookFwd: true };
  return root;
}

// first pass of the study, kept for comparison
export function makeStudyForemanV1() {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0);
  const COAT = '#c9a46a', COATD = '#a8864f', SKIN = '#f0c8a0', SKIND = '#d8a87c', PANTS = '#3b3a44', SHIRT = '#f2eee4', TIE = '#b8302a', HAT = '#b89660';
  const grain = (g, w, h, a = 0.04) => { let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); g.fillStyle = `rgba(0,0,0,${a})`; for (let i = 0; i < w * h / 10; i++) g.fillRect(r() * w | 0, r() * h | 0, 1, 1); };
  const vshade = (g, w, h, k = 0.3) => { const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.1)'); v.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = v; g.fillRect(0, 0, w, h); };
  const coatFront = px(32, 48, (g) => {
    g.fillStyle = COAT; g.fillRect(0, 0, 32, 48);
    g.fillStyle = SHIRT; g.beginPath(); g.moveTo(11, 0); g.lineTo(21, 0); g.lineTo(18, 22); g.lineTo(14, 22); g.fill();
    g.fillStyle = '#2a2026'; g.beginPath(); g.moveTo(9, 10); g.lineTo(14, 22); g.lineTo(16, 48); g.lineTo(9, 48); g.fill();
    g.beginPath(); g.moveTo(23, 10); g.lineTo(18, 22); g.lineTo(16, 48); g.lineTo(23, 48); g.fill();
    g.fillStyle = TIE; g.beginPath(); g.moveTo(14.5, 4); g.lineTo(17.5, 4); g.lineTo(19, 22); g.lineTo(16, 26); g.lineTo(13, 22); g.fill();
    g.fillStyle = COATD; g.beginPath(); g.moveTo(0, 0); g.lineTo(11, 0); g.lineTo(9, 14); g.lineTo(6, 20); g.lineTo(9, 48); g.lineTo(0, 48); g.fill();
    g.beginPath(); g.moveTo(32, 0); g.lineTo(21, 0); g.lineTo(23, 14); g.lineTo(26, 20); g.lineTo(23, 48); g.lineTo(32, 48); g.fill();
    g.fillStyle = COAT; g.fillRect(0, 0, 7, 48); g.fillRect(25, 0, 7, 48);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(6, 0, 1, 48); g.fillRect(25, 0, 1, 48);
    g.fillStyle = '#4a3a24'; g.fillRect(12, 30, 2, 2); g.fillRect(12, 38, 2, 2);
    vshade(g, 32, 48, 0.25); grain(g, 32, 48);
  });
  const coatSide = px(16, 48, (g) => { g.fillStyle = COAT; g.fillRect(0, 0, 16, 48); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(3, 20, 2, 26); g.fillRect(10, 24, 2, 20); vshade(g, 16, 48, 0.35); grain(g, 16, 48); });
  const coatBack = px(32, 48, (g) => { g.fillStyle = COAT; g.fillRect(0, 0, 32, 48); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(15, 18, 2, 30); g.fillRect(6, 0, 20, 2); vshade(g, 32, 48, 0.3); grain(g, 32, 48); });
  const sleeve = px(16, 32, (g) => { g.fillStyle = COAT; g.fillRect(0, 0, 16, 32); g.fillStyle = SHIRT; g.fillRect(0, 28, 16, 4); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 26, 16, 2); g.fillRect(0, 10, 16, 1); vshade(g, 16, 32, 0.3); grain(g, 16, 32); });
  const hand = px(16, 16, (g) => { g.fillStyle = SKIN; g.fillRect(0, 0, 16, 16); g.fillStyle = SKIND; for (const x of [3, 6, 9, 12]) g.fillRect(x, 8, 1, 7); g.fillRect(2, 7, 12, 1); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 12, 16, 4); });
  const pants = px(16, 32, (g) => { g.fillStyle = PANTS; g.fillRect(0, 0, 16, 32); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(7, 0, 2, 32); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 29, 16, 3); vshade(g, 16, 32, 0.3); });
  const shoeT = px(16, 16, (g) => { g.fillStyle = '#3a2418'; g.fillRect(0, 0, 16, 16); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(4, 3, 8, 1); g.fillStyle = '#1a1210'; g.fillRect(0, 12, 16, 4); });
  const hatT = px(32, 16, (g) => { g.fillStyle = HAT; g.fillRect(0, 0, 32, 16); g.fillStyle = '#3a2a1a'; g.fillRect(0, 11, 32, 4); vshade(g, 32, 16, 0.25); grain(g, 32, 16); });
  const skinT = px(8, 8, (g) => { g.fillStyle = SKIN; g.fillRect(0, 0, 8, 8); });
  const faceT = px(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.translate(0, -7);
    g.fillStyle = SKIND; g.fillRect(14, 36, 36, 6);
    g.fillStyle = '#3a2416';
    g.beginPath(); g.moveTo(10, 24); g.lineTo(28, 27); g.lineTo(28, 31); g.lineTo(10, 29); g.fill();
    g.beginPath(); g.moveTo(54, 24); g.lineTo(36, 27); g.lineTo(36, 31); g.lineTo(54, 29); g.fill();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(13, 36); g.quadraticCurveTo(20, 31, 27, 36); g.stroke();
    g.beginPath(); g.moveTo(37, 36); g.quadraticCurveTo(44, 31, 51, 36); g.stroke();
    g.fillStyle = SKIND; g.beginPath(); g.moveTo(32, 32); g.lineTo(27, 44); g.lineTo(37, 44); g.fill();
    g.fillStyle = '#4a2a18'; g.beginPath(); g.moveTo(32, 43); g.lineTo(14, 48); g.lineTo(16, 55); g.lineTo(32, 50); g.lineTo(48, 55); g.lineTo(50, 48); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(20, 47, 8, 2); g.fillRect(36, 47, 8, 2);
  });
  const Fm = tx(coatFront), Sm = tx(coatSide), Bm = tx(coatBack), SLm = tx(sleeve), Hm = tx(hand), Pm = tx(pants), SHm = tx(shoeT), HTm = tx(hatT), SKm = tx(skinT);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = pivot(body, s * 0.13, 0.78, 0);
    m(block(0.2, 0.36, 0.2, 0.9, 0.9), Pm, 0, -0.19, 0, hip);
    m(block(0.18, 0.34, 0.18, 0.95, 0.95), Pm, 0, -0.55, 0, hip);
    m(block(0.2, 0.12, 0.32, 0.8, 0.7, 0.03), SHm, 0, -0.74, 0.06, hip);
    legs.push(hip);
  }
  const torso = pivot(body, 0, 0, 0);
  m(block(0.62, 0.78, 0.4, 1.15, 1.05, -0.01), boxMats(Fm, Sm, Sm, Bm), 0, 1.17, 0, torso);
  m(block(0.7, 0.14, 0.44, 0.85, 0.85), boxMats(Sm, Sm), 0, 1.6, 0, torso);
  m(block(0.2, 0.1, 0.18, 0.9, 0.9), SKm, 0, 1.68, 0.02, torso);
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.4, 1.58, 0);
    m(block(0.24, 0.36, 0.24, 0.85, 0.85), boxMats(SLm, SLm), 0, -0.18, 0, sh);
    m(block(0.21, 0.34, 0.21, 0.95, 0.95), boxMats(SLm, SLm), 0, -0.5, 0, sh);
    m(block(0.2, 0.22, 0.14, 0.8, 0.8), boxMats(Hm, SKm, SKm, Hm), 0, -0.76, 0.01, sh);
    sh.rotation.z = s * 0.22;
    arms.push(sh);
  }
  const head = pivot(torso, 0, 1.72, 0.02);
  const R = 0.21, hy = 0.2;
  const hg = new THREE.SphereGeometry(R, 6, 4);
  { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0) { p.setX(i, p.getX(i) * 0.85); p.setZ(i, p.getZ(i) * 0.9); } if (y > R * 0.4) p.setY(i, R * 0.4 + (y - R * 0.4) * 0.5); } hg.computeVertexNormals(); }
  m(hg, SKm, 0, hy, 0, head).scale.set(1.1, 0.92, 1);
  const fd = frontDecal(hg, faceT, R, 2.2, 0.15); fd.position.y = hy; fd.scale.set(1.1, 0.92, 1); head.add(fd);
  for (const s of [-1, 1]) m(block(0.04, 0.08, 0.06), SKm, s * 0.225, hy - 0.02, 0, head);
  const hat = pivot(head, 0, hy + 0.1, 0);
  m(cyl(0.2, 0.25, 0.16, 8), HTm, 0, 0.08, 0, hat);
  m(block(0.3, 0.05, 0.26, 0.6, 0.6), HTm, 0, 0.18, 0, hat);
  m(block(0.62, 0.03, 0.6, 1.05, 1.05), boxMats(HTm, HTm), 0, 0, 0.02, hat).rotation.x = 0.06;
  addShadow(root, 1, 1);
  root.userData = { body, torso, legs, arms, head, scale: 1, seed: 0, lookFwd: true };
  return root;
}

// ---------------- STUDY v3: one continuous skinned mesh per body part, like the references ----------------
// The body (coat hem -> torso -> neck -> head) is ONE lofted surface, each arm is ONE surface from inside the
// shoulder to the fist, each leg ONE surface from inside the hip to the sole. Bones bend them, so nothing is
// stacked or segmented. Low ring counts keep it angular; gouraud shading; painted atlas does the detail.
/** rings: [{ y, rx, rz, dz, b0, b1, w }] stacked along +y (or any axis via `axis`). n sides. vOf(ring) -> texture v. */
function loftGeo(rings, n, vOf, axis = null) {
  const pos = [], uv = [], si = [], sw = [], idx = [];
  rings.forEach((r) => {
    for (let i = 0; i <= n; i++) {
      const a = (((i % n) + 0.5) / n - 0.5) * Math.PI * 2, P = r.pts ? r.pts[i % n] : [Math.sin(a), Math.cos(a)];   // pts: custom unit outline, index i sits where angle a would
      let x = P[0] * r.rx + (r.dx || 0), y = r.y, z = P[1] * r.rz + (r.dz || 0);
      if (axis) { const p = axis(x, y, z); x = p[0]; y = p[1]; z = p[2]; }
      pos.push(x, y, z); uv.push(i / n, vOf(r));
      si.push(r.b0, r.b1 ?? r.b0, 0, 0); sw.push(r.w ?? 1, 1 - (r.w ?? 1), 0, 0);
    }
  });
  const S = n + 1;
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = k * S + i, b = a + 1, c = a + S, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Legends-style stepped shading: one flat tone per loft facet (n facets across W), lit from the front. Call with no transform on g.
function facetBands(g, W, H, n) {
  for (let j = 0; j < n; j++) {
    const c = Math.cos(((j + 1) / n - 0.5) * Math.PI * 2), a = c > 0.7 ? 'rgba(255,255,255,0.1)' : c > 0.2 ? null : c > -0.4 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.28)';
    if (!a) continue; g.fillStyle = a; const x0 = Math.round(W * j / n), x1 = Math.round(W * (j + 1) / n); g.fillRect(x0, 0, x1 - x0, H);
  }
}
// 8-point head outline for loftGeo: flat face plane across the front (i=3,4), slanted cheeks, cut-off back. Unit scale, multiplied by rx/rz.
const HEAD_PTS = [[-0.4, -0.95], [-0.95, -0.35], [-1, 0.3], [-0.55, 0.75], [0.55, 0.75], [1, 0.3], [0.95, -0.35], [0.4, -0.95]];
export function makeStudyForemanV3() {
  const root = new THREE.Group(), body = pivot(root, 0, 0, 0);
  const COAT = '#c9a46a', COATD = '#a8864f', COATL = '#dcbb82', SKIN = '#f0c8a0', SKIND = '#d8a87c', PANTS = '#3b3a44', SHIRT = '#f2eee4', TIE = '#b8302a', HAT = '#b89660', BELT = '#4a3220';
  const grain = (g, w, h, a = 0.04) => { let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647); g.fillStyle = `rgba(0,0,0,${a})`; for (let i = 0; i < w * h / 10; i++) g.fillRect(r() * w | 0, r() * h | 0, 1, 1); };
  // ---- bones ----
  const B = []; const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); if (parent) parent.add(b); B.push(b); return b; };
  const torsoB = bone(null, 0, 0, 0), headB = bone(torsoB, 0, 1.72, 0);
  const armU = [], armL = [], legU = [], legL = [];
  for (const s of [-1, 1]) { const u = bone(torsoB, s * 0.37, 1.56, 0), l = bone(u, 0, -0.3, 0); armU.push(u); armL.push(l); }
  for (const s of [-1, 1]) { const u = bone(torsoB, s * 0.15, 0.82, 0), l = bone(u, 0, -0.4, 0); legU.push(u); legL.push(l); }
  const bi = (b) => B.indexOf(b);
  const skel = new THREE.Skeleton(B);
  // ---- body atlas: 64 around x 256 tall, y 0.74 .. 2.14 ----
  const Y0 = 0.74, Y1 = 2.2, H = 256, W = 64, Y = (y) => H * (1 - (y - Y0) / (Y1 - Y0)), vOf = (r) => (r.y - Y0) / (Y1 - Y0);
  const bodyT = px(W, H, (g) => {
    g.translate(-W / 16, 0);                                                                                              // loft facets are centred half a facet off the vertex u: shift so x=32 is the middle of the front facet
    g.fillStyle = COAT; g.fillRect(-8, 0, W + 16, H);
    g.fillStyle = SKIN; g.fillRect(-8, 0, W + 16, Y(1.66));                                                               // neck + head
    // shading bands: sides darker (u near 0 / 1 are the back, 0.25/0.75 the sides)
    g.save(); g.resetTransform(); facetBands(g, W, H, 8); g.restore();                                                   // stepped shading, one tone per facet
    // coat front (open trench over shirt, tie and vest). Front facet = x 28..36, the two beside it reach 20..44. Front = u 0.5 = x 32.
    const c = 32, PX = Y(0.74) - Y(1.66);
    g.fillStyle = PANTS; g.fillRect(c - 7, Y(1.62), 14, PX);                                                              // dark core under the open coat (pants show below the vest)
    g.fillStyle = '#242634'; g.beginPath(); g.moveTo(c - 10, Y(1.56)); g.lineTo(c - 1, Y(1.3)); g.lineTo(c - 1, Y(0.98)); g.lineTo(c - 8, Y(0.98)); g.fill();   // vest, two fronts meeting under the tie
    g.beginPath(); g.moveTo(c + 10, Y(1.56)); g.lineTo(c + 1, Y(1.3)); g.lineTo(c + 1, Y(0.98)); g.lineTo(c + 8, Y(0.98)); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(c - 7, Y(1.3), 6, Y(0.98) - Y(1.3));                                 // left vest front catches light
    g.fillStyle = SHIRT; g.beginPath(); g.moveTo(c - 9, Y(1.66)); g.lineTo(c + 9, Y(1.66)); g.lineTo(c + 1, Y(1.3)); g.lineTo(c - 1, Y(1.3)); g.fill();         // shirt in the V
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(c - 9, Y(1.66)); g.lineTo(c - 3, Y(1.66)); g.lineTo(c - 1, Y(1.52)); g.lineTo(c - 4, Y(1.56)); g.fill(); // collar point shadows
    g.beginPath(); g.moveTo(c + 9, Y(1.66)); g.lineTo(c + 3, Y(1.66)); g.lineTo(c + 1, Y(1.52)); g.lineTo(c + 4, Y(1.56)); g.fill();
    g.fillStyle = TIE; g.fillRect(c - 2, Y(1.62), 4, Y(1.56) - Y(1.62)); g.beginPath(); g.moveTo(c - 2, Y(1.56)); g.lineTo(c + 2, Y(1.56)); g.lineTo(c + 3, Y(1.22)); g.lineTo(c, Y(1.16)); g.lineTo(c - 3, Y(1.22)); g.fill(); // knot + long tie
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(c, Y(1.54), 3, Y(1.2) - Y(1.54)); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(c - 2, Y(1.57), 4, 1);               // tie shade + knot crease
    g.fillStyle = '#555a66'; g.fillRect(c - 4, Y(1.2), 2, 2); g.fillRect(c - 4, Y(1.1), 2, 2);                                 // vest buttons
    // lapels: wide cream facings folded out from the collar, narrowing to the coat edge at the chest, then the edge runs straight down to the hem
    for (const s of [-1, 1]) {
      g.fillStyle = COATL; g.beginPath(); g.moveTo(c + s * 9, Y(1.68)); g.lineTo(c + s * 19, Y(1.66)); g.lineTo(c + s * 17, Y(1.58)); g.lineTo(c + s * 14, Y(1.46)); g.lineTo(c + s * 10, Y(1.3)); g.lineTo(c + s * 10, Y(0.74)); g.lineTo(c + s * 7, Y(0.74)); g.lineTo(c + s * 7, Y(1.36)); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(c + s * 17, Y(1.58)); g.lineTo(c + s * 19, Y(1.56)); g.lineTo(c + s * 15, Y(1.46)); g.lineTo(c + s * 14, Y(1.46)); g.fill();   // lapel notch
      g.fillRect(c + s * 10 - (s < 0 ? 1 : 0), Y(1.3), 1, Y(0.74) - Y(1.3));                                                                                           // coat edge shadow on the body side
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(c + s * 7 - (s < 0 ? 0 : 1), Y(1.36), 1, Y(0.74) - Y(1.36));                                                     // lit facing edge
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(c + s * 15 - (s < 0 ? 0 : 1), Y(1.3), 1, Y(0.74) - Y(1.3));                                                           // fold crease where the front panel hangs
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(c - 15, Y(0.98), 6, 1); g.fillRect(c + 9, Y(0.98), 6, 1);                      // pocket slits
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-8, Y(0.76), W + 16, 2); g.fillRect(-8, Y(1.54), W + 16, 1); g.fillRect(c - 33, Y(1.3), 2, Y(0.9) - Y(1.3)); g.fillRect(c + 31, Y(1.3), 2, Y(0.9) - Y(1.3)); // hem, back yoke, back vent (u=0/1 is the back, drawn at both wrap positions)
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-8, Y(2.2), W + 16, Y(2.12) - Y(2.2));                                        // crown in the hat's shadow
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-8, Y(1.72), W + 16, Y(1.66) - Y(1.72));                                        // shadow under the jaw
    g.resetTransform(); grain(g, W, H);
  });
  // ---- body loft: coat hem -> shoulders -> neck -> head, 8 sides ----
  const T = bi(torsoB), HD = bi(headB);
  const HP = HEAD_PTS;
  const bodyRings = [
    { y: 0.74, rx: 0.39, rz: 0.29, b0: T }, { y: 0.76, rx: 0.38, rz: 0.28, b0: T }, { y: 1.0, rx: 0.32, rz: 0.22, b0: T },                                              // hem fold, hip
    { y: 1.3, rx: 0.34, rz: 0.24, dz: 0.01, b0: T }, { y: 1.52, rx: 0.38, rz: 0.235, b0: T }, { y: 1.6, rx: 0.41, rz: 0.24, b0: T }, { y: 1.66, rx: 0.3, rz: 0.2, b0: T }, // chest, shoulders, collar
    { y: 1.7, rx: 0.13, rz: 0.115, b0: T, b1: HD, w: 0.7 }, { y: 1.76, rx: 0.125, rz: 0.11, b0: HD },                                                                   // neck
    { y: 1.82, rx: 0.19, rz: 0.17, b0: HD, pts: HP }, { y: 1.9, rx: 0.235, rz: 0.21, b0: HD, pts: HP }, { y: 2.1, rx: 0.235, rz: 0.21, b0: HD, pts: HP },               // tapered jaw, flat face plane, straight sides
    { y: 2.17, rx: 0.19, rz: 0.17, b0: HD, pts: HP }, { y: 2.2, rx: 0, rz: 0, b0: HD },                                                                                 // flat crown
  ];
  const bodyMesh = new THREE.SkinnedMesh(loftGeo(bodyRings, 8, vOf), lambert({ map: bodyT }));
  bodyMesh.add(torsoB); torsoB.updateMatrixWorld(true); bodyMesh.bind(skel); bodyMesh.frustumCulled = false; body.add(bodyMesh);
  // ---- arm atlas (32 x 64): sleeve with shoulder seam, cuff at the wrist, fist with knuckle lines ----
  const armT = px(32, 64, (g) => {
    g.fillStyle = COAT; g.fillRect(0, 0, 32, 64);
    g.fillStyle = SKIN; g.fillRect(0, 0, 32, 17);                                                                        // hand (top of texture = end of arm)
    facetBands(g, 32, 64, 6);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 60, 32, 1); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 61, 32, 1);  // shoulder seam
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(8, 30, 1, 24); g.fillRect(22, 34, 1, 18);                                   // folds
    g.fillStyle = COATL; g.fillRect(0, 17, 32, 11); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 28, 32, 1); g.fillRect(0, 17, 32, 1);   // big rolled cuff, turned back
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 18, 32, 1); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 23, 32, 1);          // cuff roll highlight and fold line
    g.fillStyle = SKIND; for (const x of [11, 15, 19, 23]) g.fillRect(x, 1, 1, 8); g.fillRect(9, 9, 16, 1); g.fillRect(6, 6, 3, 6);   // fingers on the back of the hand, thumb at the side
    g.fillStyle = '#b8805c'; g.fillRect(12, 11, 2, 1); g.fillRect(16, 12, 2, 1); g.fillRect(20, 11, 2, 1); g.fillRect(14, 13, 1, 2); g.fillRect(19, 13, 1, 2); // knuckle creases
    grain(g, 32, 64);
  });
  const legT = px(32, 64, (g) => {
    g.fillStyle = PANTS; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#3a2418'; g.fillRect(0, 0, 32, 14); g.fillStyle = '#1a1210'; g.fillRect(0, 0, 32, 4);                   // shoe + sole
    facetBands(g, 32, 64, 6);
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(15, 16, 2, 48); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 14, 32, 2); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(12, 9, 8, 1); // crease, hem, shoe shine
  });
  // ---- arms: one loft per arm from inside the shoulder to the fist. Local frame: along -y from the shoulder bone. ----
  for (const [k, s] of [[0, -1], [1, 1]]) {
    const U = bi(armU[k]), L = bi(armL[k]), sx = s * 0.37, sy = 1.56;
    const r = (t, rx, rz, b0, b1, w, dx = 0, dz = 0) => ({ y: sy - t, rx, rz, dx: sx + dx, dz, b0, b1, w });
    const rings = [
      r(-0.03, 0, 0, U), r(-0.01, 0.11, 0.11, U), r(0.06, 0.135, 0.13, U), r(0.22, 0.12, 0.115, U), r(0.28, 0.11, 0.105, U, L, 0.6), r(0.32, 0.11, 0.105, L, U, 0.6),   // shoulder puff -> elbow
      r(0.4, 0.105, 0.1, L), r(0.42, 0.14, 0.13, L), r(0.55, 0.15, 0.14, L), r(0.56, 0.15, 0.14, L),                                                                   // big rolled cuff, turned back
      r(0.565, 0.09, 0.06, L), r(0.6, 0.135, 0.075, L), r(0.72, 0.14, 0.08, L), r(0.82, 0.115, 0.06, L), r(0.84, 0, 0, L),                                            // wrist step in, broad flat hand, fingertips
    ];
    const vA = (rg) => 1 - (sy - rg.y + 0.03) / 0.87;
    const mesh = new THREE.SkinnedMesh(loftGeo(rings, 6, vA), lambert({ map: armT })); mesh.bind(skel); mesh.frustumCulled = false; body.add(mesh);
  }
  // ---- legs: hip (hidden inside the coat) -> knee -> ankle -> shoe, one loft each ----
  for (const [k, s] of [[0, -1], [1, 1]]) {
    const U = bi(legU[k]), L = bi(legL[k]), sx = s * 0.15, sy = 0.82;
    const r = (t, rx, rz, b0, b1, w, dz = 0) => ({ y: sy - t, rx, rz, dx: sx, dz, b0, b1, w });
    const rings = [
      r(-0.06, 0.1, 0.1, U), r(0.1, 0.105, 0.105, U), r(0.36, 0.095, 0.095, U, L, 0.6), r(0.44, 0.095, 0.095, L, U, 0.6), r(0.66, 0.09, 0.09, L), r(0.72, 0.085, 0.085, L),
      r(0.72, 0.115, 0.17, L, L, 1, 0.07), r(0.78, 0.12, 0.21, L, L, 1, 0.1), r(0.82, 0.115, 0.2, L, L, 1, 0.1), r(0.82, 0, 0, L, L, 1, 0.1),
    ];
    const vL = (rg) => 1 - (sy - rg.y + 0.06) / 0.9;
    const mesh = new THREE.SkinnedMesh(loftGeo(rings, 6, vL), lambert({ map: legT })); mesh.bind(skel); mesh.frustumCulled = false; body.add(mesh);
  }
  // ---- rigid extras on the head bone: hat, ears ----
  const hatT = px(32, 16, (g) => { g.fillStyle = HAT; g.fillRect(0, 0, 32, 16); g.fillStyle = '#3a2a1a'; g.fillRect(0, 10, 32, 4); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 9, 32, 1); grain(g, 32, 16); });
  const brimT = px(16, 16, (g) => { g.fillStyle = HAT; g.fillRect(0, 0, 16, 16); const v = g.createLinearGradient(0, 0, 0, 16); v.addColorStop(0, 'rgba(255,255,255,0.1)'); v.addColorStop(1, 'rgba(0,0,0,0.4)'); g.fillStyle = v; g.fillRect(0, 0, 16, 16); grain(g, 16, 16); });
  const skinM = lambert({ color: SKIN });
  const hat = pivot(headB, 0, 0.46, 0.01); hat.rotation.x = 0.08;
  m(cyl(0.19, 0.24, 0.17, 8), tx(hatT), 0, 0.085, 0, hat);
  m(block(0.28, 0.05, 0.25, 0.6, 0.6), tx(hatT), 0, 0.19, 0, hat);
  m(block(0.62, 0.03, 0.6, 1.05, 1.05), boxMats(tx(brimT), tx(brimT)), 0, 0, 0.02, hat);
  for (const s of [-1, 1]) m(block(0.035, 0.08, 0.06), skinM, s * 0.245, 0.25, 0, headB);
  // ---- face plane: its own 64x64 texture, a 2x2 expression grid mapped onto the flat front facet of the head; setFace(i) shifts the UVs ----
  const faceT = px(64, 64, (g) => {
    const cell = (cx, cy, kind) => {
      g.save(); g.translate(cx * 32, cy * 32); g.fillStyle = SKIN; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, 32, 32);
      const browY = kind === 'angry' ? 13 : kind === 'surprised' ? 8 : 11, tilt = kind === 'angry' ? 2 : kind === 'surprised' ? -1 : 1;
      g.fillStyle = '#3a2416';                                                                                                   // brows: thick, tilted
      g.beginPath(); g.moveTo(4, browY + tilt); g.lineTo(13, browY - tilt); g.lineTo(13, browY - tilt + 2); g.lineTo(4, browY + tilt + 3); g.fill();
      g.beginPath(); g.moveTo(28, browY + tilt); g.lineTo(19, browY - tilt); g.lineTo(19, browY - tilt + 2); g.lineTo(28, browY + tilt + 3); g.fill();
      for (const ex of [8, 24]) {                                                                                                // eyes: big, low, wide apart
        if (kind === 'shut') { g.fillStyle = '#2a1a10'; g.fillRect(ex - 4, 16, 8, 1); g.fillRect(ex - 3, 17, 6, 1); }
        else if (kind === 'angry') { g.fillStyle = '#f8f4ee'; g.fillRect(ex - 4, 15, 8, 3); g.fillStyle = '#2a1a10'; g.fillRect(ex - 1, 15, 3, 3); g.fillRect(ex - 4, 14, 8, 1); }
        else if (kind === 'surprised') { g.fillStyle = '#f8f4ee'; g.fillRect(ex - 4, 12, 8, 7); g.fillStyle = '#2a1a10'; g.fillRect(ex - 1, 14, 3, 4); g.fillRect(ex - 4, 11, 8, 1); }
        else { g.fillStyle = '#f8f4ee'; g.fillRect(ex - 4, 14, 8, 4); g.fillStyle = '#2a1a10'; g.fillRect(ex - 1, 14, 3, 4); g.fillRect(ex - 4, 13, 8, 1); g.fillStyle = '#fff'; g.fillRect(ex, 14, 1, 1); }
      }
      g.fillStyle = SKIND; g.fillRect(15, 19, 2, 3); g.fillRect(14, 22, 4, 1);                                                   // nose: a notch
      g.fillStyle = '#4a2a18'; g.beginPath(); g.moveTo(16, 22); g.lineTo(3, 24); g.lineTo(5, 29); g.lineTo(16, 26); g.lineTo(27, 29); g.lineTo(29, 24); g.fill(); // moustache
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(6, 25, 8, 1); g.fillRect(18, 25, 8, 1);
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 30, 32, 2);                                                               // chin shadow
      g.restore();
    };
    cell(0, 0, 'shut'); cell(1, 0, 'open'); cell(0, 1, 'angry'); cell(1, 1, 'surprised');
  });
  faceT.repeat.set(0.5, 0.5);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.255, 0.23), lambert({ map: faceT })); face.position.set(0, 1.99 - 1.72, 0.21 * 0.75 + 0.003); headB.add(face);
  const setFace = (i) => { faceT.offset.set((i % 2) * 0.5, i < 2 ? 0.5 : 0); faceT.needsUpdate = true; }; setFace(0);
  // ---- hair: a few angular slabs under the hat brim (back and sides), flat shaded ----
  const hairM = pmat('#3a2416', { flat: true });
  for (let i = 0; i < 7; i++) {                                                                                           // seven slabs from one temple round the back to the other, bottoms cut at different heights
    const a = Math.PI * i / 6, rad = 0.215, h = [0.18, 0.22, 0.2, 0.24, 0.2, 0.22, 0.18][i];                                 // right temple -> back -> left temple
    const sl = m(block(0.13, h, 0.06, 0.55, 0.8), hairM, Math.cos(a) * rad, 0.44 - h / 2, -Math.sin(a) * rad, headB); sl.rotation.y = a + Math.PI / 2; sl.rotation.x = -0.12;
  }
  // ---- thumbs: a wedge on the inside of each mitten hand ----
  for (const [k, s] of [[0, -1], [1, 1]]) m(block(0.045, 0.1, 0.055, 0.6, 0.6), skinM, -s * 0.115, -0.34, 0.01, armL[k]).rotation.z = s * 0.35;
  addShadow(root, 1, 1);
  for (const sh of armU) sh.rotation.z = (armU.indexOf(sh) ? 1 : -1) * 0.22;
  root.userData = { body, torso: torsoB, legs: legU, arms: armU, head: headB, scale: 1, seed: 0, lookFwd: true, setFace };
  return root;
}
