// Yard cats for Maple Grove: Off Leash (diet, 2026-11-26): lady cats lounging in Estates front yards that Goobles can
// flirt with. Each visit opens a menu of pick-up lines in different styles (smooth, punny, honest, bold, weird, a
// compliment, showing off, or a fish as a gift). Every cat has her own taste, and the outcome is a dice roll: she
// swoons, warms up a little, shrugs, or (often) reacts with comic disgust and snubs you for a while. Win one over all
// the way (100%) and "Ask her out" (girlfriend), go on dates (another dice roll on her taste) until the bond hits 100%, then
// "Pop the question"; if she says yes she moves in at the RV as your cat wife. Flirt with another cat while married and
// she storms over, fights the other cat, then scolds you; while dating, word gets back and the bond drops (grooms you every ten
// minutes for health). Courting only, PG.
//
// Models: the Tracebench Goobles GLB re-used (same rig and clips), with its six materials merged into ONE skinned
// mesh on a 1024x512 atlas that is repainted per cat (fur colour, tabby / siamese / tuxedo / calico patterns, eye
// colour, lashes, blush), plus a small accessory on the head bone (bow, flower, sun hat, tiara...). One draw per cat
// (+ blob shadow + an emote sprite while one shows); cats beyond 45 m are hidden and their skeleton isn't updated.
//
// Hooks: game.js (import, makeYardCats(...) next to meows, update in the frame, interact() + prompt() in the E chain),
// world.js placeHouse() records places.yards, questlog.js quests.add() for the courtship quest, fishing.js close().
// Own save key. Debug: window.__G.yardcats (.S, .cats, .flirt(id, style), .outcome(id, style, roll)).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import GLB from '../models/goobles.glb';
import { HOUSES } from './houses.js';
import { addShadow } from './models.js';
import { quests } from './questlog.js';

export const KEY = 'maple-grove-offleash-yardcats-v1';
const SCALE = 0.88 * 0.86;       // Goobles is 0.88 x his 1.11 m model; the ladies are a bit shorter
const GROOM_MS = 10 * 60e3, SHOW_R = 45, ANIM_R = 32, TALK_R = 1.7;

// ---------- the cast ----------
// like: how each line style lands with her (-1 hates .. +1 loves). gift = fish.
const CATS = [
  { id: 'mittens', name: 'Mittens', look: { fur: 0x9a7a58, pat: 'tabby', p2: 0x4a3626, eye: 0x6fd05a, acc: 'bow', ac: 0xff6fa8 },
    bio: 'Brown tabby, pink bow. Hopeless romantic. Thinks puns are for dogs.',
    like: { smooth: 0.5, pun: -0.8, honest: 0.6, bold: 0, weird: -0.5, compliment: 0.7, show: -0.2, gift: 0.3 } },
  { id: 'cleo', name: 'Cleopatra', look: { fur: 0xeadcc4, pat: 'siamese', p2: 0x4a3428, eye: 0x58b8ff, acc: 'collar', ac: 0xe8c040 },
    bio: 'Siamese, gold collar. Expects tribute. Calls everyone "peasant".',
    like: { smooth: 0.2, pun: -0.5, honest: -0.3, bold: 0.5, weird: -0.8, compliment: 0.4, show: 0.3, gift: 0.9 } },
  { id: 'biscuit', name: 'Biscuit', look: { fur: 0xe0904a, pat: 'tabby', p2: 0xb8602a, eye: 0xe0a020, acc: 'flower', ac: 0xfff0a0 },
    bio: 'Ginger, daisy behind her ear. Laughs at anything. Snorts when she does.',
    like: { smooth: -0.4, pun: 0.9, honest: 0.2, bold: 0.1, weird: 0.5, compliment: 0, show: 0.4, gift: 0.4 } },
  { id: 'pepper', name: 'Pepper', look: { fur: 0x1c1c22, pat: 'tuxedo', p2: 0xf2f0ea, eye: 0xb8e040, acc: 'collar', ac: 0xd02828 },
    bio: 'Tuxedo, red collar. Chaos gremlin. Knocks things off tables for sport.',
    like: { smooth: -0.8, pun: 0.3, honest: -0.2, bold: 0.4, weird: 0.9, compliment: -0.4, show: 0.7, gift: 0.2 } },
  { id: 'marigold', name: 'Marigold', look: { fur: 0xf2eee6, pat: 'calico', p2: 0xd88a3a, p3: 0x2a2420, eye: 0xd8782a, acc: 'hat', ac: 0xe8d8a0 },
    bio: 'Calico in a sun hat. Gardens. Wants a cat who works with his paws.',
    like: { smooth: -0.2, pun: 0.2, honest: 0.9, bold: -0.3, weird: -0.4, compliment: 0.3, show: -0.5, gift: 0.6 } },
  { id: 'ash', name: 'Ash', look: { fur: 0x6e7480, pat: 'solid', eye: 0x40e0a0, acc: 'choker', ac: 0x18181c },
    bio: 'Russian blue, spiked choker. Goth. Hates compliments, loves the macabre.',
    like: { smooth: -0.3, pun: -0.3, honest: 0.3, bold: 0.2, weird: 0.8, compliment: -0.9, show: -0.3, gift: 0.5 } },
  { id: 'peaches', name: 'Peaches', look: { fur: 0xf0c8a0, pat: 'solid', eye: 0x70a8ff, acc: 'pearls', ac: 0xf4f0e8 },
    bio: 'Cream with pearls. Old-Hollywood glamour. Swoons for a smooth talker.',
    like: { smooth: 0.9, pun: -0.2, honest: 0, bold: 0.4, weird: -0.7, compliment: 0.6, show: 0.2, gift: 0 } },
  { id: 'duchess', name: 'Duchess', gary: true, look: { fur: 0xd8d2e0, pat: 'solid', eye: 0xffb030, acc: 'tiara', ac: 0xf0e0a0 },
    bio: "Gary's prize Persian. HOA Board of Directors, honorary. Reports violations.",
    like: { smooth: 0.1, pun: -0.9, honest: -0.6, bold: -0.2, weird: -0.9, compliment: 0.5, show: 0.1, gift: 0.6 }, hard: 0.15 },
];
const BY = Object.fromEntries(CATS.map((c) => [c.id, c]));

// ---------- the lines ----------
const STYLES = {
  smooth: { tag: 'Smooth', lines: [
    'Are you a laser pointer? Because I would chase you anywhere.',
    "I'd give up all nine of my lives just to spend one with you.",
    "Is it hot out here, or is that just the sunbeam you're sitting in?",
    "They say curiosity killed the cat. Well, I'm very curious about you.",
    'If you were a cardboard box, I would sit in you. ...That came out wrong.',
  ] },
  pun: { tag: 'Punny', lines: [
    "You're the cat's pajamas. Literally. I can see them in your eyes.",
    "Are you a can opener? Because my heart goes thunk when I hear you.",
    "I'm not kitten around. You're purr-fect.",
    "Are you made of catnip? Because I'm feline something.",
    "I'd tell you a joke about my litter box, but it's a little crappy.",
  ] },
  honest: { tag: 'Honest', lines: [
    "I'll be straight with you. I work twelve-hour shifts and I live in an RV. But it's a nice RV.",
    "I don't have much. A truck, a bag of worms, and a feud with the HOA. I'd share all of it.",
    "I'm bad at this. I just think you're neat.",
    "Full disclosure: I've been arrested. Twice. Both times for being a cat.",
  ] },
  bold: { tag: 'Bold', lines: [
    'You. Me. The dumpster behind Rosie\'s. Saturday. Wear something nice.',
    "I'm gonna be honest, I came over here to marry you.",
    'Your human is home at six? Then I\'ll be gone by five fifty-nine.',
    "I've already named our kittens. All twelve of them.",
  ] },
  weird: { tag: 'Weird', lines: [
    '*hisses seductively*',
    '*drops a dead mouse at her feet* It\'s for you. I chewed the head off so you wouldn\'t have to.',
    '*slowly pushes her water bowl off the porch while making eye contact*',
    "I licked a battery once. Felt like this. Like looking at you.",
    '*sniffs her face for an uncomfortably long time*',
  ] },
  compliment: { tag: 'Compliment', lines: [
    'Your whiskers are very symmetrical. I noticed.',
    "That's a really nice loaf you're doing. Great form.",
    'You have the eyes of a cat who has never once been put in a carrier.',
    "Your fur is so shiny I can see my own regret in it.",
  ] },
  show: { tag: 'Show off', lines: [
    '*does a backflip off the mailbox and lands mostly on his feet*',
    "I can drive, you know. Stick shift. Well, I can steer.",
    '*flexes a paw* Twelve-hour shifts. These are working paws.',
    'I once caught a seven pound catfish. With my face.',
  ] },
};
const STYLE_IDS = Object.keys(STYLES);

