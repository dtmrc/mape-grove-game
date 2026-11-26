// Day/night: the time menu sets the clock, freeze holds it, night lights come on.
module.exports = {
  name: 'time', desc: 'set time, freeze, day vs night lighting differs',
  async run({ S, check, shot }) {
    await S.tp('green');
    const day = await S.js(async () => { const QA = window.QA; QA.time(12, { freeze: true }); QA.step(40); return { clock: window.__G.G.clock, s: QA.stats() }; });
    check('noon set', Math.abs(day.clock - 12) < 0.05, day.clock);
    await shot('noon', { hud: false });
    const night = await S.js(async () => { const QA = window.QA; QA.time(23, { freeze: true }); QA.step(40); return { clock: window.__G.G.clock, s: QA.stats() }; });
    check('frozen clock stays at 23:00 for 2 s', Math.abs(night.clock - 23) < 0.05, night.clock);
    await shot('night', { hud: false });
    const lum = await S.page.evaluate(() => { const c = document.querySelector('canvas'); const g = document.createElement('canvas'); g.width = 32; g.height = 18; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 32, 18); const d = x.getImageData(0, 0, 32, 18).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; });
    check('night frame is dark', lum < 110, lum);
    const unfreeze = await S.js(async () => { const QA = window.QA; QA.time(8, { freeze: false }); QA.step(400, { render: false }); return window.__G.G.clock; });
    check('clock runs when unfrozen', unfreeze > 8.1, unfreeze);
  },
};
