// Fishing survival loop for Maple Grove: Off Leash. Owned by the fishing thread.
// Shop (Earl at the Bait & Tackle) -> cast off the dock -> fight the fish -> cook it at the shore firepit -> eat it to
// fill the BELLY meter. Raw = food poisoning, burnt = charcoal. Downed raccoons can be skinned for meat and a pelt, and
// a pelt stitches into a coonskin cap Goobles wears. Wired into game.js by tools/fishing-hooks.mjs.
// Debug: window.__G.fishing  (.S state, .give(id), .feed(n))
import * as THREE from 'three';
import { mat, lambert, basic } from './gfx.js';
import { animBiped, makeHuman, makeRaccoon } from './models.js';
import { heightAt } from './terrain.js';
import { setText, setStyle, setClass } from './dom.js';

const KEY = 'maple-grove-offleash-fishing-v1';
const LAKE = { x: -35, z: 92, rx: 40, rz: 24 };
const lakeR = (a) => 1 + 0.1 * Math.sin(3 * a + 0.6) + 0.06 * Math.sin(5 * a + 2.1);
const DOCK = { x: -20, z0: 64, z1: 82 };
const SHOP = { earl: { x: -71.4, z: 55.4, yaw: Math.PI }, mark: { x: -73.8, z: 55.2 } };
const FIRE = { x: -28, z: 60.5 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

const GEAR = {
  rod:     { name: 'Fishing Rod',    price: 40, blurb: "Earl's Reliable. Cast off the dock with E." },
  worms:   { name: 'Worms (x6)',     price: 6,  blurb: 'Live bait. One per cast. Everything bites.', stack: 6 },
  lure:    { name: 'Spinner Lure',   price: 30, blurb: 'Reusable. Bass and trout love it, bluegill ignore it.' },
  lighter: { name: 'Lighter',        price: 8,  blurb: 'Lights the shore firepit. Reusable.' },
  pan:     { name: 'Cast-Iron Pan',  price: 20, blurb: 'Wider cooking window. Nothing sticks.' },
  knife:   { name: 'Pocket Knife',   price: 12, blurb: 'Skin a downed raccoon for meat and a pelt.' },
};
// food: belly points, hp: health on eating cooked, sell: $ per fish, w: weight range (lb), night: catfish only bite after dark
const FISH = {
  bluegill: { name: 'Bluegill',        w: [0.2, 0.9],  food: 28, hp: 6,  sell: 6,  pull: 0.45, col: 0x7aa0c8, bite: 0.5 },
  bass:     { name: 'Largemouth Bass', w: [1, 6],      food: 50, hp: 15, sell: 18, pull: 0.8,  col: 0x5a8a4a, bite: 0.26 },
  catfish:  { name: 'Channel Catfish', w: [2, 12],     food: 60, hp: 18, sell: 22, pull: 1.0,  col: 0x6a6a5a, bite: 0.18, night: true },
  trout:    { name: 'Juniper Trout',   w: [1, 3.5],    food: 46, hp: 20, sell: 40, pull: 1.1,  col: 0xd08a7a, bite: 0.06 },
  boot:     { name: 'Old Boot',        w: [1, 1],      food: 0,  hp: 0,  sell: 0,  pull: 0.2,  col: 0x4a3a2a, bite: 0.08, junk: true },
  raccoon:  { name: 'Raccoon Meat',    w: [2, 4],      food: 55, hp: 20, sell: 10, col: 0xb06a5a, meat: true },
};

export function makeFishing(ctx) {
  const { scene, G, P, cat, say, toast, banner, objective, addCash, setCheck, clearCheck, hit, down, isTouch, puff, Sfx, T, mission, peds, knockedOut, $ } = ctx;
  const S = { hunger: 55, sick: 0, gear: {}, bag: [], quest: 'none', hat: false, wearHat: false, bagOpen: null, sel: 0, fish: { st: 'idle' }, cook: null, fire: { lit: false, t: 0 }, skin: null, eat: 0, starveT: 0, regenT: 0, lastObj: '', spawnT: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(S, { hunger: s.hunger ?? 55, sick: s.sick || 0, gear: s.gear || {}, bag: s.bag || [], quest: s.quest || 'none', hat: !!s.hat, wearHat: !!s.wearHat, pelts: s.pelts | 0 }); } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ hunger: S.hunger, sick: S.sick, gear: S.gear, bag: S.bag, quest: S.quest, hat: S.hat, wearHat: S.wearHat, pelts: S.pelts | 0 })); } catch (e) { /* ignore */ } };
  const resetBtn = $('reset'); if (resetBtn) resetBtn.addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } });
  const night = () => G.clock < 6 || G.clock > 20;
  const px = () => (P.car ? P.car.x : P.x), pz = () => (P.car ? P.car.z : P.z);
  const near = (x, z, r) => !P.car && Math.hypot(P.x - x, P.z - z) < r;
  const rawFish = () => S.bag.filter((f) => f.st === 'raw' && !FISH[f.id].junk);

  // ---------- held mouse button (reeling) ----------
  let mouseHeld = false;
  const canvas = $('c');
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) mouseHeld = true; });
  addEventListener('pointerup', () => { mouseHeld = false; });
  const reeling = () => mouseHeld || down('e', 'f', 'enter', 'j', 'k', 'punch');

  // ---------- HUD: belly meter + panel ----------
  const css = document.createElement('style');
  css.textContent = `
#belly { width: 140px; height: 10px; background: #231a08; border: 2px solid #000; position: relative; }
#bellyfill { height: 100%; background: #f0a030; width: 55%; }
#belly.low #bellyfill { background: #ff5a2a; animation: flash 0.6s steps(2) infinite; }
#belly.sick #bellyfill { background: #7fd04a; }
#bellytag { position: absolute; right: 100%; top: -6px; margin-right: 6px; font-size: 18px; color: #f0a030; white-space: nowrap; }
#belly.sick #bellytag { color: #7fd04a; }
@media (max-width: 640px) { #belly { width: 110px; } }
#fishui { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100% - 32px)); background: var(--panel); border: 3px solid #c8c0a0; padding: 10px 14px 12px; display: none; pointer-events: auto; text-shadow: none; font-size: 22px; line-height: 1.1; }
#fishui h3 { margin: 0 0 6px; font-size: 26px; color: var(--gold); font-weight: normal; display: flex; justify-content: space-between; }
#fishui h3 small { font-size: 18px; color: var(--cash); }
#fishui .row { display: flex; justify-content: space-between; gap: 10px; padding: 3px 8px; cursor: pointer; border: 2px solid transparent; }
#fishui .row.sel { border-color: var(--gold); background: rgba(255, 210, 63, 0.12); }
#fishui .row .p { color: var(--cash); white-space: nowrap; }
#fishui .row.dim { opacity: 0.5; }
#fishui .blurb { font-size: 18px; color: #cfc8b0; min-height: 40px; margin-top: 6px; border-top: 1px solid #44506a; padding-top: 6px; }
#fishui .hint { font-size: 16px; color: #9a9480; margin-top: 4px; }
#fishbar { position: absolute; left: 60%; top: 50%; transform: translate(-50%, -50%); display: none; pointer-events: none; text-shadow: none; }
#fishbar .track { position: relative; width: 34px; height: 240px; background: rgba(10, 12, 20, 0.8); border: 3px solid #c8c0a0; }
#fishbar .zone { position: absolute; left: 3px; right: 3px; background: rgba(95, 208, 255, 0.45); border: 2px solid #5fd0ff; }
#fishbar .me { position: absolute; left: 7px; right: 7px; height: 8px; background: var(--gold); border: 2px solid #000; }
#fishbar .prog { position: absolute; left: 44px; bottom: 0; width: 12px; height: 240px; background: #222; border: 3px solid #c8c0a0; }
#fishbar .prog i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--cash); }
#fishbar .lbl { position: absolute; left: 0; top: -34px; width: 200px; text-align: left; font-size: 22px; color: var(--gold); white-space: nowrap; }
#fishbar .sub { position: absolute; left: 0; bottom: -30px; width: 240px; font-size: 18px; color: #cfc8b0; white-space: nowrap; }
#cookbar { position: absolute; left: 50%; top: 66%; transform: translateX(-50%); display: none; pointer-events: none; text-shadow: none; width: 300px; }
#cookbar .track { position: relative; height: 22px; background: rgba(10, 12, 20, 0.8); border: 3px solid #c8c0a0; overflow: hidden; }
#cookbar .zone { position: absolute; top: 0; bottom: 0; background: rgba(127, 224, 127, 0.8); }
#cookbar .burn { position: absolute; top: 0; bottom: 0; right: 0; background: rgba(90, 70, 60, 0.9); }
#cookbar .me { position: absolute; top: -4px; bottom: -4px; width: 6px; background: var(--gold); border: 2px solid #000; }
#cookbar .lbl { text-align: center; font-size: 22px; color: var(--gold); margin-bottom: 4px; }
#bagbtn { position: fixed; right: 16px; bottom: 190px; width: 60px; height: 60px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.5); background: rgba(20,24,40,0.55); color: var(--ink); font-family: inherit; font-size: 16px; display: none; touch-action: none; }
body.touch:not(.titled) #bagbtn.has { display: block; }
#bagbtn.on { background: rgba(255, 210, 63, 0.6); }
`;
  document.head.appendChild(css);
  const tr = $('tr'), hp = $('hp');
  const belly = document.createElement('div'); belly.id = 'belly'; belly.innerHTML = '<div id="bellyfill"></div><span id="bellytag"></span>';
  hp.insertAdjacentElement('afterend', belly);
  const bellyFill = belly.firstChild, bellyTag = belly.lastChild;
  const hud = $('hud');
  const ui = document.createElement('div'); ui.id = 'fishui'; hud.appendChild(ui);
  const bar = document.createElement('div'); bar.id = 'fishbar'; bar.innerHTML = '<div class="track"><div class="zone"></div><div class="me"></div></div><div class="prog"><i></i></div><div class="lbl"></div><div class="sub"></div>'; hud.appendChild(bar);
  const cb = document.createElement('div'); cb.id = 'cookbar'; cb.innerHTML = '<div class="lbl"></div><div class="track"><div class="zone"></div><div class="burn"></div><div class="me"></div></div><div class="lbl" style="font-size:16px;color:#cfc8b0">raw · <span style="color:#7fe07f">cooked</span> · burnt — E to take it off</div>'; hud.appendChild(cb);
  const bagBtn = document.createElement('button'); bagBtn.id = 'bagbtn'; bagBtn.textContent = 'BAG'; document.body.appendChild(bagBtn);
  bagBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (S.bagOpen) closeMenu(); else if (!G.paused && !G.dialog && S.fish.st === 'idle') openMenu('bag'); });
  ui.addEventListener('pointerdown', (e) => { e.stopPropagation(); const r = e.target.closest('.row'); if (!r) return; S.sel = +r.dataset.i; if (r.classList.contains('sel2')) pick(); else { r.parentNode.querySelectorAll('.row').forEach((x) => x.classList.remove('sel', 'sel2')); r.classList.add('sel', 'sel2'); renderBlurb(); } });

  // ---------- Earl + shop sign marker ----------
  const earl = makeHuman({ skin: 0xd9a47a, shirt: 0x6a7a50, pants: 0x3a4a5a, hair: 0xaaaaaa, cap: 0x8a3020, smile: true, wrinkles: true });
  // Earl is an idle NPC ped (game.js peds): traffic brakes for him and the paw bounces off, like Nana
  const earlPed = ctx.spawnPed ? ctx.spawnPed({ mesh: earl, state: 'idle', at: { x: SHOP.earl.x, z: SHOP.earl.z }, yaw: SHOP.earl.yaw, npc: 'earl' }) : null;
  if (!earlPed) { earl.position.set(SHOP.earl.x, 0, SHOP.earl.z); earl.rotation.y = SHOP.earl.yaw; scene.add(earl); }
  const markMat = basic({ color: 0xffd23f, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const mark = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10, 1, true), markMat); mark.position.set(SHOP.mark.x, 1.1, SHOP.mark.z); scene.add(mark);
  const ico = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), basic({ color: 0xffd23f })); ico.position.y = 1.7; mark.add(ico);

  // ---------- firepit on the north shore ----------
  const fireG = new THREE.Group(); fireG.position.set(FIRE.x, 0, FIRE.z); scene.add(fireG);
  const stone = mat(0x7a7570, T.rock || null);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), stone); s.position.set(Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72); s.rotation.set(a, a * 2, 0); s.scale.set(1, 0.7, 1); fireG.add(s); }
  const wood = mat(0x5a3a22);
  for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), wood); l.position.y = 0.16; l.rotation.set(Math.PI / 2 + 0.5, k * 2.09, 0); fireG.add(l); }
  const grate = new THREE.Group(); grate.position.y = 0.48; fireG.add(grate);
  const steel = mat(0x33363a, null, 0, 60);
  for (let k = -3; k <= 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.8), steel); b.position.x = k * 0.12; grate.add(b); }
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.03), steel); b.position.z = s * 0.38; grate.add(b); }
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.48, 4), steel); leg.position.set(s * 0.38, -0.24, 0); grate.add(leg); }
  const flameMat = basic({ color: 0xff9a30, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = []; for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 - k * 0.03, 0.5 - k * 0.1, 5), flameMat.clone()); f.material.color.set([0xff6a20, 0xffb030, 0xffe890][k]); f.position.y = 0.3 + k * 0.08; fireG.add(f); flames.push(f); }
  const fireLight = new THREE.PointLight(0xff8a30, 0, 14, 1.6); fireLight.position.y = 0.9; fireG.add(fireLight);
  const logStool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.4, 7), wood); logStool.position.set(1.5, 0.2, 0.6); fireG.add(logStool);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), basic({ map: T.sign ? T.sign('SHORE FIREPIT', '#f4f0d8', '#2f5d2f', 256, 48) : null, color: T.sign ? 0xffffff : 0xf4f0d8, side: THREE.DoubleSide }));
  sign.position.set(-1.2, 1.1, -0.6); sign.rotation.y = Math.PI - 0.4; fireG.add(sign);
  const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), wood); signPost.position.set(-1.2, 0.55, -0.6); fireG.add(signPost);
  const cookFish = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), lambert({ color: 0xcccccc })); cookFish.scale.set(1, 0.45, 2); cookFish.position.y = 0.55; cookFish.visible = false; fireG.add(cookFish);
  const setFire = (on) => { S.fire.lit = on; for (const f of flames) f.visible = on; fireLight.intensity = on ? 1.6 : 0; };
  setFire(false);

  // ---------- rod, line, bobber, caught fish ----------
  const rod = new THREE.Group(); const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.95, 5), mat(0x3a2a18)); rodMesh.position.y = 0.4; rod.add(rodMesh);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 8), mat(0x8a2020, null, 0, 50)); reel.rotation.z = Math.PI / 2; reel.position.set(0.03, 0.1, 0); rod.add(reel);
  rod.position.set(0, -0.2, 0.03); rod.rotation.x = -0.35; rod.visible = false; cat.userData.arms[1].add(rod);
  const tip = new THREE.Object3D(); tip.position.y = 0.875; rod.add(tip);
  const bobber = new THREE.Group(); const bobT = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(0xff3030)); const bobB = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(0xf4f4f4)); bobB.position.y = -0.06; bobT.position.y = 0.02; bobber.add(bobT, bobB); bobber.visible = false; scene.add(bobber);
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.8 })); line.frustumCulled = false; line.visible = false; scene.add(line);
  const fishMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), lambert({ color: 0x7aa0c8 })); fishMesh.scale.set(0.5, 0.6, 1.6); const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), fishMesh.material); fin.rotation.x = Math.PI / 2; fin.position.z = -0.3; fishMesh.add(fin); fishMesh.visible = false; scene.add(fishMesh);
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();

  // ---------- coonskin cap on Goobles ----------
  const hat = new THREE.Group();
  { const fur = mat(0x6a4a30, T.fur || null), dark = mat(0x2d2d32), light = mat(0xd8d8dc, T.fur || null);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.185, 0.07, 8), fur); band.position.y = 0.27; hat.add(band);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.165, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), fur); dome.position.y = 0.3; dome.scale.set(1.05, 0.4, 1.05); hat.add(dome);
    const tail = new THREE.Group(); tail.position.set(0, 0.26, -0.17); tail.rotation.x = 0.6; hat.add(tail);
    for (let i = 0; i < 5; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.03 - i * 0.003, 0.03 - i * 0.003, 0.06, 6), i % 2 ? dark : light); seg.position.y = -0.03 - i * 0.055; tail.add(seg); }
    hat.visible = false; cat.userData.head.add(hat); }

  // ---------- menus (shop / bag) ----------
  function items(kind) {
    const list = [];
    if (kind === 'custom') { list.push(...S.custom.items()); if (!list.some((it) => it.id === 'close')) list.push({ id: 'close', label: 'Leave', price: '', blurb: '' }); return list; }   // shops.js menus (same look, same keys)
    if (kind === 'shop') {
      for (const [id, g] of Object.entries(GEAR)) { const have = S.gear[id]; const owned = have && !g.stack; list.push({ id: 'buy:' + id, label: g.name + (g.stack && have ? ` (have ${have})` : ''), price: owned ? 'owned' : '$' + g.price, blurb: g.blurb, dim: owned || G.cash < g.price }); }
      for (const f of S.bag) if (!f.hat) { const sp = FISH[f.id]; const pr = sellPrice(f); list.push({ id: 'sell:' + f.uid, label: `Sell ${fishLabel(f)}`, price: pr ? '+$' + pr : '—', blurb: pr ? `Earl pays by the pound. ${f.st === 'cooked' ? 'Cooked sells for less.' : f.st === 'burnt' ? "\"That's charcoal, cat.\"" : ''}` : "Earl: \"I'm not buying that.\"", dim: !pr }); }
      list.push({ id: 'close', label: 'Leave', price: '', blurb: 'Back to the lake.' });
    } else {
      for (const f of S.bag) { const sp = FISH[f.id]; if (sp.junk) { list.push({ id: 'toss:' + f.uid, label: `Toss ${fishLabel(f)}`, price: '', blurb: "It's a boot. Back to the lake with it." }); continue; } list.push({ id: 'eat:' + f.uid, label: `Eat ${fishLabel(f)}`, price: sp.junk ? '' : `+${foodOf(f)} belly`, blurb: sp.junk ? "It's a boot. Don't." : f.st === 'raw' ? 'Raw. Your stomach will have opinions. Cook it at the shore firepit.' : f.st === 'burnt' ? 'Charcoal with fins. Barely counts as food.' : `Cooked just right. +${sp.hp} health too.`, dim: sp.junk }); }
      if (S.pelts) list.push({ id: 'hat', label: `Stitch coonskin cap (${S.pelts} pelt${S.pelts > 1 ? 's' : ''})`, price: '', blurb: 'One pelt, a little thread, zero taste. Wearable.' });
      if (S.hat) list.push({ id: 'wear', label: S.wearHat ? 'Take off coonskin cap' : 'Wear coonskin cap', price: '', blurb: 'The tail hangs down the back. Very frontier.' });
      for (const id of ['rod', 'lure', 'lighter', 'pan', 'knife']) if (S.gear[id]) list.push({ id: 'gear', label: GEAR[id].name, price: '', blurb: GEAR[id].blurb, dim: true });
      if (S.gear.worms) list.push({ id: 'gear', label: `Worms x${S.gear.worms}`, price: '', blurb: GEAR.worms.blurb, dim: true });
      if (!list.length) list.push({ id: 'gear', label: '(empty bag)', price: '', blurb: 'Earl at the Bait & Tackle sells rods and worms.', dim: true });
      list.push({ id: 'close', label: 'Close', price: '', blurb: '' });
    }
    return list;
  }
  let cur = [];
  function openMenu(kind) { S.bagOpen = kind; S.sel = 0; render(); ui.style.display = 'block'; Sfx.blip(520); }
  function closeMenu() { S.bagOpen = null; ui.style.display = 'none'; P.lock = 0.3; }
  function render() {
    cur = items(S.bagOpen); S.sel = clamp(S.sel, 0, cur.length - 1);
    const title = S.bagOpen === 'custom' ? `${S.custom.title} <small>$${G.cash} · belly ${Math.round(S.hunger)}%</small>` : S.bagOpen === 'shop' ? `Bait & Tackle <small>$${G.cash}</small>` : `Goobles' bag <small>belly ${Math.round(S.hunger)}%</small>`;
    ui.innerHTML = `<h3>${title}</h3>` + cur.map((it, i) => `<div class="row${i === S.sel ? ' sel' : ''}${it.dim ? ' dim' : ''}" data-i="${i}"><span>${it.label}</span><span class="p">${it.price}</span></div>`).join('') + `<div class="blurb"></div><div class="hint">${isTouch ? 'Tap to select, tap again to confirm. BAG closes.' : 'W/S choose · E confirm · Q, I or B close'}</div>`;
    renderBlurb();
  }
  function renderBlurb() { const b = ui.querySelector('.blurb'); if (b) b.textContent = (cur[S.sel] || {}).blurb || ''; }
  function pick() {
    const it = cur[S.sel]; if (!it) return;
    if (it.id === 'close') return closeMenu();
    if (S.bagOpen === 'custom') { S.custom.pick(it); if (S.bagOpen) render(); return; }
    if (it.id.startsWith('buy:')) {
      const id = it.id.slice(4), g = GEAR[id];
      if (S.gear[id] && !g.stack) return toast('You already have one.');
      if (G.cash < g.price) { Sfx.blip(180); return toast("Earl: \"Come back with money, cat.\""); }
      addCash(-g.price); S.gear[id] = g.stack ? (S.gear[id] || 0) + g.stack : true; Sfx.pickup(); toast(`Bought ${g.name}.`); save();
      if (S.quest === 'buy' && S.gear.rod && (S.gear.worms || S.gear.lure)) setQuest('fish');
    } else if (it.id.startsWith('sell:')) {
      const f = S.bag.find((x) => x.uid === +it.id.slice(5)); if (!f) return;
      const pr = sellPrice(f); if (!pr) return Sfx.blip(180);
      S.bag.splice(S.bag.indexOf(f), 1); addCash(pr); Sfx.pickup(); toast(`Sold ${fishLabel(f)} for $${pr}.`); save();
    } else if (it.id.startsWith('eat:')) {
      const f = S.bag.find((x) => x.uid === +it.id.slice(4)); if (!f || FISH[f.id].junk) return Sfx.blip(180);
      S.bag.splice(S.bag.indexOf(f), 1); eat(f); closeMenu(); return;
    } else if (it.id.startsWith('toss:')) {
      const f = S.bag.find((x) => x.uid === +it.id.slice(5)); if (!f) return;
      S.bag.splice(S.bag.indexOf(f), 1); Sfx.blip(300); toast('Tossed the boot. Someone else can find it.'); save();
    } else if (it.id === 'hat') { S.pelts--; S.hat = true; S.wearHat = true; Sfx.jingle(); toast('Stitched a coonskin cap. Davy who?'); save(); }
    else if (it.id === 'wear') { S.wearHat = !S.wearHat; Sfx.blip(); save(); }
    else return;
    render();
  }
  const uidOf = () => Math.floor(Math.random() * 1e9);
  const foodOf = (f) => { const sp = FISH[f.id], k = 0.7 + 0.3 * (f.w - sp.w[0]) / Math.max(0.01, sp.w[1] - sp.w[0]); return Math.round(f.st === 'cooked' ? sp.food * k : f.st === 'burnt' ? sp.food * 0.25 : sp.food * 0.35); };
  const sellPrice = (f) => { const sp = FISH[f.id]; if (sp.junk) return 0; const base = Math.round(sp.sell * (0.6 + 0.4 * (f.w - sp.w[0]) / Math.max(0.01, sp.w[1] - sp.w[0]))); return f.st === 'raw' ? base : f.st === 'cooked' ? Math.round(base * 0.6) : 0; };
  const fishLabel = (f) => `${f.st === 'raw' ? '' : f.st + ' '}${FISH[f.id].name}${FISH[f.id].junk ? '' : ` ${f.w.toFixed(1)} lb`}`;
  function give(id, st = 'raw') { const sp = FISH[id]; const f = { uid: uidOf(), id, st, w: +rnd(sp.w[0], sp.w[1]).toFixed(1) }; S.bag.push(f); save(); return f; }

  // ---------- belly ----------
  function feed(n) { S.hunger = clamp(S.hunger + n, 0, 100); save(); }
  const countFish = (id) => S.bag.filter((f) => f.id === id).length;
  function removeFish(id, n = 1) { let k = 0; for (const st of ['raw', 'burnt', 'cooked']) for (let i = S.bag.length - 1; i >= 0 && k < n; i--) if (S.bag[i].id === id && S.bag[i].st === st) { S.bag.splice(i, 1); k++; } save(); return k; }
  /** Open a shop-style menu owned by another module: { title, items() -> [{id,label,price,blurb,dim}], pick(item) }. */
  function menu(spec) { if (S.bagOpen || G.dialog || F.st !== 'idle') return false; S.custom = spec; openMenu('custom'); return true; }
  function eat(f) {
    const sp = FISH[f.id]; S.eat = 1.4; Sfx.pickup();
    if (f.st === 'raw') {
      feed(foodOf(f));
      if (Math.random() < (sp.meat ? 0.9 : 0.7)) { S.sick = Math.max(S.sick, 50); toast(sp.meat ? 'Raw raccoon. Bold. You feel... wrong.' : 'Raw fish. Your stomach files a complaint.', 4); }
      else toast('Raw, slimy, technically food.');
    } else if (f.st === 'burnt') { feed(foodOf(f)); toast('Tastes like a campfire. Barely counts.'); }
    else { feed(foodOf(f)); G.hp = Math.min(100, G.hp + sp.hp); toast(`${sp.name}, cooked right. +${foodOf(f)} belly, +${sp.hp} health.`, 4); if (S.quest === 'eat') finishQuest(); }
    save();
  }
  function updateBelly(dt) {
    const rate = (S.sick > 0 ? 0.45 : 0.11) * dt;    // full to empty in ~15 real minutes
    S.hunger = clamp(S.hunger - rate, 0, 100);
    if (S.sick > 0) { S.sick -= dt; if (Math.random() < dt * 1.2) puff('smoke', P.x + rnd(-0.2, 0.2), 0.5, P.z + rnd(-0.2, 0.2), 0, 0.6, 0, 0.35, 0.8); if ((S.regenT += dt) > 3) { S.regenT = 0; G.hp = Math.max(1, G.hp - 2); } if (S.sick <= 0) toast('You feel better. Cook your food next time.'); }
    else if (S.hunger <= 0) { if ((S.starveT += dt) > 1.5) { S.starveT = 0; G.hp -= 2; if (G.hp <= 0) { G.hp = 0; knockedOut(); S.hunger = 30; } } if (Math.random() < dt / 20) toast("You're starving. Fish, or find a tuna can.", 4); }
    else if (S.hunger >= 70 && G.hp < 100) { if ((S.regenT += dt) > 2) { S.regenT = 0; G.hp = Math.min(100, G.hp + 1); } }
    if (S.hunger < 20 && S.hunger + rate >= 20) toast('Stomach growling. Belly is low.');
    if (Math.random() < dt / 8) save();
    setStyle(bellyFill, 'width', Math.round(S.hunger) + '%');
    setClass(belly, 'low', S.hunger < 20 && S.sick <= 0); setClass(belly, 'sick', S.sick > 0);
    setText(bellyTag, S.sick > 0 ? 'SICK' : S.hunger <= 0 ? 'STARVING' : S.hunger < 20 ? 'HUNGRY' : 'BELLY');
  }

  // ---------- quest "Catch of the Day" ----------
  const QUEST = {
    buy:  { obj: 'Buy a fishing rod and some worms from Earl.', at: SHOP.mark, label: 'Bait & Tackle' },
    fish: { obj: 'Walk out on the dock and catch a fish (E to cast, hold E to reel).', at: { x: DOCK.x, z: DOCK.z1 - 1.5 }, label: 'Dock' },
    cook: { obj: 'Cook your catch at the shore firepit. Light it first (Earl sells lighters).', at: FIRE, label: 'Firepit' },
    eat:  { obj: 'Eat the cooked fish from your bag (I, or BAG).', at: null },
  };
  function setQuest(st) { S.quest = st; S.lastObj = ''; save(); if (st === 'fish') toast('Earl: "Dock\'s that way. Worm goes on the pointy end."', 4); }
  function finishQuest() { S.quest = 'done'; S.lastObj = ''; addCash(75); banner('CATCH OF THE DAY', 'Fed, watered, and $75 richer. +$75', 4, 'pass'); Sfx.jingle(); objective(''); clearCheck(); save(); }
  function questHud() {
    const q = QUEST[S.quest]; if (!q || mission()) return;
    const far = !q.at || Math.hypot(px() - q.at.x, pz() - q.at.z) > 6;   // the beacon switches off once you're there
    const key = S.quest + (far ? '' : '!');
    if ($('objective').textContent !== q.obj || S.lastObj !== key) { S.lastObj = key; objective(q.obj); if (q.at && far) setCheck(q.at.x, q.at.z, 2.5, q.label); else clearCheck(); }
  }
  function talkEarl() {
    if (S.quest === 'none') return say([['Earl', 'Afternoon, cat. Or whatever. You look like you live on tuna cans.'], ['Earl', "Lake Juniper's full of fish nobody catches. Buy a rod, drown some worms off the dock."], ['Earl', 'Cook what you catch at my firepit on the shore. Raw fish will put you flat on your back.'], ['Earl', "Eat a proper meal and I'll pay you for the story. Shop's open."]], () => { setQuest('buy'); openMenu('shop'); });
    if (S.quest === 'done') return say([['Earl', Math.random() < 0.5 ? "Catfish only bite after dark. Don't ask how I know." : 'Downed raccoon makes a fine stew and a finer hat. Need a knife though.']], () => openMenu('shop'));
    openMenu('shop');
  }

  // ---------- fishing ----------
  const F = S.fish;
  function waterSpot() {
    // on the dock, or within 3.5 m of the shoreline: returns where the bobber lands
    const dx = (P.x - LAKE.x) / LAKE.rx, dz = (P.z - LAKE.z) / LAKE.rz, a = Math.atan2(dz, dx), r = Math.hypot(dx, dz), sr = lakeR(a) * 0.97;
    const onDock = Math.abs(P.x - DOCK.x) < 1.4 && P.z > DOCK.z0 + 4 && P.z < DOCK.z1 + 0.3;
    if (onDock) return { x: P.x + Math.sin(P.yaw) * 4, z: Math.max(P.z + 2, P.z + Math.cos(P.yaw) * 4), deep: 1 };
    if (r >= sr && (r - sr) * Math.min(LAKE.rx, LAKE.rz) < 3.5) { const tx = LAKE.x + Math.cos(a) * LAKE.rx * (sr - 0.12), tz = LAKE.z + Math.sin(a) * LAKE.rz * (sr - 0.12); return { x: tx, z: tz, deep: 0.5 }; }
    return null;
  }
  function pickSpecies(deep) {
    const lure = !S.gear.worms && S.gear.lure;
    const pool = Object.entries(FISH).filter(([id, s]) => !s.meat && (!s.night || night()) && !(lure && id === 'bluegill'));
    const wts = pool.map(([id, s]) => s.bite * (lure && (id === 'bass' || id === 'trout') ? 1.8 : 1) * (id === 'boot' ? (deep > 0.7 ? 0.5 : 1.5) : 1) * (deep > 0.7 || id !== 'catfish' ? 1 : 0.3));
    let r = Math.random() * wts.reduce((a, b) => a + b, 0); for (let i = 0; i < pool.length; i++) { r -= wts[i]; if (r <= 0) return pool[i][0]; }
    return 'bluegill';
  }
  function startCast(spot) {
    const useWorm = S.gear.worms > 0;
    if (!useWorm && !S.gear.lure) return toast("No bait. Earl sells worms and lures.");
    F.st = 'cast'; F.t = 0; F.spot = spot; F.worm = useWorm; F.anchor = { x: P.x, z: P.z };
    P.yaw = Math.atan2(spot.x - P.x, spot.z - P.z); P.vx = P.vz = 0;
    rod.visible = true; Sfx.swing();
  }
  function endFishing(msg) { F.st = 'idle'; rod.visible = false; bobber.visible = false; line.visible = false; bar.style.display = 'none'; if (msg) toast(msg, 3.5); P.lock = 0.4; }
  function updateFishing(dt) {
    F.t += dt;
    const u = cat.userData;
    animBiped(cat, 0, 0, G.time);
    u.arms[1].rotation.x = -1.25; u.arms[1].rotation.z = 0.15; u.arms[0].rotation.x = -0.6;
    if (F.st === 'cast') {
      const k = Math.min(1, F.t / 0.7); rod.rotation.x = -0.35 - Math.sin(k * Math.PI) * 1.4;
      if (k >= 1) { F.st = 'wait'; F.t = 0; F.wait = rnd(3, 9) / (S.gear.lure && !F.worm ? 1 : 1); F.nib = rnd(1, 3); bobber.visible = true; bobber.position.set(F.spot.x, 0.05, F.spot.z); line.visible = true; puff('foam', F.spot.x, 0.1, F.spot.z, 0, 0.6, 0, 0.5, 0.6); Sfx.blip(240); if (F.worm) { S.gear.worms--; save(); } }
    } else if (F.st === 'wait') {
      rod.rotation.x = -0.35;
      bobber.position.y = 0.05 + Math.sin(G.time * 2.1) * 0.02;
      if ((F.nib -= dt) < 0) { F.nib = rnd(1.5, 4); bobber.position.y = -0.04; Sfx.blip(300); }
      if (F.t > F.wait) { F.st = 'bite'; F.t = 0; F.species = pickSpecies(F.spot.deep); Sfx.blip(880); Sfx.blip(660); }
    } else if (F.st === 'bite') {
      bobber.position.y = -0.12 + Math.sin(F.t * 18) * 0.05;
      if (Math.random() < dt * 6) puff('foam', F.spot.x + rnd(-0.3, 0.3), 0.05, F.spot.z + rnd(-0.3, 0.3), 0, 0.8, 0, 0.3, 0.4);
      if (hit('e', 'f', 'enter', 'punch', 'j')) { const sp = FISH[F.species]; F.st = 'fight'; F.t = 0; F.me = 0.5; F.vel = 0; F.zone = 0.5; F.zt = 0.5; F.zh = sp.junk ? 0.5 : 0.22; F.prog = 0.35; Sfx.punch(); bar.style.display = 'block'; bar.querySelector('.lbl').textContent = sp.junk ? 'Something heavy...' : 'Fish on!'; bar.querySelector('.sub').textContent = isTouch ? 'Hold USE to lift, release to drop' : 'Hold E or click to lift the line'; }
      else if (F.t > 1.4) endFishing(F.worm ? 'It took your worm and left.' : 'Missed it. The lure comes back empty.');
    } else if (F.st === 'fight') {
      const sp = FISH[F.species], pull = sp.pull;
      // Stardew-style: hold to lift your marker, fish zone drifts; overlap fills the catch bar
      F.vel += (reeling() ? 2.6 : -2.2) * dt; F.vel *= 1 - 2 * dt; F.me = clamp(F.me + F.vel * dt, 0, 1); if (F.me === 0 || F.me === 1) F.vel *= -0.3;
      if (Math.random() < dt * (0.6 + pull * 0.8)) F.zt = Math.random();
      F.zone += (F.zt - F.zone) * Math.min(1, dt * (0.9 + pull * 1.6));
      const half = F.zh / 2, inZone = F.me > F.zone - half - 0.02 && F.me < F.zone + half + 0.02;
      F.prog = clamp(F.prog + (inZone ? 0.3 : -0.18 - pull * 0.1) * dt, 0, 1);
      rod.rotation.x = -0.35 - 0.9 - Math.sin(G.time * 14) * 0.08 * pull;
      bobber.position.x = F.spot.x + Math.sin(G.time * 3) * 0.6 * pull; bobber.position.z = F.spot.z + Math.cos(G.time * 2.3) * 0.4 * pull; bobber.position.y = -0.1;
      if (Math.random() < dt * 10) puff('foam', bobber.position.x + rnd(-0.3, 0.3), 0.05, bobber.position.z + rnd(-0.3, 0.3), 0, 1, 0, 0.3, 0.4);
      const zEl = bar.querySelector('.zone'), meEl = bar.querySelector('.me'), pEl = bar.querySelector('.prog i');
      zEl.style.bottom = ((F.zone - half) * 100).toFixed(1) + '%'; zEl.style.height = (F.zh * 100).toFixed(1) + '%';
      meEl.style.bottom = `calc(${(F.me * 100).toFixed(1)}% - 4px)`; pEl.style.height = (F.prog * 100).toFixed(1) + '%'; pEl.style.background = inZone ? '#7fe07f' : '#e0464e';
      if (F.prog >= 1) land(); else if (F.prog <= 0) endFishing(sp.junk ? 'The line snapped on something heavy.' : `The ${sp.name.toLowerCase()} got away${F.worm ? ' with your worm' : ''}.`);
    } else if (F.st === 'land') {
      const k = Math.min(1, F.t / 1.3);
      fishMesh.position.set(F.spot.x + (F.anchor.x - F.spot.x) * k, 0.2 + Math.sin(k * Math.PI) * 2.2, F.spot.z + (F.anchor.z - F.spot.z) * k);
      fishMesh.rotation.z = G.time * 6; fishMesh.rotation.y = Math.atan2(F.anchor.x - F.spot.x, F.anchor.z - F.spot.z);
      if (k >= 1) { fishMesh.visible = false; endFishing(); }
    }
    // the line from rod tip to bobber
    if (line.visible) { tip.getWorldPosition(_v); bobber.getWorldPosition(_w); line.position.set(bobber.position.x, 0, bobber.position.z); const a = lineGeo.attributes.position; a.setXYZ(0, _v.x - line.position.x, _v.y - heightAt(P.x, P.z), _v.z - line.position.z); a.setXYZ(1, 0, bobber.position.y, 0); a.needsUpdate = true; }
    // stay planted while fishing
    P.x = F.anchor.x; P.z = F.anchor.z; P.vx = P.vz = 0;
  }
  function land() {
    const sp = FISH[F.species], f = give(F.species);
    F.st = 'land'; F.t = 0; bar.style.display = 'none'; bobber.visible = false; line.visible = false;
    fishMesh.visible = true; fishMesh.material.color.set(sp.col); fishMesh.scale.set(0.5, 0.6, 1.6).multiplyScalar(sp.junk ? 0.9 : 0.7 + 0.5 * (f.w - sp.w[0]) / (sp.w[1] - sp.w[0]));
    Sfx.jingle(); banner(sp.junk ? 'OLD BOOT' : sp.name.toUpperCase(), sp.junk ? 'Someone is missing a loafer.' : `${f.w.toFixed(1)} lb · in the bag`, 2.6, 'pass');
    if (S.quest === 'fish' && !sp.junk) setQuest('cook');
  }

  // ---------- cooking ----------
  function startCook(f) {
    S.cook = { f, d: 0 }; S.bag.splice(S.bag.indexOf(f), 1); cookFish.visible = true; cookFish.material.color.set(FISH[f.id].col); cb.style.display = 'block'; cb.querySelector('.lbl').textContent = `Cooking ${FISH[f.id].name}`;
    const win = S.gear.pan ? [1, 2.0] : [1, 1.55]; S.cook.win = win; const max = 2.6;
    cb.querySelector('.zone').style.left = (win[0] / max * 100) + '%'; cb.querySelector('.zone').style.width = ((win[1] - win[0]) / max * 100) + '%'; cb.querySelector('.burn').style.width = ((max - win[1]) / max * 100) + '%';
    P.lock = 0.3;
  }
  function takeOff() {
    const c = S.cook, [a, b] = c.win; const st = c.d < a ? 'raw' : c.d <= b ? 'cooked' : 'burnt';
    c.f.st = st; S.bag.push(c.f); S.cook = null; cookFish.visible = false; cb.style.display = 'none'; save(); Sfx.pickup();
    toast(st === 'raw' ? 'Still raw in the middle.' : st === 'cooked' ? `${FISH[c.f.id].name}: cooked just right. Eat it from your bag.` : 'Burnt to a crisp. Earl warned you.', 3.5);
    if (st === 'cooked' && S.quest === 'cook') setQuest('eat');
    P.lock = 0.3;
  }
  function updateFire(dt) {
    if (S.fire.lit) {
      S.fire.t -= dt; if (S.fire.t <= 0) { setFire(false); toast('The fire burned out.'); if (S.cook) takeOff(); }
      for (let k = 0; k < flames.length; k++) { const f = flames[k]; f.scale.set(1 + Math.sin(G.time * 11 + k) * 0.15, 1 + Math.sin(G.time * 17 + k * 2) * 0.25, 1); f.position.x = Math.sin(G.time * 7 + k) * 0.04; }
      fireLight.intensity = 1.4 + Math.sin(G.time * 13) * 0.3 + Math.random() * 0.2;
      if (Math.random() < dt * 4) puff('fire', FIRE.x + rnd(-0.12, 0.12), 0.55, FIRE.z + rnd(-0.12, 0.12), 0, 0.5, 0, 0.3, 0.5);
      if (Math.random() < dt * 1.2) puff('smoke', FIRE.x, 0.9, FIRE.z, 0, 0.7, 0, 0.4, 1.8);
    }
    if (S.cook) {
      const c = S.cook; c.d += dt * 0.19; const [a, b] = c.win;
      const col = c.d < a ? new THREE.Color(FISH[c.f.id].col).lerp(new THREE.Color(0xd8a050), c.d / a) : c.d <= b ? new THREE.Color(0xd8a050).lerp(new THREE.Color(0x8a5a20), (c.d - a) / (b - a)) : new THREE.Color(0x8a5a20).lerp(new THREE.Color(0x151210), Math.min(1, (c.d - b) / 0.8));
      cookFish.material.color.copy(col); cookFish.position.y = 0.55 + Math.sin(G.time * 20) * 0.005;
      if (Math.random() < dt * 3) puff(c.d > b ? 'smoke' : 'foam', FIRE.x + rnd(-0.1, 0.1), 0.7, FIRE.z + rnd(-0.1, 0.1), 0, 0.8, 0, 0.2, 0.5);
      if (Math.random() < dt * 2) Sfx.swing();
      cb.querySelector('.me').style.left = `calc(${Math.min(100, c.d / 2.6 * 100).toFixed(1)}% - 3px)`;
      if (c.d > 2.6) { c.d = 2.6; takeOff(); toast('It fell through the grate as ash. Gone.', 3.5); S.bag.pop(); save(); }
    }
  }

  // ---------- raccoons: skin a downed one ----------
  function downedRaccoon() { for (const p of peds) if (p.kind === 'raccoon' && p.state === 'down' && !p.npc && Math.hypot(p.x - P.x, p.z - P.z) < 1.7) return p; return null; }
  function updateSkin(dt) {
    const k = S.skin; k.t += dt;
    const u = cat.userData; animBiped(cat, 0, 0, G.time); u.body.rotation.x = 0.5; u.arms[0].rotation.x = u.arms[1].rotation.x = -1.3 + Math.sin(k.t * 14) * 0.3;
    P.x = k.anchor.x; P.z = k.anchor.z; P.vx = P.vz = 0;
    if (k.p.state !== 'down') { k.p = null; }
    if (Math.random() < dt * 8) puff('foam', k.x + rnd(-0.4, 0.4), 0.4 + rnd(0, 0.4), k.z + rnd(-0.4, 0.4), rnd(-0.5, 0.5), 1.2, rnd(-0.5, 0.5), 0.3, 0.5);
    if (k.t > 1.6) {
      u.body.rotation.x = 0;
      if (k.p) { scene.remove(k.p.mesh); peds.splice(peds.indexOf(k.p), 1); S.spawnT = 50; }
      give('raccoon'); S.pelts = (S.pelts || 0) + 1; save(); Sfx.jingle();
      toast('Skinned the raccoon: Raccoon Meat + 1 pelt. Cook the meat at the firepit.', 4);
      S.skin = null; P.lock = 0.4;
    }
  }
  function respawnRaccoon(dt) {
    if (S.spawnT <= 0) return; S.spawnT -= dt; if (S.spawnT > 0) return;
    const h = ctx.places.raccoonHome; if (!h || !ctx.spawnPed) return;
    const p = ctx.spawnPed({ mesh: makeRaccoon(), kind: 'raccoon', state: 'wander', at: { x: h.x + rnd(-0.5, 0.5) * h.r, z: h.z + rnd(-0.5, 0.5) * h.r }, r: 0.3 }); p.speed = 1.5; p.home = h;
  }

  // ---------- what E does right now ----------
  function action() {
    if (P.car || G.dialog || G.paused) return null;
    const rc = downedRaccoon(); if (rc) return S.gear.knife ? { p: 'E: Skin raccoon', f: () => { S.skin = { p: rc, t: 0, x: rc.x, z: rc.z, anchor: { x: P.x, z: P.z } }; P.yaw = Math.atan2(rc.x - P.x, rc.z - P.z); Sfx.swing(); } } : { p: 'Downed raccoon (needs a knife)', f: () => toast('You need a knife to skin it. Earl sells one.') };
    if (S.cook && near(FIRE.x, FIRE.z, 2.2)) return { p: 'E: Take off the fire', f: takeOff };
    if (near(FIRE.x, FIRE.z, 2.2)) {
      if (!S.fire.lit) return S.gear.lighter ? { p: 'E: Light the fire', f: () => { setFire(true); S.fire.t = 240; Sfx.blip(500); toast('Fire lit. Good for a few minutes.'); } } : { p: 'Firepit (needs a lighter)', f: () => toast('Cold firepit. Earl sells lighters at the Bait & Tackle.') };
      const raw = rawFish(); if (raw.length) return { p: `E: Cook ${FISH[raw[0].id].name}`, f: () => startCook(raw[0]) };
      return { p: 'Firepit (nothing raw to cook)', f: () => toast('Catch something first.') };
    }
    if (near(SHOP.earl.x, SHOP.earl.z, 3.4) || near(SHOP.mark.x, SHOP.mark.z, 2.2)) return { p: 'E: Talk to Earl', f: talkEarl };
    if (S.gear.rod) { const spot = waterSpot(); if (spot) return { p: `E: Cast${S.gear.worms ? ` (${S.gear.worms} worms)` : S.gear.lure ? ' (lure)' : ' (no bait)'}`, f: () => startCast(spot) }; }
    return null;
  }

  return {
    S, give, feed, menu, closeMenu, countFish, removeFish, FISH,
    // true while the player is busy (fishing, skinning, eating, menu open): game.js skips its own movement code
    hold(dt) {
      if (S.bagOpen) { animBiped(cat, 0, 0, G.time); return true; }
      if (S.skin) { updateSkin(dt); return true; }
      if (S.eat > 0) { S.eat -= dt; animBiped(cat, 0, 0, G.time); cat.userData.head.rotation.x = Math.sin(S.eat * 20) * 0.15; if (Math.random() < dt * 6) puff('foam', P.x + Math.sin(P.yaw) * 0.25, 0.45, P.z + Math.cos(P.yaw) * 0.25, 0, 0.3, 0, 0.15, 0.4); if (S.eat <= 0) cat.userData.head.rotation.x = 0; return true; }
      if (F.st !== 'idle') { updateFishing(dt); return true; }
      return false;
    },
    interact() {
      if (P.lock > 0) return false;
      if (F.st !== 'idle' || S.skin || S.eat > 0) return true;
      const a = action(); if (!a) return false; a.f(); return true;
    },
    prompt() { if (S.bagOpen) return ''; if (F.st === 'bite') return 'E! HOOK IT!'; if (F.st !== 'idle' || S.skin) return ''; const a = action(); return a ? a.p : ''; },
    menuOpen() { return !!S.bagOpen; },
    // drop whatever the cat was doing (a respawn, an arrest): cast, fight, landing, cooking, skinning, eating, menus
    abort() {
      if (F.st !== 'idle') { endFishing(); fishMesh.visible = false; }
      if (S.cook) { const c = S.cook; c.f.st = c.d < c.win[0] ? 'raw' : c.d <= c.win[1] ? 'cooked' : 'burnt'; S.bag.push(c.f); S.cook = null; cookFish.visible = false; cb.style.display = 'none'; save(); }
      if (S.skin) { S.skin = null; cat.userData.body.rotation.x = 0; }
      if (S.eat > 0) { S.eat = 0; cat.userData.head.rotation.x = 0; }
      if (S.bagOpen) closeMenu();
      rod.visible = false; bobber.visible = false; line.visible = false; bar.style.display = 'none';
    },
    menuInput() {
      if (hit('q', 'i', 'b', 'escape')) return closeMenu();
      if (hit('w', 'arrowup')) { S.sel = (S.sel - 1 + cur.length) % cur.length; render(); Sfx.blip(440); }
      if (hit('s', 'arrowdown')) { S.sel = (S.sel + 1) % cur.length; render(); Sfx.blip(440); }
      if (hit('e', 'f', 'enter', 'punch', ' ')) pick();
    },
    update(dt) {
      if (G.paused) return;
      if (!S.bagOpen && !G.dialog && F.st === 'idle' && !S.skin && hit('i', 'b') && !P.car) openMenu('bag');
      updateBelly(dt); updateFire(dt); respawnRaccoon(dt); questHud();
      hat.visible = S.hat && S.wearHat;
      setClass(bagBtn, 'has', !!(S.gear.rod || S.bag.length || S.hat));
      ico.rotation.y += dt * 2; ico.position.y = 1.7 + Math.sin(G.time * 3) * 0.15; mark.visible = S.quest !== 'done' || Math.random() < 2;
      // Earl idles and faces you when you're close
      const d = Math.hypot(P.x - SHOP.earl.x, P.z - SHOP.earl.z);
      if (earlPed) { /* game.js updatePed turns and animates him */ } else if (d < 8 && !P.car) { const want = Math.atan2(P.x - SHOP.earl.x, P.z - SHOP.earl.z); earl.rotation.y += Math.atan2(Math.sin(want - earl.rotation.y), Math.cos(want - earl.rotation.y)) * Math.min(1, dt * 3); }
      if (!earlPed) animBiped(earl, 0, 0, G.time);
      if (F.st !== 'idle' && P.car) endFishing();
    },
  };
}
