// House fires for Maple Grove: Off Leash. Gather a fire kit around town, walk into a building and light it up.
//   ignition:   Lighter (Earl's Bait & Tackle, fishing.js gear) or a book of Matches ($1 on Rosie's diner menu)
//   tinder:     Old Newspapers (recycling by the Donut Hole), Dry Kindling (the ruined cabin in Hollow Woods),
//               Oily Rags (Feed & Seed loading dock)
//   accelerant: Lighter Fluid ($5 on the Quik Stop counter menu) or a Gas Can (by the farm water tower; burns hotter)
// Inside the Quik Stop, the diner, the church or Nana's house: E "Start a fire" -> pile, splash, light. The room fills with
// flames and smoke (hurts to stay), the fire breaks out through the windows, witnesses call it in (PD heat), the Maple Grove
// VFD truck rolls up and hoses it down, the building smoulders, stays condemned for a while, then the town rebuilds it.
// Wired into game.js by tools/firestarter-hooks.mjs; indoor hooks use the interiors.js extension points.
// Debug: window.__FIRE (.S, .give('all'), .ignite(roomId), .fires, .skip(seconds))
import * as THREE from 'three';
import { mat, basic } from './gfx.js';
import { makeHuman } from './models.js';
import { NODES, EDGES, colliders, collide } from './world.js';
import { heightAt } from './terrain.js';
import * as INTM from './interiors.js';

const KEY = 'maple-grove-offleash-fire-v1';
const BURNABLE = { quik: 'Quik Stop', diner: "Rosie's Diner", church: 'Chapel Hill Church', nana: "Nana's House", donut: 'the Donut Hole' };
const NO_BURN = { rv: "Not the RV. Where would you nap?", jail: 'Concrete walls, steel bunk. Nothing in here burns.' };
const ITEMS = {
  matches:  { name: 'Book of Matches', kind: 'ign' },
  news:     { name: 'Old Newspapers',  kind: 'tinder' },
  kindling: { name: 'Dry Kindling',    kind: 'tinder' },
  rags:     { name: 'Oily Rags',       kind: 'tinder' },
  fluid:    { name: 'Lighter Fluid',   kind: 'accel' },
  gas:      { name: 'Gas Can',         kind: 'accel' },
};
// timeline (seconds since lit)
const T_BREAK = 14;      // flames burst out of the windows
const T_CALL = 26;       // someone calls the VFD
const SPRAY = 22;        // seconds of hosing from full blaze to out
const SMOLDER = 80;      // smoke after it is out
const CONDEMNED = 170;   // closed after the smoke clears, then rebuilt once you are not looking
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- textures ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let TX = null;
function textures() {
  return TX ||= {
    flame: canvasTex(64, 128, (g, w, h) => {
      // a teardrop: white-yellow core, orange body, red tips
      const grd = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.5);
      grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.25, 'rgba(255,210,90,0.95)'); grd.addColorStop(0.55, 'rgba(255,110,20,0.7)'); grd.addColorStop(1, 'rgba(160,20,0,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2, 2);
      g.bezierCurveTo(w * 0.62, h * 0.3, w * 0.98, h * 0.55, w * 0.9, h * 0.8); g.bezierCurveTo(w * 0.8, h * 1.0, w * 0.2, h * 1.0, w * 0.1, h * 0.8);
      g.bezierCurveTo(w * 0.02, h * 0.55, w * 0.38, h * 0.3, w / 2, 2); g.fill();
    }),
    smoke: canvasTex(64, 64, (g, w, h) => {
      for (let k = 0; k < 7; k++) {
        const x = w / 2 + rnd(-12, 12), y = h / 2 + rnd(-12, 12), r = rnd(14, 26);
        const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
      }
    }),
    glow: canvasTex(32, 32, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }),
  };
}
const flameMat = () => new THREE.SpriteMaterial({ map: textures().flame, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const smokeMat = (c = 0x2e2c2c) => new THREE.SpriteMaterial({ map: textures().smoke, color: c, transparent: true, opacity: 0, depthWrite: false });
const glowMat = (c = 0xffc070) => new THREE.SpriteMaterial({ map: textures().glow, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

// ---------- prop models ----------
function propModel(id) {
  const g = new THREE.Group();
  const B = (w, h, d, c, x = 0, y = 0, z = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  if (id === 'news') {
    for (let k = 0; k < 3; k++) B(0.5, 0.12, 0.36, [0xd8d4c4, 0xc8c4b0, 0xe0dccc][k], 0, 0.06 + k * 0.12, 0, k * 0.15);
    B(0.04, 0.38, 0.38, 0x9a7a4a, 0, 0.19, 0); B(0.52, 0.38, 0.04, 0x9a7a4a, 0, 0.19, 0);   // twine
  } else if (id === 'kindling') {
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.7, 5), mat(0x6a4a2a)); m.rotation.z = Math.PI / 2; m.position.set(0, 0.05 + (k % 3) * 0.06, (k - 2.5) * 0.06); m.rotation.y = rnd(-0.2, 0.2); g.add(m); }
    B(0.05, 0.2, 0.42, 0x8a6a3a, 0, 0.1, 0);
  } else if (id === 'rags') {
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mat([0x5a5040, 0x6a3a2a, 0x3a3a44][k])); m.scale.set(1.3, 0.5, 1); m.position.set((k - 1) * 0.16, 0.07 + (k === 1 ? 0.08 : 0), rnd(-0.05, 0.05)); g.add(m); }
    B(0.5, 0.06, 0.4, 0x4a4030, 0, 0.0, 0);
  } else if (id === 'gas') {
    B(0.36, 0.42, 0.22, 0xc02018, 0, 0.21, 0); B(0.08, 0.08, 0.2, 0x1a1a1a, 0, 0.46, 0);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.26, 6), mat(0x1a1a1a)); sp.position.set(0.14, 0.5, 0); sp.rotation.z = -0.7; g.add(sp);
    B(0.37, 0.05, 0.23, 0xe8c020, 0, 0.3, 0);
  } else if (id === 'fluid') {
    B(0.12, 0.26, 0.08, 0x2a6ad0, 0, 0.13, 0); B(0.04, 0.06, 0.04, 0xeeeeee, 0, 0.29, 0);
  } else if (id === 'pile') {   // the indoor kindling heap
    for (let k = 0; k < 5; k++) B(0.42, 0.04, 0.3, [0xd8d4c4, 0xc8c4b0, 0x6a4a2a, 0xe0dccc, 0x5a5040][k], rnd(-0.2, 0.2), 0.03 + k * 0.035, rnd(-0.2, 0.2), rnd(0, 3));
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), basic({ color: 0x3a3020, transparent: true, opacity: 0.5, depthWrite: false })); pud.rotation.x = -Math.PI / 2; pud.position.y = 0.01; g.add(pud);
  }
  return g;
}

