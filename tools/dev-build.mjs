// Makes the dev-tools page: dist/index.html + the cheats/debug panel (src/js/devcheats.js) -> dist/dev.html.
// Usage (after `node tools/devcheats-hooks.mjs src/js/game.js && node build.mjs`): node tools/dev-build.mjs
// Publish dist/dev.html to the dev artifact WITH capabilities {db:{}} (it keeps its own saved world).
import fs from 'fs';
import { build } from 'esbuild';
const out = await build({ entryPoints: ['src/js/devcheats.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020' });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
let html = fs.readFileSync('dist/index.html', 'utf8');
html = html.replace('<script>', '<script>window.__MG_DEV=true;</script>\n<script>');
html = html.replace(/<title>([^<]*)<\/title>/, '<title>$1 (Dev)</title>');
const i = html.lastIndexOf('</body>');
html = i >= 0 ? html.slice(0, i) + `<script>\n${js}</script>\n` + html.slice(i) : html + `<script>\n${js}</script>\n`;
fs.writeFileSync('dist/dev.html', html);
console.log('dist/dev.html written', (html.length / 1024).toFixed(0), 'KB');
