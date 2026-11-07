const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file:///home/claude/cat3d/dist/index.html'); await p.waitForTimeout(3000);
  const fn = fs.readFileSync(__dirname + '/stylemap.js', 'utf8');
  const url = await p.evaluate(`(${fn})()`).catch((e) => { console.log('ERR', e.message); });
  if (url) fs.writeFileSync(__dirname + '/town-map-illustrated.png', Buffer.from(url.split(',')[1], 'base64'));
  console.log(errs.join('\n')); await b.close();
})();
