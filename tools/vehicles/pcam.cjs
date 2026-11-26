// node pcam.cjs out.png id cam.json  -> model rendered through the solved photo camera (transparent background), see pmatch.py
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, [out, id, cj] = process.argv.slice(2); const C = JSON.parse(fs.readFileSync(cj));
const glb = fs.readdirSync(path.join(root, 'out', id)).find((f) => f.endsWith('.glb'));
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: C.W, height: C.H } }); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:${srv.address().port}/pcam.html`);
  await p.evaluate(([u, m, f, W, H]) => window.go(u, m, f, W, H), [`/out/${id}/${glb}`, C.m, C.fov, C.W, C.H]);
  await p.locator('#c').screenshot({ path: out, omitBackground: true }); await b.close(); srv.close();
});
