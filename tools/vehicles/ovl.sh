#!/bin/bash
# ovl.sh id...  -> overlay of the built model on its blueprint side view + measured gap (score.py). Wheel centres table below.
S=/tmp/claude-0/-home-user/eb6cdd93-5d05-502a-8004-776ac07cd9fa/scratchpad; R=/mnt/project-files/cat-3d/refs/cars
declare -A W=(
 [pathwaypiu23]="side.jpg 241 380 1047 380 L" [blazonppv23]="side.jpg 530 172 152 172 R" [rambla24]="side.jpg 178 257 703 257 L"
 [crest12]="side.jpg 345 520 1391 520 L" [escalon24]="side.jpg 556 184 148 184 R" [pathway97]="side.jpg 99 192 448 192 L"
 [grand16]="side-bp.jpg 1117 404 277 404 R" )
for id in "$@"; do set -- ${W[$id]}; pm=$(node overlay.cjs $S/ov-$id.png $id $R/$id/$1 $2 $3 $4 $5 $6 | awk '/px\/m/{print $2}'); python3 score.py $S/sc-$id.png $R/$id/$1 $S/ov-$id.png.reg.png $pm $id; done
