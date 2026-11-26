// Driving check for carphys.js (GTA IV style handling). Usage: node tools/test-drive.cjs dist/index.html <shotsdir>
// Puts the cat in a sedan at the start of the longest paved road, floors it, brakes, then handbrake-drifts,
// logging telemetry and taking screenshots. Exits 1 on page errors or broken physics.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const file = path.resolve(process.argv[2]), out = path.resolve(process.argv[3] || 'shots'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__G && window.__G.scene && window.__CP, null, { timeout: 60000 });
  await page.click('#start');
  // clear the intro dialog (it pauses game time): press E until it is gone, not a fixed count (slow boots left it up)
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => !!(window.__G.G && window.__G.G.dialog)); if (!d && i > 3) break; await page.keyboard.press('e'); await page.waitForTimeout(200); }
  const setup = await page.evaluate(() => {
    const W = window.__G, CP = window.__CP, N = CP.nodes, E = CP.edges();
    let best = null; for (const e of E) { if (e.t !== 'paved' && e.t !== 'hwy') continue; const A = N[e.a], B = N[e.b], L = Math.hypot(B.x - A.x, B.z - A.z); if (!best || L > best.L) best = { A, B, L }; }
    const { A, B, L } = best, yaw = Math.atan2(B.x - A.x, B.z - A.z);
    W.G.clock = 16.5; // late afternoon light for the shots
    const c = W.cars.find((c) => c.type === 'sedan' && !c.dead) || W.cars.find((c) => !c.dead && !c.spec.cart);
    c.driver = null; c.ai = null; c.role = null; c.x = A.x + Math.sin(yaw) * 4; c.z = A.z + Math.cos(yaw) * 4; c.yaw = yaw; c.vx = c.vz = c.speed = 0; c.fuel = 100; c.hp = 100;
    // keep traffic out of the test lane
    for (const o of W.cars) if (o !== c && Math.hypot(o.x - c.x, o.z - c.z) < L + 20) { o.x += 400; }
    W.P.x = c.x; W.P.z = c.z; W.enterCar(c, true); window.__setup = { x: c.x, z: c.z, yaw };
    window.__tel = []; const G = W.G;
    (function log() { const ph = c.ph; if (ph) window.__tel.push({ t: +G.time.toFixed(2), v: +c.speed.toFixed(2), slip: +Math.atan2(c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw), Math.abs(c.speed) + 1e-3).toFixed(3), gear: ph.gear, rpm: +ph.rpm.toFixed(2), pitch: +c.mesh.userData.body.rotation.x.toFixed(3), roll: +c.mesh.userData.body.rotation.z.toFixed(3), yr: +c.yr.toFixed(2) }); requestAnimationFrame(log); })();
    return { type: c.type, L: +L.toFixed(0) };
  });
  console.log('setup', setup);
  const until = (fn, arg, ms = 120000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  const gt = () => page.evaluate(() => window.__G.G.time);
  const hold = async (keys, secs) => { const t0 = await gt(); for (const k of keys) await page.keyboard.down(k); await until(([t0, s]) => window.__G.G.time - t0 >= s, [t0, secs]); for (const k of keys) await page.keyboard.up(k); };
  await hold(['w'], 1.2); await page.screenshot({ path: path.join(out, 'drive-launch.png') });
  await hold(['w'], 4.5); await page.screenshot({ path: path.join(out, 'drive-speed.png') });
  await hold(['s'], 0.45); await page.screenshot({ path: path.join(out, 'drive-brake-dive.png') });
  await hold(['s'], 0.6);
  // reset to the lane start at speed for clean handling shots
  const reset = (v) => page.evaluate((v) => { const c = window.__G.P.car, s = window.__setup; c.x = s.x; c.z = s.z; c.yaw = s.yaw; c.vx = Math.sin(s.yaw) * v; c.vz = Math.cos(s.yaw) * v; c.yr = 0; c.speed = v; window.__CP.state(c).steer = 0; }, v);
  await reset(17); await hold(['w', 'd'], 0.9); await page.screenshot({ path: path.join(out, 'drive-corner-roll.png') });
  await reset(19); await hold(['a'], 0.25); await hold(['a', ' '], 0.55); await page.screenshot({ path: path.join(out, 'drive-handbrake.png') });
  await hold(['w', 'a'], 0.5); await page.screenshot({ path: path.join(out, 'drive-drift.png') });
  await hold([], 1.5); await page.screenshot({ path: path.join(out, 'drive-after.png') });
  const tel = await page.evaluate(() => window.__tel);
  const max = (k) => Math.max(...tel.map((r) => Math.abs(r[k])));
  const sum = { frames: tel.length, topSpeed: max('v'), maxSlipDeg: +(max('slip') * 57.3).toFixed(1), maxGear: Math.max(...tel.map((r) => r.gear)), maxPitchDeg: +(max('pitch') * 57.3).toFixed(1), maxRollDeg: +(max('roll') * 57.3).toFixed(1), skids: await page.evaluate(() => window.__CP.skids.count), errors };
  fs.writeFileSync(path.join(out, 'drive-telemetry.json'), JSON.stringify(tel));
  console.log(JSON.stringify(sum));
  await browser.close();
  const bad = errors.length || !isFinite(sum.topSpeed) || sum.topSpeed < 15 || sum.maxGear < 3 || sum.skids < 1;
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
