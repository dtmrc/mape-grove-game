// Pulls the road graph out of world.js (the "road graph" block) without booting the game.
const fs = require('fs');
module.exports = function loadGraph(file) {
  const s = fs.readFileSync(file, 'utf8');
  const a = s.indexOf('// ---------- road graph ----------'), b = s.indexOf('/** Where the race');
  const code = s.slice(a, b).replace(/export const /g, 'const ');
  const places = {};
  const f = new Function("places", "flowRoads", code + '\nreturn { NODES, EDGES, ADJ, N, BULBS: typeof BULBS !== "undefined" ? BULBS : [] };');
  return f(places, () => []);
};
