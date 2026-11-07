// PS2-era rendering kit: materials, detailed procedural textures (tileable fbm), sky dome, post pipeline
// (bloom, grade, grain, vignette, soft upscale).
import * as THREE from 'three';

// ---------- materials ----------
export const lambert = (o = {}) => new THREE.MeshLambertMaterial(o);
export const phong = (o = {}) => new THREE.MeshPhongMaterial(o);
export const basic = (o = {}) => new THREE.MeshBasicMaterial(o);
export const ANISO = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 1 : 4; // P9: texture anisotropy (1 on touch)
const matCache = new Map();
/** Shared material for a colour, optionally textured / emissive / shiny. */
export function mat(color, map = null, emissive = 0, shiny = 0) {
  const k = color + '|' + (map ? map.uuid : '') + '|' + emissive + '|' + shiny;
  if (!matCache.has(k)) {
    matCache.set(k, shiny
      ? phong({ color, map, emissive, shininess: shiny, specular: 0x555555 })
      : lambert({ color, map, emissive }));
  }
  return matCache.get(k);
}

// ---------- noise ----------
let seed = 1234;
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const LAT = new Float32Array(256 * 256);
for (let i = 0; i < LAT.length; i++) LAT[i] = rnd();
const L = (i, j, p) => LAT[(((i % p) + p) % p) + ((((j % p) + p) % p) << 8)];
function vnoise(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = L(xi, yi, p), b = L(xi + 1, yi, p), c = L(xi, yi + 1, p), d = L(xi + 1, yi + 1, p);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Tileable fbm: u,v in 0..1, base frequency f (integer), octaves o. Returns ~0..1. */
export function fbm(u, v, f = 4, o = 4) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < o; i++) { s += vnoise(u * f, v * f, f) * a; n += a; a *= 0.5; f *= 2; }
  return s / n;
}
const clamp = (x, a = 0, b = 255) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (A, B, t) => [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)];

/** Build a texture from a per-pixel function, then optional canvas drawing on top. */
export function tex(w, h, fn, post = null, o = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (fn) {
    const img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      d[i] = clamp(p[0]); d[i + 1] = clamp(p[1]); d[i + 2] = clamp(p[2]); d[i + 3] = p[3] === undefined ? 255 : clamp(p[3]);
    }
    g.putImageData(img, 0, 0);
  }
  if (post) post(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.nearest) { t.magFilter = THREE.NearestFilter; }
  return t;
}

