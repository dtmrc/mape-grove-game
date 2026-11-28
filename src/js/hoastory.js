// The HOA war, chapter 1: "Notice to Vacate" (diet 2026-11-28: "lets go with option 1 and 2. instead of just gary, make
// them a gay black couple tyrone and sharique"; "gary can stay on as their underling, but make gary kim, the fat asian near
// sighted paper pusher").
//
// Cast: Tyrone Bellamy (HOA President, smooth, vision boards, fines you with a warm smile), his husband Sharique Bellamy
// (Vice President + Architectural Review chair, deadpan, tape measure, leather planner) and Gary Kim, their Compliance
// Officer (forms in triplicate, thick glasses, can't see past arm's length; the existing Gary NPC and missions).
//
// Loop: the couple serve an eviction notice at the RV. A clock runs for 3 game days (72 real minutes) and every morning at
// 8 AM a new violation adds to the fines. Neighbors you've helped sign Goobles' petition (Nana, the Quik Stop Kids, Big
// Ricky, Rosie via Fish Order, Earl via Catch of the Day). With 3+ signatures the Board Hearing opens at the HOA office,
// 6 to 9 PM: a menu turn battle (storyui.js panel) where unpaid fines let Tyrone heal, so money from odd jobs (oddjobs.js)
// helps. If the clock runs out the RV is booted (interior closed) until the fines are paid at the HOA office.
// Winning suspends the eviction and sets up chapter 2.
//
// Own save key (mg-hoastory-v1). Wired in game.js with a few one-line hooks (prompt / interact / update / talk / SAVE_KEYS).
// Debug: window.__HOA (state, serve(), sign(id), clock(s), fine(n), hearing(), move(k), win(), reset()).
import * as THREE from 'three';
import { makeCastHuman, animBiped } from './models.js';
import { makeStoryUI } from './storyui.js';
import * as INTM from './interiors.js';

export const HOA_STORY_ENABLED = true;
export const HOA_KEY = 'mg-hoastory-v1';

const DAY = 24 * 60;                 // one game day in seconds (one game hour per real minute)
const NOTICE_DAYS = 3, REBOOT_DAYS = 2;
const NEED = 3;                      // signatures to call a hearing
const HEAR_FROM = 18, HEAR_TO = 21;  // the board sits 6 to 9 PM
const RESOLVE = 175;   // balance (Monte Carlo, smart play): fines paid ~97% win with 3 signatures; $300 unpaid ~39% (3), ~92% (5)
const T_ = 'Tyrone', SH = 'Sharique', GK = 'Gary Kim';

