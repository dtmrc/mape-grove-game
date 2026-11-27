// Wearable clothes (wardrobe.js): Bev's Threads garments are worn when bought, toggle at the till / BAG / RV wardrobe,
// raccoon-skin pieces need pelts (skinning), everything is one extra draw call, and it all survives a reload.
module.exports = {
  name: 'wardrobe', desc: "Bev's clothes are worn, toggled, crafted from pelts, one mesh, saved across reloads",
  async run({ S, check, shot }) {
    const a = await S.js(async () => {
      const QA = window.QA, W = window.__G, WD = W.wardrobe, o = {};
      localStorage.removeItem('mg.wardrobe'); for (const k in WD.S.owned) delete WD.S.owned[k]; for (const k in WD.S.worn) delete WD.S.worn[k];
      await QA.tp('room:clothing', { settle: 1, render: false });
      W.G.cash = 100; o.cash0 = W.G.cash;
      o.boughtCap = W.stores.buy('bev', 'cap'); o.boughtSweater = W.stores.buy('bev', 'sweater');
      QA.step(2, { render: false });
      o.cash1 = W.G.cash; o.wearing = ['cap', 'sweater'].filter(WD.wearing);
      o.tris = WD.tris(); const m = WD.mesh(); o.skinned = !!(m && m.isSkinnedMesh && m.skeleton === W.cat.userData.model.getObjectByProperty('isSkinnedMesh', true).skeleton);
      // picking an owned garment at the till takes it off, for free
      W.stores.buy('bev', 'cap'); QA.step(2, { render: false }); o.capOff = !WD.wearing('cap') && W.G.cash === o.cash1; o.trisNoCap = WD.tris();
      W.stores.buy('bev', 'cap'); QA.step(2, { render: false }); o.capOn = WD.wearing('cap');
      // BAG rows: wear/take off, and stitching needs pelts
      W.fishing.S.pelts = 0; o.rows0 = WD.rows().map((r) => r.id);
      W.fishing.S.pelts = 3; o.rows3 = WD.rows().filter((r) => !r.dim).map((r) => r.id);
      WD.rows().find((r) => r.id === 'craft:coonjacket').ext(); QA.step(2, { render: false });
      o.jacket = WD.wearing('coonjacket') && W.fishing.S.pelts === 0;
      // coonskin cap and ball cap swap
      W.fishing.S.hat = true; W.fishing.S.wearHat = true; QA.step(2, { render: false }); o.coonSwap = !WD.wearing('cap');
      WD.setWorn('cap', true); QA.step(2, { render: false }); o.capSwap = WD.wearing('cap') && !W.fishing.S.wearHat;
      // RV bedroom wardrobe spot + the BAG list the clothes
      await QA.tp('room:rv', { settle: 1, render: false });
      const R = window.__INT.state.room; o.rvSpot = !!(R && R.spots.includes('wardrobe'));
      W.P.x = R.origin.x + 2.8; W.P.z = R.origin.z + 0.6; W.P.lock = 0; QA.step(1, { render: false });
      QA.key('e'); QA.step(2, { render: false });
      o.rvMenu = W.fishing.S.bagOpen === 'custom' && /Wardrobe/.test(document.getElementById('fishui').textContent);
      W.fishing.close(); QA.step(8, { render: false });
      W.P.lock = 0; QA.key('i'); QA.step(1, { render: false });
      o.bagRows = document.getElementById('fishui').textContent; W.fishing.close();
      o.saved = localStorage.getItem('mg.wardrobe');
      return o;
    });
    check('buying worn straight away', a.boughtCap && a.boughtSweater && a.wearing.length === 2 && a.cash1 === a.cash0 - 30, a);
    check('one skinned mesh on his skeleton', a.skinned && a.tris > 50, a);
    check('owned item at the till toggles for free', a.capOff && a.capOn && a.trisNoCap < a.tris, a);
    check('no stitching without a pelt', !a.rows0.some((r) => r.startsWith('craft:')), a.rows0);
    check('3 pelts stitch the jacket, worn', a.rows3.includes('craft:coonjacket') && a.jacket, a);
    check('RV wardrobe opens', a.rvSpot && a.rvMenu, { spot: a.rvSpot, menu: a.rvMenu });
    check('BAG lists the clothes', /Take off ugly holiday sweater/.test(a.bagRows || ''), a.bagRows);
    check('one hat at a time', a.coonSwap && a.capSwap, a);
    await shot('wardrobe-worn');
    // draw calls: clothes add exactly one
    const d = await S.js(async () => {
      const QA = window.QA, WD = window.__G.wardrobe; const worn = { ...WD.S.worn };
      for (const k in WD.S.worn) WD.S.worn[k] = false; QA.step(1, { render: true }); const off = QA.stats().drawCalls;
      Object.assign(WD.S.worn, worn); WD.setWorn('socks', false); QA.step(1, { render: true }); const on = QA.stats().drawCalls;
      return { off, on };
    });
    check('clothes cost one draw call', d.on - d.off === 1, d);
    // reload keeps them
    const saved = await S.js(() => localStorage.getItem('mg.wardrobe'));
    await S.page.addInitScript((v) => { if (/[?&]qa-ward=1\b/.test(location.search)) try { localStorage.setItem('mg.wardrobe', v); } catch (e) { /* ignore */ } }, saved);
    await S.page.goto('file://' + S.o.html + '?qa-ward=1&n=' + Math.random()); await S.page.waitForFunction(() => window.QA && window.QA.ready(), null, { timeout: 120000 }); await S.js(() => window.QA.setManual(true));
    await S.start();
    const b = await S.js(() => { window.QA.step(4, { render: false }); const WD = window.__G.wardrobe; return { cap: WD.wearing('cap'), sweater: WD.wearing('sweater'), jacket: WD.wearing('coonjacket'), tris: WD.tris() }; });
    check('outfit survives a reload', b.cap && b.sweater && b.jacket && b.tris > 50, b);
  },
};
