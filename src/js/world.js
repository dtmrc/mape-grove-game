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
// Countryside (2026-11-13 expansion, buildCountry): the play area grew from the town's ~290 m to 600 m square. County Rd 12
// rings the town (paved north + east, dirt south + west) with dirt spokes in from the town's dead ends; Hwy 9 runs on to
// the new north + east edges and Old Mill Rd to the south edge (bridge out). Roads, trees, fences, fields: no buildings.
// The town is chunk 0 and the countryside eight 45 degree sectors (terrain.js chunkOf): each chunk merges and culls alone.
import * as THREE from 'three';
import { makeWaterMaterial, patchCreek } from './water.js';
import { buildDock } from './dock.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, phong, basic, rnd, rndSeed } from './gfx.js';
import { HOUSES, SIGN, MODEL_IDS, houseGeo, houseTex } from './houses.js';
import { buildRoofs, roofTop } from './rooftops.js';   // walkable roofs
import { roundCrown, pineCrown, bushCrown } from './trees.js';   // render pass: faceted, shaded tree crowns
import { makeRV, makeCar } from './models.js';
import { initRoads } from './roads.js';
import { flowRoads } from './roadflow.js';
import { initGround } from './ground.js';
import { prepareWorld, makeGroundMesh, patchMaterial, floors, setFloorProvider, chunkOf, cullBounds, inTown, hillsAt, edgeRise, noise2, heightAt as terH, slopeAt as terSlope } from './terrain.js';
export { inTown };

export const LIMIT = 300;      // playable half-size (x, z: ±LIMIT); the town itself is the old ±145 (terrain.js TOWN)
export const NORTH = -LIMIT;   // north edge
export const MAP_HALF = 310;   // minimap half-size

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
export const worldChunks = []; // merged static meshes, one per material per chunk (debug / stats)
const MAP = [];               // minimap shapes
function signMat(map, o = {}) { const m = basic({ map, ...o }); signMats.push(m); return m; }

const buckets = {};
const NO_AO = new Set(['grass', 'road', 'asphalt', 'crosswalk', 'sidewalk', 'dirt', 'shadow', 'shadowR', 'lamp', 'puddle', 'creek', 'storeWin', 'posterCat', 'posterHoa', 'graffiti', 'shingle', 'leaves']);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

function addS(geo, key, color, x, y, z, ry = 0) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3), pre = g.attributes.color;   // a baked 'color' attribute (trees.js) is multiplied in
  for (let i = 0; i < n; i++) { const k = pre ? pre.getX(i) : 1; col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  if (key.startsWith('h_')) { const t = 0.95 + Math.random() * 0.08; for (let i = 0; i < col.length; i++) col[i] *= t; }   // Tracebench houses: light is baked into the atlas
  else if (!NO_AO.has(key)) {
    // baked ambient occlusion: darker near the ground, plus a little per-object variation
    const pos = g.attributes.position, tint = 0.9 + Math.random() * 0.14;
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i), t = Math.min(1, Math.max(0, y / 2.4));
      const f = (0.42 + 0.58 * t * t * (3 - 2 * t)) * tint;
      col[i * 3] *= f; col[i * 3 + 1] *= f; col[i * 3 + 2] *= f;
    }
  }
  g.userData.o = [x, z]; // engine: geometry origin (terrain anchor)
  g.userData.ck = chunkOf(x, z); // engine: which map chunk merges it
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
  // box with world-scaled UVs so textures tile at a fixed density. Tall boxes get a row of vertices ~1.2 m up, so the
  // baked ground occlusion (addS) stays a dark band at the base instead of a gradient smeared up the whole wall.
  const g = new THREE.BoxGeometry(w, h, d, 1, h > 3 ? 2 : 1, 1);
  if (h > 3) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) < 1e-4) p.setY(i, -h / 2 + 1.4); }
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

/** Just the two gable-end triangles of a gable(w, h, d) roof (ridge along x), for walls that run up into the roof. */
function gableEnds(w, h, d, scale = 0.5) {
  const x = w / 2, z = d / 2;
  const P = [[-x, 0, -z], [-x, 0, z], [-x, h, 0], [x, 0, z], [x, 0, -z], [x, h, 0]];
  const U = [[-z, 0], [z, 0], [0, h], [z, 0], [-z, 0], [0, h]].map(([u, v]) => [u * scale, v * scale]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U.flat(), 2));
  g.computeVertexNormals();
  return g;
}
/** Render pass 2026-11-27: real trim on a house-style building, all in the shared 'plain' bucket (no extra draw calls).
 *  A window gets a casing (header with a drip cap, jambs) and a projecting sill; dir 0..3 = front/back/right/left face. */
function winTrim(F, lx, y, lz, ww, wh, dir, col) {
  const t = 0.1, o = 0.05, r = [0, Math.PI, Math.PI / 2, -Math.PI / 2][dir];
  const off = (a, b) => { const c = Math.cos(r), s = Math.sin(r); return [lx + a * c + b * s, lz - a * s + b * c]; };   // a along the face, b out of it
  const box = (a, b, yy, w, h, d) => { const [x, z] = off(a, b); F.box(x, yy, z, w, h, d, 'plain', col, r); };
  box(0, o, y + wh / 2 + t / 2, ww + 2 * t + 0.04, t, 0.08);            // header
  box(0, o + 0.03, y + wh / 2 + t + 0.03, ww + 2 * t + 0.14, 0.05, 0.14);   // drip cap
  for (const sd of [-1, 1]) box(sd * (ww / 2 + t / 2), o, y, t, wh, 0.07); // jambs
  box(0, o + 0.05, y - wh / 2 - 0.04, ww + 2 * t + 0.16, 0.08, 0.18);     // sill
}

/** Shop window on a frame's front face (+z, wall plane at lz): the glass plane plus an aluminium storefront frame with a
 *  centre mullion, a projecting sill and a kick plate under it. Bottom of the glass = y - h / 2. */
function shopWin(F, lx, y, lz, w, h, key = 'storeWin', tint = 0xffffff, o = {}) {
  const fc = o.frame ?? 0x3a3c42, kc = o.kick ?? 0x55575e, t = 0.09;
  F.face(lx, y, lz, w, h, key, tint);
  F.box(lx, y + h / 2 + t / 2, lz + 0.04, w + 2 * t, t, 0.1, 'plain', fc);
  F.box(lx, y - h / 2 - t / 2, lz + 0.07, w + 2 * t + 0.06, t, 0.16, 'plain', fc);
  for (const sd of [-1, 1]) F.box(lx + sd * (w / 2 + t / 2), y, lz + 0.04, t, h, 0.1, 'plain', fc);
  if (w > 1.7 && !o.noMullion) F.box(lx, y, lz + 0.04, 0.06, h, 0.06, 'plain', fc);
  const kb = y - h / 2 - t;
  if (kb > 0.15 && !o.noKick) F.box(lx, kb / 2, lz + 0.03, w + 2 * t, kb, 0.06, 'plain', kc);
}
/** A rooftop condenser / AC unit (grille top, a little duct), sitting on a flat roof at height y. */
function roofUnit(F, lx, y, lz, s = 1) {
  F.box(lx, y + 0.45 * s, lz, 1.4 * s, 0.9 * s, 1.0 * s, 'metal', 0xb8bcc0);
  F.box(lx, y + 0.92 * s, lz, 1.2 * s, 0.05, 0.8 * s, 'plain', 0x3a3c40);
  F.box(lx + 0.9 * s, y + 0.25 * s, lz, 0.4 * s, 0.25 * s, 0.25 * s, 'metal', 0x9a9ea4);
}
/** Parapet coping along the top of a flat-roofed box (w x d at height h): a lip that hangs a little proud of each wall. */
function coping(F, lx, lz, w, d, h, col, ht = 0.22) {
  for (const sd of [-1, 1]) { F.box(lx, h + ht / 2, lz + sd * d / 2, w + 0.3, ht, 0.3, 'plain', col); F.box(lx + sd * w / 2, h + ht / 2, lz, 0.3, ht, d, 'plain', col); }
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
      if (key === 'window' && col === 0xffffff && w >= 0.8) winTrim(F, lx, y, lz, w, h, dir, F.trim ?? 0xf0ece2);   // render pass: every building window gets a casing + sill
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
  const t = o.t || (o.dirt ? 'dirt' : 'paved'), w = o.w || (t === 'hwy' ? 12 : t === 'dirt' ? 8 : 10);   // roads 2026-11-24: dirt 7 -> 8 m
  for (let i = 0; i < names.length - 1; i++) {
    const a = N[names[i]], b = N[names[i + 1]], e = { w, t, dirt: t === 'dirt', nt: !!o.nt, ...(o.sw ? { sw: true } : {}), ...(o.county ? { county: true } : {}) };
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
// ---- countryside (2026-11-13). Keep new nodes AFTER the town's 29: saved editor road graphs index the town nodes and the
// editor (devtools.js migrateRoads) splices nodes added here in after them.
nd('HNJ', -74, -238); nd('HNE', -79, -298);                     // Hwy 9 north: County Rd 12 junction, closed at the north edge
nd('HEJ', 242, 0); nd('HEE', 298, 0);                           // Hwy 9 east
nd('OMJ', 94, 238); nd('OMS', 101, 298);                        // Old Mill Rd south: ring junction, bridge out at the edge
nd('CNW', -236, -228); nd('CN0', -160, -246); nd('CN1', 60, -232); nd('CN2', 160, -242); nd('CNE', 236, -224);   // County Rd 12 north
nd('CE1', 252, -110); nd('CE2', 240, 112); nd('CSE', 224, 232);                                                  // east
nd('CS1', 160, 246); nd('CS2', 0, 240); nd('CS3', -120, 246); nd('CSW', -230, 228);                              // south (dirt)
nd('CW1', -250, 110); nd('CW2', -246, -10); nd('CW3', -252, -118);                                               // west (dirt)
nd('SN', 64, -172); nd('PE', 182, 102); nd('GW1', -150, -112);                                                   // spokes
nd('EW', -200, -115); nd('MC', -150, -160); nd('AC', -200, -160); nd('WW1', -200, -75); nd('WW2', -200, -42); nd('BC', -162, -75);   // Estates west
// 2026-11-24 (diet: only two cul-de-sacs, flesh out the roads): Magnolia Dr joins Magnolia + Aspen, Juniper Ln runs it back to
// Hollow Oak Ln, Birch Ln runs through to the parkway. Cul-de-sacs left: Gary's (G5) and Willow Ct (WW2).
nd('ME', -104, -160);

link(['HN', 'RAMP'], { t: 'hwy' });
link(['RAMP', 'A'], { t: 'hwy' });
link(['A', 'B', 'X'], { t: 'hwy' });
link(['X', 'D', 'E', 'F']);
link(['W1', 'X']);
link(['X', 'M1', 'M2', 'HE'], { t: 'hwy' });
link(['HE', 'HX'], { t: 'hwy' });
NODES[N.X].cw = true;
link(['M2', 'P2'], { dirt: true });
link(['M1', 'S1', 'S2', 'A']);
link(['B', 'G1', 'G2', 'G5']);
link(['G1', 'G3', 'G4', 'G2']);
link(['G3', 'A']);
link(['L1', 'D']);   // Lake Rd's leg up to the crossroads (X-L1) was removed 2026-11-13 (diet: no road triangle)
link(['W1', 'W2', 'W3', 'L2', 'L1'], { dirt: true });
link(['D', 'P1', 'PC', 'P2', 'P4', 'E']);
link(['M1', 'P1']);
link(['PC', 'PC2']);
// countryside
link(['HN', 'HNJ'], { t: 'hwy' }); link(['HNJ', 'HNE'], { t: 'hwy', nt: true });
link(['HX', 'HEJ'], { t: 'hwy' }); link(['HEJ', 'HEE'], { t: 'hwy', nt: true });
link(['F', 'OMJ']); link(['OMJ', 'OMS'], { nt: true });
link(['CNW', 'CN0', 'HNJ', 'CN1', 'CN2', 'CNE', 'CE1', 'HEJ', 'CE2', 'CSE'], { w: 10, county: true });   // County Rd 12 (paved; 9 -> 10 m 2026-11-24)
link(['CSE', 'CS1', 'OMJ'], { dirt: true });   // County Rd 12 (gravel), east of Old Mill Rd
link(['CW3', 'CNW'], { dirt: true });          // ... and the west stretch north of the Estates
// 2026-11-22 (diet): the gravel stretch through Hollow Woods (OMJ-CS2-CS3-CSW-CW1-CW2-CW3) is gone; a walking trail
// winds through the woods instead. Its nodes stay (saved road graphs index them) but are dead and unlinked.
for (const k of ['CS2', 'CS3', 'CSW', 'CW1', 'CW2']) NODES[N[k]].dead = true;
NODES[N.BC].dead = true;   // 2026-11-24: Birch Ln dropped (fewer Estates crossings)
link(['S2', 'SN', 'CN1'], { dirt: true });      // Sawyer Farm Rd (School Rd north)
link(['P4', 'PE', 'CE2'], { dirt: true });      // Hollow Ln east
link(['G4', 'GW1', 'EW', 'CW3'], { w: 9, county: true });     // Estates Pkwy (the Estates' Phase II, west)
link(['EW', 'AC'], { w: 8 });                                   // Aspen Ct (Magnolia Ct's GW1 leg dropped: fewer crossings)
link(['MC', 'AC'], { w: 8 });                                   // Magnolia Dr (joins the two courts: no more dead ends)
link(['MC', 'ME', 'G4'], { w: 8 });                             // Juniper Ln, back to Hollow Oak Ln
link(['EW', 'WW1', 'WW2'], { w: 8 });                           // Willow Way (to Willow Ct); BC is a dead node (Birch Ln dropped)
const BULBS = [['G5', 9], ['PC2', 9], ['WW2', 9]];
for (const [k, r] of BULBS) NODES[N[k]].bulb = r;
// the Estates' streets get sidewalks both sides (roads.js draws them for edges flagged sw)
const ESTATE_NODES = new Set(['B', 'G1', 'G2', 'G3', 'G4', 'G5', 'GW1', 'EW', 'MC', 'AC', 'ME', 'WW1', 'WW2', 'BC'].map((k) => N[k]));
for (const e of EDGES) if (ESTATE_NODES.has(e.a) && ESTATE_NODES.has(e.b)) e.sw = true;

// 2026-11-24 roads overhaul (diet: "driving is sluggish with all the tight turns"): every corner becomes a curve sized for
// its road (roadflow.js). Corner nodes slide onto their arc; arc nodes are appended after all hand-placed ones.
// Buildings below are placed after this, so they see the curved roads.
export const FLOW_REPORT = flowRoads(NODES, EDGES);
for (const L of ADJ) L.length = 0;
while (ADJ.length < NODES.length) ADJ.push([]);
for (const e of EDGES) { const { a, b, ...o } = e; ADJ[a].push({ n: b, ...o }); ADJ[b].push({ n: a, ...o }); }
/** Node indices from named node a to named node b along the road, through any curve nodes the flow pass put between them. */
function via(a, b) {
  const s = N[a], t = N[b], prev = new Map([[s, -1]]), q = [s];
  while (q.length) {
    const i = q.shift(); if (i === t) break;
    for (const e of ADJ[i]) if (!prev.has(e.n) && (e.n === t || NODES[e.n].flow !== undefined)) { prev.set(e.n, i); q.push(e.n); }
  }
  if (!prev.has(t)) return null;
  const out = []; for (let i = t; i !== -1; i = prev.get(i)) out.unshift(i);
  return out;
}
/** The road edge leaving named node a toward named node b (curves included). */
function edgeOf(a, b) { const p = via(a, b); return p && EDGES.find((q) => (q.a === p[0] && q.b === p[1]) || (q.a === p[1] && q.b === p[0])); }

/** Where the race and other scripted things go. */
places.raceRoute = ['M1', 'S1', 'S2', 'A', 'B', 'X', 'D', 'L1', 'L2', 'W3', 'W2', 'W1', 'X'].map((k) => ({ x: NODES[N[k]].x, z: NODES[N[k]].z }));
places.raceStart = { x: 30, z: 0, yaw: Math.PI / 2 };

// ---------- districts ----------
const DISTRICTS = [
  ['Hollow Woods', (x, z) => !inTown(x, z) && inWoods(x, z)],              // countryside first: the town's rules below are open-ended
  ['Maple Grove Estates', (x, z) => !inTown(x, z) && x > -252 && x < -112 && z > -178 && z < -20],
  ['Blackthorn Ridge', (x, z) => !inTown(x, z) && x < -152 && z < 152],
  ['Dry Creek Flats', (x, z) => !inTown(x, z) && x > 152 && z < 152],
  ['Sawyer Fields', (x, z) => !inTown(x, z) && z < -132],
  ['Juniper Bottoms', (x, z) => !inTown(x, z)],
  ['Hollow Woods', (x, z) => (x < -113 && z > -40) || (z > 117 && x < 50)],
  ["Nana's Place", (x, z) => x < -84 && z > -5 && z < 62],
  ['Chapel Hill', (x, z) => x < -58 && z > -42 && z <= -5],
  ['Maple Grove Estates', (x, z) => x < -30 && z < -40],
  ['Lake Juniper', (x, z) => x > -84 && x < 48 && z > 50],
  ['Maple Grove High', (x, z) => x > 62 && z < -8],
  ['Old Mill Farm', (x, z) => x > -30 && x <= 62 && z < -50],
  ['Main Street', (x, z) => x > 62 && x < 124 && z > -8 && z < 23],
  ['Pine Hollow', (x, z) => x > 48 && z > 6],
  ['Downtown Maple Grove', () => true],
];
export function districtAt(x, z) { for (const [n, f] of DISTRICTS) if (f(x, z)) return n; return ''; }

// ---------- props ----------
function shadow(x, z, w, d, ry = 0, rect = false) {
  addS(plane(w, d), rect ? 'shadowR' : 'shadow', 0xffffff, x, 0.085 + Math.random() * 0.004, z, ry);
}
/** true when a circle of radius r at (x,z) overlaps any graph road (edge width / 2 + 0.5 m shoulder).
 *  townOnly: just the town's own roads (nodes before the countryside ones). */
const GHOSTS = [['X', 'L1']];   // town roads removed since the town was laid out: the seeded tree layout still avoids them
function onRoad(x, z, r, townOnly = false) {
  if (townOnly) for (const [a, b] of GHOSTS) if (segNear(NODES[N[a]], NODES[N[b]], x, z, 10 / 2 + 0.5 + r)) return true;
  for (const e of EDGES) {
    if (townOnly && (e.a >= N.HNJ || e.b >= N.HNJ)) continue;
    const A = NODES[e.a], B = NODES[e.b]; if (!A || !B) continue;
    const ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / L2));
    if (Math.hypot(x - A.x - ex * t, z - A.z - ez * t) < (e.w || 10) / 2 + 0.5 + r) return true;
  }
  return false;
}
/** (x,z) nudged sideways off any graph road so a circle of radius r clears the asphalt (+0.5 m). Used for hand-placed
 *  props that were laid out before the roads were widened (signs, booths, hydrants). */