// ---------- the answers ----------
const DISGUST = [
  '{n} looks at you the way you look at a bath.',
  '{n} hacks up a hairball. It lands on your foot. That is her answer.',
  '{n} turns around, sits down, and starts washing her butt at you.',
  '{n} hisses so hard her whiskers go flat.',
  '{n}: "Ew. EW. You smell like an RV."',
  '{n} slowly pushes a flower pot off the porch. Eye contact the whole time.',
  '{n} pretends to see a bug behind you, then walks off to "look for it".',
  '{n} gags, dry-heaves twice, and says nothing.',
  '{n}: "My human has a spray bottle. Do not make me."',
  '{n} digs a hole, points at you, then points at the hole.',
  '{n}: "I would rather go to the vet. For the thermometer."',
  '{n} flattens her ears so far back she looks like a seal.',
  '{n}: "Did you just... no. No. Go away."',
  '{n} blinks slowly. Not the nice slow blink. The other one.',
  '{n} sneezes on you. On purpose.',
  '{n}: "I have seen raccoons with more game. And they eat garbage."',
  '{n}: "Go bother Nana. She feeds strays."',
  '{n} yowls for her human. A porch light flicks on. You should leave.',
  '{n}\'s tail puffs up to twice its size. That is a no in every language.',
  '{n}: "Are you wearing a shirt with no pants? Who raised you?"',
  '{n} makes the face cats make at an open yogurt. Then she leaves.',
  '{n}: "I just threw up a little. In my mouth. Because of you."',
];
const MEH = [
  '{n} yawns. Very wide. She did not cover her mouth.',
  '{n}: "Hm." She goes back to staring at a leaf.',
  '{n} looks at you, then at a bird, and picks the bird.',
  '{n}: "Okay." It is unclear what is okay.',
  '{n} gives one slow tail flick. Could mean anything.',
  '{n}: "You\'re blocking my sunbeam, but go on."',
];
const WARM = [
  '{n} tries not to smile. Her tail curls a little anyway.',
  '{n}: "Heh. Okay, that was kind of cute."',
  '{n} rubs her cheek on the mailbox. That counts, right?',
  '{n} slow-blinks at you. The nice one.',
  '{n}: "Maybe. Ask me again sometime."',
  '{n} purrs, then coughs to cover it up.',
];
const SWOON = [
  '{n} rolls onto her back in the grass and purrs like a lawnmower.',
  '{n}: "Oh my whiskers." She headbutts your shoulder.',
  '{n} kneads the lawn with both paws. Biscuits. For you.',
  '{n} chirps, trills, and wraps her tail around your leg.',
  '{n}: "Okay, you can stay. You can definitely stay."',
  '{n} blushes so hard her ears go pink.',
];
// a few in-character extras
const FLAVOR = {
  cleo: { disgust: ['Cleopatra: "Peasant. On your knees. Further. Now leave."'], swoon: ['Cleopatra: "You may kiss the paw. Not that paw. The other paw."'] },
  biscuit: { swoon: ['Biscuit laughs so hard she snorts. Then laughs at the snort. You did that.'] },
  pepper: { disgust: ['Pepper knocks your phone out of your paw. You don\'t even have a phone.'], swoon: ['Pepper bites your ear. Gently. That is how she says hi.'] },
  marigold: { swoon: ['Marigold: "A cat with a job. Be still my heart."'] },
  ash: { disgust: ['Ash: "That was so wholesome I need to lie down in a dark closet."'], swoon: ['Ash: "That was disgusting. I love it."'] },
  peaches: { swoon: ['Peaches sighs like an old movie star and fans herself with a leaf.'] },
  duchess: { disgust: ['Duchess: "I am writing you up. Section 4.2: Lewd Conduct in a Common Area."', 'Duchess rings a tiny bell. Somewhere, Gary starts running.'] },
};
const GIFT_NONE = 'You pat your empty bag. Nothing. Earl at the Bait & Tackle sells rods.';

// ---------- dates (girlfriend stage) ----------
// style: which of her like[] entries the date leans on. night: better after dark. fish: costs a fish.
const DATES = [
  { id: 'stars', label: 'Stargaze on the RV roof', style: 'smooth', night: true, blurb: 'Lie on the warm RV roof and point at stars. Better after dark.',
    great: 'You name a star after her. It is a plane. She does not care. She falls asleep on your shoulder.', bad: '{n} spends the whole date pointing out that "that one is a satellite" and "that one is ALSO a satellite".', awful: 'It rains. You both get soaked. {n} blames you personally and hisses at the sky.' },
  { id: 'dinner', label: 'Candlelit fish dinner', style: 'gift', fish: true, blurb: 'One fish, one candle, two cats, one dumpster lid as a table. Costs a fish.',
    great: '{n} eats her half, then your half, then gazes at you. That is love.', bad: 'The candle sets the napkin on fire. {n} puts it out with a glass of milk. She is unimpressed.', awful: 'You chew with your mouth open. {n} watches in silence, then leaves to "use the litter box" and never comes back.' },
  { id: 'lake', label: 'Walk down to Lake Juniper', style: 'honest', blurb: 'A long walk to the water. You talk about your dreams. Yours involve tuna.',
    great: 'You talk for hours. She tells you about the time she fell in a pool. You tell her about the time you fell in the lake. You are made for each other.', bad: 'An otter steals {n}\'s attention for twenty minutes. You stand there.', awful: 'You slip on the dock and fall in. {n} laughs so hard she has to lie down. Then she goes home.' },
  { id: 'gary', label: "Spy on Gary's lawn mowing", style: 'weird', blurb: 'Hide in the hedge and judge his stripes. Romantic, in a way.',
    great: 'Gary mows a crooked stripe and screams. {n} grabs your paw. You have never been closer.', bad: '{n} gets bored and falls asleep in the hedge. You watch Gary alone.', awful: 'Gary spots you. He chases you both out with a leaf blower. {n} is not speaking to you.' },
  { id: 'trash', label: 'Raid trash night with the raccoons', style: 'bold', blurb: 'Big Ricky owes you one. Tonight, you dine like kings.',
    great: '{n} finds a whole rotisserie chicken. She shares the wishbone with you. She wishes for you.', bad: 'The raccoons keep flirting with {n}. It is very awkward for everyone.', awful: 'A bin lid slams on {n}\'s tail. She yowls, the porch lights come on, and you run in different directions.' },
  { id: 'show', label: 'Take her for a drive', style: 'show', blurb: 'Windows down, radio on, county road, no seatbelts (you are a cat).',
    great: '{n} sticks her head out the window, ears flapping. She has never been this happy. You might cry.', bad: '{n} gets carsick on the second turn. Her opinion of your driving is now "bad".', awful: 'You run a stop sign, a cruiser lights up, and {n} has to hide under the seat for an hour.' },
];

// ---------- state ----------
const S = { aff: {}, wife: null, gf: null, bond: 0, dates: 0, dateAt: 0, met: {}, groomDay: 0, flirts: 0, rejections: 0, cool: {}, last: {} };
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(S, { aff: s.aff || {}, wife: BY[s.wife] ? s.wife : null, gf: BY[s.gf] && !s.wife ? s.gf : null, bond: +s.bond || 0, dates: s.dates | 0, dateAt: +s.dateAt || 0, met: s.met || {}, groomDay: s.groomDay || 0, flirts: s.flirts | 0, rejections: s.rejections | 0 }); } catch (e) { /* storage blocked */ } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ aff: S.aff, wife: S.wife, gf: S.gf, bond: S.bond, dates: S.dates, dateAt: S.dateAt, met: S.met, groomDay: S.groomDay, flirts: S.flirts, rejections: S.rejections })); } catch (e) { /* ignore */ } }
const aff = (id) => Math.round(S.aff[id] || 0);
const pick = (a) => a[(Math.random() * a.length) | 0];
// placement and idle wandering use their own seeded generator so the yard cats never shift the game's random sequence
let seed = 0x9e3779b9;
const rng = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fill = (s, c) => s.replace(/\{n\}/g, c.name);

