// Best in Show (catshow.js): the entries desk on the town green, the $50 fee, the rival cats loading, a full show
// through all four rounds, prize money, the trophy at the RV, one show a day.
module.exports = {
  name: 'catshow', desc: 'cat show: desk, fee, four rounds, prizes, trophy, one show a day',
  async run({ S, check, shot }) {
    const r = await S.js(async () => {
      const QA = window.QA, C = window.__CATSHOW, G = window.__G, o = {};
      C.reset(); await QA.exit(); QA.time(11, { freeze: true });
      C.tp(); await QA.frames(6);
      o.prompt = document.getElementById('prompt').textContent;
      o.quest = G.quests.list().find((q) => q.id === 'catshow');
      G.G.cash = 1000;
      await QA.key('e'); for (let i = 0; i < 6 && G.G.dialog; i++) await QA.key('e');
      o.started = !!C.S.show; o.fee = 1000 - G.G.cash;
      await new Promise((res) => setTimeout(res, 3000)); await QA.frames(4);
      o.figs = C.state().figs;
      C.skip(); await QA.frames(2);
      o.menu = C.cmds();
      o.picked = C.pick('lick'); C.skip(); o.afterLick = C.state().show;
      o.onStage = Math.hypot(G.P.x - C.STAGE[2].x, G.P.z - C.STAGE[2].z) < 0.5;
      C.auto(['strut', 'sprint', 'cup', 'honest']); await QA.frames(2);
      o.done = C.state(); o.paid = G.G.cash - 950;
      o.prize = [500, 200, 100][o.done.lastPlace - 1] || 0;
      o.figsGone = C.S.figs === null && !C.S.show;
      for (let i = 0; i < 4 && G.G.dialog; i++) await QA.key('e');
      C.tp(); await QA.frames(4); o.again = document.getElementById('prompt').textContent;
      // the win path: rivals rigged to 1s
      C.nextDay(); await QA.frames(2); o.nextDay = document.getElementById('prompt').textContent;
      C.rig(true); const cash = G.G.cash; C.start(); C.auto(['lick', 'careful', 'fix', 'honest']); C.rig(false);
      for (let i = 0; i < 4 && G.G.dialog; i++) await QA.key('e');
      o.win = C.state(); o.winPaid = G.G.cash - cash; o.trophy = !!C.trophy();
      o.questDone = G.quests.list().find((q) => q.id === 'catshow').status;
      QA.time(20, { freeze: true }); C.nextDay(); C.tp(); await QA.frames(4); o.closed = document.getElementById('prompt').textContent;
      C.reset(); QA.time(12, { freeze: true });
      return o;
    });
    check('entries desk prompt in show hours', /Enter the cat show/.test(r.prompt), r.prompt);
    check('quest listed as available', r.quest && r.quest.status === 'open', r.quest);
    check('entering costs $50 and starts the show', r.started && r.fee === 50, r);
    check('four rival cats load on the stage', r.figs === 4, r.figs);
    check('grooming menu, a move scores and goes to move 2', r.menu.includes('outfit') && r.picked && r.afterLick && r.afterLick.turn === 1, r);
    check('Goobles stands on the stage', r.onStage, r);
    check('a full show ends with a place and the right prize', r.done.lastPlace >= 1 && r.done.lastPlace <= 5 && r.paid === r.prize && !r.done.show, r.done);
    check('rival cats are disposed after the show', r.figsGone, r);
    check('one show a day', /results/.test(r.again) && /Enter the cat show/.test(r.nextDay), [r.again, r.nextDay]);
    check('Best in Show pays $500 and puts the trophy at the RV', r.win.lastPlace === 1 && r.winPaid === 500 && r.trophy && r.win.wins >= 1, r.win);
    check('quest done after a win', r.questDone === 'done', r.questDone);
    check('desk closed at night', /entries sign/.test(r.closed), r.closed);
  },
};
