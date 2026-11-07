// Environmental effects: weather (rain, splashes, wet streets, lamp reflections, storms with lightning and
// thunder, wind, fog nights), plus its synthesized ambience. Self-contained: game.js calls makeFX once and
// fx.update(dt) every frame AFTER updateSky/updateLights, so everything here is applied on top of the
// day/night values those functions write fresh each frame.
import * as THREE from 'three';
import { makeDayNight, makeTimeDebug } from './daynight.js';
import { makePlanes } from './planes.js';
import { heightAt, heightTex, TX0, TZ0, TCELL, TN } from './terrain.js';

// GLSL: bilinear terrain height from the engine's heightfield texture (matches terrain.js heightAt)
const TH_GLSL = `uniform sampler2D uHT;
  float th(vec2 xz){ vec2 g = clamp((xz - vec2(${TX0.toFixed(1)}, ${TZ0.toFixed(1)})) / ${TCELL.toFixed(1)}, vec2(0.0), vec2(${(TN - 1.001).toFixed(3)}));
    vec2 i = floor(g), f = g - i; const float N = ${TN.toFixed(1)};
    float a = texture2D(uHT, (i + 0.5) / N).r, b = texture2D(uHT, (i + vec2(1.0, 0.0) + 0.5) / N).r;
    float c = texture2D(uHT, (i + vec2(0.0, 1.0) + 0.5) / N).r, d = texture2D(uHT, (i + vec2(1.0, 1.0) + 0.5) / N).r;
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
`;

// Weather is off by default; the pause menu (ui.js) turns it on at runtime via fx.setWeather(bool) and persists
// the choice in the shared settings key, read back here at startup (O key cycles the weather while it is on).
let WEATHER_ON = false;
try { WEATHER_ON = !!(JSON.parse(localStorage.getItem('maple-grove-offleash-settings') || 'null') || {}).weather; } catch (e) { /* storage blocked */ }

