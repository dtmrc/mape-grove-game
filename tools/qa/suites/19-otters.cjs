// Otters (src/js/otters.js): ambient otters on every water body. They spawn at the lake, move, stay by the water and bolt from Goobles.
module.exports = {
  name: 'otters', desc: 'otters spawn at the lake, move around, stay by the water, bolt when scared',
  async run({ S, check }) {
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G, O = window.__OTTERS;
      await QA.tp('dock', { settle: 3, render: false });
      const info = { n: O.count, bodies: O.bodies.length, dens: O.bodies.map((b) => b.dens.length) };
      const p0 = O.list.map((o) => [o.x, o.z]);
      QA.step(160, { render: false });
      const moved = O.list.filter((o, i) => Math.hypot(o.x - p0[i][0], o.z - p0[i][1]) > 0.3).length;
      const ring = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [4, 0], [-4, 0], [0, 4], [0, -4]];
      const wet = O.list.filter((o) => ring.some(([a, b]) => G.waterAt(o.x + a, o.z + b))).length;
      const bad = O.list.filter((o) => !isFinite(o.x) || !isFinite(o.z) || !isFinite(o.y)).length;
      return { ...info, moved, wet, bad };
    });
    check('otters spawn on the lake with dens on the bank', r.n >= 5 && r.dens[0] >= 2, r);
    check('otters move around', r.moved >= 3, r);
    check('every otter is in or beside the water', r.wet === r.n && r.bad === 0, r);
    const s = await S.js(async () => {
      const QA = window.QA, O = window.__OTTERS;
      const st0 = O.list.map((o) => o.state || o.st || o.mode);
      O.scare(); QA.step(20, { render: false });
      const st1 = O.list.map((o) => o.state || o.st || o.mode);
      return { st0, st1, changed: st1.filter((v, i) => v !== st0[i]).length };
    });
    check('scared otters react', s.changed >= 1, s);
  },
};
