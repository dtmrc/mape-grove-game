// Inside the Maple Grove VFD fire station and Maple Grove Community Hospital (diet 2026-11-28: "we should also have
// interior of the fire station and hospital"). Built like the Estates houses (mansions.js): one floor plan per
// building, a merged mesh per material, one art atlas, every lamp baked, unloaded again when not in use.
//   firehouse  22 x 14 m: two-bay apparatus floor (Engine 1, turnout gear, hose racks, the pole), watch office,
//              dayroom + kitchen, bunk room. Doors: the office door and the open bay.
//   hospital   34 x 16 m: lobby + reception, gift shop and cafe, pharmacy, exam room, corridor, two patient rooms,
//              nurses' station, X-ray, operating room, the ER (waiting, triage, three bays). Doors: main entrance, ER.
// Room-local x = the building's local x in world.js minus a constant, so doors line up with the outside.
// Wired in game.js: CIVIC.init({ G, places, toast, addCash, Sfx }). Debug: window.__G.civic.
import * as THREE from 'three';
import * as INTR from './interiors.js';
import { KIT } from './rooms.js';
import { makeAtlas, plan, parts, zoneLights } from './roomparts.js';
import { floorTextures } from './mansions.js';

const PI = Math.PI;
let A = null;
const S = { used: {}, entries: {} };
const say = (lines, t = 4) => A && A.toast(Array.isArray(lines) ? lines[(Math.random() * lines.length) | 0] : lines, t);
const heal = (n) => { if (A) A.G.hp = Math.min(100, (A.G.hp || 0) + n); };
const pay = (n) => { if (!A || (A.G.cash || 0) < n) return false; A.addCash(-n); A.Sfx.pickup && A.Sfx.pickup(); return true; };

function setup(ctx, seed) {
  const { makeBuilder, rnd, pick } = KIT;
  KIT.reseed(seed);
  const B = makeBuilder(THREE, ctx.T), tex = floorTextures(), atlas = makeAtlas(THREE, 1024), lights = [];
  B.def('pwall', { kind: 'lambert', map: tex.plaster }); B.def('fwood', { kind: 'lambert', map: tex.wood }); B.def('ftile', { kind: 'lambert', map: tex.tile });
  B.def('night', { kind: 'basic', map: tex.night }); B.def('mirror', { kind: 'phong', shininess: 120, specular: 0xffffff });
  B.def('atlas', { kind: 'lambert', map: atlas.tex }); B.def('aglow', { kind: 'basic', map: atlas.tex });
  return { B, atlas, lights, rnd, pick };
}
/** a sign hanging from the ceiling, readable from both sides */
function hangSign(P, x, z, ry, H, y, w, h, tex) { const F = P.at(x, z, ry); for (const e of [-1, 1]) F.box('plain', 0x8a8a90, 0.012, H - y - h / 2, 0.012, e * (w / 2 - 0.1), (H + y + h / 2) / 2, 0); F.box('plain', 0x2a2a2e, w + 0.04, h + 0.04, 0.03, 0, y, 0); P.decal(F, tex, w, h, 0, y, 0.017, 0, 'aglow'); P.decal(F, tex, w, h, 0, y, -0.017, PI, 'aglow'); }
/** glass doors with daylight behind them, filling a doorway in the front wall */
function glassDoors(P, x, z, w, h, frame = 0xc8ccd4) { const F = P.at(x, z, PI); F.quad('night', 0xffffff, w, h, 0, h / 2, -0.02); for (const e of [-1, 0, 1]) F.box('shiny', frame, 0.05, h, 0.06, e * (w / 2 - 0.025), h / 2, 0); F.box('shiny', frame, w, 0.06, 0.06, 0, h - 0.03, 0); F.box('shiny', frame, w, 0.05, 0.06, 0, 1.0, 0); }

// =====================================================================================================================
// Fire station
// =====================================================================================================================
const FW = 22, FD = 14, FH = 4.6, FWING = 3.0;
const FIRE_DX = 1.4;   // room x = building local x - FIRE_DX... (bays at local -6 and 2, office door at local 11.4)

function fireEngine(P, atlas, x, z, ry) {
  const F = P.at(x, z, ry), RED = 0xc81e1e, CHROME = 0xd8dce4, DARK = 0x1a1a1e, WHITE = 0xf4f4f0;
  F.box('plain', DARK, 2.2, 0.3, 8.0, 0, 0.62, 0);
  for (const lz of [3.0, -2.3, -3.4]) for (const e of [-1, 1]) { F.cyl('plain', 0x141416, 0.52, 0.52, 0.42, e * 1.05, 0.52, lz, 12, { rz: PI / 2 }); F.cyl('shiny', CHROME, 0.26, 0.26, 0.44, e * 1.05, 0.52, lz, 8, { rz: PI / 2 }); F.box('plain', RED, 0.5, 0.12, 1.3, e * 1.05, 1.12, lz); }
  // cab
  F.rbox('shiny', RED, 2.5, 1.95, 2.1, 0, 1.75, 3.1, 0, { round: 0.08 }); F.box('plain', WHITE, 2.52, 0.5, 2.12, 0, 2.5, 3.1);
  F.box('plain', 0x24343e, 2.2, 0.8, 0.03, 0, 2.2, 4.16); for (const e of [-1, 1]) { F.box('plain', 0x24343e, 0.03, 0.7, 0.8, e * 1.26, 2.2, 3.55); F.box('plain', 0x24343e, 0.03, 0.7, 0.7, e * 1.26, 2.2, 2.65); F.box('plain', DARK, 0.03, 1.5, 0.03, e * 1.26, 1.6, 3.1); F.box('shiny', CHROME, 0.04, 0.1, 0.2, e * 1.27, 1.55, 3.3); F.box('shiny', CHROME, 0.1, 0.34, 0.2, e * 1.42, 2.25, 4.0); }
  F.box('shiny', CHROME, 1.5, 0.6, 0.05, 0, 1.3, 4.17); for (let k = 0; k < 6; k++) F.box('plain', DARK, 1.4, 0.03, 0.02, 0, 1.08 + k * 0.09, 4.2);
  F.rbox('shiny', CHROME, 2.6, 0.34, 0.4, 0, 0.75, 4.3, 0, { round: 0.05 });
  for (const e of [-1, 1]) { F.box('glow', 0xfff4d0, 0.36, 0.22, 0.04, e * 0.95, 1.3, 4.18, 0, { tint: false }); F.box('glow', 0xffb020, 0.14, 0.14, 0.04, e * 0.95, 1.6, 4.18, 0, { tint: false }); }
  F.box('shiny', CHROME, 1.9, 0.08, 0.34, 0, 2.8, 3.5); for (let k = 0; k < 6; k++) F.box('glow', k % 2 ? 0xff2a20 : 0xfff0f0, 0.28, 0.14, 0.26, -0.8 + k * 0.32, 2.9, 3.5, 0, { tint: false });
  const e1 = atlas.label('e1', ['E-1'], '#c81e1e', '#ffd23f', 64, 32), vfd = atlas.label('vfd', ['MAPLE GROVE VFD'], '#c81e1e', '#ffd23f', 192, 28);
  for (const e of [-1, 1]) { P.decal(F, e1, 0.6, 0.3, e * 1.262, 1.25, 3.1, e * PI / 2); P.decal(F, vfd, 2.6, 0.38, e * 1.262, 2.25, -0.9, e * PI / 2); }
  // body: compartments with roll-up shutters, pump panel, white stripe
  F.box('shiny', RED, 2.5, 1.75, 6.1, 0, 1.6, -1.05);
  for (const e of [-1, 1]) {
    F.box('plain', WHITE, 0.02, 0.2, 6.1, e * 1.262, 1.02, -1.05);
    for (let k = 0; k < 4; k++) { const lz = -3.55 + k * 1.2; if (k === 3) continue; F.box('metal', 0xb8bcc4, 0.02, 0.86, 1.05, e * 1.262, 1.6, lz); for (let r = 0; r < 5; r++) F.box('plain', 0x8a8e96, 0.025, 0.012, 1.05, e * 1.262, 1.25 + r * 0.17, lz); F.box('shiny', CHROME, 0.03, 0.05, 0.3, e * 1.27, 1.22, lz); }
    // pump panel
    F.box('plain', 0x2a2a2e, 0.03, 1.2, 1.1, e * 1.262, 1.6, 1.45);
    for (let k = 0; k < 6; k++) { F.cyl('shiny', CHROME, 0.07, 0.07, 0.03, e * 1.28, 1.95 - ((k / 3) | 0) * 0.22, 1.15 + (k % 3) * 0.3, 8, { rz: PI / 2 }); F.cyl('glow', 0xf4f4e8, 0.055, 0.055, 0.035, e * 1.282, 1.95 - ((k / 3) | 0) * 0.22, 1.15 + (k % 3) * 0.3, 8, { rz: PI / 2, tint: false }); }
    for (let k = 0; k < 3; k++) { F.cyl('shiny', CHROME, 0.08, 0.08, 0.14, e * 1.33, 1.25, 1.1 + k * 0.35, 8, { rz: PI / 2 }); F.box('plain', k === 1 ? 0xe8c020 : RED, 0.05, 0.16, 0.03, e * 1.3, 1.48, 1.1 + k * 0.35); }
    F.box('shiny', CHROME, 0.22, 0.04, 6.0, e * 1.3, 0.72, -1.05);
  }
  // top: hose bed, ladder, deck gun
  F.box('plain', DARK, 2.1, 0.12, 4.4, 0, 2.52, -1.8); for (let k = 0; k < 6; k++) F.box('plain', k % 2 ? 0xe8c020 : 0xd8b018, 1.5, 0.06, 4.0 - k * 0.1, -0.2, 2.6 + k * 0.06, -1.8);
  for (const e of [0.72, 1.02]) F.box('metal', 0xc8ccd4, 0.05, 0.08, 4.6, e, 2.72, -1.6); for (let k = 0; k < 13; k++) F.box('metal', 0xc8ccd4, 0.3, 0.03, 0.04, 0.87, 2.72, -3.8 + k * 0.37);
  F.cyl('shiny', CHROME, 0.08, 0.1, 0.4, -0.3, 2.75, 1.4, 8); F.cyl('shiny', RED, 0.06, 0.09, 0.8, -0.3, 3.0, 1.75, 8, { rx: 1.1 });
  // rear step, tail lights, hose reel
  F.box('shiny', CHROME, 2.5, 0.08, 0.5, 0, 0.75, -4.3); for (const e of [-1, 1]) { F.box('glow', 0xff2a20, 0.16, 0.3, 0.04, e * 1.0, 1.5, -4.12, 0, { tint: false }); F.box('glow', 0xffb020, 0.16, 0.14, 0.04, e * 1.0, 1.85, -4.12, 0, { tint: false }); }
  F.cyl('plain', 0xb02020, 0.34, 0.34, 0.9, 0, 1.75, -4.0, 10, { rz: PI / 2 }); F.box('metal', 0xb8bcc4, 1.1, 0.9, 0.04, 0, 1.75, -4.11);
  F.col(0, 0, 2.6, 8.6, 3.0);
}

