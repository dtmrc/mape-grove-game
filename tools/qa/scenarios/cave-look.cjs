// Fixed views of the Hollow Deep (branching cave, dwelling, mouth) for before/after sheets, with draw calls per view.
// node tools/qa/qa.cjs run tools/qa/scenarios/cave-look.cjs --out qa-out/cave-look [--only cave|lair|mouth] [--time 21]
// Each view: [name, cat local x, z, camera yaw, pitch]
const CAVE = [['entrance', 0, 52, 0, 0.25], ['fork', 0, 47.5, 0.3, 0.3], ['grotto', -24, 28.5, 1.2, 0.3], ['hall', -19, 3, 1.9, 0.3], ['pool', -11, -32.5, 0.2, 0.42], ['gallery', 22, 2, 1.8, 0.28], ['deadend', -40.5, 37.5, 2.6, 0.3], ['squeeze', -42, -2, -0.2, 0.3], ['pit', -25.5, -45.5, 0.2, 0.3]];
const LAIR = [['a', -2, 6, 0, 0.25], ['b', 8, 6, -0.9, 0.35], ['c', -9, 3, -Math.PI / 2 + 0.2, 0.2], ['pool', 3, 8.5, 2.6, 0.3], ['shrine', -9.5, -8.5, 0.5, 0.25]];
const MOUTH = [['front', 0, 7.5, 0, 0.18], ['side', 5.5, 5, -0.8, 0.2], ['approach', 0, 26, 0, 0.15]];   // mouth-local (x right, z out of the cave)
module.exports = async ({ S, shot, args }) => {
  const only = args && args.only ? String(args.only).split(',') : ['cave', 'lair', 'mouth'], stats = {};
  const st = () => S.js(() => (({ drawCalls, glTris }) => ({ drawCalls, glTris }))(window.QA.stats()));
  await S.js((h) => { window.QA.time(h, { freeze: true }); window.__CAVE.reset(); }, args && args.time !== undefined ? +args.time : 21);
  if (only.includes('mouth')) for (const [k, lx, lz, yaw, pitch] of MOUTH) {
    await S.js(async ([lx, lz, yaw, pitch]) => {
      const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, s = C.spot; await QA.exit(); QA.hud(false);
      P.x = s.x + lx * Math.cos(s.yaw) + lz * Math.sin(s.yaw); P.z = s.z - lx * Math.sin(s.yaw) + lz * Math.cos(s.yaw); P.yaw = s.yaw + Math.PI;
      for (let i = 0; i < 14; i++) { QA.cam(s.yaw + yaw, pitch); QA.step(1); }
    }, [lx, lz, yaw, pitch]);
    await shot(`mouth-${k}`, { hud: false }); stats[`mouth-${k}`] = await st();
  }
  if (only.includes('cave')) for (const [k, x, z, yaw, pitch] of CAVE) {
    await S.js(async ([x, z, yaw, pitch]) => {
      const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P;
      if (window.__INT.current() !== 'cave') { await QA.exit(); C.tunnel(); await QA.frames(6); }
      const R = window.__INT.room; P.x = R.origin.x + x; P.z = R.origin.z + z; P.yaw = yaw + Math.PI; QA.hud(false);
      for (let i = 0; i < 14; i++) { QA.cam(yaw, pitch); QA.step(1); }
    }, [x, z, yaw, pitch]);
    await shot(`cave-${k}`, { hud: false }); stats[`cave-${k}`] = await st();
  }
  if (only.includes('lair')) for (const [k, x, z, yaw, pitch] of LAIR) {
    await S.js(async ([x, z, yaw, pitch]) => {
      const QA = window.QA, G = window.__G, P = G.P;
      if (window.__INT.current() !== 'cavelair') { await QA.exit(); window.__CAVE.goLair(); await QA.frames(40); for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e'); }
      const R = window.__INT.room; P.x = R.origin.x + x; P.z = R.origin.z + z; P.yaw = yaw + Math.PI; QA.hud(false);
      for (let i = 0; i < 14; i++) { QA.cam(yaw, pitch); QA.step(1); }
    }, [x, z, yaw, pitch]);
    await shot(`lair-${k}`, { hud: false }); stats[`lair-${k}`] = await st();
  }
  return stats;
};
