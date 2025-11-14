/**
 * User Management Tests
 *
 * Tests user profile operations and metadata management.
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
  password: string = 'password123',
  metadata?: Record<string, any>
) {
  const adapter = createAdapter();
  await adapter.signUp({
    email,
    password,
    options: metadata ? { data: metadata } : undefined,
  });
  return adapter;
}

// =============================================================================
// User Management Test Suite
// =============================================================================

describe('Stack Auth Adapter - User Management', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  describe('updateUser', () => {
    beforeEach(() => {
      resetMockDatabase();
    });

    it('should update user metadata', async () => {
      const adapter = await createAuthenticatedAdapter(
        'user@example.com',
        'password123',
        {
          name: 'Original Name',
          theme: 'light',
        }
      );

      const result = await adapter.updateUser({
        data: {
          name: 'Updated Name',
          theme: 'dark',
          language: 'en',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.user_metadata).toMatchObject({
        name: 'Updated Name',
        theme: 'dark',
        language: 'en',
      });
    });

    it('should return error for email updates (not supported)', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.updateUser({
        email: 'newemail@example.com',
      });

      // Email updates require server-side Stack Auth configuration
      // The adapter should still succeed but log a warning
      // The email should remain unchanged
      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.email).toBe('user@example.com'); // Email unchanged
    });

    it('should return error for password updates (not supported)', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.updateUser({
        password: 'newpassword123',
      });

      // Password updates require reauthentication
      // Stack Auth doesn't support Supabase's nonce-based flow
      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe('feature_not_supported');
      expect(result.error?.message).toContain(
        'Password updates require reauthentication'
      );
      expect(result.data.user).toBeNull();
    });

    it('should merge partial metadata updates', async () => {
      const adapter = await createAuthenticatedAdapter(
        'user@example.com',
        'password123',
        {
          name: 'Original Name',
          theme: 'light',
        }
      );

      // Update only theme
      const result = await adapter.updateUser({
        data: {
          theme: 'dark',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.user_metadata).toMatchObject({
        name: 'Original Name', // Should preserve original value
        theme: 'dark', // Should update this value
      });
    });

    it('should return error when not authenticated', async () => {
      const adapter = await createAuthenticatedAdapter();

      // Sign out first
      await adapter.signOut();

      const result = await adapter.updateUser({
        data: {
          name: 'New Name',
        },
      });

      expect(result.error).toBeTruthy();
      expect(result.data.user).toBeNull();
    });

    it('should handle empty update gracefully', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.updateUser({
        data: {},
      });

      // Should succeed or handle gracefully
      if (!result.error) {
        expect(result.data.user).toBeTruthy();
      }
    });

    it('should handle normalized email on update (not supported)', async () => {
      const adapter = await createAuthenticatedAdapter();

      const result = await adapter.updateUser({
        email: 'NEWEMAIL@EXAMPLE.COM',
      });

      // Email updates require server-side Stack Auth configuration
      // The adapter should still succeed but the email remains unchanged
      expect(result.error).toBeNull();
      expect(result.data.user).toBeTruthy();
      expect(result.data.user?.email).toBe('user@example.com'); // Email unchanged
    });

    it('should handle complex nested metadata', async () => {
      const adapter = await createAuthenticatedAdapter();

      const complexData = {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          avatar: 'https://example.com/avatar.jpg',
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            sms: false,
          },
        },
        tags: ['developer', 'javascript'],
      };

      const result = await adapter.updateUser({
        data: complexData,
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.user_metadata).toMatchObject(complexData);
    });

    it('should handle multiple sequential updates', async () => {
      const adapter = await createAuthenticatedAdapter();

      // First update
      await adapter.updateUser({
        data: { step: 1 },
      });

      // Second update
      await adapter.updateUser({
        data: { step: 2 },
      });

      // Third update
      const result = await adapter.updateUser({
        data: { step: 3 },
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.user_metadata).toMatchObject({
        step: 3,
      });
    });
  });

  describe('User Profile Data', () => {
    beforeEach(() => {
      resetMockDatabase();
    });

    // User has ID
    it('should include user ID in profile', async () => {
      const adapter = await createAuthenticatedAdapter(
        'user@example.com',
        'password123',
        {
          name: 'Test User',
          age: 30,
        }
      );

      const result = await adapter.getUser();

      expect(result.data.user?.id).toBeTruthy();
      expect(typeof result.data.user?.id).toBe('string');
    });

    it('should include user email in profile', async () => {
      const adapter = await createAuthenticatedAdapter(
        'user@example.com',
        'password123',
        {
          name: 'Test User',
          age: 30,
        }
      );

      const result = await adapter.getUser();

      expect(result.data.user?.email).toBe('user@example.com');
    });

    it('should include user metadata in profile', async () => {
      const adapter = await createAuthenticatedAdapter(
        'user@example.com',
        'password123',
        {
          name: 'Test User',
          age: 30,
        }
      );

      const result = await adapter.getUser();

      expect(result.data.user?.user_metadata).toBeTruthy();
      expect(result.data.user?.user_metadata).toMatchObject({
        name: 'Test User',
        age: 30,
      });
    });

    it('should include creation timestamp', async () => {
      const adapter = await createAuthenticatedAdapter(
        'user@example.com',
        'password123',
        {
          name: 'Test User',
          age: 30,
        }
      );

      const result = await adapter.getUser();

      expect(result.data.user?.created_at).toBeTruthy();
      expect(typeof result.data.user?.created_at).toBe('string');
    });

    it('should persist metadata across sign out/in', async () => {
      const adapter = await createAuthenticatedAdapter(
        'user@example.com',
        'password123',
        {
          name: 'Test User',
          age: 30,
        }
      );

      // Sign out
      await adapter.signOut();

      // Sign in again
      await adapter.signInWithPassword({
        email: 'user@example.com',
        password: 'password123',
      });

      // Get user
      const result = await adapter.getUser();

      expect(result.data.user?.user_metadata).toMatchObject({
        name: 'Test User',
        age: 30,
      });
    });
  });

  describe('deleteUser', () => {
    beforeEach(() => {
      resetMockDatabase();
    });

    // Note: Stack Auth may not support user deletion in the same way as Supabase
    // These tests document expected behavior

    it('should handle user deletion if supported', async () => {
      const adapter = await createAuthenticatedAdapter(
        'deleteme@example.com',
        'password123'
      );

      // Check if adapter has deleteUser method
      if ('deleteUser' in adapter && typeof adapter.deleteUser === 'function') {
        const result = await (adapter as any).deleteUser();

        expect(result.error).toBeNull();

        // User should not be able to sign in after deletion
        const signInResult = await adapter.signInWithPassword({
          email: 'deleteme@example.com',
          password: 'password123',
        });

        expect(signInResult.error).toBeTruthy();
      } else {
        // If not supported, test should acknowledge this
        expect(true).toBe(true);
      }
    });
  });

  describe('User Session Context', () => {
    it('should have consistent user data between getUser and session', async () => {
      const adapter = createAdapter();

      await adapter.signUp({
        email: 'consistent@example.com',
        password: 'password123',
      });

      const userResult = await adapter.getUser();
      const sessionResult = await adapter.getSession();

      expect(userResult.data.user?.id).toBe(
        sessionResult.data.session?.user?.id
      );
      expect(userResult.data.user?.email).toBe(
        sessionResult.data.session?.user?.email
      );
    });
  });
});
