// Pause menu (Esc / Start / the ⏸ touch button), settings, controls help and the full-town map (Tab / Back / MAP).
// game.js creates it once (makeUI) and ticks ui.update(dt) every frame BEFORE the simulation step, so a pause
// takes effect the same frame. All input arrives through the shared keys/pressed sets (keyboard, touch buttons
// and gamepad.js all feed those) and the menu deletes the keys it consumes, so nothing leaks into the game.
// Settings persist in one localStorage key; fx.js reads the weather flag from it at startup on its own.
import { Sfx } from './sfx.js';

export const SETTINGS_KEY = 'maple-grove-offleash-settings';
export function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') || {}; } catch (e) { return {}; } }

const TOUCH_HELP = [['Stick', 'move, or drive (push to the edge: sprint)'], ['Drag the screen', 'look around'], ['JUMP / HORN', 'jump (tap again in the air), honk'], ['PAW / BRAKE', 'paw swipe, handbrake'], ['USE', 'talk, get in or out'], ['BAG', 'fishing bag'], ['PAUSE / MAP', 'pause menu, town map']];
const PAD_HELP = [['Left stick', 'move, or drive'], ['Right stick', 'look'], ['A / Cross', 'jump, handbrake'], ['X / Square', 'paw swipe'], ['Y / Triangle', 'talk, get in or out'], ['B / Circle', 'sprint, or handbrake in a car'], ['RB / LB', 'horn, holster'], ['Start / Back', 'pause, town map'], ['D-pad', 'menus']];
const EXTRA_KEYS = [['Esc', 'pause menu'], ['Tab', 'town map'], ['I / B', 'fishing bag'], ['Q', 'holster']];
// district label spots (world metres); each is checked against districtAt at startup so a moved border just drops the label
const DISTRICT_LABELS = [['Hollow Woods', -130, 40], ["Nana's Place", -98, 28], ['Chapel Hill', -85, -24], ['Maple Grove Estates', -80, -85], ['Lake Juniper', -18, 95], ['Maple Grove High', 100, -60], ['Old Mill Farm', 16, -90], ['Pine Hollow', 95, 70], ['Downtown Maple Grove', 0, 0]];
const LEGEND = [['#fff', 'You'], ['#5fd0ff', 'RV (save)'], ['#ffd23f', 'Job'], ['#ff3b6b', 'Waypoint'], ['#7fe07f', 'Quik Stop gas'], ['#3a78c8', 'Suds N Paws'], ['#3ab0a0', "Earl's Bait & Tackle"], ['#1e2a44', 'Maple Grove PD']];

