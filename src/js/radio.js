// Car radio for Maple Grove: Off Leash. Everything is synthesized WebAudio (no audio files, no real songs):
// four music stations that write their own original songs from a seed (country, synth pop, lo-fi, garage rock),
// a talk station, and in a police cruiser the PD scanner (squelch, static, dispatcher chatter with captions).
// Stations keep "playing" while you listen to another one: each song is placed on a station clock, so switching
// back lands mid-song like real radio. Only the station you hear is scheduled (about 0.3 s ahead), so the cost is
// a handful of short-lived nodes per beat and nothing at all on foot.
// Controls: R (or L3/R3 on a gamepad, or tap the station name on touch) = next station.
// Debug: window.__RADIO (.next(), .set(i), .station, .stations, .engine).
import { Sfx } from './sfx.js';

export const RADIO_ENABLED = true;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[(r() * a.length) | 0];
const MODES = { ion: [0, 2, 4, 5, 7, 9, 11], aeo: [0, 2, 3, 5, 7, 8, 10], mix: [0, 2, 4, 5, 7, 9, 10], dor: [0, 2, 3, 5, 7, 9, 10] };
const SONG = 96;   // seconds of station clock per song slot (music + a short DJ sting)

// ---------------- station list ----------------
export const STATIONS = [
  { id: 'country', name: '98.1 KMPL', tag: 'Grove Country', col: '#ffcf6a', bpm: [100, 124], modes: ['ion', 'mix'],
    prog: [[0, 3, 4, 0], [0, 4, 5, 3], [0, 0, 3, 4], [0, 3, 0, 4], [3, 0, 4, 0]],
    words: [['Tailgate', 'Gravel', 'Porch Light', 'Dirt Road', 'Two-Lane', 'Feed Store', 'Rusty', 'Sweet Tea', 'Back Forty', 'County Line'], ['Moon', 'Heartbreak', 'Sunday', 'Rodeo', 'Lullaby', 'Prayer', 'Waltz', 'Summer', 'Fishin\' Hole', 'Goodbye']],
    artists: ['Dusty Hargrove', 'The Silo Brothers', 'Kaylee Mae Pruett', 'Hank & the Hayloft', 'Loretta Vance', 'Bo Tillman'] },
  { id: 'pop', name: '104.5 THE GLOW', tag: 'Hits After Dark', col: '#ff7ad9', bpm: [108, 124], modes: ['aeo'],
    prog: [[0, 5, 2, 6], [0, 6, 5, 6], [5, 6, 0, 0], [0, 3, 5, 4]],
    words: [['Neon', 'Midnight', 'Velvet', 'Satellite', 'Electric', 'Static', 'Afterglow', 'Chrome', 'Lightyear', 'Telephone'], ['Hearts', 'Drive', 'Signal', 'Paradise', 'Fever', 'Skyline', 'Mirage', 'Echo', 'Overdrive', 'Weekend']],
    artists: ['Nova Lux', 'Kid Prism', 'The Pastel Club', 'VELVETINE', 'Jet Marlowe', 'Second Sunrise'] },
  { id: 'lofi', name: '88.3 PORCH FM', tag: 'Lo-Fi to Nap To', col: '#9fd8ff', bpm: [70, 84], modes: ['dor', 'ion'],
    prog: [[1, 4, 0, 0], [0, 5, 1, 4], [3, 2, 1, 0], [0, 3, 2, 5]],
    words: [['Rainy', 'Sleepy', 'Window', 'Cardboard', 'Warm', 'Kitchen', 'Sunbeam', 'Lazy', 'Paper', 'Quiet'], ['Nap', 'Tuesday', 'Tea', 'Box', 'Afternoon', 'Blanket', 'Clouds', 'Radiator', 'Hours', 'Paws']],
    artists: ['mrrp.wav', 'catnap collective', 'beanbag', 'sunspot', 'yarnball tapes', 'lowkey loaf'] },
  { id: 'rock', name: '101.9 THE MOWER', tag: 'Garage Rock, Loud', col: '#ff6a4a', bpm: [128, 150], modes: ['mix', 'aeo'],
    prog: [[0, 6, 3, 0], [0, 3, 4, 3], [0, 5, 6, 0], [0, 0, 6, 3]],
    words: [['Riding', 'Burnout', 'Cul-de-Sac', 'Weed Whacker', 'Two-Stroke', 'Busted', 'Garage', 'Loud', 'Red Line', 'HOA'], ['Mower', 'Riot', 'Engine', 'Fence', 'Lawn', 'Rebels', 'Sparks', 'Thunder', 'Muffler', 'Nights']],
    artists: ['Grass Clippings', 'The Busted Mufflers', 'Lawn Order', 'Sod Destroyer', 'The Weedeaters', 'Unpermitted Shed'] },
  { id: 'talk', name: 'AM 1260', tag: 'Maple Grove Talk', col: '#d0d0b0', talk: true },
  { id: 'off', name: 'RADIO OFF', tag: '', col: '#8a8a8a', off: true },
];
export const SCANNER = { id: 'scanner', name: 'MGPD SCANNER', tag: 'Dispatch, Channel 2', col: '#7fb2ff', scanner: true };

