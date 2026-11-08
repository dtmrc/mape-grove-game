// Townsfolk inside the enterable buildings: praying parishioners at Chapel Hill Church and the staff + regulars of Rosie's
// Diner. Smart NPCs: they pray / eat / work, glance at the cat, talk in chat bubbles (to themselves and to each other),
// react to what the cat does (paw swipes, jumping on furniture, a drawn pistol, sirens, the piano, the jukebox) and can
// be talked to with E. Darlene the waitress walks the floor and takes your order at the booth (cash or fish).
//
// No edits to rooms.js / interiors.js: this module wraps ROOMS.<id>.build (the same object interiors.js keeps in its
// registry, built lazily on first entry) and appends figures, colliders, hotspots (with onUse) and an update(t) to the
// room it returns. Wired into game.js by one import line (tools/townsfolk-hooks.mjs).
// Debug: window.__TOWN (state, say(npcId, text), order(itemId, 'cash'|'fish'), cast)
import * as THREE from 'three';
import * as INTR from './interiors.js';
import { makeHuman, animBiped } from './models.js';
import { Sfx } from './sfx.js';

const HOUR = 60, DAY = 24 * HOUR;                       // game.js: one game hour per real minute
const FISH_VALUE = { bluegill: 1, bass: 2, raccoon: 2, catfish: 3, trout: 4 };   // same points as the Donut Hole
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const W = () => window.__G || {};

const S = { rooms: {}, talks: {}, daily: {}, orders: [], pay: 'cash', log: [], errors: [] };

// ---------------------------------------------------------------- shared UI helpers
let toastTimer = 0;
function toast(t, d = 3.5) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = t; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), d * 1000);
}
function say(lines, then) {   // same dialog box as game.js say(); game.js advanceDialog() pages through it
  const G = W().G; const dlg = document.getElementById('dialog'); if (!G || !dlg) return;
  G.dialog = { lines: lines.slice(), then };
  const [who, text] = lines[0];
  dlg.innerHTML = `<div class="who">${who}</div><div class="txt">${text}</div><i>▼</i>`;
  dlg.style.display = 'block';
}
const sinceDaily = (key) => { const G = W().G; return G ? G.time - (S.daily[key] ?? -1e9) : 0; };
const dailyReady = (key) => sinceDaily(key) >= DAY;
const markDaily = (key) => { S.daily[key] = W().G.time; };
const feed = (n) => { try { W().fishing.feed(n); } catch (e) { /* no fishing */ } };
const hpUp = (n) => { const G = W().G; if (G) G.hp = Math.min(100, G.hp + n); };

// ---------------------------------------------------------------- chat bubble (canvas sprite, rendered on layer 1 with the room)
function wrap(g, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function makeBubble() {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 160;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, fog: false, toneMapped: false, sizeAttenuation: false }));
  sp.renderOrder = 999; sp.visible = false; sp.center.set(0.5, 0);
  const B = { sprite: sp, t: 0, text: '' };
  B.show = (text, style = 'say', dur) => {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 320, 160);
    const fs = text.length > 70 ? 21 : 24;
    g.font = `${style === 'pray' ? 'italic ' : ''}${fs}px VT323, "Courier New", monospace`;
    const lines = wrap(g, text, 280).slice(0, 4), lh = fs + 2, h = lines.length * lh + 20, w = Math.min(304, Math.max(...lines.map((l) => g.measureText(l).width)) + 28);
    const x0 = (320 - w) / 2, y0 = 160 - 26 - h;
    const fill = style === 'pray' ? 'rgba(232,228,250,0.92)' : style === 'shout' ? '#ffe680' : style === 'whisper' ? 'rgba(236,232,220,0.9)' : '#f6f1e2';
    g.fillStyle = fill; g.strokeStyle = '#1a1620'; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, 12) : g.rect(x0, y0, w, h); g.fill(); g.stroke();
    if (style === 'pray') {   // thought-bubble dots
      for (const [cx, cy, r] of [[160, y0 + h + 9, 6], [154, y0 + h + 20, 3.5]]) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke(); }
    } else {
      g.beginPath(); g.moveTo(148, y0 + h - 2); g.lineTo(160, 156); g.lineTo(170, y0 + h - 2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = fill; g.fillRect(150, y0 + h - 5, 18, 5);
    }
    g.fillStyle = style === 'pray' ? '#4a3a7a' : '#1a1620'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, 160, y0 + 10 + lh * (i + 0.5)));
    tex.needsUpdate = true; sp.visible = true; B.text = text;
    B.t = dur ?? clamp(2.2 + text.length * 0.055, 2.5, 6.5);
  };
  B.update = (dt) => { if (B.t > 0 && (B.t -= dt) <= 0) { sp.visible = false; B.text = ''; } };
  B.hide = () => { B.t = 0; sp.visible = false; B.text = ''; };
  sp.scale.set(0.42, 0.21, 1);   // screen-sized (sizeAttenuation off): readable from across the room
  return B;
}

// ---------------------------------------------------------------- figures with a real knee (makeHuman's legs are one piece)
function makeFigure(look) {
  const fig = makeHuman(look);
  const u = fig.userData;
  const pants = new THREE.MeshLambertMaterial({ color: look.pants ?? 0x3a3a48 }), shoe = new THREE.MeshLambertMaterial({ color: look.shoe ?? 0x2a2a2a });
  const thighG = new THREE.CylinderGeometry(0.085, 0.072, 0.45, 6); thighG.translate(0, -0.225, 0);
  const shinG = new THREE.CylinderGeometry(0.07, 0.058, 0.42, 6); shinG.translate(0, -0.21, 0);
  const shoeG = new THREE.BoxGeometry(0.12, 0.08, 0.24); shoeG.translate(0, -0.44, 0.05);
  u.bent = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(s * 0.1, 0.9, 0); u.body.add(thigh);
    thigh.add(new THREE.Mesh(thighG, pants));
    const knee = new THREE.Group(); knee.position.y = -0.45; thigh.add(knee);
    knee.add(new THREE.Mesh(shinG, pants), new THREE.Mesh(shoeG, shoe));
    thigh.visible = false; u.bent.push({ thigh, knee });
  }
  if (look.apron) {   // waitress apron + name tag
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.02), new THREE.MeshLambertMaterial({ color: 0xf8f4ec }));
    ap.position.set(0, 1.02, 0.12); u.torso.add(ap);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.01), new THREE.MeshLambertMaterial({ color: 0xe0c040 }));
    tag.position.set(0.1, 1.36, 0.115); u.torso.add(tag);
  }
  if (look.hat) {   // trucker cap
    const cap = new THREE.Group(); cap.position.y = 0.2;
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.1, 8), new THREE.MeshLambertMaterial({ color: look.hat })); cap.add(c1);
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), new THREE.MeshLambertMaterial({ color: look.hat })); bill.position.set(0, -0.04, 0.17); cap.add(bill);
    u.head.add(cap);
  }
  return fig;
}
// a prop held in the right hand (follows the arm)
function handProp(fig, mesh, y = -0.66, z = 0.06) { const g = new THREE.Group(); g.position.set(0, y, z); g.add(mesh); fig.userData.arms[1].add(g); g.visible = false; return g; }

function setLegs(n, bent) {
  const u = n.fig.userData;
  for (const l of u.legs) l.visible = !bent;
  for (const b of u.bent) b.thigh.visible = bent;
}
function resetArms(u) {
  u.arms[0].rotation.set(0, 0, -0.08); u.arms[1].rotation.set(0, 0, 0.08);
  u.torso.rotation.set(0, 0, 0); u.head.rotation.x = 0;
}

