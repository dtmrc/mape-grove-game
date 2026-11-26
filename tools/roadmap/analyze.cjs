// Turn analysis of the road graph: at every node, the turn a car makes going straight through (degree 2) and
// the junction kind. Writes JSON for the map renderer.  node tools/roadmap/analyze.cjs src/js/world.js out.json
const loadGraph = require('./graph.cjs');
const { NODES, EDGES, ADJ } = loadGraph(process.argv[2]);
const deg = (i) => ADJ[i].filter((e) => !e.nt).length;
const out = { nodes: [], edges: [] };
for (const e of EDGES) { const A = NODES[e.a], B = NODES[e.b]; out.edges.push({ a: e.a, b: e.b, w: e.w, t: e.t, nt: e.nt, len: Math.hypot(B.x - A.x, B.z - A.z) }); }
NODES.forEach((n, i) => {
  const adj = ADJ[i]; if (!adj.length) return;
  const dirs = adj.map((e) => Math.atan2(NODES[e.n].x - n.x, NODES[e.n].z - n.z));
  let turn = null;
  if (adj.length === 2) { let d = Math.abs(dirs[0] - dirs[1]); if (d > Math.PI) d = 2 * Math.PI - d; turn = 180 - d * 180 / Math.PI; }
  out.nodes.push({ i, name: n.name, x: n.x, z: n.z, deg: adj.length, turn, bulb: n.bulb, dead: n.dead });
});
require('fs').writeFileSync(process.argv[3], JSON.stringify(out));
const bends = out.nodes.filter((n) => n.turn !== null && n.turn > 15).sort((a, b) => b.turn - a.turn);
console.log('bends > 15 deg:'); for (const n of bends) console.log(`  ${n.name.padEnd(5)} ${n.turn.toFixed(0).padStart(3)}°  (${n.x},${n.z})`);
const j = out.nodes.filter((n) => n.deg >= 3); console.log(`junctions: ${j.length}  (${j.map((n) => n.name + ':' + n.deg).join(' ')})`);
console.log('total road km', (out.edges.filter((e) => e.t !== 'path' && e.t !== 'walk').reduce((s, e) => s + e.len, 0) / 1000).toFixed(2));