// helper for canvas text signs with optional neon glow
function signTex(text, bg, fg, w = 256, h = 64, glow = false, font = 'bold') {
  return tex(w, h, null, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.font = `${font} ${Math.round(h * 0.62)}px Impact, "Arial Black", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (glow) { g.shadowColor = fg; g.shadowBlur = h * 0.25; }
    g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 2);
    if (glow) { g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.6; g.fillText(text, w / 2, h / 2 + 2); g.globalAlpha = 1; }
    if (bg) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }
  }, { repeat: false });
}

export function makeTextures() {
  const T = {};
  const R = Math.random;
  T.grass = tex(128, 128, (u, v) => {
    const n = fbm(u, v, 4, 4), m = fbm(u + 0.3, v + 0.7, 16, 2), s = R();
    const c = mixc([46, 74, 30], [104, 140, 58], n * 0.8 + m * 0.4);
    const k = s < 0.08 ? 0.75 : s > 0.94 ? 1.2 : 1;
    return [c[0] * k, c[1] * k, c[2] * k];
  }, (g) => {
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = R() < 0.5 ? 'rgba(30,52,20,0.55)' : 'rgba(150,180,90,0.45)';
      const x = R() * 128, y = R() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - 2 - R() * 4); g.stroke();
    }
  });
  const asphalt = (u, v) => {
    const n = fbm(u, v, 8, 4), s = R();
    let b = 54 + n * 30 + (s < 0.06 ? 30 : s < 0.12 ? -14 : 0);
    return [b, b, b + 4];
  };
  const cracks = (g, w, h, n = 3) => {
    g.strokeStyle = 'rgba(20,20,22,0.7)'; g.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      let x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 12; i++) { x += (R() - 0.5) * 12; y += (R() - 0.3) * 10; g.lineTo(x, y); }
      g.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const x = R() * w, y = R() * h, r = 6 + R() * 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(10,10,14,0.45)'); gr.addColorStop(1, 'rgba(10,10,14,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  };
  T.asphalt = tex(128, 128, asphalt, (g, w, h) => cracks(g, w, h, 2));
  T.road = tex(128, 256, asphalt, (g, w, h) => {
    g.fillStyle = 'rgba(40,40,44,0.5)'; g.fillRect(20 + R() * 40, 140, 36, 60); // tar patch
    cracks(g, w, h, 4);
    // worn centre dash + edge lines
    const paint = (x, y, ww, hh, col) => {
      for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) {
        if (fbm(xx / w, yy / h, 16, 2) < 0.38) continue;
        g.fillStyle = col; g.globalAlpha = 0.65 + R() * 0.3; g.fillRect(xx, yy, 1, 1);
      }
      g.globalAlpha = 1;
    };
    paint(61, 0, 6, 104, '#d8b83a');
    paint(4, 0, 4, h, '#d6d6cc'); paint(120, 0, 4, h, '#d6d6cc');
  });
  T.crosswalk = tex(128, 128, asphalt, (g) => {
    for (let x = 6; x < 128; x += 24) for (let y = 14; y < 114; y++) for (let xx = x; xx < x + 13; xx++) {
      if (fbm(xx / 128, y / 128, 16, 2) < 0.35) continue;
      g.fillStyle = `rgba(222,222,214,${0.7 + R() * 0.3})`; g.fillRect(xx, y, 1, 1);
    }
  });
  T.sidewalk = tex(128, 128, (u, v, x, y) => {
    const n = fbm(u, v, 8, 4), s = R();
    let b = 150 + n * 40 + (s < 0.05 ? -18 : s > 0.97 ? 14 : 0);
    if (x % 64 < 2 || y % 64 < 2) b *= 0.55;
    const st = fbm(u + 0.5, v + 0.2, 4, 3); if (st > 0.62) b *= 0.82;
    return [b, b * 0.98, b * 0.94];
  }, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(40,40,40,0.35)'; g.beginPath(); g.arc(R() * 128, R() * 128, 1 + R(), 0, 7); g.fill(); } });
  T.dirt = tex(128, 128, (u, v) => {
    const n = fbm(u, v, 6, 4), s = R();
    const c = mixc([96, 72, 48], [156, 126, 88], n);
    const k = s < 0.07 ? 0.75 : s > 0.95 ? 1.25 : 1;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  T.siding = tex(128, 128, (u, v, x, y) => {
    const b = y % 16, n = fbm(u, v, 8, 3), grain = fbm(u * 0.2, v * 4, 8, 2);
    let k = 0.86 + n * 0.12 + grain * 0.04;
    if (b < 2) k *= 0.62; else if (b < 4) k *= 1.06; else k *= 1 - (b - 4) * 0.006;
    return [236 * k, 234 * k, 228 * k];
  });
  T.brick = tex(128, 128, (u, v, x, y) => {
    const row = Math.floor(y / 11), off = row % 2 ? 16 : 0, bx = Math.floor((x + off) / 32);
    const mortar = y % 11 < 2 || (x + off) % 32 < 2;
    const n = fbm(u, v, 16, 3), soot = fbm(u, v, 3, 3);
    const h = LAT[(row * 31 + bx * 7) & 65535];
    if (mortar) { const m = 160 + n * 40; return [m, m * 0.96, m * 0.9]; }
    const c = mixc([128, 52, 38], [186, 92, 66], h * 0.7 + n * 0.4);
    const k = 0.78 + soot * 0.3;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  T.shingle = tex(128, 128, (u, v, x, y) => {
    const row = Math.floor(y / 16), off = row % 2 ? 12 : 0, tx = Math.floor((x + off) / 24);
    const h = LAT[(row * 17 + tx * 13) & 65535], n = fbm(u, v, 16, 3);
    let b = 150 + h * 60 + n * 50;
    if (y % 16 > 13) b *= 0.55;
    if ((x + off) % 24 < 1) b *= 0.65;
    return [b, b, b];
  });
  const winFrame = (g, w, h) => {
    g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 6, w, 6); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
    g.fillRect(w / 2 - 2, 0, 4, h); g.fillRect(0, h / 2 - 2, w, 4);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, 4, w - 8, 2);
  };
  T.window = tex(64, 64, (u, v) => {
    const r = Math.max(0, 1 - Math.abs(u - v * 0.8 - 0.1) * 4);
    const c = mixc([26, 36, 52], [92, 118, 146], v * 0.3 + r * 0.6);
    return c;
  }, (g, w, h) => {
    g.fillStyle = 'rgba(200,170,180,0.55)'; g.fillRect(4, 4, 9, h - 10); g.fillRect(w - 13, 4, 9, h - 10);
    winFrame(g, w, h);
  }, { repeat: false });
  T.windowLit = tex(64, 64, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.35);
    const c = mixc([255, 226, 150], [196, 120, 52], Math.min(1, d * 1.6));
    return c;
  }, (g, w, h) => {
    g.fillStyle = 'rgba(120,60,30,0.55)'; g.fillRect(4, 4, 10, h - 10); g.fillRect(w - 14, 4, 10, h - 10);
    g.fillStyle = 'rgba(60,30,20,0.25)'; for (let y = 8; y < h - 8; y += 5) g.fillRect(14, y, w - 28, 1);
    winFrame(g, w, h);
  }, { repeat: false });
  T.door = tex(64, 128, (u, v) => { const n = fbm(u * 0.3, v * 3, 8, 3); const b = 220 + n * 30; return [b, b, b]; }, (g) => {
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
    for (const [x, y, w, h] of [[8, 8, 20, 48], [36, 8, 20, 48], [8, 68, 20, 52], [36, 68, 20, 52]]) { g.strokeRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x + 2, y + 2, w - 4, 3); }
    g.fillStyle = '#d8b440'; g.beginPath(); g.arc(54, 66, 3, 0, 7); g.fill();
  }, { repeat: false });
  T.garage = tex(128, 128, (u, v, x, y) => {
    const n = fbm(u, v, 8, 3); let b = 214 + n * 26;
    if (y % 32 < 2) b *= 0.6; if (y % 32 > 6 && y % 32 < 26 && (x % 32 < 3 || x % 32 > 29)) b *= 0.85;
    b *= 0.8 + 0.2 * Math.min(1, (1 - v) * 4);
    return [b, b, b * 0.98];
  }, null, { repeat: false });
  T.water = tex(128, 128, (u, v) => {
    const n = fbm(u, v, 4, 4), m = fbm(u + 0.4, v, 16, 2);
    const c = mixc([22, 52, 70], [70, 120, 140], n);
    return m > 0.66 ? mixc(c, [190, 220, 230], (m - 0.66) * 2) : c;
  });
  T.leaves = tex(128, 128, (u, v) => {
    const n = fbm(u, v, 8, 4), m = fbm(u + 0.2, v + 0.6, 16, 2);
    if (n < 0.42) return [24, 44, 22];
    const c = mixc([46, 86, 38], [120, 160, 70], (n - 0.42) * 2 + m * 0.3);
    return c;
  });
  T.bark = tex(64, 128, (u, v) => { const n = fbm(u * 2, v * 0.25, 8, 4); const c = mixc([52, 38, 26], [118, 90, 62], n); return c; });
  T.multicam = tex(128, 128, (u, v) => {
    const n1 = fbm(u, v, 4, 3), n2 = fbm(u + 0.37, v + 0.11, 6, 3), n3 = fbm(u + 0.71, v + 0.53, 10, 2);
    let c = [163, 144, 106];
    if (n1 > 0.58) c = [111, 92, 62];
    if (n2 > 0.62 && n1 <= 0.58) c = [124, 132, 86];
    if (n3 > 0.68) c = [198, 184, 143];
    if (n1 > 0.7 && n3 < 0.42) c = [79, 67, 48];
    const g = 0.92 + R() * 0.12;
    return [c[0] * g, c[1] * g, c[2] * g];
  }, (g) => { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 10; y < 128; y += 16) g.fillRect(0, y, 128, 2); });
  T.fence = tex(128, 64, (u, v, x, y) => {
    const px = x % 16; if (px > 13) return [36, 30, 24];
    const n = fbm(u * 0.4, v * 3, 8, 3); let b = 196 + n * 40;
    if (px < 1) b *= 0.8; if (y < 4 && (px < 3 || px > 10)) return [36, 30, 24];
    return [b, b * 0.96, b * 0.9];
  });
  T.wood = tex(64, 64, (u, v, x, y) => { const n = fbm(u * 0.4, v * 4, 8, 3); const c = mixc([110, 74, 44], [170, 124, 80], n); if (y % 16 < 1) return [60, 40, 24]; return c; });
  T.carWin = tex(64, 32, (u, v) => {
    const r = Math.max(0, 1 - Math.abs(u * 1.2 - v - 0.2) * 5);
    return mixc([14, 18, 26], [110, 130, 150], r * 0.7 + (1 - v) * 0.15);
  });
  T.tire = tex(64, 64, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (d > 0.62) { const b = 26 + fbm(u, v, 16, 2) * 14; return [b, b, b]; }
    if (d > 0.56) return [60, 60, 62];
    const a = Math.atan2(v - 0.5, u - 0.5), spoke = Math.abs(Math.cos(a * 5)) > 0.8;
    const b = spoke || d < 0.14 ? 190 : 120;
    return [b, b, b * 1.04];
  }, null, { repeat: false });
  T.metal = tex(64, 64, (u, v) => { const n = fbm(u * 0.1, v * 8, 8, 2); const b = 140 + n * 50; return [b, b, b + 6]; });
  T.cloth = tex(64, 64, (u, v) => { const n = fbm(u, v, 4, 3), w = fbm(u * 0.5, v * 2, 8, 2); const b = 200 + n * 40 + w * 20 - (R() < 0.1 ? 10 : 0); return [b, b, b]; });
  T.fur = tex(64, 64, (u, v) => { const n = fbm(u, v, 8, 3), s = R(); const b = 228 + n * 24 - (s < 0.1 ? 14 : 0); return [b, b, b - 4]; });
  T.helmet = tex(64, 64, (u, v) => { const n = fbm(u, v, 8, 3); const c = mixc([62, 72, 48], [96, 106, 74], n); return c; });
  T.shadow = tex(64, 64, (u, v) => { const d = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); return [0, 0, 0, 255 * Math.pow(1 - d, 1.6) * 0.8]; }, null, { repeat: false });
  T.shadowRect = tex(64, 64, (u, v) => {
    const e = Math.min(u, 1 - u, v, 1 - v) * 2; return [0, 0, 0, 255 * Math.min(1, e * 4) * 0.62];
  }, null, { repeat: false });
  T.glow = tex(64, 64, (u, v) => { const d = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); const a = Math.pow(1 - d, 2.2); return [255, 255, 255, 255 * a]; }, null, { repeat: false });
  T.flame = tex(32, 64, (u, v) => {
    const n = fbm(u, v, 4, 3), d = Math.abs(u - 0.5) * 2 + (1 - v) * 0.2;
    const a = Math.max(0, (1 - d) * v * 1.6 - n * 0.6);
    return [255, 120 + 120 * v, 40 * v, 255 * Math.min(1, a)];
  }, null, { repeat: false });
  // posters + graffiti
  T.posterCat = tex(64, 96, (u, v) => { const n = fbm(u, v, 8, 2); const b = 228 + n * 24; return [b, b, b * 0.94]; }, (g) => {
    g.fillStyle = '#111'; g.font = 'bold 14px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('LOST CAT', 32, 16);
    g.fillStyle = '#f4f4f4'; g.fillRect(14, 22, 36, 34); g.strokeStyle = '#333'; g.strokeRect(14, 22, 36, 34);
    g.fillStyle = '#556040'; g.beginPath(); g.arc(32, 36, 10, Math.PI, 0); g.fill(); g.fillStyle = '#111'; for (let i = 0; i < 4; i++) g.fillRect(23 + i * 5, 36, 3, 4);
    g.fillStyle = '#ddd'; g.beginPath(); g.arc(32, 44, 8, 0, 7); g.fill();
    g.fillStyle = '#222'; g.font = '8px sans-serif'; g.fillText('ANSWERS TO "SIR"', 32, 68); g.fillText('WEARS HELMET', 32, 78); g.fillText('REWARD: TUNA', 32, 88);
  }, { repeat: false });
  T.posterHoa = tex(64, 96, (u, v) => { const n = fbm(u, v, 8, 2); const b = 200 + n * 20; return [b * 1.05, b, b * 0.7]; }, (g) => {
    g.fillStyle = '#1e2a44'; g.fillRect(0, 0, 64, 18); g.fillStyle = '#fff'; g.font = 'bold 11px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('HOA NOTICE', 32, 13);
    g.fillStyle = '#222'; g.font = '8px sans-serif';
    ['Grass max', '2.5 inches.', 'No RVs.', 'No fun', 'after 9 PM.', '- Gary'].forEach((t, i) => g.fillText(t, 32, 32 + i * 11));
  }, { repeat: false });
  T.graffiti = tex(256, 64, null, (g) => {
    g.font = 'bold 44px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#1a1a1a'; g.strokeText('RICKY WUZ HERE', 128, 34);
    const gr = g.createLinearGradient(0, 10, 0, 56); gr.addColorStop(0, '#ff5ab4'); gr.addColorStop(1, '#5ad0ff');
    g.fillStyle = gr; g.fillText('RICKY WUZ HERE', 128, 34);
    g.fillStyle = 'rgba(255,90,180,0.6)'; for (let i = 0; i < 6; i++) g.fillRect(30 + R() * 200, 50, 2, 6 + R() * 10);
  }, { repeat: false });
  T.vending = tex(64, 128, null, (g) => {
    g.fillStyle = '#c02028'; g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#fff'; g.font = 'bold 13px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('COLD', 32, 18); g.fillText('DRINKS', 32, 32);
    g.fillStyle = '#ffe9e0'; g.fillRect(6, 40, 38, 70);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) { g.fillStyle = ['#2e6fbf', '#e0b030', '#3a8f5a'][(x + y) % 3]; g.fillRect(9 + x * 12, 44 + y * 16, 8, 12); }
    g.fillStyle = '#222'; g.fillRect(48, 50, 10, 20); g.fillRect(10, 114, 30, 8);
  }, { repeat: false });
  T.sign = (text, bg, fg, w = 256, h = 64, glow = false) => signTex(text, bg, fg, w, h, glow);
  return T;
}

/** Painted face texture for a sphere head (front of the sphere is u=0.25). */
export function faceTex(skin, hair, o = {}) {
  const sc = new THREE.Color(skin), hc = new THREE.Color(hair);
  const S = [sc.r * 255, sc.g * 255, sc.b * 255], H = [hc.r * 255, hc.g * 255, hc.b * 255];
  return tex(128, 64, (u, v) => {
    const n = fbm(u, v, 8, 2) * 0.08 + 0.96;
    const du = Math.min(Math.abs(u - 0.75), 1 - Math.abs(u - 0.75));
    const hairLine = o.bald ? 0.12 : 0.34 + (du < 0.3 ? 0.25 * (1 - du / 0.3) : 0);
    if (v < hairLine) { const k = 0.85 + fbm(u * 4, v * 0.5, 8, 2) * 0.3; return [H[0] * k, H[1] * k, H[2] * k]; }
    const dz = Math.abs(u - 0.25); // cheek shading toward the sides
    const k = n * (1 - Math.min(0.18, Math.max(0, dz - 0.1) * 0.6));
    return [S[0] * k, S[1] * k, S[2] * k];
  }, (g) => {
    const cx = 32, ey = 32;
    for (const s of [-1, 1]) {
      const x = cx + s * 5.5;
      g.fillStyle = '#f6f3ec'; g.beginPath(); g.ellipse(x, ey, 3, 1.9, 0, 0, 7); g.fill();
      g.fillStyle = o.eye || '#3a2a1a'; g.beginPath(); g.arc(x + s * 0.3, ey + 0.2, 1.4, 0, 7); g.fill();
      g.fillStyle = '#111'; g.fillRect(x - 0.5, ey - 0.4, 1, 1);
      g.strokeStyle = 'rgba(30,20,10,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 3.2, ey - 3.6 - (o.angry ? s : 0)); g.lineTo(x + 3, ey - 4 + (o.angry ? s * 0.8 : 0)); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x, ey, 3, 1.9, 0, Math.PI, 0); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.beginPath(); g.moveTo(cx, ey + 1); g.lineTo(cx - 2, ey + 8); g.lineTo(cx + 2, ey + 8); g.fill();
    g.strokeStyle = 'rgba(110,40,40,0.8)'; g.lineWidth = 1.2; g.beginPath();
    if (o.smile) g.arc(cx, ey + 9, 4, 0.2, Math.PI - 0.2); else { g.moveTo(cx - 3.5, ey + 12); g.lineTo(cx + 3.5, ey + 12); }
    g.stroke();
    if (o.glasses) { g.strokeStyle = '#222'; g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 5.5, ey, 3.8, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(cx - 1.7, ey); g.lineTo(cx + 1.7, ey); g.stroke(); }
    if (o.wrinkles) { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.7; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 6, ey - 8 - i * 1.6); g.lineTo(cx + 6, ey - 8 - i * 1.6); g.stroke(); } }
    // ears
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (const x of [0, 64]) { g.beginPath(); g.ellipse(x, ey + 2, 2, 4, 0, 0, 7); g.fill(); }
  });
}

// ---------- sky ----------
export function makeSky() {
  const u = {
    uTop: { value: new THREE.Color(0x0b0a24) }, uHor: { value: new THREE.Color(0x3a2a5a) },
    uStars: { value: 1 }, uTime: { value: 0 }, uCloud: { value: new THREE.Color(0x2a2448) }, uMoon: { value: new THREE.Vector3(-0.4, 0.5, -0.75).normalize() },
    uSun: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop, uHor, uCloud, uMoon; uniform float uStars, uTime, uSun; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=n(p)*a; p*=2.03; a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 col = mix(uHor, uTop, pow(y, 0.55));
        // stars
        vec2 sp = d.xz / (d.y + 1.2) * 240.0;
        float st = step(0.9965, h(floor(sp))) * smoothstep(0.05, 0.3, d.y);
        st *= 0.6 + 0.4 * sin(uTime * 3.0 + h(floor(sp) + 3.0) * 30.0);
        col += vec3(st) * uStars;
        // moon
        float md = dot(d, uMoon);
        col += vec3(0.9,0.88,1.0) * smoothstep(0.9993, 0.9996, md) * uStars;
        col += vec3(0.35,0.3,0.55) * pow(max(md,0.0), 300.0) * uStars;
        // clouds
        vec2 cp = d.xz / (d.y + 0.15) * 1.6 + vec2(uTime * 0.01, 0.0);
        float c = smoothstep(0.45, 0.85, fbm(cp)) * smoothstep(0.0, 0.25, d.y);
        col = mix(col, uCloud, c * 0.8);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 12), m);
  mesh.renderOrder = 1000; mesh.frustumCulled = false; // P7: draw after the world so the fbm sky only runs where nothing covers it (depth test on, write off)
  return { mesh, u };
}

// ---------- post pipeline ----------
export function makePost(renderer) {
  const opts = { type: THREE.HalfFloatType, depthBuffer: true };
  const rt = new THREE.WebGLRenderTarget(4, 4, opts);
  const bA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const bB = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const sc = new THREE.Scene(); sc.add(quad);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, px: { value: new THREE.Vector2() } }, vertexShader: vs,
    fragmentShader: `uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
      void main(){ vec3 c = vec3(0.0);
        for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++) c += texture2D(t, vUv + vec2(i,j)*px*1.5).rgb;
        c /= 9.0; float l = dot(c, vec3(0.299,0.587,0.114));
        gl_FragColor = vec4(c * smoothstep(0.62, 1.4, l), 1.0); }`,
  });
  const blur = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs,
    fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb * 0.2;
        c += (texture2D(t, vUv + dir*1.4).rgb + texture2D(t, vUv - dir*1.4).rgb) * 0.18;
        c += (texture2D(t, vUv + dir*3.3).rgb + texture2D(t, vUv - dir*3.3).rgb) * 0.13;
        c += (texture2D(t, vUv + dir*5.4).rgb + texture2D(t, vUv - dir*5.4).rgb) * 0.09;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const comp = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, b: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2() }, night: { value: 1 }, hurt: { value: 0 } }, vertexShader: vs,
    fragmentShader: `uniform sampler2D t, b; uniform float time, night, hurt; uniform vec2 res; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time*7.0) * 43758.5453); }
      void main(){
        vec2 uv = vUv;
        // faint chromatic offset at the edges, like a cheap composite cable
        vec2 o = (uv - 0.5) * 0.0025;
        vec3 c = vec3(texture2D(t, uv + o).r, texture2D(t, uv).g, texture2D(t, uv - o).b);
        c += texture2D(b, uv).rgb * (0.9 + night * 0.6);
        // tone + grade: soft shoulder, cool shadows, warm highlights
        c = c / (1.0 + c * 0.35);
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(vec3(l), c, 1.08);
        c += vec3(0.012, 0.0, 0.03) * (1.0 - l) * (0.5 + night);
        c = pow(max(c, 0.0), vec3(1.0/2.2));
        // vignette, interlace, grain
        float v = smoothstep(1.05, 0.35, length((uv - 0.5) * vec2(1.1, 1.0)));
        c *= mix(0.62, 1.0, v);
        c *= 0.97 + 0.03 * mod(floor(uv.y * res.y), 2.0);
        c += (h(uv * res) - 0.5) * 0.035;
        c = mix(c, vec3(0.6,0.0,0.0), hurt * 0.35 * (1.0 - v));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  let W = 4, H = 4;
  return {
    rt,
    comp,
    setSize(w, h) {
      W = w; H = h; rt.setSize(w, h);
      bA.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2)); bB.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
      comp.uniforms.res.value.set(w, h);
    },
    render(scene, camera, t) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      quad.material = bright; bright.uniforms.t.value = rt.texture; bright.uniforms.px.value.set(1 / W, 1 / H);
      renderer.setRenderTarget(bA); renderer.render(sc, cam);
      quad.material = blur;
      for (let i = 0; i < 2; i++) {
        blur.uniforms.t.value = bA.texture; blur.uniforms.dir.value.set(1 / (W >> 2), 0); renderer.setRenderTarget(bB); renderer.render(sc, cam);
        blur.uniforms.t.value = bB.texture; blur.uniforms.dir.value.set(0, 1 / (H >> 2)); renderer.setRenderTarget(bA); renderer.render(sc, cam);
      }
      quad.material = comp; comp.uniforms.t.value = rt.texture; comp.uniforms.b.value = bA.texture; comp.uniforms.time.value = t;
      renderer.setRenderTarget(null); renderer.render(sc, cam);
    },
  };
}
