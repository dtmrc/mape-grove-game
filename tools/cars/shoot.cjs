const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 3000, height: 1650 } });
  p.on('pageerror', (e) => console.error(e)); p.on('console', (m) => m.type() === 'error' && console.error(m.text()));
  await p.goto('file://' + path.resolve('dist/showroom.html')); await p.waitForFunction(() => window.__done, null, { timeout: 60000 });
  await p.screenshot({ path: process.argv[2] || 'qa-out/showroom.png' });
  require('fs').writeFileSync((process.argv[2] || 'qa-out/showroom.png') + '.json', JSON.stringify(await p.evaluate(() => ({ labels: window.__labels, specs: window.__specs }))));
  await b.close();
})();