export function makeUI(o) {
  const { G, P, keys, pressed, touch, hit, fx, mapImg, MAP_HALF, places, giverMarks, districtAt, isTouch, RES, getRes, setRes, setInvert, toast, px, pz, yaw, mission, dev } = o;
  const S = { sound: true, res: getRes(), weather: !!fx.weatherOn, invert: false, dev: false, ...loadSettings() };
  if (!RES[S.res]) S.res = getRes();
  const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } };
  const titled = () => document.body.classList.contains('titled');
  const bagOpen = () => !!(window.__G && window.__G.fishing && window.__G.fishing.menuOpen());

  // ---------- apply persisted settings ----------
  if (Sfx.isOn() !== !!S.sound) Sfx.toggle();
  fx.mute(!S.sound); window.__pdMute = !S.sound;
  if (S.res !== getRes()) setRes(S.res);
  fx.setWeather(!!S.weather);
  setInvert(!!S.invert);
  function markDev() {
    for (const b of document.querySelectorAll('#title .card button')) if (b.textContent === 'WORLD EDITOR') b.classList.add('devonly');
    for (const r of document.querySelectorAll('#title table tr')) if (r.cells[0] && r.cells[0].textContent === '`') r.classList.add('devonly');
    document.body.classList.toggle('nodev', !S.dev);
  }
  markDev();

  // ---------- DOM ----------
  const pause = document.createElement('div'); pause.id = 'pause'; document.body.appendChild(pause);
  const bigmap = document.createElement('div'); bigmap.id = 'bigmap';
  bigmap.innerHTML = `<div class="card"><h1>MAPLE GROVE</h1><canvas></canvas><div class="legend">${LEGEND.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div><div class="item" data-a="close">CLOSE</div><div class="hint">${isTouch ? '' : 'Tab or Esc closes'}</div></div>`;
  document.body.appendChild(bigmap);
  const mcv = bigmap.querySelector('canvas'), mctx = mcv.getContext('2d');
  for (const el of [pause, bigmap]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  bigmap.querySelector('.item').addEventListener('click', () => setMap(false));
  // the title card's own key table is the desktop controls list
  const keyRows = () => [...document.querySelectorAll('#title table tr')].filter((r) => !r.classList.contains('devonly')).map((r) => [r.cells[0].textContent, r.cells[1].textContent]).concat(EXTRA_KEYS);
  const table = (rows) => `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
  const SETTINGS = [
    { k: 'sound', label: 'Sound', vals: [true, false], text: (v) => (v ? 'ON' : 'OFF') },
    { k: 'res', label: 'Render height', vals: RES.map((_, i) => i), text: (v) => `${RES[v]}p` },
    { k: 'weather', label: 'Weather', vals: [false, true], text: (v) => (v ? 'ON' : 'OFF') },
    { k: 'invert', label: 'Invert look', vals: [false, true], text: (v) => (v ? 'ON' : 'OFF') },
    { k: 'dev', label: 'Dev tools', vals: [false, true], text: (v) => (v ? 'SHOWN' : 'HIDDEN') },
  ];
  const M = { open: false, view: 'main', sel: 0, map: false, mapT: 0, tabHold: false, items: [] };
  function render() {
    let h = '<div class="card"><h1>PAUSED<span>OFF LEASH</span></h1>';
    if (M.view === 'main') h += ['RESUME', 'CONTROLS', 'SETTINGS', 'RETURN TO TITLE'].map((t) => `<div class="item" data-a="${t}">${t}</div>`).join('');
    else if (M.view === 'controls') h += `<div class="cols"><div><h2>KEYBOARD</h2>${table(keyRows())}</div><div><h2>TOUCH</h2>${table(TOUCH_HELP)}</div><div><h2>GAMEPAD</h2>${table(PAD_HELP)}</div></div><div class="item" data-a="BACK">BACK</div>`;
    else h += SETTINGS.map((s) => `<div class="item set" data-k="${s.k}"><span>${s.label}</span><b>&lt; ${s.text(S[s.k])} &gt;</b></div>`).join('') + '<div class="item" data-a="BACK">BACK</div>';
    h += `<div class="hint">${isTouch ? 'Tap an item' : 'W/S or arrows choose · Enter or E confirm · Esc back'}</div></div>`;
    pause.innerHTML = h; pause.classList.toggle('wide', M.view === 'controls');
    M.items = [...pause.querySelectorAll('.item')];
    M.sel = Math.max(0, Math.min(M.items.length - 1, M.sel));
    M.items.forEach((el, i) => el.classList.toggle('sel', i === M.sel));
  }
  pause.addEventListener('click', (e) => { const it = e.target.closest('.item'); if (!it) return; M.sel = M.items.indexOf(it); activate(it, 1); });
  function setView(v) { M.view = v; M.sel = 0; render(); Sfx.blip(520); }
  function change(k, dir) {
    const s = SETTINGS.find((x) => x.k === k), i = s.vals.indexOf(S[k]), v = s.vals[(i + dir + s.vals.length) % s.vals.length];
    S[k] = v; save(); Sfx.blip(660);
    if (k === 'sound') { if (Sfx.isOn() !== v) Sfx.toggle(); fx.mute(!v); window.__pdMute = !v; }
    if (k === 'res') setRes(v);
    if (k === 'weather') fx.setWeather(v);
    if (k === 'invert') setInvert(v);
    if (k === 'dev') { markDev(); toast(v ? 'Dev tools shown: F2 panel, F3 editor, ` time menu' : 'Dev tools hidden (shortcuts still work)', 3); }
    render();
  }
  function activate(it, dir = 1) {
    if (!it) return;
    if (it.dataset.k) return change(it.dataset.k, dir);
    const a = it.dataset.a;
    if (a === 'RESUME') setPaused(false);
    else if (a === 'CONTROLS') setView('controls');
    else if (a === 'SETTINGS') setView('settings');
    else if (a === 'BACK') setView('main');
    else if (a === 'RETURN TO TITLE') location.reload();
  }
  function setPaused(on) {
    if (on === M.open) return;
    if (on && M.map) setMap(false);
    M.open = on; pause.classList.toggle('open', on); document.body.classList.toggle('menu', on || M.map);
    if (on) { G.paused = true; try { document.exitPointerLock?.(); } catch (e) { /* ignore */ } M.view = 'main'; M.sel = 0; render(); Sfx.blip(520); }
    else { G.paused = false; P.lock = Math.max(P.lock || 0, 0.3); Sfx.blip(440); }
  }
  function setMap(on) {
    if (on === M.map) return;
    if (on && M.open) return;
    M.map = on; bigmap.classList.toggle('open', on); G.paused = on; document.body.classList.toggle('menu', on || M.open);
    if (on) { try { document.exitPointerLock?.(); } catch (e) { /* ignore */ } fitMap(); drawBig(); Sfx.blip(520); } else { P.lock = Math.max(P.lock || 0, 0.3); Sfx.blip(440); }
  }
  function fitMap() { const s = Math.max(180, Math.min(innerWidth - 40, innerHeight - 190)); if (mcv.width !== s) mcv.width = mcv.height = s; }
  const labels = DISTRICT_LABELS.filter(([n, x, z]) => !districtAt || districtAt(x, z) === n);
  function drawBig() {
    const W = mcv.width, k = W / (2 * MAP_HALF), X = (x) => (x + MAP_HALF) * k, g = mctx, t = performance.now() / 1000;
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, W); g.drawImage(mapImg, 0, 0, W, W);
    const fs = Math.max(11, Math.round(W / 42));
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = `${fs}px VT323, monospace`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.fillStyle = '#f4efe0';
    for (const [n, x, z] of labels) { g.strokeText(n.toUpperCase(), X(x), X(z)); g.fillText(n.toUpperCase(), X(x), X(z)); }
    const dot = (x, z, col, r, txt, tcol = '#000') => {
      g.fillStyle = col; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(X(x), X(z), r, 0, 7); g.fill(); g.stroke();
      if (txt) { g.fillStyle = tcol; g.font = `bold ${Math.round(r * 1.3)}px monospace`; g.fillText(txt, X(x), X(z) + 1); }
    };
    const r = Math.max(5, W / 90);
    if (places.quik) dot(places.quik.x + 3, places.quik.z + 7.5, '#7fe07f', r, 'G');
    if (places.wash) dot(places.wash.x, places.wash.z, '#3a78c8', r, 'W', '#fff');
    dot(-73.8, 55.2, '#3ab0a0', r, 'B'); // Earl's bait shop (fishing.js SHOP.mark)
    if (places.station) dot(places.station.x, places.station.z, '#1e2a44', r, 'PD', '#fff');
    if (!mission()) for (const [id, m] of Object.entries(giverMarks)) if (m.visible) dot(m.position.x, m.position.z, '#ffd23f', r * 1.1, id[0].toUpperCase());
    dot(places.rv.x, places.rv.z, '#5fd0ff', r, 'H');
    if (G.check) dot(G.check.x, G.check.z, G.check.col || '#ff3b6b', r * (1 + 0.3 * Math.sin(t * 6)), '!', '#fff');
    g.save(); g.translate(X(px()), X(pz())); g.rotate(-yaw() + Math.PI); g.scale(r / 5, r / 5);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 2.5); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  // touch buttons (index.html #menubtns): on click, not pointerdown, so the tap's click can't land on the overlay that opens under the finger
  document.getElementById('pausebtn')?.addEventListener('click', () => { if (!titled()) setPaused(!M.open); });
  document.getElementById('mapbtn')?.addEventListener('click', () => { if (!titled()) setMap(!M.map); });
  // key defaults the browser would otherwise act on (Tab focus walk, Space/Enter clicking a focused button)
  addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Escape' || (M.open && (e.key === ' ' || e.key === 'Enter'))) e.preventDefault(); });
  addEventListener('resize', () => { if (M.map) { fitMap(); drawBig(); } });

  const eat = (...k) => { for (const x of k) pressed.delete(x); };
  return {
    get open() { return M.open || M.map; },
    get paused() { return M.open; },
    get mapOpen() { return M.map; },
    settings: S,
    togglePause() { if (!titled()) setPaused(!M.open); },
    toggleMap() { if (!titled()) setMap(!M.map); },
    update(dt) {
      // keep the file in step with the P (resolution) and M (sound) hotkeys
      if (getRes() !== S.res) { S.res = getRes(); save(); }
      if (Sfx.isOn() !== !!S.sound) { S.sound = Sfx.isOn(); window.__pdMute = !S.sound; save(); }
      if (titled()) return;
      if (M.open) {
        if (hit('escape', 'q')) { if (M.view === 'main') setPaused(false); else setView('main'); }
        else if (hit('w', 'arrowup')) { M.sel = (M.sel - 1 + M.items.length) % M.items.length; render(); Sfx.blip(440); }
        else if (hit('s', 'arrowdown')) { M.sel = (M.sel + 1) % M.items.length; render(); Sfx.blip(440); }
        else if (hit('a', 'arrowleft')) { if (M.items[M.sel] && M.items[M.sel].dataset.k) activate(M.items[M.sel], -1); }
        else if (hit('d', 'arrowright')) { if (M.items[M.sel] && M.items[M.sel].dataset.k) activate(M.items[M.sel], 1); }
        else if (hit('e', 'f', 'enter', ' ', 'punch')) activate(M.items[M.sel], 1);
        eat('escape', 'q', 'e', 'f', 'enter', ' ', 'punch', 'w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab');
        return;
      }
      if (M.map) {
        drawBig();
        // a Tab tap toggles the map, a Tab hold (wall clock, not the capped frame dt) closes it on release
        if (hit('tab', 'escape', 'q') || (M.tabHold && !keys.has('tab') && performance.now() - M.mapT > 450)) setMap(false);
        if (!keys.has('tab')) M.tabHold = false;
        eat('tab', 'escape', 'q');
        return;
      }
      if (hit('escape') && !bagOpen() && !(dev && dev().editing)) { setPaused(true); eat('escape'); }
      else if (hit('tab') && !bagOpen() && !(dev && dev().editing)) { setMap(true); M.mapT = performance.now(); M.tabHold = true; eat('tab'); }
    },
  };
}
