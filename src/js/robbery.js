// Robberies (diet 2026-11-26: "be able to rob the donut shop and rosie's diner").
// Walk up to the register in The Donut Hole or Rosie's Diner and press E ("Rob the register").
//   - The clerk (Dot / Darlene) puts her hands up and empties the till while you stay by the register.
//     Pistol drawn = faster and she waits longer before the silent alarm; a "paw in the sleeve" works too, slower.
//     E again = "Hurry up!" (speeds the till up a little). Walk away early = keep what she has handed over so far.
//   - Somewhere in the middle she hits the silent alarm: heat jumps to 3 stars (paw) / 4 stars (armed), which is
//     police escalation level 2 / 3 (police.js: cruisers = heat - 1). A second hold-up while the first is hot = 5.
//   - Maple Grove PD arrives at the store after ~20 s. Still inside then (or back inside while it is hot) = two
//     officers come through the door and arrest you (police.arrest -> BUSTED -> jail). Out the door or a window
//     first = normal chase outside. Hiding in the store you just robbed does not shake them; other buildings still do.
//   - Loot: the diner till is cash. The Donut Hole only takes fish, so its till is fish (plus Dot's emergency twenty,
//     and her boot collection if you wait for the whole till). Each till restocks after 8 game hours.
// Self-contained: wraps ROOMS.donut / ROOMS.diner build() the way townsfolk.js does (Darlene and the diner regulars
// are townsfolk.js figures, borrowed while the robbery runs). Hooks: tools/robbery-hooks.mjs (one import in game.js,
// banner/toast on window.__G, police.arrest() + "no hiding in the store you robbed" in police.js).
// Debug: window.__ROB (S, state, start(id, {armed}), hot, STORES)
import * as THREE from 'three';
import * as INTR from './interiors.js';
import { makeHuman } from './models.js';
import { makeOfficer } from './officer.js';
import { Sfx } from './sfx.js';

