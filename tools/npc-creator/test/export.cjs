const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [out, json] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(); page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.setContent('<!doctype html><body></body>'); await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'view.bundle.js'), 'utf8') });
  const b64 = await page.evaluate((j) => window.exportGLB(JSON.parse(j)), json || '{"sex":"female","hair":"ponytail","jacket":"open","name":"test"}');
  fs.writeFileSync(out, Buffer.from(b64, 'base64')); console.log('wrote', out, fs.statSync(out).size); await browser.close();
})();