// ---------- the quest ----------
let A = null, CATLIST = [];
quests.add && quests.add({
  id: 'romance', kind: 'side', title: 'Nine Lives, One Love', giver: 'a yard cat', where: 'the Estates front yards', reward: 100,
  blurb: 'Some very fine lady cats lounge in the Estates front yards. Flirt until one is smitten, ask her out, take your girlfriend on dates until the bond is solid, then propose. Your cat wife moves into the RV.',
  status() { if (S.wife) return 'done'; return Object.keys(S.met).length ? 'active' : 'open'; },
  guide() {
    if (!A) return { obj: '', check: null };
    if (S.wife) return { obj: `Married to ${BY[S.wife].name}. She's waiting at the RV.`, check: null };
    const here = CATLIST.filter((c) => c.home && !c.def.gary);
    if (!Object.keys(S.met).length) {
      const n = nearest(here);
      return { obj: 'Find a yard cat in the Estates front yards and say hi.', check: n && dist(n) > 4 ? { x: n.x, z: n.z, r: 2.2, label: 'Yard cat', col: '#ff8ab0' } : null };
    }
    const best = S.gf ? CATLIST.find((c) => c.def.id === S.gf) : CATLIST.filter((c) => c.home && S.met[c.def.id]).sort((a, b) => aff(b.def.id) - aff(a.def.id))[0];
    if (!best) return { obj: 'Find a yard cat.', check: null };
    const n = best.def.name, b = Math.round(S.bond), wait = Math.ceil(dateWait() / 1000);
    const obj = S.gf ? (b >= 100 ? `You and ${n} are serious (bond 100%). Pop the question!` : wait > 0 ? `Dating ${n} (bond ${b}%). She wants some me-time: next date in ${wait > 60 ? Math.ceil(wait / 60) + ' min' : wait + ' s'}.` : `Dating ${n} (bond ${b}%). Take her on a date.`)
      : aff(best.def.id) >= 100 ? `${n} is smitten (100%). Ask her out!` : `Win over ${n} (${aff(best.def.id)}% smitten). Try lines she likes.`;
    return { obj,
      check: dist(best) > 4 ? { x: best.home.x, z: best.home.z, r: 2.2, label: best.def.name, col: '#ff8ab0' } : null };
  },
});
const DATE_MS = 90e3;   // real time between dates: she needs her me-time
const dateWait = () => Math.max(0, DATE_MS - (Date.now() - (S.dateAt || 0)));
const dist = (c) => Math.hypot(A.px() - c.x, A.pz() - c.z);
function nearest(list) { let b = null, bd = 1e9; for (const c of list) { const d = dist(c); if (d < bd) { bd = d; b = c; } } return b; }

// ---------- textures ----------
const AW = 1024, AH = 512;
// atlas slot of each GLB material: [x, y, w, h]
const SLOT = { Fur: [0, 0, 512, 512], Body: [512, 0, 256, 256], Legs: [768, 0, 128, 128], Feet: [896, 0, 128, 128], Arms: [768, 128, 64, 64], Nose: [832, 128, 16, 16] };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
/** Fur colour at an atlas pixel for the pattern. slot = material name, (sx, sy) = 0..1 inside that slot. */
function furAt(L, slot, sx, sy, seed) {
  const base = rgb(L.fur), p2 = rgb(L.p2 ?? L.fur), p3 = rgb(L.p3 ?? L.p2 ?? L.fur);
  switch (L.pat) {
    case 'tabby': {
      const n = vnoise(sx * 6 + seed, sy * 6) * 2.2;
      return Math.sin((sy * 46 + sx * 9 + n * 3)) > 0.35 ? p2 : base;
    }
    case 'siamese': {
      if (slot === 'Arms' || slot === 'Legs' || slot === 'Feet' || slot === 'Nose') return p2;
      if (slot === 'Fur') {
        if (sy < 0.27) return p2;                                           // the tail strip across the top of the fur map
        const d = Math.hypot((sx - 0.478) / 0.13, (sy - 0.32) / 0.08);       // face mask round the nose
        if (d < 1) return p2; if (d < 1.5) return mix(p2, base, (d - 1) / 0.5);
      }
      return base;
    }
    case 'tuxedo': {
      if (slot === 'Body' && sx > 0.4 && sx < 0.68 && sy < 0.55) return p2;   // white shirt front
      if (slot === 'Feet') return p2;                                       // white socks
      if (slot === 'Fur' && Math.hypot((sx - 0.478) / 0.09, (sy - 0.33) / 0.05) < 1) return p2;   // white muzzle
      return base;
    }
    case 'calico': {
      const n = vnoise(sx * 5 + seed * 3, sy * 5 + 7);
      return n > 0.62 ? p2 : n < 0.3 ? p3 : base;
    }
    default: return base;
  }
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

let srcCanvas = null;   // the untouched atlas, made once from the GLB textures
function paintAtlas(def, i) {
  const L = def.look, c = document.createElement('canvas'); c.width = AW; c.height = AH;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(srcCanvas, 0, 0);
  const img = g.getImageData(0, 0, AW, AH), d = img.data, eye = rgb(L.eye);
  for (const [slot, [x0, y0, w, h]] of Object.entries(SLOT)) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const k = (y * AW + x) * 4, r = d[k], gg = d[k + 1], b = d[k + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0;
      if (mx > 150 && sat < 0.14) {                                         // white fur: recolour, keep the painted shading
        const col = furAt(L, slot, (x - x0) / w, (y - y0) / h, i * 3.7), s = mx / 236;
        d[k] = Math.min(255, col[0] * s); d[k + 1] = Math.min(255, col[1] * s); d[k + 2] = Math.min(255, col[2] * s);
      } else if (slot === 'Fur' && y > 170 && y < 215 && r > 110 && gg > 70 && b < 0.6 * gg && r >= gg && sat > 0.4) {   // yellow iris -> her eye colour
        const s = Math.min(1.15, mx / 225); d[k] = Math.min(255, eye[0] * s); d[k + 1] = Math.min(255, eye[1] * s); d[k + 2] = Math.min(255, eye[2] * s);
      }
    }
  }
  g.putImageData(img, 0, 0);
  // lashes on the outer top corner of each eye, and a little blush (fur map is half scale: eyes ~ (217,195) and (271,195))
  g.strokeStyle = L.pat === 'tuxedo' || (L.fur & 0xff) < 60 ? '#f4f0ea' : '#14121a'; g.lineWidth = 2; g.lineCap = 'round';
  for (const [ex, dir] of [[201, -1], [287, 1]]) for (let j = 0; j < 3; j++) {
    g.beginPath(); g.moveTo(ex - dir * j * 3, 188 - j * 0.5); g.lineTo(ex + dir * (4 - j) - dir * j * 3, 181 - j * 1.5); g.stroke();
  }
  g.fillStyle = 'rgba(255, 110, 150, 0.35)';
  for (const ex of [215, 273]) { g.beginPath(); g.ellipse(ex, 214, 10, 4, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- accessories (head bone space, metres in world scale) ----------
function lam(col, o = {}) { return new THREE.MeshLambertMaterial({ color: col, flatShading: true, ...o }); }
function accessory(L) {
  const g = new THREE.Group(), m = lam(L.ac);
  const add = (geo, mt, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
  switch (L.acc) {
    case 'bow': {
      for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.045, 0.08, 4), m, 0.1 + s * 0.045, 0.26, 0.02, 0, 0, s * Math.PI / 2);
      add(new THREE.BoxGeometry(0.035, 0.035, 0.035), m, 0.1, 0.26, 0.02); break;
    }
    case 'flower': {
      const pet = lam(0xffffff);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.SphereGeometry(0.022, 5, 3), pet, -0.12 + Math.cos(a) * 0.03, 0.24 + Math.sin(a) * 0.03, 0.03); }
      add(new THREE.SphereGeometry(0.02, 5, 3), m, -0.12, 0.24, 0.04); break;
    }
    case 'hat': {
      add(new THREE.CylinderGeometry(0.21, 0.21, 0.012, 10), m, 0, 0.31, -0.01, -0.12);
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 10), m, 0, 0.35, -0.02, -0.12);
      add(new THREE.CylinderGeometry(0.122, 0.122, 0.025, 10), lam(0xe05050), 0, 0.325, -0.02, -0.12); break;
    }
    case 'tiara': {
      add(new THREE.TorusGeometry(0.1, 0.008, 3, 12, Math.PI), m, 0, 0.27, 0.02, -0.4);
      for (const x of [-0.05, 0, 0.05]) add(new THREE.ConeGeometry(0.016, x ? 0.045 : 0.07, 4), m, x, 0.3 + (x ? 0 : 0.01), 0.04 - Math.abs(x) * 0.3, -0.3);
      add(new THREE.OctahedronGeometry(0.014), lam(0xff4080, { emissive: 0x401020 }), 0, 0.33, 0.055); break;
    }
    case 'collar': case 'choker': case 'pearls': break;   // neck pieces: see neckpiece()
  }
  return g;
}
function neckpiece(L) {
  if (!['collar', 'choker', 'pearls'].includes(L.acc)) return null;
  const g = new THREE.Group(), m = lam(L.ac);
  if (L.acc === 'pearls') for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const p = new THREE.Mesh(new THREE.SphereGeometry(0.016, 5, 3), m); p.position.set(Math.sin(a) * 0.085, 0, Math.cos(a) * 0.08); g.add(p); }
  else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.014, 4, 10), m); ring.rotation.x = Math.PI / 2; g.add(ring);
    if (L.acc === 'choker') for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.03, 4), lam(0xd0d0d8)); s.position.set(Math.sin(a) * 0.098, 0, Math.cos(a) * 0.098); s.rotation.set(Math.cos(a) * Math.PI / 2, 0, -Math.sin(a) * Math.PI / 2); g.add(s); }
    else { const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 8), lam(0xf0d040)); tag.rotation.x = Math.PI / 2; tag.position.set(0, -0.025, 0.095); g.add(tag); }
  }
  return g;
}

