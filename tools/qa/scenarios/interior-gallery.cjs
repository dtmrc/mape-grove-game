// Fixed-camera shots of every interior (and the cave) for before/after comparisons, plus draw calls per view.
// node tools/qa/qa.cjs run tools/qa/scenarios/interior-gallery.cjs --out qa-out/gallery-before [--rooms rv,quik]
// Each view: [name, cat local x, cat local z, cam yaw, cam pitch]. x/z as fractions of the room size when |v| <= 0.5.
const VIEWS = {
  rv: [['a', 0, 0.3, 0, 0.3], ['b', 0, -0.25, Math.PI, 0.35]],
  quik: [['a', 0, 0.3, 0, 0.3], ['b', 0.25, -0.2, 2.4, 0.35]],
  diner: [['a', 0, 0.3, 0, 0.3], ['b', -0.25, -0.1, 2.3, 0.35]],
  nana: [['a', 0, 0.3, 0, 0.3], ['b', 0.2, -0.2, 2.5, 0.35]],
  church: [['a', 0, 0.38, 0, 0.25], ['b', 0, -0.3, Math.PI, 0.3]],
  donut: [['a', 0, 0.3, 0, 0.3], ['b', -0.2, -0.15, 2.3, 0.35]],
  pizza: [['a', 0, 0.3, 0, 0.3], ['b', 0.2, -0.2, 2.4, 0.35]],
  school: [['a', 0, 0.35, 0, 0.3], ['b', -0.3, -0.2, 2.4, 0.35]],
  pd: [['a', 0, 0.35, 0, 0.3], ['b', 0.25, -0.2, 2.4, 0.35]],
  pd2: [['a', 0, 0.2, 0, 0.3], ['b', 0, -0.2, Math.PI, 0.35]],
  jail: [['a', 0, 0.2, 0, 0.3]],
  hoahall: [['a', 0, 0.3, 0, 0.3], ['b', 0, -0.2, Math.PI, 0.35]],
  cavelair: [['a', -2, 6, 0, 0.25], ['b', 8, 6, -0.9, 0.35], ['c', -9, 3, -Math.PI / 2 + 0.2, 0.2]],
};
module.exports = async ({ S, shot, args, log }) => {
  const want = args && args.rooms ? String(args.rooms).split(',') : [...Object.keys(VIEWS), 'cave'];
  const stats = {};
  await S.js(() => { window.QA.time(21, { freeze: true }); if (window.__CAVE) window.__CAVE.reset(); });
  for (const id of want) {
    if (id === 'cave') {
      for (const [k, f] of [['a', 0.08], ['b', 0.3], ['c', 0.62], ['d', 0.93]]) {
        const r = await S.js(async (f) => {
          const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P;
          if (window.__INT.current() !== 'cave') { await QA.exit(); C.tunnel(); await QA.frames(6); }
          const R = window.__INT.room, T = C.tun, p = T.pts[Math.round((T.pts.length - 1) * f)];
          P.x = R.origin.x + p.x; P.z = R.origin.z + p.z; P.yaw = Math.atan2(p.tx, p.tz); QA.hud(false);
          for (let i = 0; i < 12; i++) { G.setCam(P.yaw + Math.PI, 0.3); QA.step(1); }
          return true;
        }, f);
        await shot(`cave-${k}`, { hud: false });
        stats[`cave-${k}`] = await S.js(() => (({drawCalls,glTris})=>({drawCalls,glTris}))(window.QA.stats()));
      }
      continue;
    }
    for (const [k, x, z, yaw, pitch] of VIEWS[id] || []) {
      const ok = await S.js(async ([id, x, z, yaw, pitch]) => {
        const QA = window.QA, G = window.__G, P = G.P;
        if (id === 'cavelair') { if (window.__INT.current() !== 'cavelair') { await QA.exit(); window.__CAVE.goLair(); await QA.frames(40); for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e'); } }
        else if (window.__INT.current() !== id) await QA.enter(id);
        const R = window.__INT.room; if (!R || window.__INT.current() !== id) return false;
        const fx = Math.abs(x) <= 0.5 ? x * R.size[0] : x, fz = Math.abs(z) <= 0.5 ? z * R.size[1] : z;
        P.x = R.origin.x + fx; P.z = R.origin.z + fz; P.yaw = yaw + Math.PI; QA.hud(false);
        for (let i = 0; i < 14; i++) { QA.cam(yaw, pitch); QA.step(1); }
        return true;
      }, [id, x, z, yaw, pitch]);
      if (!ok) { log(`${id}: could not enter`); continue; }
      await shot(`${id}-${k}`, { hud: false });
      stats[`${id}-${k}`] = await S.js(() => (({drawCalls,glTris})=>({drawCalls,glTris}))(window.QA.stats()));
    }
  }
  return stats;
};
