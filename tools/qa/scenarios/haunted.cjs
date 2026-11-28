// Ghost of John parts B and C (haunted.js): the note, five fetch items, the sitting, the nap; then the sign, the HOA
// meeting, the site, the bulldozer battle and the party. Shots of each stage.
// node tools/qa/qa.cjs run tools/qa/scenarios/haunted.cjs
const keys = async () => { const QA = window.QA, G = window.__G; for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e'); await QA.frames(2); };
module.exports = async ({ S, check, shot }) => {
  const dlg = () => S.js(async () => { const QA = window.QA, G = window.__G; for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e'); await QA.frames(2); });
  const toLair = () => S.js(async () => {
    const QA = window.QA, C = window.__CAVE, P = window.__G.P; await QA.exit(); await QA.frames(2);
    C.goLair(); await QA.until(() => window.__INT.current() === 'cavelair' && !window.__INT.state.fading, 200); await QA.frames(5);
    const L = window.__INT.room; P.x = L.origin.x + 1.6; P.z = L.origin.z + 1.6; await QA.frames(70);
  });
  await S.js(() => { const H = window.__HENS; window.QA.time(12, { freeze: true }); H.reset(); window.__CAVE.reset(); window.__HAUNT.reset(); if (window.__HOA) window.__HOA.hold = true; H.SV.stage = 'deal'; H.SV.hens = 6; H.SV.wand = 1; H.SV.seen = 1; H.SV.doneDay = 0; H.SV.day = 0; window.__CAVE.SV.met = 1; });
  // ---- B
  const a = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, U = window.__HAUNT, G = window.__G, P = G.P; await QA.exit();
    P.x = G.places.rv.x + 6; P.z = G.places.rv.z - 6; await QA.frames(5); const before = U.SV.b;
    H.night(); await QA.frames(5); const after = U.SV.b;
    P.x = G.places.rv.x + 0.6; P.z = G.places.rv.z + 0.4; await QA.frames(4); const pr = U.prompt(); await QA.key('e'); await QA.frames(2);
    return { before, after, pr, q: G.quests.list().find((q) => q.id === 'unfinished') };
  });
  await dlg();
  check('a night after part A the note appears on the RV door', a.before === 'none' && a.after === 'note' && /note/.test(a.pr), a);
  await toLair(); await dlg();
  const b = await S.js(() => window.__HAUNT.state());
  check('John asks for five things', b.b === 'fetch', b);
  const c = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {}; await QA.exit(); await QA.frames(3);
    // nana
    const n = G.peds.find((p) => p.npc === 'nana'); P.x = n.x + 1.2; P.z = n.z + 0.5; await QA.frames(4); o.nana = U.prompt(); await QA.key('e');
    for (let i = 0; i < 8 && G.G.dialog; i++) await QA.key('e');
    // plaque at night
    QA.time(23, { freeze: true }); P.x = U.HOA.plaque.x; P.z = U.HOA.plaque.z - 1.3; await QA.frames(6); o.plaque = U.prompt();
    return o;
  });
  check('Nana and the plaque have prompts', /Nana/.test(c.nana) && /plaque/.test(c.plaque), c);
  await S.js(async () => { const QA = window.QA, U = window.__HAUNT; QA.cam(Math.PI, 0.25); await QA.frames(4); });
  await shot('haunt-plaque', { hud: true });
  const d = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {};
    for (let i = 0; i < 3; i++) { await QA.key('e'); await QA.frames(2); } o.heat = G.G.heat; o.items1 = U.state().items;
    // clay
    QA.time(12, { freeze: true }); P.x = U.CLAY.x + 0.8; P.z = U.CLAY.z + 0.6; await QA.frames(8); o.clayPr = U.prompt(); o.y = P.y;
    QA.cam(0.6, 0.4); await QA.frames(3);
    return o;
  });
  check('plaque pried at night without heat', d.items1.includes('bronze') && d.heat === 0, d);
  await shot('haunt-clay', { hud: true });
  const e = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {};
    for (let i = 0; i < 3; i++) { await QA.key('e'); await QA.frames(2); }
    // photo: stand still at noon
    await QA.frames(230); o.items = U.state().items.slice();
    // harmonica at the donut board
    G.fishing.give('bass'); G.fishing.give('bluegill');
    await QA.enter('donut'); await QA.frames(5);
    const R = window.__INT.room; P.x = R.origin.x - 4.2; P.z = R.origin.z + 0.9; await QA.frames(4); await QA.key('e');
    for (let i = 0; i < 8 && G.G.dialog; i++) await QA.key('e');
    o.all = U.state().items; o.fish = G.fishing.S.bag.length;
    return o;
  });
  check('clay dug and the noon photo taken', e.items.includes('clay') && e.items.includes('photo'), e);
  check('Dot trades the harmonica for 2 fish', e.all.includes('harmonica') && e.all.length === 5, e);
  await toLair(); await dlg();
  const f = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {}; o.b = U.SV.b;
    const R = window.__INT.room; P.x = R.origin.x + U.LAIR.stool.x + 0.7; P.z = R.origin.z + U.LAIR.stool.z + 0.5; await QA.frames(5);
    await QA.key('e'); await QA.frames(60); o.sit = U.state().sit;
    // move: resets
    P.x += 1; await QA.frames(3); o.afterMove = U.S.sit;
    P.x = R.origin.x + U.LAIR.stool.x + 0.7; await QA.frames(3); await QA.key('e'); await QA.frames(120);
    QA.cam(-0.9, 0.3); await QA.frames(3);
    return o;
  });
  check('all five in: the sitting starts, moving resets it', f.b === 'sit' && f.sit !== null && f.afterMove === null, f);
  await shot('haunt-sitting', { hud: true });
  const g = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G; U.S.sitSpeed = 12;
    await QA.until(() => !U.S.sit, 600); for (let i = 0; i < 8 && G.G.dialog; i++) await QA.key('e');
    await QA.frames(20); const nap = U.state().nap; U.S.sitSpeed = 1; await QA.frames(160);
    return { nap };
  });
  check('bust done, the nap scene plays', g.nap === true, g);
  await shot('haunt-nap', { hud: true });
  const h = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P; U.S.sitSpeed = 12; await QA.until(() => !U.S.nap, 600); U.S.sitSpeed = 1;
    for (let i = 0; i < 14 && G.G.dialog; i++) await QA.key('e'); await QA.frames(5);
    const st = U.state(); QA.cam(-0.9, 0.3); await QA.frames(3);
    return st;
  });
  check('Unfinished Business done, harmonica owned', h.b === 'done' && h.harm, h);
  await shot('haunt-bust12', { hud: true });
  const h2 = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P; await QA.exit(); await QA.frames(3);
    await QA.enter('rv'); await QA.frames(10); const R = window.__INT.room; P.x = R.origin.x - 0.6; P.z = R.origin.z + 0.2; await QA.frames(5); QA.cam(-Math.PI / 2, 0.5); await QA.frames(3);
    return { room: window.__INT.current() };
  });
  await shot('haunt-rv-bust', { hud: true });
  // ---- C
  const i = await S.js(async () => {
    const QA = window.QA, H = window.__HENS, U = window.__HAUNT, G = window.__G, P = G.P, o = {}; await QA.exit(); await QA.frames(3);
    G.G.heat = 2; await QA.key('h'); await QA.frames(3); o.heatAfterHarmonica = G.G.heat; G.G.heat = 0;
    H.night(); await QA.frames(5); o.c = U.SV.c;
    P.x = U.SIGN.x - 1.8; P.z = U.SIGN.z + 2.2; await QA.frames(10); o.pr = U.prompt(); QA.cam(Math.atan2(-1.8, 2.2), 0.15); await QA.frames(3);
    return o;
  });
  check('harmonica takes a star off', i.heatAfterHarmonica === 1, i);
  check('a night later the Hollow Estates sign is up', i.c === 'hook' && /sign/.test(i.pr), i);
  await shot('haunt-site-sign', { hud: true });
  const j = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {}; await QA.key('e'); for (let k = 0; k < 8 && G.G.dialog; k++) await QA.key('e');
    o.c = U.SV.c; o.door = window.__INT.state.entries.find((e) => e.id === 'hoahall');
    P.x = U.HOA.door.x; P.z = U.HOA.door.z - 0.6; await QA.frames(5); await QA.key('e'); await QA.until(() => window.__INT.current() === 'hoahall' && !window.__INT.state.fading, 200); await QA.frames(10);
    o.room = window.__INT.current(); o.dlg = !!G.G.dialog;
    return o;
  });
  check('the sign starts the quest and the HOA office opens', j.c === 'meeting' && j.room === 'hoahall', j);
  await dlg();
  await S.js(async () => { const QA = window.QA, U = window.__HAUNT; await QA.until(() => U.S.meet && U.S.meet.cue, 400); QA.cam(0, 0.35); await QA.frames(3); });
  await shot('haunt-meeting', { hud: true });
  const k = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = { hits: 0 }; const R = window.__INT.room;
    for (let n = 0; n < 6 && U.S.meet; n++) {
      await QA.until(() => !U.S.meet || (U.S.meet.cue && !G.G.dialog), 600); if (!U.S.meet) break;
      const sp = U.SPOTS[U.S.meet.cue]; P.x = R.origin.x + sp.x + 0.4; P.z = R.origin.z + sp.z + 0.5; await QA.frames(3);
      if (n === 0) o.pr = window.__INT.state.prompt || '';
      await QA.key('e'); o.hits++; for (let q = 0; q < 10 && G.G.dialog; q++) await QA.key('e'); await QA.frames(2);
    }
    o.st = U.state();
    return o;
  });
  check('four scares break the board and the vote is off', k.st.c === 'site' && k.hits === 4, k);
  const l = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {}; await QA.exit(); await QA.frames(3);
    P.x = U.SITE.x + 1; P.z = U.SITE.z + 7.5; await QA.frames(10); QA.cam(0.1, 0.35); await QA.frames(4);
    return o;
  });
  await shot('haunt-site', { hud: true });
  const m = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {};
    for (const s of U.STAKES) { P.x = s.x + 0.5; P.z = s.z + 0.4; await QA.frames(3); await QA.key('e'); await QA.frames(2); }
    o.stakes = U.SV.stakes;
    P.x = U.DIGGER.x + 2.4; P.z = U.DIGGER.z + 1.6; await QA.frames(3); for (let n = 0; n < 3; n++) { await QA.key('e'); await QA.frames(2); } o.cap = U.SV.cap;
    P.x = U.TRAILER.x - 0.6; P.z = U.TRAILER.z + 2.6; await QA.frames(3); o.tpr = U.prompt(); await QA.key('e'); await QA.frames(3);
    for (let q = 0; q < 8 && G.G.dialog; q++) await QA.key('e'); o.c = U.SV.c;
    return o;
  });
  check('stakes, fuel cap and blueprints: the bulldozer comes', m.stakes === 63 && m.cap === 1 && m.c === 'boss', m);
  const n = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, C = window.__CAVE, G = window.__G, P = G.P, o = {};
    const s = C.spot; P.x = s.x + 9; P.z = s.z + 1; await QA.frames(20); o.pr = U.prompt(); await QA.key('e');
    for (let q = 0; q < 8 && G.G.dialog; q++) await QA.key('e'); await QA.frames(3); o.st = U.state();
    await QA.key('e'); await QA.frames(3); QA.cam(-Math.PI / 2, 0.3); await QA.frames(30);
    return o;
  });
  check('standing in front of the bulldozer starts the battle', /bulldozer/.test(n.pr) && n.st.battle, n);
  await shot('haunt-boss', { hud: true });
  const o = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, r = { turns: 0, losses: 0 };
    for (let t = 0; t < 400; t++) {
      const B = U.S.battle;
      if (!B) { if (U.S.win || U.SV.c !== 'boss') break; r.losses++; U.startBoss(); continue; }
      if (B.mode === 'msg') { U.bossMove(); continue; }
      r.turns++; U.bossMove(G.G.hp < 35 ? 3 : B.cd <= 0 ? 2 : 0);
    }
    r.win = !!U.S.win; await QA.frames(60); QA.cam(-Math.PI / 2, 0.3); await QA.frames(3);
    return r;
  });
  check('the bulldozer battle can be won', o.win, o);
  await shot('haunt-boss-win', { hud: true });
  const p = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G; await QA.frames(120);
    for (let q = 0; q < 14 && G.G.dialog; q++) await QA.key('e'); await QA.frames(5);
    return U.state();
  });
  check('Gary loses, the party is on', p.c === 'party', p);
  await toLair();
  await S.js(async () => { const QA = window.QA; QA.cam(0.4, 0.3); await QA.frames(3); });
  await shot('haunt-party', { hud: true });
  const q = await S.js(async () => {
    const QA = window.QA, U = window.__HAUNT, G = window.__G, P = G.P, o = {}; const cash = G.G.cash;
    for (let n = 0; n < 16 && G.G.dialog; n++) await QA.key('e'); await QA.frames(3);
    o.st = U.state(); o.paid = G.G.cash - cash;
    await QA.exit(); await QA.frames(5); G.G.heat = 3; await QA.key('g'); await QA.frames(5); o.heat = G.G.heat; o.boo = !!U.S.boo;
    const d = U.DEEP; P.x = d.x + 1.2; P.z = d.z + 0.8; await QA.frames(8); QA.cam(1.2, 0.3); await QA.frames(3);
    return o;
  });
  check('party ends the quest: $500', q.st.c === 'done' && q.paid === 500, q);
  check('G summons John and clears the heat', q.heat === 0 && q.boo, q);
  await shot('haunt-plaque-deep', { hud: true });
  await S.js(async () => { window.__G.G.heat = 0; window.__HENS.reset(); window.__CAVE.reset(); window.__HAUNT.reset(); if (window.__HOA) window.__HOA.hold = false; await window.QA.exit(); window.QA.time(12); });
};
