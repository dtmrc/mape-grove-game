# python3 psheet.py id key shot.png out.png [score text]  -> photo-beside-model sheet: photos (front34, rear34) over the model shots, then the
# blueprint difference map (red = model outside the drawing, blue = short) with the measured gaps.
import sys, os
from PIL import Image, ImageDraw
id, key, shot, out = sys.argv[1:5]; txt = sys.argv[5] if len(sys.argv) > 5 else ''
S = os.environ['S']; R = '/mnt/project-files/cat-3d/refs/cars/' + id
W = 1600
def fit(im, w, h):
    im = im.convert('RGB'); k = min(w / im.width, h / im.height); im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    c = Image.new('RGB', (w, h), 'white'); c.paste(im, ((w - im.width) // 2, (h - im.height) // 2)); return c
ph = [fit(Image.open(os.path.join(R, f)), 800, 500) for f in ('front34.jpg', 'rear34.jpg')]
sh = Image.open(shot).convert('RGB'); sh = sh.resize((W, int(sh.height * W / sh.width)))
sc = fit(Image.open(os.path.join(S, 'sc-%s.png' % key)), W, 560)
H = 40 + 500 + sh.height + 40 + 560
o = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(o)
d.text((10, 12), '%s   real photos (top), model (middle), side vs blueprint (bottom: red = model outside the drawing, blue = short)' % id, fill='black')
o.paste(ph[0], (0, 40)); o.paste(ph[1], (800, 40)); o.paste(sh, (0, 540)); y = 540 + sh.height
d.text((10, y + 12), txt, fill='black'); o.paste(sc, (0, y + 40)); o.save(out)
