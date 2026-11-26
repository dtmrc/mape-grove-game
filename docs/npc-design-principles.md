# NPC design principles (from diet's Tracebench construction worker)

Taken apart 2026-11-08 from `tools/tracebench/models/worker/Worker.tracebench.json` (1.83 m without the hat, 624 tris, 8 parts).
Pictures: `npc/worker-wireframe.png` (rest pose with edges), `npc/worker-exploded-parts.png`, `npc/worker-textures.png`,
`npc/compare-worker-vs-average-male.png` (worker left, generated average male right, same scale).

## 1. Everything is a straight prism
No lofts, no tapers of five rings, no spheres. Each body part is one extruded cross-section with flat caps:

| Part | Cross-section | Size on the worker |
|---|---|---|
| Head | octagon (chamfered box), straight sides, flat top AND flat bottom, no chin | 0.25 wide x 0.23 deep x 0.26 tall (y 1.57-1.83) |
| Neck | hexagon | r 0.075 x 0.065, runs from 1.42 up into the head |
| Torso (vest) | octagon, flat faces 0.84 of the width, 45 deg chamfers | hips 0.44 x 0.28, chest 0.52 x 0.34 (y 1.30-1.43), sloped top to 0.32 x 0.20 at 1.49 |
| Upper arm, forearm | hexagon, pointy top/bottom, flat front/back; two separate prisms that overlap at the elbow | forearm r 0.09 (y) x 0.076 (z), wrist 0.07 x 0.064 |
| Hand | plain box, fingers painted | 0.15 long x 0.13 tall x 0.15 deep |
| Leg | plain box, NO taper, cut into 4 segments so the knee bends | 0.185 x 0.185, y 0.13-0.93, 3 cm gap between legs |
| Boot | box with a sloped toe | 0.14 wide x 0.16 tall at the heel, 0.04 at the toe, 0.33 long |
| Nose | triangular prism: top edge flush with the face, bottom edge sticks out | 0.05 wide x 0.07 tall, sticks out 0.06 |

The octagon is the same everywhere: corners at (+-0.42, +-1) and (+-1, +-0.42) of the half sizes.

## 2. Proportions
About 7 heads tall, which is more realistic than Legends' 5.5, but every part is chunky: chest as deep as a third of its width is
high, hands as long as the face, boots a third of a metre. Shoulders are wide because the sleeve prisms stick out past the torso.
Parts overlap instead of joining: the neck disappears into the head and torso, sleeves overlap the vest, the forearm overlaps the sleeve.

## 3. Rig
Standard Tracebench skeleton (hips spine chest neck head head_end, shoulder/arm/forearm/hand/hand_end _L/_R, thigh/shin/foot/toe
_L/_R), T-pose with the arms along x. Hard skinning: each prism belongs to one bone; only the leg segments at the knee blend.
Clips Idle/Walk/Run/Jump/Wave are shared and retarget to any body built this way.

## 4. Texture
Each flat face is its own chart. Flat colour per face with the light baked in: front and top faces full colour, sides one step darker,
back and underside two steps darker. Detail is 1-2 pixel lines: seams, stitching, pocket outlines, belt loops, laces, knuckle lines,
speckles for hairy forearms. The face is painted on the front facet: big low eyes about 65 percent up the head (right under the
hat brim), cheeks, ear painted on the side facet, beard wraps round the jaw facets. Only the nose is geometry. Nearest-filter, unlit.

## 5. How the generator applies it (src/js/npcgen.js, average male)
Octagon head 0.25 x 0.23 x 0.26 at y 1.55 with a face plane flush on the front facet; hex neck r 0.075; octagon torso 0.50 x 0.31 at
the chest tapering to 0.42 x 0.26 at the hips, sloped top; hex upper arm r 0.08 and forearm r 0.068 as separate prisms; box hands
0.14 x 0.12 x 0.13; box legs 0.18 square with rings at 0.72 / 0.52 (knee) / 0.32; boots 0.13 x 0.12 x 0.30 with the sloped toe;
nose prism per nose type; hair as a slightly larger octagon slab with a flat top plus box slabs. 432 tris, one atlas, three baked
tones in the vertex colours. Builds, female and the outfits scale the same prisms; they have not been reviewed against this yet.
