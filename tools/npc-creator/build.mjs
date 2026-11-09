// Bundles the NPC Creator into one HTML file: node tools/npc-creator/build.mjs  ->  dist/npc-creator.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const out = await build({ entryPoints: [join(here, 'app.js')], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, logLevel: 'warning' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(join(here, 'page.html'), 'utf8').replace('<script>/*APP*/</script>', () => '<script>' + js + '</script>');
mkdirSync(join(here, '../../dist'), { recursive: true });
writeFileSync(join(here, '../../dist/npc-creator.html'), html);
console.log('dist/npc-creator.html written (' + Math.round(html.length / 1024) + ' KB)');
