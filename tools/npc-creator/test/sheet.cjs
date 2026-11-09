// node test/sheet.cjs <out.png> '<json recipes or "builds"|"random"|"hair"|"outfits">' [clip] [time]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [out, what, clip, time, focus] = process.argv.slice(2);
  const bundle = fs.readFileSync(path.join(__dirname, 'view.bundle.js'), 'utf8');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 400 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text()); });
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: bundle });
  const res = await page.evaluate(({ what, clip, time, focus }) => {
    let recipes;
    const D = window.defaultRecipe;
    if (what === 'builds') recipes = [D('male'), { ...D('male'), build: 'built', name: 'built' }, { ...D('male'), build: 'skinny', name: 'skinny' }, { ...D('male'), build: 'fat', name: 'fat' }, D('female'), { ...D('female'), build: 'skinny', name: 'f skinny' }, { ...D('female'), build: 'fat', name: 'f fat' }];
    else if (what === 'random') { let s = 12345; const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; recipes = Array.from({ length: 8 }, () => window.randomRecipe(rng)); }
    else if (what === 'hair') recipes = ['bald', 'buzz', 'short', 'sidepart', 'spiky', 'curly', 'bob', 'long', 'ponytail', 'bun', 'mohawk'].map((h) => ({ ...D(h === 'bob' || h === 'long' || h === 'ponytail' || h === 'bun' ? 'female' : 'male'), hair: h, name: h }));
    else if (what === 'faces') recipes = ['oval', 'round', 'square', 'long', 'heart'].map((f) => ({ ...D('male'), face: f, name: f, hair: 'buzz' })).concat(['button', 'small', 'pointed', 'big', 'wide', 'hooked'].map((n) => ({ ...D('female'), nose: n, name: n, hair: 'bun' })));
    else if (what === 'outfits') recipes = [['tee', 'jeans', 'none'], ['longsleeve', 'slacks', 'none'], ['polo', 'shorts', 'none'], ['tank', 'cargo', 'none'], ['buttonup', 'sweats', 'none'], ['hoodie', 'jeans', 'none'], ['tee', 'jeans', 'open'], ['tee', 'slacks', 'zip'], ['buttonup', 'slacks', 'blazer'], ['buttonup', 'jeans', 'vest'], ['tee', 'jeans', 'coat'], ['tee', 'skirt', 'none']].map(([s, p, j]) => ({ ...D(p === 'skirt' ? 'female' : 'male'), shirt: s, pants: p, jacket: j, name: s + '/' + p + '/' + j, jacketColor: '#7f6a4f' }));
    else recipes = JSON.parse(what);
    window.renderSheet(recipes, { focus, clip, time: time ? +time : undefined, cell: 260, views: recipes.length > 6 ? [[0, 0, 1], [0.6, 0.35, 0.75]] : undefined });
    return { sheet: window.sheet, info: window.info, atlas: window.atlas };
  }, { what, clip, time, focus });
  fs.writeFileSync(out, Buffer.from(res.sheet.split(',')[1], 'base64'));
  fs.writeFileSync(out.replace(/\.png$/, '-atlas.png'), Buffer.from(res.atlas.split(',')[1], 'base64'));
  console.log(JSON.stringify(res.info)); await browser.close();
})();