const KEY = 'maple-grove-offleash-fx';
export const WEATHERS = {
  clear: { name: 'Clear', rain: 0, cover: 0, fog: 0, wind: 0.15, bolt: 0 },
  cloudy: { name: 'Overcast', rain: 0, cover: 0.65, fog: 0.1, wind: 0.35, bolt: 0 },
  drizzle: { name: 'Drizzle', rain: 0.3, cover: 0.75, fog: 0.25, wind: 0.25, bolt: 0 },
  rain: { name: 'Rain', rain: 0.7, cover: 0.85, fog: 0.3, wind: 0.5, bolt: 0 },
  storm: { name: 'Thunderstorm', rain: 1, cover: 1, fog: 0.35, wind: 0.95, bolt: 1 },
  fog: { name: 'Fog', rain: 0, cover: 0.55, fog: 1, wind: 0.05, bolt: 0 },
};
const ORDER = ['clear', 'cloudy', 'drizzle', 'rain', 'storm', 'fog'];
const NEXT = {
  clear: [['clear', 2], ['cloudy', 3], ['fog', 1]],
  cloudy: [['clear', 2], ['drizzle', 3], ['rain', 1], ['fog', 1]],
  drizzle: [['cloudy', 2], ['rain', 3]],
  rain: [['drizzle', 2], ['storm', 2], ['cloudy', 1]],
  storm: [['rain', 3]],
  fog: [['clear', 2], ['cloudy', 2]],
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => { let s = list.reduce((a, b) => a + b[1], 0) * Math.random(); for (const [k, w] of list) if ((s -= w) <= 0) return k; return list[0][0]; };
const approach = (v, t, r) => v + (t - v) * Math.min(1, r);

// soft cloudy puff for fog banks
function puffTex() {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), img = g.createImageData(s, s);
  const h = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  const n = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, k = y - j, u = f * f * (3 - 2 * f), w = k * k * (3 - 2 * k);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - w) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * w; };
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.min(1, Math.hypot(x / s - 0.5, y / s - 0.5) * 2);
    const f = n(x / 9, y / 9) * 0.5 + n(x / 4.5, y / 4.5) * 0.3 + n(x / 2.2, y / 2.2) * 0.2;
    const a = Math.pow(1 - d, 1.6) * (0.45 + f * 0.75);
    const o = (y * s + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.min(255, a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- synthesized ambience (own audio graph; mirrors the game's M mute key) ----------
function makeAudio() {
  let ctx = null, master = null, on = true, planeG, rainHi, rainLo, wind, windF;
  function loopNoise(dur, brown) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = brown ? (last + 0.02 * w) / 1.02 : w; d[i] = brown ? last * 3.5 : w; }
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; return s;
  }
  function chain(src, ...nodes) { let a = src; for (const n of nodes) { a.connect(n); a = n; } a.connect(master); }
  function filt(type, f, q = 0.7) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
  const A = {
    unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = gain(on ? 1 : 0); master.connect(ctx.destination);
        const s1 = loopNoise(2.3), s2 = loopNoise(3.1, true), s3 = loopNoise(4.2, true);
        rainHi = gain(); rainLo = gain(); wind = gain(); windF = filt('bandpass', 350, 0.9);
        chain(s1, filt('highpass', 900), filt('lowpass', 6500), rainHi);
        chain(s2, filt('lowpass', 700), rainLo);
        chain(s3, windF, wind);
        s1.start(); s2.start(); s3.start();
        const s4 = loopNoise(5.3, true); planeG = gain(); chain(s4, filt('lowpass', 240), planeG); s4.start();
      } catch (e) { ctx = null; }
    },
    toggle() { on = !on; if (master) master.gain.value = on ? 1 : 0; },
    setOn(v) { on = !!v; if (master) master.gain.value = on ? 1 : 0; },
    set(rain, w, gust) {
      if (!ctx) return;
      const t = ctx.currentTime;
      rainHi.gain.setTargetAtTime(rain * 0.11, t, 0.4);
      rainLo.gain.setTargetAtTime(rain * 0.16, t, 0.4);
      wind.gain.setTargetAtTime(w * (0.25 + gust * 0.75) * 0.22, t, 0.3);
      windF.frequency.setTargetAtTime(220 + gust * 520, t, 0.3);
    },
    plane(v) { if (ctx) planeG.gain.setTargetAtTime(v * 0.2, ctx.currentTime, 0.8); },
    thunder(dist) { // dist 0 (overhead) .. 1 (far)
      if (!ctx || !on) return;
      const t = ctx.currentTime, dur = 3.5 + dist * 2.5, n = Math.floor(ctx.sampleRate * dur);
      const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const p = i / n, w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04;
        const rumble = 0.6 + 0.4 * Math.sin(p * 37 + Math.sin(p * 11) * 3);
        const crack = dist < 0.4 && p < 0.04 ? w * (1 - p / 0.04) * 0.8 : 0;
        d[i] = (last * 6 * rumble + crack) * Math.pow(1 - p, 1.6) * Math.min(1, p * 40);
      }
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = filt('lowpass', 900 - dist * 600); f.frequency.setValueAtTime(1400 - dist * 900, t); f.frequency.exponentialRampToValueAtTime(140, t + dur);
      const g = gain(0.9 - dist * 0.5);
      chain(s, f, g); s.start(t);
    },
  };
  return A;
}

