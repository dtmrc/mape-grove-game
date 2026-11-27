// Main Street shop interiors (diet 2026-11-27: "i cant run inside of bevs threads" ... "or hanks hardware").
// Bev's Threads (clothing) and Hank's Hardware, built the same way as pizza.js: the room set, its door + window entries
// derived from places.clothing / places.hardware (world.js buildMainStreet storefront(), frame yaw PI, door at local
// (0, d/2 + 0.03), place point 1.97 m in front of it), and a till menu in the fishing shop's look.
// Room-local coords == building-local coords (front wall at +z), so the windows inside line up with the glass outside.
// Wired in game.js: STORES.init({ G, places, fishing, toast, addCash, Sfx }) next to PIZZA.init.
// Debug: window.__G.stores.buy('bev', 'scarf'), .S
import * as INTR from './interiors.js';
import { KIT } from './rooms.js';

const PI = Math.PI;

/** low-poly shopkeeper made of boxes, facing ry (0 = +z). o: { top, legs, skin, hair, bun, apron, glasses, cap, beard } */
function person(B, THREE, x, z, ry, o = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const at = (k, col, w, h, d, lx, y, lz, extra = {}) => { const [px, pz] = P(lx, lz); B.box(k, col, w, h, d, px, y, pz, ry, { ao: false, round: false, ...extra }); };
  const skin = o.skin ?? 0xe8b890;
  for (const e of [-1, 1]) { at('plain', o.legs ?? 0x2a2a3a, 0.16, 0.8, 0.18, e * 0.11, 0.4, 0); at('plain', 0x2a2018, 0.17, 0.08, 0.26, e * 0.11, 0.04, 0.04); }
  at('cloth', o.top ?? 0x6a3a7a, 0.48, 0.62, 0.28, 0, 1.12, 0, { round: 0.06 });
  if (o.apron) at('plain', o.apron, 0.42, 0.7, 0.02, 0, 1.0, 0.15);
  for (const e of [-1, 1]) { at('cloth', o.top ?? 0x6a3a7a, 0.12, 0.5, 0.14, e * 0.31, 1.15, 0.02); at('plain', skin, 0.1, 0.12, 0.12, e * 0.31, 0.84, 0.04); }
  at('plain', skin, 0.1, 0.08, 0.1, 0, 1.47, 0);
  at('plain', skin, 0.3, 0.32, 0.28, 0, 1.66, 0, { round: 0.05 });
  at('plain', o.hair ?? 0xb8b8c0, 0.32, 0.1, 0.3, 0, 1.84, -0.01);
  at('plain', o.hair ?? 0xb8b8c0, 0.32, 0.22, 0.06, 0, 1.72, -0.14);
  if (o.bun) { const [px, pz] = P(0, -0.12); B.sph('plain', o.hair ?? 0xb8b8c0, 0.1, px, 1.9, pz, { ao: false }); }
  if (o.cap) { at('plain', o.cap, 0.33, 0.08, 0.31, 0, 1.86, 0); at('plain', o.cap, 0.3, 0.03, 0.14, 0, 1.83, 0.2); }
  if (o.beard) at('plain', o.beard, 0.3, 0.14, 0.06, 0, 1.55, 0.13);
  for (const e of [-1, 1]) at('glow', 0x1a1a1a, 0.05, 0.04, 0.01, e * 0.07, 1.7, 0.145);
  if (o.glasses) { at('plain', o.glasses, 0.26, 0.012, 0.01, 0, 1.73, 0.15); for (const e of [-1, 1]) at('plain', o.glasses, 0.08, 0.06, 0.008, e * 0.07, 1.7, 0.152); }
  at('plain', 0xa04040, 0.1, 0.02, 0.01, 0, 1.58, 0.145);
}

// ====================================================================== Bev's Threads
const BW = 11.4, BD = 10.4, BH = 3.4;
const BEV_WINDOWS = [-3.5, 3.5];   // storeWin faces (y 1.65, 3.4 x 1.8)

