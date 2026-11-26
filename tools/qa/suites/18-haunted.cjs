// Ghost of John parts B and C (haunted.js): runs the full walkthrough in tools/qa/scenarios/haunted.cjs without the shots.
module.exports = {
  name: 'haunted', desc: 'Unfinished Business (5 items, sitting, nap) and Ghost vs. the HOA (meeting, site, bulldozer battle, party)',
  async run({ S, check }) { await require('../scenarios/haunted.cjs')({ S, check, shot: async () => {} }); },
};
