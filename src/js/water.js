// Lake water (2026-11-27): one opaque shader per water body, still one draw call each.
// - Reflects the live sky (same top/horizon colours as the dome), with a Fresnel blend over a shallow-to-deep body colour.
// - Two scrolling ripple normal maps; ripples calm down with distance so the far lake doesn't shimmer.
// - Sun and moon glints, and the nearest street/porch lamps streak across the water at night.
// - Shoreline: a per-body distance-to-shore texture (baked once when the shape changes) drives lapping foam and
//   lighter shallows near the bank.
// world.js makes the material (makeWaterMaterial); ground.js asks it for a per-body copy (forPoly);
// game.js calls bindWater once and updateWater every frame.
import * as THREE from 'three';
import { fbm } from './gfx.js';

const NL = 6;   // lamp reflections per frame
const U = {
  uTime: { value: 0 },
  uNrm: { value: null },
  uTop: { value: new THREE.Color(0x3f78c0) }, uHor: { value: new THREE.Color(0xb8d0e0) },
  uSunDir: { value: new THREE.Vector3(0.3, 0.9, 0.3).normalize() }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
  uMoonDir: { value: new THREE.Vector3(-0.3, 0.6, -0.3).normalize() }, uMoonCol: { value: new THREE.Color(0, 0, 0) },
  uAmb: { value: new THREE.Color(0.8, 0.85, 0.9) },
  uLP: { value: Array.from({ length: NL }, () => new THREE.Vector3(0, -999, 0)) },
  uLC: { value: Array.from({ length: NL }, () => new THREE.Color(0, 0, 0)) },
};

const VS = `
  varying vec3 vW;
  #include <fog_pars_vertex>
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FS = `
  uniform float uTime;
  uniform sampler2D uNrm, uSdf;
  uniform vec4 uBox;
  uniform vec3 uTop, uHor, uSunDir, uSunCol, uMoonDir, uMoonCol, uAmb;
  uniform vec3 uLP[${NL}];
  uniform vec3 uLC[${NL}];
  varying vec3 vW;
  #include <fog_pars_fragment>
  void main(){
    vec2 p = vW.xz;
    vec4 a = texture2D(uNrm, p * 0.085 + vec2(uTime * 0.011, uTime * 0.006));
    vec4 b = texture2D(uNrm, p * vec2(0.041, -0.041) + vec2(-uTime * 0.008, uTime * 0.010));
    vec3 V = cameraPosition - vW; float dist = length(V); V /= dist;
    vec2 slope = (a.xy + b.xy - 1.0) * mix(0.55, 0.12, clamp(dist / 90.0, 0.0, 1.0));
    vec3 n = normalize(vec3(slope.x, 1.0, slope.y));
    float shore = texture2D(uSdf, (p - uBox.xy) * uBox.zw).r * 14.0;   // metres from the bank
    // body colour: lighter, greener shallows by the bank, dark teal in the middle
    vec3 shallow = vec3(0.07, 0.16, 0.14), deep = vec3(0.008, 0.05, 0.085);
    vec3 body = mix(shallow, deep, smoothstep(0.4, 9.0, shore)) * uAmb;
    // reflection of the sky dome along the mirrored ray
    vec3 R = reflect(-V, n); R.y = abs(R.y);
    vec3 sky = mix(uHor, uTop, pow(R.y, 0.35)) * 0.9;
    float f = 1.0 - max(dot(V, n), 0.0);
    float fres = 0.05 + 0.85 * f * f * f * f;
    vec3 col = mix(body, sky, fres);
    // glints: sun, moon, nearby lamps
    float sd = max(dot(R, uSunDir), 0.0);
    col += uSunCol * (pow(sd, 380.0) * 6.0 + pow(sd, 40.0) * 0.18);
    float md = max(dot(R, uMoonDir), 0.0);
    col += uMoonCol * (pow(md, 300.0) * 4.0 + pow(md, 30.0) * 0.2);
    for (int i = 0; i < ${NL}; i++) {
      vec3 L = uLP[i] - vW; float d = length(L);
      float s = max(dot(R, L / d), 0.0);
      col += uLC[i] * (pow(s, 90.0) * 2.2 + pow(s, 12.0) * 0.12) / (1.0 + d * 0.05);
    }
    // lapping foam on the bank: a solid edge plus wavelets that roll in
    float hN = texture2D(uNrm, p * 0.31 + vec2(uTime * 0.02, 0.0)).a;
    float wave = 0.5 + 0.5 * sin(shore * 5.0 - uTime * 1.4 + hN * 3.0);
    float foam = (1.0 - smoothstep(0.05, 0.45, shore)) * 0.9 + smoothstep(0.85, 1.0, wave * hN * 1.5) * (1.0 - smoothstep(0.4, 1.5, shore)) * 0.6;
    col = mix(col, vec3(0.75, 0.8, 0.78) * uAmb * 1.15, clamp(foam, 0.0, 1.0) * 0.8);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

/** Tileable ripple map: xy = slope (0.5 = flat), a = height for foam breakup. */
function rippleTex() {
  const N = 128, H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = fbm(x / N, y / N, 6, 4) * 0.7 + fbm(x / N + 0.37, y / N + 0.11, 14, 2) * 0.3;
  const d = new Uint8Array(N * N * 4);
  const at = (x, y) => H[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = (at(x + 1, y) - at(x - 1, y)) * 4, sy = (at(x, y + 1) - at(x, y - 1)) * 4, i = (y * N + x) * 4;
    d[i] = Math.max(0, Math.min(255, 128 + sx * 127)); d[i + 1] = Math.max(0, Math.min(255, 128 + sy * 127)); d[i + 2] = 255; d[i + 3] = Math.max(0, Math.min(255, at(x, y) * 255));
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Distance-to-shore texture for one polygon (world x,z points). */
function shoreTex(P) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  x0 -= 1; z0 -= 1; x1 += 1; z1 += 1;
  const W = 128, Hh = Math.max(16, Math.min(128, Math.round(128 * (z1 - z0) / (x1 - x0)))), d = new Uint8Array(W * Hh * 4);
  const n = P.length;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) / W * (x1 - x0), z = z0 + (j + 0.5) / Hh * (z1 - z0);
    let inside = false, best = 1e9;
    for (let k = 0, m = n - 1; k < n; m = k++) {
      const [ax, az] = P[m], [bx, bz] = P[k];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
      const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L));
      best = Math.min(best, (x - ax - ex * t) ** 2 + (z - az - ez * t) ** 2);
    }
    const v = inside ? Math.min(1, Math.sqrt(best) / 14) : 0, o = (j * W + i) * 4;
    d[o] = d[o + 1] = d[o + 2] = Math.round(v * 255); d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, W, Hh, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return { tex: t, box: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)) };
}

