// Makes the player-only share page: dist/index.html with the saved world baked in and dev tools hidden.
// Usage: node tools/share-build.mjs <dir holding terrain.json, ground.json, edits.json>  -> dist/share.html
// (Pull those docs from the game artifact's db collection `world` first.)
import fs from 'fs';
import path from 'path';
const dir = process.argv[2];
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
const world = { terrain: rd('terrain.json'), ground: rd('ground.json'), edits: rd('edits.json') };
let html = fs.readFileSync('dist/index.html', 'utf8');
const tag = `<script>window.__MG_SHARE=${JSON.stringify(world).replace(/</g, '\\u003c')};</script>`;
html = html.replace('<script>', tag + '\n<script>');
fs.writeFileSync('dist/share.html', html);
console.log('dist/share.html written', (html.length / 1024).toFixed(0), 'KB');
