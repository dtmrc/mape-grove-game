// Close-up shots of Goobles in his clothes (wardrobe.js), from the front, back and side, standing, walking and on all fours.
// node tools/qa/qa.cjs run tools/qa/scenarios/wardrobe.cjs [--outfits 'cap,scarf,sweater|vest,socks,gloves'] [--tag x]
module.exports = async ({ S, shot, args }) => {
  const outfits = String(args.outfits || 'cap,scarf,sweater,socks|vest,gloves|coonjacket,coongloves|').split('|');
  const views = [['front', 0], ['back', Math.PI], ['side', Math.PI / 2], ['34', 0.7]];
  await S.tp(args.at || '30,0');
  await S.js(([d, h]) => { window.__wd = d; window.__wh = h; }, [args.camd || 1.7, args.camh || 0.6]);
  await S.js(() => { window.QA.hud(false); window.QA.time(13, { freeze: true }); });
  const out = [];
  for (const [k, o] of outfits.entries()) {
    const poses = String(args.poses || 'stand,quad').split(',');
    for (const pose of poses) {
      await S.js(([o, pose]) => {
        const W = window.__G.wardrobe; for (const id in W.GARMENTS) { W.S.owned[id] = true; W.S.worn[id] = false; }
        for (const id of o.split(',').filter(Boolean)) W.setWorn(id, true);
        const u = window.__G.cat.userData; delete u.quad; if (pose === 'quad') Object.defineProperty(u, 'quad', { get: () => true, set() {}, configurable: true }); else u.quad = false;   // climb.js rewrites quad every frame window.__G.P.lock = 99;
        window.QA.frames(20);
      }, [o, pose]);
      for (const [vn, a] of views) {
        await S.js(([a, pose]) => {
          const { P } = window.__G, c = window.__G.cat, y = c.rotation.y + a, d = +(window.__wd || 1.7), h = pose === 'quad' ? 0.45 : +(window.__wh || 0.6);
          window.__camO = [[P.x + Math.sin(y) * d, (c.position.y || 0) + h + 0.25, P.z + Math.cos(y) * d], [P.x, (c.position.y || 0) + h, P.z]];
          window.QA.frames(2);
        }, [a, pose]);
        out.push(await shot(`${args.tag || 'ward'}-${k}-${pose}-${vn}`, { hud: false }));
      }
    }
  }
  await S.js(() => { window.__camO = null; const u = window.__G.cat.userData; delete u.quad; u.quad = false; window.__G.P.lock = 0; });
  return out;
};
