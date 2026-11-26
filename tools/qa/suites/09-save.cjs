// Save -> reload restores position, clock, cash.
module.exports = {
  name: 'save', desc: 'save, reload page, state restored',
  async run({ S, check }) {
    const saved = await S.js(async () => { const QA = window.QA, G = window.__G; await QA.tp('30,-40'); G.G.clock = 9.25; G.G.cash = 1234; G.save(); return JSON.parse(localStorage.getItem(G.SAVE_KEY)); });
    await S.page.waitForTimeout(5000); // Chromium commits localStorage lazily (rate-limited after many writes); a reload right away can drop the write
    check('save written', saved && saved.x === 30 && saved.cash === 1234, saved);
    await S.page.reload(); await S.page.waitForFunction(() => window.QA && window.QA.ready(), null, { timeout: 120000 }); await S.js(() => window.QA.setManual(true));
    await S.start();
    const st = await S.state();
    check('reload restores position, cash and clock', Math.abs(st.x - 30) < 2.5 && Math.abs(st.z + 40) < 2.5 && st.cash === 1234 && Math.abs(st.clock - 9.25) < 0.2, st);
  },
};
