# Maple Grove: Off Leash, gap analysis and improvement plan

Date: 2026-11-07. Baseline: artifact v42, git tag `v1.0.0`.
Scope: the whole `src/js` tree after the interiors, police, jailbreak, fishing and planes work landed
(12,077 lines: game.js 1410, police.js 743, jailbreak.js 683, fishing.js 440, interiors.js 629, rooms.js 1037, fx.js 372, world.js ~1600, terrain.js 581, devtools.js 1513, models.js 1192).

Baseline measured with `tools/smoke.cjs` (headless Chromium, start of game, 21:30, standing at the RV):

| Metric | v1.0.0 |
|---|---|
| Visible drawables (meshes + sprites, before frustum culling) | 1653 |
| Unique geometries in the scene | 1344 |
| Unique materials | 284 |
| Triangles in view set | 345k |
| Cars / peds at start | 24 / 30 |
| JS heap after boot | 82 MB |
| Boot to first frame (SwiftShader) | 4.1 s |

Effort: S under an hour, M half a day, L a day or more. Severity: blocker / high / med / low.

## 1. Performance

### 1.1 Draw calls and GPU memory (the big one)
- **P1 Cars (M, high).** `models.js makeCar` builds ~30 meshes per car, three bevelled `ExtrudeGeometry` per spawn, a 3-material wheel (3 draws per wheel), and allocates glass, lamp and lightbar materials per car. 22 cars at start is ~640 draws, ~730 at night with the 4 glow sprites each. `removeCar` never disposes, so traffic recycling leaks GPU buffers for the whole session.
  Fix: cache one merged body geometry per `CAR_TYPES` entry (paint, dark, chrome as vertex colours or 3 groups), one shared wheel cylinder with a single textured material, shared glass, lamp, lightbar materials; a car becomes body + 4 wheels + shadow (6 draws). Dispose per-car material clones on removal.
- **P2 Peds never despawn (S, high).** Every carjack spawns a permanent "victim" ped and the top-up keeps the count at 20 walkers, so draw calls, matrices and collide calls grow forever. Cap and despawn peds farther than 90 m. Cache part geometries in `makeHuman` so peds share buffers.
- **P3 Officers (S, med).** Each officer creates 4 canvas textures and ~19 meshes in the middle of a chase, and the first one compiles the skinned shader (a visible stall). Cache textures by variant, build one hidden officer at startup and `renderer.compile`.
- **P4 Particles (M, med).** Up to 120 individual billboard meshes. Replace with one `InstancedMesh` per blend mode.
- **P5 Pickups, markers, HP bars, tracers (S, low).** Hoist the per-pickup geometries to module scope, dispose on splice, pool tracers, drop HP bars with their ped.
- **P6 Static world (M, med risk).** Everything is merged per material with `frustumCulled=false`, so the whole town runs the terrain vertex shader every frame. Later: chunk each bucket into 100 m tiles with padded bounds and turn culling on.

### 1.2 Fill rate
- **P7 Sky dome draws first (S, high).** `renderOrder = -1` means every pixel runs the 4-octave fbm sky shader and is then overdrawn by the town. Set `renderOrder = 1000` (keep depth test on, depth write off).
- **P8 Light pool (S, med).** 10 point lights + spot are evaluated per fragment even at intensity 0. Use 5 on touch devices.
- **P9 Anisotropy 4 on every procedural texture (S, low).** 1 on touch.

### 1.3 CPU per frame
- **P10 HUD DOM writes every frame (S, high).** Cash, hp width, 6 `getElementById` lookups, `innerHTML` for the star bar, objective text, timer, belly, gun button. Add a write-on-change helper and cache element lookups.
- **P11 Minimap redrawn at full rate (S, med).** Rotated 512 px `drawImage` every frame. Redraw the map layer at 20 Hz, blips every frame.
- **P12 Police line of sight (S, high at 4 stars).** `lineClear` steps 0.6 m calling `blocked()`; per cop two scans per frame, per cruiser two more; `cruisers()` is an O(cars²) filter called many times per frame. Compute LOS once per cop, stagger across frames, cache `cruisers()` per update.
- **P13 Hot-loop allocations (S, med).** `carCircles` allocates 3 arrays per call (hundreds per frame), `collide` copies the nearby list, `updateCars` slices and filters, `Sfx.engine` builds arrays with spreads, `patrols()` filters 4-5 times per frame, `blockedAhead` allocates a closure per car. Replace with scalar out-params and index loops; cache per-frame lists.
- **P14 Terrain lift (S, low).** Skip invisible objects; set `matrixAutoUpdate=false` on rigid child parts so the per-frame lift does not recompose ~2k matrices.
- **P15 fx.update with weather off (S, low).** Gate the rain, fog and wet blocks on their intensities.

### 1.4 Startup and hitches
- **P16 Procedural textures and world build (M).** ~30 fbm textures and a per-prop AO pass before the first frame; 0.3 to 0.8 s on a phone. Move texture generation into idle time or cache PNG blobs in IndexedDB.
- **P17 Shader pre-warm (S).** First HP bar, tracer, waypoint beam, plane and officer each compile a new program mid-game. Add hidden instances and `renderer.compile` before the title is dismissed.
- **P18 Breakables rebuild all colliders on every lamp hit (S).** Toggle the one collider instead of `applyGroups + applyColliders`.

## 2. Gameplay bugs (visible by reading)

