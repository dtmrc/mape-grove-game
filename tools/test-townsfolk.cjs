// Headless checks for src/js/townsfolk.js: church parishioners + diner staff/patrons, talk hotspots, bubbles, ordering.
// Usage: node tools/test-townsfolk.cjs <dist/index.html> [shots-dir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2]), shots = process.argv[3] || path.join(path.dirname(file), '..');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__G && window.__G.scene && window.__INT && window.__TOWN, null, { timeout: 90000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = (n = 1) => ev(async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
  let fails = 0;
  const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); if (!ok) fails++; };
  const shot = (name) => page.screenshot({ path: path.join(shots, name), timeout: 180000 });
  const dismiss = async () => { for (let i = 0; i < 12; i++) { if (!(await ev(() => !!window.__G.G.dialog))) break; await page.keyboard.press('e'); await step(1); } await ev(() => { window.__G.P.lock = 0; }); };
  const at = (x, z, yaw) => ev(([x, z, yaw]) => { const r = window.__INT.state.room; const P = window.__G.P; P.x = r.origin.x + x; P.z = r.origin.z + z; P.lock = 0; if (yaw !== undefined) { P.yaw = yaw; } }, [x, z, yaw]);
  const cam = (yaw, pitch) => ev(([y, p]) => window.__G.setCam(y, p), [yaw, pitch]);

  await ev(() => document.getElementById('start').click());
  await step(1); await dismiss();
  await ev(() => { const G = window.__G.G; G.cash = 40; G.hp = 40; window.__G.fishing.S.hunger = 30; G.clock = 19; });

  // ---------- church ----------
  await ev(async () => { await window.__INT.ready; await window.__TOWN.ready; window.__INT.enter('church', { instant: true }); });
  await step(3);
  let st = await ev(() => window.__TOWN.state);
  const ch = st.rooms.church;
  check('church has 6 parishioners', ch && ch.npcs.length === 6, JSON.stringify(ch && ch.npcs.map((n) => n.id + ':' + n.pose)));
  check('kneelers kneel', ch && ch.npcs.filter((n) => n.pose === 'kneel').length === 5);
  check('talk hotspots added', ch && ['parish-dolores', 'parish-walt', 'parish-family', 'parish-marcus'].every((s) => ch.spots.includes(s)), JSON.stringify(ch && ch.spots));
  await at(0, 6.4, Math.PI); await cam(0, 0.32); await step(4);
  await ev(() => { window.__TOWN.say('church', 'tyler', 'Mom. MOM. There\'s a cat.'); window.__TOWN.say('church', 'dolores', '...and bless Gary. Lord knows he needs it.'); });
  await step(3); await shot('town-church.png');
  // Dolores: blessing (hp < 100, once a day)
  await at(-0.62, -1.0); await step(1);
  await ev(() => window.__INT.use()); await step(1);
  const dlg = await ev(() => document.getElementById('dialog').textContent);
  check('E at Dolores opens her dialog', /Dolores/.test(dlg), dlg.slice(0, 80));
  await dismiss(); await step(1);
  check('blessing restores health', (await ev(() => window.__G.G.hp)) === 100);
  await at(-0.1, -0.2, Math.PI); await cam(Math.PI * 0.85, 0.25); await step(6); await shot('town-church-close.png');
  // Walt: $5 once a day
  const c0 = await ev(() => window.__G.G.cash);
  await at(0.62, 0.3); await step(1); await ev(() => window.__INT.use()); await step(1); await dismiss();
  check('Walt gives $5', (await ev(() => window.__G.G.cash)) === c0 + 5);
  await at(0.62, 0.3); await step(1); await ev(() => window.__INT.use()); await step(1); await dismiss();
  check('...only once a day', (await ev(() => window.__G.G.cash)) === c0 + 5);
  // reaction: paw swipe next to Marcus
  await at(-0.3, -2.4); await ev(() => { window.__G.P.punch = 0.3; }); await step(3);
  st = await ev(() => window.__TOWN.state);
  check('paw swipe gets a reaction', st.log.some((l) => /church:\w+: (Not in|Goodness|Easy)/.test(l)), st.log.slice(-3).join(' | '));
  await ev(() => window.__INT.exit({ instant: true })); await step(2);

  // ---------- diner ----------
  await ev(() => window.__INT.enter('diner', { instant: true })); await step(3);
  st = await ev(() => window.__TOWN.state);
  const dn = st.rooms.diner;
  check('diner has Darlene + 6 patrons', dn && dn.npcs.length === 7, JSON.stringify(dn && dn.npcs.map((n) => n.id + ':' + n.pose)));
  await at(1.5, 2.6, Math.PI); await cam(0.15, 0.3); await step(30);
  await ev(() => { window.__TOWN.say('diner', 'hank', 'Highway 9\'s closed both ways. I\'m on my fourth pie.'); window.__TOWN.say('diner', 'darlene', 'Sit anywhere, hon!'); });
  await step(3); await shot('town-diner.png');
  // order at the booth: Darlene comes over and opens the pad
  await at(-4.2, 0.5); await step(1);
  await ev(() => window.__INT.use()); await step(1);
  check('booth calls Darlene', (await ev(() => window.__TOWN.state.orders.length)) === 1);
  await ev(() => { const d = window.__TOWN.S.rooms.diner.npcs.darlene; d.task = null; d.path = []; d.x = -3.6; d.z = -0.62; });
  for (let i = 0; i < 40 && !(await ev(() => window.__G.fishing.menuOpen())); i++) await step(2);
  const menu = await ev(() => [...document.querySelectorAll('#fishui .row')].map((r) => r.textContent));
  if (!menu.length) console.log('debug', JSON.stringify(await ev(() => { const d = window.__TOWN.S.rooms.diner.npcs.darlene, P = window.__G.P, r = window.__INT.state.room; return { d: [d.x, d.z, d.pose, d.task, d.path], cat: [P.x - r.origin.x, P.z - r.origin.z], orders: window.__TOWN.state.orders, dialog: window.__G.G.dialog, fish: window.__G.fishing.S.fish && window.__G.fishing.S.fish.st, log: window.__TOWN.state.log }; })));
  check('Darlene opens the order pad', menu.some((r) => /Tuna melt/.test(r)) && menu.some((r) => /Paying with/.test(r)), menu.join(' / '));
  await shot('town-diner-menu.png');
  // pay with fish
  await ev(() => { const F = window.__G.fishing; F.give ? (F.give('trout'), F.give('bluegill')) : 0; });
  const fishBefore = await ev(() => { const F = window.__G.fishing; return F.countFish('trout') + F.countFish('bluegill'); });
  await ev(() => { window.__TOWN.S.pay = 'fish'; });
  const belly0 = await ev(() => window.__G.fishing.S.hunger);
  const okFish = await ev(() => { const R = window.__TOWN.S; const o = R.orders[0]; return !!o; });
  await ev(() => { const rows = [...document.querySelectorAll('#fishui .row')]; const i = rows.findIndex((r) => /Short stack/.test(r.textContent)); rows[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); const r2 = [...document.querySelectorAll('#fishui .row')][i]; r2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await step(2);
  let o = await ev(() => window.__TOWN.state.orders);
  if (!o.length || o[0].st !== 'placed') { await ev(() => { window.__G.fishing.closeMenu(); }); await step(2); await ev(() => window.__TOWN.order('stack', 'fish')); o = await ev(() => window.__TOWN.state.orders); }
  check('fish order placed', fishBefore >= 2 && okFish && (await ev(() => window.__TOWN.S.ordered)) >= 1, JSON.stringify({ fishBefore, o }));
  // fast-forward the kitchen: Darlene picks up at the pass and brings it over
  const t0 = await ev(() => window.__G.G.time);
  for (let i = 0; i < 400 && (await ev(() => (window.__TOWN.S.served || 0))) === 0 && (await ev(() => window.__G.G.time)) - t0 < 60; i++) {
    await step(5);
    if (i % 20 === 0) console.log('  darlene', JSON.stringify(await ev(() => { const d = window.__TOWN.S.rooms.diner.npcs.darlene; return { t: +window.__G.G.time.toFixed(1), x: +d.x.toFixed(2), z: +d.z.toFixed(2), pose: d.pose, task: d.task && (d.task.then || d.task.kind), path: d.path.length, orders: window.__TOWN.state.orders }; })));
  }
  check('order served at the booth', (await ev(() => window.__TOWN.S.served)) === 1);
  const belly1 = await ev(() => window.__G.fishing.S.hunger);
  check('food filled the belly', belly1 > belly0 + 20, `${belly0} -> ${belly1}`);
  // cash path through the API
  const cash0 = await ev(() => window.__G.G.cash);
  await ev(() => window.__TOWN.order('pie', 'cash'));
  check('cash order takes $4', (await ev(() => window.__G.G.cash)) === cash0 - 4);
  await ev(() => { window.__G.G.cash = 0; });
  check('no cash, no pie', !(await ev(() => window.__TOWN.order('pie', 'cash'))));
  await at(-3.4, 1.2, -Math.PI * 0.75); await cam(-Math.PI * 0.3, 0.3); await step(8); await shot('town-diner-booth.png');
  // walk out mid-order: the paid order is boxed to go
  await ev(() => window.__INT.exit({ instant: true })); await step(2);
  check('orders cleared on exit', (await ev(() => window.__TOWN.state.orders.length)) === 0);
  st = await ev(() => window.__TOWN.state);
  check('no townsfolk errors', !st.errors.length, st.errors.join(' | '));
  check('no page errors', !errors.length, errors.slice(0, 3).join(' | '));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
