// House fires: kit, ignite inside the Quik Stop, fire spreads.
module.exports = {
  name: 'fire', desc: 'fire kit, ignite in the Quik Stop, fire grows and breaks out',
  async run({ S, check, shot }) {
    const r = await S.js(async () => {
      const QA = window.QA, F = window.__FIRE; F.give('all'); F.S.inv.fluid = true;
      await QA.enter('quik'); const ok = F.ignite('quik'); QA.step(10, { render: false });
      F.skip(12); QA.step(20, { render: false });
      return { ok, st: F.state.fires.quik };
    });
    check('fire starts inside the Quik Stop', r.ok && !!r.st, r);
    await shot('quik-fire', { hud: false });
    const o = await S.js(async () => { const QA = window.QA, F = window.__FIRE; window.__G.G.hp = 100; await QA.exit(); F.skip(6); QA.step(20, { render: false }); return F.state.fires.quik; });
    check('fire breaks out of the building', o && o.st === 'blaze', o);
    await S.js(() => { window.__G.G.hp = 100; });
  },
};
