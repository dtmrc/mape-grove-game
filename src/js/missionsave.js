// Mission resume (diet 2026-11-27: "i was just middle of the way through my quest with the raccoon trash bags when the
// game refreshed and i lost the state my quest"). The page can reload under the player: the test page live-reloads every
// open view when a new build is published, and iOS Safari can drop a heavy tab while it is in the background.
//
// While a mission runs, a small snapshot of it goes to its own localStorage key every few seconds and whenever the page is
// hidden or unloaded, together with the main save (position, cash). On the next boot, the first unpaused frame rebuilds
// the mission from the snapshot instead of starting it fresh. The timer carries over with a 10 s grace for getting going
// again; real time spent away does not count. A snapshot older than a day is dropped.
//
// Each mission's snap/resume lives here (RESUME), so game.js and jobs.js only carry two small hooks:
//   game.js: MSAVE.init({...}) after makeJobs, MSAVE.tick(dt) in the frame, the key in SAVE_KEYS.
//   jobs.js: signs keep their text index + yaw, and SIGN_TEXT is exported.
// A mission with no RESUME entry restarts from its start() after a reload (better than losing it).
// Debug / tests: window.__G.msave.{ write, read, clear, resumeNow }.

export const MISSION_KEY = 'maple-grove-offleash-mission-v1';
const EVERY = 3;              // seconds between snapshots while a mission runs
const GRACE = 10;             // extra seconds on a resumed timer
const MAX_AGE = 24 * 3600e3;  // a day: older snapshots are dropped

let A = null, saveT = 0, booted = false, had = false;

const carAt = (c) => (c && !c.dead ? { x: +c.x.toFixed(2), z: +c.z.toFixed(2), yaw: +(c.yaw || 0).toFixed(3), hp: c.hp } : null);
function park(c, s) { if (!c || !s) return; c.x = s.x; c.z = s.z; c.yaw = s.yaw; c.vx = c.vz = c.speed = 0; if (c.vy !== undefined) c.vy = 0; if (s.hp !== undefined && c.hp !== undefined) c.hp = s.hp; }
const timed = (t) => Math.max(0, +t || 0) + GRACE;

// per mission: snap(m) -> plain JSON; resume(m, s) builds the running state (in place of start()). Omit resume to restart.
const RESUME = {
  ricky: {
    snap: (m) => ({ timer: m.timer, stage: m.stage, got: m.got, bags: m.bags.map((b) => ({ x: b.x, z: b.z, alive: !!b.alive })) }),
    resume(m, s) {
      const { addPickup, setCheck, objective, places } = A;
      m.bags = s.bags.map((b, i) => (b.alive ? addPickup('bag', b.x, b.z, { id: 'bag' + i }) : { kind: 'bag', x: b.x, z: b.z, alive: false, mesh: null, respawn: 0 }));
      m.got = s.got | 0; m.timer = timed(s.timer); m.stage = s.stage === 'return' ? 'return' : 'collect';
      if (m.stage === 'return') { setCheck(places.park.x, places.park.z + 2, 2.5); objective('Bring the trash to Big Ricky in Lakeside Park.'); }
      else objective(`Collect the good trash. (${m.got}/6)`);
    },
  },
  nana: {
    snap: (m) => ({ stage: m.stage, timer: m.timer, stops: m.stops, wrecked: !!m.wrecked, car: m.wrecked ? null : carAt(m.car), inCar: !!m.car && A.P.car === m.car }),
    resume(m, s, start) {
      start(); // the wagon back at Nana's (or found), random stops: then put back what was saved
      m.stops = s.stops; m.stage = s.stage;
      if (s.wrecked || !s.car) { m.car = { dead: true, x: 0, z: 0 }; m.wrecked = true; } // the wagon was lost: any ride will do
      else { park(m.car, s.car); if (s.inCar) A.enterCar(m.car, true); }
      if (m.stage === 'car') return;
      m.timer = timed(s.timer); m.next();
    },
  },
  gary: {
    snap: (m) => ({ cart: carAt(m.cart) }),
    resume(m, s, start) { start(); park(m.cart, s.cart); },
  },
  repo: {
    snap: (m) => ({ taken: !!m.taken, cart: carAt(m.cart), inCar: !!m.cart && A.P.car === m.cart }),
    resume(m, s, start) {
      start(); if (!s.taken || !s.cart) return;
      park(m.cart, s.cart); m.taken = true; A.setCheck(m.drop.x, m.drop.z, 4, "Nana's RV lot");
      if (s.inCar) A.enterCar(m.cart, true);
    },
  },
  signs: {
    snap: (m) => ({ timer: m.timer, got: m.got, signs: m.signs.map((g) => ({ x: g.x, z: g.z, yaw: g.yaw || 0, i: g.i | 0, alive: !!g.alive })) }),
    resume(m, s) {
      const { jobs, makeMarker, objective } = A, T = jobs.SIGN_TEXT;
      m.signs = s.signs.map((g) => {
        if (!g.alive) return { x: g.x, z: g.z, i: g.i, yaw: g.yaw, alive: false };
        const t = T[g.i % T.length], o = jobs.signProp(t[0], t[1], t[2], g.x, g.z, g.yaw), mk = makeMarker('mission', g.x, g.z, 0.5); mk.children[1].visible = false;
        return { x: g.x, z: g.z, g: o, mk, i: g.i, yaw: g.yaw, alive: true };
      });
      m.timer = timed(s.timer); m.got = s.got | 0; m.wasHit = !!A.P.punchHit;
      objective(`Paw the HOA lawn signs in the Estates. (${m.got}/6)`);
    },
  },
  kids: { snap: () => ({}), note: 'Race restarted from the line.' },   // a race is only fair from the start
  fish: { snap: () => ({}) },                                          // the fish in your bag are saved by fishing.js
};

