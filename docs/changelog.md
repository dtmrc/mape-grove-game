# Changelog

## Unreleased (2026-11-09): grey mannequin base (NOT published)
- diet: "make a new model: take the chest and hips out, genderless, grey, unclothed; use the boxy arms/legs/body principles"
  from a Legends reference picture. npcgen.js exports buildMannequin({height, color, name}): chamfered-box torso tapering
  to the waist into a pelvis block (no chest, no hip flare), square neck post, the D head left blank, square upper arms
  and forearms, thick mitten hands with a thumb wedge, square thighs/shins with a knee ring and a calf, oversized block
  feet with a sloped toe. 488 tris, one flat grey texel, baked tones, same 24-bone skeleton and clips as buildNPC.
  Renders npc/mannequin-idle.png, mannequin-wire.png (T-pose), mannequin-walk.png; npc/mannequin.glb.
- 04:36Z pass (diet's markup): shoulders raised and squared (torso rings at 1.37/1.415 m) with round-ish 8-sided shoulder
  caps over each arm joint; back of the skull curves in to the neck (chin rings pulled forward); thighs thinned (half
  width 0.054 at the top, legX 0.084) so their outer edge lines up with the pelvis block. 632 tris.
- 04:50Z pass: upper arm is ONE loft from inside the shoulder through a round-ish chamfered cap to a near-square arm
  (loft rings may now carry their own outline, rg.pts), forearm 8-sided to match; shoulders broader (armX 0.205, torso
  shoulder rings 0.2/0.19) so the cap tucks under the shoulder corner; pelvis stays a block down to 0.80 m and the thighs
  start inside it, so no seams show at the hips. 680 tris.

## Tracebench fix (2026-11-09, NOT published)
- diet: "I try selecting a point and it selects one that's in another direction". Cause: edit mode built its three-mesh-bvh
  tree with the default options, which REORDERS the triangle index, but click() maps hit.faceIndex through triFace[] in the
  original order, so every click landed on an unrelated face (old build: 0 of 271 points, 0 of 161 faces right on the
  mannequin). Fix in src/editMode.ts: computeBoundsTree({ indirect: true }); points and edges are now also picked where they
  are drawn on screen (nearest visible point within 14 px / edge within 10 px), box select shares the same helper.
  After: 271/271 points, 159/161 faces, 12/12 real mouse clicks. Tests: scripts/qa/pick-test.cjs, real-click.cjs.
  Tracebench.html rebuilt (old copy Tracebench.before-pick-fix.html); tsc clean, vitest 50/50.

## Unreleased (2026-11-09): average male head + fists (NOT published, diet reviews first)
- diet: "new hands and head for male" with a Legends fist reference and a D-profile head sketch. npcgen.js: head is now a
  5-ring loft on a D outline (flat face plane from the jaw ring to the brow ring, rounded chin, crown and back); the face
  quad covers only the flat part; the hair cap follows the new crown. Hands are closed fists (8-sided block along the arm,
  bigger at the knuckles, finger gaps / knuckle ridge / thumb / wrist crease painted on a 40x16 patch). Loft uvs now stay
  half a texel inside their atlas region (nearest filtering grabbed the neighbour on exact edges) and the jeans pockets
  were drawn below the leg region (they bled into whatever sat under it). Renders: npc/average-male-head-v2.png,
  average-male-fist.png, average-male-v2.png, hair-v2.png. dist/npc-creator.html rebuilt locally, creator artifact NOT republished.

## Unreleased (2026-11-09): Goobles' paws (artifact v61)
- diet: "make his hands thin. 4-fingered. still paw-like". The mitten hands of the Tracebench Goobles base were replaced by
  thin paws: a wedge palm from the forearm to a flat hand, four short blunt fingers (middle two longer, outer ones splayed),
  small dewclaw-thumb on the front edge; finger gaps use the shaded fur texel. Fur part 368 -> 480 tris, same 28 bones and
  clips. Done by tools/tracebench/scripts/goobles-paws.cjs on both the GLB and the .tracebench.json (originals kept in
  models/goobles-base/before-paws). src/models/goobles.glb replaced; game rebuilt, smoke + core + content tests green.
  Renders: npc/goobles-paws.png, npc/goobles-paws-wire.png. Tunic and suit Goobles still have mittens (same script applies).

## Unreleased (2026-11-08): NPC Creator
- New src/js/npcgen.js (art thread): parametric townspeople in the Tracebench/Legends look. One skinned mesh (~480-590 tris),
  one painted 256x256 atlas, baked front+top light in the vertex colours, unlit material, standard Tracebench skeleton
  (hips..head_end, shoulder/arm/forearm/hand _L/_R, thigh/shin/foot/toe _L/_R) and the worker's Idle/Walk/Run/Jump/Wave clips
  retargeted (src/js/npc-clips.js). Recipe: sex, build (average/built[male]/skinny/fat), face shape, nose, skin, hair style +
  colour, facial hair, shirt/pants/jacket style + colour, shoes, height. buildNPC(recipe) -> {root, clips, play, update}.
- New creator page tools/npc-creator (build: node tools/npc-creator/build.mjs -> dist/npc-creator.html, its own artifact):
  presets, chips/swatches, live turntable with the clips, random, library saved in the artifact db (collection npcs),
  Download GLB (downloads capability), copy/import recipe JSON. Review sheets in /mnt/project-files/cat-3d/npc/.
- 14:xx body rebuilt on the worker's construction (straight prisms: octagon head/torso, hex arms, box legs/hands/boots, prism
  nose), measured from Worker.tracebench.json; see docs/npc-design-principles.md. Average male reviewed next to the worker.
