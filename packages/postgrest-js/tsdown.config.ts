import { defineConfig } from 'tsdown';
import { createPackageConfig } from '../../build/tsdown-base.ts';
import { copyPackageJsonToDist } from '../../build/build-utils.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts'],
    noExternal: ['@neondatabase/internal'],
    hooks: {
      'build:done': async () => {
        copyPackageJsonToDist(import.meta.dirname, { transform: true });
      },
    },
  })
);
