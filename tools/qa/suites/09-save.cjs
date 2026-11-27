// Save -> reload restores position, clock, cash.
//
// Why the reload carries the save in by hand: in the headless test browser, a page's localStorage writes do not
// always reach Chromium's storage backend before a reload, and a reload can come up in a fresh renderer that reads
// the backend. Under load (several suites on one page, or two test runs at once) the reloaded page then saw an older
// snapshot of storage: either the jailbreak suite's save (cash 700) or no save at all (default clock 21.5, spawn).
// Instrumenting removeItem/clear showed nothing deletes the key; the write simply never left the old renderer.
// A fixed 5 s wait raced that and failed about 1 run in 3. So: check the game wrote the save, then reload with the
// exact saved JSON put back into localStorage before the game boots (?qa-restore=1), which tests the game's load path
// deterministically. Browser persistence itself is Chromium's job, not the game's.
module.exports = {
  name: 'save', desc: 'save, reload page, state restored',
  async run({ S, check }) {
    const saved = await S.js(async () => { const QA = window.QA, G = window.__G; await QA.tp('30,-40'); G.G.clock = 9.25; G.G.cash = 1234; G.save(); return { key: G.SAVE_KEY, json: localStorage.getItem(G.SAVE_KEY) }; });
    const sv = saved && saved.json ? JSON.parse(saved.json) : null;
    check('save written', sv && sv.x === 30 && sv.cash === 1234 && sv.clock === 9.25, sv);
    await S.page.addInitScript(({ k, v }) => { if (/[?&]qa-restore=1\b/.test(location.search)) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } }, { k: saved.key, v: saved.json });
    await S.page.goto('file://' + S.o.html + '?qa-restore=1'); await S.page.waitForFunction(() => window.QA && window.QA.ready(), null, { timeout: 120000 }); await S.js(() => window.QA.setManual(true));
    await S.start();
    const st = await S.state();
    check('reload restores position, cash and clock', Math.abs(st.x - 30) < 2.5 && Math.abs(st.z + 40) < 2.5 && st.cash === 1234 && Math.abs(st.clock - 9.25) < 0.2, st);
  },
};
