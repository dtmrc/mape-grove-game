// Off Leash NPC generator (art thread). Builds a whole townsperson from a small recipe:
// one skinned low-poly mesh (PS1 / Legends look), one painted 256x256 atlas, baked front+top light in the
// vertex colours, unlit material, and the standard Tracebench skeleton (hips spine chest neck head head_end,
// shoulder/arm/forearm/hand/hand_end _L/_R, thigh/shin/foot/toe _L/_R) so the shared Idle/Walk/Run/Jump/Wave
// clips play on every body. The same module runs in the NPC Creator page and (later) in the game.
import * as THREE from 'three';
import { NPC_CLIPS } from './npc-clips.js';

export const SKINS = ['#f7dcc4', '#f1c9a5', '#e4b48e', '#d3996a', '#b97a42', '#9a6236', '#7a4b2e', '#4f3020'];
export const HAIR_COLORS = ['#141414', '#2b1d0e', '#5a3a1a', '#8a5a2a', '#c9a25a', '#eadca6', '#7a3b13', '#c84a20', '#9a9a9a', '#f2f2f2', '#3a5ac8', '#d04aa8', '#2fa860'];
export const CLOTH_COLORS = ['#e8e8e8', '#1c1c1c', '#5a5a5a', '#a8332b', '#d06e22', '#d8b030', '#2f8a52', '#2e6fa1', '#2c3e50', '#6e3c8d', '#e87aa6', '#8a5a3a', '#c8b48a', '#3f74c9', '#c8e632', '#7f6a4f'];
export const OPTIONS = {
  sex: ['male', 'female'],
  build: ['average', 'built', 'skinny', 'fat'],
  face: ['oval', 'round', 'square', 'long', 'heart'],
  nose: ['button', 'small', 'pointed', 'big', 'wide', 'hooked'],
  hair: ['bald', 'buzz', 'short', 'sidepart', 'spiky', 'curly', 'bob', 'long', 'ponytail', 'bun', 'mohawk'],
  facialHair: ['none', 'stubble', 'moustache', 'goatee', 'beard'],
  shirt: ['tee', 'longsleeve', 'polo', 'tank', 'buttonup', 'hoodie'],
  pants: ['jeans', 'slacks', 'shorts', 'cargo', 'sweats', 'skirt'],
  jacket: ['none', 'open', 'zip', 'blazer', 'vest', 'coat'],
};
export const LABELS = {
  sex: { male: 'Male', female: 'Female' },
  build: { average: 'Average', built: 'Built', skinny: 'Skinny', fat: 'Fat' },
  face: { oval: 'Oval', round: 'Round', square: 'Square', long: 'Long', heart: 'Heart' },
  nose: { button: 'Button', small: 'Small', pointed: 'Pointed', big: 'Big', wide: 'Wide', hooked: 'Hooked' },
  hair: { bald: 'Bald', buzz: 'Buzz', short: 'Short', sidepart: 'Side part', spiky: 'Spiky', curly: 'Curly', bob: 'Bob', long: 'Long', ponytail: 'Ponytail', bun: 'Bun', mohawk: 'Mohawk' },
  facialHair: { none: 'Clean', stubble: 'Stubble', moustache: 'Moustache', goatee: 'Goatee', beard: 'Beard' },
  shirt: { tee: 'T-shirt', longsleeve: 'Long sleeve', polo: 'Polo', tank: 'Tank top', buttonup: 'Button-up', hoodie: 'Hoodie' },
  pants: { jeans: 'Jeans', slacks: 'Slacks', shorts: 'Shorts', cargo: 'Cargo', sweats: 'Sweatpants', skirt: 'Skirt' },
  jacket: { none: 'None', open: 'Open jacket', zip: 'Zip jacket', blazer: 'Blazer', vest: 'Vest', coat: 'Long coat' },
};

export function defaultRecipe(sex = 'male') {
  return sex === 'female'
    ? { name: 'Base female', sex: 'female', build: 'average', face: 'oval', nose: 'small', hair: 'bob', hairColor: '#5a3a1a', facialHair: 'none', skin: '#f1c9a5', shirt: 'tee', shirtColor: '#e87aa6', pants: 'jeans', pantsColor: '#2e6fa1', jacket: 'none', jacketColor: '#2c3e50', shoeColor: '#1c1c1c', height: 1 }
    : { name: 'Base male', sex: 'male', build: 'average', face: 'oval', nose: 'small', hair: 'short', hairColor: '#2b1d0e', facialHair: 'none', skin: '#e4b48e', shirt: 'tee', shirtColor: '#2e6fa1', pants: 'jeans', pantsColor: '#2c3e50', jacket: 'none', jacketColor: '#5a5a5a', shoeColor: '#5a3a22', height: 1 };
}
const pick = (a, rng) => a[Math.floor(rng() * a.length)];
export function randomRecipe(rng = Math.random, sex = pick(OPTIONS.sex, rng)) {
  const r = defaultRecipe(sex);
  r.name = '';
  r.build = pick(sex === 'male' ? OPTIONS.build : OPTIONS.build.filter((b) => b !== 'built'), rng);
  r.face = pick(OPTIONS.face, rng); r.nose = pick(OPTIONS.nose, rng);
  r.hair = pick(sex === 'female' ? ['short', 'bob', 'bob', 'long', 'long', 'ponytail', 'bun', 'curly', 'sidepart'] : ['bald', 'buzz', 'short', 'short', 'sidepart', 'spiky', 'curly', 'mohawk', 'long'], rng);
  r.hairColor = pick(HAIR_COLORS.slice(0, 10), rng);
  r.facialHair = sex === 'male' ? pick(['none', 'none', 'stubble', 'moustache', 'goatee', 'beard'], rng) : 'none';
  r.skin = pick(SKINS, rng);
  r.shirt = pick(OPTIONS.shirt, rng); r.shirtColor = pick(CLOTH_COLORS, rng);
  r.pants = pick(sex === 'female' ? OPTIONS.pants : OPTIONS.pants.filter((p) => p !== 'skirt'), rng); r.pantsColor = pick(['#2c3e50', '#34495e', '#7f6a4f', '#1c2833', '#566573', '#3a5a8a', '#2e6fa1', '#5a5a5a', '#c8b48a', '#1c1c1c'], rng);
  r.jacket = pick(['none', 'none', 'none', 'open', 'zip', 'blazer', 'vest', 'coat'], rng); r.jacketColor = pick(CLOTH_COLORS, rng);
  r.shoeColor = pick(['#1c1c1c', '#5a3a22', '#e8e8e8', '#8a2a2a', '#3a3a5a'], rng);
  r.height = 0.94 + rng() * 0.12;
  return r;
}
export function normalizeRecipe(r) {
  const d = defaultRecipe(r.sex === 'female' ? 'female' : 'male');
  const o = { ...d, ...r };
  for (const k of Object.keys(OPTIONS)) if (!OPTIONS[k].includes(o[k])) o[k] = d[k];
  if (o.sex === 'female' && o.build === 'built') o.build = 'average';
  o.height = Math.min(1.15, Math.max(0.8, +o.height || 1));
  return o;
}

