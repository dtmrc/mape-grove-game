// Contact sheet of every built vehicle: node sheet.cjs out.png
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'roster.json'), 'utf8')), OUT = path.join(__dirname, 'out');
const groups = [['Sedans', ['Sedan', 'Sedan (electric)']], ['Sports cars', ['Sports car']], ['SUVs and crossovers', ['SUV', 'Crossover']], ['Pickup trucks', ['Truck']], ['Police', ['Police interceptor', 'Police SUV', 'Police crossover']], ['Emergency and work vehicles', ['Fire truck', 'Ambulance', 'Tow truck', 'Road maintenance']], ['Big rigs', ['Big rig', 'Big rig trailer']]];
const ERA = { old: ['1990s to 2008', '#b0703a'], mid: ['2009 to 2019', '#4f7fae'], new: ['2020 and newer', '#3e9a6a'] };
const img = (id, v) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, id, `${R[id].file}-${v}.png`)).toString('base64');
let html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#15171c;color:#e8e6df;font:14px/1.35 system-ui,sans-serif;padding:30px;width:1740px}
h1{margin:0;font-size:32px}.sub{color:#9a9ca4;margin:6px 0 10px}h2{margin:26px 0 10px;font-size:22px;color:#d9cfb0}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{background:#20232a;border:1px solid #2e323b;border-radius:10px;overflow:hidden}
.v{height:230px;background-size:100%;background-position:50% 55%;background-color:#e1e4e9}.s{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#111}
.s div{height:110px;background-size:112%;background-position:50% 55%;background-color:#e1e4e9}
.i{padding:10px 12px}.n{font-weight:700;font-size:16px}.r{color:#9a9ca4;font-size:12.5px;margin:2px 0 6px}
.b{display:inline-block;border-radius:10px;padding:1px 8px;font-size:12px;color:#fff;margin-right:6px}.st{color:#c9cbd1;font-size:12.5px;margin-top:6px}
.legend{display:flex;gap:16px;align-items:center;color:#c9cbd1}</style></head><body>
<h1>Maple Grove: Off Leash, new vehicle lineup (blueprint-matched draft 6)</h1>
<div class="sub">${Object.keys(R).length} models, all original names. Each card: 3/4 front, rear and side views. Civilian traffic will spawn 40% old, 30% middle, 30% newest.</div>
<div class="legend">${Object.values(ERA).map(([t, c]) => `<span><span class="b" style="background:${c}">${t}</span></span>`).join('')}</div>`;
for (const [g, cls] of groups) {
  const ids = Object.keys(R).filter((id) => cls.includes(R[id].cls) && fs.existsSync(path.join(OUT, id, `${R[id].file}-34.png`)));
  if (!ids.length) continue;
  html += `<h2>${g}</h2><div class="grid">`;
  for (const id of ids) {
    const v = R[id], [et, ec] = ERA[v.era];
    const stats = v.top ? `Top ${Math.round(v.top * 2.237)} mph · 0-60 ${v.acc} · ${v.mass.toLocaleString()} kg` : `${v.mass.toLocaleString()} kg empty`;
    html += `<div class="card"><div class="v" style="background-image:url(${img(id, '34')})"></div><div class="s"><div style="background-image:url(${img(id, 'back')})"></div><div style="background-image:url(${img(id, 'side')})"></div></div>
<div class="i"><div class="n">${v.year} ${v.name}</div><div class="r">Like a ${v.real}</div><span class="b" style="background:${ec}">${et}</span><span style="color:#9a9ca4;font-size:12.5px">${v.cls}</span><div class="st">${stats}</div></div></div>`;
  }
  html += '</div>';
}
html += '</body></html>';
fs.writeFileSync(path.join(OUT, 'sheet.html'), html);
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: +(process.argv[3] || 1) }); await p.goto('file://' + path.join(OUT, 'sheet.html')); await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close(); })();
