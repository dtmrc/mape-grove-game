// Screenshot of an AI car stopped at a red light / stop sign, from the kerb. node tools/tc-stopshot.cjs dist/index.html out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto('file://' + path.resolve(process.argv[2]));
  await page.waitForFunction(() => window.__G && window.__TC, null, { timeout: 60000 });
  await page.click('#start'); for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(100); }
  await page.evaluate(() => { window.__G.G.clock = 12.5; window.__side = 1.5; window.__yawAdd = 0.9; });
  await page.waitForFunction((kind) => {
    const W = window.__G, TC = window.__TC;
    for (const c of W.cars) {
      if (c.driver !== 'ai' || !c.ai || Math.abs(c.speed) > 0.05 || c.ai.go || c.ai.sn !== c.ai.to) continue;
      const j = TC.junctions().get(c.ai.to), ap = j && j.ap.get(c.ai.from); if (!ap || j.kind !== kind) continue;
      const gap = (c.x - j.x) * ap.dx + (c.z - j.z) * ap.dz - c.spec.len / 2 - ap.line; if (gap > 1.5) continue;
      // stand on the kerb beside the line, look across the car's nose
      const side = ap.w / 2 + (window.__side || 3.5); W.P.x = j.x + ap.dx * (ap.line - 1) + ap.dz * side; W.P.z = j.z + ap.dz * (ap.line - 1) - ap.dx * side;
      window.__camDist = 6; W.setCam(Math.atan2(ap.dz, -ap.dx) + (window.__yawAdd ?? 0.5), 0.35); window.__shotCar = c; return true;
    }
    return false;
  }, process.argv[4] || 'light', { timeout: 600000, polling: 300 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: process.argv[3] });
  await browser.close();
})();