// ---------- the Maple Grove VFD truck ----------
function makeFireTruck() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const red = mat(0xc01818, null, 0, 70), white = mat(0xf0f0e8), dark = mat(0x1a1a1e), chrome = mat(0xd0d0d4, null, 0, 120), glass = mat(0x223344, null, 0, 120);
  const B = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); body.add(o); return o; };
  B(2.3, 1.7, 5.2, red, 0, 1.45, -0.9);           // body (rear)
  B(2.3, 1.9, 2.0, red, 0, 1.55, 2.6);            // cab
  B(2.2, 0.7, 0.05, glass, 0, 2.0, 3.61);         // windscreen
  B(2.32, 0.6, 1.0, glass, 0, 2.05, 2.75);        // side windows
  B(2.34, 0.14, 7.2, white, 0, 1.2, 0.0);         // stripe
  B(2.3, 0.3, 0.2, chrome, 0, 0.75, 3.62);        // bumper
  B(2.4, 0.25, 7.3, dark, 0, 0.6, 0.0);           // chassis
  for (const s of [-1, 1]) {                      // roof ladder rails
    B(0.08, 0.08, 5.6, chrome, s * 0.45, 2.42, -0.6);
  }
  for (let k = 0; k < 11; k++) B(0.9, 0.05, 0.06, chrome, 0, 2.42, -3.2 + k * 0.52);
  B(2.0, 0.6, 0.1, chrome, 0, 1.3, -3.52);        // rear panel
  for (const [x, z] of [[-1.05, 2.4], [1.05, 2.4], [-1.05, -1.6], [1.05, -1.6], [-1.05, -2.6], [1.05, -2.6]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 10), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); body.add(w);
  }
  const bar = [basic({ color: 0xff2020 }), basic({ color: 0xffffff })];
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3), bar[0]); l1.position.set(-0.45, 2.58, 2.9); body.add(l1);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3), bar[1]); l2.position.set(0.45, 2.58, 2.9); body.add(l2);
  const glA = new THREE.Sprite(glowMat(0xff3020)), glB = new THREE.Sprite(glowMat(0xffffff));
  glA.position.set(-0.45, 2.7, 2.9); glB.position.set(0.45, 2.7, 2.9); glA.scale.setScalar(2.2); glB.scale.setScalar(2.2); body.add(glA, glB);
  // "MAPLE GROVE VFD" door decal
  const t = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#c01818'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23f'; c.font = 'bold 30px Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MAPLE GROVE VFD', w / 2, h / 2); });
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), basic({ map: t })); d.position.set(s * 1.17, 1.6, -0.6); d.rotation.y = s * Math.PI / 2; body.add(d); }
  const nozzle = new THREE.Object3D(); nozzle.position.set(0, 2.6, -2.2); body.add(nozzle);   // roof deck gun
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.9, 6), chrome); gun.rotation.x = Math.PI / 2; nozzle.add(gun);
  g.userData = { body, lights: [glA, glB], bar: [l1, l2], nozzle };
  return g;
}