const W = () => window.__G || {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[(Math.random() * a.length) | 0];
const RESTOCK = 480;      // game seconds (8 game hours) before a till is worth robbing again
const HOT = 150;          // seconds the store stays a crime scene after the alarm
const PD_DELAY = { armed: 18, paw: 22 };

export const STORES = {
  donut: {
    name: 'The Donut Hole', clerk: 'Dot', loot: 'fish',
    reg: { x: 1.6, z: -2.0 }, spot: { x: 2.35, z: -1.0, r: 0.6 }, post: { x: 1.6, z: -2.7, yaw: 0 },
    dur: { armed: 7, paw: 11 }, alarm: { armed: [0.55, 0.85], paw: [0.3, 0.6] },
    lines: {
      armed: ['Oh my stars! Take the fish! Take ALL the fish!', 'Sweet mother of glaze. OK. OK.'],
      paw: ['Is that... your paw? In your sleeve? ...Fine. FINE.', 'Honey, I can see your toe beans.'],
      hurry: ['I\'m going! Bluegill are slippery!', 'Stop yelling, you\'ll scare the crullers!', 'Catfish don\'t fold, sweetie!'],
      alarm: ['...what button? I didn\'t press any button.', '(Dot leans on something under the counter. Click.)'],
      done: ['That\'s the whole till. And the boots. Happy?', 'There. Now git. And wipe your paws.'],
      empty: 'Dot: "Till\'s empty, sweetie. You already cleaned me out. Come back after the fish man."',
      after: ['You come back here again and I\'m calling your mother.', 'I know where you park that RV.'],
    },
  },
  diner: {
    name: "Rosie's Diner", clerk: 'Darlene', loot: 'cash', cash: [140, 190],
    reg: { x: 1.15, z: -2.42 }, spot: { x: 1.15, z: -1.08, r: 0.55 }, post: { x: 1.15, z: -3.0, yaw: 0 },
    dur: { armed: 8, paw: 12 }, alarm: { armed: [0.5, 0.85], paw: [0.25, 0.55] },
    lines: {
      armed: ['Okay, okay, hon. Nobody needs to get hurt.', 'Easy, sugar. Easy. It\'s all yours.'],
      paw: ['Sugar, that\'s a paw. ...Rosie, he\'s got a paw!', 'Is that a gun or are you just a cat?'],
      hurry: ['I\'m counting, hon! Ones are sticky!', 'You want it fast or you want it all?', 'This drawer sticks, sugar!'],
      alarm: ['(Darlene\'s knee bumps something under the counter.)', 'Whoops. ...That was nothing.'],
      done: ['That\'s everything. Even the quarters.', 'Here. Take the tip jar too. Just go.'],
      empty: 'Darlene: "Drawer\'s empty, hon. You already got us. Rosie\'s still crying."',
      after: ['You\'re not getting pie for a month.', 'I\'m telling Rosie to spit in your tuna melt.'],
      rosie: ['GIVE THE CAT THE MONEY, DARLENE!', 'IS THAT THE CAT AGAIN?!', 'I\'M CALLING MY COUSIN AT THE PD!'],
    },
  },
};

const S = {
  stores: { donut: { robbedT: -1e9, count: 0, take: 0 }, diner: { robbedT: -1e9, count: 0, take: 0 } },
  cur: null,          // { id, prog, armed, alarmAt, alarmed, hurryT, lineT }
  hot: null, hotUntil: 0, pdAt: 0,       // the crime scene + when the PD reaches its door
  storm: null,        // { id, t, cops: [{ mesh, x, z }] }
  rooms: {}, log: [], errors: [], arrests: 0,
};
const now = () => (W().G && W().G.time) || 0;
const log = (s) => { S.log.push(s); if (S.log.length > 40) S.log.shift(); };

// ---------------------------------------------------------------- small chat bubble (same look as townsfolk.js)
function makeBubble() {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 160;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, fog: false, toneMapped: false, sizeAttenuation: false }));
  sp.renderOrder = 999; sp.visible = false; sp.center.set(0.5, 0); sp.scale.set(0.42, 0.21, 1);
  const B = { sprite: sp, t: 0, text: '' };
  B.show = (text, shout) => {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 320, 160);
    const fs = text.length > 70 ? 21 : 24; g.font = `${fs}px VT323, "Courier New", monospace`;
    const words = text.split(' '), lines = []; let c = '';
    for (const w of words) { const t = c ? c + ' ' + w : w; if (g.measureText(t).width > 280 && c) { lines.push(c); c = w; } else c = t; }
    if (c) lines.push(c);
    const L = lines.slice(0, 4), lh = fs + 2, h = L.length * lh + 20, w = Math.min(304, Math.max(...L.map((l) => g.measureText(l).width)) + 28);
    const x0 = (320 - w) / 2, y0 = 160 - 26 - h, fill = shout ? '#ffe680' : '#f6f1e2';
    g.fillStyle = fill; g.strokeStyle = '#1a1620'; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, 12) : g.rect(x0, y0, w, h); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(148, y0 + h - 2); g.lineTo(160, 156); g.lineTo(170, y0 + h - 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = fill; g.fillRect(150, y0 + h - 5, 18, 5);
    g.fillStyle = '#1a1620'; g.textAlign = 'center'; g.textBaseline = 'middle';
    L.forEach((l, i) => g.fillText(l, 160, y0 + 10 + lh * (i + 0.5)));
    tex.needsUpdate = true; sp.visible = true; B.text = text; B.t = clamp(2.2 + text.length * 0.055, 2.5, 6);
  };
  B.tick = (dt) => { if (B.t > 0 && (B.t -= dt) <= 0) { sp.visible = false; B.text = ''; } };
  return B;
}

