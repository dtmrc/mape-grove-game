// hitchlog.js: says what happened in each long frame, on the device itself (2026-11-28).
// Settings > Show FPS turns it on. Under the fps line it lists the last long frames: how long the frame took, how much
// of that was the game's own JavaScript, and what was uploaded or created in it (texture megapixels, vertex kB, new
// shaders, people / cars spawned, house atlas swaps, render height changes). Costs nothing while the readout is off:
// the WebGL upload calls are only wrapped once it is first switched on.
const HL = { on: false, el: null, rows: [], total: 0, since: 0, c: null, notes: [], t0: 0, last: 0, med: 16.7, wrapped: false };
const zero = () => ({ texMP: 0, tex: 0, bufKB: 0, buf: 0, sh: 0 });
function wrap() {
  if (HL.wrapped || typeof WebGL2RenderingContext === 'undefined') return; HL.wrapped = true;
  const P = WebGL2RenderingContext.prototype;
  // (target, level, ifmt, w, h, border, fmt, type, data) | (target, level, ifmt, fmt, type, source) and the texSubImage twins
  const px = (k, a) => { if (a.length >= 9) return (k === 'texImage2D' ? a[3] * a[4] : a[4] * a[5]) || 0; const s = a[a.length - 1]; return (s && (s.width || s.videoWidth || 0) * (s.height || s.videoHeight || 0)) || 0; };
  for (const k of ['texImage2D', 'texSubImage2D']) { const o = P[k]; P[k] = function (...a) { if (HL.on) { const n = px(k, a); if (n > 4096) { HL.c.tex++; HL.c.texMP += n / 1e6; } } return o.apply(this, a); }; }
  const ob = P.bufferData; P.bufferData = function (...a) { if (HL.on) { HL.c.buf++; HL.c.bufKB += ((a[1] && a[1].byteLength) || 0) / 1e3; } return ob.apply(this, a); };
  const ol = P.linkProgram; P.linkProgram = function (...a) { if (HL.on) HL.c.sh++; return ol.apply(this, a); };
}
function draw() {
  if (!HL.el) return;
  const mins = Math.max(1 / 60, (performance.now() - HL.since) / 60000);
  HL.el.textContent = `long frames: ${HL.total} (${(HL.total / mins).toFixed(1)} per min)\n` + HL.rows.join('\n');
}
/** Something worth naming happened this frame ('ped', 'car', 'house', 'res' ...). */
export function hitchNote(s) { if (HL.on) HL.notes.push(s); }
export function hitchEnable(on) {
  HL.on = !!on;
  if (on) {
    wrap(); HL.c = zero(); HL.notes.length = 0; HL.last = 0; HL.total = 0; HL.rows.length = 0; HL.since = performance.now();
    if (!HL.el) { HL.el = document.createElement('pre'); HL.el.style.cssText = 'position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:70;margin:0;font:13px VT323,monospace;line-height:13px;color:#fd8;background:rgba(0,0,0,.55);padding:1px 6px;pointer-events:none;white-space:pre;text-align:left'; document.body.appendChild(HL.el); }
    draw();
  }
  if (HL.el) HL.el.style.display = on ? 'block' : 'none';
}
/** First thing in the frame callback. `skip` = paused, hidden tab or title screen (gaps there are not stutter). */
export function hitchFrame(skip) {
  if (!HL.on) return;
  const t = performance.now(), gap = HL.last ? t - HL.last : 0; HL.last = t;
  // the gap that just ended belongs to the PREVIOUS frame's work: its counters and notes are still in HL.c / HL.notes
  if (gap && !skip && !HL.skipPrev) {
    if (gap > Math.max(40, HL.med * 2.2) && gap < 3000) {
      const c = HL.c, bits = [`${Math.round(gap)}ms`, `js ${Math.round(HL.js)}`];
      if (c.tex) bits.push(`tex ${c.texMP.toFixed(1)}MP`); if (c.buf) bits.push(`vtx ${Math.round(c.bufKB)}kB/${c.buf}`); if (c.sh) bits.push(`shader ${c.sh}`);
      const n = {}; for (const s of HL.notes) n[s] = (n[s] || 0) + 1; for (const s in n) bits.push(n[s] > 1 ? `${s}x${n[s]}` : s);
      HL.rows.push(bits.join(' ')); if (HL.rows.length > 7) HL.rows.shift(); HL.total++; draw();
    } else HL.med += (gap - HL.med) * 0.05;
  }
  HL.skipPrev = !!skip; HL.c = zero(); HL.notes.length = 0; HL.js = 0;
  Promise.resolve().then(() => { HL.js = performance.now() - t; });   // runs right after the frame callback returns
}
export const hitchLog = HL;
