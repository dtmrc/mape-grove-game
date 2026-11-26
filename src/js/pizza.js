// Pizza City interior (diet 2026-11-26: "i also should be able to enter the pizza shop"). Self-contained: the room set,
// its door + window entries (derived from places.pizza, world.js buildDowntown), and the order counter (cash menu in the
// fishing shop's look, like the Quik Stop). Registered with interiors.registerRoom, so interiors.js / rooms.js are untouched
// apart from rooms.js exporting its builder KIT.
// Wired in game.js: PIZZA.init({ G, places, fishing, toast, addCash, Sfx }) after the shops.
// Debug: window.__G.pizza.buy('cheese'), .S
import * as INTR from './interiors.js';
import { KIT } from './rooms.js';
import { HUNGER_ENABLED } from './fishing.js';

const W = 10, D = 8, H = 3.2;
const DOOR_X = 1;                       // the outdoor door face sits at frame-local (1, 4.03); room x == building x
const WINDOWS = [-3.3, -1.1, 3];        // storeWin faces on the same front wall (y 1.5, 1.9 x 1.7)

function buildPizza(ctx) {
  const { THREE, T } = ctx;
  const { ctex, grime, signTex, makeBuilder, shell, framedPicture, tubeLight, rnd, pick } = KIT;
  KIT.reseed(91);
  const B = makeBuilder(THREE, T);
  const RED = 0xd02a2a, GREEN = 0x2a7a3a, CREAM = 0xfff4d0;
  const tile = ctex(THREE, 'pz:tile', 64, 64, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#b8262a' : '#f4ece0'; g.fillRect(x * 32, y * 32, 32, 32); }
    grime(g, 64, 64, 260, 0.2); g.fillStyle = 'rgba(200,140,40,0.25)'; g.beginPath(); g.ellipse(20, 46, 8, 5, 0.3, 0, 7); g.fill();   // old soda spill
  });
  const wall = ctex(THREE, 'pz:wall', 64, 64, (g) => {
    g.fillStyle = '#f6e8c8'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ecdab4'; for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 64; x += 16) g.fillRect(x, y, 15, 15);   // faint painted brick
    grime(g, 64, 64, 90, 0.1);
  });
  const ceil = ctex(THREE, 'pz:ceil', 64, 64, (g) => { g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#a09888'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } g.fillStyle = 'rgba(150,100,40,0.35)'; g.beginPath(); g.arc(46, 18, 9, 0, 7); g.fill(); });
  B.def('ptile', { kind: 'lambert', map: tile }); B.def('pwall', { kind: 'lambert', map: wall }); B.def('pceil', { kind: 'lambert', map: ceil });
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'ptile', wallKey: 'pwall', ceilKey: 'pceil', ceilCol: 0xffffff, door: { x: DOOR_X, w: 1.1, h: 2.1 }, base: GREEN, frame: GREEN, wallTile: 1.6, floorTile: 1, trim: { c: GREEN, y: 1.1, h: 0.12 } });
  // green wainscot below the trim
  for (const [cx, cz, len, ry] of [[0, -D / 2 + 0.01, W, 0], [-W / 2 + 0.01, 0, D, Math.PI / 2], [W / 2 - 0.01, 0, D, -Math.PI / 2]]) B.quad('plain', 0x3a8a4a, len, 1.0, cx, 0.6, cz, ry, { ao: false, tint: false, paint: (_x, y) => 0.7 + 0.3 * (y / 1.1) });

  // --- store windows (match the outside), dusk street outside, striped awning edge visible at the top
  const street = ctex(THREE, 'pz:street', 64, 32, (g) => { const gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#2a3a6a'); gr.addColorStop(0.7, '#e08a50'); g.fillStyle = gr; g.fillRect(0, 0, 64, 32); g.fillStyle = '#3a3a40'; g.fillRect(0, 26, 64, 6); g.fillStyle = '#20242c'; g.fillRect(6, 14, 10, 12); g.fillRect(40, 10, 16, 16); g.fillStyle = '#f0d060'; g.fillRect(44, 14, 3, 3); g.fillRect(50, 14, 3, 3); for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f4f4f0' : '#d02a2a'; g.fillRect(k * 8, 0, 8, 3); } }, { repeat: false });
  B.def('street', { kind: 'basic', map: street });
  for (const x of WINDOWS) {
    B.quad('street', 0xffffff, 1.9, 1.7, x, 1.5, D / 2 - 0.02, Math.PI, { ao: false, tint: false });
    for (const y of [2.37, 0.63]) B.quad('plain', GREEN, 2.0, 0.07, x, y, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
    for (const e of [-1, 1]) B.quad('plain', GREEN, 0.07, 1.8, x + e * 0.98, 1.5, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
  }
  const open = signTex(THREE, 'pz:open', ['OPEN'], null, '#ff5040', 96, 32, { glow: true });
  B.def('open', { kind: 'basic', map: open, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }); B.quad('open', 0xffffff, 0.8, 0.27, 3, 1.9, D / 2 - 0.1, Math.PI, { ao: false, tint: false });
  const deal = signTex(THREE, 'pz:deal', ['TUESDAY', '2-4-1', 'SLICES'], '#fff8c0', '#d02a2a', 96, 80, { tape: true });
  B.def('deal', { kind: 'lambert', map: deal }); B.quad('deal', 0xffffff, 0.42, 0.35, -3.8, 1.75, D / 2 - 0.05, Math.PI, { ao: false, tint: false });
  // door: green frame, glass, brass push bar, a bell on a spring above it
  B.quad('street', 0xc0c8d0, 1.0, 2.0, DOOR_X, 1.05, D / 2 - 0.05, Math.PI, { ao: false, tint: false });
  B.quad('shiny', 0xd8b050, 0.9, 0.06, DOOR_X, 1.0, D / 2 - 0.1, Math.PI, { ao: false, tint: false });
  B.sph('shiny', 0xd8b050, 0.06, DOOR_X + 0.4, 2.2, D / 2 - 0.12, { ao: false });

  // --- the counter across the room: slice warmer, register, shakers, tip jar, bell
  const cz = -1.4, cx0 = -0.8, CL = 7.6;
  B.box('plain', RED, CL, 0.85, 0.7, cx0, 0.5, cz); B.box('plain', 0x8a1a1a, CL, 0.15, 0.7, cx0, 0.075, cz, 0, { ao: false });
  B.box('shiny', 0xf4f0e8, CL + 0.1, 0.06, 0.8, cx0, 0.96, cz, 0, { ao: false });
  for (let k = 0; k < 8; k++) B.quad('plain', k % 2 ? 0xf4f4f0 : RED, CL / 8, 0.25, cx0 - CL / 2 + CL / 16 + k * CL / 8, 0.75, cz + 0.36, 0, { ao: false, tint: false });   // striped counter front
  const gx = -2.6;   // slice warmer: glass box with three pies on two decks, orange heat lamp glow
  B.box('glass', 0xfff0d8, 1.4, 0.55, 0.6, gx, 1.27, cz); B.box('shiny', 0xc8ccd4, 1.42, 0.04, 0.62, gx, 1.56, cz, 0, { ao: false }); B.box('shiny', 0xc8ccd4, 1.42, 0.03, 0.62, gx, 1.0, cz, 0, { ao: false });
  B.quad('glow', 0xff9a40, 1.3, 0.05, gx, 1.52, cz + 0.29, 0, { ao: false, tint: false });
  const pie = (x, y, z, r, kind, left = 1) => {
    const th = Math.PI * 2 * left;
    B.add(new THREE.CylinderGeometry(r, r, 0.025, 14, 1, false, 0, th), 'plain', kind === 'cheese' ? 0xf0c040 : 0xe8b038, x, y + 0.012, z, 0, { ao: false, tint: false });
    B.add(new THREE.TorusGeometry(r, 0.02, 4, 14, th), 'plain', 0xc88a40, x, y + 0.02, z, 0, { ao: false, tint: false, rx: Math.PI / 2, rz: 0 });
    if (kind !== 'cheese') for (let k = 0; k < 9; k++) { const a = rnd() * th, rr = 0.04 + rnd() * (r - 0.07); B.cyl('plain', kind === 'anchovy' ? 0x8a9aa0 : 0xb02a20, 0.022, 0.022, 0.008, x + Math.sin(a) * rr, y + 0.03, z + Math.cos(a) * rr, 7, { ao: false, tint: false, s: kind === 'anchovy' ? [2, 1, 0.5] : [1, 1, 1] }); }
  };
  pie(gx - 0.35, 1.03, cz, 0.24, 'pepperoni', 0.75); pie(gx + 0.35, 1.03, cz, 0.24, 'cheese', 0.625); pie(gx, 1.31, cz, 0.24, 'anchovy', 0.5);
  const tags = signTex(THREE, 'pz:tags', ['PEPP   CHEESE   ANCHOVY'], '#fff', '#d02a2a', 192, 24, { font: 'sans-serif' });
  B.def('ptags', { kind: 'lambert', map: tags }); B.quad('ptags', 0xffffff, 1.3, 0.12, gx, 0.92, cz + 0.36, 0, { ao: false, tint: false });
  const rx0 = 0.9;   // register right in front of the door path
  B.box('plain', 0xe8e4d8, 0.44, 0.26, 0.42, rx0, 1.12, cz - 0.05, -0.1); B.box('plain', 0x333333, 0.38, 0.22, 0.06, rx0, 1.34, cz - 0.24, -0.1); B.quad('glow', 0x80ff90, 0.32, 0.14, rx0 - 0.02, 1.34, cz - 0.2, -0.1, { ao: false, tint: false });
  B.cyl('shiny', 0xd8b050, 0.05, 0.06, 0.05, rx0 + 0.45, 1.015, cz + 0.2, 10, { ao: false }); B.sph('shiny', 0xd8b050, 0.012, rx0 + 0.45, 1.05, cz + 0.2, { ao: false });   // service bell
  B.cyl('glass', 0xffffff, 0.08, 0.07, 0.18, rx0 - 0.5, 1.08, cz + 0.15, 10, { ao: false }); for (let k = 0; k < 6; k++) B.box('plain', 0x6aa060, 0.08, 0.004, 0.04, rx0 - 0.5 + (rnd() - 0.5) * 0.08, 1.0 + rnd() * 0.12, cz + 0.15 + (rnd() - 0.5) * 0.08, rnd() * 3, { ao: false, tint: false });   // tip jar
  for (let k = 0; k < 4; k++) { const sx = 1.8 + k * 0.16; B.cyl('glass', 0xffffff, 0.035, 0.035, 0.12, sx, 1.05, cz + 0.2, 8, { ao: false }); B.cyl('shiny', 0xc8ccd4, 0.036, 0.03, 0.04, sx, 1.13, cz + 0.2, 8, { ao: false }); B.cyl('plain', k % 2 ? 0xc02a20 : 0xf0ece0, 0.03, 0.03, 0.07, sx, 1.02, cz + 0.2, 8, { ao: false, tint: false }); }   // parmesan + pepper flakes
  B.box('shiny', 0xc8ccd4, 0.16, 0.14, 0.1, 2.6, 1.06, cz + 0.1, 0, { ao: false });   // napkins
  const tipT = signTex(THREE, 'pz:tip', ['TIPS', 'feed the', 'pizza guy'], '#fff', '#222', 64, 48, { font: 'sans-serif' }); B.def('ptip', { kind: 'lambert', map: tipT }); B.quad('ptip', 0xffffff, 0.15, 0.11, rx0 - 0.5, 1.07, cz + 0.235, 0, { ao: false, tint: false });

  // --- behind the counter: brick oven with a fire mouth, prep table, box tower, drinks fridge, menu board
  const brick = ctex(THREE, 'pz:brick', 64, 64, (g) => { g.fillStyle = '#6a3020'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < 64; x += 16) { g.fillStyle = pick(['#a84a30', '#b85838', '#984028', '#a85034']); g.fillRect(x + 1, y + 1, 14, 6); } grime(g, 64, 64, 120, 0.25); });
  B.def('pbrick', { kind: 'lambert', map: brick });
  const ox = -2.8, oz = -D / 2 + 0.6;
  B.box('pbrick', 0xffffff, 2.2, 1.9, 1.1, ox, 0.95, oz);
  B.add(new THREE.SphereGeometry(1.0, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'pbrick', 0xffffff, ox, 1.9, oz, 0, { s: [1.05, 0.55, 0.52] });
  B.box('pbrick', 0xd8d0c0, 0.5, H - 2.4, 0.5, ox, 2.4 + (H - 2.4) / 2, oz - 0.2);   // flue
  B.quad('glow', 0x1a0a04, 0.9, 0.55, ox, 1.1, oz + 0.56, 0, { ao: false, tint: false });
  B.quad('glow', 0xff7a20, 0.8, 0.22, ox, 0.93, oz + 0.565, 0, { ao: false, tint: false }); B.quad('glow', 0xffc040, 0.45, 0.12, ox - 0.1, 0.9, oz + 0.57, 0, { ao: false, tint: false });
  B.box('plain', 0x3a2a20, 1.1, 0.08, 0.2, ox, 0.82, oz + 0.62, 0, { ao: false });   // hearth lip
  B.box('wood', 0xc8a070, 0.35, 0.02, 0.35, ox + 1.2, 1.0, oz + 0.9, 0, { ao: false, rz: 1.25 }); B.cyl('wood', 0xa07848, 0.02, 0.02, 1.3, ox + 1.35, 0.55, oz + 0.9, 5, { ao: false, rz: 1.25 });   // pizza peel leaning on the oven
  const px0 = 0.6, pz0 = -D / 2 + 0.4;
  B.box('shiny', 0xc8ccd4, 1.8, 0.06, 0.7, px0, 0.9, pz0, 0, { ao: false }); for (const [lx, lz] of [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]]) B.box('shiny', 0xb0b4bc, 0.05, 0.88, 0.05, px0 + lx, 0.44, pz0 + lz, 0, { ao: false });
  B.box('shiny', 0xb0b4bc, 1.7, 0.03, 0.6, px0, 0.25, pz0, 0, { ao: false });
  for (let k = 0; k < 5; k++) B.sph('plain', 0xf4ecd8, 0.08, px0 - 0.6 + k * 0.22, 0.97, pz0 + 0.1, { ao: false, tint: false, s: [1, 0.6, 1] });   // dough balls
  for (const [bx, n] of [[px0 + 0.5, 3], [px0 + 0.1, 1]]) for (let k = 0; k < n; k++) { B.cyl('plain', 0xb02a20, 0.08, 0.08, 0.06, bx, 0.96 + k * 0.07, pz0 - 0.15, 8, { ao: false, tint: false }); }   // sauce tubs
  for (let k = 0; k < 7; k++) B.box('plain', 0xf0ece0, 0.55, 0.06, 0.55, 2.2 + (rnd() - 0.5) * 0.04, 0.03 + k * 0.065, -D / 2 + 0.4, (rnd() - 0.5) * 0.15, { ao: false, tint: false });   // pizza box tower
  const boxT = signTex(THREE, 'pz:box', ['PIZZA CITY'], '#f0ece0', '#d02a2a', 96, 24); B.def('pbox', { kind: 'lambert', map: boxT }); B.flat('pbox', 0xffffff, 0.5, 0.2, 2.2, 0.47, -D / 2 + 0.4, 0, { ao: false, tint: false });
  B.box('plain', 0xe8e8e8, 1.1, 2.0, 0.75, 4.3, 1.0, -D / 2 + 0.42);   // drinks fridge
  const fridge = ctex(THREE, 'pz:fridge', 32, 64, (g) => { g.fillStyle = '#dff4ff'; g.fillRect(0, 0, 32, 64); for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { g.fillStyle = pick(['#d02a2a', '#2a60c0', '#30a040', '#f0a020']); g.fillRect(2 + i * 7.5, 4 + r * 15, 6, 11); } }, { repeat: false });
  B.def('pfridge', { kind: 'basic', map: fridge }); B.quad('pfridge', 0xffffff, 0.95, 1.7, 4.3, 1.05, -D / 2 + 0.8, 0, { ao: false, tint: false });
  const menu = ctex(THREE, 'pz:menu', 256, 128, (g) => {
    g.fillStyle = '#1a3a22'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#d02a2a'; g.fillRect(0, 0, 256, 24);
    g.font = 'bold 16px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff4d0'; g.fillText('PIZZA CITY  -  HOT & FAST', 128, 12);
    const items = [['CHEESE SLICE', '$3'], ['PEPPERONI SLICE', '$4'], ['ANCHOVY SLICE', '$5'], ['GARLIC KNOTS', '$3'], ['FOUNTAIN SODA', '$2'], ['WHOLE PIE', '$14']];
    g.font = '11px monospace'; g.fillStyle = '#fff4d0'; items.forEach(([n, p], i) => { g.textAlign = 'left'; g.fillText(n, 12, 38 + i * 14); g.textAlign = 'right'; g.fillText(p, 244, 38 + i * 14); });
    g.font = '7px monospace'; g.textAlign = 'left'; g.fillStyle = '#f0c040'; g.fillText('anchovies by request. the cat requested.', 12, 122);
  }, { repeat: false });
  B.def('pmenu', { kind: 'lambert', map: menu }); B.box('plain', 0x101810, 2.7, 1.25, 0.04, px0, 2.35, -D / 2 + 0.02, 0, { ao: false }); B.quad('pmenu', 0xffffff, 2.6, 1.15, px0, 2.35, -D / 2 + 0.05, 0, { ao: false, tint: false });
  const staff = signTex(THREE, 'pz:staff', ['EMPLOYEES', 'ONLY'], '#fff', '#d02a2a', 96, 40); B.def('pstaff', { kind: 'lambert', map: staff });
  B.box('wood', 0x8a5a30, 0.06, 0.9, 1.4, 3.05, 0.45, -2.55, 0); B.quad('pstaff', 0xffffff, 0.4, 0.17, 3.09, 0.65, -2.55, Math.PI / 2, { ao: false, tint: false });   // half door at the counter end

  // --- dining room: a booth on the left wall, two checker tables, an arcade cabinet, a gumball machine, the mascot
  const check = ctex(THREE, 'pz:check', 32, 32, (g) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#d02a2a' : '#f8f4ec'; g.fillRect(x * 8, y * 8, 8, 8); } });
  B.def('pcheck', { kind: 'lambert', map: check });
  const table = (tx, tz, w, d, o = {}) => {
    B.box('pcheck', 0xffffff, w, 0.05, d, tx, 0.76, tz, 0, { ao: false }); for (const s of [-1, 1]) B.quad('pcheck', 0xffffff, w, 0.12, tx, 0.69, tz + s * (d / 2 + 0.005), s > 0 ? 0 : Math.PI, { ao: false, tint: false });
    B.cyl('shiny', 0x333333, 0.04, 0.04, 0.72, tx, 0.36, tz, 6); B.cyl('shiny', 0x333333, 0.28, 0.28, 0.03, tx, 0.015, tz, 8, { ao: false });
    if (o.candle) { B.cyl('glass', 0xc04020, 0.05, 0.04, 0.12, tx, 0.85, tz, 8, { ao: false }); B.sph('glow', 0xffc060, 0.02, tx, 0.93, tz, { ao: false, tint: false }); }
    if (o.plate) { B.cyl('plain', 0xffffff, 0.14, 0.14, 0.01, tx + 0.2, 0.79, tz - 0.1, 10, { ao: false, tint: false }); B.add(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 10, 1, false, 0, Math.PI / 4), 'plain', 0xc88a40, tx + 0.2, 0.8, tz - 0.1, 0.4, { ao: false, tint: false }); }   // a lone crust
    if (o.cups) for (const e of [-1, 1]) B.cyl('plain', 0xd02a2a, 0.045, 0.035, 0.14, tx + e * 0.3, 0.85, tz + 0.15, 8, { ao: false });
  };
  const chair = (x, z, ry) => { B.box('wood', 0x7a4a28, 0.42, 0.05, 0.42, x, 0.46, z, ry); for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.box('wood', 0x6a3a20, 0.04, 0.46, 0.04, x + lx, 0.23, z + lz, ry); B.box('wood', 0x7a4a28, 0.42, 0.5, 0.04, x - Math.sin(ry) * 0.19, 0.72, z - Math.cos(ry) * 0.19, ry); };
  const bench = (bz, face) => {   // face +1 = sitter faces +z
    B.box('cloth', RED, 1.6, 0.45, 0.5, -3.9, 0.225, bz); B.box('cloth', 0xe03a3a, 1.6, 0.1, 0.5, -3.9, 0.5, bz, 0, { ao: false });
    B.box('cloth', RED, 1.6, 0.65, 0.15, -3.9, 0.85, bz - face * 0.2);
  };
  bench(0.55, 1); bench(2.45, -1); table(-3.9, 1.5, 1.2, 0.8, { candle: true, plate: true });
  table(-1.3, 1.4, 0.9, 0.9, { candle: true, cups: true }); chair(-1.3, 0.75, 0); chair(-1.3, 2.05, Math.PI);
  table(3.5, 2.3, 0.9, 0.9, { candle: true }); chair(2.85, 2.3, Math.PI / 2); chair(3.5, 1.65, 0);
  // arcade cabinet "RACCOON RAMPAGE" on the right wall, facing -x
  const ax = W / 2 - 0.4, az = 0.0;
  B.box('plain', 0x2a2a6a, 0.7, 1.8, 0.8, ax, 0.9, az); B.box('plain', 0x1a1a40, 0.5, 0.15, 0.82, ax - 0.35, 1.0, az, 0, { ao: false, rz: -0.3 });
  const arc = ctex(THREE, 'pz:arc', 64, 48, (g) => { g.fillStyle = '#050510'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#30d050'; for (let k = 0; k < 6; k++) g.fillRect(4 + k * 10, 36, 8, 2); g.fillStyle = '#888'; g.beginPath(); g.arc(20, 26, 6, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(14, 24, 12, 3); g.fillStyle = '#f0d040'; g.font = '7px monospace'; g.fillText('HI 99999', 18, 8); g.fillStyle = '#ff4060'; g.fillRect(44, 22, 6, 6); }, { repeat: false });
  B.def('parc', { kind: 'basic', map: arc }); B.quad('parc', 0xffffff, 0.5, 0.4, ax - 0.36, 1.4, az, -Math.PI / 2, { ao: false, tint: false });
  const marq = signTex(THREE, 'pz:marq', ['RACCOON RAMPAGE'], '#ffd040', '#2a2a6a', 128, 32); B.def('pmarq', { kind: 'basic', map: marq }); B.quad('pmarq', 0xffffff, 0.66, 0.18, ax - 0.36, 1.72, az, -Math.PI / 2, { ao: false, tint: false });
  for (const e of [-1, 1]) B.sph('plain', e > 0 ? 0xff3030 : 0x3060ff, 0.03, ax - 0.42, 1.1, az + e * 0.12, { ao: false, tint: false });
  // gumball machine by the door
  B.cyl('plain', RED, 0.12, 0.16, 0.8, 2.4, 0.4, 3.3, 8); B.box('plain', RED, 0.22, 0.2, 0.22, 2.4, 0.9, 3.3); B.sph('glass', 0xffffff, 0.2, 2.4, 1.18, 3.3, { ao: false, ws: 10, hs: 8 });
  for (let k = 0; k < 16; k++) B.sph('plain', pick([0xff4040, 0x40c0ff, 0xffe040, 0x60e060, 0xff80c0]), 0.035, 2.4 + (rnd() - 0.5) * 0.24, 1.08 + rnd() * 0.15, 3.3 + (rnd() - 0.5) * 0.24, { ao: false, tint: false, ws: 5, hs: 4 });
  // Pizza City Pete: a cardboard slice with a face and a thumbs up, angled at the door
  const pete = ctex(THREE, 'pz:pete', 64, 96, (g) => {
    g.clearRect(0, 0, 64, 96); g.fillStyle = '#c88a40'; g.beginPath(); g.moveTo(4, 8); g.lineTo(60, 8); g.lineTo(32, 92); g.closePath(); g.fill();
    g.fillStyle = '#f0c040'; g.beginPath(); g.moveTo(9, 16); g.lineTo(55, 16); g.lineTo(32, 84); g.closePath(); g.fill();
    g.fillStyle = '#b02a20'; for (const [x, y] of [[20, 24], [42, 26], [32, 56], [26, 70]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; for (const x of [25, 39]) { g.beginPath(); g.arc(x, 36, 5, 0, 7); g.fill(); } g.fillStyle = '#111'; for (const x of [26, 40]) { g.beginPath(); g.arc(x, 37, 2, 0, 7); g.fill(); }
    g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(32, 44, 7, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText('PIZZA CITY PETE', 32, 6);
  }, { repeat: false });
  B.def('ppete', { kind: 'lambert', map: pete, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  B.quad('ppete', 0xffffff, 0.9, 1.35, 4.3, 0.95, 3.4, Math.PI + 0.6, { ao: false, tint: false }); B.box('plain', 0x8a6a40, 0.3, 0.6, 0.04, 4.45, 0.3, 3.6, 0.6, { ao: false });
  // wall decor: little league photo, slice-shaped clock, a string of pennants over the dining room
  const league = ctex(THREE, 'pz:league', 64, 48, (g) => { g.fillStyle = '#d8d0b8'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#6a9a50'; g.fillRect(0, 30, 64, 18); for (let k = 0; k < 7; k++) { g.fillStyle = '#d02a2a'; g.fillRect(5 + k * 8, 18, 5, 12); g.fillStyle = '#e8c8a0'; g.fillRect(6 + k * 8, 13, 3, 4); } g.fillStyle = '#222'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.fillText('PIZZA CITY SLUGGERS  1998', 32, 8); g.fillText('0 WINS. GREAT ATTITUDE.', 32, 44); }, { repeat: false });
  B.def('pleague', { kind: 'lambert', map: league }); framedPicture(B, THREE, 'pleague', 0.7, 0.52, -W / 2 + 0.02, 1.85, 1.5, Math.PI / 2, 0x2a7a3a);
  B.add(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 3).rotateX(Math.PI / 2), 'plain', 0xf0c040, W / 2 - 0.03, 2.3, 2.3, -Math.PI / 2, { ao: false, tint: false });
  for (let k = 0; k < 2; k++) B.box('plain', 0x111111, 0.012, 0.16, 0.012, W / 2 - 0.06, 2.3 + 0.05, 2.3, -Math.PI / 2, { ao: false, tint: false, rz: k ? 1.2 : -0.3 });
  for (let k = 0; k < 14; k++) { const t = k / 13, x = -4.6 + t * 9.2, y = H - 0.25 - Math.sin(t * Math.PI) * 0.35; B.add(new THREE.ConeGeometry(0.1, 0.22, 3).rotateX(Math.PI), 'plain', [RED, 0xf4f4f0, GREEN][k % 3], x, y - 0.11, 2.0, 0, { ao: false, tint: false }); }
  // ceiling: two tubes over the counter, red pendant shades over the tables
  tubeLight(B, -2.0, H - 0.1, -2.0, 1.4, 0, 0xfff4e8); tubeLight(B, 1.6, H - 0.1, -2.0, 1.4, 0, 0xfff4e8);
  for (const [lx, lz] of [[-3.9, 1.5], [-1.3, 1.4], [3.5, 2.3]]) { B.cyl('plain', 0x222222, 0.008, 0.008, 0.9, lx, H - 0.45, lz, 4, { ao: false }); B.cyl('plain', RED, 0.08, 0.26, 0.2, lx, H - 1.0, lz, 10, { ao: false }); B.sph('glow', 0xfff0c0, 0.06, lx, H - 1.1, lz, { ao: false, tint: false }); }

  const group = B.finish(new THREE.Group());
  cols.push(
    { kind: 'box', cx: cx0, cz, w: CL, d: 0.75, rot: 0, h: 1.0 },                      // counter (standable)
    { kind: 'box', cx: gx, cz, w: 1.45, d: 0.65, rot: 0, h: 1.6 },                      // slice warmer
    { kind: 'box', cx: 3.05, cz: -2.55, w: 0.1, d: 1.4, rot: 0, h: 0.9 },               // half door
    { kind: 'box', cx: ox, cz: oz, w: 2.2, d: 1.15, rot: 0, h: H },                     // oven
    { kind: 'box', cx: px0, cz: pz0, w: 1.85, d: 0.75, rot: 0, h: 0.95 },               // prep table
    { kind: 'box', cx: 2.2, cz: -D / 2 + 0.4, w: 0.6, d: 0.6, rot: 0, h: 0.48 },        // box tower
    { kind: 'box', cx: 4.3, cz: -D / 2 + 0.42, w: 1.1, d: 0.8, rot: 0, h: 2.0 },        // fridge
    { kind: 'box', cx: -3.9, cz: 0.55, w: 1.6, d: 0.5, rot: 0, h: 1.2, top: 0.55 },     // booth benches
    { kind: 'box', cx: -3.9, cz: 2.45, w: 1.6, d: 0.5, rot: 0, h: 1.2, top: 0.55 },
    { kind: 'box', cx: -3.9, cz: 1.5, w: 1.2, d: 0.8, rot: 0, h: 0.78 },                // tables
    { kind: 'box', cx: -1.3, cz: 1.4, w: 0.9, d: 0.9, rot: 0, h: 0.78 },
    { kind: 'box', cx: 3.5, cz: 2.3, w: 0.9, d: 0.9, rot: 0, h: 0.78 },
    { kind: 'box', cx: ax, cz: az, w: 0.75, d: 0.85, rot: 0, h: 1.8 },                  // arcade
    { kind: 'box', cx: 2.4, cz: 3.3, w: 0.4, d: 0.4, rot: 0, h: 1.3 },                  // gumballs
    { kind: 'box', cx: 4.35, cz: 3.45, w: 0.7, d: 0.4, rot: 0.6, h: 1.6 },              // Pete
  );
  return {
    group, size: [W, D], cols, floors: [],
    spawn: { x: DOOR_X, z: D / 2 - 1.0, yaw: 0 },
    exit: { x: DOOR_X, z: D / 2 + 0.05, r: 0.6 },
    lights: [
      { x: -2.0, y: H - 0.3, z: -2.0, c: 0xfff4e8, i: 0.9, always: true },
      { x: 1.6, y: H - 0.3, z: -2.0, c: 0xfff4e8, i: 0.9, always: true },
      { x: ox, y: 1.0, z: oz + 1.0, c: 0xff8a30, i: 0.8, always: true, flicker: true },   // oven
      { x: -2.6, y: 1.2, z: 1.5, c: 0xffd8a0, i: 0.7, always: true },                     // pendants (left)
      { x: 3.5, y: 2.0, z: 2.3, c: 0xffd8a0, i: 0.6, always: true },
      { x: ax - 0.6, y: 1.4, z: az, c: 0x8080ff, i: 0.35, always: true },                 // arcade glow
    ],
    cam: { maxDist: 4.5, height: 2.4 },
    interact: [
      { id: 'counter', x: rx0, z: cz + 0.85, r: 0.9, label: 'Order pizza' },
      { id: 'warmer', x: gx, z: cz + 0.85, r: 0.8, label: 'Order pizza' },
      { id: 'arcade', x: ax - 0.8, z: az, r: 0.7, label: 'Play Raccoon Rampage ($1)' },
      { id: 'gumball', x: 2.4, z: 2.8, r: 0.55, label: 'Gumball ($1)' },
      { id: 'booth', x: -2.9, z: 1.5, r: 0.7, label: 'Sit in the booth' },
      { id: 'oven', x: ox + 0.4, z: oz + 1.3, r: 0.7, label: 'Warm your paws' },
      { id: 'pete', x: 3.8, z: 3.1, r: 0.55, label: 'Pizza City Pete' },
    ],
  };
}

// ---------------- the counter: cash menu ----------------
const belly = (n) => (HUNGER_ENABLED ? `, +${n} belly` : '');
const MENU = [
  { id: 'cheese', label: 'Cheese slice', price: 3, hp: 20, belly: 20, blurb: 'Plain cheese. Folded in half, New York style, by a cat who has never been to New York.' },
  { id: 'pepperoni', label: 'Pepperoni slice', price: 4, hp: 25, belly: 25, blurb: 'Little grease cups of joy. The top seller since 1998.' },
  { id: 'anchovy', label: 'Anchovy slice', price: 5, hp: 40, belly: 30, blurb: 'Nobody orders these. Nobody except you. The guy keeps a tray just in case.' },
  { id: 'knots', label: 'Garlic knots', price: 3, hp: 15, belly: 15, blurb: 'Six knots swimming in garlic butter. You will smell like this for a week.' },
  { id: 'soda', label: 'Fountain soda', price: 2, hp: 5, belly: 5, blurb: 'Refills are free. The ice machine is louder than the TV.' },
  { id: 'pie', label: 'Whole pie (large)', price: 14, hp: 100, belly: 100, blurb: 'Sixteen inches of pepperoni in a box warmer than you. Full health.' },
];
const LINES = {
  cheese: 'Cheese slice. Hot enough to burn the roof of your mouth. Worth it.',
  pepperoni: 'Pepperoni slice. You lick every grease cup clean first.',
  anchovy: 'Vinnie: "Finally. Somebody gets it." He gives you an extra anchovy.',
  knots: 'Garlic knots. Six of them. Gone in four bites.',
  soda: 'Fountain soda. You knock the cup over and drink it off the counter. Vinnie sighs.',
  pie: 'A whole large pie. You sit in the box and eat it from the middle out.',
};
let A = null;
const S = { bought: {}, spent: 0, greeted: false, arcade: 0, best: 0 };

export function buy(id) {
  if (!A) return false;
  const it = MENU.find((m) => m.id === id); if (!it) return false;
  if ((A.G.cash || 0) < it.price) { A.Sfx.blip && A.Sfx.blip(180); A.toast(`Vinnie: "That's $${it.price}, little buddy. Come back with cash."`, 3.5); return false; }
  A.addCash(-it.price); S.bought[id] = (S.bought[id] || 0) + 1; S.spent += it.price;
  A.G.hp = Math.min(100, (A.G.hp || 0) + it.hp);
  if (A.fishing && A.fishing.feed) A.fishing.feed(it.belly);
  A.Sfx.pickup && A.Sfx.pickup();
  A.toast(`${LINES[id]} +${it.hp} health${belly(it.belly)}. -$${it.price}`, 4);
  return true;
}
function openMenu() {
  if (!A.fishing || !A.fishing.menu) return false;
  return A.fishing.menu({
    title: 'Pizza City',
    items: () => MENU.map((m) => ({ id: m.id, label: m.label, price: '$' + m.price, blurb: m.blurb + ` (+${m.hp} health${belly(m.belly)})`, dim: (A.G.cash || 0) < m.price })),
    pick: (it) => buy(it.id),
  });
}
function arcade() {
  if ((A.G.cash || 0) < 1) { A.Sfx.blip && A.Sfx.blip(180); A.toast('INSERT COIN. You have no coin. The raccoon on the screen laughs at you.', 3.5); return; }
  A.addCash(-1); S.arcade++;
  const score = Math.round((800 + Math.random() * 9000) / 10) * 10;
  const best = score > S.best; S.best = Math.max(S.best, score);
  A.Sfx.blip && A.Sfx.blip(660);
  A.toast(best ? `RACCOON RAMPAGE: ${score} points. NEW HIGH SCORE! You enter "CAT". The cabinet accepts it.` : `RACCOON RAMPAGE: ${score} points. A raccoon steals your last life. Your best is ${S.best}.`, 4);
}
function gumball() {
  if ((A.G.cash || 0) < 1) { A.Sfx.blip && A.Sfx.blip(180); A.toast('You bat at the gumball machine. It does not take paw pats, only quarters.', 3.5); return; }
  A.addCash(-1); A.Sfx.pickup && A.Sfx.pickup();
  const c = ['red', 'blue', 'yellow', 'green', 'pink'][(Math.random() * 5) | 0];
  A.toast(`Clunk, rattle, a ${c} gumball. You chase it under a table for a while. -$1`, 3.5);
}
const FLAVOR = {
  booth: ['You curl up in the booth. The vinyl squeaks. Vinnie pretends not to see.', 'You knead the booth seat. Somebody has been kneading it before you.'],
  oven: ['The oven is 700 degrees. You hold your paws up to it like a little campfire.', 'Vinnie: "Whiskers back from the oven, buddy. I lost an eyebrow in 2009."'],
  pete: ['Pizza City Pete gives you a cardboard thumbs up. You give him a long, slow blink.', 'Pete has a tooth mark in one corner. Not yours. Probably a raccoon.'],
};
const say = (k) => { const l = FLAVOR[k]; A.toast(l[(Math.random() * l.length) | 0], 3.5); };

/** Call once after the interiors and the fishing menu exist. a = { G, places, fishing, toast, addCash, Sfx } */
export function init(a) {
  A = a;
  const p = a.places && a.places.pizza;
  if (!p || !Number.isFinite(p.x)) { console.warn('[pizza] places.pizza missing; Pizza City stays closed'); return false; }
  // places.pizza = frame-local (1, 6) facing out; the door face is 1.97 m back toward the shop, windows along the facade
  const yaw = p.yaw || 0, ox = Math.sin(yaw), oz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
  const door = { x: p.x - ox * 1.97, z: p.z - oz * 1.97 };
  const at = (dx) => ({ x: door.x + lx * dx, z: door.z + lz * dx });
  const entries = [{ ...door, yaw, kind: 'door' }, ...WINDOWS.map((wx) => ({ ...at(wx - DOOR_X), yaw, kind: 'window', inside: { x: wx, z: D / 2 - 0.8, yaw: 0 } }))];
  INTR.registerRoom('pizza', { name: 'Pizza City', build: buildPizza }, entries);
  INTR.on('interact', (room, spot) => {
    if (room !== 'pizza') return false;
    if (spot === 'counter' || spot === 'warmer') {
      if (!openMenu()) return false;
      if (!S.greeted) { S.greeted = true; A.toast('Vinnie, from behind the counter: "Welcome to Pizza City! Hot and fast. Well. Hot."', 4); }
      return true;
    }
    if (spot === 'arcade') { arcade(); return true; }
    if (spot === 'gumball') { gumball(); return true; }
    if (FLAVOR[spot]) { say(spot); return true; }
    return false;
  });
  window.__G && (window.__G.pizza = { S, buy, MENU, entries });
  return true;
}