// ---------------------------------------------------------------- HUD (top centre, under the banner)
let hud = null;
function hudEl() {
  if (hud) return hud;
  hud = document.createElement('div'); hud.id = 'robhud';
  hud.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:40;pointer-events:none;display:none;'
    + 'font:16px VT323,"Courier New",monospace;color:#fff;background:rgba(30,6,10,0.78);border:2px solid #ff4a4a;border-radius:6px;'
    + 'padding:6px 12px;text-align:center;min-width:220px;max-width:86vw;text-shadow:1px 1px 0 #000;letter-spacing:0.5px';
  document.body.appendChild(hud);
  return hud;
}
let hudShown = '';
function setHud(html) {
  const h = hudEl(); if (html === hudShown) return; hudShown = html;
  h.style.display = html ? 'block' : 'none'; if (html) h.innerHTML = html;
}
const bar = (p, col) => `<div style="height:8px;margin:4px 0 2px;background:#2a1418;border:1px solid #000"><div style="height:100%;width:${(clamp(p, 0, 1) * 100).toFixed(0)}%;background:${col}"></div></div>`;

// ---------------------------------------------------------------- props
function makeRegister(drawerCol = 0x2a2a2a) {
  const g = new THREE.Group();
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.36), M(0x3a3a40)); body.position.y = 0.1; g.add(body);
  const keys = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.16), M(0xd8d0c0)); keys.position.set(0, 0.22, 0.06); keys.rotation.x = -0.35; g.add(keys);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.03), M(0x222222)); scr.position.set(0, 0.32, -0.1); g.add(scr);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), new THREE.MeshBasicMaterial({ color: 0x80ff90 })); glow.position.set(0, 0.32, -0.084); g.add(glow);
  const drawer = new THREE.Group(); drawer.position.set(0, 0.04, 0); g.add(drawer);
  const dr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.34), M(drawerCol)); drawer.add(dr);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.14), M([0x6aa060, 0x7ab070, 0xd8c060, 0x6aa060][i])); b.position.set(-0.14 + i * 0.093, 0.04, 0.02); drawer.add(b); }
  g.userData = { drawer, glow };
  return g;
}
function makeDot() {
  const fig = makeHuman({ skin: 0xf0c8a8, hair: 0xc8c0b8, shirt: 0xff8ab8, pants: 0x5a3a4a, shoe: 0xf4f4f4, bun: true, glasses: true, wrinkles: true });
  const u = fig.userData;
  const ap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.02), new THREE.MeshLambertMaterial({ color: 0xfff4f8 })); ap.position.set(0, 1.0, 0.12); u.torso.add(ap);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.01), new THREE.MeshLambertMaterial({ color: 0xb05070 })); tag.position.set(0.1, 1.36, 0.115); u.torso.add(tag);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.14), new THREE.MeshLambertMaterial({ color: 0xffffff })); hat.position.set(0, 0.2, -0.01); u.head.add(hat);
  return fig;
}
// arms straight up, a nervous shake
function handsUp(u, t, k = 1, seed = 0) {
  const sh = Math.sin(t * 31 + seed) * 0.05 * k;
  u.arms[0].rotation.set(-2.85 + sh, 0, -0.25); u.arms[1].rotation.set(-2.85 - sh, 0, 0.25);
  if (u.torso) u.torso.rotation.x = -0.05;
}
// one arm forward over the counter (handing over the money), the other still up
function handOver(u, t) {
  const c = Math.max(0, Math.sin(t * 6)) ;
  u.arms[0].rotation.set(-2.8, 0, -0.25); u.arms[1].rotation.set(-0.9 - c * 0.5, 0, 0.1);
  if (u.torso) u.torso.rotation.x = 0.15;
}

