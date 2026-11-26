// Performance budgets at the busiest spots. Budgets are generous; tighten them in budgets.json as the game gets leaner.
const budgets = require('../budgets.json');
module.exports = {
  name: 'perf', desc: 'draw calls / triangles / heap within tools/qa/budgets.json at key spots',
  async run({ S, check, log }) {
    for (const [spot, b] of Object.entries(budgets.spots)) {
      const r = await S.js(async ([spot]) => {
        const QA = window.QA; await QA.tp(spot, { settle: 20, render: false }); let worst = { drawCalls: 0, glTris: 0 };
        for (const y of [0, 1.57, 3.14, -1.57]) { QA.cam(y, 0.3); QA.step(2); const s = QA.stats(); if (s.drawCalls > worst.drawCalls) worst = s; }
        return worst;
      }, [spot]);
      log(`${spot}: ${r.drawCalls} draws, ${r.glTris} tris, ${r.heapMB} MB`);
      check(`${spot}: draw calls ${r.drawCalls} <= ${b.drawCalls}`, r.drawCalls <= b.drawCalls);
      check(`${spot}: triangles ${r.glTris} <= ${b.glTris}`, r.glTris <= b.glTris);
      if (r.heapMB !== null) check(`${spot}: JS heap ${r.heapMB} MB <= ${budgets.heapMB}`, r.heapMB <= budgets.heapMB);
    }
  },
};
