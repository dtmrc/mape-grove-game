# Illustrated town map

Renders `town-map-illustrated.png` from the live world data, so it stays accurate when world.js changes.

1. Copy the shared src to a local build dir. Then, in that local copy only (don't commit these):
   - append `export const __mapdata = { MAP, homes, TRAIL, BULBS, N };` to `src/js/world.js`
   - add `import * as __W from './world.js';` to `src/js/game.js` and `window.__W = __W;` at its end
2. `node build.mjs`
3. Point `runmap.cjs` at that build's dist/index.html (currently /home/claude/cat3d), then run `NODE_PATH=$(npm root -g) node runmap.cjs`
4. Copy the PNG to /mnt/project-files/cat-3d/town-map-illustrated.png
Pin positions and labels are listed in stylemap.js.

## Whole-world map (countryside, 2026-11-13)
`worldmap.js` draws the full 600 m play area (terrain hillshade, fields, woodlots, every road with names, the old town
limits, pins). Same debug build as above, but append
`export const __mapdata = { MAP, TRAIL, BULBS, N, FIELDS, WOODLOTS };` to world.js and expose `window.__W` (world.js) and
`window.__TER` (terrain.js) from game.js. Then `NODE_PATH=$(npm root -g) node runworldmap.cjs <debug dist/index.html> <out.png>`.
