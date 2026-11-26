// "The Missing Hens", part A of the Ghost of John storyline (2026-11-26, diet's doc: https://claude.ai/artifact/7tELc8RqFsxjhuysnjLJJE).
// The RV lot gets a hen coop with six hens. After the first night one is gone, then one more every night. Goobles
// gathers clues (three of four: Nana, the glowing feather trail, the boot prints where the shadow man stands, Big Ricky
// for a fish; or catch the thief on a 3 a.m. stakeout), follows the feathers to the Hollow Deep (cave.js) and finds the
// Ghost of John with Tuesday the hen in a crate. A menu turn-based battle, then a choice:
//   - FISH DEAL (canon for parts B and C): the hens come home, and John gets 3 fish a week in a bucket at the cave mouth.
//     Skip a week and a hen goes missing.
//   - FREE TUESDAY: untie the knots (a timing bar) and she rides on Goobles' head from then on.
// Either way: $150, the Feather Wand (a sparkle on Goobles' paw) and, at night, John watching the RV from the tree line.
// Own save key mg-hens-v1. Wired by tools/hens-hooks.mjs. Quest log entry via quests.register(). Debug: window.__HENS.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, basic } from './gfx.js';
import { colliders, CAVE_SPOT } from './world.js';
import { heightAt } from './terrain.js';
import * as INTM from './interiors.js';
import { makeGhost, animGhost, ghostAlpha } from './cave.js';

const KEY = 'mg-hens-v1';
const JOHN = 'GHOST OF JOHN';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let sd = 4141;
const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);   // seeded: never touches Math.random outdoors
const rnd = (a, b) => a + rr() * (b - a);
const NEED = 3;   // clues needed

// ------------------------------------------------------------------ geometry helpers ------------------------------------------------------------------
function tint(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function at(g, x, y, z, ry = 0, rx = 0, rz = 0) { if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; }
function merge(list) { const c = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); return n; }); return mergeGeometries(c, false); }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** One low-poly hen, ~0.45 m tall, facing +z. Vertex coloured; body parts take the instance colour. */
function henGeo(body = 0xffffff) {
  const p = [];
  const b = new THREE.IcosahedronGeometry(0.16, 0); b.scale(0.85, 0.8, 1.15); p.push(tint(at(b, 0, 0.24, 0), body));
  p.push(tint(at(new THREE.ConeGeometry(0.09, 0.2, 4), 0, 0.33, -0.17, 0, -0.7), body));                 // tail
  p.push(tint(at(box(0.11, 0.13, 0.11), 0, 0.42, 0.13), body));                                           // head
  p.push(tint(at(box(0.03, 0.07, 0.09), 0, 0.51, 0.13), 0xd82a20));                                      // comb
  p.push(tint(at(box(0.03, 0.05, 0.03), 0, 0.35, 0.19), 0xd82a20));                                      // wattle
  p.push(tint(at(new THREE.ConeGeometry(0.025, 0.07, 4), 0, 0.42, 0.21, 0, Math.PI / 2), 0xe8b020));    // beak
  for (const s of [-1, 1]) {
    p.push(tint(at(box(0.02, 0.12, 0.02), s * 0.05, 0.06, 0.01), 0xe8b020));                             // legs
    p.push(tint(at(box(0.05, 0.015, 0.07), s * 0.05, 0.008, 0.03), 0xe8b020));
    p.push(tint(at(box(0.012, 0.03, 0.03), s * 0.06, 0.45, 0.17), 0x101010));                           // eyes
  }
  return merge(p);
}

// ------------------------------------------------------------------ dialog ------------------------------------------------------------------
const FIRST_COOP = 'Somebody dropped off a hen coop at the RV. Six hens. The note says "FREE TO A GOOD HOME. OR YOURS." Goobles is a farmer now.';
const START = [['', 'The coop latch is open. One hen short.'], ['', 'There is a feather stuck in the latch. It glows a soft blue, and it is cold to the touch.'], ['', 'Who steals a chicken and leaves a feather that GLOWS? Time to ask around.']];
const CLUES = {
  nana: { label: 'Ask Nana about the hens', lines: [['Nana', 'Your chickens? Oh, sweetie. I was up at three with my hip, and I heard humming out by your trailer. Off-key. Very off-key.'], ['Nana', 'Then a fellow floated over the fence. Round little glasses. Carrying a hen like a baby. He waved at me!'], ['Nana', 'I waved back. You wave back, that\'s manners. Then he went off west, into the Hollow Woods.']] },
  ricky: { label: 'Ask Big Ricky about the hens', fishLines: [['Big Ricky', 'The floaty guy? Yeah, we know the floaty guy. He comes through the park sometimes. Smells like incense and campfire.'], ['Big Ricky', 'He took Doris from us once. Doris was a pigeon. He gave her back with a tiny scarf on.'], ['Big Ricky', 'His place is way out west in the woods. A hole in the rocks. We don\'t go there. The rocks hum.']], noFish: [['Big Ricky', 'Information costs a fish, cat. One fish. Raw, cooked, I don\'t care. Not the boot.'], ['', '(Catch a fish off the dock or buy one... then come back to Big Ricky.)']] },
  shadow: { label: 'Look at the boot prints', lines: [['', 'Boot prints in the mud, deep and still. Somebody stands right here for hours, watching the RV.'], ['', 'No feathers. No hen. Whoever stands here only watches. That\'s a whole different problem.'], ['', 'The glowing feathers go further west than this. Much further.']] },
  trail: { toast: 'A glowing feather. And another one, further on. A trail, heading west into the woods.' },
  stakeout: {},
};
const CLUE_ORDER = ['nana', 'trail', 'ricky', 'shadow'];
const READY = [['', 'Off-key humming at 3 a.m. Glowing feathers. A floaty guy with round glasses who lives in a hole in the rocks out west.'], ['', 'Goobles has a pretty good idea where his hens went. Follow the feathers west into the Hollow Woods.']];
const CONFRONT = [
  [JOHN, 'Goobles! You found me! You found my whole... situation.'],
  ['', 'Tuesday the hen is in a crate by the fire. There are a LOT of feathers around the spit.'],
  [JOHN, 'Okay. This isn\'t what it looks like.'],
  [JOHN, 'It\'s EXACTLY what it looks like.'],
  [JOHN, 'Ghosts get peckish! And your hens are so CLOSE. And so ROUND.'],
  [JOHN, 'You want Tuesday back? You\'ll have to get past me. Spiritually. With a fight. A gentle one.'],
];
const RETRY = [[JOHN, 'Round two! I rested. Ghosts don\'t need rest, but I did it anyway. For drama.']];
const AFTER_BATTLE = [
  [JOHN, 'Okay! Okay. I yield. You\'re very good at ignoring me. It\'s honestly my favourite thing about you.'],
  [JOHN, 'Look. I can\'t eat ghost food. There IS no ghost food. I tried. It\'s just mist.'],
  [JOHN, 'So here\'s a deal: three fish a week, in a bucket outside my door. I return every hen and never take another one.'],
  [JOHN, 'Or... take Tuesday and go. I\'ll be fine. I\'ll be down here. Alone. With my poems.'],
];
const DEAL = [
  [JOHN, 'A deal! A real deal! Shake on it. Your paw goes right through my hand, but it\'s the thought.'],
  [JOHN, 'Three fish a week. The bucket\'s by the torch post. I\'ll put the girls back in the coop tonight. All of them. Even Tuesday. Especially Tuesday.'],
  [JOHN, 'Skip a week, though, and... well. A ghost has needs. Here, take this. I made it.'],
  ['', 'John hands over a wand with a glowing feather at the tip. It is Tuesday\'s feather. Tuesday looks annoyed about it.'],
];
const FREED = [
  ['', 'The last knot comes loose. Tuesday hops out, looks around, and climbs straight up onto Goobles\' head.'],
  [JOHN, 'She chose you. Of course she did. Everyone chooses you.'],
  [JOHN, 'Fine. FINE. Take this, so you remember me. I\'ll be watching. Lovingly. From a respectful distance.'],
  ['', 'John hands over a wand with a glowing feather at the tip.'],
];
const KNOT_INTRO = [['', 'The crate is tied shut with a lot of very confident knots. Pull each one when the marker is in the gold.']];
const POST_TALK = {
  deal: [[JOHN, 'My favourite delivery cat! Is the bucket full? Don\'t tell me. Let me be surprised.'], [JOHN, 'The fish last week was perfect. A little lake-y. Ten out of ten.']],
  freed: [[JOHN, 'How\'s Tuesday? Does she ask about me? You can lie.'], [JOHN, 'I\'ve started a new poem. It\'s about a hen on a cat on a hen. I lost track.']],
};

