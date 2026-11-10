import * as THREE from 'three';
import { buildNPC as buildNPC0, buildMannequin, randomRecipe, defaultRecipe } from '../src/npcgen.js';
const buildNPC = (rec) => { const n = rec && rec.kind === 'mannequin' ? buildMannequin(rec) : buildNPC0(rec); if (rec && rec.wire) n.mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(n.mesh.geometry, 10), new THREE.LineBasicMaterial({ color: 0x202428 }))); return n; };
const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
document.body.style.margin = 0; document.body.appendChild(r.domElement);
window.renderSheet = (recipes, opts = {}) => {
  const cell = opts.cell || 180, views = opts.views || [[0, 0, 1], [1, 0, 0], [0.6, 0.35, 0.75]];
  const cols = recipes.length, W = cell * views.length * cols, Hh = cell * 1.6;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a5568'; ctx.fillRect(0, 0, W, Hh);
  r.setSize(cell, Hh);
  const scene = new THREE.Scene();
  const Z = opts.focus === 'head' ? 0.28 : opts.focus === 'hips' ? 0.32 : opts.focus === 'hand' ? 0.13 : opts.focus === 'wide' ? 1.0 : opts.focus === 'shoulder' ? 0.16 : 0.6, cy0 = opts.focus === 'shoulder' ? 1.3 : opts.focus === 'head' ? 1.6 : opts.focus === 'hips' ? 0.95 : opts.focus === 'hand' ? 1.36 : 0.9, cx0 = opts.focus === 'hand' ? 0.8 : opts.focus === 'shoulder' ? 0.19 : 0;
  const cam = new THREE.OrthographicCamera(-Z, Z, Z * 1.6, -Z * 1.6, 0.1, 50);
  const info = [];
  recipes.forEach((rec, i) => {
    const npc = buildNPC(rec); scene.add(npc.root);
    if (opts.clip === 'T') { /* bind pose */ } else if (opts.clip) { npc.play(opts.clip); npc.update(opts.time ?? 0.4); } else if (opts.idle !== false) { npc.play('Idle'); npc.update(0.01); }
    npc.root.updateMatrixWorld(true);
    views.forEach((v, k) => { cam.position.set(cx0 + v[0] * 10, cy0 + v[1] * 10, v[2] * 10); cam.lookAt(cx0, cy0, 0); r.render(scene, cam); ctx.drawImage(r.domElement, (i * views.length + k) * cell, 0); });
    info.push({ name: rec.name || rec.sex + '/' + rec.build, tris: npc.tris, height: +npc.height.toFixed(2) });
    scene.remove(npc.root);
  });
  window.atlas = (() => { const n = buildNPC(recipes[0]); return n.texture.image.toDataURL(); })();
  window.sheet = cv.toDataURL('image/png'); window.info = info;
};
window.randomRecipe = randomRecipe; window.defaultRecipe = defaultRecipe;
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
window.exportGLB = (recipe) => new Promise((res, rej) => { const n = buildNPC(recipe); new GLTFExporter().parse(n.root, (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); res(btoa(s)); }, rej, { binary: true, animations: n.clips }); });
window.thumb = (recipe, size = 96) => {
  const c = document.createElement('canvas'); c.width = size; c.height = Math.round(size * 1.5);
  const r2 = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, canvas: c });
  const sc = new THREE.Scene(); const n2 = buildNPC(recipe); n2.play('Idle'); n2.update(0.01); sc.add(n2.root);
  const oc = new THREE.OrthographicCamera(-0.6, 0.6, n2.height / 2 + 0.95, n2.height / 2 - 0.95, 0.1, 20);
  oc.position.set(2.5, n2.height / 2 + 0.6, 6); oc.lookAt(0, n2.height / 2, 0);
  r2.setSize(c.width, c.height, false); r2.render(sc, oc); const url = c.toDataURL('image/png'); n2.dispose(); r2.dispose(); return url;
};
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// side by side with a reference GLB (base64), both at the same scale: front, side, 3/4
window.compare = (b64, recipe, out = { cell: 360 }) => new Promise((res) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  new GLTFLoader().parse(bin, '', (g) => {
    g.scene.traverse((o) => { if (o.isMesh && o.material.map) { o.material.map.magFilter = o.material.map.minFilter = THREE.NearestFilter; } });
    const ref = g.scene; const mixer = new THREE.AnimationMixer(ref); const idle = g.animations.find((a) => a.name === 'Idle'); if (idle) { mixer.clipAction(idle).play(); mixer.update(0.01); }
    const npc = buildNPC(recipe); npc.play('Idle'); npc.update(0.01);
    const scene = new THREE.Scene(); ref.position.x = -0.55; npc.root.position.x = 0.55; scene.add(ref, npc.root);
    const cell = out.cell, views = [[0, 0, 1], [1, 0, 0], [0.7, 0.3, 0.7]];
    const cv = document.createElement('canvas'); cv.width = cell * 1.5 * views.length; cv.height = cell * 1.5; const ctx = cv.getContext('2d'); ctx.fillStyle = '#4a5568'; ctx.fillRect(0, 0, cv.width, cv.height);
    r.setSize(cell * 1.5, cell * 1.5);
    const cam = new THREE.OrthographicCamera(-1.15, 1.15, 1.15, -1.15, 0.1, 50);
    views.forEach((v, k) => { cam.position.set(v[0] * 10, 1.0 + v[1] * 10, v[2] * 10); cam.lookAt(0, 1.0, 0); r.render(scene, cam); ctx.drawImage(r.domElement, k * cell * 1.5, 0); });
    res(cv.toDataURL('image/png'));
  });
});
window.buildNPCDebug = buildNPC;
