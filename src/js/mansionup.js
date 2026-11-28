// Maple Grove Estates, second storeys (diet 2026-11-28: "add second stories to the mansions" and "more interactivity
// with the interior of the mansions").
// The staircase stands in the great room; climbing it past half height fades to the floor above, which is its own
// room (`<id>-up`, interiors.js `portals`) so only the floor the cat is on is in memory. Upstairs: gallery hall around
// the stairwell, guest suite, home gym, spa (hot tub + sauna), laundry with a chute back down, game room, two
// bedrooms and two baths. Same kit and cost rules as the ground floor (roomparts.js: merged meshes, one atlas, baked
// light).
// Things to do, shared by both floors: `knockables` (one instanced mesh of small objects the cat can push off
// tables, with a fall and a clatter), the alarm keypad, a rideable robot vacuum, a sleeper to wake, a golden koi
// hidden in every house.
import * as THREE from 'three';
import * as INTR from './interiors.js';
import { KIT } from './rooms.js';
import { makeAtlas, plan, parts, zoneLights } from './roomparts.js';
import { MS, floorTextures } from './mansions.js';

const PI = Math.PI;
const W = 22, D = 18, H = 3.0;
const RISE = 0.18, RUN = 0.23, SX = -4.35, SW = 1.1, SZ = 1.7, NSTEP = 17;   // the staircase (ground floor, unmirrored)
export const player = () => (typeof window !== 'undefined' && window.__G && window.__G.P) || null;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** Ground floor: the staircase along the great room's side wall. Returns the portal that leads upstairs and the walkable ramp. */
export function stairs(B, P, cols, mx, th, Hc, upId) {
  const x = mx * SX, Q = { ao: false, round: false };
  for (let k = 1; k <= NSTEP; k++) {
    const top = RISE * k, zc = SZ - RUN * (k - 0.5);
    B.box('plain', th.trim, SW, top, RUN, x, top / 2, zc, 0, Q);
    B.box('wood', th.wood, SW + 0.04, 0.035, RUN + 0.03, x, top + 0.006, zc, 0, Q);
    B.box('cloth', th.accent, 0.62, 0.012, RUN, x, top + 0.03, zc, 0, Q);
    if (k > 2) cols.push({ kind: 'box', cx: x, cz: zc, w: SW, d: RUN, rot: 0, h: RISE * (k - 2) });   // solid from the side, never in the way of a cat on the ramp
    if (k <= 13) {   // balusters and a stepped handrail on the open side
      const rx = mx * (SX + SW / 2 - 0.04);
      B.box('plain', th.trim, 0.035, 0.9, 0.035, rx, top + 0.47, zc, 0, Q);
      B.box('wood', th.wood, 0.07, 0.05, RUN + 0.02, rx, top + 0.93, zc, 0, Q);
      if (k > 1) B.box('wood', th.wood, 0.07, RISE, 0.05, rx, top + 0.93 - RISE / 2, zc + RUN / 2, 0, Q);
    }
  }
  B.box('wood', th.wood, 0.13, 1.15, 0.13, mx * (SX + SW / 2 - 0.04), 0.575, SZ + 0.08, 0, Q);
  B.sph('wood', th.wood, 0.1, mx * (SX + SW / 2 - 0.04), 1.22, SZ + 0.08, { ws: 6, hs: 4, ao: false });
  // the opening in the ceiling, and the cupboard under the stairs
  B.flat('plain', 0x15120f, SW + 0.1, 2.5, x, Hc - 0.17, -1.35, 0, { ao: false, tint: false, down: true });
  const F = P.at(mx * (SX + SW / 2), -1.6, mx * PI / 2);
  F.box('wood', th.wood, 0.72, 1.5, 0.04, 0, 0.75, 0.01); F.box('plain', th.trim, 0.82, 0.06, 0.05, 0, 1.53, 0.01); F.sph('shiny', th.metal, 0.03, 0.26, 0.8, 0.05, { ws: 5, hs: 4 });
  const ramp = { t0: RISE * (NSTEP + 0.5), t1: RISE * 0.5, cx: x, cz: SZ - RUN * NSTEP / 2, hw: SW / 2, hd: RUN * NSTEP / 2, c: 1, s: 0 };
  const portal = { x0: Math.min(mx * (SX - SW / 2), mx * (SX + SW / 2)), x1: Math.max(mx * (SX - SW / 2), mx * (SX + SW / 2)), z0: SZ - RUN * NSTEP, z1: SZ - RUN * 8, minY: RISE * 8 - 0.05, to: upId, spawn: { x: mx * SX, z: -3.3, yaw: 0 } };
  return { portal, ramp };
}

/** Small things on tables the cat can push off. items [{ x, y, z, c, name, s? }] in room-local coords.
 *  One InstancedMesh (one draw call); only falling pieces are touched per frame. */