// pose + animation per frame. n.pose: kneel | sit | stand | walk
function animate(n, dt, t) {
  const u = n.fig.userData, sc = n.def.scale || 1, ph = t * 1.3 + n.seed;
  n.fig.position.set(n.x, 0, n.z);
  n.fig.rotation.y = n.yaw;
  if (n.pose === 'walk') {
    setLegs(n, false); resetArms(u);
    n.walkPh = (n.walkPh || 0) + dt * 7.5;
    animBiped(n.fig, n.walkPh, 1, t);
    if (n.carry) { u.arms[1].rotation.x = -1.1; u.arms[1].rotation.z = 0.15; }
    u.head.rotation.y += (0 - u.head.rotation.y) * Math.min(1, dt * 5);
    return;
  }
  resetArms(u);
  if (n.pose === 'kneel') {
    setLegs(n, true);
    u.body.position.y = -0.42;
    for (const b of u.bent) { b.thigh.rotation.x = -0.14; b.knee.rotation.x = Math.PI / 2 + 0.14; }
    const deep = n.talking > 0 || n.lookK > 0.5 ? 0 : 1;
    u.torso.rotation.x = 0.12 * deep + Math.sin(ph * 0.5) * 0.02;
    u.head.rotation.x = 0.42 * deep * (1 - n.lookK) + Math.sin(ph * 0.9) * 0.03 * deep;
    const fidget = n.def.fidget ? Math.max(0, Math.sin(t * 2.3 + n.seed)) * 0.5 : 0;
    u.arms[0].rotation.set(-1.0 + fidget * 0.6, 0, 0.5 - fidget * 0.4); u.arms[1].rotation.set(-1.0, 0, -0.5);
    if (n.def.fidget) u.torso.rotation.z = Math.sin(t * 1.7 + n.seed) * 0.08;
  } else if (n.pose === 'sit') {
    setLegs(n, true);
    u.body.position.y = (n.def.seat ?? 0.48) / sc - 0.9 + 0.04;
    for (const b of u.bent) { b.thigh.rotation.x = -Math.PI / 2; b.knee.rotation.x = Math.PI / 2 - 0.1; }
    u.torso.rotation.x = 0.06;
    const act = n.def.act;
    if (act === 'eat') {   // fork to mouth every few seconds
      const c = Math.max(0, Math.sin(t * 1.6 + n.seed)) ** 3;
      u.arms[1].rotation.set(-0.7 - c * 1.9, 0, -0.25 - c * 0.15); u.arms[0].rotation.set(-0.65, 0, 0.25);
      u.head.rotation.x = 0.25 - c * 0.3;
    } else if (act === 'coffee') {
      const c = Math.max(0, Math.sin(t * 0.7 + n.seed)) ** 6;
      u.arms[1].rotation.set(-0.8 - c * 1.7, 0, -0.2); u.arms[0].rotation.set(-0.7, 0, 0.3); u.head.rotation.x = 0.15 - c * 0.2;
    } else if (act === 'paper') {
      u.arms[0].rotation.set(-1.25, 0, 0.35); u.arms[1].rotation.set(-1.25, 0, -0.35); u.head.rotation.x = 0.3;
    } else if (act === 'phone') {
      u.arms[1].rotation.set(-1.45, 0, -0.35); u.arms[0].rotation.set(-0.7, 0, 0.3); u.head.rotation.x = 0.5;
    } else if (act === 'pancakes') {
      const c = Math.max(0, Math.sin(t * 1.2 + n.seed)) ** 3;
      u.arms[1].rotation.set(-0.7 - c * 1.8, 0, -0.25); u.arms[0].rotation.set(-0.8, 0, 0.35); u.head.rotation.x = 0.2 - c * 0.25;
    }
    if (n.talking > 0 || n.lookK > 0.5) u.head.rotation.x *= 0.2;
  } else {   // stand (waitress idle: wiping the counter)
    setLegs(n, false);
    u.body.position.y = 0;
    for (const l of u.legs) l.rotation.x = 0;
    if (n.def.wipe && n.task && n.task.kind === 'wipe') { const c = Math.sin(t * 5); u.arms[1].rotation.set(-0.9, 0, -0.2 + c * 0.35); u.head.rotation.x = 0.35; }
    if (n.carry) { u.arms[1].rotation.x = -1.1; u.arms[1].rotation.z = 0.15; }
  }
  // look at the cat (head first, then shoulders)
  const ly = n.lookYaw * n.lookK;
  u.head.rotation.y += (clamp(ly, -1.15, 1.15) - u.head.rotation.y) * Math.min(1, dt * 4);
  u.torso.rotation.y = clamp(ly - u.head.rotation.y, -0.5, 0.5) * 0.6;
}

// ---------------------------------------------------------------- room runtime
function makeRoomRuntime(id, out, cfg) {
  const R = { id, out, group: out.group, npcs: {}, list: [], chatT: 2 + Math.random() * 3, script: [], scriptT: 0, cool: {}, t: 0, lastT: null, cfg, events: 0 };
  for (const def of cfg.cast) {
    const fig = makeFigure(def.look);
    fig.scale.setScalar(def.scale || 1);
    const n = { def, id: def.id, fig, x: def.x, z: def.z, yaw: def.yaw, pose: def.pose, seed: Math.random() * 10, lookK: 0, lookYaw: 0, talking: 0, bubble: makeBubble(), carry: false, task: null, path: [], present: true };
    if (def.props) def.props(n, fig);
    out.group.add(fig); out.group.add(n.bubble.sprite);
    R.npcs[def.id] = n; R.list.push(n);
    animate(n, 0, 0);
  }
  // a "voice" with no body (Rosie in the kitchen)
  for (const v of cfg.voices || []) { const n = { def: v, id: v.id, voice: true, x: v.x, z: v.z, bubble: makeBubble(), lookK: 0 }; out.group.add(n.bubble.sprite); R.npcs[v.id] = n; }
  // colliders (kneelers stick out into the aisles; seated folk are inside the booth / stool boxes already)
  out.cols = out.cols || [];
  for (const def of cfg.cast) if (def.col) out.cols.push({ kind: 'box', cx: def.col.x, cz: def.col.z, w: def.col.w, d: def.col.d, rot: 0, h: 1.3 });
  // talk hotspots
  out.interact = out.interact || [];
  for (const h of cfg.spots) out.interact.push({ id: h.id, x: h.x, z: h.z, r: h.r || 0.8, label: h.label, onUse: () => { try { h.use(R); } catch (e) { S.errors.push(String(e)); console.error('[townsfolk]', e); } } });
  return R;
}
function sayB(R, nid, text, style, dur) {
  const n = R.npcs[nid]; if (!n || n.present === false) return false;
  n.bubble.show(text, style, dur); n.talking = n.bubble.t;
  S.log.push(`${R.id}:${nid}: ${text}`); if (S.log.length > 60) S.log.shift();
  return true;
}
function runScript(R, lines) { R.script = lines.slice(); R.scriptT = 0; }
function cooled(R, key, sec) { const t = R.t; if ((R.cool[key] ?? -1e9) > t - sec) return false; R.cool[key] = t; return true; }

function catLocal(R) {
  const P = W().P; if (!P) return null;
  return { x: P.x - R.group.position.x, z: P.z - R.group.position.z, y: P.y, punch: P.punch > 0, P };
}

function updateRoom(R, t) {
  const dt = R.lastT === null ? 0 : clamp(t - R.lastT, 0, 0.1); R.lastT = t; R.t += dt;
  if (!dt) return;
  const c = catLocal(R), G = W().G || {};
  // bubbles sit over heads
  for (const n of Object.values(R.npcs)) {
    n.bubble.update(dt); if (n.talking > 0) n.talking -= dt;
    if (n.voice) { n.bubble.sprite.position.set(n.x, n.def.y ?? 2.0, n.z); continue; }
    const top = n.pose === 'kneel' ? 1.45 : n.pose === 'sit' ? 1.62 : 2.02;
    n.bubble.sprite.position.set(n.x, top * (n.def.scale || 1) + (n.def.scale && n.def.scale < 0.8 ? 0.25 : 0), n.z);
  }
  // per-NPC: look at the cat when it's close (or when talking to it)
  for (const n of R.list) {
    if (!n.present) { if (R.cfg.think) R.cfg.think(R, n, dt); continue; }
    let want = 0;
    if (c) {
      const dx = c.x - n.x, dz = c.z - n.z, d = Math.hypot(dx, dz);
      n.catD = d;
      if (n.pose !== 'walk') {
        n.lookYaw = wrapA(Math.atan2(dx, dz) - n.yaw);
        if (d < (n.def.notice ?? 2.4) && Math.abs(n.lookYaw) < 2.2) want = 1;
        if (n.focus > 0) { n.focus -= dt; want = 1; }
        if (n.lookAt) { const a = wrapA(Math.atan2(n.lookAt.x - n.x, n.lookAt.z - n.z) - n.yaw); n.lookYaw = a; want = 1; if ((n.lookAt.t -= dt) <= 0) n.lookAt = null; }
      }
    }
    n.lookK += (want - n.lookK) * Math.min(1, dt * 3);
    if (R.cfg.think) R.cfg.think(R, n, dt);
    animate(n, dt, R.t);
  }
  // scripted exchanges, then ambient chatter
  if (R.script.length) {
    if ((R.scriptT -= dt) <= 0) { const [who, text, style] = R.script.shift(); sayB(R, who, text, style); R.scriptT = clamp(1.4 + text.length * 0.045, 1.8, 4.5); }
  } else if ((R.chatT -= dt) <= 0) {
    R.chatT = 5 + Math.random() * 6;
    if (Math.random() < 0.35 && R.cfg.convos.length) runScript(R, pick(R.cfg.convos).filter((l) => R.npcs[l[0]] && R.npcs[l[0]].present !== false));
    else {
      const who = pick(R.list.filter((n) => n.present && n.talking <= 0 && (n.def.ambient || []).length));
      if (who) sayB(R, who.id, pick(who.def.ambient), who.def.ambientStyle);
    }
  }
  // reactions to what the cat is doing
  if (c && R.cfg.react) R.cfg.react(R, c, G, dt);
}

