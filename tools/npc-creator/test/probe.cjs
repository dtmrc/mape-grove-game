const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(); page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.setContent('<!doctype html><body></body>'); await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'view.bundle.js'), 'utf8') });
  console.log(JSON.stringify(await page.evaluate(() => {
    const n = window.buildNPCDebug({ sex: 'male', hair: 'bald' });
    const g = n.mesh.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, UV = g.attributes.uv;
    const out = {}; const names = n.bones.map((b) => b.name);
    for (let i = 0; i < P.count; i++) { const b = names[SI.getX(i)]; const y = P.getY(i); const o = out[b] || (out[b] = { min: 9, max: -9, n: 0 }); o.min = Math.min(o.min, y); o.max = Math.max(o.max, y); o.n++; }
    // face plane: vertices whose uv falls in the face region
    const face = { min: 9, max: -9 }; for (let i = 0; i < P.count; i++) { const u = UV.getX(i) * 256, v = (1 - UV.getY(i)) * 256; if (u >= n.R.face.x && u <= n.R.face.x + n.R.face.w && v >= n.R.face.y && v <= n.R.face.y + n.R.face.h && SI.getX(i) === 4) { face.min = Math.min(face.min, P.getY(i)); face.max = Math.max(face.max, P.getY(i)); } }
    return { bones: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [+v.min.toFixed(3), +v.max.toFixed(3), v.n]])), face, R: n.R.face, height: n.height };
  }), null, 1));
  await browser.close();
})();
