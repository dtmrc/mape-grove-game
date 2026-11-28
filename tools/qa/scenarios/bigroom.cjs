// Views of a big multi-room interior: a top-down plan (ceilings are one-sided, so the camera sees in from above) and
// cat's-eye shots at given room-local spots.
//   node tools/qa/qa.cjs run tools/qa/scenarios/bigroom.cjs --room gary [--half 10] [--views '[["name",x,z,yaw,pitch],...]'] [--top 0]
// Prints build / bake stats and draw calls for each view.
module.exports = async ({ S, shot, args, log }) => {
  const id = args.room || 'gary';
  const st = await S.js(async ([id]) => {
    const QA = window.QA; await window.__INT.ready; const t0 = performance.now(); await QA.enter(id); const ms = performance.now() - t0;
    const R = window.__INT.room; let tris = 0, meshes = 0, bytes = 0;
    R.group.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) { meshes++; tris += o.geometry.attributes.position.count / 3; for (const k in o.geometry.attributes) bytes += o.geometry.attributes[k].array.byteLength; } });
    QA.hud(false);
    return { ms: Math.round(ms), bake: R.bake, tris, meshes, MB: +(bytes / 1048576).toFixed(2), cols: R.cols.length, lights: (R.out.lights || []).length, stats: R.out.stats && R.out.stats(), errors: window.__INT.state.errors };
  }, [id]);
  console.log(JSON.stringify(st));
  const views = args.views ? JSON.parse(args.views) : [];
  for (const [name, x, z, yaw, pitch] of views) {
    const d = await S.js(async ([x, z, yaw, pitch]) => {
      const QA = window.QA, r = window.__INT.room, P = window.__G.P; P.x = r.origin.x + x; P.z = r.origin.z + z; P.y = 0;
      for (let i = 0; i < 14; i++) { QA.cam(yaw, pitch ?? 0.3); QA.step(1); }
      return QA.stats ? QA.stats().drawCalls : null;
    }, [x, z, yaw, pitch]);
    console.log(name, 'draws', d);
    await shot(`${id}-${name}`, { hud: false });
  }
  if (args.top !== '0') {
    await S.js(([half]) => {
      const cam = window.__G.camera, proto = Object.getPrototypeOf(cam), r = window.__INT.room, asp = innerWidth / innerHeight;
      cam.updateMatrixWorld = function (f) { this.position.set(r.origin.x, 60, r.origin.z); this.rotation.set(-Math.PI / 2, 0, 0); proto.updateMatrixWorld.call(this, true); };
      cam.updateProjectionMatrix = function () { this.projectionMatrix.makeOrthographic(-half * asp, half * asp, half, -half, 1, 1000); this.projectionMatrixInverse.copy(this.projectionMatrix).invert(); };
      cam.updateProjectionMatrix(); window.__G.cat.visible = false;
    }, [+(args.half || 10)]);
    await S.js(() => window.QA.frames(4));
    await shot(`${id}-top`, { hud: false });
  }
};
