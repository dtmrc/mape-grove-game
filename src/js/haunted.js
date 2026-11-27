// Parts B and C of the Ghost of John storyline (diet's doc https://claude.ai/artifact/7tELc8RqFsxjhuysnjLJJE). Part A is hens.js.
//
// B, "Unfinished Business": some time after the hens are settled, a note is pinned to the RV door. John can't move on
//   until he finishes bust No. 12 (he never got the ears right). Fetch five things, in any order: brass (the plaque on the
//   HOA office, pry it at night or take the heat), his harmonica (Dot's lost and found at the Donut Hole, 2 fish), fresh
//   clay (dig on the ravine floor), a photo of your ears (stand still outside around noon) and reading glasses (Nana).
//   Then sit still on the stool for 60 seconds, nap by the fire, and he decides to stay anyway.
//   Rewards: bust No. 12 in the RV, the harmonica (H: play it, takes one star of heat off), a new poem.
// C, "Ghost vs. the HOA": Gary stakes out "Hollow Estates" behind the RV. Haunt the emergency HOA meeting (paw what John
//   points at until the board's nerve breaks), sabotage the site (6 stakes on a timer, the excavator's fuel cap, swap the
//   blueprints), then a menu battle against Gary in a bulldozer at the cave mouth, with John possessing parts of it.
//   Rewards: $500, the HOLLOW DEEP plaque, and John as a once-a-day scare that clears your HOA heat (G).
// Own save key mg-haunted-v1. Wired by tools/haunted-hooks.mjs (after hens). Debug: window.__HAUNT.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, basic } from './gfx.js';
import { colliders, CAVE_SPOT, SITE_SPOT } from './world.js';
import { heightAt } from './terrain.js';
import * as INTM from './interiors.js';
import { makeGhost, animGhost, ghostAlpha, bronzeBust } from './cave.js';
import { makeGary, makeNana, makeHuman, makeRaccoon } from './models.js';
import { makeFrog } from './jailbreak.js';
import { makeStoryUI } from './storyui.js';
import { KIT } from './rooms.js';

const KEY = 'mg-haunted-v1';
const JOHN = 'GHOST OF JOHN';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let sd = 7711;
const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
const rnd = (a, b) => a + rr() * (b - a);

