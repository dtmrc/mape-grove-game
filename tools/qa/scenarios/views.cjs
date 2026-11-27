// Fixed-camera render comparison shots (same eye + target every run, so before/after line up).
// node tools/qa/qa.cjs run tools/qa/scenarios/views.cjs --tag before [--only name,name] [--time 12]
// Spot = [name, eyeX, eyeY(above ground), eyeZ, lookX, lookY(above ground), lookZ]
const SPOTS = [
  ['downtown', 18, 7, 22, -6, 2, -14],
  ['mainst', 60, 5, -6, 0, 2, -2],
  ['estates', -105, 10, -40, -132, 2, -62],
  ['school', 70, 12, 10, 100, 3, -20],
  ['woods', -110, 6, 60, -140, 4, 90],
  ['country', 150, 6, -4, 230, 2, 4],
  ['lake', 0, 9, 50, 25, 1, 95],
  ['pinehollow', 50, 8, 60, 80, 2, 40],
  ['storefronts', 8, 3, 8, -30, 3, 14],
  ['schoolfront', 114, 3, 5, 98, 4, -22],
  ['treesclose', 5, 2.5, 70, 25, 3, 100],
  ['roadclose', 40, 1.8, -1, 70, 0, -1],
  ['pines', -110, 3, 40, -126, 4.5, 47],
  ['roundtree', -4, 3, -50, -14, 3.5, -58],
  ['house1', 102, 2.6, 47, 112, 2.6, 32],
  ['house2', 104, 3.2, 45, 114, 3.6, 58.5],
  ['nana', -92, 3, 26, -106, 3, 16],
  ['quikfront', 23, 2.4, -18, 30, 2.6, -37],
  ['donutfront', -39, 2.2, 5, -44, 2.2, 18],
  ['schoolback', 92, 5, -56, 100, 4, -36],
  ['police', -60, 3, 6, -68, 3, 24],
  ['hospital', 200, 4, 70, 212, 5, 40],
];
module.exports = async ({ S, shot, args }) => {
  const only = args.only ? String(args.only).split(',') : null;
  const hour = args.time !== undefined ? Number(args.time) : 12;
  await S.js((h) => window.QA.time(h, { freeze: true }), hour);
  await S.js(() => window.QA.hud(false));
  const shotO = { hud: false };
  const out = [];
  for (const sp of SPOTS) {
    const [name, ex, ey, ez, lx, ly, lz] = sp;
    if (only && !only.includes(name)) continue;
    await S.tp(`${ex},${ez}`);
    await S.js((sp) => {
      const [, ex, ey, ez, lx, ly, lz] = sp;
      const G = window.__G, cam = G.camera, proto = Object.getPrototypeOf(cam);
      const hA = (x, z) => (window.__TER?.heightAt ? window.__TER.heightAt(x, z) : 0);
      const e = [ex, ey + hA(ex, ez), ez], l = [lx, ly + hA(lx, lz), lz];
      cam.updateMatrixWorld = function () { this.position.set(...e); this.up.set(0, 1, 0); this.lookAt(...l); proto.updateMatrixWorld.call(this, true); };
      G.cat.visible = false;
    }, sp);
    await S.js(() => window.QA.frames(6));
    out.push(await shot(`${args.tag || 'view'}-${name}`, shotO));
  }
  return out;
};
