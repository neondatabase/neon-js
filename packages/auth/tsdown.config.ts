import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/better-auth/index.ts'],
  format: ['esm'],
  clean: true,
  dts: {
    build: true,
  },
});
