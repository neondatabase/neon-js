/**
 * MSW Setup for Compatibility Tests
 *
 * Sets up Mock Service Worker to intercept HTTP requests during testing.
 * This allows us to mock Stack Auth API responses without running actual Stack Auth.
 */

import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { stackAuthHandlers } from './msw-handlers';

// Create MSW server instance with handlers pre-configured
export const server = setupServer(...stackAuthHandlers);

// Setup MSW before all tests
beforeAll(() => {
  // Set to 'warn' to see any requests that aren't being intercepted
  // This helps debug missing handlers while still allowing tests to run
  server.listen({
    onUnhandledRequest: 'warn',
  });
});

// Reset handlers after each test to default handlers
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