// ---------------------------------------------------------------- room wrap
function wrapRoom(id, room) {
  if (!room || room.__robbery) return;
  const prev = room.build;
  room.build = (ctx) => {
    const out = prev(ctx);
    try { decorate(id, out); } catch (e) { S.errors.push(String(e)); console.error('[robbery] build', e); }
    return out;
  };
  room.__robbery = true;
}
function decorate(id, out) {
  const cfg = STORES[id];
  const R = { id, out, cfg, group: out.group, bubble: makeBubble(), lastT: null, dot: null, reg: null, hurry: 0 };
  // our own register on the diner counter (the diner had none); the donut room keeps its own and gets a drawer that slides out
  if (id === 'diner') {
    const reg = makeRegister(0x2a2a2a); reg.position.set(cfg.reg.x, 1.03, cfg.reg.z); reg.rotation.y = 0; out.group.add(reg); R.reg = reg;
    out.cols = out.cols || [];
  } else {
    const reg = new THREE.Group(); reg.position.set(cfg.reg.x, 0.93, cfg.reg.z + 0.12); out.group.add(reg);
    const drawer = new THREE.Group(); reg.add(drawer);
    drawer.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.3), new THREE.MeshLambertMaterial({ color: 0x5a5a60 })));
    const FC = [0x7aa0c8, 0x5a8a4a, 0x6a6a5a, 0xd08a7a];
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.2), new THREE.MeshLambertMaterial({ color: FC[i] })); f.position.set(-0.135 + i * 0.09, 0.035, 0); drawer.add(f); }
    drawer.position.z = -0.25; drawer.visible = false;
    reg.userData = { drawer }; R.reg = reg;
    // Dot, finally out from the back: behind the register
    const dot = makeDot(); dot.position.set(cfg.post.x, 0, cfg.post.z); dot.rotation.y = cfg.post.yaw; out.group.add(dot); R.dot = dot;
    out.cols = out.cols || [];
  }
  out.group.add(R.bubble.sprite);
  out.interact = out.interact || [];
  out.interact.push({ id: 'rob', x: cfg.spot.x, z: cfg.spot.z, r: cfg.spot.r, label: 'Rob the register', onUse: () => { try { use(id); } catch (e) { S.errors.push(String(e)); console.error('[robbery]', e); } } });
  const up = out.update;
  out.update = (t) => {
    if (up) up(t);
    try { tick(R, t); } catch (e) { S.errors.push(String(e)); console.error('[robbery] update', e); }
  };
  S.rooms[id] = R;
}

// the townsfolk diner figures (Darlene + regulars), if townsfolk.js is in the build
const town = () => { try { return window.__TOWN && window.__TOWN.S && window.__TOWN.S.rooms && window.__TOWN.S.rooms.diner; } catch (e) { return null; } };
function clerkSay(id, text, shout) {
  log(`${id}: ${text}`);
  if (id === 'diner') { if (window.__TOWN && window.__TOWN.say('diner', 'darlene', text)) return; }
  const R = S.rooms[id]; if (R) R.bubble.show(text, shout);
}
function rosieSay(text) { if (window.__TOWN) window.__TOWN.say('diner', 'rosie', text); }

