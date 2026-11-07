// The town of Maple Grove (starting area / chunk 1), hand-laid and built into a few merged meshes,
// plus colliders, the road graph, districts and the minimap drawing.
//
// Layout (north is -z):
//   north edge: Highway 9 behind a fence (ramp closed = exit to a future chunk)
//   NW: Maple Grove Estates (Gary's HOA subdivision, cul-de-sac mansion, HOA office)
//   N:  Old Mill Farm (Feed & Seed, water tower, corn)     NE: Maple Grove High + football field
//   centre: Downtown crossroads (Quik Stop, Suds N Paws, Donut Hole, Rosie's Diner, town green)
//   W:  Chapel Hill (church + cemetery), then the dirt road to Nana's farmhouse and the RV lot
//   far W + S: Hollow Woods (the haunted forest) right behind the RV
//   S:  Lake Juniper with Lakeside Park (raccoons), dock, bait shack
//   SE: Pine Hollow (older country neighbourhood, trailers and farmhouses)
//   south edge: Old Mill Rd bridge out (exit to a future chunk)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, phong, basic, rnd } from './gfx.js';
import { makeRV, makeCar } from './models.js';
import { initRoads } from './roads.js';
import { initGround } from './ground.js';
import { prepareWorld, makeGroundMesh, patchMaterial, floors, setFloorProvider } from './terrain.js';

export const LIMIT = 145;      // playable half-size (x: ±LIMIT, z: -126..LIMIT)
export const NORTH = -126;     // highway fence
export const MAP_HALF = 150;   // minimap half-size

export const colliders = [];  // {x0,x1,z0,z1,h} boxes, {cx,cz,r,h} circles, {ob,cx,cz,hw,hd,c,s,h} rotated boxes
export const places = {};
export const zones = [];      // {name,x0,x1,z0,z1}
export const animated = [];   // {obj, fn(t)}
export const nightMats = [];  // materials that glow at night
export const lamps = [];
export const lights = [];     // {x,y,z,c,i,d} light sources the dynamic light pool picks from
export const halos = [];      // {x,y,z,s,c} glow sprites (night)
export const signMats = [];   // sign materials that glow at night
export const flames = [];     // {x,y,z}
const MAP = [];               // minimap shapes
function signMat(map, o = {}) { const m = basic({ map, ...o }); signMats.push(m); return m; }

const buckets = {};
const NO_AO = new Set(['grass', 'road', 'asphalt', 'crosswalk', 'sidewalk', 'dirt', 'shadow', 'shadowR', 'lamp', 'puddle', 'storeWin', 'posterCat', 'posterHoa', 'graffiti', 'shingle', 'leaves']);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

function addS(geo, key, color, x, y, z, ry = 0) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  if (!NO_AO.has(key)) {
    // baked ambient occlusion: darker near the ground, plus a little per-object variation
    const pos = g.attributes.position, tint = 0.9 + Math.random() * 0.14;
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i), t = Math.min(1, Math.max(0, y / 2.4));
      const f = (0.42 + 0.58 * t * t * (3 - 2 * t)) * tint;
      col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
    }
  }
  g.userData.o = [x, z]; // engine: geometry origin (terrain anchor)
  (buckets[key] ||= []).push(g);
}

function plane(w, d, sw = 1, sd = 1, us = 1, vs = 1) {
  const g = new THREE.PlaneGeometry(w, d, sw, sd);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * us, uv.getY(i) * vs);
  return g;
}
function boxUV(w, h, d, scale = 0.5) {
  // box with world-scaled UVs so textures tile at a fixed density
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    if (ny > 0.5) uv.setXY(i, px * scale, pz * scale);
    else if (nx > 0.5) uv.setXY(i, pz * scale, py * scale);
    else uv.setXY(i, px * scale, py * scale);
  }
  return g;
}
function gable(w, h, d) {
  // ridge along x at height h, base w (x) by d (z)
  const x = w / 2, z = d / 2;
  const P = [
    [-x, 0, z], [x, 0, z], [x, h, 0], [-x, 0, z], [x, h, 0], [-x, h, 0],     // front slope
    [x, 0, -z], [-x, 0, -z], [-x, h, 0], [x, 0, -z], [-x, h, 0], [x, h, 0],  // back slope
    [-x, 0, -z], [-x, 0, z], [-x, h, 0], [x, 0, z], [x, 0, -z], [x, h, 0],   // gables
  ];
  const sl = Math.hypot(z, h) / 2;
  const U = [
    [0, 0], [w / 2, 0], [w / 2, sl], [0, 0], [w / 2, sl], [0, sl],
    [0, 0], [w / 2, 0], [w / 2, sl], [0, 0], [w / 2, sl], [0, sl],
    [0, 0], [d / 2, 0], [d / 4, h / 2], [0, 0], [d / 2, 0], [d / 4, h / 2],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U.flat(), 2));
  g.computeVertexNormals();
  return g;
}

/** Box collider; any angle (axis-aligned when ry is a multiple of 90 degrees). */
function colBox(cx, cz, w, d, h = 3, ry = 0, o = {}) {
  const s = Math.sin(ry), c = Math.cos(ry);
  if (Math.abs(s) < 0.01 || Math.abs(c) < 0.01) {
    const sw = Math.abs(s) > 0.5 ? d : w, sd = Math.abs(s) > 0.5 ? w : d;
    colliders.push({ x0: cx - sw / 2, x1: cx + sw / 2, z0: cz - sd / 2, z1: cz + sd / 2, h, ...o });
  } else colliders.push({ ob: true, cx, cz, hw: w / 2, hd: d / 2, c, s, h, ...o });
}

// rotate local (lx,lz) by ry around (cx,cz); local +z faces (sin ry, cos ry)
function rot(cx, cz, lx, lz, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [cx + lx * c + lz * s, cz - lx * s + lz * c];
}

/** A local frame for building things at (cx,cz) facing ry. Front of a building is local +z. */
let SCENE = null, TEX = null;
function frame(cx, cz, ry) {
  const at = (lx, lz) => rot(cx, cz, lx, lz, ry);
  const F = {
    at,
    box(lx, y, lz, w, h, d, key, col, rr = 0) { const [x, z] = at(lx, lz); addS(key === 'plain' || key === 'metal' || key === 'lamp' ? new THREE.BoxGeometry(w, h, d) : boxUV(w, h, d, 0.5), key, col, x, y, z, ry + rr); },
    geo(g, key, col, lx, y, lz, rr = 0) { const [x, z] = at(lx, lz); addS(g, key, col, x, y, z, ry + rr); },
    face(lx, y, lz, w, h, key, col, dir = 0) { // dir 0 front(+z) 1 back(-z) 2 right(+x) 3 left(-x)
      const g = plane(w, h).rotateX(Math.PI / 2);
      if (dir) g.rotateY([0, Math.PI, Math.PI / 2, -Math.PI / 2][dir]);
      const [x, z] = at(lx, lz); addS(g, key, col, x, y, z, ry);
    },
    ramp(lx, lz, w, d, t0, t1, rr = 0) { const [x, z] = at(lx, lz), a = ry + rr; floors.push({ t0, t1, cx: x, cz: z, hw: w / 2, hd: d / 2, c: Math.cos(a), s: Math.sin(a) }); }, // engine: walkable slope
    floor(lx, lz, w, d, top, rr = 0) { const [x, z] = at(lx, lz), a = ry + rr; floors.push({ top, cx: x, cz: z, hw: w / 2, hd: d / 2, c: Math.cos(a), s: Math.sin(a) }); }, // engine: walkable deck
    col(lx, lz, w, d, h = 3, rr = 0, o) { const [x, z] = at(lx, lz); colBox(x, z, w, d, h, ry + rr, o); },
    bld(lx, lz, w, d, h = 4) { F.col(lx, lz, w, d, h, 0, { bld: true }); },
    post(lx, lz, r = 0.2, h = 3) { const [x, z] = at(lx, lz); colliders.push({ cx: x, cz: z, r, h }); },
    sign(text, bg, fg, w, h, y, lz, o = {}) {
      const lx = o.lx || 0;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMat(TEX.sign(text, bg, fg, o.tw || 256, o.th || 48, o.glow), o.double ? { side: THREE.DoubleSide } : {}));
      const [x, z] = at(lx, lz); m.position.set(x, y, z); m.rotation.y = ry + (o.rr || 0); SCENE.add(m); return m;
    },
    light(lx, y, lz, c, i, o = {}) { const [x, z] = at(lx, lz); lights.push({ x, y, z, c, i, ...o }); },
    halo(lx, y, lz, s, c) { const [x, z] = at(lx, lz); halos.push({ x, y, z, s, c }); },
    flat(lx, lz, w, d, key, col = 0xffffff, y = 0.05, map) {
      const ts = key === 'grass' ? 6 : 5;
      F.geo(plane(w, d, Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(d / 10)), w / ts, d / ts), key, col, lx, y, lz);
      if (map) { const [x, z] = at(lx, lz); MAP.push({ t: 'rect', x, z, w, d, ry, col: map }); }
    },
  };
  return F;
}

// ---------- road graph ----------
export const NODES = [];   // {x,z,name}
export const ADJ = [];     // per node: [{n, w, dirt, nt}]  (nt = no traffic)
export const EDGES = [];   // {a,b,w,dirt,nt}
const N = {};
function nd(name, x, z) { N[name] = NODES.length; NODES.push({ x, z, name }); ADJ.push([]); }
function link(names, o = {}) {
  const t = o.t || (o.dirt ? 'dirt' : 'paved'), w = o.w || (t === 'hwy' ? 12 : t === 'dirt' ? 7 : 10);
  for (let i = 0; i < names.length - 1; i++) {
    const a = N[names[i]], b = N[names[i + 1]], e = { w, t, dirt: t === 'dirt', nt: !!o.nt };
    EDGES.push({ a, b, ...e });
    ADJ[a].push({ n: b, ...e }); ADJ[b].push({ n: a, ...e });
  }
}
// Old Mill Rd (the diagonal county road), Main St, School Rd, Frontage Rd
nd('RAMP', -58, -121); nd('A', -50, -110); nd('B', -28, -62); nd('X', 0, 0); nd('D', 40, 45); nd('E', 60, 95); nd('F', 72, 136);
nd('W1', -58, 0); nd('W2', -92, 0); nd('W3', -92, 46);
nd('M1', 60, 0); nd('M2', 128, 0);
// Highway 9 runs through town: in from the north (closed past the fence), down Old Mill Rd to downtown, then east along Main St
nd('HN', -66, -152); nd('HE', 140, 0); nd('HX', 205, 0);
nd('S1', 60, -55); nd('S2', 60, -108);
// Maple Grove Estates
nd('G1', -58, -62); nd('G2', -98, -62); nd('G3', -58, -100); nd('G4', -98, -100); nd('G5', -114, -62);
// Lake roads
nd('L1', 0, 50); nd('L2', -50, 54);
// Pine Hollow
nd('P1', 60, 45); nd('PC', 94, 45); nd('P2', 128, 45); nd('P4', 128, 95); nd('PC2', 94, 72);

link(['HN', 'RAMP'], { t: 'hwy', nt: true });
link(['RAMP', 'A'], { t: 'hwy', nt: true });
link(['A', 'B', 'X'], { t: 'hwy' });
link(['X', 'D', 'E', 'F']);
link(['W1', 'X']);
link(['X', 'M1', 'M2', 'HE'], { t: 'hwy' });
link(['HE', 'HX'], { t: 'hwy', nt: true });
NODES[N.X].cw = true;
link(['M2', 'P2'], { dirt: true });
link(['M1', 'S1', 'S2', 'A']);
link(['B', 'G1', 'G2', 'G5']);
link(['G1', 'G3', 'G4', 'G2']);
link(['G3', 'A']);
link(['X', 'L1', 'D']);
link(['W1', 'W2', 'W3', 'L2', 'L1'], { dirt: true });
link(['D', 'P1', 'PC', 'P2', 'P4', 'E']);
link(['M1', 'P1']);
link(['PC', 'PC2']);
const BULBS = [['G5', 9], ['PC2', 9]];
for (const [k, r] of BULBS) NODES[N[k]].bulb = r;

/** Where the race and other scripted things go. */
places.raceRoute = ['M1', 'S1', 'S2', 'A', 'B', 'X', 'L1', 'L2', 'W3', 'W2', 'W1', 'X'].map((k) => ({ x: NODES[N[k]].x, z: NODES[N[k]].z }));
places.raceStart = { x: 30, z: 0, yaw: Math.PI / 2 };

// ---------- districts ----------
const DISTRICTS = [
  ['Hollow Woods', (x, z) => (x < -113 && z > -40) || (z > 117 && x < 50)],
  ["Nana's Place", (x, z) => x < -84 && z > -5 && z < 62],
  ['Chapel Hill', (x, z) => x < -58 && z > -42 && z <= -5],
  ['Maple Grove Estates', (x, z) => x < -30 && z < -40],
  ['Lake Juniper', (x, z) => x > -84 && x < 48 && z > 50],
  ['Maple Grove High', (x, z) => x > 62 && z < -8],
  ['Old Mill Farm', (x, z) => x > -30 && x <= 62 && z < -50],
  ['Pine Hollow', (x, z) => x > 48 && z > 6],
  ['Downtown Maple Grove', () => true],
];
export function districtAt(x, z) { for (const [n, f] of DISTRICTS) if (f(x, z)) return n; return ''; }