function material(sdf) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...U, uSdf: { value: sdf.tex }, uBox: { value: sdf.box } },
    vertexShader: VS, fragmentShader: FS, fog: true,
  });
  m.userData.sdf = sdf.tex;
  return m;
}

/** The water material world.js hands to ground.js. ground.js calls .userData.forPoly(P) for each water body. */
export function makeWaterMaterial() {
  U.uNrm.value ||= rippleTex();
  const base = material(shoreTex([[0, 0], [1, 0], [1, 1], [0, 1]]));
  base.userData.forPoly = (P) => material(shoreTex(P));
  base.userData.disposePoly = (m) => { if (m && m !== base) { m.userData.sdf?.dispose(); m.dispose(); } };
  return base;
}

/** Hook the water up to the sky and lights (game.js, once). */
export function bindWater(o) { Object.assign(B, o); }
const B = {};
let pickT = 0;
const _c = new THREE.Color();
/** Per frame: copy sky colours, sun/moon glints, nearest lamps. */
export function updateWater(dt, nightK, time) {
  const { sky, sun, moon, hemi, camera, lights } = B;
  if (!sky) return;
  U.uTime.value = time;
  U.uTop.value.copy(sky.u.uTop.value); U.uHor.value.copy(sky.u.uHor.value);
  if (sky.u.uSunDir) U.uSunDir.value.copy(sky.u.uSunDir.value); else U.uSunDir.value.copy(sun.position).normalize();
  if (sky.u.uMoon) U.uMoonDir.value.copy(sky.u.uMoon.value);
  const sunUp = Math.max(0, Math.min(1, U.uSunDir.value.y * 6 + 0.2));
  U.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(1.4, sun.intensity * 0.6) * sunUp);
  U.uMoonCol.value.copy(moon.color).multiplyScalar(moon.intensity * 1.6);
  U.uAmb.value.copy(hemi.color).multiplyScalar(hemi.intensity * 0.75).add(_c.copy(sun.color).multiplyScalar(sun.intensity * Math.max(0, U.uSunDir.value.y) * 0.35));
  if ((pickT -= dt) <= 0 && lights && camera) {
    pickT = 0.3;
    const cx = camera.position.x, cz = camera.position.z;
    const near = [];
    for (const L of lights) {
      if (!(L.i > 0) || (!L.always && nightK < 0.05)) continue;
      const d = (L.x - cx) ** 2 + (L.z - cz) ** 2; if (d > 90 * 90) continue;
      near.push([d, L]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < NL; i++) {
      const e = near[i];
      if (!e) { U.uLP.value[i].set(0, -999, 0); U.uLC.value[i].setRGB(0, 0, 0); continue; }
      const L = e[1];
      U.uLP.value[i].set(L.x, L.y, L.z); U.uLC.value[i].set(L.c).multiplyScalar(L.i * (L.always ? Math.max(0.35, nightK) : nightK));
    }
  }
}

/** Juniper Creek (world.js 'creek' ribbons, uv.y runs downstream): make the water flow downstream, ripple, catch the sky
 *  at glancing angles and the moon/lamps at night. Chained before terrain.js patchMaterial (which keeps any earlier hook). */
export function patchCreek(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    U.uNrm.value ||= rippleTex();
    Object.assign(sh.uniforms, { uTime: U.uTime, uTop: U.uTop, uHor: U.uHor, uNrm: U.uNrm });
    sh.fragmentShader = 'uniform float uTime; uniform vec3 uTop, uHor; uniform sampler2D uNrm;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 cw1 = texture2D(map, vMapUv + vec2(0.0, -uTime * 0.32));
        vec4 cw2 = texture2D(map, vMapUv * vec2(1.4, 0.7) + vec2(0.37, -uTime * 0.2));
        diffuseColor *= mix(cw1, cw2, 0.5);
        #endif`)
      .replace('#include <opaque_fragment>', `{
        float rip = texture2D(uNrm, vMapUv * vec2(1.2, 0.5) + vec2(0.0, -uTime * 0.45)).a;
        float fr = 1.0 - abs(dot(normalize(vViewPosition), normal));
        vec3 skyC = mix(uHor, uTop, 0.35);
        outgoingLight = mix(outgoingLight, skyC * (0.75 + rip * 0.5), clamp(fr * fr * 0.55, 0.0, 0.6));
        outgoingLight += vec3(smoothstep(0.66, 0.8, rip)) * (uHor + vec3(0.04)) * 0.25;
      }
      #include <opaque_fragment>`);
  };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.customProgramCacheKey = () => key() + '|creek1';
}