// ------------------------------------------------------------------ the battle: menu turn-based, RPG style ------------------------------------------------------------------
const MOVES = [
  { id: 'paw', name: 'PAW', blurb: 'A solid swat. Ghosts hate being touched. He secretly loves it.' },
  { id: 'hiss', name: 'HISS', blurb: 'A little damage, and his next move hits half as hard.' },
  { id: 'ignore', name: 'IGNORE', blurb: 'Turn your back. Devastating, if it lands.' },
  { id: 'nap', name: 'NAP', blurb: 'Heal 25. He gets a free turn to watch you sleep.' },
  { id: 'fish', name: 'FISH', blurb: 'Throw a fish from your bag. He drops everything to eat it.' },
];
const J_MAX = 120;

export function makeHens(ctx) {
  const { scene, G, P, cat, places, NPC, fishing, quests, cave, say, toast, Sfx, addCash, isTouch } = ctx;
  const key = isTouch ? 'USE' : 'E';
  let SV = {}; try { SV = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { SV = {}; }
  const fresh = () => ({ stage: 'none', hens: 6, clues: {}, day: 0, seen: 0, news: 0, nightDone: -1, bucket: 0, weekStart: 0, wand: 0, onHead: 0, tries: 0 });
  SV = Object.assign(fresh(), SV); SV.clues ||= {};
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) { /* private mode */ } };
  const S = { prevClock: G.clock || 0, battle: null, knots: null, stake: null, watch: { a: 0 }, built: false, t: 0, watchSeen: false };
  const api = { S, get SV() { return SV; } };
  const clueCount = () => Object.keys(SV.clues).filter((k) => SV.clues[k]).length;

  // ---------- the coop, at the back of the RV lot by the tree line ----------
  const COOP = { x: places.rv.x - 8.6, z: places.rv.z + 3.9, yaw: 0 };   // front (the run) faces +z
  const coop = new THREE.Group(); coop.position.set(COOP.x, 0, COOP.z); scene.add(coop);
  const RUN = { x0: -1.4, x1: 1.4, z0: 0.15, z1: 2.1 };   // fenced run, coop-local
  const HEN_COLS = [0x9a5a28, 0xf4f0e8, 0xf4f0e8, 0x3a3a40, 0xc8843a, 0xe8d8b0];   // Tuesday first (brown)
  let henMesh = null; const hens = [];
  function buildCoop() {
    const p = [], wood = 0x9a6a40, dark = 0x5a3a22, roof = 0xa83a2a, white = 0xe8e0cc;
    for (const [x, z] of [[-0.7, -0.95], [0.7, -0.95], [-0.7, -0.05], [0.7, -0.05]]) p.push(tint(at(box(0.09, 0.55, 0.09), x, 0.27, z), dark));
    p.push(tint(at(box(1.6, 0.85, 1.0), 0, 0.97, -0.5), wood));                                     // the hutch
    for (let k = 0; k < 5; k++) p.push(tint(at(box(1.62, 0.03, 1.02), 0, 0.62 + k * 0.18, -0.5), dark));   // board lines
    p.push(tint(at(box(1.9, 0.06, 0.78), 0, 1.58, -0.83, 0, 0.42), roof));                         // roof, two pitches
    p.push(tint(at(box(1.9, 0.06, 0.78), 0, 1.58, -0.17, 0, -0.42), roof));
    p.push(tint(at(box(0.1, 0.1, 1.5), 0, 1.74, -0.5), dark));
    p.push(tint(at(box(0.36, 0.42, 0.04), 0.35, 0.92, 0.01), 0x2a1a10));                          // pop hole
    p.push(tint(at(box(0.36, 0.04, 0.9), 0.35, 0.34, 0.42, 0, 0.62), wood));                      // ramp
    for (let k = 0; k < 4; k++) p.push(tint(at(box(0.36, 0.02, 0.03), 0.35, 0.18 + k * 0.13, 0.12 + k * 0.2, 0, 0.62), dark));
    p.push(tint(at(box(0.6, 0.32, 0.04), -0.4, 1.12, 0.02), white));                              // name board
    p.push(tint(at(box(1.0, 0.36, 0.5), -1.35, 0.8, -0.5), wood));                                // nest box on the side
    p.push(tint(at(box(1.1, 0.05, 0.6), -1.35, 1.0, -0.5, 0, 0, 0.25), roof));
    // the run: posts and rails, chicken wire is the transparent mesh below
    const posts = [[RUN.x0, RUN.z0], [RUN.x1, RUN.z0], [RUN.x0, RUN.z1], [RUN.x1, RUN.z1], [0, RUN.z1]];
    for (const [x, z] of posts) p.push(tint(at(box(0.07, 0.9, 0.07), x, 0.45, z), dark));
    for (const y of [0.05, 0.88]) { p.push(tint(at(box(RUN.x1 - RUN.x0, 0.04, 0.04), 0, y, RUN.z1), dark)); for (const x of [RUN.x0, RUN.x1]) p.push(tint(at(box(0.04, 0.04, RUN.z1 - RUN.z0), x, y, (RUN.z0 + RUN.z1) / 2), dark)); }
    p.push(tint(at(box(0.5, 0.04, 0.25), 0.9, 0.06, 1.6), 0xb0b0b8)); p.push(tint(at(new THREE.CylinderGeometry(0.12, 0.1, 0.12, 8), -0.9, 0.06, 1.55), 0x7a8a9a));   // feed tray, water
    for (let k = 0; k < 40; k++) { const g = new THREE.PlaneGeometry(0.05, 0.05); g.rotateX(-Math.PI / 2); p.push(tint(at(g, rnd(RUN.x0 + 0.1, RUN.x1 - 0.1), 0.02, rnd(RUN.z0 + 0.1, RUN.z1 - 0.1)), [0xd8c070, 0xc8b060][k % 2])); }   // scattered feed
    const m = new THREE.Mesh(merge(p), lambert({ vertexColors: true, flatShading: true })); coop.add(m);
    // chicken wire on three sides of the run
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g2 = cv.getContext('2d'); g2.strokeStyle = 'rgba(200,205,210,0.85)'; g2.lineWidth = 1.2;
    g2.beginPath(); for (let k = -32; k < 64; k += 8) { g2.moveTo(k, 0); g2.lineTo(k + 32, 32); g2.moveTo(k + 32, 0); g2.lineTo(k, 32); } g2.stroke();
    const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.magFilter = THREE.NearestFilter;
    const wire = [], W = RUN.x1 - RUN.x0, D = RUN.z1 - RUN.z0;
    const plane = (w, x, z, ry) => { const g = new THREE.PlaneGeometry(w, 0.85); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 4, uv.getY(i) * 3.4); return at(g, x, 0.47, z, ry); };
    wire.push(plane(W, 0, RUN.z1, 0), plane(D, RUN.x0, (RUN.z0 + RUN.z1) / 2, Math.PI / 2), plane(D, RUN.x1, (RUN.z0 + RUN.z1) / 2, Math.PI / 2));
    coop.add(new THREE.Mesh(mergeGeometries(wire, false), basic({ map: tx, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
    // hens: one instanced mesh, one draw call
    henMesh = new THREE.InstancedMesh(henGeo(), lambert({ vertexColors: true, flatShading: true }), 6);
    for (let i = 0; i < 6; i++) { henMesh.setColorAt(i, new THREE.Color(HEN_COLS[i])); hens.push({ x: rnd(RUN.x0 + 0.3, RUN.x1 - 0.3), z: rnd(RUN.z0 + 0.4, RUN.z1 - 0.3), yaw: rnd(0, 6), tx: 0, tz: 0, t: rnd(0, 3), peck: 0 }); }
    henMesh.frustumCulled = false; coop.add(henMesh);
    // solid: the hutch and the run fence
    const wc = (lx, lz, r) => colliders.push({ cx: COOP.x + lx, cz: COOP.z + lz, r, h: 1.8, ng: true, nf: true, hens: true });
    wc(-0.4, -0.5, 0.75); wc(0.45, -0.5, 0.75); wc(-1.35, -0.5, 0.4);
    for (let k = 0; k <= 6; k++) wc(RUN.x0 + (k / 6) * W, RUN.z1, 0.22);
    for (let k = 1; k <= 4; k++) { wc(RUN.x0, RUN.z0 + (k / 4) * D, 0.22); wc(RUN.x1, RUN.z0 + (k / 4) * D, 0.22); }
    S.built = true;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  function updateHens(dt) {
    if (!henMesh) return;
    const n = clamp(SV.hens | 0, 0, 6);
    henMesh.count = n;
    for (let i = 0; i < n; i++) {
      const h = hens[i]; h.t -= dt;
      if (h.t <= 0) { h.t = rnd(1.2, 4); if (rr() < 0.45) { h.peck = rnd(0.8, 1.8); } else { h.tx = rnd(RUN.x0 + 0.25, RUN.x1 - 0.25); h.tz = rnd(RUN.z0 + 0.35, RUN.z1 - 0.25); h.peck = 0; } }
      let bob = 0;
      if (h.peck > 0) { h.peck -= dt; bob = Math.sin(h.peck * 18) > 0.3 ? 0.35 : 0; }
      else if (h.tx) { const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz); if (d > 0.05) { const st = Math.min(d, dt * 0.55); h.x += dx / d * st; h.z += dz / d * st; const want = Math.atan2(dx, dz); h.yaw += Math.atan2(Math.sin(want - h.yaw), Math.cos(want - h.yaw)) * Math.min(1, dt * 6); } }
      _e.set(bob, h.yaw, 0); _q.setFromEuler(_e); _p.set(h.x, 0, h.z); _m.compose(_p, _q, _s); henMesh.setMatrixAt(i, _m);
    }
    henMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- the glowing feather trail: coop -> cave mouth ----------
  const trail = []; const trailGroups = [];
  {
    const end = { x: CAVE_SPOT.x + 4, z: CAVE_SPOT.z };
    const L = Math.hypot(end.x - COOP.x, end.z - COOP.z), n = Math.floor(L / 5.5);
    for (let i = 2; i <= n; i++) { const k = i / n, w = Math.sin(k * 9.0) * 3.2 + Math.sin(k * 23) * 1.2; const nx = -(end.z - COOP.z) / L, nz = (end.x - COOP.x) / L; trail.push({ x: COOP.x + (end.x - COOP.x) * k + nx * w, z: COOP.z + (end.z - COOP.z) * k + nz * w }); }
  }
  function buildTrail() {
    // one atlas: the feather on the left quarter, a soft ground glow on the rest
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 48; const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 48); gr.addColorStop(0, 'rgba(225,242,255,1)'); gr.addColorStop(1, 'rgba(150,200,255,0.8)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(8, 22, 6, 20, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(7, 2, 2, 44);
    const rg = g.createRadialGradient(40, 24, 0, 40, 24, 23); rg.addColorStop(0, 'rgba(150,200,255,0.55)'); rg.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = rg; g.fillRect(16, 0, 48, 48);
    const tex = new THREE.CanvasTexture(cv);
    const mat = basic({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xc8e0ff });
    const uvs = (q, u0, u1) => { const uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0)); return q; };
    const CH = 5;
    for (let c = 0; c < trail.length; c += CH) {
      const list = []; let cx = 0, cz = 0; const part = trail.slice(c, c + CH);
      for (const f of part) {
        const h = heightAt(f.x, f.z); cx += f.x / part.length; cz += f.z / part.length;
        const gq = uvs(new THREE.PlaneGeometry(1.1, 1.1), 0.25, 1); gq.rotateX(-Math.PI / 2); gq.translate(f.x, h + 0.1, f.z); list.push(gq);
        for (let k = 0; k < 3; k++) { const q = uvs(new THREE.PlaneGeometry(0.13, 0.38), 0, 0.25); const ox = rnd(-0.45, 0.45), oz = rnd(-0.45, 0.45); q.rotateX(k ? -Math.PI / 2 + rnd(-0.3, 0.3) : -0.35); q.rotateY(rnd(0, 6.28)); q.translate(f.x + ox, h + (k ? 0.06 : 0.22), f.z + oz); list.push(q); }
      }
      const m = new THREE.Mesh(mergeGeometries(list.map((q) => q.toNonIndexed()), false), mat); m.userData.noLift = true; m.userData.c = { x: cx, z: cz }; m.visible = false;
      scene.add(m); trailGroups.push(m);
    }
  }

  // ---------- the bucket at the cave mouth (fish deal) ----------
  const cy = CAVE_SPOT.yaw, L2W = (lx, lz) => [CAVE_SPOT.x + lx * Math.cos(cy) + lz * Math.sin(cy), CAVE_SPOT.z - lx * Math.sin(cy) + lz * Math.cos(cy)];
  const [bx, bz] = L2W(-1.4, 2.5);
  const BUCKET = { x: bx, z: bz };
  const bucket = new THREE.Group(); bucket.position.set(bx, 0, bz); bucket.visible = false; scene.add(bucket);
  {
    const p = [tint(at(new THREE.CylinderGeometry(0.22, 0.17, 0.36, 9, 1, true), 0, 0.18, 0), 0x8a9aa8), tint(at(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 9), 0, 0.01, 0), 0x6a7a88), tint(at(new THREE.TorusGeometry(0.22, 0.012, 4, 10, Math.PI), 0, 0.36, 0), 0x404850)];
    p.push(tint(at(box(0.36, 0.22, 0.02), 0.42, 0.42, 0, 0.3), 0xf0e6c8), tint(at(box(0.03, 0.5, 0.03), 0.42, 0.25, -0.02, 0.3), 0x6a4a2a));
    const m = new THREE.Mesh(merge(p), lambert({ vertexColors: true, side: THREE.DoubleSide })); bucket.add(m);
    bucket.userData.fish = []; for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), lambert({ color: 0x7aa0c8 })); f.scale.set(0.6, 0.7, 1.8); f.position.set(-0.08 + k * 0.08, 0.3, 0); f.rotation.x = -0.9; f.visible = false; bucket.add(f); bucket.userData.fish.push(f); }
  }

  // ---------- the outdoor ghost (stakeout, and watching the RV at night once part A is done) ----------
  const og = makeGhost(); og.visible = false; og.userData.noLift = true; ghostAlpha(og, 0); scene.add(og);
  const WATCH = { x: COOP.x - 3.5, z: COOP.z - 5.5 };   // the tree line behind the coop

  // ---------- Tuesday on Goobles' head, the Feather Wand on his paw ----------
  const tues = new THREE.Mesh(henGeo(0x9a5a28), lambert({ vertexColors: true, flatShading: true })); tues.scale.setScalar(0.55); tues.position.set(0, 0.27, -0.02); tues.visible = false;
  if (cat.userData.head) cat.userData.head.add(tues); else cat.add(tues);
  const wand = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xbfe0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(180,220,255,0.8)'); gr.addColorStop(1, 'rgba(120,170,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); g.fillStyle = '#fff'; g.fillRect(15, 2, 2, 28); g.fillRect(2, 15, 28, 2); wand.material.map = new THREE.CanvasTexture(cv); }
  wand.scale.setScalar(0.08); wand.position.set(-0.2, 0.36, 0.16); wand.visible = false; cat.add(wand);

  // ---------- quest log ----------
  const COL = '#ffd23f';
  function nextClue() {
    const pts = { nana: NPC.nana && { x: NPC.nana.x, z: NPC.nana.z, label: 'Nana' }, ricky: NPC.ricky && { x: NPC.ricky.x, z: NPC.ricky.z, label: 'Big Ricky' }, shadow: { x: -134.3, z: 86.4, label: 'Boot prints' }, trail: trail[6] && { x: trail[6].x, z: trail[6].z, label: 'Feathers' } };
    for (const id of CLUE_ORDER) if (!SV.clues[id] && pts[id]) return pts[id];
    return null;
  }
  const DEF = {
    id: 'hens', kind: 'side', title: 'The Missing Hens', giver: 'the hen coop', where: 'the RV lot', reward: 150,
    blurb: 'Somebody is taking one hen a night from the coop at the RV. They leave glowing feathers behind. Ask around, find three clues, and catch the thief.',
    status: () => (SV.stage === 'none' ? 'hidden' : SV.stage === 'clues' || SV.stage === 'cave' ? 'active' : 'done'),
    guide() {
      const st = SV.stage;
      if (st === 'clues') {
        const n = clueCount(), c = nextClue();
        const near = c && Math.hypot(P.x - c.x, P.z - c.z) < 3.5;
        return { obj: `Find out who's taking the hens (clues ${n}/${NEED}). Ask Nana, ask Big Ricky (bring a fish), check the woods. Or stake out the coop at 3 a.m.`, check: c && !near ? { x: c.x, z: c.z, r: 2.5, label: c.label, col: COL } : null };
      }
      if (st === 'cave') {
        if (INTM.current() === 'cavelair') return { obj: 'Confront the ghost about the hens.', check: null };
        if (INTM.current() === 'cave') return { obj: 'Go down. All the way down.', check: null };
        const held = cave && cave.S.held;
        const [mx, mz] = L2W(held ? 0 : 1.9, held ? 0.4 : 1.2);
        return { obj: held ? 'Take the torch into the cave and find the thief.' : 'Follow the glowing feathers west into the Hollow Woods. Find a light.', check: Math.hypot(P.x - mx, P.z - mz) > 3 ? { x: mx, z: mz, r: 2.5, label: held ? 'Cave' : 'Torch', col: COL } : null };
      }
      if (st === 'deal') return { obj: `Fish deal: ${Math.min(3, SV.bucket | 0)}/3 fish in John's bucket this week.`, check: null };
      return { obj: 'Tuesday is safe on your head.', check: null };
    },
  };
  if (quests && quests.register) quests.register(DEF);

  function setStage(st) { SV.stage = st; store(); }
  function giveClue(id) {
    if (SV.clues[id] || SV.stage !== 'clues') return;
    SV.clues[id] = 1; store(); Sfx.pickup();
    const n = clueCount();
    toast(`Clue found (${Math.min(n, NEED)}/${NEED}).`, 2.5);
    if (n >= NEED) { setStage('cave'); S.readyPending = true; }
  }
  function startQuest() {
    setStage('clues'); SV.news = 0; store();
    say(START, () => { quests && quests.track && quests.track('hens'); toast('New quest: The Missing Hens', 3); Sfx.jingle && Sfx.jingle(); });
  }

  // ---------- nights ----------
  // A night passes at 3:00. G.clock runs 0-24, one game hour per real minute; the time menu can jump it.
  function onNight() {
    SV.day = (SV.day | 0) + 1;
    const st = SV.stage;
    if (st === 'none') { if (SV.seen) { SV.hens = 5; SV.news = 1; } }
    else if (st === 'clues' || st === 'cave') { if (SV.nightDone !== SV.day && SV.hens > 2) { SV.hens--; SV.news = 1; } }
    else if (st === 'deal') {
      if (SV.day - (SV.weekStart | 0) >= 7) {
        SV.weekStart = SV.day;
        if ((SV.bucket | 0) >= 3) { SV.bucket -= 3; SV.paidNews = 1; }
        else if (SV.hens > 0) { SV.hens--; SV.bucket = 0; SV.news = 2; }
      }
    }
    store();
  }
  function trackClock() {
    const c = G.clock || 0, p = S.prevClock; S.prevClock = c;
    let crossed = false;
    if (c >= p) crossed = p < 3 && c >= 3;
    else if (p - c > 12) crossed = p < 3 || c >= 3;   // wrapped past midnight (a small backwards step is the time menu)
    if (crossed) onNight();
  }

  // ---------- nearby actions ----------
  const dist = (x, z) => Math.hypot(P.x - x, P.z - z);
  function near() {
    if (P.car || G.dialog || G.paused || S.battle || S.knots) return null;
    if (INTM.current()) return null;
    const st = SV.stage;
    if (st === 'clues') {
      if (!SV.clues.nana && NPC.nana && NPC.nana.mesh.visible && dist(NPC.nana.x, NPC.nana.z) < 2.6) return { verb: CLUES.nana.label, fn: () => say(CLUES.nana.lines, () => giveClue('nana')) };
      if (!SV.clues.ricky && NPC.ricky && NPC.ricky.mesh.visible && dist(NPC.ricky.x, NPC.ricky.z) < 2.6) return { verb: CLUES.ricky.label, fn: askRicky };
      if (!SV.clues.shadow && dist(-134.3, 86.4) < 2.2) return { verb: CLUES.shadow.label, fn: () => say(CLUES.shadow.lines, () => giveClue('shadow')) };
    }
    if (st === 'deal' && dist(BUCKET.x, BUCKET.z) < 1.3) {
      return { verb: `Leave a fish in John's bucket (${Math.min(3, SV.bucket | 0)}/3)`, fn: leaveFish };
    }
    if (dist(COOP.x, COOP.z + 1.1) < 2.4) {
      if (SV.wand && SV.stage === 'freed') return { verb: SV.onHead ? 'Let Tuesday roost in the coop' : 'Put Tuesday back on your head', fn: () => { SV.onHead = SV.onHead ? 0 : 1; store(); Sfx.blip(SV.onHead ? 700 : 400); toast(SV.onHead ? 'Tuesday climbs back up. She clearly prefers it up there.' : 'Tuesday hops down into the coop and immediately bosses everyone around.', 3); } };
      return { verb: 'Count the hens', fn: () => toast(SV.hens >= 6 ? 'Six hens. All present. They stare at you like you owe them money.' : `${SV.hens} hens. There should be six.`, 3) };
    }
    return null;
  }
  function anyFish() { const b = fishing && fishing.S && fishing.S.bag; if (!b) return null; return b.find((f) => !(fishing.FISH[f.id] && fishing.FISH[f.id].junk) && !f.hat) || null; }
  function takeFish(f) { const b = fishing.S.bag, i = b.indexOf(f); if (i < 0) return false; if (fishing.removeFish) return fishing.removeFish(f.id, 1) > 0; b.splice(i, 1); return true; }
  function askRicky() {
    const f = anyFish();
    if (!f) return say(CLUES.ricky.noFish);
    takeFish(f); Sfx.pickup();
    say([['', `You hand Big Ricky a ${fishing.FISH[f.id] ? fishing.FISH[f.id].name.toLowerCase() : 'fish'}. He sniffs it, approves, and tucks it under his arm.`], ...CLUES.ricky.fishLines], () => giveClue('ricky'));
  }
  function leaveFish() {
    if ((SV.bucket | 0) >= 3) return toast('The bucket is full. John will collect it. A note on the rim says "THANK U :)".', 3);
    const f = anyFish();
    if (!f) return say([['', 'A note on the bucket: "THREE FISH A WEEK. RAW IS FINE. COOKED IS BETTER. BURNT IS ALSO FINE. - J"']]);
    takeFish(f); SV.bucket = (SV.bucket | 0) + 1; store(); Sfx.pickup();
    toast(SV.bucket >= 3 ? 'Three fish in the bucket. That\'s the week paid. Somewhere deep below, someone cheers.' : `A fish in the bucket (${SV.bucket}/3 this week).`, 3);
  }
  const prompt = () => { const n = near(); return n ? `${key}: ${n.verb}` : ''; };
  const interact = () => { const n = near(); if (!n) return false; n.fn(); return true; };

  // ---------- the cave side: confrontation, battle, choice ----------
  const gh = () => cave && cave.S && cave.S.gh;
  if (cave) {
    cave.quest = {
      reveal(first) {
        if (SV.stage === 'cave') return { lines: (SV.tries | 0) ? RETRY : CONFRONT, then: () => startBattle() };
        if (SV.stage === 'deal' || SV.stage === 'freed') return { lines: [POST_TALK[SV.stage][0]] };
        return null;
      },
      talkLabel: () => (SV.stage === 'cave' ? 'Fight the ghost for Tuesday' : ''),
      talk() {
        if (SV.stage === 'cave') { startBattle(); return true; }
        if (SV.stage === 'deal' || SV.stage === 'freed') { const g = gh(); if (g) g.talking = true; say(POST_TALK[SV.stage], () => { if (g) g.talking = false; }); return true; }
        return false;
      },
      hen() {
        if (SV.stage === 'cave' || SV.stage === 'clues') { say([['', 'A brown hen in a crate. Her name tag says "TUESDAY". She\'s yours. She\'s definitely yours. She was in your coop on Monday.'], ['', 'The knots are very confident. The ghost of whoever tied them is hovering right there.']]); return true; }
        if (SV.stage === 'deal' || SV.stage === 'freed') { say([['', 'The crate is empty now. Someone has scratched a little heart into the lid, and the words "MISS U TUESDAY".']]); return true; }
        return false;
      },
    };
  }

  // DOM: one overlay for the battle, the choice and the knots
  const css = document.createElement('style');
  css.textContent = `
#hensbt { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); width: min(760px, calc(100vw - 24px)); z-index: 58; display: none; font-size: 21px; line-height: 1.1; text-shadow: none; color: #e8eeff; }
#hensbt.on { display: block; }
#hensbt .bars { display: flex; gap: 12px; margin-bottom: 8px; }
#hensbt .bar { flex: 1; background: rgba(10, 14, 30, 0.88); border: 3px solid #c8c0a0; box-shadow: 4px 4px 0 #000; padding: 4px 10px; }
#hensbt .bar b { font-weight: normal; letter-spacing: 2px; font-size: 17px; color: var(--gold, #ffd23f); }
#hensbt .bar .hp { height: 10px; background: #2a2f44; border: 2px solid #000; margin-top: 3px; }
#hensbt .bar .hp i { display: block; height: 100%; background: #6fe07a; transition: width 0.25s; }
#hensbt .bar.j .hp i { background: #9ad0ff; }
#hensbt .bar small { float: right; font-size: 17px; }
#hensbt .box { display: flex; gap: 12px; background: rgba(10, 14, 30, 0.92); border: 3px solid #c8c0a0; box-shadow: 6px 6px 0 #000; padding: 8px 12px; min-height: 128px; }
#hensbt .cmds { flex: 0 0 150px; border-right: 2px solid #44506a; padding-right: 10px; }
#hensbt .cmd { padding: 2px 8px; margin: 2px 0; cursor: pointer; border: 2px solid transparent; font-size: 23px; }
#hensbt .cmd.sel { border-color: var(--gold, #ffd23f); background: #2a2f44; color: var(--gold, #ffd23f); }
#hensbt .cmd.off { opacity: 0.4; }
#hensbt .msg { flex: 1; cursor: pointer; }
#hensbt .msg .who { font-size: 16px; letter-spacing: 3px; color: #ff8ab0; }
#hensbt .msg .more { float: right; color: var(--gold, #ffd23f); animation: hensblink 0.8s steps(2) infinite; }
#hensbt .knot { position: relative; height: 26px; background: #2a2f44; border: 3px solid #000; margin: 10px 0 6px; }
#hensbt .knot .zone { position: absolute; top: 0; bottom: 0; background: rgba(255, 210, 63, 0.75); }
#hensbt .knot .mk { position: absolute; top: -6px; bottom: -6px; width: 6px; margin-left: -3px; background: #fff; box-shadow: 0 0 6px #fff; }
@keyframes hensblink { 50% { opacity: 0; } }
@media (max-width: 600px) { #hensbt { font-size: 18px; } #hensbt .cmds { flex-basis: 110px; } #hensbt .cmd { font-size: 19px; } }
`;
  document.head.appendChild(css);
  const ov = document.createElement('div'); ov.id = 'hensbt';
  ov.innerHTML = `<div class="bars"><div class="bar g"><b>GOOBLES</b><small class="gv"></small><div class="hp"><i></i></div></div><div class="bar j"><b>GHOST OF JOHN</b><small class="jv"></small><div class="hp"><i></i></div></div></div><div class="box"><div class="cmds"></div><div class="msg"></div></div>`;
  document.body.appendChild(ov);
  const $ = (s) => ov.querySelector(s);
  ov.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    const c = e.target.closest('.cmd'); if (c && S.battle && S.battle.mode === 'menu') { S.battle.sel = +c.dataset.i; renderBattle(); return confirm(); }
    if (c && S.choice) { S.choice.sel = +c.dataset.i; return confirm(); }
    confirm();
  });
  // keys while the overlay is up: caught before the game sees them
  addEventListener('keydown', (e) => {
    if (!S.battle && !S.knots && !S.choice) return;
    const k = e.key.toLowerCase();
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    if (['w', 'arrowup'].includes(k)) move(-1);
    else if (['s', 'arrowdown'].includes(k)) move(1);
    else if (['e', 'f', 'enter', ' '].includes(k)) confirm();
  }, true);

  function move(d) {
    const B = S.battle;
    if (B && B.mode === 'menu') { B.sel = (B.sel + d + MOVES.length) % MOVES.length; Sfx.blip(440); renderBattle(); }
    else if (S.choice) { S.choice.sel = (S.choice.sel + d + 2) % 2; Sfx.blip(440); renderChoice(); }
  }
  function confirm() {
    if (S.knots) return pullKnot();
    if (S.choice) return pickChoice();
    const B = S.battle; if (!B) return;
    if (B.mode === 'msg') { Sfx.blip(660); return nextMsg(); }
    const m = MOVES[B.sel];
    if (m.id === 'fish' && !anyFish()) { Sfx.blip(180); B.msgs = [['', 'No fish in your bag. (Catch one at the lake first.)']]; B.after = 'menu'; B.mode = 'msg'; return renderBattle(); }
    playerMove(m.id);
  }
  const R = (a, b) => Math.round(a + Math.random() * (b - a));   // indoors only: fine for the seeded outdoor traffic
  function startBattle() {
    if (S.battle) return;
    const g = gh(); if (g) { g.talking = true; g.state = 'haunt'; g.a = 1; }
    G.hp = Math.max(G.hp, 60);
    S.battle = { j: J_MAX, sel: 0, mode: 'msg', msgs: [['', 'The Ghost of John floats up, cracks his knuckles, and does a little spooky wiggle. A battle!']], after: 'menu', sleep: 0, hiss: 0, fade: 0, flash: 0 };
    ov.classList.add('on'); document.body.classList.add('menu');
    Sfx.blip(300);
    renderBattle();
  }
  function playerMove(id) {
    const B = S.battle, out = [];
    if (id === 'paw') {
      if (B.fade) { out.push(['', 'Goobles swats... right through him. He\'s faded out!']); B.fade = 0; }
      else { const crit = Math.random() < 0.12, n = Math.round(R(13, 19) * (crit ? 1.6 : 1)); hurtJ(n); out.push(['', crit ? `PAW! Right in the ectoplasm. ${n} damage!` : `Goobles paws John for ${n}.`]); }
    } else if (id === 'hiss') {
      const n = R(5, 8); hurtJ(n); B.hiss = 1; out.push(['', `Goobles hisses. John clutches his chest. ${n} damage, and his next move will be half as strong.`]);
    } else if (id === 'ignore') {
      if (Math.random() < 0.68 || B.fade) { const n = R(22, 30); hurtJ(n); out.push(['', 'Goobles turns around and licks his paw. Total indifference.'], [JOHN, 'No... no, look at me... LOOK AT ME...'], ['', `It's super effective! ${n} damage.`]); B.fade = 0; }
      else out.push(['', 'Goobles tries to ignore him, but John is doing a little dance. Goobles looks. He hates that he looked.']);
    } else if (id === 'nap') {
      const h = Math.min(100 - G.hp, 25); G.hp += h; out.push(['', `Goobles curls up for a power nap. +${h} health.`], [JOHN, '(whispering) He\'s so peaceful...']);
    } else if (id === 'fish') {
      const f = anyFish(); takeFish(f); const n = R(8, 12); hurtJ(n); B.skipJ = 1;
      out.push(['', `Goobles throws a ${fishing.FISH[f.id] ? fishing.FISH[f.id].name.toLowerCase() : 'fish'}. ${n} damage, and John drops EVERYTHING to eat it.`]);
    }
    Sfx.punch && Sfx.punch();
    if (B.j <= 0) { out.push([JOHN, 'Ooooh. Oh, I\'m see-through. More than usual.']); B.msgs = out; B.after = 'win'; B.mode = 'msg'; return renderBattle(); }
    B.msgs = out; B.after = 'john'; B.mode = 'msg'; renderBattle();
  }
  function hurtJ(n) { const B = S.battle; B.j = Math.max(0, B.j - n); B.flash = 0.45; }
  function johnMove() {
    const B = S.battle, out = [];
    if (B.skipJ) { B.skipJ = 0; out.push(['', 'John is busy eating. He makes happy ghost noises.']); return finishJohn(out); }
    const k = B.hiss ? 0.5 : 1; B.hiss = 0;
    const r = Math.random();
    if (B.j < 45 && !B.usedFade) { B.usedFade = 1; B.fade = 1; out.push([JOHN, 'You can\'t paw what you can\'t SEE!'], ['', 'John fades nearly invisible. Paws won\'t land. Maybe try not caring?']); }
    else if (r < 0.34) { const n = Math.round(R(7, 11) * k); G.hp -= n; out.push(['', `John uses HAUNTING STARE. He just... looks at you. Lovingly. ${n} damage.`]); }
    else if (r < 0.6) { out.push([JOHN, 'A poem! "Ode to the Cat Who Sleeps on the Dashboard."'], ['', Math.random() < 0.55 ? 'It is so long and so soft. Goobles falls asleep.' : 'Goobles stays awake out of spite.']); if (out[1][1].includes('falls asleep')) B.sleep = 1; }
    else { const n = Math.round(R(12, 17) * k); G.hp -= n; out.push(['', `John uses SPECTRAL HEN TOSS. A see-through hen bonks Goobles for ${n}. The hen seems fine about it.`]); }
    finishJohn(out);
  }
  function finishJohn(out) {
    const B = S.battle;
    if (G.hp <= 0) { G.hp = 0; out.push(['', 'Goobles is out cold.'], [JOHN, 'Oh no. Oh no no. I\'ll tuck him in. Then carry him upstairs. All 1,940 metres.']); B.msgs = out; B.after = 'lose'; B.mode = 'msg'; return renderBattle(); }
    if (B.sleep) { B.sleep = 0; out.push(['', 'Goobles is asleep. Purring. John watches. Of course he does.']); B.msgs = out; B.after = 'john'; B.mode = 'msg'; return renderBattle(); }
    B.msgs = out; B.after = 'menu'; B.mode = 'msg'; renderBattle();
  }
  function nextMsg() {
    const B = S.battle; B.msgs.shift();
    if (B.msgs.length) return renderBattle();
    const a = B.after;
    if (a === 'menu') { B.mode = 'menu'; return renderBattle(); }
    if (a === 'john') return johnMove();
    if (a === 'win') return endBattle(true);
    if (a === 'lose') return endBattle(false);
  }
  function endBattle(won) {
    S.battle = null; ov.classList.remove('on'); document.body.classList.remove('menu');
    const g = gh();
    if (!won) {
      SV.tries = (SV.tries | 0) + 1; store();
      G.hp = 40; if (g) g.talking = false;
      INTM.exit({ instant: true });
      toast('Goobles wakes up at the cave mouth, tucked in under a blanket that smells of patchouli.', 4.5);
      return;
    }
    say(AFTER_BATTLE, () => openChoice());
  }
  function renderBattle() {
    const B = S.battle; if (!B) return;
    $('.gv').textContent = `${Math.max(0, Math.round(G.hp))}/100`; $('.bar.g .hp i').style.width = `${clamp(G.hp, 0, 100)}%`;
    $('.jv').textContent = `${B.j}/${J_MAX} ECTO`; $('.bar.j .hp i').style.width = `${(B.j / J_MAX) * 100}%`;
    $('.bars').style.display = 'flex';
    const nf = fishing && fishing.S ? fishing.S.bag.filter((f) => !(fishing.FISH[f.id] && fishing.FISH[f.id].junk)).length : 0;
    $('.cmds').innerHTML = MOVES.map((m, i) => `<div class="cmd${i === B.sel && B.mode === 'menu' ? ' sel' : ''}${m.id === 'fish' && !nf ? ' off' : ''}" data-i="${i}">${m.name}${m.id === 'fish' ? ` ×${nf}` : ''}</div>`).join('');
    if (B.mode === 'msg') { const [who, t] = B.msgs[0]; $('.msg').innerHTML = `${who ? `<div class="who">${who}</div>` : ''}<div>${t}</div><span class="more">▼</span>`; }
    else $('.msg').innerHTML = `<div class="who">WHAT WILL GOOBLES DO?</div><div>${MOVES[B.sel].blurb}</div>`;
  }

  // ---------- the choice ----------
  const CHOICES = [{ id: 'deal', name: 'FISH DEAL', blurb: '3 fish a week in a bucket at the cave mouth. John returns every hen and stops stealing.' }, { id: 'free', name: 'FREE TUESDAY', blurb: 'Untie the knots and take Tuesday home. On your head, apparently.' }];
  function openChoice() {
    S.choice = { sel: 0 }; ov.classList.add('on'); document.body.classList.add('menu'); renderChoice();
  }
  function renderChoice() {
    $('.bars').style.display = 'none';
    $('.cmds').innerHTML = CHOICES.map((c, i) => `<div class="cmd${i === S.choice.sel ? ' sel' : ''}" data-i="${i}">${c.name}</div>`).join('');
    $('.msg').innerHTML = `<div class="who">WHAT'S THE DEAL?</div><div>${CHOICES[S.choice.sel].blurb}</div>`;
  }
  function pickChoice() {
    const c = CHOICES[S.choice.sel]; S.choice = null; ov.classList.remove('on'); document.body.classList.remove('menu'); Sfx.blip(700);
    if (c.id === 'deal') say(DEAL, () => finish('deal'));
    else say(KNOT_INTRO, () => startKnots());
  }

  // ---------- the knots: a timing bar, three knots ----------
  function startKnots() {
    S.knots = { n: 0, x: 0, dir: 1, sp: 0.75, zone: [0.62, 0.8], miss: 0 };
    ov.classList.add('on'); document.body.classList.add('menu');
    $('.bars').style.display = 'none'; $('.cmds').innerHTML = '<div class="cmd sel">PULL</div>';
    renderKnots();
  }
  function renderKnots() {
    const K = S.knots; if (!K) return;
    if (!K.el) { $('.msg').innerHTML = `<div class="who">UNTIE THE KNOTS</div><div class="kt"></div><div class="knot"><div class="zone"></div><div class="mk"></div></div>`; K.el = $('.knot'); }
    $('.kt').textContent = `Knot ${K.n + 1} of 3. ${isTouch ? 'Tap' : 'Press E'} when the marker is in the gold.${K.miss ? ' Tuesday clucks impatiently.' : ''}`;
    const z = K.el.querySelector('.zone'); z.style.left = `${K.zone[0] * 100}%`; z.style.width = `${(K.zone[1] - K.zone[0]) * 100}%`;
    K.el.querySelector('.mk').style.left = `${K.x * 100}%`;
  }
  function pullKnot() {
    const K = S.knots;
    if (K.x >= K.zone[0] - 0.01 && K.x <= K.zone[1] + 0.01) {
      K.n++; Sfx.pickup(); K.miss = 0;
      if (K.n >= 3) { S.knots = null; ov.classList.remove('on'); document.body.classList.remove('menu'); return say(FREED, () => finish('free')); }
      const w = 0.16 - K.n * 0.03, c = 0.22 + ((K.n * 0.37) % 0.6); K.zone = [c, c + w]; K.sp += 0.25;
    } else { K.miss++; Sfx.blip(180); }
    renderKnots();
  }
  function updateKnots(dt) {
    const K = S.knots; if (!K) return;
    K.x += K.dir * K.sp * dt; if (K.x > 1) { K.x = 1; K.dir = -1; } if (K.x < 0) { K.x = 0; K.dir = 1; }
    if (K.el) K.el.querySelector('.mk').style.left = `${K.x * 100}%`;
  }

  function finish(how) {
    const g = gh(); if (g) g.talking = false;
    if (how === 'deal') { SV.hens = 6; SV.weekStart = SV.day | 0; SV.bucket = 0; setStage('deal'); toast('The Missing Hens: done. John will put the hens back tonight. 3 fish a week, bucket by the torch post.', 5); }
    else { SV.onHead = 1; setStage('freed'); toast('The Missing Hens: done. Tuesday is riding on your head now.', 4.5); }
    SV.wand = 1; store();
    addCash(150); Sfx.jingle && Sfx.jingle();
    S.wandToast = true;
    if (quests && quests.track) quests.track(null);
  }

  // ---------- per frame ----------
  let firstT = 0;
  function update(dt) {
    S.t += dt; const t = G.time || 0;
    if (!S.built) { firstT += dt; if (firstT > 0.06) { try { buildCoop(); buildTrail(); } catch (e) { console.error('[hens] build failed', e); S.built = true; } } }
    trackClock();
    const inside = !!INTM.current();
    const dc = dist(COOP.x, COOP.z);
    coop.visible = !inside && dc < 90;
    if (coop.visible && dc < 60) updateHens(dt);
    // first look at the coop, and the morning news
    if (!inside && !P.car && dc < 12 && !G.dialog && !S.battle) {
      if (!SV.seen) { if (dc < 7) { SV.seen = 1; store(); toast(FIRST_COOP, 5); } }
      else if (SV.news && SV.stage === 'none') startQuest();
      else if (SV.news === 1 && (SV.stage === 'clues' || SV.stage === 'cave')) { SV.news = 0; store(); toast(`Another hen gone. ${SV.hens} left. More glowing feathers by the latch.`, 3.5); }
      else if (SV.news === 2) { SV.news = 0; store(); say([['', `A hen is missing. ${SV.hens} left. Pinned to the coop: "NO FISH THIS WEEK :( SORRY. A GHOST HAS NEEDS. - J"`]]); }
      else if (SV.paidNews) { SV.paidNews = 0; store(); toast('A note on the coop: "FISH RECEIVED. YOU ARE THE BEST CAT. - J"', 3.5); }
    }
    if (S.readyPending && !G.dialog) { S.readyPending = false; say(READY); }
    if (S.wandToast && !G.dialog) { S.wandToast = false; toast('Got the FEATHER WAND. Your paw sparkles now. That\'s all it does. It\'s great.', 4); }
    if (cave && cave.lair && cave.lair.hen) cave.lair.hen.visible = !(SV.stage === 'deal' || SV.stage === 'freed');
    // feather trail
    const showTrail = !inside && (SV.stage === 'clues' || SV.stage === 'cave');
    for (const m of trailGroups) m.visible = showTrail && Math.abs(P.x - m.userData.c.x) < 70 && Math.abs(P.z - m.userData.c.z) < 70;
    if (showTrail && SV.stage === 'clues' && !SV.clues.trail && !P.car) { for (let i = 5; i < trail.length; i++) if (dist(trail[i].x, trail[i].z) < 2.6) { toast(CLUES.trail.toast, 3.5); giveClue('trail'); break; } }
    // bucket
    bucket.visible = SV.stage === 'deal' && !inside && dist(BUCKET.x, BUCKET.z) < 120;
    if (bucket.visible) bucket.userData.fish.forEach((f, i) => { f.visible = i < (SV.bucket | 0); });
    // Tuesday and the wand
    tues.visible = !!(SV.onHead && SV.stage === 'freed');
    if (tues.visible) { tues.rotation.y = Math.sin(t * 0.8) * 0.5; tues.position.y = 0.27 + (fishing && fishing.S && fishing.S.wearHat && fishing.S.hat ? 0.08 : 0); }
    wand.visible = !!SV.wand && !P.car;
    if (wand.visible) { const k = 0.07 + 0.03 * Math.abs(Math.sin(t * 3.3)); wand.scale.setScalar(k); wand.material.rotation = t * 1.5; }
    // stakeout, then John watching at night
    updateOutdoorGhost(dt, t, inside);
    // battle: freeze the cat and flash the ghost when hit
    if (S.battle || S.knots || S.choice) {
      P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.25);
      const B = S.battle, g = gh();
      if (g) { g.talking = true; g.state = 'haunt'; }
      if (B && B.flash > 0 && cave && cave.ghost) { B.flash -= dt; ghostAlpha(cave.ghost, Math.sin(B.flash * 60) > 0 ? 0.25 : 1); }
      if (!INTM.current() && (B || S.choice)) { /* left the lair somehow: drop the fight */ S.battle = null; S.choice = null; ov.classList.remove('on'); document.body.classList.remove('menu'); }
    }
    updateKnots(dt);
  }
  function updateOutdoorGhost(dt, t, inside) {
    const c = G.clock || 0, night = c >= 21 || c < 5;
    // the stakeout: be near the coop between 1:30 and 3 a.m. while the thefts are going on
    if (!S.stake && !inside && (SV.stage === 'clues' || SV.stage === 'cave') && c >= 1.5 && c < 3 && SV.nightDone !== SV.day + 1 && SV.hens > 2 && !P.car && dist(COOP.x, COOP.z) < 18 && !G.dialog) {
      S.stake = { t: 0 }; SV.nightDone = SV.day + 1; store();   // tonight's theft happens in front of you instead of at 3:00
      og.position.set(COOP.x - 2.5, heightAt(COOP.x, COOP.z), COOP.z - 2.5); og.visible = true;
      toast('Humming. Off-key. Something is floating toward the coop...', 3.5); Sfx.blip(300);
    }
    if (S.stake) {
      const k = S.stake; k.t += dt;
      const tgt = k.t < 4 ? { x: COOP.x, z: COOP.z + 1.1 } : trail[Math.min(trail.length - 1, Math.floor((k.t - 4) * 0.8))];
      const dx = tgt.x - og.position.x, dz = tgt.z - og.position.z, d = Math.hypot(dx, dz);
      if (d > 0.1) { const st = Math.min(d, dt * (k.t < 4 ? 1.3 : 3.2)); og.position.x += dx / d * st; og.position.z += dz / d * st; og.rotation.y = Math.atan2(dx, dz); }
      og.position.y = heightAt(og.position.x, og.position.z);
      if (k.t >= 4 && !k.took) { k.took = 1; SV.hens--; store(); toast('He scoops up a hen, cradles her like a baby, and drifts off west. Toward the Hollow Woods.', 4.5); giveClue('stakeout'); }
      ghostAlpha(og, clamp(k.t / 1.2, 0, 1) * clamp((12 - k.t) / 1.5, 0, 1) * 0.95);
      animGhost(og, t, k.t < 4 ? 'float' : 'wave');
      if (k.t > 12) { S.stake = null; og.visible = false; }
      return;
    }
    // part A done: John watches the RV from the tree line at night, and vanishes if you walk up to him
    const w = S.watch, want = !inside && night && (SV.stage === 'deal' || SV.stage === 'freed') && dist(WATCH.x, WATCH.z) < 60;
    const close = dist(WATCH.x, WATCH.z) < 7;
    w.a = clamp(w.a + dt * (want && !close ? 0.5 : -2), 0, 1);
    og.visible = w.a > 0.01;
    if (og.visible) {
      og.position.set(WATCH.x, heightAt(WATCH.x, WATCH.z), WATCH.z); og.rotation.y = Math.atan2(places.rv.x - WATCH.x, places.rv.z - WATCH.z);
      ghostAlpha(og, w.a * 0.8); animGhost(og, t, 'wave');
      if (close && !S.watchSeen) { S.watchSeen = true; toast('...was that John? He waved. He always waves.', 3); }
    }
  }

  // ---------- debug ----------
  Object.assign(api, {
    update, prompt, interact, COOP, BUCKET, trail, coop, og, tues, wand,
    reset() { SV = fresh(); store(); S.battle = S.knots = S.choice = S.stake = null; ov.classList.remove('on'); },
    stage(st) { SV.stage = st; store(); return SV.stage; },
    clue(id) { giveClue(id); return clueCount(); },
    night() { onNight(); return { day: SV.day, hens: SV.hens, stage: SV.stage }; },
    tp() { P.x = COOP.x + 0.8; P.z = COOP.z + 3.4; P.y = 0; P.yaw = Math.PI; return { x: P.x, z: P.z }; },
    battle: startBattle, choose(id) { if (!S.choice) openChoice(); S.choice.sel = id === 'free' ? 1 : 0; pickChoice(); },
    win() { if (S.battle) { S.battle.j = 0; S.battle.msgs = [['', 'Debug win.']]; S.battle.after = 'win'; S.battle.mode = 'msg'; renderBattle(); } },
    move: (id) => { const i = MOVES.findIndex((m) => m.id === id); if (S.battle && i >= 0) { S.battle.sel = i; S.battle.mode = 'menu'; confirm(); } },
    knotHit() { const K = S.knots; if (!K) return false; K.x = (K.zone[0] + K.zone[1]) / 2; pullKnot(); return true; },
    state: () => ({ stage: SV.stage, hens: SV.hens, clues: Object.keys(SV.clues), day: SV.day, battle: S.battle ? { j: S.battle.j, mode: S.battle.mode, after: S.battle.after } : null, choice: !!S.choice, knots: S.knots ? S.knots.n : null, wand: !!SV.wand, onHead: !!SV.onHead, bucket: SV.bucket | 0, stake: !!S.stake }),
  });
  window.__HENS = api;
  return api;
}
