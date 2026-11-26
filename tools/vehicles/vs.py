# python3 vs.py out.png id[:flip] ...  -> one row per vehicle: real front 3/4, real rear 3/4, model front 3/4 + rear 3/4
import sys, os, json, subprocess
from PIL import Image, ImageDraw, ImageFont
R = json.load(open('roster.json')); out = sys.argv[1]; W, H = 560, 340
rows = []
for a in sys.argv[2:]:
    vid, _, flip = a.partition(':'); flip = flip or '01'
    subprocess.run(['node', 'glbshot.cjs', '/tmp/claude-0/cmp/_g.png', vid, flip], check=True)
    g = Image.open('/tmp/claude-0/cmp/_g.png').convert('RGB'); gw, gh = g.size
    cells = []
    for n in ['front34', 'rear34']:
        p = '/mnt/project-files/cat-3d/refs/cars/%s/%s.jpg' % (vid, n)
        if os.path.exists(p):
            im = Image.open(p).convert('RGB'); w, h = im.size; s = max(W / w, H / h); im = im.resize((int(w * s) + 1, int(h * s) + 1)); x = (im.size[0] - W) // 2; y = (im.size[1] - H) // 2; cells.append(im.crop((x, y, x + W, y + H)))
        else: cells.append(Image.new('RGB', (W, H), '#333'))
    for k in range(2): cells.append(g.crop((k * gw // 2, 0, (k + 1) * gw // 2, gh)).resize((W, H)))
    rows.append((vid, cells))
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20); F2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except Exception: F = F2 = ImageFont.load_default()
T = 40; o = Image.new('RGB', (W * 4 + 30, (H + T) * len(rows) + 10), '#15171a'); d = ImageDraw.Draw(o)
for r, (vid, cells) in enumerate(rows):
    y = r * (H + T) + 6; info = R.get(vid, {})
    d.text((8, y + 10), 'Real: %s' % info.get('real', ''), fill='#aab', font=F2)
    d.text((W * 2 + 20, y + 8), 'Model: %s %s' % (info.get('year', ''), info.get('name', vid)), fill='#f0f0f0', font=F)
    for c, im in enumerate(cells): o.paste(im, (c * W + (10 if c >= 2 else 0) + (5 if c else 0) + (5 if c == 3 else 0), y + T))
o.save(out)
