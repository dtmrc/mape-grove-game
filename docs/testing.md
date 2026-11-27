# Testing and debugging Off Leash (tools/qa)

`tools/qa/qa.cjs` is a single command for building, booting the game headless, taking screenshots, probing
state, running smoke tests and profiling. It is written for Claude threads (and anyone at a terminal) so a
bug can be reproduced and checked in seconds instead of hand-writing a Playwright script each time.

It changes no game code. It injects `tools/qa/lib/inpage.js` before the game loads, which adds `window.QA`
and talks to the game through the existing debug globals (`__G`, `__INT`, `__FIRE`, `__JAIL`, `__dev`, ...).

## Quick start

```bash
cd cat-3d                                   # the repo / project folder (needs npm install once)
node tools/qa/qa.cjs build                  # hooks + build.mjs + dev-build.mjs
node tools/qa/qa.cjs serve &                # optional: keep a warm page (every later command ~0.1-3 s)
node tools/qa/qa.cjs test                   # all smoke suites, pass/fail table (exit 1 on failure)
node tools/qa/qa.cjs shot quik church room:diner --time 21 --clean
node tools/qa/qa.cjs eval 'QA.state()'
node tools/qa/qa.cjs stop
```

Without `serve`, each command boots its own Chromium (about 8 s). With it, commands reuse one page, which
reloads itself when `dist/dev.html` changes and restarts when `tools/qa/lib/inpage.js` changes. Command code
(`lib/commands.cjs`, `suites/*`) is re-read on every request, so editing a test needs no restart. State carries
over between commands on the warm page (that is the point: poke, look, poke again); `qa reload` resets it.
Add `--fresh` to any command to ignore the warm page.

## Commands

| Command | What it does |
| --- | --- |
| `build [--no-dev]` | Runs every `tools/*-hooks.mjs` (idempotent), `node build.mjs`, `node tools/dev-build.mjs`. |
| `state` | Player/game state, captured errors, sanity check. |
| `places` | Every teleport target with coordinates and district, plus interior room ids. |
| `shot <where...>` | Teleport + screenshot. `where` = place name, `x,z`, `x,z,yaw`, `room:<id>`, or `here`. Flags `--time 21.5 --yaw 1.2 --pitch 0.4 --clean --frames 20 --out dir/or/file.png --scale 2`. Camera defaults to straight behind the player. |
| `tour [where...]` | Shots of every place (or the listed ones) plus a labelled contact sheet `qa-out/tour/tour.png`. Places that fail sanity are flagged red. |
| `eval '<js>'` | Runs JS in the page with `QA` and `G` (= `window.__G`) in scope; `await` works; statements need `return`. `--file x.js` reads it from a file. |
| `perf [where...]` | Real frame time (GPU included), draw calls, triangles, visible objects, geometries, materials, lights, heap per spot, worst of 4 camera yaws. `--save base.json` then `--compare base.json` after a change. |
| `soak [--secs 120]` | Fast free-roam simulation (walk, teleports, car hops) with sanity checks; reports errors, hitches, NaNs, scene growth. |
| `node tools/qa/audioprobe.cjs` | Audio leak probe (separate script, audio forced on): AudioContexts, live voices, nodes made, while jumping, idling, driving with the radio and forcing 200 meows. Live voices should return to ~3 (engine + siren). |
| `test [suite...]` | Smoke suites in `tools/qa/suites` (`--list` shows them). Screenshots go to `qa-out/tests/`. |
| `run <file.cjs>` | Your own scenario (see below). |
| `serve` / `stop` / `status` / `reload` / `errors` | Warm page control. `errors` prints and clears what was captured. |

Common flags: `--html dist/index.html` (default `dist/dev.html`), `--world <dir>|none` (default `world/`),
`--seed N|random` (default 1), `--clock H|real` (start hour, default 12), `--width/--height`, `--json`, `--realtime` (real rAF clock instead of manual).

Output (shots, tour, tests) goes to `qa-out/` at the repo root, which is git-ignored.

## How it works (things worth knowing)