function offRoad(x, z, r) {
  for (let it = 0; it < 6; it++) {
    let moved = false;
    for (const e of EDGES) {
      const A = NODES[e.a], B = NODES[e.b]; if (!A || !B) continue;
      const ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / L2)), px = A.x + ex * t, pz = A.z + ez * t;
      const d = Math.hypot(x - px, z - pz), need = (e.w || 10) / 2 + 0.5 + r;
      if (d >= need) continue;
      const L = Math.sqrt(L2), nx = d > 1e-3 ? (x - px) / d : -ez / L, nz = d > 1e-3 ? (z - pz) / d : ex / L;
      x = px + nx * need; z = pz + nz * need; moved = true;
    }
    if (!moved) break;
  }
  return [x, z];
}
// The town's props come from one seeded random sequence. A town tree that a new countryside road now runs over still rolls
// its dice (then its pieces are dropped), so every tree after it keeps the spot it always had.
function segNear(A, B, x, z, d) {
  const ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / L2));
  return Math.hypot(x - A.x - ex * t, z - A.z - ez * t) < d;
}
let R = rnd;   // tree / bush randomness: the town's seeded sequence, swapped for a separate one while the countryside builds
function dropMark() { return { c: colliders.length, b: Object.fromEntries(Object.entries(buckets).map(([k, l]) => [k, l.length])) }; }
function dropSince(m) { colliders.length = m.c; for (const [k, l] of Object.entries(buckets)) l.length = m.b[k] ?? 0; }
let WOODS_CLIP = false;   // while buildForest runs: trees past the ragged woods edge still roll their dice, then drop
function tree(x, z, s = 1, o = {}) {
  if (onRoad(x, z, 0.6 * s, true)) return;   // never grow a tree on a road (graph roads from world.js)
  if (onRoad(x, z, 0.6 * s) || (WOODS_CLIP && woodsCut(x, z))) { const m = dropMark(); tree0(x, z, s, o); dropSince(m); return; }
  tree0(x, z, s, o);
}
function tree0(x, z, s, o) {
  // o.lite: a deep-forest tree (open-ended cones, 5-sided trunk, no ground shadow decal): ~35 triangles instead of ~110
  const L = !!o.lite;
  if (!L) shadow(x + 0.6, z + 0.4, 5.2 * s, 5.2 * s);
  addS(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 2.2 * s, L ? 5 : 7, 1, true), 'bark', 0xffffff, x, 1.1 * s, z);   // open ends: hidden in the crown / ground
  const kind = o.kind ?? (R() < 0.5 ? 'round' : 'pine');
  const tint = new THREE.Color(o.tint ?? 0xffffff), hv = Math.sin(x * 3.1 + z * 7.7) * 0.5 + 0.5;   // a touch of per-tree hue drift
  tint.multiply(new THREE.Color().setRGB(0.94 + hv * 0.1, 0.97 + (1 - hv) * 0.05, 0.92 + (1 - hv) * 0.08));
  if (kind === 'round') {
    const r0 = R() * 6, r1 = R() * 6;   // the two rolls the old crown used: keep the seeded sequence in step
    for (const p of roundCrown(x, z, s, L, r0, r1)) addS(p.g, 'leaves', tint.clone().multiply(new THREE.Color(p.tint)), x, 0, z);
  } else addS(pineCrown(x, z, s, L), 'leaves', tint.clone().multiply(new THREE.Color(0xdcf4d4)), x, 0, z);
  if (!o.nocol) colliders.push({ cx: x, cz: z, r: 0.4 * s, h: 6, tree: true, top: (kind === 'round' ? 5.2 : s > 1.2 ? 5.9 : 5.1) * s, pr: (kind === 'round' ? 1.1 : 0.8) * s, ...(o.ng ? { ng: true } : {}) });   // top: the climbable perch (climb.js)
}
function deadTree(x, z, s = 1) {
  if (onRoad(x, z, 0.5 * s, true)) return;
  if (onRoad(x, z, 0.5 * s) || (WOODS_CLIP && woodsCut(x, z))) { const m = dropMark(); deadTree0(x, z, s); dropSince(m); return; }
  deadTree0(x, z, s);
}
function deadTree0(x, z, s, o = {}) {
  // bare, twisted, grey: the haunted kind
  if (!o.lite) shadow(x + 0.4, z + 0.3, 3 * s, 3 * s);
  addS(new THREE.CylinderGeometry(0.12 * s, 0.3 * s, 4.2 * s, o.lite ? 5 : 6, 1, !!o.lite), 'bark', 0x9a9690, x, 2.1 * s, z);
  for (let k = 0; k < 4; k++) {
    const a = R() * 6.28, len = (1.2 + R() * 1.4) * s, tilt = 0.6 + R() * 0.6;
    const g = new THREE.CylinderGeometry(0.04 * s, 0.09 * s, len, o.lite ? 4 : 5, 1, !!o.lite);
    g.translate(0, len / 2, 0); g.rotateZ(tilt); g.rotateY(a);
    addS(g, 'bark', 0x8a8680, x, (2.2 + k * 0.5) * s, z);
  }
  colliders.push({ cx: x, cz: z, r: 0.35 * s, h: 6, tree: true, top: 4.2 * s, pr: 0.6 * s, ...(o.ng ? { ng: true } : {}) });   // top: the climbable perch (climb.js)
}
function bush(x, z, s = 1, c = 0xb0e0a0) { addS(bushCrown(x, z, s, R() * 6), 'leaves', c, x, 0, z); }
function fence(x0, z0, x1, z1, h = 1.2, color = 0xffffff) {
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  // breakables: long lines are cut into <= 7.2 m sections, each its own breakable group (a car knocks down one section)
  const n = Math.ceil(len / 7.2 - 1e-6);
  if (n > 1) { for (let k = 0; k < n; k++) fence(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, x0 + (x1 - x0) * (k + 1) / n, z0 + (z1 - z0) * (k + 1) / n, h, color); return; }
  const g = new THREE.BoxGeometry(len, h, 0.1);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 3);
  addS(g, 'fence', color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, ry);
  colBox((x0 + x1) / 2, (z0 + z1) / 2, len + 0.2, 0.3, h, ry, { brk: 'fence', fk: 'board', fc: color, seg: [x0, z0, x1, z1] });
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
  halos.push({ x: ax, y: 5.8, z: az, s: 3.2, c: 0xffc890 }); // warm sodium corona
}
/** Street lamp beside the road through node `a` toward `b`, at distance t along it, on side s. */
function lampAlong(a, b, t, s = 1) {
  // roads 2026-11-24: walk the real road line (curves included) to the segment t metres along
  const path = typeof via === 'function' ? via(a, b) : null;
  let A = NODES[N[a]], B = NODES[N[b]];
  if (path) for (let i = 0; i < path.length - 1; i++) {
    A = NODES[path[i]]; B = NODES[path[i + 1]]; const Ls = Math.hypot(B.x - A.x, B.z - A.z);
    if (t <= Ls || i === path.length - 2) break; t -= Ls;
  }
  const L = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
  const nx = -dz * s, nz = dx * s;
  let x = A.x + dx * t + nx * 6.6, z = A.z + dz * t + nz * 6.6;
  // never in an Estates driveway or front walk: slide along the street until clear
  for (let k = 0; k < 6 && DRIVE_PTS.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3.4); k++) { t += 4; x = A.x + dx * t + nx * 6.6; z = A.z + dz * t + nz * 6.6; }
  streetLamp(x, z, Math.atan2(-nx, -nz));
}
const DRIVE_PTS = [];   // where Estates driveways + walks meet the sidewalk
function hydrant(x, z) {
  [x, z] = offRoad(x, z, 0.3);
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
  const HF = frame(cx, cz, ry), trim = o.trim ?? 0xf2efe6, wk = o.brick ? 'brick' : 'siding', rh = o.rh || 2.0;
  addS(boxUV(w, h, d, 0.5), wk, wall, hx, h / 2, hz, ry);
  addS(gable(w + 1, rh, d + 1), 'shingle', roof, hx, h + 0.06, hz, ry);
  // render pass 2026-11-27: gable ends in the wall's own material (not roof shingles), fascia + rake boards, corner boards
  addS(gableEnds(w, rh * d / (d + 1), d), wk, wall, hx, h, hz, ry);
  for (const sd of [-1, 1]) {
    HF.box(0, h - 0.02, sd * ((d + 1) / 2 + 0.02), w + 1.08, 0.2, 0.06, 'plain', trim);   // fascia under each eave
    const ang = Math.atan2(rh, (d + 1) / 2), len = Math.hypot(rh, (d + 1) / 2) + 0.06;
    for (const sx of [-1, 1]) HF.geo(new THREE.BoxGeometry(0.07, 0.2, len).rotateX(sd * ang), 'plain', trim, sx * ((w + 1) / 2 + 0.03), h + 0.06 + rh / 2 - 0.08, sd * (d + 1) / 4);   // rake boards
    if (!o.brick) for (const sx of [-1, 1]) HF.box(sx * (w / 2 + 0.02), h / 2, sd * (d / 2 + 0.02), 0.2, h, 0.2, 'plain', trim);   // corner boards
  }
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
    winTrim(HF, wx, 1.7, fz, 1.4, 1.2, 0, trim);
    if (o.shutters !== undefined) for (const s of [-1, 1]) { [x, z] = rot(cx, cz, wx + s * 0.95, fz + 0.02, ry); addS(plane(0.4, 1.3).rotateX(Math.PI / 2), 'plain', o.shutters, x, 1.7, z, ry); }
  }
  if (h > 5) { // second floor
    for (const wx of [-2.8, 0, 2.8]) {
      if (Math.abs(wx) + 0.8 > w / 2) continue;
      [x, z] = rot(cx, cz, wx, fz, ry); addS(plane(1.2, 1.2).rotateX(Math.PI / 2), 'window', 0xffffff, x, h - 1.6, z, ry);
      [x, z] = rot(cx, cz, wx, -fz, ry); addS(plane(1.2, 1.2).rotateX(Math.PI / 2).rotateY(Math.PI), 'window', 0xffffff, x, h - 1.6, z, ry);
      winTrim(HF, wx, h - 1.6, fz, 1.2, 1.2, 0, trim); winTrim(HF, wx, h - 1.6, -fz, 1.2, 1.2, 1, trim);
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
    winTrim(HF, s * (w / 2 + 0.03), 1.7, 0, 1.2, 1.1, s > 0 ? 2 : 3, trim);
  }
  [x, z] = rot(cx, cz, 0, -fz, ry);
  addS(plane(1.4, 1.1).rotateX(Math.PI / 2).rotateY(Math.PI), 'window', 0xffffff, x, 1.7, z, ry);
  winTrim(HF, 0, 1.7, -fz, 1.4, 1.1, 1, trim);
  // door: casing + a little gabled hood on brackets
  winTrim(HF, doorX, 1.0, fz, 1.0, 2.0, 0, trim);
  HF.geo(gable(1.7, 0.45, 0.9).rotateY(Math.PI / 2).rotateY(-Math.PI / 2), 'shingle', roof, doorX, 2.32, fz + 0.45);
  HF.box(doorX, 2.28, fz + 0.45, 1.7, 0.08, 0.9, 'plain', trim);
  // path from door toward the road + porch step
  const pl = Math.max(2, dl);
  [x, z] = rot(cx, cz, doorX, d / 2 + pl / 2, ry);
  addS(plane(1.0, pl), 'sidewalk', 0xd0ccc4, x, 0.065, z, ry);
  [x, z] = rot(cx, cz, doorX, d / 2 + 0.4, ry);
  addS(new THREE.BoxGeometry(1.8, 0.2, 0.8), 'plain', 0xb8b0a4, x, 0.1, z, ry);
  floors.push({ top: 0.2, cx: x, cz: z, hw: 0.9, hd: 0.4, c: Math.cos(ry), s: Math.sin(ry) }); // engine: walkable door step
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
  F.floor(-3.5, d / 2 + 1.2, 2.6, 2.2, 0.7); F.floor(-3.5, d / 2 + 2.6, 1.4, 0.8, 0.3); // engine: walk up the trailer steps
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
        F.box(-w / 2 + 1.5 + k * 2.2, 0.2, -d / 2 - 3, 1.6, 0.4, 3, 'wood', 0xffffff); F.floor(-w / 2 + 1.5 + k * 2.2, -d / 2 - 3, 1.6, 3, 0.4); // engine: stand on the beds
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
      for (let x = -w / 2 - 1; x <= w / 2 + 1; x += 1.6) if (Math.abs(x - (w / 2 - 1.9)) > 2.2 && Math.abs(x) > 1 && !onRoad(...F.at(x, d / 2 + 4.2), 0.45)) F.box(x, 0.45, d / 2 + 4.2, 1.5, 0.9, 0.9, 'leaves', 0xa0d090);
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
  const mob = st === 'mobile', garage = !mob && spec.garage !== false && !['farm', 'cottage', 'colonial'].includes(st) && w >= 9;
  lots.push({ x, z, ry, w, d, dl: spec.drive ?? 5, doorX: mob ? -3.5 : garage ? -0.8 : 0, driveX: mob ? 4.5 : w / 2 - 1.9, porch: st === 'farm' || !!spec.porch, extras: spec.extras || [], fence: spec.fence });
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
    puddle: phong({ color: 0x252b34, shininess: 140, specular: 0xcfd8ff, vertexColors: true }),   // render pass: wet tarmac, not a hole
    creek: phong({ map: T.water, vertexColors: true, shininess: 90, specular: 0x9ab4c4 }),
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
    picket: lambert({ map: T.picket, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    chain: lambert({ map: T.chain, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    iron: lambert({ map: T.iron, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
  };
  for (const id of MODEL_IDS) M['h_' + id] = lambert({ map: houseTex(id), vertexColors: true });   // Tracebench houses + the gate sign
  M.window.userData.night = T.windowLit; M.window.userData.day = T.window;
  patchCreek(M.creek); // water.js: flowing creek
  nightMats.push(M.window, M.lamp);
  places.drives = [];
  places.doors = [];

  // ground (subdivided so affine mapping stays tolerable)
  addS(plane(680, 680, 68, 68, 680 / 6, 680 / 6), 'grass', 0xffffff, 0, 0, 0);

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
  { const s0 = rndSeed.get(); buildMainStreet(); rndSeed.set(s0); }   // Main Street shops: the town's random sequence stays as it was
  buildPoles(scene);
  buildFireStation();
  buildHospital();
  buildFences();   // lot fences round every home() yard (the Estates' Tracebench houses get their own fence plan later)
  buildCountry();   // after every town builder: it uses its own random sequence so the town's layout never shifts

  // merge buckets
  // engine: terrain anchors + movable groups, then the terrain ground mesh
  const tctx = { colliders, EDGES, NODES, inLake, fields: FIELDS, forest: woodsFloor, relief: woodsRelief, paint: paintWoods, trails: [{ pts: HOLLOW_TRAIL, w: 2.6 }], waterMat: WATER_MAT, rebuildGrid: () => { GRID = null; }, gridPatch };
  buildRoofs(colliders, buckets, cbounds);   // rooftops: real roof heights under every building collider
  prepareWorld(buckets, tctx);
  if (tctx.ground) scene.add(makeGroundMesh(initGround(scene, M[tctx.ground.key], T, tctx)));
  // one merged mesh per material per map chunk (the town + eight countryside sectors), each culled on its own
  worldChunks.length = 0;
  for (const [k, list] of Object.entries(buckets)) {
    const by = new Map();
    for (const g of list) { const c = g.userData.ck ?? 0; (by.get(c) || by.set(c, []).get(c)).push(g); }
    for (const [c, l] of by) {
      const mesh = new THREE.Mesh(mergeGeometries(l, false), M[k]);
      patchMaterial(M[k]); mesh.userData.noLift = true; mesh.userData.chunk = c; // engine
      cullBounds(mesh, c === 0 ? 30 : 14);   // generous pad: editor moves and the terrain lift happen in the shader
      mesh.matrixAutoUpdate = false;
      scene.add(mesh); worldChunks.push(mesh);
    }
    list.length = 0;   // the merged copies are all that's needed: drop the per-piece source geometry
  }
  gridBuild();
  return M;
}

// ---------- roads ----------
function buildRoads() {
  // road surfaces, markings, junctions and puddles are built (and rebuilt when edited) by roads.js
  // street lamps: downtown and the Estates are lit, the country roads are dark
  for (const t of [14, 34]) { lampAlong('X', 'W1', t, 1); lampAlong('X', 'W1', t + 10, -1); lampAlong('X', 'M1', t, -1); lampAlong('X', 'M1', t + 10, 1); }
  lampAlong('X', 'B', 16, 1); lampAlong('X', 'D', 16, -1); lampAlong('B', 'A', 20, -1);
  for (const [a, b] of [['G1', 'G2'], ['G3', 'G4'], ['G1', 'G3'], ['G2', 'G4'], ['B', 'G1']]) lampAlong(a, b, 12, 1);
  lampAlong('G2', 'G5', 10, -1);
  for (const [a, b, s] of [['M1', 'S1', -1], ['S1', 'S2', -1], ['P1', 'PC', 1], ['PC', 'P2', -1], ['E', 'P4', 1], ['D', 'E', -1], ['M1', 'M2', 1]]) lampAlong(a, b, 18, s);
}

// ---------- edges: exits at the map edge, walls, the old town tree line ----------
/** A road closure across the road ending at node `at` (coming from `from`): sawhorses, barrels, a sign, a flasher. */
function closure(at, from, text, bg, fg, o = {}) {
  const E = NODES[N[at]], Fm = NODES[N[from]], ry = Math.atan2(Fm.x - E.x, Fm.z - E.z), F = frame(E.x, E.z, ry);
  const w = o.w || 12;
  for (let s = -w / 2 + 1.6; s <= w / 2 - 1.5; s += 2.7) sawhorse(...F.at(s, 2), ry);
  for (const s of [-w / 2 - 0.4, w / 2 + 0.4]) barrel(...F.at(s, 1.4));
  F.col(0, 2, w + 1, 1.5, 3);
  F.box(-2.4, 1.6, 2.6, 0.1, 3.2, 0.1, 'metal', 0x888888); F.box(2.4, 1.6, 2.6, 0.1, 3.2, 0.1, 'metal', 0x888888);
  F.sign(text, bg, fg, 4.6, 0.9, 2.9, 2.62, { tw: 512, th: 64, double: true });
  F.light(0, 2, 3.5, 0xff9a40, 0.6, { always: true, flicker: true }); F.halo(-w / 2 - 0.4, 1.2, 1.4, 1.2, 0xff8a30); F.halo(w / 2 + 0.4, 1.2, 1.4, 1.2, 0xff8a30);
  return { x: E.x, z: E.z };
}
function buildEdges(scene) {
  // The town used to end at a chain-link fence (north), closed Hwy 9 ramps (north + east) and the Old Mill bridge (south).
  // Since the countryside expansion those roads run on to the map edge, where they are closed instead.
  places.exitNorth = closure('HNE', 'HNJ', 'HWY 9 CLOSED AHEAD', '#1f6a3a', '#ffffff', { w: 13 });
  places.exitEast = closure('HEE', 'HEJ', 'CLOSED AT COUNTY LINE', '#1f6a3a', '#ffffff', { w: 13 });
  {
    const S = NODES[N.OMS], Q = NODES[N.OMJ], ryS = Math.atan2(S.x - Q.x, S.z - Q.z), Fs = frame(S.x, S.z, ryS);
    for (const s of [-1, 0, 1]) sawhorse(...Fs.at(s * 3, -2), ryS);
    Fs.col(0, -2, 11, 1.5, 3);
    Fs.sign('BRIDGE OUT', '#f06a20', '#111111', 5, 1.2, 1.9, -2.2, { rr: Math.PI });
    for (const s of [-5, 5]) barrel(...Fs.at(s, -3));
    Fs.light(0, 2, -3.5, 0xff9a40, 0.6, { always: true, flicker: true });
    places.exitSouth = { x: S.x, z: S.z };
  }
  // invisible walls at the edge of the play area
  for (const [x0, z0, x1, z1] of [[-LIMIT, -LIMIT, -LIMIT, LIMIT], [LIMIT, -LIMIT, LIMIT, LIMIT], [-LIMIT, LIMIT, LIMIT, LIMIT], [-LIMIT, -LIMIT, LIMIT, -LIMIT]]) {
    colliders.push({ x0: Math.min(x0, x1) - 1, x1: Math.max(x0, x1) + 1, z0: Math.min(z0, z1) - 1, z1: Math.max(z0, z1) + 1, h: 9, nf: true });   // nf: don't level the land along the edge (the ravine runs out under it)
  }
  // The town's old east + south tree line (x and z ~147) stays as a hedgerow; roads pass through it.
  const OLD = 145, OLD_N = -126;
  // east and south tree line (west/south are the haunted woods)
  for (let t = OLD_N + 6; t <= OLD; t += 6) if (Math.abs(t) > 12) tree(OLD + 2 + rnd() * 4, t, 1.2 + rnd() * 0.5, { kind: 'pine' });
  for (let t = -OLD; t <= OLD; t += 6) tree(t, OLD + 2 + rnd() * 4, 1.2 + rnd() * 0.5, { kind: 'pine', tint: 0x9ab09a });
  // town welcome sign on Old Mill coming in from the highway
  const Fw = frame(...offRoad(-36, -86, 2.6), -0.4);
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
    for (const wx of [-5, -2, 4, 6.5]) shopWin(F, wx, 1.6, -6.47, 2.4, 1.8);
    shopWin(F, 1, 1.1, -6.5, 1.6, 2.2, 'door', 0x99c4e0, { noMullion: true });
    roofUnit(F, -4, 4.4, -12.5); roofUnit(F, 3.5, 4.4, -13, 0.85);
    for (const sx of [-1, 1]) F.box(sx * 7.85, 2.1, -6.45, 0.14, 4.2, 0.14, 'metal', 0x9a9ea4);   // downspouts
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
    for (const x of [-3, 3]) {
      shopWin(F, x, 1.6, 3.53, 2, 1.5, 'storeWin', 0xffc0d8, { frame: 0xf4f0f2, kick: 0xb05070 });
      for (let k = 0; k < 5; k++) F.geo(new THREE.BoxGeometry(0.5, 0.06, 1.0).rotateX(0.35), 'plain', k % 2 ? 0xfff4f8 : 0xe06090, x - 1 + k * 0.5, 2.72, 4.0);   // striped awning
    }
    roofUnit(F, 2.5, 3.65, -1.5, 0.8);
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
  // ---- Pizza City (2026-11-15, diet): west of the Quik Stop, facing Old Mill Rd (the diagonal), lot out front ----
  {
    // Old Mill Rd runs X(0,0) -> B(-28,-62); its normal toward this side is (0.911, -0.411). 18.6 m off the centreline
    const ry = Math.atan2(-0.911, 0.411), cx = -10.8 + 0.911 * 18.6, cz = -24 - 0.411 * 18.6, F = frame(cx, cz, ry);
    F.flat(0, 7.5, 12, 7, 'asphalt', 0xdcdcdc, 0.04, '#6a6a70');
    for (const lx of [-4.5, -1.5, 1.5, 4.5]) F.box(lx, 0.06, 7.2, 0.15, 0.02, 4, 'plain', 0xf0f0f0);
    F.box(0, 1.8, 0, 10, 3.6, 8, 'brick', 0xd8c0a8); F.bld(0, 0, 10, 8, 4.2);
    F.box(0, 3.75, 0, 10.5, 0.35, 8.5, 'plain', 0x2a7a3a);                            // green cornice
    for (let k = 0; k < 7; k++) F.box(-4.5 + k * 1.5, 2.85, 4.55, 1.5, 0.08, 1.2, 'plain', k % 2 ? 0xf4f4f0 : 0xd02a2a); // striped awning
    for (const wx of [-3.3, -1.1, 3]) shopWin(F, wx, 1.5, 4.03, 1.9, 1.7, 'storeWin', 0xfff0d0, { frame: 0x1e4a26, kick: 0x6a4a38 });
    roofUnit(F, -2.5, 3.9, -2);
    F.face(1, 1.1, 4.03, 1.2, 2.2, 'door', 0x2a7a3a);
    F.sign('PIZZA CITY', '#d02a2a', '#fff4d0', 7.6, 1.3, 4.6, 4.1, { tw: 512, th: 64, glow: true });
    F.sign('HOT & FAST', '#2a7a3a', '#ffffff', 2.2, 0.5, 2.5, 4.06, { lx: -2.2 });
    F.sign('OPEN', null, '#ff5040', 1, 0.35, 1.9, 4.07, { glow: true, lx: 3 });
    // giant slice on the roof, tip down on a pole
    {
      const sl = new THREE.CylinderGeometry(2.6, 2.6, 0.3, 14, 1, false, -Math.PI / 7, Math.PI * 2 / 7).rotateX(-Math.PI / 2);
      F.geo(sl, 'plain', 0xffc838, 0, 5.6, 2.2);
      F.geo(new THREE.CylinderGeometry(2.7, 2.7, 0.42, 14, 1, true, -Math.PI / 7, Math.PI * 2 / 7).rotateX(-Math.PI / 2), 'plain', 0xc88a40, 0, 5.6, 2.2);
      for (const [px, py] of [[0, 0.8], [-0.4, 1.6], [0.4, 1.5], [0, 2.2]]) F.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 8).rotateX(Math.PI / 2), 'plain', 0xb02a20, px, 5.6 + py, 2.22);
      F.box(0, 4.9, 2, 0.15, 1.4, 0.15, 'metal', 0x888888);
      F.halo(0, 7, 2.4, 4, 0xffb040);
    }
    F.light(0, 2.6, 5.7, 0xffd0a0, 1.1, { always: true });
    // a picnic table out front, a dumpster round the back
    F.box(-7, 0.75, 1.5, 1.8, 0.1, 0.9, 'wood', 0xa0784a); for (const sx of [-0.7, 0.7]) F.box(-7 + sx, 0.37, 1.5, 0.1, 0.74, 0.8, 'wood', 0x8a6040);
    for (const sz of [-0.85, 0.85]) F.box(-7, 0.45, 1.5 + sz, 1.8, 0.08, 0.3, 'wood', 0xa0784a);
    F.col(-7, 1.5, 1.8, 2.4, 0.8);
    F.box(3, 0.7, -5.2, 1.6, 1.4, 1, 'plain', 0x2a7a3a); F.col(3, -5.2, 1.6, 1, 1.4);
    places.pizza = (([x, z]) => ({ x, z, yaw: ry }))(F.at(1, 6));
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
  F.box(0, 0.2, d / 2 + 3.8, 3.6, 0.4, 1.6, 'plain', 0xb8b0a4); F.floor(0, d / 2 + 3.8, 3.6, 1.6, 0.4); // engine: walk up the chapel slab
  F.floor(0, 0, w + 0.2, d + 0.2, 0.4); F.floor(0, d / 2 + 1.4, 3.6, 3.2, 0.4); // engine: foundation lip
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
  const rv = makeRV(); rv.position.set(lx - 1, 0, lz + 1); rv.rotation.y = -Math.PI / 2 + 0.1; scene.add(rv);   // hitch toward the dirt road (east), door side facing north across the lot
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
  places.goobTruck = { x: lx + 3.2, z: lz + 5, yaw: Math.PI / 2 };   // Goobles' truck: parked south of the trailer, nose toward the dirt road

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
// Hollow Woods Trail (2026-11-22, diet's markup): a walking loop from the lake through the cabin clearing, round the
// woods' west and south sides and back up past the park. Painted into the ground (ground.js trails), never a road.
const catmull = (P, n = 4) => { const out = [];
  for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); } }
  out.push(P[P.length - 1]); return out; };
const HOLLOW_TRAIL = catmull([[15, 60], [-17, 61], [-56, 66], [-90, 80], [-121, 84], [-135, 80], [-153, 72], [-160, 49], [-167, 24], [-185, 16],
  [-203, 26], [-206, 64], [-218, 110], [-226, 153], [-212, 200], [-196, 235], [-171, 268], [-140, 276], [-117, 270], [-103, 242], [-81, 205],
  [-53, 214], [-31, 190], [4, 184], [24, 164], [27, 114], [26, 80], [15, 60]], 5);
// the ravine in the south-west corner: a canyon cut steadily downhill from the north-west edge to the south edge, with
// stepped rock walls (2026-11-22 rework, diet: "too unrealistic ... less all over the place in terms of low and high spots")
const RAVINE = catmull([[-312, 196], [-268, 214], [-247, 242], [-241, 258], [-206, 282], [-186, 312]], 5);
// Juniper Creek: out of Lake Juniper's south-west shore, down through the woods, across the trail at a ford, then over
// the ravine's lip as falls and on down the ravine floor
const RIVER = catmull([[-50, 104], [-62, 116], [-78, 130], [-98, 142], [-118, 154], [-134, 171], [-150, 192], [-165, 213], [-178, 232],
  [-191, 246], [-207, 257], [-226, 268]], 4);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A polyline with cumulative lengths and a padded bounding box, for quick (distance, distance-along) lookups. */
function pathInfo(P, pad) {
  const L = [0]; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < P.length; i++) { const [x, z] = P[i]; if (i) L.push(L[i - 1] + Math.hypot(x - P[i - 1][0], z - P[i - 1][1])); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { P, L, len: L[L.length - 1], x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad };
}
/** { d, s } = distance to the path and how far along it the nearest point is; null outside the padded box. */
function pathProj(x, z, I) {
  if (x < I.x0 || x > I.x1 || z < I.z0 || z > I.z1) return null;
  const P = I.P; let bd = 1e18, bs = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const ex = x - ax - dx * t, ez = z - az - dz * t, d2 = ex * ex + ez * ez;
    if (d2 < bd) { bd = d2; bs = I.L[i] + t * (I.L[i + 1] - I.L[i]); }
  }
  return { d: Math.sqrt(bd), s: bs };
}
const RAV_I = pathInfo(RAVINE, 80), RIV_I = pathInfo(RIVER, 45);
const RAV_F0 = -3, RAV_F1 = -16;                            // ravine floor height at the top and bottom ends: one steady fall
const ravFloor = (s) => RAV_F0 + (RAV_F1 - RAV_F0) * s / RAV_I.len;
const RIV_END = ravFloor(pathProj(-226, 268, RAV_I).s);     // the creek meets the ravine floor
// the ford: where the creek crosses the Hollow Woods Trail
const FORD = (() => { let b = null; for (let s = 0; s < RIV_I.len; s += 0.5) {
  let i = 0; while (i < RIV_I.L.length - 2 && RIV_I.L[i + 1] < s) i++;
  const t = (s - RIV_I.L[i]) / (RIV_I.L[i + 1] - RIV_I.L[i]), x = RIVER[i][0] + (RIVER[i + 1][0] - RIVER[i][0]) * t, z = RIVER[i][1] + (RIVER[i + 1][1] - RIVER[i][1]) * t;
  const d = distToPath(x, z, HOLLOW_TRAIL); if (!b || d < b.d) b = { x, z, s, d }; } return b; })();
/** Creek bed height along the creek: barely below the lake at the outlet, a gentle fall to the ford, then steeper and
 *  steeper (rapids, then falls over the ravine's lip) down to the ravine floor. */
function rivFloor(s) {
  const s1 = FORD.s + 6;
  if (s < s1) return -(0.5 + 1.1 * s / s1) * sstep(0, 14, s);
  return -1.6 + (RIV_END + 1.6) * Math.pow((s - s1) / (RIV_I.len - s1), 1.7);
}
/** Creek banks: a 5 m bed, a short steep bank, then valley sides (gentle near the ford so the trail can walk down). */
function rivBank(d, x, z) {
  const t = d - 2.5; if (t <= 0) return 0;
  const k = 0.6 - 0.4 * (1 - sstep(10, 34, Math.hypot(x - FORD.x, z - FORD.z)));
  return t < 1.2 ? t * 0.9 : 1.08 + (t - 1.2) * k;
}
/** Ravine walls: rock benches ~5 m high with ~2 m ledges, the step line wandering a little along the canyon. */
function ravWall(d, s, x, z, fb) {
  const t = d - 4; if (t <= 0) return 0;
  const v = Math.max(0, t * 1.05 + 1.4 * fb(s / 22 + 3.3, d > 0 ? 1.7 : 0, 2)), S = 5, q = v / S, f = Math.floor(q);
  return S * (f + sstep(0.45, 1, q - f)) + 0.5 * fb(x / 5 + 9.2, z / 5 - 4.4, 2) * sstep(0, 3, t);
}
/** Hollow Woods terrain (terrain.js calls it with the rolling hills h, before the flat mask): ridged hills growing in
 *  from the woods' edge, broken into rock benches in places, eased where the trail runs; a level plateau round the
 *  ravine; then the ravine and the creek cut in. fb = terrain.js value noise. */
function woodsRelief(x, z, fb, h0) {
  const d = woodsD(x, z), rv = pathProj(x, z, RAV_I), rr = pathProj(x, z, RIV_I);
  if (d < -2 && !rv && !rr) return h0;
  let h = h0;
  if (d > -2) {
    const r = 1 - Math.abs(fb(x / 75 + 5.3, z / 75 - 2.1, 3));
    let m = 13 * r * r + 5 * (fb(x / 36 - 9.1, z / 36 + 4.4, 2) * 0.5 + 0.5);
    const tm = sstep(0.0, 0.3, fb(x / 110 - 3.7, z / 110 + 8.2, 2));   // where the hills break into rock benches
    if (tm > 0) { const q = m / 3.4, f = Math.floor(q); m += tm * (3.4 * (f + sstep(0.45, 1, q - f)) - m); }
    h += sstep(0, 40, d) * m;
  }
  if (rv && rv.d < 80) {   // the plateau the ravine cuts into: level ground, not hills, so the canyon reads as one clean cut
    const b = 1 - sstep(40, 80, rv.d);
    h += b * (6 + 1.2 * fb(x / 70 - 1.3, z / 70 + 6.1, 2) + edgeRise(x, z) - h);
  }
  if (d > -2) h = h0 + (h - h0) * (0.4 + 0.6 * sstep(2, 18, distToPath(x, z, HOLLOW_TRAIL)));   // the trail keeps to easy ground
  if (rv && rv.d < 70) h = Math.min(h, ravFloor(rv.s) + ravWall(rv.d, rv.s, x, z, fb));
  if (rr && rr.d < 45) h = Math.min(h, rivFloor(rr.s) + rivBank(rr.d, x, z));
  return h;
}
/** Approximate final height (no flat mask, no sculpting) and slope, for placing rocks and keeping trees off cliffs. */
const approxH = (x, z) => woodsRelief(x, z, noise2, hillsAt(x, z));
function approxSlope(x, z) { const e = 1.2; return Math.hypot(approxH(x + e, z) - approxH(x - e, z), approxH(x, z + e) - approxH(x, z - e)) / (2 * e); }
function buildForest() {
  // ground: leaf litter under the trees
  // (2026-11-15) the leaf litter is the painted forest floor now (ground.js), feathered along the ragged edge; the old
  // straight-edged litter planes and map polygon are gone. The woods' map shape is drawn by buildCountry (woodsMap).
  // the old trail from the RV to the well is gone (2026-11-22, diet); TRAIL still places the cabin + well. New trail:
  MAP.push({ t: 'line', col: '#8a7050', w: 2.4, pts: HOLLOW_TRAIL });
  // the clearing: ruined cabin
  const cl = { x: -134, z: 82 };
  places.clearing = cl;
  const F = frame(cl.x - 4, cl.z, Math.PI / 2);
  F.box(0, 1.3, 0, 6, 2.6, 5, 'wood', 0x8a7a6a); F.bld(0, 0, 6, 5, 3);
  F.geo(gable(6.8, 3.2, 5.6).rotateZ(0.08), 'shingle', 0x4a4440, 0, 2.6, 0);
  F.face(0.8, 1.0, 2.52, 1, 2, 'door', 0x3a3028); F.face(-1.6, 1.6, 2.52, 1, 0.9, 'window', 0x707070);
  F.box(-3.3, 0.4, 1.5, 0.8, 0.8, 0.8, 'wood', 0x6a5a4a); F.col(-3.3, 1.5, 0.8, 0.8, 0.8); // engine: solid crate
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
  WOODS_CLIP = true;
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
  WOODS_CLIP = false;
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
  WATER_MAT = makeWaterMaterial(); // water.js: sky reflection, glints, shore foam
  animated.push({ obj: null, fn: (t) => { T.water.offset.set(Math.sin(t * 0.3) * 0.05, t * 0.02); } });
  MAP.push({ t: 'poly', col: '#4a8ac8', pts: lakePts(1) });
  // dock on the north shore
  const dx = -20, dz0 = 64, dz1 = 82;
  buildDock({ addS, boxUV, lights, halos, scene, animated }, dx, dz0, dz1); // dock.js: planks, pilings, rails, ladder, lantern, rowboat
  places.dock = { x: dx, z: dz1 - 1 };
  floors.push({ top: 0.35, x0: dx - 1.2, x1: dx + 1.2, z0: dz0, z1: dz1 + 0.1 }); // engine: walk on the dock
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
    F.box(rx + 1, 0.1, rz + 1.5, 1.2, 0.2, 0.8, 'plain', 0x8a6a40); F.floor(rx + 1, rz + 1.5, 1.2, 0.8, 0.2);
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

// ---------- Tracebench houses (houses.js): placing, lots ----------
/** The stone monument entrance sign. */
function placeSign(cx, cz, ry, o = {}) {
  const F = frame(cx, cz, ry);
  addS(houseGeo('sign'), 'h_sign', 0xffffff, cx, 0, cz, ry);
  for (const [x0, z0, x1, z1, h] of SIGN.cols) F.col((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, Math.max(0.5, h), 0, h > 1.5 ? { bld: true, ...o } : { ng: true });
  for (const x of [-3.85, 3.85]) F.light(x, 3.25, 0, 0xffe0b0, 0.6);
  F.light(0, 0.6, 2.2, 0xfff0d0, 0.5);
}
/** One Tracebench house at (cx,cz) facing ry. o.front: local z of the road edge (the driveway runs to it). */
function placeHouse(id, cx, cz, ry, mirror = false, o = {}) {
  const H = HOUSES[id], F = frame(cx, cz, ry), mx = mirror ? -1 : 1;
  addS(houseGeo(id, mirror), 'h_' + id, 0xffffff, cx, 0, cz, ry);
  for (const [x0, z0, x1, z1, h] of H.cols) {
    const w = x1 - x0, d = z1 - z0, big = w * d >= 4 && h >= 2.4;
    F.col(mx * (x0 + x1) / 2, (z0 + z1) / 2, w, d, Math.max(0.6, h), 0, big ? { bld: true } : { ng: true });
  }
  // a level pad under the patio / pool deck (hidden under the deck; it tells the terrain to flatten the back yard)
  if (H.yard) { const [x0, z0, x1, z1] = H.yard; F.geo(plane(x1 - x0 - 0.4, z1 - z0 - 0.4), 'sidewalk', 0xd8d0c0, mx * (x0 + x1) / 2, 0.05, (z0 + z1) / 2); }
  shadow(...F.at(mx * (H.bb[0][0] + H.bb[1][0]) / 2, -1), H.bb[1][0] - H.bb[0][0] + 1, 11, ry, true);
  const front = o.front ?? H.bb[1][2] + 2;
  // driveway: from the garage (or a side parking pad) out to the road, and the mailbox beside it
  const [dx, dz] = H.drive, len = front - dz;
  if (len > 0.4) F.geo(plane(3.4, len, 1, Math.max(1, Math.round(len / 4)), 0.68, len / 5), 'sidewalk', 0xe4e0d8, mx * dx, 0.07, dz + len / 2);
  const mb = o.mail ?? MAIL[(homes.length * 7 + 3) % MAIL.length];
  mailbox(...F.at(mx * (dx + 2.3), front - 0.5), ry, mb);
  DRIVE_PTS.push(F.at(mx * dx, front), F.at(mx * H.door[0], front));
  const door = F.at(mx * H.door[0], H.door[1]), drive = F.at(mx * dx, Math.min(front - 1, dz + 3));
  homes.push({ x: cx, z: cz, ry, spec: { model: id, mirror } });
  (places.yards || (places.yards = [])).push({ id, x: cx, z: cz, ry, mx, front }); // yardcats: front lawns
  places.doors.push(door); places.drives.push({ x: drive[0], z: drive[1], ry });
  return { door, drive, F };
}
/** Lot rectangle in the house's local frame: the model, its driveway pad and a margin. Front edge = the model's front. */
function lotRect(id, mirror) {
  const H = HOUSES[id], [[bx0, , bz0], [bx1, , bz1]] = H.bb, dx = H.drive[0];
  let x0 = Math.min(bx0, dx - 1.9) - 1.3, x1 = Math.max(bx1, dx + 1.9) + 1.3;
  if (mirror) [x0, x1] = [-x1, -x0];
  return { x0, x1, z0: bz0 - 1.3, z1: bz1 };
}
const LOTS = [];   // {cx, cz, ry, r: local rect} placed Estates lots (rotated rectangles)
function rectCorners(L) { return [[L.r.x0, L.r.z0], [L.r.x1, L.r.z0], [L.r.x1, L.r.z1], [L.r.x0, L.r.z1]].map(([x, z]) => rot(L.cx, L.cz, x, z, L.ry)); }
function rectsOverlap(A, B) {   // separating axis test, two rotated rectangles
  const ca = rectCorners(A), cb = rectCorners(B);
  for (const C of [ca, cb]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = C[i], [x1, z1] = C[(i + 1) % 4], nx = -(z1 - z0), nz = x1 - x0;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, z] of ca) { const p = x * nx + z * nz; a0 = Math.min(a0, p); a1 = Math.max(a1, p); }
    for (const [x, z] of cb) { const p = x * nx + z * nz; b0 = Math.min(b0, p); b1 = Math.max(b1, p); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}
// places the Estates must keep clear: HOA office + patrol lot, guard booth, gate sign, the chapel's hill, the woods
const SHOULDER_W = { paved: 0.7, hwy: 1.6, dirt: 0.9 };
const ESTATE_KEEP = [{ x0: -58, x1: -29, z0: -58, z1: -36 }, { x0: -41, x1: -30, z0: -74, z1: -63 }];
function estateLots() {
  const ORDER = ['whitmore', 'avery', 'sevilla', 'hartwell', 'kingsley', 'linden', 'ashford', 'harlow'];
  const segNearR = (A, B, x, z) => { const ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / L2)); return Math.hypot(x - A.x - ex * t, z - A.z - ez * t); };
  const fieldHit = (x, z) => FIELDS.some((f) => { const c = Math.cos(f.ry), s = Math.sin(f.ry), dx = x - f.x, dz = z - f.z; return Math.abs(dx * c - dz * s) < f.w / 2 + 3 && Math.abs(dx * s + dz * c) < f.d / 2 + 3; })
    || WOODLOTS.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 3);
  const ECOLS = colliders.filter((c) => !c.tree && !(c.r !== undefined && c.r < 0.5 && c.brk !== 'lamp') && (c.r !== undefined || c.x0 !== undefined)
    && (c.r !== undefined ? c.cx : c.x0) < -30 && (c.r !== undefined ? c.cz : c.z0) < -30);
  const fits = (L) => {
    const { r } = L, pts = [];
    for (let x = r.x0; x <= r.x1 + 0.01; x += Math.max(1, (r.x1 - r.x0) / Math.ceil((r.x1 - r.x0) / 2))) for (let z = r.z0; z <= r.z1 + 0.01; z += Math.max(1, (r.z1 - r.z0) / Math.ceil((r.z1 - r.z0) / 2))) pts.push(rot(L.cx, L.cz, x, z, L.ry));
    const near = EDGES.filter((e) => segNearR(NODES[e.a], NODES[e.b], L.cx, L.cz) < 60);
    for (const [x, z] of pts) {
      if (x < -246 || x > -44 || z < -176 || z > -41) return false;
      if (inWoods(x, z) || fieldHit(x, z)) return false;
      if (ESTATE_KEEP.some((k) => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1)) return false;
      for (const e of near) if (segNearR(NODES[e.a], NODES[e.b], x, z) < e.w / 2 + (SHOULDER_W[e.t] ?? 0.7) + 1.3) return false;
      for (const n of NODES) if (n.bulb && Math.hypot(x - n.x, z - n.z) < n.bulb + 2.3) return false;
      for (const c of ECOLS) {
        if (c.r !== undefined ? Math.hypot(x - c.cx, z - c.cz) < c.r + 0.3 : c.x0 !== undefined ? x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3 : false) return false;
      }
    }
    return !LOTS.some((o) => rectsOverlap(o, L));
  };
  // Gary's lot first (placed by buildEstates)
  const g = homes[homes.length - 1]; LOTS.push({ cx: g.x, cz: g.z, ry: g.ry, r: lotRect('beaumont', false) });
  const STREETS = [['G1', 'G2'], ['G2', 'G5'], ['B', 'G1'], ['G3', 'G4'], ['G1', 'G3'], ['G2', 'G4'], ['G4', 'GW1'], ['GW1', 'EW'], ['EW', 'CW3'],
    ['MC', 'AC'], ['EW', 'AC'], ['MC', 'ME'], ['ME', 'G4'], ['EW', 'WW1'], ['WW1', 'WW2'], ['G3', 'A']];
  // two passes: the deep pool lots claim their spots first (a 30 m pool lot can't back onto another lot in a 50 m block),
  // then the smaller plans fill the frontage that's left, stopping once they'd outnumber the pools by more than a couple
  let k = 0, placed = 0, pools = 1; const ids = [], used = {};
  for (const poolPass of [true, false]) for (const [a, b] of STREETS) {
    const e = edgeOf(a, b);   // roads 2026-11-24: corners are curves now, so walk through the arc nodes
    if (!e) continue;
    const A = NODES[N[a]], B = NODES[N[b]], Ln = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / Ln, dz = (B.z - A.z) / Ln, h = e.w / 2;
    for (const side of [1, -1]) {
      const nx = -dz * side, nz = dx * side, ry = Math.atan2(-nx, -nz), lxx = Math.cos(ry), lxz = -Math.sin(ry), sg = Math.sign(lxx * dx + lxz * dz) || 1;
      for (let s = 0; s < Ln - 6;) {
        let done = false;
        if (!poolPass && placed + 1 - pools >= pools + 2) break;
        // least-used plans go first so no one plan repeats
        const cand = ORDER.map((_, i) => ORDER[(k + i) % ORDER.length]).filter((id) => !!HOUSES[id].pool === poolPass && (used[id] || 0) < 4)
          .sort((p, q) => (used[p] || 0) - (used[q] || 0));
        for (let tries = 0; tries < cand.length && !done; tries++) {
          const id = cand[tries], mirror = (placed + tries) % 2 === 1, H = HOUSES[id], r = lotRect(id, mirror);
          const off = h + 2.2 + H.bb[1][2];
          const along = sg > 0 ? s - r.x0 : s + r.x1;
          if (along > Ln) continue;
          const L = { cx: A.x + dx * along + nx * off, cz: A.z + dz * along + nz * off, ry, r };
          if (!fits(L)) continue;
          placeHouse(id, L.cx, L.cz, ry, mirror, { front: off - h });
          LOTS.push(L); KEEP_OUT.push((() => { const c = rectCorners(L); return { x0: Math.min(...c.map((p) => p[0])), x1: Math.max(...c.map((p) => p[0])), z0: Math.min(...c.map((p) => p[1])), z1: Math.max(...c.map((p) => p[1])) }; })());
          k = (ORDER.indexOf(id) + 1) % ORDER.length; placed++; used[id] = (used[id] || 0) + 1; if (H.pool) pools++; ids.push(id);
          s += r.x1 - r.x0 + 1; done = true;
        }
        if (!done) s += 1.5;
      }
    }
  }
  // the town's trees that ended up in a yard go
  const gone = [];
  for (let i = colliders.length - 1; i >= 0; i--) { const c = colliders[i]; if (c.tree && LOTS.some((L) => { const [lx, lz] = rot(0, 0, c.cx - L.cx, c.cz - L.cz, -L.ry); return lx > L.r.x0 - 1 && lx < L.r.x1 + 1 && lz > L.r.z0 - 1 && lz < L.r.z1 + 1; })) { gone.push([c.cx, c.cz]); colliders.splice(i, 1); } }
  if (gone.length) for (const key of ['bark', 'leaves', 'shadow']) if (buckets[key]) buckets[key] = buckets[key].filter((g) => !gone.some(([x, z]) => g.userData.o && Math.hypot(g.userData.o[0] - x, g.userData.o[1] - z) < 1.2));
  places.estateHomes = placed + 1; places.estateIds = ['beaumont', ...ids];
}

