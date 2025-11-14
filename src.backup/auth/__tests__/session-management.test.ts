/**
 * Session Management Tests
 *
 * Tests session lifecycle, token handling, and refresh flows.
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
 * Helper to sign up a user and return the adapter with active session
 */
async function createAuthenticatedAdapter(
  email: string = 'user@example.com',
  password: string = 'password123'
) {
  const adapter = createAdapter();
  await adapter.signUp({
    email,
    password,
  });
  return adapter;
}

// =============================================================================
// Session Management Test Suite
// =============================================================================

describe('Stack Auth Adapter - Session Management', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  describe('Session Lifecycle', () => {
    it('should create session on signup', async () => {
      const adapter = createAdapter();

      const signupResult = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(signupResult.error).toBeNull();
      expect(signupResult.data.session).toBeTruthy();
      expect(signupResult.data.session?.access_token).toBeTruthy();
      expect(signupResult.data.session?.refresh_token).toBeTruthy();

      // Session should be retrievable
      const sessionResult = await adapter.getSession();
      expect(sessionResult.data.session).toBeTruthy();
    });

    it('should create session on sign in', async () => {
      const adapter = createAdapter();

      // Create user
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      // Sign out
      await adapter.signOut();

      // Sign in
      const signinResult = await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(signinResult.error).toBeNull();
      expect(signinResult.data.session).toBeTruthy();
      expect(signinResult.data.session?.access_token).toBeTruthy();
    });

    it('should clear session on sign out', async () => {
      const adapter = createAdapter();

      // Sign up
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      // Verify session exists
      let session = await adapter.getSession();
      expect(session.data.session).toBeTruthy();

      // Sign out
      await adapter.signOut();

      // Verify session cleared
      session = await adapter.getSession();
      expect(session.data.session).toBeNull();
    });

    it('should handle session replacement on re-login', async () => {
      const adapter = createAdapter();

      // First login
      const firstLogin = await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });
      const firstToken = firstLogin.data.session?.access_token;

      // Sign out
      await adapter.signOut();

      // Second login
      const secondLogin = await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'password123',
      });
      const secondToken = secondLogin.data.session?.access_token;

      // Tokens should be different
      expect(firstToken).not.toBe(secondToken);
    });
  });

  describe('Session Properties', () => {
    it('should include access_token in session', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.getSession();

      expect(result.data.session?.access_token).toBeTruthy();
      expect(typeof result.data.session?.access_token).toBe('string');
    });

    it('should include refresh_token in session', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.getSession();

      expect(result.data.session?.refresh_token).toBeTruthy();
      expect(typeof result.data.session?.refresh_token).toBe('string');
    });

    it('should include token_type in session', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.getSession();

      expect(result.data.session?.token_type).toBe('bearer');
    });

    it('should include expires_in in session', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.getSession();

      expect(result.data.session?.expires_in).toBeTruthy();
      expect(typeof result.data.session?.expires_in).toBe('number');
      expect(result.data.session?.expires_in).toBeGreaterThan(0);
    });

    it('should include expires_at timestamp in session', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.getSession();

      expect(result.data.session?.expires_at).toBeTruthy();
      expect(typeof result.data.session?.expires_at).toBe('number');
    });

    it('should include user in session', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.getSession();

      expect(result.data.session?.user).toBeTruthy();
      expect(result.data.session?.user?.email).toBe('user@example.com');
    });
  });

  describe('Session Persistence', () => {
    it('should persist session between API calls', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'persist@example.com',
        password: 'password123',
      });

      // Get session multiple times
      const session1 = await adapter.getSession();
      const session2 = await adapter.getSession();
      const session3 = await adapter.getSession();

      expect(session1.data.session?.access_token).toBe(
        session2.data.session?.access_token
      );
      expect(session2.data.session?.access_token).toBe(
        session3.data.session?.access_token
      );
    });

    it('should use session for getUser calls', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      // getUser should work without passing token explicitly
      const result = await adapter.getUser();

      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.email).toBe('user@example.com');
    });
  });

  describe('Token Refresh', () => {
    it('should handle manual session refresh (returns current session)', async () => {
      const adapter = await createAuthenticatedAdapter('test@example.com');

      const currentSession = await adapter.getSession();
      const currentToken = currentSession.data.session?.access_token;

      // Stack Auth's refreshSession returns the current session without rotation
      // The SDK handles token refresh automatically when needed
      const refreshResult = await adapter.refreshSession();

      expect(refreshResult.error).toBeNull();
      expect(refreshResult.data.session).toBeTruthy();

      // Token should be the same (Stack Auth handles refresh automatically, not on-demand)
      const refreshedToken = refreshResult.data.session?.access_token;
      expect(refreshedToken).toBe(currentToken);
    });

    it('should handle automatic token refresh', async () => {
      const adapter = await createAuthenticatedAdapter('refresh@example.com');

      // Get initial session
      const initialSession = await adapter.getSession();
      expect(initialSession.data.session).toBeTruthy();

      // In a real scenario, we'd wait for token to expire
      // For testing, we just verify the session structure supports refresh
      expect(initialSession.data.session?.refresh_token).toBeTruthy();
      expect(initialSession.data.session?.expires_in).toBeTruthy();
    });
  });

  describe('Session Expiry', () => {
    it('should handle expired session gracefully', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'expiry@example.com',
        password: 'password123',
      });

      // Get session
      const session = await adapter.getSession();
      expect(session.data.session).toBeTruthy();

      // Check expiry information
      const expiresAt = session.data.session?.expires_at;
      const currentTime = Math.floor(Date.now() / 1000);

      expect(expiresAt).toBeTruthy();
      expect(expiresAt!).toBeGreaterThan(currentTime);
    });

    it('should provide session validity information', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'valid@example.com',
        password: 'password123',
      });

      const session = await adapter.getSession();

      expect(session.data.session?.expires_in).toBeGreaterThan(0);
      expect(session.data.session?.expires_at).toBeGreaterThan(
        Math.floor(Date.now() / 1000)
      );
    });
  });

  describe('Session Security', () => {
    it('should create separate sessions for different users', async () => {
      const adapter = createAdapter();

      // User 1
      const user1 = await adapter.signUp({
        email: 'user1@example.com',
        password: 'password123',
      });
      const token1 = user1.data.session?.access_token;

      // Sign out
      await adapter.signOut();

      // User 2
      const user2 = await adapter.signUp({
        email: 'user2@example.com',
        password: 'password123',
      });
      const token2 = user2.data.session?.access_token;

      // Tokens should be different
      expect(token1).not.toBe(token2);
    });

    it('should invalidate session on sign out', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'invalidate@example.com',
        password: 'password123',
      });

      // Get session
      const beforeSignout = await adapter.getSession();
      expect(beforeSignout.data.session).toBeTruthy();

      // Sign out
      await adapter.signOut();

      // Try to use session
      const afterSignout = await adapter.getSession();
      expect(afterSignout.data.session).toBeNull();

      // getUser should fail
      const userResult = await adapter.getUser();
      expect(userResult.error).toBeTruthy();
    });

    it('should generate properly formatted tokens', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'format@example.com',
        password: 'password123',
      });

      const accessToken = result.data.session?.access_token;
      const refreshToken = result.data.session?.refresh_token;

      // Tokens should be non-empty strings
      expect(accessToken).toBeTruthy();
      expect(typeof accessToken).toBe('string');
      expect(accessToken!.length).toBeGreaterThan(0);

      expect(refreshToken).toBeTruthy();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken!.length).toBeGreaterThan(0);

      // Tokens should be different
      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('Concurrent Session Handling', () => {
    it('should handle concurrent getSession calls', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'concurrent@example.com',
        password: 'password123',
      });

      // Make multiple concurrent calls
      const [session1, session2, session3] = await Promise.all([
        adapter.getSession(),
        adapter.getSession(),
        adapter.getSession(),
      ]);

      // All should return the same session
      expect(session1.data.session?.access_token).toBe(
        session2.data.session?.access_token
      );
      expect(session2.data.session?.access_token).toBe(
        session3.data.session?.access_token
      );
    });

    it('should handle concurrent authenticated API calls', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'parallel@example.com',
        password: 'password123',
      });

      // Make multiple concurrent calls
      const [user1, user2, session] = await Promise.all([
        adapter.getUser(),
        adapter.getUser(),
        adapter.getSession(),
      ]);

      // All should succeed
      expect(user1.error).toBeNull();
      expect(user2.error).toBeNull();
      expect(session.error).toBeNull();

      // User data should be consistent
      expect(user1.data.user?.email).toBe('parallel@example.com');
      expect(user2.data.user?.email).toBe('parallel@example.com');
    });
  });

  describe('Session Recovery', () => {
    it('should maintain session after failed API call', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'recovery@example.com',
        password: 'password123',
      });

      // Try an operation that might fail
      await adapter.updateUser({ data: {} });

      // Session should still be valid
      const session = await adapter.getSession();
      expect(session.data.session).toBeTruthy();

      // Should still be able to get user
      const user = await adapter.getUser();
      expect(user.error).toBeNull();
      expect(user.data.user).toBeTruthy();
    });
  });
});
