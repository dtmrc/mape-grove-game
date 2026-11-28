// Shared parts for the big multi-room interiors (mansions.js, civic.js). Built on the rooms.js KIT builder, so
// everything still ends up as ONE merged mesh per material with baked vertex light (roombake.js). What this adds:
//   plan()       a floor plan: many rooms inside one shell, inner walls with doorways, per-room floor / wall colour
//   makeAtlas()  one canvas texture per building for every painting, rug, sign, screen and label (one draw call for
//                all of them instead of one material per sign)
//   parts(K)     a furniture library (sofas, beds, kitchens, baths, desks, shelves, plants, lamps ...) placed with a
//                turned local frame; each piece adds its own collider
// Cost rules (diet, 2026-11-28: "a lot of detail without expensive performance"): no meshes of their own, no live
// lights (every lamp is baked), no per-frame work, small parts are plain boxes (12 triangles), only big soft pieces
// get rounded edges.
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
const PI = Math.PI;
const SOFT = new Set(['cloth', 'fabric']);

/** One texture for all the flat art of a building. region(key, w, h, draw) paints a w x h pixel patch once and
 *  returns its UV rectangle. */
export function makeAtlas(THREE, size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#777'; g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  let x = 0, y = 0, row = 0, first = null; const PAD = 4, cache = new Map();
  function region(key, w, h, draw) {
    if (cache.has(key)) return cache.get(key);
    if (x + w > size) { x = 0; y += row + PAD; row = 0; }
    if (y + h > size) { console.warn('[roomparts] atlas full at', key); return first; }
    g.save(); g.translate(x, y); g.beginPath(); g.rect(-1, -1, w + 2, h + 2); g.clip(); draw(g, w, h); g.restore();
    const r = { u0: (x + 0.5) / size, u1: (x + w - 0.5) / size, v0: 1 - (y + h - 0.5) / size, v1: 1 - (y + 0.5) / size };
    x += w + PAD; row = Math.max(row, h); cache.set(key, r); first = first || r; tex.needsUpdate = true;
    return r;
  }
  /** lines of text on a plate */
  function label(key, lines, bg, fg, w = 128, h = 48, o = {}) {
    return region('L:' + key, w, h, (q) => {
      q.fillStyle = bg; q.fillRect(-1, -1, w + 2, h + 2);
      if (o.border) { q.strokeStyle = o.border; q.lineWidth = 3; q.strokeRect(2, 2, w - 4, h - 4); }
      const n = lines.length, lh = Math.min(h / (n + 0.35), o.size || 99);
      q.fillStyle = fg; q.textAlign = 'center'; q.textBaseline = 'middle';
      lines.forEach((t, i) => { q.font = `${o.weight || 'bold'} ${Math.round(lh * (i && o.small ? 0.6 : 0.8))}px ${o.font || 'Impact, "Arial Black", sans-serif'}`; q.fillText(t, w / 2, h / 2 - (n - 1) * lh / 2 + i * lh + 1, w - 6); });
    });
  }
  return { tex, region, label, used: () => ({ y: y + row, size }) };
}

/** Turned local frame over a KIT builder: local +z is the piece's front. Defaults: no fake AO, plain boxes. */
export function placer(B, cols, x, z, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const w = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const D = { ao: false, round: false };
  return {
    w, ry, x, z,
    box(k, col, bw, bh, bd, lx, y, lz, lry = 0, o) { const [px, pz] = w(lx, lz); B.box(k, col, bw, bh, bd, px, y, pz, ry + lry, o ? { ...D, ...o } : D); },
    /** rounded / chamfered box (soft cushions, big furniture) */
    rbox(k, col, bw, bh, bd, lx, y, lz, lry = 0, o) {   // one bevel facet (108 triangles; the KIT's soft boxes are 300)
      const [px, pz] = w(lx, lz), m = Math.min(bw, bh, bd), rr = o && typeof o.round === 'number' ? o.round : SOFT.has(k) ? Math.min(0.07, m * 0.3) : Math.min(0.022, m * 0.14);
      if (m < 0.1) return B.box(k, col, bw, bh, bd, px, y, pz, ry + lry, { ...D, ...(o || {}) });
      B.add(new RoundedBoxGeometry(bw, bh, bd, 1, rr), k, col, px, y, pz, ry + lry, { ao: false, ...(o || {}) });
    },
    cyl(k, col, rt, rb, h, lx, y, lz, seg = 8, o = {}) { const [px, pz] = w(lx, lz); B.cyl(k, col, rt, rb, h, px, y, pz, seg, { ao: false, ...o, ry: ry + (o.ry || 0) }); },
    sph(k, col, r, lx, y, lz, o = {}) { const [px, pz] = w(lx, lz); B.sph(k, col, r, px, y, pz, { ao: false, ws: 6, hs: 4, ...o }); },
    quad(k, col, qw, qh, lx, y, lz, lry = 0, o) { const [px, pz] = w(lx, lz); B.quad(k, col, qw, qh, px, y, pz, ry + lry, { ao: false, tint: false, ...(o || {}) }); },
    flat(k, col, fw, fd, lx, y, lz, lry = 0, o) { const [px, pz] = w(lx, lz); B.flat(k, col, fw, fd, px, y, pz, ry + lry, { ao: false, tint: false, ...(o || {}) }); },
    add(geo, k, col, lx, y, lz, lry = 0, o) { const [px, pz] = w(lx, lz); B.add(geo, k, col, px, y, pz, ry + lry, { ao: false, ...(o || {}) }); },
    col(lx, lz, cw, cd, h, o) { const [px, pz] = w(lx, lz); cols.push({ kind: 'box', cx: px, cz: pz, w: cw, d: cd, rot: ry, h, ...(o || {}) }); },
  };
}

/**
 * Floor plan. o = { w, d, h, wallKey, rooms: [{ x0, x1, z0, z1, floor, fcol, ftile, wall, ceil, ceilKey, h, wains: { c, y }, base }],
 *   walls: [{ x | z: at, from, to, doors: [{ at, w, h }], cap: [bool, bool] }], doors: [{ x, w, h }] (front wall, z = +d/2),
 *   base, crown, trim, wallTile, WT }
 * Room rectangles run to the wall centre lines. Each room paints its own side of every wall, so two rooms sharing a
 * wall can have different colours. A door with h >= the room height is an open archway. Returns { cols, doors }.
 */
export function plan(B, THREE, o) {
  const { w, d, h, rooms, walls = [], wallKey = 'pwall', WT = 0.2, base = 0xf4f0e8, crown = 0xf6f2ea, trim = 0xf2eee6, wallTile = 2 } = o;
  const hw = w / 2, hd = d / 2, cols = [], front = o.doors || [];
  const Q = { ao: false, tint: false };
  for (const R of rooms) {
    const H = R.h ?? h, rw = R.x1 - R.x0, rd = R.z1 - R.z0, mx = (R.x0 + R.x1) / 2, mz = (R.z0 + R.z1) / 2, ft = R.ftile ?? 2;
    B.flat(R.floor || 'plain', R.fcol ?? 0xffffff, rw, rd, mx, 0, mz, 0, { ...Q, us: rw / ft, vs: rd / ft });
    B.flat(R.ceilKey || 'plain', R.ceil ?? 0xf4f1ea, rw, rd, mx, H, mz, 0, { ...Q, down: true, us: rw / 2, vs: rd / 2 });
    // side: [axis, c, a, b, ry, nx, nz]  (normal points into the room)
    const sides = [['z', R.z0, R.x0, R.x1, 0, 0, 1], ['z', R.z1, R.x0, R.x1, PI, 0, -1], ['x', R.x0, R.z0, R.z1, PI / 2, 1, 0], ['x', R.x1, R.z0, R.z1, -PI / 2, -1, 0]];
    for (const [ax, c, a, b, ry, nx, nz] of sides) {
      const outer = Math.abs(Math.abs(c) - (ax === 'z' ? hd : hw)) < 0.01;
      const cover = [], opens = [];
      if (outer) { cover.push([a, b]); if (ax === 'z' && c > 0) for (const D of front) opens.push({ at: D.x, w: D.w, h: D.h ?? 2.25 }); }
      else for (const W of walls) {
        if (W[ax] === undefined || Math.abs(W[ax] - c) > 0.01) continue;
        const lo = Math.max(a, W.from), hi = Math.min(b, W.to);
        if (hi - lo > 0.01) { cover.push([lo, hi]); for (const D of W.doors || []) opens.push({ at: D.at, w: D.w, h: D.h ?? 2.25 }); }
      }
      const off = outer ? 0 : WT / 2;
      const face = (s, e, y0, y1, solid) => {
        const len = e - s, m = (s + e) / 2; if (len < 0.01 || y1 - y0 < 0.01) return;
        const px = ax === 'z' ? m : c + nx * off, pz = ax === 'z' ? c + nz * off : m;
        B.quad(wallKey, R.wall ?? 0xffffff, len, y1 - y0, px, (y0 + y1) / 2, pz, ry, { ...Q, us: len / wallTile, vs: (y1 - y0) / wallTile });
        const strip = (col, hh, y, out = 0.012) => B.quad('plain', col, len, hh, px + nx * out, y, pz + nz * out, ry, Q);
        if (solid) {
          if (R.wains) { strip(R.wains.c, R.wains.y - 0.12, 0.12 + (R.wains.y - 0.12) / 2, 0.008); strip(R.wains.rail ?? base, 0.07, R.wains.y, 0.014); }
          strip(R.base ?? base, 0.12, 0.06);
        }
        if (y1 >= H - 0.01 && crown !== null) strip(crown, 0.09, H - 0.045);
      };
      for (const [lo, hi] of cover) {
        const os = opens.filter((D) => D.at + D.w / 2 > lo && D.at - D.w / 2 < hi).sort((p, q) => p.at - q.at);
        let s = lo;
        for (const D of os) {
          const d0 = Math.max(lo, D.at - D.w / 2), d1 = Math.min(hi, D.at + D.w / 2);
          face(s, d0, 0, H, true);
          if (D.h < H - 0.05) face(d0, d1, D.h, H, false);
          s = d1;
        }
        face(s, hi, 0, H, true);
      }
    }
  }
  // inner walls: colliders, door casings, free ends
  const doors = [];
  for (const W of walls) {
    const ax = W.x !== undefined ? 'x' : 'z', c = W[ax];
    const box = (m, len, hh, y, t, col, key = 'plain') => { if (ax === 'x') B.box(key, col, t, hh, len, c, y, m, 0, { ao: false, round: false }); else B.box(key, col, len, hh, t, m, y, c, 0, { ao: false, round: false }); };
    const os = (W.doors || []).slice().sort((p, q) => p.at - q.at);
    let s = W.from;
    const solid = (a, b) => { if (b - a > 0.02) cols.push(ax === 'x' ? { kind: 'box', cx: c, cz: (a + b) / 2, w: WT, d: b - a, rot: 0, h } : { kind: 'box', cx: (a + b) / 2, cz: c, w: b - a, d: WT, rot: 0, h }); };
    for (const D of os) {
      const dh = D.h ?? 2.25, open = dh >= h - 0.05, tc = W.trim ?? trim;
      solid(s, D.at - D.w / 2); s = D.at + D.w / 2;
      for (const e of [-1, 1]) box(D.at + e * (D.w / 2 + 0.02), 0.09, open ? h : dh + 0.05, (open ? h : dh + 0.05) / 2, WT + 0.07, tc);
      if (!open) box(D.at, D.w + 0.14, 0.1, dh + 0.05, WT + 0.07, tc);
      doors.push(ax === 'x' ? { x: c, z: D.at, ax, w: D.w, h: dh } : { x: D.at, z: c, ax, w: D.w, h: dh });
    }
    solid(s, W.to);
    (W.cap || []).forEach((on, i) => { if (on) box(i ? W.to : W.from, 0.04, h, h / 2, WT + 0.02, W.trim ?? trim); });
  }
  // shell colliders (front wall split round its doors)
  const t = 0.3;
  cols.push({ kind: 'box', cx: 0, cz: -hd - t / 2, w: w + 2 * t, d: t, rot: 0, h }, { kind: 'box', cx: -hw - t / 2, cz: 0, w: t, d: d + 2 * t, rot: 0, h }, { kind: 'box', cx: hw + t / 2, cz: 0, w: t, d: d + 2 * t, rot: 0, h });
  let s = -hw;
  for (const D of front.slice().sort((p, q) => p.x - q.x)) { const e = D.x - D.w / 2; if (e - s > 0.02) cols.push({ kind: 'box', cx: (s + e) / 2, cz: hd + t / 2, w: e - s, d: t, rot: 0, h }); s = D.x + D.w / 2; }
  if (hw - s > 0.02) cols.push({ kind: 'box', cx: (s + hw) / 2, cz: hd + t / 2, w: hw - s, d: t, rot: 0, h });
  return { cols, doors };
}

