// Hotkey map (src/js/hotkeys.js): ? opens the drawn keyboard, labels follow the platform (macOS / Windows / Linux),
// typing in a text field doesn't open it, Esc closes it and un-pauses. Also checks that every key src/js reads
// has a line in BINDINGS, so a new key can't be added without showing up on the map.
// Shots: qa-out/tests/hotkeys-<platform>.png and hotkeys-phone.png.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', '..', '..', 'src', 'js');
const OUT = path.join(__dirname, '..', '..', '..', 'qa-out', 'tests');
const NAMED = new Set(['enter', 'escape', 'tab', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'backspace', 'delete', 'punch', ' ']);
const isKey = (s) => s.length === 1 || NAMED.has(s) || /^f([1-9]|1[0-2])$/.test(s);
// every key name the game code reads: hit('x'), down('x'), ['x', 'y'].includes(k), k === 'x', e.key === 'F4'
function usedKeys() {
  const used = new Map();
  for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith('.js') && n !== 'hotkeys.js')) {
    const src = fs.readFileSync(path.join(SRC, f), 'utf8');
    const add = (s) => { s = s.toLowerCase(); if (isKey(s)) { if (!used.has(s)) used.set(s, new Set()); used.get(s).add(f); } };
    for (const m of src.matchAll(/\b(?:hit|down)\(([^()]*)\)/g)) for (const q of m[1].matchAll(/'([^']*)'/g)) add(q[1]);
    for (const m of src.matchAll(/\[([^\]]*)\]\.includes\(k\)/g)) for (const q of m[1].matchAll(/'([^']*)'/g)) add(q[1]);
    for (const m of src.matchAll(/\bk === '([^']+)'/g)) add(m[1]);
    for (const m of src.matchAll(/e\.key === '(F\d+)'/g)) add(m[1]);
  }
  for (const k of ['`', '~', '_', '+']) used.delete(k); // alternate characters of keys already covered (Backquote, Minus, Plus)
  return used;
}
module.exports = {
  name: 'hotkeys', desc: '? opens the drawn keyboard map, platform labels, text fields ignored, every game key listed',
  async run({ S, check }) {
    // 1. coverage: the table lists every key the code reads
    const covered = new Set(await S.js(() => [...window.__HOTKEYS.coveredKeys()]));
    const missing = [...usedKeys()].filter(([k]) => !covered.has(k)).map(([k, fs]) => `${JSON.stringify(k)} (${[...fs].join(', ')})`);
    check('every key the game reads has a line in BINDINGS (src/js/hotkeys.js)', missing.length === 0, { missing });

    // 2. ? opens it, pauses, Esc closes
    const vp0 = S.page.viewportSize();
    await S.page.setViewportSize({ width: 1280, height: 800 });
    const o = await S.js(() => {
      const H = window.__HOTKEYS, G = window.__G.G;
      if (H.isOpen) H.close();
      const was = G.paused;
      dispatchEvent(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true, bubbles: true }));
      const el = document.getElementById('hotkeys');
      return { open: H.isOpen, shown: !!el && getComputedStyle(el).display !== 'none', was, paused: G.paused, titleRows: [...document.querySelectorAll('#title table tr')].map((r) => r.cells[0].textContent) };
    });
    check('? opens the hotkey map and pauses the game', o.open && o.shown && o.paused === true, o);
    check('the title card key list comes from the table and mentions ?', o.titleRows.includes('?') && o.titleRows.length >= 8, o.titleRows);

    // 3. labels per platform + no sideways overflow; a shot of each
    const P = {};
    for (const p of ['mac', 'win', 'linux']) {
      P[p] = await S.js((p) => {
        window.__HOTKEYS.setPlatform(p);
        const c = document.querySelector('#hotkeys .hk-card'), kb = document.querySelector('#hotkeys .hk-kb');
        return { text: c.textContent, kbds: [...c.querySelectorAll('.hk-grp kbd')].map((k) => k.textContent), lit: [...document.querySelectorAll('#hotkeys .k.on')].map((k) => k.dataset.c), over: c.scrollWidth - c.clientWidth, kbW: kb.getBoundingClientRect().width, cardW: c.clientWidth, groups: document.querySelectorAll('#hotkeys .hk-grp').length };
      }, p);
      await S.page.screenshot({ path: path.join(OUT, `hotkeys-${p}.png`) }).catch(() => {});
    }
    const m = P.mac, w = P.win, l = P.linux;
    check('macOS shows ⌘ ⇧ and fn, never Ctrl or Win keys', /⌘/.test(m.text) && m.kbds.includes('⇧ shift') && m.kbds.includes('fn') && !m.kbds.includes('Ctrl') && !/⊞/.test(m.text), { kbds: m.kbds });
    check('macOS drops the forward Delete key (Backspace is "delete" there)', !m.kbds.includes('Delete') && m.kbds.includes('⌫ delete'), m.kbds);
    check('Windows shows Ctrl, Shift and the ⊞ key, no ⌘ or Super', w.kbds.includes('Ctrl') && w.kbds.includes('Shift ⇧') && /⊞/.test(w.text) && !/[⌘⌥]/.test(w.text) && !/Super/.test(w.text), { kbds: w.kbds });
    check('Linux shows Super, no ⊞ or ⌘', /Super/.test(l.text) && !/[⊞⌘]/.test(l.text) && l.kbds.includes('Ctrl'), { kbds: l.kbds });
    check('the drawn keyboard lights the game keys (W, Space, Shift, mouse, F4 in the dev build)', ['KeyW', 'Space', 'ShiftLeft', 'MouseL', 'Slash', 'F4'].every((c) => w.lit.includes(c)), w.lit);
    check('the map fits the window sideways at 1280 px', w.over <= 0 && w.kbW <= w.cardW, { over: w.over, kbW: w.kbW, cardW: w.cardW });
    await S.page.setViewportSize({ width: 390, height: 844 });
    const ph = await S.js(() => { window.__HOTKEYS.setPlatform('mac'); const c = document.querySelector('#hotkeys .hk-card'), kb = document.querySelector('#hotkeys .hk-board'); return { over: c.scrollWidth - c.clientWidth, kbW: kb.getBoundingClientRect().width, cardW: c.clientWidth }; });
    await S.page.screenshot({ path: path.join(OUT, 'hotkeys-phone.png') }).catch(() => {});
    check('no sideways scroll at phone width (390 px)', ph.over <= 0 && ph.kbW <= ph.cardW + 1, ph);
    await S.page.setViewportSize(vp0 || { width: 1280, height: 720 });

    // 4. keys are swallowed while open, Esc closes and un-pauses
    const c = await S.js(() => {
      const H = window.__HOTKEYS, G = window.__G.G;
      let leaked = false; const spy = () => { leaked = true; };
      addEventListener('keydown', spy);
      dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      removeEventListener('keydown', spy);
      return { leaked, open: H.isOpen, paused: G.paused };
    });
    check('keys do not reach the game while the map is open', !c.leaked, c);
    check('Esc closes the map and un-pauses', !c.open && c.paused === o.was, { ...c, was: o.was });

    // 5. typing ? in a text field does not open it
    const t = await S.js(() => {
      const inp = document.createElement('input'); document.body.appendChild(inp); inp.focus();
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
      const open = window.__HOTKEYS.isOpen; inp.remove(); window.__HOTKEYS.close();
      return { open };
    });
    check('typing ? in a text field does not open the map', !t.open, t);
  },
};
