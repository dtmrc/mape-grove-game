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

    // Repo Man kept resetting (diet 2026-11-28): the golf cart wrecked after a few bumps and the job went back to the lot.
    const q = await S.js(async () => {
      const QA = window.QA, W = window.__G, { G, P, jobs, enterCar, cars, places, spawnCar } = W, o = {};
      await QA.tp('nana', { settle: 1, render: false }); P.lock = 0;
      // a retired HOA patrol (now traffic) idling at the lot must not become the job's cart
      for (const k of cars.slice()) if (k.type === 'golfcart' && Math.hypot(k.x - places.hoaLot.x, k.z - places.hoaLot.z) < 14) W.removeCar(k);
      const ai = spawnCar('golfcart', places.hoaLot.x + 2, places.hoaLot.z, 0, { driver: 'ai' });
      G.done.nana = true; jobs.start('repo'); QA.step(1, { render: false });
      const m = W.mission, c = m.cart; o.notAi = c !== ai && c.driver !== 'ai'; W.removeCar(ai);
      o.tough = { hp: c.hp, fuel: c.fuel, keep: !!c.keep };
      // the parked-car cleanup (more than 26 cars, far away, out of sight) leaves the job's cart alone
      const pads = []; for (let i = 0; i < 30; i++) pads.push(spawnCar('sedan', -260 + i * 4, -260, 0, {}));
      const P0 = [P.x, P.z]; P.x = places.hoaLot.x > 0 ? -200 : 200; P.z = places.hoaLot.z > 0 ? -200 : 200; o.far = Math.round(Math.hypot(P.x - c.x, P.z - c.z));
      for (let i = 0; i < 20; i++) QA.step(0.5, { render: false });
      P.x = P0[0]; P.z = P0[1]; QA.step(0.5, { render: false });
      o.kept = !c.gone && cars.includes(c) && W.mission === m && m.cart === c;
      for (const p of pads) if (cars.includes(p)) W.removeCar(p);
      // ten hard knocks (14 m/s into a wall each) would scrap a stock cart; the job's cart still runs
      enterCar(c, true); QA.step(0.5, { render: false });
      c.hp -= 220;
      QA.step(1, { render: false });
      o.after = { hp: c.hp, dead: c.dead, taken: m.taken, obj: G.objRaw };
      W.busted(); QA.step(1, { render: false });
      o.cited = document.getElementById('banner')?.textContent || '';
      o.keepCleared = !c.keep;
      QA.step(3, { render: false });
      return o;
    });
    check('Repo Man never grabs a traffic cart', q.notAi, q);
    check('Repo Man cart is tough and fuelled', q.tough.hp >= 260 && q.tough.fuel === 100 && q.tough.keep, q.tough);
    check('car cleanup leaves the Repo Man cart alone', q.kept, q);
    check('Repo Man cart takes ten hard knocks', q.after.hp > 0 && !q.after.dead && q.after.taken, q.after);
    check('a citation says the job failed', /Repo Man failed/.test(q.cited) && q.keepCleared, q);

    // finished means done for the day (diet 2026-11-28: "finished it, but it's offered again"): gnome back, job back at 6 AM
    const d = await S.js(async () => {
      const QA = window.QA, W = window.__G, { G, P, jobs, enterCar } = W, o = {};
      await QA.tp('nana', { settle: 1, render: false }); P.lock = 0; G.clock = 12;
      G.done.nana = true; jobs.start('repo'); QA.step(1, { render: false });
      const m = W.mission; enterCar(m.cart, true); m.cart.x = m.drop.x; m.cart.z = m.drop.z; m.cart.vx = m.cart.vz = m.cart.speed = 0; QA.step(2, { render: false });
      o.passed = !W.mission; QA.step(1, { render: false });
      const row = () => W.quests.list().find((x) => x.id === 'repo');
      o.done = { status: row().status, step: row().step, marker: jobs.marks.repo.visible, saved: JSON.parse(localStorage.getItem('maple-grove-offleash-jobs-v1') || '{}').cool };
      G.clock = 23.9; QA.step(1, { render: false }); o.night = row().status;
      G.clock = 5.99; QA.step(1, { render: false }); G.clock = 6.05; QA.step(1, { render: false }); QA.step(1, { render: false });
      o.morning = { status: row().status, marker: jobs.marks.repo.visible };
      return o;
    });
    check('Repo Man passes at the RV', d.passed, d);
    check('finished Repo Man shows done, no marker, saved', d.done.status === 'done' && !d.done.marker && /Done for today/.test(d.done.step) && d.done.saved && d.done.saved.repo, d.done);
    check('still done that night', d.night === 'done', d);
    check('offered again next morning', d.morning.status === 'open' && d.morning.marker, d.morning);
  },
};