// ---------------------------------------------------------------- the hold-up
function use(id) {
  const G = W().G; if (!G) return;
  const cfg = STORES[id], st = S.stores[id];
  if (S.storm) return;
  if (S.cur) {   // E again: hurry her up
    if (S.cur.id !== id) return;
    if (now() - S.cur.hurryT < 0.45) return;
    S.cur.hurryT = now(); S.cur.prog = Math.min(0.999, S.cur.prog + 0.06); S.hurries = (S.hurries || 0) + 1;
    Sfx.punch(); W().toast && W().toast(pick(['"FASTER!"', '"HURRY UP!"', '"MEOW! (the scary kind)"', '"PUT IT IN THE BAG!"']), 1.2);
    if (now() - S.cur.lineT > 2.2) { S.cur.lineT = now(); clerkSay(id, pick(cfg.lines.hurry), true); }
    return;
  }
  if (now() - st.robbedT < RESTOCK) { Sfx.blip(180); W().toast && W().toast(cfg.lines.empty, 3.5); return; }
  start(id);
}
export function start(id, o = {}) {
  const G = W().G; if (!G || S.cur || S.storm) return false;
  const cfg = STORES[id]; if (!cfg) return false;
  const pol = W().police;
  const armed = o.armed !== undefined ? !!o.armed : !!(pol && pol.armed && pol.armed());
  const k = armed ? 'armed' : 'paw', [a0, a1] = cfg.alarm[k];
  S.cur = { id, prog: 0, armed, k, alarmAt: a0 + Math.random() * (a1 - a0), alarmed: false, hurryT: -9, lineT: now(), t0: now() };
  const R = S.rooms[id]; if (R && R.reg && R.reg.userData.drawer) R.reg.userData.drawer.visible = true;
  // witnesses: a star right away (more if you are already wanted)
  G.heat = Math.min(5, Math.max(G.heat, 1)); G.seenT = 0;
  Sfx.siren && Sfx.punch();
  W().banner && W().banner('STICK UP!', armed ? `${cfg.clerk} is emptying the till. Stay by the register. E: hurry her up.` : `Paw in the sleeve. ${cfg.clerk} is... going along with it. Stay close. E: hurry her up.`, 2.6);
  clerkSay(id, pick(cfg.lines[k]), true);
  if (id === 'diner') setTimeout(() => rosieSay(pick(cfg.lines.rosie)), 1600);
  const T = town(); if (T && id === 'diner') { const d = T.npcs.darlene; if (d) { d.task = { kind: 'wait', t: 1e9 }; d.path = []; d.carry = false; if (d.pot) d.pot.visible = false; if (d.plate) d.plate.visible = false; } }
  log(`start ${id} ${k}`);
  return true;
}
function alarm(id, why) {
  const c = S.cur, cfg = STORES[id], G = W().G;
  if (c) c.alarmed = true;
  const armed = c ? c.armed : true;
  const again = S.hot && S.hot !== id && now() < S.hotUntil;   // two hold-ups in one spree
  const want = again ? 5 : armed ? 4 : 3;
  G.heat = Math.min(5, Math.max(G.heat, want)); G.seenT = 0; G.hideT = 0;
  S.hot = id; S.hotUntil = now() + HOT; S.pdAt = now() + PD_DELAY[armed ? 'armed' : 'paw'];
  Sfx.siren();
  W().banner && W().banner('SILENT ALARM', why || `${cfg.clerk} hit the button under the counter. Maple Grove PD is on the way.`, 3, 'fail');
  log(`alarm ${id} heat ${G.heat}`);
}
function finish(id, why) {
  const c = S.cur; if (!c) return;
  const cfg = STORES[id], st = S.stores[id], G = W().G, fishing = W().fishing;
  if (!c.alarmed) alarm(id, why === 'left' ? `${cfg.clerk} is on the phone to 911 before you reach the door.` : null);
  const p = clamp(c.prog, 0, 1);
  let msg = '';
  if (cfg.loot === 'cash') {
    const total = cfg.cash[0] + Math.random() * (cfg.cash[1] - cfg.cash[0]);
    const cash = Math.round(total * p) + (p >= 1 ? 12 : 0);   // full till: the tip jar too
    if (cash > 0) { W().addCash ? W().addCash(cash) : (G.cash += cash); }
    st.take += cash; S.lastTake = { id, cash, fish: 0 };
    msg = cash > 0 ? `+$${cash}${p >= 1 ? ' (and the tip jar)' : ''}` : 'Nothing. She never got the drawer open.';
  } else {
    const n = Math.round(8 * p), got = {};
    const bag = ['bluegill', 'bluegill', 'bluegill', 'bass', 'bass', 'catfish', 'trout'];
    for (let i = 0; i < n; i++) { const f = pick(bag); try { fishing && fishing.give(f); } catch (e) { /* no fishing */ } got[f] = (got[f] || 0) + 1; }
    let cash = 0; if (p > 0.5) { cash = 20; W().addCash ? W().addCash(cash) : (G.cash += cash); }
    if (p >= 1) for (let i = 0; i < 3; i++) { try { fishing && fishing.give('boot'); } catch (e) { /* no fishing */ } got.boot = (got.boot || 0) + 1; }
    st.take += cash; S.lastTake = { id, cash, fish: n, got };
    const parts = Object.entries(got).map(([k, v]) => `${v} ${k === 'boot' ? 'old boot' + (v > 1 ? 's' : '') : k}`);
    msg = parts.length || cash ? `${parts.join(', ')}${cash ? `${parts.length ? ' + ' : ''}Dot's emergency $20` : ''}` : 'Nothing. Dot never opened the till.';
  }
  st.robbedT = now(); st.count++;
  const R = S.rooms[id];
  if (R && R.reg && R.reg.userData.drawer) R.reg.userData.drawer.visible = id === 'diner' || p < 1;
  clerkSay(id, p >= 1 ? pick(cfg.lines.done) : pick(cfg.lines.after), true);
  W().toast && W().toast(`Robbed ${cfg.name}: ${msg}`, 4.5);
  Sfx.pickup();
  log(`finish ${id} p=${p.toFixed(2)} ${msg}`);
  S.cur = null;
}

