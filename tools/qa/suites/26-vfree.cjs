// World chunk vertex arrays are freed after upload (src/js/vfree.js); a lost WebGL context saves and reloads the page.
module.exports = {
  name: 'vfree', desc: 'world chunk vertex arrays are freed after upload; a lost graphics context saves and reloads',
  async run({ S, check, log }) {
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G, V = window.__VFREE;
      for (const p of ['green', 'quik', 'gary', 'dock']) { await QA.tp(p, { settle: 6, render: false }); QA.step(3, { render: true }); }
      let held = 0, drawn = 0;
      G.scene.traverse((o) => { if (o.userData.chunk === undefined || !o.geometry) return; const g = o.geometry; for (const k in g.attributes) if (g.attributes[k].array) held += g.attributes[k].array.byteLength; drawn++; });
      await QA.tp('30,-40'); G.G.cash = 4321; const mark = (window.__vfreeMark = Math.random());
      const before = { bytes: V.bytes, count: V.count };
      const ext = document.getElementById('c').getContext('webgl2').getExtension('WEBGL_lose_context');
      ext.loseContext(); await new Promise((q) => setTimeout(q, 200));
      const sv = JSON.parse(localStorage.getItem(G.SAVE_KEY) || 'null');
      setTimeout(() => ext.restoreContext(), 50);
      return { ...before, held, drawn, lost: V.lost, sv, mark, key: G.SAVE_KEY, json: localStorage.getItem(G.SAVE_KEY) };
    });
    log(`${(r.bytes / 1e6).toFixed(1)} MB freed in ${r.count} arrays; ${(r.held / 1e6).toFixed(1)} MB still held by chunks not drawn yet`);
    check('at least 30 MB of chunk vertex arrays freed after a tour of four places', r.bytes > 30e6, { bytes: r.bytes, count: r.count });
    check('losing the context saves the game', r.lost && r.sv && r.sv.cash === 4321 && Math.abs(r.sv.x - 30) < 2.5, r.sv);
    // the restore reloads the page: wait for a fresh document (the mark is gone), then for the game to come up again
    await S.page.addInitScript(({ k, v }) => { try { if (v && !localStorage.getItem(k)) localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, { k: r.key, v: r.json });
    let reloaded = true;
    try { await S.page.waitForFunction(() => window.__vfreeMark === undefined && window.QA && window.QA.ready(), null, { timeout: 120000 }); } catch (e) { reloaded = false; }
    check('restoring the context reloads the page', reloaded);
    if (reloaded) {
      await S.js(() => window.QA.setManual(true)); await S.start();
      const st = await S.state();
      check('after the reload the game continues from the save', Math.abs(st.x - 30) < 2.5 && Math.abs(st.z + 40) < 2.5 && st.cash === 4321, st);
    }
  },
};
