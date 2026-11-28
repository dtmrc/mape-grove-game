// Odd jobs board (diet 2026-11-28, option 2 "jobs and money loop"): a cork board by the RV with repeatable paid shifts.
// Every shift is an ordinary MISSIONS entry (game.js HUD, timer, quest log tracking, endMission banner), started from a
// fishing.menu() list at the board:
//   Pizza Run   - pick up at Pizza City, deliver to a house before the timer; pay = base + time left, minus car damage
//   Lawn Duty   - mow ten tall tufts on an Estates lawn before Sharique comes out with the tape measure
//   Tow Rescue  - drive a neighbor's ticketed car out of the Estates to your RV lot before the HOA tow truck shows up
// Work reputation: every 4 shifts done adds 10% to the pay (max +50%); 3 passed shifts in a row = $50 shift bonus.
// The cash feeds the HOA fines (hoastory.js), clothes (wardrobe.js) and later upgrades.
// Later: ambulance / fire engine / tractor shifts once ems.js (the service vehicles) is on main (checked at runtime).
// Own save key (mg-oddjobs-v1). Wired in game.js next to hoastory. Debug: window.__G.oddjobs (S, start(id), open()).
import * as THREE from 'three';
import { districtAt } from './world.js';

export const ODDJOBS_ENABLED = true;
export const ODDJOBS_KEY = 'mg-oddjobs-v1';

const NAMES = ['the Hendersons', 'the Pattersons', 'Mrs. Ortega', 'the Nguyens', 'the Kowalskis', 'Mr. Abernathy', 'the Okafors', 'Dr. Lindqvist'];
const TIERS = ['NEW GUY', 'RELIABLE', 'GO-TO CAT', 'LOCAL HERO', 'LEGEND', 'MYTH'];

