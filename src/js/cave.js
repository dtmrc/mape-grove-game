// "The Hollow Deep" easter egg for Maple Grove: Off Leash (2026-11-26, diet's idea).
// Hidden in the far west of Hollow Woods: a cave mouth in a rock face with a torch on a post. Take the torch, go in, follow
// a winding tunnel down (a depth gauge counts it), climb down a very long rope, and arrive 1,940 m under the woods in the
// dwelling of a ghost: the Ghost of John, a gentle, chicken-stealing, slightly too devoted haunter of Goobles. Campfire,
// portraits of himself, cave paintings, chests of every kind, bronze cats, poems about watching the cat sleep.
//
// Rooms go through interiors.js (registerRoom; rendered on layer 1 far off the map), so collisions, camera, saves and
// exits work like every other interior. The cave door is closed (no marker) until the torch is in Goobles' paw.
// Wired into game.js by tools/cave-hooks.mjs. Debug: window.__CAVE (.tp(), .torch(), .goLair(), .S, .reset()).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, basic, phong } from './gfx.js';
import { colliders, lights, CAVE_SPOT } from './world.js';
import { heightAt } from './terrain.js';
import * as INTM from './interiors.js';

const KEY = 'mg-cave-v1';
const TUNNEL_DEPTH = 340, LAIR_DEPTH = 1940;
const GHOST = 'GHOST OF JOHN';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let sd = 1940;
const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
const rnd = (a, b) => a + rr() * (b - a);
// smooth 3D value noise in -1..1 for rock surfaces (deterministic, no Math.random)
const nh = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 0xffff) / 32767.5 - 1; };
function rockN(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => nh(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// ------------------------------------------------------------------ textures ------------------------------------------------------------------
function ctex(w, h, draw, nearest = true, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
let TX = null;
function textures() {
  if (TX) return TX;
  const speck = (g, w, h, n, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(rr() * cols.length) | 0]; g.fillRect(rr() * w | 0, rr() * h | 0, 1 + (rr() * 2 | 0), 1 + (rr() * 2 | 0)); } };
  TX = {
    // 128 px, mip-mapped (2026-11-27): blotchy limestone with strata bands, cracks and lit edges; gravel with pebbles
    rock: ctex(128, 128, (g) => {
      g.fillStyle = '#6a625a'; g.fillRect(0, 0, 128, 128);
      for (let k = 0; k < 60; k++) { const r = rnd(6, 22); g.fillStyle = ['rgba(90,82,72,0.35)', 'rgba(130,120,104,0.3)', 'rgba(70,64,56,0.35)', 'rgba(120,96,70,0.25)'][k % 4]; g.beginPath(); g.ellipse(rr() * 128, rr() * 128, r, r * rnd(0.4, 0.9), rnd(0, 3), 0, 7); g.fill(); }
      for (let y = 6; y < 128; y += rnd(9, 18)) { g.fillStyle = 'rgba(40,34,28,0.35)'; g.fillRect(0, y | 0, 128, 1); g.fillStyle = 'rgba(170,156,136,0.18)'; g.fillRect(0, (y | 0) + 1, 128, 1); }
      speck(g, 128, 128, 1400, ['#5a524a', '#7a7268', '#4e4840', '#847a6e', '#5f5850', '#9a9080']);
      g.lineWidth = 1;
      for (let k = 0; k < 14; k++) { let x = rr() * 128, y = rr() * 128; const pts = [[x, y]]; for (let q = 0; q < 6; q++) { x += rnd(-12, 12); y += rnd(-9, 9); pts.push([x, y]); }
        g.strokeStyle = 'rgba(24,20,16,0.7)'; g.beginPath(); pts.forEach(([a, b], q) => (q ? g.lineTo(a, b) : g.moveTo(a, b))); g.stroke();
        g.strokeStyle = 'rgba(190,176,150,0.25)'; g.beginPath(); pts.forEach(([a, b], q) => (q ? g.lineTo(a + 1, b + 1) : g.moveTo(a + 1, b + 1))); g.stroke(); }
    }, false, true),
    dirt: ctex(128, 128, (g) => {
      g.fillStyle = '#4e4034'; g.fillRect(0, 0, 128, 128);
      speck(g, 128, 128, 2200, ['#433628', '#5a4a3a', '#3a2e24', '#625040', '#6e5c48']);
      for (let k = 0; k < 70; k++) { const x = rr() * 128, y = rr() * 128, r = rnd(1.5, 4); g.fillStyle = 'rgba(20,14,10,0.5)'; g.beginPath(); g.ellipse(x + 1, y + 1, r, r * 0.7, 0, 0, 7); g.fill(); g.fillStyle = ['#7a6a58', '#8a7a66', '#6a5c4c'][k % 3]; g.beginPath(); g.ellipse(x, y, r, r * 0.7, rnd(0, 3), 0, 7); g.fill(); g.fillStyle = 'rgba(255,240,210,0.25)'; g.fillRect(x - r * 0.4, y - r * 0.4, 1, 1); }
    }, false, true),
    flame: ctex(32, 64, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h * 0.68, 1, w / 2, h * 0.62, h * 0.45);
      grd.addColorStop(0, 'rgba(255,250,210,1)'); grd.addColorStop(0.3, 'rgba(255,200,80,0.95)'); grd.addColorStop(0.65, 'rgba(255,110,20,0.55)'); grd.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2, 0); g.quadraticCurveTo(w * 1.05, h * 0.62, w / 2, h * 0.98); g.quadraticCurveTo(-w * 0.05, h * 0.62, w / 2, 0); g.fill();
    }, false),
    glow: ctex(32, 32, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, false),
    hole: ctex(32, 32, (g, w, h) => {   // the cave mouth: black in the middle, a little rock showing round the rim
      const grd = g.createRadialGradient(w / 2, h * 0.9, 1, w / 2, h * 0.75, w * 0.62); grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.75, 'rgba(6,5,4,1)'); grd.addColorStop(1, 'rgba(30,26,22,1)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, false),
    face: ctex(32, 32, (g) => {   // the ghost's face plane: pale, small eyes behind the specs, long nose, moustache and beard
      g.fillStyle = '#dde6f8'; g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#c6d0e8'; g.fillRect(0, 0, 32, 3); g.fillRect(0, 0, 3, 32); g.fillRect(29, 0, 3, 32);
      g.fillStyle = '#3a4660'; g.fillRect(9, 12, 3, 2); g.fillRect(20, 12, 3, 2);                 // eyes
      g.fillStyle = '#aab6d4'; g.fillRect(8, 10, 5, 1); g.fillRect(19, 10, 5, 1);                 // brows
      g.fillStyle = '#b4c0dc'; g.fillRect(15, 13, 2, 7); g.fillRect(14, 19, 4, 1);                // long nose
      g.fillStyle = '#8f8a86'; g.fillRect(10, 21, 12, 2); g.fillRect(9, 22, 2, 3); g.fillRect(21, 22, 2, 3); // moustache
      g.fillStyle = '#a19a94'; g.fillRect(9, 25, 14, 7); g.fillRect(7, 23, 2, 9); g.fillRect(23, 23, 2, 9); // beard
      g.fillStyle = '#5a5a6a'; g.fillRect(14, 24, 4, 1);                                          // mouth
    }),
    parchment: ctex(32, 40, (g) => {
      g.fillStyle = '#e8dcb4'; g.fillRect(0, 0, 32, 40); speck(g, 32, 40, 60, ['#d8c89c', '#cdbd90', '#efe4c4']);
      g.fillStyle = '#4a3a2a'; g.fillRect(5, 4, 22, 2);
      for (let y = 10; y < 36; y += 3) g.fillRect(4, y, 12 + (rr() * 12 | 0), 1);
      g.fillStyle = '#b02a2a'; g.fillRect(14, 0, 4, 3);   // a red pin
    }),
    wicker: ctex(32, 32, (g) => {
      g.fillStyle = '#b08a52'; g.fillRect(0, 0, 32, 32);
      for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? '#8a6a3a' : '#c8a066'; g.fillRect(x, y, 4, 2); }
    }, true, true),
  };
  return TX;
}
/** A sign texture whose text always fits (gfx.js signTex crops long text). */
function fitSign(text, bg, fg, w = 256, h = 64) {
  return ctex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    let fs = Math.round(h * 0.62); g.font = `bold ${fs}px Impact, "Arial Black", sans-serif`;
    while (fs > 6 && g.measureText(text).width > w * 0.92) { fs--; g.font = `bold ${fs}px Impact, "Arial Black", sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 1);
    if (bg) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); }
  }, false);
}
const flameMat = () => new THREE.SpriteMaterial({ map: textures().flame, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const glowMat = (c, o = 1) => new THREE.SpriteMaterial({ map: textures().glow, color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

// portraits of himself: a sepia "photo" (photo) or an oil painting (paint) of the ghost, a few poses
function portraitTex(kind) {
  return ctex(48, 60, (g) => {
    const photo = kind !== 'paint' && kind !== 'chicken';
    g.fillStyle = photo ? '#b8a27a' : kind === 'chicken' ? '#3a5a4a' : '#2a3a5a'; g.fillRect(0, 0, 48, 60);
    if (!photo) { for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${rr() * 0.08})`; g.fillRect(rr() * 48 | 0, rr() * 60 | 0, 3, 2); } }
    const skin = photo ? '#e0d0b0' : '#dfe8fa', hair = photo ? '#5a4632' : '#8a7a6a', beard = photo ? '#6a5640' : '#9a928a';
    const cx = kind === 'haunt' ? 20 : 24;
    // shoulders / robe
    g.fillStyle = photo ? '#d8c8a8' : '#e8eefc'; g.beginPath(); g.moveTo(cx - 16, 60); g.lineTo(cx - 12, 44); g.lineTo(cx + 12, 44); g.lineTo(cx + 16, 60); g.fill();
    if (kind === 'haunt') { g.globalAlpha = 0.6; g.fillRect(cx + 12, 30, 14, 4); g.fillRect(cx + 24, 26, 4, 8); g.globalAlpha = 1; }   // a wave, "boo"
    // long centre-parted hair
    g.fillStyle = hair; g.fillRect(cx - 11, 12, 22, 30); g.fillRect(cx - 12, 18, 3, 26); g.fillRect(cx + 9, 18, 3, 26);
    // face
    g.fillStyle = skin; g.fillRect(cx - 7, 16, 14, 22);
    g.fillStyle = hair; g.fillRect(cx - 7, 13, 6, 5); g.fillRect(cx + 1, 13, 6, 5); g.fillStyle = skin; g.fillRect(cx - 1, 13, 2, 3);   // centre part
    // round glasses
    g.strokeStyle = photo ? '#2a2418' : '#e8e8f0'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx - 3.5, 24, 3, 0, 7); g.stroke(); g.beginPath(); g.arc(cx + 3.5, 24, 3, 0, 7); g.stroke();
    g.fillStyle = photo ? '#2a2418' : '#3a4660'; g.fillRect(cx - 4, 24, 1, 1); g.fillRect(cx + 3, 24, 1, 1);
    g.fillStyle = beard; g.fillRect(cx - 5, 30, 10, 2); g.fillRect(cx - 6, 32, 12, 7); g.fillStyle = '#4a3a2a'; g.fillRect(cx - 2, 33, 4, 1);
    if (kind === 'chicken') {   // "Self-portrait with chicken": a brown hen tucked under one arm
      g.fillStyle = '#8a5a2a'; g.fillRect(cx + 6, 44, 12, 8); g.fillRect(cx + 15, 39, 5, 6); g.fillStyle = '#d02020'; g.fillRect(cx + 16, 37, 3, 2); g.fillStyle = '#e8b020'; g.fillRect(cx + 20, 41, 2, 1);
    }
    if (kind === 'bronze') { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#c08040'; g.fillRect(0, 0, 48, 60); g.globalCompositeOperation = 'source-over'; }
    if (photo) { g.fillStyle = 'rgba(80,60,30,0.25)'; g.fillRect(0, 0, 48, 3); g.fillRect(0, 57, 48, 3); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,240,210,0.4)'; g.fillRect(rr() * 48 | 0, rr() * 60 | 0, 1, 1); } }
  });
}
// cave paintings in ochre and charcoal, drawn the way a ghost with no art training and a lot of time would
function cavePaintingTex(which) {
  return ctex(256, 112, (g) => {
    g.clearRect(0, 0, 256, 112);
    const ochre = 'rgba(176,84,40,0.92)', coal = 'rgba(28,22,20,0.9)', chalk = 'rgba(230,226,210,0.85)';
    g.lineWidth = 3; g.lineCap = 'round';
    const ghost = (x, y, s = 1) => {   // a sheet with a face, long hair and round specs
      g.strokeStyle = chalk; g.fillStyle = 'rgba(230,226,210,0.35)';
      g.beginPath(); g.moveTo(x - 10 * s, y + 26 * s); g.quadraticCurveTo(x - 12 * s, y - 14 * s, x, y - 16 * s); g.quadraticCurveTo(x + 12 * s, y - 14 * s, x + 10 * s, y + 26 * s);
      for (let k = 0; k < 4; k++) g.lineTo(x + (10 - 5 * (k + 1)) * s, y + (k % 2 ? 26 : 20) * s);
      g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = coal; g.lineWidth = 2; g.beginPath(); g.arc(x - 4 * s, y - 6 * s, 3 * s, 0, 7); g.stroke(); g.beginPath(); g.arc(x + 4 * s, y - 6 * s, 3 * s, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(x - 9 * s, y - 12 * s); g.lineTo(x - 11 * s, y + 4 * s); g.moveTo(x + 9 * s, y - 12 * s); g.lineTo(x + 11 * s, y + 4 * s); g.stroke(); g.lineWidth = 3;
    };
    const cat = (x, y, s = 1, sleep = false) => {   // tall ears, one chewed, yellow eyes
      g.strokeStyle = coal; g.fillStyle = 'rgba(240,240,236,0.7)';
      if (sleep) { g.beginPath(); g.ellipse(x, y + 8 * s, 16 * s, 8 * s, 0, 0, 7); g.fill(); g.stroke(); }
      else { g.beginPath(); g.moveTo(x - 8 * s, y + 22 * s); g.lineTo(x - 6 * s, y); g.lineTo(x + 6 * s, y); g.lineTo(x + 8 * s, y + 22 * s); g.closePath(); g.fill(); g.stroke(); }
      const hy = sleep ? y + 2 * s : y - 6 * s, hx = sleep ? x + 12 * s : x;
      g.beginPath(); g.moveTo(hx - 7 * s, hy + 6 * s); g.lineTo(hx - 7 * s, hy - 12 * s); g.lineTo(hx - 3 * s, hy - 2 * s); g.lineTo(hx + 3 * s, hy - 2 * s); g.lineTo(hx + 7 * s, hy - 8 * s); g.lineTo(hx + 7 * s, hy + 6 * s); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = sleep ? coal : 'rgba(236,190,40,0.95)';
      if (sleep) { g.fillRect(hx - 5 * s, hy + 1 * s, 3 * s, 1); g.fillRect(hx + 2 * s, hy + 1 * s, 3 * s, 1); } else { g.fillRect(hx - 5 * s, hy, 3 * s, 2 * s); g.fillRect(hx + 2 * s, hy, 3 * s, 2 * s); }
    };
    const hen = (x, y) => { g.strokeStyle = ochre; g.beginPath(); g.ellipse(x, y, 7, 5, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x + 6, y - 3); g.lineTo(x + 9, y - 9); g.lineTo(x + 12, y - 7); g.stroke(); g.beginPath(); g.moveTo(x - 2, y + 5); g.lineTo(x - 3, y + 10); g.moveTo(x + 2, y + 5); g.lineTo(x + 3, y + 10); g.stroke(); };
    const text = (t, x, y, sz = 12, c = ochre) => { g.fillStyle = c; g.font = `bold ${sz}px monospace`; g.fillText(t, x, y); };
    if (which === 'west') {
      ghost(34, 50, 1.3); cat(78, 52, 1.1);
      g.strokeStyle = ochre; g.beginPath(); g.moveTo(48, 64); g.lineTo(70, 66); g.stroke();   // holding paws (he wishes)
      text('ME + CAT', 22, 104, 13); text('(HE DOESNT KNOW)', 100, 104, 9);
      g.strokeStyle = coal; g.strokeRect(124, 40, 44, 24); g.beginPath(); g.arc(134, 68, 4, 0, 7); g.stroke(); g.beginPath(); g.arc(158, 68, 4, 0, 7); g.stroke(); text('RV', 138, 57, 11, coal);
      for (let k = 0; k < 4; k++) hen(186 + (k % 2) * 22, 34 + ((k / 2) | 0) * 26);
      g.strokeStyle = ochre; for (let k = 0; k < 17; k++) { g.beginPath(); const x = 182 + (k % 6) * 11 + (k % 5 === 4 ? 0 : 0); g.moveTo(x, 84); g.lineTo(x + (k % 5 === 4 ? -40 : 0), 98); g.stroke(); }
      text('HENS', 226, 76, 9);
      g.strokeStyle = 'rgba(176,84,40,0.6)'; for (let k = 0; k < 5; k++) { const x = 8 + rr() * 240, y = 4 + rr() * 20; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y + 2); g.stroke(); }
    } else if (which === 'east') {
      g.fillStyle = 'rgba(230,226,210,0.8)'; g.beginPath(); g.arc(60, 30, 18, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0)';
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(70, 24, 16, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 14; k++) { g.fillStyle = chalk; g.fillRect(rr() * 250 | 0, rr() * 50 | 0, 2, 2); }
      cat(150, 70, 1.4, true); ghost(210, 52, 1.1);
      g.strokeStyle = coal; g.lineWidth = 2; g.beginPath(); g.moveTo(196, 46); g.lineTo(170, 62); g.stroke();
      text('z', 176, 44, 14, chalk); text('z', 186, 34, 11, chalk);
      text('HE IS SO PEACEFUL', 98, 106, 12);
      for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(176,84,40,0.7)'; const x = 12 + k * 15, y = 70 + (k % 2) * 8; g.beginPath(); g.ellipse(x, y, 5, 7, 0, 0, 7); g.fill(); for (let f = 0; f < 4; f++) g.fillRect(x - 5 + f * 3, y - 12, 2, 5); }   // paw / hand prints
    }
  }, true);
}

