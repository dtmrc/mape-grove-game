# python3 sidecmp.py out.png id...  -> real side photo (side.jpg / side-ish.jpg / rear34) beside the model's side panel from the flat preview
import sys, os, subprocess
from PIL import Image
out = sys.argv[1]; ids = sys.argv[2:]; R = '/mnt/project-files/cat-3d/refs/cars/'
tmp = out + '.prev.png'
subprocess.run(['node', 'prev.cjs', tmp] + ids, env={**os.environ, 'PHOTO': '1'}, capture_output=True)
pv = Image.open(tmp); ph = pv.height // len(ids); W = 760
o = Image.new('RGB', (W * 2, 300 * len(ids)), (20, 20, 22))
for i, id in enumerate(ids):
    for n in ['side.jpg', 'side-ish.jpg', 'front34.jpg']:
        if os.path.exists(R + id + '/' + n): break
    im = Image.open(R + id + '/' + n).convert('RGB'); im.thumbnail((W, 300)); o.paste(im, (0, i * 300))
    sp = pv.crop((pv.width * 2 // 3 - 10, i * ph, pv.width, (i + 1) * ph)); sp.thumbnail((W, 300)); o.paste(sp, (W, i * 300))
o.save(out)
