// Service vehicles + EMS dispatch (ems.js): the fire engine, ambulance and tractor are parked at home, drive, the engine's horn
// toggles its siren; a run-over walker gets an ambulance that drives in, EMTs stretcher them off and it leaves.
const view = async (S, [x, z, yaw, pitch, d = 9]) => S.js(async ([x, z, yaw, pitch, d]) => {
  const QA = window.QA, G = window.__G, P = G.P; QA.hud(false);
  P.x = x - Math.sin(yaw) * d; P.z = z - Math.cos(yaw) * d; P.yaw = yaw;   // QA.cam(a) puts the camera on the a side of the cat
  for (let i = 0; i < 14; i++) { QA.cam(yaw + Math.PI, pitch); QA.step(1, { render: i === 13 }); }
}, [x, z, yaw, pitch, d]);
module.exports = {
  name: 'ems', desc: 'fire engine, ambulance, tractor drivable; siren; ambulance dispatch with EMTs + stretcher',
  async run({ S, check, shot }) {
    await S.js(() => window.QA.time(13, { freeze: true }));
    const home = await S.js(() => window.__EMS.cars.map((c) => c && { m: c.model, x: c.x, z: c.z, yaw: c.yaw, len: c.spec.len }));
    check('three service vehicles parked at home', home.length === 3 && home.every(Boolean), home.map((h) => h && h.m));
    for (const h of home) { await view(S, [h.x, h.z, h.yaw + (h.m === 'ambulance15' ? 3.6 : 2.4), 0.22, h.len * 0.85 + 3]); await shot(`parked-${h.m}`, { hud: false }); }
    for (const id of ['pumper12', 'ambulance15', 'tractor']) {
      const r = await S.js(async ([id]) => {
        const QA = window.QA, G = window.__G, E = window.__EMS;
        if (G.P.car) { const o = G.P.car; await QA.key('e', 1); QA.step(6, { render: false }); G.removeCar(o); }
        await QA.tp('endzone', { settle: 2, render: false }); G.P.yaw = 0;
        await QA.spawnCar('pickup', { enter: true, yaw: Math.PI / 2, dist: 8, opts: { model: id } });
        const c = G.P.car; if (!c || c.model !== id) return { err: 'not in ' + id };
        const d = await QA.drive(60); const y0 = c.yaw; await QA.drive(25, 'a');
        const turned = Math.abs(c.yaw - y0) > 0.1;
        await QA.key('h', 1); QA.step(3, { render: false }); const siren = c.siren;
        await QA.key('h', 1); QA.step(3, { render: false });
        const wheels = c.mesh.userData.wheels.length, wk = c.mesh.userData.wk || null;
        return { dist: d.dist, top: d.speed, turned, siren, sirenOff: !c.siren, wheels, wk, E: !!E };
      }, [id]);
      const sirenOk = id === 'tractor' ? !r.siren : r.siren && r.sirenOff;
      check(`${id}: drives ${r.dist} m (${r.top} m/s), steers, horn ${id === 'tractor' ? 'is a horn' : 'toggles the siren'}`, r.dist > 5 && r.turned && sirenOk && r.wheels === 4, r);
    }
    // dispatch: knock a walker down by the Quik Stop, call it in, follow the ambulance through every stage
    const run = await S.js(async () => {
      const QA = window.QA, G = window.__G, E = window.__EMS;
      if (G.P.car) { const o = G.P.car; await QA.key('e', 1); QA.step(6, { render: false }); G.removeCar(o); }
      for (let i = 0; i < 3000 && E.state; i++) QA.step(1, { render: false });   // finish any earlier call
      await QA.tp('quik', { settle: 2, render: false });
      const p = G.peds.find((q) => q.kind === 'human' && !q.npc && !q.ems);
      if (!p) return { err: 'no walker' };
      p.x = G.px() + 6; p.z = G.pz() + 2; p.state = 'down'; p.t = 5; p.vx = p.vz = 0;
      const ok = E.dispatch(p), seen = []; let frames = 0;
      for (; frames < 2600; frames++) { QA.step(1, { render: false }); const s = E.state, st = s ? s.st : 'done'; if (seen[seen.length - 1] !== st) seen.push(st); if (st === 'out' || st === 'done') break; }
      return { ok, seen, frames, victim: G.peds.includes(p) };
    });
    check('dispatch: ambulance spawns and drives to the casualty', run.ok && run.seen.includes('drive') && run.seen.includes('out'), run);
    const stretcherAt = () => S.js(() => { const st = window.__G.scene.children.find((o) => o.isGroup && o.children.length === 13 && o.children.every((m) => m.isMesh)); return st && { x: st.position.x, z: st.position.z }; });
    for (let k = 0; k < 2; k++) {
      await S.js(() => { for (let i = 0; i < 30; i++) window.QA.step(1, { render: false }); });
      const p = await stretcherAt(); if (p) { await view(S, [p.x, p.z, 0.8 + k * 2, 0.45, 5]); await shot(`emts-${k}`, { hud: false }); }
    }
    const end = await S.js(async () => {
      const QA = window.QA, E = window.__EMS, seen = [];
      for (let i = 0; i < 1600; i++) { QA.step(1, { render: false }); const s = E.state, st = s ? s.st : 'done'; if (seen[seen.length - 1] !== st) seen.push(st); if (st === 'back' && !seen.shot) { seen.shot = 1; break; } }
      return seen;
    });
    const p = await stretcherAt(); if (p) { await view(S, [p.x, p.z, 2.2, 0.45, 5]); await shot('emts-loaded', { hud: false }); }
    const fin = await S.js(async () => {
      const QA = window.QA, G = window.__G, E = window.__EMS, seen = [];
      for (let i = 0; i < 800; i++) { QA.step(1, { render: false }); const s = E.state, st = s ? s.st : 'done'; if (seen[seen.length - 1] !== st) seen.push(st); if (st === 'leave') break; }
      const amb = G.cars.find((c) => c.role === 'emsleave');
      await QA.tp('rv', { settle: 2, render: false });   // drive away: the ambulance goes once out of sight
      for (let i = 0; i < 1300 && E.state; i++) QA.step(1, { render: false });   // gone once out of sight (60 s at most)
      return { seen, leaving: !!amb, after: E.state, cars: G.cars.filter((c) => c.role === 'emsleave' || c.role === 'emsrun').length };
    });
    check('EMTs load the casualty, the ambulance leaves and is cleaned up', end.includes('load') && fin.seen.includes('leave') && fin.leaving && !fin.after && fin.cars === 0, { end, fin });
    await S.js(() => window.QA.hud(true));
  },
};