// ------------------------------------------------------------------ geometry helpers ------------------------------------------------------------------
function M(geo, material, x = 0, y = 0, z = 0, parent = null, ry = 0) { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.rotation.y = ry; if (parent) parent.add(o); return o; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, n = 6) => new THREE.CylinderGeometry(a, b, h, n);
/** Lofted tube through rings [y, rx, rz, cx, cz] (n sides), flat shaded. */
function loft(rings, n = 8, yAt = null) {
  const pos = [], uv = [];
  const pt = (r, i, k) => { const a = (i / n) * Math.PI * 2; return [(r[3] || 0) + Math.cos(a) * r[1], yAt ? yAt(r, i % n, k) : r[0], (r[4] || 0) + Math.sin(a) * r[2]]; };
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) {
    const a = pt(rings[k], i, k), b = pt(rings[k], i + 1, k), c = pt(rings[k + 1], i, k + 1), d = pt(rings[k + 1], i + 1, k + 1);
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
    const u0 = i / n, u1 = (i + 1) / n, v0 = k / (rings.length - 1), v1 = (k + 1) / (rings.length - 1);
    uv.push(u0, v0, u0, v1, u1, v0, u1, v0, u0, v1, u1, v1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
function rockGeo(s, sx = 1, sy = 1, sz = 1) {   // a lumpy faceted boulder
  const g = new THREE.DodecahedronGeometry(s, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.36 * ((Math.sin(p.getX(i) * 7.1 + p.getY(i) * 3.3) * 43758.5) % 1 + 1) % 1; p.setXYZ(i, p.getX(i) * sx * k, p.getY(i) * sy * k, p.getZ(i) * sz * k); }
  g.computeVertexNormals(); return g;
}
const tint = (geo, c) => { const col = new THREE.Color(c), n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.toArray(a, i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
const placed = (geo, x, y, z, ry = 0, rx = 0, rz = 0) => { geo.rotateX(rx); geo.rotateZ(rz); geo.rotateY(ry); geo.translate(x, y, z); return geo; };
function merged(list, material) { const clean = list.map((g) => (g.index ? g.toNonIndexed() : g)); for (const g of clean) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.color) tint(g, 0xffffff); } return new THREE.Mesh(mergeGeometries(clean, false), material); }

// ------------------------------------------------------------------ the torch ------------------------------------------------------------------
function makeTorch() {
  const g = new THREE.Group();
  M(cyl(0.016, 0.022, 0.46, 5), lambert({ color: 0x6a4524 }), 0, 0.23, 0, g);
  M(cyl(0.034, 0.028, 0.09, 6), lambert({ color: 0x9a8058 }), 0, 0.47, 0, g);
  M(cyl(0.03, 0.034, 0.025, 6), lambert({ color: 0x2a1e14 }), 0, 0.52, 0, g);
  const f1 = new THREE.Sprite(flameMat()); f1.position.y = 0.6; f1.scale.set(0.13, 0.22, 1); g.add(f1);
  const f2 = new THREE.Sprite(flameMat()); f2.position.y = 0.58; f2.scale.set(0.09, 0.16, 1); g.add(f2);
  const gl = new THREE.Sprite(glowMat(0xff9a40, 0.55)); gl.position.y = 0.58; gl.scale.set(0.7, 0.7, 1); g.add(gl);
  g.userData.flick = (t) => { f1.scale.set(0.12 + Math.random() * 0.03, 0.2 + Math.random() * 0.07, 1); f2.scale.set(0.08 + Math.random() * 0.02, 0.14 + Math.random() * 0.05, 1); gl.material.opacity = 0.45 + Math.random() * 0.15; f1.material.rotation = Math.sin(t * 9) * 0.12; };
  return g;
}

// ------------------------------------------------------------------ the ghost (Legends-style: one robe tube, prism sleeves, flat face) ------------------------------------------------------------------
export function makeGhost() {
  const T = textures();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mats = [];
  const gm = (o, op) => { const m = lambert({ transparent: true, opacity: op, side: THREE.DoubleSide, ...o }); m.userData.op = op; mats.push(m); return m; };
  // mostly self-lit pale blue (a ghost glows; torch and fire light only tint him a little)
  const robe = gm({ color: 0x3a4258, emissive: 0xaebee6 }, 0.8), hairM = gm({ color: 0x3a3630, emissive: 0x7a7268 }, 0.86), skinM = gm({ color: 0x3a4258, emissive: 0xb4c2e4 }, 0.9);
  const faceM = gm({ map: T.face, color: 0x444c60, emissive: 0x9aa8cc, emissiveMap: T.face }, 0.92), beardM = gm({ color: 0x38363a, emissive: 0x8a8486 }, 0.86);
  const specM = phong({ color: 0xe0e2ea, shininess: 90, specular: 0xffffff, transparent: true }); specM.userData.op = 1; mats.push(specM);
  const lensM = basic({ color: 0x9fc4e8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }); lensM.userData.op = 0.35; mats.push(lensM);
  // robe: neck, shoulders, chest, waist, a flared ragged hem
  const R = [[1.5, 0.07, 0.06], [1.44, 0.2, 0.13], [1.24, 0.215, 0.145], [1.0, 0.19, 0.135], [0.8, 0.225, 0.16], [0.58, 0.27, 0.19]];
  M(loft(R, 8, (r, i, k) => (k === R.length - 1 ? r[0] + (i % 2 ? 0.07 : -0.05) : r[0])), robe, 0, 0, 0, body);
  // wispy tail: two segments so it can sway
  const tail1 = new THREE.Group(); tail1.position.y = 0.62; body.add(tail1);
  M(loft([[0, 0.2, 0.14], [-0.2, 0.15, 0.11], [-0.32, 0.1, 0.08]], 7), robe, 0, 0, 0, tail1);
  const tail2 = new THREE.Group(); tail2.position.y = -0.32; tail1.add(tail2);
  M(loft([[0, 0.1, 0.08], [-0.16, 0.05, 0.045], [-0.3, 0.005, 0.005]], 6), robe, 0, 0, 0, tail2);
  // head: faceted 7-sided block, flat face plane, centre-parted long hair slabs, beard wedge, round wire specs
  const head = new THREE.Group(); head.position.y = 1.6; body.add(head);
  const hg = cyl(0.095, 0.085, 0.24, 7); hg.rotateY(Math.PI / 14); M(hg, skinM, 0, 0.1, 0, head);
  const face = M(new THREE.PlaneGeometry(0.15, 0.2), faceM, 0, 0.09, 0.093, head);
  M(cyl(0.104, 0.1, 0.06, 7), hairM, 0, 0.235, -0.004, head);                                   // hair cap
  for (const s of [-1, 1]) { const sl = M(box(0.045, 0.32, 0.17), hairM, s * 0.098, 0.05, -0.012, head); sl.rotation.z = s * 0.1; }   // side curtains to the shoulders
  M(box(0.2, 0.34, 0.05), hairM, 0, 0.04, -0.085, head);                                       // back
  for (const s of [-1, 1]) { const p = M(box(0.07, 0.03, 0.06), hairM, s * 0.045, 0.255, 0.05, head); p.rotation.z = -s * 0.25; }   // the centre part
  const bg = new THREE.ConeGeometry(0.07, 0.13, 5); bg.rotateX(Math.PI); M(bg, beardM, 0, -0.04, 0.07, head);
  for (const s of [-1, 1]) {
    const ring = M(new THREE.TorusGeometry(0.032, 0.0055, 4, 10), specM, s * 0.04, 0.115, 0.108, head);
    M(new THREE.CircleGeometry(0.03, 10), lensM, s * 0.04, 0.115, 0.107, head);
    const arm = M(box(0.004, 0.004, 0.1), specM, s * 0.075, 0.115, 0.058, head); arm.rotation.y = s * 0.15;
    ring.userData.lens = true;
  }
  M(box(0.018, 0.004, 0.004), specM, 0, 0.118, 0.11, head);
  // sleeves (tapered prisms) from the shoulders, mitten hands
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.2, 1.42, 0); body.add(sh);
    const sg = cyl(0.05, 0.085, 0.44, 6); sg.translate(0, -0.22, 0); M(sg, robe, 0, 0, 0, sh);
    M(box(0.06, 0.08, 0.05), skinM, 0, -0.48, 0, sh);
    sh.rotation.z = s * 0.25; arms.push(sh);
  }
  const glow = new THREE.Sprite(glowMat(0x9fb8ff, 0.4)); glow.position.y = 1.0; glow.scale.set(2.4, 2.8, 1); root.add(glow);
  root.userData = { body, head, arms, tail1, tail2, mats, glow, face, alpha: 1 };
  root.traverse((o) => { o.userData.noLift = true; });
  return root;
}
export function animGhost(g, t, mood = 'float') {
  const u = g.userData;
  u.body.position.y = 0.32 + Math.sin(t * 1.7) * 0.07;
  u.tail1.rotation.z = Math.sin(t * 2.1) * 0.25; u.tail1.rotation.x = Math.sin(t * 1.3) * 0.18 + 0.12;
  u.tail2.rotation.z = Math.sin(t * 2.1 - 0.8) * 0.4; u.tail2.rotation.x = Math.sin(t * 1.3 - 0.6) * 0.25 + 0.2;
  const boo = mood === 'boo' ? 1 : 0, wave = mood === 'wave';
  u.arms[0].rotation.x = -0.15 + Math.sin(t * 1.9) * 0.1 - boo * 1.3; u.arms[1].rotation.x = -0.15 + Math.sin(t * 1.9 + 1) * 0.1 - boo * 1.3;
  u.arms[0].rotation.z = -0.25 - boo * 0.2; u.arms[1].rotation.z = 0.25 + boo * 0.2 + (wave ? 1.9 + Math.sin(t * 8) * 0.35 : 0);
  u.head.rotation.z = Math.sin(t * 0.9) * 0.08; u.head.rotation.x = mood === 'sad' ? 0.3 : 0;
  u.glow.material.opacity = (0.32 + Math.sin(t * 2.3) * 0.08) * u.alpha;
}
export function ghostAlpha(g, k) {
  const u = g.userData; u.alpha = k;
  for (const m of u.mats) m.opacity = m.userData.op * k;
  g.visible = k > 0.01;
}