// ---------- Maple Grove Estates (Gary's HOA subdivision) ----------
function buildEstates() {
  // entrance: the stone monument sign (Tracebench, 2026-11-24), guard booth, HOA office + patrol lot
  placeSign(-40, -54.5, 0);
  {
    // guard booth with a striped arm (always up; Gary wants it down)
    const F = frame(...offRoad(-36, -69, 1.8), 0);
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
  // Gary, the HOA president: the Beaumont (white French brick, slate roof, porte-cochere, pool) at the head of his cul-de-sac
  {
    const G = NODES[N.G5], H = HOUSES.beaumont, ry = Math.PI / 2;
    const cx = G.x - G.bulb - 2.4 - H.bb[1][2], cz = G.z;
    const g = placeHouse('beaumont', cx, cz, ry, false, { front: G.x - G.bulb - cx + 3 });
    const F = g.F;
    places.gary = { x: g.door[0], z: g.door[1], yaw: ry };
    places.garyCart = (([x, z]) => ({ x, z, yaw: ry }))(F.at(H.drive[0], H.drive[1] + 3.5));
    places.garyBack = (([x, z]) => ({ x, z }))(F.at(-6, -6.5));
    // the flagpole and the perfect lawn stripes stay
    F.box(-6.5, 3.5, 7.2, 0.08, 7, 0.08, 'plain', 0xdddddd); F.box(-5.7, 6.4, 7.2, 1.6, 1, 0.04, 'plain', 0x2050a0); F.post(-6.5, 7.2, 0.12, 7);
    for (let k = 0; k < 4; k++) F.geo(plane(1.6, 4.4), 'grass', k % 2 ? 0xd0f0b8 : 0xb8e0a0, 2.6 + k * 1.7, 0.045, 7.4);
    F.light(0.3, 3, 6.2, 0xfff0d0, 0.9);
  }
  // every other household: Tracebench houses on lots along the Estates' streets
  estateLots();
  rndSeed.set(869764972);   // where the old hand-placed Estates left the town's random sequence: later builders don't shift
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
    // rows stop short of the road (2026-11-24: School Rd now curves round the field's north-east corner)
    for (let x = 30; x <= 54; x += 2.2) {
      let z0 = null;
      for (let z = -97.5; z <= -62; z += 0.5) {
        const ok = z <= -62.5 && !onRoad(x, z, 1.6);
        if (ok && z0 === null) z0 = z;
        if ((!ok || z >= -62.5) && z0 !== null) {
          const z1 = ok ? z : z - 0.5, L = z1 - z0, zc = (z0 + z1) / 2;
          if (L > 2) {
            addS(plane(2.2, L, 1, Math.max(1, Math.round(L / 9)), 2.2 / 5, L / 5), 'dirt', 0xb0a080, x, 0.025, zc);
            addS(new THREE.BoxGeometry(0.7, 1.9, L), 'leaves', 0xd8e080, x, 0.95, zc);
            addS(new THREE.BoxGeometry(0.4, 0.3, L), 'leaves', 0xf0e090, x, 2.0, zc);
          }
          z0 = null;
        }
      }
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
    F.box(0, 0.2, 0, 9, 0.4, 9, 'plain', 0x9a9a94); F.floor(0, 0, 9, 9, 0.4); // engine: stand on the tower pad
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
    F.trim = 0xe6dfcf;   // cast-stone window surrounds
    F.flat(0, 13, 42, 12, 'grass', 0xd8f0c8, 0.03);
    F.box(0, 3.5, 0, 40, 7, 13, 'brick', 0xffffff); F.bld(0, 0, 40, 13, 8);
    F.box(0, 7.15, 0, 40.6, 0.3, 13.6, 'plain', 0x8a8478);
    F.box(-14, 2, -12, 10, 4, 12, 'brick', 0xf0e0d8); F.bld(-14, -12, 10, 12, 4.5); F.box(-14, 4.1, -12, 10.4, 0.25, 12.4, 'plain', 0x8a8478); // gym wing
    for (let k = 0; k < 9; k++) for (const y of [2, 5]) { if (k === 4) continue; F.face(-16 + k * 4, y, 6.53, 2.4, 1.4, 'window', 0xffffff); }
    // render pass 2026-11-27: back windows, cast-stone band course + plinth, brick pilasters between bays, rooftop units
    for (let k = 0; k < 9; k++) for (const y of [2, 5]) { if (k === 0 && y === 2) continue; F.face(-16 + k * 4, y, -6.53, 2.4, 1.4, 'window', 0xffffff, 1); }
    F.box(0, 3.55, 0, 40.24, 0.26, 13.24, 'plain', 0xe6dfcf);
    F.box(0, 0.3, 0, 40.16, 0.6, 13.16, 'plain', 0x9a9488);
    for (let k = 0; k <= 10; k++) { const x = -20 + k * 4; if (Math.abs(x) < 4) continue; F.box(x, 3.5, 6.56, 0.5, 7, 0.14, 'brick', 0xe8d8d0); }
    for (const [x, z] of [[-12, -2], [-4, 3], [6, -3], [13, 2]]) roofUnit(F, x, 7.3, z, 1.1);
    F.box(-14, 2.1, -12, 10.12, 0.2, 12.12, 'plain', 0xe6dfcf); roofUnit(F, -15, 4.22, -14, 0.9);
    // entrance portico
    F.box(0, 6, 8.2, 9, 0.5, 3.6, 'plain', 0xf0ece4);
    for (const s of [-3.6, -1.2, 1.2, 3.6]) { F.geo(new THREE.CylinderGeometry(0.3, 0.32, 5.8, 8), 'plain', 0xf4f4f0, s, 2.9, 9.6); F.post(s, 9.6, 0.32, 6); }
    shopWin(F, 0, 1.4, 6.55, 3, 2.8, 'door', 0x4a6a9a, { frame: 0xe6dfcf, noKick: true });
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
    // (the two homes that faced Main St moved when the shops went in: the farmhouse to Lake Rd, the trailer across Hollow Ln)
    [15, 33, -Math.PI / 2, { style: 'farm', wall: 0xf0f0ea, roof: 0x6a2a2a, w: 10, drive: 3, gravel: true, extras: ['woodpile', 'flag'], flag: 0x2a5a2a, fence: 'rail' }],
    [141, 22, -Math.PI / 2, { style: 'mobile', wall: 0xe0e8f0, roof: 0x8a9098, trim: 0x2a6ab0, drive: 3.5, extras: ['flamingos', 'junker'], junk: 0x4a6a8a, fence: 'chain' }],
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
    [77.5, 109.5, Math.PI, { style: 'farm', wall: 0xfff4d8, roof: 0x3a4a5a, w: 10, drive: 5, gravel: true, extras: ['scarecrow', 'coop'] }],   // was x 72, on Old Mill Rd
    [93, 110, Math.PI, { style: 'mobile', wall: 0xc8e0d0, roof: 0x8a9098, trim: 0x3a8a5a, awning: 0x3a6ab0, drive: 5, extras: ['lawnsigns', 'woodpile'] }],
    [107, 109.5, Math.PI, { style: 'cottage', wall: 0xc0d8f0, roof: 0x2a3a4a, w: 8, drive: 5, extras: ['pickets', 'gnomes', 'swing'] }],
    [124, 109.5, Math.PI, { style: 'ranch', wall: 0xf0d0c0, roof: 0x5a5048, w: 9.5, drive: 5, extras: ['junker', 'dish', 'flamingos'], junk: 0x6a3a8a }],
  ];
  for (const [x, z, ry, s] of H) {
    if (s.extras.includes('hay')) { s.extras = s.extras.filter((e) => e !== 'hay'); const [hx, hz] = rot(x, z, -9, -2, ry); hay(hx, hz, 0.3); hay(hx + 1.6, hz + 0.4, 0.2); }
    home(x, z, ry, s);
  }
  // country details: mailboxes on posts, a few big oaks, a hand-painted sign
  for (const [x, z] of [[90, 26], [138, 70], [66, 75], [100, 88], [120, 28]]) tree(x, z, 1.4 + rnd() * 0.4, { kind: 'round' });
  const F = frame(...offRoad(64, 40, 0.9), Math.PI / 4);
  F.box(0, 0.7, 0, 0.12, 1.4, 0.12, 'wood', 0xffffff);
  F.sign('FRESH EGGS $3', '#f4f0e0', '#8a3a2a', 1.6, 0.5, 1.3, 0.08);
  hydrant(66, 50); hydrant(122, 90);
}

// ---------- Main Street: the shops between School Rd and Hollow Ln ----------
// South side of Main St (Hwy 9), x 66..124. Every storefront faces north onto the sidewalk; its front wall sits at z = 9.5.
const SHOP_FRONT = 9.5;
function storefront(cx, w, d, o) {
  const cz = SHOP_FRONT + d / 2, F = frame(cx, cz, Math.PI), h = o.h || 4.4, fz = d / 2 + 0.03;
  F.box(0, h / 2, 0, w, h, d, o.brick ? 'brick' : 'siding', o.wall);
  F.bld(0, 0, w, d, h + 0.8);
  F.box(0, h + 0.4, fz - 0.17, w + 0.1, 0.8, 0.3, 'plain', o.trim);        // false-front parapet
  F.box(0, h + 0.03, 0, w + 0.24, 0.18, d + 0.24, 'plain', o.trim);         // cornice
  F.box(0, 0.2, 0, w + 0.1, 0.4, d + 0.1, 'plain', 0x8a8478);               // foundation
  for (const s of [-1, 1]) F.box(s * (w / 2 - 0.12), h / 2, fz + 0.06, 0.32, h, 0.14, 'plain', o.trim); // pilasters
  const dx = o.doorX ?? 0, dw = o.doorW ?? 1.3;
  F.face(dx, 1.15, fz + 0.01, dw, 2.3, 'door', o.door ?? 0x99c4e0);
  for (const [x, ww] of o.wins) {
    F.face(x, 1.65, fz + 0.01, ww, 1.8, 'storeWin', o.winCol ?? 0xffffff);
    F.box(x, 0.4, fz + 0.05, ww + 0.2, 0.5, 0.1, 'plain', o.trim);           // kick plate under the glass
  }
  if (h > 5.5) for (let x = -w / 2 + 1.8; x <= w / 2 - 1.7; x += 2.4) F.face(x, h - 1.5, fz + 0.01, 1.2, 1.4, 'window', 0xffffff);
  if (o.awning) { // striped canvas awning
    const aw = w - 0.7, n = Math.max(2, Math.round(aw / 0.75)), sw = aw / n;
    for (let k = 0; k < n; k++) F.geo(new THREE.BoxGeometry(sw, 0.06, 1.8).rotateX(0.36), 'plain', o.awning[k % 2], -aw / 2 + (k + 0.5) * sw, 3.0, fz + 0.86);
    F.box(0, 2.66, fz + 1.72, aw, 0.3, 0.04, 'plain', o.awning[0]);          // valance
  }
  F.sign(o.name, o.signBg, o.signFg, o.signW || Math.min(w - 1.2, 8), 0.85, o.signY ?? 3.95, fz + 0.06, { tw: 512, th: 64, glow: o.glow });
  F.light(0, 3.2, fz + 1.6, o.lightCol ?? 0xffe0b0, 0.7);
  F.halo(0, o.signY ?? 3.95, fz + 0.3, 2.4, o.lightCol ?? 0xffe0b0);
  return F;
}
function barberPole(x, z) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const g = c.getContext('2d');
  for (let k = -4; k < 8; k++) { g.fillStyle = ['#d02828', '#f4f4f4', '#2848b0', '#f4f4f4'][(k + 8) % 4]; g.beginPath(); g.moveTo(0, k * 12); g.lineTo(32, k * 12 + 16); g.lineTo(32, k * 12 + 28); g.lineTo(0, k * 12 + 12); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1.4);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 10), basic({ map: t }));
  m.position.set(x, 2.1, z); SCENE.add(m);
  animated.push({ obj: m, fn: (tt) => { t.offset.y = -tt * 0.5; } });
  addS(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10), 'metal', 0xd8d8d8, x, 2.61, z);
  addS(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10), 'metal', 0xd8d8d8, x, 1.59, z);
  addS(new THREE.SphereGeometry(0.15, 8, 5), 'metal', 0xf0f0f0, x, 2.74, z);
}
/** lumber bundle on a pallet: boards stacked, two steel bands */
function lumberStack(F, lx, lz, len, w, h, col = 0xf2d8a8, rr = 0) {
  F.box(lx, 0.07, lz, w + 0.1, 0.14, len - 0.4, 'wood', 0x9a7a58, rr);
  F.box(lx, 0.14 + h / 2, lz, w, h, len, 'wood', col, rr);
  for (const s of [-1, 1]) { const [bx, bz] = [lx + Math.sin(rr) * s * len * 0.3, lz + Math.cos(rr) * s * len * 0.3]; F.box(bx, 0.14 + h / 2, bz, w + 0.03, h + 0.03, 0.05, 'metal', 0x6a6a70, rr); }
  F.col(lx, lz, w + 0.1, len, h + 0.14, rr);
}
function buildMainStreet() {
  // the sidewalk in front of the shops
  frame(95, 7.9, 0).flat(0, 0, 58, 3.4, 'sidewalk', 0xe4e0d8, 0.065, '#b8b4ac');
  // ---- Bev's Threads: clothing, two storeys of pale brick ----
  {
    const F = storefront(72.5, 12, 11, { h: 7.2, brick: true, wall: 0xf4e4d8, trim: 0x5a2a4a, door: 0x5a2a4a, wins: [[-3.5, 3.4], [3.5, 3.4]], winCol: 0xffe8f0,
      awning: [0x7a2a5a, 0xf4e8f0], name: "BEV'S THREADS", signBg: '#5a2a4a', signFg: '#f8e8c8', signY: 4.3, lightCol: 0xffb0d0 });
    // a rolling rack of shirts and a SALE sandwich board out front
    const z = 5.5 + 1.2;
    F.box(-3.6, 1.55, z, 2.2, 0.05, 0.05, 'metal', 0xc0c0c8);
    for (const s of [-1, 1]) F.box(-3.6 + s * 1.05, 0.8, z, 0.05, 1.55, 0.5, 'metal', 0xc0c0c8);
    for (let k = 0; k < 7; k++) F.box(-4.5 + k * 0.3, 1.1, z, 0.08, 0.8, 0.5, 'plain', [0xd04a4a, 0x3a6ad0, 0xf0c040, 0x3aa060, 0xf4f4f4, 0x8a3ac0, 0x222222][k]);
    F.col(-3.6, z, 2.3, 0.6, 1.6);
    F.geo(new THREE.BoxGeometry(0.8, 1.0, 0.05).rotateX(0.22), 'plain', 0xf4f0e0, 3.6, 0.5, z + 0.2);
    F.geo(new THREE.BoxGeometry(0.8, 1.0, 0.05).rotateX(-0.22), 'plain', 0xf4f0e0, 3.6, 0.5, z - 0.2);
    F.sign('SALE', '#f4f0e0', '#c02040', 0.7, 0.4, 0.62, z + 0.33, { tw: 128, th: 64, lx: 3.6, rr: -0.22 });
    F.col(3.6, z, 0.9, 0.6, 1);
    places.clothing = (([x, z]) => ({ x, z, name: "Bev's Threads" }))(F.at(0, 7.5));
  }
  // ---- Sal's Barber Shop ----
  {
    const F = storefront(82, 7, 10, { wall: 0xe8e4d8, trim: 0x1e3a6a, door: 0xf4f4f4, doorX: 1.6, wins: [[-1.4, 3.0]], awning: [0x1e3a6a, 0xf4f4f4],
      name: "SAL'S BARBER", signBg: '#f4f4f4', signFg: '#1e3a6a', signW: 5.6 });
    barberPole(...F.at(2.9, 5.2));
    bench(F, -1.4, 6.9, Math.PI);
    places.barber = (([x, z]) => ({ x, z, name: "Sal's Barber" }))(F.at(0, 7.5));
  }
  // ---- Lucky Pawn ----
  {
    const F = storefront(89, 7, 10, { h: 4.6, brick: true, wall: 0xd8c8a8, trim: 0x2a3a2a, door: 0x6a5a3a, doorX: -2, wins: [[1.4, 3.6]], winCol: 0xfff0b0,
      name: 'LUCKY PAWN', signBg: '#111111', signFg: '#ffd040', glow: true, signW: 5.6, lightCol: 0xffd060 });
    for (let k = 0; k < 7; k++) F.box(-0.25 + k * 0.55, 1.65, 5.12, 0.05, 1.8, 0.05, 'metal', 0x444448); // bars on the window
    F.sign('GOLD  GUITARS  TVs', '#111111', '#ff5060', 3.2, 0.32, 2.95, 5.14, { tw: 512, th: 52, glow: true, lx: 1.4 });
    places.pawn = (([x, z]) => ({ x, z, name: 'Lucky Pawn' }))(F.at(0, 7.5));
  }
  // ---- Hank's Hardware (the lumber yard is next door through the side gate) ----
  {
    const F = storefront(99.5, 14, 12, { h: 5.4, wall: 0xb84a3a, trim: 0xf4f0e4, door: 0x9ac0d8, doorW: 2.4, wins: [[-4.4, 4.2], [4.4, 4.2]],
      awning: [0x2a6a3a, 0xf0f0e0], name: "HANK'S HARDWARE", signBg: '#2a6a3a', signFg: '#fff4c0', signW: 9, signY: 4.35, lightCol: 0xfff0c8 });
    // the side door into the yard (east wall = local -x, since the frame faces north)
    F.face(-7.03, 1.15, 2.5, 1.2, 2.3, 'door', 0xe0e0e0, 3);
    F.sign('LUMBER YARD  ->', '#2a6a3a', '#fff4c0', 2.4, 0.4, 2.7, 2.5, { tw: 256, th: 44, lx: -7.06, rr: -Math.PI / 2 });
    // sidewalk display: wheelbarrows, bagged mulch, propane cage, shrubs for sale
    for (const x of [4.6, 5.9]) {
      F.geo(new THREE.CylinderGeometry(0.55, 0.3, 0.4, 8, 1, true).scale(1, 1, 1.4), 'metal', 0x2a7a3a, x, 0.75, 6.8);
      F.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, x, 0.22, 7.6);
      F.box(x, 0.45, 6.2, 0.5, 0.05, 1.4, 'metal', 0x555555);
      F.col(x, 6.9, 0.9, 1.6, 1);
    }
    F.box(1.6, 0.07, 6.9, 1.3, 0.14, 1.1, 'wood', 0x9a7a58);
    for (let k = 0; k < 4; k++) F.box(1.6, 0.25 + k * 0.17, 6.9, 1.15, 0.16, 0.95, 'plain', k % 2 ? 0x6a4a2a : 0x7a5a32);
    F.col(1.6, 6.9, 1.3, 1.1, 0.9);
    F.box(-4.6, 0.8, 6.9, 1.6, 1.6, 0.9, 'metal', 0xb8bcc4); F.col(-4.6, 6.9, 1.6, 0.9, 1.6); // propane cage
    for (let k = 0; k < 3; k++) F.geo(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 8), 'plain', 0x3a6ab0, -5.1 + k * 0.5, 0.45, 6.95);
    F.sign('PROPANE', '#b8bcc4', '#c02020', 1.2, 0.3, 1.45, 7.36, { tw: 128, th: 32, lx: -4.6 });
    for (let k = 0; k < 3; k++) { const [bx, bz] = F.at(-1.5 - k * 0.9, 6.8); F.geo(new THREE.CylinderGeometry(0.22, 0.17, 0.3, 8), 'plain', 0x8a4a2a, -1.5 - k * 0.9, 0.15, 6.8); bush(bx, bz, 0.5); }
    places.hardware = (([x, z]) => ({ x, z, name: "Hank's Hardware" }))(F.at(0, 8));
  }
  // ---- the lumber yard, attached on the east side (x 106.5..124) ----
  {
    const cx = 115.3, cz = 15.3, F = frame(cx, cz, Math.PI); // local: +z north (Main St), +x west (the store)
    F.flat(0, 0, 17.6, 13.6, 'dirt', 0xe0d4bc, 0.05, '#a89880');
    // chain link round the yard, gate open onto Main St
    const yard = [[8.7, 6.7], [2.6, 6.7]], yard2 = [[-3.4, 6.7], [-8.7, 6.7], [-8.7, -6.6], [8.7, -6.6]];
    { const [a, b] = F.at(...yard[0]), [c, d] = F.at(...yard[1]); fenceRun(a, b, c, d, 'chain'); }
    for (let k = 0; k < yard2.length - 1; k++) { const [a, b] = F.at(...yard2[k]), [c, d] = F.at(...yard2[k + 1]); fenceRun(a, b, c, d, 'chain'); }
    for (const x of [2.6, -3.4]) { F.box(x, 1.6, 6.7, 0.14, 3.2, 0.14, 'metal', 0xa8acb2); F.post(x, 6.7, 0.1, 3.2); }
    F.box(-0.4, 3.1, 6.7, 6.2, 0.1, 0.1, 'metal', 0xa8acb2);
    F.sign("HANK'S LUMBER", '#2a6a3a', '#fff4c0', 4.4, 0.7, 3.6, 6.72, { tw: 512, th: 64, lx: -0.4, double: true });
    { const [a, b] = F.at(-3.6, 7.1), [c, d] = F.at(-8.4, 7.1); fenceRun(a, b, c, d, 'chain', undefined, { gate: true }); }     // the rolled-back gate
    // open lumber shed along the back: steel posts, a sloped roof, board racks underneath
    for (const x of [-7.8, -2.6, 2.6, 7.8]) for (const z of [-1.4, -6.1]) { F.box(x, 2.1, z, 0.16, 4.2, 0.16, 'metal', 0x8a9098); F.post(x, z, 0.12, 4.2); }
    F.geo(new THREE.BoxGeometry(16.6, 0.1, 5.8).rotateX(-0.12), 'metal', 0x9aa8b0, 0, 4.35, -3.75);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) F.box(-5.2 + r * 5.2, 0.45 + k * 0.62, -3.75, 4.6, 0.5, 3.2 - k * 0.35, 'wood', [0xf2d8a8, 0xe8c890, 0xf4e0b8][(r + k) % 3]);
    for (let r = 0; r < 3; r++) F.col(-5.2 + r * 5.2, -3.75, 4.6, 3.2, 2.6);
    F.sign('2x4  2x6  4x4  PLYWOOD', '#f4f0e0', '#2a6a3a', 6, 0.5, 3.75, -1.3, { tw: 512, th: 44 });
    // bundles on pallets in the yard, a plywood stack, and the forklift
    lumberStack(F, -6.4, 3.2, 4.8, 1.3, 0.9);
    lumberStack(F, 6.2, 1.5, 4.2, 1.2, 0.8, 0xe8c890, Math.PI / 2);
    lumberStack(F, 6.2, 3.4, 4.2, 1.2, 1.1, 0xf4e0b8, Math.PI / 2);
    F.box(2.2, 0.5, 0.2, 2.4, 0.9, 1.25, 'wood', 0xd8b880); F.box(2.2, 0.07, 0.2, 2.5, 0.14, 1.3, 'wood', 0x9a7a58); F.col(2.2, 0.2, 2.5, 1.3, 1.0); // plywood sheets
    {
      const fx = -1.8, fz = 3.6;
      F.box(fx, 0.85, fz, 1.2, 0.9, 1.9, 'plain', 0xf0b020);
      F.box(fx, 1.5, fz + 0.4, 1.05, 0.08, 1.0, 'plain', 0x2a2a2a);
      for (const s of [-1, 1]) { F.box(fx + s * 0.5, 1.9, fz - 0.3, 0.06, 1.3, 0.06, 'plain', 0x2a2a2a); F.box(fx + s * 0.35, 2.9, fz + 1.05, 0.12, 2.6, 0.12, 'metal', 0x555555); }
      F.box(fx, 2.55, fz - 0.1, 1.2, 0.06, 1.0, 'plain', 0x2a2a2a);
      for (const s of [-1, 1]) for (const z2 of [fz - 0.6, fz + 0.6]) F.geo(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 10).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, fx + s * 0.62, 0.3, z2);
      for (const s of [-1, 1]) F.box(fx + s * 0.3, 0.15, fz + 1.7, 0.12, 0.05, 1.1, 'metal', 0x555555);
      F.col(fx, fz + 0.3, 1.3, 2.6, 1.6);
    }
    F.light(0, 4, -3.5, 0xfff0d0, 0.9); F.halo(0, 4.1, -1.3, 2.2, 0xfff0d0);
    places.lumber = (([x, z]) => ({ x, z, name: "Hank's Lumber Yard" }))(F.at(-0.4, 5));
  }
  // ---- Duke's Auto Repair: the mechanic's garage on the School Rd corner, south of Rosie's ----
  {
    const cx = 46, cz = 31, F = frame(cx, cz, Math.PI / 2);   // front (local +z) faces east onto School Rd
    const w = 13, d = 9, h = 5;
    F.flat(-0.5, 6.5, 15.5, 5.6, 'asphalt', 0xd8d8d8, 0.04, '#6a6a70');
    F.box(0, h / 2, 0, w, h, d, 'brick', 0xd8d4cc); F.bld(0, 0, w, d, h + 0.6);
    F.box(0, h + 0.35, d / 2 - 0.15, w + 0.1, 0.7, 0.3, 'plain', 0x2a4a7a);
    F.box(0, h + 0.03, 0, w + 0.2, 0.16, d + 0.2, 'plain', 0x2a4a7a);
    for (const x of [-4, 0]) { F.face(x, 1.65, d / 2 + 0.03, 3.4, 3.3, 'garage', 0xf0f0f0); F.box(x, 3.4, d / 2 + 0.06, 3.6, 0.18, 0.12, 'plain', 0x2a4a7a); }
    F.face(4.4, 1.15, d / 2 + 0.03, 1.1, 2.3, 'door', 0x2a4a7a);
    F.face(4.4, 3.4, d / 2 + 0.03, 2.2, 1.0, 'storeWin', 0xffffff);
    F.sign("DUKE'S AUTO REPAIR", '#2a4a7a', '#f4f0e0', 9, 0.9, 4.2, d / 2 + 0.06, { tw: 512, th: 64 });
    F.light(-2, 3.6, d / 2 + 1.5, 0xf0f4ff, 1.0); F.halo(-2, 4.2, d / 2 + 0.4, 2.6, 0xf0f4ff);
    // a sedan up on the two-post lift in front of bay 1, hood up on the junker by the wall
    {
      const lx = -4, lz = d / 2 + 2.2;
      for (const s of [-1, 1]) { F.box(lx + s * 1.25, 1.5, lz, 0.25, 3, 0.25, 'plain', 0xe0b020); F.post(lx + s * 1.25, lz, 0.18, 3); F.box(lx + s * 0.8, 1.3, lz, 0.9, 0.1, 0.15, 'metal', 0x666666); }
      F.box(lx, 1.7, lz, 1.8, 0.7, 4.0, 'plain', 0x8a2a2a); F.box(lx, 2.3, lz - 0.2, 1.65, 0.55, 2.0, 'plain', 0x8a2a2a);
      F.face(lx, 2.3, lz + 0.91, 1.5, 0.45, 'window', 0x9aa0a8);
      for (const s of [-1, 1]) for (const z2 of [lz - 1.3, lz + 1.3]) F.geo(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, lx + s * 0.85, 1.35, z2);
      F.col(lx, lz, 2.8, 4.1, 1.2);
    }
    for (let k = 0; k < 2; k++) for (let j = 0; j < 4 - k; j++) F.geo(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10), 'plain', 0x1e1e1e, 7.8, 0.12 + j * 0.25, d / 2 + 1 + k * 0.9);
    F.col(7.8, d / 2 + 1.45, 0.9, 1.8, 1);
    for (const [x, z, c] of [[-7.6, -2, 0x2a5aa0], [-7.6, -0.9, 0xc03030], [-7.6, 1.6, 0x3a3a3a]]) barrel(...F.at(x, z), c);
    F.geo(new THREE.BoxGeometry(0.8, 1.0, 0.05).rotateX(0.22), 'plain', 0xf4f0e0, 6.5, 0.5, d / 2 + 3.8);
    F.geo(new THREE.BoxGeometry(0.8, 1.0, 0.05).rotateX(-0.22), 'plain', 0xf4f0e0, 6.5, 0.5, d / 2 + 3.4);
    F.sign('OIL $29', '#f4f0e0', '#2a4a7a', 0.7, 0.4, 0.62, d / 2 + 3.93, { tw: 128, th: 64, lx: 6.5, rr: 0.22 });
    F.col(6.5, d / 2 + 3.6, 0.9, 0.6, 1);
    places.mechanic = (([x, z]) => ({ x, z, name: "Duke's Auto Repair" }))(F.at(2, d / 2 + 2.5));
  }
  // lamps and a hydrant for the new block
  for (const t of [38, 58]) lampAlong('M1', 'M2', t, 1);
  hydrant(96.5, 7.5);
}

