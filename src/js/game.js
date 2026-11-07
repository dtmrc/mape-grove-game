// Maple Grove: Off Leash. A small open-world sandbox in a PS2-era suburb.
import * as THREE from 'three';
import { makeTextures, basic, lambert, mat, rnd, makeSky, makePost } from './gfx.js';
import { setTextures, makeCat, makeHuman, makeRaccoon, makeCar, animBiped, makeTrashBag, CAR_TYPES, addShadow } from './models.js';
import { buildWorld, NODES, ADJ, LIMIT, MAP_HALF, drawMap, districtAt, places, animated, nightMats, lamps, lights, halos, signMats, flames, collide, blocked, inZone } from './world.js';
import { Sfx } from './sfx.js';
import { setText, setHTML, setStyle, setClass, setData } from './dom.js'; // P10: write-on-change HUD
import { makeFishing } from './fishing.js';
import * as BRK from './breakables.js';
import { makeJail } from './jailbreak.js';
import { makeInteriors } from './interiors.js';
import { makeShops } from './shops.js'; // content: shops + belly food
import { makeJobs } from './jobs.js'; // content: replayable missions, side jobs, post-game
import * as RD from './roads.js';
import * as TER from './terrain.js';
import { makeDev } from './devtools.js';
import { makeEvents } from './events.js';
import { makeFX } from './fx.js';
import { makePolice } from './police.js'; // police
import { makeOfficer } from './officer.js';
import { waterPolys } from './ground.js';
import { makeUI } from './ui.js'; // ui: pause menu, settings, full map
import { makeGamepad } from './gamepad.js'; // ui: gamepad

// ---------------- renderer ----------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const RES = [360, 480, 720];
let resIdx = matchMedia('(pointer: coarse)').matches ? 0 : 1;
const post = makePost(renderer);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 190);
scene.fog = new THREE.Fog(0x3a2a5a, 30, 165);
const hemi = new THREE.HemisphereLight(0xdfefff, 0x5a6a40, 1.4);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.8);
sun.position.set(40, 80, 25);
scene.add(hemi, sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const H = RES[resIdx], W = Math.round(H * w / h);
  renderer.setSize(W, H, false);
  post.setSize(W, H);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const T = makeTextures();
setTextures(T);
const WM = buildWorld(scene, T);
TER.initWorld(scene, { lights, halos, flames }); // engine: link loose world objects to movable groups

// ---------------- state ----------------
const SAVE_KEY = 'maple-grove-offleash-v1';
// every key NEW GAME wipes: this save, fishing, weather, the sky's day counter, the dev view (not the world editor's maple-grove-world-v1, that is the map)
const SAVE_KEYS = [SAVE_KEY, 'maple-grove-offleash-fishing-v1', 'maple-grove-offleash-jobs-v1', 'maple-grove-offleash-fx', 'maple-grove-offleash-sky', 'mg-dev-view'];
const G = {
  cash: 0, hp: 100, heat: 0, seenT: 0, bustT: 0, clock: 21.5, done: {}, yarn: [],
  mission: null, dialog: null, paused: true, banner: null, over: false, time: 0,
};
let SV = null; // the loaded save; position and pistol are applied once P and police exist
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) { SV = s; G.cash = s.cash | 0; G.done = s.done || {}; G.yarn = s.yarn || []; if (s.clock !== undefined) G.clock = ((+s.clock || 0) % 24 + 24) % 24; if (s.hp !== undefined) G.hp = Math.max(10, Math.min(100, +s.hp || 100)); G.jailbreaks = s.jailbreaks | 0; } } catch (e) { /* storage blocked */ }
}
// save format v2: { version, cash, done, yarn, x, z, yaw, inside, clock, hp, heat (always 0), gun: { has, ammo }, jailbreaks }
function save() {
  try {
    const inside = INT.inside || jail.active(); // saved indoors (or in the can): wake up at the RV instead
    const g = police.gun || {};
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, cash: G.cash, done: G.done, yarn: G.yarn, x: inside ? places.spawn.x : px(), z: inside ? places.spawn.z : pz(), yaw: P.car ? P.car.yaw : P.yaw, inside, clock: G.clock, hp: G.hp, heat: 0, gun: { has: !!g.has, ammo: g.ammo | 0 }, jailbreaks: G.jailbreaks | 0 }));
  } catch (e) { /* storage blocked */ }
}
load();

// ---------------- input ----------------
const keys = new Set();
const pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys.add(k); pressed.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
  Sfx.unlock();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
const down = (...k) => k.some((x) => keys.has(x));
const hit = (...k) => k.some((x) => pressed.has(x));

let camYaw = Math.PI, camPitch = 0.28, camIdle = 0, drag = null, lookInv = 1; // ui: lookInv = -1 inverts look
const touch = { x: 0, y: 0, active: false, id: null, btn: {} };
const isTouch = matchMedia('(pointer: coarse)').matches;
canvas.addEventListener('pointerdown', (e) => {
  Sfx.unlock();
  if (e.pointerType === 'mouse' && !document.pointerLockElement && !G.paused) {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* not allowed in this frame */ }
  }
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
  if (document.pointerLockElement && e.button === 0) pressed.add('punch');
});
addEventListener('pointermove', (e) => {
  if (document.pointerLockElement) { camYaw -= e.movementX * 0.004; camPitch += e.movementY * 0.003 * lookInv; camIdle = 0; }
  else if (drag && drag.id === e.pointerId) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    camYaw -= dx * 0.008; camPitch += dy * 0.005 * lookInv; camIdle = 0;
    drag.x = e.clientX; drag.y = e.clientY;
  }
  camPitch = Math.max(-0.15, Math.min(1.1, camPitch));
});
addEventListener('pointerup', (e) => {
  if (drag && drag.id === e.pointerId) {
    if (drag.moved < 6 && !document.pointerLockElement && e.pointerType === 'mouse') pressed.add('punch');
    drag = null;
  }
});

// touch joystick + buttons
const pad = document.getElementById('pad'), knob = document.getElementById('knob');
pad.addEventListener('pointerdown', (e) => { e.stopPropagation(); touch.active = true; touch.id = e.pointerId; pad.setPointerCapture(e.pointerId); moveKnob(e); Sfx.unlock(); });
pad.addEventListener('pointermove', (e) => { if (touch.active && e.pointerId === touch.id) moveKnob(e); });
const endPad = () => { touch.active = false; touch.x = touch.y = 0; knob.style.transform = 'translate(-50%,-50%)'; };
pad.addEventListener('pointerup', endPad); pad.addEventListener('pointercancel', endPad);
function moveKnob(e) {
  const r = pad.getBoundingClientRect();
  let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  touch.x = dx; touch.y = dy;
  knob.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
}
for (const b of document.querySelectorAll('[data-k]')) {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sfx.unlock(); keys.add(k); pressed.add(k); b.classList.add('on'); });
  const up = () => { keys.delete(k); b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
}
if (isTouch) document.body.classList.add('touch');

// ---------------- HUD ----------------
const $ = (id) => document.getElementById(id);
const hud = { cash: $('cash'), hp: $('hpfill'), stars: $('stars'), clock: $('clock'), obj: $('objective'), timer: $('timer'), banner: $('banner'), toast: $('toast'), car: $('carname'), carhp: $('carhp'), carhpfill: $('carhpfill'), fuel: $('fuel'), fuelfill: $('fuelfill'), prompt: $('prompt'), usebtn: $('usebtn'), actbtn: $('actbtn'), jumpbtn: $('jumpbtn') };
let toastT = 0, bannerT = 0;
function toast(t, d = 3) { hud.toast.textContent = t; hud.toast.classList.add('show'); toastT = d; }
function banner(t, sub = '', d = 3.5, cls = '') {
  hud.banner.innerHTML = `<b>${t}</b>${sub ? `<small>${sub}</small>` : ''}`; hud.banner.className = 'show ' + cls; bannerT = d;
}
function objective(t) { setText(hud.obj, t || ''); setStyle(hud.obj, 'display', t ? 'block' : 'none'); }
function addCash(n) { G.cash = Math.max(0, G.cash + n); }

// dialog
const dlg = $('dialog');
function say(lines, then) {
  G.dialog = { lines: lines.slice(), then };
  showLine();
}
function showLine() {
  const [who, text] = G.dialog.lines[0];
  dlg.innerHTML = `<div class="who">${who}</div><div class="txt">${text}</div><i>▼</i>`;
  dlg.style.display = 'block';
}
function advanceDialog() {
  G.dialog.lines.shift();
  Sfx.blip(660);
  if (G.dialog.lines.length) return showLine();
  const t = G.dialog.then; G.dialog = null; dlg.style.display = 'none'; P.lock = 0.7;
  if (t) t();
}
dlg.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (G.dialog) advanceDialog(); });

