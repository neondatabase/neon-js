import { defineConfig } from 'tsdown';
import { createPackageConfig } from '../../build/tsdown-base.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['./src/index.ts'],
    external: ['@neondatabase/auth'],
  })
);
