// Maple Grove PD: cruisers that respond to heat, officers on foot who get out, chase, cuff or shoot it out,
// an escalation ladder driven by how many cruisers are on the case, civilians who fight back, NPC HP bars,
// a pistol the cat can take off a downed officer, the busted cutscene and the hand-off to the jail / jailbreak quest.
// Owned by the police thread. Wired into game.js by tools/police-hooks.mjs (makePolice(api) near the end of game.js).
import * as THREE from 'three';
import { makeOfficer, makePawGun, makeCuffs } from './officer.js';
import { animBiped } from './models.js';
import { NODES } from './world.js';
import { setText, setHTML, setStyle } from './dom.js';

// ---------------- sound (own tiny WebAudio graph: gunshots, cuffs, radio) ----------------
let ac = null, out = null;
function au() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = 0.45; out.connect(ac.destination); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
addEventListener('pointerdown', au); addEventListener('keydown', au);
function noiseBuf(dur) { const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5); return b; }
function snd(fn) { if (!ac || ac.state !== 'running' || window.__pdMute) return; try { fn(ac.currentTime); } catch (e) { /* ignore */ } }
const SND = {
  bang(vol = 1, lp = 5000) {
    snd((t) => {
      const s = ac.createBufferSource(); s.buffer = noiseBuf(0.22); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; const g = ac.createGain(); g.gain.value = 0.5 * vol;
      s.connect(f); f.connect(g); g.connect(out); s.start(t);
      const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      og.gain.setValueAtTime(0.5 * vol, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.2);
    });
  },
  tick(f = 2400, n = 1, gap = 0.05, vol = 0.08) {
    snd((t) => { for (let i = 0; i < n; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = f * (1 + (i % 2) * 0.15); g.gain.setValueAtTime(vol, t + i * gap); g.gain.exponentialRampToValueAtTime(0.001, t + i * gap + 0.03); o.connect(g); g.connect(out); o.start(t + i * gap); o.stop(t + i * gap + 0.04); } });
  },
  radio() {
    snd((t) => {
      for (let i = 0; i < 5; i++) {
        const s = ac.createBufferSource(); s.buffer = noiseBuf(0.09); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400 + Math.random() * 900; f.Q.value = 3;
        const g = ac.createGain(); g.gain.value = 0.25; s.connect(f); f.connect(g); g.connect(out); s.start(t + i * 0.11);
      }
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 1800; g.gain.setValueAtTime(0.05, t + 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + 0.75); o.connect(g); g.connect(out); o.start(t + 0.6); o.stop(t + 0.8);
    });
  },
};

// ---------------- jail cell room (interiors room contract, see engine thread) ----------------
/** Maple Grove PD holding area. Local origin = room centre on the floor, +z toward the entrance. */
export const JAIL_ROOM = {
  name: 'Maple Grove PD - Holding',
  build(ctx) {
    const T = (ctx && ctx.T) || {};
    const g = new THREE.Group();
    const L = (c, map) => new THREE.MeshLambertMaterial({ color: c, map: map || null });
    const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
    const RW = 10, RD = 8, RH = 3.2;
    const wallLo = L(0x5a6e60), wallHi = L(0xd8d2b8), floorM = L(0x8a8478), ceilM = L(0xe0ddd0), barM = L(0x3a3c42), wood = L(0x7a5434, T.wood);
    box(RW, 0.1, RD, floorM, 0, -0.05, 0);
    box(RW, 0.1, RD, ceilM, 0, RH + 0.05, 0);
    for (const [w, d, x, z] of [[RW, 0.2, 0, -RD / 2], [RW, 0.2, 0, RD / 2], [0.2, RD, -RW / 2, 0], [0.2, RD, RW / 2, 0]]) {
      box(w, 1.2, d, wallLo, x, 0.6, z); box(w, RH - 1.2, d, wallHi, x, 1.2 + (RH - 1.2) / 2, z);
    }
    // the cell: back-left corner, x -5..-1, z -4..0, bars on the open sides
    const bars = (x0, z0, x1, z1) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.16); for (let i = 0; i <= n; i++) box(0.04, RH, 0.04, barM, x0 + (x1 - x0) * i / n, RH / 2, z0 + (z1 - z0) * i / n); box(Math.abs(x1 - x0) + 0.06, 0.08, Math.abs(z1 - z0) + 0.06, barM, (x0 + x1) / 2, 1.2, (z0 + z1) / 2); };
    bars(-1, -4, -1, 0); bars(-5, 0, -3.1, 0); bars(-1.9, 0, -1, 0);
    const cellDoor = new THREE.Group(); g.add(cellDoor);
    for (let i = 0; i <= 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, RH - 0.1, 0.04), barM); b.position.set(-3.05 + i * 0.16, RH / 2 - 0.05, 0); cellDoor.add(b); }
    for (const y of [0.3, 1.2, 2.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.07, 0.07), barM); b.position.set(-2.5, y, 0); cellDoor.add(b); }
    const lockBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.1), L(0x8a8a90)); lockBox.position.set(-1.98, 1.1, 0.04); cellDoor.add(lockBox);
    box(3.6, 0.45, 0.6, wood, -3, 0.225, -3.6);                         // bench
    box(0.45, 0.4, 0.5, L(0xe8e8e8), -4.6, 0.2, -1.6); box(0.5, 0.06, 0.55, L(0xd0d0d0), -4.6, 0.43, -1.6);  // toilet
    box(0.9, 0.5, 0.06, L(0x7aa0d8), -3, 2.5, -3.93);                   // high window
    for (let i = 0; i < 4; i++) box(0.03, 0.5, 0.05, barM, -3.3 + i * 0.2, 2.5, -3.9);
    // desk with donut box, filing cabinet, wanted poster, the key ring on a hook
    box(1.8, 0.75, 0.8, wood, 2.6, 0.375, -1.5); box(0.6, 0.12, 0.6, L(0xf0a0c0), 2.4, 0.81, -1.5);
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.035, 4, 8), L([0xf080b0, 0xc89050, 0x70c0f0][i])); d.rotation.x = Math.PI / 2; d.position.set(2.25 + i * 0.15, 0.9, -1.45); g.add(d); }
    box(0.5, 1.3, 0.6, L(0x6a7480), 4.5, 0.65, -3.4);
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.95), L(0xffffff, T.posterCat)); poster.position.set(1.5, 1.8, -3.89); g.add(poster);
    const keys = new THREE.Group(); keys.position.set(3.6, 1.6, -3.85); g.add(keys);
    { const r = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10), L(0xd8b040)); keys.add(r); for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.01), L(0xd8b040)); k.position.set(-0.04 + i * 0.04, -0.1, 0); k.rotation.z = (i - 1) * 0.3; keys.add(k); } }
    box(0.8, 0.06, 0.8, L(0xf4f4ff), 0, RH - 0.03, -0.5); box(0.8, 0.06, 0.8, L(0xf4f4ff), -3, RH - 0.03, -2);   // fluorescent panels
    box(1.2, 2.2, 0.08, L(0x6a5038), 0, 1.1, RD / 2 - 0.08);           // exit door
    g.userData = {
      cellDoor, keys, lockBox,
      openCell(k = 1) { cellDoor.position.x = 1.15 * Math.max(0, Math.min(1, k)); },  // slides toward +x behind the right bars
    };
    return {
      group: g, size: [RW, RD],
      cols: [
        { kind: 'box', cx: 0, cz: -RD / 2, w: RW, d: 0.3, rot: 0, h: RH }, { kind: 'box', cx: 0, cz: RD / 2, w: RW, d: 0.3, rot: 0, h: RH },
        { kind: 'box', cx: -RW / 2, cz: 0, w: 0.3, d: RD, rot: 0, h: RH }, { kind: 'box', cx: RW / 2, cz: 0, w: 0.3, d: RD, rot: 0, h: RH },
        { kind: 'box', cx: -1, cz: -2, w: 0.12, d: 4, rot: 0, h: RH }, { kind: 'box', cx: -4.05, cz: 0, w: 1.9, d: 0.12, rot: 0, h: RH }, { kind: 'box', cx: -1.45, cz: 0, w: 0.9, d: 0.12, rot: 0, h: RH },
        { id: 'cellDoor', kind: 'box', cx: -2.5, cz: 0, w: 1.2, d: 0.12, rot: 0, h: RH },
        { kind: 'box', cx: 2.6, cz: -1.5, w: 1.8, d: 0.8, rot: 0, h: 0.75 }, { kind: 'box', cx: 4.5, cz: -3.4, w: 0.5, d: 0.6, rot: 0, h: 1.3 },
        { kind: 'box', cx: -3, cz: -3.6, w: 3.6, d: 0.6, rot: 0, h: 0.45 },
      ],
      spawn: { x: -3, z: -2.4, yaw: Math.PI }, exit: { x: 0, z: RD / 2 - 0.6, r: 0.8 },
      lights: [{ x: 0, y: RH - 0.3, z: -0.5, c: 0xf0f4ff, i: 1.2, always: true }, { x: -3, y: RH - 0.3, z: -2, c: 0xe8f0ff, i: 0.9, always: true }],
      cam: { maxDist: 2.4, height: 2.2 },
      interact: [
        { id: 'cellDoor', x: -2.5, z: -0.5, r: 0.9, label: 'Rattle the bars' },
        { id: 'window', x: -3, z: -3.2, r: 0.8, label: 'Look out the window' },
        { id: 'toilet', x: -4.4, z: -1.6, r: 0.7, label: 'Inspect the toilet' },
        { id: 'keys', x: 3.6, z: -3.5, r: 0.9, label: 'The key ring' },
      ],
    };
  },
};

