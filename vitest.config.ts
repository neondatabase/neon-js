import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node', // Use Node environment for MSW compatibility
    setupFiles: [
      './src/auth/__tests__/msw-setup.ts', // Setup MSW for API mocking
    ],
    // Increase timeout for tests that make network requests
    testTimeout: 10000,
  },
});
