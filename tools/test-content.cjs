// Headless checks for the economy / content package (src/js/shops.js, src/js/jobs.js).
// Usage: node tools/test-content.cjs <dist/index.html> [shots-dir]
// Drives state through window.__G / window.__INT and steps frames explicitly (software GL runs at a few fps), so a
// run takes a minute or two. Writes shop-menu.png and sign-prop.png to shots-dir (default: next to the html).
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
  await page.waitForFunction(() => window.__G && window.__G.scene && window.__G.shops && window.__G.jobs, null, { timeout: 90000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = (n = 1) => ev(async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
  const results = []; let fails = 0;
  const check = (name, ok, info = '') => { const line = `${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`; results.push(line); console.log(line); if (!ok) fails++; };
  const shot = (name) => page.screenshot({ path: path.join(shots, name), timeout: 180000 });
  const dismiss = async () => { for (let i = 0; i < 12; i++) { if (!(await ev(() => !!window.__G.G.dialog))) break; await page.keyboard.press('e'); await step(1); } await ev(() => { window.__G.P.lock = 0; }); };
  // E exits a car only when P.lock has run out (dialogs set it), so retry until on foot
  const onFoot = async () => { for (let i = 0; i < 6; i++) { if (!(await ev(() => !!window.__G.P.car))) return; await ev(() => { window.__G.P.lock = 0; const c = window.__G.P.car; c.x = window.__G.places.rv.x + 12; c.z = window.__G.places.rv.z + 12; }); await page.keyboard.press('e'); await step(1); } };

  await ev(() => document.getElementById('start').click());
  await step(1); await dismiss();
  await ev(() => { const G = window.__G.G; G.cash = 100; G.hp = 50; window.__G.fishing.S.hunger = 40; });

  // ---------- 1. Quik Stop counter through the interiors hotspot path ----------
  await ev(async () => { await window.__INT.ready; window.__INT.enter('quik', { instant: true }); });
  await step(2);
  let st = await ev(() => window.__INT.state);
  check('entered Quik Stop', st.inside && st.id === 'quik', JSON.stringify(st.room && st.room.spots));
  await ev(() => { const r = window.__INT.state.room; window.__G.P.x = r.origin.x - 3.2; window.__G.P.z = r.origin.z; window.__G.P.lock = 0; document.getElementById('toast').textContent = ''; window.__INT.use(); });
  await step(1);
  let s1 = await ev(() => ({ open: window.__G.fishing.menuOpen(), toast: document.getElementById('toast').textContent, rows: [...document.querySelectorAll('#fishui .row')].map((r) => r.textContent), title: (document.querySelector('#fishui h3') || {}).textContent }));
  check('counter hotspot opens the shop menu (no flavour toast)', s1.open && !/squints/.test(s1.toast) && /Quik Stop/.test(s1.title), JSON.stringify(s1));
  await shot('shop-menu.png');
  await ev(() => window.__G.shops.buy('quik', 'tuna'));
  let s2 = await ev(() => ({ cash: window.__G.G.cash, hp: window.__G.G.hp, belly: window.__G.fishing.S.hunger }));
  check('tuna: -$5, +35 hp, +20 belly', s2.cash === 95 && s2.hp === 85 && Math.abs(s2.belly - 60) < 0.3, JSON.stringify(s2));
  await ev(() => { window.__G.G.cash = 1; });
  check('tuna refused without cash', !(await ev(() => window.__G.shops.buy('quik', 'tuna'))) && (await ev(() => window.__G.G.cash)) === 1);
  await ev(() => { window.__G.G.cash = 500; });
  const lotto = await ev(() => { const G = window.__G.G; let wins = 0; for (let i = 0; i < 40; i++) { const c = G.cash; window.__G.shops.buy('quik', 'lotto'); if (G.cash > c - 2) wins++; } return { wins, cash: G.cash }; });
  check('40 scratchers cost $2 each (wins possible)', lotto.cash >= 500 - 80 && lotto.cash <= 500 - 80 + 40 * 500, JSON.stringify(lotto));
  await ev(() => { window.__G.shops.buy('quik', 'slurpee'); });
  check('slurpee sets a 10 s zoomies boost', (await ev(() => window.__G.shops.S.boost)) > 9);
  await ev(() => window.__G.fishing.closeMenu());
  // flavour toast still works for an unhandled spot
  await ev(() => { const r = window.__INT.state.room; window.__G.P.x = r.origin.x + 3.6; window.__G.P.z = r.origin.z - 1.6; window.__G.P.lock = 0; window.__INT.use(); });
  await step(1);
  check('slushie hotspot keeps its flavour toast', /BRAIN FREEZE/.test(await ev(() => document.getElementById('toast').textContent)));
  await ev(() => window.__INT.exit({ instant: true })); await step(2);

  // ---------- 2. diner coffee, RV bowl + bed, Nana's casserole (handler direct) ----------
  const d1 = await ev(() => { const G = window.__G.G; G.clock = 10.25; G.cash = 50; window.__G.shops.buy('diner', 'coffee'); return { clock: G.clock, cash: G.cash }; });
  check('coffee passes an hour', Math.abs(d1.clock - 11.25) < 1e-6 && d1.cash === 48, JSON.stringify(d1));
  const d2 = await ev(() => { const F = window.__G.fishing; F.S.hunger = 30; const a = window.__G.shops.use('rv', 'bowl'); const h1 = F.S.hunger; const b = window.__G.shops.use('rv', 'bowl'); return { a, b, h1, h2: F.S.hunger, toast: document.getElementById('toast').textContent }; });
  check('kibble bowl feeds +25 once, then cooldown', d2.a && d2.b && d2.h1 === 55 && d2.h2 === 55 && /Refills/.test(d2.toast), JSON.stringify(d2));
  const d3 = await ev(() => { const G = window.__G.G; G.clock = 23.5; G.hp = 20; G.heat = 0; const a = window.__G.shops.use('rv', 'bed'); return { a, clock: G.clock, hp: G.hp, toast: document.getElementById('toast').textContent }; });
  check('RV bed at night: 7:00, hp 100, saved', d3.a && d3.clock === 7 && d3.hp === 100 && /7:00/.test(d3.toast), JSON.stringify(d3));
  const d4 = await ev(() => { const G = window.__G.G; G.heat = 1; const a = window.__G.shops.use('rv', 'bed'); G.heat = 0; return a; });
  check('RV bed with heat is left to interiors', d4 === false);
  const d5 = await ev(() => { const F = window.__G.fishing, G = window.__G.G; F.S.hunger = 10; G.hp = 50; const a = window.__G.shops.use('nana', 'casserole'); const h1 = F.S.hunger, hp1 = G.hp; const b = window.__G.shops.use('nana', 'casserole'); return { a, b, h1, hp1, h2: F.S.hunger, toast: document.getElementById('toast').textContent }; });
  check('casserole: +60 belly +30 hp once per day', d5.a && d5.b && d5.h1 === 70 && d5.hp1 === 80 && d5.h2 === 70 && /Tomorrow/.test(d5.toast), JSON.stringify(d5));

  // ---------- 3. Suds N Paws repair / respray at 0 stars ----------
  await onFoot();
  await ev(() => { const W = window.__G, G = W.G; const c = W.cars.find((q) => !q.driver && !q.dead && !q.role); W.enterCar(c, true); c.x = W.places.wash.x; c.z = W.places.wash.z; c.vx = c.vz = c.speed = 0; c.hp = 40; G.heat = 0; G.cash = 100; W.P.lock = 0; });
  await step(2);
  const w1 = await ev(() => document.getElementById('toast').textContent);
  check('wash bay offers Repair $30', /Repair \$30/.test(w1), w1);
  await page.keyboard.press('e'); await step(2);
  const w2 = await ev(() => ({ inCar: !!window.__G.P.car, hp: window.__G.P.car && window.__G.P.car.hp, cash: window.__G.G.cash }));
  check('E repairs to 100 for $30 and stays in the car', w2.inCar && w2.hp === 100 && w2.cash === 70, JSON.stringify(w2));
  const col0 = await ev(() => window.__G.P.car.mesh.userData.paint.color.getHex());
  let w3 = '';
  for (let i = 0; i < 8 && !/Respray/.test(w3); i++) { await ev(() => { window.__G.shops.S.washT = 0; }); await step(1); w3 = await ev(() => document.getElementById('toast').textContent); }
  check('full hp offers Respray $20', /Respray \$20/.test(w3), w3);
  await page.keyboard.press('e'); await step(2);
  const w4 = await ev(() => ({ col: window.__G.P.car.mesh.userData.paint.color.getHex(), cash: window.__G.G.cash, inCar: !!window.__G.P.car }));
  check('E resprays (paint colour changes) for $20', w4.inCar && w4.col !== col0 && w4.cash === 50, JSON.stringify(w4));
  await ev(() => { const c = window.__G.P.car; c.x = window.__G.places.rv.x + 12; c.z = window.__G.places.rv.z + 12; });
  await step(1); await page.keyboard.press('e'); await step(2);
  check('E outside the bay exits the car', !(await ev(() => !!window.__G.P.car)));

  // ---------- 4. Fish Order ----------
  await onFoot();
  await ev(() => { window.__G.G.cash = 0; window.__G.jobs.start('fish'); });
  await step(1);
  const f1 = await ev(() => ({ id: window.__G.mission && window.__G.mission.id, obj: document.getElementById('objective').textContent, check: window.__G.G.check }));
  check('Fish Order starts, waypoint at the dock', f1.id === 'fish' && /bass/.test(f1.obj) && f1.check && /dock/i.test(f1.check.label), JSON.stringify(f1));
  await ev(() => { for (let i = 0; i < 3; i++) window.__G.fishing.give('bass'); });
  await step(2);
  const f2 = await ev(() => ({ stage: window.__G.mission.stage, label: window.__G.G.check && window.__G.G.check.label }));
  check('3 bass flips the waypoint to the diner', f2.stage === 'return' && /Rosie/.test(f2.label), JSON.stringify(f2));
  await ev(() => { window.__G.P.x = 29.5; window.__G.P.z = 12.4; });
  await step(3);
  const f3 = await ev(() => ({ mission: window.__G.mission, cash: window.__G.G.cash, bass: window.__G.fishing.countFish('bass'), jobs: window.__G.jobs.S.jobs, done: window.__G.G.done.fish, banner: document.getElementById('banner').textContent }));
  check('Fish Order passes: +$90, fish taken, repeatable', !f3.mission && f3.cash === 90 && f3.bass === 0 && f3.jobs.fish === 1 && !f3.done && /PASSED/.test(f3.banner), JSON.stringify(f3));

  // ---------- 5. Casserole Run replay at half pay ----------
  await ev(() => { window.__G.G.done.nana = true; window.__G.G.cash = 0; window.__G.talkTo('nana'); });
  const r1 = await ev(() => window.__G.G.dialog && window.__G.G.dialog.lines.map((l) => l[1]).join(' | '));
  check('done Nana offers "Run it again? (half pay)"', /Run it again\? \(half pay: \$75/.test(r1 || ''), r1);
  await dismiss(); await step(1);
  const r2 = await ev(() => window.__G.mission && { id: window.__G.mission.id, reward: window.__G.mission.reward });
  check('replay starts with reward halved', r2 && r2.id === 'nana' && r2.reward === 75, JSON.stringify(r2));
  await ev(() => { const m = window.__G.mission, W = window.__G; W.enterCar(m.car, true); m.stage = 'drive'; m.timer = 100; m.stops = [{ x: m.car.x, z: m.car.z, who: 'the Testers' }]; m.car.speed = 0; });
  await step(3);
  const r3 = await ev(() => ({ mission: window.__G.mission, cash: window.__G.G.cash }));
  check('replay pass pays $75 (+$10 tip)', !r3.mission && r3.cash === 85, JSON.stringify(r3));
  await onFoot();

  // ---------- 6. race best time ----------
  await ev(() => { window.__G.jobs.run('kids', true); });
  await step(1);
  await ev(() => { const m = window.__G.mission; m.count = 0; m.cp = m.cps.length - 1; m.t = 40; const c = m.cps[m.cp]; m.car.x = c.x; m.car.z = c.z; });
  await step(3);
  const k1 = await ev(() => ({ mission: window.__G.mission, best: window.__G.G.best.kids }));
  check('race pass records G.best.kids', !k1.mission && k1.best > 35 && k1.best < 38, JSON.stringify(k1));
  await onFoot();

  // ---------- 7. Gary pass -> truce, banner, FOR SALE sign ----------
  await ev(() => { const G = window.__G.G; G.done.kids = G.done.ricky = true; window.__G.jobs.run('gary', false); });
  await step(1);
  await ev(() => { window.__G.mission.cart.dead = true; });
  await step(2);
  const g1 = await ev(() => { const W = window.__G, G = W.G; return { mission: W.mission, done: !!G.done.gary, truce: W.jobs.truce(), forsale: W.jobs.S.forsale, heat: G.heat, line: W.jobs.S.forsale && document.getElementById('banner').textContent }; });
  check('Gary pass: G.done.gary, 24 h truce, FOR SALE flag', !g1.mission && g1.done && g1.truce > 1400 && g1.forsale && g1.heat === 0, JSON.stringify(g1));
  await ev(() => { window.__G.jobs.S.pendingBanner = 0.001; });
  await step(2);
  check('banner THE RV STAYS', /THE RV STAYS/.test(await ev(() => document.getElementById('banner').textContent)));
  await ev(() => { window.__G.talkTo('gary'); });
  const g2 = await ev(() => window.__G.G.dialog && window.__G.G.dialog.lines.map((l) => l[1]).join(' | '));
  check("Gary's done line changed", /listed the house/.test(g2 || ''), g2);
  await dismiss(); await step(1);
  await ev(() => { const W = window.__G; if (W.mission) { W.mission.cart.dead = true; } });
  await step(2);
  await ev(() => { window.__G.jobs.S.pendingBanner = 0; document.getElementById('banner').className = ''; });
  // truce blocks spawnPatrol
  await ev(() => { const G = window.__G.G; G.hoaTruce = G.time + 1e6; G.heat = 1; G.seenT = 0; });
  for (let i = 0; i < 30; i++) { await step(1); await ev(() => { window.__G.G.seenT = 0; }); }
  const g3 = await ev(() => ({ patrols: window.__G.patrols().length, heat: window.__G.G.heat }));
  check('no HOA patrols spawn during the truce (30 frames at 1 star)', g3.patrols === 0 && g3.heat === 1, JSON.stringify(g3));
  await ev(() => { window.__G.G.hoaTruce = 0; });
  let spawned = 0;
  for (let i = 0; i < 120 && !spawned; i++) { await step(1); spawned = await ev(() => { window.__G.G.seenT = 0; return window.__G.patrols().length; }); }
  check('patrols spawn again once the truce ends', spawned > 0, `${spawned}`);
  await ev(() => { const W = window.__G; W.G.heat = 0; for (const c of W.patrols()) c.dead = true; });
  // screenshot of the FOR SALE sign
  await onFoot();
  await ev(() => { const W = window.__G, g = W.places.gary; const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw), rx = Math.cos(g.yaw), rz = -Math.sin(g.yaw); W.P.x = g.x + fx * 7.5 + rx * 4.2; W.P.z = g.z + fz * 7.5 + rz * 4.2; W.P.yaw = g.yaw + Math.PI; W.setCam(g.yaw, 0.12); });
  await step(5);
  await shot('forsale-sign.png');

  // ---------- 8. Sign Language ----------
  await onFoot();
  await ev(() => { window.__G.G.cash = 0; window.__G.G.heat = 0; window.__G.jobs.start('signs'); });
  await step(1);
  const s3 = await ev(() => { const m = window.__G.mission; return { id: m && m.id, n: m && m.signs.length, timer: m && m.timer, timerShown: document.getElementById('timer').style.display }; });
  check('Sign Language: 6 signs, 3:00 timer shown', s3.id === 'signs' && s3.n === 6 && s3.timer > 170 && s3.timerShown === 'block', JSON.stringify(s3));
  await ev(() => { const W = window.__G, s = W.mission.signs[0]; W.P.x = s.x + Math.sin(s.g.rotation.y) * 3.2; W.P.z = s.z + Math.cos(s.g.rotation.y) * 3.2; W.P.yaw = s.g.rotation.y + Math.PI; W.setCam(s.g.rotation.y, 0.18); });
  await step(5);
  await shot('sign-prop.png');
  for (let i = 0; i < 6; i++) {
    await ev(() => { const W = window.__G, s = W.mission.signs.find((q) => q.alive); W.P.x = s.x; W.P.z = s.z - 0.8; W.P.yaw = 0; W.P.punch = 0.2; W.P.punchHit = true; });
    await step(1);
    await ev(() => { window.__G.P.punch = 0; window.__G.P.punchHit = false; });
    await step(1);
    if (i === 3) check('4th sign adds heat', (await ev(() => window.__G.G.heat)) >= 2, await ev(() => { const m = window.__G.mission; return m ? `got ${m.got}, car ${!!window.__G.P.car}` : 'mission over'; }));
  }
  const s4 = await ev(() => ({ mission: window.__G.mission && window.__G.mission.id, cash: window.__G.G.cash, jobs: window.__G.jobs.S.jobs }));
  check('6 paws pass Sign Language for $150', !s4.mission && s4.cash === 150 && s4.jobs.signs === 1, JSON.stringify(s4));
  await ev(() => { const W = window.__G; W.G.heat = 0; for (const c of W.patrols()) c.dead = true; });

  // ---------- 9. Repo Man ----------
  await onFoot();
  await ev(() => { window.__G.G.cash = 0; window.__G.jobs.start('repo'); });
  await step(1);
  const p1 = await ev(() => { const m = window.__G.mission; return { id: m && m.id, cart: !!(m && m.cart), near: m && Math.hypot(m.cart.x - window.__G.places.hoaLot.x, m.cart.z - window.__G.places.hoaLot.z) }; });
  check('Repo Man starts with a cart at the HOA lot', p1.id === 'repo' && p1.cart && p1.near < 14, JSON.stringify(p1));
  await ev(() => { const W = window.__G; W.enterCar(W.mission.cart, true); });
  await step(2);
  const p2 = await ev(() => ({ heat: window.__G.G.heat, taken: window.__G.mission.taken, label: window.__G.G.check && window.__G.G.check.label }));
  check('taking the cart gives 1 star and points at the RV lot', p2.heat === 1 && p2.taken && /RV/.test(p2.label), JSON.stringify(p2));
  await ev(() => { const m = window.__G.mission; m.cart.x = m.drop.x; m.cart.z = m.drop.z; m.cart.speed = 0; m.cart.vx = m.cart.vz = 0; });
  await step(3);
  const p3 = await ev(() => ({ mission: window.__G.mission && window.__G.mission.id, cash: window.__G.G.cash, repo: window.__G.P.car && window.__G.P.car.repo }));
  check('cart delivered: +$120', !p3.mission && p3.cash === 120 && p3.repo, JSON.stringify(p3));

  // ---------- 10. giver markers (screenshots for placement), save key ----------
  await onFoot();
  for (const id of ['fish', 'repo', 'signs']) {
    await ev((id) => { const W = window.__G, m = W.jobs.marks[id]; const yaw = W.jobs.markYaw[id]; W.P.x = m.position.x - Math.sin(yaw) * 4; W.P.z = m.position.z - Math.cos(yaw) * 4; W.P.yaw = yaw; W.setCam(yaw + Math.PI, 0.2); }, id);
    await step(5);
    await shot(`marker-${id}.png`);
  }
  const saved = await ev(() => JSON.parse(localStorage.getItem('maple-grove-offleash-jobs-v1') || 'null'));
  check('jobs save key holds best time, job counts, truce and sign', saved && saved.best.kids && saved.jobs.fish === 1 && saved.forsale === true, JSON.stringify(saved));

  console.log(`\n${results.length - fails}/${results.length} passed${errors.length ? `\nPAGE ERRORS:\n${errors.join('\n')}` : '\nno page errors'}`);
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