- Not yet in the game: spawnPed still uses makeHuman. Next step is a loader that builds saved recipes into peds.

## Unreleased (2026-11-08): Tracebench travel trailer

- diet asked to redesign the RV from a photo of a white tandem-axle travel trailer, built with Tracebench. New model at
  `tools/tracebench/models/rv` (RV.glb + RV.tracebench.json, built by `tools/tracebench/scripts/rv-build.cjs`), embedded as
  `src/models/rv.glb`. `makeRV()` in models.js now loads it (lit Lambert materials over the baked texture, nearest filtering) so
  day/night still works. Same 2.5 x 8.5 m footprint and the entry door is still at local (+1.27, -1.8) facing +X; the old side
  window is now painted at local z 1.0-2.0, y 1.95-2.6, the cabover and its windscreen are gone (hitch end is toward -Z),
  slide-out on the -X side, awning rolled.
- v56: the trailer body had been extruded half a width off centre (door and wheels floating); fixed. The save marker by the RV
  moved from places.rv.x + 1.4 to + 3.2 so it sits clear of the rear bumper (game.js line with `saveMark`).
- v57: diet asked for the trailer turned so the hitch faces the dirt road. world.js rotation is now -PI/2 + 0.1 (hitch east,
  door side facing +z across the lot). interiors.js E.rv door/window entries updated to the new world positions (door
  r.x-0.88, r.z+0.58 facing +z; window r.x-1.18, r.z+0.9). Save marker now at places.rv.x - 3.2, z + 4.5.
- v58: RV interior rebuilt from diet's floor plan (rooms.js buildRV, art thread with the engine thread's blessing pending).
  Room is now 8.2 x 3.0 m, long along x, door at x 1.3 on the +z wall. Facing in: queen bedroom to the right behind a
  partition (bed = 'Sleep (save)'), stove counter left of the door, corner sink right of it, fridge + TV cabinet, sofa and
  recliner on the slide side with the coffee table (bills), bathroom (tub, toilet, vanity) on the entrance side left of
  the living area with a corridor to the bunk room at the far end ('Nap on the bunk (save)', id 'nap'). Kibble bowls in
  front of the fridge. Same room contract (cols, spawn, exit, lights, interact, update).
- v59: RV kitchen rearranged per diet's markup: recliner removed, TV cabinet removed, fridge moved to the bathroom wall
  (x -1.2), a smaller two-burner stove counter beside it (x -0.5), the sink counter now directly left of the door
  (x 0.375, corner nook gone). Kibble bowls and fridge note follow the fridge; the room no longer needs an update().
- v60: hard hat shelf above the RV door removed (diet: "weird bell thing").

## Unreleased (2026-11-08): Goobles meows

- diet asked for meow sounds when Goobles puts effort into a jump, hops onto raised platforms, or swims. New `src/js/meows.js` (+ `tools/meows-hooks.mjs`) watches the player state, so the movement code is untouched; `Sfx.meow(kind, pitch, delay)` in sfx.js synthesizes them (sawtooth through two gliding formants, vibrato or a rolled "rrr", breath noise).
- Jump 'hup', double jump 'mew', triple jump 'yowl'; stepping up or landing on something higher 'mrrp'; falling in water splash + 'hiss', a grumble every 4-8 s while swimming, 'pff' climbing out. Preview: `goobles-meows.m4a`.

## Unreleased (2026-11-08): house fires

- diet asked to start a fire inside a house after gathering materials and tools. New `src/js/firestarter.js` (+ `tools/firestarter-hooks.mjs`).
- Fire kit = something to light it + tinder + accelerant. Lighter (Earl, $8, reusable) or Book of Matches (Rosie's menu, $1, 3 strikes);
  Old Newspapers (by the Donut Hole), Dry Kindling (the ruined cabin in Hollow Woods), Oily Rags (Feed & Seed); Lighter Fluid
  (Quik Stop menu, $5) or a Gas Can (by the farm water tower, spreads faster). Outdoor pickups glow with a little flame and come
  back 2 minutes after you use them. A FIRE KIT line under the belly meter shows what you have.
- Inside the Quik Stop, Rosie's Diner, the Donut Hole, Chapel Hill Church or Nana's house: E "Start a fire" -> pile, splash, light (FWOOSH). Not
  in the RV or the jail. Flames spread across the room over ~30 s, smoke fills it (screen haze, fog, orange light), standing in
  it or in the flames costs HP.
- After 14 s it breaks out: windows blow, flames out of every opening and the roof, smoke column, orange light over the block,
  bystanders run. If anyone sees the cat near it: ARSON!, 3+ stars (PD). The Maple Grove VFD truck rolls up the nearest road,
  the crew and the deck gun hose it down, then it smoulders and stays CONDEMNED (doors shut) for a few minutes and gets rebuilt
  once you are away.
- interiors.js gained small extension points: `addUse`, `addPrompt`, `close` / `isClosed`, an 'env' event after the indoor
  lights are set, and `INT.room`.
- New test `tools/test-fire.cjs` (18 checks).

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
