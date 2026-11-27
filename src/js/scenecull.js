// scenecull.js: keep the per-frame scene walk proportional to what can be seen (2026-11-27).
// three.js walks every object in the scene twice a frame (world matrices, then the render list), whether or not it is
// hidden or 400 m away. Two rules cut that down without changing a pixel:
//  1. Hidden top-level objects (interior rooms while outside, day-time halos, parked effects) skip the matrix walk.
//     Their matrices are brought up to date on the frame they are shown again, before anything is drawn.
//  2. Cars and pedestrians further from the camera than the far plane leave the scene graph ("asleep") and come back
//     when they are in range. The simulation still moves them; only the drawing bookkeeping stops.
export function makeSceneCull({ scene, camera }) {
  const stats = { skipped: 0, asleep: 0 };
  scene.matrixWorldAutoUpdate = false;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) {
    const ch = scene.children; let skipped = 0;
    for (let i = 0; i < ch.length; i++) { const c = ch[i]; if (c.visible) c.updateMatrixWorld(); else skipped++; }
    stats.skipped = skipped;
    if (prev) prev.apply(this, a);
  };
  /** Take far-away things (items with x, z, mesh) out of the scene graph and put them back when near. */
  function sleepFar(list, far) {
    const cx = camera.position.x, cz = camera.position.z, out2 = (far + 12) * (far + 12), in2 = (far + 4) * (far + 4);
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i], m = o.mesh, dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
      if (o._asleep) { if (d2 < in2 || d2 !== d2) { o._asleep = false; if (!m.parent) scene.add(m); } else n++; }
      else if (d2 > out2 && m.parent === scene) { o._asleep = true; scene.remove(m); n++; }
    }
    stats.asleep = n;
  }
  /** Before removing a thing for good: make sure a later pass can't put it back. */
  function forget(o) { o._asleep = false; }
  return { sleepFar, forget, stats };
}
