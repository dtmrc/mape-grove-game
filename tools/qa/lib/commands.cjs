// Commands for tools/qa/qa.cjs. Kept in their own module so `qa serve` re-loads them on every request
// (edit a command, run it again, no server restart).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./session.cjs');

// ---------------- args ----------------
function parse(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s.startsWith('--')) {
      const [k, v] = s.slice(2).split('=');
      if (v !== undefined) a[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a[k] = argv[++i];
      else a[k] = true;
    } else a._.push(s);
  }
  return a;
}
const num = (v, d) => (v === undefined || v === true ? d : +v);
const os = require('os');
const PORT = (a) => +(a.port || process.env.QA_PORT || 9333);
const STATE_FILE = (port) => path.join(os.tmpdir(), `mg-qa-${port}.json`);
const sessOpts = (a, log) => ({ html: a.html, world: a.world, seed: a.seed, width: a.width, height: a.height, scale: a.scale, save: a.save, clock: a.clock, realtime: !!a.realtime, log });
const DEFAULT_PERF = ['spawn', 'green', 'quik', 'church', 'dock', 'clearing', 'school', 'park', 'hoaLot'];

// ---------------- commands ----------------
// Each command: async (S, a, out) -> optional JSON-able result. `out` prints a line.
const cmds = {};

cmds.state = async (S, a, out) => {
  await ensureStarted(S);
  const st = await S.state(), errs = await S.errors(), san = await S.sanity();
  out(fmt(st)); report(out, errs, san);
  return { state: st, errors: errs, sanity: san };
};

cmds.places = async (S, a, out) => {
  await ensureStarted(S);
  const r = await S.js(() => {
    const QA = window.QA, G = window.__G, pl = QA.places(), out = {};
    for (const [k, p] of Object.entries(pl)) out[k] = { ...p, district: G.districtAt(p.x, p.z) };
    return { places: out, rooms: QA.rooms() };
  });
  for (const [k, p] of Object.entries(r.places)) out(`${k.padEnd(14)} ${String(p.x).padStart(8)} ${String(p.z).padStart(8)}   ${p.district}`);
  out(`rooms (shot room:<id>): ${r.rooms.join(', ')}`);
  return r;
};

async function setView(S, a) {
  if (a.time !== undefined) await S.js(([h]) => window.QA.time(h, { freeze: true }), [+a.time]);
  // camera: --yaw/--pitch, else straight behind the player (or their car)
  await S.js(([y, p]) => { const P = window.__G.P; return window.QA.cam(y ?? (P.car ? P.car.yaw : P.yaw), p); }, [a.yaw === undefined ? null : +a.yaw, num(a.pitch, 0.3)]);
}
function shotName(t) { return String(t).replace(/^room:/, 'room-').replace(/[^\w.-]+/g, '_'); }

cmds.shot = async (S, a, out) => {
  await ensureStarted(S);
  const targets = a._.length ? a._ : ['here'];
  const files = [];
  for (const t of targets) {
    if (t !== 'here') await S.tp(t);
    await setView(S, a);
    await S.step(num(a.frames, 12));
    let file = a.out || path.join(ROOT, 'qa-out');
    if (!/\.png$/i.test(file) || targets.length > 1) file = path.join(file.replace(/\.png$/i, ''), `${shotName(t)}${a.time !== undefined ? '-' + a.time : ''}.png`);
    files.push(await S.shot(file, { hud: !a.clean, settle: 1 }));
    out(`${t}: ${files[files.length - 1]}`);
  }
  report(out, await S.errors(), await S.sanity(), true);
  return { files };
};

