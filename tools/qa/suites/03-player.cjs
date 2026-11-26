// On-foot movement: walk, sprint, jump, swim.
module.exports = {
  name: 'player', desc: 'walk, sprint faster than walk, jump leaves the ground, lake swim',
  async run({ S, check }) {
    await S.tp('green');
    const w = await S.js(() => window.QA.walk(40));
    check('walking forward moves Goobles', w.dist > 2, w);
    await S.tp('green');
    const s = await S.js(() => window.QA.walk(40, ['w', 'shift']));
    check('sprint covers more ground than walking', s.dist > w.dist * 1.15, { walk: w.dist, sprint: s.dist });
    const j = await S.js(async () => { const QA = window.QA, P = window.__G.P; QA.down(' '); QA.step(1, { render: false }); QA.up(' '); let peak = 0; for (let i = 0; i < 20; i++) { QA.step(1, { render: false }); peak = Math.max(peak, P.y); } QA.step(20, { render: false }); return { peak, land: P.y }; });
    check('jump leaves the ground and lands', j.peak > 0.4 && j.land < 0.1, j);
    const sw = await S.js(async () => { const QA = window.QA, G = window.__G; await QA.tp('dock', { settle: 4 }); const d = G.places.dock; for (let i = 0; i < 240 && !G.P.swim; i++) { G.P.x = d.x - 0 + 0; G.P.z = d.z + i * 0.25; QA.step(1, { render: false }); } return { swim: G.P.swim, st: QA.state() }; });
    check('walking into Lake Juniper swims', sw.swim, sw.st);
    const mw = await S.js(async () => { const QA = window.QA, M = window.__MEOW; await QA.tp('green'); const c0 = M.count; QA.step(1600, { render: false }); return { n: M.count - c0, last: M.last }; });
    check('Goobles meows at random while standing around (80 s)', mw.n >= 2 && mw.n <= 6, mw);
    // bug 2026-11-26: run over, then arrested mid-tumble -> respawned at the RV still lying flat
    const up = await S.js(async () => { const QA = window.QA, G = window.__G, body = G.cat.userData.body; await QA.tp('green'); G.P.down = 1.4; QA.step(3, { render: false }); const flat = body.rotation.x; G.busted(); QA.step(10, { render: false }); return { flat, after: body.rotation.x, down: G.P.down }; });
    check('respawn while knocked down stands Goobles back up', up.flat < -1 && Math.abs(up.after) < 0.01, up);
  },
};
