const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  await esbuild.build({
    entryPoints: ['frontend/widget.js'],
    bundle: true,
    minify: true,
    outfile: 'dist/widget.min.js',
    platform: 'browser',
    target: ['es2018'],
    external: ['three'],
    banner: {
      js: '/* Saguaro Labs 3D — Quote Widget v1.0.0 */',
    },
  });

  const size = fs.statSync('dist/widget.min.js').size;
  console.log(`Built dist/widget.min.js — ${(size / 1024).toFixed(1)}KB`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