const TALK = [
  ['host', "You're listening to AM 1260, Maple Grove Talk. Lines are open."],
  ['host', 'Caller, you are on the air.'],
  ['caller', "Hi, long time listener. There's a cat driving around town. In a truck."],
  ['host', "Ma'am, cats can't drive. Next caller."],
  ['caller', 'Yeah, Gary from the HOA here. Somebody painted their mailbox teal.'],
  ['host', "Gary, that's the fourth call this week. About mailboxes."],
  ['host', 'Reminder: the Quik Stop slushie machine is fixed. Mostly.'],
  ['host', 'The Donut Hole is trading donuts for fish now. We do not ask questions.'],
  ['caller', 'The Hollow Woods hum at night. Is that normal?'],
  ['host', 'Lock your doors, folks. And maybe your windows.'],
  ['host', 'Weather: clear skies, light breeze, zero chance of the HOA relaxing.'],
  ['caller', 'Lost: one inflatable tube man. Answers to Tube. Last seen waving.'],
  ['host', "Nana's casserole drive is this weekend. Bring a dish, bring a fork."],
  ['caller', 'The raccoons at the park took my sandwich. And my wallet.'],
  ['host', 'Coming up: forty minutes on lawn height. Stay with us.'],
  ['caller', 'Is it legal to fish in the lake with a shopping cart?'],
  ['host', "Sir, I'm a radio host. Next caller."],
];
const DISPATCH = [
  ['d', 'Dispatch: Unit 12, ten fifty-four, cows on County Road 12.'], ['u', 'Unit 12 copies, en route.'],
  ['d', 'Dispatch: Any unit, noise complaint in the Estates. HOA is on scene. Again.'], ['u', 'Unit 4, show me responding. Sigh.'],
  ['d', 'Dispatch: Ten thirty-one, suspicious raccoon activity at the park.'], ['u', 'Unit 7, they are just eating trash. Clear.'],
  ['d', 'Dispatch: Quik Stop reports a slushie dine-and-dash. Suspect wore a cape.'],
  ['u', 'Unit 9, ten seven at the Donut Hole. Lunch.'], ['d', 'Dispatch: Copy Unit 9. Bring the box back this time.'],
  ['d', 'Dispatch: Units, watch your speed on Main. School zone.'],
  ['d', 'Dispatch: Report of a tube man flailing near the lot. Ten ninety-six, use caution.'],
  ['u', 'Unit 3, traffic stop on Elm, plate is a fish sticker.'], ['d', 'Dispatch: Ten four, Unit 3.'],
  ['d', 'Dispatch: Any unit near the church, a goose is blocking the lot.'],
];
const HEAT = ['Dispatch: All units, suspect is a small white cat. Repeat, a cat.', 'Dispatch: Suspect fleeing on four paws, approach with treats.',
  'Unit 5: I have eyes on the cat, he looks... indifferent.', 'Dispatch: Units, suspect is armed with claws. Proceed with caution.'];
const STOLEN = ['Dispatch: Be advised, a cruiser has been stolen. By a cat.', 'Dispatch: Whoever is in the stolen unit, please return it. And the donuts.',
  'Dispatch: Stolen unit, we can hear you meowing on the open mic.'];