// ---------------------------------------------------------------- words ----------------------------------------------------------------
const NOTICE = [
  [T_, 'Good afternoon! Tyrone Bellamy, President of the Maple Grove HOA. And this is my husband, Sharique, who chairs Architectural Review.'],
  [SH, 'Hi. Don\'t get up. Actually, do get up. You\'re sitting on a violation.'],
  [T_, 'We LOVE what you\'ve done with the lot. The raw, unfiltered... RV of it all. Very authentic. Very "found object".'],
  [SH, 'Bylaw 14-C: no recreational vehicles. Bylaw 22: no cats who are also the homeowner. I wrote 22 this morning.'],
  [T_, 'So! A Notice to Vacate. Three days. Plus a modest Lot Compliance Fee of three hundred dollars.'],
  [SH, 'It was two hundred. Then I saw the lawn chair.'],
  [T_, 'Now, the board is a democracy. Get enough neighbors to sign a petition and you can plead your case at a hearing. Six to nine PM, at the HOA office.'],
  [SH, 'Nobody has ever gotten enough signatures.'],
  [T_, 'Nobody has ever TRIED, babe. Let him try. It\'s adorable.'],
  [SH, 'Gary will drop off the forms. GARY. ...He\'s on his way. He can\'t see very far.'],
  ['', 'Goobles blinks at them, very slowly. In cat, this is the rudest thing you can say.'],
];
const SIGNERS = {
  nana: { name: 'Nana', job: 'Casserole Run', line: 'Nana signs in big loopy cursive and adds a heart. "Tyrone was a sweet boy. Then he discovered clipboards."', battle: 'Goobles presents Nana\'s signature. It\'s in cursive, it smells like casserole, and there is a heart over the i. Tyrone has to look away.' },
  kids: { name: 'the Quik Stop Kids', job: 'Slurpee Sprint', line: 'The Quik Stop Kids sign in blue Slurpee. All three of them. One signs twice.', battle: 'Goobles presents the Quik Stop Kids\' signatures, written in blue Slurpee. Sharique: "These are minors." Tyrone: "These are STICKY."' },
  ricky: { name: 'Big Ricky', job: 'Trash Panda Heist', line: 'Big Ricky signs with a paw print. And a little lasagna. "Raccoons can\'t vote, cat. Sign it anyway. Make them say it out loud."', battle: 'Goobles presents Big Ricky\'s paw print, with lasagna. Sharique checks the bylaws for something about raccoons. There isn\'t anything. He looks shaken.' },
  rosie: { name: 'Rosie', job: 'Fish Order', line: 'Rosie signs on the back of a diner receipt: "LEAVE THE CAT ALONE, TYRONE."', battle: 'Goobles slides Rosie\'s receipt across the table: "LEAVE THE CAT ALONE, TYRONE." Tyrone: "She knows my order. She KNOWS my ORDER."' },
  earl: { name: 'Earl', job: 'Catch of the Day', line: 'Earl signs on a bait box lid: "GOOD CAT. GOOD FISHERMAN. BAD HOA."', battle: 'Goobles presents Earl\'s bait box lid. "GOOD CAT. GOOD FISHERMAN. BAD HOA." Something inside the box is still wriggling. Sharique scoots his chair back.' },
};
const SIGN_ORDER = ['nana', 'kids', 'ricky', 'rosie', 'earl'];
const VIOLATIONS = [
  ['Cat visible from the street', 40], ['RV is a color', 60], ['Unauthorized napping in a sunbeam', 45], ['Lawn chair facing the wrong direction', 35],
  ['Excessive meowing after 9 PM', 55], ['Smell (unspecified)', 40], ['Looking at Sharique\'s hedges', 50], ['Paw prints on a neighbor\'s windshield (artistic)', 50],
  ['Doormat says "WELCOME" (insincere)', 45], ['Tail left out overnight', 40],
];
const BANTER = {
  early: [
    [[T_, 'Goobles! Love the hustle. How many signatures? Don\'t tell me. Sharique, how many?'], [SH, '{n}. I keep a spreadsheet. It has a tab for you.']],
    [[SH, 'Your grass is three point two inches. The bylaw says three.'], [SH, 'I\'m not mad. I\'m measuring.']],
    [[T_, 'Did you know Maple Grove was voted "Most Beige" two years running? That\'s not an accident. That\'s LEADERSHIP.'], [SH, 'It\'s also paint.']],
    [[SH, 'Babe, the cat is on our lawn.'], [T_, 'I see him, babe.'], [SH, 'Should I measure him?'], [T_, '...Later.']],
  ],
  ready: [[[T_, 'Three signatures? THREE? Sharique, he has three.'], [SH, 'I can count, Tyrone.'], [T_, 'Fine. The board sits at six. HOA office. Wear something.']]],
  booted: [[[SH, 'We booted the RV. It was very satisfying. I took a picture for the newsletter.'], [T_, 'Pay your fines at the office, sweetie. Gary takes cash, checks and tears.']]],
  won: [
    [[T_, 'Goobles. Good to see you. Genuinely. I\'m smiling with my whole face.'], [SH, 'He\'s not. I can tell. I\'ve been married to that face for eleven years.']],
    [[SH, 'The election is coming. Enjoy your lot while it\'s a lot.'], [T_, 'That\'s our campaign slogan. Don\'t steal it.']],
  ],
};
const HEAR_INTRO = [
  ['', 'The board sets up a folding table on the steps of the HOA office. Tyrone has brought a gavel. Sharique has brought a second, backup gavel.'],
  [T_, 'The Maple Grove HOA Board will now hear the matter of... Sharique, what\'s his name?'],
  [SH, 'Lot 1. "The Cat".'],
  [GK, '*squints at Goobles from four inches away* Is this the petitioner? He\'s very... furry. Is he wearing a coat? Is that his coat?'],
  [T_, 'Let the record show the cat is the coat, Gary. Let\'s begin.'],
];
const HEAR_WIN = [
  [T_, 'The motion to evict is... Sharique. I can\'t say it. You say it.'],
  [SH, 'Denied. The motion is denied. I\'m writing it down so I can be upset about it properly later.'],
  [T_, 'FINE. The eviction is suspended. Pending the annual election.'],
  [SH, 'Which is in a month.'],
  [T_, 'Which we have won eleven years in a row. Enjoy your lot, Goobles. While it\'s a lot.'],
  [GK, 'I\'ll file this under "Losses". We don\'t have a folder for that. I\'ll make a folder. In triplicate.'],
  ['', 'Goobles curls up on the HOA welcome mat and goes to sleep. Nobody has the nerve to move him.'],
];
const HEAR_LOSE = [[SH, 'Motion carried. That\'s another hundred dollars in court costs.'], [T_, 'There\'s no court, babe.'], [SH, 'It\'s still a hundred. Come back tomorrow night, Lot 1.']];
const BICKER = [
  [[SH, 'Babe, you\'re doing the voice.'], [T_, 'I am NOT doing the voice.'], [SH, 'You\'re doing the "community leader" voice.'], ['', 'The board spends its turn arguing about the voice.']],
  [[T_, 'Sharique, the fine schedule, please.'], [SH, 'I KNOW the fine schedule, Tyrone. I WROTE the fine schedule.'], ['', 'The board loses its turn. Gary Kim quietly writes down "TENSION".']],
  [[SH, 'You said we\'d be home by eight.'], [T_, 'This IS home. The HOA is our home.'], [SH, 'That is the saddest thing you\'ve ever said.'], ['', 'The board loses its turn.']],
];
const BOARD_LINES = {
  vision: [[T_, 'Picture it: Maple Grove, ELEVATED. Matching mailboxes. Matching hedges. Matching moods.'], [T_, 'I have a vision board. Would you like to see the vision board? It\'s laminated.']],
  tape: [[SH, '*pulls out the tape measure* Your whiskers are four inches. The bylaw says three and a half.'], [SH, 'I measured your RV while you were out. Twice. It\'s still an RV.']],
  bylaw: [[SH, 'BYLAW 14-C. Subsection D. Paragraph "absolutely not".'], [SH, 'Bylaw 14-C. I have it tattooed somewhere. I won\'t say where.']],
  balance: [[T_, 'Before we continue... a little matter of an outstanding balance. ${f}. Gary?'], [T_, 'Let the record show the petitioner owes ${f}. The board feels VERY refreshed.']],
  form: [[GK, 'Form 27-B. A Request to Review a Request. Your next signature is under review.'], [GK, 'I need this in triplicate. *holds the paper two inches from his glasses* ...This IS in triplicate. Never mind. Still under review.']],
};

