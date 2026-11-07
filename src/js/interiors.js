// Enterable buildings (PS2-style door-to-room) for Maple Grove: Off Leash. Owned by the interiors thread.
// Each room (src/js/rooms.js, or registered with registerRoom) is built lazily the first time it is entered and placed
// far off the map (x = 3000 + k*80, z = 3000). While inside, the camera renders only layer 1 (the room, the cat and
// the lights), the outdoor light pool is handed to the room's lights, sun/moon/fog are neutralised, and the cat and the
// camera are not lifted onto the terrain. Wired into game.js by tools/interiors-hooks.mjs.
//
// API (module exports, the object makeInteriors returns, and window.__INT):
//   registerRoom(id, room, door?)  room = { name, build(ctx) } (rooms.js contract). door (world coords, yaw = the way the
//                                  opening faces, outward) is either { x, z, yaw } or an array of entry points
//                                  [{ x, z, yaw, kind: 'door' | 'window', inside?: { x, z, yaw } (room-local spot) }].
//                                  Windows show "Climb in (<name>)", hop + fade, and land the cat at `inside` (default: on
//                                  the room's front wall, offset like the window is from the door). Leaving: E at that spot.
//                                  Without a door the room is code-only.
//   enter(id, opts?)               opts { spawn?: {x,z,yaw} local, locked?: bool, returnTo?: {x,z,yaw} world, instant?: bool }
//   exit(opts?)                    opts { to?: {x,z,yaw} world, instant?: bool }
//   lock(id) / unlock(id)          a locked room's exit circle (and E at the exit) does nothing
//   current() -> id | null         on(event, fn) -> unsubscribe; events 'enter' (id), 'exit' (id), 'interact' (id, spotId)
//                                  (an 'interact' listener that returns true handles the hotspot: no default nap/flavour toast)
//   state                          snapshot for tests
import * as THREE from 'three';
import * as TER from './terrain.js';
import { setText, setStyle } from './dom.js';

// ---------------- module-level registry (usable before the game creates the instance) ----------------
const registry = new Map();   // id -> { room, entries: [{x,z,yaw,kind,inside}], builtin }
const locks = new Set();
const listeners = { enter: [], exit: [], interact: [] };
let inst = null;

