// "Best in Show": the Grand National Feline Classic (diet, 2026-11-28: "a professional cat show quest. goobles is to
// compete against top cat talent from across the country in a contest").
//
// A touring cat show sets up round the gazebo on the town green: a judges' table, an entries desk, a banner and bunting.
// Open 9 a.m. to 6 p.m., $50 to enter, one show a day. Goobles takes the stage with four champion cats and plays four
// menu turn-based rounds in the shared story panel (storyui.js), like the John fight:
//   1. GROOMING  lick / fluff / strut / show your outfit (what he wears from Bev's Threads moves each judge) / breathe
//   2. AGILITY   hoop, tunnel, weave poles, seesaw: sprint, careful or show off (risk vs points)
//   3. TALENT    an act (cup off the table, sing, fish trick, fix the wobbly table, the loaf) and a finale
//   4. INTERVIEW three questions from the judges, four answers each
// POISE works like HP: rivals heckle between turns, Tex cheers you on, a yard-cat girlfriend or wife cheers from the
// crowd. At 0 poise Goobles freezes and that round's marks are halved. Three judges mark every round out of 10.
// Prizes: 1st $500 + a trophy by the RV, 2nd $200, 3rd $100 (paid with addCash, so the HOA thread's fines loop sees it).
//
// Performance: the set is one vertex-coloured mesh + one textured mesh (2 draws), built the first time Goobles comes
// near. The three judges (makeHuman) exist only within 60 m in show hours. The rival cats are dressed copies of the
// yard-cat model (yardcats.js makeCatFigures), built when a show starts and disposed when it ends.
// Own save key mg-catshow-v1. Debug / QA: window.__CATSHOW.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, basic } from './gfx.js';
import { makeHuman } from './models.js';
import { makeStoryUI } from './storyui.js';
import { makeCatFigures } from './yardcats.js';
import * as WARD from './wardrobe.js';

export const KEY = 'mg-catshow-v1';
const FEE = 50, PRIZE = [500, 200, 100], OPEN = 9, CLOSE = 18;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const R = (a, b) => a + Math.random() * (b - a);   // only while a show is running
const pick = (a) => a[(Math.random() * a.length) | 0];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;   // about -2..2, sd ~0.67

// ------------------------------------------------------------------ the cast ------------------------------------------------------------------
const MC = 'BUNNY CASTELLANO';
const JUDGES = [
  { id: 'pem', name: 'Judge Pemberton', short: 'PEMBERTON', look: { shirt: 0x2a2c3a, pants: 0x2a2c3a, hair: 0xdcdcdc, glasses: true, wrinkles: true } },
  { id: 'brenda', name: 'Coach Brenda', short: 'BRENDA', look: { shirt: 0xc83030, pants: 0x30303a, hair: 0x3a2a1a, smile: true } },
  { id: 'margo', name: 'Margo Vance', short: 'MARGO', look: { shirt: 0xe060a8, pants: 0x2a2030, hair: 0xf0d070, smile: true } },
];
// skill: mean mark per round [grooming, agility, talent, interview]; bias: per judge [pem, brenda, margo]
const RIVALS = [
  { id: 'reggie', name: 'Sir Reginald Fluffington III', short: 'SIR REGINALD', from: 'Greenwich, Connecticut', look: { fur: 0xf6f0e6, pat: 'solid', eye: 0xff9a30, acc: 'collar', ac: 0xe8c040 },
    skill: [9, 5.8, 6.6, 7], bias: [1, -0.3, -0.6], intro: 'Four-time Best in Show. He has not blinked since 2019.',
    rounds: ['Sir Reginald is brushed by two handlers at once. His coat moves like a shampoo advert.', 'Sir Reginald walks the agility course. Walks. Very slowly. Through the tunnel he refuses to bend.', 'Sir Reginald recites the names of his ancestors. All forty of them.', '"I have never worked a day in my life," says Sir Reginald, proudly.'] },
  { id: 'val', name: 'Valentina', short: 'VALENTINA', from: 'Las Vegas, Nevada', look: { fur: 0xdcb8ac, pat: 'solid', eye: 0x50e0c0, acc: 'pearls', ac: 0xf6e0f0 },
    skill: [7, 6.6, 9, 7.4], bias: [-0.8, 0, 1.4], intro: 'A Sphynx in sequins. Two shows a night on the Strip.',
    rounds: ['Valentina has no fur to groom, so she has herself polished. She gleams.', 'Valentina does the whole course in a sequinned cape. The cape gets stuck on the seesaw.', 'Valentina makes Judge Pemberton\'s pen disappear. It does not come back. He is upset.', 'Valentina answers every question with "Darling," and a long pause.'] },
  { id: 'tex', name: 'Tex', short: 'TEX', from: 'Amarillo, Texas', look: { fur: 0x8e6a48, pat: 'tabby', p2: 0x4a3626, eye: 0xd8b030, acc: 'hat', ac: 0xc8a070 },
    skill: [6.2, 9, 6.4, 7.2], bias: [0, 1.4, 0.2], intro: 'Twenty-two pounds of Maine Coon. Rodeo agility champ, three years running.',
    rounds: ['Tex gets groomed with a curry comb meant for horses. He loves it.', 'Tex clears the hoop, the tunnel and the poles like it\'s nothing, then tips his hat.', 'Tex lassos the MC. Gently. Bunny is a good sport about it.', '"Just happy to be here, ma\'am," says Tex, and he means it.'] },
  { id: 'mochi', name: 'Mochi', short: 'MOCHI', from: 'Seattle, Washington', look: { fur: 0xb8b8c4, pat: 'tuxedo', p2: 0xf2f0ec, eye: 0xffc040, acc: 'bow', ac: 0x60c0ff },
    skill: [7.6, 6.2, 7.2, 8.4], bias: [-0.5, -0.2, 1], intro: 'Scottish Fold. Two million followers. She is filming this.',
    rounds: ['Mochi grooms herself in front of a ring light and reads the comments out loud.', 'Mochi does the course backwards "for the algorithm". The judges are confused but impressed.', 'Mochi does a dance that is trending. Nobody over thirty understands it.', '"Link in bio," says Mochi, to every question.'] },
];
const HECKLE = {
  reggie: [['SIR REGINALD', 'Does it have papers? It looks like it has a PAYCHECK.'], ['SIR REGINALD', 'I can smell motor oil. Is that... you?'], ['SIR REGINALD', 'Who let the help on stage?']],
  val: [['', 'Valentina "accidentally" fires a glitter cannon at Goobles. He is sparkly now, against his will.'], ['VALENTINA', 'Darling. Your aura. It\'s very... beige.']],
  mochi: [['', 'Mochi swings her ring light straight into Goobles\' eyes. "Sorry babe, content."'], ['MOCHI', 'Chat says you look like a dad at a barbecue.']],
  tex: [['TEX', 'Breathe easy, partner. Judges are just folks in chairs.'], ['TEX', 'You\'re doin\' fine. Better than my first show. I ate a judge\'s sandwich.']],
};
const ROUND_NAMES = ['GROOMING', 'AGILITY', 'TALENT', 'INTERVIEW'];
const ROUND_MAX = [10.5, 12, 9, 10];   // a near-perfect round's points: maps to a 10 mark
const OBSTACLES = [
  { name: 'THE HOOP', ok: 'Goobles flies through the hoop', bad: 'Goobles clips the hoop. It rolls away. He watches it go.' },
  { name: 'THE TUNNEL', ok: 'Goobles zips through the tunnel', bad: 'Goobles stops halfway through the tunnel for a little sit. It\'s nice in there.' },
  { name: 'THE WEAVE POLES', ok: 'Goobles weaves the poles clean', bad: 'Goobles weaves, then un-weaves, then knocks a pole over on purpose.' },
  { name: 'THE SEESAW', ok: 'Goobles rides the seesaw down like a pro', bad: 'The seesaw drops. So does Goobles. Gracefully. Mostly.' },
];
// clothes from Bev's Threads, Hank's and the raccoon pelts: [pem, brenda, margo] and a line
const OUTFIT = {
  sweater: { d: [1, 0, 0.5], line: 'Judge Pemberton dabs his eye. "My mother had that sweater."' },
  scarf: { d: [0.2, 0, 0.8], line: 'Margo: "The scarf! Cozy! Rustic! I\'m obsessed."' },
  cap: { d: [-0.8, 0.5, 0], line: 'Judge Pemberton: "A hat. Indoors. On a cat." Coach Brenda gives it a thumbs up.' },
  vest: { d: [-1, 0.4, 0.2], line: 'Margo: "Is this a safety inspection?" Coach Brenda nods with respect.' },
  socks: { d: [0, 0.2, 1], line: 'Margo spots the fish-print socks and gasps with joy.' },
  gloves: { d: [-0.2, 0.6, 0], line: 'Coach Brenda: "Work gloves. That\'s a cat who shows up."' },
  coongloves: { d: [-0.6, 0, 0.6], line: 'Somebody in the crowd whispers "are those... raccoon?"' },
  coonjacket: { d: [-1.5, 0, 1.6], line: 'The crowd gasps at the raccoon-skin jacket. Margo stands up and applauds. Judge Pemberton has to sit down.' },
};

