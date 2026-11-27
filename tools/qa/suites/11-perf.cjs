// Performance budgets at the busiest spots. Budgets are generous; tighten them in budgets.json as the game gets leaner.
const budgets = require('../budgets.json');
module.exports = {
  name: 'perf', desc: 'draw calls / triangles / heap within tools/qa/budgets.json at key spots',
  async run({ S, check, log }) {
    for (const [spot, b] of Object.entries(budgets.spots)) {
      const r = await S.js(async ([spot]) => {
        const QA = window.QA; await QA.tp(spot, { settle: 20, render: false }); let worst = { drawCalls: 0, glTris: 0 };
        // steady frames: the cached sun shadow map is frozen here, its refresh frame is measured on its own below
        QA.step(2); QA.shadowHold = true;
        for (const y of [0, 1.57, 3.14, -1.57]) { QA.cam(y, 0.3); QA.step(2); const s = QA.stats(); if (s.drawCalls > worst.drawCalls) worst = s; }
        QA.shadowHold = false;
        if (window.__SHADOW && window.__SHADOW.enabled) { const a = QA.stats().drawCalls; window.__SHADOW.force(); QA.step(1, { render: true }); worst.shadowDraws = QA.stats().drawCalls - a; }
        return worst;
      }, [spot]);
      log(`${spot}: ${r.drawCalls} draws, ${r.glTris} tris, ${r.heapMB} MB`);
      check(`${spot}: draw calls ${r.drawCalls} <= ${b.drawCalls}`, r.drawCalls <= b.drawCalls);
      if (r.shadowDraws !== undefined) { log(`${spot}: shadow map refresh frame +${r.shadowDraws} draws (every few seconds, or after walking ~20 m)`); check(`${spot}: shadow refresh ${r.shadowDraws} <= ${budgets.shadowRefreshDraws}`, r.shadowDraws <= budgets.shadowRefreshDraws); }
      check(`${spot}: triangles ${r.glTris} <= ${b.glTris}`, r.glTris <= b.glTris);
      if (r.heapMB !== null) check(`${spot}: JS heap ${r.heapMB} MB <= ${budgets.heapMB}`, r.heapMB <= budgets.heapMB);
    }
  },
};