// ------------------------------------------------------------------ bronze cats ------------------------------------------------------------------
let BRONZE = null, STONE = null;
const bronze = () => (BRONZE ||= phong({ color: 0x8a5a2a, specular: 0xffc880, shininess: 55, emissive: 0x1a0c00, flatShading: true }));
const stone = () => (STONE ||= lambert({ color: 0x8a8680, flatShading: true }));
function catHead(parent, y, s = 1, sleepy = false, chewed = true) {
  const h = new THREE.Group(); h.position.y = y; h.scale.setScalar(s); parent.add(h);
  const hg = cyl(0.12, 0.1, 0.2, 6); hg.scale(1, 1.1, 0.85); M(hg, bronze(), 0, 0, 0, h);
  for (const sgn of [-1, 1]) {
    const e = M(new THREE.ConeGeometry(0.05, 0.17, 4), bronze(), sgn * 0.072, 0.17, 0, h); e.rotation.z = -sgn * 0.16;
    if (chewed && sgn < 0) { e.scale.y = 0.72; e.position.y = 0.145; }   // his right ear, chewed shorter
  }
  const eye = basic({ color: sleepy ? 0x2a1a08 : 0x3a2408 });
  for (const sgn of [-1, 1]) M(box(0.045, sleepy ? 0.008 : 0.022, 0.01), eye, sgn * 0.045, 0.01, 0.087, h);
  return h;
}
export function bronzeBust(parent, x, z, ry, s = 1, plinthH = 0.9) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  if (plinthH > 0) { M(box(0.46 * s, plinthH, 0.46 * s), stone(), 0, plinthH / 2, 0, g); M(box(0.54 * s, 0.06, 0.54 * s), stone(), 0, plinthH, 0, g); }
  const top = plinthH + 0.03;
  M(cyl(0.16 * s, 0.2 * s, 0.13 * s, 6), bronze(), 0, top + 0.065 * s, 0, g);
  M(cyl(0.075 * s, 0.09 * s, 0.08 * s, 6), bronze(), 0, top + 0.17 * s, 0, g);
  catHead(g, top + 0.3 * s, s);
  return g;
}
function bronzeAsleep(parent, x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  M(box(1.0, 0.32, 0.66), stone(), 0, 0.16, 0, g);
  M(rockGeo(0.26, 1.45, 0.6, 0.95), bronze(), -0.04, 0.47, 0, g);
  const h = catHead(g, 0.5, 0.95, true); h.position.x = 0.3; h.position.z = 0.06; h.rotation.y = 0.5; h.rotation.z = -0.35;
  const tl = M(new THREE.TorusGeometry(0.26, 0.035, 4, 9, Math.PI * 1.1), bronze(), -0.02, 0.36, 0.05, g); tl.rotation.x = Math.PI / 2;
  return g;
}
function bronzeIgnoring(parent, x, z, ry) {   // sitting, back turned to whoever made it
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  M(box(0.6, 0.5, 0.6), stone(), 0, 0.25, 0, g);
  M(cyl(0.12, 0.22, 0.44, 6), bronze(), 0, 0.72, 0, g);
  const h = catHead(g, 1.05, 1.05); h.rotation.y = 0.2;
  const tl = M(cyl(0.03, 0.04, 0.42, 4), bronze(), 0.08, 0.53, -0.22, g); tl.rotation.x = Math.PI / 2.4; tl.rotation.z = 0.4;
  return g;
}

// ------------------------------------------------------------------ chests ------------------------------------------------------------------
function makeChest(kind, T) {
  const g = new THREE.Group(), lid = new THREE.Group();
  const W = kind === 'cooler' ? 0.62 : kind === 'jewel' ? 0.42 : kind === 'steamer' ? 0.9 : 0.78, D = kind === 'jewel' ? 0.3 : 0.46, H = kind === 'jewel' ? 0.24 : kind === 'steamer' ? 0.46 : 0.38;
  lid.position.set(0, H, -D / 2); g.add(lid);
  const band = (m, parentLid = false) => { const p = parentLid ? lid : g; for (const x of [-W * 0.32, W * 0.32]) { if (parentLid) M(box(0.06, 0.03, D + 0.02), m, x, 0.06, D / 2, p); else M(box(0.06, H + 0.01, D + 0.02), m, x, H / 2, 0, p); } };
  const lidBox = (m, h = 0.1) => M(box(W, h, D), m, 0, h / 2, D / 2, lid);
  const lidArch = (m) => { const a = new THREE.CylinderGeometry(D / 2, D / 2, W, 8, 1, false, 0, Math.PI); a.rotateZ(Math.PI / 2); a.rotateX(-Math.PI / 2); M(a, m, 0, 0, D / 2, lid); };
  const iron = phong({ color: 0x3a3a3e, shininess: 40 }), gold = phong({ color: 0xd8a830, specular: 0xffe8a0, shininess: 80, emissive: 0x2a1800 });
  if (kind === 'wood') {
    const w = lambert({ map: T.wood, color: 0xa0703e }); M(box(W, H, D), w, 0, H / 2, 0, g); lidArch(w); band(iron); band(iron, true);
    M(box(0.1, 0.12, 0.03), iron, 0, H - 0.04, D / 2 + 0.01, g);
  } else if (kind === 'iron') {
    const m = phong({ color: 0x55575c, shininess: 30 }); M(box(W, H, D), m, 0, H / 2, 0, g); lidBox(m, 0.12);
    for (const y of [0.06, H - 0.06]) M(box(W + 0.02, 0.04, D + 0.02), iron, 0, y, 0, g);
    for (let i = 0; i < 5; i++) M(box(0.02, 0.02, 0.02), gold, -W * 0.4 + i * W * 0.2, H * 0.5, D / 2 + 0.01, g);
  } else if (kind === 'gold') {
    const w = lambert({ map: T.wood, color: 0x7a3a22 }); M(box(W, H, D), w, 0, H / 2, 0, g); lidArch(w); band(gold); band(gold, true);
    M(box(W + 0.02, 0.04, D + 0.02), gold, 0, 0.02, 0, g); M(box(0.12, 0.14, 0.03), gold, 0, H - 0.05, D / 2 + 0.01, g);
    const s = new THREE.Sprite(glowMat(0xffd060, 0.5)); s.position.set(0.2, H + 0.25, 0.1); s.scale.set(0.3, 0.3, 1); g.add(s); g.userData.glint = s;
  } else if (kind === 'steamer') {
    const c = lambert({ color: 0x8a6a42 }); M(box(W, H, D), c, 0, H / 2, 0, g); lidBox(c, 0.12);
    const slat = lambert({ map: T.wood, color: 0xc8a070 }); for (const y of [0.1, 0.26]) M(box(W + 0.01, 0.04, D + 0.01), slat, 0, y, 0, g);
    const st = [['TOKYO', '#c02828', '#fff'], ['NYC', '#2848a0', '#fff'], ['HAMBURG', '#e8c020', '#222'], ['MAPLE GROVE', '#2a6a3a', '#fff']];
    st.forEach(([t, b, f], i) => { const p = M(new THREE.PlaneGeometry(0.2, 0.1), basic({ map: fitSign(t, b, f, 96, 48), transparent: true }), -0.3 + i * 0.2, 0.18 + (i % 2) * 0.12, D / 2 + 0.006, g); p.rotation.z = (i % 2 ? 0.12 : -0.1); });
  } else if (kind === 'wicker') {
    const m = lambert({ map: T2().wicker, color: 0xffffff }); M(box(W, H, D), m, 0, H / 2, 0, g); lidBox(m, 0.06);
    M(new THREE.TorusGeometry(0.08, 0.012, 4, 8, Math.PI), lambert({ color: 0x8a6a3a }), 0, 0.08, D / 2, lid);
  } else if (kind === 'locker') {
    const m = lambert({ color: 0x4a5a32 }); M(box(W, H, D), m, 0, H / 2, 0, g); lidBox(m, 0.1);
    const p = M(new THREE.PlaneGeometry(0.5, 0.12), basic({ map: fitSign('J.L. - DO NOT OPEN', '#4a5a32', '#e8e4c8', 160, 40), transparent: true }), 0, H * 0.55, D / 2 + 0.006, g);
    for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) M(box(0.05, 0.05, D + 0.02), iron, x, H - 0.03, 0, g);
  } else if (kind === 'cooler') {
    M(box(W, H, D), phong({ color: 0xc8302a, shininess: 30 }), 0, H / 2, 0, g); lidBox(phong({ color: 0xf2f2ee, shininess: 30 }), 0.08);
    M(box(0.3, 0.03, 0.05), lambert({ color: 0xf2f2ee }), 0, 0.1, D / 2, lid);
  } else if (kind === 'jewel') {
    const m = lambert({ color: 0x5a2a5a }); M(box(W, H, D), m, 0, H / 2, 0, g); lidArch(m); band(gold); band(gold, true);
  } else if (kind === 'toy') {
    const m = lambert({ color: 0x4a8ac0 }); M(box(W, H, D), m, 0, H / 2, 0, g); lidBox(lambert({ color: 0xe8c040 }), 0.08);
    const p = M(new THREE.PlaneGeometry(0.6, 0.18), basic({ map: fitSign('=^.^=  =^.^=', '#4a8ac0', '#ffffff', 160, 40), transparent: true }), 0, H * 0.5, D / 2 + 0.006, g);
  }
  g.userData = { lid, open: 0, want: 0, W, D, H };
  return g;
}
const T2 = () => textures();

// ------------------------------------------------------------------ writing ------------------------------------------------------------------
const POEMS = {
  poem1: { title: 'Ode To The Cat, Asleep', lines: [
    'Little white loaf on the RV bed,',
    'ears like two tents, a sigh in your head.',
    'I float by the window. I hover. I stare.',
    'You twitch at a dream. I pretend I\'m not there.'] },
  poem2: { title: 'Haiku For The Cat (No. 31)', lines: [
    'Yellow lantern eyes.',
    'They look right through me, like I',
    'am already gone.'] },
  poem3: { title: 'Confession (Hens)', lines: [
    'I took the brown one Tuesday,',
    'the speckled one on Friday.',
    'I told myself: you\'re a ghost, ghosts don\'t get hungry.',
    'Ghosts get hungry.',
    'Forgive me, little cat. Forgive me, little hens.',
    'Mostly the hens.'] },
  poem4: { title: 'Untitled (Bronze)', lines: [
    'I cast you in bronze so you would stay still.',
    'You would hate it.',
    'You would sit on it.'] },
  poem5: { title: 'To Be Read At My Next Haunting', lines: [
    'Some ghosts want vengeance. Some ghosts want rest.',
    'I want to be ignored by a cat. He does it the best.',
    'He looks through me like weather, like I\'m not even here,',
    'the nicest thing anyone\'s done in forty-odd years.'] },
  poem6: { title: 'Carved In The Stone', lines: [
    'HERE HAUNTS JOHN.',
    'HE IS NOT A STALKER.',
    'HE IS A WATCHER, WHICH IS DIFFERENT.',
    '(IT IS MOSTLY THE SAME.)'] },
};
const INTRO = [
  ['', 'The fire pops. Every photo on the wall seems to turn and look at you.'],
  [GHOST, 'Oh. Oh no. Oh no, no, no. It\'s HIM.'],
  [GHOST, 'Don\'t be alarmed. I\'m a ghost. John. Well. What\'s left of John. The bits that didn\'t want to move on.'],
  [GHOST, 'You came all the way down here? Nineteen hundred and forty metres? On those little legs?'],
  ['', 'Goobles stares. Indifferently.'],
  [GHOST, 'THAT LOOK. Like the whole universe owes you a nap. I\'ve sculpted that look eleven times. I never get the ears right.'],
  [GHOST, 'I\'m not stalking you. I\'m haunting you. There\'s a difference. It\'s mostly paperwork.'],
  [GHOST, 'Make yourself at home. Don\'t touch the chicken. She\'s... a guest. Of honour. For dinner.'],
];
const AGAIN = [[GHOST, 'You came back! You came BACK. Act natural, John. Act natural.']];
const TALK = [
  [[GHOST, 'I watch you sleep sometimes. Through the periscope. You twitch your back foot. It\'s not weird. It\'s a bit weird.']],
  [[GHOST, 'Your chickens taste of RV. Diesel, dust and loneliness. Five stars.'], ['', 'Goobles\' tail flicks once.'], [GHOST, 'Sorry. Sorry! I\'ll pay you back. In poems.']],
  [[GHOST, 'Every ghost needs a hobby. Some rattle chains. Some moan in attics. I do bronze.']],
  [[GHOST, 'I used to have a band, you know. Four of us. Now it\'s just me, a fire and a hen called Tuesday. Smaller crowds. Better listeners.']],
  [[GHOST, 'Imagine, little cat, a world with no fences. No HOA. No Gary.'], [GHOST, 'Just you, asleep in a sunbeam, and me, a respectful forty feet away.'], [GHOST, '...Thirty feet.']],
  [[GHOST, 'If you ever need anything. Anything at all. Just sit very still in the RV and think of me.'], [GHOST, 'I\'ll know. I always know.']],
  [[GHOST, 'Don\'t tell the raccoons about this place. They\'d turn it into a nightclub.']],
];
const POOF = ['Too close! Too close!', 'Personal space! For the DEAD!', 'Eep.', 'Not the face. I\'m translucent, but not the face.'];

// ------------------------------------------------------------------ the tunnel (room "cave") ------------------------------------------------------------------
function catmull(P, n = 6) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); }
  }
  out.push(P[P.length - 1]); return out;
}
/** Resample a polyline every `step` m. Returns [{x, z, s, tx, tz}]. */
function resample(P, step) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const len = L[L.length - 1], out = [];
  let i = 0;
  for (let s = 0; s <= len + 1e-6; s += step) {
    while (i < L.length - 2 && L[i + 1] < s) i++;
    const t = (s - L[i]) / Math.max(1e-6, L[i + 1] - L[i]), x = P[i][0] + (P[i + 1][0] - P[i][0]) * t, z = P[i][1] + (P[i + 1][1] - P[i][1]) * t;
    const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], d = Math.hypot(dx, dz) || 1;
    out.push({ x, z, s, tx: dx / d, tz: dz / d });
  }
  return { pts: out, len };
}
const TUN_SIZE = [96, 116];
const TUN_CTRL = [[0, 59], [0, 46], [-9, 35], [-26, 31], [-37, 19], [-31, 5], [-12, 0], [10, 6], [29, 1], [38, -13], [29, -27], [9, -27], [-11, -33], [-27, -39], [-33, -48], [-21, -53]];
const bump = (s, c, w) => { const d = (s - c) / w; return d * d < 1 ? (1 - d * d) ** 2 : 0; };