// nearest present NPC to the cat (optionally filtered)
function nearest(R, c, f = () => true) { let best = null, bd = 1e9; for (const n of R.list) if (n.present && f(n) && n.catD < bd) { bd = n.catD; best = n; } return best; }
function faceCat(n, sec = 4) { n.focus = sec; }

function commonReact(R, c, G, lines) {
  const near = nearest(R, c);
  const police = W().police;
  if (c.punch && near && near.catD < 1.7 && cooled(R, 'punch', 6)) { faceCat(near); sayB(R, near.id, pick(lines.punch), 'shout'); }
  if (police && police.armed && police.armed() && near && near.catD < 4 && cooled(R, 'gun', 12)) { faceCat(near); sayB(R, near.id, pick(lines.gun), 'shout'); }
  if ((G.heat || 0) > 0 && cooled(R, 'heat', 22)) { const n = pick(R.list.filter((x) => x.present && x.def.heat)); if (n) sayB(R, n.id, pick(n.def.heat), 'whisper'); }
}

// ================================================================= Chapel Hill Church
const CHURCH = {
  cast: [
    { id: 'dolores', name: 'Dolores', x: -1.35, z: -1.35, yaw: Math.PI, pose: 'kneel', col: { x: -1.35, z: -1.15, w: 0.5, d: 0.75 },
      look: { skin: 0xf1c9a5, hair: 0xe8e8e8, shirt: 0x6a4a8a, pants: 0x4a3a5a, cardigan: 0x9a7ab0, glasses: true, wrinkles: true, bun: true, shoe: 0x2a2018, longSleeve: true },
      ambientStyle: 'pray',
      ambient: ['...and bless Gary. Lord knows he needs it.', "...and let my tomatoes beat Linda's at the fair. Humbly.", '...and watch over that little cat in the RV.', '...amen. And amen again, for good measure.', '...and forgive Walt for what he said about the water tower.'],
      heat: ['Sirens again. Sit with me a while, kitty. Nobody arrests a cat in church.'] },
    { id: 'walt', name: 'Walt', x: 1.4, z: 0.0, yaw: Math.PI, pose: 'kneel', col: { x: 1.4, z: 0.2, w: 0.55, d: 0.75 },
      look: { skin: 0xd9a47a, hair: 0x9a9a9a, shirt: 0x5a7a9a, pants: 0x3a4a6a, cap: null, wrinkles: true, shoe: 0x5a3a22, longSleeve: true },
      ambientStyle: 'pray',
      ambient: ['...rain on Tuesday, Lord. Not Monday. Monday is mowing.', '...and smite the raccoons. Gently. Mostly.', '...forgive me for what I said about the water tower.', '...and let the corn be knee high by the Fourth. Knee high on a man, not a cat.'],
      heat: ['(Walt, whispering) Somebody\'s got the law on their tail tonight.'] },
    { id: 'brenda', name: 'Brenda', x: -1.25, z: 4.05, yaw: Math.PI, pose: 'kneel', col: { x: -1.55, z: 4.25, w: 1.2, d: 0.75 },
      look: { skin: 0xa86f48, hair: 0x2b1d0e, shirt: 0x3a8a7a, pants: 0x2a2a3a, shoe: 0x222222 },
      ambientStyle: 'pray', ambient: ['...and please, Lord, let him sit still for ten minutes.', '...patience. Just a little more patience. Amen.'] },
    { id: 'tyler', name: 'Tyler', x: -1.95, z: 4.05, yaw: Math.PI, pose: 'kneel', scale: 0.62, fidget: true,
      look: { skin: 0xa86f48, hair: 0x2b1d0e, shirt: 0xe0a020, pants: 0x3a5a9a, shoe: 0xe8e8e8, smile: true },
      ambient: ['Mom. How much longer?', '...and a dirt bike. Amen.', 'Is God a cat? He could be a cat.', '(humming loudly)'] },
    { id: 'marcus', name: 'Marcus', x: 0.4, z: -3.0, yaw: Math.PI, pose: 'kneel', col: { x: 0.4, z: -2.8, w: 0.5, d: 0.75 },
      look: { skin: 0x7a4b2e, hair: 0x111111, shirt: 0x4a4a52, pants: 0x2a3a5a, shoe: 0xe8e8e8, longSleeve: true },
      ambientStyle: 'pray',
      ambient: ['...please let my fantasy team make the playoffs. I will start coming more.', '...and if Kayla calls, give me the strength not to pick up.', '...okay, and if she does call, let me be cool about it.'],
      heat: ['Cops outside? I didn\'t see you, you didn\'t see me.'] },
    { id: 'hollis', name: 'Deacon Hollis', x: 0, z: 6.2, yaw: Math.PI, pose: 'stand', walker: true, notice: 2.0,
      look: { skin: 0xf1c9a5, hair: 0xaaaaaa, shirt: 0xf0f0ea, pants: 0x2a2a2e, cardigan: 0x2a2a3a, glasses: true, wrinkles: true, bald: true, shoe: 0x1a1a1a, longSleeve: true },
      ambient: ['Who keeps leaving the hymnals open to 301?', 'Candles lit. Roof leaking. All is well.', 'Twelve thousand for a roof. We have thirty-four dollars and a moth.', 'Hymn 112 again. Nobody knows the third verse.'] },
  ],
  spots: [
    { id: 'parish-dolores', x: -0.62, z: -1.25, r: 0.75, label: 'Talk to Dolores', use: (R) => talkDolores(R) },
    { id: 'parish-walt', x: 0.62, z: 0.1, r: 0.75, label: 'Talk to Walt', use: (R) => talkWalt(R) },
    { id: 'parish-family', x: -0.55, z: 4.1, r: 0.8, label: 'Talk to Brenda and Tyler', use: (R) => talkFamily(R) },
    { id: 'parish-marcus', x: -0.4, z: -2.55, r: 0.7, label: 'Talk to Marcus', use: (R) => talkMarcus(R) },
  ],
  convos: [
    [['tyler', 'Mom. MOM. There\'s a cat.'], ['brenda', 'Tyler. Hands together.', 'whisper'], ['tyler', 'It has a VEST.']],
    [['walt', 'Psst. Dolores. Your tomatoes in yet?', 'whisper'], ['dolores', 'Walt, we are PRAYING.', 'whisper'], ['walt', '...So that\'s a no.', 'whisper']],
    [['tyler', 'Do cats go to heaven?'], ['brenda', 'Yes.', 'whisper'], ['tyler', 'Do raccoons?'], ['brenda', '...Pray, Tyler.', 'whisper']],
    [['hollis', 'Marcus. Good to see you, son.'], ['marcus', 'Just... needed the quiet, Deacon.']],
    [['dolores', 'Lord, and Tyler\'s humming. Bless the humming.', 'pray'], ['tyler', '(humming louder)']],
  ],
  think: (R, n, dt) => { if (n.def.walker) walkerThink(R, n, dt); },
  react: (R, c, G, dt) => {
    commonReact(R, c, G, {
      punch: ['Not in the Lord\'s house!', 'Goodness! Claws to yourself!', 'Easy, kitty. This is a church.'],
      gun: ['Put that away, son. Not in here.', 'Heavens! Holster that!'],
    });
    // up on the pews / the altar step
    if (c.y > 0.45 && Math.abs(c.x) > 0.9 && c.z > -2.5 && c.z < 5.5 && cooled(R, 'pews', 10)) { const n = nearest(R, c); if (n) { faceCat(n); sayB(R, n.id, pick(['Down from the pews, please.', 'Kitty! Those are for sitting.', 'Paws off the pews, little one.'])); } }
    if (c.z < -4.1 && c.y > 0.25 && cooled(R, 'altar', 12)) { sayB(R, 'hollis', 'Not the altar, friend! Mind the candles, whiskers are flammable.', 'shout') || sayB(R, 'dolores', 'Not the altar, kitty!'); }
  },
  onEnter: (R) => {
    for (const n of R.list) n.focus = 0;
    if (Math.random() < 0.6) runScript(R, [['tyler', pick(['CAT!', 'Mom, a cat came in!', 'Kitty!'])], ['brenda', 'Shh!', 'whisper']]);
    else sayB(R, 'hollis', pick(['Welcome, friend. Pews on the left, pews on the right.', 'Evening. Wipe your paws.']));
    const G = W().G; if (G && (G.clock >= 23 || G.clock < 5)) R.cool.late = 0, setTimeout(() => sayB(R, 'dolores', "Couldn't sleep either, sweetie?"), 2600);
  },
  onInteract: (R, spot) => {
    if (spot === 'piano') {
      for (const n of R.list) n.lookAt = { x: 2.6, z: -5.8, t: 3 };
      runScript(R, pick([[['tyler', 'DO IT AGAIN!'], ['brenda', 'Shh!', 'whisper']], [['hollis', 'That piano was tuned in 1974. You can tell.']], [['dolores', 'Lovely. Truly. ...What was it?']], [['walt', 'Was that Amazing Grace?'], ['marcus', 'That was a cat walking on a piano, Walt.']]]));
    } else if (spot === 'offering') {
      sayB(R, 'hollis', pick(['Every little bit helps the roof. Even... that.', 'Bless you. Is that a moth?']));
    } else if (spot === 'pulpit') {
      for (const n of R.list) n.lookAt = { x: -2.0, z: -5.4, t: 3 };
      runScript(R, [['tyler', 'The cat is gonna give the sermon!'], ['walt', 'Be shorter than Pastor Jim\'s.']]);
    }
  },
};

