// Counts cars that pop in or vanish while on screen (inside the camera view and closer than the fog), on foot in town
// spinning the camera, then on the autopilot country lap. Compare builds with --html.
// node tools/qa/qa.cjs run tools/qa/scenarios/spawn-view.cjs [--secs 60]
module.exports = async ({ S, args, log }) => {
  await S.js(() => {
    const QA = window.QA, G = window.__G, T = G.camera.constructor; // THREE via the camera's prototype chain is not exported; build the frustum by hand
    const seen = new Set(G.cars), out = { popIn: 0, popOut: 0, spawns: 0, at: [] };
    const vis = (c) => {
      const cam = G.camera; cam.updateMatrixWorld();
      const d = Math.hypot(c.x - cam.position.x, c.z - cam.position.z); if (d > G.scene.fog.far) return false;
      const v = c.mesh.position.clone().set(c.x, 1, c.z).project(cam);
      return v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    };
    const step0 = QA.step.bind(QA);
    QA.step = (n = 1, o) => { for (let i = 0; i < n; i++) {
      const before = G.cars.slice(), was = new Map(before.map((c) => [c, vis(c)]));
      step0(1, o);
      for (const c of G.cars) if (!seen.has(c)) { seen.add(c); out.spawns++; if (vis(c)) { out.popIn++; out.at.push(['in', Math.round(c.x), Math.round(c.z), c.driver]); } }
      for (const c of before) if (!G.cars.includes(c) && was.get(c) && c !== G.P.car) { out.popOut++; out.at.push(['out', Math.round(c.x), Math.round(c.z), c.driver]); }
    } };
    window.__SV = out;
  });
  const foot = await S.js(async (secs) => {
    const QA = window.QA, G = window.__G; QA.setManual && QA.setManual(true);
    await QA.tp('donut');
    for (const c of G.cars.slice()) if (c.driver === 'ai') window.__G.cars.splice(G.cars.indexOf(c), 1), G.scene.remove(c.mesh); // empty town: forces respawns
    for (let f = 0; f < secs * 20; f++) { G.setCam(f * 0.01, 0.15); QA.step(1, { render: false }); }
    return { ...window.__SV, at: window.__SV.at.slice(0, 8), ai: G.cars.filter((c) => c.driver === 'ai').length };
  }, +(args.secs || 60));
  log('on foot: ' + JSON.stringify(foot));
  Object.assign(await S.js(() => { Object.assign(window.__SV, { popIn: 0, popOut: 0, spawns: 0, at: [] }); return 1; }));
  await require('./lap.cjs')({ S, args: { ...args, route: 'country' }, log });
  const drive = await S.js(() => ({ ...window.__SV, at: window.__SV.at.slice(0, 8), ai: window.__G.cars.filter((c) => c.driver === 'ai').length }));
  log('driving: ' + JSON.stringify(drive));
  return { foot, drive };
};
