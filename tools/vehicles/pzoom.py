# python3 pzoom.py id photo x0 y0 x1 y1 out.png [scale]  -> photo crop | model crop | 50% ghost, from the last pmatch run of id
import sys, os, cv2, numpy as np
id, photo = sys.argv[1:3]; id = os.environ.get('TAG', id); x0, y0, x1, y1 = map(int, sys.argv[3:7]); out = sys.argv[7]; k = float(sys.argv[8]) if len(sys.argv) > 8 else 1
S = os.environ['S']; im = cv2.imread(photo); r = cv2.imread(os.path.join(S, 'pcam-%s.png' % id), cv2.IMREAD_UNCHANGED)
a = r[:, :, 3:4].astype(np.float32) / 255; m = (r[:, :, :3] * a + 255 * (1 - a)).astype(np.uint8)
g = (im * (1 - 0.55 * a) + r[:, :, :3] * 0.55 * a).astype(np.uint8)
c = lambda q: cv2.resize(q[y0:y1, x0:x1], None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
cv2.imwrite(out, np.vstack([np.hstack([c(im), c(m)]), np.hstack([c(g), c(im)])]))