// ---------------- escalation ladder ----------------
// Level = how many cruisers are on the case (plus one if you hurt an officer). Stars decide how many cruisers come.
const CRUISERS_FOR_HEAT = [0, 0, 0, 1, 2, 4];
const PD_HEAT = 3;                                       // below this the HOA carts (game.js) handle it; the PD only rolls from 3 stars
const LADDER = ['', 'LVL 1  TALK + CUFFS', 'LVL 2  GUNS DRAWN', 'LVL 3  ARMED RESPONSE', 'LVL 4  SHOOT ON SIGHT'];
const LINES = {
  arrive: ['"Dispatch, we have a cat situation."', '"Unit 4 on scene. It\'s... a cat."', '"Sir. Ma\'am. Cat. Stop right there."'],
  cuff: ['"Paws behind your back!"', '"You have the right to remain fluffy."', '"Don\'t make me get the spray bottle."'],
  draw: ['"FREEZE, FURBALL!"', '"Drop the attitude, kitty!"', '"Hands where I can see \'em! ...Paws. Whatever."'],
  shoot: ['"Shots fired! The cat is ARMED!"', '"Requesting backup and a lint roller!"', '"Light him up!"'],
  hurt: ['"Officer down! ...I\'m fine, I tripped."', '"Ow! My donut arm!"'],
  free: ['"He\'s slippery!"', '"Cat is loose, repeat, cat is loose!"'],
  lost: ['"Where\'d he go?"', '"I lost visual. Also my breath."', '"He went... that way? Probably."', '"I\'m gonna need a minute."'],
  civ: ['"Oh, it\'s ON, cat."', '"Nobody paws me on MY sidewalk!"', '"Put \'em up, whiskers!"', '"I took karate at the Y!"'],
  civRun: ['"AAAH, RABID CAT!"', '"Not again!"', '"Somebody call the HOA!"'],
};
const pickL = (k) => LINES[k][(Math.random() * LINES[k].length) | 0];

