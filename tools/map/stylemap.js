() => {
  const W = window.__W, P = W.places, D = W.__mapdata;
  const S = 2400, H = 150, M = 120;               // canvas px, world half-size, margin for frame
  const k = (S - 2 * M) / (2 * H), o = (v) => M + (v + H) * k;
  const c = document.createElement('canvas'); c.width = S + 660; c.height = S; const g = c.getContext('2d');
  let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const path = (pts, close = true) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(o(x), o(z)) : g.moveTo(o(x), o(z)))); if (close) g.closePath(); };
  // parchment frame
  g.fillStyle = '#e9dcb8'; g.fillRect(0, 0, S + 660, S);
  for (let i = 0; i < 11000; i++) { g.fillStyle = `rgba(120,90,40,${R() * 0.06})`; g.fillRect(R() * (S + 660), R() * S, 2 + R() * 4, 2 + R() * 4); }
  g.save(); g.beginPath(); g.rect(M, M, S - 2 * M, S - 2 * M); g.clip();
  // land
  g.fillStyle = '#9cc47a'; g.fillRect(M, M, S - 2 * M, S - 2 * M);
  for (let i = 0; i < 2500; i++) { g.fillStyle = R() < 0.5 ? 'rgba(70,120,50,0.12)' : 'rgba(200,230,150,0.14)'; const r = 6 + R() * 26; g.beginPath(); g.arc(M + R() * (S - 2 * M), M + R() * (S - 2 * M), r, 0, 7); g.fill(); }
  // map shapes from world (fields, lots, park, lake, forest floor)
  const fills = { '#1f3a24': null, '#4a8ac8': null };
  for (const m of D.MAP) {
    if (m.t === 'poly' && m.col === '#1f3a24') { path(m.pts); g.fillStyle = '#4f6e4a'; g.fill(); }
  }
  for (const m of D.MAP) {
    if (m.t !== 'rect') continue;
    const col = { '#6a6a70': '#b9b4aa', '#8a8478': '#cbbf9e', '#8a6a48': '#c9a26f', '#4f6a46': '#8fae78', '#8a8a40': '#d8c46a', '#9a5a40': '#c8765a', '#4f9a40': '#6fbf55', '#4f8a40': '#86c06a', '#4a4a52': '#6a6a72' }[m.col] || m.col;
    g.save(); g.translate(o(m.x), o(m.z)); g.rotate(-m.ry); g.fillStyle = col; g.fillRect(-m.w / 2 * k, -m.d / 2 * k, m.w * k, m.d * k);
    if (m.col === '#8a8a40') { g.strokeStyle = 'rgba(120,100,30,0.6)'; g.lineWidth = 3; for (let x = -m.w / 2 + 1; x < m.w / 2; x += 2.2) { g.beginPath(); g.moveTo(x * k, -m.d / 2 * k + 4); g.lineTo(x * k, m.d / 2 * k - 4); g.stroke(); } }
    if (m.col === '#4f9a40') { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; for (let z = -20; z <= 20; z += 4) { g.beginPath(); g.moveTo(-11 * k, z * k); g.lineTo(11 * k, z * k); g.stroke(); } }
    if (m.col === '#4f6a46') { g.fillStyle = '#9a9890'; for (let i = 0; i < 26; i++) g.fillRect((-8 + (i % 5) * 4) * k, (-11 + Math.floor(i / 5) * 4) * k, 0.9 * k, 0.4 * k); }
    g.restore();
  }
  // lake with shoreline rings
  const lake = D.MAP.find((m) => m.t === 'poly' && m.col === '#4a8ac8').pts;
  const cx = -35, cz = 92, sc = (s) => lake.map(([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]);
  path(sc(1.1)); g.fillStyle = '#e4d39c'; g.fill();
  path(sc(1.0)); g.fillStyle = '#5b9fd6'; g.fill();
  path(sc(0.8)); g.fillStyle = '#4a8ac8'; g.fill();
  path(sc(0.5)); g.fillStyle = '#3f7cba'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3;
  for (let i = 0; i < 28; i++) { const x = cx + (R() - 0.5) * 56, z = cz + (R() - 0.5) * 30; g.beginPath(); g.arc(o(x), o(z), 10, 3.6, 5.8); g.stroke(); }
  // dock
  g.fillStyle = '#a07850'; g.fillRect(o(-21.2), o(64), 2.4 * k, 18 * k);
  // trail
  g.setLineDash([14, 10]); g.strokeStyle = '#c9a26f'; g.lineWidth = 2.6 * k; g.lineCap = 'round'; path(D.TRAIL, false); g.stroke(); g.setLineDash([]);
  // roads: casing then fill, dirt under paved
  const E = W.EDGES, NO = W.NODES;
  const seg = (e, w, col, dash) => { const A = NO[e.a], B = NO[e.b]; g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.moveTo(o(A.x), o(A.z)); g.lineTo(o(B.x), o(B.z)); g.stroke(); g.setLineDash([]); };
  g.lineCap = g.lineJoin = 'round';
  // highway
  g.fillStyle = '#4a4a52'; g.fillRect(M, o(-148), S, 20 * k); g.fillStyle = '#d8d0b8'; g.fillRect(M, o(-138.4), S, 0.8 * k);
  g.strokeStyle = '#f0f0f0'; g.lineWidth = 3; g.setLineDash([24, 20]); for (const z of [-142, -134]) { g.beginPath(); g.moveTo(M, o(z)); g.lineTo(S - M, o(z)); g.stroke(); } g.setLineDash([]);
  g.strokeStyle = '#8a8a8a'; g.lineWidth = 3; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(M, o(-126)); g.lineTo(S - M, o(-126)); g.stroke(); g.setLineDash([]);
  for (const e of E) if (e.dirt) seg(e, (e.w + 1.6) * k, '#8a6a40');
  for (const e of E) if (!e.dirt) seg(e, (e.w + 1.6) * k, '#f4f0e4');
  for (const e of E) if (e.dirt) seg(e, e.w * k, '#d4b27c');
  for (const e of E) if (!e.dirt) seg(e, e.w * k, '#55555e');
  for (const [n, r] of D.BULBS) { const q = NO[D.N[n]]; g.fillStyle = '#f4f0e4'; g.beginPath(); g.arc(o(q.x), o(q.z), (r + 0.8) * k, 0, 7); g.fill(); g.fillStyle = '#55555e'; g.beginPath(); g.arc(o(q.x), o(q.z), r * k, 0, 7); g.fill(); }
  for (const e of E) if (!e.dirt) seg(e, 0.35 * k, '#e8c040', [16, 14]);
  for (const e of E) if (e.dirt) seg(e, 0.5 * k, 'rgba(120,150,70,0.8)');
  // trees: forest canopy blobs, dead trees in the haunted woods, park/yard trees
  const inForest = (x, z) => (x < -114 && z > -40) || (z > 119 && x < 48);
  const trees = W.colliders.filter((q) => q.tree);
  trees.sort((a, b) => a.cz - b.cz);
  for (const t of trees) {
    const r = Math.max(1.8, t.r * 5) * k, x = o(t.cx), y = o(t.cz), haunted = inForest(t.cx, t.cz);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.3, r, r * 0.8, 0, 0, 7); g.fill();
    if (t.r < 0.5 && haunted && R() < 0.25) { // dead tree glyph
      g.strokeStyle = '#4a3a3a'; g.lineWidth = 3; for (let a = 0; a < 5; a++) { const an = a * 1.25 + R(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); g.stroke(); }
      continue;
    }
    g.fillStyle = haunted ? (R() < 0.5 ? '#2f4a3a' : '#3a5444') : (R() < 0.5 ? '#4f8a3a' : '#5e9a44');
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = haunted ? 'rgba(160,140,200,0.18)' : 'rgba(220,255,170,0.35)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); g.fill();
  }
  // haunted mist
  for (let i = 0; i < 70; i++) { const x = -150 + R() * 36, z = -40 + R() * 190; const gr = g.createRadialGradient(o(x), o(z), 0, o(x), o(z), 70); gr.addColorStop(0, 'rgba(190,170,230,0.16)'); gr.addColorStop(1, 'rgba(190,170,230,0)'); g.fillStyle = gr; g.fillRect(o(x) - 70, o(z) - 70, 140, 140); }
  // buildings with drop shadows and roof colours
  const homeAt = (x, z) => D.homes.find((h) => Math.hypot(h.x - x, h.z - z) < 3);
  const SPECIAL = [[P.quik, '#d84a3a'], [P.wash, '#3a78c8'], [P.donut, '#e07aa8'], [P.church, '#f4f2ea'], [P.feed, '#b03a2a'], [P.school, '#a85a48'], [P.gary, '#e8ecf4'], [P.hoaLot, '#2a3a5a'], [P.rv, '#f1ede2'], [P.crypt, '#8a8a8a'], [P.clearing, '#6a5a4a']];
  const near = (x, z) => { let best = null, bd = 22; for (const [p, col] of SPECIAL) { if (!p) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = col; } } return best; };
  for (const q of W.colliders) {
    if (!q.bld) continue;
    let x0, x1, z0, z1, ccx, ccz;
    if (q.ob) { const ex = q.hw * Math.abs(q.c) + q.hd * Math.abs(q.s), ez = q.hw * Math.abs(q.s) + q.hd * Math.abs(q.c); ccx = q.cx; ccz = q.cz; x0 = ccx - ex; x1 = ccx + ex; z0 = ccz - ez; z1 = ccz + ez; }
    else { x0 = q.x0; x1 = q.x1; z0 = q.z0; z1 = q.z1; ccx = (x0 + x1) / 2; ccz = (z0 + z1) / 2; }
    const h = homeAt(ccx, ccz);
    let col = h ? '#' + new (window.__G.scene.constructor.prototype.constructor === undefined ? Object : Object)().constructor.name : null;
    col = h ? '#' + (h.spec.roof >>> 0).toString(16).padStart(6, '0') : near(ccx, ccz) || '#8a7a6a';
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(o(x0) + 8, o(z0) + 10, (x1 - x0) * k, (z1 - z0) * k);
    g.fillStyle = col; g.fillRect(o(x0), o(z0), (x1 - x0) * k, (z1 - z0) * k);
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.strokeRect(o(x0), o(z0), (x1 - x0) * k, (z1 - z0) * k);
    // ridge line
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath();
    if (x1 - x0 > z1 - z0) { g.moveTo(o(x0) + 4, o(ccz)); g.lineTo(o(x1) - 4, o(ccz)); } else { g.moveTo(o(ccx), o(z0) + 4); g.lineTo(o(ccx), o(z1) - 4); }
    g.stroke();
  }
  // water tower + silo + gazebo as round icons
  const disc = (x, z, r, fill, stroke = '#333') => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(o(x) + 8, o(z) + 10, r * k, 0, 7); g.fill(); g.fillStyle = fill; g.beginPath(); g.arc(o(x), o(z), r * k, 0, 7); g.fill(); g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); };
  disc(20, -70, 5, '#dfe6ec'); disc(18, -94, 2.4, '#c8ccd0'); disc(-20, 26, 4.2, '#a85a48');
  g.restore();

  // ---- labels ----
  const label = (t, x, z, size, col = '#fff', font = 'bold', stroke = 'rgba(30,20,10,0.9)') => {
    g.font = `${font} ${size}px Georgia, "DejaVu Serif", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(t, o(x), o(z)); g.fillStyle = col; g.fillText(t, o(x), o(z));
  };
  label('HOLLOW', -131, 106, 44, '#e6d4ff'); label('WOODS', -131, 117, 44, '#e6d4ff'); label('~ haunted ~', -131, 127, 30, '#d0b8ff', 'italic');
  label('MAPLE GROVE ESTATES', -80, -121, 40, '#fff2c0'); label('LAKE JUNIPER', -36, 92, 46, '#eaf6ff');
  label('PINE HOLLOW', 110, 128, 44, '#fff2c0'); label('DOWNTOWN', 4, -44, 44, '#fff2c0');
  label('OLD MILL FARM', 22, -118, 38, '#fff2c0'); label('MAPLE GROVE HIGH', 102, -116, 38, '#fff2c0');
  label('CHAPEL HILL', -88, -50, 34, '#fff2c0'); label("NANA'S PLACE", -100, 66, 34, '#fff2c0');
  label('HIGHWAY 9', 70, -138, 34, '#f0f0f0');
  const rl = (t, x, z, ang) => { g.save(); g.translate(o(x), o(z)); g.rotate(ang); g.font = 'italic bold 24px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(t, 0, 1); g.restore(); };
  rl('Main St', 30, 0, 0); rl('Main St', -30, 0, 0); rl('Old Mill Rd', -16, -34, 1.15); rl('Old Mill Rd', 49, 66, 1.18); rl('School Rd', 60, -30, Math.PI / 2);
  rl('Frontage Rd', 20, -109, 0); rl('Birch St', 95, 95, 0); rl('Hollow Ln', 112, 45, 0); rl('Estates Dr', -80, -62, 0); rl('Lake Rd', 0, 26, Math.PI / 2);
  g.save(); g.translate(o(-92), o(22)); g.rotate(Math.PI / 2); g.font = 'italic bold 22px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#5a3a1a'; g.fillText('Hollow Creek Rd (dirt)', 0, 7); g.restore();
  // numbered pins
  const pins = [
    [P.rv, 'RV (home & save)', '#2ab0e0'], [P.nana, "Nana's farmhouse", '#e8b030'], [P.church, 'Maple Grove Chapel', '#e8b030'], [P.crypt, 'Cemetery', '#9a8ab0'],
    [P.clearing, 'Ruined cabin clearing', '#9a6ad0'], [P.well, 'Old well', '#9a6ad0'], [P.quik, 'Quik Stop', '#e05040'], [P.wash, 'Suds N Paws (clears heat)', '#3a8ad8'],
    [P.donut, 'Donut Hole', '#e070a0'], [{ x: 36, z: 17 }, "Rosie's Diner", '#e05070'], [P.green, 'Town green & gazebo', '#5a9a40'], [P.hoaLot, 'HOA office', '#2a3a6a'],
    [P.gary, "Gary's mansion", '#2a3a6a'], [P.feed, 'Feed & Seed', '#b03a2a'], [P.tower, 'Water tower', '#7a8a9a'], [P.school, 'Maple Grove High', '#a85a48'],
    [P.endzone, 'Football field', '#5a9a40'], [P.dock, 'Dock', '#a07850'], [{ x: -72, z: 60 }, 'Bait & Tackle', '#3a7a8a'], [P.park, 'Lakeside Park (raccoons)', '#5a9a40'],
    [P.exitNorth, 'Exit: Hwy 9 ramp (closed)', '#f07a20'], [P.exitSouth, 'Exit: bridge out', '#f07a20'],
  ];
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
  // title cartouche
  g.textAlign = 'center'; g.fillStyle = '#4a2a10'; g.font = 'bold 72px Georgia, serif'; g.fillText('MAPLE GROVE', S + 290, M + 40); g.font = 'italic 32px Georgia, serif'; g.fillText('Off Leash  -  Town Map', S + 290, M + 92); g.fillText('Chunk 1: the starting town', S + 290, M + 132);
  // legend panel (bottom right, over Pine Hollow's southern woods)
  const lx = S - 40, ly = M + 170;
  g.fillStyle = 'rgba(244,234,206,0.94)'; g.strokeStyle = '#5a3a1a'; g.lineWidth = 4; g.fillRect(lx, ly, 620, pins.length * 44 + 90); g.strokeRect(lx, ly, 620, pins.length * 44 + 90);
  g.fillStyle = '#4a2a10'; g.font = 'bold 36px Georgia, serif'; g.textAlign = 'left'; g.fillText('LEGEND', lx + 20, ly + 38);
  pins.forEach(([, name, col], i) => {
    const y = ly + 80 + i * 44;
    g.fillStyle = col; g.beginPath(); g.arc(lx + 36, y, 17, 0, 7); g.fill(); g.strokeStyle = '#1a1208'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 20px Georgia, serif'; g.textAlign = 'center'; g.fillText(String(i + 1), lx + 36, y + 1);
    g.fillStyle = '#2a1a08'; g.font = '29px Georgia, serif'; g.textAlign = 'left'; g.fillText(name, lx + 66, y + 1);
  });
  // road key
  const ky = ly + pins.length * 44 + 120;
  g.fillStyle = 'rgba(244,234,206,0.94)'; g.fillRect(lx, ky, 620, 130); g.strokeRect(lx, ky, 620, 130);
  const key = (y, w, col, casing, txt, dash) => { g.lineCap = 'butt'; g.strokeStyle = casing; g.lineWidth = w + 6; g.beginPath(); g.moveTo(lx + 20, y); g.lineTo(lx + 120, y); g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(lx + 20, y); g.lineTo(lx + 120, y); g.stroke(); if (dash) { g.strokeStyle = dash; g.lineWidth = 3; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(lx + 20, y); g.lineTo(lx + 120, y); g.stroke(); g.setLineDash([]); } g.fillStyle = '#2a1a08'; g.font = '22px Georgia, serif'; g.textAlign = 'left'; g.fillText(txt, lx + 140, y + 1); };
  key(ky + 30, 16, '#55555e', '#f4f0e4', 'Paved road', '#e8c040'); key(ky + 66, 12, '#d4b27c', '#8a6a40', 'Dirt road');
  g.setLineDash([14, 10]); g.strokeStyle = '#c9a26f'; g.lineWidth = 8; g.beginPath(); g.moveTo(lx + 20, ky + 102); g.lineTo(lx + 120, ky + 102); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#2a1a08'; g.fillText('Forest trail', lx + 140, ky + 103);
  // compass rose
  const cxp = M + 110, cyp = M + 240;
  g.save(); g.translate(cxp, cyp);
  g.fillStyle = 'rgba(244,234,206,0.9)'; g.beginPath(); g.arc(0, 0, 80, 0, 7); g.fill(); g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.stroke();
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = i % 2 ? '#5a3a1a' : '#a07a4a'; g.beginPath(); g.moveTo(0, -66); g.lineTo(12, 0); g.lineTo(-12, 0); g.closePath(); g.fill(); }
  g.fillStyle = '#4a2a10'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('N', 0, -92 + 10);
  g.restore();
  // scale bar
  const sx = M + 40, sy = S - M - 40;
  g.fillStyle = 'rgba(244,234,206,0.9)'; g.fillRect(sx - 16, sy - 44, 50 * k + 32, 66);
  for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#f4ead0' : '#4a2a10'; g.fillRect(sx + i * 10 * k, sy, 10 * k, 12); }
  g.strokeStyle = '#4a2a10'; g.lineWidth = 2; g.strokeRect(sx, sy, 50 * k, 12);
  g.fillStyle = '#4a2a10'; g.font = '20px Georgia, serif'; g.textAlign = 'left'; g.fillText('0', sx - 4, sy - 16); g.textAlign = 'right'; g.fillText('50 m', sx + 50 * k + 10, sy - 16);
  return c.toDataURL('image/png');
}
