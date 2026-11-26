# python3 pmatch.py id photo.jpg marks.json out.png
# marks.json: {"pts": [[X,Y,Z, u,v], ...]}  model-metre landmarks and where they are in the photo (px).
# Solves the photo camera (focal by search, then PnP), renders the model through it (pcam.cjs) and writes a sheet:
# photo | model in the same view | model edges (magenta) over the photo. Prints the reprojection error per landmark.
import sys, json, os, subprocess, numpy as np, cv2
id, photo, mk, out = sys.argv[1:5]; tag = sys.argv[5] if len(sys.argv) > 5 else id; S = os.environ['S']; D = os.path.dirname(os.path.abspath(__file__))
im = cv2.imread(photo); H, W = im.shape[:2]; M = json.load(open(mk))
P = np.array([p[:3] for p in M['pts']], np.float64); U = np.array([p[3:5] for p in M['pts']], np.float64)
best = None
FL = [float(os.environ['FOCAL'])] if os.environ.get('FOCAL') else np.linspace(0.4, 8.0, 381) * W
for f in FL:
    K = np.array([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]])
    ok, rv, tv = cv2.solvePnP(P, U, K, None, flags=cv2.SOLVEPNP_SQPNP)
    if not ok: continue
    ok, rv, tv = cv2.solvePnP(P, U, K, None, rv, tv, True, cv2.SOLVEPNP_ITERATIVE)
    pr, _ = cv2.projectPoints(P, rv, tv, K, None); e = np.linalg.norm(pr.reshape(-1, 2) - U, axis=1)
    if tv[2] > 0 and (best is None or e.mean() < best[0]): best = (e.mean(), f, rv, tv, e)
err, f, rv, tv, e = best; Rm, _ = cv2.Rodrigues(rv)
print('focal %.0f px (fov %.1f deg), mean reproj %.1f px' % (f, np.degrees(2 * np.arctan(H / 2 / f)), err))
for p, ei in zip(M['pts'], e): print('  %-28s %5.1f px' % (str(p[:3]), ei))
# camera world matrix for three.js: cv cam (x right, y down, z fwd) -> three cam (x right, y up, looks -z)
Rw = Rm.T; cpos = -Rw @ tv.reshape(3); Rt = Rw @ np.diag([1, -1, -1])
Mw = np.eye(4); Mw[:3, :3] = Rt; Mw[:3, 3] = cpos
cj = os.path.join(S, 'pcam-%s.json' % tag); json.dump({'m': Mw.T.reshape(-1).tolist(), 'fov': float(np.degrees(2 * np.arctan(H / 2 / f))), 'W': W, 'H': H}, open(cj, 'w'))
rp = os.path.join(S, 'pcam-%s.png' % tag); subprocess.run(['node', os.path.join(D, 'pcam.cjs'), rp, id, cj], check=True)
r = cv2.imread(rp, cv2.IMREAD_UNCHANGED); a = r[:, :, 3:4].astype(np.float32) / 255
model = (r[:, :, :3] * a + 255 * (1 - a)).astype(np.uint8)
g = cv2.cvtColor(r[:, :, :3], cv2.COLOR_BGR2GRAY); ed = cv2.Canny(g, 30, 90) | cv2.Canny((a[:, :, 0] * 255).astype(np.uint8), 50, 150)
ov = (im * 0.75).astype(np.uint8); ov[ed > 0] = (255, 0, 255)
K = np.array([[f, 0, W / 2], [0, f, H / 2], [0, 0, 1]]); pr, _ = cv2.projectPoints(P, rv, tv, K, None)
for (u, v), q in zip(U, pr.reshape(-1, 2)): cv2.circle(ov, (int(u), int(v)), 6, (0, 255, 0), 2); cv2.circle(ov, (int(q[0]), int(q[1])), 3, (0, 0, 255), -1)
cv2.imwrite(out, np.hstack([im, model, ov])); print('wrote', out)
