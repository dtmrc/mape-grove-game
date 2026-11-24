// Autopilot lap: drives the player's car round a named-node route at the limit a driver could hold (lateral grip ~9 m/s^2,
// braking 7 m/s^2), reports lap time and the slowest corners. Compare builds with --html.
// node tools/qa/qa.cjs run tools/qa/scenarios/lap.cjs [--car hatch] [--route town|country]
module.exports = async ({ S, args, log }) => {
  const ROUTES = {
    country: ['EW', 'CW3', 'CNW', 'CN0', 'HNJ', 'CN1', 'CN2', 'CNE', 'CE1', 'HEJ', 'HX', 'HE', 'M2', 'M1', 'X', 'B', 'G1', 'G3', 'G4', 'GW1', 'EW'],
    town: ['X', 'M1', 'S1', 'S2', 'A', 'B', 'X', 'D', 'P1', 'PC', 'P2', 'P4', 'E', 'D', 'X'],
    lake: ['X', 'W1', 'W2', 'W3', 'L2', 'L1', 'D', 'X'],
  };
  const route = ROUTES[args.route || 'country'];
  const r = await S.js(async ([route, car]) => {
    const D = window.__dev, N = D.NODES, E = D.EDGES, QA = window.QA, G = window.__G;
    const byName = (k) => N.findIndex((n) => n.name === k);
    const adj = N.map(() => []); for (const e of E) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
    const via = (s, t) => { const prev = new Map([[s, -1]]), q = [s]; while (q.length) { const i = q.shift(); if (i === t) break; for (const n of adj[i]) if (!prev.has(n) && (n === t || N[n].flow !== undefined)) { prev.set(n, i); q.push(n); } } const o = []; for (let i = t; i !== -1 && i !== undefined; i = prev.get(i)) o.unshift(i); return o; };
    const idx = [byName(route[0])]; for (let i = 0; i < route.length - 1; i++) idx.push(...via(byName(route[i]), byName(route[i + 1])).slice(1));
    const pts = idx.map((i) => [N[i].x, N[i].z]);
    // corner speed at every vertex: arcs from their own spacing, hard corners as a ~10 m lane-keeping turn
    const vmax = pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) return 40;
      const a = pts[i - 1], b = pts[i + 1], l1 = Math.hypot(p[0] - a[0], p[1] - a[1]), l2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
      let th = Math.abs(Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0])); if (th > Math.PI) th = 2 * Math.PI - th;
      if (th < 0.03) return 40;
      const R = th > 0.35 ? 10 : (l1 + l2) / 2 / th;
      return Math.sqrt(9 * R);
    });
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // spawn the car at the start, facing the first leg
    const yaw = Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    await QA.tp(`${pts[0][0]},${pts[0][1]}`);
    G.P.yaw = yaw; await QA.spawnCar(car, { x: pts[0][0], z: pts[0][1], yaw, enter: true });
    const c = G.P.car; c.x = pts[0][0]; c.z = pts[0][1]; c.yaw = yaw; c.fuel = 100; c.hp = 1000;
    QA.setManual && QA.setManual(true);
    let seg = 0, t = 0, hp0 = c.hp, keys = new Set(), offT = 0, minAt = [];
    const set = (k, on) => { if (on && !keys.has(k)) { QA.down(k); keys.add(k); } if (!on && keys.has(k)) { QA.up(k); keys.delete(k); } };
    const dt = 0.05, total = cum[cum.length - 1];
    let sMin = 99, sMinAt = null, prog = 0;
    while (t < 900) {
      // progress: nearest point on the next few segments
      let best = 1e9, bs = seg, bt = 0;
      for (let s = seg; s < Math.min(seg + 6, pts.length - 1); s++) {
        const A = pts[s], B = pts[s + 1], ex = B[0] - A[0], ez = B[1] - A[1], L2 = ex * ex + ez * ez || 1, u = Math.max(0, Math.min(1, ((c.x - A[0]) * ex + (c.z - A[1]) * ez) / L2));
        const d = Math.hypot(c.x - A[0] - ex * u, c.z - A[1] - ez * u); if (d < best) { best = d; bs = s; bt = u; }
      }
      seg = bs; prog = cum[seg] + bt * (cum[seg + 1] - cum[seg]);
      if (best > 7) offT += dt;
      if (prog > total - 3) break;
      // steer at a point ahead along the line (right-hand lane, 2.5 m off centre)
      const look = 5 + Math.abs(c.speed) * 0.55; let want = prog + look, s2 = seg; while (s2 < pts.length - 2 && cum[s2 + 1] < want) s2++;
      const A = pts[s2], B = pts[s2 + 1], L = cum[s2 + 1] - cum[s2] || 1, u = Math.min(1, (want - cum[s2]) / L), dx = (B[0] - A[0]) / L, dz = (B[1] - A[1]) / L;
      const tx = A[0] + (B[0] - A[0]) * u - dz * 2.5, tz = A[1] + (B[1] - A[1]) * u + dx * 2.5;
      let err = Math.atan2(tx - c.x, tz - c.z) - c.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
      // speed target: every vertex ahead within braking range
      let vt = 40; for (let i = seg + 1; i < pts.length && cum[i] - prog < 120; i++) vt = Math.min(vt, Math.sqrt(vmax[i] ** 2 + 2 * 7 * Math.max(0, cum[i] - prog - 2)));
      const v = c.speed;
      set('w', v < vt - 0.5); set('s', v > vt + 1.5);
      set('a', err > 0.04); set('d', err < -0.04);
      QA.step(1, { render: false }); t += dt;
      if (t > 3 && v < sMin) { sMin = v; sMinAt = [Math.round(c.x), Math.round(c.z)]; }
      if (Math.round(t / dt) % 20 === 0) minAt.push(+v.toFixed(1));
    }
    for (const k of [...keys]) set(k, false);
    return { route: route.join('>'), metres: Math.round(total), secs: +t.toFixed(1), avgMph: +((prog / t) * 2.237).toFixed(1), slowestMph: +(sMin * 2.237).toFixed(1), slowestAt: sMinAt, offRoadSecs: +offT.toFixed(1), damage: Math.round(hp0 - c.hp), finished: prog > total - 3 };
  }, [route, args.car || 'sedan']);
  log(JSON.stringify(r));
  return r;
};
