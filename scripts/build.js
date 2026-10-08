// Bundles the dashboard modules (client/) into one file, public/dist/app.js.
//   node scripts/build.js         production: minified, no source map
//   node scripts/build.js --dev   development: readable, with a source map
// Uses esbuild's JavaScript API rather than its command line: on some Windows
// machines a group policy blocks running esbuild.exe directly.
import { rm } from 'node:fs/promises';
import * as esbuild from 'esbuild';

const OUT_DIR = 'public/dist';
const dev = process.argv.includes('--dev');

// Start clean, so no source map from an earlier dev build stays next to a
// production bundle.
await rm(OUT_DIR, { recursive: true, force: true });

const result = await esbuild.build({
  entryPoints: ['client/app.js'],
  outfile: `${OUT_DIR}/app.js`,
  bundle: true,
  minify: !dev,
  sourcemap: dev,
  // app.js uses top-level await, which needs ES module output.
  format: 'esm',
  metafile: true,
});

const size = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(dev ? 'Development build:' : 'Production build:');
for (const [file, { bytes }] of Object.entries(result.metafile.outputs)) {
  console.log(`  ${file} (${size(bytes)})`);
}
