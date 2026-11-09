// Interior rooms for Maple Grove: Off Leash. Each room is a small hand-placed PS2-era set: a few merged
// meshes (one per material, vertex colours + baked AO), canvas-painted detail textures, warm practical lights.
//
// Contract (see game interior system):
//   build(ctx) with ctx = { THREE, M, T } -> { group, size, cols, spawn, exit, lights, cam, interact }
//   local origin = room centre at floor level (y = 0); +z = toward the entrance door; yaw 0 faces -z.
// Optional `floors`: walkable raised surfaces (room-local, terrain.js floorAt shapes: decks {top,x0,x1,z0,z1}, discs
// {top,cx,cz,r}, turned boxes/ramps). Solid cols are standable at `top ?? h` (jump onto counters, beds, pews).
// Walls, floor and ceiling are single-sided planes facing INTO the room, so when the third-person camera is
// pushed outside a wall it looks straight in (dollhouse cutaway) instead of staring at a wall.
// Extra (optional, not required by the contract): the returned object also carries update(t) for tiny
// animations (flickering tube, TV static, cuckoo pendulum); harmless if never called.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[(rnd() * a.length) | 0];
const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

// ---------- canvas textures ----------
const texCache = new Map();
const ANISO = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 1 : 4; // P9: 1 on touch
function ctex(THREE, key, w, h, draw, o = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  if (o.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.nearest) { t.magFilter = THREE.NearestFilter; }
  texCache.set(key, t);
  return t;
}
// speckle / grime overlay used by most painted textures
function grime(g, w, h, n, a = 0.08, dark = true) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = dark ? `rgba(0,0,0,${a * rnd()})` : `rgba(255,255,255,${a * rnd()})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}
function textLines(g, lines, x, y, lh, font, color, align = 'center') {
  g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  lines.forEach((t, i) => g.fillText(t, x, y + i * lh));
}
/** A painted sign: bg colour, lines of text, optional border / glow. */
function signTex(THREE, key, lines, bg, fg, w = 256, h = 96, o = {}) {
  return ctex(THREE, 'sign:' + key, w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    else g.clearRect(0, 0, w, h);
    const n = lines.length, lh = Math.min(h / (n + 0.4), o.size || 999);
    const font = `${o.weight || 'bold'} ${Math.round(lh * 0.78)}px ${o.font || 'Impact, "Arial Black", sans-serif'}`;
    if (o.glow) { g.shadowColor = fg; g.shadowBlur = lh * 0.5; }
    textLines(g, lines, w / 2, h / 2 - (n - 1) * lh / 2 + 1, lh, font, fg);
    g.shadowBlur = 0;
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }
    if (o.tape) { g.fillStyle = 'rgba(255,240,200,0.75)'; g.fillRect(w / 2 - 14, -4, 28, 12); }
  }, { repeat: false });
}

// ---------- geometry bucket builder ----------
function makeBuilder(THREE, T) {
  const buckets = {}, mats = {}, specs = {};
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const lam = (o) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
  const def = (key, spec) => { specs[key] = spec; };
  // base materials; T textures are used when present
  def('plain', { kind: 'lambert' });
  def('wood', { kind: 'lambert', map: T && T.wood });
  def('cloth', { kind: 'lambert', map: T && T.cloth });
  def('metal', { kind: 'phong', map: T && T.metal, shininess: 70, specular: 0x777777 });
  def('shiny', { kind: 'phong', shininess: 90, specular: 0x888888 });
  def('glow', { kind: 'basic' });
  def('glass', { kind: 'basic', transparent: true, opacity: 0.32, depthWrite: false });
  def('fabric', { kind: 'lambert', map: T && T.fur });
  function material(key) {
    if (mats[key]) return mats[key];
    const s = specs[key] || specs.plain;
    const { kind, ...rest } = s;
    if (rest.map === undefined || rest.map === null) delete rest.map;
    let m;
    if (kind === 'basic') m = new THREE.MeshBasicMaterial({ vertexColors: true, ...rest });
    else if (kind === 'phong') m = new THREE.MeshPhongMaterial({ vertexColors: true, ...rest });
    else m = lam(rest);
    mats[key] = m;
    return m;
  }
  /** Add geometry at (x,y,z) rotated ry about y into bucket `key`, painted `color` with baked AO. */
  function add(geo, key, color, x = 0, y = 0, z = 0, ry = 0, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (o.s) g.scale(o.s[0], o.s[1], o.s[2]);
    if (o.rx || o.rz) g.applyMatrix4(_m.makeRotationFromEuler(_e.set(o.rx || 0, 0, o.rz || 0)));
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1));
    g.applyMatrix4(_m);
    if (o.ao !== false) {
      const pos = g.attributes.position, tint = o.tint === false ? 1 : 0.93 + rnd() * 0.12, lo = o.aoLo ?? 0.55, span = o.aoSpan ?? 1.3;
      for (let i = 0; i < n; i++) {
        const f = (lo + (1 - lo) * sm(pos.getY(i) / span)) * tint;
        col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
      }
    }
    if (o.paint) { // custom per-vertex shading fn(x,y,z) -> factor
      const pos = g.attributes.position;
      for (let i = 0; i < n; i++) { const f = o.paint(pos.getX(i), pos.getY(i), pos.getZ(i)); col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f; }
    }
    (buckets[key] ||= []).push(g);
  }
  const B = {
    def, add, material,
    box(key, color, w, h, d, x, y, z, ry = 0, o = {}) { add(new THREE.BoxGeometry(w, h, d), key, color, x, y, z, ry, o); },
    cyl(key, color, rt, rb, h, x, y, z, s = 10, o = {}) { add(new THREE.CylinderGeometry(rt, rb, h, s), key, color, x, y, z, o.ry || 0, o); },
    sph(key, color, r, x, y, z, o = {}) { add(new THREE.SphereGeometry(r, o.ws || 8, o.hs || 6), key, color, x, y, z, 0, o); },
    /** Vertical quad facing +z before ry (0 = faces +z, PI = faces -z, PI/2 = faces +x, -PI/2 = faces -x). */
    quad(key, color, w, h, x, y, z, ry = 0, o = {}) {
      const g = new THREE.PlaneGeometry(w, h, o.sx || 1, o.sy || 1);
      if (o.us || o.vs) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (o.us || 1), uv.getY(i) * (o.vs || 1)); }
      add(g, key, color, x, y, z, ry, o);
    },
    /** Horizontal quad facing up (or down with o.down). */
    flat(key, color, w, d, x, y, z, ry = 0, o = {}) {
      const g = new THREE.PlaneGeometry(w, d, o.sx || 1, o.sy || 1);
      g.rotateX(o.down ? Math.PI / 2 : -Math.PI / 2);
      if (o.us || o.vs) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (o.us || 1), uv.getY(i) * (o.vs || 1)); }
      add(g, key, color, x, y, z, ry, o);
    },
    finish(group) {
      for (const [k, list] of Object.entries(buckets)) {
        const g = mergeGeometries(list, false);
        if (!g) continue;
        const mesh = new THREE.Mesh(g, material(k));
        mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
        mesh.name = 'room:' + k;
        group.add(mesh);
      }
      return group;
    },
  };
  return B;
}

/** Room shell: floor, 4 inward-facing walls (front wall split around the door), ceiling, baseboards; returns cols for the walls. */
function shell(B, THREE, o) {
  const { w, d, h, floorKey, wallKey, ceilKey = 'plain', wallCol = 0xffffff, floorCol = 0xffffff, ceilCol = 0x6a6660, door = { x: 0, w: 1.0, h: 2.0 }, base = 0x6b5a48, trim = null, wallTile = 2, floorTile = 2 } = o;
  const hw = w / 2, hd = d / 2;
  const cornerAO = (x, y, z) => {
    const dx = hw - Math.abs(x), dz = hd - Math.abs(z);
    const e = Math.min(dx, dz);                       // distance to the nearest vertical corner
    const f = 0.62 + 0.38 * sm(e / 0.9);
    const top = 0.78 + 0.22 * sm((h - y) / 0.6);      // darker under the ceiling
    const bot = 0.55 + 0.45 * sm(y / 0.6);            // darker at the floor
    return f * top * bot;
  };
  const floorAO = (x, _y, z) => { const e = Math.min(hw - Math.abs(x), hd - Math.abs(z)); return 0.6 + 0.4 * sm(e / 1.1); };
  // floor
  B.flat(floorKey, floorCol, w, d, 0, 0, 0, 0, { sx: Math.ceil(w), sy: Math.ceil(d), us: w / floorTile, vs: d / floorTile, ao: false, paint: floorAO });
  // ceiling (faces down only)
  B.flat(ceilKey, ceilCol, w, d, 0, h, 0, 0, { down: true, sx: Math.ceil(w / 2), sy: Math.ceil(d / 2), us: w / 2, vs: d / 2, ao: false, paint: (x, y, z) => floorAO(x, y, z) * 0.9 });
  const wall = (cx, cz, len, ry, hh = h, y = hh / 2, segs = null) =>
    B.quad(wallKey, wallCol, len, hh, cx, y, cz, ry, { sx: segs || Math.ceil(len * 2), sy: Math.ceil(hh * 2), us: len / wallTile, vs: hh / wallTile, ao: false, paint: cornerAO, tint: false });
  wall(0, -hd, w, 0);                 // back wall faces +z
  wall(-hw, 0, d, Math.PI / 2);       // left wall faces +x
  wall(hw, 0, d, -Math.PI / 2);       // right wall faces -x
  // front wall around the door
  const dl = door.x - door.w / 2, dr = door.x + door.w / 2;
  const lw = dl + hw, rw = hw - dr;
  if (lw > 0.01) wall(-hw + lw / 2, hd, lw, Math.PI);
  if (rw > 0.01) wall(hw - rw / 2, hd, rw, Math.PI);
  wall(door.x, hd, door.w, Math.PI, h - door.h, door.h + (h - door.h) / 2, 2);
  // baseboards, chair rail and door frame are inward-facing strips (never seen from outside the room)
  const strip = (color, cx, cz, len, hh, y, ry) => B.quad('plain', color, len, hh, cx + Math.sin(ry) * 0.012, y, cz + Math.cos(ry) * 0.012, ry, { ao: false, tint: false });
  const around = (color, hh, y) => {
    strip(color, 0, -hd, w, hh, y, 0); strip(color, -hw, 0, d, hh, y, Math.PI / 2); strip(color, hw, 0, d, hh, y, -Math.PI / 2);
    if (lw > 0.01) strip(color, -hw + lw / 2, hd, lw, hh, y, Math.PI);
    if (rw > 0.01) strip(color, hw - rw / 2, hd, rw, hh, y, Math.PI);
  };
  around(base, 0.12, 0.06);
  if (trim !== null) around(trim.c, trim.h || 0.08, trim.y);
  const fc = o.frame || 0xe8e2d4;
  for (const s of [-1, 1]) strip(fc, door.x + s * (door.w / 2 + 0.04), hd, 0.08, door.h + 0.04, door.h / 2, Math.PI);
  strip(fc, door.x, hd, door.w + 0.24, 0.08, door.h + 0.04, Math.PI);
  const t = 0.3;
  const cols = [
    { kind: 'box', cx: 0, cz: -hd - t / 2, w: w + 2 * t, d: t, rot: 0, h },
    { kind: 'box', cx: -hw - t / 2, cz: 0, w: t, d: d + 2 * t, rot: 0, h },
    { kind: 'box', cx: hw + t / 2, cz: 0, w: t, d: d + 2 * t, rot: 0, h },
  ];
  if (lw > 0.01) cols.push({ kind: 'box', cx: -hw + lw / 2, cz: hd + t / 2, w: lw, d: t, rot: 0, h });
  if (rw > 0.01) cols.push({ kind: 'box', cx: hw - rw / 2, cz: hd + t / 2, w: rw, d: t, rot: 0, h });
  return cols;
}

// small shared props
function framedPicture(B, THREE, key, w, h, x, y, z, ry, frame = 0x4a3222) {
  B.box('wood', frame, w + 0.08, h + 0.08, 0.04, x, y, z, ry, { ao: false });
  // picture plane sits 0.025 proud of the wall along the facing normal
  const nx = Math.sin(ry), nz = Math.cos(ry);
  B.quad(key, 0xffffff, w, h, x + nx * 0.025, y, z + nz * 0.025, ry, { ao: false, tint: false });
}
function catFigurine(B, color, x, y, z, ry = 0, s = 1) {
  B.box('shiny', color, 0.07 * s, 0.09 * s, 0.11 * s, x, y + 0.045 * s, z, ry, { ao: false });
  B.sph('shiny', color, 0.045 * s, x + Math.sin(ry) * 0.05 * s, y + 0.11 * s, z + Math.cos(ry) * 0.05 * s, { ao: false });
  for (const e of [-1, 1]) B.box('shiny', color, 0.02 * s, 0.03 * s, 0.02 * s, x + Math.sin(ry) * 0.05 * s + Math.cos(ry) * e * 0.025 * s, y + 0.15 * s, z + Math.cos(ry) * 0.05 * s - Math.sin(ry) * e * 0.025 * s, ry, { ao: false });
}
function bulbLamp(B, x, y, z, c = 0xfff0c0) { // bare ceiling bulb with a small base
  B.cyl('plain', 0xd8d4cc, 0.07, 0.09, 0.05, x, y + 0.1, z, 8, { ao: false });
  B.sph('glow', c, 0.07, x, y, z, { ao: false, tint: false });
}
function tubeLight(B, x, y, z, len, ry = 0, c = 0xf4f8ff, housing = 0xd0d0d0) {
  B.box('plain', housing, len + 0.1, 0.08, 0.3, x, y + 0.05, z, ry, { ao: false });
  B.box('glow', c, len, 0.04, 0.09, x, y, z, ry, { ao: false, tint: false });
}
const C = { // shared colour helpers
  vinylRed: 0xc8282e, chrome: 0xd8dce4, cream: 0xf2e8cf,
};

// =====================================================================================================
// 1. Goobles' RV: cramped camper, 2.4 x 7 m, 2.1 m ceiling. Bed at the back, galley left, dinette right.
// =====================================================================================================
function buildRV(ctx) {
  // Goobles' travel trailer, laid out from diet's floor plan (2026-11-08): hitch end to the RIGHT when you stand in the
  // entrance facing in (-z). Right: queen bedroom behind a partition. Entrance wall (+z): stove counter left of the door,
  // corner sink right of it, fridge and TV cabinet further left. Slide side (-z): sofa and recliner with a table.
  // Left: bathroom (toilet, tub, vanity) on the entrance side with a corridor past it to the bunk room at the far end.
  const { THREE, T } = ctx; seed = 11;
  const B = makeBuilder(THREE, T);
  const W = 8.2, D = 3.0, H = 2.1, DX = 1.3;   // room is long along x; the door sits at x = DX on the +z wall
  const lino = ctex(THREE, 'rv:lino', 64, 64, (g) => {
    g.fillStyle = '#c8b48a'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#bfa97c' : '#d2c19a'; g.fillRect(x, y, 16, 16); }
    g.strokeStyle = 'rgba(80,60,30,0.35)'; for (let k = 0; k <= 64; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.moveTo(0, k); g.lineTo(64, k); g.stroke(); }
    grime(g, 64, 64, 120, 0.25);
  });
  const panel = ctex(THREE, 'rv:panel', 64, 64, (g) => {
    g.fillStyle = '#b8895a'; g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 2) { g.fillStyle = `rgba(60,30,10,${0.05 + 0.1 * rnd()})`; g.fillRect(x, 0, 1, 64); }
    for (let x = 0; x < 64; x += 16) { g.fillStyle = 'rgba(40,20,5,0.55)'; g.fillRect(x, 0, 2, 64); }
    grime(g, 64, 64, 60, 0.2);
  });
  const carpet = ctex(THREE, 'rv:carpet', 32, 32, (g) => { g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${40 + rnd() * 60},${20 + rnd() * 40},10,${0.3 * rnd()})`; g.fillRect(rnd() * 32, rnd() * 32, 1, 1); } });
  B.def('lino', { kind: 'lambert', map: lino });
  B.def('panel', { kind: 'lambert', map: panel });
  B.def('carpet', { kind: 'lambert', map: carpet });
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'lino', wallKey: 'panel', ceilCol: 0xcfc6b4, door: { x: DX, w: 0.8, h: 1.9 }, base: 0x4a3a2a, frame: 0xcfc8b6, wallTile: 1, floorTile: 1 });
  const solid = (cx, cz, w, d, h, rot = 0) => cols.push({ kind: 'box', cx, cz, w, d, rot, h });
  // interior partition walls (panelled both sides): bedroom wall at x 2.3 with a doorway on the entrance side,
  // bathroom box x -2.9..-1.6 on the entrance side with its door onto the corridor, bunk-room wall at x -2.9
  const wallBox = (cx, cz, w, d) => { B.box('panel', 0xffffff, w, H, d, cx, H / 2, cz, 0, { ao: false }); solid(cx, cz, w, d, H); };
  wallBox(2.3, -0.6, 0.08, 1.8); wallBox(2.3, 1.3, 0.08, 0.4);                       // bedroom wall, opening z 0.3..1.1
  B.box('plain', 0x4a3a2a, 0.1, 0.1, 0.9, 2.3, 1.85, 0.7, 0, { ao: false });          // doorway header
  wallBox(-1.6, 0.85, 0.08, 1.3); wallBox(-2.9, 0.85, 0.08, 1.3);                      // bathroom side walls (z 0.2..1.5)
  wallBox(-2.78, 0.2, 0.24, 0.08); wallBox(-1.78, 0.2, 0.36, 0.08);                   // bathroom front wall with a door gap x -2.66..-1.96
  B.quad('plain', 0xe8e2d4, 0.68, 1.9, -2.31, 0.95, 0.17, Math.PI, { ao: false, sy: 4, paint: (_x, y) => 0.6 + 0.4 * sm(y / 0.8) });   // bathroom door, ajar-looking panel
  B.box('shiny', 0xd8c080, 0.03, 0.03, 0.08, -2.05, 0.95, 0.15, 0, { ao: false });
  wallBox(-2.9, -0.95, 0.08, 1.1);                                                   // bunk-room wall, opening z -0.4..0.2 (the corridor)
  B.flat('carpet', 0xffffff, 1.7, D - 0.1, 3.2, 0.004, 0, 0, { ao: false, sx: 2, sy: 3 });   // bedroom carpet
  B.flat('carpet', 0xffffff, 1.1, D - 0.1, -3.55, 0.004, 0, 0, { ao: false, sx: 2, sy: 3 });  // bunk-room carpet
  // windows: dark night panes with sagging curtains
  const night = ctex(THREE, 'rv:night', 32, 32, (g) => { g.fillStyle = '#121a2c'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#1e2c48'; g.fillRect(0, 20, 32, 12); for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(rnd() * 32, rnd() * 18, 1, 1); } }, { repeat: false });
  B.def('night', { kind: 'basic', map: night });
  const curtain = ctex(THREE, 'rv:curtain', 32, 32, (g) => { g.fillStyle = '#c86a3a'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#e0904a'; for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 4, 32); g.fillStyle = 'rgba(255,230,120,0.6)'; for (let y = 2; y < 32; y += 6) for (let x = 2; x < 32; x += 8) g.fillRect(x, y, 2, 2); });
  B.def('curtain', { kind: 'lambert', map: curtain });
  for (const [x, z, ry] of [[-0.4, -D / 2, 0], [3.3, -D / 2, 0], [-3.5, -D / 2, 0], [W / 2, 0.6, -Math.PI / 2], [2.6, D / 2, Math.PI]]) {
    const nx = Math.sin(ry) * 0.02, nz = Math.cos(ry) * 0.02;
    B.quad('night', 0xffffff, 0.9, 0.55, x + nx, 1.45, z + nz, ry, { ao: false, tint: false });
    B.box('plain', 0xcfc8b6, 1.0, 0.04, 0.05, x + nx, 1.75, z + nz, ry, { ao: false }); B.box('plain', 0xcfc8b6, 1.0, 0.04, 0.05, x + nx, 1.16, z + nz, ry, { ao: false });
    for (const s of [-1, 1]) B.quad('curtain', 0xffffff, 0.28, 0.66, x + nx * 2.5 + Math.cos(ry) * s * 0.4, 1.46, z + nz * 2.5 - Math.sin(ry) * s * 0.4, ry, { ao: false, sx: 2, sy: 2, paint: (_x, y) => 0.75 + 0.25 * sm((y - 1.1) / 0.7) });
  }
  // ---- bedroom (x 2.3..4.1): queen bed across the end wall, nightstands, wardrobe by the door, saggy blanket, pillows
  const blanket = ctex(THREE, 'rv:blanket', 32, 32, (g) => { g.fillStyle = '#4e6b8a'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#6d8aa8'; for (let y = 0; y < 32; y += 8) g.fillRect(0, y, 32, 3); g.fillStyle = '#c04040'; g.fillRect(0, 14, 32, 2); });
  B.def('blanket', { kind: 'lambert', map: blanket });
  B.box('wood', 0x7a5634, 1.5, 0.45, 2.0, 3.35, 0.225, -0.25);                           // platform (head at the +x wall)
  B.box('cloth', 0xe8e0d0, 1.4, 0.22, 1.9, 3.35, 0.56, -0.25, 0, { aoLo: 0.8 });
  B.box('blanket', 0xffffff, 1.1, 0.12, 1.6, 3.1, 0.72, -0.2, 0.1, { aoLo: 0.8 });
  B.box('blanket', 0xffffff, 0.5, 0.18, 0.7, 2.9, 0.72, 0.4, -0.4, { aoLo: 0.8 });        // bunched-up corner
  for (const z of [-0.75, 0.25]) B.box('cloth', 0xf4f0e8, 0.4, 0.14, 0.6, 3.85, 0.74, z, 0.05, { aoLo: 0.9 }); // two pillows
  B.box('cloth', 0xd8d0c0, 0.35, 0.1, 0.5, 2.95, 0.72, -0.8, -0.2, { aoLo: 0.9 });         // the cat's own flattened spot
  B.box('wood', 0x7a5634, 0.08, 0.5, 2.1, W / 2 - 0.05, 0.95, -0.25);                      // headboard
  B.box('wood', 0x7a5634, 0.25, 0.08, 2.1, W / 2 - 0.13, 1.2, -0.25);                      // headboard shelf
  B.box('plain', 0x333333, 0.18, 0.12, 0.3, W / 2 - 0.14, 1.3, -1.1);                     // cassette radio
  B.box('glow', 0xff6030, 0.02, 0.02, 0.05, W / 2 - 0.24, 1.33, -1.0, 0, { ao: false });
  B.box('plain', 0x222222, 0.08, 0.08, 0.16, W / 2 - 0.14, 1.28, 0.3);                    // alarm clock, blinking 12:00 forever
  const clk = signTex(THREE, 'rv:clock', ['12:00'], '#000', '#ff3020', 64, 32, { glow: true });
  B.def('clk', { kind: 'basic', map: clk });
  B.quad('clk', 0xffffff, 0.14, 0.06, W / 2 - 0.185, 1.28, 0.3, -Math.PI / 2, { ao: false, tint: false });
  B.box('plain', 0xf0e8d8, 0.02, 0.28, 0.2, W / 2 - 0.02, 1.6, 0.6, 0, { ao: false });    // pinned photo above the bed
  B.box('wood', 0x8a6238, 0.9, 1.9, 0.55, 2.8, 0.95, 1.2);                                 // wardrobe by the bedroom door
  for (const s of [-1, 1]) { B.box('plain', 0x3a2a1a, 0.02, 1.7, 0.02, 2.8 + s * 0.22, 0.95, 0.92, 0, { ao: false }); B.box('shiny', 0xd8c080, 0.03, 0.08, 0.03, 2.8 + s * 0.1, 0.95, 0.91, 0, { ao: false }); }
  B.box('wood', 0x8a6238, 0.5, 0.45, 0.4, 3.85, 0.225, 1.2); B.box('plain', 0xe8d0a0, 0.12, 0.3, 0.12, 3.85, 0.6, 1.2); // nightstand + lamp
  B.sph('glow', 0xffe0a0, 0.1, 3.85, 0.8, 1.2, { ao: false, tint: false });
  solid(3.35, -0.25, 1.5, 2.0, 0.72); solid(2.8, 1.2, 0.9, 0.55, 1.9); solid(3.85, 1.2, 0.5, 0.4, 0.45);
  // ---- kitchen along the entrance wall (diet 2026-11-08): from the door going left, sink counter, then a small
  // stove counter, then the fridge against the bathroom wall. Cabinets above the sink and stove.
  const CZ = D / 2 - 0.3;
  const sinkX = 0.375, stoveX = -0.5, fridgeX = -1.2;
  B.box('plain', 0xd8d2c4, 0.95, 0.85, 0.6, sinkX, 0.425, CZ); B.box('shiny', 0xcfd4d8, 0.97, 0.04, 0.62, sinkX, 0.87, CZ, 0, { ao: false });
  for (let k = 0; k < 2; k++) B.box('plain', 0x3a3a3a, 0.42, 0.5, 0.02, sinkX - 0.23 + k * 0.46, 0.45, CZ - 0.31, 0, { ao: false }); // door gaps
  B.box('plain', 0x8a9298, 0.44, 0.2, 0.44, sinkX, 0.8, CZ);                                 // sink basin (recess is faked)
  B.box('plain', 0x1a2a30, 0.38, 0.02, 0.38, sinkX, 0.9, CZ, 0, { ao: false });              // grey dishwater
  for (let k = 0; k < 5; k++) B.cyl('plain', pick([0xf0f0e8, 0xe8d0a0, 0xb0d0e0, 0xf0f0e8]), 0.1, 0.1, 0.015, sinkX + (rnd() - 0.5) * 0.1, 0.91 + k * 0.02, CZ + (rnd() - 0.5) * 0.1, 10, { ao: false }); // plate stack
  B.cyl('shiny', 0xcfd4d8, 0.015, 0.015, 0.3, sinkX, 1.0, D / 2 - 0.1, 6, { ao: false }); B.box('shiny', 0xcfd4d8, 0.04, 0.03, 0.22, sinkX, 1.16, D / 2 - 0.2, 0, { ao: false }); // tap
  B.cyl('plain', 0xe0e0e0, 0.05, 0.04, 0.12, sinkX + 0.38, 0.95, CZ + 0.1, 8); B.cyl('plain', 0xa02020, 0.045, 0.04, 0.14, sinkX - 0.4, 0.96, CZ - 0.1, 8); // soap, hot sauce bottle
  B.box('plain', 0xd8d2c4, 0.8, 0.85, 0.6, stoveX, 0.425, CZ); B.box('shiny', 0xcfd4d8, 0.82, 0.04, 0.62, stoveX, 0.87, CZ, 0, { ao: false });
  B.box('plain', 0x3a3a3a, 0.7, 0.5, 0.02, stoveX, 0.45, CZ - 0.31, 0, { ao: false }); B.box('shiny', 0xcfd4d8, 0.4, 0.03, 0.03, stoveX, 0.6, CZ - 0.32, 0, { ao: false }); // oven door + handle
  B.box('plain', 0x8a8a8a, 0.5, 0.03, 0.5, stoveX, 0.905, CZ);                               // small two-burner stove top
  for (const x of [stoveX - 0.13, stoveX + 0.13]) { B.cyl('plain', 0x222222, 0.1, 0.1, 0.02, x, 0.93, CZ, 10); B.cyl('plain', 0x444444, 0.07, 0.07, 0.03, x, 0.94, CZ, 8); }
  B.box('plain', 0x444444, 0.26, 0.1, 0.24, stoveX - 0.13, 0.95, CZ - 0.05, 0.3);             // greasy pan
  B.cyl('plain', 0x222222, 0.02, 0.02, 0.3, stoveX - 0.25, 0.96, CZ - 0.2, 5, { ry: 0, rz: 1.2 });
  B.cyl('plain', 0xc03020, 0.08, 0.08, 0.16, stoveX + 0.3, 0.96, CZ + 0.12, 10); B.cyl('plain', 0xe8d8a0, 0.07, 0.06, 0.08, stoveX + 0.3, 0.92, CZ - 0.15, 8); B.cyl('plain', 0xe8d8a0, 0.07, 0.06, 0.08, stoveX + 0.3, 1.0, CZ - 0.15, 8); // coffee can, noodle tower
  B.box('wood', 0x8a6238, 1.75, 0.5, 0.38, -0.05, 1.75, D / 2 - 0.19, 0, { ao: false });     // overhead cabinets over sink + stove
  for (let k = 0; k < 3; k++) { B.box('plain', 0x3a2a1a, 0.52, 0.44, 0.02, -0.63 + k * 0.58, 1.75, D / 2 - 0.39, 0, { ao: false }); B.box('shiny', 0xd8c080, 0.08, 0.03, 0.03, -0.63 + k * 0.58, 1.75, D / 2 - 0.4, 0, { ao: false }); }
  solid(sinkX, CZ, 0.95, 0.6, 0.9); solid(stoveX, CZ, 0.8, 0.6, 0.9);
  // fridge against the bathroom wall, magnets and overdue notices on the door
  B.box('plain', 0xe8e4dc, 0.6, 1.7, 0.6, fridgeX, 0.85, CZ); B.box('plain', 0x3a3a3a, 0.5, 0.02, 0.02, fridgeX, 1.1, CZ - 0.31, 0, { ao: false });
  B.box('shiny', 0xcfd4d8, 0.03, 0.5, 0.03, fridgeX + 0.25, 1.45, CZ - 0.32, 0, { ao: false }); B.box('shiny', 0xcfd4d8, 0.03, 0.3, 0.03, fridgeX + 0.25, 0.8, CZ - 0.32, 0, { ao: false });
  for (let k = 0; k < 5; k++) B.box('plain', pick([0xf0e8d8, 0xffe8f0, 0xd8f0e0]), 0.08, 0.1, 0.005, fridgeX - 0.15 + rnd() * 0.3, 1.0 + rnd() * 0.6, CZ - 0.31, 0, { ao: false });
  solid(fridgeX, CZ, 0.6, 0.6, 1.7);
  // ---- living area on the slide side: sofa, recliner, coffee table with the bills, crumbs and the mug
  const SZ = -D / 2 + 0.42;
  B.box('cloth', 0x8a5a3a, 1.9, 0.42, 0.8, -0.45, 0.21, SZ); B.box('cloth', 0x9a6a46, 1.9, 0.12, 0.8, -0.45, 0.48, SZ, 0, { aoLo: 0.8 });
  B.box('cloth', 0x8a5a3a, 1.9, 0.55, 0.14, -0.45, 0.75, -D / 2 + 0.1, 0, { aoLo: 0.8 });   // sofa back
  for (const s of [-1, 1]) B.box('cloth', 0x8a5a3a, 0.14, 0.3, 0.8, -0.45 + s * 0.95, 0.65, SZ, 0, { aoLo: 0.8 }); // arms
  B.box('cloth', 0xd0c0a0, 0.4, 0.1, 0.4, -1.0, 0.59, SZ - 0.05, 0.3, { aoLo: 0.9 });       // a cushion gone flat
  B.box('wood', 0x8a6238, 0.8, 0.05, 0.45, -0.45, 0.45, SZ + 0.75); for (const s of [-1, 1]) B.box('plain', 0x8a8a8a, 0.05, 0.43, 0.4, -0.45 + s * 0.35, 0.21, SZ + 0.75); // coffee table
  for (let k = 0; k < 14; k++) B.box('plain', pick([0xe8c070, 0xd8a050, 0xf0d890]), 0.015, 0.006, 0.015, -0.45 + (rnd() - 0.5) * 0.7, 0.478, SZ + 0.75 + (rnd() - 0.5) * 0.35, rnd() * 3, { ao: false });  // crumbs
  B.box('plain', 0xf0ece0, 0.22, 0.004, 0.28, -0.6, 0.477, SZ + 0.7, 0.2, { ao: false }); B.box('plain', 0xffe8f0, 0.2, 0.004, 0.24, -0.3, 0.481, SZ + 0.8, -0.4, { ao: false });  // bills ("PAST DUE" pink one)
  const due = signTex(THREE, 'rv:due', ['FINAL', 'NOTICE'], '#ff9fb0', '#8a0020', 64, 48);
  B.def('due', { kind: 'lambert', map: due });
  B.flat('due', 0xffffff, 0.16, 0.12, -0.3, 0.484, SZ + 0.8, -0.4, { ao: false, tint: false });
  B.cyl('plain', 0xf0f0f0, 0.05, 0.045, 0.1, -0.05, 0.53, SZ + 0.65, 8); B.box('plain', 0xf0f0f0, 0.02, 0.05, 0.06, 0.01, 0.53, SZ + 0.65, 0, { ao: false });  // mug
  B.cyl('plain', 0x3a2a1a, 0.055, 0.055, 0.003, -0.7, 0.477, SZ + 0.85, 10, { ao: false });  // mug ring
  B.box('plain', 0xd8b040, 0.08, 0.14, 0.06, -0.15, 0.54, SZ + 0.85, 0.3);                   // mustard
  solid(-0.45, SZ, 1.9, 0.8, 0.54); solid(-0.45, SZ + 0.75, 0.8, 0.45, 0.48);
  // laundry basket and socks in the corridor, kibble bag slumped by the sofa
  B.cyl('plain', 0x3a6ab0, 0.3, 0.26, 0.4, -2.25, 0.2, -1.05, 8);
  for (let k = 0; k < 11; k++) B.sph('cloth', pick([0x4a4a4a, 0xd04030, 0xf0f0f0, 0x3a5a8a, 0xc8a060, 0x7a7a7a]), 0.13 + rnd() * 0.06, -2.25 + (rnd() - 0.5) * 0.5, 0.4 + rnd() * 0.15, -1.05 + (rnd() - 0.5) * 0.5, { ao: false, s: [1, 0.45, 0.8], ws: 6, hs: 4 });
  B.box('cloth', 0x3a5a8a, 0.28, 0.06, 0.4, -2.0, 0.03, -0.3, 0.6, { ao: false }); B.box('cloth', 0xf0f0f0, 0.1, 0.03, 0.18, -1.3, 0.015, 0.2, 1.2, { ao: false });
  B.box('plain', 0xe0a030, 0.3, 0.55, 0.18, -1.45, 0.27, -1.3, -0.3, { rz: 0.12 });
  solid(-2.25, -1.05, 0.6, 0.6, 0.45); solid(-1.45, -1.3, 0.35, 0.25, 0.6);
  // work boots by the door, hi-vis vest on a hook on the bathroom wall
  for (const s of [0, 1]) { B.box('plain', 0x6a4420, 0.14, 0.14, 0.3, 0.72 + s * 0.18, 0.07, 0.65, -0.1 + s * 0.3); B.box('plain', 0x4a2e14, 0.14, 0.1, 0.12, 0.72 + s * 0.18, 0.19, 0.57, -0.1 + s * 0.3); B.box('plain', 0x3a2a1a, 0.15, 0.03, 0.32, 0.72 + s * 0.18, 0.015, 0.65, -0.1 + s * 0.3, { ao: false }); }
  const vest = ctex(THREE, 'rv:vest', 32, 48, (g) => { g.clearRect(0, 0, 32, 48); g.fillStyle = '#ff8a10'; g.beginPath(); g.moveTo(4, 8); g.lineTo(11, 2); g.lineTo(16, 6); g.lineTo(21, 2); g.lineTo(28, 8); g.lineTo(28, 46); g.lineTo(4, 46); g.fill(); g.fillStyle = '#e8e8e8'; g.fillRect(4, 22, 24, 4); g.fillRect(4, 34, 24, 4); g.fillRect(8, 2, 3, 44); g.fillRect(21, 2, 3, 44); g.fillStyle = '#222'; g.fillRect(14, 8, 4, 38); }, { repeat: false });
  B.def('vest', { kind: 'lambert', map: vest, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  B.box('shiny', 0xcfd4d8, 0.08, 0.04, 0.04, -1.53, 1.75, 0.9, 0, { ao: false });
  B.quad('vest', 0xffffff, 0.5, 0.75, -1.52, 1.35, 0.9, Math.PI / 2, { ao: false, tint: false });
  // cat food bowls on a mat in front of the fridge: GOOBLES / WATER
  B.box('plain', 0x6a8a4a, 0.55, 0.01, 0.35, -1.2, 0.005, 0.6, 0, { ao: false });
  B.cyl('plain', 0xd04030, 0.11, 0.09, 0.07, -1.32, 0.035, 0.6, 10); B.cyl('plain', 0x8a5a2a, 0.09, 0.09, 0.02, -1.32, 0.07, 0.6, 10, { ao: false });
  B.cyl('plain', 0x3a6ab0, 0.11, 0.09, 0.07, -1.06, 0.035, 0.6, 10); B.cyl('shiny', 0x7ab0e0, 0.09, 0.09, 0.02, -1.06, 0.065, 0.6, 10, { ao: false });
  const bowlTag = signTex(THREE, 'rv:bowl', ['GOOBLES'], null, '#f8f8f0', 96, 24);
  B.def('bowlTag', { kind: 'basic', map: bowlTag, transparent: true, alphaTest: 0.4 });
  B.flat('bowlTag', 0xffffff, 0.5, 0.12, -1.2, 0.012, 0.73, 0, { ao: false, tint: false });
  // ---- bathroom (x -2.9..-1.6, z 0.2..1.5): tub along the outer wall, toilet, vanity with a cracked mirror
  B.box('plain', 0xf4f4f0, 0.9, 0.55, 0.55, -2.4, 0.275, D / 2 - 0.3); B.box('plain', 0xdce8f0, 0.74, 0.02, 0.4, -2.4, 0.5, D / 2 - 0.3, 0, { ao: false });   // tub with a little grey water
  B.cyl('shiny', 0xcfd4d8, 0.015, 0.015, 0.7, -2.0, 1.4, D / 2 - 0.08, 6, { ao: false }); B.box('plain', 0xc8d0d8, 0.9, 0.9, 0.02, -2.4, 1.6, D / 2 - 0.06, 0, { ao: false, tint: false }); // shower riser + curtain-less tiled wall
  B.box('plain', 0xf4f4f0, 0.4, 0.4, 0.5, -1.85, 0.2, 0.5); B.box('plain', 0xf4f4f0, 0.42, 0.14, 0.2, -1.85, 0.45, 0.68); B.cyl('plain', 0xf4f4f0, 0.2, 0.18, 0.06, -1.85, 0.43, 0.42, 10); // toilet
  B.box('plain', 0xd8d2c4, 0.35, 0.8, 0.45, -2.7, 0.4, 0.5); B.box('plain', 0x8a9298, 0.26, 0.06, 0.3, -2.7, 0.82, 0.5); B.box('shiny', 0xdfe6ee, 0.02, 0.4, 0.3, -2.87, 1.4, 0.5, 0, { ao: false }); // vanity, basin, mirror
  B.cyl('plain', 0xf4f4f0, 0.05, 0.05, 0.1, -1.6 + 0.12, 0.9, 1.3, 8); B.cyl('plain', 0xf4f4f0, 0.05, 0.05, 0.1, -1.6 + 0.12, 0.78, 1.3, 8); // spare rolls
  B.cyl('plain', 0x3a9a40, 0.0, 0.08, 0.16, -2.25, 1.7, 1.0, 3, { ao: false }); B.cyl('plain', 0x888888, 0.004, 0.004, 0.3, -2.25, 1.93, 1.0, 3, { ao: false }); // air freshener tree
  solid(-2.4, D / 2 - 0.3, 0.9, 0.55, 0.55); solid(-1.85, 0.5, 0.4, 0.55, 0.45); solid(-2.7, 0.5, 0.35, 0.45, 0.82);
  // ---- bunk room at the far end: two bunks on the end wall, a ladder, wardrobe, a window
  B.box('wood', 0x7a5634, 0.85, 0.1, 1.9, -3.65, 0.4, -0.55); B.box('cloth', 0xe8e0d0, 0.8, 0.14, 1.8, -3.65, 0.52, -0.55, 0, { aoLo: 0.8 }); B.box('blanket', 0xffffff, 0.7, 0.08, 1.3, -3.6, 0.62, -0.45, 0.05, { aoLo: 0.8 });
  B.box('wood', 0x7a5634, 0.85, 0.1, 1.9, -3.65, 1.3, -0.55); B.box('cloth', 0xe8e0d0, 0.8, 0.14, 1.8, -3.65, 1.42, -0.55, 0, { aoLo: 0.8 }); B.box('cloth', 0xc8a060, 0.7, 0.08, 1.3, -3.7, 1.52, -0.6, -0.05, { aoLo: 0.8 });
  for (const z of [-1.5, 0.4]) B.box('wood', 0x7a5634, 0.08, 1.4, 0.08, -3.25, 0.7, z);   // bunk posts
  for (let k = 0; k < 4; k++) B.box('wood', 0x8a6238, 0.3, 0.03, 0.03, -3.2, 0.55 + k * 0.25, 0.45, 0, { ao: false });   // ladder rungs
  for (const s of [-1, 1]) B.box('wood', 0x8a6238, 0.03, 1.1, 0.03, -3.2 + s * 0.15, 1.0, 0.45, 0, { ao: false });
  B.box('wood', 0x8a6238, 0.8, 1.9, 0.55, -3.7, 0.95, 1.2); B.box('plain', 0x3a2a1a, 0.02, 1.7, 0.02, -3.7, 0.95, 0.92, 0, { ao: false });   // wardrobe
  B.box('plain', 0xd04030, 0.3, 0.3, 0.3, -3.2, 0.15, 1.15); B.box('plain', 0x4a4a4a, 0.25, 0.1, 0.2, -3.2, 0.35, 1.15, 0.3);   // toolbox and a stray boot
  solid(-3.65, -0.55, 0.9, 1.9, 0.6); solid(-3.7, 1.2, 0.8, 0.55, 1.9); solid(-3.2, 1.15, 0.3, 0.3, 0.35);
  // wall stuff: calendar with the overtime days crossed off, a note from the foreman
  const cal = ctex(THREE, 'rv:cal', 64, 80, (g) => { g.fillStyle = '#f4f0e4'; g.fillRect(0, 0, 64, 80); g.fillStyle = '#2a5a9a'; g.fillRect(0, 0, 64, 26); g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('NOVEMBER', 32, 17); g.strokeStyle = '#888'; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { g.strokeRect(2 + c * 8.5, 30 + r * 9.5, 8.5, 9.5); if (rnd() < 0.7) { g.strokeStyle = '#c02020'; g.beginPath(); g.moveTo(3 + c * 8.5, 31 + r * 9.5); g.lineTo(9 + c * 8.5, 38 + r * 9.5); g.moveTo(9 + c * 8.5, 31 + r * 9.5); g.lineTo(3 + c * 8.5, 38 + r * 9.5); g.stroke(); g.strokeStyle = '#888'; } } g.fillStyle = '#c02020'; g.font = 'bold 7px sans-serif'; g.fillText('OT  OT  OT', 32, 76); }, { repeat: false });
  B.def('cal', { kind: 'lambert', map: cal });
  B.quad('cal', 0xffffff, 0.3, 0.38, 2.25, 1.5, -0.9, -Math.PI / 2, { ao: false, tint: false });   // on the bedroom wall, living side
  const note = signTex(THREE, 'rv:note', ['DOUBLE SHIFT', 'SAT.  -BOSS', '(no excuses)'], '#fff7b0', '#333', 128, 64, { font: 'sans-serif', weight: 'normal', tape: true });
  B.def('note', { kind: 'lambert', map: note });
  B.quad('note', 0xffffff, 0.3, 0.15, fridgeX + 0.05, 1.55, CZ - 0.31, 0, { ao: false, tint: false });   // taped to the fridge
  // ceiling: bare bulbs, a vent fan in the living area
  bulbLamp(B, 3.3, H - 0.12, -0.2, 0xffe0a0); bulbLamp(B, 0.9, H - 0.12, 0.3); bulbLamp(B, -0.8, H - 0.12, -0.6); bulbLamp(B, -2.25, H - 0.12, 0.85, 0xf0f0ff); bulbLamp(B, -3.5, H - 0.12, -0.2, 0xffe0a0);
  B.box('plain', 0xb8b8b0, 0.4, 0.04, 0.4, -0.2, H - 0.02, -0.6, 0, { ao: false });
  // entrance door (closed, with a cracked frosted pane) and a doormat that says the obvious
  B.quad('plain', 0xcfc8b6, 0.78, 1.88, DX, 0.95, D / 2 - 0.06, Math.PI, { ao: false, sy: 4, paint: (_x, y) => 0.6 + 0.4 * sm(y / 0.8) });
  B.quad('glow', 0x8a98a8, 0.5, 0.5, DX, 1.4, D / 2 - 0.08, Math.PI, { ao: false, tint: false }); B.box('shiny', 0xd8c080, 0.1, 0.03, 0.04, DX + 0.33, 0.95, D / 2 - 0.12, 0, { ao: false });
  const mat = signTex(THREE, 'rv:mat', ['GO AWAY'], '#6a5a40', '#e8e0c8', 96, 32);
  B.def('mat', { kind: 'lambert', map: mat });
  B.flat('mat', 0xffffff, 0.6, 0.35, DX, 0.006, D / 2 - 0.45, 0, { ao: false, tint: false });

  const group = B.finish(new THREE.Group());
  return {
    group, size: [W, D], cols, floors: [],
    spawn: { x: DX, z: 0.9, yaw: 0 },
    exit: { x: DX, z: D / 2 + 0.05, r: 0.55 },
    lights: [
      { x: 0.9, y: H - 0.2, z: 0.3, c: 0xffe8c0, i: 0.9, always: true },
      { x: -0.8, y: H - 0.2, z: -0.6, c: 0xffe8c0, i: 0.8, always: true },
      { x: 3.3, y: H - 0.2, z: -0.2, c: 0xffd8a0, i: 0.6, always: true },
      { x: -2.25, y: H - 0.2, z: 0.85, c: 0xe8f0ff, i: 0.5, always: true },
      { x: -3.5, y: H - 0.2, z: -0.2, c: 0xffd8a0, i: 0.5, always: true },
    ],
    cam: { maxDist: 3.2, height: 1.8 },
    interact: [
      { id: 'bed', x: 3.0, z: -0.25, r: 0.9, label: 'Sleep (save)' },
      { id: 'nap', x: -3.3, z: -0.55, r: 0.7, label: 'Nap on the bunk (save)' },
      { id: 'bowl', x: -1.2, z: 0.6, r: 0.55, label: 'Kibble' },
    ],
  };
}

// =====================================================================================================
// 2. Quik Stop: convenience store, 10 x 8 m, 3 m drop ceiling. Counter left, coolers at the back,
//    two gondola shelves in the middle, slushie machine and the water-gun bin on the right.
// =====================================================================================================
function buildQuik(ctx) {
  const { THREE, T } = ctx; seed = 23;
  const B = makeBuilder(THREE, T);
  const W = 10, D = 8, H = 3.0;
  const tile = ctex(THREE, 'q:tile', 64, 64, (g) => {
    g.fillStyle = '#c9c6bc'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 32) { g.fillStyle = ((x + y) / 32) % 2 ? '#c2bfb4' : '#cfccc2'; g.fillRect(x, y, 32, 32); }
    g.strokeStyle = 'rgba(60,60,60,0.5)'; g.lineWidth = 1; for (let k = 0; k <= 64; k += 32) { g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, 64); g.moveTo(0, k + 0.5); g.lineTo(64, k + 0.5); g.stroke(); }
    grime(g, 64, 64, 260, 0.22); g.fillStyle = 'rgba(40,30,20,0.25)'; g.fillRect(10, 40, 14, 6);
  });
  const wallp = ctex(THREE, 'q:wall', 64, 64, (g) => { g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, 64, 64); grime(g, 64, 64, 80, 0.12); });
  const ceil = ctex(THREE, 'q:ceil', 64, 64, (g) => { g.fillStyle = '#d8d6cc'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#8a8880'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } g.fillStyle = 'rgba(120,90,40,0.35)'; g.beginPath(); g.arc(44, 20, 9, 0, 7); g.fill(); });
  B.def('tile', { kind: 'lambert', map: tile }); B.def('wallp', { kind: 'lambert', map: wallp }); B.def('ceil', { kind: 'lambert', map: ceil });
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'tile', wallKey: 'wallp', ceilKey: 'ceil', ceilCol: 0xffffff, door: { x: 1.0, w: 1.1, h: 2.1 }, base: 0x3a3a3a, frame: 0x8a8a90, wallTile: 2, floorTile: 1, trim: { c: 0xd03030, y: 1.9, h: 0.12 } });
  // storefront glass on the front wall either side of the door (night outside, our own reflection-free glass)
  const night = ctex(THREE, 'q:night', 64, 32, (g) => { g.fillStyle = '#0e1424'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#243052'; g.fillRect(0, 24, 64, 8); g.fillStyle = '#f0c040'; g.fillRect(50, 20, 6, 3); g.fillStyle = '#e03030'; g.fillRect(8, 16, 10, 2); }, { repeat: false });
  B.def('night', { kind: 'basic', map: night });
  for (const x of [-3.6, -1.4, 3.0]) { B.quad('night', 0xffffff, 1.9, 1.4, x, 1.6, D / 2 - 0.02, Math.PI, { ao: false, tint: false }); for (const y of [2.33, 0.87]) B.quad('plain', 0x8a8a90, 2.0, 0.06, x, y, D / 2 - 0.03, Math.PI, { ao: false, tint: false }); }
  // taped-up signs on the glass
  const s1 = signTex(THREE, 'q:s1', ['NO SHIRT', 'NO SHOES', 'NO PAWS ON', 'THE GLASS'], '#fff8c0', '#202020', 128, 96, { tape: true });
  const s2 = signTex(THREE, 'q:s2', ['RESTROOM', 'KEY AT', 'COUNTER', '(it is a hubcap)'], '#fff', '#202020', 128, 96, { tape: true, font: 'sans-serif' });
  B.def('s1', { kind: 'lambert', map: s1 }); B.def('s2', { kind: 'lambert', map: s2 });
  B.quad('s1', 0xffffff, 0.5, 0.38, -3.9, 1.55, D / 2 - 0.05, Math.PI, { ao: false, tint: false });
  B.quad('s2', 0xffffff, 0.45, 0.34, 3.4, 1.5, D / 2 - 0.05, Math.PI, { ao: false, tint: false });
  // door: glass door quad with push bar, inward facing
  B.quad('night', 0xb0c0d0, 1.0, 2.0, 1.0, 1.05, D / 2 - 0.05, Math.PI, { ao: false, tint: false });
  B.quad('shiny', 0xc8ccd4, 0.9, 0.05, 1.0, 1.0, D / 2 - 0.1, Math.PI, { ao: false, tint: false });
  const hrs = signTex(THREE, 'q:hrs', ['OPEN', '24 HRS', '(mostly)'], '#e03030', '#ffffff', 96, 72);
  B.def('hrs', { kind: 'basic', map: hrs }); B.quad('hrs', 0xffffff, 0.4, 0.3, 1.0, 1.75, D / 2 - 0.07, Math.PI, { ao: false, tint: false });

  // --- cooler wall along the back: 6 glass doors glowing cold, product rows painted inside
  const coolerTex = ctex(THREE, 'q:cooler', 64, 128, (g) => {
    g.fillStyle = '#dff4ff'; g.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 4; r++) { g.fillStyle = '#b8d8e8'; g.fillRect(0, 28 + r * 26, 64, 3); const cs = [['#e03030', '#f0f0f0'], ['#2a60c0', '#f0f0f0'], ['#30a040', '#e8e8a0'], ['#f0a020', '#f0f0f0'], ['#8a30c0', '#f0f0f0']]; for (let i = 0; i < 6; i++) { const c = cs[(r * 2 + i) % cs.length]; g.fillStyle = c[0]; g.fillRect(3 + i * 10, 8 + r * 26, 8, 20); g.fillStyle = c[1]; g.fillRect(5 + i * 10, 14 + r * 26, 4, 6); } }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 64, 4); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 124, 64, 4);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(rnd() * 64, rnd() * 128, 1, 2); } // frost
  }, { repeat: false });
  B.def('cooler', { kind: 'basic', map: coolerTex });
  B.box('plain', 0x2a2a30, 8.4, 2.5, 0.7, 0, 1.25, -D / 2 + 0.36);
  for (let k = 0; k < 6; k++) {
    const x = -3.5 + k * 1.4;
    B.quad('cooler', 0xffffff, 1.22, 2.0, x, 1.15, -D / 2 + 0.72, 0, { ao: false, tint: false });
    B.box('shiny', 0xc8ccd4, 1.3, 0.06, 0.03, x, 2.17, -D / 2 + 0.73, 0, { ao: false }); B.box('shiny', 0xc8ccd4, 1.3, 0.06, 0.03, x, 0.13, -D / 2 + 0.73, 0, { ao: false }); B.box('shiny', 0xc8ccd4, 0.04, 2.1, 0.03, x - 0.65, 1.15, -D / 2 + 0.73, 0, { ao: false });
    B.box('plain', 0x222222, 0.04, 0.5, 0.05, x + 0.5, 1.15, -D / 2 + 0.76, 0, { ao: false });    // handle
  }
  const cold = signTex(THREE, 'q:cold', ['COLD DRINKS  *  ICE  *  BAIT'], '#1a4a8a', '#dff4ff', 512, 48, { glow: true });
  B.def('cold', { kind: 'basic', map: cold }); B.quad('cold', 0xffffff, 8.0, 0.4, 0, 2.5, -D / 2 + 0.73, 0, { ao: false, tint: false });
  // --- counter (left wall) with register, scratchers case, jerky jar, penny tray, chip clip rack
  B.box('plain', 0x8a3a3a, 0.9, 1.0, 3.6, -4.1, 0.5, 0.2); B.box('shiny', 0xd8d4c8, 1.0, 0.06, 3.7, -4.1, 1.03, 0.2, 0, { ao: false });
  B.box('plain', 0x3a3a3a, 0.9, 0.3, 3.6, -4.1, 0.15, 0.2, 0, { ao: false });                          // kick
  B.box('plain', 0xdcdcd4, 0.4, 0.25, 0.4, -4.2, 1.19, -0.6, 0.15); B.box('plain', 0x222222, 0.36, 0.2, 0.06, -4.1, 1.42, -0.75, 0.15); B.quad('glow', 0x60ff80, 0.3, 0.14, -3.98, 1.42, -0.73, Math.PI / 2 + 0.15, { ao: false, tint: false }); // register
  B.box('glass', 0xcfe8ff, 0.5, 0.3, 0.9, -4.0, 1.21, 0.6); B.box('plain', 0x333333, 0.52, 0.03, 0.92, -4.0, 1.07, 0.6, 0, { ao: false });
  for (let k = 0; k < 8; k++) B.box('plain', pick([0xf0d020, 0x30c060, 0xf04080, 0x40a0f0, 0xf08020]), 0.08, 0.004, 0.16, -4.15 + (k % 2) * 0.2, 1.09, 0.25 + ((k / 2) | 0) * 0.2, 0.1, { ao: false }); // scratchers
  const lotto = signTex(THREE, 'q:lotto', ['SCRATCH', 'N  DASH', 'win up to $40'], '#f0d020', '#a01010', 96, 72);
  B.def('lotto', { kind: 'lambert', map: lotto }); B.quad('lotto', 0xffffff, 0.3, 0.22, -3.74, 1.2, 0.6, Math.PI / 2, { ao: false, tint: false });
  B.cyl('glass', 0xffe8c0, 0.12, 0.12, 0.3, -4.2, 1.21, 1.4, 10); for (let k = 0; k < 6; k++) B.box('plain', 0x5a2a10, 0.03, 0.26, 0.012, -4.2 + (rnd() - 0.5) * 0.12, 1.19, 1.4 + (rnd() - 0.5) * 0.12, rnd() * 3, { ao: false }); // jerky
  B.cyl('plain', 0x9a8a60, 0.07, 0.07, 0.03, -3.85, 1.08, 1.7, 8, { ao: false }); // penny tray
  // back wall behind the counter: rack of lighters/phone cards + "WE ID" sign + a hubcap on a string (the restroom key)
  B.box('wood', 0x8a6a4a, 0.3, 1.4, 3.0, -4.85, 1.9, 0.2);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) B.box('plain', pick([0xf04040, 0x40c0f0, 0xf0e040, 0x40d060, 0xf0f0f0, 0xf080c0]), 0.06, 0.16, 0.2, -4.68, 1.35 + r * 0.32, -1.15 + k * 0.3, 0, { ao: false });
  const weid = signTex(THREE, 'q:weid', ['WE CARD', 'EVERYONE', 'even you, Earl'], '#1a1a1a', '#f0e040', 128, 72);
  B.def('weid', { kind: 'lambert', map: weid }); B.quad('weid', 0xffffff, 0.6, 0.34, -W / 2 + 0.02, 2.75, 0.2, Math.PI / 2, { ao: false, tint: false });
  B.cyl('shiny', 0xb8bcc4, 0.18, 0.18, 0.03, -4.0, 1.3, 2.3, 10, { ao: false, rz: Math.PI / 2 }); B.box('plain', 0x8a6a4a, 0.01, 0.4, 0.01, -4.0, 1.6, 2.3, 0, { ao: false });
  // --- gondola shelves x2 (double sided) packed with generic snacks
  const snack = [0xf0c020, 0xe04030, 0x30a0e0, 0x40c050, 0xf07020, 0xf0f0f0, 0x8a40c0, 0xd0a060];
  const gondola = (gx) => {
    B.box('plain', 0xd8d8d0, 1.0, 1.5, 4.2, gx, 0.75, 0.3, 0, { aoLo: 0.5 });
    B.box('plain', 0x3a3a3a, 1.0, 0.12, 4.2, gx, 0.06, 0.3, 0, { ao: false });
    const end = signTex(THREE, 'q:end' + gx, gx < 0 ? ['CHIPS', '2 for $5', '(or 1 for $4)'] : ['CANDY', 'ASK US', 'ABOUT JERKY'], gx < 0 ? '#e03030' : '#2a60c0', '#fff', 96, 96);
    B.def('end' + gx, { kind: 'lambert', map: end }); B.quad('end' + gx, 0xffffff, 0.8, 0.8, gx, 1.0, 2.42, 0, { ao: false, tint: false });
    for (const side of [-1, 1]) for (let lvl = 0; lvl < 3; lvl++) {
      const y = 0.5 + lvl * 0.45;
      B.box('plain', 0xc8c8c0, 0.45, 0.03, 4.1, gx + side * 0.6, y - 0.02, 0.3, 0, { ao: false });
      let z = -1.65;
      while (z < 2.2) {
        const w = 0.14 + rnd() * 0.16, h = 0.2 + rnd() * 0.18, kind = rnd();
        const c = pick(snack), x = gx + side * (0.6 + 0.08 * rnd());
        if (kind < 0.55) B.box('plain', c, 0.16, h, w, x, y + h / 2, z + w / 2, (rnd() - 0.5) * 0.3, { ao: false, tint: false });          // bag
        else if (kind < 0.85) B.box('plain', c, 0.22, h * 0.9, w, x, y + h * 0.45, z + w / 2, 0, { ao: false, tint: false });                  // box
        else B.cyl('plain', c, 0.06, 0.06, h * 0.8, x, y + h * 0.4, z + w / 2, 8, { ao: false, tint: false });                                   // can
        z += w + 0.03;
      }
    }
  };
  gondola(-1.3); gondola(1.3);
  // --- slushie machine on the right wall: two glowing tanks swirling, drip tray, cups
  B.box('plain', 0xe8e8e0, 1.0, 0.9, 0.7, 4.4, 0.45, -1.6); B.box('plain', 0x3a3a3a, 1.0, 0.5, 0.7, 4.4, 1.15, -1.6);
  B.cyl('glow', 0xff3060, 0.2, 0.17, 0.5, 4.15, 1.65, -1.6, 10, { ao: false, tint: false }); B.cyl('glow', 0x3080ff, 0.2, 0.17, 0.5, 4.65, 1.65, -1.6, 10, { ao: false, tint: false });
  B.cyl('plain', 0x222222, 0.22, 0.22, 0.05, 4.15, 1.92, -1.6, 10, { ao: false }); B.cyl('plain', 0x222222, 0.22, 0.22, 0.05, 4.65, 1.92, -1.6, 10, { ao: false });
  for (const x of [4.15, 4.65]) B.box('plain', 0x222222, 0.04, 0.12, 0.06, x, 1.3, -1.25, 0, { ao: false });
  const slush = signTex(THREE, 'q:slush', ['BRAIN', 'FREEZER'], '#1a1a30', '#60f0ff', 96, 64, { glow: true });
  B.def('slush', { kind: 'basic', map: slush }); B.quad('slush', 0xffffff, 0.8, 0.5, W / 2 - 0.02, 2.4, -1.6, -Math.PI / 2, { ao: false, tint: false });
  for (let k = 0; k < 4; k++) B.cyl('plain', 0xf0f0f0, 0.06, 0.05, 0.16, 4.1 + k * 0.17, 0.98, -1.1, 8, { ao: false });
  B.box('plain', 0x6a2a8a, 0.05, 0.05, 0.05, 4.4, 0.0, -1.0, 0, { ao: false }); B.flat('plain', 0x8a3aa0, 0.4, 0.25, 4.3, 0.004, -1.0, 0.5, { ao: false }); // the spill
  // coffee station + roller grill on the right wall front half
  B.box('plain', 0xd8d4c8, 1.2, 0.9, 0.6, 4.4, 0.45, 1.2); B.box('shiny', 0xcfcfc8, 1.22, 0.04, 0.62, 4.4, 0.92, 1.2, 0, { ao: false });
  B.box('plain', 0x222222, 0.3, 0.4, 0.3, 4.6, 1.14, 0.9); B.cyl('glass', 0x6a3a1a, 0.08, 0.07, 0.16, 4.6, 1.0, 0.72, 10, { ao: false });
  B.box('shiny', 0xcfcfc8, 0.5, 0.12, 0.4, 4.45, 1.0, 1.5); for (let k = 0; k < 5; k++) B.cyl('shiny', 0xd8d8d8, 0.012, 0.012, 0.5, 4.45, 1.07, 1.33 + k * 0.08, 5, { rz: Math.PI / 2, ao: false });
  for (let k = 0; k < 3; k++) B.cyl('plain', 0xb04a30, 0.025, 0.025, 0.14, 4.45, 1.1, 1.38 + k * 0.1, 6, { rz: Math.PI / 2, ao: false }); // three sad hot dogs
  const dogs = signTex(THREE, 'q:dogs', ['HOT DOGS', '2 for $3', 'made fresh (tues)'], '#f0e0a0', '#8a2010', 128, 64);
  B.def('dogs', { kind: 'lambert', map: dogs }); B.quad('dogs', 0xffffff, 0.5, 0.25, W / 2 - 0.02, 1.7, 1.2, -Math.PI / 2, { ao: false, tint: false });
  // --- water-gun display: cardboard bin by the door bursting with neon blasters
  B.box('plain', 0xc8a060, 0.9, 0.8, 0.9, 3.4, 0.4, 2.8); B.box('plain', 0x2a60c0, 0.92, 0.3, 0.92, 3.4, 0.6, 2.8, 0, { ao: false });
  const neon = [0x40ff60, 0xff40c0, 0x40e0ff, 0xffe040, 0xff7020];
  for (let k = 0; k < 9; k++) { const c = pick(neon), x = 3.4 + (rnd() - 0.5) * 0.6, z = 2.8 + (rnd() - 0.5) * 0.6, a = rnd() * 6, y = 0.8 + rnd() * 0.15; B.box('plain', c, 0.36, 0.08, 0.07, x, y, z, a, { ao: false, tint: false }); B.cyl('plain', c, 0.07, 0.07, 0.14, x - Math.cos(a) * 0.08, y + 0.06, z + Math.sin(a) * 0.08, 8, { ao: false, tint: false }); B.box('plain', 0x333333, 0.06, 0.1, 0.05, x + Math.cos(a) * 0.1, y - 0.05, z - Math.sin(a) * 0.1, a, { ao: false }); }
  const soak = signTex(THREE, 'q:soak', ['SUPER', 'SOAKIN', 'BLASTERS', 'summer clearance', '(it is november)'], '#2a60c0', '#ffe040', 128, 128);
  B.def('soak', { kind: 'lambert', map: soak }); B.box('plain', 0xc8a060, 0.9, 0.7, 0.03, 3.4, 1.4, 2.4, 0, { ao: false }); B.quad('soak', 0xffffff, 0.84, 0.64, 3.4, 1.4, 2.42, 0, { ao: false, tint: false });
  // magazine rack + lost cat poster by the door, ATM
  B.box('plain', 0x3a3a3a, 0.9, 1.4, 0.3, -1.8, 0.7, 3.6); for (let k = 0; k < 6; k++) B.box('plain', pick(snack), 0.22, 0.3, 0.04, -2.1 + (k % 3) * 0.3, 0.55 + ((k / 3) | 0) * 0.5, 3.43, 0, { ao: false });
  B.def('posterCat', { kind: 'lambert', map: T && T.posterCat }); if (T && T.posterCat) B.quad('posterCat', 0xffffff, 0.4, 0.6, -W / 2 + 0.02, 1.5, 2.6, Math.PI / 2, { ao: false, tint: false });
  B.box('plain', 0x3a5a8a, 0.6, 1.5, 0.5, -4.6, 0.75, 3.3); B.quad('glow', 0x40a0ff, 0.3, 0.2, -4.6, 1.3, 3.56, 0, { ao: false, tint: false });
  const atm = signTex(THREE, 'q:atm', ['CASH', '$4.50 fee'], '#1a3a6a', '#fff', 64, 40);
  B.def('atm', { kind: 'basic', map: atm }); B.quad('atm', 0xffffff, 0.4, 0.25, -4.6, 1.0, 3.56, 0, { ao: false, tint: false });
  // ceiling: 3 rows of fluorescent tubes, the middle-front one half dead; a dome mirror
  for (const z of [-2.4, 0.2, 2.6]) for (const x of [-2.6, 2.0]) tubeLight(B, x, H - 0.1, z, 1.2, 0, 0xf4f8ff);
  B.sph('shiny', 0x9aa0a8, 0.25, 4.2, H - 0.1, -3.4, { ao: false, s: [1, 0.5, 1] });
  // flickering tube is its own mesh so we can animate it
  const group = B.finish(new THREE.Group());
  const flick = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.09), new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
  flick.position.set(-0.3, H - 0.1, 2.6); group.add(flick);
  B.box('plain', 0xd0d0d0, 1.3, 0.08, 0.3, -0.3, H - 0.05, 2.6, 0, { ao: false });
  const update = (t) => { const on = Math.sin(t * 23) + Math.sin(t * 7.3) > 0.4; flick.material.color.setHex(on ? 0xf4f8ff : 0x30342a); };
  cols.push(
    { kind: 'box', cx: 0, cz: -D / 2 + 0.4, w: 8.6, d: 0.8, rot: 0, h: 2.5 },      // coolers
    { kind: 'box', cx: -4.1, cz: 0.2, w: 1.0, d: 3.7, rot: 0, h: 1.06 },           // counter (standable)
    { kind: 'box', cx: -4.85, cz: 0.2, w: 0.3, d: 3.0, rot: 0, h: 2.6 },           // back rack
    { kind: 'box', cx: -1.3, cz: 0.3, w: 1.0, d: 4.2, rot: 0, h: 1.5 },            // gondola 1
    { kind: 'box', cx: 1.3, cz: 0.3, w: 1.0, d: 4.2, rot: 0, h: 1.5 },             // gondola 2
    { kind: 'box', cx: 4.4, cz: -1.6, w: 1.0, d: 0.7, rot: 0, h: 1.9 },            // slushie
    { kind: 'box', cx: 4.4, cz: 1.2, w: 1.2, d: 0.6, rot: 0, h: 1.0 },             // coffee station
    { kind: 'box', cx: 3.4, cz: 2.8, w: 0.9, d: 0.9, rot: 0, h: 0.8 },             // water-gun bin
    { kind: 'box', cx: -1.8, cz: 3.6, w: 0.9, d: 0.3, rot: 0, h: 1.4 },            // magazine rack
    { kind: 'box', cx: -4.6, cz: 3.3, w: 0.6, d: 0.5, rot: 0, h: 1.5 },            // ATM
  );
  return {
    group, size: [W, D], cols, floors: [],
    spawn: { x: 1.0, z: 2.9, yaw: 0 },
    exit: { x: 1.0, z: D / 2 + 0.05, r: 0.6 },
    lights: [
      { x: -2.6, y: H - 0.3, z: -2.4, c: 0xeef4ff, i: 0.9, always: true },
      { x: 2.0, y: H - 0.3, z: 0.2, c: 0xeef4ff, i: 0.9, always: true },
      { x: -2.6, y: H - 0.3, z: 2.6, c: 0xeef4ff, i: 0.8, always: true },
      { x: 0, y: 1.6, z: -3.0, c: 0x9fd8ff, i: 1.0, always: true },           // cooler glow
      { x: 4.2, y: 1.8, z: -1.6, c: 0xff60a0, i: 0.5, always: true },         // slushie neon
    ],
    cam: { maxDist: 4.5, height: 2.2 },
    interact: [
      { id: 'counter', x: -3.2, z: 0.0, r: 1.0, label: 'Shop' },
      { id: 'slushie', x: 3.6, z: -1.6, r: 0.8, label: 'Brain Freezer' },
    ],
    update,
  };
}