function buildTunnel(api) {
  return ({ THREE: _T, T }) => {
    sd = 77; textures();
    const root = new THREE.Group();
    const { pts, len } = resample(catmull(TUN_CTRL, 8), 2.5);
    const N = pts.length;
    const GROT = [len * 0.3, len * 0.62];                    // two wider grottos with mushrooms
    const hw = (s) => Math.max(1.5, 1.95 + 0.55 * Math.sin(s * 0.11) + 0.35 * Math.sin(s * 0.37 + 1) + 2.4 * bump(s, GROT[0], 14) + 2.0 * bump(s, GROT[1], 12) + 1.6 * bump(s, len, 10) - 0.5 * bump(s, 0, 6));
    const ch = (s) => 3.15 + 0.4 * Math.sin(s * 0.07) + 1.4 * bump(s, GROT[0], 14) + 1.1 * bump(s, GROT[1], 12) + 0.8 * bump(s, len, 10);
    api.tun = { pts, len, hw, ch };
    const at = (s, lat, y = 0) => { const k = clamp(Math.round(s / 2.5), 0, N - 1), p = pts[k]; return [p.x - p.tz * lat, y, p.z + p.tx * lat, p]; };
    // 2026-11-27 rebuild: a ring every 1.25 m, 17 points over the arch, displaced by layered rock noise + strata; the floor
    // dips to a gravel apron at the walls. Vertex colours carry mineral patches, wet streaks and crevice darkening; the
    // room bake (roombake.js) lights it from the grotto glows, and the carried torch stays a live light.
    const pts2 = resample(catmull(TUN_CTRL, 8), 1.25).pts, N2 = pts2.length, K = 16;
    const prof = (k, w, c) => {   // lateral offset (- = left) and height of profile point k (0 = left floor edge, K = right)
      const a = Math.PI * k / K, sa = Math.sin(a);
      return [-Math.cos(a) * w * (1 + 0.14 * Math.sin(a * 2) ** 2), c * Math.pow(sa, 0.72)];
    };
    const ring = pts2.map((p) => {
      const w = hw(p.s), c = ch(p.s), nx = -p.tz, nz = p.tx, out = [];
      for (let k = 0; k <= K; k++) {
        const [lat, y] = prof(k, w, c);
        const x = p.x + nx * lat, z = p.z + nz * lat;
        // inward normal of the arch (towards the tunnel axis, roughly)
        const il = -lat, iy = (c * 0.45 - y), il2 = Math.hypot(il, iy) || 1;
        let d = rockN(x * 0.55, y * 0.7, z * 0.55) * 0.42 + rockN(x * 1.7, y * 1.9, z * 1.7) * 0.14 + Math.sin(y * 7.5 + rockN(x * 0.3, 0, z * 0.3) * 4) * 0.045;
        if (y < 1.3) d = Math.max(-0.06, Math.min(0.08, d * 0.3)) - 0.05;   // keep the walk-in width honest down low (cols sit at 0.93 w)
        out.push([x + nx * (il / il2) * d, y + (iy / il2) * d, z + nz * (il / il2) * d]);
      }
      return out;
    });
    const wp = [], wu = [], wc = [], fp = [], fu = [], fc = [];
    const col = new THREE.Color();
    const shade = (x, y, z, c, k) => {
      const n = rockN(x * 0.35 + 7, y * 0.5, z * 0.35), m = rockN(x * 2.3, y * 0.4 + 3, z * 2.3);
      let v = 0.66 + n * 0.22 + m * 0.07;
      v *= 0.62 + 0.38 * Math.min(1, y / 0.9);                     // dark where the wall meets the gravel
      v *= 1 - 0.2 * Math.max(0, (y - c * 0.8) / (c * 0.2 + 1e-3)); // sooty crown
      const wet = Math.max(0, rockN(x * 0.9, 0, z * 0.9) - 0.25) * 1.6;   // seeping streaks
      const r = v * (1.04 - wet * 0.1 + Math.max(0, m) * 0.12), g = v * (0.95 - wet * 0.04), b = v * (0.86 + wet * 0.1);
      return col.setRGB(r, g, b);
    };
    for (let i = 0; i < N2 - 1; i++) {
      const A = ring[i], B = ring[i + 1], cA = ch(pts2[i].s), cB = ch(pts2[i + 1].s);
      let vA = 0, vB = 0;
      for (let j = 0; j < K; j++) {
        const a = A[j], b = A[j + 1], c = B[j], d = B[j + 1];
        wp.push(...a, ...c, ...b, ...b, ...c, ...d);
        const la = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), lb = Math.hypot(d[0] - c[0], d[1] - c[1], d[2] - c[2]);
        const u0 = pts2[i].s / 3, u1 = pts2[i + 1].s / 3, v0 = vA / 2.2, v1 = (vA + la) / 2.2, w0 = vB / 2.2, w1 = (vB + lb) / 2.2;
        wu.push(u0, v0, u1, w0, u0, v1, u0, v1, u1, w0, u1, w1);
        vA += la; vB += lb;
        for (const [q, cc] of [[a, cA], [c, cB], [b, cA], [b, cA], [c, cB], [d, cB]]) { shade(q[0], q[1], q[2], cc, j); wc.push(col.r, col.g, col.b); }
      }
      // floor: 6 strips across, a gravel apron rising a little into the wall foot, darker and wetter at the edges
      const FS = 6, fa = [], fb = [];
      for (let f = 0; f <= FS; f++) {
        const t = f / FS, e = Math.abs(t - 0.5) * 2;
        const pa = pts2[i], pb = pts2[i + 1], wa = hw(pa.s) * 1.02, wb = hw(pb.s) * 1.02, la = (t - 0.5) * 2 * wa, lb = (t - 0.5) * 2 * wb;
        const ya = e > 0.7 ? (e - 0.7) * 0.35 : 0, yb = ya;
        fa.push([pa.x - pa.tz * la, ya + (e > 0.4 ? Math.max(0, rockN(pa.x * 2, 1, pa.z * 2)) * 0.05 : 0), pa.z + pa.tx * la, e]);
        fb.push([pb.x - pb.tz * lb, yb + (e > 0.4 ? Math.max(0, rockN(pb.x * 2, 1, pb.z * 2)) * 0.05 : 0), pb.z + pb.tx * lb, e]);
      }
      for (let f = 0; f < FS; f++) {
        const a = fa[f], b = fa[f + 1], c = fb[f], d = fb[f + 1];
        for (const q of [a, c, b, b, c, d]) {
          fp.push(q[0], q[1], q[2]); fu.push(q[0] / 3, q[2] / 3);
          const n = rockN(q[0] * 0.7, 2, q[2] * 0.7), wet = Math.max(0, rockN(q[0] * 0.4, 5, q[2] * 0.4) - 0.3);
          const v = (0.86 + n * 0.18) * (1 - 0.3 * Math.max(0, q[3] - 0.6) / 0.4);
          fc.push(v * (1 - wet * 0.5), v * (0.97 - wet * 0.45), v * (0.92 - wet * 0.3));
        }
      }
    }
    { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3)); g.computeVertexNormals();
      root.add(new THREE.Mesh(g, lambert({ map: textures().rock, vertexColors: true, side: THREE.DoubleSide }))); }
    { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); g.computeVertexNormals();
      root.add(new THREE.Mesh(g, lambert({ map: textures().dirt, color: 0xb0a090, vertexColors: true, side: THREE.DoubleSide }))); }
    // boulders and scree along the wall foot, and glowing crystal clusters in the grottos
    const rocks = [], cryst = [];
    for (let s = 3; s < len - 3; s += 1.1) {
      if (rr() < 0.55) {
        const sg = rr() < 0.5 ? -1 : 1, w = hw(s), [x, , z] = at(s + rnd(-0.5, 0.5), sg * w * rnd(0.78, 0.95)), r = rnd(0.12, 0.42);
        const g = new THREE.DodecahedronGeometry(r, 0); g.scale(rnd(0.8, 1.4), rnd(0.5, 0.9), rnd(0.8, 1.3)); g.rotateY(rnd(0, 6));
        const k = rnd(0.42, 0.62); rocks.push(tint(placed(g, x, r * 0.35, z), new THREE.Color(k * 1.05, k, k * 0.9).getHex()));
      }
    }
    root.add(merged(rocks, lambert({ vertexColors: true, flatShading: true })));
    for (const [gs, hue] of [[GROT[0], 0x58f0d8], [GROT[1], 0x8a7aff], [len * 0.15, 0x58f0d8]]) for (let k = 0; k < 6; k++) {
      const sg = k % 2 ? 1 : -1, w = hw(gs), [x, , z] = at(gs + rnd(-4, 4), sg * w * rnd(0.72, 0.9));
      for (let q = 0; q < 4; q++) { const h = rnd(0.18, 0.55), g = new THREE.ConeGeometry(rnd(0.04, 0.09), h, 4); g.rotateZ(rnd(-0.5, 0.5)); g.rotateX(rnd(-0.5, 0.5)); cryst.push(tint(placed(g, x + rnd(-0.15, 0.15), h * 0.4, z + rnd(-0.15, 0.15)), hue)); }
    }
    root.add(merged(cryst, basic({ vertexColors: true })));
    // end cap (a rock wall behind the rope pit)
    const E = pts[N - 1], Ew = hw(len);
    { const cap = M(box(Ew * 2.6, 6, 0.8), lambert({ map: textures().rock, color: 0x6a625a }), E.x + E.tx * 0.6, 3, E.z + E.tz * 0.6, root); cap.rotation.y = Math.atan2(E.tx, E.tz); }
    // colliders: a wall box either side of every segment
    const cols = [];
    for (let i = 0; i < N - 1; i++) {
      const a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      const w = hw((a.s + b.s) / 2) * 0.93 + 0.7, nx = -uz, nz = ux, rot = Math.atan2(-uz, ux);
      for (const sg of [-1, 1]) cols.push({ kind: 'box', cx: mx + nx * sg * w, cz: mz + nz * sg * w, w: L + 0.9, d: 1.4, rot, h: 4.5 });
    }
    cols.push({ kind: 'box', cx: E.x + E.tx * 0.9, cz: E.z + E.tz * 0.9, w: Ew * 2.6, d: 1.0, rot: Math.atan2(-E.tz, E.tx) + Math.PI / 2, h: 4.5 });
    // dressing: stalactites + stalagmites, old timber props, mushrooms, feathers, painted signs, daylight at the mouth
    const drips = [], mush = [], feath = [];
    for (let s = 4; s < len - 2; s += 3.2) {
      const w = hw(s), c = ch(s);
      { const lat = rnd(-w * 0.6, w * 0.6), [x, , z] = at(s, lat), h = rnd(0.25, 0.8); drips.push(tint(placed(new THREE.ConeGeometry(rnd(0.06, 0.16), h, 5), x, c - h / 2 - 0.05 - Math.abs(lat) * 0.25, z, 0, Math.PI), 0x7a7268)); }
      if (rr() < 0.45) { const sg = rr() < 0.5 ? -1 : 1, lat = sg * w * rnd(0.72, 0.88), [x, , z] = at(s, lat), h = rnd(0.3, 0.9); drips.push(tint(placed(new THREE.ConeGeometry(rnd(0.1, 0.22), h, 5), x, h / 2, z), 0x6e665c)); }
    }
    root.add(merged(drips, lambert({ vertexColors: true, flatShading: true })));
    const mushAt = [[GROT[0], 1], [GROT[0] + 6, -1], [GROT[1], -1], [GROT[1] - 5, 1], [len * 0.15, 1], [len * 0.47, -1], [len * 0.8, 1], [len - 4, -1]];
    for (const [s, sg] of mushAt) for (let k = 0; k < 7; k++) {
      const w = hw(s), [x, , z] = at(s + rnd(-2, 2), sg * w * rnd(0.6, 0.85)), h = rnd(0.06, 0.2), r = rnd(0.04, 0.11);
      mush.push(tint(placed(cyl(0.012, 0.018, h, 4), x, h / 2, z), 0xbfe8e0), tint(placed(new THREE.ConeGeometry(r, r * 0.8, 6), x, h + r * 0.3, z), k % 3 ? 0x6fe8d0 : 0x9a8aff));
    }
    root.add(merged(mush, basic({ vertexColors: true })));
    for (let s = len * 0.45; s < len - 3; s += 1.4) for (let k = 0; k < 2; k++) {   // a trail of chicken feathers
      const [x, , z] = at(s + rnd(-0.6, 0.6), rnd(-1.0, 1.0)); const f = new THREE.PlaneGeometry(0.06, 0.16); f.rotateX(-Math.PI / 2); f.rotateY(rnd(0, 6)); f.translate(x, 0.012, z);
      feath.push(tint(f, [0xf4f0e8, 0xa0683a, 0xe8e0d0][(rr() * 3) | 0]));
    }
    root.add(merged(feath, basic({ vertexColors: true, side: THREE.DoubleSide })));
    const wood = lambert({ map: T.wood, color: 0x8a6a48 });
    for (const s of [14, len * 0.22, len * 0.52, len * 0.86]) {
      const w = hw(s), c = ch(s), [x, , z, p] = at(s, 0), ry = Math.atan2(p.tx, p.tz);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      for (const sg of [-1, 1]) { const post = M(box(0.18, c * 0.82, 0.18), wood, sg * w * 0.78, c * 0.41, 0, g); post.rotation.z = sg * 0.05; }
      M(box(w * 1.8, 0.2, 0.22), wood, 0, c * 0.8, 0, g);
    }
    const SIGNS = [[22, 'DEPTH: SOME', 1], [len * 0.36, 'TURN BACK, CAT. (DON\'T.)', -1], [len * 0.55, 'NOT A CAT DOOR', 1], [len * 0.72, 'ALMOST THERE (LIE)', -1], [len * 0.9, 'MIND THE ROPE', 1]];
    for (const [s, t, sg] of SIGNS) {
      const w = hw(s), [x, , z, p] = at(s, sg * (w * 1.0 - 0.05)), pl = M(new THREE.PlaneGeometry(1.5, 0.36), basic({ map: fitSign(t, null, '#e8d8b0', 256, 56), transparent: true, opacity: 0.85 }), x, 1.55, z, root);
      pl.rotation.y = Math.atan2(p.tx, p.tz) + (sg > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    { const [x, , z] = at(0.5, 0), d = M(new THREE.PlaneGeometry(5, 4), basic({ color: 0xc8d8e8, transparent: true, opacity: 0.85, fog: false }), x, 2, z + 1.2, root); d.rotation.y = Math.PI; }
    // the rope pit at the far end
    const pit = at(len - 2.4, 0);
    M(new THREE.CircleGeometry(1.25, 9).rotateX(-Math.PI / 2), basic({ color: 0x000000 }), pit[0], 0.015, pit[2], root);
    M(new THREE.RingGeometry(1.2, 1.55, 9).rotateX(-Math.PI / 2), lambert({ color: 0x3a342e }), pit[0], 0.02, pit[2], root);
    const pitGlow = new THREE.Sprite(glowMat(0x88aaff, 0.35)); pitGlow.position.set(pit[0], 0.3, pit[2]); pitGlow.scale.set(2.6, 1.0, 1); root.add(pitGlow);
    M(cyl(0.025, 0.025, ch(len) + 0.4, 5), lambert({ color: 0xb8a070 }), pit[0] + 0.5, (ch(len) - 0.4) / 2, pit[2], root);
    M(box(0.12, 0.7, 0.12), wood, pit[0] + 0.5 - pit[3].tz * 1.9, 0.35, pit[2] + pit[3].tx * 1.9, root);
    cols.push({ kind: 'box', cx: pit[0], cz: pit[2], w: 1.9, d: 1.9, rot: 0, h: 0.2 });   // walk round it, not into it
    // the ghost peeks out of the dark twice on the way down
    const peek = makeGhost(); peek.scale.setScalar(0.95); root.add(peek); ghostAlpha(peek, 0);
    api.tunGhost = peek;
    const L = (s, lat, c, i, y = 0.6) => { const [x, , z] = at(s, lat); return { x, y, z, c, i }; };
    const torchL = { x: 0, y: 1.0, z: 50, c: 0xffa050, i: 1.5, flicker: true, dyn: true };   // carried: a live light, not baked
    api.tunTorch = torchL;
    const lightsL = [torchL, L(GROT[0], 0, 0x48d8c8, 0.55, 0.5), L(len - 2.4, 0, 0x6a8aff, 0.6, 0.4), L(GROT[1], 0, 0x7a6aff, 0.5, 0.5), L(len * 0.15, 0, 0x48d8c8, 0.3, 0.4)];
    const spawn = { x: 0, z: 56, yaw: 0 };
    return {
      group: root, size: TUN_SIZE, cols, spawn, exit: { x: 0, z: 57.6, r: 0.8 }, lights: lightsL, name: 'The Hollow Deep', bake: { amb: 0.24, sky: 0x8a9ac0, ground: 0x2a2018, shadows: false, maxEdge: 1.3 },
      cam: { maxDist: 2.6, height: 2.7 },
      interact: [{ id: 'rope', x: pit[0] + pit[3].tx * -1.7, z: pit[2] - pit[3].tz * 1.7, r: 1.8, label: 'Climb down the rope', onUse: () => api.descend() }],
      update: (t) => { pitGlow.material.opacity = 0.28 + Math.sin(t * 1.3) * 0.08; },
    };
  };
}

