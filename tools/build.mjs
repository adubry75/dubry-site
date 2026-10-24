// Build: src/ -> dist/index.html + dist/nine-lives/{js,fonts,...}
// Usage: node tools/build.mjs
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../src/build/markup.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => path.join(root, 'src', p);
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'nine-lives');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(assets, 'fonts'), { recursive: true });

// CSS: concatenated in cascade order, minified, inlined (no render-blocking request).
const CSS_ORDER = ['base', 'cat', 'wake', 'arcade', 'hall', 'big', 'gallery', 'trail', 'office', 'nap', 'overlays', 'motion'];
const cssRaw = CSS_ORDER.map((n) => fs.readFileSync(src(`css/${n}.css`), 'utf8')).join('\n');
const css = (await esbuild.transform(cssRaw, {
  loader: 'css', minify: true, target: ['chrome123', 'safari18', 'firefox128'],
})).code.trim();

// JS: ES modules, code-split per life, content-hashed for long caching.
const js = await esbuild.build({
  entryPoints: [src('js/main.js')], bundle: true, splitting: true, format: 'esm', minify: true,
  target: ['es2022'], outdir: path.join(assets, 'js'), entryNames: '[name]-[hash]', chunkNames: '[name]-[hash]',
  metafile: true, legalComments: 'none',
});
const mainOut = Object.entries(js.metafile.outputs).find(([, o]) => o.entryPoint)[0];
const mainUrl = '/nine-lives/js/' + path.basename(mainOut);

const [cabsA, cabsB] = M.cabRows();
const parts = {
  CSS: css, MAIN_JS: mainUrl, LIVES_NAV: M.livesNav(), FOOT_NAV: M.footNav(),
  CAT_RIG: M.catRig(), CAT_CURL: M.catStatic('curl', { cls: 'cat__curl' }),
  CAT_STRETCH: M.catStatic('stretch'), CAT_CURL_STATIC: M.catStatic('curl', { cls: 'nap__static' }),
  N_CABS: String(M.CABINETS.length), CABS_A: cabsA, CABS_B: cabsB, BIG: M.posters(), N_BIG: String(M.N_BIG), STORES: M.storeButtons(),
  BENCHES: M.benches(), CODE: M.code(), EGG_GRUMPY: M.EGGS.grumpy, EGG_HOLE: M.EGGS.hole,
};
let html = fs.readFileSync(src('index.html'), 'utf8');
html = html.replace(/<!--@(\w+)-->/g, (m, k) => {
  if (!(k in parts)) throw new Error('Unknown placeholder ' + k);
  return parts[k];
});
fs.writeFileSync(path.join(dist, 'index.html'), html);

// Fonts (OFL, self-hosted) and static files.
const nm = (p) => path.join(root, 'node_modules', p);
fs.copyFileSync(nm('@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2'), path.join(assets, 'fonts/unbounded.woff2'));
fs.copyFileSync(nm('@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2'), path.join(assets, 'fonts/space-grotesk.woff2'));
fs.copyFileSync(nm('@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2'), path.join(assets, 'fonts/silkscreen.woff2'));
if (fs.existsSync(src('static'))) fs.cpSync(src('static'), assets, { recursive: true });

const size = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
console.log('dist/index.html', size(path.join(dist, 'index.html')), '(css', (css.length / 1024).toFixed(1), 'KB inline)');
for (const [f, o] of Object.entries(js.metafile.outputs)) if (f.endsWith('.js')) console.log(path.relative(root, f), (o.bytes / 1024).toFixed(1), 'KB');
