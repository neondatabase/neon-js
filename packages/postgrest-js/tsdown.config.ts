import { defineConfig } from 'tsdown';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  dts: {
    build: true,
  },
  // Copy package.json after build
  hooks: {
    'build:done': async () => {
      const pkgPath = path.resolve(import.meta.dirname, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

      // Write package.json to dist/
      const distPkgPath = path.resolve(
        import.meta.dirname,
        'dist',
        'package.json'
      );
      writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2));
      console.log('✅ Copied package.json to dist/');
    },
  },
});
