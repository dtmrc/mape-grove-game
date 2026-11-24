() => {
  // Illustrated map of the whole play area (town + countryside), drawn from the live world data.
  // Needs a debug build exposing window.__W (world.js with __mapdata) and window.__TER (terrain.js); see README.md.
  const W = window.__W, TER = window.__TER, P = W.places, D = W.__mapdata;
  const LIM = W.LIMIT, H = LIM + 14;                   // world half-size shown (a strip of the edge woods past the wall)
  const S = 3000, M = 110;                              // map square px, frame margin
  const k = (S - 2 * M) / (2 * H), o = (v) => M + (v + H) * k;
  const PANEL = 760, c = document.createElement('canvas'); c.width = S + PANEL; c.height = S; const g = c.getContext('2d');
  let seed = 11; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const path = (pts, close = true) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(o(x), o(z)) : g.moveTo(o(x), o(z)))); if (close) g.closePath(); };
  // parchment
  g.fillStyle = '#e9dcb8'; g.fillRect(0, 0, c.width, S);
  for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(120,90,40,${R() * 0.06})`; g.fillRect(R() * c.width, R() * S, 2 + R() * 4, 2 + R() * 4); }
  g.save(); g.beginPath(); g.rect(M, M, S - 2 * M, S - 2 * M); g.clip();
  // land, shaded by the real terrain (light from the north-west)
  {
    const N = 440, img = g.createImageData(N, N), step = (2 * H) / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -H + (i + 0.5) * step, z = -H + (j + 0.5) * step, h = TER.heightAt(x, z);
      const dx = TER.heightAt(x + 2, z) - TER.heightAt(x - 2, z), dz = TER.heightAt(x, z + 2) - TER.heightAt(x, z - 2);
      const sh = Math.max(-1, Math.min(1, (-dx - dz) * 0.55)), e = Math.max(-1, Math.min(1, h / 9));
      const r = 152 + sh * 34 + e * 12, gg = 192 + sh * 30 + e * 8, b = 116 + sh * 22 - e * 6, q = (j * N + i) * 4;
      img.data[q] = r; img.data[q + 1] = gg; img.data[q + 2] = b; img.data[q + 3] = 255;
    }
    const tc = document.createElement('canvas'); tc.width = tc.height = N; tc.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(tc, M, M, S - 2 * M, S - 2 * M);
  }
  for (let i = 0; i < 2600; i++) { g.fillStyle = R() < 0.5 ? 'rgba(70,120,50,0.08)' : 'rgba(220,240,170,0.10)'; const r = 6 + R() * 24; g.beginPath(); g.arc(M + R() * (S - 2 * M), M + R() * (S - 2 * M), r, 0, 7); g.fill(); }
  // outside the play area: the edge woods
  g.fillStyle = 'rgba(40,70,44,0.78)';
  g.fillRect(M, M, S - 2 * M, o(-LIM) - M); g.fillRect(M, o(LIM), S - 2 * M, S - M - o(LIM)); g.fillRect(M, M, o(-LIM) - M, S - 2 * M); g.fillRect(o(LIM), M, S - M - o(LIM), S - 2 * M);
  // fields (painted farmland) with rows
  for (const f of D.FIELDS) {
    g.save(); g.translate(o(f.x), o(f.z)); g.rotate(-f.ry);
    g.fillStyle = f.kind === 'plow' ? '#b48a5e' : f.kind === 'wheat' ? '#dcc46c' : '#b6c47a';
    g.fillRect(-f.w / 2 * k, -f.d / 2 * k, f.w * k, f.d * k);
    g.strokeStyle = f.kind === 'plow' ? 'rgba(90,60,30,0.45)' : f.kind === 'wheat' ? 'rgba(150,120,40,0.45)' : 'rgba(90,120,50,0.35)'; g.lineWidth = 2;
    for (let z = -f.d / 2 + 2; z < f.d / 2; z += f.kind === 'meadow' ? 6 : 3) { g.beginPath(); g.moveTo(-f.w / 2 * k + 3, z * k); g.lineTo(f.w / 2 * k - 3, z * k); g.stroke(); }
    g.restore();
  }
  // town map shapes (forest floor, lots, park, farm, school, lake) as the minimap has them
  for (const m of D.MAP) {
    if (m.t === 'poly' && (m.col === '#1f3a24' || m.col === '#284a2c')) { path(m.pts); g.fillStyle = m.col === '#1f3a24' ? '#4f6e4a' : 'rgba(70,104,66,0.75)'; g.fill(); }
    if (m.t === 'poly' && m.col === '#2e5230') { path(m.pts); g.fillStyle = 'rgba(78,120,64,0.55)'; g.fill(); }
  }
  for (const m of D.MAP) {
    if (m.t !== 'rect' || D.FIELDS.some((f) => f.x === m.x && f.z === m.z)) continue;
    const col = { '#6a6a70': '#b9b4aa', '#8a8478': '#cbbf9e', '#8a6a48': '#c9a26f', '#4f6a46': '#8fae78', '#8a8a40': '#d8c46a', '#9a5a40': '#c8765a', '#4f9a40': '#6fbf55', '#4f8a40': '#86c06a', '#4a4a52': '#6a6a72' }[m.col] || m.col;
    g.save(); g.translate(o(m.x), o(m.z)); g.rotate(-m.ry); g.fillStyle = col; g.fillRect(-m.w / 2 * k, -m.d / 2 * k, m.w * k, m.d * k); g.restore();
  }
  const lake = D.MAP.find((m) => m.t === 'poly' && m.col === '#4a8ac8');
  if (lake) {
    const cx = -35, cz = 92, sc = (s) => lake.pts.map(([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]);
    path(sc(1.1)); g.fillStyle = '#e4d39c'; g.fill(); path(sc(1.0)); g.fillStyle = '#5b9fd6'; g.fill(); path(sc(0.7)); g.fillStyle = '#4a8ac8'; g.fill(); path(sc(0.4)); g.fillStyle = '#3f7cba'; g.fill();
  }
  // the old town limits
  g.setLineDash([18, 12]); g.strokeStyle = 'rgba(90,58,26,0.55)'; g.lineWidth = 4; g.strokeRect(o(-150), o(-130), 300 * k, 280 * k); g.setLineDash([]);
  // roads: casing then surface, dirt under paved under highway
  const E = W.EDGES, NO = W.NODES, base = NO.findIndex((n) => n.name === 'HNJ');
  const T = (e) => e.t || (e.dirt ? 'dirt' : 'paved');
  const seg = (e, w, col, dash) => { const A = NO[e.a], B = NO[e.b]; g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.moveTo(o(A.x), o(A.z)); g.lineTo(o(B.x), o(B.z)); g.stroke(); g.setLineDash([]); };
  g.lineCap = g.lineJoin = 'round';
  const order = ['path', 'walk', 'dirt', 'paved', 'hwy'];
  for (const t of order) for (const e of E) if (T(e) === t) seg(e, (e.w + 2) * k, t === 'dirt' ? '#8a6a40' : '#f4f0e4');
  for (const t of order) for (const e of E) if (T(e) === t) seg(e, e.w * k, t === 'dirt' ? '#d4b27c' : t === 'hwy' ? '#4a4a52' : '#5c5c64');
  for (const n of NO) if (n.bulb) { g.fillStyle = '#5c5c64'; g.beginPath(); g.arc(o(n.x), o(n.z), n.bulb * k, 0, 7); g.fill(); }
  for (const e of E) { const t = T(e); if (t === 'hwy') { seg(e, 0.5 * k, '#e8c040'); } else if (t === 'paved' && !e.nt) seg(e, 0.3 * k, '#e8c040', [16, 14]); }
  // trees
  const inForest = W.inWoods || ((x, z) => (x < -114 && z > -40) || (z > 119 && x < 48));
  const trees = W.colliders.filter((q) => q.tree).sort((a, b) => a.cz - b.cz);
  for (const t of trees) {
    const r = Math.max(1.8, t.r * 5) * k, x = o(t.cx), y = o(t.cz), haunted = inForest(t.cx, t.cz);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.3, r, r * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = haunted ? (R() < 0.5 ? '#2f4a3a' : '#3a5444') : (R() < 0.5 ? '#4f8a3a' : '#5e9a44');
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = haunted ? 'rgba(160,140,200,0.18)' : 'rgba(220,255,170,0.32)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); g.fill();
  }
  // hills in Hollow Woods: hillshade + 4 m contour hints over the canopy, so the relief reads through the trees
  if (W.inWoods) {
    const N = 600, img = g.createImageData(N, N), step = (2 * H) / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -H + (i + 0.5) * step, z = -H + (j + 0.5) * step, q = (j * N + i) * 4;
      if (!W.inWoods(x, z)) continue;
      const h = TER.heightAt(x, z), dx = TER.heightAt(x + 2, z) - TER.heightAt(x - 2, z), dz = TER.heightAt(x, z + 2) - TER.heightAt(x, z - 2);
      const sh = Math.max(-1, Math.min(1, (-dx - dz) * 0.35)), band = Math.abs(((h % 4) + 4) % 4 - 2) < 0.18 * (1 + Math.hypot(dx, dz) * 0.25);
      if (band) { img.data[q] = 20; img.data[q + 1] = 30; img.data[q + 2] = 18; img.data[q + 3] = 70; continue; }
      const sl = Math.hypot(dx, dz) / 4;
      if (sl > 0.75) { const t = Math.min(1, (sl - 0.75) / 0.4), v = sh > 0 ? 190 : 120; img.data[q] = v; img.data[q + 1] = v - 6; img.data[q + 2] = v - 16; img.data[q + 3] = Math.round(120 + 110 * t); continue; }   // bare rock
      const v = sh > 0 ? 255 : 0; img.data[q] = v; img.data[q + 1] = v; img.data[q + 2] = sh > 0 ? 220 : 10; img.data[q + 3] = Math.round(Math.abs(sh) * 120);
    }
    const tc = document.createElement('canvas'); tc.width = tc.height = N; tc.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(tc, M, M, S - 2 * M, S - 2 * M);
  }
  // map lines over the canopy: the ravine (dark gash) and the Hollow Woods Trail (dashed)
  for (const m of D.MAP) if (m.t === 'line' && m.col !== '#8a7050') { const water = m.col === '#4f86b8'; g.strokeStyle = water ? '#5aa0e0' : m.col === '#3a3024' ? 'rgba(42,32,24,0.55)' : 'rgba(90,74,58,0.55)'; g.lineWidth = m.w * (water ? 1.4 : 1.6) * k; g.lineCap = 'round'; path(m.pts, false); g.stroke(); }
  for (const m of D.MAP) if (m.t === 'line' && m.col === '#8a7050') { g.setLineDash([12, 9]); g.strokeStyle = '#e0bf86'; g.lineWidth = 3 * k; g.lineCap = 'round'; path(m.pts, false); g.stroke(); g.setLineDash([]); }
  // buildings (the town's; the countryside has none)
  g.fillStyle = '#d8cca8';
  for (const q of W.colliders) {
    if (!q.bld) continue;
    g.save();
    if (q.ob) { g.translate(o(q.cx), o(q.cz)); g.rotate(Math.atan2(-q.s, q.c)); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-q.hw * k + 5, -q.hd * k + 6, q.hw * 2 * k, q.hd * 2 * k); g.fillStyle = '#c9b48e'; g.fillRect(-q.hw * k, -q.hd * k, q.hw * 2 * k, q.hd * 2 * k); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(-q.hw * k, -q.hd * k, q.hw * 2 * k, q.hd * 2 * k); }
    else { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(o(q.x0) + 5, o(q.z0) + 6, (q.x1 - q.x0) * k, (q.z1 - q.z0) * k); g.fillStyle = '#c9b48e'; g.fillRect(o(q.x0), o(q.z0), (q.x1 - q.x0) * k, (q.z1 - q.z0) * k); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(o(q.x0), o(q.z0), (q.x1 - q.x0) * k, (q.z1 - q.z0) * k); }
    g.restore();
  }
  // road closures at the edge
  const bar = (p) => { g.fillStyle = '#f07a20'; g.strokeStyle = '#3a1a08'; g.lineWidth = 3; g.beginPath(); g.arc(o(p.x), o(p.z), 16, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(o(p.x) - 10, o(p.z) - 3, 20, 6); };
  bar(P.exitNorth); bar(P.exitEast); bar(P.exitSouth);
  g.restore();

  // ---- labels ----
  const label = (t, x, z, size, col = '#fff', font = 'bold', stroke = 'rgba(30,20,10,0.9)') => {
    g.font = `${font} ${size}px Georgia, "DejaVu Serif", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(t, o(x), o(z)); g.fillStyle = col; g.fillText(t, o(x), o(z));
  };
  label('SAWYER FIELDS', 30, -262, 46, '#fff2c0'); label('DRY CREEK FLATS', 205, -110, 40, '#fff2c0');
  label('JUNIPER BOTTOMS', -40, 270, 46, '#fff2c0'); label('BLACKTHORN RIDGE', -205, -228, 30, '#fff2c0'); label('ESTATES', -176, -24, 30, '#fff2c0'); label('PHASE II', -176, -8, 26, '#fff2c0', 'italic');
  label('MAPLE GROVE', 4, -48, 44, '#fff2c0'); label('(town)', 4, -36, 28, '#fff2c0', 'italic');
  label('HOLLOW WOODS', -170, 150, 48, '#e6d4ff'); label('(haunted)', -170, 170, 28, '#e6d4ff', 'italic'); label('Hollow Woods Trail', -150, 228, 24, '#f0e0b0', 'italic'); label('THE RAVINE', -262, 246, 26, '#e6d4ff'); label('Juniper Creek', -118, 176, 22, '#cfe8ff', 'italic'); if (D.FORD) label('ford', D.FORD.x + 14, D.FORD.z - 6, 20, '#f0e0b0', 'italic'); label('LAKE JUNIPER', -36, 92, 30, '#eaf6ff');
  label('Town limits (old map)', -95, -136, 22, '#f4e4c0', 'italic');
  const rl = (t, x, z, ang, col = '#fff', sz = 24) => { g.save(); g.translate(o(x), o(z)); g.rotate(ang); g.font = `italic bold ${sz}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = 'rgba(30,20,10,0.85)'; g.strokeText(t, 0, 1); g.fillStyle = col; g.fillText(t, 0, 1); g.restore(); };
  const along = (a, b, t, txt, off = 0, col) => { const A = NO[W.__mapdata.N[a]], B = NO[W.__mapdata.N[b]]; let ang = Math.atan2(B.z - A.z, B.x - A.x); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; const x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t; rl(txt, x - Math.sin(ang) * off, z + Math.cos(ang) * off, ang, col); };
  const NEW = '#fff6a0';
  along('CN1', 'CN2', 0.5, 'County Rd 12', -12, NEW); along('CN0', 'HNJ', 0.5, 'County Rd 12', -12, NEW);
  along('CE1', 'HEJ', 0.5, 'County Rd 12', 14, NEW); along('CNW', 'CW3', 0.5, 'County Rd 12 (gravel)', -12, NEW);
  along('HNJ', 'HNE', 0.5, 'Hwy 9', 14, NEW); along('HEJ', 'HEE', 0.45, 'Hwy 9', -14, NEW); along('OMJ', 'OMS', 0.5, 'Old Mill Rd', -14, NEW); along('F', 'OMJ', 0.5, 'Old Mill Rd', -14, NEW);
  along('SN', 'CN1', 0.5, 'Sawyer Farm Rd', 13, NEW); along('PE', 'CE2', 0.5, 'Hollow Ln', -12, NEW); along('EW', 'CW3', 0.62, 'Estates Pkwy', -12, NEW); along('GW1', 'MC', 0.5, 'Magnolia Ct', 12, NEW); along('EW', 'AC', 0.75, 'Aspen Ct', -12, NEW); along('WW1', 'WW2', 0.5, 'Willow Way', 12, NEW); along('WW1', 'BC', 0.5, 'Birch Ct', 12, NEW);
  along('X', 'M1', 0.5, 'Main St', 0); along('M2', 'HE', 0.1, 'Hwy 9', 0);
  // numbered pins
  const pins = [
    [P.rv, 'RV (home & save)', '#2ab0e0'], [P.nana, "Nana's farmhouse", '#e8b030'], [P.church, 'Maple Grove Chapel', '#e8b030'], [P.quik, 'Quik Stop', '#e05040'], [P.pizza, 'Pizza City', '#e0a020'],
    [P.wash, 'Suds N Paws', '#3a8ad8'], [P.donut, 'Donut Hole', '#e070a0'], [P.gary, "Gary's mansion", '#2a3a6a'], [P.feed, 'Feed & Seed', '#b03a2a'],
    [P.school, 'Maple Grove High', '#a85a48'], [P.park, 'Lakeside Park', '#5a9a40'], [P.clearing, 'Ruined cabin clearing', '#9a6ad0'], [P.station, 'Police station', '#3a5a9a'], [P.fireStation, 'Fire station (VFD)', '#d02a2a'], [P.hospital, 'Community Hospital', '#2a8ad0'],
    [P.exitNorth, 'Hwy 9 closed (north edge)', '#f07a20'], [P.exitEast, 'Hwy 9 closed (east edge)', '#f07a20'], [P.exitSouth, 'Old Mill Rd: bridge out', '#f07a20'],
  ].filter(([p]) => p);
  pins.forEach(([p, , col], i) => {
    const x = o(p.x), y = o(p.z) - 30;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + 3, o(p.z) + 2, 10, 5, 0, 0, 7); g.fill();
    g.fillStyle = col; g.strokeStyle = '#1a1208'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, o(p.z)); g.lineTo(x - 13, y + 8); g.arc(x, y, 20, Math.PI * 0.75, Math.PI * 0.25); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), x, y + 1);
  });
  // frame
  g.strokeStyle = '#5a3a1a'; g.lineWidth = 10; g.strokeRect(M - 6, M - 6, S - 2 * M + 12, S - 2 * M + 12);
  g.strokeStyle = '#a07a4a'; g.lineWidth = 3; g.strokeRect(M - 22, M - 22, S - 2 * M + 44, S - 2 * M + 44);
  // side panel: title, legend, road key, new roads
  const lx = S + 10, W2 = PANEL - 50;
  g.textAlign = 'center'; g.fillStyle = '#4a2a10'; g.font = 'bold 66px Georgia, serif'; g.fillText('MAPLE GROVE', lx + W2 / 2, M + 40);
  g.font = 'italic 32px Georgia, serif'; g.fillText('Off Leash  -  Town & Countryside', lx + W2 / 2, M + 92);
  g.font = '24px Georgia, serif'; g.fillText(`Play area ${2 * LIM} m x ${2 * LIM} m (was ~290 m)`, lx + W2 / 2, M + 130);
  let ly = M + 170;
  const box = (h) => { g.fillStyle = 'rgba(244,234,206,0.94)'; g.strokeStyle = '#5a3a1a'; g.lineWidth = 4; g.fillRect(lx, ly, W2, h); g.strokeRect(lx, ly, W2, h); };
  box(pins.length * 42 + 80); g.fillStyle = '#4a2a10'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'left'; g.fillText('LEGEND', lx + 20, ly + 36);
  pins.forEach(([, name, col], i) => {
    const y = ly + 78 + i * 42;
    g.fillStyle = col; g.beginPath(); g.arc(lx + 36, y, 16, 0, 7); g.fill(); g.strokeStyle = '#1a1208'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 19px Georgia, serif'; g.textAlign = 'center'; g.fillText(String(i + 1), lx + 36, y + 1);
    g.fillStyle = '#2a1a08'; g.font = '27px Georgia, serif'; g.textAlign = 'left'; g.fillText(name, lx + 64, y + 1);
  });
  ly += pins.length * 42 + 110;
  box(250);
  const key = (y, w, col, casing, txt, dash) => { g.lineCap = 'butt'; g.strokeStyle = casing; g.lineWidth = w + 6; g.beginPath(); g.moveTo(lx + 20, y); g.lineTo(lx + 120, y); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(lx + 20, y); g.lineTo(lx + 120, y); g.stroke(); if (dash) { g.strokeStyle = dash; g.lineWidth = 3; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(lx + 20, y); g.lineTo(lx + 120, y); g.stroke(); g.setLineDash([]); } g.fillStyle = '#2a1a08'; g.font = '24px Georgia, serif'; g.textAlign = 'left'; g.fillText(txt, lx + 140, y + 1); };
  key(ly + 32, 20, '#4a4a52', '#f4f0e4', 'Highway 9', '#e8c040'); key(ly + 72, 16, '#5c5c64', '#f4f0e4', 'Paved road', '#e8c040'); key(ly + 112, 12, '#d4b27c', '#8a6a40', 'Dirt / gravel road');
  const sw = (y, col, txt) => { g.fillStyle = col; g.fillRect(lx + 20, y - 12, 100, 24); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.strokeRect(lx + 20, y - 12, 100, 24); g.fillStyle = '#2a1a08'; g.font = '24px Georgia, serif'; g.fillText(txt, lx + 140, y + 1); };
  sw(ly + 152, '#b48a5e', 'Plowed field'); sw(ly + 188, '#dcc46c', 'Wheat / hay field'); sw(ly + 224, 'rgba(40,70,44,0.85)', 'Edge woods (out of bounds)');
  ly += 280;
  const NEWROADS = [
    'County Rd 12: loop around town (paved N + E,', '   gravel S + W), ~1.9 km',
    'Hwy 9 north + east: open to the map edge', 'Old Mill Rd: south to the bridge-out',
    'Sawyer Farm Rd: School Rd north to Co Rd 12', 'Hollow Ln: Pine Hollow east to Co Rd 12',
    'Estates Pkwy + Magnolia, Aspen, Birch Ct and', '   Willow Way: Estates Phase II, 25 new homes',
    'Lake Rd: X-L1 leg removed (no more triangle)',
    'Co Rd 12 through Hollow Woods removed;', '   Hollow Woods Trail loop instead (on foot)',
    'Juniper Creek: Lake Juniper to the ravine,', '   ford on the trail, falls into the ravine',
  ];
  box(NEWROADS.length * 36 + 76); g.fillStyle = '#4a2a10'; g.font = 'bold 32px Georgia, serif'; g.textAlign = 'left'; g.fillText('NEW ROADS', lx + 20, ly + 36);
  g.fillStyle = '#2a1a08'; g.font = '23px Georgia, serif'; NEWROADS.forEach((t, i) => g.fillText(t, lx + 22, ly + 78 + i * 36));
  // compass + scale
  const cxp = M + 120, cyp = M + 130;
  g.save(); g.translate(cxp, cyp); g.fillStyle = 'rgba(244,234,206,0.92)'; g.beginPath(); g.arc(0, 0, 76, 0, 7); g.fill(); g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.stroke();
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = i % 2 ? '#5a3a1a' : '#a07a4a'; g.beginPath(); g.moveTo(0, -62); g.lineTo(12, 0); g.lineTo(-12, 0); g.closePath(); g.fill(); }
  g.fillStyle = '#4a2a10'; g.font = 'bold 28px Georgia, serif'; g.textAlign = 'center'; g.fillText('N', 0, -48); g.restore();
  const sx = M + 40, sy = S - M - 40;
  g.fillStyle = 'rgba(244,234,206,0.92)'; g.fillRect(sx - 16, sy - 44, 100 * k + 40, 66);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f4ead0' : '#4a2a10'; g.fillRect(sx + i * 25 * k, sy, 25 * k, 12); }
  g.strokeStyle = '#4a2a10'; g.lineWidth = 2; g.strokeRect(sx, sy, 100 * k, 12);
  g.fillStyle = '#4a2a10'; g.font = '20px Georgia, serif'; g.textAlign = 'left'; g.fillText('0', sx - 4, sy - 16); g.textAlign = 'right'; g.fillText('100 m', sx + 100 * k + 14, sy - 16);
  return c.toDataURL('image/png');
}
