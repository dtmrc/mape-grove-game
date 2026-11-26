# python3 rev.py out.png id1 id2 ...  -> rows of [3/4, side, front-crop] per id
import sys, json
from PIL import Image, ImageDraw
R = json.load(open('roster.json'))
out, ids = sys.argv[1], sys.argv[2:]
W = 420; H = 300
o = Image.new('RGB', (W * 3, H * len(ids)), (230, 230, 230)); d = ImageDraw.Draw(o)
for r, i in enumerate(ids):
    f = R[i]['file']; base = f'out/{i}/{f}'
    a = Image.open(base + '-34.png'); w, h = a.size
    cr = lambda im, k=0.12: im.crop((int(w*k), int(h*0.18), int(w*(1-k)), int(h*0.88)))
    for c, (v, k) in enumerate([('34', 0.08), ('side', 0.02), ('front', 0.2)]):
        im = cr(Image.open(f'{base}-{v}.png'), k).resize((W, H)); o.paste(im, (c * W, r * H))
    d.text((6, r * H + 4), f"{i}: {R[i]['real']}", fill=(0, 0, 0))
o.save(out)