export function makeOddJobs(ctx) {
  const { scene, G, P, places, cars, MISSIONS, spawnCar, setCheck, objective, toast, addHeat, startMission, endMission, fishing, quests, Sfx, T, isTouch, px, pz } = ctx;
  const mission = () => ctx.mission();
  const key = isTouch ? 'USE' : 'E';
  const S = { done: 0, streak: 0, earned: 0, best: {} };
  try { Object.assign(S, JSON.parse(localStorage.getItem(ODDJOBS_KEY) || '{}') || {}); } catch (e) { /* storage blocked */ }
  const persist = () => { try { localStorage.setItem(ODDJOBS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
  const tier = () => Math.min(5, Math.floor(S.done / 4));
  const mult = () => 1 + tier() * 0.1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const wx = () => px(), wz = () => pz();
  const speed = () => (P.car ? Math.abs(P.car.speed || 0) : 0);

  // ---------- the board ----------
  const RV = places.rv;
  const BOARD = { x: RV.x - 5.6, z: RV.z + 4.4 };
  {
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x6a4a2e });
    for (const s of [-0.62, 0.62]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), wood); p.position.set(s, 0.85, 0); g.add(p); }
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const c = cv.getContext('2d');
    c.fillStyle = '#b8864e'; c.fillRect(0, 0, 128, 96); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 260; i++) c.fillRect(Math.random() * 128, Math.random() * 96, 1, 1);
    c.fillStyle = '#1e2a44'; c.font = 'bold 15px monospace'; c.textAlign = 'center'; c.fillText('ODD JOBS', 64, 16);
    const notes = [['#fff6a0', 'PIZZA'], ['#a0e0ff', 'LAWNS'], ['#ffb0c0', 'TOW'], ['#ffffff', 'CASH']];
    notes.forEach(([col, t], i) => { const x = 8 + (i % 2) * 60, y = 24 + Math.floor(i / 2) * 34; c.fillStyle = col; c.fillRect(x, y, 52, 28); c.fillStyle = '#c03030'; c.fillRect(x + 24, y + 2, 4, 4); c.fillStyle = '#222'; c.font = '11px monospace'; c.fillText(t, x + 26, y + 20); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
    const face = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.06), [wood, wood, wood, wood, new THREE.MeshLambertMaterial({ map: tex }), wood]);
    face.position.y = 1.35; g.add(face);
    g.position.set(BOARD.x, 0, BOARD.z); g.rotation.y = Math.atan2(RV.x - 2 - BOARD.x, RV.z + 9 - BOARD.z); scene.add(g);
    S.board = g;
  }

  // ---------- helpers ----------
  const estates = () => places.drives.filter((d) => districtAt(d.x, d.z) === 'Maple Grove Estates');
  const lawnOf = (d) => ({ x: d.x + Math.cos(d.ry) * 3.6 - Math.sin(d.ry) * 3, z: d.z - Math.sin(d.ry) * 3.6 - Math.cos(d.ry) * 3, yaw: d.ry });
  function pay(m, base, note) {
    const amt = Math.round(base * mult());
    m.reward = amt; S.done++; S.streak++; S.earned += amt; persist();
    let bonus = 0;
    if (S.streak % 3 === 0) { bonus = 50; ctx.addCash(bonus); }
    const tUp = S.done % 4 === 0 && tier() <= 5 && S.done / 4 <= 5;
    endMission(true, note);
    setTimeout(() => { if (bonus) toast(`Shift bonus: three in a row! +$${bonus}`, 3.5); else if (tUp) toast(`Work rep: ${TIERS[tier()]}. Shifts now pay +${tier() * 10}%.`, 4); }, 0);
  }
  function fail(msg) { S.streak = 0; persist(); endMission(false, msg); }

  // ---------- shifts ----------
  const shop = () => places.pizza ? { x: places.pizza.x + Math.sin(places.pizza.yaw) * 4.5, z: places.pizza.z + Math.cos(places.pizza.yaw) * 4.5 } : { x: 0, z: 0 };
  const JOBS = {
    pizzarun: {
      title: 'Pizza Run', base: 45, blurb: 'Vinnie needs a driver. Pick up at Pizza City, deliver before it\'s cold. Faster = bigger tip. Dents come out of your pay.',
      make: () => ({
        id: 'pizzarun', title: 'Pizza Run', reward: 45,
        start() { this.stage = 'pickup'; const s = shop(); setCheck(s.x, s.z, 3, 'Pizza City'); objective('Pick up the order at Pizza City. Any ride will do.'); },
        update(dt) {
          if (this.stage === 'pickup') {
            const s = shop();
            if (Math.hypot(wx() - s.x, wz() - s.z) < 4.5 && speed() < 6) {
              const far = places.drives.filter((d) => Math.hypot(d.x - s.x, d.z - s.z) > 60);
              const d = pick(far.length ? far : places.drives);
              this.to = { x: d.x, z: d.z, who: pick(NAMES) }; this.stage = 'deliver';
              const L = Math.hypot(d.x - s.x, d.z - s.z); this.timer = Math.round(25 + L / 7); this.t0 = this.timer;
              this.hp0 = P.car ? P.car.hp : null; this.car = P.car || null;
              setCheck(d.x, d.z, 3, this.to.who); Sfx.blip(880);
              toast(`Vinnie: "Large pepperoni for ${this.to.who}. Go go go."`, 3);
            }
            return;
          }
          this.timer -= dt;
          if (this.timer <= 0) return fail(`The pizza went cold. ${this.to.who} ordered from somewhere else.`);
          objective(`Deliver the pizza to ${this.to.who}.`);
          if (G.check && !G.check.blipOnly) G.check.hint = P.car && speed() >= 6 && Math.hypot(wx() - this.to.x, wz() - this.to.z) < 18 ? 'SLOW DOWN' : '';
          if (Math.hypot(wx() - this.to.x, wz() - this.to.z) < 4.5 && speed() < 6) {
            const tip = Math.min(30, Math.round(this.timer * 0.8));
            const dent = this.car && this.car === P.car && this.hp0 !== null ? Math.max(0, Math.round((this.hp0 - this.car.hp) / 2)) : 0;
            pay(this, Math.max(15, 45 + tip - dent), `${this.to.who}: "Still hot!"${tip ? ` (tip $${tip})` : ''}${dent ? ` (-$${dent} for the dents)` : ''}`);
          }
        },
      }),
    },
    lawnduty: {
      title: 'Lawn Duty', base: 40, blurb: 'An Estates neighbor is terrified of Sharique\'s tape measure. Run over all ten tall tufts on their lawn before he comes out to measure.',
      make: () => ({
        id: 'lawnduty', title: 'Lawn Duty', reward: 40,
        start() {
          const d = pick(estates().length ? estates() : places.drives); this.lawn = lawnOf(d); this.who = pick(NAMES);
          this.stage = 'go'; setCheck(this.lawn.x, this.lawn.z, 3, `${this.who}' lawn`);
          objective(`Get to ${this.who}' lawn in the Estates.`);
        },
        tufts() {
          const L = this.lawn, cy = Math.cos(L.yaw), sy = Math.sin(L.yaw);
          const geo = new THREE.ConeGeometry(0.22, 0.6, 4); geo.translate(0, 0.3, 0);
          const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x4a8a2a }), 10);
          this.pts = [];
          const m4 = new THREE.Matrix4();
          const free = (x, z) => !ctx.blocked || [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].every(([u, v]) => !ctx.blocked(x + u, 0.5, z + v));
          for (let i = 0, tries = 0; i < 10; tries++) {
            const sp = tries > 200 ? 2 : 1, a = rnd(-3, 3) * sp, b = rnd(-2.5, 2.5) * sp, x = L.x + a * cy + b * sy, z = L.z - a * sy + b * cy;
            if (tries < 400 && !free(x, z)) continue;
            this.pts.push({ x, z, cut: false }); m4.makeTranslation(x, 0, z); im.setMatrixAt(i++, m4);
          }
          im.userData.noLift = false; scene.add(im); this.im = im;
        },
        update(dt) {
          if (this.stage === 'go') {
            if (Math.hypot(wx() - this.lawn.x, wz() - this.lawn.z) < 6) { this.stage = 'mow'; this.timer = 45; this.cut = 0; this.tufts(); ctx.checkOff(); Sfx.blip(880); toast('Run over every tall tuft! Sharique comes out in 45 seconds.', 3.5); }
            return;
          }
          this.timer -= dt;
          if (this.timer <= 0) return fail('Sharique measured the lawn: 3.4 inches. The neighbor got a violation. And so did you, somehow.');
          const m4 = new THREE.Matrix4();
          for (let i = 0; i < this.pts.length; i++) {
            const p = this.pts[i]; if (p.cut) continue;
            if (Math.hypot(wx() - p.x, wz() - p.z) < (P.car ? 1.7 : 1.0)) { p.cut = true; this.cut++; m4.makeScale(1, 0.15, 1).setPosition(p.x, 0, p.z); this.im.setMatrixAt(i, m4); this.im.instanceMatrix.needsUpdate = true; Sfx.swing ? Sfx.swing() : Sfx.blip(600); }
          }
          const left = this.pts.filter((p) => !p.cut);
          if (!left.length) return pay(this, 40, 'Sharique measures it: 2.9 inches. He looks almost disappointed.');
          const n = left.sort((a, b) => Math.hypot(a.x - wx(), a.z - wz()) - Math.hypot(b.x - wx(), b.z - wz()))[0];
          G.check = { x: n.x, z: n.z, r: 1, blipOnly: true, label: 'Tuft', col: '#7fe07f' };
          objective(`Mow ${this.who}' lawn. (${this.cut}/10)`);
        },
        cleanup() { if (this.im) { scene.remove(this.im); this.im.geometry.dispose(); this.im.material.dispose(); } },
      }),
    },
    towrescue: {
      title: 'Tow Rescue', base: 60, blurb: 'The HOA is towing a neighbor\'s car for "parking with intent". Drive it to your RV lot before the tow truck gets there. The HOA won\'t like it.',
      make: () => ({
        id: 'towrescue', title: 'Tow Rescue', reward: 60,
        start() {
          const d = pick(estates().length ? estates() : places.drives); this.who = pick(NAMES);
          const busy = cars.find((c) => !c.dead && Math.hypot(c.x - d.x, c.z - d.z) < 3);
          this.car = busy && !busy.role && busy.driver !== 'player' && busy.type !== 'golfcart' ? busy : spawnCar(pick(['sedan', 'hatch', 'wagon']), d.x, d.z, d.ry, {});
          this.car.role = 'tow'; this.stage = 'car'; this.timer = 120; this.drop = { x: RV.x + 4, z: RV.z + 10 };
          objective(`Get in ${this.who}' car before the HOA tow truck arrives.`);
        },
        update(dt) {
          const c = this.car;
          if (c.dead) return fail('The car is scrap. The HOA tows it anyway, out of spite.');
          this.timer -= dt;
          if (this.timer <= 0) return fail('The HOA tow truck got there first. Gary Kim waves the paperwork at you from the cab.');
          if (P.car !== c) {
            ctx.checkOff(); G.check = { x: c.x, z: c.z, r: 1, blipOnly: true, label: `${this.who}' car`, col: '#ffd23f' };
            objective(this.stage === 'car' ? `Get in ${this.who}' car before the HOA tow truck arrives.` : `Get back in ${this.who}' car!`);
            return;
          }
          if (this.stage === 'car') { this.stage = 'drive'; this.hp0 = c.hp; setCheck(this.drop.x, this.drop.z, 4, 'Your RV lot'); if (Math.random() < 0.5) addHeat(1, 'obstructing an HOA tow'); }
          else if (!G.check || G.check.blipOnly) setCheck(this.drop.x, this.drop.z, 4, 'Your RV lot');
          objective(`Drive ${this.who}' car to your RV lot. The HOA can't tow what's already on Lot 1.`);
          if (Math.hypot(c.x - this.drop.x, c.z - this.drop.z) < 5 && speed() < 4) {
            const dent = Math.max(0, Math.round((this.hp0 - c.hp) / 2));
            pay(this, Math.max(20, 60 - dent), `${this.who}: "My car! You beautiful cat."${dent ? ` (-$${dent} for the dents)` : ''}`);
          }
        },
        cleanup() { if (this.car) this.car.role = null; },
      }),
    },
  };
  for (const [id, j] of Object.entries(JOBS)) MISSIONS[id] = j.make;

  function open() {
    if (!fishing || !fishing.menu) return false;
    return fishing.menu({
      title: `Odd Jobs · ${TIERS[tier()]}`,
      items: () => Object.entries(JOBS).map(([id, j]) => ({ id, label: j.title, price: `$${Math.round(j.base * mult())}+`, blurb: `${j.blurb}${S.done ? ` (Shifts done: ${S.done}. Streak: ${S.streak}.)` : ''}`, dim: !!mission() })),
      pick: (it) => {
        if (!JOBS[it.id]) return;
        if (mission()) { Sfx.blip(180); toast('Finish what you\'re doing first.', 2.5); return; }
        fishing.close && fishing.close();
        startMission(MISSIONS[it.id]()); Sfx.blip(760);
      },
    });
  }

  // ---------- quest log entry ----------
  const Q = {
    id: 'oddjobs', kind: 'side', title: 'Odd Jobs', giver: 'the odd jobs board', where: 'your RV lot', reward: 45,
    blurb: 'Pizza runs, lawns and tow rescues, any time. Pay goes up with your work rep, and three in a row earns a bonus. Good for paying HOA fines.',
    status: () => (mission() && JOBS[mission().id] ? 'active' : 'open'),
    guide: () => (mission() && JOBS[mission().id] ? { obj: G.objRaw || '', check: G.check } : { obj: 'Check the odd jobs board by your RV.', check: Math.hypot(wx() - BOARD.x, wz() - BOARD.z) > 3.5 ? { x: BOARD.x, z: BOARD.z, r: 2.5, label: 'Jobs board', col: '#ffd23f' } : null }),
  };
  if (quests) { const reg = quests.register || quests.add; if (reg) reg.call(quests, Q); }

  const nearBoard = () => !P.car && !G.dialog && !G.paused && !mission() && Math.hypot(P.x - BOARD.x, P.z - BOARD.z) < 1.8;
  const api = {
    S, JOBS, BOARD, open, tier, mult,
    prompt: () => (ODDJOBS_ENABLED && nearBoard() ? `${key}: Check the odd jobs board` : ''),
    interact: () => { if (!ODDJOBS_ENABLED || !nearBoard()) return false; open(); return true; },
    start: (id) => { if (mission() || !JOBS[id]) return false; startMission(MISSIONS[id]()); return true; },
  };
  return api;
}
