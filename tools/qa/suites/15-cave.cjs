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
      // the branching cave (cavegen.js): every passage open, rock pushes back, far tiles hidden
      const g = C.cavegen; o.gen = { branches: g.branches.length, tiles: g.stats.tiles, pools: g.stats.pools, buildMs: g.stats.ms };
      o.open = [g.main, ...g.branches].every((b) => b.pts.every((p) => g.field(p.x, p.z) < -0.4));
      P.x = R.origin.x + 3.5; P.z = R.origin.z + 52; await QA.frames(4); o.pushedOut = g.field(P.x - R.origin.x, P.z - R.origin.z) < -0.2;
      o.culled = g.stats.visibleTiles > 0 && g.stats.visibleTiles < g.stats.tiles;
      P.x = R.origin.x + e.x - e.tx * 4.1; P.z = R.origin.z + e.z - e.tz * 4.1; await QA.frames(5);
      await QA.key('e'); await QA.until(() => window.__INT.current() === 'cavelair', 300); await QA.frames(10);
      o.lair = window.__INT.current(); o.depth = Math.round(C.S.depth);
      const L = window.__INT.room; P.x = L.origin.x + 1.6; P.z = L.origin.z + 1.6; await QA.frames(60);
      for (let i = 0; i < 12 && G.G.dialog; i++) await QA.key('e');
      o.ghost = C.S.gh.state;
      // the six poems: each has its own spot the cat can stand on, E reads it, the glint over it goes out
      o.poems = [];
      for (const id of ['poem1', 'poem2', 'poem3', 'poem4', 'poem5', 'poem6']) {
        const h = L.spots.find((q) => q.id === id); P.x = L.origin.x + h.x; P.z = L.origin.z + h.z; await QA.frames(3);
        const stood = Math.hypot(P.x - L.origin.x - h.x, P.z - L.origin.z - h.z) < 0.3, near = L.spots.filter((q) => Math.hypot(q.x - h.x, q.z - h.z) < q.r).map((q) => q.id);
        await QA.key('e'); await QA.frames(2); const opened = !!G.G.dialog; for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e');
        o.poems.push({ id, stood, opened, read: !!C.SV.read[id], only: near.length === 1 });
      }
      o.poet = !!C.SV.poet;
      // the periscope is a real view: the cat is up at the RV end, hidden, the camera at the lens; E comes back to the same spot
      { const h = L.spots.find((q) => q.id === 'periscope'), fov0 = G.camera.fov, gh = C.S.gh.state; P.x = L.origin.x + h.x; P.z = L.origin.z + h.z; await QA.frames(3);
        await QA.key('e'); await QA.frames(14);
        const sp = C.scope.spot(), cam = G.camera.position;
        o.scope = { phase: C.scope.S.phase, outdoors: !window.__INT.inside, atLens: Math.hypot(cam.x - sp.x, cam.z - sp.z) < 1, nearRv: Math.hypot(sp.x - G.places.rv.x, sp.z - G.places.rv.z) < 20, zoomed: G.camera.fov < fov0, hidden: !G.cat.visible, torch: C.S.held, dialog: !!G.G.dialog };
        await QA.key('e'); await QA.frames(14);
        o.scopeBack = { phase: C.scope.S.phase, room: window.__INT.current(), fov: G.camera.fov === fov0, camFree: !window.__camO, shown: G.cat.visible, torch: C.S.held, same: Math.hypot(P.x - L.origin.x - h.x, P.z - L.origin.z - h.z) < 0.6, ghost: C.S.gh.state === gh }; }
      await QA.exit(); await QA.frames(5); o.outside = !window.__INT.inside; o.torchBack = !C.S.held;
      return o;
    });
    check('cave door hidden until you hold the torch', r.closedWithoutTorch, r);
    check('torch taken from the post', r.held, r);
    check('torch opens the cave', r.tunnel === 'cave', r);
    check('cave branches: loops and dead ends, all open', r.gen && r.gen.branches >= 5 && r.open, r);
    check('cave walls push the cat back out of the rock', r.pushedOut, r);
    check('far cave tiles are hidden', r.culled, r);
    check('rope leads 1,940 m down to the dwelling', r.lair === 'cavelair' && r.depth === 1940, r);
    check('the ghost shows himself', r.ghost === 'haunt', r);
    check('all six poems can be reached and read, each at its own spot', r.poems.length === 6 && r.poems.every((p) => p.stood && p.opened && p.read && p.only) && r.poet, r.poems);
    check('periscope is a live view from the RV end, not a dialogue', r.scope.phase === 'view' && r.scope.outdoors && r.scope.atLens && r.scope.nearRv && r.scope.zoomed && r.scope.hidden && r.scope.torch && !r.scope.dialog, r.scope);
    check('leaving the periscope puts the cat back in the dwelling', r.scopeBack.phase === 'off' && r.scopeBack.room === 'cavelair' && r.scopeBack.fov && r.scopeBack.camFree && r.scopeBack.shown && r.scopeBack.torch && r.scopeBack.same && r.scopeBack.ghost, r.scopeBack);
    check('leaving puts the torch back', r.outside && r.torchBack, r);
  },
};