// ------------------------------------------------------------------ geometry ------------------------------------------------------------------
function tint(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function at(g, x, y, z, ry = 0, rx = 0, rz = 0) { if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; }
function merge(list, keepUv = false) { const c = list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (!keepUv && n.attributes.uv) n.deleteAttribute('uv'); return n; }); return mergeGeometries(c, false); }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** Banner + desk sign on one 512x256 canvas: top half the banner, bottom half the entries sign. */
function signTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1c2a5a'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#e8c040'; g.fillRect(0, 6, 512, 5); g.fillRect(0, 117, 512, 5);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f6eed8';
  g.font = 'bold 22px monospace'; g.fillText('THE GRAND NATIONAL', 256, 34);
  g.font = 'bold 44px monospace'; g.fillText('FELINE CLASSIC', 256, 76); g.font = 'bold 15px monospace'; g.fillStyle = '#e8c040'; g.fillText('MAPLE GROVE STOP . BEST IN SHOW $500', 256, 104);
  g.fillStyle = '#f6eed8'; g.fillRect(0, 128, 512, 128); g.fillStyle = '#b02a3a'; g.fillRect(0, 128, 512, 26);
  g.fillStyle = '#f6eed8'; g.font = 'bold 20px monospace'; g.fillText('CAT SHOW ENTRIES', 256, 142);
  g.fillStyle = '#1c2a5a'; g.font = 'bold 30px monospace'; g.fillText('$50 . 9 AM - 6 PM', 256, 186); g.font = 'bold 17px monospace'; g.fillText('ONE SHOW DAILY . ALL BREEDS', 256, 226);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t;
}
function trophyGeo() {
  const p = [], gold = 0xe8b830, dark = 0x6a4a22;
  p.push(tint(at(box(0.5, 0.35, 0.5), 0, 0.175, 0), dark));
  p.push(tint(at(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 8), 0, 0.39, 0), gold));
  p.push(tint(at(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), 0, 0.53, 0), gold));
  p.push(tint(at(new THREE.CylinderGeometry(0.2, 0.08, 0.3, 8), 0, 0.78, 0), gold));
  for (const s of [-1, 1]) p.push(tint(at(new THREE.TorusGeometry(0.08, 0.02, 4, 8, Math.PI), s * 0.2, 0.8, 0, 0, 0, -s * Math.PI / 2), gold));
  p.push(tint(at(box(0.3, 0.1, 0.01), 0, 0.2, 0.255), 0xf0e0b0));
  return merge(p);
}

