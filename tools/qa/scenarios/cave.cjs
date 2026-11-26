// The Hollow Deep easter egg: torch, tunnel, rope descent, the ghost's dwelling. Shots of each stage.
// node tools/qa/qa.cjs run tools/qa/scenarios/cave.cjs
module.exports = async ({ S, check, shot }) => {
  await S.js(() => { window.QA.time(21, { freeze: true }); window.__CAVE.reset(); });
  const a = await S.js(async () => {
    const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P; await QA.exit();
    C.tp(); await QA.frames(4);
    // walk up to the post: local (1.9, 1.3) in front of it
    const s = C.spot, x = s.x + Math.sin(s.yaw) * 1.4 + Math.cos(s.yaw) * 1.9, z = s.z + Math.cos(s.yaw) * 1.4 - Math.sin(s.yaw) * 1.9;
    P.x = x; P.z = z; await QA.frames(3);
    const before = C.prompt(); await QA.key('e'); await QA.frames(3);
    return { before, held: C.S.held };
  });
  check('torch prompt by the post', /torch/i.test(a.before), a);
  check('torch taken', a.held, a);
  await shot('cave-mouth-torch', { hud: true });
  const b = await S.js(async () => {
    const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, s = C.spot;
    P.x = s.x + Math.sin(s.yaw) * 0.9; P.z = s.z + Math.cos(s.yaw) * 0.9; await QA.frames(3); await QA.key('e'); await QA.until(() => window.__INT.inside, 100); await QA.frames(20);
    return { room: window.__INT.current(), st: C.state() };
  });
  check('entered the tunnel', b.room === 'cave', b);
  await shot('cave-tunnel-start', { hud: true });
  const c = await S.js(async () => {
    const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, R = window.__INT.room, T = C.tun, p = T.pts[Math.round(T.pts.length * 0.3)];
    P.x = R.origin.x + p.x; P.z = R.origin.z + p.z; P.yaw = Math.atan2(p.tx, p.tz); G.setCam(P.yaw + Math.PI, 0.3); await QA.frames(10);
    return C.state();
  });
  check('depth gauge counts down the tunnel', c.depth > 60 && c.depth < 340, c);
  await shot('cave-tunnel-grotto', { hud: true });
  const d = await S.js(async () => {
    const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, R = window.__INT.room, T = C.tun, p = T.pts[T.pts.length - 3];
    P.x = R.origin.x + p.x; P.z = R.origin.z + p.z; await QA.frames(5);
    const n = T.pts.length; const e = T.pts[n - 1]; P.x = R.origin.x + e.x - e.tx * 4.1; P.z = R.origin.z + e.z - e.tz * 4.1; P.yaw = Math.atan2(e.tx, e.tz); await QA.frames(5);
    await QA.key('e'); await QA.until(() => window.__INT.current() === 'cavelair', 300); await QA.frames(40);
    return { room: window.__INT.current(), st: C.state() };
  });
  check('rope leads to the dwelling', d.room === 'cavelair' && d.st.depth === 1940, d);
  const e = await S.js(async () => {
    const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, R = window.__INT.room;
    P.x = R.origin.x + 1.6; P.z = R.origin.z + 1.6; P.yaw = Math.PI; G.setCam(0.3, 0.32); await QA.frames(60);
    for (let i = 0; i < 12 && G.G.dialog; i++) await QA.key('e');
    await QA.frames(10);
    return C.state();
  });
  check('the ghost appears', e.ghost === 'haunt' && e.met, e);
  await shot('cave-lair-ghost', { hud: true });
  const f = await S.js(async () => { const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, R = window.__INT.room; P.x = R.origin.x - 2; P.z = R.origin.z + 6; G.setCam(0.0, 0.25); await QA.frames(10); C.S.gh.x = -1; C.S.gh.z = -6; return C.state(); });
  await shot('cave-lair-gallery', { hud: false });
  await S.js(async () => { const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, R = window.__INT.room, yaw = 2.2; P.x = R.origin.x + 4; P.z = R.origin.z + 3; C.S.gh.state = 'talk'; C.S.gh.x = 4 - Math.sin(yaw) * 1.6; C.S.gh.z = 3 - Math.cos(yaw) * 1.6; G.cat.visible = false; G.setCam(yaw, 0.05); await QA.frames(12); });
  await shot('cave-ghost-closeup', { hud: false }); await S.js(() => { window.__G.cat.visible = true; });
  await S.js(async () => { const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, R = window.__INT.room; C.S.gh.state = 'haunt'; for (const k in C.chests) C.chests[k].userData.want = 1; P.x = R.origin.x + 8; P.z = R.origin.z + 6; G.setCam(-0.9, 0.35); await QA.frames(20); });
  await shot('cave-lair-chests', { hud: false });
  await S.js(async () => { const QA = window.QA, G = window.__G, P = G.P, R = window.__INT.room; P.x = R.origin.x - 9; P.z = R.origin.z + 3; G.setCam(-Math.PI / 2 + 0.2, 0.2); await QA.frames(10); });
  await shot('cave-lair-painting', { hud: false });
  const g = await S.js(async () => { const QA = window.QA, C = window.__CAVE, P = window.__G.P, R = window.__INT.room; await QA.exit(); await QA.frames(30); return { inside: window.__INT.inside, held: C.S.held }; });
  check('back outside, torch returned', !g.inside && !g.held, g);
  return { a, b, c, d, e };
};
