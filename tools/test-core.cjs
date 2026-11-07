// Headless checks for the core fixes (work package B). Usage: node tools/test-core.cjs dist/index.html
// Drives the built game through window.__G in SwiftShader Chromium; every frame is ~0.05 s of game time.
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'dist/index.html');
let fails = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? `  (${info})` : ''}`); if (!ok) fails++; };
const frames = (page, n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
async function boot(page) {
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__G && window.__G.scene, null, { timeout: 90000 });
  await page.evaluate(() => document.getElementById('start').click());
  for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(100); }
  await frames(page, 20); // intro dialog gone, P.lock expired
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  await boot(page);

  // 1. HOA citation at 3 stars: fine charged, no jail
  let r = await page.evaluate(() => { const { G, jail, busted, police } = window.__G; G.cash = 500; G.heat = 3; police.giveGun(5); busted(); return { cash: G.cash, jail: jail.active(), heat: G.heat, gun: police.gun.has }; });
  check('HOA busted at 3 stars charges the $100 fine', r.cash === 400, `cash ${r.cash}`);
  check('HOA busted never jails', r.jail === false && r.heat === 0);
  check('respawn strips the pistol', r.gun === false);
  await frames(page, 5);

  // 2. respawn during a cast clears the fishing state
  r = await page.evaluate(async () => {
    const { G, P, fishing, busted } = window.__G;
    fishing.S.gear.rod = true; fishing.S.gear.worms = 6; P.car = null; P.x = -20; P.z = 76; P.yaw = 0; P.lock = 0; P.y = 0;
    await new Promise((res) => requestAnimationFrame(res));
    P.lock = 0; const started = fishing.interact(); const st0 = fishing.S.fish.st;
    await new Promise((res) => requestAnimationFrame(res));
    const anchored = Math.abs(P.x + 20) < 0.5;
    G.cash = 200; busted();
    const st1 = fishing.S.fish.st;
    await new Promise((res) => requestAnimationFrame(res)); await new Promise((res) => requestAnimationFrame(res));
    return { started, st0, anchored, st1, far: Math.hypot(P.x + 20, P.z - 76) > 20, rodHidden: !document.getElementById('fishbar').style.display || document.getElementById('fishbar').style.display === 'none' };
  });
  check('cast started on the dock', r.started && r.st0 === 'cast' && r.anchored, JSON.stringify(r));
  check('respawn during a cast clears fishing state', r.st1 === 'idle' && r.far && r.rodHidden, JSON.stringify(r));

  // 3. 1-star heat: HOA carts, no PD cruisers
  await page.evaluate(() => { const { G, P, police, places } = window.__G; G.heat = 0; G.seenT = 0; P.x = places.spawn.x; P.z = places.spawn.z; police.clear(); window.__G.addHeat(1, 'test'); });
  let maxCruisers = 0, maxPatrols = 0;
  for (let i = 0; i < 12; i++) { await frames(page, 12); const s = await page.evaluate(() => ({ c: window.__G.police.cruisers().length, p: window.__G.patrols().length, heat: window.__G.G.heat })); maxCruisers = Math.max(maxCruisers, s.c); maxPatrols = Math.max(maxPatrols, s.p); if (s.heat === 0) break; }
  check('1-star heat spawns no police cruiser', maxCruisers === 0, `cruisers ${maxCruisers}`);
  check('1-star heat sends an HOA cart', maxPatrols >= 1, `patrols ${maxPatrols}`);

  // 4. 3-star heat: PD only, HOA carts stand down
  await page.evaluate(() => { const { G } = window.__G; G.heat = 0; G.seenT = 0; window.__G.addHeat(3, 'test'); });
  maxPatrols = 0; let patrolsAfter = 0; maxCruisers = 0;
  for (let i = 0; i < 12; i++) { await frames(page, 12); const s = await page.evaluate(() => ({ c: window.__G.police.cruisers().length, p: window.__G.patrols().length })); if (i > 1) maxPatrols = Math.max(maxPatrols, s.p); patrolsAfter = s.p; maxCruisers = Math.max(maxCruisers, s.c); }
  check('3-star heat spawns no HOA patrol', maxPatrols === 0 && patrolsAfter === 0, `patrols ${maxPatrols}`);
  console.log(`info  cruisers seen at 3 stars: ${maxCruisers}`);

  // 5. car wash repair at 0 stars: $30, once per visit
  r = await page.evaluate(async () => {
    const { G, P, cars, places, enterCar, police } = window.__G;
    G.heat = 0; G.seenT = 0; police.clear(); for (const c of window.__G.patrols()) c.role = null;
    const car = cars.find((c) => !c.driver && !c.dead && !c.role);
    P.x = car.x + 2; P.z = car.z; enterCar(car, true);
    car.hp = 50; G.cash = 100; car.x = places.wash.x; car.z = places.wash.z; car.vx = car.vz = car.speed = 0;
    for (let i = 0; i < 4; i++) await new Promise((res) => requestAnimationFrame(res));
    window.__tcar = car;
  });
  await page.keyboard.press('e'); await frames(page, 4);
  r = await page.evaluate(() => { const { G, P, places } = window.__G, car = window.__tcar; return { cash1: G.cash, hp1: car.hp, inCar: P.car === car, inZone: Math.hypot(car.x - places.wash.x, car.z - places.wash.z) < 2, heat: G.heat }; });
  check('car wash repair (E in the bay) charges $30 and fixes the car', r.cash1 === 70 && r.hp1 === 100 && r.inCar, JSON.stringify(r));
  await page.keyboard.press('e'); await frames(page, 4);
  r = await page.evaluate(() => { const { G, P } = window.__G, car = window.__tcar; return { cash2: G.cash, inCar: P.car === car, hex: car.mesh.userData.paint.color.getHex() }; });
  check('second E in the bay resprays for $20 and stays in the car', r.cash2 === 50 && r.inCar, JSON.stringify(r));

  // 6. save -> reload restores position, clock and cash
  const saved = await page.evaluate(() => { const { G, P, save } = window.__G; if (P.car) { P.car.driver = null; P.car = null; } P.x = 30; P.z = -40; P.yaw = 1.2; G.clock = 9.25; G.cash = 1234; G.done = { nana: true }; save(); return JSON.parse(localStorage.getItem(window.__G.SAVE_KEY)); });
  check('save v2 holds position, clock, hp and gun', saved.version === 2 && saved.x === 30 && saved.z === -40 && saved.clock === 9.25 && 'hp' in saved && 'gun' in saved && saved.heat === 0, JSON.stringify(saved));
  await page.reload();
  await page.waitForFunction(() => window.__G && window.__G.scene, null, { timeout: 90000 });
  r = await page.evaluate(() => { const { G, P } = window.__G; return { x: P.x, z: P.z, yaw: P.yaw, clock: G.clock, cash: G.cash, done: G.done }; });
  check('reload restores position', Math.abs(r.x - 30) < 0.01 && Math.abs(r.z + 40) < 0.01 && Math.abs(r.yaw - 1.2) < 0.01, JSON.stringify(r));
  check('reload restores clock and cash', Math.abs(r.clock - 9.25) < 0.05 && r.cash === 1234 && r.done.nana === true, JSON.stringify(r));
  // NEW GAME clears every key
  await page.evaluate(() => { for (const k of ['maple-grove-offleash-fishing-v1', 'maple-grove-offleash-fx', 'maple-grove-offleash-sky', 'mg-dev-view', 'maple-grove-world-v1']) localStorage.setItem(k, '{"x":1}'); });
  await page.evaluate(() => { window.__old = true; setTimeout(() => document.getElementById('reset').click(), 0); });
  await page.waitForFunction(() => !window.__old && window.__G && window.__G.scene, null, { timeout: 90000 });
  r = await page.evaluate(() => ({ left: ['maple-grove-offleash-v1', 'maple-grove-offleash-fishing-v1', 'maple-grove-offleash-fx', 'maple-grove-offleash-sky', 'mg-dev-view'].filter((k) => localStorage.getItem(k) === '{"x":1}' || (k === 'maple-grove-offleash-v1' && localStorage.getItem(k) !== null)), world: localStorage.getItem('maple-grove-world-v1'), cash: window.__G.G.cash, x: window.__G.P.x }));
  check('NEW GAME clears every save key but keeps the world', r.left.length === 0 && r.world === '{"x":1}' && r.cash === 0, JSON.stringify(r));

  check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();
  console.log(fails ? `${fails} check(s) failed` : 'all checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