// ---------- lot fences ----------
// Every home gets a fenced yard (the RV lot stays open): a low front fence with gaps for the driveway and the front walk,
// taller sides and back. Fences are alpha-cut quads (one per run) or plank boxes, with a box collider per run (jumpable).
const FENCE = {
  picket: { h: 1.0, key: 'picket', col: 0xffffff, post: 'plain', postCol: 0xf2f0ea },
  chain: { h: 1.25, key: 'chain', col: 0xffffff, post: 'metal', postCol: 0xa8acb2, uv: 1.5, pw: 0.07 },
  iron: { h: 1.4, key: 'iron', col: 0xffffff, post: 'brick', postCol: 0xffffff, pw: 0.5, every: 5, cap: 0.3 },
  privacy: { h: 1.8, box: true, col: 0xf0e8d8 },
  rail: { h: 1.05, rail: true, col: 0xc8b090, pw: 0.15 },
};
function fenceRun(x0, z0, x1, z1, kind, col, o = {}) {
  const K = FENCE[kind], len = Math.hypot(x1 - x0, z1 - z0); if (!K || len < 0.4) return;
  const n0 = Math.ceil(len / 7.2 - 1e-6);   // breakables: one breakable group per <= 7.2 m section
  if (n0 > 1) { for (let k = 0; k < n0; k++) fenceRun(x0 + (x1 - x0) * k / n0, z0 + (z1 - z0) * k / n0, x0 + (x1 - x0) * (k + 1) / n0, z0 + (z1 - z0) * (k + 1) / n0, kind, col, { ...o, skip0: k > 0 }); return; }
  const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, h = K.h, c = col ?? K.col;
  if (K.box) {
    const g = new THREE.BoxGeometry(len, h, 0.08), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 3);
    addS(g, 'fence', c, mx, h / 2, mz, ry);
  } else if (K.rail) {
    for (const y of [0.45, 0.88]) addS(new THREE.BoxGeometry(len, 0.11, 0.07), 'wood', c, mx, y, mz, ry);
  } else {
    const g = new THREE.PlaneGeometry(len, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len * (K.uv || 1));
    addS(g, K.key, c, mx, h / 2, mz, ry);
  }
  const n = Math.max(1, Math.round(len / (K.every || 2.4))), pw = K.pw || 0.11, ph = h + (K.cap || 0.05);
  for (let k = o.skip0 ? 1 : 0; k <= n; k++) {
    const t = k / n;
    addS(new THREE.BoxGeometry(pw, ph, pw), K.post || 'wood', K.postCol ?? c, x0 + (x1 - x0) * t, ph / 2, z0 + (z1 - z0) * t, ry);
  }
  colBox(mx, mz, len + 0.1, 0.24, h, ry, { fence: kind, brk: o.gate ? 'gate' : 'fence', fk: kind, fc: c, seg: [x0, z0, x1, z1] });
}
const lots = [];
const NO_FENCE = [{ x0: -115, x1: -93, z0: 30, z1: 50 }];   // the RV lot
function lotBox(L) {
  const has = (k) => L.extras.includes(k), W = L.w / 2, D = L.d / 2;
  let r = W + 2.6, l = W + 2.6, b = D + 4;
  if (has('boat')) r = Math.max(r, W + 3.6);
  if (has('junker')) r = Math.max(r, W + 4.8);
  if (has('shed')) { r = Math.max(r, W + 4.6); b = Math.max(b, D + 4.6); }
  if (has('tractor')) { r = Math.max(r, W + 5.4); b = Math.max(b, D + 5.2); }
  if (has('tramp')) { l = Math.max(l, W + 3.4); b = Math.max(b, D + 6); }
  if (has('swing')) { l = Math.max(l, W + 5); b = Math.max(b, D + 5); }
  if (has('coop')) l = Math.max(l, W + 4);
  if (has('scarecrow')) l = Math.max(l, W + 3.4);
  if (has('pool')) b = Math.max(b, D + 7.6);
  if (has('garden')) b = Math.max(b, D + 5.2);
  const f = Math.max(D + L.dl - 0.4, D + (L.porch ? 3.9 : 2));
  return { l: -l, r, b: -b, f };
}
function toLocal(L, x, z) { const dx = x - L.x, dz = z - L.z, c = Math.cos(L.ry), s = Math.sin(L.ry); return [dx * c - dz * s, dx * s + dz * c]; }
function inBld(x, z, pad) {
  for (const c of colliders) {
    if (!c.bld) continue;
    if (c.ob) { const dx = x - c.cx, dz = z - c.cz; if (Math.abs(dx * c.c - dz * c.s) < c.hw + pad && Math.abs(dx * c.s + dz * c.c) < c.hd + pad) return true; }
    else if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
  }
  return false;
}
function lotStyle(L, i) {
  if (L.fence) return typeof L.fence === 'string' ? { front: L.fence, side: L.fence, back: L.fence } : L.fence;
  const dist = districtAt(L.x, L.z);
  if (dist === 'Maple Grove Estates') return { front: 'picket', side: 'privacy', back: 'privacy' };
  if (dist === "Nana's Place") return { front: 'picket', side: 'rail', back: 'rail' };
  const k = ['chain', 'rail', 'picket', 'chain', 'rail', 'picket'][i % 6];
  return { front: k, side: k, back: k, col: k === 'picket' ? 0xe8e0cc : undefined };
}
function buildFences() {
  const B = lots.map(lotBox);
  lots.forEach((L, i) => {
    const S = lotStyle(L, i), bx = B[i], F = frame(L.x, L.z, L.ry);
    if (L.extras.includes('pickets') || L.extras.includes('hedges')) S.front = null;
    const gaps = [[L.driveX - 1.9, L.driveX + 1.9], [L.doorX - 0.85, L.doorX + 0.85]];
    // corners: front-left -> front-right -> back-right -> back-left -> front-left
    const edges = [
      [[bx.l, bx.f], [bx.r, bx.f], S.front, true],
      [[bx.r, bx.f], [bx.r, bx.b], S.side],
      [[bx.r, bx.b], [bx.l, bx.b], S.back],
      [[bx.l, bx.b], [bx.l, bx.f], S.side],
    ];
    for (const [[ax, az], [qx, qz], kind, front] of edges) {
      if (!kind) continue;
      const len = Math.hypot(qx - ax, qz - az), n = Math.max(1, Math.round(len / 1.2));
      const keep = [];
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, tm = (t0 + t1) / 2, lx = ax + (qx - ax) * tm, lz = az + (qz - az) * tm;
        const [wx, wz] = F.at(lx, lz);
        let ok = true;
        if (front && gaps.some(([g0, g1]) => lx > g0 - 0.6 && lx < g1 + 0.6)) ok = false;
        else if (onRoad(wx, wz, 0.25) || inBld(wx, wz, 0.35)) ok = false;
        else if (NO_FENCE.some((q) => wx > q.x0 && wx < q.x1 && wz > q.z0 && wz < q.z1)) ok = false;
        else for (let j = 0; j < i; j++) {   // an earlier yard already fences this ground
          if (Math.hypot(lots[j].x - L.x, lots[j].z - L.z) > 40) continue;
          const [px, pz] = toLocal(lots[j], wx, wz), q = B[j];
          if (px > q.l + 0.3 && px < q.r - 0.3 && pz > q.b + 0.3 && pz < q.f - 0.3) { ok = false; break; }
        }
        keep.push(ok);
      }
      // join kept pieces into runs of at most ~7 m
      let k = 0;
      while (k < n) {
        if (!keep[k]) { k++; continue; }
        let e = k; while (e + 1 < n && keep[e + 1] && (e + 2 - k) * len / n <= 7.2) e++;
        const [x0, z0] = F.at(ax + (qx - ax) * k / n, az + (qz - az) * k / n), [x1, z1] = F.at(ax + (qx - ax) * (e + 1) / n, az + (qz - az) * (e + 1) / n);
        fenceRun(x0, z0, x1, z1, kind, S.col);
        k = e + 1;
      }
      // breakables (2026-11-27): a picket front gets a little gate at the front walk, left standing open into the yard
      if (front && kind === 'picket') {
        let kl = -1, kr = -1;
        for (let j = 0; j < n; j++) { const c0 = ax + (qx - ax) * (j + 0.5) / n; if (keep[j] && c0 < L.doorX) kl = j; if (keep[j] && c0 > L.doorX && kr < 0) kr = j; }
        if (kl >= 0 && kr >= 0) {
          const xl = ax + (qx - ax) * (kl + 1) / n, xr = ax + (qx - ax) * kr / n, leaf = Math.min(1.1, (xr - xl) * 0.45);
          if (xr - xl > 1.2 && xr - xl < 10) {   // the walk + driveway gaps usually merge: hinge on the walk's side const [x0, z0] = F.at(xl + 0.06, az - 0.06), [x1, z1] = F.at(xl + 0.06, az - 0.06 - leaf); fenceRun(x0, z0, x1, z1, 'picket', S.col, { gate: true }); }
        }
      }
    }
  });
}

