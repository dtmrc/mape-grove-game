// Car showroom: every CAR_TYPES model (plus the role variants the game spawns) on a turntable grid, for review sheets.
// node tools/cars/build.mjs && node tools/cars/shoot.cjs <out.png>
import * as THREE from 'three';
import { makeTextures, mat } from '../../src/js/gfx.js';
import { setTextures, makeCar, CAR_TYPES } from '../../src/js/models.js';
const T = makeTextures(); setTextures(T);
const W = 3000, H = 1650;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfe4e8);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(-6, 10, 8); scene.add(sun);
const hoa = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#1e2a44'; g.fillRect(0, 0, 320, 80); g.fillStyle = '#fff'; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.fillText('HOA', 160, 60); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
export const LINEUP = [
  ['sedan', 0x2e6fbf, {}], ['hatch', 0xe0b030, {}], ['wagon', 0x8a6a4a, {}], ['pickup', 0xc0392b, {}], ['suv', 0x2a2a2e, {}], ['golfcart', 0xffffff, { canopy: 0x2050a0 }],
  ['sedan', 0xf2f2f2, { lightbar: true }], ['suv', 0xffffff, { canopy: 0x1e2a44, lightbar: true, label: hoa }], ['golfcart', 0xffffff, { canopy: 0x1e2a44, lightbar: true }],
];
const COLS = 3, CW = 13, CD = 7.2;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat(0xc8ccd0)); floor.rotation.x = -Math.PI / 2; scene.add(floor);
LINEUP.forEach(([t, c, o], i) => {
  const car = makeCar(t, c, o), col = i % COLS, row = (i / COLS) | 0;
  car.position.set((col - 1) * CW - 2.2, 0, (row - 1) * CD); car.rotation.y = -0.65; scene.add(car);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), mat(0xb4b9be)); pad.rotation.x = -Math.PI / 2; pad.position.set(car.position.x, 0.01, car.position.z); scene.add(pad);
});
const cam = new THREE.OrthographicCamera(-21, 21, 21 * H / W, -21 * H / W, 0.1, 200);
cam.position.set(1.4, 22, 26.6); cam.lookAt(1.4, 0, 0.0); cam.updateProjectionMatrix();
renderer.render(scene, cam);
// screen positions of each pad for the sheet labels
window.__labels = LINEUP.map((_, i) => { const col = i % COLS, row = (i / COLS) | 0; const v = new THREE.Vector3((col - 1) * CW - 2.2 + 4.2, 0, (row - 1) * CD - 1.2).project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; });
window.__specs = Object.fromEntries(Object.entries(CAR_TYPES));
window.__done = true;
