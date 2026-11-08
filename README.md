# Maple Grove: Off Leash (3D, PS2-era style)

An original open-world sandbox in the Maple Grove suburb. You are the small white cat (helmet, black quad-tube NODs,
multicam plate carrier). Walk, sprint, jump, paw-swipe, steal any car, do jobs for the neighbours, and dodge the HOA.

## Run / build
- `npm install` (esbuild + three 0.169), then `node build.mjs` -> single-file `dist/index.html` (three.js bundled in).
- npm can't symlink on the project-files mount, so build in a local copy (e.g. `cp -r cat-3d ~/cat-3d`) and copy `dist/` back.

## Code map (src/js)

- `goobles.js`: the playable cat, Tracebench Goobles base (models/goobles-base) from `src/models/goobles.glb` (GLTFLoader + AnimationMixer). Keeps the old rig contract; `?goobles=old` brings back the procedural cat from models.js. To update him: export a new GLB from Tracebench (`/mnt/project-files/tools/tracebench`, see its MAPLE-GROVE.md), overwrite `src/models/goobles.glb`, rebuild.
- `gfx.js`: PS2-era look. Detailed tileable procedural textures (fbm noise: grime, cracks, bricks, siding, multicam,
  posters, graffiti), painted face textures for people (`faceTex`), shader sky dome (stars, moon, clouds),
  and the post pipeline (`makePost`): HDR target, bloom, tone/grade, vignette, faint interlace + grain, soft upscale.
  Render height 480p on desktop, 360p on touch (P cycles 360/480/720).
- Lighting (game.js `updateLights`): a pool of 10 point lights handed to the nearest light sources from `world.lights`
  (street lamps, store canopies, neon, fire barrel), halo sprites, ground light pools, headlight spotlight, lit windows
  at night. Static geometry has baked AO (darker near the ground) and soft contact-shadow decals. The game starts at 21:30.
- `models.js`: primitive-built cat (`makeCat`), people (`makeHuman` with options for Nana, Gary, kids), raccoons,
  cars (`CAR_TYPES`: sedan, hatch, wagon, pickup, suv, golfcart), RV, trash bag.