// Deacon Hollis walks the aisle: checks the hymnals, bows at the chancel step, wanders back to the narthex
const HOLLIS_STOPS = [
  { x: 0, z: 6.2, face: Math.PI, act: 'idle', say: null },
  { x: 0.55, z: 2.9, face: Math.PI / 2, act: 'tidy', say: 'Hymnal\'s upside down. Again.' },
  { x: -0.55, z: 0.4, face: -Math.PI / 2, act: 'tidy', say: null },
  { x: -0.4, z: -3.0, face: Math.PI, act: 'bow', say: null },
  { x: 0.55, z: -1.0, face: Math.PI / 2, act: 'tidy', say: 'Somebody left reading glasses. Dolores, are these yours?' },
];
// the cat is standing in the way: wait a moment (never at the last leg, where the cat is usually who they're walking to)
function blockedBy(n, c, p, d, dt) {
  if (!c || n.path.length < 2) { n.blockT = 0; return false; }
  const cd = Math.hypot(c.x - n.x, c.z - n.z);
  if (cd < 0.45 && Math.hypot(c.x - p.x, c.z - p.z) < d && (n.blockT = (n.blockT || 0) + dt) < 2.5) return true;
  if (cd > 0.8) n.blockT = 0;
  return false;
}
function walkerThink(R, n, dt) {
  if (!n.task) n.task = { i: 0, wait: 3 + Math.random() * 4 };
  const T = n.task;
  if (n.path.length) {
    const p = n.path[0], dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz);
    // step aside for the cat instead of walking through it
    const c = catLocal(R);
    if (blockedBy(n, c, p, d, dt)) { n.pose = 'stand'; if (cooled(R, 'excuse', 6)) sayB(R, n.id, pick(['Pardon me, friend.', 'Excuse me, kitty.'])); return; }
    if (d < 0.05) { n.path.shift(); return; }
    const sp = 0.75 * dt;
    n.x += dx / d * Math.min(sp, d); n.z += dz / d * Math.min(sp, d);
    n.yaw = Math.atan2(dx, dz); n.pose = 'walk';
    if (!n.path.length) { n.pose = 'stand'; n.yaw = HOLLIS_STOPS[T.i].face; T.wait = 4 + Math.random() * 5; const st = HOLLIS_STOPS[T.i]; if (st.say && Math.random() < 0.5) sayB(R, n.id, st.say); }
    return;
  }
  n.pose = 'stand';
  const st = HOLLIS_STOPS[T.i], u = n.fig.userData;
  if (st.act === 'bow') u.head.rotation.x = 0.5;
  if (st.act === 'tidy') { u.arms[1].rotation.set(-0.9 + Math.sin(R.t * 3) * 0.15, 0, -0.1); u.head.rotation.x = 0.45; }
  if ((T.wait -= dt) <= 0) {
    T.i = (T.i + 1) % HOLLIS_STOPS.length;
    const to = HOLLIS_STOPS[T.i];
    // stay in the centre aisle: go to x 0 first, along the aisle, then step to the stop
    n.path = [{ x: 0, z: n.z }, { x: 0, z: to.z }, { x: to.x, z: to.z }];
  }
}

function talkDolores(R) {
  const n = R.npcs.dolores, G = W().G; faceCat(n, 8);
  S.talks.dolores = (S.talks.dolores || 0) + 1;
  if (dailyReady('dolores') && G.hp < 100) {
    markDaily('dolores');
    say([['Dolores', 'Oh, you poor thing, you look beat up. Come here. Bow your little head.'], ['Dolores', 'Lord, keep this one out of trouble. Or at least out of jail. Amen.']], () => { G.hp = 100; Sfx.jingle(); toast('Dolores blessed you. Health fully restored. (once a day)', 4); sayB(R, 'dolores', 'There. Good as new.'); });
    return;
  }
  if ((G.heat || 0) > 0) return say([['Dolores', 'Are those sirens for you, sweetie? Sit with me a minute.'], ['Dolores', 'Nobody arrests a cat in church. Not on my watch.']]);
  const lines = [
    [['Dolores', "I've prayed for this town forty years. The HOA is my one failure."]],
    [['Dolores', 'You live in that RV on the lot? Gary brings you up at every Bible study.'], ['Dolores', 'Every. One.']],
    [['Dolores', 'My grandson says you can do a triple jump. Not in here, dear.']],
    [['Dolores', 'Nana next door makes a casserole on Sundays. Tell her Dolores sent you. She will pretend not to know me.']],
  ];
  say(S.talks.dolores === 1 ? [['Dolores', "Well, hello. Aren't you a serious little fellow. Are you here to pray?"], ['Dolores', 'Come back when you need a blessing, sweetie. I do one a day. Doctor\'s orders.']] : pick(lines));
}
function talkWalt(R) {
  const n = R.npcs.walt; faceCat(n, 8);
  S.talks.walt = (S.talks.walt || 0) + 1;
  if (dailyReady('walt')) {
    markDaily('walt');
    return say([['Walt', 'Hm? Oh, it\'s you. The cat from the lot.'], ['Walt', 'Here. Five dollars. For the plate.'], ['Walt', "Don't you go spending it on catnip."]], () => { W().G.cash += 5; Sfx.pickup(); toast('Walt slipped you $5. (once a day)'); });
  }
  say(pick([
    [['Walt', 'Earl at the bait shop says the trout bite at dawn. Earl lies. But not about trout.']],
    [['Walt', 'Raccoons got into my feed again. Bold as brass. Like they pay rent.']],
    [['Walt', 'I already gave you five dollars today. I\'m a farmer, not a bank.']],
    [['Walt', 'Rosie\'s Diner does a short stack that\'ll put hair on your... well. More hair.']],
  ]));
}
function talkFamily(R) {
  faceCat(R.npcs.tyler, 8); faceCat(R.npcs.brenda, 6);
  S.talks.family = (S.talks.family || 0) + 1;
  if (dailyReady('tyler')) {
    markDaily('tyler');
    return say([['Tyler', 'Are you a real cat? You are SO real.'], ['Tyler', 'Here. Half my granola bar. The good half.'], ['Brenda', 'Tyler, don\'t feed the... oh, he ate it. Okay.']], () => { feed(12); Sfx.pickup(); toast("Tyler's granola bar. +12 belly (once a day)"); sayB(R, 'tyler', 'He LIKES it!'); });
  }
  say(pick([
    [['Tyler', 'Do cats go to heaven?'], ['Brenda', 'Yes.'], ['Tyler', 'Do raccoons?'], ['Brenda', 'Pray, Tyler.']],
    [['Brenda', "Sorry, he's... curious. Tyler, don't touch the kitty's armor."], ['Tyler', 'I wasn\'t!'], ['Tyler', '(he was)']],
    [['Tyler', 'When I grow up I wanna live in an RV like you.'], ['Brenda', 'Over my dead body.'], ['Tyler', 'So, later.']],
  ]));
}
function talkMarcus(R) {
  faceCat(R.npcs.marcus, 8);
  S.talks.marcus = (S.talks.marcus || 0) + 1;
  if ((W().G.heat || 0) > 0) return say([['Marcus', 'You running from somebody too, little dude?'], ['Marcus', 'Stay a while. The cops never check the church. Gary does, though.']]);
  say(pick([
    [['Marcus', 'Hey, little dude. You praying too?'], ['Marcus', '...Yeah. Me neither, really. I just like the quiet.']],
    [['Marcus', 'My ex works at the Quik Stop. Kayla. If you see her, you didn\'t see me.']],
    [['Marcus', 'Fantasy football is a test of faith, man. My kicker is in jail.']],
    [['Marcus', 'Deacon Hollis says I\'m "a work in progress." He says it about the roof, too.']],
  ]));
}

