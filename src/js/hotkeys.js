// Keyboard hotkeys: ONE table (BINDINGS) is the source of truth for every keyboard key in the game.
// Press ? for a drawn keyboard + keycap cards built from it, labelled for the player's platform
// (macOS ⌘ ⌥ ⌃ ⇧ / Windows Ctrl Alt Win / Linux Ctrl Alt Super). The title card's key list and
// pause > CONTROLS are built from the same table, and QA suite 27-hotkeys fails when a key that
// src/js reads has no line here.
//
// ADD A KEY = one line in BINDINGS: { g: 'group', k: 'keys', does: 'what it does' }
//   k     alternatives split by ' / ', combos by '+'. Tokens: A-Z 0-9, WASD, Arrows, Up Down Left Right,
//         Space Enter Esc Tab Shift Ctrl Alt Mod (⌘ on macOS, Ctrl elsewhere) Backspace Delete F1-F12
//         Minus Plus Backquote LBracket RBracket 1-9 ? Click (left mouse button) Mouse (move the mouse).
//         Suffix @mac or @!mac shows that alternative on one platform only (e.g. 'Delete@!mac').
//   t     short text: the row also goes in pause > CONTROLS; title: 1 puts it on the title card too.
//   hold  drawn as "hold".     when  () => bool, the row is hidden while it returns false.
const devOn = () => !window.__MG_SHARE && (!!window.__MG_DEV || !document.body.classList.contains('nodev'));
const weatherOn = () => !!(window.__G && window.__G.fx && window.__G.fx.weatherOn);

export const GROUPS = [
  { id: 'foot', name: 'On foot', c: '#ffd23f' },
  { id: 'car', name: 'Driving', c: '#5fb0ff' },
  { id: 'radio', name: 'Car radio', c: '#ff8ab0', note: 'in any car' },
  { id: 'menu', name: 'Menus & map', c: '#7fe07f' },
  { id: 'fish', name: 'Fishing', c: '#3ad0b8', note: 'at the lake' },
  { id: 'game', name: 'Game', c: '#e8dcb8' },
  { id: 'dev', name: 'Dev tools', c: '#ff9a3c', when: devOn },
  { id: 'edit', name: 'World editor', c: '#c77dff', note: 'while editing (F3)', when: devOn },
];

export const BINDINGS = [
  { g: 'foot', k: 'WASD / Arrows', does: 'walk', t: 'move, or drive', title: 1 },
  { g: 'foot', k: 'Mouse', does: 'look around (click the game to lock the mouse)', t: 'look (click to lock)', title: 1 },
  { g: 'foot', k: 'Shift', hold: 1, does: 'sprint', t: 'sprint', title: 1 },
  { g: 'foot', k: 'Space', does: 'jump · tap again in the air for a double, then triple jump · climb up', t: 'jump (tap again in the air) / handbrake', title: 1 },
  { g: 'foot', k: 'E / F / Enter', does: 'talk, use, get in or out of a car', t: 'talk, get in or out', title: 1 },
  { g: 'foot', k: 'Click / J / K', does: 'paw swipe (fires the gun when it is out)', t: 'paw swipe', title: 1 },
  { g: 'foot', k: 'Q', does: 'draw or holster the gun', t: 'holster' },
  { g: 'foot', k: 'Click / Space / E', does: 'mash to wriggle out of handcuffs' },
  { g: 'foot', k: 'H', does: 'play the harmonica (once you have one)' },
  { g: 'foot', k: 'G', does: 'call your ghostly friend (after his story)' },
  { g: 'car', k: 'WASD / Arrows', does: 'gas, brake and reverse, steer' },
  { g: 'car', k: 'Space / B', does: 'handbrake (drift)' },
  { g: 'car', k: 'E / F / Enter', does: 'get out' },
  { g: 'car', k: 'H', does: 'horn · siren in the fire engine and ambulance', t: 'horn (siren in the fire engine and ambulance)', title: 1 },
  { g: 'radio', k: 'R', does: 'next station (turns the radio on)', t: 'radio station (in a car)', title: 1 },
  { g: 'radio', k: 'Shift+R', does: 'radio on / off', t: 'radio on / off' },
  { g: 'radio', k: 'Minus / Plus', does: 'volume down / up', t: 'radio volume' },
  { g: 'menu', k: 'Esc', does: 'pause menu (also frees the mouse)', t: 'pause menu', title: 1 },
  { g: 'menu', k: 'Tab', does: 'town map (tap to toggle, hold to peek)', t: 'town map', title: 1 },
  { g: 'menu', k: 'L', does: 'quest log', t: 'quest log' },
  { g: 'menu', k: 'C / Backspace / Delete@!mac', does: 'remove your marker (on the map)' },
  { g: 'menu', k: 'W / S / Up / Down', does: 'choose in menus and quest log' },
  { g: 'menu', k: 'A / D / Left / Right', does: 'change a setting' },
  { g: 'menu', k: 'E / Enter / Space', does: 'confirm, next line of dialogue' },
  { g: 'menu', k: 'Esc / Q', does: 'back, close' },
  { g: 'fish', k: 'E / F / Enter / Click', hold: 1, does: 'cast · strike on a bite · hold to reel' },
  { g: 'fish', k: 'I / B', does: 'fishing bag', t: 'fishing bag' },
  { g: 'game', k: '?', does: 'this keyboard map', t: 'every key, drawn', title: 1 },
  { g: 'game', k: 'M', does: 'sound on / off', t: 'sound on / off' },
  { g: 'game', k: 'P', does: 'render resolution', t: 'render resolution' },
  { g: 'game', k: 'O', does: 'change the weather', when: weatherOn },
  { g: 'dev', k: 'Backquote', does: 'time-of-day menu' },
  { g: 'dev', k: 'F2', does: 'dev panel' },
  { g: 'dev', k: 'F3', does: 'world editor on / off (steps out of a room first)' },
  { g: 'dev', k: 'F4', does: 'cheats panel', when: () => !!window.__MG_DEV },
  { g: 'edit', k: '1-9', does: 'editor tabs' },
  { g: 'edit', k: 'Q / E', does: 'rotate the selection (with Shift: 1°)' },
  { g: 'edit', k: 'LBracket / RBracket', does: 'brush smaller / bigger' },
  { g: 'edit', k: 'Mod+Z', does: 'undo' },
  { g: 'edit', k: 'Delete@!mac / Backspace', does: 'delete the selection or last point' },
  { g: 'edit', k: 'Enter', does: 'finish a road or shape' },
  { g: 'edit', k: 'Esc', does: 'deselect, cancel a shape' },
];

