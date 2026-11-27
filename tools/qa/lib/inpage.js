// In-page test harness for Off Leash. Injected by tools/qa before any game script runs (page.addInitScript).
// Adds window.QA: a controllable frame clock, error capture, WebGL draw counters, teleports, camera/time control,
// state snapshots and sanity checks. It does not change game code: everything goes through window.__G and friends.
// Config arrives as window.__QA_CFG = { seed, world, manual } (set by the runner before this script).
(() => {
  if (window.QA) return;
  const CFG = window.__QA_CFG || {};
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeNow = performance.now.bind(performance);

  // ---------- seeded Math.random (reproducible traffic, peds, loot) ----------
  // dev build: start with the cheats panel closed so screenshots show the game
  try { const c = JSON.parse(localStorage.getItem('mg-cheats') || '{}'); if (c.open !== false) { c.open = false; localStorage.setItem('mg-cheats', JSON.stringify(c)); } } catch (e) { /* ignore */ }

  if (CFG.seed !== null && CFG.seed !== undefined) {
    let a = (CFG.seed >>> 0) || 1;
    Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- errors ----------
  const errors = []; // { kind, msg, stack, n, t, at }
  const seen = new Map();
  function rec(kind, msg, stack) {
    msg = String(msg).slice(0, 600);
    const key = kind + '|' + msg;
    const e = seen.get(key);
    if (e) { e.n++; return; }
    const r = { kind, msg, stack: stack ? String(stack).split('\n').slice(0, 8).join('\n') : '', n: 1, t: +(nativeNow() / 1000).toFixed(2), at: where() };
    seen.set(key, r); errors.push(r);
  }
  function where() { try { const A = window.__G; if (!A || !A.P) return ''; const P = A.P; return `${(P.car ? P.car.x : P.x).toFixed(1)},${(P.car ? P.car.z : P.z).toFixed(1)}`; } catch (e) { return ''; } }
  addEventListener('error', (e) => rec('error', e.message || (e.error && e.error.message) || 'error', e.error && e.error.stack));
  addEventListener('unhandledrejection', (e) => rec('rejection', (e.reason && e.reason.message) || e.reason, e.reason && e.reason.stack));
  for (const lvl of ['error', 'warn']) {
    const orig = console[lvl].bind(console);
    console[lvl] = (...a) => { try { rec('console.' + lvl, a.map((x) => (x && x.stack) || (typeof x === 'object' ? safeJson(x) : String(x))).join(' ')); } catch (e) { /* ignore */ } orig(...a); };
  }
  function safeJson(x) { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } }

  // ---------- WebGL counters (+ optional no-render mode for fast simulation) ----------
  const gl = { calls: 0, tris: 0, frameCalls: 0, frameTris: 0, maxCalls: 0, glErrors: 0 };
  let noRender = false;
  const MODE_TRI = 4;
  function wrap(proto) {
    if (!proto) return;
    const de = proto.drawElements, da = proto.drawArrays, dei = proto.drawElementsInstanced, dai = proto.drawArraysInstanced;
    proto.drawElements = function (m, c, t, o) { gl.calls++; if (m === MODE_TRI) gl.tris += c / 3; if (!noRender) de.call(this, m, c, t, o); };
    proto.drawArrays = function (m, f, c) { gl.calls++; if (m === MODE_TRI) gl.tris += c / 3; if (!noRender) da.call(this, m, f, c); };
    if (dei) proto.drawElementsInstanced = function (m, c, t, o, n) { gl.calls++; if (m === MODE_TRI) gl.tris += (c / 3) * n; if (!noRender) dei.call(this, m, c, t, o, n); };
    if (dai) proto.drawArraysInstanced = function (m, f, c, n) { gl.calls++; if (m === MODE_TRI) gl.tris += (c / 3) * n; if (!noRender) dai.call(this, m, f, c, n); };
  }
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  let ctxGL = null; // the game's context, for gpuSync
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, o) { const c = getCtx.call(this, type, o); if (c && /webgl/.test(type) && !ctxGL) ctxGL = c; return c; };
  const px1 = new Uint8Array(4);
  /** Block until the GPU (SwiftShader) has finished every queued frame, so timings are honest and nothing backs up. */
  function gpuSync() { if (ctxGL) { try { ctxGL.readPixels(0, 0, 1, 1, ctxGL.RGBA, ctxGL.UNSIGNED_BYTE, px1); } catch (e) { /* ignore */ } } }

  // ---------- frame clock: auto (real rAF) or manual (QA.step drives frames synchronously) ----------
  let manual = false, vt = 0, offset = 0, nextId = 1;
  let queue = new Map();
  const frameMs = []; // CPU ms of each frame's callbacks (last 600)
  const hitches = [];
  let frameNo = 0;
  performance.now = () => (manual ? vt : nativeNow() + offset);
  window.requestAnimationFrame = (cb) => { const id = nextId++; queue.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { queue.delete(id); };
  function runFrame(t) {
    const q = queue; queue = new Map();
    gl.calls = 0; gl.tris = 0;
    const t0 = nativeNow();
    for (const cb of q.values()) { try { cb(t); } catch (e) { rec('frame', e && e.message, e && e.stack); } }
    const ms = nativeNow() - t0;
    frameMs.push(ms); if (frameMs.length > 600) frameMs.shift();
    gl.frameCalls = gl.calls; gl.frameTris = gl.tris; gl.maxCalls = Math.max(gl.maxCalls, gl.calls);
    frameNo++;
    if (ms > 250 && frameNo > 30 && hitches.length < 50) hitches.push({ frame: frameNo, ms: Math.round(ms), at: where() });
  }
  (function pump() { nativeRAF((t) => { if (!manual) runFrame(performance.now()); pump(); }); })();

  // ---------- fake artifact db: serves the repo's world/*.json like the real saved world ----------
  const dbWrites = [];
  if (CFG.world) {
    const docs = { 'world/terrain': CFG.world.terrain, 'world/ground': CFG.world.ground, 'world/edits': CFG.world.edits };
    const db = {
      doc: (p) => ({
        onSnapshot(cb) { setTimeout(() => { const d = docs[p]; cb({ exists: !!d, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } }); }, 0); return () => {}; },
        async set(d) { dbWrites.push({ path: p, bytes: JSON.stringify(d).length, at: Date.now() }); docs[p] = d; },
        async update(d) { dbWrites.push({ path: p, bytes: JSON.stringify(d).length, at: Date.now(), update: true }); docs[p] = Object.assign({}, docs[p], d); },
        async get() { const d = docs[p]; return { exists: !!d, data: () => d }; },
      }),
    };
    window.claude = Object.assign(window.claude || {}, { use: async (name) => (name === 'db' ? db : null) });
  }

  const A = () => window.__G;
  const press = (k, type) => dispatchEvent(new KeyboardEvent(type, { key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, bubbles: true }));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const r2 = (v) => (fin(v) ? Math.round(v * 100) / 100 : v);

  const QA = {
    cfg: CFG, errors, hitches, dbWrites, gl,
    get frame() { return frameNo; },
    get manual() { return manual; },
    ready: () => !!(A() && A().scene && A().P),
    started: () => !document.body.classList.contains('titled'),

    /** Switch the frame clock. Manual: frames only advance through QA.step (deterministic, as fast as the CPU allows). */
    setManual(on) {
      if (on === manual) return manual;
      if (on) { vt = nativeNow() + offset; manual = true; } else { offset = vt - nativeNow(); manual = false; }
      return manual;
    },
    /** Run n frames synchronously. dt = game seconds per frame (the game clamps to 0.05).
     *  render: 'last' (default: simulate fast, draw only the final frame), true (draw every frame), false (draw none). */
    step(n = 1, o = {}) {
      const dt = o.dt || 0.05, was = noRender, mode = o.render === undefined ? 'last' : o.render;
      if (!manual) QA.setManual(true);
      try {
        for (let i = 0; i < n; i++) {
          noRender = was || mode === false || (mode === 'last' && i < n - 1);
          // the cached sun shadow map must not refresh on a frame whose draw calls are skipped (it would come out empty)
          if (window.__SHADOW) window.__SHADOW.hold(noRender || QA.shadowHold);
          vt += dt * 1000; runFrame(vt);
          if (!noRender) gpuSync();
        }
      } finally { noRender = was; }
      return frameNo;
    },
    gpuSync,
    /** Real frame cost with rendering, GPU included: renders n frames and times each (ms). */
    timeFrames(n = 30) {
      if (!manual) QA.setManual(true);
      const ms = [], calls = [];
      for (let i = 0; i < n; i++) { const t0 = nativeNow(); vt += 50; runFrame(vt); gpuSync(); ms.push(nativeNow() - t0); calls.push(gl.frameCalls); }
      const s = ms.slice().sort((a, b) => a - b);
      return { frames: n, avgMs: r2(ms.reduce((a, b) => a + b, 0) / n), p95Ms: r2(s[Math.floor(n * 0.95)] ?? s[n - 1]), maxMs: r2(s[n - 1]), drawCalls: Math.round(calls.reduce((a, b) => a + b, 0) / n) };
    },
    /** Wait n real frames (auto mode) or step them (manual mode). */
    async frames(n = 1, o = {}) {
      if (manual) return QA.step(n, o);
      const target = frameNo + n; while (frameNo < target) await sleep(4); return frameNo;
    },
    /** Step (or wait) until fn() is truthy; returns frames used or -1 on timeout. */
    async until(fn, max = 400, o = {}) {
      for (let i = 0; i < max; i++) { let ok = false; try { ok = fn(); } catch (e) { /* not yet */ } if (ok) return i; await QA.frames(1, o); }
      return -1;
    },
    set noRender(v) { noRender = !!v; }, get noRender() { return noRender; },
    /** true = freeze the sun shadow map (perf: measure a steady frame, the refresh is measured on its own). */
    shadowHold: false,

    /** Title screen -> playing, every intro dialog line skipped, input lock expired. */
    async start() {
      if (!QA.ready()) throw new Error('game not booted');
      if (!QA.started()) document.getElementById('start').click();
      for (let i = 0; i < 40 && A().G.dialog; i++) { await QA.key('e', 1); }
      await QA.frames(16);
      return QA.state();
    },
    /** Press a key for n frames (keydown, frames, keyup). Keys are what the game reads: 'w', 'e', ' ', 'shift', 'f'... */
    async key(k, n = 1, o = {}) { if (o.unlock !== false && A() && A().P) A().P.lock = 0; press(k, 'keydown'); await QA.frames(Math.max(1, n), o); press(k, 'keyup'); await QA.frames(1, o); },
    /** Hold several keys for n frames, e.g. QA.hold(['w','shift'], 60). */
    async hold(ks, n = 30, o = {}) { for (const k of ks) press(k, 'keydown'); await QA.frames(n, o); for (const k of ks) press(k, 'keyup'); await QA.frames(1, o); },
    down: (k) => press(k, 'keydown'), up: (k) => press(k, 'keyup'),

    places() {
      const G = A(), out = {};
      for (const [k, v] of Object.entries(G.places)) if (v && fin(v.x) && fin(v.z)) out[k] = { x: r2(v.x), z: r2(v.z) };
      return out;
    },
    rooms() { try { return Object.keys(window.__INT.state.doors).sort(); } catch (e) { return []; } },
    /** Resolve "quik" | "room:diner" | "12.5,-40" | {x,z} | [x,z] to a point. */
    resolve(t) {
      const G = A();
      if (Array.isArray(t)) return { x: +t[0], z: +t[1], yaw: t[2] };
      if (t && typeof t === 'object') return t;
      const s = String(t);
      const m = s.match(/^\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)\s*(?:[, ]\s*(-?[\d.]+))?\s*$/);
      if (m) return { x: +m[1], z: +m[2], yaw: m[3] !== undefined ? +m[3] : undefined };
      const p = G.places[s];
      if (p && fin(p.x)) return { x: p.x, z: p.z, yaw: p.yaw };
      if (p && Array.isArray(p) && p[0] && fin(p[0].x)) return { x: p[0].x, z: p[0].z };
      const doors = (window.__INT && window.__INT.state.doors) || {};
      if (doors[s]) return { x: doors[s].x, z: doors[s].z, yaw: doors[s].yaw };
      throw new Error(`unknown place "${s}". Try: ${Object.keys(QA.places()).join(', ')}`);
    },
    /** Teleport the player (or their car). "room:<id>" enters that interior instead. */
    async tp(t, o = {}) {
      const G = A(), I = window.__INT;
      if (typeof t === 'string' && t.startsWith('room:')) return QA.enter(t.slice(5));
      const p = QA.resolve(t);
      if (I && I.inside) { I.exit({ to: { x: p.x, z: p.z, yaw: p.yaw || 0 }, instant: true }); await QA.frames(3); }
      const P = G.P;
      if (P.car) { const c = P.car; c.x = p.x; c.z = p.z; c.speed = 0; c.vx = c.vz = 0; if (p.yaw !== undefined) c.yaw = p.yaw; }
      else { P.x = p.x; P.z = p.z; P.vx = P.vz = 0; P.vy = 0; P.y = o.y ?? 0; if (p.yaw !== undefined) P.yaw = p.yaw; }
      if (o.yaw !== undefined) { if (P.car) P.car.yaw = o.yaw; else P.yaw = o.yaw; }
      await QA.frames(o.settle ?? 6, { render: o.render });
      return QA.state();
    },
    async enter(id) {
      const I = window.__INT; if (!I) throw new Error('no interiors');
      if (A().P.car) A().exitCar?.();
      await QA.until(() => I.ready ? I.state.roomsLoaded : true, 200);
      if (I.inside) { I.exit({ instant: true }); await QA.frames(3); }
      I.enter(id, { instant: true, force: true });
      await QA.until(() => I.inside && !I.state.fading, 200);
      await QA.frames(4);
      return QA.state();
    },
    async exit() { const I = window.__INT; if (I && I.inside) { I.exit({ instant: true }); await QA.until(() => !I.inside, 100); await QA.frames(3); } return QA.state(); },
    /** Hour 0-24 (e.g. 21.5). freeze:true keeps the clock still so shots and checks are stable. */
    time(h, o = {}) {
      const el = document.querySelector('#tdbg [data-v=slider]');
      if (el) { el.value = String(h); el.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (window.__dev && window.__dev.setClock) window.__dev.setClock(h); else A().G.clock = h;
      if (o.freeze !== undefined) { const f = document.querySelector('#tdbg [data-v=freeze]'); if (f) { f.checked = !!o.freeze; f.dispatchEvent(new Event('change', { bubbles: true })); } }
      return A().G.clock;
    },
    /** Orbit camera: yaw (radians, 0 = looking down +z from behind), pitch (0 flat .. 1.1 top-down). Held until QA.freeCam(). */
    cam(yaw, pitch = 0.35) { A().setCam(yaw, pitch); return { yaw, pitch }; },
    /** Point the camera at a target from behind the player. */
    camAt(t, pitch = 0.3) { const p = QA.resolve(t), G = A(); const yaw = Math.atan2(p.x - G.px(), p.z - G.pz()); return QA.cam(yaw, pitch); },
    hud(on) { let st = document.getElementById('qa-hud-off'); if (on === false && !st) { st = document.createElement('style'); st.id = 'qa-hud-off'; st.textContent = '#hud,#minimap,#toast,#banner,#prompt,#devbadge,#chbtn,#cheats,#touch,#tdbg,#skyclock,.hud,#objective,#timer,#dev,#devp{visibility:hidden!important}'; document.head.appendChild(st); } if (on !== false && st) st.remove(); },

    async spawnCar(type = 'sedan', o = {}) {
      const G = A(), P = G.P;
      const yaw = P.car ? P.car.yaw : P.yaw, d = o.dist ?? 5;
      const c = G.spawnCar(type, o.x ?? G.px() + Math.sin(yaw) * d, o.z ?? G.pz() + Math.cos(yaw) * d, o.yaw ?? yaw, { fuel: 100, ...(o.opts || {}) });
      if (o.enter) { P.x = c.x + 1.5; P.z = c.z; G.enterCar(c, true); }
      await QA.frames(3);
      return { type: c.type, x: r2(c.x), z: r2(c.z), inCar: P.car === c };
    },
    /** Drive: hold throttle (and optional steer 'a'/'d') for n frames; returns distance moved. */
    async drive(n = 60, steer = null, o = {}) {
      const G = A(), c = G.P.car; if (!c) throw new Error('not in a car');
      const x0 = c.x, z0 = c.z; await QA.hold(steer ? ['w', steer] : ['w'], n, o);
      return { dist: r2(Math.hypot(c.x - x0, c.z - z0)), speed: r2(c.speed), x: r2(c.x), z: r2(c.z) };
    },
    async leaveCar() { const G = A(); if (G.P.car) { await QA.key('e', 1); QA.step(6, { render: false }); } return !G.P.car; },
    async walk(n = 40, keys = ['w'], o = {}) {
      const G = A(), x0 = G.px(), z0 = G.pz(); await QA.hold(keys, n, o);
      return { dist: r2(Math.hypot(G.px() - x0, G.pz() - z0)), x: r2(G.px()), z: r2(G.pz()), y: r2(G.P.y) };
    },

    state() {
      const G = A(); if (!G || !G.P) return { booted: false };
      const P = G.P, I = window.__INT, c = P.car, x = G.px(), z = G.pz();
      let ground = null; try { ground = window.__dev ? r2(window.__dev.TER.heightAt(x, z)) : null; } catch (e) { /* ignore */ }
      return {
        frame: frameNo, started: QA.started(), x: r2(x), z: r2(z), y: r2(P.y), ground, yaw: r2(P.yaw), swim: !!P.swim,
        district: G.districtAt ? G.districtAt(x, z) : '', inside: I && I.inside ? I.current() : null,
        car: c ? { type: c.type, speed: r2(c.speed), hp: r2(c.hp), fuel: r2(c.fuel) } : null,
        hp: r2(G.G.hp), cash: G.G.cash, heat: G.G.heat, clock: r2(G.G.clock), dialog: !!G.G.dialog, paused: !!G.G.paused,
        mission: G.mission ? (G.mission.id || G.mission.name || true) : null, jail: window.__JAIL ? window.__JAIL.active() : false,
        cars: G.cars.length, peds: G.peds.length, errors: errors.length,
      };
    },
    /** Scene + render stats: visible meshes, unique geos/materials, GL draw calls and triangles of the last frame. */
    stats() {
      const G = A(); let objs = 0, meshes = 0, visible = 0, tris = 0; const mats = new Set(), geos = new Set();
      G.scene.traverse((o) => {
        objs++; if (!o.isMesh && !o.isSprite) return;
        let p = o, vis = true; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
        if (!vis) return; visible++;
        if (o.isMesh) { meshes++; geos.add(o.geometry.uuid); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m.uuid)); const g = o.geometry; tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3; }
      });
      const f = frameMs.slice(-120), s = f.slice().sort((a, b) => a - b);
      return {
        objs, visible, meshes, sceneTris: Math.round(tris), geos: geos.size, mats: mats.size,
        drawCalls: gl.frameCalls, glTris: Math.round(gl.frameTris), maxDrawCalls: gl.maxCalls,
        cpuMsAvg: f.length ? r2(f.reduce((a, b) => a + b, 0) / f.length) : null, cpuMsP95: s.length ? r2(s[Math.floor(s.length * 0.95)]) : null,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        lights: (() => { let n = 0; G.scene.traverse((o) => { if (o.isLight && o.visible) n++; }); return n; })(),
      };
    },
    /** Cheap invariants that catch most physics/teleport bugs: NaNs, out of bounds, sunk under terrain, stuck dialogs. */
    sanity() {
      const G = A(), P = G.P, out = [];
      for (const k of ['x', 'y', 'z', 'yaw']) if (!fin(P[k])) out.push(`player.${k} is ${P[k]}`);
      const lim = (G.MAP_HALF || 150) + 40;
      const inside = !!(window.__INT && window.__INT.inside);
      if (!inside && (Math.abs(G.px()) > lim || Math.abs(G.pz()) > lim)) out.push(`player out of bounds at ${r2(G.px())},${r2(G.pz())}`);
      if (fin(P.y) && P.y < -3 && !P.swim && !(window.__INT && window.__INT.inside)) out.push(`player sunk: y ${r2(P.y)}`);
      G.cars.forEach((c, i) => { if (!fin(c.x) || !fin(c.z) || !fin(c.yaw)) out.push(`car[${i}] ${c.type} has NaN position`); if (fin(c.speed) && Math.abs(c.speed) > 80) out.push(`car[${i}] ${c.type} speed ${r2(c.speed)}`); });
      G.peds.forEach((p, i) => { if (!fin(p.x) || !fin(p.z)) out.push(`ped[${i}] has NaN position`); });
      const cp = G.camera.position; if (!fin(cp.x) || !fin(cp.y) || !fin(cp.z)) out.push('camera position NaN');
      if (!fin(G.G.hp)) out.push('hp NaN'); if (!fin(G.G.cash)) out.push('cash NaN'); if (!fin(G.G.clock)) out.push('clock NaN');
      return out;
    },
    /** Errors since index i (pass the previous length to get only new ones). */
    errorsSince(i = 0) { return errors.slice(i); },
    clearErrors() { errors.length = 0; seen.clear(); hitches.length = 0; },
  };
  window.QA = QA;
})();
