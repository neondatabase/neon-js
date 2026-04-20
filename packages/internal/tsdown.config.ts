import { defineConfig } from 'tsdown';
import { createPackageConfig } from '../../build/tsdown-base.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts'],
    // rolldown-plugin-dts's `build: true` path (the base-config default) breaks on
    // rebuilds: tsdown cleans dist/ but not tsconfig.tsbuildinfo, so `tsc --build`
    // declares the project up-to-date and emits nothing, then the plugin can't
    // find dist/index.d.ts. Internal has no project references, so the plain
    // (non-tsc-build) dts mode is equivalent and avoids the bug.
    dts: true,
  })
);
