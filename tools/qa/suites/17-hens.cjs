// The Missing Hens (hens.js): the coop, the first theft starts the quest, 3 clues send you to the cave, the battle with
// John, the fish deal brings the hens home and pays. Full walkthrough with shots: tools/qa/scenarios/hens.cjs
module.exports = {
  name: 'hens', desc: 'coop, nightly theft, clues, battle with John, fish deal, bucket',
  async run({ S, check }) {
    const r = await S.js(async () => {
      const QA = window.QA, H = window.__HENS, C = window.__CAVE, G = window.__G, P = G.P, o = {};
      H.reset(); C.reset(); await QA.exit(); QA.time(10, { freeze: true });
      H.tp(); await QA.frames(6); for (let i = 0; i < 4 && G.G.dialog; i++) await QA.key('e');
      o.hidden = G.quests.list().find((q) => q.id === 'hens').status;
      H.night(); await QA.frames(4); for (let i = 0; i < 6 && G.G.dialog; i++) await QA.key('e');
      o.start = H.state();
      H.clue('nana'); H.clue('shadow'); H.clue('trail'); await QA.frames(3); for (let i = 0; i < 4 && G.G.dialog; i++) await QA.key('e');
      o.ready = H.state().stage;
      C.lair(); await QA.until(() => window.__INT.current() === 'cavelair' && !window.__INT.state.fading, 200);
      const L = window.__INT.room; P.x = L.origin.x + 1.6; P.z = L.origin.z + 1.6; await QA.frames(60);
      for (let i = 0; i < 12 && G.G.dialog; i++) await QA.key('e');
      o.battle = !!H.S.battle;
      await QA.key('e'); H.move('paw'); o.hit = H.S.battle && H.S.battle.j < 120;
      H.win(); await QA.key('e'); for (let i = 0; i < 8 && G.G.dialog; i++) await QA.key('e');
      o.choice = H.S.choice;
      const cash = G.G.cash; H.choose('deal'); for (let i = 0; i < 8 && G.G.dialog; i++) await QA.key('e');
      o.done = H.state(); o.paid = G.G.cash - cash;
      await QA.exit(); await QA.frames(3); o.inside = window.__INT.inside;
      H.reset(); C.reset();
      return o;
    });
    check('quest stays out of the log until a hen goes missing', r.hidden === 'hidden', r);
    check('first night: a hen is gone, the quest starts', r.start.stage === 'clues' && r.start.hens === 5, r.start);
    check('three clues send you to the cave', r.ready === 'cave', r);
    check('John picks a fight when you find him', r.battle && r.hit, r);
    check('winning the fight offers the deal', r.choice, r);
    check('fish deal: hens home, $150, Feather Wand', r.done.stage === 'deal' && r.done.hens === 6 && r.paid === 150 && r.done.wand, r);
    check('back outside afterwards', r.inside === false, r);
  },
};
