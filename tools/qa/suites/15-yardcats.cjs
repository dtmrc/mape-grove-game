// Yard cats: lady cats stand in Estates front yards, E opens the flirt menu, picks roll random outcomes (incl. disgust),
// 100% unlocks the proposal, a yes moves her to the RV, and the courtship quest shows up in the quest log.
module.exports = {
  name: 'yardcats', desc: 'yard cats placed + modelled, flirt menu, random outcomes, proposal, wife at the RV, quest',
  async run({ S, check, shot }) {
    const r = await S.js(async () => {
      const QA = window.QA, { G, P, yardcats: Y, fishing, quests, places } = window.__G, o = {};
      Y.reset();
      await QA.until(() => Y.cats.length && Y.cats.every((c) => c.ready), 400);
      o.n = Y.cats.length; o.ready = Y.cats.filter((c) => c.ready).length; o.merged = !!(Y.template && Y.template.merged);
      o.inYards = Y.cats.every((c) => places.yards.some((y) => Math.hypot(y.x - c.x, y.z - c.z) < 25));
      o.questOpen = (quests.list().find((q) => q.id === 'romance') || {}).status;
      // walk up to Mittens and press E
      const c = Y.cats.find((k) => k.def.id === 'mittens');
      await QA.tp({ x: c.x, z: c.z + 1.2, yaw: Math.PI }, { settle: 4 }); P.lock = 0;
      o.prompt = Y.prompt();
      await QA.key('e');
      o.menu = fishing.menuOpen(); o.rows = document.querySelectorAll('#fishui .row, .row').length;
      await QA.key('e'); QA.step(1);                        // pick the first line
      o.dialog = !!G.dialog; o.who = G.dialog && G.dialog.lines.map((l) => l[0]).join('|');
      for (let i = 0; i < 4 && G.dialog; i++) { await QA.key('e'); }
      o.met = !!Y.S.met.mittens; o.questActive = (quests.list().find((q) => q.id === 'romance') || {}).status;
      // the dice: every outcome is reachable, disgust is the most common for a style she hates
      const outs = {}; for (let i = 0; i < 400; i++) { const k = Y.outcome('mittens', 'pun'); outs[k] = (outs[k] || 0) + 1; }
      o.hated = outs;
      o.loved = Y.outcome('mittens', 'compliment', 0.01);
      // smitten -> ask out -> girlfriend -> dates -> proposal -> marriage
      Y.S.aff.peaches = 100; const pc = Y.cats.find((k) => k.def.id === 'peaches');
      const rnd = Math.random; Math.random = () => 0.1; Y.askOut('peaches'); Math.random = rnd;
      QA.step(1); for (let i = 0; i < 8 && G.dialog; i++) { await QA.key('e'); }
      o.gf = Y.S.gf; o.gfPrompt = (await QA.tp({ x: pc.x, z: pc.z + 1.2, yaw: Math.PI }, { settle: 3 }), Y.prompt());
      const b0 = Y.S.bond; Math.random = () => 0.05; Y.date('peaches', 'stars'); Math.random = rnd;
      QA.step(1); for (let i = 0; i < 8 && G.dialog; i++) { await QA.key('e'); }
      o.bondUp = Y.S.bond > b0; o.dateCooldown = Y.S.dateAt > 0;
      Y.S.bond = 100;
      Math.random = () => 0.1; Y.propose('peaches'); Math.random = rnd;
      QA.step(1); for (let i = 0; i < 8 && G.dialog; i++) { await QA.key('e'); }
      o.wife = Y.S.wife; o.atRV = Math.hypot(pc.x - places.rv.x, pc.z - places.rv.z) < 7; o.questDone = (quests.list().find((q) => q.id === 'romance') || {}).status;
      // jealous wife: flirting with another cat sends her after Goobles
      const m2 = Y.cats.find((k) => k.def.id === 'mittens'); await QA.tp({ x: m2.x, z: m2.z + 1.2, yaw: Math.PI }, { settle: 3 });
      G.hp = 100; Y.cheat('mittens'); o.chasing = !!Y.chase; o.phases = [];
      for (let i = 0; i < 900 && Y.chase && !G.dialog; i++) { QA.step(1, { render: false }); if (Y.chase && o.phases[o.phases.length - 1] !== Y.chase.phase) o.phases.push(Y.chase.phase); }
      o.scold = G.dialog && G.dialog.lines[0][0]; o.rivalSnubbed = m2.snub > 30; o.goobHp = G.hp;
      for (let i = 0; i < 8 && G.dialog; i++) { await QA.key('e'); }
      Y.reset(); try { localStorage.removeItem('maple-grove-offleash-yardcats-v1'); } catch (e) { /* ignore */ }
      return o;
    });
    check('8 yard cats, all modelled, merged to one mesh each', r.n === 8 && r.ready === 8 && r.merged, r);
    check('cats stand in the Estates yards', r.inYards, r);
    check('quest listed as open before meeting anyone', r.questOpen === 'open', r);
    check('E prompt + flirt menu opens', /Flirt with Mittens/.test(r.prompt) && r.menu, r);
    check('a line plays as Goobles then her answer', r.dialog && /^Goobles\|Mittens/.test(r.who || ''), r);
    check('meeting her starts the courtship quest', r.met && r.questActive === 'active', r);
    check('random outcomes: hated style is mostly disgust, but all four happen', r.hated.disgust > 150 && r.hated.swoon > 0 && r.hated.warm > 0 && r.hated.meh > 0, r.hated);
    check('a loved style can make her swoon', r.loved === 'swoon', r);
    check('100% unlocks asking her out: girlfriend + date prompt', r.gf === 'peaches' && /Date Peaches/.test(r.gfPrompt || ''), r);
    check('a good date raises the bond and starts the cooldown', r.bondUp && r.dateCooldown, r);
    check('flirting while married: wife fights the other cat, then scolds Goobles', r.chasing && /^run,fight,flee/.test(r.phases.join()) && r.scold === 'Peaches' && r.rivalSnubbed && r.goobHp === 100, r);
    check('a yes makes her your wife and she moves to the RV', r.wife === 'peaches' && r.atRV && r.questDone === 'done', r);
    await S.js(async () => { const { yardcats: Y } = window.__G; const c = Y.cats.find((k) => k.def.id === 'cleo'); await window.QA.tp({ x: c.x - 0.4, z: c.z + 2.2, yaw: Math.PI }, { settle: 6 }); });
    await shot('yardcats-yard');
  },
};
