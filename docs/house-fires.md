# House fires

diet (2026-11-08): "it would be cool if i could start a fire inside of a house. maybe there are materials i can gather and some tools i need to gather in order to get the fire started?"

## The kit
You need one of each:

| Slot | Options | Where |
|---|---|---|
| Something to light it | Lighter (reusable) | Earl's Bait & Tackle, $8 |
| | Book of Matches (3 strikes) | Rosie's Diner menu, $1 |
| Tinder | Old Newspapers | recycling pile by the Donut Hole |
| | Dry Kindling | the ruined cabin clearing in Hollow Woods |
| | Oily Rags | Feed & Seed loading dock (Old Mill Farm) |
| Accelerant | Lighter Fluid | Quik Stop counter menu, $5 |
| | Gas Can (burns faster) | by the farm water tower |

Outdoor pickups have a small floating flame. One of each item at a time; a used pickup comes back after 2 minutes (when you are 25 m away).

## Burning
Walk into the Quik Stop, Rosie's Diner, the Donut Hole, Chapel Hill Church or Nana's house and press E ("Start a fire"). Without a full kit it tells you what is missing and where to find it. The RV and the jail cell refuse.

Timeline (seconds since lit): flames spread across the room (~30 s to full, ~22 s with gas), smoke haze and fog build, smoke and flames hurt. 14 s: breakout (windows blow, flames out of the openings and the roof, smoke column, orange light, peds within 40 m flee). Witness = any person within 28 m of the cat while the cat is within 35 m of the burning building: ARSON banner, heat to at least 3 stars (PD), VFD called right away. Otherwise the VFD is called at 26 s. The truck drives up the nearest road and pulls over, the crew and the deck gun spray for 22 s, then the building smoulders 80 s and stays condemned (doors and windows shut, "CONDEMNED" at the door) for 170 s more, and is rebuilt once the cat is 45 m away.

## Code
`src/js/firestarter.js`, hooks `tools/firestarter-hooks.mjs` (import, `const fires = makeFirestarter(...)` before `window.__G`, `fires.update(dt)` after `events.update`, outdoor E + prompt). Indoor E, prompt and lights use the interiors.js extension points. Shop items live in `shops.js` MENUS and call `window.__FIRE.bought(id)`. Save key `maple-grove-offleash-fire-v1` (kit only; fires are not saved). Debug: `__FIRE.give('all')`, `__FIRE.state`, `__FIRE.skip(s)`.
Test: `node tools/test-fire.cjs dist/index.html [shots-dir]`.
