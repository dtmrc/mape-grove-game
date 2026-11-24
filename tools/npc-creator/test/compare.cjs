const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [out, json] = process.argv.slice(2);
  const b64 = fs.readFileSync('/mnt/project-files/tools/tracebench/models/worker/Worker.glb').toString('base64');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1700, height: 600 } }); page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.setContent('<!doctype html><body></body>'); await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'view.bundle.js'), 'utf8') });
  const url = await page.evaluate(({ b64, json }) => window.compare(b64, JSON.parse(json)), { b64, json: json || '{"sex":"male"}' });
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', out); await browser.close();
})();
