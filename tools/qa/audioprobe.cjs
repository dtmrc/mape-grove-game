// Audio leak probe: counts AudioContexts, live (started, not ended) source nodes and created nodes while playing.
const path = require('path');
// Usage: node tools/qa/audioprobe.cjs   (after qa build). Live oscillators should stay ~3 (engine + siren) throughout.
const REPO = path.resolve(__dirname, '..', '..');
const pw = require(require.resolve('playwright', { paths: [REPO] }));
const L = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = (o = {}) => L({ ...o, args: [...(o.args || []), '--autoplay-policy=no-user-gesture-required'] });
const { Session } = require(path.join(REPO, 'tools/qa/lib/session.cjs'));
const INSTR = `(() => {
  const A = window.__AUD = { ctx: 0, live: 0, started: 0, made: {}, liveByType: {} };
  const Real = window.AudioContext;
  window.AudioContext = window.webkitAudioContext = function (...a) { A.ctx++; return new Real(...a); };
  window.AudioContext.prototype = Real.prototype;
  const P = BaseAudioContext.prototype;
  for (const k of Object.getOwnPropertyNames(P)) if (/^create/.test(k) && typeof P[k] === 'function') {
    const f = P[k]; P[k] = function (...a) { A.made[k] = (A.made[k] || 0) + 1; const n = f.apply(this, a); n.__k = k; return n; };
  }
  for (const C of [AudioScheduledSourceNode, AudioBufferSourceNode]) { const st = C.prototype.start; if (!Object.prototype.hasOwnProperty.call(C.prototype, 'start')) continue;
  C.prototype.start = function (...a) {
    A.started++; A.live++; const k = this.__k || '?'; A.liveByType[k] = (A.liveByType[k] || 0) + 1;
    this.addEventListener('ended', () => { A.live--; A.liveByType[k]--; });
    return st.apply(this, a);
  }; }
})();`;
(async () => {
  const S = new Session({});
  // inject before the game: patch newContext page init via addInitScript after page creation
  const origLoad = S.load.bind(S);
  S.load = async () => { await S.page.addInitScript({ content: INSTR }); return origLoad(); };
  await S.open();
  await S.start();
  await S.js(() => { window.__MEOW.sfx.unlock(); dispatchEvent(new PointerEvent('pointerdown')); dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })); });
  const snap = (label) => S.js(() => { const A = window.__AUD; return { live: A.live, started: A.started, ctx: A.ctx, liveByType: { ...A.liveByType }, heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6) }; }).then((r) => console.log(label.padEnd(26), JSON.stringify(r)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(500); await snap('after unlock');
  // on foot: jump a lot + idle chatter (game time)
  for (let i = 0; i < 40; i++) { await S.js(() => QA.key(' ', 2)); await S.step(20, { render: false }); }
  await sleep(1500); await snap('40 jumps + 40 s on foot');
  for (let i = 0; i < 40; i++) { await S.js(() => QA.key(' ', 2)); await S.step(20, { render: false }); }
  await sleep(1500); await snap('80 jumps + 80 s on foot');
  // drive with radio
  await S.js(() => QA.spawnCar('sedan', { enter: true }));
  for (let i = 0; i < 20; i++) { await S.js(() => QA.drive(10)); await sleep(150); }
  await snap('driving ~3 s real, radio');
  await S.js(() => QA.leaveCar());
  await sleep(2000); await snap('out of car, 2 s later');
  const t0 = Date.now(); await S.js(() => { for (let i = 0; i < 200; i++) window.__MEOW.sfx.meow('meow'); }); 
  await sleep(1500); await snap('+200 meows');
  console.log('main-thread ms for 200 meows', Date.now() - t0 - 1500);
  console.log('made', JSON.stringify(await S.js(() => window.__AUD.made)));
  await S.close?.(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
