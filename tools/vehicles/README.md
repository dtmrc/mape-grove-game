# Vehicle models (Tracebench)

Procedural vehicle builds for Off Leash: one `v-<id>.js` per vehicle on the shared kit `vkit.js` (+ `common.js` materials).
`node build.cjs <id>` drives Tracebench headless and writes `out/<id>/` (GLB + preview PNGs, git-ignored).
Vehicles are not wired into the game yet (only Goob's truck is in game).

Reference photos and blueprints live in the project files at `cat-3d/refs/cars/<id>/`; review sheets in `cat-3d/renders/cars/`.

## SUV run 2 (2026-11-25/26)
- `base/gen/` and `base/run2/` hold the starting files; `./redo.sh <id>` rebuilds a vehicle from them:
  `gen.py` re-fits the outline from the measured blueprint (`specs.json`, `fits/fit-<key>.json`), then `patches/<id>.py` and the
  detail pass `patches/<id>_d.py` apply, then it builds (tahoma04 also builds the police tahomappv04).
- Measure, don't eyeball: `fit.py`, `crop.py` (blueprint crop with a model grid), `score.py`/`ovl2.sh` (outline gap in cm),
  `pmatch.py id photo marks/<id>-<view>.json out.png` (solves the photo camera from landmarks and ghosts the model over it), `pzoom.py`.
- Always check grilles and lamps in a straight-on front render (`node glbshot.cjs out.png <id> 00 '[[x,y,z,dist,dx,dy,dz]]'`) beside the photo.
- `. ./env.sh` sets the scratch folder `$S`. Python tools need opencv-python-headless; build needs playwright + the Tracebench page.
