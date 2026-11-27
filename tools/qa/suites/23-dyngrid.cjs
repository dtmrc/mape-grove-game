// The broad phase for moving things (src/js/dyngrid.js): the work per frame must follow what is NEAR each car,
// not how many cars exist. Parks rows of extra cars far apart out in the fields and counts the candidates the
// grid hands back per car per frame at three population sizes. Brute force would grow in step with the count.
module.exports = {
  name: 'dyngrid', desc: 'car / ped proximity work per car stays flat as the number of cars grows 8x',
  async run({ S, check, log }) {
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G, D = G.dyn, out = [];
      await QA.tp('green', { settle: 10, render: false });
      const mine = [];
      const measure = (label) => {
        QA.step(5, { render: false });
        const c0 = D.cars.stats.returned + D.peds.stats.returned, t0 = performance.now ? 0 : 0, n = 40;
        const w0 = Date.now(); QA.step(n, { render: false }); const ms = (Date.now() - w0) / n;
        const per = (D.cars.stats.returned + D.peds.stats.returned - c0) / n / G.cars.length;
        out.push({ label, cars: G.cars.length, peds: G.peds.length, perCarPerFrame: +per.toFixed(2), msPerFrame: +ms.toFixed(2) });
      };
      measure('base');
      // parked cars on a 14 m lattice in the south-east fields (role keeps the population cap from clearing them)
      const add = (n) => { for (let i = 0; i < n; i++) { const k = mine.length, c = G.spawnCar('sedan', 150 + (k % 16) * 14, 150 + Math.floor(k / 16) * 14, 0, { role: 'qa-park' }); mine.push(c); } };
      add(75); measure('x4');
      add(100); measure('x8');
      // a head-on pair far from everything still collides (the grid finds neighbours across cell borders)
      const a = G.spawnCar('sedan', -200.2, 200, Math.PI / 2, { role: 'qa-park' }), b = G.spawnCar('sedan', -195.9, 200, -Math.PI / 2, { role: 'qa-park' });
      mine.push(a, b); a.vx = 8; b.vx = -8; const hp = a.hp + b.hp; QA.step(20, { render: false });
      const crash = { gap: Math.abs(b.x - a.x), dmg: hp - a.hp - b.hp };
      for (const c of mine) G.removeCar(c);
      QA.step(3, { render: false });
      return { out, crash, left: G.cars.length };
    });
    for (const o of r.out) log(`${o.label}: ${o.cars} cars, ${o.peds} peds, ${o.perCarPerFrame} grid candidates per car per frame, ${o.msPerFrame} ms/frame (sim only)`);
    const [b, , x8] = r.out;
    check(`population grew at least 4x (${b.cars} -> ${x8.cars})`, x8.cars >= b.cars * 4, r.out);
    check(`candidates per car stay flat (${b.perCarPerFrame} -> ${x8.perCarPerFrame}, brute force would be ~${Math.round(x8.cars / b.cars)}x)`, x8.perCarPerFrame <= b.perCarPerFrame * 1.5 + 2, r.out);
    check(`two cars driven into each other still collide (gap ${r.crash.gap.toFixed(2)} m, damage ${r.crash.dmg.toFixed(0)})`, r.crash.gap > 1.5 && r.crash.dmg > 0, r.crash);
    check('test cars cleaned up', r.left < 40, r.left);
  },
};