// ---------- emote bubbles ----------
const EMO = {};
function emoTex(kind) {
  if (EMO[kind]) return EMO[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const heart = (x, y, s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3); g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s); g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3); g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 3; g.stroke(); };
  if (kind === 'swoon') { heart(22, 14, 26, '#ff4f8b'); heart(42, 24, 30, '#ff7aa8'); }
  else if (kind === 'warm') heart(32, 14, 36, '#ff7aa8');
  else if (kind === 'wife') { heart(32, 12, 40, '#ff4f8b'); g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; }
  else if (kind === 'disgust') {
    g.strokeStyle = '#e02020'; g.lineWidth = 7; g.lineCap = 'round';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(32 + sx * 18, 32 + sy * 18, 14, 0, Math.PI * 2); g.stroke(); }
    g.clearRect(0, 0, 0, 0); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.fill();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(32 + sx * 30, 32 + sy * 30, 12, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  } else if (kind === 'meh') { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; for (const x of [14, 32, 50]) { g.beginPath(); g.arc(x, 40, 6, 0, Math.PI * 2); g.fill(); g.stroke(); } }
  else if (kind === 'broken') { heart(32, 14, 36, '#7a2a40'); g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 22); g.lineTo(26, 32); g.lineTo(36, 40); g.lineTo(30, 50); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; EMO[kind] = t; return t;
}

// ---------- model ----------
let template = null;   // { scene, mesh } with the six parts merged into one skinned mesh on the atlas
function buildTemplate(gltf) {
  const sc = gltf.scene, meshes = [];
  sc.traverse((n) => { if (n.isSkinnedMesh) meshes.push(n); });
  sc.updateMatrixWorld(true);
  // the atlas source: every material's texture scaled into its slot
  srcCanvas = document.createElement('canvas'); srcCanvas.width = AW; srcCanvas.height = AH;
  const g = srcCanvas.getContext('2d'); g.fillStyle = '#cf8a30'; g.fillRect(0, 0, AW, AH); g.imageSmoothingEnabled = true;
  for (const m of meshes) { const s = SLOT[m.material.name]; if (s && m.material.map && m.material.map.image) g.drawImage(m.material.map.image, s[0], s[1], s[2], s[3]); }
  // merge when every part shares the first part's bones and bind pose (true for the Tracebench export)
  const main = meshes.find((m) => m.material.name === 'Fur') || meshes[0], bones = main.skeleton.bones;
  const same = (a, b) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < 1e-4);
  let ok = meshes.every((m) => SLOT[m.material.name] && same(m.bindMatrix, main.bindMatrix)
    && m.skeleton.bones.every((b, i) => { const j = bones.indexOf(b); return j >= 0 && same(m.skeleton.boneInverses[i], main.skeleton.boneInverses[j]); }));
  if (ok) {
    try {
      const parts = meshes.map((m) => {
        const src = m.geometry, geo = new THREE.BufferGeometry(), n = src.attributes.position.count;
        geo.setAttribute('position', new THREE.Float32BufferAttribute(Array.from(src.attributes.position.array.slice(0, n * 3)), 3));
        geo.setAttribute('normal', src.attributes.normal ? new THREE.Float32BufferAttribute(Array.from(src.attributes.normal.array.slice(0, n * 3)), 3) : new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
        const [sx, sy, sw, sh] = SLOT[m.material.name], uv = new Float32Array(n * 2), su = src.attributes.uv;
        for (let i = 0; i < n; i++) { uv[i * 2] = (sx + su.getX(i) * sw) / AW; uv[i * 2 + 1] = (sy + su.getY(i) * sh) / AH; }
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const si = new Uint16Array(n * 4), sw4 = new Float32Array(n * 4), a = src.attributes.skinIndex, w = src.attributes.skinWeight;
        for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const b = m.skeleton.bones[a.getComponent(i, k)]; si[i * 4 + k] = Math.max(0, bones.indexOf(b)); sw4[i * 4 + k] = w.getComponent(i, k); }
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw4, 4));
        geo.setIndex(src.index ? Array.from(src.index.array) : [...Array(n).keys()]);
        return geo;
      });
      const merged = mergeGeometries(parts, false);
      if (!merged) throw new Error('merge failed');
      main.geometry = merged;
      for (const m of meshes) if (m !== main) m.parent.remove(m);
    } catch (e) { console.warn('yardcats: merge failed, using six parts', e); ok = false; }
  }
  const shared = new THREE.MeshBasicMaterial({ name: 'YardCat', fog: true });
  if (!ok) for (const m of meshes) {   // fallback: keep the six parts, point each at its atlas slot
    const [sx, sy, sw, sh] = SLOT[m.material.name] || [0, 0, AW, AH];
    m.geometry = m.geometry.clone(); const uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (sx + uv.getX(i) * sw) / AW, (sy + uv.getY(i) * sh) / AH);
    m.material = shared;
  }
  main.material = shared;
  template = { scene: sc, clips: gltf.animations, merged: ok };
}

function makeCatModel(c, i) {
  const root = c.root, model = SkeletonUtils.clone(template.scene), mat = new THREE.MeshBasicMaterial({ map: paintAtlas(c.def, i), fog: true });
  const bones = {};
  model.traverse((n) => {
    if (n.isBone) bones[n.name] = n;
    if (n.isMesh) { n.material = mat; n.frustumCulled = false; }
  });
  model.scale.setScalar(SCALE);
  c.body.add(model);
  const inv = 1 / SCALE;
  const hat = accessory(c.def.look); hat.scale.setScalar(inv); hat.position.set(0, -0.04 * inv, 0); bones.head && bones.head.add(hat);
  const neck = neckpiece(c.def.look); if (neck) { neck.scale.setScalar(inv); (bones.neck || bones.head).add(neck); neck.position.set(0, (bones.neck ? 0.02 : -0.06) * inv, 0); }
  c.mixer = new THREE.AnimationMixer(model);
  c.acts = {}; for (const cl of template.clips) c.acts[cl.name] = c.mixer.clipAction(cl);
  c.mat = mat; c.model = model; c.ready = true;
  play(c, 'Idle', 0);
  root.visible = false;
}
function play(c, name, fade = 0.2, once = false) {
  const a = c.acts && c.acts[name]; if (!a || c.cur === a) return a;
  a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
  if (c.cur) c.cur.crossFadeTo(a, fade, false);
  a.play(); c.cur = a; return a;
}