function buildFirehouse(ctx) {
  const { B, atlas, lights, rnd, pick } = setup(ctx, 911);
  const hw = FW / 2, hd = FD / 2, RED = 0xb02020;
  const rooms = [
    { x0: -11, x1: 4, z0: -7, z1: 7, floor: 'ftile', fcol: 0x9aa0a8, ftile: 3.2, wall: 0xe8e4dc, wains: { c: RED, y: 1.2, rail: 0xf4f0e8 }, ceil: 0xb8bcc2, base: 0x6a6e74 },          // apparatus bay
    { x0: 4, x1: 11, z0: 2.5, z1: 7, h: FWING, floor: 'ftile', fcol: 0xc8c0a8, ftile: 1.0, wall: 0xe8e0c8 },                                                                              // watch office
    { x0: 4, x1: 11, z0: -3, z1: 2.5, h: FWING, floor: 'fwood', fcol: 0xb89060, ftile: 1.3, wall: 0xe4dcc4 },                                                                             // dayroom + kitchen
    { x0: 4, x1: 11, z0: -7, z1: -3, h: FWING, floor: 'cloth', fcol: 0x4a5a7a, ftile: 0.8, wall: 0xc8d0d8 },                                                                              // bunk room
  ];
  const walls = [
    { x: 4, from: -7, to: 7, doors: [{ at: 4.7, w: 1.0 }, { at: -0.5, w: 1.1 }] },
    { z: 2.5, from: 4, to: 11, doors: [{ at: 7.5, w: 1.4, h: 2.4 }] },
    { z: -3, from: 4, to: 11, doors: [{ at: 5.6, w: 1.0 }] },
  ];
  const { cols } = plan(B, THREE, { w: FW, d: FD, h: FH, rooms, walls, doors: [{ x: 9, w: 1.1, h: 2.2 }], base: 0xf4f0e8, crown: null, trim: 0xf4f0e8 });
  const P = parts({ B, THREE, cols, A: atlas, lights, rnd, pick });
  const hot = [], spot = (id, x, z, r, label, onUse) => hot.push({ id, x, z, r, label, onUse });

  // ---------------- apparatus bay
  const E1 = -6.8, E2 = 0.2;
  P.coffer(-10.9, 3.9, -6.9, 6.9, FH, { col: 0x7a8088, key: 'metal', nx: 1, nz: 6, d: 0.32, t: 0.14 });
  { // bay door 1: closed sectional door with a row of windows; bay door 2: rolled up, daylight outside
    const F = P.at(E1, hd - 0.03, PI);
    for (let r = 0; r < 7; r++) { if (r === 4) { for (let k = 0; k < 4; k++) F.quad('night', 0xffffff, 0.86, 0.5, -1.5 + k * 1.0, 0.31 + r * 0.61, 0.03); F.box('plain', 0xe8402e, 4.2, 0.6, 0.02, 0, 0.31 + r * 0.61, 0); for (let k = 0; k <= 4; k++) F.box('plain', 0xe8402e, 0.12, 0.6, 0.05, -2.04 + k * 1.02, 0.31 + r * 0.61, 0.01); continue; } F.box('plain', r % 2 ? 0xe8402e : 0xd83a2a, 4.2, 0.6, 0.04, 0, 0.31 + r * 0.61, 0); }
    for (const e of [-1, 1]) F.box('metal', 0x8a8e96, 0.08, 4.4, 0.1, e * 2.16, 2.2, 0.06); F.box('metal', 0x6a6e74, 4.5, 0.3, 0.3, 0, 4.42, 0.16);
    const G = P.at(E2, hd - 0.03, PI); G.quad('night', 0xffffff, 4.2, 4.3, 0, 2.15, 0.012);
    for (const e of [-1, 1]) G.box('metal', 0x8a8e96, 0.08, 4.4, 0.1, e * 2.16, 2.2, 0.06); G.cyl('metal', 0xc8ccd0, 0.2, 0.2, 4.3, 0, 4.42, 0.2, 8, { rz: PI / 2 });
    lights.push({ x: E2, y: 2.2, z: hd - 1.2, c: 0xe8f0ff, i: 1.0, halo: false });
    for (const [x, t] of [[E1, '1'], [E2, '2']]) P.decal(P.at(x, hd - 0.012, PI), atlas.label('bay' + t, [t], '#f2ede2', '#c01818', 32, 32), 0.5, 0.5, 0, 4.3, 0.31);
  }
  for (const x of [E1 - 2.0, E1 + 2.0, E2 - 2.0, E2 + 2.0]) B.flat('plain', 0xe8c020, 0.12, 11, x, 0.012, 1.2, 0, { ao: false, tint: false });
  fireEngine(P, atlas, E1, 1.0, 0);
  { const F = P.at(E2, 1.5, 0); F.box('metal', 0x5a5e64, 1.4, 0.03, 2.0, 0, 0.02, 0); F.cyl('plain', 0x2a2a2e, 0.5, 0.5, 0.012, 0.1, 0.04, 0.2, 10); for (const e of [-1, 1]) F.box('plain', 0xe8c020, 0.22, 0.2, 0.3, e * 1.0, 0.1, 2.6, 0, { rx: 0.3 }); for (let k = 0; k < 3; k++) { F.add(new THREE.ConeGeometry(0.16, 0.5, 8), 'plain', 0xe86020, 1.75, 0.27 + k * 0.07, -3.2, 0, { tint: false }); } F.box('plain', 0xe86020, 0.4, 0.03, 0.4, 1.75, 0.015, -3.2); }
  // turnout gear along the left wall: six open lockers
  const names = ['CAPT. BELL', 'BIG RON', 'SPARKY', 'LOU', 'DOT JR.', 'PROBIE'];
  for (let k = 0; k < 6; k++) {
    const F = P.at(-hw + 0.3, -5.4 + k * 1.05, PI / 2), hc = k === 0 ? 0xf4f4f0 : k === 5 ? 0xe86020 : 0xe8c020;
    for (const e of [-1, 1]) F.box('metal', 0xb02020, 0.03, 2.0, 0.55, e * 0.5, 1.0, 0); F.box('metal', 0xb02020, 1.0, 0.03, 0.55, 0, 2.0, 0); F.box('metal', 0xb02020, 1.0, 0.03, 0.55, 0, 1.62, 0); F.box('metal', 0x8a8e96, 1.0, 2.0, 0.02, 0, 1.0, -0.27);
    F.rbox('cloth', 0xc8a868, 0.6, 0.85, 0.22, 0, 1.12, -0.05, 0, { round: 0.05 }); for (const y of [0.85, 1.2]) F.box('glow', 0xe8f020, 0.62, 0.05, 0.24, 0, y, -0.05, 0, { tint: false }); for (const e of [-1, 1]) F.box('cloth', 0xc8a868, 0.14, 0.7, 0.18, e * 0.37, 1.15, -0.05);
    F.rbox('plain', hc, 0.34, 0.16, 0.36, 0, 1.76, 0, 0, { round: 0.06 }); F.box('plain', hc, 0.42, 0.03, 0.5, 0, 1.69, -0.03); F.box('plain', 0x1a1a1e, 0.12, 0.1, 0.02, 0, 1.76, 0.185);
    for (const e of [-1, 1]) { F.box('plain', 0x1a1a1e, 0.16, 0.44, 0.2, e * 0.14, 0.22, 0.05); F.box('plain', 0xe8c020, 0.165, 0.05, 0.205, e * 0.14, 0.4, 0.05); }
    P.decal(F, atlas.label('n' + k, [names[k]], '#f4f0e8', '#1a1a1e', 96, 20), 0.6, 0.12, 0, 2.08, 0.28);
    F.col(0, 0, 1.0, 0.55, 2.0);
  }
  // hose racks (left wall, front half)
  for (let s = 0; s < 3; s++) { const F = P.at(-hw + 0.3, 2.6 + s * 1.3, PI / 2); for (const y of [0.5, 1.2, 1.9]) { F.box('metal', 0x6a6e74, 1.2, 0.04, 0.5, 0, y - 0.3, 0); for (let k = 0; k < 2; k++) { F.cyl('plain', (s + k + Math.round(y)) % 2 ? 0xd8b018 : 0xb02020, 0.26, 0.26, 0.12, -0.3 + k * 0.6, y, 0, 12, { rx: PI / 2 }); F.cyl('shiny', 0xc8a860, 0.06, 0.06, 0.14, -0.3 + k * 0.6, y, 0, 6, { rx: PI / 2 }); } } for (const e of [-1, 1]) F.box('metal', 0x6a6e74, 0.04, 2.2, 0.5, e * 0.6, 1.1, 0); F.col(0, 0, 1.2, 0.5, 2.2); }
  // back wall: workbench + tool board, SCBA rack, compressor, flag and the big sign
  { const F = P.cabinets(-8.4, -hd + 0.36, 0, { w: 2.8, col: 0xb02020, top: 0x8a6a48, topKey: 'wood', drawers: true, pull: 0xc8ccd4 });
    F.box('metal', 0x3a3a3e, 0.2, 0.16, 0.14, -0.9, 1.0, 0.1); F.box('metal', 0x3a3a3e, 0.06, 0.1, 0.3, -0.9, 1.1, 0.1); F.rbox('plain', RED, 0.5, 0.26, 0.24, 0.7, 1.05, 0);
    F.box('wood', 0xc8a878, 2.8, 1.2, 0.03, 0, 1.85, -0.3);
    for (let k = 0; k < 7; k++) { const lx = -1.15 + k * 0.38; if (k % 3 === 0) { F.box('wood', 0xa07848, 0.035, 0.8, 0.04, lx, 1.8, -0.26); F.box('metal', 0xb02020, 0.22, 0.14, 0.04, lx + 0.05, 2.16, -0.26); } else if (k % 3 === 1) { F.box('metal', 0xc8ccd4, 0.03, 0.42, 0.04, lx, 1.8, -0.26); F.cyl('metal', 0xc8ccd4, 0.05, 0.05, 0.025, lx, 2.03, -0.26, 6, { rx: PI / 2 }); } else { F.box('metal', 0x3a3a3e, 0.03, 0.7, 0.03, lx, 1.85, -0.26); F.box('metal', 0x3a3a3e, 0.12, 0.04, 0.03, lx + 0.04, 2.2, -0.26); } } }
  { const F = P.at(-4.4, -hd + 0.25, 0); F.box('metal', 0x6a6e74, 1.8, 1.6, 0.4, 0, 0.8, 0, 0, { tint: false }); for (let k = 0; k < 5; k++) { F.cyl('plain', 0xe8c020, 0.09, 0.09, 0.55, -0.7 + k * 0.35, 1.2, 0.1, 8); F.sph('plain', 0xe8c020, 0.09, -0.7 + k * 0.35, 1.48, 0.1); F.cyl('shiny', 0xc8ccd4, 0.03, 0.03, 0.08, -0.7 + k * 0.35, 1.58, 0.1, 5); F.box('plain', 0x1a1a1e, 0.24, 0.3, 0.06, -0.7 + k * 0.35, 0.6, 0.2); } F.col(0, 0, 1.8, 0.45, 1.7); P.decal(F, atlas.label('scba', ['AIR PACKS', 'check your gauge'], '#e8c020', '#1a1a1e', 96, 32, { small: true }), 0.9, 0.3, 0, 1.95, -0.23); }
  { const F = P.at(-1.6, -hd + 0.45, 0); F.cyl('metal', 0xb02020, 0.3, 0.3, 1.1, 0, 0.55, 0, 10, { rz: PI / 2 }); F.box('metal', 0x3a3a3e, 0.5, 0.36, 0.4, 0, 1.1, 0); F.cyl('shiny', 0xc8ccd4, 0.1, 0.1, 0.06, 0.3, 1.12, 0.1, 8, { rx: PI / 2 }); for (const e of [-1, 1]) F.cyl('plain', 0x1a1a1e, 0.1, 0.1, 0.06, e * 0.4, 0.1, 0.2, 8, { rz: PI / 2 }); F.col(0, 0, 1.2, 0.7, 1.3); }
  { const F = P.at(1.9, -hd + 0.4, 0); F.rbox('metal', 0xc8ccd4, 0.8, 1.0, 0.7, 0, 0.5, 0); F.box('plain', 0x2a2a2e, 0.7, 0.3, 0.02, 0, 0.75, 0.36); P.decal(F, atlas.label('ice', ['ICE'], '#3a6ad0', '#ffffff', 48, 24), 0.4, 0.2, 0, 0.3, 0.36); F.col(0, 0, 0.8, 0.7, 1.0); }
  { const F = P.at(-3.6, -hd + 0.012, 0);
    P.decal(F, atlas.label('vfdbig', ['MAPLE GROVE VFD', 'EST. 1923  -  "WE GET THERE EVENTUALLY"'], '#c01818', '#ffd23f', 384, 80, { small: true }), 6.0, 1.25, 0, 3.55, 0);
    const flag = atlas.region('flag', 96, 56, (g) => { for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#f4f0e8' : '#b02030'; g.fillRect(-1, k * 8, 98, 8); } g.fillStyle = '#2a3a6a'; g.fillRect(-1, -1, 41, 33); g.fillStyle = '#fff'; for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) g.fillRect(4 + x * 7, 4 + y * 7, 2, 2); });
    P.decal(P.at(1.6, -hd + 0.012, 0), flag, 1.6, 0.95, 0, 3.0, 0); }
  // bay side of the wing wall: roster board, extinguisher, time clock, pancake poster; the pole
  { const F = P.at(3.89, 2.1, -PI / 2);
    const roster = atlas.region('roster', 128, 96, (g) => { g.fillStyle = '#f8f8f4'; g.fillRect(-1, -1, 130, 98); g.fillStyle = '#1a1a1e'; g.font = 'bold 9px sans-serif'; g.fillText('ON DUTY', 6, 12); g.font = '7px sans-serif'; ['BELL  - watch desk', 'BIG RON - chili', 'SPARKY - napping', 'LOU - "checking hoses"', 'CINDER - good girl'].forEach((t, i) => g.fillText(t, 6, 26 + i * 11)); g.fillStyle = '#c01818'; g.font = 'bold 8px sans-serif'; g.fillText('DAYS SINCE CAT IN TREE: 0', 6, 88); });
    F.box('metal', 0xc8ccd4, 1.7, 1.26, 0.03, 0, 1.75, 0); P.decal(F, roster, 1.6, 1.16, 0, 1.75, 0.02);
    F.cyl('plain', 0xc81e1e, 0.08, 0.08, 0.45, 1.3, 1.1, 0.1, 8); F.box('plain', 0x1a1a1e, 0.06, 0.1, 0.04, 1.3, 1.38, 0.1);
    P.decal(F, atlas.label('pancake', ['PANCAKE', 'BREAKFAST', 'SAT 7AM', 'all you can eat. we counted.'], '#fff4d0', '#c01818', 72, 96, { small: true }), 0.6, 0.8, -1.5, 1.7, 0.01); }
  { const px = 2.9, pz = -4.2; B.cyl('shiny', 0xd8b050, 0.045, 0.045, FH, px, FH / 2, pz, 8, { ao: false }); B.add(new THREE.TorusGeometry(0.55, 0.05, 4, 16).rotateX(PI / 2), 'plain', 0x2a2a2e, px, FH - 0.03, pz, 0, { ao: false, tint: false }); B.cyl('plain', 0x0a0a0c, 0.52, 0.52, 0.01, px, FH - 0.006, pz, 14, { ao: false }); B.cyl('plain', 0xb02020, 0.6, 0.6, 0.08, px, 0.04, pz, 14, { ao: false }); cols.push({ kind: 'box', cx: px, cz: pz, w: 0.12, d: 0.12, rot: 0, h: FH });
    spot('pole', px, pz + 0.8, 0.8, 'Climb the pole', () => say(['You climb the brass pole halfway, hang there by your claws, and slide down backwards. Ten out of ten.', 'You shin up the pole. From the top: "HEY! NO CATS ON THE POLE!" You slide down very slowly, maintaining eye contact.'])); }
  for (const [x, z] of [[E1, -3.2], [E1, 3.6], [E2, -3.2], [E2, 3.2], [-10, 0]]) P.pendant(x === -10 ? -9.6 : x + (x === E1 ? 2.2 : 0), z, FH, 3.85, { shade: 0x3a3e44, r: 0.28, i: 0.95, c: 0xf4f8ff });
  spot('engine', E1 + 1.9, 4.0, 0.9, 'Climb in Engine 1', () => { A && A.Sfx.horn && A.Sfx.horn(); say(['You sit in the driver\'s seat and lean on the horn. BWAAAAP. Everyone in the building spills their coffee.', 'The seat is still warm. You turn the wheel with both paws and make the siren noise yourself.']); });
  spot('gear', -hw + 1.3, -2.8, 0.9, 'Try on a helmet', () => say(['You get inside SPARKY\'s helmet. Entirely inside. It is dark and smells like smoke and ham.', 'The coat is forty pounds. You wear it like a tent and march in a small circle.']));
  spot('hose', -hw + 1.3, 3.9, 0.8, 'Unroll a hose', () => say(['You hook one claw in a hose and pull. Fifty feet of it comes off the rack like ribbon. Lou is going to "check" that later.']));
  spot('bayexit', E2, hd - 0.9, 1.2, 'Go out through the bay door', () => { const e = S.entries.fire && S.entries.fire[1]; if (e) INTR.exit({ to: { x: e.x + Math.sin(e.yaw) * 2.2, z: e.z + Math.cos(e.yaw) * 2.2, yaw: e.yaw } }); else INTR.exit(); });

  // ---------------- watch office
  { const wall = atlas.region('townmap', 128, 96, (g) => { g.fillStyle = '#e8e0c8'; g.fillRect(-1, -1, 130, 98); g.fillStyle = '#b8d0a0'; g.fillRect(4, 4, 46, 40); g.fillStyle = '#8ab0c8'; g.beginPath(); g.ellipse(96, 68, 20, 14, 0.3, 0, 7); g.fill(); g.strokeStyle = '#8a8478'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 50); g.lineTo(128, 50); g.moveTo(60, 0); g.lineTo(60, 96); g.stroke(); g.lineWidth = 1; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(10 + k * 20, 50); g.lineTo(10 + k * 20, 20 + (k % 3) * 20); g.stroke(); } g.fillStyle = '#c01818'; g.fillRect(74, 44, 6, 6); for (const [x, y] of [[20, 20], [40, 70], [100, 30], [84, 80]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); } g.fillStyle = '#1a1a1e'; g.font = 'bold 7px sans-serif'; g.fillText('MAPLE GROVE - RUN MAP', 6, 92); });
    P.picture(5.35, 1.75, 2.61, 0, 1.4, 1.05, wall, 0x4a3222);
    const F = P.at(6.45, 2.61, 0); F.box('plain', 0xe8c020, 0.3, 0.36, 0.08, 0, 1.3, 0.04); F.cyl('plain', 0xd01818, 0.09, 0.09, 0.06, 0, 1.3, 0.1, 10, { rx: PI / 2 }); P.decal(F, atlas.label('alarm', ['DO NOT', 'PUSH'], '#e8c020', '#1a1a1e', 48, 24), 0.26, 0.1, 0, 1.52, 0.085); }
  const disp = atlas.region('dispatch', 128, 72, (g) => { g.fillStyle = '#0a1a14'; g.fillRect(-1, -1, 130, 74); g.fillStyle = '#40e080'; g.font = '7px monospace'; ['DISPATCH  CH 4', '> 14:02 cat in tree, Birch Ln', '> 14:40 cat in tree (same cat)', '> 15:15 grill fire, Estates', '> 15:16 caller says "it\'s fine"', '> 16:00 cat on roof. white. armed?'].forEach((t, i) => g.fillText(t, 4, 11 + i * 11)); });
  { const F = P.desk(10.45, 4.7, PI / 2, { w: 2.2, wood: 0x6a4a30, screen: disp });
    F.rbox('plain', 0x2a2a2e, 0.5, 0.34, 0.3, 0.75, 0.96, 0.15); for (let k = 0; k < 8; k++) F.box('glow', k % 3 ? 0x40e080 : 0xff4030, 0.03, 0.03, 0.01, 0.58 + (k % 4) * 0.1, 0.9 + ((k / 4) | 0) * 0.12, -0.005, 0, { tint: false }); F.cyl('plain', 0x1a1a1e, 0.012, 0.012, 0.3, 0.5, 0.95, -0.2, 4, { rx: -0.5 }); F.rbox('plain', 0xc01818, 0.2, 0.08, 0.16, -0.75, 0.82, -0.15, 0.3, { round: 0.02 }); }
  P.officeChair(9.55, 4.7, -PI / 2, { col: 0x2a2a2e });
  P.person(9.62, 4.7, PI / 2, { sit: true, top: 0x24344e, legs: 0x1a2438, hair: 0x9a9a9a, cap: 0x24344e, solid: false });
  P.dresser(9.4, 2.9, 0, { w: 1.6, h: 1.3, d: 0.5, wood: 0x8a8e96, rows: 4, cols: 3, pull: 0x3a3a3e });
  { const F = P.at(9.4, 2.9, 0); F.rbox('plain', 0x2a2a2e, 0.24, 0.32, 0.22, -0.5, 1.48, 0); F.cyl('glass', 0xffffff, 0.07, 0.06, 0.14, -0.5, 1.4, 0.13, 8); P.plant(10.6, 2.95, { s: 0.7 });
    const photo = atlas.region('crew', 96, 64, (g) => { g.fillStyle = '#b8c8d8'; g.fillRect(-1, -1, 98, 66); g.fillStyle = '#c81e1e'; g.fillRect(8, 30, 80, 26); g.fillStyle = '#1a1a1e'; for (let k = 0; k < 2; k++) { g.beginPath(); g.arc(26 + k * 44, 56, 6, 0, 7); g.fill(); } for (let k = 0; k < 5; k++) { g.fillStyle = '#c8a868'; g.fillRect(12 + k * 16, 16, 9, 16); g.fillStyle = '#e8b890'; g.beginPath(); g.arc(16.5 + k * 16, 12, 4, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.font = '6px sans-serif'; g.fillText('CLASS OF 1998', 26, 62); });
    P.picture(9.4, 2.1, 2.61, 0, 0.9, 0.6, photo, 0x2a2a2e); }
  P.window(6.0, 1.6, hd - 0.001, PI, 1.6, 1.3, { trim: 0xf4f0e8 });
  { const F = P.at(9, hd - 0.02, PI); F.box('wood', 0x9a2a22, 1.04, 2.16, 0.05, 0, 1.08, 0); F.quad('night', 0xffffff, 0.5, 0.6, 0, 1.6, 0.03); F.sph('shiny', 0xc8a860, 0.04, 0.4, 1.0, 0.05); }
  P.table(4.6, 6.2, PI / 2, { w: 1.2, d: 0.4, h: 0.45, wood: 0x6a4a30 }); for (let k = 0; k < 3; k++) B.box('plain', 0x1a1a1e, 0.2, 0.3, 0.26, 4.6, 0.6, 5.8 + k * 0.4, 0, { ao: false, round: false });
  P.troffer(7.4, 4.8, FWING, 1.2, 0, 0.8);
  spot('button', 6.45, 3.4, 0.7, 'Push the big red button', () => { A && A.Sfx.siren && A.Sfx.siren(); setTimeout(() => A && A.Sfx.siren && A.Sfx.siren(), 500); say(['WEEEOOOWEEEOOO. Everyone runs for the engine. Chief Bell looks at you. You look at the button. "...It said do not push."', 'The whole station lights up red. Somewhere in the bunk room, Sparky falls out of bed.']); });
  spot('radio', 9.2, 5.6, 0.7, 'Meow into the radio', () => { A && A.Sfx.meow && A.Sfx.meow(); say(['"Dispatch, this is... mrrrow." A pause. Then every unit in the county: "Copy that, mrrrow."', 'Chief Bell takes the mic away from you, gently, like he has done this before.']); });

  // ---------------- dayroom + kitchen
  { const F = P.cabinets(10.68, -1.2, -PI / 2, { w: 3.0, col: 0x8a6a48, top: 0xd8d4c8, upper: true, splash: 0xe8e4dc, pull: 0x3a3a3e }); P.sink(F, 0.6, 0.9, 0); F.rbox('plain', 0x2a2a2e, 0.26, 0.34, 0.26, -1.0, 1.08, 0); F.cyl('glass', 0x3a2a1a, 0.08, 0.07, 0.16, -1.0, 0.99, 0.14, 8); for (let k = 0; k < 4; k++) F.cyl('plain', pick([0xf4f0e8, 0xc01818, 0x24344e]), 0.045, 0.04, 0.1, -0.4 + k * 0.12, 0.96, 0.12, 6); }
  P.range(10.66, 0.85, -PI / 2, { w: 0.8, hood: false });
  { const F = P.at(10.66, 0.85, -PI / 2); F.cyl('metal', 0x8a8e96, 0.2, 0.18, 0.3, 0.12, 1.09, 0.1, 10); F.cyl('plain', 0x8a3a1a, 0.185, 0.185, 0.01, 0.12, 1.235, 0.1, 10); F.box('wood', 0xa07848, 0.03, 0.03, 0.4, 0.2, 1.3, 0.2, 0.4, { rx: -0.5 }); }
  P.fridge(10.63, 1.93, -PI / 2, { col: 0xf4f0e8, w: 0.95 });
  P.person(9.85, 0.85, PI / 2, { top: 0x24344e, legs: 0x1a2438, apron: 0xf4f0e8, hair: 0x5a3a22, skin: 0xd8a070 });
  P.dining(6.9, 1.05, 0, { w: 2.4, d: 0.95, n: 3, heads: false, wood: 0x8a6a48, chair: { wood: 0x6a4a30, seat: 0xb02020 } });
  { const F = P.at(6.9, 1.05, 0); F.cyl('metal', 0x8a8e96, 0.16, 0.14, 0.2, 0, 0.87, 0, 10); F.box('plain', 0xf4f0e8, 0.34, 0.03, 0.34, 0.7, 0.78, 0.1, 0.3); for (let k = 0; k < 6; k++) F.cyl('plain', pick([0xe8c070, 0xc88a4a, 0xf4d8e0]), 0.045, 0.045, 0.03, 0.62 + (k % 3) * 0.09, 0.81, 0.02 + ((k / 3) | 0) * 0.1, 8); F.box('plain', 0xe8e0c8, 0.3, 0.012, 0.42, -0.75, 0.775, 0, 0.2); }
  P.tv(8.6, -2.9, 0, { w: 1.3, y: 1.7, console: false, screen: atlas.region('game', 96, 54, (g) => { g.fillStyle = '#2a7a3a'; g.fillRect(-1, -1, 98, 56); g.strokeStyle = '#fff'; g.lineWidth = 1; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16, 54); g.stroke(); } g.fillStyle = '#1a1a1e'; g.fillRect(-1, 44, 98, 12); g.fillStyle = '#fff'; g.font = '6px sans-serif'; g.fillText('RACCOONS 14  -  OWLS 14   4TH', 6, 51); }) });
  for (const x of [7.6, 8.6, 9.6]) P.recliner(x, -1.0, PI, { col: [0x5a3a22, 0x3a4a3a, 0x5a3a22][Math.round(x - 7.6)], foot: x === 8.6 });
  { // Cinder the station dalmatian, asleep on her bed
    const F = P.at(5.0, -2.2, 0.5); F.rbox('cloth', 0xb02020, 0.9, 0.12, 0.65, 0, 0.06, 0, 0, { round: 0.05 }); F.rbox('plain', 0xf4f4f0, 0.6, 0.22, 0.3, 0, 0.23, 0, 0, { round: 0.08 }); F.rbox('plain', 0xf4f4f0, 0.22, 0.18, 0.2, 0.36, 0.2, 0.08, 0, { round: 0.06 }); F.box('plain', 0x1a1a1e, 0.06, 0.05, 0.04, 0.48, 0.2, 0.08); for (const e of [-1, 1]) F.box('plain', 0x1a1a1e, 0.06, 0.12, 0.03, 0.34, 0.2, 0.08 + e * 0.1, 0, { rx: e * 0.4 });
    for (const [lx, lz] of [[-0.15, 0.1], [0.05, -0.08], [0.18, 0.12], [-0.22, -0.05], [0.0, 0.14]]) F.box('plain', 0x1a1a1e, 0.07, 0.01, 0.06, lx, 0.342, lz * 0.8); F.cyl('plain', 0xf4f4f0, 0.02, 0.03, 0.3, -0.4, 0.17, 0.1, 5, { rx: PI / 2, ry: 0.8 }); F.box('plain', 0xb02020, 0.03, 0.16, 0.2, 0.26, 0.24, 0.08);
    F.col(0, 0, 0.9, 0.65, 0.3);
    spot('dog', 5.3, -1.6, 0.8, 'Sniff Cinder', () => { A && A.Sfx.meow && A.Sfx.meow('mew', 0.9); say(['Cinder opens one eye, thumps her tail twice and goes back to sleep. Professional courtesy.', 'You curl up against the dalmatian. She does not mind. Big Ron takes a picture.']); }); }
  P.picture(4.11, 1.8, 1.4, PI / 2, 0.8, 0.6, P.paintTex('fd-land', 'land'), 0x4a3222);
  P.troffer(7.5, -0.4, FWING, 1.2, 0, 0.9); P.troffer(9.6, 1.4, FWING, 1.2, PI / 2, 0.5);
  spot('chili', 9.7, 0.2, 0.7, 'Beg for chili', () => { heal(30); A && A.Sfx.pickup && A.Sfx.pickup(); say(['Big Ron: "Firehouse chili. No beans for cats." He picks the beans out with a fork. All of them. +30 health.', 'A bowl of five-alarm chili hits the floor in front of you. Your eyes water. You eat it anyway. +30 health.']); });
  spot('fridge', 9.7, 1.93, 0.6, 'Check the fridge', () => say(['Every single thing in here has a name on it. Most of the names are "RON". One says "NOT RON\'S".']));
  spot('donuts', 7.6, 2.0, 0.7, 'Steal a donut', () => { heal(8); say('You take one donut off the table. The whole shift pretends not to see. +8 health.'); });
  spot('game', 8.6, -1.9, 0.7, 'Watch the game', () => say(['Raccoons 14, Owls 14, fourth quarter. It has been the fourth quarter for as long as anyone can remember.']));

  // ---------------- bunk room
  for (const [k, x] of [[0, 6.6], [1, 8.3], [2, 10.0]]) { P.bed(x, -5.85, 0, { w: 1.0, len: 2.0, wood: 0x6a6e74, headKey: 'metal', head: 0x8a8e96, headH: 0.9, duvet: [0xb02020, 0x24344e, 0x3a5a3a][k], shams: false, throw: false }); if (k < 2) P.dresser(x + 0.85, -6.7, 0, { w: 0.45, h: 0.6, d: 0.4, rows: 2, cols: 1, wood: 0x8a8e96, pull: 0x3a3a3e }); }
  { const F = P.at(8.3, -5.85, 0); F.rbox('cloth', 0xc8a868, 0.5, 0.26, 1.2, 0, 0.78, 0.3, 0, { round: 0.1 }); F.rbox('plain', 0xe8b890, 0.22, 0.2, 0.22, 0, 0.78, -0.6, 0, { round: 0.06 }); F.box('plain', 0xc86a2a, 0.24, 0.1, 0.12, 0, 0.84, -0.7); }
  { const F = P.at(4.36, -5.6, PI / 2); for (let k = 0; k < 3; k++) { F.rbox('metal', 0x6a7a8a, 0.48, 1.9, 0.5, -0.5 + k * 0.5, 0.95, 0); F.box('plain', 0x2a2a2e, 0.3, 0.02, 0.01, -0.5 + k * 0.5, 1.6, 0.255); F.box('shiny', 0xc8ccd4, 0.03, 0.1, 0.03, -0.32 + k * 0.5, 1.0, 0.26); } F.col(0, 0, 1.5, 0.5, 1.9); }
  { const F = P.at(8.3, -3.11, PI); F.cyl('metal', 0xb02020, 0.14, 0.14, 0.06, 0, 2.4, 0.04, 10, { rx: PI / 2 }); F.box('glow', 0xff3020, 0.16, 0.1, 0.08, 0.5, 2.4, 0.05, 0, { tint: false }); }
  P.window(10.999, 1.7, -5.0, -PI / 2, 1.2, 1.1, { curtain: 0x24344e, trim: 0xf4f0e8 });
  P.rug(7.6, -3.9, 0, 2.6, 1.0, P.rugTex('bunk', '#24344e', '#c8ccd4', '#b02020', 96, 40));
  lights.push({ x: 7.5, y: 2.6, z: -5.0, c: 0xc8d8ff, i: 0.45, halo: false }); B.box('glow', 0xc8d8ff, 0.4, 0.02, 0.4, 7.5, FWING - 0.012, -5.0, 0, { ao: false, round: false, tint: false });
  spot('bed', 10.0, -4.4, 0.8, 'Nap in an empty bunk');
  spot('sparky', 8.3, -4.5, 0.6, 'Stand on Sparky', () => say(['You stand on the sleeping firefighter\'s chest and stare at his face from two inches away. He does not wake up. Impressive.']));

  zoneLights(lights, rooms, 3);
  const group = B.finish(new THREE.Group());
  return {
    group, size: [FW, FD], cols, floors: [], lights, unload: true, pack: true, name: 'Maple Grove VFD',
    spawn: { x: 9, z: hd - 1.1, yaw: 0 }, exit: { x: 9, z: hd - 0.05, r: 0.6 },
    cam: { maxDist: 3.6, height: 2.7 }, bake: { amb: 0.3, maxEdge: 1.2 }, interact: hot,
    dispose() { atlas.tex.dispose(); }, stats: () => ({ atlas: atlas.used(), lights: lights.length, cols: cols.length }),
  };
}

