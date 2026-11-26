// node spin.cjs outdir id [frames=36] [elev=0.3] -> turntable frames f00.png... of out/<id>/*.glb (assemble with spin.py)
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, [dir, id, nf = '36', el = '0.3'] = process.argv.slice(2), N = +nf;
const glb = fs.readdirSync(path.join(root, 'out', id)).find((f) => f.endsWith('.glb')); fs.mkdirSync(dir, { recursive: true });
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (let k = 0; k < N; k += 4) {
    const p = await b.newPage({ viewport: { width: 3100, height: 500 } });
    await p.goto(`http://localhost:${srv.address().port}/glbshot.html`);
    const vs = []; for (let i = k; i < Math.min(N, k + 4); i++) { const a = (i / N) * Math.PI * 2 + 0.6; vs.push([Math.sin(a), +el, Math.cos(a)]); }
    await p.evaluate(([u, v]) => window.go(u, v), [`/out/${id}/${glb}`, vs]);
    await p.locator('#c').screenshot({ path: path.join(dir, `b${String(k).padStart(2, '0')}.png`) }); await p.close();
  }
  await b.close(); srv.close();
});