// ---------- placement ----------
function lawnSpot(y, collide) {
  const H = HOUSES[y.id]; if (!H) return null;
  const mx = y.mx, c = Math.cos(y.ry), s = Math.sin(y.ry);
  const at = (lx, lz) => [y.x + lx * c + lz * s, y.z - lx * s + lz * c];
  const frontZ = H.bb[1][2], lawnZ = (frontZ + y.front) / 2, away = Math.sign(H.door[0] - H.drive[0]) || 1;
  const tries = [[H.door[0] + away * 2.6, lawnZ], [H.door[0] + away * 3.6, lawnZ + 0.8], [H.door[0] + away * 1.6, frontZ + 1.4], [H.door[0], lawnZ + 1], [H.door[0] + away * 4.5, lawnZ - 0.5]];
  for (const [lx, lz] of tries) {
    const [x, z] = at(mx * lx, lz);
    if (lz > y.front - 0.6) continue;
    if (!collide(x, z, 0.45).hit) return { x, z, yaw: y.ry + (rng() - 0.5) * 1.2 };
  }
  return null;
}
function rvSpot(collide, rv) {
  for (let r = 1.8; r < 6; r += 0.6) for (let a = 0; a < 12; a++) { const x = rv.x + Math.cos(a / 12 * Math.PI * 2) * r, z = rv.z + Math.sin(a / 12 * Math.PI * 2) * r; if (!collide(x, z, 0.45).hit) return { x, z, yaw: 0 }; }
  return { x: rv.x + 2, z: rv.z, yaw: 0 };
}

