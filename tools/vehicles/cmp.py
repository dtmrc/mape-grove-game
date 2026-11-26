# side-by-side: real photos (top) vs model renders (bottom).  python3 cmp.py out.png id
import sys, os, glob, subprocess
subprocess.run(['node','prev.cjs','/tmp/claude-0/cmp/_p.png',sys.argv[2]],env=dict(os.environ,PHOTO='1'),check=True,stdout=subprocess.DEVNULL)
from PIL import Image
out, vid = sys.argv[1], sys.argv[2]
R = '/mnt/project-files/cat-3d/refs/cars/%s/' % vid
refs = [R + n for n in ['front34.jpg', 'rear34.jpg', 'side.jpg'] if os.path.exists(R + n)]
md = ['/tmp/claude-0/cmp/_p.png']
H = 420
def fit(p):
    im = Image.open(p).convert('RGB'); w, h = im.size; W0 = 700 if p.endswith('.jpg') else 2100; return im.resize((W0, int(h * W0 / w)))
rows = [[fit(p) for p in refs], [fit(p) for p in md]]
W = max(sum(i.size[0] for i in r) for r in rows)
H0 = max(i.size[1] for i in rows[0]); sheet = Image.new('RGB', (2100, H0 + rows[1][0].size[1]), '#222')
x = 0
for i in rows[0]: sheet.paste(i, (x, 0)); x += 700
sheet.paste(rows[1][0], (0, H0))
sheet.save(out)
