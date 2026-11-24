
// ---------------------------------------------------------------- mannequin (diet, 2026-11-09)
// A genderless, unclothed grey base body: no chest, no hip flare. Built only from boxes, the way Legends-era figures
// are: a chamfered-box torso that tapers to the waist and widens a touch into a pelvis block, four-sided upper arms and
// forearms, box mitten hands with a thumb wedge, four-sided thighs and shins, oversized box boots-for-feet, the D head.
// Same skeleton and clips as buildNPC, so it animates and exports the same way.
const BOXC = [[-0.72, -1], [-1, -0.72], [-1, 0.72], [-0.72, 1], [0.72, 1], [1, 0.72], [1, -0.72], [0.72, -1]]; // torso: box with small chamfers
// shoulder cap cross-section (y, z): a box with deep chamfers, so it reads round without losing the flat faces
const CAP8 = [[-0.45, -1], [-1, -0.45], [-1, 0.45], [-0.45, 1], [0.45, 1], [1, 0.45], [1, -0.45], [0.45, -1]];
export function buildMannequin(opts = {}) {
  const S = opts.height ? opts.height / 1.75 : 1, grey = opts.color || '#9b9ea3';
  const M = {
    S, ankleY: 0.11 * S, kneeY: 0.49 * S, thighY: 0.84 * S, hipsY: 0.87 * S, spineY: 1.02 * S, chestY: 1.2 * S,
    shoulderY: 1.375 * S, neckY: 1.41 * S, headY: 1.48 * S, headH: 0.3 * S, headW: 0.125 * S, headD: 0.13 * S,
    armX: 0.205 * S, legX: 0.084 * S,
  };
  M.elbowX = M.armX + 0.27 * S; M.wristX = M.elbowX + 0.23 * S; M.handEndX = M.wristX + 0.13 * S; M.height = M.headY + M.headH;
  const bi = {}; BONES.forEach((n, i) => (bi[n] = i));
  const W1 = (n) => [[bi[n], 1]], W2 = (a, b, t = 0.5) => [[bi[a], 1 - t], [bi[b], t]];
  const sh = new Shelf(); const G = sh.add('grey', 16, 16); const R = { grey: G };
  const bd = new Builder();
  const ring = (y, w, d, wt, v, z = 0) => ({ c: [0, y * S, z * S], r1: w * S, r2: d * S, w: wt, v });
  // ---- torso: crotch block, pelvis, waist, ribcage, shoulders, and a sloped top into the neck
  loft(bd, [
    ring(0.8, 0.142, 0.096, W1('hips'), 0), ring(0.88, 0.142, 0.098, W1('hips'), 0.15), ring(0.96, 0.136, 0.094, W2('hips', 'spine'), 0.3),
    ring(1.04, 0.124, 0.088, W1('spine'), 0.45), ring(1.22, 0.175, 0.105, W1('chest'), 0.7), ring(1.36, 0.2, 0.1, W1('chest'), 0.86),
    ring(1.415, 0.19, 0.088, W1('chest'), 0.95), ring(1.44, 0.08, 0.062, W1('chest'), 1),
  ], 8, G, { pts: BOXC, capStart: true, capEnd: true });
  // ---- neck: a short square post
  loft(bd, [ring(1.4, 0.045, 0.045, W1('neck'), 0), ring(1.53, 0.043, 0.043, W1('head'), 1)], 4, G, { pts: BOX4 });
  // ---- head: the D profile from the average male, blank (no face painted)
  const hy = M.headY, H = M.headH, hw = M.headW, hd = M.headD;
  loft(bd, [
    { c: [0, hy, hd * 0.12], r1: hw * 0.58, r2: hd * 0.6, w: W1('head'), v: 0 },                    // under the chin, pulled forward so the skull curves in at the back
    { c: [0, hy + H * 0.07, hd * 0.05], r1: hw * 0.8, r2: hd * 0.85, w: W1('head'), v: 0.07 },
    { c: [0, hy + H * 0.16, 0], r1: hw * 0.9, r2: hd * 0.97, w: W1('head'), v: 0.16 },
    { c: [0, hy + H * 0.5, 0], r1: hw, r2: hd, w: W1('head'), v: 0.5 },
    { c: [0, hy + H * 0.84, 0], r1: hw * 0.96, r2: hd * 0.98, w: W1('head'), v: 0.84 },
    { c: [0, hy + H, -hd * 0.1], r1: hw * 0.62, r2: hd * 0.64, w: W1('head'), v: 1 },
  ], 8, G, { pts: D8, capStart: true, capEnd: true });
  // ---- arms (T-pose along x): square upper arm and forearm that taper to the wrist, a mitten hand and a thumb wedge
  const xr = (x, y, h, d, wt, v) => ({ c: [x, y, 0], r1: h * S, r2: d * S, w: wt, v });
  for (const s of [1, -1]) {
    const L = s > 0 ? '_L' : '_R', y = M.shoulderY - 0.012 * S;
    // upper arm in ONE piece: it starts inside the shoulder, swells into a round-ish cap (deep chamfers) right over the
    // joint, then turns into a near-square arm (small chamfers) down to the elbow. No overlapping parts, so no slivers.
    const cap = (x, h, d, wt, v) => ({ ...xr(x, y, h, d, wt, v), pts: CAP8 }), sq = (x, h, d, wt, v) => ({ ...xr(x, y, h, d, wt, v), pts: BOXC });
    loft(bd, [
      cap(s * (M.armX - 0.05 * S), 0.05, 0.06, W2('chest', 'arm' + L, 0.5), 0),
      cap(s * (M.armX - 0.012 * S), 0.062, 0.066, W1('arm' + L), 0.08),
      cap(s * (M.armX + 0.03 * S), 0.064, 0.065, W1('arm' + L), 0.14),
      sq(s * (M.armX + 0.075 * S), 0.056, 0.056, W1('arm' + L), 0.22),
      sq(s * (M.elbowX + 0.012 * S), 0.046, 0.047, W2('arm' + L, 'forearm' + L, 0.5), 0.5),
    ], 8, G, { axis: 'x', pts: BOXC, capStart: true });
    loft(bd, [xr(s * (M.elbowX - 0.005 * S), y, 0.045, 0.046, W2('arm' + L, 'forearm' + L, 0.5), 0.5), xr(s * (M.elbowX + 0.07 * S), y, 0.048, 0.049, W1('forearm' + L), 0.6), xr(s * (M.wristX + 0.005 * S), y, 0.035, 0.038, W1('forearm' + L), 1)], 8, G, { axis: 'x', pts: BOXC, capEnd: true });
    // hand: a thick mitten, a little wider at the knuckles than at the wrist, the fingertips squared off
    loft(bd, [xr(s * (M.wristX - 0.008 * S), y - 0.004 * S, 0.038, 0.048, W1('hand' + L), 0), xr(s * (M.wristX + 0.07 * S), y - 0.006 * S, 0.042, 0.058, W1('hand' + L), 0.6), xr(s * (M.handEndX), y - 0.012 * S, 0.03, 0.054, W1('hand' + L), 1)], 4, G, { axis: 'x', pts: BOX4, capStart: true, capEnd: true });
    const tx = s * (M.wristX + 0.015 * S), w = W1('hand' + L);
    wedge(bd, [[tx, y + 0.014 * S, 0.046 * S], [tx + s * 0.045 * S, y + 0.014 * S, 0.052 * S], [tx + s * 0.045 * S, y - 0.024 * S, 0.052 * S], [tx, y - 0.024 * S, 0.046 * S]], [tx + s * 0.06 * S, y - 0.01 * S, 0.088 * S], w, G);
  }
  // ---- legs: square thighs that taper to a knee block, square shins with a slight calf, rings at the knee to bend
  for (const s of [1, -1]) {
    const L = s > 0 ? '_L' : '_R', x = s * M.legX;
    const yr = (y, w, d, wt, v, z = 0) => ({ c: [x, y * S, z * S], r1: w * S, r2: d * S, w: wt, v });
    loft(bd, [
      yr(0.86, 0.05, 0.072, W1('thigh' + L), 0), yr(0.79, 0.052, 0.074, W1('thigh' + L), 0.1), yr(0.72, 0.05, 0.07, W1('thigh' + L), 0.2), yr(0.54, 0.046, 0.056, W1('thigh' + L), 0.4),
      yr(0.49, 0.048, 0.058, W2('thigh' + L, 'shin' + L), 0.45), yr(0.44, 0.046, 0.054, W1('shin' + L), 0.5),
      yr(0.34, 0.05, 0.06, W1('shin' + L), 0.62, -0.008), yr(0.16, 0.042, 0.046, W1('shin' + L), 0.9), yr(0.13, 0.042, 0.046, W1('foot' + L), 1),
    ], 4, G, { pts: BOX4, capStart: true });
    // foot: an oversized block with the toe sloping down (Legends boots are a third of the shin's length)
    const fw = 0.14 * S, fh = 0.15 * S, z0 = -0.09 * S, z1 = 0.25 * S, ztoe = 0.1 * S, k = 0.38, wgt = W1('foot' + L), P = G;
    const Q = (p) => bd.quad(p, [[P.x + 1, P.y + P.h - 1], [P.x + P.w - 1, P.y + P.h - 1], [P.x + P.w - 1, P.y + 1], [P.x + 1, P.y + 1]], [wgt, wgt, wgt, wgt], [x, fh / 2, 0.05 * S]);
    const xl = x - fw / 2, xrr = x + fw / 2;
    Q([[xl, 0, z0], [xrr, 0, z0], [xrr, fh, z0], [xl, fh, z0]]); Q([[xl, 0, z1], [xrr, 0, z1], [xrr, fh * k, z1], [xl, fh * k, z1]]);
    Q([[xl, fh, z0], [xrr, fh, z0], [xrr, fh, ztoe], [xl, fh, ztoe]]); Q([[xl, fh, ztoe], [xrr, fh, ztoe], [xrr, fh * k, z1], [xl, fh * k, z1]]);
    for (const xs of [xl, xrr]) { Q([[xs, 0, z0], [xs, 0, z1], [xs, fh * k, z1], [xs, fh, ztoe]]); bd.tri([[xs, fh, ztoe], [xs, fh, z0], [xs, 0, z0]], [[P.x + 1, P.y + 1], [P.x + P.w - 1, P.y + 1], [P.x + P.w - 1, P.y + P.h - 1]], [wgt, wgt, wgt], [x, fh / 2, 0.05 * S]); }
    Q([[xl, 0, z0], [xrr, 0, z0], [xrr, 0, z1], [xl, 0, z1]]);
  }
  // ---- texture: one flat grey; the baked tones in the vertex colours do the shading
  const cv = document.createElement('canvas'); cv.width = cv.height = ATLAS; const g = cv.getContext('2d');
  g.fillStyle = grey; g.fillRect(0, 0, ATLAS, ATLAS);
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true });
  const pos = {
    hips: [0, M.hipsY, 0], spine: [0, M.spineY, 0], chest: [0, M.chestY, 0], neck: [0, M.neckY, 0], head: [0, M.headY, 0], head_end: [0, M.height, 0],
    thigh_L: [M.legX, M.thighY, 0], shin_L: [M.legX, M.kneeY, 0], foot_L: [M.legX, M.ankleY, 0], toe_L: [M.legX, 0.02, 0.18 * S],
    thigh_R: [-M.legX, M.thighY, 0], shin_R: [-M.legX, M.kneeY, 0], foot_R: [-M.legX, M.ankleY, 0], toe_R: [-M.legX, 0.02, 0.18 * S],
    shoulder_L: [0.06 * S, M.shoulderY, 0], arm_L: [M.armX, M.shoulderY, 0], forearm_L: [M.elbowX, M.shoulderY, 0], hand_L: [M.wristX, M.shoulderY, 0], hand_end_L: [M.handEndX, M.shoulderY, 0],
    shoulder_R: [-0.06 * S, M.shoulderY, 0], arm_R: [-M.armX, M.shoulderY, 0], forearm_R: [-M.elbowX, M.shoulderY, 0], hand_R: [-M.wristX, M.shoulderY, 0], hand_end_R: [-M.handEndX, M.shoulderY, 0],
  };
  const bones = BONES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  BONES.forEach((n, i) => { const p = PARENT[n]; const pp = p ? pos[p] : [0, 0, 0]; bones[i].position.set(pos[n][0] - pp[0], pos[n][1] - pp[1], pos[n][2] - pp[2]); if (p) bones[bi[p]].add(bones[i]); });
  const mesh = new THREE.SkinnedMesh(bd.geometry(), mat); mesh.name = 'Mannequin'; mesh.frustumCulled = false;
  const root = new THREE.Group(); root.name = opts.name || 'mannequin';
  root.add(mesh); mesh.add(bones[0]); root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  const clips = makeClips(M.hipsY), mixer = new THREE.AnimationMixer(root), actions = {}; clips.forEach((c) => (actions[c.name] = mixer.clipAction(c)));
  let cur = null;
  const npc = {
    root, mesh, bones, clips, mixer, texture: tex, recipe: { kind: 'mannequin', ...opts }, height: M.height, tris: bd.tris, R,
    play(name, fade = 0.15) { const a = actions[name]; if (!a || a === cur) return; a.reset().play(); if (cur) cur.crossFadeTo(a, fade, false); else a.setEffectiveWeight(1); cur = a; },
    update(dt) { mixer.update(dt); },
    dispose() { mesh.geometry.dispose(); mat.dispose(); tex.dispose(); },
  };
  root.userData.npc = npc;
  return npc;
}
