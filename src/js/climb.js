// Cat climbing (2026-11-26, diet: "as a cat i should be able to climb trees and jump onto roofs of houses").
//  - Trees: walk into a trunk (or hit one in mid-air) and keep pushing: Goobles grabs on. Up/down climbs, left/right
//    circles the trunk, Space leaps off (the double and triple jump still work after it). At the top he hops onto the
//    canopy perch (the tree collider's `top`, world.js) and can stand there, look around and jump to a roof.
//  - Walls: in mid-air against a wall, Space claws up it (two scrambles per jump), and pushing into a ledge that is
//    within paw reach pulls him up onto it: fences, sheds, porches, house roofs (rooftops.js gives the real roof height).
//  - Up high (roofs, fences, sheds, treetops) he drops onto all fours like a real cat (cat.userData.quad, goobles.js).
// All state lives on P (P.climb, P.mantle, P.scr, P.wallT); updatePlayer in game.js calls hold / afterMove / wallJump.

const REACH = 1.4;           // m above his feet a ledge can be and still be grabbed
const CLIMB_UP = 2.4, CLIMB_FAST = 3.4, ORBIT = 1.8;   // m/s

export function makeClimb({ P, cat, TER, Sfx }) {
  const intent = (mx, mz, camYaw) => {
    const len = Math.hypot(mx, mz); if (len < 0.1) return null;
    const fx = Math.sin(camYaw + Math.PI), fz = Math.cos(camYaw + Math.PI);
    const dx = fx * mz + fz * mx, dz = fz * mz - fx * mx, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  };
  function stop() { P.climb = null; cat.userData.climb = null; }
  function mantle(x1, y1, z1, dur = 0.26) {
    P.mantle = { k: 0, dur, x0: P.x, y0: P.y, z0: P.z, x1, y1, z1 };
    P.vx = P.vz = P.vy = 0; Sfx.blip(250);
  }
  function grab(c) {
    P.climb = { c, a: Math.atan2(P.z - c.cz, P.x - c.cx) };
    P.vx = P.vz = P.vy = 0; P.jumps = 0; P.climbT = 0; P.flip = 0; cat.userData.body.rotation.x = 0;
    Sfx.blip(200);
  }

  /** While climbing or pulling up onto a ledge this moves the cat and returns true (updatePlayer then returns). */
  function hold(dt, mx, mz, jump, sprint) {
    const M = P.mantle;
    if (M) {
      M.k += dt / M.dur;
      const k = Math.min(1, M.k), up = Math.min(1, k * 1.7), fw = Math.max(0, (k - 0.35) / 0.65);
      P.y = M.y0 + (M.y1 - M.y0) * (1 - (1 - up) * (1 - up));
      P.x = M.x0 + (M.x1 - M.x0) * fw; P.z = M.z0 + (M.z1 - M.z0) * fw;
      P.fl = P.y; cat.userData.air = true; cat.userData.climb = null; cat.userData.quad = true;   // pulls himself up on all fours
      if (k >= 1) { P.mantle = null; P.y = M.y1; P.vy = 0; P.jumps = 0; P.scr = 0; P.perch = M.perch; }
      return true;
    }
    if (P.perch) {   // just hopped onto a treetop: stay put until the stick is let go, so holding up doesn't walk him off
      if (Math.hypot(mx, mz) > 0.1 && !jump) { P.vx = P.vz = 0; cat.userData.air = false; return true; }
      P.perch = false;
    }
    const C = P.climb;
    if (!C) return false;
    const c = C.c, R = c.r + 0.24;
    if (P.car || P.swim || Math.hypot(P.x - c.cx, P.z - c.cz) > R + 0.6) { stop(); return false; }   // teleported, respawned, in a car
    if (jump) {   // leap off, away from the trunk
      const nx = Math.cos(C.a), nz = Math.sin(C.a);
      stop(); P.vx = nx * 3.8; P.vz = nz * 3.8; P.vy = 5.4; P.jumps = 1; P.yaw = Math.atan2(nx, nz); Sfx.blip(330);
      return false;
    }
    const v = mz * (sprint ? CLIMB_FAST : CLIMB_UP);
    P.y += v * dt;
    C.a += mx * ORBIT / R * dt;
    P.x = c.cx + Math.cos(C.a) * R; P.z = c.cz + Math.sin(C.a) * R;
    P.yaw = Math.atan2(c.cx - P.x, c.cz - P.z);
    P.vx = P.vz = P.vy = 0; P.fl = P.y;
    const top = c.top ?? c.h ?? 5;
    cat.userData.air = false; cat.userData.climb = Math.abs(v) + Math.abs(mx) * 1.2; cat.userData.quad = false;
    if (P.y >= top - 0.7) { stop(); mantle(c.cx, top, c.cz, 0.3); P.mantle.perch = true; }      // over the top onto the perch
    else if (P.y <= 0 && v <= 0) { P.y = 0; stop(); }                     // back on the ground
    return true;
  }

  /** After the on-foot collide: start a climb on a tree, a pull-up onto a ledge, remember wall contact for scrambles. */
  function afterMove(q, mx, mz, camYaw, dt, inside) {
    // up on a roof, a fence, a shed or a treetop (a collider top 0.9 m+, not a deck or porch floor) he goes on all fours
    cat.userData.quad = !inside && !P.swim && (P.fl || 0) >= 0.9 && !TER.floorHit;
    if (inside) return;
    P.wallT = (P.wallT || 0) - dt;
    const air = P.y > (P.fl || 0) + 0.01;
    if (!air) P.scr = 0;
    const c = q.hc;
    if (!q.hit || !c || P.swim || P.climb || P.mantle) { P.climbT = 0; return; }
    const I = intent(mx, mz, camYaw);
    const push = I ? -(I[0] * q.nx + I[1] * q.nz) : 0;     // n points from the collider to the cat
    if (c.tree && c.top) {
      if (push > 0.5) { P.climbT = (P.climbT || 0) + dt; if (air || P.climbT > 0.18) grab(c); } else P.climbT = 0;
      return;
    }
    P.climbT = 0;
    if (c.water) return;
    P.wallT = 0.2;
    if (!air || push < 0.3) return;
    for (const d of [0.36, 0.6]) {
      const px = P.x - q.nx * d, pz = P.z - q.nz * d, t = TER.floorAt(px, pz, P.y + REACH - 0.5);
      if (t > P.y + 0.15 && t <= P.y + REACH) { mantle(px, t, pz); return; }
    }
  }

  /** Space in mid-air while touching a wall: claw up it (twice per jump). */
  function wallJump() {
    if (!(P.wallT > 0) || (P.scr || 0) >= 2) return false;
    P.scr = (P.scr || 0) + 1; P.vy = 6.4; P.flip = 0; cat.userData.body.rotation.x = 0;
    Sfx.blip(380 + P.scr * 60);
    return true;
  }
  return { hold, afterMove, wallJump, stop };
}