// ---------------------------------------------------------------- atlas layout
const ATLAS = 256;
class Shelf {
  constructor() { this.x = 0; this.y = 0; this.rowH = 0; this.R = {}; }
  add(name, w, h) {
    if (this.x + w > ATLAS) { this.x = 0; this.y += this.rowH; this.rowH = 0; }
    const R = { x: this.x, y: this.y, w, h, name }; this.x += w; this.rowH = Math.max(this.rowH, h); this.R[name] = R; return R;
  }
}

// ---------------------------------------------------------------- geometry builder
const LIGHT = new THREE.Vector3(0.3, 0.75, 0.6).normalize();
const tone = (n) => { const d = n.dot(LIGHT); return d > 0.45 ? 1 : d > -0.05 ? 0.8 : 0.6; };   // three painted-looking tones: lit, side, shade
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Vector3();
class Builder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.si = []; this.sw = []; this.tris = 0; }
  // p: [x,y,z] x3, uv: [u,v] x3 (atlas pixels), w: [[boneIdx,weight],..] x3, inside: point the face should face away from
  tri(p, uv, w, inside, tint = 1) {
    _a.fromArray(p[1]).sub(_c.fromArray(p[0])); _b.fromArray(p[2]).sub(_c); _n.crossVectors(_a, _b);
    if (_n.lengthSq() < 1e-12) return;
    _n.normalize();
    if (inside) { _c.set((p[0][0] + p[1][0] + p[2][0]) / 3 - inside[0], (p[0][1] + p[1][1] + p[2][1]) / 3 - inside[1], (p[0][2] + p[1][2] + p[2][2]) / 3 - inside[2]); if (_c.dot(_n) < 0) { p = [p[0], p[2], p[1]]; uv = [uv[0], uv[2], uv[1]]; w = [w[0], w[2], w[1]]; _n.negate(); } }
    const t = tone(_n) * tint;
    for (let i = 0; i < 3; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]); this.nrm.push(_n.x, _n.y, _n.z);
      this.uv.push(uv[i][0] / ATLAS, 1 - uv[i][1] / ATLAS); this.col.push(t, t, t);
      const ww = w[i]; const w0 = ww[0] || [0, 1], w1 = ww[1] || [0, 0];
      this.si.push(w0[0], w1[0], 0, 0); this.sw.push(w0[1], w1[1], 0, 0);
    }
    this.tris++;
  }
  quad(p, uv, w, inside, tint) { this.tri([p[0], p[1], p[2]], [uv[0], uv[1], uv[2]], [w[0], w[1], w[2]], inside, tint); this.tri([p[0], p[2], p[3]], [uv[0], uv[2], uv[3]], [w[0], w[2], w[3]], inside, tint); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.computeBoundingSphere();
    return g;
  }
}
// unit outline for 8-sided heads: flat face across the front, slanted cheeks, flat back
const HEAD_PTS = [[-0.5, -0.95], [-1, -0.3], [-0.95, 0.45], [-0.45, 1.0], [0.45, 1.0], [0.95, 0.45], [1, -0.3], [0.5, -0.95]];
function ringPts(n, pts) {
  if (pts) return pts;
  const out = []; for (let i = 0; i < n; i++) { const a = Math.PI + Math.PI / n + (2 * Math.PI * i) / n; out.push([Math.sin(a), Math.cos(a)]); } return out;
}
// rings: {y|x, r1, r2, c:[x,y,z] centre, w, v (0..1 row in the region)}; axis 'y' (outline in xz, front +z) or 'x' (outline in yz, front +z)
function loft(bd, rings, n, R, opts = {}) {
  const axis = opts.axis || 'y', pts = ringPts(n, opts.pts);
  const vert = (rg, i) => {
    const [p, q] = pts[i];
    return axis === 'y' ? [rg.c[0] + p * rg.r1, rg.c[1], rg.c[2] + q * rg.r2] : [rg.c[0], rg.c[1] + p * rg.r1, rg.c[2] + q * rg.r2];
  };
  const U = (i) => R.x + (i / n) * R.w, V = (rg) => R.y + (1 - rg.v) * R.h;
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k], B = rings[k + 1];
    const inside = [(A.c[0] + B.c[0]) / 2, (A.c[1] + B.c[1]) / 2, (A.c[2] + B.c[2]) / 2];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      bd.quad([vert(A, i), vert(A, j), vert(B, j), vert(B, i)], [[U(i), V(A)], [U(i + 1), V(A)], [U(i + 1), V(B)], [U(i), V(B)]], [A.w, A.w, B.w, B.w], inside, opts.tint);
    }
  }
  const cap = (rg, dir) => {
    const inside = axis === 'y' ? [rg.c[0], rg.c[1] - dir * 0.05, rg.c[2]] : [rg.c[0] - dir * 0.05, rg.c[1], rg.c[2]];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; bd.tri([rg.c, vert(rg, i), vert(rg, j)], [[U(i + 0.5), V(rg)], [U(i), V(rg)], [U(i + 1), V(rg)]], [rg.w, rg.w, rg.w], inside, opts.tint); }
  };
  if (opts.capStart) cap(rings[0], -1);
  if (opts.capEnd) cap(rings[rings.length - 1], 1);
}
// axis-aligned box; side faces map the patch, top/bottom map a thin strip of it
function box(bd, w, h, d, c, wgt, P, opts = {}) {
  const x0 = c[0] - w / 2, x1 = c[0] + w / 2, y0 = c[1] - h / 2, y1 = c[1] + h / 2, z0 = c[2] - d / 2, z1 = c[2] + d / 2;
  const full = [[P.x, P.y + P.h], [P.x + P.w, P.y + P.h], [P.x + P.w, P.y], [P.x, P.y]];
  const strip = (f) => [[P.x, P.y + P.h * f], [P.x + P.w, P.y + P.h * f], [P.x + P.w, P.y + P.h * (f - 0.2)], [P.x, P.y + P.h * (f - 0.2)]];
  const W = [wgt, wgt, wgt, wgt];
  bd.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], full, W, c, opts.tint);   // front
  bd.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], full, W, c, opts.tint);   // back
  bd.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], full, W, c, opts.tint);   // +x
  bd.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], full, W, c, opts.tint);   // -x
  bd.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], strip(opts.topRow ?? 0.25), W, c, opts.tint); // top
  bd.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], strip(1), W, c, opts.tint);                 // bottom
}
// four-sided pyramid pointing along +z (nose, spikes use rotated variants)
function wedge(bd, base, tip, wgt, P) {
  const uv = [[P.x + 2, P.y + 2], [P.x + P.w - 2, P.y + 2], [P.x + P.w / 2, P.y + P.h - 2]], W = [wgt, wgt, wgt];
  const inside = [(base[0][0] + base[2][0]) / 2, (base[0][1] + base[2][1]) / 2, (base[0][2] + base[2][2]) / 2];
  for (let i = 0; i < base.length; i++) bd.tri([base[i], base[(i + 1) % base.length], tip], uv, W, inside);
}

