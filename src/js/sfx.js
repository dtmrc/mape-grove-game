// Tiny synthesized sound effects (WebAudio). Everything is generated, no audio files.
let ctx = null, master = null, on = true;
let eng = null, sir = null;

function tone(freq, dur, type = 'square', vol = 0.12, slide = 0, delay = 0) {
  if (!ctx || !on) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, lp = 1200) {
  if (!ctx || !on) return;
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}

export const Sfx = {
  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
      // engine: two detuned saws through a lowpass
      eng = { o1: ctx.createOscillator(), o2: ctx.createOscillator(), f: ctx.createBiquadFilter(), g: ctx.createGain() };
      eng.o1.type = 'sawtooth'; eng.o2.type = 'square'; eng.f.type = 'lowpass'; eng.f.frequency.value = 500; eng.g.gain.value = 0;
      eng.o1.connect(eng.f); eng.o2.connect(eng.f); eng.f.connect(eng.g); eng.g.connect(master);
      eng.o1.start(); eng.o2.start();
      sir = { o: ctx.createOscillator(), g: ctx.createGain() };
      sir.o.type = 'triangle'; sir.g.gain.value = 0; sir.o.connect(sir.g); sir.g.connect(master); sir.o.start();
    } catch (e) { ctx = null; }
  },
  toggle() { on = !on; if (master) master.gain.value = on ? 0.6 : 0; return on; },
  isOn() { return on; },
  engine(level, siren) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (level < 0) eng.g.gain.setTargetAtTime(0, t, 0.1);
    else {
      const f = 38 + level * 120 + Math.sin(t * 30) * 2;
      eng.o1.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      eng.f.frequency.setTargetAtTime(300 + level * 900, t, 0.05);
      eng.g.gain.setTargetAtTime(0.05 + level * 0.05, t, 0.1);
    }
    sir.o.frequency.setValueAtTime(Math.floor(t * 2.5) % 2 ? 720 : 560, t);
    sir.g.gain.setTargetAtTime(siren * 0.035, t, 0.2);
  },
  blip(f = 660) { tone(f, 0.08, 'square', 0.08); },
  pickup() { tone(880, 0.06, 'square', 0.08); tone(1320, 0.1, 'square', 0.08, 0, 0.06); },
  jingle() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.08, 0, i * 0.11)); },
  swing() { noise(0.08, 0.06, 3000); },
  punch() { noise(0.12, 0.3, 700); tone(120, 0.12, 'sine', 0.2, -60); },
  hurt() { tone(300, 0.2, 'sawtooth', 0.1, -200); },
  crash(v) { noise(0.25 + Math.min(0.3, v / 60), Math.min(0.5, 0.1 + v / 40), 900); },
  boom() { noise(1.2, 0.6, 400); tone(80, 0.8, 'sine', 0.4, -50); },
  door() { tone(180, 0.05, 'square', 0.08); tone(120, 0.06, 'square', 0.08, 0, 0.06); },
  horn() { tone(392, 0.35, 'square', 0.06); tone(466, 0.35, 'square', 0.05); },
  /** Goobles' voice: a synthesized meow. kind: 'hup' (jump effort), 'mew' (double jump), 'yowl' (triple jump),
   *  'mrrp' (hops up onto something), 'hiss' (falls into water), 'grumble' (still swimming), 'pff' (climbs out). */
  meow(kind = 'mew', pitch = 1, delay = 0) {
    if (!ctx || !on) return;
    const K = {   // f0 start / peak / end (Hz), duration, formant open (Hz), loudness, breathiness
      hup:     [520, 640, 470, 0.13, 1500, 0.10, 0.25],
      mew:     [620, 860, 560, 0.22, 1900, 0.11, 0.15],
      yowl:    [480, 900, 380, 0.48, 1700, 0.12, 0.2],
      mrrp:    [380, 560, 600, 0.16, 1100, 0.10, 0.3, true],
      hiss:    [430, 700, 300, 0.62, 1300, 0.12, 0.35, true],
      grumble: [300, 380, 260, 0.45, 900, 0.07, 0.3, true],
      pff:     [500, 420, 330, 0.14, 1000, 0.07, 0.6],
    }[kind] || [620, 860, 560, 0.22, 1900, 0.11, 0.15];
    const [a, b, c, dur, open, vol, br, trill] = K;
    const t = ctx.currentTime + delay, j = pitch * (0.94 + Math.random() * 0.12), d = dur * (0.9 + Math.random() * 0.2);
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol * 1.5, t + Math.min(0.04, d * 0.2));
    out.gain.setValueAtTime(vol * 1.5, t + d * 0.7); out.gain.exponentialRampToValueAtTime(0.0001, t + d);
    out.connect(master);
    // two formants: closed "m" -> open "eow" -> closing "w"
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = f2.type = 'bandpass'; f1.Q.value = 5; f2.Q.value = 7;
    f1.frequency.setValueAtTime(350, t); f1.frequency.linearRampToValueAtTime(open * 0.55, t + d * 0.35); f1.frequency.linearRampToValueAtTime(420, t + d);
    f2.frequency.setValueAtTime(900, t); f2.frequency.linearRampToValueAtTime(open * 1.6, t + d * 0.35); f2.frequency.linearRampToValueAtTime(1000, t + d);
    f1.connect(out); f2.connect(out);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(a * j, t); o.frequency.exponentialRampToValueAtTime(b * j, t + d * 0.4); o.frequency.exponentialRampToValueAtTime(c * j, t + d);
    const vib = ctx.createOscillator(), vg = ctx.createGain();   // vibrato, or a rolled "rrr" trill
    vib.frequency.value = trill ? 28 : 6; vg.gain.value = trill ? a * j * 0.12 : a * j * 0.02;
    vib.connect(vg); vg.connect(o.frequency);
    const og = ctx.createGain(); og.gain.value = 1; o.connect(og); og.connect(f1); og.connect(f2);
    // breath
    const n = Math.floor(ctx.sampleRate * d), buf = ctx.createBuffer(1, n, ctx.sampleRate), dd = buf.getChannelData(0);
    for (let i = 0; i < n; i++) dd[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = buf; const ng = ctx.createGain(); ng.gain.value = br * 0.6; ns.connect(ng); ng.connect(f2);
    o.start(t); vib.start(t); ns.start(t);   // (delay lets a preview line several up) o.stop(t + d + 0.05); vib.stop(t + d + 0.05); ns.stop(t + d + 0.05);
  },
  splash() { noise(0.35, 0.25, 1800); },
  siren() { tone(560, 0.25, 'triangle', 0.08, 200); tone(760, 0.25, 'triangle', 0.08, -200, 0.25); },
};
