// Town service vehicles and EMS dispatch (diet, 2026-11-28: "make the tractor drivable with enhanced graphics? same for the fire
// truck and emergency medical vehicle at the hospital ... when we run over pedestrians, there should be some random ambulance
// dispatches with stretchers and emts").
//   * VFD Engine 1 (pumper12) in the fire station's open bay, the ambulance (ambulance15) under the hospital's ER canopy and the
//     Greenacre 5045 tractor (tractor) behind the farmhouse on Lake Rd: baked models (tools/vehicles), drivable like any car.
//     Each comes back to its spot when it was wrecked or left far away and the spot is out of sight.
//   * Horn (H / the horn button) in the engine or the ambulance toggles its siren and light bar.
//   * Running a walker over sometimes (DISPATCH_CHANCE) calls an ambulance: it drives in along the roads with its siren on, two
//     EMTs carry a stretcher to the casualty, load them up and the ambulance drives off. One call at a time.
// Cost: nothing per frame while no call is running (a 1 s timer checks the parked vehicles); the EMTs and the stretcher are built
// once on the first call and reused. Debug: window.__EMS (.dispatch(), .state, .cars).
import * as THREE from 'three';
import { mat } from './gfx.js';
import { makeHuman, animBiped } from './models.js';

export const SERVICE_ENABLED = true;
const DISPATCH_CHANCE = 0.5, COOLDOWN = 25;
const HOMES = [
  { id: 'pumper12', spot: 'fireEngine', hp: 260, heat: 'borrowing VFD Engine 1', hello: 'VFD Engine 1. H toggles the siren.' },
  { id: 'ambulance15', spot: 'ambulance', hp: 180, heat: 'joyriding the ambulance', hello: 'Maple Grove EMS. H toggles the siren.' },
  { id: 'tractor', spot: 'tractor', hp: 200, heat: null, hello: 'Greenacre 5045. Top speed: leisurely.' },
];
const LINES = ['EMT: "Sir, how many paws am I holding up?"', 'EMT: "Pupils reactive. Dignity, less so."', 'EMT: "On three. One, two..."', 'EMT: "Another one? Third this week."', 'EMT: "Did a CAT do this?"'];