// ---------- props ----------
function shadow(x, z, w, d, ry = 0, rect = false) {
  addS(plane(w, d), rect ? 'shadowR' : 'shadow', 0xffffff, x, 0.085 + Math.random() * 0.004, z, ry);
}
function tree(x, z, s = 1, o = {}) {
  shadow(x + 0.6, z + 0.4, 5.2 * s, 5.2 * s);
  addS(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 2.2 * s, 7), 'bark', 0xffffff, x, 1.1 * s, z);
  const kind = o.kind ?? (rnd() < 0.5 ? 'round' : 'pine');
  const tint = o.tint ?? 0xffffff;
  if (kind === 'round') {
    addS(new THREE.IcosahedronGeometry(1.7 * s, 1), 'leaves', tint, x, 3.2 * s, z, rnd() * 6);
    addS(new THREE.IcosahedronGeometry(1.2 * s, 1), 'leaves', new THREE.Color(tint).multiply(new THREE.Color(0xdfffd0)), x + 0.4, 4.3 * s, z - 0.2, rnd() * 6);
  } else {
    const t = new THREE.Color(tint);
    addS(new THREE.ConeGeometry(1.8 * s, 2.6 * s, 9), 'leaves', t.clone().multiply(new THREE.Color(0xc8e8c0)), x, 3.0 * s, z);
    addS(new THREE.ConeGeometry(1.3 * s, 2.2 * s, 9), 'leaves', t.clone().multiply(new THREE.Color(0xe0ffd8)), x, 4.3 * s, z);
    if (s > 1.2) addS(new THREE.ConeGeometry(0.9 * s, 1.8 * s, 8), 'leaves', t.clone().multiply(new THREE.Color(0xd8f8d0)), x, 5.4 * s, z);
  }
  colliders.push({ cx: x, cz: z, r: 0.4 * s, h: 6, tree: true });
}
function deadTree(x, z, s = 1) {
  // bare, twisted, grey: the haunted kind
  shadow(x + 0.4, z + 0.3, 3 * s, 3 * s);
  addS(new THREE.CylinderGeometry(0.12 * s, 0.3 * s, 4.2 * s, 6), 'bark', 0x9a9690, x, 2.1 * s, z);
  for (let k = 0; k < 4; k++) {
    const a = rnd() * 6.28, len = (1.2 + rnd() * 1.4) * s, tilt = 0.6 + rnd() * 0.6;
    const g = new THREE.CylinderGeometry(0.04 * s, 0.09 * s, len, 5);
    g.translate(0, len / 2, 0); g.rotateZ(tilt); g.rotateY(a);
    addS(g, 'bark', 0x8a8680, x, (2.2 + k * 0.5) * s, z);
  }
  colliders.push({ cx: x, cz: z, r: 0.35 * s, h: 6, tree: true });
}
function bush(x, z, s = 1, c = 0xb0e0a0) { addS(new THREE.IcosahedronGeometry(0.7 * s, 1), 'leaves', c, x, 0.45 * s, z, rnd() * 6); }
function fence(x0, z0, x1, z1, h = 1.2, color = 0xffffff) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  const g = new THREE.BoxGeometry(len, h, 0.1);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 3);
  addS(g, 'fence', color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, ry);
  colBox((x0 + x1) / 2, (z0 + z1) / 2, len + 0.2, 0.3, h, ry);
}
function streetLamp(x, z, ry) {
  addS(new THREE.CylinderGeometry(0.32, 0.38, 0.5, 8), 'plain', 0x8a8a86, x, 0.25, z);
  addS(new THREE.CylinderGeometry(0.07, 0.11, 6, 8), 'metal', 0xb8bcc4, x, 3, z);
  const [ax, az] = rot(x, z, 0, 1.0, ry);
  addS(new THREE.BoxGeometry(0.09, 0.09, 2.0), 'metal', 0xb8bcc4, (x + ax) / 2, 6, (z + az) / 2, ry);
  addS(new THREE.BoxGeometry(0.42, 0.14, 0.7), 'metal', 0xc8ccd4, ax, 5.95, az, ry);
  addS(new THREE.BoxGeometry(0.34, 0.04, 0.6), 'lamp', 0xffffff, ax, 5.87, az, ry);
  colliders.push({ cx: x, cz: z, r: 0.2, h: 6, brk: 'lamp', ry });
  lamps.push([ax, az]);
  lights.push({ x: ax, y: 5.4, z: az, c: 0xffd8a8, i: 1 });
  halos.push({ x: ax, y: 5.8, z: az, s: 3.2, c: 0xc8a8ff });
}
/** Street lamp beside the road through node `a` toward `b`, at distance t along it, on side s. */
function lampAlong(a, b, t, s = 1) {
  const A = NODES[N[a]], B = NODES[N[b]], L = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
  const nx = -dz * s, nz = dx * s, x = A.x + dx * t + nx * 6.6, z = A.z + dz * t + nz * 6.6;
  streetLamp(x, z, Math.atan2(-nx, -nz));
}
function hydrant(x, z) {
  addS(new THREE.CylinderGeometry(0.16, 0.2, 0.65, 8), 'plain', 0xd8302a, x, 0.33, z);
  addS(new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 'plain', 0xd8302a, x, 0.65, z);
  addS(new THREE.CylinderGeometry(0.07, 0.07, 0.48, 6).rotateZ(Math.PI / 2), 'metal', 0xd8d8d8, x, 0.45, z);
  colliders.push({ cx: x, cz: z, r: 0.2, h: 0.8, brk: 'hydrant' });
}
function trashCan(x, z, c = 0x3a4a5a) {
  addS(new THREE.CylinderGeometry(0.3, 0.26, 0.9, 10), 'plain', c, x, 0.45, z);
  addS(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 10), 'plain', c, x, 0.93, z);
  colliders.push({ cx: x, cz: z, r: 0.3, h: 1 });
}
function puddle(x, z, r) {
  const g = new THREE.CircleGeometry(r, 12); g.rotateX(-Math.PI / 2); g.scale(1, 1, 0.5 + Math.random() * 0.5);
  addS(g, 'puddle', 0xffffff, x, 0.045, z, Math.random() * 3);
}
function mailbox(x, z, ry, c) {
  addS(new THREE.BoxGeometry(0.08, 1, 0.08), 'wood', 0xffffff, x, 0.5, z);
  addS(new THREE.BoxGeometry(0.25, 0.2, 0.45), 'plain', c, x, 1.08, z, ry);
  addS(new THREE.CylinderGeometry(0.125, 0.125, 0.45, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2), 'plain', c, x, 1.18, z, ry);
}
function bench(F, lx, lz, rr = 0) {
  const [x, z] = F.at(lx, lz), ry = Math.atan2(...F.at(0, 1).map((v, i) => v - F.at(0, 0)[i])) + rr;
  addS(new THREE.BoxGeometry(1.8, 0.08, 0.5), 'wood', 0xffffff, x, 0.5, z, ry);
  const [bx, bz] = rot(x, z, 0, -0.25, ry);
  addS(new THREE.BoxGeometry(1.8, 0.5, 0.08), 'wood', 0xffffff, bx, 0.8, bz, ry);
  colBox(x, z, 1.8, 0.6, 1, ry, { top: 0.55 }); // engine: stand on the seat
}
function picnic(x, z, ry = 0) {
  addS(new THREE.BoxGeometry(2, 0.08, 0.9), 'wood', 0xffffff, x, 0.75, z, ry);
  for (const s of [-1, 1]) { const [sx, sz] = rot(x, z, 0, s * 0.8, ry); addS(new THREE.BoxGeometry(2, 0.06, 0.3), 'wood', 0xe0d0c0, sx, 0.45, sz, ry); }
  colBox(x, z, 2, 1.8, 0.8, ry);
}
function barrel(x, z, c = 0xff7a1a) {
  addS(new THREE.CylinderGeometry(0.32, 0.32, 1, 10), 'plain', c, x, 0.5, z);
  for (const y of [0.3, 0.7]) addS(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 10), 'plain', 0xffffff, x, y, z);
  colliders.push({ cx: x, cz: z, r: 0.33, h: 1 });
}
function sawhorse(x, z, ry) {
  addS(new THREE.BoxGeometry(2.4, 0.3, 0.06), 'plain', 0xf06a20, x, 0.9, z, ry);
  for (const s of [-1, 1]) { const [lx, lz] = rot(x, z, s * 1, 0, ry); addS(new THREE.BoxGeometry(0.06, 0.9, 0.5), 'wood', 0xffffff, lx, 0.45, lz, ry); }
  colBox(x, z, 2.4, 0.5, 1, ry);
}
function rock(x, z, s = 1, c = 0x8a8a84) {
  addS(new THREE.DodecahedronGeometry(0.6 * s, 0).scale(1, 0.6, 1), 'plain', c, x, 0.2 * s, z, rnd() * 6);
  colliders.push({ cx: x, cz: z, r: 0.55 * s, h: 0.7 * s, top: 0.55 * s });
}
function hay(x, z, ry = 0) {
  addS(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12).rotateZ(Math.PI / 2), 'plain', 0xd8b860, x, 0.75, z, ry);
  colBox(x, z, 1.3, 1.5, 1.4, ry);
}

// ---------- houses ----------
const MAIL = [0x2f6fbf, 0x222222, 0xbf3030, 0x3a8f3a, 0xe0b030, 0xeeeeee];

function house(cx, cz, ry, o = {}) {
  const w = o.w || 9, d = o.d || 7, h = o.h || 3.2;
  const wall = o.wall, roof = o.roof;
  const [hx, hz] = rot(cx, cz, 0, 0, ry);
  addS(boxUV(w, h, d, 0.5), o.brick ? 'brick' : 'siding', wall, hx, h / 2, hz, ry);
  addS(gable(w + 1, o.rh || 2.0, d + 1), 'shingle', roof, hx, h, hz, ry);
  colBox(hx, hz, w, d, h + 2, ry, { bld: true });
  shadow(hx, hz, w + 3.2, d + 3.2, ry, true);
  // eave trim + foundation
  addS(new THREE.BoxGeometry(w + 0.1, 0.35, d + 0.1), 'plain', 0x8a8478, hx, 0.17, hz, ry);
  const fz = d / 2 + 0.03;
  // door + windows on the front (+z local)
  const garage = o.garage !== false && w >= 9;
  const doorX = garage ? -0.8 : 0;
  let [x, z] = rot(cx, cz, doorX, fz, ry);
  addS(plane(1.0, 2.0).rotateX(Math.PI / 2), 'door', o.door ?? 0x7a3b2a, x, 1.0, z, ry);
  for (const wx of garage ? [-3.0] : [-2.6, 2.6]) {
    if (Math.abs(wx) + 0.8 > w / 2) continue;
    [x, z] = rot(cx, cz, wx, fz, ry);
    addS(plane(1.4, 1.2).rotateX(Math.PI / 2), 'window', 0xffffff, x, 1.7, z, ry);
    if (o.shutters !== undefined) for (const s of [-1, 1]) { [x, z] = rot(cx, cz, wx + s * 0.95, fz + 0.02, ry); addS(plane(0.4, 1.3).rotateX(Math.PI / 2), 'plain', o.shutters, x, 1.7, z, ry); }
  }
  if (h > 5) { // second floor
    for (const wx of [-2.8, 0, 2.8]) {
      if (Math.abs(wx) + 0.8 > w / 2) continue;
      [x, z] = rot(cx, cz, wx, fz, ry); addS(plane(1.2, 1.2).rotateX(Math.PI / 2), 'window', 0xffffff, x, h - 1.6, z, ry);
      [x, z] = rot(cx, cz, wx, -fz, ry); addS(plane(1.2, 1.2).rotateX(Math.PI / 2).rotateY(Math.PI), 'window', 0xffffff, x, h - 1.6, z, ry);
    }
  }
  if (garage) {
    [x, z] = rot(cx, cz, w / 2 - 1.9, fz, ry);
    addS(plane(2.8, 2.3).rotateX(Math.PI / 2), 'garage', o.garageCol ?? 0xffffff, x, 1.15, z, ry);
  }
  // driveway to the road
  const dl = o.drive ?? 5;
  if (dl > 0) {
    [x, z] = rot(cx, cz, w / 2 - 1.9, d / 2 + dl / 2, ry);
    addS(plane(3.2, dl, 1, 1, 0.6, dl / 5), o.gravel ? 'dirt' : 'sidewalk', o.gravel ? 0xc8c0b0 : 0xe0ddd5, x, 0.07, z, ry);
  }
  // side and back windows
  for (const s of [-1, 1]) {
    [x, z] = rot(cx, cz, s * (w / 2 + 0.03), 0, ry);
    addS(plane(1.2, 1.1).rotateX(Math.PI / 2).rotateY(s * Math.PI / 2), 'window', 0xffffff, x, 1.7, z, ry);
  }
  [x, z] = rot(cx, cz, 0, -fz, ry);
  addS(plane(1.4, 1.1).rotateX(Math.PI / 2).rotateY(Math.PI), 'window', 0xffffff, x, 1.7, z, ry);
  // path from door toward the road + porch step
  const pl = Math.max(2, dl);
  [x, z] = rot(cx, cz, doorX, d / 2 + pl / 2, ry);
  addS(plane(1.0, pl), 'sidewalk', 0xd0ccc4, x, 0.065, z, ry);
  [x, z] = rot(cx, cz, doorX, d / 2 + 0.4, ry);
  addS(new THREE.BoxGeometry(1.8, 0.2, 0.8), 'plain', 0xb8b0a4, x, 0.1, z, ry);
  if (dl > 3) { [x, z] = rot(cx, cz, doorX + 1.5, d / 2 + dl - 0.6, ry); mailbox(x, z, ry, o.mail ?? MAIL[(rnd() * MAIL.length) | 0]); }
  return { door: rot(cx, cz, doorX, d / 2 + 1.6, ry), drive: rot(cx, cz, w / 2 - 1.9, d / 2 + Math.min(3, dl * 0.6), ry), ry };
}

function mobileHome(cx, cz, ry, o) {
  const F = frame(cx, cz, ry), w = 14, d = 4.4, h = 2.6;
  F.box(0, 0.35, 0, w - 0.2, 0.7, d - 0.2, 'fence', 0xc8c0b0);       // skirting
  F.box(0, 0.7 + h / 2, 0, w, h, d, 'siding', o.wall);
  F.geo(gable(w + 0.4, 0.5, d + 0.4), 'metal', o.roof, 0, 0.7 + h, 0);
  F.box(0, 1.35, 0, w + 0.02, 0.25, d + 0.02, 'plain', o.trim ?? 0x6a4a3a); // stripe
  F.bld(0, 0, w, d, h + 1.2);
  shadow(...F.at(0, 0), w + 2.6, d + 2.6, ry, true);
  F.face(-3.5, 1.7, d / 2 + 0.02, 0.9, 1.9, 'door', o.door ?? 0xf0f0f0);
  for (const wx of [-6, -1.2, 2, 5]) F.face(wx, 2.1, d / 2 + 0.02, 1.4, 0.9, 'window', 0xffffff);
  for (const wx of [-4, 3]) F.face(wx, 2.1, -d / 2 - 0.02, 1.2, 0.9, 'window', 0xffffff, 1);
  // wooden steps + little deck + awning
  F.box(-3.5, 0.35, d / 2 + 1.2, 2.6, 0.7, 2.2, 'wood', 0xd8c8b0);
  F.box(-3.5, 0.15, d / 2 + 2.6, 1.4, 0.3, 0.8, 'wood', 0xd8c8b0);
  F.geo(new THREE.BoxGeometry(3.6, 0.06, 2.2).rotateX(-0.12), 'metal', o.awning ?? 0x3a8f5a, -3.5, 3.4, d / 2 + 1.1);
  for (const s of [-1, 1]) F.box(-3.5 + s * 1.7, 1.7, d / 2 + 2.1, 0.08, 3.4, 0.08, 'metal', 0xcccccc);
  F.col(-3.5, d / 2 + 1.2, 2.6, 2.2, 0.7);
  F.light(-3.5, 2.8, d / 2 + 1.5, 0xffd8a0, 0.6);
  const dl = o.drive ?? 5;
  F.geo(plane(3.2, dl, 1, 1, 0.6, dl / 5), 'dirt', 0xc8c0b0, 4.5, 0.07, d / 2 + dl / 2);
  if (dl > 3) { const [mx, mz] = F.at(-1.8, d / 2 + dl - 0.6); mailbox(mx, mz, ry, o.mail ?? 0x222222); }
  return { door: F.at(-3.5, d / 2 + 3.2), drive: F.at(4.5, d / 2 + 2.5), ry };
}

function porch(F, w, d, h, roofCol, wrap = false) {
  const pd = 2.4, z0 = d / 2 + pd / 2;
  F.box(0, 0.2, z0, w + (wrap ? 2.4 : 0), 0.4, pd, 'wood', 0xe0d4c0);
  F.floor(0, z0, w + (wrap ? 2.4 : 0), pd, 0.4); // engine: walk on the porch
  F.geo(new THREE.BoxGeometry(w + (wrap ? 2.6 : 0.4), 0.12, pd + 0.4).rotateX(0.18), 'shingle', roofCol, 0, Math.min(h, 3.1), z0);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 3) { F.box(x, 1.5, d / 2 + pd - 0.15, 0.16, 2.8, 0.16, 'plain', 0xf4f0e8); F.post(x, d / 2 + pd - 0.15, 0.12, 3); }
  // rail in two runs with an opening for the steps up to the door (engine: solid, so you can't run through it)
  const rz = d / 2 + pd - 0.15, g0 = -1.7, g1 = 0.9;
  for (const [a, b] of [[-w / 2, g0], [g1, w / 2]]) { F.box((a + b) / 2, 0.75, rz, b - a, 0.06, 0.06, 'plain', 0xf4f0e8); F.col((a + b) / 2, rz, b - a, 0.16, 0.85); }
  F.light(0, 2.7, d / 2 + 1, 0xffd090, 0.7);
  F.halo(0, 2.8, d / 2 + 0.6, 1.2, 0xffd090);
}

