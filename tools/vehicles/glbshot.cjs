// node glbshot.cjs out.png id [flip] ['[[x,y,z,dist],[x,y,z,dist]]' close-up targets per view]  -> front 3/4 + rear 3/4 of out/<id>/*.glb at eye level (flip = view from the other side)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, [out, id, flip, close] = process.argv.slice(2);
const glb = fs.readdirSync(path.join(root, 'out', id)).find((f) => f.endsWith('.glb'));
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 500 } }); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:${srv.address().port}/glbshot.html`);
  const f = (flip || '00').split('').map((c) => (c === '1' ? -1 : 1));
  if (close) await p.evaluate((c) => { window.CLOSE = c; }, JSON.parse(close));
  await p.evaluate(([u, v]) => window.go(u, v), [`/out/${id}/${glb}`, [[0.62 * f[0], 0.14, 1], [-0.62 * f[1], 0.14, -1]]]);
  await p.locator('#c').screenshot({ path: out }); await b.close(); srv.close();
});
