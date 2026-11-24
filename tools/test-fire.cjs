// Headless checks for house fires (src/js/firestarter.js): kit pickups, shop items, ignition inside a room, smoke damage,
// breakout, witness heat, VFD truck, condemned door, rebuild. Usage: node tools/test-fire.cjs <dist/index.html> [shots-dir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || 'dist/index.html'), shots = process.argv[3] || null;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__G && window.__G.fires && window.__FIRE && window.__INT, null, { timeout: 90000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = (n = 1) => ev(async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
  let fails = 0;
  const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + JSON.stringify(info) : ''}`); if (!ok) fails++; };
  const shot = (name) => shots ? page.screenshot({ path: path.join(shots, name), timeout: 180000 }) : null;
  const dismiss = async () => { for (let i = 0; i < 12; i++) { if (!(await ev(() => !!window.__G.G.dialog))) break; await page.keyboard.press('e'); await step(1); } await ev(() => { window.__G.P.lock = 0; }); };
  const press = async (k = 'e') => { await ev(() => { window.__G.P.lock = 0; }); await page.keyboard.down(k); await step(1); await page.keyboard.up(k); await step(1); };

  await ev(() => document.getElementById('start').click());
  await step(1); await dismiss();
  await ev(async () => { await window.__INT.ready; const G = window.__G.G; G.cash = 50; G.clock = 21; });

  // 1. pickups exist, E picks up newspapers
  const st0 = await ev(() => window.__FIRE.state);
  check('four kit pickups placed around town', st0.pickups.length === 4 && st0.pickups.every((p) => p.up && Number.isFinite(p.x)), st0.pickups);
  await ev(() => { const p = window.__FIRE.state.pickups.find((q) => q.id === 'news'); const P = window.__G.P; P.x = p.x + 0.6; P.z = p.z; });
  await step(2);
  const pr = await ev(() => document.getElementById('prompt').textContent);
  check('pickup prompt shows', /newspapers/i.test(pr), pr);
  await press('e');
  check('newspapers in the kit', await ev(() => window.__FIRE.state.inv.news === true));
  check('kit HUD line visible', await ev(() => getComputedStyle(document.getElementById('firekit')).display !== 'none'));

  // 2. shop items: matches at the diner, lighter fluid at the Quik Stop
  const shop = await ev(() => { const s = window.__G.shops; const a = s.buy('diner', 'matches'), b = s.buy('quik', 'fluid'); return { a, b, st: window.__FIRE.state }; });
  check('diner sells matches, Quik Stop sells lighter fluid', shop.a && shop.b && shop.st.inv.matches === 3 && shop.st.inv.fluid, shop.st.inv);

  // 3. RV refuses
  await ev(() => window.__INT.enter('rv', { instant: true })); await step(2);
  await ev(() => { const R = window.__INT.room, P = window.__G.P; P.x = R.origin.x; P.z = R.origin.z - 0.3; }); await step(2);
  await press('e');
  check('no fires in the RV', await ev(() => !window.__FIRE.fires.rv));
  await ev(() => window.__INT.exit({ instant: true })); await step(2);

  // 4. ignite inside the Quik Stop
  await ev(() => window.__INT.enter('quik', { instant: true })); await step(2);
  await ev(() => { const R = window.__INT.room, P = window.__G.P; P.x = R.origin.x + 1.5; P.z = R.origin.z - 1; P.yaw = Math.PI; }); await step(3);
  const ip = await ev(() => document.getElementById('prompt').textContent);
  check('"Start a fire" prompt inside', /Start a fire/.test(ip), ip);
  await press('e');
  for (let i = 0; i < 30 && !(await ev(() => !!window.__FIRE.fires.quik)); i++) await step(2);
  const f1 = await ev(() => window.__FIRE.state);
  check('fire started, kit consumed (lighter fluid, newspapers, one match)', !!f1.fires.quik && !f1.inv.news && !f1.inv.fluid && f1.inv.matches === 2, f1);
  await ev(() => { window.__FIRE.skip(12); }); await step(10);
  await ev(() => { const R = window.__INT.room, P = window.__G.P; P.x = R.origin.x + R.exit.x; P.z = R.origin.z + R.exit.z - 1.4; P.yaw = Math.PI; window.__G.setCam(0, 0.25); }); await step(12);
  await shot('fire-inside.png');
  const f2 = await ev(() => ({ fire: window.__FIRE.state.fires.quik, smoke: +getComputedStyle(document.getElementById('smokefx')).opacity, hp: window.__G.G.hp }));
  check('room fills with flames and smoke', f2.fire.k > 0.3 && f2.smoke > 0.1, f2);
  await ev(() => { window.__G.G.hp = 100; window.__FIRE.fires.quik.k = 1; }); await step(30);
  check('smoke and flames hurt', await ev(() => window.__G.G.hp < 100), await ev(() => window.__G.G.hp));
  await ev(() => { window.__G.G.hp = 100; window.__INT.exit({ instant: true }); }); await step(3);

  // 5. breakout, witness, truck, spray, condemned, rebuild
  await ev(() => { window.__FIRE.skip(4); }); await step(10);
  const f3 = await ev(() => window.__FIRE.state.fires.quik);
  check('fire breaks out of the building', f3.st === 'blaze', f3);
  await ev(() => { const f = window.__FIRE.fires.quik, P = window.__G.P; P.x = f.B.door.x + Math.sin(f.B.door.yaw) * 16; P.z = f.B.door.z + Math.cos(f.B.door.yaw) * 16; window.__G.setCam(f.B.door.yaw, 0.12); window.__camDist = 9; window.__FIRE.skip(10); }); await step(30);
  await shot('fire-outside.png');
  const f4 = await ev(() => ({ f: window.__FIRE.state.fires.quik, heat: window.__G.G.heat }));
  check('VFD dispatched', f4.f.truck, f4);
  check('witnessed: PD heat', f4.f.witnessed ? f4.heat >= 3 : true, f4);
  for (let i = 0; i < 40 && !(await ev(() => window.__FIRE.state.fires.quik.parked)); i++) await step(5);
  const f5 = await ev(() => window.__FIRE.state.fires.quik);
  check('truck parks and starts hosing', f5.parked && f5.st === 'spray', f5);
  await ev(() => { const T = window.__FIRE.fires.quik.truck.g, P = window.__G.P, f = window.__FIRE.fires.quik; P.x = T.position.x + (T.position.x - f.B.cx) * 0.6; P.z = T.position.z + (T.position.z - f.B.cz) * 0.6; window.__G.setCam(Math.atan2(P.x - f.B.cx, P.z - f.B.cz), 0.2); window.__camDist = 12; }); await step(20); await shot('fire-truck.png');
  await ev(() => { window.__camDist = 0; });
  await ev(() => { window.__FIRE.fires.quik.spray = 99; }); await step(3);
  const f6 = await ev(() => ({ f: window.__FIRE.state.fires.quik, door: window.__INT.state.doors.quik }));
  check('fire out, smouldering, doors shut', f6.f.st === 'smolder' && f6.door.ok === false, f6);
  await ev(() => { window.__FIRE.fires.quik.smolderAt = -1e4; }); await step(3);
  check('condemned', await ev(() => window.__FIRE.state.fires.quik.st === 'condemned'));
  await ev(() => { const f = window.__FIRE.fires.quik, P = window.__G.P; P.x = f.B.cx + 80; P.z = f.B.cz; f.condemnAt = -1e4; window.__G.G.heat = 0; }); await step(5);
  const f7 = await ev(() => ({ fires: Object.keys(window.__FIRE.fires), door: window.__INT.state.doors.quik }));
  check('rebuilt and reopened once you leave', f7.fires.length === 0 && f7.door.ok, f7);

  check('no page errors', errors.length === 0, errors.slice(0, 3));
  console.log(fails ? `${fails} FAILED` : 'all fire checks passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
