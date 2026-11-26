// Renders the whole-world illustrated map. Usage: node runworldmap.cjs <debug dist/index.html> <out.png>   (see README.md)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(process.argv[2]));
  await p.waitForFunction(() => window.__W && window.__W.__mapdata && window.__TER, null, { timeout: 90000 });
  const fn = fs.readFileSync(path.join(__dirname, 'worldmap.js'), 'utf8');
  const url = await p.evaluate(`(${fn})()`).catch((e) => { console.log('ERR', e.message); });
  if (url) fs.writeFileSync(process.argv[3], Buffer.from(url.split(',')[1], 'base64'));
  console.log(errs.join('\n') || 'ok'); await b.close();
})();