// ================================================================= Rosie's Diner
// layout (rooms.js buildDiner, W 12 x D 8): counter z -2.3 (x -4.45..3.45), stools at z -1.5, back bar z -3.7,
// pass-through at x -0.9 on the back wall, booths at x -5.45 (z -1.8, 0.5) and x 5.45 (z -1.6, 0.9), door at (4.2, 4).
const BOOTH_CAT = { x: -4.35, z: 0.5, tx: -5.3, tz: 0.5 };   // the cat's booth: where Darlene stands, where the plate goes
const DINER_MENU = [
  { id: 'melt', label: 'Tuna melt (the usual)', cash: 8, fish: 4, belly: 45, hp: 20, blurb: 'Rosie adds extra tuna when nobody is looking. +45 belly, +20 health.' },
  { id: 'stack', label: 'Short stack', cash: 6, fish: 3, belly: 35, hp: 10, blurb: 'Three pancakes, one pat of butter the size of your head. +35 belly, +10 health.' },
  { id: 'meatloaf', label: 'Meatloaf plate', cash: 9, fish: 5, belly: 60, hp: 15, blurb: 'Meatloaf Monday, whatever day it is. +60 belly, +15 health.' },
  { id: 'pie', label: 'Slice of pie', cash: 4, fish: 2, belly: 20, hp: 0, blurb: "Today's pie is whatever was in the fridge. +20 belly." },
  { id: 'milk', label: 'Saucer of milk', cash: 1, fish: 1, belly: 10, hp: 5, blurb: 'Rosie keeps a saucer just for you. +10 belly, +5 health.' },
  { id: 'coffee', label: 'Bottomless coffee', cash: 2, fish: 1, belly: 5, hp: 0, coffee: true, blurb: 'You sit and watch the road for an hour. +5 belly, time passes.' },
];
const PLATE_COL = { melt: 0xe8b050, stack: 0xd89040, meatloaf: 0x7a4030, pie: 0xd0a060, milk: 0xf8f8f0, coffee: 0x3a2010 };
const DINER = {
  cast: [
    { id: 'darlene', name: 'Darlene', x: 1.0, z: -3.05, yaw: 0, pose: 'stand', wipe: true, waitress: true, notice: 2.2,
      look: { skin: 0xe8b894, hair: 0xc9a25a, shirt: 0xf08aa8, pants: 0x3a3a48, bun: true, apron: true, shoe: 0xe8e8e8, smile: true },
      ambient: ['Hot pot coming through!', 'Who had the meatloaf? Nobody? Again?', 'Rosie, we\'re out of pie. Rosie. ROSIE.', 'Twenty years on these feet. Twenty-one, Tuesday.'],
      props: (n, fig) => {
        const pot = new THREE.Group();
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 8), new THREE.MeshLambertMaterial({ color: 0x3a2010 }));
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.05, 8), new THREE.MeshLambertMaterial({ color: 0xd04020 })); lid.position.y = 0.1;
        pot.add(glass, lid); pot.rotation.x = -1.1; n.pot = handProp(fig, pot);
        const plate = new THREE.Group();
        plate.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.02, 12), new THREE.MeshLambertMaterial({ color: 0xf4f0e8 })));
        const food = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.12), new THREE.MeshLambertMaterial({ color: 0xe8b050 })); food.position.y = 0.035; plate.add(food);
        plate.rotation.x = -1.1; n.plate = handProp(fig, plate); n.plateFood = food;
      } },
    { id: 'hank', name: 'Hank', x: 2.7, z: -1.5, yaw: Math.PI, pose: 'sit', seat: 0.66, act: 'eat',
      look: { skin: 0xd9a47a, hair: 0x5a3a1a, shirt: 0x8a2a2a, pants: 0x2a3a5a, hat: 0x2a5a2a, shoe: 0x5a3a22 },
      ambient: ['Highway 9\'s closed both ways. I\'m on my fourth pie.', 'Darlene, you are an angel sent from the interstate.', 'Forty tons of lawn gnomes and nowhere to put \'em.'],
      heat: ['(Hank) That siren for you, little buddy? I ain\'t seen nothin\'.'] },
    { id: 'gus', name: 'Gus', x: -3.6, z: -1.5, yaw: Math.PI, pose: 'sit', seat: 0.66, act: 'paper', regular: true,
      look: { skin: 0xf1c9a5, hair: 0xaaaaaa, shirt: 0x7a6a4a, pants: 0x4a4038, wrinkles: true, glasses: true, cardigan: 0x5a5040, shoe: 0x3a2a1a, longSleeve: true },
      ambient: ['Says here the HOA wants to ban cats. Hah. Good luck.', 'Coffee\'s worse than yesterday. Perfect.', 'Crossword. Seven letters, "nuisance." G-A-R-Y... doesn\'t fit.'],
      heat: ['Cops are lookin\' for somebody. Ain\'t seen nothin\'. Never do.'],
      props: (n, fig) => {
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.01), new THREE.MeshLambertMaterial({ color: 0xe8e4d4 }));
        paper.position.set(0, 1.17, 0.42); paper.rotation.x = -0.3; fig.userData.torso.add(paper); n.paper = paper;
      } },
    { id: 'gladys', name: 'Gladys', x: 5.5, z: -2.4, yaw: 0, pose: 'sit', seat: 0.5, act: 'eat',
      look: { skin: 0xf1c9a5, hair: 0xd8d8e0, shirt: 0x5a8ab0, pants: 0x4a4a5a, bun: true, wrinkles: true, glasses: true, shoe: 0x2a2018 },
      ambient: ['Ray. RAY. Use a napkin.', 'Fifty-one years and he still orders the same thing.'] },
    { id: 'ray', name: 'Ray', x: 5.5, z: -0.8, yaw: Math.PI, pose: 'sit', seat: 0.5, act: 'eat',
      look: { skin: 0xf1c9a5, hair: 0xaaaaaa, shirt: 0xc8b890, pants: 0x5a5040, bald: true, wrinkles: true, shoe: 0x3a2a1a },
      ambient: ['I AM using a napkin.', 'Fifty-one years and she still steals my fries.', 'These eggs are perfect. Don\'t tell Rosie.'] },
    { id: 'kayla', name: 'Kayla', x: 5.5, z: 1.7, yaw: Math.PI, pose: 'sit', seat: 0.5, act: 'phone',
      look: { skin: 0xc68e64, hair: 0x7a3b13, shirt: 0x9a5ac0, pants: 0x2a2a3a, shoe: 0xe8e8e8, smile: true },
      ambient: ['omg a cat in a VEST', 'No, Marcus, I am NOT calling you back.', 'posting this. "cat at rosies lol"', 'this milkshake is literally a ten'],
      props: (n, fig) => {
        const ph = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.012), new THREE.MeshBasicMaterial({ color: 0x9ad0ff }));
        const g = handProp(fig, ph, -0.62, 0.05); g.visible = true; g.rotation.x = 0.9;
      } },
    { id: 'jim', name: 'Pastor Jim', x: -5.5, z: -2.6, yaw: 0, pose: 'sit', seat: 0.5, act: 'pancakes',
      look: { skin: 0xd9a47a, hair: 0x5a3a1a, shirt: 0x1a1a22, pants: 0x1a1a22, glasses: true, shoe: 0x111111, longSleeve: true },
      ambient: ['Sunday\'s sermon: love thy neighbor. Even Gary. Still working on the ending.', 'Pancakes are the second-best kind of fellowship.', 'Darlene, could I trouble you for more syrup? And forgiveness?'],
      props: (n, fig) => { const col = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff })); col.position.set(0, 1.5, 0.11); fig.userData.torso.add(col); } },
  ],
  voices: [{ id: 'rosie', name: 'Rosie', x: -0.9, z: -3.85, y: 2.15 }],
  spots: [
    { id: 'diner-hank', x: 2.7, z: -0.75, r: 0.7, label: 'Talk to Hank', use: (R) => talkHank(R) },
    { id: 'diner-gus', x: -3.6, z: -0.75, r: 0.7, label: 'Talk to Gus', use: (R) => talkGus(R) },
    { id: 'diner-couple', x: 4.35, z: -1.6, r: 0.75, label: 'Talk to Gladys and Ray', use: (R) => talkCouple(R) },
    { id: 'diner-kayla', x: 4.35, z: 1.2, r: 0.7, label: 'Talk to Kayla', use: (R) => talkKayla(R) },
    { id: 'diner-jim', x: -4.35, z: -2.0, r: 0.7, label: 'Talk to Pastor Jim', use: (R) => talkJim(R) },
    { id: 'diner-order', x: 3.95, z: -0.55, r: 0.6, label: 'Wave down Darlene', use: (R) => callWaitress(R, true) },
  ],
  convos: [
    [['gladys', 'Ray. RAY. Use a napkin.'], ['ray', 'I AM using a napkin.'], ['gladys', 'That is your sleeve, Ray.']],
    [['hank', 'Darlene, one more slice.'], ['darlene', 'That\'s five, Hank.'], ['hank', 'I\'m a growing boy.']],
    [['kayla', 'omg the cat is HERE'], ['gus', 'Cat\'s been coming in here longer than you, young lady.']],
    [['rosie', 'ORDER UP!'], ['darlene', 'I hear you, Rosie! The whole county hears you!']],
    [['jim', 'Gus, are you coming Sunday?'], ['gus', 'Depends. You still preaching long?'], ['jim', '...Yes.'], ['gus', 'Then no.']],
    [['ray', 'This song again.'], ['gladys', 'It\'s our song, Ray.'], ['ray', '...I know. I love this song.']],
  ],
  think: (R, n, dt) => {
    if (n.def.waitress) waitressThink(R, n, dt);
    else if (n.def.regular) regularThink(R, n, dt);
  },
  react: (R, c, G, dt) => {
    commonReact(R, c, G, {
      punch: ['Hey! Watch the pie!', 'Easy, tiger!', 'Not near the food, kitty!'],
      gun: ['Whoa, easy there, partner.', 'Put that away, hon. This is a family place.'],
    });
    if (c.y > 0.7 && c.z < -1.7 && c.z > -3.0 && cooled(R, 'counter', 10)) { sayB(R, 'darlene', 'Off the counter! Health code, hon!', 'shout'); }
  },
  onEnter: (R) => {
    runScript(R, [['darlene', pick(['Sit anywhere, hon! Booth\'s free on the left.', 'Evening, sugar! Grab the booth, I\'ll be right with you.', 'Well look who it is. Booth on the left is yours.'])]]);
    if (Math.random() < 0.5) R.script.push(['kayla', 'omg a cat']);
  },
  onInteract: (R, spot) => {
    if (spot === 'booth') { callWaitress(R); return true; }          // sitting down at the booth = Darlene comes to take the order
    if (spot === 'counter') { const d = R.npcs.darlene; if (d && d.catD < 6 && cooled(R, 'ctr', 10)) sayB(R, 'rosie', pick(['The usual? Coming up, hon!', 'I see you, cat. One tuna melt.'])); return false; }
    if (spot === 'jukebox') { runScript(R, pick([[['ray', 'This song again.'], ['gladys', 'It\'s our song, Ray.']], [['hank', 'Now THAT\'s trucking music.']], [['kayla', 'what is this, like, 1960']]])); return false; }
    return false;
  },
};