export function makeServices(A) {
  const { scene, P, cars, peds, places, CAR_TYPES, NODES, ADJ } = A;
  const homes = HOMES.filter((h) => CAR_TYPES[h.id] && places[h.spot]).map((h) => ({ ...h, car: null }));
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  const alive = (c) => c && !c.gone && !c.dead;

  // ---------------- parked service vehicles ----------------
  function park(h) {
    const s = places[h.spot];
    const c = A.spawnCar('pickup', s.x, s.z, s.yaw, { model: h.id, role: 'service', fuel: 100, hp: h.hp, color: 0xffffff });
    c.svc = h.id; c.siren = false; h.car = c; return c;
  }
  for (const h of homes) park(h);
  let homeT = 0;
  function homeTick() {
    for (const h of homes) {
      const s = places[h.spot], c = h.car;
      if (alive(c) && dist(c.x, c.z, s.x, s.z) < 6) continue;               // still at home
      if (c === P.car || dist(A.px(), A.pz(), s.x, s.z) < 80 || !A.hidden(s.x, s.z, 80)) continue;
      if (cars.some((o) => dist(o.x, o.z, s.x, s.z) < 5)) continue;          // something parked on the spot
      if (c && !c.gone && !c.dead) {                                        // left somewhere else: only take it back out of sight
        if (c.driver || dist(A.px(), A.pz(), c.x, c.z) < 110 || !A.hidden(c.x, c.z, 110)) continue;
        A.removeCar(c);
      }
      park(h);
    }
  }

  // entering one: a star for taking the engine or the ambulance (once per vehicle), a hint either way
  function enter(c, silent) {
    if (!c.svc) return;
    const h = HOMES.find((q) => q.id === c.svc);
    if (!silent) A.toast(h.hello, 3);
    if (h.heat && !c.taken && !silent) { c.taken = true; A.addHeat(1, h.heat); }
    if (c.role === 'emsrun') abort('stolen');
  }
  // horn in a siren vehicle: siren + light bar on / off (returns true when it handled the horn)
  function horn(c) {
    const u = c.mesh.userData; if (!u.siren) return false;
    c.siren = !c.siren; A.toast(c.siren ? 'Siren on' : 'Siren off', 1.2); A.Sfx.blip(c.siren ? 880 : 440);
    return true;
  }
  // siren loudness for the engine-sound mixer: the player's own siren, or a dispatched ambulance nearby
  function sirenLevel() {
    if (P.car && P.car.siren && !P.car.dead) return 0.8;
    const c = D && D.car; if (!c || !c.siren || c.gone) return 0;
    return Math.min(1, 25 / Math.max(5, dist(c.x, c.z, A.px(), A.pz())));
  }

  // ---------------- dispatch ----------------
  let D = null, cool = 0, emts = null, stretcher = null;
  function build() {
    if (emts) return;
    emts = [0, 1].map((k) => makeHuman({ shirt: k ? 0xe8ecf0 : 0x1e3a78, pants: 0x1c2433, shoe: 0x111111, cap: 0x1e3a78, skin: [0xc98e64, 0x8a5a3a][k], hair: 0x2a1e14 }));
    const g = new THREE.Group(), metal = mat(0xc8ccd0), pad = mat(0x3a6ac0), sheet = mat(0xf2f2ee);
    const B = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
    for (const s of [-1, 1]) B(0.04, 0.04, 2.0, metal, s * 0.3, 0.78, 0);                     // side rails
    for (const z of [-0.8, 0.8]) for (const s of [-1, 1]) { B(0.04, 0.72, 0.04, metal, s * 0.24, 0.4, z); B(0.08, 0.08, 0.08, mat(0x222222), s * 0.24, 0.05, z); }
    B(0.56, 0.1, 1.9, pad, 0, 0.84, 0); B(0.5, 0.03, 1.2, sheet, 0, 0.9, -0.2); B(0.42, 0.08, 0.3, sheet, 0, 0.92, 0.75);   // mattress, sheet, pillow
    for (const o of g.children) o.castShadow = false;
    stretcher = g;
  }
  function show(on) { for (const m of [...emts, stretcher]) { if (on) scene.add(m); else scene.remove(m); } }

  // Dijkstra over the road graph from the casualty's node: every node's distance + next hop toward it
  const _dd = [], _nx = [], _done = [];
  function routeField(goal) {
    const n = NODES.length; _dd.length = _nx.length = _done.length = n;
    for (let i = 0; i < n; i++) { _dd[i] = Infinity; _nx[i] = -1; _done[i] = false; }
    _dd[goal] = 0;
    for (;;) {
      let u = -1, best = Infinity; for (let i = 0; i < n; i++) if (!_done[i] && _dd[i] < best) { best = _dd[i]; u = i; }
      if (u < 0 || best > 400) break;
      _done[u] = true;
      for (const e of ADJ[u] || []) { if (e.nt || !NODES[e.n]) continue; const w = best + dist(NODES[u].x, NODES[u].z, NODES[e.n].x, NODES[e.n].z); if (w < _dd[e.n]) { _dd[e.n] = w; _nx[e.n] = u; } }
    }
  }
  function report(p, c) {
    if (!SERVICE_ENABLED || D || cool > 0 || !CAR_TYPES.ambulance15 || !p || p.npc || p.kind !== 'human') return;
    if (c !== P.car || Math.random() > DISPATCH_CHANCE) return;
    dispatch(p);
  }
  function dispatch(p) {
    if (D) return false;
    if (!p) p = peds.find((q) => q.kind === 'human' && !q.npc);
    if (!p) return false;
    D = { st: 'wait', t: 5 + Math.random() * 5, victim: p, car: null, tries: 0, route: null, ri: 0, k: 0, line: 0 };
    p.ems = true;
    return true;
  }
  function holdVictim() {
    const p = D.victim; if (!p) return false;
    if (!peds.includes(p)) return false;                      // culled while the player drove off
    if (p.state === 'down') p.t = Math.max(p.t, 1.5); else if (!D.picked) return false;
    return true;
  }
  function spawnAmbulance() {
    const p = D.victim, goal = A.nearestNode(p.x, p.z);
    routeField(goal);
    let pick = -1, pd = 0;
    for (let i = 0; i < NODES.length; i++) {
      const d = _dd[i]; if (!(d > 60 && d < 260) || _nx[i] < 0) continue;
      if (!A.hidden(NODES[i].x, NODES[i].z, 40)) continue;
      const score = -Math.abs(d - 120) + Math.random() * 30;
      if (pick < 0 || score > pd) { pick = i; pd = score; }
    }
    if (pick < 0) return false;
    const route = []; for (let i = pick; i >= 0 && route.length < 80; i = _nx[i]) { route.push(i); if (i === goal) break; }
    const a = NODES[route[0]], b = NODES[route[1] ?? route[0]];
    const c = A.spawnCar('pickup', a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z), { model: 'ambulance15', role: 'emsrun', driver: 'ems', fuel: 100, hp: 400, color: 0xffffff });
    c.svc = 'ambulance15'; c.siren = true; c.taken = true;
    D.car = c; D.route = route; D.ri = 1; D.st = 'drive'; D.t = 0;
    A.toast('📻 Dispatch: "Maple Grove EMS, man down, en route."', 3);
    return true;
  }
  // the ambulance's driver (game.js updateCars calls this for driver 'ems')
  function carAI(c, dt) {
    if (!D || D.car !== c) { A.drive(c, 0, 0, true, dt); return; }
    if (D.st === 'drive') {
      D.t += dt;
      const p = D.victim; let tx, tz, last = D.ri >= D.route.length;
      if (!last) { const n = NODES[D.route[D.ri]]; tx = n.x; tz = n.z; if (dist(c.x, c.z, tx, tz) < 7) D.ri++; }
      else { tx = p.x; tz = p.z; }
      const dv = dist(c.x, c.z, p.x, p.z);
      c.topMul = dv < 25 ? 0.35 : D.ri >= D.route.length - 1 ? 0.6 : 0.8;
      if (dv < 7 || (last && D.t > 70)) { D.st = 'stop'; A.drive(c, 0, 0, true, dt); return; }
      A.chaseAI(c, dt, tx, tz);
      // stuck behind something for a long time while nobody watches: hop to the next road node
      if (D.t > 50 && !last && A.hidden(c.x, c.z, 40)) { const n = NODES[D.route[D.ri]]; c.x = n.x; c.z = n.z; c.vx = c.vz = 0; D.t = 30; }
    } else {
      A.drive(c, 0, 0, true, dt); c.vx *= 1 - Math.min(1, 4 * dt); c.vz *= 1 - Math.min(1, 4 * dt);
    }
  }
  // stretcher + EMT placement: stretcher at (x, z) heading yaw, EMTs at its ends, victim on top
  function carry(x, z, yaw, moving, dt) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    stretcher.position.set(x, 0, z); stretcher.rotation.y = yaw;
    D.ph = (D.ph || 0) + dt * moving * 4.2;
    emts.forEach((m, i) => {
      const s = i ? -1.25 : 1.25; m.position.set(x + fx * s, 0, z + fz * s); m.rotation.y = yaw;
      animBiped(m, D.ph + i * Math.PI, moving ? 1 : 0, A.G.time);
      const u = m.userData; if (u.arms) for (const a of u.arms) a.rotation.x = -0.55;   // hands on the rails
    });
    if (D.picked) { const v = D.victimMesh; v.position.set(x + fx * 0.85, 0.72, z + fz * 0.85); v.rotation.y = yaw; }
  }
  function rearOf(c, back = 0.9) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), r = c.spec.len / 2 + back; return [c.x - fx * r, c.z - fz * r]; }
  function update(dt) {
    if ((homeT -= dt) <= 0) { homeT = 1; homeTick(); }
    if (cool > 0) cool -= dt;
    if (!D) return;
    const c = D.car;
    if (D.st !== 'leave' && D.st !== 'wait' && !D.picked && !holdVictim()) { abort('lost'); return; }
    if (c && (c.gone || c.dead)) { abort('wreck'); return; }
    if (D.st === 'wait') {
      if (!holdVictim()) { abort('lost'); return; }
      if ((D.t -= dt) > 0) return;
      if (!spawnAmbulance()) { D.t = 3; if (++D.tries > 6) abort('none'); }
    } else if (D.st === 'stop') {
      if (Math.hypot(c.vx, c.vz) > 0.6) return;
      build(); show(true);
      const [x, z] = rearOf(c); D.sx = x; D.sz = z; D.st = 'out'; D.t = 0; D.wp = 0;
      // round the side of the ambulance nearest the casualty: rear corner, front corner, then the casualty
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), sd = Math.sign((D.victim.x - c.x) * fz - (D.victim.z - c.z) * fx) || 1;
      const ox = fz * sd * (c.spec.wid / 2 + 1.1), oz = -fx * sd * (c.spec.wid / 2 + 1.1), h = c.spec.len / 2;
      const ahead = (D.victim.x - c.x) * fx + (D.victim.z - c.z) * fz > -h * 0.3;   // casualty behind the ambulance: straight out of the doors
      D.path = ahead ? [[c.x - fx * h + ox, c.z - fz * h + oz], [c.x + fx * h + ox, c.z + fz * h + oz]] : [];
      const [ax, az] = D.path.length ? D.path[0] : [D.victim.x, D.victim.z];
      carry(x, z, Math.atan2(ax - x, az - z), 0, dt);
      if (dist(A.px(), A.pz(), c.x, c.z) < 40) A.toast(LINES[(Math.random() * LINES.length) | 0], 3);
    } else if (D.st === 'out' || D.st === 'back') {
      // out: path[0], path[1], casualty; back: path[1], path[0], rear doors
      const p = D.victim, out = D.st === 'out', [rx, rz] = rearOf(c, 1.4), n = D.path.length;
      const [tx, tz] = D.wp < n ? D.path[out ? D.wp : n - 1 - D.wp] : out ? [p.x, p.z] : [rx, rz];
      const dx = tx - D.sx, dz = tz - D.sz, d = Math.hypot(dx, dz), stop = D.wp < n ? 0.8 : out ? 1.6 : 0.4;
      D.t += dt;
      if (d <= stop && D.wp < n) D.wp++;
      else if (d > stop && D.t < 25) {
        const v = Math.min(d - stop, 1.7 * dt), yaw = Math.atan2(dx, dz);
        let x = D.sx + dx / d * v, z = D.sz + dz / d * v; if (D.wp >= n && D.t < 12) { const q = A.collide(x, z, 0.5); x = q.x; z = q.z; }   // last leg only; stuck on a corner: walk through it
        D.sx = x; D.sz = z; carry(x, z, out ? yaw : yaw + Math.PI, 1, dt);   // walking back, the foot end leads
      } else if (D.st === 'out') {
        // load the casualty: they leave the crowd and ride the stretcher
        D.st = 'load'; D.t = 1.6; D.picked = true;
        const m = p.mesh; A.removePed(p); scene.add(m); D.victimMesh = m;
        const u = m.userData; u.body.rotation.set(-Math.PI / 2, 0, 0); u.body.position.y = 0.15;
        carry(D.sx, D.sz, stretcher.rotation.y, 0, dt);
      } else {
        // into the back: stretcher, casualty and crew; lights on, off it goes
        show(false); scene.remove(D.victimMesh); D.victimMesh = null;
        D.st = 'leave'; D.t = 0; leave(c);
      }
    } else if (D.st === 'load') {
      if ((D.t -= dt) <= 0) { D.st = 'back'; D.t = 0; D.wp = 0; }
      else carry(D.sx, D.sz, stretcher.rotation.y, 0, dt);
    } else if (D.st === 'leave') {
      D.t += dt;
      if (c.gone || (D.t > 4 && dist(c.x, c.z, A.px(), A.pz()) > 70 && A.hidden(c.x, c.z, 70)) || D.t > 60) { if (!c.gone && c !== P.car) A.removeCar(c); D = null; cool = COOLDOWN; }
    }
  }
  // hand the ambulance to the traffic AI (lanes, lights) with its lights still on; it is removed once out of sight
  function leave(c) {
    const n = A.nearestNode(c.x, c.z), opts = A.roadOpts(n, -1), e = opts[(Math.random() * opts.length) | 0];
    c.role = 'emsleave'; c.driver = 'ai'; c.ai = { from: n, to: e.n, w: e.w || 7, off: (e.w || 7) / 4, cruise: 13 };
  }
  function abort() {
    if (!D) return;
    const c = D.car, p = D.victim;
    if (D.picked && D.victimMesh) { scene.remove(D.victimMesh); const v = A.spawnPed({ mesh: D.victimMesh, at: { x: stretcher.position.x, z: stretcher.position.z }, state: 'down' }); if (v) v.t = 3; }
    if (emts && D.st !== 'wait' && D.st !== 'drive') {
      show(false);
      for (const m of emts) { const q = A.spawnPed({ mesh: makeHuman({ shirt: 0x1e3a78, pants: 0x1c2433, cap: 0x1e3a78 }), at: { x: m.position.x, z: m.position.z }, state: 'flee' }); if (q) { q.t = 5; q.from = { x: A.px(), z: A.pz() }; } }
    }
    if (p) p.ems = false;
    if (c && !c.gone && c !== P.car && !c.dead && c.driver === 'ems') leave(c);
    D = null; cool = COOLDOWN;
  }

  const api = { update, carAI, report, dispatch, enter, horn, sirenLevel, get state() { return D ? { st: D.st, ri: D.ri, route: D.route && D.route.length, car: !!D.car, picked: !!D.picked } : null; }, get cars() { return homes.map((h) => h.car); }, homes };
  if (typeof window !== 'undefined') window.__EMS = api;
  return api;
}
