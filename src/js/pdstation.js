// Maple Grove PD station interior for Maple Grove: Off Leash. Owned by the police station thread.
// Two interiors rooms (interiors.js contract, see rooms.js):
//   'pd'  ground floor: lobby + front desk (Sgt. Donuts), bullpen with four computer workstations, the chief's office,
//         the interview room, and the stairs up. Entered by the front door on Main St (places.station.door).
//   'pd2' upstairs: holding. Three cells laid out like the jailbreak cell block (cell 1 drunk-tank raccoon, cell 2 with
//         Bart's toilet, cell 3 with the loose floor vent), Officer Pruitt asleep at his desk, the evidence cage,
//         booking (mugshot wall, fingerprints, property lockers). Code-only room: reached by the stairs.
// Link to the jailbreak quest: the bunk in cell 2 starts "The Can" (window.__JAIL.start); the quest's own cell block
// is the same three cells. Walking into the station with 3+ stars gets you arrested at the desk; with any heat you can
// turn yourself in (pay a fine, heat cleared).
// Self-contained: wired into game.js by tools/pdstation-hooks.mjs (one import + PDST.init after DONUT.init).
// Debug: window.__PD (state(), up(), down(), enter()).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { registerRoom } from './interiors.js';
import { makeOfficer } from './officer.js';
import { makeRaccoon } from './models.js';
import { makeFrog, animFrog } from './jailbreak.js';

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[(rnd() * a.length) | 0];
const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const NAVY = 0x1e2a44, GOLD = 0xe0b440;

// ---------------- canvas textures (same style as rooms.js) ----------------
const texCache = new Map();
const ANISO = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 1 : 4;
function ctex(key, w, h, draw, o = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t); return t;
}
function grime(g, w, h, n, a = 0.08) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } }
function lines(g, ls, x, y, lh, font, color, align = 'center') { g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; ls.forEach((t, i) => g.fillText(t, x, y + i * lh)); }
function signTex(key, ls, bg, fg, w = 256, h = 96, o = {}) {
  return ctex('pd:' + key, w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    const n = ls.length, lh = Math.min(h / (n + 0.4), o.size || 999);
    if (o.glow) { g.shadowColor = fg; g.shadowBlur = lh * 0.5; }
    lines(g, ls, w / 2, h / 2 - (n - 1) * lh / 2 + 1, lh, `${o.weight || 'bold'} ${Math.round(lh * 0.78)}px ${o.font || 'Impact, "Arial Black", sans-serif'}`, fg);
    g.shadowBlur = 0;
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }
  }, { repeat: false });
}

// ---------------- merged-bucket builder (one mesh per material, vertex colours + baked AO) ----------------
function makeBuilder(T) {
  const buckets = {}, mats = {}, specs = {};
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const def = (key, spec) => { specs[key] = spec; };
  def('plain', { kind: 'lambert' });
  def('wood', { kind: 'lambert', map: T && T.wood });
  def('cloth', { kind: 'lambert', map: T && T.cloth });
  def('metal', { kind: 'phong', map: T && T.metal, shininess: 70, specular: 0x777777 });
  def('shiny', { kind: 'phong', shininess: 90, specular: 0x888888 });
  def('glow', { kind: 'basic' });
  def('glass', { kind: 'basic', transparent: true, opacity: 0.28, depthWrite: false });
  function material(key) {
    if (mats[key]) return mats[key];
    const { kind, ...rest } = specs[key] || specs.plain;
    if (!rest.map) delete rest.map;
    return (mats[key] = kind === 'basic' ? new THREE.MeshBasicMaterial({ vertexColors: true, ...rest }) : kind === 'phong' ? new THREE.MeshPhongMaterial({ vertexColors: true, ...rest }) : new THREE.MeshLambertMaterial({ vertexColors: true, ...rest }));
  }
  function add(geo, key, color, x = 0, y = 0, z = 0, ry = 0, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const n = g.attributes.position.count, c = new THREE.Color(color), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (o.s) g.scale(o.s[0], o.s[1], o.s[2]);
    if (o.rx || o.rz) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(o.rx || 0, 0, o.rz || 0)));
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s));
    if (o.ao !== false) {
      const pos = g.attributes.position, tint = o.tint === false ? 1 : 0.93 + rnd() * 0.12, lo = o.aoLo ?? 0.55, span = o.aoSpan ?? 1.3;
      for (let i = 0; i < n; i++) { const f = (lo + (1 - lo) * sm(pos.getY(i) / span)) * tint; col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f; }
    }
    if (o.paint) { const pos = g.attributes.position; for (let i = 0; i < n; i++) { const f = o.paint(pos.getX(i), pos.getY(i), pos.getZ(i)); col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f; } }
    (buckets[key] ||= []).push(g);
  }
  const uvs = (g, o) => { if (o.us || o.vs) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (o.us || 1), uv.getY(i) * (o.vs || 1)); } return g; };
  return {
    def, add, material,
    box(key, color, w, h, d, x, y, z, ry = 0, o = {}) { add(new THREE.BoxGeometry(w, h, d), key, color, x, y, z, ry, o); },
    cyl(key, color, rt, rb, h, x, y, z, s = 10, o = {}) { add(new THREE.CylinderGeometry(rt, rb, h, s), key, color, x, y, z, o.ry || 0, o); },
    sph(key, color, r, x, y, z, o = {}) { add(new THREE.SphereGeometry(r, o.ws || 8, o.hs || 6), key, color, x, y, z, 0, o); },
    /** Vertical quad facing +z before ry (PI faces -z, PI/2 faces +x, -PI/2 faces -x). */
    quad(key, color, w, h, x, y, z, ry = 0, o = {}) { add(uvs(new THREE.PlaneGeometry(w, h, o.sx || 1, o.sy || 1), o), key, color, x, y, z, ry, o); },
    flat(key, color, w, d, x, y, z, ry = 0, o = {}) { const g = new THREE.PlaneGeometry(w, d, o.sx || 1, o.sy || 1); g.rotateX(o.down ? Math.PI / 2 : -Math.PI / 2); add(uvs(g, o), key, color, x, y, z, ry, o); },
    finish(group) {
      for (const [k, list] of Object.entries(buckets)) {
        const g = mergeGeometries(list, false); if (!g) continue;
        const mesh = new THREE.Mesh(g, material(k)); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.name = 'pd:' + k; group.add(mesh);
      }
      return group;
    },
  };
}
const NO = { ao: false, tint: false };

/** Room shell: floor, 4 inward-facing walls (front wall split around the door), ceiling, baseboard + chair rail. */
function shell(B, o) {
  const { w, d, h, door, floorKey, wallKey, ceilKey } = o, hw = w / 2, hd = d / 2;
  const cornerAO = (x, y, z) => { const e = Math.min(hw - Math.abs(x), hd - Math.abs(z)); return (0.62 + 0.38 * sm(e / 0.9)) * (0.78 + 0.22 * sm((h - y) / 0.6)) * (0.55 + 0.45 * sm(y / 0.6)); };
  const floorAO = (x, _y, z) => 0.6 + 0.4 * sm(Math.min(hw - Math.abs(x), hd - Math.abs(z)) / 1.1);
  B.flat(floorKey, 0xffffff, w, d, 0, 0, 0, 0, { sx: Math.ceil(w), sy: Math.ceil(d), us: w / 2, vs: d / 2, ao: false, paint: floorAO });
  B.flat(ceilKey, 0xffffff, w, d, 0, h, 0, 0, { down: true, sx: Math.ceil(w / 2), sy: Math.ceil(d / 2), us: w / 1.2, vs: d / 1.2, ao: false, paint: (x, y, z) => floorAO(x, y, z) * 0.92 });
  const wall = (cx, cz, len, ry, hh = h, y = hh / 2) => B.quad(wallKey, 0xffffff, len, hh, cx, y, cz, ry, { sx: Math.ceil(len * 2), sy: Math.ceil(hh * 2), us: len / 1.6, vs: hh / 1.6, ao: false, paint: cornerAO, tint: false });
  wall(0, -hd, w, 0); wall(-hw, 0, d, Math.PI / 2); wall(hw, 0, d, -Math.PI / 2);
  const dl = door.x - door.w / 2, dr = door.x + door.w / 2, lw = dl + hw, rw = hw - dr;
  if (lw > 0.01) wall(-hw + lw / 2, hd, lw, Math.PI);
  if (rw > 0.01) wall(hw - rw / 2, hd, rw, Math.PI);
  wall(door.x, hd, door.w, Math.PI, h - door.h, door.h + (h - door.h) / 2);
  const strip = (color, cx, cz, len, hh, y, ry) => B.quad('plain', color, len, hh, cx + Math.sin(ry) * 0.012, y, cz + Math.cos(ry) * 0.012, ry, NO);
  const around = (color, hh, y) => {
    strip(color, 0, -hd, w, hh, y, 0); strip(color, -hw, 0, d, hh, y, Math.PI / 2); strip(color, hw, 0, d, hh, y, -Math.PI / 2);
    if (lw > 0.01) strip(color, -hw + lw / 2, hd, lw, hh, y, Math.PI);
    if (rw > 0.01) strip(color, hw - rw / 2, hd, rw, hh, y, Math.PI);
  };
  around(o.base, 0.14, 0.07); if (o.trim) around(o.trim, 0.08, o.trimY || 1.1);
  const t = 0.3, cols = [
    { kind: 'box', cx: 0, cz: -hd - t / 2, w: w + 2 * t, d: t, rot: 0, h }, { kind: 'box', cx: -hw - t / 2, cz: 0, w: t, d: d + 2 * t, rot: 0, h }, { kind: 'box', cx: hw + t / 2, cz: 0, w: t, d: d + 2 * t, rot: 0, h },
  ];
  if (lw > 0.01) cols.push({ kind: 'box', cx: -hw + lw / 2, cz: hd + t / 2, w: lw, d: t, rot: 0, h });
  if (rw > 0.01) cols.push({ kind: 'box', cx: hw - rw / 2, cz: hd + t / 2, w: rw, d: t, rot: 0, h });
  return cols;
}
function tube(B, x, y, z, len, ry = 0) { B.box('plain', 0xd0d0d0, len + 0.1, 0.08, 0.32, x, y + 0.05, z, ry, NO); B.box('glow', 0xf4f8ff, len, 0.04, 0.1, x, y, z, ry, NO); }
function picture(B, key, w, h, x, y, z, ry, frame = 0x2a2a30) {
  B.box('wood', frame, w + 0.08, h + 0.08, 0.04, x, y, z, ry, { ao: false });
  B.quad(key, 0xffffff, w, h, x + Math.sin(ry) * 0.025, y, z + Math.cos(ry) * 0.025, ry, NO);
}
/** Front-wall window seen from inside: night street, white frame, mullion. */
function frontWindow(B, x, y, z, w, h) {
  B.quad('pnight', 0xffffff, w, h, x, y, z - 0.02, Math.PI, NO);
  for (const yy of [y - h / 2, y + h / 2]) B.box('plain', 0xf0ece4, w + 0.12, 0.08, 0.1, x, yy, z - 0.04, 0, NO);
  for (const e of [-1, 0, 1]) B.box('plain', 0xf0ece4, 0.07, h, 0.08, x + e * w / 2, y, z - 0.04, 0, NO);
  B.box('plain', 0xe8e4dc, w + 0.2, 0.05, 0.22, x, y - h / 2 - 0.04, z - 0.1, 0, NO);
}
function officeChair(B, x, z, ry = 0, c = 0x2a2a34) {
  B.cyl('metal', 0x444448, 0.25, 0.25, 0.03, x, 0.06, z, 5, NO); B.cyl('metal', 0x555558, 0.03, 0.03, 0.4, x, 0.27, z, 6, NO);
  B.box('cloth', c, 0.46, 0.08, 0.44, x, 0.48, z, ry); B.box('cloth', c, 0.44, 0.5, 0.07, x - Math.sin(ry) * 0.21, 0.78, z - Math.cos(ry) * 0.21, ry);
}
/** Workstation: desk, beige CRT with a glowing records screen, keyboard, mug, papers. The sitter faces +z before ry. */
function workstation(B, x, z, ry, k) {
  const f = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  B.box('wood', 0x8a6a48, 1.5, 0.05, 0.75, x, 0.76, z, ry); for (const s of [-1, 1]) { const [a, b] = f(s * 0.7, 0); B.box('plain', 0x5a5a60, 0.05, 0.74, 0.7, a, 0.37, b, ry); }
  { const [a, b] = f(0.45, 0.02); B.box('plain', 0x6a6a70, 0.42, 0.6, 0.66, a, 0.43, b, ry); }   // drawer pedestal
  const [mx, mz] = f(-0.1, -0.18); B.box('plain', 0xd8d0b8, 0.46, 0.4, 0.42, mx, 1.0, mz, ry); B.box('plain', 0xc8c0a8, 0.3, 0.06, 0.26, mx, 0.81, mz, ry);
  const [sx, sz] = f(-0.1, 0.034); B.quad('pscreen' + (k % 3), 0xffffff, 0.36, 0.28, sx, 1.02, sz, ry, NO);
  { const [a, b] = f(-0.1, 0.18); B.box('plain', 0xd8d0b8, 0.44, 0.03, 0.15, a, 0.795, b, ry); }
  { const [a, b] = f(0.45, -0.05); B.cyl('plain', pick([0xffffff, 0xc03030, 0x3050a0]), 0.04, 0.035, 0.1, a, 0.83, b, 8, NO); }
  { const [a, b] = f(0.3, 0.15); B.box('plain', 0xf4f2ec, 0.22, 0.02, 0.3, a, 0.795, b, ry + 0.2, NO); B.box('plain', 0xe8e4d8, 0.22, 0.015, 0.3, a + 0.02, 0.81, b, ry - 0.1, NO); }
  { const [a, b] = f(0, 0.62); officeChair(B, a, b, ry); }
}

