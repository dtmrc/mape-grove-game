const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[3];
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(process.argv[2]));
  await page.waitForFunction(() => window.__G && window.__TC, null, { timeout: 60000 });
  await page.click('#start');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(100); }
  const J = await page.evaluate(() => { window.__G.G.clock = 12.5; const J = [...window.__TC.junctions().values()]; return J.map((j) => ({ x: j.x, z: j.z, kind: j.kind, n: [...j.ap.values()][0] })); });
  const pick = [J.find((j) => j.kind === 'light'), J.filter((j) => j.kind === 'light')[2], J.find((j) => j.kind === 'stop'), J.filter((j) => j.kind === 'stop')[3]];
  let i = 0;
  for (const j of pick) {
    if (!j) continue;
    await page.evaluate((j) => { const W = window.__G, a = j.n; W.P.x = j.x + a.dx * (a.line + 9) - a.dz * 1.5; W.P.z = j.z + a.dz * (a.line + 9) + a.dx * 1.5; window.__camDist = 7; W.setCam(Math.atan2(a.dx, a.dz), 0.22); }, j);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, `tc-${j.kind}-${i++}.png`) });
  }
  await browser.close();
})();
