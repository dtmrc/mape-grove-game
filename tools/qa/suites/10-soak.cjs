// 60 s of traffic + peds + wandering player with rendering off: catches NaN cars, runaway objects, frame exceptions.
module.exports = {
  name: 'soak', desc: '60 game-seconds of traffic and wandering with no NaNs or leaks',
  async run({ S, check }) {
    const before = await S.stats();
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G, issues = new Set();
      for (let i = 0; i < 12; i++) {
        if (i % 4 === 0) { const pl = Object.keys(QA.places()); await QA.tp(pl[(i * 7) % pl.length], { settle: 2, render: false }); }
        QA.down('w'); QA.down(i % 2 ? 'a' : 'd'); QA.step(100, { render: false }); QA.up('w'); QA.up('a'); QA.up('d');
        QA.sanity().forEach((s) => issues.add(s));
      }
      return { issues: [...issues], cars: G.cars.length, peds: G.peds.length };
    });
    const after = await S.stats();
    check('no sanity issues over 60 s', !r.issues.length, r.issues);
    check('scene does not balloon', after.objs < before.objs * 1.5 + 200, { before: before.objs, after: after.objs });
  },
};
