// Cheap atmosphere for the Hollow Deep (cave.js / cavegen.js), 2026-11-27: ground mist, water pools with drip rings,
// and one batched "billboard" mesh per room for every small glow (will-o'-wisps, candle flames, watching eyes, falling
// drips) and one for smoke wisps. Written for a fill-rate limited phone: one flat mist layer (no stacked sprites), all
// motion in the vertex shader from a single time uniform, no extra render passes, no textures except one 64 px noise.
//
// Everything is in room-local coordinates (the meshes are direct children of the room group, which is only translated),
// so the carried torch can light the mist and glint on the water from two uniforms.
import * as THREE from 'three';

let NOISE = null;
function noiseTex() {
  if (NOISE) return NOISE;
  // tileable value noise, 3 octaves, 64 px
  const N = 64, d = new Uint8Array(N * N * 4);
  let s = 9173; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const lat = (p) => { const a = new Float32Array(p * p); for (let i = 0; i < a.length; i++) a[i] = r(); return a; };
  const O = [[4, lat(4), 0.5], [8, lat(8), 0.3], [16, lat(16), 0.2]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const [p, L, w] of O) {
      const fx = x / N * p, fy = y / N * p, xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi, u = xf * xf * (3 - 2 * xf), q = yf * yf * (3 - 2 * yf);
      const g = (i, j) => L[(i % p) + (j % p) * p];
      v += w * ((g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - q) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * q);
    }
    const i = (y * N + x) * 4, b = Math.max(0, Math.min(255, v * 255)); d[i] = d[i + 1] = d[i + 2] = b; d[i + 3] = 255;
  }
  NOISE = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); NOISE.wrapS = NOISE.wrapT = THREE.RepeatWrapping; NOISE.magFilter = NOISE.minFilter = THREE.LinearFilter; NOISE.needsUpdate = true;
  return NOISE;
}

/** Light from a room's static lights at a point (same falloff as roombake.js), added to `out` [r,g,b]. */
export function staticLight(lights, x, y, z, out, k = 1) {
  for (const l of lights) {
    if (l.dyn) continue;
    const dx = l.x - x, dy = (l.y ?? 2.4) - y, dz = l.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > 20) continue;
    const f = k * 7 * (l.i ?? 1) / (Math.pow(d, 1.8) + 1.1) * (1 - d / 20), c = l.c ?? 0xfff0d8;
    out[0] += ((c >> 16) & 255) / 255 * f; out[1] += ((c >> 8) & 255) / 255 * f; out[2] += (c & 255) / 255 * f;
  }
  return out;
}

const TORCH = `
uniform vec3 uTorch; uniform vec3 uTorchCol;
vec3 torchLight(vec3 p) { vec3 d = uTorch - p; return uTorchCol * (1.9 / (dot(d, d) * 0.42 + 1.0)); }
`;

/**
 * One set of materials sharing the same clock / torch / cat uniforms. opts: { amb: [r,g,b] ambient for the mist,
 * far: mist fade-out distance, world: true outdoors (fog colour + day light come from setEnv) }.
 */
