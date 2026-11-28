// HOA war chapter 1 + odd jobs (hoastory.js, oddjobs.js): runs tools/qa/scenarios/hoastory.cjs without the shots.
module.exports = {
  name: 'hoastory', desc: 'Notice to Vacate (notice, signatures, 8 AM violation, boot + pay, board hearing) and the odd jobs board (pizza, lawn, tow)',
  async run({ S, check }) { await require('../scenarios/hoastory.cjs')({ S, check, shot: async () => {} }); },
};