export function makePolice(A) {
  const { scene, G, P, cat, cars, peds, places, T } = A;
  const cops = [];                                         // officers on foot (and their seats in cruisers)
  const pickups = [];
  const fxList = [];                                       // tracers + muzzle flashes
  const gun = { has: false, ammo: 0, equipped: false, cd: 0, aimT: 0 };
  let cuff = null, bust = null, provoked = 0, levelShown = 0, dispatched = false, regT = 0, roomOK = false, lineT = 0;
  let cuffImmune = 0, lostT = 0;
  const say = (who, k, force) => { if (!force && lineT > 0) return; lineT = 3.5; A.toast(`${who}: ${pickL(k)}`, 2.6); };

  // ---------- HUD ----------
  const css = document.createElement('style');
  css.textContent = `#pdhud{position:fixed;right:14px;top:148px;font:bold 12px monospace;color:#fff;text-shadow:1px 1px 0 #000,0 0 4px #000;text-align:right;pointer-events:none;z-index:6;line-height:1.5}
#pdhud .lvl{color:#ff5050;letter-spacing:1px}#pdhud .lvl.b{color:#5a8aff}#pdhud .gun{color:#ffe070}
#pdcuff{position:fixed;left:50%;top:62%;transform:translateX(-50%);width:240px;display:none;pointer-events:none;z-index:7;text-align:center;font:bold 13px monospace;color:#fff;text-shadow:1px 1px 0 #000}
#pdcuff .bar{height:12px;border:2px solid #fff;background:rgba(0,0,0,.5);margin-top:4px}#pdcuff .fill{height:100%;background:linear-gradient(90deg,#ffd040,#ff4040)}
#pdgunbtn{position:fixed;right:18px;bottom:228px;width:58px;height:58px;border-radius:50%;border:2px solid rgba(255,255,255,.7);background:rgba(20,20,30,.55);color:#ffe070;font:bold 12px monospace;display:none;z-index:8}`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'pdhud'; document.body.appendChild(hud);
  const cuffUI = document.createElement('div'); cuffUI.id = 'pdcuff';
  cuffUI.innerHTML = `<div class="t">CUFFING! ${A.isTouch ? 'TAP PAW' : 'MASH CLICK / SPACE'} TO WRIGGLE FREE</div><div class="bar"><div class="fill" style="width:0%"></div></div>`;
  document.body.appendChild(cuffUI);
  const cuffFill = cuffUI.querySelector('.fill');
  const gunBtn = document.createElement('button'); gunBtn.id = 'pdgunbtn'; gunBtn.textContent = 'GUN'; document.body.appendChild(gunBtn);
  gunBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleGun(); });

  // ---------- HP bars (one small canvas sprite per entity, redrawn when the value changes) ----------
  function bar(e) {
    if (!e.bar) {
      const c = document.createElement('canvas'); c.width = 40; c.height = 7;
      const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, fog: false, transparent: true }));
      sp.scale.set(0.62, 0.11, 1); sp.renderOrder = 20; scene.add(sp);
      e.bar = { sp, c, tex, v: -1 };
    }
    return e.bar;
  }
  function drawBar(e, frac, col) {
    const b = bar(e), v = Math.round(frac * 38);
    if (v === b.v && b.col === col) return;
    b.v = v; b.col = col;
    const g = b.c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 40, 7); g.fillStyle = '#3a0a0a'; g.fillRect(1, 1, 38, 5);
    g.fillStyle = col; g.fillRect(1, 1, v, 5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(1, 1, v, 1);
    b.tex.needsUpdate = true;
  }
  function placeBar(e, x, y, z, show, frac, col) {
    if (!show) { if (e.bar) e.bar.sp.visible = false; return; }
    drawBar(e, Math.max(0, frac), col); e.bar.sp.visible = true; e.bar.sp.position.set(x, y, z);
  }
  function dropBar(e) { if (e.bar) { scene.remove(e.bar.sp); e.bar.tex.dispose(); e.bar.sp.material.dispose(); e.bar = null; } }

  // ---------- effects ----------
  const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,220,1)'); r.addColorStop(0.35, 'rgba(255,200,80,.9)'); r.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const flashMat = new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1); tracerGeo.translate(0, 0, 0.5);
  function shotFx(x0, y0, z0, x1, y1, z1, size = 0.5) {
    const f = new THREE.Sprite(flashMat); f.position.set(x0, y0, z0); f.scale.setScalar(size); scene.add(f); fxList.push({ o: f, t: 0.06 });
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const tr = new THREE.Mesh(tracerGeo, tracerMat); tr.position.set(x0, y0, z0); tr.lookAt(x1, y1, z1); tr.scale.z = L; scene.add(tr); fxList.push({ o: tr, t: 0.05 });
  }
  // walk a line from a to b; returns the fraction where a wall stops it (1 = clear)
  function lineClear(x0, z0, x1, z1, y = 1.0) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.6));
    for (let i = 1; i < n; i++) { const k = i / n; if (A.blocked(x0 + (x1 - x0) * k, y, z0 + (z1 - z0) * k)) return k; }
    return 1;
  }
  const px = () => A.px(), pz = () => A.pz();
  const sees = (x, z) => lineClear(x, z, px(), pz(), 1.1) >= 1;

  // ---------- the cat's pistol + cuffs ----------
  const pawGun = makePawGun(); pawGun.position.set(0, -0.19, 0.012); cat.userData.arms[1].add(pawGun); pawGun.visible = false;
  const catCuffs = makeCuffs(); catCuffs.position.set(0, 0.29, -0.085); cat.userData.torso.add(catCuffs); catCuffs.visible = false;
  function toggleGun() {
    if (!gun.has) return;
    if (!gun.equipped && gun.ammo <= 0) { A.toast('Out of ammo.'); return; }
    gun.equipped = !gun.equipped; SND.tick(1200, 2, 0.06);
    A.toast(gun.equipped ? `Pistol out (${gun.ammo}). ${A.isTouch ? 'PAW' : 'Click'} to shoot, Q to holster.` : 'Pistol holstered.', 2);
  }

  // ---------- cruisers ----------
  const label = T.sign('POLICE', '#f4f4f4', '#14182a', 64, 14);
  function dressCruiser(c) {
    const u = c.mesh.userData, S = c.spec;
    const band = new THREE.Mesh(new THREE.BoxGeometry(S.wid + 0.17, S.h * 0.42, S.len * 0.42), new THREE.MeshPhongMaterial({ color: 0x14161c, shininess: 80 }));
    band.position.set(0, 0.32 + S.h * 0.42, 0.05); u.body.add(band);
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: label }));
    for (const s of [-1, 1]) { const q = sideL.clone(); q.position.set(s * (S.wid / 2 + 0.095), 0.32 + S.h * 0.42, 0.05); q.rotation.y = s * Math.PI / 2; u.body.add(q); }
    c.pd = c.pd || {};
  }
  // P12: the cruiser list is filtered once per frame (G.time tag) and reused by carAI, level(), update, the HUD, blips and game.js;
  // police.js invalidates it after its own spawns / removals (game.js removes cars before police.update runs)
  let cruList = null, cruTag = -1, frameN = 0, copN = 0;
  function cruisers() { const t = A.time(); if (!cruList || cruTag !== t) { cruTag = t; cruList = cars.filter((c) => c.pd && c.pd.unit && !c.dead && cars.includes(c) && c.driver !== 'player'); } return cruList; }
  const dirtyCruisers = () => { cruList = null; };
  function spawnCruiser() {
    const opts = [];
    for (let i = 0; i < NODES.length; i++) {
      const d = Math.hypot(NODES[i].x - px(), NODES[i].z - pz());
      if (d > 50 && d < 115 && A.roadOpts(i, -1).length) opts.push(i);
    }
    if (!opts.length) return null;
    const n = opts[(Math.random() * opts.length) | 0], N0 = NODES[n];
    const c = A.spawnCar('sedan', N0.x, N0.z, Math.atan2(px() - N0.x, pz() - N0.z), { color: 0xf2f2f2, lightbar: true, driver: 'police', role: 'police', hp: 130 });
    dressCruiser(c);
    c.nav = { n };
    c.pd = { unit: 1 + ((Math.random() * 9) | 0), state: 'chase', crew: [], t: 0, ix: copN++ }; dirtyCruisers();
    const crewN = levelFromCars(cruisers().length) <= 1 ? 1 : 2;
    for (let i = 0; i < crewN; i++) c.pd.crew.push(newCop(c, i ? 1 : -1));
    if (!dispatched) { dispatched = true; SND.radio(); A.toast('Dispatch: "All units, we have a cat situation in Maple Grove."', 3); }
    return c;
  }
  // parked cruisers at the station, free to steal (for a price)
  const parked = [];
  if (places.station && places.station.parking) for (const s of places.station.parking) {
    const c = A.spawnCar('sedan', s.x, s.z, s.yaw, { color: 0xf2f2f2, lightbar: true, role: 'pdParked', hp: 130 });
    dressCruiser(c); parked.push(c);
  }

  // ---------- officers ----------
  function newCop(car, side) {
    const mesh = makeOfficer(); mesh.visible = false; scene.add(mesh);
    return { mesh, car, side, x: car.x, z: car.z, yaw: car.yaw, hp: 100, state: 'inside', t: 0, ph: Math.random() * 6, aim: 0, cd: 0.6, burst: 3, strafe: Math.random() < 0.5 ? 1 : -1, barT: 0, ix: copN++, name: ['Dale', 'Rhonda', 'Pete', 'Barb', 'Kowalski', 'Hank'][(Math.random() * 6) | 0] };
  }
  function deploy(car) {
    for (const o of car.pd.crew) {
      if (o.state !== 'inside') continue;
      const s = o.side, w = car.spec.wid / 2 + 0.7;
      const q = A.collide(car.x + Math.cos(car.yaw) * w * s, car.z - Math.sin(car.yaw) * w * s, 0.32);
      o.x = q.x; o.z = q.z; o.yaw = car.yaw; o.state = 'exit'; o.t = 1.0; o.mesh.visible = true;
      if (!cops.includes(o)) cops.push(o);
    }
    A.Sfx.door();
    const lv = level();
    say(`Officer ${car.pd.crew[0].name}`, lv >= 4 ? 'shoot' : lv >= 2 ? 'draw' : 'arrive', true);
  }
  function levelFromCars(n) { return Math.min(4, n); }
  function level() { let n = 0; for (const c of cruisers()) if (c.pd.state !== 'leave') n++; return Math.min(4, levelFromCars(n) + (provoked > 0 ? 1 : 0)); }

  function carAI(c, dt) {
    const K = c.pd, d = Math.hypot(px() - c.x, pz() - c.z);
    K.t += dt;
    if (G.heat < PD_HEAT && K.state !== 'leave' && K.state !== 'parked') K.state = 'leave';
    if (K.state === 'chase') {
      let gx, gz;
      if (d < 30) { gx = px() + (P.car ? P.car.vx * 0.4 : 0); gz = pz() + (P.car ? P.car.vz * 0.4 : 0); c.nav = null; }
      else [gx, gz] = A.navTarget(c, px(), pz());
      c.topMul = 0.78 + 0.03 * level();
      const stop = (!P.car && d < 13) || (P.car && d < 13 && Math.abs(P.car.speed) < 3) || d < 7 + Math.abs(c.speed) * 0.7;
      if (stop && K.crew.some((o) => o.state === 'inside')) K.state = 'stopping';
      else A.chaseAI(c, dt, gx, gz, 0.8);
      const seen = d < 45 && ((frameN + (K.ix | 0)) % 3 === 0 || K.losF === undefined || frameN - K.losF > 3 ? (K.losF = frameN, K.los = sees(c.x, c.z)) : K.los);
      if (d < 30 && seen) G.seenT = 0;
      K.blind = seen ? 0 : (K.blind || 0) + dt;
      if (K.t > 8 && (K.blind > 12 || d > 120)) { K.state = 'leave'; K.goal = null; A.toast('Dispatch: "Unit ' + K.unit + ', we lost the cat."', 2.4); lostT = 15; }
    } else if (K.state === 'stopping') {
      A.drive(c, 0, 0, true, dt);
      if (Math.abs(c.speed) < 1.5) { K.state = 'parked'; deploy(c); }
    } else if (K.state === 'parked') {
      A.drive(c, 0, 0, true, dt); c.vx *= 1 - 3 * dt; c.vz *= 1 - 3 * dt;
      if (K.crew.every((o) => o.state === 'inside' || o.state === 'out')) K.state = G.heat >= PD_HEAT ? 'chase' : 'leave';
    } else if (K.state === 'leave') {
      if (K.crew.some((o) => o.state !== 'inside' && o.state !== 'out')) { A.drive(c, 0, 0, true, dt); return; }
      if (!K.goal) { let b = 0, bd = -1; for (let i = 0; i < NODES.length; i++) { const q = Math.hypot(NODES[i].x - px(), NODES[i].z - pz()); if (q > bd && A.roadOpts(i, -1).length) { bd = q; b = i; } } K.goal = NODES[b]; }
      const [gx, gz] = A.navTarget(c, K.goal.x, K.goal.z);
      c.topMul = 0.8; A.chaseAI(c, dt, gx, gz, 0.7);
    }
  }

  // ---------- combat helpers ----------
  function provoke(t = 25) { provoked = Math.max(provoked, t); }
  function hitCop(o, dmg, kind, dx = 0, dz = 0) {
    if (o.state === 'out' || o.state === 'inside') return;
    o.hp -= dmg; o.barT = 5; provoke();
    if (cuff && cuff.o === o) endCuff(false);
    if (o.hp <= 0) {
      o.hp = 0; o.state = 'out'; o.t = 0; o.mesh.userData.setFace(2); o.mesh.userData.gun.visible = false;
      o.fall = 0; o.fallDir = [dx, dz];
      if (!o.dropped) { o.dropped = true; addPistol(o.x + 0.4, o.z + 0.3, 12); }
      say(`Officer ${o.name}`, 'hurt', true);
    } else if (kind === 'paw' || kind === 'car') {
      o.state = 'down'; o.t = kind === 'car' ? 2.6 : 1.6; o.vx = dx * 3; o.vz = dz * 3; o.fall = 0; o.mesh.userData.setFace(2);
    } else { o.stag = 0.3; o.mesh.userData.setFace(3); }
  }
  function hitPed(p, dmg, dx, dz, kind) {
    if (p.state === 'down') return;
    p.hp ??= (p.mesh.userData.scale || 1) < 0.9 ? 60 : 100;
    p.hp -= dmg; p.barT = 5;
    if (p.hp <= 0) {
      A.knock(p, dx, dz, kind === 'bullet' ? 3 : 5); p.hp = 70; p.angered = false;
      if (p.kind === 'human') A.addHeat(1, kind === 'bullet' ? 'shooting a neighbour' : 'assault with a paw');
      return;
    }
    if (p.kind !== 'human') { A.knock(p, dx, dz, 4); return; }
    p.x += dx * 0.35; p.z += dz * 0.35; p.stag = 0.3;
    if (!p.angered) {
      p.angered = true;
      A.addHeat(kind === 'bullet' ? 2 : 1, kind === 'bullet' ? 'shooting a neighbour' : 'assault with a paw');
      const brave = kind !== 'bullet' && Math.random() < 0.7;
      if (brave) { p.state = 'fight'; p.t = 18; p.cd = 0.4; A.toast(`Neighbour: ${pickL('civ')}`, 2.4); }
      else { p.state = 'flee'; p.t = 5; p.from = { x: P.x, z: P.z }; A.toast(`Neighbour: ${pickL('civRun')}`, 2); }
    } else if (p.state !== 'fight' && kind !== 'bullet') { p.state = 'fight'; p.t = 18; }
  }

  // the cat's paw: officers (peds are handled through pawPed from the ped loop)
  function paw(fx, fz) {
    for (const o of cops) {
      if (o.state === 'inside' || o.state === 'out') continue;
      const dx = o.x - P.x, dz = o.z - P.z;
      if (Math.hypot(dx, dz) < 1.5 && dx * fx + dz * fz > 0) {
        A.Sfx.punch(); hitCop(o, 18 + Math.random() * 6, 'paw', fx, fz);
        if (!o.punched) { o.punched = true; A.addHeat(1, 'assaulting an officer'); }
      }
    }
  }
  function pawPed(p, fx, fz) {
    A.Sfx.punch();
    hitPed(p, 22 + Math.random() * 8, fx, fz, 'paw');
  }

  // ---------- the cat's gun ----------
  function playerFire() {
    if (gun.cd > 0) return;
    if (gun.ammo <= 0) { SND.tick(900, 1); gun.cd = 0.3; A.toast('Click. Out of ammo.', 1.5); gun.equipped = false; return; }
    gun.ammo--; gun.cd = 0.28; gun.aimT = 1.2;
    const cy = A.camYaw() + Math.PI, cfx = Math.sin(cy), cfz = Math.cos(cy);
    // soft lock-on: the target nearest the camera's aim within 30 m and ~30 degrees
    let tgt = null, best = 1e9;
    const consider = (e, kind) => {
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
      if (d > 30 || d < 0.3) return;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * cfx + dz * cfz) / d)));
      if (ang > 0.55) return;
      const s = ang * 20 + d * 0.3 + (kind === 'cop' ? 0 : 3);
      if (s < best && lineClear(P.x, P.z, e.x, e.z) >= 1) { best = s; tgt = { e, kind, d }; }
    };
    for (const o of cops) if (o.state !== 'inside' && o.state !== 'out') consider(o, 'cop');
    for (const p of peds) if (p.kind === 'human' && !p.npc && p.state !== 'down') consider(p, 'ped');
    let ax, az;
    if (tgt) { ax = tgt.e.x - P.x; az = tgt.e.z - P.z; } else { ax = cfx; az = cfz; }
    const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
    P.yaw = Math.atan2(ax, az);
    const mx = P.x + ax * 0.3, mz = P.z + az * 0.3, my = 0.42 + P.y;
    SND.bang(0.9); A.shake(0.08);
    let ex, ez, ey = 0.9;
    if (tgt && Math.random() < 0.88 - tgt.d * 0.01) {
      ex = tgt.e.x; ez = tgt.e.z; ey = tgt.kind === 'cop' ? 1.2 : 1.0;
      if (tgt.kind === 'cop') { hitCop(tgt.e, 34 + Math.random() * 8, 'bullet', ax, az); if (!tgt.e.shotAt) { tgt.e.shotAt = true; G.heat = Math.max(G.heat, 3); A.addHeat(1, 'shooting at an officer'); } }
      else hitPed(tgt.e, 55, ax, az, 'bullet');
    } else {
      const far = tgt ? tgt.d + 3 : 30, k = lineClear(P.x, P.z, P.x + ax * far, P.z + az * far, 0.9);
      ex = P.x + ax * far * k + (tgt ? (Math.random() - 0.5) * 1.2 : 0); ez = P.z + az * far * k + (tgt ? (Math.random() - 0.5) * 1.2 : 0);
      // cars along the line take the round
      for (const c of cars) {
        if (c.dead) continue;
        const dx = c.x - P.x, dz = c.z - P.z, f = dx * ax + dz * az;
        if (f > 0 && f < far * k && Math.abs(dx * az - dz * ax) < c.spec.wid / 2 + 0.3) { ex = P.x + ax * f; ez = P.z + az * f; A.damageCar(c, 8); if (c.pd && c.pd.unit) { provoke(); A.addHeat(1, 'shooting a police cruiser'); } break; }
      }
      A.puff('dust', ex, 0.6, ez, 0, 1, 0, 0.35, 0.5);
    }
    shotFx(mx, my, mz, ex, ey, ez, 0.35);
    if (!tgt || tgt.kind === 'ped') for (const p of peds) if (p.kind === 'human' && !p.npc && p.state === 'walk' && Math.hypot(p.x - P.x, p.z - P.z) < 18) { p.state = 'flee'; p.t = 5; p.from = { x: P.x, z: P.z }; }
    if (G.heat < 2) A.addHeat(1, 'discharging a firearm in a cul-de-sac');
  }
  function gunInput(pressedFire) { if (pressedFire && !P.car && !cuff && !bust) playerFire(); }

  // ---------- pickups ----------
  function addPistol(x, z, ammo) {
    const m = new THREE.Group();
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.26), new THREE.MeshLambertMaterial({ color: 0x1a1a1e })); g.position.y = 0.05; m.add(g);
    const gr = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), new THREE.MeshLambertMaterial({ color: 0x2a2a2e })); gr.position.set(0, 0.0, -0.09); gr.rotation.x = 0.4; m.add(gr);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 16), new THREE.MeshBasicMaterial({ color: 0xffe070, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; m.add(ring);
    m.position.set(x, 0.15, z); scene.add(m);
    pickups.push({ m, x, z, ammo, t: 0 });
  }

  // ---------- cuffing + bust ----------
  function startCuff(o) {
    if (cuff || bust || cuffImmune > 0) return;
    cuff = { o, prog: 0.12 }; o.state = 'cuffing'; P.vx = P.vz = 0;
    gun.equipped = false;
    say(`Officer ${o.name}`, 'cuff', true); SND.tick(2600, 2, 0.08);
  }
  function endCuff(win) {
    if (!cuff) return;
    const o = cuff.o; cuff = null; setStyle(cuffUI, 'display', 'none'); catCuffs.visible = false;
    if (!win) {
      if (o.state === 'cuffing') { o.state = 'down'; o.t = 1.4; o.vx = -Math.sin(P.yaw) * 2; o.vz = -Math.cos(P.yaw) * 2; o.fall = 0; o.mesh.userData.setFace(2); }
      cuffImmune = 2.5; P.invuln = 0.8;
      say(`Officer ${o.name}`, 'free', true); A.addHeat(1, 'resisting arrest');
    }
  }
  function startBust() {
    const o = cuff.o; cuff = null; setStyle(cuffUI, 'display', 'none');
    catCuffs.visible = true; SND.tick(2000, 6, 0.05, 0.1);
    const fine = Math.min(G.cash, 40 + 30 * G.heat);
    bust = { t: 3.2, o, fine, hadGun: gun.has };
    gun.has = false; gun.ammo = 0; gun.equipped = false;
    A.banner('BUSTED!', `Officer ${o.name}: "${['You have the right to remain fluffy.', 'Anything you meow can and will be used against you.', 'Book him. Gently. He bites.'][(Math.random() * 3) | 0]}"`, 3.4, 'fail');
  }
  function finishBust() {
    const b = bust; bust = null; catCuffs.visible = false;
    A.addCash(-b.fine);
    const st = places.station;
    const front = st ? st.door : null;
    const info = { from: 'police', fine: b.fine, station: st };
    if (window.__JAIL && typeof window.__JAIL.start === 'function') {          // the jailbreak quest takes it from here (fade, cell, respawn)
      try { window.__JAIL.start(info); if (window.__onArrest) window.__onArrest(info); return; } catch (e) { console.warn('jail hand-off failed', e); }
    }
    A.respawn('BOOKED', `Maple Grove PD fined you $${b.fine}${b.hadGun ? ' and kept the pistol' : ''}.`, front ? { x: front.x - 1.5, z: front.z - 2.5 } : places.rv);
    P.yaw = front ? front.yaw : P.yaw;
    try {
      if (roomOK && window.__INT && typeof window.__INT.enter === 'function') { window.__INT.enter('jail', { locked: false }); A.toast('A night in the holding cell. Walk out when you\'re ready.', 4); }
    } catch (e) { console.warn('jail hand-off failed', e); }
    if (window.__onArrest) try { window.__onArrest(info); } catch (e) { /* ignore */ }
  }
  function holdPlayer(dt) {
    if (bust) { P.vx = P.vz = 0; return true; }
    if (!cuff) return false;
    if (P.car) A.exitCar();
    P.vx = P.vz = 0;
    if (A.hit('punch', ' ', 'j', 'k', 'e', 'f', 'enter')) { cuff.prog -= 0.15; A.Sfx.swing(); A.shake(0.05); }
    return true;
  }

  // ---------- frame ----------
  const pose = (o, aim) => {
    const u = o.mesh.userData;
    if (aim) { u.arms[1].rotation.x = -1.45; u.arms[1].rotation.z = 0.05; u.arms[0].rotation.x = -1.3; u.arms[0].rotation.z = 0.35; u.head.rotation.x = 0.05; }
    else { u.arms[1].rotation.z = 0.2; u.arms[0].rotation.z = -0.2; }
  };
  function moveCop(o, sp, dt, yaw = o.yaw) {
    o.x += Math.sin(yaw) * sp * dt; o.z += Math.cos(yaw) * sp * dt;
    const q = A.collide(o.x, o.z, 0.32); o.x = q.x; o.z = q.z;
    for (const c of cars) if (!c.dead) for (const [cx, cz] of A.carCircles(c)) {
      const dx = o.x - cx, dz = o.z - cz, dd = Math.hypot(dx, dz), m = c.spec.wid / 2 + 0.3;
      if (dd < m && dd > 1e-4) { o.x = cx + dx / dd * m; o.z = cz + dz / dd * m; }
    }
    o.ph += dt * sp * 4.2;
  }
  function copAI(o, dt) {
    const u = o.mesh.userData;
    o.t -= dt; o.cd -= dt; if (o.barT > 0) o.barT -= dt;
    const tx = px(), tz = pz(), dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz), face = Math.atan2(dx, dz);
    const los0 = o.state === 'engage' && d < 26 && ((frameN + o.ix) % 3 === 0 || o.losF === undefined || frameN - o.losF > 3 ? (o.losF = frameN, o.los = lineClear(o.x, o.z, tx, tz, 1.1) >= 1) : o.los);
    let sp = 0, aim = false, yawMove = face;
    u.torso.rotation.x = 0;
    if (o.state === 'exit') { if (o.t <= 0) o.state = 'engage'; }
    else if (o.state === 'down' || o.state === 'out') {
      o.fall = Math.min(1, (o.fall || 0) + dt * 5);
      if (o.vx) { o.x += o.vx * dt; o.z += o.vz * dt; o.vx *= 1 - 3 * dt; o.vz *= 1 - 3 * dt; }
      u.body.rotation.x = -Math.PI / 2 * o.fall; u.body.position.y = 0.15 * o.fall;
      if (o.state === 'down' && o.t <= 0) { o.state = 'engage'; u.body.rotation.x = 0; u.body.position.y = 0; u.setFace(1); }
      if (o.state === 'out') { o.t += dt; if (o.t > 2 && (Math.random() < dt * 0.6)) A.puff('dust', o.x, 1.0, o.z, 0, 0.6, 0, 0.25, 0.8); }
      o.mesh.position.set(o.x, 0, o.z); o.mesh.rotation.y = o.yaw;
      return;
    } else if (o.state === 'cuffing') {
      o.x = P.x - Math.sin(P.yaw) * 0.5; o.z = P.z - Math.cos(P.yaw) * 0.5; o.yaw = P.yaw;
      u.torso.rotation.x = 0.35; u.arms[0].rotation.x = -0.9; u.arms[1].rotation.x = -0.9; u.arms[0].rotation.z = -0.1; u.arms[1].rotation.z = 0.1;
      o.mesh.position.set(o.x, 0, o.z); o.mesh.rotation.y = o.yaw; u.gun.visible = false;
      return;
    } else if (o.state === 'return') {
      const c = o.car;
      if (!c || c.dead || !cars.includes(c) || c.driver === 'player') { o.state = 'walkoff'; }
      else {
        const s = o.side, w = c.spec.wid / 2 + 0.6, gx = c.x + Math.cos(c.yaw) * w * s, gz = c.z - Math.sin(c.yaw) * w * s;
        yawMove = Math.atan2(gx - o.x, gz - o.z); sp = 4;
        if (Math.hypot(gx - o.x, gz - o.z) < 0.9) { o.state = 'inside'; o.mesh.visible = false; if (o.bar) o.bar.sp.visible = false; A.Sfx.door(); return; }
      }
      if (G.heat >= PD_HEAT && d < 22) o.state = 'engage';                  // hysteresis: engage gives up past 30 m, resumes under 22 m
    } else if (o.state === 'walkoff') {
      yawMove = Math.atan2(-dx, -dz); sp = 2;
      if (G.heat >= PD_HEAT && d < 22) o.state = 'engage';
    } else if (o.state === 'engage') {
      const lv = level();
      const carOk = o.car && !o.car.dead && cars.includes(o.car) && o.car.driver !== 'player';
      o.lost = los0 ? 0 : (o.lost || 0) + dt;
      if (G.heat < PD_HEAT || (P.car && d > 26 && carOk) || d > 30 || o.lost > 5) { o.state = carOk ? 'return' : 'walkoff'; if (o.lost > 5 || d > 30) say(`Officer ${o.name}`, 'lost'); }
      else if (bust) { sp = 0; }
      else {
        const armed = gun.equipped;
        const fire = lv >= 4 || (lv >= 3 && (armed || P.car || provoked > 0)) || (lv >= 2 && provoked > 0 && armed);
        const drawn = lv >= 2 || provoked > 0;
        u.gun.visible = drawn;
        const los = los0; // same line, same frame: only read where d < 26 (see los0)
        if (fire) {
          if (o.mode !== 'fire') { o.mode = 'fire'; say(`Officer ${o.name}`, 'shoot'); u.setFace(1); }
          if (d > 12 || !los) { sp = 3.3; }
          else if (d < 5) { sp = 2.6; yawMove = face + Math.PI; }
          else { sp = 1.1; yawMove = face + o.strafe * Math.PI / 2; if (Math.random() < dt * 0.4) o.strafe *= -1; }
          if (los && d < 26) { o.aim += dt; aim = true; } else o.aim = 0;
          if (o.aim > 0.9 && o.cd <= 0 && !cuff) copFire(o, d);
        } else {
          if (o.mode !== 'cuff') { o.mode = 'cuff'; u.setFace(drawn ? 1 : 0); }
          o.aim = 0; aim = drawn && d < 9;
          if (P.car) {
            const c = P.car, w = c.spec.wid / 2 + 0.8, gx = c.x + Math.cos(c.yaw) * w, gz = c.z - Math.sin(c.yaw) * w;
            const gd = Math.hypot(gx - o.x, gz - o.z);
            yawMove = Math.atan2(gx - o.x, gz - o.z); sp = gd > 0.8 ? (drawn ? 3.0 : 3.6) : 0;
            if (gd < 1.7 && Math.abs(c.speed) < 2.5 && !cuff && cuffImmune <= 0 && !cops.some((q) => q.state === 'cuffing')) {
              A.exitCar(); A.toast(`Officer ${o.name}: "Out of the vehicle, whiskers!"`, 2.4); startCuff(o);
            }
          } else {
            const busy = cops.some((q) => q !== o && q.state === 'cuffing');
            if (busy) { sp = d > 2.4 ? 3.2 : 0; }
            else {
              sp = d > 0.85 ? (drawn ? 3.1 : 3.7) * (o.puff = Math.max(0.55, (o.puff ?? 1) - dt * 0.05)) : 0;
              if (d < 0.95 && P.y < 0.35 && P.down <= 0 && cuffImmune <= 0) startCuff(o);
            }
          }
        }
        if (d < 22 && los) G.seenT = 0;
      }
    } else if (o.state === 'inside') { return; }
    if (o.stag > 0) { o.stag -= dt; sp = 0; }
    // keep cops from stacking up
    for (const q of cops) if (q !== o && q.state !== 'inside') { const ex = o.x - q.x, ez = o.z - q.z, e = Math.hypot(ex, ez); if (e < 0.7 && e > 1e-4) { o.x += ex / e * (0.7 - e) * 0.5; o.z += ez / e * (0.7 - e) * 0.5; } }
    if (sp > 0) moveCop(o, sp, dt, yawMove);
    const turnTo = aim || sp === 0 || o.state === 'engage' && o.mode === 'fire' ? face : yawMove;
    let dy = turnTo - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 10);
    animBiped(o.mesh, o.ph, sp ? Math.min(1, sp / 3) : 0, A.time());
    pose(o, aim);
    o.mesh.position.set(o.x, 0, o.z); o.mesh.rotation.y = o.yaw;
  }
  function copFire(o, d) {
    o.burst--; o.cd = o.burst > 0 ? 0.4 : 1.8 + Math.random() * 1.6; if (o.burst <= 0) o.burst = 2 + ((Math.random() * 3) | 0);
    const lv = level(), sc = o.mesh.userData.scale;
    const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), mx = o.x + fx * 0.7 * sc + Math.cos(o.yaw) * 0.05, mz = o.z + fz * 0.7 * sc, my = 1.3 * sc;
    const fast = !P.car && Math.hypot(P.vx, P.vz) > 5;
    let chance = 0.16 + lv * 0.04 - d * 0.018 - (fast ? 0.12 : 0) + (P.car ? 0.06 : 0);
    const hitIt = Math.random() < chance;
    const vol = Math.max(0.15, 1 - d / 50); SND.bang(vol, 3500);
    let ex = px(), ez = pz(), ey = P.car ? 1.0 : 0.4 + P.y;
    if (hitIt) {
      if (P.car) { A.damageCar(P.car, 5); if (Math.random() < 0.25) A.hurt(3); }
      else A.hurt(6 + Math.random() * 4);
    } else { ex += (Math.random() - 0.5) * 2.4; ez += (Math.random() - 0.5) * 2.4; ey = 0.1; A.puff('dust', ex, 0.2, ez, 0, 1, 0, 0.3, 0.5); }
    shotFx(mx, my, mz, ex, ey, ez, 0.6);
  }

  // run over: cartoon tumble through the air, HP hit (the knock + heat stay in game.js interactions)
  function runOver(p, c, cx, cz, sp) {
    if (!A.knock(p, c.vx + (p.x - cx), c.vz + (p.z - cz), sp * 0.6)) return false;
    if (p.kind === 'human' && sp > 6) {
      p.hp ??= 100; p.hp = Math.max(0, p.hp - sp * 4); p.barT = 4; p.angered = true;
      p.air = { y: 0, vy: Math.min(7, 1.5 + sp * 0.28), rx: (6 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1), rz: (Math.random() - 0.5) * 10, bounce: 1 };
      p.vx = c.vx * 0.8 + (p.x - cx) * 2; p.vz = c.vz * 0.8 + (p.z - cz) * 2;
      if (c === P.car && Math.random() < 0.3) A.toast(['"MY HIP!"', '"I\'m OK!"', '"Not the khakis!"', '"Worth it."'][(Math.random() * 4) | 0], 1.6);
    }
    if (p.hp <= 0) p.hp = 70;
    return true;
  }
  function airborne(p, dt) {
    const a = p.air, u = p.mesh.userData;
    a.vy -= 16 * dt; a.y += a.vy * dt;
    p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 1 - 0.6 * dt; p.vz *= 1 - 0.6 * dt;
    const q = A.collide(p.x, p.z, p.r); if (q.hit) { p.vx *= -0.4; p.vz *= -0.4; } p.x = q.x; p.z = q.z;
    u.body.rotation.x += a.rx * dt; u.body.rotation.z += a.rz * dt; u.body.position.y = 0.4;
    if (a.y <= 0) {
      a.y = 0;
      if (a.bounce-- > 0 && a.vy < -3) { a.vy *= -0.35; A.puff('dust', p.x, 0.3, p.z, 0, 0.8, 0, 0.5, 0.6); }
      else { p.air = null; u.body.rotation.set(-Math.PI / 2, 0, 0); u.body.position.y = 0.15; p.spin = 1; p.vx *= 0.4; p.vz *= 0.4; A.puff('dust', p.x, 0.3, p.z, 0, 0.8, 0, 0.6, 0.7); }
    }
    p.mesh.position.set(p.x, a ? a.y : 0, p.z); p.mesh.rotation.y = p.yaw;
    placeBar(p, p.x, (a ? a.y : 0) + 2.0 * (u.scale || 1), p.z, true, (p.hp ?? 100) / 100, '#40d040');
  }
  // ped fighting (called from game.js updatePed; returns true when this ped was handled here)
  function pedHook(p, dt) {
    if (p.air) { if (p.state !== 'down') p.air = null; else { airborne(p, dt); return true; } }
    if (p.barT > 0) p.barT -= dt;
    const fighting = p.state === 'fight';
    if (!fighting) { if (p.barT > 0 && p.hp !== undefined) placeBar(p, p.x, (p.state === 'down' ? 0.9 : 2.0) * (p.mesh.userData.scale || 1), p.z, true, p.hp / 100, '#40d040'); else if (p.bar) p.bar.sp.visible = false; return false; }
    const u = p.mesh.userData;
    p.t -= dt;
    const dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz);
    if (P.car || p.t <= 0 || d > 22 || bust || cuff) { p.state = 'walk'; p.lane = null; A.attachPed(p); p.wind = 0; return false; }
    p.yaw = Math.atan2(dx, dz);
    let moving = 0;
    if (p.stag > 0) p.stag -= dt;
    else if (p.wind > 0) {
      p.wind -= dt;
      if (p.wind <= 0) {
        if (d < 1.3 && P.y < 0.5 && !P.car) { A.Sfx.punch(); A.hurt(5 + Math.random() * 4); P.vx += dx / (d || 1) * 3; P.vz += dz / (d || 1) * 3; }
        else A.Sfx.swing();
        p.cd = 0.9 + Math.random() * 0.6;
      }
    } else if (d > 0.95) moving = 3.7;
    else if ((p.cd -= dt) <= 0) p.wind = 0.32;
    if (moving) {
      p.x += Math.sin(p.yaw) * moving * dt; p.z += Math.cos(p.yaw) * moving * dt;
      const q = A.collide(p.x, p.z, p.r); p.x = q.x; p.z = q.z;
      p.ph += dt * moving * 4.2;
    }
    animBiped(p.mesh, p.ph, moving ? 1 : 0, A.time(), p.wind > 0 ? Math.sin((0.32 - p.wind) / 0.32 * Math.PI) : 0);
    if (!moving && u.arms) { u.arms[0].rotation.x = -0.9; if (!(p.wind > 0)) u.arms[1].rotation.x = -0.7; }  // fists up
    p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.yaw;
    placeBar(p, p.x, 2.0 * (u.scale || 1), p.z, true, p.hp / 100, '#ff9030');
    return true;
  }

  function update(dt) {
    frameN++; dirtyCruisers(); const CRU = cruisers();
    lineT -= dt; cuffImmune -= dt; gun.cd -= dt; gun.aimT -= dt;
    if (provoked > 0) provoked -= dt;
    // register the jail cell with the interiors system once it exists
    if (!roomOK && (regT -= dt) <= 0) {
      regT = 1;
      if (window.__INT && typeof window.__INT.registerRoom === 'function') { try { window.__INT.registerRoom('jail', JAIL_ROOM); roomOK = true; } catch (e) { console.warn('jail room', e); regT = 30; } }
    }
    // dispatch
    const want = CRUISERS_FOR_HEAT[Math.min(5, G.heat)] || 0;
    let live = 0; for (const c of CRU) if (c.pd.state !== 'leave') live++;
    if ((lostT -= dt) <= 0 && live < want && !bust && Math.random() < dt * 0.3) spawnCruiser();
    if (G.heat === 0) dispatched = false;
    // G.seenT grows in game.js updateHeat only; units here just reset it when they see the cat
    // cruisers: lights, theft, cleanup
    const f = Math.floor(A.time() * 7) % 2;
    for (const c of cars) {
      if (!c.pd) continue;
      const u = c.mesh.userData;
      if (u.bar) { const on = c.pd.unit && c.driver === 'police'; u.bar[0].color.set(on ? (f ? 0xff2020 : 0x300808) : 0x401010); u.bar[1].color.set(on ? (f ? 0x081030 : 0x2050ff) : 0x101840); }
      if (c.driver === 'player' && !c.pd.stolen) {
        c.pd.stolen = true; c.role = null;
        A.addHeat(2, 'stealing a police cruiser'); provoke(15);
        if (c.pd.crew) for (const o of c.pd.crew) if (o.state === 'inside') { o.state = 'walkoff'; o.x = c.x + 1.5; o.z = c.z; o.mesh.visible = true; cops.push(o); }
      }
    }
    for (const c of cars.slice()) {
      if (!c.pd || !c.pd.unit || c.driver === 'player') continue;
      const far = Math.hypot(c.x - px(), c.z - pz());
      const crewHome = c.pd.crew.every((o) => o.state === 'inside' || o.state === 'out');
      if ((c.pd.state === 'leave' && far > 60 && crewHome) || (c.dead && far > 80)) { A.removeCar(c); dirtyCruisers(); for (const o of c.pd.crew) if (o.state === 'inside') { scene.remove(o.mesh); dropBar(o); if (cops.includes(o)) cops.splice(cops.indexOf(o), 1); } }
    }
    // officers
    for (const o of cops.slice()) {
      if (o.state === 'inside') continue;
      copAI(o, dt);
      const far = Math.hypot(o.x - px(), o.z - pz());
      if ((o.state === 'out' && (far > 60 || o.t > 60)) || (o.state === 'walkoff' && far > 45)) { scene.remove(o.mesh); dropBar(o); cops.splice(cops.indexOf(o), 1); continue; }
      const show = o.state !== 'inside' && (o.barT > 0 || (o.state === 'engage' && far < 20));
      placeBar(o, o.x, 2.08, o.z, show && o.state !== 'out', o.hp / 100, o.hp > 50 ? '#4a8aff' : '#ff5050');
    }
    // cars hit officers
    for (const c of cars) {
      const sp = Math.hypot(c.vx, c.vz); if (sp < 4 || c.dead) continue;
      for (const [cx, cz] of A.carCircles(c)) for (const o of cops) {
        if (o.state === 'inside' || o.state === 'out' || o.state === 'down') continue;
        if (Math.hypot(o.x - cx, o.z - cz) < c.spec.wid / 2 + 0.3) {
          const l = sp || 1; A.Sfx.punch(); hitCop(o, sp * 3.5, 'car', c.vx / l, c.vz / l); c.vx *= 0.9; c.vz *= 0.9;
          if (c === P.car) { A.shake(0.15); if (!o.runOver) { o.runOver = true; A.addHeat(1, 'running over an officer'); } }
        }
      }
    }
    // cuffing in progress
    if (cuff) {
      const helpers = cops.filter((q) => q !== cuff.o && q.state === 'engage' && Math.hypot(q.x - P.x, q.z - P.z) < 2.5).length;
      cuff.prog += dt * (0.3 + 0.12 * helpers);
      setStyle(cuffUI, 'display', 'block'); setStyle(cuffFill, 'width', Math.max(0, Math.min(100, cuff.prog * 100)).toFixed(1) + '%');
      catCuffs.visible = cuff.prog > 0.65;
      if (cuff.prog > 0.65 && !cuff.clicked) { cuff.clicked = true; SND.tick(2400, 3, 0.05); }
      if (cuff.prog <= 0) endCuff(false);
      else if (cuff.prog >= 1) startBust();
    }
    if (cuff || bust) {
      const u = cat.userData;                                                         // paws behind the back
      u.arms[0].rotation.set(0.75, 0, 0.12); u.arms[1].rotation.set(0.75, 0, -0.12);
      u.legs[0].rotation.x = 0; u.legs[1].rotation.x = 0;
    }
    if (bust) {
      bust.t -= dt;
      const o = bust.o; o.x = P.x - Math.sin(P.yaw) * 0.55; o.z = P.z - Math.cos(P.yaw) * 0.55; o.yaw = P.yaw;
      o.mesh.position.set(o.x, 0, o.z); o.mesh.rotation.y = o.yaw; o.mesh.userData.setFace(0);
      const u = o.mesh.userData; u.torso.rotation.x = 0.2; u.arms[0].rotation.x = -0.7; u.arms[1].rotation.x = -0.7;
      if (bust.t <= 0) finishBust();
    }
    // the cat's pistol
    if (A.hit('q')) toggleGun();
    pawGun.visible = gun.equipped && !P.car && !cuff && !bust;
    if (pawGun.visible) {
      const a = cat.userData.arms[1];
      if (gun.aimT > 0) { a.rotation.x = -1.5; a.rotation.z = 0.08; } else { a.rotation.x = Math.min(a.rotation.x, -0.25); }
    }
    setStyle(gunBtn, 'display', A.isTouch && gun.has ? 'block' : 'none');
    setText(gunBtn, gun.equipped ? 'PAW' : 'GUN');
    for (const p of pickups.slice()) {
      p.t += dt; p.m.rotation.y = p.t * 2;
      if (!P.car && Math.hypot(P.x - p.x, P.z - p.z) < 1.0) {
        scene.remove(p.m); pickups.splice(pickups.indexOf(p), 1);
        const first = !gun.has; gun.has = true; gun.ammo += p.ammo; gun.equipped = true; A.Sfx.pickup();
        A.toast(first ? `Picked up a service pistol (${gun.ammo}). ${A.isTouch ? 'PAW shoots, GUN button swaps.' : 'Click to shoot, Q to holster.'}` : `+${p.ammo} rounds (${gun.ammo})`, 3.5);
      } else if (Math.hypot(P.x - p.x, P.z - p.z) > 120) { scene.remove(p.m); pickups.splice(pickups.indexOf(p), 1); }
    }
    // effects
    for (const e of fxList.slice()) { e.t -= dt; if (e.t <= 0) { scene.remove(e.o); fxList.splice(fxList.indexOf(e), 1); } }
    // HUD
    const lv = cops.some((o) => o.state !== 'inside' && o.state !== 'out') || cruisers().length ? level() : 0;
    if (lv > levelShown && lv >= 2) { SND.radio(); if (lv >= 3) A.toast(`Dispatch: "${lv >= 4 ? 'All units, weapons free.' : 'Units are cleared to return fire.'}"`, 2.6); }
    levelShown = lv;
    let h = '';
    if (lv) h += `<div class="lvl${f ? ' b' : ''}">MAPLE GROVE PD  ${LADDER[lv]}</div>`;
    if (gun.has) h += `<div class="gun">${gun.equipped ? '▶ ' : ''}PISTOL ${gun.ammo}</div>`;
    setHTML(hud, h);
  }

  function clear() {
    for (const o of cops) { scene.remove(o.mesh); dropBar(o); }
    cops.length = 0;
    for (const c of cars.slice()) if (c.pd && c.pd.unit && c.driver !== 'player') { for (const o of c.pd.crew) scene.remove(o.mesh); A.removeCar(c); }
    dirtyCruisers();
    if (cuff) { cuff = null; setStyle(cuffUI, 'display', 'none'); }
    catCuffs.visible = false; provoked = 0; dispatched = false;
    for (const p of peds) if (p.state === 'fight') { p.state = 'walk'; p.lane = null; }
  }
  function blips() {
    const f = Math.floor(A.time() * 5) % 2, out = [];
    for (const c of cruisers()) out.push({ x: c.x, z: c.z, c: f ? '#ff3030' : '#3060ff', r: 4 });
    for (const o of cops) if (o.state !== 'inside' && o.state !== 'out') out.push({ x: o.x, z: o.z, c: '#4a7aff', r: 2.5 });
    return out;
  }
  const api = {
    update, carAI, holdPlayer, paw, pawPed, pedHook, runOver, gunInput, clear, blips, cruisers,
    armed: () => gun.equipped && !P.car, level, cops, gun, JAIL_ROOM, parked,
    giveGun(ammo = 12) { gun.has = true; gun.ammo += ammo; gun.equipped = true; },
    dropGun() { gun.has = false; gun.ammo = 0; gun.equipped = false; pawGun.visible = false; },   // any arrest or respawn strips the pistol
    get cuffing() { return !!cuff; }, get busted() { return !!bust; },
  };
  return api;
}