// ---------------- particles ----------------
// All puffs live in two InstancedMeshes (normal + additive blend) drawn with a camera-facing billboard shader; each
// instance carries position + size (instanceMatrix), colour (instanceColor) and [alpha, textured] (aExtra). The
// additive mesh also draws every car's headlight / taillight halos at night (appended in onBeforeRender, after the
// terrain lift has placed the cars). Positions are world space, so the terrain lift is baked in here (noLift).
const parts = [];
const PART_KINDS = {
  smoke: { c: new THREE.Color(0x4a4a4e), a: 0.7, add: 0, map: 1 },
  fire: { c: new THREE.Color(0xff8a20).multiplyScalar(2), a: 1, add: 1, map: 1 },
  foam: { c: new THREE.Color(0xffffff), a: 0.9, add: 0, map: 1 },
  water: { c: new THREE.Color(0x6fd0ff), a: 0.8, add: 0, map: 1 },
  dust: { c: new THREE.Color(0x9a8c74), a: 0.6, add: 0, map: 1 },
  cash: { c: new THREE.Color(0x5fd35f), a: 1, add: 0, map: 0 },
};
function billboardMesh(max, blending, order) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('aExtra', new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2));
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]); uniforms.map = { value: T.glow };
  const mt = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, blending, fog: true,
    vertexShader: `attribute vec2 aExtra; varying vec2 vUv; varying vec4 vCol; varying float vMap;
      #include <fog_pars_vertex>
      void main() { vUv = uv; vCol = vec4(instanceColor, aExtra.x); vMap = aExtra.y;
        vec4 mvPosition = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
        mvPosition.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec4 vCol; varying float vMap;
      #include <fog_pars_fragment>
      void main() { vec4 t = mix(vec4(1.0), texture2D(map, vUv), vMap);
        gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  const mesh = new THREE.InstancedMesh(geo, mt, max);
  mesh.setColorAt(0, PART_KINDS.smoke.c); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = order;
  mesh.userData.noLift = true; mesh.raycast = () => {}; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  return mesh;
}
const partMesh = [billboardMesh(128, THREE.NormalBlending, 5), billboardMesh(128 + 4 * 48, THREE.AdditiveBlending, 6)];
const _pm = new THREE.Matrix4(), _pc = new THREE.Color(), _pv = new THREE.Vector3();
function setInst(mesh, i, x, y, z, s, c, a, map) {
  _pm.makeScale(s, s, 1); _pm.setPosition(x, y, z); mesh.setMatrixAt(i, _pm); mesh.setColorAt(i, c);
  mesh.geometry.attributes.aExtra.setXY(i, a, map);
}
function flushInst(mesh, n) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.geometry.attributes.aExtra.needsUpdate = true; }
let partN = 0; // live additive particles this frame; car halos are appended after them
partMesh[1].onBeforeRender = () => {
  const mesh = partMesh[1]; let n = partN;
  if (isNight) for (const c of cars) { const bm = c.mesh.userData.body.matrixWorld; for (const q of c.mesh.userData.glows) { if (n >= mesh.instanceMatrix.count) break; _pv.set(q.x, q.y, q.z).applyMatrix4(bm); setInst(mesh, n++, _pv.x, _pv.y, _pv.z, q.s, _pc.set(q.c).multiplyScalar(0.8), 1, 1); } }
  flushInst(mesh, n);
};
function puff(kind, x, y, z, vx = 0, vy = 1, vz = 0, size = 0.6, life = 1) {
  let p = parts.find((q) => q.life <= 0);
  if (!p) { if (parts.length > 120) return; p = {}; parts.push(p); }
  Object.assign(p, { x, y, z, h: TER.heightAt(x, z), vx, vy, vz, size, life, max: life, kind });
}
function updateParts(dt) {
  let n0 = 0, n1 = 0;
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.kind === 'water' || p.kind === 'cash') p.vy -= 9 * dt;
    const k = p.life / p.max, K = PART_KINDS[p.kind], s = p.size * (p.kind === 'smoke' ? 2 - k : 0.6 + k * 0.4);
    if (K.add) setInst(partMesh[1], n1++, p.x, p.y + p.h, p.z, s, K.c, K.a, K.map); else setInst(partMesh[0], n0++, p.x, p.y + p.h, p.z, s, K.c, K.a, K.map);
  }
  flushInst(partMesh[0], n0); partN = n1;
}
// ---------------- player ----------------
const cat = makeCat();
scene.add(cat);
const P = { x: places.spawn.x, z: places.spawn.z, y: 0, vy: 0, yaw: Math.PI, vx: 0, vz: 0, ph: 0, punch: 0, car: null, down: 0, invuln: 0, lock: 0 };
if (SV && SV.x !== undefined && !SV.inside && Math.abs(+SV.x) < LIMIT && Math.abs(+SV.z) < LIMIT) { P.x = +SV.x; P.z = +SV.z; P.yaw = +SV.yaw || 0; camYaw = P.yaw + Math.PI; } // back where you saved

// ---------------- cars ----------------
const cars = [];
const CAR_NAMES = { sedan: 'Meridian', hatch: 'Pipsqueak', wagon: 'Homestead', pickup: 'Haulmark', suv: 'HOA Enforcer', golfcart: 'Fairway' };
const PAINT = [0xc0392b, 0x2e6fbf, 0xe8e8e8, 0x2a2a2e, 0x3a8f5a, 0xe0b030, 0x8e5bb0, 0xa04020, 0x6a8090, 0xd86a9a];
function spawnCar(type, x, z, yaw, o = {}) {
  const color = o.color ?? PAINT[(Math.random() * PAINT.length) | 0];
  const mesh = makeCar(type, color, o);
  scene.add(mesh);
  const c = { mesh, type, spec: CAR_TYPES[type], x, z, yaw, vx: 0, vz: 0, speed: 0, hp: o.hp ?? 100, fuel: o.fuel ?? (o.role ? 100 : 35 + Math.random() * 65), driver: o.driver || null, ai: null, wheel: 0, steer: 0, dead: false, fire: 0, role: o.role || null, stuck: 0, rev: 0, honk: 0 };
  cars.push(c);
  return c;
}
function removeCar(c) { scene.remove(c.mesh); cars.splice(cars.indexOf(c), 1); const u = c.mesh.userData; u.paint.dispose(); if (u.bar) for (const b of u.bar) b.dispose(); }

// road graph helpers (world.js NODES/ADJ: a hand-laid road network, not a grid)
let NN = NODES.length; RD.onRoads.push(() => { NN = NODES.length; }); // engine: roads are editable
function nearestNode(x, z) {
  let b = 0, bd = 1e9;
  for (let i = 0; i < NN; i++) { const d = Math.hypot(NODES[i].x - x, NODES[i].z - z); if (d < bd) { bd = d; b = i; } }
  return b;
}
function roadOpts(i, from) {
  const all = ADJ[i].filter((e) => !e.nt);
  const fwd = all.filter((e) => e.n !== from);
  return fwd.length ? fwd : all.length ? all : RD.roadRescue(i); // engine: roads can be deleted
}
// a = {from, to, off}: keep to the right of the road, `off` metres from its centre line
// steer toward a point `look` metres further along the lane; returns [x, z, metres left to the lane's end]
function laneTarget(a, x, z, look) {
  const A = NODES[a.from], B = NODES[a.to], L = Math.hypot(B.x - A.x, B.z - A.z) || 1;
  const dx = (B.x - A.x) / L, dz = (B.z - A.z) / L, sx = A.x - dz * a.off, sz = A.z + dx * a.off;
  const along = (x - sx) * dx + (z - sz) * dz, t = Math.max(0, Math.min(L, along + look));
  return [sx + dx * t, sz + dz * t, Math.hypot(sx + dx * L - x, sz + dz * L - z)];
}
function pickNext(a) {
  const opts = roadOpts(a.to, a.from), e = opts[(Math.random() * opts.length) | 0];
  a.from = a.to; a.to = e.n; a.w = e.w;
  a.off = a.ped ? a.side * (e.w / 2 + 1.3) : e.w / 4;
}
function randomLane() {
  const i = (Math.random() * NN) | 0, opts = roadOpts(i, -1);
  if (!opts.length) return null;
  const e = opts[(Math.random() * opts.length) | 0];
  return { from: i, to: e.n, w: e.w };
}
function spawnTraffic(type) {
  for (let tries = 0; tries < 30; tries++) {
    const a = randomLane(); if (!a) continue;
    a.off = a.w / 4;
    const A = NODES[a.from], B = NODES[a.to], L = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
    const t = 0.3 + Math.random() * 0.4;
    const x = A.x + (B.x - A.x) * t - dz * a.off, z = A.z + (B.z - A.z) * t + dx * a.off;
    if (Math.hypot(x - P.x, z - P.z) < 25 || cars.some((c) => Math.hypot(c.x - x, c.z - z) < 10)) continue;
    const c = spawnCar(type, x, z, Math.atan2(dx, dz), { driver: 'ai' });
    c.ai = { ...a, cruise: 8 + Math.random() * 4 };
    return c;
  }
}

// ---------------- peds ----------------
const peds = [];
function attachPed(p) {
  // put a walker on the shoulder of the nearest road
  const n = nearestNode(p.x, p.z), opts = roadOpts(n, -1), e = opts[(Math.random() * opts.length) | 0];
  p.lane = { ped: true, from: n, to: e.n, w: e.w, side: Math.random() < 0.5 ? 1 : -1 };
  p.lane.off = p.lane.side * (e.w / 2 + 1.3);
}
function removePed(p) { scene.remove(p.mesh); if (p.bar) scene.remove(p.bar.sp); peds.splice(peds.indexOf(p), 1); }
function spawnPed(o = {}) {
  const mesh = o.mesh || makeHuman(o.look || {});
  scene.add(mesh);
  const p = { mesh, kind: o.kind || 'human', x: 0, z: 0, yaw: 0, state: o.state || 'walk', t: 0, ph: Math.random() * 6, speed: 1.2 + Math.random() * 0.5,
    r: o.r || 0.35, npc: o.npc || null, home: o.home || null, vx: 0, vz: 0, spin: 0 };
  if (o.at) { p.x = o.at.x; p.z = o.at.z; }
  else {
    let a = null; while (!a) a = randomLane();
    const A = NODES[a.from], B = NODES[a.to], t = Math.random();
    const L = Math.hypot(B.x - A.x, B.z - A.z) || 1, side = (Math.random() < 0.5 ? 1 : -1) * (a.w / 2 + 1.3);
    p.x = A.x + (B.x - A.x) * t - (B.z - A.z) / L * side; p.z = A.z + (B.z - A.z) * t + (B.x - A.x) / L * side;
    p.lane = { ped: true, from: a.from, to: a.to, w: a.w, side: Math.sign(side), off: side };
  }
  if (p.state === 'walk' && !p.lane) attachPed(p);
  if (o.yaw !== undefined) p.yaw = o.yaw;
  peds.push(p);
  return p;
}

// ---------------- world population ----------------
for (let k = 0; k < 12; k++) spawnTraffic(['sedan', 'hatch', 'sedan', 'pickup', 'wagon'][k % 5]);
const drives = places.drives.slice().sort(() => Math.random() - 0.5);
for (let k = 0; k < 9; k++) {
  const d = drives[k];
  spawnCar(['sedan', 'hatch', 'pickup', 'wagon', 'sedan'][k % 5], d.x, d.z, d.ry, {});
}
spawnCar('golfcart', places.hoaLot.x - 3, places.hoaLot.z, 0, { color: 0xffffff, canopy: 0x1e2a44, lightbar: true });
for (let k = 0; k < 20; k++) spawnPed({});
// park raccoons
for (let k = 0; k < 4; k++) {
  const h = places.raccoonHome;
  const p = spawnPed({ mesh: makeRaccoon(), kind: 'raccoon', state: 'wander', at: { x: h.x + (Math.random() - 0.5) * h.r, z: h.z + (Math.random() - 0.5) * h.r }, r: 0.3 });
  p.speed = 1.5; p.home = h;
}
// story NPCs
const NPC = {};
// a spot `d` metres in front of a place that faces `yaw`
const ahead = (pl, d, side = 0) => ({ x: pl.x + Math.sin(pl.yaw) * d + Math.cos(pl.yaw) * side, z: pl.z + Math.cos(pl.yaw) * d - Math.sin(pl.yaw) * side });
NPC.nana = spawnPed({ look: { skin: 0xf1d0b5, shirt: 0xe8e0f0, pants: 0x6a4a8a, hair: 0xeeeeee, cardigan: 0x8a5ab0, bun: true, glasses: true }, state: 'idle', at: ahead(places.nana, -0.5, 1.2), yaw: places.nana.yaw, npc: 'nana' });
NPC.gary = spawnPed({ look: { skin: 0xf0c0a0, shirt: 0xf6f6f6, pants: 0xc8b48a, hair: 0x8a6a40, visor: 0x1e2a44, clipboard: true }, state: 'idle', at: ahead(places.gary, -0.6, 1.4), yaw: places.gary.yaw, npc: 'gary' });
{
  const m = makeRaccoon(); m.scale.setScalar(1.35);
  m.userData.head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 6), mat(0x8a2020)));
  m.userData.head.children.at(-1).position.y = 0.12;
  NPC.ricky = spawnPed({ mesh: m, kind: 'raccoon', state: 'idle', at: { x: places.park.x, z: places.park.z }, yaw: 0, npc: 'ricky' });
}
for (let k = 0; k < 3; k++) {
  const p = spawnPed({ look: { scale: 0.75, cap: [0xe03030, 0x2e86c1, 0x27ae60][k], watergun: true }, state: 'idle', at: ahead(places.quik, -(k % 2) * 0.8, k * 1.2 - 1), yaw: places.quik.yaw, npc: k === 1 ? 'kids' : 'kid' });
  if (k === 1) NPC.kids = p;
}

// pickups: cash, tuna, hidden yarn balls
const pickups = [];
const tunaMat = mat(0xc0c8d0), cashMat = mat(0x4fbf4f), yarnMat = lambert({ color: 0xffc830, emissive: 0x553300 });
const tunaGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 8), cashGeo = new THREE.BoxGeometry(0.4, 0.12, 0.22), yarnGeo = new THREE.IcosahedronGeometry(0.28, 1); // shared by every pickup
function addPickup(kind, x, z, o = {}) {
  let mesh;
  if (kind === 'tuna') { mesh = new THREE.Mesh(tunaGeo, tunaMat); }
  else if (kind === 'cash') { mesh = new THREE.Mesh(cashGeo, cashMat); }
  else if (kind === 'yarn') { mesh = new THREE.Mesh(yarnGeo, yarnMat); }
  else if (kind === 'bag') { mesh = makeTrashBag(); }
  mesh.position.set(x, 0.5, z); scene.add(mesh);
  const p = { kind, x, z, mesh, alive: true, respawn: o.respawn ?? 0, t: 0, amt: o.amt || 0, id: o.id };
  pickups.push(p);
  return p;
}
for (const d of places.doors.filter((_, i) => i % 4 === 1)) addPickup('tuna', d[0], d[1], { respawn: 60 });
for (const [x, z] of places.cashSpots) addPickup('cash', x, z, { respawn: 90, amt: 40 });
const YARN = [places.clearing, places.crypt, places.tower, places.endzone, places.dock, places.garyBack, places.well, { x: places.quik.x + 14, z: places.quik.z - 12 }, places.green, { x: places.exitNorth.x + 3, z: places.exitNorth.z + 4 }].map((p) => [p.x, p.z]);
YARN.forEach(([x, z], i) => { if (!G.yarn.includes(i)) addPickup('yarn', x, z, { id: i }); });

// mission markers
const markerGeo = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10, 1, true), icoGeo = new THREE.OctahedronGeometry(0.35, 0), icoMats = {};
const markMats = { mission: basic({ color: 0xffd23f, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), check: basic({ color: 0xff3b6b, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }), save: basic({ color: 0x5fd0ff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }) };
function makeMarker(kind, x, z, r = 1.1) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(markerGeo, markMats[kind]); c.position.y = 1.1; c.scale.set(r / 1.1, 1, r / 1.1); g.add(c);
  const ico = new THREE.Mesh(icoGeo, icoMats[kind] ||= basic({ color: markMats[kind].color })); ico.position.y = 2.8; g.add(ico);
  g.position.set(x, 0, z); scene.add(g);
  g.userData.ico = ico;
  return g;
}
const giverMarks = {
  nana: makeMarker('mission', ahead(places.nana, 1.8).x, ahead(places.nana, 1.8).z),
  kids: makeMarker('mission', ahead(places.quik, 2.2).x, ahead(places.quik, 2.2).z),
  ricky: makeMarker('mission', places.park.x, places.park.z + 2),
  gary: makeMarker('mission', ahead(places.gary, 2.2).x, ahead(places.gary, 2.2).z),
};
const saveMark = makeMarker('save', places.rv.x + 1.4, places.rv.z + 0.5, 0.8);
let checkMark = makeMarker('check', 0, 0, 2.5); checkMark.visible = false;
// waypoint beacon: a tall glowing column + pulsing ground ring so the drop-off reads from across town
const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3b6b, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 60, 12, 1, true), beamMat); beam.position.y = 30; beam.renderOrder = 5; checkMark.add(beam);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3b6b, transparent: true, opacity: 0.7, depthWrite: false, fog: false, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.5, 32), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; checkMark.add(ring);
checkMark.userData.ring = ring;

// ---------------- heat / patrol ----------------
function addHeat(n, why) {
  const before = G.heat;
  G.heat = Math.min(5, G.heat + n); G.seenT = 0;
  if (G.heat > before) { toast(why ? `HOA violation: ${why}` : 'HOA violation!'); Sfx.siren(); }
}
function patrols() { return cars.filter((c) => c.role === 'patrol' && !c.dead); }
let patrolList = []; // P13: patrols() filtered once per frame in updateHeat (refreshed there after spawns / retires); the minimap and siren reuse it
// step 1 m along the line through the world colliders (the police.js lineClear idea): true when nothing is in the way
function lineOfSight(x0, z0, x1, z1, y = 1.1) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L));
  for (let i = 1; i < n; i++) { const k = i / n; if (blocked(x0 + (x1 - x0) * k, y, z0 + (z1 - z0) * k)) return false; }
  return true;
}
// an HOA cart stands down: it becomes traffic and drives off along the roads
function retirePatrol(c) {
  const n = nearestNode(c.x, c.z), o = roadOpts(n, -1)[0];
  if (!o) return removeCar(c);
  c.role = null; c.driver = 'ai'; c.nav = null; c.topMul = 1; c.ai = { from: n, to: o.n, w: o.w, off: o.w / 4, cruise: 6 + Math.random() * 3 };
}
function spawnPatrol() {
  // far-ish road node, out of view
  const opts = [];
  for (let i = 0; i < NN; i++) {
    const d = Math.hypot(NODES[i].x - P.x, NODES[i].z - P.z);
    if (d > 55 && d < 120 && roadOpts(i, -1).length) opts.push(i);
  }
  if (!opts.length) return;
  const n = opts[(Math.random() * opts.length) | 0], N0 = NODES[n];
  const type = G.heat >= 2 ? 'suv' : 'golfcart';
  const c = spawnCar(type, N0.x, N0.z, Math.atan2(P.x - N0.x, P.z - N0.z), { color: 0xffffff, canopy: 0x1e2a44, lightbar: true, driver: 'patrol', role: 'patrol', label: hoaLabel });
  c.nav = { n };
}
const hoaLabel = T.sign('HOA', '#ffffff', '#1e2a44', 32, 10);

// ---------------- missions ----------------
const NAMES = ['the Hendersons', 'the Pattersons', 'Doug', 'the Kowalskis', 'Mrs. Ortega', 'the Nguyens'];
let mission = null;
function startMission(m) { mission = m; G.mission = m; m.t = 0; m.start(); for (const k in giverMarks) giverMarks[k].visible = false; }
function endMission(pass, msg) {
  const m = mission; mission = null; G.mission = null;
  checkMark.visible = false; G.check = null; objective(''); setStyle(hud.timer, 'display', 'none');
  if (m.cleanup) m.cleanup();
  if (pass) {
    G.done[m.id] = true; addCash(m.reward); save();
    banner('MISSION PASSED', `${msg || ''} +$${m.reward}`, 4, 'pass'); Sfx.jingle();
  } else banner('MISSION FAILED', msg || '', 3.5, 'fail');
}
function setCheck(x, z, r = 2.5, label = '') { checkMark.visible = true; checkMark.position.set(x, 0, z); checkMark.scale.set(r / 2.5, 1, r / 2.5); G.check = { x, z, r, label }; }

const MISSIONS = {
  nana: () => ({
    id: 'nana', title: 'Casserole Run', reward: 150,
    start() {
      const d = places.nanaDrive;
      this.car = cars.find((c) => c.role === 'nana' && !c.dead) || spawnCar('wagon', d.x, d.z, Math.PI, { color: 0x8a6a4a, role: 'nana' });
      if (P.car !== this.car) { const c = this.car; c.x = d.x; c.z = d.z; c.yaw = Math.PI; c.vx = c.vz = c.speed = 0; c.fire = 0; c.hp = Math.max(c.hp, 60); } // back on Nana's drive, wherever the last run left it
      const homes = places.drives.slice().sort(() => Math.random() - 0.5).filter((h) => Math.hypot(h.x - d.x, h.z - d.z) > 40).slice(0, 3);
      this.stops = homes.map((h, i) => ({ x: h.x, z: h.z, who: NAMES[(i * 2 + ((Math.random() * 2) | 0)) % NAMES.length] }));
      this.timer = 0; this.stage = 'car';
      objective("Get in Nana's wagon.");
    },
    update(dt) {
      if (this.car.dead) return endMission(false, 'The casseroles are toast.');
      if (P.car !== this.car) { checkMark.visible = false; G.check = { x: this.car.x, z: this.car.z, r: 1, blipOnly: true, label: "Nana's wagon", col: '#ffd23f' }; }
      else if (this.stage !== 'car' && (!G.check || G.check.blipOnly)) this.next();
      if (this.stage === 'car') { if (P.car === this.car) { this.stage = 'drive'; this.timer = 130; this.next(); } return; }
      this.timer -= dt;
      if (this.timer <= 0) return endMission(false, 'The casseroles went cold.');
      if (P.car !== this.car) objective("Get back in Nana's wagon!");
      else objective(`Deliver a casserole to ${this.stops[0].who}. (${3 - this.stops.length + 1}/3)`);
      const s = this.stops[0];
      if (G.check && !G.check.blipOnly) G.check.hint = Math.abs(this.car.speed) >= 6 && Math.hypot(this.car.x - s.x, this.car.z - s.z) < 18 ? 'SLOW DOWN' : '';
      if (P.car === this.car && Math.hypot(this.car.x - s.x, this.car.z - s.z) < 4.5 && Math.abs(this.car.speed) < 6) {
        this.stops.shift(); Sfx.blip(880); addCash(10);
        toast(`${s.who}: "Tell Nana thank you!" (+$10 tip)`);
        if (!this.stops.length) return endMission(true, 'Nana is so proud.');
        this.timer += 15; this.next();
      }
    },
    next() { const s = this.stops[0]; setCheck(s.x, s.z, 3, `${s.who} (${4 - this.stops.length}/3)`); },
  }),
  kids: () => ({
    id: 'kids', title: 'Slurpee Sprint', reward: 250,
    start() {
      this.cps = places.raceRoute.map((p) => ({ ...p }));
      const st = places.raceStart, fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), rx = fz, rz = -fx;
      const at = (side, back) => [st.x + rx * side - fx * back, st.z + rz * side - fz * back];
      this.car = spawnCar('hatch', ...at(2.6, 0), st.yaw, { color: 0xffd000, role: 'race' });
      enterCar(this.car, true);
      this.rivals = [
        spawnCar('hatch', ...at(-2.6, 0), st.yaw, { color: 0xe03030, role: 'race', driver: 'racer' }),
        spawnCar('pickup', ...at(-2.6, 7), st.yaw, { color: 0x2e86c1, role: 'race', driver: 'racer' }),
      ];
      for (const r of this.rivals) { r.cp = 0; r.skill = 0.86 + Math.random() * 0.06; }
      this.cp = 0; this.count = 3.5; this.place = 1;
      setCheck(this.cps[0].x, this.cps[0].z, 5);
      objective('Race the Quik Stop Kids. Hit every checkpoint!');
    },
    update(dt) {
      if (this.count > 0) {
        const before = Math.ceil(this.count); this.count -= dt;
        const now = Math.ceil(this.count);
        if (now !== before) { banner(now > 0 ? String(now) : 'GO!', '', 0.8); Sfx.blip(now > 0 ? 440 : 880); }
        for (const c of [this.car, ...this.rivals]) { c.vx = c.vz = 0; c.speed = 0; }
        return;
      }
      if (this.car.dead) return endMission(false, 'Wrecked.');
      this.out = P.car !== this.car ? (this.out || 0) + dt : 0; // grace: a cuff or a blast throws you out, you get a few seconds to climb back in
      if (this.out > 6) return endMission(false, 'You left your ride.');
      for (const r of this.rivals) {
        if (r.cp >= this.cps.length) continue;
        const c = this.cps[r.cp];
        if (Math.hypot(r.x - c.x, r.z - c.z) < 7) { r.cp++; if (r.cp >= this.cps.length) { r.done = true; } }
      }
      const c = this.cps[this.cp];
      if (Math.hypot(this.car.x - c.x, this.car.z - c.z) < 6) {
        this.cp++; Sfx.blip(900);
        if (this.cp >= this.cps.length) {
          const ahead = this.rivals.filter((r) => r.done).length;
          return ahead ? endMission(false, `You came in #${ahead + 1}. You owe them Slurpees.`) : endMission(true, 'First place! The kids are buying.');
        }
        const n = this.cps[this.cp]; setCheck(n.x, n.z, 5);
      }
      const prog = (o, cp) => cp * 1000 - Math.hypot(o.x - this.cps[Math.min(cp, this.cps.length - 1)].x, o.z - this.cps[Math.min(cp, this.cps.length - 1)].z);
      const me = prog(this.car, this.cp);
      this.place = 1 + this.rivals.filter((r) => prog(r, r.cp) > me).length;
      objective(this.out > 0 ? `Get back in the car! (${Math.ceil(6 - this.out)})` : `Slurpee Sprint: checkpoint ${this.cp + 1}/${this.cps.length}. Position ${this.place}/3`);
    },
    cleanup() { for (const r of this.rivals) { r.driver = null; r.role = null; } if (this.car) this.car.role = null; },
  }),
  ricky: () => ({
    id: 'ricky', title: 'Trash Panda Heist', reward: 200,
    start() {
      const spots = places.drives.slice().sort(() => Math.random() - 0.5).slice(0, 6);
      this.bags = spots.map((s, i) => addPickup('bag', s.x + 1.8, s.z, { id: 'bag' + i }));
      this.got = 0; this.timer = 200; this.stage = 'collect';
      objective('Collect 6 bags of the good trash.');
    },
    update(dt) {
      this.timer -= dt;
      if (this.timer <= 0) return endMission(false, 'Garbage day came and went.');
      const got = this.bags.filter((b) => !b.alive).length;
      if (got !== this.got) {
        this.got = got;
        if (got === 3) { toast("That one was Gary's personal bin!"); addHeat(2, 'bin tampering'); }
      }
      if (this.stage === 'collect') {
        objective(`Collect the good trash. (${got}/6)`);
        const near = this.bags.filter((b) => b.alive).sort((a, b) => Math.hypot(a.x - px(), a.z - pz()) - Math.hypot(b.x - px(), b.z - pz()))[0];
        if (near) G.check = { x: near.x, z: near.z, r: 1, blipOnly: true };
        if (got >= 6) { this.stage = 'return'; setCheck(places.park.x, places.park.z + 2, 2.5); objective('Bring the trash to Big Ricky in Lakeside Park.'); }
      } else if (Math.hypot(px() - places.park.x, pz() - places.park.z - 2) < 3.5) {
        endMission(true, 'Big Ricky: "Exquisite garbage."');
      }
    },
    cleanup() { for (const b of this.bags) { if (b.alive) scene.remove(b.mesh); b.alive = false; b.respawn = 0; } G.check = null; },
  }),
  gary: () => ({
    id: 'gary', title: 'Final Notice', reward: 500,
    start() {
      const d = places.gary;
      this.cart = spawnCar('golfcart', places.garyCart.x, places.garyCart.z, places.garyCart.yaw, { color: 0xffffff, canopy: 0x2050a0, lightbar: true, driver: 'flee', role: 'gary', hp: 140 });
      NPC.gary.mesh.visible = false;
      G.heat = Math.max(G.heat, 2); G.seenT = 0; Sfx.siren();
      objective("Wreck Gary's golf cart before he files the paperwork!");
    },
    update() {
      if (this.cart.dead) return endMission(true, 'Gary resigned. The RV stays.');
      G.check = { x: this.cart.x, z: this.cart.z, r: 1, blipOnly: true };
      G.heat = 2; // HOA only for the finale: no PD cruisers crashing Gary's paperwork
      objective(`Wreck Gary's golf cart! (${Math.max(0, Math.round(this.cart.hp / 1.4))}%)`);
    },
    cleanup() { G.check = null; NPC.gary.mesh.visible = true; },
  }),
};