// ---------- the module ----------
/** ctx = { scene, G, P, places, collide, fishing, say, toast, banner, Sfx, addCash, addHeat, hurt, puff, light, mission, px, pz, isTouch } */
export function makeYardCats(ctx) {
  A = ctx;
  const { scene, G, P, places, collide, Sfx } = ctx;
  load();
  // homes: Duchess at Gary's Beaumont, the rest spread over the Estates lots
  const yards = (places.yards || []).slice();
  const garyYard = yards.find((y) => y.id === 'beaumont'), others = yards.filter((y) => y !== garyYard);
  const ladies = CATS.filter((d) => !d.gary), step = Math.max(1, Math.floor(others.length / ladies.length));
  let yi = 0;
  for (const def of CATS) {
    let home = null;
    if (def.gary) home = garyYard && lawnSpot(garyYard, collide);
    else while (!home && yi < others.length) { home = lawnSpot(others[yi], collide); yi += home ? step : 1; }
    if (!home) continue;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    addShadow(root, 0.42, 0.42);
    const emo = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoTex('warm'), transparent: true, depthWrite: false, fog: false }));
    emo.scale.set(0.42, 0.42, 1); emo.position.y = 1.25; emo.visible = false; root.add(emo);
    scene.add(root);
    CATLIST.push({ def, root, body, emo, emoT: 0, home, yard: home, x: home.x, z: home.z, yaw: home.yaw, st: 'idle', t: 1 + rng() * 4, tx: 0, tz: 0, snub: 0, ready: false });
  }
  if (S.wife && BY[S.wife]) moveToRV(CATLIST.find((c) => c.def.id === S.wife));
  // load the GLB once, build the shared template, then dress each cat
  const buf = GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength);
  new GLTFLoader().parse(buf, '', (gltf) => { try { buildTemplate(gltf); CATLIST.forEach((c, i) => makeCatModel(c, i)); srcCanvas = null; } catch (e) { console.error('yardcats: model failed', e); } }, (e) => console.error('yardcats: GLB failed', e));

  function moveToRV(c) {
    if (!c || !places.rv) return;
    const s = rvSpot(collide, places.rv);
    c.home = s; c.x = s.x; c.z = s.z; c.wife = true;
  }
  const _c = new THREE.Color();
  let pending = null, active = null;

  function emote(c, kind, t = 2.6) { c.emo.material.map = emoTex(kind); c.emo.material.needsUpdate = true; c.emo.visible = true; c.emoT = t; }
  const near = () => {
    if (P.car || G.dialog || (ctx.mission && ctx.mission())) return null;
    let b = null, bd = TALK_R;
    for (const c of CATLIST) { if (!c.ready) continue; const d = Math.hypot(P.x - c.x, P.z - c.z); if (d < bd) { bd = d; b = c; } }
    return b;
  };

  // the roll. like in -1..1, a fish gift costs a fish and leans on like.gift.
  function outcome(def, style, roll = Math.random()) {
    const like = def.like[style] ?? 0, a = S.aff[def.id] || 0;
    let p = 0.36 + like * 0.26 + a / 400 - (def.hard || 0);
    if (S.last[def.id] === style) p -= 0.18;                   // the same trick twice in a row
    if (style === 'weird') p += like > 0 ? 0.08 : -0.1;      // weird is high variance
    p = Math.max(0.05, Math.min(0.9, p));
    if (roll < p * 0.42) return 'swoon';
    if (roll < p) return 'warm';
    if (roll < p + (1 - p) * 0.36) return 'meh';
    return 'disgust';
  }
  function respond(c, kind) {
    const fl = FLAVOR[c.def.id] && FLAVOR[c.def.id][kind];
    const pool = kind === 'swoon' ? SWOON : kind === 'warm' ? WARM : kind === 'meh' ? MEH : DISGUST;
    return fill(fl && Math.random() < 0.4 ? pick(fl) : pick(pool), c.def);
  }

  function flirt(c, style, line) {
    const def = c.def, id = def.id;
    S.met[id] = true; S.flirts++;
    if (style === 'gift') {
      const fish = ['trout', 'catfish', 'bass', 'bluegill'].find((f) => ctx.fishing && ctx.fishing.countFish(f) > 0);
      if (!fish) return queue([['Goobles', GIFT_NONE]]);
      ctx.fishing.removeFish(fish, 1);
      line = `*offers her a ${fish === 'bluegill' ? 'bluegill' : fish}, still wet*`;
    }
    const res = outcome(def, style);
    S.last[id] = style;
    const delta = { swoon: 20 + Math.random() * 10, warm: 7 + Math.random() * 6, meh: Math.random() * 3, disgust: -(8 + Math.random() * 10) }[res] * (style === 'gift' ? 1.3 : 1);
    S.aff[id] = Math.max(0, Math.min(100, (S.aff[id] || 0) + delta));
    if (res === 'disgust') { S.rejections++; c.snub = 18 + Math.random() * 14; }
    persist();
    const lines = [['Goobles', line.startsWith('*') ? line : `"${line}"`], [def.name, respond(c, res)]];
    if (def.gary && res === 'disgust' && Math.random() < 0.5 && ctx.addHeat) lines.push(['', 'Gary bursts out of the front door in a bathrobe. "THAT IS A REGISTERED SHOW ANIMAL."']);
    try { Sfx.meow(res === 'disgust' ? 'hiss' : res === 'swoon' ? 'chirp' : 'mrrp', res === 'disgust' ? 1.25 : 1.45); } catch (e) { /* audio off */ }
    queue(lines, () => {
      emote(c, res === 'disgust' ? (Math.random() < 0.5 ? 'disgust' : 'broken') : res);
      if (res === 'swoon') play(c, 'Wave', 0.15, true);
      if (def.gary && res === 'disgust' && lines.length > 2) ctx.addHeat(1, 'flirting with the HOA cat');
      const a = aff(id);
      ctx.toast(res === 'disgust' ? `${def.name} is not into it. Smitten: ${a}%` : a >= 100 && !S.gf && !S.wife ? `${def.name} is head over paws. Ask her out!` : `${def.name}: smitten ${a}%`, 3);
      if (res === 'disgust') { try { Sfx.meow('pff', 0.9, 0.5); } catch (e) { /* audio off */ } }
      cheated(c);
    });
  }
  // stage 2: smitten (100%) -> ask her out -> girlfriend
  function askOut(c) {
    const def = c.def, yes = Math.random() < (def.gary ? 0.55 : 0.8);
    const ask = ['Goobles', pick(['"So... do you wanna maybe go out sometime? Like, on purpose?"', '"Would you be my girlfriend? I have a truck."', '*nervously offers a dandelion* "Wanna be my girlfriend?"'])];
    if (!yes) {
      S.aff[def.id] = 85; persist();
      return queue([ask, [def.name, pick([`${def.name}: "I like you. But I'm not ready to be seen in public with you."`, `${def.name}: "Ask me again when you've showered."`, `${def.name} says yes, then says "wait, no", then walks away to think about it.`])]], () => { emote(c, 'meh'); ctx.toast(`Not yet. ${def.name}: smitten 85%`, 3); });
    }
    S.gf = def.id; S.bond = 10; S.dates = 0; S.dateAt = 0; persist();
    queue([ask, [def.name, `${def.name}: "Fine. Yes. You're my boyfriend now. Don't tell anyone. Tell everyone."`], ['', `You're dating ${def.name}. Take her on dates to build your bond, then propose.`]], () => {
      emote(c, 'swoon', 3); play(c, 'Wave', 0.15, true);
      ctx.banner && ctx.banner('RELATIONSHIP STATUS', `Dating ${def.name}`, 3.5);
      try { Sfx.jingle(); } catch (e) { /* audio off */ }
    });
  }
  // dates: like flirting, the outcome is a roll on her taste for that kind of date
  function goOnDate(c, d) {
    const def = c.def;
    if (d.fish) { const f = ['trout', 'catfish', 'bass', 'bluegill'].find((k) => ctx.fishing.countFish(k) > 0); if (!f) return; ctx.fishing.removeFish(f, 1); }
    const like = def.like[d.style] ?? 0, night = (G.clock ?? 12) >= 20 || (G.clock ?? 12) < 5;
    let p = 0.5 + like * 0.3 + (d.night ? (night ? 0.15 : -0.1) : 0) + S.bond / 500;
    if (S.lastDate === d.id) p -= 0.2;
    p = Math.max(0.1, Math.min(0.92, p));
    const r = Math.random(), res = r < p * 0.55 ? 'great' : r < p ? 'good' : r < p + (1 - p) * 0.5 ? 'bad' : 'awful';
    const delta = { great: 30 + Math.random() * 12, good: 16 + Math.random() * 8, bad: 4, awful: -12 }[res];
    S.bond = Math.max(0, Math.min(100, S.bond + delta)); S.dates++; S.dateAt = Date.now(); S.lastDate = d.id; persist();
    const text = fill(res === 'great' ? d.great : res === 'good' ? pick(WARM) : res === 'bad' ? d.bad : d.awful, def);
    try { Sfx.meow(res === 'awful' ? 'hiss' : res === 'great' ? 'chirp' : 'mrrp', 1.4); } catch (e) { /* audio off */ }
    queue([['', `Date night: ${d.label.toLowerCase()}.`], [def.name, text]], () => {
      emote(c, res === 'great' ? 'swoon' : res === 'good' ? 'warm' : res === 'bad' ? 'meh' : 'broken');
      const b = Math.round(S.bond);
      ctx.toast(res === 'awful' ? `Rough date. Bond ${b}%` : b >= 100 ? `You and ${def.name} are serious. Pop the question!` : `${res === 'great' ? 'Great date!' : res === 'good' ? 'Nice date.' : 'Meh date.'} Bond ${b}%`, 3);
    });
  }
  function breakUp(c) {
    const def = c.def; S.gf = null; S.bond = 0; S.aff[def.id] = 30; persist(); c.snub = 40;
    queue([['Goobles', '"I think we should see other cats."'], [def.name, pick([`${def.name} knocks your phone, wallet, and dignity off the porch.`, `${def.name}: "I was going to dump YOU. Tomorrow. At brunch."`, `${def.name} hisses, then sobs, then hisses again.`])]], () => emote(c, 'broken', 3));
  }
  function propose(c) {
    const def = c.def, yes = Math.random() < (def.gary ? 0.6 : 0.85);
    if (!yes) {
      S.bond = 75; persist();
      const no = pick([
        `${def.name}: "Whoa. Slow down. Get a real job first. One that isn't the RV."`,
        `${def.name}: "I said I LIKED you. I didn't say I wanted your last name. What IS your last name?"`,
        `${def.name}: "Ask me when you've got a ring. A real one. Not a can tab."`,
        `${def.name} panics, zooms around the yard three times, and hides under a car.`,
      ]);
      return queue([['Goobles', '*gets down on one knee and holds out a pop can tab* Will you be my cat wife?'], [def.name, no]], () => { emote(c, 'meh'); ctx.toast(`Not yet. Bond 75%`, 3); });
    }
    S.wife = def.id; S.gf = null; S.bond = 100; S.aff[def.id] = 100; persist();
    queue([['Goobles', '*gets down on one knee and holds out a pop can tab* Will you be my cat wife?'], [def.name, `${def.name}: "...Yes. YES. Obviously yes. Did you think I'd say no? I would never say no. Shut up."`],
      ['', `${def.name} trots off toward the empty lot. She's moving into the RV.`], ['', 'Nana sends a card with $100 in it. "About time, sweetie."']], () => {
      emote(c, 'swoon', 4); ctx.banner && ctx.banner('JUST MARRIED', `${def.name} moved into the RV`, 4);
      try { Sfx.jingle(); } catch (e) { /* audio off */ }
      ctx.addCash && ctx.addCash(100);
      if (def.gary && ctx.addHeat) ctx.addHeat(2, 'eloping with the HOA cat');
      moveToRV(c);
    });
  }
  function wifeMenu(c) {
    const def = c.def;
    return {
      title: `${def.name}  ♥ your wife`,
      items: () => {
        const groomed = Date.now() - (S.groomDay || 0) < GROOM_MS;
        const it = [{ id: 'talk', label: 'Talk', price: '', blurb: 'Ask how her day was.' },
          { id: 'groom', label: groomed ? 'Get groomed (later)' : 'Get groomed', price: groomed ? '' : '+40 HP', blurb: 'She licks your ears clean. Heals you every ten minutes or so.', dim: groomed }];
        if (ctx.fishing && ['trout', 'catfish', 'bass', 'bluegill'].some((f) => ctx.fishing.countFish(f) > 0)) it.push({ id: 'fish', label: 'Bring her a fish', price: '\u{1F41F}x1', blurb: 'Dinner. She will pretend it was her idea.' });
        return it;
      },
      pick: (it) => {
        ctx.fishing.close && ctx.fishing.close();
        if (it.id === 'talk') queue([[def.name, pick([
          `${def.name}: "Gary walked by and looked at the RV for eleven minutes. I stared back for twelve."`,
          `${def.name}: "I knocked your keys under the couch. You're welcome."`,
          `${def.name}: "The raccoons came by. I told them you're taken."`,
          `${def.name}: "I love you. Don't make it weird."`,
          `${def.name}: "You smell like fish and gasoline. It's my favorite."`,
          `${def.name}: "Nana brought a casserole. I sat in it."`,
        ])]], () => emote(c, 'warm'));
        else if (it.id === 'groom') {
          S.groomDay = Date.now(); persist();
          queue([['', `${def.name} grooms your ears, your face, and one spot behind your neck you didn't know was dirty.`]], () => { G.hp = Math.min(100, G.hp + 40); emote(c, 'swoon'); ctx.toast('+40 health. You feel loved and slightly damp.', 3); });
        } else if (it.id === 'fish') {
          const f = ['trout', 'catfish', 'bass', 'bluegill'].find((k) => ctx.fishing.countFish(k) > 0); if (f) ctx.fishing.removeFish(f, 1);
          queue([['', `You give ${def.name} a ${f}. She eats it in front of you without breaking eye contact.`]], () => emote(c, 'swoon'));
        }
      },
    };
  }
  function gfMenu(c) {
    const def = c.def;
    return {
      title: `${def.name}  \u2665 girlfriend · bond ${Math.round(S.bond)}%`,
      items: () => {
        const wait = dateWait(), hasFish = ['trout', 'catfish', 'bass', 'bluegill'].some((f) => ctx.fishing.countFish(f) > 0);
        const it = DATES.map((d) => ({ id: 'd:' + d.id, label: d.label, price: wait > 0 ? 'later' : d.fish ? (hasFish ? '\u{1F41F}x1' : 'no fish') : '', blurb: wait > 0 ? `${def.name} needs some me-time. Next date in ${Math.ceil(wait / 1000)} s.` : d.blurb, dim: wait > 0 || (d.fish && !hasFish) }));
        if (S.bond >= 100) it.unshift({ id: 'propose', label: '\u2665 Pop the question', price: '', blurb: 'You have a pop can tab. It will have to do.' });
        it.push({ id: 'flirt', label: 'Just flirt', price: '', blurb: 'Keep the spark alive.' });
        it.push({ id: 'break', label: 'Break up', price: '', blurb: 'Are you sure? She will remember this.' });
        it.push({ id: 'about', label: `About ${def.name}`, price: '', blurb: `${def.bio} Dates so far: ${S.dates}.` });
        return it;
      },
      pick: (it) => {
        if (it.id === 'about') return;
        if (it.dim) { Sfx.blip(180); return; }
        ctx.fishing.close && ctx.fishing.close();
        if (it.id === 'propose') return propose(c);
        if (it.id === 'break') return breakUp(c);
        if (it.id === 'flirt') { const st = pick(STYLE_IDS); return flirt(c, st, pick(STYLES[st].lines)); }
        goOnDate(c, DATES.find((d) => 'd:' + d.id === it.id));
      },
    };
  }
  function flirtMenu(c) {
    const def = c.def;
    // four styles each visit, plus the gift, plus the proposal once she's smitten
    const styles = STYLE_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    const offer = styles.map((s) => ({ s, line: pick(STYLES[s].lines) }));
    return {
      title: `${def.name}  ♥ ${aff(def.id)}%`,
      items: () => {
        const it = offer.map((o, i) => ({ id: 'l' + i, label: `${STYLES[o.s].tag}: ${o.line.replace(/^\*|\*$/g, '').slice(0, 30)}${o.line.length > 32 ? '...' : ''}`, price: '', blurb: o.line }));
        const hasFish = ctx.fishing && ['trout', 'catfish', 'bass', 'bluegill'].some((f) => ctx.fishing.countFish(f) > 0);
        it.push({ id: 'gift', label: 'Gift: offer her a fish', price: hasFish ? '\u{1F41F}x1' : 'no fish', blurb: hasFish ? 'Nothing says romance like something you pulled out of a lake.' : GIFT_NONE, dim: !hasFish });
        if (aff(def.id) >= 100 && !S.wife && !S.gf) it.push({ id: 'askout', label: '♥ Ask her out', price: '', blurb: 'Make it official. Girlfriend first, then we talk rings.' });
        it.push({ id: 'about', label: `About ${def.name}`, price: '', blurb: def.bio });
        return it;
      },
      pick: (it) => {
        if (it.id === 'about') return;
        if (it.id === 'gift' && it.dim) { Sfx.blip(180); return; }
        ctx.fishing.close && ctx.fishing.close();
        if (it.id === 'askout') return askOut(c);
        if (it.id === 'gift') return flirt(c, 'gift', '');
        const o = offer[+it.id.slice(1)]; flirt(c, o.s, o.line);
      },
    };
  }
  function queue(lines, then) { pending = { lines, then }; }

  function interact() {
    if (P.lock > 0) return false;
    const c = near(); if (!c) return false;
    active = c;
    if (c.wife) return ctx.fishing.menu(wifeMenu(c)) || true;
    if (S.gf === c.def.id) return ctx.fishing.menu(gfMenu(c)) || true;
    if (c.snub > 0) { queue([['', pick([`${c.def.name} has her back to you. She is not talking to you right now.`, `${c.def.name} is very busy staring at a wall.`, `${c.def.name}: "No."`])]]); return true; }
    if (!S.met[c.def.id] && !S.metOnce) { S.metOnce = true; ctx.toast(`${c.def.name}. ${c.def.bio}`, 4.5); }
    if ((S.wife || S.gf) && !S.warned) { S.warned = true; ctx.toast(`Careful. ${BY[S.wife || S.gf].name} hears everything.`, 3.5); }
    return ctx.fishing.menu(flirtMenu(c)) || true;
  }
  // ---------- jealousy: flirting with another cat while taken ----------
  // married: the wife storms over from the RV, fights the other cat (dust cloud, the rival flees and won't talk to you),
  // then marches up to Goobles and scolds him. Dating: the girlfriend hears about it and the bond drops.
  let chase = null;
  const SCOLD = [
    ['"A POP CAN TAB, GOOBLES. I accepted a POP CAN TAB for you."', '"You think I didn\'t see that? I see EVERYTHING. I am a CAT."', '"You\'re sleeping in the truck tonight."'],
    ['"Who was she? No. Don\'t answer. I already handled it."', '"I leave you alone for ONE nap."', '"Go home. Now. Walk in front of me."'],
    ['"Do you know how embarrassing that was for me? In front of the whole cul-de-sac?"', '"Gary SAW that, Goobles. GARY."', '"No fish for a week. I mean it."'],
  ];
  function cheated(c) {
    if (S.gf && S.gf !== c.def.id) {
      const g = BY[S.gf]; if (Math.random() < 0.6) { S.bond = Math.max(0, S.bond - 25); persist(); ctx.toast(`Word gets back to ${g.name}. Bond ${Math.round(S.bond)}%`, 3.5); }
      return;
    }
    if (!S.wife || S.wife === c.def.id) return;
    const w = CATLIST.find((k) => k.def.id === S.wife); if (!w || chase) return;
    // if the RV is far away she turns up at the edge of view, so the scene plays out right here
    if (Math.hypot(c.x - w.x, c.z - w.z) > 24) { const a = Math.random() * Math.PI * 2; for (let k = 0; k < 8; k++) { const x = c.x + Math.cos(a + k) * 18, z = c.z + Math.sin(a + k) * 18; if (!collide(x, z, 0.4).hit) { w.x = x; w.z = z; break; } } }
    chase = { w, rival: c, phase: 'run', t: 0 };
    emote(w, 'disgust', 60);
    ctx.banner && ctx.banner(`${w.def.name.toUpperCase()} SAW THAT`, 'uh oh', 3);
    try { Sfx.meow('yowl', 1.3); } catch (e) { /* audio off */ }
  }
  function moveTo(w, tx, tz, speed, dt) {
    const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz); if (d < 1e-3) return d;
    const sp = Math.min(d, speed * dt), r = collide(w.x + dx / d * sp, w.z + dz / d * sp, 0.3);
    w.x = r.x; w.z = r.z; w.yaw = Math.atan2(dx, dz); return d;
  }
  function updateChase(dt) {
    const ch = chase, w = ch.w, rv = ch.rival; ch.t += dt;
    if (ch.phase === 'run') {                     // storm over to the other cat
      if (moveTo(w, rv.x, rv.z, 5.2, dt) < 0.7 || ch.t > 20) { ch.phase = 'fight'; ch.t = 0; rv.snub = 0; try { Sfx.meow('hiss', 1.2); } catch (e) { /* audio off */ } }
    } else if (ch.phase === 'fight') {            // cat fight: a spinning dust cloud, hisses, the rival gets knocked about
      const a = ch.t * 14;
      w.x = rv.x + Math.cos(a) * 0.35; w.z = rv.z + Math.sin(a) * 0.35; w.yaw = a; rv.yaw = -a;
      if (ctx.puff && Math.random() < dt * 30) ctx.puff('dust', rv.x + (Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.4, rv.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2, 0.8, 0.7);
      if (Math.random() < dt * 4) { try { Sfx.meow(Math.random() < 0.5 ? 'hiss' : 'yowl', 1.1 + Math.random() * 0.4); if (Math.random() < 0.5) Sfx.punch(); } catch (e) { /* audio off */ } }
      if (ch.t > 2.6) {
        ch.phase = 'flee'; ch.t = 0; emote(rv, 'broken', 4); rv.snub = 120;
        S.aff[rv.def.id] = Math.max(0, (S.aff[rv.def.id] || 0) - 40); persist();
        // the rival bolts to the far side of her lawn
        const ax = rv.x - P.x, az = rv.z - P.z, l = Math.hypot(ax, az) || 1; ch.fx = rv.yard.x + ax / l * 1.2; ch.fz = rv.yard.z + az / l * 1.2;
        if (collide(ch.fx, ch.fz, 0.4).hit) { ch.fx = rv.yard.x; ch.fz = rv.yard.z; }
        ctx.toast(`${rv.def.name} loses the fight and runs off. She will not be talking to you for a while.`, 3.5);
      }
    } else if (ch.phase === 'flee') {             // rival runs off, the wife turns on Goobles
      moveTo(rv, ch.fx, ch.fz, 4, dt);
      const tx = P.car ? P.car.x : P.x, tz = P.car ? P.car.z : P.z;
      if (moveTo(w, tx, tz, 4.2, dt) < 1.1 || ch.t > 15) {
        ch.phase = 'scold'; w.yaw = Math.atan2(tx - w.x, tz - w.z);
        const s = pick(SCOLD), n = w.def.name;
        queue([[n, `${n}: ${s[0]}`], ['Goobles', pick(['"It\'s not what it looked like."', '"I was just being friendly!"', '"She started it."', '*stares at his feet*'])], [n, `${n}: ${s[1]}`], [n, `${n}: ${s[2]}`]], () => {
          S.cheats = (S.cheats || 0) + 1; persist();
          ch.phase = 'home'; w.emo.visible = false; emote(w, 'disgust', 3);
          ctx.toast(`${n} stomps back to the RV.`, 3);
        });
      }
    } else if (ch.phase === 'home') {             // walk back to the RV, then life goes on
      if (moveTo(w, w.home.x, w.home.z, 2.2, dt) < 0.3 || Math.hypot(P.x - w.x, P.z - w.z) > SHOW_R - 2) { w.x = w.home.x; w.z = w.home.z; w.st = 'idle'; w.t = 3; chase = null; }
    }
  }
  function prompt() {
    const c = near(); if (!c) return '';
    return c.wife ? `E: Talk to ${c.def.name} ♥` : S.gf === c.def.id ? `E: Date ${c.def.name} ♥` : `E: Flirt with ${c.def.name}`;
  }

  function update(dt) {
    if (pending && !G.dialog && !(ctx.fishing && ctx.fishing.menuOpen())) { const p = pending; pending = null; ctx.say(p.lines, p.then); }
    const L = ctx.light ? ctx.light() : null;
    if (L) _c.setRGB(1, 1, 1).lerp(L.color, 0.25 * (1 - L.k)).multiplyScalar(L.k);
    const px = ctx.px(), pz = ctx.pz();
    if (chase && !G.paused) updateChase(dt);
    for (const c of CATLIST) {
      const d = Math.hypot(px - c.x, pz - c.z), show = c.ready && d < SHOW_R && !(ctx.inside && ctx.inside());
      c.root.visible = show;
      if (!show) continue;
      if (c.snub > 0) c.snub -= dt;
      if (c.emoT > 0 && (c.emoT -= dt) <= 0) c.emo.visible = false;
      if (c.emo.visible) c.emo.position.y = 1.2 + Math.sin(G.time * 4) * 0.04;
      // behaviour: face Goobles when he's close (back to him while snubbing), otherwise idle and stroll round the yard
      let want = c.yaw, moving = false;
      const pd = Math.hypot(P.x - c.x, P.z - c.z);
      if (chase && (chase.w === c || (chase.rival === c && chase.phase !== 'run'))) { want = c.yaw; moving = chase.phase !== 'scold'; }
      else if (pd < 5 && !P.car) { want = Math.atan2(P.x - c.x, P.z - c.z) + (c.snub > 0 ? Math.PI : 0); c.st = 'idle'; c.t = Math.max(c.t, 2); }
      else if (c.st === 'walk') {
        const dx = c.tx - c.x, dz = c.tz - c.z, dd = Math.hypot(dx, dz);
        if (dd < 0.1 || (c.t -= dt) <= 0) { c.st = 'idle'; c.t = 3 + rng() * 6; }
        else { const v = Math.min(dd, 0.55 * dt); c.x += dx / dd * v; c.z += dz / dd * v; want = Math.atan2(dx, dz); moving = true; }
      } else if ((c.t -= dt) <= 0) {
        const a = rng() * Math.PI * 2, r = 0.5 + rng() * (c.wife ? 1.2 : 1.6), tx = c.home.x + Math.cos(a) * r, tz = c.home.z + Math.sin(a) * r;
        if (!collide(tx, tz, 0.4).hit) { c.st = 'walk'; c.tx = tx; c.tz = tz; c.t = 8; } else c.t = 1;
      }
      let dy = want - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 4);
      if (pd < 0.55 && !P.car && pd > 1e-3) { const k = 0.55 / pd; P.x = c.x + (P.x - c.x) * k; P.z = c.z + (P.z - c.z) * k; }   // Goobles can't walk through her
      c.root.position.set(c.x, 0, c.z); c.body.rotation.y = c.yaw;
      if (c.wife && !c.emo.visible && rng() < dt * 0.08) emote(c, 'wife', 2);
      if (c.wife && !chase) {   // welcome home: once each time Goobles comes back after being away a while
        if (pd > 30) c.away = (c.away || 0) + dt;
        else if (pd < 9 && c.away > 45) { c.away = 0; emote(c, 'swoon', 3); play(c, 'Wave', 0.15, true); ctx.toast(pick([`${c.def.name}: "You're home!"`, `${c.def.name}: "Took you long enough."`, `${c.def.name}: "There's my idiot."`, `${c.def.name}: "Did you bring fish?"`]), 3); }
      }
      if (d < ANIM_R && c.mixer) {
        if (c.cur !== c.acts.Wave || c.cur.time >= c.cur.getClip().duration - 0.02) play(c, chase && moving && (chase.w === c || chase.rival === c) ? 'Run' : moving ? 'Walk' : 'Idle');
        if (moving && c.cur) c.cur.timeScale = chase && (chase.w === c || chase.rival === c) ? 1.6 : 1.1;
        c.mixer.update(dt);
      }
      if (L && c.mat) c.mat.color.copy(_c);
    }
  }

  const api = {
    S, cats: CATLIST, CATS, STYLES, update, interact, prompt, outcome: (id, style, roll) => outcome(BY[id], style, roll),
    flirt: (id, style) => { const c = CATLIST.find((k) => k.def.id === id); if (c) flirt(c, style, pick(STYLES[style] ? STYLES[style].lines : ['...'])); return c ? aff(id) : -1; },
    propose: (id) => { const c = CATLIST.find((k) => k.def.id === id); if (c) propose(c); },
    askOut: (id) => { const c = CATLIST.find((k) => k.def.id === id); if (c) askOut(c); },
    date: (id, dateId) => { const c = CATLIST.find((k) => k.def.id === id); if (c) goOnDate(c, DATES.find((d) => d.id === dateId) || DATES[2]); },
    cheat: (id) => { const c = CATLIST.find((k) => k.def.id === id); if (c) cheated(c); },
    get chase() { return chase; }, DATES,
    get template() { return template; },
    get pending() { return pending; },
    reset() { chase = null; Object.assign(S, { aff: {}, wife: null, gf: null, bond: 0, dates: 0, dateAt: 0, warned: false, met: {}, groomDay: 0, flirts: 0, rejections: 0, cool: {}, last: {} }); persist(); for (const c of CATLIST) { c.wife = false; c.snub = 0; c.home = c.yard; c.x = c.yard.x; c.z = c.yard.z; } },
  };
  return api;
}

