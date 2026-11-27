// rigmerge.js draws a person or raccoon in a handful of draw calls instead of 15+. It must not change the picture:
// the same figure is built both ways (window.__RIG.on), posed mid-stride at the same spot with the world frozen,
// and the two frames are compared pixel by pixel.
module.exports = {
  name: 'rigmerge', desc: 'merged figures look the same as the piece-by-piece ones and cost far fewer draw calls',
  async run({ S, check, log }) {
    if (process.env.RIG_SHOTS) await S.js(() => { window.__RIG_SHOTS = true; });
    const r = await S.js(async () => {
      const QA = window.QA, G = window.__G, RIG = window.__RIG, out = [];
      await QA.tp('green', { settle: 10, render: false });
      G.G.paused = true; G.cat.visible = false;   // Goobles keeps breathing while paused: out of the picture
      const P = G.P, canvas = document.getElementById('c');
      const grab = () => { QA.step(1, { render: true }); const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; const g = c.getContext('2d'); g.drawImage(canvas, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const looks = { walker: () => G.makeFig.human({ skin: 0xd9a47a, hair: 0x5a3a1a, shirt: 0xa8332b, pants: 0x2c3e50, shoe: 0xe8e8e8, cap: 0x2e6fa1, smile: true }),
        cardigan: () => G.makeFig.human({ skin: 0x7a4b2e, hair: 0xaaaaaa, shirt: 0x2f8a52, pants: 0x7f6a4f, shoe: 0x222222, cardigan: 0x6e3c8d, glasses: true, bun: true, clipboard: true, smile: false }),
        raccoon: () => { const m = G.makeFig.raccoon(); m.scale.setScalar(1.35); return m; } };
      QA.cam(0.7 + Math.PI + 0.5, 0.25); QA.step(40, { render: true }); QA.shadowHold = true; QA.step(3, { render: true });   // camera settled, shadow map frozen
      const urls = {};
      for (const [name, make] of Object.entries(looks)) {
        const shots = {}, draws = {};
        for (const on of [false, true]) {
          RIG.on = on;
          const fig = make(), u = fig.userData;
          fig.position.set(P.x + 1.2, 0, P.z + 0.6); fig.rotation.y = 0.7;
          u.legs[0].rotation.x = 0.6; u.legs[1].rotation.x = -0.6; u.arms[0].rotation.x = -0.5; u.arms[1].rotation.x = 0.5; if (u.torso !== u.body) u.torso.rotation.y = 0.05; u.head.rotation.y = 0.2;
          QA.step(2, { render: true }); const base = QA.stats().drawCalls;
          G.scene.add(fig); QA.step(1, { render: true }); shots[on] = grab(); urls[name + (on ? '-merged' : '-pieces')] = canvas.toDataURL('image/png'); draws[on] = QA.stats().drawCalls - base;
          G.scene.remove(fig);
        }
        RIG.on = true;
        const a = shots[false], b = shots[true]; let diff = 0, big = 0, fg = 0;
        for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > 2) diff++; if (d > 24) big++; }
        out.push({ name, before: draws[false], after: draws[true], diff, big, px: a.length / 4 });
      }
      // hiding a pivot hides its part (townsfolk swap straight legs for bent ones this way)
      const fig = looks.walker(); fig.position.set(P.x + 1.2, 0, P.z + 0.6); G.scene.add(fig);
      const full = grab(); fig.userData.legs[0].visible = false; fig.userData.legs[1].visible = false; const cut = grab(); G.scene.remove(fig); const none = grab();
      let legsGone = 0, restSame = 0; for (let i = 0; i < full.length; i += 4) { const d1 = Math.abs(full[i] - cut[i]) + Math.abs(full[i + 1] - cut[i + 1]) + Math.abs(full[i + 2] - cut[i + 2]), d2 = Math.abs(cut[i] - none[i]) + Math.abs(cut[i + 1] - none[i + 1]) + Math.abs(cut[i + 2] - none[i + 2]); if (d1 > 30) legsGone++; if (d2 > 30) restSame++; }
      G.G.paused = false; QA.shadowHold = false; G.cat.visible = true;
      return { out, legsGone, restSame, urls: window.__RIG_SHOTS ? urls : null };
    });
    if (r.urls) for (const [k, u] of Object.entries(r.urls)) require('fs').writeFileSync(require('path').join(process.env.RIG_SHOTS, k + '.png'), Buffer.from(u.split(',')[1], 'base64'));
    for (const o of r.out) {
      log(`${o.name}: ${o.before} draw calls -> ${o.after}; ${o.diff} of ${o.px} pixels differ by more than 2/255, ${o.big} by more than 24/255`);
      check(`${o.name}: fewer draw calls (${o.before} -> ${o.after})`, o.after < o.before && o.after <= 6, o);
      check(`${o.name}: picture unchanged (${o.diff} px differ, ${o.big} strongly)`, o.diff <= 40 && o.big <= 4, o);
    }
    check(`hiding the leg pivots removes the legs (${r.legsGone} px) and keeps the rest (${r.restSame} px)`, r.legsGone > 150 && r.restSame > 400, r);
  },
};
