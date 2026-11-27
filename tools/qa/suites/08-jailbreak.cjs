// Jailbreak quest: start from a bust, cell block loads, end returns the player.
module.exports = {
  name: 'jailbreak', desc: 'start jailbreak, cell block active, end returns outside',
  async run({ S, check, shot }) {
    const r = await S.js(async () => { const QA = window.QA, J = window.__JAIL; J.start({ from: 'police', fine: 100 }); QA.step(60, { render: false }); for (let i = 0; i < 30 && window.__G.G.dialog; i++) await QA.key('e'); QA.step(10); return { active: J.active(), st: J.state() }; });
    check('jailbreak starts', r.active, r.st);
    await shot('cell', { hud: true });
    // diet 2026-11-27: "i can jump outside of the jail cell but not leave". A fast frame (sprint / triple jump at phone fps)
    // used to carry the cat past the middle of the 10 cm bars, and pushOut then popped him out the corridor side.
    const t = await S.js(async () => {
      const QA = window.QA, P = window.__G.P, J = window.__JAIL, [jx, jz] = J.origin();
      for (let i = 0; i < 40; i++) { if (window.__G.G.dialog) await QA.key('e'); else if (i > 25) break; else await new Promise((r) => setTimeout(r, 100)); }
      const out = [];
      for (const [x0, z0, dx, dz] of [[-0.7, -0.75, 0, 0.45], [-0.7, -0.75, 0, 0.9], [-2.2, -1.6, -0.55, 0], [-0.7, -3.2, 0, -0.7]]) {
        P.x = jx + x0; P.z = jz + z0; P.vx = P.vz = 0; QA.step(2, { render: false });
        P.x += dx; P.z += dz; QA.step(2, { render: false });
        out.push([+(P.x - jx).toFixed(2), +(P.z - jz).toFixed(2)]);
      }
      return { out, dialog: !!window.__G.G.dialog, st: J.state().stage };
    });
    check('cat cannot tunnel out of cell 2', !t.dialog && t.out.every(([x, z]) => z < -0.5 && z > -3.5 && x > -2.5 && x < 1.1), t);
    const e = await S.js(async () => { const QA = window.QA, J = window.__JAIL; J.end(); QA.step(30, { render: false }); for (let i = 0; i < 30 && window.__G.G.dialog; i++) await QA.key('e'); return { active: J.active(), st: QA.state() }; });
    check('jailbreak ends back in town', !e.active && !e.st.inside, e);
  },
};