// =====================================================================================================
// 3. Rosie's Diner: 12 x 8 m railcar diner. Counter + stools along the back, booths down both sides,
//    pie case, jukebox in the right-front corner, neon clock over the pass-through.
// =====================================================================================================
function buildDiner(ctx) {
  const { THREE, T } = ctx; seed = 37;
  const B = makeBuilder(THREE, T);
  const W = 12, D = 8, H = 2.9;
  const checker = ctex(THREE, 'd:floor', 64, 64, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#1c1c20' : '#e8e4dc'; g.fillRect(x * 32, y * 32, 32, 32); }
    grime(g, 64, 64, 200, 0.18); grime(g, 64, 64, 60, 0.12, false);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k <= 64; k += 32) { g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, 64); g.moveTo(0, k + 0.5); g.lineTo(64, k + 0.5); g.stroke(); }
  });
  const dwall = ctex(THREE, 'd:wall', 64, 64, (g) => {
    g.fillStyle = '#f4ead2'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#d8d8dc'; g.fillRect(0, 36, 64, 28);                    // stainless wainscot (lower 40%)
    for (let y = 38; y < 64; y += 3) { g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.2})`; g.fillRect(0, y, 64, 1); }
    g.fillStyle = '#c8282e'; g.fillRect(0, 33, 64, 3); g.fillStyle = '#2a2a30'; g.fillRect(0, 36, 64, 1);
    grime(g, 64, 36, 40, 0.08);
  });
  const dceil = ctex(THREE, 'd:ceil', 64, 64, (g) => { g.fillStyle = '#efe6d0'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d8ccb0'; for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 2); grime(g, 64, 64, 40, 0.1); });
  B.def('checker', { kind: 'lambert', map: checker }); B.def('dwall', { kind: 'lambert', map: dwall }); B.def('dceil', { kind: 'lambert', map: dceil });
  const door = { x: 4.2, w: 1.0, h: 2.1 };
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'checker', wallKey: 'dwall', ceilKey: 'dceil', ceilCol: 0xffffff, door, base: 0x2a2a30, frame: 0xc8282e, wallTile: 2.9, floorTile: 1 });
  // front wall windows (street side) with half curtains; dark night outside with the neon sign's pink spill
  const night = ctex(THREE, 'd:night', 64, 32, (g) => { g.fillStyle = '#121626'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#2a2444'; g.fillRect(0, 22, 64, 10); g.fillStyle = 'rgba(255,74,106,0.35)'; g.fillRect(0, 0, 64, 10); g.fillStyle = '#f0d060'; g.fillRect(12, 18, 4, 3); g.fillRect(40, 17, 5, 3); }, { repeat: false });
  B.def('night', { kind: 'basic', map: night });
  const curt = ctex(THREE, 'd:curt', 32, 32, (g) => { g.fillStyle = '#f0e0c0'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#c8282e'; for (let x = 0; x < 32; x += 8) for (let y = 0; y < 32; y += 8) g.fillRect(x + (y % 16 ? 4 : 0), y, 2, 2); });
  B.def('curt', { kind: 'lambert', map: curt });
  for (const x of [-5, -3, -1, 1, 3]) {
    B.quad('night', 0xffffff, 1.7, 1.2, x, 1.75, D / 2 - 0.02, Math.PI, { ao: false, tint: false });
    B.quad('plain', 0xd8d8dc, 1.8, 0.06, x, 2.38, D / 2 - 0.03, Math.PI, { ao: false, tint: false }); B.quad('plain', 0xd8d8dc, 1.8, 0.06, x, 1.12, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
    B.quad('curt', 0xffffff, 1.7, 0.5, x, 1.4, D / 2 - 0.05, Math.PI, { ao: false, sx: 3, paint: (_x, y) => 0.8 + 0.2 * sm((y - 1.15) / 0.5) });
  }
  const openSign = signTex(THREE, 'd:open', ['OPEN'], null, '#40ff80', 96, 40, { glow: true });
  B.def('openSign', { kind: 'basic', map: openSign, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  B.quad('openSign', 0xffffff, 0.6, 0.25, 2.9, 2.2, D / 2 - 0.08, Math.PI, { ao: false, tint: false });
  // door: red with a round porthole, inward facing
  B.quad('plain', 0xc8282e, 0.96, 2.05, door.x, 1.03, D / 2 - 0.04, Math.PI, { ao: false, sy: 4, paint: (_x, y) => 0.6 + 0.4 * sm(y / 0.8) });
  B.cyl('night', 0xffffff, 0.22, 0.22, 0.02, door.x, 1.5, D / 2 - 0.07, 14, { ao: false, tint: false, rx: Math.PI / 2 });
  B.quad('shiny', 0xd8dce4, 0.5, 0.04, door.x, 1.0, D / 2 - 0.07, Math.PI, { ao: false, tint: false });
  // --- counter along the back: red-topped bar, chrome edge, kick, 7 stools
  B.box('plain', 0xe8e4dc, 7.8, 0.95, 0.7, -0.5, 0.475, -2.3); B.box('plain', 0xc8282e, 7.9, 0.06, 0.8, -0.5, 1.0, -2.3, 0, { ao: false }); B.box('shiny', C.chrome, 7.92, 0.03, 0.82, -0.5, 0.965, -2.3, 0, { ao: false });
  B.box('shiny', C.chrome, 7.8, 0.12, 0.72, -0.5, 0.06, -2.3, 0, { ao: false });
  for (let k = 0; k < 7; k++) {
    const x = -3.6 + k * 1.05;
    B.cyl('shiny', C.chrome, 0.05, 0.05, 0.55, x, 0.3, -1.5, 8); B.cyl('shiny', C.chrome, 0.18, 0.2, 0.04, x, 0.02, -1.5, 10, { ao: false });
    B.cyl('cloth', k === 3 ? 0x8a8a8a : C.vinylRed, 0.2, 0.18, 0.1, x, 0.6, -1.5, 12, { ao: false }); // one stool is duct-taped grey
    if (k === 3) B.box('plain', 0x9a9a9a, 0.42, 0.02, 0.06, x, 0.65, -1.5, 0.4, { ao: false });
  }
  // on the counter: napkin dispensers, ketchup + mustard, sugar, a slice of pie, tip jar, coffee mugs
  for (const x of [-3.2, -0.6, 2.0]) { B.box('shiny', C.chrome, 0.12, 0.14, 0.16, x, 1.1, -2.4); B.cyl('plain', 0xd02020, 0.03, 0.03, 0.14, x + 0.2, 1.1, -2.45, 8, { ao: false }); B.cyl('plain', 0xe8c020, 0.03, 0.03, 0.14, x + 0.28, 1.1, -2.4, 8, { ao: false }); B.cyl('glass', 0xffffff, 0.035, 0.035, 0.1, x + 0.12, 1.08, -2.55, 8, { ao: false }); }
  B.cyl('glass', 0xdfefff, 0.1, 0.09, 0.22, 1.2, 1.14, -2.35, 10, { ao: false }); for (let k = 0; k < 4; k++) B.box('plain', 0x6a9a50, 0.06, 0.003, 0.025, 1.2 + (rnd() - 0.5) * 0.08, 1.04 + k * 0.004, -2.35 + (rnd() - 0.5) * 0.08, rnd() * 3, { ao: false });
  const tip = signTex(THREE, 'd:tip', ['TIPS', '(college fund', 'for the cat)'], '#fff', '#222', 64, 48, { font: 'sans-serif' });
  B.def('tip', { kind: 'lambert', map: tip }); B.quad('tip', 0xffffff, 0.16, 0.12, 1.2, 1.14, -2.24, 0, { ao: false, tint: false });
  for (const [x, z] of [[-1.6, -2.15], [0.4, -2.2]]) { B.cyl('plain', 0xf4f0e8, 0.045, 0.04, 0.09, x, 1.075, z, 8, { ao: false }); B.cyl('plain', 0x3a2410, 0.035, 0.035, 0.01, x, 1.115, z, 8, { ao: false }); }
  B.box('plain', 0xf4f0e8, 0.2, 0.01, 0.2, -2.2, 1.035, -2.2, 0.3, { ao: false }); B.box('plain', 0xd89040, 0.12, 0.05, 0.1, -2.2, 1.065, -2.2, 0.8, { ao: false }); B.box('plain', 0xf8f0d8, 0.05, 0.03, 0.05, -2.2, 1.1, -2.2, 0, { ao: false });
  // --- back bar: shelf wall, coffee makers, milkshake mixer, pie case, pass-through window + bell, menu board
  B.box('plain', 0xe8e4dc, 8.4, 0.9, 0.55, -0.5, 0.45, -D / 2 + 0.3); B.box('shiny', C.chrome, 8.4, 0.04, 0.6, -0.5, 0.92, -D / 2 + 0.3, 0, { ao: false });
  B.box('plain', 0x222222, 0.3, 0.4, 0.3, -3.8, 1.14, -D / 2 + 0.3); for (const x of [-3.5, -3.3]) B.cyl('glass', 0x6a3a1a, 0.08, 0.07, 0.15, x, 1.02, -D / 2 + 0.45, 10, { ao: false });
  B.cyl('shiny', 0x8fd0b0, 0.08, 0.1, 0.4, -2.6, 1.15, -D / 2 + 0.3, 10, { ao: false }); B.cyl('shiny', C.chrome, 0.06, 0.06, 0.25, -2.6, 1.3, -D / 2 + 0.45, 10, { ao: false }); // mixer
  B.box('glass', 0xe8f4ff, 1.4, 0.7, 0.5, 1.6, 1.3, -D / 2 + 0.3); B.box('shiny', C.chrome, 1.42, 0.03, 0.52, 1.6, 0.95, -D / 2 + 0.3, 0, { ao: false }); B.box('shiny', C.chrome, 1.42, 0.03, 0.52, 1.6, 1.65, -D / 2 + 0.3, 0, { ao: false }); B.box('shiny', C.chrome, 1.42, 0.02, 0.5, 1.6, 1.3, -D / 2 + 0.3, 0, { ao: false });
  for (let k = 0; k < 6; k++) { const x = 1.1 + (k % 3) * 0.5, y = k < 3 ? 1.0 : 1.34, c = pick([0xd89040, 0xc85030, 0xf0e0b0, 0x8a3a60]); B.cyl('plain', c, 0.17, 0.15, 0.07, x, y + 0.035, -D / 2 + 0.3, 12, { ao: false }); B.cyl('plain', 0xf0d8a0, 0.17, 0.17, 0.01, x, y + 0.075, -D / 2 + 0.3, 12, { ao: false }); }
  const pie = signTex(THREE, 'd:pie', ['PIE OF THE DAY', 'RHUBARB', '(again. sorry.)'], '#fff8e0', '#8a2020', 128, 72, { font: 'sans-serif' });
  B.def('pie', { kind: 'lambert', map: pie }); B.quad('pie', 0xffffff, 0.5, 0.28, 2.6, 1.15, -D / 2 + 0.56, 0, { ao: false, tint: false });
  // pass-through to the kitchen: dark opening with a warm glow, order-up bell, tickets on a wheel
  B.quad('glow', 0x3a2410, 1.6, 0.9, -0.9, 1.75, -D / 2 + 0.03, 0, { ao: false, tint: false }); B.quad('glow', 0xffb060, 1.6, 0.12, -0.9, 2.14, -D / 2 + 0.035, 0, { ao: false, tint: false });
  B.box('shiny', C.chrome, 1.7, 0.05, 0.3, -0.9, 1.28, -D / 2 + 0.15, 0, { ao: false }); B.cyl('shiny', 0xd8c080, 0.06, 0.07, 0.06, -1.5, 1.34, -D / 2 + 0.2, 10, { ao: false });
  B.cyl('plain', 0x444444, 0.1, 0.1, 0.02, -0.3, 1.9, -D / 2 + 0.2, 10, { ao: false, rx: Math.PI / 2 }); for (let k = 0; k < 4; k++) B.box('plain', 0xffffff, 0.06, 0.1, 0.004, -0.3 + Math.cos(k * 1.5) * 0.13, 1.9 + Math.sin(k * 1.5) * 0.13, -D / 2 + 0.22, 0, { ao: false });
  const menu = ctex(THREE, 'd:menu', 256, 128, (g) => {
    g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#c8282e'; g.fillRect(0, 0, 256, 22);
    textLines(g, ["ROSIE'S  -  EAT HERE OR DON'T"], 128, 11, 0, 'bold 14px Impact, sans-serif', '#fff');
    const items = [['MEATLOAF MONDAY', '7.99'], ['TUNA MELT (the usual)', '5.49'], ['BOTTOMLESS COFFEE', '1.00'], ['SLAB O PIE', '2.75'], ['BOWL OF MILK', 'free*']];
    g.font = '11px monospace'; g.textAlign = 'left'; g.fillStyle = '#f4ead2'; items.forEach(([n, p], i) => { g.fillText(n, 10, 42 + i * 16); g.textAlign = 'right'; g.fillText(p, 246, 42 + i * 16); g.textAlign = 'left'; });
    g.font = '8px monospace'; g.fillText('*for cats who say please', 10, 122);
  }, { repeat: false });
  B.def('menu', { kind: 'lambert', map: menu }); B.box('plain', 0x222222, 2.2, 1.1, 0.04, -3.0, 2.0, -D / 2 + 0.02, 0, { ao: false }); B.quad('menu', 0xffffff, 2.1, 1.0, -3.0, 2.0, -D / 2 + 0.05, 0, { ao: false, tint: false });
  // neon clock above the pass-through: pink ring, cyan numerals, hands stuck at 4:20... no, 7:15
  const clockFace = ctex(THREE, 'd:clock', 64, 64, (g) => { g.fillStyle = '#101018'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); g.strokeStyle = '#40e8ff'; g.lineWidth = 2; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.beginPath(); g.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); g.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26); g.stroke(); } g.strokeStyle = '#f8f8f8'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + 10, 32 - 10); g.moveTo(32, 32); g.lineTo(32 - 2, 32 - 20); g.stroke(); g.fillStyle = '#ff4a6a'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText("ROSIE'S", 32, 46); }, { repeat: false });
  B.def('clock', { kind: 'basic', map: clockFace });
  B.add(new THREE.TorusGeometry(0.42, 0.035, 6, 24), 'glow', 0xff4a7a, 2.6, 2.3, -D / 2 + 0.08, 0, { ao: false, tint: false });
  B.cyl('clock', 0xffffff, 0.4, 0.4, 0.02, 2.6, 2.3, -D / 2 + 0.06, 24, { ao: false, tint: false, rx: Math.PI / 2 });
  // --- booths: 3 on the left wall, 2 on the right; table + two benches each, condiments, a mini jukebox selector
  const booth = (bx, bz, side, o = {}) => {
    const s = side; // -1 = left wall (benches face +x), table against the wall
    const tw = 0.75, tl = 1.1;
    B.box('plain', 0xf4f0e8, tw, 0.05, tl, bx, 0.74, bz); B.box('shiny', C.chrome, tw + 0.04, 0.03, tl + 0.04, bx, 0.715, bz, 0, { ao: false });
    B.box('shiny', C.chrome, 0.08, 0.7, 0.08, bx + s * 0.1, 0.35, bz, 0, { ao: false }); B.box('shiny', C.chrome, 0.5, 0.03, 0.5, bx + s * 0.1, 0.02, bz, 0, { ao: false });
    for (const e of [-1, 1]) {
      const z = bz + e * 0.95;
      B.box('plain', 0x2a2a30, 1.3, 0.4, 0.5, bx + s * 0.05, 0.2, z); B.box('cloth', o.c || C.vinylRed, 1.3, 0.12, 0.52, bx + s * 0.05, 0.46, z, 0, { aoLo: 0.8 });
      B.box('cloth', o.c || C.vinylRed, 1.3, 0.6, 0.12, bx + s * 0.05, 0.75, z + e * 0.22, 0, { aoLo: 0.7 }); B.box('shiny', C.chrome, 1.32, 0.04, 0.14, bx + s * 0.05, 1.06, z + e * 0.22, 0, { ao: false });
      for (let k = 0; k < 3; k++) B.box('cloth', (o.c || C.vinylRed), 1.3, 0.02, 0.56, bx + s * 0.05, 0.47 + k * 0.001, z, 0, { ao: false, paint: () => 0.85 });
    }
    B.box('shiny', C.chrome, 0.12, 0.14, 0.16, bx - s * 0.2, 0.81, bz + 0.3); B.cyl('plain', 0xd02020, 0.03, 0.03, 0.14, bx - s * 0.2, 0.83, bz + 0.1, 8, { ao: false }); B.cyl('plain', 0xe8c020, 0.03, 0.03, 0.14, bx - s * 0.2, 0.83, bz, 8, { ao: false });
    B.box('plain', 0xd8c8a0, 0.14, 0.22, 0.1, bx + s * 0.22, 0.87, bz - 0.3); B.quad('glow', 0xffc060, 0.1, 0.06, bx + s * 0.22 - s * 0.051, 0.93, bz - 0.3, s < 0 ? Math.PI / 2 : -Math.PI / 2, { ao: false, tint: false }); // tabletop jukebox selector
    if (o.plate) { B.cyl('plain', 0xf4f0e8, 0.14, 0.12, 0.015, bx - s * 0.05, 0.775, bz - 0.25, 12, { ao: false }); B.box('plain', 0xe8b050, 0.12, 0.04, 0.1, bx - s * 0.05, 0.8, bz - 0.25, 0.4, { ao: false }); for (let k = 0; k < 5; k++) B.box('plain', 0xf0c060, 0.015, 0.012, 0.08, bx - s * 0.05 + (rnd() - 0.5) * 0.15, 0.785, bz - 0.25 + (rnd() - 0.5) * 0.12, rnd(), { ao: false }); }
    if (o.cup) { B.cyl('plain', 0xf4f0e8, 0.045, 0.04, 0.09, bx + s * 0.1, 0.81, bz + 0.25, 8, { ao: false }); }
    if (o.paper) B.box('plain', 0xd8d8d0, 0.3, 0.004, 0.4, bx, 0.77, bz + 0.1, 0.15, { ao: false });
  };
  // colliders per booth: table top 0.76, seats 0.52 (sit / stand on them), backs 1.1
  const boothCols = (bx, bz, s) => [
    { kind: 'box', cx: bx, cz: bz, w: 0.75, d: 1.1, rot: 0, h: 0.76 },
    ...[-1, 1].flatMap((e) => [{ kind: 'box', cx: bx + s * 0.05, cz: bz + e * 0.95, w: 1.3, d: 0.5, rot: 0, h: 0.52 }, { kind: 'box', cx: bx + s * 0.05, cz: bz + e * 1.17, w: 1.3, d: 0.12, rot: 0, h: 1.1 }]),
  ];
  booth(-5.45, -1.8, -1, { plate: true }); booth(-5.45, 0.5, -1, { cup: true, paper: true });
  booth(5.45, -1.6, 1, { cup: true }); booth(5.45, 0.9, 1, { plate: true, c: 0x3a6ab0 });
  // wall art: framed photos of regulars, a "WAITRESS WANTED" sign, a mounted fish
  const want = signTex(THREE, 'd:want', ['WAITRESS', 'WANTED', 'must tolerate', 'cats + Earl'], '#fff', '#222', 96, 96, { font: 'sans-serif', border: '#222' });
  B.def('want', { kind: 'lambert', map: want }); B.quad('want', 0xffffff, 0.4, 0.4, -W / 2 + 0.02, 2.1, -0.3, Math.PI / 2, { ao: false, tint: false });
  const ph = ctex(THREE, 'd:photo', 32, 32, (g) => { g.fillStyle = '#c8b890'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#6a5030'; g.fillRect(4, 4, 24, 24); g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(16, 14, 6, 0, 7); g.fill(); g.fillStyle = '#d02020'; g.fillRect(8, 20, 16, 8); }, { repeat: false });
  B.def('photo', { kind: 'lambert', map: ph });
  for (const z of [-2.6, 2.0]) framedPicture(B, THREE, 'photo', 0.35, 0.35, -W / 2 + 0.02, 2.1, z, Math.PI / 2, 0x2a2a30);
  for (const z of [-2.6, 0.2]) framedPicture(B, THREE, 'photo', 0.35, 0.35, W / 2 - 0.02, 2.1, z, -Math.PI / 2, 0x2a2a30);
  B.box('wood', 0x6a4a2a, 0.7, 0.25, 0.05, W / 2 - 0.04, 2.3, 2.1, -Math.PI / 2 - 0.0, { ao: false }); B.box('shiny', 0x5a9a7a, 0.5, 0.14, 0.1, W / 2 - 0.1, 2.3, 2.1, -Math.PI / 2 + 0.1, { ao: false, s: [1, 1, 1] }); B.cyl('shiny', 0x5a9a7a, 0.01, 0.12, 0.12, W / 2 - 0.1, 2.3, 2.42, 3, { ao: false, rx: Math.PI / 2 });
  // --- jukebox in the right-front corner: rounded top, glowing arch, speaker grille, bubble tubes
  const jx = -5.2, jz = 3.1, ja = -0.4;
  B.box('plain', 0x6a2a14, 1.0, 1.3, 0.7, jx, 0.65, jz, ja); B.cyl('plain', 0x6a2a14, 0.5, 0.5, 0.7, jx, 1.3, jz, 12, { rx: Math.PI / 2, ry: ja, ao: false });
  const jk = (c, r, h) => B.add(new THREE.TorusGeometry(r, 0.035, 6, 16, Math.PI), 'glow', c, jx - Math.sin(ja) * 0.36, h, jz - Math.cos(ja) * 0.36, ja, { ao: false, tint: false });
  jk(0xff40a0, 0.42, 1.3); jk(0x40e0ff, 0.34, 1.3); jk(0xffe040, 0.26, 1.3);
  B.quad('glow', 0xffd890, 0.5, 0.28, jx - Math.sin(ja) * 0.37, 1.05, jz - Math.cos(ja) * 0.37, ja + Math.PI, { ao: false, tint: false });
  const grille = ctex(THREE, 'd:grille', 32, 32, (g) => { g.fillStyle = '#c8a050'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#4a2a10'; for (let y = 2; y < 32; y += 4) for (let x = 2; x < 32; x += 4) g.fillRect(x, y, 2, 2); });
  B.def('grille', { kind: 'lambert', map: grille }); B.quad('grille', 0xffffff, 0.7, 0.6, jx - Math.sin(ja) * 0.37, 0.5, jz - Math.cos(ja) * 0.37, ja + Math.PI, { ao: false, tint: false });
  for (const e of [-1, 1]) B.cyl('glow', 0xff8040, 0.03, 0.03, 1.0, jx - Math.sin(ja) * 0.36 + Math.cos(ja) * e * 0.44, 0.75, jz - Math.cos(ja) * 0.36 - Math.sin(ja) * e * 0.44, 6, { ao: false, tint: false });
  // ceiling: pendant lamps over the counter + a lazy ceiling fan
  for (const x of [-3.0, -0.5, 2.0]) { B.cyl('plain', 0x333333, 0.01, 0.01, 0.5, x, H - 0.25, -1.9, 4, { ao: false }); B.cyl('plain', 0xc8282e, 0.08, 0.25, 0.2, x, H - 0.55, -1.9, 10, { ao: false }); B.sph('glow', 0xfff0c0, 0.07, x, H - 0.64, -1.9, { ao: false, tint: false }); }
  B.cyl('plain', 0x6a4a2a, 0.04, 0.04, 0.3, 0, H - 0.15, 1.5, 6, { ao: false }); for (let k = 0; k < 4; k++) B.box('wood', 0x6a4a2a, 1.1, 0.02, 0.16, Math.cos(k * Math.PI / 2 + 0.4) * 0.55, H - 0.3, 1.5 + Math.sin(k * Math.PI / 2 + 0.4) * 0.55, -(k * Math.PI / 2 + 0.4), { ao: false });
  // a gumball machine and the "please wait to be seated" stand by the door
  B.cyl('plain', 0xc8282e, 0.12, 0.14, 0.5, 5.5, 0.25, 3.5, 10); B.sph('glass', 0xffffff, 0.2, 5.5, 0.7, 3.5, { ao: false }); for (let k = 0; k < 10; k++) B.sph('plain', pick([0xf04040, 0x40c0f0, 0xf0e040, 0x40d060, 0xf080c0]), 0.04, 5.5 + (rnd() - 0.5) * 0.22, 0.62 + rnd() * 0.12, 3.5 + (rnd() - 0.5) * 0.22, { ao: false, tint: false });
  const seat = signTex(THREE, 'd:seat', ['PLEASE WAIT', 'TO BE', 'SEATED', '(or just sit, Rosie', 'is in the back)'], '#f4ead2', '#222', 96, 112, { font: 'sans-serif', border: '#c8282e' });
  B.def('seat', { kind: 'lambert', map: seat }); B.cyl('shiny', C.chrome, 0.02, 0.02, 1.1, 2.8, 0.55, 3.5, 6, { ao: false }); B.cyl('shiny', C.chrome, 0.15, 0.15, 0.03, 2.8, 0.015, 3.5, 10, { ao: false }); B.quad('seat', 0xffffff, 0.3, 0.35, 2.8, 1.2, 3.5, Math.PI, { ao: false, tint: false });

  const group = B.finish(new THREE.Group());
  cols.push(
    { kind: 'box', cx: -0.5, cz: -2.3, w: 7.9, d: 0.8, rot: 0, h: 1.03 },        // counter (standable)
    { kind: 'box', cx: -0.5, cz: -D / 2 + 0.3, w: 8.4, d: 0.6, rot: 0, h: 1.8 }, // back bar
    ...[-3.6, -2.55, -1.5, -0.45, 0.6, 1.65, 2.7].map((x) => ({ kind: 'box', cx: x, cz: -1.5, w: 0.4, d: 0.4, rot: 0, h: 0.65 })),
    ...boothCols(-5.45, -1.8, -1), ...boothCols(-5.45, 0.5, -1), ...boothCols(5.45, -1.6, 1), ...boothCols(5.45, 0.9, 1),
    { kind: 'box', cx: jx, cz: jz, w: 1.0, d: 0.7, rot: ja, h: 1.8 },           // jukebox
    { kind: 'box', cx: 5.5, cz: 3.5, w: 0.4, d: 0.4, rot: 0, h: 0.9 },           // gumball
    { kind: 'box', cx: 2.8, cz: 3.5, w: 0.3, d: 0.3, rot: 0, h: 1.3 },           // host stand
  );
  return {
    group, size: [W, D], cols, floors: [],
    spawn: { x: 4.2, z: 2.6, yaw: 0 },
    exit: { x: 4.2, z: D / 2 + 0.05, r: 0.6 },
    lights: [
      { x: -3.0, y: H - 0.7, z: -1.6, c: 0xffd8a0, i: 1.0, always: true },
      { x: -0.5, y: H - 0.7, z: -1.6, c: 0xffd8a0, i: 1.0, always: true },
      { x: 2.0, y: H - 0.7, z: -1.6, c: 0xffd8a0, i: 1.0, always: true },
      { x: 0, y: 2.2, z: 1.8, c: 0xffe8c8, i: 0.9, always: true },
      { x: 2.6, y: 2.0, z: -3.0, c: 0xff5080, i: 0.5, always: true },           // neon clock
      { x: jx + 0.5, y: 1.3, z: jz - 0.6, c: 0xff80c0, i: 0.6, always: true },  // jukebox
    ],
    cam: { maxDist: 4.5, height: 2.2 },
    interact: [
      { id: 'booth', x: -4.2, z: 0.5, r: 1.0, label: 'Sit in the booth' },
      { id: 'counter', x: -0.5, z: -1.0, r: 1.1, label: 'Order the usual' },
      { id: 'jukebox', x: jx + 0.7, z: jz - 0.9, r: 0.8, label: 'Jukebox' },
    ],
  };
}

// =====================================================================================================
// 4. Nana's House: farmhouse living room (left) + kitchen (right), 10 x 8 m, 2.6 m ceiling.
//    Floral couch under the cuckoo clock, rocker by the fireplace, CRT, kitchen table with a casserole,
//    and cat figurines on every flat surface.
// =====================================================================================================
function buildNana(ctx) {
  const { THREE, T } = ctx; seed = 41;
  const B = makeBuilder(THREE, T);
  const W = 10, D = 8, H = 2.6;
  const planks = ctex(THREE, 'n:planks', 64, 64, (g) => { g.fillStyle = '#a97848'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 2) { g.fillStyle = `rgba(60,30,10,${0.04 + rnd() * 0.12})`; g.fillRect(0, y, 64, 1); } for (let x = 0; x < 64; x += 16) { g.fillStyle = 'rgba(40,20,5,0.5)'; g.fillRect(x, 0, 1, 64); g.fillStyle = 'rgba(40,20,5,0.35)'; g.fillRect(x + 1, (x * 7) % 64, 15, 1); } grime(g, 64, 64, 60, 0.12); });
  const lino = ctex(THREE, 'n:lino', 64, 64, (g) => { g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c8a040'; for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 32) { g.fillRect(x + 12, y + 12, 8, 8); g.fillRect(x + 28, y + 28, 8, 8); } g.strokeStyle = 'rgba(120,90,40,0.35)'; for (let k = 0; k <= 64; k += 32) { g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, 64); g.moveTo(0, k + 0.5); g.lineTo(64, k + 0.5); g.stroke(); } grime(g, 64, 64, 60, 0.1); });
  const paper = ctex(THREE, 'n:paper', 64, 64, (g) => {
    g.fillStyle = '#efe4cf'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#d9c8a8'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 6, 64);
    for (let y = 8; y < 64; y += 16) for (let x = 11; x < 64; x += 16) { g.fillStyle = '#c86a7a'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.fillStyle = '#e89aa8'; g.beginPath(); g.arc(x - 1, y - 1, 1.4, 0, 7); g.fill(); g.fillStyle = '#6a9a5a'; g.fillRect(x + 2, y + 2, 3, 1.5); g.fillRect(x - 5, y + 1, 3, 1.5); }
    grime(g, 64, 64, 30, 0.08);
  });
  const ceilT = ctex(THREE, 'n:ceil', 64, 64, (g) => { g.fillStyle = '#f0ece0'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.08})`; g.fillRect(rnd() * 64, rnd() * 64, 2, 2); } g.fillStyle = 'rgba(140,110,60,0.3)'; g.beginPath(); g.ellipse(20, 40, 12, 7, 0.4, 0, 7); g.fill(); });
  B.def('planks', { kind: 'lambert', map: planks }); B.def('lino', { kind: 'lambert', map: lino }); B.def('paper', { kind: 'lambert', map: paper }); B.def('nceil', { kind: 'lambert', map: ceilT });
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'planks', wallKey: 'paper', ceilKey: 'nceil', ceilCol: 0xffffff, door: { x: 0, w: 0.95, h: 2.05 }, base: 0xf0ece0, frame: 0xf0ece0, wallTile: 1.6, floorTile: 1.3, trim: { c: 0xf0ece0, y: 0.95, h: 0.1 } });
  // kitchen lino laid over the planks on the right side; a threshold strip
  B.flat('lino', 0xffffff, 4.4, 8, 2.8, 0.006, 0, 0, { sx: 4, sy: 8, us: 4.4 / 1.0, vs: 8, ao: false, paint: (x, _y, z) => 0.6 + 0.4 * sm(Math.min(5 - x, 4 - Math.abs(z)) / 1.1) });
  B.box('wood', 0x8a6238, 0.08, 0.02, 8, 0.6, 0.01, 0, 0, { ao: false });
  // windows: left wall and kitchen window over the sink, with lace cafe curtains; night outside
  const night = ctex(THREE, 'n:night', 32, 32, (g) => { g.fillStyle = '#0e1626'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#1a2a3a'; g.fillRect(0, 22, 32, 10); g.fillStyle = '#e8e0b0'; g.beginPath(); g.arc(24, 8, 3, 0, 7); g.fill(); }, { repeat: false });
  B.def('night', { kind: 'basic', map: night });
  const lace = ctex(THREE, 'n:lace', 32, 32, (g) => { g.fillStyle = 'rgba(255,250,240,0.9)'; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(200,190,170,0.8)'; for (let y = 2; y < 32; y += 6) for (let x = 2; x < 32; x += 6) g.fillRect(x + (y % 12 ? 3 : 0), y, 2, 2); });
  B.def('lace', { kind: 'lambert', map: lace });
  const win = (x, y, z, ry, w = 1.2, h = 1.3) => {
    const nx = Math.sin(ry), nz = Math.cos(ry);
    B.quad('night', 0xffffff, w, h, x + nx * 0.02, y, z + nz * 0.02, ry, { ao: false, tint: false });
    for (const dy of [h / 2 + 0.03, -h / 2 - 0.03]) B.quad('plain', 0xf0ece0, w + 0.16, 0.08, x + nx * 0.03, y + dy, z + nz * 0.03, ry, { ao: false, tint: false });
    for (const e of [-1, 1]) B.quad('plain', 0xf0ece0, 0.08, h + 0.16, x + nx * 0.03 + Math.cos(ry) * e * (w / 2 + 0.04), y, z + nz * 0.03 - Math.sin(ry) * e * (w / 2 + 0.04), ry, { ao: false, tint: false });
    B.quad('plain', 0xf0ece0, 0.05, h, x + nx * 0.03, y, z + nz * 0.03, ry, { ao: false, tint: false });
    for (const e of [-1, 1]) B.quad('lace', 0xffffff, w * 0.36, h * 0.96, x + nx * 0.06 + Math.cos(ry) * e * w * 0.34, y, z + nz * 0.06 - Math.sin(ry) * e * w * 0.34, ry, { ao: false, sx: 2, sy: 3, paint: (_x, yy) => 0.78 + 0.22 * sm((yy - (y - h / 2)) / h) });
    B.box('wood', 0x8a6238, w + 0.3, 0.05, 0.14, x + nx * 0.07, y - h / 2 - 0.08, z + nz * 0.07, ry, { ao: false });   // sill
  };
  win(-W / 2, 1.5, -1.6, Math.PI / 2); win(-W / 2, 1.5, 1.6, Math.PI / 2); win(W / 2, 1.6, -1.2, -Math.PI / 2, 1.0, 1.0); win(-2.8, 1.6, D / 2, Math.PI, 1.4, 1.3); win(3.0, 1.6, D / 2, Math.PI, 1.4, 1.3);
  // front door (inside face): white panel door, screen-door shadow, a wreath that is not seasonal
  B.quad('plain', 0xf4f0e8, 0.92, 2.0, 0, 1.0, D / 2 - 0.04, Math.PI, { ao: false, sy: 4, paint: (_x, y) => 0.65 + 0.35 * sm(y / 0.8) });
  for (const y of [0.5, 1.45]) B.quad('plain', 0xdcd8d0, 0.6, 0.6, 0, y, D / 2 - 0.06, Math.PI, { ao: false, tint: false });
  B.sph('shiny', 0xd8b050, 0.03, 0.38, 1.0, D / 2 - 0.08, { ao: false });
  // --- living room (x < 0.6)
  // braided oval rug
  const rug = ctex(THREE, 'n:rug', 64, 64, (g) => { g.clearRect(0, 0, 64, 64); const cs = ['#7a4a3a', '#a08a60', '#4a5a6a', '#6a6a4a', '#8a6a50', '#5a4a40']; for (let r = 31; r > 0; r -= 3) { g.fillStyle = cs[(r / 3 | 0) % cs.length]; g.beginPath(); g.ellipse(32, 32, r, r * 0.7, 0, 0, 7); g.fill(); } for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } }, { repeat: false });
  B.def('rug', { kind: 'lambert', map: rug, transparent: true, alphaTest: 0.5 }); B.flat('rug', 0xffffff, 3.6, 2.6, -2.3, 0.012, 0.3, 0, { ao: false, tint: false });
  // couch along the left wall facing +x: floral upholstery, doilies, afghan over the back
  const floral = ctex(THREE, 'n:floral', 32, 32, (g) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 32, 32); for (let y = 4; y < 32; y += 10) for (let x = 4; x < 32; x += 10) { g.fillStyle = '#b84a6a'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); g.fillStyle = '#e8a0b0'; g.beginPath(); g.arc(x - 1, y - 1, 1.5, 0, 7); g.fill(); g.fillStyle = '#5a8a4a'; g.fillRect(x + 3, y + 1, 3, 2); g.fillRect(x - 5, y + 2, 3, 2); } });
  B.def('floral', { kind: 'lambert', map: floral });
  const cx0 = -4.35, cz0 = 0.3;
  B.box('floral', 0xffffff, 0.9, 0.45, 2.2, cx0, 0.225, cz0); B.box('floral', 0xffffff, 0.3, 1.0, 2.2, cx0 - 0.3, 0.5, cz0, 0, { aoLo: 0.7 });
  for (const e of [-1, 1]) B.box('floral', 0xffffff, 0.9, 0.7, 0.25, cx0, 0.35, cz0 + e * 1.1, 0, { aoLo: 0.7 });
  for (const z of [-0.6, 0.1, 0.8]) B.box('floral', 0xffffff, 0.7, 0.16, 0.66, cx0 + 0.1, 0.5, cz0 + z, 0, { aoLo: 0.85 });
  for (const e of [-1, 1]) B.cyl('plain', 0xfbf8f0, 0.11, 0.11, 0.01, cx0, 0.705, cz0 + e * 1.1, 12, { ao: false });                          // arm doilies
  B.cyl('plain', 0xfbf8f0, 0.14, 0.14, 0.01, cx0 - 0.17, 1.005, cz0 + 0.7, 12, { ao: false, rx: 0, rz: Math.PI / 2 });                      // back doily
  const afghan = ctex(THREE, 'n:afghan', 32, 32, (g) => { const cs = ['#c8402a', '#e89a30', '#f0d860', '#4a8a5a', '#3a5aa0', '#8a4aa0']; for (let y = 0; y < 32; y += 4) { g.fillStyle = cs[(y / 4) % cs.length]; g.beginPath(); for (let x = 0; x <= 32; x += 4) g.lineTo(x, y + (x % 8 ? 2 : -2)); for (let x = 32; x >= 0; x -= 4) g.lineTo(x, y + 4 + (x % 8 ? 2 : -2)); g.fill(); } });
  B.def('afghan', { kind: 'lambert', map: afghan });
  B.box('afghan', 0xffffff, 0.5, 0.06, 0.9, cx0 - 0.2, 1.02, cz0 - 0.5, 0, { ao: false }); B.box('afghan', 0xffffff, 0.08, 0.5, 0.9, cx0 + 0.05, 0.8, cz0 - 0.5, 0, { ao: false });
  B.box('cloth', 0xd8c8a0, 0.5, 0.4, 0.5, cx0 + 0.05, 0.75, cz0 + 0.55, 0.3, { aoLo: 0.8 }); B.box('cloth', 0x8a4a5a, 0.4, 0.35, 0.45, cx0 + 0.05, 0.75, cz0 - 0.1, -0.2, { aoLo: 0.8 }); // throw pillows
  // end table + fringed lamp, candy dish, phone with a cord
  B.box('wood', 0x6a4426, 0.6, 0.6, 0.6, cx0, 0.3, cz0 + 1.6); B.cyl('plain', 0xd8b070, 0.06, 0.08, 0.4, cx0, 0.8, cz0 + 1.6, 8); B.cyl('cloth', 0xf0d8a0, 0.18, 0.26, 0.28, cx0, 1.12, cz0 + 1.6, 10, { ao: false, tint: false }); B.sph('glow', 0xffe8c0, 0.06, cx0, 1.05, cz0 + 1.6, { ao: false, tint: false });
  B.cyl('glass', 0xffffff, 0.1, 0.07, 0.06, cx0 + 0.18, 0.63, cz0 + 1.45, 10, { ao: false }); for (let k = 0; k < 6; k++) B.box('plain', pick([0xf04040, 0xf0e040, 0x40c060, 0xf08030]), 0.035, 0.02, 0.035, cx0 + 0.18 + (rnd() - 0.5) * 0.1, 0.64, cz0 + 1.45 + (rnd() - 0.5) * 0.1, rnd(), { ao: false });
  // coffee table with TV guide, reading glasses, a half-finished crossword, a cat on it
  B.box('wood', 0x6a4426, 1.1, 0.05, 0.55, -2.4, 0.42, 0.3); for (const [x, z] of [[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.22], [0.5, 0.22]]) B.box('wood', 0x6a4426, 0.05, 0.4, 0.05, -2.4 + x, 0.2, 0.3 + z);
  B.box('plain', 0xf0e8d8, 0.22, 0.004, 0.3, -2.6, 0.447, 0.25, 0.3, { ao: false }); B.box('plain', 0xd8d0c0, 0.25, 0.004, 0.3, -2.2, 0.447, 0.35, -0.2, { ao: false });
  for (const e of [-1, 1]) B.add(new THREE.TorusGeometry(0.03, 0.005, 4, 10), 'plain', 0x8a6a3a, -2.25 + e * 0.065, 0.45, 0.1, 0, { ao: false, rx: Math.PI / 2 });
  catFigurine(B, 0xf4f0e8, -2.8, 0.445, 0.45, 2.2, 1.3);
  // rocking chair by the fireplace, angled at the TV, with the knitting basket beside it
  const rx0 = -2.6, rz0 = -2.9, ra = 2.6;
  const rk = (w, h, d, lx, ly, lz) => B.box('wood', 0x7a4a2a, w, h, d, rx0 + Math.cos(ra) * lx + Math.sin(ra) * lz, ly, rz0 - Math.sin(ra) * lx + Math.cos(ra) * lz, ra);
  rk(0.55, 0.05, 0.5, 0, 0.45, 0); for (const e of [-1, 1]) { rk(0.04, 0.45, 0.04, e * 0.24, 0.23, 0.2); rk(0.04, 0.45, 0.04, e * 0.24, 0.23, -0.2); rk(0.04, 0.04, 0.7, e * 0.24, 0.03, 0); rk(0.04, 0.5, 0.04, e * 0.24, 0.72, -0.22); rk(0.04, 0.04, 0.5, e * 0.24, 0.68, 0.0); }
  for (let k = 0; k < 5; k++) rk(0.03, 0.5, 0.03, -0.2 + k * 0.1, 0.72, -0.22); rk(0.55, 0.05, 0.05, 0, 0.98, -0.22);
  B.box('cloth', 0xc8a0a8, 0.5, 0.08, 0.45, rx0, 0.51, rz0, ra, { aoLo: 0.85 });
  B.cyl('plain', 0xb08a50, 0.22, 0.17, 0.26, rx0 + 0.75, 0.13, rz0 + 0.1, 8); for (let k = 0; k < 4; k++) B.sph('cloth', pick([0xd04a6a, 0x5a8ad0, 0xf0d060, 0x9a6ac0]), 0.08, rx0 + 0.75 + (rnd() - 0.5) * 0.2, 0.3 + rnd() * 0.08, rz0 + 0.1 + (rnd() - 0.5) * 0.2, { ao: false });
  for (const e of [-1, 1]) B.cyl('shiny', 0xcfd4d8, 0.004, 0.004, 0.4, rx0 + 0.75 + e * 0.04, 0.42, rz0 + 0.1, 4, { rz: e * 0.3, ao: false });
  B.box('cloth', 0xd04a6a, 0.3, 0.02, 0.5, rx0 + 0.6, 0.45, rz0 - 0.1, ra, { ao: false });                                                  // the half-knitted sweater (for the cat)
  // fireplace on the back wall, mantel with photos and figurines, stockings in November
  B.box('plain', 0xb89a80, 2.0, 1.3, 0.4, -2.2, 0.65, -D / 2 + 0.2, 0, { aoLo: 0.7 });
  const brick = T && T.brick; B.def('nbrick', { kind: 'lambert', map: brick || null });
  B.quad('nbrick', brick ? 0xffffff : 0x8a4a3a, 2.0, 1.3, -2.2, 0.65, -D / 2 + 0.405, 0, { ao: false, us: 2, vs: 1.3, paint: (_x, y) => 0.7 + 0.3 * sm(y / 0.8) });
  B.quad('glow', 0x1a0c08, 1.0, 0.8, -2.2, 0.45, -D / 2 + 0.41, 0, { ao: false, tint: false });
  for (let k = 0; k < 3; k++) B.cyl('plain', 0x4a3020, 0.06, 0.06, 0.6, -2.2 + (k - 1) * 0.12, 0.1 + (k === 1 ? 0.1 : 0), -D / 2 + 0.3, 6, { rz: Math.PI / 2 - 0.3 * (k - 1), ao: false });
  B.quad('glow', 0xff8a30, 0.5, 0.3, -2.2, 0.3, -D / 2 + 0.36, 0, { ao: false, tint: false }); B.quad('glow', 0xffd060, 0.25, 0.18, -2.25, 0.3, -D / 2 + 0.37, 0, { ao: false, tint: false });
  B.box('wood', 0x5a3a20, 2.3, 0.08, 0.5, -2.2, 1.34, -D / 2 + 0.25); B.box('shiny', 0x222222, 1.1, 0.5, 0.05, -2.2, 0.25, -D / 2 + 0.45, 0, { ao: false }); // screen
  B.box('plain', 0xf0ece0, 0.3, 0.4, 0.02, -2.2, 1.6, -D / 2 + 0.03, 0, { ao: false });
  const photo = (key, draw) => { ctex(THREE, 'n:' + key, 32, 40, (g) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 32, 40); draw(g); }, { repeat: false }); B.def(key, { kind: 'lambert', map: texCache.get('n:' + key) }); };
  photo('pWedding', (g) => { g.fillStyle = '#8a8a90'; g.fillRect(3, 3, 26, 34); g.fillStyle = '#f4f4f4'; g.fillRect(8, 16, 7, 20); g.fillStyle = '#222'; g.fillRect(17, 16, 7, 20); g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(11.5, 12, 3.5, 0, 7); g.arc(20.5, 12, 3.5, 0, 7); g.fill(); });
  photo('pCat', (g) => { g.fillStyle = '#5a7a4a'; g.fillRect(3, 3, 26, 34); g.fillStyle = '#f8f8f8'; g.beginPath(); g.arc(16, 20, 8, 0, 7); g.fill(); g.fillStyle = '#c83040'; g.fillRect(8, 24, 16, 10); g.fillStyle = '#222'; g.fillRect(12, 18, 2, 2); g.fillRect(18, 18, 2, 2); g.fillStyle = '#f0f0f0'; g.beginPath(); g.moveTo(9, 14); g.lineTo(11, 8); g.lineTo(14, 13); g.moveTo(23, 14); g.lineTo(21, 8); g.lineTo(18, 13); g.fill(); });
  photo('pKids', (g) => { g.fillStyle = '#c8b090'; g.fillRect(3, 3, 26, 34); for (let k = 0; k < 3; k++) { g.fillStyle = ['#d04040', '#4060c0', '#e0b030'][k]; g.fillRect(5 + k * 8, 20, 6, 14); g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(8 + k * 8, 16, 3, 0, 7); g.fill(); } });
  framedPicture(B, THREE, 'pWedding', 0.22, 0.28, -3.0, 1.55, -D / 2 + 0.12, 0, 0xc8a050); framedPicture(B, THREE, 'pCat', 0.3, 0.36, -2.2, 1.6, -D / 2 + 0.1, 0, 0xc8a050); framedPicture(B, THREE, 'pKids', 0.22, 0.28, -1.4, 1.55, -D / 2 + 0.12, 0, 0x6a4426);
  B.box('wood', 0x6a4426, 0.02, 0.3, 0.04, -3.0, 1.52, -D / 2 + 0.2, 0.4, { ao: false }); B.box('wood', 0x6a4426, 0.02, 0.38, 0.04, -2.2, 1.56, -D / 2 + 0.2, -0.3, { ao: false }); B.box('wood', 0x6a4426, 0.02, 0.3, 0.04, -1.4, 1.52, -D / 2 + 0.2, 0.4, { ao: false }); // easel backs
  const porcelain = [0xfbf8f0, 0xf4e8d8, 0x3a3a3a, 0xe8c080, 0xd8d8e0, 0xf0d0b0];
  for (let k = 0; k < 5; k++) catFigurine(B, pick(porcelain), -3.25 + k * 0.52 + (k % 2) * 0.1, 1.38, -D / 2 + 0.3 - (k % 2) * 0.1, rnd() * 6, 0.8 + rnd() * 0.5);
  B.cyl('plain', 0x4a7a3a, 0.1, 0.1, 0.9, -1.1, 0.45, -D / 2 + 0.3, 7); B.sph('plain', 0x3a6a3a, 0.3, -1.1, 1.05, -D / 2 + 0.3, { ao: false, s: [1, 1.3, 1], ws: 7, hs: 5 }); // fern
  // CRT TV on a cabinet facing the couch; VCR blinking; antenna; a cat asleep on the warm top
  const tx0 = -1.0, tz0 = 0.3, ta = Math.PI / 2;
  B.box('wood', 0x6a4426, 0.6, 0.55, 0.9, tx0, 0.275, tz0, 0); B.box('plain', 0x4a3a30, 0.62, 0.42, 0.56, tx0, 0.79, tz0, 0);
  const show = ctex(THREE, 'n:show', 32, 24, (g) => { g.fillStyle = '#3a6a9a'; g.fillRect(0, 0, 32, 24); g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(16, 11, 5, 0, 7); g.fill(); g.fillStyle = '#c8c8c8'; g.fillRect(10, 16, 12, 8); g.fillStyle = '#f0e040'; g.fillRect(2, 2, 10, 3); g.fillStyle = '#fff'; g.font = '5px sans-serif'; g.fillText('WHEEL OF', 2, 21); }, { repeat: false, nearest: true });
  B.def('show', { kind: 'basic', map: show }); B.quad('show', 0xffffff, 0.46, 0.34, tx0 - 0.311, 0.79, tz0, -Math.PI / 2, { ao: false, tint: false });
  B.box('plain', 0x222222, 0.4, 0.08, 0.36, tx0, 0.59, tz0); B.box('glow', 0x40ff60, 0.02, 0.02, 0.06, tx0 - 0.2, 0.6, tz0 + 0.1, 0, { ao: false, tint: false });
  for (const e of [-1, 1]) B.cyl('shiny', 0xcfd4d8, 0.005, 0.005, 0.45, tx0 + 0.1, 1.2, tz0 + e * 0.08, 4, { rx: e * 0.5, ao: false });
  B.cyl('plain', 0xf4f0e8, 0.16, 0.14, 0.09, tx0 + 0.05, 1.045, tz0 - 0.1, 8, { ao: false, s: [1.2, 1, 1] }); B.sph('plain', 0xf4f0e8, 0.07, tx0 + 0.2, 1.08, tz0 - 0.1, { ao: false }); // sleeping cat (real one)
  B.cyl('plain', 0xf0ece0, 0.14, 0.14, 0.01, tx0 - 0.1, 1.005, tz0 + 0.3, 12, { ao: false });   // TV doily
  // curio cabinet in the back-left corner: glass front, four shelves, all cats
  B.box('wood', 0x6a4426, 0.9, 1.9, 0.45, -4.5, 0.95, -3.6); B.box('glass', 0xffffff, 0.8, 1.6, 0.02, -4.5, 1.05, -3.36, 0, { ao: false });
  for (let r = 0; r < 4; r++) { B.box('wood', 0x8a6238, 0.8, 0.02, 0.4, -4.5, 0.45 + r * 0.38, -3.6, 0, { ao: false }); for (let k = 0; k < 3; k++) catFigurine(B, pick(porcelain), -4.75 + k * 0.25, 0.46 + r * 0.38, -3.55, rnd() * 1 - 0.5 + Math.PI, 0.7 + rnd() * 0.3); }
  // cuckoo clock above the couch, pendulum + pinecone weights
  B.box('wood', 0x5a3a20, 0.3, 0.4, 0.14, -W / 2 + 0.08, 1.95, 0.3, Math.PI / 2); B.add(new THREE.ConeGeometry(0.22, 0.2, 4), 'wood', 0x5a3a20, -W / 2 + 0.08, 2.25, 0.3, Math.PI / 4, { ao: false });
  B.quad('plain', 0xf4f0e8, 0.12, 0.12, -W / 2 + 0.16, 1.97, 0.3, Math.PI / 2, { ao: false, tint: false }); B.box('plain', 0x222222, 0.012, 0.05, 0.012, -W / 2 + 0.165, 1.99, 0.3, 0, { ao: false }); B.box('plain', 0x222222, 0.012, 0.012, 0.04, -W / 2 + 0.165, 1.97, 0.315, 0, { ao: false });
  B.box('plain', 0x222222, 0.06, 0.05, 0.06, -W / 2 + 0.14, 2.12, 0.3, 0, { ao: false });
  const group0 = new THREE.Group();
  const pend = new THREE.Group(); pend.position.set(-W / 2 + 0.13, 1.75, 0.3);
  const pendM = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.3, 0.01), new THREE.MeshLambertMaterial({ color: 0xd8b050 })); pendM.position.y = -0.15; pend.add(pendM);
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10), new THREE.MeshLambertMaterial({ color: 0xd8b050 })); bob.rotation.z = Math.PI / 2; bob.position.y = -0.3; pend.add(bob);
  group0.add(pend);
  for (const e of [-1, 1]) { B.cyl('plain', 0xd8b050, 0.003, 0.003, 0.5, -W / 2 + 0.1, 1.5, 0.3 + e * 0.08, 3, { ao: false }); B.add(new THREE.ConeGeometry(0.035, 0.12, 6), 'wood', 0x4a2a10, -W / 2 + 0.1, 1.2, 0.3 + e * 0.08, 0, { ao: false }); }
  // cross-stitch samplers and a wall phone
  const bless = signTex(THREE, 'n:bless', ['BLESS THIS', 'MESS', 'and the cat', 'that made it'], '#f4ecd8', '#8a3a5a', 128, 96, { font: 'serif', border: '#6a4426' });
  B.def('bless', { kind: 'lambert', map: bless }); framedPicture(B, THREE, 'bless', 0.45, 0.34, -W / 2 + 0.02, 1.9, 2.4, Math.PI / 2, 0x6a4426);
  const sampler = signTex(THREE, 'n:sampler', ['HOME IS WHERE', 'THE CASSEROLE IS'], '#f4ecd8', '#3a5a8a', 160, 64, { font: 'serif', border: '#6a4426' });
  B.def('sampler', { kind: 'lambert', map: sampler }); framedPicture(B, THREE, 'sampler', 0.6, 0.24, 2.0, 2.0, -D / 2 + 0.02, 0, 0x6a4426);
  B.box('plain', 0xe8d8a0, 0.1, 0.22, 0.08, W / 2 - 0.05, 1.5, 2.2); B.box('plain', 0xe8d8a0, 0.06, 0.2, 0.05, W / 2 - 0.08, 1.55, 2.26, 0.2, { ao: false }); for (let k = 0; k < 8; k++) B.add(new THREE.TorusGeometry(0.03, 0.006, 4, 8), 'plain', 0xe8d8a0, W / 2 - 0.08, 1.35 - k * 0.06, 2.2, 0, { ao: false, rx: Math.PI / 2 });
  // --- kitchen (x > 0.6): counters along the right wall, fridge in the back-right, stove, table + 4 chairs
  B.box('plain', 0xf0ece0, 0.65, 0.9, 3.4, W / 2 - 0.33, 0.45, -1.0); B.box('plain', 0xd8c080, 0.7, 0.05, 3.5, W / 2 - 0.35, 0.925, -1.0, 0, { ao: false });
  for (let k = 0; k < 5; k++) B.box('plain', 0xd8d4c8, 0.02, 0.6, 0.6, W / 2 - 0.66, 0.4, -2.5 + k * 0.7, 0, { ao: false }); for (let k = 0; k < 5; k++) B.box('shiny', 0xd8b050, 0.03, 0.03, 0.1, W / 2 - 0.68, 0.7, -2.5 + k * 0.7, 0, { ao: false });
  B.box('plain', 0x9aa0a8, 0.55, 0.03, 0.7, W / 2 - 0.35, 0.945, -1.2, 0, { ao: false }); B.box('plain', 0x6a7078, 0.4, 0.02, 0.55, W / 2 - 0.35, 0.93, -1.2, 0, { ao: false }); B.cyl('shiny', 0xcfd4d8, 0.015, 0.015, 0.3, W / 2 - 0.1, 1.05, -1.2, 6, { ao: false }); B.box('shiny', 0xcfd4d8, 0.25, 0.03, 0.03, W / 2 - 0.22, 1.2, -1.2, 0, { ao: false }); // sink
  B.box('plain', 0xf0ece0, 0.8, 0.95, 0.7, W / 2 - 0.4, 0.475, 1.3); B.box('plain', 0x222222, 0.78, 0.02, 0.68, W / 2 - 0.4, 0.96, 1.3, 0, { ao: false }); for (const [x, z] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) B.cyl('plain', 0x444444, 0.09, 0.09, 0.015, W / 2 - 0.4 + x, 0.975, 1.3 + z, 10, { ao: false }); B.box('plain', 0xf0ece0, 0.8, 0.3, 0.1, W / 2 - 0.05, 1.1, 1.3, 0, { ao: false }); // stove
  B.cyl('shiny', 0xcfd4d8, 0.12, 0.1, 0.16, W / 2 - 0.6, 1.06, 1.12, 10, { ao: false }); B.cyl('shiny', 0xcfd4d8, 0.02, 0.02, 0.1, W / 2 - 0.6, 1.17, 1.0, 6, { ao: false, rx: 0.6 }); // kettle
  B.box('plain', 0xf4f0e8, 0.9, 1.9, 0.75, W / 2 - 0.5, 0.95, -D / 2 + 0.5); B.box('plain', 0x333333, 0.92, 0.02, 0.76, W / 2 - 0.5, 1.3, -D / 2 + 0.5, 0, { ao: false }); B.box('shiny', 0xcfd4d8, 0.04, 0.5, 0.04, W / 2 - 0.9, 1.0, -D / 2 + 0.9, 0, { ao: false }); B.box('shiny', 0xcfd4d8, 0.04, 0.3, 0.04, W / 2 - 0.9, 1.55, -D / 2 + 0.9, 0, { ao: false }); // fridge
  for (let k = 0; k < 7; k++) B.box('plain', pick([0xf04040, 0x40c0f0, 0xf0e040, 0x40d060, 0xf080c0, 0xffffff]), 0.06, 0.06, 0.01, W / 2 - 0.85 + rnd() * 0.7, 1.4 + rnd() * 0.4, -D / 2 + 0.885, 0, { ao: false, tint: false }); // magnets
  const drawing = ctex(THREE, 'n:draw', 32, 32, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#444'; g.lineWidth = 1.5; g.beginPath(); g.arc(16, 14, 7, 0, 7); g.stroke(); g.beginPath(); g.moveTo(10, 9); g.lineTo(12, 4); g.lineTo(14, 9); g.moveTo(22, 9); g.lineTo(20, 4); g.lineTo(18, 9); g.stroke(); g.fillStyle = '#4a8a3a'; g.fillRect(12, 6, 8, 4); g.fillStyle = '#d04040'; g.font = '6px sans-serif'; g.fillText('GOOBLS', 4, 29); }, { repeat: false });
  B.def('drawing', { kind: 'lambert', map: drawing }); B.quad('drawing', 0xffffff, 0.28, 0.28, W / 2 - 0.5, 1.05, -D / 2 + 0.885, 0, { ao: false, tint: false });
  const gingham = ctex(THREE, 'n:gingham', 32, 32, (g) => { g.fillStyle = '#f8f4ec'; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(200,60,70,0.55)'; for (let k = 0; k < 32; k += 16) { g.fillRect(k, 0, 8, 32); g.fillRect(0, k, 32, 8); } });
  B.def('gingham', { kind: 'lambert', map: gingham });
  const kx = 2.6, kz = 0.6;
  B.box('gingham', 0xffffff, 1.5, 0.05, 1.0, kx, 0.75, kz, 0, { ao: false }); for (const e of [-1, 1]) { B.box('gingham', 0xffffff, 1.5, 0.3, 0.02, kx, 0.62, kz + e * 0.5, 0, { ao: false }); B.box('gingham', 0xffffff, 0.02, 0.3, 1.0, kx + e * 0.75, 0.62, kz, 0, { ao: false }); }
  for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) B.box('wood', 0x8a6238, 0.06, 0.72, 0.06, kx + x, 0.36, kz + z);
  const chair = (x, z, ry) => { B.box('wood', 0x8a6238, 0.42, 0.04, 0.42, x, 0.45, z, ry); B.box('cloth', 0xc86a5a, 0.36, 0.04, 0.36, x, 0.48, z, ry, { ao: false }); for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.box('wood', 0x8a6238, 0.04, 0.44, 0.04, x + Math.cos(ry) * lx + Math.sin(ry) * lz, 0.22, z - Math.sin(ry) * lx + Math.cos(ry) * lz, ry); B.box('wood', 0x8a6238, 0.42, 0.5, 0.04, x - Math.sin(ry) * 0.19, 0.72, z - Math.cos(ry) * 0.19, ry, { aoLo: 0.8 }); };
  chair(kx - 1.0, kz, Math.PI / 2); chair(kx + 1.0, kz, -Math.PI / 2); chair(kx - 0.2, kz - 0.9, 0); chair(kx + 0.3, kz + 0.9, Math.PI + 0.2);
  // casserole (tuna noodle, obviously), oven mitts, a pie cooling, salt + pepper, a letter from the HOA
  B.box('glass', 0xd0e8ff, 0.4, 0.14, 0.28, kx, 0.845, kz - 0.05, 0.15); B.box('plain', 0xd8a040, 0.36, 0.1, 0.24, kx, 0.83, kz - 0.05, 0.15, { ao: false }); B.box('plain', 0xf0c060, 0.3, 0.02, 0.18, kx, 0.89, kz - 0.05, 0.15, { ao: false }); for (let k = 0; k < 6; k++) B.box('plain', 0xe8d8a0, 0.03, 0.01, 0.03, kx + (rnd() - 0.5) * 0.28, 0.9, kz - 0.05 + (rnd() - 0.5) * 0.16, rnd(), { ao: false });
  for (const e of [-1, 1]) B.box('gingham', 0xffffff, 0.14, 0.03, 0.22, kx + 0.35, 0.79, kz - 0.05 + e * 0.12, 0.4 + e * 0.2, { ao: false });
  B.cyl('plain', 0xd89040, 0.14, 0.12, 0.05, kx - 0.5, 0.8, kz + 0.3, 12, { ao: false }); B.cyl('plain', 0xf0d8a0, 0.13, 0.13, 0.01, kx - 0.5, 0.83, kz + 0.3, 12, { ao: false }); for (let k = 0; k < 4; k++) B.box('plain', 0xf0d8a0, 0.2, 0.012, 0.015, kx - 0.5, 0.835, kz + 0.3, k * 0.78, { ao: false });
  B.cyl('glass', 0xffffff, 0.025, 0.025, 0.08, kx + 0.55, 0.81, kz + 0.35, 6, { ao: false }); B.cyl('glass', 0x444444, 0.025, 0.025, 0.08, kx + 0.62, 0.81, kz + 0.3, 6, { ao: false });
  const hoa = signTex(THREE, 'n:hoa', ['HOA NOTICE', 'Dear Resident,', 'your cat is', 'not zoned.', '- Gary'], '#fff', '#222', 96, 112, { font: 'sans-serif', weight: 'normal' });
  B.def('hoa', { kind: 'lambert', map: hoa }); B.flat('hoa', 0xffffff, 0.2, 0.26, kx - 0.35, 0.782, kz - 0.3, 0.3, { ao: false, tint: false });
  catFigurine(B, 0xf4e8d8, kx + 0.55, 0.78, kz - 0.35, 3.5, 1.1);
  // cat bed by the fireplace, embroidered GOOBLES, with a fish toy; a bowl of hard candies by the door
  B.cyl('cloth', 0x8a3a5a, 0.3, 0.26, 0.14, -0.9, 0.07, -3.1, 10); B.cyl('cloth', 0xd8b0c0, 0.22, 0.22, 0.02, -0.9, 0.14, -3.1, 10, { ao: false });
  const tag = signTex(THREE, 'n:tag', ['GOOBLES'], '#8a3a5a', '#f8e8f0', 96, 24); B.def('tag', { kind: 'lambert', map: tag }); B.quad('tag', 0xffffff, 0.3, 0.07, -0.9, 0.09, -2.8, 0, { ao: false, tint: false });
  B.box('plain', 0x6ab0c0, 0.12, 0.03, 0.06, -0.85, 0.16, -3.1, 0.7, { ao: false });
  B.box('wood', 0x6a4426, 0.5, 0.8, 0.3, 1.3, 0.4, D / 2 - 0.2); B.cyl('glass', 0xffffff, 0.12, 0.08, 0.08, 1.3, 0.84, D / 2 - 0.2, 10, { ao: false }); for (let k = 0; k < 7; k++) B.box('plain', pick([0xf04040, 0xf0e040, 0x40c060, 0xf08030, 0xf0f0f0]), 0.03, 0.02, 0.03, 1.3 + (rnd() - 0.5) * 0.14, 0.85, D / 2 - 0.2 + (rnd() - 0.5) * 0.14, rnd(), { ao: false });
  B.box('plain', 0xc8a050, 0.2, 0.3, 0.12, 1.3, 0.95, D / 2 - 0.25, 0.3); // purse
  // ceiling: a frosted dome light in the living room and a yellowed bowl light in the kitchen
  B.sph('glow', 0xfff4dc, 0.22, -2.4, H - 0.02, 0.3, { ao: false, tint: false, s: [1, 0.5, 1], ws: 10, hs: 6 }); B.cyl('shiny', 0xd8b050, 0.25, 0.25, 0.03, -2.4, H - 0.015, 0.3, 12, { ao: false });
  B.sph('glow', 0xffecc0, 0.2, 2.8, H - 0.02, -0.2, { ao: false, tint: false, s: [1, 0.5, 1], ws: 10, hs: 6 });
  B.cyl('plain', 0xf0ece0, 0.3, 0.3, 0.02, 2.8, H - 0.01, -0.2, 12, { ao: false });

  const group = B.finish(group0);
  const update = (t) => { pend.rotation.x = Math.sin(t * 3.2) * 0.25; };
  cols.push(
    { kind: 'box', cx: -4.25, cz: 0.3, w: 0.9, d: 2.2, rot: 0, h: 0.58 },       // couch seat (standable)
    { kind: 'box', cx: -4.65, cz: 0.3, w: 0.3, d: 2.2, rot: 0, h: 1.0 },        // couch back
    ...[-1, 1].map((e) => ({ kind: 'box', cx: -4.35, cz: 0.3 + e * 1.1, w: 0.9, d: 0.25, rot: 0, h: 0.7 })), // arms
    { kind: 'box', cx: -4.35, cz: 1.9, w: 0.6, d: 0.6, rot: 0, h: 0.6 },        // end table
    { kind: 'box', cx: -2.4, cz: 0.3, w: 1.1, d: 0.55, rot: 0, h: 0.45 },       // coffee table
    { kind: 'box', cx: rx0, cz: rz0, w: 0.7, d: 0.75, rot: ra, h: 1.0, top: 0.55 }, // rocker (seat)
    { kind: 'box', cx: rx0 + 0.75, cz: rz0 + 0.1, w: 0.45, d: 0.45, rot: 0, h: 0.4 }, // knitting basket
    { kind: 'box', cx: -2.2, cz: -D / 2 + 0.2, w: 2.3, d: 0.5, rot: 0, h: 1.4 }, // fireplace
    { kind: 'box', cx: tx0, cz: tz0, w: 0.65, d: 0.9, rot: 0, h: 1.0 },         // TV
    { kind: 'box', cx: -4.5, cz: -3.6, w: 0.9, d: 0.5, rot: 0, h: 1.9 },        // curio
    { kind: 'box', cx: -1.1, cz: -D / 2 + 0.3, w: 0.5, d: 0.5, rot: 0, h: 1.3 }, // fern
    { kind: 'box', cx: W / 2 - 0.33, cz: -1.0, w: 0.7, d: 3.5, rot: 0, h: 0.95 }, // counter
    { kind: 'box', cx: W / 2 - 0.4, cz: 1.3, w: 0.8, d: 0.7, rot: 0, h: 1.0 },   // stove
    { kind: 'box', cx: W / 2 - 0.5, cz: -D / 2 + 0.5, w: 0.9, d: 0.8, rot: 0, h: 1.9 }, // fridge
    { kind: 'box', cx: kx, cz: kz, w: 1.5, d: 1.0, rot: 0, h: 0.78 },           // table (standable)
    { kind: 'box', cx: kx - 1.0, cz: kz, w: 0.45, d: 0.45, rot: 0, h: 0.5 }, { kind: 'box', cx: kx + 1.0, cz: kz, w: 0.45, d: 0.45, rot: 0, h: 0.5 },
    { kind: 'box', cx: kx - 0.2, cz: kz - 0.9, w: 0.45, d: 0.45, rot: 0, h: 0.5 }, { kind: 'box', cx: kx + 0.3, cz: kz + 0.9, w: 0.45, d: 0.45, rot: 0.2, h: 0.5 }, // chair seats
    { kind: 'box', cx: 1.3, cz: D / 2 - 0.2, w: 0.5, d: 0.3, rot: 0, h: 0.82 },  // hall table
  );
  const floors = [{ top: 0.16, cx: -0.9, cz: -3.1, r: 0.3 }];   // the cat bed: a cushion you walk onto
  return {
    group, size: [W, D], cols, floors,
    spawn: { x: 0, z: 2.7, yaw: 0 },
    exit: { x: 0, z: D / 2 + 0.05, r: 0.6 },
    lights: [
      { x: -2.4, y: H - 0.4, z: 0.3, c: 0xffe4b8, i: 1.15, always: true },
      { x: cx0 + 0.3, y: 1.3, z: cz0 + 1.6, c: 0xffc890, i: 0.7, always: true },        // fringed lamp
      { x: -2.2, y: 0.6, z: -D / 2 + 0.8, c: 0xff8a30, i: 0.7, always: true, flicker: true }, // fire
      { x: 2.8, y: H - 0.4, z: -0.2, c: 0xfff0d0, i: 1.0, always: true },
    ],
    cam: { maxDist: 4.5, height: 2.2 },
    interact: [
      { id: 'couch', x: -3.5, z: 0.3, r: 0.9, label: 'Sit with Nana' },
      { id: 'casserole', x: kx, z: kz + 1.3, r: 0.8, label: 'Casserole' },
      { id: 'catbed', x: -0.9, z: -2.6, r: 0.7, label: 'Nap' },
    ],
    update,
  };
}

// =====================================================================================================
// 5. Chapel Hill Church: 9 x 16 m country chapel, 4.4 m ceiling with beams. Pews in two rows with a
//    centre aisle, chancel platform with pulpit, altar and upright piano, stained glass down both sides.
// =====================================================================================================
function buildChurch(ctx) {
  const { THREE, T } = ctx; seed = 53;
  const B = makeBuilder(THREE, T);
  const W = 9, D = 16, H = 4.4;
  const planks = ctex(THREE, 'c:planks', 64, 64, (g) => { g.fillStyle = '#8a6a44'; g.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 2) { g.fillStyle = `rgba(40,20,5,${0.04 + rnd() * 0.12})`; g.fillRect(0, y, 64, 1); } for (let x = 0; x < 64; x += 12) { g.fillStyle = 'rgba(30,15,5,0.55)'; g.fillRect(x, 0, 1, 64); g.fillStyle = 'rgba(30,15,5,0.35)'; g.fillRect(x + 1, (x * 11) % 64, 11, 1); } grime(g, 64, 64, 50, 0.1); });
  const plaster = ctex(THREE, 'c:plaster', 64, 64, (g) => { g.fillStyle = '#f1ece0'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,100,70,${rnd() * 0.08})`; g.fillRect(rnd() * 64, rnd() * 64, 2, 2); } g.strokeStyle = 'rgba(90,70,50,0.25)'; g.beginPath(); g.moveTo(10, 0); g.lineTo(14, 20); g.lineTo(12, 36); g.stroke(); });
  const wains = ctex(THREE, 'c:wains', 64, 32, (g) => { g.fillStyle = '#6a4a2e'; g.fillRect(0, 0, 64, 32); for (let x = 0; x < 64; x += 8) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, 0, 1, 32); g.fillStyle = 'rgba(255,220,180,0.12)'; g.fillRect(x + 1, 0, 2, 32); } });
  const carpet = ctex(THREE, 'c:carpet', 32, 32, (g) => { g.fillStyle = '#8a2a2a'; g.fillRect(0, 0, 32, 32); for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`; g.fillRect(rnd() * 32, rnd() * 32, 1, 1); } });
  B.def('planks', { kind: 'lambert', map: planks }); B.def('plaster', { kind: 'lambert', map: plaster }); B.def('wains', { kind: 'lambert', map: wains }); B.def('carpet', { kind: 'lambert', map: carpet });
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'planks', wallKey: 'plaster', ceilCol: 0xe8dcc4, door: { x: 0, w: 1.6, h: 2.5 }, base: 0x4a3222, frame: 0x4a3222, wallTile: 2.2, floorTile: 1.2 });
  // wainscot panels on all walls (inward strips), 1.1 m high
  const ws = (cx, cz, len, ry) => B.quad('wains', 0xffffff, len, 1.1, cx + Math.sin(ry) * 0.015, 0.55, cz + Math.cos(ry) * 0.015, ry, { ao: false, us: len / 1.0, sx: Math.ceil(len), paint: (_x, y) => 0.6 + 0.4 * sm(y / 0.7) });
  ws(0, -D / 2, W, 0); ws(-W / 2, 0, D, Math.PI / 2); ws(W / 2, 0, D, -Math.PI / 2); ws(-W / 2 + 1.825, D / 2, 3.65, Math.PI); ws(W / 2 - 1.825, D / 2, 3.65, Math.PI);
  const cap = (cx, cz, len, ry) => B.box('wood', 0x4a3222, len, 0.06, 0.08, cx + Math.sin(ry) * 0.03, 1.12, cz + Math.cos(ry) * 0.03, ry, { ao: false });
  cap(0, -D / 2, W, 0); cap(-W / 2, 0, D, Math.PI / 2); cap(W / 2, 0, D, -Math.PI / 2);
  // ceiling beams and a ridge, plus three hanging lanterns down the aisle
  for (const z of [-5.5, -2, 1.5, 5]) B.box('wood', 0x3a2818, W, 0.3, 0.3, 0, H - 0.15, z, 0, { ao: false });
  B.box('wood', 0x3a2818, 0.3, 0.3, D, 0, H - 0.15, 0, 0, { ao: false });
  for (const z of [-3.5, 0.5, 4.5]) { B.cyl('plain', 0x222222, 0.015, 0.015, 1.2, 0, H - 0.9, z, 4, { ao: false }); B.cyl('plain', 0x2a2a30, 0.3, 0.22, 0.06, 0, H - 1.5, z, 8, { ao: false }); B.cyl('glow', 0xffe2b0, 0.17, 0.2, 0.3, 0, H - 1.68, z, 8, { ao: false, tint: false }); B.cyl('plain', 0x2a2a30, 0.2, 0.2, 0.03, 0, H - 1.85, z, 8, { ao: false }); }
  // aisle runner and chancel carpet
  B.flat('carpet', 0xffffff, 1.5, 11.5, 0, 0.008, 2.0, 0, { us: 1.5, vs: 11.5, sx: 1, sy: 12, ao: false, paint: (_x, _y, z) => 0.85 + 0.15 * sm((z + 3.75) / 2) });
  // chancel: raised platform at the back (-z) with two steps
  B.box('wood', 0x7a5a3a, W - 0.2, 0.3, 4.0, 0, 0.15, -D / 2 + 2.0); B.box('wood', 0x7a5a3a, 3.0, 0.15, 0.5, 0, 0.075, -D / 2 + 4.25);
  B.flat('carpet', 0xffffff, W - 0.4, 3.8, 0, 0.31, -D / 2 + 2.0, 0, { us: 8.6, vs: 3.8, ao: false });
  // altar table with a white cloth, two candles, flowers, an open book; a plain wooden cross on the back wall
  B.box('wood', 0x4a3222, 1.8, 0.8, 0.7, 0, 0.7, -D / 2 + 1.0); B.box('cloth', 0xfbf8f0, 1.9, 0.04, 0.8, 0, 1.12, -D / 2 + 1.0, 0, { ao: false }); B.box('cloth', 0xfbf8f0, 1.9, 0.5, 0.02, 0, 0.9, -D / 2 + 1.41, 0, { aoLo: 0.85 });
  for (const e of [-1, 1]) { B.cyl('shiny', 0xd8b050, 0.05, 0.07, 0.1, e * 0.7, 1.19, -D / 2 + 1.0, 8, { ao: false }); B.cyl('plain', 0xf8f4e8, 0.025, 0.025, 0.35, e * 0.7, 1.4, -D / 2 + 1.0, 6, { ao: false }); B.sph('glow', 0xffd080, 0.03, e * 0.7, 1.6, -D / 2 + 1.0, { ao: false, tint: false }); }
  B.cyl('glass', 0xdfefff, 0.08, 0.06, 0.25, 0, 1.26, -D / 2 + 0.85, 8, { ao: false }); for (let k = 0; k < 7; k++) B.sph('plain', pick([0xf0e040, 0xf08030, 0xf0f0f0, 0xd04070]), 0.05, (rnd() - 0.5) * 0.3, 1.42 + rnd() * 0.08, -D / 2 + 0.85 + (rnd() - 0.5) * 0.2, { ao: false, tint: false, ws: 6, hs: 4 });
  B.box('plain', 0xf4f0e8, 0.3, 0.03, 0.22, 0.15, 1.155, -D / 2 + 1.15, -0.2, { ao: false }); B.box('plain', 0x8a2020, 0.32, 0.01, 0.24, 0.15, 1.135, -D / 2 + 1.15, -0.2, { ao: false });
  B.box('wood', 0x5a3a20, 0.18, 1.8, 0.1, 0, 2.6, -D / 2 + 0.08, 0, { ao: false }); B.box('wood', 0x5a3a20, 1.1, 0.18, 0.1, 0, 3.0, -D / 2 + 0.08, 0, { ao: false });
  // pulpit on the left with a reading lamp and a glass of water; the sermon notes
  const px0 = -2.0, pz0 = -D / 2 + 2.6;
  B.box('wood', 0x5a3a20, 0.9, 1.1, 0.6, px0, 0.85, pz0, 0.25); B.box('wood', 0x5a3a20, 1.0, 0.06, 0.7, px0, 1.42, pz0, 0.25, { rx: -0.25, ao: false });
  B.box('plain', 0xf4f0e8, 0.35, 0.02, 0.3, px0 + 0.02, 1.49, pz0 - 0.02, 0.25, { rx: -0.25, ao: false }); B.cyl('plain', 0x222222, 0.01, 0.01, 0.3, px0 - 0.35, 1.6, pz0 - 0.1, 4, { ao: false }); B.cyl('plain', 0x2a5a2a, 0.06, 0.1, 0.08, px0 - 0.35, 1.76, pz0 - 0.1, 8, { ao: false }); B.sph('glow', 0xffe8b0, 0.03, px0 - 0.35, 1.72, pz0 - 0.1, { ao: false, tint: false });
  B.cyl('glass', 0xdfefff, 0.035, 0.03, 0.1, px0 + 0.35, 1.5, pz0 + 0.1, 8, { ao: false });
  const cross = signTex(THREE, 'c:cross', ['SERMON:', 'ON LOVING', 'THY NEIGHBOR', '(EVEN GARY)'], '#f4f0e8', '#222', 96, 72, { font: 'sans-serif', weight: 'normal' });
  B.def('sermon', { kind: 'lambert', map: cross }); B.quad('sermon', 0xffffff, 0.5, 0.36, px0 + Math.sin(0.25) * 0.31, 0.9, pz0 + Math.cos(0.25) * 0.31, 0.25, { ao: false, tint: false });
  // upright piano on the right, bench, hymnal open, a metronome, a vase of plastic lilies
  const ix = 2.6, iz = -D / 2 + 2.2, ia = -0.5;
  const pb = (key, c, w, h, d, lx, ly, lz, o) => B.box(key, c, w, h, d, ix + Math.cos(ia) * lx + Math.sin(ia) * lz, ly, iz - Math.sin(ia) * lx + Math.cos(ia) * lz, ia, o);
  pb('wood', 0x3a2416, 1.5, 1.3, 0.6, 0, 0.95, 0); pb('wood', 0x3a2416, 1.5, 0.3, 0.6, 0, 0.45, 0); pb('wood', 0x3a2416, 1.6, 0.06, 0.66, 0, 1.63, 0, { ao: false });
  pb('plain', 0xf4f0e8, 1.3, 0.04, 0.2, 0, 0.98, 0.38, { ao: false }); for (let k = 0; k < 11; k++) pb('plain', 0x111111, 0.04, 0.03, 0.12, -0.55 + k * 0.11 + (k % 7 === 2 || k % 7 === 6 ? 0.03 : 0), 1.01, 0.34, { ao: false });
  pb('wood', 0x3a2416, 1.3, 0.1, 0.25, 0, 1.0, 0.4, { ao: false }); pb('wood', 0x3a2416, 0.04, 0.7, 0.04, -0.7, 0.35, 0.3); pb('wood', 0x3a2416, 0.04, 0.7, 0.04, 0.7, 0.35, 0.3);
  for (const e of [-1, 1]) pb('shiny', 0xd8b050, 0.04, 0.3, 0.04, e * 0.65, 0.15, 0.35, { ao: false });  // pedals-ish
  pb('plain', 0xf4f0e8, 0.3, 0.22, 0.02, 0, 1.4, 0.3, { ao: false }); pb('plain', 0x8a2020, 0.34, 0.26, 0.015, 0, 1.4, 0.29, { ao: false });
  pb('wood', 0x3a2416, 0.12, 0.2, 0.08, 0.5, 1.75, 0, { ao: false }); pb('wood', 0x5a3a20, 0.9, 0.08, 0.35, 0, 0.5, 0.95); for (const e of [-1, 1]) pb('wood', 0x5a3a20, 0.06, 0.5, 0.3, e * 0.4, 0.25, 0.95);
  B.cyl('glass', 0xdfefff, 0.06, 0.05, 0.25, ix - 0.6, 1.78, iz - 0.1, 8, { ao: false }); for (let k = 0; k < 4; k++) B.sph('plain', 0xf8f4f0, 0.05, ix - 0.6 + (rnd() - 0.5) * 0.15, 1.95 + rnd() * 0.06, iz - 0.1 + (rnd() - 0.5) * 0.15, { ao: false, tint: false, ws: 6, hs: 4 });
  // hymn boards on both side walls near the front, attendance board at the back
  const board = (lines, x, z, ry, key) => { const t = ctex(THREE, 'c:' + key, 96, 128, (g) => { g.fillStyle = '#3a2416'; g.fillRect(0, 0, 96, 128); g.fillStyle = '#f4ecd8'; g.font = 'bold 11px serif'; g.textAlign = 'center'; g.fillText(lines[0], 48, 16); g.fillStyle = '#5a3a20'; g.fillRect(6, 24, 84, 100); lines.slice(1).forEach((l, i) => { g.fillStyle = '#f4ecd8'; g.fillRect(16, 30 + i * 22, 64, 18); g.fillStyle = '#222'; g.font = 'bold 13px serif'; g.fillText(l, 48, 44 + i * 22); }); }, { repeat: false }); B.def(key, { kind: 'lambert', map: t }); framedPicture(B, THREE, key, 0.6, 0.8, x, 2.2, z, ry, 0x3a2416); };
  board(['HYMNS', '112', '47', '301', 'ALL OF THEM'], -W / 2 + 0.02, -D / 2 + 4.6, Math.PI / 2, 'hymnL');
  board(['TODAY', 'ATTEND. 11', 'LAST WK 9', 'CATS: 1', 'OFFERING: $34'], W / 2 - 0.02, -D / 2 + 4.6, -Math.PI / 2, 'hymnR');
  // pews: 6 rows x 2 sides, with hymnals in the racks and a forgotten umbrella
  for (let r = 0; r < 6; r++) for (const e of [-1, 1]) {
    const z = -1.9 + r * 1.35, x = e * 2.5;
    B.box('wood', 0x8a5a30, 3.2, 0.08, 0.45, x, 0.45, z); B.box('wood', 0x8a5a30, 3.2, 0.4, 0.06, x, 0.72, z + 0.22, 0, { aoLo: 0.8 }); B.box('wood', 0x8a5a30, 3.2, 0.03, 0.1, x, 0.92, z + 0.25, 0, { ao: false }); // backrest on the door side: pews face the altar
    for (const s of [-1, 1]) B.box('wood', 0x6a4426, 0.08, 0.9, 0.5, x + s * 1.58, 0.45, z + 0.02, 0, { aoLo: 0.5 });
    B.box('wood', 0x8a5a30, 0.4, 0.04, 0.45, x, 0.3, z, 0, { ao: false });
    if (r > 0) { B.box('wood', 0x6a4426, 3.0, 0.1, 0.06, x, 0.6, z - 1.35 + 0.3, 0, { ao: false }); for (let k = 0; k < 4; k++) if (rnd() < 0.75) B.box('plain', pick([0x8a2020, 0x2a3a6a, 0x8a2020]), 0.14, 0.2, 0.05, x - 1.2 + k * 0.75 + rnd() * 0.3, 0.68, z - 1.35 + 0.33, 0, { ao: false }); }
    B.flat('cloth', 0x8a2a2a, 3.1, 0.4, x, 0.495, z + 0.01, 0, { ao: false, paint: () => 0.8 });
  }
  B.cyl('plain', 0x222222, 0.02, 0.02, 0.8, 1.2, 0.5, 4.9, 6, { rz: 1.2, ao: false }); B.cyl('plain', 0x222222, 0.08, 0.02, 0.4, 0.6, 0.58, 4.9, 6, { rz: 1.2, ao: false }); // umbrella
  // one lonely hymnal left open on a pew, and a pair of reading glasses
  B.box('plain', 0xf4f0e8, 0.26, 0.02, 0.18, -3.2, 0.5, 0.8, 0.3, { ao: false }); B.box('plain', 0x8a2020, 0.28, 0.01, 0.2, -3.2, 0.49, 0.8, 0.3, { ao: false });
  // back of the church: narthex table with bulletins, offering plate, guest book; coat hooks; roof fund thermometer
  B.box('wood', 0x6a4426, 1.6, 0.8, 0.5, -3.3, 0.4, D / 2 - 0.4); B.box('plain', 0xf4f0e8, 0.3, 0.02, 0.2, -3.8, 0.81, D / 2 - 0.4, 0.1, { ao: false }); B.cyl('shiny', 0xd8b050, 0.18, 0.15, 0.03, -3.0, 0.815, D / 2 - 0.4, 12, { ao: false }); for (let k = 0; k < 5; k++) B.cyl('shiny', 0xd8d8e0, 0.025, 0.025, 0.004, -3.0 + (rnd() - 0.5) * 0.2, 0.832, D / 2 - 0.4 + (rnd() - 0.5) * 0.15, 8, { ao: false });
  B.box('plain', 0x3a2416, 0.28, 0.03, 0.2, -3.4, 0.815, D / 2 - 0.4, -0.2, { ao: false }); B.cyl('plain', 0x222222, 0.005, 0.005, 0.12, -3.3, 0.84, D / 2 - 0.38, 4, { rz: 1.1, ao: false });
  const fund = ctex(THREE, 'c:fund', 48, 128, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 48, 128); g.fillStyle = '#222'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('NEW ROOF', 24, 12); g.fillText('FUND', 24, 22); g.fillText('$12,000', 24, 34); g.strokeStyle = '#c02020'; g.lineWidth = 2; g.strokeRect(18, 40, 12, 70); g.fillStyle = '#c02020'; g.fillRect(19, 98, 10, 12); g.beginPath(); g.arc(24, 115, 9, 0, 7); g.fill(); g.fillStyle = '#222'; g.font = '6px sans-serif'; g.fillText('$212', 38, 100); }, { repeat: false });
  B.def('fund', { kind: 'lambert', map: fund }); B.quad('fund', 0xffffff, 0.3, 0.8, -3.3, 1.6, D / 2 - 0.02, Math.PI, { ao: false, tint: false });
  for (let k = 0; k < 4; k++) { B.box('wood', 0x4a3222, 0.06, 0.06, 0.06, 2.4 + k * 0.4, 1.7, D / 2 - 0.04, 0, { ao: false }); if (k === 1) { B.box('cloth', 0x5a4a3a, 0.4, 0.7, 0.14, 2.8, 1.3, D / 2 - 0.12, 0, { aoLo: 0.8 }); } if (k === 3) B.box('cloth', 0xd04070, 0.3, 0.2, 0.1, 3.6, 1.6, D / 2 - 0.1, 0.3, { ao: false }); }
  // double doors (inside faces), slightly open crack of night between them
  for (const e of [-1, 1]) B.quad('wood', 0x6a2020, 0.76, 2.45, e * 0.4, 1.225, D / 2 - 0.04, Math.PI, { ao: false, sy: 5, paint: (_x, y) => 0.6 + 0.4 * sm(y / 0.9) });
  for (const e of [-1, 1]) for (const y of [0.7, 1.75]) B.quad('wood', 0x5a1818, 0.5, 0.7, e * 0.4, y, D / 2 - 0.06, Math.PI, { ao: false, tint: false });
  for (const e of [-1, 1]) B.box('shiny', 0xd8b050, 0.04, 0.25, 0.04, e * 0.1, 1.1, D / 2 - 0.1, 0, { ao: false });
  // stained glass: 4 tall arched windows per side + a rose window over the altar, all self-lit
  const glassTex = (key, pal, rose = false) => ctex(THREE, 'c:' + key, 48, rose ? 48 : 112, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.save(); g.beginPath(); if (rose) g.arc(24, 24, 23, 0, 7); else { g.moveTo(2, h - 2); g.lineTo(2, 24); g.arc(24, 24, 22, Math.PI, 0); g.lineTo(w - 2, h - 2); g.closePath(); } g.clip();
    g.fillStyle = pal[0]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = pal[1 + (i % (pal.length - 1))]; const x = rnd() * w, y = rnd() * h, s = 8 + rnd() * 12; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * 0.3); g.lineTo(x + s * 0.4, y + s); g.lineTo(x - s * 0.4, y + s * 0.6); g.fill(); }
    if (rose) { for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; g.fillStyle = pal[1 + k % (pal.length - 1)]; g.beginPath(); g.ellipse(24 + Math.cos(a) * 12, 24 + Math.sin(a) * 12, 7, 4, a, 0, 7); g.fill(); } g.fillStyle = '#ffe8a0'; g.beginPath(); g.arc(24, 24, 6, 0, 7); g.fill(); }
    else { g.fillStyle = '#ffe8a0'; g.beginPath(); g.arc(24, 40, 8, 0, 7); g.fill(); g.fillStyle = pal[2]; g.fillRect(16, 60, 16, 30); g.fillStyle = '#f0d0a0'; g.beginPath(); g.arc(24, 56, 6, 0, 7); g.fill(); }
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.5; for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(rnd() * w, rnd() * h); g.lineTo(rnd() * w, rnd() * h); g.stroke(); }
    g.restore(); g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.beginPath(); if (rose) g.arc(24, 24, 22, 0, 7); else { g.moveTo(3, h - 2); g.lineTo(3, 24); g.arc(24, 24, 21, Math.PI, 0); g.lineTo(w - 3, h - 2); } g.stroke();
  }, { repeat: false });
  const pals = [['#2a4a9a', '#e0b030', '#c03030', '#e8e8f0'], ['#8a2030', '#f0c040', '#3a7a40', '#e8e8f0'], ['#3a7a40', '#e0b030', '#2a4a9a', '#f0f0f0'], ['#6a3a8a', '#e0b030', '#e06030', '#e8e8f0']];
  for (let k = 0; k < 4; k++) { const t = glassTex('glass' + k, pals[k]); B.def('sg' + k, { kind: 'basic', map: t, transparent: true, alphaTest: 0.3 }); }
  const sgRose = glassTex('rose', ['#2a4a9a', '#e0b030', '#c03030', '#3a7a40', '#e8e8f0'], true); B.def('sgRose', { kind: 'basic', map: sgRose, transparent: true, alphaTest: 0.3 });
  const winZ = [-5, -1.5, 2, 5.5];
  for (let k = 0; k < 4; k++) for (const e of [-1, 1]) {
    const z = winZ[k], x = e * (W / 2 - 0.03), ry = e < 0 ? Math.PI / 2 : -Math.PI / 2;
    B.quad('sg' + ((k + (e > 0 ? 2 : 0)) % 4), 0xffffff, 1.1, 2.6, x, 2.7, z, ry, { ao: false, tint: false });
    B.box('wood', 0x4a3222, 0.14, 0.08, 1.3, x, 1.38, z, 0, { ao: false }); // sill
  }
  B.quad('sgRose', 0xffffff, 1.6, 1.6, 0, 3.6, -D / 2 + 0.03, 0, { ao: false, tint: false });
  // soft coloured light pools under the windows painted onto the floor
  B.def('pool', { kind: 'basic', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let k = 0; k < 4; k++) for (const e of [-1, 1]) B.flat('pool', [0x4060ff, 0xff5060, 0x40ff70, 0xc060ff][(k + (e > 0 ? 2 : 0)) % 4], 1.6, 1.2, e * (W / 2 - 0.85), 0.014, winZ[k], 0, { ao: false, tint: false });

  const group = B.finish(new THREE.Group());
  cols.push(
    { kind: 'box', cx: 0, cz: -D / 2 + 1.0, w: 1.9, d: 0.8, rot: 0, h: 1.15 },     // altar (standable)
    { kind: 'box', cx: px0, cz: pz0, w: 0.9, d: 0.6, rot: 0.25, h: 1.5 },           // pulpit
    { kind: 'box', cx: ix, cz: iz, w: 1.6, d: 0.7, rot: ia, h: 1.7 },               // piano
    { kind: 'box', cx: ix + Math.sin(ia) * 0.95, cz: iz + Math.cos(ia) * 0.95, w: 0.9, d: 0.35, rot: ia, h: 0.55 }, // bench
    ...[0, 1, 2, 3, 4, 5].flatMap((r) => [-1, 1].flatMap((e) => [
      { kind: 'box', cx: e * 2.5, cz: -1.9 + r * 1.35 - 0.02, w: 3.3, d: 0.5, rot: 0, h: 0.5 },     // pew seat (sit / stand)
      { kind: 'box', cx: e * 2.5, cz: -1.9 + r * 1.35 + 0.25, w: 3.3, d: 0.1, rot: 0, h: 0.95 },    // pew back
    ])),
    { kind: 'box', cx: -3.3, cz: D / 2 - 0.4, w: 1.6, d: 0.5, rot: 0, h: 0.82 },   // narthex table
  );
  // walkable: the step (0.15) and the chancel platform (0.3); the altar, pews, piano and tables are standable col tops
  const floors = [
    { top: 0.15, x0: -1.5, x1: 1.5, z0: -D / 2 + 4.0, z1: -D / 2 + 4.5 },
    { top: 0.3, x0: -(W - 0.2) / 2, x1: (W - 0.2) / 2, z0: -D / 2, z1: -D / 2 + 4.0 },
  ];
  return {
    group, size: [W, D], cols, floors,
    spawn: { x: 0, z: 6.6, yaw: 0 },
    exit: { x: 0, z: D / 2 + 0.05, r: 0.7 },
    lights: [
      { x: 0, y: H - 1.7, z: -3.5, c: 0xffe0b0, i: 1.1, always: true },
      { x: 0, y: H - 1.7, z: 0.5, c: 0xffe0b0, i: 1.1, always: true },
      { x: 0, y: H - 1.7, z: 4.5, c: 0xffe0b0, i: 1.0, always: true },
      { x: 0, y: 1.8, z: -D / 2 + 1.4, c: 0xffd090, i: 0.8, always: true, flicker: true },  // altar candles
      { x: -3.2, y: 2.4, z: -1.5, c: 0x8090ff, i: 0.45, always: true },               // window spill
      { x: 3.2, y: 2.4, z: 2, c: 0xff9070, i: 0.45, always: true },
    ],
    cam: { maxDist: 5.0, height: 2.4 },
    interact: [
      { id: 'pew', x: -2.5, z: 2.2, r: 1.0, label: 'Sit in a pew' },
      { id: 'piano', x: ix + Math.sin(ia) * 1.3, z: iz + Math.cos(ia) * 1.3, r: 0.8, label: 'Play the piano' },
      { id: 'pulpit', x: px0 + Math.sin(0.25) * 0.9, z: pz0 + Math.cos(0.25) * 0.9, r: 0.8, label: 'Pulpit' },
      { id: 'altar', x: 0, z: -D / 2 + 1.9, r: 0.8, label: 'Altar' },
      { id: 'offering', x: -3.3, z: D / 2 - 1.1, r: 0.7, label: 'Offering plate' },
    ],
  };
}

