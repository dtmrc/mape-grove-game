// Cars: spawn each type, enter, throttle, steer, brake, exit.
module.exports = {
  name: 'driving', desc: 'every car type spawns, drives, steers, brakes; get in/out',
  async run({ S, check, shot }) {
    const types = ['sedan', 'hatch', 'wagon', 'pickup', 'suv', 'golfcart', 'goobtruck'];
    for (const t of types) {
      const r = await S.js(async ([t]) => {
        const QA = window.QA, G = window.__G;
        const old = G.P.car;
        if (G.P.car) { QA.down('e'); QA.step(2, { render: false }); QA.up('e'); QA.step(4, { render: false }); }
        if (old) { G.cars.splice(G.cars.indexOf(old), 1); G.scene.remove(old.mesh); } // the remodeled cars are full size: clear the last test car off the endzone
        await QA.tp('endzone', { settle: 2, render: false }); G.P.yaw = 0;
        const sp = await QA.spawnCar(t, { enter: true, yaw: Math.PI / 2 });
        const c = G.P.car; if (!c) return { sp, err: 'not in car' };
        const d = await QA.drive(45); const yaw0 = c.yaw;
        await QA.drive(20, 'a'); const turned = Math.abs(c.yaw - yaw0) > 0.1;
        const v0 = Math.abs(c.speed); await QA.hold([' '], 50); const v1 = Math.abs(c.speed);
        return { t, dist: d.dist, top: d.speed, turned, v0, v1, fuel: c.fuel };
      }, [t]);
      check(`${t}: drives (moved ${r.dist} m, ${r.top} m/s), steers, brakes`, r.dist > 5 && r.turned && r.v1 < r.v0 * 0.5 + 0.5, r);
    }
    await shot('in-car');
    const out = await S.js(async () => { const QA = window.QA, G = window.__G; await QA.key('e', 1); QA.step(10, { render: false }); return { inCar: !!G.P.car }; });
    check('E gets out of the car', !out.inCar, out);
  },
};
