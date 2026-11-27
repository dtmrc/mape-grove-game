// Touch controls layout (style.css "touch layout" block): at phone and tablet sizes, portrait and landscape,
// with iPhone safe areas, no on-screen button overlaps another, the stick, the minimap or the clock panel,
// and every one stays inside the safe area. Shots go to qa-out/tests/touchui-<w>x<h>.png.
const path = require('path');
const SIZES = [
  // [label, w, h, insets top/right/bottom/left]
  ['se-portrait', 320, 568, [20, 0, 0, 0]],
  ['se2-portrait', 375, 667, [20, 0, 0, 0]],
  ['iphone13-portrait', 390, 844, [47, 0, 34, 0]],
  ['promax-portrait', 430, 932, [59, 0, 34, 0]],
  ['android-portrait', 360, 780, [24, 0, 0, 0]],
  ['se2-landscape', 667, 375, [0, 0, 0, 0]],
  ['iphone13-landscape', 844, 390, [0, 47, 21, 47]],
  ['promax-landscape', 932, 430, [0, 59, 21, 59]],
  ['android-landscape', 640, 360, [0, 0, 0, 0]],
  ['ipad-portrait', 768, 1024, [24, 0, 20, 0]],
];
const CONTROLS = ['pad', 'jumpbtn', 'actbtn', 'usebtn', 'pausebtn', 'mapbtn', 'questbtn', 'bagbtn', 'pdgunbtn', 'radiobtn', 'harmbtn', 'boobtn'];
module.exports = {
  name: 'touchui', desc: 'touch buttons never overlap each other, the stick or the HUD, portrait and landscape, with safe areas',
  async run({ S, check }) {
    const vp0 = S.page.viewportSize();
    for (const [label, w, h, ins] of SIZES) {
      await S.page.setViewportSize({ width: w, height: h });
      const r = await S.page.evaluate(({ ins, CONTROLS }) => {
        const b = document.body, root = document.documentElement.style;
        b.classList.add('touch'); b.classList.remove('titled', 'menu');
        ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].forEach((k, i) => root.setProperty(k, ins[i] + 'px'));
        const forced = [];
        let fake = null; // the RADIO tag is only added on touch devices: stand in a copy styled the same way
        if (!document.getElementById('radiobtn')) { fake = document.createElement('button'); fake.id = 'radiobtn'; fake.textContent = 'RADIO'; fake.style.cssText = 'position:fixed;font:18px VT323,monospace;border:2px solid #556;padding:4px 8px;'; document.body.append(fake); }
        for (const id of CONTROLS) { const e = document.getElementById(id); if (e && getComputedStyle(e).display === 'none') { e.style.setProperty('display', 'block', 'important'); forced.push(id); } }
        const box = (e) => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
        const got = {}; for (const id of CONTROLS) { const e = document.getElementById(id); if (e) got[id] = box(e); }
        const hud = { minimap: box(document.getElementById('minimap')), tr: box(document.getElementById('tr')) };
        // stars (wanted level) grow the clock panel; count them in as if 2 lines tall
        hud.tr.b = Math.max(hud.tr.b, hud.tr.t + 125);
        window.__touchuiUndo = () => { for (const id of forced) document.getElementById(id).style.removeProperty('display'); if (fake) fake.remove(); };
        return { got, hud, missing: CONTROLS.filter((id) => !got[id]) };
      }, { ins, CONTROLS });
      await S.page.screenshot({ path: path.join(__dirname, '..', '..', '..', 'qa-out', 'tests', `touchui-${label}.png`) }).catch(() => {});
      await S.page.evaluate(() => window.__touchuiUndo());
      const hit = (a, c) => a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5;
      const ids = Object.keys(r.got), clash = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (hit(r.got[ids[i]], r.got[ids[j]])) clash.push(ids[i] + '/' + ids[j]);
      for (const id of ids) for (const k in r.hud) if (hit(r.got[id], r.hud[k])) clash.push(id + '/' + k);
      const [t, rt, bt, lt] = ins, out = ids.filter((id) => { const q = r.got[id]; return q.l < lt - 0.5 || q.t < t - 0.5 || q.r > w - rt + 0.5 || q.b > h - bt + 0.5; });
      check(`${label} ${w}x${h}: every touch control exists`, !r.missing.length, r.missing);
      check(`${label} ${w}x${h}: no touch controls overlap`, !clash.length, clash);
      check(`${label} ${w}x${h}: all controls inside the safe area`, !out.length, out.map((id) => [id, r.got[id]]));
    }
    await S.page.evaluate(() => { document.body.classList.remove('touch'); ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].forEach((k) => document.documentElement.style.removeProperty(k)); });
    await S.page.setViewportSize(vp0 || { width: 1280, height: 720 });
  },
};