function buildBev(ctx) {
  const { THREE, T } = ctx;
  const { ctex, grime, signTex, makeBuilder, shell, framedPicture, rnd, pick } = KIT;
  KIT.reseed(17);
  const B = makeBuilder(THREE, T);
  const PLUM = 0x5a2a4a, ROSE = 0xe8b8c8, BRASS = 0xd8b050;
  const floor = ctex(THREE, 'bev:floor', 64, 64, (g) => {
    for (let r = 0; r < 8; r++) for (let k = -1; k < 3; k++) { g.fillStyle = pick(['#c89a68', '#b88a58', '#d0a470', '#c09060']); g.fillRect(k * 24 + (r % 2) * 12, r * 8, 23, 7); }
    g.fillStyle = '#7a5a38'; for (let r = 0; r < 8; r++) g.fillRect(0, r * 8 + 7, 64, 1);
    grime(g, 64, 64, 120, 0.12);
  });
  const paper = ctex(THREE, 'bev:paper', 64, 64, (g) => {
    g.fillStyle = '#f4dce4'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ecc8d4'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 6, 64);
    g.fillStyle = '#d8a8b8'; for (let y = 8; y < 64; y += 16) for (let x = 3; x < 64; x += 16) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    grime(g, 64, 64, 60, 0.06);
  });
  const ceil = ctex(THREE, 'bev:ceil', 64, 64, (g) => { g.fillStyle = '#f2ece4'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#c8bcb0'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } });
  B.def('bfloor', { kind: 'lambert', map: floor }); B.def('bpaper', { kind: 'lambert', map: paper }); B.def('bceil', { kind: 'lambert', map: ceil });
  const cols = shell(B, THREE, { w: BW, d: BD, h: BH, floorKey: 'bfloor', wallKey: 'bpaper', ceilKey: 'bceil', ceilCol: 0xffffff, door: { x: 0, w: 1.3, h: 2.3 }, base: PLUM, frame: PLUM, wallTile: 1.4, floorTile: 1.6, trim: { c: 0xf4ece0, y: 1.0, h: 0.1 } });
  const hw = BW / 2, hd = BD / 2;

  // --- shop windows with the street outside, mannequins in the displays, the door
  const street = ctex(THREE, 'bev:street', 64, 32, (g) => { const gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#5a8ac8'); gr.addColorStop(0.75, '#d8e4f0'); g.fillStyle = gr; g.fillRect(0, 0, 64, 32); g.fillStyle = '#4a4a50'; g.fillRect(0, 26, 64, 6); g.fillStyle = '#8a9078'; g.fillRect(4, 12, 14, 14); g.fillStyle = '#b84a3a'; g.fillRect(36, 8, 22, 18); for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f4e8f0' : '#7a2a5a'; g.fillRect(k * 8, 0, 8, 3); } }, { repeat: false });
  B.def('bstreet', { kind: 'basic', map: street });
  for (const x of BEV_WINDOWS) {
    B.quad('bstreet', 0xffffff, 3.4, 1.8, x, 1.65, hd - 0.02, PI, { ao: false, tint: false });
    for (const y of [2.58, 0.72]) B.quad('plain', PLUM, 3.5, 0.08, x, y, hd - 0.03, PI, { ao: false, tint: false });
    for (const e of [-1, 1]) B.quad('plain', PLUM, 0.08, 1.9, x + e * 1.72, 1.65, hd - 0.03, PI, { ao: false, tint: false });
    B.box('wood', 0xf4ece0, 3.4, 0.45, 1.0, x, 0.225, hd - 0.55);   // display riser
    B.box('cloth', ROSE, 3.3, 0.04, 0.9, x, 0.47, hd - 0.55, 0, { ao: false });
  }
  const mannequin = (x, z, ry, top, bottom, hat) => {
    B.cyl('shiny', 0x333333, 0.18, 0.2, 0.03, x, 0.5, z, 10, { ao: false });
    B.cyl('shiny', 0x444444, 0.02, 0.02, 0.5, x, 0.75, z, 5, { ao: false });
    B.add(new THREE.CylinderGeometry(0.13, 0.17, 0.55, 8), 'plain', bottom, x, 1.25, z, ry, { ao: false });
    B.add(new THREE.CylinderGeometry(0.2, 0.14, 0.55, 8), 'cloth', top, x, 1.78, z, ry, { ao: false });
    B.add(new THREE.CylinderGeometry(0.22, 0.2, 0.08, 8), 'cloth', top, x, 2.07, z, ry, { ao: false });
    B.sph('shiny', 0xf0ece4, 0.12, x, 2.28, z, { ao: false, ws: 8, hs: 6 });
    if (hat) { B.cyl('plain', hat, 0.2, 0.2, 0.015, x, 2.37, z, 10, { ao: false }); B.cyl('plain', hat, 0.1, 0.12, 0.1, x, 2.42, z, 10, { ao: false }); }
  };
  mannequin(-4.3, hd - 0.55, PI, 0xc03050, 0x2a3a6a, 0xf0e0c0); mannequin(-2.7, hd - 0.55, PI, 0x3a7a5a, 0xd8c8a8);
  mannequin(2.7, hd - 0.55, PI, 0xf0c040, 0x3a3a3a); mannequin(4.3, hd - 0.55, PI, 0x7a4ac0, 0xe8e0d0, 0x2a2a2a);
  B.quad('bstreet', 0xc0c8d0, 1.2, 2.2, 0, 1.12, hd - 0.04, PI, { ao: false, tint: false });
  B.quad('shiny', BRASS, 0.06, 0.6, 0.45, 1.05, hd - 0.08, PI, { ao: false, tint: false });
  const hours = signTex(THREE, 'bev:hours', ["BEV'S", 'OPEN 9-6', 'CLOSED SUN'], '#fff8f0', '#5a2a4a', 64, 64, { font: 'sans-serif' });
  B.def('bhours', { kind: 'lambert', map: hours }); B.quad('bhours', 0xffffff, 0.3, 0.3, -0.2, 1.6, hd - 0.06, PI, { ao: false, tint: false });

  // --- the till at the back right: glass counter with scarves inside, register, Bev
  const cx = 3.3, cz = -hd + 2.2, CL = 3.2;
  B.box('wood', PLUM, CL, 0.9, 0.7, cx, 0.45, cz);
  B.box('glass', 0xfff8f0, CL - 0.1, 0.3, 0.6, cx, 1.06, cz, 0, { ao: false });
  B.box('shiny', 0xf4ece0, CL + 0.06, 0.04, 0.76, cx, 1.23, cz, 0, { ao: false });
  for (let k = 0; k < 6; k++) B.box('cloth', pick([0xc03050, 0xf0c040, 0x3a6ad0, 0x3aa060, 0xe8a0c0, 0x7a4ac0]), 0.38, 0.06, 0.4, cx - 1.2 + k * 0.48, 0.95, cz, rnd() * 0.3 - 0.15, { ao: false, round: false });
  B.box('plain', 0xe0dcd0, 0.42, 0.24, 0.38, cx + 0.8, 1.37, cz, PI); B.box('plain', 0x333333, 0.36, 0.2, 0.05, cx + 0.8, 1.58, cz - 0.15, PI, { ao: false, round: false });
  B.quad('glow', 0x90ff90, 0.3, 0.12, cx + 0.8, 1.58, cz - 0.18, PI, { ao: false, tint: false });
  B.cyl('plain', 0xf4ece0, 0.07, 0.07, 0.14, cx - 0.8, 1.32, cz + 0.1, 10, { ao: false }); for (let k = 0; k < 5; k++) B.box('plain', 0x3a3a3a, 0.01, 0.16, 0.01, cx - 0.82 + k * 0.01, 1.42, cz + 0.1, 0, { ao: false, round: false, rz: (k - 2) * 0.12 });   // pen cup
  for (let k = 0; k < 4; k++) B.box('plain', [0xf4ece0, 0xe8b8c8, 0xf4ece0, 0xc8a0b0][k], 0.32, 0.02, 0.24, cx - 0.2, 1.26 + k * 0.022, cz + 0.05, k * 0.1, { ao: false, round: false });   // tissue paper
  person(B, THREE, cx + 0.4, cz - 0.75, 0, { top: 0x7a3a6a, legs: 0x3a2a3a, hair: 0xd0d0d8, bun: true, glasses: 0xb8a040 });
  const bevTag = signTex(THREE, 'bev:tag', ['BEV', 'owner since 1974'], '#f4ece0', '#5a2a4a', 96, 40, { font: 'sans-serif' }); B.def('btag', { kind: 'lambert', map: bevTag });
  B.quad('btag', 0xffffff, 0.6, 0.25, cx, 0.7, cz + 0.36, 0, { ao: false, tint: false });
  // back wall behind the till: pegs with handbags, a framed photo of young Bev
  for (let k = 0; k < 5; k++) {
    const px = cx - 1.4 + k * 0.7; B.cyl('shiny', BRASS, 0.015, 0.015, 0.16, px, 2.1, -hd + 0.08, 5, { ao: false, rx: PI / 2 });
    const bc = pick([0x8a3a2a, 0x2a2a2a, 0xc0a070, 0xc03050, 0x3a5a8a]);
    B.box('plain', bc, 0.32, 0.26, 0.1, px, 1.82, -hd + 0.12, 0); B.add(new THREE.TorusGeometry(0.1, 0.012, 4, 10, PI), 'plain', bc, px, 1.95, -hd + 0.12, 0, { ao: false, tint: false });
  }
  const young = ctex(THREE, 'bev:young', 48, 64, (g) => { g.fillStyle = '#d8c8a0'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#a07858'; g.fillRect(0, 40, 48, 24); g.fillStyle = '#c03050'; g.fillRect(16, 28, 16, 26); g.fillStyle = '#e8b890'; g.fillRect(19, 16, 10, 12); g.fillStyle = '#3a2418'; g.fillRect(16, 10, 16, 8); g.fillStyle = '#5a2a4a'; g.fillRect(2, 56, 44, 6); g.fillStyle = '#fff'; g.font = '5px sans-serif'; g.fillText('GRAND OPENING 74', 4, 61); }, { repeat: false });
  B.def('byoung', { kind: 'lambert', map: young }); framedPicture(B, THREE, 'byoung', 0.42, 0.56, cx, 2.6, -hd + 0.02, 0, BRASS);

  // --- left wall: cubbies of folded jeans and sweaters, a ladder
  const sx0 = -hw + 0.3;
  B.box('wood', 0xf4ece0, 0.06, 2.6, 4.8, -hw + 0.04, 1.3, -1.3, 0, { round: false });   // back panel, top, ends + uprights
  B.box('wood', 0xf4ece0, 0.5, 0.06, 4.86, sx0, 2.63, -1.3, 0, { round: false });
  for (let k = 0; k <= 6; k++) B.box('wood', 0xe8dccc, 0.5, 2.6, 0.04, sx0, 1.3, -3.7 + k * 0.8, 0, { round: false });
  for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) {
    const y = 0.25 + r * 0.5, z = -3.3 + k * 0.8;
    B.box('wood', 0xe0d4c4, 0.46, 0.03, 0.76, sx0 + 0.03, y - 0.05, z, 0, { ao: false, round: false });
    const base = r < 2 ? pick([0x2a3a6a, 0x3a4a7a, 0x4a5a8a, 0x2a2a3a]) : pick([0xc03050, 0xf0c040, 0x3aa060, 0xe8e0d0, 0x8a4a2a, 0x7a4ac0]);
    for (let f = 0; f < 3; f++) B.box('cloth', base, 0.36, 0.08, 0.5, sx0 + 0.06, y + f * 0.085, z + (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.08, { ao: false, round: false });
  }
  const jeans = signTex(THREE, 'bev:jeans', ['DENIM', 'all sizes. even yours.'], '#5a2a4a', '#f8e8c8', 128, 40, { font: 'sans-serif' }); B.def('bjeans', { kind: 'lambert', map: jeans });
  B.quad('bjeans', 0xffffff, 1.2, 0.38, sx0 + 0.26, 2.85, -1.3, PI / 2, { ao: false, tint: false });
  for (const e of [-1, 1]) B.box('wood', 0xa07848, 0.05, 2.7, 0.05, sx0 + 0.6, 1.35, 0.9 + e * 0.2, 0, { ao: false, rz: 0.12 });
  for (let k = 0; k < 6; k++) B.box('wood', 0xa07848, 0.05, 0.04, 0.4, sx0 + 0.6 - k * 0.055 + 0.15, 0.3 + k * 0.45, 0.9, 0, { ao: false, round: false });

  // --- fitting rooms at the back left: two stalls with curtains on rings, a long mirror between
  const fx = -2.6, fz = -hd + 0.75;
  for (let k = 0; k < 2; k++) {
    const x = fx + (k - 0.5) * 1.5;
    B.quad('plain', 0xd8b8c4, 1.4, 2.4, x, 1.2, -hd + 0.02, 0, { ao: false });
    B.add(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 5).rotateZ(PI / 2), 'shiny', BRASS, x, 2.35, fz + 0.75, 0, { ao: false, tint: false });
    for (let f = 0; f < 7; f++) B.box('cloth', 0x7a2a5a, 0.2, 2.15, 0.05, x - 0.6 + f * 0.2, 1.25, fz + 0.75 + (f % 2 ? 0.04 : -0.04), (f % 2 ? 0.25 : -0.25), { round: false });
    B.cyl('wood', 0xa07848, 0.18, 0.18, 0.4, x - 0.3, 0.2, fz - 0.2, 10);
  }
  for (const x of [fx - 1.5, fx, fx + 1.5]) B.box('wood', 0xf4ece0, 0.08, 2.5, 1.5, x, 1.25, fz);
  const tag = signTex(THREE, 'bev:fit', ['FITTING ROOMS', 'limit 3 items. limit 1 cat.'], '#f4ece0', '#5a2a4a', 128, 32, { font: 'sans-serif' }); B.def('bfit', { kind: 'lambert', map: tag });
  B.quad('bfit', 0xffffff, 1.4, 0.35, fx, 2.8, -hd + 0.03, 0, { ao: false, tint: false });
  const mx = fx + 2.15;
  B.box('wood', BRASS, 0.7, 2.0, 0.06, mx, 1.15, -hd + 0.05, 0, { ao: false });
  B.def('bmirror', { kind: 'phong', shininess: 120, specular: 0xffffff });
  B.quad('bmirror', 0xa8b8c8, 0.6, 1.9, mx, 1.15, -hd + 0.09, 0, { ao: false, tint: false });

  // --- the floor: two round racks, a T-rack of jackets, a hat tree, a shoe table, a bargain bin, a rug
  const round = (x, z, cs) => {
    B.cyl('shiny', 0xc8ccd4, 0.3, 0.3, 0.04, x, 0.02, z, 10, { ao: false });
    B.cyl('shiny', 0xc8ccd4, 0.025, 0.025, 1.35, x, 0.7, z, 6, { ao: false });
    B.add(new THREE.TorusGeometry(0.62, 0.02, 4, 18).rotateX(PI / 2), 'shiny', 0xc8ccd4, x, 1.36, z, 0, { ao: false, tint: false });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * PI * 2, px = x + Math.sin(a) * 0.62, pz = z + Math.cos(a) * 0.62;
      B.box('cloth', cs[k % cs.length], 0.42, 0.68, 0.05, px, 0.98, pz, a + PI / 2, { round: false, ao: false });
      B.box('cloth', cs[k % cs.length], 0.5, 0.12, 0.06, px, 1.28, pz, a + PI / 2, { round: false, ao: false });
    }
  };
  round(-1.6, 0.6, [0xc03050, 0xe8a0c0, 0xf4ece0, 0xd04a4a]);
  round(1.3, 1.3, [0x3a6ad0, 0x3aa060, 0xf0c040, 0x2a3a6a]);
  const tx = 2.6, tz = -0.9;   // T-rack of jackets, facing the door
  B.add(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 5).rotateZ(PI / 2), 'shiny', 0xc8ccd4, tx, 1.6, tz, 0, { ao: false, tint: false });
  for (const e of [-1, 1]) { B.cyl('shiny', 0xc8ccd4, 0.02, 0.02, 1.6, tx + e * 0.88, 0.8, tz, 5, { ao: false }); B.box('shiny', 0xc8ccd4, 0.06, 0.04, 0.6, tx + e * 0.88, 0.03, tz, 0, { ao: false }); }
  for (let k = 0; k < 8; k++) B.box('cloth', [0x5a3a2a, 0x2a2a2a, 0x6a6a3a, 0x8a2a2a][k % 4], 0.07, 0.95, 0.5, tx - 0.75 + k * 0.21, 1.1, tz, 0, { round: false, ao: false });
  const hx = -4.4, hz = 2.0;   // hat tree
  B.cyl('wood', 0x6a4028, 0.03, 0.04, 1.9, hx, 0.95, hz, 6); B.cyl('wood', 0x6a4028, 0.25, 0.28, 0.04, hx, 0.02, hz, 10, { ao: false });
  [[0xf0e0c0, 1.5, 0], [0x2a2a2a, 1.7, 2.1], [0xc03050, 1.9, 4.2], [0x3a6a3a, 1.35, 3.1]].forEach(([c2, y, a]) => {
    const px = hx + Math.sin(a) * 0.17, pz = hz + Math.cos(a) * 0.17;
    B.cyl('plain', c2, 0.16, 0.16, 0.012, px, y, pz, 10, { ao: false }); B.cyl('plain', c2, 0.08, 0.09, 0.09, px, y + 0.05, pz, 10, { ao: false });
  });
  const shoe = (x, z, ry, c2) => { B.box('plain', c2, 0.1, 0.07, 0.24, x, 0.82, z, ry, { ao: false, round: false }); B.box('plain', c2, 0.09, 0.08, 0.08, x - Math.sin(ry) * 0.08, 0.88, z - Math.cos(ry) * 0.08, ry, { ao: false, round: false }); };
  B.box('wood', 0xf4ece0, 1.3, 0.05, 0.8, -1.0, 0.76, 3.0, 0, { ao: false }); for (const [lx, lz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) B.box('wood', 0xa07848, 0.05, 0.74, 0.05, -1.0 + lx, 0.37, 3.0 + lz, 0, { ao: false });
  for (let k = 0; k < 5; k++) shoe(-1.5 + k * 0.25, 3.0 + (k % 2 ? 0.15 : -0.15), 0.3 * (k - 2), pick([0x8a3a2a, 0x2a2a2a, 0xc03050, 0xf4ece0, 0x3a5a8a]));
  const sale = signTex(THREE, 'bev:sale', ['BARGAIN BIN', 'EVERYTHING $1'], '#c02040', '#fff4c0', 128, 48); B.def('bsale', { kind: 'lambert', map: sale });
  const bx = 4.3, bz = 1.8;
  B.box('wood', 0x8a5a38, 1.1, 0.6, 0.8, bx, 0.3, bz);
  for (let k = 0; k < 10; k++) B.sph('cloth', pick([0xc03050, 0xf0c040, 0x3aa060, 0x7a4ac0, 0xf4ece0, 0x3a6ad0]), 0.16, bx + (rnd() - 0.5) * 0.8, 0.62 + rnd() * 0.06, bz + (rnd() - 0.5) * 0.5, { ao: false, s: [1, 0.45, 1], ws: 6, hs: 4 });
  B.quad('bsale', 0xffffff, 0.8, 0.3, bx, 0.36, bz + 0.41, 0, { ao: false, tint: false });
  B.flat('cloth', 0xc890a8, 3.2, 2.2, 0, 0.012, 1.8, 0, { ao: false, tint: false });
  B.flat('cloth', 0xe8c8d4, 2.9, 1.9, 0, 0.016, 1.8, 0, { ao: false, tint: false });
  // a velvet chair for bored husbands, by the fitting rooms
  const vx = -4.5, vz = -2.3;
  B.box('cloth', 0x7a2a5a, 0.7, 0.4, 0.65, vx, 0.3, vz, PI / 2); B.box('cloth', 0x7a2a5a, 0.2, 0.7, 0.7, vx - 0.28, 0.75, vz, 0);
  for (const e of [-1, 1]) B.box('cloth', 0x8a3a6a, 0.6, 0.25, 0.14, vx, 0.6, vz + e * 0.3, 0);
  B.box('plain', 0xf4ece0, 0.28, 0.02, 0.2, vx + 0.1, 0.51, vz, 0.2, { ao: false, round: false });   // a magazine

  // --- ceiling: a little chandelier in the middle, globe pendants over the racks and till
  const chx = 0, chz = 0.4;
  B.cyl('shiny', BRASS, 0.01, 0.01, 0.6, chx, BH - 0.3, chz, 4, { ao: false });
  B.add(new THREE.TorusGeometry(0.32, 0.02, 4, 12).rotateX(PI / 2), 'shiny', BRASS, chx, BH - 0.65, chz, 0, { ao: false, tint: false });
  for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; B.sph('glow', 0xfff0d8, 0.05, chx + Math.sin(a) * 0.32, BH - 0.58, chz + Math.cos(a) * 0.32, { ao: false, tint: false, ws: 6, hs: 4 }); }
  for (let k = 0; k < 10; k++) B.box('glass', 0xffffff, 0.02, 0.1, 0.02, chx + Math.sin(k) * 0.22, BH - 0.75, chz + Math.cos(k) * 0.22, 0, { ao: false });
  for (const [lx, lz] of [[-1.6, 0.6], [1.3, 1.3], [cx, cz]]) { B.cyl('plain', 0x333333, 0.006, 0.006, 0.7, lx, BH - 0.35, lz, 4, { ao: false }); B.sph('glow', 0xfff4e0, 0.13, lx, BH - 0.78, lz, { ao: false, tint: false, ws: 8, hs: 6 }); }

  const group = B.finish(new THREE.Group());
  cols.push(
    { kind: 'box', cx, cz, w: CL, d: 0.75, rot: 0, h: 1.25 },                         // till counter
    { kind: 'box', cx: cx + 0.4, cz: cz - 0.75, w: 0.6, d: 0.4, rot: 0, h: 1.9 },     // Bev
    { kind: 'box', cx: sx0, cz: -1.3, w: 0.55, d: 4.8, rot: 0, h: 2.6 },              // cubbies
    { kind: 'box', cx: fx - 1.5, cz: fz, w: 0.12, d: 1.5, rot: 0, h: 2.5 },           // fitting room walls
    { kind: 'box', cx: fx, cz: fz, w: 0.12, d: 1.5, rot: 0, h: 2.5 },
    { kind: 'box', cx: fx + 1.5, cz: fz, w: 0.12, d: 1.5, rot: 0, h: 2.5 },
    { kind: 'box', cx: -1.6, cz: 0.6, w: 1.4, d: 1.4, rot: 0, h: 1.4 },               // round racks
    { kind: 'box', cx: 1.3, cz: 1.3, w: 1.4, d: 1.4, rot: 0, h: 1.4 },
    { kind: 'box', cx: tx, cz: tz, w: 1.9, d: 0.6, rot: 0, h: 1.6 },                  // T-rack
    { kind: 'box', cx: hx, cz: hz, w: 0.5, d: 0.5, rot: 0, h: 1.9 },                  // hat tree
    { kind: 'box', cx: -1.0, cz: 3.0, w: 1.3, d: 0.8, rot: 0, h: 0.8 },               // shoe table (standable)
    { kind: 'box', cx: bx, cz: bz, w: 1.1, d: 0.8, rot: 0, h: 0.65 },                 // bargain bin
    { kind: 'box', cx: vx, cz: vz, w: 0.7, d: 0.75, rot: 0, h: 1.1, top: 0.5 },       // velvet chair
    ...BEV_WINDOWS.map((x) => ({ kind: 'box', cx: x, cz: hd - 0.55, w: 3.4, d: 1.0, rot: 0, h: 0.5 })),   // window risers
  );
  return {
    group, size: [BW, BD], cols, floors: [],
    spawn: { x: 0, z: hd - 1.0, yaw: 0 },
    exit: { x: 0, z: hd + 0.05, r: 0.65 },
    lights: [
      { x: chx, y: BH - 0.7, z: chz, c: 0xfff0d8, i: 1.0, always: true },
      { x: -1.6, y: BH - 0.9, z: 0.6, c: 0xffe8f0, i: 0.6, always: true },
      { x: 1.3, y: BH - 0.9, z: 1.3, c: 0xffe8f0, i: 0.6, always: true },
      { x: cx, y: BH - 0.9, z: cz, c: 0xfff4e0, i: 0.7, always: true },
      { x: fx, y: BH - 0.5, z: fz + 1.2, c: 0xffd8e8, i: 0.5, always: true },
      { x: 0, y: 1.8, z: hd - 0.6, c: 0xe8f0ff, i: 0.5, always: true },   // daylight through the glass
    ],
    cam: { maxDist: 4.5, height: 2.4 },
    interact: [
      { id: 'till', x: cx, z: cz + 0.9, r: 0.9, label: 'Shop with Bev' },
      { id: 'fitting', x: fx, z: fz + 1.25, r: 0.9, label: 'Use a fitting room' },
      { id: 'mirror', x: mx, z: -hd + 0.75, r: 0.55, label: 'Look in the mirror' },
      { id: 'bin', x: bx, z: bz + 0.8, r: 0.7, label: 'Dig in the bargain bin ($1)' },
      { id: 'racks', x: -1.6, z: 1.6, r: 0.6, label: 'Hide in the clothes rack' },
      { id: 'chair', x: vx + 0.6, z: vz, r: 0.6, label: 'Sit in the velvet chair' },
      { id: 'hats', x: hx + 0.5, z: hz, r: 0.6, label: 'Try on a hat' },
    ],
  };
}

// ====================================================================== Hank's Hardware
const HW = 13.4, HD = 11.4, HH = 4.4;
const HANK_WINDOWS = [-4.4, 4.4];  // storeWin faces (y 1.65, 4.2 x 1.8)

function buildHank(ctx) {
  const { THREE, T } = ctx;
  const { ctex, grime, signTex, makeBuilder, shell, tubeLight, rnd, pick } = KIT;
  KIT.reseed(43);
  const B = makeBuilder(THREE, T);
  const GREEN = 0x2a6a3a, ORANGE = 0xe07020, STEEL = 0x8a9098;
  const conc = ctex(THREE, 'hk:floor', 64, 64, (g) => { g.fillStyle = '#a8a49c'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * 64, rnd() * 64, 2, 2); } g.fillStyle = '#8a867e'; g.fillRect(0, 63, 64, 1); g.fillRect(63, 0, 1, 64); g.fillStyle = 'rgba(80,60,40,0.18)'; g.beginPath(); g.ellipse(40, 22, 10, 6, 0.5, 0, 7); g.fill(); });
  const block = ctex(THREE, 'hk:wall', 64, 64, (g) => { g.fillStyle = '#e4e0d2'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c8c4b6'; for (let y = 0; y < 64; y += 16) { g.fillRect(0, y, 64, 1); for (let x = (y / 16) % 2 ? 16 : 0; x < 64; x += 32) g.fillRect(x, y, 1, 16); } grime(g, 64, 64, 100, 0.1); });
  const ceil = ctex(THREE, 'hk:ceil', 64, 64, (g) => { g.fillStyle = '#6a6e74'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#5a5e64'; for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 64); });
  B.def('hfloor', { kind: 'lambert', map: conc }); B.def('hwall', { kind: 'lambert', map: block }); B.def('hceil', { kind: 'lambert', map: ceil });
  const cols = shell(B, THREE, { w: HW, d: HD, h: HH, floorKey: 'hfloor', wallKey: 'hwall', ceilKey: 'hceil', ceilCol: 0xffffff, door: { x: 0, w: 2.4, h: 2.3 }, base: GREEN, frame: GREEN, wallTile: 1.6, floorTile: 2, crown: false });
  const hw = HW / 2, hd = HD / 2;
  // a green stripe round the walls, open-web joists and a duct under the deck
  for (const [x, z, len, ry] of [[0, -hd + 0.01, HW, 0], [-hw + 0.01, 0, HD, PI / 2], [hw - 0.01, 0, HD, -PI / 2]]) B.quad('plain', GREEN, len, 0.3, x, 2.85, z, ry, { ao: false, tint: false });
  for (let k = 0; k < 6; k++) B.box('metal', STEEL, 0.1, 0.3, HD, -5.6 + k * 2.24, HH - 0.2, 0, 0, { ao: false, round: false });
  B.cyl('metal', 0xb0b4ba, 0.3, 0.3, HD - 0.4, 2.0, HH - 0.6, 0, 10, { ao: false, rx: PI / 2 });

  // --- windows + double glass doors
  const street = ctex(THREE, 'hk:street', 64, 32, (g) => { const gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#5a8ac8'); gr.addColorStop(0.75, '#d8e4f0'); g.fillStyle = gr; g.fillRect(0, 0, 64, 32); g.fillStyle = '#4a4a50'; g.fillRect(0, 26, 64, 6); g.fillStyle = '#d8c8a8'; g.fillRect(8, 10, 18, 16); g.fillStyle = '#2a6a3a'; g.fillRect(42, 14, 10, 8); for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f0f0e0' : '#2a6a3a'; g.fillRect(k * 8, 0, 8, 3); } }, { repeat: false });
  B.def('hstreet', { kind: 'basic', map: street });
  for (const x of HANK_WINDOWS) {
    B.quad('hstreet', 0xffffff, 4.2, 1.8, x, 1.65, hd - 0.02, PI, { ao: false, tint: false });
    for (const y of [2.58, 0.72]) B.quad('plain', 0xf4f0e4, 4.3, 0.08, x, y, hd - 0.03, PI, { ao: false, tint: false });
    for (const e of [-1, 1]) B.quad('plain', 0xf4f0e4, 0.08, 1.9, x + e * 2.12, 1.65, hd - 0.03, PI, { ao: false, tint: false });
  }
  for (const e of [-1, 1]) { B.quad('hstreet', 0xb8c4cc, 1.1, 2.2, e * 0.6, 1.12, hd - 0.04, PI, { ao: false, tint: false }); B.quad('shiny', 0xc8ccd4, 0.06, 0.8, e * 0.12, 1.05, hd - 0.08, PI, { ao: false, tint: false }); }
  const welcome = signTex(THREE, 'hk:mat', ['WELCOME'], '#2a2a2a', '#d8c060', 96, 32); B.def('hmat', { kind: 'lambert', map: welcome });
  B.flat('hmat', 0xffffff, 1.8, 0.9, 0, 0.012, hd - 0.7, PI, { ao: false, tint: false });

  // --- checkout at the front left: counter with a register, a key cutter, the gum and batteries rack, Hank behind it
  const kx = -3.9, kz = 2.6, KL = 3.0;
  B.box('wood', 0x9a7a58, KL, 0.95, 0.8, kx, 0.475, kz); B.box('plain', 0x2a5a32, KL + 0.06, 0.05, 0.86, kx, 0.97, kz, 0, { ao: false });
  B.box('plain', 0xe0dcd0, 0.44, 0.26, 0.4, kx + 0.7, 1.12, kz, PI); B.box('plain', 0x333333, 0.38, 0.2, 0.05, kx + 0.7, 1.32, kz - 0.18, PI, { ao: false, round: false }); B.quad('glow', 0x80ff90, 0.3, 0.12, kx + 0.7, 1.32, kz - 0.21, PI, { ao: false, tint: false });
  B.box('shiny', 0xc8ccd4, 0.4, 0.3, 0.3, kx - 0.9, 1.15, kz); B.cyl('shiny', 0x8a8a8a, 0.06, 0.06, 0.05, kx - 0.9, 1.33, kz + 0.1, 10, { ao: false, rx: PI / 2 });   // key cutter
  for (let k = 0; k < 12; k++) B.box('shiny', pick([0xd8b050, 0xc8ccd4]), 0.03, 0.08, 0.01, kx - 1.35 + (k % 6) * 0.06, 1.45 - ((k / 6) | 0) * 0.12, kz - 0.38, 0, { ao: false, round: false });   // blank keys on a board
  B.box('plain', 0xf4f0e4, 0.45, 0.3, 0.02, kx - 1.2, 1.4, kz - 0.4, 0, { ao: false, round: false });
  B.box('metal', STEEL, 0.5, 0.5, 0.25, kx + 0.2, 1.25, kz + 0.25); for (let k = 0; k < 8; k++) B.box('plain', pick([0xf0c040, 0x2a2a2a, 0xd04020, 0x3a6ad0]), 0.08, 0.12, 0.04, kx + 0.04 + (k % 4) * 0.1, 1.15 + ((k / 4) | 0) * 0.2, kz + 0.39, 0, { ao: false, round: false });
  person(B, THREE, kx - 0.2, kz - 0.8, 0, { top: 0x8a3a2a, legs: 0x3a4a6a, hair: 0x8a8a8a, apron: ORANGE, cap: GREEN, beard: 0x9a9a9a });
  const hankTag = signTex(THREE, 'hk:tag', ['CHECKOUT', 'ask hank. he knows.'], '#2a6a3a', '#fff4c0', 128, 40, { font: 'sans-serif' }); B.def('htag', { kind: 'lambert', map: hankTag });
  B.box('plain', 0x1a1a1a, 0.012, 0.9, 0.012, kx, HH - 0.45, kz, 0, { ao: false, round: false }); B.quad('htag', 0xffffff, 1.2, 0.38, kx, HH - 1.05, kz, 0, { ao: false, tint: false });

  // --- three gondola aisles running front to back, with stock on both faces
  const AISLES = [{ x: -1.3, name: 'PAINT', cols: [0xd04020, 0x3a6ad0, 0xf0f0e8, 0xf0c040, 0x3aa060, 0x8a5a3a] }, { x: 1.7, name: 'HARDWARE', cols: [0xc8ccd4, 0xd8b050, 0x5a5e64, 0xe07020, 0x2a2a2a] }, { x: 4.7, name: 'GARDEN', cols: [0x3aa060, 0x8a5a2a, 0xf0c040, 0x2a6a3a, 0xd04020] }];
  const AZ0 = -3.4, AL = 4.8;
  for (const a of AISLES) {
    B.box('metal', 0xd8d8d0, 0.7, 2.2, AL, a.x, 1.1, AZ0, 0, { round: false });
    B.box('plain', GREEN, 0.75, 0.12, AL + 0.05, a.x, 0.06, AZ0, 0, { ao: false, round: false });
    for (let r = 0; r < 4; r++) for (const side of [-1, 1]) {
      const y = 0.3 + r * 0.5, fxs = a.x + side * 0.37;
      B.box('metal', 0xc8c8c0, 0.06, 0.03, AL, fxs, y - 0.02, AZ0, 0, { ao: false, round: false });
      for (let k = 0; k < 14; k++) {
        const z = AZ0 - AL / 2 + 0.2 + k * (AL - 0.4) / 13, col = pick(a.cols);
        if (a.name === 'PAINT') B.cyl('plain', col, 0.1, 0.1, 0.2, fxs + side * 0.02, y + 0.1, z, 8, { ao: false });
        else if (a.name === 'GARDEN' && r === 0) B.box('plain', 0x8a6a3a, 0.14, 0.34, 0.3, fxs + side * 0.04, y + 0.17, z, 0, { ao: false, round: false });
        else B.box('plain', col, 0.1 + rnd() * 0.06, 0.12 + rnd() * 0.22, 0.24, fxs + side * 0.03, y + 0.12, z, 0, { ao: false, round: false });
      }
    }
    const sign = signTex(THREE, 'hk:aisle:' + a.name, [a.name], '#2a6a3a', '#fff4c0', 128, 32); B.def('haisle' + a.name, { kind: 'lambert', map: sign, side: THREE.DoubleSide });
    B.box('plain', 0x1a1a1a, 0.012, HH - 3.2, 0.012, a.x, (HH + 3.2) / 2, AZ0 + AL / 2 - 0.3, 0, { ao: false, round: false });
    B.quad('haisle' + a.name, 0xffffff, 1.0, 0.3, a.x, 3.1, AZ0 + AL / 2 - 0.3, 0, { ao: false, tint: false });
    // end cap facing the door
    B.box('metal', 0xd8d8d0, 0.8, 1.4, 0.4, a.x, 0.7, AZ0 + AL / 2 + 0.2, 0, { round: false });
    for (let k = 0; k < 6; k++) B.box('plain', a.name === 'PAINT' ? 0xd8b050 : a.name === 'GARDEN' ? 0x3aa060 : ORANGE, 0.22, 0.3, 0.16, a.x - 0.25 + (k % 3) * 0.25, 1.55 + ((k / 3) | 0) * 0.32, AZ0 + AL / 2 + 0.2, 0, { ao: false, round: false });
  }
  // paint mixing counter at the back of the paint side, swatch wall above
  const swatch = ctex(THREE, 'hk:swatch', 128, 64, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { g.fillStyle = `hsl(${x * 22},${40 + y * 6}%,${30 + y * 8}%)`; g.fillRect(x * 8 + 1, y * 8 + 1, 6, 6); } }, { repeat: false });
  B.def('hswatch', { kind: 'lambert', map: swatch });
  B.quad('hswatch', 0xffffff, 3.0, 1.4, -2.8, 2.2, -hd + 0.03, 0, { ao: false, tint: false });
  B.box('wood', 0x9a7a58, 2.6, 0.95, 0.7, -2.8, 0.475, -hd + 0.45); B.box('plain', 0xf0ece0, 2.66, 0.05, 0.76, -2.8, 0.97, -hd + 0.45, 0, { ao: false });
  B.box('shiny', 0xc8ccd4, 0.5, 0.6, 0.45, -3.6, 1.3, -hd + 0.4); B.cyl('plain', 0xf0c040, 0.1, 0.1, 0.2, -3.6, 1.12, -hd + 0.55, 8, { ao: false });   // shaker
  for (let k = 0; k < 4; k++) B.cyl('plain', 0xf0f0e8, 0.12, 0.12, 0.26, -2.6 + k * 0.3, 1.13, -hd + 0.4, 8, { ao: false });
  for (let k = 0; k < 6; k++) B.quad('plain', [0xd04020, 0x3a6ad0, 0xf0c040, 0x3aa060, 0x8a4ac0, 0xf0f0e8][k], 0.25, 0.08, -3.6 + k * 0.34, 0.6 + (k % 2) * 0.12, -hd + 0.84, 0, { ao: false, tint: false });   // drips on the front
  const tint = signTex(THREE, 'hk:tint', ['PAINT MIXED', 'WHILE U WAIT'], '#f0ece0', '#c02020', 128, 40); B.def('htint', { kind: 'lambert', map: tint }); B.quad('htint', 0xffffff, 1.2, 0.38, -2.8, 3.2, -hd + 0.03, 0, { ao: false, tint: false });

  // --- right wall: pegboard of tools, hoses and a ladder rack
  const peg = ctex(THREE, 'hk:peg', 64, 64, (g) => { g.fillStyle = '#c8a878'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#6a5038'; for (let y = 4; y < 64; y += 8) for (let x = 4; x < 64; x += 8) g.fillRect(x, y, 2, 2); });
  B.def('hpeg', { kind: 'lambert', map: peg });
  B.quad('hpeg', 0xffffff, 6.0, 2.0, hw - 0.03, 1.6, -1.6, -PI / 2, { ao: false, tint: false, sx: 4, sy: 2, us: 3, vs: 1 });
  for (let k = 0; k < 9; k++) {   // hammers, wrenches, saws
    const z = -4.2 + k * 0.62, y = 2.0 - (k % 3) * 0.55;
    if (k % 3 === 0) { B.box('wood', 0xa07848, 0.03, 0.34, 0.04, hw - 0.08, y, z, 0, { ao: false, round: false }); B.box('metal', 0x3a3a3a, 0.05, 0.06, 0.14, hw - 0.08, y + 0.18, z, 0, { ao: false, round: false }); }
    else if (k % 3 === 1) { B.box('metal', 0xc8ccd4, 0.02, 0.3, 0.04, hw - 0.07, y, z, 0, { ao: false, round: false }); B.cyl('metal', 0xc8ccd4, 0.04, 0.04, 0.02, hw - 0.07, y + 0.16, z, 6, { ao: false, rz: PI / 2 }); }
    else { B.box('metal', 0xd8d8d8, 0.01, 0.14, 0.42, hw - 0.06, y, z, 0, { ao: false, round: false }); B.box('plain', ORANGE, 0.03, 0.12, 0.12, hw - 0.07, y + 0.02, z + 0.25, 0, { ao: false, round: false }); }
  }
  for (let k = 0; k < 3; k++) { const z = 2.0 + k * 0.9; B.add(new THREE.TorusGeometry(0.28, 0.06, 5, 12).rotateY(PI / 2), 'plain', [0x3aa060, 0xf0c040, 0x2a6a3a][k], hw - 0.12, 1.6, z, 0, { ao: false }); B.cyl('metal', STEEL, 0.015, 0.015, 0.14, hw - 0.07, 1.86, z, 5, { ao: false, rz: PI / 2 }); }
  // step ladders leaning against the wall at the back right
  for (let k = 0; k < 2; k++) {
    const z = -hd + 0.5 + k * 0.5;
    for (const e of [-1, 1]) B.box('plain', 0xd8d8d0, 0.06, 2.0, 0.06, hw - 0.5 + e * 0.22, 1.0, z, 0, { ao: false, round: false, rz: -0.08 });
    for (let s = 0; s < 5; s++) B.box('plain', 0xd8d8d0, 0.44, 0.04, 0.1, hw - 0.5 + 0.06 - s * 0.03, 0.3 + s * 0.38, z, 0, { ao: false, round: false });
  }

  // --- left wall: nail and bolt bins, the store cat's bed under the counter flap, a riding mower display by the front
  const binx = -hw + 0.4;
  B.box('wood', 0x8a6a48, 0.7, 1.0, 3.6, binx, 0.5, -1.8);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) {
    const z = -3.4 + k * 0.45, y = 0.3 + r * 0.32;
    B.box('plain', 0x6a5038, 0.04, 0.26, 0.42, binx + 0.33, y, z, 0, { ao: false, round: false });
    B.flat('plain', pick([0x9a9a9a, 0x7a7a7a, 0xb8a870, 0x5a5a5a]), 0.3, 0.38, binx + 0.15, 1.01, z, 0, { ao: false, tint: false });
  }
  const bins = signTex(THREE, 'hk:bins', ['NUTS BOLTS SCREWS', 'sold by the pound'], '#2a6a3a', '#fff4c0', 192, 40, { font: 'sans-serif' }); B.def('hbins', { kind: 'lambert', map: bins });
  B.quad('hbins', 0xffffff, 1.8, 0.38, -hw + 0.03, 1.6, -1.8, PI / 2, { ao: false, tint: false });
  const mx = -0.2, mz = 2.8;   // riding mower on a pallet, angled at the door
  B.box('wood', 0x9a7a58, 1.6, 0.12, 1.2, mx, 0.06, mz, 0.4);
  B.box('plain', 0x2a7a3a, 0.9, 0.4, 1.3, mx, 0.55, mz, 0.4); B.box('plain', 0x2a7a3a, 0.8, 0.3, 0.5, mx + Math.sin(0.4) * 0.45, 0.85, mz + Math.cos(0.4) * 0.45, 0.4);
  B.box('plain', 0xf0c040, 0.5, 0.35, 0.12, mx - Math.sin(0.4) * 0.35, 1.0, mz - Math.cos(0.4) * 0.35, 0.4);
  B.box('plain', 0xf0c040, 0.5, 0.1, 0.45, mx - Math.sin(0.4) * 0.2, 0.8, mz - Math.cos(0.4) * 0.2, 0.4);
  B.cyl('plain', 0x2a2a2a, 0.012, 0.012, 0.4, mx + Math.sin(0.4) * 0.2, 1.05, mz + Math.cos(0.4) * 0.2, 5, { ao: false, rx: -0.4 });
  B.add(new THREE.TorusGeometry(0.12, 0.02, 4, 10).rotateX(-1.0), 'plain', 0x2a2a2a, mx + Math.sin(0.4) * 0.15, 1.27, mz + Math.cos(0.4) * 0.12, 0.4, { ao: false, tint: false });
  for (const [lx, lz, r] of [[-0.45, -0.5, 0.2], [0.45, -0.5, 0.2], [-0.45, 0.45, 0.14], [0.45, 0.45, 0.14]]) {
    const c = Math.cos(0.4), s = Math.sin(0.4), px = mx + lx * c + lz * s, pz = mz - lx * s + lz * c;
    B.add(new THREE.CylinderGeometry(r, r, 0.14, 10).rotateZ(PI / 2), 'plain', 0x1a1a1a, px, 0.12 + r, pz, 0.4, { ao: false });
  }
  const mtag = signTex(THREE, 'hk:mow', ['$1,899', 'do NOT', 'sit on it'], '#fff8c0', '#c02020', 64, 56, { font: 'sans-serif' }); B.def('hmow', { kind: 'lambert', map: mtag });
  B.quad('hmow', 0xffffff, 0.34, 0.3, mx - 0.85, 0.75, mz + 0.3, 0.4 + PI / 2 + PI, { ao: false, tint: false });
  // seed packet spinner and a bucket of yardsticks by the door
  B.cyl('metal', STEEL, 0.03, 0.03, 1.5, 3.1, 0.75, 3.6, 5, { ao: false });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; B.box('plain', pick([0x3aa060, 0xf0c040, 0xd04020, 0xe8a0c0, 0x8a4ac0]), 0.12, 0.17, 0.01, 3.1 + Math.sin(a) * 0.17, 0.55 + r * 0.25, 3.6 + Math.cos(a) * 0.17, a, { ao: false, round: false }); }
  B.cyl('plain', ORANGE, 0.18, 0.15, 0.4, 2.2, 0.2, 4.4, 10);
  for (let k = 0; k < 7; k++) B.box('wood', 0xe8c890, 0.03, 1.0, 0.015, 2.2 + (rnd() - 0.5) * 0.18, 0.75, 4.4 + (rnd() - 0.5) * 0.18, rnd() * 3, { ao: false, round: false, rz: (rnd() - 0.5) * 0.2 });
  // the yard door on the left (east) wall, the same spot as the outside side door
  B.quad('plain', 0xe0e0e0, 1.2, 2.3, -hw + 0.03, 1.15, 2.5, PI / 2, { ao: false, tint: false });
  B.quad('shiny', 0xc8ccd4, 0.08, 0.5, -hw + 0.06, 1.05, 2.0, PI / 2, { ao: false, tint: false });
  const yard = signTex(THREE, 'hk:yard', ['<- LUMBER YARD'], '#2a6a3a', '#fff4c0', 128, 28); B.def('hyard', { kind: 'lambert', map: yard });
  B.quad('hyard', 0xffffff, 1.2, 0.26, -hw + 0.04, 2.5, 2.5, PI / 2, { ao: false, tint: false });

  // --- lights: four long fluorescent strips under the joists
  for (const x of [-4.0, -0.2, 3.2]) for (const z of [-3.0, 1.6]) { B.cyl('plain', 0x333333, 0.006, 0.006, 0.6, x, HH - 0.6, z, 4, { ao: false }); tubeLight(B, x, HH - 0.95, z, 2.2, PI / 2); }

  const group = B.finish(new THREE.Group());
  cols.push(
    { kind: 'box', cx: kx, cz: kz, w: KL, d: 0.85, rot: 0, h: 1.0 },                        // checkout
    { kind: 'box', cx: kx - 0.2, cz: kz - 0.8, w: 0.6, d: 0.4, rot: 0, h: 1.9 },            // Hank
    ...AISLES.map((a) => ({ kind: 'box', cx: a.x, cz: AZ0 + 0.2, w: 0.85, d: AL + 0.4, rot: 0, h: 2.2 })),
    { kind: 'box', cx: -2.8, cz: -hd + 0.45, w: 2.6, d: 0.75, rot: 0, h: 1.0 },             // paint counter
    { kind: 'box', cx: hw - 0.5, cz: -hd + 0.75, w: 0.6, d: 1.1, rot: 0, h: 2.0 },          // ladders
    { kind: 'box', cx: binx, cz: -1.8, w: 0.7, d: 3.6, rot: 0, h: 1.0 },                    // bolt bins (standable)
    { kind: 'box', cx: mx, cz: mz, w: 1.5, d: 1.5, rot: 0.4, h: 1.0 },                      // mower
    { kind: 'box', cx: 3.1, cz: 3.6, w: 0.45, d: 0.45, rot: 0, h: 1.5 },                    // seed spinner
    { kind: 'box', cx: 2.2, cz: 4.4, w: 0.4, d: 0.4, rot: 0, h: 1.2 },                      // yardsticks
  );
  return {
    group, size: [HW, HD], cols, floors: [],
    spawn: { x: 0, z: hd - 1.2, yaw: 0 },
    exit: { x: 0, z: hd + 0.05, r: 0.9 },
    lights: [
      { x: -4.0, y: HH - 1.1, z: -3.0, c: 0xf4f8ff, i: 0.9, always: true },
      { x: -0.2, y: HH - 1.1, z: -3.0, c: 0xf4f8ff, i: 0.9, always: true },
      { x: 3.2, y: HH - 1.1, z: -3.0, c: 0xf4f8ff, i: 0.9, always: true },
      { x: -4.0, y: HH - 1.1, z: 1.6, c: 0xf4f8ff, i: 0.9, always: true },
      { x: 1.5, y: HH - 1.1, z: 1.6, c: 0xf4f8ff, i: 0.9, always: true },
      { x: 0, y: 1.8, z: hd - 0.6, c: 0xe8f0ff, i: 0.5, always: true },
    ],
    cam: { maxDist: 5, height: 2.6 },
    interact: [
      { id: 'till', x: kx + 0.3, z: kz + 0.95, r: 0.9, label: 'Shop with Hank' },
      { id: 'mower', x: mx - 0.9, z: mz + 0.9, r: 0.7, label: 'Sit on the mower' },
      { id: 'paint', x: -2.8, z: -hd + 1.3, r: 0.8, label: 'Watch the paint shaker' },
      { id: 'bins', x: binx + 0.8, z: -1.8, r: 0.8, label: 'Paw through the bolt bins' },
      { id: 'yard', x: -hw + 0.6, z: 2.5, r: 0.6, label: 'Yard door' },
      { id: 'key', x: kx - 0.9, z: kz + 0.95, r: 0.55, label: 'Get a key cut ($2)' },
    ],
  };
}

// ====================================================================== menus + flavour
const MENUS = {
  bev: {
    title: "Bev's Threads", who: 'Bev',
    items: [
      { id: 'socks', label: 'Novelty socks', price: 3, hp: 0, blurb: 'Fish print. Bev says they are "very you".' },
      { id: 'scarf', label: 'Hand-knit scarf', price: 8, hp: 10, blurb: 'Bev knits these between customers. There are a lot of scarves.' },
      { id: 'cap', label: 'Maple Grove ball cap', price: 10, hp: 0, blurb: 'Embroidered maple leaf. Fits a cat with the ear holes cut out.' },
      { id: 'vest', label: 'Hi-vis work vest', price: 15, hp: 15, blurb: 'Bright orange. For the overworked blue-collar professional.' },
      { id: 'sweater', label: 'Ugly holiday sweater', price: 20, hp: 25, blurb: 'Reindeer, tinsel, a little bell. It is warm. It is so warm.' },
    ],
    lines: {
      socks: 'Bev rings up the socks. "Two pair. You have four feet, honey."',
      scarf: 'Bev wraps the scarf round your neck twice. You look like a burrito. A cozy one.',
      cap: 'Bev snips two ear holes in the cap with pinking shears. Perfect fit.',
      vest: 'Bev: "Safety first." You are now visible from space.',
      sweater: 'Bev: "That one has been here since 1991. It was waiting for you."',
    },
    broke: (p) => `Bev: "That's $${p}, sweetie. I don't take mice."`,
  },
  hank: {
    title: "Hank's Hardware", who: 'Hank',
    items: [
      { id: 'tape', label: 'Duct tape', price: 4, hp: 0, blurb: 'Fixes everything. Hank has fixed his truck with it four times.' },
      { id: 'gloves', label: 'Leather work gloves', price: 7, hp: 10, blurb: 'Cat sized, somehow. Hank does not ask questions.' },
      { id: 'flash', label: 'Flashlight', price: 9, hp: 0, blurb: 'For the woods at night. Hank strongly suggests not going in the woods at night.' },
      { id: 'jerky', label: 'Beef jerky (checkout)', price: 3, hp: 15, blurb: 'From the jar by the register. It is mostly salt.' },
      { id: 'paint', label: 'Gallon of paint', price: 25, hp: 0, blurb: 'HOA-approved Beige No. 4. Gary will hate that you bought it anyway.' },
    ],
    lines: {
      tape: 'Hank: "Silver or the camo one?" You pick silver. Classic.',
      gloves: 'You put the gloves on all four paws. Hank says nothing for a long time.',
      flash: 'Hank tests the flashlight in your face. "Works."',
      jerky: 'Jerky. You chew it for eleven minutes. +15 health.',
      paint: 'Hank shakes it in the machine. You watch the whole thing. It is the best show in town.',
    },
    broke: (p) => `Hank: "That's $${p}. We don't run tabs since the raccoon incident."`,
  },
};
const FLAVOR = {
  bev: {
    fitting: ['You go into the fitting room alone and come out four minutes later in a sock. Bev applauds.', 'The curtain does not reach the floor. Everyone can see your little feet.'],
    mirror: ['You stare at yourself in the long mirror. A handsome working cat stares back. He looks tired.', 'You slow blink at the mirror. The mirror slow blinks back. Respect.'],
    racks: ['You push into the middle of the round rack. It is dark and warm and smells like new cotton. You live here now.', 'Bev, from the till: "I know you are in the rack."'],
    chair: ['You sit in the velvet chair for bored husbands. You are now bored. It works.', 'The chair has a magazine from 2009 on it. "Ten Ways To Spice Up Your Shed."'],
    hats: ['You try on the straw hat. It covers your whole body. Bev: "Maybe a child size."', 'You knock the red hat off the tree and sit in it. That is how you wear it now.'],
  },
  hank: {
    mower: ['You hop on the mower. Hank, without looking up: "Sign says no." You stay on it a little longer.', 'Vroom vroom. It is not on. You do the sound yourself.'],
    paint: ['The shaker rattles a can of Beige No. 4. You are hypnotized.', 'Hank: "Folks come in just to watch that thing. Can\'t blame them."'],
    bins: ['You scoop a paw full of screws out of the bin. They go everywhere. Hank sighs and grabs a broom.', 'Nuts, bolts, washers. You sort them by how much they rattle.'],
    yard: ['Locked from this side. Hank: "Yard\'s through the gate out front, bud."'],
  },
};
let A = null;
const S = { bought: {}, spent: 0, greeted: {} };

export function buy(shop, id) {
  if (!A) return false;
  const M = MENUS[shop]; const it = M && M.items.find((m) => m.id === id); if (!it) return false;
  if ((A.G.cash || 0) < it.price) { A.Sfx.blip && A.Sfx.blip(180); A.toast(M.broke(it.price), 3.5); return false; }
  A.addCash(-it.price); S.bought[shop + ':' + id] = (S.bought[shop + ':' + id] || 0) + 1; S.spent += it.price;
  if (it.hp) A.G.hp = Math.min(100, (A.G.hp || 0) + it.hp);
  A.Sfx.pickup && A.Sfx.pickup();
  A.toast(`${M.lines[id]}${it.hp && !/health/.test(M.lines[id]) ? ` +${it.hp} health.` : ''} -$${it.price}`, 4);
  return true;
}
function openMenu(shop) {
  const M = MENUS[shop];
  if (!A.fishing || !A.fishing.menu) return false;
  return A.fishing.menu({
    title: M.title,
    items: () => M.items.map((m) => ({ id: m.id, label: m.label, price: '$' + m.price, blurb: m.blurb + (m.hp ? ` (+${m.hp} health)` : ''), dim: (A.G.cash || 0) < m.price })),
    pick: (it) => buy(shop, it.id),
  });
}
function paid(price, ok, broke) {
  if ((A.G.cash || 0) < price) { A.Sfx.blip && A.Sfx.blip(180); A.toast(broke, 3.5); return; }
  A.addCash(-price); A.Sfx.pickup && A.Sfx.pickup(); A.toast(ok + ` -$${price}`, 3.8);
}
const say = (shop, k) => { const l = FLAVOR[shop][k]; A.toast(l[(Math.random() * l.length) | 0], 3.8); };

function entriesFor(p, d, doorX, windows, z0) {
  // storefront frame yaw PI: local +z (the facade) faces world -z, local +x is world -x. The place point sits 1.97 m out.
  const yaw = PI, ox = Math.sin(yaw), oz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
  const back = p.dz ?? 1.97;
  const door = { x: p.x - ox * back + lx * doorX, z: p.z - oz * back + lz * doorX };
  const at = (dx) => ({ x: door.x + lx * dx, z: door.z + lz * dx });
  return [{ ...door, yaw, kind: 'door' }, ...windows.map((wx) => ({ ...at(wx - doorX), yaw, kind: 'window', inside: { x: wx, z: d / 2 - z0, yaw: 0 } }))];
}

/** Call once after the interiors and the fishing menu exist. a = { G, places, fishing, toast, addCash, Sfx } */
export function init(a) {
  A = a;
  const out = {};
  const bev = a.places && a.places.clothing, hank = a.places && a.places.hardware;
  if (bev && Number.isFinite(bev.x)) {
    out.bev = entriesFor(bev, BD, 0, BEV_WINDOWS, 1.3);
    INTR.registerRoom('clothing', { name: "Bev's Threads", build: buildBev }, out.bev);
  } else console.warn('[stores] places.clothing missing');
  if (hank && Number.isFinite(hank.x)) {
    out.hank = entriesFor(hank, HD, 0, HANK_WINDOWS, 1.0);
    INTR.registerRoom('hardware', { name: "Hank's Hardware", build: buildHank }, out.hank);
  } else console.warn('[stores] places.hardware missing');
  INTR.on('interact', (room, spot) => {
    const shop = room === 'clothing' ? 'bev' : room === 'hardware' ? 'hank' : null;
    if (!shop) return false;
    if (spot === 'till') {
      if (!openMenu(shop)) return false;
      if (!S.greeted[shop]) { S.greeted[shop] = true; A.toast(shop === 'bev' ? 'Bev, over her glasses: "Well look at you. Let\'s get you something nice."' : 'Hank: "Help ya find something? Don\'t touch the mower."', 4); }
      return true;
    }
    if (spot === 'bin') { paid(1, ['You dig out a single mitten. It fits.', 'You dig out a bow tie. You are fancy now.', 'You dig out a tiny sombrero. Bev: "That was a doll\'s."'][(Math.random() * 3) | 0], 'The bin is $1 a dig. You have no dollars. You dig anyway, for free, and Bev lets it slide once.'); return true; }
    if (spot === 'key') { paid(2, 'Hank cuts you a key. It does not open anything you own. "Spare," he says.', 'Hank: "Two bucks for a key, bud."'); return true; }
    if (FLAVOR[shop][spot]) { say(shop, spot); return true; }
    return false;
  });
  window.__G && (window.__G.stores = { S, buy, MENUS, entries: out });
  return true;
}
