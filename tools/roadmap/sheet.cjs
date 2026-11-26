// Side-by-side before/after road plan sheet. node tools/roadmap/sheet.cjs before.png after.png out.png
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [bp, ap, out] = process.argv.slice(2);
const img = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const html = `<html><body style="margin:0;background:#f3efe4;font-family:Helvetica,Arial,sans-serif;color:#24302a">
<div style="padding:34px 40px 10px"><div style="font-size:50px;font-weight:800">Road overhaul: before / after (as built)</div>
<div style="font-size:24px;color:#56625a;margin-top:6px">Every corner becomes a curve sized for its road; main roads stop stopping. Same towns, same buildings, same road list.</div></div>
<div style="display:flex;gap:30px;padding:10px 40px">
 <div><div style="font-size:32px;font-weight:800;margin:6px 0">TODAY</div><img src="${img(bp)}" style="width:1600px;border:3px solid #c9c2b0;border-radius:10px"></div>
 <div><div style="font-size:32px;font-weight:800;margin:6px 0">NOW (BUILT)</div><img src="${img(ap)}" style="width:1600px;border:3px solid #c9c2b0;border-radius:10px"></div>
</div>
<div style="display:flex;gap:60px;padding:16px 40px 40px;font-size:25px;line-height:1.5">
 <div style="flex:1"><b>Today</b><br>
  <span style="color:#e0262b;font-weight:800">Red ring</span> = sharp corner over 60° (9 of them, most are 90° with no curve at all)<br>
  <span style="color:#f08a1c;font-weight:800">Orange ring</span> = kink 15-60°<br>
  Every corner is a hard point: you brake to ~20 mph for each one.<br>
  🚦 = traffic light (10), 🛑 = all-way stop (11): AI traffic queues at every junction.</div>
 <div style="flex:1"><b>Proposed</b><br>
  <span style="color:#1d6b3a;font-weight:800">R40</span> = curve radius in metres. Speed you can hold through it:
  R20 ≈ 34 mph, R40 ≈ 48 mph, R55 ≈ 55 mph, R80 ≈ flat out on County Rd 12.<br>
  <span style="font-weight:800">○</span> = side road gives way, main road never stops. Lights only at the 4 busy town crossings. Downtown and the other 4-way crossroads stay square (Main St runs straight through).<br>
  Junctions on a curve: the side road joins at the middle of the bend (T-junction).</div>
</div></body></html>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 3310, height: 2000 } });
  await p.setContent(html); await p.screenshot({ path: out, fullPage: true }); await b.close(); })();
