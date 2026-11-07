# Illustrated town map

Renders `town-map-illustrated.png` from the live world data, so it stays accurate when world.js changes.

1. Copy the shared src to a local build dir. Then, in that local copy only (don't commit these):
   - append `export const __mapdata = { MAP, homes, TRAIL, BULBS, N };` to `src/js/world.js`
   - add `import * as __W from './world.js';` to `src/js/game.js` and `window.__W = __W;` at its end
2. `node build.mjs`
3. Point `runmap.cjs` at that build's dist/index.html (currently /home/claude/cat3d), then run `NODE_PATH=$(npm root -g) node runmap.cjs`
4. Copy the PNG to /mnt/project-files/cat-3d/town-map-illustrated.png
Pin positions and labels are listed in stylemap.js.