// ---------------------------------------------------------------- the PD comes through the door
function storm(R) {
  const G = W().G, scene = W().scene, I = window.__INT;
  if (!scene || !I || !I.state || !I.state.room) return;
  const org = I.state.room.origin, ex = R.out.exit;
  const cops = [];
  for (let i = 0; i < 2; i++) {
    const mesh = makeOfficer();
    mesh.traverse((o) => o.layers.set(1));
    const x = org.x + ex.x + (i ? 0.55 : -0.55), z = org.z + ex.z - 0.4;
    mesh.position.set(x, 0, z); mesh.rotation.y = Math.PI; scene.add(mesh);
    mesh.userData.gun && (mesh.userData.gun.visible = true);
    cops.push({ mesh, x, z, yaw: Math.PI, name: pick(['Pruitt', 'Dawson', 'Kowalski', 'Reyes', 'Bixby', 'Halvorsen']), ph: Math.random() * 6 });
  }
  S.storm = { id: R.id, t: 0, cops, org };
  Sfx.door && Sfx.door(); Sfx.siren();
  W().banner && W().banner('MAPLE GROVE PD!', 'Paws where we can see them! (Run for a window...)', 2.4, 'fail');
  if (R.id === 'diner') rosieSay('TOLD YOU! MY COUSIN!'); else clerkSay(R.id, 'In here, officers! The white one!', true);
  log(`storm ${R.id}`);
}
function endStorm() {
  const s = S.storm; if (!s) return;
  const scene = W().scene;
  for (const c of s.cops) { if (c.arresting) continue; scene && scene.remove(c.mesh); }
  S.storm = null;
}
function tickStorm(R, dt, t) {
  const s = S.storm, P = W().P, pol = W().police; if (!s || !P) return;
  s.t += dt;
  for (const c of s.cops) {
    if (c.arresting) continue;
    const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz);
    c.yaw = Math.atan2(dx, dz);
    if (s.t > 0.8 && d > 1.1) {   // walk in, guns up
      const sp = 2.2 * dt; c.x += dx / d * sp; c.z += dz / d * sp;
      c.ph += dt * 9;
    }
    const u = c.mesh.userData;
    c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.yaw;
    if (u.legs) { const k = Math.sin(c.ph) * 0.6; u.legs[0].rotation.x = k; u.legs[1].rotation.x = -k; }
    u.arms[1].rotation.x = -1.45; u.arms[1].rotation.z = 0.05; u.arms[0].rotation.x = -1.3; u.arms[0].rotation.z = 0.35;
  }
  const near = s.cops.find((c) => Math.hypot(P.x - c.x, P.z - c.z) < 1.25);
  if ((near || s.t > 7) && !s.done) {
    s.done = true;
    const c = near || s.cops[0];
    c.arresting = true;
    const line = pick(['You have the right to remain fluffy.', 'Robbing a donut shop. In THIS town. Unbelievable.', 'Drop the fish, cat.', 'Rosie\'s cousin says hi.']);
    let ok = false;
    try { ok = pol && pol.arrest && pol.arrest({ name: c.name, mesh: c.mesh }, line); } catch (e) { S.errors.push(String(e)); }
    S.arrests++;
    S.hot = null; S.pdAt = 0;
    if (!ok) { W().banner && W().banner('BUSTED!', `Officer ${c.name}: "${line}"`, 3, 'fail'); }
    log(`arrest ${R.id} ok=${ok}`);
    // the arresting officer is now police.js's (it walks him behind the cat); the other one leaves with the room
    setTimeout(() => { const scene = W().scene; if (scene) scene.remove(c.mesh); }, 6000);
    for (const o of s.cops) if (o !== c) { W().scene && W().scene.remove(o.mesh); }
    S.storm = null;
  }
}