export function makeFirestarter(ctx) {
  const { scene, G, P, cat, toast, banner, say, Sfx, puff, hurt, addCash, peds, places, isTouch, pool, lights, $ } = ctx;
  const fishing = () => (ctx.fishing ? ctx.fishing() : null);
  const INT = () => window.__INT || null;
  const S = { inv: { matches: 0, news: false, kindling: false, rags: false, fluid: false, gas: false }, lit: 0, seen: false, act: null };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.inv) Object.assign(S.inv, s.inv); if (s) { S.lit = s.lit | 0; S.seen = !!s.seen; } } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ inv: S.inv, lit: S.lit, seen: S.seen })); } catch (e) { /* ignore */ } };
  const resetBtn = $ && $('reset'); if (resetBtn) resetBtn.addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } });
  const key = isTouch ? 'USE' : 'E';
  const hasLighter = () => { const f = fishing(); return !!(f && f.S && f.S.gear && f.S.gear.lighter); };
  const kit = () => ({
    ign: hasLighter() ? 'lighter' : S.inv.matches > 0 ? 'matches' : null,
    tinder: S.inv.news ? 'news' : S.inv.kindling ? 'kindling' : S.inv.rags ? 'rags' : null,
    accel: S.inv.gas ? 'gas' : S.inv.fluid ? 'fluid' : null,
  });
  const anyItem = () => { const k = kit(); return !!(k.tinder || k.accel || S.inv.matches > 0); };
  const missing = () => {
    const k = kit(), m = [];
    if (!k.ign) m.push('something to light it (a lighter from Earl, or matches at the diner)');
    if (!k.tinder) m.push('tinder (newspapers by the Donut Hole, kindling at the old cabin, oily rags at the Feed & Seed)');
    if (!k.accel) m.push('accelerant (lighter fluid at the Quik Stop, a gas can by the water tower)');
    return m;
  };

  // ---------- HUD: fire kit line + smoke overlay ----------
  const css = document.createElement('style');
  css.textContent = `
#firekit { font-size: 16px; color: #ffb060; white-space: nowrap; display: none; letter-spacing: 1px; }
#firekit b { color: #ff7a30; font-weight: normal; }
#firekit .ok { color: #7fe07f; } #firekit .no { color: #8a8070; }
#smokefx { position: fixed; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at 50% 60%, rgba(60,50,45,0.15) 0%, rgba(40,34,32,0.75) 70%, rgba(20,16,14,0.95) 100%); }
#smokefx i { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 110%, rgba(255,110,30,0.45), rgba(255,80,20,0) 60%); opacity: 0; }
`;
  document.head.appendChild(css);
  const kitEl = document.createElement('div'); kitEl.id = 'firekit';
  const anchor = document.getElementById('belly') || document.getElementById('hp');
  if (anchor) anchor.insertAdjacentElement('afterend', kitEl);
  const smokeEl = document.createElement('div'); smokeEl.id = 'smokefx'; smokeEl.innerHTML = '<i></i>';
  const cv = document.getElementById('c'); if (cv) cv.insertAdjacentElement('afterend', smokeEl); else document.body.prepend(smokeEl);
  let kitTxt = '';
  function drawKit() {
    const k = kit(), show = anyItem() || S.lit > 0;
    const t = show ? `<b>FIRE KIT</b> <span class="${k.ign ? 'ok' : 'no'}">LIGHT${k.ign ? '✓' : '·'}</span> <span class="${k.tinder ? 'ok' : 'no'}">TINDER${k.tinder ? '✓' : '·'}</span> <span class="${k.accel ? 'ok' : 'no'}">FUEL${k.accel ? '✓' : '·'}</span>` : '';
    if (t !== kitTxt) { kitTxt = t; kitEl.innerHTML = t; kitEl.style.display = t ? 'block' : 'none'; }
  }

  // ---------- pickups around town ----------
  const off = (p, dx, dz, fb) => (p ? { x: p.x + dx, z: p.z + dz } : fb);
  const SPOTS = [
    { id: 'news', at: off(places.donut, 1.6, 0.4, { x: 40, z: 0 }), verb: 'Grab the old newspapers', got: 'Old newspapers. Yesterday\'s news, tomorrow\'s tinder.' },
    { id: 'kindling', at: off(places.clearing, 3, -2.5, { x: -130, z: 80 }), verb: 'Gather dry kindling', got: 'Dry kindling from the old cabin. The woods go very quiet.' },
    { id: 'rags', at: off(places.feed, 2.2, 0.6, { x: 90, z: 60 }), verb: 'Take the oily rags', got: 'Oily rags off the Feed & Seed dock. They smell like a tractor.' },
    { id: 'gas', at: off(places.tower, -2.4, 1.2, { x: 100, z: 50 }), verb: 'Take the gas can', got: 'A sloshing gas can. Half full. Or half empty, if you\'re a pessimist.' },
  ];
  const pickups = SPOTS.map((s) => {
    const q = collide(s.at.x, s.at.z, 0.5); s.at = { x: q.x, z: q.z };
    const mesh = propModel(s.id); mesh.position.set(s.at.x, 0, s.at.z); mesh.rotation.y = rnd(0, 6); scene.add(mesh);
    const ico = new THREE.Sprite(flameMat()); ico.scale.set(0.35, 0.6, 1); ico.position.set(s.at.x, 1.1, s.at.z); scene.add(ico);
    return { ...s, mesh, ico, t: 0 };
  });
  const pickupNear = () => {
    if (P.car) return null;
    for (const p of pickups) if (p.mesh.visible && Math.hypot(P.x - p.at.x, P.z - p.at.z) < 1.5) return p;
    return null;
  };
  function grab(p) {
    S.inv[p.id] = true; p.mesh.visible = false; p.ico.visible = false; p.t = 120;   // a new one turns up in 2 min once used
    Sfx.pickup(); toast(p.got, 3.5); save();
    hintOnce();
  }
  function hintOnce() {
    if (S.seen) return;
    S.seen = true; save();
    setTimeout(() => toast('Fire kit: something to light it + tinder + fuel. Then walk into a building and press ' + key + '.', 5), 3600);
  }

  // ---------- shop counters (shops.js menus call this) ----------
  function bought(id) {
    if (id === 'fluid') { S.inv.fluid = true; toast('Clerk: "Lighter fluid. Grilling tonight?" You nod slowly.', 4); }
    else if (id === 'matches') { S.inv.matches = 3; toast('Rosie: "Matches? Light a candle for somebody, hon."', 4); }
    save(); hintOnce();
  }

  // ---------- fires ----------
  const fires = {};   // room id -> fire
  const name = (id) => BURNABLE[id] || id;
  function building(id) {
    // door + windows (they follow the building in the world editor) and the building's footprint collider
    const st = INT() && INT().state; const ents = st ? st.entries.filter((e) => e.id === id) : [];
    const door = ents.find((e) => e.kind === 'door') || ents[0];
    if (!door) return null;
    const ox = Math.sin(door.yaw), oz = Math.cos(door.yaw);
    const px = door.x - ox * 2, pz = door.z - oz * 2;
    let best = null, bs = 0;
    for (const c of colliders) {
      if (c.r !== undefined || c.poly) continue;
      let inside, hw, hd, cx, cz, rot = 0;
      if (c.ob) { const dx = px - c.cx, dz = pz - c.cz; inside = Math.abs(dx * c.c - dz * c.s) < c.hw && Math.abs(dx * c.s + dz * c.c) < c.hd; hw = c.hw; hd = c.hd; cx = c.cx; cz = c.cz; rot = Math.atan2(c.s, c.c); }
      else { inside = px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1; hw = (c.x1 - c.x0) / 2; hd = (c.z1 - c.z0) / 2; cx = (c.x0 + c.x1) / 2; cz = (c.z0 + c.z1) / 2; }
      if (!inside || (c.h ?? 5) < 2) continue;
      const sc = hw * hd * Math.min(c.h ?? 5, 8);
      if (sc > bs && hw < 20 && hd < 20) { bs = sc; best = { cx, cz, hw, hd, rot, h: clamp(c.h ?? 5, 3, 9) }; }
    }
    if (!best) best = { cx: px - ox * 2, cz: pz - oz * 2, hw: 4, hd: 4, rot: 0, h: 4.5 };
    return { door, ents, ...best };
  }
  function startFire(id, at) {
    const R = INT() && INT().room;
    const B = building(id);
    const F = { id, t: 0, st: 'inside', k: 0, o: 0, gas: !!at.gas, B, room: R, clusters: [], indoor: null, outdoor: null, truck: null, witnessed: false, called: false, spray: 0, lastHint: 0 };
    fires[id] = F;
    if (R && R.group) buildIndoor(F, R, at);
    if (B) buildOutdoor(F);
    S.lit++; save();
    return F;
  }

  // ---------- indoor: flame clusters, smoke sprites, the pile ----------
  function buildIndoor(F, R, at) {
    const g = new THREE.Group(); g.userData.noLift = true; R.group.add(g);
    const pile = propModel('pile'); pile.position.set(at.x, 0, at.z); g.add(pile);
    const hw = R.size[0] / 2 - 0.5, hd = R.size[1] / 2 - 0.5;
    const spots = [{ x: at.x, z: at.z, wall: false }];
    for (let k = 0; k < 40 && spots.length < 9; k++) {
      const wall = Math.random() < 0.4;
      let x = rnd(-hw, hw), z = rnd(-hd, hd);
      if (wall) { if (Math.random() < 0.5) x = Math.sign(x || 1) * (hw + 0.3); else z = -(hd + 0.3); }   // never the door wall
      if (Math.hypot(x - R.exit.x, z - R.exit.z) < 1.8) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.4)) continue;
      spots.push({ x, z, wall });
    }
    spots.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
    F.clusters = spots.map((s, i) => {
      const c = new THREE.Group(); c.position.set(s.x, 0, s.z); g.add(c);
      const sp = [];
      for (let k = 0; k < 4; k++) { const f = new THREE.Sprite(flameMat()); f.center.set(0.5, 0.05); f.position.set(rnd(-0.35, 0.35), s.wall ? rnd(0, 0.5) : 0, rnd(-0.35, 0.35)); c.add(f); sp.push({ f, ph: rnd(0, 6), s: rnd(0.8, 1.25) * (s.wall ? 1.3 : 1) }); }
      const glow = new THREE.Sprite(glowMat(0xff8a30)); glow.position.y = 0.5; c.add(glow);
      c.visible = false;
      return { g: c, sp, glow, x: s.x, z: s.z, at: i === 0 ? 0 : 2 + i * (F.gas ? 2.2 : 3.2), k: 0 };
    });
    const smoke = [];
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Sprite(smokeMat(0x24201e)); m.position.set(rnd(-hw, hw), rnd(1.4, R.cam.height + 0.2), rnd(-hd, hd)); m.scale.setScalar(rnd(2.5, 4)); g.add(m);
      smoke.push({ m, ph: rnd(0, 6), y0: m.position.y });
    }
    const embers = [];
    for (let k = 0; k < 10; k++) { const e = new THREE.Sprite(glowMat(0xffa040)); e.scale.setScalar(0.08); e.visible = false; g.add(e); embers.push({ e, life: 0 }); }
    g.traverse((o) => o.layers.set(1));
    F.indoor = { g, pile, smoke, embers, R };
  }
  function animIndoor(F, dt, t) {
    const I = F.indoor; if (!I) return;
    const k = F.k;
    for (const c of F.clusters) {
      const want = F.t >= c.at ? clamp((F.t - c.at) / 5, 0, 1) * (F.st === 'smolder' || F.st === 'condemned' ? 0 : Math.min(1, F.k * 1.6 + 0.3)) : 0;
      c.k += (want - c.k) * Math.min(1, dt * 2);
      c.g.visible = c.k > 0.02;
      if (!c.g.visible) continue;
      for (const s of c.sp) {
        const fl = 0.85 + 0.25 * Math.sin(t * 13 + s.ph) + 0.1 * Math.sin(t * 29 + s.ph * 2);
        s.f.scale.set(0.95 * s.s * c.k * (0.9 + 0.1 * Math.sin(t * 7 + s.ph)), 2.1 * s.s * c.k * fl, 1);
      }
      c.glow.scale.setScalar(3.4 * c.k);
      c.glow.material.opacity = 0.35 + 0.1 * Math.sin(t * 17);
    }
    const sm = F.smoke ?? 0;
    for (const s of I.smoke) {
      s.m.material.opacity = clamp(sm * 0.9, 0, 0.85);
      s.m.position.y = s.y0 + Math.sin(t * 0.5 + s.ph) * 0.15;
      s.m.material.rotation = t * 0.05 + s.ph;
    }
    for (const e of I.embers) {
      if (e.life <= 0 && k > 0.05 && Math.random() < dt * 6 * k) {
        const c = F.clusters[(Math.random() * F.clusters.length) | 0];
        if (c.g.visible) { e.life = rnd(0.8, 1.6); e.e.position.set(c.x + rnd(-0.3, 0.3), 0.3, c.z + rnd(-0.3, 0.3)); e.v = [rnd(-0.3, 0.3), rnd(0.8, 1.6), rnd(-0.3, 0.3)]; }
      }
      if (e.life > 0) { e.life -= dt; e.e.visible = e.life > 0; e.e.position.x += e.v[0] * dt; e.e.position.y += e.v[1] * dt; e.e.position.z += e.v[2] * dt; }
    }
  }

  // ---------- outdoor: flames out of the windows, roof fire, smoke column, light ----------
  function buildOutdoor(F) {
    const B = F.B, g = new THREE.Group(); g.position.set(B.cx, 0, B.cz); scene.add(g);   // direct scene child: lifted onto the terrain at the building
    const pts = [];
    for (const e of B.ents) pts.push({ x: e.x + Math.sin(e.yaw) * 0.35, z: e.z + Math.cos(e.yaw) * 0.35, y: e.kind === 'door' ? 0.6 : 1.0, s: e.kind === 'door' ? 1.6 : 1.4, win: true });   // just outside the wall: flames lick out of the openings
    const cs = Math.cos(B.rot), sn = Math.sin(B.rot), W = (lx, lz) => ({ x: B.cx + lx * cs + lz * sn, z: B.cz - lx * sn + lz * cs });
    for (const [lx, lz] of [[0, 0], [-0.55, 0.35], [0.55, -0.35], [-0.35, -0.55], [0.35, 0.55], [0.6, 0.5], [-0.6, -0.4]]) { const p = W(lx * B.hw, lz * B.hd); pts.push({ ...p, y: B.h - 0.6, s: 3.2, roof: true }); }
    const flames = pts.map((p, i) => {
      const c = new THREE.Group(); c.position.set(p.x - B.cx, p.y, p.z - B.cz); g.add(c);
      const sp = []; for (let k = 0; k < 3; k++) { const f = new THREE.Sprite(flameMat()); f.center.set(0.5, 0.1); f.position.set(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)); c.add(f); sp.push({ f, ph: rnd(0, 6), s: p.s * rnd(0.8, 1.2) }); }
      const soot = new THREE.Sprite(smokeMat(0x0a0808)); soot.scale.set(p.s * 1.4, p.s * 1.2, 1); soot.position.y = 0.4; c.add(soot);
      const glow = new THREE.Sprite(glowMat(0xff7a28)); glow.position.y = 0.6; c.add(glow);
      c.visible = false;
      return { g: c, sp, soot, glow, s0: p.s, roof: !!p.roof, delay: p.roof ? 6 + i * 1.5 : i * 1.2, k: 0 };
    });
    const smoke = [];
    for (let k = 0; k < 22; k++) { const m = new THREE.Sprite(smokeMat(0x2a2828)); m.visible = false; g.add(m); smoke.push({ m, life: 0, max: 1, v: [0, 0, 0] }); }
    const L = { x: B.cx, y: B.h + 1 + heightAt(B.cx, B.cz), z: B.cz, c: 0xff6a20, i: 0, always: true, flicker: true, fire: true };
    lights.push(L);
    F.outdoor = { g, flames, smoke, L, pts };
  }
  function animOutdoor(F, dt, t) {
    const O = F.outdoor; if (!O) return;
    const o = F.o, burning = F.st === 'blaze' || F.st === 'inside';
    for (const f of O.flames) {
      const want = burning || F.st === 'spray' ? clamp((F.t - T_BREAK - f.delay) / 4, 0, 1) * o : 0;
      f.k += (want - f.k) * Math.min(1, dt * 1.5);
      const sootK = F.st === 'smolder' || F.st === 'condemned' || F.st === 'spray' ? 1 : clamp((F.t - T_BREAK - f.delay) / 3, 0, 1);
      f.g.visible = f.k > 0.02 || sootK > 0;
      for (const s of f.sp) {
        s.f.visible = f.k > 0.02;
        const fl = 0.8 + 0.3 * Math.sin(t * 11 + s.ph) + 0.1 * Math.sin(t * 23 + s.ph);
        s.f.scale.set(0.8 * s.s * f.k, 1.9 * s.s * f.k * fl, 1);
      }
      f.glow.visible = f.k > 0.02; f.glow.scale.setScalar(3.2 * f.s0 * f.k); f.glow.material.opacity = 0.45 + 0.15 * Math.sin(t * 15 + f.delay);
      f.soot.material.opacity = f.roof ? 0 : 0.75 * sootK;
    }
    // smoke column: thick while blazing, white-grey steam while hosed, a thin wisp while smouldering
    const rate = F.st === 'inside' ? (F.t > 4 ? 1.5 : 0) : F.st === 'blaze' ? 7 : F.st === 'spray' ? 6 : F.st === 'smolder' ? 1.6 * (1 - F.sm) + 0.4 : 0;
    const col = F.st === 'spray' ? 0xa8a8a8 : 0x4a4442;
    for (const s of O.smoke) {
      if (s.life <= 0 && rate > 0 && Math.random() < dt * rate / 2) {
        const p = O.pts[(Math.random() * O.pts.length) | 0];
        s.life = s.max = rnd(4, 7); s.m.position.set(p.x - F.B.cx + rnd(-0.5, 0.5), p.y + 0.5, p.z - F.B.cz + rnd(-0.5, 0.5)); s.v = [rnd(0.3, 1.2), rnd(1.6, 2.6), rnd(-0.4, 0.4)];
        s.m.material.color.set(col); s.m.material.rotation = rnd(0, 6); s.big = F.st === 'smolder' ? 0.6 : 1;
      }
      if (s.life > 0) {
        s.life -= dt; const a = 1 - s.life / s.max;
        s.m.visible = s.life > 0;
        s.m.position.x += s.v[0] * dt * (0.4 + a); s.m.position.y += s.v[1] * dt; s.m.position.z += s.v[2] * dt;
        s.m.scale.setScalar((1.5 + a * 6) * s.big);
        s.m.material.opacity = Math.min(1, a * 6) * (1 - a) * 0.8;
      }
    }
    O.L.i = o * (F.gas ? 3 : 2.4) * (0.85 + 0.3 * Math.random());
    if (o < 0.01) O.L.i = 0;
  }

  // ---------- the VFD ----------
  function dispatchTruck(F) {
    const B = F.B; if (!B) return;
    // nearest road segment to the door
    let best = null, bd = 1e9;
    for (const e of EDGES) {
      const A = NODES[e.a], C = NODES[e.b]; if (!A || !C) continue;
      const dx = C.x - A.x, dz = C.z - A.z, L2 = dx * dx + dz * dz || 1;
      const u = clamp(((B.door.x - A.x) * dx + (B.door.z - A.z) * dz) / L2, 0.05, 0.95);
      const x = A.x + dx * u, z = A.z + dz * u, d = Math.hypot(x - B.door.x, z - B.door.z);
      if (d < bd) { bd = d; best = { A, C, u, x, z, w: e.w || 7 }; }
    }
    if (!best || bd > 45) { best = null; }
    const truck = makeFireTruck(); scene.add(truck);
    let to, from;
    if (best) {
      const { A, C, x, z } = best, L = Math.hypot(C.x - A.x, C.z - A.z) || 1, ux = (C.x - A.x) / L, uz = (C.z - A.z) / L;
      // pull over on the building's side of the road
      const side = Math.sign((B.door.x - x) * -uz + (B.door.z - z) * ux) || 1;
      const kerb = Math.min(bd * 0.6, best.w / 2 - 1.2);
      to = { x: x + -uz * side * kerb, z: z + ux * side * kerb };
      const dA = Math.hypot(A.x - x, A.z - z), dC = Math.hypot(C.x - x, C.z - z), far = dA > dC ? A : C, dir = far === A ? -1 : 1;
      const run = Math.max(30, Math.max(dA, dC));
      from = { x: to.x + ux * dir * run, z: to.z + uz * dir * run };
    } else {
      const ox = Math.sin(B.door.yaw), oz = Math.cos(B.door.yaw);
      to = { x: B.door.x + ox * 8, z: B.door.z + oz * 8 }; from = { x: to.x + ox * 40, z: to.z + oz * 40 };
    }
    truck.position.set(from.x, 0, from.z); truck.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    const crew = [0, 1].map((k) => {
      const h = makeHuman({ skin: [0xd9a47a, 0x8a5a3a][k], shirt: 0xc8a030, pants: 0x2a2a2a, cap: 0xc01818, hair: 0x3a2a1a });
      h.visible = false; scene.add(h); return h;
    });
    F.truck = { g: truck, from, to, k: 0, len: Math.hypot(to.x - from.x, to.z - from.z), crew, sirenT: 0, parked: false };
  }
  function animTruck(F, dt, t) {
    const T = F.truck; if (!T) return;
    const u = T.g.userData, B = F.B;
    const blink = Math.sin(t * 14) > 0;
    u.lights[0].visible = blink; u.lights[1].visible = !blink;
    u.bar[0].material.color.set(blink ? 0xff3030 : 0x501010); u.bar[1].material.color.set(blink ? 0x505050 : 0xffffff);
    if (!T.parked) {
      T.k = Math.min(1, T.k + dt * 11 / Math.max(1, T.len));
      const e = 1 - (1 - T.k) * (1 - T.k);    // ease into the stop
      T.g.position.set(T.from.x + (T.to.x - T.from.x) * e, 0, T.from.z + (T.to.z - T.from.z) * e);
      if ((T.sirenT -= dt) <= 0) { T.sirenT = 0.55; if (Math.hypot(P.x - T.g.position.x, P.z - T.g.position.z) < 90) Sfx.siren(); }
      if (T.k >= 1) {
        T.parked = true;
        if (F.st === 'inside') { F.st = 'blaze'; breakout(F); }
        if (F.st === 'blaze') F.st = 'spray';
        // crew hop out and aim at the building
        T.crew.forEach((h, i) => {
          const yaw = T.g.rotation.y, sx = Math.cos(yaw) * (i ? -1.8 : 1.8), sz = -Math.sin(yaw) * (i ? -1.8 : 1.8);
          let x = T.g.position.x + sx + Math.sin(yaw) * (i ? -2 : 1.5), z = T.g.position.z + sz + Math.cos(yaw) * (i ? -2 : 1.5);
          const q = collide(x, z, 0.35); x = q.x; z = q.z;
          h.position.set(x, 0, z); h.rotation.y = Math.atan2(B.cx - x, B.cz - z); h.visible = true;
          const arms = h.userData.arms; if (arms) for (const a of arms) a.rotation.x = -1.3;
        });
        if (Math.hypot(P.x - B.door.x, P.z - B.door.z) < 60) toast('Maple Grove VFD: "STAND BACK, KITTY."', 3);
      }
      return;
    }
    // hoses: arcs of water from the deck gun and both firefighters onto the building
    if (F.st === 'spray') {
      const aim = (sx, sy, sz, n) => {
        for (let k = 0; k < n; k++) {
          const tx = B.cx + rnd(-B.hw, B.hw) * 0.6, tz = B.cz + rnd(-B.hd, B.hd) * 0.6, ty = B.h * 0.8;
          const dx = tx - sx, dz = tz - sz, d = Math.hypot(dx, dz), tt = clamp(d / 14, 0.4, 1.6);
          const vy = (ty - sy + 4.5 * tt * tt) / tt;   // game.js water puffs fall at 9 m/s²
          puff('water', sx, sy, sz, dx / tt, vy, dz / tt, 0.35, tt);
        }
      };
      const n = u.nozzle.getWorldPosition(new THREE.Vector3());
      if (Math.random() < 0.8) aim(n.x, 2.7, n.z, 1);
      for (const h of T.crew) if (Math.random() < 0.5) aim(h.position.x + Math.sin(h.rotation.y) * 0.6, 1.1, h.position.z + Math.cos(h.rotation.y) * 0.6, 1);
    } else if (F.st === 'condemned' && F.t > F.condemnAt + 8 && T.crew[0].visible) {
      for (const h of T.crew) h.visible = false;   // the crew packs up; the truck stays a while
    }
  }

  // ---------- ignition sequence ----------
  function tryIgnite(id) {
    if (NO_BURN[id]) { toast(NO_BURN[id], 3); return true; }
    if (!BURNABLE[id]) return false;
    if (fires[id]) { toast('Already burning. Maybe... leave?', 2.5); return true; }
    const k = kit();
    if (!k.ign || !k.tinder || !k.accel) {
      const m = missing();
      toast('You need ' + m.join(', and ') + '.', 6);
      return true;
    }
    const R = INT() && INT().room; if (!R) return false;
    const fx = Math.sin(P.yaw) * 0.7, fz = Math.cos(P.yaw) * 0.7;
    const lx = clamp(P.x - R.origin.x + fx, -R.size[0] / 2 + 0.5, R.size[0] / 2 - 0.5), lz = clamp(P.z - R.origin.z + fz, -R.size[1] / 2 + 0.5, R.size[1] / 2 - 0.5);
    S.act = { id, t: 0, step: 0, k, at: { x: lx, z: lz, gas: k.accel === 'gas' }, hold: { x: P.x, z: P.z } };
    return true;
  }
  const STEPS = [
    (a) => `You pile up the ${ITEMS[a.k.tinder].name.toLowerCase()}...`,
    (a) => (a.k.accel === 'gas' ? 'Glug glug glug. Gasoline everywhere.' : 'Squirt squirt. Lighter fluid on everything.'),
    (a) => (a.k.ign === 'lighter' ? 'Click... click... ' : 'Scritch... ') + 'FWOOSH!',
  ];
  function stepAct(dt) {
    const a = S.act; if (!a) return;
    P.x = a.hold.x; P.z = a.hold.z; P.vx = P.vz = 0;
    const R = INT() && INT().room;
    if (!R || INT().current() !== a.id) { S.act = null; return; }
    const before = a.t; a.t += dt;
    for (let i = 0; i < 3; i++) if (before < i * 0.9 && a.t >= i * 0.9) {
      toast(STEPS[i](a), 2.2);
      if (i === 0) Sfx.swing();
      if (i === 1) Sfx.blip(220);
    }
    if (a.t >= 2.0) {
      // consume the kit (the lighter is reusable, a book of matches has 3)
      S.inv[a.k.tinder] = false; S.inv[a.k.accel] = false;
      if (a.k.ign === 'matches') S.inv.matches = Math.max(0, S.inv.matches - 1);
      save(); S.act = null;
      Sfx.boom();
      const F = startFire(a.id, a.at);
      F.k = 0.15;
      banner('FIRE!', `${name(a.id)} is going up. Get out!`, 3, 'fail');
    }
  }

  // ---------- per frame ----------
  let hurtAcc = 0, coughT = 0;
  const smokeOverlay = { v: 0, glow: 0 };
  function update(dt) {
    if (!dt) return;
    const t = G.time || 0;
    stepAct(dt);
    // pickups bob, respawn
    for (const p of pickups) {
      if (!p.mesh.visible) {
        if (S.inv[p.id]) continue;   // only one of each in the bag
        if ((p.t -= dt) <= 0 && Math.hypot(P.x - p.at.x, P.z - p.at.z) > 25) { p.mesh.visible = true; p.ico.visible = true; }
        continue;
      }
      p.ico.position.y = 1.1 + Math.sin(t * 3 + p.at.x) * 0.1;
      const fl = 0.9 + 0.15 * Math.sin(t * 14 + p.at.z); p.ico.scale.set(0.3 * fl, 0.55 * fl, 1);
    }
    const inId = INT() ? INT().current() : null;
    let inFire = null;
    for (const id of Object.keys(fires)) {
      const F = fires[id];
      F.t += dt;
      // state machine
      if (F.st === 'inside') {
        F.k = Math.min(1, F.k + dt / (F.gas ? 22 : 30));
        if (F.t >= T_BREAK) { F.st = 'blaze'; breakout(F); }
      } else if (F.st === 'blaze') {
        F.k = Math.min(1, F.k + dt / 30);
        if (!F.called && F.t >= T_CALL) { F.called = true; dispatchTruck(F); }
        if (!F.B && F.t > 70) { F.st = 'smolder'; F.smolderAt = F.t; F.sm = 0; INTM.close(id, true); }   // no outdoor building found: burn out on a timer
      } else if (F.st === 'spray') {
        F.spray += dt;
        if (F.spray > SPRAY) { F.st = 'smolder'; F.smolderAt = F.t; F.sm = 0; INTM.close(id, true); out(F); }
      } else if (F.st === 'smolder') {
        F.sm = Math.min(1, (F.t - F.smolderAt) / SMOLDER);
        if (F.sm >= 1) { F.st = 'condemned'; F.condemnAt = F.t; }
      } else if (F.st === 'condemned') {
        const far = !F.B || Math.hypot(P.x - F.B.cx, P.z - F.B.cz) > 45;
        if (F.t > F.condemnAt + CONDEMNED && far) { rebuild(F); continue; }
      }
      // outdoor intensity: ramps up after the breakout, drops while hosed
      const target = F.st === 'inside' ? clamp((F.t - T_BREAK + 4) / 6, 0, 0.3) : F.st === 'blaze' ? Math.min(1, 0.35 + (F.t - T_BREAK) / 12) : F.st === 'spray' ? Math.max(0, 1 - F.spray / SPRAY) : 0;
      F.o += (target - F.o) * Math.min(1, dt * 1.5);
      if (F.st === 'spray') F.k = Math.min(F.k, Math.max(0, 1 - F.spray / SPRAY));
      if (F.st === 'smolder' || F.st === 'condemned') F.k = 0;
      F.smoke = F.st === 'smolder' ? 0.6 * (1 - F.sm) : F.st === 'condemned' ? 0 : clamp(F.k * 1.15, 0, 1);
      if (id === inId) { animIndoor(F, dt, t); inFire = F; }
      animOutdoor(F, dt, t);
      animTruck(F, dt, t);
      witness(F, dt);
    }
    // indoor hazards + overlay
    const want = inFire ? inFire.smoke : 0, wantGlow = inFire ? inFire.k : 0;
    smokeOverlay.v += (want - smokeOverlay.v) * Math.min(1, dt * 2);
    smokeOverlay.glow += (wantGlow - smokeOverlay.glow) * Math.min(1, dt * 2);
    smokeEl.style.opacity = String(smokeOverlay.v * 0.85);
    smokeEl.firstChild.style.opacity = String(smokeOverlay.glow * (0.7 + 0.3 * Math.sin(t * 9)));
    if (inFire && !G.paused) {
      let dmg = 0;
      if (inFire.smoke > 0.4) dmg += (inFire.smoke - 0.4) * 9 * dt;
      const R = inFire.indoor && inFire.indoor.R;
      if (R) for (const c of inFire.clusters) if (c.k > 0.3 && Math.hypot(P.x - (R.origin.x + c.x), P.z - (R.origin.z + c.z)) < 0.75 * c.k + 0.2) dmg += 14 * c.k * dt;
      hurtAcc += dmg;
      if (hurtAcc >= 5) { hurtAcc = 0; hurt(5); }
      if (inFire.smoke > 0.45 && (coughT -= dt) <= 0) { coughT = 5; toast(['*cough cough*', 'Hack. Wheeze. The smoke is getting thick.', 'Your eyes water. Find the door!'][(Math.random() * 3) | 0], 2); }
    } else hurtAcc = 0;
    drawKit();
  }
  function breakout(F) {
    Sfx.boom();
    const B = F.B; if (!B) return;
    // glass bursts out of the windows
    for (const e of B.ents) for (let k = 0; k < 6; k++) puff('foam', e.x, 1.4, e.z, Math.sin(e.yaw) * rnd(2, 4) + rnd(-1, 1), rnd(1, 3), Math.cos(e.yaw) * rnd(2, 4) + rnd(-1, 1), 0.15, 0.8);
    // bystanders run
    for (const p of peds) {
      if (p.npc || p.state === 'down' || p.kind === 'officer') continue;
      if (Math.hypot(p.x - B.cx, p.z - B.cz) < 40) { p.state = 'flee'; p.t = 6 + Math.random() * 3; p.from = { x: B.cx, z: B.cz }; }
    }
    if (F.id === 'nana' && Math.hypot(P.x - B.cx, P.z - B.cz) < 80) setTimeout(() => toast('Nana: "MY QUILTS! MY CASSEROLE! ...Goobles, was that you?"', 4), 1500);
    if (Math.hypot(P.x - B.cx, P.z - B.cz) < 90 && !INT().current()) toast(`${name(F.id)} is fully ablaze.`, 3);
  }
  // a witness (a ped near the building, or the cat seen hanging around it) calls it in: PD heat
  function witness(F, dt) {
    if (F.witnessed || !F.B || F.st === 'condemned') return;
    if (INT() && INT().current() === F.id) return;   // inside: nobody can see you yet
    if (F.st === 'inside' && F.t < T_BREAK - 2) return;
    const B = F.B, dc = Math.hypot(P.x - B.cx, P.z - B.cz);
    if (dc > 35) return;
    let seen = false;
    for (const p of peds) { if (p.kind === 'raccoon' || p.state === 'down') continue; if (Math.hypot(p.x - P.x, p.z - P.z) < 28) { seen = true; break; } }
    if (!seen && dc < 12 && F.st !== 'inside') seen = Math.random() < dt * 0.25;   // loitering at the scene looks suspicious
    if (!seen) return;
    F.witnessed = true;
    G.heat = Math.max(G.heat, Math.min(5, G.heat + 2), 3); G.seenT = 0; Sfx.siren();
    banner('ARSON!', 'Somebody saw a white cat run out of ' + name(F.id) + '. PD en route.', 4, 'fail');
    if (!F.called) { F.called = true; dispatchTruck(F); }
  }
  function out(F) {
    if (F.B && Math.hypot(P.x - F.B.cx, P.z - F.B.cz) < 80) toast(`The VFD put out ${name(F.id)}. It's a smoking shell. Condemned.`, 4);
  }
  function rebuild(F) {
    const id = F.id;
    if (F.indoor) { F.indoor.g.removeFromParent(); disposeTree(F.indoor.g); }
    if (F.outdoor) { scene.remove(F.outdoor.g); disposeTree(F.outdoor.g); const i = lights.indexOf(F.outdoor.L); if (i >= 0) lights.splice(i, 1); }
    if (F.truck) { scene.remove(F.truck.g); for (const h of F.truck.crew) scene.remove(h); disposeTree(F.truck.g); }
    INTM.close(id, false);
    delete fires[id];
    toast(`The HOA rebuilt ${name(id)}. Overnight. Somehow. It looks exactly the same.`, 4.5);
  }
  function disposeTree(g) { g.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); if (o.geometry && o.geometry.dispose && !o.isSprite) o.geometry.dispose(); }); }

  // indoor light pool + fog: after interiors.js has set the room's own lights
  INTM.on('env', (id, R) => {
    const F = fires[id]; if (!F || !R) return;
    const k = F.k, sm = F.smoke || 0;
    // the hottest clusters borrow the last two pool lights
    const lit = F.clusters.filter((c) => c.k > 0.05).sort((a, b) => b.k - a.k);
    for (let j = 0; j < 2 && j < pool.length; j++) {
      const l = pool[pool.length - 1 - j], c = lit[j];
      if (!c) continue;
      l.position.set(R.origin.x + c.x, 0.9, R.origin.z + c.z); l.color.set(j ? 0xff8030 : 0xff6a20);
      l.intensity = 16 * (0.8 + 1.6 * c.k) * (0.75 + Math.random() * 0.5); l.distance = 9;
    }
    // the room's own lights go orange and dim behind the smoke
    for (let i = 0; i < pool.length - 2; i++) { const l = pool[i]; if (l.intensity > 0) { l.color.lerp(new THREE.Color(0xff7a30), k * 0.6); l.intensity *= 1 - sm * 0.45; } }
    if (scene.fog && sm > 0.02) { scene.fog.color.setRGB(0.16, 0.13, 0.12); scene.fog.near = 6 - sm * 5.5; scene.fog.far = 26 - sm * 19; }
    if (ctx.hemi) ctx.hemi.intensity *= 1 - sm * 0.4;
  });
  // extra E action + prompt inside rooms
  INTM.addPrompt((id) => {
    if (S.act) return { text: '...', btn: '...' };
    if (fires[id]) return null;
    if (!anyItem() && !hasLighter()) return null;
    if (!anyItem()) return null;   // a lighter alone does not make you an arsonist
    if (NO_BURN[id] || !BURNABLE[id]) return null;
    const k = kit();
    return k.ign && k.tinder && k.accel ? { text: 'Start a fire', btn: 'BURN' } : { text: 'Start a fire (missing stuff)', btn: 'BURN' };
  });
  INTM.addUse((id) => {
    if (S.act) return true;
    if (!anyItem() || fires[id]) return false;
    return tryIgnite(id);
  });

  // ---------- outdoor E + prompt (game.js hooks) ----------
  function condemnedNear() {
    for (const F of Object.values(fires)) {
      if ((F.st === 'smolder' || F.st === 'condemned') && F.B && Math.hypot(P.x - F.B.door.x, P.z - F.B.door.z) < 2.2) return F;
    }
    return null;
  }
  function prompt() {
    if (P.car || G.dialog || G.paused) return '';
    const p = pickupNear(); if (p) return `${key}: ${p.verb}`;
    const c = condemnedNear(); if (c) return `${name(c.id)}: CONDEMNED`;
    return '';
  }
  function interact() {
    if (P.car) return false;
    const p = pickupNear(); if (p) { grab(p); return true; }
    const c = condemnedNear(); if (c) { toast('Boarded up. A sign says "CONDEMNED BY ORDER OF THE HOA". Gary signed it twice.', 3.5); return true; }
    return false;
  }
  function hold() { return !!S.act; }

  const api = {
    update, prompt, interact, hold, bought, S, fires,
    give(id) { if (id === 'all') { S.inv.matches = 3; S.inv.news = true; S.inv.gas = true; } else if (id === 'matches') S.inv.matches = 3; else S.inv[id] = true; save(); },
    ignite(id) { const R = INT() && INT().room; if (!R || INT().current() !== id) return false; return startFire(id, { x: 0, z: 0 }); },
    skip(sec) { for (const F of Object.values(fires)) { F.t += sec; if (F.st === 'inside' || F.st === 'blaze') F.k = Math.min(1, F.k + sec / 30); } },
    get state() { return { inv: { ...S.inv }, lighter: hasLighter(), kit: kit(), fires: Object.fromEntries(Object.entries(fires).map(([id, F]) => [id, { st: F.st, t: +F.t.toFixed(1), k: +F.k.toFixed(2), o: +F.o.toFixed(2), witnessed: F.witnessed, truck: !!F.truck, parked: !!(F.truck && F.truck.parked) }])), pickups: pickups.map((p) => ({ id: p.id, x: +p.at.x.toFixed(1), z: +p.at.z.toFixed(1), up: p.mesh.visible })) }; },
  };
  window.__FIRE = api;
  return api;
}