// ------------------------------------------------------------------ the dwelling (room "cavelair") ------------------------------------------------------------------
const LAIR_SIZE = [30, 26];
const CHESTS = [
  { id: 'wood', x: -12, z: -9.6, ry: 0.4, label: 'Open the wooden chest', cash: 25, say: [['', 'Old coins. Forty-odd years old. Still legal tender. Probably.'], ['', '+$25']] },
  { id: 'iron', x: -7.6, z: -11.6, ry: 0, label: 'Open the iron trunk', say: [['', 'Spare round glasses. Dozens of pairs. All exactly the same.'], ['', 'A label: "IN CASE I SIT ON THEM AGAIN."']] },
  { id: 'gold', x: 11.2, z: -5.6, ry: -1.2, label: 'Open the treasure chest', cash: 100, say: [['', 'Gold! ...Painted. It\'s a frisbee sprayed gold. Engraved: "MY GREATEST HIT".'], ['', 'Underneath it: actual money. +$100']] },
  { id: 'steamer', x: 12.9, z: 3.6, ry: -Math.PI / 2, label: 'Open the steamer trunk', say: [['', 'A neatly folded white sheet with two eyeholes. A tag: "FORMAL".'], ['', 'And a postcard of the RV lot. Someone drew a heart round the RV.']] },
  { id: 'wicker', x: 6.2, z: 11.6, ry: Math.PI, label: 'Open the wicker hamper', say: [['', 'Chicken feathers. Hundreds. Sorted by colour.'], ['', 'There is a spreadsheet. It is labelled "THE COLLECTION".']] },
  { id: 'locker', x: 1.6, z: 11.8, ry: Math.PI, label: 'Open the footlocker', say: [['', 'Fan mail. All of it to you. None of it sent.'], ['', '"Dear Cat, you don\'t know me, but I know you. I know you SO well."'], ['', 'There are about four hundred of these.']] },
  { id: 'cooler', x: -4.2, z: 9.2, ry: 0.2, label: 'Open the cooler', heal: true, say: [['', 'Three drumsticks, labelled MON, WED and FRI. Today is clearly a drumstick day.'], ['', 'You eat WED. Health restored.']] },
  { id: 'toy', x: 13.1, z: 9.6, ry: -Math.PI / 2, label: 'Open the toy box', say: [['', 'Cat toys. Feather wands, a yarn ball, a jingly mouse. Never played with.'], ['', 'A note: "FOR WHEN HE VISITS. HE WILL VISIT. HE WILL."']] },
  { id: 'jewel', x: 11.2, z: -10.4, ry: -0.6, y: 0.62, label: 'Open the little box', say: [['', 'A single cat whisker on a velvet cushion. White. Yours.'], ['', 'You don\'t remember losing it. That\'s the scary part.']] },
];
function buildLair(api) {
  return ({ T }) => {
    sd = 1940; textures();
    const root = new THREE.Group();
    const [W, D] = LAIR_SIZE, HT = 5.6;
    const rockM = lambert({ map: textures().rock, color: 0x8a8076, side: THREE.DoubleSide }), dirtM = lambert({ map: textures().dirt, color: 0xb8a890 });
    const floor = M(new THREE.PlaneGeometry(W, D), dirtM, 0, 0, 0, root); floor.rotation.x = -Math.PI / 2;
    { const t = textures().dirt; floor.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? D / 3 : W / 3); }); }
    const wallMesh = (w, x, z, ry) => { const m = M(new THREE.PlaneGeometry(w, HT, 8, 4), rockM, x, HT / 2, z, root); m.rotation.y = ry; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < w / 2 - 0.01 && p.getY(i) > -HT / 2 + 0.01) p.setZ(i, rnd(-0.35, 0.25)); m.geometry.computeVertexNormals(); { const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * HT / 3); } return m; };
    wallMesh(W, 0, -D / 2, 0); wallMesh(W, 0, D / 2, Math.PI); wallMesh(D, -W / 2, 0, Math.PI / 2); wallMesh(D, W / 2, 0, -Math.PI / 2);
    const ceil = M(new THREE.PlaneGeometry(W, D, 6, 6), lambert({ map: textures().rock, color: 0x5a524a, side: THREE.DoubleSide }), 0, HT, 0, root); ceil.rotation.x = Math.PI / 2;
    { const p = ceil.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -rnd(0, 0.6) + Math.hypot(p.getX(i) / W, p.getY(i) / D) * 1.5); ceil.geometry.computeVertexNormals(); }
    const cols = [], interact = [];
    const solid = (cx, cz, w, d, h, rot = 0, top) => { const c = { kind: 'box', cx, cz, w, d, rot, h }; if (top !== undefined) c.top = top; cols.push(c); return c; };
    // boulders in the corners and along the walls, stalactites
    const rocks = [], drips = [];
    for (const [x, z, s] of [[-14, -12, 2.2], [14, -12, 2.0], [-14.2, 12, 1.6], [14, 12, 1.9], [-3, -12.8, 1.0], [8, -12.9, 1.1], [-14.6, -1.2, 0.9], [14.6, -9.5, 0.8], [4, 12.9, 0.9], [-8, 12.8, 1.2]]) {
      rocks.push(tint(placed(rockGeo(s, 1.2, 0.9, 1), x, s * 0.5, z, rnd(0, 6)), 0x9a9086)); solid(x, z, s * 1.9, s * 1.9, 3);
    }
    for (let k = 0; k < 46; k++) { const x = rnd(-W / 2 + 1, W / 2 - 1), z = rnd(-D / 2 + 1, D / 2 - 1), h = rnd(0.3, 1.2); if (Math.hypot(x, z + 1) < 3) continue; drips.push(tint(placed(new THREE.ConeGeometry(rnd(0.08, 0.22), h, 5), x, HT - h / 2 + 0.2, z, 0, Math.PI), 0x7a7268)); }
    root.add(merged(rocks, lambert({ map: textures().rock, vertexColors: true, flatShading: true })));
    root.add(merged(drips, lambert({ vertexColors: true, flatShading: true })));
    // the campfire
    const FX = 0, FZ = -1;
    const stones = [];
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; stones.push(tint(placed(rockGeo(0.2, 1.2, 0.7, 1), FX + Math.cos(a) * 0.72, 0.1, FZ + Math.sin(a) * 0.72, a), 0x6a6660)); }
    root.add(merged(stones, lambert({ vertexColors: true, flatShading: true })));
    const logM = lambert({ map: T.wood, color: 0x5a3a20 });
    for (let k = 0; k < 4; k++) { const l = M(cyl(0.06, 0.07, 1.0, 5), logM, FX, 0.12, FZ, root); l.rotation.z = Math.PI / 2 - 0.35; l.rotation.y = (k / 4) * Math.PI; }
    M(new THREE.CircleGeometry(0.55, 8).rotateX(-Math.PI / 2), basic({ color: 0xff7020 }), FX, 0.03, FZ, root);
    const flames = [];
    for (let k = 0; k < 6; k++) { const f = new THREE.Sprite(flameMat()); const a = k * 1.1; f.position.set(FX + Math.cos(a) * 0.18, 0.45, FZ + Math.sin(a) * 0.18); f.userData.b = 0.5 + (k % 3) * 0.15; root.add(f); flames.push(f); }
    const fireGlow = new THREE.Sprite(glowMat(0xff8a30, 0.6)); fireGlow.position.set(FX, 0.6, FZ); fireGlow.scale.set(3.2, 2.6, 1); root.add(fireGlow);
    solid(FX, FZ, 1.7, 1.7, 0.6);
    // the spit, with a hen roasting on it
    for (const s of [-1, 1]) { M(cyl(0.025, 0.025, 1.0, 4), logM, FX + s * 0.85, 0.5, FZ, root); }
    const spit = M(cyl(0.015, 0.015, 1.9, 4), phong({ color: 0x777777 }), FX, 0.95, FZ, root); spit.rotation.z = Math.PI / 2;
    const roast = new THREE.Group(); roast.position.set(FX, 0.95, FZ); root.add(roast);
    M(rockGeo(0.14, 1.3, 0.9, 1), lambert({ color: 0x9a5a20, flatShading: true }), 0, 0, 0, roast);
    for (const s of [-1, 1]) { const d = M(cyl(0.035, 0.05, 0.16, 5), lambert({ color: 0x8a4a18 }), 0.05, -0.08, s * 0.08, roast); d.rotation.x = s * 0.6; }
    // the bed: bedroll, pillow, a stuffed cat toy, a crate table with tea and a lantern
    { const g = new THREE.Group(); g.position.set(8.4, 0, -9.2); g.rotation.y = 0.3; root.add(g);
      M(box(1.0, 0.1, 2.0), lambert({ color: 0x6a3a5a }), 0, 0.05, 0, g); M(box(0.95, 0.06, 1.2), lambert({ color: 0x9a7aa8 }), 0, 0.12, 0.35, g); M(box(0.55, 0.12, 0.32), lambert({ color: 0xe8e0d0 }), 0, 0.16, -0.75, g);
      const toy = new THREE.Group(); toy.position.set(0.3, 0.2, -0.45); g.add(toy); M(box(0.14, 0.12, 0.1), lambert({ color: 0xf0f0f0 }), 0, 0, 0, toy); M(box(0.12, 0.1, 0.1), lambert({ color: 0xf0f0f0 }), 0, 0.1, 0.02, toy);
      for (const s of [-1, 1]) M(new THREE.ConeGeometry(0.025, 0.07, 4), lambert({ color: 0xf0f0f0 }), s * 0.04, 0.18, 0.02, toy);
      solid(8.4, -9.2, 1.0, 2.0, 0.2, 0.3, 0.2); }
    { M(box(0.7, 0.6, 0.6), lambert({ map: T.wood, color: 0xa08058 }), 11.2, 0.3, -10.4, root); solid(11.2, -10.4, 0.7, 0.6, 0.6, 0, 0.6);
      M(cyl(0.04, 0.03, 0.06, 6), lambert({ color: 0xf0f0f0 }), 10.95, 0.63, -10.25, root);
      const lan = M(cyl(0.07, 0.08, 0.2, 6), phong({ color: 0x3a3a3a }), 11.4, 0.7, -10.6, root); M(cyl(0.05, 0.05, 0.12, 6), basic({ color: 0xffd080 }), 0, 0, 0, lan); }
    // portraits of himself along the back wall, with brass plaques
    const frameM = phong({ color: 0x8a6a20, specular: 0xffe0a0, shininess: 60 });
    const PORTRAITS = [[-10.4, 'photo', 'SELF-PORTRAIT, TRANSLUCENT'], [-5.6, 'chicken', 'SELF-PORTRAIT WITH HEN'], [0.4, 'haunt', 'ME, HAUNTING (CANDID)'], [4.4, 'paint', 'ME, IN MY BLUE PERIOD'], [-1.8, 'bronze', 'ME, BRONZE PERIOD']];
    PORTRAITS.forEach(([x, kind, title], i) => {
      const y = i === 4 ? 2.9 : 1.75, z = -D / 2 + 0.45, s = i === 4 ? 0.8 : 1;
      M(box(1.05 * s, 1.3 * s, 0.06), frameM, x, y, z, root);
      M(new THREE.PlaneGeometry(0.88 * s, 1.1 * s), lambert({ map: portraitTex(kind) }), x, y, z + 0.035, root);
      if (i !== 4) { M(new THREE.PlaneGeometry(0.9, 0.12), basic({ map: fitSign(title, '#3a2a10', '#e8c070', 192, 26) }), x, y - 0.82, z + 0.04, root); interact.push({ id: 'portrait' + i, x, z: z + 1.1, r: 1.0, label: 'Look at the portrait', onUse: () => api.say([['', `A brass plaque: "${title}".`], ['', ['He has signed it. Twice.', 'The eyes follow you. They\'re painted that way. Probably.', 'It\'s very good, actually. Annoyingly good.', 'There is a cat-shaped smudge in the corner. He painted you in, then rubbed it out, then painted you in again.'][i]]]) }); }
    });
    const candle = (x, z) => { M(cyl(0.04, 0.04, 0.2, 6), lambert({ color: 0xf0e8d0 }), x, 1.0, z, root); const f = new THREE.Sprite(flameMat()); f.position.set(x, 1.16, z); f.scale.set(0.06, 0.1, 1); root.add(f); flames.push(f); f.userData.b = 0.1; M(box(0.5, 0.06, 0.3), lambert({ map: T.wood, color: 0x8a6a48 }), x, 0.87, z, root); M(box(0.06, 0.86, 0.06), lambert({ color: 0x5a4a3a }), x, 0.43, z, root); };
    candle(-8, -12.2); candle(2.4, -12.2);
    // cave paintings on the side walls
    { const p = M(new THREE.PlaneGeometry(8, 3.5), lambert({ map: cavePaintingTex('west'), transparent: true }), -W / 2 + 0.42, 2.2, 4.2, root); p.rotation.y = Math.PI / 2;
      interact.push({ id: 'paintW', x: -13.2, z: 4.2, r: 1.6, label: 'Look at the cave painting', onUse: () => api.say([['', 'Ochre and charcoal: a ghost with round glasses holding paws with a white cat. "ME + CAT (HE DOESN\'T KNOW)".'], ['', 'Next to it: the RV, some hens, and seventeen tally marks.']]) }); }
    { const p = M(new THREE.PlaneGeometry(5.2, 2.3), lambert({ map: cavePaintingTex('east'), transparent: true }), W / 2 - 0.42, 2.5, -1.4, root); p.rotation.y = -Math.PI / 2;
      interact.push({ id: 'paintE', x: 13.4, z: -1.4, r: 1.5, label: 'Look at the cave painting', onUse: () => api.say([['', 'A crescent moon. A sleeping white cat. A ghost leaning over it. "HE IS SO PEACEFUL".'], ['', 'You feel watched. You are, constantly, it turns out.']]) }); }
    // bronze cats
    bronzeBust(root, 4.6, -8.2, 0.2, 1.25); solid(4.6, -8.2, 0.6, 0.6, 1.4);
    bronzeAsleep(root, -5.4, -6.6, -0.3); solid(-5.4, -6.6, 1.0, 0.7, 0.9, -0.3);
    bronzeIgnoring(root, 8.8, 3.8, Math.PI * 0.55); solid(8.8, 3.8, 0.6, 0.6, 1.2);
    { const shelf = M(box(0.5, 0.08, 2.6), lambert({ map: T.wood, color: 0x8a6a48 }), 14.5, 1.3, -8.9, root); M(box(0.1, 1.3, 0.1), lambert({ color: 0x5a4a3a }), 14.4, 0.65, -10, root); M(box(0.1, 1.3, 0.1), lambert({ color: 0x5a4a3a }), 14.4, 0.65, -7.8, root);
      for (let k = 0; k < 3; k++) { const b = bronzeBust(root, 14.5, -9.8 + k * 0.9, -Math.PI / 2, 0.55, 0); b.position.y = 1.34; } solid(14.5, -8.9, 0.6, 2.6, 1.4); }
    { const wip = bronzeBust(root, -2.2, -2.6, 0.8, 0.9, 0.6); wip.rotation.z = 0.02; M(box(0.03, 0.03, 0.22), phong({ color: 0x9a9aa0 }), -1.9, 0.63, -2.3, root); solid(-2.2, -2.6, 0.5, 0.5, 1.1, 0.8); }
    interact.push(
      { id: 'bust', x: 4.6, z: -7.2, r: 1.2, label: 'Look at the bronze bust', onUse: () => api.say([['', 'A bronze bust of you. "THE CAT (No. 11 OF 11)". The right ear is chewed, exactly like yours.'], ['', 'He got the ears right this time. He\'s right, the look is perfect.']]) },
      { id: 'asleep', x: -5.0, z: -5.6, r: 1.2, label: 'Look at the bronze statue', onUse: () => api.say([['', '"THE CAT, ASLEEP". A bronze loaf with ears. It is, admittedly, how you sleep.']]) },
      { id: 'ignoring', x: 8.0, z: 4.6, r: 1.2, label: 'Look at the bronze statue', onUse: () => api.say([['', '"THE CAT, IGNORING ME". It faces the wall. The plaque is on the back. You have to walk round to read it.']]) },
      { id: 'shelf', x: 13.6, z: -8.9, r: 1.4, label: 'Look at the little busts', onUse: () => api.say([['', 'Three little bronze busts of you. "HAPPY", "SAD" and "HUNGRY". They have the same face.']]) },
      { id: 'wip', x: -1.6, z: -1.8, r: 1.0, label: 'Look at the work in progress', onUse: () => api.say([['', 'An unfinished bust with a chisel beside it. No. 12. The ears are already wrong.']]) },
    );
    // the chests
    api.chests = {};
    for (const c of CHESTS) {
      const g = makeChest(c.id, T); g.position.set(c.x, c.y || 0, c.z); g.rotation.y = c.ry; root.add(g);
      api.chests[c.id] = g;
      if (!c.y) solid(c.x, c.z, g.userData.W + 0.04, g.userData.D + 0.04, g.userData.H + 0.12, c.ry, g.userData.H + 0.12);
      const fx = Math.sin(c.ry), fz = Math.cos(c.ry);
      interact.push({ id: 'chest:' + c.id, x: c.x + fx * 0.75, z: c.z + fz * 0.75, r: 0.95, label: c.label, onUse: () => api.openChest(c) });
    }
    // poems
    const POEM_AT = [['poem1', 8.4, -D / 2 + 0.42, 0, 1.4], ['poem2', -W / 2 + 0.42, -7.6, Math.PI / 2, 1.3], ['poem3', -6.4, 7.4, 0.3, 0], ['poem4', 4.6, -7.95, 0.2, 0.62], ['poem5', W / 2 - 0.42, 7.2, -Math.PI / 2, 1.3]];
    for (const [id, x, z, ry, y] of POEM_AT) {
      let px = x, pz = z;
      if (y === 0) { M(box(0.05, 0.9, 0.05), lambert({ map: T.wood, color: 0x8a6a48 }), x, 0.45, z, root, ry); }
      const p = M(new THREE.PlaneGeometry(0.34, 0.42), lambert({ map: textures().parchment }), x + Math.sin(ry) * 0.04, y || 0.95, z + Math.cos(ry) * 0.04, root, ry);
      if (id === 'poem4') p.position.y = 0.6;
      px += Math.sin(ry) * 0.9; pz += Math.cos(ry) * 0.9;
      interact.push({ id, x: px, z: pz, r: 1.0, label: 'Read the poem', onUse: () => api.poem(id) });
    }
    { const slab = M(box(1.1, 0.8, 0.22), stone(), -3.2, 0.4, 2.8, root, 0.4); slab.rotation.x = -0.08;
      M(new THREE.PlaneGeometry(0.95, 0.6), basic({ map: fitSign('HERE HAUNTS JOHN', null, '#2a2622', 512, 64), transparent: true }), -3.2 + Math.sin(0.4) * 0.12, 0.45, 2.8 + Math.cos(0.4) * 0.12, root, 0.4);
      solid(-3.2, 2.8, 1.1, 0.3, 0.8, 0.4); interact.push({ id: 'poem6', x: -3.2 + Math.sin(0.4) * 0.9, z: 2.8 + Math.cos(0.4) * 0.9, r: 1.0, label: 'Read the stone', onUse: () => api.poem('poem6') }); }
    // periscope up to the RV
    { const br = phong({ color: 0xb08a3a, specular: 0xffe0a0, shininess: 70 });
      M(cyl(0.07, 0.07, HT - 0.6, 7), br, 9.6, (HT + 0.6) / 2, -0.4, root); M(box(0.18, 0.16, 0.3), br, 9.6, 0.62, -0.25, root); M(cyl(0.05, 0.05, 0.08, 6).rotateX(Math.PI / 2), basic({ color: 0x101010 }), 9.6, 0.62, -0.06, root);
      solid(9.6, -0.4, 0.3, 0.3, HT);
      interact.push({ id: 'periscope', x: 9.6, z: 0.5, r: 1.0, label: 'Look through the periscope', onUse: () => api.periscope() }); }
    // an old upright piano, painted white, cobwebbed
    { const pw = phong({ color: 0xf2f0ea, shininess: 60 }), g = new THREE.Group(); g.position.set(-14.0, 0, -3.2); g.rotation.y = Math.PI / 2; root.add(g);
      M(box(1.5, 1.25, 0.5), pw, 0, 0.625, -0.05, g); M(box(1.4, 0.06, 0.32), pw, 0, 0.75, 0.3, g); M(box(1.3, 0.03, 0.16), basic({ color: 0xffffff }), 0, 0.79, 0.34, g);
      for (let k = 0; k < 15; k++) M(box(0.03, 0.02, 0.09), basic({ color: 0x111111 }), -0.6 + k * 0.086, 0.81, 0.31, g);
      M(box(0.7, 0.45, 0.35), pw, 0, 0.225, 0.85, g);
      M(new THREE.PlaneGeometry(0.5, 0.4), basic({ color: 0xdddddd, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0.6, 1.1, 0.23, g).rotation.x = 0.6;
      solid(-14.0, -3.2, 0.6, 1.5, 1.25); solid(-13.15, -3.2, 0.35, 0.7, 0.45, 0, 0.45);
      interact.push({ id: 'piano', x: -12.6, z: -3.2, r: 1.1, label: 'Play the white piano', onUse: () => api.piano() }); }
    // the chicken coop crate with Tuesday the hen in it, bones and feathers by the fire
    const hen = new THREE.Group(); hen.position.set(-7.0, 0.12, 5.2); root.add(hen);
    { const crate = lambert({ map: T.wood, color: 0xb09068 });
      for (const [w, h, d, x, y, z] of [[1.1, 0.06, 0.8, 0, 0.03, 0], [1.1, 0.06, 0.8, 0, 0.75, 0]]) M(box(w, h, d), crate, -7.0 + x, y, 5.2 + z, root);
      for (let k = 0; k < 6; k++) { M(box(0.04, 0.72, 0.04), crate, -7.5 + k * 0.2, 0.39, 4.8, root); M(box(0.04, 0.72, 0.04), crate, -7.5 + k * 0.2, 0.39, 5.6, root); }
      for (let k = 0; k < 4; k++) { M(box(0.04, 0.72, 0.04), crate, -7.55, 0.39, 4.85 + k * 0.24, root); M(box(0.04, 0.72, 0.04), crate, -6.45, 0.39, 4.85 + k * 0.24, root); }
      M(new THREE.PlaneGeometry(0.6, 0.14), basic({ map: fitSign('PROPERTY OF RV LOT', '#c8a068', '#3a1a0a', 160, 36) }), -7.0, 0.58, 5.62, root);
      solid(-7.0, 5.2, 1.15, 0.85, 0.8, 0, 0.8);
      M(rockGeo(0.14, 1.3, 1.0, 1), lambert({ color: 0x9a5a28, flatShading: true }), 0, 0.14, 0, hen);
      const hh = new THREE.Group(); hh.position.set(0.15, 0.3, 0); hen.add(hh);
      M(box(0.08, 0.1, 0.08), lambert({ color: 0x9a5a28 }), 0, 0, 0, hh); M(box(0.02, 0.05, 0.05), lambert({ color: 0xd02020 }), 0, 0.07, 0, hh); M(new THREE.ConeGeometry(0.02, 0.05, 4).rotateZ(-Math.PI / 2), lambert({ color: 0xe8b020 }), 0.06, 0, 0, hh);
      hen.userData.head = hh;
      interact.push({ id: 'hen', x: -7.0, z: 6.3, r: 1.1, label: 'Look at the hen', onUse: () => (api.quest && api.quest.hen && api.quest.hen()) || api.say([['', 'A brown hen in a crate. She has a name tag: "TUESDAY". She looks at you like you\'re her last hope.'], ['', 'The latch is held shut with a lot of very confident knots.']]) }); }
    { const bones = [], bm = []; for (let k = 0; k < 16; k++) { const a = rnd(0, 6.28), r = rnd(1.4, 2.4); bones.push(tint(placed(cyl(0.015, 0.02, rnd(0.1, 0.22), 4), FX + 1.6 + Math.cos(a) * r * 0.4, 0.02, FZ + 2.2 + Math.sin(a) * r * 0.3, rnd(0, 6), Math.PI / 2), 0xe8e0c8)); }
      for (let k = 0; k < 60; k++) { const f = new THREE.PlaneGeometry(0.06, 0.16); f.rotateX(-Math.PI / 2); f.rotateY(rnd(0, 6)); const a = rnd(0, 6.28), r = rnd(1.2, 4.5); f.translate(FX + Math.cos(a) * r, 0.01 + rr() * 0.01, FZ + Math.sin(a) * r); bm.push(tint(f, [0xf4f0e8, 0xa0683a, 0xe8e0d0, 0x5a3a20][(rr() * 4) | 0])); }
      root.add(merged(bones, lambert({ vertexColors: true }))); root.add(merged(bm, basic({ vertexColors: true, side: THREE.DoubleSide })));
      interact.push({ id: 'bones', x: FX + 1.8, z: FZ + 2.4, r: 0.9, label: 'Look at the bones', onUse: () => api.say([['', 'Chicken bones, picked clean, arranged into a little heart. Someone\'s been busy. And hungry.']]) }); }
    // the rope back up, where you came down
    M(cyl(0.025, 0.025, HT, 5), lambert({ color: 0xb8a070 }), -11.0, HT / 2, 11.8, root);
    { const s = M(new THREE.PlaneGeometry(1.4, 0.3), basic({ map: fitSign('UP: 1,940 m', null, '#e8d8b0', 192, 40), transparent: true }), -11.0, 2.0, D / 2 - 0.42, root, Math.PI); }
    // the ghost
    const ghost = makeGhost(); root.add(ghost); ghostAlpha(ghost, 0); api.ghost = ghost;
    const torchL = { x: -11, y: 1.0, z: 10, c: 0xffa050, i: 1.15, flicker: true, dyn: true };
    api.lairTorch = torchL;
    const lightsL = [torchL, { x: FX, y: 1.1, z: FZ, c: 0xff8a3a, i: 2.0, flicker: true }, { x: -3, y: 2.4, z: -11, c: 0xffc070, i: 0.55, flicker: true }, { x: 11, y: 1.0, z: -10.2, c: 0xffd080, i: 0.5 }, { x: 0, y: 4.6, z: 6, c: 0x6a7aa8, i: 0.5 }, { x: 10, y: 3.5, z: 6, c: 0x6a7aa8, i: 0.35 }];
    api.lair = { FX, FZ, W, D, flames, fireGlow, hen, roast };
    return {
      group: root, size: LAIR_SIZE, cols, spawn: { x: -11, z: 10.4, yaw: 0.2 }, exit: { x: -11, z: 12.3, r: 0.6 }, lights: lightsL, name: 'Ghost Dwelling', bake: { amb: 0.2, sky: 0x8a9ac0, ground: 0x2a2018 }, cam: { maxDist: 3.0, height: 4.6 },
      interact,
      update: (t) => {
        for (const f of flames) { const b = f.userData.b; f.scale.set(b * (0.55 + Math.random() * 0.25), b * (1.0 + Math.random() * 0.5), 1); }
        fireGlow.material.opacity = 0.5 + Math.random() * 0.15;
        roast.rotation.x = t * 0.6;
        const hh = hen.userData.head; hh.position.y = 0.3 - (Math.sin(t * 3.1) > 0.85 ? 0.12 : 0); hen.rotation.y = Math.sin(t * 0.7) * 0.6;
      },
    };
  };
}