// ---------- utility poles with sagging wires ----------
function buildPoles(scene) {
  const wires = [];
  const chain = (names, side, step = 24) => {
    const idx = [N[names[0]]]; for (let i = 0; i < names.length - 1; i++) idx.push(...via(names[i], names[i + 1]).slice(1));   // curves included
    const pts = idx.map((i) => NODES[i]);
    const poles = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1], L = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
      const w = ADJ[idx[i]].find((e) => e.n === idx[i + 1]).w;
      for (let t = 8; t < L - 6; t += step) poles.push([A.x + dx * t - dz * side * (w / 2 + 2.4), A.z + dz * t + dx * side * (w / 2 + 2.4), Math.atan2(dx, dz)]);
    }
    for (let k = poles.length - 1; k >= 0; k--) if (onRoad(poles[k][0], poles[k][1], 0.3)) poles.splice(k, 1);   // not on a crossing road
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
  chain(['HNJ', 'CN1', 'CN2', 'CNE', 'CE1', 'HEJ'], 1);   // County Rd 12 (countryside)
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x15151a })));
}

// ---------- Hollow Woods, expanded (2026-11-13): everything west of the woods' old edge and south of the lake, to Old Mill Rd ----------
// Ragged edge (2026-11-15, diet: "more natural and blended with the grass ... dont make the border straight"): the woods
// are the old straight-edged shape, pushed in up to 22 m / out up to 8 m (3 m on the town side) by smooth noise along the edge, then thinned
// towards the edge, with stray trees and bushes out in the grass (buildCountry) and a feathered forest floor (ground.js).
function woodsBase(x, z) {   // signed distance (m) into the straight-edged woods; + inside
  const dA = Math.min(-113 - x, z - (x < -150 ? -18 : -40)), dB = Math.min(z - 117, oldMillX(z) - 9 - x);
  return Math.max(dA, dB);
}
function woodsNoise(x, z) {  // 0..1, smooth, ~40-90 m wavelengths plus a little wobble
  return 0.5 + 0.5 * (0.4 * Math.sin(x * 0.071 + z * 0.029 + 1.7) + 0.3 * Math.sin(z * 0.113 - x * 0.047 + 0.4) + 0.2 * Math.sin(x * 0.23 - z * 0.17 + 2.2) + 0.1 * Math.sin((x + z) * 0.41 + 0.9));
}
/** Signed distance (m) into the ragged Hollow Woods; > 0 is inside. */
export function woodsD(x, z) { return woodsBase(x, z) + (x > -117 && z < 112 ? 3 : 8) - 30 * woodsNoise(x, z); }   // town side bulges out less
const hash2 = (x, z) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };
/** Thin the trees within ~9 m of the edge: true = no tree here. */
function woodsCut(x, z) { const d = woodsD(x, z); return d < 0 || distToPath(x, z, HOLLOW_TRAIL) < 3.2 || hash2(x, z) > 0.25 + 0.75 * Math.min(1, d / 9) || badGround(x, z); }
/** No trees in the creek or on rock faces (approx slope over ~45 degrees). */
function badGround(x, z) { const c = pathProj(x, z, RIV_I); if (c && c.d < 4.5) return true; const v = pathProj(x, z, RAV_I); if (v && v.d < 5) return true; return (woodsD(x, z) > -2 || v) && approxSlope(x, z) > 0.95; }
/** Forest-floor paint weight 0..1, feathered ~8 m either side of the edge. */
function woodsFloor(x, z) { const t = Math.max(0, Math.min(1, (woodsD(x, z) + 6) / 14)); return t * t * (3 - 2 * t); }
const OLD_MILL = [[60, 95], [72, 136], [94, 238], [101, 300]];
function oldMillX(z) {
  for (let i = 0; i < OLD_MILL.length - 1; i++) { const [ax, az] = OLD_MILL[i], [bx, bz] = OLD_MILL[i + 1]; if (z <= bz || i === OLD_MILL.length - 2) return ax + (bx - ax) * Math.max(0, Math.min(1, (z - az) / (bz - az))); }
  return 101;
}
/** Is (x,z) in the (expanded) Hollow Woods? */
export function inWoods(x, z) { return woodsD(x, z) > 0; }
/** The part the town's own builder (buildForest) already plants. */
function oldWoods(x, z) { return ((x < -114 && z > -40) || (z > 119 && x < 48)) && x > -150 && z < 150; }
const WOODS_POLY = [[-310, -18], [-150, -18], [-150, -40], [-113, -40], [-113, 117], [57, 117], [63, 136], [85, 238], [92, 310], [-310, 310]];

