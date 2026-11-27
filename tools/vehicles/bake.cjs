// Game bake: node bake.cjs [id ...]  (default: the GAME list below)
//   1. builds each vehicle twice with build.cjs (MODE=body, MODE=wheel) into $BAKE_TMP
//   2. bake.html (headless) packs it into one game GLB: Paint (tintable) + Body (atlas) + BarR/BarB (police light bar) + Wheel,
//      welded and simplified with meshoptimizer
//   3. gltf-transform quantizes + meshopt-compresses it into src/models/vehicles/<id>.glb
//   4. src/models/vehicles/index.json (and a generated index.js importing every GLB) gets the facts the game needs (size, axles, wheel radius, roof, lamp glows, stock colour, roster)
// Needs: playwright, three, meshoptimizer, @gltf-transform/{core,extensions,functions} in node_modules (see README).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const D = __dirname, GAME_DIR = path.join(D, '..', '..', 'src', 'models', 'vehicles'), TMP = process.env.BAKE_TMP || '/tmp/vehicle-bake';
// cars that go into the game: civilian cars, trucks and SUVs for traffic / parked / drivable, plus the police cars
const GAME = {
  sedan: ['kamden97', 'crown03', 'accolade14', 'chaser18', 'kamden25', 'modele24'],
  sport: ['stallion99', 'comet17', 'corsair24'],
  suv: ['pathway97', 'tahoma04', 'grand16', 'crest12', 'escalon24', 'rambla24'],
  pickup: ['k15_95', 'f15_04', 'rampart16', 'f15_24'],
  cart: ['hoacart'],
  police: ['crownpi08', 'chaserpd18', 'tahomappv04', 'pathwaypiu23', 'blazonppv23'],
};
const LIVERY = new Set(GAME.police);                       // keep their own paint (black-and-white, decals)
const RATIO = +(process.env.RATIO || 0.4), ERR = +(process.env.ERR || 0.0025), FAR = { ratio: +(process.env.FAR_RATIO || 0.08), err: +(process.env.FAR_ERR || 0.08) };
const roster = JSON.parse(fs.readFileSync(path.join(D, 'roster.json'), 'utf8'));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.values(GAME).flat();
const clsOf = (id) => Object.keys(GAME).find((k) => GAME[k].includes(id));
const glbIn = (dir) => path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.glb')));

(async () => {
  fs.mkdirSync(GAME_DIR, { recursive: true });
  const idxPath = path.join(GAME_DIR, 'index.json'), index = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : {};
  for (const id of ids) for (const mode of ['body', 'wheel']) {
    if (process.env.SKIP_BUILD && fs.existsSync(path.join(TMP, id + '-' + mode))) continue;
    execFileSync('node', [path.join(D, 'build.cjs'), id], { env: { ...process.env, MODE: mode, OUT: TMP }, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]), f = u.startsWith('/tmp/') ? path.join(TMP, u.slice(5)) : path.join(D, u);
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(d); });
  }).listen(0);
  const port = srv.address().port, b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:${port}/bake.html`); await p.waitForFunction(() => window.ready);
  const { NodeIO } = await import('@gltf-transform/core'), { ALL_EXTENSIONS, EXTTextureWebP } = await import('@gltf-transform/extensions');
  const { quantize, meshopt, dedup, prune } = await import('@gltf-transform/functions'), { MeshoptEncoder } = await import('meshoptimizer');
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  for (const id of ids) {
    const rel = (m) => '/tmp/' + path.relative(TMP, glbIn(path.join(TMP, id + '-' + m)));
    const r = await p.evaluate(([a, w, o]) => window.bake(a, w, o), [rel('body'), rel('wheel'), { police: clsOf(id) === 'police' || clsOf(id) === 'cart', livery: LIVERY.has(id), ratio: RATIO, err: ERR, far: FAR, maxTex: 512, maxPaint: 512 }]);
    const raw = path.join(TMP, id + '-game.glb'); fs.writeFileSync(raw, Buffer.from(r.glb, 'base64'));
    const doc = await io.read(raw);
    doc.createExtension(EXTTextureWebP).setRequired(true);
    for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) { const t = pr.getMaterial() && pr.getMaterial().getBaseColorTexture(), w = r.webp[m.getName()] || r.webp[pr.getMaterial().getName()]; if (t && w) t.setImage(Buffer.from(w, 'base64')).setMimeType('image/webp'); }
    await doc.transform(dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    const out = path.join(GAME_DIR, id + '.glb'); await io.write(out, doc);
    const wo = JSON.parse(fs.readFileSync(path.join(TMP, id + '-body', 'wheel.json'), 'utf8')), R = roster[id] || {};
    const [mn, mx] = r.info.bb;
    index[id] = { cls: clsOf(id), name: R.name || id, real: R.real || '', year: R.year, top: R.top, acc: R.acc,
      len: +(mx[2] - mn[2]).toFixed(3), wid: +(2 * Math.max(-mn[0], mx[0], wo.x + wo.w / 2)).toFixed(3), h: +(mx[1]).toFixed(3),
      wr: wo.r, wx: wo.x, axles: wo.axles, roofY: +r.info.roofY.toFixed(3), roofZ: +(((mn[2] + mx[2]) / 2) * 0.5).toFixed(3),
      glows: r.info.glows.map((g) => g.map((v, i) => (i < 3 ? +v.toFixed(3) : v))), stock: r.info.stock, livery: LIVERY.has(id) };
    console.log(id, 'tris', r.info.tris, 'far', r.info.farTris, 'kb', Math.round(fs.statSync(out).size / 1024));
  }
  fs.writeFileSync(idxPath, JSON.stringify(index, null, 1));
  // the game imports every baked model through this generated module (src/js/vehicles.js)
  const all = Object.keys(index).filter((id) => fs.existsSync(path.join(GAME_DIR, id + '.glb')));
  fs.writeFileSync(path.join(GAME_DIR, 'index.js'), '// generated by tools/vehicles/bake.cjs\n' + all.map((id) => `import ${id} from './${id}.glb';`).join('\n') +
    `\nimport INDEX from './index.json';\nexport const GLB = { ${all.join(', ')} };\nexport { INDEX };\n`);
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
