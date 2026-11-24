// One headless Off Leash page with the QA harness injected. Used by the CLI (one-shot) and by `qa serve` (kept warm).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'];
const INPAGE_FILE = path.join(__dirname, 'inpage.js'); // re-read on every open so a warm server picks up edits

function readWorld(dir) {
  if (!dir || dir === 'none') return null;
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  const w = { terrain: rd('terrain.json'), ground: rd('ground.json'), edits: rd('edits.json') };
  return w.terrain || w.ground || w.edits ? w : null;
}

class Session {
  constructor(o = {}) {
    this.o = {
      html: path.resolve(ROOT, o.html || 'dist/dev.html'),
      world: o.world === undefined ? path.join(ROOT, 'world') : o.world,
      seed: o.seed === undefined ? 1 : o.seed,
      width: +o.width || 1280, height: +o.height || 720, scale: +o.scale || 1,
      clock: o.clock === undefined ? 12 : o.clock,
      realtime: !!o.realtime, // true = frames run on the real rAF clock (needed for live perf numbers)
      save: o.save || null, // path to a save JSON (localStorage maple-grove-offleash-v1) or an object
      log: o.log || (() => {}),
    };
    this.pageErrors = [];
    this.console = [];
  }
  async open() {
    const t0 = Date.now();
    if (!fs.existsSync(this.o.html)) throw new Error(`${this.o.html} not found. Build first: node tools/qa/qa.cjs build`);
    this.browser = await chromium.launch({ args: GL_ARGS });
    this.ctx = await this.browser.newContext({ viewport: { width: this.o.width, height: this.o.height }, deviceScaleFactor: this.o.scale });
    this.page = await this.ctx.newPage();
    const cfg = { seed: this.o.seed === 'random' ? null : +this.o.seed, world: readWorld(this.o.world) };
    let save = this.o.save; if (typeof save === 'string') save = JSON.parse(fs.readFileSync(save, 'utf8'));
    await this.page.addInitScript(({ cfg, save }) => {
      window.__QA_CFG = cfg;
      if (save) { try { localStorage.setItem('maple-grove-offleash-v1', JSON.stringify(save)); } catch (e) { /* ignore */ } }
    }, { cfg, save });
    await this.page.addInitScript({ content: fs.readFileSync(INPAGE_FILE, 'utf8') });
    this.page.on('pageerror', (e) => this.pageErrors.push(String((e && e.stack) || e).split('\n').slice(0, 6).join('\n')));
    this.page.on('console', (m) => { if (this.console.length < 400) this.console.push(`${m.type()}: ${m.text()}`.slice(0, 400)); });
    await this.load();
    this.bootMs = Date.now() - t0;
    return this;
  }
  async load() {
    this.mtime = fs.statSync(this.o.html).mtimeMs;
    this.pageErrors.length = 0; this.console.length = 0;
    await this.page.goto('file://' + this.o.html);
    await this.page.waitForFunction(() => window.QA && window.QA.ready(), null, { timeout: 120000 });
    // manual clock by default: frames only advance when a command steps them (fast, reproducible, no GPU backlog)
    if (!this.o.realtime) await this.page.evaluate(() => window.QA.setManual(true));
    // fixed start hour (default noon) so traffic, lights and shadows match run to run; --clock real keeps the real time
    if (this.o.clock !== 'real' && !this.o.save) await this.page.evaluate(([h]) => { window.__G.G.clock = h; }, [+this.o.clock]);
  }
  /** Reload if the built html changed on disk since the page loaded (keeps `qa serve` current after a rebuild). */
  async refreshIfStale() {
    const m = fs.statSync(this.o.html).mtimeMs;
    if (m !== this.mtime) { this.o.log(`[qa] ${path.basename(this.o.html)} changed, reloading`); await this.load(); return true; }
    return false;
  }
  /** Run a function (or expression string) in the page. Functions get (arg) and can be async. */
  js(fn, arg) {
    if (typeof fn === 'string') {
      const src = fn;
      return this.page.evaluate(async (src) => {
        // eslint-disable-next-line no-new-func
        const f = new Function('QA', 'G', `return (async () => { return (${src}); })()`);
        return f(window.QA, window.__G);
      }, src).catch(async (e) => {
        if (!/SyntaxError|Unexpected/.test(String(e))) throw e;
        // statements instead of an expression: run them as a body (use `return x` to get a value back)
        return this.page.evaluate(async (src) => new Function('QA', 'G', `return (async () => { ${src} })()`)(window.QA, window.__G), src);
      });
    }
    return this.page.evaluate(fn, arg);
  }
  start() { return this.js(() => window.QA.start()); }
  step(n, o = {}) { return this.page.evaluate(([n, o]) => window.QA.step(n, o), [n, o]); }
  tp(t, o = {}) { return this.page.evaluate(([t, o]) => window.QA.tp(t, o), [t, o]); }
  state() { return this.js(() => window.QA.state()); }
  stats() { return this.js(() => window.QA.stats()); }
  sanity() { return this.js(() => window.QA.sanity()); }
  /** All errors: harness-captured (with counts and where) + Playwright page errors not already in that list. */
  async errors() {
    const qa = await this.js(() => window.QA.errors.slice());
    const extra = this.pageErrors.filter((p) => !qa.some((e) => p.includes(e.msg.replace(/^Uncaught /, '').slice(0, 60))));
    return [...qa, ...extra.map((s) => ({ kind: 'pageerror', msg: s.split('\n')[0], stack: s, n: 1 }))];
  }
  async clearErrors() { this.pageErrors.length = 0; await this.js(() => window.QA.clearErrors()); }
  /** Screenshot. Steps a few frames first in manual mode so the canvas holds a fresh frame. */
  async shot(file, o = {}) {
    await this.js(([hud]) => window.QA.hud(hud), [o.hud !== false]);
    await this.js(([n]) => window.QA.frames(n), [o.settle ?? 2]);
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    await this.page.screenshot({ path: file });
    if (o.hud === false) await this.js(() => window.QA.hud(true));
    return path.resolve(file);
  }
  async close() { try { await this.browser.close(); } catch (e) { /* ignore */ } }
}

module.exports = { Session, ROOT, readWorld };