function store(v) { try { if (v) localStorage.setItem(MISSION_KEY, JSON.stringify(v)); else localStorage.removeItem(MISSION_KEY); } catch (e) { /* storage blocked */ } }
function read() { try { return JSON.parse(localStorage.getItem(MISSION_KEY) || 'null'); } catch (e) { return null; } }

/** Snapshot the running mission now (and the main save, so the position matches). Clears the key when no mission runs. */
function write() {
  if (!A || !booted) return;
  const m = A.mission();
  if (!m) { if (had) { store(null); had = false; } return; }
  const H = RESUME[m.id];
  let s = {}; try { s = H && H.snap ? H.snap(m) : {}; } catch (e) { console.error('[missionsave] snap', m.id, e); }
  store({ v: 1, id: m.id, reward: m.reward, t: +(m.t || 0).toFixed(2), at: Date.now(), s });
  had = true;
  if (!A.G.over) A.save();
}

/** Rebuild the saved mission. Returns the mission, or null when there is nothing (or nothing valid) to resume. */
function resumeNow() {
  const v = read();
  if (!v || v.v !== 1 || !A.MISSIONS[v.id] || Date.now() - (+v.at || 0) > MAX_AGE || A.mission()) { if (v && !A.mission()) store(null); return null; }
  const m = A.MISSIONS[v.id](), H = RESUME[v.id] || {};
  if (v.reward !== undefined) m.reward = v.reward; // a half-pay replay stays half pay
  const start = m.start.bind(m);
  if (H.resume) m.start = () => { try { H.resume(m, v.s || {}, start); } catch (e) { console.error('[missionsave] resume', v.id, e); } };
  try { A.startMission(m); } catch (e) { console.error('[missionsave] start', v.id, e); store(null); return null; }
  if (H.resume && A.mission() === m) m.t = +v.t || 0;
  if (A.mission() !== m) { store(null); return null; }
  had = true;
  const left = m.timer !== undefined && m.stage !== 'car' ? ` ${Math.floor(m.timer / 60)}:${String(Math.floor(m.timer % 60)).padStart(2, '0')} left.` : '';
  A.toast(`Picked up where you left off: ${m.title}.${H.note ? ' ' + H.note : left}`, 5);
  return m;
}

export function init(args) {
  A = args;
  const flush = () => { try { write(); } catch (e) { /* ignore */ } };
  addEventListener('pagehide', flush);
  addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  return { write, read, clear: () => store(null), resumeNow, RESUME };
}

/** Every unpaused frame. The first one resumes a saved mission; after that, snapshots every EVERY seconds. */
export function tick(dt) {
  if (!A) return;
  if (!booted) { booted = true; resumeNow(); saveT = 0; return; }
  const m = A.mission();
  if (!m) { if (had) { store(null); had = false; } return; }
  if ((saveT += dt) >= EVERY) { saveT = 0; write(); }
}