const INTROS = {
  nana: [['Nana', "There's my favorite little soldier! Are you eating? You look thin under all that armor."], ['Nana', "I made casseroles for the neighbors but my hip won't do stairs today."], ['Nana', "Take my wagon. Three houses. And don't you dare scratch it, sweetie."]],
  kids: [['Quik Stop Kid', 'Yo, NOD cat. You think that helmet makes you fast?'], ['Quik Stop Kid', "Race us around town. Loser buys Slurpees for a month."], ['Quik Stop Kid', "We left you a car. It's my mom's. Don't tell her."]],
  ricky: [['Big Ricky', 'Psst. Cat. The HOA put locks on every bin in Maple Grove.'], ['Big Ricky', 'My family is starving for the good stuff. Leftover lasagna. Pizza crusts.'], ['Big Ricky', 'Six bags. Curbside. Bring them here. Nobody needs to know.']],
  gary: [['Gary', 'Well, well. The cat with the RV. Do you know what bylaw 14-C says?'], ['Gary', 'No recreational vehicles. No unlicensed felines. No fun after 9 PM.'], ['Gary', "I'm filing the eviction myself. Patrol! Seize that animal!"]],
};
const DONE_LINES = {
  nana: [['Nana', 'You were wonderful, sweetie. Take a tuna can for the road.']],
  kids: [['Quik Stop Kid', "Okay okay, you're fast. Rematch never."]],
  ricky: [['Big Ricky', 'The family eats well tonight. You are one of us now, cat.']],
  gary: [['Gary', '...I have nothing further.']],
};
function talkTo(id) {
  if (jobs.talk(id)) return; // content: replays + side jobs (src/js/jobs.js)
  if (G.done[id]) return say(DONE_LINES[id]);
  if (id === 'gary' && !(G.done.nana && G.done.kids && G.done.ricky)) {
    return say([['Gary', "I've got my eye on you. Help the neighborhood and maybe, MAYBE, I won't tow that RV."], ['Gary', '(Finish the jobs for Nana, Big Ricky and the Quik Stop Kids first.)']]);
  }
  say(INTROS[id], () => startMission(MISSIONS[id]()));
}