/** Yard and roof extras: what makes each home that household's home. */
function extras(F, w, d, h, list, o) {
  for (const e of list) {
    if (e === 'pool') {
      F.geo(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 16), 'plain', 0x4a7ab0, w / 2 - 2, 0.6, -d / 2 - 4.5);
      F.geo(new THREE.CircleGeometry(2.3, 16).rotateX(-Math.PI / 2), 'puddle', 0x70b0e0, w / 2 - 2, 1.21, -d / 2 - 4.5);
      F.post(w / 2 - 2, -d / 2 - 4.5, 2.4, 1.2);
    } else if (e === 'tramp') {
      F.geo(new THREE.CylinderGeometry(1.8, 1.8, 0.08, 16), 'plain', 0x1a1a1a, -w / 2 - 1, 0.9, -d / 2 - 3.5);
      F.geo(new THREE.TorusGeometry(1.8, 0.07, 4, 16).rotateX(Math.PI / 2), 'plain', 0x2a7ad0, -w / 2 - 1, 0.92, -d / 2 - 3.5);
      { const [tx, tz] = F.at(-w / 2 - 1, -d / 2 - 3.5); floors.push({ top: 0.94, cx: tx, cz: tz, r: 1.75, bounce: true }); } // engine: trampoline
      for (let k = 0; k < 4; k++) F.box(-w / 2 - 1 + Math.cos(k * 1.57) * 1.7, 0.45, -d / 2 - 3.5 + Math.sin(k * 1.57) * 1.7, 0.08, 0.9, 0.08, 'metal', 0x888888);
    } else if (e === 'boat') {
      F.geo(new THREE.CylinderGeometry(0.9, 0.5, 4.2, 6, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI), 'plain', 0xf0f0f0, w / 2 + 2, 1.2, 0);
      F.box(w / 2 + 2, 1.25, 0, 1.75, 0.15, 4.0, 'plain', 0x2a5aa0);
      F.box(w / 2 + 2, 0.4, 0, 1.6, 0.12, 4.4, 'metal', 0x555555);
      F.col(w / 2 + 2, 0, 1.9, 4.4, 1.6);
    } else if (e === 'junker') {
      // a pickup on blocks, hood up, forever being fixed
      F.box(w / 2 + 3, 1.0, 1, 2, 0.9, 4.6, 'plain', o.junk ?? 0x8a4a2a);
      F.box(w / 2 + 3, 1.75, 1.6, 1.8, 0.7, 1.6, 'plain', o.junk ?? 0x8a4a2a);
      F.geo(new THREE.BoxGeometry(1.9, 0.06, 1.2).rotateX(-0.9), 'plain', o.junk ?? 0x8a4a2a, w / 2 + 3, 1.9, 3.7);
      for (const s of [-1, 1]) for (const zz of [-0.6, 2.6]) F.box(w / 2 + 3 + s * 0.8, 0.3, zz, 0.5, 0.6, 0.5, 'brick', 0xffffff);
      F.col(w / 2 + 3, 1, 2.1, 4.8, 2);
    } else if (e === 'garden') {
      for (let k = 0; k < 3; k++) {
        F.box(-w / 2 + 1.5 + k * 2.2, 0.2, -d / 2 - 3, 1.6, 0.4, 3, 'wood', 0xffffff);
        for (let j = 0; j < 4; j++) F.geo(new THREE.IcosahedronGeometry(0.28, 0), 'leaves', [0x80c060, 0xc04030, 0xe0c040][k], -w / 2 + 1.5 + k * 2.2, 0.55, -d / 2 - 4.1 + j * 0.7);
      }
    } else if (e === 'scarecrow') {
      F.box(-w / 2 - 2.5, 1.1, -d / 2 - 2, 0.1, 2.2, 0.1, 'wood', 0xffffff);
      F.box(-w / 2 - 2.5, 1.7, -d / 2 - 2, 1.6, 0.08, 0.08, 'wood', 0xffffff);
      F.box(-w / 2 - 2.5, 1.5, -d / 2 - 2, 0.6, 0.7, 0.3, 'plain', 0x8a3a2a);
      F.geo(new THREE.SphereGeometry(0.25, 6, 5), 'plain', 0xd8c890, -w / 2 - 2.5, 2.1, -d / 2 - 2);
      F.geo(new THREE.ConeGeometry(0.45, 0.35, 8), 'plain', 0xb89850, -w / 2 - 2.5, 2.4, -d / 2 - 2);
    } else if (e === 'dish') {
      F.geo(new THREE.SphereGeometry(0.45, 8, 4, 0, 6.28, 0, 1).rotateX(-1.1), 'plain', 0xdddddd, w / 2 - 1, h + 0.6, 0);
    } else if (e === 'chimney') {
      F.box(-w / 2 + 1.2, h + 1.2, -0.6, 0.9, 2.6, 0.9, 'brick', 0xffffff);
    } else if (e === 'flamingos') {
      for (let k = 0; k < 3; k++) {
        F.box(1.5 + k * 0.8, 0.35, d / 2 + 2.5 + (k % 2) * 0.5, 0.03, 0.7, 0.03, 'plain', 0x333333);
        F.geo(new THREE.IcosahedronGeometry(0.2, 0), 'plain', 0xff6fa8, 1.5 + k * 0.8, 0.8, d / 2 + 2.5 + (k % 2) * 0.5);
      }
    } else if (e === 'gnomes') {
      for (let k = 0; k < 4; k++) {
        F.geo(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 6), 'plain', [0x3a6ac0, 0x3a9a4a, 0x8a3ac0, 0x3a6ac0][k], -2 + k * 0.6, 0.15, d / 2 + 1.6);
        F.geo(new THREE.ConeGeometry(0.11, 0.3, 6), 'plain', 0xd02a2a, -2 + k * 0.6, 0.45, d / 2 + 1.6);
      }
    } else if (e === 'swing') {
      const tx = -w / 2 - 3, tz = -d / 2 - 3; const [x, z] = F.at(tx, tz); tree(x, z, 1.3, { kind: 'round' });
      F.box(tx + 1.4, 2.4, tz, 0.03, 2.6, 0.03, 'plain', 0x333333);
      F.geo(new THREE.TorusGeometry(0.35, 0.13, 5, 10), 'plain', 0x1a1a1a, tx + 1.4, 0.9, tz);
    } else if (e === 'shed') {
      F.box(w / 2 + 2.5, 1.1, -d / 2 - 2.5, 3, 2.2, 2.6, 'siding', o.shedCol ?? 0xc04a3a);
      F.geo(gable(3.4, 0.9, 3), 'shingle', 0x4a4a4a, w / 2 + 2.5, 2.2, -d / 2 - 2.5);
      F.face(w / 2 + 2.5, 0.9, -d / 2 - 1.18, 1.2, 1.8, 'door', 0xf0f0f0);
      F.col(w / 2 + 2.5, -d / 2 - 2.5, 3, 2.6, 2.5);
    } else if (e === 'hoop') {
      F.box(w / 2 - 0.2, 1.6, d / 2 + 4, 0.1, 3.2, 0.1, 'metal', 0x888888);
      F.box(w / 2 - 0.2, 3.1, d / 2 + 3.7, 1.2, 0.8, 0.05, 'plain', 0xf4f4f4);
      F.geo(new THREE.TorusGeometry(0.22, 0.02, 4, 10).rotateX(Math.PI / 2), 'plain', 0xe05020, w / 2 - 0.2, 2.8, d / 2 + 3.4);
      F.post(w / 2 - 0.2, d / 2 + 4, 0.1, 3);
    } else if (e === 'coop') {
      F.box(-w / 2 - 2.2, 0.9, -1, 2.2, 1.2, 1.6, 'wood', 0xffffff);
      F.geo(gable(2.5, 0.6, 1.8), 'metal', 0x8a8a8a, -w / 2 - 2.2, 1.5, -1);
      F.col(-w / 2 - 2.2, -1, 2.2, 1.6, 2);
      for (let k = 0; k < 4; k++) F.geo(new THREE.IcosahedronGeometry(0.16, 0), 'plain', k % 2 ? 0xf4f0e0 : 0xa0602a, -w / 2 - 3 + k * 0.6, 0.18, 0.6 + (k % 2) * 0.5);
    } else if (e === 'flag') {
      F.box(w / 2 + 0.5, 3, d / 2 + 2, 0.07, 6, 0.07, 'plain', 0xdddddd);
      F.box(w / 2 + 1.2, 5.5, d / 2 + 2, 1.4, 0.8, 0.03, 'plain', o.flag ?? 0x2050a0);
      F.post(w / 2 + 0.5, d / 2 + 2, 0.1, 6);
    } else if (e === 'pickets') {
      const [a0, a1] = [F.at(-w / 2 - 1, d / 2 + 3.6), F.at(w / 2 - 3.8, d / 2 + 3.6)];
      fence(a0[0], a0[1], a1[0], a1[1], 0.9, 0xffffff);
    } else if (e === 'hedges') {
      for (let x = -w / 2 - 1; x <= w / 2 + 1; x += 1.6) if (Math.abs(x - (w / 2 - 1.9)) > 2.2 && Math.abs(x) > 1) F.box(x, 0.45, d / 2 + 4.2, 1.5, 0.9, 0.9, 'leaves', 0xa0d090);
    } else if (e === 'xmas') {
      for (let k = 0; k < 9; k++) F.halo(-w / 2 + (k + 0.5) * w / 9, h - 0.1, d / 2 + 0.6, 0.55, [0xff4040, 0x40ff60, 0x4080ff, 0xffd040][k % 4]);
    } else if (e === 'woodpile') {
      for (let k = 0; k < 3; k++) F.geo(new THREE.BoxGeometry(2.4, 0.4, 0.5), 'wood', 0xc0a080, -w / 2 - 0.6, 0.2 + k * 0.4, -d / 2 + 1 + k * 0.05, Math.PI / 2);
      F.col(-w / 2 - 0.6, -d / 2 + 1, 0.6, 2.4, 1.2);
    } else if (e === 'tractor') {
      const tx = w / 2 + 3.5, tz = -d / 2 - 3;
      F.box(tx, 1.2, tz, 1.2, 0.9, 2.6, 'plain', 0x2a8a3a);
      F.box(tx, 1.9, tz - 0.6, 1.0, 0.6, 1.0, 'plain', 0x2a8a3a);
      for (const s of [-1, 1]) {
        F.geo(new THREE.CylinderGeometry(0.85, 0.85, 0.4, 10).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, tx + s * 0.85, 0.85, tz - 0.8);
        F.geo(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 8).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, tx + s * 0.75, 0.45, tz + 1.0);
      }
      F.col(tx, tz, 2.4, 3, 2.2);
    } else if (e === 'windchime') {
      F.halo(1.6, 2.3, d / 2 + 0.6, 0.7, 0x80c0ff);
    } else if (e === 'yardsale') {
      F.box(2, 0.75, d / 2 + 3.5, 2.2, 0.08, 0.9, 'wood', 0xffffff);
      for (let k = 0; k < 4; k++) F.box(1.3 + k * 0.45, 0.95, d / 2 + 3.5, 0.3, 0.3, 0.3, 'plain', [0xe04040, 0x40a0e0, 0xe0c040, 0x60c060][k]);
      F.col(2, d / 2 + 3.5, 2.2, 0.9, 1);
    } else if (e === 'lawnsigns') {
      // anti-HOA sign war
      for (let k = 0; k < 3; k++) {
        F.box(-3 + k * 1.2, 0.4, d / 2 + 4, 0.03, 0.8, 0.03, 'plain', 0x333333);
        F.box(-3 + k * 1.2, 0.85, d / 2 + 4, 0.8, 0.5, 0.03, 'plain', [0xe04040, 0xf4f4f4, 0x2a6ad0][k]);
      }
    }
  }
}

const homes = [];
/** One household. spec: {style, wall, roof, w, d, drive, extras, ...} */
function home(x, z, ry, spec) {
  const F = frame(x, z, ry);
  let info, w = spec.w || 9.5, d = spec.d || 7, h = 3.2;
  const st = spec.style;
  if (st === 'mobile') { w = 14; d = 4.4; h = 3.3; info = mobileHome(x, z, ry, spec); }
  else {
    const o = { ...spec, w, d };
    if (st === 'two') { h = o.h = 5.8; o.rh = 2.3; }
    if (st === 'farm') { h = o.h = 5.8; o.rh = 2.6; o.garage = false; }
    if (st === 'cottage') { w = o.w = spec.w || 7.5; d = o.d = 6.5; h = o.h = 3; o.rh = 3.2; o.garage = false; }
    if (st === 'brick') { o.brick = true; h = o.h = spec.h || 3.4; }
    if (st === 'colonial') { o.brick = true; h = o.h = 6; o.rh = 2.2; o.garage = false; }
    info = house(x, z, ry, o);
    if (st === 'farm' || spec.porch) porch(F, w, d, h, spec.roof, st === 'farm');
    if (st === 'colonial') {
      for (const s of [-1.3, 1.3]) { F.geo(new THREE.CylinderGeometry(0.22, 0.25, 4.6, 8), 'plain', 0xf4f4f0, s, 2.3, d / 2 + 1.4); F.post(s, d / 2 + 1.4, 0.25, 5); }
      F.geo(gable(3.8, 1, 1.8).rotateY(0), 'plain', 0xf4f4f0, 0, 4.6, d / 2 + 0.9);
    }
  }
  extras(F, w, d, h, spec.extras || [], spec);
  homes.push({ x, z, ry, spec });
  places.doors.push(info.door);
  places.drives.push({ x: info.drive[0], z: info.drive[1], ry });
  return info;
}

// ---------- the town ----------
export function buildWorld(scene, T) {
  SCENE = scene; TEX = T;
  const M = {
    grass: lambert({ map: T.grass, vertexColors: true }),
    road: phong({ map: T.road, vertexColors: true, shininess: 40, specular: 0x2a2a30 }),
    asphalt: phong({ map: T.asphalt, vertexColors: true, shininess: 40, specular: 0x2a2a30 }),
    crosswalk: phong({ map: T.crosswalk, vertexColors: true, shininess: 40, specular: 0x2a2a30 }),
    sidewalk: phong({ map: T.sidewalk, vertexColors: true, shininess: 20, specular: 0x1a1a1a }),
    puddle: phong({ color: 0x0c0e14, shininess: 140, specular: 0xcfd8ff, vertexColors: true }),
    metal: phong({ map: T.metal, vertexColors: true, shininess: 60, specular: 0x666666 }),
    shadow: basic({ map: T.shadow, transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2 }),
    shadowR: basic({ map: T.shadowRect, transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2 }),
    storeWin: basic({ map: T.windowLit, vertexColors: true }),
    posterCat: lambert({ map: T.posterCat, vertexColors: true }),
    posterHoa: lambert({ map: T.posterHoa, vertexColors: true }),
    graffiti: lambert({ map: T.graffiti, vertexColors: true, transparent: true, alphaTest: 0.3 }),
    dirt: lambert({ map: T.dirt, vertexColors: true }),
    siding: lambert({ map: T.siding, vertexColors: true }),
    brick: lambert({ map: T.brick, vertexColors: true }),
    shingle: lambert({ map: T.shingle, vertexColors: true }),
    window: lambert({ map: T.window, vertexColors: true }),
    door: lambert({ map: T.door, vertexColors: true }),
    garage: lambert({ map: T.garage, vertexColors: true }),
    leaves: lambert({ map: T.leaves, vertexColors: true }),
    bark: lambert({ map: T.bark, vertexColors: true }),
    fence: lambert({ map: T.fence, vertexColors: true }),
    wood: lambert({ map: T.wood, vertexColors: true }),
    plain: lambert({ vertexColors: true }),
    lamp: basic({ vertexColors: true, color: 0x888888 }),
    vending: basic({ map: T.vending }),
  };
  M.window.userData.night = T.windowLit; M.window.userData.day = T.window;
  nightMats.push(M.window, M.lamp);
  places.drives = [];
  places.doors = [];

  // ground (subdivided so affine mapping stays tolerable)
  addS(plane(400, 400, 40, 40, 400 / 6, 400 / 6), 'grass', 0xffffff, 0, 0, 0);

  initRoads(scene, M, NODES, ADJ, EDGES);
  buildRoads();
  buildEdges(scene);
  buildDowntown(scene, T);
  buildPoliceStation(); // police
  buildChapel();
  buildNanaAndRV(scene);
  buildForest();
  buildLake(scene, T);
  buildEstates();
  buildFarm();
  buildSchool();
  buildPineHollow();
  buildPoles(scene);

  // merge buckets
  // engine: terrain anchors + movable groups, then the terrain ground mesh
  const tctx = { colliders, EDGES, NODES, inLake, waterMat: WATER_MAT, rebuildGrid: () => { GRID = null; }, gridPatch };
  prepareWorld(buckets, tctx);
  if (tctx.ground) scene.add(makeGroundMesh(initGround(scene, M[tctx.ground.key], T, tctx)));
  for (const [k, list] of Object.entries(buckets)) {
    const g = mergeGeometries(list, false);
    const mesh = new THREE.Mesh(g, M[k]);
    patchMaterial(M[k]); mesh.userData.noLift = true; mesh.frustumCulled = false; // engine
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }
  gridBuild();
  return M;
}

// ---------- roads ----------
function buildRoads() {
  // road surfaces, markings, junctions and puddles are built (and rebuilt when edited) by roads.js
  // street lamps: downtown and the Estates are lit, the country roads are dark
  for (const t of [14, 34]) { lampAlong('X', 'W1', t, 1); lampAlong('X', 'W1', t + 10, -1); lampAlong('X', 'M1', t, -1); lampAlong('X', 'M1', t + 10, 1); }
  lampAlong('X', 'B', 16, 1); lampAlong('X', 'D', 16, -1); lampAlong('X', 'L1', 18, 1); lampAlong('B', 'A', 20, -1);
  for (const [a, b] of [['G1', 'G2'], ['G3', 'G4'], ['G1', 'G3'], ['G2', 'G4'], ['B', 'G1']]) lampAlong(a, b, 12, 1);
  lampAlong('G2', 'G5', 10, -1);
  for (const [a, b, s] of [['M1', 'S1', -1], ['S1', 'S2', -1], ['P1', 'PC', 1], ['PC', 'P2', -1], ['E', 'P4', 1], ['D', 'E', -1], ['M1', 'M2', 1]]) lampAlong(a, b, 18, s);
}