// =====================================================================================================================
// Hospital
// =====================================================================================================================
const HW = 34, HD = 16, HH = 3.1;
const SCRUB = 0x3a9a8a, BLUE = 0x3a6a9a;

function hospParts(P, atlas, B) {
  const ecg = atlas.region('ecg', 64, 40, (g) => { g.fillStyle = '#081410'; g.fillRect(-1, -1, 66, 42); g.strokeStyle = '#40e080'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 14); for (let k = 0; k < 4; k++) { const x = k * 16; g.lineTo(x + 6, 14); g.lineTo(x + 8, 4); g.lineTo(x + 10, 22); g.lineTo(x + 12, 14); g.lineTo(x + 16, 14); } g.stroke(); g.strokeStyle = '#40c0e0'; g.beginPath(); g.moveTo(0, 30); for (let x = 0; x <= 64; x += 2) g.lineTo(x, 30 + Math.sin(x * 0.4) * 3); g.stroke(); g.fillStyle = '#e8c020'; g.font = 'bold 8px monospace'; g.fillText('72', 48, 10); });
  const Q = {
    ecg,
    /** hospital bed, head at local -z; o.patient: someone under the blanket */
    bed(x, z, ry, o = {}) {
      const F = P.at(x, z, ry), blanket = o.blanket ?? 0x8ab8d8;
      F.box('metal', 0x8a8e96, 0.9, 0.08, 2.0, 0, 0.45, 0); for (const ex of [-1, 1]) for (const ez of [-1, 1]) { F.box('metal', 0x8a8e96, 0.05, 0.4, 0.05, ex * 0.4, 0.25, ez * 0.9); F.cyl('plain', 0x2a2a2e, 0.05, 0.05, 0.04, ex * 0.4, 0.05, ez * 0.9, 6, { rz: PI / 2 }); }
      F.rbox('cloth', 0xf4f4f0, 0.86, 0.14, 1.3, 0, 0.56, 0.32, 0, { round: 0.04, tint: false }); F.rbox('cloth', 0xf4f4f0, 0.86, 0.14, 0.7, 0, 0.72, -0.62, 0, { round: 0.04, rx: -0.45, tint: false });
      F.rbox('cloth', 0xf8f8f8, 0.5, 0.1, 0.3, 0, 0.9, -0.78, 0, { round: 0.04, rx: -0.45 }); F.rbox('cloth', blanket, 0.9, 0.06, 1.1, 0, 0.66, 0.42, 0, { round: 0.03, tint: false });
      F.box('plain', 0xe8e4dc, 0.94, 0.5, 0.04, 0, 0.75, -1.0); F.box('plain', 0xe8e4dc, 0.94, 0.34, 0.04, 0, 0.62, 1.0);
      for (const e of [-1, 1]) { F.box('metal', 0xc8ccd4, 0.02, 0.03, 0.8, e * 0.46, 0.9, -0.1); for (let k = 0; k < 3; k++) F.box('metal', 0xc8ccd4, 0.02, 0.3, 0.02, e * 0.46, 0.76, -0.45 + k * 0.35); }
      if (o.patient) { F.rbox('cloth', blanket, 0.5, 0.2, 1.1, 0, 0.74, 0.35, 0, { round: 0.09, tint: false }); F.rbox('plain', o.skin ?? 0xe8b890, 0.22, 0.2, 0.24, 0, 0.98, -0.6, 0, { round: 0.06 }); F.box('plain', o.hair ?? 0xc8c8c8, 0.24, 0.08, 0.2, 0, 1.06, -0.68); if (o.cast) { F.rbox('plain', 0xf8f8f4, 0.16, 0.16, 0.7, 0.16, 1.05, 0.55, 0, { round: 0.05, rx: -0.35 }); F.box('plain', 0x8a8e96, 0.012, 1.3, 0.012, 0.16, 1.85, 0.8); } }
      F.col(0, 0, 0.95, 2.05, 0.75);
      return F;
    },
    iv(x, z) { B.cyl('shiny', 0xc8ccd4, 0.012, 0.012, 1.9, x, 0.95, z, 5, { ao: false }); for (let k = 0; k < 4; k++) B.box('shiny', 0xc8ccd4, 0.04, 0.03, 0.3, x + Math.sin(k * PI / 2) * 0.13, 0.03, z + Math.cos(k * PI / 2) * 0.13, k * PI / 2, { ao: false, round: false }); B.box('shiny', 0xc8ccd4, 0.3, 0.015, 0.015, x, 1.88, z, 0, { ao: false, round: false }); B.box('glass', 0xd8f0ff, 0.12, 0.2, 0.04, x + 0.1, 1.72, z, 0, { ao: false, round: false }); B.box('plain', 0x3a6ad0, 0.1, 0.12, 0.08, x, 1.2, z + 0.03, 0, { ao: false, round: false }); },
    /** vitals monitor on a wall arm (facing local +z) */
    monitor(x, y, z, ry) { const F = P.at(x, z, ry); F.box('plain', 0x8a8e96, 0.05, 0.05, 0.25, 0, y, 0.12); F.rbox('plain', 0xe8e4dc, 0.44, 0.34, 0.08, 0, y, 0.28, 0, { round: 0.02 }); P.decal(F, ecg, 0.38, 0.26, 0, y, 0.325, 0, 'aglow'); },
    /** a row of n linked waiting-room chairs, facing local +z */
    seats(x, z, ry, n, col = BLUE) { const F = P.at(x, z, ry), w = n * 0.56; F.box('metal', 0x8a8e96, w, 0.05, 0.06, 0, 0.36, 0); for (const e of [-1, 1]) { F.box('metal', 0x8a8e96, 0.05, 0.36, 0.05, e * (w / 2 - 0.15), 0.18, 0); F.box('metal', 0x8a8e96, 0.05, 0.03, 0.5, e * (w / 2 - 0.15), 0.015, 0); } for (let k = 0; k < n; k++) { const lx = -w / 2 + 0.28 + k * 0.56; F.rbox('cloth', col, 0.5, 0.08, 0.46, lx, 0.44, 0.02, 0, { round: 0.03 }); F.rbox('cloth', col, 0.5, 0.42, 0.07, lx, 0.72, -0.2, 0, { round: 0.03, rx: -0.12 }); if (k) F.box('metal', 0x8a8e96, 0.03, 0.03, 0.4, lx - 0.28, 0.62, 0); } F.col(0, 0, w, 0.5, 0.95, { top: 0.48 }); },
    vending(x, z, ry, kind = 0) { const F = P.at(x, z, ry), c = kind ? 0xc02020 : 0x2a4a8a; F.rbox('metal', c, 0.95, 1.85, 0.75, 0, 0.925, 0); F.box('glass', 0xe8f4ff, 0.6, 1.2, 0.02, -0.12, 1.15, 0.38); for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) F.box('plain', [0xe8c020, 0xd03030, 0x3aa060, 0xe87020, 0x8a4ac0, 0xf4f0e8][(r * 3 + k) % 6], 0.08, 0.12, 0.05, -0.34 + k * 0.11, 0.66 + r * 0.22, 0.33); F.box('plain', 0x1a1a1e, 0.18, 0.4, 0.02, 0.33, 1.2, 0.385); F.box('glow', 0x40e080, 0.12, 0.05, 0.01, 0.33, 1.5, 0.39, 0, { tint: false }); F.box('plain', 0x1a1a1e, 0.6, 0.16, 0.02, -0.12, 0.3, 0.385); P.decal(F, atlas.label('vend' + kind, [kind ? 'SNACKS' : 'COLD DRINKS'], kind ? '#fff4d0' : '#d8ecff', kind ? '#c02020' : '#2a4a8a', 96, 20), 0.6, 0.12, -0.12, 1.78, 0.38, 0, 'aglow'); F.col(0, 0, 0.95, 0.75, 1.85); },
    wheelchair(x, z, ry) { const F = P.at(x, z, ry); for (const e of [-1, 1]) { F.add(new THREE.TorusGeometry(0.28, 0.02, 4, 14).rotateY(PI / 2), 'plain', 0x2a2a2e, e * 0.3, 0.3, -0.05, 0, { tint: false }); F.cyl('plain', 0x2a2a2e, 0.07, 0.07, 0.03, e * 0.24, 0.07, 0.36, 6, { rz: PI / 2 }); F.box('metal', 0xc8ccd4, 0.02, 0.5, 0.02, e * 0.25, 0.72, -0.2); F.box('plain', 0x2a2a2e, 0.03, 0.03, 0.3, e * 0.26, 0.62, 0.05); } F.box('cloth', 0x24344e, 0.48, 0.03, 0.44, 0, 0.5, 0.05); F.box('cloth', 0x24344e, 0.48, 0.4, 0.03, 0, 0.75, -0.19); F.box('metal', 0xc8ccd4, 0.4, 0.02, 0.14, 0, 0.14, 0.42); F.col(0, 0.05, 0.62, 0.8, 0.95, { top: 0.52 }); },
    /** rolling cart with drawers */
    cart(x, z, ry, col = 0xc02020, o = {}) { const F = P.at(x, z, ry); F.rbox('metal', col, 0.6, 0.8, 0.45, 0, 0.52, 0); for (let r = 0; r < 4; r++) { F.box('plain', 0xf4f0e8, 0.52, 0.015, 0.01, 0, 0.26 + r * 0.19, 0.228); F.box('shiny', 0xc8ccd4, 0.2, 0.02, 0.02, 0, 0.34 + r * 0.19, 0.235); } for (const ex of [-1, 1]) for (const ez of [-1, 1]) F.cyl('plain', 0x2a2a2e, 0.04, 0.04, 0.03, ex * 0.24, 0.05, ez * 0.17, 6, { rz: PI / 2 }); if (o.defib) { F.rbox('plain', 0xe8c020, 0.34, 0.2, 0.3, 0, 1.03, 0, 0, { round: 0.03 }); P.decal(F, ecg, 0.2, 0.12, 0, 1.05, 0.152, 0, 'aglow'); } else { F.box('plain', 0xf4f0e8, 0.2, 0.08, 0.14, -0.15, 0.96, 0); F.cyl('plain', 0xe8e4dc, 0.04, 0.04, 0.12, 0.15, 0.98, 0.05, 6); } F.col(0, 0, 0.6, 0.45, 0.95); },
    /** privacy curtain on a ceiling track along local x */
    curtain(x, z, ry, len, H, col = 0x8ab8d8) { const F = P.at(x, z, ry); F.box('metal', 0xc8ccd4, len, 0.03, 0.03, 0, H - 0.3, 0); const n = Math.round(len / 0.16); for (let k = 0; k < n; k++) F.box('cloth', col, 0.15, H - 0.75, 0.04, -len / 2 + (k + 0.5) * len / n, (H - 0.3 + 0.45) / 2, (k % 2 ? 0.03 : -0.03), k % 2 ? 0.35 : -0.35); F.col(0, 0, len, 0.08, H - 0.3); },
    teddy(F, lx, y, lz, s = 1, col = 0xa87848) { F.rbox('cloth', col, 0.16 * s, 0.18 * s, 0.12 * s, lx, y + 0.09 * s, lz, 0, { round: 0.04 * s }); F.rbox('cloth', col, 0.14 * s, 0.13 * s, 0.12 * s, lx, y + 0.24 * s, lz, 0, { round: 0.04 * s }); for (const e of [-1, 1]) { F.box('cloth', col, 0.05 * s, 0.05 * s, 0.03 * s, lx + e * 0.06 * s, y + 0.32 * s, lz); F.box('cloth', col, 0.05 * s, 0.1 * s, 0.06 * s, lx + e * 0.1 * s, y + 0.1 * s, lz + 0.03 * s); } F.box('plain', 0x1a1a1e, 0.03 * s, 0.02 * s, 0.01, lx, y + 0.23 * s, lz + 0.062 * s); },
    nurse(x, z, ry, o = {}) { P.person(x, z, ry, { top: o.top ?? SCRUB, legs: o.top ?? SCRUB, shoes: 0xf4f4f0, ...o }); },
  };
  return Q;
}

