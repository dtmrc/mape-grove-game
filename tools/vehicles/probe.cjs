// node probe.cjs id "js expr using Bd"  : builds the model in node, captures the first K.body() result
const T = require('/home/claude/cars/node_modules/three'), fs = require('fs');
const SRC = ['vkit.js', 'common.js', 'smooth.js', ...fs.readdirSync('.').filter((f) => /^v-.*\.js$/.test(f))].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const K = new Function('T', SRC + '\nreturn makeVKit(T);')(T); const P = new Function(SRC + '\nreturn makeVPaint();')();
let Bd; const ob = K.body; K.body = (B) => (Bd ||= ob(B));
const [id, expr] = process.argv.slice(2);
// body is referenced by closure inside makeVKit, so patch via the returned object's function used by builders
new Function('K', 'P', SRC + `\nreturn build_${id}(K, P);`)(K, P);
console.log(new Function('Bd', 'K', 'return ' + expr)(Bd, K));
