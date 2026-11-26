// Quest log: tracking switches the HUD objective + waypoint between quests, missions auto-track and hand back.
module.exports = {
  name: 'quests', desc: 'quest log opens, tracking drives the objective line and waypoint, missions auto-track',
  async run({ S, check, shot }) {
    const r = await S.js(async () => {
      const QA = window.QA, { G, P, quests, fishing, talkTo, jobs } = window.__G, o = {};
      const obj = () => document.getElementById('objective').textContent;
      await QA.tp('rv', { settle: 2, render: false }); P.lock = 0;
      fishing.S.quest = 'buy'; quests.track('catch'); QA.step(2);
      o.catchObj = obj(); o.catchCheck = quests.check() && quests.check().label;
      quests.track('nana'); QA.step(2);
      o.nanaObj = obj(); o.nanaCheck = quests.check() && quests.check().label; o.rawStill = G.objRaw;
      quests.open(); QA.step(1); o.openPaused = G.paused && quests.isOpen; o.rows = document.querySelectorAll('#questlog .q').length;
      quests.close(); QA.step(1); o.closed = !quests.isOpen && !G.paused;
      jobs.start('nana'); QA.step(3);
      o.missionTracked = quests.S.track; o.missionObj = obj();
      quests.track('catch'); QA.step(2); o.catchDuring = obj(); o.catchDuringCheck = quests.check() && quests.check().label;
      window.__G.mission && (window.__G.mission.cleanup?.(), 0);
      return o;
    });
    check('catch tracked: fishing step on HUD', /Buy a fishing rod/.test(r.catchObj) && r.catchCheck === 'Bait & Tackle', r);
    check('nana tracked: talk to Nana + waypoint', /Talk to Nana/.test(r.nanaObj) && r.nanaCheck === 'Nana', r);
    check('fishing raw objective kept underneath', /Buy a fishing rod/.test(r.rawStill), r);
    check('log opens paused with rows and closes', r.openPaused && r.rows >= 6 && r.closed, r);
    check('starting a mission tracks it', r.missionTracked === 'nana' && /wagon|casserole/i.test(r.missionObj), r);
    check('switch to fishing mid-mission', /Buy a fishing rod/.test(r.catchDuring) && /still running/i.test(r.catchDuring) && r.catchDuringCheck === 'Bait & Tackle', r);
  },
};