function buildHospital(ctx) {
  const { B, atlas, lights, rnd, pick } = setup(ctx, 1337);
  const hw = HW / 2, hd = HD / 2, H = HH;
  const hall = { c: 0xc8d8e0, y: 1.0, rail: 0xb89060 };
  const rooms = [
    { x0: -17, x1: -9, z0: 2, z1: 8, floor: 'fwood', fcol: 0xd8bc94, ftile: 1.3, wall: 0xf4e4d0 },                                               // gift shop + cafe
    { x0: -9, x1: 0, z0: 2, z1: 8, floor: 'ftile', fcol: 0xe8e8e4, ftile: 1.2, wall: 0xe8eef0, wains: { c: 0x8ab0c8, y: 1.0 } },                 // lobby
    { x0: 0, x1: 4, z0: 2, z1: 8, floor: 'ftile', fcol: 0xd8e4dc, ftile: 0.8, wall: 0xe0ece4 },                                                  // pharmacy
    { x0: 4, x1: 8, z0: 2, z1: 8, floor: 'ftile', fcol: 0xe0dce8, ftile: 0.8, wall: 0xe8e4f0 },                                                  // exam room
    { x0: -17, x1: 8, z0: -0.2, z1: 2, floor: 'ftile', fcol: 0xd8e0e4, ftile: 1.1, wall: 0xeef0f0, wains: hall },                                // corridor
    { x0: -17, x1: -12.5, z0: -8, z1: -0.2, floor: 'ftile', fcol: 0xd8d4c8, ftile: 0.9, wall: 0xe4ecf4 },                                        // patient room 1
    { x0: -12.5, x1: -8, z0: -8, z1: -0.2, floor: 'ftile', fcol: 0xd8d4c8, ftile: 0.9, wall: 0xf0ecd8 },                                         // patient room 2
    { x0: -8, x1: -4, z0: -8, z1: -0.2, floor: 'ftile', fcol: 0xd8e0e4, ftile: 1.1, wall: 0xe0ece8 },                                            // nurses' station
    { x0: -4, x1: 1, z0: -8, z1: -0.2, floor: 'ftile', fcol: 0xb8bcc4, ftile: 0.9, wall: 0xd8dce4 },                                             // X-ray
    { x0: 1, x1: 8, z0: -8, z1: -0.2, floor: 'ftile', fcol: 0xb8d0c8, ftile: 0.7, wall: 0xc8e0d8, wains: { c: 0xa8c8c0, y: 1.6 } },             // operating room
    { x0: 8, x1: 17, z0: -8, z1: 8, floor: 'ftile', fcol: 0xdcdcd8, ftile: 1.1, wall: 0xf0ecec, wains: { c: 0xe8c8c8, y: 1.0, rail: 0xd02a2a } },   // emergency room
  ];
  const walls = [
    { x: -9, from: 2, to: 8, doors: [{ at: 5, w: 3.6, h: 2.6 }] },
    { z: 2, from: -17, to: 8, doors: [{ at: -13, w: 1.4, h: 2.4 }, { at: -7, w: 2.6, h: 2.7 }, { at: 2.6, w: 1.0 }, { at: 6, w: 1.0 }] },
    { x: 0, from: 2, to: 8, doors: [{ at: 5, w: 2.6, h: 2.4 }] }, { x: 4, from: 2, to: 8 },
    { z: -0.2, from: -17, to: -8, doors: [{ at: -14.75, w: 1.2 }, { at: -10.25, w: 1.2 }] },
    { z: -0.2, from: -4, to: 8, doors: [{ at: -1.5, w: 1.2 }, { at: 4.5, w: 1.8, h: 2.4 }] },
    { x: -12.5, from: -8, to: -0.2 }, { x: -8, from: -8, to: -0.2 }, { x: -4, from: -8, to: -0.2 }, { x: 1, from: -8, to: -0.2 },
    { x: 8, from: -8, to: 8, doors: [{ at: 0.9, w: 1.9, h: 2.4 }] },
  ];
  const { cols } = plan(B, THREE, { w: HW, d: HD, h: H, rooms, walls, doors: [{ x: -4.5, w: 2.2, h: 2.4 }, { x: 12, w: 2.2, h: 2.4 }], base: 0xb8c0c8, crown: null, trim: 0xd8dce0 });
  const P = parts({ B, THREE, cols, A: atlas, lights, rnd, pick }), Q = hospParts(P, atlas, B);
  const hot = [], spot = (id, x, z, r, label, onUse) => hot.push({ id, x, z, r, label, onUse });
  const L = (key, lines, bg, fg, w, h, o) => atlas.label(key, lines, bg, fg, w, h, o);
  const doorSign = (x, z, ry, t) => P.decal(P.at(x, z, ry), L('ds' + t, [t], '#3a6a9a', '#ffffff', 96, 20), 0.7, 0.15, 0, 2.5, 0.012);

  // ---------------- lobby
  glassDoors(P, -4.5, hd - 0.02, 2.2, 2.4);
  lights.push({ x: -4.5, y: 1.6, z: hd - 1.0, c: 0xe8f0ff, i: 0.6, halo: false });
  B.flat('cloth', 0x3a3e44, 2.4, 1.4, -4.5, 0.012, hd - 0.9, 0, { ao: false, tint: false });
  { const F = P.cabinets(-2.6, 3.35, 0, { w: 3.2, d: 0.6, h: 1.1, col: BLUE, top: 0xf4f0e8, drawers: false, pull: BLUE });
    P.decal(F, L('recep', ['RECEPTION'], '#3a6a9a', '#ffffff', 128, 24), 1.6, 0.3, 0, 0.6, 0.31);
    F.box('plain', 0x1a1a1e, 0.5, 0.32, 0.03, -0.7, 1.32, -0.1, 0, { rx: -0.05 }); F.quad('glow', 0x8ab8e0, 0.46, 0.28, -0.7, 1.32, -0.117, PI); F.rbox('plain', 0xf4f0e8, 0.3, 0.2, 0.22, 0.6, 1.22, 0); F.cyl('plain', 0x8ab0c8, 0.05, 0.05, 0.14, 1.2, 1.19, 0.05, 8); F.box('plain', 0xf4f0e8, 0.24, 0.02, 0.32, 0.1, 1.13, 0.05, 0.2); F.box('glow', 0xe8f8ff, 0.1, 0.16, 0.08, 1.4, 1.2, 0.1, 0, { tint: false });
    Q.nurse(-2.6, 2.62, 0, { top: 0xc86a8a, hair: 0x8a5a2a, sit: false });
    const cross = atlas.region('cross', 64, 64, (g) => { g.fillStyle = '#e8eef0'; g.fillRect(-1, -1, 66, 66); g.fillStyle = '#3a6a9a'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(24, 10, 16, 44); g.fillRect(10, 24, 44, 16); });
    P.decal(P.at(-2.9, 2.112, 0), cross, 0.9, 0.9, 0, 2.2, 0); P.decal(P.at(-1.5, 2.112, 0), L('mgch', ['MAPLE GROVE', 'COMMUNITY HOSPITAL', '"probably fine"'], '#e8eef0', '#3a6a9a', 128, 64, { small: true, font: 'sans-serif' }), 1.5, 0.75, 0, 2.2, 0); }
  Q.seats(-7.3, 7.5, PI, 4); Q.seats(-1.7, 7.5, PI, 4);
  P.table(-7.3, 6.2, 0, { w: 1.0, d: 0.5, h: 0.42, wood: 0xc8a878 }); for (let k = 0; k < 4; k++) B.box('plain', pick([0xd03030, 0x3a6ad0, 0xe8c020, 0xf4f0e8]), 0.2, 0.012, 0.27, -7.6 + k * 0.2, 0.43 + k * 0.004, 6.2, k * 0.4, { ao: false, round: false });
  { const F = P.at(-0.45, 6.9, -PI / 2); F.rbox('wood', 0x4a3a2a, 1.2, 0.7, 0.5, 0, 0.35, 0); F.box('glass', 0x8ad0f0, 1.1, 0.6, 0.42, 0, 1.0, 0); F.box('plain', 0x2a2a2e, 1.2, 0.06, 0.5, 0, 1.33, 0); F.box('plain', 0xe8d8a8, 1.06, 0.06, 0.4, 0, 0.74, 0); for (let k = 0; k < 5; k++) { F.box('plain', pick([0xe87020, 0xe8c020, 0xd03030]), 0.1, 0.05, 0.02, -0.4 + k * 0.2, 0.9 + (k % 3) * 0.12, (k % 2 ? 0.08 : -0.08)); F.box('plain', 0x3a8a4a, 0.02, 0.2 + (k % 2) * 0.1, 0.02, -0.45 + k * 0.22, 0.85, -0.12); } F.box('glow', 0xc8f0ff, 1.0, 0.02, 0.3, 0, 1.29, 0, 0, { tint: false }); F.col(0, 0, 1.2, 0.5, 1.35);
    lights.push({ x: -0.9, y: 1.1, z: 6.9, c: 0x80d0ff, i: 0.25, halo: false }); }
  P.plant(-8.4, 2.7, { kind: 'palm' }); P.plant(-0.6, 2.6, { kind: 'fig' });
  Q.wheelchair(-5.4, 3.0, 0.4);
  { const F = P.at(-6.0, 6.9, 0); F.cyl('plain', 0xe8e4dc, 0.03, 0.2, 1.0, 0, 0.5, 0, 8); F.rbox('plain', 0xf4f0e8, 0.16, 0.24, 0.12, 0, 1.1, 0, 0, { round: 0.02 }); F.col(0, 0, 0.3, 0.3, 1.2); }
  hangSign(P, -4.5, 5.2, 0, H, 2.6, 2.4, 0.4, L('dir', ['<  GIFT SHOP  CAFE     |     PHARMACY  EMERGENCY  >'], '#3a6a9a', '#ffffff', 256, 40, { font: 'sans-serif' }));
  for (const x of [-7.6, -1.4]) P.window(x, 1.65, hd - 0.001, PI, 1.8, 1.4, { trim: 0xd8dce0 });
  for (const [x, z] of [[-6.5, 4.2], [-2.5, 5.6], [-6.5, 6.6]]) P.troffer(x, z, H, 1.2, 0, 0.7);
  spot('reception', -2.6, 4.3, 1.0, 'See a doctor ($20)', () => {
    if (!A) return; if ((A.G.hp || 0) >= 100) { say('"You look fine to me, hon. Take a lollipop from the exam room and go."'); return; }
    if (pay(20)) { A.G.hp = 100; say(['The doctor looks in your ears, weighs you in a bucket and says "healthy as a horse". Full health. -$20', 'Two stitches, one cone of shame (declined) and a sticker that says BRAVE. Full health. -$20']); }
    else { heal(25); say('"No insurance, no cash... Fill out forms 1 through 40." A nurse slips you a bandage anyway. +25 health.'); }
  });
  spot('fish', -1.1, 6.9, 0.7, 'Watch the fish tank', () => say(['Six fish. You watch them for a very long time. The receptionist watches you watch them.', 'You put one paw flat on the glass. The fish all move to the other end. You move your paw. So do they.']));

  // ---------------- gift shop + cafe
  { const F = P.cabinets(-15.4, 3.2, 0, { w: 2.2, d: 0.6, h: 1.0, col: 0xe8a0b8, top: 0xf4f0e8, drawers: false, pull: 0xe8a0b8 }); F.rbox('plain', 0xe0dcd0, 0.4, 0.24, 0.36, 0.6, 1.13, 0); F.cyl('glass', 0xffffff, 0.12, 0.1, 0.24, -0.6, 1.13, 0, 8); for (let k = 0; k < 8; k++) F.sph('plain', pick([0xd03030, 0xe8c020, 0x3aa060, 0xe87020]), 0.035, -0.6 + Math.sin(k * 2) * 0.06, 1.08 + (k % 3) * 0.04, Math.cos(k * 2) * 0.06);
    P.person(-15.4, 2.6, 0, { top: 0xe8a0b8, legs: 0x8a8e96, hair: 0xf4f0f0, apron: 0xf8e0e8 });
    P.decal(F, L('gift', ['GIFT SHOP', 'run by volunteers. be nice.'], '#e8a0b8', '#ffffff', 128, 32, { small: true, font: 'sans-serif' }), 1.5, 0.36, 0, 0.55, 0.31); }
  { const F = P.at(-16.82, 5.4, PI / 2); P.bookcase(-16.82, 5.4, PI / 2, { w: 3.0, h: 2.0, wood: 0xf4f0e8, n: 4, fill: 'x' });   // shelves the bookcase leaves mostly empty get bears + flowers
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) { const lx = -1.2 + k * 0.6, y = 0.12 + r * 0.45; if ((r + k) % 3 === 0) Q.teddy(F, lx, y, 0.06, 0.9, pick([0xa87848, 0xe8d0a8, 0xf4f0f0, 0x8a5a3a])); } }
  { const F = P.at(-11.0, 7.0, 0); F.cyl('metal', 0x8a8e96, 0.25, 0.3, 0.06, 0, 0.03, 0, 10); F.cyl('metal', 0x8a8e96, 0.02, 0.02, 1.5, 0, 0.78, 0, 5); for (let s = 0; s < 4; s++) for (let r = 0; r < 4; r++) F.box('plain', pick([0xf8e0e8, 0xd8ecff, 0xfff4c0, 0xe0f4d8]), 0.18, 0.24, 0.02, Math.sin(s * PI / 2) * 0.16, 0.5 + r * 0.3, Math.cos(s * PI / 2) * 0.16, s * PI / 2, { rx: -0.15 }); F.col(0, 0, 0.5, 0.5, 1.6); }
  for (let k = 0; k < 7; k++) { const x = -13.2 + (k % 4) * 0.5 + rnd() * 0.2, z = 3.0 + ((k / 4) | 0) * 0.5, y = 1.9 + rnd() * 0.7, c = pick([0xd03030, 0xe8c020, 0x3a6ad0, 0xe870a0, 0x3aa060, 0xc8ccd4]); B.sph(k === 5 ? 'shiny' : 'plain', c, 0.17, x, y, z, { ao: false, ws: 7, hs: 5, s: [1, 1.15, 1] }); B.cyl('plain', 0xf4f0e8, 0.004, 0.004, y - 0.35, x, (y - 0.17 + 0.2) / 2, z, 3, { ao: false }); }
  B.cyl('metal', 0x8a8e96, 0.2, 0.24, 0.2, -12.9, 0.1, 3.25, 8, { ao: false }); cols.push({ kind: 'box', cx: -12.9, cz: 3.25, w: 1.2, d: 0.8, rot: 0, h: 1.0 });
  P.decal(P.at(-13.0, 2.112, 0), L('getwell', ['GET WELL SOON', '(or at your own pace)'], '#fff4c0', '#d03030', 128, 40, { small: true }), 1.4, 0.44, 0, 2.55, 0);
  { const F = P.table(-10.2, 3.1, 0, { w: 1.6, d: 0.6, h: 0.9, wood: 0xf4f0e8 }); for (let k = 0; k < 4; k++) P.vase(-10.8 + k * 0.4, 0.9, 3.1, pick([0xe8e4dc, 0x8ab0c8, 0xc8a0b0]), pick([0xe85a7a, 0xe8a020, 0xf4f0e0, 0x8a5ad0])); F.col(0, 0, 1.6, 0.6, 1.5); }
  for (const [x, z] of [[-15.2, 6.4], [-13.2, 6.9]]) { P.table(x, z, 0, { round: true, w: 0.7, h: 0.74, wood: 0x6a4a30 }); for (const e of [-1, 1]) P.chair(x + e * 0.6, z, e * -PI / 2, { wood: 0x6a4a30, seat: 0xe8a0b8, solid: false }); B.cyl('plain', 0xf4f0e8, 0.04, 0.035, 0.09, x + 0.1, 0.785, z + 0.05, 6, { ao: false }); }
  for (const x of [-15, -11.5]) P.window(x, 1.65, hd - 0.001, PI, 1.8, 1.4, { trim: 0xd8dce0, curtain: 0xe8a0b8 });
  for (const [x, z] of [[-14.8, 4.6], [-11.2, 5.2]]) P.troffer(x, z, H, 1.2, 0, 0.7, 0xfff4e0);
  spot('bear', -16.0, 5.4, 0.9, 'Buy a teddy bear ($5)', () => { if (pay(5)) say(['You carry the bear out by its ear. It is exactly your size. You are going to fight it later. -$5', 'The volunteer ties a ribbon on the bear AND on you. -$5']); else say('"Five dollars, sweetie. No? Well, you can look." You look. Hard.'); });
  spot('balloons', -12.9, 4.0, 0.8, 'Bat the balloons', () => { A && A.Sfx.blip && A.Sfx.blip(980); say(['You swat a "GET WELL SOON" balloon. It bobs back. You swat it again. This is your whole afternoon now.', 'POP. Everyone in the lobby looks. You look at the wall. What balloon.']); });

  // ---------------- corridor
  for (const x of [-14, -8.5, -3, 2.5]) P.troffer(x, 0.9, H, 1.2, 0, 0.6);
  B.flat('plain', 0x3a6a9a, 24.6, 0.1, -4.6, 0.012, 1.5, 0, { ao: false, tint: false }); B.flat('plain', 0xd02a2a, 24.6, 0.1, -4.6, 0.012, 1.35, 0, { ao: false, tint: false });
  { const F = P.at(-16.99, 0.9, PI / 2); for (const e of [-1, 1]) F.box('metal', 0xb8bcc4, 0.72, 2.2, 0.03, e * 0.37, 1.1, 0.02); F.box('metal', 0x8a8e96, 1.6, 0.1, 0.06, 0, 2.25, 0.03); F.box('plain', 0x2a2a2e, 0.1, 0.2, 0.03, 0.95, 1.2, 0.02); F.box('glow', 0xe8a020, 0.04, 0.04, 0.01, 0.95, 1.24, 0.04, 0, { tint: false }); P.decal(F, L('ooo', ['OUT OF ORDER', 'since 1998'], '#f8f4e0', '#c02020', 64, 40, { small: true }), 0.5, 0.3, 0, 1.5, 0.04); }
  Q.bed(-15.6, 0.45, PI / 2, { blanket: 0xf4f4f0 }); Q.wheelchair(3.4, 0.5, -PI / 2); Q.cart(-5.4, 1.62, PI, 0x8ab8d8);
  { const F = P.at(0.0, -0.092, 0); F.rbox('shiny', 0xc8ccd4, 0.4, 0.25, 0.3, 0, 0.9, 0.16); F.box('shiny', 0xa8acb4, 0.14, 0.75, 0.12, 0, 0.4, 0.08); }
  P.decal(P.at(-12.5, -0.092, 0), atlas.region('board', 96, 64, (g) => { g.fillStyle = '#b89060'; g.fillRect(-1, -1, 98, 66); for (let k = 0; k < 9; k++) { g.fillStyle = ['#f8f4e0', '#d8ecff', '#fff4c0', '#f8d8e0'][k % 4]; g.fillRect(6 + (k % 3) * 30 + (k % 2) * 3, 5 + ((k / 3) | 0) * 20, 22, 15); g.fillStyle = '#d03030'; g.fillRect(16 + (k % 3) * 30, 6 + ((k / 3) | 0) * 20, 2, 2); } }), 1.2, 0.8, 0, 1.7, 0);
  doorSign(-14.75, -0.092, 0, 'ROOM 1'); doorSign(-10.25, -0.092, 0, 'ROOM 2'); doorSign(-1.5, -0.092, 0, 'X-RAY'); doorSign(4.5, -0.092, 0, 'OPERATING ROOM'); doorSign(2.6, 1.892, PI, 'PHARMACY (STAFF)'); doorSign(6, 1.892, PI, 'EXAM 1'); doorSign(-13, 1.892, PI, 'GIFT SHOP');
  hangSign(P, 6.6, 0.9, PI / 2, H, 2.6, 1.6, 0.34, L('erdir', ['EMERGENCY  >'], '#d02a2a', '#ffffff', 128, 28));
  spot('elevator', -16.2, 0.9, 0.7, 'Call the elevator', () => say(['You press the button. A light comes on. Nothing else happens. The sign says "since 1998".']));
  spot('gurney', -15.6, 1.4, 0.7, 'Ride the gurney', () => say(['You jump on the gurney. It rolls four feet down the hall and bumps the wall. Again.', 'A nurse pushes the gurney back without looking up. You are still on it. This is a taxi now.']));

  // ---------------- patient rooms
  const patientRoom = (x0, k) => {
    const cx = x0 + 2.25, bx = x0 + 1.25;
    Q.bed(bx, -4.6, 0, k === 0 ? { patient: true, hair: 0xe8e8e8 } : { blanket: 0xf0d8a8 });
    Q.iv(bx - 0.75, -5.3); Q.monitor(bx + 0.75, 1.7, -7.99, 0);
    { const F = P.at(bx, -7.99, 0); F.box('plain', 0xe8e4dc, 1.8, 0.3, 0.06, 0, 1.3, 0.03); for (let j = 0; j < 4; j++) F.box('plain', [0xd02a2a, 0xe8c020, 0x3aa060, 0xf4f0e8][j], 0.08, 0.1, 0.03, -0.6 + j * 0.2, 1.3, 0.07); F.box('glow', 0xfff4e0, 1.2, 0.05, 0.1, 0, 1.95, 0.06, 0, { tint: false }); }
    lights.push({ x: bx, y: 1.85, z: -7.5, c: 0xfff0d8, i: 0.35, halo: false });
    { const F = P.table(bx + 0.2, -3.9, 0, { w: 0.8, d: 0.4, h: 0.95, wood: 0xc8a878, legKey: 'metal', leg: 0x8a8e96, solid: false }); F.box('plain', 0xd8c8a8, 0.4, 0.02, 0.3, 0, 0.96, 0); F.box('glass', 0x40d060, 0.09, 0.07, 0.09, -0.08, 1.01, 0); F.cyl('plain', 0xf4f0e8, 0.035, 0.03, 0.09, 0.1, 1.02, 0.03, 6); F.box('plain', 0xf4f0e8, 0.12, 0.012, 0.02, 0.05, 0.975, 0.1); }
    P.armchair(x0 + 3.6, -5.6, -PI / 2, { col: k ? 0x8a6a4a : 0x6a8a9a, w: 0.85 });
    Q.curtain(bx + 1.2, -5.2, PI / 2, 3.0, H, k ? 0xf0d8a8 : 0x8ab8d8);
    P.window(cx, 1.7, -hd + 0.001, 0, 1.6, 1.3, { trim: 0xd8dce0 });
    P.tv(x0 + 4.39, -3.0, -PI / 2, { w: 0.8, y: 2.3, console: false, screen: atlas.region('soap', 64, 36, (g) => { g.fillStyle = '#8a5a6a'; g.fillRect(-1, -1, 66, 38); g.fillStyle = '#e8b890'; g.beginPath(); g.arc(20, 16, 8, 0, 7); g.fill(); g.beginPath(); g.arc(44, 16, 8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '5px sans-serif'; g.fillText('"He is my twin\'s clone."', 4, 33); }) });
    P.dresser(x0 + 0.42, -1.2, PI / 2, { w: 1.0, h: 0.8, d: 0.45, wood: 0xc8a878, pull: 0x8a8e96 });
    if (k === 0) { P.vase(x0 + 0.42, 0.83, -1.2, 0xe8e4dc, 0xe85a7a); const F = P.at(x0 + 0.42, -0.9, PI / 2); F.box('plain', 0xfff4c0, 0.16, 0.2, 0.01, 0, 0.93, 0, 0.3, { rx: -0.2 }); }
    { const F = P.at(x0 + 4.39, -1.4, -PI / 2); F.box('wood', 0xe8e4dc, 0.8, 2.1, 0.04, 0, 1.05, 0.01); F.sph('shiny', 0xc8ccd4, 0.035, 0.3, 1.0, 0.05); P.decal(F, L('wc', ['WC'], '#3a6a9a', '#ffffff', 32, 20), 0.2, 0.12, 0, 1.7, 0.035); }
    P.troffer(cx, -3.2, H, 1.2, 0, 0.6);
  };
  patientRoom(-17, 0); patientRoom(-12.5, 1);
  spot('henderson', -15.0, -4.3, 0.7, 'Sit on Mr. Henderson', () => say(['You climb onto the sleeping man\'s blanket and loaf. His heart monitor goes from 72 to 64. You are medicine.', 'Mr. Henderson, without opening his eyes: "Is that you, Muffin?" You decide you are Muffin.']));
  spot('jello', -15.3, -3.2, 0.6, 'Eat the jello', () => { heal(6); say('Green. Wobbly. It tastes like the colour green. +6 health.'); });
  spot('bed', -11.25, -3.4, 0.9, 'Nap in the empty bed');

  // ---------------- nurses' station (open to the corridor)
  { const F = P.cabinets(-6.0, -1.3, 0, { w: 3.4, d: 0.6, h: 1.1, col: 0xf4f0e8, top: 0x8ab0c8, drawers: false, pull: 0x8a8e96 });
    P.decal(F, L('nst', ['NURSES STATION'], '#8ab0c8', '#ffffff', 128, 20), 1.6, 0.25, 0, 0.6, 0.31);
    for (const lx of [-1.0, 0.3]) { F.box('plain', 0x1a1a1e, 0.46, 0.3, 0.03, lx, 1.3, -0.12, 0, { rx: -0.05 }); P.decal(F, Q.ecg, 0.42, 0.26, lx, 1.3, -0.137, PI, 'aglow'); }
    for (let k = 0; k < 6; k++) F.box('plain', pick([0xd03030, 0x3a6ad0, 0xe8c020, 0x3aa060]), 0.03, 0.28, 0.22, 1.0 + k * 0.045, 1.26, 0.05, 0, { rz: 0.1 }); F.rbox('plain', 0xf8d8e0, 0.3, 0.08, 0.22, -0.3, 1.16, 0.12, 0.3, { round: 0.02 });
    Q.nurse(-5.6, -2.1, 0, { hair: 0x2a2a2e, skin: 0xb88a68 }); Q.nurse(-7.0, -2.3, 0.6, { top: 0x6a5ab0, hair: 0xc86a2a, sit: false }); }
  P.bookcase(-6.0, -7.82, 0, { w: 3.4, h: 2.2, wood: 0xf4f0e8, n: 5 });
  Q.cart(-4.5, -4.6, -PI / 2, 0x3a6a9a); Q.iv(-7.5, -6.6); Q.iv(-7.2, -6.9);
  P.decal(P.at(-7.892, -4.0, PI / 2), atlas.region('ptboard', 128, 96, (g) => { g.fillStyle = '#f8f8f4'; g.fillRect(-1, -1, 130, 98); g.strokeStyle = '#c8ccd4'; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(0, k * 16); g.lineTo(128, k * 16); g.stroke(); } g.fillStyle = '#1a1a1e'; g.font = 'bold 8px sans-serif'; g.fillText('RM   PATIENT       NOTES', 4, 11); g.font = '7px sans-serif'; [['1', 'HENDERSON', 'asks for "Muffin"'], ['2', '(empty)', 'cat hair?? again'], ['ER1', 'DOUG', 'golf cart, leg'], ['ER3', 'RACCOON', 'do NOT pet'], ['OR', 'TEDDY', 'stuffing transplant']].forEach(([a, b, c], i) => { g.fillText(a, 4, 27 + i * 16); g.fillText(b, 26, 27 + i * 16); g.fillStyle = '#3a6ad0'; g.fillText(c, 76, 27 + i * 16); g.fillStyle = '#1a1a1e'; }); }), 1.7, 1.25, 0, 1.75, 0);
  { const F = P.table(-5.2, -6.0, 0, { round: true, w: 0.9, h: 0.74, wood: 0xc8a878 }); F.box('plain', 0xf8d0d8, 0.4, 0.06, 0.3, 0, 0.77, 0, 0.3); for (let k = 0; k < 4; k++) F.cyl('plain', pick([0xe8c070, 0xc88a4a, 0xf4d8e0]), 0.045, 0.045, 0.03, -0.1 + (k % 2) * 0.12, 0.815, -0.06 + ((k / 2) | 0) * 0.11, 8); for (const e of [-1, 1]) P.chair(-5.2 + e * 0.7, -6.0, e * -PI / 2, { wood: 0x8a8e96, seat: 0x8ab0c8, solid: false }); }
  P.troffer(-6.0, -2.4, H, 1.2, 0, 0.7); P.troffer(-6.0, -5.8, H, 1.2, 0, 0.6);
  spot('charts', -6.0, -0.5, 0.9, 'Sit on the charts', () => say(['You sit on a patient chart. The nurse lifts you, moves the chart, puts you down. You sit on the next chart.', 'The patient board says "RM 2: cat hair?? again". That is libel. It is also true.']));
  spot('donut', -5.2, -5.2, 0.7, 'Take a break-room donut', () => { heal(8); say('Pink box. Sprinkles. The night shift will never know. +8 health.'); });

  // ---------------- X-ray
  { const F = P.at(-1.8, -4.6, 0); F.rbox('metal', 0xd8dce0, 0.9, 0.12, 2.2, 0, 0.8, 0); F.rbox('metal', 0x8a8e96, 0.5, 0.74, 1.2, 0, 0.37, 0); F.box('plain', 0x2a2a2e, 0.7, 0.02, 1.6, 0, 0.87, 0);
    F.box('metal', 0x8a8e96, 0.12, 0.1, 3.4, -0.9, H - 0.06, 0); F.box('metal', 0xd8dce0, 0.1, 1.0, 0.1, -0.9, H - 0.6, 0.2); F.box('metal', 0xd8dce0, 1.0, 0.1, 0.1, -0.45, H - 1.1, 0.2); F.rbox('metal', 0xe8e4dc, 0.5, 0.4, 0.5, 0, H - 1.25, 0.2); F.box('plain', 0x2a2a2e, 0.3, 0.1, 0.3, 0, H - 1.5, 0.2);
    F.col(0, 0, 0.9, 2.2, 0.88); }
  { const F = P.at(0.2, -1.4, -PI / 2); F.box('metal', 0x8a9aa8, 1.6, 2.1, 0.08, 0.4, 1.05, 0.7); F.box('glass', 0xc8e8e0, 0.8, 0.6, 0.02, 0.4, 1.5, 0.75); F.col(0.4, 0.7, 1.6, 0.1, 2.1);
    P.desk(0.45, -1.2, 0, { w: 1.1, d: 0.6, wood: 0xd8dce0, screen: atlas.region('skel', 64, 40, (g) => { g.fillStyle = '#081018'; g.fillRect(-1, -1, 66, 42); g.strokeStyle = '#d8ecff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, 20); g.lineTo(44, 20); g.stroke(); for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(18 + k * 4, 14); g.lineTo(18 + k * 4, 26); g.stroke(); } g.beginPath(); g.arc(50, 18, 5, 0, 7); g.stroke(); g.beginPath(); g.moveTo(46, 13); g.lineTo(47, 8); g.lineTo(50, 13); g.moveTo(51, 13); g.lineTo(54, 8); g.lineTo(55, 14); g.stroke(); g.beginPath(); g.moveTo(14, 20); g.quadraticCurveTo(4, 18, 6, 8); g.stroke(); for (const x of [20, 40]) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 36); g.stroke(); } g.fillStyle = '#e8c020'; g.beginPath(); g.arc(30, 21, 2.5, 0, 7); g.fill(); }) }); }
  { const F = P.at(-3.892, -3.0, PI / 2); F.box('plain', 0xe8e4dc, 1.3, 0.8, 0.06, 0, 1.6, 0.03); F.quad('glow', 0xd8ecff, 1.2, 0.7, 0, 1.6, 0.065);
    P.decal(F, atlas.region('film', 96, 56, (g) => { g.fillStyle = '#101820'; g.fillRect(-1, -1, 98, 58); g.strokeStyle = '#c8dcec'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 28); g.lineTo(40, 28); g.stroke(); for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(12 + k * 5, 20); g.lineTo(12 + k * 5, 36); g.stroke(); } g.fillStyle = '#c8dcec'; g.fillRect(52, 0, 2, 56); g.beginPath(); g.arc(74, 20, 9, 0, 7); g.stroke(); g.fillStyle = '#e8c020'; g.fillRect(68, 34, 14, 3); g.fillStyle = '#c8dcec'; g.font = '6px sans-serif'; g.fillText('FISH BONE?', 58, 50); }), 1.1, 0.64, 0, 1.6, 0.07, 0, 'aglow');
    for (let k = 0; k < 2; k++) { F.box('cloth', 0x3a5a8a, 0.5, 0.9, 0.06, -1.6 - k * 0.6, 1.3, 0.05); F.box('metal', 0x8a8e96, 0.1, 0.03, 0.08, -1.6 - k * 0.6, 1.8, 0.05); }
    P.decal(F, L('rad', ['CAUTION', 'X-RAYS', 'no tails on the table'], '#e8c020', '#1a1a1e', 64, 48, { small: true }), 0.5, 0.38, 1.3, 1.7, 0.012); }
  lights.push({ x: -3.5, y: 1.6, z: -3.0, c: 0xc8e0ff, i: 0.3, halo: false });
  P.troffer(-1.6, -4.4, H, 1.2, PI / 2, 0.45, 0xe0e8ff);
  spot('xray', -2.8, -4.6, 0.9, 'Get an X-ray', () => { A && A.Sfx.blip && A.Sfx.blip(1200); say(['BZZT. The screen shows one cat skeleton, one quarter, and what the technician calls "a concerning amount of string".', 'The film comes out. Your skeleton is doing a little pose. Even your bones are handsome.']); });

  // ---------------- operating room
  { const F = P.at(4.5, -4.4, 0); F.rbox('metal', 0x8a8e96, 0.4, 0.7, 0.6, 0, 0.35, 0); F.rbox('plain', 0x2a2a2e, 0.7, 0.1, 2.0, 0, 0.78, 0, 0, { round: 0.03 }); F.rbox('cloth', 0x3a9a8a, 0.86, 0.04, 1.5, 0, 0.85, 0.15, 0, { round: 0.02 }); F.col(0, 0, 0.8, 2.0, 0.88);
    Q.teddy(F, 0, 0.87, -0.2, 1.6); F.box('plain', 0xf4f0e8, 0.12, 0.02, 0.1, 0, 1.06, -0.13);   // the patient, mid stuffing transplant
    for (const [lx, lz, r] of [[-0.5, -0.5, 0.32], [0.55, 0.3, 0.26]]) { F.cyl('metal', 0xd8dce0, 0.03, 0.03, 0.5, lx * 0.5, H - 0.25, lz * 0.5, 6); F.box('metal', 0xd8dce0, 0.05, 0.05, 0.7, lx * 0.75, H - 0.5, lz * 0.75, Math.atan2(lx, lz)); F.cyl('metal', 0xe8e4dc, r, r * 0.8, 0.12, lx, H - 0.9, lz, 12); F.cyl('glow', 0xfffff0, r * 0.85, r * 0.85, 0.02, lx, H - 0.965, lz, 12, { tint: false }); }
    lights.push({ x: 4.5, y: 2.0, z: -4.4, c: 0xffffff, i: 1.3, r: 0.3, halo: false }); }
  P.person(3.75, -4.5, PI / 2, { top: SCRUB, legs: SCRUB, cap: 0x3a9a8a, mask: 0x8ad0e0, hair: 0x3a9a8a, shoes: 0xf4f4f0 });
  P.person(5.25, -4.2, -PI / 2, { top: SCRUB, legs: SCRUB, cap: 0x3a9a8a, mask: 0x8ad0e0, hair: 0x3a9a8a, shoes: 0xf4f4f0, skin: 0xb88a68 });
  { const F = P.at(5.3, -5.4, 0.3); F.cyl('metal', 0xc8ccd4, 0.02, 0.02, 0.95, 0, 0.475, 0, 5); F.cyl('metal', 0xc8ccd4, 0.2, 0.22, 0.03, 0, 0.015, 0, 8); F.box('metal', 0xd8dce4, 0.5, 0.02, 0.34, 0, 0.96, 0); for (let k = 0; k < 6; k++) F.box('shiny', 0xe8ecf0, 0.015, 0.008, 0.16, -0.18 + k * 0.07, 0.975, 0, (k - 3) * 0.05); F.col(0, 0, 0.5, 0.34, 0.98); }
  { const F = P.at(3.2, -6.3, 0.4); F.rbox('metal', 0xd8dce0, 0.6, 1.3, 0.5, 0, 0.65, 0); P.decal(F, Q.ecg, 0.4, 0.26, 0, 1.5, 0.2, 0, 'aglow'); F.box('plain', 0x2a2a2e, 0.46, 0.32, 0.06, 0, 1.5, 0.16); for (let k = 0; k < 3; k++) F.cyl('plain', [0x3a6ad0, 0x3aa060, 0xe8c020][k], 0.05, 0.05, 0.4, -0.18 + k * 0.18, 1.0, -0.3, 6); F.cyl('plain', 0x2a2a2e, 0.03, 0.03, 0.9, 0.4, 0.9, 0.3, 5, { rz: 1.1 }); F.col(0, 0, 0.6, 0.5, 1.6); }
  Q.iv(3.9, -5.5); P.stool(5.9, -3.4, { seat: 0x2a2a2e, metal: 0xc8ccd4 });
  { const F = P.cabinets(6.3, -7.68, 0, { w: 3.0, col: 0xd8dce0, top: 0xb8bcc4, upper: true, pull: 0x8a8e96 }); for (let k = 0; k < 5; k++) F.box('plain', pick([0xf4f0e8, 0x8ab8d8, 0xd8ecff]), 0.2, 0.12, 0.2, -1.1 + k * 0.5, 0.97, 0); }
  { const F = P.cabinets(2.2, -0.62, PI, { w: 1.8, d: 0.5, col: 0xb8bcc4, top: 0xd8dce0, pull: 0x8a8e96 }); P.sink(F, -0.4, 0.9, 0); P.sink(F, 0.4, 0.9, 0); }
  { const F = P.at(7.892, -3.0, -PI / 2); F.cyl('plain', 0xf4f0e8, 0.18, 0.18, 0.04, 0, 2.5, 0.03, 12, { rx: PI / 2 }); F.box('plain', 0x1a1a1e, 0.012, 0.12, 0.01, 0, 2.55, 0.06); F.box('plain', 0x1a1a1e, 0.08, 0.012, 0.01, 0.04, 2.5, 0.06); P.decal(F, L('orsign', ['STERILE AREA', 'that means you, cat'], '#3a9a8a', '#ffffff', 96, 32, { small: true }), 0.9, 0.3, 0, 1.9, 0.012); }
  P.troffer(2.6, -2.6, H, 1.2, 0, 0.6); P.troffer(6.4, -5.8, H, 1.2, 0, 0.6);
  spot('surgery', 4.5, -3.1, 0.9, 'Watch the operation', () => say(['The surgeons are operating on a teddy bear. "Stuffing." A hand comes out. You give them the stuffing. You are scrubbed in now.', 'Surgeon: "Is that a cat?" Nurse: "Don\'t look at it. It can sense fear." They are right.']));

  // ---------------- pharmacy (counter in the opening to the lobby) + exam room
  { const F = P.cabinets(0.25, 5, -PI / 2, { w: 2.5, d: 0.5, h: 1.05, col: 0xf4f0e8, top: 0x8ac0a0, drawers: false, pull: 0x8a8e96 }); F.rbox('plain', 0xe0dcd0, 0.36, 0.22, 0.3, 0.7, 1.16, 0); for (let k = 0; k < 3; k++) F.cyl('plain', 0xe87020, 0.035, 0.035, 0.09, -0.6 + k * 0.1, 1.1, 0.05, 6); F.box('plain', 0xf4f0e8, 0.16, 0.2, 0.08, -0.2, 1.15, 0.05);
    hangSign(P, -0.3, 5, PI / 2, H, 2.75, 1.6, 0.3, L('rx', ['Rx  PHARMACY'], '#2a8a5a', '#ffffff', 128, 24));
    P.person(1.0, 5, -PI / 2, { top: 0xf4f4f0, coat: 0xf4f4f0, legs: 0x3a3a4a, hair: 0x2a2a2e, skin: 0xd8a070 }); }
  for (const [x, ry] of [[3.72, -PI / 2]]) { const F = P.at(x, 5.2, ry); for (const e of [-1, 0, 1]) F.box('metal', 0xd8dce0, 0.03, 2.2, 0.36, e * 1.6, 1.1, 0); F.box('metal', 0xd8dce0, 3.2, 2.2, 0.02, 0, 1.1, -0.17); for (let r = 0; r < 6; r++) { const y = 0.15 + r * 0.36; F.box('metal', 0xd8dce0, 3.2, 0.02, 0.36, 0, y, 0); for (const e of [-1, 1]) P.books(F, e * 0.8, y + 0.01, 0.05, 1.4, { h: 0.16, d: 0.1, cols: [0xe87020, 0xf4f0e8, 0xe87020, 0x8ab8d8, 0xf4f0e8, 0x3aa060] }); } F.col(0, 0, 3.2, 0.36, 2.2); }
  { const F = P.at(1.6, 7.6, PI); F.rbox('metal', 0xf4f0e8, 0.8, 1.7, 0.6, 0, 0.85, 0); F.box('glass', 0xd8f0ff, 0.66, 1.3, 0.02, 0, 0.95, 0.31); F.box('glow', 0xd8f0ff, 0.6, 0.02, 0.4, 0, 1.62, 0, 0, { tint: false }); F.col(0, 0, 0.8, 0.6, 1.7); }
  P.troffer(2.0, 4.6, H, 1.2, PI / 2, 0.6);
  spot('pharmacy', -0.7, 5, 0.8, 'Ask the pharmacist', () => say(['"Catnip is prescription only." You do not have a prescription. You have big eyes. "...It is still prescription only."', 'The pharmacist slides a single cat treat across the counter like a bartender. No words. Respect.']));
  { const F = P.at(5.2, 7.2, PI / 2); F.rbox('metal', 0xd8dce0, 0.7, 0.6, 1.8, 0, 0.3, 0); F.rbox('cloth', 0x3a6a9a, 0.68, 0.1, 1.8, 0, 0.66, 0, 0, { round: 0.04 }); F.box('plain', 0xf8f8f4, 0.5, 0.012, 1.7, 0, 0.716, 0); F.rbox('cloth', 0x3a6a9a, 0.68, 0.1, 0.6, 0, 0.82, -0.7, 0, { round: 0.04, rx: -0.5 }); F.cyl('plain', 0xf8f8f4, 0.06, 0.06, 0.5, 0, 0.95, -0.98, 8, { rz: PI / 2 }); F.col(0, 0, 0.7, 1.8, 0.72); }
  { const F = P.cabinets(7.69, 4.2, -PI / 2, { w: 2.0, d: 0.55, col: 0xf4f0e8, top: 0xb8bcc4, upper: true, splash: 0xe8ecf0, pull: 0x8a8e96 }); P.sink(F, 0.5, 0.9, 0); for (let k = 0; k < 3; k++) F.cyl('glass', 0xffffff, 0.05, 0.05, 0.16, -0.7 + k * 0.16, 1.0, 0, 8); for (let k = 0; k < 5; k++) { F.cyl('plain', 0xf4f0e8, 0.004, 0.004, 0.14, -0.7 + Math.sin(k) * 0.02, 1.08, Math.cos(k) * 0.02, 3); F.sph('plain', pick([0xd03030, 0x3aa060, 0xe8c020, 0x8a4ac0]), 0.022, -0.7 + Math.sin(k) * 0.03, 1.16, Math.cos(k) * 0.03, { ws: 4, hs: 3 }); } }
  P.stool(6.2, 5.0, { seat: 0x2a2a2e, metal: 0xc8ccd4 });
  P.person(6.9, 6.3, -2.2, { top: 0x8ab8d8, coat: 0xf4f4f0, legs: 0x3a3a4a, hair: 0x8a8a8a });
  { const F = P.at(7.892, 6.6, -PI / 2); P.decal(F, atlas.region('eye', 48, 72, (g) => { g.fillStyle = '#f8f8f4'; g.fillRect(-1, -1, 50, 74); g.fillStyle = '#1a1a1e'; g.textAlign = 'center'; ['M', 'E O', 'W M E', 'O W M E', 'o w m e o w', 'p s p s p s p s'].forEach((t, i) => { g.font = `bold ${16 - i * 2.2}px serif`; g.fillText(t, 24, 14 + i * 11); }); }), 0.5, 0.75, 0, 1.75, 0.012);
    P.decal(P.at(4.108, 4.2, PI / 2), atlas.region('anat', 64, 80, (g) => { g.fillStyle = '#f4ecd8'; g.fillRect(-1, -1, 66, 82); g.fillStyle = '#e8a8a8'; g.beginPath(); g.ellipse(32, 46, 14, 20, 0, 0, 7); g.fill(); g.beginPath(); g.arc(32, 20, 10, 0, 7); g.fill(); g.beginPath(); g.moveTo(24, 14); g.lineTo(25, 4); g.lineTo(31, 12); g.moveTo(33, 12); g.lineTo(39, 4); g.lineTo(40, 14); g.fill(); g.fillStyle = '#c03030'; g.beginPath(); g.arc(30, 40, 4, 0, 7); g.fill(); g.fillStyle = '#8a5a3a'; g.fillRect(28, 48, 10, 8); g.fillStyle = '#1a1a1e'; g.font = '5px sans-serif'; g.fillText('THE CAT (approx.)', 8, 76); g.fillText('heart', 44, 40); g.fillText('snacks', 42, 54); }), 0.6, 0.75, 0, 1.75, 0);
    const G = P.at(4.4, 2.5, 0.4); G.box('metal', 0x8a8e96, 0.36, 0.06, 0.44, 0, 0.03, 0); G.box('metal', 0x8a8e96, 0.05, 1.3, 0.05, 0, 0.65, -0.2); G.box('metal', 0x8a8e96, 0.3, 0.04, 0.06, 0, 1.3, -0.2); G.col(0, 0, 0.36, 0.44, 0.08); }
  P.window(6, 1.65, hd - 0.001, PI, 1.6, 1.3, { trim: 0xd8dce0 });
  P.troffer(6.0, 4.8, H, 1.2, PI / 2, 0.6);
  spot('lollipop', 7.0, 3.7, 0.7, 'Take a lollipop', () => { heal(5); say(['You take a lollipop from the jar. Then the jar. +5 health.', 'Grape. The doctor says you were very brave. You were not examined. +5 health.']); });
  spot('scale', 4.6, 2.9, 0.6, 'Stand on the scale', () => say(['11 pounds. With the plate carrier. The doctor writes "robust".']));

  // ---------------- emergency room
  glassDoors(P, 12, hd - 0.02, 2.2, 2.4, 0xd02a2a);
  lights.push({ x: 12, y: 1.6, z: hd - 1.0, c: 0xe8f0ff, i: 0.6, halo: false });
  B.flat('plain', 0xd02a2a, 0.12, 9.0, 12, 0.012, 3.2, 0, { ao: false, tint: false });
  hangSign(P, 12, 5.6, 0, H, 2.62, 2.2, 0.4, L('emerg', ['EMERGENCY'], '#d02a2a', '#ffffff', 192, 36));
  Q.seats(8.45, 5.2, PI / 2, 5, 0xb04040); Q.vending(9.3, 7.55, PI, 0); Q.vending(10.3, 7.55, PI, 1);
  P.person(8.75, 4.6, PI / 2, { sit: true, top: 0x5a7a3a, legs: 0x3a3a4a, hair: 0x5a3a22, solid: false });
  { const F = P.at(16.89, 6.0, -PI / 2); F.box('plain', 0x1a1a1e, 1.5, 0.5, 0.06, 0, 2.3, 0.03); P.decal(F, L('wait', ['CURRENT WAIT', '6 HRS 40 MIN'], '#1a0a0a', '#ff5030', 128, 40), 1.4, 0.42, 0, 2.3, 0.065, 0, 'aglow'); F.box('plain', 0xf4f0e8, 0.3, 0.4, 0.1, -1.3, 1.3, 0.05); for (let k = 0; k < 3; k++) F.box('plain', [0x8ab8d8, 0xc8a0d8, 0xf4f0e8][k], 0.26, 0.12, 0.1, 1.2, 1.2 + k * 0.14, 0.05); }
  { const F = P.cabinets(14.6, 3.7, 0, { w: 3.2, d: 0.6, h: 1.1, col: 0xf4f0e8, top: 0xd02a2a, drawers: false, pull: 0x8a8e96 }); P.decal(F, L('triage', ['TRIAGE'], '#d02a2a', '#ffffff', 96, 24), 1.2, 0.3, 0, 0.6, 0.31);
    F.box('plain', 0x1a1a1e, 0.46, 0.3, 0.03, 0.6, 1.3, -0.12, 0, { rx: -0.05 }); F.quad('glow', 0x8ab8e0, 0.42, 0.26, 0.6, 1.3, -0.137, PI); F.box('plain', 0xf4f0e8, 0.24, 0.02, 0.32, -0.4, 1.13, 0.05, 0.2); F.cyl('plain', 0x1a1a1e, 0.04, 0.035, 0.1, -0.9, 1.17, 0.05, 6);
    Q.nurse(14.6, 2.95, 0, { top: 0x3a6ad0, hair: 0x5a3a22 }); }
  // three curtained bays along the back wall
  [9.7, 12.6, 15.5].forEach((x, k) => {
    Q.bed(x, -6.85, 0, k === 0 ? { patient: true, cast: true, hair: 0x5a4030, blanket: 0xd8e4ec } : k === 2 ? { blanket: 0xd8e4ec } : { blanket: 0xd8e4ec });
    Q.iv(x - 0.8, -7.4); Q.monitor(x + 0.8, 1.75, -7.99, 0);
    { const F = P.at(x, -7.99, 0); F.box('plain', 0xe8e4dc, 2.2, 0.26, 0.06, 0, 1.25, 0.03); for (let j = 0; j < 3; j++) F.box('plain', [0xd02a2a, 0x3aa060, 0xe8c020][j], 0.08, 0.1, 0.03, -0.9 + j * 0.2, 1.25, 0.07); F.box('plain', 0xd02a2a, 0.2, 0.26, 0.14, 1.0, 1.5, 0.08); P.decal(F, L('bay' + k, ['ER ' + (k + 1)], '#f0ecec', '#d02a2a', 48, 24), 0.4, 0.2, 0, 2.55, 0.012); }
    if (k < 2) Q.curtain(x + 1.45, -6.4, PI / 2, 3.0, H, 0xd8a8a8);
    P.troffer(x, -5.4, H, 1.2, PI / 2, 0.5);
  });
  { // the raccoon in bay 3: do not pet
    const F = P.at(15.5, -6.6, 0); F.rbox('plain', 0x7a7a80, 0.34, 0.26, 0.5, 0, 0.84, 0.1, 0, { round: 0.08 }); F.rbox('plain', 0x8a8a90, 0.24, 0.2, 0.22, 0, 0.92, 0.42, 0, { round: 0.06 }); F.box('plain', 0x1a1a1e, 0.25, 0.06, 0.06, 0, 0.94, 0.5); for (const e of [-1, 1]) { F.box('glow', 0xe8f8a0, 0.03, 0.03, 0.01, e * 0.05, 0.94, 0.535, 0, { tint: false }); F.box('plain', 0x5a5a60, 0.06, 0.07, 0.03, e * 0.09, 1.04, 0.38); } for (let j = 0; j < 4; j++) F.cyl('plain', j % 2 ? 0x1a1a1e : 0x8a8a90, 0.05, 0.05, 0.09, -0.05, 0.8, -0.2 - j * 0.09, 6, { rx: PI / 2 }); F.box('plain', 0xf8f8f4, 0.1, 0.08, 0.12, 0.14, 0.76, 0.3); }
  Q.cart(11.2, -3.4, 0.3, 0xc02020, { defib: true }); Q.cart(14.2, -4.2, PI, 0x3a6a9a); Q.wheelchair(16.2, 0.6, -PI / 2);
  { const F = P.at(13.2, -0.9, 0); F.rbox('plain', 0xf4f0e8, 1.6, 1.05, 0.6, 0, 0.525, 0); F.box('plain', 0xd02a2a, 1.64, 0.04, 0.64, 0, 1.07, 0); for (const lx of [-0.4, 0.4]) { F.box('plain', 0x1a1a1e, 0.46, 0.3, 0.03, lx, 1.28, 0, 0, { rx: -0.05 }); P.decal(F, Q.ecg, 0.42, 0.26, lx, 1.28, -0.02, PI, 'aglow'); } F.col(0, 0, 1.6, 0.6, 1.1);
    P.person(13.2, -1.6, 0, { top: 0x8ab8d8, coat: 0xf4f4f0, legs: 0x3a3a4a, hair: 0x2a2a2e, skin: 0xb88a68 }); }
  { // the ambulance stretcher by the doors
    const F = P.at(15.4, 6.6, PI / 2); F.box('metal', 0xe8c020, 0.6, 0.05, 1.9, 0, 0.75, 0); for (const ex of [-1, 1]) { F.box('metal', 0xe8c020, 0.04, 0.9, 0.04, ex * 0.26, 0.4, 0.5, 0, { rx: 0.5 }); F.box('metal', 0xe8c020, 0.04, 0.9, 0.04, ex * 0.26, 0.4, -0.5, 0, { rx: -0.5 }); for (const ez of [-1, 1]) F.cyl('plain', 0x2a2a2e, 0.07, 0.07, 0.04, ex * 0.26, 0.07, ez * 0.75, 8, { rz: PI / 2 }); } F.rbox('cloth', 0xd02a2a, 0.56, 0.1, 1.8, 0, 0.83, 0, 0, { round: 0.04 }); F.rbox('cloth', 0xf8f8f4, 0.4, 0.08, 0.3, 0, 0.92, -0.7, 0, { round: 0.03 }); for (const lz of [-0.2, 0.4]) F.box('plain', 0x1a1a1e, 0.6, 0.02, 0.06, 0, 0.885, lz); F.col(0, 0, 0.6, 1.9, 0.88); }
  for (const [x, z] of [[10.2, 5.4], [14.6, 5.4], [10.4, 0.6], [14.6, 0.2], [12.4, -2.6]]) P.troffer(x, z, H, 1.2, 0, 0.7);
  P.window(16.999, 1.7, 3.0, -PI / 2, 1.6, 1.3, { trim: 0xd8dce0 });
  spot('triage', 14.6, 4.6, 0.9, 'Check in at triage', () => say(['"Name?" Goobles. "Complaint?" Many. "...Medical complaint?" You are told to take a seat. The wait is six hours forty.', 'The nurse hands you a clipboard with forty pages. You sign each one with a paw print.']));
  spot('vending', 9.8, 6.7, 0.8, 'Buy a snack ($1)', () => { if (pay(1)) { heal(5); say(['Clunk. A bag of cheese puffs. Orange paws for the rest of the day. +5 health. -$1', 'It eats your dollar and gives you nothing. You shake the machine. Two bags fall. Justice. +5 health.']); } else say('You have no dollar. You stick a paw up the flap anyway. Nothing. They thought of that.'); });
  spot('doug', 10.6, -6.0, 0.7, 'Visit Doug', () => say(['Doug, leg in a cast: "Gary said the golf cart could make the jump." He looks at the ceiling. "It could not."', 'Doug sees you and tries to hide a get-well card from Gary. It reads: "Your absence has been noted. - G"']));
  spot('raccoon', 14.7, -5.9, 0.6, 'Look at the raccoon', () => say(['A raccoon with a bandaged paw, in a hospital bed, eating the patient in bay two\'s pudding. He nods at you. You nod back.']));
  spot('erexit', 12, hd - 0.9, 0.9, 'Leave by the ER doors', () => { const e = S.entries.hospital && S.entries.hospital[1]; if (e) INTR.exit({ to: { x: e.x + Math.sin(e.yaw) * 2.6, z: e.z + Math.cos(e.yaw) * 2.6, yaw: e.yaw } }); else INTR.exit(); });

  zoneLights(lights, rooms, 3);
  const group = B.finish(new THREE.Group());
  return {
    group, size: [HW, HD], cols, floors: [], lights, unload: true, pack: true, name: 'Maple Grove Community Hospital',
    spawn: { x: -4.5, z: hd - 1.1, yaw: 0 }, exit: { x: -4.5, z: hd - 0.05, r: 0.8 },
    cam: { maxDist: 3.6, height: 2.7 }, bake: { amb: 0.34, maxEdge: 1.2 }, interact: hot,
    dispose() { atlas.tex.dispose(); }, stats: () => ({ atlas: atlas.used(), lights: lights.length, cols: cols.length }),
  };
}

/** Building-local (world.js frame, yaw PI) -> world: x = cx - lx, z = cz - lz; the opening faces local +z = world -z. */
function entry(cx, cz, lx, lz, inside) { return { x: cx - lx, z: cz - lz, yaw: PI, kind: 'door', ...(inside ? { inside } : {}) }; }

/** Call once after the interiors exist. a = { G, places, toast, addCash, Sfx } */
export function init(a) {
  A = a;
  const pl = a.places || {};
  if (pl.fireStation) {   // world.js buildFireStation: frame(172, 22, PI); office door local (11.4, -0.47), open bay 2 beside the parked engine
    S.entries.fire = [entry(172, 22, 11.4, -0.47), entry(172, 22, 3.75, 2.03, { x: 0.2 + 1.6, z: FD / 2 - 1.6, yaw: 0 })];
    INTR.registerRoom('firehouse', { name: 'Maple Grove VFD', build: buildFirehouse }, S.entries.fire);
  } else console.warn('[civic] places.fireStation missing');
  if (pl.hospital) {      // world.js buildHospital: frame(212, 33.5, PI); main doors local (-3, -4.97), ER doors (13.5, -6.97)
    S.entries.hospital = [entry(212, 33.5, -3, -4.97), entry(212, 33.5, 13.5, -6.97, { x: 12, z: HD / 2 - 1.3, yaw: 0 })];
    INTR.registerRoom('hospital', { name: 'Maple Grove Community Hospital', build: buildHospital }, S.entries.hospital);
  } else console.warn('[civic] places.hospital missing');
  if (typeof window !== 'undefined' && window.__G) window.__G.civic = { S };
  return true;
}
