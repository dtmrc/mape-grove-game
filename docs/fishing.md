# Fishing survival loop (src/js/fishing.js)

Hooked into game.js by `node tools/fishing-hooks.mjs src/js/game.js` (idempotent; run with the fx/events/engine hooks before each build).

Loop: talk to **Earl** at the Bait & Tackle (west shore of Lake Juniper) -> buy rod + worms (lure, lighter, pan, knife optional) -> walk out on the **dock** and press E to cast -> on "E! HOOK IT!" press E -> hold E / USE / click to keep the marker in the fish zone until the catch bar fills -> light the **shore firepit** (lighter) and cook (E to take it off: raw / cooked / burnt) -> eat from the **bag** (I, Tab, or the BAG touch button) to fill the **BELLY** meter under the health bar.

- Belly drains in ~15 minutes; above 70 health regenerates, at 0 you starve. Raw food = food poisoning (SICK), burnt = nearly worthless, cooked = belly + health.
- Earl buys fish by the pound. Catfish only bite at night; the lure skips bluegill and favours bass/trout.
- Raccoons knocked down by a car or a paw can be skinned with the knife: Raccoon Meat (cook it) + a pelt. A pelt stitches into a wearable coonskin cap in the bag.
- Quest "Catch of the Day" (first talk with Earl) walks through buy -> fish -> cook -> eat for $75.
- Debug: `__G.fishing.S`, `__G.fishing.give('bass')`, `__G.fishing.feed(50)`.