// waitress: a little route planner around the counter, plus a task queue
const LANE_Z = -0.62, GATE = { x: 4.05 };
function routeTo(n, to) {
  const behind = (p) => p.z < -2.6;
  const pts = [];
  if (behind(n) && !behind(to)) pts.push({ x: 3.0, z: -3.05 }, { x: GATE.x, z: -2.75 }, { x: GATE.x, z: LANE_Z });
  else if (!behind(n) && behind(to)) pts.push({ x: n.x, z: LANE_Z }, { x: GATE.x, z: LANE_Z }, { x: GATE.x, z: -2.75 }, { x: 3.0, z: -3.05 });
  else if (!behind(n) && !behind(to)) pts.push({ x: n.x, z: LANE_Z });   // step out to the open lane in front of the stools
  if (!behind(to)) pts.push({ x: to.x, z: LANE_Z });                     // along the lane, then in to the table
  pts.push({ x: to.x, z: to.z });
  n.path = pts.filter((p, i, a) => !i || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 0.05);
}
const SERVE = {   // where Darlene stands to serve each table / stool
  hank: { x: 2.7, z: -3.05, face: Math.PI * 0 }, gus: { x: -3.4, z: -3.05, face: 0 },
  gladys: { x: 4.3, z: -1.6, face: Math.PI / 2 }, ray: { x: 4.3, z: -1.6, face: Math.PI / 2 }, kayla: { x: 4.3, z: 1.0, face: Math.PI / 2 },
  jim: { x: -4.3, z: -2.0, face: -Math.PI / 2 }, cat: { x: BOOTH_CAT.x, z: BOOTH_CAT.z, face: -Math.PI / 2 },
  pass: { x: -0.9, z: -3.05, face: Math.PI }, home: { x: 1.0, z: -3.05, face: 0 },
};
function nextTask(R, n) {
  const ord = S.orders.find((o) => o.st === 'new' || o.st === 'taking');   // 'taking' with no task = she was interrupted
  if (ord) { ord.st = 'taking'; return { kind: 'goto', to: SERVE.cat, then: 'takeOrder', ord }; }
  const ready = S.orders.find((o) => o.st === 'placed' || o.st === 'fetching');
  if (ready) { ready.st = 'fetching'; return { kind: 'goto', to: SERVE.pass, then: 'pickup', ord: ready }; }
  const r = Math.random();
  if (r < 0.4) return { kind: 'wipe', t: 4 + Math.random() * 5, x: -2 + Math.random() * 4 };
  if (r < 0.75) { const who = pick(['hank', 'gus', 'gladys', 'ray', 'kayla', 'jim'].filter((id) => R.npcs[id].present)); return who ? { kind: 'goto', to: SERVE[who], then: 'refill', who } : { kind: 'wipe', t: 3, x: 0 }; }
  return { kind: 'goto', to: SERVE.pass, then: 'ding' };
}
function waitressThink(R, n, dt) {
  if (n.path.length) {   // walking
    const p = n.path[0], dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz);
    if (d < 0.04) { n.path.shift(); if (!n.path.length) arrive(R, n); return; }
    const c = catLocal(R);
    if (blockedBy(n, c, p, d, dt)) { n.pose = 'stand'; if (cooled(R, 'excuseD', 7)) sayB(R, n.id, pick(['Scoot, sugar!', 'Coming through, hon!'])); return; }
    const sp = (n.carry ? 1.5 : 1.85) * dt;
    n.x += dx / d * Math.min(sp, d); n.z += dz / d * Math.min(sp, d);
    n.yaw = Math.atan2(dx, dz); n.pose = 'walk';
    return;
  }
  n.pose = 'stand';
  const T = n.task;
  if (!T) { n.task = nextTask(R, n); if (n.task.kind === 'goto') routeTo(n, n.task.to); else if (n.task.kind === 'wipe') routeTo(n, { x: n.task.x, z: -3.05 }); return; }
  if (T.kind === 'wipe') { n.yaw = 0; if ((T.t -= dt) <= 0) n.task = null; return; }
  if (T.kind === 'wait') { if (T.face !== undefined) n.yaw = T.face; if (T.fn) { const f = T.fn; T.fn = null; f(); } if ((T.t -= dt) <= 0) n.task = T.next || null; return; }
  if (T.kind === 'goto') return;   // arrive() turns it into the next step
}
function arrive(R, n) {
  const T = n.task; if (!T) return;
  if (T.kind !== 'goto') return;
  n.yaw = T.to.face; n.pose = 'stand';
  if (T.then === 'refill') {
    n.pot.visible = true; n.carry = true;
    const reply = { hank: 'Keep it coming, Darlene.', gus: 'Black. Like my soul.', gladys: 'Decaf for him, Darlene. He\'ll never know.', ray: 'Is this decaf? ...It\'s decaf.', kayla: 'um can I get, like, an oat milk? no? ok', jim: 'Bless you, Darlene.' }[T.who];
    n.task = { kind: 'wait', t: 2.8, fn: () => { runScript(R, [['darlene', pick(['More coffee, hon?', 'Top you off, sugar?', 'How we doing over here?'])], [T.who, reply]]); }, next: { kind: 'wait', t: 0.1, fn: () => { n.pot.visible = false; n.carry = false; } } };
  } else if (T.then === 'ding') {
    n.task = { kind: 'wait', t: 1.6, face: Math.PI, fn: () => { if (Math.random() < 0.5) sayB(R, 'rosie', pick(['ORDER UP!', 'Who ordered meatloaf on a Tuesday?', 'Darlene, the pie case!'])); else sayB(R, 'darlene', pick(['Rosie, two eggs over easy!', 'Rosie, hold the onions on table three!'])); Sfx.blip(1320); } };
  } else if (T.then === 'takeOrder') {
    const c = catLocal(R);
    const here = c && (Math.hypot(c.x - BOOTH_CAT.x, c.z - BOOTH_CAT.z) < 2.2 || Math.hypot(c.x - n.x, c.z - n.z) < 2.2);
    if (!here) { T.ord.st = 'gone'; S.orders = S.orders.filter((o) => o !== T.ord); n.task = { kind: 'wait', t: 2, fn: () => sayB(R, 'darlene', 'Hon? ...Cats.') }; return; }
    faceCat(n, 6);
    sayB(R, 'darlene', pick(['What can I get you, sugar?', 'What\'ll it be, hon?', 'The usual? Or are we feeling wild?']));
    T.ord.st = 'menu';
    n.task = { kind: 'wait', t: 1e9 };   // until the menu closes
    openOrderMenu(R, T.ord, () => { n.task = null; });
  } else if (T.then === 'pickup') {
    n.task = { kind: 'wait', t: 1.6, face: Math.PI, fn: () => { sayB(R, 'rosie', 'ORDER UP!', 'shout'); Sfx.blip(1320); } ,
      next: { kind: 'wait', t: 0.2, fn: () => { n.plate.visible = true; n.carry = true; n.plateFood.material.color.setHex(PLATE_COL[T.ord.item.id] || 0xe8b050); n.task = { kind: 'goto', to: SERVE.cat, then: 'deliver', ord: T.ord }; routeTo(n, SERVE.cat); } } };
  } else if (T.then === 'deliver') {
    n.plate.visible = false; n.carry = false;
    serve(R, T.ord, false);
    n.task = { kind: 'wait', t: 2.2, fn: () => sayB(R, 'darlene', pick(['Here ya go, sugar. Eat slow.', 'Careful, plate\'s hot.', 'Enjoy, hon. Holler if you need me.'])) };
  } else n.task = null;
}
// a patron who finishes up, pays, leaves and comes back a while later (Gus)
function regularThink(R, n, dt) {
  n.rt = n.rt ?? { st: 'seated', t: 70 + Math.random() * 60 };
  const T = n.rt, door = { x: 4.2, z: 3.6 }, seat = { x: n.def.x, z: n.def.z };
  if (T.st === 'seated') {
    if ((T.t -= dt) <= 0 && !(n.talking > 0) && !(n.focus > 0)) { T.st = 'leaving'; sayB(R, n.id, pick(['Put it on my tab, Darlene.', 'Keep the change, Darlene.', 'Same time tomorrow.'])); n.path = [{ x: seat.x, z: -0.9 }, door]; n.paper.visible = false; }
    return;
  }
  if (n.path.length) {
    const p = n.path[0], dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz);
    if (d < 0.04) { n.path.shift(); return; }
    const sp = 0.8 * dt; n.x += dx / d * Math.min(sp, d); n.z += dz / d * Math.min(sp, d); n.yaw = Math.atan2(dx, dz); n.pose = 'walk';
    return;
  }
  if (T.st === 'leaving') { T.st = 'gone'; T.t = 50 + Math.random() * 60; n.present = false; n.fig.visible = false; n.bubble.hide(); if (cooled(R, 'bell', 2)) Sfx.door && Sfx.door(); return; }
  if (T.st === 'gone') { if ((T.t -= dt) <= 0) { T.st = 'arriving'; n.present = true; n.fig.visible = true; n.x = door.x; n.z = door.z; n.path = [{ x: seat.x, z: -0.9 }, seat]; Sfx.door && Sfx.door(); runScript(R, [['darlene', `Morning, ${n.def.name}!`], [n.id, 'Coffee. And quiet.']]); } return; }
  if (T.st === 'arriving') { T.st = 'seated'; T.t = 80 + Math.random() * 80; n.pose = 'sit'; n.yaw = n.def.yaw; n.paper.visible = true; }
}