// ---------------------------------------------------------------- characters ----------------------------------------------------------------
function watch(m, box, pmat, arm) { m(box(0.06, 0.03, 0.07), pmat(0xe0b840), 0, -0.56, 0.0, arm); }
export function makeTyrone() {
  return makeCastHuman({
    h: 1.86, build: 1.06, skin: 0x6e4428, hair: 0x15110e, hairStyle: 'buzz',
    top: 0x1e2e5a, topStyle: 'jacket', top2: 0xf4f0e6, trim: '#c8a040', bottom: 0x3a3a44, bottomStyle: 'pants', belt: '#2a1a12', shoes: 0x4a2a16,
    face: { eye: '#3a2618', eye2: '#6a4a30', smile: 1.2, brow: '#15110e', browTilt: -0.3, stubble: true, skinHex: '#6e4428' },
    extras: ({ arms, m, box, pmat, torso }) => {
      watch(m, box, pmat, arms[1]);
      m(box(0.03, 0.03, 0.01), pmat(0xc8a040), -0.11, 1.33, 0.15, torso);   // HOA lapel pin
    },
  });
}
export function makeSharique() {
  return makeCastHuman({
    h: 1.79, build: 0.96, skin: 0x8a5838, hair: 0x120e0c, hairStyle: 'short',
    top: 0x7a1f30, topStyle: 'jacket', top2: 0xf2efe6, trim: '#e8d8b0', bottom: 0x24242c, bottomStyle: 'pants', belt: '#120e0c', shoes: 0x141414,
    face: { eye: '#3a2618', eye2: '#6a4a30', smile: -0.2, brow: '#120e0c', browTilt: 0.9, lids: 0.35, glasses: '#c0a060', skinHex: '#8a5838' },
    extras: ({ arms, m, box, pmat, torso }) => {
      m(box(0.16, 0.22, 0.04), pmat(0x4a2a1a), 0, -0.52, 0.1, arms[0]).rotation.x = -0.35;   // leather planner
      m(box(0.08, 0.08, 0.04), pmat(0xf0c020), 0.17, 0.9, 0.08, torso);                        // tape measure on the belt
    },
  });
}