// ---------------------------------------------------------------- painting
const hex = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c);
function shade(c, k) { const col = new THREE.Color(hex(c)); col.r = Math.min(1, col.r * k); col.g = Math.min(1, col.g * k); col.b = Math.min(1, col.b * k); return '#' + col.getHexString(); }
function mix(a, b, t) { const A = new THREE.Color(hex(a)), B = new THREE.Color(hex(b)); return '#' + A.lerp(B, t).getHexString(); }
const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// ---------------------------------------------------------------- measurements
// Everything is measured off diet's Tracebench construction worker (models/worker): a 1.83 m man made of a few straight
// prisms. Octagon head 0.25 x 0.23 x 0.26 tall with a flat top and no chin, hex neck, chamfered-box torso 0.52 wide and
// 0.34 deep that barely tapers to the hips, hex-prism arms with a 15 cm box hand, straight box legs 0.185 square, long box
// boots. Average male below is that body at 1.80 m, a touch less stocky; the other builds scale its widths.
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'head_end', 'shoulder_L', 'arm_L', 'forearm_L', 'hand_L', 'hand_end_L', 'shoulder_R', 'arm_R', 'forearm_R', 'hand_R', 'hand_end_R', 'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R'];
const PARENT = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', head_end: 'head', shoulder_L: 'chest', arm_L: 'shoulder_L', forearm_L: 'arm_L', hand_L: 'forearm_L', hand_end_L: 'hand_L', shoulder_R: 'chest', arm_R: 'shoulder_R', forearm_R: 'arm_R', hand_R: 'forearm_R', hand_end_R: 'hand_R', thigh_L: 'hips', shin_L: 'thigh_L', foot_L: 'shin_L', toe_L: 'foot_L', thigh_R: 'hips', shin_R: 'thigh_R', foot_R: 'shin_R', toe_R: 'foot_R' };

function measure(r) {
  const f = r.sex === 'female';
  const S = (f ? 0.95 : 1) * r.height;            // vertical scale; base male is 1.80 m
  const B = { average: 0, built: 1, skinny: 2, fat: 3 }[r.build];
  const v = (a) => a[B];
  const M = {
    S, f,
    // joint heights
    ankleY: 0.10 * S, kneeY: 0.52 * S, thighY: 0.90 * S, hipsY: 0.92 * S, spineY: 1.08 * S, chestY: 1.28 * S, neckY: 1.47 * S, headY: 1.55 * S,
    shoulderY: 1.37 * S, headH: 0.26 * S,
    // torso octagon half sizes (x, z) at hips / waist / chest / shoulder line
    hipW: v([0.21, 0.23, 0.175, 0.27]) * (f ? 1.05 : 1), hipD: v([0.13, 0.145, 0.105, 0.175]),
    waistW: v([0.225, 0.245, 0.18, 0.29]) * (f ? 0.85 : 1), waistD: v([0.14, 0.155, 0.11, 0.205]),
    chestW: v([0.25, 0.285, 0.2, 0.265]) * (f ? 0.86 : 1), chestD: v([0.155, 0.18, 0.125, 0.175]) * (f ? 1.05 : 1),
    // limbs
    armR: v([0.08, 0.095, 0.06, 0.088]) * (f ? 0.85 : 1),     // upper arm hex radius (y), z is 0.86 of it
    foreR: v([0.068, 0.08, 0.052, 0.074]) * (f ? 0.85 : 1),
    legW: v([0.09, 0.105, 0.07, 0.115]) * (f ? 0.95 : 1),      // leg box half width (also half depth)
    neckR: v([0.075, 0.085, 0.062, 0.09]) * (f ? 0.85 : 1),
    handL: 0.14 * S, handH: 0.12 * S, handD: 0.13 * S,
    footW: 0.13, footH: 0.12, footL: 0.30,
    headW: 0.125, headD: 0.115,
    bellyZ: v([0, 0, 0, 0.025]),
  };
  M.armX = M.chestW - 0.02;                           // shoulder joint just inside the torso edge
  M.elbowX = M.armX + 0.30 * S; M.wristX = M.elbowX + 0.22 * S; M.handEndX = M.wristX + M.handL;
  M.legX = Math.max(M.legW + 0.012, M.hipW * 0.5);    // leg box centres; a small gap between the legs
  // head shape tweaks (octagon stays a straight prism; shapes change its width, height and a slight jaw taper)
  const face = r.face;
  M.headW *= { oval: 1, round: 1.1, square: 1.06, long: 0.93, heart: 1.02 }[face] * (r.build === 'fat' ? 1.08 : r.build === 'skinny' ? 0.95 : 1) * (f ? 0.94 : 1);
  M.headD *= { oval: 1, round: 1.06, square: 1.02, long: 0.98, heart: 1 }[face] * (f ? 0.96 : 1);
  M.headH *= { oval: 1, round: 0.94, square: 0.97, long: 1.12, heart: 1.0 }[face];
  M.jawK = { oval: 0.9, round: 1.0, square: 1.0, long: 0.88, heart: 0.78 }[face];   // bottom width / top width
  M.height = M.headY + M.headH;
  return M;
}

// chamfered-box octagon (the worker's torso and head cross-section): flat faces are 0.84 of the width, corners cut at 45 deg
const OCT = [[-0.42, -1], [-1, -0.42], [-1, 0.42], [-0.42, 1], [0.42, 1], [1, 0.42], [1, -0.42], [0.42, -1]];
// box cross-section (legs): facet 1 faces +z
const BOX4 = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
// hex prism along x (arms, neck): pointy top and bottom, flat front and back; facet 2 faces +z
const HEX_X = [[-0.44, -1], [-1, 0], [-0.44, 1], [0.44, 1], [1, 0], [0.44, -1]];
const HEX_Y = [[-0.5, -0.87], [-1, 0], [-0.5, 0.87], [0.5, 0.87], [1, 0], [0.5, -0.87]];

