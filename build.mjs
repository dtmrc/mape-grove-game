// Bundles src/ (game code + three.js) into one self-contained dist/index.html.
// Usage: npm install && node build.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (p) => path.join(root, 'src', p);

const out = await build({
  entryPoints: [src('js/game.js')], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020',
  legalComments: 'none', loader: { '.glb': 'binary' },
});
const js = out.outputFiles[0].text;
let html = fs.readFileSync(src('index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(style\.css)"\s*\/?>/, (_, f) => `<style>\n${fs.readFileSync(src(f), 'utf8')}</style>`);
html = html.replace(/<script src="js\/game\.js"><\/script>/, () => `<script>\n${js.replace(/<\/script/g, '<\\/script')}</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log(`dist/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
