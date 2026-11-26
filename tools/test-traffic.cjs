// Traffic control check (traffic.js): node tools/test-traffic.cjs dist/index.html <shotsdir> [gameSeconds]
// Counts junctions, runs traffic, flags AI cars that cross a stop line on red or roll a stop sign, checks traffic still flows.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const file = path.resolve(process.argv[2]), out = path.resolve(process.argv[3] || 'shots'), secs = +(process.argv[4] || 40); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__G && window.__G.scene && window.__TC, null, { timeout: 60000 });
  await page.click('#start');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(100); }
  const info = await page.evaluate((secs) => {
    const W = window.__G, TC = window.__TC, J = [...TC.junctions().values()];
    W.G.clock = 17.2;
    const light = J.filter((j) => j.kind === 'light'), stop = J.filter((j) => j.kind === 'stop');
    // stand the cat by the busiest light so traffic spawns around town (not on top of us)
    const j0 = light[0] || J[0]; W.P.x = j0.x + 14; W.P.z = j0.z + 14;
    const st = window.__tst = { red: 0, rolled: 0, stops: 0, samples: 0, moving: 0, crossings: 0, t0: W.G.time, prev: new Map() };
    (function watch() {
      for (const c of W.cars) {
        if (c.driver !== 'ai' || !c.ai || c.bumped) continue;
        const a = c.ai, j = TC.junctions().get(a.to); if (!j) continue;
        const ap = j.ap.get(a.from); if (!ap) continue;
        const dl = (c.x - j.x) * ap.dx + (c.z - j.z) * ap.dz - ap.line;
        const p = st.prev.get(c); st.prev.set(c, { dl, to: a.to, sig: j.kind === 'light' ? TC.signal(j, ap) : -1, minV: Math.min(p && p.to === a.to ? p.minV : 99, dl < 4 ? Math.abs(c.speed) : 99) });
        if (p && p.to === a.to && p.dl > 0 && dl <= 0 && W.G.time - st.t0 > 2) {
          st.crossings++;
          if (j.kind === 'light' && TC.signal(j, ap) === 0 && p.sig !== 1 && a.go !== 'yellow') { st.red++; (st.redLog = st.redLog || []).push({ dl: +p.dl.toFixed(2), v: +c.speed.toFixed(2), go: a.go, why: a.goWhy, from: a.from, to: a.to, sig: p.sig, t: +W.G.time.toFixed(1) }); }
          if (j.kind === 'stop') { if (p.minV > 0.7) st.rolled++; else st.stops++; }
        }
      }
      // where the first car in line actually stops: front bumper vs the far edge of the white line (m, + = behind it)
      for (const c of W.cars) {
        if (c.driver !== 'ai' || !c.ai || Math.abs(c.speed) > 0.05 || c.ai.go || c.ai.sn !== c.ai.to || c.bumped || (c.ai.held || 0) < 0.05 && false) continue;
        const j = TC.junctions().get(c.ai.to), ap = j && j.ap.get(c.ai.from); if (!ap) continue;
        const gap = (c.x - j.x) * ap.dx + (c.z - j.z) * ap.dz - c.spec.len / 2 - ap.line;
        if (gap < 3) (st.gaps = st.gaps || []).push(+gap.toFixed(2));
      }
      for (const c of W.cars) if (c.driver === 'ai') { st.samples++; if (Math.abs(c.speed) > 1) st.moving++; }
      if (W.G.time - st.t0 < secs) requestAnimationFrame(watch); else st.done = true;
    })();
    return { lights: light.length, stops: stop.length, light0: light[0] && { x: light[0].x, z: light[0].z }, stop0: stop[0] && { x: stop[0].x, z: stop[0].z } };
  }, secs);
  console.log('junctions', JSON.stringify(info));
  await page.waitForFunction(() => window.__tst.done, null, { timeout: 900000, polling: 500 });
  const shot = async (j, name) => { if (!j) return; await page.evaluate((j) => { window.__camO = [[j.x + 16, 6, j.z + 16], [j.x, 1.5, j.z]]; }, j); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(out, name) }); };
  await shot(info.light0, 'traffic-light.png'); await shot(info.stop0, 'traffic-stop.png');
  const st = await page.evaluate(() => { const s = window.__tst; return { crossings: s.crossings, ranRed: s.red, rolledStop: s.rolled, fullStops: s.stops, stopGap: s.gaps && { n: s.gaps.length, min: Math.min(...s.gaps), p5: s.gaps.slice().sort((x, y) => x - y)[Math.floor(s.gaps.length * 0.05)], under: s.gaps.filter((g) => g < -0.05).length, max: Math.max(...s.gaps), avg: +(s.gaps.reduce((x, y) => x + y, 0) / s.gaps.length).toFixed(2) }, redLog: s.redLog, movingShare: +(s.moving / Math.max(1, s.samples)).toFixed(2) }; });
  console.log(JSON.stringify({ ...st, errors }));
  await browser.close();
  process.exit(errors.length || st.ranRed > 0 || st.rolledStop > 0 || (st.stopGap && (st.stopGap.p5 < -0.05 || st.stopGap.avg > 1.2)) || st.movingShare < 0.3 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
