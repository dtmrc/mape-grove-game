# Changelog

## Unreleased (2026-11-08): your own map marker

- Click or tap the Tab town map (or tap the minimap to open it) to drop a violet marker; click it again or press C / Delete to remove it, click elsewhere to move it. The map draws a dashed line from you to it.
- The marker gets a violet light beam and pulsing ring in the world, a star HUD pointer with the distance (edge arrow when off-screen), and an "M" pin on the minimap. It clears itself when you arrive, and is kept across reloads (localStorage `maple-grove-offleash-mark`, cleared by NEW GAME).
- `updateWaypoint()` now drives two pointers (mission `G.check` and `G.mark`); interiors-hooks matches the new hide flag.

## v1.2.0 (2026-11-08): Tracebench Goobles

- The playable cat is now diet's Tracebench Goobles base (all-white unclothed cat, yellow eyes), loaded from `src/models/goobles.glb` (copy of `tools/tracebench/models/goobles-base/Goobles-base.glb`, embedded by esbuild's binary loader). Skinned, 28 bones, unlit baked-light textures with crisp pixels, scaled to 0.88 (about 0.98 m) to fit the cars and doors.
- Clips: Idle when standing, Walk when slow, Run at normal and sprint speed (sped up to match), Jump held mid-air, Walk while swimming, Wave when he talks to someone.
- `src/js/goobles.js` keeps the old rig contract (userData body/torso/head/arms/legs): poses other systems write (punch, cuffs, gun aim, fishing, eating, flips, knocked down) override the clip on the matching bone, and props go to sockets on the hand, head and hips, so the coonskin cap, paw gun, cuffs, fishing rod and Bart line up.
- Textures dim with the sky light at night. The old procedural cat is still in models.js: open the game with `?goobles=old` (or localStorage `mg.goobles` = `old`) to use it. Git tag `goobles-procedural` is the last commit before the swap.

## v1.1.1 (2026-11-07): road clutter fixes

- A Pine Hollow oak grew in the middle of the north-south road east of Pine Ct; moved it onto the verge.
- Signs and props that sat on asphalt after the roads were widened now get nudged off the road: the Fresh Eggs sign, the Welcome to Maple Grove sign, the Estates guard booth and the fire hydrants. Utility poles that landed on a crossing road and hedge pieces that poked onto the asphalt are skipped.
- `tree()` and `deadTree()` refuse to spawn on any graph road, and a new `offRoad()` helper in world.js nudges hand-placed props clear, so future placements can't regress.

## v1.1.0 (2026-11-07): gap-analysis improvement pass

Built from `docs/improvement-plan.md`. Baseline `v1.0.0` = artifact v42.

### Performance
| Metric (start of game, RV, 21:30, headless) | v1.0.0 | v1.1.0 |
|---|---|---|
| Visible drawables | 1653 | 687 |
| Unique geometries | 1344 | 184 |
| Unique materials | 284 | ~216 |
| JS heap after boot | 82 MB | 73 MB |

- Cars: one merged body geometry per type, shared wheel/glass/lamp/chrome materials, per-car paint clone disposed on removal (P1).
- Peds and raccoons: merged rig parts with cached geometry (7 drawables per human instead of ~25); walkers capped at 22 and despawned beyond 90 m; abandoned cars despawned beyond 110 m when more than 26 exist (P2).
- Particles and car light halos: two instanced billboard meshes instead of up to 120 meshes plus 4 sprites per car (P4).
- Pickup and marker geometries shared; officer textures cached; officer, HP bar, tracer, plane, contrail and waypoint shaders pre-compiled at startup so nothing stalls mid-chase (P3, P5, P17).
- Sky dome drawn after the town, so the fbm sky shader only runs on uncovered pixels (P7). Point-light pool 5 on touch, anisotropy 1 on touch (P8, P9).
- HUD writes only on change through `dom.js`; minimap layer redrawn at 20 Hz; police line of sight staggered over 3 frames and `cruisers()` cached per update; hot-loop array allocations removed (`carCircles`, `collide`, `updateCars`, siren distance); terrain lift skips invisible objects; rigid car parts no longer recompute matrices; weather code idles when off (P10-P15).
- Breakables toggle one collider instead of rebuilding them all (P18).

Verified with `tools/smoke.cjs` (0 page errors) and screenshots at the RV and Main St, day and night.

### Bugs fixed
- B1 HOA arrest at 3 stars never charged the fine and the evidence bag refunded it. HOA citations are now fine-only.
- B2 Saves happened before fines and knock-out penalties were deducted.
- B3 Respawn now aborts fishing and ends a jail visit; no knock-out while jailed.
- B4 Any arrest strips the pistol.
- B5 Officers no longer flip between engage and return every frame beyond 30 m.
- B6 HOA patrols retire into traffic at 0 stars instead of lingering.
- B7 M mutes police audio too.
- B8 Old Boot can be tossed from the bag. B9 Pelts are saved.
- B10 Race gives a 6 s grace to get back in the car. B11 Ricky's waypoint points at the nearest bag.
- B13 Nana's wagon returns to her drive at mission start. B14 Dropped cash expires; dead pickups are removed.
- B18 `P.lock` initialised. B20 Explosions damage through the bump invulnerability. B23 Tab no longer moves browser focus.
- B24 Earl is a real NPC ped.
- Car wash repair had two implementations after the merge; the shops.js one (E in the bay) is the only one now.

Verified by `tools/test-core.cjs` (16 checks) and `tools/test-content.cjs` (36 checks).

### Mechanics completed
- M1 One pursuit: stars 1-2 HOA carts with line of sight and fine-only citation; stars 3+ Maple Grove PD only, the only route to jail; a single `seenT` writer; Gary's mission stays HOA-only.
- M2 Save v2: position, yaw, clock, hp, pistol, jailbreaks; autosave every minute and on leaving a car; NEW GAME clears every game key (not the saved world or device settings).
- M3 Cash sinks: Quik Stop counter (tuna, slurpee, jerky, scratchers), Rosie's Diner (tuna melt, pie, coffee), Suds N Paws repair $30 and respray $20.
- M4 Car wash repair works at 0 stars. M5 Hiding indoors for 20 s loses the heat.
- M6 Story missions replayable for half pay with a race best time; side jobs Fish Order, Repo Man, Sign Language; post-game beat (THE RV STAYS, 24 h HOA truce, FOR SALE sign on Gary's lawn).
- M7 Belly meter fed by the RV kibble bowl, Nana's casserole, the diner and the Quik Stop.
- M8 Pause menu with controls help and settings, full town map, gamepad support, PAUSE and MAP touch buttons.
- M9 Weather can be switched on in Settings (persisted). B22 Dev tools hidden by default, toggle in Settings.

### Not in this pass (see the plan)
World chunking for frustum culling (P6), texture caching off the main thread (P16), RV upgrades, more missions, gamepad triggers and haptics.