export function makeFx(opts = {}) {
  const U = {
    uTime: { value: 0 }, uTorch: { value: new THREE.Vector3(0, -50, 0) }, uTorchCol: { value: new THREE.Color(0, 0, 0) },
    uCat: { value: new THREE.Vector4(0, 0, 0, 0) },            // x, z (room-local), moving 0..1, height of the cat's eyes
    uNoise: { value: noiseTex() }, uAmb: { value: new THREE.Color(...(opts.amb || [0.05, 0.06, 0.08])) },
    uFar: { value: opts.far ?? 22 }, uMist: { value: opts.mist ?? 1 },
  };
  const fx = { U };

  // ---- ground mist: one flat layer; vertex alpha (aMist) shapes it, noise breaks it up and drifts ----
  fx.mistMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute float aMist; attribute vec3 aLight;
      uniform float uTime; uniform float uFar; uniform vec3 uAmb;
      ${TORCH}
      varying vec2 vP; varying float vA; varying vec3 vL;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.6 + p.x * 0.45 + p.z * 0.3) * 0.045;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = length(mv.xyz);
        vA = aMist * smoothstep(0.7, 2.6, d) * (1.0 - smoothstep(uFar * 0.6, uFar, d));
        vL = uAmb + aLight + torchLight(p) * 0.3;
        vP = p.xz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uNoise; uniform float uTime; uniform float uMist;
      varying vec2 vP; varying float vA; varying vec3 vL;
      void main() {
        float n = texture2D(uNoise, vP * 0.075 + vec2(uTime * 0.011, uTime * 0.006)).r;
        float m = texture2D(uNoise, vP * 0.19 - vec2(uTime * 0.017, -uTime * 0.009) + 0.37).r;
        float a = vA * smoothstep(0.36, 0.86, n * 0.75 + m * 0.6) * 0.6 * uMist;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vL * vec3(0.80, 0.88, 0.96), a);
      }`,
  });

  // ---- water pools: dark mirror, torch glint, rings from the drips and from the cat's paws, wet mud rim ----
  fx.poolMat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute float aEdge; attribute vec3 aLight; attribute vec4 aPool;   // aPool: centre x, z, radius, phase
      varying float vE; varying vec3 vL; varying vec3 vP; varying vec3 vV; varying vec4 vPool; varying float vFog;
      void main() {
        vE = aEdge; vL = aLight; vP = position; vPool = aPool;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vV = (cameraPosition - w.xyz) * mat3(modelMatrix);   // into the mesh's own frame (the mouth group is turned)
        vec4 mv = viewMatrix * w;
        vFog = 1.0 - smoothstep(12.0, 21.0, length(mv.xyz));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec4 uCat; uniform vec3 uAmb;
      ${TORCH}
      varying float vE; varying vec3 vL; varying vec3 vP; varying vec3 vV; varying vec4 vPool; varying float vFog;
      void main() {
        // rings: a drip lands at the centre every cycle; the cat's paws make their own
        vec2 dc = vP.xz - vPool.xy; float r = length(dc);
        float f = fract(uTime * 0.31 + vPool.w), front = f * vPool.z * 1.3;
        float ring = sin((r - front) * 26.0) * exp(-abs(r - front) * 5.0) * (1.0 - f) * step(0.02, f);
        vec2 dk = vP.xz - uCat.xy; float rk = length(dk);
        float paw = sin(rk * 22.0 - uTime * 10.0) * exp(-rk * 2.6) * uCat.z;
        vec2 g = (r > 0.001 ? dc / r : vec2(0.0)) * ring * 0.5 + (rk > 0.001 ? dk / rk : vec2(0.0)) * paw * 0.45;
        g += 0.02 * vec2(sin(vP.x * 9.0 + uTime * 1.3), cos(vP.z * 8.0 - uTime * 1.1));
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(vV), Ld = uTorch - vP; float ld = length(Ld); Ld /= max(ld, 0.001);
        float spec = pow(max(dot(n, normalize(Ld + V)), 0.0), 90.0);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 lit = uAmb + vL + torchLight(vP) * 0.35;
        vec3 water = vec3(0.012, 0.02, 0.028) + lit * (0.03 + 0.5 * fres) * vec3(0.7, 0.9, 1.0) + lit * abs(ring + paw) * 0.5 + uTorchCol * spec * 2.2 / (ld * ld * 0.15 + 1.0);
        vec3 mud = lit * vec3(0.10, 0.085, 0.07);
        float w = 1.0 - smoothstep(0.60, 0.70, vE);
        float a = mix(0.62 * (1.0 - smoothstep(0.70, 1.0, vE)), 0.94, w) * vFog;
        gl_FragColor = vec4(mix(mud, water, w), a);
      }`,
  });

  // ---- billboards: kinds (aParam.y): 0 mote drifting along aDir, 1 flame, 2 eye (blinks, shuts when the cat comes
  //      near), 3 steady glow, 4 smoke wisp (rises along aDir, grows, fades), 5 round spectacle glint, 6 falling drip ----
  const bbVert = `
    attribute vec3 aCenter; attribute vec2 aSize; attribute vec3 aCol; attribute vec4 aParam; attribute vec3 aDir;
    uniform float uTime; uniform vec4 uCat; uniform float uFar; uniform vec3 uAmb;
    ${TORCH}
    varying vec2 vUv; varying vec4 vCol; varying float vKind;
    void main() {
      float ph = aParam.x, kind = aParam.y, sp = aParam.z, ex = aParam.w;
      vec3 c = aCenter; vec2 sz = aSize; float a = 1.0; vec3 col = aCol;
      float f = fract(uTime * sp + ph);
      if (kind < 0.5) { c += aDir * f + vec3(sin(uTime * 0.9 + ph * 40.0), sin(uTime * 1.3 + ph * 17.0), cos(uTime * 0.7 + ph * 29.0)) * 0.12; a = sin(f * 3.1416); a *= a; }
      else if (kind < 1.5) { float k = 0.82 + 0.18 * sin(uTime * 19.0 + ph * 50.0) + 0.1 * sin(uTime * 31.0 + ph * 13.0); sz *= vec2(0.9 + 0.1 * k, k); c.y += aSize.y * (k - 1.0) * 0.5; c.x += sin(uTime * 7.0 + ph * 9.0) * aSize.x * 0.08; }
      else if (kind < 2.5) {
        float dcat = distance(c.xz, uCat.xy);
        float blink = step(0.06, fract(uTime * 0.19 + ph)) * step(0.5, fract(uTime * 0.045 + ph * 3.0) + 0.42);
        a = blink * smoothstep(ex, ex + 2.0, dcat) * (1.0 - smoothstep(13.0, 17.0, dcat));
      }
      else if (kind < 3.5) { a = 0.75 + 0.25 * sin(uTime * (1.0 + sp) + ph * 30.0); }
      else if (kind < 4.5) { c += aDir * f + vec3(sin(uTime * 0.35 + ph * 20.0), 0.0, cos(uTime * 0.3 + ph * 31.0)) * 0.3 * f; sz *= 0.55 + f * 0.9; a = sin(f * 3.1416) * ex; col = (uAmb * 5.0 + torchLight(c)) * aCol; }
      else if (kind < 5.5) { float dcat = distance(c.xz, uCat.xy); a = smoothstep(ex, ex + 2.5, dcat) * (1.0 - smoothstep(14.0, 18.0, dcat)) * step(0.5, fract(uTime * 0.03 + ph) + 0.35); }
      else { c += aDir * f * f; a = step(0.0, f) * (0.4 + 0.6 * f); }
      vec4 mv = modelViewMatrix * vec4(c, 1.0);
      a *= 1.0 - smoothstep(uFar * 0.7, uFar, length(mv.xyz));
      mv.xy += uv * 2.0 * sz - sz;
      vUv = uv * 2.0 - 1.0; vCol = vec4(col, a); vKind = kind;
      gl_Position = projectionMatrix * mv;
    }`;
  const bbFrag = `
    varying vec2 vUv; varying vec4 vCol; varying float vKind;
    void main() {
      float r = length(vUv), a;
      vec3 col = vCol.rgb;
      if (vKind > 0.5 && vKind < 1.5) {            // flame: teardrop, hot core
        float y = vUv.y * 0.5 + 0.5, w = mix(0.62, 0.05, y * y) * smoothstep(0.0, 0.18, y);
        a = 1.0 - smoothstep(w * 0.55, w, abs(vUv.x));
        col = mix(col, vec3(1.0, 0.95, 0.75), (1.0 - smoothstep(0.0, w * 0.6, abs(vUv.x))) * (1.0 - y) * 0.9);
        a *= 1.0 - smoothstep(0.75, 1.0, y);
      } else if (vKind > 1.5 && vKind < 2.5) {     // a pair of eyes on one 2:1 quad: almonds with slit pupils
        vec2 q = vec2((abs(vUv.x) - 0.5) * 2.0, vUv.y);
        float e = q.x * q.x * 1.4 + q.y * q.y * 3.2;
        a = (1.0 - smoothstep(0.5, 0.95, e)) * (0.2 + 0.8 * smoothstep(0.06, 0.2, abs(q.x)));
      } else if (vKind > 4.5 && vKind < 5.5) {     // a pair of round spectacle lenses catching the light
        vec2 q = vec2((abs(vUv.x) - 0.5) * 2.0, vUv.y); r = length(q);
        a = (1.0 - smoothstep(0.08, 0.2, abs(r - 0.72))) + 0.2 * (1.0 - smoothstep(0.4, 0.72, r));
      } else if (vKind > 5.5) {                    // drip streak
        a = (1.0 - smoothstep(0.2, 1.0, abs(vUv.x))) * (1.0 - smoothstep(0.5, 1.0, abs(vUv.y)));
      } else { a = 1.0 - smoothstep(0.0, 1.0, r); a *= a; }
      a *= vCol.a;
      if (a < 0.004) discard;
      gl_FragColor = vec4(col, a);
    }`;
  fx.glowMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: bbVert, fragmentShader: bbFrag.replace('gl_FragColor = vec4(col, a);', 'gl_FragColor = vec4(col * a, 1.0);'), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  fx.wispMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: bbVert, fragmentShader: bbFrag, transparent: true, depthWrite: false, fog: false });

  /** Per frame. torch: {x, y, z} room-local or null; on: 0..1 torch brightness; cat: {x, z, moving, y}. */
  fx.update = (t, torch, col, cat) => {
    U.uTime.value = t % 3600;
    if (torch) U.uTorch.value.set(torch.x, torch.y, torch.z); else U.uTorch.value.set(0, -50, 0);
    if (col) U.uTorchCol.value.copy(col); else U.uTorchCol.value.setRGB(0, 0, 0);
    if (cat) U.uCat.value.set(cat.x, cat.z, cat.moving || 0, cat.y || 0);
  };
  return fx;
}

