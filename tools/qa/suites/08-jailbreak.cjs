// Jailbreak quest: start from a bust, cell block loads, end returns the player.
module.exports = {
  name: 'jailbreak', desc: 'start jailbreak, cell block active, end returns outside',
  async run({ S, check, shot }) {
    const r = await S.js(async () => { const QA = window.QA, J = window.__JAIL; J.start({ from: 'police', fine: 100 }); QA.step(60, { render: false }); for (let i = 0; i < 30 && window.__G.G.dialog; i++) await QA.key('e'); QA.step(10); return { active: J.active(), st: J.state() }; });
    check('jailbreak starts', r.active, r.st);
    await shot('cell', { hud: true });
    const e = await S.js(async () => { const QA = window.QA, J = window.__JAIL; J.end(); QA.step(30, { render: false }); for (let i = 0; i < 30 && window.__G.G.dialog; i++) await QA.key('e'); return { active: J.active(), st: QA.state() }; });
    check('jailbreak ends back in town', !e.active && !e.st.inside, e);
  },
};
