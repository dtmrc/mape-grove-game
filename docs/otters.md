# Otters (ambient wildlife)

diet, 2026-11-13: "can we add some otters to the map that hang around the water?"

`src/js/otters.js`, wired into game.js by `node tools/otters-hooks.mjs src/js` (idempotent; run with the other hooks).

## What they do
- Every water polygon (Lake Juniper plus anything drawn as water in the world editor, re-scanned every 2 s) gets otters.
  Puddles under 40 m2 get none. The lake gets 3 dens on the bank (flat, dry, unblocked spots, kept away from the dock,
  firepit and bait shack) and 9 otters in 3 families.
- Water: swim with a vertical body wave and a V-ring wake, dive under and resurface somewhere else, float on their backs
  grooming their paws and slowly turning, "periscope" (head and chest up) to watch Goobles when he stands still nearby.
- Bank: swim to the den, climb out across the shallows, sit up grooming, lie flat, scurry about, slide back in.
- Goobles: inside ~10 m they turn their heads to watch him and chirp; on the bank they stand up tall. Inside ~4 m
  (6.5 m if sprinting, 11 m in a car) they bolt for the water with a splash and dive away from him.
- Shallow sand inside the water polygon counts as land (ground above the surface), so they never "swim" on sand.

## Performance
- All otters = ONE InstancedMesh (400 tris each), flat-shaded Lambert with vertex colours (no textures). All motion is
  in the vertex shader from two per-instance vec4s: iA = (phase, swim, stand, run), iB = (groom, headYaw, headRaise, idle).
- Blob shadows (land only) and water rings (32-slot pool, additive) are one InstancedMesh each: 3 draw calls total.
- CPU: a tiny state machine + one matrix per otter, no per-frame allocation. ~95 us/frame for 9 otters on the headless
  SwiftShader box. Hidden indoors / in jail and when every otter is beyond 175 m of the camera.

## Model
Legends/NPC-principles style: octagon-section loft for body + tail (7 rings), octagon head with a blunt muzzle, box nose,
eyes, ears, stub legs with flat webbed paws. Painted by face direction: dark back, brown sides, cream throat/chin/chest.

## Debug / tests
- `window.__OTTERS`: `.list` (state, x, z, ...), `.bodies`, `.near(x, z)`, `.scare(s)`, `.calm = true` (ignore Goobles,
  for photos), `.rebuild()`.
- `node tools/test-otters.cjs dist/index.html <shotsdir>`: spawn, movement, all in/beside water, a bank otter bolts and
  dives when Goobles walks up, no page errors, plus screenshots.