// ---------------- swimming ----------------
// Water = every water polygon (the lake + any water drawn in the editor). The player walks straight in and paddles,
// sunk to the neck, slower, no jumping. Cars and peds are still kept out by the water collider.
const SWIM_OK = { swim: true }, SWIM_SINK = 0.42;
function inPoly(poly, x, z) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; } return ins; }
let waterCache = null, waterT = 0;
function waterAt(x, z) {
  if (!waterCache || (waterT -= 1) <= 0) { waterT = 60; waterCache = waterPolys().map((w) => TER.polyEngine(w.q)); }  // refresh ~1/s so editor water counts
  for (const w of waterCache) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && inPoly(w.poly, x, z)) return true;
  return false;
}
function updateSwim(dt) {
  const was = P.swim;
  P.swim = P.y <= 0.05 && waterAt(P.x, P.z);
  if (P.swim && !was) { P.vy = 0; P.y = 0; P.jumps = 0; Sfx.blip(160); if (!G.swamOnce) { G.swamOnce = true; toast('Goobles is swimming. He hates every second of it.'); } }
  if (was && !P.swim) Sfx.blip(240);
}

// ---------------- fuel ----------------
// Only the player's car burns gas. Full tank = ~4 min flat out. Stop under the Quik Stop canopy to fill up ($1 per 5%).
function atPumps(x, z) { const q = places.quik; if (!q) return false; const cx = q.x + 3, cz = q.z + 3.5 + 4; return Math.abs(x - cx) < 7 && Math.abs(z - cz) < 4; }
function updateFuel(c, thr, dt) {
  if (c.fuel === undefined) c.fuel = 100;
  if (c.fuel > 0) c.fuel = Math.max(0, c.fuel - dt * (0.03 + 0.4 * Math.abs(thr)));
  if (c.fuel < 20 && !c.lowWarn) { c.lowWarn = true; toast('Low on gas. The Quik Stop has pumps.'); }
  if (c.fuel <= 0 && !c.emptyWarn) { c.emptyWarn = true; toast('Out of gas! Coast to the Quik Stop or find another ride.', 4); Sfx.blip(180); }
  if (atPumps(c.x, c.z) && Math.abs(c.speed) < 1 && c.fuel < 100) {
    if (!c.filling) { c.filling = true; c.paid = 0; toast('Filling up...', 2); }
    const add = Math.min(100 - c.fuel, dt * 30);
    c.fuel += add; c.paid += add / 5;
    if (c.paid >= 1) { const n = Math.floor(c.paid); c.paid -= n; addCash(-n); }
    if (c.fuel >= 100) { c.fuel = 100; c.filling = false; c.lowWarn = c.emptyWarn = false; toast('Tank full!', 2); Sfx.blip(880); }
  } else if (c.filling) { c.filling = false; if (c.fuel >= 20) c.lowWarn = c.emptyWarn = false; }
}

// ---------------- car control ----------------
function enterCar(c, silent) {
  if (c.driver === 'ai' || c.driver === 'racer') {
    const victim = spawnPed({ at: { x: c.x + Math.cos(c.yaw) * 2, z: c.z - Math.sin(c.yaw) * 2 }, state: 'flee' });
    victim.t = 6; victim.from = { x: P.x, z: P.z };
    if (!silent) addHeat(1, 'grand theft auto-mobile');
  } else if (c.role === 'patrol') { if (!silent) addHeat(2, 'stealing HOA property'); }
  c.driver = 'player'; c.ai = null; if (c.role === 'patrol') c.role = null;
  P.car = c; cat.visible = false;
  hud.car.textContent = CAR_NAMES[c.type]; hud.car.classList.add('show'); setTimeout(() => hud.car.classList.remove('show'), 2500);
  if (!silent) Sfx.door();
}
function exitCar() {
  const c = P.car;
  const lx = c.x + Math.cos(c.yaw) * (c.spec.wid / 2 + 0.6), lz = c.z - Math.sin(c.yaw) * (c.spec.wid / 2 + 0.6);
  const r = collide(lx, lz, 0.25);
  P.x = r.x; P.z = r.z; P.y = 0; P.yaw = c.yaw;
  c.driver = null; P.car = null; cat.visible = true;
  if (Math.abs(c.speed) > 8) { hurt(12); P.down = 1.2; }
  Sfx.door();
  save();
}
const px = () => (P.car ? P.car.x : P.x), pz = () => (P.car ? P.car.z : P.z);

function drive(c, thr, steer, hand, dt) {
  const S = c.spec;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx;
  let lon = c.vx * fx + c.vz * fz, lat = c.vx * rx + c.vz * rz;
  const top = S.top * (c.topMul || 1);
  if (c.dead) { thr = 0; steer = 0; }
  if (thr > 0) lon += (lon < 0 ? 22 : S.acc * (1 - Math.max(0, lon) / top)) * thr * dt;
  else if (thr < 0) lon += (lon > 0.5 ? -22 : -9 * (1 + lon / 10)) * -thr * dt;
  else lon -= Math.sign(lon) * Math.min(Math.abs(lon), 3.5 * dt);
  if (hand) lon -= Math.sign(lon) * Math.min(Math.abs(lon), 9 * dt);
  lon *= 1 - 0.05 * dt;
  lat *= Math.exp(-(hand ? 1.2 : S.grip) * dt);
  const k = Math.max(-1, Math.min(1, lon / 5));
  c.steer += (steer - c.steer) * Math.min(1, dt * 8);
  c.yaw += c.steer * k * (2.3 - 0.9 * Math.min(1, Math.abs(lon) / top) + (hand ? 0.9 : 0)) * dt;
  const nfx = Math.sin(c.yaw), nfz = Math.cos(c.yaw);
  c.vx = nfx * lon + -nfz * lat; c.vz = nfz * lon + nfx * lat;
  c.speed = lon;
  if (hand && Math.abs(lat) > 3 && Math.random() < 0.5) puff('dust', c.x - nfx * 1.5, 0.2, c.z - nfz * 1.5, 0, 0.5, 0, 0.5, 0.6);
}

function carCircles(c) { // P13: the two body circles are cached per car and refreshed when x / z / yaw change (no per-call arrays)
  let k = c.cc; if (!k) k = c.cc = { x: NaN, z: NaN, yaw: NaN, p: [[0, 0], [0, 0]] };
  if (k.x !== c.x || k.z !== c.z || k.yaw !== c.yaw) {
    const off = c.spec.len / 2 - c.spec.wid / 2, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), p = k.p;
    p[0][0] = c.x + fx * off; p[0][1] = c.z + fz * off; p[1][0] = c.x - fx * off; p[1][1] = c.z - fz * off; k.x = c.x; k.z = c.z; k.yaw = c.yaw;
  }
  return k.p;
}
function carWorld(c, dt) {
  c.x += c.vx * dt; c.z += c.vz * dt;
  if (c.driver === 'ai' && !c.bumped) return; // traffic follows the roads
  const r = c.spec.wid / 2;
  let sx = 0, sz = 0, hitN = null;
  for (const [cx, cz] of carCircles(c)) {
    BRK.carHit(c, cx, cz, r); // engine: knock over lamps + hydrants
    const q = collide(cx, cz, r, 0.5);
    if (q.hit) { sx += q.x - cx; sz += q.z - cz; hitN = [q.nx, q.nz]; }
  }
  if (hitN) {
    c.x += sx; c.z += sz;
    const imp = c.vx * hitN[0] + c.vz * hitN[1];
    if (imp < 0) {
      c.vx -= hitN[0] * imp * 1.35; c.vz -= hitN[1] * imp * 1.35;
      c.vx *= 0.85; c.vz *= 0.85;
      if (-imp > 5) { damageCar(c, (-imp - 4) * 2.2); if (c.driver === 'player') { Sfx.crash(-imp); shake(Math.min(0.6, -imp / 25)); } }
    }
  }
}
function damageCar(c, n) {
  if (c.dead) return;
  c.hp -= n;
  if (c.hp <= 0) { c.hp = 0; c.fire = 3.5; }
}
function explode(c) {
  c.dead = true; c.fire = 0;
  for (const m of c.mesh.userData.body.children) { if (Array.isArray(m.material)) m.material = m.material.map(() => mat(0x26221f)); else if (m.material && m.material.color) m.material = mat(0x26221f); }
  for (let i = 0; i < 26; i++) puff(i % 2 ? 'fire' : 'smoke', c.x, 1, c.z, (Math.random() - 0.5) * 10, 3 + Math.random() * 6, (Math.random() - 0.5) * 10, 1.3, 1.2);
  Sfx.boom(); shake(0.9);
  const d = Math.hypot(px() - c.x, pz() - c.z);
  if (d < 6) { hurt(P.car === c ? 60 : 45 * (1 - d / 6), true); if (P.car === c) exitCar(); P.down = 1.5; }
  for (const p of peds) if (Math.hypot(p.x - c.x, p.z - c.z) < 6) knock(p, p.x - c.x, p.z - c.z, 8);
  for (const o of cars) if (o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 6) damageCar(o, 30);
  if (c.role === 'patrol') addHeat(1, 'blowing up a golf cart');
}

// ---------------- AI ----------------
function steerTo(c, tx, tz) {
  let d = Math.atan2(tx - c.x, tz - c.z) - c.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return d;
}
function inLane(x, z, w, cx, cz, fx, fz, range) { const dx = x - cx, dz = z - cz, f = dx * fx + dz * fz; return f >= 1 && f <= range && Math.abs(dx * fz - dz * fx) < w; }
function blockedAhead(c, range) { // P13: no per-call closure
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), cx = c.x, cz = c.z;
  if (!P.car && inLane(P.x, P.z, 1.6, cx, cz, fx, fz, range)) return 'player';
  for (let i = 0; i < cars.length; i++) { const o = cars[i]; if (o !== c && inLane(o.x, o.z, 2.0, cx, cz, fx, fz, range)) return o === P.car ? 'player' : 'car'; }
  for (let i = 0; i < peds.length; i++) { const p = peds[i]; if (p.state !== 'down' && inLane(p.x, p.z, 1.4, cx, cz, fx, fz, range)) return 'ped'; }
  return false;
}
function trafficAI(c, dt) {
  const a = c.ai;
  let [tx, tz, left] = laneTarget(a, c.x, c.z, 9);
  if (left < 4.5) { pickNext(a); [tx, tz] = laneTarget(a, c.x, c.z, 9); }
  const d = steerTo(c, tx, tz);
  c.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, d * 3 * dt));
  const blk = blockedAhead(c, 9);
  let want = Math.abs(d) > 0.4 ? 5 : a.cruise;
  // two cars nose to nose in a junction: after a few seconds the one waiting longest creeps through
  c.wait = blk === 'car' ? (c.wait || 0) + dt : 0;
  if (blk === 'car' && c.wait > 3 + (c.x * 7 + c.z * 13) % 2) want = 3;
  else if (blk) { want = 0; if (blk === 'player') { c.honk += dt; if (c.honk > 1.5) { c.honk = -3; Sfx.horn(c.x, c.z); } } }
  c.speed += Math.max(-14 * dt, Math.min(6 * dt, want - c.speed));
  if (c.bumped) {
    c.bumped -= dt;
    c.vx *= 1 - 2 * dt; c.vz *= 1 - 2 * dt;
    if (c.bumped <= 0) { c.bumped = 0; const n = nearestNode(c.x, c.z), o = roadOpts(n, -1)[0]; if (o) { a.from = o.n; a.to = n; a.off = o.w / 4; } }
    return;
  }
  c.vx = Math.sin(c.yaw) * c.speed; c.vz = Math.cos(c.yaw) * c.speed;
}
function chaseAI(c, dt, tx, tz, aggressive) {
  // shared controller for patrol / racer / flee
  let d = steerTo(c, tx, tz);
  if (c.rev > 0) { c.rev -= dt; drive(c, -1, -Math.sign(d) || 1, false, dt); return; }
  const thr = Math.abs(d) > 1.6 && Math.abs(c.speed) > 8 ? 0.2 : 1;
  drive(c, thr * (aggressive || 1), Math.max(-1, Math.min(1, d * 2.2)), Math.abs(d) > 1.1 && c.speed > 10, dt);
  if (Math.abs(c.speed) < 1.2) { c.stuck += dt; if (c.stuck > 1.2) { c.stuck = 0; c.rev = 1.1; } } else c.stuck = 0;
}
function navTarget(c, gx, gz) {
  // greedy hop along the road graph toward a goal
  if (!c.nav) c.nav = { n: nearestNode(c.x, c.z) };
  const nv = c.nav, cur = NODES[nv.n];
  if (Math.hypot(cur.x - c.x, cur.z - c.z) < 7) {
    let best = null, bd = 1e9;
    for (const e of roadOpts(nv.n, -1)) {
      const q = NODES[e.n];
      const dd = Math.hypot(q.x - gx, q.z - gz) + (c.lastNav === e.n ? 30 : 0) + Math.random() * (c.role === 'gary' ? 40 : 4);
      if (dd < bd) { bd = dd; best = e.n; }
    }
    c.lastNav = nv.n; if (best !== null) nv.n = best;
  }
  return [NODES[nv.n].x, NODES[nv.n].z];
}
function patrolAI(c, dt) {
  const tx = px(), tz = pz();
  const d = Math.hypot(tx - c.x, tz - c.z);
  let gx, gz;
  if (d < 28) { gx = tx + (P.car ? P.car.vx * 0.4 : 0); gz = tz + (P.car ? P.car.vz * 0.4 : 0); c.nav = null; }
  else [gx, gz] = navTarget(c, tx, tz);
  c.topMul = G.heat >= 4 ? 1.1 : 1;
  if (!P.car && d < 9) { drive(c, 0, 0, true, dt); c.vx *= 1 - 3 * dt; c.vz *= 1 - 3 * dt; }
  else chaseAI(c, dt, gx, gz);
  const seen = d < 25 && lineOfSight(c.x, c.z, tx, tz); // the cart has to actually see you
  if (seen) if (d < 25) G.seenT = 0; // police: easier to slip away
}
function racerAI(c, dt) {
  const m = mission; if (!m || !m.cps || m.count > 0) { drive(c, 0, 0, true, dt); return; }
  if (c.cp >= m.cps.length) { drive(c, 0, 0, true, dt); return; }
  const cp = m.cps[c.cp];
  c.topMul = c.skill;
  chaseAI(c, dt, cp.x, cp.z);
}
function fleeAI(c, dt) {
  // Gary runs from the cat along the roads
  const gx = c.x + (c.x - px()) * 3, gz = c.z + (c.z - pz()) * 3;
  const [tx, tz] = navTarget(c, Math.max(-LIMIT + 15, Math.min(LIMIT - 15, gx)), Math.max(-LIMIT + 15, Math.min(LIMIT - 15, gz)));
  c.topMul = 1.15;
  chaseAI(c, dt, tx, tz);
}