// ---------------------------------------------------------------- module ----------------------------------------------------------------
export function makeHoaStory(ctx) {
  const { scene, G, P, places, NPC, fishing, quests, say, toast, banner, Sfx, addCash, isTouch, T, haunted } = ctx;
  const key = isTouch ? 'USE' : 'E';
  const fresh = () => ({ st: 'none', left: 0, fines: 0, paid: 0, sigs: {}, booted: false, lastClock: null, vio: 0, tries: 0, nextTry: 0, day: 0 });
  let SV = {}; try { SV = JSON.parse(localStorage.getItem(HOA_KEY) || '{}') || {}; } catch (e) { SV = {}; }
  SV = Object.assign(fresh(), SV); SV.sigs ||= {};
  const store = () => { try { localStorage.setItem(HOA_KEY, JSON.stringify(SV)); } catch (e) { /* private mode */ } };
  const S = { t: 0, saveT: 0, chkT: 0, battle: null, banter: 0, hintRV: false };
  const ui = (haunted && haunted.ui) || makeStoryUI({ Sfx, isTouch });
  const dist = (x, z) => Math.hypot(P.x - x, P.z - z);
  const inRoom = () => INTM.current();
  const nSigs = () => SIGN_ORDER.filter((k) => SV.sigs[k]).length;
  const hearingHours = () => { const c = G.clock || 0; return c >= HEAR_FROM && c < HEAR_TO; };
  const fmtLeft = (s) => { const h = Math.max(0, Math.floor(s / 60)); return `${Math.floor(h / 24)}d ${h % 24}h`; };
  const active = () => SV.st === 'petition';

  // places: the RV, the Beaumont (president's house, places.gary), the HOA office (haunted.js HOA, world.js buildHoa)
  const RV = places.rv;
  const OFFICE = (haunted && haunted.HOA) || { x: -50, z: -44, door: { x: -50, z: -48.3 } };
  const HEAR = { x: OFFICE.door.x, z: OFFICE.door.z - 2.6 };   // the folding table on the office steps, facing -z
  const fwd = (pl, d, side = 0) => ({ x: pl.x + Math.sin(pl.yaw) * d + Math.cos(pl.yaw) * side, z: pl.z + Math.cos(pl.yaw) * d - Math.sin(pl.yaw) * side });
  const home = places.gary ? [fwd(places.gary, 1.4, -3.0), fwd(places.gary, 1.4, -3.9)] : [{ x: RV.x + 30, z: RV.z }, { x: RV.x + 31, z: RV.z }];
  const homeYaw = places.gary ? places.gary.yaw : 0;

  // ---------- the couple (two static figures, only shown near the player) ----------
  const pair = [];
  try { pair.push(makeTyrone(), makeSharique()); for (const m of pair) { m.visible = false; scene.add(m); } } catch (e) { console.error('[hoastory] cast', e); }
  // the hearing table: one merged box group, built on first use
  let table = null;
  function buildTable() {
    if (table) return table;
    table = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a48 }), cloth = new THREE.MeshLambertMaterial({ color: 0x1e2a44 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.8), cloth); top.position.y = 0.74; table.add(top);
    for (const sx of [-1.1, 1.1]) for (const sz of [-0.32, 0.32]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), wood); l.position.set(sx, 0.36, sz); table.add(l); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.45), new THREE.MeshBasicMaterial({ map: T.sign('HOA BOARD HEARING', '#1e2a44', '#ffd23f', 256, 64) }));
    sign.position.set(0, 0.48, -0.41); sign.rotation.y = Math.PI; table.add(sign);
    table.position.set(HEAR.x, 0, HEAR.z + 1.4); table.visible = false; scene.add(table);
    return table;
  }
  // the boot: a yellow clamp + a sign by the RV door
  let boot = null;
  function buildBoot() {
    if (boot) return boot;
    boot = new THREE.Group();
    const y = new THREE.MeshLambertMaterial({ color: 0xf0c020 });
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), y); c.position.y = 0.3; boot.add(c);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), y); arm.position.set(0, 0.6, 0.3); arm.rotation.x = 0.5; boot.add(arm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), new THREE.MeshLambertMaterial({ color: 0x3a3a3a })); post.position.set(1.0, 0.55, 0); boot.add(post);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.6), new THREE.MeshBasicMaterial({ map: T.sign('BOOTED BY HOA', '#f0c020', '#1e2a44', 256, 128), side: THREE.DoubleSide }));
    sg.position.set(1.0, 1.25, 0); boot.add(sg);
    boot.position.set(RV.x - 1.6, 0, RV.z + 3.2); scene.add(boot);
    return boot;
  }

  function placePair(at, yaw) { pair.forEach((m, i) => { m.position.set(at[i].x, 0, at[i].z); m.rotation.y = yaw; }); }
  /** Where the couple stand right now: [spots, yaw] or null (offstage). */
  function stage() {
    if (SV.st === 'none') return [[{ x: RV.x - 2.2, z: RV.z + 6.2 }, { x: RV.x - 1.2, z: RV.z + 6.6 }], Math.PI * 0.85];
    if (active() && nSigs() >= NEED && hearingHours() && !S.battle) return [[{ x: HEAR.x - 0.6, z: HEAR.z + 1.9 }, { x: HEAR.x + 0.6, z: HEAR.z + 1.9 }], Math.PI];
    if (S.battle) return [[{ x: HEAR.x - 0.6, z: HEAR.z + 1.9 }, { x: HEAR.x + 0.6, z: HEAR.z + 1.9 }], Math.PI];
    return [home, homeYaw];
  }
  const pairPos = () => { const s = stage(); return s ? { x: (s[0][0].x + s[0][1].x) / 2, z: (s[0][0].z + s[0][1].z) / 2 } : null; };

  // ---------- signatures ----------
  const earned = {
    nana: () => !!G.done.nana, kids: () => !!G.done.kids, ricky: () => !!G.done.ricky,
    rosie: () => ((G.jobs && G.jobs.fish) | 0) > 0, earl: () => !!(fishing && fishing.S && fishing.S.quest === 'done'),
  };
  function checkSigs(quiet) {
    const got = [];
    for (const k of SIGN_ORDER) if (!SV.sigs[k] && earned[k]()) { SV.sigs[k] = 1; got.push(k); }
    if (!got.length) return;
    store(); Sfx.pickup && Sfx.pickup();
    if (quiet) toast(`Already on your side: ${got.map((k) => SIGNERS[k].name).join(', ')}. Petition: ${nSigs()}/5.`, 5);
    else if (got.length === 1) toast(`${SIGNERS[got[0]].line} (Petition ${nSigs()}/5)`, 6);
    else toast(`${got.map((k) => SIGNERS[k].name).join(' and ')} signed your petition. (${nSigs()}/5)`, 4);
    if (nSigs() >= NEED && nSigs() - got.length < NEED) setTimeout(() => toast('Enough signatures for a Board Hearing. HOA office, 6 to 9 PM.', 5), 0);
  }
  function serve() {
    say(NOTICE, () => {
      SV.st = 'petition'; SV.left = NOTICE_DAYS * DAY; SV.fines = 300; SV.lastClock = G.clock; store();
      banner('NOTICE TO VACATE', '3 days. Get signatures, or pay up.', 4, 'fail'); Sfx.siren && Sfx.siren();
      quests && quests.track && quests.track('notice');
      checkSigs(true);
    });
  }
  function payFines() {
    const n = Math.min(G.cash, SV.fines);
    if (n <= 0) { Sfx.blip(180); return toast(`You owe $${SV.fines}. Gary Kim holds out a hand. Your pockets hold out lint.`, 3.5); }
    addCash(-n); SV.fines -= n; SV.paid += n; Sfx.pickup && Sfx.pickup();
    if (SV.fines > 0) { store(); return toast(`Gary Kim stamps the receipt three times. -$${n}. Still owing: $${SV.fines}.`, 4); }
    if (SV.booted) { SV.booted = false; SV.left = REBOOT_DAYS * DAY; INTM.close('rv', false); store(); toast(`Paid in full (-$${n}). Gary Kim removes the boot, eventually. The clock restarts: ${REBOOT_DAYS} days.`, 5); return; }
    store(); toast(`Paid in full. -$${n}. Gary Kim: "Wow. Nobody pays. I don't have a stamp for PAID." He uses RECEIVED twice.`, 5);
  }
  function bootRV() {
    SV.booted = true; SV.fines += 100; store(); INTM.close('rv', true); buildBoot();
    banner('RV BOOTED', 'Pay your fines at the HOA office to get back in.', 5, 'fail'); Sfx.siren && Sfx.siren();
  }

  // ---------- board hearing (menu battle) ----------
  const R = (a, b) => Math.round(a + Math.random() * (b - a));
  const pickL = (arr, i) => arr[i % arr.length];
  function startHearing() {
    if (S.battle) return;
    G.hp = Math.max(G.hp, 60);
    const left = SIGN_ORDER.filter((k) => SV.sigs[k]);
    S.battle = { r: RESOLVE, n: 100, sel: 0, mode: 'msg', msgs: HEAR_INTRO.slice(), after: 'menu', left, review: 0, turn: 0, flash: 0, bick: 0, groom: 2 };
    ui.handler = { move: (d) => { const B = S.battle; if (B && B.mode === 'menu') { B.sel = (B.sel + d + 4) % 4; draw(); } }, confirm: (i) => confirm(i) };
    draw();
  }
  function cmds(B) {
    return [
      { name: `SIGNATURE (${B.left.length})`, off: !B.left.length || B.review > 0, blurb: !B.left.length ? 'No signatures left to present.' : B.review > 0 ? 'Under review (Form 27-B). Wait a turn.' : `Present ${SIGNERS[B.left[0]].name}'s signature. Big damage to the board's resolve.` },
      { name: 'POINT OF ORDER', blurb: 'A loud, procedural meow. A little damage, and the couple might start bickering and lose their turn.' },
      { name: 'SWAT THE GAVEL', blurb: 'Knock the gavel off the table. Good damage, but Gary Kim fines you $25 for it.' },
      { name: `GROOM (${B.groom})`, off: B.groom <= 0, blurb: B.groom > 0 ? 'Lick a paw, very slowly, in front of the whole board. Restores your nerve. Works twice; after that it\'s just weird.' : 'You already groomed twice. A third time would be weird, even for a cat.' },
    ];
  }
  function draw() {
    const B = S.battle; if (!B) return;
    const bars = [{ name: 'GOOBLES\' NERVE', val: B.n, max: 100 }, { name: 'BOARD\'S RESOLVE', val: B.r, max: RESOLVE, col: '#c03050' }, { name: 'UNPAID FINES', val: SV.fines, max: Math.max(SV.fines, 300), unit: '$', col: SV.fines ? '#f0b020' : '#6fe07a' }];
    const c = cmds(B);
    if (B.mode === 'msg') ui.show({ bars, cmds: c, sel: -1, who: B.msgs[0][0], text: B.msgs[0][1], more: true });
    else ui.show({ bars, cmds: c, sel: B.sel, who: 'WHAT WILL GOOBLES DO?', text: c[B.sel].blurb });
  }
  function confirm(i) {
    const B = S.battle; if (!B) return;
    if (B.mode === 'msg') {
      Sfx.blip(660); B.msgs.shift();
      if (B.msgs.length) return draw();
      if (B.after === 'menu') { B.mode = 'menu'; return draw(); }
      if (B.after === 'board') return boardTurn();
      if (B.after === 'win' || B.after === 'lose') return endHearing(B.after === 'win');
      return;
    }
    if (i !== undefined) B.sel = i;
    if (cmds(B)[B.sel].off) { Sfx.blip(180); return draw(); }
    playerTurn(B.sel);
  }
  function playerTurn(k) {
    const B = S.battle, out = [];
    if (k === 0) { const id = B.left.shift(), n = R(28, 36); B.r -= n; out.push(['', `${SIGNERS[id].battle} ${n} damage.`]); }
    else if (k === 1) { const n = R(7, 11); B.r -= n; out.push(['', `Goobles stands on the table and meows once, procedurally. ${n} damage.`]); if (Math.random() < 0.4) B.bick = 1; }
    else if (k === 2) { const n = R(15, 21); B.r -= n; SV.fines += 25; store(); out.push(['', `Goobles looks Tyrone in the eye and pushes the gavel off the table. It bounces down every step. ${n} damage.`], [GK, 'That\'s a twenty-five dollar fine for... *squints* ...gravity.']); }
    else { const h = Math.min(100 - B.n, 25); B.n += h; B.groom--; out.push(['', `Goobles grooms one paw for a full, silent minute. The board doesn't know where to look. +${h} nerve.`]); }
    Sfx.punch && Sfx.punch(); B.flash = 0.4;
    if (B.review > 0) B.review--;
    B.r = Math.max(0, B.r); B.msgs = out; B.mode = 'msg'; B.after = B.r <= 0 ? 'win' : 'board'; draw();
  }
  function boardTurn() {
    const B = S.battle, out = []; B.turn++;
    if (B.bick) { B.bick = 0; out.push(...pickL(BICKER, B.turn)); }
    else {
      const r = Math.random();
      if (SV.fines > 0 && B.r < RESOLVE - 20 && r < 0.3) { const h = Math.min(RESOLVE - B.r, Math.min(22, 8 + Math.round(SV.fines / 20))); B.r += h; const [w, t] = pickL(BOARD_LINES.balance, B.turn); out.push([w, t.replace('${f}', '$' + SV.fines)], ['', `The board's resolve recovers ${h}. (Paying your fines at the office stops this.)`]); }
      else if (B.left.length && !B.review && r < 0.5) { B.review = 1; const n = R(3, 5); B.n -= n; out.push(pickL(BOARD_LINES.form, B.turn), ['', `${n} damage. Your next signature is stuck in review.`]); }
      else if (B.r < 60 && r < 0.8) { const n = R(17, 21); B.n -= n; out.push(pickL(BOARD_LINES.bylaw, B.turn), ['', `${n} damage to Goobles' nerve.`]); }
      else if (B.turn % 2) { const n = R(12, 16); B.n -= n; out.push(pickL(BOARD_LINES.vision, B.turn), ['', `${n} damage to Goobles' nerve.`]); }
      else { const n = R(13, 17); B.n -= n; out.push(pickL(BOARD_LINES.tape, B.turn), ['', `${n} damage to Goobles' nerve.`]); }
    }
    if (B.n <= 0) { B.n = 0; out.push(['', 'Goobles\' nerve gives out. He lies down on the steps and refuses to make eye contact with anyone.']); B.after = 'lose'; }
    else B.after = 'menu';
    B.msgs = out; B.mode = 'msg'; draw();
  }
  function endHearing(won) {
    S.battle = null; ui.hide();
    if (!won) { SV.tries++; SV.fines += 100; SV.nextTry = SV.day + 1; store(); say(HEAR_LOSE); return; }
    say(HEAR_WIN, () => {
      SV.st = 'won'; SV.booted = false; INTM.close('rv', false); store(); addCash(250); Sfx.jingle && Sfx.jingle();
      banner('MOTION DENIED', 'The eviction is suspended. +$250 (Nana passed a hat round the neighbors)', 5, 'pass');
      if (quests && quests.track) quests.track(null);
    });
  }

  // ---------- quest log ----------
  const COL = '#ffd23f';
  const chk = (x, z, label, r = 3) => (dist(x, z) > r && !inRoom() ? { x, z, r: 2.5, label, col: COL } : null);
  const giverAt = (k) => (k === 'rosie' ? { x: 29.5, z: 10.7, label: 'Rosie\'s Diner' } : k === 'earl' ? (fishing && fishing.SHOP && fishing.SHOP.mark ? { ...fishing.SHOP.mark, label: 'Earl' } : null) : NPC[k] ? { x: NPC[k].x, z: NPC[k].z, label: SIGNERS[k].name.replace(/^the /, '') } : null);
  const Q = {
    id: 'notice', kind: 'story', title: 'Notice to Vacate', giver: 'Tyrone and Sharique', where: 'your RV', reward: 250,
    blurb: 'The HOA President and his husband want the RV off Lot 1 in three days. Get neighbors to sign your petition, then beat the board at a hearing. Unpaid fines make the board stronger.',
    status: () => (SV.st === 'none' ? 'open' : SV.st === 'won' ? 'done' : 'active'),
    guide() {
      if (SV.st === 'none') return { obj: 'Somebody is waiting at your RV.', check: chk(RV.x, RV.z, 'RV') };
      if (SV.st === 'won') return { obj: 'The eviction is suspended until the HOA election.', check: null };
      if (SV.booted) return { obj: `The RV is booted. Pay $${SV.fines} at the HOA office.`, check: chk(OFFICE.door.x, OFFICE.door.z - 1.2, 'HOA office') };
      const n = nSigs();
      if (n >= NEED) {
        const extra = n < 5 ? ` More signatures help: ${SIGN_ORDER.filter((k) => !SV.sigs[k]).map((k) => SIGNERS[k].name).join(', ')}.` : '';
        return { obj: (hearingHours() ? 'The board is sitting. Face the hearing at the HOA office.' : `Face the Board Hearing at the HOA office, 6 to 9 PM.${SV.fines ? ` Pay the $${SV.fines} in fines first to make it easier.` : ''}`) + extra, check: chk(HEAR.x, HEAR.z, 'Hearing') };
      }
      const left = SIGN_ORDER.filter((k) => !SV.sigs[k]);
      let sp = null, bd = 1e9; for (const k of left) { const q = giverAt(k); if (q) { const d = dist(q.x, q.z); if (d < bd) { bd = d; sp = q; } } }
      return { obj: `Petition ${n}/5 (need ${NEED}). Help a neighbor and they'll sign: ${left.map((k) => `${SIGNERS[k].name} (${SIGNERS[k].job})`).join(', ')}.`, check: sp ? chk(sp.x, sp.z, sp.label) : null };
    },
  };
  if (quests) { const reg = quests.register || quests.add; if (reg) reg.call(quests, Q); }

  // ---------- HUD chip: EVICTION 2d 14h · FINES $340 · PETITION 2/5 ----------
  const chip = document.createElement('div'); chip.id = 'hoachip';
  chip.style.cssText = 'font-size:20px;color:#ff9a9a;display:none;text-align:right;line-height:1;';
  (document.getElementById('tr') || document.body).appendChild(chip);
  let chipTxt = '';
  function updateChip() {
    const on = active() && !inRoom();
    const t = on ? (SV.booted ? `RV BOOTED · OWE $${SV.fines}` : `EVICTION ${fmtLeft(SV.left)} · FINES $${SV.fines} · PETITION ${nSigs()}/5`) : '';
    if (t !== chipTxt) { chipTxt = t; chip.textContent = t; chip.style.display = t ? 'block' : 'none'; }
  }

  // ---------- outdoors: E + prompt ----------
  function near() {
    if (P.car || G.dialog || G.paused || ui.active || inRoom() || S.battle) return null;
    if (SV.st === 'none' || !HOA_STORY_ENABLED) return null;
    const pp = pairPos();
    if (active() && SV.fines > 0 && dist(OFFICE.door.x, OFFICE.door.z - 0.8) < 2.2) return { verb: `Pay HOA fines ($${SV.fines})`, fn: payFines };
    if (pp && dist(pp.x, pp.z) < 2.6) {
      if (active() && nSigs() >= NEED && hearingHours() && dist(HEAR.x, HEAR.z + 1.9) < 3) {
        if (SV.nextTry > SV.day) return { verb: 'Talk to the board', fn: () => say([[SH, 'You already lost tonight, Lot 1. The board sits again tomorrow at six.']]) };
        return { verb: 'Begin the Board Hearing', fn: () => say(SV.tries ? [[T_, 'Lot 1, back again! Sharique, he\'s back.'], [SH, 'I can see him, Tyrone.']] : [[T_, 'Ah. The petitioner. Take a seat. Or a stair.']], startHearing) };
      }
      return { verb: 'Talk to Tyrone and Sharique', fn: talk };
    }
    if (SV.booted && dist(RV.x, RV.z) < 3.2) return { verb: 'Check the boot', fn: () => toast(`A bright yellow HOA boot. A note in tiny, exact handwriting: "Pay $${SV.fines} at the office. - S."`, 4) };
    return null;
  }
  function talk() {
    const grp = SV.st === 'won' ? BANTER.won : SV.booted ? BANTER.booted : nSigs() >= NEED ? BANTER.ready : BANTER.early;
    const lines = pickL(grp, S.banter++).map(([w, t]) => [w, t.replace('{n}', String(nSigs()))]);
    say(lines);
  }
  const prompt = () => { const n = near(); return n ? `${key}: ${n.verb}` : ''; };
  const interact = () => { const n = near(); if (!n) return false; n.fn(); return true; };

  // ---------- per frame ----------
  function update(dt) {
    if (!HOA_STORY_ENABLED) return;
    S.t += dt; const room = inRoom();
    // the couple: shown only outdoors and within 70 m (two figures, ~10 draw calls), idle breathing
    const sg = stage(), show = !room && sg && pair.length === 2;
    if (show) {
      placePair(sg[0], sg[1]);
      const vis = dist(sg[0][0].x, sg[0][0].z) < 70;
      for (let i = 0; i < 2; i++) { pair[i].visible = vis; if (vis) { animBiped(pair[i], 0, 0, G.time + i * 1.3); if (dist(pair[i].position.x, pair[i].position.z) < 5) pair[i].rotation.y = Math.atan2(P.x - pair[i].position.x, P.z - pair[i].position.z); } }
    } else for (const m of pair) m.visible = false;
    const tbl = active() && nSigs() >= NEED && (hearingHours() || S.battle) && !room;
    if (tbl || table) { buildTable().visible = !!tbl && dist(HEAR.x, HEAR.z) < 80; }
    if (boot) boot.visible = SV.booted && !room; else if (SV.booted) buildBoot();
    // the notice: served once the player walks up to the RV (after a short warm-up so it doesn't land on the intro)
    if (SV.st === 'none' && !api.hold && !(G.heat > 0) && !room && !P.car && !G.dialog && !G.paused && S.t > 20 && !(ctx.mission && ctx.mission()) && dist(RV.x - 1.7, RV.z + 6.4) < 6) serve();
    if (active()) {
      // the clock runs on game time (one game hour per real minute)
      const c = G.clock || 0;
      if (SV.lastClock === null) SV.lastClock = c;
      const crossed = (h) => (SV.lastClock < h && c >= h) || (SV.lastClock > c && (SV.lastClock < h || c >= h));
      if (crossed(0.0001) || (SV.lastClock > c)) SV.day++;
      if (crossed(8) && !SV.booted) {
        const [what, n] = VIOLATIONS[SV.vio++ % VIOLATIONS.length]; SV.fines += n; store();
        toast(`Sharique pinned a new violation to the RV: "${what}". +$${n} in fines.`, 5); Sfx.blip && Sfx.blip(300);
      }
      SV.lastClock = c;
      if (!SV.booted && !S.battle) { SV.left -= dt; if (SV.left <= 0) { SV.left = 0; bootRV(); } }
      if (SV.booted && !room && INTM.isClosed && !INTM.isClosed('rv')) INTM.close('rv', true);
      if ((S.chkT -= dt) <= 0) { S.chkT = 1; checkSigs(false); }
      if ((S.saveT += dt) > 5) { S.saveT = 0; store(); }
    }
    if (S.battle) { P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.25); if (room) { S.battle = null; ui.hide(); } }
    updateChip();
  }
  if (SV.booted) { INTM.close('rv', true); buildBoot(); }

  const api = {
    hold: false,   // true = don't serve the notice yet (QA: other suites that teleport to the RV)
    get SV() { return SV; }, S, ui, update, prompt, interact, makeTyrone, makeSharique, pair,
    state: () => ({ st: SV.st, left: Math.round(SV.left), fines: SV.fines, sigs: nSigs(), booted: SV.booted, day: SV.day, battle: S.battle ? { r: S.battle.r, n: S.battle.n, mode: S.battle.mode, left: S.battle.left.length } : null }),
    serve, startHearing, payFines,
    sign(id) { SV.sigs[id] = 1; store(); return nSigs(); },
    clock(s) { SV.left = s; store(); return s; },
    fine(n) { SV.fines += n; store(); return SV.fines; },
    hearing: () => startHearing(),
    move(k) { const B = S.battle; if (!B) return null; if (B.mode === 'msg') { confirm(); return 'msg'; } confirm(k); return 'move'; },
    win() { if (!S.battle) startHearing(); S.battle.r = 0; S.battle.mode = 'msg'; S.battle.msgs = [['', 'debug']]; S.battle.after = 'win'; confirm(); },
    reset() { SV = fresh(); store(); S.battle = null; ui.hide(); INTM.close('rv', false); },
    talkLines: { NOTICE, HEAR_WIN, BANTER },
  };
  window.__HOA = api;
  return api;
}
