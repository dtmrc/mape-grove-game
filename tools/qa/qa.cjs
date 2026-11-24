#!/usr/bin/env node
// Off Leash QA tool: build, boot headless, screenshot, probe, smoke-test and profile the game from one command.
// Full docs: docs/testing.md.  Quick help: node tools/qa/qa.cjs help
//
// Every command works one-shot (boots its own headless Chromium, ~8 s) or against a warm page kept by
// `qa serve` (~0.1 s per command; it reloads by itself when dist/*.html is rebuilt).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { Session } = require('./lib/session.cjs');
const CMDS = path.join(__dirname, 'lib', 'commands.cjs');
const INPAGE = path.join(__dirname, 'lib', 'inpage.js');
const load = () => { for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(__dirname, 'suites')) || k === CMDS) delete require.cache[k]; return require(CMDS); };
const { parse, report, fmt, ensureStarted, sessOpts, PORT, STATE_FILE } = load();

const HELP = `Off Leash QA  (node tools/qa/qa.cjs <command> [args] [--flags])

  build [--no-dev]           run every tools/*-hooks.mjs, node build.mjs, tools/dev-build.mjs
  state                      boot, start, print player/game state + errors
  places                     list teleport targets (places, interior rooms, districts at each)
  shot <where...>            screenshot each target: place name, "x,z", "x,z,yaw" or room:<id>
       --time 21.5 --yaw 1.2 --pitch 0.4 --clean (no HUD) --out <dir|file.png> --frames 20 --scale 2
  tour [where...]            screenshot every place (or the given ones) + a contact sheet (tour.png)
  eval '<js>'                run JS in the page (QA, G = window.__G in scope; await allowed), print result
  perf [where...]            frame ms (GPU included), draw calls, tris, heap per spot; --save/--compare <json>
  soak [--secs 120]          simulate N game seconds of free roam, report errors, hitches, NaNs, leaks
  test [suite...]            run smoke suites in tools/qa/suites (all by default); --list to list them
  run <scenario.cjs>         run your own script: module.exports = async ({ S, QA, shot, check, log }) => {}
  serve [--port 9333]        keep a warm page; other commands use it automatically (--fresh to bypass)
  stop | status | reload     control the warm page
  errors                     (warm page) errors captured so far, then cleared

Common flags: --html dist/index.html (default dist/dev.html)  --world <dir>|none (default world/)
  --seed N|random (default 1)  --clock H|real (start hour, default 12)  --width 1280 --height 720  --json (machine-readable output)  --fresh
`;

// ---------------- warm page server ----------------
async function serve(a) {
  const port = PORT(a);
  const log = (m) => console.log(m);
  let S = await new Session(sessOpts(a, log)).open();
  let inpageM = fs.statSync(INPAGE).mtimeMs;
  await ensureStarted(S);
  console.log(`[qa] warm page ready on :${port} (${S.o.html}, boot ${S.bootMs} ms). Ctrl+C or 'qa stop' to end.`);
  fs.writeFileSync(STATE_FILE(port), JSON.stringify({ pid: process.pid, port, html: S.o.html }));
  let busy = Promise.resolve();
  const srv = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', () => {
      busy = busy.then(async () => {
        const lines = []; const out = (m) => lines.push(m);
        let result = null, error = null;
        try {
          const { argv } = JSON.parse(body || '{}'); const b = parse(argv || []); const name = b._.shift();
          if (req.url === '/health') { result = { ok: true, html: S.o.html }; }
          else if (name === 'stop') { result = { stopping: true }; setTimeout(() => { S.close(); try { fs.unlinkSync(STATE_FILE(port)); } catch (e) { /* ignore */ } process.exit(0); }, 50); }
          else if (name === 'status') { const st = await S.state(); result = { html: S.o.html, bootMs: S.bootMs, state: st }; out(fmt(result)); }
          else if (name === 'reload') { await S.load(); await ensureStarted(S); out('reloaded'); }
          else if (name === 'errors') { const e = await S.errors(); report(out, e, await S.sanity()); await S.clearErrors(); result = e; }
          else if (load().cmds[name]) {
            const cmds = load().cmds;
            if (fs.statSync(INPAGE).mtimeMs !== inpageM) { log('[qa] inpage.js changed, restarting the browser'); await S.close(); S = await new Session(sessOpts(a, log)).open(); inpageM = fs.statSync(INPAGE).mtimeMs; }
            await S.refreshIfStale(); if (name !== 'test' && !(await S.js(() => window.QA.started()))) await ensureStarted(S); result = await cmds[name](S, b, out); }
          else throw new Error(`unknown command "${name}"`);
        } catch (e) { error = String(e.stack || e).split('\n').slice(0, 4).join('\n'); }
        const code = process.exitCode || 0; process.exitCode = 0;
        res.end(JSON.stringify({ lines, result, error, code }));
      });
    });
  });
  srv.listen(port, '127.0.0.1');
  const bye = () => { try { fs.unlinkSync(STATE_FILE(port)); } catch (e) { /* ignore */ } S.close().then(() => process.exit(0)); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
function ask(port, argv, url = '/cmd', timeout = 0) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port, path: url, method: 'POST', timeout }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end(JSON.stringify({ argv }));
  });
}

// ---------------- main ----------------
(async () => {
  const argv = process.argv.slice(2); const a = parse(argv); const name = a._.shift();
  if (!name || name === 'help' || a.help) { console.log(HELP); return; }
  if (name === 'serve') return serve(a);
  const { cmds } = load();
  if (name === 'build') { await cmds.build(null, a, console.log); return; }
  const port = PORT(a);
  let warm = false;
  if (!a.fresh && fs.existsSync(STATE_FILE(port))) { try { await ask(port, [], '/health', 1500); warm = true; } catch (e) { warm = false; } }
  if (['stop', 'status', 'reload', 'errors'].includes(name) && !warm) { console.log('no warm page running (start one: node tools/qa/qa.cjs serve &)'); return; }
  if (warm) {
    const r = await ask(port, argv);
    if (a.json) console.log(JSON.stringify(r.result, null, 1)); else for (const l of r.lines) console.log(l);
    if (r.error) { console.error(r.error); process.exitCode = 1; } else process.exitCode = r.code || 0;
    return;
  }
  if (!cmds[name]) { console.log(`unknown command "${name}"\n` + HELP); process.exitCode = 2; return; }
  const lines = []; const out = a.json ? (m) => lines.push(m) : (m) => console.log(m);
  const S = await new Session(sessOpts(a, a.json ? () => {} : console.log)).open();
  try {
    const r = await cmds[name](S, a, out);
    if (a.json) console.log(JSON.stringify(r, null, 1));
  } catch (e) { console.error(String(e.stack || e)); process.exitCode = 1; } finally { await S.close(); }
})();