// ---------------- peds ----------------
function knock(p, dx, dz, force) {
  if (p.state === 'down' || p.npc) return false;
  const l = Math.hypot(dx, dz) || 1;
  p.state = 'down'; p.t = 4 + Math.random() * 2; p.vx = dx / l * force; p.vz = dz / l * force; p.spin = 0;
  if (Math.random() < 0.35 && p.kind === 'human') { const c = addPickup('cash', p.x, p.z, { amt: 5 + ((Math.random() * 20) | 0) }); c.temp = true; c.ttl = 40; }
  return true;
}
function updatePed(p, dt) {
  const u = p.mesh.userData;
  if (police.pedHook(p, dt)) return; // police
  p.t -= dt;
  let moving = 0;
  if (p.state === 'down') {
    p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 1 - 3 * dt; p.vz *= 1 - 3 * dt;
    p.spin = Math.min(1, p.spin + dt * 5);
    u.body.rotation.x = -Math.PI / 2 * p.spin; u.body.position.y = 0.15 * p.spin;
    if (p.t <= 0) { p.state = 'flee'; p.t = 4; p.from = { x: px(), z: pz() }; u.body.rotation.x = 0; }
  } else if (p.state === 'flee') {
    const dx = p.x - p.from.x, dz = p.z - p.from.z, l = Math.hypot(dx, dz) || 1;
    p.yaw = Math.atan2(dx / l, dz / l); moving = 4.2;
    if (p.t <= 0) { p.state = p.kind === 'raccoon' ? 'wander' : 'walk'; if (p.kind !== 'raccoon') attachPed(p); }
  } else if (p.state === 'walk') {
    if (!p.lane) attachPed(p);
    let [tx, tz, left] = laneTarget(p.lane, p.x, p.z, 2.5);
    if (left < 1.2) { pickNext(p.lane); [tx, tz] = laneTarget(p.lane, p.x, p.z, 2.5); }
    if (Math.random() < 0.0015) { const l = p.lane; [l.from, l.to] = [l.to, l.from]; }
    const dx = tx - p.x, dz = tz - p.z;
    p.yaw = Math.atan2(dx, dz); moving = p.speed;
  } else if (p.state === 'wander') {
    if (!p.goal || p.t <= 0) { p.goal = { x: p.home.x + (Math.random() - 0.5) * p.home.r * 2, z: p.home.z + (Math.random() - 0.5) * p.home.r * 2 }; p.t = 3 + Math.random() * 5; }
    const dx = p.goal.x - p.x, dz = p.goal.z - p.z;
    if (Math.hypot(dx, dz) > 0.5) { p.yaw = Math.atan2(dx, dz); moving = p.speed; }
  } else if (p.state === 'idle') {
    // face the player when near
    if (Math.hypot(px() - p.x, pz() - p.z) < 6) p.yaw += (Math.atan2(px() - p.x, pz() - p.z) - p.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI > 0 ? dt * 2 : -dt * 2;
  }
  if (moving) {
    p.x += Math.sin(p.yaw) * moving * dt; p.z += Math.cos(p.yaw) * moving * dt;
    const q = collide(p.x, p.z, p.r); p.x = q.x; p.z = q.z;
    p.ph += dt * moving * (p.kind === 'raccoon' ? 9 : 4.2);
  }
  if (p.state !== 'down') animBiped(p.mesh, p.ph, moving ? Math.min(1, moving / 2) : 0, G.time);
  p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.yaw;
}
// ---------------- player update ----------------
function hurt(n, force) {
  if (P.invuln > 0 && !force) return;
  G.hp -= n; P.invuln = 0.4; Sfx.hurt(); shake(0.25); post.comp.uniforms.hurt.value = 1;
  if (G.hp <= 0) knockedOut();
}
function knockedOut() {
  if (jail.active()) { G.hp = Math.max(G.hp, 40); return; } // no KO inside the can: the quest would strand
  G.hp = 0;
  const pen = Math.round(G.cash * 0.1); addCash(-pen); // deduct first so the respawn save keeps it
  respawn('KNOCKED OUT', 'Nana patched you up. (-$' + pen + ')', places.nana);
}
function busted() {
  // HOA citation: fine only, never jail. The PD cuff in police.js is the only route to the can, HOA citations no longer call window.__JAIL.start({ from: 'hoa' }). // jailbreak
  const fine = Math.min(G.cash, 100);
  addCash(-fine);
  respawn('CITED!', `The HOA fined you $${fine}.`, places.rv);
}
function respawn(title, sub, at) {
  if (mission) endMission(false, '');
  if (P.car) exitCar();
  fishing.abort(); jail.end({ quiet: true }); police.dropGun(); // no cast, cell or pistol survives a respawn
  banner(title, sub, 4, 'fail');
  G.heat = 0; G.bustT = 0; G.hp = 100; G.hideT = 0;
  for (const c of patrols()) removeCar(c);
  police.clear(); // police
  P.x = at.x + 1.5; P.z = at.z + 2.5; P.down = 0; P.vy = 0; P.y = 0;
  save();
}

function updatePlayer(dt) {
  P.invuln -= dt; P.lock -= dt;
  if (police.holdPlayer(dt)) return; // police
  let mx = 0, mz = 0;
  if (down('w', 'arrowup')) mz += 1;
  if (down('s', 'arrowdown')) mz -= 1;
  if (down('a', 'arrowleft')) mx += 1;
  if (down('d', 'arrowright')) mx -= 1;
  if (touch.active) { mx = -touch.x; mz = -touch.y; }
  const near = nearestCar();
  if (P.car) {
    const c = P.car;
    let thr = Math.max(-1, Math.min(1, mz)); const st = Math.max(-1, Math.min(1, mx));
    updateFuel(c, thr, dt);
    if (c.fuel <= 0) thr = 0;  // out of gas: coast
    drive(c, thr, st, down(' ', 'b'), dt);
    if (hit('e', 'f', 'enter') && !(P.lock > 0)) exitCar();
    if (hit('h')) Sfx.horn(c.x, c.z, true);
    return;
  }
  if (P.down > 0) {
    P.down -= dt;
    cat.userData.body.rotation.x = -Math.PI / 2 * Math.min(1, P.down * 3); cat.userData.body.position.y = 0.08;
    if (P.down <= 0) cat.userData.body.rotation.x = 0;
    return;
  }
  if (fishing.hold(dt)) return; // fishing: planted while casting, reeling, skinning, eating or in a menu
  const len = Math.hypot(mx, mz);
  const sprint = down('shift') || (touch.active && len > 0.9);
  updateSwim(dt);
  const spd = (P.swim ? (sprint ? 2.6 : 1.8) : sprint ? 6.4 : 3.4) * Math.min(1, len);
  if (len > 0.1) {
    // move relative to the camera
    const fx = Math.sin(camYaw + Math.PI), fz = Math.cos(camYaw + Math.PI);
    const dx = fx * mz + fz * mx, dz = fz * mz - fx * mx;
    const want = Math.atan2(dx, dz);
    let d = want - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    P.yaw += d * Math.min(1, dt * 12);
    P.vx = Math.sin(want) * spd; P.vz = Math.cos(want) * spd;
  } else { P.vx *= 1 - Math.min(1, dt * 12); P.vz *= 1 - Math.min(1, dt * 12); }
  P.x += P.vx * dt; P.z += P.vz * dt;
  P.fl = TER.floorAt(P.x, P.z, P.y); // engine: walkable decks
  // jump
  // multi-jump: Space on the ground jumps, Space again in the air does a double then a triple jump (each higher; the triple flips)
  if (hit(' ') && !P.swim) {
    if (P.y <= (P.fl || 0) + 0.001) { P.vy = 4.6; P.jumps = 1; Sfx.blip(300); }
    else if ((P.jumps || 1) < 3) { P.jumps = (P.jumps || 1) + 1; P.vy = P.jumps === 2 ? 5.6 : 6.6; Sfx.blip(P.jumps === 2 ? 420 : 560); if (P.jumps === 3) P.flip = 0.55; }
  }
  P.vy -= 14 * dt; P.y = Math.max(P.fl || 0, P.y + P.vy * dt); if (P.y === (P.fl || 0) && TER.floorHit && TER.floorHit.bounce) { P.vy = Math.min(16, Math.max(4.5, -P.vy * 0.92 + (down(' ') ? 2.6 : 0))); P.jumps = 1; Sfx.blip(180 + P.vy * 20); } else if (P.y === (P.fl || 0)) { /* engine: decks + trampolines (hold Space to bounce higher) */ P.vy = Math.max(0, P.vy); P.jumps = 0; }
  if (P.flip > 0) { P.flip = P.y > 0 ? P.flip - dt : 0; cat.userData.body.rotation.x = P.flip > 0 ? -Math.PI * 2 * (1 - P.flip / 0.55) : 0; }
  const q = (INT.inside ? INT.collide : collide)(P.x, P.z, 0.22, P.y, SWIM_OK); P.x = q.x; P.z = q.z;
  // car bodies are solid on foot
  for (const c of cars) for (const [cx, cz] of carCircles(c)) {
    const dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz), m = c.spec.wid / 2 + 0.22;
    if (d < m && P.y < 1.1) { P.x = cx + dx / d * m; P.z = cz + dz / d * m; }
  }
  const sp = Math.hypot(P.vx, P.vz);
  P.ph += dt * sp * 4.6;
  // punch
  if (police.armed()) police.gunInput(hit('punch', 'j', 'k')); else if (hit('punch', 'j', 'k') && P.punch <= 0) { P.punch = 0.35; P.punchHit = false; Sfx.swing(); }
  if (P.punch > 0) {
    P.punch -= dt;
    if (!P.punchHit && P.punch < 0.22) {
      P.punchHit = true;
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      police.paw(fx, fz); // police
      for (const p of peds) {
        const dx = p.x - P.x, dz = p.z - P.z;
        if (Math.hypot(dx, dz) < 1.4 && dx * fx + dz * fz > 0) {
          if (p.npc) { toast(p.npc === 'nana' ? 'Nana: "Not in the face, sweetie."' : 'They dodge with practiced ease.'); continue; }
          police.pawPed(p, fx, fz); // police: HP + fight back
        }
      }
    }
  }
  animBiped(cat, P.ph, Math.min(1, sp / 3.4), G.time, P.punch > 0 ? Math.sin((0.35 - P.punch) / 0.35 * Math.PI) : 0);
  if (P.y > (P.fl || 0) + 0.01) { cat.userData.legs[0].rotation.x = 0.6; cat.userData.legs[1].rotation.x = -0.3; }
  if (P.swim) { const k = Math.sin(G.time * (sp > 0.3 ? 9 : 4)) * 0.7; cat.userData.legs[0].rotation.x = k; cat.userData.legs[1].rotation.x = -k; }
  if (hit('e', 'f', 'enter') && !(P.lock > 0) && INT.use()) { pressed.delete('e'); pressed.delete('f'); pressed.delete('enter'); } // interiors
  // interact
  if (hit('e', 'f', 'enter') && !(P.lock > 0)) {
    const npc = nearNpc();
    if (fishing.interact()) { /* shop, cast, cook, skin */ } else if (npc && !mission) talkTo(npc);
    else if (near) enterCar(near);
  }
  if (hit('e', 'f', 'enter') === false && false) {/* noop */}
}
function nearestCar() {
  let best = null, bd = 1e9;
  for (const c of cars) {
    if (c.dead || c.role === 'gary' || (c.role === 'race' && c.driver === 'racer')) continue;
    const d = Math.hypot(c.x - P.x, c.z - P.z);
    if (d < c.spec.len / 2 + 1.6 && d < bd) { bd = d; best = c; }
  }
  return best;
}
function nearNpc() {
  for (const id of ['nana', 'kids', 'ricky', 'gary']) {
    const p = NPC[id];
    if (p.mesh.visible && Math.hypot(p.x - P.x, p.z - P.z) < 2.6) return id;
  }
  for (const [id, m] of Object.entries(giverMarks)) if (m.visible && Math.hypot(m.position.x - P.x, m.position.z - P.z) < 1.6) return id;
  return null;
}