// ---------------- engine: works on any AudioContext (live or Offline for previews) ----------------
export function makeRadioEngine(ctx, out, opts = {}) {
  const sr = ctx.sampleRate;
  const nb = ctx.createBuffer(1, sr, sr), nd = nb.getChannelData(0);
  for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  // shared chain: station bus -> car-speaker band limit -> volume -> out
  const vol = ctx.createGain(); vol.gain.value = 0; vol.connect(out);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
  hp.connect(lp); lp.connect(comp); comp.connect(vol);
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(hp);
  // distortion for the rock guitar
  const shaper = ctx.createWaveShaper(); { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 6); } shaper.curve = c; }
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
  const dg = ctx.createGain(); dg.gain.value = 0.12; shaper.connect(dlp); dlp.connect(dg); dg.connect(bus);
  // radio voice band (scanner / AM talk / phone callers)
  const vbp = ctx.createBiquadFilter(); vbp.type = 'bandpass'; vbp.frequency.value = 1300; vbp.Q.value = 0.9;
  const vsh = ctx.createWaveShaper(); { const n = 512, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 2.2); } vsh.curve = c; }
  const vg = ctx.createGain(); vg.gain.value = 1.9; vbp.connect(vsh); vsh.connect(vg); vg.connect(bus);

  function noiseSrc(t, dur) { const s = ctx.createBufferSource(); s.buffer = nb; s.start(t, Math.random() * 0.5, dur + 0.05); return s; }
  function env(g, t, a, peak, d, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, d); g.gain.setTargetAtTime(0.0001, end, rel);
  }
  // ---- drums ----
  function kick(t, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.34);
  }
  function snare(t, v = 1, tone = 1500, len = 0.16) {
    const s = noiseSrc(t, len), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = tone;
    g.gain.setValueAtTime(0.3 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(bus);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 190;
    og.gain.setValueAtTime(0.18 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.1);
  }
  function brush(t, v = 1) {
    const s = noiseSrc(t, 0.16), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    s.connect(f); f.connect(g); g.connect(bus);
  }
  function hat(t, v = 1, open = false) {
    const len = open ? 0.22 : 0.045, s = noiseSrc(t, len), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(0.11 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(bus);
  }
  // ---- tonal voices ----
  function note(t, m, dur, v, o = {}) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass';
    const cut = o.cut || 2000; f.frequency.setValueAtTime(cut * (o.cenv || 1), t); if (o.cenv) f.frequency.setTargetAtTime(cut, t, o.cdec || 0.08);
    f.Q.value = o.q || 0.7;
    env(g, t, o.a || 0.006, v, o.d || 0.15, o.s ?? 0.5, o.r || 0.06, t + dur);
    f.connect(g); g.connect(o.to || bus);
    const fr = mtof(m), dets = o.det ? [-o.det, o.det] : [0], end = t + dur + (o.r || 0.06) * 5;
    for (const dt of dets) {
      const x = ctx.createOscillator(); x.type = o.type || 'triangle'; x.frequency.value = fr; x.detune.value = dt;
      if (o.slide) { x.frequency.setValueAtTime(fr * Math.pow(2, o.slide / 12), t); x.frequency.exponentialRampToValueAtTime(fr, t + 0.08); }
      if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(fr * o.vib, t + Math.min(0.3, dur)); l.connect(lg); lg.connect(x.frequency); l.start(t); l.stop(end); }
      x.connect(f); x.start(t); x.stop(end);
    }
  }
  function rhodes(t, m, dur, v) {   // two-operator FM electric piano
    const fr = mtof(m), c = ctx.createOscillator(), mo = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    c.type = mo.type = 'sine'; c.frequency.value = fr; mo.frequency.value = fr;
    mg.gain.setValueAtTime(fr * 1.6, t); mg.gain.setTargetAtTime(fr * 0.15, t, 0.25);
    env(g, t, 0.004, v, 0.6, 0.35, 0.25, t + dur);
    mo.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(bus);
    const end = t + dur + 1.3; c.start(t); mo.start(t); c.stop(end); mo.stop(end);
  }
  // ---- babble voice (talk / dispatch / DJ): one oscillator + two formants, automated per syllable ----
  const VOW = [[800, 1200], [500, 1850], [320, 2300], [520, 900], [380, 800], [650, 1650]];
  function babble(t, text, o = {}) {
    const pitch = o.pitch || 140, rate = o.rate || 1, v = o.vol || 0.5, dest = o.to || vbp;
    const x = ctx.createOscillator(); x.type = 'sawtooth';
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(); f1.type = f2.type = 'bandpass'; f1.Q.value = 6; f2.Q.value = 9;
    const g = ctx.createGain(), g2 = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g2.gain.value = 0.55;
    x.connect(f1); x.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g); g.connect(dest);
    const ns = noiseSrc(t, 8), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); nf.type = 'highpass'; nf.frequency.value = 3500; ng.gain.setValueAtTime(0, t);
    ns.connect(nf); nf.connect(ng); ng.connect(dest);
    const words = text.replace(/^[A-Za-z0-9 ]+: /, '').split(/\s+/);
    let tt = t; const total = words.length;
    words.forEach((w, wi) => {
      const syl = Math.max(1, Math.round(w.replace(/[^a-z]/gi, '').length / 3));
      for (let k = 0; k < syl; k++) {
        const d = (0.08 + Math.random() * 0.07) / rate, V = VOW[(Math.random() * VOW.length) | 0];
        const decl = 1 - 0.12 * (wi / total), q = /\?$/.test(text) && wi === total - 1 ? 1.25 : 1;
        x.frequency.setTargetAtTime(pitch * decl * q * (0.92 + Math.random() * 0.18), tt, 0.02);
        f1.frequency.setTargetAtTime(V[0], tt, 0.018); f2.frequency.setTargetAtTime(V[1], tt, 0.018);
        if (Math.random() < 0.55) { ng.gain.setValueAtTime(v * 0.25, tt); ng.gain.setTargetAtTime(0, tt + 0.01, 0.01); }
        g.gain.setTargetAtTime(v, tt + 0.012, 0.012); g.gain.setTargetAtTime(v * 0.12, tt + d * 0.75, 0.015);
        tt += d;
      }
      tt += /[.,!?:]$/.test(w) ? 0.22 / rate : 0.035 / rate;
    });
    g.gain.setTargetAtTime(0.0001, tt, 0.03);
    x.frequency.setValueAtTime(pitch, t); x.start(t); x.stop(tt + 0.3); ns.stop(tt + 0.3);
    return tt;
  }
  function squelch(t, len = 0.12, v = 0.25) {
    const s = noiseSrc(t, len), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.5;
    g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0.0001, t + len * 0.6, 0.02); s.connect(f); f.connect(g); g.connect(bus);
  }
  function chirp(t, f = 1050, len = 0.07, v = 0.12) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(0.0001, t + len); o.connect(g); g.connect(bus); o.start(t); o.stop(t + len + 0.02);
  }
  // a quiet looping bed (static hiss, vinyl crackle), started with the station and stopped on a switch
  function bed(kind) {
    const len = sr * 2, b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = kind === 'crackle' ? (Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.02) : (Math.random() * 2 - 1);
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = kind === 'crackle' ? 'lowpass' : 'bandpass'; f.frequency.value = kind === 'crackle' ? 5000 : 1800;
    const g = ctx.createGain(); g.gain.value = kind === 'crackle' ? 0.35 : kind === 'am' ? 0.012 : 0.022;
    s.connect(f); f.connect(g); g.connect(bus); s.start();
    return { stop(t) { try { g.gain.setTargetAtTime(0, t, 0.05); s.stop(t + 0.3); } catch (e) { /* already stopped */ } } };
  }

  // ---------------- songs ----------------
  const songCache = new Map();
  function song(si, k) {
    const key = si * 100000 + k; if (songCache.has(key)) return songCache.get(key);
    const S = STATIONS[si], r = rng(opts.seed ? opts.seed + key : 7919 * key + 13);
    const bpm = Math.round(S.bpm[0] + r() * (S.bpm[1] - S.bpm[0])), bar = 240 / bpm;
    const bars = Math.max(8, Math.floor((SONG - 6) / bar / 4) * 4);
    const mode = pick(r, S.modes), root = 40 + ((r() * 12) | 0);   // E2..D#3
    const progA = pick(r, S.prog), progB = pick(r, S.prog);
    const motif = (density, hi) => {   // a 2-bar phrase: [step, len, scale index]
      const out = []; let deg = pick(r, [0, 2, 4]) + (hi ? 7 : 0);
      for (let st = 0; st < 32; st += 2) {
        if (r() > density && st % 8) continue;
        if (st % 8 === 0) deg = (hi ? 7 : 0) + pick(r, [0, 2, 4, 2, 0]); else deg += pick(r, [-1, 1, -2, 2, 0, 1, -1]);
        deg = Math.max(-2, Math.min(11, deg));
        out.push([st, pick(r, [2, 2, 4, 2, 6]), deg]);
      }
      return out;
    };
    const s = { bpm, bar, step: bar / 16, bars, mode: MODES[mode], root, progA, progB, mA: motif(S.id === 'lofi' ? 0.3 : 0.55, false), mB: motif(S.id === 'lofi' ? 0.4 : 0.7, true),
      title: `${pick(r, S.words[0])} ${pick(r, S.words[1])}`, artist: pick(r, S.artists), fill: r() < 0.5, swing: S.id === 'lofi' ? 0.3 : 0 };
    songCache.set(key, s); if (songCache.size > 40) songCache.delete(songCache.keys().next().value);
    return s;
  }
  const deg = (s, i) => s.root + s.mode[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
  function section(s, b) {
    if (b < 4) return 'intro';
    if (b >= s.bars - 4) return 'outro';
    return Math.floor((b - 4) / 8) % 2 ? 'B' : 'A';
  }
  // schedules one 16th step of a song
  let played = 0;
  function playStep(si, s, b, st, t) {
    played++;
    const S = STATIONS[si], sec = section(s, b), prog = sec === 'B' ? s.progB : s.progA, ch = prog[b % 4], sd = s.step;
    const tri = [deg(s, ch), deg(s, ch + 2), deg(s, ch + 4)], bassN = deg(s, ch) - 12 * (deg(s, ch) > 47 ? 1 : 0);
    if (st % 2 && s.swing) t += sd * s.swing;
    const lead = (sec === 'A' || sec === 'B') ? (sec === 'B' ? s.mB : s.mA) : sec === 'outro' && b < s.bars - 2 ? s.mA : null;
    const ln = lead && lead.find((n) => n[0] === st + (b % 2) * 16);
    const leadM = ln ? deg(s, ch + ln[2]) + 12 : 0, lenT = ln ? ln[1] * sd : 0;
    const fill = s.fill && b % 8 === 7 && st >= 12, drumsOn = sec !== 'intro' || b >= 2, last = b >= s.bars - 1;
    if (last && st > 0) return;
    if (S.id === 'country') {
      if (drumsOn) { if (st % 8 === 0) kick(t, 0.7); if (st % 8 === 4) brush(t, 1.1); if (st % 2 === 0) hat(t, 0.35); if (fill && st % 2) snare(t, 0.4, 2500, 0.08); }
      if (st === 0) note(t, bassN, sd * 3, 0.32, { type: 'triangle', cut: 900 });
      if (st === 8) note(t, bassN + 7, sd * 3, 0.3, { type: 'triangle', cut: 900 });
      if (st === 14 && b % 4 === 3) note(t, bassN + 4, sd * 1.5, 0.26, { type: 'triangle', cut: 900 });
      if (st % 8 === 4 || (st === 0 && sec === 'intro')) tri.forEach((m, i) => note(t + i * 0.012, m + 12, sd * 2.5, 0.06, { type: 'sawtooth', cut: 2600, cenv: 1.6, s: 0.25 }));
      if (ln) note(t, leadM, lenT, 0.1, { type: 'sawtooth', cut: 2400, vib: 0.012, a: 0.03, s: 0.8, slide: st % 8 === 0 ? -1 : 0, det: 6 });
    } else if (S.id === 'pop') {
      if (drumsOn) { if (st % 4 === 0) kick(t, 0.85); if (st % 8 === 4) snare(t, 0.8, 1800); if (st % 4 === 2) hat(t, 0.6, st % 8 === 6); if (fill && st % 2 === 1) snare(t, 0.5); }
      if (st % 2 === 0) note(t, bassN + (st % 4 === 2 ? 12 : 0), sd * 1.6, 0.22, { type: 'sawtooth', cut: 500, cenv: 3, cdec: 0.05, s: 0.4 });
      if (st === 0) tri.forEach((m) => note(t, m + 12, s.bar * 0.95, 0.04, { type: 'sawtooth', cut: 1100, a: 0.25, s: 0.9, r: 0.3, det: 9 }));
      if (sec !== 'intro') note(t, tri[st % 3] + 24, sd * 0.8, 0.035, { type: 'square', cut: 3000, s: 0.2 });
      if (ln) note(t, leadM + 12, lenT, 0.07, { type: 'square', cut: 2600, a: 0.01, s: 0.7, vib: 0.006, det: sec === 'B' ? 8 : 0 });
    } else if (S.id === 'lofi') {
      if (drumsOn) { if (st === 0 || st === 7 || st === 10) kick(t, 0.6); if (st === 4 || st === 12) snare(t, 0.45, 1100, 0.14); if (st % 2 === 0) hat(t, 0.25 + Math.random() * 0.2); }
      const seven = deg(s, ch + 6) + 12;
      if (st === 0 || (st === 10 && b % 2)) [...tri, seven].forEach((m, i) => rhodes(t + i * 0.018, m + 12, st ? s.bar * 0.35 : s.bar * 0.6, 0.06));
      if (st === 0) note(t, bassN, sd * 6, 0.32, { type: 'sine', cut: 600, a: 0.01, s: 0.7 });
      if (st === 8) note(t, bassN + (b % 2 ? 7 : 12), sd * 4, 0.26, { type: 'sine', cut: 600, a: 0.01, s: 0.7 });
      if (ln) note(t, leadM + 12, lenT * 1.3, 0.07, { type: 'triangle', cut: 1800, a: 0.02, s: 0.6, vib: 0.008 });
    } else if (S.id === 'rock') {
      if (drumsOn) { if (st === 0 || st === 6 || st === 8 || (st === 10 && b % 2)) kick(t, 1); if (st % 8 === 4) snare(t, 1.1, 1400, 0.2); if (st % 2 === 0) hat(t, 0.55, sec === 'B' && st % 4 === 0); if (fill && st % 2 === 0) snare(t, 0.8); }
      if (st % 2 === 0) { const m = sec === 'B' && st % 8 ? 0 : 1; [bassN + 12, bassN + 19, bassN + 24].forEach((x) => note(t, x, sec === 'B' && st % 8 === 0 ? sd * 7 : sd * 1.2, 0.5, { type: 'sawtooth', to: shaper, cut: m ? 2500 : 4000, s: 0.7, r: 0.03 })); }
      if (st % 2 === 0) note(t, bassN, sd * 1.5, 0.26, { type: 'sawtooth', cut: 450, s: 0.7 });
      if (ln && sec === 'B') note(t, leadM + 12, lenT, 0.4, { type: 'square', to: shaper, cut: 3000, s: 0.8, vib: 0.01, det: 4 });
    }
  }
  // the DJ between songs: a three-note station ident and one line of chatter
  function sting(si, s, t) {
    const S = STATIONS[si], base = s.root + 24;
    [0, 4, 7].forEach((x, i) => note(t + i * 0.16, base + x + (si * 2), 0.18, 0.08, { type: si === 1 ? 'square' : 'triangle', cut: 3000 }));
    const lines = { country: `${S.name}, all country, all day. That was ${s.artist}.`, pop: `${S.name}, glowing all night long. That was ${s.artist}.`,
      lofi: `${S.name}. stay comfy. that was ${s.artist}.`, rock: `${S.name}! Turn it UP. That was ${s.artist}!` };
    const pitch = { country: 120, pop: 200, lofi: 150, rock: 110 }[S.id];
    const txt = lines[S.id]; const end = babble(t + 0.6, txt, { pitch, vol: 0.55, to: bus, rate: S.id === 'lofi' ? 0.8 : 1.1 });
    return { t: t + 0.6, end, text: txt };
  }

  // ---------------- scheduler ----------------
  const LOOK = opts.look || 0.3;
  const offs = STATIONS.map((_, i) => (opts.seed !== undefined ? 0 : Math.random() * SONG * 8) + i * 17);
  let cur = -1, extra = null, kind = null, next = 0, cursor = null, beds = [];
  const caps = [];   // { t, end, text } captions the UI shows
  function stopBeds(t) { for (const b of beds) b.stop(t); beds = []; }
  function set(st, now) {
    if (cur === st && st !== -1) return;
    stopBeds(now); cursor = null; caps.length = 0;
    cur = st; kind = st === -1 ? null : st === 'scanner' ? 'scanner' : STATIONS[st].talk ? 'talk' : STATIONS[st].off ? null : 'music';
    next = now + (kind === 'music' ? 0.05 : 0.5);
    if (kind === 'scanner') beds.push(bed('hiss'));
    if (kind === 'talk') beds.push(bed('am'));
    if (kind === 'music' && STATIONS[st].id === 'lofi') beds.push(bed('crackle'));
    if (st !== -1) squelch(now, 0.18, 0.12);   // tuning noise
  }
  function locate(si, now) {   // where the station clock is right now: song k, bar, step, time of the next step
    const tc = now + offs[si], k = Math.floor(tc / SONG), s = song(si, k), pos = tc - k * SONG, n = Math.ceil(pos / s.step - 1e-6);
    return { si, k, s, n, t: now + (n * s.step - pos) };
  }
  let talkI = 0, dispI = 0;
  function pump(now, ctxInfo = {}) {
    if (cur === -1 || !kind) return;
    const until = now + LOOK;
    if (kind === 'music') {
      if (!cursor) cursor = locate(cur, now);
      for (;;) {
        const c = cursor, total = c.s.bars * 16;
        if (c.n > total) { const k = c.k + 1; cursor = { k, s: song(cur, k), n: 0, t: k * SONG - offs[cur] }; continue; }
        if (c.t >= until) break;
        if (c.t >= now - 0.02) { if (c.n < total) playStep(cur, c.s, Math.floor(c.n / 16), c.n % 16, c.t); else caps.push(sting(cur, c.s, c.t + 0.8)); }
        c.n++; c.t += c.s.step;
      }
      return;
    }
    if (next > until) return;
    const t = Math.max(next, now);
    if (kind === 'talk') {
      const [who, text] = TALK[talkI++ % TALK.length], host = who === 'host';
      const end = babble(t, text, { pitch: host ? 118 : 175 + (talkI % 3) * 20, vol: host ? 0.7 : 0.55, rate: host ? 1 : 1.15 });
      caps.push({ t, end, text: (host ? 'HOST: ' : 'CALLER: ') + text });
      next = end + 0.5 + Math.random() * 0.8;
    } else if (kind === 'scanner') {
      let line;
      if (ctxInfo.stolen && Math.random() < 0.35) line = ['d', pick(Math.random, STOLEN)];
      else if (ctxInfo.heat && Math.random() < 0.45) line = ['d', pick(Math.random, HEAT)];
      else line = DISPATCH[dispI++ % DISPATCH.length];
      const disp = line[0] === 'd';
      if (disp && Math.random() < 0.25) { chirp(t, 853, 0.35, 0.07); chirp(t + 0.38, 960, 0.35, 0.07); }
      const t0 = t;
      squelch(t0, 0.1, 0.18);
      const end = babble(t0 + 0.12, line[1], { pitch: disp ? 205 : 112 + Math.random() * 25, vol: 0.8, rate: 1.2 });
      squelch(end + 0.02, 0.22, 0.22); chirp(end + 0.02, 1150, 0.05, 0.05);
      caps.push({ t: t0, end, text: line[1] });
      next = end + (disp && DISPATCH[dispI % DISPATCH.length][0] === 'u' ? 0.6 + Math.random() : 3 + Math.random() * 6);
    }
  }
  return {
    vol, bus, set, pump, caps, babble, sting, locate,
    get station() { return cur; }, get kind() { return kind; }, get played() { return played; },
    song: (si, now) => locate(si, now).s,
  };
}

