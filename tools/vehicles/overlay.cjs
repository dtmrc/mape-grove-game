// node overlay.cjs out.png id photo fx fy rx ry [R|L]
// Lines the built model's side outline up with a real side-on photo using the two wheel centres (photo pixels), so the profile
// can be checked and corrected against the real car instead of by eye. Writes out.png (photo + outline) via overlay.py.
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const root = __dirname, [out, id, photo, fx, fy, rx, ry, face = 'R', src = id] = process.argv.slice(2);
const js = fs.readFileSync(path.join(root, `v-${src}.js`), 'utf8'), num = (k) => +js.match(new RegExp(`\\b${k} = (-?[\\d.]+)`))[1];
const r = num('r'), zf = num('zf'), zr = num('zr'), right = face === 'R' ? 1 : -1;
const size = cp.execSync(`python3 -c "from PIL import Image; print(*Image.open('${photo}').size)"`).toString().trim().split(' ').map(Number);
const s = Math.hypot(fx - rx, fy - ry) / (zf - zr);
const glb = fs.readdirSync(path.join(root, 'out', id)).find((f) => f.endsWith('.glb'));
const srv = http.createServer((q, res) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }); }).listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: size[0], height: size[1] } }); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:${srv.address().port}/orth.html`);
  await p.evaluate(([u, o]) => window.go(u, o), [`/out/${id}/${glb}`, { W: size[0], H: size[1], s, ox: +rx, oy: +ry, oz: zr, oyM: r, right }]);
  await p.locator('#c').screenshot({ path: out + '.reg.png', omitBackground: true }); await b.close(); srv.close();
  cp.execSync(`python3 ${path.join(root, 'overlay.py')} ${out} ${photo} ${out}.reg.png`); console.log('px/m', s.toFixed(1));
});
