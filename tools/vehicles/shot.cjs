// node shot.cjs out.png id [id ...]: full-detail build, baked near LOD, baked far LOD (one row each) for each id; needs bake.cjs run first
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path');
const D = __dirname, G = path.join(D, '..', '..', 'src', 'models', 'vehicles'), TMP = process.env.BAKE_TMP || '/tmp/vehicle-bake';
const [out, ...ids] = process.argv.slice(2);
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u.startsWith('/tmp/') ? path.join(TMP, u.slice(5)) : u.startsWith('/game/') ? path.join(G, u.slice(6)) : path.join(D, u);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' }); r.end(d); }); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await b.newPage({ viewport: { width: 1600, height: 400 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:${srv.address().port}/view.html`); await p.waitForFunction(() => window.ready);
  const pngs = [];
  for (const id of ids) {
    const glb = (m) => '/tmp/' + id + '-' + m + '/' + fs.readdirSync(path.join(TMP, id + '-' + m)).find((f) => f.endsWith('.glb'));
    for (const [bd, wh, far] of [[glb('body'), glb('wheel'), 0], ['/game/' + id + '.glb', '/game/' + id + '.glb', 0], ['/game/' + id + '.glb', '/game/' + id + '.glb', 1]]) {
      const r = await p.evaluate(([a, c, d, e]) => window.shot(a, c, d, e), [id, bd, wh, far]); console.log(id, far ? 'far' : bd.startsWith('/game') ? 'near' : 'full', r);
      pngs.push(await p.locator('canvas').screenshot());
    }
  }
  // stack the strips
  const q = await b.newPage({ viewport: { width: 1600, height: 400 * pngs.length } });
  await q.setContent('<body style="margin:0">' + pngs.map((x) => `<img style="display:block" src="data:image/png;base64,${x.toString('base64')}">`).join('') + '</body>');
  await q.screenshot({ path: out, fullPage: true }); await b.close(); srv.close();
})();