- **Manual frame clock.** After boot the page runs in manual mode: frames only advance when a command calls
  `QA.step(n)`. Each step is exactly 0.05 s of game time (the game's dt clamp), so runs are reproducible.
  `QA.step(n)` simulates fast and renders only the final frame by default (`{render: true|false|'last'}`);
  200 frames (10 game seconds) take under a second. Rendered frames are GPU-synced so SwiftShader never
  builds a backlog.
- **Seeded `Math.random`** (seed 1) so traffic, peds and loot match from run to run. `--seed random` turns it off.
- **Saved world.** The page gets a stand-in for the artifact db that serves `world/terrain.json`,
  `world/ground.json` and `world/edits.json`, so terrain edits, roads, props and lights match the live game and
  the dev tools stay enabled. Writes from the editor are recorded in `QA.dbWrites` instead of going anywhere.
- **Errors.** `window.onerror`, unhandled rejections, `console.error` / `console.warn` and exceptions thrown inside
  a frame are all captured with a stack, a repeat count and the player position where they happened.
  The game loop keeps running after a frame exception, so one bug does not hide the next.
- **GL counters.** Draw calls and triangles are counted by wrapping the WebGL draw functions, so `stats()` reports
  what the GPU was actually asked to draw (after culling), not just what is in the scene.
- **Numbers are SwiftShader numbers** (software GPU, 1280x720). Compare runs against each other, not against
  diet's Pixel 9 or a desktop GPU. Draw calls and triangles do transfer.
- The game clock starts at noon (`--clock real` for the real time of day); use `--time` or `QA.time(h, {freeze:true})` for stable shots.

## window.QA (in the page, also from eval and scenarios)

| Call | Notes |
| --- | --- |
| `QA.start()` | Title -> playing, intro dialog skipped. |
| `QA.step(n, {render, dt})` | Advance n frames synchronously. |
| `QA.frames(n)` / `QA.until(fn, max)` | Step until n frames / until `fn()` is truthy (returns frames used, -1 on timeout). |
| `QA.tp(where, {settle, yaw, y})` | Teleport (player or their car). `room:<id>` enters an interior. Leaves interiors first. |
| `QA.enter(id)` / `QA.exit()` | Interiors. |
| `QA.key(k, n)` / `QA.hold([k...], n)` / `QA.down(k)` / `QA.up(k)` | Keyboard input the game reads (`w a s d shift ' ' e f b`). `key` clears the input lock. |
| `QA.walk(n, keys)` / `QA.drive(n, steer)` / `QA.leaveCar()` | Move and return the distance covered; get out of the car. |
| `QA.spawnCar(type, {enter, dist, yaw})` | `sedan hatch wagon pickup suv golfcart`. |
| `QA.time(h, {freeze})` | Uses the time menu, so the sky, moon and lights update properly. |
| `QA.cam(yaw, pitch)` / `QA.camAt(where)` / `QA.hud(false)` | Camera hold and HUD hiding for clean shots. |
| `QA.state()` | Position, ground height, district, interior, car, hp/cash/heat, clock, mission, jail, counts. |
| `QA.stats()` | Scene + GL stats of the last frame, CPU ms, heap, lights. |
| `QA.timeFrames(n)` | Render n frames, GPU included, and time them. |
| `QA.sanity()` | Invariants: NaN positions (player, cars, peds, camera), out of bounds, sunk under the ground, runaway car speed. Returns a list of problems. |
| `QA.errors` / `QA.hitches` / `QA.dbWrites` / `QA.clearErrors()` | Captured diagnostics. |
| `QA.places()` / `QA.rooms()` / `QA.resolve(where)` | Lookups. |

## Smoke suites

`node tools/qa/qa.cjs test --list`. Each suite reloads the page, starts the game and ends with two automatic
checks: sanity and no errors.

boot, places (every place is standable), player (walk, sprint, jump, swim), driving (all six car types drive,
steer, brake, exit), time (noon/night, freeze), interiors (enter/walk/exit every room), police (HOA at 1 star,
cruisers at 3, clear), jailbreak, save (reload restores), soak (60 s traffic), perf (budgets in
`tools/qa/budgets.json`), fishing, fire.

A full run takes about 3 minutes. Run the suites for the system you touched while fixing (`qa test driving`), and
everything once before handing work back. The older single-purpose tests (`tools/test-core.cjs`,
`test-content.cjs`, `test-fire.cjs`, `test-townsfolk.cjs`, `test-traffic.cjs`, `test-drive.cjs`) still work.

Adding a suite: drop `tools/qa/suites/NN-name.cjs`:

```js
module.exports = {
  name: 'mything', desc: 'one line',
  async run({ S, check, shot, log }) {
    const r = await S.js(async () => { const QA = window.QA; await QA.tp('green'); return QA.walk(40); });
    check('walking moves', r.dist > 2, r);
    await shot('after-walk', { hud: false });
  },
};
```

## Scenarios (bug repro scripts)

`node tools/qa/qa.cjs run tools/qa/scenarios/example.cjs`. Same arguments as a suite plus `args` (the CLI flags).
Write one per bug: reproduce it, assert the bad thing does not happen, keep it as a regression check.

## Typical bug-fix loop

```bash
node tools/qa/qa.cjs serve &
node tools/qa/qa.cjs eval 'await QA.tp("dock"); QA.step(40); return QA.state()'   # reproduce
node tools/qa/qa.cjs shot here --clean                                            # look at it
# edit src, then
node tools/qa/qa.cjs build && node tools/qa/qa.cjs test <suite>                    # page reloads itself
node tools/qa/qa.cjs perf --compare qa-out/perf-before.json                        # if it could cost frames
```