export function makeFX(o) {
  const { scene, camera, sky, hemi, sun, moon, M, lights } = o;
  const audio = makeAudio();
  const unlock = () => audio.unlock();
  addEventListener('pointerdown', unlock); addEventListener('touchstart', unlock); addEventListener('keydown', unlock);

  // ----- weather state -----
  let cur = WEATHER_ON ? 'rain' : 'clear', left = rand(150, 300);
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (WEATHER_ON && s && WEATHERS[s.w]) { cur = s.w; left = s.left || left; } } catch (e) { /* storage blocked */ }
  const S = { ...WEATHERS[cur] };   // smoothed values
  let wet = S.rain > 0 ? 1 : 0, rate = 1 / 25, snapT = 0, wetApplied = -1, rainShown = true, banksShown = true; // P15: last applied states
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ w: cur, left })); } catch (e) { /* ignore */ } };
  let label;
  function setWeather(w, snap) {
    cur = w; left = rand(150, 330); persist();
    if (snap) snapT = 4;
    if (label) label.textContent = WEATHERS[w].name.toUpperCase();
  }

  // HUD label under the clock + a help line on the title card
  label = document.createElement('div');
  label.id = 'wx'; label.style.cssText = 'font-size:17px;opacity:.85;letter-spacing:1px;margin-top:-2px';
  label.textContent = WEATHERS[cur].name.toUpperCase();
  if (WEATHER_ON) document.getElementById('skyclock')?.after(label);
  const tbl = document.querySelector('#title table');
  if (tbl && WEATHER_ON) { const r = tbl.insertRow(-1); r.insertCell(0).textContent = 'O'; r.insertCell(1).textContent = 'change the weather'; }
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'o' && WEATHER_ON) setWeather(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length], true);
    if (k === 'm') audio.toggle();
  });

  // ----- sky dome: this module owns the shader (sun disc, sunset glow, turning star field, phased moon, clouds) -----
  const dn = makeDayNight(o), dbg = makeTimeDebug(o.G, dn);
  const planes = makePlanes(o);

  // ----- rain streaks (GPU: world-anchored drops wrapped into a box around the camera) -----
  const RN = 2600, BOX = 34, RH = 20;
  const rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2() }, uSpeed: { value: 19 }, uLen: { value: 0.045 },
    uBox: { value: BOX }, uH: { value: RH }, uHT: { value: heightTex }, uColor: { value: new THREE.Color(0.6, 0.65, 0.75) }, uAlpha: { value: 0.4 } };
  const rain = (() => {
    const pos = new Float32Array(RN * 6), end = new Float32Array(RN * 2);
    for (let i = 0; i < RN; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      pos.set([x, y, z, x, y, z], i * 6); end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: rainU, transparent: true, depthWrite: false,
      vertexShader: TH_GLSL + `uniform float uTime, uSpeed, uLen, uBox, uH; uniform vec3 uCam; uniform vec2 uWind; attribute float aEnd; varying float vA;
        void main(){
          vec3 s = position;
          float sp = uSpeed * (0.85 + 0.3 * fract(s.x * 91.7));
          float y = mod(s.y * uH - uTime * sp, uH);
          vec2 xz = s.xz * uBox + uWind * (uH - y) / sp;
          xz = uCam.xz + mod(xz - uCam.xz, uBox) - uBox * 0.5;
          vec3 p = vec3(xz.x, y - 0.5 + th(xz), xz.y);
          p -= vec3(uWind.x, -sp, uWind.y) * uLen * aEnd;
          vA = (1.0 - aEnd * 0.85) * smoothstep(0.0, 6.0, length(p - uCam) ) ;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(uColor, uAlpha * vA); }',
    });
    const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.renderOrder = 5; scene.add(l); return l;
  })();

  // ----- splashes on the ground -----
  const SN = 700, SBOX = 26;
  const splashU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: SBOX }, uColor: rainU.uColor, uAlpha: { value: 0 }, uScale: { value: 300 }, uHT: { value: heightTex } };
  const splash = (() => {
    const pos = new Float32Array(SN * 3);
    for (let i = 0; i < SN * 3; i++) pos[i] = Math.random();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: splashU, transparent: true, depthWrite: false,
      vertexShader: TH_GLSL + `uniform float uTime, uBox, uScale; uniform vec3 uCam; varying float vP;
        void main(){
          vec3 s = position;
          float cyc = uTime * (2.2 + s.z * 1.6) + s.y * 7.0;
          float k = floor(cyc); vP = fract(cyc);
          vec2 xz = s.xz * uBox + vec2(fract(k * 0.618 + s.x) , fract(k * 0.371 + s.y)) * uBox;
          xz = uCam.xz + mod(xz - uCam.xz, uBox) - uBox * 0.5;
          vec4 mv = viewMatrix * vec4(xz.x, 0.06 + th(xz), xz.y, 1.0);
          gl_PointSize = (0.08 + vP * 0.22) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vP;
        void main(){ vec2 q = gl_PointCoord - 0.5; q.y *= 2.2; float d = length(q) * 2.0;
          float ring = smoothstep(0.55, 0.8, d) * smoothstep(1.0, 0.85, d) + (1.0 - smoothstep(0.0, 0.35, d)) * (1.0 - vP);
          if (ring < 0.02) discard; gl_FragColor = vec4(uColor * 1.3, ring * uAlpha * (1.0 - vP)); }`,
    });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 4; scene.add(p); return p;
  })();

  // ----- wet-ground lamp reflections: long streaks pointing at the camera -----
  const refl = lights.filter((L) => L.y > 2 && L.y < 12);
  const reflMat = new THREE.MeshBasicMaterial({ map: o.T.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const rg = new THREE.PlaneGeometry(1, 1); rg.rotateX(-Math.PI / 2);
  const reflMesh = new THREE.InstancedMesh(rg, reflMat, Math.max(1, refl.length));
  reflMesh.frustumCulled = false; reflMesh.renderOrder = 3;
  const _c = new THREE.Color();
  refl.forEach((L, i) => reflMesh.setColorAt(i, _c.set(L.c).multiplyScalar(0.55 * Math.min(1.6, L.i || 1))));
  if (reflMesh.instanceColor) reflMesh.instanceColor.needsUpdate = true;
  scene.add(reflMesh);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function updateRefl() {
    const cx = camera.position.x, cz = camera.position.z;
    refl.forEach((L, i) => {
      const dx = cx - L.x, dz = cz - L.z, d = Math.hypot(dx, dz) || 1;
      const len = Math.min(14, 3 + L.y * 1.4 + d * 0.08), half = Math.min(len / 2, d * 0.45);
      _q.setFromAxisAngle(_up, Math.atan2(dx, dz));
      _v.set(L.x + dx / d * half, 0, L.z + dz / d * half); _v.y = heightAt(_v.x, _v.z) + 0.07;
      _s.set(0.9 + L.y * 0.12, 1, len);
      reflMesh.setMatrixAt(i, _m4.compose(_v, _q, _s));
    });
    reflMesh.instanceMatrix.needsUpdate = true;
  }

  // ----- wet materials: darker diffuse, glossier specular -----
  const wetMats = ['road', 'asphalt', 'crosswalk', 'sidewalk', 'metal'].filter((k) => M[k]).map((k) => ({ m: M[k], c: M[k].color.clone(), sp: M[k].specular.clone(), sh: M[k].shininess }));
  const dullMats = ['dirt', 'grass', 'shingle', 'wood', 'fence'].filter((k) => M[k]).map((k) => ({ m: M[k], c: M[k].color.clone() }));
  const wetSpec = new THREE.Color(0x9aa4c8);
  function applyWet(w) {
    for (const e of wetMats) { e.m.color.copy(e.c).multiplyScalar(1 - w * 0.42); e.m.specular.copy(e.sp).lerp(wetSpec, w); e.m.shininess = e.sh + w * 70; }
    for (const e of dullMats) e.m.color.copy(e.c).multiplyScalar(1 - w * 0.25);
  }

  // ----- low fog banks drifting around the camera -----
  const puff = puffTex(), FB = 26, FBOX = 80, banks = [];
  for (let i = 0; i < FB; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData = { x: rand(0, FBOX), z: rand(0, FBOX), y: rand(0.4, 2.2), s: rand(10, 18), v: rand(0.5, 1.2) };
    sp.renderOrder = 2; scene.add(sp); banks.push(sp);
  }

  // ----- lightning -----
  let strikeT = rand(4, 10), flash = 0, flashes = [], thunderQ = [];
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe8ecff, fog: false, transparent: true });
  const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 64), 3));
  const bolt = new THREE.LineSegments(boltGeo, boltMat); bolt.frustumCulled = false; bolt.visible = false; scene.add(bolt);
  function makeBolt(ang) {
    const p = boltGeo.attributes.position.array, R = 140;
    let x = camera.position.x + Math.sin(ang) * R, z = camera.position.z + Math.cos(ang) * R, y = 120, n = 0;
    const seg = (x2, y2, z2) => { if (n < 63) { p.set([x, y, z, x2, y2, z2], n * 3); n += 2; } };
    const gy = heightAt(x, z); while (y > gy && n < 46) { const nx = x + rand(-7, 7), ny = y - rand(6, 14), nz = z + rand(-4, 4); seg(nx, ny, nz);
      if (Math.random() < 0.18 && n < 56) { const bx = x, by = y, bz = z; const ex = nx + rand(-14, 14), ey = ny - rand(4, 12); p.set([bx, by, bz, ex, ey, nz], n * 3); n += 2; }
      x = nx; y = ny; z = nz; }
    boltGeo.setDrawRange(0, n); boltGeo.attributes.position.needsUpdate = true;
  }
  function strike() {
    const near = Math.random(), ang = rand(0, Math.PI * 2);
    const t0 = 0; flashes = [[t0, 0.07, 1], [t0 + 0.12, 0.05, 0.6], [t0 + 0.22 + Math.random() * 0.15, 0.09, 0.9]];
    flashes.T = 0; makeBolt(ang);
    thunderQ.push([0.4 + near * 2.6, near]);
  }

  let gustT = 0, windAng = rand(0, Math.PI * 2);
  const hor = new THREE.Color(), fogCol = new THREE.Color(), grey = new THREE.Color();
  const api = {
    get weather() { return cur; },
    set: (w) => WEATHERS[w] && setWeather(w, true),
    get weatherOn() { return WEATHER_ON; },
    // ui.js Settings > Weather: on picks a sky and starts the cycle, off fades back to clear
    setWeather(v) {
      v = !!v; if (v === WEATHER_ON) return; WEATHER_ON = v;
      if (v) { document.getElementById('skyclock')?.after(label); setWeather(pick(NEXT.clear), true); } else { label.remove(); setWeather('clear', true); }
    },
    mute: (m) => audio.setOn(!m), // ui.js Settings > Sound (the M key still toggles it on its own)
    dn, dbg, planes,
    get state() { return { ...S, wet, flash }; },
    update(dt, nightK, time) {
      dbg.apply(dt);
      dn.update(nightK);
      // advance weather
      if (WEATHER_ON && (left -= dt) <= 0) setWeather(pick(NEXT[cur]));
      const W = WEATHERS[cur], r = (snapT > 0 ? 1.2 : rate) * dt; snapT -= dt;
      for (const k of ['rain', 'cover', 'fog', 'wind', 'bolt']) S[k] = approach(S[k], W[k], r);
      wet = S.rain > 0.08 ? Math.min(1, wet + dt * (snapT > 0 ? 0.5 : 0.04) * (0.4 + S.rain)) : Math.max(0, wet - dt / (snapT > 0 ? 6 : 90));
      const day = 1 - nightK;

      // wind with gusts
      gustT += dt; windAng += dt * 0.01;
      const gust = 0.5 + 0.3 * Math.sin(gustT * 0.37) + 0.2 * Math.sin(gustT * 1.13 + 1.7);
      const wv = S.wind * (0.4 + gust * 0.9) * 7;
      rainU.uWind.value.set(Math.sin(windAng) * wv, Math.cos(windAng) * wv);

      // lightning envelope
      if (S.bolt > 0.6 && S.rain > 0.6 && (strikeT -= dt) <= 0) { strike(); strikeT = rand(5, 16); }
      flash = 0;
      if (flashes.length) {
        flashes.T += dt;
        for (const [t0, d, a] of flashes) if (flashes.T >= t0 && flashes.T < t0 + d) flash = Math.max(flash, a);
        if (flashes.T > 0.6) flashes = [];
      }
      bolt.visible = flash > 0.5;
      for (const q of thunderQ) q[0] -= dt;
      while (thunderQ.length && thunderQ[0][0] <= 0) audio.thunder(thunderQ.shift()[1]);

      // sky: overcast, greyed, stars hidden; blend into fog colour when foggy
      const sk = sky.u;
      sk.uCover.value = S.cover;
      sk.uStars.value *= 1 - Math.min(1, S.cover * 1.15);
      const desat = S.cover * 0.6;
      for (const c of [sk.uTop.value, sk.uHor.value, sk.uCloud.value]) { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; c.lerp(grey.setRGB(l, l, l * 1.08), desat).multiplyScalar(1 - S.cover * 0.3); }
      sk.uCloud.value.multiplyScalar(1 - S.cover * 0.35 + 0.0);

      // fog (P15: with no fog or rain every line below is a no-op, so only the colour copy for the fog banks is kept)
      const f = scene.fog;
      if (S.fog > 1e-4 || S.rain > 1e-4) {
        fogCol.copy(f.color).lerp(grey.setRGB(0.16 + day * 0.5, 0.17 + day * 0.52, 0.2 + day * 0.54), Math.max(S.fog, S.rain * 0.5));
        f.color.copy(fogCol);
        f.near = THREE.MathUtils.lerp(f.near * (1 - S.rain * 0.6), 1.5, S.fog);
        f.far = THREE.MathUtils.lerp(f.far * (1 - S.rain * 0.45), 46, S.fog);
        const fk = Math.max(S.fog, S.rain * 0.4);
        sk.uHor.value.lerp(fogCol, fk); sk.uTop.value.lerp(fogCol, fk * 0.7); sk.uCloud.value.lerp(fogCol, fk * 0.6);
      } else fogCol.copy(f.color);

      // light: overcast dims the sun and moon; lightning floods the scene
      sun.intensity *= 1 - S.cover * 0.65;
      moon.intensity *= 1 - S.cover * 0.7;
      hemi.intensity *= 1 - S.cover * 0.18;
      if (flash > 0) {
        hemi.intensity += flash * 2.6; hemi.color.lerp(grey.set(0xd0d8ff), flash * 0.8);
        for (const c of [sk.uTop.value, sk.uHor.value, sk.uCloud.value]) c.lerp(grey.set(0xb8c0e8), flash * 0.7);
        f.color.lerp(grey.set(0x8088b0), flash * 0.5);
      }

      // rain + splashes (P15: skipped while dry and already hidden)
      const cam = camera.position;
      if (S.rain > 1e-3 || rainShown) {
        rainU.uTime.value = splashU.uTime.value = time;
        rainU.uCam.value.copy(cam); splashU.uCam.value.copy(cam);
        const drops = Math.floor(RN * Math.min(1, S.rain * 1.05));
        rain.geometry.setDrawRange(0, drops * 2); rain.visible = drops > 0;
        rainU.uColor.value.setRGB(0.42 + day * 0.35, 0.46 + day * 0.35, 0.56 + day * 0.33).lerp(grey.set(0xffffff), flash * 0.6);
        rainU.uAlpha.value = 0.28 + day * 0.12 + flash * 0.3;
        splash.geometry.setDrawRange(0, Math.floor(SN * S.rain)); splash.visible = S.rain > 0.02;
        splashU.uAlpha.value = 0.55; splashU.uScale.value = o.renderHeight ? o.renderHeight() * 0.83 : 300;
        rainShown = rain.visible || splash.visible;
      }

      // wet ground (P15: materials only touched when the wetness changed)
      if (wet !== wetApplied) { applyWet(wet); wetApplied = wet; }
      reflMat.opacity = wet * (0.25 + nightK * 0.55);
      reflMesh.visible = reflMat.opacity > 0.02 && refl.length > 0;
      if (reflMesh.visible) updateRefl();

      // fog banks (P15: skipped while there is no fog and every bank is already hidden)
      const fbA = Math.max(S.fog * 0.32, S.rain * 0.06);
      if (fbA > 0.005 || banksShown) { banksShown = false; for (const sp of banks) {
        const u = sp.userData; u.x += rainU.uWind.value.x * dt * 0.15 * u.v + dt * 0.3 * u.v; u.z += rainU.uWind.value.y * dt * 0.15 * u.v;
        const x = cam.x + ((((u.x - cam.x) % FBOX) + FBOX * 1.5) % FBOX) - FBOX / 2, z = cam.z + ((((u.z - cam.z) % FBOX) + FBOX * 1.5) % FBOX) - FBOX / 2;
        sp.position.set(x, u.y + heightAt(x, z), z); sp.scale.set(u.s, u.s * 0.42, 1);
        const d = Math.hypot(x - cam.x, z - cam.z);
        sp.material.opacity = fbA * Math.min(1, Math.max(0, (d - 3) / 8)) * Math.min(1, Math.max(0, (FBOX / 2 - d) / 10));
        sp.material.color.copy(fogCol).multiplyScalar(1.25 + flash);
        sp.visible = sp.material.opacity > 0.005; if (sp.visible) banksShown = true;
      } }

      audio.set(Math.min(1, S.rain * 1.1), S.wind, gust);
      audio.plane(planes.update(dt, time, { nightK, cover: S.cover, wind: rainU.uWind.value }));
    },
  };
  return api;
}