/** Each lamp only lights its own room and `fade` metres beyond (roombake.js light zones): a few lights per vertex
 *  instead of every lamp in the building. */
export function zoneLights(lights, rooms, fade = 3) {
  for (const L of lights) { const R = rooms.find((q) => L.x >= q.x0 && L.x <= q.x1 && L.z >= q.z0 && L.z <= q.z1); if (R && !L.zone) L.zone = { x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1, fade }; }
}

/** Furniture and fixtures. K = { B, THREE, cols, A (atlas), lights, rnd, pick }. Every part: (x, z, ry, options). */
export function parts(K) {
  const { B, THREE, cols, A, lights, rnd, pick } = K;
  const at = (x, z, ry = 0) => placer(B, cols, x, z, ry);
  const P = { at };
  const uvPlane = (r, w, h) => { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + (r.u1 - r.u0) * uv.getX(i), r.v0 + (r.v1 - r.v0) * uv.getY(i)); return g; };
  /** flat art from the atlas on a wall (faces local +z) / on the floor; key 'atlas' is lit, 'aglow' glows */
  P.decal = (F, r, w, h, lx, y, lz, lry = 0, key = 'atlas') => F.add(uvPlane(r, w, h), key, 0xffffff, lx, y, lz, lry, { tint: false });
  P.decalFlat = (F, r, w, d, lx, y, lz, lry = 0, key = 'atlas') => F.add(uvPlane(r, w, d).rotateX(-PI / 2), key, 0xffffff, lx, y, lz, lry, { tint: false });
  const light = (F, lx, y, lz, c, i, o) => { const [x, z] = F.w(lx, lz); lights.push({ x, y, z, c, i, ...(o || {}) }); };
  P.light = (x, y, z, c = 0xfff0d8, i = 0.8, o) => lights.push({ x, y, z, c, i, ...(o || {}) });

  // ---------------- art ----------------
  const PAL = [['#2a4a6a', '#e8c070', '#c05a3a'], ['#3a5a3a', '#e8e0c8', '#8a6a3a'], ['#6a2a3a', '#e8b890', '#2a2a3a'], ['#284858', '#f0e8d8', '#d8a040'], ['#1a1a22', '#c8ccd4', '#b02030']];
  P.paintTex = (key, kind, w = 96, h = 72) => A.region('P:' + key, w, h, (g) => {
    const p = pick(PAL);
    if (kind === 'land') {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f0c890'); gr.addColorStop(0.55, '#e8e0d0'); g.fillStyle = gr; g.fillRect(-1, -1, w + 2, h + 2);
      g.fillStyle = '#f8f0c0'; g.beginPath(); g.arc(w * (0.2 + rnd() * 0.6), h * 0.32, h * 0.09, 0, 7); g.fill();
      for (let k = 0; k < 3; k++) { g.fillStyle = ['#7a8a9a', '#5a7a5a', '#3a5a3a'][k]; g.beginPath(); g.moveTo(-1, h + 1); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.5 + k * 0.14) - Math.sin(x * 0.06 + k * 2 + rnd()) * h * 0.08); g.lineTo(w + 1, h + 1); g.fill(); }
    } else if (kind === 'abstract') {
      g.fillStyle = p[1]; g.fillRect(-1, -1, w + 2, h + 2);
      for (let k = 0; k < 7; k++) { g.fillStyle = pick(p); g.globalAlpha = 0.85; if (rnd() < 0.5) g.fillRect(rnd() * w, rnd() * h, 8 + rnd() * w * 0.5, 6 + rnd() * h * 0.4); else { g.beginPath(); g.arc(rnd() * w, rnd() * h, 5 + rnd() * h * 0.3, 0, 7); g.fill(); } }
      g.globalAlpha = 1; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(rnd() * w, 0); g.lineTo(rnd() * w, h); g.stroke();
    } else if (kind === 'horse') {
      g.fillStyle = '#c8b890'; g.fillRect(-1, -1, w + 2, h + 2); g.fillStyle = '#7a9a6a'; g.fillRect(-1, h * 0.7, w + 2, h);
      g.fillStyle = '#5a3a22'; g.fillRect(w * 0.3, h * 0.38, w * 0.4, h * 0.2); g.fillRect(w * 0.62, h * 0.2, w * 0.1, h * 0.24); g.fillRect(w * 0.66, h * 0.16, w * 0.14, h * 0.1);
      for (const x of [0.32, 0.4, 0.58, 0.66]) g.fillRect(w * x, h * 0.55, w * 0.035, h * 0.22); g.fillStyle = '#2a1a10'; g.fillRect(w * 0.27, h * 0.38, w * 0.04, h * 0.2);
    } else if (kind === 'family') {
      g.fillStyle = '#6a7a8a'; g.fillRect(-1, -1, w + 2, h + 2);
      [[0.3, 0.42, '#3a3a4a', '#e8b890', 1], [0.55, 0.46, '#a03050', '#e8c0a0', 0.9], [0.75, 0.62, '#3a6a9a', '#e8b890', 0.6]].forEach(([x, y, c1, c2, s]) => { g.fillStyle = c1; g.fillRect(w * x - 9 * s, h * y, 18 * s, h); g.fillStyle = c2; g.beginPath(); g.arc(w * x, h * y - 6 * s, 7 * s, 0, 7); g.fill(); });
    } else if (kind === 'map') {
      g.fillStyle = '#e8dcc0'; g.fillRect(-1, -1, w + 2, h + 2); g.strokeStyle = '#8a7a5a'; g.lineWidth = 1;
      for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(rnd() * w, rnd() * h); g.lineTo(rnd() * w, rnd() * h); g.stroke(); }
      g.fillStyle = '#8ab0c8'; g.beginPath(); g.ellipse(w * 0.7, h * 0.65, w * 0.14, h * 0.12, 0.4, 0, 7); g.fill(); g.fillStyle = '#7a9a6a'; g.fillRect(w * 0.1, h * 0.15, w * 0.25, h * 0.3);
    } else {   // portrait
      g.fillStyle = p[0]; g.fillRect(-1, -1, w + 2, h + 2);
      g.fillStyle = '#2a2a32'; g.beginPath(); g.ellipse(w / 2, h * 1.0, w * 0.36, h * 0.42, 0, 0, 7); g.fill();
      g.fillStyle = '#e8b890'; g.beginPath(); g.ellipse(w / 2, h * 0.42, w * 0.17, h * 0.2, 0, 0, 7); g.fill();
      g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(w / 2, h * 0.28, w * 0.18, h * 0.1, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.fillRect(w / 2 - 3, h * 0.62, 6, h * 0.2);
    }
  });
  /** framed painting on a wall; (x, z) on the wall, facing ry */
  P.picture = (x, y, z, ry, w, h, tex, frame = 0x4a3222) => {
    const F = at(x, z, ry);
    F.box('wood', frame, w + 0.1, h + 0.1, 0.04, 0, y, 0.02); P.decal(F, tex, w, h, 0, y, 0.045);
  };
  P.rug = (x, z, ry, w, d, tex) => P.decalFlat(at(x, z, ry), tex, w, d, 0, 0.012, 0);
  P.rugTex = (key, c1, c2, c3, w = 96, h = 64) => A.region('R:' + key, w, h, (g) => {
    g.fillStyle = c1; g.fillRect(-1, -1, w + 2, h + 2); g.strokeStyle = c2; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); g.lineWidth = 1; g.strokeRect(9, 9, w - 18, h - 18);
    g.fillStyle = c3; for (let y = 16; y < h - 12; y += 10) for (let x = 16 + ((y / 10) % 2) * 5; x < w - 12; x += 10) { g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.fill(); }
    g.fillStyle = c2; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.14, h * 0.2, 0, 0, 7); g.fill(); g.fillStyle = c1; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.08, h * 0.12, 0, 0, 7); g.fill();
  });

  // ---------------- windows, doors, lights ----------------
  /** window on a wall: pane (day / night by the clock), casing, sill, optional curtains */
  P.window = (x, y, z, ry, w, h, o = {}) => {
    const F = at(x, z, ry), tc = o.trim ?? 0xf2eee6;
    F.quad('night', 0xffffff, w, h, 0, y, 0.015);
    for (const e of [-1, 1]) F.box('plain', tc, 0.07, h + 0.14, 0.05, e * (w / 2 + 0.035), y, 0.03);
    F.box('plain', tc, w + 0.2, 0.07, 0.06, 0, y + h / 2 + 0.035, 0.03); F.box('plain', tc, w + 0.24, 0.05, 0.12, 0, y - h / 2 - 0.025, 0.06);
    const nm = o.mull ?? Math.max(1, Math.round(w / 0.8)) - 1;
    for (let k = 1; k <= nm; k++) F.box('plain', tc, 0.03, h, 0.03, -w / 2 + k * w / (nm + 1), y, 0.025);
    if (o.bar !== false) F.box('plain', tc, w, 0.03, 0.03, 0, y + h * 0.18, 0.025);
    if (o.curtain) {
      const cc = o.curtain, top = y + h / 2 + 0.16, len = top - (o.floor ? 0.05 : y - h / 2 - 0.15);
      F.cyl('shiny', o.rod ?? 0x3a3a3a, 0.014, 0.014, w + 0.7, 0, top + 0.03, 0.09, 5, { rz: PI / 2 });
      for (const e of [-1, 1]) for (let f = 0; f < 3; f++) F.box('cloth', cc, 0.13, len, 0.06, e * (w / 2 + 0.26 - f * 0.11), top - len / 2, 0.08 + (f % 2) * 0.03, e * (f % 2 ? 0.3 : -0.3));
    }
  };
  /** an open door leaf beside a doorway */
  P.leaf = (x, z, ry, w = 0.9, h = 2.2, col = 0xf2eee6) => { const F = at(x, z, ry); F.box('wood', col, w, h, 0.045, w / 2, h / 2, 0); F.sph('shiny', 0xc8a860, 0.035, w - 0.09, 1.0, 0.05); F.sph('shiny', 0xc8a860, 0.035, w - 0.09, 1.0, -0.05); };
  /** recessed can light: glowing disc in the ceiling + a baked light */
  P.can = (x, z, H, i = 0.55, c = 0xfff0dc) => { B.cyl('glow', 0xfff6e0, 0.09, 0.09, 0.012, x, H - 0.008, z, 8, { ao: false, tint: false }); B.cyl('plain', 0xd8d4cc, 0.12, 0.12, 0.01, x, H - 0.004, z, 8, { ao: false }); lights.push({ x, y: H - 0.25, z, c, i, halo: false }); };
  P.troffer = (x, z, H, len = 1.2, ry = 0, i = 0.8, c = 0xf4f8ff) => { const F = at(x, z, ry); F.box('plain', 0xd8d8d8, len + 0.08, 0.03, 0.66, 0, H - 0.015, 0); F.box('glow', c, len, 0.012, 0.58, 0, H - 0.036, 0, 0, { tint: false }); F.box('plain', 0xc8c8c8, len, 0.014, 0.02, 0, H - 0.04, 0); lights.push({ x, y: H - 0.3, z, c, i, halo: false }); };
  P.pendant = (x, z, H, y, o = {}) => {
    const c = o.c ?? 0xfff0d8, shade = o.shade ?? 0x2a2a2a;
    B.cyl('plain', 0x222222, 0.006, 0.006, H - y - 0.1, x, (H + y + 0.1) / 2, z, 4, { ao: false });
    if (o.globe) B.sph('glow', c, o.r ?? 0.13, x, y, z, { ao: false, tint: false, ws: 8, hs: 6 });
    else { B.cyl('metal', shade, 0.05, o.r ?? 0.18, 0.2, x, y + 0.08, z, 10, { ao: false }); B.sph('glow', c, 0.06, x, y, z, { ao: false, tint: false }); }
    lights.push({ x, y: y - 0.05, z, c, i: o.i ?? 0.6 });
  };
  P.chandelier = (x, z, H, y, o = {}) => {
    const r = o.r ?? 0.55, gold = o.metal ?? 0xc8a860, n = o.n ?? 8, tiers = o.tiers ?? 2;
    B.cyl('shiny', gold, 0.012, 0.012, H - y, x, (H + y) / 2, z, 5, { ao: false }); B.cyl('shiny', gold, 0.09, 0.05, 0.08, x, H - 0.04, z, 8, { ao: false });
    for (let t = 0; t < tiers; t++) {
      const rr = r * (1 - t * 0.38), yy = y + t * 0.32;
      B.add(new THREE.TorusGeometry(rr, 0.018, 4, 14).rotateX(PI / 2), 'shiny', gold, x, yy, z, 0, { ao: false, tint: false });
      const m = Math.max(4, n - t * 3);
      for (let k = 0; k < m; k++) {
        const a = k / m * PI * 2 + t, px = x + Math.sin(a) * rr, pz = z + Math.cos(a) * rr;
        B.cyl('plain', 0xf4f0e0, 0.012, 0.012, 0.1, px, yy + 0.07, pz, 5, { ao: false }); B.sph('glow', 0xfff2d0, 0.032, px, yy + 0.15, pz, { ao: false, tint: false, ws: 5, hs: 4 });
        if (o.crystal !== false) B.box('glass', 0xffffff, 0.025, 0.11, 0.025, px, yy - 0.09, pz, a, { ao: false, round: false });
      }
      for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + 0.4; B.box('shiny', gold, 0.012, 0.012, rr, x + Math.sin(a) * rr / 2, yy + 0.01, z + Math.cos(a) * rr / 2, a, { ao: false, round: false }); }
    }
    B.sph('glass', 0xffffff, 0.07, x, y - 0.16, z, { ao: false, ws: 6, hs: 5 });
    lights.push({ x, y: y - 0.1, z, c: o.c ?? 0xffecc8, i: o.i ?? 1.1, r: 0.4 });
  };
  P.floorLamp = (x, z, o = {}) => { B.cyl('shiny', o.metal ?? 0x3a3a3a, 0.15, 0.17, 0.03, x, 0.015, z, 10, { ao: false }); B.cyl('shiny', o.metal ?? 0x3a3a3a, 0.015, 0.015, 1.5, x, 0.78, z, 5, { ao: false }); B.cyl('glow', o.shade ?? 0xfff0d0, 0.14, 0.2, 0.28, x, 1.6, z, 10, { ao: false, tint: false }); lights.push({ x, y: 1.55, z, c: 0xffe8c0, i: o.i ?? 0.45, halo: false }); cols.push({ kind: 'box', cx: x, cz: z, w: 0.3, d: 0.3, rot: 0, h: 1.7 }); };
  P.tableLamp = (x, y, z, o = {}) => { B.cyl('shiny', o.base ?? 0xc8a860, 0.05, 0.08, 0.26, x, y + 0.13, z, 8, { ao: false }); B.cyl('glow', o.shade ?? 0xfff0d0, 0.09, 0.15, 0.2, x, y + 0.36, z, 10, { ao: false, tint: false }); if (o.i !== 0) lights.push({ x, y: y + 0.4, z, c: 0xffe4b8, i: o.i ?? 0.3, halo: false }); };
  P.sconce = (x, y, z, ry, o = {}) => { const F = at(x, z, ry); F.box('shiny', o.metal ?? 0xc8a860, 0.08, 0.2, 0.04, 0, y, 0.02); F.cyl('glow', 0xfff0d0, 0.05, 0.07, 0.16, 0, y + 0.06, 0.1, 8, { tint: false }); if (o.i !== 0) light(F, 0, y + 0.1, 0.25, 0xffe4b8, o.i ?? 0.3, { halo: false }); };

  // ---------------- greenery, small things ----------------
  P.plant = (x, z, o = {}) => {
    const s = o.s ?? 1, pot = o.pot ?? 0xe8e4dc, leaf = o.leaf ?? 0x3a7a3a;
    B.cyl('plain', pot, 0.2 * s, 0.15 * s, 0.38 * s, x, 0.19 * s, z, 8, { ao: false }); B.cyl('plain', 0x4a3a2a, 0.18 * s, 0.18 * s, 0.02, x, 0.38 * s, z, 8, { ao: false });
    if (o.kind === 'palm') { B.cyl('plain', 0x6a5238, 0.03 * s, 0.045 * s, 1.0 * s, x, 0.85 * s, z, 5, { ao: false }); for (let k = 0; k < 7; k++) { const a = k / 7 * PI * 2; B.box('plain', k % 2 ? leaf : 0x4a8a4a, 0.14 * s, 0.02, 0.7 * s, x + Math.sin(a) * 0.3 * s, 1.36 * s - (k % 2) * 0.06, z + Math.cos(a) * 0.3 * s, a, { ao: false, round: false, rx: 0.5 }); } }
    else if (o.kind === 'fig') { B.cyl('plain', 0x5a4230, 0.02 * s, 0.03 * s, 0.9 * s, x, 0.8 * s, z, 5, { ao: false }); for (let k = 0; k < 9; k++) B.sph('plain', k % 3 ? leaf : 0x4a8a4a, (0.16 + rnd() * 0.08) * s, x + (rnd() - 0.5) * 0.4 * s, (1.05 + rnd() * 0.6) * s, z + (rnd() - 0.5) * 0.4 * s, { ao: false, ws: 5, hs: 4, s: [1, 0.7, 1] }); }
    else for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + rnd(); B.box('plain', k % 2 ? leaf : 0x4a8a4a, 0.09 * s, 0.5 * s + rnd() * 0.25 * s, 0.02, x + Math.sin(a) * 0.08 * s, 0.6 * s, z + Math.cos(a) * 0.08 * s, a, { ao: false, round: false, rx: 0.25 + rnd() * 0.2 }); }
    cols.push({ kind: 'box', cx: x, cz: z, w: 0.36 * s, d: 0.36 * s, rot: 0, h: 1.2 * s });
  };
  P.vase = (x, y, z, col = 0x3a6a9a, flowers = 0xe85a7a) => { B.cyl('shiny', col, 0.05, 0.08, 0.26, x, y + 0.13, z, 8, { ao: false }); if (flowers !== null) for (let k = 0; k < 6; k++) { const a = k * 1.1; B.cyl('plain', 0x3a7a3a, 0.005, 0.005, 0.3, x + Math.sin(a) * 0.04, y + 0.38, z + Math.cos(a) * 0.04, 3, { ao: false, rx: Math.cos(a) * 0.25, rz: -Math.sin(a) * 0.25 }); B.sph('plain', k % 2 ? flowers : 0xf4f0e0, 0.045, x + Math.sin(a) * 0.09, y + 0.54 - (k % 3) * 0.03, z + Math.cos(a) * 0.09, { ao: false, ws: 5, hs: 4 }); } };
  const bookGeo = (t, h, d) => {   // a book on a shelf only ever shows its spine, its top and a bit of one side
    const x = t / 2, z = d / 2, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-x, 0, z, x, 0, z, x, h, z, -x, 0, z, x, h, z, -x, h, z, -x, h, z, x, h, z, x, h, -z, -x, h, z, x, h, -z, -x, h, -z, x, 0, z, x, 0, -z, x, h, -z, x, 0, z, x, h, -z, x, h, z]), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]), 3));
    return g;
  };
  P.books = (F, lx, y, lz, len, o = {}) => { let p = -len / 2; while (p < len / 2 - 0.03) { const t = 0.03 + rnd() * 0.04, bh = (o.h ?? 0.24) * (0.75 + rnd() * 0.25); if (rnd() < 0.9) F.add(bookGeo(t, bh, o.d ?? 0.16), 'plain', pick(o.cols ?? [0x7a2a2a, 0x2a4a6a, 0x3a5a3a, 0xc8b890, 0x2a2a2a, 0x8a6a3a, 0xa04a2a, 0xe8e0d0]), lx + p + t / 2, y, lz, 0, { tint: false }); p += t + 0.003; } };
  P.person = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), skin = o.skin ?? 0xe8b890, top = o.top ?? 0x3a6a9a, sit = o.sit ? 0.38 : 0, y0 = -sit;
    for (const e of [-1, 1]) { if (sit) F.box('plain', o.legs ?? 0x2a2a3a, 0.16, 0.16, 0.5, e * 0.11, 0.52, 0.2); F.box('plain', o.legs ?? 0x2a2a3a, 0.16, sit ? 0.46 : 0.8, 0.18, e * 0.11, sit ? 0.23 : 0.4, sit ? 0.42 : 0); F.box('plain', o.shoes ?? 0x2a2018, 0.17, 0.08, 0.26, e * 0.11, 0.04, (sit ? 0.42 : 0) + 0.04); }
    F.rbox('cloth', top, 0.48, 0.62, 0.28, 0, 1.12 + y0, 0, 0, { round: 0.06 });
    if (o.coat) F.box('plain', o.coat, 0.5, 0.86, 0.3, 0, 1.0 + y0, -0.005);
    if (o.apron) F.box('plain', o.apron, 0.42, 0.7, 0.02, 0, 1.0 + y0, 0.15);
    for (const e of [-1, 1]) { F.box('cloth', o.coat ?? top, 0.12, 0.5, 0.14, e * 0.31, 1.15 + y0, 0.02); F.box('plain', skin, 0.1, 0.12, 0.12, e * 0.31, 0.84 + y0, 0.04); }
    F.box('plain', skin, 0.1, 0.08, 0.1, 0, 1.47 + y0, 0); F.rbox('plain', skin, 0.3, 0.32, 0.28, 0, 1.66 + y0, 0, 0, { round: 0.05 });
    F.box('plain', o.hair ?? 0x4a3222, 0.32, 0.1, 0.3, 0, 1.84 + y0, -0.01); F.box('plain', o.hair ?? 0x4a3222, 0.32, 0.22, 0.06, 0, 1.72 + y0, -0.14);
    if (o.cap) { F.box('plain', o.cap, 0.33, 0.08, 0.31, 0, 1.86 + y0, 0); F.box('plain', o.cap, 0.3, 0.03, 0.14, 0, 1.83 + y0, 0.2); }
    if (o.helmet) { F.rbox('plain', o.helmet, 0.36, 0.14, 0.36, 0, 1.88 + y0, 0, 0, { round: 0.05 }); F.box('plain', o.helmet, 0.44, 0.03, 0.5, 0, 1.82 + y0, -0.04); }
    if (o.mask) F.box('plain', o.mask, 0.24, 0.1, 0.02, 0, 1.58 + y0, 0.145);
    for (const e of [-1, 1]) F.box('glow', 0x1a1a1a, 0.05, 0.04, 0.01, e * 0.07, 1.7 + y0, 0.145);
    if (o.stripe) F.box('glow', o.stripe, 0.5, 0.05, 0.3, 0, 0.9 + y0, 0);
    if (o.solid !== false) F.col(0, sit ? 0.15 : 0, 0.55, sit ? 0.7 : 0.4, 1.9 - sit);
  };

  // ---------------- seating ----------------
  P.sofa = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 2.3, col = o.col ?? 0xd8d0c0, dk = o.legs ?? 0x3a2a1a, n = Math.max(1, Math.round((w - 0.4) / 0.75)), cw = (w - 0.44) / n;
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) F.box('wood', dk, 0.06, 0.1, 0.06, ex * (w / 2 - 0.08), 0.05, ez * 0.38);
    F.rbox('cloth', col, w, 0.3, 0.92, 0, 0.25, 0); F.rbox('cloth', col, w, 0.55, 0.22, 0, 0.62, -0.35);
    for (const e of [-1, 1]) F.rbox('cloth', col, 0.22, 0.42, 0.92, e * (w / 2 - 0.11), 0.5, 0);
    for (let k = 0; k < n; k++) { const cx = -w / 2 + 0.22 + cw * (k + 0.5); F.rbox('cloth', col, cw - 0.02, 0.16, 0.66, cx, 0.47, 0.1, 0, { tint: false }); F.rbox('cloth', col, cw - 0.04, 0.4, 0.16, cx, 0.72, -0.2, 0, { rx: -0.12 }); }
    (o.pillows ?? [0xc05a3a, 0x3a6a8a]).forEach((pc, i) => F.rbox('cloth', pc, 0.4, 0.36, 0.14, (i ? 1 : -1) * (w / 2 - 0.45), 0.72, -0.05, (i ? -0.3 : 0.3), { rx: -0.2 }));
    F.col(0, 0, w, 0.92, 0.9, { top: 0.52 });
  };
  P.sectional = (x, z, ry, o = {}) => { const w = o.w ?? 3.2, side = o.side ?? 1, F = at(x, z, ry); P.sofa(x, z, ry, { ...o, w }); const [cx, cz] = F.w(side * (w / 2 - 0.47), 1.25); const G = at(cx, cz, ry), col = o.col ?? 0xd8d0c0; G.rbox('cloth', col, 0.94, 0.3, 1.6, 0, 0.25, 0); G.rbox('cloth', col, 0.9, 0.16, 1.56, 0, 0.47, 0, 0, { tint: false }); G.rbox('cloth', o.throw ?? 0x8a6a4a, 0.7, 0.03, 0.6, 0, 0.56, 0.45, 0.2); G.col(0, 0, 0.94, 1.6, 0.55); };
  P.armchair = (x, z, ry, o = {}) => P.sofa(x, z, ry, { w: 0.98, pillows: o.pillow ? [o.pillow] : [], ...o });
  P.ottoman = (x, z, ry, o = {}) => { const F = at(x, z, ry), w = o.w ?? 0.8, d = o.d ?? 0.6; F.rbox(o.key ?? 'cloth', o.col ?? 0x8a6a4a, w, 0.36, d, 0, 0.24, 0); F.box('wood', 0x3a2a1a, w - 0.1, 0.06, d - 0.1, 0, 0.03, 0); F.col(0, 0, w, d, 0.42); };
  P.chair = (x, z, ry, o = {}) => {   // dining / desk chair, back at local -z
    const F = at(x, z, ry), wood = o.wood ?? 0x4a3222, seat = o.seat ?? 0xe8e0d0;
    for (const ex of [-1, 1]) { F.box('wood', wood, 0.04, 0.44, 0.04, ex * 0.19, 0.22, 0.18); F.box('wood', wood, 0.04, o.tall ? 1.1 : 0.95, 0.04, ex * 0.19, o.tall ? 0.55 : 0.475, -0.19); }
    F.rbox('cloth', seat, 0.46, 0.08, 0.44, 0, 0.47, 0, 0, { round: 0.03 }); F.box(o.uph ? 'cloth' : 'wood', o.uph ? seat : wood, 0.42, 0.42, 0.04, 0, o.tall ? 0.86 : 0.74, -0.2);
    if (o.solid !== false) F.col(0, 0, 0.46, 0.46, 0.95, { top: 0.5 });
  };
  P.stool = (x, z, o = {}) => { B.cyl('shiny', o.metal ?? 0x2a2a2a, 0.02, 0.02, 0.7, x, 0.35, z, 5, { ao: false }); B.cyl('shiny', o.metal ?? 0x2a2a2a, 0.17, 0.19, 0.02, x, 0.01, z, 10, { ao: false }); B.add(new THREE.TorusGeometry(0.13, 0.012, 4, 10).rotateX(PI / 2), 'shiny', o.metal ?? 0x2a2a2a, x, 0.28, z, 0, { ao: false, tint: false }); B.cyl('cloth', o.seat ?? 0x8a5a3a, 0.17, 0.16, 0.08, x, 0.74, z, 10, { ao: false }); cols.push({ kind: 'box', cx: x, cz: z, w: 0.34, d: 0.34, rot: 0, h: 0.78 }); };
  P.recliner = (x, z, ry, o = {}) => {   // home theater / dayroom seat with cup holders
    const F = at(x, z, ry), col = o.col ?? 0x2a2a30;
    F.rbox('cloth', col, 0.86, 0.4, 0.9, 0, 0.26, 0); F.rbox('cloth', col, 0.62, 0.14, 0.62, 0, 0.5, 0.08, 0, { tint: false }); F.rbox('cloth', col, 0.66, 0.78, 0.2, 0, 0.82, -0.36, 0, { rx: -0.22 }); F.rbox('cloth', col, 0.5, 0.2, 0.16, 0, 1.2, -0.44, 0, { rx: -0.22 });
    for (const e of [-1, 1]) { F.rbox('cloth', col, 0.14, 0.3, 0.84, e * 0.38, 0.52, 0); F.cyl('shiny', 0x8a8a90, 0.045, 0.045, 0.02, e * 0.38, 0.675, 0.28, 8); }
    if (o.foot) F.rbox('cloth', col, 0.6, 0.12, 0.5, 0, 0.42, 0.68, 0, { rx: 0.15 });
    F.col(0, 0, 0.9, 0.95, 1.2, { top: 0.55 });
  };

  // ---------------- tables, storage ----------------
  P.table = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 1.2, d = o.d ?? 0.6, h = o.h ?? 0.45, wood = o.wood ?? 0x4a3222, key = o.key ?? 'wood', t = o.t ?? 0.05;
    if (o.round) { B.cyl(key, o.top ?? wood, w / 2, w / 2, t, x, h - t / 2, z, 16, { ao: false }); B.cyl(key, wood, 0.06, 0.09, h - t - 0.04, x, (h - t) / 2 + 0.02, z, 8, { ao: false }); B.cyl(key, wood, w * 0.28, w * 0.3, 0.04, x, 0.02, z, 12, { ao: false }); }
    else { F.box(key, o.top ?? wood, w, t, d, 0, h - t / 2, 0); for (const ex of [-1, 1]) for (const ez of [-1, 1]) F.box(o.legKey ?? key, o.leg ?? wood, o.lt ?? 0.06, h - t, o.lt ?? 0.06, ex * (w / 2 - 0.07), (h - t) / 2, ez * (d / 2 - 0.07)); if (o.shelf) F.box(key, wood, w - 0.16, 0.03, d - 0.16, 0, h * 0.3, 0); }
    if (o.solid !== false) F.col(0, 0, w, o.round ? w : d, h);
    return F;
  };
  /** dining table with chairs all round */
  P.dining = (x, z, ry, o = {}) => {
    const w = o.w ?? 2.6, d = o.d ?? 1.1, n = o.n ?? 3, F = P.table(x, z, ry, { w, d, h: 0.76, t: 0.06, lt: 0.09, ...o });
    for (let k = 0; k < n; k++) for (const e of [-1, 1]) { const [cx, cz] = F.w(-w / 2 + (k + 0.5) * w / n, e * (d / 2 + 0.22)); P.chair(cx, cz, ry + (e > 0 ? PI : 0), { ...(o.chair || {}), solid: false }); }
    if (o.heads !== false) for (const e of [-1, 1]) { const [cx, cz] = F.w(e * (w / 2 + 0.24), 0); P.chair(cx, cz, ry + e * -PI / 2, { ...(o.chair || {}), tall: true, solid: false }); }
    F.col(0, 0, w + (o.heads !== false ? 1.0 : 0), d + 0.9, 0.5, { top: 0.5 });
    if (o.set !== false) for (let k = 0; k < n; k++) for (const e of [-1, 1]) { const lx = -w / 2 + (k + 0.5) * w / n, lz = e * (d / 2 - 0.2); F.cyl('shiny', 0xf4f0e8, 0.13, 0.09, 0.015, lx, 0.77, lz, 10); F.cyl('glass', 0xffffff, 0.035, 0.03, 0.14, lx + 0.2, 0.83, lz - e * 0.08, 6); }
    return F;
  };
  /** bookcase / display shelf against a wall, back at local -z */
  P.bookcase = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 1.6, h = o.h ?? 2.3, d = o.d ?? 0.34, wood = o.wood ?? 0x4a3222, n = o.n ?? 5, bays = Math.max(1, Math.round(w / 0.85));
    F.box('wood', wood, w, h, 0.03, 0, h / 2, -d / 2 + 0.015); F.box('wood', wood, w + 0.06, 0.07, d + 0.04, 0, h - 0.035, 0); F.box('wood', wood, w, 0.1, d, 0, 0.05, 0);
    for (let k = 0; k <= bays; k++) F.box('wood', wood, 0.035, h, d, -w / 2 + k * w / bays, h / 2, 0);
    for (let r = 0; r < n; r++) {
      const y = 0.1 + r * (h - 0.2) / n;
      if (r) F.box('wood', wood, w, 0.03, d - 0.02, 0, y, 0);
      for (let k = 0; k < bays; k++) {
        const bx = -w / 2 + (k + 0.5) * w / bays, bw = w / bays - 0.08, kind = o.fill === 'books' ? 0 : rnd();
        if (kind < 0.62) P.books(F, bx, y + 0.015, 0.02, bw * (0.6 + rnd() * 0.4), { h: Math.min(0.26, (h - 0.2) / n - 0.1) });
        else if (kind < 0.8) { F.cyl('shiny', pick([0x3a6a9a, 0xc8a860, 0xe8e4dc, 0x8a3a2a]), 0.05, 0.07, 0.2, bx, y + 0.115, 0.02, 7); for (let b = 0; b < 3; b++) F.box('plain', pick([0x7a2a2a, 0x2a4a6a, 0xc8b890]), 0.2, 0.035, 0.15, bx + bw * 0.25, y + 0.033 + b * 0.036, 0.02, rnd() * 0.3); }
        else if (kind < 0.9) { F.box('wood', 0x2a2a2a, 0.2, 0.26, 0.02, bx, y + 0.145, 0.02, 0, { rx: -0.12 }); F.box('plain', pick([0xe8c070, 0x8ab0c8, 0xe8e0d0]), 0.16, 0.22, 0.01, bx, y + 0.145, 0.035, 0, { rx: -0.12 }); }
      }
    }
    F.col(0, 0, w, d, h);
  };
  P.console = (x, z, ry, o = {}) => { const F = P.table(x, z, ry, { w: o.w ?? 1.4, d: 0.38, h: 0.82, shelf: true, ...o }); return F; };
  P.dresser = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 1.5, h = o.h ?? 0.85, d = o.d ?? 0.5, wood = o.wood ?? 0x4a3222, rows = o.rows ?? 3, colsN = o.cols ?? 2;
    F.rbox('wood', wood, w, h - 0.08, d, 0, 0.08 + (h - 0.08) / 2, 0); F.box('wood', o.top ?? wood, w + 0.04, 0.03, d + 0.04, 0, h + 0.015, 0);
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) F.box('wood', wood, 0.05, 0.08, 0.05, ex * (w / 2 - 0.06), 0.04, ez * (d / 2 - 0.06));
    for (let r = 0; r < rows; r++) for (let c = 0; c < colsN; c++) { const dw = (w - 0.06) / colsN, dh = (h - 0.14) / rows, lx = -w / 2 + 0.03 + dw * (c + 0.5), y = 0.11 + dh * (r + 0.5); F.box('wood', wood, dw - 0.03, dh - 0.03, 0.02, lx, y, d / 2 + 0.005, 0, { tint: false }); F.box('shiny', o.pull ?? 0xc8a860, 0.12, 0.015, 0.02, lx, y, d / 2 + 0.025); }
    F.col(0, 0, w, d, h); return F;
  };
  P.desk = (x, z, ry, o = {}) => {   // executive desk; the chair side is local -z
    const F = at(x, z, ry), w = o.w ?? 1.8, d = o.d ?? 0.85, wood = o.wood ?? 0x4a3222;
    F.box('wood', wood, w, 0.05, d, 0, 0.76, 0); for (const e of [-1, 1]) { F.rbox('wood', wood, 0.45, 0.72, d - 0.08, e * (w / 2 - 0.25), 0.37, 0); for (let r = 0; r < 3; r++) F.box('shiny', 0xc8a860, 0.1, 0.015, 0.02, e * (w / 2 - 0.25), 0.2 + r * 0.22, -d / 2 + 0.03); }
    F.box('wood', wood, w - 0.9, 0.5, 0.03, 0, 0.5, d / 2 - 0.06);
    if (o.pc !== false) { F.box('plain', 0x1a1a1e, 0.62, 0.36, 0.025, 0, 1.08, 0.12, 0, { rx: 0.06 }); F.box('plain', 0x1a1a1e, 0.05, 0.14, 0.04, 0, 0.84, 0.14); F.box('plain', 0x1a1a1e, 0.22, 0.012, 0.14, 0, 0.79, 0.14); if (o.screen) P.decal(F, o.screen, 0.58, 0.32, 0, 1.08, 0.105, PI, 'aglow'); else F.quad('glow', o.glow ?? 0x4a7ab0, 0.58, 0.32, 0, 1.08, 0.105, PI); F.box('plain', 0x2a2a2e, 0.42, 0.015, 0.13, 0, 0.795, -0.16); F.box('plain', 0x2a2a2e, 0.06, 0.02, 0.1, 0.34, 0.795, -0.16); }
    F.box('plain', 0xf4f0e0, 0.21, 0.01, 0.29, -0.55, 0.79, -0.05, 0.2); F.cyl('plain', 0x2a2a2a, 0.04, 0.035, 0.1, 0.62, 0.84, 0.1, 8); for (let k = 0; k < 3; k++) F.box('plain', [0xd03030, 0x2a4ab0, 0x2a2a2a][k], 0.008, 0.14, 0.008, 0.62 + (k - 1) * 0.012, 0.92, 0.1, 0, { rz: (k - 1) * 0.15 });
    F.col(0, 0, w, d, 0.8);
    return F;
  };
  P.officeChair = (x, z, ry, o = {}) => { const F = at(x, z, ry), col = o.col ?? 0x2a2a2a; F.cyl('shiny', 0x2a2a2a, 0.03, 0.03, 0.36, 0, 0.24, 0, 6); for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; F.box('shiny', 0x2a2a2a, 0.04, 0.03, 0.3, Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15, a); } F.rbox('cloth', col, 0.5, 0.1, 0.48, 0, 0.47, 0); F.rbox('cloth', col, 0.46, o.tall ? 0.75 : 0.5, 0.09, 0, o.tall ? 0.95 : 0.82, -0.22, 0, { rx: -0.1 }); for (const e of [-1, 1]) F.box('plain', 0x2a2a2a, 0.05, 0.03, 0.3, e * 0.27, 0.68, 0); F.col(0, 0, 0.5, 0.5, 0.9, { top: 0.5 }); };
  /** TV on the wall with a media console below (back at local -z) */
  P.tv = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 1.6, h = w * 0.56, y = o.y ?? 1.5;
    F.box('plain', 0x111114, w + 0.05, h + 0.05, 0.04, 0, y, 0.03); if (o.screen) P.decal(F, o.screen, w, h, 0, y, 0.052, 0, 'aglow'); else F.quad('glow', o.glow ?? 0x2a4a7a, w, h, 0, y, 0.052);
    if (o.console !== false) { const cw = w + 0.5; F.rbox('wood', o.wood ?? 0x3a2a1a, cw, 0.45, 0.42, 0, 0.3, 0.22); for (let k = 0; k < 3; k++) F.box('wood', o.wood ?? 0x3a2a1a, cw / 3 - 0.04, 0.36, 0.02, (k - 1) * cw / 3, 0.3, 0.435, 0, { tint: false }); F.box('plain', 0x1a1a1e, 0.9, 0.08, 0.1, 0, 0.57, 0.2); F.box('plain', 0x2a2a2e, 0.3, 0.05, 0.22, -cw / 2 + 0.3, 0.55, 0.22); F.col(0, 0.22, cw, 0.44, 0.55); }
  };

  // ---------------- bedroom ----------------
  P.bed = (x, z, ry, o = {}) => {   // head at local -z
    const F = at(x, z, ry), w = o.w ?? 2.0, len = o.len ?? 2.1, wood = o.wood ?? 0x4a3222, linen = o.linen ?? 0xf4f0e8, duvet = o.duvet ?? 0x6a7a8a;
    F.rbox('wood', wood, w + 0.1, 0.3, len + 0.1, 0, 0.2, 0); F.rbox(o.headKey ?? 'cloth', o.head ?? wood, w + 0.2, o.headH ?? 1.35, 0.12, 0, (o.headH ?? 1.35) / 2, -len / 2 - 0.06);
    if (o.tuft) for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) F.sph('shiny', 0xc8a860, 0.02, -w / 2 + 0.2 + k * (w - 0.4) / 4, 0.75 + r * 0.3, -len / 2 + 0.01, { ws: 4, hs: 3 });
    F.rbox('cloth', linen, w, 0.24, len, 0, 0.47, 0, 0, { tint: false }); F.rbox('cloth', duvet, w + 0.06, 0.1, len * 0.66, 0, 0.6, len * 0.17 + 0.02, 0, { tint: false }); F.rbox('cloth', linen, w + 0.04, 0.05, 0.3, 0, 0.64, -len * 0.16 + 0.1, 0, { tint: false });
    const np = w > 1.5 ? 2 : 1; for (let k = 0; k < np; k++) { const lx = np === 1 ? 0 : (k ? 1 : -1) * w * 0.25; F.rbox('cloth', linen, w / np - 0.16, 0.16, 0.42, lx, 0.67, -len / 2 + 0.3, 0, { rx: -0.15, tint: false }); if (o.shams !== false) F.rbox('cloth', o.accent ?? duvet, w / np - 0.3, 0.3, 0.12, lx, 0.76, -len / 2 + 0.52, 0, { rx: -0.25 }); }
    if (o.throw !== false) F.rbox('cloth', o.accent ?? 0xc8a860, w + 0.08, 0.04, 0.5, 0, 0.665, len / 2 - 0.3, 0, { tint: false });
    if (o.bench) { F.rbox('cloth', o.benchCol ?? 0xd8d0c0, w * 0.8, 0.14, 0.42, 0, 0.42, len / 2 + 0.4); for (const e of [-1, 1]) F.box('shiny', 0xc8a860, 0.04, 0.35, 0.36, e * (w * 0.4 - 0.06), 0.175, len / 2 + 0.4); F.col(0, len / 2 + 0.4, w * 0.8, 0.42, 0.5); }
    F.col(0, 0, w + 0.1, len + 0.1, 0.7); F.col(0, -len / 2 - 0.06, w + 0.2, 0.14, o.headH ?? 1.35);
    return F;
  };
  P.nightstand = (x, z, ry, o = {}) => { const F = P.dresser(x, z, ry, { w: 0.55, h: 0.58, d: 0.45, rows: 2, cols: 1, ...o }); if (o.lamp !== false) P.tableLamp(x, 0.6, z, { i: o.i ?? 0.3 }); return F; };
  /** closet wall: rail of clothes over shelves and shoe cubbies; back at local -z */
  P.wardrobeRun = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 2.4, wood = o.wood ?? 0xf2eee6, d = 0.55, cs = o.cols ?? [0x2a2a3a, 0x3a4a6a, 0xe8e0d0, 0x6a2a3a, 0x8a8a90, 0xc8b890, 0x2a4a3a];
    F.box('wood', wood, w, 2.4, 0.03, 0, 1.2, -d / 2 + 0.015); for (const e of [-1, 0, 1]) F.box('wood', wood, 0.03, 2.4, d, e * (w / 2 - 0.015), 1.2, 0);
    F.box('wood', wood, w, 0.03, d, 0, 2.05, 0); F.box('wood', wood, w, 0.03, d, 0, 0.42, 0); F.box('wood', wood, w, 0.08, d, 0, 0.04, 0);
    for (const e of [-1, 1]) {
      const cx = e * w / 4, bw = w / 2 - 0.1;
      F.cyl('shiny', 0xc8ccd4, 0.012, 0.012, bw, cx, 1.92, 0.02, 5, { rz: PI / 2 });
      for (let k = 0; k < Math.floor(bw / 0.085); k++) { const c = pick(cs), len = e < 0 || o.long ? 1.0 + rnd() * 0.25 : 0.62 + rnd() * 0.1; F.box('cloth', c, 0.05, len, 0.42, cx - bw / 2 + 0.05 + k * 0.085, 1.88 - len / 2, 0.02, (rnd() - 0.5) * 0.1); }
      for (let k = 0; k < 4; k++) { const sc = pick([0x2a2a2a, 0x5a3a22, 0xe8e0d0, 0xa03030]); for (const s of [-1, 1]) F.box('plain', sc, 0.09, 0.08, 0.26, cx - bw / 2 + 0.16 + k * bw / 4 + s * 0.055, 0.12, 0.05); }
      for (let k = 0; k < 3; k++) F.rbox('plain', pick([0xe8e0d0, 0xc8b890, 0x8a6a4a, 0x2a2a2a]), 0.32, 0.2, 0.36, cx - bw / 2 + 0.2 + k * 0.36, 2.17, 0, 0, { round: 0.02 });
      if (e > 0 && !o.long) for (let k = 0; k < 3; k++) for (let f = 0; f < 3; f++) F.box('cloth', pick(cs), 0.3, 0.05, 0.36, cx - bw / 2 + 0.2 + k * 0.34, 0.47 + f * 0.055, 0.02);
    }
    F.col(0, 0, w, d, 2.4);
  };

  // ---------------- kitchen ----------------
  /** run of base cabinets with a counter (back at local -z); o.upper adds wall cabinets, o.splash a backsplash colour */
  P.cabinets = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 2.4, d = o.d ?? 0.62, h = o.h ?? 0.9, col = o.col ?? 0xf2eee6, top = o.top ?? 0xe8e4dc, n = Math.max(1, Math.round(w / 0.6)), pull = o.pull ?? 0x3a3a3a;
    F.box('plain', 0x2a2a2a, w, 0.1, d - 0.08, 0, 0.05, -0.02); F.box('wood', col, w, h - 0.14, d - 0.02, 0, 0.1 + (h - 0.14) / 2, -0.01, 0, { tint: false });
    F.rbox(o.topKey ?? 'shiny', top, w + 0.03, 0.04, d + 0.03, 0, h - 0.02, 0, 0, { round: 0.012, tint: false });
    for (let k = 0; k < n; k++) { const lx = -w / 2 + (k + 0.5) * w / n, dw = w / n - 0.025; if (o.drawers || k % 3 === 1) { for (let r = 0; r < 3; r++) { F.box('wood', col, dw, 0.22, 0.02, lx, 0.24 + r * 0.245, d / 2 - 0.005, 0, { tint: false }); F.box('shiny', pull, 0.14, 0.015, 0.02, lx, 0.24 + r * 0.245, d / 2 + 0.015); } } else { F.box('wood', col, dw, 0.72, 0.02, lx, 0.49, d / 2 - 0.005, 0, { tint: false }); F.box('shiny', pull, 0.015, 0.14, 0.02, lx + (k % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.7, d / 2 + 0.015); } }
    if (o.splash) F.quad(o.splashKey ?? 'plain', o.splash, w, 0.56, 0, h + 0.28, -d / 2 + 0.012);
    if (o.upper) { const uh = o.upperH ?? 0.8, uy = h + 0.56 + uh / 2; F.box('wood', col, w, uh, 0.34, 0, uy, -d / 2 + 0.17, 0, { tint: false }); for (let k = 0; k < n; k++) { const lx = -w / 2 + (k + 0.5) * w / n, dw = w / n - 0.025; F.box('wood', col, dw, uh - 0.03, 0.02, lx, uy, -d / 2 + 0.35, 0, { tint: false }); F.box('shiny', pull, 0.015, 0.12, 0.02, lx + (k % 2 ? -1 : 1) * (dw / 2 - 0.05), uy - uh / 2 + 0.12, -d / 2 + 0.37); } F.box('glow', 0xfff0d0, w - 0.1, 0.012, 0.03, 0, uy - uh / 2 - 0.006, -d / 2 + 0.28, 0, { tint: false }); }
    F.col(0, 0, w, d, h);
    return F;
  };
  P.sink = (F, lx, h = 0.9, lz = 0) => { F.box('shiny', 0xb8bcc4, 0.7, 0.02, 0.42, lx, h + 0.006, lz); F.box('plain', 0x6a6e76, 0.62, 0.012, 0.34, lx, h + 0.018, lz); F.cyl('shiny', 0xd8dce4, 0.015, 0.02, 0.3, lx, h + 0.15, lz - 0.2, 6); F.box('shiny', 0xd8dce4, 0.025, 0.025, 0.2, lx, h + 0.3, lz - 0.11); };
  P.range = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 1.2, d = 0.66, steel = 0xc8ccd4;
    F.rbox('metal', steel, w, 0.9, d, 0, 0.45, 0); F.box('plain', 0x1a1a1e, w - 0.04, 0.02, d - 0.06, 0, 0.91, 0);
    for (let k = 0; k < (w > 1 ? 6 : 4); k++) { const lx = -w / 2 + 0.2 + (k % (w > 1 ? 3 : 2)) * (w - 0.4) / ((w > 1 ? 3 : 2) - 1), lz = k < (w > 1 ? 3 : 2) ? -0.14 : 0.14; F.add(new THREE.TorusGeometry(0.09, 0.012, 3, 8).rotateX(PI / 2), 'plain', 0x2a2a2e, lx, 0.93, lz, 0, { tint: false }); F.box('plain', 0x2a2a2e, 0.2, 0.012, 0.012, lx, 0.935, lz); F.box('plain', 0x2a2a2e, 0.012, 0.012, 0.2, lx, 0.935, lz); }
    F.box('plain', 0x1a1a1e, w - 0.2, 0.42, 0.02, 0, 0.42, d / 2 + 0.005); F.box('shiny', 0xe0e4ea, w - 0.14, 0.03, 0.04, 0, 0.7, d / 2 + 0.04); for (let k = 0; k < 6; k++) F.cyl('plain', o.knob ?? 0xb02020, 0.025, 0.025, 0.03, -w / 2 + 0.12 + k * (w - 0.24) / 5, 0.82, d / 2 + 0.02, 6, { rx: PI / 2 });
    F.cyl('shiny', 0xb8742a, 0.13, 0.11, 0.12, -w / 4, 0.99, -0.14, 10); F.box('shiny', 0xb8742a, 0.2, 0.015, 0.02, -w / 4 + 0.2, 1.03, -0.14);
    if (o.hood !== false) { const hy = o.hoodY ?? 1.7, H = o.H ?? 3.2; F.add(new THREE.CylinderGeometry(0.28, w * 0.62, 0.42, 4).rotateY(PI / 4), 'metal', o.hoodCol ?? steel, 0, hy + 0.21, -0.05, 0, { tint: false, s: [1, 1, 0.62] }); F.box('metal', o.hoodCol ?? steel, 0.36, H - hy - 0.42, 0.3, 0, (H + hy + 0.42) / 2, -0.12); F.box('glow', 0xfff0d0, 0.5, 0.01, 0.12, 0, hy - 0.002, 0, 0, { tint: false }); }
    F.col(0, 0, w, d, 0.92);
  };
  P.fridge = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 1.1, h = o.h ?? 2.1, d = 0.72, col = o.col ?? 0xc8ccd4;
    F.rbox('metal', col, w, h, d, 0, h / 2, 0); F.box('plain', 0x2a2a2e, 0.012, h - 0.5, 0.01, 0, h / 2 + 0.25, d / 2 + 0.004); F.box('plain', 0x2a2a2e, w - 0.04, 0.012, 0.01, 0, 0.5, d / 2 + 0.004);
    for (const e of [-1, 1]) F.box('shiny', 0xe8ecf0, 0.025, 0.9, 0.04, e * 0.06, 1.3, d / 2 + 0.035); F.box('shiny', 0xe8ecf0, 0.5, 0.025, 0.04, 0, 0.42, d / 2 + 0.035);
    if (o.panel) F.box('plain', 0x1a1a1e, 0.2, 0.3, 0.012, -w / 4, 1.45, d / 2 + 0.006);
    F.col(0, 0, w, d, h);
  };
  /** kitchen island with stools on the local +z side */
  P.island = (x, z, ry, o = {}) => {
    const w = o.w ?? 2.8, d = o.d ?? 1.2, F = P.cabinets(x, z, ry, { w, d: d - 0.3, drawers: false, ...o });
    F.rbox(o.topKey ?? 'shiny', o.top ?? 0xe8e4dc, w + 0.12, 0.05, d + 0.1, 0, 0.9, 0.12, 0, { round: 0.015, tint: false });
    for (const e of [-1, 1]) F.box('wood', o.col ?? 0xf2eee6, 0.06, 0.86, d - 0.02, e * (w / 2 + 0.02), 0.43, 0.12);
    const n = o.stools ?? Math.floor(w / 0.75);
    for (let k = 0; k < n; k++) { const [sx, sz] = F.w(-w / 2 + (k + 0.5) * w / n, d / 2 + 0.3); P.stool(sx, sz, o.stool); }
    if (o.sink) P.sink(F, o.sink === true ? 0 : o.sink, 0.93, 0);
    F.cyl('shiny', 0xe8e4dc, 0.2, 0.12, 0.09, w / 2 - 0.5, 0.97, 0.1, 10); for (let k = 0; k < 5; k++) F.sph('plain', pick([0xe8a020, 0xd03030, 0x8ab030]), 0.055, w / 2 - 0.5 + Math.sin(k * 1.3) * 0.08, 1.03, 0.1 + Math.cos(k * 1.3) * 0.08, { ws: 5, hs: 4 });
    cols.push({ kind: 'box', cx: x, cz: z, w: w + 0.12, d: d + 0.1, rot: ry, h: 0.93 });
    return F;
  };

  // ---------------- bath ----------------
  P.tub = (x, z, ry, o = {}) => { const F = at(x, z, ry), w = o.w ?? 1.8, col = o.col ?? 0xf8f6f0; F.rbox('shiny', col, w, 0.6, 0.85, 0, 0.3, 0, 0, { round: 0.1 }); F.box('plain', 0xc8dce8, w - 0.22, 0.01, 0.6, 0, 0.5, 0); F.box('shiny', col, w - 0.16, 0.12, 0.08, 0, 0.56, 0.32); F.cyl('shiny', o.metal ?? 0xc8a860, 0.015, 0.02, 0.5, w / 2 + 0.08, 0.55, 0, 6); F.box('shiny', o.metal ?? 0xc8a860, 0.2, 0.025, 0.025, w / 2 - 0.02, 0.8, 0); F.col(0, 0, w, 0.85, 0.6); };
  P.vanity = (x, z, ry, o = {}) => {
    const w = o.w ?? 1.8, F = P.cabinets(x, z, ry, { w, d: 0.55, h: 0.86, col: o.col ?? 0x4a3a2a, top: o.top ?? 0xf0ece4, pull: o.metal ?? 0xc8a860 }), n = o.sinks ?? 2, H = o.mirH ?? 1.1;
    for (let k = 0; k < n; k++) { const lx = n === 1 ? 0 : (k ? 1 : -1) * w / 4; F.cyl('shiny', 0xf8f6f0, 0.2, 0.14, 0.06, lx, 0.875, 0.02, 12); F.cyl('shiny', o.metal ?? 0xc8a860, 0.012, 0.015, 0.2, lx, 0.97, -0.2, 6); F.box('shiny', o.metal ?? 0xc8a860, 0.02, 0.02, 0.13, lx, 1.06, -0.14); F.box('wood', o.frame ?? 0xc8a860, w / n - 0.2, H + 0.08, 0.03, lx, 1.2 + H / 2, -0.26); F.quad('mirror', 0xb8c8d4, w / n - 0.28, H, lx, 1.2 + H / 2, -0.24); { const [sx, sz] = F.w(lx + (w / n) / 2 - 0.04, -0.27); P.sconce(sx, 1.75, sz, F.ry, { i: k ? 0 : 0.35 }); } }
    for (let k = 0; k < 4; k++) F.cyl('plain', pick([0xe8e0d0, 0x8ab0c8, 0xc8a0b0]), 0.025, 0.025, 0.1 + rnd() * 0.06, -w / 2 + 0.12 + k * 0.07, 0.93, -0.12, 6);
    F.rbox('cloth', 0xf4f0e8, 0.3, 0.1, 0.2, w / 2 - 0.25, 0.92, 0.05, 0, { round: 0.03 });
    return F;
  };
  P.toilet = (x, z, ry, o = {}) => { const F = at(x, z, ry), col = o.col ?? 0xf8f6f0; F.rbox('shiny', col, 0.4, 0.38, 0.2, 0, 0.6, -0.26, 0, { round: 0.03 }); F.cyl('shiny', col, 0.2, 0.14, 0.4, 0, 0.2, 0.02, 10, { s: [1, 1, 1.25] }); F.cyl('shiny', col, 0.215, 0.215, 0.03, 0, 0.415, 0.02, 10, { s: [1, 1, 1.25] }); F.box('shiny', 0xc8ccd4, 0.06, 0.02, 0.03, -0.14, 0.72, -0.15); F.col(0, -0.05, 0.42, 0.66, 0.8, { top: 0.43 }); };
  P.shower = (x, z, ry, o = {}) => { const F = at(x, z, ry), w = o.w ?? 1.3, d = o.d ?? 1.1, H = o.h ?? 2.2; F.box('plain', 0xd8d4cc, w, 0.06, d, 0, 0.03, 0); F.box('glass', 0xe8f4ff, w, H, 0.02, 0, H / 2 + 0.05, d / 2); F.box('glass', 0xe8f4ff, 0.02, H, d, w / 2, H / 2 + 0.05, 0); F.box('shiny', 0xc8ccd4, 0.02, 0.3, 0.03, w / 4, 1.1, d / 2 + 0.03); F.cyl('shiny', 0xc8ccd4, 0.012, 0.012, 0.3, -w / 2 + 0.2, 2.05, -d / 2 + 0.16, 5, { rx: PI / 2 }); F.cyl('shiny', 0xc8ccd4, 0.1, 0.1, 0.015, -w / 2 + 0.2, 2.0, -d / 2 + 0.3, 10); F.col(0, d / 2, w, 0.04, H); F.col(w / 2, 0, 0.04, d, H); };
  P.towels = (x, y, z, ry, col = 0xf4f0e8) => { const F = at(x, z, ry); F.cyl('shiny', 0xc8ccd4, 0.01, 0.01, 0.6, 0, y, 0.06, 5, { rz: PI / 2 }); F.box('cloth', col, 0.26, 0.5, 0.03, -0.14, y - 0.22, 0.07); F.box('cloth', col, 0.2, 0.36, 0.03, 0.16, y - 0.16, 0.07); };

  // ---------------- big set pieces ----------------
  /** fireplace on a wall (back at local -z): stone surround, mantel, fire glow (a flickering light the room may animate) */
  P.fireplace = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 2.2, H = o.H ?? 3.2, stone = o.stone ?? 0xd8d0c0, d = 0.5;
    F.box(o.key ?? 'plain', stone, w, H, d, 0, H / 2, 0, 0, { tint: false }); F.box('plain', 0x1a1410, w * 0.5, 0.75, 0.02, 0, 0.5, d / 2 + 0.002); F.box(o.key ?? 'plain', o.hearth ?? 0x5a5650, w + 0.5, 0.1, 0.5, 0, 0.05, d / 2 + 0.2);
    F.rbox('wood', o.mantel ?? 0x4a3222, w + 0.3, 0.1, d + 0.24, 0, 1.3, 0.1); for (const e of [-1, 1]) F.box('wood', o.mantel ?? 0x4a3222, 0.14, 0.2, 0.16, e * (w / 2 - 0.1), 1.16, d / 2 + 0.06);
    for (let k = 0; k < 3; k++) F.cyl('wood', 0x5a3a22, 0.06, 0.06, 0.6, (k - 1) * 0.1, 0.2 + (k === 1 ? 0.1 : 0), d / 2 - 0.1, 6, { rz: PI / 2, ry: (k - 1) * 0.3 });
    for (let k = 0; k < 5; k++) F.add(new THREE.ConeGeometry(0.07 + (k % 2) * 0.03, 0.28 + (k % 3) * 0.1, 5), 'glow', k % 2 ? 0xffb030 : 0xff7020, (k - 2) * 0.1, 0.4 + (k % 2) * 0.05, d / 2 - 0.1, 0, { tint: false });
    F.box('metal', 0x2a2a2a, w * 0.5, 0.5, 0.01, 0, 0.36, d / 2 + 0.16, 0, { rx: -0.1 });
    light(F, 0, 0.5, d / 2 + 0.5, 0xff9040, o.i ?? 0.6, { halo: false });
    F.col(0, 0, w, d, H); F.col(0, d / 2 + 0.2, w + 0.5, 0.5, 0.1);
    return F;
  };
  P.piano = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), col = o.col ?? 0x141418;
    F.rbox('shiny', col, 1.5, 0.3, 1.0, 0, 0.9, 0); F.add(new THREE.CylinderGeometry(0.72, 0.72, 0.3, 12, 1, false, 0, PI), 'shiny', col, 0.03, 0.9, -0.5, PI / 2, { tint: false, s: [1, 1, 1.05] });
    F.box('shiny', col, 1.46, 0.03, 1.3, 0.1, 1.42, -0.5, 0, { rz: 0.42 }); F.box('shiny', col, 0.02, 0.5, 0.02, 0.5, 1.25, -0.2);
    F.box('plain', 0xf4f0e8, 1.3, 0.03, 0.15, 0, 0.83, 0.56); for (let k = 0; k < 18; k++) F.box('plain', 0x141418, 0.035, 0.02, 0.09, -0.6 + k * 0.071 + (k % 7 > 2 ? 0.02 : 0), 0.855, 0.53); F.box('shiny', col, 1.5, 0.08, 0.2, 0, 0.78, 0.56);
    for (const [lx, lz] of [[-0.65, 0.4], [0.65, 0.4], [0.05, -1.1]]) F.cyl('shiny', col, 0.05, 0.035, 0.75, lx, 0.375, lz, 6); F.box('shiny', 0xc8a860, 0.2, 0.3, 0.03, 0, 0.3, 0.4);
    F.rbox('cloth', 0x2a2a2a, 0.8, 0.08, 0.36, 0, 0.5, 1.05); for (const e of [-1, 1]) F.box('shiny', col, 0.05, 0.46, 0.3, e * 0.34, 0.23, 1.05);
    F.col(0, -0.3, 1.5, 1.7, 1.1); F.col(0, 1.05, 0.8, 0.36, 0.54);
  };
  /** wine rack wall (back at local -z): a diamond grid of bottle ends */
  P.wineRack = (x, z, ry, o = {}) => {
    const F = at(x, z, ry), w = o.w ?? 2.4, h = o.h ?? 2.4, wood = o.wood ?? 0x3a2416, d = 0.36, nx = Math.round(w / 0.115), ny = Math.round((h - 0.2) / 0.115);
    F.box('wood', wood, w, h, 0.03, 0, h / 2, -d / 2 + 0.015); for (const e of [-1, 1]) F.box('wood', wood, 0.04, h, d, e * (w / 2 - 0.02), h / 2, 0); F.box('wood', wood, w, 0.05, d, 0, h - 0.025, 0); F.box('wood', wood, w, 0.1, d, 0, 0.05, 0);
    for (let r = 1; r < ny; r += 4) F.box('wood', wood, w - 0.06, 0.02, d - 0.04, 0, 0.1 + r * 0.115 - 0.05, 0);
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) { if (rnd() < 0.14) continue; const lx = -w / 2 + 0.08 + c * (w - 0.16) / (nx - 1), y = 0.17 + r * 0.115; F.add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5, 1, true), 'shiny', pick([0x1a3a22, 0x1a3a22, 0x2a1a14, 0x3a2a1a]), lx, y, 0, 0, { rx: PI / 2, tint: false }); F.add(new THREE.CircleGeometry(0.036, 5), 'plain', pick([0x8a1a2a, 0xc8a860, 0x1a1a1a, 0x8a1a2a]), lx, y, 0.151, 0, { tint: false }); }
    F.col(0, 0, w, d, h);
  };
  P.barrel = (x, z, o = {}) => { const s = o.s ?? 1; B.cyl('wood', 0x7a5232, 0.3 * s, 0.3 * s, 0.9 * s, x, 0.45 * s, z, 10, { ao: false }); B.cyl('wood', 0x8a6238, 0.35 * s, 0.35 * s, 0.4 * s, x, 0.45 * s, z, 10, { ao: false }); for (const y of [0.12, 0.3, 0.6, 0.78]) B.cyl('metal', 0x3a3a3a, 0.335 * s, 0.335 * s, 0.03, x, y * s, z, 10, { ao: false }); cols.push({ kind: 'box', cx: x, cz: z, w: 0.66 * s, d: 0.66 * s, rot: 0, h: 0.9 * s }); };
  P.poolTable = (x, z, ry, o = {}) => { const F = at(x, z, ry); F.rbox('wood', o.wood ?? 0x3a2416, 2.6, 0.22, 1.5, 0, 0.75, 0); F.box('cloth', o.felt ?? 0x1a6a3a, 2.3, 0.02, 1.2, 0, 0.87, 0); for (const ex of [-1, 1]) for (const ez of [-1, 1]) F.rbox('wood', o.wood ?? 0x3a2416, 0.16, 0.66, 0.16, ex * 1.1, 0.33, ez * 0.55); for (const ex of [-1, 0, 1]) for (const ez of [-1, 1]) F.cyl('plain', 0x111111, 0.06, 0.06, 0.012, ex * 1.14, 0.882, ez * 0.59, 8); for (let k = 0; k < 10; k++) { const r = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3][k], i = k - [0, 1, 1, 3, 3, 3, 6, 6, 6, 6][k]; F.sph('shiny', [0xe8c020, 0x2a4ab0, 0xd03030, 0x6a2a8a, 0xe87020, 0x1a6a3a, 0x8a2a2a, 0x111111, 0xe8c020, 0x2a4ab0][k], 0.03, 0.5 + r * 0.055, 0.91, (i - r / 2) * 0.062, { ws: 6, hs: 4 }); } F.sph('shiny', 0xf4f0e8, 0.03, -0.6, 0.91, 0.05, { ws: 6, hs: 4 }); F.cyl('wood', 0xc8a060, 0.008, 0.014, 1.4, -0.2, 0.9, 0.42, 5, { rz: PI / 2, ry: 0.2 }); F.col(0, 0, 2.6, 1.5, 0.88); };
  P.treadmill = (x, z, ry) => { const F = at(x, z, ry); F.box('plain', 0x2a2a2e, 0.75, 0.14, 1.7, 0, 0.1, 0); F.box('plain', 0x111114, 0.55, 0.01, 1.4, 0, 0.175, 0.05); for (const e of [-1, 1]) { F.box('metal', 0x8a8a90, 0.05, 1.2, 0.05, e * 0.34, 0.7, -0.7, 0, { rx: -0.12 }); F.box('metal', 0x8a8a90, 0.04, 0.04, 0.5, e * 0.34, 1.05, -0.45); } F.box('plain', 0x2a2a2e, 0.72, 0.28, 0.06, 0, 1.36, -0.8, 0, { rx: -0.4 }); F.quad('glow', 0x40c0e0, 0.4, 0.14, 0, 1.37, -0.76, 0, { rx: -0.4 }); F.col(0, 0, 0.75, 1.7, 0.2); F.col(0, -0.75, 0.75, 0.2, 1.4); };
  P.weights = (x, z, ry) => { const F = at(x, z, ry); for (let r = 0; r < 2; r++) { F.box('metal', 0x3a3a3e, 1.4, 0.03, 0.3, 0, 0.35 + r * 0.4, 0, 0, { rx: 0.2 }); for (let k = 0; k < 5; k++) { const lx = -0.56 + k * 0.28, s = 0.05 + (r ? k : 4 - k) * 0.008; F.cyl('plain', 0x1a1a1e, s, s, 0.07, lx - 0.07, 0.42 + r * 0.4, 0, 6, { rz: PI / 2 }); F.cyl('plain', 0x1a1a1e, s, s, 0.07, lx + 0.07, 0.42 + r * 0.4, 0, 6, { rz: PI / 2 }); F.cyl('shiny', 0xc8ccd4, 0.012, 0.012, 0.16, lx, 0.42 + r * 0.4, 0, 4, { rz: PI / 2 }); } } for (const e of [-1, 1]) F.box('metal', 0x3a3a3e, 0.04, 0.9, 0.34, e * 0.7, 0.45, 0); F.col(0, 0, 1.45, 0.36, 0.9); };
  P.column = (x, z, H, o = {}) => { const r = o.r ?? 0.17, col = o.col ?? 0xf4f0e8; B.box('plain', col, r * 2.7, 0.14, r * 2.7, x, 0.07, z, 0, { ao: false, round: false }); B.cyl('plain', col, r * 0.88, r, H - 0.3, x, H / 2, z, 12, { ao: false }); B.box('plain', col, r * 2.7, 0.16, r * 2.7, x, H - 0.08, z, 0, { ao: false, round: false }); B.cyl('plain', col, r * 1.2, r * 0.9, 0.08, x, H - 0.2, z, 12, { ao: false }); cols.push({ kind: 'box', cx: x, cz: z, w: r * 2.2, d: r * 2.2, rot: 0, h: H }); };
  /** coffered ceiling: a grid of beams under the ceiling of one room */
  P.coffer = (x0, x1, z0, z1, H, o = {}) => { const col = o.col ?? 0xf2eee6, t = o.t ?? 0.16, dp = o.d ?? 0.14, nx = o.nx ?? Math.round((x1 - x0) / 2.2), nz = o.nz ?? Math.round((z1 - z0) / 2.2); for (let k = 1; k < nx; k++) B.box(o.key ?? 'plain', col, t, dp, z1 - z0 - 0.02, x0 + k * (x1 - x0) / nx, H - dp / 2, (z0 + z1) / 2, 0, { ao: false, round: false }); for (let k = 1; k < nz; k++) B.box(o.key ?? 'plain', col, x1 - x0 - 0.02, dp, t, (x0 + x1) / 2, H - dp / 2, z0 + k * (z1 - z0) / nz, 0, { ao: false, round: false }); };
  return P;
}
