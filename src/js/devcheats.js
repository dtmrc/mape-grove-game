// Dev build only (tools/dev-build.mjs): a cheats + debug panel on top of the normal game.
// Not imported by game.js; bundled as its own script and injected after the game. Reads window.__G and friends
// (window.__G.spawnCar / districtAt / hurt / addCash come from tools/devcheats-hooks.mjs).
// F4 toggles the panel; on touch, the CHEATS button. F2 / F3 / ` stay the world editor and time menu.
(() => {
  const CAR_TYPES = ['sedan', 'hatch', 'wagon', 'pickup', 'suv', 'golfcart'];
  const SPOTS = [
    ['RV (home)', 'spawn'], ['Nana', 'nana'], ['Gary', 'gary'], ['Quik Stop', 'quik'], ['Car wash', 'wash'], ['Donut Hole', 'donut'],
    ['Town green', 'green'], ['Park', 'park'], ['Police station', 'station'], ['Church', 'church'], ['Crypt', 'crypt'],
    ['Lake dock', 'dock'], ['Woods clearing', 'clearing'], ['Old well', 'well'], ['HOA lot', 'hoaLot'],
    ['North exit', 'exitNorth'], ['East exit', 'exitEast'], ['South exit', 'exitSouth'],
  ];
  const st = { open: true, god: false, noHeat: false, fuel: false, speed: 1, fps: 0, frames: 0, acc: 0 };
  try { Object.assign(st, JSON.parse(localStorage.getItem('mg-cheats') || '{}')); } catch (e) { /* storage blocked */ }
  const keep = () => { try { localStorage.setItem('mg-cheats', JSON.stringify({ open: st.open, god: st.god, noHeat: st.noHeat, fuel: st.fuel })); } catch (e) { /* storage blocked */ } };

  const css = document.createElement('style');
  css.textContent = `
#chbtn{position:fixed;top:8px;left:calc(50% + 34px);z-index:40;font:16px VT323,monospace;padding:2px 10px;background:rgba(40,10,20,.75);color:#ffb3c7;border:1px solid #7a3a52;border-radius:4px;cursor:pointer}
body.titled #chbtn,body.titled #cheats{display:none!important}
#cheats{position:fixed;top:104px;right:8px;width:min(270px,calc(100vw - 16px));max-height:calc(100vh - 140px);overflow-y:auto;z-index:44;display:none;background:rgba(14,10,18,.92);border:1px solid #6a4460;border-radius:6px;color:#efe6e8;font:12px/1.3 ui-monospace,Menlo,Consolas,monospace;padding:6px 8px 8px;user-select:none;-webkit-user-select:none}
#cheats.open{display:block}
#cheats h4{margin:8px 0 3px;font-size:10px;letter-spacing:.08em;color:#c98aa8;text-transform:uppercase;font-weight:600}
#cheats .hd{display:flex;align-items:center;gap:6px;color:#ffb3c7;font-weight:600}
#cheats .hd span{flex:1}
#cheats .row{display:flex;flex-wrap:wrap;gap:3px}
#cheats button{font:inherit;background:#22182a;color:#efe6e8;border:1px solid #5a3c58;border-radius:4px;padding:4px 6px;cursor:pointer;min-height:26px}
#cheats button.on{background:#8a2d5a;border-color:#ff7ab0;color:#fff}
#cheats select{font:inherit;background:#22182a;color:#fff;border:1px solid #5a3c58;border-radius:3px;padding:3px;flex:1}
#cheats .stats{white-space:pre;color:#bfe6c8;font-size:11px;background:rgba(0,0,0,.3);padding:4px 6px;border-radius:4px;margin-top:4px}
#cheats .keys{color:#a99aa6;font-size:11px;line-height:1.45}
#cheats kbd{background:#2e2236;border:1px solid #5a3c58;border-radius:3px;padding:0 3px;color:#fff}
#devbadge{position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:39;font:13px VT323,monospace;color:#ffb3c7;background:rgba(40,10,20,.6);padding:1px 8px;border-radius:3px;pointer-events:none;letter-spacing:.1em}`;
  document.head.appendChild(css);

  const badge = document.createElement('div'); badge.id = 'devbadge'; badge.textContent = 'DEV BUILD · F2 editor · F4 cheats · ` time'; document.body.appendChild(badge);
  const btn = document.createElement('button'); btn.id = 'chbtn'; btn.textContent = 'CHEATS'; document.body.appendChild(btn);
  const box = document.createElement('div'); box.id = 'cheats'; document.body.appendChild(box);
  ['pointerdown', 'pointerup', 'wheel', 'keydown', 'touchstart'].forEach((ev) => box.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  function toggle() { st.open = !st.open; keep(); if (st.open && document.pointerLockElement) document.exitPointerLock(); render(); }
  addEventListener('keydown', (e) => { if (e.key === 'F4') { e.preventDefault(); toggle(); } });

  const W = () => window.__G;
  function toast(t) { try { const el = document.getElementById('toast'); if (W() && W().G) console.log('[cheats]', t); if (el) { el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1600); } } catch (e) { /* ignore */ } }

  function teleport(p) {
    const A = W(); if (!A || !p) return;
    const x = p.x, z = p.z;
    if (window.__INT && window.__INT.inside) { window.__INT.exit({ to: { x, z, yaw: p.yaw || 0 }, instant: true }); return; }
    if (A.P.car) { A.P.car.x = x; A.P.car.z = z; A.P.car.speed = 0; A.P.car.vx = A.P.car.vz = 0; } else { A.P.x = x; A.P.z = z; A.P.vx = A.P.vz = 0; A.P.vy = 0; }
    if (p.yaw !== undefined) A.P.yaw = p.yaw;
  }
  function ahead(d) { const A = W(), c = A.P.car, yaw = c ? c.yaw : A.P.yaw; return { x: A.px() + Math.sin(yaw) * d, z: A.pz() + Math.cos(yaw) * d, yaw }; }

  const act = {
    cash: () => { W().addCash(1000); toast('+$1000'); },
    heal: () => { W().G.hp = 100; toast('HP full'); },
    god: () => { st.god = !st.god; keep(); toast(st.god ? 'God mode ON' : 'God mode off'); },
    noheat: () => { st.noHeat = !st.noHeat; keep(); toast(st.noHeat ? 'No wanted level ON' : 'Wanted level back on'); },
    fuel: () => { st.fuel = !st.fuel; keep(); toast(st.fuel ? 'Infinite fuel ON' : 'Infinite fuel off'); },
    clear: () => { const A = W(); A.G.heat = 0; A.G.seenT = 0; try { A.police && A.police.clear(); } catch (e) { /* ignore */ } toast('Heat cleared'); },
    hoa: () => { W().addHeat(1, 'dev cheat'); },
    pd: () => { const A = W(); A.G.heat = Math.max(3, Math.min(5, A.G.heat + 1)); A.G.seenT = 0; toast('Police heat ' + A.G.heat); },
    gun: () => { const p = W().police; if (p) { p.giveGun(30); toast('Pistol + 30 ammo'); } },
    fire: () => { if (window.__FIRE) { window.__FIRE.give('all'); toast('Fire kit: matches, newspaper, gas'); } },
    jail: () => { if (window.__JAIL) { window.__JAIL.start({ from: 'police', fine: 100 }); render(); } },
    jailEnd: () => { if (window.__JAIL && window.__JAIL.active()) window.__JAIL.end(); },
    unstuck: () => { const A = W(); if (A.P.car) { A.P.car.speed = 0; A.P.car.vx = A.P.car.vz = 0; } const p = ahead(4); teleport({ x: p.x, z: p.z }); },
    rv: () => teleport(W().places.spawn),
    save: () => { W().save(); toast('Saved'); },
    time: () => dispatchEvent(new KeyboardEvent('keydown', { key: '`', code: 'Backquote' })),
    editor: () => dispatchEvent(new KeyboardEvent('keydown', { key: 'F2' })),
    wipe: () => { if (confirm('Wipe the save in this browser (cash, missions, position)? The world edits are not touched.')) { try { localStorage.removeItem(W().SAVE_KEY); } catch (e) { /* ignore */ } location.reload(); } },
  };
  function spawnCar(type) {
    const A = W(); if (!A.spawnCar) return;
    const p = ahead(6); A.spawnCar(type, p.x, p.z, p.yaw, { fuel: 100 }); toast('Spawned ' + type);
  }
  function enterRoom(id) {
    const I = window.__INT; if (!I) return;
    if (W().P.car) { toast('Get out of the car first'); return; }
    if (I.inside) I.exit({ instant: true });
    setTimeout(() => I.enter(id, { instant: true, force: true }), 50);
  }

  function rooms() { try { return Object.keys(window.__INT.state.doors).sort(); } catch (e) { return []; } }
  function render() {
    box.classList.toggle('open', st.open);
    if (!st.open) return;
    const A = W();
    const spots = A ? SPOTS.filter(([, k]) => A.places[k]) : [];
    box.innerHTML = `<div class="hd"><span>CHEATS · DEV BUILD</span><button data-a="close">×</button></div>
<h4>Player</h4><div class="row">
<button data-a="god" class="${st.god ? 'on' : ''}">God mode</button><button data-a="heal">Heal</button><button data-a="cash">+$1000</button><button data-a="gun">Pistol</button><button data-a="fire">Fire kit</button><button data-a="unstuck">Unstuck</button></div>
<h4>Wanted</h4><div class="row">
<button data-a="noheat" class="${st.noHeat ? 'on' : ''}">No wanted</button><button data-a="clear">Clear heat</button><button data-a="hoa">+HOA star</button><button data-a="pd">+Police</button></div>
<h4>Cars</h4><div class="row">${CAR_TYPES.map((t) => `<button data-car="${t}">${t}</button>`).join('')}<button data-a="fuel" class="${st.fuel ? 'on' : ''}">Inf. fuel</button></div>
<h4>Teleport</h4><div class="row"><select data-s="tp"><option value="">Go to place…</option>${spots.map(([n, k]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
<div class="row" style="margin-top:3px"><select data-s="room"><option value="">Enter building…</option>${rooms().map((r) => `<option value="${r}">${r}</option>`).join('')}</select></div>
<h4>Events</h4><div class="row"><button data-a="jail">Start jailbreak</button><button data-a="jailEnd">End jailbreak</button></div>
<h4>Tools</h4><div class="row"><button data-a="editor">World editor (F2)</button><button data-a="time">Time menu (\`)</button><button data-a="save">Save game</button><button data-a="wipe">Wipe save</button></div>
<div class="stats" id="chstats"></div>
<h4>Keys</h4><div class="keys"><kbd>F2</kbd> dev panel · <kbd>F3</kbd> edit world · <kbd>1-9</kbd> editor tabs<br><kbd>F4</kbd> cheats · <kbd>\`</kbd> time / moon / speed<br>Console: <kbd>__G</kbd> <kbd>__JAIL</kbd> <kbd>__FIRE</kbd> <kbd>__INT</kbd> <kbd>__TOWN</kbd> <kbd>__BRK</kbd> <kbd>__MEOW</kbd></div>`;
    stats();
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !W()) return;
    if (b.dataset.a === 'close') { toggle(); return; }
    if (b.dataset.car) { spawnCar(b.dataset.car); return; }
    const f = act[b.dataset.a]; if (f) { try { f(); } catch (err) { console.warn('[cheats]', err); toast('Failed: ' + err.message); } render(); }
  });
  box.addEventListener('change', (e) => {
    const s = e.target; if (!W() || !s.value) return;
    if (s.dataset.s === 'tp') teleport(W().places[s.value]);
    if (s.dataset.s === 'room') enterRoom(s.value);
    s.value = '';
  });

  function stats() {
    const el = document.getElementById('chstats'), A = W(); if (!el || !A) return;
    const x = A.px(), z = A.pz(), c = A.P.car;
    const where = window.__INT && window.__INT.inside ? 'inside ' + window.__INT.current() : (A.districtAt ? A.districtAt(x, z) : '');
    const hh = Math.floor(A.G.clock), mm = Math.floor((A.G.clock - hh) * 60);
    el.textContent = `fps ${st.fps}   ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}\npos ${x.toFixed(1)}, ${z.toFixed(1)}  y ${(A.P.y || 0).toFixed(1)}\n${where || 'outskirts'}\nhp ${Math.round(A.G.hp)}  heat ${A.G.heat}  $${A.G.cash}${c ? `\ncar ${c.type} ${Math.round(Math.abs(c.speed) * 3.6)} km/h fuel ${Math.round(c.fuel)}` : ''}`;
  }

  let last = performance.now(), statT = 0, wasTitled = true;
  function loop(now) {
    const dt = Math.min(0.2, (now - last) / 1000); last = now;
    st.frames++; st.acc += dt; if (st.acc >= 0.5) { st.fps = Math.round(st.frames / st.acc); st.frames = 0; st.acc = 0; }
    const A = W();
    if (A && A.G) {
      if (st.god) { A.G.hp = 100; if (A.P.car) A.P.car.hp = Math.max(A.P.car.hp, 100); }
      if (st.noHeat && A.G.heat > 0) { A.G.heat = 0; A.G.seenT = 0; }
      if (st.fuel && A.P.car) A.P.car.fuel = 100;
      statT += dt; if (statT > 0.25 && st.open) { statT = 0; stats(); }
      const titled = document.body.classList.contains('titled');
      if (wasTitled && !titled) render(); // the room list fills in once the game is running
      wasTitled = titled;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  render();
})();
