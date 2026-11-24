// Lists colliders (buildings, fences, props) that sit on a curved road (edges touching flow-pass nodes).
// node tools/qa/qa.cjs run tools/qa/scenarios/road-overlap.cjs
module.exports = async ({ S, check, args }) => {
  const r = await S.js((all) => {
    const D = window.__dev, N = D.NODES, E = D.EDGES.filter((e) => all || N[e.a].flow !== undefined || N[e.b].flow !== undefined || N[e.a].arc || N[e.b].arc);
    const dist = (x, z, e) => { const A = N[e.a], B = N[e.b], ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / L2)); return Math.hypot(x - A.x - ex * t, z - A.z - ez * t); };
    const out = [];
    for (const m of D.TER.colModel) {
      const c = m.orig; if (c.water || c.poly) continue;
      let pts = [];
      if (c.r !== undefined) pts = [[c.cx, c.cz, c.r]];
      else if (c.ob) { for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5) pts.push([c.cx + a * c.hw * c.c - b * c.hd * c.s, c.cz + a * c.hw * c.s + b * c.hd * c.c, 0]); }
      else for (let a = 0; a <= 1; a += 0.25) for (let b = 0; b <= 1; b += 0.25) pts.push([c.x0 + (c.x1 - c.x0) * a, c.z0 + (c.z1 - c.z0) * b, 0]);
      for (const e of E) { if (pts.some(([x, z, rr]) => dist(x, z, e) < e.w / 2 + rr - 0.2)) { out.push({ at: [+(c.cx ?? (c.x0 + c.x1) / 2).toFixed(1), +(c.cz ?? (c.z0 + c.z1) / 2).toFixed(1)], kind: c.brk || (c.bld ? 'bld' : c.r !== undefined ? 'round r' + c.r : 'box'), h: c.h, edge: N[e.a].name + '-' + N[e.b].name }); break; } }
    }
    return out;
  }, !!args.all);
  for (const o of r) console.log(JSON.stringify(o));
  check('nothing solid on the curved roads', r.length === 0, r.length + ' hits');
};
