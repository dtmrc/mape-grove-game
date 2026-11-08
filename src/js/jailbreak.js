// Jailbreak quest "The Can" for Maple Grove: Off Leash. Owned by the jailbreak thread (design: docs/jailbreak-design.md).
// After an arrest the player wakes in cell 2 of the Maple Grove PD holding cells. Bart, a frog who lives in the toilet,
// fetches Officer Pruitt's keys (you play as the frog), then Goobles sneaks to cell 3, paws a floor vent loose, crawls
// into the evidence room and leaves by the back door. Pruitt sleeps in cycles: when the Z's stop, freeze.
//
// Self-contained: own geometry, colliders and camera in a room placed far outside the map (terrain-clamped corner, so
// the cat, camera and room lift by the same height). Wired into game.js by tools/jailbreak-hooks.mjs.
// Entry: window.__JAIL.start({ from: 'police'|'hoa', fine, station }). Debug: __G.jail.skip('frog'|'keys'|'vent'|'evidence').
import * as THREE from 'three';
import { mat, lambert, basic, phong, tex, fbm } from './gfx.js';
import { makeHuman, makeRaccoon, animBiped, addShadow } from './models.js';
import { places, lights } from './world.js';
import { Sfx } from './sfx.js';

const JX = -330, JZ = -330;            // room origin (local 0,0) in world space
const W2L = (x, z) => [x - JX, z - JZ], L2W = (x, z) => [x + JX, z + JZ];
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function mesh(geo, material, x = 0, y = 0, z = 0, parent = null) {
  const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); if (parent) parent.add(o); return o;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function nearestTex(w, h, draw) {
  const t = tex(w, h, null, draw, { repeat: false }); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
}

// ---------------------------------------------------------------- Bart (Legends-style frog) ----------------------------------------------------------------
// One connected loft body nose to tail (6-sided rings, flat top), capped snout carrying the mouth on its own tiny face
// texture, faceted eye domes with slit pupils, 4-sided prism legs, wedge webbed feet. ~290 tris, 64x64 atlas, nearest.
let frogTex = null, frogFaceTex = null, frogEyeTex = null;
function frogAtlas() {
  frogTex ||= nearestTex(64, 64, (g) => {
    let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    g.fillStyle = '#5c9f45'; g.fillRect(0, 0, 64, 32);                       // back: green
    g.fillStyle = '#6fb356'; for (let i = 0; i < 40; i++) g.fillRect(r() * 64 | 0, r() * 32 | 0, 2, 1);
    g.fillStyle = '#3d7a30'; for (let i = 0; i < 9; i++) { const x = r() * 60 | 0, y = r() * 26 | 0; g.fillRect(x, y, 4 + (r() * 4 | 0), 3 + (r() * 3 | 0)); }
    g.fillStyle = '#2f5f27'; g.fillRect(0, 30, 64, 2);                        // side stripe (lateral line)
    g.fillStyle = '#e9e2b4'; g.fillRect(0, 32, 64, 32);                       // belly: cream
    g.fillStyle = '#d6cc98'; for (let i = 0; i < 30; i++) g.fillRect(r() * 64 | 0, 34 + (r() * 30 | 0), 2, 1);
    g.fillStyle = '#c9bd86'; g.fillRect(0, 62, 64, 2);
  });
  frogFaceTex ||= nearestTex(16, 16, (g) => {
    g.fillStyle = '#5c9f45'; g.fillRect(0, 0, 16, 8); g.fillStyle = '#e9e2b4'; g.fillRect(0, 8, 16, 8);
    g.fillStyle = '#1e2a1a'; g.fillRect(1, 8, 14, 2); g.fillRect(0, 7, 2, 2); g.fillRect(14, 7, 2, 2);   // wide mouth, corners turned up
    g.fillStyle = '#2f5f27'; g.fillRect(5, 4, 1, 1); g.fillRect(10, 4, 1, 1);                            // nostrils
  });
  frogEyeTex ||= nearestTex(16, 16, (g) => {
    g.fillStyle = '#e8b63a'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#f7d774'; g.fillRect(2, 2, 12, 5);
    g.fillStyle = '#1a1208'; g.fillRect(2, 7, 12, 3);                                                     // horizontal slit pupil
    g.fillStyle = '#4e8a3c'; g.fillRect(0, 0, 16, 2);                                                     // lid rim
  });
}
// 6-point frog cross-section: flat back, bulging sides, flat belly (unit, [x, y])
const FROG_PTS = [[-0.55, 1], [0.55, 1], [1, 0.1], [0.6, -1], [-0.6, -1], [-1, 0.1]];
function frogBody() {
  const rings = [ // z (nose +), half width, half height, centre height
    [0.165, 0.045, 0.028, 0.072], [0.13, 0.085, 0.05, 0.078], [0.07, 0.11, 0.072, 0.086], [0.0, 0.115, 0.08, 0.088],
    [-0.07, 0.105, 0.082, 0.09], [-0.125, 0.078, 0.065, 0.08], [-0.165, 0.035, 0.03, 0.068],
  ];
  const n = FROG_PTS.length, pos = [], uv = [], idx = [];
  rings.forEach(([z, rx, ry, cy], k) => {
    for (let i = 0; i <= n; i++) {
      const [px, py] = FROG_PTS[i % n];
      pos.push(px * rx, cy + py * ry, z);
      uv.push(0.05 + (k / (rings.length - 1)) * 0.9, py > 0.3 ? 0.78 - (1 - py) * 0.2 : py > -0.5 ? 0.52 : 0.2);
    }
  });
  const S = n + 1;
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) { const a = k * S + i, b = a + 1, c = a + S, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // flat face cap on the snout (own texture) and a back cap
  const capG = (ring, tx, flip) => {
    const [z, rx, ry, cy] = ring, p = [0, cy, z], u = [0.5, 0.5], ix = [];
    FROG_PTS.forEach(([px, py]) => { p.push(px * rx, cy + py * ry, z); u.push(0.5 + px * 0.48, 0.5 + py * 0.48); });
    for (let i = 0; i < n; i++) { const a = 1 + i, b = 1 + (i + 1) % n; ix.push(0, flip ? b : a, flip ? a : b); }
    const c = new THREE.BufferGeometry();
    c.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); c.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); c.setIndex(ix); c.computeVertexNormals();
    return c;
  };
  return { body: g, face: capG(rings[0], 0, false), back: capG(rings.at(-1), 0, true) };
}
function dome(r, h, s = 6) { // faceted eye dome: 2 rings + flat top
  const g = new THREE.CylinderGeometry(r * 0.35, r, h, s, 1, false); g.translate(0, h / 2, 0); return g;
}
function prism(a, b, ra, rb, material, parent) { // tapered 4-sided limb from point a to point b, pivot at a
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(rb, ra, L, 4, 1); g.translate(0, L / 2, 0); g.rotateY(Math.PI / 4);
  const piv = new THREE.Group(); piv.position.copy(A); parent.add(piv);
  const mm = new THREE.Mesh(g, material); piv.add(mm);
  mm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return piv;
}
export function makeFrog() {
  frogAtlas();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = lambert({ map: frogTex, emissive: 0x0e1a0a }), faceM = lambert({ map: frogFaceTex, emissive: 0x0e1a0a }), eyeM = lambert({ map: frogEyeTex, emissive: 0x332200 });
  const G = frogBody();
  const torso = mesh(G.body, skin, 0, 0, 0, body); torso.name = 'frogBody';
  mesh(G.face, faceM, 0, 0, 0.0005, body); mesh(G.back, skin, 0, 0, 0, body);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = mesh(dome(0.036, 0.04), eyeM, s * 0.062, 0.148, 0.075, body); e.rotation.y = s * 0.3; eyes.push(e);
  }
  const throat = mesh(dome(0.045, 0.03), lambert({ map: frogTex, emissive: 0x0e1a0a }), 0, 0.03, 0.1, body); throat.rotation.x = Math.PI; throat.scale.y = 0.6;
  throat.geometry = throat.geometry.clone(); // own uv tweak: belly colours
  { const uv = throat.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.2); }
  // legs: back legs folded (thigh forward, shin back, long webbed foot), small front legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = prism([s * 0.095, 0.06, -0.075], [s * 0.14, 0.105, -0.01], 0.03, 0.022, skin, body);     // thigh
    const knee = prism([0, 0, 0], [0, 0, 0], 0.001, 0.001, skin, hip); knee.visible = false;               // placeholder pivot (kept simple)
    const shin = prism([s * 0.14, 0.105, -0.01], [s * 0.145, 0.025, -0.11], 0.02, 0.013, skin, body);     // shin
    const foot = mesh(box(0.05, 0.012, 0.1), skin, s * 0.145, 0.008, -0.06, body); foot.geometry = foot.geometry.clone();
    { const p = foot.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) p.setX(i, p.getX(i) * 1.7); foot.geometry.computeVertexNormals(); }
    const arm = prism([s * 0.08, 0.05, 0.085], [s * 0.095, 0.008, 0.105], 0.016, 0.011, skin, body);
    const hand = mesh(box(0.035, 0.01, 0.05), skin, s * 0.095, 0.006, 0.125, body);
    legs.push({ hip, shin, foot, arm, hand });
  }
  const tongue = mesh(box(0.012, 0.008, 1), lambert({ color: 0xe06a7a, emissive: 0x401015 }), 0, 0.085, 0.16, body); tongue.geometry.translate(0, 0, 0.5); tongue.visible = false;
  addShadow(root, 0.34, 0.34);
  root.userData = { body, torso, eyes, throat, legs, tongue, blink: 0, nextBlink: 2 + Math.random() * 3, frog: true };
  return root;
}
/** Frog pose/anim: state 'idle' | 'squat' | 'air' | 'land', t = game time, dt */
export function animFrog(f, t, dt, state = 'idle', faceYaw = null) {
  const u = f.userData;
  u.nextBlink -= dt;
  if (u.nextBlink <= 0) { u.blink = 0.16; u.nextBlink = 2 + Math.random() * 4; }
  if (u.blink > 0) u.blink -= dt;
  const bl = u.blink > 0 ? 0.12 : 1;
  for (const e of u.eyes) e.scale.y = bl;
  u.throat.scale.y = 0.55 + 0.25 * Math.abs(Math.sin(t * 2.3));
  // legs: squat tucks, air stretches straight back
  const k = state === 'air' ? 1 : state === 'squat' ? -0.4 : state === 'land' ? -0.25 : 0;
  for (const L of u.legs) {
    L.hip.rotation.x = -k * 1.0; L.shin.rotation.x = k * 0.9;
    L.foot.rotation.x = k * 0.5; L.arm.rotation.x = k * 0.6;
  }
  u.body.position.y = state === 'squat' || state === 'land' ? -0.02 : 0;
  u.body.rotation.x = state === 'air' ? -0.25 : 0;
}