export function buildNPC(input) {
  const r = normalizeRecipe(input);
  const M = measure(r);
  const bi = {}; BONES.forEach((n, i) => (bi[n] = i));
  const W1 = (n) => [[bi[n], 1]], W2 = (a, b, t = 0.5) => [[bi[a], 1 - t], [bi[b], t]];
  const sh = new Shelf();
  const R = {
    torso: sh.add('torso', 96, 84), head: sh.add('head', 96, 36), face: sh.add('face', 48, 48),
    armL: sh.add('armL', 48, 40), armR: sh.add('armR', 48, 40), legL: sh.add('legL', 64, 64), legR: sh.add('legR', 64, 64),
    neck: sh.add('neck', 24, 8), hair: sh.add('hair', 24, 24), skin: sh.add('skin', 12, 12), shoe: sh.add('shoe', 24, 20), hand: sh.add('hand', 20, 20), tail: sh.add('tail', 24, 16),
  };
  const bd = new Builder();
  const skirt = r.pants === 'skirt', coat = r.jacket === 'coat';
  const hemY = coat ? 0.66 * M.S : skirt ? 0.62 * M.S : null;
  const bottomY = hemY ?? 0.86 * M.S;
  // ---- torso: one chamfered-box prism from the belt line to the neck, sloped top (clothes thicken it a little)
  const Tv = (y) => (y - bottomY) / (M.neckY - bottomY);
  const puff = r.jacket !== 'none' && r.jacket !== 'vest' ? 0.015 : 0;
  const tr = [];
  if (hemY != null) tr.push({ c: [0, hemY, 0], r1: M.hipW * (coat ? 1.15 : 1.3), r2: M.hipD * (coat ? 1.25 : 1.35), w: W1('hips'), v: 0 }, { c: [0, 0.86 * M.S, 0], r1: M.hipW * 1.06, r2: M.hipD * 1.1, w: W1('hips'), v: Tv(0.86 * M.S) });
  else tr.push({ c: [0, 0.86 * M.S, 0], r1: M.hipW, r2: M.hipD, w: W1('hips'), v: 0 });
  tr.push(
    { c: [0, M.hipsY + 0.02, 0], r1: M.hipW, r2: M.hipD, w: W1('hips'), v: Tv(M.hipsY + 0.02) },
    { c: [0, M.spineY, M.bellyZ], r1: M.waistW + puff, r2: M.waistD + puff, w: W2('hips', 'spine'), v: Tv(M.spineY) },
    { c: [0, M.chestY, M.f ? 0.01 : 0], r1: M.chestW + puff, r2: M.chestD + puff, w: W1('chest'), v: Tv(M.chestY) },
    { c: [0, M.shoulderY + 0.04 * M.S, 0], r1: M.chestW + puff, r2: M.chestD + puff, w: W1('chest'), v: Tv(M.shoulderY + 0.04 * M.S) },
    { c: [0, M.neckY, 0], r1: M.chestW * 0.55, r2: M.chestD * 0.6, w: W1('chest'), v: 1 },
  );
  loft(bd, tr, 8, R.torso, { pts: OCT, capStart: true, capEnd: true });
  // ---- neck: hex prism that runs up into the head
  loft(bd, [{ c: [0, M.neckY - 0.03, 0], r1: M.neckR, r2: M.neckR * 0.9, w: W1('neck'), v: 0 }, { c: [0, M.headY + 0.03, 0], r1: M.neckR, r2: M.neckR * 0.9, w: W1('head'), v: 1 }], 6, R.neck, { pts: HEX_Y });
  // ---- head: straight octagon prism, flat top and bottom; a slight jaw taper for narrow face shapes
  const hy = M.headY, H = M.headH, hw = M.headW, hd = M.headD;
  const hr = [
    { c: [0, hy, 0], r1: hw * M.jawK, r2: hd * (0.9 + 0.1 * M.jawK), w: W1('head'), v: 0 },
    { c: [0, hy + H * 0.45, 0], r1: hw, r2: hd, w: W1('head'), v: 0.45 },
    { c: [0, hy + H, 0], r1: hw, r2: hd, w: W1('head'), v: 1 },
  ];
  loft(bd, hr, 8, R.head, { pts: OCT, capStart: true, capEnd: true });
  // face plane flush with the front facet (eyes, brows, mouth, blush, beard live on their own region)
  {
    const yB = hy + 0.01, yT = hy + H - 0.01, zF = hd + 0.003, xw = hw * 0.42, w = W1('head');
    bd.quad([[-xw, yB, zF], [xw, yB, zF], [xw, yT, zF], [-xw, yT, zF]], [[R.face.x, R.face.y + R.face.h], [R.face.x + R.face.w, R.face.y + R.face.h], [R.face.x + R.face.w, R.face.y], [R.face.x, R.face.y]], [w, w, w, w], null);
  }
  // nose: triangular prism, top edge flush with the face, bottom edge sticking out (the only modelled feature)
  {
    const N = { button: [0.045, 0.06, 0.045], small: [0.042, 0.065, 0.04], pointed: [0.04, 0.075, 0.062], big: [0.06, 0.085, 0.065], wide: [0.07, 0.06, 0.045], hooked: [0.046, 0.09, 0.058] }[r.nose];
    const [nw, nh, nd] = N, yT = hy + H * 0.56, yB = yT - nh, zf = hd + 0.002, w = W1('head');
    const P = R.skin, uv = [[P.x + 2, P.y + 2], [P.x + P.w - 2, P.y + 2], [P.x + P.w / 2, P.y + P.h - 2]], W3 = [w, w, w];
    const inside = [0, (yT + yB) / 2, zf - 0.02];
    const a = [-nw / 2, yT, zf], b = [nw / 2, yT, zf], c = [nw / 2, yB, zf], d = [-nw / 2, yB, zf], e = [nw / 2, yB + (r.nose === 'hooked' ? -0.01 : 0), zf + nd], f2 = [-nw / 2, yB + (r.nose === 'hooked' ? -0.01 : 0), zf + nd];
    bd.tri([a, d, f2], uv, W3, inside); bd.tri([b, e, c], uv, W3, inside);             // sides
    bd.quad([a, b, e, f2], [uv[0], uv[1], uv[1], uv[0]], [w, w, w, w], inside);          // slanted bridge
    bd.quad([d, c, e, f2], [uv[0], uv[1], uv[1], uv[0]], [w, w, w, w], inside, 0.8);     // underside
  }
  // ---- hair
  hairGeo(bd, r, M, hr, R, W1('head'));
  // ---- arms: upper arm and forearm are separate hex prisms (T-pose along x), hand is a box
  const sleeveLen = { tee: 0.4, polo: 0.4, tank: 0, longsleeve: 1, buttonup: 1, hoodie: 1 }[r.shirt];
  for (const s of [1, -1]) {
    const L = s > 0 ? '_L' : '_R', reg = s > 0 ? R.armL : R.armR, y = M.shoulderY;
    const ar = M.armR, fr = M.foreR;
    loft(bd, [{ c: [s * (M.armX - 0.01), y, 0], r1: ar, r2: ar * 0.86, w: W1('arm' + L), v: 0 }, { c: [s * (M.elbowX + 0.012), y, 0], r1: ar * 0.92, r2: ar * 0.8, w: W1('arm' + L), v: 0.5 }], 6, reg, { axis: 'x', pts: HEX_X, capStart: true, capEnd: true });
    loft(bd, [{ c: [s * (M.elbowX - 0.012), y, 0], r1: fr, r2: fr * 0.86, w: W1('forearm' + L), v: 0.5 }, { c: [s * (M.wristX + 0.005), y, 0], r1: fr * 0.88, r2: fr * 0.78, w: W1('forearm' + L), v: 1 }], 6, reg, { axis: 'x', pts: HEX_X, capStart: true, capEnd: true });
    box(bd, M.handL, M.handH, M.handD, [s * (M.wristX + M.handL / 2), y - 0.005, 0], W1('hand' + L), R.hand, { topRow: 0.25 });
  }
  // ---- legs: straight box columns with rings at the knee for bending; box boots with a sloped toe
  for (const s of [1, -1]) {
    const L = s > 0 ? '_L' : '_R', reg = s > 0 ? R.legL : R.legR, x = s * M.legX, lw = M.legW;
    const lv = (y) => 1 - (y - M.ankleY) / (M.hipsY + 0.02 - M.ankleY);
    const rings = [M.hipsY + 0.02, 0.72 * M.S, M.kneeY, 0.32 * M.S, M.ankleY + 0.02].map((y) => ({ c: [x, y, 0], r1: lw, r2: lw, w: y > M.kneeY + 0.01 ? W1('thigh' + L) : y < M.kneeY - 0.01 ? W1('shin' + L) : W2('thigh' + L, 'shin' + L), v: 1 - lv(y) }));
    loft(bd, rings, 4, reg, { pts: BOX4, capStart: true, capEnd: true });
    // boot: box with the toe sloping down (worker: 0.16 tall at the heel, 0.04 at the toe)
    const fw = Math.max(M.footW, lw * 1.5), fh = M.footH, z0 = -0.08, z1 = M.footL - 0.08, ztoe = z1 - 0.14, wgt = W1('foot' + L), P = R.shoe, k = 0.35;
    const Q = (p, uv, tint) => bd.quad(p, uv, [wgt, wgt, wgt, wgt], [x, fh / 2, 0.05], tint);
    const full = [[P.x, P.y + P.h], [P.x + P.w, P.y + P.h], [P.x + P.w, P.y], [P.x, P.y]], top = [[P.x, P.y + P.h * 0.3], [P.x + P.w, P.y + P.h * 0.3], [P.x + P.w, P.y], [P.x, P.y]];
    const xl = x - fw / 2, xr = x + fw / 2;
    Q([[xl, 0, z0], [xr, 0, z0], [xr, fh, z0], [xl, fh, z0]], full);                              // heel
    Q([[xl, 0, z1], [xr, 0, z1], [xr, fh * k, z1], [xl, fh * k, z1]], full);                      // toe cap
    Q([[xl, fh, z0], [xr, fh, z0], [xr, fh, ztoe], [xl, fh, ztoe]], top);                          // top flat
    Q([[xl, fh, ztoe], [xr, fh, ztoe], [xr, fh * k, z1], [xl, fh * k, z1]], top);                 // toe slope
    for (const xs of [xl, xr]) {                                                                   // sides: quad + triangle
      Q([[xs, 0, z0], [xs, 0, z1], [xs, fh * k, z1], [xs, fh, ztoe]], full);
      bd.tri([[xs, fh, ztoe], [xs, fh, z0], [xs, 0, z0]], [[P.x, P.y], [P.x + P.w, P.y], [P.x + P.w, P.y + P.h]], [wgt, wgt, wgt], [x, fh / 2, 0.05]);
    }
    Q([[xl, 0, z0], [xr, 0, z0], [xr, 0, z1], [xl, 0, z1]], [[P.x, P.y + P.h], [P.x + P.w, P.y + P.h], [P.x + P.w, P.y + P.h * 0.8], [P.x, P.y + P.h * 0.8]]); // sole
  }
  // ---------------------------------------------------------------- texture
  const cv = document.createElement('canvas'); cv.width = cv.height = ATLAS;
  const g = cv.getContext('2d');
  g.fillStyle = r.skin; g.fillRect(0, 0, ATLAS, ATLAS);
  paint(g, r, M, R, { Tv, bottomY, hemY, sleeveLen, hr });
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
  // ---------------------------------------------------------------- skeleton
  const pos = {
    hips: [0, M.hipsY, 0], spine: [0, M.spineY, 0], chest: [0, M.chestY, 0], neck: [0, M.neckY, 0], head: [0, M.headY, 0], head_end: [0, M.height, 0],
    thigh_L: [M.legX, M.thighY, 0], shin_L: [M.legX, M.kneeY, 0], foot_L: [M.legX, M.ankleY, 0], toe_L: [M.legX, 0.02, 0.18],
    thigh_R: [-M.legX, M.thighY, 0], shin_R: [-M.legX, M.kneeY, 0], foot_R: [-M.legX, M.ankleY, 0], toe_R: [-M.legX, 0.02, 0.18],
    shoulder_L: [0.08, M.shoulderY, 0], arm_L: [M.armX, M.shoulderY, 0], forearm_L: [M.elbowX, M.shoulderY, 0], hand_L: [M.wristX, M.shoulderY, 0], hand_end_L: [M.handEndX, M.shoulderY, 0],
    shoulder_R: [-0.08, M.shoulderY, 0], arm_R: [-M.armX, M.shoulderY, 0], forearm_R: [-M.elbowX, M.shoulderY, 0], hand_R: [-M.wristX, M.shoulderY, 0], hand_end_R: [-M.handEndX, M.shoulderY, 0],
  };
  const bones = BONES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  BONES.forEach((n, i) => { const p = PARENT[n]; const pp = p ? pos[p] : [0, 0, 0]; bones[i].position.set(pos[n][0] - pp[0], pos[n][1] - pp[1], pos[n][2] - pp[2]); if (p) bones[bi[p]].add(bones[i]); });
  const mesh = new THREE.SkinnedMesh(bd.geometry(), mat); mesh.name = 'NPC'; mesh.frustumCulled = false;
  const root = new THREE.Group(); root.name = r.name || 'npc';
  root.add(mesh); mesh.add(bones[0]); root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  const clips = makeClips(M.hipsY);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {}; clips.forEach((c) => (actions[c.name] = mixer.clipAction(c)));
  let cur = null;
  const npc = {
    root, mesh, bones, clips, mixer, texture: tex, recipe: r, height: M.height, tris: bd.tris,
    play(name, fade = 0.15) { const a = actions[name]; if (!a || a === cur) return; a.reset().play(); if (cur) cur.crossFadeTo(a, fade, false); else a.setEffectiveWeight(1); cur = a; },
    update(dt) { mixer.update(dt); },
    dispose() { mesh.geometry.dispose(); mat.dispose(); tex.dispose(); },
  };
  root.userData.npc = npc; npc.R = R;
  return npc;
}

