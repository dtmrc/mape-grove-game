// Render the worker in its rest pose from the tracebench project: textured, wireframe overlay, 4 views + exploded parts
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const proj = fs.readFileSync('/mnt/project-files/tools/tracebench/models/worker/Worker.tracebench.json', 'utf8');
  const three = path.resolve('/root/cat-3d/node_modules/three');
  const html = `<!doctype html><body style="margin:0;background:#334"><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script>
  <script type="module">
  import * as THREE from 'three';
  const proj = await (await fetch('/proj.json')).json();
  const dec = (s, T) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(420, 700); document.body.appendChild(r.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a4450);
  const root = new THREE.Group(); scene.add(root);
  const parts = [];
  for (const o of proj.scene) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(dec(o.geometry.position, Float32Array), 3)); g.setAttribute('uv', new THREE.BufferAttribute(dec(o.geometry.uv, Float32Array), 2)); g.setIndex(new THREE.BufferAttribute(dec(o.geometry.index, Uint32Array), 1));
    const img = new Image(); img.src = o.texture; await img.decode(); const tex = new THREE.Texture(img); tex.needsUpdate = true; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = true;
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex })); m.applyMatrix4(new THREE.Matrix4().fromArray(o.matrix)); m.name = o.name;
    const w = new THREE.LineSegments(new THREE.EdgesGeometry(g, 15), new THREE.LineBasicMaterial({ color: 0x101418 })); w.applyMatrix4(new THREE.Matrix4().fromArray(o.matrix)); m.userData.wire = w;
    root.add(m); root.add(w); parts.push(m);
  }
  const cv = document.createElement('canvas'); cv.width = 420 * 4; cv.height = 700; const ctx = cv.getContext('2d');
  const cam = new THREE.OrthographicCamera(-0.62, 0.62, 1.03, -1.03, 0.1, 50);
  const views = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [0.75, 0.3, 0.75]];
  views.forEach((v, i) => { cam.position.set(v[0] * 10, 1 + v[1] * 10, v[2] * 10); cam.lookAt(0, 0.98, 0); r.render(scene, cam); ctx.drawImage(r.domElement, i * 420, 0); });
  // exploded: spread the parts out along x
  const cv2 = document.createElement('canvas'); cv2.width = 1680; cv2.height = 700; const c2 = cv2.getContext('2d');
  const order = ['Skin', 'Shirt', 'Shirt trim', 'Vest', 'Vest shoulders', 'Jeans', 'Boots', 'Hat'];
  const cam2 = new THREE.OrthographicCamera(-2.4, 2.4, 1.0, -1.0, 0.1, 50); cam2.position.set(3, 4, 10); cam2.lookAt(0, 1, 0);
  parts.forEach((m) => { const k = order.indexOf(m.name); const dx = (k - 3.5) * 0.6; m.position.x += dx; m.userData.wire.position.x += dx; });
  r.setSize(1680, 700); r.render(scene, cam2); c2.drawImage(r.domElement, 0, 0);
  c2.fillStyle = '#fff'; c2.font = 'bold 20px sans-serif'; order.forEach((n, k) => { const x = 840 + (k - 3.5) * 0.6 * 350; c2.fillText(n, x - 40, 680); });
  window.out1 = cv.toDataURL('image/png'); window.out2 = cv2.toDataURL('image/png'); window.done = true;
  </script></body>`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1700, height: 720 } }); page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.route('**/*', (route) => { const u = new URL(route.request().url()); if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html }); if (u.pathname === '/proj.json') return route.fulfill({ body: proj, contentType: 'application/json' }); if (u.pathname.startsWith('/three/')) return route.fulfill({ body: fs.readFileSync(path.join(three, u.pathname.slice(7))), contentType: 'text/javascript' }); route.abort(); });
  await page.goto('http://x/'); await page.waitForFunction(() => window.done, null, { timeout: 90000 });
  fs.writeFileSync('/root/npc/worker/worker-wire.png', Buffer.from((await page.evaluate(() => window.out1)).split(',')[1], 'base64'));
  fs.writeFileSync('/root/npc/worker/worker-parts.png', Buffer.from((await page.evaluate(() => window.out2)).split(',')[1], 'base64'));
  await browser.close(); console.log('ok');
})();
