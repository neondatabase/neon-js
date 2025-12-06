import { defineConfig } from 'tsdown';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createPackageConfig } from '../../build/tsdown-base.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts'],
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
  })
);
