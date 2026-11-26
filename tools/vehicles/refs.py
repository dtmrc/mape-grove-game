# python3 refs.py out.png id [names...] -> reference photos side by side at 640 px wide each
import sys, os
from PIL import Image
out, vid = sys.argv[1], sys.argv[2]; names = sys.argv[3:] or ['front34', 'rear34']
R = '/mnt/project-files/cat-3d/refs/cars/%s/' % vid
ims = []
for n in names:
    if os.path.exists(R + n + '.jpg'):
        im = Image.open(R + n + '.jpg').convert('RGB'); w, h = im.size; ims.append(im.resize((760, int(h * 760 / w))))
o = Image.new('RGB', (760 * len(ims), max(i.size[1] for i in ims)), '#222')
for k, i in enumerate(ims): o.paste(i, (760 * k, 0))
o.save(out)
