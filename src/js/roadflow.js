// roadflow.js - turns the hand-laid road graph (straight segments meeting at sharp corners) into flowing roads.
// (roads thread, 2026-11-24, diet: "driving is sluggish with all the tight turns")
//
// Every corner gets a circular fillet: the corner node slides onto the middle of the arc (so N.X etc. still name it and
// side roads still meet it), and new arc nodes are appended after every existing node (saved graphs index the old ones).
// At junctions only the main pair of roads is curved (highest road class, then the straightest pair); side roads join
// the curve's middle as a T. Straight-through crossings (main pair turning < MIN_TURN) are left alone.
//
// Radii are a wish per road class, capped so two fillets on one segment never overlap (tangent <= SHARE x segment).

export const FLOW = {
  R: { hwy: 95, county: 80, paved: 38, dirt: 28, estate: 20 },   // wished-for centre-line radius (m)
  MIN_TURN: 12,          // degrees: smaller bends stay as they are
  SHARE: 0.46,           // max share of a segment one fillet's tangent may use
  STEP: 9,               // degrees per arc segment (smooth enough for the 9-12 m wide ribbon)
  SKIP: new Set(),       // node names to leave sharp (dead-end bulbs, gates...)
  RMAX: { P2: 12 },            // per-corner radius caps (name -> metres) where buildings sit close inside a corner
};

const RANK = { hwy: 5, county: 4, paved: 3, estate: 2, dirt: 1, path: 0, walk: 0 };
export const roadClass = (e) => {
  const t = e.t || (e.dirt ? 'dirt' : 'paved');
  if (t === 'paved' && e.sw) return 'estate';
  if (t === 'paved' && (e.county || e.w === 9)) return 'county';
  return t;
};

/**
 * Fillet the graph in place. NODES [{x,z,name}], EDGES [{a,b,w,t,...}], ADJ rebuilt by the caller (or pass relink).
 * Returns a report: [{name, turn, R, t}] per fillet.
 */
export function flowRoads(NODES, EDGES, o = {}) {
  const F = { ...FLOW, ...o, R: { ...FLOW.R, ...(o.R || {}) } };
  const inc = NODES.map(() => []);
  EDGES.forEach((e, k) => { inc[e.a].push(k); inc[e.b].push(k); });
  const other = (k, i) => (EDGES[k].a === i ? EDGES[k].b : EDGES[k].a);
  const P0 = NODES.map((n) => [n.x, n.z]);   // geometry from the original corners, even after earlier fillets move them
  const dir = (i, j) => { const dx = P0[j][0] - P0[i][0], dz = P0[j][1] - P0[i][1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L, L]; };
  const plan = [];
  NODES.forEach((n, i) => {
    const L = inc[i].filter((k) => { const c = roadClass(EDGES[k]); return c !== 'path' && c !== 'walk'; });
    if (L.length < 2 || n.dead || n.bulb || F.SKIP.has(n.name)) return;
    let best = null;
    for (let p = 0; p < L.length; p++) for (let q = p + 1; q < L.length; q++) {
      const ea = EDGES[L[p]], eb = EDGES[L[q]];
      const [ax, az] = dir(i, other(L[p], i)), [bx, bz] = dir(i, other(L[q], i));
      const turn = 180 - Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz))) * 180 / Math.PI;
      const ra = RANK[roadClass(ea)], rb = RANK[roadClass(eb)];
      const score = Math.min(ra, rb) * 1000 + (ra === rb ? 60 : 0) - turn;
      if (!best || score > best.score) best = { p: L[p], q: L[q], turn, score };
    }
    if (!best || best.turn < F.MIN_TURN) return;
    // crossroads (4+ legs) stay square: Main St runs straight through downtown, the Estates grid crosses square
    if (L.length >= 4) return;
    plan.push({ i, ...best, side: L.filter((k) => k !== best.p && k !== best.q) });
  });
  // how many fillets touch each edge (a segment shared by two fillets gives each at most SHARE of it)
  const uses = new Map(); for (const f of plan) for (const k of [f.p, f.q]) uses.set(k, (uses.get(k) || 0) + 1);
  const report = [];
  const attach = new Map();   // `${edge}:${node}` -> replacement end node
  const add = [];             // new edges
  for (const f of plan) {
    const n = NODES[f.i], ka = f.p, kb = f.q, a = other(ka, f.i), b = other(kb, f.i);
    const [ax, az, La] = dir(f.i, a), [bx, bz, Lb] = dir(f.i, b);
    const half = (f.turn / 2) * Math.PI / 180, tanH = Math.tan(half);
    const cls = RANK[roadClass(EDGES[ka])] >= RANK[roadClass(EDGES[kb])] ? roadClass(EDGES[ka]) : roadClass(EDGES[kb]);
    const cap = Math.min(La * (uses.get(ka) > 1 ? F.SHARE : 0.9), Lb * (uses.get(kb) > 1 ? F.SHARE : 0.9));
    const t = Math.min(Math.min(F.R[cls], F.RMAX[n.name] ?? 1e9) * tanH, cap), R = t / tanH;
    const [ox, oz] = P0[f.i], T1 = [ox + ax * t, oz + az * t], T2 = [ox + bx * t, oz + bz * t];
    // arc centre: along the bisector, R / cos(half) from the corner
    let mx = ax + bx, mz = az + bz; const mL = Math.hypot(mx, mz) || 1; mx /= mL; mz /= mL;
    const dC = R / Math.cos(half), cx = ox + mx * dC, cz = oz + mz * dC;
    const a1 = Math.atan2(T1[1] - cz, T1[0] - cx); let a2 = Math.atan2(T2[1] - cz, T2[0] - cx);
    let da = a2 - a1; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    // about one segment per STEP degrees, but none shorter than ~4.5 m (traffic AI steps lane by lane); even count so
    // the corner node sits in the middle
    const degs = Math.abs(da) * 180 / Math.PI, arcLen = Math.abs(da) * R;
    const seg = 2 * Math.max(1, Math.ceil(Math.min(degs / F.STEP, arcLen / 4.5) / 2));
    const chain = [];
    for (let s = 0; s <= seg; s++) {
      const ang = a1 + da * s / seg, x = cx + Math.cos(ang) * R, z = cz + Math.sin(ang) * R;
      if (s === seg / 2) { n.x = +x.toFixed(2); n.z = +z.toFixed(2); n.arc = { R: +R.toFixed(1), turn: +f.turn.toFixed(1) }; chain.push(f.i); }
      else { NODES.push({ x: +x.toFixed(2), z: +z.toFixed(2), name: `${n.name}~${s}`, flow: f.i }); chain.push(NODES.length - 1); }
    }
    attach.set(`${ka}:${f.i}`, chain[0]); attach.set(`${kb}:${f.i}`, chain[chain.length - 1]);
    // a side road keeps its own line up to the old corner, then a short stub meets the curve square-on at its middle
    for (const k of f.side) {
      NODES.push({ x: ox, z: oz, name: `${n.name}^${k}`, flow: f.i }); const st = NODES.length - 1;
      attach.set(`${k}:${f.i}`, st);
      const { a: _a, b: _b, ...r } = EDGES[k]; add.push({ a: st, b: f.i, ...r });
    }
    const props = (k) => { const { a: _a, b: _b, ...r } = EDGES[k]; return r; };
    for (let s = 0; s < seg; s++) add.push({ a: chain[s], b: chain[s + 1], ...props(s < seg / 2 ? ka : kb) });
    report.push({ name: n.name, turn: +f.turn.toFixed(0), R: +R.toFixed(0), wish: F.R[cls], cls });
  }
  for (const [k, e] of EDGES.entries()) {
    const na = attach.get(`${k}:${e.a}`), nb = attach.get(`${k}:${e.b}`);
    if (na !== undefined) e.a = na; if (nb !== undefined) e.b = nb;
  }
  EDGES.push(...add);
  return report;
}

