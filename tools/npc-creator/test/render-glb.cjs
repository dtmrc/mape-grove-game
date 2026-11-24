// node render-glb.cjs <in.glb> <out.png> [height]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [glb, out] = process.argv.slice(2);
  const three = path.resolve(process.env.HOME, 'cat-3d/node_modules/three');
  const html = `<!doctype html><body style="margin:0;background:#334"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
  <script type="module">
  import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  const r = new THREE.WebGLRenderer({antialias:false, preserveDrawingBuffer:true}); r.setSize(900,600); document.body.appendChild(r.domElement);
  const s = new THREE.Scene(); s.background = new THREE.Color(0x334455);
  const buf = await (await fetch('/model.glb')).arrayBuffer();
  new GLTFLoader().parse(buf, '', (g) => {
    const box = new THREE.Box3().setFromObject(g.scene); const h = box.max.y - box.min.y; const c = box.getCenter(new THREE.Vector3());
    g.scene.traverse(o => { if (o.isMesh && o.material.map) { o.material.map.magFilter = o.material.map.minFilter = THREE.NearestFilter; } });
    const views = [[0, 0, 1], [1, 0, 0], [0.7, 0.2, 0.7], [0, 0, -1]];
    const cam = new THREE.OrthographicCamera(-h*0.45*1.5, h*0.45*1.5, h*0.6, -h*0.6, 0.1, 50);
    const mixer = new THREE.AnimationMixer(g.scene); window.clips = g.animations.map(a => a.name);
    views.forEach((v, i) => { const grp = g.scene.clone(true); });
    // render 4 views side by side by moving the camera, compositing onto a canvas
    const cv = document.createElement('canvas'); cv.width = 900*4/3; cv.height = 600; const ctx = cv.getContext('2d');
    s.add(g.scene); r.setSize(300, 600); cam.left = -h*0.45*0.5; cam.right = h*0.45*0.5;
    cam.updateProjectionMatrix();
    views.forEach((v, i) => { cam.position.set(c.x + v[0]*10, c.y + v[1]*10, c.z + v[2]*10); cam.lookAt(c.x, c.y, c.z); r.render(s, cam); ctx.drawImage(r.domElement, i*300, 0); });
    document.body.appendChild(cv); window.done = cv.toDataURL('image/png'); window.info = {h, clips: window.clips, tris: (()=>{let t=0; g.scene.traverse(o=>{ if(o.isMesh){ const g2=o.geometry; t += (g2.index? g2.index.count: g2.attributes.position.count)/3; }}); return t;})(), bones: (()=>{let n=0; g.scene.traverse(o=>{ if(o.isBone) n++; }); return n;})()};
  });
  </script></body>`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
  await page.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html }); if (u.pathname === '/model.glb') return route.fulfill({ body: fs.readFileSync(glb), contentType: 'model/gltf-binary' }); if (u.pathname.startsWith('/three/')) { const p = path.join(three, u.pathname.slice(7)); return route.fulfill({ body: fs.readFileSync(p), contentType: 'text/javascript' }); } route.abort(); });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto('http://x/'); await page.waitForFunction(() => window.done, null, { timeout: 60000 });
  const data = await page.evaluate(() => window.done); fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(JSON.stringify(await page.evaluate(() => window.info))); await browser.close();
})();
