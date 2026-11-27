// Missions keep going when your ride is wrecked (diet 2026-11-27): Casserole Run on foot / any car, Sprint in any car, Repo Man gets a fresh cart.
module.exports = {
  name: 'missions', desc: 'a wrecked vehicle no longer fails Casserole Run, Slurpee Sprint or Repo Man',
  async run({ S, check }) {
    const r = await S.js(async () => {
      const QA = window.QA, W = window.__G, { G, P, jobs, enterCar } = W, o = {};
      await QA.tp('rv', { settle: 2, render: false }); P.lock = 0;
      jobs.start('nana'); QA.step(2, { render: false });
      const m = W.mission; enterCar(m.car, true); QA.step(2, { render: false });
      m.car.dead = true; P.car = null; QA.step(3, { render: false });
      o.nanaAlive = !!W.mission && W.mission.id === 'nana'; o.nanaObj = G.objRaw;
      const s = W.mission.stops[0]; P.x = s.x; P.z = s.z; QA.step(3, { render: false });
      o.left = W.mission ? W.mission.stops.length : -1;
      W.busted(); QA.step(3, { render: false });
      jobs.start('kids'); QA.step(90, { render: false });
      const k = W.mission; k.car.dead = true; P.car = null; QA.step(20, { render: false });
      o.kidsAlive = !!W.mission && W.mission.id === 'kids'; o.kidsObj = G.objRaw;
      W.busted(); QA.step(3, { render: false });
      G.done.nana = true; jobs.start('repo'); QA.step(2, { render: false });
      const c0 = W.mission.cart; c0.dead = true; QA.step(3, { render: false });
      o.repoAlive = !!W.mission && W.mission.id === 'repo'; o.newCart = W.mission && W.mission.cart !== c0 && !W.mission.cart.dead;
      W.busted(); QA.step(3, { render: false });
      return o;
    });
    check('Casserole Run survives the wagon blowing up', r.nanaAlive && /on foot|any car/.test(r.nanaObj), r);
    check('casserole delivered on foot', r.left === 2, r);
    check('Slurpee Sprint survives a wreck', r.kidsAlive && /any car/.test(r.kidsObj), r);
    check('Repo Man hands you a fresh cart', r.repoAlive && r.newCart, r);
  },
};
