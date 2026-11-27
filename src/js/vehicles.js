// Remodeled vehicles in the game (diet, 2026-11-26: "add the cars to the game").
// The Tracebench cars in tools/vehicles are baked by tools/vehicles/bake.cjs into one small GLB each (src/models/vehicles):
//   Paint (grey texture, tinted per car), Body (every other part in one texture atlas), BarR / BarB (police roof bar),
//   Wheel, plus *_far twins (coarser index) used past LOD_FAR metres. That is 3 draw calls for the body and 1 per wheel.
// spawnCar (game.js) asks pickModel() for a model in the requested class: traffic and parked cars get random civilian models,
// police roles get the police models. The old procedural types stay for the golf cart, Goob's truck and as the fallback
// (?cars=old, or if a model fails to decode). Each model id is its own CAR_TYPES entry, so carphys gets a chassis per model;
// spec.cls says which handling family it belongs to (sedan / hatch / suv / pickup).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { makeCar, addShadow } from './models.js';
import { basic } from './gfx.js';
import { GLB, INDEX } from '../models/vehicles/index.js';

export const VEHICLES_ENABLED = !(typeof location !== 'undefined' && /[?&]cars=old\b/.test(location.search));
const LOD_FAR = 38;
// game class of each roster class: the procedural type whose handling numbers it starts from
const BASE = { sedan: 'sedan', sport: 'hatch', suv: 'suv', pickup: 'pickup', cart: 'golfcart' };
// which models a requested procedural type turns into
const POOLS = { sedan: ['sedan', 'sedan', 'sport'], hatch: ['sedan', 'sport'], wagon: ['suv'], suv: ['suv'], pickup: ['pickup'], golfcart: ['cart'] };
const byCls = {};
for (const [id, I] of Object.entries(INDEX)) if (GLB[id]) (byCls[I.cls] ||= []).push(id);

// register every model as a CAR_TYPES entry: size from the model, handling from its class scaled by the real car's numbers
export function registerVehicles(CAR_TYPES) {
  if (!VEHICLES_ENABLED) return;
  const secs = (a) => parseFloat(a) || 8;
  const mean = (ids, f) => ids.reduce((t, id) => t + f(INDEX[id]), 0) / ids.length;
  for (const [id, I] of Object.entries(INDEX)) {
    if (!GLB[id]) continue;
    const police = I.cls === 'police', cart = I.cls === 'cart', fam = police ? (I.roofY > 1.55 ? 'suv' : 'sedan') : I.cls;
    const B = CAR_TYPES[BASE[fam]], peers = byCls[I.cls];
    const k = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const top = B.top * k(I.top / mean(peers, (q) => q.top), 0.88, 1.2) * (police ? 1.12 : 1);
    const acc = B.acc * k(mean(peers, (q) => secs(q.acc)) / secs(I.acc), 0.85, 1.25) * (police ? 1.1 : 1);
    CAR_TYPES[id] = {
      len: I.len, wid: +(I.wid * 0.9).toFixed(2), h: +(I.roofY * 0.5).toFixed(2), top, acc, grip: B.grip + (police ? 0.5 : 0),
      mass: +(B.mass * k((I.len * I.wid) / (4.9 * 2.1), 0.85, 1.25)).toFixed(2), bed: !!B.bed, cart: !!B.cart, cls: fam, name: I.name, model: id,
      glb: { wr: I.wr, wx: I.wx, axles: I.axles, roofY: I.roofY, roofZ: I.roofZ, glows: I.glows, livery: I.livery, bar: police || cart,
        label: cart ? { x: 0.612, y: 0.44, z: -0.8, w: 0.6, h: 0.15 } : { x: +(I.wid * 0.45 - 0.02).toFixed(3), y: +(I.roofY * 0.48).toFixed(3), z: 0, w: 1.4, h: 0.35 } },
    };
  }
  // decode every model up front (meshopt decode is async) so cars spawned at start do not pop in a few frames late
  for (const id of Object.keys(GLB)) load(id, () => {}, () => {});
}

// the model to spawn for a requested procedural type (null = keep the procedural car)
export function pickModel(type, o = {}) {
  if (!VEHICLES_ENABLED || o.keepType) return null;
  if (o.model && GLB[o.model]) return o.model;          // a specific model (QA, scripted scenes)
  const pick = (a) => (a && a.length ? a[(Math.random() * a.length) | 0] : null);
  if (o.role === 'police' || o.role === 'pdParked') return pick(byCls.police);
  const pool = POOLS[type]; if (!pool) return null;
  return pick(byCls[pick(pool)]);
}

