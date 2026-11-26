import sys
from PIL import Image, ImageFilter, ImageChops
out, photo, reg = sys.argv[1:4]
ph = Image.open(photo).convert('RGB'); rg = Image.open(reg).convert('RGBA').resize(ph.size)
a = rg.split()[3]
# outline = edges of the region map (silhouette + glass + wheels + lamps)
ed = Image.merge('RGB', rg.split()[:3]).filter(ImageFilter.FIND_EDGES).convert('L').point(lambda v: 255 if v > 40 else 0)
ed = ImageChops.lighter(ed, a.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0)).filter(ImageFilter.MaxFilter(3))
o1 = ph.copy(); o1.paste(Image.new('RGB', ph.size, (255, 40, 220)), mask=ed)
tint = Image.blend(ph, Image.merge('RGB', rg.split()[:3]), 0.45); o2 = ph.copy(); o2.paste(tint, mask=a)
o = Image.new('RGB', (ph.width * 2, ph.height)); o.paste(o1, (0, 0)); o.paste(o2, (ph.width, 0)); o.save(out)
