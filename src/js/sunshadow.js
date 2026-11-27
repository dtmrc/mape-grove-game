// Sun (and moon) shadows from the static world: buildings, trees, fences, poles.
// One cached shadow map centred on the player. It is only re-rendered when the player has moved a fair way or the
// sun has turned about a degree, so a normal frame pays nothing but a 4-tap lookup in the lit shaders. Moving things
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

export function makeSunShadow({ renderer, scene, sun, moon, chunks, enabled = true }) {
  const url = new URLSearchParams(location.search);
  if (url.get('shadows') === '0') enabled = false;
  const stats = { refreshes: 0, casters: 0, light: 'sun', on: enabled };
  const center = new THREE.Vector3(1e9, 0, 1e9), dir = new THREE.Vector3(0, 1, 0), want = new THREE.Vector3();
  let cur = null, dirty = true, cool = 0, hold = false;

  renderer.shadowMap.enabled = enabled;
  renderer.shadowMap.type = THREE.BasicShadowMap;   // the filtering is in our own getShadow
  renderer.shadowMap.autoUpdate = false;

  // ---- casters: the merged world meshes. Their vertices are lifted onto the terrain in the vertex shader, so the
  // depth pass needs the same patch. Cut-out textures (fences, railings) get a depth material that keeps the holes.
  const solid = patchMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const cut = new Map();
  const depthFor = (m) => {
    if (m.alphaTest > 0 && m.map) {
      if (!cut.has(m.map)) cut.set(m.map, patchMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: m.alphaTest })));
      return cut.get(m.map);
    }
    return solid;
  };
  function addCaster(mesh) {
    const m = mesh.material;
    if (!m || Array.isArray(m) || !m.isMeshLambertMaterial && !m.isMeshPhongMaterial) return false;
    if ((m.transparent && !(m.alphaTest > 0)) || m.opacity < 1 || m.blending !== THREE.NormalBlending) return false;
    mesh.castShadow = true;
    if (m.userData.terrain) mesh.customDepthMaterial = depthFor(m);
    stats.casters++;
    return true;
  }
  for (const c of chunks) addCaster(c);

  // ---- receivers: everything lit. receiveShadow is only a uniform, so this costs no extra shader programs.
  const mark = (o) => { if (o.isMesh) o.receiveShadow = true; };
  scene.traverse(mark);
  const add = scene.add;
  scene.add = function (...objs) { for (const o of objs) if (o && o.traverse) o.traverse(mark); return add.apply(this, objs); };

  // ---- the light's shadow camera sits where WE cached it, not where the light is this frame ----
  const _m = new THREE.Matrix4();
  function setup(L) {
    const s = L.shadow, c = s.camera;
    s.mapSize.set(SIZE, SIZE); s.bias = -0.00022; s.normalBias = 0.07; s.radius = 1.6;
    c.left = -HALF; c.right = HALF; c.top = HALF; c.bottom = -HALF; c.near = 1; c.far = DIST * 2; c.updateProjectionMatrix();
    s.updateMatrices = function () {
      c.position.copy(center).addScaledVector(dir, DIST);
      _m.lookAt(c.position, center, c.up); c.quaternion.setFromRotationMatrix(_m); c.updateMatrixWorld();   // (camera.lookAt reads a stale matrixWorld)
      _m.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(_m);
      this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(_m);
    };
  }
  setup(sun); setup(moon);
  function pick(L) {
    if (cur === L) return;
    sun.castShadow = L === sun; moon.castShadow = L === moon;
    cur = L; dirty = true; stats.light = L === sun ? 'sun' : L === moon ? 'moon' : 'off';
  }

  const api = {
    stats, renderer, sun, moon, center, dir,
    get enabled() { return enabled; },
    setEnabled(b) { enabled = !!b; stats.on = enabled; if (!enabled) pick(null); else dirty = true; },
    /** Re-render the map on the next frame (the editor calls this after moving things). */
    force() { dirty = true; cool = 0; },
    /** Tests: freeze the map so a measured frame never includes a refresh. */
    hold(b) { hold = !!b; },
    addCaster,
    /** Every frame before the render. x, z = the player. */
    update(dt, x, z) {
      if (!enabled) return;
      // one caster at a time: the sun by day, the moon once the sun is gone (never zero, that would recompile every shader)
      const L = cur === sun ? (sun.intensity < 0.03 && moon.intensity > 0.03 ? moon : sun) : (sun.intensity > 0.08 ? sun : moon);
      pick(L);
      cool -= dt;
      want.copy(L.position).sub(L.target.position).normalize();
      const moved = Math.hypot(center.x - x, center.z - z) > RECENTER;
      if (!(dirty || moved || want.dot(dir) < TURN) || cool > 0 || hold) return;
      dir.copy(want); center.set(x, heightAt(x, z) + 6, z);
      renderer.shadowMap.needsUpdate = true;
      dirty = false; cool = 0.2; stats.refreshes++;
    },
  };
  if (!enabled) pick(null); else pick(sun);
  window.__SHADOW = api;
  return api;
}
