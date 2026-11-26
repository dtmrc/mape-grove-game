// Every enterable room: enter, look around, walk, exit back outside.
module.exports = {
  name: 'interiors', desc: 'enter + exit every room, floors/colliders built, walking inside works',
  async run({ S, check, shot }) {
    const rooms = await S.js(async () => { await window.__INT.ready; return window.QA.rooms(); });
    check('rooms registered', rooms.length >= 5, rooms);
    for (const id of rooms) {
      const r = await S.js(async ([id]) => {
        const QA = window.QA, I = window.__INT; const st = await QA.enter(id);
        const room = I.state.room || {}; const w = await QA.walk(15);
        const san = QA.sanity(); await QA.exit(); const out = QA.state();
        return { inside: st.inside, cols: room.cols, floors: room.floors, walk: w.dist, san, outside: !out.inside, intErr: I.state.errors };
      }, [id]);
      check(`${id}: enter, walk, exit`, r.inside === id && r.outside && !r.san.length && !(r.intErr || []).length, r);
      if (r.inside === id) { await S.js(([id]) => window.QA.enter(id), [id]); await shot('room-' + id, { hud: false }); await S.js(() => window.QA.exit()); }
    }
  },
};