// ---------------- meshes ----------------
const cache = new Map();
function load(id, done, fail) {
  let c = cache.get(id);
  if (!c) {
    c = { scene: null, err: null, wait: [] }; cache.set(id, c);
    const bin = GLB[id], L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
    L.parse(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '', (g) => {
      g.scene.traverse((m) => {
        if (!m.isMesh) return;
        const map = m.material.map || null;
        if (map) { map.magFilter = map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.needsUpdate = true; }
        m.material = new THREE.MeshLambertMaterial({ map, color: map ? 0xffffff : m.material.color });
        m.castShadow = m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix();
      });
      g.scene.updateMatrixWorld(true); c.scene = g.scene; for (const w of c.wait) w[0](c.scene); c.wait.length = 0;
    }, (e) => { console.warn('vehicle model failed to load', id, e); c.err = e || 1; for (const w of c.wait) w[1](); c.wait.length = 0; });
  }
  if (c.scene) done(c.scene); else if (c.err) fail(); else c.wait.push([done, fail]);
}
let barGeo = null;
const labelMats = new Map();
// a LOD node from the named meshes (near) and their _far twins
function lodOf(sc, names, mats) {
  const lod = new THREE.LOD(), near = new THREE.Group(), far = new THREE.Group();
  for (const n of names) {
    const a = sc.getObjectByName(n), b = sc.getObjectByName(n + '_far') || a;
    if (!a) continue;
    // keep each node's transform: quantized GLBs carry the dequantization scale / offset on the node
    for (const [src, grp] of [[a, near], [b, far]]) { const q = new THREE.Mesh(src.geometry, mats[n] || src.material); q.matrixAutoUpdate = false; q.matrix.copy(src.matrixWorld); grp.add(q); }
  }
  lod.addLevel(near, 0); lod.addLevel(far, LOD_FAR);
  return lod;
}

// same userData contract as models.js makeCar: { body, wheels [FL, FR, RL, RR], bar, wr, spec, paint, glows }
export function makeModelCar(type, color, o, CAR_TYPES) {
  const S = CAR_TYPES[type], G = S.glb;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // grey paint texture (median ~215): lift the tint so the car reads as the chosen colour; police keep their livery
  const paint = new THREE.MeshLambertMaterial({ color: 0xffffff });
  if (!G.livery) { paint.color.set(color); const hi = Math.max(paint.color.r, paint.color.g, paint.color.b); paint.color.multiplyScalar(Math.min(1.45, 1.15 / Math.max(hi, 0.01))); } // whites would blow out
  const bar = [basic({ color: 0xff2020 }), basic({ color: 0x2050ff })];
  const wheels = [], spins = [];
  for (const z of G.axles) for (const s of [1, -1]) {
    const pv = new THREE.Group(), spin = new THREE.Group(); pv.position.set(s * G.wx, G.wr, z); root.add(pv); pv.add(spin);
    wheels.push(pv); spins.push([spin, s]);
  }
  addShadow(root, S.wid + 1.0, S.len + 1.0);
  { const sh = root.children[root.children.length - 1]; sh.updateMatrix(); sh.matrixAutoUpdate = false; }
  load(S.model, (sc) => {
    paint.map = sc.getObjectByName('Paint').material.map; paint.needsUpdate = true;
    body.add(lodOf(sc, ['Paint', 'Body', 'BarR', 'BarB'], { Paint: paint, BarR: bar[0], BarB: bar[1] }));
    for (const [spin, s] of spins) { const w = lodOf(sc, ['Wheel'], {}); if (s < 0) w.scale.x = -1; spin.add(w); }
  }, () => {
    // decoder unavailable: fall back to the procedural car of the same family so the game still has cars
    const P = makeCar(S.cls === 'sport' ? 'sedan' : S.cls === 'cart' ? 'golfcart' : S.cls, color, o), u = P.userData;
    for (const ch of u.body.children.slice()) body.add(ch);
    u.wheels.forEach((w, i) => { for (const ch of w.children.slice()) { ch.position.set(0, 0, 0); spins[i][0].add(ch); } });
  });
  // a civilian model asked for a light bar (HOA patrol SUV): the game's two-block bar on the roof
  if (o.lightbar && !G.bar) {
    barGeo ||= (() => { const a = new THREE.BoxGeometry(0.45, 0.12, 0.25), b = a.clone(); a.translate(-0.25, 0, 0); b.translate(0.25, 0, 0); return [a, b]; })();
    barGeo.forEach((g, i) => { const m = new THREE.Mesh(g, bar[i]); m.position.set(0, G.roofY + 0.06, G.roofZ); body.add(m); });
  }
  // door lettering (HOA patrol): a plane on each side
  if (o.label) {
    const L = G.label; if (!labelMats.has(o.label)) labelMats.set(o.label, basic({ map: o.label }));
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), labelMats.get(o.label)); m.rotation.y = s * Math.PI / 2; m.position.set(s * L.x, L.y, L.z); body.add(m); }
  }
  const glows = G.glows.map(([x, y, z, c, s]) => ({ x, y, z, c, s }));
  root.userData = { body, wheels, bar: G.bar || o.lightbar ? bar : null, wr: G.wr, spec: S, paint, glows };
  return root;
}