// ---------------- in-game radio (UI, input, car hook) ----------------
export function makeRadio({ P, G, hit, isTouch }) {
  let eng = null, list = null, idx = 0, last = 0, inCar = null, nameT = 0, shownSong = null, capShown = null, muted = false;
  let pick0 = Math.floor(Math.random() * 4);   // first civilian car starts on a random music station
  const el = document.createElement('div'); el.id = 'radio';
  el.style.cssText = `position:absolute;left:50%;${isTouch ? '' : 'top:58px;'}transform:translateX(-50%);text-align:center;pointer-events:none;opacity:0;transition:opacity .3s;font-size:30px;line-height:1;white-space:nowrap;`;
  const nm = document.createElement('div'), sub = document.createElement('div'), cap = document.createElement('div');
  sub.style.cssText = 'font-size:20px;color:#e8e8e8;margin-top:2px;';
  cap.id = 'radiocap'; // on touch the layout block in style.css places it
  cap.style.cssText = `position:fixed;${isTouch ? '' : 'left:50%;bottom:70px;transform:translateX(-50%);'}max-width:min(620px,86vw);white-space:normal;font-size:21px;color:#f4f4dc;background:rgba(0,0,0,.45);padding:3px 10px;display:none;`;
  el.append(nm, sub); (document.getElementById('hud') || document.body).append(el, cap);
  // touch: tapping the station name switches; a small RADIO tag stays while driving
  const btn = document.createElement('button'); btn.id = 'radiobtn'; btn.textContent = 'RADIO'; // placed by the touch layout in style.css
  btn.style.cssText = 'position:fixed;z-index:5;font:18px VT323,monospace;color:#fff;background:rgba(0,0,0,.45);border:2px solid #556;padding:4px 8px;display:none;pointer-events:auto;';
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sfx.unlock(); want = true; });
  if (isTouch) document.body.append(btn);
  let want = false;

  const isCruiser = (c) => !!(c && (c.pd || c.role === 'police' || c.role === 'pdParked'));
  function ensure() {
    if (eng) return eng;
    const a = Sfx.audio && Sfx.audio(); if (!a) return null;
    eng = makeRadioEngine(a.ctx, a.master); api.engine = eng; return eng;
  }
  function show(now) {
    const st = list[idx], S = st === 'scanner' ? SCANNER : STATIONS[st];
    nm.textContent = S.name; nm.style.color = S.col;
    let s = S.tag;
    if (eng && eng.kind === 'music') { const so = eng.song(st, now); s = `${so.artist} - "${so.title}"`; shownSong = so; }
    sub.textContent = s; nameT = 3.2; el.style.opacity = 1;
  }
  function tune(i) {
    const e = ensure(); if (!e) return;
    idx = (i + list.length) % list.length; const st = list[idx];
    if (st !== 'scanner') last = st;
    e.set(st, e.vol.context.currentTime); show(e.vol.context.currentTime);
    api.station = st === 'scanner' ? 'scanner' : STATIONS[st].id;
  }
  function enter(c) {
    const e = ensure(); if (!e) return;
    list = isCruiser(c) ? ['scanner', ...STATIONS.map((_, i) => i)] : STATIONS.map((_, i) => i);
    let start = isCruiser(c) ? 0 : list.indexOf(pick0 >= 0 ? pick0 : last);
    if (pick0 >= 0) { last = pick0; pick0 = -1; }
    if (start < 0) start = 0;
    tune(start);
    const t = e.vol.context.currentTime; e.vol.gain.cancelScheduledValues(t); e.vol.gain.setTargetAtTime(0.9, t + 0.25, 0.2);
  }
  function leave() {
    inCar = null; el.style.opacity = 0; cap.style.display = 'none'; btn.style.display = 'none'; api.station = null;
    if (!eng) return;
    const t = eng.vol.context.currentTime; eng.vol.gain.cancelScheduledValues(t); eng.vol.gain.setTargetAtTime(0, t, 0.08);
    eng.set(-1, t);
  }
  const api = {
    station: null, engine: null, stations: STATIONS, unlock: () => Sfx.unlock(),
    next() { if (inCar && list) tune(idx + 1); }, set(i) { if (inCar && list) tune(i); },
    update(dt) {
      if (!RADIO_ENABLED) return;
      const c = P.car && !P.car.dead ? P.car : null;
      if (c !== inCar) { if (inCar) leave(); if (c) { inCar = c; enter(c); if (!eng) inCar = null; } }
      if (!inCar || !eng) { want = false; return; }
      btn.style.display = isTouch ? 'block' : 'none';
      if (hit('r') || want) { want = false; tune(idx + 1); }
      const ctx = eng.vol.context, now = ctx.currentTime;
      const quiet = G.paused || G.dialog || !Sfx.isOn() || ctx.state !== 'running';
      if (quiet !== muted) { muted = quiet; eng.vol.gain.setTargetAtTime(quiet ? 0 : 0.9, now, 0.08); }
      if (!quiet) eng.pump(now, { heat: (G.heat || 0) > 0, stolen: !!(inCar.pd && inCar.pd.stolen) });
      if (nameT > 0 && (nameT -= dt || 0.016) <= 0) el.style.opacity = 0;
      if (eng.kind === 'music') { const so = eng.song(list[idx], now); if (so !== shownSong) show(now); }
      // captions for talk, dispatch and DJ lines
      let cc = null; for (const k of eng.caps) if (now >= k.t && now <= k.end + 0.6) cc = k;
      while (eng.caps.length && eng.caps[0].end + 0.6 < now) eng.caps.shift();
      if (cc !== capShown) { capShown = cc; cap.style.display = cc ? 'block' : 'none'; if (cc) cap.textContent = cc.text; }
    },
  };
  window.__RADIO = api;
  return api;
}
