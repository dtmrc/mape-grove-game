import { build } from 'esbuild';
import fs from 'fs';
const out = await build({ entryPoints: ['tools/cars/showroom.js'], bundle: true, format: 'iife', write: false, target: 'es2020', loader: { '.glb': 'binary', '.bin': 'binary', '.webp': 'dataurl' } });
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/showroom.html', '<!doctype html><body style="margin:0"><script>' + out.outputFiles[0].text.replace(/<\/script/g, '<\\/script') + '</script>');
console.log('dist/showroom.html');
