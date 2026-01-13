import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Environment detection - explicit boolean check
const isCI = process.env.CI === 'true' || process.env.CI === '1';

// App configuration - allows targeting different example apps
const APP_CONFIG = {
  'react-neon-js': {
    port: 5173,
    dir: '../examples/react-neon-js',
    devCommand: 'bun run dev',
    previewCommand: 'bun run preview',
  },
  'nextjs-neon-auth': {
    port: 3000,
    dir: '../examples/nextjs-neon-auth',
    devCommand: 'bun run dev',
    previewCommand: 'bun run start', // Next.js uses 'start' for production
  },
} as const;

type AppName = keyof typeof APP_CONFIG;

// Select app based on environment variable or default to react-neon-js
const targetApp = (process.env.E2E_TARGET_APP as AppName) || 'react-neon-js';
const appConfig = APP_CONFIG[targetApp];

// Configuration constants - avoid magic numbers
const TIMEOUTS = {
  test: 60_000, // 1 minute per test
  expect: 10_000, // 10 seconds for assertions
  webServer: 120_000, // 2 minutes for server startup (dev)
  webServerCI: 30_000, // 30 seconds for preview server
} as const;

// Absolute path resolution for cross-directory webServer (ES module compatible)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleAppDir = path.resolve(__dirname, appConfig.dir);

// Reporter configurations with satisfies for type safety
const ciReporters = [
  ['github'],
  ['blob'], // For sharded report merging
  ['html', { open: 'never' }], // HTML report for artifact upload
] satisfies ReporterDescription[];

const localReporters = [
  ['list'],
  ['html', { open: 'on-failure' }],
] satisfies ReporterDescription[];

export default defineConfig({
  testDir: './tests',
  // Filter tests based on app - Next.js only runs auth-flow tests (no Todos)
  testMatch:
    targetApp === 'nextjs-neon-auth' ? '**/auth-flow.spec.ts' : '**/*.spec.ts',

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
    baseURL: `http://localhost:${appConfig.port}`,
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
    command: isCI ? appConfig.previewCommand : appConfig.devCommand,
    url: `http://localhost:${appConfig.port}`,
    timeout: isCI ? TIMEOUTS.webServerCI : TIMEOUTS.webServer,
    reuseExistingServer: !isCI,
    cwd: exampleAppDir, // Absolute path for reliability
  },
});
