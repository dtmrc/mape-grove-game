// Baked vertex lighting for interiors (PS2-style "pre-lit" rooms). Called by interiors.js once per room, right after
// build(): every static vertex-coloured Lambert/Phong mesh in the room gets a per-vertex light value (soft point-light
// falloff + Lambert term + furniture shadows + contact/corner AO + hemisphere ambient), stored in a `bake` attribute.
// Large faces are split first (longest-edge bisection) so light pools and shadows read on floors and walls.
// The material is patched in place (rooms keep their references for animations): the light loops and hemisphere term
// are replaced by diffuse * bake * uBakeTint, plus the pool point lights weighted by uDynW[i] (0 for lights that are
// already baked, 1 for dynamic ones such as a carried torch or a fire). interiors.js sets the uniforms in env().
//
// A room may tune it by returning `bake` from build(): false (skip), or { amb, sky, ground, k, maxEdge, shadows }.
// A light may carry `dyn: true` (not baked; it moves or matters only live) or `bake: false` (same).
// A light may carry `zone: { x0, x1, z0, z1, fade }` (big multi-room interiors): it only lights vertices inside that
// rectangle, fading out over `fade` metres past its edge, so a house of 40 lamps costs a handful of lights per vertex.

export const MAX_DYN = 32;   // weights for the first 32 point lights in render order (more are always live)
export const BAKE_UNIFORMS = {
  uBakeTint: { value: null },          // THREE.Color, set by init
  uDynW: { value: new Float32Array(MAX_DYN) },
  uDay: { value: 0 },                  // 0 night .. 1 day: window panes fade from their painted night to a day view
  uSkyTop: { value: null }, uSkyLow: { value: null },
};
/** Daylight 0..1 and the sky colours seen through windows for a 0-24 clock. */
export function setDaylight(h) {
  const U = BAKE_UNIFORMS; if (!U.uSkyTop.value) return;
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const day = ss(5.5, 7.5, h) * (1 - ss(18.3, 20.3, h)), dusk = Math.max(ss(5.0, 6.5, h) * (1 - ss(6.5, 8.5, h)), ss(17.5, 19.0, h) * (1 - ss(19.0, 20.5, h)));
  U.uDay.value = Math.max(day, dusk * 0.8);
  U.uSkyTop.value.setRGB(0.42 + dusk * 0.3, 0.62 - dusk * 0.12, 0.92 - dusk * 0.35);
  U.uSkyLow.value.setRGB(0.78 + dusk * 0.2, 0.86 - dusk * 0.2, 0.92 - dusk * 0.4);
  return U.uDay.value;
}
/** A window pane (MeshBasicMaterial with a painted night map): mix toward a day sky over a hedge line by uDay. */
export function patchWindow(m) {
  if (!m || !m.isMeshBasicMaterial || !m.map || m.userData.win) return;
  m.userData.win = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDay = BAKE_UNIFORMS.uDay; sh.uniforms.uSkyTop = BAKE_UNIFORMS.uSkyTop; sh.uniforms.uSkyLow = BAKE_UNIFORMS.uSkyLow;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDay; uniform vec3 uSkyTop; uniform vec3 uSkyLow;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float v = vMapUv.y;
        vec3 sky = mix(uSkyLow, uSkyTop, smoothstep(0.35, 1.0, v));
        float hedge = 1.0 - smoothstep(0.30, 0.36, v + 0.03 * sin(vMapUv.x * 40.0) + 0.02 * sin(vMapUv.x * 97.0));
        vec3 view = mix(sky, vec3(0.30, 0.46, 0.24) * (0.8 + 0.4 * uDay), hedge);
        diffuseColor.rgb = mix(diffuseColor.rgb, view * 1.15, uDay);
      }`);
  };
  m.customProgramCacheKey = () => 'win1';
  m.needsUpdate = true;
}
let inited = false;
function init(THREE) {
  if (inited) return; inited = true;
  BAKE_UNIFORMS.uBakeTint.value = new THREE.Color(1, 1, 1);
  BAKE_UNIFORMS.uSkyTop.value = new THREE.Color(); BAKE_UNIFORMS.uSkyLow.value = new THREE.Color();
}

// ---------- geometry: split triangles with an edge longer than maxEdge ----------
function subdivide(THREE, geo, maxEdge, budget) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const names = Object.keys(src.attributes);
  const A = names.map((n) => src.attributes[n]);
  const pos = src.attributes.position, n0 = pos.count;
  const out = names.map(() => []);
  const tri = new Array(3);
  const get = (ai, i) => { const a = A[ai], r = []; for (let k = 0; k < a.itemSize; k++) r.push(a.array[i * a.itemSize + k]); return r; };
  const mid = (a, b) => a.map((v, k) => (v + b[k]) / 2);
  const len2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const m2 = maxEdge * maxEdge;
  let made = 0;
  const pi = names.indexOf('position');
  const emit = (v) => { for (let ai = 0; ai < A.length; ai++) for (const x of v[ai]) out[ai].push(x); };
  function rec(v0, v1, v2, depth) {
    const p0 = v0[pi], p1 = v1[pi], p2 = v2[pi];
    const e0 = len2(p0, p1), e1 = len2(p1, p2), e2 = len2(p2, p0);
    const e = Math.max(e0, e1, e2);
    if (e <= m2 || depth > 9 || made > budget) { emit(v0); emit(v1); emit(v2); made++; return; }
    if (e === e0) { const m = v0.map((a, k) => mid(a, v1[k])); rec(v0, m, v2, depth + 1); rec(m, v1, v2, depth + 1); }
    else if (e === e1) { const m = v1.map((a, k) => mid(a, v2[k])); rec(v0, v1, m, depth + 1); rec(v0, m, v2, depth + 1); }
    else { const m = v2.map((a, k) => mid(a, v0[k])); rec(v0, v1, m, depth + 1); rec(m, v1, v2, depth + 1); }
  }
  for (let t = 0; t < n0; t += 3) {
    for (let j = 0; j < 3; j++) tri[j] = A.map((_, ai) => get(ai, t + j));
    rec(tri[0], tri[1], tri[2], 0);
  }
  const g = new THREE.BufferGeometry();
  names.forEach((n, ai) => {
    const a = A[ai], arr = new (a.array.constructor)(out[ai]);
    g.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  });
  if (g.attributes.normal) { const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) { const x = nn.getX(i), y = nn.getY(i), z = nn.getZ(i), l = Math.hypot(x, y, z) || 1; nn.setXYZ(i, x / l, y / l, z / l); } }
  return g;
}

// ---------- occluders: the room's solid cols (boxes from y = 0 to h, turned about y) ----------
function occluders(out) {
  return (out.cols || []).filter((c) => c && (c.kind === 'box' || c.kind === undefined) && (+c.h || 0) > 0.12).map((c) => {
    const r = +c.rot || 0;
    const b = { cx: +c.cx || 0, cz: +c.cz || 0, hw: Math.abs(+c.w || 0) / 2, hd: Math.abs(+c.d || 0) / 2, h: +c.h || 0, y0: +c.y0 || 0, c: Math.cos(r), s: Math.sin(r) };
    b.ex = Math.abs(b.hw * b.c) + Math.abs(b.hd * b.s); b.ez = Math.abs(b.hw * b.s) + Math.abs(b.hd * b.c);   // world AABB half extents
    return b;
  }).filter((b) => b.hw > 0.03 && b.hd > 0.03);
}
// segment p -> q against a turned box (slab test in box space); true when blocked
function segHits(b, px, py, pz, qx, qy, qz) {
  const dx0 = px - b.cx, dz0 = pz - b.cz, dx1 = qx - b.cx, dz1 = qz - b.cz;
  const ax = dx0 * b.c - dz0 * b.s, az = dx0 * b.s + dz0 * b.c;
  const bx = dx1 * b.c - dz1 * b.s, bz = dx1 * b.s + dz1 * b.c;
  let t0 = 0, t1 = 1;
  const slab = (a, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return a >= lo && a <= hi;
    let u = (lo - a) / d, v = (hi - a) / d; if (u > v) { const w = u; u = v; v = w; }
    if (u > t0) t0 = u; if (v < t1) t1 = v; return t0 <= t1;
  };
  return slab(ax, bx - ax, -b.hw, b.hw) && slab(az, bz - az, -b.hd, b.hd) && slab(py, qy - py, b.y0, b.h) && t1 > 0.001 && t0 < 0.999;
}
// distance from a point to a box (0 inside)
function boxDist(b, x, y, z) {
  const dx = x - b.cx, dz = z - b.cz, lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
  const ex = Math.max(0, Math.abs(lx) - b.hw), ez = Math.max(0, Math.abs(lz) - b.hd), ey = y < b.y0 ? b.y0 - y : Math.max(0, y - b.h);
  return Math.hypot(ex, ey, ez);
}

const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/** Bake one room. group = the room's root (room-local, not yet placed); out = build() result. Returns stats. */
export function bakeRoom(THREE, group, out) {
  init(THREE);
  const cfg = out.bake === false ? null : (out.bake || {});
  if (!cfg) return { skipped: true };
  const t0 = Date.now();
  const maxEdge = cfg.maxEdge ?? 0.7, budget = cfg.budget ?? 60000;
  const amb = cfg.amb ?? 0.24, k = cfg.k ?? 1;
  const sky = new THREE.Color(cfg.sky ?? 0xfff0dc), ground = new THREE.Color(cfg.ground ?? 0x6a5a4a);
  const size = out.size || [6, 6], hw = size[0] / 2, hd = size[1] / 2;
  // perimeter walls (boxes reaching past the room rectangle) never sit between a light and a surface inside; the corner AO covers them
  const occ = cfg.shadows === false ? [] : occluders(out).filter((b) => Math.abs(b.cx) + b.ex < hw + 0.05 && Math.abs(b.cz) + b.ez < hd + 0.05);
  const L = (out.lights || []).filter((l) => l && !l.dyn && l.bake !== false).map((l) => ({ x: +l.x || 0, y: +l.y || 2.4, z: +l.z || 0, col: new THREE.Color(l.c ?? 0xfff0d8), i: l.i ?? 1, r: l.r ?? 0.25, zone: l.zone || null }));
  group.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && /^(room|pd):(night|street|pnight)$/.test(o.name)) patchWindow(o.material); });
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  // which meshes: static, vertex coloured, lit single materials; geometries used once (clone shared ones)
  const meshes = [], useCount = new Map(), matUsers = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    useCount.set(o.geometry, (useCount.get(o.geometry) || 0) + 1);
    if (!Array.isArray(o.material)) matUsers.set(o.material, (matUsers.get(o.material) || 0) + 1);
  });
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    const m = o.material;
    if (!(m.isMeshLambertMaterial || m.isMeshPhongMaterial) || !m.vertexColors || o.userData.noBake) return;
    if (!o.geometry.attributes.position || !o.geometry.attributes.normal) return;
    meshes.push(o);
  });
  // a material shared with a mesh we do not bake gets its own copy for the baked ones
  const mine = new Map(); for (const o of meshes) mine.set(o.material, (mine.get(o.material) || 0) + 1);
  const cloned = new Map();
  for (const o of meshes) if (mine.get(o.material) !== matUsers.get(o.material)) { if (!cloned.has(o.material)) cloned.set(o.material, o.material.clone()); o.material = cloned.get(o.material); }
  // light samples for soft shadows (4 points around each light)
  const OFF = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], cand = new Array(occ.length);
  let verts = 0, split = 0, tSplit = 0;
  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const o of meshes) {
    let geo = o.geometry;
    if (useCount.get(geo) > 1) geo = geo.clone();
    const big = cfg.split === false ? false : bigTris(geo, maxEdge);
    if (big) { const t1 = Date.now(), before = geo.attributes.position.count; geo = subdivide(THREE, geo, maxEdge, budget); split += geo.attributes.position.count - before; tSplit += Date.now() - t1; }
    if (geo !== o.geometry) { o.geometry = geo; }
    const toRoom = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    nm.getNormalMatrix(toRoom);
    const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
    const bake = new Float32Array(n * 3), cache = new Map();
    for (let i = 0; i < n; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(toRoom);
      _n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      const x = _v.x, y = _v.y, z = _v.z, nx = _n.x, ny = _n.y, nz = _n.z;
      // the same corner shared by neighbouring triangles: light it once
      const key = `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)},${Math.round(nx * 20)},${Math.round(ny * 20)},${Math.round(nz * 20)}`;
      const hitC = cache.get(key);
      if (hitC !== undefined) { bake[i * 3] = bake[hitC * 3]; bake[i * 3 + 1] = bake[hitC * 3 + 1]; bake[i * 3 + 2] = bake[hitC * 3 + 2]; continue; }
      cache.set(key, i);
      // ambient: hemisphere
      const hk = ny * 0.5 + 0.5;
      let r = (ground.r + (sky.r - ground.r) * hk) * amb, g = (ground.g + (sky.g - ground.g) * hk) * amb, b = (ground.b + (sky.b - ground.b) * hk) * amb;
      // occlusion: contact with furniture, corners of the shell
      let ao = 1;
      const ox = x + nx * 0.12, oy = y + ny * 0.12, oz = z + nz * 0.12;
      for (const c of occ) {
        if (Math.abs(x - c.cx) > c.ex + 0.75 || Math.abs(z - c.cz) > c.ez + 0.75 || y > c.h + 0.75) continue;
        if (boxDist(c, x, y, z) < 0.03) continue;          // the box's own surface (or touching it)
        const d = boxDist(c, ox, oy, oz);
        if (d < 0.6) ao *= 0.55 + 0.45 * sm(d / 0.6);
      }
      const ex = hw - Math.abs(x), ez = hd - Math.abs(z);
      if (ex > -0.05 && ez > -0.05) {
        const e = Math.min(ex, ez);
        ao *= 0.72 + 0.28 * sm(e / 0.8);                   // vertical corners / floor edges
        if (y < 0.5 && Math.abs(ny) < 0.5) ao *= 0.7 + 0.3 * sm(y / 0.5);   // wall foot
      }
      r *= ao; g *= ao; b *= ao;
      // point lights
      for (const l of L) {
        let zf = 1;
        if (l.zone) { const q = l.zone, o2 = Math.max(q.x0 - x, x - q.x1, q.z0 - z, z - q.z1); if (o2 >= q.fade) continue; if (o2 > 0) zf = 1 - o2 / q.fade; }
        const lx = l.x - x, ly = l.y - y, lz = l.z - z, d2 = lx * lx + ly * ly + lz * lz, d = Math.sqrt(d2) || 1e-4;
        let ndl = (lx * nx + ly * ny + lz * nz) / d;
        ndl = (ndl + 0.15) / 1.15; if (ndl <= 0) continue;   // slight wrap: softer terminator
        let fall = 7.0 * l.i / (Math.pow(d, 1.8) + 1.1);    // soft near the bulb, no blown-out pools
        fall *= sm(1 - d / 22) * zf;
        if (fall < 0.004) continue;
        let vis = 1;
        if (occ.length) {
          // broadphase: boxes whose AABB overlaps the vertex -> light box (light radius included)
          const x0 = Math.min(ox, l.x) - l.r, x1 = Math.max(ox, l.x) + l.r, z0 = Math.min(oz, l.z) - l.r, z1 = Math.max(oz, l.z) + l.r, y0 = Math.min(oy, l.y);
          let nc = 0;
          for (const c of occ) if (c.cx + c.ex >= x0 && c.cx - c.ex <= x1 && c.cz + c.ez >= z0 && c.cz - c.ez <= z1 && c.h >= y0) cand[nc++] = c;
          let hit = 0;
          if (nc) for (const [a, bb, cc] of OFF) {
            const qx = l.x + a * l.r, qy = l.y + bb * l.r, qz = l.z + cc * l.r;
            for (let q = 0; q < nc; q++) if (segHits(cand[q], ox, oy, oz, qx, qy, qz)) { hit++; break; }
          }
          vis = 1 - hit / OFF.length * 0.82;
        }
        const f = fall * ndl * vis * (0.8 + 0.2 * ao);
        r += l.col.r * f; g += l.col.g * f; b += l.col.b * f;
      }
      // gentle shoulder so hot spots roll off instead of clipping
      bake[i * 3] = k * r / (1 + 0.22 * r); bake[i * 3 + 1] = k * g / (1 + 0.22 * g); bake[i * 3 + 2] = k * b / (1 + 0.22 * b);
    }
    geo.setAttribute('bake', new THREE.BufferAttribute(bake, 3));
    verts += n;
    patch(o.material);
  }
  return { meshes: meshes.length, verts, split, lights: L.length, occ: occ.length, ms: Date.now() - t0, msSplit: tSplit };
}
function bigTris(geo, maxEdge) {
  const p = geo.attributes.position, idx = geo.index, m2 = maxEdge * maxEdge, n = idx ? idx.count : p.count;
  for (let t = 0; t < n; t += 3) {
    for (let j = 0; j < 3; j++) {
      const a = idx ? idx.getX(t + j) : t + j, b = idx ? idx.getX(t + (j + 1) % 3) : t + (j + 1) % 3;
      const dx = p.getX(a) - p.getX(b), dy = p.getY(a) - p.getY(b), dz = p.getZ(a) - p.getZ(b);
      if (dx * dx + dy * dy + dz * dz > m2) return true;
    }
  }
  return false;
}
function patch(m) {
  if (m.userData.baked) return;
  m.userData.baked = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBakeTint = BAKE_UNIFORMS.uBakeTint;
    sh.uniforms.uDynW = BAKE_UNIFORMS.uDynW;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 bake;\nvarying vec3 vBake;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = bake;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vBake;\nuniform vec3 uBakeTint;\nuniform float uDynW[${MAX_DYN}];`)
      .replace(/vec3 outgoingLight = [^;]+;/, 'vec3 outgoingLight = diffuseColor.rgb * vBake * uBakeTint + reflectedLight.directDiffuse + totalEmissiveRadiance;')
      .replace('#include <lights_fragment_begin>', BEGIN())
      .replace('#include <lights_fragment_maps>', '')
      .replace('#include <lights_fragment_end>', '');
  };
  m.customProgramCacheKey = () => 'baked1';
  m.needsUpdate = true;
}
// only the point-light loop of lights_fragment_begin, each light weighted by uDynW (0 = already baked)
const BEGIN = () => `
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
  PointLight pointLight;
  #pragma unroll_loop_start
  for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
    {
    #if UNROLLED_LOOP_INDEX < ${MAX_DYN}
      float dynW = uDynW[ UNROLLED_LOOP_INDEX ];
    #else
      float dynW = 1.0;
    #endif
    pointLight = pointLights[ i ];
    if ( dynW > 0.001 ) {
      getPointLightInfo( pointLight, geometryPosition, directLight );
      directLight.color *= dynW;
      RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    }
    }
  }
  #pragma unroll_loop_end
#endif
`;
