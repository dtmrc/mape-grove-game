// Fishing: cast from the dock with a rod and worms.
module.exports = {
  name: 'fishing', desc: 'cast from the dock, line state changes, respawn clears it',
  async run({ S, check }) {
    const r = await S.js(async () => {
      const QA = window.QA, { P, fishing } = window.__G;
      fishing.S.gear.rod = true; fishing.S.gear.worms = 6;
      await QA.tp('-20,76,0', { settle: 4, render: false }); P.lock = 0;
      const ok = fishing.interact(); QA.step(2, { render: false });
      return { ok, st: fishing.S.fish.st };
    });
    check('cast starts on the dock', r.ok && r.st === 'cast', r);
    const b = await S.js(async () => { const { G, busted, fishing } = window.__G; G.cash = 200; busted(); window.QA.step(3, { render: false }); return fishing.S.fish.st; });
    check('respawn during a cast resets fishing', b === 'idle', b);
  },
};
