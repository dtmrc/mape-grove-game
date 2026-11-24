// Labels the showroom render into a review sheet: node tools/cars/sheet.cjs qa-out/showroom.png out.png
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [img, out] = process.argv.slice(2);
const { labels, specs } = JSON.parse(fs.readFileSync(img + '.json'));
const NAMES = { sedan: 'Meridian', hatch: 'Pipsqueak', wagon: 'Homestead', pickup: 'Haulmark', suv: 'HOA Enforcer', golfcart: 'Fairway' };
const DRIVE = { sedan: 'RWD', hatch: 'FWD', wagon: 'RWD', pickup: 'RWD', suv: 'AWD', golfcart: 'RWD' };
const USE = {
  sedan: 'Most common traffic car, parked cars', hatch: 'Traffic, street race (yours + rival)', wagon: "Traffic, Nana's car",
  pickup: 'Traffic, street race rival', suv: 'Not in traffic: HOA patrol at heat 2+', golfcart: 'HOA lot cart, heat-1 patrol',
};
const CARDS = [['sedan'], ['hatch'], ['wagon'], ['pickup'], ['suv'], ['golfcart'],
  ['sedan', 'Maple Grove PD cruiser', 'Police at any wanted level. 130 HP. Same sedan body, white + light bar'],
  ['suv', 'HOA Enforcer (patrol)', 'HOA chase vehicle at heat 2+, HOA door decal'],
  ['golfcart', "HOA cart / Gary's cart", "Heat-1 HOA patrol; Gary's getaway cart (140 HP)"]];
const card = ([t, title, note], i) => {
  const S = specs[t], kg = S.cart ? 520 : Math.round(1400 * S.mass), L = labels[i];
  const base = i < 6;
  return `<div class="c" style="left:${L.x}px;top:${L.y - 60}px"><b>${title || NAMES[t]}</b> <i>${t}</i><br>${base ?
    `<span>${S.len} × ${S.wid} m · ${kg} kg · ${DRIVE[t]}</span><br><span>Top ${Math.round(S.top * 2.237)} mph · accel ${S.acc} · grip ${S.grip}</span><br><em>${USE[t]}</em>` :
    `<em>${note}</em>`}</div>`;
};
const html = `<html><body style="margin:0;font-family:Helvetica,Arial,sans-serif"><div style="position:relative;width:3000px;height:1650px;background:url('file://${path.resolve(img)}')">
<div style="position:absolute;left:40px;top:28px;font-size:46px;font-weight:800;color:#20262c">Maple Grove: Off Leash, car lineup (today)</div>
<div style="position:absolute;left:42px;top:88px;font-size:22px;color:#4a525a">6 body types in models.js CAR_TYPES. Bottom row = role variants of the same bodies. Not shown: VFD fire truck (scripted, not drivable) and the hospital ambulance (static prop).</div>
${CARDS.map(card).join('')}</div>
<style>.c{position:absolute;width:420px;background:rgba(255,255,255,.92);border-radius:12px;padding:10px 14px;font-size:19px;line-height:1.35;color:#2a3036;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.c b{font-size:25px}.c i{color:#7a828a;font-style:normal;font-size:17px}.c em{color:#5a6470}</style></body></html>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 3000, height: 1650 } });
  const f = path.resolve('qa-out/_sheet.html'); fs.writeFileSync(f, html); await p.goto('file://' + f); await p.screenshot({ path: out }); await b.close(); })();
