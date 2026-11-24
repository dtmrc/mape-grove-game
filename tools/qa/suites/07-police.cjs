// Wanted levels: HOA carts at 1 star, PD cruisers at 3, clearing heat cleans up.
module.exports = {
  name: 'police', desc: 'heat 1 -> HOA cart, heat 3 -> cruisers, clear heat',
  async run({ S, check }) {
    await S.tp('green');
    const r1 = await S.js(async () => { const QA = window.QA, G = window.__G; G.G.heat = 0; G.police.clear(); G.addHeat(1, 'qa'); let p = 0; for (let i = 0; i < 12; i++) { QA.step(15, { render: false }); p = Math.max(p, G.patrols().length); } return { patrols: p, heat: G.G.heat }; });
    check('1 star sends an HOA cart', r1.patrols >= 1, r1);
    const r3 = await S.js(async () => { const QA = window.QA, G = window.__G; G.G.heat = 0; G.G.seenT = 0; G.addHeat(3, 'qa'); let c = 0; for (let i = 0; i < 20; i++) { QA.step(15, { render: false }); c = Math.max(c, G.police.cruisers().length); } return { cruisers: c, heat: G.G.heat }; });
    check('3 stars brings PD cruisers', r3.cruisers >= 1, r3);
    const rc = await S.js(async () => { const QA = window.QA, G = window.__G; G.G.heat = 0; G.G.seenT = 0; G.police.clear(); QA.step(20, { render: false }); return { cruisers: G.police.cruisers().length, heat: G.G.heat }; });
    check('clearing heat removes cruisers', rc.cruisers === 0 && rc.heat === 0, rc);
  },
};
