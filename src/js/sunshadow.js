// Sun (and moon) shadows from the static world: buildings, trees, fences, poles.
// One cached shadow map centred on the player. It is only redrawn when the player has moved a fair way or the
// sun has turned about a degree, and the redraw is spread over several frames into a back buffer, so a normal frame
// pays nothing but a 4-tap lookup in the lit shaders and a refresh never shows up as a hitch. Moving things
// (the cat, people, cars) keep their blob shadows and are shaded by the map like everything else.
//   ?shadows=0 turns it off; window.__SHADOW has the stats and a force() for tests and the editor.
import * as THREE from 'three';
import { patchMaterial, heightAt } from './terrain.js';

const SIZE = 2048;      // shadow map resolution
const HALF = 96;        // metres covered either side of the player
const DIST = 220;       // light camera distance from the centre
const RECENTER = 22;    // metres the player may walk before the map follows
const TURN = Math.cos(0.9 * Math.PI / 180);   // sun rotation that triggers a refresh

// ---- shader: bilinear 4-tap compare + fade at the edge of the covered square (replaces three's getShadow) ----
{
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  const a = src.indexOf('float getShadow('), b = src.indexOf('vec2 cubeToUV');   // (the build has no comments)
  if (a > 0 && b > a) {
    THREE.ShaderChunk.shadowmap_pars_fragment = src.slice(0, a) + /* glsl */`
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		vec2 e2 = abs( shadowCoord.xy - 0.5 ) * 2.0;
		float edge = max( e2.x, e2.y );
		if ( edge >= 1.0 || shadowCoord.z > 1.0 ) return 1.0;
		vec2 t = 1.0 / shadowMapSize;
		vec2 uv = shadowCoord.xy * shadowMapSize - 0.5;
		vec2 f = fract( uv );
		vec2 o = ( floor( uv ) + 0.5 ) * t;
		float z = shadowCoord.z;
		float s = mix(
			mix( texture2DCompare( shadowMap, o, z ), texture2DCompare( shadowMap, o + vec2( t.x, 0.0 ), z ), f.x ),
			mix( texture2DCompare( shadowMap, o + vec2( 0.0, t.y ), z ), texture2DCompare( shadowMap, o + t, z ), f.x ), f.y );
		#ifdef SHADOW_SOFT
		vec2 r = t * shadowRadius;
		s = s * 0.4 + 0.15 * (
			texture2DCompare( shadowMap, o + vec2( r.x, r.y * 0.4 ), z ) + texture2DCompare( shadowMap, o + vec2( -r.x * 0.4, r.y ), z ) +
			texture2DCompare( shadowMap, o + vec2( -r.x, -r.y * 0.4 ), z ) + texture2DCompare( shadowMap, o + vec2( r.x * 0.4, -r.y ), z ) );
		#endif
		s = mix( s, 1.0, smoothstep( 0.78, 1.0, edge ) );
		return mix( 1.0, s, shadowIntensity );
	}

	` + src.slice(b);
  }
}

// ---- lit shaders: skip work that cannot change the pixel (same picture, less per-pixel cost) ----
// Every lit pixel used to run the full maths for every pooled lamp, the car headlight and both sky lights, whether or
// not they reach it. Now a lamp is only evaluated inside its range, lights that are off are skipped, and the shadow
// map is only read on surfaces that face the light.
{
  let s = THREE.ShaderChunk.lights_fragment_begin;
  const RE = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const wrap = (from, to, head, cond) => {
    const a = s.indexOf(from), b = to ? s.indexOf(to, a) : s.length;
    if (a < 0 || b < 0) return false;
    let part = s.slice(a, b);
    if (!part.includes(head) || !part.includes(RE)) return false;
    part = part.replace(head, `if ( ${cond} ) {\n\t\t${head}`).replace(RE, `${RE}\n\t\t}`);
    s = s.slice(0, a) + part + s.slice(b);
    return true;
  };
  const ok = [
    wrap('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )',
      'getPointLightInfo( pointLight, geometryPosition, directLight );',
      'pointLight.color != vec3( 0.0 ) && ( pointLight.distance <= 0.0 || dot( pointLight.position - geometryPosition, pointLight.position - geometryPosition ) < pointLight.distance * pointLight.distance )'),
    wrap('#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )', '#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )',
      'getSpotLightInfo( spotLight, geometryPosition, directLight );', 'spotLight.color != vec3( 0.0 )'),
    wrap('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )', '#if ( NUM_RECT_AREA_LIGHTS > 0 )',
      'getDirectionalLightInfo( directionalLight, directLight );', 'directionalLight.color != vec3( 0.0 )'),
  ];
  const sh = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]';
  if (s.includes(sh)) s = s.replace(sh, 'directLight.color *= ( directLight.visible && receiveShadow && dot( geometryNormal, directLight.direction ) > 0.0 ) ? getShadow( directionalShadowMap[ i ]'); else ok.push(false);
  if (ok.every(Boolean)) THREE.ShaderChunk.lights_fragment_begin = s;
  else console.warn('sunshadow: light loop patch skipped (three.js chunk changed)', ok);
}