// ---------- edges: highway, fences, exits, tree line ----------
function buildEdges(scene) {
  // the north boundary: a chain-link fence (Hwy 9 now runs through town; it is closed where it crosses the fence)
  for (let x = -LIMIT - 20; x <= LIMIT + 20; x += 4) addS(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), 'metal', 0x9aa0a8, x, 1.2, NORTH);
  addS(new THREE.BoxGeometry(2 * LIMIT + 40, 2.3, 0.04), 'fence', 0x707880, 0, 1.15, NORTH);
  colliders.push({ x0: -LIMIT - 30, x1: LIMIT + 30, z0: NORTH - 1, z1: NORTH + 0.4, h: 9 });
  // Exit 1: Highway 9 on-ramp (closed for now)
  const R = NODES[N.RAMP], A = NODES[N.A], ry = Math.atan2(R.x - A.x, R.z - A.z);
  const F = frame(R.x, R.z, ry);
  for (const s of [-1, 0, 1]) sawhorse(...F.at(s * 3, 2.5), ry);
  for (const s of [-4.6, 4.6]) barrel(...F.at(s, 1.8));
  F.col(0, 2.5, 10, 1.5, 3);
  F.box(5.5, 1.6, 3.6, 0.1, 3.2, 0.1, 'metal', 0x888888); F.box(8.5, 1.6, 3.6, 0.1, 3.2, 0.1, 'metal', 0x888888);
  F.sign('HWY 9 ENTRANCE CLOSED', '#1f6a3a', '#ffffff', 3.6, 0.9, 2.9, 3.55, { tw: 512, th: 64, rr: Math.PI, double: true, lx: 7 });
  F.light(0, 2, 1, 0xff9a40, 0.6, { always: true, flicker: true }); F.halo(-4.6, 1.2, 1.8, 1.2, 0xff8a30); F.halo(4.6, 1.2, 1.8, 1.2, 0xff8a30);
  places.exitNorth = { x: R.x, z: R.z };
  // Hwy 9 east: closed at the town line
  {
    const E = NODES[N.HE], ryE = -Math.PI / 2, Fe = frame(E.x - 2, E.z, ryE);
    for (const s2 of [-4, -1.3, 1.3, 4]) sawhorse(...Fe.at(s2, 0), ryE);
    for (const s2 of [-6, 6]) barrel(...Fe.at(s2, -0.6));
    Fe.col(0, 0, 13, 1.5, 3);
    Fe.sign('HWY 9 CLOSED AT TOWN LINE', '#1f6a3a', '#ffffff', 4.6, 0.9, 2.9, 0.5, { tw: 512, th: 64, double: true });
    Fe.box(-2.4, 1.6, 0.5, 0.1, 3.2, 0.1, 'metal', 0x888888); Fe.box(2.4, 1.6, 0.5, 0.1, 3.2, 0.1, 'metal', 0x888888);
    Fe.light(0, 2, -1, 0xff9a40, 0.6, { always: true, flicker: true });
    places.exitEast = { x: E.x, z: E.z };
  }
  // Exit 2: Old Mill Rd bridge out (south)
  const ryS = Math.atan2(NODES[N.F].x - NODES[N.E].x, NODES[N.F].z - NODES[N.E].z);
  const Fs = frame(NODES[N.F].x, NODES[N.F].z, ryS);
  for (const s of [-1, 0, 1]) sawhorse(...Fs.at(s * 3, 4), ryS);
  Fs.col(0, 4, 11, 1.5, 3);
  Fs.sign('BRIDGE OUT', '#f06a20', '#111111', 5, 1.2, 1.9, 3.8, { rr: Math.PI });
  for (const s of [-5, 5]) barrel(...Fs.at(s, 3));
  Fs.light(0, 2, 2.5, 0xff9a40, 0.6, { always: true, flicker: true });
  places.exitSouth = { x: NODES[N.F].x, z: NODES[N.F].z };
  // invisible walls
  for (const [x0, z0, x1, z1] of [[-LIMIT, NORTH, -LIMIT, LIMIT], [LIMIT, NORTH, LIMIT, LIMIT], [-LIMIT, LIMIT, LIMIT, LIMIT]]) {
    colliders.push({ x0: Math.min(x0, x1) - 1, x1: Math.max(x0, x1) + 1, z0: Math.min(z0, z1) - 1, z1: Math.max(z0, z1) + 1, h: 9 });
  }
  // east and south tree line (west/south are the haunted woods)
  for (let t = NORTH + 6; t <= LIMIT; t += 6) if (Math.abs(t) > 12) tree(LIMIT + 2 + rnd() * 4, t, 1.2 + rnd() * 0.5, { kind: 'pine' });
  for (let t = -LIMIT; t <= LIMIT; t += 6) tree(t, LIMIT + 2 + rnd() * 4, 1.2 + rnd() * 0.5, { kind: 'pine', tint: 0x9ab09a });
  // town welcome sign on Old Mill coming in from the highway
  const Fw = frame(-36, -86, -0.4);
  Fw.box(-2.2, 0.9, 0, 0.2, 1.8, 0.2, 'wood', 0xffffff); Fw.box(2.2, 0.9, 0, 0.2, 1.8, 0.2, 'wood', 0xffffff);
  Fw.sign('WELCOME TO MAPLE GROVE', '#2f5d2f', '#f4f0d8', 5, 1, 1.8, 0.12, { tw: 512, th: 64 });
  Fw.sign('POP. 1,204  -  NO RVs', '#f4f0d8', '#2f5d2f', 4, 0.5, 1.1, 0.12, { tw: 256, th: 32 });
  Fw.col(0, 0, 4.8, 0.4, 2);
}

// ---------- downtown ----------
function buildDowntown(scene, T) {
  // ---- Quik Stop (NE corner): store at the back, pumps out front, facing Main St ----
  {
    const cx = 30, cz = -26, F = frame(cx, cz, 0);
    F.flat(0, 0, 40, 38, 'asphalt', 0xe6e6e6, 0.04, '#6a6a70');
    F.box(0, 2, -11, 16, 4, 9, 'brick', 0xffffff); F.bld(0, -11, 16, 9, 4.5);
    F.box(0, 4.2, -11, 16.6, 0.4, 9.6, 'plain', 0xe03030);
    for (const wx of [-5, -2, 4, 6.5]) F.face(wx, 1.6, -6.47, 2.4, 1.8, 'storeWin', 0xffffff);
    F.face(1, 1.1, -6.47, 1.6, 2.2, 'door', 0x99c4e0);
    F.box(-7.6, 1, -6, 1, 2, 0.8, 'plain', 0xa01820); F.face(-7.6, 1, -5.59, 0.95, 1.9, 'vending', 0xffffff); F.col(-7.6, -6, 1, 0.8, 2);
    F.light(-7.6, 1.5, -4.6, 0xffb0b0, 0.6, { always: true }); F.halo(-7.6, 1.2, -5.5, 2.2, 0xff6060);
    F.light(0, 2.2, -4.5, 0xfff0d0, 1, { always: true });
    F.sign('QUIK STOP', '#e03030', '#ffffff', 8, 1.4, 3.3, -6.43);
    // fuel canopy + pumps
    F.box(0, 4.6, 4, 14, 0.6, 8, 'plain', 0xf4f4f4); F.box(0, 4.35, 4, 14.1, 0.25, 8.1, 'plain', 0xe03030);
    for (const [x, z] of [[-6, 1], [6, 1], [-6, 7], [6, 7]]) { F.box(x, 2.2, z, 0.3, 4.4, 0.3, 'plain', 0xdddddd); F.post(x, z, 0.25, 4.4); }
    for (const x of [-2.5, 2.5]) { F.box(x, 0.8, 4, 0.6, 1.6, 1, 'plain', 0xd8d8d8); F.box(x, 1.4, 4, 0.62, 0.4, 1.02, 'plain', 0xe03030); F.col(x, 4, 0.6, 1, 1.6); }
    for (const x of [-4, 4]) { F.light(x, 4.0, 4, 0xf0f4ff, 1.3); F.box(x, 4.32, 4, 1.6, 0.05, 0.6, 'lamp', 0xffffff); F.halo(x, 4.2, 4, 2.6, 0xe0e8ff); }
    // tall price sign at the corner
    F.box(16, 3.5, 15, 0.4, 7, 0.4, 'metal', 0x888888); F.post(16, 15, 0.3, 7);
    F.sign('GAS  3.19', '#e03030', '#ffe060', 4, 1.6, 6.5, 15.25, { glow: true, lx: 16 });
    F.box(-6, 0.6, -6, 2, 1.2, 0.8, 'plain', 0xf0f8ff); F.col(-6, -6, 2, 0.8, 1.2);
    F.box(15, 0.75, -14, 3, 1.5, 1.6, 'plain', 0x2d6a3a); F.col(15, -14, 3, 1.6, 1.5);
    F.geo(plane(6, 1.5).rotateX(Math.PI / 2).rotateY(-Math.PI / 2), 'graffiti', 0xffffff, 8.03, 0.85, -11);
    places.quik = { x: cx - 3, z: cz - 3.5, yaw: 0 };
  }
  // ---- Suds N Paws (NW corner): east-west drive-through tunnel ----
  {
    const cx = -32, cz = -22, F = frame(cx, cz, 0);
    F.flat(0, 0, 30, 28, 'asphalt', 0xdcdcdc, 0.04, '#6a6a70');
    const wx = cx - 2, wz = cz - 3;
    for (const s of [-1, 1]) { addS(boxUV(12, 4, 0.6, 0.5), 'brick', 0xa8c8f0, wx, 2, wz + s * 2.9); colBox(wx, wz + s * 2.9, 12, 0.6, 4, 0, { bld: true }); }
    addS(new THREE.BoxGeometry(12.6, 0.5, 6.6), 'plain', 0x3a78c8, wx, 4.25, wz);
    frame(wx, wz, Math.PI).sign('SUDS N PAWS', '#3a78c8', '#ffffff', 7, 1.2, 4.9, 3.32, { double: true });
    const brushes = [];
    for (const [x, z] of [[-2, -1.8], [-2, 1.8], [2.5, -1.8], [2.5, 1.8]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3, 6), lambert({ color: z < 0 ? 0x3ab0ff : 0xff5ab4 }));
      b.position.set(wx + x, 1.7, wz + z); scene.add(b); brushes.push(b);
    }
    animated.push({ obj: null, fn: (t) => brushes.forEach((b, i) => { b.rotation.y = t * 6 * (i % 2 ? 1 : -1); }) });
    zones.push({ name: 'wash', x0: wx - 6, x1: wx + 6, z0: wz - 2.4, z1: wz + 2.4 });
    lights.push({ x: wx, y: 3.5, z: wz, c: 0x60b0ff, i: 1.4, always: true });
    halos.push({ x: wx, y: 4.9, z: wz - 3.4, s: 5, c: 0x4080ff });
    places.wash = { x: wx, z: wz };
    // vacuum stations + pay kiosk
    for (const x of [-8, -4]) { F.box(x, 0.9, 8, 0.5, 1.8, 0.5, 'plain', 0xe0c020); F.post(x, 8, 0.3, 1.8); }
    F.box(8, 0.8, 3, 0.8, 1.6, 0.6, 'plain', 0x3a78c8); F.col(8, 3, 0.8, 0.6, 1.6);
  }
  // ---- Town green (SW corner): gazebo, flagpole, memorial ----
  {
    const cx = -20, cz = 26, F = frame(cx, cz, 0);
    F.flat(0, 0, 26, 30, 'grass', 0xd8f0c8, 0.03);
    F.geo(plane(1.6, 30, 1, 3, 0.3, 6), 'sidewalk', 0xd8d4cc, 0, 0.05, 0);
    F.geo(plane(26, 1.6, 3, 1, 5, 0.3), 'sidewalk', 0xd8d4cc, 0, 0.05, 0);
    // gazebo
    F.geo(new THREE.CylinderGeometry(4, 4.2, 0.6, 8), 'wood', 0xf0e8dc, 0, 0.3, 0);
    { const [gx, gz] = F.at(0, 0); floors.push({ top: 0.6, cx: gx, cz: gz, r: 4 }); } // engine: walk on the gazebo
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + 0.39; F.box(Math.cos(a) * 3.6, 1.9, Math.sin(a) * 3.6, 0.18, 2.6, 0.18, 'plain', 0xf8f8f4); }
    F.geo(new THREE.ConeGeometry(4.6, 2.2, 8), 'shingle', 0x7a3e34, 0, 4.3, 0, 0.39);
    F.post(0, 0, 3.2, 0.6);
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; F.halo(Math.cos(a) * 4.2, 3.2, Math.sin(a) * 4.2, 0.6, [0xffd060, 0xfff0c0][k % 2]); }
    F.light(0, 2.8, 0, 0xffe0a0, 0.8, { always: true });
    for (const [x, z] of [[-9, -8], [9, -8], [-9, 8], [9, 8]]) bench(F, x, z, x > 0 ? -Math.PI / 2 : Math.PI / 2);
    F.box(8, 3.5, -11, 0.08, 7, 0.08, 'plain', 0xdddddd); F.box(8.75, 6.4, -11, 1.5, 0.9, 0.04, 'plain', 0x2f5d2f); F.post(8, -11, 0.1, 7);
    F.box(-8, 0.8, 11, 1.6, 1.6, 0.6, 'brick', 0xb0aca0); F.col(-8, 11, 1.6, 0.6, 1.6);
    const [tx, tz] = F.at(-10, -11); tree(tx, tz, 1.3, { kind: 'round' });
    const [ux, uz] = F.at(10, 11); tree(ux, uz, 1.2, { kind: 'round' });
    F.sign('TOWN GREEN', '#2f5d2f', '#f4f0d8', 3, 0.7, 1.4, -14.5, { rr: Math.PI, double: true });
    places.green = { x: cx, z: cz };
  }
  // ---- Donut Hole (west of the green, facing Main St) ----
  {
    const cx = -44, cz = 18, F = frame(cx, cz, Math.PI);
    F.flat(0, 3, 16, 14, 'asphalt', 0xdcdcdc, 0.04, '#6a6a70');
    F.box(0, 1.7, 0, 10, 3.4, 7, 'siding', 0xffd0e0); F.bld(0, 0, 10, 7, 4);
    F.box(0, 3.5, 0, 10.6, 0.3, 7.6, 'plain', 0xb05070);
    const dn = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.4, 5, 8), lambert({ color: 0xf080b0 }));
    dn.position.set(cx, 4.8, cz); scene.add(dn);
    animated.push({ obj: dn, fn: (t) => { dn.rotation.y = t; } });
    for (const x of [-3, 3]) F.face(x, 1.6, 3.53, 2, 1.5, 'storeWin', 0xffc0d8);
    F.light(0, 2.4, 5.5, 0xff80c0, 1, { always: true }); F.halo(0, 4.8, 0, 4, 0xff60b0);
    F.face(0, 1, 3.53, 1.2, 2, 'door', 0xffffff);
    F.sign('DONUT HOLE', '#b05070', '#fff0f6', 4, 0.8, 2.9, 3.57);
    // drive-thru lane + menu board
    F.geo(plane(3.5, 14, 1, 2, 0.7, 2.8), 'asphalt', 0xc8c8c8, -7, 0.05, 0);
    F.box(-9.3, 1, -3, 0.2, 2, 1.4, 'plain', 0x333333); F.col(-9.3, -3, 0.2, 1.4, 2);
    places.donut = { ...(([x, z]) => ({ x, z }))(F.at(0, 6)) };
  }
  // ---- Rosie's Diner (SE wedge, chrome railcar diner) ----
  {
    const cx = 36, cz = 17, F = frame(cx, cz, Math.PI);
    F.flat(4, 1, 24, 16, 'asphalt', 0xdcdcdc, 0.04, '#6a6a70');
    F.box(0, 0.5, 0, 15, 1, 6.4, 'plain', 0x8a8a90);
    F.box(0, 1.9, 0, 15, 1.8, 6.4, 'metal', 0xe8e8f0);
    F.geo(new THREE.CylinderGeometry(3.2, 3.2, 15, 12, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.35, 1), 'metal', 0xd0d0d8, 0, 2.8, 0);
    F.box(0, 1.25, 0, 15.05, 0.25, 6.45, 'plain', 0xd02a2a);
    F.bld(0, 0, 15, 6.4, 4);
    for (let k = 0; k < 6; k++) F.face(-6 + k * 2.2, 2.1, 3.23, 1.8, 1.1, 'storeWin', 0xfff0d8);
    F.face(6.5, 1.3, 3.23, 1.1, 2.1, 'door', 0xd02a2a);
    F.sign("ROSIE'S DINER", '#111111', '#ff4a6a', 7, 1.3, 4.4, 0, { tw: 512, th: 64, glow: true });
    F.box(0, 3.6, 0, 0.15, 0.8, 0.15, 'metal', 0x888888);
    F.light(0, 2.5, 5, 0xff6a8a, 1.1, { always: true }); F.halo(0, 4.4, 0.2, 5, 0xff4a6a);
    F.sign('OPEN 24 HRS', null, '#40ff80', 1.6, 0.4, 2.8, 3.26, { glow: true });
  }
  // a hydrant or two
  hydrant(7, -7); hydrant(-7, 7); hydrant(52, -7);
}