// ---------- Maple Grove VFD fire station (2026-11-15, diet: "this town needs a small hospital and a fire station") ----------
// Lot: south side of Hwy 9 just east of town, centre ~(172, 22), facing north onto the highway. Push the lot rect to KEEP_OUT.
function buildFireStation() {
  // F local: +z faces world north (the highway), +x is world west. Lot: lx -16..16, lz -19..13 (world x 156..188, z 9..41).
  const cx = 172, cz = 22, F = frame(cx, cz, Math.PI);
  const BRICK = 0xc8644c, TRIM = 0xf2ede2, RED = 0xc81e1e;
  KEEP_OUT.push({ x0: 156, x1: 188, z0: 9, z1: 41 });
  // ground: concrete apron from the bays to the highway, asphalt lot by the office, gravel yard out back
  F.flat(-2, 7.5, 16, 11, 'sidewalk', 0xe4e0d8, 0.05, '#9a968e');
  F.flat(11, 6.5, 10, 13, 'asphalt', 0xd8d8d8, 0.045, '#6a6a70');
  F.flat(-1, -14.5, 30, 9, 'dirt', 0xc8c0b0, 0.04, '#8a8478');
  for (const lx of [8, 11, 14]) F.box(lx, 0.06, 9, 0.12, 0.02, 4, 'plain', 0xf0f0f0);
  for (const lx of [-6, 2]) F.box(lx, 0.07, 7.5, 0.25, 0.02, 10, 'plain', 0xe8c020);   // yellow lead-in lines
  // main block: two-bay red-brick engine house
  F.box(-2, 3.25, -4, 16, 6.5, 12, 'brick', BRICK); F.bld(-2, -4, 16, 12, 6.8);
  F.box(-2, 6.65, -4, 16.5, 0.35, 12.5, 'plain', TRIM);                               // parapet cap
  F.box(-2, 0.3, -4, 16.15, 0.6, 12.15, 'plain', 0x8a8478);                           // plinth
  F.box(-6, 7.2, -6, 2, 0.8, 1.6, 'metal', 0xb8bcc0); F.box(1, 7.05, -2, 1.2, 0.5, 1.2, 'metal', 0x9a9a9a);   // roof AC + vent
  for (const [lx, open] of [[-6, false], [2, true]]) {
    if (open) F.face(lx, 2.2, 2.03, 4.2, 4.4, 'plain', 0x1a1a1e);                     // rolled-up door, dark bay
    else F.face(lx, 2.2, 2.03, 4.2, 4.4, 'garage', 0xe8402e);
    F.box(lx, 4.55, 2.08, 4.6, 0.3, 0.16, 'plain', TRIM);                             // header
    for (const s of [-1, 1]) F.box(lx + s * 2.25, 2.2, 2.08, 0.18, 4.4, 0.16, 'plain', TRIM);
  }
  F.box(-2, 2.2, 2.12, 0.5, 4.4, 0.25, 'plain', 0x8a8478);                            // pier between bays
  F.sign('MAPLE GROVE VFD', '#c01818', '#ffd23f', 10, 1.1, 5.55, 2.08, { tw: 512, th: 56, lx: -2 });
  for (const lx of [-6, 2]) F.sign(lx < 0 ? '1' : '2', '#f2ede2', '#c01818', 0.6, 0.6, 4.95, 2.2, { tw: 32, th: 32, lx });
  // station light over the doors
  F.box(-2, 4.85, 2.35, 0.7, 0.25, 0.5, 'lamp', 0xfff0c0); F.box(-2, 4.75, 2.3, 0.08, 0.5, 0.08, 'metal', 0x555555);
  F.halo(-2, 4.7, 2.6, 2.4, 0xffe0a0); F.light(-2, 4.2, 4.5, 0xffe8c0, 1.1, { always: true });
  // side windows on the east wall
  for (const lz of [-1.5, -6.5]) F.face(-10.03, 3, lz, 1.4, 1.2, 'window', 0xffffff, 3);
  // office wing (west): door, windows, flat roof
  F.box(9.5, 2, -5, 7, 4, 9, 'brick', 0xd88a6c); F.bld(9.5, -5, 7, 9, 4.4);
  F.box(9.5, 4.15, -5, 7.4, 0.3, 9.4, 'plain', TRIM);
  F.face(11.4, 1.1, -0.47, 1.1, 2.2, 'door', 0x9a2a22);
  F.face(8, 1.7, -0.47, 2.2, 1.3, 'window', 0xffffff);
  F.box(11.4, 2.45, -0.15, 1.6, 0.1, 0.7, 'plain', RED);                              // door canopy
  F.sign('OFFICE', '#f2ede2', '#c01818', 1.6, 0.35, 3.1, -0.44, { tw: 128, th: 28, lx: 9.5 });
  F.face(13.03, 1.8, -5, 1.4, 1.2, 'window', 0xffffff, 2);
  F.light(11.4, 2.4, 1.2, 0xfff0c0, 0.7);
  bench(F, 8, 0.4);
  // hose-drying tower (east front corner)
  F.box(-11.6, 5.25, 0.3, 3.2, 10.5, 3.2, 'brick', BRICK); F.bld(-11.6, 0.3, 3.2, 3.2, 10.8);
  F.box(-11.6, 10.65, 0.3, 3.6, 0.3, 3.6, 'plain', TRIM);
  F.geo(new THREE.ConeGeometry(2.6, 1.6, 4).rotateY(Math.PI / 4), 'metal', 0x6a2a24, -11.6, 11.6, 0.3);
  for (const y of [4.2, 8.4]) F.face(-11.6, y, 1.93, 1, 1.4, 'window', 0xffffff);
  F.face(-11.6, 1.1, 1.93, 1, 2.2, 'door', 0x9a2a22);
  // siren on a pole, behind the tower
  F.box(-14.5, 4.5, -3, 0.2, 9, 0.2, 'metal', 0x8a8a8a); F.post(-14.5, -3, 0.15, 9);
  F.geo(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 10), 'metal', 0xd0d0d0, -14.5, 9.25, -3);
  F.geo(new THREE.CylinderGeometry(0.35, 0.2, 0.6, 8).rotateX(Math.PI / 2), 'metal', 0xb0b0b0, -14.5, 9.25, -2.4);
  F.geo(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 8), 'metal', 0x888888, -14.5, 9.7, -3);
  // flagpole and the marquee sign by the road (west of the apron)
  F.box(14.5, 4.5, 4, 0.12, 9, 0.12, 'plain', 0xdddddd); F.post(14.5, 4, 0.12, 9);
  F.box(15.3, 8.2, 4, 1.6, 1, 0.04, 'plain', 0x2f5d2f);
  F.box(10.4, 0.25, 11.6, 4.4, 0.5, 0.6, 'brick', 0xb0aca0);
  for (const s of [-1, 1]) F.box(10.4 + s * 2, 1.3, 11.6, 0.18, 1.8, 0.18, 'metal', 0x666666);
  F.box(10.4, 1.65, 11.6, 4.2, 1.1, 0.2, 'plain', 0x2a2a2a);
  for (const [t, y] of [['BURN BAN IN EFFECT', 1.92], ['PANCAKE BKFST SAT 7AM', 1.4]]) {
    F.sign(t, '#f4f0e0', '#c01818', 4, 0.42, y, 11.72, { tw: 384, th: 40, lx: 10.4 });
    F.sign(t, '#f4f0e0', '#c01818', 4, 0.42, y, 11.48, { tw: 384, th: 40, lx: 10.4, rr: Math.PI });
  }
  F.col(10.4, 11.6, 4.4, 0.6, 2.2);
  // a parked engine in the open bay, nose out on the apron
  {
    const tx = 2;
    for (const lz of [-0.5, 4.8]) for (const s of [-1, 1]) F.geo(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10).rotateZ(Math.PI / 2), 'plain', 0x1a1a1a, tx + s * 1.1, 0.5, lz);
    F.box(tx, 1.75, 0.3, 2.5, 2.2, 5.6, 'plain', RED);                                 // body
    F.box(tx, 2.95, 0.3, 2.3, 0.2, 5.4, 'metal', 0xc8ccd0);                             // ladder bed
    for (const s of [-1, 1]) F.box(tx + s * 0.6, 3.15, 0.3, 0.1, 0.2, 5.4, 'metal', 0xd8d8d8);
    F.box(tx, 1.75, 4.4, 2.5, 2.6, 2.2, 'plain', RED);                                 // cab
    F.box(tx, 1.1, 2.5, 2.54, 0.18, 6, 'plain', 0xf4f4f0);                             // white stripe
    F.face(tx, 2.45, 5.51, 2.2, 0.9, 'window', 0x9ab0c0);
    F.box(tx, 0.75, 5.6, 2.6, 0.3, 0.2, 'metal', 0xd8d8d8);                            // bumper
    for (const s of [-1, 1]) { F.box(tx + s * 0.8, 1.2, 5.52, 0.4, 0.25, 0.05, 'lamp', 0xfff4d0); F.box(tx + s * 0.6, 3.15, 4.4, 0.6, 0.18, 0.3, 'lamp', 0xff3020); }
    F.halo(tx, 3.3, 4.4, 1.4, 0xff3020);
    F.sign('MAPLE GROVE VFD', '#c01818', '#ffd23f', 1.6, 0.4, 2.1, 4.4, { tw: 256, th: 64, lx: tx - 1.27, rr: -Math.PI / 2 });
    F.sign('MAPLE GROVE VFD', '#c01818', '#ffd23f', 1.6, 0.4, 2.1, 4.4, { tw: 256, th: 64, lx: tx + 1.27, rr: Math.PI / 2 });
    F.col(tx, 3.8, 2.6, 3.8, 3);
  }
  hydrant(...F.at(-14, 11));
  places.fireStation = (([x, z]) => ({ x, z, yaw: Math.PI }))(F.at(-2, 8));
}