function tint(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function at(g, x, y, z, ry = 0, rx = 0, rz = 0) { if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; }
function merge(list) { return mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n.attributes.uv) n.deleteAttribute('uv'); return n; }), false); }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
const vmat = (o = {}) => lambert({ vertexColors: true, flatShading: true, ...o });
/** A painted sign texture: lines of text fitted into w x h. */
function signTex(lines, bg, fg, w = 256, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = h / (lines.length + 0.4);
  lines.forEach((t, i) => { let s = Math.floor(lh * 0.78); do { g.font = `bold ${s}px monospace`; s -= 1; } while (g.measureText(t).width > w * 0.92 && s > 6); g.fillText(t, w / 2, lh * (i + 0.7)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); }

// ------------------------------------------------------------------ part B: words ------------------------------------------------------------------
const NOTE = [['', 'A note is pinned to the RV door with a chicken feather. The handwriting wobbles, like the pen kept going through the paper.'], ['', '"COME DOWN. PLEASE. IT\'S ABOUT THE EARS. - J"'], ['', 'Goobles stares at the note. The note does not explain itself.']];
const ASK = [
  [JOHN, 'You came! Sit. Don\'t sit. Stand there. Perfect. Don\'t move. You can move.'],
  [JOHN, 'Eleven busts, Goobles. ELEVEN. And I never once got your ears right. Too pointy. Not pointy enough. One of them looks like a rabbit. We don\'t talk about No. 7.'],
  [JOHN, 'I think that\'s why I\'m still here. Unfinished business. If I can finish No. 12, maybe I can finally go... wherever ghosts go. Brighton, probably.'],
  [JOHN, 'I need five things. Brass, for the pour: Gary has a lovely plaque on the HOA office. It comes off easier at night.'],
  [JOHN, 'My harmonica. I left it at the Donut Hole in... a while ago. Dot keeps a lost and found on the bulletin board. She\'ll want fish.'],
  [JOHN, 'Fresh clay from the bottom of the ravine. A photo of your ears in good light: just stand still outside around noon, I\'ll handle the camera.'],
  [JOHN, 'And reading glasses. Nana has a spare pair. Don\'t tell her they\'re for me. Actually, do. See what she says.'],
];
const ITEMS = {
  bronze: { name: 'Brass plaque', short: 'brass', where: 'HOA office plaque, at night' },
  harmonica: { name: 'Harmonica', short: 'harmonica', where: 'Donut Hole board, 2 fish' },
  clay: { name: 'Ravine clay', short: 'clay', where: 'ravine floor, south-west woods' },
  photo: { name: 'Photo of your ears', short: 'ears photo', where: 'stand still outside at noon' },
  glasses: { name: 'Reading glasses', short: 'glasses', where: 'ask Nana' },
};
const ITEM_ORDER = ['glasses', 'harmonica', 'bronze', 'photo', 'clay'];
const NANA_GLASSES = [['Nana', 'Reading glasses? For who? ... Oh. HIM.'], ['Nana', 'Tall, see-through, hums off-key? I knew him when he was solid, sweetie. He borrowed twenty dollars from me in 1974.'], ['Nana', 'Take my spare pair. And you tell him he still owes me for 1974. With interest. I\'ve done the math.'], ['', 'Got Nana\'s spare reading glasses. They have a little chain.']];
const DOT_NOFISH = [['Dot', 'The harmonica? Been on that board since before the fryer was new. Lost and found fee is two fish, hon.'], ['', '(Bring Dot 2 fish. Any kind. Not boots.)']];
const DOT_TRADE = [['Dot', 'Two fish. Pleasure doing business.'], ['Dot', 'Fella who left this used to sit in the corner booth and hum. Never ate a thing. Tipped in poems.'], ['', 'Got the harmonica. It is dented, and it smells faintly of sugar glaze.']];
const ALL_ITEMS = [
  [JOHN, 'You got them. All of them. You went all over town for ME. I\'m not crying. Ghosts can\'t. It\'s condensation.'],
  [JOHN, 'Nana said WHAT about 1974? ... That\'s fair. That\'s completely fair.'],
  [JOHN, 'Now the hard part. I need you to sit on that stool, and hold still, for one whole minute. I know. I know what I\'m asking.'],
];
const SIT_LINES = [
  'John: "Don\'t move. Don\'t even think about moving. Thinking makes the whiskers twitch."',
  'John: "The left ear. Yes. Yes! No. Hang on."',
  'John: "You\'re doing so well. Is this weird? Tell me if it\'s weird. Don\'t tell me, you\'d have to move."',
  'John: "I had a cat once. I think. Or I was a cat once. It gets blurry."',
  'John: "Ear number two. The difficult ear. The ear that ruined No. 7."',
  'John: "Nearly there. If you sneeze now I will haunt you. More."',
  'John: "Hold it... hold it... this is the best minute of my afterlife."',
  'John: "And... the tip. The very tip..."',
];
const BUST_DONE = [
  ['', 'John steps back. On the pedestal sits bust No. 12. The ears are right. They are exactly, perfectly right.'],
  [JOHN, 'That\'s you. That\'s actually you. Fifty years of practice and one minute of you sitting still.'],
  [JOHN, 'Can I ask one more thing? Then I\'ll never ask for anything again. Probably.'],
  [JOHN, 'Take a nap by the fire. Just a normal nap. And let me sit next to you. Not hovering. Sitting. Like a regular person.'],
  ['', 'Goobles looks at the fire. It is a very good fire. He was going to nap anyway.'],
];
const TWIST = [
  ['', 'When Goobles wakes up, John is glowing. Brighter than the fire. His edges are coming apart into little lights.'],
  [JOHN, 'Oh. Oh, this is it. It\'s happening. The business is finished. I can feel the... the Brighton.'],
  [JOHN, 'Goodbye, Goobles. Thank you for the ears. Tell Tuesday I...'],
  [JOHN, '...'],
  [JOHN, '...No. Actually, no.'],
  [JOHN, 'The acoustics down here are AMAZING. I\'ve got a piano. I\'ve got a periscope. I\'ve got a friend who brings fish. Why would I LEAVE?'],
  ['', 'The glow fades. John is exactly as see-through as before. He looks extremely pleased with himself.'],
  [JOHN, 'Take the harmonica. I\'ve got the piano. And take No. 12, it should live at your place. I wrote you a poem as well. Obviously.'],
  ['', '"THE EARS (No. 12)" - Two small tents upon a hill / that turn to hear the kibble spill. / I got them wrong eleven times. / The twelfth one sat still. That\'s the rhyme.'],
];
const B_TALK = {
  fetch: [[JOHN, 'Brass, harmonica, clay, your ears in good light, reading glasses. I made a list. I ate the list. Ghost thing.']],
  sit: [[JOHN, 'The stool. One minute. Stillness. You were born for this.']],
  done: [[JOHN, 'Play the harmonica when the HOA gets shouty. It calms people down. It never calmed ME down, but I\'m told it\'s nice.'], [JOHN, 'I look at No. 12 every day. Well. I look at YOU every day. But also No. 12.']],
};

// ------------------------------------------------------------------ part C: words ------------------------------------------------------------------
const HOOK = [
  ['', '"COMING SOON: HOLLOW ESTATES. 40 LUXURY HOMESITES. A GARY PROPERTY."'],
  ['', 'Orange survey flags run off into the trees, straight toward the west woods. Toward the cave.'],
  ['', 'Something cold taps Goobles on the shoulder. A see-through note drifts down.'],
  ['', '"HE\'LL PAVE MY HOME. HE\'LL PAVE MY BUSTS. The board votes TONIGHT at the HOA office, emergency meeting. Get in there. I\'ll do the haunting, you do the paws. - J"'],
];
const MEET_INTRO = [
  ['Gary', 'This EMERGENCY session of the Maple Grove Homeowners Association will come to ORDER.'],
  ['Gary', 'Item one, and only: Hollow Estates. Forty homesites. One gate. ZERO cats. All in favor of bulldozing a worthless patch of haunted woods?'],
  ['', 'A cold whisper by Goobles\' ear: "Stay low. When I point at something, paw it. We\'ll break their nerve before they vote."'],
];
const SCARES = {
  lights: { label: 'Paw the light switch', cue: 'John: "The LIGHTS! Hit the switch!"', hit: [['', 'The lights go out. Then on. Then out. A board member whispers, "Gary, is that in the budget?"']] },
  urn: { label: 'Paw the coffee urn', cue: 'John: "The coffee urn! Give it a shove!"', hit: [['', 'The coffee urn walks itself off the table. Decaf everywhere.'], ['Board', 'That urn was FULL, Gary. Urns don\'t just DO that.']] },
  flag: { label: 'Paw the flag pole', cue: 'John: "The flag! Knock the flag!"', hit: [['', 'The HOA flag falls over, very slowly, onto the treasurer. John hums a funeral march through it.']] },
  projector: { label: 'Paw the projector', cue: 'John: "The projector! I\'ve got a slide for them!"', hit: [['', 'The projector flickers. The Hollow Estates site plan is replaced by a cave painting of a cat. The cat looks disappointed in everyone.'], ['Board', 'I move that we move. Out of this room.']] },
  gavel: { label: 'Paw the gavel', cue: 'John: "His gavel! While he\'s not looking!"', hit: [['', 'The gavel floats up, bonks the podium three times by itself, and declares the meeting adjourned in a voice like wind in a drainpipe.']] },
};
const SCARE_ORDER = ['lights', 'urn', 'flag', 'projector', 'gavel'];
const GARY_MEET = ['Gary: "It\'s a DRAFT. Old building. Sit DOWN, Linda."', 'Gary: "Ghosts are not in the bylaws. I WROTE the bylaws."', 'Gary: "Nobody leaves until I get a second on this motion!"', 'Gary: "That is NORMAL urn behavior!"'];
const MEET_WIN = [
  ['Board', 'Motion to table Hollow Estates until this building has been looked at by a priest. Or a plumber. Seconded. Carried. Goodbye.'],
  ['', 'The board leaves at a brisk walk that is legally not a run.'],
  ['Gary', 'It\'s the CAT. It\'s that CAT and his... his DRAFT. Fine. FINE. I don\'t need a vote. I have a BULLDOZER.'],
  ['', 'John, by your ear: "He\'s bringing machines anyway. The site, behind your RV. Pull his stakes, drain his digger, and swap his blueprints for this." A rolled-up cave painting appears in your paw.'],
];
const MEET_FAIL = 'Gary spots a white tail under the chairs. "CAT!" You are escorted out by the scruff. The meeting is still going. Try again.';
const SITE_DONE = [
  ['', 'Stakes pulled. The excavator is bone dry. The site plan in the trailer is now a cave painting of a cat doing nothing.'],
  ['', 'From the west, deep in the woods: a diesel engine. A big one. And someone yelling over it.'],
  ['', 'John\'s note flutters down, written very fast: "HE BROUGHT THE BULLDOZER. HE\'S COMING DOWN THE LANE. MY BUSTS!!!"'],
];
const BOSS_INTRO = [
  ['Gary', 'YOU. Of COURSE it\'s you.'],
  ['Gary', 'Do you know what this is? This is a D9. I rented it with the POOL FUND. There is a cave on MY future cul-de-sac and I am going to DELETE it.'],
  [JOHN, 'Goobles! I can possess bits of it if you keep him busy. Paw the glowing panels. And whatever you do, don\'t let him reach my front door!'],
];
const RANTS = [
  ['I have a LAMINATOR, cat. I can make ANYTHING official!', 'This is a PERMITTED activity! I permitted it! Myself! This morning!', 'Section 9, paragraph 4: no caves! I\'ll WRITE section 9!', 'You are in violation of being IN MY WAY!'],
  ['Why is the horn playing a TUNE. Why does it SOUND LIKE HIM.', 'I can hear HUMMING in the hydraulics! STOP HUMMING!', 'I fined a CLOUD once! For LOITERING! I\'ll fine a GHOST!', 'The woods are a NUISANCE STRUCTURE! Trees are just unlicensed FENCES!'],
  ['I AM THE HOA. THE HOA IS ME. WE ARE A SINGLE-FAMILY DWELLING!', 'I WILL PAVE THE CAVE. I WILL PAVE THE LAKE. I WILL PAVE THE CONCEPT OF WEST!', 'MY MOTHER SAID I COULDN\'T RUN A CUL-DE-SAC. LOOK AT ME NOW, MOTHER. LOOK AT MY BLADE!', 'THERE IS A CHICKEN ON MY WINDSHIELD AND IT IS TRANSPARENT AND I DO NOT ACCEPT IT!', 'BEIGE! EVERYTHING WILL BE BEIGE! EVEN THE GHOST!'],
];
const BOSS_WIN = [
  ['', 'The seat fires Gary straight up out of the cab. The bulldozer, driverless, turns itself politely south, rolls off down the gully and parks in Juniper Creek.'],
  ['', 'Gary lands in a bush. His clothes stayed on the seat. He climbs out in a pink bathrobe he was apparently wearing underneath the whole time.'],
  ['Gary', 'This isn\'t over. I\'m going to write a LETTER. To MYSELF. And then I\'m going to APPROVE it.'],
  ['', 'A county truck pulls up. Big Ricky hops out of the passenger side with a folder.'],
  ['Big Ricky', 'Hollow Woods. Protected habitat, as of this morning. Me and the boys filed the paperwork. Turns out raccoons count as wildlife. Who knew.'],
  ['', 'The county officer hands Gary a fine. It is from the Maple Grove HOA, for "unsightly equipment in a creek". Gary signed the rule himself in 2019.'],
  [JOHN, 'We did it! WE did it. You did it. I mostly hummed. Party at mine! Bring everyone! All 1,940 metres down!'],
];
const PARTY = [
  ['', 'The dwelling is full. There are balloons. Nobody knows where a ghost got balloons.'],
  ['Nana', 'I took the rope down. All of it. My hip has never felt better. John, sweetie: twenty dollars.'],
  [JOHN, 'I\'ve only got ghost money, Nana. It\'s just leaves.'],
  ['Bart', 'Nice place. Bit dry. Nine out of ten, would live in the toilet again though.'],
  ['Big Ricky', 'To Goobles. Who paws first and asks questions never.'],
  ['', 'Up at the cave mouth, Tube Dude is waving. He did not fit down the hole. He is having a great time anyway.'],
  [JOHN, 'Goobles. I haunted you for a year and you never once looked impressed. And then you fought a bulldozer for me.'],
  [JOHN, 'If the HOA ever gives you grief again, just think of me. Loudly. I\'ll come and say boo. Once a day. A ghost needs his rest.'],
  ['', 'Goobles yawns, curls up by the fire, and goes to sleep in the middle of his own party. Everyone agrees this is the correct response.'],
];
const C_TALK = { early: [[JOHN, 'Orange flags in my woods, Goobles. ORANGE. It doesn\'t even go with the trees.']], done: [[JOHN, 'Nana comes down on Thursdays now. We play cards. She cheats. I\'m see-through and SHE cheats.'], [JOHN, 'Need a boo? Think of me loudly. Once a day.']] };

const GARY_MAX = 180, DIST0 = 40;

export function makeHaunted(ctx) {
  const { scene, G, P, cat, places, NPC, fishing, quests, cave, hens, say, toast, Sfx, addCash, addHeat, hit, isTouch } = ctx;
  const key = isTouch ? 'USE' : 'E';
  const ui = makeStoryUI({ Sfx, isTouch });
  const fresh = () => ({ b: 'none', items: {}, bWait: 0, bDoneDay: null, c: 'none', cWait: 0, stakes: 0, cap: 0, plans: 0, tries: 0, summonDay: -1, harm: 0 });
  let SV = {}; try { SV = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { SV = {}; }
  SV = Object.assign(fresh(), SV); SV.items ||= {};
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) { /* private mode */ } };
  const S = { t: 0, pry: 0, dig: 0, still: 0, lx: 0, lz: 0, sit: null, nap: null, meet: null, stakeT: 0, capN: 0, battle: null, win: null, tune: null, harmCd: 0, boo: null, lairBuilt: false, rvBust: false, noteHint: false };
  const api = { S, ui, get SV() { return SV; } };
  const day = () => (hens && hens.SV ? hens.SV.day | 0 : 0);
  const aDone = () => !!(hens && hens.SV && (hens.SV.stage === 'deal' || hens.SV.stage === 'freed'));
  const dist = (x, z) => Math.hypot(P.x - x, P.z - z);
  const inRoom = () => INTM.current();
  const lairRoot = () => (cave && cave.ghost ? cave.ghost.parent : null);
  const gh = () => cave && cave.S && cave.S.gh;
  const nItems = () => ITEM_ORDER.filter((k) => SV.items[k]).length;
  const fishList = () => (fishing && fishing.S ? fishing.S.bag.filter((f) => !(fishing.FISH[f.id] && fishing.FISH[f.id].junk) && !f.hat) : []);
  const night = () => { const c = G.clock || 0; return c >= 21 || c < 5; };
  const inLayer1 = (o) => { o.traverse((x) => { x.layers.set(1); x.userData.noLift = true; }); return o; };

  // ---------- places ----------
  const C = CAVE_SPOT, cy = C.yaw;
  const L2W = (lx, lz) => [C.x + lx * Math.cos(cy) + lz * Math.sin(cy), C.z - lx * Math.sin(cy) + lz * Math.cos(cy)];
  const HOA = { x: -50, z: -44, door: { x: -50, z: -48.3 }, plaque: { x: -47.9, z: -47.58 } };   // world.js: the brick MAPLE GROVE HOA office, front faces -z
  const CLAY = { x: -244, z: 250 };
  const SITE = SITE_SPOT;
  const STAKES = [[-6.5, -5], [-2, -6.5], [3.5, -5.5], [7.5, -1], [5, 5.5], [-5.5, 5]].map(([x, z]) => ({ x: SITE.x + x, z: SITE.z + z }));
  const DIGGER = { x: SITE.x - 3.5, z: SITE.z + 0.5 }, TRAILER = { x: SITE.x + 4.5, z: SITE.z + 2.5 }, SIGN = { x: SITE.x + 8.5, z: SITE.z - 6.5 };

  // ================================================================== outdoor props ==================================================================
  const glowT = glowTex();
  const glowMat = (c) => new THREE.SpriteMaterial({ map: glowT, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  // the brass plaque on the HOA office
  const plaque = new THREE.Mesh(merge([tint(box(0.9, 0.55, 0.05), 0xd8a838), tint(at(box(0.7, 0.06, 0.02), 0, 0.12, -0.03), 0x6a4a10), tint(at(box(0.7, 0.06, 0.02), 0, -0.02, -0.03), 0x6a4a10), tint(at(box(0.5, 0.06, 0.02), 0, -0.16, -0.03), 0x6a4a10)]), vmat({ emissive: 0x2a1c00 }));
  plaque.position.set(HOA.plaque.x, 1.55, HOA.plaque.z); plaque.visible = false; scene.add(plaque);
  // the clay dig spot
  const claySpot = new THREE.Group(); claySpot.position.set(CLAY.x, 0, CLAY.z); claySpot.visible = false; scene.add(claySpot);
  { const d = new THREE.Mesh(new THREE.CircleGeometry(0.7, 10).rotateX(-Math.PI / 2), lambert({ color: 0xb06a48 })); d.position.y = 0.06; claySpot.add(d); const g = new THREE.Sprite(glowMat(0xffc080)); g.scale.setScalar(2.2); g.position.y = 0.5; claySpot.add(g); claySpot.userData.glow = g; }
  // Hollow Estates: the sign, six stakes, later the excavator and the site trailer
  const site = new THREE.Group(); site.visible = false; scene.add(site); site.userData.noLift = true;
  const stakeM = []; let digger = null, trailer = null, siteSign = null, habitat = null; const siteCols = [];
  function buildSite() {
    if (site.userData.built) return; site.userData.built = true;
    const hy = (x, z) => heightAt(x, z);
    // sign
    siteSign = new THREE.Group(); siteSign.position.set(SIGN.x, hy(SIGN.x, SIGN.z), SIGN.z); siteSign.rotation.y = -0.7; site.add(siteSign);
    siteSign.add(new THREE.Mesh(merge([tint(at(box(0.12, 2.6, 0.12), -1.3, 1.3, 0), 0x8a6a40), tint(at(box(0.12, 2.6, 0.12), 1.3, 1.3, 0), 0x8a6a40), tint(at(box(3.0, 1.5, 0.06), 0, 1.9, 0), 0xf4f0e0)]), vmat()));
    const st = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.4), basic({ map: signTex(['COMING SOON', 'HOLLOW ESTATES', '40 LUXURY HOMESITES', 'A GARY PROPERTY'], '#f4f0e0', '#1e2a44', 384, 192) })); st.position.set(0, 1.9, 0.04); siteSign.add(st);
    habitat = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.4), basic({ map: signTex(['HOLLOW WOODS', 'PROTECTED HABITAT', 'filed by: the raccoons'], '#2a5a34', '#f0e6c8', 384, 192) })); habitat.position.set(0, 1.9, 0.05); habitat.visible = false; siteSign.add(habitat);
    // stakes with orange flags
    const sg = merge([tint(at(box(0.05, 0.9, 0.05), 0, 0.45, 0), 0xc8a878), tint(at(box(0.3, 0.2, 0.01), 0.17, 0.78, 0), 0xff6a10)]);
    const sm = vmat({ side: THREE.DoubleSide, emissive: 0x331400 });
    for (const s of STAKES) { const m = new THREE.Mesh(sg, sm); m.position.set(s.x, hy(s.x, s.z), s.z); m.rotation.y = rnd(0, 6); site.add(m); stakeM.push(m); }
    // a trail of flags toward the west woods (set dressing)
    const fl = []; for (let k = 1; k <= 7; k++) { const x = SITE.x - 10 - k * 9, z = SITE.z + 3 + Math.sin(k * 1.7) * 3; fl.push(tint(at(box(0.05, 0.9, 0.05), x, hy(x, z) + 0.45, z), 0xc8a878), tint(at(box(0.3, 0.2, 0.01), x + 0.17, hy(x, z) + 0.78, z), 0xff6a10)); }
    site.userData.flags = new THREE.Mesh(merge(fl), sm); site.add(site.userData.flags);
    // excavator
    digger = new THREE.Group(); digger.position.set(DIGGER.x, hy(DIGGER.x, DIGGER.z), DIGGER.z); digger.rotation.y = 0.5; site.add(digger);
    { const Y = 0xf0b020, D = 0x2a2a2e, p = [];
      for (const s of [-1, 1]) p.push(tint(at(box(0.6, 0.6, 3.4), s * 1.0, 0.3, 0), D));
      p.push(tint(at(box(2.2, 0.9, 2.6), 0, 1.15, -0.1), Y), tint(at(box(1.0, 1.1, 1.2), -0.5, 2.15, 0.4), Y), tint(at(box(0.9, 0.7, 0.04), -0.5, 2.25, 1.02), 0x8ac0e0));
      p.push(tint(at(box(0.36, 2.8, 0.36), 0.6, 2.6, 1.4, 0, 0.75), Y), tint(at(box(0.3, 2.4, 0.3), 0.6, 2.5, 3.2, 0, -0.55), Y), tint(at(box(0.8, 0.6, 0.7), 0.6, 1.3, 3.9), D));
      p.push(tint(at(cyl(0.12, 0.12, 0.14, 8), 0.7, 1.67, -0.9), 0xd02020));   // the fuel cap
      digger.add(new THREE.Mesh(merge(p), vmat())); }
    // site trailer
    trailer = new THREE.Group(); trailer.position.set(TRAILER.x, hy(TRAILER.x, TRAILER.z), TRAILER.z); trailer.rotation.y = -0.4; site.add(trailer);
    { const p = [tint(at(box(4.4, 2.2, 2.2), 0, 1.5, 0), 0xe8e4d8), tint(at(box(4.5, 0.12, 2.3), 0, 2.66, 0), 0x8a8a90), tint(at(box(0.8, 1.7, 0.05), -1.0, 1.3, 1.11), 0x4a5a6a), tint(at(box(1.0, 0.7, 0.05), 0.8, 1.7, 1.11), 0x8ac0e0), tint(at(box(1.0, 0.25, 0.7), -1.0, 0.3, 1.5), 0x8a8a90)];
      for (const [x, z] of [[-1.8, -0.9], [1.8, -0.9], [-1.8, 0.9], [1.8, 0.9]]) p.push(tint(at(box(0.25, 0.4, 0.25), x, 0.2, z), 0x6a6a70));
      trailer.add(new THREE.Mesh(merge(p), vmat()));
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), basic({ map: signTex(['GARY PROPERTIES'], '#1e2a44', '#f0e6c8', 256, 64) })); s2.position.set(0.6, 2.35, 1.12); trailer.add(s2); }
    site.traverse((o) => { o.userData.noLift = true; });
  }
  function siteSolid(on) {
    if (on && !siteCols.length) { for (const [x, z, r] of [[DIGGER.x, DIGGER.z, 1.7], [TRAILER.x - 1, TRAILER.z + 0.4, 1.4], [TRAILER.x + 1, TRAILER.z - 0.4, 1.4]]) { const c = { cx: x, cz: z, r, h: 3, ng: true, nf: true, haunt: true }; siteCols.push(c); colliders.push(c); } }
    if (!on && siteCols.length) { for (const c of siteCols) { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); } siteCols.length = 0; }
  }
  // the bulldozer, Gary in the cab, three glowing panels
  const dozer = new THREE.Group(); dozer.visible = false; scene.add(dozer);
  let dozerBuilt = false; const dozerCol = { cx: 0, cz: 0, r: 2.3, h: 3.4, ng: true, nf: true, haunt: true };
  function buildDozer() {
    if (dozerBuilt) return; dozerBuilt = true;
    const Y = 0xf0b020, D = 0x2a2a2e, p = [];
    for (const s of [-1, 1]) { p.push(tint(at(box(0.7, 0.9, 4.4), s * 1.25, 0.45, 0), D)); for (let k = 0; k < 7; k++) p.push(tint(at(box(0.74, 0.08, 0.3), s * 1.25, 0.92, -1.9 + k * 0.63), 0x4a4a50)); }
    p.push(tint(at(box(2.0, 1.1, 3.6), 0, 1.35, 0.1), Y), tint(at(box(1.9, 0.5, 1.7), 0, 2.1, 1.0), Y));
    for (const [x, z] of [[-0.85, -1.5], [0.85, -1.5], [-0.85, 0.0], [0.85, 0.0]]) p.push(tint(at(box(0.1, 1.5, 0.1), x, 2.65, z), D));
    p.push(tint(at(box(2.0, 0.1, 1.8), 0, 3.42, -0.75), Y), tint(at(cyl(0.09, 0.09, 1.1, 6), 0.6, 2.9, 1.5), D), tint(at(box(0.9, 0.5, 0.6), 0, 1.95, -0.9), 0x3a3a40));
    const body = new THREE.Mesh(merge(p), vmat()); dozer.add(body);
    const blade = new THREE.Group(); blade.position.set(0, 0.7, 2.5); dozer.add(blade); dozer.userData.blade = blade;
    blade.add(new THREE.Mesh(merge([tint(at(box(3.6, 1.3, 0.16), 0, 0.2, 0.55), 0xc89010), tint(at(box(3.6, 0.2, 0.4), 0, -0.4, 0.7), 0x8a8a90), tint(at(box(0.16, 0.2, 1.4), -1.3, 0.1, -0.1), D), tint(at(box(0.16, 0.2, 1.4), 1.3, 0.1, -0.1), D)]), vmat()));
    const gary = makeGary(); gary.scale.setScalar(0.92); gary.position.set(0, 1.55, -0.85); dozer.add(gary); dozer.userData.gary = gary;
    dozer.userData.panels = [[-1.02, 1.5, 0.4], [1.02, 1.5, 0.4], [0, 1.5, -1.72]].map(([x, y, z]) => { const s = new THREE.Sprite(glowMat(0x80ffb0)); s.position.set(x * 1.05, y, z); s.scale.setScalar(0.9); dozer.add(s); return s; });
  }
  const robeGary = { m: null };
  // the outdoor ghost (possessing the dozer, the summon)
  const og = makeGhost(); og.visible = false; og.userData.noLift = true; ghostAlpha(og, 0); scene.add(og);
  // HOLLOW DEEP plaque at the cave mouth, after part C
  const deep = new THREE.Group(); { const [x, z] = L2W(3.1, 2.3); deep.position.set(x, 0, z); deep.rotation.y = cy - 0.3; deep.visible = false; scene.add(deep); api.DEEP = { x, z }; }
  function buildDeep() { if (deep.userData.built) return; deep.userData.built = true; deep.add(new THREE.Mesh(merge([tint(at(box(0.9, 0.5, 0.7), 0, 0.25, 0), 0x7a7468), tint(at(box(0.8, 0.5, 0.05), 0, 0.6, 0.1, 0, -0.5), 0xd8a838)]), vmat({ emissive: 0x1a1000 }))); const s = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.44), basic({ map: signTex(['THE HOLLOW DEEP', 'protected habitat', 'est. a while ago'], '#d8a838', '#3a2408', 256, 128) })); s.rotation.x = -0.5; s.position.set(0, 0.62, 0.135); deep.add(s); }

  // ================================================================== the lair: stool, pedestal, bust No. 12, party ==================================================================
  const LAIR = { stool: { x: 3.2, z: 2.4 }, ped: { x: 5.2, z: 1.2 }, john: { x: 5.2, z: 2.5 } };
  const lair = { stool: null, ped: null, bust: null, party: null };
  function buildLair() {
    const root = lairRoot(); if (!root || S.lairBuilt) return; S.lairBuilt = true;
    lair.stool = new THREE.Mesh(merge([tint(at(cyl(0.26, 0.26, 0.07, 10), 0, 0.5, 0), 0x9a6a40), ...[0, 1, 2].map((k) => tint(at(box(0.05, 0.5, 0.05), Math.cos(k * 2.09) * 0.18, 0.25, Math.sin(k * 2.09) * 0.18), 0x6a4a2a))]), vmat());
    lair.stool.position.set(LAIR.stool.x, 0, LAIR.stool.z); root.add(lair.stool);
    lair.ped = new THREE.Group(); lair.ped.position.set(LAIR.ped.x, 0, LAIR.ped.z); root.add(lair.ped);
    lair.ped.add(new THREE.Mesh(merge([tint(at(box(0.5, 0.9, 0.5), 0, 0.45, 0), 0x8a8478), tint(at(box(0.6, 0.06, 0.6), 0, 0.93, 0), 0x9a9488), tint(at(new THREE.IcosahedronGeometry(0.2, 0), 0, 1.14, 0), 0xb06a48)]), vmat()));
    lair.clayLump = lair.ped.children[0];
    lair.bust = bronzeBust(root, LAIR.ped.x, LAIR.ped.z, -0.9, 1.15, 0.9); lair.bust.visible = false;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), basic({ map: signTex(['No. 12'], '#d8a838', '#3a2408', 128, 48) })); tag.position.set(0, 0.6, 0.3); lair.bust.add(tag);
    // the party: banner, balloons, guests
    const pg = lair.party = new THREE.Group(); pg.visible = false; root.add(pg);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.9), basic({ map: signTex(['THANK YOU GOOBLES'], '#f0e6c8', '#a02a3a', 512, 96), side: THREE.DoubleSide })); ban.position.set(0, 3.5, -3.4); pg.add(ban);
    const bl = []; for (let k = 0; k < 12; k++) { const a = k * 0.55, r = 4 + (k % 3), x = Math.cos(a) * r, z = -1 + Math.sin(a) * r, y = 2.3 + (k % 4) * 0.35; bl.push(tint(at(new THREE.IcosahedronGeometry(0.26, 1), x, y, z), [0xff5a6a, 0xffd23f, 0x6ad0ff, 0x8aff9a][k % 4]), tint(at(box(0.012, y - 0.2, 0.012), x, (y - 0.2) / 2, z), 0xe0e0e0)); }
    pg.add(new THREE.Mesh(merge(bl), vmat({ emissive: 0x181818 })));
    const guest = (m, x, z, ry, s = 1) => { m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(s); pg.add(m); return m; };
    try { guest(makeNana(), -2.8, 1.4, 2.2); guest(makeFrog(), 1.4, 2.2, -2.6, 1.3); guest(makeRaccoon(), 3.0, -2.8, -1.2); } catch (e) { console.error('[haunted] party guests', e); }
    inLayer1(lair.stool); inLayer1(lair.ped); inLayer1(lair.bust); inLayer1(pg);
  }
  function syncLair() {
    if (!S.lairBuilt) return;
    const showSit = SV.b === 'fetch' || SV.b === 'sit' || SV.b === 'done';
    lair.stool.visible = showSit; lair.ped.visible = showSit && SV.b !== 'done'; lair.bust.visible = SV.b === 'done';
    lair.party.visible = SV.c === 'party' || SV.c === 'done';
  }
  // bust No. 12 in the RV
  let rvBust = null;
  INTM.on('enter', (id) => {
    if (id === 'cavelair') { try { buildLair(); syncLair(); } catch (e) { console.error('[haunted] lair', e); } }
    if (id === 'rv' && SV.b === 'done' && !rvBust) { const R = window.__INT && window.__INT.room; if (R && R.group) { try { rvBust = bronzeBust(R.group, -2.1, 0.95, Math.PI, 0.8, 0.45); inLayer1(rvBust); } catch (e) { console.error('[haunted] rv bust', e); } } }
    if (id === 'hoahall') S.meetPending = true;
  });
  INTM.on('exit', (id) => { if (id === 'hoahall') { S.meet = null; ui.meter(null); } if (id === 'cavelair') { S.sit = null; if (S.nap) { S.nap = null; ui.veil(0); } ui.meter(null); } });
  // Dot's lost and found: the bulletin board in the Donut Hole
  INTM.on('interact', (id, spot) => {
    if (id !== 'donut' || spot !== 'board' || SV.b !== 'fetch' || SV.items.harmonica) return false;
    const f = fishList();
    if (f.length < 2) { say(DOT_NOFISH); return true; }
    for (const x of f.slice(0, 2)) { const b = fishing.S.bag, i = b.indexOf(x); if (i >= 0) b.splice(i, 1); }
    if (fishing.removeFish) fishing.removeFish('__none__', 0);   // saves the bag
    say(DOT_TRADE, () => gotItem('harmonica'));
    return true;
  });

  // ================================================================== the HOA office meeting room ==================================================================
  const HALL = { W: 18, D: 12 };
  const SPOTS = { lights: { x: -8.3, z: 1.5 }, urn: { x: 7.3, z: 2.2 }, flag: { x: 6.6, z: -4.6 }, projector: { x: 0, z: 2.6 }, gavel: { x: 1.3, z: -3.5 } };
  const hall = { glow: {}, ghost: null, gary: null, board: [], urn: null, flag: null, lightsOn: true };
  function buildHall() {
    const root = new THREE.Group(), cols = [], W = HALL.W, D = HALL.D, H = 3.2;
    const p = [];
    // the set: carpet tiles + runner, beige wallpaper over walnut wainscot, drop ceiling with fluorescent troffers
    // (the shell had no ceiling before 2026-11-27; built with the rooms.js KIT so the room bake reads like the others)
    const { ctex, grime, makeBuilder, shell, framedPicture, signTex: kSign } = KIT;
    KIT.reseed(77);
    const B = makeBuilder(THREE, null);
    const carpet = ctex(THREE, 'hoa:carpet', 64, 64, (g) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#7a6a5a' : '#706050'; g.fillRect(x * 32, y * 32, 32, 32); }
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${KIT.rnd() < 0.5 ? '40,30,20' : '200,180,150'},${0.12 * KIT.rnd()})`; g.fillRect(KIT.rnd() * 64, KIT.rnd() * 64, 1, 1); }
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.strokeRect(0.5, 0.5, 63, 63); g.fillStyle = 'rgba(60,40,20,0.22)'; g.beginPath(); g.ellipse(44, 18, 6, 4, 0.4, 0, 7); g.fill();   // coffee
    });
    const runner = ctex(THREE, 'hoa:runner', 32, 64, (g) => { g.fillStyle = '#1e2a44'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#c8a030'; g.fillRect(2, 0, 2, 64); g.fillRect(28, 0, 2, 64); grime(g, 32, 64, 160, 0.18); });
    const paper = ctex(THREE, 'hoa:paper', 64, 64, (g) => {
      g.fillStyle = '#e2d6b8'; g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 16) { g.fillStyle = 'rgba(150,120,80,0.16)'; g.fillRect(x, 0, 6, 64); }
      for (let y = 8; y < 64; y += 16) for (let x = 11; x < 64; x += 16) { g.fillStyle = 'rgba(140,110,70,0.28)'; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 2, y); g.lineTo(x, y + 3); g.lineTo(x - 2, y); g.fill(); }
      grime(g, 64, 64, 80, 0.07);
    });
    const panel = ctex(THREE, 'hoa:panel', 64, 64, (g) => {
      g.fillStyle = '#5a3a24'; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${KIT.rnd() < 0.5 ? '30,18,8' : '110,74,44'},0.35)`; g.fillRect(0, KIT.rnd() * 64, 64, 1); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, 2, 64); g.fillStyle = 'rgba(255,220,170,0.12)'; g.fillRect(2, 0, 2, 64);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.strokeRect(10, 8, 44, 48); g.strokeStyle = 'rgba(255,210,160,0.12)'; g.strokeRect(12, 10, 40, 44);
    });
    const tiles = ctex(THREE, 'hoa:ceil', 64, 64, (g) => { g.fillStyle = '#ece6da'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(KIT.rnd() * 64, KIT.rnd() * 64, 1, 1); } g.strokeStyle = '#b8b4ac'; g.lineWidth = 3; g.strokeRect(0, 0, 64, 64); g.fillStyle = 'rgba(160,110,40,0.3)'; g.beginPath(); g.arc(20, 44, 7, 0, 7); g.fill(); });
    B.def('carpet', { kind: 'lambert', map: carpet }); B.def('runner', { kind: 'lambert', map: runner }); B.def('paper', { kind: 'lambert', map: paper });
    B.def('panel', { kind: 'lambert', map: panel }); B.def('tiles', { kind: 'lambert', map: tiles });
    for (const c of shell(B, THREE, { w: W, d: D, h: H, floorKey: 'carpet', wallKey: 'paper', ceilKey: 'tiles', ceilCol: 0xffffff, door: { x: 0, w: 1.1, h: 2.15 }, base: 0x2a1a10, frame: 0x4a3020, wallTile: 1.4, floorTile: 1.2, trim: { c: 0x3a2414, y: 1.08, h: 0.07 } })) cols.push(c);
    for (const [cx, cz, len, ry] of [[0, -D / 2 + 0.008, W, 0], [-W / 2 + 0.008, 0, D, Math.PI / 2], [W / 2 - 0.008, 0, D, -Math.PI / 2], [-W / 4 - 0.3, D / 2 - 0.008, W / 2 - 0.6, Math.PI], [W / 4 + 0.3, D / 2 - 0.008, W / 2 - 0.6, Math.PI]]) B.quad('panel', 0xffffff, len, 1.04, cx, 0.54, cz, ry, { us: len / 1.1, vs: 1, ao: false, tint: false, paint: (_x, y) => 0.75 + 0.25 * (y / 1.1) });
    B.flat('runner', 0xffffff, 1.4, D - 2.2, 0, 0.012, 0.6, 0, { vs: 4, ao: false, tint: false });
    // troffers: a frame + a glowing diffuser per ceiling light
    for (const [x, z] of [[-5, -2], [0, -2], [5, -2], [-5, 2.5], [0, 2.5], [5, 2.5]]) { B.box('plain', 0xd8d4cc, 1.3, 0.05, 0.7, x, H - 0.03, z, 0, { ao: false }); B.flat('glow', 0xfff6e4, 1.18, 0.58, x, H - 0.06, z, 0, { down: true, ao: false, tint: false }); }
    // portraits of past HOA presidents (all Gary), framed rules, a clock, a fire-exit sign, a ficus in each back corner
    const garyPic = (k) => ctex(THREE, 'hoa:gary' + k, 48, 64, (g) => { g.fillStyle = ['#3a4a6a', '#5a3a3a', '#3a5a4a'][k]; g.fillRect(0, 0, 48, 64); g.fillStyle = '#e8c8a8'; g.beginPath(); g.ellipse(24, 26, 11, 14, 0, 0, 7); g.fill(); g.fillStyle = '#6a5040'; g.fillRect(13, 12, 22, 6); g.fillStyle = '#2a2a30'; g.fillRect(10, 44, 28, 20); g.fillStyle = '#fff'; g.fillRect(22, 44, 4, 10); g.fillStyle = '#111'; g.fillRect(19, 24, 3, 2); g.fillRect(27, 24, 3, 2); g.fillRect(20, 33, 9, 1); g.fillStyle = '#c8a030'; g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.fillText(['GARY 2009', 'GARY 2015', 'GARY 2021'][k], 24, 62); }, { repeat: false });
    [-7.4, -5.6, -3.8].forEach((x, k) => { B.def('gp' + k, { kind: 'lambert', map: garyPic(k) }); framedPicture(B, THREE, 'gp' + k, 0.6, 0.8, x, 1.95, -D / 2 + 0.03, 0, 0xb08a30); });
    B.def('rules', { kind: 'lambert', map: kSign(THREE, 'hoa:rules', ['HOA RULES', '1. beige', '2. no cats', '3. see rule 1'], '#f8f4e8', '#2a2a30', 96, 128, { font: 'serif' }) });
    framedPicture(B, THREE, 'rules', 0.7, 0.9, W / 2 - 0.03, 1.8, -2.4, -Math.PI / 2, 0x3a2414);
    B.def('exit', { kind: 'basic', map: kSign(THREE, 'hoa:exit', ['EXIT'], '#3a0a0a', '#ff4a3a', 64, 24, { glow: true }) });
    B.box('plain', 0xe8e4d8, 0.62, 0.24, 0.08, 0, 2.48, D / 2 - 0.05, 0, { ao: false }); B.quad('exit', 0xffffff, 0.56, 0.2, 0, 2.48, D / 2 - 0.095, Math.PI, { ao: false, tint: false });
    B.cyl('plain', 0xf4f4f0, 0.24, 0.24, 0.05, -W / 2 + 0.04, 2.45, 2.5, 16, { ao: false, rz: Math.PI / 2 }); B.cyl('plain', 0x2a2a30, 0.26, 0.26, 0.03, -W / 2 + 0.02, 2.45, 2.5, 16, { ao: false, rz: Math.PI / 2 });
    for (const [x, z] of [[-W / 2 + 0.6, -D / 2 + 0.6], [W / 2 - 0.6, D / 2 - 0.7]]) {
      B.cyl('plain', 0x8a5a3a, 0.24, 0.18, 0.42, x, 0.21, z, 10); B.cyl('plain', 0x3a2a1a, 0.22, 0.22, 0.02, x, 0.42, z, 10, { ao: false });
      B.cyl('wood', 0x5a3a20, 0.025, 0.035, 1.2, x, 1.0, z, 5);
      for (let k = 0; k < 14; k++) { const a = k * 2.4, y = 1.0 + (k % 5) * 0.18; B.sph('plain', k % 3 ? 0x3a6a2a : 0x4a7a32, 0.18 + 0.05 * (k % 3), x + Math.sin(a) * 0.22, y + 0.3, z + Math.cos(a) * 0.22, { ws: 5, hs: 4, s: [1, 0.6, 1] }); }
      cols.push({ kind: 'box', cx: x, cz: z, w: 0.5, d: 0.5, rot: 0, h: 1.6 });
    }
    // refreshments table runner + stacked styrofoam cups and a plate of beige cookies by the urn
    B.box('plain', 0xf4f0e8, 1.04, 0.02, 2.44, 8.2, 0.81, 2.2, 0, { ao: false });
    for (let k = 0; k < 3; k++) B.cyl('plain', 0xf8f8f4, 0.045, 0.035, 0.32, 8.0 + k * 0.12, 0.98, 1.3, 8, { ao: false });
    B.cyl('plain', 0xf4f4f0, 0.18, 0.15, 0.03, 8.25, 0.835, 3.1, 12, { ao: false }); for (let k = 0; k < 6; k++) B.cyl('plain', 0xd8c090, 0.04, 0.04, 0.015, 8.25 + Math.sin(k) * 0.08, 0.86 + (k % 2) * 0.016, 3.1 + Math.cos(k) * 0.08, 8, { ao: false });
    // folding chairs for the public, two rows facing the board
    for (const z of [1.4, 2.6]) for (const x of [-5.8, -4.6, 4.6, 5.8]) {
      B.box('shiny', 0x6a6a72, 0.46, 0.04, 0.44, x, 0.46, z, 0, { ao: false }); B.box('shiny', 0x6a6a72, 0.46, 0.4, 0.03, x, 0.74, z + 0.22, 0, { ao: false });
      for (const e of [-1, 1]) { B.box('shiny', 0x3a3a40, 0.025, 0.95, 0.025, x + e * 0.21, 0.47, z + 0.2, 0, { ao: false, rx: -0.08 }); B.box('shiny', 0x3a3a40, 0.025, 0.47, 0.025, x + e * 0.21, 0.23, z - 0.18, 0, { ao: false }); }
      cols.push({ kind: 'box', cx: x, cz: z, w: 0.46, d: 0.46, rot: 0, h: 0.5 });
    }
    root.add(B.finish(new THREE.Group()));
    // podium, gavel, board chairs, table with the urn, projector cart, flag, light switch, door
    p.push(tint(at(box(1.1, 1.15, 0.7), 0, 0.57, -4.2), 0x6a4a2a), tint(at(box(1.2, 0.06, 0.8), 0, 1.17, -4.2), 0x8a6a40));
    p.push(tint(at(box(0.08, 0.08, 0.3), 0.4, 1.26, -4.1, 0.5), 0x3a2a1a), tint(at(box(0.2, 0.12, 0.12), 0.34, 1.26, -3.98, 0.5), 0x3a2a1a));
    for (const x of [-3.3, -1.1, 1.1, 3.3]) { p.push(tint(at(box(0.6, 0.08, 0.6), x, 0.48, -0.6), 0x8a3a3a), tint(at(box(0.6, 0.7, 0.08), x, 0.85, -0.28), 0x8a3a3a)); for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) p.push(tint(at(box(0.05, 0.46, 0.05), x + a, 0.23, -0.6 + b), 0x3a3a3a)); }
    p.push(tint(at(box(1.0, 0.8, 2.4), 8.2, 0.4, 2.2), 0xe8e0d0), tint(at(box(0.7, 0.5, 0.5), 0, 0.75, 3.4), 0x4a4a50), tint(at(box(0.5, 0.25, 0.4), 0, 1.12, 3.4), 0x2a2a30), tint(at(box(0.06, 0.7, 0.06), 0, 0.35, 3.4), 0x8a8a90));
    p.push(tint(at(box(0.06, 0.18, 0.12), -W / 2 + 0.03, 1.3, 1.5), 0xf4f4f0), tint(at(box(1.1, 2.1, 0.04), 0, 1.05, D / 2 - 0.03), 0x4a3020), tint(at(box(0.08, 0.08, 0.06), 0.42, 1.0, D / 2 - 0.08), 0xc8a030));
    p.push(tint(at(box(3.2, 1.6, 0.05), 0, 2.1, -D / 2 + 0.06), 0xf4f4f4), tint(at(box(3.4, 0.08, 0.1), 0, 1.26, -D / 2 + 0.08), 0x3a3a40));
    root.add(new THREE.Mesh(merge(p), vmat()));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), basic({ map: signTex(['HOLLOW ESTATES', 'phase 1: remove woods', 'phase 2: beige'], '#f4f4f4', '#1e2a44', 384, 192) })); scr.position.set(0, 2.1, -D / 2 + 0.1); root.add(scr);
    hall.screen = scr; hall.catSlide = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), basic({ map: signTex(['( a cave painting )', 'OF A CAT', 'it is judging you'], '#c8a878', '#3a1a0a', 384, 192) })); hall.catSlide.position.copy(scr.position); hall.catSlide.position.z += 0.01; hall.catSlide.visible = false; root.add(hall.catSlide);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.5), basic({ map: signTex(['MAPLE GROVE HOA  -  ORDER  -  BEIGE  -  ORDER'], '#1e2a44', '#f0e6c8', 512, 56) })); ban.position.set(4.6, 2.55, -D / 2 + 0.03); root.add(ban);
    hall.urn = new THREE.Mesh(merge([tint(at(cyl(0.2, 0.22, 0.55, 10), 0, 0.28, 0), 0xb8b8c0), tint(at(cyl(0.08, 0.2, 0.1, 10), 0, 0.6, 0), 0x2a2a2e), tint(at(box(0.05, 0.05, 0.14), 0, 0.12, 0.26), 0x2a2a2e)]), vmat()); hall.urn.position.set(8.2, 0.8, 2.2); root.add(hall.urn);
    hall.flag = new THREE.Group(); hall.flag.position.set(7.4, 0, -5.0); root.add(hall.flag);
    hall.flag.add(new THREE.Mesh(merge([tint(at(cyl(0.03, 0.03, 2.5, 6), 0, 1.25, 0), 0xc8a030), tint(at(cyl(0.2, 0.24, 0.1, 8), 0, 0.05, 0), 0x3a3a3a), tint(at(box(0.9, 0.6, 0.02), -0.48, 2.1, 0), 0x1e2a44), tint(at(box(0.5, 0.1, 0.025), -0.48, 2.1, 0), 0xf0e6c8)]), vmat({ side: THREE.DoubleSide })));
    hall.gavelM = new THREE.Mesh(merge([tint(at(box(0.08, 0.08, 0.3), 0, 0, 0), 0x3a2a1a), tint(at(box(0.2, 0.12, 0.12), 0, 0, 0.15), 0x3a2a1a)]), vmat()); hall.gavelM.position.set(0.4, 1.26, -4.1); hall.gavelM.visible = false; root.add(hall.gavelM);
    try { hall.gary = makeGary(); hall.gary.position.set(0, 0, -5.0); root.add(hall.gary); } catch (e) { console.error('[haunted] gary', e); }
    const looks = [{ shirt: 0x7a8ab0, pants: 0x3a3a48 }, { shirt: 0xc86a8a, pants: 0x5a4a3a }, { shirt: 0x6aa07a, pants: 0x2a2a30 }, { shirt: 0xd8c070, pants: 0x4a4a5a }];
    [-3.3, -1.1, 1.1, 3.3].forEach((x, i) => { try { const m = makeHuman(looks[i]); m.position.set(x, 0, -0.75); m.rotation.y = Math.PI; m.scale.setScalar(0.96); root.add(m); hall.board.push(m); } catch (e) { console.error('[haunted] board', e); } });
    for (const id of SCARE_ORDER) { const s = new THREE.Sprite(glowMat(0x9ad0ff)); s.position.set(SPOTS[id].x, 1.2, SPOTS[id].z); s.scale.setScalar(1.6); s.visible = false; root.add(s); hall.glow[id] = s; }
    hall.ghost = makeGhost(); hall.ghost.scale.setScalar(0.9); root.add(hall.ghost); ghostAlpha(hall.ghost, 0);
    const solid = (cx, cz, w, d, h) => cols.push({ kind: 'box', cx, cz, w, d, rot: 0, h });
    solid(0, -4.2, 1.2, 0.8, 1.2); solid(8.2, 2.2, 1.0, 2.4, 0.9); solid(0, 3.4, 0.7, 0.5, 1.2); solid(7.4, -5.0, 0.4, 0.4, 2.5);
    for (const x of [-3.3, -1.1, 1.1, 3.3]) solid(x, -0.6, 0.7, 0.8, 1.5);
    hall.L = [{ x: -5, y: 2.95, z: -2, c: 0xfff0d8, i: 0.85 }, { x: 0, y: 2.95, z: -2, c: 0xfff0d8, i: 0.85 }, { x: 5, y: 2.95, z: -2, c: 0xfff0d8, i: 0.85 }, { x: 0, y: 2.95, z: 2.5, c: 0xfff0d8, i: 0.75 }, { x: -5, y: 2.95, z: 2.5, c: 0xfff0d8, i: 0.7 }, { x: 5, y: 2.95, z: 2.5, c: 0xfff0d8, i: 0.7 }, { x: 0, y: 2.0, z: -4.4, c: 0xffd8a0, i: 0.35 }];
    return {
      group: root, size: [W, D], cols, spawn: { x: 0, z: 4.6, yaw: Math.PI }, exit: { x: 0, z: 5.5, r: 0.6 }, lights: hall.L, name: 'HOA Office', cam: { maxDist: 4.2, height: 3.0 },
      interact: [],
      update: (t) => { if (hall.gary) hall.gary.rotation.y = Math.sin(t * 0.9) * 0.25; },
    };
  }
  INTM.registerRoom('hoahall', { name: 'HOA Office', build: buildHall }, [{ x: HOA.door.x, z: HOA.door.z, yaw: Math.PI, kind: 'door' }]);
  INTM.close('hoahall', SV.c !== 'meeting');

  function startMeeting() {
    if (SV.c !== 'meeting') return;
    S.meet = { nerve: 100, sus: 0, i: 0, cue: null, t: 0, gap: 2.5, done: {}, intro: true, rantT: 5 };
    for (const m of hall.board) m.visible = true;
    hall.catSlide.visible = false; hall.urn.position.set(8.2, 0.8, 2.2); hall.urn.rotation.set(0, 0, 0); hall.flag.rotation.set(0, 0, 0); hall.gavelM.visible = false;
    for (const L of hall.L) L.i = L.i0 ?? (L.i0 = L.i);
    say(MEET_INTRO, () => { if (S.meet) S.meet.intro = false; });
  }
  function scare(id) {
    const M = S.meet; if (!M) return;
    if (M.cue !== id) {   // pawed the wrong thing, or with no cue
      M.sus++; Sfx.blip(180); toast(M.sus >= 3 ? MEET_FAIL : `Gary looks up. "Who touched that?" (${M.sus}/3 strikes) Wait for John to point.`, 3.5);
      if (M.sus >= 3) kickOut();
      return;
    }
    M.done[id] = 1; M.cue = null; M.gap = 2.2; M.nerve = Math.max(0, M.nerve - 25); hall.glow[id].visible = false; Sfx.punch && Sfx.punch();
    if (id === 'lights') for (const L of hall.L) L.i = L.i0 * 0.25;
    if (id === 'urn') { hall.urn.position.set(7.2, 0.25, 2.6); hall.urn.rotation.z = 1.5; }
    if (id === 'flag') hall.flag.rotation.z = 1.2;
    if (id === 'projector') hall.catSlide.visible = true;
    if (id === 'gavel') hall.gavelM.visible = true;
    const fled = Math.min(hall.board.length, Math.floor((100 - M.nerve) / 25) - 1); for (let k = 0; k < fled; k++) if (hall.board[k]) hall.board[k].visible = false;
    if (M.nerve <= 0) say(SCARES[id].hit, () => say(MEET_WIN, meetingWon));
    else say(SCARES[id].hit);
  }
  function kickOut() { S.meet = null; ui.meter(null); INTM.exit({ instant: true }); }
  function meetingWon() {
    S.meet = null; ui.meter(null); for (const m of hall.board) m.visible = false;
    SV.c = 'site'; SV.stakes = 0; SV.cap = 0; SV.plans = 0; store(); INTM.close('hoahall', true); Sfx.jingle && Sfx.jingle();
    toast('The vote is off. Now the site behind the RV: stakes, the excavator, the blueprints.', 5);
  }
  function updateMeeting(dt, t) {
    const M = S.meet; if (!M || M.intro) return;
    const R = window.__INT && window.__INT.room; if (!R) return;
    if (G.dialog) return;
    ui.meter('BOARD NERVE', M.nerve / 100, M.cue ? SCARES[M.cue].cue : `Strikes ${M.sus}/3. Wait for John's cue.`, M.cue && M.t < 3);
    if (M.cue) {
      M.t -= dt; hall.glow[M.cue].material.opacity = 0.6 + 0.4 * Math.sin(t * 9);
      if (M.t <= 0) { hall.glow[M.cue].visible = false; M.cue = null; M.gap = 2.5; M.sus++; toast(M.sus >= 3 ? MEET_FAIL : `Too slow. Gary squints at the room. (${M.sus}/3 strikes)`, 3.2); if (M.sus >= 3) return kickOut(); }
    } else {
      M.gap -= dt; M.rantT -= dt;
      if (M.rantT <= 0) { M.rantT = 9; toast(GARY_MEET[(M.i + M.sus) % GARY_MEET.length], 2.6); }
      if (M.gap <= 0) {
        let id = null; for (let k = 0; k < SCARE_ORDER.length; k++) { const c = SCARE_ORDER[(M.i + k) % SCARE_ORDER.length]; if (!M.done[c]) { id = c; M.i = (M.i + k + 1) % SCARE_ORDER.length; break; } }
        if (!id) { for (const k in M.done) delete M.done[k]; return; }
        M.cue = id; M.t = 10; hall.glow[id].visible = true; toast(SCARES[id].cue, 3); Sfx.blip(520);
      }
    }
    // John hovers by whatever he's pointing at
    const tgt = M.cue ? SPOTS[M.cue] : { x: -6, z: 4 };
    const g = hall.ghost; g.position.x += (tgt.x - g.position.x) * Math.min(1, dt * 3); g.position.z += (tgt.z + 0.9 - g.position.z) * Math.min(1, dt * 3);
    g.rotation.y = Math.atan2(P.x - R.origin.x - g.position.x, P.z - R.origin.z - g.position.z);
    ghostAlpha(g, M.cue ? 0.85 : 0.35); animGhost(g, t, M.cue ? 'wave' : 'float');
  }
  INTM.addPrompt((id) => {
    if (id === 'hoahall' && S.meet && !S.meet.intro) { const R = window.__INT.room; for (const k of SCARE_ORDER) if (Math.hypot(P.x - R.origin.x - SPOTS[k].x, P.z - R.origin.z - SPOTS[k].z) < 1.5) return { text: SCARES[k].label, btn: 'PAW' }; }
    if (id === 'cavelair' && SV.b === 'sit' && !S.sit && !S.nap) { const R = window.__INT.room; if (Math.hypot(P.x - R.origin.x - LAIR.stool.x, P.z - R.origin.z - LAIR.stool.z) < 1.5) return { text: 'Sit for bust No. 12 (hold still)', btn: 'SIT' }; }
    return null;
  });
  INTM.addUse((id) => {
    if (id === 'hoahall' && S.meet && !S.meet.intro) { const R = window.__INT.room; for (const k of SCARE_ORDER) if (Math.hypot(P.x - R.origin.x - SPOTS[k].x, P.z - R.origin.z - SPOTS[k].z) < 1.5) { scare(k); return true; } }
    if (id === 'cavelair' && SV.b === 'sit' && !S.sit && !S.nap) { const R = window.__INT.room; if (Math.hypot(P.x - R.origin.x - LAIR.stool.x, P.z - R.origin.z - LAIR.stool.z) < 1.5) { startSit(); return true; } }
    return false;
  });

  // ================================================================== part B logic ==================================================================
  function gotItem(id) {
    if (SV.items[id]) return; SV.items[id] = 1; store(); Sfx.pickup();
    const n = nItems();
    toast(n >= 5 ? 'That\'s all five. Take them down to John.' : `Got it: ${ITEMS[id].name} (${n}/5).`, 3.5);
  }
  function startSit() {
    const R = window.__INT.room;
    S.sit = { t: 0, line: -1, x: R.origin.x + LAIR.stool.x, z: R.origin.z + LAIR.stool.z };
    P.x = S.sit.x; P.z = S.sit.z; P.vx = P.vz = 0; P.yaw = Math.atan2(LAIR.john.x - LAIR.stool.x, LAIR.john.z - LAIR.stool.z);
    const g = gh(); if (g) { g.talking = true; g.state = 'haunt'; g.x = LAIR.john.x; g.z = LAIR.john.z; g.a = 1; }
    toast('Goobles hops onto the stool. Hold still for one minute. Don\'t touch anything.', 3.5); Sfx.blip(520);
  }
  function updateSit(dt) {
    const K = S.sit; if (!K) return;
    const g = gh(); if (g) { g.talking = true; g.state = 'haunt'; g.x = LAIR.john.x; g.z = LAIR.john.z; }
    if (Math.hypot(P.x - K.x, P.z - K.z) > 0.3) {
      S.sit = null; ui.meter(null); if (g) g.talking = false; Sfx.blip(180);
      toast(K.t > 4 ? 'You moved. John makes a small noise of pain and squashes the ears flat. Sit again.' : 'You hopped off the stool.', 3.5); return;
    }
    P.y = 0.3; P.vy = 0;   // perched on the stool
    if (G.dialog) return;
    K.t += dt * (S.sitSpeed || 1);
    const li = Math.min(SIT_LINES.length - 1, Math.floor(K.t / 7.5));
    if (li !== K.line) { K.line = li; toast(SIT_LINES[li], 5); }
    ui.meter('HOLD STILL', K.t / 60, `${Math.max(0, Math.ceil(60 - K.t))} s`);
    if (K.t >= 60) {
      S.sit = null; ui.meter(null); Sfx.jingle && Sfx.jingle();
      lair.ped.visible = false; lair.bust.visible = true;
      say(BUST_DONE, () => { S.nap = { t: 0 }; });
    }
  }
  function updateNap(dt) {
    const N = S.nap; if (!N) return;
    N.t += dt * (S.sitSpeed || 1); P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.3);
    const g = gh(); if (g) { g.talking = true; g.state = 'haunt'; const R = window.__INT && window.__INT.room; if (R) { g.x = P.x - R.origin.x + 0.9; g.z = P.z - R.origin.z + 0.3; } }
    const k = clamp(N.t / 2, 0, 1) * clamp((14 - N.t) / 1.5, 0, 1);
    ui.veil(k * 0.82, N.t < 3.5 ? 'Goobles curls up by the fire.' : N.t < 12 ? '' : 'The fire crackles.');
    if (N.t >= 14) { S.nap = null; ui.veil(0); say(TWIST, finishB); }
  }
  function finishB() {
    const g = gh(); if (g) g.talking = false;
    SV.b = 'done'; SV.bDoneDay = day(); SV.cWait = 0; SV.harm = 1; store(); syncLair(); Sfx.jingle && Sfx.jingle();
    toast(`Unfinished Business: done. Got the HARMONICA (${isTouch ? 'tap the note button' : 'press H'} to play). Bust No. 12 is in your RV.`, 6);
    if (quests && quests.track) quests.track(null);
  }

  // ================================================================== part C: site and boss ==================================================================
  function pullStake(i) {
    if (SV.stakes & (1 << i)) return;
    if (!SV.stakes) { S.stakeT = 75; toast('First stake out! The crew is on a coffee break: 75 seconds to pull all six.', 3.5); }
    SV.stakes |= 1 << i; store(); Sfx.pickup();
    if (SV.stakes === 63) { S.stakeT = 0; ui.meter(null); toast('All six stakes pulled. Goobles drops them in the creek. Allegedly.', 3.5); checkSite(); }
  }
  function checkSite() {
    if (SV.c === 'site' && SV.stakes === 63 && SV.cap && SV.plans) say(SITE_DONE, () => { SV.c = 'boss'; SV.tries = 0; store(); Sfx.jingle && Sfx.jingle(); });
  }
  const R = (a, b) => Math.round(a + Math.random() * (b - a));   // only while the battle panel is up
  function startBoss() {
    if (S.battle) return;
    G.hp = Math.max(G.hp, 70);
    S.battle = { g: GARY_MAX, dist: DIST0, sel: 0, mode: 'msg', msgs: [['', 'GARY IN A BULLDOZER rumbles down the lane! 40 metres to the cave. Don\'t let him get there.']], after: 'menu', hiss: 0, lift: 0, stun: 0, cd: 0, rant: 0, flash: 0 };
    try { const [dx, dz] = L2W(0, 27); window.__G && window.__G.setCam && window.__G.setCam(Math.atan2(P.x - dx, P.z - dz), 0.28); } catch (e) { /* camera stays */ }   // look up the lane at him
    ui.handler = { move: (d) => { const B = S.battle; if (B && B.mode === 'menu') { B.sel = (B.sel + d + 4) % 4; drawBoss(); } }, confirm: (i) => bossConfirm(i) };
    drawBoss();
  }
  const phase = (B) => (B.g > 120 ? 0 : B.g > 60 ? 1 : 2);
  const JOHN_MOVE = [{ name: 'JOHN: BLADE', blurb: 'John possesses the blade and lifts it. The dozer can\'t advance for 2 turns.' }, { name: 'JOHN: HORN', blurb: 'John plays a tune on the horn. Gary loses a turn to rage.' }, { name: 'JOHN: SEAT', blurb: 'John gets into the ejector seat. Big damage. Finishes it when Gary is nearly done.' }];
  function bossCmds(B) {
    const j = JOHN_MOVE[phase(B)];
    return [{ name: 'PAW PANEL', blurb: 'Swat one of the glowing panels. Solid damage.' }, { name: 'HISS', blurb: 'A little damage. Gary flinches: his next push or swipe is halved.' }, { name: j.name + (B.cd > 0 ? ` (${B.cd})` : ''), blurb: j.blurb + (B.cd > 0 ? ` John needs ${B.cd} more turn${B.cd > 1 ? 's' : ''} to pull himself together.` : ''), off: B.cd > 0 }, { name: 'NAP', blurb: 'Heal 25. In front of a bulldozer. Bold.' }];
  }
  function drawBoss() {
    const B = S.battle; if (!B) return;
    const bars = [{ name: 'GOOBLES', val: G.hp, max: 100 }, { name: 'GARY\'S BULLDOZER', val: B.g, max: GARY_MAX, col: '#f0b020' }, { name: 'DISTANCE TO CAVE', val: B.dist, max: DIST0, unit: 'm', col: B.dist < 14 ? '#ff6a5a' : '#9ad0ff' }];
    const cmds = bossCmds(B);
    if (B.mode === 'msg') ui.show({ bars, cmds, sel: -1, who: B.msgs[0][0], text: B.msgs[0][1], more: true });
    else ui.show({ bars, cmds, sel: B.sel, who: 'WHAT WILL GOOBLES DO?', text: cmds[B.sel].blurb });
  }
  function bossConfirm(i) {
    const B = S.battle; if (!B) return;
    if (B.mode === 'msg') {
      Sfx.blip(660); B.msgs.shift();
      if (B.msgs.length) return drawBoss();
      if (B.after === 'menu') { B.mode = 'menu'; return drawBoss(); }
      if (B.after === 'gary') return garyTurn();
      if (B.after === 'win') return endBoss(true);
      if (B.after === 'lose') return endBoss(false);
      return;
    }
    if (i !== undefined) B.sel = i;
    const cmds = bossCmds(B); if (cmds[B.sel].off) { Sfx.blip(180); return drawBoss(); }
    playerTurn(B.sel);
  }
  function hurtG(n) { const B = S.battle; B.g = Math.max(0, B.g - n); B.flash = 0.4; }
  function playerTurn(k) {
    const B = S.battle, out = [], ph = phase(B);
    if (B.cd > 0) B.cd--;
    if (k === 0) { const crit = Math.random() < 0.15, n = Math.round(R(15, 21) * (crit ? 1.6 : 1)); hurtG(n); out.push(['', crit ? `Goobles finds the panel marked DO NOT PAW and paws it. ${n} damage!` : `Goobles swats a glowing panel. Sparks. ${n} damage.`]); }
    else if (k === 1) { const n = R(6, 9); hurtG(n); B.hiss = 1; out.push(['', `Goobles hisses at twelve tons of bulldozer. It works. ${n} damage, and Gary flinches.`]); }
    else if (k === 2) {
      B.cd = 3;
      if (ph === 0) { const n = R(14, 18); hurtG(n); B.lift = 2; out.push([JOHN, 'I\'m in the blade! I\'m IN the BLADE! It\'s roomy!'], ['', `The blade lifts straight up and stays there, waving. ${n} damage. The dozer can't push for 2 turns.`]); }
      else if (ph === 1) { const n = R(18, 24); hurtG(n); B.stun = 1; out.push(['', 'The horn starts playing a jaunty little tune. Nobody is touching the horn.'], ['Gary', 'STOP THAT. STOP THAT TUNE. I DON\'T EVEN KNOW THAT TUNE.'], ['', `${n} damage. Gary is too angry to drive this turn.`]); }
      else if (B.g <= 30) { hurtG(B.g); out.push([JOHN, 'Gary. I\'m under your seat, Gary. Hello.'], ['Gary', 'There is NOBODY under my... why is it WARM.'], ['', 'The ejector seat that bulldozers definitely have goes off.']); }
      else { const n = R(24, 30); hurtG(n); out.push([JOHN, 'I\'m in the seat! It\'s bouncing! Soften him up a bit more and I can launch him!'], ['', `The seat bucks like a horse. ${n} damage.`]); }
    } else { const h = Math.min(100 - G.hp, 25); G.hp += h; out.push(['', `Goobles lies down in the lane and naps. +${h} health. Gary cannot believe it.`]); }
    Sfx.punch && Sfx.punch();
    B.msgs = out; B.mode = 'msg'; B.after = B.g <= 0 ? 'win' : 'gary'; drawBoss();
  }
  function garyTurn() {
    const B = S.battle, out = [], ph = phase(B), k = B.hiss ? 0.5 : 1; B.hiss = 0;
    const rants = RANTS[ph]; out.push(['Gary', rants[B.rant++ % rants.length]]);
    if (B.stun) { B.stun = 0; out.push(['', 'Gary spends his whole turn yelling at the horn.']); }
    else {
      const r = Math.random(), canPush = B.lift <= 0;
      if (canPush && r < 0.5 + ph * 0.08) { const n = Math.round(R(5, 8) * k * (1 + ph * 0.15)); B.dist = Math.max(0, B.dist - n); out.push(['', `The bulldozer grinds forward ${n} metres. ${B.dist > 0 ? `${B.dist} m to the cave.` : ''}`]); }
      else if (r < 0.8 || !canPush) { const n = Math.round(R(9, 14) * k); G.hp -= n; out.push(['', canPush ? `Gary swings the blade sideways. ${n} damage.` : `The blade is stuck in the air, so Gary throws his clipboard. ${n} damage.`]); }
      else { const n = Math.round(R(5, 8) * k); G.hp -= n; out.push(['', `Gary leans out and writes Goobles a citation. For "loitering near machinery". It stings. ${n} damage.`]); }
    }
    if (B.lift > 0) { B.lift--; if (B.lift === 0) out.push(['', 'The blade drops back down. John tumbles out of it, dizzy.']); }
    if (G.hp <= 0) { G.hp = 0; out.push(['', 'Goobles is flattened. Emotionally. And a bit physically.']); B.after = 'lose'; }
    else if (B.dist <= 0) { out.push(['', 'The blade touches the cave mouth. Rocks start to fall.'], [JOHN, 'MY PORTRAITS! Pull him back! Do it again, do it AGAIN!']); B.after = 'lose'; }
    else B.after = 'menu';
    B.msgs = out; B.mode = 'msg'; drawBoss();
  }
  function endBoss(won) {
    S.battle = null; ui.hide();
    if (!won) { SV.tries = (SV.tries | 0) + 1; store(); G.hp = Math.max(G.hp, 60); S.dozerD = DIST0; toast('John shoves the bulldozer back up the lane with everything he\'s got. Gary reverses, swearing. Go again.', 5); return; }
    S.win = { t: 0 }; Sfx.jingle && Sfx.jingle();
  }
  function updateBossScene(dt, t) {
    const show = (SV.c === 'boss' || !!S.win) && !inRoom() && dist(C.x, C.z) < 160;
    if (show && !dozerBuilt) buildDozer();
    dozer.visible = show;
    const ci = colliders.indexOf(dozerCol);
    if (!show) { if (ci >= 0) colliders.splice(ci, 1); if (!S.boo) og.visible = false; return; }
    const B = S.battle;
    if (S.dozerD === undefined) S.dozerD = DIST0;
    const want = B ? B.dist : S.dozerD; if (!B) S.dozerD = DIST0;
    S.dozerShown = S.dozerShown === undefined ? want : S.dozerShown + (want - S.dozerShown) * Math.min(1, dt * 1.5);
    const W = S.win;
    if (!W) {
      // 40 "metres" on the meter is a 20 m lane on the ground, so the fight stays in view
      const [x, z] = L2W(0, 7 + S.dozerShown * 0.5); dozer.position.set(x, 0, z); dozer.rotation.set(0, cy + Math.PI, 0);
      dozer.position.y = Math.sin(t * 31) * 0.012;
      dozerCol.cx = x; dozerCol.cz = z; if (ci < 0) colliders.push(dozerCol);
    } else {
      W.t += dt; if (ci >= 0) colliders.splice(ci, 1);
      // turns south and rolls off down toward the creek
      dozer.rotation.y += dt * 0.5 * clamp(1 - W.t / 3, 0, 1); const fx = Math.sin(dozer.rotation.y), fz = Math.cos(dozer.rotation.y);
      dozer.position.x += fx * dt * 3.5; dozer.position.z += fz * dt * 3.5; dozer.rotation.z = Math.min(0.5, W.t * 0.06);
      if (dozer.userData.gary) dozer.userData.gary.visible = false;
      if (!robeGary.m) { try { const m = robeGary.m = makeHuman({ shirt: 0xf29ac0, pants: 0xf29ac0, skin: 0xe9bfa0, hair: 0x6a4a2a }); const [x, z] = L2W(3.5, 9); m.position.set(x, 0, z); m.rotation.y = cy + Math.PI; scene.add(m); } catch (e) { console.error('[haunted] robe gary', e); } }
      if (W.t > 2.2 && !W.said && !G.dialog) { W.said = true; say(BOSS_WIN, () => { SV.c = 'party'; store(); syncLair(); toast('Ghost vs. the HOA: the woods are safe. John is throwing a party. Go down.', 5); }); }
      if (W.t > 9) dozer.visible = false;
      if (W.said && SV.c !== 'boss' && W.t > 9) S.win = null;
    }
    const blade = dozer.userData.blade; if (blade) blade.rotation.x += (((B && B.lift > 0) ? -1.1 : 0) - blade.rotation.x) * Math.min(1, dt * 4);
    for (const s of dozer.userData.panels || []) { s.material.opacity = 0.5 + 0.5 * Math.sin(t * 6 + s.position.x); s.visible = !W; }
    if (B && B.flash > 0) { B.flash -= dt; dozer.position.x += Math.sin(B.flash * 90) * 0.06; }
    // John rides the dozer during the fight
    if (B) { og.visible = true; og.position.set(dozer.position.x, heightAt(dozer.position.x, dozer.position.z) + 2.6, dozer.position.z); og.rotation.y = Math.atan2(P.x - og.position.x, P.z - og.position.z); ghostAlpha(og, B.lift > 0 || B.cd === 3 ? 0.95 : 0.45); animGhost(og, t, B.lift > 0 ? 'boo' : 'wave'); }
    else if (!S.boo) og.visible = false;
  }

  // ================================================================== harmonica + summon ==================================================================
  const TUNE = [523, 659, 784, 659, 880, 784, 659, 523];
  function playHarmonica() {
    if (!SV.harm || S.tune || G.dialog || P.car || ui.active) return;
    S.tune = { i: 0, t: 0 };
    if (G.heat > 0 && S.harmCd <= 0) { G.heat = Math.max(0, G.heat - 1); S.harmCd = 45; toast('Goobles plays the harmonica. Badly, but with feeling. The HOA calms down a notch. (-1 star)', 3.5); }
    else toast(G.heat > 0 ? 'Goobles plays again. Nobody is in the mood for an encore yet.' : 'Goobles plays the harmonica. Somewhere below, a ghost hums along. Off-key.', 3);
  }
  function summon() {
    if (SV.c !== 'done' || S.boo || G.dialog || ui.active || inRoom()) return;
    if (SV.summonDay === day()) return toast('John already said boo today. A ghost needs his rest.', 3);
    if (!(G.heat > 0)) return toast('Nobody to scare right now. John waves from somewhere you can\'t see.', 3);
    SV.summonDay = day(); store();
    S.boo = { t: 0 }; G.heat = 0; G.hoaTruce = Math.max(G.hoaTruce || 0, (G.time || 0) + 90);
    toast('John: "BOO." Every HOA cart in a mile decides it has somewhere else to be. Heat cleared.', 4.5); [300, 240, 200, 160].forEach((f) => Sfx.blip(f));
  }
  const btnCss = 'position:fixed;left:14px;z-index:32;display:none;font:22px inherit;font-family:inherit;padding:4px 12px;background:rgba(10,14,30,0.85);color:#ffd23f;border:3px solid #c8c0a0;';
  const harmBtn = document.createElement('button'); harmBtn.textContent = '♪'; harmBtn.style.cssText = btnCss + 'top:42%;'; document.body.appendChild(harmBtn);
  const booBtn = document.createElement('button'); booBtn.textContent = 'BOO'; booBtn.style.cssText = btnCss + 'top:52%;'; document.body.appendChild(booBtn);
  harmBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); playHarmonica(); });
  booBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); summon(); });

  // ================================================================== cave hooks (on top of hens.js) ==================================================================
  if (cave) {
    const prev = cave.quest || {};
    cave.quest = {
      reveal(first) {
        if (SV.b === 'ask') return { lines: ASK, then: () => { SV.b = 'fetch'; store(); syncLair(); toast('Five things for bust No. 12. They\'re in your quest log.', 4); } };
        if (SV.b === 'fetch' && nItems() >= 5) return { lines: ALL_ITEMS, then: () => { SV.b = 'sit'; store(); syncLair(); } };
        if (SV.c === 'party') return { lines: PARTY, then: finishC };
        return prev.reveal ? prev.reveal(first) : null;
      },
      talkLabel: () => (prev.talkLabel && prev.talkLabel()) || '',
      talk() {
        if (S.sit || S.nap) return true;
        const lines = SV.c === 'done' ? C_TALK.done : SV.c !== 'none' && SV.c !== 'party' ? C_TALK.early : B_TALK[SV.b];
        if (lines && aDone()) { const g = gh(); if (g) g.talking = true; say(lines, () => { if (g) g.talking = false; }); return true; }
        return prev.talk ? prev.talk() : false;
      },
      hen: () => (prev.hen ? prev.hen() : false),
    };
  }
  function finishC() {
    SV.c = 'done'; store(); syncLair(); addCash(500); Sfx.jingle && Sfx.jingle();
    toast(`Ghost vs. the HOA: done. +$500. John will say BOO for you once a day (${isTouch ? 'BOO button' : 'press G'}) when the HOA is after you.`, 7);
    if (quests && quests.track) quests.track(null);
  }

  // ================================================================== quest log ==================================================================
  const COL = '#ffd23f';
  const chk = (x, z, label, r = 3) => (dist(x, z) > r && !inRoom() ? { x, z, r: 2.5, label, col: COL } : null);
  const caveChk = () => { const held = cave && cave.S.held; const [x, z] = L2W(held ? 0 : 1.9, held ? 0.4 : 1.2); return chk(x, z, held ? 'Cave' : 'Torch'); };
  const itemSpot = (id) => (id === 'glasses' ? NPC.nana && { x: NPC.nana.x, z: NPC.nana.z, label: 'Nana' } : id === 'harmonica' ? places.donut && { x: places.donut.x, z: places.donut.z, label: 'Donut Hole' } : id === 'bronze' ? { x: HOA.plaque.x, z: HOA.plaque.z - 1, label: 'HOA plaque' } : id === 'clay' ? { x: CLAY.x, z: CLAY.z, label: 'Clay' } : null);
  const QB = {
    id: 'unfinished', kind: 'side', title: 'Unfinished Business', giver: 'the Ghost of John', where: 'the RV door', reward: 0,
    blurb: 'John can\'t move on until he finishes bust No. 12. He never got the ears right. Fetch him five things from around town, then hold still.',
    status: () => (SV.b === 'none' ? 'hidden' : SV.b === 'note' ? 'open' : SV.b === 'done' ? 'done' : 'active'),
    guide() {
      const b = SV.b;
      if (b === 'note') return { obj: 'There\'s a note pinned to the RV door.', check: chk(places.rv.x, places.rv.z, 'Note') };
      if (b === 'ask') return { obj: inRoom() === 'cavelair' ? 'Find John.' : 'John wants to see you. Go down to the Hollow Deep.', check: inRoom() ? null : caveChk() };
      if (b === 'fetch') {
        const n = nItems();
        if (n >= 5) return { obj: 'You have all five. Take them down to John.', check: inRoom() ? null : caveChk() };
        const left = ITEM_ORDER.filter((k) => !SV.items[k]);
        let sp = null, bd = 1e9; for (const k of left) { const q = itemSpot(k); if (q) { const d = dist(q.x, q.z); if (d < bd) { bd = d; sp = q; } } }   // waypoint: the nearest one left
        return { obj: `For bust No. 12 (${n}/5): ${left.map((k) => `${ITEMS[k].short} (${ITEMS[k].where})`).join('; ')}.`, check: sp ? chk(sp.x, sp.z, sp.label) : null };
      }
      if (b === 'sit') return { obj: inRoom() === 'cavelair' ? 'Sit on the stool by the fire and hold still for one minute.' : 'Go back down to John for the sitting.', check: inRoom() ? null : caveChk() };
      return { obj: 'Bust No. 12 is finished. John stayed.', check: null };
    },
  };
  const QC = {
    id: 'hoawar', kind: 'side', title: 'Ghost vs. the HOA', giver: 'the Ghost of John', where: 'the edge of Hollow Woods', reward: 500,
    blurb: 'Gary wants to bulldoze Hollow Woods for "Hollow Estates", right on top of John\'s cave. Haunt the vote, wreck the site, stop the bulldozer.',
    status: () => (SV.c === 'none' ? 'hidden' : SV.c === 'hook' ? 'open' : SV.c === 'done' ? 'done' : 'active'),
    guide() {
      const c = SV.c;
      if (c === 'hook') return { obj: 'Something orange is going up at the edge of the woods, behind the RV.', check: chk(SIGN.x, SIGN.z, 'Sign') };
      if (c === 'meeting') return { obj: inRoom() === 'hoahall' ? 'Paw what John points at. Break the board\'s nerve before they vote.' : 'Crash the emergency meeting at the HOA office.', check: chk(HOA.door.x, HOA.door.z, 'HOA office') };
      if (c === 'site') {
        const todo = []; if (SV.stakes !== 63) todo.push(`pull the stakes (${[0, 1, 2, 3, 4, 5].filter((i) => SV.stakes & (1 << i)).length}/6)`); if (!SV.cap) todo.push('drain the excavator'); if (!SV.plans) todo.push('swap the blueprints in the trailer');
        return { obj: `Sabotage Hollow Estates: ${todo.join(', ')}.`, check: chk(SITE.x, SITE.z, 'Site', 14) };
      }
      if (c === 'boss') { const [x, z] = L2W(0, 8); return { obj: 'Gary is driving a bulldozer at the cave. Get in front of it.', check: chk(x, z, 'Bulldozer', 12) }; }
      if (c === 'party') return { obj: inRoom() === 'cavelair' ? 'Join the party.' : 'John is throwing a party. Go down to the Hollow Deep.', check: inRoom() ? null : caveChk() };
      return { obj: 'Hollow Woods is a protected habitat. The raccoons filed the paperwork.', check: null };
    },
  };
  if (quests) { const reg = quests.register || quests.add; if (reg) { reg.call(quests, QB); reg.call(quests, QC); } }

  // ================================================================== outdoors: E + prompt ==================================================================
  function near() {
    if (P.car || G.dialog || G.paused || ui.active || inRoom()) return null;
    if (SV.b === 'note' && dist(places.rv.x, places.rv.z) < 2.8) return { verb: 'Read the note on the door', fn: () => say(NOTE, () => { SV.b = 'ask'; store(); quests && quests.track && quests.track('unfinished'); toast('New quest: Unfinished Business', 3); Sfx.jingle && Sfx.jingle(); }) };
    if (SV.b === 'fetch') {
      if (!SV.items.glasses && NPC.nana && NPC.nana.mesh.visible && dist(NPC.nana.x, NPC.nana.z) < 2.6) return { verb: 'Ask Nana for reading glasses', fn: () => say(NANA_GLASSES, () => gotItem('glasses')) };
      if (!SV.items.bronze && dist(HOA.plaque.x, HOA.plaque.z - 1) < 2.2) return { verb: `Pry the brass plaque loose (${S.pry}/3)`, fn: () => {
        S.pry++; Sfx.swing && Sfx.swing();
        if (S.pry < 3) return toast(['The plaque creaks. One corner is loose.', 'Two corners. It says "MAPLE GROVE HOA: EXCELLENCE IN COMPLIANCE".'][S.pry - 1], 2.5);
        S.pry = 0; if (!night()) addHeat(2, 'prying the plaque off the HOA office in broad daylight'); else toast('The plaque pops off. Nobody saw. The wall behind it is a slightly cleaner beige.', 3.5);
        gotItem('bronze');
      } };
      if (!SV.items.clay && dist(CLAY.x, CLAY.z) < 2.2) return { verb: `Dig for clay (${S.dig}/3)`, fn: () => { S.dig++; Sfx.swing && Sfx.swing(); if (S.dig < 3) return toast(['Goobles digs. Mud.', 'More mud. Wetter mud.'][S.dig - 1], 2); S.dig = 0; toast('Under the mud: thick red clay, cold and perfect. Goobles\' paws will never be white again.', 3.5); gotItem('clay'); } };
    }
    if (SV.c === 'hook' && dist(SIGN.x, SIGN.z) < 3.2) return { verb: 'Read the sign', fn: () => say(HOOK, () => { SV.c = 'meeting'; store(); INTM.close('hoahall', false); quests && quests.track && quests.track('hoawar'); toast('New quest: Ghost vs. the HOA', 3); Sfx.jingle && Sfx.jingle(); }) };
    if (SV.c === 'site') {
      if (SV.stakes !== 63) for (let i = 0; i < STAKES.length; i++) if (!(SV.stakes & (1 << i)) && dist(STAKES[i].x, STAKES[i].z) < 1.6) return { verb: 'Pull the survey stake', fn: () => pullStake(i) };
      if (!SV.cap && dist(DIGGER.x, DIGGER.z) < 3.4) return { verb: `Paw the fuel cap off (${S.capN}/3)`, fn: () => { S.capN++; Sfx.swing && Sfx.swing(); if (S.capN < 3) return toast(['The cap turns a little.', 'Nearly. It\'s on there tight. Gary tightens everything.'][S.capN - 1], 2); S.capN = 0; SV.cap = 1; store(); Sfx.pickup(); toast('The cap spins off. Diesel glugs out into the dirt until the excavator is very, very empty.', 3.5); checkSite(); } };
      if (!SV.plans && dist(TRAILER.x, TRAILER.z + 1.6) < 2.6) return { verb: 'Swap the blueprints', fn: () => { SV.plans = 1; store(); Sfx.pickup(); toast('Out: the Hollow Estates site plan. In: a cave painting of a cat. The crew will build whatever is on the table.', 4); checkSite(); } };
    }
    if (SV.c === 'boss' && !S.battle && !S.win && dozer.visible && (dist(dozer.position.x, dozer.position.z) < 12 || dist(...L2W(0, 12)) < 13)) return { verb: 'Stand in front of the bulldozer', fn: () => say((SV.tries | 0) ? [['Gary', 'AGAIN? I have a FULL TANK and a GRUDGE!']] : BOSS_INTRO, startBoss) };
    if (SV.c === 'done' && dist(api.DEEP.x, api.DEEP.z) < 1.6) return { verb: 'Read the plaque', fn: () => say([['', '"THE HOLLOW DEEP. Protected habitat. Home of one (1) ghost, nine chests, eleven bad busts and one good one."'], ['', 'Underneath, scratched in with a claw: "paperwork by R. Raccoon & Sons".']]) };
    if (SV.c === 'done' && dist(SIGN.x, SIGN.z) < 3.2) return { verb: 'Read the sign', fn: () => say([['', '"HOLLOW WOODS. PROTECTED HABITAT. No building, no paving, no beige."'], ['', 'Someone has stapled a fine to the post. It is addressed to Gary. It is from Gary.']]) };
    return null;
  }
  const prompt = () => { const n = near(); return n ? `${key}: ${n.verb}` : ''; };
  const interact = () => { const n = near(); if (!n) return false; n.fn(); return true; };

  // ================================================================== per frame ==================================================================
  function update(dt) {
    S.t += dt; const t = G.time || 0; ui.update(dt);
    const room = inRoom(), out = !room;
    // --- part B: the note turns up some time after part A
    if (SV.b === 'none' && aDone() && out) {
      SV.bWait += dt;
      const dd = hens.SV.doneDay; if (SV.bWait > 300 || (dd !== undefined && day() > dd)) { SV.b = 'note'; store(); if (quests && quests.S && !quests.S.track) quests.track('unfinished'); }
    }
    if (SV.b === 'note' && out && !S.noteHint && dist(places.rv.x, places.rv.z) < 14 && !G.dialog) { S.noteHint = true; toast('There\'s a note pinned to the RV door.', 3.5); }
    if (SV.b === 'fetch' && out) {
      plaque.visible = !SV.items.bronze && dist(HOA.plaque.x, HOA.plaque.z) < 70;
      claySpot.visible = !SV.items.clay && dist(CLAY.x, CLAY.z) < 90; if (claySpot.visible) claySpot.userData.glow.material.opacity = 0.45 + 0.3 * Math.sin(t * 3);
      // the photo: stand still outside around noon
      if (!SV.items.photo && !P.car) {
        const c = G.clock || 0, moved = Math.hypot(P.x - S.lx, P.z - S.lz) > 0.02;
        if (c >= 10 && c < 15 && !moved && !G.dialog) { S.still += dt; if (S.still > 3) { S.still = 0; ui.flash(); Sfx.blip(1200); toast('FLASH! From a bush: "Got it! Both ears! Don\'t look at the bush!"', 3.5); gotItem('photo'); } } else S.still = 0;
      }
    } else { plaque.visible = false; claySpot.visible = false; }
    S.lx = P.x; S.lz = P.z;
    if (room === 'cavelair') { updateSit(dt); updateNap(dt); }
    // --- part C: the sign goes up some time after part B
    if (SV.c === 'none' && SV.b === 'done' && out) { SV.cWait += dt; if (SV.cWait > 300 || (SV.bDoneDay !== null && day() > SV.bDoneDay)) { SV.c = 'hook'; store(); if (quests && quests.S && !quests.S.track) quests.track('hoawar'); toast('Hammering, from the woods behind the RV. Somebody is putting up a sign.', 4); } }
    const siteOn = SV.c !== 'none' && out && dist(SITE.x, SITE.z) < 130;
    if (siteOn && !site.userData.built) { try { buildSite(); } catch (e) { console.error('[haunted] site', e); } }
    site.visible = siteOn;
    if (siteOn && site.userData.built) {
      const machines = SV.c === 'site' || SV.c === 'boss', over = SV.c === 'party' || SV.c === 'done';
      digger.visible = trailer.visible = machines; siteSolid(machines);
      habitat.visible = over; site.userData.flags.visible = !over;
      stakeM.forEach((m, i) => { m.visible = !over && !(SV.c !== 'hook' && SV.c !== 'meeting' && (SV.stakes & (1 << i))); });
    } else if (!siteOn) siteSolid(false);
    if (SV.c === 'site' && S.stakeT > 0 && SV.stakes !== 63) {
      S.stakeT -= dt; ui.meter('STAKES', S.stakeT / 75, `${Math.ceil(S.stakeT)} s until the crew is back`, S.stakeT < 20);
      if (S.stakeT <= 0) { SV.stakes = 0; store(); ui.meter(null); toast('The crew comes back from break and hammers every stake back in. Try again, faster.', 4); }
    } else if (SV.c === 'site' && !S.meet && !S.sit) ui.meter(null);
    if (room === 'hoahall') { if (S.meetPending && hall.ghost && !(window.__INT.state && window.__INT.state.fading)) { S.meetPending = false; startMeeting(); } updateMeeting(dt, t); }
    updateBossScene(dt, t);
    if (S.battle) { P.vx = P.vz = 0; P.lock = Math.max(P.lock || 0, 0.25); if (room) { S.battle = null; ui.hide(); } }
    if (SV.c === 'done' && out && dist(C.x, C.z) < 140) { buildDeep(); deep.visible = true; } else deep.visible = false;
    if (robeGary.m) robeGary.m.visible = out && (SV.c === 'party' || !!S.win) && dist(C.x, C.z) < 140;
    // --- harmonica and the summon
    if (S.harmCd > 0) S.harmCd -= dt;
    if (S.tune) { S.tune.t -= dt; if (S.tune.t <= 0) { Sfx.blip(TUNE[S.tune.i++]); S.tune.t = 0.16; if (S.tune.i >= TUNE.length) S.tune = null; } }
    if (hit && !G.dialog && !G.paused && !P.car && !ui.active) { if (SV.harm && hit('h')) playHarmonica(); if (SV.c === 'done' && hit('g')) summon(); }
    if (S.boo) {
      const b = S.boo; b.t += dt; og.visible = true;
      og.position.set(P.x + Math.sin(P.yaw + 0.6) * 2.2, heightAt(P.x, P.z) + 0.2, P.z + Math.cos(P.yaw + 0.6) * 2.2); og.rotation.y = Math.atan2(P.x - og.position.x, P.z - og.position.z);
      ghostAlpha(og, clamp(b.t / 0.4, 0, 1) * clamp((4 - b.t) / 1, 0, 1)); animGhost(og, t, 'boo');
      if (b.t > 4) { S.boo = null; og.visible = false; }
    }
    if (isTouch) { harmBtn.style.display = SV.harm && out && !P.car && !ui.active ? 'block' : 'none'; booBtn.style.display = SV.c === 'done' && out && G.heat > 0 && !ui.active ? 'block' : 'none'; }
  }

  // ================================================================== debug ==================================================================
  Object.assign(api, {
    update, prompt, interact, HOA, CLAY, SITE, STAKES, DIGGER, TRAILER, SIGN, LAIR, SPOTS, hall, lair, dozer, site,
    reset() { SV = fresh(); store(); S.sit = S.nap = S.meet = S.battle = S.win = S.boo = null; S.stakeT = 0; S.dozerShown = undefined; ui.hide(); ui.meter(null); ui.veil(0); INTM.close('hoahall', true); syncLair(); if (dozer.userData.gary) dozer.userData.gary.visible = true; dozer.rotation.z = 0; },
    b(st) { SV.b = st; store(); syncLair(); return st; },
    c(st) { SV.c = st; store(); syncLair(); INTM.close('hoahall', st !== 'meeting'); return st; },
    give(id) { gotItem(id); return nItems(); },
    scare, startBoss, summon, playHarmonica, startSit,
    bossMove(k) { const B = S.battle; if (!B) return null; if (B.mode === 'msg') { bossConfirm(); return 'msg'; } bossConfirm(k); return 'move'; },
    state: () => ({ b: SV.b, items: Object.keys(SV.items), c: SV.c, stakes: SV.stakes, cap: SV.cap, plans: SV.plans, sit: S.sit ? Math.round(S.sit.t) : null, nap: !!S.nap, meet: S.meet ? { nerve: S.meet.nerve, sus: S.meet.sus, cue: S.meet.cue } : null, battle: S.battle ? { g: S.battle.g, dist: S.battle.dist, mode: S.battle.mode, after: S.battle.after } : null, harm: !!SV.harm, heat: G.heat }),
  });
  window.__HAUNT = api;
  return api;
}
