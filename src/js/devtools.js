// Dev tools: debug overlays and the in-game world editor, in tabs:
//   View      overlays (colliders, entities, road graph, lights, terrain grid, labels) + stats
//   Terrain   raise / lower / smooth / flatten brushes, push-pull (drag up = hill, sideways = wider), hills slider
//   Ground    paint grass, dirt, sand, gravel, mud, asphalt, concrete, forest floor, dry grass; draw / reshape water
//   Roads     drag road points, draw new roads, connect, split, delete, change width / type (paved, dirt, highway)
//   Lights    move any light (street lamps, porch lights, signs...), place new ones: color, brightness, height, glow
//   Objects   select world objects and props, drag to move, handles to scale / turn, place props and your own builds
//   Colliders select single colliders, handles to resize / turn / change height, add new ones
//   Build     make your own objects from parts (box, cylinder, cone, sphere, roof, slab), place them anywhere
//   Save      save status, undo, play from here
// Edits are saved to the artifact's database ("saved to Claude"): docs world/terrain, world/edits (incl. roads) and world/ground.
// F2 opens the panel, F3 toggles edit mode. On touch: the DEV button, or WORLD EDITOR on the title screen.
import * as THREE from 'three';
import * as TER from './terrain.js';
import { NODES, EDGES, districtAt } from './world.js';
import * as RD from './roads.js';
import * as GR from './ground.js';

const STYLE = `
#devbtn{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:40;font:16px VT323,monospace;padding:2px 10px;background:rgba(10,12,20,.7);color:#9fe0ff;border:1px solid #3a5a7a;border-radius:4px;cursor:pointer}
body.titled #devbtn{display:none}
#dev{position:fixed;top:8px;left:8px;bottom:8px;width:min(320px,calc(100vw - 16px));z-index:45;display:none;flex-direction:column;background:rgba(10,12,20,.92);border:1px solid #44506a;border-radius:6px;color:#e8e4d8;font:13px/1.3 ui-monospace,Menlo,Consolas,monospace;user-select:none;-webkit-user-select:none;touch-action:pan-y}
#dev.open{display:flex} #dev.min{bottom:auto} #dev.min .dv-body,#dev.min .dv-tabs,#dev.min .save{display:none}
#dev .dv-head{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #33405a;cursor:pointer}
#dev .dv-head b{flex:1;color:#9fe0ff;font-weight:600}
#dev .dv-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:4px 6px 0;border-bottom:1px solid #33405a}
#dev .dv-tabs button{border-radius:4px 4px 0 0;border-bottom:none;background:#141a28;min-height:28px;padding:3px 7px;font-size:12px}
#dev .dv-tabs button.on{background:#2d5a8a;color:#fff}
#dev .dv-body{overflow-y:auto;padding:6px 8px 10px;flex:1}
#dev h4{margin:10px 0 4px;font-size:11px;letter-spacing:.08em;color:#8a96b0;text-transform:uppercase;font-weight:600}
#dev label{display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer}
#dev input[type=checkbox]{width:16px;height:16px;margin:0}
#dev input[type=range]{flex:1;min-width:60px}
#dev input[type=number],#dev input[type=text],#dev select{width:64px;background:#141a28;color:#fff;border:1px solid #3a4660;border-radius:3px;padding:2px 4px;font:inherit}
#dev input[type=text]{width:100%} #dev select{width:auto}
#dev input[type=color]{width:40px;height:26px;padding:0;border:1px solid #3a4660;background:none}
#dev button{font:inherit;background:#1c2436;color:#e8e4d8;border:1px solid #3a4660;border-radius:4px;padding:5px 8px;cursor:pointer;min-height:30px}
#dev button.on{background:#2d5a8a;border-color:#6ab0ff;color:#fff}
#dev button.warn{border-color:#8a4040;color:#ffb0a0}
#dev .row{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0}
#dev .grid2{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:4px 6px;align-items:center}
#dev .muted{color:#8a96b0;font-size:12px}
#dev .stat{font-size:12px;color:#b8c4dc;white-space:pre-wrap}
#dev .list button{text-align:left}
#dev .save{padding:6px 8px;border-top:1px solid #33405a;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#dev .save span{flex:1;font-size:12px}
#devlabels{position:fixed;inset:0;pointer-events:none;z-index:30;overflow:hidden}
#devlabels div{position:absolute;transform:translate(-50%,-100%);font:11px ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.55);padding:0 3px;border-radius:2px;white-space:nowrap}
#devhint{position:fixed;right:8px;bottom:8px;z-index:40;font:12px ui-monospace,monospace;color:#cfd8ea;background:rgba(10,12,20,.75);padding:6px 8px;border-radius:4px;display:none;max-width:360px}
body.deved #hud,body.deved #touchui{display:none!important}
body.deved #devhint{display:block}
@media (pointer:coarse){#devhint{display:none!important}
#dev{top:auto;left:6px;right:6px;bottom:6px;width:auto;max-height:48vh;font-size:12px}
#dev.min{bottom:6px;top:auto}
#dev h4{margin:6px 0 2px}
#dev button{min-height:34px;padding:4px 8px}}
`;

const PROPS = {
  pine: { label: 'Pine tree', col: { kind: 'circle', r: 0.4, h: 6 } },
  oak: { label: 'Round tree', col: { kind: 'circle', r: 0.4, h: 6 } },
  dead: { label: 'Dead tree', col: { kind: 'circle', r: 0.35, h: 6 } },
  bush: { label: 'Bush', col: null },
  rock: { label: 'Rock', col: { kind: 'circle', r: 0.55, h: 0.7 } },
  boulder: { label: 'Boulder', col: { kind: 'circle', r: 1.4, h: 1.8 } },
  lamp: { label: 'Street lamp', col: { kind: 'circle', r: 0.2, h: 6 } },
  barrel: { label: 'Barrel', col: { kind: 'circle', r: 0.33, h: 1 } },
  hay: { label: 'Hay bale', col: { kind: 'box', w: 1.3, d: 1.5, h: 1.4 } },
  crate: { label: 'Crate', col: { kind: 'box', w: 1, d: 1, h: 1 } },
  fence: { label: 'Fence (4 m)', col: { kind: 'box', w: 4, d: 0.3, h: 1.2 } },
  wall: { label: 'Wall (4 m)', col: { kind: 'box', w: 4, d: 0.4, h: 2.2 } },
  bench: { label: 'Bench', col: { kind: 'box', w: 1.8, d: 0.6, h: 1 } },
};
const SHAPES = { box: 'Box', cyl: 'Cylinder', cone: 'Cone', sphere: 'Sphere', roof: 'Roof', slab: 'Slab' };
const MATS = ['plain', 'brick', 'siding', 'wood', 'metal', 'shingle', 'fence', 'window', 'door', 'garage', 'leaves', 'bark', 'dirt', 'sidewalk', 'asphalt', 'grass', 'lamp'];
const TABS = [['view', 'View'], ['terrain', 'Terrain'], ['ground', 'Ground'], ['roads', 'Roads'], ['objects', 'Objects'], ['lights', 'Lights'], ['colliders', 'Colliders'], ['build', 'Build'], ['save', 'Save']];
const TAB_TOOL = { view: 'none', terrain: 'raise', ground: 'paint', roads: 'select', objects: 'select', lights: 'select', colliders: 'select', build: 'build', save: 'none' };
const TAB_KEYS = { 1: 'view', 2: 'terrain', 3: 'ground', 4: 'roads', 5: 'objects', 6: 'lights', 7: 'colliders', 8: 'build', 9: 'save' };
const LPRESETS = {
  bulb: { label: 'Warm bulb', c: 0xffd8a8, i: 1, y: 3, g: 2.5 },
  porch: { label: 'Porch light', c: 0xffd090, i: 0.7, y: 2.7, g: 1.6 },
  street: { label: 'Street light', c: 0xffd8a8, i: 1, y: 5.4, g: 3.2 },
  cool: { label: 'Cool white', c: 0xd8e4ff, i: 1, y: 4, g: 2.5 },
  neon: { label: 'Neon blue', c: 0x60b0ff, i: 1.4, y: 3.5, g: 4, a: 1 },
  fire: { label: 'Fire / torch', c: 0xff9a40, i: 0.6, y: 1.5, g: 2, a: 1, f: 1 },
};
const RTYPES = [['paved', 'Paved'], ['dirt', 'Dirt'], ['hwy', 'Highway'], ['path', 'Trail'], ['walk', 'Walkway']];
const BRUSH = ['raise', 'lower', 'smooth', 'flatten', 'pull'];