// ---------- Maple Grove PD station (police thread, re-added by tools/police-hooks.mjs) ----------
function buildPoliceStation() {
  // south side of Main St between Old Mill Rd and Nana's; front door faces north onto Main St
  const cx = -68, cz = 24, F = frame(cx, cz, Math.PI);
  F.flat(0, 2, 26, 26, 'asphalt', 0xd8d8d8, 0.04, '#6a6a70');
  F.geo(plane(1.8, 6, 1, 1, 0.4, 1.2), 'sidewalk', 0xd8d4cc, 0, 0.06, 4.6);
  for (const x of [-10.5, -7.5, -4.5, 4.5, 7.5, 10.5]) F.box(x, 0.06, 9.5, 0.12, 0.02, 4.2, 'plain', 0xf0f0f0);
  // main block: two storeys of tan brick, navy cornice, wings
  F.box(0, 3, -4, 16, 6, 9, 'brick', 0xe8dcc8); F.bld(0, -4, 16, 9, 6.5);
  F.box(0, 6.2, -4, 16.6, 0.4, 9.6, 'plain', 0x1e2a44);
  F.box(0, 0.4, -4, 16.3, 0.8, 9.3, 'plain', 0x8a8478);
  for (const s of [-1, 1]) { F.box(s * 10.5, 2, -5, 5, 4, 7, 'brick', 0xd8ccb8); F.bld(s * 10.5, -5, 5, 7, 4.4); F.box(s * 10.5, 4.15, -5, 5.4, 0.3, 7.4, 'plain', 0x1e2a44); }
  // portico: steps, columns, canopy
  F.box(0, 0.12, 1.6, 6.4, 0.24, 2.8, 'plain', 0xc8c4bc); F.box(0, 0.3, 1.2, 5.6, 0.2, 2, 'plain', 0xd0ccc4); F.floor(0, 1.6, 6.4, 2.8, 0.24); F.floor(0, 1.2, 5.6, 2, 0.4); // engine: walk up the steps
  for (const x of [-2.6, 2.6]) { F.box(x, 2.1, 2.6, 0.4, 3.8, 0.4, 'plain', 0xf4f2ec); F.post(x, 2.6, 0.25, 4); }
  F.box(0, 4.1, 1.7, 6.6, 0.35, 3.2, 'plain', 0xf0ece4);
  F.face(0, 1.35, 0.53, 2.2, 2.5, 'door', 0x3a5a8a);
  for (const x of [-6, -3.8, 3.8, 6]) F.face(x, 1.9, 0.53, 1.5, 1.4, 'window', 0xffffff);
  for (const x of [-6, -3.8, 0, 3.8, 6]) F.face(x, 4.5, 0.53, 1.5, 1.3, 'window', 0xffffff);
  for (const s of [-1, 1]) for (const x of [-1.2, 1.2]) F.face(s * 10.5 + x, 1.9, -1.47, 1.2, 1.2, 'window', 0xffffff);
  F.sign('MAPLE GROVE POLICE', '#1e2a44', '#f4f0d8', 9, 0.9, 5.45, 0.56, { tw: 512, th: 52 });
  F.sign('PD', '#1e2a44', '#e0b440', 1.4, 0.7, 3.65, 3.33, { tw: 64, th: 32 });
  for (const x of [-1.6, 1.6]) { F.box(x, 2.9, 0.75, 0.3, 0.42, 0.3, 'lamp', 0x5070ff); F.halo(x, 2.9, 0.9, 1.6, 0x4060ff); }
  F.light(0, 3.2, 3, 0x7090ff, 1.1, { always: true });
  // flagpole, the reserved space, a donut-shaped bench joke and a holding-yard fence out back
  F.box(9, 4, 4, 0.1, 8, 0.1, 'plain', 0xdddddd); F.box(9.8, 7.4, 4, 1.6, 1, 0.04, 'plain', 0x2f5d2f); F.post(9, 4, 0.12, 8);
  F.box(-12, 0.6, 7.5, 0.08, 1.2, 0.08, 'metal', 0x888888); F.sign('RESERVED: SGT. DONUTS', '#ffffff', '#1e2a44', 1.4, 0.35, 1.3, 7.55, { tw: 256, th: 40, lx: -12 });
  for (const s of [-1, 1]) { F.box(s * 12.8, 1, -11, 0.08, 2, 6, 'fence', 0xbfc4c8); F.col(s * 12.8, -11, 0.2, 6, 2); }
  F.box(0, 1, -13.9, 25.6, 2, 0.08, 'fence', 0xbfc4c8); F.col(0, -13.9, 25.6, 0.2, 2);
  F.box(7, 0.7, -11, 2, 1.4, 1.2, 'plain', 0x2d6a3a); F.col(7, -11, 2, 1.2, 1.4);
  F.light(-6, 4.5, 8, 0xfff0d0, 0.8); F.box(-6, 2.3, 9.5, 0.12, 4.6, 0.12, 'metal', 0x777777); F.post(-6, 9.5, 0.12, 4.6); F.box(-6, 4.6, 9, 0.3, 0.12, 1, 'lamp', 0xffffff); F.halo(-6, 4.5, 8.6, 2.4, 0xfff0c8);
  const [dx, dz] = F.at(0, 3.4), [cx2, cz2] = F.at(-10.5, -5);
  const yaw = Math.PI; // facing north (-z)
  places.station = {
    x: cx, z: cz, yaw, name: 'Maple Grove PD',
    door: { x: dx, z: dz, yaw },
    cell: { x: cx2, z: cz2 },
    parking: [[-9, 9.5], [9, 9.5]].map(([lx, lz]) => { const [x, z] = F.at(lx, lz); return { x, z, yaw: 0 }; }),
  };
}

// ---------- church + cemetery ----------
function buildChapel() {
  const cx = -74, cz = -24, F = frame(cx, cz, 0);
  const w = 9, d = 15, h = 5.5;
  F.box(0, h / 2, 0, w, h, d, 'siding', 0xf8f6f0); F.bld(0, 0, w, d, h + 2);
  F.geo(gable(d + 0.6, 4, w + 0.8).rotateY(Math.PI / 2), 'shingle', 0x3a3a44, 0, h, 0);
  F.box(0, 0.2, 0, w + 0.2, 0.4, d + 0.2, 'plain', 0x8a8478);
  shadow(...F.at(0, 0), w + 4, d + 4, 0, true);
  // steeple: tower, belfry, spire
  F.box(0, 5, d / 2 + 1.4, 3.4, 10, 3, 'siding', 0xf8f6f0); F.bld(0, d / 2 + 1.4, 3.4, 3, 10);
  F.box(0, 11, d / 2 + 1.4, 2.6, 2, 2.6, 'plain', 0x2a2a30);
  F.geo(new THREE.ConeGeometry(1.9, 7, 4), 'shingle', 0x3a3a44, 0, 15.5, d / 2 + 1.4, Math.PI / 4);
  F.box(0, 19.5, d / 2 + 1.4, 0.12, 1.2, 0.12, 'plain', 0xd8c070); F.box(0, 19.7, d / 2 + 1.4, 0.6, 0.12, 0.12, 'plain', 0xd8c070);
  F.geo(new THREE.CylinderGeometry(0.35, 0.55, 0.7, 8), 'plain', 0xb08a30, 0, 11, d / 2 + 1.4);
  F.face(0, 1.3, d / 2 + 2.93, 1.8, 2.6, 'door', 0x8a2020);
  F.face(0, 4.5, d / 2 + 2.93, 1, 1.6, 'storeWin', 0xffb070);
  // tall stained glass windows down the sides
  for (const z of [-5, -1.5, 2, 5.5]) for (const s of [2, 3]) F.face((s === 2 ? 1 : -1) * (w / 2 + 0.03), 2.9, z, 1.1, 2.6, 'storeWin', [0xff8060, 0x80a0ff, 0xffd060, 0x80ff90][(z + 5) % 4 | 0], s);
  F.box(0, 0.2, d / 2 + 3.8, 3.6, 0.4, 1.6, 'plain', 0xb8b0a4);
  F.geo(plane(2, 8, 1, 2, 0.4, 1.6), 'sidewalk', 0xd8d4cc, 0, 0.05, d / 2 + 8.5);
  F.light(0, 3, d / 2 + 4, 0xffd8a0, 0.8);
  // marquee
  F.box(-5.5, 0.9, d / 2 + 10, 0.2, 1.8, 0.2, 'wood', 0xffffff); F.box(-1.5, 0.9, d / 2 + 10, 0.2, 1.8, 0.2, 'wood', 0xffffff);
  F.sign('MAPLE GROVE CHAPEL', '#f4f0e0', '#2a2a30', 4, 0.6, 2.1, d / 2 + 10.12, { tw: 512, th: 64, lx: -3.5 });
  F.sign("CH__CH: WHAT'S MISSING? U R", '#f4f0e0', '#8a2020', 4, 0.6, 1.4, d / 2 + 10.12, { tw: 512, th: 64, lx: -3.5 });
  F.col(-3.5, d / 2 + 10, 4.2, 0.4, 2.2);
  // gravel lot to the east
  F.flat(13, 6, 14, 22, 'dirt', 0xb8b4a8, 0.04, '#8a8478');
  places.church = { x: cx, z: cz + d / 2 + 4 };
  // cemetery to the west, backing onto the woods
  const gx = -98, gz = -24, G = frame(gx, gz, 0);
  G.flat(0, 0, 22, 30, 'grass', 0xb8c8a8, 0.03, '#4f6a46');
  const ironFence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), steps = Math.round(len / 0.6);
    for (let k = 0; k <= steps; k++) addS(new THREE.BoxGeometry(0.05, 1.4, 0.05), 'metal', 0x2a2a2e, x0 + (x1 - x0) * k / steps, 0.7, z0 + (z1 - z0) * k / steps);
    addS(new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.05, 0.05, Math.abs(z1 - z0) + 0.05), 'metal', 0x2a2a2e, (x0 + x1) / 2, 1.3, (z0 + z1) / 2);
    colliders.push({ x0: Math.min(x0, x1) - 0.1, x1: Math.max(x0, x1) + 0.1, z0: Math.min(z0, z1) - 0.1, z1: Math.max(z0, z1) + 0.1, h: 1.4 });
  };
  ironFence(gx - 11, gz - 15, gx + 11, gz - 15); ironFence(gx - 11, gz - 15, gx - 11, gz + 15);
  ironFence(gx + 11, gz - 15, gx + 11, gz - 2); ironFence(gx + 11, gz + 2, gx + 11, gz + 15);
  ironFence(gx - 11, gz + 15, gx - 2, gz + 15); ironFence(gx + 2, gz + 15, gx + 11, gz + 15);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) {
    if (i === 2 && j < 2) continue;
    const x = gx - 8 + i * 4 + (rnd() - 0.5) * 0.6, z = gz - 11 + j * 4 + (rnd() - 0.5) * 0.6, tilt = (rnd() - 0.5) * 0.25, c = [0x9a9a96, 0x8a8a90, 0xa8a49c][(rnd() * 3) | 0];
    const kind = rnd();
    if (kind < 0.55) addS(new THREE.BoxGeometry(0.9, 1.1, 0.22).rotateZ(tilt), 'plain', c, x, 0.5, z);
    else if (kind < 0.8) { addS(new THREE.BoxGeometry(0.16, 1.5, 0.16).rotateZ(tilt), 'plain', c, x, 0.75, z); addS(new THREE.BoxGeometry(0.8, 0.16, 0.16), 'plain', c, x, 1.1, z); }
    else addS(new THREE.CylinderGeometry(0.1, 0.35, 1.8, 4), 'plain', c, x, 0.9, z, 0.78);
    colliders.push({ cx: x, cz: z, r: 0.45, h: 1.2 });
  }
  // mausoleum
  G.box(-4, 1.6, -11, 4.5, 3.2, 3.6, 'brick', 0x9a9a9a); G.bld(-4, -11, 4.5, 3.6, 3.2);
  G.geo(gable(5, 1, 4.2), 'plain', 0x8a8a8a, -4, 3.2, -11);
  G.face(-4, 1.2, -9.18, 1.4, 2.2, 'door', 0x3a3a3a);
  places.crypt = { x: gx - 4, z: gz - 8 };
  const [dx, dz] = G.at(7, -10); deadTree(dx, dz, 1.4);
  G.light(0, 1.2, 10, 0x80ffa0, 0.5, { always: true, flicker: true }); G.halo(0, 1, 10, 1, 0x80ffa0);
}

// ---------- Nana's farmhouse + the RV lot ----------
function buildNanaAndRV(scene) {
  // Nana: the blue farmhouse with the wraparound porch, facing the dirt road
  const nana = home(-106, 16, Math.PI / 2, { style: 'farm', wall: 0x9cc3e6, roof: 0x34404e, w: 10, d: 7.5, drive: 5.5, gravel: true, mail: 0x8a5ab0, extras: ['garden', 'coop', 'windchime', 'gnomes'] });
  places.doors.pop(); places.drives.pop();  // Nana's driveway is for her wagon
  places.nana = { x: nana.door[0], z: nana.door[1], yaw: Math.PI / 2 };
  places.nanaDrive = { x: nana.drive[0], z: nana.drive[1], yaw: Math.PI / 2 };
  const Fn = frame(-106, 16, Math.PI / 2);
  // rocking chair + clothesline
  Fn.box(2.5, 0.75, 4.4, 0.6, 0.08, 0.6, 'wood', 0xffffff); Fn.box(2.5, 1.1, 4.15, 0.6, 0.7, 0.06, 'wood', 0xffffff); Fn.col(2.5, 4.35, 0.65, 0.65, 1.45, 0, { top: 0.8 }); // engine: solid rocking chair
  for (const s of [-1, 1]) { Fn.box(-4 + s * 3, 1.1, -8, 0.08, 2.2, 0.08, 'wood', 0xffffff); Fn.post(-4 + s * 3, -8, 0.08, 2.2); }
  for (let k = 0; k < 4; k++) Fn.box(-6 + k * 1.5, 1.6, -8, 0.9, 0.8, 0.02, 'plain', [0xf0f0f0, 0xd08aa0, 0x8ab0e0, 0xf0e090][k]);
  for (let k = 0; k < 6; k++) bush(...Fn.at(-4 + k * 1.6, 5.2), 0.55, [0xe080a0, 0xf0d060, 0xb0e0a0][k % 3]);
  // RV lot: the empty lot at the end of the dirt road, woods right behind it
  const lx = -104, lz = 40;
  const F = frame(lx, lz, 0);
  F.flat(0, 0, 18, 16, 'dirt', 0xffffff, 0.05, '#8a6a48');
  const rv = makeRV(); rv.position.set(lx - 1, 0, lz + 1); rv.rotation.y = Math.PI / 2 + 0.1; scene.add(rv);
  colBox(lx - 1, lz + 1, 8.5, 2.6, 4, Math.PI / 2, { bld: true });
  // fire pit, flamingo, tarp, camp chairs, string lights
  F.geo(new THREE.CylinderGeometry(0.7, 0.8, 0.3, 7), 'plain', 0x777777, 2, 0.15, -4);
  F.post(2, -4, 0.7, 0.3);
  flames.push({ x: lx + 2, y: 0.5, z: lz - 4 });
  lights.push({ x: lx + 2, y: 1.2, z: lz - 4, c: 0xff8a30, i: 1.2, always: true, flicker: true });
  F.geo(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4), 'plain', 0x333333, 5, 0.35, -2);
  F.geo(new THREE.IcosahedronGeometry(0.22, 0), 'plain', 0xff6fa8, 5, 0.8, -2); F.post(5, -2, 0.12, 1);
  F.box(-4, 0.05, -5, 2.5, 0.05, 2, 'plain', 0x2266aa);
  for (const [x, z] of [[0.5, -5.5], [3.5, -5.5]]) { F.box(x, 0.45, z, 0.5, 0.05, 0.5, 'plain', 0xd04a3a); F.box(x, 0.7, z - 0.25, 0.5, 0.55, 0.05, 'plain', 0xd04a3a); F.col(x, z - 0.02, 0.55, 0.55, 0.98, 0, { top: 0.48 }); } // engine: solid camp chairs
  places.rv = { x: lx + 1.8, z: lz + 1.5 };
  lights.push({ x: lx + 2, y: 2.4, z: lz + 1.5, c: 0xffc070, i: 1.1, always: true });
  for (let k = 0; k < 7; k++) halos.push({ x: lx + 1.8 + Math.sin(k) * 0.2, y: 2.9 - Math.sin(k / 6 * Math.PI) * 0.3, z: lz - 2.5 + k * 1.0, s: 0.6, c: [0xff6060, 0xffd060, 0x60ff80, 0x60a0ff][k % 4] });
  places.spawn = { x: lx + 4, z: lz - 2 };
  // the HOA's notice, nailed to a post
  F.box(7, 0.8, 7, 0.1, 1.6, 0.1, 'wood', 0xffffff); F.post(7, 7, 0.1, 1.6); F.face(7, 1.3, 7.06, 0.6, 0.9, 'posterHoa', 0xffffff);
  // hand-painted sign at the trail head into the woods
  F.box(-9.5, 0.9, -3, 0.12, 1.8, 0.12, 'wood', 0xffffff); F.post(-9.5, -3, 0.1, 1.8);
  F.sign('KEEP OUT', '#3a2a1a', '#d8c8a0', 1.6, 0.5, 1.6, -2.9, { rr: Math.PI / 2, double: true, lx: -9.5 });
}