// ---------- Maple Grove Community Hospital (2026-11-15, diet) ----------
// Lot: south side of Hwy 9 east of the fire station, centre ~(208, 30), facing north onto the highway. Push the lot to KEEP_OUT.
function buildHospital() {
  // local frame faces north (ry = PI): world x = 212 - lx, world z = 33.5 - lz. Lot: lx -18..18, lz -24.5..24.5
  const cx = 212, cz = 33.5, F = frame(cx, cz, Math.PI);
  const WALL = 0xf2efe6, TRIM = 0x3a6a9a, RED = 0xd02a2a, GLASS = 0xa8d0e8;
  // pavement: parking lot, ER apron, drive from Hwy 9, front walk
  F.flat(-1.5, 9.5, 33, 23, 'asphalt', 0xd8d8d8, 0.04, '#6a6a70');
  F.flat(13.5, -4.5, 9, 7, 'asphalt', 0xd8d8d8, 0.04, '#6a6a70');
  F.flat(-1, 22.75, 10, 3.5, 'asphalt', 0xd8d8d8, 0.04, '#6a6a70');
  F.geo(plane(24, 3, 3, 1, 5, 0.6), 'sidewalk', 0xd8d4cc, -3, 0.06, -3.5);
  // painted stalls: a row nosed up to the walk and a row across the aisle
  for (let k = 0; k <= 8; k++) F.box(-15 + k * 2.75, 0.06, 0.5, 0.14, 0.02, 5, 'plain', 0xf0f0f0);
  for (let k = 0; k <= 9; k++) F.box(-15 + k * 2.75, 0.06, 12.5, 0.14, 0.02, 5, 'plain', 0xf0f0f0);
  for (const lx of [-15 + 2.75 * 0.5, -15 + 2.75 * 1.5]) F.box(lx, 0.061, 0.5, 1.1, 0.02, 1.1, 'plain', 0x3a6ad0);   // accessible stalls
  F.box(-1, 0.06, 18, 0.2, 0.02, 3, 'plain', 0xf0d040);                                                        // drive centre line
  // main block: two storeys, pale walls, blue trim, flat roof with parapet
  F.box(-3, 3.6, -12, 24, 7.2, 14, 'siding', WALL); F.bld(-3, -12, 24, 14, 7.6);
  F.box(-3, 0.35, -12, 24.3, 0.7, 14.3, 'plain', 0x9a968c);
  F.box(-3, 3.75, -12, 24.2, 0.3, 14.2, 'plain', TRIM);
  F.box(-3, 7.4, -12, 24.4, 0.4, 14.4, 'plain', 0xd8d4c8);
  for (let k = 0; k < 10; k++) {
    const x = -13.8 + k * 2.4;
    F.face(x, 5.2, -4.97, 1.6, 1.4, 'window', 0xffffff);
    if (Math.abs(x + 3) > 2.6) F.face(x, 2.0, -4.97, 1.6, 1.4, 'window', 0xffffff);
    F.face(x, 5.2, -19.03, 1.6, 1.4, 'window', 0xffffff, 1); F.face(x, 2.0, -19.03, 1.6, 1.4, 'window', 0xffffff, 1);
  }
  for (const lz of [-16.5, -12, -7.5]) for (const y of [2.0, 5.2]) F.face(-15.03, y, lz, 1.6, 1.4, 'window', 0xffffff, 3);
  // main entrance: glass doors, glass canopy on posts, name sign on the parapet
  F.face(-3, 1.4, -4.96, 4, 2.6, 'storeWin', 0xe8f4ff);
  F.face(-3, 1.2, -4.95, 1.8, 2.3, 'door', 0xd8e8f4);
  F.box(-3, 3.3, -3.4, 7, 0.18, 3.2, 'plain', GLASS); F.box(-3, 3.45, -1.85, 7.1, 0.25, 0.12, 'plain', 0xd8dce0);
  for (const x of [-6.3, 0.3]) { F.box(x, 1.65, -2, 0.16, 3.3, 0.16, 'metal', 0xd8dce0); F.post(x, -2, 0.12, 3.3); }
  F.sign('MAPLE GROVE COMMUNITY HOSPITAL', '#3a6a9a', '#ffffff', 15, 1.0, 6.5, -4.93, { tw: 768, th: 52 });
  F.sign('MAIN ENTRANCE', '#ffffff', '#3a6a9a', 2.6, 0.4, 3.62, -1.78, { lx: -3, tw: 256, th: 40 });
  F.light(-3, 3, -2, 0xfff0d8, 1.0, { always: true }); F.halo(-3, 3.1, -2.8, 3, 0xfff0d0);
  // emergency wing (one storey, west end) with a drive-under ambulance canopy
  F.box(13.5, 2.3, -12, 9, 4.6, 10, 'siding', 0xe8e4da); F.bld(13.5, -12, 9, 10, 4.8);
  F.box(13.5, 4.75, -12, 9.4, 0.3, 10.4, 'plain', RED);
  F.face(13.5, 1.3, -6.97, 3.2, 2.5, 'storeWin', 0xffe8e8); F.face(13.5, 1.2, -6.96, 1.8, 2.3, 'door', 0xf0f0f0);
  F.face(17.03, 2.2, -12, 1.6, 1.3, 'window', 0xffffff, 2); F.face(17.03, 2.2, -15, 1.6, 1.3, 'window', 0xffffff, 2);
  F.box(13.5, 4.3, -4, 9.2, 0.4, 6.2, 'plain', 0xf4f2ec); F.box(13.5, 4.3, -0.85, 9.3, 0.6, 0.12, 'plain', RED);
  for (const x of [9.4, 17.6]) { F.box(x, 2.05, -1.4, 0.3, 4.1, 0.3, 'plain', 0xf4f2ec); F.post(x, -1.4, 0.2, 4.1); }
  F.sign('EMERGENCY', '#d02a2a', '#ffffff', 5.2, 0.55, 4.3, -0.77, { lx: 13.5, tw: 384, th: 40, glow: true });
  F.sign('EMERGENCY', '#d02a2a', '#ffffff', 5, 0.8, 3.4, -6.93, { lx: 13.5, tw: 384, th: 48, glow: true });
  F.halo(13.5, 4.3, -0.4, 4.5, 0xff3030); F.light(13.5, 3.6, -3, 0xff7070, 1.1, { always: true });
  // the town's one ambulance, parked under the canopy
  F.box(13.5, 0.4, -4, 5.6, 0.5, 2.1, 'plain', 0x333336);
  F.box(14.3, 1.6, -4, 3.8, 2.2, 2.2, 'plain', 0xf8f8f4); F.box(11.7, 1.3, -4, 1.8, 1.6, 2.1, 'plain', 0xf8f8f4);
  F.box(11.15, 1.6, -4, 0.7, 0.7, 2.12, 'plain', 0x24343e);
  F.box(14.3, 1.35, -4, 3.82, 0.3, 2.22, 'plain', RED); F.box(14.3, 2.15, -4, 1.4, 0.3, 2.24, 'plain', RED); F.box(14.3, 2.15, -4, 0.3, 1.0, 2.24, 'plain', RED);
  for (const z of [-4.6, -3.4]) { F.box(12.2, 2.2, z, 0.3, 0.16, 0.3, 'lamp', z < -4 ? 0xff3030 : 0x4060ff); }
  for (const [x, z] of [[11.8, -5.05], [11.8, -2.95], [15.3, -5.05], [15.3, -2.95]]) F.geo(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 8).rotateX(Math.PI / 2), 'plain', 0x1a1a1a, x, 0.38, z);
  F.col(13.5, -4, 5.6, 2.2, 2.7);
  // roof: helipad, AC units, red-cross sign facing the highway
  F.geo(new THREE.CylinderGeometry(4.6, 4.6, 0.12, 20), 'plain', 0x5a5e62, -9, 7.66, -12);
  F.geo(new THREE.TorusGeometry(4.0, 0.15, 3, 20).rotateX(Math.PI / 2), 'plain', 0xf0d040, -9, 7.74, -12);
  F.box(-10.2, 7.75, -12, 0.45, 0.04, 3.2, 'plain', 0xffffff); F.box(-7.8, 7.75, -12, 0.45, 0.04, 3.2, 'plain', 0xffffff); F.box(-9, 7.75, -12, 2, 0.04, 0.45, 'plain', 0xffffff);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; F.box(-9 + Math.cos(a) * 4.5, 7.8, -12 + Math.sin(a) * 4.5, 0.25, 0.12, 0.25, 'lamp', 0x60ff80); }
  for (const [x, z] of [[2, -15], [5.5, -15], [2, -10.5]]) { F.box(x, 8.2, z, 2.4, 1.2, 1.8, 'metal', 0xb8bcc0); F.box(x, 8.84, z, 1.2, 0.08, 1.2, 'plain', 0x3a3e42); }
  F.box(6.5, 8.1, -9, 0.9, 1.0, 0.9, 'metal', 0xa8acb0);
  F.box(1, 9.1, -5.8, 0.14, 2.6, 0.14, 'metal', 0x888888); F.box(1, 9.6, -5.6, 2.2, 2.2, 0.25, 'plain', 0xffffff);
  F.box(1, 9.6, -5.45, 0.55, 1.6, 0.06, 'lamp', RED); F.box(1, 9.6, -5.45, 1.6, 0.55, 0.06, 'lamp', RED); F.halo(1, 9.6, -5.2, 3, 0xff4040);
  // benches, planters and shrubs by the front walk
  bench(F, -10.5, -3.2); bench(F, 4.5, -3.2);
  for (const x of [-13, -7.8, 1.6, 7.5]) {
    F.box(x, 0.35, -2.6, 1.6, 0.7, 0.9, 'brick', 0xc8b8a8); F.col(x, -2.6, 1.6, 0.9, 0.7);
    const [px, pz] = F.at(x, -2.6); bush(px - 0.35, pz, 0.7, 0xa8d898); bush(px + 0.35, pz, 0.6, 0xc0e0a0);
  }
  // light poles at the ends of the far row; trees on the verge either side of the drive
  for (const lx of [-16.8, 11.8]) { const [x, z] = F.at(lx, 12.5); streetLamp(x, z, lx < 0 ? -Math.PI / 2 : Math.PI / 2); }
  for (const [lx, lz] of [[-15, 22.5], [-9.5, 22.5], [14, 22.5], [16.5, 15]]) { const [x, z] = F.at(lx, lz); tree(x, z, 1.0, { kind: 'round' }); }
  // blue H road sign by the highway
  {
    const lx = -12.5, lz = 24;
    F.box(lx, 1.3, lz, 0.1, 2.6, 0.1, 'metal', 0x9a9a9a); F.post(lx, lz, 0.1, 2.6);
    F.sign('H', '#2a5ab8', '#ffffff', 1.0, 1.0, 2.4, lz + 0.06, { lx, tw: 64, th: 64, double: true });
    F.sign('HOSPITAL', '#2a5ab8', '#ffffff', 1.4, 0.32, 1.7, lz + 0.06, { lx, tw: 192, th: 40, double: true });
  }
  { const [x, z] = F.at(-17, -3); hydrant(x, z); }
  KEEP_OUT.push({ x0: cx - 18, x1: cx + 18, z0: cz - 24.5, z1: cz + 24.5 });
  const [hx, hz] = F.at(-3, -0.5);
  places.hospital = { x: hx, z: hz, yaw: Math.PI };
}

// Lots the countryside dressing (trees, hedges, rocks, hay) must stay out of: {x0, x1, z0, z1} world rects.
const KEEP_OUT = [];
/** The Hollow Deep (cave.js): a cave mouth in a rock face deep in the west of Hollow Woods. yaw = the way the mouth faces. */
export const CAVE_SPOT = { x: -272, z: 104, yaw: Math.PI / 2 };
KEEP_OUT.push({ x0: CAVE_SPOT.x - 11, x1: CAVE_SPOT.x + 9, z0: CAVE_SPOT.z - 11, z1: CAVE_SPOT.z + 11 });   // no trees in the cave's clearing
// haunted.js (Ghost vs. the HOA): the lane Gary's bulldozer comes down, east of the cave mouth, and his "Hollow Estates" site by the RV
export const SITE_SPOT = { x: -128, z: 62 };
KEEP_OUT.push({ x0: CAVE_SPOT.x + 9, x1: CAVE_SPOT.x + 52, z0: CAVE_SPOT.z - 6, z1: CAVE_SPOT.z + 6 });
KEEP_OUT.push({ x0: SITE_SPOT.x - 11, x1: SITE_SPOT.x + 11, z0: SITE_SPOT.z - 9, z1: SITE_SPOT.z + 9 });

// ---------- Maple Grove Estates, Phase II (2026-11-13, diet's markup): new streets + homes west of the Estates ----------
function buildEstatesWest() {
  // Estates Pkwy runs west from Hollow Oak Ln to County Rd 12; Magnolia Dr loops north, Juniper Ln back east, Willow Way south
  // to Willow Ct, Birch Ln back up to the parkway. The houses on these streets are placed by estateLots() (buildEstates).
  // the Estates are lit
  for (const [a, b, t, sd] of [['G4', 'GW1', 14, 1], ['G4', 'GW1', 40, -1], ['GW1', 'EW', 22, 1], ['EW', 'CW3', 18, -1], ['EW', 'CW3', 40, 1], ['EW', 'AC', 14, 1], ['EW', 'WW1', 18, -1], ['WW1', 'WW2', 14, 1], ['MC', 'AC', 25, 1], ['MC', 'ME', 22, -1], ['ME', 'G4', 30, 1]]) lampAlong(a, b, t, sd);
  hydrant(-156, -120); hydrant(-206, -108); hydrant(-194, -74);
  // back entrance sign where the parkway leaves County Rd 12 (the same stone monument as the front gate)
  placeSign(-249, -121, 2.42, { ng: true });   // 2026-11-24: on the outside of the new Co Rd 12 / Estates Pkwy sweeper, facing it
}

