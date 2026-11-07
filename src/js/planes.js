// Airliners that cross the sky every so often and leave contrails ("chemtrails") that form a little
// behind the engines, spread out, drift with the wind and slowly fade. Now and then there's a
// "chemtrail day": two or three planes in parallel lanes or a criss-cross.
// Everything lives high above the camera, ignores fog, and fades with distance so nothing pops in
// at the camera's far plane. Driven from fx.js: planes.update(dt, time, ctx).
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const FAR = 182;                 // camera far is 190: fade out before it
const MAXP = 260;                // trail points per trail
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function softTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 4;
  const g = c.getContext('2d'), img = g.createImageData(64, 4);
  for (let x = 0; x < 64; x++) {
    const d = Math.abs(x / 63 - 0.5) * 2, a = Math.pow(1 - d, 1.5) * (0.85 + 0.15 * Math.sin(x * 1.7));
    for (let y = 0; y < 4; y++) { const o = (y * 64 + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.max(0, a) * 255; }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function planeMesh(glow) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0xdfe3ea, fog: false, transparent: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x8a92a0, fog: false, transparent: true });
  const add = (geo, m, x, y, z) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); g.add(k); return k; };
  add(new THREE.CylinderGeometry(0.55, 0.45, 9, 6).rotateX(Math.PI / 2), body, 0, 0, 0);
  add(new THREE.ConeGeometry(0.55, 1.4, 6).rotateX(Math.PI / 2), body, 0, 0, 5.2);
  add(new THREE.BoxGeometry(11, 0.14, 1.6), body, 0, -0.15, 0.4);
  add(new THREE.BoxGeometry(3.6, 0.12, 0.9), body, 0, 0.1, -4.1);
  add(new THREE.BoxGeometry(0.14, 1.9, 1.3), dark, 0, 1.0, -4.0);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.28, 0.28, 1.4, 6).rotateX(Math.PI / 2), dark, s * 2.6, -0.45, 0.9);
  const lt = (c, x, y, z) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.position.set(x, y, z); sp.scale.setScalar(3.2); g.add(sp); return sp; };
  g.userData = { mats: [body, dark], red: lt(0xff3030, -5.6, -0.1, 0.3), green: lt(0x30ff60, 5.6, -0.1, 0.3), strobe: lt(0xffffff, 0, 1.9, -4.4), beacon: lt(0xff2020, 0, -0.7, 0) };
  g.scale.setScalar(1.25);
  return g;
}