// ---------- Hollow Woods: the haunted forest ----------
const TRAIL = [[-110, 38], [-121, 46], [-129, 62], [-133, 80], [-126, 98], [-112, 112], [-98, 124]];
function distToPath(x, z, P) {
  let best = 1e9;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function buildForest() {
  // ground: leaf litter under the trees
  MAP.push({ t: 'poly', col: '#1f3a24', pts: [[-150, -42], [-113, -42], [-113, 64], [-80, 64], [-84, 117], [52, 117], [52, 150], [-150, 150]] });
  for (const [x0, x1, z0, z1] of [[-150, -113, -42, 150], [-113, 52, 117, 150]]) {
    const w = x1 - x0, d = z1 - z0;
    addS(plane(w, d, Math.ceil(w / 12), Math.ceil(d / 12), w / 5, d / 5), 'dirt', 0x6a5a48, (x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  }
  // trail
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [ax, az] = TRAIL[i], [bx, bz] = TRAIL[i + 1], L = Math.hypot(bx - ax, bz - az);
    addS(plane(2.6, L + 2, 1, 2, 0.5, L / 5), 'dirt', 0xd0c0a0, (ax + bx) / 2, 0.035, (az + bz) / 2, Math.atan2(bx - ax, bz - az));
  }
  MAP.push({ t: 'line', col: '#8a7050', w: 2.4, pts: TRAIL });
  // the clearing: ruined cabin
  const cl = { x: -134, z: 82 };
  places.clearing = cl;
  const F = frame(cl.x - 4, cl.z, Math.PI / 2);
  F.box(0, 1.3, 0, 6, 2.6, 5, 'wood', 0x8a7a6a); F.bld(0, 0, 6, 5, 3);
  F.geo(gable(6.8, 3.2, 5.6).rotateZ(0.08), 'shingle', 0x4a4440, 0, 2.6, 0);
  F.face(0.8, 1.0, 2.52, 1, 2, 'door', 0x3a3028); F.face(-1.6, 1.6, 2.52, 1, 0.9, 'window', 0x707070);
  F.box(-3.3, 0.4, 1.5, 0.8, 0.8, 0.8, 'wood', 0x6a5a4a);
  // the old well at the end of the trail
  const wl = TRAIL[TRAIL.length - 1]; places.well = { x: wl[0] + 2, z: wl[1] + 2 };
  addS(new THREE.CylinderGeometry(1.1, 1.2, 1, 10, 1, true), 'brick', 0x9a9088, wl[0] + 2, 0.5, wl[1] + 2);
  addS(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), 'plain', 0x050505, wl[0] + 2, 0.6, wl[1] + 2);
  for (const s of [-1, 1]) addS(new THREE.BoxGeometry(0.12, 2.2, 0.12), 'wood', 0xffffff, wl[0] + 2 + s * 1.1, 1.1, wl[1] + 2);
  addS(gable(2.8, 0.7, 1.6), 'shingle', 0x4a4440, wl[0] + 2, 2.2, wl[1] + 2);
  colliders.push({ cx: wl[0] + 2, cz: wl[1] + 2, r: 1.2, h: 1 });
  lights.push({ x: wl[0] + 2, y: 1.5, z: wl[1] + 2, c: 0x90a0ff, i: 0.9, always: true, flicker: true });
  // trees: dense dark pines, twisted dead trees, keeping the trail and clearing open
  const keep = (x, z) => distToPath(x, z, TRAIL) < 3.2 || Math.hypot(x - cl.x, z - cl.z) < 10 || Math.hypot(x - wl[0] - 2, z - wl[1] - 2) < 4;
  let n = 0;
  for (let x = -146; x < 50; x += 5.2) for (let z = -40; z < 146; z += 5.2) {
    const inside = (x < -114 && z > -40) || (z > 119 && x < 48);
    if (!inside) continue;
    const jx = x + (rnd() - 0.5) * 4, jz = z + (rnd() - 0.5) * 4;
    if (keep(jx, jz) || rnd() < 0.12) continue;
    const r = rnd(), s = 1.1 + rnd() * 0.7;
    if (r < 0.2) deadTree(jx, jz, s);
    else tree(jx, jz, s, { kind: r < 0.85 ? 'pine' : 'round', tint: r < 0.85 ? 0x7a9480 : 0x8a9a70 });
    n++;
  }
  // gnarled roots / stones scattered
  for (let k = 0; k < 24; k++) { const x = -140 + rnd() * 24, z = -30 + rnd() * 170; if (!keep(x, z)) rock(x, z, 0.6 + rnd() * 0.8, 0x6a6a64); }
  zones.push({ name: 'woods', x0: -150, x1: -113, z0: -40, z1: 150 });
}

// ---------- Lake Juniper + Lakeside Park ----------
const LAKE = { x: -35, z: 92, rx: 40, rz: 24 };
function lakeR(a) { return 1 + 0.1 * Math.sin(3 * a + 0.6) + 0.06 * Math.sin(5 * a + 2.1); }
function lakePts(scale = 1) {
  const pts = [];
  for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2, r = lakeR(a) * scale; pts.push([LAKE.x + Math.cos(a) * LAKE.rx * r, LAKE.z + Math.sin(a) * LAKE.rz * r]); }
  return pts;
}
function inLake(x, z, shrink = 1) {
  const dx = (x - LAKE.x) / LAKE.rx, dz = (z - LAKE.z) / LAKE.rz, a = Math.atan2(dz, dx);
  return Math.hypot(dx, dz) < lakeR(a) * shrink;
}
let WATER_MAT = null;
function buildLake(scene, T) {
  const mk = (pts, y, key, col) => {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(sh, 2); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
    if (key) addS(g, key, col, 0, y, 0); return g;
  };
  // the sandy shore is painted ground and the water surface follows the water collider (ground.js), so both are editable
  WATER_MAT = lambert({ map: T.water });
  animated.push({ obj: null, fn: (t) => { T.water.offset.set(Math.sin(t * 0.3) * 0.05, t * 0.02); } });
  MAP.push({ t: 'poly', col: '#4a8ac8', pts: lakePts(1) });
  // dock on the north shore
  const dx = -20, dz0 = 64, dz1 = 82;
  addS(boxUV(2.4, 0.2, dz1 - dz0, 0.5), 'wood', 0xc8b090, dx, 0.25, (dz0 + dz1) / 2);
  for (let z = dz0 + 2; z <= dz1; z += 3) for (const s of [-1, 1]) addS(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), 'wood', 0x8a7060, dx + s * 1.15, 0, z);
  places.dock = { x: dx, z: dz1 - 1 };
  floors.push({ top: 0.35, x0: dx - 1.2, x1: dx + 1.2, z0: dz0, z1: dz1 + 0.1 }); // engine: walk on the dock
  // rowboat tied to the dock
  const boat = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 3.4, 6, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI), lambert({ color: 0xa04a2a }));
  boat.position.set(dx + 2.4, 0.4, 76); scene.add(boat);
  animated.push({ obj: boat, fn: (t) => { boat.position.y = 0.38 + Math.sin(t * 1.3) * 0.05; boat.rotation.z = Math.sin(t * 0.9) * 0.05; } });
  // water collider: one polygon that follows the shoreline, with a notch so the dock stays walkable
  {
    const shore = (a) => { const r = lakeR(a) * 0.97; return [LAKE.x + Math.cos(a) * LAKE.rx * r, LAKE.z + Math.sin(a) * LAKE.rz * r]; };
    const northZ = (x) => { let best = null; for (let k = 0; k < 720; k++) { const p = shore(Math.PI + k / 720 * Math.PI); if (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; } return best[1]; };
    const wp = []; let notched = false;
    for (let k = 0; k < 48; k++) {
      const [x, z] = shore(k / 48 * Math.PI * 2);
      if (z < LAKE.z && Math.abs(x - dx) < 3) {
        if (!notched) { notched = true; wp.push([dx - 1.6, northZ(dx - 1.6)], [dx - 1.6, dz1 + 0.6], [dx + 1.6, dz1 + 0.6], [dx + 1.6, northZ(dx + 1.6)]); }
        continue;
      }
      if (!notched && z < LAKE.z && x > dx) { notched = true; wp.push([dx - 1.6, northZ(dx - 1.6)], [dx - 1.6, dz1 + 0.6], [dx + 1.6, dz1 + 0.6], [dx + 1.6, northZ(dx + 1.6)]); }
      wp.push([x, z]);
    }
    colliders.push(polyCollider(wp, 99, { water: true }));
  }
  // dock rails stop you walking off the sides into the water
  for (const s of [-1, 1]) colliders.push({ x0: dx + s * 1.3 - 0.1, x1: dx + s * 1.3 + 0.1, z0: dz0 + 4, z1: dz1, h: 1 });
  colliders.push({ x0: dx - 1.3, x1: dx + 1.3, z0: dz1, z1: dz1 + 0.2, h: 1 });
  // reeds + lily pads
  for (let k = 0; k < 70; k++) {
    const a = rnd() * 6.283, r = lakeR(a) * (0.96 + rnd() * 0.1), x = LAKE.x + Math.cos(a) * LAKE.rx * r, z = LAKE.z + Math.sin(a) * LAKE.rz * r;
    if (Math.abs(x - dx) < 4 && z < 70) continue;
    addS(new THREE.ConeGeometry(0.08, 1.4 + rnd(), 4), 'leaves', 0x8aa060, x, 0.7, z);
  }
  for (let k = 0; k < 18; k++) { const x = LAKE.x + (rnd() - 0.5) * 60, z = LAKE.z + (rnd() - 0.5) * 34; if (inLake(x, z, 0.8)) addS(new THREE.CircleGeometry(0.5, 7).rotateX(-Math.PI / 2), 'leaves', 0x5a9a50, x, 0.08, z); }

  // Bait & Tackle shack on the west shore road
  {
    const F = frame(-72, 60, Math.PI);
    F.box(0, 1.5, 0, 7, 3, 5, 'wood', 0xa89070); F.bld(0, 0, 7, 5, 3.2);
    F.geo(new THREE.BoxGeometry(7.8, 0.15, 6.2).rotateX(0.12), 'metal', 0x6a7a80, 0, 3.2, 0);
    F.face(1.8, 1, 2.52, 1, 2, 'door', 0x3a6a8a); F.face(-1.5, 1.6, 2.52, 2, 1.1, 'storeWin', 0xc8f0d8);
    F.sign('BAIT & TACKLE', '#ffffff', '#2a5a7a', 4.4, 0.8, 3.7, 2.4, { double: true });
    F.sign('LIVE WORMS', '#d02a2a', '#ffffff', 1.6, 0.5, 0.8, 4.8, { rr: 0.3 });
    F.box(3, 0.4, 3.8, 1.6, 0.8, 0.8, 'plain', 0xf0f0f0); F.col(3, 3.8, 1.6, 0.8, 0.8);
    F.light(-1.5, 2.6, 3.6, 0xc8ffe0, 0.7, { always: true });
  }

  // Lakeside Park on the east shore: playground, picnic tables, restrooms, and the raccoons' den
  {
    MAP.push({ t: 'rect', x: 22, z: 84, w: 34, d: 52, ry: 0, col: '#4f8a40' });
    addS(plane(34, 52, 4, 6, 34 / 6, 52 / 6), 'grass', 0xd8f0c8, 22, 0.03, 84);
    const F = frame(0, 0, 0);
    F.geo(plane(2, 50, 1, 6, 0.4, 10), 'dirt', 0xe0d0b0, 18, 0.045, 84);
    F.geo(plane(20, 2, 3, 1, 4, 0.4), 'dirt', 0xe0d0b0, 10, 0.045, 70);
    // sign at the entrance
    F.box(6, 0.6, 58, 0.1, 1.2, 0.1, 'plain', 0x5b4030); F.box(10, 0.6, 58, 0.1, 1.2, 0.1, 'plain', 0x5b4030);
    F.sign('LAKESIDE PARK', '#2f5d2f', '#f4f0d8', 4, 0.8, 1.6, 58, { double: true, rr: Math.PI, lx: 8 });
    // playground
    const px = 30, pz = 66;
    F.flat(px, pz, 9, 9, 'dirt', 0xe8d8a0, 0.05);
    F.box(px - 2, 0.9, pz, 1, 1.8, 1, 'plain', 0xd04040); F.col(px - 2, pz, 1, 1, 2, 0, { top: 1.8 });
    const slide = new THREE.BoxGeometry(0.8, 0.08, 3); slide.rotateX(0.55); F.geo(slide, 'plain', 0xf0c020, px - 2, 0.9, pz + 1.9); F.ramp(px - 2, pz + 1.9, 0.8, 2.55, 1.72, 0.16); // engine: climb / slide down
    for (const s of [-1, 1]) F.box(px + 2 + s * 1.5, 1.2, pz, 0.1, 2.4, 0.1, 'plain', 0x3070c0);
    F.box(px + 2, 2.4, pz, 3.2, 0.1, 0.1, 'plain', 0x3070c0);
    F.geo(new THREE.CylinderGeometry(1.2, 1.2, 0.15, 10), 'plain', 0xe05050, px + 1, 0.4, pz - 3.2); // merry-go-round
    { const [mx, mz] = F.at(px + 1, pz - 3.2); floors.push({ top: 0.48, cx: mx, cz: mz, r: 1.2 }); }
    // picnic + benches + grill
    for (const [x, z] of [[10, 78], [12, 90], [26, 104]]) picnic(x, z, rnd() * 0.6);
    bench(F, 6, 72, Math.PI / 2); bench(F, 6, 98, Math.PI / 2);
    // restroom block
    F.box(34, 1.4, 82, 5, 2.8, 4, 'brick', 0xd8c0a0); F.bld(34, 82, 5, 4, 3);
    F.geo(new THREE.BoxGeometry(5.6, 0.2, 4.6), 'plain', 0x4a4a4a, 34, 2.9, 82);
    F.face(31.47, 1, 81, 0.9, 1.9, 'door', 0x3a6ab0, 3); F.face(31.47, 1, 83.2, 0.9, 1.9, 'door', 0xb03a6a, 3);
    F.light(31, 2.4, 82, 0xf0f4ff, 0.6, { always: true });
    for (let k = 0; k < 10; k++) {
      const x = 8 + rnd() * 30, z = 62 + rnd() * 46;
      if (Math.abs(x - 18) < 2.5 || Math.abs(z - 70) < 2.5 || Math.hypot(x - px, z - pz) < 7 || Math.hypot(x - 34, z - 82) < 5 || Math.hypot(x - 26, z - 98) < 9) continue;
      tree(x, z, 0.9 + rnd() * 0.6);
    }
    // raccoon den: overflowing bins, fire barrel, Ricky's wall
    const rx = 26, rz = 98;
    for (let k = 0; k < 3; k++) { F.geo(new THREE.CylinderGeometry(0.45, 0.4, 1.1, 7), 'plain', 0x3d5a3d, rx + k * 1.1, 0.55, rz); colliders.push({ cx: rx + k * 1.1, cz: rz, r: 0.45, h: 1.1 }); }
    F.box(rx + 1, 0.1, rz + 1.5, 1.2, 0.2, 0.8, 'plain', 0x8a6a40);
    places.park = { x: rx + 1, z: rz + 3 };
    places.raccoonHome = { x: 20, z: 90, r: 14 };
    F.geo(new THREE.CylinderGeometry(0.42, 0.4, 1.0, 10, 1, true), 'metal', 0x6a4a3a, rx - 2.5, 0.5, rz + 2);
    F.geo(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 10), 'plain', 0x1a1210, rx - 2.5, 0.85, rz + 2);
    colliders.push({ cx: rx - 2.5, cz: rz + 2, r: 0.42, h: 1 });
    flames.push({ x: rx - 2.5, y: 1.25, z: rz + 2 });
    lights.push({ x: rx - 2.5, y: 1.8, z: rz + 2, c: 0xff8a30, i: 1.4, always: true, flicker: true });
    F.box(rx + 0.5, 0.8, rz - 2, 8, 1.6, 0.4, 'brick', 0xffffff); F.col(rx + 0.5, rz - 2, 8, 0.4, 1.6);
    F.geo(plane(6, 1.5).rotateX(Math.PI / 2), 'graffiti', 0xffffff, rx + 0.5, 0.85, rz - 1.78);
  }
}