export function makeDev(o) {
  const { scene, camera, canvas, G, P, cars, peds, pickups, marks, WM, lights, setClock, toast } = o;
  // Share build (tools/share-build.mjs): the saved world is baked in as window.__MG_SHARE and every dev tool is hidden.
  const SHARE = window.__MG_SHARE || null;
  const haloS = o.haloSprites || [], poolMesh = o.pools || null;
  const $ = (s, r = document) => r.querySelector(s);
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
  const coarse = matchMedia('(pointer: coarse)').matches;

  // ---------------- state ----------------
  const view = { cols: true, ents: true, roads: false, lights: false, grid: false, labels: true };
  try { Object.assign(view, JSON.parse(localStorage.getItem('mg-dev-view') || '{}')); } catch (e) { /* storage blocked */ }
  const S = {
    open: false, editing: false, tab: 'view', tool: 'none', sel: null, hoverPt: null,
    brush: { r: 8, s: 0.5 }, prop: 'pine', colShape: 'box', fromTitle: false, min: false,
    bp: null, part: -1, lpre: 'bulb', layer: 'dirt', roadType: 'paved', roadW: 10, roadLast: -1, vtx: -1, drawPts: null,
  };
  const cam = { x: P.x, z: P.z, yaw: Math.PI * 0.75, pitch: 0.75, dist: 45 };
  const props = [];   // placed props: { id, type, x, z, r, s, mesh, col }
  const bps = {};     // your own builds: id -> { name, solid, parts: [{ sh, key, col, x, y, z, w, h, d, ry }] }
  let uid = Date.now() % 100000;
  const nid = () => (uid++).toString(36) + Math.floor(Math.random() * 36).toString(36);

  // ---------------- materials + geometry for props / builds ----------------
  const clean = (k) => (WM[k] && (WM[k].userData.clean || WM[k])) || (WM.plain && (WM.plain.userData.clean || WM.plain)) || new THREE.MeshLambertMaterial({ vertexColors: true });
  const tint = (g, c) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  function part(grp, geo, key, color, x, y, z, ry = 0) { const m = new THREE.Mesh(tint(geo, color), clean(key)); m.position.set(x, y, z); m.rotation.y = ry; grp.add(m); return m; }
  function worldUV(g, scale = 0.5) {
    const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal; if (!uv || !nor) return g;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      if (ny > 0.7) uv.setXY(i, px * scale, pz * scale); else if (nx > 0.7) uv.setXY(i, pz * scale, py * scale); else uv.setXY(i, px * scale, py * scale);
    }
    return g;
  }
  function gable(w, h, d) {
    const x = w / 2, z = d / 2;
    const Pp = [[-x, 0, z], [x, 0, z], [x, h, 0], [-x, 0, z], [x, h, 0], [-x, h, 0], [x, 0, -z], [-x, 0, -z], [-x, h, 0], [x, 0, -z], [-x, h, 0], [x, h, 0], [-x, 0, -z], [-x, 0, z], [-x, h, 0], [x, 0, z], [x, 0, -z], [x, h, 0], [-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, -z], [x, 0, z], [-x, 0, z]];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Pp.flat(), 3));
    const sl = Math.hypot(z, h);
    g.setAttribute('uv', new THREE.Float32BufferAttribute([[0, 0], [w, 0], [w, sl], [0, 0], [w, sl], [0, sl], [0, 0], [w, 0], [w, sl], [0, 0], [w, sl], [0, sl], [0, 0], [d, 0], [d / 2, h], [0, 0], [d, 0], [d / 2, h], [0, 0], [w, 0], [w, d], [0, 0], [w, d], [0, d]].flat().map((v) => v * 0.5), 2));
    g.computeVertexNormals(); return g;
  }
  function partGeo(pt) {
    const w = Math.max(0.02, pt.w), h = Math.max(0.02, pt.h), d = Math.max(0.02, pt.d);
    let g;
    if (pt.sh === 'cyl') { g = new THREE.CylinderGeometry(0.5, 0.5, 1, 14); g.scale(w, h, d); g.translate(0, h / 2, 0); }
    else if (pt.sh === 'cone') { g = new THREE.ConeGeometry(0.5, 1, 14); g.scale(w, h, d); g.translate(0, h / 2, 0); }
    else if (pt.sh === 'sphere') { g = new THREE.SphereGeometry(0.5, 14, 10); g.scale(w, h, d); g.translate(0, h / 2, 0); }
    else if (pt.sh === 'roof') g = gable(w, h, d);
    else if (pt.sh === 'slab') { g = new THREE.BoxGeometry(w, Math.min(h, 0.12), d); g.translate(0, Math.min(h, 0.12) / 2, 0); worldUV(g); }
    else { g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); worldUV(g); }
    return g;
  }
  function buildProp(type) {
    const g = new THREE.Group();
    if (type.startsWith('bp:')) {
      const bp = bps[type.slice(3)];
      if (bp) bp.parts.forEach((pt, i) => { const m = part(g, partGeo(pt), pt.key, pt.col, pt.x, pt.y, pt.z, pt.ry || 0); m.userData.part = i; });
      if (!g.children.length) part(g, new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(0, 0.25, 0), 'plain', 0xff00ff, 0, 0, 0);
    } else if (type === 'pine' || type === 'oak') {
      part(g, new THREE.CylinderGeometry(0.16, 0.26, 2.2, 7), 'bark', 0xffffff, 0, 1.1, 0);
      if (type === 'oak') { part(g, new THREE.IcosahedronGeometry(1.7, 1), 'leaves', 0xffffff, 0, 3.2, 0); part(g, new THREE.IcosahedronGeometry(1.2, 1), 'leaves', 0xdfffd0, 0.4, 4.3, -0.2); }
      else { part(g, new THREE.ConeGeometry(1.8, 2.6, 9), 'leaves', 0xc8e8c0, 0, 3.0, 0); part(g, new THREE.ConeGeometry(1.3, 2.2, 9), 'leaves', 0xe0ffd8, 0, 4.3, 0); }
    } else if (type === 'dead') {
      part(g, new THREE.CylinderGeometry(0.12, 0.3, 4.2, 6), 'bark', 0x9a9690, 0, 2.1, 0);
      for (let k = 0; k < 4; k++) { const len = 1.6 + k * 0.3, b = new THREE.CylinderGeometry(0.04, 0.09, len, 5); b.translate(0, len / 2, 0); b.rotateZ(0.7 + k * 0.1); b.rotateY(k * 1.7); part(g, b, 'bark', 0x8a8680, 0, 2.2 + k * 0.5, 0); }
    } else if (type === 'bush') part(g, new THREE.IcosahedronGeometry(0.7, 1), 'leaves', 0xb0e0a0, 0, 0.45, 0);
    else if (type === 'rock') part(g, new THREE.DodecahedronGeometry(0.6, 0).scale(1, 0.6, 1), 'plain', 0x8a8a84, 0, 0.2, 0);
    else if (type === 'boulder') part(g, new THREE.DodecahedronGeometry(1.5, 0).scale(1, 0.7, 1), 'plain', 0x7a7a74, 0, 0.6, 0);
    else if (type === 'lamp') {
      part(g, new THREE.CylinderGeometry(0.32, 0.38, 0.5, 8), 'plain', 0x8a8a86, 0, 0.25, 0);
      part(g, new THREE.CylinderGeometry(0.07, 0.11, 6, 8), 'metal', 0xb8bcc4, 0, 3, 0);
      part(g, new THREE.BoxGeometry(0.09, 0.09, 2.0), 'metal', 0xb8bcc4, 0, 6, 0.5);
      part(g, new THREE.BoxGeometry(0.42, 0.14, 0.7), 'metal', 0xc8ccd4, 0, 5.95, 1.0);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); bulb.position.set(0, 5.87, 1.0); g.add(bulb);
    } else if (type === 'barrel') part(g, new THREE.CylinderGeometry(0.32, 0.32, 1, 10), 'plain', 0xff7a1a, 0, 0.5, 0);
    else if (type === 'hay') part(g, new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12).rotateZ(Math.PI / 2), 'plain', 0xd8b860, 0, 0.75, 0);
    else if (type === 'crate') part(g, new THREE.BoxGeometry(1, 1, 1), 'wood', 0xd0b080, 0, 0.5, 0);
    else if (type === 'fence') part(g, new THREE.BoxGeometry(4, 1.2, 0.1), 'fence', 0xffffff, 0, 0.6, 0);
    else if (type === 'wall') part(g, new THREE.BoxGeometry(4, 2.2, 0.4), 'plain', 0xb0aca4, 0, 1.1, 0);
    else if (type === 'bench') { part(g, new THREE.BoxGeometry(1.8, 0.08, 0.5), 'wood', 0xffffff, 0, 0.5, 0); part(g, new THREE.BoxGeometry(1.8, 0.5, 0.08), 'wood', 0xffffff, 0, 0.8, -0.25); }
    g.userData.lift = true;
    return g;
  }
  const propLabel = (type) => (type.startsWith('bp:') ? (bps[type.slice(3)] ? bps[type.slice(3)].name : 'missing build') : PROPS[type] ? PROPS[type].label : type);
  /** Collider of a build in its own space: the footprint box of its parts. */
  function bpCol(bp) {
    if (!bp || bp.solid === false || !bp.parts.length) return null;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0;
    for (const p of bp.parts) {
      const c = Math.abs(Math.cos(p.ry || 0)), s = Math.abs(Math.sin(p.ry || 0)), ex = (p.w * c + p.d * s) / 2, ez = (p.w * s + p.d * c) / 2;
      x0 = Math.min(x0, p.x - ex); x1 = Math.max(x1, p.x + ex); z0 = Math.min(z0, p.z - ez); z1 = Math.max(z1, p.z + ez); h = Math.max(h, p.y + p.h);
    }
    return { kind: 'box', lx: (x0 + x1) / 2, lz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h };
  }
  function colDef(type) { return type.startsWith('bp:') ? bpCol(bps[type.slice(3)]) : PROPS[type] ? PROPS[type].col : null; }
  function placeProp(p) {
    p.mesh = buildProp(p.type); scene.add(p.mesh);
    p.col = { id: 'prop:' + p.id, q: {}, prop: p, flags: { prop: true } };
    if (p.type === 'lamp') { p.light = { x: 0, y: 5.4, z: 0, c: 0xffd8a8, i: 1 }; lights.push(p.light); p.halo = makeHalo(0xc8a8ff, 3.2); }
    props.push(p); syncProp(p); return p;
  }
  function syncProp(p) {
    p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.r; p.mesh.scale.setScalar(p.s || 1);
    const d = colDef(p.type), s = p.s || 1, i = TER.extraCols.indexOf(p.col);
    if (d) {
      const lx = (d.lx || 0) * s, lz = (d.lz || 0) * s, c = Math.cos(p.r), sn = Math.sin(p.r), cx = p.x + lx * c + lz * sn, cz = p.z - lx * sn + lz * c;
      p.col.q = d.kind === 'circle' ? { kind: 'circle', cx, cz, r: d.r * s, h: d.h * s } : { kind: 'box', cx, cz, w: d.w * s, d: d.d * s, rot: p.r, h: d.h * s };
      if (i < 0) TER.extraCols.push(p.col);
    } else if (i >= 0) TER.extraCols.splice(i, 1);
    if (p.light) { p.light.x = p.x + Math.sin(p.r) * s; p.light.z = p.z + Math.cos(p.r) * s; p.light.y = 5.4 * s; }
    if (p.halo) { p.halo.position.set(p.light.x, p.light.y + 0.4, p.light.z); p.halo.scale.setScalar(3.2 * s); }
    lightsChanged();
  }
  function rebuildPropMesh(p) { scene.remove(p.mesh); p.mesh = buildProp(p.type); scene.add(p.mesh); syncProp(p); }
  function removeProp(p) {
    scene.remove(p.mesh); props.splice(props.indexOf(p), 1);
    const i = TER.extraCols.indexOf(p.col); if (i >= 0) TER.extraCols.splice(i, 1);
    if (p.light) lights.splice(lights.indexOf(p.light), 1);
    if (p.halo) dropHalo(p.halo);
    lightsChanged();
  }
  function refreshBp(id) { for (const p of props) if (p.type === 'bp:' + id) rebuildPropMesh(p); TER.applyColliders(); dirtyOverlay(); }

  // ---------------- lights ----------------
  // Original lights are the ones the map built (identified by their index then). Each gets its nearby glow sprite.
  // Moving one by hand detaches it from the building it belonged to. Added lights live in `addedLights`.
  const ORIG = lights.slice(), ORIGV = ORIG.map((L) => ({ x: L.x, y: L.y, z: L.z, c: L.c, i: L.i, always: !!L.always, flicker: !!L.flicker }));
  const lightHalo = new Map(), usedS = new Set();
  for (const L of ORIG) {
    let best = null, bd = 1.6;
    for (const sp of haloS) { if (usedS.has(sp)) continue; const d = Math.hypot(sp.position.x - L.x, sp.position.z - L.z); if (d < bd && Math.abs(sp.position.y - L.y) < 2.5) { bd = d; best = sp; } }
    if (best) { usedS.add(best); lightHalo.set(L, { sp: best, dx: best.position.x - L.x, dy: best.position.y - L.y, dz: best.position.z - L.z, tg: best.userData.tg, s0: best.scale.x, s: best.scale.x, mat0: best.material, x0: best.position.x, y0: best.position.y, z0: best.position.z }); }
  }
  const lightOv = new Map();       // original index -> true once edited
  const addedLights = [];          // { id, L }
  function makeHalo(c, size) {
    if (!haloS.length && !haloS.parent) return null;
    const src = haloS[0]; if (!src) return null;
    const sp = new THREE.Sprite(src.material.clone()); sp.material.color.set(c).multiplyScalar(0.8); sp.scale.setScalar(size);
    src.parent.add(sp); TER.track(sp); delete sp.userData.tg; return sp;
  }
  function dropHalo(sp) { if (sp && sp.parent) sp.parent.remove(sp); }
  function syncLight(L) {
    const h = lightHalo.get(L); if (!h) return;
    h.sp.position.set(L.x + h.dx, L.y + h.dy, L.z + h.dz); h.sp.scale.setScalar(h.s);
    h.sp.visible = !L.del && h.s > 0.05;
  }
  function detachLight(L) {
    const e = TER.lightLink(L); if (e) e.off = true;
    const h = lightHalo.get(L); if (h) delete h.sp.userData.tg;
    const i = ORIG.indexOf(L); if (i >= 0) lightOv.set(i, true);
  }
  function setLightColor(L, c) {
    L.c = c; const h = lightHalo.get(L); if (!h) return;
    if (h.sp.material === h.mat0) h.sp.material = h.mat0.clone();
    h.sp.material.color.set(c).multiplyScalar(0.8);
  }
  function addLight(x, z, pre) {
    const L = { x, y: pre.y, z, c: pre.c, i: pre.i, always: !!pre.a, flicker: !!pre.f };
    lights.push(L);
    const sp = makeHalo(pre.c, pre.g);
    if (sp) lightHalo.set(L, { sp, dx: 0, dy: 0.4, dz: 0, s: pre.g, s0: pre.g, mat0: null });
    syncLight(L);
    const a = { id: nid(), L }; addedLights.push(a); lightsChanged(); return a;
  }
  function removeLight(L) {
    const a = addedLights.find((q) => q.L === L);
    if (a) { addedLights.splice(addedLights.indexOf(a), 1); lights.splice(lights.indexOf(L), 1); const h = lightHalo.get(L); if (h) dropHalo(h.sp); lightHalo.delete(L); }
    else if (ORIG.includes(L)) { detachLight(L); L.del = true; L._i = undefined; L.i = 0; syncLight(L); }
    lightsChanged();
  }
  function resetLight(L) {
    const i = ORIG.indexOf(L); if (i < 0) return;
    Object.assign(L, ORIGV[i]); delete L.del; lightOv.delete(i);
    const e = TER.lightLink(L); if (e) e.off = false;
    const h = lightHalo.get(L);
    if (h) { h.sp.material = h.mat0; h.s = h.s0; h.sp.position.set(h.x0, h.y0, h.z0); h.sp.scale.setScalar(h.s0); h.sp.visible = true; if (h.tg) h.sp.userData.tg = h.tg; }
    TER.applyGroups(); lightsChanged();
  }
  let poolT = 0;
  function lightsChanged() {
    // the soft glow pools under tall lamps follow the lights (rebuilt a moment after the last change)
    if (!poolMesh) return;
    clearTimeout(poolT);
    poolT = setTimeout(() => {
      const pos = [], uv = [];
      for (const L of lights) if (L.y > 4.5 && L.i > 0 && !L.del) { const q = new THREE.PlaneGeometry(11, 11); q.rotateX(-Math.PI / 2); q.translate(L.x, 0.1, L.z); const nq = q.toNonIndexed(); pos.push(...nq.attributes.position.array); uv.push(...nq.attributes.uv.array); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      poolMesh.geometry.dispose(); poolMesh.geometry = g; TER.drapeMesh(poolMesh);
    }, 120);
  }
  const lightOf = (L) => ({ x: r2(L.x), y: r2(L.y), z: r2(L.z), c: L.c, i: r2(L.i), a: L.always ? 1 : 0, f: L.flicker ? 1 : 0, g: r2(lightHalo.get(L) ? lightHalo.get(L).s : 0) });
  function lightsDoc() {
    const ov = {}; for (const i of lightOv.keys()) { const L = ORIG[i]; ov[i] = L.del ? { del: 1 } : lightOf(L); }
    if (!Object.keys(ov).length && !addedLights.length) return null;
    return { o: ov, add: addedLights.map((a) => ({ id: a.id, ...lightOf(a.L) })) };
  }
  function applyLights(d) {
    for (const i of [...lightOv.keys()]) resetLight(ORIG[i]);
    for (const a of addedLights.slice()) removeLight(a.L);
    if (d) {
      for (const [k, v] of Object.entries(d.o || {})) {
        const L = ORIG[+k]; if (!L) continue;
        detachLight(L);
        if (v.del) { L.del = true; L.i = 0; syncLight(L); continue; }
        Object.assign(L, { x: +v.x, y: +v.y, z: +v.z, i: +v.i, always: !!v.a, flicker: !!v.f }); setLightColor(L, +v.c);
        const h = lightHalo.get(L); if (h && v.g !== undefined) h.s = +v.g;
        syncLight(L);
      }
      for (const v of d.add || []) { const a = addLight(+v.x, +v.z, { y: +v.y, c: +v.c, i: +v.i, a: v.a, f: v.f, g: +v.g || 0 }); a.id = v.id || a.id; }
    }
    lightsChanged();
  }

  // ---------------- edits <-> JSON ----------------
  const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;
  const roundQ = (q) => { const o2 = {}; for (const k in q) { if (k === 'pts') { o2.pf = q.pts.flatMap((p) => [r2(p[0]), r2(p[1])]); continue; } o2[k] = typeof q[k] === 'number' ? (k === 'rot' || k === 'ry' ? r4(q[k]) : r2(q[k])) : q[k]; } return o2; };
  const unpackQ = (v) => { const q = { ...v }; if (Array.isArray(q.pf)) { q.pts = []; for (let i = 0; i + 1 < q.pf.length; i += 2) q.pts.push([+q.pf[i], +q.pf[i + 1]]); delete q.pf; } return q; };
  function serializeEdits() {
    const groups = {}, cols = {};
    for (let g = 1; g < TER.groups.length; g++) { const Q = TER.groups[g]; if (Q.dx || Q.dz || Q.r || Q.hide || (Q.s || 1) !== 1) groups[Q.id] = { dx: r2(Q.dx), dz: r2(Q.dz), r: r4(Q.r), s: r4(Q.s || 1), hide: Q.hide ? 1 : 0 }; }
    for (const m of TER.colModel) if (m.del) cols[m.id] = { del: 1 }; else if (m.ov) cols[m.id] = roundQ(m.ov);
    const B = {}; for (const [id, b] of Object.entries(bps)) B[id] = { name: b.name, solid: b.solid !== false, parts: b.parts.map(roundQ) };
    const roads = roadsDoc(), lts = lightsDoc();
    return {
      v: 2, groups, cols, bps: B, ...(roads ? { roads } : {}), ...(lts ? { lights: lts } : {}),
      added: TER.extraCols.filter((a) => !a.prop).map((a) => ({ id: a.id, ...roundQ(a.q) })),
      props: props.map((p) => ({ id: p.id, type: p.type, x: r2(p.x), z: r2(p.z), r: r4(p.r), s: r2(p.s || 1) })),
    };
  }
  // roads: the whole graph is saved when it differs from the one the map code builds
  const snapRoads = () => ({ n: NODES.map((n) => ({ x: r2(n.x), z: r2(n.z), b: n.bulb || 0, c: n.cw ? 1 : 0, d: n.dead ? 1 : 0 })), e: EDGES.map((e) => ({ a: e.a, b: e.b, w: r2(e.w), t: RD.etype(e), nt: e.nt ? 1 : 0 })) });
  const ROAD0 = snapRoads(), ROAD0S = JSON.stringify(ROAD0);
  function roadsDoc() {
    const r = snapRoads(); if (JSON.stringify(r) === ROAD0S) return null;
    return { nx: r.n.map((n) => n.x), nz: r.n.map((n) => n.z), nb: r.n.map((n) => n.b), nc: r.n.map((n) => n.c), nd: r.n.map((n) => n.d), e: r.e };
  }
  function applyRoads(d) {
    let n, e;
    if (d && Array.isArray(d.nx)) { n = d.nx.map((x, i) => ({ x: +x, z: +d.nz[i], b: +(d.nb || [])[i] || 0, c: +(d.nc || [])[i] || 0, d: +(d.nd || [])[i] || 0 })); e = d.e || []; }
    else { n = ROAD0.n; e = ROAD0.e; }
    for (let i = 0; i < Math.max(n.length, NODES.length); i++) {
      const v = n[i] || { x: 0, z: 0, b: 0, c: 0, d: 1 };
      if (!NODES[i]) NODES.push({ name: 'n' + i });
      const N0 = NODES[i]; N0.x = v.d ? 1e5 + i * 10 : v.x; N0.z = v.d ? 1e5 : v.z; N0.bulb = v.b || 0; N0.cw = !!v.c; N0.dead = !!v.d;
    }
    EDGES.length = 0;
    for (const q of e) if (NODES[q.a] && NODES[q.b] && q.a !== q.b) { const t = q.t || 'paved'; EDGES.push({ a: q.a, b: q.b, w: +q.w || RD.DEFAULT_W[t], t, dirt: t === 'dirt', nt: !!q.nt }); }
    RD.changed();
  }
  function applyEdits(e) {
    e = e || {};
    applyRoads(e.roads);
    for (let g = 1; g < TER.groups.length; g++) Object.assign(TER.groups[g], { dx: 0, dz: 0, r: 0, s: 1, hide: false });
    const byId = new Map(TER.groups.slice(1).map((Q) => [Q.id, Q]));
    for (const [id, v] of Object.entries(e.groups || {})) { const Q = byId.get(id); if (Q) Object.assign(Q, { dx: +v.dx || 0, dz: +v.dz || 0, r: +v.r || 0, s: +v.s || 1, hide: !!v.hide }); }
    const cm = new Map(TER.colModel.map((m) => [m.id, m]));
    for (const m of TER.colModel) { m.del = false; m.ov = null; }
    for (const [id, v] of Object.entries(e.cols || {})) { const m = cm.get(id); if (!m) continue; if (v.del) m.del = true; else m.ov = unpackQ(v); }
    for (const k of Object.keys(bps)) delete bps[k];
    for (const [id, b] of Object.entries(e.bps || {})) bps[id] = { name: b.name || 'My build', solid: b.solid !== false, parts: (b.parts || []).map((p) => ({ ...p })) };
    for (const p of props.slice()) removeProp(p);
    for (const a of TER.extraCols.slice()) if (!a.prop) TER.extraCols.splice(TER.extraCols.indexOf(a), 1);
    for (const a of e.added || []) { const { id, ...q } = a; TER.extraCols.push({ id, q: unpackQ(q) }); }
    for (const p of e.props || []) if (PROPS[p.type] || (p.type.startsWith('bp:') && bps[p.type.slice(3)])) placeProp({ ...p });
    TER.applyGroups();
    applyLights(e.lights);
    S.sel = null; if (S.bp && !bps[S.bp]) { S.bp = null; S.part = -1; }
    reattachBpInst();
    dirtyOverlay(); renderPanel();
  }

  // ---------------- persistence ----------------
  const LOCAL = 'maple-grove-world-v1';
  let db = null, dirtyT = false, dirtyE = false, dirtyG = false, saveTimer = 0, saving = false, lastAt = 0, status = 'Loading saved world...';
  function terrainDoc() { return { v: 1, n: TER.TN, cell: TER.TCELL, x0: TER.TX0, z0: TER.TZ0, amp: r2(TER.settings.amp), delta: TER.encodeDelta(), at: lastAt }; }
  function applyTerrainDoc(t) {
    t = t || {};
    if (t.n && t.n !== TER.TN) { toast && toast('Saved terrain has a different grid size; ignored.'); return; }
    TER.settings.amp = t.amp ?? 1; TER.computeBase(); TER.decodeDelta(t.delta || ''); TER.recompute(); dirtyOverlay();
  }
  function setStatus(s) { status = s; for (const el of panel.querySelectorAll('.dv-status')) el.textContent = s; }
  function markDirty(kind) { if (kind === 't') dirtyT = true; else if (kind === 'g') dirtyG = true; else dirtyE = true; setStatus('Unsaved changes...'); saveTimer = 2.5; }
  const groundDoc = () => ({ v: 1, n: GR.SPN, paint: GR.isDefaultPaint() ? '' : GR.encodePaint(), at: lastAt });
  async function saveNow() {
    if (saving || (!dirtyT && !dirtyE && !dirtyG)) return;
    saving = true; lastAt = Date.now();
    const wT = dirtyT, wE = dirtyE, wG = dirtyG; dirtyT = dirtyE = dirtyG = false;
    const e = { ...serializeEdits(), at: lastAt }, t = wT ? terrainDoc() : null, gd = wG ? groundDoc() : null;
    try {
      try { const loc = JSON.parse(localStorage.getItem(LOCAL) || '{}'); if (t) loc.terrain = t; if (gd) loc.ground = gd; loc.edits = e; localStorage.setItem(LOCAL, JSON.stringify(loc)); } catch (err) { /* storage blocked */ }
      if (db) {
        if (t) await db.doc('world/terrain').set(t);
        if (gd) await db.doc('world/ground').set(gd);
        await db.doc('world/edits').set(e);
        setStatus('Saved to Claude ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      } else setStatus('Saved in this browser only (no Claude storage here)');
    } catch (err) {
      dirtyT ||= wT; dirtyE ||= wE; dirtyG ||= wG;
      setStatus('Save failed: ' + ((err && (err.code || err.message)) || err) + ' (will retry)'); saveTimer = 8;
    }
    saving = false;
  }
  function loadLocal() {
    try { const loc = JSON.parse(localStorage.getItem(LOCAL) || 'null'); if (loc) { if (loc.terrain) applyTerrainDoc(loc.terrain); if (loc.ground) GR.decodePaint(loc.ground.paint); if (loc.edits) applyEdits(loc.edits); setStatus('Loaded from this browser'); return; } } catch (e) { /* ignore */ }
    setStatus('No saved world yet');
  }
  const startLoad = async () => {
    if (SHARE) {
      if (SHARE.terrain) applyTerrainDoc(SHARE.terrain);
      if (SHARE.ground) GR.decodePaint(SHARE.ground.paint);
      if (SHARE.edits) applyEdits(SHARE.edits);
      // hide the time-of-day debug menu too (its key, its clock click and its help row)
      addEventListener('keydown', (e) => { if (e.key === '`' || e.key === '~' || e.code === 'Backquote') e.stopImmediatePropagation(); }, true);
      addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#skyclock')) e.stopPropagation(); }, true);
      const dropRow = () => document.querySelectorAll('#title table tr').forEach((r) => { if (r.cells[0] && r.cells[0].textContent === '`') r.remove(); });
      dropRow(); setTimeout(dropRow, 0);
      return;
    }
    try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (!db) { loadLocal(); return; }
    let gotT = false, gotE = false;
    const timer = setTimeout(() => { if (!gotT || !gotE) setStatus("Can't reach saved world yet (still trying)"); }, 10000);
    const done = () => { if (gotT && gotE) { clearTimeout(timer); if (!dirtyT && !dirtyE) setStatus('Loaded from Claude'); } };
    db.doc('world/terrain').onSnapshot((s) => {
      if (s.metadata && s.metadata.hasPendingWrites) return;
      if (!s.metadata || !s.metadata.fromCache) gotT = true;
      const d = s.exists ? s.data() : null;
      if (!dirtyT && !saving && !(d && d.at && d.at === lastAt)) applyTerrainDoc(d);
      done();
    }, (err) => { gotT = true; setStatus('Saved terrain unavailable: ' + err.code); });
    db.doc('world/ground').onSnapshot((s) => {
      if (s.metadata && s.metadata.hasPendingWrites) return;
      const d = s.exists ? s.data() : null;
      if (!dirtyG && !saving && !(d && d.at && d.at === lastAt)) GR.decodePaint(d && d.paint);
    }, () => {});
    db.doc('world/edits').onSnapshot((s) => {
      if (s.metadata && s.metadata.hasPendingWrites) return;
      if (!s.metadata || !s.metadata.fromCache) gotE = true;
      const d = s.exists ? s.data() : null;
      if (!dirtyE && !saving && !(d && d.at && d.at === lastAt)) applyEdits(d);
      done();
    }, (err) => { gotE = true; setStatus('Saved edits unavailable: ' + err.code); });
  };

  // ---------------- undo ----------------
  const undo = [];
  function pushUndo() { undo.push({ e: serializeEdits(), d: TER.delta.slice(), amp: TER.settings.amp, bp: S.bp, part: S.part, g: S.tab === 'ground' && S.tool === 'paint' ? GR.encodePaint() : null }); if (undo.length > 40) undo.shift(); }
  function doUndo() {
    const u = undo.pop(); if (!u) { toast && toast('Nothing to undo'); return; }
    TER.delta.set(u.d); if (u.amp !== TER.settings.amp) { TER.settings.amp = u.amp; TER.computeBase(); }
    if (u.g !== null && u.g !== undefined) { GR.decodePaint(u.g); markDirty('g'); }
    TER.recompute(); applyEdits(u.e); S.bp = bps[u.bp] ? u.bp : null; S.part = S.bp ? u.part : -1; reattachBpInst();
    markDirty('t'); markDirty('e'); renderPanel();
  }

  // ---------------- overlays ----------------
  const ovl = new THREE.Group(); ovl.userData.noLift = true; scene.add(ovl);
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: true, transparent: true, opacity: 0.95, fog: false });
  const lineMatX = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9, fog: false });
  function lines(mat = lineMat) { const l = new THREE.LineSegments(new THREE.BufferGeometry(), mat); l.frustumCulled = false; l.renderOrder = 10; ovl.add(l); return l; }
  const colL = lines(), selL = lines(lineMatX), entL = lines(lineMatX), roadL = lines(), lightL = lines(), ringL = lines(lineMatX);
  const gridM = (() => {
    const g = new THREE.PlaneGeometry(400, 400, 100, 100); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x7fff9f, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
    g.translate(0, 0.05, 0); TER.drapeMesh(m); m.renderOrder = 9; ovl.add(m); return m;
  })();
  function setLines(l, pos, col) {
    const g = l.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
  }
  const C = new THREE.Color();
  function pushSeg(P2, C2, a, b, c) { P2.push(a[0], a[1], a[2], b[0], b[1], b[2]); C.set(c); C2.push(C.r, C.g, C.b, C.r, C.g, C.b); }
  const polyW = (q) => TER.polyEngine(q).poly;
  const boxPts = (q) => { const c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0), hw = q.w / 2, hd = q.d / 2; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [q.cx + lx * c + lz * s, q.cz - lx * s + lz * c]); };
  function shapeLines(q, P2, C2, color, hcap = 6, y0 = null) {
    const h = Math.min(q.h ?? 5, hcap); y0 = y0 ?? TER.heightAt(q.cx, q.cz) + 0.03;
    let pts = [];
    if (q.kind === 'circle') { for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push([q.cx + Math.cos(a) * q.r, q.cz + Math.sin(a) * q.r]); } }
    else if (q.kind === 'poly') pts = polyW(q);
    else pts = boxPts(q);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      pushSeg(P2, C2, [a[0], y0, a[1]], [b[0], y0, b[1]], color);
      pushSeg(P2, C2, [a[0], y0 + h, a[1]], [b[0], y0 + h, b[1]], color);
      if (q.kind === 'box' || (q.kind === 'circle' && i % 4 === 0) || (q.kind === 'poly' && (pts.length <= 24 || i % Math.ceil(pts.length / 24) === 0))) pushSeg(P2, C2, [a[0], y0, a[1]], [a[0], y0 + h, a[1]], color);
    }
  }
  let overlayDirty = true, overlayT = 0;
  function dirtyOverlay() { overlayDirty = true; }
  TER.onChange.push(() => { overlayT = Math.max(overlayT, 0.25); });
  function colColor(m, hidden) { const c = m.orig || {}; return hidden ? 0xff4040 : c.water ? 0x3a8aff : c.bld ? 0xffa030 : c.tree ? 0x40e080 : c.r !== undefined ? 0x40e0ff : 0xffe060; }
  function rebuildColliders() {
    const P2 = [], C2 = [];
    for (const m of TER.colModel) { if (m.del) continue; const Gp = TER.groups[m.grp]; shapeLines(TER.liveCanon(m), P2, C2, colColor(m, Gp && Gp.hide), m.orig.water ? 1.2 : 6); }
    for (const a of TER.extraCols) shapeLines(a.q, P2, C2, a.prop ? 0xd080ff : 0x60ff60);
    setLines(colL, P2, C2);
  }
  function rebuildRoads() {
    const P2 = [], C2 = [];
    for (const e of EDGES) {
      const A = NODES[e.a], B = NODES[e.b], n = Math.max(2, Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / 4));
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, x0 = A.x + (B.x - A.x) * t0, z0 = A.z + (B.z - A.z) * t0, x1 = A.x + (B.x - A.x) * t1, z1 = A.z + (B.z - A.z) * t1;
        pushSeg(P2, C2, [x0, TER.heightAt(x0, z0) + 0.4, z0], [x1, TER.heightAt(x1, z1) + 0.4, z1], e.nt ? 0x808080 : e.dirt ? 0xd0a060 : 0xff60c0);
      }
    }
    for (const N of NODES) { const y = TER.heightAt(N.x, N.z); pushSeg(P2, C2, [N.x, y, N.z], [N.x, y + 2.5, N.z], 0xff60c0); }
    setLines(roadL, P2, C2);
  }
  function rebuildLights() {
    const P2 = [], C2 = [];
    for (const L of lights) { const y = TER.heightAt(L.x, L.z), yy = y + L.y; pushSeg(P2, C2, [L.x - 0.4, yy, L.z], [L.x + 0.4, yy, L.z], L.c); pushSeg(P2, C2, [L.x, yy, L.z - 0.4], [L.x, yy, L.z + 0.4], L.c); pushSeg(P2, C2, [L.x, y, L.z], [L.x, yy, L.z], 0x666666); }
    setLines(lightL, P2, C2);
  }
  function rebuildSel() {
    const P2 = [], C2 = [], s = S.sel;
    if (S.tab === 'build' && S.bp && bpInst && S.part >= 0) {
      const pt = bps[S.bp] && bps[S.bp].parts[S.part];
      if (pt) { const q = partWorld(pt); shapeLines(q, P2, C2, 0xffffff, 99, q.y0); }
    } else if (s) {
      if (s.kind === 'group') for (const i of TER.groups[s.g].cols) { const m = TER.colModel[i]; if (!m.del) shapeLines(TER.liveCanon(m), P2, C2, 0xffffff, 8); }
      else if (s.kind === 'col') shapeLines(TER.liveCanon(s.m), P2, C2, 0xffffff, 8);
      else if (s.kind === 'added') shapeLines(s.a.q, P2, C2, 0xffffff, 8);
      else if (s.kind === 'prop') shapeLines(propShape(s.p), P2, C2, 0xffffff, 8);
      else if (s.kind === 'edge' && EDGES[s.k]) {
        const e = EDGES[s.k], A = NODES[e.a], B = NODES[e.b], L = Math.hypot(B.x - A.x, B.z - A.z) || 1, nx = -(B.z - A.z) / L * e.w / 2, nz = (B.x - A.x) / L * e.w / 2;
        const seg = (x0, z0, x1, z1) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3)); for (let i = 0; i < n; i++) { const a = i / n, b = (i + 1) / n, xa = x0 + (x1 - x0) * a, za = z0 + (z1 - z0) * a, xb = x0 + (x1 - x0) * b, zb = z0 + (z1 - z0) * b; pushSeg(P2, C2, [xa, TER.heightAt(xa, za) + 0.3, za], [xb, TER.heightAt(xb, zb) + 0.3, zb], 0xffffff); } };
        seg(A.x + nx, A.z + nz, B.x + nx, B.z + nz); seg(A.x - nx, A.z - nz, B.x - nx, B.z - nz); seg(A.x + nx, A.z + nz, A.x - nx, A.z - nz); seg(B.x + nx, B.z + nz, B.x - nx, B.z - nz);
      }
    }
    if (S.tab === 'roads' && S.tool === 'draw' && S.roadLast >= 0 && S.hoverPt && NODES[S.roadLast]) {
      const A = NODES[S.roadLast], B = S.hoverPt, n = Math.max(1, Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / 3));
      for (let i = 0; i < n; i++) { const a = i / n, b = (i + 1) / n, xa = A.x + (B.x - A.x) * a, za = A.z + (B.z - A.z) * a, xb = A.x + (B.x - A.x) * b, zb = A.z + (B.z - A.z) * b; pushSeg(P2, C2, [xa, TER.heightAt(xa, za) + 0.4, za], [xb, TER.heightAt(xb, zb) + 0.4, zb], 0xff60c0); }
    }
    setLines(selL, P2, C2);
  }
  function updateEntities() {
    const P2 = [], C2 = [];
    const add = (x, z, h, c) => { const y = TER.heightAt(x, z); pushSeg(P2, C2, [x, y, z], [x, y + h, z], c); pushSeg(P2, C2, [x - 0.5, y + 0.05, z], [x + 0.5, y + 0.05, z], c); pushSeg(P2, C2, [x, y + 0.05, z - 0.5], [x, y + 0.05, z + 0.5], c); };
    for (const c of cars) add(c.x, c.z, 2.6, c.driver === 'player' ? 0x60ff60 : c.role === 'patrol' ? 0x5080ff : c.dead ? 0x806060 : 0xffd040);
    for (const p of peds) add(p.x, p.z, 2.2, p.npc ? 0xff60ff : p.kind === 'raccoon' ? 0xc0a080 : 0xffffff);
    for (const p of pickups) if (p.alive !== false && p.mesh.visible) add(p.x, p.z, 1.4, p.kind === 'yarn' ? 0xffc830 : 0x60ffa0);
    for (const m of marks()) if (m.visible) add(m.position.x, m.position.z, 3.2, 0xff8040);
    add(P.car ? P.car.x : P.x, P.car ? P.car.z : P.z, 2.4, 0x00ffff);
    setLines(entL, P2, C2);
  }

  // labels (HTML), placed after render
  const labelBox = document.createElement('div'); labelBox.id = 'devlabels'; document.body.appendChild(labelBox);
  const labelPool = [];
  const _v = new THREE.Vector3();
  function placeLabels() {
    const want = [];
    if (S.open && view.labels) {
      const tx = S.editing ? cam.x : (P.car ? P.car.x : P.x), tz = S.editing ? cam.z : (P.car ? P.car.z : P.z), R = S.editing ? Math.max(40, cam.dist * 1.4) : 45;
      const near = (x, z) => Math.abs(x - tx) < R && Math.abs(z - tz) < R;
      if (view.ents) {
        for (const c of cars) if (near(c.x, c.z)) want.push([c.x, 2.8, c.z, `car ${c.type}${c.driver ? ' · ' + c.driver : ''}${c.role ? ' · ' + c.role : ''}`]);
        for (const p of peds) if (near(p.x, p.z)) want.push([p.x, 2.4, p.z, p.npc ? `npc ${p.npc}` : `${p.kind}${p.state ? ' · ' + p.state : ''}`]);
        for (const p of pickups) if (p.alive !== false && p.mesh.visible && near(p.x, p.z)) want.push([p.x, 1.6, p.z, p.kind]);
      }
      if (view.roads) for (const N of NODES) if (near(N.x, N.z)) want.push([N.x, 2.8, N.z, N.name]);
      if (S.editing && S.sel && S.tab !== 'build') { const a = selAnchor(); if (a) want.push([a.x, 9.4, a.z, selName()]); }
    }
    const W = innerWidth, Hh = innerHeight;
    let n = 0;
    for (const [x, y, z, t] of want) {
      if (n >= 60) break;
      _v.set(x, TER.heightAt(x, z) + y, z).project(camera);
      if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1 || _v.y < -1.1 || _v.y > 1.1) continue;
      let el = labelPool[n]; if (!el) { el = document.createElement('div'); labelBox.appendChild(el); labelPool.push(el); }
      if (el.textContent !== t) el.textContent = t;
      el.style.left = ((_v.x * 0.5 + 0.5) * W).toFixed(0) + 'px'; el.style.top = ((-_v.y * 0.5 + 0.5) * Hh).toFixed(0) + 'px'; el.style.display = 'block';
      n++;
    }
    for (let i = n; i < labelPool.length; i++) labelPool[i].style.display = 'none';
  }

  // ---------------- picking ----------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function setRay(cx, cy) { const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function groundPoint(cx, cy) {
    setRay(cx, cy);
    const o2 = ray.ray.origin, d = ray.ray.direction;
    const f = (t) => o2.y + d.y * t - TER.heightAt(o2.x + d.x * t, o2.z + d.z * t);
    let prev = 0, fp = f(0);
    for (let t = 0.5; t < 700; t += t < 60 ? 0.5 : 2) {
      const ft = f(t);
      if (fp > 0 && ft <= 0) { let a = prev, b = t; for (let k = 0; k < 18; k++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; } const tt = (a + b) / 2; return { x: o2.x + d.x * tt, z: o2.z + d.z * tt }; }
      prev = t; fp = ft;
    }
    return null;
  }
  function distTo(q, x, z) {
    if (q.kind === 'circle') return Math.max(0, Math.hypot(x - q.cx, z - q.cz) - q.r);
    if (q.kind === 'poly') return TER.polyDist(polyW(q), x, z);
    const c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0), dx = x - q.cx, dz = z - q.cz, lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.hypot(Math.max(0, Math.abs(lx) - q.w / 2), Math.max(0, Math.abs(lz) - q.d / 2));
  }
  const qArea = (q) => { if (q.kind === 'circle') return 3.14 * q.r * q.r; if (q.kind === 'poly') { const e = TER.polyEngine(q); return (e.x1 - e.x0) * (e.z1 - e.z0); } return q.w * q.d; };
  const propShape = (p) => (p.col && TER.extraCols.includes(p.col) ? p.col.q : { kind: 'circle', cx: p.x, cz: p.z, r: 0.8 * (p.s || 1), h: 1.5 * (p.s || 1) });
  function pick(pt, mode) {
    let best = null, bd = 0.9, ba = 1e9;
    const consider = (q, sel) => { const d = distTo(q, pt.x, pt.z), a = qArea(q); if (d < bd - 1e-4 || (d <= bd + 1e-4 && d === 0 && a < ba)) { best = sel; bd = d; ba = a; } };
    if (mode === 'water') { for (const { q, src } of GR.waterPolys()) consider(q, src.q ? { kind: 'added', a: src } : { kind: 'col', m: src }); return best; }
    if (mode === 'obj') for (const p of props) consider(propShape(p), { kind: 'prop', p });
    if (mode === 'col') for (const a of TER.extraCols) if (!a.prop) consider(a.q, { kind: 'added', a });
    for (const m of TER.colModel) { if (m.del) continue; consider(TER.liveCanon(m), mode === 'obj' && m.grp ? { kind: 'group', g: m.grp } : { kind: 'col', m }); }
    return best;
  }
  function selAnchor() {
    const s = S.sel; if (!s) return null;
    if (s.kind === 'node') return { x: NODES[s.i].x, z: NODES[s.i].z };
    if (s.kind === 'light') return { x: s.L.x, z: s.L.z };
    if (s.kind === 'edge') { const e = EDGES[s.k]; if (!e) return null; return { x: (NODES[e.a].x + NODES[e.b].x) / 2, z: (NODES[e.a].z + NODES[e.b].z) / 2 }; }
    if (s.kind === 'group') { const Q = TER.groups[s.g]; return { x: Q.anchor.x + Q.dx, z: Q.anchor.z + Q.dz }; }
    if (s.kind === 'col') { const q = TER.liveCanon(s.m); return { x: q.cx, z: q.cz }; }
    if (s.kind === 'added') return { x: s.a.q.cx, z: s.a.q.cz };
    if (s.kind === 'prop') return { x: s.p.x, z: s.p.z };
    return null;
  }
  function selName() {
    const s = S.sel; if (!s) return '';
    if (s.kind === 'node') return 'road point';
    if (s.kind === 'light') return addedLights.some((a) => a.L === s.L) ? 'your light' : 'light';
    if (s.kind === 'edge') { const e = EDGES[s.k]; return e ? (RD.etype(e) === 'hwy' ? 'highway' : RD.etype(e) + ' road') : ''; }
    if (s.kind === 'group') { const Q = TER.groups[s.g]; return `${Q.label}${Q.hide ? ' (removed)' : ''} · ${districtAt(Q.anchor.x, Q.anchor.z) || 'outskirts'}`; }
    if (s.kind === 'col') return `collider ${s.m.id}${s.m.ov ? ' (edited)' : ''}`;
    if (s.kind === 'added') return `added collider ${s.a.id}`;
    return `${propLabel(s.p.type)}`;
  }

  // ---------------- selection edits ----------------
  function moveSel(dx, dz) {
    const s = S.sel; if (!s) return;
    if (s.kind === 'group') { const Q = TER.groups[s.g]; Q.dx += dx; Q.dz += dz; TER.applyGroups(); }
    else if (s.kind === 'col') { const q = TER.liveCanon(s.m); q.cx += dx; q.cz += dz; s.m.ov = TER.unxformCanon(q, TER.groups[s.m.grp]); TER.applyColliders(); }
    else if (s.kind === 'added') { s.a.q.cx += dx; s.a.q.cz += dz; TER.applyColliders(); }
    else if (s.kind === 'prop') { s.p.x += dx; s.p.z += dz; syncProp(s.p); TER.applyColliders(); }
    dirtyOverlay();
  }
  function rotSel(da) {
    const s = S.sel; if (!s) return;
    if (s.kind === 'group') { TER.groups[s.g].r += da; TER.applyGroups(); }
    else if (s.kind === 'col') { const q = TER.liveCanon(s.m); if (q.kind !== 'circle') q.rot = (q.rot || 0) + da; s.m.ov = TER.unxformCanon(q, TER.groups[s.m.grp]); TER.applyColliders(); }
    else if (s.kind === 'added') { if (s.a.q.kind !== 'circle') s.a.q.rot = (s.a.q.rot || 0) + da; TER.applyColliders(); }
    else if (s.kind === 'prop') { s.p.r += da; syncProp(s.p); TER.applyColliders(); }
    dirtyOverlay();
  }
  function deleteSel() {
    if (S.tab === 'build' && S.bp && S.part >= 0) { delPart(); return; }
    const s = S.sel; if (!s) return;
    pushUndo();
    if (s.kind === 'light') { removeLight(s.L); S.sel = null; markDirty('e'); dirtyOverlay(); renderPanel(); return; }
    if (s.kind === 'group') { TER.groups[s.g].hide = !TER.groups[s.g].hide; TER.applyGroups(); }
    else if (s.kind === 'col') { s.m.del = true; TER.applyColliders(); S.sel = null; }
    else if (s.kind === 'added') { TER.extraCols.splice(TER.extraCols.indexOf(s.a), 1); TER.applyColliders(); S.sel = null; }
    else if (s.kind === 'prop') { removeProp(s.p); TER.applyColliders(); S.sel = null; }
    markDirty('e'); dirtyOverlay(); renderPanel();
  }
  // ---------------- road editing ----------------
  let roadT = 0;
  const live = (i) => NODES[i] && !NODES[i].dead;
  const deg = (i) => EDGES.filter((e) => e.a === i || e.b === i).length;
  function roadsLive() { const now = performance.now(); if (now - roadT > 70) { roadT = now; RD.relink(); RD.rebuildRoads(); dirtyOverlay(); } }
  function roadsDone() { RD.changed(); markDirty('e'); dirtyOverlay(); }
  function addNode(x, z) { NODES.push({ x, z, name: 'n' + nid() }); return NODES.length - 1; }
  function splitEdge(k, x, z) {
    const e = EDGES[k], i = addNode(x, z);
    EDGES.push({ ...e, a: i, b: e.b }); e.b = i; return i;
  }
  function connect(a, b) {
    if (a === b || EDGES.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
    const t = S.roadType; EDGES.push({ a, b, w: S.roadW, t, dirt: t === 'dirt', nt: RD.isPath(t) });
  }
  function nodeNear(pt, sx, sy) {
    // a road point under the finger (screen space), else within a few metres
    let best = -1, bd = coarse ? 30 : 18;
    const r = canvas.getBoundingClientRect();
    NODES.forEach((n, i) => {
      if (!live(i)) return;
      _v.set(n.x, TER.heightAt(n.x, n.z) + 0.4, n.z).project(camera); if (_v.z > 1) return;
      const d = Math.hypot(r.left + (_v.x * 0.5 + 0.5) * r.width - sx, r.top + (-_v.y * 0.5 + 0.5) * r.height - sy);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function deleteEdge(k) { pushUndo(); EDGES.splice(k, 1); S.sel = null; roadsDone(); renderPanel(); }
  function deleteNode(i) {
    pushUndo();
    const inc = EDGES.filter((e) => e.a === i || e.b === i);
    if (inc.length === 2 && !NODES[i].bulb) {   // a bend: keep the road, drop the point
      const o = inc.map((e) => (e.a === i ? e.b : e.a));
      const keep = inc[0]; keep.a = o[0]; keep.b = o[1]; EDGES.splice(EDGES.indexOf(inc[1]), 1);
    } else for (const e of inc) EDGES.splice(EDGES.indexOf(e), 1);
    NODES[i].dead = true; NODES[i].x = 1e5 + i * 10; NODES[i].z = 1e5;
    S.sel = null; roadsDone(); renderPanel();
  }
  function roadTap(pt, sx, sy) {
    // draw mode: tap a point, a road (splits it) or open ground; each tap after the first lays road to it
    pushUndo();
    let i = nodeNear(pt, sx, sy);
    if (i < 0) {
      const nr = RD.nearestRoad(pt.x, pt.z);
      if (nr && nr.d < EDGES[nr.k].w / 2 && nr.t > 0.05 && nr.t < 0.95) i = splitEdge(nr.k, nr.x, nr.z);
      else i = addNode(pt.x, pt.z);
    }
    if (S.roadLast >= 0 && i === S.roadLast) { S.roadLast = -1; if (!deg(i)) { NODES[i].dead = true; NODES[i].x = 1e5 + i * 10; NODES[i].z = 1e5; } roadsDone(); renderPanel(); return; }
    if (S.roadLast >= 0 && live(S.roadLast)) connect(S.roadLast, i);
    S.roadLast = i; S.sel = { kind: 'node', i };
    roadsDone(); renderPanel();
  }
  function finishRoad() {
    const i = S.roadLast; S.roadLast = -1;
    if (i >= 0 && live(i) && !deg(i)) { NODES[i].dead = true; NODES[i].x = 1e5 + i * 10; NODES[i].z = 1e5; S.sel = null; }
    roadsDone(); renderPanel();
  }
  function finishDraw() {
    const pts = S.drawPts; S.drawPts = null;
    if (!pts || pts.length < 3) { renderPanel(); return; }
    pushUndo();
    const water = S.tab === 'ground', a = { id: 'add' + nid(), q: TER.polyFromWorld(pts, water ? 99 : 3) };
    if (water) a.q.water = true;
    TER.extraCols.push(a); TER.applyColliders();
    S.sel = { kind: 'added', a }; S.tool = water ? 'water' : 'select'; S.vtx = -1;
    markDirty('e'); dirtyOverlay(); renderPanel();
  }
  function removeVertex() {
    const s = S.sel; if (!s || (s.kind !== 'col' && s.kind !== 'added')) return;
    const q = s.kind === 'col' ? TER.liveCanon(s.m) : s.a.q;
    if (q.kind !== 'poly' || q.pts.length <= 3 || !(S.vtx >= 0 && S.vtx < q.pts.length)) return;
    pushUndo();
    q.pts = q.pts.filter((_, i) => i !== S.vtx); S.vtx = Math.min(S.vtx, q.pts.length - 1);
    if (s.kind === 'col') s.m.ov = TER.unxformCanon(q, TER.groups[s.m.grp]);
    TER.applyColliders(); markDirty('e'); dirtyOverlay(); renderPanel();
  }
  function resetSel() {
    const s = S.sel; if (!s) return;
    pushUndo();
    if (s.kind === 'group') { Object.assign(TER.groups[s.g], { dx: 0, dz: 0, r: 0, s: 1, hide: false }); for (const i of TER.groups[s.g].cols) { TER.colModel[i].ov = null; TER.colModel[i].del = false; } TER.applyGroups(); }
    else if (s.kind === 'col') { s.m.ov = null; TER.applyColliders(); }
    markDirty('e'); dirtyOverlay(); renderPanel();
  }
  function levelUnderSel() {
    const s = S.sel; if (!s) return;
    let shapes = [];
    if (s.kind === 'group') shapes = TER.groups[s.g].cols.map((i) => TER.liveCanon(TER.colModel[i]));
    else if (s.kind === 'col') shapes = [TER.liveCanon(s.m)];
    else if (s.kind === 'added') shapes = [s.a.q];
    else if (s.kind === 'prop') shapes = [propShape(s.p)];
    const a = selAnchor(), t = TER.heightAt(a.x, a.z), F = 5;
    pushUndo();
    const { TN, TCELL, TX0, TZ0 } = TER;
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
      const x = TX0 + i * TCELL, z = TZ0 + j * TCELL;
      if (Math.abs(x - a.x) > 60 || Math.abs(z - a.z) > 60) continue;
      let d = 1e9; for (const q of shapes) d = Math.min(d, distTo(q, x, z));
      if (d > F + 1) continue;
      const w = d <= 1 ? 1 : 1 - (d - 1) / F, k = j * TN + i, wk = w * w * (3 - 2 * w);
      TER.delta[k] += (t - TER.H[k]) * wk;
    }
    TER.recompute(); markDirty('t');
  }

  // ---------------- builder ----------------
  let bpInst = null;   // the placed copy you are editing in the world
  function reattachBpInst() { if (!S.bp) { bpInst = null; return; } if (!bpInst || !props.includes(bpInst) || bpInst.type !== 'bp:' + S.bp) bpInst = props.find((p) => p.type === 'bp:' + S.bp) || null; }
  function newBp() {
    pushUndo();
    const id = nid(), n = Object.keys(bps).length + 1;
    bps[id] = { name: `My build ${n}`, solid: true, parts: [{ sh: 'box', key: 'plain', col: 0xc8c0b0, x: 0, y: 0, z: 0, w: 3, h: 2.5, d: 3, ry: 0 }] };
    const pl = placeProp({ id: nid(), type: 'bp:' + id, x: cam.x, z: cam.z, r: 0, s: 1 }); TER.applyColliders();
    S.bp = id; S.part = 0; bpInst = pl; markDirty('e'); dirtyOverlay(); renderPanel();
  }
  function editBp(id, inst) {
    S.bp = id; S.part = bps[id].parts.length ? 0 : -1; bpInst = inst || props.find((p) => p.type === 'bp:' + id) || null;
    if (!bpInst) { bpInst = placeProp({ id: nid(), type: 'bp:' + id, x: cam.x, z: cam.z, r: 0, s: 1 }); TER.applyColliders(); markDirty('e'); }
    cam.x = bpInst.x; cam.z = bpInst.z; cam.dist = Math.min(cam.dist, 25);
    S.tab = 'build'; S.tool = 'build'; S.sel = null; if (!S.editing) setEditing(true);
    dirtyOverlay(); renderPanel();
  }
  function addPart(sh) {
    const bp = bps[S.bp]; if (!bp) return;
    pushUndo();
    const top = bp.parts.reduce((m, p) => Math.max(m, p.y + p.h), 0);
    const pt = sh === 'roof' ? { sh, key: 'shingle', col: 0x6a5048, x: 0, y: top, z: 0, w: 3.4, h: 1.2, d: 3.4, ry: 0 }
      : sh === 'slab' ? { sh, key: 'sidewalk', col: 0xd8d4cc, x: 0, y: 0, z: 0, w: 4, h: 0.1, d: 4, ry: 0 }
        : { sh, key: 'plain', col: 0xc8c0b0, x: 0, y: top, z: 0, w: 1.5, h: 1.5, d: 1.5, ry: 0 };
    bp.parts.push(pt); S.part = bp.parts.length - 1; refreshBp(S.bp); markDirty('e'); renderPanel();
  }
  function dupPart() { const bp = bps[S.bp]; if (!bp || S.part < 0) return; pushUndo(); const c = { ...bp.parts[S.part], x: bp.parts[S.part].x + 0.5, z: bp.parts[S.part].z + 0.5 }; bp.parts.push(c); S.part = bp.parts.length - 1; refreshBp(S.bp); markDirty('e'); renderPanel(); }
  function delPart() { const bp = bps[S.bp]; if (!bp || S.part < 0) return; pushUndo(); bp.parts.splice(S.part, 1); S.part = Math.min(S.part, bp.parts.length - 1); refreshBp(S.bp); markDirty('e'); renderPanel(); }
  function deleteBp(id) {
    const n = props.filter((p) => p.type === 'bp:' + id).length;
    if (!confirm(`Delete "${bps[id].name}"${n ? ` and its ${n} placed cop${n === 1 ? 'y' : 'ies'}` : ''}?`)) return;
    pushUndo();
    for (const p of props.slice()) if (p.type === 'bp:' + id) removeProp(p);
    delete bps[id]; if (S.bp === id) { S.bp = null; S.part = -1; bpInst = null; }
    TER.applyColliders(); markDirty('e'); dirtyOverlay(); renderPanel();
  }
  // part <-> world (through the copy's position / turn / size)
  function toWorld(lx, lz, I = bpInst) { const s = I.s || 1, c = Math.cos(I.r), sn = Math.sin(I.r); lx *= s; lz *= s; return [I.x + lx * c + lz * sn, I.z - lx * sn + lz * c]; }
  function toLocal(x, z, I = bpInst) { const s = I.s || 1, c = Math.cos(I.r), sn = Math.sin(I.r), dx = x - I.x, dz = z - I.z; return [(dx * c - dz * sn) / s, (dx * sn + dz * c) / s]; }
  function partWorld(pt) {
    const s = bpInst.s || 1, [cx, cz] = toWorld(pt.x, pt.z);
    return { kind: 'box', cx, cz, w: pt.w * s, d: pt.d * s, h: pt.h * s, rot: (pt.ry || 0) + bpInst.r, y0: TER.heightAt(bpInst.x, bpInst.z) + pt.y * s };
  }
  function pickPart(cx, cy) {
    if (!bpInst) return -1;
    const m = bpInst.mesh, y = m.position.y; m.position.y = TER.heightAt(bpInst.x, bpInst.z); m.updateMatrixWorld(true);
    setRay(cx, cy); const hit = ray.intersectObject(m, true)[0];
    m.position.y = y; m.updateMatrixWorld(true);
    return hit && hit.object.userData.part !== undefined ? hit.object.userData.part : -1;
  }

  // ---------------- drag handles ----------------
  // Each handle: { x, y, z (world), c (colour), drag(ev) } where ev = { pt (ground point), dy (screen px up since start), k (metres per px) }
  let handles = [];
  const hMeshes = [];
  const hGeo = new THREE.BoxGeometry(1, 1, 1), hRot = new THREE.SphereGeometry(0.62, 10, 6);
  function hMesh(i, rotH) {
    let m = hMeshes[i];
    if (!m) { m = new THREE.Mesh(hGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, fog: false })); m.renderOrder = 20; m.userData.noLift = true; m.frustumCulled = false; ovl.add(m); hMeshes.push(m); }
    m.geometry = rotH ? hRot : hGeo; return m;
  }
  const ux = (r) => [Math.cos(r), -Math.sin(r)], uz = (r) => [Math.sin(r), Math.cos(r)];
  /** Handles that reshape a canonical shape q. apply(newShape, info) commits it; opts: { uniform (scale only), noRot, noH, y0 } */
  function shapeHandles(q, apply, opts = {}) {
    const H = [], y0 = opts.y0 ?? TER.heightAt(q.cx, q.cz), q0 = { ...q }, low = y0 + Math.min(0.4, (q.h || 1) * 0.5);
    if (q.kind === 'poly') {
      const P = polyW(q), c = Math.cos(q.rot || 0), s = Math.sin(q.rot || 0), n = P.length;
      const toL = (x, z) => { const dx = x - q0.cx, dz = z - q0.cz; return [dx * c - dz * s, dx * s + dz * c]; };
      const hy = (x, z) => TER.heightAt(x, z) + 0.4;
      P.forEach(([x, z], i) => H.push({ vtx: i, x, y: hy(x, z), z, c: i === S.vtx ? 0xffffff : 0x40ffd0, drag: (e) => { const pts = q0.pts.map((p) => [p[0], p[1]]); pts[i] = toL(e.pt.x, e.pt.z); S.vtx = i; apply({ ...q0, pts }, {}); } }));
      if (n <= 64) P.forEach(([x, z], i) => {
        const [x2, z2] = P[(i + 1) % n], mx = (x + x2) / 2, mz = (z + z2) / 2;
        H.push({ x: mx, y: hy(mx, mz), z: mz, c: 0x2a8a70, small: true, drag: (e) => { const pts = q0.pts.map((p) => [p[0], p[1]]); pts.splice(i + 1, 0, toL(e.pt.x, e.pt.z)); S.vtx = i + 1; apply({ ...q0, pts }, {}); } });
      });
      if (!opts.noRot) {
        let rad = 0; for (const [x, z] of P) rad = Math.max(rad, Math.hypot(x - q.cx, z - q.cz));
        const u = uz(q.rot || 0), dd = rad + 1.5, a0 = Math.atan2(u[0], u[1]);
        H.push({ rot: true, x: q.cx + u[0] * dd, y: low, z: q.cz + u[1] * dd, c: 0xffd040, drag: (e) => { const a = Math.atan2(e.pt.x - q0.cx, e.pt.z - q0.cz); apply({ ...q0, rot: (q0.rot || 0) + (a - a0) }, { da: a - a0 }); } });
      }
    } else if (q.kind === 'circle') {
      H.push({ x: q.cx + q.r, y: low, z: q.cz, c: 0x40d0ff, drag: (e) => { const r = Math.max(0.1, Math.hypot(e.pt.x - q0.cx, e.pt.z - q0.cz)); apply({ ...q0, r }, { f: r / q0.r }); } });
    } else {
      const R = q.rot || 0;
      for (const [axis, sg] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
        const u = axis === 'x' ? ux(R) : uz(R), half = (axis === 'x' ? q.w : q.d) / 2;
        H.push({
          x: q.cx + u[0] * half * sg, y: low, z: q.cz + u[1] * half * sg, c: axis === 'x' ? 0xff5050 : 0x50a0ff,
          drag: (e) => {
            const h0 = (axis === 'x' ? q0.w : q0.d) / 2, t = ((e.pt.x - q0.cx) * u[0] + (e.pt.z - q0.cz) * u[1]) * sg;
            if (opts.uniform) { apply(q0, { f: Math.max(0.1, t / h0) }); return; }
            const size = Math.max(0.2, t + h0), shift = sg * (size - 2 * h0) / 2;
            apply({ ...q0, [axis === 'x' ? 'w' : 'd']: size, cx: q0.cx + u[0] * shift, cz: q0.cz + u[1] * shift }, {});
          },
        });
      }
      if (!opts.noRot) {
        const u = uz(R), dd = q.d / 2 + Math.max(1.2, q.d * 0.25), a0 = Math.atan2(u[0], u[1]);
        H.push({ rot: true, x: q.cx + u[0] * dd, y: low, z: q.cz + u[1] * dd, c: 0xffd040, drag: (e) => { const a = Math.atan2(e.pt.x - q0.cx, e.pt.z - q0.cz); apply({ ...q0, rot: (q0.rot || 0) + (a - a0) }, { da: a - a0 }); } });
      }
    }
    if (!opts.noH && !opts.uniform) H.push({ lift: true, x: q.cx, y: y0 + q.h, z: q.cz, c: 0x60ff80, drag: (e) => apply({ ...q0, h: Math.max(0.1, q0.h + e.dy * e.k) }, {}) });
    return H;
  }
  function buildHandles() {
    handles = [];
    if (!S.editing) return;
    if (S.drawPts) {
      const n = S.drawPts.length;
      handles = S.drawPts.map(([x, z], i) => ({ x, y: TER.heightAt(x, z) + 0.4, z, c: i === 0 && n >= 3 ? 0xffffff : 0x40ffd0, close: i === 0 && n >= 3, drag: (e) => { S.drawPts[i] = [e.pt.x, e.pt.z]; } }));
      return;
    }
    if (S.tab === 'build') {
      if (!bpInst || !bps[S.bp] || S.part < 0) return;
      const pt = bps[S.bp].parts[S.part]; if (!pt) return;
      const s = bpInst.s || 1, q = partWorld(pt), p0 = { ...pt };
      const toPart = (nq) => { const [lx, lz] = toLocal(nq.cx, nq.cz); pt.x = lx; pt.z = lz; pt.w = nq.w / s; pt.d = nq.d / s; pt.h = nq.h / s; pt.ry = nq.rot - bpInst.r; refreshBp(S.bp); };
      handles = shapeHandles(q, toPart, { y0: q.y0 });
      handles.push({ x: q.cx, y: q.y0 + q.h + 1.2, z: q.cz, c: 0xff80ff, lift: true, drag: (e) => { pt.y = Math.max(-2, p0.y + e.dy * e.k / s); refreshBp(S.bp); } });
      return;
    }
    if (S.tab === 'lights') {
      const propL = new Set(props.map((p) => p.light).filter(Boolean));
      for (const L of lights) {
        if (L.del || propL.has(L) || Math.hypot(L.x - cam.x, L.z - cam.z) > Math.max(60, cam.dist * 1.6)) continue;
        const on = S.sel && S.sel.kind === 'light' && S.sel.L === L;
        handles.push({ light: L, x: L.x, y: TER.heightAt(L.x, L.z) + L.y, z: L.z, c: on ? 0xffffff : L.c, small: !on, drag: (e) => { detachLight(L); L.x = e.pt.x; L.z = e.pt.z; syncLight(L); lightsChanged(); dirtyOverlay(); } });
        if (on) handles.push({ lift: true, x: L.x, y: TER.heightAt(L.x, L.z) + L.y + 1.2, z: L.z, c: 0x60ff80, drag: (e) => { detachLight(L); if (e.y0 === undefined) e.y0 = L.y; L.y = Math.max(0.2, Math.min(30, (drag && drag.y0 !== undefined ? drag.y0 : L.y) + e.dy * e.k)); syncLight(L); lightsChanged(); } });
      }
      return;
    }
    if (S.tab === 'roads') {
      if (S.tool === 'draw') { NODES.forEach((n, i) => { if (live(i) && (deg(i) || i === S.roadLast)) handles.push({ x: n.x, y: TER.heightAt(n.x, n.z) + 0.4, z: n.z, c: i === S.roadLast ? 0xffffff : 0xff60c0, small: i !== S.roadLast, drag: () => {} }); }); return; }
      NODES.forEach((n, i) => {
        if (!live(i) || !deg(i)) return;
        const on = S.sel && S.sel.kind === 'node' && S.sel.i === i;
        handles.push({ node: i, x: n.x, y: TER.heightAt(n.x, n.z) + 0.4, z: n.z, c: on ? 0xffffff : 0xff60c0, small: !on, drag: (e) => { n.x = e.pt.x; n.z = e.pt.z; roadsLive(); } });
      });
      const s = S.sel;
      if (s && s.kind === 'edge' && EDGES[s.k]) {
        const e = EDGES[s.k], A = NODES[e.a], B = NODES[e.b], L = Math.hypot(B.x - A.x, B.z - A.z) || 1, nx = -(B.z - A.z) / L, nz = (B.x - A.x) / L, mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
        handles.push({ x: mx + nx * e.w / 2, y: TER.heightAt(mx, mz) + 0.4, z: mz + nz * e.w / 2, c: 0xff5050, drag: (ev) => { e.w = Math.max(1, Math.min(24, Math.round(2 * Math.abs((ev.pt.x - mx) * nx + (ev.pt.z - mz) * nz) * 2) / 2)); roadsLive(); } });
      }
      if (s && s.kind === 'node' && NODES[s.i] && NODES[s.i].bulb) {
        const n = NODES[s.i];
        handles.push({ x: n.x + n.bulb, y: TER.heightAt(n.x, n.z) + 0.4, z: n.z, c: 0x40d0ff, drag: (ev) => { n.bulb = Math.max(4, Math.min(20, Math.hypot(ev.pt.x - n.x, ev.pt.z - n.z))); roadsLive(); } });
      }
      return;
    }
    const sel = S.sel; if (!sel || !['objects', 'colliders', 'ground'].includes(S.tab)) return;
    if (sel.kind === 'col') handles = shapeHandles(TER.liveCanon(sel.m), (nq) => { sel.m.ov = TER.unxformCanon(nq, TER.groups[sel.m.grp]); TER.applyColliders(); dirtyOverlay(); });
    else if (sel.kind === 'added') handles = shapeHandles(sel.a.q, (nq) => { sel.a.q = nq; TER.applyColliders(); dirtyOverlay(); });
    else if (sel.kind === 'prop') {
      const p = sel.p, s0 = p.s || 1, r0 = p.r, q = propShape(p);
      handles = shapeHandles(q, (nq, i) => { if (i.f) p.s = Math.max(0.15, Math.min(8, s0 * i.f)); if (i.da !== undefined) p.r = r0 + i.da; syncProp(p); TER.applyColliders(); dirtyOverlay(); }, { uniform: true });
      if (q.kind === 'circle') { const u = uz(p.r), a0 = Math.atan2(u[0], u[1]), dd = q.r + 1.2; handles.push({ rot: true, x: q.cx + u[0] * dd, y: TER.heightAt(q.cx, q.cz) + 0.4, z: q.cz + u[1] * dd, c: 0xffd040, drag: (e) => { p.r = r0 + Math.atan2(e.pt.x - q.cx, e.pt.z - q.cz) - a0; syncProp(p); TER.applyColliders(); dirtyOverlay(); } }); }
    } else if (sel.kind === 'group') {
      const Q = TER.groups[sel.g], s0 = Q.s || 1, r0 = Q.r, m = TER.colModel[Q.cols[0]];
      handles = shapeHandles(TER.liveCanon(m), (nq, i) => { if (i.f) Q.s = Math.max(0.2, Math.min(5, s0 * i.f)); if (i.da !== undefined) Q.r = r0 + i.da; TER.applyGroups(); dirtyOverlay(); }, { uniform: true });
    }
  }
  function drawHandles() {
    let n = 0;
    for (const h of handles) {
      const m = hMesh(n++, h.rot); m.visible = true; m.position.set(h.x, h.y, h.z);
      m.scale.setScalar(Math.max(0.2, camera.position.distanceTo(m.position) * (coarse ? 0.028 : 0.018)) * (h.small ? 0.65 : 1));
      m.material.color.set(dragHandle && h.c === dragHandle.c && h.rot === dragHandle.rot ? 0xffffff : h.c);
    }
    for (let i = n; i < hMeshes.length; i++) hMeshes[i].visible = false;
  }
  function hitHandle(cx, cy) {
    const r = canvas.getBoundingClientRect(), R = coarse ? 28 : 16;
    let best = null, bd = R;
    for (const h of handles) {
      _v.set(h.x, h.y, h.z).project(camera); if (_v.z > 1) continue;
      const sx = r.left + (_v.x * 0.5 + 0.5) * r.width, sy = r.top + (-_v.y * 0.5 + 0.5) * r.height, d = Math.hypot(sx - cx, sy - cy);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }
  const pxToM = (x, y, z) => 2 * camera.position.distanceTo(_v.set(x, y, z)) * Math.tan((camera.fov * Math.PI) / 360) / innerHeight;
  let dragHandle = null;

  // ---------------- terrain brushes ----------------
  let stroke = null;
  function brush(pt, dt) {
    const { TN, TCELL, TX0, TZ0 } = TER, R = S.brush.r, k0 = S.brush.s;
    const i0 = Math.max(0, Math.floor((pt.x - R - TX0) / TCELL)), i1 = Math.min(TN - 1, Math.ceil((pt.x + R - TX0) / TCELL));
    const j0 = Math.max(0, Math.floor((pt.z - R - TZ0) / TCELL)), j1 = Math.min(TN - 1, Math.ceil((pt.z + R - TZ0) / TCELL));
    const H = TER.H, D = TER.delta;
    if (S.tool === 'smooth') {
      const src = H.slice();
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = TX0 + i * TCELL, z = TZ0 + j * TCELL, d = Math.hypot(x - pt.x, z - pt.z); if (d > R) continue;
        let s = 0, n = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= TN || jj >= TN) continue; s += src[jj * TN + ii]; n++; }
        const w = 1 - d / R, k = j * TN + i; D[k] += (s / n - src[k]) * Math.min(1, w * k0 * dt * 8);
      }
    } else {
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = TX0 + i * TCELL, z = TZ0 + j * TCELL, d = Math.hypot(x - pt.x, z - pt.z); if (d > R) continue;
        const w0 = 1 - d / R, w = w0 * w0 * (3 - 2 * w0), k = j * TN + i;
        if (S.tool === 'raise') D[k] += w * k0 * dt * 3;
        else if (S.tool === 'lower') D[k] -= w * k0 * dt * 3;
        else if (S.tool === 'flatten') D[k] += (stroke.target - H[k]) * Math.min(1, w * k0 * dt * 6);
      }
    }
    TER.recompute(); markDirty('t');
  }
  /** Push / pull: drag up or down to lift or sink the ground under the ring, sideways to make it wider or narrower. */
  function pull(e) {
    const { TN, TCELL, TX0, TZ0 } = TER, st2 = stroke, amt = e.dy * st2.k, R = Math.max(2, Math.min(60, st2.r0 + e.dx * st2.k));
    S.brush.r = Math.round(R);
    const D = TER.delta, Rm = Math.max(R, st2.rMax || 0); st2.rMax = Rm;
    const i0 = Math.max(0, Math.floor((st2.pt.x - Rm - TX0) / TCELL)), i1 = Math.min(TN - 1, Math.ceil((st2.pt.x + Rm - TX0) / TCELL));
    const j0 = Math.max(0, Math.floor((st2.pt.z - Rm - TZ0) / TCELL)), j1 = Math.min(TN - 1, Math.ceil((st2.pt.z + Rm - TZ0) / TCELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * TN + i, d = Math.hypot(TX0 + i * TCELL - st2.pt.x, TZ0 + j * TCELL - st2.pt.z);
      const w0 = Math.max(0, 1 - d / R), w = w0 * w0 * (3 - 2 * w0);
      D[k] = st2.d0[k] + amt * w;
    }
    TER.recompute(); markDirty('t');
  }

  // ---------------- input (edit mode) ----------------
  const ptrs = new Map();
  let drag = null, gesture = null;
  canvas.addEventListener('contextmenu', (e) => { if (S.editing) e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => {
    if (!S.editing) return;
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { if (drag && drag.undo && !drag.moved) undo.pop(); drag = null; stroke = null; dragHandle = null; gesture = twoFinger(); return; }
    if (ptrs.size > 2) return;
    const orbit = e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey);
    if (orbit) { drag = { mode: 'orbit', x: e.clientX, y: e.clientY }; return; }
    const pt0 = groundPoint(e.clientX, e.clientY);
    if (S.tab === 'roads' && S.tool === 'draw') { if (pt0) roadTap(pt0, e.clientX, e.clientY); drag = { mode: 'none' }; return; }
    // handles first
    const h = hitHandle(e.clientX, e.clientY);
    if (h && h.node !== undefined && !(S.sel && S.sel.kind === 'node' && S.sel.i === h.node)) { S.sel = { kind: 'node', i: h.node }; renderPanel(); dirtyOverlay(); }
    if (h && h.light && !(S.sel && S.sel.kind === 'light' && S.sel.L === h.light)) { S.sel = { kind: 'light', L: h.light }; renderPanel(); dirtyOverlay(); }
    if (h && h.close) { finishDraw(); drag = { mode: 'none' }; return; }
    if (h) { pushUndo(); dragHandle = h; drag = { mode: 'handle', h, x: e.clientX, y: e.clientY, k: pxToM(h.x, h.y, h.z), moved: false, undo: true, y0: h.lift && S.sel && S.sel.kind === 'light' ? S.sel.L.y : undefined }; return; }
    const pt = groundPoint(e.clientX, e.clientY);
    if (S.tab === 'build') {
      const i = pickPart(e.clientX, e.clientY);
      if (i >= 0) { S.part = i; renderPanel(); dirtyOverlay(); pushUndo(); drag = { mode: 'part', last: pt, moved: false, undo: true }; return; }
      drag = { mode: 'pan', x: e.clientX, y: e.clientY }; return;
    }
    if (S.tab === 'lights' && pt) {
      if (S.tool === 'place') { pushUndo(); const a = addLight(pt.x, pt.z, LPRESETS[S.lpre] || LPRESETS.bulb); S.sel = { kind: 'light', L: a.L }; markDirty('e'); dirtyOverlay(); renderPanel(); drag = { mode: 'none' }; return; }
      if (S.sel) { S.sel = null; renderPanel(); dirtyOverlay(); }
      drag = { mode: 'pan', x: e.clientX, y: e.clientY }; return;
    }
    if (S.tab === 'roads' && pt) {
      const nr = RD.nearestRoad(pt.x, pt.z), k = nr && nr.d < EDGES[nr.k].w / 2 + 1.5 ? nr.k : -1;
      if (k >= 0) {
        if (!(S.sel && S.sel.kind === 'edge' && S.sel.k === k)) { S.sel = { kind: 'edge', k }; renderPanel(); dirtyOverlay(); }
        pushUndo(); drag = { mode: 'edge', last: pt, moved: false, undo: true }; return;
      }
      if (S.sel) { S.sel = null; renderPanel(); dirtyOverlay(); }
      drag = { mode: 'pan', x: e.clientX, y: e.clientY }; return;
    }
    if (S.tab === 'ground' && S.tool === 'paint' && pt) { pushUndo(); stroke = { pt, paint: true }; return; }
    if (S.tab === 'ground' && S.tool === 'wdraw' && pt) { (S.drawPts ||= []).push([pt.x, pt.z]); renderPanel(); drag = { mode: 'none' }; return; }
    if (((S.tab === 'objects' || S.tab === 'colliders') && S.tool === 'select' || S.tab === 'ground' && S.tool === 'water') && pt) {
      const hit = pick(pt, S.tab === 'objects' ? 'obj' : S.tab === 'ground' ? 'water' : 'col');
      if (!(hit && S.sel && sameSel(hit, S.sel))) { S.sel = hit; S.vtx = -1; renderPanel(); dirtyOverlay(); }
      if (hit) { pushUndo(); drag = { mode: 'move', last: pt, moved: false, undo: true }; return; }
      drag = { mode: 'pan', x: e.clientX, y: e.clientY }; return;
    }
    if (S.tab === 'terrain' && pt) {
      pushUndo();
      if (S.tool === 'pull') { const y = TER.heightAt(pt.x, pt.z) + 0.5; stroke = { pull: true, pt, x: e.clientX, y: e.clientY, k: pxToM(pt.x, y, pt.z), r0: S.brush.r, d0: TER.delta.slice() }; }
      else stroke = { pt, target: TER.heightAt(pt.x, pt.z) };
      return;
    }
    if (S.tab === 'colliders' && S.tool === 'add' && S.colShape === 'draw' && pt) {
      (S.drawPts ||= []).push([pt.x, pt.z]); renderPanel(); drag = { mode: 'none' }; return;
    }
    if (S.tab === 'colliders' && S.tool === 'add' && pt) {
      pushUndo();
      const a = { id: 'add' + nid(), q: S.colShape === 'circle' ? { kind: 'circle', cx: pt.x, cz: pt.z, r: 1, h: 3 } : { kind: 'box', cx: pt.x, cz: pt.z, w: 3, d: 3, rot: cam.yaw, h: 3 } };
      TER.extraCols.push(a); TER.applyColliders(); S.sel = { kind: 'added', a }; S.tool = 'select'; markDirty('e'); dirtyOverlay(); renderPanel();
      drag = { mode: 'move', last: pt, moved: false }; return;
    }
    if (S.tab === 'objects' && S.tool === 'place' && pt) {
      pushUndo();
      const p = placeProp({ id: nid(), type: S.prop, x: pt.x, z: pt.z, r: S.prop.startsWith('bp:') ? cam.yaw : cam.yaw + Math.PI, s: 1 });
      TER.applyColliders(); S.sel = { kind: 'prop', p }; markDirty('e'); dirtyOverlay(); renderPanel();
      drag = { mode: 'move', last: pt, moved: false }; return;
    }
    drag = { mode: 'pan', x: e.clientX, y: e.clientY };
  });
  addEventListener('pointermove', (e) => {
    if (!S.editing) return;
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture && ptrs.size >= 2) { gesture(); return; }
    if (stroke && stroke.pull) { pull({ dy: stroke.y - e.clientY, dx: e.clientX - stroke.x }); return; }
    const pt = groundPoint(e.clientX, e.clientY);
    if (pt) S.hoverPt = pt;
    if (stroke && pt) stroke.pt = pt;
    if (!drag) return;
    if (drag.mode === 'orbit') { cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = Math.max(0.12, Math.min(1.5, cam.pitch + (e.clientY - drag.y) * 0.005)); drag.x = e.clientX; drag.y = e.clientY; }
    else if (drag.mode === 'pan') { panScreen(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; }
    else if (drag.mode === 'handle') { if (pt || drag.h.lift) { drag.h.drag({ pt: pt || S.hoverPt, dy: drag.y - e.clientY, k: drag.k }); drag.moved = true; } }
    else if (drag.mode === 'edge' && pt && S.sel && S.sel.kind === 'edge' && EDGES[S.sel.k]) {
      const e = EDGES[S.sel.k], dx = pt.x - drag.last.x, dz = pt.z - drag.last.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.001) { for (const i of [e.a, e.b]) { NODES[i].x += dx; NODES[i].z += dz; } drag.last = pt; drag.moved = true; roadsLive(); }
    }
    else if (drag.mode === 'move' && pt) { const dx = pt.x - drag.last.x, dz = pt.z - drag.last.z; if (Math.abs(dx) + Math.abs(dz) > 0.001) { moveSel(dx, dz); drag.last = pt; drag.moved = true; } }
    else if (drag.mode === 'part' && pt && drag.last && bpInst) {
      const pp = bps[S.bp].parts[S.part], [ax, az] = toLocal(drag.last.x, drag.last.z), [bx, bz] = toLocal(pt.x, pt.z);
      if (Math.abs(bx - ax) + Math.abs(bz - az) > 0.001) { pp.x += bx - ax; pp.z += bz - az; drag.last = pt; drag.moved = true; refreshBp(S.bp); }
    }
  });
  const endPtr = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) gesture = null;
    if (drag && ['move', 'handle', 'part', 'edge'].includes(drag.mode)) { if (drag.moved) { markDirty('e'); if (S.tab === 'roads') RD.changed(); } else if (drag.undo) undo.pop(); renderPanel(); }
    if (ptrs.size === 0) { drag = null; stroke = null; dragHandle = null; }
  };
  addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
  canvas.addEventListener('wheel', (e) => { if (!S.editing) return; e.preventDefault(); cam.dist = Math.max(4, Math.min(260, cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  function twoFinger() {
    const [a, b] = [...ptrs.values()];
    let last = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return () => {
      const [p, q] = [...ptrs.values()];
      const now = { d: Math.hypot(p.x - q.x, p.y - q.y), ang: Math.atan2(q.y - p.y, q.x - p.x), mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2 };
      if (now.d > 10 && last.d > 10) cam.dist = Math.max(4, Math.min(260, cam.dist * last.d / now.d));
      let da = now.ang - last.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); cam.yaw += da;
      panScreen(now.mx - last.mx, 0); cam.pitch = Math.max(0.12, Math.min(1.5, cam.pitch + (now.my - last.my) * 0.005));
      last = now;
    };
  }
  function panScreen(dx, dy) {
    const k = cam.dist * 0.0022 * (900 / Math.max(400, innerHeight)), fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    cam.x += (-fz * dx - fx * dy) * k; cam.z += (fx * dx - fz * dy) * k;
    cam.x = Math.max(-200, Math.min(200, cam.x)); cam.z = Math.max(-200, Math.min(200, cam.z));
  }
  const sameSel = (a, b) => a.kind === b.kind && (a.g ?? a.m ?? a.a ?? a.p) === (b.g ?? b.m ?? b.a ?? b.p);

  // keys
  const held = new Set();
  addEventListener('keydown', (e) => {
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    if (SHARE) return;
    if (e.key === 'F2') { e.preventDefault(); toggleOpen(); return; }
    if (e.key === 'F3') { e.preventDefault(); setEditing(!S.editing); return; }
    if (!S.editing || typing) return;
    const k = e.key.toLowerCase();
    held.add(k);
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); doUndo(); return; }
    if (S.tab === 'roads' && S.roadLast >= 0 && (k === 'enter' || k === 'escape')) { finishRoad(); return; }
    if (S.tab === 'roads' && S.sel && (k === 'delete' || k === 'backspace')) { e.preventDefault(); if (S.sel.kind === 'edge') deleteEdge(S.sel.k); else if (S.sel.kind === 'node') deleteNode(S.sel.i); return; }
    if (S.drawPts) {
      if (k === 'enter') { finishDraw(); return; }
      if (k === 'escape') { S.drawPts = null; renderPanel(); return; }
      if (k === 'backspace' || k === 'delete') { e.preventDefault(); S.drawPts.pop(); if (!S.drawPts.length) S.drawPts = null; renderPanel(); return; }
    }
    if (k === 'escape') { S.sel = null; S.part = -1; renderPanel(); dirtyOverlay(); }
    if ((k === 'delete' || k === 'backspace') && S.vtx >= 0 && S.sel && (S.sel.kind === 'col' || S.sel.kind === 'added') && (S.sel.kind === 'col' ? TER.liveCanon(S.sel.m) : S.sel.a.q).kind === 'poly') { e.preventDefault(); removeVertex(); return; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); }
    if (k === 'q' || k === 'e') {
      const da = (k === 'q' ? 1 : -1) * (e.shiftKey ? Math.PI / 180 : Math.PI / 12);
      if (S.tab === 'build' && S.bp && S.part >= 0) { pushUndo(); bps[S.bp].parts[S.part].ry = (bps[S.bp].parts[S.part].ry || 0) + da; refreshBp(S.bp); markDirty('e'); renderPanel(); }
      else if (S.sel) { pushUndo(); rotSel(da); markDirty('e'); renderPanel(); }
    }
    const tb = TAB_KEYS[k];
    if (tb) setTab(tb);
    if (k === '[') { S.brush.r = Math.max(2, S.brush.r - 1); renderPanel(); }
    if (k === ']') { S.brush.r = Math.min(60, S.brush.r + 1); renderPanel(); }
  });
  addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  addEventListener('blur', () => held.clear());

  // ---------------- UI ----------------
  const btn = document.createElement('button'); btn.id = 'devbtn'; btn.textContent = 'DEV'; document.body.appendChild(btn); if (SHARE) btn.style.display = 'none';
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggleOpen(); });
  const hint = document.createElement('div'); hint.id = 'devhint'; document.body.appendChild(hint);
  const panel = document.createElement('div'); panel.id = 'dev'; document.body.appendChild(panel);
  ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown'].forEach((ev) => panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  const title = document.querySelector('#title .card');
  if (title && !SHARE) {
    const b = document.createElement('button'); b.textContent = 'WORLD EDITOR'; b.style.marginLeft = '8px';
    b.addEventListener('click', () => { document.getElementById('title').style.display = 'none'; document.body.classList.remove('titled'); S.fromTitle = true; S.open = true; setEditing(true); });
    const start = title.querySelector('#start'); if (start) start.after(b); else title.appendChild(b);
  }
  function toggleOpen() {
    S.open = !S.open;
    if (!S.open && S.editing) setEditing(false);
    if (S.open && document.pointerLockElement) document.exitPointerLock();
    renderPanel();
  }
  function setTab(t) {
    if (S.tab === 'build' && t !== 'build') S.part = -1;
    if (S.roadLast >= 0) finishRoad();
    S.tab = t; S.tool = TAB_TOOL[t]; S.sel = null; S.drawPts = null; S.vtx = -1;
    if (!['view', 'save'].includes(t) && !S.editing) setEditing(true);
    if (t === 'build') reattachBpInst();
    dirtyOverlay(); renderPanel();
  }
  let saved = null;
  function setEditing(on) {
    if (on === S.editing) return;
    S.editing = on;
    if (on) {
      S.open = true;
      saved = { paused: G.paused, far: camera.far, fogNear: scene.fog && scene.fog.near, fogFar: scene.fog && scene.fog.far };
      G.paused = true;
      if (document.pointerLockElement) document.exitPointerLock();
      const tx = P.car ? P.car.x : P.x, tz = P.car ? P.car.z : P.z; cam.x = tx; cam.z = tz;
      camera.far = 900; camera.updateProjectionMatrix();
      document.body.classList.add('deved');
      if (S.tab === 'view' || S.tab === 'save') { S.tab = 'objects'; S.tool = 'select'; }
    } else {
      camera.far = saved ? saved.far : 190; camera.updateProjectionMatrix();
      if (scene.fog && saved) { scene.fog.near = saved.fogNear; scene.fog.far = saved.fogFar; }
      G.paused = S.fromTitle ? false : saved ? saved.paused : false; S.fromTitle = false;
      document.body.classList.remove('deved'); camera.userData.noLift = false; S.sel = null; S.part = -1;
      if (!['view', 'save'].includes(S.tab)) { S.tab = 'view'; S.tool = 'none'; }
      saveNow();
    }
    renderPanel(); dirtyOverlay();
  }
  function playHere() {
    if (P.car) { toast && toast('Get out of the car first'); return; }
    P.x = cam.x; P.z = cam.z; P.y = 0; P.vy = 0;
    setEditing(false);
  }
  const HINTS = {
    view: 'Toggle what to show. F2 hides the panel, F3 edits the world.',
    terrain: 'Drag on the ground to sculpt. Push/Pull: drag up or down for height, sideways for width. [ ] brush size.',
    ground: 'Paint: hold and drag on the ground. Water: tap a lake or pond to reshape it, or Draw water. [ ] brush size.',
    lights: 'Drag a light to move it, the green handle sets its height. Place: tap the ground to add a light. Del deletes.',
    roads: 'Drag the pink points to bend roads. Tap a road to pick it (drag moves it, red handle sets the width). Draw road: tap to lay road, tap the last point again to stop. Del deletes.',
    objects: 'Click to select, drag to move. Handles: red/blue scale, yellow ball turns. Q/E turn, Del removes.',
    colliders: 'Click a collider, drag to move. Handles: red/blue width/depth, green height, yellow ball turns, teal dots are corners of drawn shapes. Add > Draw shape to draw your own.',
    build: 'Click a part to pick it, drag it to move. Handles: red/blue/green size, yellow turn, pink up/down.',
    save: 'Edits save to Claude by themselves a moment after you stop.',
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = (c) => '#' + ((c >>> 0) & 0xffffff).toString(16).padStart(6, '0');
  const num = (k, lab, v, step = 0.1) => `<span>${lab}</span><input type="number" step="${step}" data-f="${k}" value="${(+v).toFixed(2)}">`;

  function inspectorHTML() {
    const sel = S.sel; if (!sel) return '';
    const a = selAnchor();
    let h = `<h4>Selected</h4><div class="stat">${esc(selName())}\nat ${a.x.toFixed(1)}, ${a.z.toFixed(1)} · ground ${TER.heightAt(a.x, a.z).toFixed(2)} m</div>`;
    if (sel.kind === 'group') { const Q = TER.groups[sel.g]; h += `<div class="grid2" style="margin-top:4px">${num('gs', 'size×', Q.s || 1, 0.05)}${num('gr', 'turn°', Q.r * 180 / Math.PI, 1)}</div><div class="stat muted">moved ${Q.dx.toFixed(1)}, ${Q.dz.toFixed(1)} · ${Q.cols.length} collider(s)</div>`; }
    const q = sel.kind === 'col' ? TER.liveCanon(sel.m) : sel.kind === 'added' ? sel.a.q : null;
    if (q) h += `<div class="grid2" style="margin-top:4px">${num('cx', 'x', q.cx)}${num('cz', 'z', q.cz)}${q.kind === 'circle' ? num('r', 'radius', q.r) : q.kind === 'poly' ? '' : num('w', 'width', q.w) + num('d', 'depth', q.d)}${num('h', 'height', q.h)}${q.kind !== 'circle' ? num('rot', 'turn°', (q.rot || 0) * 180 / Math.PI, 1) : ''}</div>`;
    if (q && q.kind === 'poly') h += `<div class="muted">${q.pts.length} corners. Drag a corner to move it, drag a small dot between corners to add one.</div><div class="row"><button data-a="delvtx" ${S.vtx >= 0 && S.vtx < q.pts.length && q.pts.length > 3 ? '' : 'disabled'}>Remove ${S.vtx >= 0 && S.vtx < q.pts.length ? 'corner ' + (S.vtx + 1) : 'corner (pick one)'}</button></div>`;
    if (sel.kind === 'prop') h += `<div class="grid2" style="margin-top:4px">${num('s', 'size×', sel.p.s || 1, 0.05)}${num('pr', 'turn°', sel.p.r * 180 / Math.PI, 1)}</div>${sel.p.type.startsWith('bp:') ? '<div class="row"><button data-a="editbp">Edit this build</button></div>' : ''}`;
    h += `<div class="row" style="margin-top:6px"><button data-a="rotl">⟲ 15°</button><button data-a="rotr">⟳ 15°</button><button data-a="level">Level ground</button></div>
      <div class="row"><button class="warn" data-a="del">${sel.kind === 'group' ? (TER.groups[sel.g].hide ? 'Restore' : 'Remove') : 'Delete'}</button>${sel.kind === 'group' || (sel.kind === 'col' && sel.m.ov) ? '<button data-a="reset">Reset to original</button>' : ''}<button data-a="desel">Deselect</button></div>`;
    return h;
  }
  function tabHTML() {
    const t = S.tab, brushT = BRUSH.includes(S.tool);
    if (t === 'view') return `<h4>Show</h4>${[['cols', 'Colliders'], ['ents', 'Entities (cars, people, pickups)'], ['roads', 'Road graph'], ['lights', 'Light sources'], ['grid', 'Terrain grid'], ['labels', 'Labels']].map(([k, l]) => `<label><input type="checkbox" data-v="${k}" ${view[k] ? 'checked' : ''}>${l}</label>`).join('')}
      <h4>Stats</h4><div class="stat" id="dv-stats"></div>`;
    if (t === 'terrain') return `<h4>Brush</h4><div class="row">${[['raise', 'Raise'], ['lower', 'Lower'], ['smooth', 'Smooth'], ['flatten', 'Flatten'], ['pull', 'Push / Pull']].map(([k, l]) => `<button data-t="${k}" class="${S.tool === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${brushT ? `<label>Size <input type="range" min="2" max="60" step="1" data-b="r" value="${S.brush.r}"><span>${S.brush.r} m</span></label>${S.tool !== 'pull' ? `<label>Strength <input type="range" min="0.05" max="1.5" step="0.05" data-b="s" value="${S.brush.s}"><span>${S.brush.s.toFixed(2)}</span></label>` : ''}` : ''}
      <div class="muted">${S.tool === 'pull' ? 'Press on the ground, then drag up to lift it or down to sink it. Drag sideways to widen or narrow the hill.' : 'Hold and drag on the ground. Two fingers move the camera.'}</div>
      <h4>Whole map</h4><label>Hills <input type="range" min="0" max="2.5" step="0.05" data-amp value="${TER.settings.amp}"><span>${TER.settings.amp.toFixed(2)}×</span></label>
      <div class="row"><button data-a="resetT" class="warn">Clear sculpting</button><button data-a="day">Daylight</button></div>`;
    if (t === 'ground') {
      const L = GR.LAYERS.find((l) => l.id === S.layer) || GR.LAYERS[1];
      let h = `<div class="row"><button data-t="paint" class="${S.tool === 'paint' ? 'on' : ''}">Paint</button><button data-t="water" class="${S.tool === 'water' ? 'on' : ''}">Water</button><button data-t="wdraw" class="${S.tool === 'wdraw' ? 'on' : ''}">Draw water</button></div>`;
      if (S.tool === 'paint') h += `<h4>Surface</h4><div class="row">${GR.LAYERS.map((l) => `<button data-layer="${l.id}" class="${S.layer === l.id ? 'on' : ''}"><span style="display:inline-block;width:10px;height:10px;background:${l.sw};border:1px solid #000;margin-right:4px;vertical-align:-1px"></span>${l.label}</button>`).join('')}</div>
        <label>Size <input type="range" min="1" max="40" step="1" data-b="r" value="${S.brush.r}"><span>${S.brush.r} m</span></label>
        <label>Strength <input type="range" min="0.05" max="1.5" step="0.05" data-b="s" value="${S.brush.s}"><span>${S.brush.s.toFixed(2)}</span></label>
        <div class="muted">Hold and drag to paint ${esc(L.label.toLowerCase())}${L.id === 'grass' ? ' (clears other paint)' : ''}. Roads, lots and floors sit on top of the paint.</div>
        <div class="row" style="margin-top:6px"><button data-a="resetG">Reset paint</button><button data-a="clearG" class="warn">Clear all paint</button></div>`;
      else if (S.tool === 'wdraw') h += `<div class="muted">${S.drawPts ? `${S.drawPts.length} point(s). Keep tapping to outline the water. Tap the white first point or Finish.` : 'Tap the ground to outline a pond or river, one corner at a time.'}</div>${S.drawPts ? `<div class="row"><button data-a="drawdone" class="on" ${S.drawPts.length < 3 ? 'disabled' : ''}>Finish water</button><button data-a="drawundo">Undo point</button><button data-a="drawcancel" class="warn">Cancel</button></div>` : ''}<div class="muted">Water sits at the height of its lowest shore point and blocks walking and driving.</div>`;
      else h += `<div class="muted">Tap the lake or a pond. Drag it to move it, drag the teal corners to reshape it, drag a small dot to add a corner.</div>${inspectorHTML()}`;
      return h;
    }
    if (t === 'lights') {
      let h = `<div class="row"><button data-t="select" class="${S.tool === 'select' ? 'on' : ''}">Select / move</button><button data-t="place" class="${S.tool === 'place' ? 'on' : ''}">Place light</button></div>`;
      if (S.tool === 'place') h += `<h4>Kind</h4><div class="row">${Object.entries(LPRESETS).map(([k, v]) => `<button data-lpre="${k}" class="${S.lpre === k ? 'on' : ''}"><span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${hex(v.c)};margin-right:4px"></span>${v.label}</button>`).join('')}</div>
        <div class="muted">Tap the ground to place it, then fine-tune it below. For a lamp post with a pole, use Objects > Place > Street lamp.</div>`;
      else h += `<div class="muted">Lights near the camera show as dots in their own colour. Drag one to move it. Switch to daylight off (night) to see them.</div>`;
      const s = S.sel;
      if (s && s.kind === 'light') {
        const L = s.L, hl = lightHalo.get(L), orig = ORIG.includes(L);
        h += `<h4>${orig ? 'Light' : 'Your light'}</h4>
          <div class="grid2">${num('lx', 'x', L.x)}${num('lz', 'z', L.z)}${num('ly', 'height', L.y)}<span>colour</span><input type="color" data-lc value="${hex(L.c)}"></div>
          <label>Brightness <input type="range" min="0" max="3" step="0.05" data-li value="${L.i}"><span>${(+L.i).toFixed(2)}</span></label>
          ${hl ? `<label>Glow <input type="range" min="0" max="8" step="0.1" data-lg value="${hl.s}"><span>${hl.s.toFixed(1)}</span></label>` : ''}
          <label><input type="checkbox" data-la ${L.always ? 'checked' : ''}>On in the daytime too</label>
          <label><input type="checkbox" data-lf ${L.flicker ? 'checked' : ''}>Flicker</label>
          <div class="row"><button class="warn" data-a="del">Delete</button>${orig ? '<button data-a="lreset">Reset to original</button>' : ''}<button data-a="desel">Deselect</button></div>`;
      }
      return h;
    }
    if (t === 'roads') {
      let h = `<div class="row"><button data-t="select" class="${S.tool === 'select' ? 'on' : ''}">Select / move</button><button data-t="draw" class="${S.tool === 'draw' ? 'on' : ''}">Draw road / path</button></div>`;
      if (S.tool === 'draw') h += `<h4>New road or path</h4><div class="row">${RTYPES.map(([k, l]) => `<button data-rt="${k}" class="${S.roadType === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <label>Width <input type="range" min="1" max="24" step="0.5" data-rw value="${S.roadW}"><span>${S.roadW} m</span></label>
        <div class="muted">${S.roadLast >= 0 ? 'Tap to lay road to the next point. Tapping a road or a pink point joins it. Tap the white point again (or Done) to stop.' : 'Tap a pink point, a road, or open ground to start.'}</div>
        ${S.roadLast >= 0 ? '<div class="row"><button data-a="roaddone" class="on">Done</button></div>' : ''}`;
      else h += `<div class="muted">Drag a pink point to bend a road. Tap a road to pick it.</div>`;
      const s = S.sel;
      if (s && s.kind === 'edge' && EDGES[s.k]) {
        const e = EDGES[s.k], T = RD.etype(e), L = Math.hypot(NODES[e.b].x - NODES[e.a].x, NODES[e.b].z - NODES[e.a].z);
        h += `<h4>Road</h4><div class="stat">${({ hwy: 'Highway', dirt: 'Dirt road', paved: 'Paved road', path: 'Trail', walk: 'Walkway' })[T]} · ${L.toFixed(0)} m long</div>
          <div class="row">${RTYPES.map(([k, l]) => `<button data-et="${k}" class="${T === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="grid2">${num('rw', 'width', e.w, 0.5)}</div>
          ${RD.isPath(T) ? '' : `<label><input type="checkbox" data-ent ${e.nt ? '' : 'checked'}>Traffic drives here</label>`}
          <div class="row"><button data-a="splitroad">Add a bend point</button><button class="warn" data-a="delroad">Delete road</button><button data-a="desel">Deselect</button></div>`;
      } else if (s && s.kind === 'node' && NODES[s.i]) {
        const n = NODES[s.i], d = deg(s.i);
        h += `<h4>Road point</h4><div class="stat">${d} road(s) meet here</div><div class="grid2">${num('nx', 'x', n.x)}${num('nz', 'z', n.z)}</div>
          ${d === 1 ? `<label><input type="checkbox" data-nb ${n.bulb ? 'checked' : ''}>Cul-de-sac (round end)</label>` : ''}
          ${d >= 3 ? `<label><input type="checkbox" data-ncw ${n.cw ? 'checked' : ''}>Crosswalks</label>` : ''}
          <div class="row"><button data-a="drawfrom">Draw a road from here</button><button class="warn" data-a="delnode">${d === 2 && !n.bulb ? 'Remove point (keep road)' : 'Delete point and its roads'}</button></div>`;
      }
      h += `<div class="row" style="margin-top:8px"><button data-a="resetR" class="warn">Reset all roads</button></div>`;
      return h;
    }
    if (t === 'objects') {
      const builds = Object.entries(bps);
      return `<div class="row"><button data-t="select" class="${S.tool === 'select' ? 'on' : ''}">Select / move</button><button data-t="place" class="${S.tool === 'place' ? 'on' : ''}">Place</button></div>
      ${S.tool === 'place' ? `<h4>Props</h4><div class="row">${Object.entries(PROPS).map(([k, d]) => `<button data-pr="${k}" class="${S.prop === k ? 'on' : ''}">${d.label}</button>`).join('')}</div>
        <h4>Your builds</h4>${builds.length ? `<div class="row">${builds.map(([id, b]) => `<button data-pr="bp:${id}" class="${S.prop === 'bp:' + id ? 'on' : ''}">${esc(b.name)}</button>`).join('')}</div>` : '<div class="muted">None yet. Make one in the Build tab.</div>'}
        <div class="muted">Tap the ground to place it.</div>` : '<div class="muted">Tap a building, tree or prop. Drag it to move it, pull the handles to scale or turn it.</div>'}
      ${inspectorHTML()}`;
    }
    if (t === 'colliders') return `<div class="row"><button data-t="select" class="${S.tool === 'select' ? 'on' : ''}">Select / edit</button><button data-t="add" class="${S.tool === 'add' ? 'on' : ''}">Add</button></div>
      ${S.tool === 'add' ? `<div class="row"><button data-c="box" class="${S.colShape === 'box' ? 'on' : ''}">Box</button><button data-c="circle" class="${S.colShape === 'circle' ? 'on' : ''}">Round</button><button data-c="draw" class="${S.colShape === 'draw' ? 'on' : ''}">Draw shape</button></div>${S.colShape === 'draw' ? `<div class="muted">${S.drawPts ? `${S.drawPts.length} point(s). Keep tapping to add corners. Tap the white first point or Finish to close the shape.` : 'Tap the ground to drop corners, one at a time.'}</div>${S.drawPts ? `<div class="row"><button data-a="drawdone" class="on" ${S.drawPts.length < 3 ? 'disabled' : ''}>Finish shape</button><button data-a="drawundo">Undo point</button><button data-a="drawcancel" class="warn">Cancel</button></div>` : ''}` : '<div class="muted">Tap the ground to add one.</div>'}` : '<div class="muted">Tap a collider. Drag it to move it, pull the handles to resize, raise or turn it.</div>'}
      ${inspectorHTML()}`;
    if (t === 'build') {
      if (!S.bp || !bps[S.bp]) {
        const builds = Object.entries(bps);
        return `<div class="row"><button data-a="newbp" class="on">+ New build</button></div>
        <h4>Your builds</h4>${builds.length ? `<div class="list">${builds.map(([id, b]) => `<div class="row"><button data-bp="${id}" style="flex:1">${esc(b.name)} <span class="muted">(${b.parts.length} parts, ${props.filter((p) => p.type === 'bp:' + id).length} placed)</span></button><button data-placebp="${id}">Place</button><button class="warn" data-delbp="${id}">✕</button></div>`).join('')}</div>` : '<div class="muted">Make your own objects out of parts: a shed, a sign, a dock, a ramp... Place a build as many times as you like; editing it updates every copy.</div>'}`;
      }
      const bp = bps[S.bp], pt = bp.parts[S.part];
      return `<div class="row"><button data-a="donebp">← All builds</button><button data-placebp="${S.bp}">Place copies</button></div>
      <label>Name <input type="text" data-bpname value="${esc(bp.name)}"></label>
      <label><input type="checkbox" data-bpsolid ${bp.solid !== false ? 'checked' : ''}>Solid (gets a collider)</label>
      <h4>Add part</h4><div class="row">${Object.entries(SHAPES).map(([k, l]) => `<button data-addpart="${k}">${l}</button>`).join('')}</div>
      <h4>Parts</h4><div class="row">${bp.parts.map((p, i) => `<button data-part="${i}" class="${i === S.part ? 'on' : ''}">${i + 1}. ${SHAPES[p.sh] || p.sh}</button>`).join('')}</div>
      ${pt ? `<h4>Part ${S.part + 1}</h4>
        <div class="row"><select data-pf="sh">${Object.entries(SHAPES).map(([k, l]) => `<option value="${k}" ${pt.sh === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select data-pf="key">${MATS.filter((k) => WM[k]).map((k) => `<option value="${k}" ${pt.key === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
        <input type="color" data-pf="col" value="${hex(pt.col)}"></div>
        <div class="grid2">${num('px', 'x', pt.x)}${num('pz', 'z', pt.z)}${num('py', 'up', pt.y)}${num('pry', 'turn°', (pt.ry || 0) * 180 / Math.PI, 1)}${num('pw', 'width', pt.w)}${num('pd', 'depth', pt.d)}${num('ph', 'height', pt.h)}</div>
        <div class="row" style="margin-top:4px"><button data-a="duppart">Duplicate</button><button class="warn" data-a="delpart">Delete part</button></div>` : '<div class="muted">Tap a part in the world or in the list.</div>'}`;
    }
    if (t === 'save') return `<div class="stat dv-status">${esc(status)}</div>
      <div class="row" style="margin-top:6px"><button data-a="save">Save now</button><button data-a="undo">Undo</button>${S.editing ? '<button data-a="play">Play from here</button>' : ''}</div>
      <div class="muted" style="margin-top:6px">Your terrain, moved objects, colliders, props and builds are stored with the game, so Claude can read them too.</div>
      <h4>Stats</h4><div class="stat" id="dv-stats"></div>`;
    return '';
  }
  function renderPanel() {
    panel.classList.toggle('open', S.open);
    try { localStorage.setItem('mg-dev-view', JSON.stringify(view)); } catch (e) { /* storage blocked */ }
    hint.textContent = (HINTS[S.tab] || '') + '  ·  Right drag orbit · wheel zoom · WASD pan · Ctrl+Z undo · 1-9 tabs';
    if (!S.open) return;
    const body = panel.querySelector('.dv-body'), sc = body ? body.scrollTop : 0;
    panel.classList.toggle('min', !!S.min);
    panel.innerHTML = `
      <div class="dv-head" data-a="min"><b>DEV${S.editing ? ' · EDITING' : ''}</b><button data-a="edit" class="${S.editing ? 'on' : ''}">${S.editing ? 'Done' : 'Edit world'}</button><button data-a="close">×</button></div>
      <div class="dv-tabs">${TABS.map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="dv-body">${tabHTML()}</div>
      <div class="save"><span class="dv-status">${esc(status)}</span>${S.editing ? '<button data-a="undo">Undo</button>' : ''}</div>`;
    const b = panel.querySelector('.dv-body'); if (b) b.scrollTop = sc;
  }
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-a]'); if (!t) return;
    const d = t.dataset, a = d.a;
    if (a === 'min') { if (e.target === t || e.target.tagName === 'B') { S.min = !S.min; renderPanel(); } return; }
    if (a === 'close') { e.stopPropagation(); toggleOpen(); return; }
    if (a === 'edit') { e.stopPropagation(); setEditing(!S.editing); return; }
    if (d.tab) { setTab(d.tab); return; }
    if (d.t) { if (S.roadLast >= 0 && d.t !== 'draw') finishRoad(); S.tool = d.t; if (S.tool !== 'select' && S.tool !== 'water') S.sel = null; if (S.tool !== 'add' && S.tool !== 'wdraw') S.drawPts = null; dirtyOverlay(); }
    if (d.c) { S.colShape = d.c; if (d.c !== 'draw') S.drawPts = null; }
    if (d.layer) S.layer = d.layer;
    if (d.lpre) S.lpre = d.lpre;
    if (a === 'lreset' && S.sel && S.sel.kind === 'light') { pushUndo(); resetLight(S.sel.L); markDirty('e'); dirtyOverlay(); }
    if (d.rt) { S.roadType = d.rt; S.roadW = RD.DEFAULT_W[d.rt]; }
    if (d.et && S.sel && S.sel.kind === 'edge' && EDGES[S.sel.k]) { pushUndo(); const e = EDGES[S.sel.k]; RD.setType(e, d.et); e.w = RD.DEFAULT_W[d.et]; e.nt = RD.isPath(d.et) ? true : e.nt && !RD.isPath(RD.etype(e)); roadsDone(); }
    if (a === 'roaddone') { finishRoad(); return; }
    if (a === 'delroad' && S.sel && S.sel.kind === 'edge') { deleteEdge(S.sel.k); return; }
    if (a === 'delnode' && S.sel && S.sel.kind === 'node') { deleteNode(S.sel.i); return; }
    if (a === 'splitroad' && S.sel && S.sel.kind === 'edge') { pushUndo(); const e = EDGES[S.sel.k]; const i = splitEdge(S.sel.k, (NODES[e.a].x + NODES[e.b].x) / 2, (NODES[e.a].z + NODES[e.b].z) / 2); S.sel = { kind: 'node', i }; roadsDone(); }
    if (a === 'drawfrom' && S.sel && S.sel.kind === 'node') { S.roadLast = S.sel.i; S.tool = 'draw'; }
    if (a === 'resetR' && confirm('Put every road back the way the map was built?')) { pushUndo(); applyRoads(null); S.sel = null; S.roadLast = -1; markDirty('e'); }
    if (a === 'resetG' && confirm('Put the ground paint back to how the map started (sandy lake shore)?')) { pushUndo(); GR.resetPaint(); markDirty('g'); }
    if (a === 'clearG' && confirm('Remove all ground paint?')) { pushUndo(); GR.clearPaint(); markDirty('g'); }
    if (d.pr) S.prop = d.pr;
    if (d.bp) { editBp(d.bp); return; }
    if (d.placebp) { S.prop = 'bp:' + d.placebp; S.bp = null; S.part = -1; bpInst = null; setTab('objects'); S.tool = 'place'; renderPanel(); return; }
    if (d.delbp) { deleteBp(d.delbp); return; }
    if (d.addpart) { addPart(d.addpart); return; }
    if (d.part !== undefined) { S.part = +d.part; dirtyOverlay(); }
    if (a === 'newbp') { newBp(); return; }
    if (a === 'donebp') { S.bp = null; S.part = -1; bpInst = null; dirtyOverlay(); }
    if (a === 'editbp' && S.sel && S.sel.kind === 'prop') { editBp(S.sel.p.type.slice(3), S.sel.p); return; }
    if (a === 'duppart') { dupPart(); return; }
    if (a === 'delpart') { delPart(); return; }
    if (a === 'rotl' || a === 'rotr') { pushUndo(); rotSel(a === 'rotl' ? Math.PI / 12 : -Math.PI / 12); markDirty('e'); }
    if (a === 'level') levelUnderSel();
    if (a === 'drawdone') { finishDraw(); return; }
    if (a === 'drawundo' && S.drawPts) { S.drawPts.pop(); if (!S.drawPts.length) S.drawPts = null; }
    if (a === 'drawcancel') S.drawPts = null;
    if (a === 'delvtx') { removeVertex(); return; }
    if (a === 'del') deleteSel();
    if (a === 'reset') resetSel();
    if (a === 'desel') { S.sel = null; dirtyOverlay(); }
    if (a === 'resetT') { if (confirm('Clear all hand-sculpted terrain?')) { pushUndo(); TER.delta.fill(0); TER.recompute(); markDirty('t'); } }
    if (a === 'day') setClock && setClock(12);
    if (a === 'undo') { doUndo(); return; }
    if (a === 'play') { playHere(); return; }
    if (a === 'save') { saveTimer = 0; saveNow(); }
    renderPanel();
  });
  panel.addEventListener('change', (e) => {
    const t = e.target, d = t.dataset;
    if (d.v) { view[d.v] = t.checked; dirtyOverlay(); renderPanel(); return; }
    if (S.sel && S.sel.kind === 'light' && (d.lc !== undefined || d.li !== undefined || d.lg !== undefined || d.la !== undefined || d.lf !== undefined || ['lx', 'lz', 'ly'].includes(d.f))) {
      const L = S.sel.L; pushUndo(); detachLight(L);
      if (d.lc !== undefined) setLightColor(L, parseInt(t.value.slice(1), 16));
      if (d.li !== undefined) L.i = parseFloat(t.value);
      if (d.lg !== undefined) { const hl = lightHalo.get(L); if (hl) hl.s = parseFloat(t.value); }
      if (d.la !== undefined) L.always = t.checked;
      if (d.lf !== undefined) L.flicker = t.checked;
      if (d.f) { const v = parseFloat(t.value); if (isFinite(v)) L[d.f === 'lx' ? 'x' : d.f === 'lz' ? 'z' : 'y'] = d.f === 'ly' ? Math.max(0.2, v) : v; }
      syncLight(L); lightsChanged(); markDirty('e'); dirtyOverlay(); renderPanel(); return;
    }
    if (d.ent !== undefined && S.sel && S.sel.kind === 'edge') { pushUndo(); EDGES[S.sel.k].nt = !t.checked; roadsDone(); renderPanel(); return; }
    if (d.nb !== undefined && S.sel && S.sel.kind === 'node') { pushUndo(); NODES[S.sel.i].bulb = t.checked ? 9 : 0; roadsDone(); renderPanel(); return; }
    if (d.ncw !== undefined && S.sel && S.sel.kind === 'node') { pushUndo(); NODES[S.sel.i].cw = t.checked; roadsDone(); renderPanel(); return; }
    if (d.rw !== undefined && !d.f) { S.roadW = parseFloat(t.value); renderPanel(); return; }
    if (d.f && ['rw', 'nx', 'nz'].includes(d.f) && S.sel) {
      const v = parseFloat(t.value); if (!isFinite(v)) return;
      pushUndo();
      if (d.f === 'rw' && S.sel.kind === 'edge') EDGES[S.sel.k].w = Math.max(1, Math.min(24, v));
      if (S.sel.kind === 'node') NODES[S.sel.i][d.f === 'nx' ? 'x' : 'z'] = v;
      roadsDone(); renderPanel(); return;
    }
    if (d.amp !== undefined) { pushUndo(); TER.settings.amp = parseFloat(t.value); TER.computeBase(); TER.recompute(); markDirty('t'); renderPanel(); return; }
    if (d.bpname !== undefined && S.bp) { pushUndo(); bps[S.bp].name = t.value.slice(0, 40) || 'My build'; markDirty('e'); renderPanel(); return; }
    if (d.bpsolid !== undefined && S.bp) { pushUndo(); bps[S.bp].solid = t.checked; refreshBp(S.bp); markDirty('e'); return; }
    if (d.pf && S.bp && S.part >= 0) {
      pushUndo(); const pt = bps[S.bp].parts[S.part];
      if (d.pf === 'col') pt.col = parseInt(t.value.slice(1), 16); else pt[d.pf] = t.value;
      refreshBp(S.bp); markDirty('e'); renderPanel(); return;
    }
    if (d.f) {
      const v = parseFloat(t.value); if (!isFinite(v)) return;
      const k = d.f;
      const PF = { px: 'x', pz: 'z', py: 'y', pw: 'w', pd: 'd', ph: 'h', pry: 'ry' };
      if (PF[k] && S.bp && S.part >= 0) {
        pushUndo(); const pt = bps[S.bp].parts[S.part], f = PF[k];
        pt[f] = f === 'ry' ? v * Math.PI / 180 : ['w', 'd', 'h'].includes(f) ? Math.max(0.02, v) : v;
        refreshBp(S.bp); markDirty('e'); renderPanel(); return;
      }
      const s = S.sel; if (!s) return;
      pushUndo();
      if (s.kind === 'group') { const Q = TER.groups[s.g]; if (k === 'gs') Q.s = Math.max(0.2, Math.min(5, v)); if (k === 'gr') Q.r = v * Math.PI / 180; TER.applyGroups(); }
      else if (s.kind === 'prop') { if (k === 's') s.p.s = Math.max(0.15, Math.min(8, v)); if (k === 'pr') s.p.r = v * Math.PI / 180; syncProp(s.p); TER.applyColliders(); }
      else {
        const q = s.kind === 'col' ? TER.liveCanon(s.m) : s.a.q;
        q[k] = k === 'rot' ? v * Math.PI / 180 : ['w', 'd', 'r', 'h'].includes(k) ? Math.max(0.05, v) : v;
        if (s.kind === 'col') s.m.ov = TER.unxformCanon(q, TER.groups[s.m.grp]);
        TER.applyColliders();
      }
      markDirty('e'); dirtyOverlay(); renderPanel();
    }
  });
  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.b) { S.brush[t.dataset.b] = parseFloat(t.value); const sp = t.nextElementSibling; if (sp) sp.textContent = t.dataset.b === 'r' ? `${S.brush.r} m` : S.brush.s.toFixed(2); }
    if ((t.dataset.li !== undefined || t.dataset.lg !== undefined) && S.sel && S.sel.kind === 'light') {
      const v = parseFloat(t.value), sp = t.nextElementSibling;
      if (t.dataset.li !== undefined) { S.sel.L.i = v; if (sp) sp.textContent = v.toFixed(2); }
      else { const hl = lightHalo.get(S.sel.L); if (hl) { hl.s = v; syncLight(S.sel.L); } if (sp) sp.textContent = v.toFixed(1); }
    }
    if (t.dataset.rw !== undefined && !t.dataset.f) { const sp = t.nextElementSibling; if (sp) sp.textContent = t.value + ' m'; }
    if (t.dataset.amp !== undefined) { const sp = t.nextElementSibling; if (sp) sp.textContent = parseFloat(t.value).toFixed(2) + '×'; }
  });

  // ---------------- per frame ----------------
  let statT = 0, fpsN = 0, fpsT = 0, fps = 0;
  function editorCamera(dt) {
    if (!S.editing) return false;
    const sp = cam.dist * 0.9 * dt, fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    if (held.has('w') || held.has('arrowup')) { cam.x -= fx * sp; cam.z -= fz * sp; }
    if (held.has('s') || held.has('arrowdown')) { cam.x += fx * sp; cam.z += fz * sp; }
    if (held.has('a') || held.has('arrowleft')) { cam.x -= fz * sp; cam.z += fx * sp; }
    if (held.has('d') || held.has('arrowright')) { cam.x += fz * sp; cam.z -= fx * sp; }
    const ty = TER.heightAt(cam.x, cam.z) + 0.5;
    camera.position.set(cam.x + fx * Math.cos(cam.pitch) * cam.dist, ty + Math.sin(cam.pitch) * cam.dist, cam.z + fz * Math.cos(cam.pitch) * cam.dist);
    camera.position.y = Math.max(camera.position.y, TER.heightAt(camera.position.x, camera.position.z) + 1);
    camera.lookAt(cam.x, ty, cam.z);
    camera.userData.noLift = true;
    if (scene.fog) { scene.fog.near = 120 + cam.dist; scene.fog.far = 500 + cam.dist * 2; }
    if (stroke && stroke.paint) { GR.paint(S.layer, stroke.pt.x, stroke.pt.z, S.brush.r, Math.min(1, S.brush.s * dt * 14)); markDirty('g'); }
    else if (stroke && !stroke.pull) brush(stroke.pt, dt);
    return true;
  }
  if (o.renderer) o.renderer.info.autoReset = false;
  const lastInfo = { calls: 0, tris: 0 };
  function frame(dt) {
    if (o.renderer) { lastInfo.calls = o.renderer.info.render.calls; lastInfo.tris = o.renderer.info.render.triangles; o.renderer.info.reset(); }
    fpsN++; fpsT += dt; if (fpsT >= 0.5) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
    if (saveTimer > 0 && (saveTimer -= dt) <= 0) saveNow();
    const vis = S.open;
    colL.visible = vis && view.cols; entL.visible = vis && view.ents; roadL.visible = vis && view.roads; lightL.visible = vis && view.lights; gridM.visible = vis && (view.grid || (S.editing && S.tab === 'terrain'));
    selL.visible = S.editing;
    if (overlayT > 0 && (overlayT -= dt) <= 0) overlayDirty = true;
    if (overlayDirty && vis) { overlayDirty = false; rebuildColliders(); rebuildRoads(); rebuildLights(); rebuildSel(); }
    else if (S.editing && drag && ['move', 'handle', 'part'].includes(drag.mode)) rebuildSel();
    if (vis && view.ents) updateEntities();
    // handles: while one is dragged keep using the handle object grabbed at the start (its drag closure holds the start shape)
    if (!dragHandle) buildHandles();
    else { buildHandles(); }
    drawHandles();
    // brush ring
    const ringAt = S.editing && (S.tab === 'terrain' || (S.tab === 'ground' && S.tool === 'paint')) ? (stroke && stroke.pull ? stroke.pt : S.hoverPt) : null;
    if (S.editing && S.tab === 'roads' && S.tool === 'draw') rebuildSel();
    ringL.visible = !!ringAt;
    if (ringAt) {
      const P2 = [], C2 = [], c = ringAt, R = S.brush.r;
      for (let i = 0; i < 40; i++) { const a0 = i / 40 * 6.283, a1 = (i + 1) / 40 * 6.283, x0 = c.x + Math.cos(a0) * R, z0 = c.z + Math.sin(a0) * R, x1 = c.x + Math.cos(a1) * R, z1 = c.z + Math.sin(a1) * R; pushSeg(P2, C2, [x0, TER.heightAt(x0, z0) + 0.15, z0], [x1, TER.heightAt(x1, z1) + 0.15, z1], 0xffffff); }
      const y = TER.heightAt(c.x, c.z); pushSeg(P2, C2, [c.x, y, c.z], [c.x, y + 3, c.z], 0xffffff);
      setLines(ringL, P2, C2);
    }
    if (vis && (statT -= dt) <= 0) {
      statT = 0.5;
      const el = document.getElementById('dv-stats');
      if (el) {
        const tx = S.editing ? cam.x : P.x, tz = S.editing ? cam.z : P.z;
        el.textContent = `${fps.toFixed(0)} fps · ${lastInfo.calls} draws · ${(lastInfo.tris / 1000).toFixed(0)}k tris\n${S.editing ? 'camera' : 'cat'} ${tx.toFixed(1)}, ${tz.toFixed(1)} · ground ${TER.heightAt(tx, tz).toFixed(2)} m\n${TER.colModel.filter((m) => !m.del).length + TER.extraCols.length} colliders · ${TER.groups.length - 1} movable objects · ${props.length} props · ${Object.keys(bps).length} builds`;
      }
    }
  }
  renderPanel();
  startLoad().catch((err) => setStatus('Could not load saved world: ' + (err && err.message)));
  window.__devcam = cam; window.__dev = { S, view, props, bps, pick, groundPoint, TER, GR, RD, NODES, EDGES, setTab, newBp, addPart, camera, lights, addLight, lightsDoc, setClock, get handles() { return handles; } };
  return {
    camera: editorCamera,
    frame,
    after: placeLabels,
    get editing() { return S.editing; },
    get open() { return S.open; },
    save: saveNow,
    serializeEdits,
  };
}
