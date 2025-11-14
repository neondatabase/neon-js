/**
 * Authentication Flow Tests
 *
 * Tests core authentication flows including signup, signin, signout,
 * session management, and user retrieval.
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
// Authentication Flow Tests
// =============================================================================

describe('Stack Auth Adapter - Authentication Flows', () => {
  beforeEach(() => {
    // Reset mock database
    resetMockDatabase();
  });

  describe('signUp', () => {
    it('should create a new user with email and password', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.id).toBeTruthy();
      expect(result.data.user?.email).toBe('test@example.com');
      expect(result.data.session).toBeTruthy();
      expect(result.data.session?.access_token).toBeTruthy();
      expect(result.data.session?.refresh_token).toBeTruthy();
    });

    it('should return error for existing email', async () => {
      const adapter = createAdapter();

      // First signup succeeds
      await adapter.signUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      // Second signup with same email fails
      const result = await adapter.signUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe('user_already_exists');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should normalize email addresses', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'Test@EXAMPLE.COM',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.email).toBe('test@example.com');
    });

    it('should store user metadata during signup', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            firstName: 'John',
            lastName: 'Doe',
            age: 30,
            plan: 'premium',
          },
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.user_metadata).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        plan: 'premium',
      });
    });

    it('should handle empty password', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: '',
      });

      expect(result.error).toBeTruthy();
      expect(result.data.user).toBeNull();
    });

    it('should handle empty email', async () => {
      const adapter = createAdapter();

      const result = await adapter.signUp({
        email: '',
        password: 'password123',
      });

      expect(result.error).toBeTruthy();
      expect(result.data.user).toBeNull();
    });

    it('should handle complex user metadata', async () => {
      const adapter = createAdapter();

      const complexMetadata = {
        profile: {
          avatar: 'https://example.com/avatar.jpg',
          bio: 'Software developer',
        },
        preferences: {
          theme: 'dark',
          notifications: true,
          language: 'en',
        },
        tags: ['developer', 'javascript', 'typescript'],
        score: 1500,
      };

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: complexMetadata,
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.user_metadata).toMatchObject(complexMetadata);
    });
  });

  describe('signInWithPassword', () => {
    beforeEach(async () => {
      // Create a test user
      const adapter = createAdapter();
      await adapter.signUp({
        email: 'user@example.com',
        password: 'correct-password',
        options: {
          data: { name: 'Test User' },
        },
      });
    });

    it('should authenticate with valid credentials', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'correct-password',
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.email).toBe('user@example.com');
      expect(result.data.session).toBeTruthy();
      expect(result.data.session?.access_token).toBeTruthy();
    });

    it('should reject invalid credentials', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'wrong-password',
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe('invalid_credentials');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should reject non-existent user', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithPassword({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe('invalid_credentials');
    });

    it('should handle case-insensitive email lookup', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithPassword({
        email: 'USER@EXAMPLE.COM',
        password: 'correct-password',
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.email).toBe('user@example.com');
    });

    it('should handle missing email', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithPassword({
        email: '',
        password: 'password123',
      });

      expect(result.error).toBeTruthy();
    });

    it('should handle missing password', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithPassword({
        email: 'user@example.com',
        password: '',
      });

      expect(result.error).toBeTruthy();
    });

    it('should preserve user metadata after sign in', async () => {
      const adapter = createAdapter();

      const result = await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'correct-password',
      });

      expect(result.data.user?.user_metadata).toMatchObject({
        name: 'Test User',
      });
    });
  });

  describe('signOut', () => {
    beforeEach(async () => {
      // Create and sign in a user
      const adapter = createAdapter();
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });
    });

    it('should sign out authenticated user', async () => {
      const adapter = createAdapter();

      // Sign in first
      await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'password123',
      });

      // Sign out
      const result = await adapter.signOut();

      expect(result.error).toBeNull();
    });

    it('should clear session after sign out', async () => {
      const adapter = createAdapter();

      // Sign in
      await adapter.signInWithPassword({
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

    it('should handle sign out when not authenticated', async () => {
      const adapter = createAdapter();

      const result = await adapter.signOut();

      // Should not error, just succeed
      expect(result.error).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return null when no session exists', async () => {
      const adapter = createAdapter();

      const result = await adapter.getSession();

      expect(result.error).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should return current session when authenticated', async () => {
      const adapter = createAdapter();

      // Create user and sign in
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'password123',
      });

      const result = await adapter.getSession();

      expect(result.error).toBeNull();
      expect(result.data.session).toBeTruthy();
      expect(result.data.session?.access_token).toBeTruthy();
      expect(result.data.session?.refresh_token).toBeTruthy();
      expect(result.data.session?.token_type).toBe('bearer');
    });

    it('should return null after sign out', async () => {
      const adapter = createAdapter();

      // Sign up and sign in
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      // Sign out
      await adapter.signOut();

      const result = await adapter.getSession();

      expect(result.data.session).toBeNull();
    });
  });

  describe('getUser', () => {
    it('should return error when not authenticated', async () => {
      const adapter = createAdapter();

      const result = await adapter.getUser();

      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe('session_not_found');
      expect(result.data.user).toBeNull();
    });

    it('should return current user when authenticated', async () => {
      const adapter = createAdapter();

      // Sign up
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      // Sign in
      await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'password123',
      });

      const result = await adapter.getUser();

      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.email).toBe('user@example.com');
      expect(result.data.user?.id).toBeTruthy();
    });

    it('should include user metadata', async () => {
      const adapter = createAdapter();

      // Sign up with metadata
      await adapter.signUp({
        email: 'newuser@example.com',
        password: 'password123',
        options: {
          data: { theme: 'dark', language: 'en' },
        },
      });

      const result = await adapter.getUser();

      expect(result.data.user?.user_metadata).toMatchObject({
        theme: 'dark',
        language: 'en',
      });
    });

    it('should return error after sign out', async () => {
      const adapter = createAdapter();

      // Sign up and sign in
      await adapter.signUp({
        email: 'user@example.com',
        password: 'password123',
      });

      // Sign out
      await adapter.signOut();

      const result = await adapter.getUser();

      expect(result.error).toBeTruthy();
      expect(result.data.user).toBeNull();
    });
  });
});