// ---------------------------------------------------------------- per frame (only while inside one of the two rooms)
function tick(R, t) {
  const dt = R.lastT === null ? 0 : clamp(t - R.lastT, 0, 0.1); R.lastT = t;
  R.bubble.tick(dt);
  const P = W().P, G = W().G, cfg = R.cfg;
  if (!P || !G) return;
  const lx = P.x - R.group.position.x, lz = P.z - R.group.position.z;
  const c = S.cur && S.cur.id === R.id ? S.cur : null;
  // clerk
  const T = R.id === 'diner' ? town() : null, dar = T && T.npcs && T.npcs.darlene;
  const fig = R.dot || (dar && dar.fig);
  const busy = c || (S.storm && S.storm.id === R.id) || (S.hot === R.id && now() < S.pdAt + 4);
  if (R.dot) {
    const u = R.dot.userData, yaw = Math.atan2(lx - cfg.post.x, lz - cfg.post.z);
    R.dot.rotation.y += (clamp(yaw, -1.2, 1.2) - R.dot.rotation.y) * Math.min(1, dt * 3);
    if (!busy) { u.arms[0].rotation.set(-0.15, 0, -0.08 + Math.sin(t * 1.3) * 0.03); u.arms[1].rotation.set(-0.15, 0, 0.08); u.torso.rotation.x = 0.03 * Math.sin(t * 0.8); }
  }
  if (dar && busy) {   // Darlene goes to the register and stays there
    const tx = cfg.post.x, tz = cfg.post.z, dx = tx - dar.x, dz = tz - dar.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { const sp = Math.min(d, 2.4 * dt); dar.x += dx / d * sp; dar.z += dz / d * sp; }
    dar.pose = 'stand'; dar.lookK = 0; dar.yaw = Math.atan2(lx - dar.x, lz - dar.z);
    dar.fig.position.set(dar.x, 0, dar.z); dar.fig.rotation.y = dar.yaw;
    if (dar.task && dar.task.kind !== 'wait') { dar.task = { kind: 'wait', t: 1e9 }; dar.path = []; }
  } else if (dar && dar.task && dar.task.kind === 'wait' && dar.task.t > 1e8) { dar.task = null; }   // let townsfolk.js have her back
  if (fig && busy) {
    const u = fig.userData;
    if (c && c.prog > 0.08) handOver(u, t); else handsUp(u, t, 1, 0);
  }
  // diner regulars: hands up while it is going down
  if (T && busy) for (const n of T.list || []) if (n.id !== 'darlene' && n.present !== false && n.fig) handsUp(n.fig.userData, t, 0.6, n.seed || 0);
  // the bubble over Dot
  if (R.dot) R.bubble.sprite.position.set(R.dot.position.x, 2.05, R.dot.position.z);
  // register drawer slides out while the till empties
  if (R.reg && R.reg.userData.drawer) { const dr = R.reg.userData.drawer, open = c ? 1 : 0; dr.position.z += ((open ? (R.id === 'diner' ? 0.2 : 0.05) : (R.id === 'diner' ? 0 : -0.25)) - dr.position.z) * Math.min(1, dt * 6); }

  // the hold-up
  if (c) {
    const d = Math.hypot(lx - cfg.spot.x, lz - cfg.spot.z);
    if (d > 3.0) { finish(R.id, 'left'); }
    else {
      c.prog += dt / cfg.dur[c.k];
      if (!c.alarmed && c.prog >= c.alarmAt) { alarm(R.id); clerkSay(R.id, pick(cfg.lines.alarm)); }
      if (c.prog >= 1) finish(R.id, 'done');
      else if (now() - c.lineT > 4.5 && Math.random() < dt * 0.6) { c.lineT = now(); if (R.id === 'diner' && Math.random() < 0.4) rosieSay(pick(cfg.lines.rosie)); else clerkSay(R.id, pick(cfg.lines.hurry)); }
    }
  }
  // the crime scene: no hiding here, the PD knows exactly which door
  const hot = S.hot === R.id && now() < S.hotUntil;
  if (hot) {
    G.hideT = 0; G.seenT = 0;
    if (G.heat < 3) G.heat = 3;
    if (!S.storm && !(W().police && W().police.busted) && now() >= S.pdAt) storm(R);
  }
  if (S.storm && S.storm.id === R.id) tickStorm(R, dt, t);

  // HUD
  const cur = S.cur && S.cur.id === R.id ? S.cur : null;
  if (cur) {
    const loot = cfg.loot === 'cash' ? `$${Math.round((cfg.cash[0] + cfg.cash[1]) / 2 * cur.prog)}` : `${Math.round(8 * cur.prog)} fish`;
    const pd = cur.alarmed ? `<div style="color:#ff6a6a">SILENT ALARM. PD IN ${Math.max(0, Math.ceil(S.pdAt - now()))}s</div>` : '';
    setHud(`<b style="color:#ffd84a">ROBBING ${cfg.name.toUpperCase()}</b> ${cur.armed ? '(armed)' : '(paw in sleeve)'}${bar(cur.prog, '#ffd84a')}<div>${loot} so far &middot; E: hurry her up &middot; walk away to bail</div>${pd}`);
  } else if (S.storm && S.storm.id === R.id) {
    setHud('<b style="color:#ff6a6a">MAPLE GROVE PD! PAWS UP!</b><div>Get to a window or the door!</div>');
  } else if (hot && S.pdAt > now()) {
    setHud(`<b style="color:#ff6a6a">PD ARRIVING IN ${Math.ceil(S.pdAt - now())}s</b><div>Get out of ${cfg.name}!</div>`);
  } else if (hot) {
    setHud('<b style="color:#ff6a6a">THE PD IS AT THE DOOR</b>');
  } else setHud('');
}