// ---------------- collisions between cars and with peds ----------------
function interactions(dt) {
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
    const A = cars[a], B = cars[b];
    if (Math.abs(A.x - B.x) > 7 || Math.abs(A.z - B.z) > 7) continue;
    const ra = A.spec.wid / 2, rb = B.spec.wid / 2;
    for (const [ax, az] of carCircles(A)) for (const [bx, bz] of carCircles(B)) {
      const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
      if (d >= ra + rb || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, ov = ra + rb - d;
      const ma = A.driver === 'ai' && !A.bumped ? 3 : A.spec.mass, mb = B.driver === 'ai' && !B.bumped ? 3 : B.spec.mass;
      const pa = A.driver === null && Math.hypot(A.vx, A.vz) < 0.1 ? 4 : ma, pb = B.driver === null && Math.hypot(B.vx, B.vz) < 0.1 ? 4 : mb;
      A.x -= nx * ov * pb / (pa + pb); A.z -= nz * ov * pb / (pa + pb);
      B.x += nx * ov * pa / (pa + pb); B.z += nz * ov * pa / (pa + pb);
      const vrel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
      if (vrel < 0) {
        const j = -1.3 * vrel / (1 / ma + 1 / mb);
        A.vx -= j / ma * nx; A.vz -= j / ma * nz; B.vx += j / mb * nx; B.vz += j / mb * nz;
        const dmg = Math.max(0, -vrel - 3) * 2.5;
        damageCar(A, dmg); damageCar(B, dmg);
        for (const C of [A, B]) if (C.driver === 'ai' && -vrel > 3) { C.bumped = 1.5; }
        if ((A === P.car || B === P.car) && -vrel > 3) {
          Sfx.crash(-vrel); shake(Math.min(0.5, -vrel / 30));
          const other = A === P.car ? B : A;
          if (other.role === 'patrol' && -vrel > 6) addHeat(1, 'ramming HOA patrol');
        }
      }
    }
  }
  // cars vs peds and the cat
  for (const c of cars) {
    const sp = Math.hypot(c.vx, c.vz);
    if (sp < 3) continue;
    for (const [cx, cz] of carCircles(c)) {
      const r = c.spec.wid / 2 + 0.3;
      for (const p of peds) {
        if (p.state === 'down' || p.npc) continue;
        if (Math.hypot(p.x - cx, p.z - cz) < r) {
          if (police.runOver(p, c, cx, cz, sp)) { // police: tumble
            Sfx.punch(); if (c === P.car) { if (p.kind === 'human') addHeat(1, 'vehicular yard work'); shake(0.15); }
            c.vx *= 0.9; c.vz *= 0.9;
          }
        }
      }
      if (!P.car && P.down <= 0 && P.y < 1 && Math.hypot(P.x - cx, P.z - cz) < r - 0.1) {
        hurt(Math.min(40, sp * 2)); P.down = 1.4;
        P.x += c.vx * 0.15; P.z += c.vz * 0.15;
      }
    }
  }
  // the cat bumps peds out of the way
  if (!P.car) for (const p of peds) {
    const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz), m = p.r + 0.22;
    if (d < m && d > 1e-4) { p.x = P.x + dx / d * m; p.z = P.z + dz / d * m; }
  }
}

// ---------------- camera ----------------
let shakeAmt = 0;
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
const camPos = new THREE.Vector3(P.x, 3, P.z + 4);
const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3();
function updateCamera(dt) {
  camIdle += dt;
  let tx, ty, tz, dist;
  if (P.car) {
    const c = P.car;
    tx = c.x; ty = 1.3; tz = c.z; dist = 7.2 + Math.min(3, Math.abs(c.speed) / 10);
    if (camIdle > 1.2) {
      const want = c.yaw + (c.speed < -2 ? 0 : Math.PI);
      let d = want - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      camYaw += d * Math.min(1, dt * 3);
      camPitch += (0.2 - camPitch) * Math.min(1, dt * 2);
    }
  } else {
    tx = P.x; ty = 0.65 + P.y * 0.6; tz = P.z; dist = 2.7;
    if (camIdle > 2.5 && Math.hypot(P.vx, P.vz) > 1) {
      let d = P.yaw + Math.PI - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      camYaw += d * Math.min(1, dt * 1.2);
    }
  }
  if (INT.inside) dist = INT.camDist(dist); // interiors
  if (window.__camDist) dist = window.__camDist;
  _t.set(tx, ty, tz);
  _d.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
  // pull in when a wall is in the way
  let k = dist;
  for (let s = 1; s <= 12; s++) {
    const f = dist * s / 12;
    if ((INT.inside ? INT.blocked : blocked)(tx + _d.x * f, ty + _d.y * f, tz + _d.z * f)) { k = Math.max(1.2, f - 0.6); break; }
  }
  const want = _w.copy(_t).addScaledVector(_d, k);
  want.y = Math.max(0.3, want.y);
  if (INT.inside) INT.clampCam(want);
  camPos.lerp(want, Math.min(1, dt * (P.car ? 8 : 14)));
  camera.position.copy(camPos);
  if (shakeAmt > 0) { camera.position.x += (Math.random() - 0.5) * shakeAmt; camera.position.y += (Math.random() - 0.5) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt * 1.5); }
  camera.lookAt(_t);
  if (window.__camO) { camera.position.set(...window.__camO[0]); camera.lookAt(...window.__camO[1]); }
}