function makeClips(hipsY) {
  const k = hipsY / NPC_CLIPS.hipsY;
  return NPC_CLIPS.clips.map((c) => {
    const times = c.t.map((f) => f / c.fps), tracks = [];
    for (const bone in c.q) tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, c.q[bone].flat()));
    tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, c.hips.flatMap(([y, z]) => [0, hipsY + (y - NPC_CLIPS.hipsY) * k, z])));
    return new THREE.AnimationClip(c.name, c.frames / c.fps, tracks);
  });
}

// ---------------------------------------------------------------- hair geometry
// Hair is a slightly larger octagon slab sitting on the head prism (flat top, like a helmet of hair), plus a few box slabs.
function hairGeo(bd, r, M, hr, R, w) {
  const st = r.hair; if (st === 'bald' || st === 'buzz') return;
  const hy = M.headY, H = M.headH, hw = M.headW, hd = M.headD;
  const browY = hy + H * 0.78, topY = hy + H;
  const cap = (k = 1.08, up = 0.015, down = 0) => loft(bd, [
    { c: [0, browY - down, 0], r1: hw * k, r2: hd * k, w, v: 0.1 },
    { c: [0, topY + up, 0], r1: hw * k, r2: hd * k, w, v: 0.95 },
  ], 8, R.hair, { pts: OCT, capEnd: true });
  const fringe = (dx = 0, wid = hw * 1.5, drop = 0.025) => box(bd, wid, drop, 0.04, [dx, browY - drop / 2 + 0.01, hd * 1.08 - 0.01], w, R.hair);
  const side = (yTop, yBot, thick = 0.045) => { for (const s of [-1, 1]) box(bd, thick, yTop - yBot, hd * 1.5, [s * (hw * 1.08 + thick / 2), (yTop + yBot) / 2, -hd * 0.2], w, R.hair); };
  const back = (yTop, yBot, thick = 0.05) => box(bd, hw * 2.16, yTop - yBot, thick, [0, (yTop + yBot) / 2, -(hd * 1.08 + thick / 2)], w, R.hair);
  if (st === 'short') { cap(); fringe(0, hw * 1.2, 0.03); }
  if (st === 'sidepart') { cap(1.08, 0.02); fringe(hw * 0.4, hw * 1.1, 0.045); }
  if (st === 'spiky') { cap(1.06, 0.01); for (let i = 0; i < 5; i++) { const x = (i - 2) * hw * 0.42, z = -0.01 + (i % 2) * 0.03; wedge(bd, [[x - 0.03, topY + 0.005, z - 0.03], [x + 0.03, topY + 0.005, z - 0.03], [x + 0.03, topY + 0.005, z + 0.03], [x - 0.03, topY + 0.005, z + 0.03]], [x + (i - 2) * 0.015, topY + 0.1, z + 0.01], w, R.hair); } }
  if (st === 'curly') { cap(1.3, 0.08, 0.02); fringe(0, hw * 1.7, 0.05); side(browY, hy + H * 0.35, 0.06); }
  if (st === 'bob') { cap(1.1, 0.02); fringe(0, hw * 1.6, 0.04); side(browY, hy + 0.02, 0.05); back(browY, hy, 0.06); }
  if (st === 'long') { cap(1.1, 0.02); if (r.sex === 'female') fringe(0, hw * 1.6, 0.04); side(browY, hy - 0.1, 0.045); back(browY, hy - 0.26, 0.06); }
  if (st === 'ponytail') {
    cap(1.08, 0.02); if (r.sex === 'female') fringe(hw * 0.3, hw * 1.0, 0.045);
    loft(bd, [{ c: [0, topY - 0.03, -hd * 1.1], r1: 0.045, r2: 0.045, w, v: 0.9 }, { c: [0, hy + 0.06, -hd * 1.3], r1: 0.04, r2: 0.035, w, v: 0.5 }, { c: [0, hy - 0.12, -hd * 1.15], r1: 0.022, r2: 0.018, w, v: 0.1 }], 5, R.tail, { capStart: true, capEnd: true });
  }
  if (st === 'bun') { cap(1.08, 0.02); box(bd, 0.1, 0.09, 0.09, [0, topY - 0.02, -hd * 1.05], w, R.hair); }
  if (st === 'mohawk') { for (let i = 0; i < 4; i++) box(bd, 0.05, 0.1 + (i === 1 || i === 2 ? 0.02 : 0), 0.065, [0, topY + 0.04 + (i === 1 || i === 2 ? 0.01 : 0), hd * 0.65 - i * 0.06], w, R.hair); }
}