// leaving mid-robbery: you keep what she handed over; the storm stays inside
INTR.on('exit', (id) => {
  try {
    if (S.cur && S.cur.id === id) finish(id, 'left');
    if (S.storm && S.storm.id === id) { endStorm(); W().toast && W().toast('You slipped past the officers!', 2.5); }
    const R = S.rooms[id]; if (R) R.lastT = null;
    setHud('');
  } catch (e) { S.errors.push(String(e)); }
});
INTR.on('enter', (id) => {
  const R = S.rooms[id]; if (R) R.lastT = null;
  // back inside the store you just robbed while the PD is outside: they come in after you
  if (S.hot === id && now() < S.hotUntil && now() >= S.pdAt) S.pdAt = now() + 5;
});

const ready = import('./rooms.js').then((m) => { for (const id of Object.keys(STORES)) wrapRoom(id, m.ROOMS && m.ROOMS[id]); })
  .catch((e) => { S.errors.push(String(e)); console.error('[robbery] rooms.js', e); });

window.__ROB = {
  ready, S, STORES, start,
  get hot() { return S.hot && now() < S.hotUntil ? S.hot : null; },
  get state() {
    const c = S.cur;
    return {
      cur: c ? { id: c.id, prog: +c.prog.toFixed(3), armed: c.armed, alarmed: c.alarmed, alarmAt: +c.alarmAt.toFixed(2) } : null,
      hot: this.hot, pdIn: S.pdAt ? +(S.pdAt - now()).toFixed(1) : null, storm: S.storm ? { id: S.storm.id, t: +S.storm.t.toFixed(2) } : null,
      stores: JSON.parse(JSON.stringify(S.stores)), lastTake: S.lastTake || null, arrests: S.arrests, heat: W().G ? W().G.heat : null,
      log: S.log.slice(-12), errors: S.errors.slice(),
    };
  },
  restock() { for (const k in S.stores) S.stores[k].robbedT = -1e9; },
};