// ============================== ground floor ==============================
const PD_W = 16, PD_D = 10, PD_H = 3.2;
// stairs along the left wall: foot at z 0.9 (low) climbing toward the back, top 3.2 at z -3.9
const ST = { x0: -8, x1: -6.75, zFoot: 0.9, zTop: -3.9, rise: PD_H };
const ST_CX = (ST.x0 + ST.x1) / 2, ST_RUN = ST.zFoot - ST.zTop, STAIR_RAMP_END = -1.6;   // walkable part ends here (~1.67 m up)
const stairY = (z) => Math.max(0, Math.min(ST.rise, (ST.zFoot - z) / ST_RUN * ST.rise));

function buildGround(ctx) {
  const T = (ctx && ctx.T) || {}; seed = 23;
  const B = makeBuilder(T);
  const W = PD_W, D = PD_D, H = PD_H, hw = W / 2, hd = D / 2;
  const floorT = ctex('pd:floor', 64, 64, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#c8ccd0' : '#e8e4da'; g.fillRect(x * 32, y * 32, 32, 32); }
    for (let i = 0; i < 300; i++) { g.fillStyle = pick(['rgba(60,70,90,0.25)', 'rgba(255,255,255,0.3)', 'rgba(120,100,80,0.2)']); g.fillRect(rnd() * 64, rnd() * 64, 1, 1); }
    g.strokeStyle = 'rgba(40,40,50,0.25)'; g.strokeRect(0.5, 0.5, 63, 63); grime(g, 64, 64, 120, 0.12);
  });
  const wallT = ctex('pd:wall', 64, 64, (g) => {
    g.fillStyle = '#ece6d6'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(120,110,90,0.25)'; for (let y = 0; y < 64; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(64, y + 0.5); g.stroke(); for (let x = (y / 16) % 2 ? 16 : 0; x < 64; x += 32) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 16); g.stroke(); } }
    grime(g, 64, 64, 60, 0.08);
  });
  const ceilT = ctex('pd:ceil', 64, 64, (g) => { g.fillStyle = '#ecebe4'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 220; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } g.strokeStyle = '#b8b4a8'; g.lineWidth = 3; g.strokeRect(0, 0, 64, 64); });
  const night = ctex('pd:night', 64, 48, (g) => { g.fillStyle = '#121a2c'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#28304a'; g.fillRect(0, 34, 64, 14); g.fillStyle = 'rgba(80,110,255,0.35)'; g.fillRect(0, 0, 64, 16); g.fillStyle = '#f0d070'; g.fillRect(8, 22, 3, 3); g.fillRect(50, 26, 4, 3); }, { repeat: false });
  B.def('pfloor', { kind: 'lambert', map: floorT }); B.def('pwall', { kind: 'lambert', map: wallT }); B.def('pceil', { kind: 'lambert', map: ceilT }); B.def('pnight', { kind: 'basic', map: night });
  const screens = [
    ['MGPD RECORDS v2.1', '> QUERY: CAT', '1 RESULT FOUND', 'STATUS: ANNOYED', '_'],
    ['DISPATCH', 'UNIT 4: 10-8', 'UNIT 7: LUNCH', 'UNIT 2: LUNCH', '_'],
    ['SOLITAIRE', '', '  [K] [Q] [J]', '  [10][ 9]', 'YOU WIN!'],
  ];
  screens.forEach((s, i) => { const t = ctex('pd:scr' + i, 64, 48, (g) => { g.fillStyle = '#0c1a10'; g.fillRect(0, 0, 64, 48); lines(g, s, 4, 6, 9, '7px monospace', i === 2 ? '#90ff90' : '#60ff80', 'left'); g.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = 0; y < 48; y += 2) g.fillRect(0, y, 64, 1); }, { repeat: false }); B.def('pscreen' + i, { kind: 'basic', map: t }); });
  const cols = shell(B, { w: W, d: D, h: H, door: { x: 0, w: 1.6, h: 2.3 }, floorKey: 'pfloor', wallKey: 'pwall', ceilKey: 'pceil', base: NAVY, trim: NAVY, trimY: 1.1 });
  const add = (...c) => cols.push(...c.map((o) => ({ kind: 'box', rot: 0, ...o })));

  // ---- front wall: glass double doors, four windows (the facade's ground floor windows at x -6, -3.8, 3.8, 6) ----
  for (const s of [-1, 1]) { B.quad('plain', 0x2a3a5a, 0.78, 2.25, s * 0.4, 1.125, hd - 0.03, Math.PI, NO); B.quad('pnight', 0xffffff, 0.56, 1.5, s * 0.4, 1.35, hd - 0.04, Math.PI, NO); B.box('metal', 0xc8ccd4, 0.04, 0.04, 0.4, s * 0.1, 1.05, hd - 0.12, Math.PI / 2, NO); }
  for (const x of [-6, -3.8, 3.8, 6]) frontWindow(B, x, 1.75, hd, 1.4, 1.2);
  B.quad('plain', 0xffffff, 0.001, 0.001, 0, 0, 0);
  // ---- lobby ----
  // front desk: navy panelled counter with a gold seal, bulletproof glass above, a pass-through slot
  const DZ = 1.2;
  B.box('wood', NAVY, 4.8, 1.1, 0.7, 0, 0.55, DZ); B.box('shiny', 0xd8d4c8, 4.95, 0.05, 0.85, 0, 1.125, DZ, 0, NO);
  for (let i = 0; i < 4; i++) B.box('plain', 0x2a3a5e, 1.0, 0.7, 0.02, -1.8 + i * 1.2, 0.55, DZ + 0.36, 0, NO);
  const seal = ctex('pd:seal', 64, 64, (g) => { g.fillStyle = '#1e2a44'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e0b440'; g.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = k % 2 ? 18 : 28; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); g.fillStyle = '#1e2a44'; g.font = 'bold 11px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('MGPD', 32, 36); }, { repeat: false });
  B.def('pseal', { kind: 'basic', map: seal }); B.quad('pseal', 0xffffff, 0.55, 0.55, 0, 0.62, DZ + 0.375, 0, NO);
  B.box('glass', 0xd8ecff, 4.8, 1.0, 0.04, 0, 1.65, DZ - 0.1); B.box('metal', 0xb8bcc4, 4.85, 0.06, 0.08, 0, 2.18, DZ - 0.1, 0, NO);
  for (const x of [-2.4, -1.2, 1.2, 2.4]) B.box('metal', 0xb8bcc4, 0.05, 1.0, 0.07, x, 1.65, DZ - 0.1, 0, NO);
  B.box('metal', 0xa8acb4, 0.5, 0.04, 0.3, 0, 1.17, DZ, 0, NO);   // pass-through tray
  const wait = signTex('wait', ['PLEASE WAIT', 'TO BE CALLED'], '#fff', '#1e2a44', 128, 48, { border: '#1e2a44' }); B.def('pwait', { kind: 'lambert', map: wait }); B.quad('pwait', 0xffffff, 0.5, 0.19, -1.6, 1.9, DZ - 0.07, 0, NO);
  const sgt = signTex('sgt', ['SGT. DONUTS', 'DESK OFFICER'], '#e0b440', '#1e2a44', 128, 40); B.def('psgt', { kind: 'lambert', map: sgt }); B.box('wood', 0x5a3a20, 0.5, 0.12, 0.08, 1.4, 1.21, DZ + 0.3, 0, NO); B.quad('psgt', 0xffffff, 0.46, 0.1, 1.4, 1.21, DZ + 0.345, 0, NO);
  B.cyl('shiny', 0xd8b050, 0.05, 0.06, 0.05, 0.7, 1.175, DZ + 0.3, 10, NO); B.sph('shiny', 0xd8b050, 0.012, 0.7, 1.21, DZ + 0.3, NO);      // bell
  B.box('plain', 0xf8f0e0, 0.4, 0.08, 0.4, -0.9, 1.19, DZ - 0.15, 0.2); B.box('plain', 0xf090b0, 0.36, 0.01, 0.36, -0.9, 1.235, DZ - 0.15, 0.2, NO);  // donut box (inside)
  B.box('plain', 0xd8d0b8, 0.42, 0.36, 0.38, 1.0, 1.33, DZ - 0.12, Math.PI); B.quad('pscreen1', 0xffffff, 0.32, 0.24, 1.0, 1.35, DZ - 0.32, Math.PI, NO);
  B.box('plain', 0x222226, 0.22, 0.06, 0.16, -1.9, 1.18, DZ - 0.15, 0.3); // phone
  // gate on the left end (x -3.6 .. -2.4): a half door swung open into the bullpen
  B.box('wood', NAVY, 0.06, 1.0, 1.1, -3.55, 0.5, DZ - 0.5, 0); B.box('metal', 0xb8bcc4, 0.08, 0.05, 1.15, -3.55, 1.0, DZ - 0.5, 0, NO);
  // partitions lobby | bullpen (left, glass above 1.1 m) and lobby | interview room (right, solid)
  B.box('wood', NAVY, 4.4, 1.1, 0.14, -5.8, 0.55, DZ); B.box('glass', 0xd8ecff, 4.4, 1.3, 0.04, -5.8, 1.75, DZ); B.box('metal', 0xb8bcc4, 4.45, 0.06, 0.16, -5.8, 1.12, DZ, 0, NO); B.box('metal', 0xb8bcc4, 4.45, 0.06, 0.1, -5.8, 2.42, DZ, 0, NO);
  B.box('plain', 0xe8e2d2, 4.4, H - 2.45, 0.14, -5.8, 2.45 + (H - 2.45) / 2, DZ, 0, NO);
  B.box('plain', 0xe8e2d2, 5.6, H, 0.16, 5.2, H / 2, DZ); B.box('plain', NAVY, 5.62, 0.14, 0.18, 5.2, 0.07, DZ, 0, NO); B.box('plain', NAVY, 5.62, 0.08, 0.18, 5.2, 1.1, DZ, 0, NO);
  add({ cx: 0, cz: DZ, w: 4.8, d: 0.75, h: 2.2 }, { cx: -5.8, cz: DZ, w: 4.4, d: 0.16, h: H }, { cx: 5.2, cz: DZ, w: 5.6, d: 0.18, h: H });
  // benches under the front windows, stanchion ropes, a plant, the flag, a water fountain
  for (const x of [-5, 5]) { B.box('wood', 0x8a5a34, 2.6, 0.08, 0.5, x, 0.45, hd - 0.45); for (const e of [-1.1, 1.1]) B.box('metal', 0x555558, 0.06, 0.42, 0.45, x + e, 0.21, hd - 0.45, 0, NO); B.box('wood', 0x8a5a34, 2.6, 0.4, 0.06, x, 0.72, hd - 0.2); }
  add({ cx: -5, cz: hd - 0.4, w: 2.6, d: 0.6, h: 0.5 }, { cx: 5, cz: hd - 0.4, w: 2.6, d: 0.6, h: 0.5 });
  for (const x of [-1.8, 0, 1.8]) { B.cyl('metal', 0xd8b050, 0.025, 0.025, 0.9, x, 0.45, 2.3, 6, NO); B.cyl('metal', 0xd8b050, 0.14, 0.16, 0.04, x, 0.02, 2.3, 10, NO); B.sph('metal', 0xd8b050, 0.04, x, 0.92, 2.3, NO); }
  for (const x of [-0.9, 0.9]) B.add(new THREE.TorusGeometry(0.9, 0.022, 4, 12, Math.PI), 'cloth', 0xa02030, x, 0.86, 2.3, 0, { ao: false, tint: false, rz: Math.PI });
  B.cyl('plain', 0x8a5a3a, 0.2, 0.16, 0.38, -7.5, 0.19, 4.4, 8); B.sph('plain', 0x3a7a3a, 0.36, -7.5, 0.75, 4.4, { s: [1, 1.4, 1], ws: 7, hs: 5, ao: false });
  B.cyl('metal', 0xd8b050, 0.02, 0.02, 2.2, 7.4, 1.1, 4.4, 6, NO); B.cyl('metal', 0x555558, 0.18, 0.2, 0.06, 7.4, 0.03, 4.4, 8, NO); B.quad('pflag', 0xffffff, 0.9, 0.6, 7.4 - 0.45, 1.8, 4.4, Math.PI / 2, NO);
  const flag = ctex('pd:flag', 64, 40, (g) => { g.fillStyle = '#1e2a44'; g.fillRect(0, 0, 64, 40); g.fillStyle = '#e0b440'; g.beginPath(); g.arc(32, 20, 11, 0, 7); g.fill(); g.fillStyle = '#2f6a2f'; g.beginPath(); g.moveTo(32, 12); g.lineTo(38, 24); g.lineTo(26, 24); g.fill(); g.fillStyle = '#f4f0d8'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.fillText('MAPLE GROVE', 32, 37); }, { repeat: false });
  B.def('pflag', { kind: 'lambert', map: flag, side: THREE.DoubleSide });
  add({ cx: -7.5, cz: 4.4, w: 0.5, d: 0.5, h: 1.1 }, { cx: 7.4, cz: 4.4, w: 0.4, d: 0.4, h: 2.2 });
  B.box('shiny', 0xd8dce4, 0.4, 0.3, 0.32, 7.8, 0.95, 2.6); B.box('plain', 0x8a8e96, 0.3, 0.8, 0.2, 7.85, 0.4, 2.6); add({ cx: 7.8, cz: 2.6, w: 0.42, d: 0.4, h: 1.1 });
  // most wanted board (left wall): Goobles' own poster in the middle
  B.box('wood', 0xb08a58, 0.05, 1.1, 1.9, -hw + 0.03, 1.7, 3.1); B.box('wood', 0x5a3a22, 0.04, 1.2, 2.0, -hw + 0.02, 1.7, 3.1, 0, NO);
  const mw = signTex('mw', ['MOST WANTED'], '#a02030', '#fff', 192, 32); B.def('pmw', { kind: 'lambert', map: mw }); B.quad('pmw', 0xffffff, 1.6, 0.24, -hw + 0.06, 2.12, 3.1, Math.PI / 2, NO);
  if (T.posterCat) { B.def('pcatp', { kind: 'lambert', map: T.posterCat }); B.quad('pcatp', 0xffffff, 0.46, 0.66, -hw + 0.06, 1.6, 3.1, Math.PI / 2, NO); }
  const coon = ctex('pd:coon', 48, 64, (g) => { g.fillStyle = '#f4f0e0'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#111'; g.font = 'bold 8px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('WANTED', 24, 10); g.fillStyle = '#9a9aa0'; g.beginPath(); g.arc(24, 30, 12, 0, 7); g.fill(); g.fillStyle = '#2d2d32'; g.fillRect(12, 26, 24, 6); g.fillStyle = '#fff'; g.fillRect(17, 27, 3, 3); g.fillRect(28, 27, 3, 3); g.fillStyle = '#222'; g.font = '5px sans-serif'; g.fillText('"BANDIT"', 24, 50); g.fillText('TRASH CAN THEFT', 24, 57); }, { repeat: false });
  const gary = ctex('pd:gary', 48, 64, (g) => { g.fillStyle = '#f4f0e0'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#111'; g.font = 'bold 7px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('PERSON OF', 24, 9); g.fillText('INTEREST', 24, 17); g.fillStyle = '#e0b090'; g.beginPath(); g.arc(24, 33, 10, 0, 7); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(14, 22, 20, 5); g.fillStyle = '#222'; g.fillRect(19, 31, 3, 2); g.fillRect(26, 31, 3, 2); g.fillRect(20, 38, 8, 1); g.font = '5px sans-serif'; g.fillText('GARY (HOA)', 24, 52); g.fillText('EXCESSIVE MEMOS', 24, 59); }, { repeat: false });
  B.def('pcoon', { kind: 'lambert', map: coon }); B.def('pgary', { kind: 'lambert', map: gary });
  B.quad('pcoon', 0xffffff, 0.38, 0.5, -hw + 0.06, 1.55, 2.4, Math.PI / 2, NO); B.quad('pgary', 0xffffff, 0.38, 0.5, -hw + 0.06, 1.55, 3.8, Math.PI / 2, NO);
  // officer of the month (right wall, lobby)
  const ootm = ctex('pd:ootm', 48, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#1e2a44'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.fillText('OFFICER OF', 24, 8); g.fillText('THE MONTH', 24, 15); g.fillStyle = '#c8b8a0'; g.fillRect(8, 18, 32, 32); g.fillStyle = '#e0b090'; g.beginPath(); g.arc(24, 36, 9, 0, 7); g.fill(); g.fillStyle = '#24325a'; g.fillRect(14, 22, 20, 7); g.fillStyle = '#5a3a1e'; g.fillRect(18, 40, 12, 2); g.fillStyle = '#222'; g.font = '5px sans-serif'; g.fillText('SGT. DONUTS', 24, 57); g.fillText('(11 MONTHS RUNNING)', 24, 63); }, { repeat: false });
  B.def('pootm', { kind: 'lambert', map: ootm }); picture(B, 'pootm', 0.4, 0.55, hw - 0.03, 1.7, 3.6, -Math.PI / 2, 0xd8b050);
  // ---- bullpen ----
  for (const [x, z] of [[-4.9, -0.7], [-1.9, -0.7], [-4.9, -3.2], [-1.9, -3.2]]) workstation(B, x, z, 0, (Math.round(-x - z) >>> 0) % 3);
  for (const [x, z] of [[-4.9, -0.7], [-1.9, -0.7], [-4.9, -3.2], [-1.9, -3.2]]) add({ cx: x, cz: z, w: 1.5, d: 0.78, h: 0.79 }, { cx: x, cz: z + 0.62, w: 0.5, d: 0.5, h: 0.5 });
  // back wall: briefing whiteboard, copier, coffee station with donuts, water cooler
  const brief = ctex('pd:brief', 128, 64, (g) => {
    g.fillStyle = '#f8f8f4'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#c0302a'; g.font = 'bold 9px sans-serif'; g.textAlign = 'left'; g.fillText('BRIEFING', 4, 10);
    g.fillStyle = '#2040a0'; g.font = '7px sans-serif'; ['1. WHITE CAT, SHORT, ANNOYED', '2. DO NOT CHASE INTO TRAILERS', '3. DONUTS: SHARE THEM, MIKE', '4. HOA = NOT OUR PROBLEM'].forEach((t, i) => g.fillText(t, 4, 22 + i * 10));
    g.strokeStyle = '#30a040'; g.lineWidth = 1.5; g.strokeRect(92, 14, 30, 30); g.beginPath(); g.moveTo(92, 29); g.lineTo(122, 29); g.moveTo(107, 14); g.lineTo(107, 44); g.stroke(); g.fillStyle = '#c0302a'; g.beginPath(); g.arc(100, 22, 2.5, 0, 7); g.fill();
  }, { repeat: false });
  B.def('pbrief', { kind: 'lambert', map: brief }); B.box('metal', 0xb8bcc4, 2.5, 1.3, 0.05, -3.4, 1.8, -hd + 0.03, 0, NO); B.quad('pbrief', 0xffffff, 2.4, 1.2, -3.4, 1.8, -hd + 0.06, 0, NO);
  B.box('plain', 0xd8d4cc, 1.0, 1.0, 0.65, -0.3, 0.5, -hd + 0.4); B.box('plain', 0x6a6e76, 1.02, 0.08, 0.67, -0.3, 1.04, -hd + 0.4, 0, NO); B.box('glow', 0x60ff80, 0.12, 0.05, 0.02, -0.1, 0.92, -hd + 0.73, 0, NO); add({ cx: -0.3, cz: -hd + 0.4, w: 1.0, d: 0.7, h: 1.08 });
  B.box('wood', 0x7a5434, 1.4, 0.08, 0.6, 1.4, 0.9, -hd + 0.35); for (const e of [-0.62, 0.62]) B.box('plain', 0x555558, 0.05, 0.9, 0.55, 1.4 + e, 0.45, -hd + 0.35, 0, NO);
  B.box('plain', 0x222226, 0.3, 0.42, 0.3, 1.0, 1.15, -hd + 0.3); B.cyl('glass', 0xffffff, 0.08, 0.08, 0.16, 1.0, 1.03, -hd + 0.42, 10, NO); B.cyl('plain', 0x3a2410, 0.07, 0.07, 0.08, 1.0, 0.99, -hd + 0.42, 10, NO); B.box('glow', 0xff3030, 0.03, 0.02, 0.01, 1.1, 1.0, -hd + 0.46, 0, NO);
  B.box('plain', 0xf8f0e0, 0.5, 0.09, 0.42, 1.65, 0.985, -hd + 0.35, 0.1); B.box('plain', 0xf8f0e0, 0.5, 0.02, 0.42, 1.65, 1.2, -hd + 0.18, 0.1, { rx: -1.1, ao: false });
  for (let k = 0; k < 4; k++) B.add(new THREE.TorusGeometry(0.06, 0.028, 5, 10), 'plain', pick([0xd8a050, 0xff80b0, 0x5a3a20]), 1.5 + (k % 2) * 0.15, 1.06, -hd + 0.3 + ((k / 2) | 0) * 0.15, 0, { ao: false, tint: false, rx: Math.PI / 2 });
  const fresh = signTex('fresh', ['DONUTS ARE', 'FOR SWORN', 'OFFICERS ONLY'], '#fff', '#a02030', 96, 56, { font: 'sans-serif' }); B.def('pfresh', { kind: 'lambert', map: fresh }); B.quad('pfresh', 0xffffff, 0.4, 0.24, 1.4, 1.6, -hd + 0.02, 0, NO);
  add({ cx: 1.4, cz: -hd + 0.35, w: 1.4, d: 0.62, h: 0.95 });
  B.cyl('plain', 0xe8e8ec, 0.17, 0.17, 0.9, 2.3, 0.45, -hd + 0.35, 10); B.cyl('glass', 0xa0c8ff, 0.16, 0.16, 0.45, 2.3, 1.12, -hd + 0.35, 10, NO); add({ cx: 2.3, cz: -hd + 0.35, w: 0.4, d: 0.4, h: 1.35 });
  // filing cabinets against the office wall
  for (let i = 0; i < 2; i++) { B.box('metal', 0x7a828e, 0.5, 1.3, 0.62, 2.4, 0.65, -1.2 - i * 0.55, Math.PI / 2); for (let k = 0; k < 4; k++) B.box('plain', 0x4a5058, 0.02, 0.04, 0.16, 2.14, 0.25 + k * 0.3, -1.2 - i * 0.55, 0, NO); }
  add({ cx: 2.4, cz: -1.47, w: 0.64, d: 1.1, h: 1.3 });
  // ---- stairs up to holding (left wall) ----
  const NST = 16, run = ST_RUN / NST, sw = ST.x1 - ST.x0;
  for (let i = 0; i < NST; i++) {
    const top = (i + 1) * ST.rise / NST, z = ST.zFoot - (i + 0.5) * run;
    B.box('plain', 0x9a968c, sw, top, run, ST_CX, top / 2, z, 0, { aoLo: 0.7 });
    B.box('plain', 0x3a3a40, sw, 0.03, 0.05, ST_CX, top + 0.005, z + run / 2 - 0.02, 0, NO);
  }
  // inner side: handrail on posts, stringer
  for (let i = 0; i <= 4; i++) { const z = ST.zFoot - 0.1 - i * (ST_RUN - 0.2) / 4, y = stairY(z); B.box('metal', 0x2a2a30, 0.05, 0.95, 0.05, ST.x1 + 0.02, y + 0.47, z, 0, NO); }
  const rl = Math.hypot(ST_RUN, ST.rise), ra = Math.atan2(ST.rise, ST_RUN);
  B.box('metal', 0x2a2a30, 0.06, 0.06, rl, ST.x1 + 0.02, ST.rise / 2 + 0.95, (ST.zFoot + ST.zTop) / 2, 0, { ao: false, rx: ra });
  B.box('plain', 0x6a665e, 0.08, 0.25, rl, ST.x1 + 0.04, ST.rise / 2 - 0.1, (ST.zFoot + ST.zTop) / 2, 0, { ao: false, rx: ra });
  B.flat('glow', 0x0c0c10, sw, 3.6, ST_CX, H - 0.01, ST.zTop + 1.8, 0, { down: true, ao: false, tint: false });   // the stairwell opening above
  const up = signTex('up', ['HOLDING', '2F  ↑'], '#1e2a44', '#f4f0d8', 96, 48); B.def('pup', { kind: 'lambert', map: up }); B.quad('pup', 0xffffff, 0.6, 0.3, ST.x1 + 0.06, 2.3, 0.9, Math.PI / 2, NO);
  add({ cx: ST_CX, cz: (ST.zTop + STAIR_RAMP_END) / 2 - 0.5, w: sw, d: STAIR_RAMP_END - ST.zTop + 1, h: H },   // upper flight: solid (you go up before it)
    { cx: ST.x1 + 0.05, cz: (0.5 + -4.95) / 2, w: 0.1, d: 0.5 + 4.95, h: H });                             // inner rail: enter at the foot only
  // ---- offices: chief (back) and interview room (front), wall along x = 2.8 with two doors ----
  const OX = 2.8;
  const blinds = ctex('pd:blinds', 32, 32, (g) => { g.fillStyle = '#d8d4c4'; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(80,70,50,0.35)'; for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 32, 1); }, {});
  B.def('pblinds', { kind: 'lambert', map: blinds });
  const seg = (z0, z1, win) => {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    B.box('plain', 0xe8e2d2, 0.14, win ? 1.0 : H, len, OX, win ? 0.5 : H / 2, cz);
    if (win) { B.box('pblinds', 0xffffff, 0.1, 1.3, len - 0.1, OX, 1.65, cz, 0, { ao: false, tint: false, vs: 6 }); B.box('plain', 0xe8e2d2, 0.14, H - 2.3, len, OX, 2.3 + (H - 2.3) / 2, cz, 0, NO); B.box('metal', 0xb8bcc4, 0.16, 0.06, len, OX, 1.0, cz, 0, NO); }
    B.box('plain', NAVY, 0.16, 0.14, len, OX, 0.07, cz, 0, NO);
    add({ cx: OX, cz, w: 0.16, d: len, h: H });
  };
  seg(-hd, -3.4, true); seg(-2.4, -0.6, true); seg(0.4, DZ, false);
  for (const [z0, z1] of [[-3.4, -2.4], [-0.6, 0.4]]) { B.box('plain', 0xe8e2d2, 0.14, H - 2.2, z1 - z0, OX, 2.2 + (H - 2.2) / 2, (z0 + z1) / 2, 0, NO); for (const z of [z0, z1]) B.box('wood', 0x6a4a2a, 0.18, 2.2, 0.06, OX, 1.1, z, 0, NO); }
  for (const z of [-3.35, -0.55]) B.box('wood', 0x6a4a2a, 0.9, 2.1, 0.05, OX + 0.53, 1.05, z + 0.03, 0, { aoLo: 0.8 });   // doors swung open flat against the wall
  const chiefS = signTex('chief', ['CHIEF'], '#e0b440', '#1e2a44', 64, 24); B.def('pchief', { kind: 'lambert', map: chiefS }); B.quad('pchief', 0xffffff, 0.5, 0.18, OX - 0.08, 2.45, -2.9, -Math.PI / 2, NO);
  const intS = signTex('int', ['INTERVIEW 1'], '#e0b440', '#1e2a44', 96, 24); B.def('pint', { kind: 'lambert', map: intS }); B.quad('pint', 0xffffff, 0.6, 0.16, OX - 0.08, 2.45, -0.1, -Math.PI / 2, NO);
  B.box('plain', 0xe8e2d2, hw - OX, H, 0.16, (OX + hw) / 2, H / 2, -1.5); add({ cx: (OX + hw) / 2, cz: -1.5, w: hw - OX, d: 0.16, h: H });
  // chief's office: big desk facing the door, chair, mounted bass, plaques, a "GONE FISHING" sign
  B.box('wood', 0x5a3a20, 0.95, 0.78, 1.9, 6.1, 0.39, -3.25); B.box('wood', 0x7a5434, 1.05, 0.05, 2.0, 6.1, 0.8, -3.25, 0, NO);
  officeChair(B, 7.0, -3.25, -Math.PI / 2, 0x5a2a1a);
  B.box('plain', 0x222226, 0.2, 0.05, 0.14, 6.0, 0.84, -2.6); B.cyl('shiny', 0x2a6a3a, 0.08, 0.1, 0.03, 6.2, 0.84, -3.9, 8, NO); B.cyl('shiny', 0x2a6a3a, 0.01, 0.01, 0.35, 6.2, 1.0, -3.9, 4, NO); B.sph('glow', 0xfff0c0, 0.06, 6.15, 1.18, -3.82, NO);
  const gone = signTex('gone', ['GONE', 'FISHING'], '#fff', '#2a5a8a', 64, 48, { border: '#2a5a8a' }); B.def('pgone', { kind: 'lambert', map: gone }); B.box('plain', 0xffffff, 0.3, 0.22, 0.02, 5.7, 0.94, -3.25, Math.PI / 2 + 0.3, { rz: 0, ao: false }); B.quad('pgone', 0xffffff, 0.28, 0.2, 5.68, 0.94, -3.25 + 0.01, -Math.PI / 2 + 0.3, NO);
  B.box('wood', 0x5a3a20, 0.05, 0.5, 1.1, hw - 0.04, 2.0, -3.25, 0, NO); B.box('plain', 0x6a9ab0, 0.1, 0.22, 0.8, hw - 0.1, 2.0, -3.25, 0, { ao: false }); B.box('plain', 0x6a9ab0, 0.06, 0.3, 0.12, hw - 0.1, 2.0, -3.75, 0, { ao: false, rx: 0.4 });   // mounted bass
  for (const z of [-4.4, -2.1]) picture(B, 'pootm', 0.3, 0.4, hw - 0.03, 1.8, z, -Math.PI / 2, 0x5a3a20);
  B.box('metal', 0x7a828e, 0.62, 1.3, 0.5, 3.4, 0.65, -hd + 0.28); B.cyl('metal', 0xd8b050, 0.02, 0.02, 2.0, 7.6, 1.0, -4.6, 6, NO); B.quad('pflag', 0xffffff, 0.6, 0.4, 7.3, 1.7, -4.6, 0, NO);
  add({ cx: 6.1, cz: -3.25, w: 1.05, d: 2.0, h: 0.83 }, { cx: 7.0, cz: -3.25, w: 0.5, d: 0.5, h: 0.5 }, { cx: 3.4, cz: -hd + 0.28, w: 0.62, d: 0.5, h: 1.3 });
  // interview room: steel table, two chairs, hanging lamp, a one-way mirror
  B.box('metal', 0x8a8e96, 1.2, 0.05, 0.8, 5.4, 0.76, -0.15); for (const [a, b] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) B.box('metal', 0x5a5e66, 0.04, 0.74, 0.04, 5.4 + a, 0.37, -0.15 + b, 0, NO);
  for (const s of [-1, 1]) { const x = 5.4 + s * 0.95; B.box('metal', 0x6a6e76, 0.42, 0.05, 0.42, x, 0.46, -0.15); B.box('metal', 0x6a6e76, 0.05, 0.5, 0.42, x + s * 0.2, 0.72, -0.15, 0, NO); for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.box('metal', 0x4a4e56, 0.03, 0.45, 0.03, x + a, 0.22, -0.15 + b, 0, NO); }
  B.cyl('plain', 0x222226, 0.005, 0.005, 1.0, 5.4, H - 0.5, -0.15, 3, NO); B.cyl('metal', 0x3a3e46, 0.08, 0.26, 0.2, 5.4, H - 1.05, -0.15, 10, NO); B.sph('glow', 0xfff0c0, 0.06, 5.4, H - 1.15, -0.15, NO);
  B.box('shiny', 0x1a2028, 0.04, 1.0, 1.6, hw - 0.03, 1.6, -0.15, 0, NO); B.box('metal', 0x8a8e96, 0.06, 1.1, 1.7, hw - 0.02, 1.6, -0.15, 0, NO);
  B.box('plain', 0x6a6e76, 0.3, 0.02, 0.22, 5.2, 0.795, -0.1, 0.3, NO);   // a file on the table
  add({ cx: 5.4, cz: -0.15, w: 1.2, d: 0.8, h: 0.79 }, { cx: 4.45, cz: -0.15, w: 0.45, d: 0.45, h: 0.5 }, { cx: 6.35, cz: -0.15, w: 0.45, d: 0.45, h: 0.5 });
  // ceiling lights
  for (const [x, z] of [[-4.5, -1.95], [-1.3, -1.95], [-5, 3.2], [0, 3.2], [5, 3.2], [5.4, -3.2]]) tube(B, x, H - 0.1, z, 1.2);

  const group = B.finish(new THREE.Group());
  // ---- people: Sgt. Donuts at the desk, an officer typing in the bullpen ----
  const sgtM = makeOfficer({ variant: 1, skin: 0, hair: 1 }); sgtM.position.set(0, 0, DZ - 0.6); sgtM.rotation.y = 0; group.add(sgtM);
  const typist = makeOfficer({ variant: 0, skin: 2, hair: 2 }); typist.position.set(-1.9, 0, -0.7 + 0.62); typist.rotation.y = Math.PI; seatPose(typist, 'type'); group.add(typist);
  const update = (t) => {
    const u = sgtM.userData; if (u.head) u.head.rotation.y = Math.sin(t * 0.6) * 0.35;
    if (u.arms) u.arms[0].rotation.x = -0.15 + Math.sin(t * 0.9) * 0.08;
    const v = typist.userData; if (v.armsL) for (let i = 0; i < 2; i++) v.armsL[i].rotation.x = -0.35 + Math.max(0, Math.sin(t * (14 + i * 3) + i)) * 0.18;
    stairTick('pd', t);
  };
  return {
    group, size: [W, D], cols,
    floors: [{ t0: stairY(STAIR_RAMP_END), t1: 0, cx: ST_CX, cz: (STAIR_RAMP_END + ST.zFoot) / 2, hw: sw / 2 - 0.02, hd: (ST.zFoot - STAIR_RAMP_END) / 2, c: 1, s: 0 }],
    spawn: { x: 0, z: hd - 1.2, yaw: 0 },
    exit: { x: 0, z: hd + 0.05, r: 0.7 },
    lights: [
      { x: 0, y: H - 0.3, z: 3.2, c: 0xf4f8ff, i: 0.60, always: true }, { x: -5, y: H - 0.3, z: 3.2, c: 0xf4f8ff, i: 0.48, always: true }, { x: 5, y: H - 0.3, z: 3.2, c: 0xf4f8ff, i: 0.48, always: true },
      { x: -4.5, y: H - 0.3, z: -1.95, c: 0xf0f4ff, i: 0.60, always: true }, { x: -1.3, y: H - 0.3, z: -1.95, c: 0xf0f4ff, i: 0.60, always: true },
      { x: 5.4, y: H - 0.3, z: -3.2, c: 0xfff0d8, i: 0.48, always: true }, { x: 5.4, y: H - 1.2, z: -0.15, c: 0xffe0a0, i: 0.54, always: true },
      { x: ST_CX, y: 2.4, z: -1.0, c: 0xe8f0ff, i: 0.5, always: true }, { x: 0.8, y: 1.6, z: 0.4, c: 0x80ffa0, i: 0.15, always: true },
    ],
    cam: { maxDist: 4.5, height: 2.75 },
    interact: [
      { id: 'desk', x: 0, z: DZ + 0.75, r: 1.0, label: 'Talk to Sgt. Donuts' },
      { id: 'bell', x: 0.7, z: DZ + 0.7, r: 0.5, label: 'Ring the bell' },
      { id: 'wanted', x: -7.4, z: 3.1, r: 0.9, label: 'Most Wanted board' },
      { id: 'upstairs', x: -7.1, z: 0.85, r: 0.55, label: 'Go upstairs (Holding)' },
      { id: 'computer', x: -4.9, z: 0.1, r: 0.7, label: 'Use the computer' },
      { id: 'computer', x: -4.9, z: -2.4, r: 0.7, label: 'Use the computer' },
      { id: 'computer', x: -1.9, z: -2.4, r: 0.7, label: 'Use the computer' },
      { id: 'typist', x: -1.9, z: 0.55, r: 0.6, label: 'Bother Officer Mike' },
      { id: 'coffee', x: 1.4, z: -hd + 0.95, r: 0.7, label: 'Coffee and donuts' },
      { id: 'briefing', x: -3.4, z: -hd + 0.8, r: 0.8, label: 'Read the briefing board' },
      { id: 'chief', x: 5.3, z: -3.25, r: 0.7, label: "Chief's desk" },
      { id: 'interview', x: 4.45, z: 0.4, r: 0.6, label: 'Sit in the hot seat' },
    ],
    update,
  };
}

/** Sit an officer down (feet on the floor, or leaned back with feet up). */
function seatPose(o, kind) {
  const u = o.userData, sc = u.scale || 0.86;
  if (kind === 'type') {
    for (const l of u.legs) l.rotation.x = -1.45; for (const l of u.legsL) l.rotation.x = 1.45;
    for (const a of u.arms) { a.rotation.x = -0.75; a.rotation.z *= 0.4; } for (const a of u.armsL) a.rotation.x = -0.35;
    o.position.y = 0.48 - 0.86 * sc + 0.04;
  } else {   // 'feetup': leaned back, legs out straight onto the desk, hands behind the head
    u.torso.rotation.x = -0.45;
    for (const l of u.legs) l.rotation.x = -1.75; for (const l of u.legsL) l.rotation.x = 0.05;
    for (const a of u.arms) { a.rotation.x = -2.6; a.rotation.z *= 1.8; } for (const a of u.armsL) a.rotation.x = -1.6;
    o.position.y = 0.48 - 0.86 * sc + 0.12;
  }
}

// ============================== upstairs: holding ==============================
const UP_W = 16, UP_D = 10, UP_H = 3.0;
// three cells along the back wall like the jailbreak block; doors at each cell's +x end
const CELLS = [[-5.6, -2.2], [-2.0, 1.4], [1.6, 5.0]], CELL_Z = -1.8;
const UP_SPAWN = { x: -6.2, z: -4.35, yaw: Math.PI };     // top of the stairs, facing down the passage (+z)
const DOWN_SPAWN = { x: -6.25, z: 0.82, yaw: -Math.PI / 2 };   // foot of the stairs downstairs, facing into the bullpen

function buildUpstairs(ctx) {
  const T = (ctx && ctx.T) || {}; seed = 41;
  const B = makeBuilder(T);
  const W = UP_W, D = UP_D, H = UP_H, hw = W / 2, hd = D / 2;
  const conc = ctex('pd:conc', 64, 64, (g) => { g.fillStyle = '#9c9a94'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 500; i++) { g.fillStyle = pick(['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.12)']); g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } g.strokeStyle = 'rgba(40,40,40,0.3)'; g.beginPath(); g.moveTo(0, 0.5); g.lineTo(64, 0.5); g.moveTo(0.5, 0); g.lineTo(0.5, 64); g.stroke(); g.fillStyle = 'rgba(60,50,30,0.18)'; g.beginPath(); g.ellipse(40, 30, 10, 6, 0.4, 0, 7); g.fill(); });
  const block = ctex('pd:block', 64, 64, (g) => {
    g.fillStyle = '#c8d4c4'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e4e2d6'; g.fillRect(0, 0, 64, 30);
    g.strokeStyle = 'rgba(70,80,70,0.3)'; for (let y = 0; y < 64; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(64, y + 0.5); g.stroke(); for (let x = (y / 16) % 2 ? 16 : 0; x < 64; x += 32) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 16); g.stroke(); } }
    grime(g, 64, 64, 90, 0.1);
  });
  const ceil = ctex('pd:ceil2', 64, 64, (g) => { g.fillStyle = '#d8d6ce'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#a8a69c'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); grime(g, 64, 64, 140, 0.12); });
  const night = ctex('pd:night', 64, 48, () => {}, { repeat: false });
  B.def('pconc', { kind: 'lambert', map: conc }); B.def('pblock', { kind: 'lambert', map: block }); B.def('pceil2', { kind: 'lambert', map: ceil }); B.def('pnight', { kind: 'basic', map: night });
  const cols = shell(B, { w: W, d: D, h: H, door: { x: 7.0, w: 0.9, h: 2.1 }, floorKey: 'pconc', wallKey: 'pblock', ceilKey: 'pceil2', base: 0x4a5a4a, trim: 0x4a5a4a, trimY: 1.2 });
  const add = (...c) => cols.push(...c.map((o) => ({ kind: 'box', rot: 0, ...o })));
  // front windows (the facade's upper row: x -6, -3.8, 0, 3.8, 6) with security bars
  for (const x of [-6, -3.8, 0, 3.8, 6]) { frontWindow(B, x, 1.65, hd, 1.3, 1.1); for (let k = -2; k <= 2; k++) B.box('metal', 0x3a3c42, 0.03, 1.1, 0.03, x + k * 0.26, 1.65, hd - 0.12, 0, NO); }
  // the front "door" in the shell is the fire exit on the front wall's right end (never opens)
  B.quad('plain', 0x8a3030, 0.88, 2.08, 7.0, 1.04, hd - 0.02, Math.PI, NO); B.box('metal', 0xc8ccd4, 0.7, 0.06, 0.08, 7.0, 1.0, hd - 0.08, 0, NO);
  const fe = signTex('fe', ['EMERGENCY EXIT', 'ALARM WILL SOUND'], '#c02020', '#fff', 128, 40); B.def('pfe', { kind: 'lambert', map: fe }); B.quad('pfe', 0xffffff, 0.6, 0.19, 7.0, 1.55, hd - 0.04, Math.PI, NO);
  add({ cx: 7.0, cz: hd + 0.15, w: 0.9, d: 0.3, h: H });
  // ---- stairwell (left wall): landing at the back, hole down the rest, railing ----
  const sw = ST.x1 - ST.x0;
  B.flat('glow', 0x101014, sw, 0.9 - ST.zTop + 0.05, ST_CX, 0.012, (0.9 + ST.zTop) / 2, 0, NO);
  for (let i = 0; i < 6; i++) B.box('plain', 0x8a867c, sw, 0.03, 0.3, ST_CX, 0.004 - i * 0.002, ST.zTop + 0.15 + i * 0.3, 0, { ao: false, tint: false, paint: () => 1 - i * 0.14 });   // first steps going down
  for (let i = 0; i <= 5; i++) B.box('metal', 0x2a2a30, 0.05, 1.0, 0.05, ST.x1 + 0.03, 0.5, ST.zTop + 0.05 + i * (0.9 - ST.zTop) / 5, 0, NO);
  B.box('metal', 0x2a2a30, 0.07, 0.06, 0.9 - ST.zTop + 0.1, ST.x1 + 0.03, 1.0, (0.9 + ST.zTop) / 2, 0, NO); B.box('metal', 0x2a2a30, sw, 0.06, 0.07, ST_CX, 1.0, 0.95, 0, NO);
  for (const x of [ST.x0 + 0.3, ST.x0 + 0.9]) B.box('metal', 0x2a2a30, 0.05, 1.0, 0.05, x, 0.5, 0.95, 0, NO);
  const dn = signTex('dn', ['↓  LOBBY'], '#1e2a44', '#f4f0d8', 96, 32); B.def('pdn', { kind: 'lambert', map: dn }); B.quad('pdn', 0xffffff, 0.6, 0.2, ST.x0 + 0.03, 2.1, ST.zTop - 0.55, Math.PI / 2, NO);
  add({ cx: ST.x1 + 0.04, cz: (0.95 + ST.zTop + 0.1) / 2, w: 0.1, d: 0.95 - ST.zTop - 0.1, h: H }, { cx: ST_CX, cz: 0.96, w: sw + 0.1, d: 0.1, h: H });
  // ---- cells ----
  B.box('plain', 0xc8d4c4, 0.2, H, -CELL_Z - hd + 0.0 + hd * 2 - hd, CELLS[0][0] - 0.1, H / 2, (CELL_Z - hd) / 2, 0, { aoLo: 0.7 });   // passage wall (left of cell 1)
  add({ cx: CELLS[0][0] - 0.1, cz: (CELL_Z - hd) / 2, w: 0.2, d: hd + CELL_Z, h: H });
  CELLS.forEach(([x0, x1], i) => {
    // right-hand partition (cell 3's is the evidence cage wall)
    B.box('plain', 0xc8d4c4, 0.2, H, hd + CELL_Z, x1 + 0.1, H / 2, (CELL_Z - hd) / 2, 0, { aoLo: 0.7 }); add({ cx: x1 + 0.1, cz: (CELL_Z - hd) / 2, w: 0.2, d: hd + CELL_Z, h: H });
    const dx0 = x1 - 1.05;                           // door x0..x1 at the +x end
    const open = i === 1;                            // cell 2 stands open (visit The Can)
    for (let x = x0 + 0.08; x < dx0 - 0.02; x += 0.15) B.box('metal', 0x3a3c42, 0.035, H, 0.035, x, H / 2, CELL_Z, 0, NO);
    for (const y of [0.08, 1.2, H - 0.08]) B.box('metal', 0x3a3c42, dx0 - x0, 0.07, 0.07, (x0 + dx0) / 2, y, CELL_Z, 0, NO);
    const ox = open ? -0.9 : 0, dz = open ? -0.08 : 0;  // slid open behind the fixed bars
    for (let k = 0; k < 7; k++) B.box('metal', 0x2e3036, 0.035, H - 0.2, 0.035, dx0 + 0.08 + k * 0.15 + ox, H / 2 - 0.05, CELL_Z + dz, 0, NO);
    for (const y of [0.25, 1.2, H - 0.3]) B.box('metal', 0x2e3036, 1.05, 0.07, 0.07, dx0 + 0.52 + ox, y, CELL_Z + dz, 0, NO);
    B.box('metal', 0x8a8a90, 0.14, 0.22, 0.1, dx0 + 0.95 + ox, 1.1, CELL_Z + dz + 0.06, 0, NO);
    const num = signTex('cell' + i, [String(i + 1)], '#1e2a44', '#f4f0d8', 32, 32); B.def('pcell' + i, { kind: 'lambert', map: num }); B.quad('pcell' + i, 0xffffff, 0.22, 0.22, (x0 + x1) / 2, H - 0.3, CELL_Z + 0.05, 0, NO);
    add({ cx: (x0 + dx0) / 2, cz: CELL_Z, w: dx0 - x0, d: 0.12, h: H });
    if (!open) add({ cx: dx0 + 0.52, cz: CELL_Z, w: 1.05, d: 0.12, h: H });
    else add({ cx: dx0 + 0.52 - 0.9, cz: CELL_Z - 0.08, w: 1.05, d: 0.1, h: H });
    // bunk on chains along the back wall, thin mattress
    B.box('metal', 0x8a8e96, 1.9, 0.06, 0.7, x0 + 1.15, 0.45, -hd + 0.38); B.box('cloth', 0x8a9a7a, 1.85, 0.08, 0.65, x0 + 1.15, 0.52, -hd + 0.38);
    for (const e of [-0.9, 0.9]) B.box('metal', 0x5a5e66, 0.02, 0.7, 0.02, x0 + 1.15 + e, 0.85, -hd + 0.7, 0, NO);
    add({ cx: x0 + 1.15, cz: -hd + 0.38, w: 1.9, d: 0.7, h: 0.56 });
    // scratched tally marks
    for (let k = 0; k < 5 + i * 3; k++) B.box('plain', 0x6a7266, 0.01, 0.16, 0.012, x0 + 0.3 + k * 0.04 + ((k / 5) | 0) * 0.08, 1.6, -hd + 0.012, 0, { ao: false, rz: k % 5 === 4 ? 1.1 : 0 });
  });
  // cell 2: steel toilet (Bart's), sink, drain
  const tx = CELLS[1][0] + 0.35, tz = -2.9;
  B.box('shiny', 0xc8ccd4, 0.42, 0.42, 0.5, tx, 0.21, tz - 0.25); B.cyl('shiny', 0xd8dce4, 0.21, 0.19, 0.08, tx, 0.44, tz, 12, NO); B.cyl('glow', 0x1a2a34, 0.15, 0.15, 0.01, tx, 0.485, tz, 12, NO);
  B.box('shiny', 0xc8ccd4, 0.36, 0.08, 0.32, tx, 0.85, tz - 0.75); add({ cx: tx, cz: tz - 0.15, w: 0.45, d: 0.7, h: 0.48 });
  B.cyl('plain', 0x4a4e56, 0.06, 0.06, 0.005, CELLS[1][0] + 1.5, 0.006, -3.2, 8, NO);
  // cell 3: the loose floor vent on the back wall
  B.box('metal', 0x6a6e76, 0.7, 0.45, 0.04, CELLS[2][0] + 2.6, 0.3, -hd + 0.03, 0, NO); for (let k = 0; k < 5; k++) B.box('plain', 0x2a2c30, 0.6, 0.03, 0.02, CELLS[2][0] + 2.6, 0.14 + k * 0.08, -hd + 0.055, 0, NO);
  // ---- evidence cage (x 5.2 .. 8) ----
  const mesh = ctex('pd:mesh', 32, 32, (g) => { g.clearRect(0, 0, 32, 32); g.strokeStyle = '#9aa0a8'; g.lineWidth = 1.5; for (let k = -32; k < 64; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 32, 32); g.moveTo(k + 32, 0); g.lineTo(k, 32); g.stroke(); } }, {});
  B.def('pmesh', { kind: 'lambert', map: mesh, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const EX0 = CELLS[2][1] + 0.2;
  B.quad('pmesh', 0xffffff, hw - EX0, H, (EX0 + hw) / 2, H / 2, CELL_Z, 0, { ao: false, tint: false, us: (hw - EX0) * 3, vs: H * 3 });
  for (const x of [EX0, (EX0 + hw) / 2, hw - 0.05]) B.box('metal', 0x6a6e76, 0.06, H, 0.06, x, H / 2, CELL_Z, 0, NO);
  B.box('metal', 0x6a6e76, hw - EX0, 0.06, 0.06, (EX0 + hw) / 2, H - 0.05, CELL_Z, 0, NO); B.box('metal', 0xd8b050, 0.12, 0.18, 0.06, (EX0 + hw) / 2 + 0.5, 1.1, CELL_Z + 0.04, 0, NO);
  for (const y of [0.4, 1.1, 1.8]) { B.box('metal', 0x8a8e96, 1.6, 0.04, 0.5, 6.9, y, -hd + 0.3); for (let k = 0; k < 3; k++) B.box('plain', pick([0xb89a6a, 0xa8885a, 0xc8aa7a]), 0.38, 0.3, 0.36, 6.3 + k * 0.55, y + 0.17, -hd + 0.3, rnd() * 0.2); }
  B.cyl('plain', 0xff70a8, 0.06, 0.08, 0.3, 6.0, 0.15, -3.0, 8); B.sph('plain', 0xff70a8, 0.14, 6.0, 0.4, -3.0, { s: [1, 0.8, 1.4] }); B.cyl('plain', 0xff70a8, 0.02, 0.02, 0.4, 6.0, 0.6, -2.85, 4, { rx: 0.4 }); B.cyl('plain', 0x222222, 0.01, 0.01, 0.5, 6.0, -0.1 + 0.3, -3.0, 3, NO);   // confiscated flamingo
  const hoa = signTex('hoa', ['HOA NOTICE', 'NO CATS'], '#fff', '#a02030', 96, 48, { border: '#a02030' }); B.def('phoa', { kind: 'lambert', map: hoa }); B.quad('phoa', 0xffffff, 0.5, 0.25, 7.2, 0.7, -2.6, -0.3, NO); B.box('wood', 0x8a6a48, 0.04, 0.8, 0.04, 7.2, 0.4, -2.62, 0, NO);
  const ev = signTex('ev', ['EVIDENCE'], '#e0b440', '#1e2a44', 96, 24); B.def('pev', { kind: 'lambert', map: ev }); B.quad('pev', 0xffffff, 0.7, 0.18, (EX0 + hw) / 2, 2.6, CELL_Z + 0.05, 0, NO);
  add({ cx: (EX0 + hw) / 2, cz: CELL_Z, w: hw - EX0, d: 0.1, h: H });
  // ---- Pruitt's desk at the corridor's +x end (he sits with his back to the cells' corridor, feet up) ----
  B.box('wood', 0x6a4a2a, 0.8, 0.76, 1.4, 6.9, 0.38, -0.6); B.box('wood', 0x8a6a48, 0.86, 0.05, 1.46, 6.9, 0.78, -0.6, 0, NO);
  B.box('plain', 0xf8f0e0, 0.36, 0.08, 0.36, 6.8, 0.84, -1.05); B.cyl('plain', 0xffffff, 0.045, 0.04, 0.1, 7.1, 0.85, -0.2, 8, NO);
  B.box('plain', 0x333336, 0.14, 0.05, 0.1, 6.9, 0.82, 0.0); B.cyl('glow', 0xff2020, 0.035, 0.035, 0.02, 6.9, 0.86, 0.0, 8, NO);   // the buzzer
  B.add(new THREE.TorusGeometry(0.05, 0.01, 4, 10), 'metal', 0xd8b040, 7.0, 0.82, -0.5, 0, { ao: false, tint: false, rx: Math.PI / 2 });
  officeChair(B, 6.0, -0.6, -Math.PI / 2, 0x2a2a34);
  const buzz = signTex('buzz', ['DO NOT', 'PRESS'], '#fff', '#c02020', 64, 40, { border: '#c02020' }); B.def('pbuzz', { kind: 'lambert', map: buzz }); B.quad('pbuzz', 0xffffff, 0.14, 0.09, 6.9, 0.81, 0.08, 0, { ao: false, tint: false, rx: -Math.PI / 2 });
  add({ cx: 6.9, cz: -0.6, w: 0.86, d: 1.46, h: 0.82 }, { cx: 6.0, cz: -0.6, w: 0.5, d: 0.5, h: 0.5 });
  // ---- booking (front half): mugshot wall, camera, fingerprint counter, booking desk, cuff bench, property lockers ----
  const chart = ctex('pd:chart', 64, 96, (g) => {
    g.fillStyle = '#d8dcd8'; g.fillRect(0, 0, 64, 96); g.strokeStyle = '#222'; g.fillStyle = '#222'; g.font = 'bold 6px sans-serif'; g.textAlign = 'left';
    for (let k = 0; k <= 8; k++) { const y = 96 - k * 11; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(64, y + 0.5); g.stroke(); g.fillText(`${k}'`, 2, y - 2); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 40; k++) { const y = 96 - k * 2.75; g.fillRect(56, y, 8, 0.6); }
  }, { repeat: false });
  B.def('pchart', { kind: 'lambert', map: chart }); B.quad('pchart', 0xffffff, 1.8, 2.4, -hw + 0.02, 1.2, 3.3, Math.PI / 2, NO);
  B.box('metal', 0x555558, 0.03, 1.3, 0.03, -5.4, 0.65, 3.3, 0, NO); for (const a of [0, 2.1, 4.2]) B.box('metal', 0x555558, 0.02, 1.3, 0.02, -5.4 + Math.cos(a) * 0.2, 0.62, 3.3 + Math.sin(a) * 0.2, 0, { ao: false, rx: Math.sin(a) * 0.15, rz: -Math.cos(a) * 0.15 });
  B.box('plain', 0x222226, 0.22, 0.16, 0.2, -5.4, 1.38, 3.3); B.cyl('plain', 0x111114, 0.05, 0.06, 0.1, -5.53, 1.38, 3.3, 8, { ao: false, rz: Math.PI / 2 }); B.box('glow', 0xffffff, 0.06, 0.04, 0.05, -5.42, 1.5, 3.3, 0, NO);
  const placard = signTex('plac', ['MAPLE GROVE PD', 'GOOBLES', '#0001'], '#111', '#fff', 96, 48, { font: 'monospace' }); B.def('pplac', { kind: 'lambert', map: placard }); B.box('wood', 0x3a2a1a, 0.4, 0.04, 0.3, -7.7, 0.5, 4.6, 0); B.quad('pplac', 0xffffff, 0.28, 0.14, -7.7, 0.62, 4.75, Math.PI, { ao: false, tint: false, rx: 0 });
  add({ cx: -5.4, cz: 3.3, w: 0.5, d: 0.5, h: 1.5 });
  B.box('plain', 0xd8d4cc, 1.4, 0.95, 0.6, -3.6, 0.475, hd - 0.4); B.box('shiny', 0xe8e4dc, 1.45, 0.04, 0.65, -3.6, 0.97, hd - 0.4, 0, NO); B.box('plain', 0x111114, 0.3, 0.01, 0.2, -3.9, 0.995, hd - 0.4, 0, NO); B.box('plain', 0xf4f2ec, 0.3, 0.01, 0.4, -3.3, 0.995, hd - 0.45, 0.1, NO);
  add({ cx: -3.6, cz: hd - 0.4, w: 1.4, d: 0.62, h: 0.99 });
  workstation(B, 1.0, 2.6, 0, 0); add({ cx: 1.0, cz: 2.6, w: 1.5, d: 0.78, h: 0.79 });
  B.box('wood', 0x8a5a34, 2.4, 0.08, 0.5, 3.6, 0.45, hd - 0.4); B.box('metal', 0x8a8e96, 2.4, 0.04, 0.04, 3.6, 0.7, hd - 0.17, 0, NO); for (const e of [-1.1, 1.1]) B.box('metal', 0x555558, 0.06, 0.42, 0.45, 3.6 + e, 0.21, hd - 0.4, 0, NO);
  add({ cx: 3.6, cz: hd - 0.4, w: 2.4, d: 0.55, h: 0.5 });
  for (let k = 0; k < 6; k++) { const z = 0.9 + k * 0.45; B.box('metal', 0x5a6a7a, 0.45, 1.9, 0.43, hw - 0.25, 0.95, z, 0, { aoLo: 0.7 }); B.box('plain', 0x3a4a5a, 0.01, 0.1, 0.25, hw - 0.48, 1.5, z, 0, NO); B.box('plain', 0xd8d8d0, 0.01, 0.06, 0.12, hw - 0.48, 1.7, z, 0, NO); }
  add({ cx: hw - 0.25, cz: 0.9 + 2.5 * 0.45, w: 0.48, d: 6 * 0.45, h: 1.9 });
  for (const [x, z] of [[-3.8, -0.4], [0, -0.4], [3.8, -0.4], [-3.8, 3], [3.8, 3]]) tube(B, x, H - 0.1, z, 1.2);
  const group = B.finish(new THREE.Group());
  // ---- Officer Pruitt asleep with his feet on the desk, Zzz; the cell 1 raccoon asleep; Bart on the toilet rim ----
  const pruitt = makeOfficer({ variant: 1, skin: 3, hair: 0 }); pruitt.position.set(6.0, 0, -0.6); pruitt.rotation.y = Math.PI / 2; seatPose(pruitt, 'feetup'); group.add(pruitt);
  const zz = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: signTex('zz', ['Zzz'], null, '#ffffff', 64, 64, { glow: true }), transparent: true, depthWrite: false })); zz.position.set(6.0, 1.75, -0.6); group.add(zz);
  const coon = makeRaccoon(); coon.position.set(CELLS[0][0] + 1.0, 0.56, -hd + 0.4); coon.rotation.y = 0.4; coon.scale.setScalar(0.9); group.add(coon);
  const zz2 = zz.clone(); zz2.position.set(CELLS[0][0] + 1.2, 1.15, -hd + 0.5); zz2.scale.setScalar(0.7); group.add(zz2);
  const bart = makeFrog(); bart.position.set(tx, 0.49, tz + 0.14); bart.rotation.y = 0.4; group.add(bart);
  PD.bart = bart;
  const update = (t) => {
    zz.position.y = 1.75 + (t * 0.25) % 0.4; zz.material.opacity = 1 - ((t * 0.25) % 0.4) / 0.4; zz.lookAt(zz.position.x - 5, zz.position.y, zz.position.z); zz.rotation.set(0, -Math.PI / 2 + 0.6, 0);
    zz2.position.y = 1.15 + ((t * 0.2 + 0.2) % 0.4); zz2.rotation.y = 0.2;
    const u = pruitt.userData; if (u.torso) u.torso.rotation.x = -0.45 + Math.sin(t * 1.1) * 0.03;
    if (bart.visible) try { animFrog(bart, t, 0.016, 'idle'); } catch (e) { /* frog anim optional */ }
    stairTick('pd2', t);
  };
  return {
    group, size: [W, D], cols,
    spawn: UP_SPAWN,
    exit: { x: 0, z: hd + 4, r: 0.2 },        // code-only room: you leave by the stairs (the ring sits outside the walls)
    lights: [
      { x: -3.8, y: H - 0.3, z: -0.4, c: 0xe8f0ff, i: 0.75, always: true }, { x: 0, y: H - 0.3, z: -0.4, c: 0xe8f0ff, i: 0.75, always: true }, { x: 3.8, y: H - 0.3, z: -0.4, c: 0xe8f0ff, i: 0.75, always: true },
      { x: -3.8, y: H - 0.3, z: 3, c: 0xf0f4ff, i: 0.60, always: true }, { x: 3.8, y: H - 0.3, z: 3, c: 0xf0f4ff, i: 0.60, always: true },
      { x: -0.3, y: 2.2, z: -3.4, c: 0xd8e4ff, i: 0.5, always: true }, { x: 6.6, y: 1.5, z: -0.3, c: 0xff4040, i: 0.12, always: true },
    ],
    cam: { maxDist: 4.2, height: 2.6 },
    interact: [
      { id: 'downstairs', x: -7.35, z: -4.45, r: 0.6, label: 'Go downstairs (Lobby)' },
      { id: 'bunk2', x: -0.8, z: -4.0, r: 0.8, label: 'Nap on the bunk (start The Can)' },
      { id: 'toilet2', x: tx + 0.2, z: tz + 0.55, r: 0.55, label: 'Peek in the toilet' },
      { id: 'raccoon', x: -4.0, z: CELL_Z + 0.5, r: 0.8, label: 'Raccoon in the drunk tank' },
      { id: 'cell3', x: 3.0, z: CELL_Z + 0.5, r: 0.8, label: 'Cell 3' },
      { id: 'pruitt', x: 5.3, z: 0.2, r: 0.7, label: 'Poke Officer Pruitt' },
      { id: 'buzzer', x: 6.4, z: 0.35, r: 0.4, label: 'Press the buzzer' },
      { id: 'evidence', x: 6.6, z: CELL_Z + 0.5, r: 0.7, label: 'Evidence cage' },
      { id: 'mugshot', x: -7.3, z: 3.3, r: 0.8, label: 'Pose for a mugshot' },
      { id: 'prints', x: -3.6, z: hd - 1.05, r: 0.6, label: 'Get fingerprinted' },
      { id: 'lockers', x: hw - 0.9, z: 2.0, r: 0.7, label: 'Property lockers' },
      { id: 'fireexit', x: 7.0, z: hd - 0.6, r: 0.6, label: 'Emergency exit' },
    ],
    update,
  };
}

// ============================== behaviour ==============================
const PD = { ctx: null, last: 0, armedT: 0, cuffT: -1, coffeeT: -99, warned: false, bart: null, trips: 0, turned: 0 };
const say1 = (a) => a[(Math.random() * a.length) | 0];
const LINES = {
  desk: ['Sgt. Donuts: "Lost and found is closed. Forever."', 'Sgt. Donuts: "Unless you\'re reporting a crime, I\'m on my break." (He is always on his break.)', 'Sgt. Donuts: "You again. Paws off the counter."', 'Sgt. Donuts: "If this is about the HOA, take a number. The number is never."'],
  bell: ['DING. Sgt. Donuts doesn\'t look up.', 'DING DING. "I heard you the first time."', 'DING. Somewhere upstairs, Pruitt snores louder.'],
  wanted: ['MOST WANTED: a white cat, "short, annoyed". The photo is very flattering.', 'Bandit the raccoon: wanted for trash can theft. Gary: "person of interest" for excessive memos.'],
  typist: ['Officer Mike types with two fingers. "Hunt... and... peck."', 'Officer Mike: "Can\'t talk. Solitaire is at a critical stage."'],
  briefing: ['BRIEFING: 1. White cat, short, annoyed. 2. Do not chase into trailers. 3. Share the donuts, Mike.'],
  chief: ['A sign on the desk: GONE FISHING. There is a bass mounted on the wall. It looks smug.', 'The chief\'s inbox: 41 HOA complaints about the same cat. All stamped "LOL".'],
  interview: ['You sit in the hot seat. The lamp buzzes. You confess to nothing. You are a cat.', 'You stare at the one-way mirror. Your reflection stares back, unimpressed.'],
  raccoon: ['A raccoon snores in the drunk tank, hugging a pizza box. Bandit, from the poster.', 'The raccoon mumbles "...five more minutes..." and rolls over.'],
  cell3: ['Cell 3. The floor vent on the back wall rattles in the draft. Loose screws. Interesting.'],
  pruitt: ['Officer Pruitt: "Zzz... five more donuts... Zzz."', 'You poke Officer Pruitt. He snores harder.', 'Pruitt mumbles "...not the cat..." in his sleep.'],
  buzzer: ['You think better of it. That buzzer would wake the whole block.'],
  evidence: ['EVIDENCE: a pink lawn flamingo, a stack of HOA signs, boxes marked "CAT RELATED". Locked.'],
  mugshot: ['FLASH. Goobles, 0.6 m on the height chart. Expression: indifferent. A classic.', 'FLASH. You hold up the placard. #0001. Frame-worthy.'],
  prints: ['One paw print on file. It is adorable. It will not hold up in court.'],
  lockers: ['Property lockers. One label says "GOOBLES: 1 YARN BALL, 1 ATTITUDE".'],
  fireexit: ['EMERGENCY EXIT. ALARM WILL SOUND. You are many things, but not that dumb.'],
};
function toast(t, d = 3.5) { const c = PD.ctx; if (c && c.toast) c.toast(t, d); }
function blip(f = 660) { const c = PD.ctx; try { c && c.Sfx && c.Sfx.blip && c.Sfx.blip(f); } catch (e) { /* ignore */ } }
function fineFor(heat) { return 20 + 25 * heat; }
function inStation() { const id = window.__INT && window.__INT.current && window.__INT.current(); return id === 'pd' || id === 'pd2'; }
function stationOutside() {   // just outside the front door (world), for saves from upstairs
  const st = PD.ctx && PD.ctx.places && PD.ctx.places.station; if (!st || !st.door) return null;
  return { x: st.door.x + Math.sin(st.door.yaw) * 1.2, z: st.door.z + Math.cos(st.door.yaw) * 1.2, yaw: st.door.yaw };
}
function go(id, spawn) {
  const I = window.__INT; if (!I || (I.state && I.state.fading)) return false;
  PD.armedT = 1.2; PD.trips++;
  blip(420);
  return I.enter(id, { spawn, returnTo: id === 'pd2' ? stationOutside() : undefined });
}
// per frame while inside either floor (called from the room's update): stairs, the wanted-in-the-lobby arrest
function stairTick(id, t) {
  const C = PD.ctx; if (!C) return;
  const dt = Math.max(0, Math.min(0.1, t - PD.last)); PD.last = t;
  const I = window.__INT, R = I && I.room; if (!R || R.id !== id) return;
  const P = C.P, lx = P.x - R.origin.x, lz = P.z - R.origin.z;
  if (PD.armedT > 0) PD.armedT -= dt;
  else if (id === 'pd' && lx < ST.x1 && lz < STAIR_RAMP_END + 0.7 && P.y > 1.1) go('pd2', UP_SPAWN);
  else if (id === 'pd2' && lx < ST.x1 - 0.05 && lz > ST.zTop + 0.15 && lz < 0.9) go('pd', DOWN_SPAWN);
  // walked in with 3+ stars: the desk sergeant has had enough
  const G = C.G;
  if (G.heat >= 3) {
    if (PD.cuffT < 0) { PD.cuffT = 3.5; toast('Sgt. Donuts: "You walked into a POLICE STATION with three stars?" He reaches for the cuffs. RUN!', 3.5); try { C.Sfx && C.Sfx.siren && C.Sfx.siren(); } catch (e) { /* ignore */ } }
    else if ((PD.cuffT -= dt) <= 0) { PD.cuffT = -1; arrest('Booked at the front desk.'); }
  } else PD.cuffT = -1;
}
function arrest(why) {
  const C = PD.ctx, G = C.G, fine = Math.min(G.cash | 0, 40 + 30 * G.heat);
  G.cash = (G.cash | 0) - fine;
  if (window.__JAIL && typeof window.__JAIL.start === 'function') { try { window.__JAIL.start({ from: 'police', fine, station: C.places.station }); return; } catch (e) { console.warn('[pdstation] jail hand-off failed', e); } }
  toast(`${why} Fined $${fine}.`, 4); G.heat = 0;
}
function onInteract(room, spot) {
  if (room !== 'pd' && room !== 'pd2') return false;
  const C = PD.ctx, G = C.G;
  switch (spot) {
    case 'upstairs': go('pd2', UP_SPAWN); return true;
    case 'downstairs': go('pd', DOWN_SPAWN); return true;
    case 'desk':
      if (G.heat > 0) {
        const fine = Math.min(G.cash | 0, fineFor(G.heat));
        G.cash = (G.cash | 0) - fine; G.heat = 0; G.seenT = 0; G.bustT = 0; PD.turned++;
        toast(`You turn yourself in. Sgt. Donuts stamps a form: "Fine's $${fine}. Now scram, and stay out of trouble." Heat cleared.`, 5);
        try { C.Sfx && C.Sfx.jingle && C.Sfx.jingle(); } catch (e) { /* ignore */ }
        if (C.save) try { C.save(); } catch (e) { /* ignore */ }
      } else toast(say1(LINES.desk));
      return true;
    case 'computer': {
      const n = G.jailbreaks | 0;
      toast(`MGPD RECORDS > GOOBLES. Jailbreaks: ${n}. Turned self in: ${PD.turned}. Current heat: ${'*'.repeat(G.heat) || 'none'}. Notes: "short, annoyed".`, 5); blip(880); return true;
    }
    case 'coffee':
      if ((G.time || 0) - PD.coffeeT < 60) { toast('Sgt. Donuts (from the desk): "ONE donut, cat."'); return true; }
      PD.coffeeT = G.time || 0; G.hp = Math.min(100, (G.hp || 0) + 20); toast('Stale coffee and a sprinkle donut. +20 health. Nobody saw. Probably.'); blip(990); return true;
    case 'bunk2':
      if (G.heat > 0) { toast('Pruitt snorts awake for a second: "Not while you\'re wanted, pal. Desk downstairs." Zzz.'); return true; }
      if (window.__JAIL && typeof window.__JAIL.start === 'function') {
        toast('You curl up on the bunk. The cell door clangs shut behind you...', 2.5);
        setTimeout(() => { try { if (inStation()) window.__JAIL.start({ from: 'police', fine: 0, station: C.places.station }); } catch (e) { console.warn('[pdstation] The Can', e); } }, 900);
      } else toast('You nap on the bunk. Surprisingly comfy for a jail cell.');
      return true;
    case 'toilet2': toast(PD.bart && PD.bart.visible ? 'BART (from the toilet rim): "Visiting hours are over. Unless you brought flies."' : 'The toilet is quiet. Bart is riding on your head, living his best life.', 4); return true;
    case 'buzzer': toast(LINES.buzzer[0]); return true;
    default: { const L = LINES[spot]; if (L) { toast(say1(L), 4); blip(spot === 'mugshot' ? 1400 : 660); return true; } }
  }
  return false;
}
function onEnter(id) {
  if (id !== 'pd' && id !== 'pd2') return;
  const C = PD.ctx, I = window.__INT, R = I && I.room;
  PD.armedT = 1.0; PD.last = (C.G && C.G.time) || 0;
  if (R && R.exitM && id === 'pd2') R.exitM.visible = false;
  if (id === 'pd2' && PD.bart) {   // Bart broke out with you this session: the rim is empty
    let rides = false; try { C.scene && C.scene.traverse((o) => { if (o.userData && o.userData.ride) rides = true; }); } catch (e) { /* ignore */ }
    PD.bart.visible = !rides;
  }
  if (id === 'pd' && C.G.heat > 0 && C.G.heat < 3 && !PD.warned) { PD.warned = true; toast('Sgt. Donuts eyes your wanted stars. "Pay at the desk, or scram."', 3.5); }
  if (C.G.heat === 0) PD.warned = false;
}

export const PD_ROOM = { name: 'Maple Grove PD', build: buildGround };
export const PD2_ROOM = { name: 'Maple Grove PD - Holding (2F)', build: buildUpstairs };

/** Register both floors with the interiors system. ctx = { G, P, places, toast, Sfx, scene, save }. */
export function init(ctx) {
  PD.ctx = ctx;
  const st = ctx.places && ctx.places.station;
  let door = null;
  if (st && st.door) {   // places.station.door is in front of the steps; the entry sits 1.1 m back toward the building
    const y = st.door.yaw; door = { x: st.door.x - Math.sin(y) * 1.1, z: st.door.z - Math.cos(y) * 1.1, yaw: y, kind: 'door' };
  }
  registerRoom('pd', PD_ROOM, door);
  registerRoom('pd2', PD2_ROOM);
  const I = window.__INT;
  if (I && I.on) { I.on('interact', onInteract); I.on('enter', onEnter); }
  window.__PD = {
    state: () => ({ inside: window.__INT && window.__INT.current(), trips: PD.trips, cuffT: PD.cuffT, turned: PD.turned, door }),
    enter: () => window.__INT.enter('pd', { instant: true }),
    up: () => go('pd2', UP_SPAWN), down: () => go('pd', DOWN_SPAWN),
    ST, UP_SPAWN, DOWN_SPAWN, STAIR_RAMP_END,
  };
  return window.__PD;
}
