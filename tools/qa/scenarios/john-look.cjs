// Close views for the Ghost of John pass (2026-11-28): the six poems in the dwelling, John himself, the periscope view.
// node tools/qa/qa.cjs run tools/qa/scenarios/john-look.cjs --out qa-out/john-look [--only poems|john|scope]
const POEMS = ['poem1', 'poem2', 'poem3', 'poem4', 'poem5', 'poem6'];
module.exports = async ({ S, shot, args }) => {
  const only = args && args.only ? String(args.only).split(',') : ['poems', 'john', 'scope'], out = {};
  await S.js(async () => {
    const QA = window.QA, G = window.__G; QA.time(21, { freeze: true }); window.__CAVE.reset(); QA.hud(false);
    window.__CAVE.goLair(); await QA.frames(40); for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e');
  });
  if (only.includes('poems')) for (const id of POEMS) {
    out[id] = await S.js(async (id) => {
      const QA = window.QA, G = window.__G, P = G.P, R = window.__INT.room, h = R.spots.find((s) => s.id === id);
      if (!h) return { missing: true };
      P.x = R.origin.x + h.x; P.z = R.origin.z + h.z; QA.step(2);
      const moved = Math.hypot(P.x - R.origin.x - h.x, P.z - R.origin.z - h.z);
      const src = window.__CAVE.poemAt ? window.__CAVE.poemAt[id] : { x: h.x, z: h.z };
      const yaw = Math.atan2(h.x - src.x, h.z - src.z); P.yaw = yaw + Math.PI;
      for (let i = 0; i < 14; i++) { QA.cam(yaw, 0.3); QA.step(1); }
      return { x: h.x, z: h.z, pushedBy: +moved.toFixed(2), prompt: (document.querySelector('#prompt') || {}).textContent || '' };
    }, id);
    await shot(`poem-${id}`, { hud: false });
  }
  if (only.includes('john')) {
    for (const [k, yaw, dist, h] of [['front', 0, 2.6, 1.3], ['side', 1.2, 2.6, 1.3], ['back', Math.PI, 2.8, 1.4], ['face', 0.25, 1.0, 1.75], ['boots', 0.5, 1.3, 0.5]]) {
      await S.js(async ([yaw, dist, h]) => {
        const QA = window.QA, G = window.__G, P = G.P, R = window.__INT.room, C = window.__CAVE, g = C.S.gh;
        P.x = R.origin.x + 6; P.z = R.origin.z + 9; g.state = 'talk'; g.x = 2; g.z = 3; g.a = 1; g.yaw = 0; g.talking = true;
        const gx = R.origin.x + 2, gz = R.origin.z + 3;
        window.__camO = [[gx + Math.sin(yaw) * dist, h, gz + Math.cos(yaw) * dist], [gx, h * 0.6 + 0.55, gz]];
        QA.step(3); C.ghost.rotation.y = 0; C.ghost.position.set(2, 0, 3); QA.step(0);
      }, [yaw, dist, h]);
      await shot(`john-${k}`, { hud: false });
    }
    await S.js(() => { window.__camO = null; window.__CAVE.S.gh.talking = false; window.__CAVE.S.gh.state = 'haunt'; });
  }
  if (only.includes('scope')) {
    for (const [k, hour] of [['day', 15], ['night', 22]]) {
      out['scope-' + k] = await S.js(async (hour) => {
        const QA = window.QA, G = window.__G, P = G.P, C = window.__CAVE;
        if (window.__INT.current() !== 'cavelair') { C.goLair(); await QA.frames(40); for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e'); }
        QA.time(hour, { freeze: true });
        const R = window.__INT.room, h = R.spots.find((s) => s.id === 'periscope'); P.x = R.origin.x + h.x; P.z = R.origin.z + h.z; QA.step(2);
        C.periscope(); QA.step(20);
        const st = { phase: C.scope.S.phase, room: window.__INT.current(), fov: G.camera.fov, catHidden: !G.G.cat && true };
        return st;
      }, hour);
      await shot(`scope-${k}`);
      await S.js(async () => { const QA = window.QA, C = window.__CAVE; C.scope.S.yaw = -0.3; C.scope.S.fov = 14; QA.step(3); });
      await shot(`scope-${k}-zoom`);
      out['scope-' + k + '-back'] = await S.js(async () => { const QA = window.QA, C = window.__CAVE, G = window.__G; C.scope.close(); QA.step(14); return { phase: C.scope.S.phase, room: window.__INT.current(), fov: G.camera.fov, camO: !!window.__camO }; });
    }
    await shot('scope-after');
  }
  return out;
};
