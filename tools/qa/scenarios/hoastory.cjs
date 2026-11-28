// HOA war chapter 1 (hoastory.js) + odd jobs board (oddjobs.js): notice at the RV, signatures, violation at 8 AM, boot +
// pay, the board hearing to a win, and one shift of each odd job. Shots of the couple, Gary Kim, the hearing and the board.
// node tools/qa/qa.cjs run tools/qa/scenarios/hoastory.cjs
module.exports = async ({ S, check, shot }) => {
  const dlg = () => S.js(async () => { const QA = window.QA, G = window.__G; for (let i = 0; i < 20 && G.G.dialog; i++) await QA.key('e'); await QA.frames(2); });
  await S.js(async () => { const QA = window.QA, G = window.__G; QA.time(15, { freeze: true }); window.__HOA.reset(); G.G.done = {}; G.G.cash = 0; await QA.exit(); await QA.frames(2); });
  // ---- notice
  const a = await S.js(async () => {
    const QA = window.QA, G = window.__G, P = G.P, H = window.__HOA, rv = G.places.rv; await QA.frames(420);   // warm-up (20 s)
    P.x = rv.x - 2; P.z = rv.z + 9; P.yaw = Math.PI; await QA.frames(4);
    return { dlg: !!G.G.dialog, who: G.G.dialog && G.G.dialog.lines[0][0], st: H.SV.st, vis: H.pair.map((m) => m.visible) };
  });
  check('walking up to the RV serves the notice', a.dlg && a.who === 'Tyrone' && a.vis.every(Boolean), a);
  await S.js(async () => { const QA = window.QA, G = window.__G, rv = G.places.rv; QA.cam(Math.PI * 0.85 + Math.PI, 0.18); await QA.frames(3); });
  await shot('hoa-notice', { hud: true });
  await dlg();
  const b = await S.js(() => ({ ...window.__HOA.state(), chip: document.getElementById('hoachip').textContent, track: window.__G.quests.S.track }));
  check('notice starts the clock, $300 fines, quest tracked, HUD chip', b.st === 'petition' && b.fines === 300 && b.left > 4000 && /EVICTION 2d 23h/.test(b.chip) && b.track === 'notice', b);
  // ---- signatures from finished jobs
  const c = await S.js(async () => { const QA = window.QA, G = window.__G; G.G.done.nana = true; G.G.done.kids = true; await QA.frames(25); const s1 = window.__HOA.state().sigs; G.G.done.ricky = true; await QA.frames(25); return { s1, s2: window.__HOA.state().sigs, obj: G.quests.list ? null : null }; });
  check('neighbors sign when their job is done', c.s1 === 2 && c.s2 === 3, c);
  // ---- violation at 8 AM
  const d = await S.js(async () => { const QA = window.QA, H = window.__HOA; const f0 = H.SV.fines; QA.time(7.98, { freeze: false }); await QA.frames(40); return { f0, f1: H.SV.fines, day: H.SV.day }; });
  check('a new violation is pinned at 8 AM', d.f1 > d.f0, d);
  // ---- boot + pay
  const e = await S.js(async () => {
    const QA = window.QA, G = window.__G, H = window.__HOA, P = G.P; H.clock(0.1); await QA.frames(3);
    const booted = H.SV.booted, closed = window.__INT && window.__INT.state ? null : null;
    G.G.cash = 2000; const door = (window.__HAUNT && window.__HAUNT.HOA.door) || { x: -50, z: -48.3 };
    P.x = door.x; P.z = door.z - 1.4; await QA.frames(4); const pr = H.prompt(); await QA.key('e'); await QA.frames(2);
    return { booted, pr, after: H.state(), cash: G.G.cash };
  });
  check('clock out boots the RV; paying at the office unboots and restarts the clock', e.booted && /Pay HOA fines/.test(e.pr) && !e.after.booted && e.after.fines === 0 && e.after.left > 2800, e);
  // ---- hearing at 6 PM
  const f = await S.js(async () => {
    const QA = window.QA, G = window.__G, H = window.__HOA, P = G.P; QA.time(18.5, { freeze: true }); await QA.frames(3);
    const sp = H.pair[0].position; P.x = sp.x + 0.6; P.z = sp.z - 1.6; P.yaw = 0; await QA.frames(4); const pr = H.prompt(); await QA.key('e'); await QA.frames(2);
    return { pr, sp: { x: sp.x, z: sp.z } };
  });
  check('the board sits at 6 PM with a hearing prompt', /Board Hearing/.test(f.pr), f);
  await dlg();
  await S.js(async () => { const QA = window.QA; for (let i = 0; i < 6; i++) { window.__HOA.move(); await QA.frames(1); } QA.cam(0, 0.2); await QA.frames(3); });
  await shot('hoa-hearing', { hud: true });
  const g = await S.js(async () => {
    const QA = window.QA, H = window.__HOA, G = window.__G; let n = 0;
    while (H.S.battle && n++ < 200) { const B = H.S.battle; const k = B.mode !== 'menu' ? undefined : (B.left.length && !B.review ? 0 : B.n < 34 && B.groom > 0 ? 3 : 2); H.move(k); await QA.frames(1); }
    for (let i = 0; i < 20 && G.G.dialog; i++) await QA.key('e');
    await QA.frames(3); return { n, ...H.state(), cash: G.G.cash };
  });
  check('the hearing battle ends (win suspends the eviction)', !g.battle && (g.st === 'won' || g.st === 'petition'), g);
  check('with fines paid and 3 signatures the board loses (seeded)', g.st === 'won', g);
  // ---- Gary Kim + the couple at home
  await S.js(async () => { const QA = window.QA, G = window.__G, P = G.P; QA.time(14, { freeze: true }); const gp = G.peds.find((p) => p.npc === 'gary'); P.x = gp.x + Math.sin(gp.yaw) * 2.6; P.z = gp.z + Math.cos(gp.yaw) * 2.6; await QA.frames(6); QA.cam(gp.yaw + Math.PI + 0.5, 0.15); await QA.frames(3); });
  await shot('hoa-gary-kim', { hud: false });
  // ---- odd jobs
  const h = await S.js(async () => {
    const QA = window.QA, G = window.__G, P = G.P, J = G.oddjobs; const B = J.BOARD; P.x = B.x + 1.2; P.z = B.z + 0.4; await QA.frames(4);
    const pr = J.prompt(); QA.cam(Math.atan2(P.x - B.x, P.z - B.z), 0.15); await QA.frames(2); return { pr };
  });
  check('jobs board prompt by the RV', /odd jobs/.test(h.pr), h);
  await shot('hoa-jobsboard', { hud: true });
  const i = await S.js(async () => {
    const QA = window.QA, G = window.__G, P = G.P, J = G.oddjobs, o = {}; const c0 = G.G.cash;
    J.start('lawnduty'); await QA.frames(2); const m = G.mission; P.x = m.lawn.x; P.z = m.lawn.z; await QA.frames(4); o.stage = m.stage;
    for (const p of m.pts) { P.x = p.x; P.z = p.z; await QA.frames(2); }
    await QA.frames(2); o.lawn = !G.mission; o.cash1 = G.G.cash - c0;
    J.start('pizzarun'); await QA.frames(2); const z = G.mission; const s = G.G.check; P.x = s.x; P.z = s.z; await QA.frames(4); o.pstage = z.stage; const t = z.to; P.x = t.x; P.z = t.z; await QA.frames(4); o.pizza = !G.mission; o.cash2 = G.G.cash - c0;
    J.start('towrescue'); await QA.frames(2); const w = G.mission; G.enterCar(w.car); await QA.frames(4); w.car.x = w.drop.x; w.car.z = w.drop.z; w.car.speed = 0; w.car.vx = w.car.vz = 0; await QA.frames(6); o.tow = !G.mission; o.cash3 = G.G.cash - c0; o.done = J.S.done; o.streak = J.S.streak;
    return o;
  });
  check('three odd jobs pay out (and the streak bonus)', i.lawn && i.pizza && i.tow && i.cash3 > 140 && i.done >= 3, i);
  return null;
};