// ------------------------------------------------------------------ the module ------------------------------------------------------------------
export function makeCave(ctx) {
  const { scene, G, P, cat, toast, say, Sfx, isTouch } = ctx;
  const key = isTouch ? 'USE' : 'E';
  let SV = {}; try { SV = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { SV = {}; }
  SV.opened ||= {}; SV.read ||= {};
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) { /* private mode */ } };
  const S = { held: false, built: false, depth: 0, transit: false, descending: null, room: null, lairT: 0, peeks: [false, false], talkN: 0, gh: { state: 'hidden', t: 0, x: 0, z: -9, a: 0, ang: 0, poofT: 0, yaw: 0, talking: false }, tunS: 0, tunK: 0 };
  const api = { S, SV, say: (lines, cb) => say(lines, cb) };

  // ---------- outdoors: the cave mouth, a rock face, the torch on its post ----------
  const C = CAVE_SPOT, ox = Math.sin(C.yaw), oz = Math.cos(C.yaw);
  const L2W = (lx, lz) => [C.x + lx * Math.cos(C.yaw) + lz * ox, C.z - lx * Math.sin(C.yaw) + lz * oz];   // mouth-local (x right, z out) -> world
  const mouth = new THREE.Group(); mouth.position.set(C.x, 0, C.z); mouth.rotation.y = C.yaw; scene.add(mouth);
  const postTorch = makeTorch(); const handTorch = makeTorch(); handTorch.visible = false;
  handTorch.position.set(-0.17, 0.32, 0.12); handTorch.rotation.x = 0.35; handTorch.scale.setScalar(0.9); cat.add(handTorch);
  const postL = { x: 0, y: 1.6, z: 0, c: 0xff9a40, i: 0.9, flicker: true, always: true, cave: true };
  lights.push(postL);
  const POST = { lx: 1.9, lz: 0.7 }, SIGN = { lx: -2.3, lz: 1.6 };
  function buildMouth() {
    const h0 = heightAt(C.x, C.z);
    const hAt = (lx, lz) => { const [x, z] = L2W(lx, lz); return heightAt(x, z) - h0; };
    sd = 4242; textures();
    const rocks = [];
    const ROCKS = [[0, -7.4, 3.4, 1.55, 1.15, 1.0], [-4.6, -2.4, 2.2, 1.1, 1.15, 1.0], [4.7, -2.6, 2.4, 1.0, 1.2, 1.0], [-1.8, -5.0, 2.2, 1.3, 0.8, 1.0, 4.4], [2.3, -4.8, 2.0, 1.2, 0.8, 1.0, 4.2],
      [-7.6, -3.4, 2.4, 1.0, 1.0, 1.1], [7.8, -3.6, 2.6, 1.0, 0.95, 1.1], [0.6, -7.5, 3.4, 1.4, 1.1, 1.1, 2.6], [-2.3, -0.9, 0.7, 1.0, 1.4, 1.0], [2.4, -1.0, 0.75, 1.0, 1.5, 1.0], [-3.6, 0.8, 0.5, 1.2, 0.7, 1], [5.6, 0.2, 0.6, 1.1, 0.8, 1]];
    for (const [lx, lz, s, sx, sy, sz, yo] of ROCKS) {
      rocks.push(tint(placed(rockGeo(s, sx, sy, sz), lx, hAt(lx, lz) + (yo ?? s * sy * 0.55), lz, rnd(0, 6)), [0x8a8478, 0x7a7468, 0x948c80][(rr() * 3) | 0]));
      const [wx, wz] = L2W(lx, lz); colliders.push({ cx: wx, cz: wz, r: s * Math.max(sx, sz) * 0.88, h: 6, ng: true, nf: true, cave: true });
    }
    const rm = merged(rocks, lambert({ map: textures().rock, vertexColors: true, flatShading: true })); mouth.add(rm);
    // the dark opening, set into the rock face
    const hole = new THREE.Group(); hole.position.set(0, hAt(0, -1.2), -1.25); hole.scale.set(1.2, 1.1, 1); mouth.add(hole);
    const arch = new THREE.Shape(); arch.moveTo(-1.25, 0); arch.lineTo(-1.3, 1.3); arch.quadraticCurveTo(-1.1, 2.35, 0, 2.45); arch.quadraticCurveTo(1.1, 2.35, 1.3, 1.3); arch.lineTo(1.25, 0); arch.closePath();
    const ag = new THREE.ShapeGeometry(arch, 4); { const p = ag.attributes.position, uv = ag.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.3) / 2.6, p.getY(i) / 2.45); }
    M(ag, basic({ map: textures().hole }), 0, 0, 0, hole);
    M(box(2.6, 0.06, 2.0), basic({ color: 0x050403 }), 0, -0.02, -0.9, hole);   // the floor just inside, dark
    // lintel rock over the opening
    { const l = tint(placed(rockGeo(1.0, 1.9, 0.55, 0.9), 0, 0, 0), 0x7a7468); M(l, lambert({ map: textures().rock, vertexColors: true, flatShading: true }), 0, hAt(0, -1.0) + 2.55, -1.0, mouth); }
    // the torch post with an iron bracket
    const wood = lambert({ map: ctx.T.wood, color: 0x7a5a38 }), iron = phong({ color: 0x2a2a2c, shininess: 30 });
    const py = hAt(POST.lx, POST.lz);
    M(box(0.14, 1.5, 0.14), wood, POST.lx, py + 0.75, POST.lz, mouth);
    M(box(0.04, 0.04, 0.22), iron, POST.lx, py + 1.2, POST.lz + 0.11, mouth);
    M(cyl(0.05, 0.035, 0.1, 6), iron, POST.lx, py + 1.2, POST.lz + 0.22, mouth);
    postTorch.position.set(POST.lx, py + 1.0, POST.lz + 0.22); mouth.add(postTorch);
    { const [wx, wz] = L2W(POST.lx, POST.lz); colliders.push({ cx: wx, cz: wz, r: 0.16, h: 1.5, ng: true, nf: true, cave: true }); postL.x = wx + ox * 0.2; postL.z = wz + oz * 0.2; postL.y = 1.6 + py; }
    // a hand-painted sign
    const sy = hAt(SIGN.lx, SIGN.lz);
    M(box(0.08, 1.0, 0.08), wood, SIGN.lx, sy + 0.5, SIGN.lz, mouth);
    const board = M(box(1.0, 0.5, 0.04), wood, SIGN.lx, sy + 0.95, SIGN.lz + 0.05, mouth); board.rotation.z = 0.06;
    M(new THREE.PlaneGeometry(0.92, 0.42), basic({ map: fitSign('NO CATS', '#6a4a2a', '#f0e6c8', 256, 96), transparent: true }), SIGN.lx, sy + 0.95, SIGN.lz + 0.075, mouth).rotation.z = 0.06;
    // a few feathers on the ground, a hint for anyone who reads the woods
    const fs = [];
    for (let k = 0; k < 14; k++) { const lx = rnd(-1.8, 2.4), lz = rnd(-0.6, 3.2), f = new THREE.PlaneGeometry(0.06, 0.16); f.rotateX(-Math.PI / 2); f.rotateY(rnd(0, 6)); f.translate(lx, hAt(lx, lz) + 0.03, lz); fs.push(tint(f, [0xf4f0e8, 0xa0683a][k % 2])); }
    mouth.add(merged(fs, lambert({ vertexColors: true, side: THREE.DoubleSide })));
    mouth.traverse((o) => { if (o !== mouth) o.userData.noLift = true; });
    S.built = true;
  }
  // ---------- rooms ----------
  const [dx, dz] = L2W(0, -0.4);
  INTM.registerRoom('cave', { name: 'The Hollow Deep', build: buildTunnel(api) }, [{ x: dx, z: dz, yaw: C.yaw, kind: 'door' }]);
  INTM.registerRoom('cavelair', { name: 'Ghost Dwelling', build: buildLair(api) });
  INTM.close('cave', true);
  const outside = () => { const [x, z] = L2W(0, 3.0); return { x, z, yaw: C.yaw }; };

  // ---------- HUD: depth gauge + the descent overlay ----------
  const gauge = document.createElement('div');
  gauge.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);font:bold 15px monospace;color:#cfe0ff;text-shadow:0 2px 0 #000,0 0 8px #000;letter-spacing:2px;pointer-events:none;z-index:30;display:none';
  document.body.appendChild(gauge);
  const veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:45;display:flex;flex-direction:column;align-items:center;justify-content:center;font:bold 34px monospace;color:#cfe0ff;letter-spacing:4px';
  const vNum = document.createElement('div'), vTxt = document.createElement('div'); vTxt.style.cssText = 'font-size:14px;margin-top:14px;color:#9aa8c8;letter-spacing:1px;text-align:center;max-width:80%';
  veil.append(vNum, vTxt); document.body.appendChild(veil);
  const fmt = (m) => `DEPTH ${String(Math.round(m)).padStart(4, '0')} m`;

  api.descend = () => {
    if (S.descending) return;
    S.descending = { t: 0, from: S.depth, phase: 'down' }; Sfx.swing();
    vTxt.textContent = 'Goobles climbs down the rope. And down. And down. And down.';
  };
  api.openChest = (c) => {
    const g = api.chests[c.id];
    if (SV.opened[c.id]) { g.userData.want = 1; say([['', 'Empty now. You checked twice.']]); return; }
    g.userData.want = 1; Sfx.door(); SV.opened[c.id] = 1; store();
    setTimeout(() => {
      say(c.say, () => { if (c.cash && ctx.addCash) ctx.addCash(c.cash); if (c.heal) G.hp = 100; Sfx.pickup(); });
      if (c.id === 'locker' || c.id === 'jewel') S.gh.creep = 4;   // he appears right behind you after these
    }, 380);
    S.inspected = (S.inspected | 0) + 1;
  };
  api.poem = (id) => {
    const p = POEMS[id]; SV.read[id] = 1; store();
    const n = Object.keys(SV.read).length;
    say([['', `"${p.title}"`], ...p.lines.map((l) => [GHOST + ' (WRITTEN)', l]), ['', `(Poems found: ${n} of 6)`]]);
    S.inspected = (S.inspected | 0) + 1;
  };
  api.periscope = () => {
    const late = (G.clock ?? 12) > 20 || (G.clock ?? 12) < 6;
    say([['', 'A brass periscope, going straight up through 1,940 metres of rock. Somehow.'], ['', 'It\'s aimed at your RV. At the bedroom window. At your pillow, specifically.'], ['', late ? 'The pillow is empty. Because you are down here. With him.' : 'There\'s a sticky note on the eyepiece: "BEST VIEW IN THE COUNTY".']]);
    S.inspected = (S.inspected | 0) + 1;
  };
  api.piano = () => {
    [262, 330, 392, 330, 294, 262].forEach((f, i) => setTimeout(() => Sfx.blip(f), i * 220));
    const lines = S.gh.state === 'haunt' ? [['', 'Plink. Plonk. Plink.'], [GHOST, '(humming along, off-key, very moved)'], [GHOST, 'You PLAY? Of course you play. You walk on keyboards. It\'s the same thing.']] : [['', 'Plink. Plonk. Somewhere in the dark, someone hums along. Off-key.']];
    setTimeout(() => say(lines), 300);
    S.inspected = (S.inspected | 0) + 1;
  };

  // ---------- interiors hooks: lights + fog in the cave, a prompt for talking to the ghost ----------
  INTM.on('env', (id) => {
    if (id !== 'cave' && id !== 'cavelair') return;
    const lair = id === 'cavelair';
    if (ctx.hemi) { ctx.hemi.intensity = lair ? 0.32 : 0.14; ctx.hemi.color.set(0x8a9ac0); ctx.hemi.groundColor.set(0x1a1410); }
    if (scene.fog) { scene.fog.color.setRGB(0.012, 0.012, 0.02); scene.fog.near = lair ? 7 : 2.5; scene.fog.far = lair ? 34 : 20; }
    if (ctx.post && ctx.post.comp) ctx.post.comp.uniforms.night.value = lair ? 0.45 : 0.6;
  });
  INTM.on('enter', (id) => {
    if (id === 'cave') { S.room = 'cave'; if (!S.transit) { S.depth = 0; S.peeks = [false, false]; S.tunK = 0; } }
    if (id === 'cavelair') { S.room = 'cavelair'; S.lairT = 0; enterLair(); }
  });
  INTM.on('exit', (id) => {
    if (id !== 'cave' && id !== 'cavelair') return;
    S.room = null;
    if (S.transit) return;
    gauge.style.display = 'none';
    if (S.held) { setHeld(false); toast('You put the torch back on its post.', 2.5); }
  });
  INTM.addPrompt((id) => {
    if (id !== 'cavelair') return null;
    const g = S.gh; if (g.state !== 'haunt' || g.a < 0.6 || g.talking) return null;
    const R = window.__INT && window.__INT.room; if (!R) return null;
    const d = Math.hypot(P.x - (R.origin.x + g.x), P.z - (R.origin.z + g.z));
    return d < 3.4 ? { text: (api.quest && api.quest.talkLabel && api.quest.talkLabel()) || 'Talk to the ghost', btn: 'TALK' } : null;
  });
  INTM.addUse((id) => {
    if (id !== 'cavelair') return false;
    const g = S.gh; if (g.state !== 'haunt' || g.a < 0.6) return false;
    const R = window.__INT.room, d = Math.hypot(P.x - (R.origin.x + g.x), P.z - (R.origin.z + g.z));
    if (d >= 3.4) return false;
    if (api.quest && api.quest.talk && api.quest.talk()) return true;
    g.talking = true;
    const lines = TALK[S.talkN++ % TALK.length];
    say(lines, () => { g.talking = false; });
    return true;
  });

  function enterLair() {
    const g = S.gh;
    if (SV.met) { g.state = 'hidden'; g.t = 0; } else { g.state = 'hidden'; g.t = 0; }
    g.a = 0; ghostAlpha(api.ghost, 0); S.inspected = 0; g.creep = 0;
    gauge.style.display = 'block'; gauge.textContent = fmt(LAIR_DEPTH);
  }
  function setHeld(on) {
    S.held = on; handTorch.visible = on; postTorch.visible = !on;
    INTM.close('cave', !on);
    if (!on) { const [wx, wz] = L2W(POST.lx, POST.lz); postL.x = wx + ox * 0.2; postL.z = wz + oz * 0.2; postL.y = 1.6 + (heightAt(wx, wz) - heightAt(C.x, C.z)) * 0; }
  }

  // ---------- outdoors E + prompt ----------
  const dLocal = (lx, lz) => { const [x, z] = L2W(lx, lz); return Math.hypot(P.x - x, P.z - z); };
  function near() {
    if (P.car || G.dialog || G.paused || INTM.current()) return null;
    if (Math.abs(P.x - C.x) > 12 || Math.abs(P.z - C.z) > 12) return null;
    if (dLocal(POST.lx, POST.lz + 0.3) < 1.3) return S.held ? { verb: 'Put the torch back', fn: () => { setHeld(false); Sfx.blip(300); } } : { verb: 'Take the torch', fn: takeTorch };
    if (dLocal(SIGN.lx, SIGN.lz + 0.4) < 1.3) return { verb: 'Read the sign', fn: () => say([['', '"KEEP OUT. NO CATS."'], ['', 'Underneath, smaller, in a different pen: "(cats welcome) (one cat) (you know who you are)"']]) };
    if (!S.held && dLocal(0, 0.2) < 2.0) return { verb: 'Peer into the cave', fn: () => { toast('Pitch black. Something far below is humming. Off-key. You\'d need a light.', 4); Sfx.blip(120); } };
    return null;
  }
  function takeTorch() {
    setHeld(true); Sfx.pickup();
    toast(SV.visits ? 'You take the torch. Back down we go.' : 'You take the torch. It smells of campfire and, faintly, patchouli.', 3.5);
  }
  const prompt = () => { const n = near(); return n ? `${key}: ${n.verb}` : ''; };
  const interact = () => { const n = near(); if (!n) return false; n.fn(); return true; };

  // ---------- per frame ----------
  let firstT = 0;
  function update(dt) {
    if (!S.built) { firstT += dt; if (firstT > 0.05) { try { buildMouth(); } catch (e) { console.error('[cave] mouth failed', e); S.built = true; } } }
    const t = G.time || 0;
    mouth.visible = Math.abs(P.x - C.x) < 150 && Math.abs(P.z - C.z) < 150;   // deep in the woods: no draw calls from town
    if (postTorch.visible && mouth.visible) postTorch.userData.flick(t);
    if (handTorch.visible) handTorch.userData.flick(t);
    // the torch light rides with the cat
    if (S.held && !INTM.current()) {
      if (P.car || P.swim || Math.hypot(P.x - C.x, P.z - C.z) > 90) { setHeld(false); toast(P.swim ? 'Fssst. The torch is out. Back on its post it goes, somehow.' : 'You leave the torch at the cave.', 3); }
      else { postL.x = P.x + Math.sin(P.yaw) * 0.25; postL.z = P.z + Math.cos(P.yaw) * 0.25; postL.y = 1.0; if (ctx.pool) for (const l of ctx.pool) if (l.userData.src === postL) l.position.set(postL.x, l.position.y, postL.z); }
    }
    const R = window.__INT && window.__INT.room;
    if (!R || (S.room !== 'cave' && S.room !== 'cavelair')) { if (S.descending) runDescent(dt); return; }
    const lx = P.x - R.origin.x, lz = P.z - R.origin.z;
    if (S.room === 'cave' && api.tun) {
      api.tunTorch.x = lx + Math.sin(P.yaw) * 0.3; api.tunTorch.z = lz + Math.cos(P.yaw) * 0.3;
      // how far down the tunnel are we? nearest sample, searched round the last one
      const pts = api.tun.pts; let best = S.tunK, bd = 1e9;
      for (let k = Math.max(0, S.tunK - 8); k < Math.min(pts.length, S.tunK + 9); k++) { const d = Math.hypot(pts[k].x - lx, pts[k].z - lz); if (d < bd) { bd = d; best = k; } }
      if (bd > 6) for (let k = 0; k < pts.length; k++) { const d = Math.hypot(pts[k].x - lx, pts[k].z - lz); if (d < bd) { bd = d; best = k; } }
      S.tunK = best; S.tunS = pts[best].s;
      if (!S.descending) S.depth = 12 + (TUNNEL_DEPTH - 12) * (S.tunS / api.tun.len);
      gauge.style.display = 'block'; gauge.textContent = fmt(S.depth);
      tunnelPeeks(dt, t);
    }
    if (S.room === 'cavelair' && api.ghost) {
      api.lairTorch.x = lx + Math.sin(P.yaw) * 0.3; api.lairTorch.z = lz + Math.cos(P.yaw) * 0.3;
      for (const id in api.chests) { const c = api.chests[id].userData; if (SV.opened[id] && c.want === 0) c.want = 1; c.open += (c.want - c.open) * Math.min(1, dt * 5); c.lid.rotation.x = -1.85 * c.open; }
      S.lairT += dt; lairGhost(dt, t, lx, lz);
    }
    if (S.descending) runDescent(dt);
  }
  function tunnelPeeks(dt, t) {
    const g = api.tunGhost, L = api.tun.len, pts = api.tun.pts;
    const spots = [L * 0.4, L * 0.74];
    if (!g.userData.peek) {
      for (let i = 0; i < 2; i++) if (!S.peeks[i] && S.tunS > spots[i] - 15 && S.tunS < spots[i] - 6) {
        S.peeks[i] = true; const k = Math.round(spots[i] / 2.5), p = pts[Math.min(pts.length - 1, k)];
        g.position.set(p.x, 0, p.z); g.rotation.y = Math.atan2(-p.tx, -p.tz); g.userData.peek = { t: 0, side: i ? -1 : 1, nx: -p.tz, nz: p.tx };
        Sfx.blip(180);
      }
    }
    const pk = g.userData.peek;
    if (pk) {
      pk.t += dt;
      const fadeIn = clamp(pk.t / 0.6, 0, 1), fadeOut = clamp((pk.t - 1.6) / 0.9, 0, 1);
      ghostAlpha(g, fadeIn * (1 - fadeOut) * 0.9);
      if (pk.t > 1.4) { g.position.x += pk.nx * pk.side * dt * 2.2; g.position.z += pk.nz * pk.side * dt * 2.2; }
      animGhost(g, t, pk.t < 1.4 ? 'wave' : 'float');
      if (pk.t > 2.6) { g.userData.peek = null; ghostAlpha(g, 0); }
    }
  }
  function lairGhost(dt, t, lx, lz) {
    const g = S.gh, m = api.ghost, A = api.lair;
    g.t += dt;
    const dCat = Math.hypot(g.x - lx, g.z - lz);
    if (g.state === 'hidden') {
      const nearFire = Math.hypot(lx - A.FX, lz - A.FZ) < 3.6;
      if (!G.dialog && (S.lairT > (SV.met ? 6 : 22) || (S.inspected | 0) >= 2 || nearFire || g.creep > 0)) {
        // appear behind the cat
        const side = Math.random() < 0.5 ? -0.8 : 0.8, bx = lx + Math.sin(P.yaw + side) * 3.4, bz = lz + Math.cos(P.yaw + side) * 3.4;   // pops up in front, a little to one side
        g.x = clamp(bx, -A.W / 2 + 1.5, A.W / 2 - 1.5); g.z = clamp(bz, -A.D / 2 + 1.5, A.D / 2 - 1.5);
        if (Math.hypot(g.x - A.FX, g.z - A.FZ) < 1.6) g.x += 2;
        g.state = 'reveal'; g.t = 0; g.creep = 0;
        [520, 440, 360, 300].forEach((f, i) => setTimeout(() => Sfx.blip(f), i * 160));
      }
    } else if (g.state === 'reveal') {
      g.a = clamp(g.t / 1.4, 0, 1);
      if (g.t > 1.5 && !G.dialog) {
        g.state = 'talk'; const first = !SV.met; SV.met = 1; SV.visits = (SV.visits | 0) + 1; store();
        const qq = api.quest && api.quest.reveal ? api.quest.reveal(first) : null;   // hens.js: the Missing Hens confrontation
        say(qq ? qq.lines : first ? INTRO : AGAIN, () => { g.state = 'haunt'; g.t = 0; if (qq && qq.then) qq.then(); });
      }
    } else if (g.state === 'talk') {
      g.a = 1;
    } else if (g.state === 'haunt') {
      if (!g.talking) {
        g.ang += dt * 0.22;
        const tx = clamp(lx + Math.cos(g.ang) * 4.2, -A.W / 2 + 1.4, A.W / 2 - 1.4), tz = clamp(lz + Math.sin(g.ang) * 3.6, -A.D / 2 + 1.4, A.D / 2 - 1.4);
        const ddx = tx - g.x, ddz = tz - g.z, dd = Math.hypot(ddx, ddz);
        if (dd > 0.05) { const st = Math.min(dd, dt * 1.6); g.x += ddx / dd * st; g.z += ddz / dd * st; }
        const fd = Math.hypot(g.x - A.FX, g.z - A.FZ); if (fd < 1.5) { g.x = A.FX + (g.x - A.FX) / fd * 1.5; g.z = A.FZ + (g.z - A.FZ) / fd * 1.5; }
        if (dCat < 1.35 && !G.dialog) { g.state = 'poof'; g.t = 0; toast(POOF[(Math.random() * POOF.length) | 0], 1.6); Sfx.blip(900); }
      }
      g.a = Math.min(1, g.a + dt * 2);
    } else if (g.state === 'poof') {
      g.a = Math.max(0, 1 - g.t / 0.35);
      if (g.t > 1.6) {
        for (let k = 0; k < 12; k++) { const x = rnd(-A.W / 2 + 2, A.W / 2 - 2), z = rnd(-A.D / 2 + 2, A.D / 2 - 2); if (Math.hypot(x - lx, z - lz) > 6 && Math.hypot(x - A.FX, z - A.FZ) > 2) { g.x = x; g.z = z; break; } }
        g.state = 'haunt'; g.t = 0; g.a = 0; Sfx.blip(700);
      }
    }
    // always facing the cat
    const want = Math.atan2(lx - g.x, lz - g.z);
    g.yaw += Math.atan2(Math.sin(want - g.yaw), Math.cos(want - g.yaw)) * Math.min(1, dt * 4);
    m.position.set(g.x, 0, g.z); m.rotation.y = g.yaw;
    ghostAlpha(m, g.a);
    animGhost(m, t, g.state === 'reveal' ? 'boo' : g.talking || g.state === 'talk' ? 'wave' : 'float');
  }
  function runDescent(dt) {
    const D = S.descending; D.t += dt;
    P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.3);
    if (D.phase === 'down') {
      veil.style.opacity = String(clamp(D.t / 0.5, 0, 1));
      const k = clamp((D.t - 0.5) / 3.2, 0, 1), e = k * k * (3 - 2 * k);
      S.depth = D.from + (LAIR_DEPTH - D.from) * e;
      vNum.textContent = fmt(S.depth);
      if (Math.floor(D.t * 6) !== D.tick) { D.tick = Math.floor(D.t * 6); if (k > 0 && k < 1) Sfx.blip(200 + (1 - k) * 200); }
      if (D.t > 4.0) {
        D.phase = 'arrive'; D.t = 0;
        S.transit = true;
        try { INTM.enter('cavelair', { instant: true, returnTo: outside() }); } finally { S.transit = false; }
        Sfx.punch();
      }
    } else {
      vNum.textContent = fmt(LAIR_DEPTH);
      veil.style.opacity = String(clamp(1 - D.t / 0.8, 0, 1));
      if (D.t > 0.8) { veil.style.opacity = '0'; S.descending = null; }
    }
  }

  // ---------- debug ----------
  Object.assign(api, {
    update, prompt, interact,
    tp() { const [x, z] = L2W(0, 4.5); P.x = x; P.z = z; P.y = 0; P.yaw = C.yaw + Math.PI; return { x, z }; },
    torch() { setHeld(true); },
    goLair() { setHeld(true); S.transit = true; try { INTM.enter('cavelair', { instant: true, returnTo: outside() }); } finally { S.transit = false; } },   // (api.lair is the dwelling's data once it is built)
    tunnel() { setHeld(true); INTM.enter('cave', { instant: true, returnTo: outside() }); },
    reset() { SV = api.SV = { opened: {}, read: {} }; store(); },
    state: () => ({ held: S.held, room: S.room, depth: Math.round(S.depth), ghost: S.gh.state, met: !!SV.met, opened: Object.keys(SV.opened), read: Object.keys(SV.read) }),
    spot: C, mouth,
  });
  window.__CAVE = api;
  return api;
}