// ---------- dressed copies for other modules (catshow.js: the rival show cats) ----------
/** Parses the GLB again (the yard cats drop their source atlas after init) and dresses one cat per look
 *  ({ fur, pat, p2, p3, eye, acc, ac } as in CATS). Resolves to { list: [{ root, play(name, once), mixer }], update(dt), dispose() }. */
export function makeCatFigures(looks) {
  return new Promise((resolve, reject) => {
    const buf = GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength);
    new GLTFLoader().parse(buf, '', (gltf) => {
      const keepT = template, keepS = srcCanvas;
      try {
        buildTemplate(gltf);
        const mine = template, mats = [];
        const list = looks.map((look, i) => {
          const root = new THREE.Group(), body = new THREE.Group(); root.add(body); addShadow(root, 0.42, 0.42);
          const c = { def: { look }, root, body };
          makeCatModel(c, i + 11); root.visible = true; mats.push(c.mat);
          return { root, mixer: c.mixer, play: (name, once = false) => { const a = play(c, name, 0.2, once); if (once && a) c.mixer.addEventListener('finished', function back(e) { if (e.action === a) { c.mixer.removeEventListener('finished', back); play(c, 'Idle'); } }); } };
        });
        resolve({
          list,
          update: (dt) => { for (const f of list) f.mixer.update(dt); },
          dispose: () => { for (const m of mats) { m.map && m.map.dispose(); m.dispose(); } mine.scene.traverse((n) => { if (n.isMesh && n.geometry) n.geometry.dispose(); }); },
        });
      } catch (e) { reject(e); } finally { if (keepT) template = keepT; srcCanvas = keepS; }
    }, reject);
  });
}
