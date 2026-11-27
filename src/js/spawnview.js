// spawnview.js: keep cars from popping in (or out) where the player can see it (2026-11-27, diet: "cars spawning right in front of you").
// A spot counts as hidden when it is past the fog / draw distance, or when it is outside the camera's view cone
// (with a margin that grows with distance, so a small camera turn or a phone's narrow portrait view doesn't reveal it)
// and not right beside the player. Only called when a car spawns or despawns (about once a second), so it costs nothing per frame.
import * as THREE from 'three';

export function makeSpawnView({ camera, scene, px, pz }) {
  const fr = new THREE.Frustum(), m = new THREE.Matrix4(), s = new THREE.Sphere(new THREE.Vector3(), 1);
  let ready = false;
  function cone() {
    camera.updateMatrixWorld();
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    fr.setFromProjectionMatrix(m);
  }
  // hidden(x, z, near): true when a car at (x, z) can't be seen. `near` = metres from the player that stay off limits even behind the camera.
  function hidden(x, z, near = 35) {
    if (!ready) return Math.hypot(x - px(), z - pz()) > near; // before the first frame nobody has seen anything yet
    const cx = camera.position.x, cz = camera.position.z, d = Math.hypot(x - cx, z - cz);
    const fogFar = scene.fog ? scene.fog.far : camera.far;
    if (d > Math.min(fogFar, camera.far) + 6) return true; // fully fogged out / past the draw distance
    if (Math.hypot(x - px(), z - pz()) < near) return false;
    cone();
    s.center.set(x, 1.2, z); s.radius = 4 + d * 0.4; // car size + about 22 degrees of slack around the view
    return !fr.intersectsSphere(s);
  }
  return { hidden, ready: () => { ready = true; } };
}
