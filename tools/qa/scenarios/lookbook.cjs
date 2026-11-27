// Fixed-camera lighting/water lookbook: the same camera spots at several hours, for before/after comparisons.
// node tools/qa/qa.cjs run tools/qa/scenarios/lookbook.cjs [--tag before] [--only dock,town] [--hours 13,21.5]
const SPOTS = {
  // name: [player x,z, camera xyz, look-at xyz]
  dock: [-20, 66, [-14, 4.2, 60], [-24, 0, 84]],
  lake: [10, 96, [16, 6, 104], [-30, 0, 88]],
  shore: [-40, 66, [-46, 2.2, 64], [-28, 0.4, 80]],
  town: [30, 0, [40, 6, 16], [10, 1, -20]],
  nana: [-100, 38, [-88, 5, 46], [-104, 2, 24]],
  main: [0, 0, [-6, 3.2, -14], [24, 2, 4]],
  dockEnd: [-20, 78, [-15.5, 2.2, 73], [-20.5, 0.2, 81]],
  creek: [-78, 126, [-70, 4, 120], [-92, -1, 140]],
  boat: [-20, 70, [-14, 1.6, 79], [-17.5, 0.3, 75.5]],
};
module.exports = async ({ S, shot, args }) => {
  const only = args.only ? String(args.only).split(',') : Object.keys(SPOTS);
  const hours = String(args.hours || '13,18.7,21.5').split(',').map(Number);
  await S.js(() => window.QA.hud(false));
  const out = [];
  for (const name of only) {
    const [px, pz, c, l] = SPOTS[name];
    await S.tp(`${px},${pz}`);
    await S.js(() => window.QA.hud(false));
    for (const h of hours) {
      await S.js(([h]) => window.QA.time(h, { freeze: true }), [h]);
      await S.js(([c, l]) => { window.__camO = [c, l]; }, [c, l]);
      await S.js(() => window.QA.frames(12));
      out.push(await shot(`${args.tag || "look"}-${name}-${String(h).replace(".", "_")}`, { hud: false }));
    }
  }
  await S.js(() => { window.__camO = null; });
  return out;
};
