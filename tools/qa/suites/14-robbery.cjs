// Robberies (robbery.js): runs tools/qa/scenarios/robbery.cjs as a suite.
const scenario = require('../scenarios/robbery.cjs');
module.exports = {
  name: 'robbery', desc: 'hold up the Donut Hole + Rosie\'s Diner: loot, silent alarm heat, PD storm -> arrest, walk-out escape',
  async run(ctx) { await scenario(ctx); },
};