/** Collects billboards and builds one mesh. add(kind, x, y, z, w, h, colour, {ph, sp, ex, dir}) */
export function makeBatch() {
  const A = { c: [], s: [], col: [], p: [], d: [], uv: [], idx: [], n: 0 };
  let seed = 4711; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const col = new THREE.Color();
  return {
    get count() { return A.n; },
    add(kind, x, y, z, w, h, c, o = {}) {
      col.set(c);
      const ph = o.ph ?? rr(), sp = o.sp ?? 0.1, ex = o.ex ?? 1, d = o.dir || [0, 0, 0], b = A.n * 4;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { A.c.push(x, y, z); A.s.push(w / 2, h / 2); A.col.push(col.r, col.g, col.b); A.p.push(ph, kind, sp, ex); A.d.push(d[0], d[1], d[2]); A.uv.push(u, v); }
      A.idx.push(b, b + 1, b + 2, b, b + 2, b + 3); A.n++;
    },
    mesh(material) {
      if (!A.n) return null;
      const g = new THREE.BufferGeometry(), f = (a, n) => new THREE.Float32BufferAttribute(a, n);
      g.setAttribute('position', f(A.c, 3)); g.setAttribute('aCenter', f(A.c, 3)); g.setAttribute('aSize', f(A.s, 2)); g.setAttribute('aCol', f(A.col, 3));
      g.setAttribute('aParam', f(A.p, 4)); g.setAttribute('aDir', f(A.d, 3)); g.setAttribute('uv', f(A.uv, 2)); g.setIndex(A.idx);
      g.computeBoundingSphere(); g.boundingSphere.radius += 4;
      const m = new THREE.Mesh(g, material); m.renderOrder = 6; m.userData.noBake = true;
      return m;
    },
  };
}