// ---------- countryside (2026-11-13): woodlots, hedgerows, fields, fences, the edge tree belt. No buildings. ----------
// Farmland is painted into the default ground (ground.js), so the fields cost no geometry and stay repaintable in the editor.
const FIELDS = [
  { x: 0, z: -200, w: 88, d: 38, ry: 0, kind: 'plow' },          // Sawyer Fields, between Hwy 9 and the farm road
  { x: 128, z: -190, w: 70, d: 48, ry: 0.04, kind: 'wheat' },
  { x: -166, z: -202, w: 52, d: 36, ry: -0.05, kind: 'wheat' },
  { x: 196, z: -62, w: 48, d: 72, ry: 0, kind: 'plow' },          // Dry Creek Flats
  { x: 200, z: 150, w: 60, d: 36, ry: 0.03, kind: 'wheat' },
  { x: 120, z: 270, w: 60, d: 30, ry: 0, kind: 'meadow' },
];
// woodlots [x, z, radius, look]: 'mixed' farm woods, 'pine', 'dark' (the haunted woods' edge)
const WOODLOTS = [
  [-215, -196, 24, 'mixed'], [-110, -200, 17, 'pine'], [196, -160, 28, 'mixed'], [276, -60, 17, 'pine'], [276, 170, 16, 'pine'],
  [168, 206, 20, 'mixed'], [-276, -250, 18, 'pine'],
  [30, -278, 16, 'pine'], [205, 60, 20, 'mixed'],
];
// ---------- Hollow Woods ground detail (2026-11-22): Juniper Creek, the ford, rock outcrops, ravine boulders ----------
/** Point and unit tangent at distance s along a path. */
function pathAt(I, s) {
  let i = 0; while (i < I.L.length - 2 && I.L[i + 1] < s) i++;
  const [ax, az] = I.P[i], [bx, bz] = I.P[i + 1], l = I.L[i + 1] - I.L[i] || 1, t = Math.max(0, Math.min(1, (s - I.L[i]) / l));
  return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / l, (bz - az) / l];
}
/** A draped water ribbon along a path from s0 to s1, in ~4 m pieces (white where it runs steep). */
function waterRibbon(I, s0, s1, w, floorFn) {
  for (let a = s0; a < s1 - 0.5; a += 4) {
    const b = Math.min(s1, a + 4), [cx, cz] = pathAt(I, (a + b) / 2), pos = [], uv = [], rows = [];
    for (let s = a; s <= b + 1e-6; s += (b - a) / 2) {
      const [x, z, tx, tz] = pathAt(I, s), hw = w / 2 * (0.9 + 0.12 * Math.sin(s * 0.31));
      rows.push([x - tz * hw - cx, z + tx * hw - cz, x + tz * hw - cx, z - tx * hw - cz, s]);
    }
    for (let k = 0; k < rows.length - 1; k++) {
      const [lx0, lz0, rx0, rz0, s0_] = rows[k], [lx1, lz1, rx1, rz1, s1_] = rows[k + 1];
      pos.push(lx0, 0, lz0, lx1, 0, lz1, rx0, 0, rz0, rx0, 0, rz0, lx1, 0, lz1, rx1, 0, rz1);
      uv.push(0, s0_ / 5, 0, s1_ / 5, w / 5, s0_ / 5, w / 5, s0_ / 5, 0, s1_ / 5, w / 5, s1_ / 5);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const steep = Math.abs(floorFn(b) - floorFn(a)) / (b - a);
    addS(g, 'creek', steep > 0.5 ? 0xf4f8fa : steep > 0.18 ? 0xd0e2ea : 0x9fbccc, cx, 0.2, cz);
  }
}
function buildWildWoods(R, r) {
  // Juniper Creek, from where it leaves the lake, then down the ravine floor from where it joins
  let s0 = 0; while (s0 < RIV_I.len && inLake(...pathAt(RIV_I, s0).slice(0, 2), 1.0)) s0 += 0.5;
  waterRibbon(RIV_I, s0, RIV_I.len, 3.4, rivFloor);
  const sj = pathProj(-226, 268, RAV_I).s;
  waterRibbon(RAV_I, 0, sj, 2.2, ravFloor);   // a trickle down the upper ravine
  waterRibbon(RAV_I, sj, RAV_I.len, 4.6, ravFloor);
  MAP.push({ t: 'line', col: '#3a3024', w: 12, pts: RAVINE }); MAP.push({ t: 'line', col: '#5a5044', w: 6, pts: RAVINE });
  MAP.push({ t: 'line', col: '#4f86b8', w: 2.6, pts: RIVER }); MAP.push({ t: 'line', col: '#4f86b8', w: 1.6, pts: RAVINE }); MAP.push({ t: 'line', col: '#4f86b8', w: 3.2, pts: RAVINE.filter((p) => pathProj(p[0], p[1], RAV_I).s >= sj - 3) });
  // the ford: flat stepping stones across the creek where the trail crosses
  { const [fx, fz, tx, tz] = pathAt(RIV_I, FORD.s);
    for (let k = -2; k <= 2; k++) {
      const x = fx - tz * k * 1.45 + r(-0.2, 0.2), z = fz + tx * k * 1.45 + r(-0.2, 0.2), sz = r(0.5, 0.65);
      addS(new THREE.CylinderGeometry(sz, sz * 1.15, 0.5, 7), 'plain', 0x8a867c, x, 0.17, z, R() * 6);
      colliders.push({ cx: x, cz: z, r: sz, h: 0.42, top: 0.42, ng: true, nf: true });
    } }
  // rock outcrops wherever the ground is steep (ravine walls, the hills' rock benches, the creek's cut)
  let n = 0;
  for (let z = -40; z < LIMIT - 2 && n < 460; z += 5.5) for (let x = -LIMIT + 2; x < 100 && n < 460; x += 5.5) {
    const px = x + r(-2, 2), pz = z + r(-2, 2), wd = woodsD(px, pz), rv = pathProj(px, pz, RAV_I);
    if (wd < 4 && !(rv && rv.d < 60)) continue;
    const sl = approxSlope(px, pz); if (sl < 0.75 || R() > 0.5) continue;
    const c = pathProj(px, pz, RIV_I);
    if ((c && c.d < 4) || (rv && rv.d < 4.5) || distToPath(px, pz, HOLLOW_TRAIL) < 4 || Math.hypot(px + 121, pz - 84) < 16 || onRoad(px, pz, 2)) continue;
    const e = 1, gx = approxH(px + e, pz) - approxH(px - e, pz), gz = approxH(px, pz + e) - approxH(px, pz - e), ry = Math.atan2(gx, gz) + Math.PI / 2;   // long side along the contour
    const s = r(0.8, 1.4) * (sl > 1.3 ? 1.2 : 1), sink = Math.min(1.2, sl) * 0.45 * s;
    addS(new THREE.DodecahedronGeometry(0.6 * s, 0).scale(r(1.4, 2.0), r(0.7, 1.0), r(0.9, 1.2)), 'plain', [0x6e6a62, 0x77736b, 0x66625a, 0x7e7a70][(R() * 4) | 0], px, 0.3 * s - sink, pz, ry);
    colliders.push({ cx: px, cz: pz, r: 0.8 * s, h: Math.max(0.3, 0.5 * s - sink), top: Math.max(0.3, 0.5 * s - sink), ng: true, nf: true });
    n++;
  }
  // boulders along the ravine floor's edges and the creek's banks
  for (let k = 0; k < 60; k++) {
    const onRav = k < 30, I = onRav ? RAV_I : RIV_I, [px, pz, tx, tz] = pathAt(I, r(onRav ? 6 : 20, I.len - 2)), side = R() < 0.5 ? -1 : 1, off = onRav ? r(2.8, 4.2) : r(2.3, 3.4);
    const x = px - tz * off * side, z = pz + tx * off * side;
    if (Math.max(Math.abs(x), Math.abs(z)) > LIMIT - 2 || distToPath(x, z, HOLLOW_TRAIL) < 3.5) continue;
    const s = r(0.6, onRav ? 1.7 : 1.1);
    addS(new THREE.DodecahedronGeometry(0.6 * s, 0).scale(1.1, 0.75, 1), 'plain', 0x7a766c, x, 0.15 * s, z, R() * 6);
    colliders.push({ cx: x, cz: z, r: 0.6 * s, h: 0.55 * s, top: 0.55 * s, ng: true, nf: true });
  }
}
/** Ground paint for the woods (ground.js calls it once the terrain is built): bare rock on steep ground, dirt on
 *  moderate slopes and in patches, gravel and mud along the creek and the ravine floor. */
function paintWoods(A, B, N, X0, C) {
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = X0 + (i + 0.5) * C, z = X0 + (j + 0.5) * C, k = (j * N + i) * 4;
    const fw = B[k + 2], rv = pathProj(x, z, RAV_I), rr = pathProj(x, z, RIV_I);
    if (fw < 6 && !(rv && rv.d < 45)) continue;
    const [sx, sz] = terSlope(x, z, 1), sl = Math.hypot(sx, sz);
    const n1 = noise2(x / 11 + 4.1, z / 11 - 2.7, 2), n2 = noise2(x / 3.5 - 7.3, z / 3.5 + 1.9, 1);
    const rock = sstep(0.5, 0.9, sl + 0.12 * n2), dirt = Math.max(sstep(0.22, 0.5, sl) * (1 - rock), sstep(0.25, 0.55, n1) * 0.8);
    if (rock > 0) { A[k + 2] = Math.max(A[k + 2], Math.round(215 * rock)); B[k] = Math.max(B[k], Math.round((90 + 60 * (n2 * 0.5 + 0.5)) * rock)); }
    if (dirt > 0) A[k] = Math.max(A[k], Math.round(175 * dirt));
    let f = (1 - 0.9 * rock) * (1 - 0.45 * dirt);
    if (rr && rr.d < 7.5) {   // creek: gravel bed, muddy banks
      const mud = 1 - sstep(4.5, 7.5, rr.d);
      A[k + 3] = Math.max(A[k + 3], Math.round(215 * mud)); if (rr.d < 3) A[k + 2] = Math.max(A[k + 2], 190);
      f *= 1 - 0.9 * mud;
    }
    if (rv && rv.d < 7) {   // ravine floor: gravel and silt
      const fl = 1 - sstep(4, 7, rv.d);
      A[k + 2] = Math.max(A[k + 2], Math.round(200 * fl)); A[k + 3] = Math.max(A[k + 3], Math.round((60 + 90 * (n1 * 0.5 + 0.5)) * fl)); f *= 1 - 0.85 * fl;
    }
    B[k + 2] = Math.round(fw * f);
  }
}
function buildCountry() {
  let seed = 90210; const prev = R;
  R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = (a, b) => a + R() * (b - a);
  const NG = { ng: true };
  buildEstatesWest(); rndSeed.set(2097830750);   // first, so clear() keeps trees out of the new yards; seed: see buildEstates
  const clear = (x, z, m) => !onRoad(x, z, m) && !FIELDS.some((f) => { const c = Math.cos(f.ry), s = Math.sin(f.ry), dx = x - f.x, dz = z - f.z; return Math.abs(dx * c - dz * s) < f.w / 2 + 2 && Math.abs(dx * s + dz * c) < f.d / 2 + 2; })
    && !homes.some((h) => Math.abs(x - h.x) < 12 && Math.abs(z - h.z) < 12)
    && !KEEP_OUT.some((r) => x > r.x0 - 2 && x < r.x1 + 2 && z > r.z0 - 2 && z < r.z1 + 2)
    && distToPath(x, z, HOLLOW_TRAIL) > 3.2 + (m || 0)
    && !badGround(x, z);   // the ravine's walls and the woods' rock faces are bare rock; nothing in the creek
  const look = (kind) => kind === 'pine' ? { kind: 'pine', tint: [0x7a9480, 0x86a088, 0x92a890][(R() * 3) | 0] }
    : kind === 'dark' ? (R() < 0.75 ? { kind: 'pine', tint: 0x7a9480 } : { kind: 'round', tint: 0x8a9a70 })
      : R() < 0.55 ? { kind: 'round', tint: [0xffffff, 0xe8f0c8, 0xd0e0a8, 0xf0d8a0][(R() * 4) | 0] } : { kind: 'pine', tint: 0x9ab09a };
  // woodlots: jittered grid inside a wobbly circle
  for (const [cx, cz, rad, kind] of WOODLOTS) {
    const w0 = R() * 6;
    for (let x = cx - rad; x <= cx + rad; x += 6.2) for (let z = cz - rad; z <= cz + rad; z += 6.2) {
      const jx = x + r(-2.2, 2.2), jz = z + r(-2.2, 2.2), a = Math.atan2(jz - cz, jx - cx);
      if (Math.hypot(jx - cx, jz - cz) > rad * (0.82 + 0.18 * Math.sin(3 * a + w0)) || R() < 0.14 || !clear(jx, jz, 1.2) || Math.max(Math.abs(jx), Math.abs(jz)) > LIMIT - 2) continue;
      tree(jx, jz, r(1.0, 1.7), { ...look(kind), ...NG });
    }
    MAP.push({ t: 'poly', col: '#2e5230', pts: Array.from({ length: 14 }, (_, k) => { const a = (k / 14) * Math.PI * 2; return [cx + Math.cos(a) * rad * (0.85 + 0.15 * Math.sin(3 * a + w0)), cz + Math.sin(a) * rad * (0.85 + 0.15 * Math.sin(3 * a + w0))]; }) });
  }
  // Hollow Woods, expanded (2026-11-13, diet's markup): the haunted woods now cover the whole south-west, west of Old Mill Rd.
  // Deep-forest trees are the cheap 'lite' kind; the floor is painted (FOREST_FLOOR in ground.js default paint).
  for (let x = -LIMIT + 2; x < 90; x += 6.6) for (let z = -24; z < LIMIT - 1; z += 6.6) {
    const jx = x + r(-2.6, 2.6), jz = z + r(-2.6, 2.6);
    if (!inWoods(jx, jz) || oldWoods(jx, jz) || Math.max(Math.abs(jx), Math.abs(jz)) > LIMIT - 2) continue;
    const glade = Math.sin(jx * 0.045 + 1.3) * Math.sin(jz * 0.052 - 0.7);    // a few open glades
    if (glade > 0.72 || R() < 0.12 || R() > 0.25 + 0.75 * Math.min(1, woodsD(jx, jz) / 9) || !clear(jx, jz, 1.4)) continue;
    const q = R(), sc = r(1.15, 1.9);
    if (q < 0.17) deadTree0(jx, jz, sc * 0.85, { ...NG, lite: true });
    else tree(jx, jz, sc, { ...(q < 0.88 ? { kind: 'pine', tint: [0x7a9480, 0x6e8a76, 0x86a088][(R() * 3) | 0] } : { kind: 'round', tint: 0x8a9a70 }), ...NG, lite: true });
  }
  // the woods on the map: row runs of 2 m cells (follows the ragged edge)
  for (let z = -60; z < LIMIT; z += 2) { let x0 = null;
    for (let x = -LIMIT; x <= 104; x += 2) { const inn = x < 104 && inWoods(x + 1, z + 1);
      if (inn && x0 === null) x0 = x; else if (!inn && x0 !== null) { MAP.push({ t: 'rect', x: (x0 + x) / 2, z: z + 1, w: x - x0 + 0.4, d: 2.4, ry: 0, col: '#1f3a24' }); x0 = null; } } }
  // stray trees and bushes out in the grass, thinning out away from the edge
  const blds = colliders.filter((c) => c.bld);
  const nearBld = (x, z, r) => blds.some((c) => (c.x0 !== undefined ? Math.max(c.x0 - x, x - c.x1, c.z0 - z, z - c.z1) : Math.hypot(x - c.cx, z - c.cz) - (c.r || 0)) < r);
  for (let k = 0; k < 2600; k++) {
    const x = r(-LIMIT + 4, 100), z = r(-60, LIMIT - 4), d = woodsD(x, z);
    if (d >= 0 || d < -18) continue;
    const q = 1 + d / 18; if (R() > q * q * 0.55) continue;
    if (!clear(x, z, 1.6) || inLake(x, z, 1.3) || nearBld(x, z, 7) || Math.hypot(x - places.spawn.x, z - places.spawn.z) < 14) continue;
    const u = R();
    if (u < 0.3) bush(x, z, r(1.0, 1.6), 0x90b880);
    else tree(x, z, r(1.0, 1.6), { ...(u < 0.75 ? { kind: 'pine', tint: [0x7a9480, 0x86a088][(R() * 2) | 0] } : { kind: 'round', tint: 0x9aaa78 }), ...NG });
  }
  // the old RV-to-well trail grows back over (the town's forest builder still keeps its line clear)
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [ax, az] = TRAIL[i], [bx, bz] = TRAIL[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < L; t += 4.2) {
      const x = ax + (bx - ax) * t / L + r(-1.6, 1.6), z = az + (bz - az) * t / L + r(-1.6, 1.6);
      if (woodsD(x, z) < 3 || Math.hypot(x + 134, z - 82) < 10 || Math.hypot(x - bx - 2, z - bz - 2) < 5 || Math.hypot(x - places.spawn.x, z - places.spawn.z) < 16 || !clear(x, z, 1.2)) continue;
      if (R() < 0.2) deadTree0(x, z, r(1, 1.4), { ...NG, lite: true }); else tree(x, z, r(1.1, 1.7), { kind: 'pine', tint: 0x7a9480, ...NG, lite: true });
    }
  }
  buildWildWoods(R, r);
  // trailheads
  for (const [x, z, ry] of [[19, 56, Math.PI * 0.85], [-139, 74, Math.PI * 0.3]]) {
    const F = frame(x, z, ry);
    for (const sx of [-0.7, 0.7]) { F.box(sx, 0.75, 0, 0.12, 1.5, 0.12, 'wood', 0xffffff); }
    F.post(0, 0, 0.5, 1.6);
    F.sign('HOLLOW WOODS TRAIL', '#5a3e22', '#f0e0b0', 1.8, 0.45, 1.3, 0.08, { double: true });
  }
  for (let k = 0; k < 30; k++) { const x = r(-290, 60), z = r(0, 290); if (inWoods(x, z) && !oldWoods(x, z) && clear(x, z, 1.5)) { rock(x, z, r(0.6, 1.4), 0x6a6a64); colliders[colliders.length - 1].ng = true; } }
  // hedgerows: a line of trees with bushes between, along field edges and lanes
  const HEDGES = [[[-62, -176], [44, -176]], [[160, -150], [232, -150]], [[166, 20], [166, 82]], [[112, 222], [210, 214]]];
  for (const [[ax, az], [bx, bz]] of HEDGES) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 4.5);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t + r(-0.8, 0.8), z = az + (bz - az) * t + r(-0.8, 0.8);
      if (!clear(x, z, 1)) continue;
      if (k % 2 === 0 && R() < 0.8) tree(x, z, r(1.0, 1.5), { ...look('mixed'), ...NG }); else bush(x, z, r(1.1, 1.7), 0xa0d090);
    }
  }
  // split-rail fences along the fields that face a road, with a gate gap; hay bales on the cut fields
  // breakables (2026-11-27): each rail line is cut into two-span sections, each its own breakable group; `own` keeps every
  // piece anchored on the ground under itself (the fields roll), so the sections still follow the hills
  const RAILC = { brk: 'fence', fk: 'farmrail', fc: 0xd8c4a8, own: true };
  const rail = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 3.2)), ry = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; if (!onRoad(x, z, 0.4)) addS(new THREE.BoxGeometry(0.16, 1.25, 0.16), 'wood', 0xc8b49a, x, 0.62, z, ry); }
    for (let k = 0; k < n; k += 2) {
      const e = Math.min(n, k + 2), sx = ax + (bx - ax) * k / n, sz = az + (bz - az) * k / n, ex = ax + (bx - ax) * e / n, ez = az + (bz - az) * e / n, l = L * (e - k) / n;
      for (const y of [0.55, 1.05]) addS(new THREE.BoxGeometry(0.09, 0.12, l), 'wood', 0xd8c4a8, (sx + ex) / 2, y, (sz + ez) / 2, ry);
      colBox((sx + ex) / 2, (sz + ez) / 2, 0.3, l, 1.2, ry, { ...RAILC, seg: [sx, sz, ex, ez] });
    }
  };
  // a galvanised five-bar farm gate, shut, hung between two stout posts
  const farmGate = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ux = (bx - ax) / L, uz = (bz - az) / L;
    for (const [x, z] of [[ax, az], [bx, bz]]) addS(new THREE.BoxGeometry(0.2, 1.4, 0.2), 'wood', 0xb8a488, x, 0.7, z, ry);
    const leaf = L - 0.3;
    for (let k = 0; k < 5; k++) addS(new THREE.BoxGeometry(0.05, 0.05, leaf), 'metal', 0xc4c8cc, mx, 0.28 + k * 0.2, mz, ry);
    for (const t of [-leaf / 2, leaf / 2]) addS(new THREE.BoxGeometry(0.06, 0.9, 0.06), 'metal', 0xc4c8cc, mx + ux * t, 0.66, mz + uz * t, ry);
    addS(new THREE.BoxGeometry(0.04, 0.04, Math.hypot(leaf, 0.8)).rotateX(-Math.atan2(0.8, leaf)), 'metal', 0xc4c8cc, mx, 0.68, mz, ry);
    colBox(mx, mz, 0.3, L, 1.2, ry, { brk: 'gate', fk: 'farmgate', fc: 0xc4c8cc, own: true, seg: [ax, az, bx, bz] });
  };
  for (const f of FIELDS) {
    const c = Math.cos(f.ry), s = Math.sin(f.ry), P = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
    const hw = f.w / 2 + 1.2, hd = f.d / 2 + 1.2;
    // the two long sides, each in 3 runs; skip any run that touches a road
    for (const sd of [-1, 1]) {
      const built = [];
      for (let q = 0; q < 3; q++) {
        const x0 = -hw + q * (2 * hw / 3) + (q ? 2 : 0), x1 = -hw + (q + 1) * (2 * hw / 3) - (q < 2 ? 2 : 0);
        const [ax, az] = P(x0, sd * hd), [bx, bz] = P(x1, sd * hd);
        if (onRoad(ax, az, 1) || onRoad(bx, bz, 1) || onRoad((ax + bx) / 2, (az + bz) / 2, 1)) continue;
        rail(ax, az, bx, bz); built[q] = true;
      }
      // the first gap gets a gate (shut); the second stays open
      if (built[0] && built[1]) { const g0 = -hw + 2 * hw / 3 - 2, [ax, az] = P(g0, sd * hd), [bx, bz] = P(g0 + 4, sd * hd); if (!onRoad((ax + bx) / 2, (az + bz) / 2, 1)) farmGate(ax, az, bx, bz); }
    }
    if (f.kind !== 'plow') for (let k = 0; k < 5 + ((R() * 4) | 0); k++) { const [x, z] = P(r(-f.w / 2 + 4, f.w / 2 - 4), r(-f.d / 2 + 4, f.d / 2 - 4)); hay(x, z, r(0, 3.1)); colliders[colliders.length - 1].ng = true; }
    MAP.push({ t: 'rect', x: f.x, z: f.z, w: f.w, d: f.d, ry: f.ry, col: f.kind === 'plow' ? '#7a6248' : f.kind === 'wheat' ? '#a8a058' : '#6f8a46' });
  }
  // fieldstones
  for (let k = 0; k < 40; k++) { const x = r(-LIMIT + 10, LIMIT - 10), z = r(-LIMIT + 10, LIMIT - 10); if (inTown(x, z) || !clear(x, z, 1.5)) continue; rock(x, z, r(0.5, 1.4), 0x8a8a84); colliders[colliders.length - 1].ng = true; }
  // the edge: a belt of tall pines just past the invisible wall (no colliders, nobody gets there), on the land rolling up
  for (const side of [0, 1, 2, 3]) for (let t = -LIMIT - 16; t <= LIMIT + 16; t += 6.5) {
    for (const row of [0, 1]) {
      if (row && R() < 0.35) continue;
      const d = LIMIT + 5 + row * 7 + r(-1.5, 1.5), u = t + r(-2, 2) + row * 3.2;
      const [x, z] = side === 0 ? [u, -d] : side === 1 ? [d, u] : side === 2 ? [u, d] : [-d, u];
      tree0(x, z, r(1.5, 2.1), { kind: 'pine', tint: [0x7a9480, 0x86a088, 0x92a890][(R() * 3) | 0], nocol: true });
    }
  }
  // road name signs where County Rd 12 meets the town roads
  const post = (x, z, ry, text) => {
    [x, z] = offRoad(x, z, 0.6); const F = frame(x, z, ry);
    F.box(0, 1.2, 0, 0.1, 2.4, 0.1, 'metal', 0x9a9a9a); F.post(0, 0, 0.08, 2.4);
    F.sign(text, '#1f6a3a', '#ffffff', 1.9, 0.38, 2.3, 0.06, { tw: 256, th: 48, double: true });
  };
  for (const [k, o, text] of [['HNJ', 1, 'CO RD 12'], ['HEJ', -1, 'CO RD 12'], ['OMJ', 1, 'CO RD 12'], ['SN', 1, 'SAWYER FARM RD'], ['PE', 1, 'HOLLOW LN'], ['GW1', -1, 'ESTATES PKWY']]) {
    const Q = NODES[N[k]]; post(Q.x + o * 9, Q.z + 8, 0.6 * o, text);
  }
  R = prev;
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
  }
  // lines last, over the woods and lots: the ravine and the Hollow Woods Trail (light dashed dirt so it reads on the dark woods)
  for (const m of MAP) if (m.t === 'line') {
    const trail = m.col === '#8a7050';
    g.strokeStyle = trail ? '#e0c088' : m.col; g.lineWidth = Math.max(m.w, trail ? 3.2 : 0) * s; g.lineCap = g.lineJoin = 'round';
    if (trail) g.setLineDash([3.5 * s, 2 * s]);
    g.beginPath(); m.pts.forEach(([x, z], i) => (i ? g.lineTo(o(x), o(z)) : g.moveTo(o(x), o(z)))); g.stroke(); g.setLineDash([]);
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
  let hit = false, nx = 0, nz = 0, hc = null;
  const list = nearby(x, z, r + 1.5); // P13: iterate the shared scratch list directly (nothing below calls nearby)
  for (let it = 0; it < 2; it++) for (let i = 0; i < list.length; i++) { const c = list[i];
    if (c.rg ? y >= roofTop(c, x, z) - 0.45 : y >= (c.top ?? c.h ?? 5) - 0.02) continue; // engine: standing on top of it (rooftops: roofs step like stairs)
    if (c.water && o && o.swim) continue;  // gameplay: the player can swim, cars and peds stay out
    if (c.r !== undefined) {
      const dx = x - c.cx, dz = z - c.cz, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-6) { x = c.cx + dx / d * m; z = c.cz + dz / d * m; hit = true; hc = c; nx = dx / d; nz = dz / d; }
    } else if (c.poly) {
      if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue;
      const q = polyNear(c.poly, x, z);
      if (!q.inside && q.d >= r) continue;
      if (q.d < 1e-6) continue;
      const s = q.inside ? -1 : 1, ux = (x - q.qx) / q.d * s, uz = (z - q.qz) / q.d * s;
      x = q.qx + ux * r; z = q.qz + uz * r; nx = ux; nz = uz; hit = true; hc = c;
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
      nx = nlx * c.c + nlz * c.s; nz = -nlx * c.s + nlz * c.c; hit = true; hc = c;
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
      hit = true; hc = c;
    }
  }
  return { x, z, hit, nx, nz, hc };
}

/** engine: the top of the highest solid thing under x,z the player can stand on from height y (steps up 0.5 m).
 *  Every collider is standable (benches, slides, cars of stone, roofs if you can jump that high); water is not. */
/** engine: breakable props (street lamps, hydrants, fence sections, gates) whose collider overlaps a circle. Returns engine colliders. */
export function breakablesNear(x, z, r) {
  const out = [];
  for (const c of nearby(x, z, r + 0.5)) {
    if (!(c.brk || (c._m && c._m.orig.brk))) continue;
    if (c.r !== undefined) { if (Math.hypot(x - c.cx, z - c.cz) < c.r + r) out.push(c); continue; }
    // fence sections + gates (boxes, axis-aligned or rotated)
    let d;
    if (c.ob) { const dx = x - c.cx, dz = z - c.cz, lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c; d = Math.hypot(Math.max(0, Math.abs(lx) - c.hw), Math.max(0, Math.abs(lz) - c.hd)); }
    else if (c.x0 !== undefined) d = Math.hypot(Math.max(0, c.x0 - x, x - c.x1), Math.max(0, c.z0 - z, z - c.z1));
    else continue;
    if (d < r) out.push(c);
  }
  return out;
}
export function colTop(x, z, y) {
  let best = 0;
  for (const c of nearby(x, z, 0.1)) {
    const top = c.rg ? roofTop(c, x, z) : c.top ?? c.h ?? 5;   // rooftops
    if (c.water || top <= best || top > y + 0.5) continue;
    let inside;
    if (c.r !== undefined) inside = Math.hypot(x - c.cx, z - c.cz) < (c.pr ?? c.r);   // climb: pr = a tree's canopy perch
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
    if (y > (c.rg ? roofTop(c, x, z) : c.h ?? 5) || c.water) continue;
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
