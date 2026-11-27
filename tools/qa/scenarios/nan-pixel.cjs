// Regression: NaN pixels in the scene (an iPhone produced them under the street lamps, 2026-11-27) must not bloom into
// screen-sized white blocks. Makes the cat's materials output NaN at night and measures how much of the frame is blown out (white on that iPhone, black in software GL). The old build fails this with a block ~5% of the frame.
// node tools/qa/qa.cjs run tools/qa/scenarios/nan-pixel.cjs [--html old/dist/dev.html --fresh]
module.exports = async ({ S, shot, check, args }) => {
  await S.js(() => { window.QA.hud(false); window.QA.time(22, { freeze: true }); });
  await S.tp('green');
  const r = await S.js(() => {
    const QA = window.QA, G = window.__G;
    const white = () => { const c = document.getElementById('c'), k = document.createElement('canvas'); k.width = 160; k.height = 90; const g = k.getContext('2d'); g.drawImage(c, 0, 0, 160, 90); const d = g.getImageData(0, 0, 160, 90).data; let n = 0; for (let i = 0; i < d.length; i += 4) if ((d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) || d[i] + d[i + 1] + d[i + 2] < 6) n++; return n / (160 * 90); };
    QA.cam(0, 0.1); QA.step(4, { render: true }); const before = white();
    let n = 0;
    G.cat.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.clone) return;
      const m = o.material.clone();
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = vec3( gl_FragCoord.x * 0.0 ) / vec3( gl_FragCoord.y * 0.0 );'); };
      m.customProgramCacheKey = () => 'qa-nan'; o.material = m; n++;
    });
    QA.step(4, { render: true }); const after = white();
    return { before, after, meshes: n };
  });
  if (check) check(`NaN pixels stay contained (blown out ${(r.after * 100).toFixed(1)}% of the frame, was ${(r.before * 100).toFixed(1)}%)`, r.after - r.before < 0.015, r);
  await shot(`${args.tag || 'nan'}-pixel`, { hud: false });
  return r;
};
