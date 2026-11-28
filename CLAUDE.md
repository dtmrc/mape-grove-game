# Maple Grove: Off Leash

Browser game (Three.js, PS2-era look). One bundled HTML file built with esbuild.

## Workflow: main is the single source of truth (diet, 2026-11-26)

Several Claude threads work on this game at the same time. To avoid conflicts between them, every thread follows these rules:

1. **Start from main.** Before any work, `git fetch origin main` and branch from (or merge) the latest `origin/main`. Never start from a copy in the shared project folder, a staged bundle, or another thread's container.
2. **Commit small and often** on your thread branch.
3. **Merge back into main and push as soon as a change is done and tests pass.** Do not leave finished work only on a branch, in a bundle, or in a local container.
   - `git fetch origin main && git merge origin/main` into your branch first, resolve conflicts there, rebuild, re-run the tests.
   - Then fast-forward main: `git push origin HEAD:main`. If the push is rejected because main moved, merge `origin/main` again and retry. Never force-push main.
4. **Long tasks: sync at every milestone.** Merge `origin/main` into your branch whenever you pick the work back up, and push each finished, working piece to main rather than one big merge at the end.
5. **Unfinished features go behind a flag** (default off) so they can be merged to main without breaking the game. Example: `HUNGER_ENABLED` in `src/js/fishing.js`.
6. **Never commit build output.** `dist/` and `qa-out/` are git-ignored; they are rebuilt from source and would conflict on every merge.
7. **Keep shared files easy to merge.** Put a new system in its own `src/js/<name>.js` and wire it into `game.js` / `world.js` with the smallest possible hook. Don't reformat or reorder code you aren't changing.
8. **New keyboard key = one line in `BINDINGS` in `src/js/hotkeys.js`.** The ? keyboard map, the title card and pause > CONTROLS are drawn from it, and QA suite `hotkeys` fails when a key read in `src/js` is missing there.
9. If a merge conflict is in another thread's system and the right resolution isn't obvious, ask in the project rather than guessing.

Pushing to main does not publish the game. The live game artifact, the share link and the `gh-pages` branch (GitHub Pages) are only updated when diet says to ship. The private phone test page may be updated from main at any time.

## Build and test

```
npm install
node tools/qa/qa.cjs build      # runs hook scripts, builds dist/index.html and dist/dev.html
node tools/qa/qa.cjs test       # all headless suites (about 3 min); `test <suite>` for one
```

Run the full test suite before pushing to main. While fixing a failure, re-run only the failing suite. If a change breaks a suite on purpose (for example a place moved), update the suite in the same commit. See `docs/testing.md`.

## Layout

- `src/js/` game code (`game.js` main loop, `world.js` map, one file per system), `src/models/` binary assets
- `tools/` build hooks, QA tool (`tools/qa/`), map and model tooling
- `world-old-map/` saved world documents (terrain sculpt, ground paint, editor edits) from the live game as of 2026-11-09, made on the old 290 m map. Not loaded by tests: its saved road graph gives every car a NaN position on the current map. It needs migrating before the new map ships to the live game. A current snapshot belongs in `world/` (the QA tool loads `world/*.json` when present).
- `docs/` design notes and changelog