// ---------------------------------------------------------------- the quest ----------------------------------------------------------------
export function makeJail(ctx) {
  const { scene, camera, G, P, cat, T, say, toast, banner, objective, addCash, respawn, keys, touch, pressed, cam, save } = ctx;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const down = (...k) => k.some((x) => keys.has(x));
  const hit = (...k) => k.some((x) => pressed.has(x));

  // ---------- room geometry ----------
  const room = new THREE.Group(); room.position.set(JX, 0, JZ); room.visible = false; scene.add(room);
  const cinder = tex(64, 64, (u, v, x, y) => {
    const n = fbm(u, v, 6, 3), g = fbm(u * 2, v * 2, 12, 2);
    let b = 150 + n * 30 - g * 14;
    const mortar = (y % 16) < 1 || ((x + (Math.floor(y / 16) % 2) * 16) % 32) < 1;
    if (mortar) b -= 45;
    return [b * 0.92, b * 0.97, b * 0.9];
  });
  const MW = lambert({ map: cinder, color: 0xb8c0b4 }), MWd = lambert({ map: cinder, color: 0x8a948c }), MF = lambert({ map: T.sidewalk, color: 0x8c8c86 });
  const MC = lambert({ color: 0x3b3d44 }), MBar = phong({ color: 0x5a5e66, shininess: 70, specular: 0x777777 }), MSteel = phong({ color: 0xb4b8bc, shininess: 90, specular: 0x999999 });
  const MWood = lambert({ map: T.wood, color: 0xb08a60 }), MDark = mat(0x26282e), MMat = lambert({ color: 0x6f7f68 }), MBlanket = lambert({ color: 0x8a6a4a, map: T.cloth });
  const MTube = basic({ color: 0xe6f2e8 }), MTubeDim = basic({ color: 0x9aa89c }), MDoor = lambert({ map: T.door, color: 0x9a9a9e }), MBlack = basic({ color: 0x050505 });
  const cols = [];  // local AABB colliders {x0,x1,z0,z1,h,bars?,top?}
  const addCol = (x0, x1, z0, z1, o = {}) => { const c = { x0, x1, z0, z1, h: 5, ...o }; cols.push(c); return c; };
  const wall = (x0, x1, z0, z1, h = 3, m = MW, y0 = 0, col = true) => {
    const w = mesh(box(x1 - x0, h, z1 - z0), m, (x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, room);
    if (col) addCol(x0, x1, z0, z1); return w;
  };
  // floors + ceilings
  mesh(box(14.4, 0.1, 7.4), MF, 0, -0.05, 0, room); mesh(box(7.2, 0.1, 4.6), MF, 3.2, -0.05, -6.15, room);
  mesh(box(14.4, 0.1, 7.4), MC, 0, 3.05, 0, room); mesh(box(7.2, 0.1, 4.6), MC, 3.2, 2.85, -6.15, room);
  // outer walls (cell block)
  wall(-7.2, 7.2, 3.5, 3.9); wall(-7.2, -6.8, -3.9, 3.9); wall(6.8, 7.2, -8.4, 3.9); wall(-7.2, 7.2, -3.9, -3.5);
  // evidence room walls
  wall(-0.4, 0, -8.4, -3.9); wall(-0.4, 7.2, -8.4, -8.0);
  // cell partitions + solid block east of cell 3
  wall(-2.9, -2.5, -3.5, -0.5); wall(1.1, 1.5, -3.5, -0.5); wall(5.1, 6.8, -3.5, -0.5, 3, MWd);
  // bars per cell: fixed bars + hinged door at the +x end
  const CELLS = [[-6.5, -2.9], [-2.5, 1.1], [1.5, 5.1]];
  const doors = [];
  const barRow = (x0, x1, parent, z = 0) => {
    for (let x = x0 + 0.075; x < x1; x += 0.15) mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.95, 6), MBar, x, 1.475, z, parent);
    mesh(box(x1 - x0, 0.06, 0.06), MBar, (x0 + x1) / 2, 2.92, z, parent); mesh(box(x1 - x0, 0.06, 0.06), MBar, (x0 + x1) / 2, 0.03, z, parent); mesh(box(x1 - x0, 0.05, 0.05), MBar, (x0 + x1) / 2, 1.2, z, parent);
  };
  CELLS.forEach(([x0, x1], i) => {
    const dw = 0.95, hx = x1 - 0.12;                     // door from hx-dw to hx, hinge at hx
    barRow(x0, hx - dw, room, -0.5); barRow(hx, x1, room, -0.5);
    addCol(x0, hx - dw, -0.55, -0.45, { bars: true }); addCol(hx, x1, -0.55, -0.45, { bars: true });
    const d = new THREE.Group(); d.position.set(hx, 0, -0.5); room.add(d);
    barRow(-dw, 0, d, 0); mesh(box(0.08, 0.3, 0.1), MSteel, -dw + 0.12, 1.05, 0.04, d);  // lock plate
    const col = addCol(hx - dw, hx, -0.55, -0.45, { bars: true, door: i });
    doors.push({ g: d, col, open: false, ang: 0, x: hx - dw / 2 });
  });
  // cell 1: bunk + sleeping raccoon (drunk tank)
  const bunk = (x0, x1, z0, z1) => {
    mesh(box(x1 - x0, 0.12, z1 - z0), MDark, (x0 + x1) / 2, 0.38, (z0 + z1) / 2, room);
    mesh(box(x1 - x0 - 0.1, 0.12, z1 - z0 - 0.1), MMat, (x0 + x1) / 2, 0.5, (z0 + z1) / 2, room);
    mesh(box((x1 - x0) * 0.55, 0.05, z1 - z0 - 0.14), MBlanket, (x0 + x1) / 2 - (x1 - x0) * 0.18, 0.585, (z0 + z1) / 2, room);
    for (const [x, z] of [[x0 + 0.08, z0 + 0.08], [x1 - 0.08, z0 + 0.08], [x0 + 0.08, z1 - 0.08], [x1 - 0.08, z1 - 0.08]]) mesh(box(0.06, 0.4, 0.06), MDark, x, 0.2, z, room);
    addCol(x0, x1, z0, z1, { h: 0.56, top: 0.56 });
  };
  bunk(-6.6, -4.9, -3.4, -2.6); bunk(-2.3, -0.6, -3.4, -2.6); bunk(3.3, 5.0, -3.4, -2.6);
  const drunk = makeRaccoon(); drunk.position.set(-5.75, 0.56, -3.0); drunk.rotation.set(0, Math.PI / 2, Math.PI / 2 * 0.9); drunk.userData.noLift = true; room.add(drunk);
  // cell 2: toilet (Bart's home), sink, drain, graffiti
  const toiletPos = { x: 0.65, z: -3.05 };
  mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.4, 8), MSteel, toiletPos.x, 0.2, toiletPos.z, room);
  mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 8), MSteel, toiletPos.x, 0.425, toiletPos.z, room);
  mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 8), lambert({ color: 0x3a5a6a }), toiletPos.x, 0.445, toiletPos.z, room); // water
  mesh(box(0.5, 0.45, 0.2), MSteel, toiletPos.x, 0.675, -3.38, room);
  addCol(toiletPos.x - 0.3, toiletPos.x + 0.3, -3.5, -2.75, { h: 0.9, top: 0.9 });
  mesh(box(0.42, 0.14, 0.32), MSteel, -0.25, 0.86, -3.33, room); mesh(box(0.06, 0.86, 0.06), MSteel, -0.25, 0.43, -3.42, room);
  addCol(-0.48, -0.02, -3.5, -3.15, { h: 0.95, top: 0.95 });
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 8), MDark, -0.3, 0.01, -1.7, room);  // floor drain
  { const t = T.sign('BART WUZ HERE', null, '#30302c', 128, 24); const s = mesh(new THREE.PlaneGeometry(0.9, 0.17), basic({ map: t, transparent: true }), -2.49, 1.0, -1.6, room); s.rotation.y = Math.PI / 2; }
  { const t = T.sign('|||| |||| ||', null, '#30302c', 128, 24); const s = mesh(new THREE.PlaneGeometry(0.7, 0.14), basic({ map: t, transparent: true }), -2.49, 0.75, -2.3, room); s.rotation.y = Math.PI / 2; }
  // cell 3: floor vent on the back wall left of the bunk
  const ventPos = { x: 2.25, z: -3.5 };
  mesh(new THREE.PlaneGeometry(0.7, 0.5), MBlack, ventPos.x, 0.26, -3.49, room);  // the dark duct behind the grate
  const grate = mesh(box(0.7, 0.5, 0.03), MBar, ventPos.x, 0.26, -3.47, room);
  for (let i = -2; i <= 2; i++) mesh(box(0.62, 0.04, 0.02), MDark, 0, i * 0.09, 0.02, grate);
  const ventCol = addCol(1.9, 2.6, -3.9, -3.5);
  // corridor dressing: EXIT door, posters, fixtures
  mesh(box(0.06, 2.1, 1.0), MDoor, 6.79, 1.05, -2.0, room).rotation.y = 0;
  { const s = mesh(new THREE.PlaneGeometry(0.7, 0.22), basic({ map: T.sign('EXIT', '#8a1010', '#ffffff', 128, 40), transparent: true }), 6.78, 2.35, -2.0, room); s.rotation.y = -Math.PI / 2; }
  mesh(box(0.08, 0.18, 0.08), MDark, 6.78, 1.6, -1.45, room); // buzzer box by the exit door
  { const p = mesh(new THREE.PlaneGeometry(0.8, 1.2), lambert({ map: T.posterHoa }), -3.5, 1.7, 3.49, room); p.rotation.y = Math.PI; }
  { const p = mesh(new THREE.PlaneGeometry(0.8, 1.2), lambert({ map: T.posterCat }), -1.0, 1.7, 3.49, room); p.rotation.y = Math.PI; p.rotation.z = 0.04; }
  { const s = mesh(new THREE.PlaneGeometry(2.2, 0.36), basic({ map: T.sign('MAPLE GROVE P.D.  HOLDING', '#1e2a44', '#dfe6f2', 256, 40), transparent: true }), 2.0, 2.5, 3.49, room); s.rotation.y = Math.PI; }
  const tubes = [];
  for (const [x, z, dim] of [[-4.5, 1.5, 0], [0, 1.5, 0], [4.5, 1.5, 0], [-4.7, -2, 0], [-0.7, -2, 0], [3.3, -2, 0], [3.2, -6, 1]]) {
    const y = dim ? 2.78 : 2.98;
    mesh(box(1.3, 0.06, 0.3), MDark, x, y + 0.03, z, room);
    tubes.push(mesh(box(1.2, 0.04, 0.22), dim ? MTubeDim : MTube, x, y - 0.01, z, room));
  }
  // light sources handed to the game's point-light pool (no extra shader lights)
  const JL = [];
  const addLight = (x, z, i, y = 2.6, c = 0xdcf6e4, flicker = false) => { const L = { x: x + JX, y, z: z + JZ, c, i, d: 14, always: true, flicker, jail: true }; lights.push(L); JL.push(L); return L; };
  addLight(-3.5, 0.6, 0.5); addLight(3.5, 0.6, 0.5); addLight(-0.7, -2.2, 0.35); addLight(3.4, -6, 0.22, 2.4, 0xe8e2c0, true);
  // the desk, chair, keys, donut, buzzer, mug
  const desk = { x0: 5.6, x1: 6.7, z0: 1.0, z1: 2.6, top: 0.78 };
  mesh(box(1.1, 0.08, 1.6), MWood, 6.15, 0.74, 1.8, room); mesh(box(1.0, 0.66, 0.5), MWood, 6.2, 0.33, 2.3, room); mesh(box(1.0, 0.66, 0.5), MWood, 6.2, 0.33, 1.3, room);
  addCol(desk.x0, desk.x1, desk.z0, desk.z1, { h: desk.top, top: desk.top, plat: 'desk' });
  const chair = { x0: 4.85, x1: 5.35, z0: 1.55, z1: 2.05, top: 0.45 };
  mesh(box(0.5, 0.08, 0.5), MDark, 5.1, 0.42, 1.8, room); mesh(box(0.08, 0.5, 0.5), MDark, 4.88, 0.72, 1.8, room); mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), MSteel, 5.1, 0.2, 1.8, room);
  mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 5), MDark, 5.1, 0.015, 1.8, room);
  addCol(chair.x0, chair.x1, chair.z0, chair.z1, { h: chair.top, top: chair.top, plat: 'chair' });
  const keysM = new THREE.Group(); keysM.position.set(6.3, desk.top + 0.02, 2.3); room.add(keysM);
  { const ring = mesh(new THREE.TorusGeometry(0.06, 0.008, 4, 10), MSteel, 0, 0, 0, keysM); ring.rotation.x = Math.PI / 2; for (let i = 0; i < 3; i++) { const k = mesh(box(0.015, 0.006, 0.07), lambert({ color: 0xd8c060 }), 0.05 + i * 0.012, 0.004, 0.06 + i * 0.01, keysM); k.rotation.y = i * 0.3; } }
  const donut = mesh(new THREE.TorusGeometry(0.06, 0.028, 6, 10), lambert({ color: 0xe88aa8 }), 5.95, desk.top + 0.03, 1.35, room); donut.rotation.x = Math.PI / 2;
  const buzzer = mesh(box(0.14, 0.05, 0.1), MDark, 6.4, desk.top + 0.025, 1.3, room); mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), lambert({ color: 0xd02020, emissive: 0x400000 }), 0, 0.03, 0, buzzer);
  mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), lambert({ color: 0xf0f0f0 }), 6.45, desk.top + 0.05, 1.8, room);
  { const s = mesh(new THREE.PlaneGeometry(0.5, 0.12), basic({ map: T.sign('DO NOT PRESS', '#f4f4f4', '#a01010', 128, 28), transparent: true }), 6.4, desk.top + 0.002, 1.18, room); s.rotation.x = -Math.PI / 2; }
  // Officer Pruitt: asleep, leaning back, feet on the desk, back to the corridor
  const cop = makeHuman({ skin: 0xe8b894, shirt: 0x2b3f6b, pants: 0x1c2740, hair: 0x5a3a1a, cap: 0x1c2740, longSleeve: true, shoe: 0x111111, smile: false });
  cop.position.set(5.08, chair.top - 0.88, 1.8); cop.rotation.y = Math.PI / 2; cop.userData.noLift = true; room.add(cop);
  { const u = cop.userData; u.legs[0].rotation.x = -1.35; u.legs[1].rotation.x = -1.25; u.torso.rotation.x = -0.32; u.head.rotation.x = 0.35; u.arms[0].rotation.x = -0.6; u.arms[1].rotation.x = -0.5; u.arms[0].rotation.z = -0.5; u.arms[1].rotation.z = 0.5; u.lookFwd = true;
    mesh(box(0.05, 0.06, 0.01), lambert({ color: 0xe8c040, emissive: 0x302000 }), -0.11, 1.38, 0.13, u.torso); }
  addCol(4.75, 5.45, 1.45, 2.15, { h: 1.6, camOnly: true });  // Pruitt blocks the camera, not the frog
  const copShadow = cop.children.find((c) => c.material && c.material.map === T.shadow); if (copShadow) copShadow.visible = false;
  // sleep indicator sprite
  const zTex = (txt, col) => nearestTex(64, 32, (g) => { g.font = 'bold 26px monospace'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(txt, 33, 26); g.fillStyle = col; g.fillText(txt, 32, 24); });
  const zMats = { snore: new THREE.SpriteMaterial({ map: zTex('Z z z', '#cfe6ff'), transparent: true, depthTest: false }), mumble: new THREE.SpriteMaterial({ map: zTex('. . .', '#ffd23f'), transparent: true, depthTest: false }), stir: new THREE.SpriteMaterial({ map: zTex('!', '#ff4040'), transparent: true, depthTest: false }) };
  const zz = new THREE.Sprite(zMats.snore); zz.scale.set(0.7, 0.35, 1); zz.position.set(5.0, 1.75, 1.8); zz.renderOrder = 5; room.add(zz);
  // the fly
  const fly = new THREE.Group(); room.add(fly);
  mesh(box(0.035, 0.03, 0.05), MDark, 0, 0, 0, fly);
  const wings = [mesh(new THREE.PlaneGeometry(0.05, 0.03), basic({ color: 0xbfd0e0, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), -0.03, 0.015, 0, fly), mesh(new THREE.PlaneGeometry(0.05, 0.03), basic({ color: 0xbfd0e0, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0.03, 0.015, 0, fly)];
  wings.forEach((w) => { w.rotation.x = -Math.PI / 2; });
  const FLY_SPOTS = [[-1.5, 0.62, -3.0, 'bunk'], [0.65, 0.92, -3.3, 'toilet tank'], [0.2, 1.15, -0.6, 'bars'], [-0.3, 0.03, -1.7, 'drain'], [-2.45, 1.3, -1.2, 'wall'], [-0.25, 0.95, -3.3, 'sink']];
  // evidence room: shelves, the bag, confiscated junk, back door, duct opening
  mesh(box(5.2, 2.0, 0.4), MDark, 3.0, 1.0, -7.8, room); addCol(0.4, 5.6, -8.0, -7.6, { h: 2 });
  for (const y of [0.45, 1.0, 1.55]) mesh(box(5.1, 0.04, 0.42), MWood, 3.0, y, -7.78, room);
  const bag = new THREE.Group(); bag.position.set(3.0, 1.02, -7.7); room.add(bag);
  mesh(box(0.34, 0.26, 0.2), lambert({ color: 0xc8a060 }), 0, 0.13, 0, bag);
  { const s = mesh(new THREE.PlaneGeometry(0.3, 0.1), basic({ map: T.sign('EVIDENCE', '#f0e8d0', '#a02020', 128, 32), transparent: true }), 0, 0.14, 0.101, bag); }
  { const t = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), MSteel, 0.1, 0.3, 0.02, bag); } // tuna can on top
  mesh(box(0.3, 0.2, 0.3), lambert({ color: 0xa08050 }), 1.2, 0.55, -7.7, room); mesh(box(0.5, 0.22, 0.3), lambert({ color: 0xa08050 }), 4.8, 1.66, -7.7, room);
  { // confiscated lawn flamingo
    const pink = lambert({ color: 0xff6fa0 }); mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 4), MSteel, 1.9, 0.35, -7.3, room); mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 4), MSteel, 2.02, 0.35, -7.3, room);
    const b = mesh(new THREE.SphereGeometry(0.13, 6, 4), pink, 1.95, 0.8, -7.3, room); b.scale.set(1, 0.8, 1.4); mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.4, 5), pink, 1.95, 1.05, -7.15, room).rotation.x = 0.3; mesh(new THREE.SphereGeometry(0.06, 6, 4), pink, 1.95, 1.27, -7.1, room); mesh(new THREE.ConeGeometry(0.03, 0.14, 5), MDark, 1.95, 1.24, -6.98, room).rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 4; i++) { const s = mesh(new THREE.PlaneGeometry(0.5, 0.36), lambert({ map: T.sign('HOA', '#ffffff', '#1e2a44', 64, 32) }), 5.6 + i * 0.02, 0.6 + i * 0.01, -5.2 - i * 0.03, room); s.rotation.y = -Math.PI / 2 + i * 0.05; }
  mesh(new THREE.PlaneGeometry(0.7, 0.5), MBlack, 2.25, 0.26, -3.91, room).rotation.y = Math.PI;   // duct mouth into the evidence room
  mesh(box(0.06, 2.1, 1.0), MDoor, 6.79, 1.05, -6.0, room);
  { const s = mesh(new THREE.PlaneGeometry(0.9, 0.2), basic({ map: T.sign('ALARM WILL NOT SOUND', '#2a2a2a', '#f0f0f0', 160, 28), transparent: true }), 6.78, 2.3, -6.0, room); s.rotation.y = -Math.PI / 2; }
  mesh(box(0.3, 0.05, 0.1), MSteel, 6.72, 1.0, -5.7, room); // push bar
  { const s = mesh(new THREE.PlaneGeometry(1.0, 0.22), basic({ map: T.sign('EVIDENCE', '#1e2a44', '#dfe6f2', 128, 32), transparent: true }), 3.0, 2.3, -3.94, room); s.rotation.y = Math.PI; }

  // ---------- Bart ----------
  const frog = makeFrog(); room.add(frog);
  const F = { x: toiletPos.x, y: 0.45, z: toiletPos.z, vx: 0, vz: 0, vy: 0, yaw: Math.PI, ground: true, hopT: 0, state: 'idle', on: null, hasKeys: false, squat: 0 };
  const frogHome = () => { F.x = toiletPos.x; F.z = toiletPos.z + 0.02; F.y = 0.45; F.vx = F.vz = F.vy = 0; F.yaw = 0.6; F.ground = true; F.on = 'toilet'; F.hasKeys = false; F.state = 'idle'; keysM.visible = true; keysM.position.set(6.3, desk.top + 0.02, 2.3); keysM.parent !== room && room.add(keysM); };
  frogHome();

  // ---------- state ----------
  const S = { active: false, stage: 'off', t: 0, fine: 0, from: '', station: null, control: 'cat', fade: 0, fadeTo: 0, fadeCb: null, fails: 0, ventHits: 0, evidence: false, catKeys: false, buzzed: false };
  const cop$ = { phase: 'snore', t: 0, dur: 6, headUp: 0, seen: 0 };
  const flyS = { state: 'fly', t: 0, spot: null, caught: false, a: Math.random() * 6, land: 3 + Math.random() * 2 };
  const cellSpawn = { x: -0.7, z: -1.6 };
  const fadeEl = document.createElement('div');
  fadeEl.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:none;z-index:50';
  document.body.appendChild(fadeEl);
  const hudEl = (id) => document.getElementById(id);
  const fadeOut = (cb, speed = 2.5) => { S.fadeTo = 1; S.fadeSpeed = speed; S.fadeCb = cb; };
  const fadeIn = (speed = 1.6) => { S.fadeTo = 0; S.fadeSpeed = speed; S.fadeCb = null; };

  const setStage = (st) => {
    S.stage = st;
    const OBJ = {
      cell: 'Something croaked. Check the toilet.',
      fly: 'Catch the fly for Bart: paw it when it lands.',
      fed: 'Give the fly to Bart (toilet).',
      frog: isTouch ? 'BART: hop up the chair, onto the desk, tongue the keys (USE).' : 'BART: hop up the chair, onto the desk, tongue the keys (E).',
      frogBack: 'BART: hop the keys back to cell 2. Freeze when the Z\'s stop.',
      keys: 'Unlock your cell door.',
      vent: 'Unlock cell 3 and paw the floor vent loose. Not while he stirs.',
      crawl: 'Crawl into the vent.',
      evidence: 'Grab your evidence bag, then take the back door.',
      out: 'Take the back door.',
    };
    objective(OBJ[st] || '');
  };
  const setDoor = (i, open) => { const d = doors[i]; d.open = open; d.col.off = open; if (open) Sfx.door(); };

  // ---------- helpers ----------
  const inCorridor = (lx, lz) => lz > -0.45 && lx > -6.8 && lx < 6.8 && lz < 3.5;
  const inCell = (lx, lz, i) => lz < -0.5 && lx > CELLS[i][0] && lx < CELLS[i][1];
  function pushOut(x, z, r, forFrog) {
    for (let it = 0; it < 2; it++) for (const c of cols) {
      if (c.off || c.camOnly) continue;
      if (forFrog ? c.bars : false) continue;
      if (forFrog && c.top !== undefined && F.y >= c.top - 0.02) continue;      // standing on top of it
      if (!forFrog && c.top !== undefined && P.y >= c.top) continue;
      if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue;
      const qx = clamp(x, c.x0, c.x1), qz = clamp(z, c.z0, c.z1);
      let dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
      if (d > r) continue;
      if (d < 1e-6) { const o = [[x - c.x0, -1, 0], [c.x1 - x, 1, 0], [z - c.z0, 0, -1], [c.z1 - z, 0, 1]].sort((a, b) => a[0] - b[0])[0]; x += o[1] * (o[0] + r); z += o[2] * (o[0] + r); }
      else { x = qx + dx / d * r; z = qz + dz / d * r; }
    }
    return [x, z];
  }
  const blockedL = (x, y, z, wallsOnly = false) => { if (y > 2.95 || y < 0.05) return true; for (const c of cols) if (!c.off && !c.bars && !(wallsOnly && c.top !== undefined) && y < c.h && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true; return false; };
  const platTop = (x, z, r = 0.05) => { let t = 0, p = null; for (const c of cols) if (c.top !== undefined && !c.off && !c.camOnly && x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r && c.top > t) { t = c.top; p = c; } return [t, p]; };
  const PL = () => W2L(P.x, P.z);
  const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const facing = (lx, lz, tx, tz) => { const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); return ((tx - lx) * fx + (tz - lz) * fz) / Math.max(0.01, dist2(lx, lz, tx, tz)); };

  // ---------- dialog scripts ----------
  const B = 'Bart', O = 'Officer Pruitt';
  const LINES = {
    intro: [[O, 'Zzz... no, YOUR honor... zzz...'], ['', 'Maple Grove PD holding cells. One bunk, one toilet, one you.'], ['', 'Something croaked. From the toilet.']],
    meet: [[B, "First time? You look like a first-timer. Name's Bart. I live in the can."], [B, "Been in here since the Reagan administration. Nobody flushes. It's great."], [B, "You want out? I can get you Pruitt's keys. I'm small, I'm slippery, I'm motivated."], [B, "Motivated by FLIES. There's one buzzing around your light. Bring it to me."]],
    hungry: [[B, 'No fly, no keys. Them\'s the rules of the can.']],
    fed: [[B, '*gulp* ...Mm. Notes of cafeteria meatloaf.'], [B, "Alright, deal's a deal. Hop me down the hall, up the chair, onto the desk. Keys are by the donut."], [B, "Pruitt sleeps in cycles. When the Z's stop, FREEZE. If he wakes up, I go back in the can."], [B, isTouch ? 'Stick to hop. JUMP for a big hop. USE for tongue.' : 'WASD to hop. SPACE for a big hop. E for tongue.']],
    retry: [[B, 'Fine. Again. Keep your paws still this time.']],
    gotKeys: [[B, 'Tongue\'d. Now back to your cell before he does the thing.']],
    handoff: [[B, "Keys. Slid under. Don't say I never did nothing."], [B, "The exit's buzzer-locked from the lobby. Don't touch the buzzer. I've seen things."], [B, "Cell 3. Floor vent behind the bunk. Loose since '09. Paw it off and crawl."]],
    evidence: [['', 'Evidence room. Your stuff is on the shelf, next to a confiscated lawn flamingo.']],
    frogCaught: [[O, 'Hnngh... dang frog.'], [B, 'Rude.']],
    frogCaught2: [[O, '...frog again...'], [B, "He's got hands like catcher's mitts."]],
    frogCaught3: [[O, 'Zzz... frog... zzz...'], [B, "Back in the can. Again. Here's a tip: when the Z's stop, you STOP. I'm a frog and I get it."]],
    catCaught: [[O, 'HEY! Back in the cell, fuzzball.'], [O, "And I'll take those keys. Zzz..."]],
    buzzed: [[O, 'WHO PRESSED THE... oh. The cat.'], [B, 'I SAID don\'t touch the buzzer.']],
    ventCaught: [[O, 'What are you doing to my vent?!'], [O, 'Back in your cell. Zzz...']],
    exitDoor: [['', 'Buzzer-locked from the lobby. Of course.']],
    cell1: [['', 'A raccoon, snoring. Do not wake.']],
    escaped: [[B, "Nice. I'm coming with you. The can was getting stale anyway."], [B, 'Ride\'s on your head. Don\'t make it weird.']],
  };

  // ---------- quest flow ----------
  function start(o = {}) {
    if (S.active) return;
    S.active = true; S.starting = true; S.fine = o.fine | 0; S.from = o.from || 'police'; S.station = o.station || places.station || null;
    S.stage = 'intro'; S.t = 0; S.control = 'cat'; S.fails = 0; S.ventHits = 0; S.evidence = false; S.catKeys = false; S.buzzed = false;
    for (let i = 0; i < 3; i++) { doors[i].open = false; doors[i].ang = 0; doors[i].col.off = false; doors[i].g.rotation.y = 0; }
    grate.visible = true; ventCol.off = false; bag.visible = true; keysM.visible = true; frogHome(); zz.visible = true;
    flyS.state = 'fly'; flyS.caught = false; fly.visible = true;
    cop$.phase = 'snore'; cop$.t = 0; cop$.dur = 7;
    room.visible = true;
    fadeEl.style.opacity = '1'; S.fade = 1; S.fadeTo = 1;
    const [wx, wz] = L2W(cellSpawn.x, cellSpawn.z);
    respawn(S.from === 'police' ? 'ARRESTED' : 'CITED... AND ARRESTED', S.fine ? `Maple Grove PD. Fine: $${S.fine}.` : 'Maple Grove PD.', { x: wx - 1.5, z: wz - 2.5 });
    S.starting = false; // (respawn above ends any cast and strips the pistol; the guard keeps it from end()ing this visit)
    P.yaw = 0; G.heat = 0; G.bustT = 0;
    hudEl('minimap').style.visibility = 'hidden';
    setTimeout(() => { fadeIn(1.2); }, 900);
    setTimeout(() => { if (S.active && S.stage === 'intro') say(LINES.intro, () => setStage('cell')); }, 1600);
  }
  // end({ quiet: true }) is the outside caller's version (game.js respawn): shut the cell down, no walk-out, banner or Bart
  function end(o = {}) {
    if (!S.active || S.starting) return;
    S.control = 'cat';
    if (o.quiet) { hudEl('minimap').style.visibility = ''; objective(''); room.visible = false; S.active = false; S.stage = 'off'; S.prompt = ''; S.btn = 'USE'; window.__camO = null; fadeIn(2); return; }
    const st = S.station;
    let ox, oz, oy = 0;
    if (st && st.door) { ox = st.door.x - Math.sin(st.door.yaw) * 14; oz = st.door.z - Math.cos(st.door.yaw) * 14; oy = st.door.yaw + Math.PI; }
    else if (st) { ox = st.x; oz = st.z + 12; }
    else { ox = -60; oz = 30; }
    P.x = ox; P.z = oz; P.y = 0; P.vy = 0; P.vx = P.vz = 0; P.yaw = oy;
    G.heat = Math.max(G.heat, 1); G.seenT = 0; G.bustT = 0;
    hudEl('minimap').style.visibility = '';
    objective(''); room.visible = false; S.active = false; S.stage = 'off'; window.__camO = null;
    G.jailbreaks = (G.jailbreaks | 0) + 1;
    banner('JAILBREAK', S.evidence ? `Fine recovered: $${S.fine}. Lay low.` : 'Lay low. (Your evidence bag is still in there.)', 4.5, 'pass'); Sfx.jingle();
    perchBart(); save();
    setTimeout(() => { if (!S.active) say(LINES.escaped); }, 1500);
  }
  let perched = null;
  function perchBart() {
    if (perched) return;
    perched = makeFrog(); perched.scale.setScalar(0.75); perched.position.set(0, cat.userData.crown ?? 0.40, 0.03); // crown: top of the head in the head prop frame (goobles.js) perched.rotation.y = 0;
    const sh = perched.children.find((c) => c.material && c.material.map === T.shadow); if (sh) sh.visible = false;
    cat.userData.head.add(perched); perched.userData.ride = true;
  }
  function placeCatInCell() {
    const [wx, wz] = L2W(cellSpawn.x, cellSpawn.z);
    P.x = wx; P.z = wz; P.y = 0; P.vy = 0; P.vx = P.vz = 0; P.yaw = 0; P.punch = 0; P.down = 0;
  }
  function caught(kind) {
    // kind: 'frog' | 'cat' | 'buzz' | 'vent'
    Sfx.hurt(); Sfx.siren(); S.fails++;
    cop$.phase = 'stir'; cop$.t = 0; cop$.dur = 2.5; cop$.headUp = 1;
    const after = () => {
      fadeOut(() => {
        if (kind === 'frog') { frogHome(); setStage('fed'); S.control = 'cat'; }
        else {
          placeCatInCell(); for (let i = 0; i < 3; i++) { doors[i].open = false; doors[i].col.off = false; doors[i].ang = 0; doors[i].g.rotation.y = 0; }
          S.catKeys = false; frogHome(); setStage('fed'); S.control = 'cat';
        }
        cop$.phase = 'snore'; cop$.t = 0; cop$.dur = 8; cop$.headUp = 0;
        setTimeout(() => fadeIn(1.5), 350);
      }, 3);
    };
    const lines = kind === 'frog' ? (S.fails >= 3 ? LINES.frogCaught3 : S.fails === 2 ? LINES.frogCaught2 : LINES.frogCaught) : kind === 'buzz' ? LINES.buzzed : kind === 'vent' ? LINES.ventCaught : LINES.catCaught;
    S.control = 'none';
    setTimeout(() => say(lines, after), 500);
  }

  // ---------- interactions (cat) ----------
  function catAction() {
    // returns { label, fn } for the nearest usable thing, or null
    const [lx, lz] = PL();
    const near = (x, z, r) => dist2(lx, lz, x, z) < r;
    if (near(toiletPos.x, toiletPos.z, 1.0) && inCell(lx, lz, 1)) {
      if (S.stage === 'cell') return { label: 'Talk to the toilet', fn: () => say(LINES.meet, () => setStage('fly')) };
      if (S.stage === 'fly') return { label: 'Talk to Bart', fn: () => say(LINES.hungry) };
      if (S.stage === 'fed') return { label: 'Talk to Bart', fn: () => say(S.fails ? LINES.retry : LINES.fed, () => startFrogRun()) };
    }
    for (let i = 0; i < 3; i++) {
      const d = doors[i];
      if (near(d.x, -0.5, 1.1) && !d.open) {
        if (S.catKeys) return { label: `Unlock cell ${i + 1}`, fn: () => { setDoor(i, true); if (i === 1 && S.stage === 'keys') setStage('vent'); if (i === 0) say(LINES.cell1); } };
        if (i === 1 && S.stage !== 'intro') return { label: 'Rattle the door', fn: () => { toast('Locked. Solid. Of course.'); Sfx.door(); } };
      }
    }
    if (near(6.6, -2.0, 1.2) && lx > 5) return { label: 'Exit door', fn: () => say(LINES.exitDoor) };
    if (near(6.4, 1.3, 1.1) && lz > 0.9 && lx > 5.4) return { label: 'Press the buzzer', fn: () => { if (S.buzzed) return; S.buzzed = true; Sfx.horn(); Sfx.horn(); toast('BZZZZZT'); caught('buzz'); } };
    if (S.stage === 'crawl' && !grate.visible && near(ventPos.x, -3.3, 0.9) && inCell(lx, lz, 2)) return { label: 'Crawl into the vent', fn: () => crawl() };
    if (S.stage === 'evidence' && !S.evidence && near(3.0, -7.4, 1.1) && lz < -4) return { label: 'Grab your evidence bag', fn: () => { S.evidence = true; bag.visible = false; addCash(S.fine); Sfx.pickup(); toast(S.fine ? `Evidence recovered: $${S.fine}, one tuna can, your dignity.` : 'Evidence recovered: one tuna can and your dignity.'); G.hp = 100; setStage('out'); } };
    if ((S.stage === 'evidence' || S.stage === 'out') && near(6.6, -6.0, 1.3) && lz < -4) return { label: 'Back door', fn: () => fadeOut(() => { end(); setTimeout(() => fadeIn(1.5), 400); }, 3) };
    return null;
  }
  function crawl() {
    S.control = 'none';
    fadeOut(() => {
      const [wx, wz] = L2W(2.25, -4.7); P.x = wx; P.z = wz; P.yaw = Math.PI; P.y = 0; P.vx = P.vz = 0;
      setStage('evidence'); S.control = 'cat';
      setTimeout(() => { fadeIn(1.5); say(LINES.evidence); }, 500);
    }, 2.2);
  }
  function startFrogRun() {
    S.control = 'frog'; setStage('frog'); frogHome(); F.on = 'toilet'; F.y = 0.45;
    S.frogT = 0;
  }

  // ---------- updates ----------
  function updateCop(dt) {
    cop$.t += dt;
    if (cop$.t >= cop$.dur) {
      cop$.t = 0;
      if (cop$.phase === 'snore') { cop$.phase = 'mumble'; cop$.dur = 1.3; }
      else if (cop$.phase === 'mumble') { cop$.phase = 'stir'; cop$.dur = 1.8; }
      else { cop$.phase = 'snore'; cop$.dur = 5 + Math.random() * 3; }
    }
    const u = cop.userData, want = cop$.phase === 'stir' ? 1 : cop$.phase === 'mumble' ? 0.25 : 0;
    cop$.headUp += (want - cop$.headUp) * Math.min(1, dt * 6);
    u.head.rotation.x = 0.35 - cop$.headUp * 0.75; u.head.rotation.y = cop$.headUp * Math.sin(G.time * 2.5) * 0.9 + (cop$.phase === 'stir' ? Math.PI * 0.55 * Math.sin(G.time * 1.3) : 0) * cop$.headUp;
    u.torso.rotation.x = -0.32 + cop$.headUp * 0.18;
    u.body.position.y = (cop$.phase === 'snore' ? Math.sin(G.time * 1.6) * 0.012 : 0);
    zz.material = zMats[cop$.phase]; zz.position.y = 1.75 + (cop$.phase === 'snore' ? Math.sin(G.time * 2) * 0.05 : 0);
    zz.scale.set(0.7, 0.35, 1); if (cop$.phase === 'stir') zz.scale.set(0.5 + Math.sin(G.time * 12) * 0.05, 0.35, 1);
  }
  function updateFly(dt) {
    if (flyS.caught) { fly.visible = false; return; }
    if (!(S.stage === 'fly' || S.stage === 'cell' || S.stage === 'intro')) { fly.visible = false; return; }
    fly.visible = true; flyS.t += dt;
    const wingK = Math.sin(G.time * 60);
    if (flyS.state === 'fly') {
      flyS.a += dt * 2.4;
      const cx = -0.7, cz = -2.0, r = 0.9 + Math.sin(flyS.a * 0.7) * 0.4;
      fly.position.set(cx + Math.cos(flyS.a) * r, 2.2 + Math.sin(flyS.a * 1.9) * 0.35, cz + Math.sin(flyS.a * 1.3) * r * 0.6);
      fly.rotation.y = -flyS.a + Math.PI / 2;
      wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * wingK * 0.9; w.visible = true; });
      if (flyS.t > flyS.land) { flyS.state = 'approach'; flyS.spot = FLY_SPOTS[(Math.random() * FLY_SPOTS.length) | 0]; flyS.t = 0; }
    } else if (flyS.state === 'approach') {
      const [sx, sy, sz] = flyS.spot; const dx = sx - fly.position.x, dy = sy - fly.position.y, dz = sz - fly.position.z, L = Math.hypot(dx, dy, dz);
      const st = Math.min(L, dt * 2.6); fly.position.x += dx / L * st; fly.position.y += dy / L * st; fly.position.z += dz / L * st;
      fly.rotation.y = Math.atan2(dx, dz);
      wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * wingK * 0.9; });
      if (L < 0.02) { flyS.state = 'sit'; flyS.t = 0; flyS.sit = 2.2 + Math.random() * 0.8; }
    } else if (flyS.state === 'sit') {
      wings.forEach((w) => { w.rotation.z = 0; });
      fly.position.y = flyS.spot[1] + Math.abs(Math.sin(G.time * 10)) * 0.004;
      if (flyS.t > flyS.sit) { flyS.state = 'fly'; flyS.t = 0; flyS.land = 2.5 + Math.random() * 2.5; flyS.a = Math.atan2(fly.position.z + 2.0, fly.position.x + 0.7); }
    }
    // a paw swipe lands when P.punch crosses the 0.22 mark (same as the game's hit check)
    if (S.stage === 'fly' && S.control === 'cat' && S.prevPunch > 0.22 && P.punch <= 0.22 && P.punch > 0) {
      const [lx, lz] = PL(), d = dist2(lx, lz, fly.position.x, fly.position.z);
      if (d < 1.15 && Math.abs(fly.position.y - 0.6) < 1.0 && facing(lx, lz, fly.position.x, fly.position.z) > 0.1) {
        if (flyS.state === 'sit') { flyS.caught = true; fly.visible = false; Sfx.pickup(); toast('Got it. Gross.'); setStage('fed'); }
        else { toast('Too fast. Wait for it to land.'); flyS.state = 'fly'; flyS.t = 0; flyS.land = 2 + Math.random() * 1.5; }
      }
    }
  }
  function updateDoors(dt) {
    for (const d of doors) { const want = d.open ? -1.75 : 0; d.ang += (want - d.ang) * Math.min(1, dt * 5); d.g.rotation.y = d.ang; }
  }
  // the cat inside the block: our own collisions, stealth, actions
  let prevLx = 0, prevLz = 0;
  function updateCat(dt) {
    let [lx, lz] = PL();
    [lx, lz] = pushOut(lx, lz, 0.22, false);
    [P.x, P.z] = L2W(lx, lz);
    const [top] = platTop(lx, lz, 0.1);
    if (P.y < top && top > 0) { if (P.y > top - 0.3 && P.vy <= 0) { P.y = top; P.vy = 0; } }
    if (P.y <= 0.0005 && S.control !== 'cat') P.y = 0.002;
    const sp = dist2(lx, lz, prevLx, prevLz) / Math.max(dt, 1e-3); prevLx = lx; prevLz = lz;
    // stealth: moving in the corridor while Pruitt stirs
    if (S.control === 'cat' && cop$.phase === 'stir' && inCorridor(lx, lz) && sp > 0.6) {
      cop$.seen += dt; if (cop$.seen > 0.35) { cop$.seen = 0; caught('cat'); return; }
    } else cop$.seen = Math.max(0, cop$.seen - dt);
    // vent pawing
    if (S.stage === 'vent' && S.control === 'cat' && S.prevPunch > 0.22 && P.punch <= 0.22 && P.punch > 0 && inCell(lx, lz, 2)) {
      if (dist2(lx, lz, ventPos.x, -3.3) < 0.9 && facing(lx, lz, ventPos.x, -3.5) > 0.3) {
        S.ventHits++; Sfx.punch(); Sfx.crash(20); toast(['CLANG.', 'CLANG! It wobbles.', 'CLANG. The grate drops.'][Math.min(2, S.ventHits - 1)]);
        grate.position.z = -3.47 + Math.random() * 0.02; grate.rotation.z = (Math.random() - 0.5) * 0.1 * S.ventHits;
        if (cop$.phase === 'stir') { caught('vent'); return; }
        if (cop$.phase === 'snore' && cop$.t > 1.5) { cop$.t = Math.max(cop$.t, cop$.dur - 1.0); }  // a clang shortens his deep sleep
        if (S.ventHits >= 3) { grate.visible = false; ventCol.off = true; setStage('crawl'); }
      }
    }
    // actions
    const act = S.control === 'cat' ? catAction() : null;
    S.prompt = act ? `${isTouch ? 'USE' : 'E'}: ${act.label}` : '';
    S.btn = act ? act.label.split(' ')[0].toUpperCase() : 'USE';
    if (act && hit('e', 'f', 'enter') && !(P.lock > 0) && !G.dialog) { act.fn(); pressed.delete('e'); pressed.delete('f'); pressed.delete('enter'); }
  }
  // Bart under player control
  function updateFrog(dt) {
    const [cy] = cam();
    let mx = 0, mz = 0;
    if (down('w', 'arrowup')) mz += 1; if (down('s', 'arrowdown')) mz -= 1; if (down('a', 'arrowleft')) mx += 1; if (down('d', 'arrowright')) mx -= 1;
    if (touch.active) { mx = -touch.x; mz = -touch.y; }
    const len = Math.hypot(mx, mz);
    let wantYaw = F.yaw;
    if (len > 0.1) { const fx = Math.sin(cy + Math.PI), fz = Math.cos(cy + Math.PI); wantYaw = Math.atan2(fx * mz + fz * mx, fz * mz - fx * mx); }
    const big = hit(' ');
    if (F.ground) {
      F.hopT += dt;
      if (len > 0.1) F.yaw += wrap(wantYaw - F.yaw) * Math.min(1, dt * 14);
      if ((len > 0.1 || big) && F.hopT > 0.12) {
        const sp = big ? 1.35 : 1.0, vy = big ? 3.35 : 1.75;
        F.vx = Math.sin(F.yaw) * sp * (big ? 1 : Math.min(1, len)); F.vz = Math.cos(F.yaw) * sp * (big ? 1 : Math.min(1, len)); F.vy = vy; F.ground = false; F.state = 'air'; F.hopT = 0;
        Sfx.blip(big ? 220 : 180);
      } else if (F.hopT > 0.12) F.state = 'idle';
    } else {
      F.vy -= 9.5 * dt;
      if (len > 0.1) { F.vx += Math.sin(wantYaw) * 2.2 * dt; F.vz += Math.cos(wantYaw) * 2.2 * dt; F.yaw += wrap(wantYaw - F.yaw) * Math.min(1, dt * 6); } // a little air steering
      F.x += F.vx * dt; F.z += F.vz * dt; F.y += F.vy * dt;
      [F.x, F.z] = pushOut(F.x, F.z, 0.09, true);
      const [top, plat] = platTop(F.x, F.z, 0.06);
      const floor = top;
      if (F.vy <= 0 && F.y <= floor + 0.001 && (F.y > floor - 0.25 || floor === 0)) {
        F.y = floor; F.vy = 0; F.vx = F.vz = 0; F.ground = true; F.state = 'land'; F.hopT = 0; F.on = plat ? plat.plat || 'thing' : 'floor';
        // landing noise during a stir
        if (cop$.phase === 'stir' && (inCorridor(F.x, F.z) || plat)) { caught('frog'); return; }
      } else if (F.y < -0.5) { F.y = 0; F.vy = 0; F.ground = true; }
    }
    // sitting on the chair/desk while he stirs = seen
    if (F.ground && cop$.phase === 'stir' && F.on && (F.on === 'desk' || F.on === 'chair')) { cop$.seen += dt; if (cop$.seen > 0.3) { cop$.seen = 0; caught('frog'); return; } }
    // tongue: keys on the desk
    const nearKeys = !F.hasKeys && keysM.visible && dist2(F.x, F.z, keysM.position.x, keysM.position.z) < 0.5 && Math.abs(F.y - desk.top) < 0.15;
    S.prompt = nearKeys ? `${isTouch ? 'USE' : 'E'}: Tongue the keys` : (S.stage === 'frogBack' ? '' : '');
    S.btn = nearKeys ? 'TONGUE' : 'USE';
    if (nearKeys && hit('e', 'f', 'enter')) {
      F.hasKeys = true; keysM.visible = false; Sfx.pickup(); toast('*thwip* Keys acquired.'); setStage('frogBack');
      const u = frog.userData; u.tongue.visible = true; u.tongueT = 0.3; F.yaw = Math.atan2(keysM.position.x - F.x, keysM.position.z - F.z);
      pressed.delete('e'); pressed.delete('f'); pressed.delete('enter');
    }
    // handoff at cell 2's door (either side of the bars)
    if (F.hasKeys && dist2(F.x, F.z, doors[1].x, -0.5) < 0.9 && F.ground) {
      F.hasKeys = false; S.catKeys = true; S.control = 'none';
      say(LINES.handoff, () => { S.control = 'cat'; setStage('keys'); P.lock = 0.3; });
      F.x = doors[1].x - 0.3; F.z = -0.9; F.y = 0; F.yaw = Math.PI;
    }
    // the cat waits in its cell (undo whatever updatePlayer did this frame)
    placeCatIdle();
  }
  function placeCatIdle() {
    const [wx, wz] = L2W(cellSpawn.x, cellSpawn.z);
    P.x = wx; P.z = wz; P.vx = P.vz = 0; P.yaw = Math.PI * 0.1; P.y = 0.002; P.vy = 0;
    animBiped(cat, 0, 0, G.time, 0);
  }
  function updateFrogMesh(dt) {
    frog.position.set(F.x, F.y, F.z); frog.rotation.y = F.yaw;
    const u = frog.userData;
    animFrog(frog, G.time, dt, S.control === 'frog' ? (F.ground ? (F.hopT < 0.12 ? 'land' : 'idle') : 'air') : 'idle');
    if (u.tongueT > 0) { u.tongueT -= dt; const k = Math.sin(Math.min(1, (0.3 - u.tongueT) / 0.3) * Math.PI); u.tongue.scale.z = 0.05 + k * 0.45; if (u.tongueT <= 0) u.tongue.visible = false; }
    // the key ring rides along once Bart has it
    if (F.hasKeys) { keysM.visible = true; keysM.position.set(F.x, F.y + 0.06, F.z + Math.cos(F.yaw) * 0.14); keysM.position.x += Math.sin(F.yaw) * 0.14; }
    // Bart on the toilet rim croaks now and then
    if (S.control !== 'frog' && !F.hasKeys && Math.random() < dt * 0.08) { u.throat.scale.y = 1.3; if (Math.random() < 0.3) Sfx.blip(130); }
  }
  function updateCamera(dt) {
    const [cy, cp] = cam();
    let tx, ty, tz, dist;
    if (S.control === 'frog') { tx = F.x; ty = F.y + 0.12; tz = F.z; dist = 1.5; }
    else { const [lx, lz] = PL(); tx = lx; ty = 0.62 + P.y * 0.6; tz = lz; dist = 2.3; }
    const frogCam = S.control === 'frog';
    const pitch = Math.max(frogCam ? 0.3 : 0.12, cp);
    const dx = Math.sin(cy) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(cy) * Math.cos(pitch);
    let k = dist;
    // walls pull the camera in (furniture does not block the frog's low camera; the room is tiny)
    for (let s = 1; s <= 14; s++) { const f = dist * s / 14; if (blockedL(tx + dx * f, ty + dy * f, tz + dz * f, frogCam)) { k = Math.max(0.3, f - 0.25); break; } }
    S.camK = S.camK === undefined ? k : S.camK + (k - S.camK) * Math.min(1, dt * (k < S.camK ? 20 : 4));
    // squeezed against a wall: climb and look down instead of sitting inside the character
    const lift = Math.max(0, dist * 0.55 - S.camK) * 1.1;
    const cx = tx + dx * S.camK, cyy = Math.min(2.9, Math.max(0.15, ty + dy * S.camK + lift)), cz = tz + dz * S.camK;
    const [wx, wz] = L2W(cx, cz), [lx2, lz2] = L2W(tx, tz);
    window.__camO = [[wx, cyy, wz], [lx2, ty, lz2]];
  }

  function update(dt) {
    // fade overlay (runs even while inactive so the exit fade completes)
    if (S.fade !== S.fadeTo) {
      S.fade += Math.sign(S.fadeTo - S.fade) * dt * (S.fadeSpeed || 2);
      if ((S.fadeTo === 1 && S.fade >= 1) || (S.fadeTo === 0 && S.fade <= 0)) { S.fade = S.fadeTo; const cb = S.fadeCb; S.fadeCb = null; if (cb) cb(); }
      fadeEl.style.opacity = String(clamp(S.fade, 0, 1));
    }
    if (perched) { const u = perched.userData; animFrog(perched, G.time, dt, 'idle'); }
    if (!S.active) return;
    S.t += dt;
    updateCop(dt); updateDoors(dt); updateFly(dt);
    if (S.control === 'frog') updateFrog(dt);
    if (S.control !== 'frog') updateCat(dt);
    if (S.control === 'none') { S.prompt = ''; }
    updateFrogMesh(dt);
    updateCamera(dt);
    S.prevPunch = P.punch;
    // the tubes hum / flicker
    tubes[6].material = Math.random() < 0.08 ? MTubeDim : MTube; if (Math.random() < 0.02) tubes[6].material = MDark;
  }

  // debug helpers
  function skip(to) {
    if (!S.active) start({ fine: 100 });
    const go = () => {
      if (to === 'frog') { flyS.caught = true; fly.visible = false; startFrogRun(); }
      if (to === 'keys') { flyS.caught = true; fly.visible = false; frogHome(); keysM.visible = false; S.catKeys = true; S.control = 'cat'; setStage('keys'); }
      if (to === 'vent') { flyS.caught = true; fly.visible = false; frogHome(); keysM.visible = false; S.catKeys = true; S.control = 'cat'; setDoor(1, true); setDoor(2, true); setStage('vent'); const [wx, wz] = L2W(2.3, -2.6); P.x = wx; P.z = wz; P.yaw = Math.PI; }
      if (to === 'evidence') { flyS.caught = true; fly.visible = false; frogHome(); keysM.visible = false; S.catKeys = true; S.control = 'cat'; grate.visible = false; ventCol.off = true; const [wx, wz] = L2W(2.25, -4.7); P.x = wx; P.z = wz; P.yaw = Math.PI; setStage('evidence'); }
      if (G.dialog) { G.dialog = null; document.getElementById('dialog').style.display = 'none'; }
    };
    setTimeout(go, S.active && S.stage !== 'intro' ? 0 : 1800);
  }
  const api = {
    start, end, skip, update, active: () => S.active, prompt: () => S.prompt || '', btn: () => S.btn || 'USE',
    state: () => ({ stage: S.stage, control: S.control, cop: cop$.phase, frog: { ...F }, fails: S.fails, catKeys: S.catKeys, evidence: S.evidence }),
    room, frog, cop, F, S, cop$, perched: () => perched, setCop: (ph) => { cop$.phase = ph; cop$.t = 0; cop$.dur = ph === 'snore' ? 60 : 60; }, makeFrog,
  };
  window.__JAIL = api;
  return api;
}
