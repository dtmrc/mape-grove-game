// Small shared UI for story scenes (haunted.js): an RPG-style panel (bars, a command list, a message box) driven by
// E / W / S or taps, a progress meter at the top of the screen, a white camera flash and a dark veil with a caption.
// No timers: everything advances on input or from the caller's update(dt), so it behaves under the QA frame clock.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function makeStoryUI({ Sfx, isTouch }) {
  const css = document.createElement('style');
  css.textContent = `
#storyui { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); width: min(780px, calc(100vw - 24px)); z-index: 58; display: none; font-size: 21px; line-height: 1.1; text-shadow: none; color: #e8eeff; }
#storyui.on { display: block; }
#storyui .bars { display: flex; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
#storyui .bar { flex: 1 1 30%; background: rgba(10, 14, 30, 0.88); border: 3px solid #c8c0a0; box-shadow: 4px 4px 0 #000; padding: 4px 10px; min-width: 150px; }
#storyui .bar b { font-weight: normal; letter-spacing: 2px; font-size: 17px; color: var(--gold, #ffd23f); }
#storyui .bar .hp { height: 10px; background: #2a2f44; border: 2px solid #000; margin-top: 3px; }
#storyui .bar .hp i { display: block; height: 100%; background: #6fe07a; transition: width 0.25s; }
#storyui .bar small { float: right; font-size: 17px; }
#storyui .box { display: flex; gap: 12px; background: rgba(10, 14, 30, 0.92); border: 3px solid #c8c0a0; box-shadow: 6px 6px 0 #000; padding: 8px 12px; min-height: 132px; }
#storyui .cmds { flex: 0 0 190px; border-right: 2px solid #44506a; padding-right: 10px; }
#storyui .cmd { padding: 2px 8px; margin: 2px 0; cursor: pointer; border: 2px solid transparent; font-size: 22px; white-space: nowrap; }
#storyui .cmd.sel { border-color: var(--gold, #ffd23f); background: #2a2f44; color: var(--gold, #ffd23f); }
#storyui .cmd.off { opacity: 0.4; }
#storyui .msg { flex: 1; cursor: pointer; }
#storyui .msg .who { font-size: 16px; letter-spacing: 3px; color: #ff8ab0; }
#storyui .msg .more { float: right; color: var(--gold, #ffd23f); animation: storyblink 0.8s steps(2) infinite; }
@keyframes storyblink { 50% { opacity: 0; } }
#storymeter { position: fixed; top: 74px; left: 50%; transform: translateX(-50%); width: min(420px, calc(100vw - 40px)); z-index: 31; display: none; pointer-events: none; text-shadow: 2px 2px 0 #000; text-align: center; font-size: 19px; color: #e8eeff; }
#storymeter .t { letter-spacing: 2px; color: var(--gold, #ffd23f); }
#storymeter .m { height: 12px; background: rgba(10, 14, 30, 0.85); border: 2px solid #000; margin: 3px 0; }
#storymeter .m i { display: block; height: 100%; background: #9ad0ff; }
#storymeter.warn .m i { background: #ff8a5a; }
#storyflash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 59; }
#storyveil { position: fixed; inset: 0; background: #0a0604; opacity: 0; pointer-events: none; z-index: 44; display: flex; align-items: center; justify-content: center; text-align: center; color: #f0d8b0; font-size: 26px; padding: 0 12%; text-shadow: 2px 2px 0 #000; }
@media (max-width: 600px) { #storyui { font-size: 18px; } #storyui .cmds { flex-basis: 130px; } #storyui .cmd { font-size: 18px; } }
`;
  document.head.appendChild(css);
  const el = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; document.body.appendChild(d); return d; };
  const ov = el('storyui', '<div class="bars"></div><div class="box"><div class="cmds"></div><div class="msg"></div></div>');
  const meterEl = el('storymeter', '<div class="t"></div><div class="m"><i></i></div><div class="s"></div>');
  const flashEl = el('storyflash'), veilEl = el('storyveil');
  const $ = (s) => ov.querySelector(s);
  const ui = { active: false, handler: null, flashT: 0 };

  /** Draw the panel. v = { bars: [{ name, val, max, unit, col }], cmds: [{ name, off }], sel, who, text, more } */
  ui.show = (v) => {
    ui.active = true; ov.classList.add('on'); document.body.classList.add('menu');
    const bars = v.bars || [];
    $('.bars').style.display = bars.length ? 'flex' : 'none';
    $('.bars').innerHTML = bars.map((b) => `<div class="bar"><b>${b.name}</b><small>${Math.max(0, Math.round(b.val))}/${b.max}${b.unit ? ' ' + b.unit : ''}</small><div class="hp"><i style="width:${clamp(b.val / b.max, 0, 1) * 100}%;${b.col ? `background:${b.col}` : ''}"></i></div></div>`).join('');
    const cmds = v.cmds || [];
    $('.cmds').style.display = cmds.length ? 'block' : 'none';
    $('.cmds').innerHTML = cmds.map((c, i) => `<div class="cmd${i === v.sel ? ' sel' : ''}${c.off ? ' off' : ''}" data-i="${i}">${c.name}</div>`).join('');
    $('.msg').innerHTML = `${v.who ? `<div class="who">${v.who}</div>` : ''}<div>${v.text || ''}</div>${v.more ? '<span class="more">▼</span>' : ''}`;
  };
  ui.hide = () => { ui.active = false; ui.handler = null; ov.classList.remove('on'); document.body.classList.remove('menu'); };
  /** Progress bar at the top. frac 0-1, or null to hide. */
  ui.meter = (title, frac, sub = '', warn = false) => {
    if (title === null || title === undefined) { meterEl.style.display = 'none'; return; }
    meterEl.style.display = 'block'; meterEl.classList.toggle('warn', !!warn);
    meterEl.querySelector('.t').textContent = title; meterEl.querySelector('.s').textContent = sub;
    meterEl.querySelector('.m i').style.width = `${clamp(frac, 0, 1) * 100}%`;
  };
  ui.flash = () => { ui.flashT = 0.5; flashEl.style.opacity = '1'; };
  ui.veil = (k, text = '') => { veilEl.style.opacity = String(clamp(k, 0, 1)); veilEl.textContent = text; };
  ui.update = (dt) => { if (ui.flashT > 0) { ui.flashT -= dt; flashEl.style.opacity = String(clamp(ui.flashT / 0.5, 0, 1)); } };

  ov.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (!ui.handler) return;
    const c = e.target.closest('.cmd');
    ui.handler.confirm(c ? +c.dataset.i : undefined);
  });
  addEventListener('keydown', (e) => {
    if (!ui.active || !ui.handler) return;
    const k = e.key.toLowerCase();
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    if (['w', 'arrowup'].includes(k)) { ui.handler.move && ui.handler.move(-1); Sfx.blip(440); }
    else if (['s', 'arrowdown'].includes(k)) { ui.handler.move && ui.handler.move(1); Sfx.blip(440); }
    else if (['e', 'f', 'enter', ' '].includes(k)) ui.handler.confirm();
  }, true);
  ui.isTouch = isTouch;
  return ui;
}
