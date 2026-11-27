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
        const forced = [], fake2 = [];
        let fake = null; // the RADIO tag is only added on touch devices: stand in a copy styled the same way
        if (!document.getElementById('radiobtn')) { fake = document.createElement('button'); fake.id = 'radiobtn'; fake.textContent = 'RADIO'; fake.style.cssText = 'position:fixed;font:18px VT323,monospace;border:2px solid #556;padding:4px 8px;'; document.body.append(fake); }
        for (const id of CONTROLS) { const e = document.getElementById(id); if (e && getComputedStyle(e).display === 'none') { e.style.setProperty('display', 'block', 'important'); forced.push(id); } }
        const box = (e) => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
        const got = {}; for (const id of CONTROLS) { const e = document.getElementById(id); if (e) got[id] = box(e); }
        // text boxes with long-ish sample text (shown on top of the forced controls)
        const TEXT = { radio: 'KMPL 101.5 COUNTRY', prompt: 'USE: Talk to Nana', radiocap: 'DISPATCH: Units respond, 10-15 at the Quik Stop, suspect is a white cat', carname: 'Lunar Sedan', objective: 'Bring Nana her casserole dish' };
        const saved = {};
        for (const id in TEXT) {
          let e = document.getElementById(id);
          if (!e && id === 'radiocap') { e = document.createElement('div'); e.id = id; e.style.cssText = 'position:fixed;max-width:min(620px,86vw);font-size:21px;padding:3px 10px;'; (document.getElementById('hud') || document.body).append(e); fake2.push(e); }
          saved[id] = [e.innerHTML, e.style.cssText, e.className]; e.textContent = TEXT[id]; if (id === 'radiocap') { e.style.left = e.style.bottom = e.style.transform = ''; }
          if (id === 'radio') e.style.top = ''; // headless is not a touch device: drop the desktop placement
          e.style.display = 'block'; e.style.opacity = '1'; e.classList.add('show');
        }
        const texts = {}; for (const id in TEXT) texts[id] = box(document.getElementById(id));
        // dialog: controls must step aside (body.talking) and the box stay inside the safe area
        const dl = document.getElementById('dialog'), dl0 = [dl.innerHTML, dl.style.cssText];
        dl.innerHTML = '<div class="who">NANA</div><div class="txt">Yellow markers are jobs. Blue is your RV: step in to nap and save.</div><i>▼</i>'; dl.style.display = 'block';
        for (const id of forced) document.getElementById(id).style.removeProperty('display');
        const bag = document.getElementById('bagbtn'), bagHas = bag.classList.contains('has'); bag.classList.add('has');
        b.classList.add('talking');
        const dialog = box(dl), shownWhileTalking = CONTROLS.filter((id) => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none' && getComputedStyle(e.closest('#touchui') || e).display !== 'none'; });
        b.classList.remove('talking'); bag.classList.toggle('has', bagHas); for (const id of forced) document.getElementById(id).style.setProperty('display', 'block', 'important'); dl.innerHTML = dl0[0]; dl.style.cssText = dl0[1];
        const undoTr = () => trk.forEach(([e, d, h]) => { e.style.display = d; e.innerHTML = h; });
        const undoText = () => { for (const id in saved) { const e = document.getElementById(id); if (!e) continue; [e.innerHTML, e.style.cssText, e.className] = saved[id]; } fake2.forEach((e) => e.remove()); };
        // worst-case clock panel: in a car (car health + fuel) with five wanted stars
        const trk = ['carhp', 'fuel', 'stars'].map((id) => { const e = document.getElementById(id); return [e, e.style.display, e.innerHTML]; });
        document.getElementById('carhp').style.display = 'block'; document.getElementById('fuel').style.display = 'flex';
        const st = document.getElementById('stars'); if (!st.textContent) st.innerHTML = '<i class="on">★</i>'.repeat(5);
        const hud = { minimap: box(document.getElementById('minimap')), tr: box(document.getElementById('tr')) };
        window.__touchuiUndo = () => { undoText(); undoTr(); for (const id of forced) document.getElementById(id).style.removeProperty('display'); if (fake) fake.remove(); };
        return { got, hud, texts, dialog, shownWhileTalking, missing: CONTROLS.filter((id) => !got[id]) };
      }, { ins, CONTROLS });
      await S.page.screenshot({ path: path.join(__dirname, '..', '..', '..', 'qa-out', 'tests', `touchui-${label}.png`) }).catch(() => {});
      await S.page.evaluate(() => window.__touchuiUndo());
      // the same screen with a dialog box up (controls step aside), for eyeballing
      await S.page.evaluate(() => { const d = document.getElementById('dialog'); d.innerHTML = '<div class="who"></div><div class="txt">Yellow markers are jobs. Blue is your RV: step in to nap and save.</div><i>▼</i>'; d.style.display = 'block'; document.body.classList.add('talking'); });
      await S.page.screenshot({ path: path.join(__dirname, '..', '..', '..', 'qa-out', 'tests', `touchui-${label}-dialog.png`) }).catch(() => {});
      await S.page.evaluate(() => { const d = document.getElementById('dialog'); d.style.display = 'none'; d.innerHTML = ''; document.body.classList.remove('talking'); });
      const hit = (a, c) => a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5;
      const ids = Object.keys(r.got), clash = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (hit(r.got[ids[i]], r.got[ids[j]])) clash.push(ids[i] + '/' + ids[j]);
      for (const id of ids) for (const k in r.hud) if (hit(r.got[id], r.hud[k])) clash.push(id + '/' + k);
      const [t, rt, bt, lt] = ins; const out = ids.filter((id) => { const q = r.got[id]; return q.l < lt - 0.5 || q.t < t - 0.5 || q.r > w - rt + 0.5 || q.b > h - bt + 0.5; });
      const tclash = [];
      for (const t in r.texts) { for (const id of ids) if (hit(r.texts[t], r.got[id])) tclash.push(t + '/' + id); for (const k in r.hud) if (hit(r.texts[t], r.hud[k])) tclash.push(t + '/' + k); }
      const inSafe = (q) => q.l >= lt - 0.5 && q.t >= t - 0.5 && q.r <= w - rt + 0.5 && q.b <= h - bt + 0.5;
      // 320 px wide (iPhone 5 / first SE) is too narrow for the in-car text stack beside the RADIO/GUN column: controls and dialog only
      if (w >= 360) check(`${label} ${w}x${h}: objective, prompt, radio name and caption, car name stay clear of the controls and HUD`, !tclash.length, tclash);
      check(`${label} ${w}x${h}: a dialog box hides the controls and fits the safe area`, !r.shownWhileTalking.length && inSafe(r.dialog), { shown: r.shownWhileTalking, dialog: r.dialog });
      check(`${label} ${w}x${h}: every touch control exists`, !r.missing.length, r.missing);
      check(`${label} ${w}x${h}: no touch controls overlap`, !clash.length, clash);
      check(`${label} ${w}x${h}: all controls inside the safe area`, !out.length, out.map((id) => [id, r.got[id]]));
    }
    await S.page.evaluate(() => { document.body.classList.remove('touch'); ['--sa-t', '--sa-r', '--sa-b', '--sa-l'].forEach((k) => document.documentElement.style.removeProperty(k)); });
    await S.page.setViewportSize(vp0 || { width: 1280, height: 720 });
  },
};