// ---------- Maple Grove Estates (Gary's HOA subdivision) ----------
function buildEstates() {
  // entrance: brick pillars + sign, guard booth, HOA office + patrol lot
  {
    const F = frame(-40, -55, 0);
    for (const s of [-1, 1]) { F.box(s * 3.5, 1.2, 0, 1, 2.4, 1, 'brick', 0xd0b0a0); F.col(s * 3.5, 0, 1, 1, 2.4); F.geo(new THREE.SphereGeometry(0.35, 8, 6), 'plain', 0xf0f0f0, s * 3.5, 2.7, 0); F.light(s * 3.5, 2.7, 0.6, 0xfff0d0, 0.5); }
    F.box(0, 1.1, 0, 6, 1.2, 0.3, 'brick', 0xd0b0a0); F.col(0, 0, 6, 0.4, 1.6);
    F.sign('MAPLE GROVE ESTATES', '#1e2a44', '#f0e6c8', 5.6, 0.9, 1.2, 0.17, { tw: 512, th: 64, double: true });
  }
  {
    // guard booth with a striped arm (always up; Gary wants it down)
    const F = frame(-36, -69, 0);
    F.box(0, 1.3, 0, 2.4, 2.6, 2.4, 'siding', 0xf4f4f0); F.bld(0, 0, 2.4, 2.4, 2.8);
    F.box(0, 2.75, 0, 2.9, 0.3, 2.9, 'plain', 0x1e2a44);
    F.face(0, 1.6, 1.22, 1.6, 1, 'storeWin', 0xfff0d8);
    F.geo(new THREE.BoxGeometry(0.12, 0.12, 5).rotateX(-1.2), 'plain', 0xf03030, -1.4, 2.6, 1.6);
    F.light(0, 2.4, 1.6, 0xfff0d0, 0.7, { always: true });
  }
  {
    const cx = -50, cz = -44, F = frame(cx, cz, Math.PI);
    F.box(0, 1.7, 0, 12, 3.4, 7, 'brick', 0xffffff); F.bld(0, 0, 12, 7, 4);
    F.box(0, 3.5, 0, 12.6, 0.3, 7.6, 'plain', 0x2a2f3a);
    F.sign('MAPLE GROVE HOA', '#1e2a44', '#f0e6c8', 6, 1, 2.8, 3.55);
    F.face(0, 1, 3.53, 1, 2, 'door', 0x1e2a44);
    for (const x of [-3.8, 3.8]) F.face(x, 1.7, 3.53, 1.6, 1.2, 'window', 0xffffff);
    F.light(0, 2.8, 5, 0xfff0d0, 0.8);
    for (let k = 0; k < 3; k++) trashCan(...F.at(-7, -2 + k * 0.7), 0x1e2a44);
    for (let x = -6; x <= 6; x += 1.6) if (Math.abs(x) > 1.2) F.box(x, 0.45, 4.6, 1.5, 0.9, 0.9, 'leaves', 0xa0d090);
    // patrol lot
    const lot = { x: -36, z: -44 };
    frame(lot.x, lot.z, 0).flat(0, 0, 11, 10, 'asphalt', 0xe0e0e0, 0.04, '#6a6a70');
    for (let k = 0; k < 3; k++) addS(plane(0.12, 4.5), 'lamp', 0xffffff, lot.x - 3 + k * 3, 0.06, lot.z);
    places.hoaLot = lot;
  }
  // households (every one different; the HOA approved none of the fun ones)
  const E = [
    // south side of Estates Dr, facing north
    [-72, -45.5, Math.PI, { style: 'two', wall: 0xf3e6c8, roof: 0x4b5563, drive: 6, shutters: 0x2a3a5a, extras: ['hedges', 'flag', 'pool'] }],
    [-88, -45.5, Math.PI, { style: 'brick', wall: 0xffffff, roof: 0x3f4f3f, w: 10.5, drive: 6, extras: ['hedges', 'hoop', 'xmas'] }],
    // inner block, facing Estates Dr (south)
    [-70, -75, 0, { style: 'ranch', wall: 0xcfe0e8, roof: 0x34404e, w: 10, drive: 3, extras: ['tramp', 'dish'] }],
    [-86, -75, 0, { style: 'two', wall: 0xe8d0d0, roof: 0x6b4c3b, drive: 3, porch: true, extras: ['flamingos', 'gnomes'] }],
    // inner block, facing north onto Hollow Oak Ln
    [-70, -88, Math.PI, { style: 'colonial', wall: 0xffffff, roof: 0x1e2a44, w: 11, drive: 3, extras: ['flag', 'hedges'] }],
    [-86, -88, Math.PI, { style: 'ranch', wall: 0xd8e8cc, roof: 0x5a5048, w: 9.5, drive: 3, extras: ['boat', 'woodpile'] }],
    // north side of Hollow Oak Ln, backing onto the highway fence
    [-72, -114, 0, { style: 'brick', wall: 0xffffff, roof: 0x7a3e34, w: 10, drive: 5, extras: ['swing', 'yardsale'] }],
    [-88, -114, 0, { style: 'two', wall: 0xc8d4e8, roof: 0x34404e, drive: 5, shutters: 0xffffff, extras: ['shed', 'chimney'] }],
    // the cul-de-sac on the way to Gary's
    [-108, -46.5, Math.PI, { style: 'ranch', wall: 0xf4d9a8, roof: 0x4b5563, w: 10.5, drive: 6, extras: ['lawnsigns', 'garden'] }],
    [-108, -77.5, 0, { style: 'cottage', wall: 0xe6dcc0, roof: 0x3f4f3f, drive: 6, extras: ['pickets', 'chimney', 'windchime'] }],
  ];
  for (const [x, z, ry, s] of E) home(x, z, ry, s);
  // Gary: the biggest, whitest house in town, at the head of the cul-de-sac
  {
    const cx = -136, cz = -62, ry = Math.PI / 2, F = frame(cx, cz, ry);
    const g = house(cx, cz, ry, { w: 16, d: 9, h: 6, rh: 2.6, wall: 0xffffff, roof: 0x1e2a44, door: 0x1e2a44, garage: false, drive: 8.5, shutters: 0x1e2a44 });
    places.gary = { x: g.door[0], z: g.door[1], yaw: ry };
    places.garyCart = { x: g.drive[0], z: g.drive[1] + 3, yaw: ry };
    for (const s of [-2.2, 2.2]) { F.geo(new THREE.CylinderGeometry(0.25, 0.3, 5, 8), 'plain', 0xf4f4f0, s, 2.5, 6); F.post(s, 6, 0.3, 5); }
    F.geo(gable(5.2, 1.2, 2.4), 'plain', 0xf4f4f0, 0, 5, 5.4);
    F.box(9.5, 3.5, 4, 0.08, 7, 0.08, 'plain', 0xdddddd); F.box(10.3, 6.4, 4, 1.6, 1, 0.04, 'plain', 0x2050a0); F.post(9.5, 4, 0.12, 7);
    for (let x = -8.5; x <= 8.5; x += 1.6) if (Math.abs(x) > 1.6) F.box(x, 0.45, 8, 1.5, 0.9, 0.9, 'leaves', 0xa0d090);
    F.col(-5, 8, 7, 1, 1); F.col(5, 8, 7, 1, 1);
    F.box(-6, 0.6, 7, 0.7, 1.2, 0.7, 'plain', 0xf4f4f0); F.geo(new THREE.SphereGeometry(0.4, 8, 6), 'plain', 0xf4f4f0, -6, 1.5, 7);
    F.light(0, 3, 7, 0xfff0d0, 0.9); F.halo(-2.2, 4.4, 6.2, 1, 0xfff0d0); F.halo(2.2, 4.4, 6.2, 1, 0xfff0d0);
    // perfect lawn stripes
    for (let k = 0; k < 4; k++) F.geo(plane(1.6, 6), 'grass', k % 2 ? 0xd0f0b8 : 0xb8e0a0, -6 + k * 1.7, 0.04, 9.5);
    places.garyBack = (([x, z]) => ({ x, z }))(F.at(-6, -8));
  }
  // hydrants
  hydrant(-62, -66); hydrant(-94, -96); hydrant(-110, -58);
}

// ---------- Old Mill Farm: Feed & Seed, water tower, corn ----------
function buildFarm() {
  // Feed & Seed: a big red barn store on Frontage Rd
  {
    const cx = 8, cz = -92, F = frame(cx, cz, Math.PI);
    F.flat(0, 8, 26, 8, 'dirt', 0xc8c0b0, 0.04, '#8a8478');
    F.box(0, 2.6, 0, 14, 5.2, 11, 'siding', 0xb03a2a); F.bld(0, 0, 14, 11, 6);
    F.geo(gable(11.6, 4, 14.6).rotateY(Math.PI / 2), 'metal', 0x5a5a5a, 0, 5.2, 0);
    F.face(0, 1.8, 5.53, 4, 3.6, 'garage', 0xf0e8e0);
    for (const s of [-1, 1]) { F.face(s * 2, 1.8, 5.55, 0.15, 3.6, 'plain', 0xffffff); }
    F.face(0, 5.6, 5.53, 1.2, 1.2, 'window', 0xffffff);
    F.sign('FEED & SEED', '#f4f0e0', '#b03a2a', 6, 1, 4.4, 5.6);
    F.light(0, 4, 6.5, 0xfff0c0, 0.9);
    // silo + hay + pallets
    F.geo(new THREE.CylinderGeometry(2.4, 2.4, 11, 12), 'metal', 0xc8ccd0, 10, 5.5, -2); F.geo(new THREE.SphereGeometry(2.4, 12, 6, 0, 6.283, 0, Math.PI / 2), 'metal', 0xb8bcc0, 10, 11, -2);
    F.post(10, -2, 2.4, 11);
    for (const [x, z] of [[-9, 4], [-10.6, 5.6], [-9.2, 7.4], [-10, 5.6]]) hay(...F.at(x, z), 0.4);
    F.box(-6, 0.3, 8, 1.4, 0.6, 1.2, 'wood', 0xc0a080); F.col(-6, 8, 1.4, 1.2, 0.6);
    places.feed = (([x, z]) => ({ x, z }))(F.at(0, 9));
  }
  // corn field
  {
    MAP.push({ t: 'rect', x: 42, z: -80, w: 26, d: 36, ry: 0, col: '#8a8a40' });
    addS(plane(26, 36, 3, 4, 26 / 5, 36 / 5), 'dirt', 0xb0a080, 42, 0.03, -80);
    for (let x = 30; x <= 54; x += 2.2) {
      addS(new THREE.BoxGeometry(0.7, 1.9, 35), 'leaves', 0xd8e080, x, 0.95, -80);
      addS(new THREE.BoxGeometry(0.4, 0.3, 35), 'leaves', 0xf0e090, x, 2.0, -80);
    }
    // scarecrow keeping watch
    const F = frame(42, -61, 0);
    F.box(0, 1.2, 0, 0.12, 2.4, 0.12, 'wood', 0xffffff); F.box(0, 1.9, 0, 1.8, 0.1, 0.1, 'wood', 0xffffff);
    F.box(0, 1.6, 0, 0.7, 0.8, 0.35, 'plain', 0x3a5a8a); F.geo(new THREE.SphereGeometry(0.28, 6, 5), 'plain', 0xd8c890, 0, 2.3, 0);
    F.geo(new THREE.ConeGeometry(0.5, 0.4, 8), 'plain', 0x8a6a3a, 0, 2.65, 0); F.post(0, 0, 0.2, 2.4);
  }
  // the water tower: tallest thing in town, red light blinking on top
  {
    const cx = 20, cz = -70, F = frame(cx, cz, 0);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, g = new THREE.CylinderGeometry(0.25, 0.35, 16, 6);
      g.rotateZ(0.09); g.rotateY(-a); F.geo(g, 'metal', 0xb8c0c8, Math.cos(a) * 3.4, 8, Math.sin(a) * 3.4);
      F.post(Math.cos(a) * 4.1, Math.sin(a) * 4.1, 0.4, 16);
    }
    F.geo(new THREE.CylinderGeometry(0.4, 0.4, 16, 6), 'metal', 0xb8c0c8, 0, 8, 0);
    F.geo(new THREE.CylinderGeometry(5.6, 5.6, 0.2, 16), 'metal', 0x9aa0a8, 0, 16, 0);
    F.geo(new THREE.CylinderGeometry(5, 4.4, 6.5, 16), 'metal', 0xdfe6ec, 0, 19.3, 0);
    F.geo(new THREE.ConeGeometry(5.2, 2.6, 16), 'metal', 0xc8d0d8, 0, 23.8, 0);
    for (const ry of [Math.PI / 4, Math.PI * 1.25]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), signMat(TEX.sign('MAPLE GROVE', null, '#2f5d8a', 512, 96)));
      const [x, z] = rot(cx, cz, 0, 4.85, ry); m.position.set(x, 19.5, z); m.rotation.y = ry; SCENE.add(m);
    }
    lights.push({ x: cx, y: 25.4, z: cz, c: 0xff3030, i: 0.4, always: true, flicker: true });
    halos.push({ x: cx, y: 25.4, z: cz, s: 2.5, c: 0xff3030 });
    F.box(0, 0.2, 0, 9, 0.4, 9, 'plain', 0x9a9a94);
    places.tower = { x: cx + 2, z: cz + 6 };
  }
  // fence lines along Old Mill
  fence(-6, -104, -6, -100, 1.1, 0xe8e0d0);
  for (const [x, z] of [[-14, -58], [-4, -64], [14, -98], [26, -56]]) tree(x, z, 1.2 + rnd() * 0.4, { kind: 'round' });
}

// ---------- Maple Grove High ----------
function buildSchool() {
  // main building faces Main St
  {
    const cx = 98, cz = -30, F = frame(cx, cz, 0);
    F.flat(0, 13, 42, 12, 'grass', 0xd8f0c8, 0.03);
    F.box(0, 3.5, 0, 40, 7, 13, 'brick', 0xffffff); F.bld(0, 0, 40, 13, 8);
    F.box(0, 7.15, 0, 40.6, 0.3, 13.6, 'plain', 0x8a8478);
    F.box(-14, 2, -12, 10, 4, 12, 'brick', 0xf0e0d8); F.bld(-14, -12, 10, 12, 4.5); F.box(-14, 4.1, -12, 10.4, 0.25, 12.4, 'plain', 0x8a8478); // gym wing
    for (let k = 0; k < 9; k++) for (const y of [2, 5]) { if (k === 4) continue; F.face(-16 + k * 4, y, 6.53, 2.4, 1.4, 'window', 0xffffff); }
    // entrance portico
    F.box(0, 6, 8.2, 9, 0.5, 3.6, 'plain', 0xf0ece4);
    for (const s of [-3.6, -1.2, 1.2, 3.6]) { F.geo(new THREE.CylinderGeometry(0.3, 0.32, 5.8, 8), 'plain', 0xf4f4f0, s, 2.9, 9.6); F.post(s, 9.6, 0.32, 6); }
    F.face(0, 1.4, 6.55, 3, 2.8, 'door', 0x4a6a9a);
    F.sign('MAPLE GROVE HIGH', '#f0ece4', '#1e3a6a', 8, 1.1, 6.9, 10.02, { tw: 512, th: 64 });
    F.light(0, 5, 9, 0xfff0d0, 1);
    // marquee + flagpole + bike rack
    F.box(-12, 1, 18, 4, 1.4, 0.4, 'brick', 0xd0c0b0); F.col(-12, 18, 4, 0.4, 1.4);
    F.sign('GO RACCOONS! HOMECOMING FRI', '#111111', '#ffd040', 3.8, 0.6, 1.25, 18.22, { tw: 512, th: 64, glow: true, lx: -12 });
    F.box(10, 4, 16, 0.1, 8, 0.1, 'plain', 0xdddddd); F.box(10.8, 7.4, 16, 1.6, 1, 0.04, 'plain', 0x2050a0); F.post(10, 16, 0.12, 8);
    for (let k = 0; k < 5; k++) F.box(14 + k * 0.6, 0.4, 8, 0.05, 0.8, 0.9, 'metal', 0x888888);
    F.col(15.2, 8, 3, 1, 0.8);
    places.school = (([x, z]) => ({ x, z }))(F.at(0, 12));
  }
  // parking lot + school bus by School Rd
  {
    const F = frame(72, -32, 0);
    F.flat(0, 0, 13, 34, 'asphalt', 0xe0e0e0, 0.04, '#6a6a70');
    for (let k = 0; k < 7; k++) addS(plane(4.5, 0.12), 'lamp', 0xffffff, 74, 0.06, -46 + k * 4.5);
    F.box(-3, 1.5, -6, 2.5, 2.4, 10, 'plain', 0xf0b020); F.box(-3, 2.9, -6, 2.4, 0.3, 9.8, 'plain', 0xf4f0e0);
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) F.face(-3 + s * 1.26, 2.1, -10 + k * 1.5, 1.1, 0.7, 'window', 0x9aa0a8, s > 0 ? 2 : 3);
    for (const z of [-9.5, -2.5]) for (const s of [-1, 1]) F.geo(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, -3 + s * 1.2, 0.5, z);
    F.col(-3, -6, 2.5, 10, 3);
    F.sign('SCHOOL BUS', '#f0b020', '#111111', 1.8, 0.4, 2.4, -0.98, { lx: -3 });
  }
  // football field with track, bleachers, goal posts, stadium lights
  {
    const cx = 102, cz = -80, F = frame(cx, cz, 0);
    MAP.push({ t: 'rect', x: cx, z: cz, w: 34, d: 58, ry: 0, col: '#9a5a40' });
    MAP.push({ t: 'rect', x: cx, z: cz, w: 22, d: 46, ry: 0, col: '#4f9a40' });
    F.flat(0, 0, 34, 58, 'dirt', 0xc06a4a, 0.03);
    F.flat(0, 0, 22, 46, 'grass', 0xc8ffb8, 0.04);
    for (let k = 0; k <= 10; k++) addS(plane(22, 0.15), 'lamp', 0xffffff, cx, 0.05, cz - 20 + k * 4);
    for (const s of [-1, 1]) {
      F.box(0, 1.5, s * 22.5, 0.15, 3, 0.15, 'plain', 0xf0e040);
      F.box(0, 3, s * 22.5, 5.6, 0.15, 0.15, 'plain', 0xf0e040);
      for (const x of [-2.8, 2.8]) F.box(x, 4.5, s * 22.5, 0.12, 3, 0.12, 'plain', 0xf0e040);
      F.post(0, s * 22.5, 0.15, 3);
    }
    // bleachers on the west side
    for (let k = 0; k < 6; k++) F.box(-20 - k * 0.8, 0.3 + k * 0.45, 0, 1.2, 0.15, 30, 'metal', 0xb8bcc4);
    F.box(-22, 1.3, 0, 4.6, 2.6, 30, 'plain', 0x4a4a52, 0); F.col(-22, 0, 4.6, 30, 3);
    F.sign('HOME OF THE RACCOONS', '#1e3a6a', '#ffd040', 10, 1.2, 3.4, 0, { tw: 512, th: 64, rr: -Math.PI / 2, lx: -24.4 });
    // stadium light towers
    for (const [x, z] of [[-18, -26], [18, -26], [-18, 26], [18, 26]]) {
      F.box(x, 7, z, 0.3, 14, 0.3, 'metal', 0x9aa0a8); F.post(x, z, 0.25, 14);
      F.box(x, 14, z, 2.2, 1.4, 0.3, 'lamp', 0xffffff, Math.atan2(-x, -z));
      F.light(x * 0.8, 12, z * 0.8, 0xf8f8ff, 1.6); F.halo(x, 14, z, 3.4, 0xf0f4ff);
    }
    // chain-link fence round the track, open toward the school
    for (const [x0, z0, x1, z1] of [[-17.5, -29.5, 17.5, -29.5], [-17.5, -29.5, -17.5, 29.5], [17.5, -29.5, 17.5, 29.5], [-17.5, 29.5, -4, 29.5], [4, 29.5, 17.5, 29.5]]) {
      const [a, b] = F.at(x0, z0), [c, d] = F.at(x1, z1); fence(a, b, c, d, 1.6, 0x8a9098);
    }
    places.endzone = (([x, z]) => ({ x, z }))(F.at(0, -21));
  }
}

