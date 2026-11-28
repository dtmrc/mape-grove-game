// carphys.js - GTA IV style car handling for the player's car (driving thread, 2026-11-11).
//
// The old drive() in game.js is an arcade model (velocity rotated straight onto the heading, sideways speed bled off).
// This replaces it for the PLAYER'S car with a small rigid-body model so cars feel heavy and loose the way GTA IV does:
//   - mass, yaw inertia, centre of gravity height and wheelbase per car type (from models.js CAR_TYPES)
//   - two axles (bicycle model) with a Pacejka-style tyre curve: grip builds, peaks, then falls off into a slide
//   - weight transfer front/back: braking loads the nose (tucks in), lifting off / handbrake lightens the tail (it swings)
//   - friction circle: braking or wheelspin eats cornering grip, so you can power-slide RWD cars and lock up under brakes
//   - handbrake locks the rear axle (sliding friction opposes the contact patch's motion), J-turns and drifts work
//   - automatic gearbox with short torque gaps on upshift (the car lurches and the body bobs), rpm drives the engine note
//   - surface grip: paved 1.0, dirt 0.8, grass 0.7
//   - soft, underdamped suspension on EVERY car's body (pitch on brake / throttle, roll in turns, heave on hits)
//   - skid marks (one instanced mesh), tyre smoke, tyre screech, spin-outs from off-centre hits (PIT the cops)
// AI cars keep the arcade drive() (their tuning, police escapability etc. depends on it) but get body motion and spins.
//
// Speeds are m/s and forces N. Body frame: u = forward speed, v = speed toward the car's LEFT (the direction yaw grows),
// r = yaw rate. Positive steer turns left, same as the old model.
import * as THREE from 'three';

const G = 9.81;
const SUB = 1 / 120;             // physics sub-step
const GEARS = [0.27, 0.45, 0.63, 0.81, 1.0]; // fraction of top speed each gear tops out at
const GEARF = [1.0, 0.78, 0.62, 0.52, 0.45]; // relative drive force per gear
export const TUNE = {
  mu: 1.0,          // tarmac grip
  B: 8, C: 1.3, E: -0.2, // tyre curve (peak slip ~0.17 rad, keeps ~90% grip past the peak, so turns don't let go)
  slide: 0.82,      // locked / sliding tyre friction (fraction of mu)
  peak: 0.24,        // front slip angle the steering assist holds at full lock (diet 2026-11-28: "turn more")
  frontGrip: 1.25,  // front bonus so full lock bites (diet: "tight turns", 2026-11-28 "turn more")
  rearGrip: 1.2,    // rear axle grip bonus off the handbrake: stable, mild understeer (diet 2026-11-11: "too slippery")
  tc: 0.85,         // traction control: drive force capped at this share of the driven axle's grip (no power spins)
  steerMax: 0.9,    // front wheel lock at a standstill (rad) (diet 2026-11-28: "turn more")
  steerFall: 1100,  // lock shrinks with speed: steerMax / (1 + u^2 / steerFall)
  slipLo: 12, slipHi: 28, // speed band (m/s) over which lateral grip fades (diet 2026-11-28: "less tire friction when turning at high speed")
  latLossF: 0.22, latLossR: 0.34, // lateral grip lost at slipHi: rear lets go a bit more, so fast turns slide instead of sticking
  steerRate: 5.0,   // input slew (/s) - weighty, not twitchy
  steerBack: 5.0,   // self-centring slew (/s)
  brake: 8.5,       // brake decel at full pedal (m/s^2, before grip limits)
  drag: 0.0011,     // aero drag per m (a = drag * u^2)
  roll: 0.16,       // rolling resistance (m/s^2)
  yawDamp: 0.9,     // tiny artificial yaw damping so slides stay catchable
  susW: 7.5, susZ: 0.42,          // body spring: natural freq (rad/s) and damping ratio (diet 2026-11-11: less exaggerated)
  pitchK: 0.0032, rollK: 0.0085,  // body angle per m/s^2 (braking dive ~1.5 deg on a hard stop)
  maxPitch: 0.045, maxRoll: 0.11,
};

