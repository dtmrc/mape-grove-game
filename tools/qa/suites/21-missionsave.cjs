// Missions survive a page reload (diet 2026-11-27: the test page refreshed mid Trash Panda Heist and the quest was lost).
// Runs a mission part way, snapshots it, reloads with the snapshot + main save carried in by hand (see 09-save for why
// the reload is fed the saved JSON), and checks the mission comes back where it was: bags, stage, timer, car.
async function reloadWith(S, keys) {
  await S.page.addInitScript((kv) => { if (/[?&]qa-restore=1\b/.test(location.search)) { for (const [k, v] of kv) { try { if (v) localStorage.setItem(k, v); } catch (e) { /* ignore */ } } } }, keys);
  await S.page.goto('file://' + S.o.html + '?qa-restore=1&n=' + Math.random()); await S.page.waitForFunction(() => window.QA && window.QA.ready(), null, { timeout: 120000 }); await S.js(() => window.QA.setManual(true));
  await S.start();
}
const grab = (S) => S.js(() => { const W = window.__G; W.msave.write(); return [[W.SAVE_KEY, localStorage.getItem(W.SAVE_KEY)], ['maple-grove-offleash-mission-v1', localStorage.getItem('maple-grove-offleash-mission-v1')]]; });

module.exports = {
  name: 'missionsave', desc: 'a mission in progress (bags, stage, timer, car) comes back after a page reload',
  async run({ S, check }) {
    // 1. Trash Panda Heist: two bags picked up, 40 s in
    const a = await S.js(async () => {
      const QA = window.QA, W = window.__G, { P, jobs } = W;
      await QA.tp('rv', { settle: 2, render: false }); P.lock = 0;
      jobs.start('ricky'); QA.step(1, { render: false });
      const m = W.mission;
      for (const b of m.bags.slice(0, 2)) { P.x = b.x; P.z = b.z; QA.step(0.5, { render: false }); }
      QA.step(40, { render: false });
      return { id: m.id, got: m.bags.filter((b) => !b.alive).length, timer: m.timer, x: P.x, z: P.z, left: m.bags.filter((b) => b.alive).map((b) => [b.x, b.z]) };
    });
    check('heist running with 2 bags', a.id === 'ricky' && a.got === 2, a);
    await reloadWith(S, await grab(S));
    const b = await S.js(() => { window.QA.step(1, { render: false }); const W = window.__G, m = W.mission; return m && { id: m.id, got: m.bags.filter((x) => !x.alive).length, alive: m.bags.filter((x) => x.alive).map((x) => [x.x, x.z]), timer: m.timer, stage: m.stage, x: W.P.x, z: W.P.z, obj: W.G.objRaw, toast: document.getElementById('toast')?.textContent }; });
    check('heist resumed after reload', b && b.id === 'ricky' && b.got === 2 && b.stage === 'collect', b);
    check('same bags left, same spots', b && JSON.stringify(b.alive) === JSON.stringify(a.left), { a: a.left, b: b && b.alive });
    check('timer carried over (+10 s grace)', b && Math.abs(b.timer - (a.timer + 10)) < 4, { before: a.timer, after: b && b.timer });
    check('back where you were', b && Math.hypot(b.x - a.x, b.z - a.z) < 3, { a, b });
    check('objective + toast say so', b && /\(2\/6\)/.test(b.obj) && /Picked up where you left off/.test(b.toast || ''), b);

    // 2. finishing the mission clears the snapshot; 3. Casserole Run, driving Nana's wagon, one stop done
    const c = await S.js(async () => {
      const QA = window.QA, W = window.__G, { P, jobs, enterCar } = W, o = {};
      W.busted(); QA.step(3, { render: false }); o.cleared = localStorage.getItem('maple-grove-offleash-mission-v1') === null && !W.mission;
      await QA.tp('rv', { settle: 2, render: false }); P.lock = 0;
      jobs.start('nana'); QA.step(1, { render: false }); const m = W.mission; enterCar(m.car, true); QA.step(2, { render: false });
      m.stops.shift(); m.next(); QA.step(5, { render: false });
      m.car.x += 6; QA.step(0.5, { render: false });
      o.stops = m.stops.map((s) => s.who); o.timer = m.timer; o.car = [m.car.x, m.car.z]; o.stage = m.stage;
      return o;
    });
    check('mission end clears the snapshot', c.cleared, c);
    await reloadWith(S, await grab(S));
    const d = await S.js(() => { window.QA.step(1, { render: false }); const W = window.__G, m = W.mission; return m && { id: m.id, stops: m.stops.map((s) => s.who), timer: m.timer, stage: m.stage, inCar: W.P.car === m.car, car: [m.car.x, m.car.z], check: W.G.check && W.G.check.label }; });
    check('casserole run resumed in the wagon', d && d.id === 'nana' && d.inCar && d.stage === 'drive', d);
    check('same stops left', d && JSON.stringify(d.stops) === JSON.stringify(c.stops), { c, d });
    check('wagon where it was', d && Math.hypot(d.car[0] - c.car[0], d.car[1] - c.car[1]) < 2, { c: c.car, d: d && d.car });

    // 4. every other mission: snapshot, drop it, rebuild from the snapshot in place (no reload) without errors
    const e = await S.js(async () => {
      const QA = window.QA, W = window.__G, { G, P, jobs } = W, K = 'maple-grove-offleash-mission-v1', o = {};
      W.busted(); QA.step(3, { render: false });
      G.done.nana = true; G.done.kids = true; G.done.ricky = true;
      for (const id of ['signs', 'repo', 'gary', 'kids', 'fish']) {
        await QA.tp('rv', { settle: 1, render: false }); P.lock = 0;
        jobs.start(id); QA.step(4, { render: false });
        const m = W.mission; if (id === 'signs') { const s = m.signs[0]; s.alive = false; W.scene.remove(s.g); W.scene.remove(s.mk); m.got = 1; }
        W.msave.write(); const snap = localStorage.getItem(K), t0 = m.timer;
        W.busted(); QA.step(3, { render: false });
        localStorage.setItem(K, snap); const r = W.msave.resumeNow(); QA.step(1, { render: false });
        o[id] = { ok: !!r && W.mission === r && r.id === id, t0, t1: r && r.timer, live: id === 'signs' && r ? r.signs.filter((s) => s.alive).length : undefined };
      }
      W.busted(); QA.step(3, { render: false });
      return o;
    });
    check('every mission resumes from a snapshot', Object.values(e).every((x) => x.ok), e);
    check('Sign Language keeps the pawed sign down', e.signs && e.signs.live === 5, e.signs);
  },
};
