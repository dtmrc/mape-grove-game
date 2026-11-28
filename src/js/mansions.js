// Maple Grove Estates: the inside of every big house (diet 2026-11-28: "interiors for the expensive mansions in the
// wealthy neighborhood ... what typical high end households usually have").
// One floor plan, 22 x 18 m, ten spaces: grand foyer, great room (fireplace, sectional, piano or pool table), chef's
// kitchen with an island and a breakfast nook, formal dining, home theater, office / library, wine room, primary
// bedroom, spa bath and a walk-in closet. Every house gets its own look from its model (three decor themes), a
// mirrored plan when the house outside is mirrored, and a seed for the art, colours and odds and ends. Gary's
// Beaumont is its own thing.
// Cost: the whole house is ~16 merged meshes (one per material), every lamp is baked into vertex light, all art sits
// in one 1024 px atlas, a house is only built when its door is first used and only the two most recent stay in memory
// (interiors.js `unload`). Nothing runs per frame except a 6-vertex robot vacuum.
// Wired in game.js: MANSIONS.init({ G, places, toast, addCash, Sfx }). Debug: window.__G.mansions.
import * as THREE from 'three';
import * as INTR from './interiors.js';
import { KIT } from './rooms.js';
import { HOUSES } from './houses.js';
import { makeAtlas, plan, parts, zoneLights } from './roomparts.js';

const PI = Math.PI;
const W = 22, D = 18, H = 3.3;

const THEMES = {
  classic: {
    name: 'classic', wall: 0xefe6d4, wallAlt: 0xd8cdb4, accentWall: 0x3a4a5e, wood: 0x4a2f1c, woodLt: 0x7a5232, floorWood: 0xb88a5a, marble: 0xf4f0ea, tile: 0xe8e0d0, carpet: 0xd8cfc0,
    sofa: 0xe4dccb, chair: 0x5a2a2a, metal: 0xc8a860, cab: 0xf2eee6, counter: 0x2a2a2e, stone: 0xd8d0c0, duvet: 0x4a5a7a, accent: 0xa03a3a, rug: ['#7a2a2a', '#e8d8a8', '#2a3a5a'], art: ['land', 'horse', 'portrait', 'land'], trim: 0xf6f2ea, curtain: 0x6a2a2a, theater: 0x3a1a22,
  },
  modern: {
    name: 'modern', wall: 0xf2f0ec, wallAlt: 0xdcdad6, accentWall: 0x3a3e44, wood: 0x2a2a2e, woodLt: 0xc8a878, floorWood: 0xd8bc94, marble: 0xe8e8e8, tile: 0xc8c8c8, carpet: 0xc8c8cc,
    sofa: 0x8a8e94, chair: 0x2a2a2e, metal: 0x2a2a2e, cab: 0xf4f4f2, counter: 0xf0f0f0, stone: 0x5a5e64, duvet: 0xd8d8dc, accent: 0xd88a2a, rug: ['#3a3e44', '#e8e8e8', '#d88a2a'], art: ['abstract', 'abstract', 'abstract', 'land'], trim: 0xfafafa, curtain: 0xc8c8cc, theater: 0x1e2028,
  },
  tuscan: {
    name: 'tuscan', wall: 0xead4a8, wallAlt: 0xd8b888, accentWall: 0x8a4a2a, wood: 0x5a3a22, woodLt: 0x8a6238, floorWood: 0xa87848, marble: 0xe8d8b8, tile: 0xc88a5a, carpet: 0xc8b490,
    sofa: 0xc8a878, chair: 0x6a3a22, metal: 0x3a2a1a, cab: 0x7a5232, counter: 0xd8c8a8, stone: 0xc8b490, duvet: 0x8a3a2a, accent: 0x5a6a2a, rug: ['#8a3a22', '#e8d0a0', '#4a5a2a'], art: ['land', 'land', 'horse', 'map'], trim: 0xf0e4c8, curtain: 0x8a4a2a, theater: 0x3a2018,
  },
  gary: {
    name: 'gary', wall: 0xe8dcc0, wallAlt: 0xd8c8a0, accentWall: 0x5a1a22, wood: 0x3a2014, woodLt: 0x6a4222, floorWood: 0x9a6a3a, marble: 0xf8f4ec, tile: 0xe8e0d0, carpet: 0x7a1a26,
    sofa: 0x7a1a26, chair: 0x7a1a26, metal: 0xe0b840, cab: 0x3a2014, counter: 0xf0e8d8, stone: 0xe8e0d0, duvet: 0x7a1a26, accent: 0xe0b840, rug: ['#7a1a26', '#e0b840', '#2a1a14'], art: ['gary', 'gary', 'gary', 'gary'], trim: 0xf4ecda, crown: 0xe0b840, curtain: 0x7a1a26, theater: 0x2a0e14,
  },
};
const MODEL_THEME = { ashford: 'classic', linden: 'classic', avery: 'classic', harlow: 'modern', kingsley: 'modern', hartwell: 'modern', sevilla: 'tuscan', whitmore: 'tuscan', beaumont: 'gary' };
const FAMILY = ['Ashworth', 'Delacroix', 'Vandermeer', 'Pruitt-Hale', 'Castellano', 'Whitlock', 'Okafor', 'Lindqvist', 'Montgomery', 'Zhao', 'Beauregard', 'Fitzwilliam', 'Hargrove', 'St. Clair', 'Abernathy', 'Kowalczyk', 'Rousseau', 'Thackeray'];

let A = null;                         // { G, places, toast, addCash, Sfx }
const S = { looted: {}, houses: [], visits: 0 };
const say = (lines, t = 4) => A && A.toast(Array.isArray(lines) ? lines[(Math.random() * lines.length) | 0] : lines, t);
const blip = (f) => A && A.Sfx && A.Sfx.blip && A.Sfx.blip(f);

