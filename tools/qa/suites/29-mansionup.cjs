// Estates second storeys: the staircase leads up and back down (plain and mirrored plans), the door still exits
// outside from either floor, the laundry chute returns to the ground floor, things can be knocked off tables.
module.exports = {
  name: 'mansionup', desc: 'mansion stairs up and down, upstairs rooms, chute, knockables, vacuum ride',
  async run({ S, check }) {
    const ids = await S.js(async () => { await window.__INT.ready; const H = window.__G.mansions.S.houses; const m = H.find((h) => h.mirror && !h.gary), p = H.find((h) => !h.mirror && !h.gary); return ['gary', m && m.id, p && p.id].filter(Boolean); });
    check('houses to test', ids.length >= 2, ids);
    for (const id of ids) {
      const r = await S.js(async ([id]) => {
        const QA = window.QA, I = window.__INT, G = window.__G, P = G.P, out = {};
        await QA.enter(id); let o = I.room.origin; const h = G.mansions.S.houses.find((q) => q.id === id), mx = h.mirror ? -1 : 1;
        P.x = o.x + mx * -4.35; P.z = o.z + 2.3; P.y = 0; QA.cam(0, 0.3); await QA.walk(30); await QA.frames(40);
        out.up = I.state.id; o = I.room.origin; out.upAt = [+(P.x - o.x).toFixed(2), +(P.z - o.z).toFixed(2)];
        out.upRooms = I.state.room.spots.length;
        QA.cam(Math.PI, 0.3); for (let i = 0; i < 25 && I.state.id !== id; i++) await QA.walk(3);
        out.down = I.state.id; out.downY = +P.y.toFixed(2); await QA.frames(40);
        await QA.walk(40); out.bottomY = +P.y.toFixed(2);
        const R = I.room, use = (sid) => { const s = R.spots.find((q) => q.id === sid); P.x = R.origin.x + s.x; P.z = R.origin.z + s.z + 0.3; P.y = 0; s.onUse(); return s; };
        const k0 = use('knock0'); await QA.frames(40); out.knockOff = k0.r === 0 && R.group.getObjectByName('mansion:knock') != null;
        use('vac'); await QA.frames(20); const v = R.group.getObjectByName('mansion:vac'); out.ride = +Math.hypot(P.x - R.origin.x - v.position.x, P.z - R.origin.z - v.position.z).toFixed(2);
        await QA.exit(); out.outside = !I.inside && Math.hypot(P.x - h.door.x, P.z - h.door.z) < 6;
        await QA.enter(id + '-up'); const s = I.room.spots.find((q) => q.id === 'chute'); P.x = I.room.origin.x + s.x; P.z = I.room.origin.z + s.z; s.onUse(); await QA.frames(60);
        out.chute = I.state.id; out.san = QA.sanity(); await QA.exit(); out.outside2 = !I.inside;
        return out;
      }, [id]);
      check(`${id}: stairs lead upstairs`, r.up === id + '-up' && r.upRooms > 20, r);
      check(`${id}: top step leads back down, part way up the stairs`, r.down === id && r.downY > 0.5 && r.bottomY < 0.2, r);
      check(`${id}: knock a thing off, ride the vacuum`, r.knockOff && r.ride < 0.3, r);
      check(`${id}: door exits outside, chute returns downstairs`, r.outside && r.chute === id && r.outside2 && !r.san.length, r);
    }
  },
};
