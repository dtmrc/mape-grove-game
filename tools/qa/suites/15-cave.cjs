// The Hollow Deep easter egg (cave.js): torch at the mouth, tunnel, rope to the ghost's dwelling, ghost reveal, back out.
// Full walkthrough with screenshots: tools/qa/scenarios/cave.cjs
module.exports = {
  name: 'cave', desc: 'take the torch, tunnel, rope descent, ghost appears, exit returns the torch',
  async run({ S, check }) {
    const r = await S.js(async () => {
      const QA = window.QA, C = window.__CAVE, G = window.__G, P = G.P, s = C.spot, o = {};
      C.reset(); await QA.exit(); C.tp(); await QA.frames(4);
      o.closedWithoutTorch = window.__INT.state.entries.find((e) => e.id === 'cave').ok === false;
      P.x = s.x + Math.sin(s.yaw) * 1.4 + Math.cos(s.yaw) * 1.9; P.z = s.z + Math.cos(s.yaw) * 1.4 - Math.sin(s.yaw) * 1.9; await QA.frames(3);
      await QA.key('e'); await QA.frames(3); o.held = C.S.held;
      P.x = s.x + Math.sin(s.yaw) * 0.9; P.z = s.z + Math.cos(s.yaw) * 0.9; await QA.frames(3); await QA.key('e'); await QA.until(() => window.__INT.inside && !window.__INT.state.fading, 200); await QA.frames(5);
      o.tunnel = window.__INT.current();
      const R = window.__INT.room, T = C.tun, e = T.pts[T.pts.length - 1];
      P.x = R.origin.x + e.x - e.tx * 4.1; P.z = R.origin.z + e.z - e.tz * 4.1; await QA.frames(5);
      await QA.key('e'); await QA.until(() => window.__INT.current() === 'cavelair', 300); await QA.frames(10);
      o.lair = window.__INT.current(); o.depth = Math.round(C.S.depth);
      const L = window.__INT.room; P.x = L.origin.x + 1.6; P.z = L.origin.z + 1.6; await QA.frames(60);
      for (let i = 0; i < 12 && G.G.dialog; i++) await QA.key('e');
      o.ghost = C.S.gh.state;
      await QA.exit(); await QA.frames(5); o.outside = !window.__INT.inside; o.torchBack = !C.S.held;
      return o;
    });
    check('cave door hidden until you hold the torch', r.closedWithoutTorch, r);
    check('torch taken from the post', r.held, r);
    check('torch opens the cave', r.tunnel === 'cave', r);
    check('rope leads 1,940 m down to the dwelling', r.lair === 'cavelair' && r.depth === 1940, r);
    check('the ghost shows himself', r.ghost === 'haunt', r);
    check('leaving puts the torch back', r.outside && r.torchBack, r);
  },
};
