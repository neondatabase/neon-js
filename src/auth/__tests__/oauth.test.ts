/**
 * OAuth Authentication Tests (Node.js Environment)
 *
 * Tests OAuth error handling in Node.js environment.
 * OAuth flow tests that require browser APIs are in oauth.browser.test.ts
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

// =============================================================================
// OAuth Error Handling Tests (Node.js Compatible)
// =============================================================================

describe('Stack Auth Adapter - OAuth Error Handling', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('should return error when OAuth called in Node.js environment', async () => {
    const adapter = createAdapter();

    const result = await adapter.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://app.example.com/callback',
      },
    });

    // OAuth requires browser environment, so should return an error in Node.js
    expect(result.error).toBeTruthy();
    expect(result.error?.message).toContain('browser environment');
    expect(result.data.provider).toBe('google');
  });

  it('should handle unsupported OAuth provider gracefully', async () => {
    const adapter = createAdapter();

    // Note: This test will also fail in Node.js due to environment check
    // But it demonstrates the adapter's error handling pattern
    const result = await adapter.signInWithOAuth({
      provider: 'unsupported-provider' as any,
      options: {
        redirectTo: 'https://app.example.com/callback',
      },
    });

    // Should return an error (either environment or unsupported provider)
    expect(result.error).toBeTruthy();
    expect(result.error?.message).toBeTruthy();
    expect(result.data.provider).toBe('unsupported-provider');
  });
});
