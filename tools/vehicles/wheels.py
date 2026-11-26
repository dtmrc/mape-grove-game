# python3 wheels.py id [file] -> prints wheel centres (photo px) found by Hough circles; writes a check image
import sys, cv2, numpy as np
id = sys.argv[1]; f = sys.argv[2] if len(sys.argv) > 2 else 'side.jpg'
p = f'/mnt/project-files/cat-3d/refs/cars/{id}/{f}'
im = cv2.imread(p); g = cv2.medianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), 3); h, w = g.shape
c = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, 1.2, w * 0.3, param1=120, param2=30, minRadius=int(w * 0.045), maxRadius=int(w * 0.11))
if c is None: print(id, 'none'); sys.exit()
c = [x for x in c[0] if x[1] > h * 0.5][:2]; c.sort(key=lambda x: x[0])
for x in c: cv2.circle(im, (int(x[0]), int(x[1])), int(x[2]), (255, 0, 255), 2); cv2.circle(im, (int(x[0]), int(x[1])), 3, (0, 0, 255), -1)
cv2.imwrite(f'/tmp/claude-0/-home-user/eb6cdd93-5d05-502a-8004-776ac07cd9fa/scratchpad/wh-{id}.png', im)
print(id, w, h, ' '.join(f'{x[0]:.0f},{x[1]:.0f},r{x[2]:.0f}' for x in c))
