// Maple Grove High interior (diet 2026-11-26: "i should be able to enter the highschool"). Self-contained: the room set,
// its door + window entries (derived from places.school, world.js buildSchool) and the hotspots (lockers, cafeteria
// lunch counter, chalkboard, class hamster). Registered with interiors.registerRoom, like pizza.js.
// Layout (room-local, +z toward the front doors): front hall with lockers + trophy case (z 0..6), a classroom (back left)
// and the cafeteria (back right), each through a doorway in the cross wall at z = 0.
// Wired in game.js: SCHOOL.init({ G, places, fishing, toast, addCash, Sfx }).
// Debug: window.__G.school.buy('tots'), .S
import * as INTR from './interiors.js';
import { KIT } from './rooms.js';
import { HUNGER_ENABLED } from './fishing.js';

const W = 16, D = 12, H = 3.4;
const WINDOWS = [-4, 4];     // ground-floor windows either side of the portico (building-local x, y 2.0, sill 1.3)
const NAVY = 0x1e3a6a, GOLD = 0xf0c040;

function buildSchool(ctx) {
  const { THREE, T } = ctx;
  const { ctex, grime, signTex, makeBuilder, shell, framedPicture, tubeLight, rnd, pick } = KIT;
  KIT.reseed(131);
  const B = makeBuilder(THREE, T);
  const tile = ctex(THREE, 'hs:tile', 64, 64, (g) => {
    g.fillStyle = '#e4e0d4'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#d8d2c2'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.fillStyle = 'rgba(30,58,106,0.35)'; g.fillRect(0, 32, 32, 32);   // a navy fleck square in every block (school colours)
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${pick(['60,60,60', '30,58,106', '200,160,60'])},${0.1 + rnd() * 0.2})`; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); }
    g.strokeStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k <= 64; k += 32) { g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, 64); g.moveTo(0, k + 0.5); g.lineTo(64, k + 0.5); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(6, 6, 20, 3);   // wax shine
  });
  const block = ctex(THREE, 'hs:block', 64, 64, (g) => {   // painted cinder block
    g.fillStyle = '#ece6d4'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(120,110,90,0.45)'; g.lineWidth = 1;
    for (let y = 0; y <= 64; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(64, y + 0.5); g.stroke(); }
    for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x <= 64; x += 32) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 16); g.stroke(); }
    grime(g, 64, 64, 80, 0.08);
  });
  const ceil = ctex(THREE, 'hs:ceil', 64, 64, (g) => { g.fillStyle = '#e8e6de'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#a8a498'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } g.fillStyle = '#333'; g.fillRect(40, 12, 2, 6); g.fillRect(41, 18, 1, 2); });   // a pencil stuck in the tile
  B.def('htile', { kind: 'lambert', map: tile }); B.def('hblock', { kind: 'lambert', map: block }); B.def('hceil', { kind: 'lambert', map: ceil });
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'htile', wallKey: 'hblock', ceilKey: 'hceil', ceilCol: 0xffffff, door: { x: 0, w: 2.4, h: 2.4 }, base: NAVY, frame: 0x8a8a90, wallTile: 1.2, floorTile: 1, trim: { c: NAVY, y: 1.2, h: 0.18 } });

  // --- front wall: double glass doors, two windows (daytime schoolyard), trophy case, front office window
  const yard = ctex(THREE, 'hs:yard', 64, 32, (g) => { const gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#7ab0e8'); gr.addColorStop(0.6, '#cfe4f4'); g.fillStyle = gr; g.fillRect(0, 0, 64, 32); g.fillStyle = '#6aa050'; g.fillRect(0, 22, 64, 10); g.fillStyle = '#3a6a3a'; for (const x of [8, 50]) { g.beginPath(); g.arc(x, 18, 7, 0, 7); g.fill(); } g.fillStyle = '#f0b020'; g.fillRect(24, 18, 16, 6); g.fillStyle = '#1a1a1a'; g.fillRect(27, 24, 3, 2); g.fillRect(35, 24, 3, 2); }, { repeat: false });
  B.def('yard', { kind: 'basic', map: yard });
  for (const x of WINDOWS) {
    B.quad('yard', 0xffffff, 2.4, 1.4, x, 2.0, D / 2 - 0.02, Math.PI, { ao: false, tint: false });
    for (const y of [2.73, 1.27]) B.quad('plain', 0xb0b0b8, 2.5, 0.08, x, y, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
    for (const e of [-1, 0, 1]) B.quad('plain', 0xb0b0b8, 0.08, 1.5, x + e * 1.22, 2.0, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
    B.box('plain', 0xd8d4c8, 2.5, 0.06, 0.25, x, 1.25, D / 2 - 0.12, 0, { ao: false });   // sill
  }
  for (const e of [-1, 1]) {   // double doors
    B.quad('yard', 0xc8d4e0, 1.14, 2.35, e * 0.6, 1.18, D / 2 - 0.05, Math.PI, { ao: false, tint: false });
    B.quad('plain', 0x8a8a90, 0.06, 2.35, e * 1.17, 1.18, D / 2 - 0.06, Math.PI, { ao: false, tint: false });
    B.box('shiny', 0xc8ccd4, 0.9, 0.06, 0.08, e * 0.6, 1.05, D / 2 - 0.12, 0, { ao: false });   // crash bars
  }
  B.quad('plain', 0x8a8a90, 0.06, 2.35, 0, 1.18, D / 2 - 0.06, Math.PI, { ao: false, tint: false });
  const exitS = signTex(THREE, 'hs:exit', ['EXIT'], '#1a1a1a', '#ff3030', 64, 24, { glow: true }); B.def('hexit', { kind: 'basic', map: exitS });
  B.box('plain', 0x222222, 0.5, 0.2, 0.08, 0, 2.7, D / 2 - 0.05, 0, { ao: false }); B.quad('hexit', 0xffffff, 0.46, 0.17, 0, 2.7, D / 2 - 0.1, Math.PI, { ao: false, tint: false });
  // trophy case on the front wall, to your right as you walk in (+x)
  const tx = 6.6;
  B.box('wood', 0x6a4a2a, 2.2, 0.9, 0.5, tx, 0.45, D / 2 - 0.3); B.box('glass', 0xe8f4ff, 2.2, 1.2, 0.48, tx, 1.5, D / 2 - 0.3); B.box('wood', 0x6a4a2a, 2.24, 0.08, 0.52, tx, 2.14, D / 2 - 0.3, 0, { ao: false });
  for (const y of [0.92, 1.5]) B.box('glass', 0xffffff, 2.1, 0.02, 0.44, tx, y, D / 2 - 0.3, 0, { ao: false });
  const trophy = (x, y, s, c) => { B.box('plain', 0x3a2a1a, 0.12 * s, 0.08 * s, 0.12 * s, x, y + 0.04 * s, D / 2 - 0.3, 0, { ao: false }); B.cyl('shiny', c, 0.015 * s, 0.015 * s, 0.12 * s, x, y + 0.14 * s, D / 2 - 0.3, 5, { ao: false }); B.cyl('shiny', c, 0.07 * s, 0.03 * s, 0.12 * s, x, y + 0.26 * s, D / 2 - 0.3, 8, { ao: false }); for (const e of [-1, 1]) B.add(new THREE.TorusGeometry(0.03 * s, 0.008 * s, 4, 8, Math.PI), 'shiny', c, x + e * 0.075 * s, y + 0.27 * s, D / 2 - 0.3, 0, { ao: false, rz: e * Math.PI / 2 }); };
  [[5.8, 0.93, 1.4, GOLD], [6.3, 0.93, 1.0, 0xc0c0c8], [6.8, 0.93, 1.8, GOLD], [7.3, 0.93, 0.9, 0xb87333], [5.9, 1.51, 1.0, 0xc0c0c8], [6.6, 1.51, 1.2, GOLD]].forEach(([x, y, s, c]) => trophy(x, y, s, c));
  B.box('plain', 0x6a3a1a, 0.3, 0.3, 0.02, 7.25, 1.68, D / 2 - 0.3, 0, { ao: false });   // a framed pennant
  const tcase = signTex(THREE, 'hs:tcase', ['RACCOONS HALL OF FAME', '1987 STATE RUNNER-UP (2 TEAMS)'], NAVY, '#f0c040', 256, 40); B.def('htcase', { kind: 'lambert', map: tcase });
  B.quad('htcase', 0xffffff, 2.0, 0.3, tx, 2.35, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
  // front office window on the other side of the door
  const office = ctex(THREE, 'hs:office', 64, 32, (g) => { g.fillStyle = '#c8d8e0'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#8a6a4a'; g.fillRect(0, 20, 64, 12); g.fillStyle = '#e8e8e0'; g.fillRect(8, 12, 12, 8); g.fillStyle = '#2a2a2a'; g.fillRect(10, 13, 8, 5); g.fillStyle = '#6a5040'; g.beginPath(); g.arc(44, 12, 5, 0, 7); g.fill(); g.fillStyle = '#a07858'; g.fillRect(39, 17, 10, 8); }, { repeat: false });
  B.def('hoffice', { kind: 'basic', map: office }); B.quad('hoffice', 0xffffff, 2.0, 1.0, -W / 2 + 0.02, 1.7, 4.2, Math.PI / 2, { ao: false, tint: false });
  B.box('plain', 0xd8d4c8, 0.3, 0.06, 2.1, -W / 2 + 0.15, 1.17, 4.2, 0, { ao: false });
  const offS = signTex(THREE, 'hs:offS', ['MAIN OFFICE', 'ALL VISITORS MUST SIGN IN'], '#fff', '#1e3a6a', 192, 48, { border: '#1e3a6a' }); B.def('hoffS', { kind: 'lambert', map: offS });
  B.quad('hoffS', 0xffffff, 1.3, 0.32, -W / 2 + 0.03, 2.5, 4.2, Math.PI / 2, { ao: false, tint: false });
  B.box('plain', 0xf4f0e8, 0.25, 0.02, 0.35, -W / 2 + 0.2, 1.21, 4.6, 0.2, { ao: false }); B.cyl('plain', 0x1a3a8a, 0.008, 0.008, 0.16, -W / 2 + 0.2, 1.22, 4.3, 4, { ao: false, rz: Math.PI / 2 });   // sign-in sheet + pen

  // --- lockers along both side walls of the hall (z 0.4 .. 3.4 on the +x wall, 0.4 .. 3.0 on the -x wall)
  const lock = ctex(THREE, 'hs:locker', 32, 64, (g) => { g.fillStyle = '#2a5aa8'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#1a3a7a'; for (let k = 0; k < 4; k++) g.fillRect(8, 6 + k * 3, 16, 1); g.fillRect(8, 52, 16, 1); g.fillRect(0, 0, 1, 64); g.fillStyle = '#c8ccd4'; g.fillRect(24, 30, 3, 8); g.fillStyle = '#e0e0e0'; g.fillRect(10, 18, 10, 3); grime(g, 32, 64, 40, 0.15); }, { repeat: false });
  B.def('hlock', { kind: 'lambert', map: lock });
  const lockers = (wx, z0, n, face) => {   // face = +1: front faces +x (on the -x wall)
    const rot = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    B.box('plain', 0x1a3a7a, 0.45, 1.9, n * 0.4, wx + face * 0.225, 0.95 + 0.1, z0 + n * 0.2, 0);
    B.box('plain', 0x333333, 0.45, 0.1, n * 0.4, wx + face * 0.225, 0.05, z0 + n * 0.2, 0, { ao: false });
    for (let k = 0; k < n; k++) B.quad('hlock', k === 5 ? 0xe0a0a0 : 0xffffff, 0.38, 1.8, wx + face * 0.455, 1.05, z0 + 0.2 + k * 0.4, rot, { ao: false, tint: false });
  };
  lockers(-W / 2, 0.4, 7, 1); lockers(W / 2, 0.4, 8, -1);
  const stickerT = signTex(THREE, 'hs:stk', ['GOOBLES', 'WAS HERE'], '#ffe060', '#111', 64, 32); B.def('hstk', { kind: 'lambert', map: stickerT });
  B.quad('hstk', 0xffffff, 0.2, 0.1, W / 2 - 0.46, 0.7, 0.6 + 5 * 0.4 + 0.02, -Math.PI / 2, { ao: false, tint: false });
  // water fountain + wet floor sign + trash can in the hall
  B.box('shiny', 0xc8ccd4, 0.5, 0.25, 0.4, -W / 2 + 0.25, 0.85, 3.6, 0); B.box('shiny', 0xa8acb4, 0.12, 0.6, 0.12, -W / 2 + 0.12, 0.45, 3.6, 0, { ao: false }); B.cyl('shiny', 0xb0b4bc, 0.02, 0.02, 0.06, -W / 2 + 0.3, 1.0, 3.6, 5, { ao: false });
  B.cyl('plain', 0xf0d020, 0.02, 0.2, 0.6, 2.5, 0.3, 1.8, 4); const wet = signTex(THREE, 'hs:wet', ['CAUTION', 'WET FLOOR'], '#f0d020', '#111', 64, 48); B.def('hwet', { kind: 'lambert', map: wet }); B.quad('hwet', 0xffffff, 0.2, 0.16, 2.5, 0.35, 1.93, 0.1, { ao: false, tint: false });
  B.cyl('plain', 0x4a6a8a, 0.28, 0.25, 0.75, -2.2, 0.375, 0.6, 10); B.cyl('plain', 0x2a4a6a, 0.3, 0.3, 0.05, -2.2, 0.77, 0.6, 10, { ao: false });

  // --- cross wall at z = 0 with doorways at x = -4 (classroom) and x = +4 (cafeteria); split wall at x = 0 behind it
  const WT = 0.2, gap = 1.4;
  const segs = [[-W / 2, -4 - gap / 2], [-4 + gap / 2, 4 - gap / 2], [4 + gap / 2, W / 2]];
  const WTILE = 1.2;
  const pwall = (cx, cz, len, hh, y, alongZ) => {   // both faces of an inner wall, block texture at the shell's scale
    for (const f of [-1, 1]) {
      const ry = alongZ ? f * Math.PI / 2 : (f > 0 ? 0 : Math.PI);
      B.quad('hblock', 0xffffff, len, hh, cx + (alongZ ? f * WT / 2 : 0), y, cz + (alongZ ? 0 : f * WT / 2), ry, { sx: Math.ceil(len), sy: 2, us: len / WTILE, vs: hh / WTILE, ao: false, tint: false });
    }
  };
  for (const [a, b] of segs) { pwall((a + b) / 2, 0, b - a, H, H / 2, false); for (const e of [a, b]) if (Math.abs(e) < W / 2 - 0.01) B.box('plain', 0xece6d4, 0.02, H, WT, e, H / 2, 0, 0, { ao: false }); }
  for (const x of [-4, 4]) pwall(x, 0, gap, H - 2.3, 2.3 + (H - 2.3) / 2, false);
  pwall(0, -D / 4 - 0.05, D / 2 - 0.1, H, H / 2, true);
  for (const x of [-4, 4]) { for (const e of [-1, 1]) B.box('plain', 0x8a8a90, 0.08, 2.3, WT + 0.04, x + e * gap / 2, 1.15, 0, 0, { ao: false }); B.box('plain', 0x8a8a90, gap + 0.16, 0.08, WT + 0.04, x, 2.3, 0, 0, { ao: false }); }
  for (const [x, a, b] of [[-4, 'ROOM 101', 'MR. HOLLOWAY'], [4, 'CAFETERIA', 'NO RUNNING']]) { const st = signTex(THREE, 'hs:dr' + x, [a, b], '#fff', '#1e3a6a', 128, 40, { border: '#1e3a6a' }); B.def('hdr' + x, { kind: 'lambert', map: st }); B.quad('hdr' + x, 0xffffff, 0.8, 0.25, x, 2.6, WT / 2 + 0.01, 0, { ao: false, tint: false }); }
  const banner = signTex(THREE, 'hs:ban', ['GO RACCOONS!  HOMECOMING FRIDAY'], NAVY, '#f0c040', 512, 48); B.def('hban', { kind: 'lambert', map: banner, side: THREE.DoubleSide });
  B.quad('hban', 0xffffff, 4.6, 0.45, 0, 2.75, WT / 2 + 0.02, 0, { ao: false, tint: false });
  const mascot = ctex(THREE, 'hs:masc', 48, 64, (g) => { g.fillStyle = '#1e3a6a'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#8a8a90'; g.beginPath(); g.arc(24, 30, 15, 0, 7); g.fill(); g.fillStyle = '#2a2a2a'; g.fillRect(9, 25, 30, 7); g.fillStyle = '#fff'; g.fillRect(14, 27, 5, 3); g.fillRect(29, 27, 5, 3); g.fillStyle = '#8a8a90'; g.beginPath(); g.moveTo(10, 20); g.lineTo(13, 8); g.lineTo(19, 17); g.moveTo(38, 20); g.lineTo(35, 8); g.lineTo(29, 17); g.fill(); g.fillStyle = '#f0c040'; g.font = 'bold 8px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('RACCOON', 24, 54); g.fillText('PRIDE', 24, 62); }, { repeat: false });
  B.def('hmasc', { kind: 'lambert', map: mascot }); B.quad('hmasc', 0xffffff, 0.6, 0.8, -6.4, 1.8, WT / 2 + 0.01, 0, { ao: false, tint: false }); B.quad('hmasc', 0xffffff, 0.6, 0.8, 6.4, 1.8, WT / 2 + 0.01, 0, { ao: false, tint: false });

  // --- classroom (x -8..0, z -6..0): chalkboard, teacher's desk with an apple + globe, eight desks, the class hamster
  const chalk = ctex(THREE, 'hs:chalk', 256, 96, (g) => {
    g.fillStyle = '#2a4a36'; g.fillRect(0, 0, 256, 96); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`; g.fillRect(rnd() * 256, rnd() * 96, 3, 1); }
    g.fillStyle = '#f4f4ec'; g.font = '12px "Comic Sans MS", cursive, sans-serif'; g.textAlign = 'left';
    g.fillText('HISTORY OF MAPLE GROVE', 12, 18); g.font = '9px "Comic Sans MS", cursive, sans-serif';
    g.fillText('1887  town founded by a guy named Maple', 12, 34); g.fillText('1888  grove planted (finally)', 12, 46); g.fillText('1962  HOA invented. dark times.', 12, 58);
    g.fillText('QUIZ FRIDAY', 180, 80); g.fillStyle = '#f0d060'; g.fillText('DO NOT ERASE', 12, 84);
  }, { repeat: false });
  B.def('hchalk', { kind: 'lambert', map: chalk });
  B.box('wood', 0x8a6a4a, 3.4, 1.3, 0.06, -4, 1.75, -D / 2 + 0.03, 0, { ao: false }); B.quad('hchalk', 0xffffff, 3.3, 1.2, -4, 1.75, -D / 2 + 0.07, 0, { ao: false, tint: false });
  B.box('wood', 0x8a6a4a, 3.4, 0.05, 0.1, -4, 1.08, -D / 2 + 0.08, 0, { ao: false }); for (let k = 0; k < 3; k++) B.box('plain', 0xf8f8f0, 0.08, 0.015, 0.015, -4.8 + k * 0.3, 1.115, -D / 2 + 0.1, rnd(), { ao: false, tint: false });
  const tdx = -4, tdz = -4.4;
  B.box('wood', 0x7a5232, 1.6, 0.06, 0.8, tdx, 0.76, tdz); for (const e of [-1, 1]) B.box('wood', 0x6a4428, 0.5, 0.74, 0.76, tdx + e * 0.52, 0.37, tdz);
  B.sph('plain', 0xd02020, 0.06, tdx - 0.4, 0.84, tdz + 0.15, { ao: false, tint: false }); B.box('plain', 0x4a8a3a, 0.02, 0.04, 0.01, tdx - 0.4, 0.92, tdz + 0.15, 0, { ao: false, tint: false });
  B.sph('plain', 0x3a7ac8, 0.14, tdx + 0.45, 1.02, tdz - 0.1, { ao: false, ws: 10, hs: 8 }); B.cyl('shiny', 0xd8b050, 0.012, 0.012, 0.16, tdx + 0.45, 0.85, tdz - 0.1, 4, { ao: false }); B.add(new THREE.TorusGeometry(0.16, 0.008, 4, 14, Math.PI), 'shiny', 0xd8b050, tdx + 0.45, 1.02, tdz - 0.1, 0.4, { ao: false, rz: Math.PI / 2 });
  for (let k = 0; k < 3; k++) B.box('plain', pick([0xf4f0e0, 0xe8e0c8]), 0.3, 0.02, 0.22, tdx + 0.05, 0.8 + k * 0.02, tdz + 0.1, (rnd() - 0.5) * 0.3, { ao: false, tint: false });   // ungraded papers
  const desk = (x, z, o = {}) => {
    B.box('wood', 0xc8a878, 0.6, 0.04, 0.45, x, 0.68, z - 0.05); B.box('shiny', 0x707880, 0.04, 0.66, 0.04, x - 0.25, 0.34, z - 0.05, 0, { ao: false }); B.box('shiny', 0x707880, 0.04, 0.66, 0.04, x + 0.25, 0.34, z - 0.05, 0, { ao: false });
    B.box('plain', 0x2a5aa8, 0.42, 0.04, 0.38, x, 0.42, z + 0.4); B.box('plain', 0x2a5aa8, 0.42, 0.36, 0.04, x, 0.62, z + 0.58); for (const [lx, lz] of [[-0.18, 0.25], [0.18, 0.25], [-0.18, 0.55], [0.18, 0.55]]) B.box('shiny', 0x707880, 0.03, 0.42, 0.03, x + lx, 0.21, z + lz, 0, { ao: false });
    if (o.book) B.box('plain', pick([0xc02a2a, 0x2a8a4a, 0xe0a020]), 0.22, 0.05, 0.28, x + 0.05, 0.725, z - 0.05, rnd() - 0.5, { ao: false });
    if (o.gum) B.sph('plain', 0xff80c0, 0.02, x + 0.2, 0.655, z - 0.2, { ao: false, tint: false, ws: 5, hs: 4 });
  };
  const DESKS = [];
  for (const z of [-2.9, -1.6]) for (const x of [-6.8, -5.4, -2.6, -1.2]) { DESKS.push([x, z]); desk(x, z, { book: rnd() < 0.6, gum: rnd() < 0.3 }); }
  // class hamster cage on a shelf in the back corner
  const hx = -7.3, hz = -5.0;
  B.box('wood', 0x8a6a4a, 1.0, 0.9, 0.6, hx, 0.45, hz); B.box('plain', 0x40a0d0, 0.7, 0.06, 0.42, hx, 0.93, hz, 0, { ao: false });
  for (let k = 0; k < 8; k++) B.box('shiny', 0xd0d4dc, 0.008, 0.36, 0.008, hx - 0.33 + k * 0.094, 1.14, hz + 0.2, 0, { ao: false, tint: false });
  for (let k = 0; k < 6; k++) B.box('shiny', 0xd0d4dc, 0.008, 0.36, 0.008, hx - 0.33 + k * 0.13, 1.14, hz - 0.2, 0, { ao: false, tint: false });
  B.box('shiny', 0xd0d4dc, 0.7, 0.01, 0.42, hx, 1.32, hz, 0, { ao: false }); B.add(new THREE.TorusGeometry(0.1, 0.012, 4, 12), 'plain', 0xf0a030, hx + 0.18, 1.06, hz, Math.PI / 2, { ao: false, tint: false });
  B.sph('plain', 0xd8a060, 0.05, hx - 0.12, 1.0, hz + 0.05, { ao: false, tint: false, s: [1.3, 0.9, 1] }); B.sph('plain', 0xf4e0c0, 0.03, hx - 0.06, 1.0, hz + 0.07, { ao: false, tint: false });   // Mr. Nibbles
  const nib = signTex(THREE, 'hs:nib', ['MR. NIBBLES', 'do NOT feed', 'to the cat'], '#fff', '#c02a2a', 96, 48, { border: '#c02a2a' }); B.def('hnib', { kind: 'lambert', map: nib }); B.quad('hnib', 0xffffff, 0.3, 0.15, hx, 0.7, hz + 0.31, 0, { ao: false, tint: false });
  // poster + clock + flag in the classroom
  const hang = ctex(THREE, 'hs:hang', 48, 64, (g) => { g.fillStyle = '#7ab0e8'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#5a3a20'; g.fillRect(4, 6, 40, 3); g.fillStyle = '#f0f0f0'; g.beginPath(); g.arc(24, 24, 9, 0, 7); g.fill(); g.fillRect(19, 9, 3, 10); g.fillRect(26, 9, 3, 10); g.fillStyle = '#111'; g.fillRect(20, 22, 2, 2); g.fillRect(26, 22, 2, 2); g.fillStyle = '#fff'; g.font = 'bold 7px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('HANG IN THERE', 24, 50); g.font = '5px sans-serif'; g.fillText('(it is a cat)', 24, 58); }, { repeat: false });
  B.def('hhang', { kind: 'lambert', map: hang }); framedPicture(B, THREE, 'hhang', 0.5, 0.66, -W / 2 + 0.02, 1.8, -2.4, Math.PI / 2, 0xe0e0e0);
  B.cyl('plain', 0xffffff, 0.2, 0.2, 0.04, -4, 2.75, -D / 2 + 0.03, 16, { ao: false, rx: Math.PI / 2 }); B.cyl('plain', 0x222222, 0.21, 0.21, 0.03, -4, 2.75, -D / 2 + 0.02, 16, { ao: false, rx: Math.PI / 2 });
  for (const [l, a] of [[0.14, 0.5], [0.1, 2.1]]) B.box('plain', 0x111111, 0.012, l, 0.01, -4 + Math.sin(a) * l / 2, 2.75 + Math.cos(a) * l / 2, -D / 2 + 0.06, 0, { ao: false, tint: false, rz: -a });
  B.cyl('shiny', 0xd8b050, 0.01, 0.01, 1.0, -0.4, 2.2, -5.4, 4, { ao: false, rz: 0.6 });
  const flag = ctex(THREE, 'hs:flag', 48, 32, (g) => { for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#fff' : '#c02a2a'; g.fillRect(0, k * 32 / 7, 48, 32 / 7 + 1); } g.fillStyle = '#1e3a8a'; g.fillRect(0, 0, 20, 16); }, { repeat: false });
  B.def('hflag', { kind: 'lambert', map: flag, side: THREE.DoubleSide }); B.quad('hflag', 0xffffff, 0.45, 0.3, -0.55, 2.52, -5.4, Math.PI / 2, { ao: false, tint: false, rz: 0.6 });

  // --- cafeteria (x 0..8, z -6..0): lunch line with sneeze guard and trays, two long tables with benches
  const cx0 = 4, lz = -D / 2 + 0.55;
  B.box('shiny', 0xc8ccd4, 6.4, 0.9, 0.8, cx0, 0.45, lz); B.box('shiny', 0xb0b4bc, 6.5, 0.05, 0.9, cx0, 0.92, lz, 0, { ao: false });
  B.box('glass', 0xffffff, 6.2, 0.04, 0.5, cx0, 1.42, lz + 0.05, 0, { ao: false }); for (const x of [-3, -1, 1, 3]) B.box('shiny', 0xc8ccd4, 0.03, 0.5, 0.03, cx0 + x, 1.18, lz + 0.25, 0, { ao: false });   // sneeze guard
  B.box('shiny', 0xa0a4ac, 6.2, 0.04, 0.3, cx0, 0.8, lz + 0.55, 0, { ao: false });   // tray rail
  const pans = [[0x8a5a3a, 'meat'], [0xf0d040, 'corn'], [0xd8a060, 'tots'], [0xc04030, 'pizza'], [0xe8e0d0, 'potato'], [0x6a9a4a, 'peas']];
  pans.forEach(([c, k], i) => { const x = cx0 - 2.5 + i * 1.0; B.box('shiny', 0xb0b4bc, 0.8, 0.02, 0.5, x, 0.955, lz - 0.05, 0, { ao: false }); B.box('plain', c, 0.74, 0.03, 0.44, x, 0.965, lz - 0.05, 0, { ao: false, tint: false }); if (k === 'tots') for (let j = 0; j < 16; j++) B.box('plain', 0xc88a40, 0.06, 0.04, 0.04, x + (rnd() - 0.5) * 0.6, 0.99, lz - 0.05 + (rnd() - 0.5) * 0.35, rnd() * 3, { ao: false, tint: false }); });
  for (let k = 0; k < 8; k++) B.box('plain', 0x8a6a4a, 0.42, 0.02, 0.32, 0.55, 0.95 + k * 0.025, lz + 0.1, 0, { ao: false, tint: false });   // tray stack
  for (let k = 0; k < 6; k++) { const mx = cx0 + 2.7 + (k % 3) * 0.12, mz = lz + 0.3 + ((k / 3) | 0) * 0.12; B.box('plain', k % 2 ? 0x6a3a20 : 0xffffff, 0.08, 0.12, 0.08, mx, 1.0, mz, 0, { ao: false, tint: false }); }   // milk cartons
  const lunch = ctex(THREE, 'hs:lunch', 256, 64, (g) => { g.fillStyle = '#fff8e0'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#c02a2a'; g.font = 'bold 16px Impact, sans-serif'; g.textAlign = 'center'; g.fillText("TODAY'S LUNCH", 128, 18); g.fillStyle = '#222'; g.font = '11px "Comic Sans MS", cursive, sans-serif'; g.fillText('mystery meat $2 / rectangle pizza $2', 128, 36); g.fillText('tater tots $1 / chocolate milk $1', 128, 52); }, { repeat: false });
  B.def('hlunch', { kind: 'lambert', map: lunch }); B.quad('hlunch', 0xffffff, 2.6, 0.65, cx0, 2.3, -D / 2 + 0.03, 0, { ao: false, tint: false });
  const ltable = (x) => {
    B.box('plain', 0xe8e0c8, 0.8, 0.05, 2.6, x, 0.72, -2.5); B.box('shiny', 0x707880, 0.6, 0.68, 0.05, x, 0.35, -3.5, 0, { ao: false }); B.box('shiny', 0x707880, 0.6, 0.68, 0.05, x, 0.35, -1.5, 0, { ao: false });
    for (const e of [-1, 1]) { B.box('plain', 0x2a5aa8, 0.3, 0.05, 2.6, x + e * 0.6, 0.43, -2.5); B.box('shiny', 0x707880, 0.04, 0.42, 1.8, x + e * 0.6, 0.21, -2.5, 0, { ao: false }); }
  };
  ltable(2.0); ltable(6.0);
  B.box('plain', 0x8a6a4a, 0.42, 0.02, 0.32, 2.05, 0.755, -2.0, 0.2, { ao: false }); B.box('plain', 0x8a5a3a, 0.14, 0.04, 0.1, 2.0, 0.78, -2.0, 0.2, { ao: false, tint: false });   // an abandoned tray
  B.box('plain', 0xffffff, 0.08, 0.12, 0.08, 6.1, 0.8, -3.0, 0, { ao: false, tint: false }); B.sph('plain', 0xff80c0, 0.02, 5.8, 0.75, -2.0, { ao: false, tint: false, ws: 5, hs: 4 });
  B.cyl('plain', 0x4a8a5a, 0.3, 0.27, 0.8, 7.5, 0.4, -0.6, 10); B.cyl('plain', 0x2a5a3a, 0.32, 0.32, 0.05, 7.5, 0.82, -0.6, 10, { ao: false });   // cafeteria bin

  // ceiling tubes: two in the hall, one per back room
  for (const [x, z] of [[-4, 3], [4, 3], [-4, -3], [4, -3]]) tubeLight(B, x, H - 0.1, z, 1.6, 0, 0xf4f8ff);

  const group = B.finish(new THREE.Group());
  cols.push(
    ...segs.map(([a, b]) => ({ kind: 'box', cx: (a + b) / 2, cz: 0, w: b - a, d: WT, rot: 0, h: H })),
    { kind: 'box', cx: 0, cz: -D / 4, w: WT, d: D / 2, rot: 0, h: H },
    { kind: 'box', cx: tx, cz: D / 2 - 0.3, w: 2.25, d: 0.55, rot: 0, h: 2.2 },                  // trophy case
    { kind: 'box', cx: -W / 2 + 0.23, cz: 0.4 + 7 * 0.2, w: 0.46, d: 7 * 0.4, rot: 0, h: 2.0 },   // lockers
    { kind: 'box', cx: W / 2 - 0.23, cz: 0.4 + 8 * 0.2, w: 0.46, d: 8 * 0.4, rot: 0, h: 2.0 },
    { kind: 'box', cx: -W / 2 + 0.25, cz: 3.6, w: 0.5, d: 0.45, rot: 0, h: 1.0 },                // fountain
    { kind: 'box', cx: -2.2, cz: 0.6, w: 0.55, d: 0.55, rot: 0, h: 0.8 },                        // hall bin
    { kind: 'box', cx: tdx, cz: tdz, w: 1.6, d: 0.8, rot: 0, h: 0.8 },                           // teacher's desk
    ...DESKS.map(([x, z]) => ({ kind: 'box', cx: x, cz: z + 0.2, w: 0.6, d: 1.05, rot: 0, h: 0.7 })),
    { kind: 'box', cx: hx, cz: hz, w: 1.0, d: 0.6, rot: 0, h: 1.35 },                            // hamster shelf
    { kind: 'box', cx: cx0, cz: lz, w: 6.5, d: 0.9, rot: 0, h: 1.45 },                           // lunch line
    ...[2.0, 6.0].map((x) => ({ kind: 'box', cx: x, cz: -2.5, w: 1.6, d: 2.6, rot: 0, h: 0.76, top: 0.75 })),
    { kind: 'box', cx: 7.5, cz: -0.6, w: 0.6, d: 0.6, rot: 0, h: 0.85 },
  );
  return {
    group, size: [W, D], cols, floors: [],
    spawn: { x: 0, z: D / 2 - 1.2, yaw: 0 },
    exit: { x: 0, z: D / 2 + 0.05, r: 0.8 },
    lights: [
      { x: -4, y: H - 0.3, z: 3, c: 0xf4f8ff, i: 0.85, always: true },
      { x: 4, y: H - 0.3, z: 3, c: 0xf4f8ff, i: 0.85, always: true },
      { x: -4, y: H - 0.3, z: -3, c: 0xf4f8ff, i: 0.85, always: true },
      { x: 4, y: H - 0.3, z: -3, c: 0xfff4e0, i: 0.85, always: true },
      { x: tx, y: 1.6, z: D / 2 - 0.9, c: 0xffe8a0, i: 0.35, always: true },   // trophy case glow
    ],
    cam: { maxDist: 4.5, height: 2.6 },
    interact: [
      { id: 'locker', x: W / 2 - 0.95, z: 1.9, r: 0.9, label: 'Open a locker' },
      { id: 'locker', x: -W / 2 + 0.95, z: 1.6, r: 0.9, label: 'Open a locker' },
      { id: 'trophy', x: tx, z: D / 2 - 1.1, r: 0.8, label: 'Trophy case' },
      { id: 'fountain', x: -W / 2 + 0.9, z: 3.6, r: 0.6, label: 'Water fountain' },
      { id: 'office', x: -W / 2 + 0.9, z: 4.6, r: 0.6, label: 'Sign in at the office' },
      { id: 'chalkboard', x: -2.8, z: -D / 2 + 1.0, r: 0.8, label: 'Write on the chalkboard' },
      { id: 'hamster', x: hx + 0.2, z: hz + 0.8, r: 0.7, label: 'Mr. Nibbles' },
      { id: 'lunch', x: cx0, z: lz + 1.0, r: 1.2, label: 'Buy lunch' },
    ],
  };
}

// ---------------- hotspots ----------------
const belly = (n) => (HUNGER_ENABLED ? `, +${n} belly` : '');
const MENU = [
  { id: 'meat', label: 'Mystery meat', price: 2, hp: 20, belly: 25, blurb: 'Loretta calls it "Salisbury". The gravy is load-bearing.' },
  { id: 'pizza', label: 'Rectangle pizza', price: 2, hp: 20, belly: 20, blurb: 'The pepperoni is cubes. Nobody knows why. It is perfect.' },
  { id: 'tots', label: 'Tater tots', price: 1, hp: 10, belly: 15, blurb: 'A scoop of tots. You can trade these for anything in this building.' },
  { id: 'milk', label: 'Chocolate milk', price: 1, hp: 10, belly: 10, blurb: 'A little carton. You will knock it over. That is the point.' },
];
const LINES = {
  meat: 'Lunch Lady Loretta slaps it on the tray. "Don\'t ask what it is, hon. I don\'t."',
  pizza: 'Rectangle pizza. You eat the cubes of pepperoni one by one.',
  tots: 'Tater tots. You bat one across the cafeteria. Then eat the rest.',
  milk: 'Chocolate milk. You push the carton off the table, then drink the puddle.',
};
const LOCKER = [
  { cash: 5, text: 'Locker 214: a crumpled $5 bill and a note that says "DO NOT OPEN". Too late. +$5' },
  { cash: 0, hp: 10, text: 'Locker 117: half a peanut butter sandwich. Only a little fuzzy. +10 health' },
  { cash: 0, text: 'Locker 301: a gym sock that could stand up on its own. You hiss at it and close the door.' },
  { cash: 2, text: 'Locker 088: two dollars in quarters and a love note to someone called "Brayden". +$2' },
  { cash: 0, text: 'Locker 156: a hall pass that says "Goobles. Anywhere. Forever." You feel powerful.' },
];
const BOARD = [
  'You write "CATS RULE" on the chalkboard. Then "DOGS DROOL". Then you erase both with your tail.',
  'You draw a fish on the board. It looks like a fish. You are very proud.',
  'You add "1999  Goobles arrives. Everything changes." to the timeline.',
  'You drag one claw down the chalkboard. Somewhere, a teacher shudders.',
];
const FLAVOR = {
  trophy: ['The tallest trophy says "PARTICIPANT". The second tallest also says "PARTICIPANT".', 'A dusty photo of the 1987 team. One of them is definitely a young Gary. Of course he was hall monitor.'],
  fountain: null,
  office: ['You sign in as "MR. CAT". The secretary stamps it without looking up.', 'The sign-in sheet has a pen on a chain. You bat the chain for a solid minute.'],
  hamster: ['Mr. Nibbles stares at you. You stare at Mr. Nibbles. Neither of you blinks. He wins.', 'Mr. Nibbles runs on his wheel faster than you have ever seen anything run. He does not trust you.', 'A sign says do NOT feed Mr. Nibbles to the cat. Rude. Accurate, but rude.'],
};
let A = null;
const S = { bought: {}, lockers: 0, board: 0, drinks: 0 };

export function buy(id) {
  if (!A) return false;
  const it = MENU.find((m) => m.id === id); if (!it) return false;
  if ((A.G.cash || 0) < it.price) { A.Sfx.blip && A.Sfx.blip(180); A.toast('Loretta: "No lunch money, no lunch, sugar. I don\'t make the rules. Well. I make some of them."', 4); return false; }
  A.addCash(-it.price); S.bought[id] = (S.bought[id] || 0) + 1;
  A.G.hp = Math.min(100, (A.G.hp || 0) + it.hp);
  if (A.fishing && A.fishing.feed) A.fishing.feed(it.belly);
  A.Sfx.pickup && A.Sfx.pickup();
  A.toast(`${LINES[id]} +${it.hp} health${belly(it.belly)}. -$${it.price}`, 4);
  return true;
}
function openLunch() {
  if (!A.fishing || !A.fishing.menu) return false;
  return A.fishing.menu({
    title: 'Maple Grove High Cafeteria',
    items: () => MENU.map((m) => ({ id: m.id, label: m.label, price: '$' + m.price, blurb: m.blurb + ` (+${m.hp} health${belly(m.belly)})`, dim: (A.G.cash || 0) < m.price })),
    pick: (it) => buy(it.id),
  });
}
const pickLine = (l) => l[(Math.random() * l.length) | 0];

/** Call once after the interiors and the fishing menu exist. a = { G, places, fishing, toast, addCash, Sfx } */
export function init(a) {
  A = a;
  const p = a.places && a.places.school;
  if (!p || !Number.isFinite(p.x)) { console.warn('[school] places.school missing; the school stays closed'); return false; }
  // places.school = frame(98,-30,0).at(0, 12); the main doors are on the front wall at local (0, 6.55), facing +z
  const door = { x: p.x, z: p.z - 12 + 6.55 };
  const entries = [{ ...door, yaw: 0, kind: 'door' }, ...WINDOWS.map((wx) => ({ x: door.x + wx, z: door.z, yaw: 0, kind: 'window', inside: { x: wx, z: D / 2 - 0.9, yaw: 0 } }))];
  INTR.registerRoom('school', { name: 'Maple Grove High', build: buildSchool }, entries);
  INTR.on('interact', (room, spot) => {
    if (room !== 'school') return false;
    if (spot === 'lunch') {
      if (!openLunch()) return false;
      if (!S.bought.greet) { S.bought.greet = 1; A.toast('Lunch Lady Loretta: "Well, aren\'t you a little cutie. Still gotta pay, though."', 4); }
      return true;
    }
    if (spot === 'locker') {
      const L = LOCKER[S.lockers];
      if (!L) { A.toast('Every locker you can open is empty now. The rest have padlocks. You are a cat, not a locksmith.', 3.5); return true; }
      S.lockers++;
      if (L.cash) A.addCash(L.cash);
      if (L.hp) A.G.hp = Math.min(100, (A.G.hp || 0) + L.hp);
      (L.cash || L.hp) && A.Sfx.pickup && A.Sfx.pickup();
      A.toast(L.text, 4.5); return true;
    }
    if (spot === 'chalkboard') { A.toast(BOARD[S.board++ % BOARD.length], 4); return true; }
    if (spot === 'fountain') {
      S.drinks++; A.G.hp = Math.min(100, (A.G.hp || 0) + 2);
      A.toast(S.drinks === 1 ? 'You press the button and get sprayed in the face. You drink anyway. +2 health' : 'Lukewarm and tastes like pennies. Classic. +2 health', 3.5); return true;
    }
    if (FLAVOR[spot]) { A.toast(pickLine(FLAVOR[spot]), 4); return true; }
    return false;
  });
  window.__G && (window.__G.school = { S, buy, MENU, entries });
  return true;
}