export function makePlanes({ scene, camera, T, sky }) {
  const tex = softTex();
  const planes = [], trails = [];
  let nextT = rand(20, 45);   // the first one shows up fairly soon

  function makeTrail(life) {
    const cap = MAXP * 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(cap * 2); for (let i = 0; i < MAXP; i++) { uv[i * 4] = 0; uv[i * 4 + 2] = 1; uv[i * 4 + 1] = uv[i * 4 + 3] = i * 0.1; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = []; for (let i = 0; i < MAXP - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
    const tr = { mesh: m, pts: [], life, done: false };
    trails.push(tr); return tr;
  }

  function spawn(x, z, hx, hz, alt, o = {}) {
    const mesh = planeMesh(T.glow); scene.add(mesh);
    const engines = o.four ? [-4.2, -2.6, 2.6, 4.2] : [-2.6, 2.6];
    const p = { mesh, x, z, y: alt, hx, hz, v: o.v || rand(20, 26), t: 0, dist: o.dist || 420, ph: Math.random() * 10,
      trails: o.trail === false ? [] : engines.map((off) => ({ off, tr: makeTrail(o.life || rand(70, 110)), acc: 0 })) };
    mesh.rotation.y = Math.atan2(hx, hz);
    planes.push(p); return p;
  }

  // route through the sky near the camera: closest approach `off` metres to the side
  function route(ang, off, alt, o) {
    const c = camera.position, hx = Math.sin(ang), hz = Math.cos(ang), half = (o.dist || 420) / 2;
    return spawn(c.x - hx * half + hz * off, c.z - hz * half - hx * off, hx, hz, alt, o);
  }
  function sendOne(o = {}) {
    const trail = o.trail ?? Math.random() < 0.75;
    return route(rand(0, Math.PI * 2), rand(-70, 70), camera.position.y + rand(92, 118), { ...o, trail, four: Math.random() < 0.35 });
  }
  function chemDay() {
    const ang = rand(0, Math.PI * 2), alt = camera.position.y + rand(100, 115);
    if (Math.random() < 0.5) { // parallel lanes
      for (let i = 0; i < 3; i++) route(ang, -60 + i * 55 + rand(-6, 6), alt + i * 3, { life: rand(150, 200), dist: 420 + i * 40, v: 23 });
    } else {                    // criss-cross: an X over town
      route(ang, rand(-20, 20), alt, { life: rand(150, 200) });
      route(ang + rand(1.1, 1.6), rand(-25, 25), alt + 4, { life: rand(150, 200), dist: 480 });
    }
  }
  addEventListener('fx:plane', (e) => (e.detail === 'chem' ? chemDay() : sendOne({ trail: true })));

  const col = new THREE.Color(), tint = new THREE.Color(), v3 = new THREE.Vector3();
  return {
    planes, trails, sendOne, chemDay,
    update(dt, time, { nightK, cover = 0, wind }) {
      if (dt > 0 && (nextT -= dt) <= 0) {
        nextT = rand(45, 120);
        if (Math.random() < 0.18) chemDay(); else sendOne();
      }
      const cam = camera.position, day = 1 - nightK;
      // contrail colour: white by day, warm at sunrise/sunset, faint blue-grey under the moon
      const glow = sky.u.uGlow ? sky.u.uGlow.value : tint.set(0, 0, 0);
      col.setRGB(0.95, 0.96, 1.0).multiplyScalar(0.2 + 0.8 * day).add(tint.copy(glow).multiplyScalar(0.9)).add(tint.setRGB(0.1, 0.11, 0.16).multiplyScalar(nightK));
      const skyA = (0.35 + 0.65 * day) * (1 - cover * 0.85);
      let loud = 0;

      // fly the planes and lay down trail points
      for (let i = planes.length - 1; i >= 0; i--) {
        const p = planes[i];
        p.t += dt; p.x += p.hx * p.v * dt; p.z += p.hz * p.v * dt;
        const m = p.mesh, U = m.userData;
        m.position.set(p.x, p.y, p.z);
        m.rotation.z = Math.sin(time * 0.3 + p.ph) * 0.03;
        const d = Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z);
        const a = smooth(FAR, FAR - 30, d) * (1 - cover * 0.9);
        for (const mt of U.mats) mt.opacity = a * (0.4 + 0.6 * day);
        const n = nightK * 0.7 + 0.3;
        U.red.material.opacity = U.green.material.opacity = a * n;
        U.strobe.material.opacity = a * (((time + p.ph) % 1.2) < 0.07 ? 1 : 0);
        U.beacon.material.opacity = a * n * (((time + p.ph) % 1.6) < 0.25 ? 1 : 0.1);
        m.visible = a > 0.01;
        loud = Math.max(loud, smooth(170, 95, d) * (1 - cover * 0.5));
        for (const e of p.trails) {
          e.acc -= dt;
          if (e.acc <= 0 && e.tr.pts.length < MAXP) {
            e.acc = 0.45;
            const rx = p.hz, rz = -p.hx, back = 9;   // engine position, a short gap behind the plane
            e.tr.pts.push({ x: p.x + rx * e.off * 1.25 - p.hx * back, y: p.y - 0.4, z: p.z + rz * e.off * 1.25 - p.hz * back, t: time, hx: p.hx, hz: p.hz });
          }
        }
        if (p.t * p.v > p.dist) {
          scene.remove(m); planes.splice(i, 1);
          for (const e of p.trails) e.tr.done = true;
        }
      }

      // rebuild trail ribbons: widen and fade with age, drift with the wind, fade by distance
      const wx = wind ? wind.x : 0.6, wz = wind ? wind.y : 0.2;
      for (let i = trails.length - 1; i >= 0; i--) {
        const tr = trails[i], P = tr.pts;
        while (P.length && time - P[0].t > tr.life) P.shift();
        if (!P.length) {
          if (tr.done) { scene.remove(tr.mesh); tr.mesh.geometry.dispose(); tr.mesh.material.dispose(); trails.splice(i, 1); } else tr.mesh.geometry.setDrawRange(0, 0);
          continue;
        }
        const pos = tr.mesh.geometry.attributes.position.array, cc = tr.mesh.geometry.attributes.color.array;
        for (let k = 0; k < P.length; k++) {
          const q = P[k], age = time - q.t, f = age / tr.life;
          const w = 0.7 + age * 0.16 + age * age * 0.0006;
          const x = q.x + wx * age * 0.6 + Math.sin(q.t * 0.7 + age * 0.05) * age * 0.04, z = q.z + wz * age * 0.6, y = q.y - age * 0.02;
          const sx = q.hz * w * 0.5, sz = -q.hx * w * 0.5, o = k * 6;   // horizontal ribbon across the flight path
          pos[o] = x - sx; pos[o + 1] = y; pos[o + 2] = z - sz;
          pos[o + 3] = x + sx; pos[o + 4] = y; pos[o + 5] = z + sz;
          v3.set(x - cam.x, y - cam.y, z - cam.z);
          const ends = k === 0 || k === P.length - 1 ? 0 : 1;           // taper both ends
          const form = Math.min(1, age * 1.5);                             // condenses just behind the plane
          const al = form * Math.pow(1 - f, 1.3) * smooth(FAR, FAR - 35, v3.length()) * skyA * 0.75 * ends;
          const c4 = k * 8;
          for (const s of [0, 4]) { cc[c4 + s] = col.r; cc[c4 + s + 1] = col.g; cc[c4 + s + 2] = col.b; cc[c4 + s + 3] = al; }
        }
        tr.mesh.geometry.attributes.position.needsUpdate = true; tr.mesh.geometry.attributes.color.needsUpdate = true;
        tr.mesh.geometry.setDrawRange(0, Math.max(0, P.length - 1) * 6);
      }
      return loud;
    },
  };
}