// ---------------- platform ----------------
export const PLATFORMS = { mac: 'macOS', win: 'Windows', linux: 'Linux' };
export function detectPlatform() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const p = ((nav.userAgentData && nav.userAgentData.platform) || nav.platform || '') + ' ' + (nav.userAgent || '');
  if (/mac|iphone|ipad|ipod/i.test(p)) return 'mac';
  if (/win/i.test(p)) return 'win';
  return 'linux'; // Linux, ChromeOS, BSD
}
const isCros = () => typeof navigator !== 'undefined' && /CrOS/.test(navigator.userAgent || '');
const PLAT_KEY = 'maple-grove-offleash-kbd';
let plat = (() => {
  try { const q = new URLSearchParams(location.search).get('kbd'); if (PLATFORMS[q]) return q; } catch (e) { /* no location */ }
  try { const s = localStorage.getItem(PLAT_KEY); if (PLATFORMS[s]) return s; } catch (e) { /* storage blocked */ }
  return detectPlatform();
})();

// ---------------- tokens ----------------
// cap: label (string, or per platform), codes: physical keys lit on the drawn keyboard, keys: e.key names the game reads
const P3 = (mac, other, linux = other) => ({ mac, win: other, linux });
const TOK = {
  WASD: { cluster: ['W', 'A', 'S', 'D'], codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD'], keys: ['w', 'a', 's', 'd'], text: 'WASD' },
  Arrows: { cluster: ['↑', '←', '↓', '→'], codes: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'], keys: ['arrowup', 'arrowleft', 'arrowdown', 'arrowright'], text: 'arrows' },
  Up: { cap: '↑', codes: ['ArrowUp'], keys: ['arrowup'] }, Down: { cap: '↓', codes: ['ArrowDown'], keys: ['arrowdown'] },
  Left: { cap: '←', codes: ['ArrowLeft'], keys: ['arrowleft'] }, Right: { cap: '→', codes: ['ArrowRight'], keys: ['arrowright'] },
  Space: { cap: P3('space', 'Space'), codes: ['Space'], keys: [' '], wide: 1 },
  Enter: { cap: P3('↩ return', 'Enter ↵'), codes: ['Enter'], keys: ['enter'] },
  Esc: { cap: P3('esc', 'Esc'), codes: ['Escape'], keys: ['escape'] },
  Tab: { cap: P3('⇥ tab', 'Tab ⇥'), codes: ['Tab'], keys: ['tab'] },
  Shift: { cap: P3('⇧ shift', 'Shift ⇧'), codes: ['ShiftLeft', 'ShiftRight'], keys: ['shift'] },
  Ctrl: { cap: P3('⌃ control', 'Ctrl'), codes: ['ControlLeft', 'ControlRight'], keys: ['control'] },
  Alt: { cap: P3('⌥ option', 'Alt'), codes: ['AltLeft', 'AltRight'], keys: ['alt'] },
  Mod: { cap: P3('⌘ cmd', 'Ctrl'), codes: { mac: ['MetaLeft', 'MetaRight'], win: ['ControlLeft', 'ControlRight'], linux: ['ControlLeft', 'ControlRight'] }, keys: [] },
  Backspace: { cap: P3('⌫ delete', 'Backspace ⌫'), codes: ['Backspace'], keys: ['backspace'] },
  Delete: { cap: 'Delete', codes: [], keys: ['delete'] },
  Minus: { cap: '−', codes: ['Minus'], keys: ['-', '_'] },
  Plus: { cap: '+', codes: ['Equal'], keys: ['=', '+'] },
  Backquote: { cap: '`', codes: ['Backquote'], keys: ['`', '~'] },
  LBracket: { cap: '[', codes: ['BracketLeft'], keys: ['['] }, RBracket: { cap: ']', codes: ['BracketRight'], keys: [']'] },
  '?': { cap: '?', codes: ['Slash'], keys: ['?'] },
  '1-9': { cap: '1 … 9', codes: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => 'Digit' + d), keys: '123456789'.split('') },
  Click: { mouse: 'click', codes: ['MouseL'], keys: ['punch'], text: 'Click' },
  Mouse: { mouse: 'move', codes: ['MouseMove'], keys: [], text: 'Mouse' },
  fn: { cap: 'fn', codes: ['Fn'], keys: [] },
};
export function token(t) {
  if (TOK[t]) return TOK[t];
  if (/^F([1-9]|1[0-2])$/.test(t)) return { cap: t, codes: [t], keys: [t.toLowerCase()], fkey: 1 };
  if (/^[A-Z]$/.test(t)) return { cap: t, codes: ['Key' + t], keys: [t.toLowerCase()], letter: 1 };
  if (/^[0-9]$/.test(t)) return { cap: t, codes: ['Digit' + t], keys: [t] };
  throw new Error(`hotkeys.js: unknown key token "${t}"`);
}
const capOf = (tk, p = plat) => (typeof tk.cap === 'object' ? tk.cap[p] : tk.cap);
const codesOf = (tk, p = plat) => (Array.isArray(tk.codes) ? tk.codes : tk.codes[p]);
// '<alt> / <alt>' -> [[token, ...combo], ...] for one platform (macOS F-keys get an fn in front)
export function parse(k, p = plat) {
  const out = [];
  for (const raw of k.split(' / ')) {
    const [s, only] = raw.trim().split('@');
    if (only && (only[0] === '!' ? only.slice(1) === p : only !== p)) continue;
    const combo = s.split('+').map(token);
    if (p === 'mac' && combo.some((tk) => tk.fkey)) combo.unshift(TOK.fn);
    out.push(combo);
  }
  return out;
}
// every e.key name the table covers (the QA suite compares this with what src/js reads)
export function coveredKeys() {
  const s = new Set();
  for (const b of BINDINGS) for (const raw of b.k.split(' / ')) for (const t of raw.split('@')[0].split('+')) for (const x of token(t).keys) s.add(x);
  return s;
}
const visible = (b) => { const g = GROUPS.find((x) => x.id === b.g); return (!b.when || b.when()) && (!g.when || g.when()); };
const textOf = (b, p = plat) => parse(b.k, p).map((c) => c.map((tk) => tk.text || capOf(tk, p)).join('+')).join(' / ');
export function listRows(titleOnly = false) {
  return BINDINGS.filter((b) => b.t && (!titleOnly || b.title) && visible(b)).map((b) => [textOf(b), b.t]);
}

// ---------------- the overlay ----------------
// physical keyboard, 15 units wide (ANSI). [code, label, width]; label may be per platform. '' code = spacer
const ROWS = [
  [['Escape', P3('esc', 'Esc')], ['', '', 1], ...[1, 2, 3, 4].map((i) => ['F' + i, 'F' + i]), ['', '', 0.5], ...[5, 6, 7, 8].map((i) => ['F' + i, 'F' + i]), ['', '', 0.5], ...[9, 10, 11, 12].map((i) => ['F' + i, 'F' + i])],
  [['Backquote', '`'], ...'1234567890'.split('').map((d) => ['Digit' + d, d]), ['Minus', '-'], ['Equal', '='], ['Backspace', P3('delete', 'Backspace'), 2]],
  [['Tab', P3('tab', 'Tab'), 1.5], ...'QWERTYUIOP'.split('').map((c) => ['Key' + c, c]), ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5]],
  [['CapsLock', P3('caps', 'Caps'), 1.75], ...'ASDFGHJKL'.split('').map((c) => ['Key' + c, c]), ['Semicolon', ';'], ['Quote', "'"], ['Enter', P3('return', 'Enter'), 2.25]],
  [['ShiftLeft', P3('⇧', 'Shift'), 2.25], ...'ZXCVBNM'.split('').map((c) => ['Key' + c, c]), ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', P3('⇧', 'Shift'), 2.75]],
];
const BOTTOM = {
  mac: [['Fn', 'fn', 1], ['ControlLeft', '⌃', 1], ['AltLeft', '⌥', 1], ['MetaLeft', '⌘', 1.25], ['Space', '', 6.5], ['MetaRight', '⌘', 1.25], ['AltRight', '⌥', 1], ['ControlRight', '⌃', 1], ['', '', 1]],
  win: [['ControlLeft', 'Ctrl', 1.25], ['MetaLeft', '⊞', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 6.25], ['AltRight', 'Alt', 1.25], ['MetaRight', '⊞', 1.25], ['ContextMenu', '☰', 1.25], ['ControlRight', 'Ctrl', 1.25]],
  linux: [['ControlLeft', 'Ctrl', 1.25], ['MetaLeft', 'Super', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 6.25], ['AltRight', 'AltGr', 1.25], ['MetaRight', 'Super', 1.25], ['ContextMenu', '☰', 1.25], ['ControlRight', 'Ctrl', 1.25]],
};
const NOTES = {
  mac: ['F-keys: hold <kbd>fn</kbd>, unless your Mac is set to use F1, F2… as standard function keys.', '<kbd>⌘</kbd><kbd>W</kbd> closes the tab and <kbd>⌘</kbd><kbd>Q</kbd> quits the browser, so the game never uses ⌘ for play.'],
  win: ['<kbd>Ctrl</kbd>+<kbd>W</kbd> closes the tab and <kbd>Alt</kbd>+<kbd>F4</kbd> closes the browser, so the game never uses them.', 'The <kbd>⊞</kbd> key leaves the game window; it is not used for play.'],
  linux: ['<kbd>Ctrl</kbd>+<kbd>W</kbd> closes the tab, so the game never uses it.', 'Most desktops (GNOME, KDE) keep <kbd>Super</kbd> for their own overview, so it is not used for play.'],
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let layout = null; // physical code -> character (navigator.keyboard.getLayoutMap), null = assume US QWERTY
let layoutCode = null; // character -> physical code

const CSS = `
#hotkeys{position:fixed;inset:0;z-index:80;display:none;place-items:center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:radial-gradient(ellipse at center,rgba(20,16,40,.72),rgba(0,0,0,.9));text-shadow:none;--u:clamp(13px,calc((min(100vw,1080px) - 76px) / 20.6),40px);--g:calc(var(--u)*.1)}
#hotkeys.open{display:grid}
#hotkeys .hk-card{width:min(1080px,100%);max-height:100%;overflow:auto;background:rgba(10,12,20,.94);border:3px solid #000;box-shadow:6px 6px 0 #000,inset 0 0 0 2px #2c3350;padding:12px 18px 14px;font-size:20px}
#hotkeys header{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
#hotkeys h1{margin:0;font-weight:normal;font-size:46px;line-height:.9;color:var(--gold);text-shadow:3px 3px 0 #6a2a10,6px 6px 0 #000;flex:1 1 auto}
#hotkeys h1 span{font-size:.5em;color:#ff8ab0;letter-spacing:4px;margin-left:10px;text-shadow:2px 2px 0 #000}
#hotkeys .hk-plat{display:flex;gap:4px;font-size:18px;align-items:center}
#hotkeys .hk-plat button,#hotkeys .hk-x{font:inherit;font-size:19px;padding:1px 10px;background:#232a40;color:var(--ink);border:2px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer}
#hotkeys .hk-plat button.on{background:var(--gold);color:#1a1408}
#hotkeys .hk-x{font-size:22px;padding:0 10px}
#hotkeys .hk-legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin:8px 0 6px;font-size:19px}
#hotkeys .hk-legend span{cursor:default;display:flex;align-items:center;gap:6px}
#hotkeys .hk-legend i{width:14px;height:14px;background:var(--gc);border:2px solid #000;display:inline-block}
#hotkeys .hk-board{display:flex;gap:calc(var(--u)*.45);justify-content:center;align-items:flex-end;margin:4px 0 2px}
#hotkeys .hk-kb{display:flex;flex-direction:column;gap:var(--g);padding:calc(var(--u)*.22);background:#05060b;border:2px solid #2c3350;border-radius:calc(var(--u)*.2)}
#hotkeys .hk-kr{display:flex;gap:var(--g)}
#hotkeys .hk-kr.fr{margin-bottom:calc(var(--u)*.12)}
#hotkeys .k{--w:1;--kc:#3a4058;position:relative;flex:none;width:calc(var(--w)*var(--u) + (var(--w) - 1)*var(--g));height:var(--u);display:grid;place-items:center;font-style:normal;font-size:calc(var(--u)*.5);line-height:1;color:#7d86a6;background:#1b2030;border-radius:calc(var(--u)*.12);box-shadow:inset 0 calc(var(--u)*-.1) 0 rgba(0,0,0,.45);white-space:nowrap;overflow:hidden;transition:opacity .12s,transform .12s}
#hotkeys .hk-kr.fr .k{height:calc(var(--u)*.72);font-size:calc(var(--u)*.36)}
#hotkeys .k.s{visibility:hidden}
#hotkeys .k.wide{font-size:calc(var(--u)*.34)}
#hotkeys .k.on{background:var(--kc);color:#14110a;font-weight:bold;cursor:help;box-shadow:inset 0 calc(var(--u)*-.12) 0 rgba(0,0,0,.35),0 0 0 1px #000}
#hotkeys .k b{position:absolute;bottom:calc(var(--u)*.1);right:calc(var(--u)*.08);display:flex;gap:2px}
#hotkeys .k b i{width:calc(var(--u)*.16);height:calc(var(--u)*.16);border-radius:50%;background:var(--dc);border:1px solid #000}
#hotkeys .k.hot{transform:translateY(calc(var(--u)*-.08));outline:2px solid #fff}
#hotkeys .hk-side{display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*.3)}
#hotkeys .hk-arrows{display:grid;grid-template-columns:repeat(3,var(--u));gap:var(--g);padding:calc(var(--u)*.22);background:#05060b;border:2px solid #2c3350;border-radius:calc(var(--u)*.2)}
#hotkeys .hk-arrows .k:nth-child(1),#hotkeys .hk-cl kbd:nth-child(1){grid-area:1/2}#hotkeys .hk-arrows .k:nth-child(2),#hotkeys .hk-cl kbd:nth-child(2){grid-area:2/1}#hotkeys .hk-arrows .k:nth-child(3),#hotkeys .hk-cl kbd:nth-child(3){grid-area:2/2}#hotkeys .hk-arrows .k:nth-child(4),#hotkeys .hk-cl kbd:nth-child(4){grid-area:2/3}
#hotkeys .hk-mouse{position:relative;width:calc(var(--u)*2);height:calc(var(--u)*3);border-radius:calc(var(--u)) calc(var(--u)) calc(var(--u)*.9) calc(var(--u)*.9);background:#1b2030;border:2px solid #2c3350;overflow:hidden}
#hotkeys .hk-mouse .k{position:absolute;left:0;top:0;width:50%;height:42%;border-radius:0;font-size:calc(var(--u)*.3)}
#hotkeys .hk-mouse .k.mr{left:50%;border-left:2px solid #2c3350}
#hotkeys .hk-mouse .k.mm{top:42%;width:100%;height:58%;background:transparent;border-top:2px solid #2c3350;box-shadow:none;font-size:calc(var(--u)*.32);white-space:normal;text-align:center}
#hotkeys .hk-mouse .k.mm.on{background:var(--kc)}
#hotkeys .hk-tip{min-height:1.3em;text-align:center;font-size:20px;color:#c8c0a0;margin:4px 0 8px}
#hotkeys .hk-tip b{color:#fff;font-weight:normal}
#hotkeys .hk-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:10px}
#hotkeys .hk-grp{border:2px solid #000;border-top:5px solid var(--gc);background:#151a28;padding:6px 10px 8px;transition:opacity .12s}
#hotkeys .hk-grp h2{margin:0 0 4px;font-weight:normal;font-size:24px;color:var(--gc);letter-spacing:2px;display:flex;align-items:baseline;gap:8px}
#hotkeys .hk-grp h2 small{font-size:16px;color:#9aa0b8;letter-spacing:0}
#hotkeys .hk-grp h2 em{margin-left:auto;font-style:normal;font-size:15px;color:#14110a;background:var(--gc);padding:0 6px;letter-spacing:1px}
#hotkeys .hk-row{display:grid;grid-template-columns:minmax(0,auto) 1fr;gap:10px;align-items:center;padding:3px 0;border-top:1px dashed #262c40;line-height:1.05}
#hotkeys .hk-row:first-of-type{border-top:0}
#hotkeys .hk-row:hover{background:#1d2335}
#hotkeys .hk-keys{display:flex;flex-wrap:wrap;align-items:center;gap:3px;max-width:190px}
#hotkeys .hk-keys em{font-style:normal;font-size:15px;color:#8a90a8;margin:0 1px}
#hotkeys kbd,#hotkeys .hk-notes kbd{font:inherit;font-size:18px;line-height:1;display:inline-block;min-width:24px;padding:3px 6px 4px;text-align:center;color:#14110a;background:#f4efe0;border:1px solid #000;border-radius:4px;box-shadow:inset 0 -3px 0 #b8ae90,1px 1px 0 #000;white-space:nowrap}
#hotkeys .hk-grp kbd{background:var(--gc);box-shadow:inset 0 -3px 0 rgba(0,0,0,.3),1px 1px 0 #000}
#hotkeys .hk-cl{display:inline-grid;grid-template-columns:repeat(3,auto);gap:2px}
#hotkeys .hk-cl kbd{min-width:20px;padding:1px 3px 3px;font-size:15px}

#hotkeys .hk-mi{display:inline-flex;align-items:center;gap:4px;font-size:16px;color:#c8c0a0}
#hotkeys .hk-mi i{width:14px;height:20px;border:2px solid var(--gc);border-radius:7px 7px 6px 6px;position:relative;display:inline-block}
#hotkeys .hk-mi i:before{content:'';position:absolute;left:0;top:0;width:5px;height:7px;background:var(--mc,transparent);border-radius:4px 0 0 0}
#hotkeys .hk-do{color:var(--ink)}
#hotkeys .hk-notes{margin-top:10px;font-size:17px;color:#9aa0b8;display:grid;gap:3px}
#hotkeys .hk-notes kbd{font-size:15px;padding:1px 5px 2px}
@media (max-width:640px){#hotkeys .hk-card{padding:8px 10px;font-size:18px}#hotkeys h1{font-size:34px}#hotkeys .hk-keys{max-width:150px}}
`;

let root = null, open = false, pausedByMe = false, focus = null, now = null;
function ctxGroup() {
  const A = window.__G; if (!A) return null;
  try {
    if (A.dev && A.dev.editing) return 'edit';
    if (A.fishing && A.fishing.menuOpen && A.fishing.menuOpen()) return 'fish';
    if (A.P && A.P.car) return 'car';
    if (A.G && A.G.paused) return 'menu';
    return 'foot';
  } catch (e) { return null; }
}
function capsHtml(b) {
  const alts = parse(b.k).map((combo) => combo.map((tk) => {
    if (tk.cluster) return `<span class="hk-cl">${tk.cluster.map((c) => `<kbd>${esc(c)}</kbd>`).join('')}</span>`;
    if (tk.mouse) return `<span class="hk-mi" style="${tk.mouse === 'click' ? '--mc:var(--gc)' : ''}"><i></i>${tk.mouse === 'click' ? 'click' : 'move'}</span>`;
    return `<kbd>${esc(capOf(tk))}</kbd>`;
  }).join('<em>+</em>'));
  return (b.hold ? '<em>hold</em>' : '') + alts.join('<em>or</em>');
}
function render() {
  const groups = GROUPS.filter((g) => !g.when || g.when());
  const rows = BINDINGS.filter(visible);
  // which physical keys light up, and for what
  const lit = new Map(); // code -> [{g, does, keys}]
  for (const b of rows) for (const combo of parse(b.k)) for (const tk of combo) for (let c of codesOf(tk)) {
    if (tk.letter && layoutCode) c = layoutCode.get(tk.cap.toLowerCase()) || c; // AZERTY etc: light the key that types this letter
    if (!lit.has(c)) lit.set(c, []);
    lit.get(c).push(b);
  }
  const gcol = (id) => GROUPS.find((g) => g.id === id).c;
  const key = (code, label, w = 1, cls = '') => {
    if (!code) return `<i class="k s" style="--w:${w}"></i>`;
    let lab = typeof label === 'object' ? label[plat] : label;
    if (layout && layout.has(code) && /^(Key|Digit)|^(Minus|Equal|Bracket|Semicolon|Quote|Comma|Period|Slash|Backquote|Backslash)/.test(code)) lab = layout.get(code).toUpperCase();
    const bs = lit.get(code);
    if (!bs) return `<i class="k ${cls}${w >= 2 ? ' wide' : ''}" style="--w:${w}">${esc(lab)}</i>`;
    const gs = [...new Set(bs.map((b) => b.g))];
    return `<i class="k on ${cls}${w >= 2 ? ' wide' : ''} ${gs.map((g) => 'g-' + g).join(' ')}" data-c="${code}" style="--w:${w};--kc:${gcol(gs[0])}">${esc(lab)}${gs.length > 1 ? `<b>${gs.slice(1, 4).map((g) => `<i style="--dc:${gcol(g)}"></i>`).join('')}</b>` : ''}</i>`;
  };
  const kb = ROWS.map((r, i) => `<div class="hk-kr${i === 0 ? ' fr' : ''}">${r.map(([c, l, w]) => key(c, l, w)).join('')}</div>`).join('') +
    `<div class="hk-kr">${BOTTOM[plat].map(([c, l, w]) => key(c, l, w)).join('')}</div>`;
  const arrows = `<div class="hk-arrows">${key('ArrowUp', '↑')}${key('ArrowLeft', '←')}${key('ArrowDown', '↓')}${key('ArrowRight', '→')}</div>`;
  const mouse = `<div class="hk-mouse" title="mouse">${key('MouseL', 'L')}${key('MouseR', 'R', 1, 'mr')}${key('MouseMove', 'look', 1, 'mm')}</div>`;
  const rank = (id) => (id === now ? 2 : now === 'car' && id === 'radio' ? 1 : 0);
  const order = groups.slice().sort((a, b) => rank(b.id) - rank(a.id));
  const cards = order.map((g) => {
    const rs = rows.filter((b) => b.g === g.id);
    if (!rs.length) return '';
    return `<section class="hk-grp" data-g="${g.id}" style="--gc:${g.c}"><h2>${esc(g.name.toUpperCase())}${g.note ? `<small>${esc(g.note)}</small>` : ''}${g.id === now ? '<em>NOW</em>' : ''}</h2>${rs.map((b) => `<div class="hk-row"><span class="hk-keys">${capsHtml(b)}</span><span class="hk-do">${esc(b.does)}</span></div>`).join('')}</section>`;
  }).join('');
  const notes = NOTES[plat].slice();
  if (plat === 'linux' && isCros()) notes.unshift('On a Chromebook, hold <kbd>Search</kbd> and press a top-row key for F1…F10.');
  if (layout && layout.get('KeyQ') && layout.get('KeyQ') !== 'q') notes.unshift('The keyboard is drawn with your layout: letters light up where they are on your keys.');
  notes.push('Press <kbd>?</kbd> or <kbd>' + (plat === 'mac' ? 'esc' : 'Esc') + '</kbd> to close. Point at a lit key to see what it does.');
  const focusCss = GROUPS.map((g) => `#hotkeys[data-focus="${g.id}"] .k.on:not(.g-${g.id}){opacity:.22}#hotkeys[data-focus="${g.id}"] .hk-grp:not([data-g="${g.id}"]){opacity:.45}`).join('');
  root.innerHTML = `<style>${focusCss}</style><div class="hk-card" role="document">
    <header><h1>HOTKEYS<span>${esc(PLATFORMS[plat].toUpperCase())}</span></h1>
      <div class="hk-plat">${Object.entries(PLATFORMS).map(([id, n]) => `<button data-p="${id}" class="${id === plat ? 'on' : ''}">${n}</button>`).join('')}</div>
      <button class="hk-x" aria-label="Close">✕</button></header>
    <div class="hk-legend">${groups.map((g) => `<span data-g="${g.id}" style="--gc:${g.c}"><i></i>${esc(g.name)}</span>`).join('')}</div>
    <div class="hk-board"><div class="hk-kb">${kb}</div><div class="hk-side">${mouse}${arrows}</div></div>
    <div class="hk-tip">Point at a lit key to see what it does</div>
    <div class="hk-groups">${cards}</div>
    <div class="hk-notes">${notes.map((n) => `<div>${n}</div>`).join('')}</div></div>`;
  root._lit = lit;
  if (focus) root.dataset.focus = focus; else delete root.dataset.focus;
}
function tipFor(code) {
  const bs = root._lit && root._lit.get(code); if (!bs) return '';
  const name = (id) => GROUPS.find((g) => g.id === id).name;
  return [...new Set(bs)].map((b) => `<b style="color:${GROUPS.find((g) => g.id === b.g).c}">${esc(name(b.g))}</b>: ${esc(b.does)}`).join(' &nbsp;·&nbsp; ');
}
function build() {
  if (root) return;
  const st = document.createElement('style'); st.id = 'hotkeys-css'; st.textContent = CSS; document.head.appendChild(st);
  root = document.createElement('div'); root.id = 'hotkeys'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Keyboard hotkeys');
  document.body.appendChild(root);
  for (const ev of ['pointerdown', 'pointerup', 'click', 'wheel', 'touchstart']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev === 'wheel' || ev === 'touchstart' });
  root.addEventListener('click', (e) => {
    const p = e.target.closest('[data-p]');
    if (p) { plat = p.dataset.p; try { localStorage.setItem(PLAT_KEY, plat); } catch (err) { /* storage blocked */ } render(); return; }
    if (e.target === root || e.target.closest('.hk-x')) close();
  });
  root.addEventListener('pointerover', (e) => {
    const k = e.target.closest('.k.on'), g = e.target.closest('[data-g]');
    root.querySelectorAll('.k.hot').forEach((x) => x.classList.remove('hot'));
    const tip = root.querySelector('.hk-tip');
    if (k) { k.classList.add('hot'); tip.innerHTML = tipFor(k.dataset.c); }
    focus = g ? g.dataset.g : null;
    if (focus) root.dataset.focus = focus; else delete root.dataset.focus;
  });
  root.addEventListener('pointerleave', () => { focus = null; delete root.dataset.focus; });
  addEventListener('resize', () => { if (open) render(); });
}
export function openHotkeys() {
  if (open) return;
  build(); now = ctxGroup(); open = true; render(); root.classList.add('open'); document.body.classList.add('hotkeys');
  const A = window.__G;
  if (A && A.G && !A.G.paused) { A.G.paused = true; pausedByMe = true; }
  try { document.exitPointerLock && document.pointerLockElement && document.exitPointerLock(); } catch (e) { /* ignore */ }
}
export function close() {
  if (!open) return;
  open = false; root.classList.remove('open'); document.body.classList.remove('hotkeys');
  const A = window.__G;
  if (pausedByMe && A && A.G) { A.G.paused = false; if (A.P) A.P.lock = Math.max(A.P.lock || 0, 0.3); }
  pausedByMe = false;
}
const typing = (e) => { const t = e.target; return !!(e.isComposing || (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))); };
// capture phase on window, registered at import: runs before the game's, story and dev listeners
if (typeof window !== 'undefined') {
  addEventListener('keydown', (e) => {
    if (open) {
      e.stopImmediatePropagation();
      if (e.ctrlKey || e.metaKey) return; // browser shortcuts (reload, close tab) still work
      e.preventDefault();
      if (!e.repeat && (e.key === '?' || e.key === 'Escape' || e.key === 'Enter')) close();
      return;
    }
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    openHotkeys();
  }, true);
  // physical layout (Chromium): light the key that types each letter, label caps with the player's layout
  try {
    const kb = navigator.keyboard;
    if (kb && kb.getLayoutMap) kb.getLayoutMap().then((m) => {
      layout = new Map(m); layoutCode = new Map(); for (const [c, ch] of layout) if (!layoutCode.has(ch)) layoutCode.set(ch, c);
      if (open) render();
    }).catch(() => {});
  } catch (e) { /* not allowed in this frame */ }
  // title card key list (index.html leaves the table empty)
  const tbl = document.querySelector('#title table');
  if (tbl) tbl.insertAdjacentHTML('afterbegin', listRows(true).map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join(''));
  window.__HOTKEYS = { open: openHotkeys, close, get isOpen() { return open; }, get platform() { return plat; }, setPlatform(p) { if (PLATFORMS[p]) { plat = p; if (open) render(); } }, BINDINGS, GROUPS, parse, coveredKeys, listRows, detectPlatform };
}
