// Renders each radio station offline (OfflineAudioContext in headless Chromium) and writes WAV previews plus
// loudness numbers. Usage: node tools/radio/preview.cjs [seconds=30] [outDir=qa-out/radio]
const path = require('path'), fs = require('fs');
const esbuild = require('esbuild');
const { chromium } = require('playwright');
(async () => {
  const secs = +(process.argv[2] || 30), out = process.argv[3] || 'qa-out/radio';
  fs.mkdirSync(out, { recursive: true });
  const js = esbuild.buildSync({ entryPoints: [path.join(__dirname, '../../src/js/radio.js')], bundle: true, write: false, format: 'iife', globalName: 'R' }).outputFiles[0].text;
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<html><body></body></html>'); await p.addScriptTag({ content: js });
  const ids = ['country', 'pop', 'lofi', 'rock', 'talk', 'scanner'];
  for (const id of ids) {
    const r = await p.evaluate(async ([id, secs]) => {
      const sr = 32000, ctx = new OfflineAudioContext(1, sr * secs, sr), e = R.makeRadioEngine(ctx, ctx.destination, { seed: 1 });
      e.vol.gain.value = 0.9 * 0.6;   // radio volume x Sfx master
      const si = id === 'scanner' ? 'scanner' : R.STATIONS.findIndex((s) => s.id === id);
      e.set(si, 0);
      for (let t = 0; t < secs; t += 0.1) e.pump(t, { heat: true });
      const buf = await ctx.startRendering(), d = buf.getChannelData(0);
      let sq = 0, pk = 0; for (let i = 0; i < d.length; i++) { sq += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); }
      const pcm = new Int16Array(d.length); for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
      let bin = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
      const song = typeof si === 'number' && R.STATIONS[si].bpm ? e.song(si, 0) : null;
      return { rms: Math.sqrt(sq / d.length), peak: pk, sr, b64: btoa(bin), song: song && `${song.artist} - ${song.title} @${song.bpm}bpm` };
    }, [id, secs]);
    const pcm = Buffer.from(r.b64, 'base64'), h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(r.sr, 24); h.writeUInt32LE(r.sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(path.join(out, `${id}.wav`), Buffer.concat([h, pcm]));
    console.log(id.padEnd(8), 'rms', r.rms.toFixed(3), 'peak', r.peak.toFixed(2), r.song || '');
  }
  await b.close();
})();