export function makeSunShadow({ renderer, scene, sun, moon, chunks, enabled = true }) {
  const url = new URLSearchParams(location.search);
  if (url.get('shadows') === '0') enabled = false;
  const stats = { refreshes: 0, casters: 0, light: 'sun', on: enabled, slices: 0 };
  const center = new THREE.Vector3(1e9, 0, 1e9), dir = new THREE.Vector3(0, 1, 0), want = new THREE.Vector3();
  let cur = null, dirty = true, cool = 0, hold = false;

  // three only supplies the shader side (USE_SHADOWMAP + uniforms). Its own shadow pass never runs: the map is drawn
  // here, a slice of the casters per frame into a back buffer, and swapped in when complete. A refresh used to be one
  // frame that drew the whole town a second time (a hitch every few seconds while running); now it is spread thin.
  renderer.shadowMap.enabled = enabled;
  renderer.shadowMap.type = THREE.BasicShadowMap;   // the filtering is in our own getShadow
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;

  const depthTex = new THREE.DepthTexture(SIZE, SIZE); depthTex.type = THREE.UnsignedIntType;   // one depth buffer shared by both maps
  const mkRT = () => new THREE.WebGLRenderTarget(SIZE, SIZE, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: depthTex });
  let front = mkRT(), back = mkRT();
  const cam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 1, DIST * 2);
  const casters = new THREE.Scene(); casters.matrixWorldAutoUpdate = false;
  const proxies = [];

  // ---- casters: depth-only stand-ins that share the merged world meshes' geometry (no copy). Their vertices are
  // lifted onto the terrain in the vertex shader, so the depth material gets the same patch. Cut-out textures
  // (fences, railings) keep their holes. Back faces are drawn, like three does, so lit walls don't shadow themselves.
  const SIDE = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
  const mats = new Map();
  const depthFor = (m) => {
    const cutout = m.alphaTest > 0 && m.map, side = SIDE[m.side], key = `${cutout ? m.map.uuid : ''}|${side}|${m.userData.terrain ? 1 : 0}`;
    if (!mats.has(key)) {
      const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side, ...(cutout ? { map: m.map, alphaTest: m.alphaTest } : {}) });
      mats.set(key, m.userData.terrain ? patchMaterial(d) : d);
    }
    return mats.get(key);
  };
  function addCaster(mesh) {
    const m = mesh.material;
    if (!m || Array.isArray(m) || !m.isMeshLambertMaterial && !m.isMeshPhongMaterial) return false;
    if ((m.transparent && !(m.alphaTest > 0)) || m.opacity < 1 || m.blending !== THREE.NormalBlending) return false;
    const p = new THREE.Mesh(mesh.geometry, depthFor(m));
    p.matrixAutoUpdate = false; p.matrix.copy(mesh.matrixWorld); p.matrixWorld.copy(mesh.matrixWorld); p.visible = false;
    const g = mesh.geometry; p.userData.tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    casters.add(p); proxies.push(p);
    stats.casters++;
    return true;
  }
  for (const c of chunks) addCaster(c);

  // ---- receivers: everything lit. receiveShadow is only a uniform, so this costs no extra shader programs.
  const mark = (o) => { if (o.isMesh) o.receiveShadow = true; };
  scene.traverse(mark);
  const add = scene.add;
  scene.add = function (...objs) { for (const o of objs) if (o && o.traverse) o.traverse(mark); return add.apply(this, objs); };

  for (const L of [sun, moon]) { const sh = L.shadow; sh.mapSize.set(SIZE, SIZE); sh.bias = -0.00022; sh.normalBias = 0.07; sh.radius = 1.6; sh.map = front; }

  // ---- a refresh job: draw the casters into the back map, about SLICE triangles per frame, then swap ----
  const SLICE = 45000;
  const _m = new THREE.Matrix4(), _col = new THREE.Color(), jobMatrix = new THREE.Matrix4();
  let job = null;   // { i, light }
  function begin(L, x, z) {
    dir.copy(want); center.set(x, heightAt(x, z) + 6, z);
    cam.position.copy(center).addScaledVector(dir, DIST);
    _m.lookAt(cam.position, center, cam.up); cam.quaternion.setFromRotationMatrix(_m); cam.updateMatrixWorld();   // (camera.lookAt reads a stale matrixWorld)
    _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    jobMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(_m);
    job = { i: 0, light: L };
  }
  function step(all) {
    const rt = renderer.getRenderTarget(), auto = renderer.autoClear, alpha = renderer.getClearAlpha();
    renderer.getClearColor(_col);
    renderer.setRenderTarget(back); renderer.autoClear = false;
    if (job.i === 0) { renderer.setClearColor(0xffffff, 1); renderer.clear(true, true, false); }
    let n = 0, from = job.i;
    while (job.i < proxies.length && (all || n < SLICE || job.i === from)) n += proxies[job.i++].userData.tris;
    for (let k = 0; k < proxies.length; k++) proxies[k].visible = k >= from && k < job.i;
    renderer.render(casters, cam);
    renderer.setClearColor(_col, alpha); renderer.autoClear = auto; renderer.setRenderTarget(rt);
    stats.slices++;
    if (job.i < proxies.length) return;
    // complete: swap it in, together with the matrix it was drawn with
    const L = job.light, t = front; front = back; back = t;
    sun.castShadow = L === sun; moon.castShadow = L === moon;
    L.shadow.map = front; L.shadow.matrix.copy(jobMatrix);
    cur = L; stats.light = L === sun ? 'sun' : 'moon'; stats.refreshes++;
    job = null;
  }

  const api = {
    stats, renderer, sun, moon, center, dir,
    get map() { return front; },
    get enabled() { return enabled; },
    setEnabled(b) {
      enabled = !!b; stats.on = enabled;
      if (!enabled) { sun.castShadow = moon.castShadow = false; cur = null; job = null; stats.light = 'off'; } else dirty = true;
    },
    /** Redraw the whole map on the next frame (the editor calls this after moving things). */
    force() { dirty = true; cool = 0; job = null; },
    /** Tests: freeze the map (a frame whose draw calls are skipped must not draw into it; perf measures steady frames). */
    hold(b) { hold = !!b; },
    addCaster,
    /** Every frame before the render. x, z = the player. */
    update(dt, x, z) {
      if (!enabled || hold) return;
      if (job) { step(false); return; }
      // one caster at a time: the sun by day, the moon once the sun is gone (never zero, that would recompile every shader)
      const L = cur === sun ? (sun.intensity < 0.03 && moon.intensity > 0.03 ? moon : sun) : (sun.intensity > 0.08 || !cur ? sun : moon);
      cool -= dt;
      want.copy(L.position).sub(L.target.position).normalize();
      const d = Math.hypot(center.x - x, center.z - z), first = dirty || !cur || d > HALF * 0.6;   // nothing useful on screen: draw it in one go
      if (!(first || L !== cur || d > RECENTER || want.dot(dir) < TURN) || (cool > 0 && !first)) return;
      begin(L, x, z); step(first);
      dirty = false; cool = 0.2;
    },
  };
  window.__SHADOW = api;
  return api;
}
