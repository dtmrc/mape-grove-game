// Robbery: hold up the Donut Hole and Rosie's Diner, check loot, alarm -> heat, PD storm -> arrest, restock.
// node tools/qa/qa.cjs run tools/qa/scenarios/robbery.cjs
module.exports = async ({ S, check, shot }) => {
  const at = async (id, x, z, yaw = Math.PI) => S.js(([x, z, yaw]) => { const G = window.__G, o = window.__INT.state.room.origin; G.P.x = o.x + x; G.P.z = o.z + z; G.P.yaw = yaw; return true; }, [x, z, yaw]);
  for (const id of ['donut', 'diner']) {
    await S.js(() => window.__ROB.ready);
    await S.js(([id]) => window.QA.enter(id), [id]);
    const spot = await S.js(([id]) => window.__ROB.STORES[id].spot, [id]);
    await at(id, spot.x, spot.z + 0.05);
    await S.js(() => window.QA.frames(3));
    await S.js(() => window.QA.key('e', 1));
    let r = await S.js(() => window.__ROB.state);
    check(`${id}: robbery starts on E`, r.cur && r.cur.id === id && r.heat >= 1, r);
    await S.js(() => window.QA.frames(40));
    await shot(`robbery-${id}-stickup`);
    await S.js(() => window.QA.key('e', 1));
    await S.js(() => window.QA.frames(200));
    r = await S.js(() => window.__ROB.state);
    check(`${id}: till emptied, alarm, heat >= 3`, !r.cur && r.lastTake && r.lastTake.id === id && r.heat >= 3 && r.hot === id, r);
    const cash = await S.js(() => window.__G.G.cash);
    check(`${id}: loot paid`, id === 'diner' ? r.lastTake.cash > 100 : r.lastTake.fish >= 6, { cash, take: r.lastTake });
    // again right away: till is empty
    await S.js(() => window.QA.key('e', 1));
    r = await S.js(() => window.__ROB.state);
    check(`${id}: empty till refuses`, !r.cur, r);
    // stay inside until the PD storms in
    await S.js(() => window.QA.until(() => window.__ROB.S.storm, 600));
    await S.js(() => window.QA.frames(12));
    r = await S.js(() => window.__ROB.state);
    check(`${id}: PD storms the store`, !!r.storm || r.arrests > 0, r);
    await shot(`robbery-${id}-storm`);
    await S.js(() => window.QA.until(() => window.__G.police.busted, 400));
    await S.js(() => window.QA.frames(4));
    await shot(`robbery-${id}-busted`);
    const b = await S.js(() => ({ busted: window.__G.police.busted, arrests: window.__ROB.S.arrests }));
    check(`${id}: arrested`, b.busted || b.arrests > 0, b);
    await S.js(() => window.QA.frames(160));
    const after = await S.js(() => ({ jail: window.__JAIL && window.__JAIL.active, inside: window.__INT.current(), heat: window.__G.G.heat, errs: window.__ROB.S.errors, san: window.QA.sanity() }));
    check(`${id}: hand-off to jail, no errors`, !after.errs.length && !after.san.length, after);
    // clean up for the next store
    await S.js(async () => { try { window.__JAIL && window.__JAIL.end && window.__JAIL.end({ quiet: true }); } catch (e) {} await window.QA.exit(); window.__G.G.heat = 0; window.__G.police.clear(); window.__ROB.S.hot = null; await window.QA.frames(5); });
  }
  // escape: rob the diner, walk out before the PD arrives
  await S.js(() => window.__ROB.restock());
  await S.js(() => window.QA.enter('diner'));
  const sp = await S.js(() => window.__ROB.STORES.diner.spot);
  await at('diner', sp.x, sp.z + 0.05);
  await S.js(() => window.QA.frames(3));
  await S.js(() => window.QA.key('e', 1));
  await S.js(() => window.QA.frames(60));
  await S.js(() => window.QA.exit());
  await S.js(() => window.QA.frames(30));
  const r = await S.js(() => window.__ROB.state);
  check('walking out early keeps partial loot + alarm', !r.cur && r.lastTake && r.heat >= 3 && !r.storm, r);
  await shot('robbery-escape-outside');
  return S.js(() => window.__ROB.state);
};