export function makeCarPhys(api) {
  const { scene, puff, heightAt, nearestRoad, Sfx } = api;

  // ---------------- per-type chassis ----------------
  const chassis = new Map();
  function prof(c) {
    const key = c.model || c.type, cls = c.spec.cls || c.type; let k = chassis.get(key);
    if (k) return k;
    const S = c.spec, cart = !!S.cart;
    const m = cart ? 520 : 1400 * S.mass;
    const L = S.len * (cart ? 0.66 : 0.6), fw = S.bed ? 0.57 : cls === 'hatch' ? 0.6 : 0.54; // front weight share
    k = {
      m, L, a: L * (1 - fw), b: L * fw,
      h: cart ? 0.55 : 0.48 + Math.max(0, (S.h || 0.6) - 0.6) * 1.1,
      Iz: m * (S.len * S.len + S.wid * S.wid) / 12 * 1.05,
      mu: 1.12 + (S.grip || 6) * 0.015,
      fdrive: cls === 'hatch' ? 1 : cls === 'suv' ? 0.4 : 0, // share of drive on the front axle
      fmax: m * S.acc * (cls === 'suv' ? 0.85 : 1.0), // first-gear drive force (diet: less sluggish)
      top: S.top, track: S.wid * 0.84, cart,
    };
    chassis.set(key, k);
    return k;
  }

  // Pacejka-ish lateral curve: 0 -> 1 (peak) -> ~0.8 sliding
  const tyre = (al) => { const x = TUNE.B * al; return Math.sin(TUNE.C * Math.atan(x - TUNE.E * (x - Math.atan(x)))); };

  // ---------------- surface grip (looked up a few times a second) ----------------
  function surface(c, dt) {
    const s = c.ph;
    s.surfT -= dt;
    if (s.surfT > 0) return s.surf;
    s.surfT = 0.25;
    let g = 0.7; // grass / yards
    const r = nearestRoad && nearestRoad(c.x, c.z);
    if (r) { const e = api.edges()[r.k]; if (e && r.d < e.w / 2 + 0.6) g = e.t === 'dirt' ? 0.8 : e.t === 'path' || e.t === 'walk' ? 0.85 : 1.0; }
    return (s.surf = g);
  }

  // ---------------- the model ----------------
  function state(c) {
    if (!c.ph) c.ph = { r: 0, ax: 0, gear: 1, shift: 0, rpm: 0.2, steer: 0, surf: 1, surfT: 0, slipF: 0, slipR: 0, spin: 0, lock: false, tr: [null, null, null, null] };
    if (c.yr === undefined) c.yr = 0;
    return c.ph;
  }

  /** Player drive step. Same signature as game.js drive(): thr -1..1 (negative = brake, then reverse), steer -1..1 (+ = left). */
  function drive(c, thr, steer, hand, dt) {
    const K = prof(c), s = state(c);
    if (c.dead) { thr = 0; steer = 0; hand = true; }
    dt = Math.min(dt, 0.05);
    const mu = K.mu * TUNE.mu * surface(c, dt);
    let fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    let u = c.vx * fx + c.vz * fz, v = c.vx * fz - c.vz * fx; // v along left = (cos yaw, -sin yaw)
    let r = c.yr;

    // steering: slew toward the input, lock shrinks with speed
    const lockAt = TUNE.steerMax / (1 + (u * u) / TUNE.steerFall);
    let want = steer * lockAt;
    if (u > 4 && !hand) { // steering assist: don't steer the front tyres past their grip peak (they'd just scrub wide)
      const bf = Math.atan2(v + K.a * r, u), pk = TUNE.peak;
      want = Math.max(bf - pk, Math.min(bf + pk, want));
    }
    const rate = (Math.abs(steer) > 0.05 ? TUNE.steerRate : TUNE.steerBack) * TUNE.steerMax;
    s.steer += Math.max(-rate * dt, Math.min(rate * dt, want - s.steer));
    const d = s.steer;

    // gearbox (automatic). Upshift = short torque gap -> the body bobs forward
    const au = Math.abs(u), gTop = K.top * GEARS[s.gear - 1];
    if (s.shift > 0) s.shift -= dt;
    else if (thr > 0.1 && u > 0 && au > gTop * 0.96 && s.gear < 5) { s.gear++; s.shift = 0.12; }
    else if (s.gear > 1 && au < K.top * GEARS[s.gear - 2] * 0.72) s.gear--;
    const lo = s.gear > 1 ? K.top * GEARS[s.gear - 2] * 0.55 : 0;
    const rpmT = u < -0.5 ? Math.min(1, au / 13) : Math.max(thr > 0 ? 0.3 : 0.12, Math.min(1, (au - lo) / (gTop - lo + 1e-3)));
    s.rpm += (rpmT + (s.spin > 0.3 ? 0.25 : 0) - s.rpm) * Math.min(1, dt * 8);

    // pedals -> wanted axle forces (tyre frame, before grip limits)
    let drv = 0, brk = 0;
    if (thr > 0) {
      if (u < -1) brk = thr;
      else if (s.shift <= 0) {
        const g = s.gear - 1;
        drv = K.fmax * GEARF[g] * thr * Math.max(0, Math.min(1, (K.top - au) / (K.top * 0.12)));
      }
    } else if (thr < 0) {
      if (u > 1) brk = -thr;
      else drv = -K.fmax * 0.8 * -thr * Math.max(0, Math.min(1, (14 - au) / 3)); // reverse, ~14 m/s max (diet: faster)
    }
    if (c.fuel !== undefined && c.fuel <= 0) drv = 0;

    s.slipF = s.slipR = 0; s.spin = 0; s.lock = !!hand && au > 0.5;
    let steps = Math.max(1, Math.ceil(dt / SUB)); const h = dt / steps;
    let latF = 0, latR = 0;
    for (let i = 0; i < steps; i++) {
      // static loads with longitudinal weight transfer (smoothed accel)
      const tr = K.m * s.ax * K.h / K.L;
      const Wf = Math.max(K.m * G * 0.15, K.m * G * K.b / K.L - tr), Wr = Math.max(K.m * G * 0.15, K.m * G * K.a / K.L + tr);
      const Ff = mu * Wf * TUNE.frontGrip, Fr = mu * Wr * (s.lock ? 1 : TUNE.rearGrip);
      const cd = Math.cos(d), sd = Math.sin(d);
      // high speed: tyres hold less sideways, so fast turns slide/drift instead of sticking
      const hs = Math.max(0, Math.min(1, (Math.abs(u) - TUNE.slipLo) / (TUNE.slipHi - TUNE.slipLo))), hk = hs * hs * (3 - 2 * hs);
      const kyf = 1 - TUNE.latLossF * hk, kyr = 1 - TUNE.latLossR * hk;
      // contact patch velocities in each tyre's frame
      const fvx = u, fvy = v + K.a * r;
      const flo = fvx * cd + fvy * sd, fla = -fvx * sd + fvy * cd;
      const rlo = u, rla = v - K.b * r;
      const sgn = (x) => (x >= 0 ? 1 : -1);
      // front
      let Fxf = Math.sign(drv) * Math.min(Math.abs(drv * K.fdrive), Ff * TUNE.tc) - (brk ? sgn(flo) * Math.min(TUNE.brake * K.m * 0.62 * brk, Ff * 0.97) : 0);
      let Fyf = -Ff * kyf * tyre(Math.atan2(fla, Math.max(Math.abs(flo), 2.2)));
      // rear
      let Fxr, Fyr;
      const rearDrive = Math.sign(drv) * Math.min(Math.abs(drv * (1 - K.fdrive)), Fr * TUNE.tc);
      if (s.lock) {
        // locked rear: sliding friction straight against the contact patch's motion
        const sp = Math.hypot(rlo, rla) || 1, f = TUNE.slide * Fr * Math.min(1, sp / 0.6);
        Fxr = -f * rlo / sp; Fyr = -f * rla / sp;
        latR = Math.max(latR, Math.abs(rla));
      } else {
        Fxr = rearDrive - (brk ? sgn(rlo) * Math.min(TUNE.brake * K.m * 0.38 * brk, Fr * 0.97) : 0);
        Fyr = -Fr * kyr * tyre(Math.atan2(rla, Math.max(Math.abs(rlo), 2.2)));
      }
      // friction circles: wheelspin / braking eats cornering grip
      let q = Math.hypot(Fxf, Fyf); if (q > Ff) { if (Math.abs(drv * K.fdrive) > Ff * 0.9) s.spin = Math.max(s.spin, Math.abs(drv * K.fdrive) / Ff - 0.9); Fxf *= Ff / q; Fyf *= Ff / q; }
      q = Math.hypot(Fxr, Fyr); if (q > Fr) { if (!s.lock && Math.abs(rearDrive) > Fr * 0.9) s.spin = Math.max(s.spin, Math.abs(rearDrive) / Fr - 0.9); Fxr *= Fr / q; Fyr *= Fr / q; }
      latF = Math.max(latF, Math.abs(fla)); if (!s.lock) latR = Math.max(latR, Math.abs(rla));
      // body forces
      const bx = Fxf * cd - Fyf * sd + Fxr, by = Fxf * sd + Fyf * cd + Fyr;
      let ax = bx / K.m - Math.sign(u) * (TUNE.roll + TUNE.drag * u * u);
      if (Math.abs(u) < 0.4 && !drv) ax = -u / h * 0.5; // parked: friction holds it
      const ay = by / K.m;
      const mz = K.a * (Fxf * sd + Fyf * cd) - K.b * Fyr - r * K.Iz * TUNE.yawDamp;
      u += (ax + v * r) * h; v += (ay - u * r) * h; r += (mz / K.Iz) * h;
      // walking pace: blend toward pure rolling (no tyre jitter, tight parking turns)
      const w = Math.max(0, 1 - Math.abs(u) / 3.5);
      if (w > 0) { r += ((u * Math.tan(d)) / K.L - r) * Math.min(1, w * h * 14); v *= 1 - Math.min(1, w * h * 12); }
      c.yaw += r * h;
      s.ax += (ax - s.ax) * Math.min(1, h / 0.09);
    }
    fx = Math.sin(c.yaw); fz = Math.cos(c.yaw);
    c.vx = fx * u + fz * v; c.vz = fz * u - fx * v;
    c.yr = r; c.speed = u;
    c.steer = d / 0.5; // wheel visual (game.js turns the front wheels by steer * 0.5 rad)
    s.slipF = latF; s.slipR = latR;
    fx_effects(c, K, s, u, dt);
  }

  // ---------------- skid marks / smoke / screech ----------------
  const SKN = 720;
  const skidGeo = new THREE.PlaneGeometry(1, 1); skidGeo.rotateX(-Math.PI / 2);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x0c0b0a, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
  const skids = new THREE.InstancedMesh(skidGeo, skidMat, SKN);
  skids.count = 0; skids.frustumCulled = false; skids.userData.noLift = true; skids.renderOrder = 1;
  scene.add(skids);
  let skN = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
  function mark(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05) return;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    _p.set(mx, heightAt(mx, mz) + 0.035, mz); _q.setFromAxisAngle(_y, Math.atan2(x1 - x0, z1 - z0)); _s.set(0.24, 1, len + 0.04);
    skids.setMatrixAt(skN, _m.compose(_p, _q, _s)); skN = (skN + 1) % SKN;
    skids.count = Math.max(skids.count, skN === 0 ? SKN : skN); skids.instanceMatrix.needsUpdate = true;
  }
  let screech = 0, smokeT = 0;
  function fx_effects(c, K, s, u, dt) {
    const fwX = Math.sin(c.yaw), fwZ = Math.cos(c.yaw), lfX = fwZ, lfZ = -fwX;
    const rear = s.lock ? Math.min(1, Math.hypot(s.slipR, u) / 6) * (Math.abs(u) > 1.5 || s.slipR > 1.5 ? 1 : 0) : Math.max(0, Math.min(1, (s.slipR - 2.2) / 4));
    const front = Math.max(0, Math.min(1, (s.slipF - 2.6) / 4));
    const spin = Math.min(1, s.spin * 3) * (Math.abs(u) < 14 ? 1 : 0);
    const R = Math.max(rear, spin), F = front;
    // four contact points: 0/1 front L/R, 2/3 rear L/R
    for (let i = 0; i < 4; i++) {
      const on = i < 2 ? F > 0.15 : R > 0.15;
      const along = i < 2 ? K.a : -K.b, side = (i % 2 ? -1 : 1) * K.track / 2;
      const x = c.x + fwX * along + lfX * side, z = c.z + fwZ * along + lfZ * side;
      const t = s.tr[i];
      if (on) {
        if (t && Math.hypot(x - t[0], z - t[1]) > 0.45) { mark(t[0], t[1], x, z); t[0] = x; t[1] = z; }
        else if (!t) s.tr[i] = [x, z];
      } else s.tr[i] = null;
    }
    const lvl = Math.max(R, F * 0.8);
    smokeT -= dt;
    if (lvl > 0.35 && smokeT <= 0 && puff) {
      smokeT = 0.05 / lvl;
      const k = Math.random() < 0.5 ? 1 : -1;
      puff('smoke', c.x - fwX * K.b + lfX * k * K.track / 2, 0.25, c.z - fwZ * K.b + lfZ * k * K.track / 2, (Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6, 0.45 + lvl * 0.4, 0.9 + lvl * 0.6);
    }
    screech += ((s.surf >= 0.95 ? lvl : lvl * 0.25) - screech) * Math.min(1, dt * 10);
    if (Sfx.skid) Sfx.skid(c.dead ? 0 : screech);
  }

  // ---------------- body motion for every car (call once per car per frame from updateCars) ----------------
  // Soft underdamped spring on pitch / roll / heave driven by the car's measured acceleration.
  function body(c, u, dt) {
    if (dt <= 0) return;
    let b = c.sb;
    if (!b) b = c.sb = { p: 0, pv: 0, r: 0, rv: 0, h: 0, hv: 0, vx: c.vx, vz: c.vz };
    if (c.yr && c.driver !== 'player') { c.yaw += c.yr * dt; c.yr *= Math.exp(-dt * (Math.abs(c.speed) > 3 ? 2.2 : 4)); if (Math.abs(c.yr) < 0.02) c.yr = 0; } // spin-outs on AI / parked cars
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    let ax = ((c.vx - b.vx) * fx + (c.vz - b.vz) * fz) / dt, ay = ((c.vx - b.vx) * fz - (c.vz - b.vz) * fx) / dt;
    b.vx = c.vx; b.vz = c.vz;
    ax = Math.max(-25, Math.min(25, ax)); ay = Math.max(-25, Math.min(25, ay));
    const cart = !!c.spec.cart, k = cart ? 0.5 : c.spec.mass > 1.2 ? 1.2 : 1;
    const tp = Math.max(-TUNE.maxPitch, Math.min(TUNE.maxPitch, -ax * TUNE.pitchK * k)); // brake -> nose down (+x)
    const trr = Math.max(-TUNE.maxRoll, Math.min(TUNE.maxRoll, ay * TUNE.rollK * k));   // turn left -> lean right (+z)
    const w = TUNE.susW, z = TUNE.susZ, n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
    for (let i = 0; i < n; i++) {
      b.pv += (w * w * (tp - b.p) - 2 * z * w * b.pv) * h; b.p += b.pv * h;
      b.rv += (w * w * (trr - b.r) - 2 * z * w * b.rv) * h; b.r += b.rv * h;
      b.hv += (-w * w * 1.6 * b.h - 2 * z * w * b.hv) * h; b.h += b.hv * h;
    }
    u.body.rotation.x = b.p; u.body.rotation.z = b.r; u.body.position.y = b.h;
  }

  /** Off-centre collision impulse (velocity change dvx, dvz at world point px, pz) -> yaw kick + heave. */
  function spin(c, px, pz, dvx, dvz) {
    if (c.dead && c.driver !== 'player') return;
    const K = prof(c), m = K.m;
    const rx = px - c.x, rz = pz - c.z;
    // torque about y for an impulse J = m*dv at offset r: yaw grows toward +x from +z, so dyaw = (rz*Jx - rx*Jz) / Iz
    const dr = (rz * dvx - rx * dvz) * m / K.Iz * 0.8;
    c.yr = Math.max(-4, Math.min(4, (c.yr || 0) + dr));
    const sb = c.sb; if (sb) sb.hv += Math.min(0.6, Math.hypot(dvx, dvz) * 0.05);
  }

  let liveCar = null;
  /** Call when the player gets in / out so state starts clean. */
  function enter(c) { liveCar = c; const s = state(c); const K = prof(c); s.gear = 1; for (let i = 1; i < 5; i++) if (Math.abs(c.speed) > K.top * GEARS[i - 1] * 0.8) s.gear = i + 1; s.tr = [null, null, null, null]; }
  function exit() { liveCar = null; screech = 0; if (Sfx.skid) Sfx.skid(0); }

  /** Engine note level 0..1 from rpm (gears), for Sfx.engine. */
  const rev = (c) => (c.ph ? c.ph.rpm : Math.abs(c.speed) / c.spec.top);
  /** Camera heading: swings toward where the car is actually going while it slides. */
  function camHeading(c) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const u = c.vx * fx + c.vz * fz, v = c.vx * fz - c.vz * fx;
    if (Math.abs(u) < 4) return c.yaw;
    const beta = Math.atan2(v, Math.abs(u));
    return c.yaw + Math.max(-0.7, Math.min(0.7, beta)) * 0.6 * (u < 0 ? -1 : 1);
  }
  const dbg = { TUNE, drive, body, spin, prof, skids, edges: api.edges, nodes: api.nodes, state: (c) => c && c.ph };
  if (typeof window !== 'undefined') window.__CP = dbg;
  return { drive, body, spin, enter, exit, rev, camHeading, TUNE, skids };
}
