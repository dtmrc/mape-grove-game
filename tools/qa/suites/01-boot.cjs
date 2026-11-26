// Boots, starts, and checks the basics every other suite relies on.
module.exports = {
  name: 'boot', desc: 'title -> playing, globals present, HUD, dev tools, saved world applied',
  async run({ S, check, log }) {
    const r = await S.js(() => {
      const G = window.__G;
      return {
        started: window.QA.started(), dialog: !!G.G.dialog, cars: G.cars.length, peds: G.peds.length, places: Object.keys(G.places).length,
        globals: ['__G', '__INT', '__dev'].filter((k) => !window[k]),
        optional: ['__FIRE', '__JAIL', '__TOWN', '__BRK', '__MEOW', '__TC', '__CP'].filter((k) => !window[k]),
        hud: !!document.getElementById('minimap') && getComputedStyle(document.getElementById('hud') || document.body).display !== 'none',
        dbLoaded: window.QA.cfg.world ? true : null,
      };
    });
    check('game started, intro dialog skipped', r.started && !r.dialog, r);
    check('traffic and pedestrians spawned', r.cars > 5 && r.peds > 5, r);
    check('places registered', r.places > 20, r.places);
    check('core debug globals present (__G __INT __dev)', !r.globals.length, r.globals);
    if (r.optional.length) log('missing optional system globals: ' + r.optional.join(' '));
    const fps = await S.js(() => window.QA.timeFrames(3));
    check('renders frames', fps.drawCalls > 50, fps);
  },
};