// ---------- ordering at the booth (cash or fish)
function fishPoints() { const F = W().fishing; if (!F || !F.countFish) return 0; let p = 0; for (const id in FISH_VALUE) p += F.countFish(id) * FISH_VALUE[id]; return p; }
function payFish(price) {
  const F = W().fishing, order = Object.keys(FISH_VALUE).sort((a, b) => FISH_VALUE[a] - FISH_VALUE[b]), used = {}; let paid = 0;
  for (const id of order) while (paid < price && F.countFish(id) > 0) { F.removeFish(id, 1); paid += FISH_VALUE[id]; used[id] = (used[id] || 0) + 1; }
  return { paid, used };
}
function callWaitress(R, wave) {
  if (S.orders.some((o) => o.st !== 'done')) { sayB(R, 'darlene', pick(['It\'s coming, hon! Rosie\'s fast, not magic.', 'Hold your horses, sugar.'])); return; }
  const ord = { st: 'new', item: null, pay: null, at: wave ? 'wave' : 'booth' };
  S.orders.push(ord);
  const n = R.npcs.darlene;
  if (wave) {   // she's close: take it right where the cat is
    ord.st = 'taking'; n.path = []; n.task = { kind: 'goto', to: { x: 3.95, z: -1.2, face: 0 }, then: 'takeOrder', ord }; routeTo(n, n.task.to);
  } else {
    // drop whatever she's doing (unless she's mid-delivery)
    if (!n.task || n.task.kind === 'wipe' || (n.task.kind === 'goto' && n.task.then === 'refill') || n.task.kind === 'wait' && !n.task.next) { n.pot.visible = false; n.carry = false; n.task = null; n.path = []; }
  }
  sayB(R, 'darlene', pick(['Be right with you, hon!', 'Coming, sugar!', 'One sec, darlin\'!']));
  toast(wave ? 'Darlene is on her way.' : 'You hop into the booth. Darlene is on her way.', 2.5);
}
function orderItems() {
  const G = W().G, fp = fishPoints();
  return [
    { id: 'pay', label: `Paying with: ${S.pay === 'cash' ? 'CASH' : 'FISH'}`, price: 'switch', blurb: S.pay === 'cash' ? `You have $${G.cash}. Rosie also takes fish (bluegill 1, bass 2, catfish 3, trout 4). You have ${fp} fish worth.` : `You have ${fp} fish worth. Smallest fish go first, no change. Switch back to pay cash ($${G.cash}).` },
    ...DINER_MENU.map((m) => ({ id: m.id, label: m.label, price: S.pay === 'cash' ? '$' + m.cash : '\u{1F41F}x' + m.fish, blurb: m.blurb, dim: S.pay === 'cash' ? G.cash < m.cash : fp < m.fish })),
  ];
}
function openOrderMenu(R, ord, done) {
  const F = W().fishing;
  const finish = () => { clearInterval(watch); if (ord.st === 'menu') { ord.st = 'done'; S.orders = S.orders.filter((o) => o !== ord); sayB(R, 'darlene', pick(['Just browsing? That\'s fine, hon.', 'Holler when you\'re ready.'])); } done(); };
  const ok = F && F.menu({ title: "Rosie's Diner — Darlene's pad", items: orderItems, pick: (it) => {
    if (it.id === 'pay') { S.pay = S.pay === 'cash' ? 'fish' : 'cash'; Sfx.blip(520); return; }
    if (placeOrder(R, ord, it.id, S.pay)) F.closeMenu();
  } });
  if (!ok) { ord.st = 'done'; S.orders = S.orders.filter((o) => o !== ord); done(); return; }
  const watch = setInterval(() => { if (!F.menuOpen()) finish(); }, 150);
}
function placeOrder(R, ord, itemId, pay) {
  const G = W().G, it = DINER_MENU.find((m) => m.id === itemId); if (!it) return false;
  if (pay === 'cash') {
    if (G.cash < it.cash) { Sfx.blip(180); sayB(R, 'darlene', 'Hon, that\'s $' + it.cash + '. You\'ve got $' + G.cash + '. Rosie takes fish, too.'); return false; }
    G.cash -= it.cash; ord.paidText = `$${it.cash}`;
  } else {
    const have = fishPoints();
    if (have < it.fish) { Sfx.blip(180); sayB(R, 'darlene', have ? `That's ${it.fish} fish worth, sugar. You've got ${have}.` : 'No fish, no deal, hon. Dock\'s down the hill.'); return false; }
    const { paid, used } = payFish(it.fish);
    ord.paidText = Object.entries(used).map(([id, k]) => `${k} ${id === 'raccoon' ? 'raccoon meat' : id}`).join(', ') + (paid > it.fish ? ' (no change)' : '');
  }
  Sfx.pickup();
  ord.item = it; ord.pay = pay; ord.st = 'placed'; ord.t = W().G.time;
  S.ordered = (S.ordered || 0) + 1;
  sayB(R, 'darlene', pick(['Coming right up!', `One ${it.label.split(' (')[0].toLowerCase()}, coming up.`, 'Rosie! Order in!']));
  setTimeout(() => sayB(R, 'rosie', pick(['Heard!', 'On it!', 'Fish? Ooh, I can work with fish.'][pay === 'fish' ? 2 : (Math.random() * 2) | 0])), 1500);
  toast(`Ordered ${it.label}. Paid ${ord.paidText}.`, 3);
  return true;
}
// the plate lands on the table and the food does its thing
function serve(R, ord, away) {
  if (!ord || ord.st === 'done') return;
  ord.st = 'done'; S.orders = S.orders.filter((o) => o !== ord);
  const it = ord.item; if (!it) return;
  feed(it.belly); if (it.hp) hpUp(it.hp);
  if (it.coffee) { const G = W().G; G.clock = (G.clock + 1) % 24; }
  if (!away && R.tablePlate) { R.tablePlate.visible = true; R.tableFood.material.color.setHex(PLATE_COL[it.id] || 0xe8b050); R.plateT = 90; }
  Sfx.jingle();
  toast(`${away ? 'Darlene boxed it up for you. ' : ''}${it.label}. +${it.belly} belly${it.hp ? `, +${it.hp} health` : ''}${it.coffee ? ', an hour passes' : ''}.`, 4);
  S.served = (S.served || 0) + 1;
}

