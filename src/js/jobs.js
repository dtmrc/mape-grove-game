// Replayable missions, side jobs and the post-game beat for Maple Grove: Off Leash (plan M6).
// - The four story missions can be run again for half pay once G.done[id] is set (talkTo goes through jobs.talk first);
//   the Slurpee Sprint keeps a best time in G.best.kids.
// - Side jobs are extra MISSIONS entries with their own giver markers: "Fish Order" (Rosie's door), "Repo Man" (Nana,
//   after the casserole run) and "Sign Language" (the Quik Stop kids, after the race). They never stay in G.done, so
//   they can be taken again; completions count in G.jobs.
// - Passing "Final Notice": banner THE RV STAYS, an HOA truce (G.hoaTruce = G.time stamp when it ends; game.js
//   updateHeat skips spawnPatrol until then), Gary's done line changes and a FOR SALE sign goes up on his lawn.
// Own save key (best times, job counts, truce, sign). Wired by game.js: makeJobs(...), jobs.update(dt), jobs.talk(id).
// Debug: window.__G.jobs.S, .start('fish'), .run('kids', true)
import * as THREE from 'three';
import { basic, lambert, mat } from './gfx.js';
import { districtAt } from './world.js';

const KEY = 'maple-grove-offleash-jobs-v1';
const STORY = ['nana', 'kids', 'ricky', 'gary'];
const SIDE = ['fish', 'repo', 'signs'];
const TRUCE = 24 * 60;   // 24 game hours in real seconds
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 10))}`;

export function makeJobs(A) {
  const { MISSIONS, INTROS, DONE_LINES, spawnCar, setCheck, objective, toast, banner, addHeat, places, cars, P, G, fishing, NPC, giverMarks, makeMarker, say, startMission, endMission, scene, T, Sfx, ahead } = A;
  const mission = () => A.mission();
  const S = { best: {}, jobs: {}, truceLeft: 0, forsale: false, pendingBanner: 0, saveT: 0, props: [] };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { S.best = s.best || {}; S.jobs = s.jobs || {}; S.truceLeft = s.truceLeft || 0; S.forsale = !!s.forsale; } } catch (e) { /* storage blocked */ }
  G.best = S.best; G.jobs = S.jobs;
  if (S.truceLeft > 0) G.hoaTruce = G.time + S.truceLeft;
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ best: S.best, jobs: S.jobs, truceLeft: Math.max(0, (G.hoaTruce || 0) - G.time), forsale: S.forsale })); } catch (e) { /* ignore */ } };
  const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;

  // ---------- props: HOA lawn signs and Gary's FOR SALE sign ----------
  const post = new THREE.BoxGeometry(0.05, 0.9, 0.05), board = new THREE.PlaneGeometry(0.9, 0.55);
  const postMat = mat(0x3a3a3a), signTex = {};
  function signProp(text, bg, fg, x, z, yaw, scale = 1) {
    const k = text + bg; signTex[k] = signTex[k] || T.sign(text, bg, fg, 256, 128);
    const g = new THREE.Group();
    const p = new THREE.Mesh(post, postMat); p.position.y = 0.45 * scale; p.scale.setScalar(scale); g.add(p);
    const b = new THREE.Mesh(board, lambert({ map: signTex[k], side: THREE.DoubleSide })); b.position.y = 0.95 * scale; b.scale.setScalar(scale); g.add(b);
    g.position.set(x, 0, z); g.rotation.y = yaw; scene.add(g);
    return g;
  }
  let forsale = null;
  function putForSale() {
    if (forsale || !places.gary) return;
    const at = ahead(places.gary, 3.4, 4.2);
    forsale = signProp('FOR SALE', '#ffffff', '#c03030', at.x, at.z, places.gary.yaw, 1.5);
    const sub = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), basic({ map: T.sign('BY OWNER. MOTIVATED.', '#1e2a44', '#ffffff', 256, 64), side: THREE.DoubleSide })); sub.position.y = 0.95; forsale.add(sub);
  }
  if (S.forsale || G.done.gary) { S.forsale = true; putForSale(); }

  // ---------- giver markers ----------
  const dinerDoor = { x: 29.5, z: 13.77, yaw: Math.PI };   // interiors.js builtinEntries: Rosie's front door, opens to -z
  giverMarks.fish = makeMarker('mission', dinerDoor.x, dinerDoor.z - 3.1);
  { const m = ahead(places.nana, 4.0, -4.8); giverMarks.repo = makeMarker('mission', m.x, m.z); }   // on the lawn, clear of the porch windows
  { const m = ahead(places.quik, 3.0, 5.6); giverMarks.signs = makeMarker('mission', m.x, m.z); }   // forecourt corner, clear of the door and the pumps
  const available = { fish: () => true, repo: () => !!G.done.nana, signs: () => !!G.done.kids };
  const marks = { fish: giverMarks.fish, repo: giverMarks.repo, signs: giverMarks.signs }, markYaw = { fish: 0, repo: places.nana.yaw, signs: places.quik.yaw };   // tests: where to look at each marker from

  // ---------- side jobs ----------
  const hoaCart = () => cars.find((c) => c.type === 'golfcart' && !c.dead && !c.repo && !c.role && c.driver !== 'player' && Math.hypot(c.x - places.hoaLot.x, c.z - places.hoaLot.z) < 14);
  // a lawn spot beside each Estates driveway: 3.6 m to the side of the parked-car spot and 3 m back from the street
  const estatesLawns = () => places.drives.filter((d) => districtAt(d.x, d.z) === 'Maple Grove Estates').map((d) => ({ x: d.x + Math.cos(d.ry) * 3.6 - Math.sin(d.ry) * 3, z: d.z - Math.sin(d.ry) * 3.6 - Math.cos(d.ry) * 3, yaw: d.ry }));
  const SIGN_TEXT = [['NO CATS', '#1e2a44', '#ffffff'], ['MOW IT', '#ffffff', '#1e2a44'], ['BYLAW 14-C', '#c03030', '#ffffff'], ['NO FUN', '#1e2a44', '#ffffff'], ['HOA KNOWS', '#ffffff', '#c03030'], ['KEEP OFF', '#2050a0', '#ffffff']];
  Object.assign(MISSIONS, {
    fish: () => ({
      id: 'fish', title: 'Fish Order', reward: 90,
      start() { this.stage = ''; this.check(); },
      have() { return fishing.countFish('catfish') >= 1 || fishing.countFish('bass') >= 3; },
      check() {
        const ok = this.have(), st = ok ? 'return' : 'fish'; if (st === this.stage) return; this.stage = st;
        if (ok) { setCheck(dinerDoor.x, dinerDoor.z - 2, 3, "Rosie's Diner"); objective("Bring the fish to Rosie's Diner."); }
        else { setCheck(places.dock.x, places.dock.z, 4, 'Lake Juniper dock'); objective(`Catch 3 bass or 1 catfish for Rosie. (bass ${fishing.countFish('bass')}/3 · catfish ${fishing.countFish('catfish')}/1)`); }
      },
      update() {
        this.check(); if (this.stage !== 'fish') return;
        const b = fishing.countFish('bass'), c = fishing.countFish('catfish'); const key = b + ':' + c;
        if (key !== this.key) { this.key = key; objective(`Catch 3 bass or 1 catfish for Rosie. (bass ${b}/3 · catfish ${c}/1)`); }
      },
      done() {   // called from jobs.update when the cat stands at the diner door with the order
        if (fishing.countFish('catfish') >= 1) fishing.removeFish('catfish', 1); else fishing.removeFish('bass', 3);
        endMission(true, 'Rosie: "Catch of the day, courtesy of a cat."');
      },
    }),
    repo: () => ({
      id: 'repo', title: 'Repo Man', reward: 120,
      start() {
        this.cart = hoaCart() || spawnCar('golfcart', places.hoaLot.x - 3, places.hoaLot.z, 0, { color: 0xffffff, canopy: 0x1e2a44, lightbar: true });
        this.taken = false; this.drop = { x: places.rv.x + 4, z: places.rv.z + 3 };
        setCheck(places.hoaLot.x - 3, places.hoaLot.z, 4, 'HOA patrol lot');
        objective("Take the HOA golf cart from the patrol lot in the Estates.");
      },
      update() {
        if (this.cart.dead) return endMission(false, "That's not a golf cart any more. Nana is disappointed.");
        if (!this.taken) {
          if (P.car === this.cart) { this.taken = true; addHeat(1, 'repossessing HOA property'); setCheck(this.drop.x, this.drop.z, 4, "Nana's RV lot"); }
          else G.check = { x: this.cart.x, z: this.cart.z, r: 1, blipOnly: true, label: 'HOA cart', col: '#ffd23f' };
          return;
        }
        if (P.car !== this.cart) objective('Get back in the HOA cart!');
        else objective("Drive the cart to Nana's RV lot. Don't get cited.");
        if (P.car === this.cart && Math.hypot(this.cart.x - this.drop.x, this.cart.z - this.drop.z) < 5 && Math.abs(this.cart.speed) < 2) {
          this.cart.repo = true; G.heat = 0;
          endMission(true, 'Nana: "Park it by the camp chairs. Gary can come ask nicely."');
        }
      },
      cleanup() { G.check = null; },
    }),
    signs: () => ({
      id: 'signs', title: 'Sign Language', reward: 150,
      start() {
        const lawns = estatesLawns().sort(() => Math.random() - 0.5).slice(0, 6);
        this.signs = lawns.map((l, i) => { const t = SIGN_TEXT[i % SIGN_TEXT.length]; const g = signProp(t[0], t[1], t[2], l.x, l.z, l.yaw); const mk = makeMarker('mission', l.x, l.z, 0.5); mk.children[1].visible = false; return { x: l.x, z: l.z, g, mk, alive: true }; });
        this.timer = 180; this.got = 0; this.wasHit = !!P.punchHit;
        objective('Paw 6 HOA lawn signs in the Estates. (0/6)');
      },
      update(dt) {
        if ((this.timer -= dt) <= 0) return endMission(false, "Time's up. The HOA re-staked every sign before dawn.");
        const live = this.signs.filter((s) => s.alive);
        let best = null, bd = 1e9; for (const s of live) { const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; best = s; } }
        if (best && (!G.check || G.check.x !== best.x || G.check.z !== best.z)) setCheck(best.x, best.z, 1, 'HOA sign');
        const hitNow = !!P.punchHit && P.punch > 0;
        if (hitNow && !this.wasHit && !P.car) {
          const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
          for (const s of live) {
            const dx = s.x - P.x, dz = s.z - P.z;
            if (Math.hypot(dx, dz) < 1.6 && dx * fx + dz * fz > -0.2) {
              s.alive = false; scene.remove(s.g); scene.remove(s.mk); this.got++; Sfx.punch(); Sfx.blip(900);
              toast(['Thwack. One sign down.', 'The sign folds like a lawn chair.', 'That one said NO FUN. Not any more.', 'Sign: flattened. Lawn: improved.', 'Crunch. Very satisfying.', 'The last sign. Freedom has a sound.'][Math.min(5, this.got - 1)], 2.5);
              if (this.got === 4) addHeat(2, 'sign vandalism');
              if (this.got >= 6) return endMission(true, 'Six signs down. The Estates look... quieter.');
              objective(`Paw the HOA lawn signs in the Estates. (${this.got}/6)`);
              break;
            }
          }
        }
        this.wasHit = hitNow;
      },
      cleanup() { for (const s of this.signs) { if (s.alive) { scene.remove(s.g); scene.remove(s.mk); } s.alive = false; } G.check = null; },
    }),
  });
  Object.assign(INTROS, {
    fish: [['Rosie', 'Hon, my fish guy quit. Said a cat looked at him funny.'], ['Rosie', "Three bass or one catfish, fresh from Earl's dock. And don't you bring me a boot."]],
    repo: [['Nana', 'Sweetie, Gary towed my garden gnome. In the HOA golf cart.'], ['Nana', "That cart's parked at their little lot in the Estates. Bring it here. We'll call it... borrowing."], ['Nana', "Don't let them catch you. I can't afford another fine on my hip."]],
    signs: [['Quik Stop Kid', "Yo. The HOA put up MORE signs. 'NO SKATING.' 'NO CATS.' 'NO FUN.'"], ['Quik Stop Kid', "Six of 'em, in the Estates. Paw 'em flat. You got three minutes before Gary's guys re-stake."]],
  });
  Object.assign(DONE_LINES, {
    fish: [['Rosie', "Best tuna melt in town. Don't ask what the tuna is."]],
    repo: [['Nana', 'That cart makes a lovely planter.']],
    signs: [['Quik Stop Kid', 'Legendary. The Estates are sign-free. For now.']],
  });
  const REPLAY = { nana: 'Nana', kids: 'Quik Stop Kid', ricky: 'Big Ricky', gary: 'Gary' };
  const GARY_DONE = [['Gary', '...The RV stays. I have listed the house. Pine Hollow has an HOA with STANDARDS.'], ['Gary', 'Do NOT touch the FOR SALE sign.']];
  if (G.done.gary) DONE_LINES.gary = GARY_DONE;

  // ---------- story missions: wrap every factory so passes are seen, whoever started them ----------
  function wrap(m) {
    const u = m.update.bind(m);
    m.update = (dt) => { const c0 = G.cash; u(dt); if (!mission()) onEnd(m, G.cash - c0 >= m.reward); };
    return m;
  }
  for (const id of [...STORY, ...SIDE]) { const f = MISSIONS[id]; MISSIONS[id] = () => wrap(f()); }
  function onEnd(m, pass) {
    if (!pass) return;
    if (m.id === 'kids') {
      const t = Math.max(0, m.t - 3.5), b = S.best.kids;
      S.best.kids = b ? Math.min(b, t) : t; persist();
      setTimeout(() => toast(`Race time ${fmt(t)}.${!b || t < b ? ' New best!' : ` Best ${fmt(b)}.`}`, 4), 1200);
    }
    if (m.id === 'gary') {
      G.hoaTruce = G.time + TRUCE; G.heat = 0; G.seenT = 0;
      S.forsale = true; putForSale(); DONE_LINES.gary = GARY_DONE; persist();
      S.pendingBanner = 4.3;
    }
    if (SIDE.includes(m.id)) { S.jobs[m.id] = (S.jobs[m.id] || 0) + 1; persist(); }
  }

  // ---------- starting and talking ----------
  function run(id, half) { const m = MISSIONS[id](); if (half) m.reward = Math.ceil(m.reward / 2); startMission(m); return m; }
  /** talkTo(id) hook. Returns true when handled (side jobs and replays), false to let game.js do the first run. */
  function talk(id) {
    if (SIDE.includes(id)) { if (mission() || !available[id]()) return true; delete G.done[id]; say(INTROS[id], () => run(id, false)); return true; }
    if (!STORY.includes(id) || !G.done[id] || mission()) return false;
    const who = REPLAY[id], base = MISSIONS[id]().reward;
    say([...DONE_LINES[id], [who, `Run it again? (half pay: $${Math.ceil(base / 2)}${id === 'kids' && S.best.kids ? `, best ${fmt(S.best.kids)}` : ''})`]], () => run(id, true));
    return true;
  }

  function update(dt) {
    if (G.paused) return;
    const m = mission();
    for (const id of SIDE) { if (G.done[id]) delete G.done[id]; giverMarks[id].visible = !m && available[id](); }
    if (m && m.id === 'fish' && m.stage === 'return' && !P.car && near(dinerDoor.x, dinerDoor.z - 1.5, 3.2) && m.have()) { m.done(); onEnd(m, true); }
    if (S.pendingBanner > 0 && (S.pendingBanner -= dt) <= 0) { banner('THE RV STAYS', 'Gary resigned. The HOA patrols stand down for a day.', 5, 'pass'); Sfx.jingle(); }
    if (G.hoaTruce > G.time && (S.saveT += dt) > 10) { S.saveT = 0; persist(); }
  }

  return { S, update, talk, run, start: (id) => run(id, false), persist, marks, markYaw, truce: () => Math.max(0, (G.hoaTruce || 0) - G.time), putForSale, signProp };
}
