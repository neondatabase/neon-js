import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/react/index.ts',
    'src/react/ui/index.ts',
    'src/react/adapters/index.ts',
    'src/vanilla/index.ts',
    'src/vanilla/adapters/index.ts',
  ],
  format: ['esm'],
  clean: true,
  external: ['@neondatabase/auth-ui'],
  dts: {
    build: true,
  },
});
