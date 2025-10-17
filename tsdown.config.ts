import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['./src/index.ts'],
    platform: 'neutral',
    dts: true,
    outDir: './dist',
  },
  {
    entry: ['./src/cli/index.ts'],
    platform: 'node',
    dts: false,
    outDir: './dist/cli',
  },
]);