// ---------- Pine Hollow (the older country neighbourhood) ----------
function buildPineHollow() {
  const H = [
    // facing north onto Main St
    [80, 14.5, Math.PI, { style: 'farm', wall: 0xf0f0ea, roof: 0x6a2a2a, w: 10, drive: 5, gravel: true, extras: ['tractor', 'woodpile', 'flag'], flag: 0x2a5a2a }],
    [112, 15, Math.PI, { style: 'mobile', wall: 0xe0e8f0, roof: 0x8a9098, trim: 0x2a6ab0, drive: 5, extras: ['flamingos', 'junker'], junk: 0x4a6a8a }],
    // facing south onto Hollow Ln
    [74, 32, 0, { style: 'cottage', wall: 0xf4d9a8, roof: 0x5a3a2a, drive: 4, extras: ['garden', 'scarecrow', 'chimney'] }],
    [112, 32, 0, { style: 'ranch', wall: 0xc8d8c0, roof: 0x3f4f3f, w: 10.5, drive: 4, porch: true, extras: ['hoop', 'tramp', 'dish'] }],
    // facing north onto Hollow Ln
    [73, 58.5, Math.PI, { style: 'brick', wall: 0xffffff, roof: 0x4b5563, w: 10, drive: 5, extras: ['swing', 'gnomes'] }],
    [114, 58.5, Math.PI, { style: 'two', wall: 0xd0b8e0, roof: 0x34404e, drive: 5, porch: true, extras: ['xmas', 'yardsale'] }],
    // Pine Ct cul-de-sac
    [80, 74, Math.PI / 2, { style: 'mobile', wall: 0xf4f0d0, roof: 0x9a9a90, trim: 0x8a4a2a, awning: 0xc04a3a, drive: 3.5, extras: ['coop', 'windchime'] }],
    [108, 74, -Math.PI / 2, { style: 'ranch', wall: 0xe8c8b0, roof: 0x6b4c3b, w: 9.5, drive: 3.5, extras: ['boat', 'shed'], shedCol: 0x3a6a8a }],
    // south side of Birch St, backing onto the woods
    [72, 109.5, Math.PI, { style: 'farm', wall: 0xfff4d8, roof: 0x3a4a5a, w: 10, drive: 5, gravel: true, extras: ['hay', 'scarecrow', 'coop'] }],
    [90, 110, Math.PI, { style: 'mobile', wall: 0xc8e0d0, roof: 0x8a9098, trim: 0x3a8a5a, awning: 0x3a6ab0, drive: 5, extras: ['lawnsigns', 'woodpile'] }],
    [107, 109.5, Math.PI, { style: 'cottage', wall: 0xc0d8f0, roof: 0x2a3a4a, w: 8, drive: 5, extras: ['pickets', 'gnomes', 'swing'] }],
    [124, 109.5, Math.PI, { style: 'ranch', wall: 0xf0d0c0, roof: 0x5a5048, w: 9.5, drive: 5, extras: ['junker', 'dish', 'flamingos'], junk: 0x6a3a8a }],
  ];
  for (const [x, z, ry, s] of H) {
    if (s.extras.includes('hay')) { s.extras = s.extras.filter((e) => e !== 'hay'); const [hx, hz] = rot(x, z, -9, -2, ry); hay(hx, hz, 0.3); hay(hx + 1.6, hz + 0.4, 0.2); }
    home(x, z, ry, s);
  }
  // country details: mailboxes on posts, a few big oaks, a hand-painted sign
  for (const [x, z] of [[96, 20], [130, 70], [66, 75], [100, 88], [120, 28]]) tree(x, z, 1.4 + rnd() * 0.4, { kind: 'round' });
  const F = frame(64, 40, Math.PI / 4);
  F.box(0, 0.7, 0, 0.12, 1.4, 0.12, 'wood', 0xffffff);
  F.sign('FRESH EGGS $3', '#f4f0e0', '#8a3a2a', 1.6, 0.5, 1.3, 0.08);
  hydrant(66, 50); hydrant(122, 90);
}

// ---------- utility poles with sagging wires ----------
function buildPoles(scene) {
  const wires = [];
  const chain = (names, side, step = 24) => {
    const pts = names.map((k) => NODES[N[k]]);
    const poles = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1], L = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
      const w = ADJ[N[names[i]]].find((e) => e.n === N[names[i + 1]]).w;
      for (let t = 8; t < L - 6; t += step) poles.push([A.x + dx * t - dz * side * (w / 2 + 2.4), A.z + dz * t + dx * side * (w / 2 + 2.4), Math.atan2(dx, dz)]);
    }
    poles.forEach(([x, z, ry], k) => {
      addS(new THREE.CylinderGeometry(0.13, 0.17, 8.5, 7), 'bark', 0xc8b8a0, x, 4.25, z);
      addS(new THREE.BoxGeometry(1.8, 0.12, 0.12), 'wood', 0xffffff, x, 7.8, z, ry);
      addS(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8), 'metal', 0x9a9a9a, x, 7.3, z);
      colliders.push({ cx: x, cz: z, r: 0.18, h: 8 });
      const n = poles[k + 1]; if (!n) return;
      const c = Math.cos(ry), s = Math.sin(ry), cn = Math.cos(n[2]), sn = Math.sin(n[2]);
      for (const ox of [-0.8, 0, 0.8]) for (let j = 0; j < 8; j++) {
        const a = j / 8, b = (j + 1) / 8, sag = (t) => 7.86 - Math.sin(t * Math.PI) * 0.7;
        const p0 = [x + ox * c, z - ox * s], p1 = [n[0] + ox * cn, n[1] - ox * sn];
        wires.push(p0[0] + (p1[0] - p0[0]) * a, sag(a), p0[1] + (p1[1] - p0[1]) * a, p0[0] + (p1[0] - p0[0]) * b, sag(b), p0[1] + (p1[1] - p0[1]) * b);
      }
    });
  };
  chain(['A', 'B', 'X', 'D', 'E'], 1);
  chain(['X', 'W1', 'W2', 'W3'], 1);
  chain(['M1', 'M2', 'P2', 'P4'], -1);
  chain(['M1', 'S1', 'S2'], 1);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x15151a })));
}

// ---------- minimap ----------
/** Draw the static town map. o(v) maps a world coordinate to pixels, s is pixels per metre. */
export function drawMap(g, o, s) {
  g.fillStyle = '#3f6a36'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  const poly = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(o(x), o(z)) : g.moveTo(o(x), o(z)))); g.closePath(); g.fill(); };
  for (const m of MAP) {
    g.fillStyle = m.col; g.strokeStyle = m.col;
    if (m.t === 'poly') poly(m.pts);
    else if (m.t === 'rect') { g.save(); g.translate(o(m.x), o(m.z)); g.rotate(-m.ry); g.fillRect(-m.w / 2 * s, -m.d / 2 * s, m.w * s, m.d * s); g.restore(); }
    else if (m.t === 'line') { g.lineWidth = m.w * s; g.lineCap = g.lineJoin = 'round'; g.beginPath(); m.pts.forEach(([x, z], i) => (i ? g.lineTo(o(x), o(z)) : g.moveTo(o(x), o(z)))); g.stroke(); }
  }
  g.lineCap = g.lineJoin = 'round';
  for (const pass of [0, 1, 2]) for (const e of EDGES) {
    const t = e.t || (e.dirt ? 'dirt' : 'paved');
    if ((pass === 0) !== (t === 'dirt' || t === 'path' || t === 'walk') || (pass === 2) !== (t === 'hwy')) continue;
    const A = NODES[e.a], B = NODES[e.b];
    g.strokeStyle = t === 'dirt' ? '#a08660' : t === 'hwy' ? '#46464c' : t === 'path' ? '#c0a878' : t === 'walk' ? '#b4b0a4' : '#5c5c62'; g.lineWidth = Math.max(e.w, t === 'path' || t === 'walk' ? 3 : 0) * s;
    g.beginPath(); g.moveTo(o(A.x), o(A.z)); g.lineTo(o(B.x), o(B.z)); g.stroke();
  }
  g.fillStyle = '#5c5c62';
  for (const n of NODES) if (n.bulb && ADJ[NODES.indexOf(n)].length) { g.beginPath(); g.arc(o(n.x), o(n.z), n.bulb * s, 0, 7); g.fill(); }
  g.fillStyle = '#d8cca8';
  for (const c of colliders) {
    if (!c.bld) continue;
    if (c.ob) { g.save(); g.translate(o(c.cx), o(c.cz)); g.rotate(Math.atan2(-c.s, c.c)); g.fillRect(-c.hw * s, -c.hd * s, c.hw * 2 * s, c.hd * 2 * s); g.restore(); }
    else g.fillRect(o(c.x0), o(c.z0), (c.x1 - c.x0) * s, (c.z1 - c.z0) * s);
  }
}

// ---------- collision ----------
/** Polygon collider from world points: { poly, lp (local points), cx, cz, rot, x0..z1 bounds, h }. */
export function polyCollider(pts, h = 5, o = {}) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  return { poly: pts.map((p) => [p[0], p[1]]), lp: pts.map(([x, z]) => [x - cx, z - cz]), cx, cz, rot: 0, x0, x1, z0, z1, h, ...o };
}
/** Nearest point on a polygon's edges to (x,z), and whether (x,z) is inside. */
function polyNear(P, x, z) {
  let inside = false, bd = 1e18, qx = x, qz = z;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const ax = P[j][0], az = P[j][1], bx = P[i][0], bz = P[i][1];
    if ((bz > z) !== (az > z) && x < ((ax - bx) * (z - bz)) / (az - bz) + bx) inside = !inside;
    const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L));
    const px = ax + ex * t, pz = az + ez * t, d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < bd) { bd = d; qx = px; qz = pz; }
  }
  return { inside, qx, qz, d: Math.sqrt(bd) };
}
const CELL = 12;
let GRID = null, STAMP = 0;
function cbounds(q) {
  if (q.r !== undefined) return [q.cx - q.r, q.cx + q.r, q.cz - q.r, q.cz + q.r];
  if (q.ob) { const ex = q.hw * Math.abs(q.c) + q.hd * Math.abs(q.s), ez = q.hw * Math.abs(q.s) + q.hd * Math.abs(q.c); return [q.cx - ex, q.cx + ex, q.cz - ez, q.cz + ez]; }
  return [q.x0, q.x1, q.z0, q.z1];
}
const ckey = (i, j) => (i + 512) * 4096 + (j + 512);
function gridBuild() {
  GRID = new Map(); GRID.n = colliders.length;
  for (const q of colliders) {
    const [a, b, c, d] = cbounds(q);
    for (let i = Math.floor(a / CELL); i <= Math.floor(b / CELL); i++) for (let j = Math.floor(c / CELL); j <= Math.floor(d / CELL); j++) {
      const k = ckey(i, j); let l = GRID.get(k); if (!l) GRID.set(k, l = []); l.push(q);
    }
  }
}
/** P18: add or drop one collider in the grid without a full rebuild (the collider must already be in / out of `colliders`). */
function gridPatch(q, on) {
  if (!GRID) return;
  const [a, b, c, d] = cbounds(q);
  for (let i = Math.floor(a / CELL); i <= Math.floor(b / CELL); i++) for (let j = Math.floor(c / CELL); j <= Math.floor(d / CELL); j++) {
    const k = ckey(i, j); let l = GRID.get(k);
    if (on) { if (!l) GRID.set(k, l = []); l.push(q); } else if (l) { const ix = l.indexOf(q); if (ix >= 0) l.splice(ix, 1); }
  }
  GRID.n = colliders.length;
}
const _near = [];
function nearby(x, z, r) {
  if (!GRID || GRID.n !== colliders.length) gridBuild();
  STAMP++; _near.length = 0;
  for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
    const l = GRID.get(ckey(i, j)); if (!l) continue;
    for (const q of l) if (q._st !== STAMP) { q._st = STAMP; _near.push(q); }
  }
  return _near;
}

/** Push a circle out of all colliders. Returns {x,z,hit,nx,nz}. */
export function collide(x, z, r, y = 0, o) {
  let hit = false, nx = 0, nz = 0;
  const list = nearby(x, z, r + 1.5); // P13: iterate the shared scratch list directly (nothing below calls nearby)
  for (let it = 0; it < 2; it++) for (let i = 0; i < list.length; i++) { const c = list[i];
    if (y >= (c.top ?? c.h ?? 5) - 0.02) continue; // engine: standing on top of it
    if (c.water && o && o.swim) continue;  // gameplay: the player can swim, cars and peds stay out
    if (c.r !== undefined) {
      const dx = x - c.cx, dz = z - c.cz, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-6) { x = c.cx + dx / d * m; z = c.cz + dz / d * m; hit = true; nx = dx / d; nz = dz / d; }
    } else if (c.poly) {
      if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue;
      const q = polyNear(c.poly, x, z);
      if (!q.inside && q.d >= r) continue;
      if (q.d < 1e-6) continue;
      const s = q.inside ? -1 : 1, ux = (x - q.qx) / q.d * s, uz = (z - q.qz) / q.d * s;
      x = q.qx + ux * r; z = q.qz + uz * r; nx = ux; nz = uz; hit = true;
    } else if (c.ob) {
      const dx = x - c.cx, dz = z - c.cz;
      let lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
      if (Math.abs(lx) > c.hw + r || Math.abs(lz) > c.hd + r) continue;
      const qx = Math.max(-c.hw, Math.min(lx, c.hw)), qz = Math.max(-c.hd, Math.min(lz, c.hd));
      const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
      if (d > r) continue;
      let nlx, nlz;
      if (d < 1e-6) {
        const opts = [[c.hw - lx, 1, 0], [lx + c.hw, -1, 0], [c.hd - lz, 0, 1], [lz + c.hd, 0, -1]].sort((a, b) => a[0] - b[0]);
        [, nlx, nlz] = opts[0];
        if (nlx) lx = nlx * (c.hw + r); else lz = nlz * (c.hd + r);
      } else { lx = qx + ex / d * r; lz = qz + ez / d * r; nlx = ex / d; nlz = ez / d; }
      x = c.cx + lx * c.c + lz * c.s; z = c.cz - lx * c.s + lz * c.c;
      nx = nlx * c.c + nlz * c.s; nz = -nlx * c.s + nlz * c.c; hit = true;
    } else {
      if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue;
      const qx = Math.max(c.x0, Math.min(x, c.x1)), qz = Math.max(c.z0, Math.min(z, c.z1));
      let dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
      if (d > r) continue;
      if (d < 1e-6) { // centre inside the box: push out the shortest way
        const opts = [[x - c.x0, -1, 0], [c.x1 - x, 1, 0], [z - c.z0, 0, -1], [c.z1 - z, 0, 1]].sort((a, b) => a[0] - b[0]);
        const [pen, ox, oz] = opts[0];
        x += ox * (pen + r); z += oz * (pen + r); nx = ox; nz = oz;
      } else { x = qx + dx / d * r; z = qz + dz / d * r; nx = dx / d; nz = dz / d; }
      hit = true;
    }
  }
  return { x, z, hit, nx, nz };
}

/** engine: the top of the highest solid thing under x,z the player can stand on from height y (steps up 0.5 m).
 *  Every collider is standable (benches, slides, cars of stone, roofs if you can jump that high); water is not. */
/** engine: breakable props (street lamps, hydrants) whose collider overlaps a circle. Returns engine colliders. */
export function breakablesNear(x, z, r) {
  const out = [];
  for (const c of nearby(x, z, r + 0.5)) { if ((c.brk || (c._m && c._m.orig.brk)) && c.r !== undefined && Math.hypot(x - c.cx, z - c.cz) < c.r + r) out.push(c); }
  return out;
}
export function colTop(x, z, y) {
  let best = 0;
  for (const c of nearby(x, z, 0.1)) {
    const top = c.top ?? c.h ?? 5;
    if (c.water || top <= best || top > y + 0.5) continue;
    let inside;
    if (c.r !== undefined) inside = Math.hypot(x - c.cx, z - c.cz) < c.r;
    else if (c.poly) inside = x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && polyNear(c.poly, x, z).inside;
    else if (c.ob) { const dx = x - c.cx, dz = z - c.cz; inside = Math.abs(dx * c.c - dz * c.s) < c.hw && Math.abs(dx * c.s + dz * c.c) < c.hd; }
    else inside = x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1;
    if (inside) best = top;
  }
  return best;
}
setFloorProvider(colTop);

export function blocked(x, y, z) {
  for (const c of nearby(x, z, 0.1)) {
    if (y > (c.h ?? 5) || c.water) continue;
    if (c.r !== undefined) { if (Math.hypot(x - c.cx, z - c.cz) < c.r) return true; }
    else if (c.poly) { if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && polyNear(c.poly, x, z).inside) return true; }
    else if (c.ob) { const dx = x - c.cx, dz = z - c.cz; if (Math.abs(dx * c.c - dz * c.s) < c.hw && Math.abs(dx * c.s + dz * c.c) < c.hd) return true; }
    else if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true;
  }
  return false;
}

export function inZone(name, x, z) {
  return zones.some((q) => q.name === name && x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
}

/** Pickup spots for game.js. */
places.cashSpots = [[-60, -36], [44, -40], [124, -12], [-128, 86], [100, 124]];