cmds.tour = async (S, a, out) => {
  await ensureStarted(S);
  const pl = await S.js(() => Object.keys(window.QA.places()));
  const targets = a._.length ? a._ : pl.filter((k) => !/^(raceRoute|raceStart|drives|doors|cashSpots|nanaDrive|garyCart|garyBack)$/.test(k));
  const dir = a.out || path.join(ROOT, 'qa-out', 'tour'); const tiles = [];
  if (!a.car) await S.js(() => window.QA.leaveCar()); // on foot unless --car
  for (const t of targets) {
    try {
      await S.tp(t); await setView(S, a); await S.step(num(a.frames, 12));
      const f = await S.shot(path.join(dir, shotName(t) + '.png'), { hud: !!a.hud, settle: 1 });
      const st = await S.state(), san = await S.sanity();
      tiles.push({ t, f, sub: `${st.x},${st.z} ${st.district}`, bad: san.join('; ') }); out(`${t}: ok${san.length ? '  SANITY: ' + san.join('; ') : ''}`);
    } catch (e) { tiles.push({ t, f: null, sub: String(e.message).slice(0, 80), bad: 'failed' }); out(`${t}: FAILED ${e.message}`); }
  }
  const sheet = await contactSheet(S, tiles, path.join(dir, 'tour.png'));
  out(`contact sheet: ${sheet}`);
  report(out, await S.errors(), [], true);
  return { dir, sheet, tiles };
};

async function contactSheet(S, tiles, file) {
  const cols = 4, w = 320, h = 180;
  const html = `<html><body style="margin:0;background:#111;font:12px monospace;color:#ddd;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:4px;padding:4px;width:${cols * (w + 4) + 4}px">${tiles.map((t) => `<div><div style="width:${w}px;height:${h}px;background:#333 ${t.f ? `url('data:image/png;base64,${fs.readFileSync(t.f).toString('base64')}') center/cover` : ''}"></div><div style="padding:2px 0;color:${t.bad ? '#f88' : '#ddd'}"><b>${t.t}</b> ${t.sub}${t.bad ? ' ⚠ ' + t.bad : ''}</div></div>`).join('')}</body></html>`;
  const p = await S.ctx.newPage();
  await p.setViewportSize({ width: cols * (w + 4) + 4, height: 200 });
  await p.setContent(html); await p.screenshot({ path: file, fullPage: true }); await p.close();
  return file;
}

cmds.eval = async (S, a, out) => {
  if (!a.nostart) await ensureStarted(S);
  const src = a._.join(' ') || (a.file ? fs.readFileSync(a.file, 'utf8') : '');
  if (!src) throw new Error("eval needs JS, e.g. qa eval 'QA.state()'");
  const r = await S.js(src);
  out(typeof r === 'string' ? r : fmt(r));
  const errs = await S.errors(); if (errs.length) report(out, errs, [], true);
  return r;
};
cmds.js = cmds.eval;

cmds.perf = async (S, a, out) => {
  await ensureStarted(S);
  const targets = a._.length ? a._ : DEFAULT_PERF;
  if (a.time !== undefined) await S.js(([h]) => window.QA.time(h, { freeze: true }), [+a.time]);
  const rows = {};
  out('spot            avgMs  p95Ms  draws   glTris  visible  geos  mats  lights heapMB');
  for (const t of targets) {
    await S.tp(t); await S.step(20);
    const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; const acc = [];
    for (const y of yaws) { await S.js(([y]) => window.QA.cam(y, 0.3), [y]); await S.step(2, { render: false }); acc.push(await S.js(([n]) => window.QA.timeFrames(n), [num(a.frames, 3)])); }
    const st = await S.stats();
    const r = { avgMs: avg(acc.map((x) => x.avgMs)), p95Ms: Math.max(...acc.map((x) => x.p95Ms)), drawCalls: Math.max(...acc.map((x) => x.drawCalls)), glTris: st.glTris, visible: st.visible, geos: st.geos, mats: st.mats, lights: st.lights, heapMB: st.heapMB };
    rows[t] = r;
    out(`${t.padEnd(14)} ${pad(r.avgMs, 6)} ${pad(r.p95Ms, 6)} ${pad(r.drawCalls, 6)} ${pad(r.glTris, 8)} ${pad(r.visible, 8)} ${pad(r.geos, 5)} ${pad(r.mats, 5)} ${pad(r.lights, 6)} ${pad(r.heapMB, 6)}`);
  }
  out('(SwiftShader software GPU: compare runs against each other, not against a real GPU. draws = worst of 4 camera yaws)');
  if (a.compare) {
    const base = JSON.parse(fs.readFileSync(a.compare, 'utf8')).rows || {};
    out('\nvs ' + a.compare + ':');
    for (const [t, r] of Object.entries(rows)) {
      const b = base[t]; if (!b) continue;
      const d = (k) => { const x = r[k] - b[k], pc = b[k] ? Math.round((x / b[k]) * 100) : 0; return `${k} ${b[k]}→${r[k]} (${pc >= 0 ? '+' : ''}${pc}%)`; };
      out(`${t.padEnd(14)} ${d('avgMs')}  ${d('drawCalls')}  ${d('glTris')}`);
    }
  }
  if (a.save) { fs.writeFileSync(a.save, JSON.stringify({ at: new Date().toISOString(), html: S.o.html, rows }, null, 1)); out('saved ' + a.save); }
  report(out, await S.errors(), [], true);
  return { rows };
};

