# python3 grid.py photo out.png  -> photo with a 100 px grid for landmark picking
import sys, cv2
a = cv2.imread(sys.argv[1]); h, w = a.shape[:2]
for x in range(0, w, 50): cv2.line(a, (x, 0), (x, h), (0, 0, 255) if x % 100 == 0 else (120, 120, 255), 1)
for y in range(0, h, 50): cv2.line(a, (0, y), (w, y), (255, 0, 0) if y % 100 == 0 else (255, 150, 150), 1)
for x in range(0, w, 100): cv2.putText(a, str(x), (x + 2, 15), 0, 0.5, (0, 0, 255), 1)
for y in range(0, h, 100): cv2.putText(a, str(y), (2, y - 2), 0, 0.5, (255, 0, 0), 1)
cv2.imwrite(sys.argv[2], a); print(w, h)
