// Cat climbing (climb.js) and walkable roofs (rooftops.js): up a tree onto its perch, up a wall onto a two-story roof.
module.exports = {
  name: 'climb', desc: 'climb a tree to its perch, scramble + pull up onto an Estates roof, roofs follow the real surface',
  async run({ S, check, shot }) {
    // tree: walk into the trunk and hold up
    const t = await S.js(async () => {
      const QA = window.QA, G = window.__G, P = G.P;
      await QA.tp('spawn');
      const c = G.colliders.filter((c) => c.tree && c.top && c.r > 0.35).map((c) => [Math.hypot(c.cx - P.x, c.cz - P.z), c]).sort((a, b) => a[0] - b[0])[0][1];
      P.x = c.cx + 2; P.z = c.cz; P.y = 0; P.vy = 0; G.setCam(Math.PI / 2, 0.3);
      QA.down('w'); let grabbed = false, mid = 0;
      for (let i = 0; i < 120 && !P.perch; i++) { await QA.frames(1, { render: false }); grabbed ||= !!P.climb; if (P.climb) mid = P.y; }
      await QA.frames(20, { render: false });   // still holding up: stays on the perch
      const held = { y: P.y, d: Math.hypot(P.x - c.cx, P.z - c.cz) };
      QA.up('w'); await QA.frames(4, { render: false });
      return { grabbed, mid, top: c.top, held, y: P.y };
    });
    check('walking into a tree grabs the trunk', t.grabbed, t);
    check('climbing up reaches the treetop perch and stays there while up is held', Math.abs(t.held.y - t.top) < 0.05 && t.held.d < 1, t);
    await S.js(() => { window.__camDist = 6; window.__G.setCam(0.9, 0.25); window.QA.step(12); });
    await shot('tree-perch', { hud: false });
    const j = await S.js(async () => { const QA = window.QA, P = window.__G.P; QA.down('w'); await QA.key(' ', 1); QA.step(4, { render: false }); QA.up('w'); let peak = P.y; for (let i = 0; i < 80; i++) { QA.step(1, { render: false }); peak = Math.max(peak, P.y); } QA.step(6, { render: false }); return { peak, y: P.y, nan: !isFinite(P.x + P.y + P.z), quad: !!window.__G.cat.userData.quad }; });
check('back on the ground he stands upright again', !j.quad, j);
        check('leaping off the perch lands back on the ground', j.y < 1 && !j.nan, j);   // (holding on into another trunk would grab it: tree to tree)

    // roof: run at a two-story Estates house wall, jump + two wall scrambles + double + triple, pull up onto the eave
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G, P = G.P;
      window.__camDist = 0;
      await QA.tp('gary');
      const c = G.colliders.filter((c) => c.bld && c.rg && c.x0 !== undefined).map((c) => [Math.hypot((c.x0 + c.x1) / 2 - P.x, (c.z0 + c.z1) / 2 - P.z), c]).sort((a, b) => a[0] - b[0])[0][1];
      P.x = c.x1 + 1.2; P.z = (c.z0 + c.z1) / 2; P.y = 0; P.vy = 0; G.setCam(Math.PI / 2, 0.3);
      const eave = G.floorAt(c.x1 - 0.3, P.z, 50);
      QA.down('w'); await QA.frames(6, { render: false });
      for (let k = 0; k < 5 && !P.mantle; k++) { await QA.key(' ', 1, { render: false }); await QA.frames(5, { render: false }); }
      const pulled = !!P.mantle || P.y > 5;
      await QA.frames(20, { render: false }); QA.up('w'); await QA.frames(6, { render: false });
      const on = { y: P.y, fl: P.fl, inside: P.x < c.x1, quad: !!G.cat.userData.quad };
      return { box: c.h, eave, pulled, on };
    });
    check('Estates eave is below the collider box (roof grid built)', r.eave > 4 && r.eave < r.box - 0.5, r);
    check('wall scrambles + pull-up land Goobles on the roof', r.pulled && r.on.inside && r.on.y > r.eave - 0.3 && Math.abs(r.on.y - r.on.fl) < 0.05, r);
    check('on the roof he is on all fours', r.on.quad, r.on);
    await S.js(() => { window.__camDist = 7; window.__G.setCam(2.2, 0.35); window.QA.step(12); });
    await shot('estates-roof', { hud: false });
    await S.js(() => { window.__camDist = 0; });
  },
};