cmds.soak = async (S, a, out) => {
  await ensureStarted(S);
  const secs = num(a.secs, 120), chunk = 100; // 100 frames = 5 game seconds
  const before = await S.stats();
  const r = await S.js(async ([secs, chunk]) => {
    const QA = window.QA, G = window.__G, issues = [], seen = new Set(); const t0 = performance.now();
    const keys = ['w', 'a', 'd', 'shift', ' '];
    const n = Math.ceil((secs * 20) / chunk);
    for (let i = 0; i < n; i++) {
      // wander: random walking with turns, a random teleport every 6 chunks, a car hop every 9
      if (i % 6 === 5) { const pl = Object.keys(QA.places()); await QA.tp(pl[(Math.random() * pl.length) | 0], { settle: 2, render: false }); }
      if (i % 9 === 8 && !G.P.car) { try { await QA.spawnCar('sedan', { enter: true }); } catch (e) { issues.push('spawnCar: ' + e.message); } }
      const k = [keys[0], keys[1 + ((Math.random() * 2) | 0)]]; for (const x of k) QA.down(x);
      QA.step(chunk, { render: i % 10 === 9 ? 'last' : false });
      for (const x of k) QA.up(x);
      if (G.P.car && i % 9 === 3) { QA.down('e'); QA.step(1, { render: false }); QA.up('e'); }
      for (const s of QA.sanity()) if (!seen.has(s)) { seen.add(s); issues.push(`t=${i * 5}s ${s}`); }
    }
    return { simSecs: n * chunk * 0.05, wallMs: Math.round(performance.now() - t0), issues, state: QA.state() };
  }, [secs, chunk]);
  const after = await S.stats();
  out(`simulated ${r.simSecs}s of game time`);
  out(`objects ${before.objs}→${after.objs}  geos ${before.geos}→${after.geos}  mats ${before.mats}→${after.mats}  heap ${before.heapMB}→${after.heapMB} MB`);
  if (after.objs > before.objs * 1.5 + 200) r.issues.push(`scene grew ${before.objs}→${after.objs} objects (leak?)`);
  const hitches = await S.js(() => window.QA.hitches.slice());
  if (hitches.length) out(`hitches >250ms CPU: ${hitches.map((h) => `${h.ms}ms@${h.at}`).join(', ')}`);
  report(out, await S.errors(), r.issues);
  return { ...r, before, after, hitches };
};