/**
 * Who stops at a junction. list = [{o: other node, e: edge-like {t, w, sw, county, nt}}], N = the junction node.
 * - 4+ legs with 3+ main roads (hwy / county / paved): traffic light
 * - otherwise the main pair (best ranked, then straightest) runs free and every other leg stops (two-way stop),
 *   unless a 4-way has no clear main pair (all legs the same rank): all-way stop.
 * Returns null for plain bends / dead ends, else { kind: 'light'|'yield'|'stop', free: Set(other nodes that never stop) }.
 */
export function junctionControl(N, list, NODES) {
  const es = list.filter((a) => { const c = roadClass(a.e); return !a.e.nt && c !== 'path' && c !== 'walk'; });
  if (es.length < 3) return null;
  const rank = (a) => RANK[roadClass(a.e)];
  const mains = es.filter((a) => rank(a) >= 3).length;
  if (N.ctl) return { kind: N.ctl, free: new Set() };
  if (es.length >= 4 && mains >= 3) return { kind: 'light', free: new Set() };
  const dirOf = (a) => { const B = NODES[a.o], dx = B.x - N.x, dz = B.z - N.z, L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
  let best = null;
  for (let p = 0; p < es.length; p++) for (let q = p + 1; q < es.length; q++) {
    const [ax, az] = dirOf(es[p]), [bx, bz] = dirOf(es[q]);
    const turn = 180 - Math.acos(Math.max(-1, Math.min(1, ax * bx + az * bz))) * 180 / Math.PI;
    const ra = rank(es[p]), rb = rank(es[q]), score = Math.min(ra, rb) * 1000 + (ra === rb ? 60 : 0) - turn;
    if (!best || score > best.score) best = { a: es[p], b: es[q], score, min: Math.min(ra, rb), turn };
  }
  const rest = es.filter((a) => a !== best.a && a !== best.b);
  if (es.length >= 4 && rest.some((a) => rank(a) >= best.min) && best.turn < 30) return { kind: 'stop', free: new Set() };
  return { kind: 'yield', free: new Set([best.a.o, best.b.o]) };
}
