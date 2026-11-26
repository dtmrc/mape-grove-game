// node views.cjs out.png id  -> model top / front / rear orthographic views (normal-shaded) at 160 px/m, for comparing with blueprints
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, [out, id] = process.argv.slice(2), glb = fs.readdirSync(path.join(root, 'out', id)).find((f) => f.endsWith('.glb'));
const srv = http.createServer((q, res) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [v, W, H] of [['top', 960, 400], ['front', 400, 330], ['rear', 400, 330]]) {
    const p = await b.newPage({ viewport: { width: W, height: H } }); p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.goto(`http://localhost:${srv.address().port}/orth.html`);
    await p.evaluate(([u, o]) => window.go(u, o), [`/out/${id}/${glb}`, { W, H, s: 160, ox: W / 2, oy: H / 2, oz: 0, oyM: 0, right: 1, view: v, shade: 1 }]);
    await p.locator('#c').screenshot({ path: `${out}.${v}.png` }); await p.close();
  }
  await b.close(); srv.close();
});
