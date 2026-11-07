# Legends-style modelling rules (Off Leash NPCs)

Distilled from diet's process video (2026-11-06): a modeller rebuilding PS1 Legends-style characters in Blender, start to finish. These are the standing rules for every character model in Off Leash.

## 1. Build order
1. Reference sheet first: front and side, same scale. Block out proportions before any detail.
2. Torso is ONE piece: a box extruded a few times (hips, waist, chest, shoulders), 6 to 8 sides around. Skirts, coats and dresses are the same tube flared outward, never a separate object.
3. Limbs are tapered prisms: 4 to 6 sides, 3 to 5 loops each (joint, mid, joint). Arm and leg grow out of the torso loop, they are not plugged in.
4. Head is a faceted polyhedron with a FLAT FACE PLANE: wide, nearly planar front, flat crown, tapered jaw, back of the skull cut in 3 or 4 facets. About 10 to 14 faces visible from the front.
5. Hair is big slabs and spikes laid over the skull: 3 to 6 triangular prisms per clump, sharp tips, overlapping. Hair volume is what gives the silhouette, so it can be large.
6. Hands are mitten blocks with a thumb wedge. Shoes are oversized wedges that swallow the trouser hem.
7. Silhouette test: render black on white. If the character does not read from the outline alone (hair, hands, shoes, skirt flare), fix the geometry before painting.

## 2. Polygons
- Whole character about 300 to 600 triangles. Spend them on head, hair and hands. Legs and arms stay cheap.
- No spheres, no smooth shading tricks to hide facets. Round things are 6 or 8 sided and proud of it.
- Edges stay where a crease would be in real cloth: waistband, sleeve cuff, boot top, collar.

## 3. Textures
- One small atlas per character (128 or 256 square) for everything except the face. Big flat colour regions, nearest filtered.
- Shading is painted in two or three steps (base, shadow, highlight) per colour, no gradients. Light comes from above and in front.
- Painted detail does the work: belts, pockets, straps, buttons, boot laces, collar lines, knuckles. Geometry only where it changes the silhouette.
- Palette per character: 5 to 7 colours plus skin.

## 4. Face
- The face lives on its own small texture (32 to 64 px), mapped to the flat face plane only. Nothing wraps round the side of the head.
- Eyes are large and placed low on the face plane, wide apart. Nose is a tiny notch or one shadow pixel. Mouth is small.
- Expressions are a GRID on the face texture (3x3 or 4x4 cells: neutral, happy, angry, shut, surprised, sad, side-glance). Switching an expression is a UV offset, not new geometry. Eyes and mouth can be separate quads so they swap independently.

## 5. Proportions (adult)
- 5 to 5.5 heads tall. Head big, shoulders about 1.5 heads wide, slim arms, long legs, feet about one head long.
- Kids: 3.5 to 4 heads tall, same head size, shorter limbs. Stout adults: same height, torso tube widened at the belly, legs shorter.

## 6. What this means in our pipeline (models.js)
- loftGeo rings = the extruded loops. Fewer rings, placed at creases.
- Face = frontDecal on the front facets with an expression grid texture; add a `setFace(name)` that shifts the UV.
- Hair = angular slab helper, several per head, parented to the head bone.
- Body atlas gets painted two-step shading per colour instead of gradients.
- Add a silhouette render mode to the test harness.
