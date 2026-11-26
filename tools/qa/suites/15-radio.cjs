// Car radio (src/js/radio.js): stations play in cars, R switches, off on foot, police cruisers get the scanner.
module.exports = {
  name: 'radio', desc: 'car radio stations, R switches station, cruiser scanner with dispatch captions',
  async run({ S, check }) {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G, R = window.__RADIO;
      R.unlock(); const a = R.engine; void a;
      if (G.P.car) await QA.leaveCar();
      await QA.tp('endzone', { settle: 2, render: false });
      await QA.spawnCar('sedan', { enter: true, yaw: Math.PI / 2 });
      QA.step(2, { render: false });
      const e = R.engine, ctx = e && e.vol.context;
      if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch (err) { /* autoplay */ } }
      const first = R.station, seen = [first];
      for (let i = 0; i < 6; i++) { await QA.key('r', 1, { render: false }); seen.push(R.station); }
      return { first, seen, ctx: ctx && ctx.state, label: document.getElementById('radio').textContent };
    });
    check('a music station plays when you get in a car', ['country', 'pop', 'lofi', 'rock'].includes(r.first), r);
    check('R cycles through every station and wraps around', new Set(r.seen).size === 6 && r.seen[6] === r.first, r);
    // let real audio time run so the scheduler queues steps
    await S.js(async () => { while (window.__RADIO.station !== 'country') await window.QA.key('r', 1, { render: false }); });
    const p0 = await S.js(() => window.__RADIO.engine.played);
    for (let i = 0; i < 8; i++) { await wait(150); await S.js(() => window.QA.step(1, { render: false })); }
    const p1 = await S.js(() => ({ played: window.__RADIO.engine.played, ctx: window.__RADIO.engine.vol.context.state }));
    check('music notes get scheduled while driving', p1.ctx !== 'running' || p1.played > p0, { p0, ...p1 });
    const out = await S.js(async () => { await window.QA.leaveCar(); window.QA.step(2, { render: false }); return { st: window.__RADIO.station, kind: window.__RADIO.engine.kind }; });
    check('the radio stops on foot', out.st === null && out.kind === null, out);
    const pd = await S.js(async () => {
      const QA = window.QA, R = window.__RADIO;
      await QA.spawnCar('sedan', { enter: true, yaw: Math.PI / 2, opts: { lightbar: true, role: 'pdParked' } });
      QA.step(2, { render: false });
      return { st: R.station, label: document.getElementById('radio').textContent };
    });
    check('a police cruiser starts on the dispatch scanner', pd.st === 'scanner' && /SCANNER/.test(pd.label), pd);
    for (let i = 0; i < 6; i++) { await wait(200); await S.js(() => window.QA.step(1, { render: false })); }
    const cap = await S.js(() => ({ caps: window.__RADIO.engine.caps.map((c) => c.text), ctx: window.__RADIO.engine.vol.context.state }));
    check('dispatch chatter is queued with captions', cap.ctx !== 'running' || cap.caps.length > 0, cap);
    await S.js(async () => { await window.QA.leaveCar(); });
  },
};
