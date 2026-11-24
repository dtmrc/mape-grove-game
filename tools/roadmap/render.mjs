// Top-down road map (before / after the flow pass) as SVG -> PNG.
// node tools/roadmap/render.mjs <before|after> <out.png> [footprints.json]
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
import { flowRoads, roadClass } from '../../src/js/roadflow.js';
const require = createRequire(import.meta.url);
const loadGraph = require('./graph.cjs');
const [mode, out, fpFile = 'qa-out/footprints.json'] = process.argv.slice(2);
const g = loadGraph('src/js/world.js');
const { NODES, EDGES } = g;
const before = NODES.map((n) => ({ ...n }));
let report = [];
if (mode === 'after') report = flowRoads(NODES, EDGES);
const FP = fs.existsSync(fpFile) ? JSON.parse(fs.readFileSync(fpFile)) : { b: [], w: [] };
const S = 2.6, O = 320, PX = (v) => ((v + O) * S).toFixed(1);
const W = 640 * S, H = 640 * S;
const deg = NODES.map(() => []); EDGES.forEach((e, k) => { if (!e.nt) { deg[e.a].push(e); deg[e.b].push(e); } });
const COL = { hwy: '#3b3f46', county: '#4b5058', paved: '#5a6068', estate: '#6a7078', dirt: '#b08a5a', path: '#c9b48a', walk: '#c9c0b0' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica,Arial,sans-serif">`;
svg += `<rect width="${W}" height="${H}" fill="#cfe0b4"/>`;
const WOODS = [[-310, -18], [-150, -18], [-150, -40], [-113, -40], [-113, 117], [57, 117], [63, 136], [85, 238], [92, 310], [-310, 310]];
svg += `<polygon points="${WOODS.map(([x, z]) => PX(x) + ',' + PX(z)).join(' ')}" fill="#9fbf8a"/>`;
svg += `<rect x="${PX(-145)}" y="${PX(-145)}" width="${290 * S}" height="${290 * S}" fill="none" stroke="#8a9a70" stroke-dasharray="10 8" stroke-width="2"/>`;
for (const w of FP.w) svg += `<polygon points="${w.map(([x, z]) => PX(x) + ',' + PX(z)).join(' ')}" fill="#7fb2dc"/>`;
for (const b of FP.b) svg += `<polygon points="${b.map(([x, z]) => PX(x) + ',' + PX(z)).join(' ')}" fill="#d8cdb8" stroke="#9a8e78" stroke-width="1"/>`;
// roads: outline pass then fill pass, round joins
const order = ['path', 'walk', 'dirt', 'estate', 'paved', 'county', 'hwy'];
const live = EDGES.filter((e) => NODES[e.a] && NODES[e.b]);
for (const pass of [0, 1]) for (const c of order) for (const e of live) {
  if (roadClass(e) !== c) continue; const A = NODES[e.a], B = NODES[e.b];
  const w = (e.w || 8) * S + (pass ? 0 : 3);
  svg += `<line x1="${PX(A.x)}" y1="${PX(A.z)}" x2="${PX(B.x)}" y2="${PX(B.z)}" stroke="${pass ? COL[c] : '#f4f1e8'}" stroke-width="${w}" stroke-linecap="round"${e.nt ? ' stroke-opacity=".45"' : ''}/>`;
}
// signals
const sig = [];
NODES.forEach((n, i) => {
  const es = deg[i].filter((e) => { const c = roadClass(e); return c !== 'path' && c !== 'walk'; });
  if (es.length < 3) return;
  const hwy = es.some((e) => e.t === 'hwy');
  if (mode === 'before') sig.push({ n, kind: es.length >= 4 || hwy ? 'light' : 'stop' });
  else {
    // proposal: lights only where 4 legs meet and at least two are main roads; everything else = side road stops, main road free
    const mains = es.filter((e) => ['hwy', 'county', 'paved'].includes(roadClass(e))).length;
    sig.push({ n, kind: es.length >= 4 && mains >= 3 ? 'light' : 'yield' });
  }
});
for (const { n, kind } of sig) {
  const x = PX(n.x), y = PX(n.z);
  if (kind === 'light') svg += `<g transform="translate(${x},${y})"><rect x="-9" y="-20" width="18" height="40" rx="5" fill="#222"/><circle cy="-10" r="5.5" fill="#e33"/><circle cy="0" r="5.5" fill="#eb3"/><circle cy="10" r="5.5" fill="#3c5"/></g>`;
  else if (kind === 'stop') svg += `<g transform="translate(${x},${y})"><polygon points="-7,-17 7,-17 17,-7 17,7 7,17 -7,17 -17,7 -17,-7" fill="#d22" stroke="#fff" stroke-width="2.5"/></g>`;
  else svg += `<g transform="translate(${x},${y})"><circle r="9" fill="#fff" stroke="#2a7" stroke-width="4"/></g>`;
}
// bend markers
if (mode === 'before') {
  NODES.forEach((n, i) => {
    if (n.dead || n.bulb) return;
    const es = deg[i].filter((e) => { const c = roadClass(e); return c !== 'path' && c !== 'walk'; }); if (es.length < 2) return;
    // sharpest "through" turn = the straightest pair
    let best = 999;
    for (let p = 0; p < es.length; p++) for (let q = p + 1; q < es.length; q++) {
      const o1 = NODES[es[p].a === i ? es[p].b : es[p].a], o2 = NODES[es[q].a === i ? es[q].b : es[q].a];
      const a1 = Math.atan2(o1.z - n.z, o1.x - n.x), a2 = Math.atan2(o2.z - n.z, o2.x - n.x);
      let d = Math.abs(a1 - a2); if (d > Math.PI) d = 2 * Math.PI - d; best = Math.min(best, 180 - d * 180 / Math.PI);
    }
    if (best < 15) return;
    const r = best > 60 ? 30 : 22, col = best > 60 ? '#e0262b' : '#f08a1c';
    svg += `<circle cx="${PX(n.x)}" cy="${PX(n.z)}" r="${r}" fill="none" stroke="${col}" stroke-width="5"/>`;
    svg += `<text x="${+PX(n.x) + r + 4}" y="${+PX(n.z) - r + 6}" font-size="22" font-weight="700" fill="${col}" stroke="#fff" stroke-width="5" paint-order="stroke">${best.toFixed(0)}°</text>`;
  });
} else {
  for (const r of report) {
    if (r.turn < 25) continue; const n = NODES.find((m) => m.name === r.name);
    svg += `<text x="${+PX(n.x) + 14}" y="${+PX(n.z) - 12}" font-size="20" font-weight="700" fill="#1d6b3a" stroke="#fff" stroke-width="5" paint-order="stroke">R${r.R}</text>`;
  }
}
// road names
const LBL = [['Hwy 9', -70, -200, -86], ['Hwy 9 / Main St', 100, -8, 0], ['Old Mill Rd', 70, 180, 79], ['County Rd 12', 0, -248, -6], ['County Rd 12', 258, 40, 87],
  ['Lake Rd', -110, 24, 90], ['School Rd', 68, -80, 90], ['Estates Pkwy', -190, -124, 0], ['Sawyer Farm Rd', 72, -200, 90], ['Hollow Ln', 160, 108, 14],
  ['Pine Hollow', 100, 60, 0], ['Estates', -80, -88, 0], ['Downtown', 14, 18, 0], ['Lake Juniper', -35, 92, 0], ['Hollow Woods (trail only)', -170, 180, 0]];
for (const [t, x, z, r] of LBL) svg += `<text transform="translate(${PX(x)},${PX(z)}) rotate(${r})" font-size="24" font-style="italic" font-weight="700" fill="#2a3520" stroke="#fff" stroke-width="5" paint-order="stroke" text-anchor="middle">${t}</text>`;
const PL = fs.existsSync('qa-out/places.json') ? JSON.parse(fs.readFileSync('qa-out/places.json')) : {};
for (const [k, [x, z]] of Object.entries(PL)) svg += `<g transform="translate(${PX(x)},${PX(z)})"><circle r="7" fill="#2b4a8a" stroke="#fff" stroke-width="2.5"/><text x="10" y="6" font-size="17" font-weight="700" fill="#1e2e55" stroke="#fff" stroke-width="4" paint-order="stroke">${k}</text></g>`;
svg += '</svg>';
fs.writeFileSync(out.replace(/\.png$/, '.svg'), svg);
const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Math.round(W), height: Math.round(H) } });
await p.setContent(`<body style="margin:0">${svg}</body>`); await p.screenshot({ path: out }); await b.close();
if (mode === 'after') { console.log(`${report.length} fillets, ${NODES.length - before.length} arc nodes added`); for (const r of report) console.log(`  ${r.name.padEnd(5)} turn ${String(r.turn).padStart(3)}  R ${String(r.R).padStart(3)} (wish ${r.wish}, ${r.cls})`); }
