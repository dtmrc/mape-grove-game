// Breakable street props (breakables.js): a car knocks over fence sections, gates, street lamps and hydrants.
// Lamps go dark the frame they are hit (light, cone, glow pool); a hydrant gushes for a minute and is then shut off.
module.exports = {
  name: 'breakables', desc: 'car smashes a fence section, a gate, a lamp (lights out at once) and a hydrant (water off after 60 s)',
  async run({ S, check, shot }) {
    // find one of each breakable kind
    const info = await S.js(() => {
      const T = window.__dev.TER, pick = {};
      for (let g = 1; g < T.groups.length; g++) {
        const G = T.groups[g], o = T.colModel[G.cols[0]].orig; if (!o.brk) continue;
        const k = o.brk === 'fence' ? 'fence:' + o.fk : o.brk;
        if (!pick[k]) pick[k] = { g, seg: o.seg, cx: o.cx, cz: o.cz, x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1 };
      }
      return pick;
    });
    check('fences, gates, lamps and hydrants are breakable groups', ['fence:picket', 'fence:chain', 'fence:farmrail', 'gate', 'lamp', 'hydrant'].every((k) => info[k]), Object.keys(info));

    // ram a target with a moving car: put the car 6 m back on the perpendicular, aimed at the point, at 14 m/s
    const ram = (k) => S.js(async (k) => {
      const QA = window.QA, T = window.__dev.TER, B = window.__BRK, G = window.__G;
      const g0 = (() => { for (let g = 1; g < T.groups.length; g++) { const o = T.colModel[T.groups[g].cols[0]].orig; if ((o.brk === 'fence' ? 'fence:' + o.fk : o.brk) === k) return g; } })();
      const o = T.colModel[T.groups[g0].cols[0]].orig;
      let px, pz, nx, nz;
      if (o.seg) { const [a, b, c, d] = o.seg; px = (a + c) / 2; pz = (b + d) / 2; const L = Math.hypot(c - a, d - b); nx = -(d - b) / L; nz = (c - a) / L; }
      else { px = o.cx; pz = o.cz; nx = 1; nz = 0; }
      // approach from whichever side is clear
      const s = G.cars ? 1 : 1, sx = px - nx * 6 * s, sz = pz - nz * 6 * s;
      await QA.tp(sx + ',' + sz, { settle: 2 });
      const car = await QA.spawnCar('sedan', { enter: true, dist: 0 });
      const c = G.P.car; c.x = sx; c.z = sz; c.yaw = Math.atan2(nx, nz); c.vx = nx * 14; c.vz = nz * 14;
      const before = T.groups[g0].broken;
      let n = 0; for (; n < 40 && !T.groups[g0].broken; n++) { c.vx = nx * 14; c.vz = nz * 14; QA.step(1, { render: false }); }
      return { g: g0, before: !!before, broken: !!T.groups[g0].broken, frames: n, live: B.live.length, debris: B.debris && B.debris() };
    }, k);

    const f = await ram('fence:picket');
    check('car breaks a picket fence section', !f.before && f.broken, f);
    check('fence pieces fly as instanced debris', f.debris && Object.values(f.debris).reduce((a, b) => a + b, 0) > 3, f.debris);
    await S.js(() => window.QA.step(60, { render: false }));
    await shot('fence-down', { hud: false });
    const rest = await S.js(() => { const B = window.__BRK; const e = B.live.find((e) => e.kind === 'fence'); return e && { asleep: e.pieces.filter((p) => p.sleep).length, n: e.pieces.length, nan: e.pieces.some((p) => !isFinite(p.x + p.y + p.z + p.tilt)) }; });
    check('fence debris settles on the ground', rest && !rest.nan && rest.asleep >= rest.n * 0.7, rest);
    const ga = await ram('gate');
    check('car breaks a gate', ga.broken, ga);
    const fr = await ram('fence:farmrail');
    check('car breaks a field rail fence section', fr.broken, fr);

    // lamp at night: everything goes out in the frame it's hit
    await S.js(() => window.QA.time(22, { freeze: true }));
    const lp = await S.js(async () => {
      const QA = window.QA, T = window.__dev.TER, B = window.__BRK, G = window.__G, lights = window.__dev.lights;
      const g = (() => { for (let g = 1; g < T.groups.length; g++) { const o = T.colModel[T.groups[g].cols[0]].orig; if (o.brk === 'lamp' && !T.groups[g].broken) return g; } })();
      const o = T.colModel[T.groups[g].cols[0]].orig, L = lights.find((L) => L.y > 4.5 && L.y < 7 && Math.hypot(L.x - o.cx, L.z - o.cz) < 1.5);
      await QA.tp((o.cx - 6) + ',' + o.cz, { settle: 2 });
      await QA.spawnCar('sedan', { enter: true, dist: 0 });
      const c = G.P.car; c.x = o.cx - 6; c.z = o.cz; c.yaw = Math.PI / 2;
      const glowBefore = G.scene.children.some((m) => m.isMesh && m.material && m.material.map && m.geometry.attributes.position && m.geometry.attributes.position.count > 0 && Math.abs(m.geometry.attributes.position.count - (lights.filter((q) => q.y > 4.5 && q.i > 0 && !q.del).length * 6)) === 0);
      let n = 0; for (; n < 40 && !T.groups[g].broken; n++) { c.vx = 14; c.vz = 0; QA.step(1, { render: false }); }
      const cone = (() => { const m = G.scene.children.find((m) => m.geometry && m.geometry.attributes.aOn); return m && L && L._cone ? m.geometry.attributes.aOn.array[L._cone[0]] : null; })();
      const pools = G.scene.children.find((m) => m.isMesh && m.geometry.attributes.position && m.geometry.attributes.tanc && m.material.blending === 2 && m.geometry.attributes.position.count === lights.filter((q) => q.y > 4.5 && q.i > 0 && !q.del).length * 6);
      return { broken: !!T.groups[g].broken, frames: n, i: L && L.i, cone, pools: !!pools, glowBefore };
    });
    check('car knocks a street lamp over', lp.broken, lp);
    check('the lamp light goes out the moment it is hit', lp.i === 0 && lp.cone === 0, lp);
    check('its glow pool on the ground goes out too', lp.pools, lp);
    await S.js(() => window.QA.step(30, { render: false }));
    await shot('lamp-down-night', { hud: false });
    await S.js(() => window.QA.time(12, { freeze: true }));

    // hydrant: gushes ~60 s, then off
    const hy = await ram('hydrant');
    check('car breaks a hydrant', hy.broken, hy);
    const w = await S.js(() => {
      const QA = window.QA, B = window.__BRK, e = B.live.find((e) => e.kind === 'hydrant');
      QA.step(20, { render: false }); const at1 = !!e.water;
      const t50 = () => { while (e.t < 50) QA.step(20, { render: false }); return !!e.water; };
      const at50 = t50();
      while (e.t < 63) QA.step(20, { render: false });
      return { at1, at50, at63: !!e.water, shut: !!e.shut, t: e.t };
    });
    check('hydrant gushes for the first minute', w.at1 && w.at50, w);
    check('hydrant water is shut off after about a minute', !w.at63 && w.shut, w);
    await S.js(() => window.__G.P.car && window.QA.leaveCar());
  },
};
