// Crease-angle smoothed normals for a non-indexed geometry: faces meeting at less than `deg` share a normal,
// sharper edges stay hard. Used by build.cjs (so the baked lighting is smooth) and the preview.
// eslint-disable-next-line no-unused-vars
function smoothNormals(T, g, deg = 42) {
  const pos = g.getAttribute('position'), n = pos.count, cos = Math.cos((deg * Math.PI) / 180);
  const idx = g.index ? g.index.array : null, tri = idx ? idx.length / 3 : n / 3, vi = (k) => (idx ? idx[k] : k);
  const fn = new Float32Array(tri * 3), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const groups = new Map(), q = (v) => Math.round(v * 2e4);
  for (let t = 0; t < tri; t++) {
    a.fromBufferAttribute(pos, vi(t * 3)); b.fromBufferAttribute(pos, vi(t * 3 + 1)); c.fromBufferAttribute(pos, vi(t * 3 + 2));
    const nn = c.clone().sub(b).cross(a.clone().sub(b));   // area-weighted
    fn[t * 3] = nn.x; fn[t * 3 + 1] = nn.y; fn[t * 3 + 2] = nn.z;
    for (let e = 0; e < 3; e++) { const v = vi(t * 3 + e), k = q(pos.getX(v)) + ',' + q(pos.getY(v)) + ',' + q(pos.getZ(v)); let l = groups.get(k); if (!l) groups.set(k, (l = [])); l.push(t * 3 + e); }
  }
  const out = new Float32Array((idx ? pos.count : n) * 3), unit = (t) => { const x = fn[t * 3], y = fn[t * 3 + 1], z = fn[t * 3 + 2], L = Math.hypot(x, y, z) || 1; return [x / L, y / L, z / L]; };
  for (const l of groups.values()) for (const k of l) {
    const t = (k / 3) | 0, u = unit(t); let sx = 0, sy = 0, sz = 0;
    for (const m of l) { const s = (m / 3) | 0, w = unit(s); if (u[0] * w[0] + u[1] * w[1] + u[2] * w[2] >= cos) { sx += fn[s * 3]; sy += fn[s * 3 + 1]; sz += fn[s * 3 + 2]; } }
    const L = Math.hypot(sx, sy, sz) || 1, v = vi(k); out[v * 3] = sx / L; out[v * 3 + 1] = sy / L; out[v * 3 + 2] = sz / L;
  }
  g.setAttribute('normal', new T.BufferAttribute(out, 3));
  return g;
}
