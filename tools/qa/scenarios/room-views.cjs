// Screenshots of one interior from several camera angles: run room-views.cjs --room pizza
module.exports = {
  name: 'room-views',
  async run({ S, shot, args }) {
    const id = (args && args.room) || 'pizza';
    for (const [k, yaw, x, z, pitch] of [['a', 0, null, null, 0.3], ['b', 0.8, null, null, 0.35], ['c', -0.8, null, null, 0.35], ...((args && args.extra) ? JSON.parse(args.extra) : [['d', Math.PI, 0, -1, 0.45]])]) {
      await S.js(async ([id, yaw, x, z, pitch]) => {
        const QA = window.QA; await QA.enter(id); const r = window.__INT.room;
        if (x !== null && r) { const P = window.__G.P; P.x = r.origin.x + x; P.z = r.origin.z + z; }
        QA.hud(false); for (let i = 0; i < 12; i++) { QA.cam(yaw, pitch); QA.step(1); }
      }, [id, yaw, x, z, pitch]);
      await shot(`${id}-${k}`, { hud: false });
    }
  },
};