| # | Sev | Bug | Fix |
|---|---|---|---|
| B1 | high | HOA-route jail never charges the fine, then the evidence bag refunds it (`busted()` returns before `addCash`) | deduct before the early return |
| B2 | high | `respawn()` saves before the fine or KO penalty is deducted, so a reload keeps the cash | deduct first |
| B3 | high | `respawn()` ignores an active fishing cast or jail: fishing re-anchors the cat to the dock every frame; a starvation KO inside the jail strands the quest | `fishing.abort()`, `jail.end()` from respawn; no KO while jailed |
| B4 | med | HOA arrest keeps the pistol; in the cell the click fires instead of pawing the fly and vent | strip the gun on any arrest |
| B5 | med | Officers beyond 30 m on foot flip between engage and return every frame and spam the "lost" line | hysteresis |
| B6 | med | HOA patrols within 40 m at 0 stars never despawn and keep chasing | retire them to traffic |
| B7 | med | M mutes game and weather audio but not police audio | set `window.__pdMute` |
| B8 | med | Old Boot can never leave the bag | discard or sell for $0 |
| B9 | med | Pelts are not saved | add to the fishing save |
| B10 | med | Race fails instantly on any forced exit (cuff, explosion) | grace timer |
| B11 | med | Ricky's waypoint points at the first bag, not the nearest | sort by distance |
| B13 | low | Nana's wagon reused from wherever the last attempt left it | teleport back on start |
| B14 | low | Dead pickups leak; temp cash never expires | TTL and splice |
| B17 | low | Player-abandoned cars are never despawned | despawn far idle cars |
| B18 | low | `P.lock` starts undefined (NaN arithmetic) | init to 0 |
| B20 | low | Explosion right after a bump deals 0 damage because of the invuln early return | force flag |
| B22 | low | Time-debug and WORLD EDITOR ship to players | keep, but hide behind a Dev toggle in the pause menu |
| B23 | low | Tab opens the bag without preventDefault | add to the list |
| B24 | low | Earl is a bare mesh, cars pass through him | spawn as an idle NPC ped |

## 3. Incomplete or inconsistent mechanics

- **M1 Two pursuit systems (high).** HOA patrols spawn per star while the PD sends cruisers from 2 stars, both write `G.seenT` with different rules (HOA uses raw distance, PD uses line of sight), and there are two bust paths with different fines. Proposal: stars 1-2 are HOA carts with a line-of-sight check and a fine-only citation; stars 3+ hand over to the PD, which is the only route to jail; one `seenT` writer.
- **M2 Save/load (high).** Only cash, done and yarn are saved. Add position, yaw, clock, hp, heat, pistol, pelts, jailbreaks; make NEW GAME clear every key (sky day counter, fx, fishing, dev view).
- **M3 Cash has nothing to buy (high).** Income is ~$2k plus farmable cash spots; the only sinks are fuel (free at $0), Earl's gear once, and fines. Add real shops: Quik Stop counter (tuna, slushie), Rosie's Diner (the usual), Suds N Paws repair and respray, RV upgrades later.
- **M4 Car wash repair only works while wanted (med).** The +40 hp is inside the heat branch. Repair at 0 stars for cash.
- **M5 Interiors are an unintended safe house (med).** Position jumps to the room at 3000,3000 so nothing can spawn while heat decays. Freeze `seenT` indoors, then "they lost you" after 20 s.
- **M6 Mission gating and post-game emptiness (med).** Four one-shot missions, Gary gated behind the other three, nothing changes after the finale. Make missions replayable for half reward with a best time, add a post-game beat, and add side jobs built from existing systems (fish order for Rosie, repo the HOA cart, sign vandalism).
- **M7 Belly meter is isolated (med).** Only fish, raccoon and tuna feed it; every interior food hotspot is a toast. Wire the RV kibble bowl, Nana's casserole, the diner and the Quik Stop into `fishing.feed`.
- **M8 Controls (med).** No pause, no settings, no full map, no in-game help, no gamepad; the controls table is hidden on touch.
- **M9 Weather (low).** 250 lines of rain, storms, fog and wind are written and gated off. Expose a toggle in the pause menu and let wet streets reduce grip.
- **M10 Dead code (low).** Police fallback jail room and `roomOK` polling, `INT.savePos` never called, `G.over`, `hud.district`, a few always-true expressions.

## 4. Implementation plan (this pass)

Work is split into packages that touch disjoint files where possible. New behaviour goes into new modules with small hooks in game.js, matching the codebase's existing pattern. Each package is built and smoke-tested headless (`tools/smoke.cjs`) before merge; the whole thing is merged, tested, republished and tagged `v1.1.0`.

| WP | Package | Items | Main files |
|---|---|---|---|
| A | Render perf | P1, P2 (geometry cache), P3, P4, P5, P17 | models.js, officer.js, new `pool.js`, game.js spawn/remove sections |
| B | Core fixes and systems | B1-B4, B6, B7, B10-B20, B23, B24, M1, M2, M4, M5 | game.js, police.js, fishing.js, jailbreak.js |
| C | Menus and input | M8 pause/help/settings, full map, gamepad, B22 dev toggle, M9 toggle | new `ui.js`, `gamepad.js`, index.html, style.css |
| D | Economy and content | M3, M6, M7, post-game beat, side jobs | new `shops.js`, `jobs.js`, interiors.js hotspots, rooms.js |
| E | CPU and fill perf (after A-D merge) | P7-P15, P18 | game.js HUD/loops, gfx.js, police.js, fx.js, breakables.js |

Deferred to a later pass: P6 world chunking, P16 texture caching, RV upgrades, more missions.

## 5. Acceptance

- Headless smoke test passes with no page errors; visible drawables at the baseline spot drop below 600; unique geometries below 300.
- A 10 minute headless soak (steal 10 cars, 3 arrests) shows no growth in cars, peds or pickups beyond their caps.
- Every item in sections 2 and 3 marked for this pass has a line in the changelog (`docs/changelog.md`) with how it was verified.
