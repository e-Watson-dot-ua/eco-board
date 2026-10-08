// Bundles the dashboard modules (client/) into one minified file,
// public/dist/app.js, with a source map for debugging in the browser.
// Uses esbuild's JavaScript API rather than its command line: on some Windows
// machines a group policy blocks running esbuild.exe directly.
import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['client/app.js'],
  outfile: 'public/dist/app.js',
  bundle: true,
  minify: true,
  sourcemap: true,
  // app.js uses top-level await, which needs ES module output.
  format: 'esm',
  metafile: true,
});

const size = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
for (const [file, { bytes }] of Object.entries(result.metafile.outputs)) {
  console.log(`Built ${file} (${size(bytes)})`);
}