export function floorTextures() {
  const { ctex, grime, rnd } = KIT;
  const wood = ctex(THREE, 'mn:wood', 64, 64, (g) => {
    for (let r = 0; r < 8; r++) for (let k = -1; k < 2; k++) { const v = 222 + ((rnd() * 26) | 0); g.fillStyle = `rgb(${v},${v - 10},${v - 22})`; g.fillRect(k * 64 + ((r * 23) % 64), r * 8, 64, 8); g.fillStyle = 'rgba(60,40,20,0.22)'; g.fillRect(k * 64 + ((r * 23) % 64), r * 8, 0.6, 8); }
    g.fillStyle = 'rgba(60,40,20,0.2)'; for (let r = 0; r < 8; r++) g.fillRect(0, r * 8, 64, 0.5);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(90,60,30,${0.05 + rnd() * 0.08})`; g.fillRect(rnd() * 64, rnd() * 64, 6 + rnd() * 14, 0.6); }
  });
  const tile = ctex(THREE, 'mn:tile', 64, 64, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const v = (x + y) % 2 ? 236 : 250; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * 32, y * 32, 32, 32); }
    g.strokeStyle = 'rgba(150,150,160,0.09)'; g.lineWidth = 1.6; for (let i = 0; i < 6; i++) { g.beginPath(); let x = rnd() * 64, y = rnd() * 64; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 22; y += (rnd() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(120,115,110,0.5)'; g.fillRect(0, 0, 64, 0.8); g.fillRect(0, 32, 64, 0.8); g.fillRect(0, 0, 0.8, 64); g.fillRect(32, 0, 0.8, 64);
  });
  const plaster = ctex(THREE, 'mn:plaster', 64, 64, (g) => { g.fillStyle = '#fbfaf8'; g.fillRect(0, 0, 64, 64); grime(g, 64, 64, 260, 0.035); grime(g, 64, 64, 120, 0.05, false); });
  const night = ctex(THREE, 'mn:night', 64, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#0a1024'); gr.addColorStop(0.7, '#1a2440'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#0c1410'; g.fillRect(0, 44, 64, 20); for (let x = 0; x < 64; x += 5) { g.beginPath(); g.arc(x, 44, 4, 0, 7); g.fill(); }
    g.fillStyle = '#ffe8a0'; g.fillRect(12, 36, 3, 3); g.fillRect(44, 34, 3, 3); g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) g.fillRect(rnd() * 64, rnd() * 30, 0.8, 0.8);
  }, { repeat: false });
  return { wood, tile, plaster, night };
}

/** spec = { id, model, mirror, seed, family, gary } */
function buildMansion(spec, ctx) {
  const { T } = ctx;
  const { makeBuilder, rnd, pick } = KIT;
  KIT.reseed(1000 + spec.seed * 7919);
  const th = THEMES[spec.gary ? 'gary' : MODEL_THEME[spec.model] || 'classic'], gary = !!spec.gary;
  const mx = spec.mirror ? -1 : 1;
  const B = makeBuilder(THREE, T), tex = floorTextures(), atlas = makeAtlas(THREE, 1024), lights = [];
  B.def('pwall', { kind: 'lambert', map: tex.plaster }); B.def('fwood', { kind: 'lambert', map: tex.wood }); B.def('ftile', { kind: 'lambert', map: tex.tile });
  B.def('night', { kind: 'basic', map: tex.night }); B.def('mirror', { kind: 'phong', shininess: 120, specular: 0xffffff });
  B.def('atlas', { kind: 'lambert', map: atlas.tex }); B.def('aglow', { kind: 'basic', map: atlas.tex });

  // ---- the plan (mirrored houses flip x)
  const rect = (x0, x1, z0, z1, o) => ({ x0: mx > 0 ? x0 : -x1, x1: mx > 0 ? x1 : -x0, z0, z1, ...o });
  const wx = (x, from, to, doors) => ({ x: mx * x, from, to, doors });
  const wz = (z, from, to, doors) => ({ z, from: mx > 0 ? from : -to, to: mx > 0 ? to : -from, doors: (doors || []).map((d) => ({ ...d, at: mx * d.at })) });
  const dark = th.theater;
  const rooms = [
    rect(-3, 3, 4, 9, { floor: 'ftile', fcol: th.marble, ftile: 1.6, wall: th.wall, wains: { c: th.trim, y: 1.0 } }),                 // foyer
    rect(-5, 5, -9, 4, { floor: 'fwood', fcol: th.floorWood, ftile: 1.3, wall: th.wall }),                                              // great room
    rect(5, 11, -9, -1, { floor: 'ftile', fcol: th.tile, ftile: 1.2, wall: th.wallAlt }),                                               // kitchen
    rect(5, 11, -1, 4, { floor: 'fwood', fcol: th.floorWood, ftile: 1.3, wall: th.accentWall, wains: { c: th.trim, y: 1.0 } }),      // dining
    rect(3, 11, 4, 9, { floor: 'cloth', fcol: gary ? 0x5a1a22 : 0x3a2a3a, ftile: 0.8, wall: dark, ceil: 0x16141a, base: 0x1a1a1e }),   // theater
    rect(-11, -3, 4, 9, { floor: 'fwood', fcol: th.wood === 0x2a2a2e ? th.floorWood : 0x8a5a36, ftile: 1.3, wall: gary ? 0x5a1a22 : th.name === 'modern' ? th.wallAlt : 0x3a4a3e, wains: th.name === 'modern' ? null : { c: th.wood, y: 1.1, rail: th.woodLt }, base: th.name === 'modern' ? undefined : th.wood }),   // office
    rect(-11, -5, 0.5, 4, { floor: 'ftile', fcol: 0x6a5a4a, ftile: 0.9, wall: 0x8a7458, ceil: 0x5a4a3a, base: 0x3a2a1e }),            // wine room
    rect(-11, -8, -3, 0.5, { floor: 'ftile', fcol: th.marble, ftile: 0.8, wall: th.name === 'tuscan' ? 0xe8d8b8 : 0xe4ecec, wains: { c: 0xf4f2ee, y: 1.2 } }),   // bath
    rect(-8, -5, -3, 0.5, { floor: 'cloth', fcol: th.carpet, ftile: 0.8, wall: th.wall }),                                              // closet
    rect(-11, -5, -9, -3, { floor: 'cloth', fcol: th.carpet, ftile: 0.8, wall: th.wallAlt }),                                           // bedroom
  ];
  const walls = [
    wx(-5, -9, 4, [{ at: -6, w: 1.2 }, { at: 2.3, w: 1.1 }]),
    wx(5, -9, 4, [{ at: -5, w: 4.4, h: 2.7 }, { at: 1.5, w: 1.8, h: 2.5 }]),
    wz(4, -11, -3), wz(4, 3, 11),
    wx(-3, 4, 9, [{ at: 6.5, w: 1.2 }]), wx(3, 4, 9, [{ at: 6.5, w: 1.4 }]),
    wz(-3, -11, -5, [{ at: -9.5, w: 0.9 }, { at: -6.5, w: 0.9 }]),
    wz(0.5, -11, -5), wx(-8, -3, 0.5),
    wz(-1, 5, 11, [{ at: 6.4, w: 2.0, h: 2.5 }]),
  ];
  const { cols } = plan(B, THREE, { w: W, d: D, h: H, rooms, walls, doors: [{ x: 0, w: 1.8, h: 2.5 }], base: th.trim, crown: th.crown ?? th.trim, trim: th.trim, wallTile: 2.2 });
  const P = parts({ B, THREE, cols, A: atlas, lights, rnd, pick });
  // mirrored placement: m('sofa', x, z, ry, opts) / wall things with a y: mw('picture', x, y, z, ry, ...)
  const m = (fn, x, z, ry = 0, ...rest) => P[fn](mx * x, z, mx * ry, ...rest);
  const mw = (fn, x, y, z, ry, ...rest) => P[fn](mx * x, y, z, mx * ry, ...rest);
  const mf = (x, z, ry = 0) => P.at(mx * x, z, mx * ry);
  const art = (k) => (gary ? garyPic(atlas, k) : P.paintTex(spec.id + ':' + k, th.art[k % th.art.length], k % 2 ? 72 : 96, k % 2 ? 96 : 72));
  const hot = [];
  const spot = (id, x, z, r, label, onUse) => hot.push({ id, x: mx * x, z, r, label, onUse });
  const metal = th.metal, FAM = spec.family;

  // ============================================================ foyer
  {
    for (const e of [-1, 1]) { const F = P.at(e * 0.45, D / 2 - 0.02, PI); F.box('wood', th.wood, 0.88, 2.46, 0.06, 0, 1.23, 0); for (const y of [0.6, 1.75]) F.box('wood', th.woodLt, 0.6, y < 1 ? 0.8 : 1.0, 0.02, 0, y, 0.035); F.box('shiny', metal, 0.03, 0.3, 0.05, -e * 0.34, 1.1, 0.06); }
    for (const e of [-1, 1]) { P.window(e * 1.45, 1.35, D / 2 - 0.001, PI, 0.45, 2.1, { mull: 0, trim: th.trim }); P.sconce(e * 2.15, 1.9, D / 2 - 0.01, PI, { metal, i: 0.3 }); }
    const med = atlas.region('medallion', 128, 128, (g) => {
      g.fillStyle = '#f4f0ea'; g.fillRect(-1, -1, 130, 130); const c1 = gary ? '#7a1a26' : th.rug[0], c2 = gary ? '#e0b840' : th.rug[2];
      g.fillStyle = c2; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.fillStyle = '#f4f0ea'; g.beginPath(); g.arc(64, 64, 55, 0, 7); g.fill();
      for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? c1 : c2; g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 52, k * PI / 8, (k + 0.5) * PI / 8); g.fill(); }
      g.fillStyle = '#f4f0ea'; g.beginPath(); g.arc(64, 64, 20, 0, 7); g.fill(); g.fillStyle = c1; g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(gary ? 'G' : FAM[0], 64, 66);
    });
    P.rug(0, 6.4, 0, 3.0, 3.0, med);
    if (gary) {   // a gold statue of Gary where other people keep flowers
      B.cyl('shiny', 0xf4f0e8, 0.45, 0.5, 0.7, 0, 0.35, 6.4, 12, { ao: false }); cols.push({ kind: 'box', cx: 0, cz: 6.4, w: 0.9, d: 0.9, rot: 0, h: 2.4 });
      const F = P.at(0, 6.4, 0); F.box('shiny', 0xe0b840, 0.4, 0.6, 0.24, 0, 1.45, 0); for (const e of [-1, 1]) { F.box('shiny', 0xe0b840, 0.15, 0.5, 0.17, e * 0.11, 0.95, 0); F.box('shiny', 0xe0b840, 0.1, 0.5, 0.12, e * 0.26, 1.5, 0.02, 0, { rz: e * -0.5 }); } F.rbox('shiny', 0xe0b840, 0.26, 0.28, 0.24, 0, 1.92, 0, 0, { round: 0.05 }); F.box('shiny', 0xe0b840, 0.5, 0.04, 0.12, 0.2, 1.84, 0.1, 0, { rz: 0.5 });
      P.decal(F, atlas.label('statue', ['GARY', 'HOA PRESIDENT', 'A GIFT FROM GARY'], '#2a1a14', '#e0b840', 96, 48, { small: true, font: 'serif' }), 0.5, 0.25, 0, 0.4, 0.5);
      spot('statue', 0, 7.3, 0.8, 'Admire the statue', () => say(['Solid gold paint. The plaque says "A GIFT FROM GARY". It is in Gary\'s house.', 'The statue is holding a clipboard. Of course it is.']));
    } else {
      P.table(0, 6.4, 0, { round: true, w: 1.1, h: 0.78, wood: th.wood });
      P.vase(0, 0.78, 6.4, pick([0x3a6a9a, 0xe8e4dc, 0x2a2a2e]), pick([0xe85a7a, 0xf4f0e0, 0xe8a020]));
      for (let k = 0; k < 3; k++) B.box('plain', pick([0x7a2a2a, 0x2a4a6a, 0xc8b890]), 0.26, 0.035, 0.2, 0.25, 0.8 + k * 0.036, 6.2, k * 0.3, { ao: false, round: false });
    }
    P.chandelier(0, 6.4, H, 2.45, { r: 0.6, metal, n: 9 });
    m('console', 2.7, 4.95, -PI / 2, { w: 1.3, wood: th.wood });
    { const F = mf(2.89, 4.95, -PI / 2); F.box('wood', metal, 0.9, 1.2, 0.03, 0, 1.75, 0); F.quad('mirror', 0xb8c8d4, 0.78, 1.08, 0, 1.75, 0.02); }
    P.tableLamp(mx * 2.7, 0.82, 4.5, { base: metal, i: 0.25 }); P.vase(mx * 2.7, 0.82, 5.4, 0xe8e4dc, null);
    m('ottoman', -2.6, 8.1, PI / 2, { w: 1.2, d: 0.45, col: th.chair });
    mw('picture', -2.89, 1.75, 4.95, PI / 2, 0.9, 0.7, art(0), gary ? 0xe0b840 : th.wood);
    P.plant(mx * 2.5, 8.5, { kind: 'palm', pot: th.name === 'modern' ? 0x2a2a2e : 0xe8e4dc }); P.plant(mx * -2.5, 4.6, { kind: 'fig' });
    for (const e of [-1, 1]) P.column(e * 2.72, 4.0, H, { col: th.trim });
    for (const z of [5.0, 8.0]) P.can(0, z, H, 0.35);
  }

  // ============================================================ great room
  {
    P.coffer(-4.9, 4.9, -8.9, 3.9, H, { col: th.name === 'tuscan' ? th.wood : th.trim, key: th.name === 'tuscan' ? 'wood' : 'plain', nx: 4, nz: 5 });
    P.fireplace(0, -8.75, 0, { w: 2.4, H, stone: th.stone, mantel: th.wood, key: 'pwall' });
    P.tv(0, -8.5, 0, { w: 1.5, y: 2.15, console: false, screen: tvTex(atlas, gary) });
    for (const e of [-1, 1]) P.window(e * 3.3, 1.6, -D / 2 + 0.001, 0, 1.5, 2.3, { curtain: th.curtain, floor: true, trim: th.trim, rod: metal });
    for (let k = 0; k < 3; k++) { P.vase(-0.8 + k * 0.8, 1.35, -8.45, pick([0xe8e4dc, 0x3a6a9a, metal]), null); }
    P.rug(0, -5.3, 0, 4.6, 3.3, P.rugTex('great', th.rug[0], th.rug[1], th.rug[2]));
    m('sectional', 0, -3.5, PI, { w: 3.2, col: th.sofa, side: 1, pillows: [th.accent, th.duvet] });
    m('armchair', -2.75, -5.6, PI / 2, { col: th.chair, pillow: th.sofa }); m('armchair', 2.75, -6.4, -PI / 2, { col: th.chair, pillow: th.sofa });
    P.table(0, -5.5, 0, { w: 1.4, d: 0.8, h: 0.42, shelf: true, wood: th.wood, key: th.name === 'modern' ? 'shiny' : 'wood' });
    { const F = P.at(0, -5.5, 0); for (let k = 0; k < 3; k++) F.box('plain', pick([0x7a2a2a, 0x2a4a6a, 0xe8e0d0]), 0.3, 0.035, 0.22, -0.4, 0.44 + k * 0.036, 0.1, k * 0.25); F.cyl('shiny', metal, 0.14, 0.09, 0.07, 0.3, 0.455, -0.1, 10); F.box('plain', 0x2a2a2e, 0.16, 0.02, 0.05, 0.1, 0.43, 0.25, 0.4); }
    m('console', 0, -2.9, PI, { w: 2.2, wood: th.wood });
    for (const e of [-1, 1]) P.tableLamp(e * 0.85, 0.82, -2.9, { base: metal, i: 0.3 });
    for (const e of [-1, 1]) { m('table', e * 1.95, -3.5, 0, { w: 0.5, d: 0.5, h: 0.55, wood: th.wood }); }
    if (spec.seed % 2 === 0 || gary) {
      m('piano', -2.6, 1.3, 0.5);
      spot('piano', -2.2, 2.3, 1.0, 'Walk on the piano', () => { [523, 440, 659, 392].forEach((f, i) => setTimeout(() => blip(f + ((Math.random() * 60) | 0)), i * 130)); say(['Plink. Plonk. PLONK. A masterpiece, performed on a ninety-thousand-dollar instrument.', 'You walk down the keys from low to high. Somewhere a music teacher feels a chill.']); });
    } else {
      m('poolTable', -2.3, 1.4, 0);
      spot('pool', -2.3, 2.6, 1.0, 'Bat a pool ball', () => { blip(700); say(['You bat the eight ball into the corner pocket. Then the cue ball. Then you just keep going.', 'Clack. The balls scatter. You watch them all the way to a stop.']); });
    }
    mw('picture', -4.89, 1.85, -2.2, PI / 2, 1.5, 1.1, art(1), gary ? 0xe0b840 : th.wood);
    mw('picture', 4.89, 1.85, -1.3, -PI / 2, 1.1, 1.4, art(2), gary ? 0xe0b840 : th.wood);
    P.plant(mx * 4.4, 3.3, { kind: 'fig', s: 1.15 }); P.plant(mx * -4.4, -8.3, { kind: 'palm' }); P.floorLamp(mx * 4.3, -8.2, { metal });
    P.chandelier(0, -5.3, H, 2.55, { r: 0.75, metal, n: 10, i: 1.2 });
    for (const [x, z] of [[-3, -1], [3, -1], [-2.5, 2.2], [2.5, 2.2]]) P.can(mx * x, z, H, 0.4);
    spot('couch', 0, -4.4, 0.9, 'Knead the sofa', () => say(['You knead the sectional. It costs more than your RV. You knead harder.', 'You leave a perfect layer of white fur on the ' + (gary ? 'burgundy velvet. Gary will find it. Gary will KNOW.' : 'cushions. Signed, Goobles.')]));
    spot('fire', 0, -7.5, 0.9, 'Warm up by the fire', () => { if (A) A.G.hp = Math.min(100, (A.G.hp || 0) + 10); say('You loaf in front of the gas fireplace until your belly is hot. +10 health.'); });
  }

  // ============================================================ kitchen
  {
    const cab = th.cab, top = th.counter, pull = th.name === 'modern' ? 0x2a2a2e : metal;
    m('cabinets', 6.35, -8.68, 0, { w: 2.1, col: cab, top, upper: true, splash: 0xe8e4dc, pull });
    m('cabinets', 9.75, -8.68, 0, { w: 2.3, col: cab, top, upper: true, splash: 0xe8e4dc, pull });
    m('range', 8.0, -8.66, 0, { w: 1.2, H, hoodCol: th.name === 'tuscan' ? 0xb8742a : 0xc8ccd4 });
    B.quad('plain', 0xe8e4dc, 1.2, 1.4, mx * 8.0, 1.6, -D / 2 + 0.012, 0, { ao: false, tint: false });
    m('fridge', 10.63, -6.9, -PI / 2, { panel: true });
    const run = m('cabinets', 10.68, -4.75, -PI / 2, { w: 3.0, col: cab, top, upper: true, splash: 0xe8e4dc, pull });
    { const F = run; F.box('shiny', 0x2a2a2e, 0.28, 0.36, 0.3, -1.0, 1.08, 0); F.box('shiny', 0xc8ccd4, 0.1, 0.1, 0.1, -1.0, 0.95, 0.1); F.rbox('shiny', 0xc8ccd4, 0.34, 0.2, 0.22, -0.3, 1.0, 0); F.cyl('wood', 0x8a6238, 0.11, 0.11, 0.24, 0.5, 1.02, -0.05, 8); for (let k = 0; k < 5; k++) F.box('plain', 0x2a2a2e, 0.015, 0.1, 0.03, 0.45 + k * 0.025, 1.19, -0.05, 0, { rx: 0.2 }); F.cyl('shiny', 0xe8e4dc, 0.09, 0.09, 0.2, 1.1, 1.0, 0, 8); }
    const isl = m('island', 7.45, -5.6, -PI / 2, { w: 2.8, d: 1.25, col: th.name === 'modern' ? 0x2a2a2e : th.name === 'classic' ? 0x3a4a5e : cab, top, sink: -0.6, pull, stool: { seat: th.chair, metal: th.name === 'classic' || gary ? 0xc8a860 : 0x2a2a2e } });
    { const F = isl; F.box('wood', 0x8a6238, 0.4, 0.03, 0.28, 0.35, 0.94, 0.1, 0.2); F.box('shiny', 0xd8dce4, 0.02, 0.012, 0.2, 0.35, 0.96, 0.1, 0.9); }
    for (const dz of [-0.9, 0, 0.9]) P.pendant(mx * 7.45, -5.6 + dz, H, 2.25, { globe: th.name !== 'tuscan', shade: metal, i: 0.3, r: 0.12 });
    // breakfast nook by the window
    m('table', 9.6, -2.3, 0, { round: true, w: 1.1, h: 0.76, wood: th.woodLt });
    for (const [dx, dz, r] of [[0.85, 0, -PI / 2], [-0.6, 0.6, 2.4], [0.2, -0.85, 0]]) m('chair', 9.6 + dx, -2.3 + dz, r, { wood: th.wood, seat: th.sofa, solid: false });
    P.vase(mx * 9.6, 0.76, -2.3, 0xe8e4dc, 0xe8a020);
    mw('window', 10.999, 1.7, -2.3, -PI / 2, 1.6, 1.3, { trim: th.trim });
    mw('picture', 5.11, 1.8, -8.2, PI / 2, 0.5, 0.7, atlas.label('eat', gary ? ['RULE 14:', 'NO CRUMBS'] : ['EAT', '~ est. ' + (1990 + spec.seed) + ' ~'], '#f4f0e8', '#2a2a2e', 72, 96, { font: 'serif', small: true }), th.wood);
    for (const z of [-7.4, -3.2]) P.can(mx * 9.2, z, H, 0.45); P.can(mx * 6.0, -2.0, H, 0.35);
    spot('fridge', 9.8, -6.9, 0.8, 'Raid the fridge', () => {
      if (A) A.G.hp = Math.min(100, (A.G.hp || 0) + 35); A && A.Sfx.pickup && A.Sfx.pickup();
      say(gary ? ['Labelled leftovers. "GARY\'S. DO NOT TOUCH. THIS MEANS YOU, DOUG." You eat Gary\'s salmon. +35 health.', 'A shelf of sparkling water and one sad kale salad. You find the smoked salmon behind it. +35 health.']
        : ['Smoked salmon, a wheel of brie and something called "burrata". You eat all of it standing in the fridge. +35 health.', 'Leftover lobster in a takeout box with a swan folded out of foil. You eat the lobster. You keep the swan. +35 health.']);
    });
    spot('stove', 8.0, -7.6, 0.7, 'Sniff the stove', () => say(['A six-burner range that has clearly never cooked anything but boxed mac and cheese.', 'The copper pot is decorative. You check. Yes. Decorative.']));
    spot('island', 6.3, -5.6, 0.8, 'Jump on the island', () => say(['You sit in the exact middle of the marble island. This is where a cat goes. Everybody knows that.', 'You push a lemon off the counter. Then another. The fruit bowl is now a to-do list.']));
  }

  // ============================================================ dining room
  {
    P.rug(mx * 8.3, 1.6, 0, 4.4, 2.9, P.rugTex('dining', th.rug[2], th.rug[1], th.rug[0]));
    m('dining', 8.3, 1.6, 0, { w: 3.0, d: 1.15, n: 4, wood: th.wood, chair: { wood: th.wood, seat: th.sofa, uph: true } });
    { const F = P.at(mx * 8.3, 1.6, 0); for (const e of [-1, 1]) { F.cyl('shiny', metal, 0.03, 0.06, 0.3, e * 0.5, 0.91, 0, 6); F.cyl('plain', 0xf4f0e0, 0.012, 0.012, 0.18, e * 0.5, 1.14, 0, 5); } F.cyl('shiny', 0xe8e4dc, 0.2, 0.1, 0.1, 0, 0.81, 0, 10); for (let k = 0; k < 5; k++) F.sph('plain', pick([0xd03030, 0x8ab030, 0xe8a020]), 0.06, Math.sin(k * 1.3) * 0.09, 0.9, Math.cos(k * 1.3) * 0.09); }
    P.chandelier(mx * 8.3, 1.6, H, 2.2, { r: 0.55, metal, n: 8, tiers: 1, i: 1.0 });
    const sb = m('dresser', 8.6, 3.62, PI, { w: 2.1, h: 0.9, wood: th.wood, cols: 3, rows: 2, pull: metal });
    for (const e of [-1, 1]) P.tableLamp(mx * (8.6 + e * 0.8), 0.92, 3.62, { base: metal, i: 0.2 });
    sb.cyl('shiny', 0xc8ccd4, 0.12, 0.08, 0.2, 0, 1.02, 0, 8); sb.cyl('shiny', 0xc8ccd4, 0.16, 0.16, 0.015, 0, 0.93, 0, 10);
    mw('picture', 8.6, 2.0, 3.89, PI, 1.5, 0.9, art(3), gary ? 0xe0b840 : th.wood);
    m('bookcase', 9.9, -0.72, 0, { w: 1.5, h: 2.2, wood: th.wood, n: 4 });
    for (const z of [0.3, 2.9]) mw('window', 10.999, 1.7, z, -PI / 2, 1.3, 1.9, { curtain: th.curtain, floor: true, trim: th.trim, rod: metal });
    spot('dinner', 8.3, 0.4, 0.9, 'Sit at the head of the table', () => say(['Seating for ten. Place settings for ten. Nobody has eaten in here since 2019.', 'You sit at the head of the table and wait to be served. Any minute now.']));
  }

  // ============================================================ home theater
  {
    const scr = atlas.region('movie', 160, 90, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 90); gr.addColorStop(0, '#1a2a5a'); gr.addColorStop(0.6, '#e87a3a'); gr.addColorStop(1, '#2a1a1a'); g.fillStyle = gr; g.fillRect(-1, -1, 162, 92);
      g.fillStyle = '#f8e8a0'; g.beginPath(); g.arc(112, 50, 12, 0, 7); g.fill(); g.fillStyle = '#141018'; g.beginPath(); g.moveTo(-1, 91); g.lineTo(-1, 66); g.lineTo(40, 58); g.lineTo(80, 70); g.lineTo(120, 62); g.lineTo(161, 72); g.lineTo(161, 91); g.fill();
      g.fillRect(46, 40, 10, 22); g.beginPath(); g.arc(51, 37, 5, 0, 7); g.fill(); g.beginPath(); g.moveTo(47, 33); g.lineTo(48, 27); g.lineTo(51, 32); g.lineTo(54, 27); g.lineTo(55, 33); g.fill();   // a cat-eared hero
      g.fillStyle = '#000'; g.fillRect(-1, -1, 162, 9); g.fillRect(-1, 82, 162, 9); g.fillStyle = '#fff'; g.font = '6px sans-serif'; g.textAlign = 'center'; g.fillText(gary ? '"...and THAT is why hedges matter."' : '"We ride at dawn, Whiskers."', 80, 88);
    });
    const F = mf(10.96, 6.5, -PI / 2);
    F.box('plain', 0x0a0a0c, 3.9, 2.2, 0.05, 0, 1.75, 0); P.decal(F, scr, 3.7, 2.08, 0, 1.75, 0.03, 0, 'aglow');
    for (const e of [-1, 1]) { F.rbox('plain', 0x1a1a1e, 0.34, 1.2, 0.3, e * 2.15, 0.6, 0.18); F.cyl('plain', 0x2a2a30, 0.1, 0.1, 0.02, e * 2.15, 0.85, 0.34, 10, { rx: PI / 2 }); F.cyl('plain', 0x2a2a30, 0.06, 0.06, 0.02, e * 2.15, 0.45, 0.34, 8, { rx: PI / 2 }); }
    F.rbox('plain', 0x1a1a1e, 1.2, 0.2, 0.26, 0, 0.42, 0.16);
    lights.push({ x: mx * 9.6, y: 1.8, z: 6.5, c: 0xffa870, i: 0.75, halo: false });
    for (const z of [5.4, 6.5, 7.6]) m('recliner', 7.9, z, PI / 2, { col: gary ? 0x5a1a22 : 0x2a2a30, foot: z === 6.5 });
    for (const z of [5.95, 7.05]) m('recliner', 5.9, z, PI / 2, { col: gary ? 0x5a1a22 : 0x2a2a30 });
    { const G2 = mf(8.0, 8.2, 0); G2.cyl('plain', 0xe8e0c8, 0.12, 0.09, 0.2, 0, 0.1, 0, 8); for (let k = 0; k < 7; k++) G2.sph('plain', 0xf8f0d0, 0.04, Math.sin(k * 2) * 0.07, 0.22 + (k % 2) * 0.03, Math.cos(k * 2) * 0.07, { ws: 4, hs: 3 }); }
    // popcorn cart, candy, posters, projector, star ceiling
    const C = mf(3.6, 8.4, PI / 2);
    C.rbox('plain', 0xc02020, 0.6, 0.8, 0.5, 0, 0.5, 0); C.box('glass', 0xfff8e0, 0.56, 0.6, 0.46, 0, 1.2, 0); C.box('plain', 0xc02020, 0.64, 0.08, 0.54, 0, 1.54, 0); C.box('glow', 0xffd060, 0.3, 0.12, 0.3, 0, 1.0, 0, 0, { tint: false });
    for (let k = 0; k < 14; k++) C.sph('plain', 0xf8f0d0, 0.05, (rnd() - 0.5) * 0.4, 0.95 + rnd() * 0.12, (rnd() - 0.5) * 0.3, { ws: 4, hs: 3 }); for (const e of [-1, 1]) C.cyl('plain', 0x1a1a1e, 0.12, 0.12, 0.04, e * 0.25, 0.12, 0.27, 8, { rx: PI / 2 });
    P.decal(C, atlas.label('pop', ['POPCORN'], '#c02020', '#ffe080', 96, 24), 0.5, 0.12, 0, 1.54, 0.275); C.col(0, 0, 0.6, 0.5, 1.6);
    lights.push({ x: mx * 3.9, y: 1.3, z: 8.4, c: 0xffd080, i: 0.25, halo: false });
    const poster = (k, t1, t2, c1, c2) => atlas.region('poster' + k, 64, 96, (g) => { g.fillStyle = c1; g.fillRect(-1, -1, 66, 98); g.fillStyle = c2; g.beginPath(); g.arc(32, 40, 20, 0, 7); g.fill(); g.fillStyle = c1; g.beginPath(); g.arc(40, 34, 17, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 11px Impact, sans-serif'; g.textAlign = 'center'; g.fillText(t1, 32, 78, 58); g.font = '6px sans-serif'; g.fillText(t2, 32, 89, 58); });
    const posters = gary ? [['BYLAWS', 'the director\'s cut', '#2a1a14', '#e0b840'], ['12 ANGRY', 'HOMEOWNERS', '#5a1a22', '#f4f0e8'], ['THE LAWN', 'it must be 2.5 inches', '#1a3a1a', '#e0b840']] : [['NINE LIVES', 'he used eight', '#1a1a3a', '#e8c040'], ['THE RACCOON', 'KING', '#2a1a1a', '#d04a2a'], ['MOONPAW', 'part III', '#0a2a3a', '#c8e0f0']];
    posters.forEach(([a, b, c1, c2], k) => { const G3 = mf(4.6 + k * 1.9, 4.11, 0); G3.box('plain', 0x1a1a1e, 0.74, 1.08, 0.03, 0, 1.75, 0.015); P.decal(G3, poster(k, a, b, c1, c2), 0.68, 1.02, 0, 1.75, 0.034, 0, 'aglow'); });
    { const G4 = mf(5.2, 6.5, PI / 2); G4.box('plain', 0x1a1a1e, 0.4, 0.16, 0.44, 0, H - 0.3, 0); G4.cyl('plain', 0x2a2a30, 0.03, 0.03, 0.22, 0, H - 0.11, 0, 6); G4.cyl('glow', 0xc0e0ff, 0.05, 0.05, 0.04, 0, H - 0.3, 0.23, 8, { rx: PI / 2, tint: false }); }
    for (let k = 0; k < 46; k++) B.box('glow', k % 5 ? 0xfff4d8 : 0xa0c8ff, 0.02, 0.006, 0.02, mx * (3.3 + rnd() * 7.4), H - 0.004, 4.3 + rnd() * 4.4, 0, { ao: false, round: false, tint: false });
    for (const z of [4.11, 8.89]) for (const x of [7.4, 9.6]) mw('sconce', x, 1.9, z < 6 ? z : 8.99, z < 6 ? 0 : PI, { metal: 0x2a2a2e, i: z < 6 && x < 8 ? 0.22 : 0 });
    lights.push({ x: mx * 5.2, y: 2.6, z: 7.6, c: 0xffd0a0, i: 0.25, halo: false });
    spot('movie', 7.0, 6.5, 0.9, 'Watch the movie', () => say(gary ? ['It is a recording of the last HOA meeting. All four hours. Gary has added a laugh track to his own jokes.', 'On screen, Gary points at a slide titled "ACCEPTABLE SHADES OF BEIGE". There are two.'] : ['A cowboy cat squints into a sunset. You have seen this one. He does not get the fish.', 'You watch from the best recliner. The cup holder fits a whole cat paw. Luxury.']));
    spot('popcorn', 4.4, 8.3, 0.7, 'Eat popcorn', () => { if (A) A.G.hp = Math.min(100, (A.G.hp || 0) + 8); say('You stick your whole head in the popcorn machine. +8 health. Butter on the ears.'); });
  }

  // ============================================================ office / library
  {
    m('bookcase', -10.82, 6.5, PI / 2, { w: 4.6, h: 2.7, wood: th.wood, fill: 'books', n: 6 });
    m('bookcase', -8.6, 4.28, 0, { w: 2.4, h: 2.7, wood: th.wood, n: 6 });
    P.rug(mx * -6.9, 6.3, 0, 3.6, 2.6, P.rugTex('office', th.rug[2], th.rug[1], th.rug[0]));
    const dk = m('desk', -7.6, 6.3, PI / 2, { w: 1.9, wood: th.wood, screen: gary ? atlas.label('xls', ['VIOLATIONS.XLS', 'RV on lot 1 ...... 412', 'cat (white) ...... 98', 'Doug .................. 3'], '#f4f8f4', '#1a3a1a', 128, 72, { font: 'monospace', small: true, weight: 'normal' }) : atlas.label('stocks', ['PORTFOLIO', '+ 4.2%  ^^^', 'fish futures up'], '#0a1a2a', '#40e080', 128, 72, { font: 'monospace', small: true }) });
    dk.box('shiny', 0xc8a860, 0.06, 0.22, 0.06, -0.7, 0.9, 0.2); dk.box('glow', 0x40a060, 0.3, 0.08, 0.12, -0.7, 1.04, 0.2, 0, { tint: false }); lights.push({ x: mx * -7.5, y: 1.1, z: 5.6, c: 0xd8ffd8, i: 0.2, halo: false });
    m('officeChair', -8.45, 6.3, PI / 2, { col: th.chair, tall: true });
    for (const z of [5.75, 6.85]) m('armchair', -6.2, z, -PI / 2, { col: th.chair, w: 0.85 });
    // the painting on the back wall hides the safe
    mw('picture', -4.6, 1.7, 4.11, 0, 1.0, 0.8, art(4), gary ? 0xe0b840 : th.woodLt);
    { const F = mf(-4.0, 4.9, 0); F.cyl('wood', th.wood, 0.03, 0.2, 0.7, 0, 0.35, 0, 6); F.sph('plain', 0x3a6a9a, 0.24, 0, 0.95, 0, { ws: 10, hs: 7 }); F.add(new THREE.TorusGeometry(0.27, 0.012, 4, 14), 'shiny', metal, 0, 0.95, 0, 0, { tint: false, rx: 0.4 }); for (let k = 0; k < 5; k++) F.sph('plain', 0x5a8a4a, 0.09, Math.sin(k * 1.9) * 0.17, 0.95 + Math.cos(k * 2.3) * 0.12, Math.cos(k * 1.9) * 0.17, { ws: 5, hs: 4, s: [1, 0.8, 1] }); F.col(0, 0, 0.5, 0.5, 1.2); }
    for (const x of [-9.2, -5.4]) mw('window', x, 1.7, D / 2 - 0.001, PI, 1.4, 1.9, { curtain: th.curtain, floor: true, trim: th.trim, rod: metal });
    P.floorLamp(mx * -3.5, 8.5, { metal }); P.plant(mx * -10.5, 8.5, { kind: 'fig' });
    if (gary) {
      const F = mf(-7.3, 8.72, PI); F.box('wood', th.wood, 1.8, 0.05, 0.3, 0, 1.3, 0); F.box('wood', th.wood, 1.8, 0.05, 0.3, 0, 1.9, 0);
      for (let k = 0; k < 7; k++) { const y = k < 4 ? 1.33 : 1.93, lx = -0.7 + (k % 4) * 0.45; F.cyl('shiny', 0xe0b840, 0.05, 0.03, 0.1, lx, y + 0.05, 0, 6); F.cyl('shiny', 0xe0b840, 0.07, 0.04, 0.14, lx, y + 0.2, 0, 8); F.box('wood', 0x2a1a14, 0.12, 0.05, 0.12, lx, y + 0.01, 0); }
      P.decal(F, atlas.label('awards', ['HOA PRESIDENT OF THE YEAR', '2009 - 2026  (self-nominated)'], '#2a1a14', '#e0b840', 128, 32, { small: true, font: 'serif' }), 1.2, 0.3, 0, 2.5, 0.14);
      spot('trophies', -7.3, 7.9, 0.8, 'Look at the trophies', () => say(['"HOA PRESIDENT OF THE YEAR", eighteen years running. In small print: "awarded by the HOA president".', 'One trophy is for golf. It is a participation trophy. It is in the front.']));
    }
    P.coffer(Math.min(mx * -10.9, mx * -3.1), Math.max(mx * -10.9, mx * -3.1), 4.1, 8.9, H, { col: th.wood, key: 'wood', nx: 4, nz: 3 });
    for (const x of [-9, -5]) P.can(mx * x, 6.5, H, 0.45);
    spot('safe', -4.6, 4.9, 0.8, gary ? 'Check behind the painting of Gary' : 'Check behind the painting', () => loot(spec, 'safe'));
    spot('computer', -8.3, 5.4, 0.7, 'Walk on the keyboard', () => { blip(900); say(gary ? ['You add a row to VIOLATIONS.XLS: "Gary. Being Gary. Fine: $1,000,000." Save. Close.', 'You reply-all to the HOA mailing list: "asdfjkl;;;;;;;". Three people agree.'] : ['You sell 400 shares of something by sitting down. The number at the top turns red.', 'You type "hhhhhhhhhhhhhhhh" into an email and press send. It was to a senator.']); });
  }

  // ============================================================ wine room
  {
    m('wineRack', -8.1, 0.79, 0, { w: 5.4, h: 2.6 }); m('wineRack', -10.81, 2.55, PI / 2, { w: 2.4, h: 2.6 });
    P.barrel(mx * -7.6, 2.5); for (const dz of [-0.6, 0.6]) P.stool(mx * (-7.6 + dz * 0.2 + 0.75), 2.5 + dz, { seat: 0x5a3a22 });
    { const F = mf(-7.6, 2.5, 0); F.cyl('wood', 0x5a3a22, 0.42, 0.42, 0.03, 0, 0.915, 0, 12); F.cyl('shiny', 0x1a3a22, 0.04, 0.04, 0.28, 0.1, 1.07, 0.05, 6); F.cyl('shiny', 0x1a3a22, 0.015, 0.02, 0.1, 0.1, 1.25, 0.05, 5); for (const e of [-1, 1]) { F.cyl('glass', 0xffffff, 0.04, 0.02, 0.09, -0.12, 1.07, e * 0.14, 6); F.cyl('glass', 0xffffff, 0.006, 0.006, 0.1, -0.12, 0.98, e * 0.14, 4); F.cyl('plain', 0x7a1a2a, 0.035, 0.02, 0.04, -0.12, 1.05, e * 0.14, 6); } F.box('wood', 0x8a6238, 0.3, 0.02, 0.2, 0.05, 0.94, -0.2, 0.3); F.box('plain', 0xe8d080, 0.1, 0.05, 0.08, 0.05, 0.97, -0.2, 0.3); }
    for (const x of [-9.3, -8.5]) P.barrel(mx * x, 3.52, { s: 0.85 }); { const F = mf(-8.9, 3.52, 0); F.cyl('wood', 0x7a5232, 0.25, 0.25, 0.75, 0, 1.02, 0, 10, { rz: PI / 2 }); }
    { const F = mf(-6.0, 3.6, PI); F.rbox('metal', 0x2a2a2e, 0.6, 1.7, 0.55, 0, 0.85, 0); F.box('glass', 0xffe8c0, 0.5, 1.5, 0.02, 0, 0.9, 0.28); F.box('glow', 0xffc870, 0.46, 0.02, 0.4, 0, 1.6, 0, 0, { tint: false }); for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) F.cyl('shiny', 0x1a3a22, 0.035, 0.035, 0.3, -0.17 + k * 0.115, 0.25 + r * 0.24, 0.05, 5, { rx: PI / 2 }); F.col(0, 0, 0.6, 0.55, 1.7); }
    mw('picture', -5.11, 1.9, 1.2, -PI / 2, 0.6, 0.3, atlas.label('wine', gary ? ['CHATEAU GARY', '2019 (a good year for rules)'] : ['IN VINO', 'VERITAS'], '#3a2416', '#e8d0a0', 96, 48, { font: 'serif', small: true }), 0x3a2416);
    for (const x of [-9.4, -6.6]) P.pendant(mx * x, 2.5, H, 2.3, { shade: 0x3a2a1a, c: 0xffc070, i: 0.5 });
    spot('wine', -8.4, 1.6, 1.0, 'Knock a bottle off the rack', () => { A && A.Sfx.crash && A.Sfx.crash(4); say(['You push a 1982 Bordeaux off the rack. It lands on the rug and does not break. You try a different one.', 'Tink. Tink. CRASH. That was the expensive one. It is always the expensive one.', 'You rub your cheek on every cork in the bottom row. These are yours now.']); });
  }

  // ============================================================ primary bedroom
  {
    P.rug(mx * -9.0, -6.0, 0, 3.6, 3.8, P.rugTex('bed', th.rug[1], th.rug[0], th.rug[2], 64, 96));
    m('bed', -9.85, -6.0, PI / 2, { wood: th.wood, duvet: th.duvet, accent: th.accent, head: gary ? 0x7a1a26 : th.sofa, tuft: true, bench: true, benchCol: th.sofa });
    for (const z of [-7.4, -4.6]) m('nightstand', -10.7, z, PI / 2, { wood: th.wood, pull: metal });
    { const F = mf(-10.7, -4.6, PI / 2); F.box('plain', 0x7a2a2a, 0.15, 0.03, 0.2, 0.1, 0.6, 0.1, 0.3); F.box('plain', 0x1a1a1e, 0.07, 0.01, 0.14, -0.14, 0.59, 0.12, 0.2); }
    mw('picture', -10.99, 2.15, -6.0, PI / 2, 1.4, 0.8, art(5), gary ? 0xe0b840 : th.wood);
    for (const x of [-9.6, -6.6]) mw('window', x, 1.6, -D / 2 + 0.001, 0, 1.4, 2.2, { curtain: th.curtain, floor: true, trim: th.trim, rod: metal });
    m('dresser', -5.38, -4.2, -PI / 2, { w: 1.5, wood: th.wood, pull: metal }); m('tv', -5.11, -4.2, -PI / 2, { w: 1.2, y: 1.7, console: false, screen: tvTex(atlas, gary) });
    { const F = mf(-5.38, -4.2, -PI / 2); F.box('wood', metal, 0.3, 0.38, 0.03, -0.45, 1.07, -0.05, 0.2, { rx: -0.1 }); F.rbox('plain', 0xe8d8e0, 0.2, 0.1, 0.14, 0.4, 0.93, 0); for (let k = 0; k < 3; k++) F.cyl('glass', pick([0xffd0e0, 0xd0e8ff, 0xfff0c0]), 0.025, 0.03, 0.1, 0.1 + k * 0.07, 0.93, 0.05, 6); }
    m('armchair', -5.9, -8.1, -PI / 4 - PI / 2, { col: th.chair, w: 0.9, pillow: th.duvet }); P.floorLamp(mx * -5.5, -7.2, { metal }); m('table', -6.75, -8.45, 0, { round: true, w: 0.5, h: 0.55, wood: th.wood });
    P.chandelier(mx * -8.2, -6.0, H, 2.6, { r: 0.45, metal, n: 6, tiers: 1, i: 0.8 });
    spot('bed', -8.0, -6.0, 1.0, 'Nap on the big bed');
    spot('remote', -6.4, -4.2, 0.6, 'Sit on the remote', () => { blip(500); say(gary ? ['The TV turns on. It is the neighborhood security cameras. All sixteen. One of them is pointed at your RV.'] : ['The TV turns on at full volume. A shopping channel. Somebody is very excited about a mop.', 'You change the language to Finnish. Nobody in this house will ever figure out how to change it back.']); });
  }

  // ============================================================ bath
  {
    const gold = th.name === 'modern' ? 0xc8ccd4 : 0xc8a860;
    m('vanity', -10.72, -1.2, PI / 2, { w: 1.9, col: th.wood, top: 0xf4f2ee, metal: gold, frame: gold });
    m('tub', -9.75, -0.05, PI, { w: 1.75, metal: gold });
    m('toilet', -8.5, -0.95, -PI / 2);
    mw('towels', -8.11, 1.5, -2.2, -PI / 2, th.duvet);
    { const F = mf(-8.3, -2.6, 0); F.rbox('wood', th.woodLt, 0.34, 0.5, 0.34, 0, 0.25, 0); for (let k = 0; k < 3; k++) F.rbox('cloth', 0xf4f0e8, 0.3, 0.08, 0.3, 0, 0.55 + k * 0.085, 0, 0, { round: 0.03 }); F.col(0, 0, 0.34, 0.34, 0.75); }
    { const F = mf(-9.75, -0.05, PI); for (let k = 0; k < 3; k++) F.cyl('plain', 0xf4f0e0, 0.03, 0.03, 0.08 + k * 0.03, 0.7 - k * 0.1, 0.66 + k * 0.015, -0.34, 6); F.cyl('plain', 0xf0d040, 0.05, 0.06, 0.07, -0.4, 0.55, 0.05, 6); F.sph('plain', 0xf0d040, 0.04, -0.4, 0.61, 0.09); F.box('plain', 0xe87020, 0.03, 0.015, 0.03, -0.4, 0.6, 0.14); }
    P.rug(mx * -9.6, -1.2, 0, 1.0, 1.5, atlas.region('bathmat', 32, 48, (g) => { g.fillStyle = '#f4f0e8'; g.fillRect(-1, -1, 34, 50); g.strokeStyle = '#c8c0b0'; g.lineWidth = 2; g.strokeRect(3, 3, 26, 42); }));
    P.can(mx * -9.4, -1.6, H, 0.5, 0xf4f8ff);
    spot('tub', -9.7, -0.75, 0.7, 'Look at the bathtub', () => say(['A soaking tub with gold taps. Full of water. You sit beside it and watch the water with deep suspicion.', 'There is a rubber duck. You knock it in. It floats. You do not trust it.']));
    spot('toilet', -8.9, -0.95, 0.6, 'Drink from the toilet', () => say(['Heated seat. Soft-close lid. The water tastes exactly the same as everybody else\'s.']));
  }

  // ============================================================ walk-in closet
  {
    m('wardrobeRun', -7.62, -1.25, PI / 2, { w: 3.1 }); m('wardrobeRun', -5.38, -1.25, -PI / 2, { w: 3.1, long: true, cols: gary ? [0xc8b890, 0xd8c8a0, 0xb8a888, 0xc8b890, 0xe8dcc0] : undefined });
    const dr = m('dresser', -6.5, 0.14, PI, { w: 1.2, h: 0.95, d: 0.42, wood: 0xf2eee6, pull: metal, rows: 4 });
    dr.rbox('wood', 0x5a2a2a, 0.3, 0.14, 0.2, 0.25, 1.03, 0); dr.box('shiny', 0xc8a860, 0.06, 0.03, 0.02, 0.25, 1.03, 0.105);
    for (let k = 0; k < 3; k++) { dr.cyl('plain', 0xe8e0d0, 0.03, 0.05, 0.16, -0.4 + k * 0.16, 1.05, 0, 6); dr.sph('plain', 0xe8e0d0, 0.05, -0.4 + k * 0.16, 1.17, 0, { ws: 5, hs: 4 }); }
    { const F = mf(-6.5, 0.39, PI); F.box('wood', metal, 0.7, 1.0, 0.03, 0, 1.65, 0); F.quad('mirror', 0xb8c8d4, 0.6, 0.9, 0, 1.65, 0.02); }
    m('ottoman', -6.5, -1.3, 0, { w: 0.9, d: 0.5, col: th.sofa });
    P.pendant(mx * -6.5, -1.3, H, 2.6, { globe: true, i: 0.6, r: 0.14 });
    spot('jewelry', -6.5, -0.45, 0.7, 'Paw through the jewelry box', () => loot(spec, 'jewelry'));
    spot('clothes', -7.0, -2.0, 0.6, 'Hide in the clothes', () => say(gary ? ['Fourteen identical beige polo shirts. Fourteen identical beige slacks. One Hawaiian shirt, tags still on.', 'You shed on every single polo. It takes a while. It is worth it.'] : ['Cashmere. Silk. More cashmere. You make a nest in the sweaters and reconsider your whole life.', 'A shoe wall with forty pairs. You chew the lace of exactly one. Left shoe. Always the left.']));
  }

  // ============================================================ the robot vacuum: the only thing that moves
  const vac = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 6), new THREE.MeshBasicMaterial({ color: gary ? 0xb89830 : 0x2a2a30 }));
  vac.userData.noBake = true; vac.position.set(0, 0.04, 0.5); vac.name = 'mansion:vac';
  zoneLights(lights, rooms, 3);
  const group = B.finish(new THREE.Group()); group.add(vac);
  const front = D / 2;
  return {
    group, size: [W, D], cols, floors: [], lights, unload: true,
    name: gary ? "Gary's House" : `The ${FAM} Residence`,
    spawn: { x: 0, z: front - 1.1, yaw: 0 }, exit: { x: 0, z: front - 0.05, r: 0.7 },
    cam: { maxDist: 3.6, height: 2.9 },
    bake: { amb: 0.3, maxEdge: 1.2 }, pack: true,
    interact: hot,
    dispose() { atlas.tex.dispose(); },
    update(t) {   // the vacuum drives a slow figure of eight through the great room
      const a = t * 0.35; vac.position.x = Math.sin(a) * 3.4; vac.position.z = 1.0 + Math.sin(a * 2) * 1.6; vac.rotation.y = a * 3;
    },
    stats: () => ({ atlas: atlas.used(), lights: lights.length, cols: cols.length }),
  };
}

function garyPic(atlas, k) {
  return atlas.region('gary' + (k % 6), 72, 96, (g) => {
    g.fillStyle = ['#3a4a6a', '#5a3a3a', '#3a5a4a', '#5a4a2a', '#2a2a3a', '#6a2a3a'][k % 6]; g.fillRect(-1, -1, 74, 98);
    g.fillStyle = '#2a2a30'; g.beginPath(); g.ellipse(36, 96, 28, 34, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(32, 64, 8, 18); g.fillStyle = '#a02030'; g.fillRect(34, 66, 4, 16);
    g.fillStyle = '#e8c8a8'; g.beginPath(); g.ellipse(36, 40, 16, 21, 0, 0, 7); g.fill(); g.fillStyle = '#6a5040'; g.fillRect(20, 19, 32, 8);
    g.fillStyle = '#111'; g.fillRect(28, 36, 4, 3); g.fillRect(40, 36, 4, 3); g.fillRect(29, 50, 14, 2);
    const props = ['GARY', 'GARY, GOLFING', 'GARY, POINTING', 'GARY & HIS CART', 'GARY (YOUNG)', 'GARY, VICTORIOUS'];
    if (k % 6 === 1) { g.strokeStyle = '#c8ccd4'; g.lineWidth = 2; g.beginPath(); g.moveTo(58, 30); g.lineTo(64, 80); g.stroke(); }
    if (k % 6 === 2) { g.fillStyle = '#e8c8a8'; g.fillRect(52, 56, 18, 5); }
    g.fillStyle = '#e0b840'; g.font = 'bold 8px serif'; g.textAlign = 'center'; g.fillText(props[k % 6], 36, 93, 68);
  });
}
function tvTex(atlas, gary) {
  return atlas.region('tv', 96, 54, (g) => {
    if (gary) { g.fillStyle = '#0a0a0e'; g.fillRect(-1, -1, 98, 56); for (let k = 0; k < 4; k++) { g.fillStyle = ['#2a3a2a', '#3a3a2a', '#2a2a3a', '#3a2a2a'][k]; g.fillRect((k % 2) * 48 + 2, ((k / 2) | 0) * 27 + 2, 44, 23); } g.fillStyle = '#e03030'; g.beginPath(); g.arc(90, 6, 2.5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '5px monospace'; g.fillText('CAM 3: RV LOT', 6, 49); g.fillStyle = '#f4f4f4'; g.fillRect(20, 40, 6, 5); }
    else { const gr = g.createLinearGradient(0, 0, 96, 54); gr.addColorStop(0, '#1a4a8a'); gr.addColorStop(1, '#40a0c0'); g.fillStyle = gr; g.fillRect(-1, -1, 98, 56); g.fillStyle = '#e8f0f8'; g.fillRect(-1, 40, 98, 16); g.fillStyle = '#c02020'; g.fillRect(4, 43, 26, 8); g.fillStyle = '#fff'; g.font = 'bold 6px sans-serif'; g.fillText('LIVE', 9, 49); g.fillStyle = '#1a1a1e'; g.font = '5px sans-serif'; g.fillText('MARKETS: FISH UP 4%', 34, 49); g.fillStyle = '#e8c8a8'; g.beginPath(); g.arc(48, 22, 9, 0, 7); g.fill(); g.fillStyle = '#2a2a3a'; g.fillRect(36, 30, 24, 10); }
  });
}

/** one-time finds per house; taking things from the rich has a chance of a silent alarm */
function loot(spec, what) {
  if (!A) return;
  const key = spec.id + ':' + what;
  if (S.looted[key]) { say(what === 'safe' ? 'The safe is open and empty. You did that.' : 'Nothing left but a single clip-on earring. You bat it under the dresser.', 3); return; }
  S.looted[key] = true;
  const cash = what === 'safe' ? (spec.gary ? 250 : 90 + ((spec.seed * 37) % 80)) : 30 + ((spec.seed * 53) % 40);
  A.addCash(cash); A.Sfx.jingle ? A.Sfx.jingle() : (A.Sfx.pickup && A.Sfx.pickup());
  const alarm = Math.random() < (what === 'safe' ? 0.5 : 0.25);
  if (what === 'safe') say(spec.gary ? `Behind the painting of Gary: a safe. The code is 1-2-3-4. Inside: an envelope marked "HOA DUES (MISC)". +$${cash}` : `The painting swings out. A wall safe, left open a crack. You hook out a stack of bills with one claw. +$${cash}`, 5);
  else say(`Pearls, a watch, a tennis bracelet. You take the shiniest thing and carry it off in your mouth. +$${cash}`, 5);
  if (alarm && A.G) { A.G.heat = Math.min(5, Math.max(A.G.heat || 0, 1)); A.G.seenT = 0; setTimeout(() => say('A tiny red light blinks on the wall. Silent alarm. Time to go.', 3.5), 2600); }
}

/** Call once after the interiors exist. a = { G, places, toast, addCash, Sfx } */
export function init(a) {
  A = a;
  const yards = (a.places && a.places.yards) || [];
  const gp = a.places && a.places.gary;
  let n = 0;
  for (const y of yards) {
    const Hm = HOUSES[y.id]; if (!Hm || !Hm.door) continue;
    const isGary = y.id === 'beaumont' && (!gp || Math.hypot(gp.x - y.x, gp.z - y.z) < 40);
    const c = Math.cos(y.ry), s = Math.sin(y.ry), lx = y.mx * Hm.door[0], lz = Hm.door[1] - (Hm.doorIn ?? 1.0);
    const door = { x: y.x + lx * c + lz * s, z: y.z - lx * s + lz * c, yaw: y.ry, kind: 'door' };
    const spec = { id: isGary ? 'gary' : 'estate' + (n + 1), model: y.id, mirror: y.mx < 0, seed: n + 1, family: FAMILY[n % FAMILY.length], gary: isGary };
    n++;
    INTR.registerRoom(spec.id, { name: isGary ? "Gary's House" : `The ${spec.family} Residence`, build: (ctx) => buildMansion(spec, ctx) }, door);
    S.houses.push({ ...spec, door });
  }
  if (!n) console.warn('[mansions] no Estates houses found (places.yards)');
  INTR.on('enter', (id) => {
    const h = S.houses.find((q) => q.id === id); if (!h) return;
    S.visits++;
    if (!S.greeted) S.greeted = {};
    if (!S.greeted[id]) { S.greeted[id] = true; setTimeout(() => say(h.gary ? 'Gary\'s house. It smells like lemon polish and rules.' : `The ${h.family} residence. Nobody home. The robot vacuum does not count.`, 4), 700); }
  });
  if (typeof window !== 'undefined' && window.__G) window.__G.mansions = { S, THEMES, enter: (k = 0) => INTR.enter(typeof k === 'string' ? k : S.houses[k].id, { instant: true }) };
  return n;
}