// ---------------- day / night + lighting ----------------
const sky = makeSky(); scene.add(sky.mesh);
const moon = new THREE.DirectionalLight(0x8a90d8, 0.4); moon.position.set(-40, 60, -70); scene.add(moon);
// soft light pools on the ground under each lamp
const pools = (() => {
  const g = new THREE.BufferGeometry(), pos = [], uv = [];
  for (const L of lights) {
    if (L.y > 4.5) { const q = new THREE.PlaneGeometry(11, 11); q.rotateX(-Math.PI / 2); q.translate(L.x, 0.1, L.z); const nq = q.toNonIndexed(); pos.push(...nq.attributes.position.array); uv.push(...nq.attributes.uv.array); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, basic({ map: T.glow, color: 0x5a4628, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.visible = false; scene.add(m); return m;
})();
// glow halos (sprites)
const haloGroup = new THREE.Group(); scene.add(haloGroup);
var haloMats;
function haloMat(c) {
  haloMats ||= new Map();
  if (!haloMats.has(c)) haloMats.set(c, new THREE.SpriteMaterial({ map: T.glow, color: new THREE.Color(c).multiplyScalar(0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  return haloMats.get(c);
}
for (const h of halos) { const sp = new THREE.Sprite(haloMat(h.c)); sp.position.set(h.x, h.y, h.z); sp.scale.setScalar(h.s); haloGroup.add(sp); }
const flameSprites = flames.map((f) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flame, color: new THREE.Color(1.6, 1.3, 1.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.position.set(f.x, f.y, f.z); sp.scale.set(0.8, 1.2, 1); scene.add(sp);
  const g = new THREE.Sprite(haloMat(0xff7a20)); g.position.set(f.x, f.y, f.z); g.scale.setScalar(3); scene.add(g);
  return sp;
});
// a pool of real point lights handed to the nearest light sources
const POOL = isTouch ? 5 : 10, pool = []; // P8: fewer per-fragment point lights on phones (fixed after creation)
for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 24, 1.6); scene.add(l); pool.push(l); }
const head = new THREE.SpotLight(0xfff0d0, 0, 45, 0.55, 0.5, 1.2); scene.add(head, head.target);
let poolT = 0, nightK = 1;
function updateLights(dt) {
  poolT -= dt;
  if (poolT <= 0) {
    poolT = 0.25;
    const cx = camera.position.x, cz = camera.position.z;
    const list = lights.filter((L) => L.always || nightK > 0.05).map((L) => [L, (L.x - cx) ** 2 + (L.z - cz) ** 2]).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < POOL; i++) {
      const l = pool[i], e = list[i];
      if (!e) { l.intensity = 0; l.userData.src = null; continue; }
      const L = e[0]; l.position.set(L.x, L.y, L.z); l.color.set(L.c); l.userData.src = L;
    }
  }
  for (const l of pool) {
    const L = l.userData.src; if (!L) continue;
    const k = L.always ? Math.max(0.35, nightK) : nightK;
    l.intensity = 16 * L.i * k * (L.flicker ? 0.8 + Math.random() * 0.4 : 1);
  }
  // headlights on the player's car at night
  if (P.car && nightK > 0.1 && !P.car.dead) {
    const c = P.car, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    head.position.set(c.x + fx * c.spec.len * 0.5, 0.9, c.z + fz * c.spec.len * 0.5);
    head.target.position.set(c.x + fx * 20, 0, c.z + fz * 20);
    head.intensity = 90 * nightK;
  } else head.intensity = 0;
  for (const f of flameSprites) { f.scale.set(0.7 + Math.random() * 0.2, 1.1 + Math.random() * 0.35, 1); }
}
const SKY = [ // hour, top, horizon, clouds
  [0, 0x07061a, 0x2a1f48, 0x1e1838], [4.5, 0x0a0a24, 0x2a2450, 0x201c40], [6.2, 0x30406a, 0xe08a68, 0x8a6a7a], [8, 0x3f78c0, 0xb8d0e0, 0xf0f0f4],
  [16.5, 0x3f78c0, 0xc0d4e2, 0xf0f0f4], [18.8, 0x2e3a78, 0xf08a5a, 0xc07070], [20.2, 0x120e30, 0x4a2e62, 0x2e2448], [24, 0x07061a, 0x2a1f48, 0x1e1838],
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
var isNight = null, clockShown = -1, starsShown = -1;
function skyLerp(h, k, out) {
  for (let i = 0; i < SKY.length - 1; i++) {
    if (h >= SKY[i][0] && h <= SKY[i + 1][0]) {
      const f = (h - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]);
      return out.set(SKY[i][k]).lerp(_c2.set(SKY[i + 1][k]), f);
    }
  }
  return out.set(SKY[0][k]);
}
function updateSky(dt) {
  G.clock = (G.clock + dt / 60) % 24; // one game hour per real minute
  const h = G.clock;
  skyLerp(h, 1, sky.u.uTop.value); skyLerp(h, 2, sky.u.uHor.value); skyLerp(h, 3, sky.u.uCloud.value);
  sky.u.uTime.value = G.time;
  const day = Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
  scene.fog.color.copy(sky.u.uHor.value).multiplyScalar(0.35 + day * 0.5);
  nightK = Math.min(1, Math.max(0, (0.25 - day) / 0.25));
  sky.u.uStars.value = nightK;
  sun.intensity = day * 2.4;
  moon.intensity = 0.45 * nightK;
  hemi.intensity = 0.32 + day * 1.25;
  hemi.color.set(0x5a5a98).lerp(_c1.set(0xdfefff), Math.min(1, day * 2));
  hemi.groundColor.set(0x1a1626).lerp(_c1.set(0x5a6a40), Math.min(1, day * 2));
  const a = (h - 6) / 12 * Math.PI;
  sun.position.set(Math.cos(a) * 80, Math.max(10, Math.sin(a) * 90), 30);
  sun.color.setHSL(0.08, 0.7, 0.5 + day * 0.4);
  scene.fog.near = 30 + day * 20; scene.fog.far = 150 + day * 25;
  post.comp.uniforms.night.value = nightK;
  const night = nightK > 0.5;
  if (night !== isNight) {
    isNight = night;
    WM.window.map = night ? T.windowLit : T.window; WM.window.emissiveMap = night ? T.windowLit : null;
    WM.window.emissive.set(night ? 0xc8a070 : 0x000000); WM.window.needsUpdate = true;
    WM.lamp.color.set(night ? 0xfff0d0 : 0x8a8a8a).multiplyScalar(night ? 3 : 1);
    for (const m of signMats) m.color.setScalar(night ? 1.7 : 1);
    pools.visible = night; haloGroup.visible = night;
  }
  const cm = Math.floor(h * 60); if (cm !== clockShown) { clockShown = cm; hud.clock.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
}

const fx = makeFX({ scene, camera, sky, hemi, sun, moon, M: WM, lights, T, G, renderHeight: () => RES[resIdx] });

const events = makeEvents({ scene, camera, G, pos: () => ({ x: px(), z: pz() }), onFoot: () => !P.car });

const jail = makeJail({ scene, camera, G, P, cat, T, say, toast, banner, objective, addCash, respawn, keys, touch, pressed, cam: () => [camYaw, camPitch], save }); // jailbreak quest

const fishing = makeFishing({ scene, G, P, cat, places, peds, spawnPed, say, toast, banner, objective, addCash, setCheck, clearCheck: () => { checkMark.visible = false; G.check = null; }, hit, down, isTouch, puff, Sfx, T, mission: () => mission, knockedOut, $ });

// ---------------- minimap ----------------
const mm = $('minimap'), mg = mm.getContext('2d');
const MAPPX = 512, MK = MAPPX / (2 * MAP_HALF);  // minimap image pixels per metre
const mapImg = document.createElement('canvas'); mapImg.width = mapImg.height = MAPPX;
drawMap(mapImg.getContext('2d'), (v) => (v + MAP_HALF) * MK, MK);
RD.onRoads.push(() => drawMap(mapImg.getContext('2d'), (v) => (v + MAP_HALF) * MK, MK)); // engine: redraw after road edits
const mmLayer = document.createElement('canvas'), mlg = mmLayer.getContext('2d'); let mmT = -1e9; // P11: the rotated map layer is redrawn at most 20x per second
function drawMapLayer(W, s) {
  if (mmLayer.width !== W) mmLayer.width = mmLayer.height = W;
  mlg.save();
  mlg.clearRect(0, 0, W, W);
  mlg.beginPath(); mlg.arc(W / 2, W / 2, W / 2 - 2, 0, 7); mlg.clip();
  mlg.fillStyle = '#25402a'; mlg.fillRect(0, 0, W, W);
  mlg.translate(W / 2, W / 2);
  mlg.rotate(camYaw + Math.PI);  // camera forward is up
  mlg.scale(s / MK, s / MK);
  mlg.translate(-(px() + MAP_HALF) * MK, -(pz() + MAP_HALF) * MK);
  mlg.drawImage(mapImg, 0, 0);
  mlg.restore();
}
function drawMinimap() {
  const W = mm.width, s = 1.64, now = performance.now();
  if (now - mmT >= 50) { mmT = now; drawMapLayer(W, s); }
  mg.clearRect(0, 0, W, W); mg.drawImage(mmLayer, 0, 0);
  const blip = (x, z, col, r = 4, label) => {
    let dx = (x - px()) * s * 250 / 256 * (256 / 250), dz = (z - pz()) * s;
    dx = (x - px()) * s;
    const a = camYaw + Math.PI, c = Math.cos(a), sn = Math.sin(a);
    let bx = dx * c - dz * sn, by = dx * sn + dz * c;
    // rotate to screen: x right, y down
    const l = Math.hypot(bx, by), maxr = W / 2 - 8;
    if (l > maxr) { bx *= maxr / l; by *= maxr / l; }
    mg.fillStyle = col; mg.strokeStyle = '#000';
    mg.beginPath(); mg.arc(W / 2 + bx, W / 2 + by, r, 0, 7); mg.fill(); mg.stroke();
    if (label) { mg.fillStyle = '#000'; mg.font = 'bold 9px monospace'; mg.textAlign = 'center'; mg.fillText(label, W / 2 + bx, W / 2 + by + 3); }
  };
  if (!mission) for (const [id, m] of Object.entries(giverMarks)) if (m.visible) blip(m.position.x, m.position.z, '#ffd23f', 6, id[0].toUpperCase());
  blip(places.rv.x, places.rv.z, '#5fd0ff', 5, 'H');
  for (const c of patrolList) blip(c.x, c.z, Math.floor(G.time * 4) % 2 ? '#ff8a00' : '#3060ff', 3.5);
  for (const b of police.blips()) blip(b.x, b.z, b.c, b.r); // police
  if (P.car && places.quik) blip(places.quik.x + 3, places.quik.z + 7.5, '#7fe07f', 5, 'G');
  if (G.check) blip(G.check.x, G.check.z, G.check.col || '#ff3b6b', 5 + 2 * (0.5 + 0.5 * Math.sin(G.time * 6)), '!');
  if (mission && mission.rivals) for (const r of mission.rivals) blip(r.x, r.z, '#ff4040', 3);
  // player arrow
  mg.save(); mg.translate(W / 2, W / 2);
  const yaw = P.car ? P.car.yaw : P.yaw;
  mg.rotate(-(yaw - camYaw - Math.PI) + Math.PI);
  mg.fillStyle = '#fff'; mg.strokeStyle = '#000'; mg.beginPath(); mg.moveTo(0, -7); mg.lineTo(5, 5); mg.lineTo(0, 2); mg.lineTo(-5, 5); mg.closePath(); mg.fill(); mg.stroke();
  mg.restore();
  mg.strokeStyle = '#111'; mg.lineWidth = 3; mg.beginPath(); mg.arc(W / 2, W / 2, W / 2 - 2, 0, 7); mg.stroke(); mg.lineWidth = 1;
}

// ---------------- waypoint (on-screen pointer to G.check) ----------------
const wp = $('waypoint'), wpArrow = wp.querySelector('i'), wpText = wp.querySelector('span'), _wv = new THREE.Vector3(), _wf = new THREE.Vector3();
function updateWaypoint() {
  const c = G.check;
  if (INT.inside) { wp.style.display = 'none'; return; } // interiors
  if (!c || G.paused || G.dialog || dev.editing) { wp.style.display = 'none'; return; }
  const W = innerWidth, H = innerHeight, d = Math.hypot(c.x - px(), c.z - pz());
  _wv.set(c.x, TER.heightAt(c.x, c.z) + (c.blipOnly ? 2.2 : 3.4), c.z);
  camera.getWorldDirection(_wf);
  const behind = (_wv.x - camera.position.x) * _wf.x + (_wv.y - camera.position.y) * _wf.y + (_wv.z - camera.position.z) * _wf.z < 0;
  _wv.project(camera);
  let sx = _wv.x, sy = -_wv.y;
  if (behind) { sx = -sx; sy = -sy; }
  const m = 0.86, off = behind || Math.abs(sx) > m || Math.abs(sy) > m;
  if (off) { const k = m / Math.max(Math.abs(sx), Math.abs(sy), 1e-4); if (behind || k < 1) { sx *= k; sy *= k; } if (behind && Math.abs(sy) < m * 0.6) sy = m * 0.6; }
  if (off && sy > 0.7) sy = 0.7; // stay clear of the objective line
  const X = Math.max(170, Math.min(W - 170, (sx * 0.5 + 0.5) * W)), Y = (sy * 0.5 + 0.5) * H;
  wp.classList.toggle('low', sy > 0.4);
  wp.style.display = 'block'; wp.style.transform = `translate(${X.toFixed(0)}px, ${Y.toFixed(0)}px)`;
  wp.classList.toggle('off', off); wp.style.setProperty('--wc', c.col || '#ff3b6b');
  wpArrow.style.transform = off ? `rotate(${Math.atan2(sy * H, sx * W).toFixed(3)}rad)` : '';
  const dist = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  wpText.textContent = c.hint ? c.hint : c.label ? `${c.label} · ${dist}` : dist;
  wp.classList.toggle('warn', !!c.hint);
}

// ---------------- main loop ----------------
function updateMarkers(dt) {
  const allDone = G.done.nana && G.done.kids && G.done.ricky;
  for (const [id, m] of Object.entries(giverMarks)) {
    m.visible = !mission && !G.done[id] && (id !== 'gary' || allDone);
    m.userData.ico.rotation.y += dt * 2; m.userData.ico.position.y = 2.8 + Math.sin(G.time * 3) * 0.15;
  }
  checkMark.userData.ico.rotation.y += dt * 3;
  { const k = (G.time * 0.8) % 1, rg = checkMark.userData.ring; rg.scale.setScalar(0.6 + k * 0.9); rg.material.opacity = 0.75 * (1 - k); beamMat.opacity = 0.28 + 0.1 * Math.sin(G.time * 4); }
  saveMark.userData.ico.rotation.y += dt * 2;
  if (!P.car && Math.hypot(P.x - saveMark.position.x, P.z - saveMark.position.z) < 1 && G.heat === 0) {
    if (!G.savedHere) { G.savedHere = true; G.hp = 100; save(); toast('Napped in the RV. Game saved, health restored.'); Sfx.jingle(); }
  } else if (Math.hypot(P.x - saveMark.position.x, P.z - saveMark.position.z) > 3) G.savedHere = false;
}
function updatePickups(dt) {
  for (const p of pickups.slice()) {
    if (!p.alive) {
      if (p.respawn > 0 && (p.t -= dt) <= 0) { p.alive = true; scene.add(p.mesh); }
      else if (!(p.respawn > 0)) pickups.splice(pickups.indexOf(p), 1); // dead for good (collected bags): drop it
      continue;
    }
    if (p.ttl !== undefined && (p.ttl -= dt) <= 0) { scene.remove(p.mesh); pickups.splice(pickups.indexOf(p), 1); continue; } // dropped cash expires
    p.mesh.rotation.y += dt * 2;
    if (p.kind !== 'bag') p.mesh.position.y = 0.5 + Math.sin(G.time * 3 + p.x) * 0.12;
    const d = Math.hypot(px() - p.x, pz() - p.z);
    if (d < (P.car ? 2.4 : 1.0)) {
      if (p.kind === 'tuna') { if (G.hp >= 100) continue; G.hp = Math.min(100, G.hp + 35); toast('Tuna can! +35 health'); fishing.feed(20); }
      if (p.kind === 'cash') { addCash(p.amt); toast(`+$${p.amt}`); }
      if (p.kind === 'yarn') { G.yarn.push(p.id); addCash(100); save(); toast(`Golden yarn ball ${G.yarn.length}/10! +$100`); if (G.yarn.length === 10) banner('ALL YARN FOUND', 'The most dedicated cat in Maple Grove.', 4, 'pass'); }
      if (p.kind === 'bag') { toast('Got a bag of the good trash.'); }
      Sfx.pickup(); p.alive = false; scene.remove(p.mesh); p.t = p.respawn;
      if (p.temp || p.kind === 'yarn') { pickups.splice(pickups.indexOf(p), 1); }
    }
  }
}
// One pursuit: stars 1-2 are HOA carts (line of sight, fine-only citation); from 3 stars the carts stand down and
// Maple Grove PD takes over (police.js, the only route to jail). This is the one place G.seenT grows; units only reset it.
function updateHeat(dt) {
  const HOA = G.heat > 0 && G.heat <= 2;
  patrolList = patrols();
  if (G.heat > 0) {
    G.seenT += dt;
    if (HOA && patrolList.length < G.heat && Math.random() < dt * 0.8 && !(G.hoaTruce > G.time)) { spawnPatrol(); patrolList = patrols(); } // content: HOA truce after Final Notice
    if (!HOA) { for (const c of patrolList) retirePatrol(c); patrolList = patrols(); }
    if (G.seenT > 9 + G.heat * 3 && !(mission && mission.id === 'gary')) {
      G.heat--; G.seenT = 0;
      if (G.heat === 0) { toast(HOA ? 'The HOA lost interest.' : 'The PD lost interest.'); }
    }
    // indoors nobody can see you: 20 s later they lose you (interiors)
    G.hideT = INT.inside ? (G.hideT || 0) + dt : 0;
    if (G.hideT > 20 && !(mission && mission.id === 'gary')) { G.heat = 0; G.seenT = 0; G.hideT = 0; toast('They lost you.'); }
    // car wash scrubs you clean
    if (P.car && inZone('wash', P.car.x, P.car.z) && !(mission && mission.id === 'gary')) {
      G.heat = 0; toast('Suds N Paws: squeaky clean. Heat cleared!');
      P.car.hp = Math.min(100, P.car.hp + 40); P.car.washed = true; // on the house this visit
    }
    // getting cited (HOA carts only; the PD cuffs instead)
    let close = false;
    if (HOA) for (const c of patrolList) {
      const d = Math.hypot(c.x - px(), c.z - pz());
      if (P.car ? d < 5.5 && Math.abs(P.car.speed) < 2 : d < 3.6) close = true;
    }
    G.bustT = close ? G.bustT + dt : Math.max(0, G.bustT - dt * 2);
    if (G.bustT > (P.car ? 2.5 : 1.3)) busted();
  } else {
    G.bustT = 0; G.hideT = 0;
    // patrols go home: far ones vanish, near ones turn back into traffic
    for (const c of patrolList) { if (Math.hypot(c.x - px(), c.z - pz()) > 70) removeCar(c); else if (Math.random() < dt * 0.3) retirePatrol(c); }
    patrolList = patrols();
    // Suds N Paws repair / respray at 0 stars lives in shops.js (E in the wash bay)
  }
  if (P.car && inZone('wash', P.car.x, P.car.z) && Math.random() < 0.6) puff('foam', P.car.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, P.car.z + (Math.random() - 0.5) * 2, 0, 0.5, 0, 0.5, 0.8);
  const sk = G.heat * 2 + (G.seenT < 1.5 ? 1 : 0); // P10: rebuild the star bar only when heat or the flash state changes
  if (sk !== starsShown) { starsShown = sk; let s = ''; for (let i = 0; i < 5; i++) s += `<i class="${i < G.heat ? 'on' : ''}${i < G.heat && G.seenT < 1.5 ? ' flash' : ''}">★</i>`; setHTML(hud.stars, s); }
}

function sirenNear(cru) { let near = 999; for (const c of patrolList) near = Math.min(near, Math.hypot(c.x - px(), c.z - pz())); for (const c of cru) near = Math.min(near, Math.hypot(c.x - px(), c.z - pz())); return near; } // P13: nearest pursuer without spread / map allocations

function updateCars(dt) {
  for (let i = 0; i < cars.length; i++) { const c = cars[i]; // P13: index loops, no slice / filter copies (nothing in here removes a car)
    if (c.driver === 'ai' && c.ai) trafficAI(c, dt);
    else if (c.driver === 'patrol') patrolAI(c, dt);
    else if (c.driver === 'racer') racerAI(c, dt);
    else if (c.driver === 'flee') fleeAI(c, dt);
    else if (c.driver === 'police') police.carAI(c, dt); // police
    else if (c.driver !== 'player') drive(c, 0, 0, true, dt);
    carWorld(c, dt);
    // visuals
    const u = c.mesh.userData;
    c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.yaw;
    c.wheel += c.speed * dt / u.wr;
    u.wheels.forEach((w, i) => { w.children[0].rotation.x = c.wheel; if (i < 2) w.rotation.y = c.steer * 0.5; });
    u.body.rotation.z = -c.steer * Math.min(1, Math.abs(c.speed) / 20) * 0.06;
    if (u.bar) { const f = Math.floor(G.time * 6) % 2; u.bar[0].color.set(f ? 0xff8a00 : 0x302010); u.bar[1].color.set(f ? 0x302010 : 0x3070ff); }
    if (!c.dead && c.hp < 35 && Math.random() < dt * (c.hp < 15 ? 12 : 4)) puff('smoke', c.x + Math.sin(c.yaw) * c.spec.len * 0.4, 1.1, c.z + Math.cos(c.yaw) * c.spec.len * 0.4, 0, 1.4, 0, 0.6, 1.4);
    if (c.fire > 0) {
      c.fire -= dt;
      if (Math.random() < dt * 20) puff('fire', c.x + Math.sin(c.yaw) * c.spec.len * 0.35, 1.2, c.z + Math.cos(c.yaw) * c.spec.len * 0.35, 0, 2, 0, 0.7, 0.6);
      if (c.fire <= 0) explode(c);
    }
    if (c.dead && Math.random() < dt * 3) puff('smoke', c.x, 1, c.z, 0, 1.2, 0, 0.8, 2);
  }
  // keep traffic topped up, clear wrecks far away
  let ai = 0, walkers = 0;
  for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (c.dead && Math.hypot(c.x - px(), c.z - pz()) > 90) removeCar(c); else if (c.driver === 'ai') ai++; }
  if (ai < 12 && Math.random() < dt) spawnTraffic(['sedan', 'hatch', 'pickup', 'wagon'][(Math.random() * 4) | 0]);
  for (let i = 0; i < peds.length; i++) { const p = peds[i]; if (!p.npc && p.kind === 'human') walkers++; }
  if (walkers < 20 && Math.random() < dt * 0.5) spawnPed({});
  // cap the crowd (carjack victims pile up): drop far-off walkers over the cap, and cars the player left far behind
  let over = walkers - 22;
  if (over > 0) for (let i = 0; i < peds.length && over > 0; i++) { const p = peds[i]; if (!p.npc && p.kind === 'human' && Math.hypot(p.x - px(), p.z - pz()) > 90) { removePed(p); over--; i--; } }
  if (cars.length > 26) for (let i = 0; i < cars.length && cars.length > 26; i++) { const c = cars[i]; if (c.driver === null && !c.role && c !== P.car && Math.hypot(c.x - px(), c.z - pz()) > 110) { removeCar(c); i--; } }
}

let districtT = 0, district = '';
function updateDistrict(dt) {
  if ((districtT -= dt) > 0) return;
  districtT = 0.5;
  const d = INT.inside ? INT.name : districtAt(px(), pz());
  if (d !== district) { const first = !district; district = d; if (!first) toast(d, 2.2); hud.district && (hud.district.textContent = d); }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (document.hidden) return;
  if (hit('p')) { resIdx = (resIdx + 1) % RES.length; resize(); toast(`Render height ${RES[resIdx]}p`); }
  if (hit('m')) { const on = Sfx.toggle(); window.__pdMute = !on; toast(on ? 'Sound on' : 'Sound off'); }
  gamepad.update(dt); ui.update(dt); // ui: gamepad -> keys/touch, then pause menu / map (may set G.paused)
  if (!G.dialog && fishing.menuOpen()) { fishing.menuInput(); dt = 0; }
  if (G.dialog) {
    if (hit('e', 'f', 'enter', ' ', 'punch')) advanceDialog();
    dt = 0;
  }
  if (!G.paused && dt > 0) {
    G.time += dt;
    if ((G.saveT = (G.saveT || 0) + dt) > 60) { G.saveT = 0; save(); } // autosave once a minute
    shops.update(dt); // content: Suds N Paws takes E before the car exit
    updatePlayer(dt);
    jail.update(dt);
    INT.update(dt);
    updateCars(dt);
    for (const p of peds) updatePed(p, dt);
    interactions(dt);
    if (mission) { mission.t += dt; mission.update(dt); if (mission && mission.timer !== undefined && mission.stage !== 'car') { setStyle(hud.timer, 'display', 'block'); setText(hud.timer, `${Math.floor(mission.timer / 60)}:${String(Math.floor(mission.timer % 60)).padStart(2, '0')}`); } }
    updateHeat(dt);
    updatePickups(dt);
    updateMarkers(dt);
    updateDistrict(dt);
    updateSky(dt);
    updateLights(dt);
    fx.update(dt, nightK, G.time);
    INT.env(dt);
    for (const a of animated) a.fn(G.time);
    updateParts(dt);
    events.update(dt);
    fishing.update(dt);
    jobs.update(dt); // content
    police.update(dt); // police
    const cru = police.cruisers(); // police
    Sfx.engine(P.car && !P.car.dead ? Math.abs(P.car.speed) / P.car.spec.top : -1, (G.heat > 0 || cru.length) ? Math.min(1, 25 / Math.max(5, sirenNear(cru))) : 0);
  }
  cat.position.set(P.x, P.y - (P.swim ? SWIM_SINK - Math.sin(G.time * 3) * 0.03 : 0), P.z); cat.rotation.y = P.yaw;
  if (!dev.camera(Math.max(dt, 0.001)))   updateCamera(Math.max(dt, 0.001));
  sky.mesh.position.copy(camera.position);
  post.comp.uniforms.hurt.value = Math.max(0, post.comp.uniforms.hurt.value - dt * 1.5);
  dev.frame(dt); TER.beforeRender(scene, camera, P.car ? P.car.x : P.x, P.car ? P.car.z : P.z); // engine: lift onto terrain
  BRK.update(dt);
  post.render(scene, camera, G.time);
  TER.afterRender(); dev.after();
  updateWaypoint();
  // HUD
  setText(hud.cash, '$' + String(G.cash).padStart(8, '0'));
  setStyle(hud.hp, 'width', Math.max(0, G.hp) + '%');
  setStyle(hud.carhp, 'display', P.car ? 'block' : 'none');
  if (P.car) setStyle(hud.carhpfill, 'width', P.car.hp + '%');
  setStyle(hud.fuel, 'display', P.car ? 'flex' : 'none');
  if (P.car) { const f = P.car.fuel ?? 100, el = hud.fuelfill; setStyle(el, 'width', f + '%'); setStyle(el, 'background', f < 20 ? '#ff4040' : f < 45 ? '#ffd23f' : '#7fe07f'); setClass(hud.fuel, 'low', f < 20); setClass(hud.fuel, 'pump', !!P.car.filling); }
  const prompt = !P.car && !G.dialog && !G.paused ? (fishing.prompt() || (nearNpc() && !mission ? 'E: Talk' : nearestCar() ? 'E: Get in' : '')) : '';
  setText(hud.prompt, prompt); setStyle(hud.prompt, 'display', prompt ? 'block' : 'none');
  if (jail.active() && !G.dialog && !G.paused) { const jp = jail.prompt(); setText(hud.prompt, jp); setStyle(hud.prompt, 'display', jp ? 'block' : 'none'); } // jailbreak
  setText(hud.usebtn, P.car ? 'EXIT' : prompt ? (prompt.includes('Talk') ? 'TALK' : prompt.includes('Get in') ? 'GET IN' : prompt.replace(/^E[:!]? ?/, '').split(' ')[0].toUpperCase().slice(0, 6)) : 'USE');
  setText(hud.actbtn, P.car ? 'BRAKE' : 'PAW');
  if (jail.active() && jail.prompt()) setText(hud.usebtn, jail.btn()); // jailbreak
  setText(hud.jumpbtn, P.car ? 'HORN' : 'JUMP');
  setData(hud.jumpbtn, 'k', P.car ? 'h' : ' ');
  setData(hud.actbtn, 'k', P.car ? 'b' : 'punch');
  if (toastT > 0 && (toastT -= dt || 0.016) <= 0) hud.toast.classList.remove('show');
  if (bannerT > 0 && (bannerT -= dt || 0.016) <= 0) hud.banner.className = '';
  INT.hud(dt);
  if (!INT.inside)   drawMinimap();
  pressed.clear();
}

// ---------------- title ----------------
$('start').addEventListener('click', () => {
  Sfx.unlock();
  $('title').style.display = 'none'; document.body.classList.remove('titled');
  G.paused = false;
  const n = Object.keys(G.done).length;
  if (n) toast(`Welcome back. ${n}/4 jobs done, $${G.cash} in the bank.`, 4);
  else say([['', 'Maple Grove. Population: too many lawn signs.'], ['', "You live in an RV on the empty lot. The HOA wants it gone."], ['', 'Yellow markers are jobs. Blue is your RV: step in to nap and save.'], ['', isTouch ? 'Stick to move, drag the screen to look, USE to get in cars.' : 'WASD to move, mouse to look, E to get in cars, click to paw.']]);
});
$('reset').addEventListener('click', () => { try { for (const k of SAVE_KEYS) localStorage.removeItem(k); } catch (e) { /* ignore */ } location.reload(); });
if (Object.keys(G.done).length || G.cash) $('reset').style.display = 'inline-block';
updateSky(0);
fx.update(0, nightK, 0);
requestAnimationFrame(frame);
// engine: terrain-aware sprites + dev tools / world editor
sky.mesh.userData.noLift = true; TER.track(haloGroup.children); TER.link(flameSprites); TER.drapeMesh(pools);
const dev = makeDev({ scene, camera, canvas, renderer, G, P, cars, peds, pickups, WM, lights, haloSprites: haloGroup.children, pools, toast, marks: () => [...Object.values(giverMarks), saveMark, checkMark], setClock: (h) => { G.clock = h; updateSky(0); fx.update(0, nightK, G.time); } });
// interiors: enterable buildings (src/js/interiors.js)
const INT = makeInteriors({ scene, camera, camPos, G, P, cat, pool, hemi, sun, moon, post, WM, T, places, NPC, giverMarks, nearNpc, mission: () => mission, collide, exitCar, toast, save, Sfx, isTouch, mm, mg, getDev: () => dev, setCam: (y, p) => { camYaw = y; if (p !== undefined) camPitch = p; camIdle = 0; } });
BRK.init({ scene, Sfx, toast, camera }); // engine: breakables
window.__G = { G, P, fishing, jail, enterCar, waterAt, events, fx, cars, peds, places, camera, scene, drawMap, MAP_HALF, talkTo, addHeat, patrols, busted, save, load, SAVE_KEY, get mission() { return mission; }, setCam: (y, p) => { camYaw = y; camPitch = p; camIdle = -99; } };
// police: Maple Grove PD, officers on foot, civilians who fight back (src/js/police.js, tools/police-hooks.mjs)
const police = makePolice({ scene, G, P, cat, cars, peds, places, T, spawnCar, removeCar, damageCar, hurt, addHeat, addCash, toast, banner, respawn, puff, shake, Sfx, collide, blocked, roadOpts, navTarget, chaseAI, drive, exitCar, knock, attachPed, carCircles, hit, down, isTouch, camYaw: () => camYaw, px, pz, time: () => G.time });
window.__G.police = police;
if (SV && SV.gun && SV.gun.has) { police.gun.has = true; police.gun.ammo = SV.gun.ammo | 0; } // the pistol survives a reload (holstered)
// content: shops (src/js/shops.js) + replayable missions, side jobs and the post-game beat (src/js/jobs.js)
const shops = makeShops({ G, P, cars, places, INT, toast, addCash, save, Sfx, pressed, hit, collide, mission: () => mission, fishing });
const jobs = makeJobs({ MISSIONS, INTROS, DONE_LINES, spawnCar, spawnPed, removeCar, setCheck, objective, toast, banner, addCash, addHeat, places, cars, peds, P, G, NPC, giverMarks, makeMarker, say, startMission, endMission, mission: () => mission, scene, T, Sfx, INT, ahead, fishing });
window.__G.shops = shops; window.__G.jobs = jobs;
// ui: pause menu, settings, controls help, full map (src/js/ui.js) + gamepad (src/js/gamepad.js)
const ui = makeUI({ G, P, keys, pressed, touch, hit, fx, mapImg, MAP_HALF, places, giverMarks, districtAt, isTouch, RES, getRes: () => resIdx, setRes: (i) => { resIdx = i; resize(); }, setInvert: (b) => { lookInv = b ? -1 : 1; }, toast, px, pz, yaw: () => (P.car ? P.car.yaw : P.yaw), mission: () => mission, dev: () => dev });
const gamepad = makeGamepad({ keys, pressed, touch, P, ui, toast, look: (dx, dy) => { camYaw -= dx; camPitch = Math.max(-0.15, Math.min(1.1, camPitch + dy * lookInv)); camIdle = 0; } });
window.__G.ui = ui; window.__G.gamepad = gamepad;

// P17: pre-warm the shader programs that would otherwise compile mid-game (first officer, HP bar, muzzle flash, tracer,
// plane, contrail, waypoint beam): hidden stand-ins go into the scene for one renderer.compile against the HDR target.
{
  const tmp = new THREE.Group(), bx = new THREE.BoxGeometry(1, 1, 1), bc = document.createElement('canvas'); bc.width = 40; bc.height = 7;
  const barT = new THREE.CanvasTexture(bc);
  tmp.add(makeOfficer({ variant: 0 }), makeOfficer({ variant: 1 }));
  tmp.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: barT, depthTest: false, depthWrite: false, fog: false, transparent: true })));
  tmp.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })));
  tmp.add(new THREE.Mesh(bx, new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  tmp.add(new THREE.Mesh(bx, new THREE.MeshLambertMaterial({ color: 0xdfe3ea, fog: false, transparent: true })));
  tmp.add(new THREE.Mesh(bx, new THREE.MeshBasicMaterial({ map: T.glow, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })));
  scene.add(tmp);
  const was = checkMark.visible; checkMark.visible = true;
  renderer.setRenderTarget(post.rt); renderer.compile(scene, camera); renderer.setRenderTarget(null);
  checkMark.visible = was; scene.remove(tmp); bx.dispose(); barT.dispose();
}