cmds.test = async (S, a, out) => {
  const dir = path.join(__dirname, '..', 'suites');
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.cjs')).sort().map((f) => ({ file: f, ...require(path.join(dir, f)) }));
  if (a.list) { for (const s of all) out(`${s.name.padEnd(12)} ${s.desc || ''}`); return all.map((s) => s.name); }
  const pick = a._.length ? all.filter((s) => a._.some((n) => s.name === n || s.file.startsWith(n))) : all.filter((s) => !s.optional);
  if (!pick.length) throw new Error(`no suite matches ${a._.join(', ')}. qa test --list`);
  const results = []; const shotsDir = a.out || path.join(ROOT, 'qa-out', 'tests');
  for (const s of pick) {
    const t0 = Date.now(); const checks = [];
    const check = (name, ok, info) => { checks.push({ name, ok: !!ok, info }); out(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && info !== undefined ? '  ' + short(info) : ''}`); return !!ok; };
    out(`▶ ${s.name}  ${s.desc || ''}`);
    try {
      await S.load(); await S.clearErrors(); await ensureStarted(S);
      const shot = (n, o) => S.shot(path.join(shotsDir, `${s.name}-${n}.png`), o);
      await s.run({ S, check, shot, log: (m) => out('  · ' + m), QA: (fn, arg) => S.js(fn, arg) });
      const san = await S.sanity(); check('sanity (no NaN / out of bounds / sunk)', !san.length, san);
      const errs = await S.errors(); check('no errors', !errs.length, errs.map((e) => e.msg));
    } catch (e) { check('suite ran to the end', false, String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    const fails = checks.filter((c) => !c.ok).length;
    results.push({ suite: s.name, pass: checks.length - fails, fail: fails, ms: Date.now() - t0, failed: checks.filter((c) => !c.ok) });
  }
  out('\nsuite         pass  fail   secs');
  for (const r of results) out(`${r.suite.padEnd(12)} ${pad(r.pass, 5)} ${pad(r.fail, 5)} ${pad((r.ms / 1000).toFixed(1), 6)}`);
  const total = results.reduce((n, r) => n + r.fail, 0);
  out(total ? `\n${total} check(s) FAILED` : '\nall passed');
  process.exitCode = total ? 1 : 0;
  return { results };
};

cmds.run = async (S, a, out) => {
  const file = path.resolve(a._[0] || ''); if (!fs.existsSync(file)) throw new Error('run needs a scenario file');
  delete require.cache[file];
  const fn = require(file); const checks = [];
  await ensureStarted(S);
  const check = (name, ok, info) => { checks.push({ name, ok: !!ok }); out(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && info !== undefined ? '  ' + short(info) : ''}`); if (!ok) process.exitCode = 1; return !!ok; };
  const shot = (n, o) => S.shot(path.join(a.out || path.join(ROOT, 'qa-out'), n.endsWith('.png') ? n : n + '.png'), o);
  const r = await (fn.run || fn)({ S, check, shot, log: out, QA: (f, arg) => S.js(f, arg), args: a });
  if (r !== undefined) out(fmt(r));
  report(out, await S.errors(), await S.sanity(), true);
  return { checks, result: r };
};

cmds.build = async (S, a, out) => {
  const sh = (cmd, args) => { out('$ ' + [cmd, ...args].join(' ')); const r = execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }); if (r.trim()) out(r.trim().split('\n').slice(-3).join('\n')); };
  // every hook script is idempotent; ones that take a file get game.js, the rest get the src/js folder
  for (const f of fs.readdirSync(path.join(ROOT, 'tools')).filter((f) => f.endsWith('-hooks.mjs')).sort()) {
    const arg = /const f = process\.argv\[2\]/.test(fs.readFileSync(path.join(ROOT, 'tools', f), 'utf8')) ? 'src/js/game.js' : 'src/js';
    try { const r = execFileSync('node', [path.join('tools', f), arg], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }); if (/added|patched|inserted|wrote/i.test(r)) out(`${f}: ${r.trim().split('\n')[0]}`); }
    catch (e) { out(`! ${f} failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`); }
  }
  sh('node', ['build.mjs']);
  if (!a['no-dev']) sh('node', ['tools/dev-build.mjs']);
  return { ok: true };
};

// ---------------- helpers ----------------
const avg = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
const pad = (v, n) => String(v ?? '-').padStart(n);
const short = (v) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > 400 ? s.slice(0, 400) + '…' : s; };
function fmt(v) { const one = JSON.stringify(v); return one && one.length < 240 ? one : JSON.stringify(v, null, 1); }
async function ensureStarted(S) { const st = await S.js(() => window.QA.started() && !window.__G.G.dialog); if (!st) await S.start(); }
function report(out, errs, san, quietOk) {
  if (errs && errs.length) { out(`\nERRORS (${errs.length}):`); for (const e of errs) out(`  [${e.kind}${e.n > 1 ? ' x' + e.n : ''}${e.at ? ' @' + e.at : ''}] ${e.msg}${e.stack ? '\n    ' + e.stack.split('\n').slice(1, 4).join('\n    ') : ''}`); }
  if (san && san.length) { out(`\nSANITY (${san.length}):`); for (const s of san) out('  ' + s); }
  if (!quietOk && !(errs && errs.length) && !(san && san.length)) out('no errors, sanity ok');
}


module.exports = { cmds, parse, report, fmt, ensureStarted, sessOpts, PORT, STATE_FILE };