/** Collects pools and builds one mesh. add(x, z, radius, lights, y) -> the pool record {x, z, r}. */
export function makePools() {
  const P = [], E = [], L = [], Q = [], list = [];
  let seed = 811; const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return {
    list,
    add(x, z, R, lights = [], y = 0.02) {
      const N = 14, ph = rr(), a0 = rr() * 6.28, rad = [];
      for (let k = 0; k < N; k++) rad.push(R * (0.78 + 0.34 * rr()));
      const pt = (k, f) => { const a = a0 + (k % N) / N * Math.PI * 2, r = rad[k % N] * f; return [x + Math.cos(a) * r, y + (f > 1 ? 0.004 : 0), z + Math.sin(a) * r, f > 1.2 ? 1 : f > 0.5 ? 0.66 : 0]; };
      const lt = (p) => staticLight(lights, p[0], 0.1, p[2], [0, 0, 0], 0.5);
      const push = (p) => { P.push(p[0], p[1], p[2]); E.push(p[3]); const l = lt(p); L.push(l[0], l[1], l[2]); Q.push(x, z, R, ph); };
      const c = [x, y, z, 0];
      for (let k = 0; k < N; k++) {
        const a = pt(k, 1), b = pt(k + 1, 1), a2 = pt(k, 1.5), b2 = pt(k + 1, 1.5);
        push(c); push(b); push(a);
        push(a); push(b); push(a2); push(b); push(b2); push(a2);
      }
      const rec = { x, z, r: R, ph }; list.push(rec); return rec;
    },
    mesh(material) {
      if (!list.length) return null;
      const g = new THREE.BufferGeometry(), f = (a, n) => new THREE.Float32BufferAttribute(a, n);
      g.setAttribute('position', f(P, 3)); g.setAttribute('aEdge', f(E, 1)); g.setAttribute('aLight', f(L, 3)); g.setAttribute('aPool', f(Q, 4));
      const m = new THREE.Mesh(g, material); m.renderOrder = 3; m.userData.noBake = true;
      return m;
    },
  };
}

/** A flat mist sheet from quads. quad([x,y,z,alpha] x4, lights) */
export function makeMist() {
  const P = [], A = [], L = [];
  let n = 0;
  return {
    get count() { return n; },
    quad(a, b, c, d, lights = []) {
      for (const p of [a, b, c, a, c, d]) { P.push(p[0], p[1], p[2]); A.push(p[3]); const l = p[4] || (p[4] = staticLight(lights, p[0], 0.3, p[2], [0, 0, 0], 0.22)); L.push(l[0], l[1], l[2]); }
      n++;
    },
    mesh(material) {
      if (!n) return null;
      const g = new THREE.BufferGeometry(), f = (a, k) => new THREE.Float32BufferAttribute(a, k);
      g.setAttribute('position', f(P, 3)); g.setAttribute('aMist', f(A, 1)); g.setAttribute('aLight', f(L, 3));
      const m = new THREE.Mesh(g, material); m.renderOrder = 5; m.userData.noBake = true;
      return m;
    },
  };
}
