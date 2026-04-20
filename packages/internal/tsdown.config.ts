import { defineConfig } from 'tsdown';
import { createPackageConfig } from '../../build/tsdown-base.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts'],
    // Bypass tsc --build (rolldown-plugin-dts stale buildinfo bug —
    // crashes with "Unable to build .d.ts file for src/index.ts" on rebuild).
    // TODO: remove once rolldown-plugin-dts bug is fixed upstream.
    dts: true,
  })
);
