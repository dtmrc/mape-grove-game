// Example scenario: drive a sedan across the high school football field at night, shoot the result.
// node tools/qa/qa.cjs run tools/qa/scenarios/example.cjs [--time 22]
module.exports = async ({ S, check, shot, args }) => {
  await S.js(([h]) => window.QA.time(h, { freeze: true }), [args.time !== undefined ? +args.time : 22]);
  await S.tp('endzone', { yaw: 0 });
  const car = await S.js(() => window.QA.spawnCar('pickup', { enter: true }));
  check('in the pickup', car.inCar, car);
  const d = await S.js(() => window.QA.drive(80));
  check('pickup drove', d.dist > 10, d);
  await shot('example-night-drive');
  return S.state();
};
