// Headless smoke + baseline for Off Leash. Usage: node smoke.cjs <dist/index.html> [seconds]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2]), secs = +(process.argv[3] || 8);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], logs = [];
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  const t0 = Date.now();
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__G && window.__G.scene, null, { timeout: 60000 });
  const boot = Date.now() - t0;
  await page.click('#start');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(120); }
  // measure frame times + scene stats
  const stats = await page.evaluate(async (secs) => {
    const G = window.__G;
    const times = []; let last = performance.now(); const t0 = last;
    await new Promise((res) => { const f = (n) => { times.push(n - last); last = n; if (times.length < secs * 60 && n - t0 < secs * 1000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    let meshes = 0, sprites = 0, visible = 0, tris = 0, mats = new Set(), geos = new Set(), objs = 0;
    G.scene.traverse((o) => {
      objs++;
      if (!o.visible) return;
      let p = o.parent, vis = true; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      if (o.isSprite) { sprites++; visible++; }
      else if (o.isMesh) { meshes++; visible++; const g = o.geometry; geos.add(g.uuid); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m.uuid)); const idx = g.index; tris += (idx ? idx.count : g.attributes.position ? g.attributes.position.count : 0) / 3; }
    });
    times.shift();
    const sorted = times.slice().sort((a, b) => a - b);
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
    return { frames: times.length, avgMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), maxMs: +sorted[sorted.length - 1].toFixed(1), objs, visibleDrawables: visible, meshes, sprites, tris: Math.round(tris), uniqueMaterials: mats.size, uniqueGeometries: geos.size, heapMB: mem, cars: G.cars.length, peds: G.peds.length, clock: G.G.clock };
  }, secs);
  await page.screenshot({ path: path.join(path.dirname(file), '..', 'smoke.png') });
  console.log(JSON.stringify({ bootMs: boot, ...stats, errors, logs: logs.slice(0, 20) }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
