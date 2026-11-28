// Builds a vehicle as a Tracebench project + GLB by driving Tracebench.html headless (same pipeline as the houses).
//   node build.cjs <id> [outDir]     (ids = v-<id>.js files)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const TB = process.env.TB || '/mnt/project-files/tools/tracebench/Tracebench.html';
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const MODE = process.env.MODE || '';   // '' full model, 'body' no wheels, 'wheel' one wheel at the origin
const ROOT = process.env.OUT || path.join(__dirname, 'out');
const SRC = ['vkit.js', 'common.js', 'smooth.js', ...fs.readdirSync(__dirname).filter((f) => /^v-.*\.js$/.test(f))].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
const NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, 'roster.json'), 'utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const id of ids) {
    const NAME = ((NAMES[id] && NAMES[id].file) || id) + (MODE ? '-' + MODE : ''), OUT = path.join(ROOT, id + (MODE ? '-' + MODE : '')); fs.mkdirSync(OUT, { recursive: true });
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('file://' + TB); await p.waitForTimeout(800);
    const info = await p.evaluate(async ([SRC, NAME, id, MODE]) => {
      const T = tracebench.lib.THREE, s = tracebench.scene, { unwrap, paintBy } = tracebench.lib;
      await s.load(undefined);
      const K = new Function('T', SRC + `\nreturn makeVKit(T);`)(T); K.mode = MODE || null;
      const P = new Function(SRC + `\nreturn makeVPaint();`)();
      const mats = new Function('K', 'P', SRC + `\nreturn build_${id}(K, P);`)(K, P);
      if (MODE === 'wheel') { for (const k of Object.keys(K.parts)) delete K.parts[k]; K.mode = null; K.wheel(0, 0, 0, K.wheelOpt); }
      const smoothNormals = new Function(SRC + `\nreturn smoothNormals;`)();
      const merge = (gs) => { let n = 0; for (const g of gs) n += g.getAttribute('position').array.length; const pos = new Float32Array(n); let o = 0; for (const g of gs) { pos.set(g.getAttribute('position').array, o); o += g.getAttribute('position').array.length; } const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.computeVertexNormals(); return out; };
      const objs = [];
      for (const [key, gs] of Object.entries(K.parts)) {
        const m = mats[key]; if (!m) throw new Error('no material for ' + key);
        const o = s.addMeshObject(key, merge(gs), m.color); objs.push(o);
        const size = m.size ?? 256, g = unwrap(o.mesh.geometry, size);
        smoothNormals(T, g, 42);
        o.mesh.geometry = g; o.wire.geometry = g;
        const c = document.createElement('canvas'); c.width = c.height = size;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = m.color; ctx.fillRect(0, 0, size, size);
        if (m.paint) { const img = ctx.getImageData(0, 0, size, size); paintBy(g, img, m.paint); ctx.putImageData(img, 0, 0); }
        o.texture = c; o.useTexture = true; o.crisp = true;
      }
      s.groups.set('veh', { name: NAME, leader: objs[0].id });
      objs.forEach((o) => { o.group = 'veh'; o.material.roughness = 0.9; });
      s.select(objs[0], true);
      s.bakeLightSelected(0.3, 0.2, 0.66);
      objs.forEach((o) => { o.crisp = true; });
      s.renderList(); s.applyDisplay({ textured: true, wireframe: false, flat: false }); s.select(null);
      const bb = new T.Box3(); objs.forEach((o) => bb.expandByObject(o.mesh));
      const tris = objs.reduce((n, o) => n + o.mesh.geometry.getAttribute('position').count / 3, 0);
      const wo = K.wheelOpt; return { wheel: wo ? { r: wo.r, w: wo.w, x: wo.x, axles: wo.axles, rear: wo.rear, duals: wo.duals } : null, tris, bb: [bb.min.toArray(), bb.max.toArray()], json: JSON.stringify({ version: 2, name: NAME, display: tracebench.project.display, scene: s.serialize() }) };
    }, [SRC, NAME, id, MODE]);
    fs.writeFileSync(path.join(OUT, `${NAME}.tracebench.json`), info.json);
    if (info.wheel) fs.writeFileSync(path.join(OUT, 'wheel.json'), JSON.stringify(info.wheel));   // axle layout for the game bake (bake.cjs)
    const [mn, mx] = info.bb, c = [(mn[0] + mx[0]) / 2, mx[1] * 0.45, (mn[2] + mx[2]) / 2], R = Math.hypot(mx[0] - mn[0], mx[1], mx[2] - mn[2]) / 2;
    const views = { '34': [0.72, 0.32, 0.9, 2.35], back: [-0.75, 0.34, -0.85, 2.35], side: [1, 0.06, 0, 2.3], front: [0.12, 0.1, 1, 2.6] };
    for (const [v, [dx, dy, dz, k]] of Object.entries(views)) {
      await p.evaluate(([c, d, R, k]) => {
        const vp = tracebench.viewport, L = Math.hypot(...d);
        vp.camera.position.set(c[0] + d[0] / L * R * k, c[1] + d[1] / L * R * k, c[2] + d[2] / L * R * k);
        vp.controls.target.set(...c); vp.controls.update(); vp.requestRender();
      }, [c, [dx, dy, dz], R, k]);
      await p.waitForTimeout(400);
      await p.locator('#v3d').screenshot({ path: path.join(OUT, `${NAME}-${v}.png`) });
    }
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('#btn-glb')]);
    await dl.saveAs(path.join(OUT, `${NAME}.glb`));
    console.log(id, 'tris', info.tris, 'size', info.bb.map((v) => v.map((x) => +x.toFixed(2))), 'glb', (fs.statSync(path.join(OUT, `${NAME}.glb`)).size / 1e6).toFixed(2) + 'MB', errs.length ? 'errors: ' + errs : '');
    await p.close();
  }
  await b.close();
})();
