# python3 spin.py framesdir out.gif out-sheet.png  -> spinning GIF + 8-angle sheet from spin.cjs batches
import sys, glob
from PIL import Image
d, gif, sheet = sys.argv[1:4]; fr = []
for b in sorted(glob.glob(d + '/b*.png')):
    im = Image.open(b).convert('RGB'); n = round(im.width / 760)
    for i in range(n): fr.append(im.crop((i * 760, 0, (i + 1) * 760, 460)))
g = [f.resize((608, 368), Image.LANCZOS).quantize(colors=128, method=Image.MEDIANCUT) for f in fr]
g[0].save(gif, save_all=True, append_images=g[1:], duration=110, loop=0, optimize=True)
pick = [fr[round(i * len(fr) / 8) % len(fr)] for i in range(8)]
o = Image.new('RGB', (760 * 4, 460 * 2))
for i, f in enumerate(pick): o.paste(f, ((i % 4) * 760, (i // 4) * 460))
o.save(sheet)