export function knockables(items, onAll) {
  const geo = new THREE.CylinderGeometry(0.045, 0.065, 0.2, 6); geo.translate(0, 0.1, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), items.length);
  mesh.userData.noBake = true; mesh.frustumCulled = false; mesh.name = 'mansion:knock';
  const st = items.map((it) => ({ ...it, vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, state: 0, s: it.s ?? 1 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const put = (i) => { const k = st[i]; e.set(k.rot, k.yaw || 0, 0); q.setFromEuler(e); m4.compose(v.set(k.x, k.y, k.z), q, sc.setScalar(k.s)); mesh.setMatrixAt(i, m4); mesh.instanceMatrix.needsUpdate = true; };
  st.forEach((k, i) => { put(i); mesh.setColorAt(i, col.setHex(k.c)); });
  let moving = 0, down = 0;
  return {
    mesh, st,
    /** push piece i away from (px, pz) */
    knock(i, px, pz) {
      const k = st[i]; if (k.state) return false;
      let dx = k.x - px, dz = k.z - pz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      k.vx = dx * 1.5; k.vz = dz * 1.5; k.vy = 1.3; k.spin = 7; k.yaw = Math.atan2(dx, dz); k.state = 1; moving++;
      return true;
    },
    update(dt) {
      if (!moving) return;
      for (let i = 0; i < st.length; i++) {
        const k = st[i]; if (k.state !== 1) continue;
        k.vy -= 9.8 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt; k.rot += k.spin * dt;
        if (k.y <= 0.05) {
          k.y = 0.05; k.rot = PI / 2; k.state = 2; moving--; down++;
          try { MS.A && MS.A.Sfx && (MS.A.Sfx.crash ? MS.A.Sfx.crash(1.5) : MS.blip(180)); } catch (err) { /* no sound */ }
          if (down === st.length && onAll) onAll();
        }
        put(i);
      }
    },
    left: () => st.length - down,
  };
}
const KNOCK = ['Tap. Tap. Tap. Over the edge it goes.', 'You look right at nobody in particular and push it off.', 'It was too close to the edge. It is not any more.', 'Gravity checked. Still working.'];
/** hotspots + bookkeeping for a set of knockables; `spot` is the room's own (mirroring) hotspot helper, `mx` its mirror */
export function knockSpots(K, spot, mx, group, hot, houseId) {
  K.st.forEach((k, i) => {
    spot('knock' + i, mx * k.x, k.z, 0.85, 'Knock the ' + k.name + ' off', () => {
      const P = player(), o = group().position;
      if (!K.knock(i, P ? P.x - o.x : k.x, P ? P.z - o.z + 0.01 : k.z + 1)) return;
      const h = hot.find((q) => q.id === 'knock' + i); if (h && h.live) h.live.r = 0;
      MS.S.knocked = (MS.S.knocked || 0) + 1; MS.blip(520);
      MS.say(K.left() > 1 ? KNOCK : KNOCK, 2.5);
    });
  });
  void houseId;
}

/** the upper floor of one house. spec as mansions.js: { id, model, mirror, seed, family, gary } */
export function buildUpstairs(spec, ctx) {
  const { T } = ctx;
  const { makeBuilder, rnd, pick } = KIT;
  KIT.reseed(5000 + spec.seed * 6151);
  const gary = !!spec.gary, th = MS.THEMES[gary ? 'gary' : MS.MODEL_THEME[spec.model] || 'classic'];
  const mx = spec.mirror ? -1 : 1, say = MS.say, blip = MS.blip, A = () => MS.A, FAM = spec.family;
  const B = makeBuilder(THREE, T), tex = floorTextures(), atlas = makeAtlas(THREE, 1024), lights = [];
  B.def('pwall', { kind: 'lambert', map: tex.plaster }); B.def('fwood', { kind: 'lambert', map: tex.wood }); B.def('ftile', { kind: 'lambert', map: tex.tile });
  B.def('night', { kind: 'basic', map: tex.night }); B.def('mirror', { kind: 'phong', shininess: 120, specular: 0xffffff });
  B.def('atlas', { kind: 'lambert', map: atlas.tex }); B.def('aglow', { kind: 'basic', map: atlas.tex });

  const rect = (x0, x1, z0, z1, o) => ({ x0: mx > 0 ? x0 : -x1, x1: mx > 0 ? x1 : -x0, z0, z1, ...o });
  const wx = (x, from, to, doors) => ({ x: mx * x, from, to, doors });
  const wz = (z, from, to, doors) => ({ z, from: mx > 0 ? from : -to, to: mx > 0 ? to : -from, doors: (doors || []).map((d) => ({ ...d, at: mx * d.at })) });
  const hallF = { floor: 'fwood', fcol: th.floorWood, ftile: 1.3, wall: th.wall, wains: { c: th.trim, y: 1.0 } };
  const kidCol = gary ? 0xc8b8a0 : pick([0xf0c8d8, 0xc8dcf0, 0xd8f0c8]), teenCol = gary ? 0x8a7a5a : pick([0x3a3e5a, 0x4a3a4a, 0x2a4a4a]);
  const hx0 = SX - SW / 2 - 0.1, hx1 = SX + SW / 2, hz0 = -2.6, hz1 = 0.2;    // the stairwell opening (x -5 .. -3.8)
  const rooms = [
    rect(hx1, 5, -4, hz1, hallF), rect(-5, 5, hz1, 2, hallF), rect(-5, hx1, -4, hz0, hallF),                                   // gallery hall (3 pieces around the stairwell)
    rect(-11, -3, -9, -4, { floor: 'cloth', fcol: th.carpet, ftile: 0.8, wall: th.wallAlt }),                                // guest suite
    rect(-3, 5, -9, -4, { floor: 'ftile', fcol: 0x4a4e56, ftile: 1.0, wall: 0xd8dce0, base: 0x2a2a2e }),                      // gym
    rect(5, 11, -9, -1, { floor: 'ftile', fcol: th.name === 'tuscan' ? 0xc8a070 : 0xb8c4c8, ftile: 0.9, wall: 0xe8ece8, wains: { c: 0xd8c8a8, y: 1.1 } }),   // spa
    rect(5, 11, -1, 2, { floor: 'ftile', fcol: 0xe8e8e8, ftile: 0.6, wall: 0xdce8f0 }),                                       // laundry
    rect(3.2, 11, 2, 9, { floor: 'cloth', fcol: 0x5a5a66, ftile: 0.8, wall: teenCol }),                                       // teen room
    rect(-3, 3.2, 2, 9, { floor: 'cloth', fcol: gary ? 0x5a1a22 : 0x2a3a5a, ftile: 0.8, wall: th.accentWall, wains: { c: th.wood, y: 1.0, rail: th.woodLt }, base: th.wood }),   // game room
    rect(-11, -3, 2, 9, { floor: 'cloth', fcol: 0xe8e0d0, ftile: 0.8, wall: kidCol, wains: { c: 0xfafafa, y: 1.0 } }),      // kid's room
    rect(-11, -5, -1, 2, { floor: 'ftile', fcol: 0xf4f4f4, ftile: 0.5, wall: kidCol, wains: { c: 0xf4f2ee, y: 1.2 } }),     // kid's bath
    rect(-11, -5, -4, -1, { floor: 'ftile', fcol: th.marble, ftile: 0.8, wall: 0xe4ecec, wains: { c: 0xf4f2ee, y: 1.2 } }), // hall bath
  ];
  const walls = [
    wz(-4, -11, 5, [{ at: -4.0, w: 0.9 }, { at: 1, w: 1.6, h: 2.4 }]),
    wx(-3, -9, -4), wx(5, -9, 2, [{ at: -2.5, w: 1.0 }, { at: 1.1, w: 0.9 }]), wz(-1, 5, 11),
    wz(2, -11, 11, [{ at: -8, w: 0.9 }, { at: -4.15, w: 0.9 }, { at: 0.3, w: 1.8, h: 2.4 }, { at: 4.2, w: 0.9 }]),
    wx(-3, 2, 9), wx(3.2, 2, 9),
    wx(-5, -4, 2, [{ at: -3.3, w: 0.9 }]), wz(-1, -11, -5),
  ];
  const { cols } = plan(B, THREE, { w: W, d: D, h: H, rooms, walls, doors: [], base: th.trim, crown: th.crown ?? th.trim, trim: th.trim, wallTile: 2.2 });
  const P = parts({ B, THREE, cols, A: atlas, lights, rnd, pick });
  const m = (fn, x, z, ry = 0, ...rest) => P[fn](mx * x, z, mx * ry, ...rest);
  const mw = (fn, x, y, z, ry, ...rest) => P[fn](mx * x, y, z, mx * ry, ...rest);
  const mf = (x, z, ry = 0) => P.at(mx * x, z, mx * ry);
  const box = (cx, cz, w, d, h) => cols.push({ kind: 'box', cx: mx * cx, cz, w, d, rot: 0, h });
  const art = (k) => (gary ? MS.garyPic(atlas, k) : P.paintTex(spec.id + ':u' + k, ['family', 'land', 'abstract', 'portrait', 'horse', 'map'][k % 6], k % 2 ? 72 : 96, k % 2 ? 96 : 72));
  const hot = [];
  const spot = (id, x, z, r, label, onUse) => hot.push({ id, x: mx * x, z, r, label, onUse });
  const heal = (n) => { const a = A(); if (a) a.G.hp = Math.min(100, (a.G.hp || 0) + n); };
  const metal = th.metal, Q = { ao: false, round: false }, QT = { ao: false, tint: false };
  const knocks = [];
  const kn = (x, y, z, c, name, s) => knocks.push({ x: mx * x, y, z, c, name, s });
  let group = null;

  // ============================================================ stairwell + gallery hall
  {
    const cx = (hx0 + hx1) / 2 + 0.05, len = hz1 - hz0;
    { const F = mf(-4.9, (hz0 + hz1) / 2, PI / 2); F.quad('pwall', th.wall, len, H + 1.7, 0, (H - 1.7) / 2, 0, 0, QT); }           // the well's wall, down to the dark
    { const F = mf(hx1, (hz0 + hz1) / 2, -PI / 2); F.quad('plain', 0x2a2622, len, 1.7, 0, -0.85, 0, 0, QT); }
    { const F = mf(cx, hz1, PI); F.quad('plain', 0x2a2622, SW + 0.1, 1.7, 0, -0.85, 0, 0, QT); }
    B.flat('plain', 0x100e0c, SW + 0.1, len, mx * cx, -1.7, (hz0 + hz1) / 2, 0, QT);
    B.flat('plain', 0xf4f1ea, SW + 0.1, len, mx * cx, H, (hz0 + hz1) / 2, 0, { ...QT, down: true });
    for (let j = 1; j <= 8; j++) { const zc = hz0 + RUN * (j - 0.5); B.box('wood', th.wood, SW, 0.04, RUN + 0.02, mx * SX, -RISE * j, zc, 0, Q); B.box('plain', th.trim, SW, RISE, 0.02, mx * SX, -RISE * (j - 0.5), zc - RUN / 2, 0, Q); B.box('cloth', th.accent, 0.62, 0.012, RUN, mx * SX, -RISE * j + 0.026, zc, 0, Q); }
    // railings: the long side and the far end
    const rail = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > 0.01, n = Math.round(L / 0.16);
      B.box('wood', th.wood, ax ? L : 0.07, 0.05, ax ? 0.07 : L, mx * (x0 + x1) / 2, 0.98, (z0 + z1) / 2, 0, Q);
      B.box('plain', th.trim, ax ? L : 0.05, 0.04, ax ? 0.05 : L, mx * (x0 + x1) / 2, 0.06, (z0 + z1) / 2, 0, Q);
      for (let k = 0; k <= n; k++) { const t = k / n; B.box('plain', th.trim, 0.03, 0.9, 0.03, mx * (x0 + (x1 - x0) * t), 0.52, z0 + (z1 - z0) * t, 0, Q); }
      for (const [px, pz] of [[x0, z0], [x1, z1]]) B.box('wood', th.wood, 0.11, 1.1, 0.11, mx * px, 0.55, pz, 0, Q);
      box((x0 + x1) / 2, (z0 + z1) / 2, ax ? L : 0.1, ax ? 0.1 : L, 1.1);
    };
    rail(hx1 + 0.05, hz0, hx1 + 0.05, hz1 + 0.05); rail(hx1 + 0.05, hz1 + 0.05, -4.92, hz1 + 0.05);
    box(SX, hz0 + 0.75, SW + 0.2, 0.1, 1.2);   // nobody walks into the hole: the top step is the way down
    P.rug(mx * 0.6, -1.0, 0, 2.0, 4.6, P.rugTex('hall', th.rug[0], th.rug[1], th.rug[2], 64, 96));
    P.chandelier(mx * 0.6, -1.0, H, 2.3, { r: 0.5, metal, n: 8, tiers: 1, i: 1.0 });
    m('console', 4.78, -0.6, -PI / 2, { w: 1.5, wood: th.wood }); P.tableLamp(mx * 4.78, 0.82, -1.1, { base: metal, i: 0.25 });
    kn(4.72, 0.82, -0.3, 0x3a6a9a, 'vase');
    for (let k = 0; k < 4; k++) mw('picture', -1.6 + k * 1.15, 1.65 + (k % 2) * 0.12, -3.89, 0, 0.7, 0.9, art(k), gary ? 0xe0b840 : th.wood);
    m('armchair', 3.9, -3.3, -PI / 2 - 0.5, { col: th.chair, w: 0.9, pillow: th.sofa }); P.floorLamp(mx * 4.5, -3.6, { metal });
    m('bookcase', 2.2, 1.78, PI, { w: 1.6, h: 1.2, wood: th.wood, n: 3 });
    P.plant(mx * -4.5, 1.5, { kind: 'fig' }); P.plant(mx * 3.6, 1.5, { kind: 'palm' });
    for (const [x, z] of [[-2, -3], [3, -3], [-2, 1], [3, 0.8], [-4.4, -3.3]]) P.can(mx * x, z, H, 0.4);
    spot('photos', -0.2, -3.2, 0.9, gary ? 'Look at the portraits' : 'Look at the family photos', () => say(gary ? ['Gary at the golf course. Gary at a ribbon cutting. Gary shaking hands with Gary (it is a mirror).', 'Every frame is level. He has used a level. There is a level in the drawer.'] : [`The ${FAM} family on a ski trip. On a yacht. On a different yacht. No cats in any of them. Suspicious.`, 'A school photo. The kid blinked. They framed it anyway. Good family.']));
    spot('rail', -3.2, -1.2, 0.7, 'Walk along the railing', () => say(['You walk the whole banister, tail up, without looking down once. Nobody saw. Typical.', 'One paw in front of the other, three metres above the great room. This is what the railing is for.']));
  }

  // ============================================================ guest suite
  {
    P.rug(mx * -7.2, -6.3, 0, 3.4, 2.6, P.rugTex('guest', th.rug[1], th.rug[2], th.rug[0]));
    m('bed', -7.2, -7.75, 0, { wood: th.wood, duvet: th.duvet, accent: th.accent, head: th.sofa, tuft: true, bench: true, benchCol: th.sofa });
    for (const x of [-8.65, -5.75]) m('nightstand', x, -8.7, 0, { wood: th.wood, pull: metal });
    for (const x of [-9.9, -4.3]) P.window(mx * x, 1.6, -D / 2 + 0.001, 0, 1.1, 1.9, { curtain: th.curtain, floor: true, trim: th.trim, rod: metal });
    mw('picture', -7.2, 2.1, -8.99, 0, 1.2, 0.6, art(4), gary ? 0xe0b840 : th.wood);
    const dr = m('dresser', -10.72, -5.6, PI / 2, { w: 1.5, wood: th.wood, pull: metal });
    dr.box('wood', metal, 0.34, 0.42, 0.03, 0.4, 1.12, -0.05, 0.15, { rx: -0.1 }); kn(-10.7, 0.93, -5.9, 0xe8d8e0, 'perfume');
    mw('window', -10.999, 1.7, -7.6, PI / 2, 1.2, 1.5, { trim: th.trim });
    { const F = mf(-3.5, -7.8, -PI / 2); F.rbox('plain', 0x5a3a2a, 0.5, 0.7, 0.24, 0, 0.4, 0); F.box('shiny', 0xc8a860, 0.3, 0.02, 0.03, 0, 0.78, 0); F.rbox('plain', 0x3a4a6a, 0.42, 0.55, 0.22, 0.1, 0.33, 0.35); F.col(0, 0.15, 0.6, 0.6, 0.7); }   // luggage
    m('armchair', -4.0, -5.3, -PI / 2 - 0.4, { col: th.chair, w: 0.9 }); P.floorLamp(mx * -3.5, -4.5, { metal });
    for (const x of [-9, -5.2]) P.can(mx * x, -6.2, H, 0.45);
    spot('bed', -7.2, -6.1, 1.0, 'Nap on the guest bed');
    spot('luggage', -4.1, -7.6, 0.7, 'Get in the suitcase', () => say(['You sit in the open suitcase. It is your suitcase now. That is the law.', 'Somebody is going to find white fur in Aspen.']));
  }

  // ============================================================ home gym
  {
    { const F = mf(-2.89, -6.5, PI / 2); F.box('wood', 0x2a2a2e, 4.6, 2.2, 0.03, 0, 1.25, 0); F.quad('mirror', 0xb8c8d4, 4.5, 2.1, 0, 1.25, 0.02); }
    m('treadmill', -1.2, -8.0, 0); m('treadmill', 0.2, -8.0, 0);
    { const F = mf(1.9, -8.2, 0); F.box('plain', 0x2a2a2e, 0.5, 0.1, 1.1, 0, 0.05, 0); F.box('metal', 0x8a8a90, 0.06, 0.9, 0.06, 0, 0.5, -0.3); F.rbox('plain', 0x1a1a1e, 0.24, 0.07, 0.3, 0, 0.92, -0.05); F.box('metal', 0x8a8a90, 0.06, 1.1, 0.06, 0, 0.6, 0.35); F.box('plain', 0x1a1a1e, 0.5, 0.04, 0.04, 0, 1.15, 0.35); F.cyl('plain', 0x1a1a1e, 0.22, 0.22, 0.05, 0, 0.3, 0.38, 10, { rz: PI / 2 }); F.col(0, 0, 0.5, 1.1, 1.1); }   // bike
    m('weights', 4.75, -6.3, -PI / 2);
    { const F = mf(3.4, -6.4, 0); F.rbox('plain', 0x1a1a1e, 0.4, 0.1, 1.3, 0, 0.45, 0); for (const e of [-1, 1]) F.box('metal', 0x8a8a90, 0.3, 0.42, 0.05, 0, 0.21, e * 0.5); for (const e of [-1, 1]) F.box('metal', 0x8a8a90, 0.05, 1.0, 0.05, e * 0.45, 0.5, -0.55); F.cyl('metal', 0xc8ccd4, 0.02, 0.02, 1.6, 0, 1.0, -0.55, 6, { rz: PI / 2 }); for (const e of [-1, 1]) F.cyl('plain', 0x1a1a1e, 0.2, 0.2, 0.06, e * 0.65, 1.0, -0.55, 10, { rz: PI / 2 }); F.col(0, 0, 0.9, 1.3, 0.5); }   // bench press
    { const F = mf(0.9, -5.0, 0); F.cyl('metal', 0x8a8a90, 0.015, 0.015, 0.7, 0, H - 0.35, 0, 5); F.cyl('plain', 0x8a2a2a, 0.2, 0.2, 1.1, 0, H - 1.25, 0, 10); F.col(0, 0, 0.4, 0.4, H); }   // heavy bag
    B.box('cloth', 0x7a4a9a, 0.65, 0.015, 1.8, mx * -1.6, 0.01, -5.2, 0, Q); B.cyl('cloth', 0x4a9a7a, 0.08, 0.08, 0.65, mx * -0.9, 0.08, -5.2, 8, { ao: false, rx: PI / 2 });
    for (const x of [-1.2, 2.6]) P.window(mx * x, 1.9, -D / 2 + 0.001, 0, 1.5, 1.2, { trim: th.trim });
    m('tv', 4.89, -8.0, -PI / 2, { w: 1.1, y: 2.0, console: false, screen: MS.tvTex(atlas, gary) });
    { const F = mf(4.6, -4.4, PI); F.rbox('plain', 0xe8e8ec, 0.34, 1.0, 0.34, 0, 0.5, 0); F.cyl('glass', 0xa0d0f0, 0.14, 0.14, 0.4, 0, 1.2, 0, 8); F.col(0, 0, 0.34, 0.34, 1.4); }   // water cooler
    for (const x of [-1, 3]) P.troffer(mx * x, -6.5, H, 1.2, 0, 0.7);
    spot('treadmill', -0.5, -7.0, 0.9, 'Start the treadmill', () => { const p = player(); if (p) { p.vy = 4.2; } blip(880); say(['You press the big green button while standing on the belt. You leave the treadmill backwards, at speed.', 'The belt starts. You do not. Physics sorts it out.']); });
    spot('bag', 0.9, -4.6, 0.7, 'Fight the punching bag', () => { [200, 240, 200].forEach((f, i) => setTimeout(() => blip(f), i * 110)); say(['Left, left, right. The bag swings back and gets you. You are calling it a draw.', 'You hang off the bag by all four sets of claws. It is leaking sand now. Victory.']); });
    spot('weights', 4.0, -6.3, 0.8, 'Lift', () => say(['You get under the smallest dumbbell. It does not move. You tell yourself it is bolted down.', gary ? 'Every weight is labelled "GARY". The heaviest one has dust on it.' : 'The rack goes up to fifty pounds. The dust starts at fifteen.']));
  }

  // ============================================================ spa: hot tub, sauna, massage table
  {
    const F = mf(8.3, -7.2, 0);   // the tub: a tiled box with steps
    F.rbox('ftile', 0xd8e4e8, 2.4, 0.78, 2.4, 0, 0.39, 0, 0, { round: 0.08 }); F.box('glow', 0x58b8d8, 2.05, 0.02, 2.05, 0, 0.72, 0, 0, { tint: false }); F.box('plain', 0x3a8aa8, 2.1, 0.02, 2.1, 0, 0.6, 0);
    for (let k = 0; k < 2; k++) F.box('ftile', 0xd8e4e8, 1.0, 0.26 * (2 - k), 0.3, 0, 0.13 * (2 - k), 1.35 + k * 0.3); F.col(0, 0, 2.4, 2.4, 0.78); F.col(0, 1.5, 1.0, 0.6, 0.26);
    for (let k = 0; k < 6; k++) F.sph('glow', 0xd8f4ff, 0.05, Math.sin(k * 2.3) * 0.7, 0.73, Math.cos(k * 1.7) * 0.7, { ws: 5, hs: 3, tint: false });
    lights.push({ x: mx * 8.3, y: 1.1, z: -7.2, c: 0x80d8f0, i: 0.5, halo: false });
    const S2 = mf(9.6, -2.3, PI);   // sauna cabin in the corner
    S2.box('wood', 0xb8875a, 2.6, 2.3, 0.08, 0, 1.15, 1.15); S2.box('wood', 0xb8875a, 0.08, 2.3, 2.3, -1.3, 1.15, 0, 0, Q); S2.box('wood', 0xa87848, 2.7, 0.08, 2.4, 0, 2.34, 0);
    S2.box('glass', 0xfff0d8, 0.8, 1.9, 0.03, 0.5, 1.0, 1.17); S2.box('wood', 0x9a6a3a, 2.4, 0.08, 0.6, 0, 0.5, -0.8); S2.box('wood', 0x9a6a3a, 2.4, 0.08, 0.5, 0, 1.0, -0.9);
    S2.rbox('plain', 0x3a3a3e, 0.4, 0.5, 0.4, -0.9, 0.25, 0.6); for (let k = 0; k < 6; k++) S2.sph('plain', 0x5a5a5e, 0.07, -0.9 + (k % 3 - 1) * 0.1, 0.54, 0.6 + ((k / 3) | 0) * 0.12 - 0.06, { ws: 5, hs: 3 });
    S2.col(-1.3, 0, 0.1, 2.3, 2.3); S2.col(-0.55, 1.15, 1.5, 0.1, 2.3); S2.col(0, -0.85, 2.4, 0.6, 1.0);
    lights.push({ x: mx * 9.6, y: 1.9, z: -2.3, c: 0xffb060, i: 0.6, halo: false });
    P.decal(S2, atlas.label('sauna', ['SAUNA'], '#5a3a1e', '#f0d8a8', 64, 20, { small: true }), 0.5, 0.15, -0.6, 2.05, 1.2);
    const M = mf(6.3, -4.4, 0);   // massage table
    M.rbox('cloth', 0xf4f0e8, 0.7, 0.12, 1.9, 0, 0.72, 0, 0, { round: 0.05 }); for (const ex of [-1, 1]) for (const ez of [-1, 1]) M.box('wood', th.wood, 0.06, 0.66, 0.06, ex * 0.28, 0.33, ez * 0.8); M.rbox('cloth', th.duvet, 0.5, 0.06, 0.5, 0, 0.81, -0.5, 0, { round: 0.02 }); M.col(0, 0, 0.7, 1.9, 0.78);
    { const F2 = mf(5.3, -6.6, PI / 2); F2.box('wood', th.woodLt, 1.2, 1.5, 0.34, 0, 0.75, 0); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) F2.rbox('cloth', pick([0xf4f0e8, th.duvet, 0xe8d8c8]), 0.3, 0.1, 0.28, -0.38 + k * 0.38, 0.25 + r * 0.45, 0.04, 0, { round: 0.03 }); F2.col(0, 0, 1.2, 0.34, 1.5); }
    for (const z of [-6.2, -3.4]) mw('window', 10.999, 1.8, z, -PI / 2, 1.4, 1.4, { trim: th.trim });
    P.window(mx * 6.4, 1.8, -D / 2 + 0.001, 0, 1.2, 1.4, { trim: th.trim });
    P.plant(mx * 10.5, -8.5, { kind: 'palm' }); P.plant(mx * 5.5, -1.5, { kind: 'fig' });
    for (const [x, z] of [[6.5, -5.5], [9.5, -5.0]]) P.can(mx * x, z, H, 0.45, 0xf4f8ff);
    spot('hottub', 8.3, -5.5, 1.0, 'Test the hot tub', () => { const p = player(); if (p) p.vy = 5; A() && A().Sfx.splash && A().Sfx.splash(); blip(300); say(['One paw. Just one paw. It is WET. You leave the room vertically.', 'You lean over to drink and the jets turn on. You have never moved this fast.']); });
    spot('sauna', 9.4, -3.9, 0.9, 'Bake in the sauna', () => { heal(15); say('Eighty degrees and cedar. You melt into a flat white puddle on the top bench. +15 health.'); });
    spot('massage', 6.3, -3.2, 0.8, 'Knead the massage table', () => say(['You knead the table. Technically you are the one giving the massage.', 'A warm towel, folded just so. You unfold it by lying on it.']));
  }

  // ============================================================ laundry (and the chute back down)
  {
    for (let k = 0; k < 2; k++) { const F = mf(6.0 + k * 0.75, -0.62, 0); F.rbox('shiny', 0xf4f4f6, 0.68, 0.9, 0.66, 0, 0.45, 0); F.cyl('plain', k ? 0x2a2a30 : 0x8ab8d8, 0.2, 0.2, 0.03, 0, 0.5, 0.34, 12, { rx: PI / 2 }); F.box('plain', 0x2a2a30, 0.6, 0.08, 0.02, 0, 0.84, 0.335); F.col(0, 0, 0.68, 0.66, 0.9); }
    const c = m('cabinets', 8.6, -0.68, 0, { w: 2.6, col: 0xf2eee6, top: 0xd8d8d8, upper: true, pull: 0x8a8a90 }); P.sink(c, 0.5, 0.9, 0);
    { const F = mf(9.4, 1.45, PI); F.rbox('plain', 0xe8dcc0, 0.6, 0.45, 0.45, 0, 0.25, 0); for (let k = 0; k < 4; k++) F.rbox('cloth', pick([0xf4f0e8, 0x7a2a2a, 0x3a6a9a, 0xe8c040]), 0.3, 0.1, 0.26, (k % 2 - 0.5) * 0.24, 0.5 + ((k / 2) | 0) * 0.06, (rnd() - 0.5) * 0.1, k, { round: 0.03 }); F.col(0, 0, 0.6, 0.45, 0.55); }
    { const F = mf(7.4, 1.89, PI); F.box('metal', 0xb8bcc4, 0.7, 0.7, 0.05, 0, 0.75, 0.02); F.box('plain', 0x1a1a1e, 0.56, 0.5, 0.02, 0, 0.72, 0.05); P.decal(F, atlas.label('chute', ['LAUNDRY', 'CHUTE'], '#f4f4f4', '#2a2a2e', 64, 32, { small: true }), 0.6, 0.3, 0, 1.35, 0.03); }
    mw('window', 10.999, 1.7, 0.5, -PI / 2, 1.0, 1.2, { trim: th.trim });
    P.troffer(mx * 8, 0.5, H, 1.2, 0, 0.7);
    kn(9.3, 0.93, -0.6, 0xe86a2a, 'detergent', 1.3);
    spot('dryer', 6.75, 0.2, 0.8, 'Nap in the warm dryer', () => { heal(10); say(['Still warm. Full of towels. You are a croissant now. +10 health.', 'You come out smelling like "mountain breeze" and static. +10 health.']); });
    spot('chute', 7.4, 1.3, 0.8, 'Jump down the laundry chute', () => { blip(240); say('Wheeeee. You come out of a hatch by the kitchen with a sock on your head.', 3.5); INTR.enter(spec.id, { spawn: { x: mx * 6.2, z: -2.2, yaw: PI / 2 } }); });
  }

  // ============================================================ game room
  {
    P.rug(mx * 0.1, 5.6, 0, 3.6, 2.6, P.rugTex('game', th.rug[2], th.rug[1], th.rug[0]));
    m('tv', 0.1, 8.95, PI, { w: 2.0, y: 1.6, console: false, screen: atlas.label('gametv', gary ? ['HOA SIMULATOR 4', 'FINE YOUR NEIGHBORS', 'PRESS START'] : ['TURBO KART', 'PLAYER 2: READY?', 'PRESS START'], '#1a1040', '#ffe040', 128, 72, { font: 'monospace', small: true }) });
    { const F = mf(0.1, 8.7, PI); F.box('wood', th.wood, 2.2, 0.45, 0.4, 0, 0.225, 0); F.box('plain', 0x1a1a1e, 0.34, 0.07, 0.26, -0.5, 0.49, 0); F.box('plain', 0xe8e8ec, 0.3, 0.06, 0.24, 0.4, 0.485, 0); F.col(0, 0, 2.2, 0.4, 0.45); }
    lights.push({ x: mx * 0.1, y: 1.6, z: 8.2, c: 0xa0a0ff, i: 0.5, halo: false });
    m('sectional', 0.1, 4.6, 0, { w: 3.0, col: th.sofa, side: -1, pillows: [th.accent, th.duvet] });
    for (const [x, z, c2] of [[-1.9, 7.2, 0xc83a3a], [2.2, 7.0, 0x3a6ac8]]) { B.sph('cloth', c2, 0.45, mx * x, 0.24, z, { ws: 8, hs: 5, s: [1, 0.62, 1], ao: false }); box(x, z, 0.6, 0.6, 0.45); }
    // arcade cabinet
    const AC = mf(-2.6, 3.0, PI / 2);
    AC.rbox('plain', gary ? 0x5a1a22 : 0x2a2a6a, 0.7, 1.75, 0.75, 0, 0.875, 0); AC.box('plain', 0x111114, 0.6, 0.5, 0.05, 0, 1.3, 0.37, 0, { rx: -0.25 });
    P.decal(AC, atlas.label('arcade', gary ? ['LAWN', 'PATROL'] : ['SPACE', 'MICE'], '#0a0a2a', '#40ff80', 64, 48, { font: 'monospace' }), 0.52, 0.4, 0, 1.3, 0.4, 0, 'aglow');
    AC.box('plain', 0x1a1a1e, 0.62, 0.06, 0.3, 0, 0.98, 0.42); AC.cyl('plain', 0xe03030, 0.025, 0.025, 0.1, -0.15, 1.06, 0.42, 6); for (let k = 0; k < 3; k++) AC.cyl('plain', [0xe0e040, 0x40c0e0, 0xe04080][k], 0.03, 0.03, 0.02, 0.05 + k * 0.09, 1.02, 0.42, 6);
    P.decal(AC, atlas.label('marquee', gary ? ['LAWN PATROL'] : ['SPACE MICE'], '#e0d040', '#2a1a4a', 64, 16, { small: true }), 0.62, 0.16, 0, 1.66, 0.385, 0, 'aglow'); AC.col(0, 0, 0.7, 0.75, 1.75);
    lights.push({ x: mx * -2.1, y: 1.3, z: 3.0, c: 0x60ff90, i: 0.3, halo: false });
    // foosball
    const FT = mf(1.9, 3.3, PI / 2);
    FT.rbox('wood', th.wood, 0.8, 0.22, 1.4, 0, 0.82, 0); FT.box('plain', 0x2a8a3a, 0.66, 0.01, 1.26, 0, 0.9, 0); for (const ex of [-1, 1]) for (const ez of [-1, 1]) FT.box('wood', th.wood, 0.08, 0.72, 0.08, ex * 0.32, 0.36, ez * 0.6);
    for (let k = 0; k < 4; k++) { FT.cyl('metal', 0xc8ccd4, 0.012, 0.012, 1.1, 0, 0.98, -0.45 + k * 0.3, 5, { rz: PI / 2 }); for (let j = -1; j <= 1; j++) FT.box('plain', k % 2 ? 0xd03030 : 0x3050d0, 0.05, 0.12, 0.03, j * 0.2, 0.95, -0.45 + k * 0.3); } FT.col(0, 0, 0.8, 1.4, 0.95);
    { const F = mf(3.09, 5.6, -PI / 2); F.cyl('plain', 0x1a1a1e, 0.24, 0.24, 0.03, 0, 1.7, 0.02, 14, { rx: PI / 2 }); F.cyl('plain', 0xe8e0c8, 0.19, 0.19, 0.035, 0, 1.7, 0.02, 14, { rx: PI / 2 }); F.cyl('plain', 0xd03030, 0.07, 0.07, 0.04, 0, 1.7, 0.02, 10, { rx: PI / 2 }); }   // dartboard
    { const F = mf(-2.6, 8.4, PI / 2); F.rbox('shiny', 0x2a2a2e, 0.5, 0.85, 0.5, 0, 0.43, 0); F.box('glass', 0xa0d8ff, 0.4, 0.7, 0.02, 0, 0.45, 0.255); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) F.cyl('shiny', [0xd03030, 0x30a040, 0xe0a020][r], 0.03, 0.03, 0.11, -0.12 + k * 0.12, 0.2 + r * 0.22, 0.14, 6); F.col(0, 0, 0.5, 0.5, 0.85); }   // drinks fridge
    kn(-2.6, 0.86, 8.4, 0xd03030, 'soda can', 0.8);
    for (const x of [-1.7, 1.9]) P.window(mx * x, 1.9, D / 2 - 0.001, PI, 0.9, 1.3, { trim: th.trim });
    for (const [x, z] of [[-1.5, 4], [1.8, 4], [0.1, 7]]) P.can(mx * x, z, H, 0.35);
    spot('arcade', -1.9, 3.0, 0.8, 'Play the arcade machine', () => {
      const sc = 1000 + ((Math.random() * 98) | 0) * 100; [660, 880, 990, 1320].forEach((f, i) => setTimeout(() => blip(f), i * 90));
      const k = spec.id + ':arcade', a = A();
      if (!MS.S.looted[k] && a) { MS.S.looted[k] = true; const c2 = 6 + (spec.seed % 7); a.addCash(c2); say(`You mash both buttons with your face. ${sc} points. The coin door falls open. +$${c2} in quarters.`, 4.5); }
      else say([`${sc} points. Your initials are "CAT". They are all "CAT" now.`, `Game over at ${sc}. You blame the joystick. It is cat-hostile.`]);
    });
    spot('foosball', 1.2, 3.3, 0.8, 'Spin the foosball rods', () => { [500, 620, 500, 760].forEach((f, i) => setTimeout(() => blip(f), i * 70)); say(['You spin every rod at once. Somebody scores. Probably you.', 'The little men go round and round. You bite the goalkeeper. Red card.']); });
    spot('soda', -2.0, 8.3, 0.7, 'Raid the drinks fridge', () => { heal(10); say(gary ? 'Twenty-four cans of unflavoured sparkling water. You drink one out of spite. +10 health.' : 'Root beer, orange soda and one juice box. You take the juice box. +10 health.'); });
    spot('gamesofa', 0.1, 5.4, 0.9, 'Sit on the controller', () => { blip(700); say(gary ? ['HOA SIMULATOR 4. You fine a virtual neighbour for "unapproved mulch". It feels bad. You do it again.'] : ['TURBO KART. You sit on the accelerate button and win by four laps.', 'You pick the banana every single time. Nobody can stop you.']); });
  }

  // ============================================================ teen room (Doug's room at Gary's)
  {
    m('bed', 9.8, 5.2, -PI / 2, { w: 1.5, wood: 0x2a2a2e, duvet: gary ? 0x8a7a5a : pick([0x2a3a6a, 0x5a2a5a, 0x2a2a2e]), accent: th.accent, head: 0x2a2a2e, headH: 0.9 });
    { const F = mf(9.7, 5.2, -PI / 2); F.rbox('cloth', gary ? 0x9a8a6a : 0x3a4a7a, 0.62, 0.3, 1.4, 0.1, 0.74, 0.15, 0, { round: 0.12 }); F.sph('plain', 0xe8b890, 0.14, 0.1, 0.8, -0.66, { ws: 7, hs: 5 }); F.sph('plain', gary ? 0x8a8a8a : 0x4a3222, 0.15, 0.1, 0.84, -0.74, { ws: 6, hs: 4, s: [1, 0.8, 1] }); }
    m('nightstand', 10.7, 6.45, -PI / 2, { wood: 0x2a2a2e });
    const dk = m('desk', 6.2, 8.5, 0, { w: 1.7, wood: 0x2a2a2e, screen: atlas.label('pc', gary ? ['RESUME_v9_FINAL(2).doc', '', 'Doug  -  "between things"'] : ['RANKED MATCH', 'DEFEAT', 'gg ez'], '#101820', gary ? '#e8e8e8' : '#ff5050', 128, 72, { font: 'monospace', small: true }) });
    dk.box('glow', 0xff40c0, 1.5, 0.015, 0.02, 0, 0.8, -0.38, 0, { tint: false }); lights.push({ x: mx * 6.2, y: 1.0, z: 7.8, c: 0xff60d0, i: 0.3, halo: false });
    m('officeChair', 6.2, 7.6, 0, { col: 0xc02020, tall: true });
    { const F = mf(3.5, 6.2, PI / 2); F.box('wood', 0x8a4a22, 0.34, 0.45, 0.09, 0, 0.42, 0.08, 0, { rx: -0.15 }); F.box('wood', 0x3a2416, 0.07, 0.6, 0.04, 0, 0.95, 0.16, 0, { rx: -0.15 }); F.cyl('plain', 0x1a1a1e, 0.06, 0.06, 0.02, 0, 0.45, 0.14, 8, { rx: PI / 2 - 0.15 }); F.col(0, 0.1, 0.4, 0.3, 1.2); }   // guitar
    m('bookcase', 3.4, 4.0, PI / 2, { w: 1.4, h: 1.9, wood: 0x2a2a2e, n: 4 });
    const poster = (k, t1, c1, c2) => atlas.region('tp' + k, 48, 64, (g) => { g.fillStyle = c1; g.fillRect(-1, -1, 50, 66); g.fillStyle = c2; g.beginPath(); g.moveTo(24, 8); g.lineTo(40, 40); g.lineTo(8, 40); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 9px Impact, sans-serif'; g.textAlign = 'center'; g.fillText(t1, 24, 56, 44); });
    (gary ? [['HANG IN', '#3a5a7a', '#e8e0c8'], ['THERE', '#5a3a3a', '#e8c040']] : [['DEATH MOTH', '#1a1a1e', '#c02020'], ['SK8', '#2a4a2a', '#e0e040']]).forEach(([t1, c1, c2], k) => { const F = mf(8.2 + k * 1.2, 2.11, 0); P.decal(F, poster(k, t1, c1, c2), 0.6, 0.8, 0, 1.75, 0.012); });
    for (let k = 0; k < 5; k++) B.box('cloth', pick([0x3a3a3e, 0x7a2a2a, 0x2a4a6a, 0xe8e0d0]), 0.4 + rnd() * 0.2, 0.05, 0.3, mx * (5 + rnd() * 3.5), 0.03, 3.2 + rnd() * 3.2, rnd() * 3, { ao: false });
    kn(6.85, 0.79, 8.5, 0x30c040, 'energy drink', 0.8); kn(10.7, 0.6, 6.7, 0x8a8a90, 'alarm clock', 0.6);
    for (const x of [8.2, 10.0]) P.window(mx * x, 1.8, D / 2 - 0.001, PI, 0.9, 1.4, { trim: th.trim, curtain: 0x2a2a2e });
    mw('window', 10.999, 1.8, 3.4, -PI / 2, 1.0, 1.3, { trim: th.trim });
    for (const [x, z] of [[5.5, 5], [8.8, 6.6]]) P.can(mx * x, z, H, 0.3);
    spot('sleeper', 8.7, 5.2, 0.9, gary ? 'Sit on Doug' : 'Sit on the sleeping teenager', () => {
      const a = A(); A() && A().Sfx.crash && A().Sfx.crash(2);
      say(gary ? '"GARY! GARY, THE CAT IS IN THE HOUSE AGAIN!" Doug carries you downstairs at arm\'s length.' : '"MOOOOM! THERE IS A CAT ON MY FACE!" You are carried downstairs at arm\'s length and put on the lawn.', 5);
      if (a && a.G) { a.G.heat = Math.min(5, Math.max(a.G.heat || 0, 1)); a.G.seenT = 0; }
      setTimeout(() => { if (INTR.current() === spec.id + '-up') INTR.exit(); }, 900);
    });
    spot('pc', 6.2, 7.2, 0.8, 'Walk on the gaming keyboard', () => { blip(900); say(gary ? ['You add "professional cat" under SKILLS on Doug\'s resume. It is the strongest line on there.'] : ['You win the rematch by lying on WASD. The other team reports you.', 'You type "gg" in all chat. Then "ggggggggggggggggggg". Respect.']); });
    spot('guitar', 4.1, 6.2, 0.7, 'Strum the guitar', () => { [330, 247, 196, 147, 110, 82].forEach((f, i) => setTimeout(() => blip(f * 2), i * 60)); say(['You drag one claw down all six strings. It is the best thing this guitar has ever played.']); });
  }

  // ============================================================ kid's room (Mother's room at Gary's)
  {
    const pink = gary ? 0xb8a890 : kidCol === 0xc8dcf0 ? 0x5a8ac8 : kidCol === 0xd8f0c8 ? 0x6aa84a : 0xe07aa0;
    P.rug(mx * -7, 5.6, 0, 2.6, 2.6, atlas.region('kidrug', 64, 64, (g) => { g.fillStyle = '#f4f0e0'; g.fillRect(-1, -1, 66, 66); const cs = ['#e85a7a', '#5a9ae8', '#e8c040', '#6ac86a']; for (let k = 0; k < 4; k++) { g.strokeStyle = cs[k]; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 28 - k * 7, 0, 7); g.stroke(); } }));
    m('bed', -9.95, 6.6, PI / 2, { w: 1.3, wood: 0xfafafa, duvet: pink, accent: 0xfafafa, head: 0xfafafa, headH: 1.0 });
    if (!gary) { const F = mf(-9.95, 6.6, PI / 2); for (const ex of [-1, 1]) for (const ez of [-1, 1]) F.box('wood', 0xfafafa, 0.05, 2.1, 0.05, ex * 0.7, 1.05, ez * 1.08); F.box('cloth', pink, 1.5, 0.03, 2.26, 0, 2.12, 0); for (const ex of [-1, 1]) F.box('cloth', 0xfafafa, 0.02, 0.5, 2.2, ex * 0.74, 1.85, 0); }
    m('nightstand', -10.7, 7.75, PI / 2, { wood: 0xfafafa });
    { const F = mf(-10.2, 6.5, PI / 2); F.sph('cloth', 0xa87848, 0.14, 0, 0.72, -0.55, { ws: 6, hs: 5 }); F.sph('cloth', 0xa87848, 0.1, 0, 0.9, -0.55, { ws: 6, hs: 5 }); for (const e of [-1, 1]) F.sph('cloth', 0xa87848, 0.04, e * 0.08, 0.98, -0.55, { ws: 4, hs: 3 }); }   // teddy on the pillow
    // dollhouse (a model of the estate at Gary's)
    const DH = mf(-4.0, 7.6, -PI / 2);
    DH.box('wood', 0xfafafa, 1.1, 0.5, 0.5, 0, 0.25, 0); DH.box('wood', gary ? 0xd8c8a0 : pink, 1.0, 0.7, 0.44, 0, 0.85, 0); for (const e of [-1, 1]) DH.box('wood', gary ? 0x5a3a2a : 0x8a4a5a, 0.62, 0.04, 0.5, e * 0.27, 1.38, 0, 0, { rz: e * -0.6 });
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) DH.box('glow', 0xfff0c0, 0.14, 0.16, 0.01, -0.32 + k * 0.32, 0.68 + r * 0.32, 0.225, 0, { tint: false }); DH.col(0, 0, 1.1, 0.5, 1.2);
    { const F = mf(-6.4, 8.55, PI); F.rbox('wood', gary ? 0x5a3a2a : 0xe8c040, 0.9, 0.5, 0.5, 0, 0.25, 0); F.box('wood', gary ? 0x4a2a1a : 0xd0a020, 0.94, 0.05, 0.54, 0, 0.6, -0.2, 0, { rx: -0.9 }); for (let k = 0; k < 5; k++) F.box('plain', pick([0xe03030, 0x3060e0, 0x30a040, 0xe0c020]), 0.12, 0.12, 0.12, -0.3 + k * 0.15, 0.56, 0.05, k); F.col(0, 0, 0.9, 0.5, 0.5); }   // toy chest
    for (let k = 0; k < 7; k++) B.box('plain', pick([0xe03030, 0x3060e0, 0x30a040, 0xe0c020]), 0.1, 0.1, 0.1, mx * (-8 + rnd() * 3), 0.05, 3.5 + rnd() * 2.2, rnd() * 3, Q);
    m('bookcase', -3.2, 4.2, -PI / 2, { w: 1.6, h: 1.3, wood: 0xfafafa, n: 3 });
    m('table', -8.6, 3.2, 0, { w: 0.9, d: 0.6, h: 0.5, wood: 0xfafafa }); for (const e of [-1, 1]) m('ottoman', -8.6 + e * 0.75, 3.2, 0, { w: 0.4, d: 0.4, col: pink });
    kn(-8.4, 0.5, 3.2, 0xe8c040, gary ? 'teacup' : 'sippy cup', 0.7); kn(-3.2, 1.3, 4.5, 0x8a5ac8, gary ? 'porcelain cat' : 'piggy bank', 0.9);
    for (const x of [-9.6, -5.4]) P.window(mx * x, 1.7, D / 2 - 0.001, PI, 1.1, 1.5, { trim: th.trim, curtain: pink });
    mw('window', -10.999, 1.7, 4.2, PI / 2, 1.0, 1.3, { trim: th.trim });
    for (let k = 0; k < 12; k++) B.box('glow', 0xf8f0a0, 0.05, 0.006, 0.05, mx * (-10.5 + rnd() * 7), H - 0.004, 2.5 + rnd() * 6, rnd(), QT);
    for (const [x, z] of [[-8.5, 5], [-5, 6]]) P.can(mx * x, z, H, 0.4);
    spot('dollhouse', -4.8, 7.6, 0.8, gary ? 'Inspect the scale model' : 'Attack the dollhouse', () => say(gary ? ['A scale model of Maple Grove Estates. Your RV is on it. It has a tiny red X.', 'Every lawn on the model is exactly the same green. One tiny figure is holding a clipboard.'] : ['You put one paw through the dollhouse window. The tiny family has seen things now.', 'You are fifty feet tall. The dollhouse sofa goes flying. RAAAWR.']));
    spot('toybox', -6.4, 7.8, 0.8, gary ? 'Look in Mother\'s chest' : 'Dig through the toy box', () => say(gary ? ['Doilies. More doilies. A framed photo of young Gary winning "Tidiest Desk, 1974".'] : ['A wind-up mouse. You wind it with your teeth by accident and spend ten minutes being outsmarted by it.', 'A laser pointer. No batteries. Cruel.']));
    spot('kidbed', -9.0, 6.6, 0.9, 'Sit on the little bed', () => say(gary ? ['The bed is made so tightly that you bounce. "MOTHER" is embroidered on the pillow.'] : ['You curl up next to the teddy bear. He does not mind. He has seen worse.']));
  }

  // ============================================================ baths
  {
    const gold = th.name === 'modern' ? 0xc8ccd4 : 0xc8a860;
    m('vanity', -10.72, 0.5, PI / 2, { w: 1.5, col: 0xfafafa, top: 0xf4f2ee, metal: gold, frame: 0xfafafa });
    m('tub', -6.0, 0.5, -PI / 2, { w: 1.7, metal: gold }); m('toilet', -8.3, -0.72, 0);
    { const F = mf(-6.0, 0.5, -PI / 2); F.cyl('plain', 0xf0d040, 0.05, 0.06, 0.07, 0.3, 0.55, 0.05, 6); F.sph('plain', 0xf0d040, 0.04, 0.3, 0.61, 0.09); }
    mw('window', -10.999, 1.9, -0.4, PI / 2, 0.6, 0.8, { trim: th.trim }); P.can(mx * -8, 0.5, H, 0.5, 0xf4f8ff);
    spot('kidtub', -6.9, 0.5, 0.7, 'Bat the rubber duck', () => { blip(1100); say(['Squeak. Squeak. SQUEAK. You have found the button that makes the duck scream.']); });
    m('shower', -10.2, -3.3, PI / 2, { w: 1.3, d: 1.4 });
    m('vanity', -7.6, -1.28, PI, { w: 1.5, col: th.wood, top: 0xf4f2ee, metal: gold, frame: gold });
    m('toilet', -5.4, -1.9, -PI / 2); mw('towels', -5.11, 1.5, -3.0, -PI / 2, th.duvet);
    mw('window', -10.999, 1.9, -1.8, PI / 2, 0.6, 0.8, { trim: th.trim }); P.can(mx * -8, -2.6, H, 0.5, 0xf4f8ff);
    kn(-7.2, 0.88, -1.3, 0x8ad0c8, 'soap bottle', 0.7);
    spot('shower', -9.2, -3.3, 0.8, 'Look at the shower', () => say(['A rain shower with six nozzles. You sit outside the glass and judge it.', 'Somebody left it dripping. Drip. Drip. You watch for a very long time.']));
    spot('tp', -6.1, -1.9, 0.7, 'Unroll the toilet paper', () => { blip(400); say(['You unroll all of it. Every sheet. It is on the floor now, in a pile, where it belongs.', 'The roll spins and spins. This is the best room in the house.']); });
  }

  // ============================================================ golden koi (one per house, hidden)
  const koiAt = [[-10.6, 0.62, -8.75, -9.9, -8.0], [4.75, 0.84, 0.1, 4.1, 0.1], [10.6, 0.04, 8.2, 9.9, 7.6], [-3.3, 0.04, -8.6, -3.6, -8.0]][spec.seed % 4];
  const koi = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), new THREE.MeshBasicMaterial({ color: 0xf0c030 }));
  koi.rotation.z = PI / 2; koi.position.set(mx * koiAt[0], koiAt[1] + 0.07, koiAt[2]); koi.userData.noBake = true; koi.name = 'mansion:koi'; koi.visible = !MS.S.koi[spec.id];
  spot('koi', koiAt[3], koiAt[4], 0.8, 'Take the golden koi', () => {
    const a = A(), h = hot.find((q) => q.id === 'koi'); if (MS.S.koi[spec.id] || !a) return;
    MS.S.koi[spec.id] = true; koi.visible = false; if (h && h.live) h.live.r = 0;
    const n = Object.keys(MS.S.koi).length, all = MS.S.houses.length;
    a.addCash(50); a.Sfx.jingle ? a.Sfx.jingle() : (a.Sfx.pickup && a.Sfx.pickup());
    say(n >= all ? `The last golden koi. All ${all}. Somewhere an insurance adjuster wakes up screaming. +$50, and +$500 for the set.` : `A little golden koi figurine. Every house in the Estates has one. You take it. +$50  (${n} of ${all})`, 5);
    if (n >= all) a.addCash(500);
  });

  zoneLights(lights, rooms, 3);
  const K = knockables(knocks, () => { const a = A(); if (a) a.addCash(15); say('Everything upstairs that could be on the floor is on the floor. You find $15 under the dresser.', 4); });
  knockSpots(K, (id, x, z, r, label, fn) => hot.push({ id, x, z, r, label, onUse: fn }), 1, () => group, hot, spec.id);
  group = B.finish(new THREE.Group()); group.add(K.mesh); group.add(koi);
  box(10.55, 8.55, 0.9, 0.9, H);   // keeps the (unused) exit circle out of reach
  let last = now();
  return {
    group, size: [W, D], cols, floors: [], lights, unload: true,
    name: (gary ? "Gary's House" : `The ${FAM} Residence`) + ', upstairs',
    spawn: { x: mx * SX, z: -3.3, yaw: 0 }, exit: { x: mx * 10.95, z: 8.95, r: 0.05 },
    portals: [{ x0: Math.min(mx * hx0, mx * hx1), x1: Math.max(mx * hx0, mx * hx1), z0: hz0 + 0.05, z1: hz0 + 0.6, to: spec.id, spawn: { x: mx * SX, z: SZ - RUN * 6.5, yaw: PI, y: RISE * 7 } }],
    cam: { maxDist: 3.4, height: 2.7 },
    bake: { amb: 0.3, maxEdge: 1.2 }, pack: true,
    interact: hot,
    dispose() { atlas.tex.dispose(); K.mesh.geometry.dispose(); K.mesh.material.dispose(); K.mesh.dispose(); koi.geometry.dispose(); koi.material.dispose(); },
    update() { const t = now(), dt = Math.min(0.1, Math.max(0, t - last)); last = t; K.update(dt); if (koi.visible) koi.rotation.y = t * 1.5; },
    stats: () => ({ atlas: atlas.used(), lights: lights.length, cols: cols.length }),
  };
}
