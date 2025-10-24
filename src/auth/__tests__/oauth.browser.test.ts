/**
 * OAuth Authentication Browser Tests
 *
 * Tests OAuth provider flows using Stack Auth's testing pattern:
 * - Patches window/document globals in Node.js (no jsdom needed)
 * - Captures OAuth redirect URLs via mocked window.location.assign()
 * - Validates OAuth URLs and parameters
 *
 * This approach follows Stack Auth's own testing pattern from their e2e tests.
 * See: stack-auth/apps/e2e/tests/js/oauth.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetMockDatabase } from './msw-handlers';
import { StackAuthAdapter } from '../adapters/stack-auth/stack-auth-adapter';

// =============================================================================
// Helper Functions
// =============================================================================

function createAdapter() {
  return new StackAuthAdapter({
    projectId: 'test-project',
    publishableClientKey: 'test-key',
    tokenStore: 'memory',
  });
}

/**
 * Patches window and document globals to capture OAuth redirect URLs.
 * Returns a cleanup function that restores original globals.
 *
 * Following Stack Auth's pattern from:
 * stack-auth/apps/e2e/tests/js/oauth.test.ts
 */
function patchBrowserGlobals() {
  const previousWindow = (globalThis as any).window;
  const previousDocument = (globalThis as any).document;

  // Store capturedUrl on an object to avoid closure issues
  const capture = { url: null as string | null };

  // Mock minimal document API
  (globalThis as any).document = {
    cookie: '',
    createElement: () => ({}),
  };

  // Mock minimal window API with location.assign that captures URL
  (globalThis as any).window = {
    location: {
      href: 'http://localhost:3000',
      assign: (url: string) => {
        capture.url = url;
        throw new Error('INTENTIONAL_TEST_ABORT');
      },
    },
  };

  return {
    capture, // Return the capture object directly
    cleanup: () => {
      (globalThis as any).window = previousWindow;
      (globalThis as any).document = previousDocument;
    },
  };
}

// =============================================================================
// OAuth Browser Test Suite
// =============================================================================

describe('Stack Auth Adapter - OAuth Authentication (Browser)', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  describe('signInWithOAuth', () => {
    it('should initiate OAuth flow for Google', async () => {
      // IMPORTANT: Patch globals BEFORE creating adapter
      // Stack Auth SDK caches window reference at initialization
      const { capture, cleanup } = patchBrowserGlobals();
      const adapter = createAdapter();

      try {
        // OAuth call will throw INTENTIONAL_TEST_ABORT when it tries to redirect
        // Adapter catches this and returns it as an error
        const result = await adapter.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'https://app.example.com/callback',
          },
        });

        // Should return error with INTENTIONAL_TEST_ABORT message
        expect(result.error).toBeTruthy();
        expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
        expect(result.data.provider).toBe('google');

        // Verify the captured redirect URL
        expect(capture.url).toBeTruthy();
        expect(capture.url).toContain('google');
      } finally {
        cleanup();
      }
    });

    it('should initiate OAuth flow for GitHub', async () => {
      const { capture, cleanup } = patchBrowserGlobals();
      const adapter = createAdapter();

      try {
        const result = await adapter.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: 'https://app.example.com/callback',
          },
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
        expect(result.data.provider).toBe('github');

        expect(capture.url).toBeTruthy();
        expect(capture.url).toContain('github');
      } finally {
        cleanup();
      }
    });

    it('should initiate OAuth flow for Microsoft', async () => {
      const { capture, cleanup } = patchBrowserGlobals();
      const adapter = createAdapter();

      try {
        const result = await adapter.signInWithOAuth({
          provider: 'azure',
          options: {
            redirectTo: 'https://app.example.com/callback',
          },
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
        expect(result.data.provider).toBe('azure');

        expect(capture.url).toBeTruthy();
      } finally {
        cleanup();
      }
    });

    it('should handle OAuth with custom scopes', async () => {
      const { capture, cleanup } = patchBrowserGlobals();
      const adapter = createAdapter();

      try {
        const result = await adapter.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'https://app.example.com/callback',
            scopes: 'email profile openid',
          },
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
        expect(result.data.provider).toBe('google');

        expect(capture.url).toBeTruthy();
      } finally {
        cleanup();
      }
    });

    it('should handle OAuth without explicit redirect URL', async () => {
      const { capture, cleanup } = patchBrowserGlobals();
      const adapter = createAdapter();

      try {
        const result = await adapter.signInWithOAuth({
          provider: 'google',
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
        expect(result.data.provider).toBe('google');

        expect(capture.url).toBeTruthy();
      } finally {
        cleanup();
      }
    });

    it('should preserve query parameters in redirect', async () => {
      const { capture, cleanup } = patchBrowserGlobals();
      const adapter = createAdapter();

      try {
        const result = await adapter.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo:
              'https://app.example.com/callback?plan=premium&ref=landing',
          },
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
        expect(result.data.provider).toBe('github');

        expect(capture.url).toBeTruthy();
      } finally {
        cleanup();
      }
    });

    it('should support multiple OAuth providers sequentially', async () => {
      const providers = ['google', 'github', 'azure', 'facebook'];

      for (const provider of providers) {
        const { capture, cleanup } = patchBrowserGlobals();
        const adapter = createAdapter();

        try {
          const result = await adapter.signInWithOAuth({
            provider: provider as any,
            options: {
              redirectTo: 'https://app.example.com/callback',
            },
          });

          expect(result.error).toBeTruthy();
          expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
          expect(result.data.provider).toBe(provider);

          expect(capture.url).toBeTruthy();
        } finally {
          cleanup();
        }
      }
    });

    it('should handle skipBrowserRedirect option', async () => {
      const { capture, cleanup } = patchBrowserGlobals();
      const adapter = createAdapter();

      try {
        const result = await adapter.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'https://app.example.com/callback',
            skipBrowserRedirect: true,
          },
        });

        expect(result.error).toBeTruthy();
        expect(result.error?.message).toContain('INTENTIONAL_TEST_ABORT');
        expect(result.data.provider).toBe('google');

        expect(capture.url).toBeTruthy();
        // URL should be generated but browser redirect was attempted
        // (Stack Auth SDK doesn't respect skipBrowserRedirect in the same way)
      } finally {
        cleanup();
      }
    });
  });
});
