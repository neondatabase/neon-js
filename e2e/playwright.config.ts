import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Environment detection - explicit boolean check
const isCI = process.env.CI === 'true' || process.env.CI === '1';

// Configuration constants - avoid magic numbers
const DEV_SERVER_URL = 'http://localhost:5173';
const TIMEOUTS = {
  test: 60_000, // 1 minute per test
  expect: 10_000, // 10 seconds for assertions
  webServer: 120_000, // 2 minutes for server startup (dev)
  webServerCI: 30_000, // 30 seconds for preview server
} as const;

// Absolute path resolution for cross-directory webServer (ES module compatible)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleAppDir = path.resolve(__dirname, '../examples/react-app');

// Reporter configurations with satisfies for type safety
const ciReporters = [
  ['github'],
  ['blob'], // For sharded report merging
] satisfies ReporterDescription[];

const localReporters = [
  ['list'],
  ['html', { open: 'on-failure' }],
] satisfies ReporterDescription[];

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  // Parallel execution - 2 workers balances speed and stability
  fullyParallel: true,
  workers: isCI ? 2 : undefined,

  // Retry configuration
  retries: isCI ? 2 : 0,

  // CI-specific settings
  forbidOnly: isCI,

  // Timeouts
  timeout: TIMEOUTS.test,
  expect: {
    timeout: TIMEOUTS.expect,
  },

  // Reporter configuration
  reporter: isCI ? ciReporters : localReporters,

  // Shared settings for all projects
  use: {
    baseURL: DEV_SERVER_URL,
    trace: isCI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: isCI ? 'off' : 'on-first-retry', // Disable video in CI for speed

    // Test ID attribute for reliable selectors
    testIdAttribute: 'data-testid',
  },

  // Browser projects - Chromium only for now
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Auto-start example app server
  webServer: {
    command: isCI ? 'bun run preview' : 'bun run dev',
    url: DEV_SERVER_URL,
    timeout: isCI ? TIMEOUTS.webServerCI : TIMEOUTS.webServer,
    reuseExistingServer: !isCI,
    cwd: exampleAppDir, // Absolute path for reliability
  },
});
