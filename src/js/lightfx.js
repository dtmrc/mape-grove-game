// Lamp light cones (2026-11-27): a soft, PS2-style beam of light under every street lamp at night, all lamps in one
// merged additive mesh (one draw call). Beams fade near the camera (so walking through one doesn't wash the screen),
// fade into the distance, and go out with their lamp (knocked over by a car, or deleted/moved in the editor).
import * as THREE from 'three';
import { heightAt } from './terrain.js';

const VS = `
  attribute vec3 aCol; attribute float aT; attribute float aOn;
  varying vec3 vCol; varying float vT, vOn, vEdge, vDist;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vec3 N = normalize(mat3(modelMatrix) * normal);
    vec3 V = cameraPosition - w.xyz; vDist = length(V);
    vEdge = abs(dot(N, V / vDist));
    vCol = aCol; vT = aT; vOn = aOn;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FS = `
  uniform float uNight;
  varying vec3 vCol; varying float vT, vOn, vEdge, vDist;
  void main(){
    float a = uNight * vOn * (0.05 + 0.55 * vT * vT) * pow(vEdge, 1.6);
    a *= smoothstep(1.5, 6.0, vDist) * (1.0 - smoothstep(55.0, 95.0, vDist));
    gl_FragColor = vec4(vCol * a, 1.0);
  }`;

export function makeLightFX({ scene, camera, lights }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: { value: 0 } }, vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.userData.noLift = true; mesh.visible = false;
  scene.add(mesh);
  let cones = [], sig = '';
  const lampSig = () => lights.filter(isLamp).map((L) => `${L.x.toFixed(1)},${L.z.toFixed(1)}`).join(';');
  function isLamp(L) { return L.y > 4.5 && L.y < 7 && !L.always; }
  function build() {
    cones = lights.filter(isLamp);
    const parts = [];
    for (const L of cones) {
      const top = L.y + 0.4, g = new THREE.CylinderGeometry(0.22, 2.3, top, 10, 1, true);
      g.translate(L.x, top / 2 + heightAt(L.x, L.z), L.z);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), t = new Float32Array(n), on = new Float32Array(n).fill(1);
      const c = new THREE.Color(L.c).multiplyScalar(0.42 * (L.i || 1));
      for (let i = 0; i < n; i++) { col.set([c.r, c.g, c.b], i * 3); t[i] = 0.5 + (g.attributes.position.getY(i) - top / 2 - heightAt(L.x, L.z)) / top; }
      g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aT', new THREE.BufferAttribute(t, 1)); g.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
      g.userData.n = n; parts.push(g);
    }
    mesh.geometry.dispose();
    const G = new THREE.BufferGeometry();
    if (parts.length) {
      const total = parts.reduce((s, g) => s + g.index.count, 0);
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), t = new Float32Array(total), on = new Float32Array(total);
      let o = 0; cones.forEach((L, k) => {
        const g = parts[k].toNonIndexed(), m = g.attributes.position.count;
        pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.aCol.array, o * 3); t.set(g.attributes.aT.array, o); on.set(g.attributes.aOn.array, o);
        L._cone = [o, m]; o += m;
      });
      G.setAttribute('position', new THREE.BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      G.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); G.setAttribute('aT', new THREE.BufferAttribute(t, 1)); G.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
    }
    mesh.geometry = G;
    sig = lampSig();
  }
  build();
  let chk = 0;
  return {
    mesh,
    update(dt, nightK) {
      mat.uniforms.uNight.value = nightK;
      mesh.visible = nightK > 0.02 && cones.length > 0;
      if (!mesh.visible || (chk -= dt) > 0) return;
      chk = 0.5;
      if (lampSig() !== sig) { build(); return; }
      const on = mesh.geometry.attributes.aOn; if (!on) return;
      let dirty = false;
      for (const L of cones) {
        const v = L.i > 0 ? 1 : 0, [o, m] = L._cone;
        if (on.array[o] !== v) { on.array.fill(v, o, o + m); dirty = true; }
      }
      if (dirty) on.needsUpdate = true;
    },
  };
}
