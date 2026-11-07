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
  siren() { tone(560, 0.25, 'triangle', 0.08, 200); tone(760, 0.25, 'triangle', 0.08, -200, 0.25); },
};
