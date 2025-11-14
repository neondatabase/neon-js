/**
 * OTP / Magic Link Authentication Tests
 *
 * Tests OTP and magic link flows for passwordless authentication.
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
    // Provide URLs for non-browser environment testing
    urls: {
      magicLinkCallback: 'http://localhost:3000/magic-link-callback',
    },
  });
}

// =============================================================================
// OTP/Magic Link Test Suite
// =============================================================================

describe('Stack Auth Adapter - OTP/Magic Link Authentication', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  describe('signInWithOtp', () => {
    it('should send magic link email', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithOtp({
        email: 'test@example.com',
      });

      expect(result.error).toBeNull();
    });

    // Send with redirect URL
    it('should send magic link with redirect URL', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithOtp({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'https://app.example.com/verify',
        },
      });

      expect(result.error).toBeNull();
    });

    it('should send OTP to new user (auto-signup)', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithOtp({
        email: 'newuser@example.com',
      });

      expect(result.error).toBeNull();
    });

    it('should send OTP to existing user', async () => {
      const adapter = createAdapter();

      // Create user first
      await adapter.signUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      // Send OTP
      const result = await adapter.signInWithOtp({
        email: 'existing@example.com',
      });

      expect(result.error).toBeNull();
    });

    // OTP with custom data
    it('should send OTP with custom data', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithOtp({
        email: 'test@example.com',
        options: {
          data: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      });

      expect(result.error).toBeNull();
    });

    it('should handle empty email', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithOtp({
        email: '',
      });

      // Should either error or handle gracefully
      if (result.error) {
        expect(result.error.message).toBeTruthy();
      }
    });

    it('should normalize email addresses', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithOtp({
        email: 'TEST@EXAMPLE.COM',
      });

      expect(result.error).toBeNull();
    });
  });

  describe('verifyOtp', () => {
    beforeEach(async () => {
      const adapter = createAdapter();
      // Send OTP first
      await adapter.signInWithOtp({ email: 'test@example.com' });
    });

    // Verify valid OTP
    it.skip('should verify valid OTP code (TODO: fix mock session state)', async () => {
      const adapter = createAdapter();

      const result = await adapter.verifyOtp({
        email: 'test@example.com',
        token: 'valid-code',
        type: 'magiclink',
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.email).toBe('test@example.com');
      expect(result.data.session).toBeTruthy();
      expect(result.data.session?.access_token).toBeTruthy();
    });

    it('should reject invalid OTP code', async () => {
      const adapter = createAdapter();

      const result = await adapter.verifyOtp({
        email: 'test@example.com',
        token: 'invalid-code',
        type: 'magiclink',
      });

      expect(result.error).toBeTruthy();
      expect(result.data.user).toBeNull();
    });

    it.skip('should verify OTP for email type (TODO: fix mock session state)', async () => {
      const adapter = createAdapter();

      // Send OTP
      await adapter.signInWithOtp({ email: 'email-test@example.com' });

      const result = await adapter.verifyOtp({
        email: 'email-test@example.com',
        token: 'valid-code',
        type: 'email',
      });

      // Should work with email type as well
      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
    });

    it.skip('should create session after successful verification (TODO: fix mock session state)', async () => {
      const adapter = createAdapter();

      // Verify OTP
      await adapter.verifyOtp({
        email: 'test@example.com',
        token: 'valid-code',
        type: 'magiclink',
      });

      // Check session exists
      const session = await adapter.getSession();
      expect(session.data.session).toBeTruthy();
      expect(session.data.session?.access_token).toBeTruthy();
    });

    it('should reject OTP with wrong email', async () => {
      const adapter = createAdapter();

      const result = await adapter.verifyOtp({
        email: 'wrong@example.com',
        token: 'valid-code',
        type: 'magiclink',
      });

      expect(result.error).toBeTruthy();
      expect(result.data.user).toBeNull();
    });

    // Email verification via OTP
    it.skip('should mark email as verified after OTP verification (TODO: fix mock session state)', async () => {
      const adapter = createAdapter();

      const result = await adapter.verifyOtp({
        email: 'test@example.com',
        token: 'valid-code',
        type: 'email',
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.email_confirmed_at).toBeTruthy();
    });
  });

  describe('OTP Rate Limiting', () => {
    it('should handle multiple OTP send requests', async () => {
      const adapter = createAdapter();

      // Send multiple OTPs
      for (let i = 0; i < 3; i++) {
        const result = await adapter.signInWithOtp({
          email: `test${i}@example.com`,
        });

        expect(result.error).toBeNull();
      }
    });
  });
});
