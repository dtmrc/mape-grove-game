// Top-down orthographic shots: node tools/qa/qa.cjs run tools/qa/scenarios/topdown.cjs --spots "x,z,half;x,z,half" --tag name
module.exports = async ({ S, shot, args }) => {
  const spots = String(args.spots || '0,0,60').split(';').map((s) => s.split(',').map(Number));
  await S.js(() => window.QA.time(12, { freeze: true }));
  await S.js(() => window.QA.hud(false));
  const out = [];
  for (const [x, z, half] of spots) {
    await S.tp(`${x},${z}`);
    await S.js(([x, z, half]) => {
      const cam = window.__G.camera, proto = Object.getPrototypeOf(cam);
      const asp = innerWidth / innerHeight;
      cam.updateMatrixWorld = function (f) { this.position.set(x, 160, z); this.rotation.set(-Math.PI / 2, 0, 0); this.up.set(0, 0, -1); proto.updateMatrixWorld.call(this, true); };
      cam.updateProjectionMatrix = function () { this.projectionMatrix.makeOrthographic(-half * asp, half * asp, half, -half, 1, 1000); this.projectionMatrixInverse.copy(this.projectionMatrix).invert(); };
      cam.updateProjectionMatrix();
      window.__G.cat.visible = false;
      const sc = window.__G.scene; const f = sc.fog; if (f) for (const [k, v] of [['near', 1e5], ['far', 2e5], ['density', 0]]) try { Object.defineProperty(f, k, { get: () => v, set: () => {}, configurable: true }); } catch (e) { /* ignore */ }
    }, [x, z, half]);
    await S.js(() => window.QA.frames(4));
    out.push(await shot(`${args.tag || 'top'}_${x}_${z}`));
  }
  return out;
};