- `world.js`: the starting town (chunk 1), hand-laid from diet's reference map. Road graph (`NODES`, `ADJ`, `EDGES`; paved + dirt,
  `nt` = no traffic) drives traffic, patrols, peds and the race. Districts (`districtAt`): Downtown (Quik Stop, Suds N Paws, Donut Hole,
  Rosie's Diner, town green), Chapel Hill (church + cemetery), Nana's Place (farmhouse + RV lot), Hollow Woods (haunted forest, trail,
  clearing, old well), Lake Juniper (dock, bait shack, Lakeside Park + raccoons), Maple Grove Estates (Gary + HOA), Old Mill Farm
  (Feed & Seed, water tower, corn), Maple Grove High (football field), Pine Hollow (country neighbourhood). Every house is a unique
  `home()` spec (style + colours + yard extras). Exits to future chunks: Hwy 9 ramp (north) and the Old Mill Rd bridge (south), both closed.
  `drawMap` paints the minimap. Colliders: boxes, circles and rotated boxes, looked up through a spatial grid. Overview: `town-map.png`.
- `game.js`: input (keyboard, mouse look with pointer lock or drag, touch stick/buttons), player, arcade car physics
  (`drive`), traffic on lanes (`trafficAI`), HOA patrol chase (`patrolAI`), racers, Gary's fleeing cart, peds walking
  sidewalk loops, heat/wanted stars (car wash clears it, getting cornered = CITED), day/night (1 game hour per minute),
  minimap, missions (`MISSIONS`: nana, kids, ricky, gary), pickups (tuna = health, cash, 10 golden yarn balls), save at the RV.
- `sfx.js`: synthesized WebAudio sounds.
- `shops.js`: things to buy (Quik Stop counter, Rosie's "the usual", Suds N Paws repair/respray at 0 stars) and the free food
  hotspots (RV kibble bowl, RV bed sleeps to 7:00, Nana's casserole once a day), all feeding the belly meter via `fishing.feed`.
- `jobs.js`: story missions replayable for half pay (`G.best.kids` race time), side jobs (Fish Order, Repo Man, Sign Language)
  and the post-game beat after Final Notice (THE RV STAYS, 24 h HOA truce `G.hoaTruce`, FOR SALE sign). `tools/test-content.cjs` checks both.

- `firestarter.js`: house fires (`docs/house-fires.md`). Fire kit pickups around town (newspapers, kindling, oily rags, gas can),
  matches and lighter fluid on the diner / Quik Stop menus, Earl's lighter; E inside the Quik Stop, the diner, the Donut Hole, the church or
  Nana's house lights it; flames + smoke indoors (hurts), breakout, witnesses -> PD heat, the VFD truck hoses it down, condemned,
  rebuilt. Hooked by `tools/firestarter-hooks.mjs`; indoor E / prompt / lights go through interiors.js `addUse`, `addPrompt`,
  `close` and the 'env' event. Debug `window.__FIRE`.

- `ui.js`: pause menu (Esc, PAUSE button, gamepad Start): resume, controls help, settings (sound, render height, weather,
  invert look, dev tools shown/hidden; saved in `maple-grove-offleash-settings`), return to title; full town map on Tab / MAP.
- `gamepad.js`: standard gamepad -> the same `keys`/`pressed`/`touch` inputs (left stick move, right stick look, A jump,
  X paw, Y use, B sprint/handbrake, LB holster, RB horn, Start pause, Back map).
- `dom.js`: write-on-change helpers for the HUD so nothing touches the DOM every frame.
- Pursuit: stars 1-2 are HOA carts (line of sight, fine-only citation); from 3 stars the PD takes over (`police.js`, the
  only route to jail). Hiding indoors for 20 s drops the heat.

Save key: localStorage `maple-grove-offleash-v1` (v2: cash, jobs, yarn, position, clock, hp, pistol, jailbreaks; autosaves
every minute and on leaving a car). NEW GAME clears every key in `SAVE_KEYS`. Debug handle: `window.__G`.

## Tests and versioning
- `node tools/smoke.cjs dist/index.html 12`: headless boot, page errors, scene stats (drawables, geometries, materials).
- `node tools/test-core.cjs dist/index.html` (pursuit, fines, save/load, respawn) and `node tools/test-content.cjs dist/index.html`
  (shops, jobs, post-game). Both need Playwright + Chromium.
- `node tools/test-fire.cjs dist/index.html [shots-dir]`: house fires end to end (kit, ignition, smoke damage, breakout, PD heat,
  VFD truck, condemned door, rebuild).
- Git tags mark shipped builds: `v1.0.0` = artifact v42 before the gap-analysis pass, `v1.1.0` = after it. See `docs/changelog.md`
  and `docs/improvement-plan.md`.

## Engine: terrain, world editing, dev tools (engine thread)
- `terrain.js`: 201x201 heightfield (2 m cells, ±200 m). Final height = procedural rolling hills (flattened near roads, buildings,
  lots and the lake; "Hills" slider scales them) + hand-sculpted delta. A patched vertex shader reads a height texture and a
  group-transform texture, so sculpting and moving buildings are live. Every world vertex carries `tanc` (anchor x, z, group):
  -1 drape, 0 rigid static, >0 movable group, <-1 flat piece of a group. Groups = a collider plus the geometry around it
  (touching building parts merge, e.g. church + steeple). Gameplay stays ground-relative: `beforeRender` lifts every scene
  object onto the terrain for the frame (cars pitch/roll), `afterRender` restores. Use `heightAt(x,z)` for anything placed in world space.
- `devtools.js`: F2 dev panel (overlays: colliders, entities, road graph, lights, terrain grid, labels, fps/draws). F3 or
  WORLD EDITOR on the title = edit mode: raise/lower/smooth/flatten brushes, select + drag/rotate/remove objects or single
  colliders, numeric collider fields, add colliders, place props, undo, "Play from here".
- Saved to the artifact database (declare `capabilities: {db: {}}` when publishing): `world/terrain` {amp, delta (base64 Int16 cm)}
  and `world/edits` {groups, cols, added, props}. Falls back to localStorage outside claude.ai.
- `tools/engine-hooks.mjs src/js` re-adds the hooks in world.js and game.js. Run it with the fx/events hooks before building.

### World editor tabs (round 2)
- Tabs: View, Terrain, Objects, Colliders, Build, Save (keys 1-6).
- Drag handles on the selected thing: red/blue = width/depth (uniform scale for objects), green = height, yellow ball = turn, pink = lift a build part.
- Terrain: Push / Pull brush (drag up/down for height, sideways for radius).
- Movable groups have a scale `s` (terrain.js group texture w channel; below 0 = hidden).
- Build tab: user-made objects from parts (box, cylinder, cone, sphere, roof, slab), saved in world/edits `bps`, placed as props of type `bp:<id>`; editing a build updates every copy.
- Polygon colliders: world.js `polyCollider(pts, h, flags)` + poly branches in collide/blocked. Lake water is one shoreline polygon with a dock notch. Editor: Colliders > Add > Draw shape; corners (teal) drag, small dots between corners add one, "Remove corner" deletes the picked one.
- Roads: src/js/roads.js builds all road surfaces, markings, junction pads and puddles from NODES/EDGES (edge `t`: paved, dirt, hwy, path = trail, walk = walkway; paths carry no traffic) and rebuilds on edit. Highway 9 runs through town (Old Mill Rd north + Main St east). Editor Roads tab saves the whole graph in world/edits `roads`.
- Ground: src/js/ground.js paints 8 surfaces over the grass (splat map, doc world/ground) and draws water surfaces for every water polygon. Editor Ground tab: Paint, Water (reshape), Draw water. Paint applies to every grass surface (shared grass material).
- Lights: editor Lights tab moves, recolours and deletes the map's lights and places new ones (presets). Saved in world/edits `lights`.

## Police (police thread)
- `src/js/police.js` + `src/js/officer.js`, wired in by `node tools/police-hooks.mjs src/js` (run with the other hooks before building).
- 2+ stars send Maple Grove PD cruisers (1 per star above one). Officers get out, chase and cuff (mash to wriggle free) or shoot,
  depending on the escalation level (number of cruisers on the case). BUSTED hands off to `window.__JAIL.start(...)` if present.
- PD station at the south side of Main St (places.station). Knocked-out officers drop a pistol (Q to holster, click to fire).
- Civilians have HP, most fight back when pawed; run-over peds tumble. `window.__G.police` is the debug handle.

## Jailbreak quest "The Can" (jailbreak thread)
- `src/js/jailbreak.js` + `tools/jailbreak-hooks.mjs` (run with the other hooks before a build). Entry `window.__JAIL.start({ from, fine, station })`
  (the police arrest flow calls it; a 3-star HOA citation also does until then). Self-contained cell block at world (-330, -330) with its own
  colliders and camera: catch the fly, feed Bart the toilet frog, play as Bart to tongue Officer Pruitt's keys (freeze when the Z's stop), unlock
  the cell, paw cell 3's floor vent loose, crawl to the evidence room, grab the fine back, leave by the back door. Bart then rides on Goobles' head.
  Design: `docs/jailbreak-design.md`. Debug: `__G.jail.skip('frog'|'keys'|'vent'|'evidence')`, `__G.jail.state()`.