function talkHank(R) {
  faceCat(R.npcs.hank, 8);
  if (dailyReady('hank')) { markDaily('hank'); return say([['Hank', 'Hey there, little buddy. You hungry?'], ['Hank', 'Here. Pie crust. The crust is the best part and I will fight anyone who says different.']], () => { feed(10); Sfx.pickup(); toast("Hank's pie crust. +10 belly (once a day)"); }); }
  say(pick([
    [['Hank', 'Hauling forty tons of lawn gnomes to nowhere. Ramp\'s closed.'], ['Hank', 'So I live here now. Darlene says that\'s fine.']],
    [['Hank', 'You see a cop car on 9, you flash your lights twice. Trucker code. Cat code too, now.']],
    [['Hank', 'Fourth slice. Don\'t tell my doctor. Don\'t tell Darlene. Darlene knows.']],
  ]));
}
function talkGus(R) {
  if (!R.npcs.gus.present || R.npcs.gus.rt && R.npcs.gus.rt.st !== 'seated') return toast("Gus's stool is empty. The newspaper is still warm.");
  faceCat(R.npcs.gus, 8);
  say(pick([
    [['Gus', 'Sit, sit. I don\'t talk much.'], ['Gus', '...Okay, I talk a lot. Fifty years at the mill. You know what the mill made?'], ['Gus', 'Neither do I. Nobody ever told me.']],
    [['Gus', 'HOA wants to ban cats, it says here. And flags. And joy.']],
    [['Gus', 'Gary came in here once. Asked for oat milk. Rosie still talks about it.']],
  ]));
}
function talkCouple(R) {
  faceCat(R.npcs.gladys, 8); faceCat(R.npcs.ray, 8);
  say(pick([
    [['Gladys', 'Oh, Ray, look. A kitty.'], ['Ray', 'I see it, Gladys.'], ['Gladys', 'Give it a fry.'], ['Ray', 'Those are MY fries.']],
    [['Ray', 'Fifty-one years we\'ve been coming here.'], ['Gladys', 'Fifty-two.'], ['Ray', 'Fifty-one, Gladys.'], ['Gladys', '(to you) It\'s fifty-two.']],
    [['Gladys', 'You\'re the RV cat. Nana says you\'re a sweetheart.'], ['Ray', 'Nana says that about everybody.'], ['Gladys', 'Not about you, Ray.']],
  ]), () => { if (dailyReady('fries')) { markDaily('fries'); feed(8); Sfx.pickup(); toast('Ray slides you a fry when Gladys isn\'t looking. +8 belly (once a day)'); } });
}
function talkKayla(R) {
  faceCat(R.npcs.kayla, 8);
  say(pick([
    [['Kayla', 'omg can I take a pic?'], ['Kayla', '...you\'re not even looking at the camera. iconic.']],
    [['Kayla', 'my ex is at church right now like that fixes anything. MARCUS.'], ['Kayla', 'anyway. cute vest.']],
    [['Kayla', 'I work the Quik Stop register. if you steal a slurpee I literally do not care.']],
  ]));
}
function talkJim(R) {
  faceCat(R.npcs.jim, 8);
  say(pick([
    [['Pastor Jim', 'Dolores tells me you\'ve been by the church. Good. Bad sermons, good pews.']],
    [['Pastor Jim', 'Love thy neighbor. That\'s the whole sermon this week.'], ['Pastor Jim', 'The hard part is the neighbor is Gary.']],
    [['Pastor Jim', 'The roof fund thermometer has been at "thirty-four dollars" since spring. Tell your friends.']],
  ]));
}

// ================================================================= wiring
const CONFIGS = { church: CHURCH, diner: DINER };
function wrapRoom(id, room) {
  if (!room || room.__townsfolk || typeof room.build !== 'function') return;
  const orig = room.build;
  room.build = function (ctx) {
    const out = orig.call(this, ctx);
    try {
      if (!out || !out.group) return out;
      const R = makeRoomRuntime(id, out, CONFIGS[id]);
      if (id === 'diner') {   // the plate that lands on the cat's booth table
        const p = new THREE.Group(); p.position.set(BOOTH_CAT.tx, 0.785, BOOTH_CAT.tz);
        p.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.02, 12), new THREE.MeshLambertMaterial({ color: 0xf4f0e8 })));
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.12), new THREE.MeshLambertMaterial({ color: 0xe8b050 })); f.position.y = 0.035; p.add(f);
        p.visible = false; out.group.add(p); R.tablePlate = p; R.tableFood = f;
      }
      const prev = out.update;
      out.update = (t) => {
        if (typeof prev === 'function') prev(t);
        try { updateRoom(R, t); if (R.plateT > 0 && (R.plateT -= 0.016) <= 0) R.tablePlate.visible = false; } catch (e) { S.errors.push(String(e)); console.error('[townsfolk] update', e); }
      };
      S.rooms[id] = R;
    } catch (e) { S.errors.push(String(e)); console.error('[townsfolk] build', e); }
    return out;
  };
  room.__townsfolk = true;
}
const ready = import('./rooms.js').then((m) => { for (const id of Object.keys(CONFIGS)) wrapRoom(id, m.ROOMS && m.ROOMS[id]); })
  .catch((e) => { S.errors.push(String(e)); console.error('[townsfolk] rooms.js', e); });

INTR.on('enter', (id) => { const R = S.rooms[id]; if (R && R.cfg.onEnter) { R.lastT = null; try { R.cfg.onEnter(R); } catch (e) { S.errors.push(String(e)); } } });
INTR.on('exit', (id) => {
  const R = S.rooms[id]; if (!R) return;
  for (const n of Object.values(R.npcs)) n.bubble.hide();
  R.script = [];
  if (id === 'diner') {   // walked out mid-order: a pending paid order still counts (to go); an open menu is cancelled
    for (const o of S.orders.slice()) { if (o.item) serve(R, o, true); else { o.st = 'done'; } }
    S.orders = [];
    const n = R.npcs.darlene; if (n) { n.task = null; n.path = []; n.carry = false; n.pot.visible = false; n.plate.visible = false; }
  }
});
INTR.on('interact', (room, spot) => { const R = S.rooms[room]; if (!R || !R.cfg.onInteract) return false; try { return R.cfg.onInteract(R, spot) === true; } catch (e) { S.errors.push(String(e)); return false; } });

window.__TOWN = {
  ready, S,
  get state() {
    const rooms = {};
    for (const [id, R] of Object.entries(S.rooms)) rooms[id] = { npcs: R.list.map((n) => ({ id: n.id, x: +n.x.toFixed(2), z: +n.z.toFixed(2), pose: n.pose, present: n.present, bubble: n.bubble.text, task: n.task ? (n.task.then || n.task.kind) : null })), cols: R.out.cols.length, spots: R.out.interact.map((h) => h.id) };
    return { rooms, orders: S.orders.map((o) => ({ st: o.st, item: o.item && o.item.id, pay: o.pay })), pay: S.pay, served: S.served || 0, ordered: S.ordered || 0, talks: { ...S.talks }, log: S.log.slice(-12), errors: S.errors.slice() };
  },
  say: (room, nid, text) => { const R = S.rooms[room]; return R ? sayB(R, nid, text) : false; },
  order: (itemId, pay = 'cash') => { const R = S.rooms.diner; if (!R) return false; const o = { st: 'menu' }; S.orders.push(o); const ok = placeOrder(R, o, itemId, pay); if (!ok) S.orders = S.orders.filter((x) => x !== o); else { const n = R.npcs.darlene; n.task = null; n.path = []; } return ok; },
  menu: DINER_MENU,
};