// ---------------------------------------------------------------- texture painting
function paint(g, r, M, R, X) {
  const { Tv, hemY, sleeveLen, hr } = X;
  const skin = r.skin, hairC = r.hairColor, shirtC = r.shirtColor, pantsC = r.pantsColor, jackC = r.jacketColor;
  const dark = (c) => shade(c, 0.72), light = (c) => shade(c, 1.25);
  const rng = rnd(7);
  const px = (v) => Math.round(v);
  const rect = (x, y, w, h, c) => { if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; } g.fillStyle = c; g.fillRect(px(x), px(y), Math.max(1, px(w)), Math.max(1, px(h))); };
  const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(px(p[0]), px(p[1])) : g.moveTo(px(p[0]), px(p[1])))); g.closePath(); g.fill(); };
  // strip helpers: cx(uRel) = x of a point uRel facets from the front centre; cy(v) = row for ring param v
  const strip = (Rg, n) => ({ cx: (u) => Rg.x + (n / 2 - 0.5 + u) * (Rg.w / n), cy: (v) => Rg.y + (1 - v) * Rg.h, fw: Rg.w / n, R: Rg });
  const jacket = r.jacket, hasJ = jacket !== 'none', coat = jacket === 'coat', skirt = r.pants === 'skirt';
  // ---- torso
  {
    const T = strip(R.torso, 8), { cx, cy, fw } = T, Rt = R.torso;
    const beltY = M.hipsY + 0.07 * M.S;
    rect(Rt.x, Rt.y, Rt.w, Rt.h, shirtC);
    const vBelt = Tv(beltY);
    rect(Rt.x, cy(vBelt), Rt.w, Rt.h - (cy(vBelt) - Rt.y), skirt ? r.pantsColor : pantsC);
    if (skirt && hemY != null) { rect(Rt.x, cy(Tv(0.80 * M.S)), Rt.w, cy(0) - cy(Tv(0.80 * M.S)) + 1, pantsC); rect(Rt.x, cy(0) - 2, Rt.w, 2, dark(pantsC)); rect(cx(-0.1), cy(vBelt), 1, cy(0) - cy(vBelt), shade(pantsC, 0.85)); }
    // belt + buckle (not for sweats or skirt)
    if (!skirt && r.pants !== 'sweats') { rect(Rt.x, cy(vBelt) - 1, Rt.w, 3, '#3a2a1a'); rect(cx(-0.2), cy(vBelt) - 1, fw * 0.4, 3, '#c8b060'); }
    else if (!skirt) rect(Rt.x, cy(vBelt) - 1, Rt.w, 2, dark(pantsC));
    // back pockets
    if (!skirt) { rect(cx(3.6), cy(vBelt) + 4, fw * 0.35, 5, dark(pantsC)); rect(cx(4.05), cy(vBelt) + 4, fw * 0.35, 5, dark(pantsC)); }
    const top = cy(1), shirtTop = top, neckW = fw * 0.55;
    // shirt styles (front)
    if (r.shirt === 'tee' || r.shirt === 'longsleeve') rect(cx(-0.55), shirtTop, fw * 1.1, 2, dark(shirtC));
    if (r.shirt === 'polo') { poly([[cx(-1.0), shirtTop], [cx(-0.05), shirtTop], [cx(-0.05), shirtTop + 10]], light(shirtC)); poly([[cx(1.0), shirtTop], [cx(0.05), shirtTop], [cx(0.05), shirtTop + 10]], light(shirtC)); rect(cx(0), shirtTop, 1, 14, dark(shirtC)); rect(cx(-0.05), shirtTop + 11, 2, 2, '#f0f0e0'); rect(cx(-0.05), shirtTop + 15, 2, 2, '#f0f0e0'); rect(Rt.x, shirtTop, Rt.w, 3, light(shirtC)); }
    if (r.shirt === 'buttonup') { rect(cx(0), shirtTop, 1, cy(vBelt) - shirtTop, dark(shirtC)); for (let y = shirtTop + 5; y < cy(vBelt) - 2; y += 6) rect(cx(0) - 1, y, 2, 2, '#f4f4ee'); poly([[cx(-0.75), shirtTop], [cx(0), shirtTop], [cx(-0.05), shirtTop + 6]], light(shirtC)); poly([[cx(0.75), shirtTop], [cx(0), shirtTop], [cx(0.05), shirtTop + 6]], light(shirtC)); rect(cx(0.6), shirtTop + 12, fw * 0.55, 6, dark(shirtC)); }
    if (r.shirt === 'hoodie') { rect(cx(-0.9), cy(vBelt) - 10, fw * 1.8, 8, dark(shirtC)); rect(cx(-0.12), shirtTop + 2, 1, 8, '#f0f0f0'); rect(cx(0.12), shirtTop + 2, 1, 8, '#f0f0f0'); poly([[cx(2.6), shirtTop], [cx(5.4), shirtTop], [cx(5.0), shirtTop + 12], [cx(3.0), shirtTop + 12]], light(shirtC)); rect(cx(3.0), shirtTop + 12, fw * 2, 2, dark(shirtC)); }
    if (r.shirt === 'tank') {
      const yArm = cy(Tv(M.chestY + 0.03));
      rect(Rt.x, top, Rt.w, yArm - top, skin);                                  // bare shoulders and upper chest all round
      for (const u of [-1.5, 1.0, 2.5, -3.0]) rect(cx(u), top, fw * 0.5, yArm - top, shirtC);   // straps (front pair, back pair)
      poly([[cx(-1.5), yArm], [cx(1.5), yArm], [cx(1.5), yArm - 6], [cx(0), yArm - 1], [cx(-1.5), yArm - 6]], shirtC);   // scoop neck
      poly([[cx(2.5), yArm], [cx(4.5), yArm], [cx(4.5), yArm - 7], [cx(2.5), yArm - 7]], shirtC); poly([[cx(-2.5), yArm], [cx(-3.5), yArm], [cx(-3.5), yArm - 7], [cx(-2.5), yArm - 7]], shirtC);
    }
    // jacket over the shirt
    if (hasJ) {
      const jTop = top, jBot = coat ? cy(0) : cy(vBelt) + (jacket === 'vest' ? -1 : 3);
      const gapT = jacket === 'vest' ? 0.9 : jacket === 'zip' ? 0.06 : 0.75, gapB = jacket === 'vest' ? 0.08 : jacket === 'zip' ? 0.06 : coat ? 0.55 : 0.35;
      const gy = jacket === 'vest' ? jTop + 16 : jBot;                            // vest: V-neck only
      // left and right panels, leaving a gap down the front
      poly([[Rt.x, jTop], [cx(-gapT), jTop], [cx(-gapB), gy], [cx(-gapB), jBot], [Rt.x, jBot]], jackC);
      poly([[Rt.x + Rt.w, jTop], [cx(gapT), jTop], [cx(gapB), gy], [cx(gapB), jBot], [Rt.x + Rt.w, jBot]], jackC);
      if (jacket === 'vest') { for (let y = gy + 4; y < jBot - 2; y += 6) rect(cx(0) - 1, y, 2, 2, '#f4f4ee'); rect(cx(-gapT) - 2, jTop, 2, 6, shirtC); }
      if (jacket === 'blazer' || coat) { poly([[cx(-gapT), jTop], [cx(-gapT - 0.9), jTop], [cx(-gapT - 0.9), jTop + 4], [cx(-gapB), gy - (coat ? 30 : 8)], [cx(-gapB), gy - (coat ? 36 : 14)]], dark(jackC)); poly([[cx(gapT), jTop], [cx(gapT + 0.9), jTop], [cx(gapT + 0.9), jTop + 4], [cx(gapB), gy - (coat ? 30 : 8)], [cx(gapB), gy - (coat ? 36 : 14)]], dark(jackC)); }
      if (jacket === 'open') { rect(cx(-gapT) - 1, jTop, 1, jBot - jTop, dark(jackC)); rect(cx(gapT), jTop, 1, jBot - jTop, dark(jackC)); rect(Rt.x, jTop, Rt.w, 2, dark(jackC)); }
      if (jacket === 'zip') { rect(cx(0) - 1, jTop, 1, jBot - jTop, light(jackC)); rect(Rt.x, jTop, Rt.w, 3, dark(jackC)); rect(cx(1.3), cy(Tv(M.spineY)) - 2, fw * 0.5, 2, dark(jackC)); rect(cx(-1.8), cy(Tv(M.spineY)) - 2, fw * 0.5, 2, dark(jackC)); }
      if (coat) { rect(Rt.x, cy(Tv(M.hipsY)) - 1, Rt.w, 3, dark(jackC)); rect(Rt.x, jBot - 3, Rt.w, 3, dark(jackC)); rect(cx(1.4), cy(Tv(M.hipsY)) + 6, fw * 0.8, 8, dark(jackC)); rect(cx(-2.2), cy(Tv(M.hipsY)) + 6, fw * 0.8, 8, dark(jackC)); }
      rect(cx(3.95), jTop, 1, jBot - jTop, dark(jackC));                        // back seam
    }
    // shoulders: a darker row at the very top hides the neck hole seam
    rect(Rt.x, top, Rt.w, 1, dark(hasJ && jacket !== 'vest' ? jackC : r.shirt === 'tank' ? skin : shirtC));
  }
  // ---- neck
  rect(R.neck.x, R.neck.y, R.neck.w, R.neck.h, skin);
  // ---- arms (v 0 = shoulder, 1 = wrist)
  for (const Ra of [R.armL, R.armR]) {
    const A = strip(Ra, 6), { cx, cy } = A;
    rect(Ra.x, Ra.y, Ra.w, Ra.h, skin);
    const sleeveC = hasJ && r.jacket !== 'vest' ? jackC : shirtC, len = hasJ && r.jacket !== 'vest' ? 1 : sleeveLen;
    if (len > 0) {
      const y0 = cy(0), y1 = cy(len);
      rect(Ra.x, Math.min(y0, y1), Ra.w, Math.abs(y1 - y0), sleeveC);
      rect(Ra.x, Math.max(y0, y1) - 3, Ra.w, 3, len >= 1 ? light(sleeveC) : dark(sleeveC));          // cuff / hem
      if (r.shirt === 'polo' && !hasJ) rect(Ra.x, Math.max(y0, y1) - 3, Ra.w, 1, '#f0f0e0');
    }
    // knuckle-side shading lines on the forearm (worker-style wrist crease)
    rect(Ra.x, cy(1), Ra.w, 1, dark(skin));
  }
  // hand patch
  rect(R.hand.x, R.hand.y, R.hand.w, R.hand.h, skin); for (let i = 0; i < 3; i++) { rect(R.hand.x + 5 + i * 5, R.hand.y + 1, 1, 3, dark(skin)); rect(R.hand.x + 5 + i * 5, R.hand.y + 8, 1, R.hand.h - 9, dark(skin)); } rect(R.hand.x, R.hand.y + 7, R.hand.w, 1, dark(skin));
  rect(R.skin.x, R.skin.y, R.skin.w, R.skin.h, skin);
  // ---- legs (v 0 = hip, 1 = ankle)
  for (const Rl of [R.legL, R.legR]) {
    const Lg = strip(Rl, 4), { cx, cy, fw } = Lg;
    rect(Rl.x, Rl.y, Rl.w, Rl.h, skin);
    const p = r.pants, legLen = p === 'shorts' ? 0.42 : skirt ? 0 : 1;
    if (legLen > 0) {
      rect(Rl.x, cy(0), Rl.w, cy(legLen) - cy(0), pantsC);
      if (p === 'shorts') rect(Rl.x, cy(legLen) - 2, Rl.w, 2, dark(pantsC));
      if (p === 'jeans') { rect(cx(-1), cy(0), 1, cy(legLen) - cy(0), light(pantsC)); rect(cx(1), cy(0), 1, cy(legLen) - cy(0), light(pantsC)); poly([[cx(-0.5), cy(0)], [cx(-0.1), cy(0)], [cx(-0.5), cy(0) + 9]], light(pantsC)); rect(cx(1.6), cy(0) + 5, fw * 0.45, 8, light(pantsC)); rect(cx(-2.05), cy(0) + 5, fw * 0.45, 8, light(pantsC)); rect(Rl.x, cy(1), Rl.w, 2, light(pantsC)); }
      if (p === 'slacks') { rect(cx(0), cy(0), 1, cy(1) - cy(0), dark(pantsC)); }
      if (p === 'cargo') { for (const u of [1, -1]) { rect(cx(u) - fw * 0.35, cy(0.3), fw * 0.7, 14, dark(pantsC)); rect(cx(u) - fw * 0.35, cy(0.3), fw * 0.7, 4, shade(pantsC, 0.6)); } }
      if (p === 'sweats') { rect(cx(-1), cy(0), 2, cy(1) - cy(0), '#f0f0f0'); rect(cx(1), cy(0), 2, cy(1) - cy(0), '#f0f0f0'); rect(Rl.x, cy(1), Rl.w, 3, dark(pantsC)); }
    }
    if (skirt || p === 'shorts') rect(Rl.x, cy(1), Rl.w, 4, '#f0f0f0');     // socks
  }
  // shoe patch
  rect(R.shoe.x, R.shoe.y, R.shoe.w, R.shoe.h, r.shoeColor); rect(R.shoe.x, R.shoe.y + R.shoe.h - 4, R.shoe.w, 4, shade(r.shoeColor, 0.55)); rect(R.shoe.x + 6, R.shoe.y + 4, 8, 1, light(r.shoeColor)); rect(R.shoe.x + 6, R.shoe.y + 7, 8, 1, light(r.shoeColor));
  // ---- hair patch (strands) and tail
  const hd = dark(hairC), hl = light(hairC);
  rect(R.hair.x, R.hair.y, R.hair.w, R.hair.h, hairC); for (let i = 0; i < 10; i++) rect(R.hair.x + 1 + i * 2.3, R.hair.y + rng() * 8, 1, 10 + rng() * 12, i % 3 ? hd : hl);
  rect(R.tail.x, R.tail.y, R.tail.w, R.tail.h, hairC); for (let i = 0; i < 5; i++) rect(R.tail.x + 2 + i * 4, R.tail.y, 1, R.tail.h, hd); rect(R.tail.x, R.tail.y + 1, R.tail.w, 2, '#3a3a3a');
  // ---- head ring: skin, hairline band, ears, sideburns
  {
    const Hd = strip(R.head, 8), { cx, cy, fw } = Hd, Rh = R.head;
    rect(Rh.x, Rh.y, Rh.w, Rh.h, skin);
    const vBrow = 0.72, vCheek = 0.5, vJaw = 0.22;
    const st = r.hair;
    if (st !== 'bald') {
      // scalp under the cap / buzz cut: hair colour from the crown down to just above the brow, lower at the back
      const yTop = Rh.y, yBrow = cy(vBrow) + (st === 'buzz' ? 1 : 3);
      rect(Rh.x, yTop, Rh.w, yBrow - yTop, st === 'buzz' ? mix(hairC, skin, 0.35) : hairC);
      if (st === 'mohawk') { rect(Rh.x, yTop, Rh.w, yBrow - yTop, mix(hairC, skin, 0.55)); }
      // leave the forehead: the front facet keeps skin a bit higher (hairline)
      if (st === 'buzz') rect(cx(-0.5), yBrow - 3, fw, 3, skin);
      // back of the head hair comes lower (nape), sideburns on the cheeks
      if (st !== 'buzz' && st !== 'mohawk') { rect(cx(3), yBrow, fw * 2, cy(vCheek) - yBrow, hairC); rect(cx(-4), yBrow, fw, cy(vCheek) - yBrow, hairC); }
      rect(cx(-2.0), yBrow, 2, 4, hairC); rect(cx(2.0) - 2, yBrow, 2, 4, hairC);
    } else { rect(Rh.x, Rh.y, Rh.w, 2, light(skin)); }
    // ears painted on the side facets
    for (const u of [-2, 2]) { rect(cx(u) - 2, cy(0.66), 5, 7, dark(skin)); rect(cx(u) - 1, cy(0.66) + 1, 3, 5, skin); rect(cx(u), cy(0.66) + 3, 1, 2, dark(skin)); }
    // facial hair wraps onto the jaw facets
    if (r.facialHair === 'beard') { rect(cx(-1.5), cy(vCheek) + 1, fw * 3, cy(0) - cy(vCheek) - 1, hairC); }
    if (r.facialHair === 'stubble') { rect(cx(-1.5), cy(vJaw) - 2, fw * 3, cy(0) - cy(vJaw) + 2, mix(skin, hairC, 0.3)); }
  }
  // ---- face (48 x 48): big low eyes two thirds up, tiny mouth, blush, facial hair wrapping onto the jaw
  {
    const F = R.face, f = r.sex === 'female';
    rect(F.x, F.y, F.w, F.h, skin);
    const ex = [F.x + 13, F.x + 35], ey = F.y + 21;                      // eye centres ~58% up the face
    const browC = r.hair === 'bald' ? '#3a2a1a' : hairC;
    for (const x of ex) {
      rect(x - 5, ey - 2, 10, 6, '#f8f8f8');
      rect(x - 1, ey - 2, 4, 6, '#2a2018');
      rect(x - 5, ey - 3, 10, 1, dark(skin));
      if (f) { rect(x - 6, ey - 3, 1, 2, '#1a1410'); rect(x + 5, ey - 3, 1, 2, '#1a1410'); }
      rect(x - 5, ey - 6, 10, 2, browC);
    }
    if (f) rect(F.x + 20, F.y + 36, 8, 2, '#b04050'); else rect(F.x + 20, F.y + 37, 8, 1, dark(skin));
    if (f) { rect(F.x + 4, F.y + 27, 5, 2, mix(skin, '#ff6080', 0.45)); rect(F.x + 39, F.y + 27, 5, 2, mix(skin, '#ff6080', 0.45)); }
    const fh = r.facialHair;
    if (fh === 'moustache' || fh === 'beard') rect(F.x + 14, F.y + 32, 20, 3, hairC);
    if (fh === 'goatee') { rect(F.x + 16, F.y + 32, 16, 2, hairC); rect(F.x + 19, F.y + 40, 10, 8, hairC); }
    if (fh === 'beard') { rect(F.x, F.y + 33, F.w, F.h - 33, hairC); rect(F.x + 20, F.y + 37, 8, 2, dark(hairC)); }
    if (fh === 'stubble') { rect(F.x, F.y + 34, F.w, F.h - 34, mix(skin, hairC, 0.3)); }
    if (['short', 'sidepart', 'bob', 'curly'].includes(r.hair) || (r.hair === 'long' && f)) rect(F.x, F.y, F.w, 2, hairC);
  }
}