// =====================================================================================================
// 6. The Donut Hole: 10 x 7 m pink donut shop, 3 m ceiling. Display case + register counter along the
//    back, kitchen pass-through with the fryer glow, three tiny tables, neon donut in the window.
//    Currency is FISH (barter): fish scale on the counter, prices in bluegill, a bucket of ice by the register.
// =====================================================================================================
function buildDonut(ctx) {
  const { THREE, T } = ctx; seed = 67;
  const B = makeBuilder(THREE, T);
  const W = 10, D = 7, H = 3.0;
  const PINK = 0xffd0e0, PLUM = 0xb05070;
  const tile = ctex(THREE, 'o:tile', 64, 64, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#f2d8e0' : '#f8f0ea'; g.fillRect(x * 32, y * 32, 32, 32); }
    g.strokeStyle = 'rgba(120,60,80,0.35)'; for (let k = 0; k <= 64; k += 32) { g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, 64); g.moveTo(0, k + 0.5); g.lineTo(64, k + 0.5); g.stroke(); }
    grime(g, 64, 64, 220, 0.2); g.fillStyle = 'rgba(200,120,60,0.3)'; g.beginPath(); g.ellipse(44, 18, 7, 4, 0.5, 0, 7); g.fill(); // old coffee stain
  });
  const owall = ctex(THREE, 'o:wall', 64, 64, (g) => {
    g.fillStyle = '#fbe4ec'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#f4cdd9'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 8, 64);
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(120,60,80,${0.05 + rnd() * 0.08})`; g.fillRect(rnd() * 64, rnd() * 64, 3, 1); } // scuffs
    g.fillStyle = 'rgba(140,100,60,0.25)'; g.beginPath(); g.moveTo(50, 0); g.lineTo(56, 0); g.lineTo(58, 14); g.lineTo(52, 12); g.fill(); // water stain
  });
  const oceil = ctex(THREE, 'o:ceil', 64, 64, (g) => { g.fillStyle = '#ece4dc'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#a89890'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(rnd() * 64, rnd() * 64, 1, 1); } g.fillStyle = 'rgba(140,100,50,0.4)'; g.beginPath(); g.arc(18, 44, 10, 0, 7); g.fill(); });
  B.def('otile', { kind: 'lambert', map: tile }); B.def('owall', { kind: 'lambert', map: owall }); B.def('oceil', { kind: 'lambert', map: oceil });
  const cols = shell(B, THREE, { w: W, d: D, h: H, floorKey: 'otile', wallKey: 'owall', ceilKey: 'oceil', ceilCol: 0xffffff, door: { x: 0, w: 1.1, h: 2.1 }, base: PLUM, frame: 0xffffff, wallTile: 1.5, floorTile: 1, trim: { c: PLUM, y: 1.05, h: 0.1 } });
  // store windows either side of the door (match the outside: x = -3 / +3, 2 x 1.5), night outside with pink spill
  const night = ctex(THREE, 'o:night', 64, 32, (g) => { g.fillStyle = '#131828'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#2a2a44'; g.fillRect(0, 24, 64, 8); g.fillStyle = 'rgba(255,120,190,0.35)'; g.fillRect(0, 0, 64, 12); g.fillStyle = '#f0d060'; g.fillRect(44, 20, 5, 3); }, { repeat: false });
  B.def('night', { kind: 'basic', map: night });
  for (const x of [-3, 3]) {
    B.quad('night', 0xffffff, 2.0, 1.5, x, 1.6, D / 2 - 0.02, Math.PI, { ao: false, tint: false });
    for (const y of [2.38, 0.82]) B.quad('plain', 0xffffff, 2.1, 0.06, x, y, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
    for (const e of [-1, 1]) B.quad('plain', 0xffffff, 0.06, 1.6, x + e * 1.03, 1.6, D / 2 - 0.03, Math.PI, { ao: false, tint: false });
  }
  // neon donut sign hanging in the right window (reads from outside; glows inside too)
  B.add(new THREE.TorusGeometry(0.42, 0.07, 6, 16), 'glow', 0xff5aa8, 3, 1.65, D / 2 - 0.12, 0, { ao: false, tint: false });
  B.add(new THREE.TorusGeometry(0.42, 0.025, 4, 16), 'glow', 0xfff0a0, 3, 1.65, D / 2 - 0.17, 0, { ao: false, tint: false });
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + 0.3; B.box('glow', pick([0x60f0ff, 0xf0ff60, 0xffffff]), 0.1, 0.03, 0.03, 3 + Math.cos(a) * 0.42, 1.65 + Math.sin(a) * 0.42, D / 2 - 0.11, a + 0.8, { ao: false, tint: false }); }
  for (const e of [-1, 1]) B.cyl('plain', 0x333333, 0.004, 0.004, 0.65, 3 + e * 0.3, 2.4, D / 2 - 0.12, 3, { ao: false });
  const hot = signTex(THREE, 'o:hot', ['HOT NOW'], null, '#ff5aa8', 128, 40, { glow: true });
  B.def('hot', { kind: 'basic', map: hot, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  B.quad('hot', 0xffffff, 0.8, 0.25, -3, 2.2, D / 2 - 0.1, Math.PI, { ao: false, tint: false });
  const sorry = signTex(THREE, 'o:sorry', ['SORRY', "WE'RE OPEN"], '#fff', '#b05070', 96, 64, { border: '#b05070' });
  B.def('sorry', { kind: 'lambert', map: sorry }); B.quad('sorry', 0xffffff, 0.36, 0.24, -0.9, 1.9, D / 2 - 0.05, Math.PI, { ao: false, tint: false });
  // door: white with a big glass pane and a plum push bar
  B.quad('plain', 0xffffff, 1.06, 2.05, 0, 1.03, D / 2 - 0.04, Math.PI, { ao: false, sy: 4, paint: (_x, y) => 0.65 + 0.35 * sm(y / 0.8) });
  B.quad('night', 0xffffff, 0.8, 1.2, 0, 1.4, D / 2 - 0.06, Math.PI, { ao: false, tint: false }); B.quad('plain', PLUM, 0.9, 0.06, 0, 1.0, D / 2 - 0.08, Math.PI, { ao: false, tint: false });
  // --- counter along the back: display case on the left half, register on the right half, fish scale + ice bucket
  const cz = -D / 2 + 1.6;
  B.box('plain', 0xf4e0e6, 7.4, 0.9, 0.7, -0.3, 0.45, cz); B.box('plain', PLUM, 7.4, 0.3, 0.7, -0.3, 0.15, cz, 0, { ao: false }); B.box('shiny', 0xfff4f0, 7.5, 0.05, 0.8, -0.3, 0.925, cz, 0, { ao: false });
  // glass case: 3 shelves of donuts
  const gx = -2.1;
  B.box('glass', 0xe8f4ff, 3.4, 0.7, 0.72, gx, 1.3, cz); B.box('shiny', 0xd8dce4, 3.42, 0.03, 0.74, gx, 1.66, cz, 0, { ao: false }); B.box('shiny', 0xd8dce4, 3.42, 0.03, 0.74, gx, 0.95, cz, 0, { ao: false }); for (const e of [-1, 1]) B.box('shiny', 0xd8dce4, 0.03, 0.7, 0.74, gx + e * 1.7, 1.3, cz, 0, { ao: false });
  B.box('plain', 0xf8f4ec, 3.3, 0.02, 0.6, gx, 1.3, cz, 0, { ao: false });  // middle shelf
  const donut = (x, y, z, kind) => {
    const r = 0.075, t = 0.03;
    const base = kind === 'choc' ? 0x5a3a20 : 0xd8a050;
    B.add(new THREE.TorusGeometry(r, t, 5, 10), 'plain', base, x, y + t, z, 0, { ao: false, tint: false, rx: Math.PI / 2 });
    if (kind === 'glazed') B.add(new THREE.TorusGeometry(r, t * 0.8, 5, 10), 'shiny', 0xf8ecd0, x, y + t + 0.012, z, 0, { ao: false, tint: false, rx: Math.PI / 2 });
    if (kind === 'pink' || kind === 'choc') { B.add(new THREE.TorusGeometry(r, t * 0.8, 5, 10), 'plain', kind === 'pink' ? 0xff80b0 : 0x3a2010, x, y + t + 0.012, z, 0, { ao: false, tint: false, rx: Math.PI / 2 }); for (let k = 0; k < 7; k++) { const a = rnd() * 6.3, rr = r + (rnd() - 0.5) * 0.03; B.box('plain', pick([0x60f0ff, 0xf0ff60, 0xffffff, 0x60ff80, 0xff6060]), 0.016, 0.005, 0.005, x + Math.cos(a) * rr, y + 2 * t + 0.016, z + Math.sin(a) * rr, rnd() * 3, { ao: false, tint: false }); } }
    if (kind === 'jelly') { B.sph('plain', 0xe8c070, r * 1.1, x, y + 0.04, z, { ao: false, tint: false, s: [1, 0.6, 1] }); B.sph('plain', 0xc02040, 0.012, x + 0.07, y + 0.035, z, { ao: false, tint: false, ws: 5, hs: 4 }); }
    if (kind === 'maple') { B.box('plain', 0xe0b060, 0.2, 0.045, 0.085, x, y + 0.022, z, 0.1, { ao: false, tint: false }); B.box('plain', 0xb86a20, 0.19, 0.012, 0.075, x, y + 0.05, z, 0.1, { ao: false, tint: false }); }
    if (kind === 'cruller') B.add(new THREE.TorusGeometry(r, t * 0.9, 4, 7), 'plain', 0xe8d090, x, y + t, z, 0, { ao: false, tint: false, rx: Math.PI / 2 });
  };
  const rows = [['glazed', 'glazed', 'glazed', 'pink', 'pink', 'choc', 'choc', 'glazed'], ['jelly', 'jelly', 'maple', 'maple', 'pink', 'glazed', 'choc', 'jelly']];
  rows.forEach((row, ri) => row.forEach((k, i) => { B.box('plain', 0xffffff, 0.3, 0.004, 0.28, gx - 1.45 + i * 0.41, 0.965 + ri * 0.35, cz + 0.02, 0, { ao: false }); donut(gx - 1.45 + i * 0.41 + (rnd() - 0.5) * 0.04, 0.97 + ri * 0.35, cz + 0.02 + (rnd() - 0.5) * 0.06, k); }));
  donut(gx + 1.2, 1.32, cz + 0.05, 'cruller');   // the sad lone cruller, no tray, no friends
  const tags = ['GLAZED', 'SPRINKLE', 'CHOC', 'JELLY', 'MAPLE', 'CRULLER (1 LEFT)'];
  tags.forEach((t, i) => { const tx = signTex(THREE, 'o:tag' + i, [t], '#fff', '#b05070', 96, 24, { border: '#b05070' }); B.def('otag' + i, { kind: 'lambert', map: tx }); B.quad('otag' + i, 0xffffff, 0.3, 0.075, gx - 1.5 + i * 0.6, 0.99, cz + 0.3, 0, { ao: false, tint: false }); });
  // register + fish scale + PAY HERE sign + bell + take-a-number + tip jar of buttons + ice bucket
  const rx0 = 1.6;
  B.box('plain', 0xf0ece0, 0.42, 0.26, 0.42, rx0, 1.08, cz - 0.1, -0.15); B.box('plain', 0x333333, 0.36, 0.22, 0.06, rx0, 1.3, cz - 0.28, -0.15); B.quad('glow', 0x80ff90, 0.3, 0.14, rx0 - 0.03, 1.3, cz - 0.24, -0.15, { ao: false, tint: false });
  const scx = 2.8;
  B.cyl('shiny', 0xcfd4d8, 0.16, 0.18, 0.06, scx, 0.98, cz + 0.05, 10, { ao: false }); B.cyl('shiny', 0xcfd4d8, 0.03, 0.03, 0.4, scx, 1.2, cz - 0.1, 6, { ao: false }); B.cyl('shiny', 0xf4f4f4, 0.12, 0.12, 0.05, scx, 1.4, cz - 0.1, 12, { ao: false, rx: Math.PI / 2 });
  B.cyl('shiny', 0xcfd4d8, 0.15, 0.15, 0.015, scx, 1.02, cz + 0.05, 10, { ao: false }); B.box('plain', 0x222222, 0.004, 0.08, 0.004, scx, 1.41, cz - 0.07, 0, { ao: false, rz: 0.6 });
  B.box('plain', 0x6a9ab0, 0.2, 0.05, 0.07, scx + 0.03, 1.07, cz + 0.05, 0.4, { ao: false }); B.box('plain', 0x6a9ab0, 0.06, 0.07, 0.04, scx + 0.15, 1.09, cz + 0.1, 0.4, { ao: false }); // a bluegill on the scale
  const pay = signTex(THREE, 'o:pay', ['WE ACCEPT', 'FISH', '(NO BOOTS)'], '#fff8c0', '#b05070', 128, 80, { border: '#b05070', tape: true });
  B.def('pay', { kind: 'lambert', map: pay }); B.quad('pay', 0xffffff, 0.42, 0.26, scx, 1.62, cz - 0.13, 0, { ao: false, tint: false });
  B.cyl('shiny', 0xd8b050, 0.05, 0.06, 0.05, rx0 - 0.5, 0.975, cz + 0.15, 10, { ao: false }); B.sph('shiny', 0xd8b050, 0.012, rx0 - 0.5, 1.01, cz + 0.15, { ao: false }); // bell
  const ring = signTex(THREE, 'o:ring', ['RING FOR', 'SERVICE', '(once.)'], '#fff', '#222', 64, 48, { font: 'sans-serif' }); B.def('ring', { kind: 'lambert', map: ring }); B.quad('ring', 0xffffff, 0.16, 0.12, rx0 - 0.5, 1.03, cz + 0.28, 0, { ao: false, tint: false });
  B.cyl('glass', 0xffffff, 0.08, 0.07, 0.18, rx0 + 0.55, 1.04, cz + 0.1, 10, { ao: false }); for (let k = 0; k < 14; k++) B.cyl('plain', pick([0xf04040, 0x4060c0, 0xf0e040, 0xffffff, 0x222222]), 0.02, 0.02, 0.006, rx0 + 0.55 + (rnd() - 0.5) * 0.1, 0.96 + rnd() * 0.12, cz + 0.1 + (rnd() - 0.5) * 0.1, 8, { ao: false, tint: false, rx: rnd() * 2 });
  const tips = signTex(THREE, 'o:tips', ['TIPS', '(buttons ok)'], '#fff', '#222', 64, 40, { font: 'sans-serif' }); B.def('tips', { kind: 'lambert', map: tips }); B.quad('tips', 0xffffff, 0.14, 0.09, rx0 + 0.55, 1.04, cz + 0.18, 0, { ao: false, tint: false });
  B.box('plain', 0xd03030, 0.14, 0.18, 0.1, 3.1, 1.04, cz + 0.2, 0.2); B.box('plain', 0xffffff, 0.06, 0.03, 0.02, 3.1, 1.0, cz + 0.26, 0.2, { ao: false });
  const num = signTex(THREE, 'o:num', ['TAKE A', 'NUMBER', 'now serving: 2'], '#d03030', '#fff', 64, 48); B.def('num', { kind: 'lambert', map: num }); B.quad('num', 0xffffff, 0.13, 0.1, 3.1 + Math.sin(0.2) * 0.051, 1.1, cz + 0.2 + Math.cos(0.2) * 0.051, 0.2, { ao: false, tint: false });
  // bucket of ice with a fish tail sticking out, parked at the end of the counter
  B.cyl('plain', 0x4a7ab0, 0.22, 0.18, 0.4, 3.9, 0.2, cz + 0.6, 10); B.cyl('shiny', 0xe8f8ff, 0.2, 0.2, 0.04, 3.9, 0.41, cz + 0.6, 10, { ao: false });
  for (let k = 0; k < 8; k++) B.box('shiny', 0xf0fbff, 0.05, 0.04, 0.05, 3.9 + (rnd() - 0.5) * 0.3, 0.44, cz + 0.6 + (rnd() - 0.5) * 0.3, rnd() * 3, { ao: false, tint: false });
  B.box('plain', 0x6a9ab0, 0.07, 0.22, 0.05, 3.95, 0.52, cz + 0.55, 0.3, { rz: 0.25, ao: false }); for (const e of [-1, 1]) B.box('plain', 0x6a9ab0, 0.1, 0.09, 0.03, 3.95 + e * 0.05 + 0.03, 0.66 + 0.03, cz + 0.55, 0.3, { rz: e * 0.7, ao: false });
  const fishy = signTex(THREE, 'o:fishy', ['TODAYS', 'CATCH', '= PETTY CASH'], '#4a7ab0', '#fff', 64, 48); B.def('fishy', { kind: 'lambert', map: fishy }); B.quad('fishy', 0xffffff, 0.22, 0.16, 3.9, 0.25, cz + 0.82, 0, { ao: false, tint: false });
  // --- back wall: menu board priced in fish, pass-through with fryer glow, coffee urn, napkins, "employee of the month"
  const menu = ctex(THREE, 'o:menu', 256, 128, (g) => {
    g.fillStyle = '#4a2030'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ff80b0'; g.fillRect(0, 0, 256, 22);
    textLines(g, ['THE DONUT HOLE  -  PRICES IN FISH'], 128, 11, 0, 'bold 14px Impact, sans-serif', '#4a2030');
    const items = [['GLAZED', '1 bluegill'], ['SPRINKLE / CHOC', '1 bluegill'], ['MAPLE BAR', '2 bluegill'], ['DOZEN', '1 bass'], ['COFFEE', '1 minnow'], ['DAY-OLD', '1 old boot, fine']];
    g.font = '10px monospace'; g.fillStyle = '#fff0f6'; items.forEach(([n, p], i) => { g.textAlign = 'left'; g.fillText(n, 10, 38 + i * 14); g.textAlign = 'right'; g.fillText(p, 246, 38 + i * 14); });
    g.font = '7px monospace'; g.textAlign = 'left'; g.fillStyle = '#ffb0d0'; g.fillText('no refunds. no boots. we can tell.', 10, 124);
  }, { repeat: false });
  B.def('menu', { kind: 'lambert', map: menu }); B.box('plain', 0x2a1018, 2.4, 1.2, 0.04, -2.6, 2.2, -D / 2 + 0.02, 0, { ao: false }); B.quad('menu', 0xffffff, 2.3, 1.1, -2.6, 2.2, -D / 2 + 0.05, 0, { ao: false, tint: false });
  // pass-through: opening into the kitchen with the fryer's orange glow, fryer baskets, a rack of cooling donuts
  B.quad('glow', 0x2a1408, 1.8, 1.0, 0.6, 1.9, -D / 2 + 0.03, 0, { ao: false, tint: false }); B.quad('glow', 0xff9a40, 1.8, 0.14, 0.6, 1.47, -D / 2 + 0.035, 0, { ao: false, tint: false }); B.quad('glow', 0xff6a20, 0.6, 0.5, 0.3, 1.75, -D / 2 + 0.036, 0, { ao: false, tint: false });
  B.box('shiny', 0xcfd4d8, 1.9, 0.05, 0.3, 0.6, 1.38, -D / 2 + 0.15, 0, { ao: false }); B.box('shiny', 0xd8dce4, 0.4, 0.04, 0.26, 1.2, 1.42, -D / 2 + 0.17, 0, { ao: false }); for (let k = 0; k < 4; k++) donut(1.05 + k * 0.1, 1.44, -D / 2 + 0.17, 'glazed');
  B.box('shiny', 0x8a8a90, 0.3, 0.2, 0.25, 0.8, 1.5, -D / 2 + 0.2, 0, { ao: false }); B.cyl('shiny', 0x8a8a90, 0.01, 0.01, 0.3, 0.8, 1.7, -D / 2 + 0.2, 4, { ao: false, rz: 0.8 }); // fryer basket
  const order = signTex(THREE, 'o:order', ['ORDER UP'], '#fff', '#222', 96, 24, { font: 'sans-serif' }); B.def('order', { kind: 'lambert', map: order }); B.quad('order', 0xffffff, 0.5, 0.12, 0.6, 2.5, -D / 2 + 0.04, 0, { ao: false, tint: false });
  // coffee urn + cups + creamer on a back shelf, napkin holder, employee of the month (a photo of the owner's cat)
  B.box('plain', 0xf4e0e6, 1.4, 0.9, 0.5, 3.0, 0.45, -D / 2 + 0.3); B.box('shiny', 0xfff4f0, 1.42, 0.04, 0.52, 3.0, 0.92, -D / 2 + 0.3, 0, { ao: false });
  B.cyl('shiny', 0xcfd4d8, 0.17, 0.17, 0.5, 2.7, 1.19, -D / 2 + 0.3, 12, { ao: false }); B.cyl('shiny', 0xcfd4d8, 0.08, 0.17, 0.06, 2.7, 1.47, -D / 2 + 0.3, 12, { ao: false }); B.box('plain', 0x222222, 0.03, 0.08, 0.05, 2.7, 1.02, -D / 2 + 0.48, 0, { ao: false }); B.box('glow', 0xff4040, 0.02, 0.02, 0.01, 2.7, 1.3, -D / 2 + 0.475, 0, { ao: false, tint: false });
  for (let k = 0; k < 6; k++) B.cyl('plain', 0xf8f4ec, 0.045, 0.04, 0.09, 3.2 + (k % 3) * 0.12, 0.985 + ((k / 3) | 0) * 0.09, -D / 2 + 0.3, 8, { ao: false });
  B.box('plain', 0xf4f0e8, 0.08, 0.14, 0.08, 3.55, 1.01, -D / 2 + 0.3, 0, { ao: false }); B.box('shiny', 0xd8dce4, 0.12, 0.14, 0.14, 2.3, 1.01, -D / 2 + 0.3);
  const eotm = ctex(THREE, 'o:eotm', 48, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#b05070'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText('EMPLOYEE', 24, 9); g.fillText('OF THE MONTH', 24, 17); g.fillStyle = '#d8c8b0'; g.fillRect(8, 20, 32, 32); g.fillStyle = '#e8a040'; g.beginPath(); g.arc(24, 38, 10, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(19, 35, 2, 3); g.fillRect(27, 35, 2, 3); g.beginPath(); g.moveTo(15, 30); g.lineTo(17, 23); g.lineTo(21, 29); g.moveTo(33, 30); g.lineTo(31, 23); g.lineTo(27, 29); g.fill(); g.fillStyle = '#222'; g.font = '6px sans-serif'; g.fillText('"BISCUIT"', 24, 60); }, { repeat: false });
  B.def('eotm', { kind: 'lambert', map: eotm }); framedPicture(B, THREE, 'eotm', 0.3, 0.4, 3.6, 2.1, -D / 2 + 0.02, 0, 0xb05070);
  // --- bulletin board on the left wall: lost-cat posters (one is Goobles), a flyer, a business card
  B.box('plain', 0xc8a060, 1.3, 0.9, 0.04, -W / 2 + 0.04, 1.75, 0.6, Math.PI / 2, { ao: false }); B.box('plain', 0xffffff, 1.4, 1.0, 0.03, -W / 2 + 0.03, 1.75, 0.6, Math.PI / 2, { ao: false });
  const lostG = ctex(THREE, 'o:lostG', 48, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#111'; g.font = 'bold 9px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('LOST CAT', 24, 11); g.fillStyle = '#f8f8f8'; g.fillRect(10, 15, 28, 26); g.strokeStyle = '#333'; g.strokeRect(10, 15, 28, 26); g.fillStyle = '#eee'; g.beginPath(); g.arc(24, 30, 8, 0, 7); g.fill(); g.fillStyle = '#556040'; g.beginPath(); g.arc(24, 25, 8, Math.PI, 0); g.fill(); g.fillStyle = '#111'; for (let i = 0; i < 4; i++) g.fillRect(18 + i * 4, 25, 2, 3); g.fillStyle = '#222'; g.font = '5px sans-serif'; g.fillText('WHITE. GRUMPY.', 24, 48); g.fillText('WEARS A HELMET', 24, 55); g.fillText('REWARD: 2 BLUEGILL', 24, 62); }, { repeat: false });
  const lostO = ctex(THREE, 'o:lostO', 48, 64, (g) => { g.fillStyle = '#fff8c0'; g.fillRect(0, 0, 48, 64); g.fillStyle = '#111'; g.font = 'bold 9px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('LOST CAT', 24, 11); g.fillStyle = '#d8d8d8'; g.fillRect(10, 15, 28, 26); g.fillStyle = '#e8a040'; g.beginPath(); g.arc(24, 28, 9, 0, 7); g.fill(); g.fillStyle = '#222'; g.font = '5px sans-serif'; g.fillText('"MR. BISCUITS"', 24, 48); g.fillText('ANSWERS TO FOOD', 24, 55); g.fillText('NOT ACTUALLY LOST', 24, 62); }, { repeat: false });
  const flyer = signTex(THREE, 'o:flyer', ['BAKE SALE', 'CHAPEL HILL', 'SUNDAY', '(bring fish)'], '#d0e8ff', '#1a3a6a', 64, 80, { font: 'sans-serif' });
  B.def('lostG', { kind: 'lambert', map: lostG }); B.def('lostO', { kind: 'lambert', map: lostO }); B.def('flyer', { kind: 'lambert', map: flyer });
  for (const [key, w, h, dz, dy, rr] of [['lostG', 0.3, 0.4, -0.4, 0.05, 0.05], ['lostO', 0.3, 0.4, 0.0, -0.02, -0.08], ['flyer', 0.28, 0.35, 0.4, 0.03, 0.04]]) B.quad(key, 0xffffff, w, h, -W / 2 + 0.06, 1.75 + dy, 0.6 + dz, Math.PI / 2, { ao: false, tint: false, rz: 0, paint: () => 1, ...(rr ? {} : {}) });
  for (const dz of [-0.4, 0, 0.4]) B.sph('plain', pick([0xf04040, 0x4060c0, 0xf0e040]), 0.012, -W / 2 + 0.07, 1.95, 0.6 + dz, { ao: false, tint: false, ws: 5, hs: 4 });
  const notice = signTex(THREE, 'o:notice', ['BULLETIN', 'BOARD', '(no HOA notices, Gary)'], '#b05070', '#fff', 128, 48); B.def('notice', { kind: 'lambert', map: notice }); B.quad('notice', 0xffffff, 0.8, 0.2, -W / 2 + 0.06, 2.4, 0.6, Math.PI / 2, { ao: false, tint: false });
  // --- three tiny round tables with stools; one wobbles on a folded napkin
  const table = (tx, tz, o = {}) => {
    B.cyl('shiny', 0xfff4f0, 0.42, 0.42, 0.04, tx, 0.74, tz, 12, { ao: false }); B.cyl('shiny', PLUM, 0.44, 0.44, 0.02, tx, 0.72, tz, 12, { ao: false }); B.cyl('shiny', 0xcfd4d8, 0.04, 0.04, 0.7, tx, 0.36, tz, 8); B.cyl('shiny', 0xcfd4d8, 0.3, 0.3, 0.03, tx, 0.015, tz, 10, { ao: false });
    for (let k = 0; k < (o.stools || 3); k++) { const a = k / 3 * 6.283 + (o.a || 0); const sx = tx + Math.cos(a) * 0.65, sz = tz + Math.sin(a) * 0.65; B.cyl('shiny', 0xcfd4d8, 0.03, 0.03, 0.45, sx, 0.22, sz, 6); B.cyl('cloth', o.c || 0xff8ab8, 0.16, 0.15, 0.08, sx, 0.49, sz, 10, { ao: false }); B.cyl('shiny', 0xcfd4d8, 0.14, 0.14, 0.02, sx, 0.01, sz, 8, { ao: false }); }
    B.box('plain', 0xf0d8e0, 0.1, 0.1, 0.1, tx + 0.2, 0.81, tz - 0.1, 0.3, { ao: false }); B.box('plain', 0xd8dce4, 0.04, 0.12, 0.08, tx - 0.15, 0.82, tz + 0.1, 0, { ao: false });
    if (o.cup) { B.cyl('plain', 0xf8f4ec, 0.045, 0.04, 0.09, tx - 0.05, 0.805, tz - 0.2, 8, { ao: false }); B.cyl('plain', 0x3a2410, 0.035, 0.035, 0.01, tx - 0.05, 0.845, tz - 0.2, 8, { ao: false }); }
    if (o.crumbs) { B.box('plain', 0xffffff, 0.22, 0.003, 0.22, tx + 0.05, 0.762, tz + 0.15, 0.4, { ao: false }); for (let k = 0; k < 8; k++) B.box('plain', pick([0xe0b060, 0xff80b0, 0x60f0ff]), 0.012, 0.005, 0.012, tx + 0.05 + (rnd() - 0.5) * 0.18, 0.766, tz + 0.15 + (rnd() - 0.5) * 0.18, rnd(), { ao: false, tint: false }); }
    if (o.paper) B.box('plain', 0xe8e8e0, 0.3, 0.004, 0.42, tx, 0.762, tz, -0.2, { ao: false });
    if (o.wobble) B.box('plain', 0xffffff, 0.08, 0.02, 0.08, tx + 0.22, 0.01, tz + 0.1, 0.5, { ao: false });
  };
  table(-3.0, 0.9, { cup: true, crumbs: true, a: 0.5 }); table(-1.3, 1.4, { paper: true, stools: 2, a: 1.1, c: 0xd03060 }); table(2.8, 1.2, { wobble: true, cup: true, a: 0.2 });
  // misc: pink trash can with a lid, a wet-floor cone, a potted fake plant, a highchair, a fly zapper
  B.cyl('plain', 0xff8ab8, 0.25, 0.22, 0.75, 4.4, 0.375, 2.6, 10); B.cyl('plain', PLUM, 0.27, 0.27, 0.06, 4.4, 0.78, 2.6, 10, { ao: false }); B.box('plain', 0x222222, 0.2, 0.02, 0.2, 4.4, 0.8, 2.6, 0, { ao: false });
  const thanks = signTex(THREE, 'o:thanks', ['THANK', 'YOU'], null, '#b05070', 64, 48); B.def('thanks', { kind: 'lambert', map: thanks, transparent: true, alphaTest: 0.3 }); B.quad('thanks', 0xffffff, 0.3, 0.22, 4.4, 0.45, 2.86, 0, { ao: false, tint: false });
  B.cyl('plain', 0xf0d020, 0.02, 0.18, 0.55, -4.3, 0.275, 2.5, 6); B.box('plain', 0xf0d020, 0.4, 0.03, 0.4, -4.3, 0.015, 2.5, 0, { ao: false });
  B.cyl('plain', 0xc86a40, 0.15, 0.12, 0.3, -4.4, 0.15, -2.2, 8); B.sph('plain', 0x4a8a4a, 0.28, -4.4, 0.55, -2.2, { ao: false, s: [1, 1.2, 1], ws: 7, hs: 5 });
  B.box('wood', 0x8a6238, 0.4, 0.6, 0.4, 4.2, 0.6, -0.9); for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B.box('wood', 0x8a6238, 0.04, 0.6, 0.04, 4.2 + lx, 0.3, -0.9 + lz); B.box('plain', 0xf8f4ec, 0.44, 0.04, 0.3, 4.2, 0.92, -1.1, 0, { ao: false });
  B.box('plain', 0x333333, 0.3, 0.4, 0.12, W / 2 - 0.1, 2.5, 1.2, 0, { ao: false }); B.quad('glow', 0xa0b0ff, 0.22, 0.32, W / 2 - 0.17, 2.5, 1.2, -Math.PI / 2, { ao: false, tint: false });
  // ceiling: two fluorescent fixtures and a pink pendant over the case
  tubeLight(B, -2.5, H - 0.1, 0.4, 1.2, 0, 0xfff4f8); tubeLight(B, 2.5, H - 0.1, 0.4, 1.2, 0, 0xfff4f8);
  B.cyl('plain', 0x333333, 0.01, 0.01, 0.5, -2.1, H - 0.25, cz + 0.3, 4, { ao: false }); B.cyl('plain', 0xff8ab8, 0.1, 0.3, 0.22, -2.1, H - 0.58, cz + 0.3, 10, { ao: false }); B.sph('glow', 0xfff0c0, 0.07, -2.1, H - 0.68, cz + 0.3, { ao: false, tint: false });

  const group = B.finish(new THREE.Group());
  cols.push(
    { kind: 'box', cx: -2.1, cz, w: 3.5, d: 0.8, rot: 0, h: 1.7 },                 // display case
    { kind: 'box', cx: -3.9, cz, w: 0.35, d: 0.8, rot: 0, h: 0.95 }, { kind: 'box', cx: 1.5, cz, w: 3.9, d: 0.8, rot: 0, h: 0.95 }, // counter (standable)
    { kind: 'box', cx: 3.0, cz: -D / 2 + 0.3, w: 1.4, d: 0.6, rot: 0, h: 1.5 },     // coffee shelf
    { kind: 'box', cx: 3.9, cz: cz + 0.6, w: 0.5, d: 0.5, rot: 0, h: 0.7 },        // ice bucket
    ...[[-3.0, 0.9], [-1.3, 1.4], [2.8, 1.2]].map(([x, z]) => ({ kind: 'box', cx: x, cz: z, w: 0.9, d: 0.9, rot: 0, h: 0.76 })),
    { kind: 'box', cx: 4.4, cz: 2.6, w: 0.55, d: 0.55, rot: 0, h: 0.82 },           // trash can
    { kind: 'box', cx: -4.3, cz: 2.5, w: 0.4, d: 0.4, rot: 0, h: 0.6 },             // cone
    { kind: 'box', cx: -4.4, cz: -2.2, w: 0.5, d: 0.5, rot: 0, h: 0.9 },            // plant
    { kind: 'box', cx: 4.2, cz: -0.95, w: 0.5, d: 0.55, rot: 0, h: 0.95, top: 0.62 }, // highchair (seat)
  );
  return {
    group, size: [W, D], cols, floors: [],
    spawn: { x: 0, z: 2.2, yaw: 0 },
    exit: { x: 0, z: D / 2 + 0.05, r: 0.6 },
    lights: [
      { x: -2.5, y: H - 0.3, z: 0.4, c: 0xfff0f4, i: 0.9, always: true },
      { x: 2.5, y: H - 0.3, z: 0.4, c: 0xfff0f4, i: 0.9, always: true },
      { x: -2.1, y: H - 0.8, z: cz + 0.3, c: 0xffd0a0, i: 0.7, always: true },      // pendant over the case
      { x: 0.6, y: 1.8, z: -D / 2 + 0.5, c: 0xff8a30, i: 0.6, always: true, flicker: true },  // fryer
      { x: 3, y: 1.7, z: D / 2 - 0.4, c: 0xff5aa8, i: 0.6, always: true },          // neon donut
    ],
    cam: { maxDist: 4.5, height: 2.2 },
    interact: [
      { id: 'counter', x: 1.6, z: cz + 0.95, r: 0.9, label: 'Buy donuts' },
      { id: 'bell', x: 1.1, z: cz + 0.9, r: 0.6, label: 'Ring the bell' },
      { id: 'table', x: -1.3, z: 2.3, r: 0.9, label: 'Sit down' },
      { id: 'board', x: -4.2, z: 0.6, r: 0.8, label: 'Bulletin board' },
    ],
  };
}

export const ROOMS = {
  rv: { name: "Goobles' RV", build: buildRV },
  quik: { name: 'Quik Stop', build: buildQuik },
  diner: { name: "Rosie's Diner", build: buildDiner },
  nana: { name: "Nana's House", build: buildNana },
  church: { name: 'Chapel Hill Church', build: buildChurch },
  donut: { name: 'The Donut Hole', build: buildDonut },
};
