// Average AI traffic speed + share of time stopped over N game seconds (default 90). Compare builds with --html.
module.exports = async ({ S, args, log }) => {
  const r = await S.js(async (secs) => {
    const QA = window.QA, G = window.__G; QA.setManual && QA.setManual(true);
    await QA.tp('raceStart');
    let n = 0, sum = 0, stopped = 0;
    for (let f = 0; f < secs * 20; f++) {
      QA.step(1, { render: false });
      if (f % 10) continue;
      for (const c of G.cars) if (c.driver === 'ai' && !c.dead) { n++; sum += Math.abs(c.speed); if (Math.abs(c.speed) < 0.5) stopped++; }
    }
    return { samples: n, avgMph: +(sum / n * 2.237).toFixed(1), stoppedPct: +(stopped / n * 100).toFixed(1) };
  }, +(args.secs || 90));
  log(JSON.stringify(r)); return r;
};
