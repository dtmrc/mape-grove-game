# Jailbreak quest: "The Can" (Maple Grove: Off Leash)

Asked by diet 2026-11-07: after an arrest the police take Goobles to the station; a quest mode where you break out of the
jail cell, perhaps with a frog's help. Owned by the jailbreak thread. Files: `src/js/jailbreak.js`, `tools/jailbreak-hooks.mjs`.

## Entry and exit
- Entry: `window.__JAIL.start({ from: 'police' | 'hoa', fine, station })`. The police thread calls it after the cuffing
  cutscene. Until that lands, `busted()` in game.js sends heat >= 3 citations to jail (one hooked line, removable).
- The cell block is self-contained: own geometry, colliders and camera, placed far outside the map at local origin
  (-330, 0, -330) (a terrain-clamped corner so the cat, camera and room all lift by the same height). It does not depend
  on the interiors system (`window.__INT`); if that lands, nothing changes.
- Exit: the evidence room back door. The player appears behind `places.station.door` (if the station exists) or near
  Main St. Fine refunded if the evidence bag was grabbed. Heat 1 ("someone will notice the empty cell"). Bart rides
  on Goobles' head afterwards.

## Cast
- **Bart** the frog. Lives in the cell-2 toilet "since the Reagan administration". Deadpan lifer. Small enough to pass
  between the bars; motivated by flies. Legends-style one-piece loft body (6-sided rings nose to tail, flat capped
  snout with the mouth on its own 16x16 face texture, faceted eye domes with slit-pupil eye texture, 4-sided prism legs,
  wedge webbed feet), ~290 tris, 64x64 nearest-filtered atlas. Blinks, throat pulses, squat/stretch hop poses, tongue.
- **Officer Pruitt**, Maple Grove PD. Asleep in his chair, feet on the desk, back to the corridor. Sleep cycle:
  snore (Zzz, 5-8 s) -> mumble ("...", 1.3 s warning) -> stir ("!", 1.8 s, head up, looks around) -> snore.
- A snoring raccoon in cell 1 (drunk tank). Set dressing only.

## Layout (local metres, +x down the corridor toward the desk)
- Cell block 14 x 7, three cells on the -z side (cell 1 x -6.5..-2.9, cell 2 (Goobles) -2.5..1.1, cell 3 1.5..5.1),
  bars at z = -0.5 with a hinged door at each cell's +x end. Corridor z -0.5..3.5. EXIT door (buzzer-locked, never
  opens) on the +x wall. Desk x 5.6..6.7 with keys, a donut, a mug and the BUZZER. Chair in front of it.
- Cell 2: bunk, steel toilet (Bart), sink, a fly circling the light. Cell 3: bunk and a loose floor vent on the back
  wall. Evidence room behind the cells (x 0..6.8, z -8..-3.9): shelves with the evidence bag, confiscated lawn
  flamingo and HOA signs, and the back door out.
- Light: the game's point-light pool is reused by pushing `always` light sources into world `lights`, so no extra
  shader lights. Fluorescent fixtures are emissive boxes; the evidence room one flickers.

## Steps
1. **Wake up.** Intro line. Prompt at the toilet: talk to Bart. He wants the fly.
2. **Catch the fly.** It orbits the cell light and lands every few seconds (bunk, toilet tank, bars, drain, wall).
   Paw it while landed (within reach and facing). Airborne swipes miss ("Too fast.").
3. **Feed Bart, play as Bart.** Control switches to the frog (hop with the stick/WASD, big hop with JUMP/SPACE, tongue
   with USE/E). He slips through the bars, hops down the corridor, up the chair, onto the desk, tongues the keys, and
   hops back to cell 2 to slide them under the door. Stealth: during Pruitt's stir phase any hop landing or movement
   in the corridor, or sitting on the chair/desk, gets you caught (0.35 s grace). Caught = Bart tossed back in the
   toilet, keys back on the desk, talk to Bart to retry (he complains; hint after 3 fails).
4. **Unlock the cell.** E at your door with the keys. Bart warns: the EXIT is buzzer-locked; don't touch the buzzer
   (pressing it wakes Pruitt instantly = caught, back in the cell, keys confiscated). Cat stealth uses the same cycle:
   moving in the corridor during a stir = caught.
5. **Cell 3 vent.** Unlock cell 3, paw the floor vent three times (each CLANG is loud: a clang during a stir = caught).
   Grate drops, crawl in (fade), pop out in the evidence room.
6. **Evidence room.** Grab the evidence bag (fine refunded), take the back door. Banner JAILBREAK. Bart hops onto
   Goobles' head and stays for the session.

## Debug
`__G.jail.start({ fine: 100 })`, `__G.jail.end()`, `__G.jail.skip('frog' | 'keys' | 'vent' | 'evidence')`, `__G.jail.state()`.
