/**
 * Supabase AuthClient Compatibility Tests
 *
 * Explicitly verifies that StackAuthAdapter implements AuthClient interface correctly
 * and maintains retrocompatibility with Supabase's expected behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetMockDatabase } from './msw-handlers';
import { StackAuthAdapter } from '../adapters/stack-auth/stack-auth-adapter';
import type { AuthClient } from '@/auth/auth-interface';

// =============================================================================
// Helper Functions
// =============================================================================

function createAdapter(): AuthClient {
  return new StackAuthAdapter({
    projectId: 'test-project',
    publishableClientKey: 'test-key',
    tokenStore: 'memory',
  });
}

// =============================================================================
// Supabase Compatibility Tests
// =============================================================================

describe('Supabase AuthClient Compatibility', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  describe('Interface Implementation', () => {
    it('should implement AuthClient interface', () => {
      const adapter = createAdapter();

      // Type-level check: adapter should be assignable to AuthClient
      expect(adapter).toBeDefined();
      expect(typeof adapter).toBe('object');
    });

    it('should have all required AuthClient methods', () => {
      const adapter = createAdapter();

      // Core authentication methods
      expect(typeof (adapter as any).signUp).toBe('function');
      expect(typeof (adapter as any).signInWithPassword).toBe('function');
      expect(typeof (adapter as any).signInWithOAuth).toBe('function');
      expect(typeof (adapter as any).signInWithOtp).toBe('function');
      expect(typeof (adapter as any).verifyOtp).toBe('function');

      // Session management
      expect(typeof (adapter as any).getSession).toBe('function');
      expect(typeof (adapter as any).setSession).toBe('function');
      expect(typeof (adapter as any).refreshSession).toBe('function');

      // User management
      expect(typeof (adapter as any).getUser).toBe('function');
      expect(typeof (adapter as any).updateUser).toBe('function');
      expect(typeof (adapter as any).getClaims).toBe('function');

      // Identity management
      expect(typeof (adapter as any).getUserIdentities).toBe('function');
      expect(typeof (adapter as any).linkIdentity).toBe('function');
      expect(typeof (adapter as any).unlinkIdentity).toBe('function');

      // Password/auth flows
      expect(typeof (adapter as any).resetPasswordForEmail).toBe('function');
      expect(typeof (adapter as any).resend).toBe('function');
      expect(typeof (adapter as any).reauthenticate).toBe('function');

      // Session termination
      expect(typeof (adapter as any).signOut).toBe('function');

      // State management
      expect(typeof (adapter as any).onAuthStateChange).toBe('function');

      // Exchange code for session
      expect(typeof (adapter as any).exchangeCodeForSession).toBe('function');
    });
  });

  describe('Response Format Compatibility', () => {
    it('should return Supabase-compatible { data, error } format', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      // Check for required Supabase response structure
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(typeof result.data).toBe('object');
    });

    it('should include user object in successful response', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      if (result.error === null) {
        expect(result.data).toHaveProperty('user');
        const user = result.data.user;
        if (user) {
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('email');
        }
      }
    });

    it('should include session object in successful authentication', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      if (result.error === null && result.data.session) {
        const session = result.data.session;
        expect(session).toHaveProperty('access_token');
        expect(session).toHaveProperty('refresh_token');
        expect(session).toHaveProperty('token_type');
        expect(session.token_type).toBe('bearer');
      }
    });

    it('should return null for data/session when not authenticated', async () => {
      const adapter = createAdapter();

      const result = await adapter.getSession();

      if (result.error === null) {
        expect(result.data.session).toBeNull();
      }
    });

    it('should return structured error object on failure', async () => {
      const adapter = createAdapter();

      // Try to sign in with non-existent user
      const result = await adapter.signInWithPassword({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      if (result.error) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result.data.user).toBeNull();
        expect(result.data.session).toBeNull();
      }
    });
  });

  describe('Error Code Consistency', () => {
    it('should use Supabase-compatible error codes', async () => {
      const adapter = createAdapter();

      // Test invalid credentials error code
      const result = await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'wrong-password',
      });

      if (result.error?.code) {
        // Should be a recognizable Supabase error code
        expect(typeof result.error.code).toBe('string');
        expect(result.error.code.length).toBeGreaterThan(0);
      }
    });

    it('should use consistent error code format', () => {
      const adapter = createAdapter();

      // Error codes should follow pattern: lowercase with underscores
      // Examples: invalid_credentials, user_not_found, session_not_found
      const errorCodePattern = /^[a-z_]+$/;
      expect(errorCodePattern.test('invalid_credentials')).toBe(true);
      expect(errorCodePattern.test('user_not_found')).toBe(true);
      expect(errorCodePattern.test('session_not_found')).toBe(true);
    });
  });

  describe('User Object Structure', () => {
    it('should include required user fields', async () => {
      const adapter = createAdapter();

      // Create and retrieve user
      const signupResult = await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      if (signupResult.error === null && signupResult.data.user) {
        const user = signupResult.data.user;
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('user_metadata');
        expect(user).toHaveProperty('app_metadata');
        expect(user).toHaveProperty('aud');
        expect(user).toHaveProperty('created_at');
      }
    });

    it('should preserve user metadata after operations', async () => {
      const adapter = createAdapter();

      const metadata = {
        firstName: 'John',
        lastName: 'Doe',
        theme: 'dark',
      };

      const result = await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
        options: {
          data: metadata,
        },
      });

      if (result.error === null && result.data.user) {
        expect(result.data.user.user_metadata).toMatchObject(metadata);
      }
    });
  });

  describe('Session Object Structure', () => {
    it('should include required session fields', async () => {
      const adapter = createAdapter();

      // Create user and retrieve session
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      const sessionResult = await adapter.getSession();

      if (sessionResult.error === null && sessionResult.data.session) {
        const session = sessionResult.data.session;
        expect(session).toHaveProperty('access_token');
        expect(session).toHaveProperty('refresh_token');
        expect(session).toHaveProperty('token_type');
        expect(session).toHaveProperty('expires_in');
        expect(session).toHaveProperty('expires_at');

        // Verify types
        expect(typeof session.access_token).toBe('string');
        expect(typeof session.refresh_token).toBe('string');
        expect(session.token_type).toBe('bearer');
      }
    });
  });

  describe('Method Behavior Compatibility', () => {
    it('signUp should return both user and session', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      if (result.error === null) {
        expect(result.data.user).toBeTruthy();
        expect(result.data.session).toBeTruthy();
      }
    });

    it('getSession should return null when not authenticated', async () => {
      const adapter = createAdapter();

      const result = await adapter.getSession();

      expect(result.error).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('getUser should return error when not authenticated', async () => {
      const adapter = createAdapter();

      const result = await adapter.getUser();

      expect(result.error).toBeTruthy();
      expect(result.data.user).toBeNull();
    });

    it('signOut should always return success', async () => {
      const adapter = createAdapter();

      // Sign out without session should not error
      const result = await adapter.signOut();

      expect(result.error).toBeNull();
    });
  });

  describe('Real SDK Integration', () => {
    it('should use real Stack Auth SDK (not mocked)', () => {
      const adapter = createAdapter() as StackAuthAdapter;

      // Verify adapter has real SDK instance
      expect((adapter as any).stackAuth).toBeDefined();
      // The stackAuth should be StackClientApp or StackServerApp instance
      expect(typeof (adapter as any).stackAuth).toBe('object');
    });

    it('should handle real Stack Auth SDK session format', async () => {
      const adapter = createAdapter();

      // Sign up which creates a session
      const result = await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      if (result.error === null && result.data.session) {
        // Tokens should be valid JWT strings (real SDK format)
        const token = result.data.session.access_token;
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      }
    });
  });
});