export function registerRoom(id, room, door) {
  if (!id || !room || typeof room.build !== 'function') { console.warn('[interiors] registerRoom: bad room', id); return false; }
  registry.set(id, { room, entries: normEntries(door), builtin: false });
  if (inst) inst._addDoor(id);
  return true;
}
function normEntries(door) {
  if (!door) return [];
  return (Array.isArray(door) ? door : [door]).filter((e) => e && Number.isFinite(+e.x) && Number.isFinite(+e.z)).map((e) => ({
    x: +e.x, z: +e.z, yaw: +e.yaw || 0, kind: e.kind === 'window' ? 'window' : 'door',
    inside: e.inside ? { x: +e.inside.x || 0, z: +e.inside.z || 0, yaw: e.inside.yaw === undefined ? undefined : +e.inside.yaw } : null,
  }));
}
export function enter(id, opts) { return inst ? inst.enter(id, opts) : false; }
export function exit(opts) { return inst ? inst.exit(opts) : false; }
export function lock(id) { locks.add(id); }
export function unlock(id) { locks.delete(id); }
export function current() { return inst ? inst.current() : null; }
export function on(ev, fn) {
  const l = listeners[ev]; if (!l || typeof fn !== 'function') return () => {};
  l.push(fn); return () => { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
}
function emit(ev, ...a) { let used = false; for (const f of listeners[ev].slice()) { try { if (f(...a) === true) used = true; } catch (e) { console.error('[interiors] listener', e); } } return used; }   // a listener returning true consumes the event

// ---------------- the five buildings in world.js ----------------
// Door = centre of the door face on the wall, yaw = outward facing (0 = +z). Windows = ground-floor windows only (sill
// 0.7-1.6 m, a hop for a cat); upper floors are skipped. All derived from world.js (offsets from places.* when present):
//   quik:   frame(30,-26,0): door face at local (1,-6.47); storeWin faces at local x -2 and 6.5 on the same front wall
//           (x -5 is blocked by the ice chest). places.quik = (cx-3, cz-3.5)
//   diner:  frame(36,17,PI): door face at local (6.5,3.23); storeWin row at local x -6 + k*2.2 (y 2.1): uses -3.8 and 0.6
//   church: frame(-74,-24,0): steeple door at local (0, d/2+2.93); tall stained-glass windows on both long sides
//           (x = +-(w/2+0.03), y 2.9): uses east z=2 and west z=-1.5. places.church = (cx, cz+d/2+4)
//   nana:   home(-106,16,PI/2) farm house: front door at local (0, d/2), ground-floor windows at local x +-2.6 (y 1.7);
//           places.nana = door + 1.6 out. Upper-floor windows (y 4.2) are not entries.
//   rv:     makeRV at (lx-1, lz+1) rotated PI/2+0.1: side door at RV-local (1.27,-1.8), side window at (1.26, 1.5);
//           places.rv = (lx+1.8, lz+1.5)
// `inside` = room-local landing spot by the matching wall in rooms.js (nudged off furniture at runtime).
function builtinEntries(places) {
  const P = places || {};
  const E = {};
  const D = (x, z, yaw) => ({ x, z, yaw, kind: 'door', inside: null });
  const Wn = (x, z, yaw, ix, iz, iyaw = 0) => ({ x, z, yaw, kind: 'window', inside: { x: ix, z: iz, yaw: iyaw } });
  const q = P.quik || { x: 27, z: -29.5 };
  E.quik = [D(q.x + 4, q.z - 2.97, 0), Wn(q.x + 1, q.z - 2.97, 0, -1.25, 3.2), Wn(q.x + 9.5, q.z - 2.97, 0, 4.0, 3.2)];
  E.diner = [D(29.5, 13.77, Math.PI), Wn(39.8, 13.77, Math.PI, -3.0, 3.2), Wn(35.4, 13.77, Math.PI, 0.5, 3.2)];
  const c = P.church || { x: -74, z: -12.5 };
  E.church = [D(c.x, c.z - 1.07, 0), Wn(c.x + 4.53, c.z - 9.5, Math.PI / 2, 3.8, 2.1, Math.PI / 2), Wn(c.x - 4.53, c.z - 13, -Math.PI / 2, -3.8, -1.6, -Math.PI / 2)];
  const ny = P.nana ? P.nana.yaw ?? Math.PI / 2 : Math.PI / 2;
  const nd = P.nana ? { x: P.nana.x - Math.sin(ny) * 1.6, z: P.nana.z - Math.cos(ny) * 1.6 } : { x: -102.22, z: 16 };
  const lat = (k) => ({ x: nd.x + Math.cos(ny) * k, z: nd.z - Math.sin(ny) * k });   // along the facade (house-local +x)
  E.nana = [D(nd.x, nd.z, ny), Wn(lat(-2.6).x, lat(-2.6).z, ny, -2.6, 3.2), Wn(lat(2.6).x, lat(2.6).z, ny, 2.6, 3.2)];
  const r = P.rv || { x: -102.2, z: 41.5 };
  E.rv = [D(r.x - 4.72, r.z - 1.58, -Math.PI + 0.1), Wn(r.x - 1.43, r.z - 1.9, -Math.PI + 0.1, 0.45, 1.7)];
  return E;
}
const FLAVOR = {   // `${room}:${spot}` first, then `${spot}`
  'rv:bowl': ['Crunch crunch. Kibble, the breakfast of tactical cats.'],
  'quik:counter': ['The clerk squints at your plate carrier. "We don\'t sell to cats." Pause. "...Do you have cash?"'],
  'quik:slushie': ['BRAIN FREEZE. Totally worth it.'],
  'diner:booth': ['You knead the vinyl booth seat. Rosie pretends not to notice.'],
  'diner:counter': ['Rosie slides over a saucer of cream. "The usual, hon."'],
  'diner:jukebox': ['The jukebox plays a doo-wop number about a lost cat. Too real.'],
  'nana:couch': ['Nana: "Sit, sit. You look thin under all that armor, sweetie."'],
  'nana:casserole': ["Tuna noodle casserole. Still warm. Don't tell Nana."],
  'nana:catbed': ["A quick cat nap on Nana's cushion. Purrfect."],
  'church:pew': ['You sit quietly. The old steeple creaks overhead.'],
  'church:piano': ['Plink. Plonk. You walk across the keys. A masterpiece.'],
  'church:pulpit': ['"CH__CH: WHAT\'S MISSING? U R." Deep stuff.'],
  'church:offering': ["You leave a dead moth in the offering plate. It's the thought that counts."],
  counter: ['"Can I help you?" The clerk looks over the counter. Then down. Way down.'],
  booth: ['You curl up in the booth. Nobody asks you to leave.'],
};
const ROOM_GAP = 80, ROOM_X = 3000, ROOM_Z = 3000;
const DOOR_R = 1.6, WIN_R = 1.2, FADE = 0.35;

export function makeInteriors(ctx) {
  const { scene, camera, G, P, cat } = ctx;
  const S = {
    inside: false, id: null, room: null, fading: null, k: 0, door: null, ret: null, outPos: null, exitArmed: false,
    near: null, spot: null, atExit: false, swaps: 0, errors: [], entry: null, win: null,
  };
  const rooms = {};           // id -> { built, broken, origin:{x,z}, cols:[world], ... }
  const entries = [];        // { id, i, kind, base:{x,z,yaw}, inside, g, mesh, cur:{x,z,yaw,tx,tz,ok} }
  let slot = 0;

  // ---------------- built-in rooms (rooms.js, loaded lazily so a broken rooms.js cannot take the game down) ----------------
  const D0 = builtinEntries(ctx.places);
  let roomsMod = null, roomsErr = null;
  const roomsReady = import('./rooms.js').then((m) => {
    roomsMod = m;
    const R = m.ROOMS || {};
    for (const id of ['rv', 'quik', 'diner', 'nana', 'church']) {
      if (registry.has(id) && !registry.get(id).builtin) continue;   // a registered override wins
      if (!R[id] || typeof R[id].build !== 'function') { console.warn(`[interiors] rooms.js has no room "${id}"; door skipped`); continue; }
      registry.set(id, { room: R[id], entries: D0[id], builtin: true });
      addDoor(id);
    }
  }).catch((e) => { roomsErr = e; S.errors.push(String(e)); console.error('[interiors] rooms.js failed to load; no interiors', e); });

  // ---------------- door markers ----------------
  const ringGeo = new THREE.RingGeometry(0.42, 0.62, 24); ringGeo.rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(0.42, 24); discGeo.rotateX(-Math.PI / 2);
  const arrowGeo = new THREE.ConeGeometry(0.16, 0.3, 4); arrowGeo.rotateX(Math.PI);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc84a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85 });
  function marker(layer, win) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = 0.08; g.add(ring);
    const disc = new THREE.Mesh(discGeo, discMat); disc.position.y = 0.07; g.add(disc);
    if (win) { ring.scale.setScalar(0.7); disc.scale.setScalar(0.7); }
    const ar = new THREE.Mesh(arrowGeo, arrowMat); ar.position.y = win ? 1.9 : 1.35; if (win) ar.scale.setScalar(0.75); g.add(ar);
    g.userData.arrow = ar; g.userData.arrowY = ar.position.y; g.userData.intDoor = true;
    if (layer) g.traverse((o) => o.layers.set(layer));
    return g;
  }
  const out = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
  function addDoor(id) {   // (re)create the outdoor entry points of one room
    for (let k = entries.length - 1; k >= 0; k--) if (entries[k].id === id) { scene.remove(entries[k].mesh); entries.splice(k, 1); }
    const r = registry.get(id); if (!r || !r.entries.length) return;
    // the building's movable group: probe 1.5 m behind the door (or each entry, when there is no door)
    const groupOf = (b) => { const [ox, oz] = out(b.yaw); try { return TER.groupAt(b.x - ox * 1.5, b.z - oz * 1.5) || 0; } catch (e) { return 0; } };
    const door = r.entries.find((e) => e.kind === 'door'), gDoor = door ? groupOf(door) : 0;
    r.entries.forEach((b, i) => {
      const mesh = marker(0, b.kind === 'window'); scene.add(mesh);
      const e = { id, i, kind: b.kind, base: b, inside: b.inside, g: door ? gDoor : groupOf(b), mesh, cur: { x: b.x, z: b.z, yaw: b.yaw, tx: b.x, tz: b.z, ok: true } };
      entries.push(e); placeEntry(e);
    });
  }
  // follow the building when it is moved / rotated / scaled / hidden in the world editor
  function placeEntry(e) {
    const b = e.base, c = e.cur;
    let x = b.x, z = b.z, yaw = b.yaw, ok = true;
    const Gp = e.g ? TER.groups[e.g] : null;
    if (Gp) {
      const k = Gp.s || 1, cs = Math.cos(Gp.r), sn = Math.sin(Gp.r), rx = (b.x - Gp.anchor.x) * k, rz = (b.z - Gp.anchor.z) * k;
      x = Gp.anchor.x + rx * cs + rz * sn + Gp.dx; z = Gp.anchor.z - rx * sn + rz * cs + Gp.dz; yaw = b.yaw + Gp.r;
      if (Gp.hide) ok = false;
    }
    if (rooms[e.id] && rooms[e.id].broken) ok = false;
    const off = e.kind === 'window' ? 0.7 : 0.9;
    c.x = x; c.z = z; c.yaw = yaw; c.ok = ok;
    c.tx = x + Math.sin(yaw) * off; c.tz = z + Math.cos(yaw) * off;
    e.mesh.position.set(c.tx, 0, c.tz); e.mesh.visible = ok;
  }
  const doorOf = (id) => entries.find((e) => e.id === id && e.kind === 'door') || entries.find((e) => e.id === id) || null;

  // ---------------- room building ----------------
  function buildRoom(id) {
    if (rooms[id] && rooms[id].built) return rooms[id];
    if (rooms[id] && rooms[id].broken) return null;
    const reg = registry.get(id);
    if (!reg) return null;
    const rec = rooms[id] = { id, name: reg.room.name || id, built: false, broken: false };
    try {
      const out = reg.room.build({ THREE, M: ctx.WM, T: ctx.T });
      if (!out || !out.group || !out.group.isObject3D) throw new Error('build() returned no group');
      const size = Array.isArray(out.size) && out.size.length >= 2 ? [+out.size[0] || 6, +out.size[1] || 6] : [6, 6];
      const origin = { x: ROOM_X + slot * ROOM_GAP, z: ROOM_Z }; slot++;
      const group = out.group;
      group.position.set(origin.x, 0, origin.z); group.rotation.set(0, 0, 0);
      group.userData.noLift = true; group.visible = false;
      group.traverse((o) => { o.layers.set(1); o.userData.noLift = true; });
      // exit ring inside
      const exitM = marker(1); exitM.userData.arrow.visible = false; group.add(exitM);
      const ex = out.exit || { x: 0, z: size[1] / 2 - 0.4, r: 0.6 };
      exitM.position.set(ex.x, 0, ex.z); exitM.scale.setScalar(Math.max(0.6, (ex.r || 0.6) / 0.62));
      scene.add(group);
      const cols = (out.cols || []).filter((c) => c && (c.kind === 'box' || c.kind === undefined)).map((c) => {
        const r = c.rot || 0;
        return { cx: origin.x + (+c.cx || 0), cz: origin.z + (+c.cz || 0), hw: Math.abs(+c.w || 0) / 2, hd: Math.abs(+c.d || 0) / 2, c: Math.cos(r), s: Math.sin(r), h: c.h ?? 5 };
      });
      Object.assign(rec, {
        built: true, out, group, origin, size, cols, exitM,
        spawn: out.spawn || { x: 0, z: size[1] / 2 - 1.2, yaw: 0 },
        exit: { x: +ex.x || 0, z: +ex.z || 0, r: ex.r || 0.6 },
        lights: (out.lights || []).slice(0, (ctx.pool || []).length || 10),
        cam: { maxDist: out.cam?.maxDist ?? 2.4, height: out.cam?.height ?? 2.4 },
        spots: (out.interact || []).map((h) => ({ id: h.id, x: +h.x || 0, z: +h.z || 0, r: h.r || 1.1, label: h.label || h.id, onUse: h.onUse })),
        name: out.name || reg.room.name || id,
      });
      return rec;
    } catch (e) {
      console.error(`[interiors] room "${id}" failed to build; its door is closed`, e);
      rec.broken = true; S.errors.push(`${id}: ${e && e.message}`);
      for (const e of entries) if (e.id === id) placeEntry(e);
      return null;
    }
  }

  // ---------------- collisions inside ----------------
  function roomCollide(x, z, r, y = 0) {
    const R = S.room; let hit = false, nx = 0, nz = 0;
    if (!R) return { x, z, hit, nx, nz };
    if (Math.abs(x - R.origin.x) > 60 || Math.abs(z - R.origin.z) > 60) return { x, z, hit, nx, nz };   // teleported out (update() drops indoor mode)
    for (let it = 0; it < 2; it++) for (const c of R.cols) {
      if (y > c.h) continue;
      const dx = x - c.cx, dz = z - c.cz;
      // local frame of the box (rot about y, three.js convention: local x -> (cos, -sin))
      let lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
      if (Math.abs(lx) > c.hw + r || Math.abs(lz) > c.hd + r) continue;
      const qx = Math.max(-c.hw, Math.min(lx, c.hw)), qz = Math.max(-c.hd, Math.min(lz, c.hd));
      const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
      if (d > r) continue;
      let nlx, nlz;
      if (d < 1e-6) {
        const o = [[c.hw - lx, 1, 0], [lx + c.hw, -1, 0], [c.hd - lz, 0, 1], [lz + c.hd, 0, -1]].sort((a, b) => a[0] - b[0]);
        [, nlx, nlz] = o[0];
        if (nlx) lx = nlx * (c.hw + r); else lz = nlz * (c.hd + r);
      } else { lx = qx + ex / d * r; lz = qz + ez / d * r; nlx = ex / d; nlz = ez / d; }
      x = c.cx + lx * c.c + lz * c.s; z = c.cz - lx * c.s + lz * c.c;
      nx = nlx * c.c + nlz * c.s; nz = -nlx * c.s + nlz * c.c; hit = true;
    }
    // stay inside the room
    const hw = R.size[0] / 2 - r, hd = R.size[1] / 2 - r, ox = R.origin.x, oz = R.origin.z;
    if (x < ox - hw) { x = ox - hw; hit = true; nx = 1; nz = 0; } else if (x > ox + hw) { x = ox + hw; hit = true; nx = -1; nz = 0; }
    if (z < oz - hd) { z = oz - hd; hit = true; nx = 0; nz = 1; } else if (z > oz + hd) { z = oz + hd; hit = true; nx = 0; nz = -1; }
    return { x, z, hit, nx, nz };
  }
  function roomBlocked(x, y, z) {
    const R = S.room; if (!R) return false;
    const m = 0.12;
    if (Math.abs(x - R.origin.x) > R.size[0] / 2 - m || Math.abs(z - R.origin.z) > R.size[1] / 2 - m) return true;
    if (y > R.cam.height + 0.2) return true;
    for (const c of R.cols) {
      if (y > c.h) continue;
      const dx = x - c.cx, dz = z - c.cz;
      if (Math.abs(dx * c.c - dz * c.s) < c.hw && Math.abs(dx * c.s + dz * c.c) < c.hd) return true;
    }
    return false;
  }

  // ---------------- fade overlay ----------------
  const fadeEl = document.createElement('div');
  fadeEl.id = 'intfade';
  fadeEl.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:40;';
  document.body.appendChild(fadeEl);
  const nowS = () => performance.now() / 1000;

  // ---------------- state switches ----------------
  const lightSaved = new Map();
  function setIndoorRender(on) {
    if (on) {
      camera.layers.set(1);
      scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
      cat.traverse((o) => o.layers.enable(1));
      S.camNoLift = !!camera.userData.noLift; camera.userData.noLift = true;
      S.catNoLift = !!cat.userData.noLift; cat.userData.noLift = true;
      for (const l of ctx.pool || []) { lightSaved.set(l, { d: l.distance, nl: l.userData.noLift }); l.userData.noLift = true; l.userData.src = null; l.intensity = 0; }
    } else {
      camera.layers.set(0);
      camera.userData.noLift = S.camNoLift || false;
      cat.userData.noLift = S.catNoLift || false;
      for (const l of ctx.pool || []) {
        const s = lightSaved.get(l); if (s) { l.distance = s.d; if (s.nl) l.userData.noLift = s.nl; else delete l.userData.noLift; }
        l.intensity = 0; l.userData.src = null;
      }
      lightSaved.clear();
    }
  }
  function snapCam(yaw, pitch, dist) {
    ctx.setCam(yaw, pitch);
    const cp = Math.cos(pitch);
    ctx.camPos.set(P.x + Math.sin(yaw) * cp * dist, 0.65 + Math.sin(pitch) * dist, P.z + Math.cos(yaw) * cp * dist);
  }
  function entryExitPoint(e) {
    if (!e) return null;
    placeEntry(e);
    const c = e.cur, ox = Math.sin(c.yaw), oz = Math.cos(c.yaw), d = e.kind === 'window' ? 1.5 : 2.7;
    return { x: c.x + ox * d, z: c.z + oz * d, yaw: c.yaw };   // just past the marker, facing away from the building
  }
  const doorExitPoint = (id) => entryExitPoint(doorOf(id));
  // free floor spot (cat radius + margin) closest to the wanted local spot
  function freeSpot(R, lx, lz) {
    const m = 0.35, hw = R.size[0] / 2 - m, hd = R.size[1] / 2 - m;
    const free = (x, z) => {
      if (Math.abs(x) > hw || Math.abs(z) > hd) return false;
      for (const c of R.cols) {
        if (c.h < 0.15) continue;
        const dx = x + R.origin.x - c.cx, dz = z + R.origin.z - c.cz;
        const lx2 = dx * c.c - dz * c.s, lz2 = dx * c.s + dz * c.c;
        if (Math.abs(lx2) < c.hw + m && Math.abs(lz2) < c.hd + m) return false;
      }
      return true;
    };
    lx = Math.max(-hw, Math.min(hw, lx)); lz = Math.max(-hd, Math.min(hd, lz));
    if (free(lx, lz)) return [lx, lz];
    for (let rr = 0.25; rr <= 4; rr += 0.25) for (let a = 0; a < 16; a++) {
      const x = lx + Math.cos(a / 16 * Math.PI * 2) * rr, z = lz + Math.sin(a / 16 * Math.PI * 2) * rr;
      if (free(x, z)) return [x, z];
    }
    return [R.spawn.x, R.spawn.z];
  }
  // where a window lands the cat inside (room-local), and the 'climb out' spots of the current room
  function windowSpot(e, R) {
    let x, z, yaw;
    if (e.inside) { x = e.inside.x; z = e.inside.z; yaw = e.inside.yaw; }
    else {
      const d = doorOf(e.id);
      const lat = d && d !== e ? (e.base.x - d.base.x) * Math.cos(d.base.yaw) - (e.base.z - d.base.z) * Math.sin(d.base.yaw) : 1.5;
      x = R.exit.x + lat; z = R.size[1] / 2 - 0.8; yaw = 0;
    }
    [x, z] = freeSpot(R, x, z);
    if (yaw === undefined || !Number.isFinite(yaw)) yaw = Math.atan2(x, z);   // face the middle of the room
    return { x, z, yaw };
  }
  function roomWindows(R, id) {
    for (const w of R.windows || []) R.group.remove(w.mesh);
    R.windows = entries.filter((e) => e.id === id && e.kind === 'window' && e.cur.ok).map((e) => {
      const sp = windowSpot(e, R), mesh = marker(1, true);
      mesh.userData.arrow.visible = false; mesh.position.set(sp.x, 0, sp.z); R.group.add(mesh);
      return { entry: e, ...sp, mesh };
    });
  }
  function swapIn(id, opts) {
    const R = buildRoom(id);
    if (!R) { ctx.toast && ctx.toast("It's locked.", 2); return false; }
    if (S.inside) swapOut(null);   // room to room
    S.outPos = { x: P.x, z: P.z, yaw: P.yaw };
    S.ret = opts.returnTo ? { x: +opts.returnTo.x, z: +opts.returnTo.z, yaw: +opts.returnTo.yaw || 0 } : null;
    if (opts.locked) locks.add(id);
    S.inside = true; S.id = id; S.room = R; R.group.visible = true;
    S.entry = opts._entry || null;
    roomWindows(R, id);
    const win = S.entry && S.entry.kind === 'window' ? R.windows.find((w) => w.entry === S.entry) : null;
    const sp = opts.spawn || win || R.spawn;
    P.x = R.origin.x + (+sp.x || 0); P.z = R.origin.z + (+sp.z || 0); P.y = 0; P.vy = 0; P.vx = P.vz = 0; P.jumps = 0; P.lock = 0.5;
    const q = roomCollide(P.x, P.z, 0.22); P.x = q.x; P.z = q.z;
    const yaw = +sp.yaw || 0;          // rooms: yaw 0 faces -z; the cat: yaw 0 faces +z
    P.yaw = yaw + Math.PI;
    setIndoorRender(true);
    snapCam(yaw, win ? 0.75 : 0.32, Math.min(R.cam.maxDist, 2.2));   // by a wall: look down over the cat
    clampCam(ctx.camPos);
    S.exitArmed = false; S.spawnPt = { x: P.x, z: P.z };   // walk a little way in before the exit circle / prompt wakes up
    S.swaps++;
    emit('enter', id);
    return true;
  }
  function swapOut(to) {
    const id = S.id, R = S.room;
    if (!S.inside) return;
    S.inside = false; S.id = null; S.room = null; if (R) R.group.visible = false;
    setIndoorRender(false);
    if (to !== false) {
      const t = to || S.ret || doorExitPoint(id) || S.outPos || { x: ctx.places.spawn.x, z: ctx.places.spawn.z, yaw: 0 };
      P.x = t.x; P.z = t.z; P.y = 0; P.vy = t.hop ? 2.8 : 0; P.vx = P.vz = 0; P.lock = 0.5;
      if (ctx.collide) { const q = ctx.collide(P.x, P.z, 0.22, 0); P.x = q.x; P.z = q.z; }
      P.yaw = t.yaw || 0;
      snapCam(P.yaw + Math.PI, 0.28, 2.7);
    }
    S.ret = null; S.entry = null; S.swaps++;
    emit('exit', id);
  }
  // fade -> swap -> fade
  function startFade(fn) {
    if (S.fading) return false;
    S.fading = { t0: nowS(), fn, done: false, hold: { x: P.x, z: P.z } };
    return true;
  }

  // ---------------- API ----------------
  function apiEnter(id, opts = {}) {
    if (!registry.has(id)) { console.warn('[interiors] unknown room', id); return false; }
    if (P.car) { if (!opts.force && !opts.instant) return false; try { ctx.exitCar && ctx.exitCar(); } catch (e) { /* ignore */ } if (P.car) return false; }
    if (opts._entry && opts._entry.kind === 'window') climb();
    if (opts.instant) return swapIn(id, opts);
    return startFade(() => swapIn(id, opts));
  }
  function apiExit(opts = {}) {
    if (!S.inside) return false;
    let to = opts.to ? { x: +opts.to.x, z: +opts.to.z, yaw: +opts.to.yaw || 0 } : null;
    if (!to && opts._window) { to = entryExitPoint(opts._window.entry); to.hop = true; climb(); }
    if (opts.instant) { swapOut(to); return true; }
    return startFade(() => swapOut(to));
  }

  // a hop + scramble for windows (the fade covers the rest)
  function climb() {
    if (P.y < 0.05) P.vy = Math.max(P.vy || 0, 4.2);
    try { ctx.Sfx && ctx.Sfx.swing && ctx.Sfx.swing(); setTimeout(() => { try { ctx.Sfx.blip && ctx.Sfx.blip(240); } catch (e) { /* ignore */ } }, 160); } catch (e) { /* ignore */ }
  }
  // nearest active entry point (outdoors, on foot), losing to a closer NPC the game would talk to
  function activeDoor() {
    if (S.inside || S.fading || P.car || G.dialog || G.paused || P.y > 0.6) return null;
    let best = null, bd = 1e9;
    for (const e of entries) {
      if (!e.cur.ok) continue;
      const dd = Math.hypot(P.x - e.cur.tx, P.z - e.cur.tz);
      if (dd < (e.kind === 'window' ? WIN_R : DOOR_R) && dd < bd) { bd = dd; best = e; }
    }
    if (!best) return null;
    try {
      const npc = ctx.nearNpc && !(ctx.mission && ctx.mission()) ? ctx.nearNpc() : null;
      if (npc) {
        const p = ctx.NPC && ctx.NPC[npc], m = ctx.giverMarks && ctx.giverMarks[npc];
        const dn = Math.min(p ? Math.hypot(p.x - P.x, p.z - P.z) : 1e9, m && m.visible ? Math.hypot(m.position.x - P.x, m.position.z - P.z) : 1e9);
        if (dn < bd) return null;
      }
    } catch (e) { /* ignore */ }
    return best;
  }
  function nearWindow() {
    const R = S.room; if (!R || !R.windows) return null;
    let best = null, bd = 0.85;
    for (const w of R.windows) { const d = Math.hypot(P.x - (R.origin.x + w.x), P.z - (R.origin.z + w.z)); if (d < bd) { bd = d; best = w; } }
    return best;
  }
  function nearSpot() {
    const R = S.room; if (!R) return null;
    let best = null, bd = 1e9;
    for (const h of R.spots) {
      const d = Math.hypot(P.x - (R.origin.x + h.x), P.z - (R.origin.z + h.z));
      if (d < h.r && d < bd) { bd = d; best = h; }
    }
    return best;
  }
  function useSpot(h) {
    const id = S.id;
    if (emit('interact', id, h.id)) return;
    if (typeof h.onUse === 'function') { try { h.onUse(ctx); } catch (e) { console.error(e); } return; }
    if (h.id === 'bed' || (id === 'rv' && /bed|nap|sleep/.test(h.id))) {
      if (G.heat > 0) { ctx.toast("Can't nap with the HOA on your tail."); return; }
      G.hp = 100; ctx.save(); ctx.toast('Napped in the RV. Game saved, health restored.'); ctx.Sfx && ctx.Sfx.jingle && ctx.Sfx.jingle();
      return;
    }
    const L = FLAVOR[`${id}:${h.id}`] || FLAVOR[h.id];
    ctx.toast(L ? L[(Math.random() * L.length) | 0] : (h.label || h.id) + '.', 3);
    ctx.Sfx && ctx.Sfx.blip && ctx.Sfx.blip(660);
  }
  /** E / USE pressed on foot. Returns true when the interiors system consumed it. */
  function use() {
    if (S.fading) return true;
    if (S.inside) {
      const w = nearWindow(); if (w) { apiExit({ _window: w }); return true; }
      const h = nearSpot(); if (h) { useSpot(h); return true; }
      if (S.atExit) {
        if (locks.has(S.id)) { ctx.toast("It's locked.", 2); return true; }
        apiExit(); return true;
      }
      return true;  // no cars to steal in here
    }
    const e = activeDoor();
    if (e) { apiEnter(e.id, { _entry: e }); return true; }
    return false;
  }

  // per frame, after updatePlayer (game running)
  function update(dt) {
    if (S.fading) {
      P.x = S.fading.hold.x; P.z = S.fading.hold.z; P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.3);
    }
    if (!S.inside) {
      // a stale room position with no room around it (e.g. a future save format restored it): back to the RV lot
      if (!S.fading && P.x > ROOM_X - 200 && P.z > ROOM_Z - 200 && ctx.places && ctx.places.spawn) { P.x = ctx.places.spawn.x; P.z = ctx.places.spawn.z; P.y = 0; P.vy = 0; }
      return;
    }
    const R = S.room;
    // teleported away (respawn, busted, editor "play from here"): drop indoor mode where the player is
    if (Math.abs(P.x - R.origin.x) > 60 || Math.abs(P.z - R.origin.z) > 60) { swapOut(false); return; }
    if (P.y > R.cam.height - 0.9) { P.y = Math.max(0, R.cam.height - 0.9); P.vy = Math.min(0, P.vy); }
    const ex = R.origin.x + R.exit.x, ez = R.origin.z + R.exit.z, d = Math.hypot(P.x - ex, P.z - ez);
    if (!S.exitArmed && Math.hypot(P.x - S.spawnPt.x, P.z - S.spawnPt.z) > 0.6) S.exitArmed = true;
    S.atExit = S.exitArmed && d < R.exit.r + 0.6;
    if (!S.exitArmed) { /* just came in: walk away from the door first */ }
    else if (!S.fading && d < R.exit.r && !locks.has(S.id) && P.y < 0.3) apiExit();
  }
  // per frame, after fx.update: indoor light + environment
  function env() {
    if (!S.inside) return;
    const R = S.room, pool = ctx.pool || [];
    for (let i = 0; i < pool.length; i++) {
      const l = pool[i], L = R.lights[i];
      l.userData.src = null;
      if (!L) { l.intensity = 0; continue; }
      l.position.set(R.origin.x + (+L.x || 0), +L.y || 2.4, R.origin.z + (+L.z || 0));
      l.color.set(L.c ?? 0xfff0d8);
      l.intensity = 16 * (L.i ?? 1) * (L.flicker ? 0.85 + Math.random() * 0.3 : 1);
    }
    if (R.out && typeof R.out.update === 'function') { try { R.out.update(G.time || 0); } catch (e) { R.out.update = null; console.error('[interiors] room update', e); } }
    if (ctx.hemi) { ctx.hemi.intensity = 0.55; ctx.hemi.color.set(0xfff2e0); ctx.hemi.groundColor.set(0x4a4038); }
    if (ctx.sun) ctx.sun.intensity = 0;
    if (ctx.moon) ctx.moon.intensity = 0;
    if (scene.fog) { scene.fog.near = 80; scene.fog.far = 300; }
    if (ctx.post && ctx.post.comp) ctx.post.comp.uniforms.night.value = 0.25;
  }
  function camDist(d) { return S.room ? Math.min(d, S.room.cam.maxDist) : d; }
  function clampCam(v) {
    const R = S.room; if (!R) return;
    const m = 0.2, hw = R.size[0] / 2 - m, hd = R.size[1] / 2 - m;
    v.x = Math.max(R.origin.x - hw, Math.min(R.origin.x + hw, v.x));
    v.z = Math.max(R.origin.z - hd, Math.min(R.origin.z + hd, v.z));
    v.y = Math.max(0.3, Math.min(R.cam.height, v.y));
  }

  // per frame, end of frame (also while paused): fade, markers, prompt, minimap. Returns nothing.
  const promptEl = document.getElementById('prompt'), useBtn = document.getElementById('usebtn');
  let tick = 0;
  function hud(dt) {
    // fade
    if (S.fading) {
      const f = S.fading, t = nowS() - f.t0;
      if (!f.done) {
        fadeEl.style.opacity = String(Math.min(1, t / FADE));
        if (t >= FADE) {
          f.done = true; f.t0 = nowS();
          let ok = false; try { ok = f.fn(); } catch (e) { console.error('[interiors] swap failed', e); S.errors.push(String(e)); if (S.inside) swapOut(null); }
          f.hold = { x: P.x, z: P.z };
          if (ok === false) { /* fade back in where we were */ }
        }
      } else {
        fadeEl.style.opacity = String(Math.max(0, 1 - t / FADE));
        if (t >= FADE) { S.fading = null; fadeEl.style.opacity = '0'; }
      }
    }
    // the world editor needs the outdoors: leave the room first
    let dev = null; try { dev = ctx.getDev && ctx.getDev(); } catch (e) { dev = null; }
    if (S.inside && dev && dev.editing) { const id = S.id; swapOut(S.ret || doorExitPoint(id) || S.outPos); }
    // markers
    if ((tick -= dt || 0.016) <= 0) { tick = 0.25; for (const e of entries) placeEntry(e); }
    const t = G.time || 0;
    for (const e of entries) { const u = e.mesh.userData; u.arrow.position.y = u.arrowY + Math.sin(t * 3) * 0.08; u.arrow.rotation.y = t * 2; }
    ringMat.opacity = 0.42 + 0.18 * Math.sin(t * 4);
    // prompt
    let txt = '', btn = '';
    const key = ctx.isTouch ? 'USE' : 'E';
    if (!S.fading && !G.paused && !G.dialog) {
      if (S.inside) {
        const w = nearWindow(), h = w ? null : nearSpot();
        if (w) { txt = `${key}: Climb out`; btn = 'CLIMB'; }
        else if (h) { txt = `${key}: ${h.label}`; btn = 'USE'; }
        else if (S.atExit) { txt = locks.has(S.id) ? 'Locked' : `${key}: Exit`; btn = 'EXIT'; }
      } else {
        const e = activeDoor();
        S.near = e ? e.id + (e.kind === 'window' ? ':window' : '') : null;
        const k2 = ctx.isTouch ? 'Tap USE' : 'E';
        if (e && e.kind === 'window') { txt = `${k2}: Climb in (${roomName(e.id)})`; btn = 'CLIMB'; }
        else if (e) { txt = `${k2}: Enter ${roomName(e.id)}`; btn = 'ENTER'; }
      }
    } else S.near = null;
    if (promptEl && (txt || S.inside)) { setText(promptEl, txt); setStyle(promptEl, 'display', txt ? 'block' : 'none'); }
    if (useBtn && btn) setText(useBtn, btn);
    else if (useBtn && S.inside) setText(useBtn, 'USE');
    // minimap: a little floor plan
    if (S.inside && ctx.mg && ctx.mm) drawPlan(ctx.mg, ctx.mm.width);
  }
  function roomName(id) {
    const r = rooms[id]; if (r && r.name) return r.name;
    const reg = registry.get(id); return (reg && reg.room.name) || id;
  }
  function drawPlan(g, W) {
    const R = S.room;
    g.save(); g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, 7); g.clip();
    g.fillStyle = '#16141c'; g.fillRect(0, 0, W, W);
    const s = Math.min((W * 0.62) / R.size[0], (W * 0.5) / R.size[1]), cx = W / 2, cy = W / 2 + 8;
    const X = (x) => cx + (x - R.origin.x) * s, Y = (z) => cy + (z - R.origin.z) * s;
    g.fillStyle = '#3a3448'; g.fillRect(X(R.origin.x - R.size[0] / 2), Y(R.origin.z - R.size[1] / 2), R.size[0] * s, R.size[1] * s);
    g.fillStyle = '#5a5070';
    for (const c of R.cols) { g.save(); g.translate(X(c.cx), Y(c.cz)); g.rotate(-Math.atan2(c.s, c.c)); g.fillRect(-c.hw * s, -c.hd * s, c.hw * 2 * s, c.hd * 2 * s); g.restore(); }
    g.fillStyle = '#ffc84a'; g.beginPath(); g.arc(X(R.origin.x + R.exit.x), Y(R.origin.z + R.exit.z), 3.5, 0, 7); g.fill();
    g.fillStyle = '#8fd0ff'; for (const w of R.windows || []) { g.beginPath(); g.arc(X(R.origin.x + w.x), Y(R.origin.z + w.z), 2.5, 0, 7); g.fill(); }
    g.translate(X(P.x), Y(P.z)); g.rotate(-P.yaw + Math.PI);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(0, 1.5); g.lineTo(-4, 4); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.save(); g.fillStyle = '#ffd23f'; g.font = 'bold 12px monospace'; g.textAlign = 'center';
    g.fillText('INSIDE', W / 2, 26);
    g.fillStyle = '#fff'; g.font = 'bold 10px monospace';
    const n = R.name.length > 18 ? R.name.slice(0, 17) + '.' : R.name;
    g.fillText(n.toUpperCase(), W / 2, 39);
    g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, 7); g.stroke();
    g.restore();
  }

  // F3 (world editor) while inside: step outside first, before the dev tools see the key
  addEventListener('keydown', (e) => { if (e.key === 'F3' && S.inside) { const id = S.id; swapOut(S.ret || doorExitPoint(id) || S.outPos); } }, true);

  const api = {
    registerRoom, enter: apiEnter, exit: apiExit, lock, unlock, current: () => (S.inside ? S.id : null), on,
    use, update, env, hud, collide: roomCollide, blocked: roomBlocked, camDist, clampCam,
    /** Where a save should put the player: just outside the current room's door (or the player's spot outdoors). */
    savePos() { if (!S.inside) return { x: P.x, z: P.z, yaw: P.yaw }; return S.ret || doorExitPoint(S.id) || S.outPos || { x: ctx.places.spawn.x, z: ctx.places.spawn.z, yaw: 0 }; },
    get inside() { return S.inside; },
    get name() { return S.inside ? S.room.name : ''; },
    get state() {
      return {
        inside: S.inside, id: S.id, fading: !!S.fading, near: S.near, atExit: S.atExit, exitArmed: S.exitArmed, swaps: S.swaps,
        locked: [...locks], errors: S.errors.slice(), roomsLoaded: !!roomsMod, roomsError: roomsErr ? String(roomsErr) : null,
        doors: Object.fromEntries(entries.filter((e) => e === doorOf(e.id)).map((d) => [d.id, { x: +d.cur.x.toFixed(2), z: +d.cur.z.toFixed(2), yaw: +d.cur.yaw.toFixed(3), tx: +d.cur.tx.toFixed(2), tz: +d.cur.tz.toFixed(2), ok: d.cur.ok }])),
        entries: entries.map((d) => ({ id: d.id, kind: d.kind, x: +d.cur.x.toFixed(2), z: +d.cur.z.toFixed(2), yaw: +d.cur.yaw.toFixed(3), tx: +d.cur.tx.toFixed(2), tz: +d.cur.tz.toFixed(2), ok: d.cur.ok })),
        entry: S.entry ? { id: S.entry.id, kind: S.entry.kind, i: S.entry.i } : null,
        rooms: Object.fromEntries(Object.entries(rooms).map(([id, r]) => [id, { built: r.built, broken: r.broken, origin: r.origin, size: r.size }])),
        room: S.room ? { id: S.id, origin: S.room.origin, size: S.room.size, exit: S.room.exit, spawn: S.room.spawn, cols: S.room.cols.length, lights: S.room.lights.length, spots: S.room.spots.map((h) => h.id), windows: (S.room.windows || []).map((w) => ({ x: +w.x.toFixed(2), z: +w.z.toFixed(2), yaw: +w.yaw.toFixed(2) })) } : null,
      };
    },
    ready: roomsReady,
    _addDoor: addDoor,
  };
  for (const id of registry.keys()) addDoor(id);   // rooms registered before the game started
  inst = api;
  window.__INT = api;
  return api;
}