// ------------------------------------------------------------------ the module ------------------------------------------------------------------
/** ctx = { scene, G, P, cat, places, quests, fishing, yardcats, say, toast, banner, Sfx, addCash, isTouch, mission, inside } */
export function makeCatShow(ctx) {
  const { scene, G, P, places, quests, say, toast, Sfx, addCash, isTouch } = ctx;
  const key = isTouch ? 'USE' : 'E';
  const fresh = () => ({ day: 0, lastShow: -1, entries: 0, wins: 0, best: 0, trophy: 0, purse: 0 });
  let SV = {}; try { SV = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { SV = {}; }
  SV = Object.assign(fresh(), SV);
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) { /* private mode */ } };
  const ui = makeStoryUI({ Sfx, isTouch });
  const S = { built: false, show: null, prevClock: G.clock || 0, judges: null, figs: null, loading: false };
  const api = { S, ui, get SV() { return SV; } };

  // ---------- places: round the gazebo on the town green (gazebo floor top 0.6, radius 4) ----------
  const GR = places.green || { x: -20, z: 26 };
  const L = (lx, lz) => ({ x: GR.x + lx, z: GR.z + lz });
  const STAGE = [-2.6, -1.3, 0, 1.3, 2.6].map((x) => L(x, 1.3));   // Goobles in the middle
  const DESK = L(3.6, 6.4), TABLE = L(0, 7.6);
  const open = () => { const c = G.clock || 0; return c >= OPEN && c < CLOSE; };
  const showsToday = () => SV.lastShow === SV.day;
  const dist = (p) => Math.hypot(P.x - p.x, P.z - p.z);
  const root = new THREE.Group(); root.position.set(GR.x, 0, GR.z); root.visible = false; scene.add(root);

  function build() {
    const p = [], wood = 0x8a5a34, cloth = 0x1c2a5a, gold = 0xe8c040, white = 0xf2ece0, red = 0xb02a3a;
    // judges' table with a navy skirt, three chairs, score cards
    p.push(tint(at(box(4.2, 0.08, 1.0), 0, 0.78, 7.6), white), tint(at(box(4.2, 0.72, 0.04), 0, 0.4, 7.12), cloth), tint(at(box(4.2, 0.08, 0.05), 0, 0.72, 7.1), gold));
    for (const x of [-1.4, 0, 1.4]) {
      p.push(tint(at(box(0.5, 0.06, 0.5), x, 0.48, 8.5), wood), tint(at(box(0.5, 0.6, 0.06), x, 0.8, 8.76), wood));
      for (const [a, b] of [[-0.2, 8.3], [0.2, 8.3], [-0.2, 8.7], [0.2, 8.7]]) p.push(tint(at(box(0.05, 0.46, 0.05), x + a, 0.23, b), wood));
      p.push(tint(at(box(0.3, 0.22, 0.02), x + 0.3, 0.93, 7.3, 0, -0.3), white));
    }
    // banner board on two poles behind the judges
    for (const s of [-1, 1]) p.push(tint(at(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), s * 2.7, 1.7, 9.4), white));
    p.push(tint(at(box(5.3, 1.35, 0.06), 0, 2.75, 9.44), cloth));
    // entries desk with a striped awning
    p.push(tint(at(box(1.6, 0.9, 0.7), 3.6, 0.45, 6.4), wood), tint(at(box(1.7, 0.05, 0.8), 3.6, 0.92, 6.4), white));
    for (const s of [-1, 1]) p.push(tint(at(box(0.05, 2.0, 0.05), 3.6 + s * 0.8, 1.0, 6.85), white));
    for (let k = 0; k < 6; k++) p.push(tint(at(box(0.29, 0.05, 0.9), 3.6 - 0.72 + k * 0.29, 2.0, 6.55, 0, -0.25), k % 2 ? white : red));
    p.push(tint(at(box(0.25, 0.04, 0.33), 3.3, 0.96, 6.3), white), tint(at(new THREE.CylinderGeometry(0.06, 0.05, 0.12, 6), 4.0, 1.0, 6.3), gold));   // clipboard, ribbon cup
    // rosette podium blocks on the gazebo floor
    for (let i = 0; i < 5; i++) { const x = -2.6 + i * 1.3; p.push(tint(at(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 8), x, 0.63, 1.3), i === 2 ? gold : white)); }
    // bunting between the eight gazebo posts (radius 3.6, offset 0.39 rad), pennants alternating
    const cols = [red, white, cloth, gold];
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * 6.283 + 0.39, a1 = (k + 1) / 8 * 6.283 + 0.39, x0 = Math.cos(a0) * 3.75, z0 = Math.sin(a0) * 3.75, x1 = Math.cos(a1) * 3.75, z1 = Math.sin(a1) * 3.75, ry = Math.atan2(-(z1 - z0), x1 - x0);
      for (let j = 0; j < 4; j++) {
        const t = (j + 0.5) / 4, sag = Math.sin(t * Math.PI) * 0.22, tri = new THREE.ConeGeometry(0.13, 0.3, 3);
        tri.rotateX(Math.PI); tri.scale(1, 1, 0.12);
        p.push(tint(at(tri, x0 + (x1 - x0) * t, 2.85 - sag, z0 + (z1 - z0) * t, ry), cols[(k * 4 + j) % 4]));
      }
    }
    const mesh = new THREE.Mesh(merge(p), lambert({ vertexColors: true, flatShading: true })); mesh.name = 'catshow-set'; root.add(mesh);
    // the two printed signs: one texture, one draw
    const tx = signTex(), b = new THREE.PlaneGeometry(5.2, 1.3), d = new THREE.PlaneGeometry(1.5, 0.75);
    const uvb = b.attributes.uv; for (let i = 0; i < uvb.count; i++) uvb.setY(i, 0.5 + uvb.getY(i) * 0.5);
    const uvd = d.attributes.uv; for (let i = 0; i < uvd.count; i++) uvd.setY(i, uvd.getY(i) * 0.5);
    b.rotateY(Math.PI); b.translate(0, 2.75, 9.4); d.rotateY(Math.PI); d.translate(3.6, 1.45, 6.86);   // both read from the gazebo side
    const b2 = new THREE.PlaneGeometry(5.2, 1.3), uvb2 = b2.attributes.uv; for (let i = 0; i < uvb2.count; i++) uvb2.setY(i, 0.5 + uvb2.getY(i) * 0.5); b2.translate(0, 2.75, 9.48);   // back of the banner
    const d2 = new THREE.PlaneGeometry(1.5, 0.75), uvd2 = d2.attributes.uv; for (let i = 0; i < uvd2.count; i++) uvd2.setY(i, uvd2.getY(i) * 0.5); d2.translate(3.6, 1.45, 6.88);
    const signs = new THREE.Mesh(mergeGeometries([b, d, b2, d2], false), lambert({ map: tx })); signs.name = 'catshow-signs'; root.add(signs);
    S.built = true;
  }

  // judges: three makeHuman figures in the chairs, only nearby in show hours
  function judgesOn(on) {
    if (on && !S.judges) {
      S.judges = JUDGES.map((j, i) => { const h = makeHuman(j.look); h.position.set((i - 1) * 1.4, 0, 8.45); h.rotation.y = Math.PI; h.scale.setScalar(0.95); root.add(h); return h; });
      for (const h of S.judges) h.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    }
    if (S.judges) for (const h of S.judges) h.visible = on;
  }

  // trophy by the RV door
  let trophy = null;
  function syncTrophy() {
    if (!SV.trophy || trophy || !places.rv) return;
    trophy = new THREE.Mesh(trophyGeo(), lambert({ vertexColors: true, flatShading: true })); trophy.name = 'catshow-trophy';
    trophy.position.set(places.rv.x + 2.4, 0, places.rv.z - 1.4); scene.add(trophy);
  }
  syncTrophy();

  // ---------- quest log ----------
  const DEF = {
    id: 'catshow', kind: 'side', title: 'Best in Show', giver: 'the entries desk', where: 'the town green', reward: PRIZE[0],
    blurb: 'The Grand National Feline Classic is in town. Four of the best show cats in the country, three judges, four rounds: grooming, agility, talent and the interview. $50 to enter, $500 and a trophy for Best in Show. Repeatable, one show a day.',
    status: () => (S.show ? 'active' : SV.wins ? 'done' : 'open'),
    guide() {
      if (S.show) return { obj: `Round ${S.show.round + 1} of 4: ${ROUND_NAMES[S.show.round].toLowerCase()}.`, check: null };
      const c = { x: DESK.x, z: DESK.z, r: 2, label: 'Cat show', col: '#e8c040' };
      if (showsToday()) return { obj: 'Today\'s show is over. The Classic runs again tomorrow from 9 a.m.', check: null };
      if (!open()) return { obj: 'The cat show opens at 9 a.m. Entries at the desk by the gazebo on the town green.', check: c };
      return { obj: 'Enter the cat show at the entries desk by the gazebo on the town green ($50).', check: dist(DESK) > 3 ? c : null };
    },
  };
  if (quests && quests.register) quests.register(DEF);

  // ---------- the desk ----------
  const near = () => {
    if (P.car || G.dialog || G.paused || S.show) return null;
    if (ctx.inside && ctx.inside()) return null;
    if (dist(DESK) < 1.9) return { verb: showsToday() ? 'Read the results board' : open() ? `Enter the cat show ($${FEE})` : 'Read the entries sign', fn: desk };
    return null;
  };
  const prompt = () => { const n = near(); return n ? `${key}: ${n.verb}` : ''; };
  const interact = () => { const n = near(); if (!n) return false; n.fn(); return true; };
  function desk() {
    if (showsToday()) return say([['', `Today's results are pinned to the desk. ${SV.lastPlace ? `Goobles came ${ord(SV.lastPlace)}.` : ''} The Classic runs again tomorrow at 9.`]]);
    if (!open()) return say([['', 'CAT SHOW ENTRIES. $50. 9 AM - 6 PM. ONE SHOW DAILY. ALL BREEDS.'], ['', 'Nobody is at the desk. Come back after 9.']]);
    if (ctx.mission && ctx.mission()) return say([['', 'Goobles has a job on. The cat show can wait.']]);
    const first = !SV.entries;
    const lines = first ? [
      ['Desk lady', 'Welcome to the Grand National Feline Classic! Coast to coast, the finest cats in America.'],
      ['Desk lady', 'Entry is fifty dollars. Grooming, agility, talent and the judges\' interview. Best in Show takes home five hundred and a trophy.'],
      ['Desk lady', 'And you are... the owner? Oh. You\'re the CAT. Well. All breeds. That\'s the rule. It\'s on the sign.'],
    ] : [['Desk lady', 'Back again! Fifty dollars, sweetie. The champions are warming up.']];
    say(lines, () => {
      if (G.cash < FEE) { toast(`Entry is $${FEE}. Goobles has $${G.cash}.`, 3.5); Sfx.blip(180); return; }
      addCash(-FEE); SV.entries++; SV.lastShow = SV.day; store();
      startShow();
    });
  }
  const ord = (n) => ['', '1st', '2nd', '3rd', '4th', '5th'][n] || n + 'th';

  // ---------- the show ----------
  function wife() { const y = ctx.yardcats; if (!y || !y.S) return null; const id = y.S.wife || y.S.gf; const c = id && y.CATS && y.CATS.find((d) => d.id === id); return c ? { name: c.name, wife: !!y.S.wife } : null; }
  function startShow() {
    if (S.show) return;
    S.show = {
      round: 0, turn: 0, sel: 0, mode: 'msg', after: 'menu', poise: 100, froze: false, cheered: false, pts: 0, jd: [0, 0, 0], act: null, q: 0, outfitDone: false,
      marks: { goob: [] }, total: { goob: 0 }, msgs: [],
    };
    for (const r of RIVALS) { S.show.marks[r.id] = []; S.show.total[r.id] = 0; }
    const B = S.show, w = wife();
    B.msgs = [
      [MC, 'LADIES AND GENTLEMEN! Welcome to the Grand National Feline Classic, live from the Maple Grove town green!'],
      ...RIVALS.map((r) => [MC, `From ${r.from}: ${r.name.toUpperCase()}! ${r.intro}`]),
      [MC, 'And a late entry... from an RV on a dirt lot right here in Maple Grove... it\'s GOOBLES!'],
      ['', 'Polite applause. One person whistles. It is Nana.'],
      ...(w ? [['', `${w.name} is in the front row. She holds up a sign: GO GOOBLES.`]] : []),
      [MC, 'Our judges: Judge Pemberton, forty years on the circuit. Coach Brenda, agility legend. And from daytime television, Margo Vance!'],
      [MC, 'Round one: GROOMING AND PRESENTATION. Three moves to impress. Show us that coat!'],
    ];
    B.after = 'menu';
    goStage(); loadRivals();
    ui.handler = { move: (d) => { const s = S.show; if (s && s.mode === 'menu') { const n = cmds().length; s.sel = (s.sel + d + n) % n; draw(); } }, confirm: (i) => confirm(i) };
    if (quests && quests.track) quests.track('catshow');
    draw();
  }
  function goStage() {
    const s = STAGE[2]; P.x = s.x; P.z = s.z; P.y = 0.66; P.vy = 0; P.vx = P.vz = 0; P.yaw = 0;
    try { const bx = GR.x, bz = GR.z - 12; window.__G && window.__G.setCam && window.__G.setCam(Math.atan2(P.x - bx, P.z - bz), 0.18); } catch (e) { /* camera stays */ }
  }
  function loadRivals() {
    if (S.figs || S.loading) return;
    S.loading = true;
    makeCatFigures(RIVALS.map((r) => r.look)).then((figs) => {
      S.loading = false;
      if (!S.show) { figs.dispose(); return; }
      S.figs = figs;
      figs.list.forEach((f, i) => { const st = STAGE[i < 2 ? i : i + 1]; f.root.position.set(st.x, 0.66, st.z); f.root.rotation.y = 0; scene.add(f.root); f.play('Idle'); });
    }).catch((e) => { S.loading = false; console.warn('catshow: rival cats failed', e); });
  }
  function dropRivals() { if (S.figs) { for (const f of S.figs.list) scene.remove(f.root); S.figs.dispose(); S.figs = null; } }
  const emote = (id, clip) => { if (!S.figs) return; const i = RIVALS.findIndex((r) => r.id === id); const f = S.figs.list[i]; if (f) f.play(clip, true); };

  // commands for the current round and turn
  function cmds() {
    const B = S.show; if (!B) return [];
    const r = B.round;
    if (r === 0) {
      const worn = Object.keys(OUTFIT).filter((id) => WARD.wearing(id));
      return [
        { id: 'lick', name: 'LICK PAWS', blurb: 'Steady, classic, never wrong. Judge Pemberton approves of fundamentals.' },
        { id: 'fluff', name: 'FLUFF TAIL', blurb: 'Could be magnificent. Could be a bottle brush. Big swing.' },
        { id: 'strut', name: 'STRUT', blurb: 'Walk the stage like you own it. Better the more poise you have.' },
        { id: 'outfit', name: B.outfitDone ? 'OUTFIT (done)' : 'SHOW OUTFIT', off: B.outfitDone, blurb: worn.length ? `Turn to show off what you\'re wearing (${worn.map((id) => WARD.GARMENTS[id].name.toLowerCase()).join(', ')}). Each judge has a taste.` : 'Nothing on. Present the natural coat. Old-school judges like that.' },
        { id: 'breathe', name: 'DEEP BREATH', blurb: 'No points, but +25 poise. In through the nose.' },
      ];
    }
    if (r === 1) {
      const o = OBSTACLES[Math.min(B.turn, OBSTACLES.length - 1)];
      return [
        { id: 'sprint', name: 'SPRINT', blurb: `${o.name}: go fast. Good points, some risk.` },
        { id: 'careful', name: 'CAREFUL', blurb: `${o.name}: slow and clean. Small points, no risk.` },
        { id: 'showoff', name: 'SHOW OFF', blurb: `${o.name}: add a flip. Big points if it lands, and Margo loves it. Poise helps.` },
      ];
    }
    if (r === 2) {
      if (B.turn === 0) {
        const fish = fishCount();
        return [
          { id: 'cup', name: 'CUP OFF TABLE', blurb: 'Walk to the judges\' table, lock eyes, and push Judge Pemberton\'s coffee cup off. The crowd will love it. He will not.' },
          { id: 'sing', name: 'SING', blurb: 'A song in Goobles\' own voice. Hit the notes and it brings the house down.' },
          { id: 'fish', name: fish ? 'FISH TRICK' : 'FISH (no fish)', off: !fish, blurb: fish ? 'Balance a fish from your bag on your nose, flip it, catch it. Uses one fish.' : 'You need a fish in your bag. Earl at the Bait & Tackle sells rods.' },
          { id: 'fix', name: 'FIX THE TABLE', blurb: 'The judges\' table wobbles. Fix it, live, on stage. Honest work.' + (WARD.wearing('gloves') ? ' You have your work gloves on.' : '') },
          { id: 'loaf', name: 'THE LOAF', blurb: 'Tuck in the paws. Become bread. Mochi might film it.' },
        ];
      }
      return [
        { id: 'bow', name: 'TAKE A BOW', blurb: 'A neat bow. Safe.' },
        { id: 'encore', name: 'ENCORE', blurb: 'Do it again, bigger. Brilliant or a disaster. Poise helps.' },
        { id: 'blink', name: 'SLOW BLINK', blurb: 'The slow blink of cat love, right at the judges. Margo melts.' },
      ];
    }
    return interviewQ(Math.min(B.turn, 2)).a;
  }
  function fishCount() { const f = ctx.fishing; if (!f || !f.S) return 0; return f.S.bag.filter((x) => !(f.FISH && f.FISH[x.id] && f.FISH[x.id].junk) && !x.hat).length; }
  function interviewQ(i) {
    const w = wife(), hoa = !!(window.__HOA && window.__HOA.state && (() => { try { return window.__HOA.state().st === 'petition'; } catch (e) { return false; } })());
    const Q = [
      { who: 'MARGO', q: 'Goobles, darling. What would winning tonight mean to you?', a: [
        { id: 'honest', name: 'A DAY OFF', blurb: '"A day off. My first one in eleven years."', v: 2.8, d: [0.3, 0.2, 0.8], r: 'Margo puts a hand on her heart. "Eleven YEARS?"' },
        { id: 'destiny', name: 'DESTINY', blurb: '"I was born for this. Literally. Look at me."', v: 1.6, d: [-0.6, 0, 0.5], r: 'Sir Reginald scoffs so hard his collar jingles.' },
        { id: 'snacks', name: 'SNACKS', blurb: '"Is there a snack table? I was told there would be a snack table."', v: 2, d: [-0.5, 0, 1], r: 'The crowd laughs. Margo laughs. Judge Pemberton writes something down.' },
        hoa ? { id: 'hoa', name: 'THE HOA', blurb: '"The HOA is trying to evict me. Five hundred dollars is a lot of fines."', v: 3, d: [0.2, 0.4, 1.3], r: 'Margo gasps. "A STORY! An underdog! I\'m texting my producer."' }
          : { id: 'rent', name: 'THE RV', blurb: '"Honestly? The payment on the RV."', v: 2.4, d: [0, 0.6, 0.4], r: 'Coach Brenda nods slowly. She has an RV too.' },
      ] },
      { who: 'PEMBERTON', q: 'Describe your grooming regimen. In detail.', a: [
        { id: 'lick', name: 'LICK. REPEAT.', blurb: '"Lick. Repeat. Some days I skip the repeat."', v: 2, d: [0.2, 0, 0.3], r: 'Judge Pemberton: "Fundamentals. Fine."' },
        { id: 'wash', name: 'CAR WASH', blurb: '"I walk through Suds N Paws on the cheap cycle."', v: 2.2, d: [-1, 0.3, 1], r: 'Judge Pemberton drops his pen. Margo is crying laughing.' },
        { id: 'lie', name: 'SEVEN STEPS', blurb: '"A seven-step regimen. Oils. Serums. A little mist." (This is a lie.)', v: 3.2, d: [0.8, 0, 0.2], lie: true, r: 'Judge Pemberton is impressed. He asks for the brand of serum.' },
        { id: 'doubles', name: 'NO TIME', blurb: '"I work doubles. The rain does most of it."', v: 2.6, d: [-0.2, 0.8, 0.4], r: 'Coach Brenda: "That\'s a working cat. Respect."' },
      ] },
      { who: 'BRENDA', q: 'Last one. Who made you the cat you are today?', a: [
        { id: 'nana', name: 'NANA', blurb: '"Nana next door. She feeds me and calls me sweetie."', v: 2.8, d: [0.4, 0.4, 0.4], r: 'In the crowd, Nana waves both arms. "THAT\'S ME!"' },
        { id: 'tube', name: 'TUBE DUDE', blurb: '"My buddy Tube. He\'s an inflatable tube man. He never stops waving. Never gives up."', v: 2.4, d: [-0.4, 0.6, 1], r: 'Margo: "Is Tube here? Can we get Tube on the show?"' },
        { id: 'self', name: 'SELF-MADE', blurb: '"Nobody. I\'m a self-made cat."', v: 1.6, d: [-0.3, 0.3, 0], r: 'Tex nods. "Respect, partner." Nobody else says anything.' },
        w ? { id: 'wife', name: w.wife ? 'MY WIFE' : 'MY GIRL', blurb: `"${w.name}. She's right there in the front row. Hi, ${w.name}."`, v: 3, d: [0.3, 0.2, 1.3], r: `${w.name} hides her face behind her sign. The crowd goes "awww".` }
          : { id: 'box', name: 'THE BOX', blurb: '"Whoever invented the cardboard box."', v: 2, d: [0, 0, 0.6], r: 'Several cats in the crowd nod solemnly.' },
      ] },
    ];
    return Q[i];
  }

  function bars() {
    const B = S.show, lead = leader();
    return [
      { name: 'POISE', val: B.poise, max: 100, col: B.poise < 30 ? '#ff6a5a' : '#6fe07a' },
      { name: 'GOOBLES', val: B.total.goob, max: 120, unit: 'pts', col: '#e8c040' },
      { name: lead.name, val: lead.pts, max: 120, unit: 'pts', col: '#9ad0ff' },
    ];
  }
  function leader() { const B = S.show; let best = null; for (const r of RIVALS) if (!best || B.total[r.id] > B.total[best.id]) best = r; return { name: 'TOP: ' + best.short, pts: B.total[best.id] }; }
  function draw() {
    const B = S.show; if (!B) return;
    const c = cmds();
    if (B.mode === 'msg') ui.show({ bars: bars(), cmds: c, sel: -1, who: B.msgs[0][0], text: B.msgs[0][1], more: true });
    else {
      let who = `${ROUND_NAMES[B.round]}${B.round === 1 ? ' · ' + OBSTACLES[B.turn].name : B.round === 2 ? (B.turn ? ' · FINALE' : ' · THE ACT') : B.round === 0 ? ` · MOVE ${B.turn + 1}/3` : ''}`;
      let text = c[B.sel].blurb;
      if (B.round === 3) { const q = interviewQ(B.turn); who = `INTERVIEW · ${q.who} ASKS`; text = `"${q.q}"<br><br>${c[B.sel].blurb}`; }
      ui.show({ bars: bars(), cmds: c, sel: B.sel, who, text });
    }
  }
  function confirm(i) {
    const B = S.show; if (!B) return;
    if (B.mode === 'msg') {
      Sfx.blip(660); B.msgs.shift();
      if (B.msgs.length) return draw();
      if (B.after === 'menu') { B.mode = 'menu'; B.sel = 0; return draw(); }
      if (B.after === 'score') return scoreRound();
      if (B.after === 'next') return nextRound();
      if (B.after === 'end') return endShow();
      if (B.after === 'done') return B.handlerAfter();
      return;
    }
    if (i !== undefined) B.sel = i;
    const c = cmds()[B.sel]; if (!c || c.off) { Sfx.blip(180); return draw(); }
    turn(c);
  }

  const poiseK = () => (S.show.poise - 50) / 250;   // -0.2 .. +0.2 on success rolls
  function addPoise(n, out) {
    const B = S.show; B.poise = clamp(B.poise + n, 0, 100);
    if (B.poise <= 0 && !B.froze) { B.froze = true; out.push(['', 'Goobles freezes. Stage fright. He stares into the middle distance like he\'s on a smoke break. (This round\'s marks are halved.)']); B.poise = 35; }
  }
  const jd = (d) => { const B = S.show; for (let k = 0; k < 3; k++) B.jd[k] = clamp(B.jd[k] + d[k], -2.5, 2.5); };
  function turn(c) {
    const B = S.show, out = [], r = B.round;
    let calm = false;
    if (r === 0) {
      if (c.id === 'lick') { B.pts += R(2, 2.6); jd([0.3, 0, 0]); out.push(['', pick(['Goobles licks one paw and smooths his ears. Textbook.', 'Goobles does the little paw-lick-face-wipe. Judge Pemberton nods once.'])]); }
      else if (c.id === 'fluff') {
        if (Math.random() < 0.55 + poiseK()) { B.pts += R(3, 3.8); jd([0, 0, 0.4]); out.push(['', 'Goobles fluffs his tail. It POOFS. It is magnificent. Somebody says "wow" out loud.']); }
        else { B.pts += R(0.3, 1); out.push(['', 'Goobles fluffs his tail. Static. It now looks like a bottle brush that has seen things.']); }
      } else if (c.id === 'strut') { B.pts += 0.5 + 2.2 * B.poise / 100; jd([0, 0.2, 0.3]); out.push(['', B.poise > 60 ? 'Goobles struts the stage like it\'s Friday and payday. The crowd claps along.' : 'Goobles struts. It\'s more of a shuffle. A determined shuffle.']); }
      else if (c.id === 'outfit') {
        B.outfitDone = true;
        const worn = Object.keys(OUTFIT).filter((id) => WARD.wearing(id));
        if (!worn.length) { B.pts += 2; jd([0.6, 0, -0.2]); out.push(['', 'Goobles presents the natural coat. All white, nothing added.'], ['', 'Judge Pemberton: "Unadorned. As the founders intended."']); }
        else { B.pts += 2.4; for (const id of worn.slice(0, 3)) { jd(OUTFIT[id].d); out.push(['', OUTFIT[id].line]); } }
      } else { calm = true; addPoise(25, out); out.push(['', 'Goobles closes his eyes and breathes. In through the nose. Out through the mouth. +25 poise.']); }
      B.turn++;
      B.after = B.turn >= 3 ? 'score' : 'menu';
    } else if (r === 1) {
      const o = OBSTACLES[B.turn];
      if (c.id === 'careful') { B.pts += 1.7; jd([0.15, 0, -0.1]); out.push(['', `${o.ok}, nice and steady.`]); }
      else if (c.id === 'sprint') {
        if (Math.random() < 0.68 + poiseK()) { B.pts += 2.8; jd([0, 0.3, 0]); out.push(['', `${o.ok} at full speed! Coach Brenda clicks her stopwatch, impressed.`]); }
        else { B.pts += 0.4; out.push(['', o.bad]); addPoise(-12, out); }
      } else {
        if (Math.random() < 0.5 + poiseK()) { B.pts += 3.6; jd([-0.2, 0.2, 0.5]); out.push(['', `${o.ok} with a FLIP! The crowd loses it. Margo is on her feet.`]); }
        else { jd([-0.2, 0, 0.1]); out.push(['', o.bad + ' He tried a flip first.']); addPoise(-18, out); }
      }
      B.turn++;
      B.after = B.turn >= OBSTACLES.length ? 'score' : 'menu';
    } else if (r === 2) {
      if (B.turn === 0) {
        B.act = c.id;
        if (c.id === 'cup') { B.pts += 4.4; jd([-1.6, 0.2, 1.6]); out.push(['', 'Goobles walks to the judges\' table. Locks eyes with Judge Pemberton. One paw. The cup goes over the edge.'], ['', 'The crowd ROARS. Judge Pemberton looks at his empty hand for a long time.']); }
        else if (c.id === 'sing') {
          sing();
          if (Math.random() < 0.45 + B.poise / 250) { B.pts += 4.6; jd([0.2, 0.2, 0.8]); out.push(['', 'Goobles sings. Mrrp. Mrow. MEOOOW. He hits every note. Somebody holds up a lighter.']); }
          else { B.pts += 1.8; jd([-0.3, 0, 0.6]); out.push(['', 'Goobles sings. He hits a note only dogs can hear. Three dogs outside start howling along. It sort of works?']); }
        } else if (c.id === 'fish') {
          useFish(); B.pts += 5; jd([0.5, 0.6, 0.3]); out.push(['', 'Goobles balances a fish on his nose, flips it, catches it, and eats it in one bite. Clean.'], ['', 'Coach Brenda: "The control! The CONTROL!"']);
        } else if (c.id === 'fix') {
          const gl = WARD.wearing('gloves') ? 1.3 : 0, vest = WARD.wearing('vest') ? 0.4 : 0;
          B.pts += 3 + gl + vest; jd([1, 1, -0.4]);
          out.push(['', 'Goobles crawls under the judges\' table, finds the short leg and shims it with a folded entry form. Rock solid.'], ['', gl ? 'He does it in his work gloves. Coach Brenda gives a slow nod of deep respect.' : 'Margo: "Is... is this the act?" Judge Pemberton: "Let him work."']);
        } else {
          if (Math.random() < 0.32) { B.pts += 5; jd([0, 0, 1]); out.push(['', 'Goobles becomes a loaf. Perfect, round, crustless.'], ['MOCHI', 'Hold on. Chat is going CRAZY. Four hundred thousand views. You\'re VIRAL, beige guy!']); }
          else { B.pts += 2.4; jd([0.2, 0, 0.2]); out.push(['', 'Goobles becomes a loaf. It\'s a good loaf. A solid, honest loaf. The crowd says "aww".']); }
        }
        B.turn = 1; B.after = 'menu';
      } else {
        if (c.id === 'bow') { B.pts += 2; jd([0.3, 0, 0]); out.push(['', 'Goobles takes a neat little bow.']); }
        else if (c.id === 'encore') {
          if (Math.random() < 0.5 + poiseK()) { B.pts += 3.6; jd([0, 0.2, 0.6]); out.push(['', B.act === 'cup' ? 'ENCORE: Goobles pushes Margo\'s cup off too. She LOVES it.' : 'ENCORE! He does it again, bigger. The crowd chants his name. Mostly Nana.']); }
          else { B.pts += 0.2; out.push(['', B.act === 'fix' ? 'ENCORE: Goobles "fixes" the table again. Now it wobbles the other way.' : 'ENCORE... and it falls apart. Goobles stares at the crowd. The crowd stares back.']); addPoise(-15, out); }
        } else { B.pts += 2.2; jd([0.2, 0, 0.9]); out.push(['', 'Goobles gives the judges a long, slow blink. Margo blinks back. She\'s welling up.']); }
        B.turn = 2; B.after = 'score';
      }
    } else {
      B.pts += c.v; jd(c.d); out.push(['GOOBLES', c.blurb.replace(/ \(This is a lie\.\)$/, '')]);
      if (c.lie && Math.random() < 0.5) { B.pts -= 2.6; jd([-1.6, 0, 0]); out.push(['SIR REGINALD', 'Seven steps? Name step four.'], ['', 'Goobles cannot name step four. Judge Pemberton crosses something out.']); addPoise(-15, out); }
      else out.push(['', c.r]);
      B.turn++;
      B.after = B.turn >= 3 ? 'score' : 'menu';
      calm = true;   // nobody heckles during the interview
    }
    // between turns: a rival heckles (or Tex cheers), sometimes the girlfriend / wife in the crowd
    if (!calm && B.after === 'menu' && Math.random() < 0.6) {
      const rv = pick(RIVALS), l = pick(HECKLE[rv.id]);
      out.push(l); addPoise(rv.id === 'tex' ? 8 : -R(7, 12), out); emote(rv.id, rv.id === 'tex' ? 'Wave' : 'Jump');
    }
    const w = wife();
    if (w && !B.cheered && B.after === 'menu' && Math.random() < 0.35) { B.cheered = true; out.push(['', `From the front row, ${w.name} yells: "THAT'S MY ${w.wife ? 'HUSBAND' : 'BOYFRIEND'}!" +12 poise.`]); addPoise(12, out); }
    Sfx.blip(520);
    B.msgs = out; B.mode = 'msg'; draw();
  }
  function sing() { const ks = ['mrrp', 'mrow', 'meow', 'chirp', 'meow']; ks.forEach((k, i) => { try { Sfx.meow(k, 0.9 + i * 0.06, i * 0.35); } catch (e) { /* audio off */ } }); }
  function useFish() {
    const f = ctx.fishing; if (!f || !f.S) return;
    const i = f.S.bag.findIndex((x) => !(f.FISH && f.FISH[x.id] && f.FISH[x.id].junk) && !x.hat);
    if (i >= 0) { f.S.bag.splice(i, 1); f.save && f.save(); }
  }

  // marks: three judges per contestant
  function scoreRound() {
    const B = S.show, r = B.round, out = [];
    let q = clamp(10 * B.pts / ROUND_MAX[r], 1, 10);
    if (B.froze) q *= 0.5;
    const gm = JUDGES.map((_, k) => clamp(Math.round(q + B.jd[k] + gauss() * 0.5), 1, 10));
    B.marks.goob.push(gm); const gs = gm[0] + gm[1] + gm[2]; B.total.goob += gs;
    out.push([MC, `The judges score GOOBLES: ${gm.map((m, k) => `${JUDGES[k].short} ${m}`).join(' · ')}. That's ${gs}!`]);
    for (const rv of RIVALS) {
      const m = S.rig ? [1, 1, 1] : JUDGES.map((_, k) => clamp(Math.round(rv.skill[r] + 0.35 + rv.bias[k] + gauss() * 1.1), 1, 10));
      B.marks[rv.id].push(m); B.total[rv.id] += m[0] + m[1] + m[2];
    }
    // the rivals' rounds, two lines in a random pair so the message count stays short
    const two = RIVALS.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    for (const rv of two) out.push(['', rv.rounds[r]]);
    out.push([MC, `After ${ROUND_NAMES[r].toLowerCase()}: ${standings().map((s) => `${s.short} ${s.pts}`).join(' · ')}.`]);
    B.msgs = out; B.mode = 'msg'; B.after = r >= 3 ? 'end' : 'next';
    Sfx.jingle && Sfx.jingle();
    for (const rv of RIVALS) emote(rv.id, 'Wave');
    draw();
  }
  function standings() {
    const B = S.show;
    return [{ id: 'goob', short: 'GOOBLES', pts: B.total.goob }, ...RIVALS.map((r) => ({ id: r.id, short: r.short, pts: B.total[r.id] }))].sort((a, b) => b.pts - a.pts || (a.id === 'goob' ? -1 : b.id === 'goob' ? 1 : 0));
  }
  function nextRound() {
    const B = S.show;
    B.round++; B.turn = 0; B.sel = 0; B.pts = 0; B.jd = [0, 0, 0]; B.froze = false; B.cheered = false; B.act = null;
    B.poise = Math.max(B.poise, 60);
    const intro = [
      null,
      [[MC, 'Round two: AGILITY! The hoop, the tunnel, the weave poles and the seesaw. Coach Brenda has her stopwatch out.'], ['', 'Goobles\' poise settles a little between rounds.']],
      [[MC, 'Round three: TALENT! One act, one finale. Dazzle us!']],
      [[MC, 'And the final round: THE JUDGES\' INTERVIEW. Three questions. No pressure. Well, some pressure.']],
    ][B.round];
    B.msgs = intro; B.mode = 'msg'; B.after = 'menu'; draw();
  }
  function endShow() {
    const B = S.show, st = standings(), place = st.findIndex((s) => s.id === 'goob') + 1, prize = PRIZE[place - 1] || 0;
    const out = [[MC, 'The judges have tallied their cards. In reverse order...']];
    for (let i = st.length - 1; i >= 0; i--) out.push([MC, `${ord(i + 1).toUpperCase()} PLACE: ${st[i].short}, ${st[i].pts} points!`]);
    if (place === 1) out.push(['', 'Goobles, the blue-collar cat from the RV lot, is BEST IN SHOW. Confetti. Nana is crying. Tex is crying. Sir Reginald demands a recount.'], [MC, `Five hundred dollars and the trophy! Goobles, any words?`], ['GOOBLES', 'Mrrp.'], [MC, 'Beautiful.']);
    else if (place <= 3) out.push(['', `Goobles takes ${ord(place)} place and a ribbon. $${prize}! Not bad for a cat with a day job.`]);
    else out.push(['', `${ord(place)} place. A participation ribbon. Goobles eats it. ${place === 5 ? 'Sir Reginald looks delighted.' : 'Tex pats him on the back.'}`]);
    B.msgs = out; B.mode = 'msg'; B.after = 'done'; B.place = place; B.prize = prize;
    // pay and save now, so a reload mid-credits keeps it
    if (prize) addCash(prize);
    SV.purse += prize; SV.lastPlace = place; SV.best = SV.best ? Math.min(SV.best, place) : place;
    const firstTrophy = place === 1 && !SV.trophy;
    if (place === 1) { SV.wins++; SV.trophy = 1; }
    store();
    B.handlerAfter = () => finish(place, prize, firstTrophy);
    draw();
  }
  function finish(place, prize, firstTrophy) {
    S.show = null; ui.hide(); dropRivals();
    P.lock = Math.max(P.lock || 0, 0.5);
    const st = L(0, 5.2); P.x = st.x; P.z = st.z;   // step down off the gazebo toward the judges
    if (place === 1) {
      syncTrophy();
      ctx.banner && ctx.banner('BEST IN SHOW', `+$${prize}. The trophy is waiting by the RV.`, 4.5, 'pass');
      if (firstTrophy && window.__HOA && window.__HOA.fine) say([['Gary Kim', 'Congratulations. Unrelated: a trophy over twelve inches on display outside a dwelling requires Form 7-B.'], ['Gary Kim', 'You don\'t have Form 7-B. Twenty-five dollar fine. Have a nice evening.']], () => { try { window.__HOA.fine(25); } catch (e) { /* hoa not loaded */ } });
    } else if (prize) toast(`${ord(place)} place at the Feline Classic. +$${prize}`, 4);
    else toast(`${ord(place)} place. The Classic is back tomorrow at 9.`, 4);
    if (quests && quests.track) quests.track(null);
  }

  // ---------- frame ----------
  function update(dt) {
    // day counter: the clock wrapping past midnight
    const c = G.clock || 0; if (c < S.prevClock - 12) { SV.day++; store(); } S.prevClock = c;
    const d = Math.hypot(P.x - GR.x, P.z - GR.z), inside = ctx.inside && ctx.inside();
    const vis = d < 90 && !inside;
    if (vis && !S.built) build();
    root.visible = vis;
    judgesOn(vis && d < 60 && (open() || !!S.show));
    if (trophy) trophy.visible = !inside;
    const B = S.show;
    if (B) {
      P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.25);
      const s = STAGE[2]; if (Math.hypot(P.x - s.x, P.z - s.z) > 0.3) { P.x = s.x; P.z = s.z; }
      if (P.y < 0.6) { P.y = 0.66; P.vy = 0; }
      P.yaw = 0;
      if (S.figs) S.figs.update(dt);
      if (!ui.active) draw();
    }
    ui.update(dt);
  }

  Object.assign(api, {
    update, prompt, interact, DESK, STAGE, TABLE, root,
    tp() { P.x = DESK.x - 1; P.z = DESK.z - 0.6; },
    start() { if (!S.show) { SV.lastShow = SV.day; store(); startShow(); } },
    /** QA: pick a command by id on the current menu (skips messages first). */
    pick(id) { const B = S.show; if (!B) return false; while (B.mode === 'msg' && B.msgs.length && S.show === B) confirm(); if (!S.show || B.mode !== 'menu') return false; const i = cmds().findIndex((c) => c.id === id); if (i < 0) return false; B.sel = i; confirm(); return true; },
    /** QA: skip every message (leaves the next menu up, or finishes the show). */
    skip() { let n = 0; while (S.show && S.show.mode === 'msg' && n++ < 200) confirm(); },
    /** QA: play the whole show with the first available command each turn. */
    auto(ids) { let n = 0; while (S.show && n++ < 400) { const B = S.show; if (B.mode === 'msg') { confirm(); continue; } const cs = cmds(); const want = ids && ids[B.round]; let i = want ? cs.findIndex((c) => c.id === want && !c.off) : -1; if (i < 0) i = cs.findIndex((c) => !c.off); B.sel = i; confirm(); } },
    cmds: () => cmds().map((c) => c.id),
    state: () => ({ show: S.show ? { round: S.show.round, turn: S.show.turn, mode: S.show.mode, poise: S.show.poise, total: { ...S.show.total } } : null, figs: S.figs ? S.figs.list.length : 0, built: S.built, judges: !!S.judges, ...SV, trophy: !!SV.trophy }),
    reset() { if (S.show) { S.show = null; ui.hide(); } dropRivals(); SV = fresh(); store(); if (trophy) { scene.remove(trophy); trophy.geometry.dispose(); trophy = null; } },
    nextDay() { SV.day++; store(); },
    /** QA: every rival scores 1s (to test the win path). */
    rig(on = true) { S.rig = on; },
    trophy: () => trophy,
  });
  window.__CATSHOW = api;
  return api;
}
