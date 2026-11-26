const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1120, height: 2000 } });
  p.on('pageerror', (e) => console.log('ERR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
  await p.goto(`http://localhost:${srv.address().port}/preview.html`);
  const ids = process.argv.slice(3);
  const ALL = fs.readdirSync(root).filter((f) => /^v-.*\.js$/.test(f)).map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  const info = await p.evaluate(([ids, ALL, PH]) => { window.ALL = ALL; return window.go(ids, PH); }, [ids, ALL, !!process.env.PHOTO]); console.log(JSON.stringify(info));
  await p.locator('#c').screenshot({ path: process.argv[2] }); await b.close(); srv.close();
});
