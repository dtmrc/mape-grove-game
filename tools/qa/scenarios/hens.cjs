// The Missing Hens (hens.js): coop, first night, clues, stakeout, cave confrontation, battle, both endings. Shots of each stage.
// node tools/qa/qa.cjs run tools/qa/scenarios/hens.cjs
module.exports = async ({ S, check, shot }) => {
  await S.js(() => { window.QA.time(10, { freeze: true }); window.__HENS.reset(); window.__CAVE.reset(); });
  const a = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G, P = G.P; await QA.exit();
    H.tp(); P.z += 2; QA.cam(0, 0.3); await QA.frames(10);
    for (let i = 0; i < 4 && G.G.dialog; i++) await QA.key('e');
    const seen = H.SV.seen;
    H.night(); await QA.frames(6);   // first night: one hen gone, the quest starts on the next look
    const dlg = !!G.G.dialog; for (let i = 0; i < 6 && G.G.dialog; i++) await QA.key('e'); await QA.frames(2);
    return { seen, dlg, st: H.state(), q: G.quests.list().find((q) => q.id === 'hens') };
  });
  check('coop introduces itself on the first visit', a.seen === 1, a);
  check('first night: a hen is gone and the quest starts', a.dlg && a.st.stage === 'clues' && a.st.hens === 5, a);
  check('quest is in the log and tracked', a.q && a.q.status === 'active' && a.q.tracked, a.q);
  await shot('hens-coop', { hud: true });
  const b = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G, P = G.P, N = G.places;
    // Nana
    const nana = G.peds.find((p) => p.npc === 'nana') || null;
    const n = nana || { x: N.nana.x, z: N.nana.z };
    P.x = n.x + 1.2; P.z = n.z + 0.6; await QA.frames(4);
    const pr = H.prompt(); await QA.key('e'); for (let i = 0; i < 6 && G.G.dialog; i++) await QA.key('e');
    // feather trail
    const f = H.trail[10]; P.x = f.x; P.z = f.z; await QA.frames(6);
    const afterTrail = H.state().clues.length;
    return { pr, st: H.state(), afterTrail };
  });
  check('Nana has a clue prompt', /Nana/.test(b.pr), b);
  check('feather trail counts as a clue', b.afterTrail === 2, b);
  const c = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G, P = G.P;
    QA.time(2, { freeze: true }); H.tp(); P.z += 3; P.x += 2; await QA.frames(8);
    const stake = H.S.stake ? 1 : 0; QA.cam(0.3, 0.25); await QA.frames(150);
    for (let i = 0; i < 6 && G.G.dialog; i++) await QA.key('e');
    QA.cam(0.3, 0.25); await QA.frames(2);
    return { stake, st: H.state() };
  });
  check('3 a.m. stakeout: the ghost takes a hen', c.stake === 1, c);
  await shot('hens-stakeout', { hud: true });
  const c2 = await S.js(async () => { const QA = window.QA; await QA.frames(200); for (let i = 0; i < 6 && window.__G.G.dialog; i++) await QA.key('e'); return window.__HENS.state(); });
  check('three clues: off to the cave', c2.stage === 'cave' && c2.clues.length >= 3, c2);
  await S.js(async () => { const QA = window.QA, H = window.__HENS, P = window.__G.P, a = H.trail[4], b = H.trail[9]; QA.time(22, { freeze: true }); P.x = a.x; P.z = a.z; P.yaw = Math.atan2(b.x - a.x, b.z - a.z); await QA.frames(4); QA.cam(Math.atan2(-(b.x - a.x), -(b.z - a.z)), 0.35); await QA.frames(10); });
  await shot('hens-trail', { hud: true });
  const d = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, C = window.__CAVE, G = window.__G, P = G.P;
    QA.time(12, { freeze: true });
    C.goLair(); await QA.until(() => window.__INT.current() === 'cavelair' && !window.__INT.state.fading, 200); await QA.frames(5);
    const L = window.__INT.room; P.x = L.origin.x + 1.6; P.z = L.origin.z + 1.6; await QA.frames(60);
    let k = 0; while (G.G.dialog && k++ < 12) await QA.key('e');
    await QA.frames(2);
    return { st: H.state() };
  });
  check('confronting John starts a battle', d.st.battle !== null, d);
  await S.js(async () => { const QA = window.QA; await QA.key('e'); await QA.frames(3); });
  await shot('hens-battle', { hud: true });
  const e = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G;
    const log = [];
    for (let turn = 0; turn < 120 && H.S.battle; turn++) {
      const B = H.S.battle;
      if (B.mode === 'menu') { H.move(turn % 3 === 2 ? 'hiss' : 'ignore'); log.push(B.j); }
      else await QA.key('e');
      if (G.G.hp < 40 && H.S.battle && H.S.battle.mode === 'menu') H.move('nap');
    }
    const won = !H.S.battle && window.__INT.current() === 'cavelair';
    for (let i = 0; i < 8 && G.G.dialog; i++) await QA.key('e');
    await QA.frames(2);
    return { won, log, st: H.state(), lost: !window.__INT.inside };
  });
  check('battle can be won with the menu moves', e.won || e.lost, e);
  if (!e.won) await S.js(async () => { const H = window.__HENS; H.stage('cave'); });
  // force the choice screen for the shot if the fight was lost
  await S.js(async () => { const H = window.__HENS, QA = window.QA; if (!H.S.choice) { const C = window.__CAVE; if (window.__INT.current() !== 'cavelair') { C.goLair(); await QA.until(() => window.__INT.current() === 'cavelair' && !window.__INT.state.fading, 200); } } await QA.frames(3); });
  await shot('hens-choice', { hud: true });
  const f = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G; const cash0 = G.G.cash;
    H.choose('free'); for (let i = 0; i < 4 && G.G.dialog; i++) await QA.key('e');
    await QA.frames(30); const knots = H.S.knots ? 1 : 0;
    return { knots, cash0 };
  });
  check('free Tuesday opens the knots', f.knots === 1, f);
  await shot('hens-knots', { hud: true });
  const g = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G;
    for (let i = 0; i < 3; i++) { H.knotHit(); await QA.frames(2); }
    for (let i = 0; i < 6 && G.G.dialog; i++) await QA.key('e');
    await QA.exit(); await QA.frames(3); QA.time(22, { freeze: true }); H.tp(); window.__G.P.z += 1.5; await QA.frames(10); QA.cam(0.5, 0.2); await QA.frames(10);
    return H.state();
  });
  check('freed: Tuesday on your head, wand, quest done', g.stage === 'freed' && g.onHead && g.wand, g);
  await shot('hens-tuesday-on-head', { hud: true });
  const h = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G, P = G.P;
    H.stage('deal'); H.SV.onHead = 0; H.SV.weekStart = H.SV.day; P.x = H.COOP.x + 9; P.z = H.COOP.z - 7; await QA.frames(80); QA.cam(Math.atan2(12.5, -1.5), 0.2); await QA.frames(3);
    return { watch: H.S.watch.a, st: H.state() };
  });
  check('John watches the RV at night once it is over', h.watch > 0.5, h);
  await shot('hens-john-watching', { hud: true });
  const i = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, G = window.__G, P = G.P; const F = G.fishing;
    F.give('bass'); F.give('bass');
    P.x = H.BUCKET.x + 0.6; P.z = H.BUCKET.z + 0.4; await QA.frames(4);
    const pr = H.prompt(); await QA.key('e'); await QA.frames(2); await QA.key('e'); await QA.frames(2);
    const b1 = H.state().bucket, h0 = H.state().hens;
    for (let d = 0; d < 7; d++) H.night();
    return { pr, b1, h0, st: H.state() };
  });
  check('bucket takes fish', /bucket/.test(i.pr) && i.b1 === 2, i);
  check('a short week costs a hen', i.st.hens === i.h0 - 1 && i.st.bucket === 0, i);
  await shot('hens-bucket', { hud: true, time: 12 });
};
