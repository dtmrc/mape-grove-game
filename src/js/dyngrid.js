// dyngrid.js: broad phase for things that move (cars, pedestrians), 2026-11-27.
// A uniform hash grid over x/z, refilled from the live list (O(n), no allocation once warm). A query returns the
// things in the cells a square touches, IN LIST ORDER, so a loop over the result visits the same things in the same
// order as the brute-force loop over the whole list it replaces (identical game behaviour, cost independent of how
// many things exist elsewhere on the map). The static world has its own grid in world.js (nearby / collide).
export function makeDynGrid(cell = 8) {
  const inv = 1 / cell, map = new Map(), used = [];
  const stats = { fills: 0, queries: 0, returned: 0 };
  const key = (i, j) => (i + 32768) * 65536 + (j + 32768);
  /** Refill from `list` (items need x and z). Call when positions have changed since the last fill. */
  function fill(list) {
    for (let i = 0; i < used.length; i++) used[i].length = 0;
    used.length = 0; stats.fills++;
    for (let i = 0; i < list.length; i++) {
      const o = list[i]; o._gi = i;
      const k = key(Math.floor(o.x * inv), Math.floor(o.z * inv));
      let l = map.get(k); if (!l) map.set(k, l = []);
      if (!l.length) used.push(l);
      l.push(o);
    }
  }
  /** Everything whose cell touches the square (x ± r, z ± r), sorted by list index. `out` is reused: pass your own
   *  array when you query again inside the loop over a result. Do the exact distance test yourself. */
  function near(x, z, r, out = _out) {
    out.length = 0; stats.queries++;
    const i0 = Math.floor((x - r) * inv), i1 = Math.floor((x + r) * inv), j0 = Math.floor((z - r) * inv), j1 = Math.floor((z + r) * inv);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = map.get(key(i, j)); if (!l) continue;
      for (let k = 0; k < l.length; k++) out.push(l[k]);
    }
    // insertion sort by list index (results are a handful of items)
    for (let a = 1; a < out.length; a++) { const o = out[a], gi = o._gi; let b = a - 1; while (b >= 0 && out[b]._gi > gi) { out[b + 1] = out[b]; b--; } out[b + 1] = o; }
    stats.returned += out.length;
    return out;
  }
  const _out = [];
  return { fill, near, stats, cell };
}
