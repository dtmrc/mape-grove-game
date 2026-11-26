#!/bin/bash
# ovl2.sh key...  (key = wc.json entry; trailing b = alternate blueprint of the same id) -> score vs blueprint + diff map + fit grid
R=/mnt/project-files/cat-3d/refs/cars; D=$(dirname $0)
for k in "$@"; do id=${k%b}; read f fx fy rx ry face < <(python3 -c "import json;print(*json.load(open('$D/wc.json'))['$k'])")
  case $f in ../*) p=$R/$id/$f;; *) p=$R/$id/$f;; esac
  pm=$(node $D/overlay.cjs $S/ov-$k.png $id $p $fx $fy $rx $ry $face $( [ $id = tahomappv04 ] && echo tahoma04 ) | awk '/px\/m/{print $2}')
  python3 $D/score.py $S/sc-$k.png $p $S/ov-$k.png.reg.png $pm $k ${MASK:-}; python3 $D/fit.py $k $S/ov-$k.png.reg.png > /dev/null; done
