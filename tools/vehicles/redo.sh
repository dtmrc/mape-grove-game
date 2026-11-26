#!/bin/bash
# ./redo.sh id : restore the base file, regenerate the outline from the blueprint fit (gen.py + patches/<id>.py) or, for models refit by hand
# before run 2's tooling (crest12) / not refit (others), take the run-2 file (base/run2); then apply the detail pass patches/<id>_d.py; build
set -e; cd "$(dirname "$0")"; . ./env.sh
id=$1; p=$id; [ "$id" = tahomappv04 ] && p=tahoma04
if [ -f patches/$p.py ] && grep -q "\"$p\"" specs.json; then
  cp base/gen/v-$p.js .; [ "$p" = tahoma04 ] && cp base/gen/v-tahomappv04.js .
  python3 gen.py $p 2>/dev/null; python3 -W ignore patches/$p.py
else cp base/run2/v-$p.js .; fi
[ -f patches/${p}_d.py ] && python3 -W ignore patches/${p}_d.py
node build.cjs $p | tail -1; [ "$p" = tahoma04 ] && node build.cjs tahomappv04 | tail -1; true
